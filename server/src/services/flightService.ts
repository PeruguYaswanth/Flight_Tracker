import axios, { AxiosInstance } from 'axios';
import { config } from '../config/environment';
import { Flight, FlightSearchQuery, SearchAirport } from '../types/flight';
import { FlightNormalizer } from './flightNormalizer';
import { getMockFlights } from './mockFlightData';
import { resolveAirlineIataFromSearchTerm } from './airlinesData';
import { AIRPORT_COORDINATES, getAirportCoords } from './airportsData';
import { weekdayOf } from '../utils/dateTime';
import { airportTimeZone } from './airportTimezones';

const STRONG_AIRPORT_MATCH = 400;

/**
 * How well text matches a reference airport (0 = no match). Exact code >
 * exact city > exact name > city prefix > whole name word > country.
 */
function airportMatchScore(q: string, a: { iata?: string | null; icao?: string | null; name?: string | null; city?: string | null; country?: string | null }): number {
  const text = q.trim().toLowerCase();
  if (!text) return 0;
  const city = (a.city || '').toLowerCase();
  const name = (a.name || '').toLowerCase();
  if ((a.iata || '').toLowerCase() === text) return 1000;
  if ((a.icao || '').toLowerCase() === text) return 950;
  if (city === text) return 800;
  if (name === text) return 750;
  if (text.length >= 3 && city.startsWith(text)) return 400;
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (text.length >= 3 && words.some((w) => w === text)) return 300;
  if ((a.country || '').toLowerCase() === text) return 80;
  return 0;
}

/** AirLabs /routes filter: a route, a flight number, or an airline. */
export type TimetableFilter = { dep_iata?: string; arr_iata?: string; flight_iata?: string; flight_icao?: string; airline_iata?: string };

/**
 * One provider response's page facts: records returned, the provider's own
 * total (request.total_items) and has_more. This AirLabs plan has no usable
 * paging (`offset` returns no records, `limit` is ignored), so a capped
 * search is reported as partial - never padded or re-requested.
 */
export interface ProviderPage {
  returned: number;
  total: number | null;
  hasMore: boolean;
}

function pageFacts(body: any, returned: number): ProviderPage {
  const total = Number(body?.request?.total_items);
  return { returned, total: Number.isFinite(total) ? total : null, hasMore: Boolean(body?.request?.has_more) };
}

interface CacheEntry {
  timestamp: number;
  flights: Flight[];
}

// Requested cache window is 5-15 minutes for identical searches; 10 is the
// midpoint and keeps AirLabs usage low without serving badly stale results.
const CACHE_TTL_MS = 10 * 60 * 1000;

// A "no ICAO24 found yet" result is cached far more briefly than a real
// hex - the underlying reason (aircraft hasn't started broadcasting,
// codeshare not yet resolved, etc.) can change within minutes.
const HEX_NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000;

// Airline timetables change rarely; one /routes call per route per 12 h.
const TIMETABLE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// User-facing text for any provider-side failure. The specific cause
// (auth, timeout, outage) stays in the error code and server logs - no
// provider internals or credential hints reach the client.
const PROVIDER_UNAVAILABLE_MESSAGE = 'Flight data is temporarily unavailable. Please try again.';

/**
 * Position AirLabs reports for the aircraft in the same `/flights` record
 * the hex comes from (ADS-B based). Raw provider units.
 */
export interface AirLabsPosition {
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  speedKmh: number | null;
  heading: number | null;
  /** Unix seconds of AirLabs' last update for this aircraft. */
  updated: number | null;
}

export interface AircraftIdentifiers {
  icao24: string | null;
  registration: string | null;
  /** Callsign AirLabs reports for the live record (may be alphanumeric, e.g. IGO274E). */
  callsign: string | null;
  status: string | null;
  position: AirLabsPosition | null;
  /** Route of the live record, for checking it is the same flight leg. */
  depIata?: string | null;
  arrIata?: string | null;
}

const EMPTY_IDENTIFIERS: AircraftIdentifiers = { icao24: null, registration: null, callsign: null, status: null, position: null };

function toNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * AirLabs integration for flight search/details. OpenSky (liveFlightService)
 * remains the exclusive source for live aircraft position - this service
 * never touches OpenSky and never fabricates a position.
 */
/**
 * Why an AirLabs airport request failed. Kept distinct so the UI can say
 * what actually happened instead of one generic "unavailable".
 */
export type AirportFailureKind =
  | 'INVALID_QUERY'        // 400 / wrong_params: the request itself was rejected
  | 'PROVIDER_AUTH_ERROR'  // 401 / unknown or expired API key
  | 'PROVIDER_FORBIDDEN'   // 403 / plan or permission restriction
  | 'RATE_LIMITED'         // 429 / minute, hour or month limit
  | 'PROVIDER_ERROR'       // 5xx or an unrecognised provider error
  | 'SERVICE_UNAVAILABLE'; // network failure or timeout

export interface AirportProviderFailure {
  kind: AirportFailureKind;
  endpoint: string;
  httpStatus: number | null;
  code: string | null;
  message: string | null;
}

// Most specific first when several requests failed.
const FAILURE_PRIORITY: AirportFailureKind[] = [
  'PROVIDER_AUTH_ERROR', 'PROVIDER_FORBIDDEN', 'RATE_LIMITED', 'INVALID_QUERY', 'PROVIDER_ERROR', 'SERVICE_UNAVAILABLE',
];

export function mostSevereFailure(failures: AirportProviderFailure[]): AirportProviderFailure | null {
  for (const kind of FAILURE_PRIORITY) {
    const hit = failures.find((f) => f.kind === kind);
    if (hit) return hit;
  }
  return null;
}

/** AirLabs error `code`/`message` (sent in the body, often with HTTP 200) -> kind; 'NOT_FOUND' = no such record. */
function classifyAirLabsError(httpStatus: number | null, code: string | null, message: string | null): AirportFailureKind | 'NOT_FOUND' {
  const text = `${code || ''} ${message || ''}`.toLowerCase();
  if (/not_found|not found/.test(text) || httpStatus === 404) return 'NOT_FOUND';
  if (/limit/.test(text) || httpStatus === 429) return 'RATE_LIMITED';
  if (/api_key|api key|unauthori[sz]ed|expired/.test(text) || httpStatus === 401) return 'PROVIDER_AUTH_ERROR';
  if (/forbidden|permission|access|plan|not allowed/.test(text) || httpStatus === 403) return 'PROVIDER_FORBIDDEN';
  if (/param|wrong|invalid|missing|required|too short/.test(text) || httpStatus === 400) return 'INVALID_QUERY';
  return 'PROVIDER_ERROR';
}

// AirLabs /suggest answers shorter terms with "Search term is too short".
export const SUGGEST_MIN_CHARS = 3;

function maskParams(params: Record<string, unknown>): Record<string, unknown> {
  const { api_key, ...rest } = params;
  return { ...rest, api_key: api_key ? '***' : '(missing)' };
}

