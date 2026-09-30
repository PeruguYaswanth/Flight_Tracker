import { Request, Response, NextFunction } from 'express';
import { flightService, TimetableFilter } from '../services/flightService';
import { AlternativeFlight, ApiResponse, Flight, FlightSearchMeta, FlightSearchQuery } from '../types/flight';
import { config } from '../config/environment';
import { collapseCodeshares } from '../services/currentFlightFilter';
import { isValidTimeOfDay, isValidTimeZone, searchDateError, todayIn } from '../utils/dateTime';
import { isValidAirlineQuery, parseFlightNumber, ParsedFlightNumber } from '../utils/flightNumber';
import { resolveAirlineIataFromSearchTerm } from '../services/airlinesData';

const AIRPORT_CODE = /^[A-Z0-9]{3}$/;
const MAX_ALTERNATIVES = 10;
// A selected departure time searches this many hours from that time.
const TIME_WINDOW_HOURS = 3;

interface ShapedResults {
  flights: Flight[];
  providerResults: number;
  window: 'CURRENT' | 'DATE' | 'TIME';
  searchedDate: string;
  selectedTime: string | null;
  /** Flights of the searched date left out only by the selected time window. */
  outsideWindow: Flight[];
  coverage: 'FULL_DAY' | 'REALTIME_WINDOW';
  truncated: boolean;
  provider: FlightSearchMeta['provider'];
}

/** A search request after validation - everything in canonical form. */
interface ValidatedSearch {
  query: FlightSearchQuery;
  flight: ParsedFlightNumber | null;
  date: string;
  time: string | null;
}

class ValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Minutes of `local` ("YYYY-MM-DD HH:MM", airport-local) relative to midnight of `date`. */
function localMinutesFrom(date: string, local?: string | null): number | null {
  const m = local?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const days = Math.round((Date.parse(`${m[1]}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return days * 1440 + Number(m[2]) * 60 + Number(m[3]);
}

/** The departure airport's calendar date of a flight. */
function localDepartureDate(f: Flight): string {
  const local = f.departure.scheduledLocal || f.departure.estimatedLocal;
  return local && /^\d{4}-\d{2}-\d{2}/.test(local) ? local.slice(0, 10) : f.flightDate;
}

/** Keeps flights departing (airport-local) in [time, time + window) on `date`. */
function timeWindowFilter(date: string, time: string): (f: Flight) => boolean {
  const [h, m] = time.split(':').map(Number);
  const from = h * 60 + m;
  const to = from + TIME_WINDOW_HOURS * 60;
  return (f) => {
    const minutes = localMinutesFrom(date, f.departure.estimatedLocal || f.departure.scheduledLocal);
    return minutes !== null && minutes >= from && minutes < to;
  };
}

const byDeparture = (a: Flight, b: Flight) =>
  (a.departure.scheduledTime || '').localeCompare(b.departure.scheduledTime || '') || a.flightNumber.localeCompare(b.flightNumber);

/**
 * Validates a search request before any provider call. Throws
 * ValidationError (400) for malformed input; the date must be inside the
 * 7-day window in the user's time zone. No date = today.
 */
function validateSearch(raw: Record<string, unknown>): ValidatedSearch {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v === undefined ? undefined : String(v).trim());
  const flightNumberRaw = str(raw.flightNumber);
  const airlineRaw = str(raw.airline);
  const dep = str(raw.depIata)?.toUpperCase();
  const arr = str(raw.arrIata)?.toUpperCase();
  const timeRaw = str(raw.departureTime);
  const dateRaw = str(raw.flightDate);
  const timeZone = str(raw.timeZone);

  let flight: ParsedFlightNumber | null = null;
  if (flightNumberRaw) {
    flight = parseFlightNumber(flightNumberRaw);
    if (!flight) throw new ValidationError('VALIDATION_ERROR', 'Please enter a valid flight number, e.g. 6E6372, 6E 6372 or AI101.');
  }
  if (airlineRaw && !isValidAirlineQuery(airlineRaw)) {
    throw new ValidationError('VALIDATION_ERROR', 'Please enter a valid airline name or code.');
  }
  // An airline-only search needs a code the provider can filter by; an
  // unrecognised name would otherwise silently search nothing.
  if (airlineRaw && !flightNumberRaw && !raw.depIata && !raw.arrIata && !resolveAirlineIataFromSearchTerm(airlineRaw)) {
    throw new ValidationError('UNKNOWN_AIRLINE', `We don't recognize the airline "${airlineRaw}". Please enter its 2-character IATA code (e.g. 6E, AI, EK).`);
  }
  if (!flight && !airlineRaw && !dep && !arr) {
    throw new ValidationError('INVALID_SEARCH_CRITERIA', 'Please provide at least a flight number, airline, or departure/arrival airport code.');
  }
  for (const code of [dep, arr]) {
    if (code && !AIRPORT_CODE.test(code)) {
      throw new ValidationError('INVALID_AIRPORT_CODE', 'Please choose a valid airport from the list (3-letter IATA code).');
    }
  }
  if (dep && arr && dep === arr) {
    throw new ValidationError('VALIDATION_ERROR', 'Departure and arrival airports must be different.');
  }
  if (timeRaw && !isValidTimeOfDay(timeRaw)) {
    throw new ValidationError('VALIDATION_ERROR', 'Please provide the departure time as HH:MM (00:00-23:59).');
  }
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : undefined;
  const dateError = searchDateError(dateRaw || undefined, tz);
  if (dateError) throw new ValidationError(dateError.code, dateError.message);

  const date = dateRaw || todayIn(tz);
  return {
    query: { flightNumber: flight?.canonical, airline: airlineRaw || undefined, flightDate: date, depIata: dep, arrIata: arr },
    flight,
    date,
    time: timeRaw || null,
  };
}

/** AirLabs timetable filter for a search, when the query kind has one. */
function timetableFilterFor(search: ValidatedSearch): TimetableFilter | null {
  const { query, flight } = search;
  if (flight) return flight.kind === 'IATA' ? { flight_iata: flight.canonical } : { flight_icao: flight.canonical };
  if (query.depIata && query.arrIata && !query.airline) return { dep_iata: query.depIata, arr_iata: query.arrIata };
  // Airline-only: that airline's timetable covers future dates, which the
  // real-time schedule can't (the provider returns one 50-record page).
  if (query.airline && !query.depIata && !query.arrIata) {
    const code = resolveAirlineIataFromSearchTerm(query.airline);
    if (code) return { airline_iata: code };
  }
  return null;
}

/** Whether a flight answers the search (right flight number / airports). */
function matchesSearch(f: Flight, search: ValidatedSearch): boolean {
  const { query, flight } = search;
  if (flight && ![f.flightNumber, f.flightIata, f.flightIcao].some((n) => n?.toUpperCase() === flight.canonical)) return false;
  if (!flight && query.airline) {
    const code = resolveAirlineIataFromSearchTerm(query.airline);
    if (code && (f.airline?.iata || '').toUpperCase() !== code) return false;
  }
  if (query.depIata && f.departure.iata.toUpperCase() !== query.depIata) return false;
  if (query.arrIata && f.arrival.iata.toUpperCase() !== query.arrIata) return false;
  return true;
}

/**
 * Every flight for the searched date - departed, landed or still ahead:
 *  - the airline timetable (AirLabs /routes) for that weekday, for route and
 *    flight-number searches - the only source that covers any date;
 *  - real-time schedule records (AirLabs /schedules) departing on that
 *    local date, which replace the timetable entry of the same flight leg
 *    because they carry actual status, delays and gates.
 * Airline-only and single-airport searches have no timetable query on this
 * plan, so they use the real-time schedule only (meta.coverage says so).
 * A time window is applied only when a time was selected. If one source
 * fails the other is used; if all fail the provider error is raised as is.
 */
async function dateSearch(search: ValidatedSearch, tag: string): Promise<ShapedResults> {
  const { query, date, time } = search;
  const filter = timetableFilterFor(search);
  if (config.isDev) {
    console.log(`[${tag}] request`, { ...query, departureTime: time ?? 'not selected', timetable: filter ?? 'n/a' });
  }

  const [timetable, schedules] = await Promise.allSettled([
    filter ? flightService.timetableFlightsOn(filter, date) : Promise.resolve(null),
    flightService.searchFlights(query),
  ]);
  if ((timetable.status === 'rejected' || !filter) && schedules.status === 'rejected') {
    throw timetable.status === 'rejected' ? timetable.reason : schedules.reason;
  }
  for (const [name, r] of [['/routes', timetable], ['/schedules', schedules]] as const) {
    if (r.status === 'rejected') console.warn(`[${tag}] ${name} failed (${r.reason?.code || r.reason?.statusCode || 'error'}); using the other source`);
  }

  const planned = timetable.status === 'fulfilled' && timetable.value ? timetable.value.flights.filter((f) => matchesSearch(f, search)) : [];
  const live = (schedules.status === 'fulfilled' ? schedules.value : []).filter(
    (f) => matchesSearch(f, search) && localDepartureDate(f) === date
  );
  const legKey = (f: Flight) => `${(f.flightIata || f.flightNumber).toUpperCase()}|${f.departure.iata}|${f.arrival.iata}`;
  const liveLegs = new Set(live.map(legKey));
  const dayFlights = [...live, ...planned.filter((f) => !liveLegs.has(legKey(f)))];

  const inWindow = time ? timeWindowFilter(date, time) : () => true;
  const kept = dayFlights.filter(inWindow);
  const flights = collapseCodeshares(kept).sort(byDeparture);
  const coverage = filter && timetable.status === 'fulfilled' ? 'FULL_DAY' : 'REALTIME_WINDOW';
  if (config.isDev) {
    console.log(`[${tag}] Date: ${date}${time ? ` | Time: ${time} (+${TIME_WINDOW_HOURS}h local)` : ' | Time: not selected (whole day)'} | timetable that day: ${planned.length} | real-time that day: ${live.length} | merged: ${dayFlights.length} | in window: ${kept.length} | after codeshare grouping: ${flights.length} | coverage: ${coverage}`);
  }
  return {
    flights,
    providerResults: dayFlights.length,
    window: time ? 'TIME' : 'DATE',
    searchedDate: date,
    selectedTime: time,
    outsideWindow: time ? collapseCodeshares(dayFlights.filter((f) => !inWindow(f))).sort(byDeparture) : [],
    coverage,
    truncated: flightService.wasTruncated(query, filter),
    provider: { ...flightService.providerPagesFor(query, filter), paginationAvailable: false },
  };
}

function toAlternative(f: Flight): AlternativeFlight {
  return {
    id: f.id,
    flightNumber: f.flightNumber,
    airline: f.airline?.name || '',
    flightDate: f.flightDate,
    departureTime: f.departure.estimatedTime || f.departure.scheduledTime || null,
    localDepartureTime: f.departure.estimatedLocal || f.departure.scheduledLocal || null,
    status: f.status,
    depIata: f.departure.iata,
    arrIata: f.arrival.iata,
  };
}

/**
 * Describes the outcome for the UI. Everything here comes from the provider
 * response or airport reference data - nothing is inferred about schedules.
 * An airport is only called invalid when AirLabs itself says no airport has
 * that code; airports are looked up remotely only when the search is empty.
 */
async function buildMeta(shaped: ShapedResults, depIata?: string, arrIata?: string): Promise<FlightSearchMeta> {
  const isRoute = Boolean(depIata || arrIata);
  const empty = shaped.flights.length === 0;
  const lookup = (code?: string) =>
    code ? flightService.lookupAirport(code, { remote: empty, withCity: empty }) : Promise.resolve(undefined);
  const [departure, arrival] = isRoute ? await Promise.all([lookup(depIata), lookup(arrIata)]) : [undefined, undefined];

  const invalidDeparture = Boolean(depIata) && empty && shaped.providerResults === 0 && departure === null;
  const invalidArrival = Boolean(arrIata) && empty && shaped.providerResults === 0 && arrival === null;

  const searchStatus: FlightSearchMeta['searchStatus'] = !empty
    ? 'FLIGHTS_FOUND'
    : invalidDeparture
    ? 'INVALID_DEPARTURE_AIRPORT'
    : invalidArrival
    ? 'INVALID_ARRIVAL_AIRPORT'
    : shaped.providerResults > 0
    ? 'NO_FLIGHTS_IN_TIME_WINDOW'
    : 'NO_FLIGHTS_FROM_PROVIDER';

  // An airport that couldn't be confirmed is sent as null (no placeholder
  // record); the UI shows the searched code for it.
  const described = (code: string | undefined, a: typeof departure) => (code && a ? a : null);

  return {
    searchStatus,
    providerResults: shaped.providerResults,
    window: shaped.window,
    searchedDate: shaped.searchedDate,
    selectedTime: shaped.selectedTime,
    windowHours: shaped.window === 'TIME' ? TIME_WINDOW_HOURS : null,
    airportsRecognized: isRoute ? (!depIata || Boolean(departure)) && (!arrIata || Boolean(arrival)) : false,
    route: isRoute ? { departure: described(depIata, departure), arrival: described(arrIata, arrival) } : null,
    unknownAirports: [invalidDeparture ? depIata : null, invalidArrival ? arrIata : null].filter((c): c is string => Boolean(c)),
    alternatives: empty ? shaped.outsideWindow.slice(0, MAX_ALTERNATIVES).map(toAlternative) : [],
    coverage: shaped.coverage,
    truncated: shaped.truncated,
    provider: shaped.provider,
  };
}

function sendValidationError(res: Response, err: ValidationError): void {
  res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
}

async function respondWithSearch(res: Response, next: NextFunction, raw: Record<string, unknown>, tag: string): Promise<void> {
  let search: ValidatedSearch;
  try {
    search = validateSearch(raw);
  } catch (err) {
    if (err instanceof ValidationError) {
      if (config.isDev) console.log(`[${tag}] rejected before any provider call: ${err.code}`);
      return sendValidationError(res, err);
    }
    return next(err);
  }
  try {
    const shaped = await dateSearch(search, tag);
    const response: ApiResponse<Flight[]> = {
      success: true,
      data: shaped.flights,
      total: shaped.flights.length,
      meta: await buildMeta(shaped, search.query.depIata, search.query.arrIata),
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export class FlightController {
  /**
   * GET /api/flights/search
   *   ?flightNumber | airline | depIata & arrIata   (at least one)
   *   &flightDate=YYYY-MM-DD   today..today+7 in the user's zone (default today)
   *   &departureTime=HH:MM     optional; without it the whole day is returned
   *   &timeZone=<IANA>         the user's zone, for judging "today"
   */
  public static async searchFlights(req: Request, res: Response, next: NextFunction): Promise<void> {
    const tag = req.query.depIata || req.query.arrIata ? 'RouteSearch' : 'FlightSearch';
    return respondWithSearch(res, next, req.query as Record<string, unknown>, tag);
  }

  /**
   * GET /api/flights/route?depIata&arrIata&flightDate&departureTime&timeZone
   * Same contract as /search, both airports required.
   */
  public static async searchByRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { depIata, arrIata, flightDate, departureTime, timeZone } = req.query;
    if (!depIata || !arrIata) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_ROUTE_PARAMETERS', message: 'Both departure (depIata) and arrival (arrIata) airport codes are required.' },
      });
      return;
    }
    return respondWithSearch(res, next, { depIata, arrIata, flightDate, departureTime, timeZone }, 'RouteSearch');
  }

  /**
   * GET /api/flights/:flightNumber?flightDate&depIata&arrIata&timeZone
   * One flight instance. With flightDate, only that date's instance is ever
   * returned (404 when it doesn't operate that day); the date must be
   * inside the 7-day window. depIata/arrIata pin the leg.
   */
  public static async getFlightDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const flight = parseFlightNumber(req.params.flightNumber);
      if (!flight) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid flight number, e.g. 6E6372, 6E 6372 or AI101.' },
        });
        return;
      }
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      const date = str(req.query.flightDate);
      const dep = str(req.query.depIata)?.toUpperCase();
      const arr = str(req.query.arrIata)?.toUpperCase();
      const tz = str(req.query.timeZone);
      for (const code of [dep, arr]) {
        if (code && !AIRPORT_CODE.test(code)) {
          res.status(400).json({ success: false, error: { code: 'INVALID_AIRPORT_CODE', message: 'Airport codes must be 3-letter IATA codes.' } });
          return;
        }
      }
      const dateError = searchDateError(date, tz && isValidTimeZone(tz) ? tz : undefined);
      if (dateError) {
        res.status(400).json({ success: false, error: { code: dateError.code, message: dateError.message } });
        return;
      }

      let found = await flightService.getFlightByNumber(flight.canonical, date, dep, arr);

      // The real-time schedule covers a window around now; for another day,
      // the timetable gives that day's instance (never another day's).
      if (!found && date) {
        const filter: TimetableFilter = dep && arr
          ? { dep_iata: dep, arr_iata: arr }
          : flight.kind === 'IATA' ? { flight_iata: flight.canonical } : { flight_icao: flight.canonical };
        const { flights } = await flightService.timetableFlightsOn(filter, date);
        found = flights.find((f) =>
          [f.flightNumber, f.flightIata, f.flightIcao].some((n) => n?.toUpperCase() === flight.canonical) &&
          (!dep || f.departure.iata === dep) && (!arr || f.arrival.iata === arr)
        ) || null;
      }

      if (!found) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FLIGHT_NOT_FOUND',
            message: date
              ? `${flight.canonical} is not scheduled on ${date}${dep && arr ? ` (${dep} → ${arr})` : ''}.`
              : `No matching flight found for "${flight.canonical}". Please check the flight number or date.`,
          },
        });
        return;
      }

      const response: ApiResponse<Flight> = { success: true, data: found };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
