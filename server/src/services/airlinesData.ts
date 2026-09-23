export interface AirlineReference {
  name: string;
  iata: string;
  icao: string;
}

// Static reference data (real, public airline codes/names - not
// flight-specific data, same category as airportsData.ts). AirLabs'
// schedule endpoint returns airline_iata/airline_icao codes but not a
// display name, so this fills that in without fabricating anything
// flight-specific. Airlines not listed simply fall back to their raw code.
export const AIRLINES: AirlineReference[] = [
  { name: 'Air India', iata: 'AI', icao: 'AIC' },
  { name: 'IndiGo', iata: '6E', icao: 'IGO' },
  { name: 'Vistara', iata: 'UK', icao: 'VTI' },
  { name: 'SpiceJet', iata: 'SG', icao: 'SEJ' },
  { name: 'Air India Express', iata: 'IX', icao: 'AXB' },
  { name: 'GoAir (Go First)', iata: 'G8', icao: 'GOW' },
  { name: 'AirAsia India', iata: 'I5', icao: 'IAD' },
  { name: 'British Airways', iata: 'BA', icao: 'BAW' },
  { name: 'Emirates', iata: 'EK', icao: 'UAE' },
  { name: 'Etihad Airways', iata: 'EY', icao: 'ETD' },
  { name: 'Qatar Airways', iata: 'QR', icao: 'QTR' },
  { name: 'Singapore Airlines', iata: 'SQ', icao: 'SIA' },
  { name: 'Lufthansa', iata: 'LH', icao: 'DLH' },
  { name: 'Air France', iata: 'AF', icao: 'AFR' },
  { name: 'KLM', iata: 'KL', icao: 'KLM' },
  { name: 'American Airlines', iata: 'AA', icao: 'AAL' },
  { name: 'United Airlines', iata: 'UA', icao: 'UAL' },
  { name: 'Delta Air Lines', iata: 'DL', icao: 'DAL' },
  { name: 'Turkish Airlines', iata: 'TK', icao: 'THY' },
  { name: 'Qantas', iata: 'QF', icao: 'QFA' },
  { name: 'Virgin Atlantic', iata: 'VS', icao: 'VIR' },
  { name: 'Cathay Pacific', iata: 'CX', icao: 'CPA' },
  { name: 'Thai Airways', iata: 'TG', icao: 'THA' },
  { name: 'Malaysia Airlines', iata: 'MH', icao: 'MAS' },
  { name: 'ANA', iata: 'NH', icao: 'ANA' },
  { name: 'Japan Airlines', iata: 'JL', icao: 'JAL' },
  { name: 'Korean Air', iata: 'KE', icao: 'KAL' },
  { name: 'China Southern Airlines', iata: 'CZ', icao: 'CSN' },
];

const byIata = new Map(AIRLINES.map((a) => [a.iata.toUpperCase(), a]));
const byIcao = new Map(AIRLINES.map((a) => [a.icao.toUpperCase(), a]));
const byNameLower = new Map(AIRLINES.map((a) => [a.name.toLowerCase(), a]));

export function getAirlineByCode(iata?: string | null, icao?: string | null): AirlineReference | null {
  if (iata) {
    const hit = byIata.get(iata.toUpperCase());
    if (hit) return hit;
  }
  if (icao) {
    const hit = byIcao.get(icao.toUpperCase());
    if (hit) return hit;
  }
  return null;
}

/**
 * Best-effort resolution of a free-text airline search term to a known
 * IATA code, for building an AirLabs `airline_iata` filter. Returns null
 * (never guesses) when there is no confident match - callers must handle
 * that by omitting the filter rather than sending a made-up code.
 */
export function resolveAirlineIataFromSearchTerm(term: string): string | null {
  const trimmed = term.trim();
  if (!trimmed) return null;

  // Already looks like an IATA code (2 letters, optionally + 1 digit).
  if (/^[A-Za-z0-9]{2,3}$/.test(trimmed) && byIata.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  const exact = byNameLower.get(trimmed.toLowerCase());
  if (exact) return exact.iata;

  const partial = AIRLINES.find((a) => a.name.toLowerCase().includes(trimmed.toLowerCase()));
  return partial ? partial.iata : null;
}