export class FlightService {
  private client: AxiosInstance;
  private cache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<Flight[]>>();
  private hexCache = new Map<string, { timestamp: number; value: AircraftIdentifiers }>();
  private hexInFlightRequests = new Map<string, Promise<AircraftIdentifiers>>();
  // Airport existence never changes; answers (including "no such airport")
  // are kept for the process lifetime.
  private airportCache = new Map<string, SearchAirport | null>();
  private cityNameCache = new Map<string, string | null>();
  // Codes whose cached record came from a full /airports lookup (exact coordinates).
  private preciseAirportCodes = new Set<string>();
  private timetableCache = new Map<string, { timestamp: number; records: any[] }>();
  private timetableInFlight = new Map<string, Promise<any[]>>();
  // Provider page facts per search (AirLabs returns one page: /schedules at
  // most 100 records, /routes 50; `offset` yields nothing on this plan).
  private providerPages = new Map<string, ProviderPage>();
  private suggestCache = new Map<string, { timestamp: number; airports: SearchAirport[]; cityAirportCodes: string[]; countryCodes: string[] }>();
  private countryAirportsCache = new Map<string, { timestamp: number; airports: SearchAirport[] }>();

  constructor() {
    this.client = axios.create({
      baseURL: config.airLabsApiBaseUrl,
      timeout: config.requestTimeoutMs,
      headers: { Accept: 'application/json' },
    });
  }

