import axios, { AxiosInstance } from 'axios';
import { config } from '../config/environment';
import { LivePosition } from '../types/flight';

export interface LiveFlightPosition extends LivePosition {
  flightNumber: string;
  /** ICAO24 of the aircraft that was actually matched. */
  icao24: string;
  /** Callsign the provider reports for that aircraft (normalized), if any. */
  callsign: string | null;
  /** Unix seconds of the position fix itself. */
  timestamp: number | null;
}

interface OpenSkyStateVector extends Array<any> {
  0: string; // icao24
  1: string; // callsign (padded with trailing spaces)
  2: string; // origin_country
  3: number | null; // time_position - last POSITION update
  4: number | null; // last_contact - last message of any kind
  5: number | null; // longitude
  6: number | null; // latitude
  7: number | null; // baro_altitude (meters)
  8: boolean; // on_ground
  9: number | null; // velocity (m/s)
  10: number | null; // true_track (heading, degrees)
  11: number | null; // vertical_rate
}

/**
 * Why no live position was returned. Provider failures (AUTH_ERROR,
 * RATE_LIMITED, PROVIDER_ERROR) are kept distinct from a successful query
 * that simply found nothing (NO_MATCH).
 */
export type LiveReason =
  | 'NO_IDENTIFIER'
  | 'NO_MATCH'
  | 'STALE'
  | 'ON_GROUND'
  | 'INVALID_POSITION'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR';

export const PROVIDER_FAILURE_REASONS: LiveReason[] = ['AUTH_ERROR', 'RATE_LIMITED', 'PROVIDER_ERROR'];

export type LookupMethod = 'ICAO24' | 'CALLSIGN';

export interface LiveLookupDiagnostics {
  method: LookupMethod | null;
  /** The hex, or the callsigns tried. */
  value: string | null;
  /** OpenSky HTTP status; null when served from cache or never called. */
  httpStatus: number | null;
  cached: boolean;
  matched: boolean;
  /** False when OAuth credentials exist but the token refresh failed. */
  authenticated: boolean;
  positionTime: number | null;
  ageSeconds: number | null;
  /** Area searched by the callsign lookup, if bounded. */
  area: string | null;
}

export interface LiveResolutionResult {
  position: LiveFlightPosition | null;
  reason: LiveReason | null;
  diagnostics: LiveLookupDiagnostics;
}

export interface BoundingBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

/**
 * Rejects missing/NaN/out-of-range coordinates and the (0,0) "null island"
 * sentinel some providers use for an unknown position.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
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

export function normalizeIcao24(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  return ICAO24_PATTERN.test(cleaned) ? cleaned : null;
}

// "IGO6372 ", "igo6372" and "IGO-6372" all normalize to "IGO6372". Exact
// comparison only - never prefix matching.
export function normalizeCallsign(raw?: string | null): string {
  return (raw || '').replace(/[\s-]+/g, '').toUpperCase();
}

const METERS_TO_FEET = 3.28084;
const MPS_TO_KMH = 3.6;

export function positionAgeSeconds(positionTime: number | null): number | null {
  return typeof positionTime === 'number' ? Math.max(0, Math.round(Date.now() / 1000 - positionTime)) : null;
}

/** Position fix no older than LIVE_POSITION_MAX_AGE_SECONDS. */
export function isFresh(positionTime: number | null): boolean {
  const age = positionAgeSeconds(positionTime);
  return age !== null && age <= config.livePositionMaxAgeSeconds;
}

/**
 * Turns one matched state vector into a position, or the precise reason
 * it can't be shown. Freshness is judged on `time_position` (the last
 * position fix), not `last_contact`, which any message refreshes.
 */
