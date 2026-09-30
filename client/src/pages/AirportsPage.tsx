import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Building2, Search, Loader2, SearchX } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { AirportApiClient } from '../services/airportApi';
import { AIRPORT_STATUS_MESSAGES, AirportLookupStatus, AirportSummary } from '../types/airport';
import { formatCountry } from '../utils/formatCountry';

// Searches go to the backend (local table + discovered + flight-data provider).
const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

/** The code an airport is addressed by: IATA when it has one, else ICAO. */
const airportKey = (a: AirportSummary) => a.id || a.iata || a.icao || '';

export const AirportsPage: React.FC = () => {
  const [airports, setAirports] = useState<AirportSummary[]>([]);
  const [status, setStatus] = useState<AirportLookupStatus>('FOUND');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const q = query.trim();
    const controller = new AbortController();
    const run = async () => {
      setIsLoading(true);
      try {
        const result = await AirportApiClient.listAirports(q.length >= SEARCH_MIN_CHARS ? q : undefined, controller.signal);
        setAirports(result.airports);
        setStatus(result.status);
      } catch (err: any) {
        if (err.name !== 'AbortError') setStatus('SERVICE_UNAVAILABLE');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    const timer = window.setTimeout(run, q.length >= SEARCH_MIN_CHARS ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const searching = query.trim().length >= SEARCH_MIN_CHARS;

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
              Search any airport by IATA or ICAO code, airport name, city or country.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Code, airport, city or country..."
              aria-label="Search airports"
              className="w-full bg-white border border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-2xs"
            />
            {isLoading && searching ? (
              <Loader2 className="w-4 h-4 text-sky-600 animate-spin absolute left-3 top-1/2 -translate-y-1/2" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        {isLoading && airports.length === 0 && <LoadingState message={searching ? 'Searching airports...' : 'Loading airport directory...'} />}

        {/* Each outcome has its own message; only real outages say "temporarily unavailable". */}
        {!isLoading && airports.length === 0 && (status === 'NOT_FOUND' || status === 'QUERY_TOO_SHORT') && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-2 shadow-2xs" role="status">
            <SearchX className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-sm font-bold text-slate-900">{AIRPORT_STATUS_MESSAGES[status].title}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {status === 'NOT_FOUND' ? `No airport matches "${query.trim()}". ` : ''}
              {status === 'NOT_FOUND' ? 'Check the IATA/ICAO code or try the airport, city or country name.' : AIRPORT_STATUS_MESSAGES[status].message}
            </p>
          </div>
        )}
        {!isLoading && airports.length === 0 && status !== 'FOUND' && status !== 'NOT_FOUND' && status !== 'QUERY_TOO_SHORT' && (
          <ErrorState title={AIRPORT_STATUS_MESSAGES[status].title} message={AIRPORT_STATUS_MESSAGES[status].message} />
        )}

        {airports.length > 0 && (
          <>
            {searching && (
              <p className="text-xs text-slate-500">
                {airports.length} airport{airports.length === 1 ? '' : 's'} found for "{query.trim()}"
              </p>
            )}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isLoading ? 'opacity-60' : ''}`}>
              {airports.map((airport) => (
                <Link
                  key={airportKey(airport)}
                  to={`/airport/${encodeURIComponent(airportKey(airport))}`}
                  className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-5 flex items-start gap-3.5 transition-all shadow-2xs hover:shadow-md group"
                >
                  <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    {/* Explicit text separators keep fields apart even when the
                        card's text is copied or read out ("IATA: HYD ICAO: VOHS"). */}
                    <div className="text-sm font-bold text-slate-900 break-words" data-field="name">{airport.name || 'N/A'}</div>
                    {' '}
                    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      <div className="flex gap-1">
                        <dt className="text-slate-500">IATA:</dt>{' '}
                        <dd className="font-mono font-bold text-sky-700" data-field="iata">{airport.iata || 'N/A'}</dd>
                      </div>
                      {' '}
                      <div className="flex gap-1">
                        <dt className="text-slate-500">ICAO:</dt>{' '}
                        <dd className="font-mono font-bold text-slate-700" data-field="icao">{airport.icao || 'N/A'}</dd>
                      </div>
                    </dl>
                    {' '}
                    <div className="text-xs text-slate-500 truncate" data-field="location">
                      {[airport.city, formatCountry(airport.country)].filter(Boolean).join(', ') || 'N/A'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};
