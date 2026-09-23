import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, PlaneTakeoff, PlaneLanding } from 'lucide-react';
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
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to airports
        </button>

        {isLoading && <LoadingState message="Loading airport information..." />}

        {!isLoading && errorMessage && <ErrorState message={errorMessage} />}

        {!isLoading && !errorMessage && details && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-cyan-400">{details.airport.iata}</div>
                <h1 className="text-xl font-bold text-white">{details.airport.name}</h1>
                <p className="text-sm text-slate-400">{details.airport.city}, {details.airport.country}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300 flex items-center gap-2">
                  <PlaneTakeoff className="w-4 h-4 text-cyan-400" />
                  Departures ({details.departures.length})
                </h2>
                <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                  {details.departures.length === 0 && (
                    <p className="text-xs text-slate-500">No departure information available.</p>
                  )}
                  {details.departures.map((flight) => (
                    <FlightCard key={flight.id} flight={flight} isSelected={false} onSelect={goToFlight} />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300 flex items-center gap-2">
                  <PlaneLanding className="w-4 h-4 text-emerald-400" />
                  Arrivals ({details.arrivals.length})
                </h2>
                <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                  {details.arrivals.length === 0 && (
                    <p className="text-xs text-slate-500">No arrival information available.</p>
                  )}
                  {details.arrivals.map((flight) => (
                    <FlightCard key={flight.id} flight={flight} isSelected={false} onSelect={goToFlight} />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};
