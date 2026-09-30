/**
 * Calendar-date and time-zone helpers shared by search, details and the
 * normalizer. Dates are "YYYY-MM-DD" calendar dates, never Date objects, so
 * a selected date can't drift across a UTC boundary. Zone conversions use
 * the runtime's IANA database (Intl), so DST is handled per date.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Product rule: searches cover today through the next 7 calendar days. */
export const SEARCH_WINDOW_DAYS = 7;
export const DATE_RANGE_MESSAGE = 'Flight searches are available only from today through the next 7 days.';

/** A real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30, 2026-13-01...). */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = value.match(DATE_PATTERN);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** "HH:MM", 00:00-23:59. */
export function isValidTimeOfDay(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date plus `days`. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Weekday of a calendar date: 'sun'..'sat'. */
export function weekdayOf(date: string): string {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function zonedParts(ms: number, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Today's calendar date in `timeZone` (UTC when missing or unknown). */
export function todayIn(timeZone?: string | null, now: number = Date.now()): string {
  return zonedParts(now, isValidTimeZone(timeZone) ? timeZone : 'UTC').date;
}

/** "YYYY-MM-DD HH:MM" wall-clock time of an instant in `timeZone`. */
export function formatZonedLocal(ms: number, timeZone: string): string {
  const { date, time } = zonedParts(ms, timeZone);
  return `${date} ${time}`;
}

/**
 * UTC instant of a wall-clock time on a calendar date in `timeZone`
 * (e.g. 2026-10-05 09:00 Asia/Kolkata -> 03:30Z). DST-aware: the zone's
 * offset is taken at that date, not today.
 */
export function zonedLocalToUtcMs(date: string, time: string, timeZone: string): number {
  const [h, m] = time.split(':').map(Number);
  const wallAsUtc = Date.parse(`${date}T00:00:00Z`) + (h * 60 + m) * 60_000;
  let guess = wallAsUtc;
  // Two passes settle the offset, including across a DST change.
  for (let i = 0; i < 2; i++) {
    const shown = zonedParts(guess, timeZone);
    const shownAsUtc = Date.parse(`${shown.date}T${shown.time}:00Z`);
    guess += wallAsUtc - shownAsUtc;
  }
  return guess;
}

/**
 * Validates a requested search date against the 7-day window, as calendar
 * dates in the user's time zone. Runs before any provider request.
 * Returns the error to send, or null when the date is acceptable.
 */
export function searchDateError(
  flightDate: string | undefined,
  timeZone?: string | null
): { status: 400; code: 'INVALID_DATE' | 'INVALID_DATE_RANGE'; message: string } | null {
  if (flightDate === undefined) return null;
  if (!isValidCalendarDate(flightDate)) {
    return { status: 400, code: 'INVALID_DATE', message: 'Please provide a valid flight date (YYYY-MM-DD).' };
  }
  const today = todayIn(timeZone);
  if (flightDate < today || flightDate > addDays(today, SEARCH_WINDOW_DAYS)) {
    return { status: 400, code: 'INVALID_DATE_RANGE', message: DATE_RANGE_MESSAGE };
  }
  return null;
}
