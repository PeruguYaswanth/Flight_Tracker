import { getAirportCoords } from './airportsData';

/**
 * IANA time zones for the reference airports (static reference data, like
 * their coordinates). AirLabs' airport records carry no time zone on this
 * plan, so this is what lets a timetable time on a given date be converted
 * with that date's DST rules. Airports not covered return null and callers
 * fall back to the provider's own local/UTC time pair.
 */

// Countries in the reference table that use a single zone.
const COUNTRY_ZONES: Record<string, string> = {
  India: 'Asia/Kolkata',
  'United Kingdom': 'Europe/London',
  China: 'Asia/Shanghai',
  Germany: 'Europe/Berlin',
  'United Arab Emirates': 'Asia/Dubai',
  'Saudi Arabia': 'Asia/Riyadh',
  Thailand: 'Asia/Bangkok',
  Japan: 'Asia/Tokyo',
  Italy: 'Europe/Rome',
  France: 'Europe/Paris',
  Vietnam: 'Asia/Ho_Chi_Minh',
  Turkey: 'Europe/Istanbul',
  Switzerland: 'Europe/Zurich',
  'South Korea': 'Asia/Seoul',
  'South Africa': 'Africa/Johannesburg',
  'New Zealand': 'Pacific/Auckland',
  Taiwan: 'Asia/Taipei',
  Sweden: 'Europe/Stockholm',
  'Sri Lanka': 'Asia/Colombo',
  Singapore: 'Asia/Singapore',
  Qatar: 'Asia/Qatar',
  Poland: 'Europe/Warsaw',
  Philippines: 'Asia/Manila',
  Peru: 'America/Lima',
  Oman: 'Asia/Muscat',
  Norway: 'Europe/Oslo',
  Nigeria: 'Africa/Lagos',
  Netherlands: 'Europe/Amsterdam',
  Nepal: 'Asia/Kathmandu',
  Morocco: 'Africa/Casablanca',
  Maldives: 'Indian/Maldives',
  Malaysia: 'Asia/Kuala_Lumpur',
  Kuwait: 'Asia/Kuwait',
  Kenya: 'Africa/Nairobi',
  Jordan: 'Asia/Amman',
  Israel: 'Asia/Jerusalem',
  Ireland: 'Europe/Dublin',
  Hungary: 'Europe/Budapest',
  'Hong Kong': 'Asia/Hong_Kong',
  Greece: 'Europe/Athens',
  Ghana: 'Africa/Accra',
  Finland: 'Europe/Helsinki',
  Ethiopia: 'Africa/Addis_Ababa',
  Egypt: 'Africa/Cairo',
  Denmark: 'Europe/Copenhagen',
  'Czech Republic': 'Europe/Prague',
  Colombia: 'America/Bogota',
  Chile: 'America/Santiago',
  Belgium: 'Europe/Brussels',
  Bangladesh: 'Asia/Dhaka',
  Bahrain: 'Asia/Bahrain',
  Austria: 'Europe/Vienna',
  Argentina: 'America/Argentina/Buenos_Aires',
};

// Airports in countries with several zones (or an exception to the country zone).
const AIRPORT_ZONES: Record<string, string> = {
  // United States
  JFK: 'America/New_York', EWR: 'America/New_York', LGA: 'America/New_York', BOS: 'America/New_York',
  IAD: 'America/New_York', DCA: 'America/New_York', MIA: 'America/New_York', FLL: 'America/New_York',
  ATL: 'America/New_York', MCO: 'America/New_York', CLT: 'America/New_York', DTW: 'America/Detroit',
  TPA: 'America/New_York', PHL: 'America/New_York',
  ORD: 'America/Chicago', MDW: 'America/Chicago', DFW: 'America/Chicago', DAL: 'America/Chicago',
  IAH: 'America/Chicago', MSP: 'America/Chicago',
  DEN: 'America/Denver', SLC: 'America/Denver', PHX: 'America/Phoenix',
  LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', OAK: 'America/Los_Angeles', SJC: 'America/Los_Angeles',
  SEA: 'America/Los_Angeles', LAS: 'America/Los_Angeles', SAN: 'America/Los_Angeles',
  HNL: 'Pacific/Honolulu',
  // Canada
  YYZ: 'America/Toronto', YUL: 'America/Toronto', YVR: 'America/Vancouver', YYC: 'America/Edmonton',
  // Mexico
  MEX: 'America/Mexico_City', CUN: 'America/Cancun',
  // Brazil
  GRU: 'America/Sao_Paulo', GIG: 'America/Sao_Paulo',
  // Indonesia
  CGK: 'Asia/Jakarta', DPS: 'Asia/Makassar',
  // Australia
  SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', BNE: 'Australia/Brisbane', PER: 'Australia/Perth',
  ADL: 'Australia/Adelaide',
};

const SPLIT_COUNTRIES = new Set(['United States', 'Canada', 'Mexico', 'Brazil', 'Indonesia', 'Australia', 'Spain', 'Portugal']);
const MAINLAND_ZONES: Record<string, string> = { Spain: 'Europe/Madrid', Portugal: 'Europe/Lisbon' };
// Canary Islands / Madeira / Azores airports sometimes present in data.
const ISLAND_ZONES: Record<string, string> = {
  LPA: 'Atlantic/Canary', TFS: 'Atlantic/Canary', TFN: 'Atlantic/Canary', ACE: 'Atlantic/Canary', FUE: 'Atlantic/Canary',
  FNC: 'Atlantic/Madeira', PDL: 'Atlantic/Azores',
};

/** IANA time zone of an airport from the reference data, or null when unknown. */
export function airportTimeZone(iata?: string | null): string | null {
  if (!iata) return null;
  const code = iata.trim().toUpperCase();
  if (AIRPORT_ZONES[code]) return AIRPORT_ZONES[code];
  if (ISLAND_ZONES[code]) return ISLAND_ZONES[code];
  const airport = getAirportCoords(code);
  if (!airport) return null;
  if (MAINLAND_ZONES[airport.country]) return MAINLAND_ZONES[airport.country];
  if (SPLIT_COUNTRIES.has(airport.country)) return null;
  return COUNTRY_ZONES[airport.country] ?? null;
}
