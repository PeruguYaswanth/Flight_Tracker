import { API_BASE_URL } from './apiBase';
import { fetchWithTimeout } from './http';

export type LiveReason =
  | 'NO_IDENTIFIER'
  | 'NO_MATCH'
  | 'STALE'
  | 'ON_GROUND'
  | 'INVALID_POSITION'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  // Client-side outcomes
  | 'NETWORK_ERROR'
  | 'REQUEST_LIMIT';

export interface LiveFlightPosition {
  flightNumber: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  altitude: number | null;
  speed: number | null;
  /** Provider's on-ground flag; null when not reported. */
  isGround: boolean | null;
  updatedAt: string | null;
  source: string | null;
  icao24: string | null;
  callsign: string | null;
}

/** Mirrors the backend's LiveFlightResponse - the endpoint's only shape. */
interface LiveFlightResponse {
  success: boolean;
  data: {
    flightNumber: string;
    hasLiveTracking: boolean;
    live: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      speed: number | null;
      heading: number | null;
      callsign: string | null;
      icao24: string;
      timestamp: string | null;
      source: 'opensky' | 'airlabs';
      onGround?: boolean | null;
    } | null;
    liveUnavailableReason?: LiveReason;
    message?: string;
  };
}

export type LiveLookupResult =
  | { available: true; position: LiveFlightPosition }
  | { available: false; reason: LiveReason; message: string };

const REASON_MESSAGES: Record<LiveReason, string> = {
  NO_IDENTIFIER: 'No aircraft identifier could be resolved for this flight.',
  NO_MATCH: 'Live position is currently unavailable for this flight.',
  STALE: 'The last known position is too old to be shown as current.',
  ON_GROUND: 'The aircraft is currently on the ground.',
  INVALID_POSITION: 'The live data for this aircraft has no valid position.',
  AUTH_ERROR: 'The live position service is temporarily unavailable.',
  RATE_LIMITED: 'The live position service is busy. Please try again shortly.',
  PROVIDER_ERROR: 'The live position service is temporarily unavailable.',
  NETWORK_ERROR: 'Unable to reach the live position service.',
  REQUEST_LIMIT: 'Live position temporarily unavailable due to request limits.',
};

export function describeLiveUnavailableReason(reason?: LiveReason | null): string {
  return (reason && REASON_MESSAGES[reason]) || REASON_MESSAGES.NO_MATCH;
}

/** Same rules as the backend: finite, in range, and not the (0,0) sentinel. */
export function isValidLiveCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export interface LiveLookupParams {
  /** ICAO callsign from the schedule (e.g. "IGO5221") - never an ICAO24. */
  callsign?: string | null;
  /** Aircraft hex transponder address, when known. */
  icao24?: string | null;
  /** Operating flight for a codeshare. */
  operatingFlightNumber?: string | null;
  depIata?: string | null;
  arrIata?: string | null;
}

const BASE_URL = API_BASE_URL;

export class LiveFlightApiClient {
  /**
   * Live aircraft position for a flight. Resolves for every outcome - a
   * real position, or the specific reason there isn't one - and only
   * rejects when aborted.
   */
  public static async getLivePosition(
    flightNumber: string,
    lookup: LiveLookupParams,
    signal?: AbortSignal
  ): Promise<LiveLookupResult> {
    const params = new URLSearchParams();
    if (lookup.callsign) params.set('callsign', lookup.callsign);
    if (lookup.icao24) params.set('icao24', lookup.icao24);
    if (lookup.operatingFlightNumber) params.set('operatingFlightNumber', lookup.operatingFlightNumber);
    if (lookup.depIata) params.set('depIata', lookup.depIata);
    if (lookup.arrIata) params.set('arrIata', lookup.arrIata);

    const unavailable = (reason: LiveReason, message?: string): LiveLookupResult => ({
      available: false,
      reason,
      message: message || describeLiveUnavailableReason(reason),
    });

    let data: LiveFlightResponse | { success: false; error?: { code?: string } } | null;
    try {
      // no-store: a live position is never answered from the HTTP cache.
      const response = await fetchWithTimeout(`${BASE_URL}/live-flights/${encodeURIComponent(flightNumber)}?${params.toString()}`, {
        signal,
        cache: 'no-store',
      });
      data = await response.json().catch(() => null);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      return unavailable('NETWORK_ERROR');
    }

    // The app's own request limiter answers in the generic error shape.
    if (!data || !('data' in data) || !data.data) {
      const code = (data as { error?: { code?: string } } | null)?.error?.code;
      return unavailable(code === 'RATE_LIMIT_EXCEEDED' ? 'REQUEST_LIMIT' : 'PROVIDER_ERROR');
    }

    const { live, hasLiveTracking, liveUnavailableReason, message } = data.data;
    if (!hasLiveTracking || !live) {
      return unavailable(liveUnavailableReason || 'NO_MATCH', message);
    }

    const pos = live;
    if (!isValidLiveCoordinate(pos.latitude, pos.longitude)) {
      return unavailable('INVALID_POSITION');
    }

    return {
      available: true,
      position: {
        flightNumber,
        latitude: pos.latitude,
        longitude: pos.longitude,
        heading: pos.heading ?? null,
        altitude: pos.altitude ?? null,
        speed: pos.speed ?? null,
        isGround: typeof pos.onGround === 'boolean' ? pos.onGround : null,
        updatedAt: pos.timestamp ?? null,
        source: pos.source ?? null,
        icao24: pos.icao24 ?? null,
        callsign: pos.callsign ?? null,
      },
    };
  }
}
