import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { FlightSearch } from '../components/FlightSearch';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FlightSearchFilters } from '../types/flight';
import { FlightApiClient } from '../services/flightApi';
import { Search, Radar } from 'lucide-react';

export const FlightStatusPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const incomingFilters = (location.state as { filters?: FlightSearchFilters } | null)?.filters;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<FlightSearchFilters | null>(null);

  const handleSearch = async (filters: FlightSearchFilters) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastFilters(filters);

    try {
      const results = await FlightApiClient.searchFlights(filters);
      navigate('/flight-results', { state: { flights: results, filters } });
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve flight information. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setErrorMessage(null);
    setLastFilters(null);
  };

  useEffect(() => {
    if (incomingFilters) {
      handleSearch(incomingFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout headerProps={{ showLiveStatus: true }}>
      {/* Bright Aviation Hero Header Container */}
      <div className="relative w-full overflow-hidden bg-sky-900 border-b border-sky-800/30">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90 transition-all duration-700"
          style={{ backgroundImage: "url('/flight-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/40 via-sky-900/20 to-slate-900/60" />

        <div className="relative max-w-2xl w-full mx-auto px-4 sm:px-6 pt-10 pb-14 space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 bg-white/90 border border-sky-200 text-sky-900 text-xs font-bold px-3.5 py-1 rounded-full shadow-md backdrop-blur">
              <Radar className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
              <span>Real-Time Flight Navigation & Radar</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-2.5 drop-shadow-md">
              <Search className="w-6 h-6 text-sky-300" />
              Search Flight Status
            </h1>
            <p className="text-sm font-medium text-white max-w-xl drop-shadow">
              Search by commercial flight number or enter origin and destination cities to track live airborne aircraft.
            </p>
          </div>

          <div className="shadow-2xl rounded-2xl ring-1 ring-black/10">
            <FlightSearch
              onSearch={handleSearch}
              onReset={handleReset}
              isLoading={isLoading}
              initialFilters={incomingFilters}
            />
          </div>
        </div>
      </div>

      {/* Results / Status container below hero */}
      <div className="max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {isLoading && <LoadingState message="Querying live aviation database..." />}

        {!isLoading && errorMessage && (
          <ErrorState
            message={errorMessage}
            onRetry={lastFilters ? () => handleSearch(lastFilters) : undefined}
          />
        )}

        {!isLoading && !errorMessage && <EmptyState type="initial" />}
      </div>
    </Layout>
  );
};
