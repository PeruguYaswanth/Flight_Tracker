import crypto from 'crypto';
import { config } from '../config/environment';
import { Flight } from '../types/flight';
import { FlightNotification, TrackedFlight } from '../types/notification';
import { flightService } from './flightService';
import { buildSnapshot, detectFlightEvents, FINAL_STATUSES, FlightLabel } from './notificationEvents';
import { parseFlightNumber } from '../utils/flightNumber';

export interface TrackFlightInput {
  flightNumber: string;
  flightDate: string;
  depIata: string;
  arrIata: string;
}

export type PublicTrackedFlight = Omit<TrackedFlight, 'userId' | 'snapshot' | 'firedEventKeys'>;
export type PublicNotification = Omit<FlightNotification, 'userId'>;

/** Looks flights up by number. Defaults to the existing cached AirLabs search. */
export type FlightLookup = (flightNumber: string, flightDate: string) => Promise<Flight[]>;

const defaultLookup: FlightLookup = async (flightNumber, flightDate) => {
  const live = await flightService.searchFlights({ flightNumber, flightDate });
  if (live.some((f) => f.flightDate === flightDate)) return live;
  // Not in the real-time window (e.g. a flight later this week): that
  // date's timetable instance, so future flights can be tracked too.
  const parsed = parseFlightNumber(flightNumber);
  if (!parsed) return live;
  const filter = parsed.kind === 'IATA' ? { flight_iata: parsed.canonical } : { flight_icao: parsed.canonical };
  const { flights } = await flightService.timetableFlightsOn(filter, flightDate);
  return [...live, ...flights];
};

// A tracked flight the provider no longer returns stops being checked this
// long after its scheduled arrival (or departure, if arrival is unknown).
const TRACKING_EXPIRY_MS = 24 * 60 * 60 * 1000;

