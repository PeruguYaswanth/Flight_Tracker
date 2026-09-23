import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Building2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { AirportApiClient } from '../services/airportApi';
import { AirportSummary } from '../types/airport';

export const AirportsPage: React.FC = () => {
  const [airports, setAirports] = useState<AirportSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    AirportApiClient.listAirports(controller.signal)
      .then(setAirports)
      .catch((err: any) => {
        if (err.name !== 'AbortError') {
          setErrorMessage(err.message || 'Unable to load airports.');
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            Airports
          </h1>
          <p className="text-sm text-slate-400">
            Select an airport to view its current departures and arrivals.
          </p>
        </div>

        {isLoading && <LoadingState message="Loading airport reference data..." />}

        {!isLoading && errorMessage && <ErrorState message={errorMessage} />}

        {!isLoading && !errorMessage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {airports.map((airport) => (
              <Link
                key={airport.iata}
                to={`/airport/${airport.iata}`}
                className="bg-slate-900 border border-slate-800 hover:border-cyan-700/60 rounded-2xl p-4 flex items-start gap-3 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold font-mono text-cyan-300">{airport.iata}</div>
                  <div className="text-sm font-semibold text-white truncate">{airport.name}</div>
                  <div className="text-xs text-slate-400 truncate">{airport.city}, {airport.country}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
