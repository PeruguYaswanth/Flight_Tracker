import { ApiResponse, Flight, FlightSearchFilters, FlightSearchMeta } from '../types/flight';
import { API_BASE_URL } from './apiBase';
import { DATE_RANGE_MESSAGE, isSearchableDate, userTimeZone } from '../utils/localDate';
import { fetchWithTimeout, RequestTimeoutError } from './http';

const BASE_URL = API_BASE_URL;

export interface FlightSearchResult {
  flights: Flight[];
  /** Why the search returned what it did; absent only from older backends. */
  meta: FlightSearchMeta | null;
}

/**
 * A failed search. `status` 0 = the service could not be reached; 4xx =
 * the request itself was rejected (e.g. an invalid airport code); 5xx =
 * the flight-data service failed.
 */
export class FlightSearchError extends Error {
  constructor(message: string, public status: number, public code: string | null) {
    super(message);
    this.name = 'FlightSearchError';
  }
}

export class FlightApiClient {
  /**
   * Search flights by filters
   */
  public static async searchFlights(
    filters: FlightSearchFilters,
    signal?: AbortSignal
  ): Promise<FlightSearchResult> {
    // Never ask the server for a date outside the search window.
    if (filters.flightDate && !isSearchableDate(filters.flightDate)) {
      throw new FlightSearchError(DATE_RANGE_MESSAGE, 400, 'INVALID_DATE_RANGE');
    }

    const params = new URLSearchParams();

    if (filters.mode === 'route') {
      if (filters.depIata) params.append('depIata', filters.depIata.trim().toUpperCase());
      if (filters.arrIata) params.append('arrIata', filters.arrIata.trim().toUpperCase());
      if (filters.flightDate) params.append('flightDate', filters.flightDate);
    } else {
      if (filters.flightNumber) params.append('flightNumber', filters.flightNumber.trim().toUpperCase());
      if (filters.airline) params.append('airline', filters.airline.trim());
      if (filters.flightDate) params.append('flightDate', filters.flightDate);
    }

    if (filters.departureTime) params.append('departureTime', filters.departureTime);
    const timeZone = userTimeZone();
    if (timeZone) params.append('timeZone', timeZone);

    const endpoint = `${BASE_URL}/flights/search?${params.toString()}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      if (err instanceof RequestTimeoutError) {
        throw new FlightSearchError('The flight-data service took too long to respond. Please try again.', 0, 'TIMEOUT');
      }
      throw new FlightSearchError('The flight-data service could not be reached. Please try again.', 0, 'NETWORK_ERROR');
    }

    let data: ApiResponse<Flight[]> | null = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON body (e.g. a proxy error page) - treated as a service failure below.
    }

    if (!response.ok || !data?.success) {
      throw new FlightSearchError(
        data?.error?.code === 'INVALID_DATE_RANGE'
          ? DATE_RANGE_MESSAGE
          : data?.error?.message || 'The flight-data service could not be reached. Please try again.',
        response.ok ? 502 : response.status,
        data?.error?.code ?? null
      );
    }

    return { flights: data.data || [], meta: data.meta ?? null };
  }

  /**
   * Fetch single flight details by flight number
   */
  public static async getFlightDetails(
    flightNumber: string,
    date?: string,
    signal?: AbortSignal,
    route?: { depIata?: string; arrIata?: string }
  ): Promise<Flight> {
    const params = new URLSearchParams();
    if (date) params.append('flightDate', date);
    // Pins the exact instance being shown (same number can have several).
    if (route?.depIata) params.append('depIata', route.depIata);
    if (route?.arrIata) params.append('arrIata', route.arrIata);
    const timeZone = userTimeZone();
    if (timeZone) params.append('timeZone', timeZone);

    const query = params.toString() ? `?${params.toString()}` : '';
const endpoint = `${BASE_URL}/flights/${encodeURIComponent(flightNumber.trim().toUpperCase())}${query}`;

    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });

      // A non-JSON body (proxy error page) must never surface as a parse error.
      const data: ApiResponse<Flight> | null = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data.data) {
        const fallback = response.status >= 500 || !data
          ? 'Unable to retrieve flight information. Please try again later.'
          : 'No matching flight found. Please check the flight number, airline, or date.';
        const error: any = new Error(data?.error?.code === 'INVALID_DATE_RANGE' ? DATE_RANGE_MESSAGE : data?.error?.message || fallback);
        error.code = data?.error?.code ?? null;
        error.status = response.status;
        throw error;
      }

      return data.data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err instanceof RequestTimeoutError) {
        const error: any = new Error('The flight-data service took too long to respond. Please try again.');
        error.code = 'TIMEOUT';
        throw error;
      }
      if (err.status !== undefined) throw err;
      const error: any = new Error('The flight-data service could not be reached. Please try again.');
      error.code = 'NETWORK_ERROR';
      throw error;
    }
  }
}
