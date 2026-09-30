import axios, { AxiosInstance } from 'axios';
import { config } from '../config/environment';
import { LivePosition } from '../types/flight';
import { AircraftIdentifiers, flightService } from './flightService';
import { getAirlineByCode } from './airlinesData';
import { parseCallsign, parseFlightNumber } from '../utils/flightNumber';

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
  /** Callsign the matched OpenSky state broadcasts (for identity checks). */
  matchedCallsign: string | null;
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
  // OpenSky's own on_ground flag (index 8); anything but a boolean is "not reported".
  const onGround = typeof match[8] === 'boolean' ? match[8] : null;

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
      isGround: onGround,
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
      matchedCallsign: null,
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
    diagnostics.matchedCallsign = normalizeCallsign(match[1]) || null;
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
    diagnostics.matchedCallsign = normalizeCallsign(match[1]) || null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Flight-level live tracking: OpenSky first, AirLabs only as a fallback.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ICAO-designator form of an IATA flight number from the static airline
 * table, e.g. "6E6202" -> "IGO6202" - the same form AirLabs' own
 * `flight_icao` uses. Only a candidate for exact matching; many carriers
 * broadcast alphanumeric callsigns (e.g. IGO274E) that this can't predict.
 */
export function deriveIcaoCallsign(flightIata: string): string | null {
  const parsed = parseFlightNumber(flightIata);
  if (!parsed || parsed.kind !== 'IATA') return null;
  const airline = getAirlineByCode(parsed.airline);
  return airline ? `${airline.icao}${parsed.number}${parsed.suffix}` : null;
}

/**
 * Whether a callsign can belong to a flight number: the same airline (by
 * the airline table: 6E <-> IGO) and the same flight digits, allowing an
 * alphanumeric suffix (IGO274E for 6E274). Used to decide whether a
 * client-supplied callsign may be used, and whether an OpenSky state is
 * this flight's aircraft.
 */
export function callsignFitsFlight(callsign: string | null | undefined, flightNumber: string): boolean {
  const cs = parseCallsign(callsign);
  const flight = parseFlightNumber(flightNumber);
  if (!cs || !flight) return false;
  if (cs === flight.canonical || cs === deriveIcaoCallsign(flight.canonical)) return true;
  const flightAirline = flight.kind === 'IATA' ? getAirlineByCode(flight.airline) : getAirlineByCode(null, flight.airline);
  const csAirline = getAirlineByCode(null, cs.slice(0, 3));
  if (!flightAirline || !csAirline || flightAirline.icao !== csAirline.icao) return false;
  const digits = cs.slice(3).match(/^0*(\d+)/)?.[1];
  return digits === flight.number;
}

/**
 * Area around the route (both airports plus a margin) for the callsign
 * lookup, so OpenSky returns the aircraft near this route instead of the
 * whole world. Null (global search) when an airport is unknown or the
 * route crosses the antimeridian.
 */
export function routeBoundingBox(depIata?: string, arrIata?: string): BoundingBox | null {
  // Local table or already-cached provider airports - never an API call.
  const dep = flightService.knownAirportCoords(depIata);
  const arr = flightService.knownAirportCoords(arrIata);
  if (!dep || !arr) return null;
  if (Math.abs(dep.lng - arr.lng) > 180) return null;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    lamin: round(Math.max(-90, Math.min(dep.lat, arr.lat) - 6)),
    lamax: round(Math.min(90, Math.max(dep.lat, arr.lat) + 6)),
    lomin: round(Math.max(-180, Math.min(dep.lng, arr.lng) - 8)),
    lomax: round(Math.min(180, Math.max(dep.lng, arr.lng) + 8)),
  };
}

/**
 * AirLabs' own ADS-B position from the same `/flights` record the hex came
 * from. Used only when OpenSky has no usable state for that aircraft, and
 * only if AirLabs says it is en route with a fresh, valid position.
 */
export function airLabsFallbackPosition(identifiers: AircraftIdentifiers, flightNumber: string): LiveFlightPosition | null {
  const p = identifiers.position;
  if (!p || !identifiers.icao24) return null;
  if (identifiers.status !== 'en-route') return null;
  if (!isValidCoordinate(p.latitude, p.longitude)) return null;
  if (!isFresh(p.updated)) return null;
  return {
    flightNumber,
    icao24: (normalizeIcao24(identifiers.icao24) || identifiers.icao24),
    callsign: normalizeCallsign(identifiers.callsign) || null,
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitudeMeters !== null ? Math.round(p.altitudeMeters * METERS_TO_FEET) : null,
    heading: p.heading !== null ? Math.round(p.heading) : null,
    speed: p.speedKmh !== null ? Math.round(p.speedKmh) : null,
    // AirLabs' /flights record has no on-ground flag: not reported.
    isGround: null,
    updatedAt: p.updated !== null ? new Date(p.updated * 1000).toISOString() : null,
    timestamp: p.updated,
  };
}