  /**
   * Search flights by flight number, airline, or departure/arrival route.
   * Cached per distinct query (~10 min) and deduplicated so identical
   * concurrent requests (e.g. a user clicking Search repeatedly) share one
   * upstream AirLabs call instead of issuing several.
   */
  public async searchFlights(query: FlightSearchQuery): Promise<Flight[]> {
    if (!config.airLabsApiKey || config.airLabsApiKey.trim() === '') {
      return this.filterMockFlights(query);
    }

    const cacheKey = this.buildCacheKey(query);

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      if (config.isDev) {
        console.log('[AirLabs] Cache hit', { cacheKey, ageMs: Date.now() - cached.timestamp });
      }
      return cached.flights;
    }

    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      if (config.isDev) {
        console.log('[AirLabs] Duplicate request prevented - reusing in-flight request', { cacheKey });
      }
      return inFlight;
    }

    const requestPromise = this.performSearch(query)
      .then((flights) => {
        this.cache.set(cacheKey, { timestamp: Date.now(), flights });
        return flights;
      })
      .finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });

    this.inFlightRequests.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } catch (err: any) {
      this.handleAxiosError(err);
    }
  }

  private buildCacheKey(query: FlightSearchQuery): string {
    return [
      query.flightNumber?.trim().toUpperCase() || '',
      query.airline?.trim().toLowerCase() || '',
      query.depIata?.trim().toUpperCase() || '',
      query.arrIata?.trim().toUpperCase() || '',
      query.flightDate?.trim() || '',
    ].join('|');
  }

  /**
   * Executes exactly one AirLabs /schedules request for the given query
   * and normalizes the response. AirLabs' schedule endpoint doesn't
   * reliably support arbitrary historical/future date filtering on this
   * plan, so `flightDate` is not sent as a filter - `currentFlightFilter`
   * (applied in the controller) already ensures only genuinely current
   * flights are shown, honestly, rather than pretending date filtering
   * works when it doesn't.
   */
  private async performSearch(query: FlightSearchQuery): Promise<Flight[]> {
    const { flightNumber, airline, depIata, arrIata } = query;

    const params: Record<string, any> = { api_key: config.airLabsApiKey };

    if (flightNumber) {
      const clean = flightNumber.trim().toUpperCase();
      // Use the format the input actually looks like rather than guessing:
      // IATA-style is a 2-letter airline code + digits; anything else is
      // tried as an ICAO-style callsign (3-letter code + digits).
      // IATA airline codes may contain a digit (IndiGo "6E", "G8", "I5"),
      // so "6E840" is IATA; "UAE527" (3 letters) stays ICAO.
      if (/^([A-Z]{2}|[A-Z]\d|\d[A-Z])\d{1,4}[A-Z]?$/.test(clean)) {
        params.flight_iata = clean;
      } else {
        params.flight_icao = clean;
      }
    }
    if (depIata) params.dep_iata = depIata.trim().toUpperCase();
    if (arrIata) params.arr_iata = arrIata.trim().toUpperCase();
    if (airline && !flightNumber && !depIata && !arrIata) {
      const code = resolveAirlineIataFromSearchTerm(airline);
      if (code) params.airline_iata = code;
    }

    const hasFilter = Boolean(
      params.flight_iata || params.flight_icao || params.dep_iata || params.arr_iata || params.airline_iata
    );

    if (!hasFilter) {
      // Nothing resolvable to send AirLabs (e.g. an airline name we don't
      // recognize with no other criteria) - skip the call rather than
      // spend a request on something that can't be filtered.
      if (config.isDev) {
        console.log('[AirLabs] No resolvable filter for this query - skipping API call', query);
      }
      return [];
    }

    if (config.isDev) {
      console.log('[AirLabs] API request', {
        endpoint: '/schedules',
        flight_iata: params.flight_iata,
        flight_icao: params.flight_icao,
        dep_iata: params.dep_iata,
        arr_iata: params.arr_iata,
        airline_iata: params.airline_iata,
      });
    }

    const response = await this.client.get('/schedules', { params });

    if (config.isDev) {
      console.log('[AirLabs] Provider response status:', response.status);
    }

    // AirLabs reports API-level failures as { error: { message, code } } in
    // the response body, which can arrive alongside a 200 status.
    if (response.data && response.data.error) {
      this.handleProviderApiError(response.data.error);
    }

    const rawItems: any[] = Array.isArray(response.data?.response) ? response.data.response : [];

    // This AirLabs plan returns at most 100 records and does not page
    // further; busy codeshare-heavy routes can exceed that.
    this.providerPages.set(`schedules:${this.buildCacheKey(query)}`, pageFacts(response.data, rawItems.length));
    if (config.isDev && response.data?.request?.has_more) {
      console.log('[AirLabs] Result truncated by provider', {
        returned: rawItems.length,
        totalItems: response.data.request.total_items ?? null,
      });
    }
    const flights: Flight[] = rawItems.map((item) => FlightNormalizer.normalizeAirLabs(item));
    await this.enrichAirports(flights);

    if (config.isDev) {
      console.log('[AirLabs] Provider result count:', flights.length);
    }

    return flights;
  }

  /**
   * Get specific flight details by flight number. Reuses searchFlights
   * (and therefore its cache) - never issues a second AirLabs request just
   * to re-fetch information the search already returned.
   */
  public async getFlightByNumber(
    flightNumber: string,
    date?: string,
    depIata?: string,
    arrIata?: string
  ): Promise<Flight | null> {
    const results = await this.searchFlights({ flightNumber, flightDate: date });
    // AirLabs can return several instances of one flight number (other
    // days, multi-leg). When the caller knows which instance it is showing,
    // return exactly that one instead of whatever happens to be first.
    const dep = depIata?.trim().toUpperCase();
    const arr = arrIata?.trim().toUpperCase();
    const matches = results.filter(
      (f) =>
        (!dep || f.departure.iata.toUpperCase() === dep) &&
        (!arr || f.arrival.iata.toUpperCase() === arr)
    );
    // A requested date is honoured exactly: another day's instance is never
    // substituted. Without a date, the first matching instance is returned.
    if (date) return matches.find((f) => f.flightDate === date) || null;
    return matches[0] || null;
  }

  /**
   * Search flights by route (departure and arrival airports)
   */
  // ── Airports ──────────────────────────────────────────────────────────────

  /**
   * Every airport-related AirLabs request goes through here: logs the
   * request (key masked) and the raw outcome, and classifies failures
   * instead of collapsing them into one "unavailable".
   */
  private async airLabsAirportGet(
    endpoint: '/airports' | '/suggest' | '/cities',
    query: Record<string, string>
  ): Promise<{ ok: true; body: any } | { ok: false; notFound: boolean; failure: AirportProviderFailure | null }> {
    const params = { api_key: config.airLabsApiKey, ...query };
    const debug = (label: string, value: unknown) => {
      if (config.isDev) console.log(`[AirportDebug] ${label}`, value);
    };
    debug('query:', JSON.stringify(query));
    debug('endpoint:', `${config.airLabsApiBaseUrl}${endpoint} ${JSON.stringify(maskParams(params))}`);
    if (!config.airLabsApiKey) {
      const failure: AirportProviderFailure = { kind: 'PROVIDER_AUTH_ERROR', endpoint, httpStatus: null, code: 'missing_api_key', message: 'AIRLABS_API_KEY is not set' };
      debug('AirLabs code:', failure.code);
      return { ok: false, notFound: false, failure };
    }
    try {
      const response = await this.client.get(endpoint, { params });
      const error = response.data?.error;
      debug('HTTP status:', response.status);
      debug('AirLabs response:', JSON.stringify(response.data?.response ?? null)?.slice(0, 300));
      if (!error) return { ok: true, body: response.data };
      // AirLabs reports errors either as { code, message } or as a plain
      // string (e.g. /suggest: "Search term is too short").
      const code = typeof error === 'object' && error.code != null ? String(error.code) : null;
      const message = typeof error === 'string' ? error : error.message != null ? String(error.message) : null;
      debug('AirLabs code:', code);
      debug('AirLabs message:', message);
      const kind = classifyAirLabsError(response.status, code, message);
      if (kind === 'NOT_FOUND') return { ok: false, notFound: true, failure: null };
      return { ok: false, notFound: false, failure: { kind, endpoint, httpStatus: response.status, code, message } };
    } catch (err: any) {
      const status: number | null = err.response?.status ?? null;
      const error = err.response?.data?.error;
      const code = error && typeof error === 'object' && error.code != null ? String(error.code) : err.code || null;
      const message = typeof error === 'string' ? error : error?.message != null ? String(error.message) : err.message || null;
      debug('HTTP status:', status ?? '(no response)');
      debug('AirLabs code:', code);
      debug('AirLabs message:', message);
      if (status === null) {
        // No HTTP response at all: timeout or connection failure.
        return { ok: false, notFound: false, failure: { kind: 'SERVICE_UNAVAILABLE', endpoint, httpStatus: null, code, message } };
      }
      const kind = status >= 500 ? 'PROVIDER_ERROR' : classifyAirLabsError(status, code, message);
      if (kind === 'NOT_FOUND') return { ok: false, notFound: true, failure: null };
      return { ok: false, notFound: false, failure: { kind, endpoint, httpStatus: status, code, message } };
    }
  }

  private resolverLog(event: string, detail: string): void {
    if (config.isDev) console.log(`[AirportResolver] ${event}: ${detail}`);
  }
  //
  // Resolution order for any airport: local reference table -> this
  // process's cache of provider airports -> AirLabs. The local table is a
  // fast first layer, never the complete list: any airport AirLabs knows can
  // be found, and every provider airport seen is cached under both its IATA
  // and ICAO code (a code the provider says doesn't exist is cached as null).

  /**
   * Caches a provider airport under its IATA and ICAO code. `precise` marks
   * a full /airports record; /suggest records have coordinates rounded to
   * 2 decimals and must never replace a precise one - they only fill in
   * fields it lacks (e.g. city).
   */
  private cacheAirport(airport: SearchAirport, precise = true): void {
    const key = airport.iata || airport.icao;
    const existing = key ? this.airportCache.get(key) : undefined;
    let stored: SearchAirport = { ...airport, source: 'airlabs' };
    if (existing && !precise) {
      stored = { ...existing, city: existing.city || airport.city, icao: existing.icao || airport.icao, iata: existing.iata || airport.iata };
    } else if (existing && precise) {
      stored = { ...stored, city: stored.city || existing.city };
    }
    if (stored.iata) this.airportCache.set(stored.iata, stored);
    if (stored.icao) this.airportCache.set(stored.icao, stored);
    if (precise) [stored.iata, stored.icao].forEach((c) => c && this.preciseAirportCodes.add(c));
  }

  private fromCache(code: string): SearchAirport | null | undefined {
    if (!this.airportCache.has(code)) return undefined;
    const hit = this.airportCache.get(code) ?? null;
    return hit ? { ...hit, source: 'cache' } : null;
  }

  /**
   * Coordinates for an airport from the local table or the provider cache,
   * without any API call (for callers that must stay cheap, e.g. live tracking).
   */
  public knownAirportCoords(code?: string | null): { lat: number; lng: number } | null {
    if (!code) return null;
    const key = code.trim().toUpperCase();
    const local = getAirportCoords(key);
    if (local) return { lat: local.lat, lng: local.lng };
    const cached = this.airportCache.get(key);
    return cached && typeof cached.lat === 'number' && typeof cached.lng === 'number' ? { lat: cached.lat, lng: cached.lng } : null;
  }

  /** Provider airports discovered so far (searches, lookups, flight results). */
  public discoveredAirports(): SearchAirport[] {
    const unique = new Map<string, SearchAirport>();
    for (const a of this.airportCache.values()) {
      if (a && !(a.iata && getAirportCoords(a.iata))) unique.set(a.iata || a.icao || '', { ...a, source: 'cache' });
    }
    return Array.from(unique.values());
  }

  /**
   * The airport behind an IATA code: local table, then cache, then AirLabs.
   *  - SearchAirport: a real airport
   *  - null: the provider says no airport has this code
   *  - undefined: couldn't verify (remote disabled, no API key, provider
   *    failure) - never reported to the user as "invalid"
   * `withCity` also looks up the city name (one extra, cached, call);
   * `complete` fills fields the local table lacks (ICAO) from the provider.
   */
  public async lookupAirport(
    iata: string,
    options: { remote?: boolean; withCity?: boolean; complete?: boolean; failures?: AirportProviderFailure[] } = {}
  ): Promise<SearchAirport | null | undefined> {
    const code = iata.trim().toUpperCase();
    const local = getAirportCoords(code);
    if (local) {
      this.resolverLog('local hit', code);
      const airport: SearchAirport = this.localAirport(local);
      if (options.complete && !airport.icao && options.remote !== false) {
        const provider = await this.fetchAirport('iata_code', code, options.failures);
        if (provider) airport.icao = provider.icao;
      }
      return airport;
    }

    let airport = this.fromCache(code);
    this.resolverLog(airport === undefined ? 'cache miss' : 'cache hit', `${code}${airport === null ? ' (known not to exist)' : ''}`);
    if (airport === undefined || (airport && !this.preciseAirportCodes.has(code) && options.remote !== false)) {
      if (options.remote === false) return undefined;
      const fetched = await this.fetchAirport('iata_code', code, options.failures);
      if (fetched === undefined && airport === undefined) return undefined;
      airport = fetched === undefined ? airport : fetched;
    }
    if (airport && options.withCity && !airport.city && airport.iata) {
      const city = await this.lookupCityName(airport.iata);
      if (city) {
        airport = { ...airport, city };
        this.cacheAirport(airport);
      }
    }
    return airport;
  }

  /** The airport behind an ICAO code (e.g. LPOT, VOHS): cache, then AirLabs. */
  public async lookupAirportByIcao(
    icao: string,
    options: { withCity?: boolean; failures?: AirportProviderFailure[] } = {}
  ): Promise<SearchAirport | null | undefined> {
    const code = icao.trim().toUpperCase();
    const local = Object.values(AIRPORT_COORDINATES).find((a) => a.icao === code);
    if (local) return this.lookupAirport(local.iata, { remote: false });
    let airport = this.fromCache(code);
    this.resolverLog(airport === undefined ? 'cache miss' : 'cache hit', `${code}${airport === null ? ' (known not to exist)' : ''}`);
    if (airport === undefined || (airport && !this.preciseAirportCodes.has(code))) {
      const fetched = await this.fetchAirport('icao_code', code, options.failures);
      if (fetched === undefined && airport === undefined) return undefined;
      airport = fetched === undefined ? airport : fetched;
    }
    if (!airport) return null;
    // Prefer the curated local record when the airport has an IATA code in it.
    if (airport.iata && getAirportCoords(airport.iata)) {
      const local = await this.lookupAirport(airport.iata, { remote: false });
      if (local) return { ...local, icao: airport.icao };
    }
    if (options.withCity && !airport.city && airport.iata) {
      const city = await this.lookupCityName(airport.iata);
      if (city) {
        airport = { ...airport, city };
        this.cacheAirport(airport);
      }
    }
    return airport;
  }

  /** One AirLabs /airports lookup by IATA or ICAO code, cached (including "not found"). */
  private async fetchAirport(
    param: 'iata_code' | 'icao_code',
    code: string,
    failures?: AirportProviderFailure[]
  ): Promise<SearchAirport | null | undefined> {
    this.resolverLog('calling AirLabs', `/airports ${param}=${code}`);
    const result = await this.airLabsAirportGet('/airports', { [param]: code });
    if (!result.ok && result.notFound) {
      this.resolverLog('AirLabs success', `${code}: no such airport`);
      this.airportCache.set(code, null);
      return null;
    }
    if (!result.ok) {
      this.resolverLog('AirLabs failure', `${code}: ${result.failure?.kind} (${result.failure?.code ?? result.failure?.httpStatus ?? 'no response'})`);
      if (result.failure) failures?.push(result.failure);
      return undefined;
    }
    const item = (Array.isArray(result.body?.response) ? result.body.response : [])
      .find((a: any) => String(a[param] || '').toUpperCase() === code);
    if (!item) {
      this.resolverLog('AirLabs success', `${code}: no such airport`);
      this.airportCache.set(code, null);
      return null;
    }
    const airport = toSearchAirport(item);
    this.resolverLog('AirLabs success', `${code}: ${airport.iata || '-'}/${airport.icao || '-'} ${airport.name}`);
    this.cacheAirport(airport);
    return airport;
  }

  /**
   * City name for a city code (AirLabs /cities). Many airports share their
   * code with their city (TFL, DXB, HYD); where they don't, the city stays
   * unknown rather than guessed.
   */
  private async lookupCityName(cityCode: string): Promise<string | null> {
    if (this.cityNameCache.has(cityCode)) return this.cityNameCache.get(cityCode) ?? null;
    const result = await this.airLabsAirportGet('/cities', { city_code: cityCode });
    if (!result.ok && !result.notFound) return null; // not cached: may succeed later
    const item = result.ok
      ? (Array.isArray(result.body?.response) ? result.body.response : []).find((c: any) => String(c.city_code || '').toUpperCase() === cityCode)
      : null;
    const name = item?.name || null;
    this.cityNameCache.set(cityCode, name);
    return name;
  }

  /**
   * AirLabs /suggest for free text, cached for a day per query. Returns the
   * airports it names directly, by city and by country, plus the codes of
   * cities named exactly `q` whose code is also an airport code.
   * `undefined` = provider unavailable.
   */
  private async suggestAirports(
    query: string,
    failures?: AirportProviderFailure[]
  ): Promise<{ airports: SearchAirport[]; cityAirportCodes: string[]; countryCodes: string[] } | undefined> {
    const q = query.trim().toLowerCase();
    const cached = this.suggestCache.get(q);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      this.resolverLog('cache hit', `suggest "${q}"`);
      return cached;
    }
    if (q.length < SUGGEST_MIN_CHARS) {
      // AirLabs rejects shorter terms ("Search term is too short"): no call.
      this.resolverLog('skipped AirLabs', `suggest "${q}" is shorter than ${SUGGEST_MIN_CHARS} characters`);
      return { airports: [], cityAirportCodes: [], countryCodes: [] };
    }
    this.resolverLog('calling AirLabs', `/suggest q="${query.trim()}"`);
    const result = await this.airLabsAirportGet('/suggest', { q: query.trim() });
    if (!result.ok && !result.notFound) {
      this.resolverLog('AirLabs failure', `suggest "${q}": ${result.failure?.kind} (${result.failure?.code ?? result.failure?.httpStatus ?? 'no response'})`);
      if (result.failure) failures?.push(result.failure);
      return undefined;
    }
    {
      const r = (result.ok ? result.body?.response : null) || {};
      const cities: any[] = Array.isArray(r.cities) ? r.cities : [];
      const cityNames = new Map(cities.map((c) => [String(c.city_code || '').toUpperCase(), c.name as string]));
      const seen = new Set<string>();
      const airports: SearchAirport[] = [];
      for (const list of [r.airports, r.airports_by_cities, r.airports_by_countries]) {
        for (const item of Array.isArray(list) ? list : []) {
          const a = toSearchAirport(item);
          const key = a.iata || a.icao;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          const withCity = { ...a, city: a.city || cityNames.get(String(item.city_code || '').toUpperCase()) || null };
          airports.push(withCity);
          this.cacheAirport(withCity, false);
        }
      }
      // IATA convention: a city's main airport often shares the city code
      // (DXB, HYD, TFL). Only cities named exactly what was typed count -
      // "London" must not pick East London (ELS).
      const cityAirportCodes = cities
        .filter((c) => String(c.name || '').trim().toLowerCase() === q)
        .map((c) => String(c.city_code || '').toUpperCase())
        .filter((code) => airports.some((a) => a.iata === code));
      // Countries named exactly what was typed ("Portugal" -> PT).
      const countries: any[] = Array.isArray(r.countries) ? r.countries : [];
      const countryCodes = countries
        .filter((c) => String(c.name || '').trim().toLowerCase() === q && /^[A-Z]{2}$/i.test(String(c.code || '')))
        .map((c) => String(c.code).toUpperCase());
      const suggestion = { airports, cityAirportCodes, countryCodes, timestamp: Date.now() };
      this.suggestCache.set(q, suggestion);
      if (this.suggestCache.size > 500) this.suggestCache.delete(this.suggestCache.keys().next().value as string);
      this.resolverLog('AirLabs success', `suggest "${q}": ${airports.length} airport(s)`);
      return suggestion;
    }
  }

  /** Every airport AirLabs lists for a country (ISO code), cached for a day. */
  private async airportsInCountry(countryCode: string, failures?: AirportProviderFailure[]): Promise<SearchAirport[] | undefined> {
    const cached = this.countryAirportsCache.get(countryCode);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      this.resolverLog('cache hit', `country ${countryCode}`);
      return cached.airports;
    }
    this.resolverLog('calling AirLabs', `/airports country_code=${countryCode}`);
    const result = await this.airLabsAirportGet('/airports', { country_code: countryCode });
    if (!result.ok && !result.notFound) {
      if (result.failure) failures?.push(result.failure);
      return undefined;
    }
    const airports = (result.ok && Array.isArray(result.body?.response) ? result.body.response : [])
      .map(toSearchAirport)
      .filter((a: SearchAirport) => a.iata || a.icao);
    airports.forEach((a: SearchAirport) => this.cacheAirport(a));
    this.countryAirportsCache.set(countryCode, { timestamp: Date.now(), airports });
    return airports;
  }

  /**
   * Reference airports matching the text, best first. Priority: exact IATA,
   * exact ICAO, exact city, exact airport name, city prefix, a whole word of
   * the airport name, country. Text that only appears inside a word ("baku"
   * in "Bakula") is not a match, so it can never outrank a real city.
   */
  private localMatches(q: string): Array<SearchAirport & { matchScore: number }> {
    return Object.values(AIRPORT_COORDINATES)
      .map((a) => ({ a, score: airportMatchScore(q, a) }))
      .filter((m) => m.score > 0)
      .sort((x, y) => y.score - x.score)
      .map(({ a, score }) => ({ ...this.localAirport(a), matchScore: score }));
  }

  private localAirport(a: { iata: string; icao?: string; name: string; city: string; country: string; lat: number; lng: number }): SearchAirport {
    return { id: a.iata, iata: a.iata, icao: a.icao || null, name: a.name, city: a.city, country: a.country, lat: a.lat, lng: a.lng, timezone: airportTimeZone(a.iata), source: 'local' };
  }

  /**
   * Airports for flight-search autocomplete: only airports with an IATA code
   * (schedules are indexed by IATA). Local table first, then the provider.
   */
  public async searchAirports(query: string, limit = 8): Promise<{ airports: SearchAirport[]; cityAirportCodes: string[] }> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { airports: [], cityAirportCodes: [] };
    const remote = (await this.suggestAirports(query)) ?? { airports: [], cityAirportCodes: [], countryCodes: [] };
    const merged = new Map<string, SearchAirport>();
    for (const { matchScore: _score, ...a } of [...this.localMatches(q), ...remote.airports] as Array<SearchAirport & { matchScore?: number }>) {
      if (!a.iata) continue;
      const existing = merged.get(a.iata);
      merged.set(a.iata, existing ? { ...a, ...existing, city: existing.city || a.city, icao: existing.icao || a.icao } : a);
    }
    return { airports: Array.from(merged.values()).slice(0, limit), cityAirportCodes: remote.cityAirportCodes };
  }

  /**
   * Airports directory search: code (IATA or ICAO), airport name, city or
   * country, across the local table, discovered airports and AirLabs.
   * Airports without an IATA code are included. Status distinguishes "no
   * such airport" from "the provider couldn't be asked".
   */
  public async findAirports(
    query: string,
    limit = 150
  ): Promise<{ status: 'FOUND' | 'NOT_FOUND' | 'QUERY_TOO_SHORT' | AirportFailureKind; airports: SearchAirport[]; failure: AirportProviderFailure | null }> {
    const text = query.trim();
    const q = text.toLowerCase();
    if (q.length < 2) return { status: 'NOT_FOUND', airports: [], failure: null };
    const failures: AirportProviderFailure[] = [];
    const results: SearchAirport[] = [];

    // An exact code first: IATA is 3 characters, ICAO 4. Both are checked
    // against the provider rather than assumed.
    if (/^[A-Za-z0-9]{3}$/.test(text)) {
      const byIata = await this.lookupAirport(text, { withCity: true, complete: true, failures });
      if (byIata) results.push(byIata);
    }
    if (/^[A-Za-z0-9]{4}$/.test(text)) {
      const byIcao = await this.lookupAirportByIcao(text, { withCity: true, failures });
      if (byIcao) results.push(byIcao);
    }

    results.push(...this.localMatches(q).map(({ matchScore: _score, ...a }) => a));
    results.push(
      ...this.discoveredAirports().filter((a) =>
        [a.iata, a.icao, a.name, a.city, a.country].some((v) => v && v.toLowerCase().includes(q))
      )
    );
    const suggested = await this.suggestAirports(text, failures);
    if (suggested) {
      results.push(...suggested.airports.map((a) => this.fromCache(a.iata || a.icao || '') || a));
      // A country name lists that country's airports - those with an IATA
      // code (scheduled service) first.
      for (const cc of suggested.countryCodes) {
        const inCountry = await this.airportsInCountry(cc, failures);
        if (inCountry) results.push(...[...inCountry].sort((a, b) => Number(Boolean(b.iata)) - Number(Boolean(a.iata))));
      }
    }

    const merged = new Map<string, SearchAirport>();
    for (const a of results) {
      const key = a.iata || a.icao;
      if (!key) continue;
      const existing = merged.get(key);
      merged.set(key, existing
        ? { ...a, ...existing, icao: existing.icao || a.icao, city: existing.city || a.city, country: existing.country || a.country }
        : a);
    }
    const airports = Array.from(merged.values()).slice(0, limit);
    if (airports.length > 0) return { status: 'FOUND', airports, failure: null };
    // Nothing found: only a provider failure (with its real kind) is reported
    // as such - a clean "no match" from every source is NOT_FOUND.
    const failure = mostSevereFailure(failures);
    if (failure) return { status: failure.kind, airports: [], failure };
    // A short term only searched local/cached airports; say so rather than "not found".
    return { status: q.length < SUGGEST_MIN_CHARS ? 'QUERY_TOO_SHORT' : 'NOT_FOUND', airports: [], failure: null };
  }

  /**
   * Resolves what a user typed to one airport for a flight search, without
   * guessing:
   *  - an IATA code (3) or ICAO code (4) the provider knows -> that airport
   *  - a name/city with exactly one matching airport -> it
   *  - a city whose code is also an airport code (Dubai -> DXB) -> it
   *  - several equally good matches -> AMBIGUOUS, the user picks
   */
  public async resolveAirport(
    query: string
  ): Promise<{ status: 'FOUND'; airport: SearchAirport } | { status: 'AMBIGUOUS'; airports: SearchAirport[] } | { status: 'NOT_FOUND' } | { status: 'UNVERIFIED' }> {
    const q = query.trim();
    const lower = q.toLowerCase();
    const looksLikeIata = /^[A-Za-z0-9]{3}$/.test(q);
    const looksLikeIcao = /^[A-Za-z0-9]{4}$/.test(q);

    // A 3/4-character input may be a code, but it may also be a city or
    // airport name ("Goa" is Goa, India, while GOA is Genoa; "Leh" vs LEH,
    // Le Havre). A code is only taken as-is when no such name exists.
    let byCode: SearchAirport | null | undefined = null;
    if (looksLikeIata) byCode = await this.lookupAirport(q, { withCity: true });
    else if (looksLikeIcao) byCode = await this.lookupAirportByIcao(q, { withCity: true });

    const isNameMatch = (a: SearchAirport) => a.city?.toLowerCase() === lower || a.name?.toLowerCase() === lower;
    const localNamed = this.localMatches(lower).filter(isNameMatch);
    if (byCode && byCode.source === 'local' && localNamed.every((a) => a.iata === byCode!.iata)) {
      return { status: 'FOUND', airport: byCode };
    }
    const isLettersOnly = /^[A-Za-z]+$/.test(q);
    if (byCode && !isLettersOnly) return { status: 'FOUND', airport: byCode };

    // One reference airport with exactly this city name (Hyderabad -> HYD,
    // not Begumpet or Hyderabad, Pakistan): the curated table's pick.
    if (!byCode && localNamed.length === 1 && localNamed[0].city?.toLowerCase() === lower) {
      return { status: 'FOUND', airport: localNamed[0] };
    }

    const { airports, cityAirportCodes } = await this.searchAirports(q, 10);
    const named = airports.filter((a) => isNameMatch(a) && a.iata !== byCode?.iata);
    if (byCode) {
      // Both a code and a same-named place exist: the user must choose.
      return named.length ? { status: 'AMBIGUOUS', airports: [...named, byCode] } : { status: 'FOUND', airport: byCode };
    }
    if (byCode === undefined && airports.length === 0) return { status: 'UNVERIFIED' };
    if (airports.length === 0) return { status: 'NOT_FOUND' };
    // Only the provider or a strong local match can resolve free text; a
    // lone weak local match (e.g. a word of some airport's name) can't.
    const strong = (a: SearchAirport) => a.source !== 'local' || airportMatchScore(lower, a as any) >= STRONG_AIRPORT_MATCH;

    const exact = airports.filter((a) => isNameMatch(a) || a.iata?.toLowerCase() === lower);
    if (exact.length === 1) return { status: 'FOUND', airport: exact[0] };
    // Several airports in the named city: only its city-code airport, when
    // exactly one city has that name, is a principled pick (Dubai -> DXB).
    if (cityAirportCodes.length === 1) {
      const main = (exact.length ? exact : airports).find((a) => a.iata === cityAirportCodes[0]);
      if (main) return { status: 'FOUND', airport: main };
    }
    if (exact.length > 1) return { status: 'AMBIGUOUS', airports: exact };
    const candidates = airports.filter(strong);
    if (candidates.length === 0) return byCode === undefined ? { status: 'UNVERIFIED' } : { status: 'NOT_FOUND' };
    if (candidates.length === 1) return { status: 'FOUND', airport: candidates[0] };
    return { status: 'AMBIGUOUS', airports: candidates };
  }

  /**
   * Fills in airport name/country/coordinates from the provider for flights
   * at airports the local table doesn't cover (one cached lookup per
   * airport), and redraws their route line. Nothing is invented: if the
   * provider has no data the IATA code is shown as before.
   */
  private async enrichAirports(flights: Flight[]): Promise<void> {
    const unknown = new Set<string>();
    for (const f of flights) {
      for (const a of [f.departure, f.arrival]) {
        if (a.iata && !getAirportCoords(a.iata)) unknown.add(a.iata.toUpperCase());
      }
    }
    if (unknown.size === 0) return;
    const found = new Map<string, SearchAirport>();
    await Promise.all(
      Array.from(unknown).slice(0, 20).map(async (code) => {
        const airport = await this.lookupAirport(code);
        if (airport) found.set(code, airport);
      })
    );
    for (const f of flights) {
      let changed = false;
      for (const a of [f.departure, f.arrival]) {
        const info = found.get(a.iata.toUpperCase());
        if (!info) continue;
        if (info.name && (!a.name || a.name === a.iata || a.name === 'Unknown Airport')) a.name = info.name;
        a.city = a.city || info.city;
        a.country = a.country || info.country;
        if (a.latitude == null && info.lat != null && info.lng != null) {
          a.latitude = info.lat;
          a.longitude = info.lng;
          changed = true;
        }
      }
      if (changed) f.route = FlightNormalizer.generateRoutePoints(f.departure, f.arrival, f.live);
    }
  }

  /**
   * The airline timetable for a route (AirLabs /routes): every regularly
   * scheduled flight with its local/UTC times and the weekdays it operates.
   * Unlike /schedules (a rolling real-time window around "now"), this
   * covers any date. Cached per route for 12 hours; provider errors are
   * raised with their real cause (rate limit, auth, outage).
   */
  public async getRouteTimetable(depIata: string, arrIata: string): Promise<any[]> {
    return this.getTimetable({ dep_iata: depIata.toUpperCase(), arr_iata: arrIata.toUpperCase() });
  }

  /**
   * Timetable records (AirLabs /routes) for one filter: a route
   * (dep_iata + arr_iata) or a flight number (flight_iata / flight_icao).
   * Cached per filter for 12 hours and deduplicated; provider errors are
   * raised with their real cause.
   */
  public async getTimetable(filter: TimetableFilter): Promise<any[]> {
    if (!config.airLabsApiKey) return [];
    const key = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).sort().join('&');
    const cached = this.timetableCache.get(key);
    if (cached && Date.now() - cached.timestamp < TIMETABLE_CACHE_TTL_MS) {
      if (config.isDev) console.log('[Timetable] cache hit', { filter: key, records: cached.records.length });
      return cached.records;
    }
    const inFlight = this.timetableInFlight.get(key);
    if (inFlight) return inFlight;

    const request = (async () => {
      try {
        if (config.isDev) console.log('[Timetable] provider request', { endpoint: '/routes', ...filter, api_key: '***' });
        const response = await this.client.get('/routes', { params: { api_key: config.airLabsApiKey, ...filter } });
        if (response.data?.error) this.handleProviderApiError(response.data.error);
        const records: any[] = Array.isArray(response.data?.response) ? response.data.response : [];
        if (config.isDev) {
          console.log('[Timetable] API status=%d | records=%d | has_more=%s', response.status, records.length, String(response.data?.request?.has_more ?? false));
        }
        this.providerPages.set(`timetable:${key}`, pageFacts(response.data, records.length));
        this.timetableCache.set(key, { timestamp: Date.now(), records });
        return records;
      } catch (err: any) {
        this.handleAxiosError(err);
      }
    })().finally(() => this.timetableInFlight.delete(key));
    this.timetableInFlight.set(key, request);
    return request;
  }

  /**
   * Timetabled flights for a filter that operate on `localDate` (the
   * departure airport's calendar date), per the timetable's own `days`
   * list. A record without a days list is left out rather than assumed to
   * operate.
   */
  public async timetableFlightsOn(filter: TimetableFilter, localDate: string): Promise<{ flights: Flight[]; timetableRecords: number }> {
    const records = await this.getTimetable(filter);
    const weekday = weekdayOf(localDate);
    const flights = records
      .filter((r) => Array.isArray(r.days) && r.days.map((d: any) => String(d).toLowerCase()).includes(weekday))
      .map((r) => FlightNormalizer.normalizeAirLabsRoute(r, localDate))
      .filter((f): f is Flight => f !== null);
    await this.enrichAirports(flights);
    if (config.isDev) {
      console.log(`[Timetable] ${JSON.stringify(filter)} | date: ${localDate} (${weekday}) | records: ${records.length} | operating that day: ${flights.length}`);
    }
    return { flights, timetableRecords: records.length };
  }

  /** Whether the provider reported more records than it returned for this search (no paging on this plan). */
  public wasTruncated(query: FlightSearchQuery, timetable?: TimetableFilter | null): boolean {
    const pages = this.providerPagesFor(query, timetable);
    return Boolean(pages.schedules?.hasMore || pages.timetable?.hasMore);
  }

  /** What the provider returned vs. what it has, for the searches behind a query. */
  public providerPagesFor(query: FlightSearchQuery, timetable?: TimetableFilter | null): { schedules?: ProviderPage; timetable?: ProviderPage } {
    const timetableKey = timetable ? Object.entries(timetable).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).sort().join('&') : null;
    return {
      schedules: this.providerPages.get(`schedules:${this.buildCacheKey(query)}`),
      timetable: timetableKey ? this.providerPages.get(`timetable:${timetableKey}`) : undefined,
    };
  }

  public async searchByRoute(depIata: string, arrIata: string, date?: string): Promise<Flight[]> {
    return this.searchFlights({ depIata, arrIata, flightDate: date });
  }

  /**
   * Resolves the aircraft's real ICAO24/hex and registration for a flight
   * number via AirLabs' `/flights` endpoint (real-time, ADS-B-based) -
   * `/schedules` (used by searchFlights above) does not include these
   * fields at all. Only called when live position is actually requested
   * and no icao24 was already available on the flight object, so search
   * results are never charged this extra request. Cached and deduplicated
   * the same way as searchFlights.
   */
  public async getAircraftIdentifiers(
    flightNumber: string,
    flightIcao?: string | null,
    options: { maxAgeMs?: number } = {}
  ): Promise<AircraftIdentifiers> {
    if (!config.airLabsApiKey || config.airLabsApiKey.trim() === '') {
      return { ...EMPTY_IDENTIFIERS };
    }

    const clean = flightNumber.trim().toUpperCase();
    const icaoClean = flightIcao?.trim().toUpperCase() || null;
    // Include the icao in the cache key so different combinations are cached separately
    const cacheKey = `hex:${clean}${icaoClean ? `:${icaoClean}` : ''}`;

    const cached = this.hexCache.get(cacheKey);
    if (cached) {
      // A "no hex found" result is cached much more briefly than a real
      // one - AirLabs' live feed changes minute to minute (a flight that
      // hasn't started broadcasting yet will shortly), so a stale negative
      // must not block resolution once the aircraft actually appears.
      // Callers that use the position (not just the hex) pass a tighter
      // maxAgeMs so a cached position is never presented as current.
      const baseTtl = cached.value.icao24 ? CACHE_TTL_MS : HEX_NEGATIVE_CACHE_TTL_MS;
      const ttl = options.maxAgeMs !== undefined ? Math.min(baseTtl, options.maxAgeMs) : baseTtl;
      const age = Date.now() - cached.timestamp;
      if (age < ttl) {
        if (config.isDev) {
          console.log('[AirLabs] Cache hit (aircraft identifiers)', { cacheKey, ageMs: age, ttlMs: ttl, hadIcao24: Boolean(cached.value.icao24) });
        }
        return cached.value;
      }
    }

    const inFlight = this.hexInFlightRequests.get(cacheKey);
    if (inFlight) {
      if (config.isDev) {
        console.log('[AirLabs] Duplicate request prevented - reusing in-flight aircraft identifier request', { cacheKey });
      }
      return inFlight;
    }

    const promise = this.fetchAircraftIdentifiers(clean, icaoClean)
      .then((value) => {
        this.hexCache.set(cacheKey, { timestamp: Date.now(), value });
        return value;
      })
      .catch((err: any) => {
        // A failure here must not break the live-position flow - it just
        // means no hex is available, so the caller falls back to callsign.
        console.warn(`[AirLabs] aircraft identifier lookup failed for ${clean}: ${err?.code || err?.response?.status || err?.message}`);
        const value = { ...EMPTY_IDENTIFIERS };
        this.hexCache.set(cacheKey, { timestamp: Date.now(), value });
        return value;
      })
      .finally(() => {
        this.hexInFlightRequests.delete(cacheKey);
      });

    this.hexInFlightRequests.set(cacheKey, promise);
    return promise;
  }

  private async fetchAircraftIdentifiers(
    flightIata: string,
    flightIcao?: string | null
  ): Promise<AircraftIdentifiers> {
    // Try IATA lookup first
    const result = await this.fetchAircraftIdentifiersByParam('flight_iata', flightIata);
    if (result.icao24) {
      if (config.isDev) {
        console.log('[LiveFlight] AirLabs HEX (via IATA):', result.icao24);
        console.log('[LiveFlight] AirLabs callsign:', result.callsign);
        console.log('[LiveFlight] Status:', result.status);
      }
      return result;
    }

    // If IATA returned no hex and we have an ICAO callsign, try that too
    if (flightIcao && flightIcao.toUpperCase() !== flightIata.toUpperCase()) {
      if (config.isDev) {
        console.log('[AirLabs] IATA lookup returned no hex - retrying with ICAO callsign', { flight_icao: flightIcao });
      }
      const icaoResult = await this.fetchAircraftIdentifiersByParam('flight_icao', flightIcao.toUpperCase());
      if (config.isDev) {
        console.log('[LiveFlight] AirLabs HEX (via ICAO callsign):', icaoResult.icao24);
        console.log('[LiveFlight] AirLabs callsign:', icaoResult.callsign);
        console.log('[LiveFlight] Status:', icaoResult.status);
      }
      // Keep the IATA record's callsign/status if the ICAO retry found nothing better.
      return icaoResult.icao24 || !result.callsign ? icaoResult : result;
    }

    if (config.isDev) {
      console.log('[LiveFlight] AirLabs HEX: none');
      console.log('[LiveFlight] AirLabs callsign:', result.callsign);
      console.log('[LiveFlight] Status:', result.status);
    }
    return result;
  }

  private async fetchAircraftIdentifiersByParam(
    paramName: 'flight_iata' | 'flight_icao',
    paramValue: string
  ): Promise<AircraftIdentifiers> {
    const params: Record<string, any> = { api_key: config.airLabsApiKey, [paramName]: paramValue };

    if (config.isDev) {
      console.log('[AirLabs] API request', { endpoint: '/flights', [paramName]: paramValue, purpose: 'aircraft hex lookup' });
    }

    const response = await this.client.get('/flights', { params });

    if (response.data && response.data.error) {
      if (config.isDev) {
        console.log('[AirLabs] /flights error for hex lookup:', JSON.stringify(response.data.error));
      }
      return { ...EMPTY_IDENTIFIERS };
    }

    const items: any[] = Array.isArray(response.data?.response) ? response.data.response : [];

    // Only accept a record that actually matches the requested flight
    // number - never blindly take items[0]. Among matches, prefer one that
    // actually has a hex (AirLabs can return a record for a flight without
    // ADS-B data populated yet).
    const matching = items.filter(
      (it) =>
        String(it.flight_iata || '').toUpperCase() === paramValue ||
        String(it.flight_icao || '').toUpperCase() === paramValue
    );
    const item = matching.find((it) => it.hex) || matching[0] || null;

    if (config.isDev) {
      console.log('[AirLabs] /flights query result', {
        [paramName]: paramValue,
        totalRecordsReturned: items.length,
        matchingRecords: matching.length,
        hasHex: Boolean(item?.hex),
      });
    }

    if (!item) {
      if (config.isDev) {
        console.log('[AirLabs] /flights returned no live entry for', paramValue, '- no hex available');
      }
      return { ...EMPTY_IDENTIFIERS };
    }

    const icao24 = item.hex ? String(item.hex).trim().toLowerCase() : null;
    const registration = item.reg_number || null;
    const callsign = item.flight_icao || item.flight_iata || null;
    const status = item.status || null;
    const lat = toNumberOrNull(item.lat);
    const lng = toNumberOrNull(item.lng);
    const position: AirLabsPosition | null =
      lat !== null && lng !== null
        ? {
            latitude: lat,
            longitude: lng,
            altitudeMeters: toNumberOrNull(item.alt),
            speedKmh: toNumberOrNull(item.speed),
            heading: toNumberOrNull(item.dir),
            updated: toNumberOrNull(item.updated),
          }
        : null;

    if (config.isDev) {
      console.log('[AirLabs] Aircraft resolution result', {
        flightIata: item.flight_iata || null,
        flightIcao: item.flight_icao || null,
        icao24,
        registration,
        status,
        airline: item.airline_iata || item.airline_icao || null,
        departure: item.dep_iata || null,
        arrival: item.arr_iata || null,
        updated: item.updated || null,
      });
    }

    return { icao24, registration, callsign, status, position, depIata: item.dep_iata || null, arrIata: item.arr_iata || null };
  }

  /**
   * Mock filter matching search query criteria (used only when no
   * AIRLABS_API_KEY is configured).
   */
  private filterMockFlights(query: FlightSearchQuery): Flight[] {
    const all = getMockFlights();
    const cleanNum = query.flightNumber?.trim().toUpperCase();
    const cleanAirline = query.airline?.trim().toLowerCase();
    const cleanDep = query.depIata?.trim().toUpperCase();
    const cleanArr = query.arrIata?.trim().toUpperCase();

    return all.filter(f => {
      if (cleanNum) {
        const fIata = (f.flightIata || '').toUpperCase();
        const fNum = (f.flightNumber || '').toUpperCase();
        if (!fIata.includes(cleanNum) && !fNum.includes(cleanNum)) {
          return false;
        }
      }

      if (cleanAirline) {
        const aName = (f.airline.name || '').toLowerCase();
        const aIata = (f.airline.iata || '').toLowerCase();
        if (!aName.includes(cleanAirline) && !aIata.includes(cleanAirline)) {
          return false;
        }
      }

      if (cleanDep && f.departure.iata.toUpperCase() !== cleanDep) {
        return false;
      }

      if (cleanArr && f.arrival.iata.toUpperCase() !== cleanArr) {
        return false;
      }

      return true;
    });
  }

  /**
   * AirLabs in-band API errors (200 status with an `error` body, or the
   * same shape alongside a non-2xx status).
   */
  private handleProviderApiError(apiError: { message?: string; code?: string | number }): never {
    const rawCode = String(apiError.code ?? '').toLowerCase();
    const rawMessage = (apiError.message || '').toLowerCase();
    let error: any;

    if (rawCode.includes('key') || rawCode === '401' || rawMessage.includes('key') || rawMessage.includes('unauthorized')) {
      console.error('[AirLabs] Provider authentication failed (check AIRLABS_API_KEY)');
      error = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
      error.statusCode = 502;
      error.code = 'PROVIDER_AUTH_ERROR';
    } else if (rawCode.includes('limit') || rawCode === '429' || rawMessage.includes('limit') || rawMessage.includes('usage')) {
      error = new Error('Flight-data service request limit reached. Please try again later.');
      error.statusCode = 429;
      error.code = 'RATE_LIMIT_EXCEEDED';
    } else {
      if (config.isDev) console.log('[AirLabs] Provider API error', { code: apiError.code, message: apiError.message });
      error = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
      error.statusCode = 502;
      error.code = 'API_ERROR';
    }

    error.providerCode = apiError.code;
    throw error;
  }

  /**
   * Standardizes Axios/transport errors to domain-friendly errors. Errors
   * already mapped by handleProviderApiError (has .code and .statusCode)
   * are propagated as-is rather than re-wrapped.
   */
  private handleAxiosError(err: any): never {
    if (err.code && err.statusCode) {
      throw err;
    }

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      const error: any = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
      error.statusCode = 504;
      error.code = 'SERVICE_TIMEOUT';
      throw error;
    }

    if (err.response) {
      const status = err.response.status;
      const providerError = err.response.data?.error;

      if (config.isDev) {
        console.log('[AirLabs] Provider HTTP error status:', status);
        console.log('[AirLabs] Provider error body:', JSON.stringify(providerError || err.response.data)?.slice(0, 300));
      }

      if (status === 401 || status === 403) {
        // The server's provider credentials - not the user's login.
        console.error('[AirLabs] Provider rejected the credentials (HTTP %d)', status);
        const error: any = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
        error.statusCode = 502;
        error.code = 'PROVIDER_AUTH_ERROR';
        throw error;
      }
      if (status === 429) {
        const error: any = new Error('Flight-data service request limit reached. Please try again later.');
        error.statusCode = 429;
        error.code = 'RATE_LIMIT_EXCEEDED';
        throw error;
      }
      // Any other provider status is the provider's failure, not the client's request.
      const error: any = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
      error.statusCode = 502;
      error.code = 'API_ERROR';
      throw error;
    }

    if (config.isDev) console.log('[AirLabs] Provider unreachable:', err.message);
    const error: any = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
    error.statusCode = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    throw error;
  }
}

export const flightService = new FlightService();

function toSearchAirport(item: any): SearchAirport {
  // Each identifier is validated on its own; a missing or malformed one is
  // null, never merged into the other.
  const rawIata = String(item.iata_code || '').trim().toUpperCase();
  const rawIcao = String(item.icao_code || '').trim().toUpperCase();
  const iata = /^[A-Z0-9]{3}$/.test(rawIata) ? rawIata : null;
  const icao = /^[A-Z0-9]{4}$/.test(rawIcao) ? rawIcao : null;
  return {
    id: iata || icao || undefined,
    iata,
    icao,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null,
    city: item.city || null,
    // AirLabs gives an ISO country code; the UI renders the country name.
    country: item.country_code || null,
    lat: typeof item.lat === 'number' ? item.lat : null,
    lng: typeof item.lng === 'number' ? item.lng : null,
    // AirLabs' airport records carry no zone on this plan; reference
    // airports have their IANA zone, others stay unknown (null).
    timezone: item.timezone || airportTimeZone(iata),
    source: 'airlabs',
  };
}
