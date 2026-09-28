import { Flight, FlightStatus } from '../types/flight';
import { FlightSnapshot, NotificationEventType } from '../types/notification';

export interface FlightLabel {
  flightNumber: string;
  operatingFlightIata: string | null;
  originName: string;
  destinationName: string;
}

export interface DetectedEvent {
  type: NotificationEventType;
  /** Stable identity: the same real-world event always yields the same key. */
  dedupeKey: string;
  title: string;
  message: string;
}

export interface DetectionOptions {
  timeChangeThresholdMinutes: number;
}

// Statuses after which the departure side of the flight is settled.
const DEPARTED_OR_FINAL: FlightStatus[] = ['active', 'landed', 'cancelled', 'diverted'];
// Statuses after which the arrival side of the flight is settled.
const ARRIVED_OR_FINAL: FlightStatus[] = ['landed', 'cancelled', 'diverted'];

export const FINAL_STATUSES: FlightStatus[] = ['landed', 'cancelled', 'diverted'];

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatUtc(iso: string | null): string | null {
  const ms = parseMs(iso);
  if (ms === null) return null;
  return `${new Date(ms).toISOString().slice(11, 16)} UTC`;
}

function minutesBetween(laterIso: string | null, earlierIso: string | null): number | null {
  const a = parseMs(laterIso);
  const b = parseMs(earlierIso);
  if (a === null || b === null) return null;
  return Math.round((a - b) / 60000);
}

/**
 * Builds a snapshot from the existing normalized Flight. Only provider
 * fields are copied - nothing is derived from time, route or position.
 */
export function buildSnapshot(flight: Flight): FlightSnapshot {
  const dep = flight.departure;
  const arr = flight.arrival;
  return {
    status: flight.status,
    depScheduled: dep.scheduledTime ?? null,
    depEstimated: dep.estimatedTime ?? null,
    depActual: dep.actualTime ?? null,
    depDelayMinutes: typeof dep.delayMinutes === 'number' ? dep.delayMinutes : null,
    depGate: dep.gate ?? null,
    depTerminal: dep.terminal ?? null,
    arrScheduled: arr.scheduledTime ?? null,
    arrEstimated: arr.estimatedTime ?? null,
    arrActual: arr.actualTime ?? null,
    arrDelayMinutes: typeof arr.delayMinutes === 'number' ? arr.delayMinutes : null,
    arrGate: arr.gate ?? null,
    arrTerminal: arr.terminal ?? null,
    depTimeRef: dep.estimatedTime ?? dep.scheduledTime ?? null,
    arrTimeRef: arr.estimatedTime ?? arr.scheduledTime ?? null,
  };
}

/**
 * Compares the stored snapshot with the latest provider snapshot and
 * returns the meaningful changes, plus the snapshot to store next.
 *
 * Rules that keep this free of false positives and spam:
 *  - Status events fire only on the provider's own status value; "landed"
 *    requires the provider to say landed. An "unknown" status never
 *    replaces a known one.
 *  - Time events need a provider estimate that moved at least the
 *    configured threshold from the last notified time.
 *  - A missing gate/terminal is treated as a data gap, never a change.
 *  - Departure-side events stop once the flight has departed; arrival-side
 *    events stop once it has landed.
 */
