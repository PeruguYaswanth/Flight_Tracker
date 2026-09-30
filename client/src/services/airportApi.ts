import { ApiResponse } from '../types/flight';
import { AIRPORT_STATUS_MESSAGES, AirportDetails, AirportLookupStatus, AirportSummary } from '../types/airport';
import { SearchAirport } from '../types/flight';
import { API_BASE_URL } from './apiBase';
import { fetchWithTimeout } from './http';

const BASE_URL = API_BASE_URL;

export type AirportResolution =
  | { status: 'FOUND'; airport: SearchAirport }
  | { status: 'AMBIGUOUS'; airports: SearchAirport[] }
  | { status: 'NOT_FOUND' }
  /** The provider couldn't be asked; the input is neither confirmed nor rejected. */
  | { status: 'UNVERIFIED' };

/**
 * Status for a failed HTTP response - never collapsed into one generic
 * "unavailable". 429 covers both the provider's limit and this app's own
 * request limiter.
 */
function statusFromHttp(httpStatus: number, code?: string): Exclude<AirportLookupStatus, 'FOUND'> {
  if (httpStatus === 404) return 'NOT_FOUND';
  if (httpStatus === 429 || code === 'RATE_LIMIT_EXCEEDED' || code === 'AIRPORT_PROVIDER_RATE_LIMITED') return 'RATE_LIMITED';
  if (httpStatus === 400) return 'INVALID_QUERY';
  if (code === 'AIRPORT_PROVIDER_AUTH_ERROR') return 'PROVIDER_AUTH_ERROR';
  if (code === 'AIRPORT_PROVIDER_FORBIDDEN') return 'PROVIDER_FORBIDDEN';
  if (code === 'AIRPORT_PROVIDER_ERROR') return 'PROVIDER_ERROR';
  if (httpStatus === 502) return 'PROVIDER_ERROR';
  return 'SERVICE_UNAVAILABLE';
}

export class AirportLookupError extends Error {
  constructor(message: string, public status: Exclude<AirportLookupStatus, 'FOUND'>) {
    super(message);
    this.name = 'AirportLookupError';
  }
}

export class AirportApiClient {
  /** Airports matching a code, city or name - local table plus the flight-data provider. */
  public static async searchAirports(query: string, signal?: AbortSignal): Promise<SearchAirport[]> {
    const response = await fetchWithTimeout(`${BASE_URL}/airports/search?q=${encodeURIComponent(query)}`, { signal });
    const data: ApiResponse<SearchAirport[]> | null = await response.json().catch(() => null);
    return response.ok && data?.success ? data.data || [] : [];
  }

  /** Resolves typed text (IATA, ICAO, city or airport name) to one airport. */
  public static async resolveAirport(query: string, signal?: AbortSignal): Promise<AirportResolution> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/airports/resolve?q=${encodeURIComponent(query)}`, { signal });
      const data: ApiResponse<AirportResolution> | null = await response.json().catch(() => null);
      return response.ok && data?.success && data.data ? data.data : { status: 'UNVERIFIED' };
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      return { status: 'UNVERIFIED' };
    }
  }

  /**
   * The Airports directory. Without a query: the local reference airports
   * plus airports already discovered from the provider. With a query: any
   * airport by IATA/ICAO code, name, city or country.
   */
  public static async listAirports(query?: string, signal?: AbortSignal): Promise<{ airports: AirportSummary[]; status: AirportLookupStatus }> {
    const q = query?.trim();
    let response: Response;
    try {
      response = await fetchWithTimeout(`${BASE_URL}/airports${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal });
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      return { airports: [], status: 'SERVICE_UNAVAILABLE' };
    }
    const data: (ApiResponse<AirportSummary[]> & { meta?: { status?: AirportLookupStatus } }) | null = await response.json().catch(() => null);
    if (response.ok && data?.success) return { airports: data.data || [], status: data.meta?.status || 'FOUND' };
    return { airports: [], status: statusFromHttp(response.status, data?.error?.code) };
  }

  /** Details for an IATA or ICAO code. Rejects with AirportLookupError (404 / 503 / network). */
  public static async getAirportDetails(code: string, signal?: AbortSignal): Promise<AirportDetails> {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${BASE_URL}/airports/${encodeURIComponent(code.trim().toUpperCase())}`, { signal });
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      throw new AirportLookupError('The airport service is temporarily unavailable. Please try again.', 'SERVICE_UNAVAILABLE');
    }
    const data: ApiResponse<AirportDetails> | null = await response.json().catch(() => null);
    if (response.ok && data?.success && data.data) return data.data;
    const status = statusFromHttp(response.status, data?.error?.code);
    throw new AirportLookupError(data?.error?.message || AIRPORT_STATUS_MESSAGES[status].message, status);
  }
}