function evaluateState(
  match: OpenSkyStateVector,
  flightNumber: string
): { position: LiveFlightPosition | null; reason: LiveReason | null; positionTime: number | null } {
  const positionTime = typeof match[3] === 'number' ? match[3] : typeof match[4] === 'number' ? match[4] : null;
  const latitude = match[6];
  const longitude = match[5];

  if (!isValidCoordinate(latitude, longitude)) return { position: null, reason: 'INVALID_POSITION', positionTime };
  if (!isFresh(positionTime)) return { position: null, reason: 'STALE', positionTime };
  if (match[8] === true) return { position: null, reason: 'ON_GROUND', positionTime };

  const baroAltitudeM = match[7];
  const velocityMps = match[9];
  const trueTrack = match[10];

  return {
    reason: null,
    positionTime,
    position: {
      flightNumber,
      icao24: (match[0] || '').trim().toLowerCase(),
      callsign: normalizeCallsign(match[1]) || null,
      latitude: latitude as number,
      longitude: longitude as number,
      altitude: typeof baroAltitudeM === 'number' ? Math.round(baroAltitudeM * METERS_TO_FEET) : null,
      heading: typeof trueTrack === 'number' ? Math.round(trueTrack) : null,
      speed: typeof velocityMps === 'number' ? Math.round(velocityMps * MPS_TO_KMH) : null,
      isGround: false,
      updatedAt: positionTime !== null ? new Date(positionTime * 1000).toISOString() : null,
      timestamp: positionTime,
    },
  };
}

class OpenSkyRequestError extends Error {
  constructor(public reason: LiveReason, public httpStatus: number | null, message: string) {
    super(message);
  }
}

export interface ResolveLivePositionParams {
  /** Flight number the position is reported under (operating flight). */
  flightNumber: string;
  icao24?: string | null;
  /** Exact callsigns to try when no ICAO24 is known, in priority order. */
  callsignCandidates?: Array<string | null | undefined>;
  /** Limits the callsign lookup to the area around the route. */
  bbox?: BoundingBox | null;
}

/**
 * Live aircraft position from OpenSky Network, used only for real-time
 * lat/lon/heading/altitude/speed. AirLabs remains the source for flight
 * search, schedule, status, terminal and gate.
 *
 * Matching priority:
 *  1. ICAO24/hex - a filtered one-aircraft request, authoritative. A valid
 *     hex OpenSky doesn't see is NO_MATCH, never a trigger to guess by
 *     callsign (that could be a different aircraft).
 *  2. Without a hex: exact callsign match, within the route's bounding box
 *     when known (a small download) instead of the whole world.
 * Every match is checked for valid coordinates, freshness and on-ground.
 * Provider failures come back as AUTH_ERROR / RATE_LIMITED / PROVIDER_ERROR,
 * never thrown and never reported as "no match".
 */
export class LiveFlightService {
  private client: AxiosInstance;

  // Area/global snapshots for the callsign path, keyed by bounding box.
  private areaCache = new Map<string, { timestamp: number; states: OpenSkyStateVector[]; httpStatus: number }>();
  private areaInFlight = new Map<string, Promise<{ states: OpenSkyStateVector[]; httpStatus: number }>>();

  // Per-ICAO24 results (matches and no-matches; provider errors aren't cached).
  private icao24Cache = new Map<string, { timestamp: number; result: LiveResolutionResult }>();
  private icao24InFlight = new Map<string, Promise<LiveResolutionResult>>();

  private readonly icao24CacheTtlMs = 30_000;
  private readonly areaCacheTtlMs = 60_000;

  // After a 429, OpenSky isn't called again until this time.
  private rateLimitedUntil = 0;

  private authClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private inFlightTokenFetch: Promise<string | null> | null = null;
  private lastTokenFailed = false;

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

      this.lastTokenFailed = !token;
      if (!token) return null;

