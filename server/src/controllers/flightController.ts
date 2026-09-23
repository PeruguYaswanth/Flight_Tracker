import { Request, Response, NextFunction } from 'express';
import { flightService } from '../services/flightService';
import { ApiResponse, Flight, FlightSearchQuery } from '../types/flight';
import { config } from '../config/environment';
import { filterCurrentlyFlying } from '../services/currentFlightFilter';

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
      // Only ever return flight instances that are currently airborne right
      // now - not yesterday's/tomorrow's records for the same number, and
      // not ones that have already landed. See currentFlightFilter.ts.
      const flights = filterCurrentlyFlying(rawFlights);

      if (config.isDev) {
        console.log(`[FlightController] Provider returned ${rawFlights.length} record(s), ${flights.length} currently flying`);
        console.log(`[FlightController] Returning ${flights.length} flights to client`);
      }

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
      const flights = filterCurrentlyFlying(rawFlights);

      if (config.isDev) {
        console.log(`[FlightController] Provider returned ${rawFlights.length} record(s), ${flights.length} currently flying`);
        console.log(`[FlightController] Returning ${flights.length} flights to client`);
      }

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
      const { flightDate } = req.query;

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

      const flight = await flightService.getFlightByNumber(
        flightNumber.trim().toUpperCase(),
        flightDate ? String(flightDate).trim() : undefined
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
