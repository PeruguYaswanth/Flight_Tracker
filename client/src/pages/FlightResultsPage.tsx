import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ListChecks, Calendar } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightResults } from '../components/FlightResults';
import { EmptyState } from '../components/EmptyState';
import { Flight, FlightSearchFilters } from '../types/flight';

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

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

// Matches the search form's default (today's UTC date).
function isToday(dateStr?: string): boolean {
  return !dateStr || dateStr === new Date().toISOString().split('T')[0];
}

export const FlightResultsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { flights?: Flight[]; filters?: FlightSearchFilters } | null;
  const flights = state?.flights;
  const filters = state?.filters;
  const formattedDate = formatDate(filters?.flightDate);

  const goToFlight = (flight: Flight) => {
    navigate(`/flight/${encodeURIComponent(flight.flightNumber)}`, { state: { flight } });
  };

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
              Flight Results for {describeSearch(filters)}
            </h1>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
              {flights.length} {flights.length === 1 ? 'Flight Found' : 'Flights Found'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {isToday(filters?.flightDate)
                ? 'Showing flights in the air now and departing in the coming hours'
                : `Departing on ${formattedDate}`}
            </span>
          </div>
        </div>

        {/* Results List or Empty State */}
        {flights.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              type="no-results"
              customMessage={
                filters?.mode === 'route'
                  ? 'No flights found for this route at the selected time.'
                  : 'No current or upcoming flights found for this search.'
              }
            />
            <div className="text-center pt-2">
              <button
                onClick={() => navigate('/flight-status')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-sm transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Modify Search
              </button>
            </div>
          </div>
        ) : (
          <FlightResults flights={flights} selectedFlight={null} onSelectFlight={goToFlight} />
        )}
      </div>
    </Layout>
  );
};
