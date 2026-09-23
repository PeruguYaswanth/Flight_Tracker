import { Flight, FlightStatus } from '../types/flight';

// These statuses mean the flight is definitively not airborne right now,
// regardless of what the timestamps say (sparse/missing arrival data must
// never let a cancelled or already-landed record slip through).
const NON_ACTIVE_STATUSES: FlightStatus[] = ['landed', 'cancelled', 'incident', 'diverted'];

// Grace window applied only when falling back to an ESTIMATED or SCHEDULED
// arrival time (never to an ACTUAL arrival, which is authoritative) to
// absorb minor drift between the provider's estimate and real touchdown.
const ARRIVAL_GRACE_MS = 15 * 60 * 1000;

function parseInstant(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Aviationstack's departure/arrival timestamps are full ISO-8601 strings
// with an explicit UTC offset (e.g. "2026-09-18T02:15:00+00:00"). Parsing
// them with `new Date()` resolves that offset into an absolute instant, so
// comparing two Date objects here is timezone-safe - no raw string
// comparisons and no naive UTC-vs-local mixing.
function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

/**
 * True only when `flight` is genuinely airborne/en-route at `now`, based on
 * the provider's own timestamps and status - never guessed or assumed.
 *
 * Rules (all must hold):
 *  1. Status is not landed/cancelled/incident/diverted.
 *  2. It has an actual, or failing that estimated, or failing that
 *     scheduled departure time, and that time is not in the future.
 *  3. It has not arrived: no actual arrival time has passed, and no
 *     estimated/scheduled arrival time (+ grace) has passed either.
 *  4. Its departure instant falls on today's UTC calendar date - this is
 *     what excludes yesterday's and tomorrow's records for the same flight
 *     number. (Trade-off: a flight that departed late yesterday UTC and is
 *     still airborne past midnight UTC would be excluded by this rule; the
 *     task's own spec calls for a hard "flight date is today" check, so
 *     this is applied literally rather than loosened.)
 */
export function isCurrentlyFlying(flight: Flight, now: Date = new Date()): boolean {
  if (NON_ACTIVE_STATUSES.includes(flight.status)) {
    return false;
  }

  const departure =
    parseInstant(flight.departure.actualTime) ||
    parseInstant(flight.departure.estimatedTime) ||
    parseInstant(flight.departure.scheduledTime);

  // No departure information at all means we cannot confirm it has left the
  // ground - exclude rather than guess. This also naturally excludes
  // future-dated records that have no actual/estimated departure yet.
  if (!departure) return false;
  if (now.getTime() < departure.getTime()) return false;

  const actualArrival = parseInstant(flight.arrival.actualTime);
  if (actualArrival) {
    if (now.getTime() >= actualArrival.getTime()) return false;
  } else {
    const fallbackArrival = parseInstant(flight.arrival.estimatedTime) || parseInstant(flight.arrival.scheduledTime);
    if (fallbackArrival && now.getTime() >= fallbackArrival.getTime() + ARRIVAL_GRACE_MS) {
      return false;
    }
  }

  if (utcDateKey(departure) !== utcDateKey(now)) return false;

  return true;
}

export function filterCurrentlyFlying(flights: Flight[], now: Date = new Date()): Flight[] {
  return flights.filter((f) => isCurrentlyFlying(f, now));
}
