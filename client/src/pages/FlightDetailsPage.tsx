import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightDetails } from '../components/FlightDetails';
import { FlightMap } from '../components/FlightMap';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { Flight } from '../types/flight';
import { FlightApiClient } from '../services/flightApi';
import { LiveFlightApiClient, LiveFlightPosition } from '../services/liveFlightApi';

// Aviationstack flight-details refresh (status/schedule/gate) - unrelated
// to live position, kept at a relaxed cadence since these fields change
// slowly.
const DETAILS_POLL_INTERVAL_MS = 60000;

// Live aircraft position now comes from a separate provider (OpenSky
// Network, see server/src/services/liveFlightService.ts) with a much
// stricter anonymous quota (~400 requests/day). 60s matches the backend's
// cache TTL so repeated polls mostly hit the server-side cache instead of
// hammering the upstream provider.
const LIVE_POSITION_POLL_INTERVAL_MS = 60000;

function describePositionRefreshError(code?: string): string {
  if (code === 'RATE_LIMIT_EXCEEDED') {
    return 'Live position temporarily unavailable due to API limits.';
  }
  if (code === 'SERVICE_TIMEOUT') {
    return 'Unable to retrieve live flight position. Please try again.';
  }
  return 'Unable to retrieve live flight position. Please try again.';
}

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
  const [livePositionError, setLivePositionError] = useState<string | null>(null);

  // Keep polling the same day's instance of this flight number for the
  // Aviationstack details refresh, even after `flight` state is replaced.
  const flightDateRef = useRef<string | undefined>(undefined);

  // --- Flight details (Aviationstack) - unchanged source, relaxed polling ---
  useEffect(() => {
    if (!flightNumber) return;

    let cancelled = false;

    // Reset for the newly-selected flight up front. Without this, switching
    // from one /flight/:flightNumber to another without an unmount (React
    // Router re-renders the same instance on a param change) would keep
    // showing the PREVIOUS flight's stale data.
    setErrorMessage(null);

    const load = async (isInitial: boolean) => {
      if (isInitial) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        const result = await FlightApiClient.getFlightDetails(flightNumber, flightDateRef.current);
        if (cancelled) return;

        flightDateRef.current = result.flightDate;
        setFlight(result);
      } catch (err: any) {
        if (cancelled) return;

        if (isInitial) {
          setErrorMessage(err.message || 'Unable to retrieve flight information.');
        } else {
          // A background refresh failure should not blow away the page or
          // the last known flight data.
          console.warn('[FlightDetailsPage] Background flight-details refresh failed:', err.message);
        }
      } finally {
        if (cancelled) return;
        if (isInitial) setIsLoading(false);
      }
    };

    if (preloadedFlight) {
      // Already have this exact flight from search results - use it
      // immediately instead of refetching, then poll for status updates.
      flightDateRef.current = preloadedFlight.flightDate;
      setFlight(preloadedFlight);
      setIsLoading(false);
    } else {
      flightDateRef.current = undefined;
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

  // --- Live aircraft position (OpenSky, separate from AirLabs) ---
  // Keyed on the aircraft's real ICAO24/hex (preferred, from AirLabs'
  // `hex` field - already present on `flight`, no extra AirLabs request)
  // and the ICAO callsign as a fallback identifier. Stops the previous
  // flight's polling and starts fresh whenever either changes (including
  // to/from "no identifier available").
  const icao24 = flight?.aircraft?.icao24 || null;
  const icaoCallsign = flight?.flightIcao || null;
  // The actual operating carrier's flight number when this is a codeshare
  // (e.g. Qantas-marketed QF8786 operated by IndiGo as 6E6202) - lets the
  // backend try resolving the physical aircraft's identity under its real
  // operator when the marketing flight number has none of its own.
  const operatingFlightNumber = flight?.operatingFlightIata || null;

  useEffect(() => {
    setLivePosition(null);
    setLivePositionError(null);

    if ((!icao24 && !icaoCallsign) || !flightNumber) {
      setIsLoadingLivePosition(false);
      return;
    }

    let cancelled = false;

    const loadPosition = async (isInitial: boolean) => {
      setIsLoadingLivePosition(isInitial);

      try {
        const position = await LiveFlightApiClient.getLivePosition(flightNumber, icaoCallsign, icao24, operatingFlightNumber);
        if (cancelled) return;
        setLivePosition(position);
        setLivePositionError(null);
      } catch (err: any) {
        if (cancelled) return;
        if (err.code === 'LIVE_POSITION_UNAVAILABLE') {
          // Normal outcome - flight isn't currently ADS-B tracked. The
          // existing FlightMap banner already communicates this; no need
          // for a separate error message.
          setLivePosition(null);
          setLivePositionError(null);
        } else {
          setLivePositionError(describePositionRefreshError(err.code));
        }
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
  }, [icao24, icaoCallsign, flightNumber, operatingFlightNumber]);

  // Feed the OpenSky position into the EXISTING, unmodified FlightMap by
  // shaping it as the `live` field it already knows how to render - the
  // map component itself is untouched. Memoized on [flight, livePosition]
  // so FlightMap only re-runs its redraw/fitBounds effect when the actual
  // flight or position data changes, not on every render of this page
  // (e.g. the loading-indicator toggling).
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
          }
        : null,
      hasLiveTracking: Boolean(livePosition),
    };
  }, [flight, livePosition]);

  return (
    <Layout>
      <div className="max-w-5xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Flight Results
        </button>

        {isLoading && <LoadingState message="Loading flight details..." />}

        {!isLoading && errorMessage && (
          <div className="space-y-3">
            <ErrorState message="Unable to load flight details. Please try again." onRetry={() => navigate(0)} />
            <div className="text-center">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Flight Results
              </button>
            </div>
          </div>
        )}

        {!isLoading && !errorMessage && !flight && (
          <EmptyState type="no-results" customMessage="No flight information available." />
        )}

        {!isLoading && !errorMessage && flight && flightForMap && (
          <>
            {(isLoadingLivePosition || livePositionError) && (
              <div className="flex items-center gap-2 text-xs">
                {isLoadingLivePosition ? (
                  <span className="text-cyan-400 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading live aircraft position...
                  </span>
                ) : (
                  <span className="text-amber-400">{livePositionError}</span>
                )}
              </div>
            )}
            <FlightMap selectedFlight={flightForMap} />
            <FlightDetails flight={flight} />
          </>
        )}
      </div>
    </Layout>
  );
};
