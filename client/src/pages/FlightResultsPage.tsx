import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightResults } from '../components/FlightResults';
import { EmptyState } from '../components/EmptyState';
import { Flight, FlightSearchFilters } from '../types/flight';

function describeSearch(filters?: FlightSearchFilters): string {
  if (!filters) return 'your search';

  if (filters.mode === 'route' && filters.depIata && filters.arrIata) {
    return `${filters.depIata} → ${filters.arrIata}`;
  }
  if (filters.mode === 'flight' && filters.flightNumber) {
    return filters.flightNumber;
  }
  if (filters.mode === 'flight' && filters.airline) {
    return filters.airline;
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

  // Direct navigation / refresh with no search context - nothing to show.
  if (!flights) {
    return (
      <Layout>
        <div className="max-w-xl w-full mx-auto p-4 sm:p-6 pt-10 space-y-4 text-center">
          <EmptyState type="initial" customMessage="Start a search to see flight results here." />
          <button
            onClick={() => navigate('/flight-status')}
            className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        <button
          onClick={() => navigate('/flight-status')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </button>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-cyan-400" />
            Flight Results for {describeSearch(filters)}
          </h1>
          <p className="text-sm text-slate-400">
            {formattedDate ? `${formattedDate} · ` : ''}
            {flights.length} {flights.length === 1 ? 'flight' : 'flights'} found
          </p>
        </div>

        {flights.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              type="no-results"
              customMessage="No currently flying flight found. It may not have departed yet, may have already landed, or may not be active right now."
            />
            <div className="text-center">
              <button
                onClick={() => navigate('/flight-status')}
                className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Search
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
