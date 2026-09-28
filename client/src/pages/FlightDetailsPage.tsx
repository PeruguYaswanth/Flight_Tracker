import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightDetails } from '../components/FlightDetails';
import { FlightMap } from '../components/FlightMap';
import { TrackFlightButton } from '../components/TrackFlightButton';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { Flight } from '../types/flight';
import { FlightApiClient } from '../services/flightApi';
import { LiveFlightApiClient, LiveFlightPosition } from '../services/liveFlightApi';

const DETAILS_POLL_INTERVAL_MS = 60000;
const LIVE_POSITION_POLL_INTERVAL_MS = 60000;

type LivePhase = 'airborne' | 'not_departed' | 'landed' | 'cancelled';

/**
 * Whether a live aircraft position can exist right now, from the provider's
 * status and timestamps. A passed scheduled departure time alone does not
 * make a flight airborne.
 */
function getLivePhase(flight: Flight): LivePhase {
  if (flight.status === 'landed' || flight.arrival.actualTime) return 'landed';
  if (flight.status === 'cancelled') return 'cancelled';
  if (flight.status === 'active' || flight.departure.actualTime) return 'airborne';
  // Diverted aircraft may still be flying; with no status, let the live
  // providers decide rather than guessing.
  if (flight.status === 'diverted' || flight.status === 'unknown') return 'airborne';
  return 'not_departed';
}

const PHASE_MESSAGES: Record<Exclude<LivePhase, 'airborne'>, string> = {
  not_departed: 'The live aircraft position will appear once this flight departs.',
  landed: 'This flight has landed. Live position is only shown while the aircraft is airborne.',
  cancelled: 'This flight is cancelled, so there is no live aircraft position.',
};

