import { Request, Response, NextFunction } from 'express';
import { flightService } from '../services/flightService';
import { ApiResponse, Flight, FlightSearchQuery } from '../types/flight';
import { config } from '../config/environment';
import { collapseCodeshares, filterRelevantFlights } from '../services/currentFlightFilter';

/**
 * Search-result shaping shared by every search: keep flights that are in
 * the air, departing soon or recently cancelled, then list each physical
 * flight once. Logs the counts at each stage (no credentials).
 */
function shapeResults(rawFlights: Flight[], tag: 'RouteSearch' | 'FlightSearch', label: string, flightDate?: string): Flight[] {
  const relevant = filterRelevantFlights(rawFlights);
  // AirLabs can't be queried by date on this plan. Today (the form default)
  // means "in the air or departing soon"; any other date keeps only flights
  // departing on that UTC date - an empty result is the honest answer when
  // the provider has none for it.
  const today = new Date().toISOString().slice(0, 10);
  const dated = flightDate && flightDate !== today ? relevant.filter((f) => f.flightDate === flightDate) : relevant;
  const flights = collapseCodeshares(dated);
  if (config.isDev) {
    console.log(`[${tag}] ${label} | provider results: ${rawFlights.length} | after status/time filter: ${relevant.length} | after date filter: ${dated.length} | after codeshare grouping: ${flights.length}`);
  }
  return flights;
}

export class FlightController {
  /**
   * GET /api/flights/search
   * Search flights by flightNumber, airline, flightDate, depIata, arrIata
   */
  public static async searchFlights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flightNumber, airline, flightDate, depIata, arrIata } = req.query;

      const query: FlightSearchQuery = {
        flightNumber: flightNumber ? String(flightNumber).trim() : undefined,
        airline: airline ? String(airline).trim() : undefined,
        flightDate: flightDate ? String(flightDate).trim() : undefined,
        depIata: depIata ? String(depIata).trim().toUpperCase() : undefined,
        arrIata: arrIata ? String(arrIata).trim().toUpperCase() : undefined,
      };

      // Ensure at least one search criterion is provided
      if (!query.flightNumber && !query.airline && !query.depIata && !query.arrIata) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SEARCH_CRITERIA',
            message: 'Please provide at least a flight number, airline, or departure/arrival airport code.',
          },
        });
        return;
      }

      if (config.isDev) {
        console.log('[FlightController] Received flight search request', query);
      }

      const rawFlights = await flightService.searchFlights(query);
      const flights = query.depIata || query.arrIata
        ? shapeResults(rawFlights, 'RouteSearch', `Origin: ${query.depIata || '-'} | Destination: ${query.arrIata || '-'} | Date: ${query.flightDate || 'today'}`, query.flightDate)
        : shapeResults(rawFlights, 'FlightSearch', `Flight: ${query.flightNumber || query.airline} | Date: ${query.flightDate || 'today'}`, query.flightDate);

      const response: ApiResponse<Flight[]> = {
        success: true,
        data: flights,
        total: flights.length,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/flights/route
   * Search flights by route (departure and arrival airport)
   */
  public static async searchByRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { depIata, arrIata, flightDate } = req.query;

      if (!depIata || !arrIata) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ROUTE_PARAMETERS',
            message: 'Both departure (depIata) and arrival (arrIata) airport codes are required.',
          },
        });
        return;
      }

      const dep = String(depIata).trim().toUpperCase();
      const arr = String(arrIata).trim().toUpperCase();
      const date = flightDate ? String(flightDate).trim() : undefined;

      if (config.isDev) {
        console.log('[FlightController] Received route search request', { depIata: dep, arrIata: arr, flightDate: date });
      }

      const rawFlights = await flightService.searchByRoute(dep, arr, date);
      const flights = shapeResults(rawFlights, 'RouteSearch', `Origin: ${dep} | Destination: ${arr} | Date: ${date || 'today'}`, date);

      const response: ApiResponse<Flight[]> = {
        success: true,
        data: flights,
        total: flights.length,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/flights/:flightNumber
   * Retrieve single flight details by flight number
   */
  public static async getFlightDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flightNumber } = req.params;
      const { flightDate, depIata, arrIata } = req.query;

      if (!flightNumber || flightNumber.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FLIGHT_NUMBER',
            message: 'Flight number is required.',
          },
        });
        return;
      }

      // depIata/arrIata pin the exact instance the page is showing, so a
      // refresh never swaps in another day's record for the same number.
      const flight = await flightService.getFlightByNumber(
        flightNumber.trim().toUpperCase(),
        flightDate ? String(flightDate).trim() : undefined,
        depIata ? String(depIata).trim() : undefined,
        arrIata ? String(arrIata).trim() : undefined
      );

      if (!flight) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FLIGHT_NOT_FOUND',
            message: `No matching flight found for "${flightNumber}". Please check the flight number, airline, or date.`,
          },
        });
        return;
      }

      const response: ApiResponse<Flight> = {
        success: true,
        data: flight,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
