import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock, PlaneTakeoff, RefreshCw, SearchX, SlidersHorizontal } from 'lucide-react';
import { FlightSearchFilters, FlightSearchMeta, SearchAirport } from '../types/flight';
import { AIRPORT_DATABASE } from '../data/airportDatabase';
import { formatCountry } from '../utils/formatCountry';
import { formatCalendarDate } from '../utils/localDate';
import { flightDetailsPath } from '../utils/flightLinks';

interface NoFlightsFoundProps {
  filters: FlightSearchFilters;
  meta: FlightSearchMeta | null;
  onTryAnotherTime: () => void;
  onSearchAnotherDate: () => void;
  onModifySearch: () => void;
}

/** Airport details from the backend, filled in from the local airport table. */
function describeAirport(code: string, fromApi: SearchAirport | null | undefined) {
  const local = AIRPORT_DATABASE.find((a) => a.iata === code);
  return {
    code,
    name: fromApi?.name || local?.name || null,
    city: fromApi?.city || local?.city || null,
    country: formatCountry(fromApi?.country || local?.country || null),
  };
}

function formatDate(date: string): string {
  return formatCalendarDate(date) || date;
}

/** "HH:MM" from an airport-local "YYYY-MM-DD HH:MM". */
function localClock(local: string | null): string | null {
  return local?.match(/[ T](\d{2}:\d{2})/)?.[1] ?? null;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + hours * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const actionButton =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1';
const NA = 'N/A';

export const NoFlightsFound: React.FC<NoFlightsFoundProps> = ({
  filters,
  meta,
  onTryAnotherTime,
  onSearchAnotherDate,
  onModifySearch,
}) => {
  const isRoute = filters.mode === 'route';
  const dep = isRoute ? describeAirport(filters.depIata, meta?.route?.departure) : null;
  const arr = isRoute ? describeAirport(filters.arrIata, meta?.route?.arrival) : null;
  const searchedDate = meta?.searchedDate || filters.flightDate;
  const selectedTime = meta?.selectedTime || null;
  const searchWindow = meta?.window ?? 'CURRENT';
  const windowText =
    searchWindow === 'TIME' && selectedTime
      ? `${selectedTime}–${addHours(selectedTime, meta?.windowHours ?? 3)} local time`
      : searchWindow === 'DATE'
      ? isRoute
        ? `All flights departing on ${formatDate(searchedDate)} (local time)`
        : `Departing on ${formatDate(searchedDate)}`
      : 'In the air now or departing in the coming hours';

  // An unrecognised airport is an input problem, not "no flights".
  if (meta?.searchStatus === 'INVALID_DEPARTURE_AIRPORT' || meta?.searchStatus === 'INVALID_ARRIVAL_AIRPORT') {
    const which = meta.searchStatus === 'INVALID_DEPARTURE_AIRPORT' ? 'departure' : 'arrival';
    const code = which === 'departure' ? filters.depIata : filters.arrIata;
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-4" role="alert">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">Airport not recognized</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            We couldn't resolve "{code}" as a valid {which} airport code or airport name. Please check the airport name or
            IATA code.
          </p>
        </div>
        <button type="button" onClick={onModifySearch} className={`${actionButton} bg-sky-600 hover:bg-sky-700 text-white shadow-sm`}>
          <SlidersHorizontal className="w-4 h-4" /> Modify Search
        </button>
      </div>
    );
  }

  const subject = isRoute ? 'this route' : `flight ${filters.flightNumber || filters.airline}`;
  // A whole-day route search found nothing on that date at all.
  const wholeDay = isRoute && !selectedTime && searchWindow === 'DATE';
  const alternatives = meta?.alternatives ?? [];

  const airportCard = (label: string, a: NonNullable<typeof dep>) => (
    <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 space-y-0.5">
        <span className="block font-mono text-lg font-black text-slate-900">{a.code}</span>
        <span className="block text-xs text-slate-700 break-words">{a.name || 'Airport name N/A'}</span>
        <span className="block text-xs text-slate-500">
          City: {a.city || NA} · Country: {a.country || NA}
        </span>
      </dd>
    </div>
  );
  const infoCard = (label: string, value: React.ReactNode, Icon: React.ElementType) => (
    <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900 flex items-center gap-1.5">
        <Icon className="w-4 h-4 text-slate-400 shrink-0" /> {value}
      </dd>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto">
          <PlaneTakeoff className="w-7 h-7 text-sky-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {wholeDay
              ? `No scheduled flights found for ${filters.depIata} → ${filters.arrIata} on ${formatDate(searchedDate)}.`
              : 'No flights available at the selected time'}
          </h2>
          {isRoute && dep && arr ? (
            <p className="text-sm font-semibold text-slate-800 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span>{dep.city || dep.name || dep.code} <span className="font-mono text-sky-700">({dep.code})</span></span>
              <ArrowRight className="w-4 h-4 text-slate-400" aria-label="to" />
              <span>{arr.city || arr.name || arr.code} <span className="font-mono text-sky-700">({arr.code})</span></span>
            </p>
          ) : (
            <p className="text-sm font-semibold font-mono text-slate-800">{filters.flightNumber || filters.airline}</p>
          )}
          {isRoute && meta?.airportsRecognized && (
            <p className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Both airports were recognized.
            </p>
          )}
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {wholeDay
              ? "The flight-data source has no scheduled flights for this route on this date. Flights may operate on other days."
              : <>No flights were found for {subject} during the selected time period. This doesn't necessarily mean there are
            no flights — flights may operate at different times or on different days.</>}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 pt-1">
          {!wholeDay && (
            <button type="button" onClick={onTryAnotherTime} className={`${actionButton} bg-sky-600 hover:bg-sky-700 text-white shadow-sm`}>
              <RefreshCw className="w-4 h-4" /> Try Another Time
            </button>
          )}
          <button type="button" onClick={onSearchAnotherDate} className={`${actionButton} bg-white border border-slate-200 hover:bg-slate-50 text-slate-800`}>
            <CalendarDays className="w-4 h-4 text-sky-600" /> Search Another Date
          </button>
          <button type="button" onClick={onModifySearch} className={`${actionButton} bg-white border border-slate-200 hover:bg-slate-50 text-slate-800`}>
            <SlidersHorizontal className="w-4 h-4 text-sky-600" /> Modify Search
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6 space-y-5">
        <section aria-labelledby="route-info-title">
          <h3 id="route-info-title" className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            {isRoute ? 'Route Information' : 'Search Information'}
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isRoute && dep && arr && [airportCard('Departure', dep), airportCard('Arrival', arr)]}
            {infoCard('Selected Date', formatDate(searchedDate), CalendarDays)}
            {!wholeDay && infoCard('Selected Time', selectedTime ? `${selectedTime} (local)` : 'Not specified', Clock)}
            {infoCard('Search Window', windowText, Clock)}
            {infoCard('Search Result', wholeDay ? 'No scheduled flights on this date' : 'No flight found in the selected time window', SearchX)}
          </dl>
        </section>

        <section aria-labelledby="alternatives-title">
          <h3 id="alternatives-title" className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Other scheduled flights
          </h3>
          {alternatives.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alternatives.map((alt) => (
                <li key={alt.id}>
                  <Link
                    to={flightDetailsPath(alt.flightNumber, { date: alt.flightDate, dep: alt.depIata, arr: alt.arrIata })}
                    className="flex items-center justify-between gap-3 bg-white border border-slate-200 hover:border-sky-300 rounded-xl px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">
                        {localClock(alt.localDepartureTime) ?? NA} — Flight <span className="font-mono">{alt.flightNumber}</span>
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">{alt.airline || NA}</span>
                    </span>
                    <span className="text-right text-[11px] text-slate-500 shrink-0">
                      {alt.localDepartureTime ? formatDate(alt.localDepartureTime.slice(0, 10)) : formatDate(alt.flightDate)}
                      <span className="block">local time</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No additional schedule information is available from the current flight-data source.</p>
          )}
        </section>
      </div>
    </div>
  );
};