export type AirLabsLookup = (
  flightNumber: string,
  callsign: string | null,
  options: { maxAgeMs?: number }
) => Promise<AircraftIdentifiers>;

export interface FlightLiveRequest {
  flightNumber: string;
  callsign?: string | null;
  icao24?: string | null;
  operatingFlightNumber?: string | null;
  depIata?: string | null;
  arrIata?: string | null;
}

export interface FlightLiveResult {
  position: LiveFlightPosition | null;
  source: 'opensky' | 'airlabs' | null;
  reason: LiveReason | null;
  /** Structured facts for the [LIVE] log line. */
  log: Record<string, string | number | boolean | null | undefined>;
}

interface TrackingState {
  /** ICAO24 confirmed for this flight by OpenSky or AirLabs. */
  icao24: string | null;
  lastOpenSkySuccessAt: number;
  consecutiveOpenSkyFailures: number;
  /** AirLabs is not asked again for this flight before this time. */
  airLabsCooldownUntil: number;
  touchedAt: number;
}

// A provider error right after OpenSky was working is treated as a blip:
// the AirLabs fallback waits for a second consecutive failure.
const TRANSIENT_WINDOW_MS = 5 * 60 * 1000;
const TRANSIENT_FAILURES_TOLERATED = 1;
const STATE_TTL_MS = 12 * 60 * 60 * 1000;

const defaultAirLabsLookup: AirLabsLookup = (flightNumber, callsign, options) =>
  flightService.getAircraftIdentifiers(flightNumber, callsign, options);

/**
 * Resolves a flight's live position with OpenSky as the primary source and
 * AirLabs used only when OpenSky can't provide one:
 *
 *  1. OpenSky - by the ICAO24 already known for this flight, else by the
 *     operating flight's exact callsign within the route area. No AirLabs.
 *  2. OpenSky found it -> done; its ICAO24 is remembered so later polls use
 *     the direct ICAO24 lookup.
 *  3. OpenSky failed (no match / no state / stale / invalid / error):
 *     - a single provider error shortly after OpenSky success is a blip,
 *       and AirLabs is not called for it;
 *     - otherwise one AirLabs /flights lookup (cached for the configured
 *       max age). A newly learned hex is tried on OpenSky once; failing
 *       that, AirLabs' own fresh position for that same hex is used;
 *     - if AirLabs had nothing usable, it is not asked again for this
 *       flight until the cooldown passes.
 *  An OpenSky "on ground" answer is respected and never overridden.
 */
export class FlightLiveResolver {
  private states = new Map<string, TrackingState>();

  constructor(
    private openSky: LiveFlightService = liveFlightService,
    private airLabsLookup: AirLabsLookup = defaultAirLabsLookup
  ) {}

  private stateFor(key: string): TrackingState {
    const now = Date.now();
    let state = this.states.get(key);
    if (!state) {
      state = { icao24: null, lastOpenSkySuccessAt: 0, consecutiveOpenSkyFailures: 0, airLabsCooldownUntil: 0, touchedAt: now };
      this.states.set(key, state);
      for (const [k, v] of this.states) {
        if (now - v.touchedAt > STATE_TTL_MS) this.states.delete(k);
      }
    }
    state.touchedAt = now;
    return state;
  }

