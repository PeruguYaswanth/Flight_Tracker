import { ApiResponse } from '../types/flight';

export interface LiveFlightPosition {
  flightNumber: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  altitude: number | null;
  speed: number | null;
  isGround: boolean;
  updatedAt: string | null;
  source: string | null;
}

/** Shape of the success response from the backend (new structured format) */
interface LivePositionSuccessResponse {
  success: true;
  position: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    isGround: boolean;
    updatedAt: string | null;
  };
  aircraft: {
    icao24: string | null;
    callsign: string;
  };
  source: string;
}

/** Shape of the unavailable response from the backend */
interface LivePositionErrorResponse {
  success: false;
  error: {
    code: string;
    reason?: string;
    message?: string;
  };
}

type LivePositionResponse = LivePositionSuccessResponse | LivePositionErrorResponse;

// Human-readable descriptions for each unavailable reason
const REASON_MESSAGES: Record<string, string> = {
  no_aircraft_identifier: 'No aircraft identifier could be resolved for this flight.',
  no_opensky_position: 'Live position is currently unavailable for this flight.',
  stale_opensky_position: 'Last known position is too old to be considered live.',
  aircraft_on_ground: 'Aircraft is currently on the ground.',
};

export function describeLiveUnavailableReason(reason?: string): string {
  if (reason && REASON_MESSAGES[reason]) {
    return REASON_MESSAGES[reason];
  }
  return 'Live position is currently unavailable for this flight.';
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class LiveFlightApiClient {
  /**
   * Fetches the live aircraft position from the dedicated live-tracking
   * backend endpoint (OpenSky Network, independent of AirLabs).
   *
   * `icao24` — the aircraft's real ICAO24/hex transponder address.
   * `icaoCallsign` — ICAO callsign (e.g. "UAE527"), sent as `?icao=` param
   *   for the backend's callsign fallback path.
   *
   * On success: returns the parsed position.
   * On `LIVE_POSITION_UNAVAILABLE`: throws with `code = 'LIVE_POSITION_UNAVAILABLE'`
   *   and `reason` set to the backend's specific reason string.
   */
  public static async getLivePosition(
    flightNumber: string,
    icaoCallsign: string | null,
    icao24: string | null,
    operatingFlightNumber: string | null,
    signal?: AbortSignal
  ): Promise<LiveFlightPosition> {
    const params = new URLSearchParams();
    if (icaoCallsign) params.set('icao', icaoCallsign);
    if (icao24) params.set('icao24', icao24);
    if (operatingFlightNumber) params.set('operatingFlightNumber', operatingFlightNumber);

    const endpoint = `${BASE_URL}/live-flights/${encodeURIComponent(flightNumber)}?${params.toString()}`;

    const response = await fetch(endpoint, { signal });
    const data: LivePositionResponse | ApiResponse<LiveFlightPosition> = await response.json();

    // Handle structured success response (new backend format: { success, position, aircraft, source })
    if (data.success === true && 'position' in data && data.position) {
      const pos = data.position;
      // Validate that we have real coordinates
      if (
        typeof pos.latitude === 'number' &&
        typeof pos.longitude === 'number' &&
        Number.isFinite(pos.latitude) &&
        Number.isFinite(pos.longitude) &&
        !(pos.latitude === 0 && pos.longitude === 0)
      ) {
        return {
          flightNumber,
          latitude: pos.latitude,
          longitude: pos.longitude,
          heading: pos.heading ?? null,
          altitude: pos.altitude ?? null,
          speed: pos.speed ?? null,
          isGround: pos.isGround ?? false,
          updatedAt: pos.updatedAt ?? null,
          source: data.source ?? null,
        };
      }
    }

    // Handle legacy success response (old backend format: { success, data: { latitude, ... } })
    if (data.success === true && 'data' in data && data.data) {
      const pos = data.data as LiveFlightPosition;
      if (
        typeof pos.latitude === 'number' &&
        typeof pos.longitude === 'number' &&
        Number.isFinite(pos.latitude) &&
        Number.isFinite(pos.longitude) &&
        !(pos.latitude === 0 && pos.longitude === 0)
      ) {
        return { ...pos, source: pos.source ?? null };
      }
    }

    // Error or unavailable
    const errorData = data as LivePositionErrorResponse;
    const error: any = new Error(
      errorData.error?.message || 'Unable to retrieve live aircraft position.'
    );
    error.code = errorData.error?.code || 'LIVE_POSITION_UNAVAILABLE';
    error.reason = errorData.error?.reason || null;
    throw error;
  }
}