export const FlightDetailsPage: React.FC = () => {
  const { flightNumber } = useParams<{ flightNumber: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const preloadedFlight = (location.state as { flight?: Flight } | null)?.flight;

  const [flight, setFlight] = useState<Flight | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [livePosition, setLivePosition] = useState<LiveFlightPosition | null>(null);
  const [isLoadingLivePosition, setIsLoadingLivePosition] = useState<boolean>(false);
  // Why there is no live position (no match, stale, provider failure...).
  const [liveUnavailableMessage, setLiveUnavailableMessage] = useState<string | null>(null);

  const flightDateRef = useRef<string | undefined>(undefined);
  // Route of the instance being shown, so refreshes return that same instance.
  const routeRef = useRef<{ depIata?: string; arrIata?: string }>({});

  // Flight details loading & polling
  useEffect(() => {
    if (!flightNumber) return;

    let cancelled = false;
    setErrorMessage(null);

    const load = async (isInitial: boolean) => {
      if (isInitial) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        const result = await FlightApiClient.getFlightDetails(flightNumber, flightDateRef.current, undefined, routeRef.current);
        if (cancelled) return;

        flightDateRef.current = result.flightDate;
        routeRef.current = { depIata: result.departure.iata, arrIata: result.arrival.iata };
        setFlight(result);
      } catch (err: any) {
        if (cancelled) return;

        if (isInitial) {
          setErrorMessage(err.message || 'Unable to retrieve flight information.');
        } else {
          console.warn('[FlightDetailsPage] Background flight-details refresh failed:', err.message);
        }
      } finally {
        if (cancelled) return;
        if (isInitial) setIsLoading(false);
      }
    };

    if (preloadedFlight) {
      flightDateRef.current = preloadedFlight.flightDate;
      routeRef.current = { depIata: preloadedFlight.departure.iata, arrIata: preloadedFlight.arrival.iata };
      setFlight(preloadedFlight);
      setIsLoading(false);
    } else {
      flightDateRef.current = undefined;
      routeRef.current = {};
      setFlight(null);
      load(true);
    }

    const intervalId = window.setInterval(() => load(false), DETAILS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightNumber]);

  // Live aircraft position. icao24 and callsign are hints; for a
  // codeshare the backend looks the aircraft up by the operating flight.
  const icao24 = flight?.aircraft?.icao24 || null;
  const callsign = flight?.flightIcao || null;
  const operatingFlightNumber = flight?.operatingFlightIata || null;
  const depIata = flight?.departure.iata || null;
  const arrIata = flight?.arrival.iata || null;
  const livePhase = flight ? getLivePhase(flight) : null;

  useEffect(() => {
    setLivePosition(null);
    setLiveUnavailableMessage(null);

    // Wait for the flight, and only look up flights that can be airborne -
    // no provider calls for flights that haven't departed or have finished.
    if (!flightNumber || !livePhase) {
      setIsLoadingLivePosition(false);
      return;
    }
    if (livePhase !== 'airborne') {
      setIsLoadingLivePosition(false);
      setLiveUnavailableMessage(PHASE_MESSAGES[livePhase]);
      return;
    }

    let cancelled = false;

    const loadPosition = async (isInitial: boolean) => {
      setIsLoadingLivePosition(isInitial);

      try {
        const result = await LiveFlightApiClient.getLivePosition(flightNumber, {
          callsign,
          icao24,
          operatingFlightNumber,
          depIata,
          arrIata,
        });
        if (cancelled) return;
        // No position means no marker - a previous fix is never kept on
        // screen as if it were still current. The route still renders.
        setLivePosition(result.available ? result.position : null);
        setLiveUnavailableMessage(result.available ? null : result.message);
      } finally {
        if (!cancelled) setIsLoadingLivePosition(false);
      }
    };

    loadPosition(true);
    const intervalId = window.setInterval(() => loadPosition(false), LIVE_POSITION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [icao24, callsign, flightNumber, operatingFlightNumber, depIata, arrIata, livePhase]);

  // Memoized flight object for FlightMap
  const flightForMap: Flight | null = useMemo(() => {
    if (!flight) return null;
    return {
      ...flight,
      live: livePosition
        ? {
            latitude: livePosition.latitude,
            longitude: livePosition.longitude,
            altitude: livePosition.altitude,
            heading: livePosition.heading,
            speed: livePosition.speed,
            isGround: livePosition.isGround,
            updatedAt: livePosition.updatedAt,
            source: livePosition.source,
            callsign: livePosition.callsign,
            icao24: livePosition.icao24,
          }
        : null,
      hasLiveTracking: Boolean(livePosition),
    };
  }, [flight, livePosition]);

  return (
    <Layout headerProps={{ showLiveStatus: true, lastUpdated: flight?.lastUpdated }}>
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Back navigation + tracking */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-700 transition-colors py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Flight Results</span>
          </button>
          {!isLoading && !errorMessage && flight && <TrackFlightButton flight={flight} />}
        </div>

        {isLoading && <LoadingState message="Loading flight information and tracking telemetry..." />}

        {!isLoading && errorMessage && (
          <div className="space-y-4">
            <ErrorState message={errorMessage} onRetry={() => navigate(0)} />
            <div className="text-center">
              <button
                onClick={() => navigate('/flight-status')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-sm transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Flight Search
              </button>
            </div>
          </div>
        )}

        {!isLoading && !errorMessage && !flight && (
          <EmptyState type="no-results" customMessage="No flight information available." />
        )}

        {!isLoading && !errorMessage && flight && flightForMap && (
          <div className="space-y-6">
            {/* Live Telemetry Indicator Bar */}
            {isLoadingLivePosition && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs flex items-center justify-between text-xs">
                <span className="text-sky-700 font-semibold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  Connecting to live ADS-B data...
                </span>
              </div>
            )}

            {/* Interactive Flight Radar Map */}
            <FlightMap selectedFlight={flightForMap} liveUnavailableMessage={liveUnavailableMessage} />

            {/* Structured Flight Details Cards */}
            <FlightDetails flight={flight} />
          </div>
        )}
      </div>
    </Layout>
  );
};
