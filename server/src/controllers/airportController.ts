import { Request, Response, NextFunction } from 'express';
import { AIRPORT_COORDINATES } from '../services/airportsData';
import { AirportProviderFailure, flightService, mostSevereFailure } from '../services/flightService';
import { config } from '../config/environment';
import { Flight, SearchAirport } from '../types/flight';
import { collapseCodeshares } from '../services/currentFlightFilter';
import { airportTimeZone } from '../services/airportTimezones';

// Provider failure -> this API's response. The client shows a specific
// message for each; only real outages say "temporarily unavailable".
const FAILURE_RESPONSES: Record<AirportProviderFailure['kind'], { status: number; code: string; message: string }> = {
  INVALID_QUERY: { status: 400, code: 'INVALID_AIRPORT_QUERY', message: 'The airport data provider rejected this airport query.' },
  PROVIDER_AUTH_ERROR: { status: 502, code: 'AIRPORT_PROVIDER_AUTH_ERROR', message: 'The airport data provider rejected the API credentials configured on the server.' },
  PROVIDER_FORBIDDEN: { status: 502, code: 'AIRPORT_PROVIDER_FORBIDDEN', message: 'The airport data provider does not allow this request for the current plan.' },
  RATE_LIMITED: { status: 429, code: 'AIRPORT_PROVIDER_RATE_LIMITED', message: 'Airport data provider rate limit reached. Please try again later.' },
  PROVIDER_ERROR: { status: 502, code: 'AIRPORT_PROVIDER_ERROR', message: 'The airport data provider returned an error. Please try again.' },
  SERVICE_UNAVAILABLE: { status: 503, code: 'AIRPORT_SERVICE_UNAVAILABLE', message: 'The airport service is temporarily unavailable. Please try again.' },
};

const IATA = /^[A-Z0-9]{3}$/;
const ICAO = /^[A-Z0-9]{4}$/;

function localDirectory(): SearchAirport[] {
  return Object.values(AIRPORT_COORDINATES).map((a) => ({
    id: a.iata, iata: a.iata, icao: a.icao || null, name: a.name, city: a.city, country: a.country,
    lat: a.lat, lng: a.lng, timezone: airportTimeZone(a.iata), source: 'local' as const,
  }));
}