export function detectFlightEvents(
  prev: FlightSnapshot,
  next: FlightSnapshot,
  label: FlightLabel,
  options: DetectionOptions
): { events: DetectedEvent[]; snapshot: FlightSnapshot } {
  const events: DetectedEvent[] = [];
  const threshold = options.timeChangeThresholdMinutes;
  const fn = label.operatingFlightIata && label.operatingFlightIata !== label.flightNumber
    ? `${label.flightNumber} (operated as ${label.operatingFlightIata})`
    : label.flightNumber;

  const status: FlightStatus = next.status === 'unknown' ? prev.status : next.status;

  // ── Status ────────────────────────────────────────────────────────────────
  let delayedStatusFired = false;
  if (next.status !== 'unknown' && next.status !== prev.status) {
    const key = `STATUS:${next.status}`;
    switch (next.status) {
      case 'active': {
        const at = formatUtc(next.depActual);
        events.push({
          type: 'DEPARTED',
          dedupeKey: key,
          title: 'Flight departed',
          message: `${fn} has departed from ${label.originName}${at ? ` at ${at}` : ''}.`,
        });
        break;
      }
      case 'landed': {
        const at = formatUtc(next.arrActual);
        events.push({
          type: 'LANDED',
          dedupeKey: key,
          title: 'Flight landed',
          message: `${fn} has landed at ${label.destinationName}${at ? ` at ${at}` : ''}.`,
        });
        break;
      }
      case 'cancelled':
        events.push({ type: 'CANCELLED', dedupeKey: key, title: 'Flight cancelled', message: `${fn} has been cancelled.` });
        break;
      case 'diverted':
        events.push({ type: 'DIVERTED', dedupeKey: key, title: 'Flight diverted', message: `${fn} has been diverted.` });
        break;
      case 'delayed': {
        const delay = next.depDelayMinutes ?? next.arrDelayMinutes;
        events.push({
          type: 'DELAYED',
          dedupeKey: key,
          title: 'Flight delayed',
          message: delay && delay > 0 ? `${fn} is delayed by ${delay} minutes.` : `${fn} is delayed.`,
        });
        delayedStatusFired = true;
        break;
      }
      case 'scheduled':
        // Only meaningful as a recovery, e.g. a delay being lifted.
        if (prev.status === 'delayed' || prev.status === 'cancelled') {
          events.push({ type: 'STATUS_SCHEDULED', dedupeKey: key, title: 'Back on schedule', message: `${fn} is now scheduled.` });
        }
        break;
      case 'incident':
        events.push({
          type: 'STATUS_CHANGED',
          dedupeKey: key,
          title: 'Status updated',
          message: `The provider reports an incident status for ${fn}.`,
        });
        break;
    }
  }

  // ── Departure / arrival times ────────────────────────────────────────────
  let depTimeRef = prev.depTimeRef ?? next.depTimeRef;
  let arrTimeRef = prev.arrTimeRef ?? next.arrTimeRef;
  let depShift: number | null = null;

  const departureOpen = !DEPARTED_OR_FINAL.includes(status) && !next.depActual;
  const arrivalOpen = !ARRIVED_OR_FINAL.includes(status) && !next.arrActual;

  if (departureOpen && next.depEstimated) {
    const shift = minutesBetween(next.depEstimated, depTimeRef);
    if (shift !== null && Math.abs(shift) >= threshold) {
      depShift = shift;
      depTimeRef = next.depEstimated;
      const delay = next.depDelayMinutes ?? minutesBetween(next.depEstimated, next.depScheduled);
      const at = formatUtc(next.depEstimated);
      if (shift > 0 && delay !== null && delay >= threshold) {
        // The status event already announced this delay.
        if (!delayedStatusFired) {
          events.push({
            type: 'DEPARTURE_DELAYED',
            dedupeKey: `DEP_TIME:${next.depEstimated}`,
            title: 'Departure delayed',
            message: `${fn} is delayed by ${delay} minutes. Estimated departure ${at}.`,
          });
        }
      } else {
        events.push({
          type: 'DEPARTURE_TIME_CHANGED',
          dedupeKey: `DEP_TIME:${next.depEstimated}`,
          title: 'Departure time changed',
          message: `${fn}'s estimated departure has changed to ${at} (${Math.abs(shift)} min ${shift > 0 ? 'later' : 'earlier'}).`,
        });
      }
    }
  }

  if (arrivalOpen && next.arrEstimated) {
    const shift = minutesBetween(next.arrEstimated, arrTimeRef);
    if (shift !== null && Math.abs(shift) >= threshold) {
      arrTimeRef = next.arrEstimated;
      // An arrival that just follows a departure change already notified
      // in this pass adds nothing new.
      const followsDeparture = depShift !== null && Math.abs(shift - depShift) < threshold;
      if (!followsDeparture && !delayedStatusFired) {
        const delay = next.arrDelayMinutes ?? minutesBetween(next.arrEstimated, next.arrScheduled);
        const at = formatUtc(next.arrEstimated);
        const late = shift > 0 && delay !== null && delay >= threshold;
        events.push({
          type: late ? 'ARRIVAL_DELAYED' : 'ARRIVAL_TIME_CHANGED',
          dedupeKey: `ARR_TIME:${next.arrEstimated}`,
          title: late ? 'Arrival delayed' : 'Arrival time changed',
          message: late
            ? `${fn} is now expected to arrive at ${label.destinationName} ${delay} minutes late, at ${at}.`
            : `${fn}'s estimated arrival has changed to ${at} (${Math.abs(shift)} min ${shift > 0 ? 'later' : 'earlier'}).`,
        });
      }
    }
  }

  // ── Gates / terminals ────────────────────────────────────────────────────
  const changed = (a: string | null, b: string | null) => Boolean(b) && b !== a;

  if (departureOpen && changed(prev.depGate, next.depGate)) {
    events.push({
      type: 'DEPARTURE_GATE_CHANGED',
      dedupeKey: `DEP_GATE:${next.depGate}`,
      title: prev.depGate ? 'Departure gate changed' : 'Departure gate assigned',
      message: prev.depGate
        ? `${fn}'s departure gate has changed from ${prev.depGate} to ${next.depGate}.`
        : `${fn} will depart from gate ${next.depGate}.`,
    });
  }
  if (departureOpen && changed(prev.depTerminal, next.depTerminal)) {
    events.push({
      type: 'DEPARTURE_TERMINAL_CHANGED',
      dedupeKey: `DEP_TERMINAL:${next.depTerminal}`,
      title: 'Departure terminal changed',
      message: prev.depTerminal
        ? `${fn}'s departure terminal has changed from ${prev.depTerminal} to ${next.depTerminal}.`
        : `${fn} will depart from terminal ${next.depTerminal}.`,
    });
  }
  if (arrivalOpen && changed(prev.arrGate, next.arrGate)) {
    events.push({
      type: 'ARRIVAL_GATE_CHANGED',
      dedupeKey: `ARR_GATE:${next.arrGate}`,
      title: prev.arrGate ? 'Arrival gate changed' : 'Arrival gate assigned',
      message: prev.arrGate
        ? `${fn}'s arrival gate has changed from ${prev.arrGate} to ${next.arrGate}.`
        : `${fn} will arrive at gate ${next.arrGate}.`,
    });
  }
  if (arrivalOpen && changed(prev.arrTerminal, next.arrTerminal)) {
    events.push({
      type: 'ARRIVAL_TERMINAL_CHANGED',
      dedupeKey: `ARR_TERMINAL:${next.arrTerminal}`,
      title: 'Arrival terminal changed',
      message: prev.arrTerminal
        ? `${fn}'s arrival terminal has changed from ${prev.arrTerminal} to ${next.arrTerminal}.`
        : `${fn} will arrive at terminal ${next.arrTerminal}.`,
    });
  }

  const snapshot: FlightSnapshot = {
    ...next,
    status,
    // A value that disappears from the feed is a data gap, not a change.
    depGate: next.depGate ?? prev.depGate,
    depTerminal: next.depTerminal ?? prev.depTerminal,
    arrGate: next.arrGate ?? prev.arrGate,
    arrTerminal: next.arrTerminal ?? prev.arrTerminal,
    depTimeRef,
    arrTimeRef,
  };

  return { events, snapshot };
}
