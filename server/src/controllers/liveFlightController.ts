import { Request, Response, NextFunction } from 'express';
import { isFresh, liveFlightService, LiveFlightPosition, normalizeCallsign } from '../services/liveFlightService';
import { AircraftIdentifiers, flightService } from '../services/flightService';
import { getAirlineByCode } from '../services/airlinesData';
import { config } from '../config/environment';

// A real ICAO24 / ADS-B hex address is exactly 6 hexadecimal characters.
// Anything that doesn't match this pattern (e.g. "UAE527") is a callsign,
// not an ICAO24, and must NEVER be sent to OpenSky as one.
const ICAO24_PATTERN = /^[0-9a-f]{6}$/i;

function isValidIcao24(value: string): boolean {
  return ICAO24_PATTERN.test(value.trim());
}

function normalizeIcao24(value: string): string {
  return value.trim().toLowerCase();
}

const METERS_TO_FEET = 3.28084;

/**
 * ICAO-designator form of an IATA flight number from the static airline
 * table, e.g. "6E6202" -> "IGO6202" - the same form AirLabs' own
 * `flight_icao` uses. Only a candidate for exact matching; many carriers
 * broadcast alphanumeric callsigns (e.g. IGO274E) that this can't predict.
 */
export function deriveIcaoCallsign(flightIata: string): string | null {
  const m = flightIata.toUpperCase().match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  const airline = getAirlineByCode(m[1]);
  return airline ? `${airline.icao}${m[2]}` : null;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

/**
 * AirLabs' own ADS-B position from the same `/flights` record the hex came
 * from. Used only when OpenSky has no usable state for that aircraft, and
 * only if AirLabs says it is en route with a fresh, valid position.
 */
export function airLabsFallbackPosition(identifiers: AircraftIdentifiers, flightNumber: string): LiveFlightPosition | null {
  const p = identifiers.position;
  if (!p || !identifiers.icao24) return null;
  if (identifiers.status !== 'en-route') return null;
  if (!isValidCoordinate(p.latitude, p.longitude)) return null;
  if (!isFresh(p.updated)) return null;
  return {
    flightNumber,
    icao24: identifiers.icao24,
    callsign: normalizeCallsign(identifiers.callsign) || null,
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitudeMeters !== null ? Math.round(p.altitudeMeters * METERS_TO_FEET) : null,
    heading: p.heading !== null ? Math.round(p.heading) : null,
    speed: p.speedKmh !== null ? Math.round(p.speedKmh) : null,
    isGround: false,
    updatedAt: p.updated !== null ? new Date(p.updated * 1000).toISOString() : null,
  };
}

export class LiveFlightController {
  /**
   * GET /api/live-flights/:flightNumber
   *   ?icao=<icaoCallsign>          — ICAO callsign (e.g. "UAE527"), NOT necessarily an ICAO24
   *   &icao24=<hex>                 — Aircraft hex transponder address (e.g. "710abc")
   *   &registration=<reg>           — Aircraft registration (supplementary)
   *   &operatingFlightNumber=<num>  — Operating carrier's flight number for codeshares
   *
   * Identifier resolution priority:
   *  1. `icao24` query param — only used if it is genuinely a 6-hex-char ICAO24.
   *     If the value is a callsign like "UAE527", it is reclassified and used
   *     as a callsign fallback instead, never as ICAO24.
   *  2. AirLabs /flights lookup by IATA flight number → aircraft.hex
   *     If no hex, retries with the ICAO callsign (e.g. UAE527).
   *  3. If codeshare, AirLabs /flights lookup by operating flight number.
   *  4. Exact OpenSky callsign match (case/whitespace-normalised, never prefix).
   *  5. No valid state → LIVE_POSITION_UNAVAILABLE.
   */
  public static async getLivePosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flightNumber } = req.params;
      const rawIcaoParam = req.query.icao ? String(req.query.icao).trim() : '';
      const rawIcao24Param = req.query.icao24 ? String(req.query.icao24).trim() : '';
      const registration = req.query.registration ? String(req.query.registration).trim() : '';
      const operatingFlightNumber = req.query.operatingFlightNumber ? String(req.query.operatingFlightNumber).trim() : '';

      if (!flightNumber || !flightNumber.trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_AIRCRAFT_IDENTIFIER',
            reason: 'no_aircraft_identifier',
            message: 'A live position lookup requires a flight number.',
          },
        });
        return;
      }

      // ── Step 1: Classify the input identifier ──────────────────────────────
      // The `icao` param is always treated as a callsign (it says "icao" in the
      // query string but it contains ICAO callsigns like "UAE527", not hex).
      // The `icao24` param is ONLY used if it actually looks like a 6-hex ICAO24.
      // If someone passes a callsign in the icao24 slot, catch that here.

      let icaoCallsign: string = rawIcaoParam || ''; // e.g. "UAE527"
      let resolvedIcao24: string | null = null;
      let icao24Source: 'frontend_supplied' | 'airlabs_primary' | 'airlabs_codeshare' | null = null;

      if (rawIcao24Param) {
        if (isValidIcao24(rawIcao24Param)) {
          resolvedIcao24 = normalizeIcao24(rawIcao24Param);
          icao24Source = 'frontend_supplied';
          if (config.isDev) {
            console.log(`[LiveFlight] Input identifier: ${rawIcao24Param}`);
            console.log(`[LiveFlight] Identifier type: icao24`);
          }
        } else {
          // Value looks like a callsign (e.g. "UAE527") not a hex address.
          // Demote it to the callsign slot if we don't already have one.
          if (!icaoCallsign) {
            icaoCallsign = rawIcao24Param;
          }
          if (config.isDev) {
            console.log(`[LiveFlight] Input identifier: ${rawIcao24Param}`);
            console.log(`[LiveFlight] Identifier type: callsign (reclassified from icao24 param — not a valid hex)`);
          }
        }
      }

      if (config.isDev) {
        console.log(`[LiveFlight] Flight: ${flightNumber}`);
        if (icaoCallsign) {
          console.log(`[LiveFlight] Input identifier: ${icaoCallsign}`);
          console.log(`[LiveFlight] Identifier type: callsign`);
        }
      }

      // ── Step 2: Operating identity ─────────────────────────────────────────
      // A codeshare's aircraft only ever broadcasts under the operating
      // carrier's identity (QF8786 flies as 6E6202 / IGO...), so the
      // marketing number and callsign are never used for the lookup.
      const isCodeshare =
        Boolean(operatingFlightNumber) && operatingFlightNumber.toUpperCase() !== flightNumber.toUpperCase();
      const lookupNumber = (isCodeshare ? operatingFlightNumber : flightNumber).toUpperCase();
      const derivedCallsign = deriveIcaoCallsign(lookupNumber);
      const lookupIcao = (isCodeshare ? derivedCallsign : icaoCallsign || derivedCallsign) || null;
      if (config.isDev && isCodeshare) {
        console.log(`[LiveFlight] Operating flight: ${lookupNumber} (codeshare of ${flightNumber})`);
      }

      // ── Step 3: AirLabs lookup for hex (if no validated ICAO24 yet) ────────
      let resolvedRegistration = registration || null;
      let identifiers: AircraftIdentifiers | null = null;

      if (!resolvedIcao24) {
        identifiers = await flightService.getAircraftIdentifiers(lookupNumber, lookupIcao);
        if (identifiers.icao24) {
          resolvedIcao24 = identifiers.icao24;
          resolvedRegistration = resolvedRegistration || identifiers.registration;
          icao24Source = isCodeshare ? 'airlabs_codeshare' : 'airlabs_primary';
        }
      }

      if (config.isDev && !resolvedIcao24) {
        console.log(`[LiveFlight] No verified ICAO24 - falling back to exact callsign matching`);
      }

      // ── Step 4: OpenSky (ICAO24 first, then exact callsigns) ───────────────
      // Callsign priority: what AirLabs reports the aircraft broadcasting,
      // then the ICAO-form flight number, then the IATA number last.
      const result = await liveFlightService.resolveLivePosition({
        flightIata: lookupNumber,
        flightIcao: lookupIcao,
        icao24: resolvedIcao24,
        registration: resolvedRegistration,
        icao24Source,
        callsignCandidates: [identifiers?.callsign, lookupIcao, lookupNumber],
      });

      let position: LiveFlightPosition | null = result.position;
      let source: 'opensky' | 'airlabs' = 'opensky';

      // ── Step 5: AirLabs position for the same aircraft ─────────────────────
      // OpenSky's receiver coverage has gaps (e.g. much of India); AirLabs
      // often still has a fresh ADS-B fix for the very same hex. An
      // OpenSky "on ground" answer is respected, not overridden.
      if (!position && resolvedIcao24 && result.reason !== 'aircraft_on_ground') {
        const latest = await flightService.getAircraftIdentifiers(lookupNumber, lookupIcao, {
          maxAgeMs: config.airLabsPositionMaxAgeMs,
        });
        if (latest.icao24 === resolvedIcao24) {
          position = airLabsFallbackPosition(latest, flightNumber);
          if (position) source = 'airlabs';
        }
        if (config.isDev) {
          console.log(`[LiveFlight] AirLabs position fallback: ${position ? 'used' : `rejected (status ${latest.status ?? 'none'}, hex match ${latest.icao24 === resolvedIcao24})`}`);
        }
      }

      if (config.isDev) {
        console.log(
          `[LiveFlight] Final result: ${
            position
              ? `position resolved via ${source === 'airlabs' ? 'airlabs_position' : result.strategy} (icao24 ${position.icao24})`
              : `unavailable via ${result.strategy} - ${result.reason}`
          }`
        );
      }

      // ── Response ────────────────────────────────────────────────────────────
      if (!position) {
        // Map internal reason codes to the public reason vocabulary
        const reasonMap: Record<string, string> = {
          airlabs_icao24_missing: 'no_aircraft_identifier',
          opensky_icao24_not_visible: 'no_opensky_position',
          callsign_not_currently_visible: 'no_opensky_position',
          stale_opensky_position: 'stale_opensky_position',
          aircraft_on_ground: 'aircraft_on_ground',
        };
        const reason = result.reason ? (reasonMap[result.reason] || result.reason) : 'no_opensky_position';

        const messageMap: Record<string, string> = {
          no_aircraft_identifier: 'No aircraft identifier could be resolved for this flight.',
          no_opensky_position: 'No current aircraft position is available.',
          stale_opensky_position: 'The last known position is too old to be considered live.',
          aircraft_on_ground: 'The aircraft is currently on the ground.',
        };

        res.status(404).json({
          success: false,
          error: {
            code: 'LIVE_POSITION_UNAVAILABLE',
            reason,
            message: messageMap[reason] || 'No current aircraft position is available.',
          },
        });
        return;
      }

      // Build the structured success response per specification
      const pos = position;
      res.json({
        success: true,
        position: {
          latitude: pos.latitude,
          longitude: pos.longitude,
          altitude: pos.altitude ?? null,
          speed: pos.speed ?? null,
          heading: pos.heading ?? null,
          isGround: pos.isGround ?? false,
          updatedAt: pos.updatedAt ?? null,
        },
        // Identity of the aircraft actually matched - not the request input.
        aircraft: {
          icao24: pos.icao24,
          callsign: pos.callsign,
        },
        source,
      });
    } catch (error) {
      next(error);
    }
  }
}
