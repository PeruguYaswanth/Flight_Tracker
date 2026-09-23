import { Request, Response, NextFunction } from 'express';
import { AIRPORT_COORDINATES, getAirportCoords } from '../services/airportsData';
import { flightService } from '../services/flightService';
import { config } from '../config/environment';

export class AirportController {
  /**
   * GET /api/airports
   * Static reference list - no external API call.
   */
  public static async listAirports(_req: Request, res: Response): Promise<void> {
    const airports = Object.values(AIRPORT_COORDINATES);
    res.json({ success: true, data: airports, total: airports.length });
  }

  /**
   * GET /api/airports/:code
   * Airport reference info plus current departures/arrivals reusing the
   * existing flight search (same provider integration, no new API surface).
   */
  public static async getAirportDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = String(req.params.code || '').trim().toUpperCase();
      const airport = getAirportCoords(code);

      if (!airport) {
        res.status(404).json({
          success: false,
          error: { code: 'AIRPORT_NOT_FOUND', message: `No airport found for code "${code}".` },
        });
        return;
      }

      if (config.isDev) {
        console.log('[AirportController] Received airport details request', { code });
      }

      const [departures, arrivals] = await Promise.all([
        flightService.searchFlights({ depIata: code }),
        flightService.searchFlights({ arrIata: code }),
      ]);

      if (config.isDev) {
        console.log(`[AirportController] Returning ${departures.length} departures, ${arrivals.length} arrivals for ${code}`);
      }

      res.json({
        success: true,
        data: { airport, departures, arrivals },
      });
    } catch (error) {
      next(error);
    }
  }
}
