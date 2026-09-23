import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { FlightSearch } from '../components/FlightSearch';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FlightSearchFilters } from '../types/flight';
import { FlightApiClient } from '../services/flightApi';

export const FlightStatusPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const incomingFilters = (location.state as { filters?: FlightSearchFilters } | null)?.filters;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<FlightSearchFilters | null>(null);

  // Search only happens here. On success we hand the results off to the
  // dedicated Flight Results page instead of rendering them in place - the
  // map lives exclusively on the selected-flight details page now.
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

  // A search handed off from another page (e.g. the Home search box) runs
  // automatically so the user lands straight on the results.
  useEffect(() => {
    if (incomingFilters) {
      handleSearch(incomingFilters);
    }
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="max-w-xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        <div className="space-y-1.5 text-center sm:text-left">
          <h1 className="text-xl font-bold text-white">Flight Status</h1>
          <p className="text-sm text-slate-400">
            Search by flight number or by departure/arrival route to see matching flights.
          </p>
        </div>

        <FlightSearch onSearch={handleSearch} onReset={handleReset} isLoading={isLoading} />

        {isLoading && <LoadingState message="Searching for flights..." />}

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
