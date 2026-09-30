/** Today's date in the user's own time zone, "YYYY-MM-DD" (not the UTC date). */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-09-30" -> "September 30, 2026" (calendar date as written, no time-zone shift). */
export function formatCalendarDate(date?: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Product rule: flight searches cover today through the next 7 calendar days. */
export const SEARCH_WINDOW_DAYS = 7;
export const DATE_RANGE_MESSAGE =
  'Flight searches are available only for today and the next 7 days. Please select a date within this range.';

/** "YYYY-MM-DD" plus `days` calendar days. */
export function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** First and last searchable dates, in the user's own calendar. */
export function searchDateRange(): { min: string; max: string } {
  const min = localToday();
  return { min, max: addCalendarDays(min, SEARCH_WINDOW_DAYS) };
}

export function isSearchableDate(date?: string | null): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { min, max } = searchDateRange();
  return date >= min && date <= max;
}

/** The user's IANA time zone, so the server judges "today" the same way. */
export function userTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
