import dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root or server folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
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
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
