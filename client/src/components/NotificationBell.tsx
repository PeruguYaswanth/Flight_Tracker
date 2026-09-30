import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  BellRing,
  Building2,
  Check,
  CheckCheck,
  Clock,
  DoorOpen,
  Info,
  Loader2,
  PlaneLanding,
  PlaneTakeoff,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { FlightNotification, NotificationEventType } from '../types/notification';
import { FlightStatusBadge } from './FlightStatusBadge';
import { flightDetailsPath, flightPathFromKey } from '../utils/flightLinks';

type Tab = 'alerts' | 'tracked';

const EVENT_ICONS: Partial<Record<NotificationEventType, { icon: React.ElementType; tone: string }>> = {
  DEPARTED: { icon: PlaneTakeoff, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  LANDED: { icon: PlaneLanding, tone: 'text-slate-700 bg-slate-100 border-slate-200' },
  CANCELLED: { icon: XCircle, tone: 'text-rose-700 bg-rose-50 border-rose-200' },
  DIVERTED: { icon: XCircle, tone: 'text-rose-700 bg-rose-50 border-rose-200' },
  DELAYED: { icon: Clock, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  DEPARTURE_DELAYED: { icon: Clock, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  ARRIVAL_DELAYED: { icon: Clock, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  DEPARTURE_TIME_CHANGED: { icon: Clock, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  ARRIVAL_TIME_CHANGED: { icon: Clock, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  DEPARTURE_GATE_CHANGED: { icon: DoorOpen, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  ARRIVAL_GATE_CHANGED: { icon: DoorOpen, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  DEPARTURE_TERMINAL_CHANGED: { icon: Building2, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  ARRIVAL_TERMINAL_CHANGED: { icon: Building2, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
};
const DEFAULT_ICON = { icon: Info, tone: 'text-sky-700 bg-sky-50 border-sky-200' };

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const iconButton =
  'p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-40 disabled:pointer-events-none';

export const NotificationBell: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    notifications,
    trackedFlights,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    removeNotification,
    untrackFlight,
    desktopPermission,
    desktopEnabled,
    enableDesktopNotifications,
    disableDesktopNotifications,
  } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('alerts');
  const [anchorTop, setAnchorTop] = useState(72);
  const [untrackingId, setUntrackingId] = useState<string | null>(null);
  const [trackedError, setTrackedError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Close when navigating (e.g. "View flight" from the panel).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setAnchorTop(Math.round(rect.bottom + 8));
    };
    place();
    panelRef.current?.focus();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const openNotification = (n: FlightNotification) => {
    if (!n.read) markRead(n.id);
    navigate(flightPathFromKey(n.flightNumber, n.flightKey));
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

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);
  const label = unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications';

  const renderAlerts = () => {
    if (isLoading && notifications.length === 0) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-sky-600" /> Loading notifications...
        </div>
      );
    }
    if (notifications.length === 0) {
      return (
        <div className="flex flex-col items-center text-center px-6 py-12">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
            <BellOff className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No new flight notifications.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
            Track a flight from its details page to get alerts for departures, landings, delays and gate changes.
          </p>
        </div>
      );
    }
    return (
      <ul className="divide-y divide-slate-100">
        {notifications.map((n) => {
          const { icon: Icon, tone } = EVENT_ICONS[n.eventType] || DEFAULT_ICON;
          return (
            <li key={n.id} className={`group relative flex gap-3 px-4 py-3 transition-colors ${n.read ? 'bg-white hover:bg-slate-50' : 'bg-sky-50/60 hover:bg-sky-50'}`}>
              {!n.read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-600" aria-hidden="true" />}
              <div className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center ${tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <button
                type="button"
                onClick={() => openNotification(n)}
                className="flex-1 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">{n.flightNumber}</span>
                  <span className={`text-sm truncate ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>{n.title}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  <time dateTime={n.timestamp} title={new Date(n.timestamp).toLocaleString()}>{timeAgo(n.timestamp)}</time>
                  {!n.read && <span className="sr-only"> · Unread</span>}
                </p>
              </button>
              <div className="flex flex-col gap-0.5 shrink-0">
                {!n.read && (
                  <button type="button" onClick={() => markRead(n.id)} className={iconButton} aria-label={`Mark ${n.flightNumber} notification as read`} title="Mark as read">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => removeNotification(n.id)} className={iconButton} aria-label={`Clear ${n.flightNumber} notification`} title="Clear notification">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderTracked = () => {
    if (trackedFlights.length === 0) {
      return (
        <div className="flex flex-col items-center text-center px-6 py-12">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
            <PlaneTakeoff className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-800">You're not tracking any flights yet.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-[260px]">Open a flight and choose “Track Flight” to follow it here.</p>
        </div>
      );
    }
    return (
      <>
        {trackedError && <p className="mx-4 mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">{trackedError}</p>}
        <ul className="divide-y divide-slate-100">
          {trackedFlights.map((t) => (
            <li key={t.id} className="px-4 py-3 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-black text-slate-900">{t.flightNumber}</span>
                    {t.operatingFlightIata && (
                      <span className="text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        Operated as {t.operatingFlightIata}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                    {t.originCity || t.origin} <span className="font-mono text-slate-400">({t.origin})</span> → {t.destinationCity || t.destination}{' '}
                    <span className="font-mono text-slate-400">({t.destination})</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.airline ? `${t.airline} · ` : ''}{t.flightDate}{t.completed ? ' · Tracking complete' : ''}
                  </p>
                </div>
                <FlightStatusBadge status={t.lastStatus} size="sm" className="shrink-0" />
              </div>
              <div className="flex gap-2">
                <Link
                  to={flightDetailsPath(t.flightNumber, { date: t.flightDate, dep: t.origin, arr: t.destination })}
                  className="flex-1 text-center px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                >
                  View Flight
                </Link>
                <button
                  type="button"
                  onClick={() => handleUntrack(t.id)}
                  disabled={untrackingId === t.id}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label={`Stop tracking ${t.flightNumber}`}
                >
                  {untrackingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                  Stop Tracking
                </button>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  };

  const renderDesktopControl = () => {
    if (desktopPermission === 'unsupported') {
      return <p className="text-[11px] text-slate-500">Desktop notifications aren't supported in this browser.</p>;
    }
    if (desktopPermission === 'denied') {
      return (
        <p className="text-[11px] text-slate-500">
          Desktop notifications are blocked in your browser settings. In-app alerts still work.
        </p>
      );
    }
    if (desktopEnabled && desktopPermission === 'granted') {
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5" /> Desktop notifications on
          </span>
          <button type="button" onClick={disableDesktopNotifications} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            Turn off
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={enableDesktopNotifications}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <BellRing className="w-3.5 h-3.5 text-sky-600" /> Enable Desktop Notifications
      </button>
    );
  };

  const panel = (
    <>
      <div className="fixed inset-0 z-[1990] bg-slate-900/30 sm:bg-transparent" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label="Notifications"
        tabIndex={-1}
        style={{ '--panel-top': `${anchorTop}px` } as React.CSSProperties}
        className="fixed z-[2000] inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[var(--panel-top)] sm:w-[400px] sm:max-h-[min(640px,calc(100vh-var(--panel-top)-16px))] sm:rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden focus:outline-none"
      >
        <div className="sm:hidden flex justify-center pt-2" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h2 className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-600" /> Notifications
          </h2>
          <div className="flex items-center gap-0.5">
            {isAuthenticated && (
              <>
                <button type="button" onClick={refresh} disabled={isLoading} className={iconButton} aria-label="Refresh notifications" title="Refresh">
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className={iconButton} aria-label="Mark all notifications as read" title="Mark all as read">
                  <CheckCheck className="w-4 h-4" />
                </button>
              </>
            )}
            <button type="button" onClick={close} className={iconButton} aria-label="Close notifications" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="flex flex-col items-center text-center px-6 pt-6 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-3">
              <BellRing className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Get alerts for the flights you care about</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[260px]">Sign in to track flights and be notified about departures, landings, delays and gate changes.</p>
            <div className="grid grid-cols-2 gap-2 mt-4 w-full max-w-[260px]">
              <Link to="/login" state={{ from: location }} className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                Login
              </Link>
              <Link to="/signup" className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white text-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1">
                Sign Up
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Notification views" className="flex gap-1 px-4 pb-2 border-b border-slate-100">
              {([
                ['alerts', `Alerts${unreadCount ? ` · ${unreadCount} new` : ''}`],
                ['tracked', `Tracked flights · ${trackedFlights.length}`],
              ] as Array<[Tab, string]>).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    tab === key ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>

            {error && (
              <div className="mx-4 mt-3 flex items-center justify-between gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
                <span>{error}</span>
                <button type="button" onClick={refresh} className="font-semibold underline underline-offset-2 hover:text-amber-950 shrink-0">
                  Retry
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain" role="tabpanel">
              {tab === 'alerts' ? renderAlerts() : renderTracked()}
            </div>

            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60">{renderDesktopControl()}</div>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
        aria-label={label}
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <Bell className="w-4 h-4" />
        {isAuthenticated && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );
};