  /**
   * Identifiers from the request are hints only - a client can't make the
   * server attach an arbitrary aircraft to a flight. An OpenSky state is
   * accepted for this flight only if its broadcast callsign belongs to the
   * flight (same airline and flight digits, or AirLabs' own callsign for
   * it). A state with no callsign is accepted only for an ICAO24 the server
   * itself learned for this flight (AirLabs record or an earlier verified
   * match), never for a client-supplied one. Only verified ICAO24s are
   * remembered, so nothing a request sends can affect other users.
   */
  public async resolve(req: FlightLiveRequest): Promise<FlightLiveResult> {
    const flightNumber = req.flightNumber.toUpperCase();
    // A codeshare's aircraft only broadcasts under the operating carrier's
    // identity (QF8786 flies as 6E6202), so the marketing number and
    // callsign are never used for the lookup.
    const operating = req.operatingFlightNumber?.trim().toUpperCase() || '';
    const isCodeshare = Boolean(operating) && operating !== flightNumber;
    const lookupNumber = isCodeshare ? operating : flightNumber;
    const derivedCallsign = deriveIcaoCallsign(lookupNumber);
    // A client callsign is used only when it belongs to this flight.
    const clientCallsign = !isCodeshare && callsignFitsFlight(req.callsign, lookupNumber) ? parseCallsign(req.callsign) : null;
    const lookupCallsign = clientCallsign || derivedCallsign || null;
    const bbox = routeBoundingBox(req.depIata || undefined, req.arrIata || undefined);

    const state = this.stateFor(`${lookupNumber}|${req.depIata || ''}|${req.arrIata || ''}`);
    const hintIcao24 = normalizeIcao24(req.icao24);
    const trustedCallsigns = new Set<string>();

    const log: FlightLiveResult['log'] = {
      flight: flightNumber,
      operating: isCodeshare ? lookupNumber : undefined,
      callsign: lookupCallsign,
      callsignHint: req.callsign ? (clientCallsign ? 'accepted' : 'ignored(not this flight)') : undefined,
    };
    const done = (position: LiveFlightPosition | null, source: FlightLiveResult['source'], reason: LiveReason | null): FlightLiveResult => {
      // Positions come from caches shared across flights; label per request.
      const labelled = position ? { ...position, flightNumber } : null;
      log.source = source ?? undefined;
      log.lat = labelled?.latitude.toFixed(6);
      log.lon = labelled?.longitude.toFixed(6);
      if (labelled) log.age = `${positionAgeSeconds(labelled.timestamp)}s`;
      log.status = labelled ? 'POSITION_FOUND' : reason ?? 'NO_MATCH';
      return { position: labelled, source, reason, log };
    };
    /**
     * Is the matched OpenSky state this flight's aircraft?
     *  - client-supplied hex: its callsign must belong to this flight exactly;
     *  - hex the server learned for this flight (AirLabs record / earlier
     *    verified match): no callsign, or one of the same operator (airlines
     *    often broadcast ATC callsigns like AIC2CN for AI2486). A callsign
     *    of another airline means the hex is now flying something else.
     */
    const operatorPrefixes = () => {
      const parsed = parseFlightNumber(lookupNumber);
      const airline = parsed ? (parsed.kind === 'IATA' ? getAirlineByCode(parsed.airline) : getAirlineByCode(null, parsed.airline)) : null;
      return new Set([airline?.icao, derivedCallsign?.slice(0, 3), ...Array.from(trustedCallsigns).map((c) => c.slice(0, 3))].filter(Boolean) as string[]);
    };
    const isThisFlight = (callsign: string | null, hexIsServerKnown: boolean) => {
      if (callsign && (callsignFitsFlight(callsign, lookupNumber) || trustedCallsigns.has(callsign))) return true;
      if (!hexIsServerKnown) return false;
      return !callsign || operatorPrefixes().has(callsign.slice(0, 3));
    };
    const tried = new Set<string>();
    const byHex = async (hex: string, serverKnown: boolean, label: string) => {
      tried.add(hex);
      const r = await this.openSky.resolveLivePosition({ flightNumber, icao24: hex });
      const verified = r.diagnostics.matched && isThisFlight(r.diagnostics.matchedCallsign, serverKnown);
      log[`opensky_${label}`] = r.diagnostics.matched ? (verified ? r.reason ?? 'POSITION_FOUND' : `rejected(callsign ${r.diagnostics.matchedCallsign ?? 'none'} is not ${lookupNumber})`) : r.reason ?? 'NO_MATCH';
      return { r, verified };
    };
    const found = (r: LiveResolutionResult, icao24Source: string | null) => {
      log.icao24 = r.position!.icao24;
      log.icao24Source = icao24Source;
      state.icao24 = r.position!.icao24;
      state.lastOpenSkySuccessAt = Date.now();
      state.consecutiveOpenSkyFailures = 0;
      console.log(`[LiveFlight] OpenSky position found for ${flightNumber}`);
      console.log('[LiveFlight] Live position source: OpenSky');
      return done(r.position, 'opensky', null);
    };

    // ── 1. OpenSky (primary): server-known hex, then the hint, then callsign ──
    let openSky: LiveResolutionResult | null = null;
    for (const [hex, serverKnown, label] of [[state.icao24, true, 'remembered'], [hintIcao24, false, 'hint']] as const) {
      if (!hex || tried.has(hex)) continue;
      const { r, verified } = await byHex(hex, serverKnown, label);
      if (r.reason && PROVIDER_FAILURE_REASONS.includes(r.reason)) { openSky = r; break; }
      if (verified) {
        if (r.position) return found(r, serverKnown ? 'remembered' : 'request(verified)');
        openSky = r;
        break;
      }
      // Not this flight's aircraft (any more): never remembered or shown.
      if (serverKnown && r.diagnostics.matched) state.icao24 = null;
    }
    if (!openSky) {
      openSky = await this.openSky.resolveLivePosition({ flightNumber, callsignCandidates: [lookupCallsign, lookupNumber], bbox });
      if (openSky.position) return found(openSky, null);
    }
    const d = openSky.diagnostics;
    Object.assign(log, {
      lookup: d.method,
      lookupValue: d.value,
      area: d.method === 'CALLSIGN' ? d.area : undefined,
      openskyStatus: d.cached ? `${d.httpStatus ?? 'null'}(cached)` : d.httpStatus,
      openskyAuth: d.authenticated ? 'oauth' : config.openskyClientId ? 'token_failed' : 'anonymous',
      openskyResult: openSky.reason ?? 'NO_MATCH',
    });

    state.consecutiveOpenSkyFailures++;
    console.log(`[LiveFlight] OpenSky position unavailable for ${flightNumber} (${openSky.reason})`);

    // ── 2. Should AirLabs be asked? ────────────────────────────────────────
    const now = Date.now();
    const isBlip =
      Boolean(openSky.reason && PROVIDER_FAILURE_REASONS.includes(openSky.reason)) &&
      now - state.lastOpenSkySuccessAt < TRANSIENT_WINDOW_MS &&
      state.consecutiveOpenSkyFailures <= TRANSIENT_FAILURES_TOLERATED;
    if (isBlip) {
      log.airlabsFallback = 'deferred(transient_opensky_failure)';
      return done(null, null, openSky.reason);
    }
    if (now < state.airLabsCooldownUntil) {
      log.airlabsFallback = `cooldown(${Math.ceil((state.airLabsCooldownUntil - now) / 1000)}s)`;
      return done(null, null, openSky.reason);
    }

    // ── 3. AirLabs fallback: its record for this flight number ─────────────
    console.log('[LiveFlight] Trying AirLabs live-position fallback');
    const airLabs = await this.airLabsLookup(lookupNumber, lookupCallsign, { maxAgeMs: config.airLabsPositionMaxAgeMs });
    const airLabsHex = normalizeIcao24(airLabs.icao24);
    log.airlabsCallsign = airLabs.callsign ?? null;
    log.airlabsIcao24 = airLabsHex;

    if (!airLabsHex) {
      state.airLabsCooldownUntil = now + config.airLabsFallbackCooldownMs;
      log.airlabsFallback = 'no_record';
      console.log(`[LiveFlight] No live position available from OpenSky or AirLabs for ${flightNumber}`);
      return done(null, null, openSky.reason);
    }
    // The live record must be the same leg (a flight number can fly several).
    const routeMismatch =
      (req.depIata && airLabs.depIata && airLabs.depIata.toUpperCase() !== req.depIata.toUpperCase()) ||
      (req.arrIata && airLabs.arrIata && airLabs.arrIata.toUpperCase() !== req.arrIata.toUpperCase());
    if (routeMismatch) {
      state.airLabsCooldownUntil = now + config.airLabsFallbackCooldownMs;
      log.airlabsFallback = `route_mismatch(${airLabs.depIata}-${airLabs.arrIata})`;
      return done(null, null, openSky.reason);
    }
    const airLabsCallsign = parseCallsign(airLabs.callsign);
    if (airLabsCallsign) trustedCallsigns.add(airLabsCallsign);
    state.icao24 = airLabsHex;

    const openSkyHealthy = !openSky.reason || !PROVIDER_FAILURE_REASONS.includes(openSky.reason);
    if (!tried.has(airLabsHex) && openSkyHealthy) {
      const { r, verified } = await byHex(airLabsHex, true, 'airlabsHex');
      if (verified && r.position) return found(r, 'airlabs');
      if (r.diagnostics.matched && !verified) {
        // OpenSky sees that hex flying as another flight: AirLabs' record is outdated.
        state.icao24 = null;
        state.airLabsCooldownUntil = now + config.airLabsFallbackCooldownMs;
        log.airlabsFallback = 'rejected(hex broadcasting another callsign)';
        return done(null, null, 'NO_MATCH');
      }
    }

    const fallback = airLabsFallbackPosition(airLabs, flightNumber);
    if (fallback) {
      log.airlabsFallback = 'used';
      console.log(`[LiveFlight] AirLabs fallback position found for ${flightNumber}`);
      console.log('[LiveFlight] Live position source: AirLabs');
      return done(fallback, 'airlabs', null);
    }

    state.airLabsCooldownUntil = now + config.airLabsFallbackCooldownMs;
    log.airlabsFallback = `rejected(status:${airLabs.status ?? 'none'},age:${positionAgeSeconds(airLabs.position?.updated ?? null) ?? 'n/a'}s)`;
    return done(null, null, openSky.reason);
  }
}

export const flightLiveResolver = new FlightLiveResolver();
