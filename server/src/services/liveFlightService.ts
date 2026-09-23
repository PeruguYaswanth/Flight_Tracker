import axios, { AxiosInstance } from 'axios';
import { config } from '../config/environment';
import { LivePosition } from '../types/flight';

export interface LiveFlightPosition extends LivePosition {
  flightNumber: string;
}

interface OpenSkyStateVector extends Array<any> {
  0: string; // icao24
  1: string; // callsign (padded with trailing spaces)
  2: string; // origin_country
  3: number | null; // time_position
  4: number | null; // last_contact
  5: number | null; // longitude
  6: number | null; // latitude
  7: number | null; // baro_altitude (meters)
  8: boolean; // on_ground
  9: number | null; // velocity (m/s)
  10: number | null; // true_track (heading, degrees)
  11: number | null; // vertical_rate
}

export type LiveUnavailableReason =
  | 'airlabs_icao24_missing'
  | 'opensky_icao24_not_visible'
  | 'callsign_not_currently_visible'
  | 'stale_opensky_position';

export interface LiveResolutionResult {
  position: LiveFlightPosition | null;
  reason: LiveUnavailableReason | null;
  strategy: 'frontend_icao24' | 'airlabs_icao24' | 'callsign_fallback';
}

/**
 * Rejects missing/NaN/out-of-range coordinates and the (0,0) "null island"
 * sentinel some providers use for an unknown position.
 */
