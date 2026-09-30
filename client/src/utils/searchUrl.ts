import { FlightSearchFilters } from '../types/flight';

/** /flight-results?mode=route&dep=VGA&arr=VTZ&date=2026-09-30[&time=19:00] - survives refresh and sharing. */
export function resultsPath(filters: FlightSearchFilters): string {
  const p = new URLSearchParams();
  p.set('mode', filters.mode);
  if (filters.mode === 'route') {
    if (filters.depIata) p.set('dep', filters.depIata);
    if (filters.arrIata) p.set('arr', filters.arrIata);
  } else {
    if (filters.flightNumber) p.set('flight', filters.flightNumber);
    if (filters.airline) p.set('airline', filters.airline);
  }
  if (filters.flightDate) p.set('date', filters.flightDate);
  if (filters.departureTime) p.set('time', filters.departureTime);
  return `/flight-results?${p.toString()}`;
}

/** Filters from a results URL, or null when it doesn't describe a search. */
export function filtersFromParams(params: URLSearchParams): FlightSearchFilters | null {
  const mode = params.get('mode') === 'route' ? 'route' : params.get('mode') === 'flight' ? 'flight' : null;
  if (!mode) return null;
  const filters: FlightSearchFilters = {
    mode,
    flightNumber: mode === 'flight' ? params.get('flight') || '' : '',
    airline: mode === 'flight' ? params.get('airline') || '' : '',
    depIata: mode === 'route' ? (params.get('dep') || '').toUpperCase() : '',
    arrIata: mode === 'route' ? (params.get('arr') || '').toUpperCase() : '',
    flightDate: params.get('date') || '',
    departureTime: params.get('time') || undefined,
  };
  const complete = mode === 'route' ? Boolean(filters.depIata && filters.arrIata) : Boolean(filters.flightNumber || filters.airline);
  return complete ? filters : null;
}
