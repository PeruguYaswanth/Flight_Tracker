/**
 * Flight-number input handling shared by search, details and live tracking.
 * "6E6372", "6e 6372" and "6E-6372" are the same flight; anything that is
 * not a flight number is rejected before any provider call.
 */

// IATA: 2-character airline designator (may contain one digit: 6E, G8, I5)
// + 1-4 digits + optional operational suffix letter.
const IATA_FLIGHT = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])(\d{1,4})([A-Z]?)$/;
// ICAO: 3-letter airline designator + 1-4 digits + optional suffix (UAE527, IGO6372).
const ICAO_FLIGHT = /^([A-Z]{3})(\d{1,4})([A-Z]?)$/;
// Live callsigns may be alphanumeric after the designator (IGO274E, BAW82E).
const CALLSIGN = /^[A-Z]{3}[A-Z0-9]{1,5}$/;

export interface ParsedFlightNumber {
  /** Canonical form: uppercase, no separators, leading zeros kept as typed. */
  canonical: string;
  kind: 'IATA' | 'ICAO';
  airline: string;
  /** Numeric part without leading zeros ("0017" -> "17"). */
  number: string;
  suffix: string;
}

/** Parses user input into a flight number, or null when it isn't one. */
export function parseFlightNumber(raw: unknown): ParsedFlightNumber | null {
  if (typeof raw !== 'string') return null;
  const canonical = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!canonical || canonical.length > 8) return null;
  const iata = canonical.match(IATA_FLIGHT);
  if (iata) return { canonical, kind: 'IATA', airline: iata[1], number: String(Number(iata[2])), suffix: iata[3] };
  const icao = canonical.match(ICAO_FLIGHT);
  if (icao) return { canonical, kind: 'ICAO', airline: icao[1], number: String(Number(icao[2])), suffix: icao[3] };
  return null;
}

/** Normalizes a callsign-like value ("IGO 6372 " -> "IGO6372"), or null when malformed. */
export function parseCallsign(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  return CALLSIGN.test(cleaned) ? cleaned : null;
}

/** Airline-name search text: letters, digits, spaces and simple punctuation. */
export function isValidAirlineQuery(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[\p{L}\p{N} .&'()-]{2,60}$/u.test(raw.trim());
}
