import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellOff, Check, Copy, Loader2, LogOut, Mail, PlaneTakeoff } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightStatusBadge } from '../components/FlightStatusBadge';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { formatDisplayName, formatEmail, getInitials } from '../utils/formatUser';
import { flightDetailsPath } from '../utils/flightLinks';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const { trackedFlights, untrackFlight } = useNotifications();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [untrackingId, setUntrackingId] = useState<string | null>(null);
  const [trackedError, setTrackedError] = useState<string | null>(null);

  const name = formatDisplayName(user?.name);
  const email = formatEmail(user?.email);
  // The ID is shown exactly as stored - never reformatted.
  const userId = user?.id ?? '';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - the ID is still selectable.
    }
  };

  const handleUntrack = async (id: string) => {
    setUntrackingId(id);
    setTrackedError(null);
    try {
      await untrackFlight(id);
    } catch (err: any) {
      setTrackedError(err.message || 'Unable to stop tracking. Please try again.');
    } finally {
      setUntrackingId(null);
    }
  };

  const details: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Name', value: <span className="font-semibold text-slate-900 break-words">{name}</span> },
    { label: 'Email', value: <span className="font-semibold text-slate-900 break-all">{email}</span> },
    {
      label: 'User ID',
      value: (
        <span className="flex items-start gap-2 min-w-0">
          <code className="font-mono text-[13px] text-slate-800 break-all select-all">{userId}</code>
          <button
            type="button"
            onClick={copyId}
            className="shrink-0 p-1 -mt-0.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label={copied ? 'User ID copied' : 'Copy user ID'}
            title={copied ? 'Copied' : 'Copy user ID'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </span>
      ),
    },
    {
      label: 'Account Status',
      value: (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Active
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 pt-8 sm:pt-12 space-y-5">
        {/* Identity */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-sky-600 text-white flex items-center justify-center text-lg font-black shadow-sm" aria-hidden="true">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 break-words">{name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5 min-w-0">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="break-all">{email}</span>
            </p>
          </div>
        </div>

        {/* Account details */}
        <section aria-labelledby="account-details-title" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm">
          <h2 id="account-details-title" className="text-sm font-bold text-slate-900 px-5 sm:px-6 pt-5">
            Account details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100 border-t border-slate-100 mt-4 rounded-b-2xl overflow-hidden">
            {details.map(({ label, value }) => (
              <div key={label} className="bg-white px-5 sm:px-6 py-4 min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Tracked flights */}
        <section aria-labelledby="tracked-flights-title" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 px-5 sm:px-6 pt-5">
            <h2 id="tracked-flights-title" className="text-sm font-bold text-slate-900">
              My tracked flights
            </h2>
            <span className="text-xs text-slate-500">Alerts appear under the bell in the header</span>
          </div>

          {trackedError && (
            <p className="mx-5 sm:mx-6 mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
              {trackedError}
            </p>
          )}

          {trackedFlights.length === 0 ? (
            <div className="flex flex-col items-center text-center px-6 py-10">
              <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                <PlaneTakeoff className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-800">You're not tracking any flights yet.</p>
              <p className="text-xs text-slate-500 mt-1">Open a flight and choose “Track Flight” to follow it here.</p>
              <Link
                to="/flight-status"
                className="mt-4 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
              >
                Search Flights
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 mt-3">
              {trackedFlights.map((t) => (
                <li key={t.id} className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-black text-slate-900">{t.flightNumber}</span>
                      {t.operatingFlightIata && (
                        <span className="text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          Operated as {t.operatingFlightIata}
                        </span>
                      )}
                      <FlightStatusBadge status={t.lastStatus} size="sm" />
                    </div>
                    <p className="text-xs text-slate-600 mt-1 break-words">
                      {t.originCity || t.origin} <span className="font-mono text-slate-400">({t.origin})</span> →{' '}
                      {t.destinationCity || t.destination} <span className="font-mono text-slate-400">({t.destination})</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {[t.airline, t.flightDate, t.completed ? 'Tracking complete' : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:shrink-0">
                    <Link
                      to={flightDetailsPath(t.flightNumber, { date: t.flightDate, dep: t.origin, arr: t.destination })}
                      className="flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                    >
                      View Flight
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleUntrack(t.id)}
                      disabled={untrackingId === t.id}
                      aria-label={`Stop tracking ${t.flightNumber}`}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      {untrackingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                      Stop Tracking
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          onClick={handleLogout}
          className="w-full sm:w-auto sm:px-6 flex items-center justify-center gap-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-semibold py-2.5 rounded-xl transition-all text-sm shadow-2xs"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </Layout>
  );
};
