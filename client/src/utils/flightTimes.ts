/**
 * Flight times are shown in the airport's own local time (as flight boards
 * do), from the provider's airport-local timestamps ("YYYY-MM-DD HH:MM").
 * Only when those are missing is the UTC instant shown in the viewer's zone.
 */

const LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/;

function clock(h: number, m: number): string {
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

export interface DisplayTime {
  time: string;
  /** Calendar date the time falls on ("YYYY-MM-DD"), or null when unknown. */
  date: string | null;
  /** True when shown in the airport's local time. */
  airportLocal: boolean;
}

export function displayTime(local?: string | null, iso?: string | null): DisplayTime {
  const m = local?.match(LOCAL_PATTERN);
  if (m) return { time: clock(Number(m[2]), Number(m[3])), date: m[1], airportLocal: true };
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), date, airportLocal: false };
    }
  }
  return { time: '--:--', date: null, airportLocal: false };
}

/**
 * Calendar days between two displayed times' dates (e.g. departs 22:30 on
 * the 30th, arrives 01:00 on the 1st -> 1). Both dates come from real
 * airport-local timestamps, never from comparing clock strings. 0 when
 * either date is unknown or they are not both airport-local.
 */
export function dayOffset(from: DisplayTime, to: DisplayTime): number {
  if (!from.date || !to.date || from.airportLocal !== to.airportLocal) return 0;
  return Math.round((Date.parse(`${to.date}T00:00:00Z`) - Date.parse(`${from.date}T00:00:00Z`)) / 86_400_000);
}

export function dayOffsetLabel(days: number): string | null {
  if (!days) return null;
  return `${days > 0 ? '+' : '−'}${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
}
