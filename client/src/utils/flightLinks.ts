/**
 * Flight details URL: /flight/6E706?date=2026-09-30&dep=HYD&arr=DEL.
 * Date and route pin the exact instance, so the page works after a refresh
 * or from a shared link without any in-memory state.
 */
export function flightDetailsPath(flightNumber: string, instance: { date?: string | null; dep?: string | null; arr?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (instance.date) params.set('date', instance.date);
  if (instance.dep) params.set('dep', instance.dep);
  if (instance.arr) params.set('arr', instance.arr);
  const query = params.toString();
  return `/flight/${encodeURIComponent(flightNumber)}${query ? `?${query}` : ''}`;
}

/** Details URL for a flight object. */
export function flightPath(flight: { flightNumber: string; flightDate: string; departure: { iata: string }; arrival: { iata: string } }): string {
  return flightDetailsPath(flight.flightNumber, { date: flight.flightDate, dep: flight.departure.iata, arr: flight.arrival.iata });
}

/** Details URL from a flight key (`${flightNumber}-${date}-${dep}-${arr}`). */
export function flightPathFromKey(flightNumber: string, flightKey?: string | null): string {
  const m = flightKey?.match(/-(\d{4}-\d{2}-\d{2})-([A-Z0-9]{3})-([A-Z0-9]{3})$/);
  return m ? flightDetailsPath(flightNumber, { date: m[1], dep: m[2], arr: m[3] }) : flightDetailsPath(flightNumber);
}
