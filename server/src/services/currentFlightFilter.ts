import { Flight } from '../types/flight';

// Grace window applied only when falling back to an ESTIMATED or SCHEDULED
// arrival time (never to an ACTUAL arrival, which is authoritative) to
// absorb minor drift between the provider's estimate and real touchdown.
const ARRIVAL_GRACE_MS = 15 * 60 * 1000;

// A departure that is still "scheduled" this long after its time is kept:
// boarding/pushback is often not reflected in the feed yet.
const UPCOMING_LOOKBACK_MS = 2 * 60 * 60 * 1000;
// Upcoming departures further out than this are not "current" results.
const UPCOMING_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
// No scheduled passenger flight is airborne longer than this; an "active"
// record older than that is a stale provider record, not a flight in the air.
const MAX_AIRBORNE_MS = 20 * 60 * 60 * 1000;

export type FlightPhase = 'airborne' | 'upcoming' | 'cancelled' | 'finished';

function parseMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Where a flight is right now, from the provider's own status and
 * timestamps only - never guessed from the schedule alone.
 *
 *  - finished: landed/diverted/incident, or the arrival has passed.
 *  - airborne: the provider says active, or reports an actual departure.
 *    A scheduled departure time that has passed is NOT enough.
 *  - upcoming: scheduled/delayed/unknown and departing between 2h ago and
 *    24h ahead.
 *  - cancelled: cancelled, with its departure in that same window.
 */
export function classifyFlight(flight: Flight, now: Date = new Date()): FlightPhase {
  const t = now.getTime();

  if (flight.status === 'landed' || flight.status === 'diverted' || flight.status === 'incident') {
    return 'finished';
  }

  const actualArrival = parseMs(flight.arrival.actualTime);
  if (actualArrival !== null && t >= actualArrival) return 'finished';

  const plannedDeparture = parseMs(flight.departure.estimatedTime) ?? parseMs(flight.departure.scheduledTime);
  const inUpcomingWindow =
    plannedDeparture !== null && plannedDeparture >= t - UPCOMING_LOOKBACK_MS && plannedDeparture <= t + UPCOMING_LOOKAHEAD_MS;

  if (flight.status === 'cancelled') {
    return inUpcomingWindow ? 'cancelled' : 'finished';
  }

  const actualDeparture = parseMs(flight.departure.actualTime);
  const hasDeparted = flight.status === 'active' || (actualDeparture !== null && actualDeparture <= t);

  if (hasDeparted) {
    const departedAt = actualDeparture ?? plannedDeparture;
    if (departedAt !== null && t - departedAt > MAX_AIRBORNE_MS) return 'finished';
    if (actualArrival === null) {
      const fallbackArrival = parseMs(flight.arrival.estimatedTime) ?? parseMs(flight.arrival.scheduledTime);
      if (fallbackArrival !== null && t >= fallbackArrival + ARRIVAL_GRACE_MS) return 'finished';
    }
    return 'airborne';
  }

  return inUpcomingWindow ? 'upcoming' : 'finished';
}

export function isCurrentlyFlying(flight: Flight, now: Date = new Date()): boolean {
  return classifyFlight(flight, now) === 'airborne';
}

/**
 * Flights worth showing in search results right now: in the air, departing
 * soon, or recently cancelled - sorted by departure time. Finished flights
 * (landed, arrived, stale records) are dropped.
 */
export function filterRelevantFlights(flights: Flight[], now: Date = new Date()): Flight[] {
  const departureMs = (f: Flight) =>
    parseMs(f.departure.actualTime) ?? parseMs(f.departure.estimatedTime) ?? parseMs(f.departure.scheduledTime) ?? Infinity;
  return flights
    .filter((f) => classifyFlight(f, now) !== 'finished')
    .sort((a, b) => departureMs(a) - departureMs(b));
}

/**
 * AirLabs lists every codeshare as its own record (HYD->DEL: 35 of 48
 * records were codeshares of 13 physical flights). When the operating
 * record is in the same result set - same number, route and scheduled
 * departure - the marketing records are folded into it as `codeshares`.
 * A codeshare whose operating record isn't present is kept as-is.
 */
export function collapseCodeshares(flights: Flight[]): Flight[] {
  const keyOf = (number: string, f: Flight) =>
    `${number.toUpperCase()}|${f.departure.iata}|${f.arrival.iata}|${f.departure.scheduledTime ?? ''}`;

  const operating = new Map<string, Flight>();
  for (const f of flights) {
    if (!f.operatingFlightIata) operating.set(keyOf(f.flightIata || f.flightNumber, f), { ...f, codeshares: [] });
  }

  const result: Flight[] = [];
  const emitted = new Set<Flight>();
  for (const f of flights) {
    const op = f.operatingFlightIata
      ? operating.get(keyOf(f.operatingFlightIata, f))
      : operating.get(keyOf(f.flightIata || f.flightNumber, f));
    if (f.operatingFlightIata && op) {
      op.codeshares!.push(f.flightNumber);
      continue;
    }
    const out = op ?? f;
    if (!emitted.has(out)) {
      emitted.add(out);
      result.push(out);
    }
  }
  return result;
}
