import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PlaneTakeoff, PlaneLanding, Building2, Info, SearchX } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { FlightCard } from '../components/FlightCard';
import { AirportApiClient, AirportLookupError } from '../services/airportApi';
import { AIRPORT_STATUS_MESSAGES, AirportDetails } from '../types/airport';
import { Flight } from '../types/flight';
import { formatCountry } from '../utils/formatCountry';
import { flightPath } from '../utils/flightLinks';

const NA = 'N/A';
const SOURCE_LABEL: Record<string, string> = { local: 'Local airport directory', airlabs: 'AirLabs', cache: 'AirLabs (cached)' };

export const AirportDetailPage: React.FC = () => {
  const { airportCode } = useParams<{ airportCode: string }>();
  const navigate = useNavigate();

  const [details, setDetails] = useState<AirportDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AirportLookupError | null>(null);

  useEffect(() => {
    if (!airportCode) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setDetails(null);

    // A superseded (airport changed) or unmounted request must not touch
    // state: its late result, error or loading flag would belong to the
    // wrong airport.
    const current = () => !controller.signal.aborted;
    AirportApiClient.getAirportDetails(airportCode, controller.signal)
      .then((result) => {
        if (current()) setDetails(result);
      })
      .catch((err: any) => {
        if (!current() || err.name === 'AbortError') return;
        setError(err instanceof AirportLookupError ? err : new AirportLookupError('The airport service is temporarily unavailable. Please try again.', 'SERVICE_UNAVAILABLE'));
      })
      .finally(() => {
        if (current()) setIsLoading(false);
      });

    return () => controller.abort();
  }, [airportCode]);

  const goToFlight = (flight: Flight) => {
    navigate(flightPath(flight), { state: { flight } });
  };

  const a = details?.airport;
  const fields: Array<[string, React.ReactNode]> = a
    ? [
        ['IATA', <span className="font-mono">{a.iata || NA}</span>],
        ['ICAO', <span className="font-mono">{a.icao || NA}</span>],
        ['City', a.city || NA],
        ['Country', formatCountry(a.country) || NA],
        ['Latitude', typeof a.lat === 'number' ? `${a.lat.toFixed(4)}°` : NA],
        ['Longitude', typeof a.lng === 'number' ? `${a.lng.toFixed(4)}°` : NA],
        ['Timezone', a.timezone || NA],
        ['Data source', SOURCE_LABEL[a.source] || a.source],
      ]
    : [];
  const noFlights = Boolean(details && details.flightsSearchable && !details.flightsUnavailable && details.departures.length === 0 && details.arrivals.length === 0);

  const board = (title: string, Icon: React.ElementType, iconClass: string, flights: Flight[], emptyText: string) => (
    <section className="space-y-3">
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconClass}`} />
          {title} ({flights.length})
        </h2>
        <span className="text-xs font-semibold text-slate-500">
          {(() => {
            const page = title === 'Departures' ? details?.provider?.departures : details?.provider?.arrivals;
            if (!page?.hasMore) return 'Scheduled/Active';
            // Provider cap, not an app limit: say what it returned vs. holds.
            return `Partial: provider returned ${page.returned}${page.total !== null ? ` of ${page.total}` : ''} records`;
          })()}
        </span>
      </div>
      <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
        {flights.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 font-medium">{emptyText}</div>
        )}
        {flights.map((flight) => (
          <FlightCard key={flight.id} flight={flight} isSelected={false} onSelect={goToFlight} />
        ))}
      </div>
    </section>
  );

  return (
    <Layout>
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <button
          onClick={() => navigate('/airports')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Airports Directory</span>
        </button>

        {isLoading && <LoadingState message="Loading airport information..." />}

        {!isLoading && error?.status === 'NOT_FOUND' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-2 shadow-2xs" role="alert">
            <SearchX className="w-8 h-8 text-slate-400 mx-auto" />
            <h1 className="text-base font-bold text-slate-900">Airport not found</h1>
            <p className="text-sm text-slate-500">No airport with the code "{airportCode?.toUpperCase()}" exists in the airport data source.</p>
          </div>
        )}
        {!isLoading && error && error.status !== 'NOT_FOUND' && (
          <ErrorState title={AIRPORT_STATUS_MESSAGES[error.status].title} message={AIRPORT_STATUS_MESSAGES[error.status].message} />
        )}

        {!isLoading && !error && details && a && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-bold shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded inline-block border border-sky-200">
                    IATA: {a.iata || NA} · ICAO: {a.icao || NA}
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 break-words">{a.name || NA}</h1>
                  <p className="text-sm text-slate-600 font-medium">
                    {[a.city, formatCountry(a.country)].filter(Boolean).join(', ') || 'Location N/A'}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fields.map(([label, value]) => (
                  <div key={label} className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}:</dt>{' '}
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900 break-words">{value}</dd>{' '}
                  </div>
                ))}
              </dl>
            </div>

            {!details.flightsSearchable && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 flex gap-2" role="status">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                This airport has no IATA code, so scheduled flights can't be looked up for it. Its airport details are shown above.
              </div>
            )}
            {details.flightsUnavailable && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex gap-2" role="status">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                Flight information is temporarily unavailable. The airport details above are still accurate.
              </div>
            )}
            {noFlights && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 flex gap-2" role="status">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                Airport found. No scheduled flights are currently available from the flight-data source.
              </div>
            )}

            {details.flightsSearchable && !details.flightsUnavailable && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {board('Departures', PlaneTakeoff, 'text-sky-600', details.departures, 'No departure flights currently scheduled.')}
                {board('Arrivals', PlaneLanding, 'text-emerald-600', details.arrivals, 'No arrival flights currently scheduled.')}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};