function isValidCoordinate(lat: unknown, lng: unknown): boolean {
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

// A real ICAO24 is a 6-character hex string (e.g. "710abc"). Anything else
// is not a plausible aircraft address and must never be sent to OpenSky as
// one - falls back to callsign matching instead.
const ICAO24_PATTERN = /^[0-9a-f]{6}$/;

function normalizeIcao24(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  return ICAO24_PATTERN.test(cleaned) ? cleaned : null;
}

function normalizeCallsign(raw?: string | null): string {
  return (raw || '').replace(/\s+/g, '').toUpperCase();
}

const METERS_TO_FEET = 3.28084;
const MPS_TO_KMH = 3.6;

// A matched OpenSky state older than this is not treated as a genuine
// live position - showing it would be indistinguishable from a stale/
// stopped aircraft to the user. OpenSky's own crowdsourced feed can lag a
// little, so this is generous without being unbounded.
const MAX_POSITION_AGE_SECONDS = 15 * 60;

function isFresh(lastContact: number | null): boolean {
  if (typeof lastContact !== 'number') return false;
  return Date.now() / 1000 - lastContact <= MAX_POSITION_AGE_SECONDS;
}

function mapStateVectorToPosition(match: OpenSkyStateVector, flightNumber: string): LiveFlightPosition | null {
  const latitude = match[6];
  const longitude = match[5];
  if (!isValidCoordinate(latitude, longitude)) return null;

  const baroAltitudeM = match[7];
  const velocityMps = match[9];
  const trueTrack = match[10];
  const lastContact = match[4];

  return {
    flightNumber,
    latitude: latitude as number,
    longitude: longitude as number,
    altitude: typeof baroAltitudeM === 'number' ? Math.round(baroAltitudeM * METERS_TO_FEET) : null,
    heading: typeof trueTrack === 'number' ? Math.round(trueTrack) : null,
    speed: typeof velocityMps === 'number' ? Math.round(velocityMps * MPS_TO_KMH) : null,
    isGround: Boolean(match[8]),
    updatedAt: typeof lastContact === 'number' ? new Date(lastContact * 1000).toISOString() : null,
  };
}

export interface ResolveLivePositionParams {
  flightIata?: string | null;
  flightIcao?: string | null;
  icao24?: string | null;
  registration?: string | null;
  /** How icao24 (if any) was obtained - purely for logging/diagnostics. */
  icao24Source?: 'frontend_supplied' | 'airlabs_primary' | 'airlabs_codeshare' | null;
}

/**
 * Live aircraft position from OpenSky Network - a separate, independent
 * provider from AirLabs, used only for real-time lat/lon/heading/altitude/
 * speed. AirLabs remains the source for flight search, schedule, status,
 * terminal and gate.
 *
 * Matching priority:
 *  1. ICAO24/hex (the aircraft's actual unique transponder address) via a
 *     filtered OpenSky request - cheap and authoritative. A valid hex that
 *     OpenSky doesn't currently see is "unavailable", NEVER a trigger to
 *     fall back to guessing by callsign (that could match a different
 *     aircraft).
 *  2. Only when no usable hex is available at all does this fall back to
 *     ICAO callsign / IATA flight number exact matching against the full
 *     `/states/all` snapshot.
 *  Every match (either path) is also checked for freshness - a stale
 *  OpenSky state is reported as unavailable, never displayed as if live.
 */
export class LiveFlightService {
  private client: AxiosInstance;

  // Full-snapshot cache, used only by the callsign fallback path.
  private cachedStates: OpenSkyStateVector[] | null = null;
  private cacheTimestamp = 0;
  private inFlightFetch: Promise<OpenSkyStateVector[]> | null = null;

  // Per-ICAO24 cache, used by the primary filtered-lookup path.
  private icao24Cache = new Map<string, { timestamp: number; result: LiveResolutionResult }>();
  private icao24InFlight = new Map<string, Promise<LiveResolutionResult>>();

  private readonly cacheTtlMs = 60_000;

  private authClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private inFlightTokenFetch: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.liveFlightApiBaseUrl,
      timeout: config.requestTimeoutMs,
      headers: { Accept: 'application/json' },
    });
    this.authClient = axios.create({ timeout: config.requestTimeoutMs });
  }

  private get hasOAuthCredentials(): boolean {
    return Boolean(config.openskyClientId && config.openskyClientSecret);
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.hasOAuthCredentials) return null;

    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (this.inFlightTokenFetch) {
      return this.inFlightTokenFetch;
    }

    this.inFlightTokenFetch = this.fetchAccessToken();
    try {
      return await this.inFlightTokenFetch;
    } finally {
      this.inFlightTokenFetch = null;
    }
  }

  private async fetchAccessToken(): Promise<string | null> {
    try {
      const response = await this.authClient.post(
        config.openskyAuthUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.openskyClientId,
          client_secret: config.openskyClientSecret,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const token = response.data?.access_token as string | undefined;
      const expiresInSec = typeof response.data?.expires_in === 'number' ? response.data.expires_in : 1800;

      if (config.isDev) {
        console.log('[LiveFlightService] OpenSky OAuth2 token refresh:', response.status, '| received:', Boolean(token));
      }

      if (!token) return null;

      this.accessToken = token;
      this.tokenExpiresAt = Date.now() + Math.max(expiresInSec - 60, 30) * 1000;
      return token;
    } catch (err: any) {
      if (config.isDev) {
        console.log('[LiveFlightService] OpenSky OAuth2 token refresh failed:', err.response?.status, err.message);
      }
      return null;
    }
  }

  /**
   * Single entry point for resolving a flight's live position.
   */
  public async resolveLivePosition(params: ResolveLivePositionParams): Promise<LiveResolutionResult> {
    const { flightIata, flightIcao, icao24, icao24Source } = params;

    if (config.isDev) {
      console.log('[LiveFlightService] Live resolution started', {
        flightNumber: flightIata || null,
        icaoCallsign: flightIcao || null,
        suppliedIcao24: icao24 || null,
      });
    }

    const normalizedIcao24 = normalizeIcao24(icao24);

    if (normalizedIcao24) {
      const strategy = icao24Source === 'frontend_supplied' ? 'frontend_icao24' : 'airlabs_icao24';
      if (config.isDev) {
        console.log('[LiveFlightService] Identifier strategy', { strategy });
      }
      const result = await this.getByIcao24(normalizedIcao24, flightIata || flightIcao || normalizedIcao24);
      if (config.isDev && !result.position) {
        console.log('[LiveFlightService] Live position unavailable', {
          flightNumber: flightIata || flightIcao || null,
          reason: result.reason,
        });
      }
      return { ...result, strategy };
    }

    if (config.isDev) {
      console.log('[LiveFlightService] Identifier strategy', { strategy: 'callsign_fallback' });
    }

    const candidates = [flightIcao, flightIata].filter((c): c is string => Boolean(c));
    const result = await this.getByCallsign(candidates, flightIcao || null, flightIata || flightIcao || '');
    if (config.isDev && !result.position) {
      console.log('[LiveFlightService] Live position unavailable', {
        flightNumber: flightIata || flightIcao || null,
        reason: result.reason,
      });
    }
    return { ...result, strategy: 'callsign_fallback' };
  }

  /**
   * Looks up one aircraft by ICAO24 using OpenSky's `icao24` filter
   * parameter, avoiding a full `/states/all` download. Cached per-icao24.
   */
  private async getByIcao24(icao24: string, flightNumberForResult: string): Promise<LiveResolutionResult> {
    if (config.isDev) {
      console.log('[LiveFlightService] OpenSky ICAO24 lookup', { icao24 });
    }

    const cached = this.icao24Cache.get(icao24);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      if (config.isDev) {
        console.log('[LiveFlightService] Using cached OpenSky icao24 result', {
          icao24,
          ageMs: Date.now() - cached.timestamp,
        });
      }
      return cached.result;
    }

    const inFlight = this.icao24InFlight.get(icao24);
    if (inFlight) return inFlight;

    const promise = this.fetchByIcao24(icao24, flightNumberForResult)
      .then((result) => {
        this.icao24Cache.set(icao24, { timestamp: Date.now(), result });
        return result;
      })
      .finally(() => {
        this.icao24InFlight.delete(icao24);
      });

    this.icao24InFlight.set(icao24, promise);
    return promise;
  }

  private async fetchByIcao24(icao24: string, flightNumberForResult: string): Promise<LiveResolutionResult> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.get('/states/all', {
        params: { icao24 },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const states: OpenSkyStateVector[] = Array.isArray(response.data?.states) ? response.data.states : [];
      const match = states.find((s) => (s[0] || '').toLowerCase() === icao24) || null;
      const coordsValid = Boolean(match) && isValidCoordinate(match?.[6], match?.[5]);

      if (config.isDev) {
        console.log('[LiveFlightService] OpenSky match', {
          matched: coordsValid,
          icao24,
          callsign: match ? (match[1] || '').trim() : null,
          latitude: match ? match[6] : null,
          longitude: match ? match[5] : null,
        });
      }

      if (!match || !coordsValid) {
        return { position: null, reason: 'opensky_icao24_not_visible', strategy: 'airlabs_icao24' };
      }

      if (!isFresh(match[4])) {
        if (config.isDev) {
          console.log('[LiveFlightService] OpenSky state is stale - not treating as live', {
            icao24,
            lastContact: match[4],
            ageSeconds: Math.round(Date.now() / 1000 - (match[4] || 0)),
          });
        }
        return { position: null, reason: 'stale_opensky_position', strategy: 'airlabs_icao24' };
      }

      return { position: mapStateVectorToPosition(match, flightNumberForResult), reason: null, strategy: 'airlabs_icao24' };
    } catch (err: any) {
      if (config.isDev) {
        console.log('[LiveFlightService] Provider request failed (icao24 lookup):', err.response?.status, err.message);
      }
      const error: any = new Error('Unable to retrieve live aircraft position.');
      error.statusCode = 502;
      error.code = 'LIVE_PROVIDER_ERROR';
      throw error;
    }
  }

  /**
   * Fallback path: exact (whitespace/case-insensitive, never prefix)
   * matching of ICAO callsign then IATA flight number against the full
   * OpenSky snapshot. Only used when no usable ICAO24 is available.
   */
  private async getByCallsign(
    candidates: string[],
    requestedCallsign: string | null,
    flightNumberForResult: string
  ): Promise<LiveResolutionResult> {
    const normalizedCandidates = Array.from(new Set(candidates.map(normalizeCallsign).filter((c) => c.length > 0)));

    if (normalizedCandidates.length === 0) {
      return { position: null, reason: 'callsign_not_currently_visible', strategy: 'callsign_fallback' };
    }

    const states = await this.getStates();

    const match = states.find((s) => {
      const callsign = normalizeCallsign(s[1]);
      return callsign.length > 0 && normalizedCandidates.includes(callsign);
    });

    const matchedCallsign = match ? normalizeCallsign(match[1]) : null;

    if (config.isDev) {
      console.log('[LiveFlightService] OpenSky exact callsign lookup', {
        requestedCallsign: requestedCallsign || normalizedCandidates[0],
        matchedCallsign,
        matched: Boolean(match),
      });
    }

    if (!match) {
      return { position: null, reason: 'callsign_not_currently_visible', strategy: 'callsign_fallback' };
    }

    if (!isFresh(match[4])) {
      if (config.isDev) {
        console.log('[LiveFlightService] OpenSky state is stale - not treating as live', {
          callsign: matchedCallsign,
          lastContact: match[4],
          ageSeconds: Math.round(Date.now() / 1000 - (match[4] || 0)),
        });
      }
      return { position: null, reason: 'stale_opensky_position', strategy: 'callsign_fallback' };
    }

    return {
      position: mapStateVectorToPosition(match, flightNumberForResult || matchedCallsign || ''),
      reason: null,
      strategy: 'callsign_fallback',
    };
  }

  /**
   * Fetches (or reuses a cached copy of) the full OpenSky state-vector
   * snapshot. Only used by the callsign fallback path.
   */
  private async getStates(): Promise<OpenSkyStateVector[]> {
    const now = Date.now();
    if (this.cachedStates && now - this.cacheTimestamp < this.cacheTtlMs) {
      if (config.isDev) {
        console.log('[LiveFlightService] Using cached OpenSky snapshot', {
          ageMs: now - this.cacheTimestamp,
          aircraftCount: this.cachedStates.length,
        });
      }
      return this.cachedStates;
    }

    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }

    this.inFlightFetch = this.fetchStates();
    try {
      const states = await this.inFlightFetch;
      this.cachedStates = states;
      this.cacheTimestamp = Date.now();
      return states;
    } finally {
      this.inFlightFetch = null;
    }
  }

  private async fetchStates(): Promise<OpenSkyStateVector[]> {
    const token = await this.getAccessToken();

    if (config.isDev) {
      console.log('[LiveFlightService] Calling live position provider (OpenSky /states/all)', {
        authenticated: Boolean(token),
      });
    }

    try {
      const response = await this.client.get('/states/all', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const states: OpenSkyStateVector[] = Array.isArray(response.data?.states) ? response.data.states : [];

      if (config.isDev) {
        console.log(
          '[LiveFlightService] Provider response status:', response.status,
          '| aircraft count:', states.length,
          '| rate limit remaining:', response.headers['x-rate-limit-remaining']
        );
      }

      return states;
    } catch (err: any) {
      if (config.isDev) {
        console.log('[LiveFlightService] Provider request failed:', err.response?.status, err.message);
      }
      const error: any = new Error('Unable to retrieve live aircraft position.');
      error.statusCode = 502;
      error.code = 'LIVE_PROVIDER_ERROR';
      throw error;
    }
  }
}

export const liveFlightService = new LiveFlightService();
