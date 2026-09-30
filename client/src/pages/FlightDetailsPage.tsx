import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

type LivePhase = 'airborne' | 'not_departed' | 'landed' | 'cancelled' | 'window_passed';

// Around the scheduled times, a flight without a reliable status may be flying.
const PRE_DEPARTURE_MARGIN_MS = 15 * 60 * 1000;
const POST_ARRIVAL_MARGIN_MS = 3 * 60 * 60 * 1000;

/**
 * Whether a live aircraft position can exist right now, from the provider's
 * status and timestamps. A passed scheduled departure time alone does not
 * make a flight airborne, and an unknown status is not treated as airborne:
 * it is only looked up while the clock is inside the flight's scheduled
 * window (departure to arrival, with margins for delays).
 */
function getLivePhase(flight: Flight, now: number = Date.now()): LivePhase {
  if (flight.status === 'landed' || flight.arrival.actualTime) return 'landed';
  if (flight.status === 'cancelled') return 'cancelled';
  if (flight.status === 'active' || flight.departure.actualTime) return 'airborne';
  if (flight.status === 'diverted' || flight.status === 'unknown') {
    const dep = Date.parse(flight.departure.estimatedTime || flight.departure.scheduledTime || '');
    const arr = Date.parse(flight.arrival.estimatedTime || flight.arrival.scheduledTime || '');
    if (!Number.isFinite(dep)) return 'window_passed';
    if (now < dep - PRE_DEPARTURE_MARGIN_MS) return 'not_departed';
    const end = Number.isFinite(arr) ? arr : dep + 18 * 60 * 60 * 1000;
    return now <= end + POST_ARRIVAL_MARGIN_MS ? 'airborne' : 'window_passed';
  }
  return 'not_departed';
}

const PHASE_MESSAGES: Record<Exclude<LivePhase, 'airborne'>, string> = {
  not_departed: 'The live aircraft position will appear once this flight departs.',
  landed: 'This flight has landed. Live position is only shown while the aircraft is airborne.',
  cancelled: 'This flight is cancelled, so there is no live aircraft position.',
  window_passed: 'Live position is not available: the scheduled flight time has passed and no live status was reported.',
};

export const FlightDetailsPage: React.FC = () => {
  const { flightNumber } = useParams<{ flightNumber: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Deep link: /flight/6E706?date=2026-09-30&dep=HYD&arr=DEL
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date') || undefined;
  const urlDep = searchParams.get('dep')?.toUpperCase() || undefined;
  const urlArr = searchParams.get('arr')?.toUpperCase() || undefined;

  const preloadedFlight = (location.state as { flight?: Flight } | null)?.flight;

  const [flight, setFlight] = useState<Flight | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [livePosition, setLivePosition] = useState<LiveFlightPosition | null>(null);
  const [isLoadingLivePosition, setIsLoadingLivePosition] = useState<boolean>(false);
  // Why there is no live position (no match, stale, provider failure...).
  const [liveUnavailableMessage, setLiveUnavailableMessage] = useState<string | null>(null);

  const flightDateRef = useRef<string | undefined>(undefined);
  // Latest flight for the polling callbacks (which outlive renders).
  const latestFlightRef = useRef<Flight | null>(null);
  latestFlightRef.current = flight;
  // Route of the instance being shown, so refreshes return that same instance.
  const routeRef = useRef<{ depIata?: string; arrIata?: string }>({});

  // Flight details loading & polling
  useEffect(() => {
    if (!flightNumber) return;

    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    setErrorMessage(null);

    const load = async (isInitial: boolean) => {
      if (inFlight) return;
      if (!isInitial) {
        // No background refresh while the tab is hidden, or once the flight is over.
        if (document.hidden) return;
        const phase = latestFlightRef.current ? getLivePhase(latestFlightRef.current) : null;
        if (phase === 'landed' || phase === 'cancelled') return;
      }
      inFlight = true;
      if (isInitial) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        const result = await FlightApiClient.getFlightDetails(flightNumber, flightDateRef.current, controller.signal, routeRef.current);
        if (cancelled) return;

        flightDateRef.current = result.flightDate;
        routeRef.current = { depIata: result.departure.iata, arrIata: result.arrival.iata };
        setFlight(result);
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') return;

        if (isInitial) {
          setErrorMessage(err.message || 'Unable to retrieve flight information.');
        } else {
          console.warn('[FlightDetailsPage] Background flight-details refresh failed:', err.message);
        }
      } finally {
        inFlight = false;
        if (!cancelled && isInitial) setIsLoading(false);
      }
    };

    if (preloadedFlight) {
      flightDateRef.current = preloadedFlight.flightDate;
      routeRef.current = { depIata: preloadedFlight.departure.iata, arrIata: preloadedFlight.arrival.iata };
      setFlight(preloadedFlight);
      setIsLoading(false);
    } else {
      // From the URL (refresh / shared link): that date's instance on that route.
      flightDateRef.current = urlDate;
      routeRef.current = { depIata: urlDep, arrIata: urlArr };
      setFlight(null);
      setIsLoading(true);
    }
    // Started on the next tick, so a mount that is immediately undone (React
    // StrictMode in development) never sends a duplicate request.
    const startId = window.setTimeout(() => {
      if (!preloadedFlight) load(true);
      // Airport boards send flights without route geometry: fetch it once.
      else if (preloadedFlight.route === undefined) load(false);
    }, 0);

    const intervalId = window.setInterval(() => load(false), DETAILS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightNumber, urlDate, urlDep, urlArr]);

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
    // One poller per flight: never two requests at once, aborted on leave.
    let inFlight = false;
    let lastPollAt = 0;
    const controller = new AbortController();

    const loadPosition = async (isInitial: boolean) => {
      if (inFlight) return;
      // No polling while the tab is hidden - it resumes on return.
      if (!isInitial && document.hidden) return;
      inFlight = true;
      lastPollAt = Date.now();
      setIsLoadingLivePosition(isInitial);

      try {
        const result = await LiveFlightApiClient.getLivePosition(
          flightNumber,
          { callsign, icao24, operatingFlightNumber, depIata, arrIata },
          controller.signal
        );
        if (cancelled) return;
        // No position means no marker - a previous fix is never kept on
        // screen as if it were still current. The route still renders.
        setLivePosition(result.available ? result.position : null);
        setLiveUnavailableMessage(result.available ? null : result.message);
      } catch (err: any) {
        if (err?.name !== 'AbortError') throw err;
      } finally {
        inFlight = false;
        if (!cancelled) setIsLoadingLivePosition(false);
      }
    };

    const onVisible = () => {
      if (!document.hidden && Date.now() - lastPollAt >= LIVE_POSITION_POLL_INTERVAL_MS) loadPosition(false);
    };

    const startId = window.setTimeout(() => loadPosition(true), 0);
    const intervalId = window.setInterval(() => loadPosition(false), LIVE_POSITION_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
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
            <FlightDetails flight={flightForMap} />
          </div>
        )}
      </div>
    </Layout>
  );
};