export class AirportController {
  /**
   * GET /api/airports            local reference airports + airports discovered from the provider
   * GET /api/airports?q=<text>   search by IATA/ICAO code, airport name, city or country
   *                              across the local table, discovered airports and AirLabs
   * meta.status: FOUND | NOT_FOUND | SERVICE_UNAVAILABLE (provider could not be asked)
   */
  public static async listAirports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) {
        const airports = [...localDirectory(), ...flightService.discoveredAirports()];
        res.json({ success: true, data: airports, total: airports.length, meta: { status: 'FOUND' } });
        return;
      }
      if (q.length > 80) {
        res.json({ success: true, data: [], total: 0, meta: { status: 'NOT_FOUND' } });
        return;
      }
      const { status, airports, failure } = await flightService.findAirports(q);
      res.json({
        success: true,
        data: airports,
        total: airports.length,
        // Provider code/message are passed on (never the API key) so the
        // real reason is visible; the UI maps `status` to its message.
        meta: { status, ...(failure ? { providerStatus: failure.httpStatus, providerCode: failure.code, providerMessage: failure.message } : {}) },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/airports/search?q=<text>
   * Flight-search autocomplete: airports with an IATA code (schedules are
   * indexed by IATA) - local reference table plus the flight-data provider.
   */
  public static async searchAirports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2 || q.length > 80) {
        res.json({ success: true, data: [] });
        return;
      }
      const { airports } = await flightService.searchAirports(q);
      res.json({ success: true, data: airports });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/airports/resolve?q=<text>
   * One airport for what the user typed (IATA, ICAO, city or airport name):
   * { status: FOUND, airport } | { status: AMBIGUOUS, airports } |
   * { status: NOT_FOUND } | { status: UNVERIFIED } (provider unavailable).
   */
  public static async resolveAirport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || '').trim();
      if (!q || q.length > 80) {
        res.json({ success: true, data: { status: 'NOT_FOUND' } });
        return;
      }
      res.json({ success: true, data: await flightService.resolveAirport(q) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/airports/:code   (IATA or ICAO)
   * The airport's real details plus its current departures/arrivals. The
   * airport is returned even when it has no flights (or no IATA code, in
   * which case schedules can't be looked up); a failed flight request
   * doesn't hide the airport either.
   *   404 AIRPORT_NOT_FOUND           - the provider has no such airport
   *   503 AIRPORT_SERVICE_UNAVAILABLE - the provider couldn't be asked
   */
  public static async getAirportDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = String(req.params.code || '').trim().toUpperCase();
      const failures: AirportProviderFailure[] = [];
      let airport: SearchAirport | null | undefined = null;
      if (IATA.test(code)) airport = await flightService.lookupAirport(code, { withCity: true, complete: true, failures });
      else if (ICAO.test(code)) airport = await flightService.lookupAirportByIcao(code, { withCity: true, failures });

      if (airport === undefined) {
        const failure = mostSevereFailure(failures);
        const mapped = FAILURE_RESPONSES[failure?.kind ?? 'SERVICE_UNAVAILABLE'];
        res.status(mapped.status).json({
          success: false,
          error: {
            code: mapped.code,
            message: mapped.message,
            details: failure ? { providerStatus: failure.httpStatus, providerCode: failure.code, providerMessage: failure.message } : undefined,
          },
        });
        return;
      }
      if (!airport) {
        res.status(404).json({
          success: false,
          error: { code: 'AIRPORT_NOT_FOUND', message: `No airport found for code "${code}".` },
        });
        return;
      }

      if (config.isDev) {
        console.log('[AirportController] Received airport details request', { code, iata: airport.iata, icao: airport.icao, source: airport.source });
      }

      let departures: Flight[] = [];
      let arrivals: Flight[] = [];
      let flightsUnavailable = false;
      const flightsSearchable = Boolean(airport.iata);
      if (airport.iata) {
        try {
          [departures, arrivals] = await Promise.all([
            flightService.searchFlights({ depIata: airport.iata }),
            flightService.searchFlights({ arrIata: airport.iata }),
          ]);
        } catch {
          flightsUnavailable = true;
        }
      }

      if (config.isDev) {
        console.log(`[AirportController] Returning ${departures.length} departures, ${arrivals.length} arrivals for ${code}`);
      }

      // Board rows: one row per physical flight (codeshares listed on the
      // operating flight), in time order, without the route polyline -
      // the details page loads geometry for the one flight it shows.
      const board = (flights: Flight[], side: 'departure' | 'arrival') =>
        collapseCodeshares(flights)
          .sort((x, y) => (x[side].scheduledTime || '').localeCompare(y[side].scheduledTime || ''))
          .map(({ route, ...rest }) => rest);
      const departureRows = board(departures, 'departure');
      const arrivalRows = board(arrivals, 'arrival');
      res.json({
        success: true,
        data: {
          airport,
          departures: departureRows,
          arrivals: arrivalRows,
          flightsSearchable,
          flightsUnavailable,
          // AirLabs returns one page (max 100 records) per request on this
          // plan and offers no usable paging: the board says what the
          // provider holds vs. returned instead of pretending more pages exist.
          truncated: {
            departures: airport.iata ? flightService.wasTruncated({ depIata: airport.iata }) : false,
            arrivals: airport.iata ? flightService.wasTruncated({ arrIata: airport.iata }) : false,
          },
          provider: {
            departures: airport.iata ? flightService.providerPagesFor({ depIata: airport.iata }).schedules ?? null : null,
            arrivals: airport.iata ? flightService.providerPagesFor({ arrIata: airport.iata }).schedules ?? null : null,
            paginationAvailable: false,
          },
          // Rows are physical flights: codeshare records are listed on their
          // operating flight, not counted as extra rows.
          counts: {
            departures: { providerRecords: departures.length, rows: departureRows.length },
            arrivals: { providerRecords: arrivals.length, rows: arrivalRows.length },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
