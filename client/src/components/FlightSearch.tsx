import React, { useState } from 'react';
import { FlightSearchFilters } from '../types/flight';
import { AirportAutocomplete } from './AirportAutocomplete';
import { resolveToIata, formatAirportDisplay, findAmbiguousAirports, AIRPORT_DATABASE } from '../data/airportDatabase';
import { Search, RotateCcw, Calendar, Building2, Hash, Sparkles, ArrowRightLeft } from 'lucide-react';

interface FlightSearchProps {
  onSearch: (filters: FlightSearchFilters) => void;
  onReset: () => void;
  isLoading: boolean;
  initialFilters?: FlightSearchFilters | null;
}

const SAMPLE_QUERIES = [
  { label: 'HYD → DEL', mode: 'route' as const, flightNumber: '', airline: '', depDisplay: 'Hyderabad (HYD)', arrDisplay: 'Delhi (DEL)', depIata: 'HYD', arrIata: 'DEL' },
  { label: 'BOM → BLR', mode: 'route' as const, flightNumber: '', airline: '', depDisplay: 'Mumbai (BOM)', arrDisplay: 'Bengaluru (BLR)', depIata: 'BOM', arrIata: 'BLR' },
  { label: 'DEL → MAA', mode: 'route' as const, flightNumber: '', airline: '', depDisplay: 'Delhi (DEL)', arrDisplay: 'Chennai (MAA)', depIata: 'DEL', arrIata: 'MAA' },
  { label: 'LHR → JFK', mode: 'route' as const, flightNumber: '', airline: '', depDisplay: 'London Heathrow (LHR)', arrDisplay: 'New York JFK (JFK)', depIata: 'LHR', arrIata: 'JFK' },
  { label: 'AI101 (Air India)', mode: 'flight' as const, flightNumber: 'AI101', airline: 'Air India', depDisplay: '', arrDisplay: '', depIata: '', arrIata: '' },
  { label: '6E502 (IndiGo)', mode: 'flight' as const, flightNumber: '6E502', airline: 'IndiGo', depDisplay: '', arrDisplay: '', depIata: '', arrIata: '' },
  { label: 'BA249 (British Airways)', mode: 'flight' as const, flightNumber: 'BA249', airline: 'British Airways', depDisplay: '', arrDisplay: '', depIata: '', arrIata: '' },
];

