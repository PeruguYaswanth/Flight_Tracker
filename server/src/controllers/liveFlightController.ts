import { Request, Response, NextFunction } from 'express';
import { flightLiveResolver, LiveReason, PROVIDER_FAILURE_REASONS } from '../services/liveFlightService';
import { LiveFlightResponse } from '../types/flight';
import { parseCallsign, parseFlightNumber } from '../utils/flightNumber';
import { normalizeIcao24 } from '../services/liveFlightService';

const REASON_MESSAGES: Record<LiveReason, string> = {
  NO_IDENTIFIER: 'No aircraft identifier could be resolved for this flight.',
  NO_MATCH: 'Live position is currently unavailable for this flight.',
  STALE: 'The last known position is too old to be shown as current.',
  ON_GROUND: 'The aircraft is currently on the ground.',
  INVALID_POSITION: 'The live data for this aircraft has no valid position.',
  AUTH_ERROR: 'The live position service is temporarily unavailable.',
  RATE_LIMITED: 'The live position service is busy. Please try again shortly.',
  PROVIDER_ERROR: 'The live position service is temporarily unavailable.',
};

/** One structured line per request - identifiers and outcomes only, never credentials. */
function logLive(fields: Record<string, string | number | boolean | null | undefined>): void {
  const line = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v === null || v === '' ? 'null' : v}`)
    .join(' ');
  console.log(`[LIVE] ${line}`);
}

function unavailable(res: Response, flightNumber: string, reason: LiveReason, httpStatus?: number): void {
  const providerFailure = PROVIDER_FAILURE_REASONS.includes(reason);
  const body: LiveFlightResponse = {
    success: !providerFailure,
    data: {
      flightNumber,
      hasLiveTracking: false,
      live: null,
      liveUnavailableReason: reason,
      message: REASON_MESSAGES[reason],
    },
  };
  res.status(httpStatus ?? (reason === 'RATE_LIMITED' ? 503 : providerFailure ? 502 : 200)).json(body);
}

export class LiveFlightController {
  /**
   * GET /api/live-flights/:flightNumber
   *   ?callsign=<ICAO callsign>     e.g. "IGO5221" - a callsign, never an ICAO24
   *   &icao24=<hex>                 aircraft hex, used only if it really is 6 hex characters
   *   &operatingFlightNumber=<num>  operating flight for codeshares
   *   &depIata=&arrIata=            route airports, to bound the callsign lookup
   *
   * OpenSky is the primary live source; AirLabs is asked only when OpenSky
   * can't provide a position (see FlightLiveResolver).
   *
   * Always answers with LiveFlightResponse:
   *   200 { success: true,  data: { hasLiveTracking: true,  live: {...} } }
   *   200 { success: true,  data: { hasLiveTracking: false, live: null, liveUnavailableReason: NO_MATCH | STALE | ... } }
   *   502/503 { success: false, data: { ..., liveUnavailableReason: AUTH_ERROR | RATE_LIMITED | PROVIDER_ERROR } }
   */
  public static async getLivePosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (name: string) => (req.query[name] ? String(req.query[name]).trim() : null);
      // Malformed identifiers are rejected before any provider call.
      const flight = parseFlightNumber(req.params.flightNumber);
      const operating = query('operatingFlightNumber');
      const operatingParsed = operating ? parseFlightNumber(operating) : null;
      const invalid =
        !flight ? 'flight number' :
        query('icao24') && !normalizeIcao24(query('icao24')) ? 'icao24 (6 hex characters)' :
        query('callsign') && !parseCallsign(query('callsign')) ? 'callsign' :
        operating && !operatingParsed ? 'operating flight number' :
        [query('depIata'), query('arrIata')].some((c) => c && !/^[A-Za-z0-9]{3}$/.test(c)) ? 'airport code' : null;
      if (invalid) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid ${invalid}.` } });
        return;
      }
      const flightNumber = flight!.canonical;

      const result = await flightLiveResolver.resolve({
        flightNumber,
        callsign: query('callsign'),
        icao24: query('icao24'),
        operatingFlightNumber: operatingParsed?.canonical ?? null,
        depIata: query('depIata')?.toUpperCase() ?? null,
        arrIata: query('arrIata')?.toUpperCase() ?? null,
      });
      logLive(result.log);

      const position = result.position;
      if (!position || !result.source) {
        unavailable(res, flightNumber, result.reason ?? 'NO_MATCH');
        return;
      }

      const body: LiveFlightResponse = {
        success: true,
        data: {
          flightNumber,
          hasLiveTracking: true,
          // The same normalized shape whichever provider supplied it.
          live: {
            latitude: position.latitude,
            longitude: position.longitude,
            altitude: position.altitude ?? null,
            speed: position.speed ?? null,
            heading: position.heading ?? null,
            callsign: position.callsign,
            icao24: position.icao24,
            timestamp: position.updatedAt ?? null,
            source: result.source,
            onGround: typeof position.isGround === 'boolean' ? position.isGround : null,
          },
        },
      };
      res.json(body);
    } catch (error) {
      next(error);
    }
  }
}
