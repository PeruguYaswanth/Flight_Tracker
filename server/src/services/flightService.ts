import axios, { AxiosInstance } from 'axios';
import { config } from '../config/environment';
import { Flight, FlightSearchQuery } from '../types/flight';
import { FlightNormalizer } from './flightNormalizer';
import { getMockFlights } from './mockFlightData';
import { resolveAirlineIataFromSearchTerm } from './airlinesData';

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
export class FlightService {
  private client: AxiosInstance;
  private cache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<Flight[]>>();
  private hexCache = new Map<string, { timestamp: number; value: AircraftIdentifiers }>();
  private hexInFlightRequests = new Map<string, Promise<AircraftIdentifiers>>();

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
    if (config.isDev && response.data?.request?.has_more) {
      console.log('[AirLabs] Result truncated by provider', {
        returned: rawItems.length,
        totalItems: response.data.request.total_items ?? null,
      });
    }
    const flights: Flight[] = rawItems.map((item) => FlightNormalizer.normalizeAirLabs(item));

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
    const exact = date ? matches.find((f) => f.flightDate === date) : undefined;
    if (dep || arr) return exact || matches[0] || null;
    return exact || results[0] || null;
  }

  /**
   * Search flights by route (departure and arrival airports)
   */
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
      .catch(() => {
        // A failure here must not break the live-position flow - it just
        // means no hex is available, so the caller falls back to callsign.
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

    return { icao24, registration, callsign, status, position };
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
      if (config.isDev) console.log('[AirLabs] Provider authentication failed (check AIRLABS_API_KEY)');
      error = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
      error.statusCode = 401;
      error.code = 'AUTHENTICATION_FAILED';
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
        const error: any = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
        error.statusCode = 401;
        error.code = 'AUTHENTICATION_FAILED';
        throw error;
      }
      if (status === 429) {
        const error: any = new Error('Flight-data service request limit reached. Please try again later.');
        error.statusCode = 429;
        error.code = 'RATE_LIMIT_EXCEEDED';
        throw error;
      }
      const error: any = new Error(PROVIDER_UNAVAILABLE_MESSAGE);
      error.statusCode = status >= 500 ? 502 : status;
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
