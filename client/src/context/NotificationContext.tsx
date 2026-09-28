import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Flight } from '../types/flight';
import { FlightNotification, TrackedFlight } from '../types/notification';
import { NotificationApiClient } from '../services/notificationApi';

// Matches the existing 60s details/live-position cadence without adding
// to it: the server only re-checks a tracked flight every ~2 min, through
// the cached AirLabs search.
const NOTIFICATION_POLL_INTERVAL_MS = 90_000;
const DESKTOP_OPT_IN_KEY = 'aerotrack_desktop_notifications';
const UPDATE_ERROR = 'Unable to update notifications. Please try again.';

export type DesktopPermission = NotificationPermission | 'unsupported';

interface NotificationContextValue {
  notifications: FlightNotification[];
  trackedFlights: TrackedFlight[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  getTrackedFor: (flight: Flight) => TrackedFlight | undefined;
  trackFlight: (flight: Flight) => Promise<void>;
  untrackFlight: (trackedId: string) => Promise<void>;
  desktopPermission: DesktopPermission;
  desktopEnabled: boolean;
  enableDesktopNotifications: () => Promise<void>;
  disableDesktopNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function readDesktopOptIn(): boolean {
  try {
    return localStorage.getItem(DESKTOP_OPT_IN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDesktopOptIn(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(DESKTOP_OPT_IN_KEY, '1');
    else localStorage.removeItem(DESKTOP_OPT_IN_KEY);
  } catch {
    // Opt-in just won't persist across reloads.
  }
}

function currentPermission(): DesktopPermission {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<FlightNotification[]>([]);
  const [trackedFlights, setTrackedFlights] = useState<TrackedFlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermission>(currentPermission);
  const [desktopEnabled, setDesktopEnabled] = useState<boolean>(readDesktopOptIn);

  // Ids already seen by this tab - null until the first load, so existing
  // notifications are never replayed as desktop popups after a reload.
  const seenIdsRef = useRef<Set<string> | null>(null);
  const lastLoadRef = useRef(0);
  const desktopRef = useRef({ enabled: desktopEnabled, permission: desktopPermission });
  desktopRef.current = { enabled: desktopEnabled, permission: desktopPermission };

  const showDesktop = useCallback((items: FlightNotification[]) => {
    const { enabled, permission } = desktopRef.current;
    if (!enabled || permission !== 'granted') return;
    items.forEach((n) => {
      try {
        const popup = new Notification(`${n.flightNumber} · ${n.title}`, { body: n.message, tag: n.id });
        popup.onclick = () => {
          window.focus();
          navigate(`/flight/${encodeURIComponent(n.flightNumber)}`);
          popup.close();
        };
      } catch {
        // Some browsers (e.g. Android Chrome) only allow service-worker
        // notifications; the in-app list still has it.
      }
    });
  }, [navigate]);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!token) return;
    if (showSpinner) setIsLoading(true);
    lastLoadRef.current = Date.now();
    // Settled independently: a failing notifications endpoint must not hide
    // which flights are tracked (and vice versa).
    const [payloadResult, trackedResult] = await Promise.allSettled([
      NotificationApiClient.getNotifications(token),
      NotificationApiClient.getTrackedFlights(token),
    ]);

    if (payloadResult.status === 'fulfilled') {
      const { notifications: latest } = payloadResult.value;
      const seen = seenIdsRef.current;
      if (seen) {
        showDesktop(latest.filter((n) => !n.read && !seen.has(n.id)));
      }
      seenIdsRef.current = new Set(latest.map((n) => n.id));
      setNotifications(latest);
    }
    if (trackedResult.status === 'fulfilled') {
      setTrackedFlights(trackedResult.value);
    }

    const failure = [payloadResult, trackedResult].find((r): r is PromiseRejectedResult => r.status === 'rejected');
    setError(failure ? (failure.reason?.status === 401 ? 'Your session has expired. Please sign in again.' : UPDATE_ERROR) : null);
    if (showSpinner) setIsLoading(false);
  }, [token, showDesktop]);

  useEffect(() => {
    setNotifications([]);
    setTrackedFlights([]);
    setError(null);
    seenIdsRef.current = null;
    if (!token) return;

    load(true);
    const interval = window.setInterval(() => {
      if (!document.hidden) load(false);
    }, NOTIFICATION_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoadRef.current >= NOTIFICATION_POLL_INTERVAL_MS) load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, load]);

  const refresh = useCallback(() => load(true), [load]);

  const markRead = useCallback(async (id: string) => {
    if (!token) return;
    const before = notifications;
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await NotificationApiClient.markRead(token, id);
    } catch {
      setNotifications(before);
      setError(UPDATE_ERROR);
    }
  }, [token, notifications]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    const before = notifications;
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    try {
      await NotificationApiClient.markAllRead(token);
    } catch {
      setNotifications(before);
      setError(UPDATE_ERROR);
    }
  }, [token, notifications]);

  const removeNotification = useCallback(async (id: string) => {
    if (!token) return;
    const before = notifications;
    setNotifications((list) => list.filter((n) => n.id !== id));
    try {
      await NotificationApiClient.deleteNotification(token, id);
    } catch {
      setNotifications(before);
      setError(UPDATE_ERROR);
    }
  }, [token, notifications]);

  const getTrackedFor = useCallback(
    (flight: Flight) => trackedFlights.find((t) => t.flightKey === flight.id),
    [trackedFlights]
  );

  // Track/untrack errors are thrown to the caller, which shows them inline.
  const trackFlight = useCallback(async (flight: Flight) => {
    if (!token) throw new Error('Please sign in to track flights.');
    const tracked = await NotificationApiClient.trackFlight(token, {
      flightNumber: flight.flightNumber,
      flightDate: flight.flightDate,
      depIata: flight.departure.iata,
      arrIata: flight.arrival.iata,
    });
    setTrackedFlights((list) => (list.some((t) => t.id === tracked.id) ? list : [...list, tracked]));
  }, [token]);

  const untrackFlight = useCallback(async (trackedId: string) => {
    if (!token) return;
    await NotificationApiClient.untrackFlight(token, trackedId);
    setTrackedFlights((list) => list.filter((t) => t.id !== trackedId));
  }, [token]);

  // Permission is only ever requested from this explicit user action, and
  // only while the browser still says "default" - never on page load and
  // never again after the user has answered.
  const enableDesktopNotifications = useCallback(async () => {
    const permission = currentPermission();
    if (permission === 'unsupported' || permission === 'denied') {
      setDesktopPermission(permission);
      return;
    }
    const result = permission === 'granted' ? permission : await Notification.requestPermission();
    setDesktopPermission(result);
    const enabled = result === 'granted';
    setDesktopEnabled(enabled);
    writeDesktopOptIn(enabled);
  }, []);

  const disableDesktopNotifications = useCallback(() => {
    setDesktopEnabled(false);
    writeDesktopOptIn(false);
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    trackedFlights,
    unreadCount: notifications.filter((n) => !n.read).length,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    removeNotification,
    getTrackedFor,
    trackFlight,
    untrackFlight,
    desktopPermission,
    desktopEnabled,
    enableDesktopNotifications,
    disableDesktopNotifications,
  }), [
    notifications, trackedFlights, isLoading, error, refresh, markRead, markAllRead, removeNotification,
    getTrackedFor, trackFlight, untrackFlight, desktopPermission, desktopEnabled,
    enableDesktopNotifications, disableDesktopNotifications,
  ]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
