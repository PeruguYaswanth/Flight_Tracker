import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { Flight } from '../types/flight';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const FINAL_STATUSES = ['landed', 'cancelled', 'diverted'];

interface TrackFlightButtonProps {
  flight: Flight;
}

/**
 * Track / stop tracking the exact flight instance shown (number + date +
 * route). Signed-out users are sent to login and brought back here.
 */
export const TrackFlightButton: React.FC<TrackFlightButtonProps> = ({ flight }) => {
  const { isAuthenticated } = useAuth();
  const { getTrackedFor, trackFlight, untrackFlight } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tracked = isAuthenticated ? getTrackedFor(flight) : undefined;
  const isFinal = FINAL_STATUSES.includes(flight.status);
  // A finished flight has nothing left to notify about, unless it is
  // already tracked (then it can still be removed).
  const disabled = pending || (!tracked && isFinal);

  const handleClick = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (tracked) await untrackFlight(tracked.id);
      else await trackFlight(flight);
    } catch (err: any) {
      setError(err.message || 'Unable to update tracking. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const Icon = pending ? Loader2 : tracked ? BellOff : Bell;
  const text = tracked ? 'Stop Tracking' : 'Track Flight';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {tracked && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            <BellRing className="w-3.5 h-3.5" /> Tracking
          </span>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-pressed={Boolean(tracked)}
          aria-label={tracked ? `Stop tracking ${flight.flightNumber}` : `Track ${flight.flightNumber} and get status notifications`}
          title={
            !tracked && isFinal
              ? 'This flight has already finished - there is nothing left to notify about.'
              : tracked
              ? 'Stop receiving notifications for this flight'
              : 'Get notified about departure, landing, delays and gate changes'
          }
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${
            tracked
              ? 'bg-white border border-slate-200 text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
              : 'bg-sky-600 hover:bg-sky-700 text-white border border-sky-600'
          }`}
        >
          <Icon className={`w-4 h-4 ${pending ? 'animate-spin' : ''}`} />
          {text}
        </button>
      </div>
      {error && (
        <p className="text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
