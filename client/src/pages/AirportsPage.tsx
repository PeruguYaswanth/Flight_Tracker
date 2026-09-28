import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Building2, Search } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { AirportApiClient } from '../services/airportApi';
import { AirportSummary } from '../types/airport';

export const AirportsPage: React.FC = () => {
  const [airports, setAirports] = useState<AirportSummary[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
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

  const filteredAirports = airports.filter((a) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      a.iata.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-sky-600" />
              Airports Directory
            </h1>
            <p className="text-sm text-slate-600">
              Browse major commercial airports to view active departures, arrivals, and location coordinates.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter airports..."
              className="w-full bg-white border border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {isLoading && <LoadingState message="Loading airport directory data..." />}

        {!isLoading && errorMessage && <ErrorState message={errorMessage} />}

        {!isLoading && !errorMessage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAirports.map((airport) => (
              <Link
                key={airport.iata}
                to={`/airport/${airport.iata}`}
                className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-5 flex items-start gap-3.5 transition-all shadow-2xs hover:shadow-md group"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-bold shrink-0 group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="font-mono text-base font-bold text-sky-700">{airport.iata}</div>
                  <div className="text-sm font-bold text-slate-900 truncate">{airport.name}</div>
                  <div className="text-xs text-slate-500 truncate">{airport.city}, {airport.country}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