      this.accessToken = token;
      this.tokenExpiresAt = Date.now() + Math.max(expiresInSec - 60, 30) * 1000;
      return token;
    } catch (err: any) {
      // Requests continue anonymously (lower quota); the failure is
      // reported in every [LIVE] log line as auth=token_failed.
      this.lastTokenFailed = true;
      console.log('[LiveFlightService] OpenSky OAuth2 token refresh failed:', err.response?.status ?? 'no response', err.code || '');
      return null;
    }
  }

  /**
   * One OpenSky /states/all request, with failures classified. Never
   * retries on its own.
   */
  private async requestStates(params: Record<string, string | number>): Promise<{ states: OpenSkyStateVector[]; httpStatus: number }> {
    if (Date.now() < this.rateLimitedUntil) {
      throw new OpenSkyRequestError('RATE_LIMITED', 429, 'OpenSky rate limit back-off in effect');
    }

    const token = await this.getAccessToken();
    try {
      const response = await this.client.get('/states/all', {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const states: OpenSkyStateVector[] = Array.isArray(response.data?.states) ? response.data.states : [];
      return { states, httpStatus: response.status };
    } catch (err: any) {
      const status: number | null = err.response?.status ?? null;
      if (status === 401 || status === 403) {
        // Force a fresh token next time in case this one was revoked.
        this.accessToken = null;
        throw new OpenSkyRequestError('AUTH_ERROR', status, 'OpenSky rejected the credentials');
      }
      if (status === 429) {
        const headers = err.response?.headers || {};
        const retryAfter = Number(headers['x-rate-limit-retry-after-seconds'] ?? headers['retry-after']);
        const backoffSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3600) : 60;
        this.rateLimitedUntil = Date.now() + backoffSeconds * 1000;
        throw new OpenSkyRequestError('RATE_LIMITED', status, `OpenSky rate limited, backing off ${backoffSeconds}s`);
      }
      throw new OpenSkyRequestError('PROVIDER_ERROR', status, err.code === 'ECONNABORTED' ? 'OpenSky timeout' : err.message);
    }
  }

  private baseDiagnostics(method: LookupMethod | null, value: string | null): LiveLookupDiagnostics {
    return {
      method,
      value,
      httpStatus: null,
      cached: false,
      matched: false,
      authenticated: this.hasOAuthCredentials && !this.lastTokenFailed,
      positionTime: null,
      ageSeconds: null,
      area: null,
    };
  }

  /**
   * Single entry point for resolving a flight's live position.
   */
  public async resolveLivePosition(params: ResolveLivePositionParams): Promise<LiveResolutionResult> {
    const icao24 = normalizeIcao24(params.icao24);
    if (icao24) return this.getByIcao24(icao24, params.flightNumber);

    const candidates = Array.from(
      new Set((params.callsignCandidates || []).map((c) => normalizeCallsign(c)).filter((c) => c.length > 0))
    );
    if (candidates.length === 0) {
      return { position: null, reason: 'NO_IDENTIFIER', diagnostics: this.baseDiagnostics(null, null) };
    }
    return this.getByCallsign(candidates, params.flightNumber, params.bbox ?? null);
  }

  private async getByIcao24(icao24: string, flightNumber: string): Promise<LiveResolutionResult> {
    const cached = this.icao24Cache.get(icao24);
    if (cached && Date.now() - cached.timestamp < this.icao24CacheTtlMs) {
      // Re-check freshness: a cached fix can age out while cached.
      const { result } = cached;
      if (result.position && !isFresh(result.position.timestamp)) {
        return { position: null, reason: 'STALE', diagnostics: { ...result.diagnostics, cached: true, ageSeconds: positionAgeSeconds(result.position.timestamp) } };
      }
      return { ...result, diagnostics: { ...result.diagnostics, cached: true, ageSeconds: positionAgeSeconds(result.diagnostics.positionTime) } };
    }

    const inFlight = this.icao24InFlight.get(icao24);
    if (inFlight) return inFlight;

    const promise = this.fetchByIcao24(icao24, flightNumber)
      .then((result) => {
        if (!result.reason || !PROVIDER_FAILURE_REASONS.includes(result.reason)) {
          this.icao24Cache.set(icao24, { timestamp: Date.now(), result });
        }
        return result;
      })
      .finally(() => this.icao24InFlight.delete(icao24));

    this.icao24InFlight.set(icao24, promise);
    return promise;
  }

  private async fetchByIcao24(icao24: string, flightNumber: string): Promise<LiveResolutionResult> {
    const diagnostics = this.baseDiagnostics('ICAO24', icao24);
    let states: OpenSkyStateVector[];
    try {
      const response = await this.requestStates({ icao24 });
      states = response.states;
      diagnostics.httpStatus = response.httpStatus;
    } catch (err) {
      const e = err as OpenSkyRequestError;
      diagnostics.httpStatus = e.httpStatus;
      return { position: null, reason: e.reason || 'PROVIDER_ERROR', diagnostics };
    } finally {
      diagnostics.authenticated = this.hasOAuthCredentials && !this.lastTokenFailed;
    }

    const match = states.find((s) => (s[0] || '').trim().toLowerCase() === icao24) || null;
    if (!match) return { position: null, reason: 'NO_MATCH', diagnostics };

    const evaluated = evaluateState(match, flightNumber);
    diagnostics.matched = true;
    diagnostics.positionTime = evaluated.positionTime;
    diagnostics.ageSeconds = positionAgeSeconds(evaluated.positionTime);
    return { position: evaluated.position, reason: evaluated.reason, diagnostics };
  }

  /**
   * Fallback without a hex: exact callsign match (after normalization),
   * never prefix or airline-only matching.
   */
  private async getByCallsign(candidates: string[], flightNumber: string, bbox: BoundingBox | null): Promise<LiveResolutionResult> {
    const diagnostics = this.baseDiagnostics('CALLSIGN', candidates.join(','));
    diagnostics.area = bbox ? `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}` : 'global';

    let states: OpenSkyStateVector[];
    try {
      const snapshot = await this.getStatesInArea(bbox, diagnostics);
      states = snapshot.states;
    } catch (err) {
      const e = err as OpenSkyRequestError;
      diagnostics.httpStatus = e.httpStatus;
      return { position: null, reason: e.reason || 'PROVIDER_ERROR', diagnostics };
    } finally {
      diagnostics.authenticated = this.hasOAuthCredentials && !this.lastTokenFailed;
    }

    // Candidates are in priority order; a state must carry a real ICAO24 to
    // be verifiable as one specific aircraft.
    let match: OpenSkyStateVector | undefined;
    for (const candidate of candidates) {
      match = states.find((s) => normalizeCallsign(s[1]) === candidate && Boolean(normalizeIcao24(s[0])));
      if (match) break;
    }
    if (!match) return { position: null, reason: 'NO_MATCH', diagnostics };

    const evaluated = evaluateState(match, flightNumber);
    diagnostics.matched = true;
    diagnostics.positionTime = evaluated.positionTime;
    diagnostics.ageSeconds = positionAgeSeconds(evaluated.positionTime);
    return { position: evaluated.position, reason: evaluated.reason, diagnostics };
  }

  private async getStatesInArea(
    bbox: BoundingBox | null,
    diagnostics: LiveLookupDiagnostics
  ): Promise<{ states: OpenSkyStateVector[]; httpStatus: number }> {
    const key = bbox ? `${bbox.lamin}|${bbox.lomin}|${bbox.lamax}|${bbox.lomax}` : 'global';
    const cached = this.areaCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.areaCacheTtlMs) {
      diagnostics.cached = true;
      diagnostics.httpStatus = cached.httpStatus;
      return cached;
    }

    let inFlight = this.areaInFlight.get(key);
    if (!inFlight) {
      inFlight = this.requestStates(bbox ? { ...bbox } : {})
        .then((snapshot) => {
          this.areaCache.set(key, { ...snapshot, timestamp: Date.now() });
          // Keep the cache small: drop expired areas.
          for (const [k, v] of this.areaCache) {
            if (Date.now() - v.timestamp >= this.areaCacheTtlMs) this.areaCache.delete(k);
          }
          return snapshot;
        })
        .finally(() => this.areaInFlight.delete(key));
      this.areaInFlight.set(key, inFlight);
    }
    const snapshot = await inFlight;
    diagnostics.httpStatus = snapshot.httpStatus;
    return snapshot;
  }
}

export const liveFlightService = new LiveFlightService();
