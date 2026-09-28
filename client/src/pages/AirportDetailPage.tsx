import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PlaneTakeoff, PlaneLanding, Building2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { FlightCard } from '../components/FlightCard';
import { AirportApiClient } from '../services/airportApi';
import { AirportDetails } from '../types/airport';
import { Flight } from '../types/flight';

export const AirportDetailPage: React.FC = () => {
  const { airportCode } = useParams<{ airportCode: string }>();
  const navigate = useNavigate();

  const [details, setDetails] = useState<AirportDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!airportCode) return;
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    AirportApiClient.getAirportDetails(airportCode, controller.signal)
      .then(setDetails)
      .catch((err: any) => {
        if (err.name !== 'AbortError') {
          setErrorMessage(err.message || 'Unable to load airport information.');
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [airportCode]);

  const goToFlight = (flight: Flight) => {
    navigate(`/flight/${encodeURIComponent(flight.flightNumber)}`, { state: { flight } });
  };

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

        {isLoading && <LoadingState message="Loading airport schedule data..." />}

        {!isLoading && errorMessage && <ErrorState message={errorMessage} />}

        {!isLoading && !errorMessage && details && (
          <div className="space-y-6">
            {/* Header Airport Overview Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-bold shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded inline-block border border-sky-200">
                  {details.airport.iata}
                </div>
                <h1 className="text-2xl font-black text-slate-900">{details.airport.name}</h1>
                <p className="text-sm text-slate-600 font-medium">
                  {details.airport.city}, {details.airport.country} · Coords: {details.airport.lat.toFixed(4)}°, {details.airport.lng.toFixed(4)}°
                </p>
              </div>
            </div>

            {/* Departures and Arrivals Boards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Departures Column */}
              <section className="space-y-3">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <PlaneTakeoff className="w-4 h-4 text-sky-600" />
                    Departures ({details.departures.length})
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">Scheduled/Active</span>
                </div>

                <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                  {details.departures.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 font-medium">
                      No departure flights currently scheduled.
                    </div>
                  )}
                  {details.departures.map((flight) => (
                    <FlightCard key={flight.id} flight={flight} isSelected={false} onSelect={goToFlight} />
                  ))}
                </div>
              </section>

              {/* Arrivals Column */}
              <section className="space-y-3">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <PlaneLanding className="w-4 h-4 text-emerald-600" />
                    Arrivals ({details.arrivals.length})
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">Scheduled/Active</span>
                </div>

                <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                  {details.arrivals.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 font-medium">
                      No arrival flights currently scheduled.
                    </div>
                  )}
                  {details.arrivals.map((flight) => (
                    <FlightCard key={flight.id} flight={flight} isSelected={false} onSelect={goToFlight} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
