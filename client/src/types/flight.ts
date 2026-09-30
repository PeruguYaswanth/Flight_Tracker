export type FlightStatus =
  | 'scheduled'
  | 'active'
  | 'landed'
  | 'cancelled'
  | 'incident'
  | 'diverted'
  | 'delayed'
  | 'unknown';

export interface AirportInfo {
  iata: string;
  icao?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  terminal?: string | null;
  gate?: string | null;
  baggage?: string | null;
  scheduledTime?: string | null;
  estimatedTime?: string | null;
  actualTime?: string | null;
  /** Airport-local "YYYY-MM-DD HH:MM" as reported by the provider. */
  scheduledLocal?: string | null;
  estimatedLocal?: string | null;
  /** Airport-local actual time, "YYYY-MM-DD HH:MM" (provider value). */
  actualLocal?: string | null;
  delayMinutes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface LivePosition {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  /** Provider's on-ground flag; null when the provider doesn't report one. */
  isGround?: boolean | null;
  updatedAt?: string | null;
  /** Which provider the position came from ('opensky' | 'airlabs'). */
  source?: string | null;
  /** Callsign the aircraft is broadcasting, when reported. */
  callsign?: string | null;
  /** ICAO24 hex of the aircraft actually matched. */
  icao24?: string | null;
}

export interface AircraftInfo {
  model?: string | null;
  registration?: string | null;
  iataCode?: string | null;
  icaoCode?: string | null;
  // ICAO24/hex transponder address - the aircraft's unique ADS-B
  // identifier, distinct from the flight's callsign/number.
  icao24?: string | null;
}

export interface AirlineInfo {
  name: string;
  iata?: string | null;
  icao?: string | null;
}

export interface Flight {
  id: string;
  flightNumber: string;
  flightIata?: string | null;
  flightIcao?: string | null;
  // The actual operating carrier's flight number when this flight is a
  // codeshare (from AirLabs' own codeshare fields, never guessed).
  operatingFlightIata?: string | null;
  // Marketing flight numbers for the same physical flight (route search).
  codeshares?: string[] | null;
  airline: AirlineInfo;
  flightDate: string;
  status: FlightStatus;
  departure: AirportInfo;
  arrival: AirportInfo;
  aircraft?: AircraftInfo | null;
  live?: LivePosition | null;
  lastUpdated: string;
  hasLiveTracking: boolean;
  route?: Array<[number, number]> | null;
  /**
   * 'schedule' = AirLabs real-time schedule record (live status, delays, gates);
   * 'timetable' = AirLabs route timetable for the selected date only - planned
   * times, no live status yet.
   */
  dataSource?: 'schedule' | 'timetable';
}

export interface FlightSearchFilters {
  mode: 'flight' | 'route';
  flightNumber: string;
  airline: string;
  flightDate: string;
  depIata: string;
  arrIata: string;
  /** Optional local departure time "HH:MM" - searches a window from this time. */
  departureTime?: string;
}

/** Why a search returned what it did - lets the UI tell "no flights" from "bad input". */
export type FlightSearchStatus =
  | 'FLIGHTS_FOUND'
  /** The provider had flights for this search, but none in the selected date/time window. */
  | 'NO_FLIGHTS_IN_TIME_WINDOW'
  /** The provider returned no flights at all for this search. */
  | 'NO_FLIGHTS_FROM_PROVIDER'
  /** The departure airport code/name is not a recognised airport. */
  | 'INVALID_DEPARTURE_AIRPORT'
  /** The arrival airport code/name is not a recognised airport. */
  | 'INVALID_ARRIVAL_AIRPORT';

/**
 * The normalized airport, whichever source it came from. Fields a source
 * doesn't provide are null - never guessed.
 */
export interface SearchAirport {
  /** Stable identifier: the IATA code when there is one, else the ICAO code. */
  id?: string;
  /** Null for airfields that only have an ICAO code (e.g. LPOT). */
  iata: string | null;
  icao: string | null;
  name: string | null;
  city: string | null;
  /** Country name (local table) or ISO code (provider). */
  country: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  source: 'local' | 'airlabs' | 'cache';
}

/** A real provider flight on the same search, outside the selected window. */
export interface AlternativeFlight {
  id: string;
  flightNumber: string;
  airline: string;
  flightDate: string;
  departureTime: string | null;
  /** Airport-local departure time "YYYY-MM-DD HH:MM". */
  localDepartureTime: string | null;
  status: FlightStatus;
  depIata: string;
  arrIata: string;
}

export interface FlightSearchMeta {
  searchStatus: FlightSearchStatus;
  /** Records the provider returned before the date/time window was applied. */
  providerResults: number;
  /**
   * 'CURRENT' = in the air now or departing in the next 24 hours;
   * 'DATE' = departing on searchedDate (departure airport's local date);
   * 'TIME' = departing on searchedDate between selectedTime and +windowHours (airport-local time).
   */
  window: 'CURRENT' | 'DATE' | 'TIME';
  searchedDate: string;
  selectedTime: string | null;
  windowHours: number | null;
  /** True when every searched airport was confirmed to exist. */
  airportsRecognized: boolean;
  route: { departure: SearchAirport | null; arrival: SearchAirport | null } | null;
  unknownAirports: string[];
  alternatives: AlternativeFlight[];
  /**
   * 'FULL_DAY' = the airline timetable for the whole date was searched;
   * 'REALTIME_WINDOW' = only the provider's real-time schedule (a window
   * around now) could be searched for this kind of query.
   */
  coverage?: 'FULL_DAY' | 'REALTIME_WINDOW';
  /** The provider had more records than it returns in one response. */
  truncated?: boolean;
  /** Provider page facts (records returned vs. its total); no paging on the current plan. */
  provider?: {
    schedules?: { returned: number; total: number | null; hasMore: boolean };
    timetable?: { returned: number; total: number | null; hasMore: boolean };
    paginationAvailable: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  total?: number;
  meta?: FlightSearchMeta;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
