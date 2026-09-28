import { FlightStatus } from './flight';

export type NotificationEventType =
  | 'STATUS_SCHEDULED'
  | 'DEPARTED'
  | 'LANDED'
  | 'DELAYED'
  | 'CANCELLED'
  | 'DIVERTED'
  | 'STATUS_CHANGED'
  | 'DEPARTURE_DELAYED'
  | 'DEPARTURE_TIME_CHANGED'
  | 'ARRIVAL_DELAYED'
  | 'ARRIVAL_TIME_CHANGED'
  | 'DEPARTURE_GATE_CHANGED'
  | 'ARRIVAL_GATE_CHANGED'
  | 'DEPARTURE_TERMINAL_CHANGED'
  | 'ARRIVAL_TERMINAL_CHANGED';

export interface FlightNotification {
  id: string;
  trackedFlightId: string;
  /** Matches Flight.id of the tracked flight. */
  flightKey: string;
  flightNumber: string;
  airline: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface TrackedFlight {
  id: string;
  /** Matches Flight.id: `${flightNumber}-${flightDate}-${dep}-${arr}`. */
  flightKey: string;
  flightNumber: string;
  flightIata: string | null;
  flightIcao: string | null;
  operatingFlightIata: string | null;
  airline: string;
  flightDate: string;
  origin: string;
  originCity: string | null;
  destination: string;
  destinationCity: string | null;
  enabled: boolean;
  completed: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastStatus: FlightStatus;
}