export const FlightSearch: React.FC<FlightSearchProps> = ({
  onSearch,
  onReset,
  isLoading,
  initialFilters,
}) => {
  const [mode, setMode] = useState<'flight' | 'route'>(initialFilters?.mode || 'flight');
  const [flightNumber, setFlightNumber] = useState(initialFilters?.flightNumber || '');
  const [airline, setAirline] = useState(initialFilters?.airline || '');
  const [flightDate, setFlightDate] = useState(
    initialFilters?.flightDate || new Date().toISOString().split('T')[0]
  );

  // Route search state: store user input / display value + resolved IATA code
  const [depDisplay, setDepDisplay] = useState(() => {
    if (!initialFilters?.depIata) return '';
    const airport = AIRPORT_DATABASE.find((a) => a.iata === initialFilters.depIata);
    return airport ? formatAirportDisplay(airport) : initialFilters.depIata;
  });
  const [depIata, setDepIata] = useState(initialFilters?.depIata || '');

  const [arrDisplay, setArrDisplay] = useState(() => {
    if (!initialFilters?.arrIata) return '';
    const airport = AIRPORT_DATABASE.find((a) => a.iata === initialFilters.arrIata);
    return airport ? formatAirportDisplay(airport) : initialFilters.arrIata;
  });
  const [arrIata, setArrIata] = useState(initialFilters?.arrIata || '');

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleModeChange = (newMode: 'flight' | 'route') => {
    setMode(newMode);
    setValidationError(null);
  };

  const handleDepChange = (displayValue: string, code: string | null) => {
    setDepDisplay(displayValue);
    setDepIata(code || resolveToIata(displayValue) || '');
    setValidationError(null);
  };

  const handleArrChange = (displayValue: string, code: string | null) => {
    setArrDisplay(displayValue);
    setArrIata(code || resolveToIata(displayValue) || '');
    setValidationError(null);
  };

  const handleSwapAirports = () => {
    const tempDisplay = depDisplay;
    const tempIata = depIata;
    setDepDisplay(arrDisplay);
    setDepIata(arrIata);
    setArrDisplay(tempDisplay);
    setArrIata(tempIata);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (mode === 'flight') {
      if (!flightNumber.trim() && !airline.trim()) {
        setValidationError('Please enter a flight number (e.g. AI101, 6E502) or airline name.');
        return;
      }

      onSearch({
        mode: 'flight',
        flightNumber: flightNumber.trim(),
        airline: airline.trim(),
        flightDate,
        depIata: '',
        arrIata: '',
      });
    } else {
      // Resolve IATA codes if user typed directly without selecting dropdown
      const finalDepIata = (depIata || resolveToIata(depDisplay) || '').trim().toUpperCase();
      const finalArrIata = (arrIata || resolveToIata(arrDisplay) || '').trim().toUpperCase();

      const ambiguous = [depIata ? '' : depDisplay, arrIata ? '' : arrDisplay]
        .map((text) => ({ text: text.trim(), airports: findAmbiguousAirports(text) }))
        .find((a) => a.airports.length > 0);
      if (ambiguous) {
        setValidationError(
          `"${ambiguous.text}" matches several airports (${ambiguous.airports.map((a) => a.iata).join(', ')}). Please choose one from the list.`
        );
        return;
      }

      if (!finalDepIata || !finalArrIata) {
        setValidationError(
          'Please enter both departure and arrival airports or cities (e.g. Hyderabad, Delhi).'
        );
        return;
      }

      if (finalDepIata === finalArrIata) {
        setValidationError('Departure and arrival airports must be different.');
        return;
      }

      onSearch({
        mode: 'route',
        flightNumber: '',
        airline: '',
        flightDate,
        depIata: finalDepIata,
        arrIata: finalArrIata,
      });
    }
  };

  const handleReset = () => {
    setFlightNumber('');
    setAirline('');
    setDepDisplay('');
    setDepIata('');
    setArrDisplay('');
    setArrIata('');
    setFlightDate(new Date().toISOString().split('T')[0]);
    setValidationError(null);
    onReset();
  };

  const applySample = (sample: typeof SAMPLE_QUERIES[0]) => {
    setMode(sample.mode);
    setFlightNumber(sample.flightNumber);
    setAirline(sample.airline);
    setDepDisplay(sample.depDisplay);
    setDepIata(sample.depIata);
    setArrDisplay(sample.arrDisplay);
    setArrIata(sample.arrIata);
    setValidationError(null);

    onSearch({
      mode: sample.mode,
      flightNumber: sample.flightNumber,
      airline: sample.airline,
      flightDate,
      depIata: sample.depIata,
      arrIata: sample.arrIata,
    });
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Search Header & Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-600" />
            Flight Status & Tracker Search
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status, schedules, and live route tracking
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleModeChange('flight')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'flight'
                ? 'bg-white text-sky-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Search by Flight
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('route')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'route'
                ? 'bg-white text-sky-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Search by Route
          </button>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'flight' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Flight Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-sky-600" />
                Flight Number
              </label>
              <input
                type="text"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="e.g. 6E6372, AI101, BA249"
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-sm font-mono uppercase"
              />
            </div>

            {/* Airline */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                Airline / Carrier (Optional)
              </label>
              <input
                type="text"
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                placeholder="e.g. IndiGo, Air India, Emirates"
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-sm"
              />
            </div>
          </div>
        ) : (
          <div className="relative space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
              {/* Departure Smart Autocomplete */}
              <AirportAutocomplete
                label="From (Origin)"
                placeholder="Type city or airport (e.g. Hyderabad, HYD)"
                value={depDisplay}
                onChange={handleDepChange}
                iconColor="text-sky-600"
              />

              {/* Arrival Smart Autocomplete */}
              <AirportAutocomplete
                label="To (Destination)"
                placeholder="Type city or airport (e.g. Delhi, DEL)"
                value={arrDisplay}
                onChange={handleArrChange}
                iconColor="text-emerald-600"
              />
            </div>

            {/* Swap Origin / Destination Button */}
            {depDisplay && arrDisplay && (
              <div className="flex justify-center -mt-2">
                <button
                  type="button"
                  onClick={handleSwapAirports}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-sky-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1 rounded-full transition shadow-2xs"
                  title="Swap Departure and Arrival"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Swap Airports</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Date Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            Flight Date
          </label>
          <input
            type="date"
            value={flightDate}
            onChange={(e) => setFlightDate(e.target.value)}
            aria-describedby="flight-date-hint"
            className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none transition shadow-sm"
          />
          <p id="flight-date-hint" className="text-[11px] text-slate-500">
            Live schedules cover flights in the air now and departing in the coming hours.
          </p>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 font-medium flex items-center gap-2">
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold py-3 px-5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-white" />
            )}
            <span>Search Flights</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all text-sm font-medium flex items-center gap-1.5 shrink-0"
            title="Reset search fields"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </form>

      {/* Quick Test Search Chips */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-semibold text-slate-700">Popular Quick Searches:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUERIES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySample(sample)}
              className="text-xs bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition font-medium font-mono"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
