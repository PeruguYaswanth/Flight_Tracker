import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import flightRoutes from './routes/flightRoutes';
import authRoutes from './routes/authRoutes';
import airportRoutes from './routes/airportRoutes';
import liveFlightRoutes from './routes/liveFlightRoutes';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Avoid interfering with frontend map tile loads if served statically
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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

// Authentication (in-memory demo store, no database)
app.use('/api/auth', authLimiter, authRoutes);

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
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.message || 'Unable to retrieve flight information. Please try again later.';

  // In production, do not leak internal stack traces
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
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
}

export default app;
