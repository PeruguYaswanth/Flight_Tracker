import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { FlightSearch } from '../components/FlightSearch';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FlightSearchFilters } from '../types/flight';
import { FlightApiClient, FlightSearchError } from '../services/flightApi';
import { Search, Radar } from 'lucide-react';
import { resultsPath } from '../utils/searchUrl';

export const FlightStatusPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const incomingState = location.state as { filters?: FlightSearchFilters; prefillOnly?: boolean; focusDate?: boolean; focusTime?: boolean } | null;
  const incomingFilters = incomingState?.filters;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Rejected input (4xx) vs. the service being unavailable (5xx / network).
  const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined);
  const [lastFilters, setLastFilters] = useState<FlightSearchFilters | null>(null);

  const handleSearch = async (filters: FlightSearchFilters) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastFilters(filters);

    try {
      const { flights, meta } = await FlightApiClient.searchFlights(filters);
      navigate(resultsPath(filters), { state: { flights, filters, meta } });
    } catch (err: any) {
      const status = err instanceof FlightSearchError ? err.status : 0;
      if (status >= 400 && status < 500 && status !== 429) {
        setErrorTitle('Search could not be completed');
        setErrorMessage(err.message);
      } else if (status === 429) {
        setErrorTitle('Too many searches');
        setErrorMessage(err.message || 'Flight-data request limit reached. Please try again shortly.');
      } else {
        // Never presented as "no flights" - the data simply couldn't be fetched.
        setErrorTitle('Unable to retrieve flight information');
        setErrorMessage(err instanceof FlightSearchError && err.code === 'TIMEOUT' ? err.message : 'The flight-data service could not be reached. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setErrorMessage(null);
    setLastFilters(null);
  };

  useEffect(() => {
    if (incomingFilters && !incomingState?.prefillOnly) {
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
              autoFocusDate={Boolean(incomingState?.focusDate)}
              autoFocusTime={Boolean(incomingState?.focusTime)}
            />
          </div>
        </div>
      </div>

      {/* Results / Status container below hero */}
      <div className="max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {isLoading && <LoadingState message="Querying live aviation database..." />}

        {!isLoading && errorMessage && (
          <ErrorState
            title={errorTitle}
            message={errorMessage}
            onRetry={lastFilters ? () => handleSearch(lastFilters) : undefined}
          />
        )}

        {!isLoading && !errorMessage && <EmptyState type="initial" />}
      </div>
    </Layout>
  );
};
