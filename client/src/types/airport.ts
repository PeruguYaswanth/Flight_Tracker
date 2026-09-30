import { Flight, SearchAirport } from './flight';

/** The normalized airport (local table, provider or cache). */
export type AirportSummary = SearchAirport;

/** Mirrors the backend's airport search/lookup statuses. */
export type AirportLookupStatus =
  | 'FOUND'
  | 'NOT_FOUND'
  | 'QUERY_TOO_SHORT'      // under 3 characters: only local/cached airports were searched
  | 'INVALID_QUERY'        // the provider rejected the query
  | 'PROVIDER_AUTH_ERROR'  // the server's provider API key was rejected
  | 'PROVIDER_FORBIDDEN'   // provider plan/permission restriction
  | 'RATE_LIMITED'         // provider or this app's request limit
  | 'PROVIDER_ERROR'       // provider-side error
  | 'SERVICE_UNAVAILABLE'; // network failure / timeout

/** What the UI says for each non-success status. */
export const AIRPORT_STATUS_MESSAGES: Record<Exclude<AirportLookupStatus, 'FOUND'>, { title: string; message: string }> = {
  NOT_FOUND: { title: 'Airport not found', message: 'No airport matches this search. Check the IATA/ICAO code or try the airport, city or country name.' },
  QUERY_TOO_SHORT: { title: 'Keep typing', message: 'Type at least 3 characters to search all airports.' },
  INVALID_QUERY: { title: 'Search not accepted', message: 'The airport data provider rejected this search. Try a different airport code or name.' },
  PROVIDER_AUTH_ERROR: { title: 'Airport data provider configuration error', message: 'The airport data provider rejected the server credentials. The server API key needs to be checked.' },
  PROVIDER_FORBIDDEN: { title: 'Airport data not available on this plan', message: 'The airport data provider does not allow this request for the current plan.' },
  RATE_LIMITED: { title: 'Airport data provider rate limit reached', message: 'Too many airport requests right now. Please try again in a few minutes.' },
  PROVIDER_ERROR: { title: 'Airport data provider error', message: 'The airport data provider returned an error. Please try again.' },
  SERVICE_UNAVAILABLE: { title: 'Airport service temporarily unavailable', message: 'The airport data service could not be reached. Please try again.' },
};

export interface AirportDetails {
  airport: AirportSummary;
  departures: Flight[];
  arrivals: Flight[];
  /** False when the airport has no IATA code - schedules are indexed by IATA. */
  flightsSearchable: boolean;
  /** True when the flight-data request failed (airport info is still valid). */
  flightsUnavailable: boolean;
  /** The provider had more flights than it returns in one response. */
  truncated?: { departures: boolean; arrivals: boolean };
  /** What the provider returned vs. holds for each board (no paging on the current plan). */
  provider?: { departures: { returned: number; total: number | null; hasMore: boolean } | null; arrivals: { returned: number; total: number | null; hasMore: boolean } | null; paginationAvailable: boolean };
  /** Provider records vs. board rows (codeshares are listed on their operating flight). */
  counts?: { departures: { providerRecords: number; rows: number }; arrivals: { providerRecords: number; rows: number } };
}
