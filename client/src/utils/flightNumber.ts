// Same rules as the server (server/src/utils/flightNumber.ts): an IATA
// flight number (2-character airline code, may contain one digit: 6E, G8)
// or an ICAO one (3 letters), then 1-4 digits and an optional suffix.
const FLIGHT_NUMBER = /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z]|[A-Z]{3})\d{1,4}[A-Z]?$/;

/** "6e 6372" / "6E-6372" -> "6E6372"; null when the text isn't a flight number. */
export function normalizeFlightNumber(input: string): string | null {
  const canonical = input.trim().toUpperCase().replace(/[\s-]+/g, '');
  return canonical.length <= 8 && FLIGHT_NUMBER.test(canonical) ? canonical : null;
}
