import { Flight, FlightStatus, AirportInfo, LivePosition, AircraftInfo, AirlineInfo } from '../types/flight';
import { getAirportCoords } from './airportsData';
import { getAirlineByCode } from './airlinesData';

/**
 * Rejects missing/NaN coordinates and the (0, 0) "null island" sentinel some
 * providers use for an unknown position, so bad data never reaches the map.
 */
function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * AirLabs' `_utc` timestamp fields are documented as space-separated
 * ("2026-09-23 09:00") rather than full ISO with an explicit offset, even
 * though the value itself is UTC. Left as-is, `new Date(...)` would treat
 * that as an ambiguous/local-time string. This makes the UTC-ness explicit
 * before parsing, so every timestamp resolves to the correct absolute
 * instant regardless of the server's local timezone.
 */
function toIsoUtc(raw?: string | null): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(' ', 'T');
  if (!/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = `${s}Z`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Normalizes raw external flight data into our uniform internal Flight
 * model. `normalizeAviationStack` is kept as the shape mapper for the
 * bundled demo/mock dataset (mockFlightData.ts) - it never made any HTTP
 * calls itself; the live provider integration lives in flightService.ts,
 * which now calls AirLabs via `normalizeAirLabs` below.
 */
export class FlightNormalizer {
  /**
   * Normalizes an AirLabs `/schedules` item (real-time flight schedule
   * lookup - the actual live search/details provider for this app).
   */
  public static normalizeAirLabs(item: any): Flight {
    const flightIata: string | null = item.flight_iata || null;
    const flightIcao: string | null = item.flight_icao || null;
    const flightNumber =
      flightIata ||
      flightIcao ||
      (item.flight_number ? `${item.airline_iata || item.airline_icao || ''}${item.flight_number}` : null) ||
      'UNKNOWN';

    const depTimeUtc = item.dep_time_utc || item.dep_estimated_utc || item.dep_actual_utc || item.dep_time || null;
    const flightDate = depTimeUtc ? String(depTimeUtc).slice(0, 10) : new Date().toISOString().split('T')[0];

    const status = this.normalizeStatus(item.status);

    const depIata = item.dep_iata || '';
    const depCoords = getAirportCoords(depIata);
    const departure: AirportInfo = {
      iata: depIata,
      icao: item.dep_icao || null,
      name: depCoords ? depCoords.name : (depIata || 'Unknown Airport'),
      city: depCoords?.city || null,
      country: depCoords?.country || null,
      terminal: item.dep_terminal || null,
      gate: item.dep_gate || null,
      baggage: null, // Not provided by AirLabs' schedule endpoint for departure
      scheduledTime: toIsoUtc(item.dep_time_utc) || toIsoUtc(item.dep_time),
      estimatedTime: toIsoUtc(item.dep_estimated_utc) || toIsoUtc(item.dep_estimated),
      actualTime: toIsoUtc(item.dep_actual_utc) || toIsoUtc(item.dep_actual),
      delayMinutes: typeof item.dep_delayed === 'number' ? item.dep_delayed : (typeof item.delayed === 'number' ? item.delayed : null),
      latitude: depCoords?.lat ?? null,
      longitude: depCoords?.lng ?? null,
    };

    const arrIata = item.arr_iata || '';
    const arrCoords = getAirportCoords(arrIata);
    const arrival: AirportInfo = {
      iata: arrIata,
      icao: item.arr_icao || null,
      name: arrCoords ? arrCoords.name : (arrIata || 'Unknown Airport'),
      city: arrCoords?.city || null,
      country: arrCoords?.country || null,
      terminal: item.arr_terminal || null,
      gate: item.arr_gate || null,
      baggage: item.arr_baggage || null,
      scheduledTime: toIsoUtc(item.arr_time_utc) || toIsoUtc(item.arr_time),
      estimatedTime: toIsoUtc(item.arr_estimated_utc) || toIsoUtc(item.arr_estimated),
      actualTime: toIsoUtc(item.arr_actual_utc) || toIsoUtc(item.arr_actual),
      delayMinutes: typeof item.arr_delayed === 'number' ? item.arr_delayed : null,
      latitude: arrCoords?.lat ?? null,
      longitude: arrCoords?.lng ?? null,
    };

    // Preserve the real ICAO24/hex transponder address when AirLabs
    // provides it - this is the aircraft's unique identifier and the
    // primary key OpenSky matching should use (see liveFlightService.ts).
    // Only populate what AirLabs actually returns, never guessed.
    const icao24 = item.hex ? String(item.hex).trim().toLowerCase() : null;
    const aircraft: AircraftInfo | null = (item.aircraft_icao || item.reg_number || icao24) ? {
      model: item.aircraft_icao || null,
      registration: item.reg_number || null,
      iataCode: null,
      icaoCode: item.aircraft_icao || null,
      icao24,
    } : null;

    const airlineRef = getAirlineByCode(item.airline_iata, item.airline_icao);
    const airline: AirlineInfo = {
      name: airlineRef?.name || item.airline_iata || item.airline_icao || 'Unknown Airline',
      iata: item.airline_iata || null,
      icao: item.airline_icao || null,
    };

    // Live position is deliberately never sourced from AirLabs - that is
    // OpenSky's exclusive responsibility (see liveFlightService.ts). Never
    // fabricated here.
    const live: LivePosition | null = null;
    const hasLiveTracking = false;

    const route = this.generateRoutePoints(departure, arrival, live);

    return {
      id: `${flightNumber}-${flightDate}-${departure.iata}-${arrival.iata}`.replace(/\s+/g, ''),
      flightNumber,
      flightIata,
      flightIcao,
      // AirLabs' `cs_flight_iata` is the operating carrier's own flight
      // number when this record is a codeshare - real data, not guessed.
      operatingFlightIata: item.cs_flight_iata || null,
      airline,
      flightDate,
      status,
      departure,
      arrival,
      aircraft,
      live,
      lastUpdated: new Date().toISOString(),
      hasLiveTracking,
      route,
    };
  }

  /**
   * Normalizes an AviationStack-shaped flight item (used only for the
   * bundled mock/demo dataset when no provider key is configured).
   */
  public static normalizeAviationStack(item: any): Flight {
    const flightDate = item.flight_date || new Date().toISOString().split('T')[0];
    const flightNumber = item.flight?.iata || item.flight?.number || item.flight?.icao || 'UNKNOWN';
    const status = this.normalizeStatus(item.flight_status);
    
    // Normalizing departure
    const depIata = item.departure?.iata || '';
    const depCoords = getAirportCoords(depIata);
    const departure: AirportInfo = {
      iata: depIata,
      icao: item.departure?.icao || null,
      name: item.departure?.airport || (depCoords ? depCoords.name : 'Unknown Airport'),
      city: depCoords?.city || null,
      country: depCoords?.country || null,
      terminal: item.departure?.terminal || null,
      gate: item.departure?.gate || null,
      baggage: item.departure?.baggage || null,
      scheduledTime: item.departure?.scheduled || null,
      estimatedTime: item.departure?.estimated || null,
      actualTime: item.departure?.actual || null,
      delayMinutes: typeof item.departure?.delay === 'number' ? item.departure.delay : null,
      latitude: depCoords?.lat ?? null,
      longitude: depCoords?.lng ?? null,
    };

    // Normalizing arrival
    const arrIata = item.arrival?.iata || '';
    const arrCoords = getAirportCoords(arrIata);
    const arrival: AirportInfo = {
      iata: arrIata,
      icao: item.arrival?.icao || null,
      name: item.arrival?.airport || (arrCoords ? arrCoords.name : 'Unknown Airport'),
      city: arrCoords?.city || null,
      country: arrCoords?.country || null,
      terminal: item.arrival?.terminal || null,
      gate: item.arrival?.gate || null,
      baggage: item.arrival?.baggage || null,
      scheduledTime: item.arrival?.scheduled || null,
      estimatedTime: item.arrival?.estimated || null,
      actualTime: item.arrival?.actual || null,
      delayMinutes: typeof item.arrival?.delay === 'number' ? item.arrival.delay : null,
      latitude: arrCoords?.lat ?? null,
      longitude: arrCoords?.lng ?? null,
    };

    // Aircraft Info
    const aircraft: AircraftInfo | null = item.aircraft ? {
      model: item.aircraft.registration || item.aircraft.iata || item.aircraft.icao || null,
      registration: item.aircraft.registration || null,
      iataCode: item.aircraft.iata || null,
      icaoCode: item.aircraft.icao || null,
    } : null;

    // Airline Info
    const airline: AirlineInfo = {
      name: item.airline?.name || 'Unknown Airline',
      iata: item.airline?.iata || null,
      icao: item.airline?.icao || null,
    };

    // Live position (if provided by API)
    let live: LivePosition | null = null;
    let hasLiveTracking = false;

    if (item.live && isValidCoordinate(item.live.latitude, item.live.longitude)) {
      live = {
        latitude: item.live.latitude,
        longitude: item.live.longitude,
        altitude: item.live.altitude || null,
        heading: item.live.direction || null,
        speed: item.live.speed_horizontal || null,
        isGround: item.live.is_ground || false,
        updatedAt: item.live.updated || new Date().toISOString(),
      };
      hasLiveTracking = true;
    }

    // Build route coordinates if airports are known
    const route = this.generateRoutePoints(departure, arrival, live);

    return {
      id: `${flightNumber}-${flightDate}-${departure.iata}-${arrival.iata}`.replace(/\s+/g, ''),
      flightNumber,
      flightIata: item.flight?.iata || null,
      flightIcao: item.flight?.icao || null,
      airline,
      flightDate,
      status,
      departure,
      arrival,
      aircraft,
      live,
      lastUpdated: new Date().toISOString(),
      hasLiveTracking,
      route,
    };
  }

  /**
   * Normalizes raw status strings to standard FlightStatus union
   */
  public static normalizeStatus(rawStatus?: string | null): FlightStatus {
    if (!rawStatus) return 'unknown';
    const s = rawStatus.toLowerCase().trim();
    switch (s) {
      case 'scheduled':
        return 'scheduled';
      case 'active':
      case 'en-route':
      case 'in-flight':
      case 'in flight':
      case 'started':
        return 'active';
      case 'landed':
      case 'arrived':
        return 'landed';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      case 'incident':
        return 'incident';
      case 'diverted':
        return 'diverted';
      case 'delayed':
        return 'delayed';
      default:
        return 'unknown';
    }
  }

  /**
   * Generate route polyline points [lat, lng][] between departure, live position, and arrival
   */
  public static generateRoutePoints(
    dep: AirportInfo,
    arr: AirportInfo,
    live?: LivePosition | null
  ): Array<[number, number]> | null {
    if (!isValidCoordinate(dep.latitude, dep.longitude) || !isValidCoordinate(arr.latitude, arr.longitude)) {
      return null;
    }
    const depLat = dep.latitude as number;
    const depLng = dep.longitude as number;
    const arrLat = arr.latitude as number;
    const arrLng = arr.longitude as number;

    const points: Array<[number, number]> = [];
    const numPoints = 20;

    // Great circle route interpolation
    for (let i = 0; i <= numPoints; i++) {
      const fraction = i / numPoints;
      // Linear interpolation with slight curvature for realistic aviation routes
      const lat = depLat + (arrLat - depLat) * fraction;
      const lng = depLng + (arrLng - depLng) * fraction;

      // Add slight geodesic arc altitude offset
      const arc = Math.sin(fraction * Math.PI) * (Math.abs(arrLng - depLng) > 30 ? 3 : 0.8);
      points.push([Number((lat + arc).toFixed(4)), Number(lng.toFixed(4))]);
    }

    return points;
  }
}
