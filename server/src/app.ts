import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { getDb } from './config/database';
import flightRoutes from './routes/flightRoutes';
import authRoutes from './routes/authRoutes';
import airportRoutes from './routes/airportRoutes';
import liveFlightRoutes from './routes/liveFlightRoutes';
import notificationRoutes from './routes/notificationRoutes';
import trackedFlightRoutes from './routes/trackedFlightRoutes';

const app = express();
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Avoid interfering with frontend map tile loads if served statically
}));

// CORS. Sessions use a cookie, so cross-origin requests carry credentials:
// only origins listed in CORS_ORIGIN (comma-separated) are answered with
// Access-Control-Allow-Origin + Allow-Credentials. "*" keeps public API
// reads open to any origin but never with credentials.
const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
const anyOrigin = allowedOrigins.includes('*');
app.use(cors((req, callback) => {
  const origin = (req.headers.origin || '').replace(/\/+$/, '');
  const listed = Boolean(origin) && allowedOrigins.includes(origin);
  callback(null, {
    origin: listed ? origin : anyOrigin ? '*' : false,
    credentials: listed,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
}));
if (anyOrigin && !config.isDev) {
  console.warn('[Flight Tracker Server] CORS_ORIGIN is "*": set it to the frontend URL (e.g. https://your-app.vercel.app) so a cross-site frontend can use sign-in cookies.');
}

// CSRF: every state-changing request must carry X-Requested-With. A
// cross-site form or image can't send custom headers, and a cross-origin
// script can only after a CORS preflight, which only allowed origins pass.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.headers['x-requested-with']) return next();
  res.status(403).json({ success: false, error: { code: 'CSRF_CHECK_FAILED', message: 'This request was blocked for security reasons. Please reload the page and try again.' } });
});

// Rate limiter - protect from abuse while allowing smooth user experience
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Flight-data service request limit reached. Please try again later.',
    },
  },
});

// Stricter limiter for auth endpoints to slow down credential-guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts. Please try again later.',
    },
  },
});

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Flight Tracker API',
  });
});

// Flight tracking routes with rate limiting
app.use('/api/flights', apiLimiter, flightRoutes);

// Airport reference & departures/arrivals (reuses the flight search integration)
app.use('/api/airports', apiLimiter, airportRoutes);

// Authentication (MongoDB users/sessions; session token in an HttpOnly cookie)
// The strict limiter guards the credential endpoints only; the session
// check (/me, run on every page load) and logout use the general limit, so
// normal browsing never looks like a logout.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', apiLimiter, authRoutes);

// Live aircraft position - separate provider (OpenSky Network) from
// Aviationstack. Tighter limiter: OpenSky's anonymous tier only allows
// ~400 requests/day per IP, and liveFlightService caches upstream
// snapshots for 30s on top of this to conserve that quota further.
const liveFlightLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Live position request limit reached. Please try again later.',
    },
  },
});
app.use('/api/live-flights', liveFlightLimiter, liveFlightRoutes);

// Flight notifications & tracked flights (per-user, requires login). The
// client polls roughly every 90s; tracked-flight checks reuse the cached
// AirLabs search, so this limiter is about request volume, not quota.
const notificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Notification request limit reached. Please try again later.',
    },
  },
});
app.use('/api/notifications', notificationLimiter, notificationRoutes);
app.use('/api/tracked-flights', notificationLimiter, trackedFlightRoutes);

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    },
  });
});

// Centralized error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Malformed JSON body (express.json): a client error, not a crash.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
    return;
  }
  const rawStatus = Number(err?.statusCode || err?.status);
  const statusCode = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  // Only errors this app raised on purpose (they carry a string code) keep
  // their message; anything else is an internal failure whose details
  // (JS errors, provider internals) stay in the server log.
  const deliberate = typeof err?.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(err.code) && Number.isInteger(rawStatus);
  if (!deliberate || statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.path} -> ${statusCode}${deliberate ? ` ${err.code}` : ''}: ${err?.message}`);
  }
  res.status(statusCode).json({
    success: false,
    error: {
      code: deliberate ? err.code : 'INTERNAL_SERVER_ERROR',
      message: deliberate && err.message ? err.message : 'Something went wrong on our side. Please try again later.',
    },
  });
});

// Start listening if not imported as module
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[Flight Tracker Server] Running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[Flight Tracker Server] AirLabs API key configured: ${Boolean(config.airLabsApiKey)}`);
    console.log(`[Flight Tracker Server] AirLabs base URL: ${config.airLabsApiBaseUrl}`);
    console.log(`[Flight Tracker Server] OpenSky OAuth2 credentials configured: ${Boolean(config.openskyClientId && config.openskyClientSecret)}`);
  });
  // Connect account storage at startup so a misconfiguration is visible
  // immediately. Flight features work regardless; account endpoints answer
  // 503 until the database is reachable (retried on each request).
  getDb().catch((err) => {
    console.error(`[Database] MongoDB connected: false | ${err.code === 'DATABASE_NOT_CONFIGURED' ? 'MONGODB_URI is not set' : err.message}`);
  });
}

export default app;
