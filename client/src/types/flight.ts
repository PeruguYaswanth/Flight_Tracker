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
  isGround?: boolean;
  updatedAt?: string | null;
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
}

export interface FlightSearchFilters {
  mode: 'flight' | 'route';
  flightNumber: string;
  airline: string;
  flightDate: string;
  depIata: string;
  arrIata: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  total?: number;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
