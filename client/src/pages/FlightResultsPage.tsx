import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ListChecks, Calendar } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightResults } from '../components/FlightResults';
import { EmptyState } from '../components/EmptyState';
import { NoFlightsFound } from '../components/NoFlightsFound';
import { Flight, FlightSearchFilters, FlightSearchMeta, SearchAirport } from '../types/flight';
import { AIRPORT_DATABASE } from '../data/airportDatabase';
import { formatCalendarDate, localToday } from '../utils/localDate';
import { flightPath } from '../utils/flightLinks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { FlightApiClient } from '../services/flightApi';
import { filtersFromParams } from '../utils/searchUrl';

function describeSearch(filters?: FlightSearchFilters): string {
  if (!filters) return 'your query';

  if (filters.mode === 'route' && filters.depIata && filters.arrIata) {
    return `${filters.depIata} → ${filters.arrIata}`;
  }
  if (filters.mode === 'flight' && filters.flightNumber) {
    return `Flight ${filters.flightNumber}`;
  }
  if (filters.mode === 'flight' && filters.airline) {
    return `${filters.airline} Flights`;
  }
  return 'your search';
}

const formatDate = formatCalendarDate;

// Matches the search form's default (today in the user's time zone).
function isToday(dateStr?: string): boolean {
  return !dateStr || dateStr === localToday();
}

/** City of an airport code: backend route info, else the local airport table, else the code. */
function cityOf(code: string, fromApi?: SearchAirport | null): string {
  return fromApi?.city || AIRPORT_DATABASE.find((a) => a.iata === code)?.city || fromApi?.name || code;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + hours * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const FlightResultsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  type Loaded = { flights?: Flight[]; filters?: FlightSearchFilters; meta?: FlightSearchMeta | null };
  const navState = location.state as Loaded | null;
  // After a refresh or from a shared link there is no in-memory state: the
  // search is re-run from the URL.
  const urlFilters = navState?.flights ? null : filtersFromParams(searchParams);
  const [fetched, setFetched] = useState<Loaded | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  useEffect(() => {
    if (!urlFilters) return;
    const controller = new AbortController();
    setFetched(null);
    setFetchError(null);
    // Next tick: a StrictMode double mount never sends the search twice.
    const startId = window.setTimeout(() => {
      FlightApiClient.searchFlights(urlFilters, controller.signal)
        .then(({ flights, meta }) => setFetched({ flights, filters: urlFilters, meta }))
        .catch((err: any) => {
          if (err?.name !== 'AbortError') setFetchError(err?.message || 'The flight-data service could not be reached. Please try again.');
        });
    }, 0);
    return () => {
      window.clearTimeout(startId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const state = navState?.flights ? navState : fetched;
  const flights = state?.flights;
  const filters = state?.filters ?? urlFilters ?? undefined;
  const meta = state?.meta ?? null;
  const hasFlights = Boolean(flights && flights.length > 0);

  // Re-run or adjust the search from the search page. `prefillOnly` opens the
  // form without searching so the user can change it first.
  const searchAgain = (next: FlightSearchFilters, options: { prefillOnly?: boolean; focusDate?: boolean; focusTime?: boolean } = {}) =>
    navigate('/flight-status', { state: { filters: next, ...options } });
  const formattedDate = formatDate(meta?.searchedDate || filters?.flightDate);
  // Route searches cover the whole selected date (or the selected time window).
  const isRouteDateSearch = filters?.mode === 'route' && Boolean(filters.depIata && filters.arrIata) && (meta?.window === 'DATE' || meta?.window === 'TIME');
  const selectedTime = meta?.window === 'TIME' ? meta.selectedTime : null;
  const title = isRouteDateSearch && filters
    ? `Flights from ${cityOf(filters.depIata, meta?.route?.departure)} to ${cityOf(filters.arrIata, meta?.route?.arrival)}`
    : hasFlights
    ? `Flight Results for ${describeSearch(filters)}`
    : 'Flight Search Results';

  const goToFlight = (flight: Flight) => {
    navigate(flightPath(flight), { state: { flight } });
  };

  if (!flights && urlFilters && !fetchError) {
    return (
      <Layout>
        <div className="max-w-xl w-full mx-auto p-4 sm:p-6 pt-12">
          <LoadingState message="Loading flight results..." />
        </div>
      </Layout>
    );
  }

  if (!flights && fetchError) {
    return (
      <Layout>
        <div className="max-w-xl w-full mx-auto p-4 sm:p-6 pt-12 space-y-4 text-center">
          <ErrorState title="Search could not be completed" message={fetchError} />
          <button
            onClick={() => navigate('/flight-status', { state: urlFilters ? { filters: urlFilters, prefillOnly: true } : undefined })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Flight Search
          </button>
        </div>
      </Layout>
    );
  }

  if (!flights) {
    return (
      <Layout>
        <div className="max-w-xl w-full mx-auto p-4 sm:p-6 pt-12 space-y-4 text-center">
          <EmptyState type="initial" customMessage="Start a new flight search to view available results." />
          <button
            onClick={() => navigate('/flight-status')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Flight Search
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Back Navigation */}
        <button
          onClick={() => navigate('/flight-status')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </button>

        {/* Results Title Banner */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <ListChecks className="w-6 h-6 text-sky-600" />
              {title}
            </h1>
            {hasFlights ? (
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                {flights.length} {flights.length === 1 ? 'Flight Found' : 'Flights Found'}
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {isRouteDateSearch ? 'No Flights Found' : 'No Flights Available at This Time'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {meta?.window === 'DATE' || meta?.window === 'TIME'
                ? selectedTime
                  ? `${formattedDate} · departing ${selectedTime}–${addHours(selectedTime, meta?.windowHours ?? 3)} local time`
                  : formattedDate
                : isToday(filters?.flightDate)
                ? 'Showing flights in the air now and departing in the coming hours'
                : `Departing on ${formattedDate}`}
            </span>
          </div>
        </div>

        {(meta?.coverage === 'REALTIME_WINDOW' || meta?.truncated) && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5" role="note">
            {meta?.coverage === 'REALTIME_WINDOW'
              ? 'For this kind of search the flight-data provider only offers its real-time schedule (flights around the current time), so flights later on this date may be missing. Search by route or flight number to see the whole day.'
              : (() => {
                  const pages = [meta?.provider?.timetable, meta?.provider?.schedules].filter((p) => p?.hasMore);
                  const detail = pages.map((p) => `${p!.returned}${p!.total !== null ? ` of ${p!.total}` : ''}`).join(' and ');
                  return `The flight-data provider returned only part of its records for this search${detail ? ` (${detail})` : ''} and offers no further pages, so some flights may be missing.`;
                })()}
          </p>
        )}

        {/* Results List or Empty State */}
        {!hasFlights && filters ? (
          <NoFlightsFound
            filters={filters}
            meta={meta}
            onTryAnotherTime={() => searchAgain(filters, { prefillOnly: true, focusTime: true })}
            onSearchAnotherDate={() => searchAgain(filters, { prefillOnly: true, focusDate: true })}
            onModifySearch={() => searchAgain(filters, { prefillOnly: true })}
          />
        ) : !hasFlights ? (
          <EmptyState type="no-results" customMessage="No current or upcoming flights found for this search." />
        ) : (
          <FlightResults flights={flights} selectedFlight={null} onSelectFlight={goToFlight} />
        )}
      </div>
    </Layout>
  );
};
