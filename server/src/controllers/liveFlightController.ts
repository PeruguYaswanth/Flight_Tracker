import { Request, Response, NextFunction } from 'express';
import { liveFlightService } from '../services/liveFlightService';
import { flightService } from '../services/flightService';
import { ApiResponse } from '../types/flight';
import { LiveFlightPosition } from '../services/liveFlightService';

export class LiveFlightController {
  /**
   * GET /api/live-flights/:flightNumber
   *   ?icao=<icaoCallsign>
   *   &icao24=<hex>
   *   &registration=<reg>
   *   &operatingFlightNumber=<operating carrier's flight number, for codeshares>
   *
   * Identifier priority:
   *  1. `icao24` supplied by the frontend (already known from a prior
   *     AirLabs fetch) - used directly, no extra AirLabs request.
   *  2. AirLabs `/flights` lookup by the URL's flight number.
   *  3. If that has no hex AND this is a codeshare (`operatingFlightNumber`
   *     differs from the marketing number), AirLabs `/flights` lookup by
   *     the OPERATING carrier's flight number - the physical aircraft's
   *     ADS-B broadcast is typically only discoverable under that identity.
   *  4. Only if no hex was found by any of the above: ICAO callsign / IATA
   *     flight number exact-match fallback against OpenSky.
   */
  public static async getLivePosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flightNumber } = req.params;
      const icaoCallsign = req.query.icao ? String(req.query.icao).trim() : '';
      const suppliedIcao24 = req.query.icao24 ? String(req.query.icao24).trim() : '';
      const registration = req.query.registration ? String(req.query.registration).trim() : '';
      const operatingFlightNumber = req.query.operatingFlightNumber ? String(req.query.operatingFlightNumber).trim() : '';

      if (!flightNumber || !flightNumber.trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_AIRCRAFT_IDENTIFIER',
            message: 'A live position lookup requires a flight number.',
          },
        });
        return;
      }

      let resolvedIcao24 = suppliedIcao24 || null;
      let resolvedRegistration = registration || null;
      let icao24Source: 'frontend_supplied' | 'airlabs_primary' | 'airlabs_codeshare' | null = resolvedIcao24 ? 'frontend_supplied' : null;

      if (!resolvedIcao24) {
        const identifiers = await flightService.getAircraftIdentifiers(flightNumber);
        if (identifiers.icao24) {
          resolvedIcao24 = identifiers.icao24;
          resolvedRegistration = resolvedRegistration || identifiers.registration;
          icao24Source = 'airlabs_primary';
        } else if (operatingFlightNumber && operatingFlightNumber.toUpperCase() !== flightNumber.toUpperCase()) {
          // Codeshare: the marketing flight number (e.g. QF8786) has no
          // ADS-B identity of its own - try the actual operating carrier's
          // flight number (e.g. 6E6202), which AirLabs already told us via
          // the schedule lookup that produced this flight object.
          const codeshareIdentifiers = await flightService.getAircraftIdentifiers(operatingFlightNumber);
          if (codeshareIdentifiers.icao24) {
            resolvedIcao24 = codeshareIdentifiers.icao24;
            resolvedRegistration = resolvedRegistration || codeshareIdentifiers.registration;
            icao24Source = 'airlabs_codeshare';
          }
        }
      }

      const result = await liveFlightService.resolveLivePosition({
        flightIata: flightNumber,
        flightIcao: icaoCallsign || null,
        icao24: resolvedIcao24,
        registration: resolvedRegistration,
        icao24Source,
      });

      if (!result.position) {
        res.status(404).json({
          success: false,
          error: {
            code: 'LIVE_POSITION_UNAVAILABLE',
            message: 'Live position is currently unavailable for this flight.',
            reason: result.reason || 'callsign_not_currently_visible',
          },
        });
        return;
      }

      const response: ApiResponse<LiveFlightPosition> = {
        success: true,
        data: { ...result.position, flightNumber: flightNumber || result.position.flightNumber },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