function httpError(statusCode: number, code: string, message: string): Error {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * Flight notifications on top of the existing flight data pipeline.
 *
 * Storage is in-memory per user, matching authService (the project has no
 * database): tracked flights and notifications survive page reloads but
 * reset when the server restarts - as do the user accounts themselves.
 *
 * There is no background worker. A user's tracked flights are re-checked
 * when that user's client polls for notifications, at most once per
 * `trackedFlightCheckIntervalMs` per flight, through flightService's
 * cached search. OpenSky / live position is never consulted, so aircraft
 * movement cannot produce notifications.
 */
export class NotificationService {
  private trackedByUser = new Map<string, TrackedFlight[]>();
  private notificationsByUser = new Map<string, FlightNotification[]>();
  private checksInFlight = new Map<string, Promise<void>>();

  constructor(private lookup: FlightLookup = defaultLookup) {}

  // ── Tracked flights ────────────────────────────────────────────────────────

  public listTracked(userId: string): PublicTrackedFlight[] {
    return (this.trackedByUser.get(userId) || []).map(toPublicTracked);
  }

  public async track(userId: string, input: TrackFlightInput): Promise<{ tracked: PublicTrackedFlight; created: boolean }> {
    const flightNumber = input.flightNumber.trim().toUpperCase();
    const depIata = input.depIata.trim().toUpperCase();
    const arrIata = input.arrIata.trim().toUpperCase();
    const flightDate = input.flightDate.trim();

    const list = this.trackedByUser.get(userId) || [];
    const existing = list.find(
      (t) => t.flightNumber === flightNumber && t.flightDate === flightDate && t.origin === depIata && t.destination === arrIata
    );
    if (existing) return { tracked: toPublicTracked(existing), created: false };

    if (list.length >= config.maxTrackedFlightsPerUser) {
      throw httpError(409, 'TRACKING_LIMIT_REACHED', `You can track up to ${config.maxTrackedFlightsPerUser} flights at once.`);
    }

    // The flight is resolved server-side from provider data - the client
    // only says which flight, never what state it is in.
    const marketing = await this.findInstance(flightNumber, flightDate, depIata, arrIata);
    if (!marketing) {
      throw httpError(404, 'FLIGHT_NOT_FOUND', `${flightNumber} on ${flightDate} (${depIata} → ${arrIata}) could not be found.`);
    }

    const operatingFlightIata =
      marketing.operatingFlightIata && marketing.operatingFlightIata.toUpperCase() !== flightNumber
        ? marketing.operatingFlightIata.toUpperCase()
        : null;
    const stateFlight = (await this.resolveStateFlight(marketing, operatingFlightIata)) || marketing;
    const snapshot = buildSnapshot(stateFlight);

    const tracked: TrackedFlight = {
      id: crypto.randomUUID(),
      userId,
      flightKey: marketing.id,
      flightNumber,
      flightIata: marketing.flightIata ?? null,
      flightIcao: marketing.flightIcao ?? null,
      operatingFlightIata,
      airline: marketing.airline?.name || marketing.airline?.iata || '',
      flightDate,
      origin: depIata,
      originCity: marketing.departure.city || null,
      destination: arrIata,
      destinationCity: marketing.arrival.city || null,
      enabled: true,
      completed: FINAL_STATUSES.includes(snapshot.status),
      createdAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      lastStatus: snapshot.status,
      snapshot,
      // The state at tracking time is the baseline - the user can already
      // see it on screen, so it is never re-announced.
      firedEventKeys: snapshot.status !== 'unknown' ? [`STATUS:${snapshot.status}`] : [],
    };

    this.trackedByUser.set(userId, [...list, tracked]);

    if (config.isDev) {
      console.log('[Notifications] Tracking started', {
        flightKey: tracked.flightKey,
        operatingFlightIata,
        status: snapshot.status,
      });
    }

    return { tracked: toPublicTracked(tracked), created: true };
  }

  public untrack(userId: string, trackedId: string): boolean {
    const list = this.trackedByUser.get(userId) || [];
    const next = list.filter((t) => t.id !== trackedId);
    if (next.length === list.length) return false;
    this.trackedByUser.set(userId, next);
    return true;
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  public listNotifications(userId: string): PublicNotification[] {
    return (this.notificationsByUser.get(userId) || []).map(toPublicNotification);
  }

  public markRead(userId: string, notificationId: string): boolean {
    const n = (this.notificationsByUser.get(userId) || []).find((x) => x.id === notificationId);
    if (!n) return false;
    n.read = true;
    return true;
  }

  public markAllRead(userId: string): void {
    (this.notificationsByUser.get(userId) || []).forEach((n) => { n.read = true; });
  }

  public deleteNotification(userId: string, notificationId: string): boolean {
    const list = this.notificationsByUser.get(userId) || [];
    const next = list.filter((n) => n.id !== notificationId);
    if (next.length === list.length) return false;
    this.notificationsByUser.set(userId, next);
    return true;
  }

  // ── Change detection ──────────────────────────────────────────────────────

  /**
   * Re-checks the user's tracked flights that are due. Provider failures
   * are logged and skipped - they never surface as notifications or errors.
   */
  public async refreshUser(userId: string): Promise<void> {
    const now = Date.now();
    const due = (this.trackedByUser.get(userId) || []).filter(
      (t) =>
        t.enabled &&
        !t.completed &&
        (!t.lastCheckedAt || now - new Date(t.lastCheckedAt).getTime() >= config.trackedFlightCheckIntervalMs)
    );

    // Sequential on purpose: gentle on the provider when several cache
    // entries expire at once, and cache hits make it fast anyway.
    for (const tracked of due) {
      await this.checkTracked(tracked);
    }
  }

  private checkTracked(tracked: TrackedFlight): Promise<void> {
    const inFlight = this.checksInFlight.get(tracked.id);
    if (inFlight) return inFlight;

    const promise = this.performCheck(tracked).finally(() => this.checksInFlight.delete(tracked.id));
    this.checksInFlight.set(tracked.id, promise);
    return promise;
  }

  private async performCheck(tracked: TrackedFlight): Promise<void> {
    // Stamped before the lookup so a failing provider isn't retried on
    // every poll.
    tracked.lastCheckedAt = new Date().toISOString();

    let flight: Flight | null;
    try {
      const marketing = await this.findInstance(tracked.flightNumber, tracked.flightDate, tracked.origin, tracked.destination);
      flight = await this.resolveStateFlight(marketing, tracked.operatingFlightIata);
      if (!flight) flight = marketing;
    } catch (err: any) {
      if (config.isDev) {
        console.log('[Notifications] Check skipped - provider lookup failed', { flightKey: tracked.flightKey, code: err.code, message: err.message });
      }
      return;
    }

    // Untracked while the lookup was running: drop the result.
    if (!(this.trackedByUser.get(tracked.userId) || []).includes(tracked)) return;

    if (!flight) {
      const reference = tracked.snapshot.arrScheduled || tracked.snapshot.depScheduled;
      if (reference && Date.now() - new Date(reference).getTime() > TRACKING_EXPIRY_MS) {
        tracked.completed = true;
      }
      return;
    }

    const label: FlightLabel = {
      flightNumber: tracked.flightNumber,
      operatingFlightIata: tracked.operatingFlightIata,
      originName: tracked.originCity || tracked.origin,
      destinationName: tracked.destinationCity || tracked.destination,
    };
    const { events, snapshot } = detectFlightEvents(tracked.snapshot, buildSnapshot(flight), label, {
      timeChangeThresholdMinutes: config.notifyTimeChangeThresholdMinutes,
    });

    tracked.snapshot = snapshot;
    tracked.lastStatus = snapshot.status;
    if (FINAL_STATUSES.includes(snapshot.status)) tracked.completed = true;

    for (const event of events) {
      if (tracked.firedEventKeys.includes(event.dedupeKey)) continue;
      tracked.firedEventKeys.push(event.dedupeKey);
      this.addNotification({
        id: crypto.randomUUID(),
        userId: tracked.userId,
        trackedFlightId: tracked.id,
        flightKey: tracked.flightKey,
        flightNumber: tracked.flightNumber,
        airline: tracked.airline,
        eventType: event.type,
        title: event.title,
        message: event.message,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    if (config.isDev) {
      console.log('[Notifications] Checked', {
        flightKey: tracked.flightKey,
        status: snapshot.status,
        newEvents: events.map((e) => e.dedupeKey),
      });
    }
  }

  private addNotification(notification: FlightNotification): void {
    const list = this.notificationsByUser.get(notification.userId) || [];
    list.unshift(notification);
    if (list.length > config.maxNotificationsPerUser) list.length = config.maxNotificationsPerUser;
    this.notificationsByUser.set(notification.userId, list);
  }

  // ── Flight identity ───────────────────────────────────────────────────────

  /**
   * Finds the one flight instance being tracked: same number, date and
   * route. Never falls back to "first result", which could be another day's
   * record for the same number.
   */
  private async findInstance(flightNumber: string, flightDate: string, depIata: string, arrIata: string): Promise<Flight | null> {
    const results = await this.lookup(flightNumber, flightDate);
    const number = flightNumber.toUpperCase();
    return (
      results.find(
        (f) =>
          (f.flightNumber.toUpperCase() === number ||
            (f.flightIata || '').toUpperCase() === number ||
            (f.flightIcao || '').toUpperCase() === number) &&
          f.flightDate === flightDate &&
          f.departure.iata.toUpperCase() === depIata &&
          f.arrival.iata.toUpperCase() === arrIata
      ) || null
    );
  }

  /**
   * For a codeshare, status comes from the operating flight's own record
   * on the same date and route. Returns null when there is no codeshare or
   * the operating record isn't found (the caller then uses the marketing
   * record, which AirLabs publishes for the same physical flight).
   */
  private async resolveStateFlight(marketing: Flight | null, operatingFlightIata: string | null): Promise<Flight | null> {
    if (!marketing || !operatingFlightIata) return null;
    return this.findInstance(operatingFlightIata, marketing.flightDate, marketing.departure.iata.toUpperCase(), marketing.arrival.iata.toUpperCase());
  }
}

function toPublicTracked(t: TrackedFlight): PublicTrackedFlight {
  const { userId, snapshot, firedEventKeys, ...rest } = t;
  return { ...rest };
}

function toPublicNotification(n: FlightNotification): PublicNotification {
  const { userId, ...rest } = n;
  return { ...rest };
}

export const notificationService = new NotificationService();
