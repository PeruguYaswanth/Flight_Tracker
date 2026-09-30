import dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root or server folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Session cookie. The frontend (e.g. Vercel) and API (e.g. Render) are
  // different sites in production, which needs SameSite=None + Secure;
  // local development is same-site through the Vite proxy (Lax).
  cookieSameSite: ((): 'Lax' | 'Strict' | 'None' => {
    const v = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
    if (v === 'lax') return 'Lax';
    if (v === 'strict') return 'Strict';
    if (v === 'none') return 'None';
    return (process.env.NODE_ENV || 'development') === 'production' ? 'None' : 'Lax';
  })(),
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : (process.env.NODE_ENV || 'development') === 'production',
  // Flight search/details provider (AirLabs). Aviationstack is no longer
  // used anywhere in this app.
  airLabsApiKey: process.env.AIRLABS_API_KEY || '',
  airLabsApiBaseUrl: process.env.AIRLABS_BASE_URL || 'https://airlabs.co/api/v9',
  // Separate live-position provider (OpenSky Network). Falls back to
  // anonymous access (no credentials, ~400 requests/day) when
  // OPENSKY_CLIENT_ID/SECRET are not set; a registered OAuth2 client
  // raises that to ~4000 requests/day.
  liveFlightApiBaseUrl: process.env.LIVE_FLIGHT_API_BASE_URL || process.env.OPENSKY_API_BASE_URL || 'https://opensky-network.org/api',
  openskyClientId: process.env.OPENSKY_CLIENT_ID || '',
  openskyClientSecret: process.env.OPENSKY_CLIENT_SECRET || '',
  openskyAuthUrl: process.env.OPENSKY_AUTH_URL || 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),
  // Account storage. Users and sessions live in MongoDB so they survive
  // restarts; without MONGODB_URI the account endpoints report that account
  // storage is unavailable (there is deliberately no in-memory fallback).
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'flight_tracker',
  sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS || '30', 10),
  // When OpenSky has no state for an aircraft, AirLabs' position for the
  // same hex is used - but only from a lookup at most this old, so a cached
  // record is never shown as the current position.
  airLabsPositionMaxAgeMs: parseInt(process.env.AIRLABS_POSITION_MAX_AGE_MS || '120000', 10),
  // A position fix older than this is not shown as the aircraft's current
  // location. Airborne ADS-B fixes are normally seconds old; 5 minutes
  // tolerates sparse receiver coverage without passing off old positions.
  livePositionMaxAgeSeconds: parseInt(process.env.LIVE_POSITION_MAX_AGE_SECONDS || '300', 10),
  // AirLabs is only a live-position fallback. After it had nothing usable
  // for a flight, it isn't asked again for that flight for this long.
  airLabsFallbackCooldownMs: parseInt(process.env.AIRLABS_FALLBACK_COOLDOWN_MS || '300000', 10),
  // Flight notifications. A tracked flight is re-checked at most this often,
  // and only when its owner's client polls - the check goes through
  // flightService's existing 10-minute AirLabs cache, so it adds no
  // upstream calls inside that window.
  trackedFlightCheckIntervalMs: parseInt(process.env.TRACKED_FLIGHT_CHECK_INTERVAL_MS || '120000', 10),
  // Departure/arrival estimate shifts smaller than this are ignored, so
  // provider jitter (14:00 -> 14:02) never becomes a notification.
  notifyTimeChangeThresholdMinutes: parseInt(process.env.NOTIFY_TIME_CHANGE_THRESHOLD_MINUTES || '15', 10),
  maxTrackedFlightsPerUser: parseInt(process.env.MAX_TRACKED_FLIGHTS_PER_USER || '20', 10),
  maxNotificationsPerUser: parseInt(process.env.MAX_NOTIFICATIONS_PER_USER || '100', 10),
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
