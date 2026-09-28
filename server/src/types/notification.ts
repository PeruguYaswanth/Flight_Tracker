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

/**
 * The subset of a normalized Flight that notifications are derived from.
 * Deliberately contains no position/altitude/speed/heading - live aircraft
 * movement can never produce a notification.
 */
export interface FlightSnapshot {
  status: FlightStatus;
  depScheduled: string | null;
  depEstimated: string | null;
  depActual: string | null;
  depDelayMinutes: number | null;
  depGate: string | null;
  depTerminal: string | null;
  arrScheduled: string | null;
  arrEstimated: string | null;
  arrActual: string | null;
  arrDelayMinutes: number | null;
  arrGate: string | null;
  arrTerminal: string | null;
  /**
   * Last departure/arrival time a notification was based on. Estimates are
   * compared against these rather than the previous poll, so a series of
   * small drifts still notifies once it adds up past the threshold.
   */
  depTimeRef: string | null;
  arrTimeRef: string | null;
}

export interface TrackedFlight {
  id: string;
  userId: string;
  /** Existing Flight.id: `${flightNumber}-${flightDate}-${dep}-${arr}`. */
  flightKey: string;
  flightNumber: string;
  flightIata: string | null;
  flightIcao: string | null;
  /** Operating carrier's flight number when the tracked flight is a codeshare. */
  operatingFlightIata: string | null;
  airline: string;
  flightDate: string;
  origin: string;
  originCity: string | null;
  destination: string;
  destinationCity: string | null;
  enabled: boolean;
  /** Set once the flight reached a final status; it is no longer checked. */
  completed: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastStatus: FlightStatus;
  snapshot: FlightSnapshot;
  /** Dedupe keys of every event already notified for this tracked flight. */
  firedEventKeys: string[];
}

export interface FlightNotification {
  id: string;
  userId: string;
  trackedFlightId: string;
  flightKey: string;
  flightNumber: string;
  airline: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
