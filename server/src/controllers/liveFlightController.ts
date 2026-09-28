import { Request, Response, NextFunction } from 'express';
import {
  BoundingBox,
  isFresh,
  isValidCoordinate,
  liveFlightService,
  LiveFlightPosition,
  LiveReason,
  normalizeCallsign,
  normalizeIcao24,
  positionAgeSeconds,
  PROVIDER_FAILURE_REASONS,
} from '../services/liveFlightService';
import { AircraftIdentifiers, flightService } from '../services/flightService';
import { getAirlineByCode } from '../services/airlinesData';
import { getAirportCoords } from '../services/airportsData';
import { config } from '../config/environment';
import { LiveFlightResponse } from '../types/flight';

const METERS_TO_FEET = 3.28084;

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

/**
 * Area around the route (both airports plus a margin) for the callsign
 * lookup, so OpenSky returns the aircraft near this route instead of the
 * whole world. Null (global search) when an airport is unknown or the
 * route crosses the antimeridian.
 */
export function routeBoundingBox(depIata?: string, arrIata?: string): BoundingBox | null {
  const dep = getAirportCoords(depIata);
  const arr = getAirportCoords(arrIata);
  if (!dep || !arr) return null;
  if (Math.abs(dep.lng - arr.lng) > 180) return null;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    lamin: round(Math.max(-90, Math.min(dep.lat, arr.lat) - 6)),
    lamax: round(Math.min(90, Math.max(dep.lat, arr.lat) + 6)),
    lomin: round(Math.max(-180, Math.min(dep.lng, arr.lng) - 8)),
    lomax: round(Math.min(180, Math.max(dep.lng, arr.lng) + 8)),
  };
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
    timestamp: p.updated,
  };
}

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
   * Always answers with LiveFlightResponse:
   *   200 { success: true,  data: { hasLiveTracking: true,  live: {...} } }
   *   200 { success: true,  data: { hasLiveTracking: false, live: null, liveUnavailableReason: NO_MATCH | STALE | ... } }
   *   502/503 { success: false, data: { ..., liveUnavailableReason: AUTH_ERROR | RATE_LIMITED | PROVIDER_ERROR } }
   *
   * Lookup order:
   *  1. Codeshare -> the operating flight's identity only.
   *  2. ICAO24: valid `icao24` param, else the hex from AirLabs' live /flights record.
   *  3. With a hex: OpenSky by ICAO24; if OpenSky has no usable state,
   *     AirLabs' own fresh position for that same hex.
   *  4. Without a hex: exact callsigns (AirLabs-reported, ICAO-form flight
   *     number, IATA number) against OpenSky, within the route area.
   */
  public static async getLivePosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flightNumber } = req.params;
      const requestedCallsign = req.query.callsign ? String(req.query.callsign).trim() : '';
      const rawIcao24Param = req.query.icao24 ? String(req.query.icao24).trim() : '';
      const operatingFlightNumber = req.query.operatingFlightNumber ? String(req.query.operatingFlightNumber).trim() : '';
      const depIata = req.query.depIata ? String(req.query.depIata).trim().toUpperCase() : '';
      const arrIata = req.query.arrIata ? String(req.query.arrIata).trim().toUpperCase() : '';

      if (!flightNumber || !flightNumber.trim()) {
        unavailable(res, '', 'NO_IDENTIFIER', 400);
        return;
      }

      // ── Operating identity ──────────────────────────────────────────────────
      // A codeshare's aircraft only broadcasts under the operating carrier's
      // identity (QF8786 flies as 6E6202), so the marketing number and
      // callsign are never used for the lookup.
      const isCodeshare =
        Boolean(operatingFlightNumber) && operatingFlightNumber.toUpperCase() !== flightNumber.toUpperCase();
      const lookupNumber = (isCodeshare ? operatingFlightNumber : flightNumber).toUpperCase();
      const derivedCallsign = deriveIcaoCallsign(lookupNumber);
      const lookupCallsign = (isCodeshare ? derivedCallsign : normalizeCallsign(requestedCallsign) || derivedCallsign) || null;

      // ── ICAO24 ──────────────────────────────────────────────────────────────
      // Only a genuine 6-hex address is ever sent to OpenSky as icao24.
      let icao24 = normalizeIcao24(rawIcao24Param);
      let icao24Source: string | null = icao24 ? 'request' : null;
      let identifiers: AircraftIdentifiers | null = null;
      if (!icao24) {
        identifiers = await flightService.getAircraftIdentifiers(lookupNumber, lookupCallsign);
        icao24 = normalizeIcao24(identifiers.icao24);
        if (icao24) icao24Source = 'airlabs';
      }

      // ── OpenSky ─────────────────────────────────────────────────────────────
      const result = await liveFlightService.resolveLivePosition({
        flightNumber,
        icao24,
        callsignCandidates: [identifiers?.callsign, lookupCallsign, lookupNumber],
        bbox: routeBoundingBox(depIata, arrIata),
      });
      let position: LiveFlightPosition | null = result.position;
      let source: 'opensky' | 'airlabs' = 'opensky';
      let fallbackNote: string | null = null;

      // ── AirLabs position for the same aircraft ─────────────────────────────
      // Covers OpenSky receiver gaps and OpenSky outages. An OpenSky "on
      // ground" answer is respected, not overridden.
      if (!position && icao24 && result.reason !== 'ON_GROUND') {
        const latest = await flightService.getAircraftIdentifiers(lookupNumber, lookupCallsign, {
          maxAgeMs: config.airLabsPositionMaxAgeMs,
        });
        if (normalizeIcao24(latest.icao24) === icao24) {
          position = airLabsFallbackPosition(latest, flightNumber);
          if (position) source = 'airlabs';
          fallbackNote = position ? 'used' : `rejected(status:${latest.status ?? 'none'},age:${positionAgeSeconds(latest.position?.updated ?? null) ?? 'n/a'}s)`;
        } else {
          fallbackNote = 'no_airlabs_record';
        }
      }

      const status = position ? 'POSITION_FOUND' : result.reason ?? 'NO_MATCH';
      const d = result.diagnostics;
      logLive({
        flight: flightNumber,
        operating: isCodeshare ? lookupNumber : undefined,
        callsign: position?.callsign ?? lookupCallsign,
        airlabsCallsign: identifiers?.callsign ?? null,
        icao24,
        icao24Source,
        lookup: d.method,
        lookupValue: d.value,
        area: d.method === 'CALLSIGN' ? d.area : undefined,
        openskyStatus: d.cached ? `${d.httpStatus ?? 'null'}(cached)` : d.httpStatus,
        openskyAuth: d.authenticated ? 'oauth' : config.openskyClientId ? 'token_failed' : 'anonymous',
        matched: d.matched,
        openskyResult: result.reason ?? 'POSITION_FOUND',
        airlabsFallback: fallbackNote ?? undefined,
        source: position ? source : undefined,
        lat: position?.latitude.toFixed(6),
        lon: position?.longitude.toFixed(6),
        age: position ? `${positionAgeSeconds(position.timestamp)}s` : d.ageSeconds !== null ? `${d.ageSeconds}s` : undefined,
        status,
      });

      if (!position) {
        unavailable(res, flightNumber, result.reason ?? 'NO_MATCH');
        return;
      }

      const body: LiveFlightResponse = {
        success: true,
        data: {
          flightNumber,
          hasLiveTracking: true,
          // Identity is the aircraft actually matched - not the request input.
          live: {
            latitude: position.latitude,
            longitude: position.longitude,
            altitude: position.altitude ?? null,
            speed: position.speed ?? null,
            heading: position.heading ?? null,
            callsign: position.callsign,
            icao24: position.icao24,
            timestamp: position.updatedAt ?? null,
            source,
          },
        },
      };
      res.json(body);
    } catch (error) {
      next(error);
    }
  }
}
