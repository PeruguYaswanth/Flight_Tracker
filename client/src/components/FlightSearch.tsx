import React, { useState } from 'react';
import { FlightSearchFilters } from '../types/flight';
import { Search, RotateCcw, Plane, MapPin, Calendar, Building2, Hash, Sparkles } from 'lucide-react';

interface FlightSearchProps {
  onSearch: (filters: FlightSearchFilters) => void;
  onReset: () => void;
  isLoading: boolean;
}

const SAMPLE_QUERIES = [
  { label: 'AI101 (Air India)', mode: 'flight' as const, flightNumber: 'AI101', airline: 'Air India', depIata: '', arrIata: '' },
  { label: '6E502 (IndiGo)', mode: 'flight' as const, flightNumber: '6E502', airline: 'IndiGo', depIata: '', arrIata: '' },
  { label: 'BA249 (British Airways)', mode: 'flight' as const, flightNumber: 'BA249', airline: 'British Airways', depIata: '', arrIata: '' },
  { label: 'HYD → DEL', mode: 'route' as const, flightNumber: '', airline: '', depIata: 'HYD', arrIata: 'DEL' },
  { label: 'BOM → BLR', mode: 'route' as const, flightNumber: '', airline: '', depIata: 'BOM', arrIata: 'BLR' },
  { label: 'LHR → JFK', mode: 'route' as const, flightNumber: '', airline: '', depIata: 'LHR', arrIata: 'JFK' },
];

export const FlightSearch: React.FC<FlightSearchProps> = ({
  onSearch,
  onReset,
  isLoading,
}) => {
  const [mode, setMode] = useState<'flight' | 'route'>('flight');
  const [flightNumber, setFlightNumber] = useState('');
  const [airline, setAirline] = useState('');
  const [flightDate, setFlightDate] = useState(new Date().toISOString().split('T')[0]);
  const [depIata, setDepIata] = useState('');
  const [arrIata, setArrIata] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleModeChange = (newMode: 'flight' | 'route') => {
    setMode(newMode);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (mode === 'flight') {
      if (!flightNumber.trim() && !airline.trim()) {
        setValidationError('Please enter a flight number or airline name.');
        return;
      }
    } else {
      if (!depIata.trim() || !arrIata.trim()) {
        setValidationError('Please enter both departure and arrival airport codes.');
        return;
      }
      if (depIata.trim().toUpperCase() === arrIata.trim().toUpperCase()) {
        setValidationError('Departure and arrival airports must be different.');
        return;
      }
    }

    onSearch({
      mode,
      flightNumber: flightNumber.trim(),
      airline: airline.trim(),
      flightDate,
      depIata: depIata.trim().toUpperCase(),
      arrIata: arrIata.trim().toUpperCase(),
    });
  };

  const handleReset = () => {
    setFlightNumber('');
    setAirline('');
    setDepIata('');
    setArrIata('');
    setFlightDate(new Date().toISOString().split('T')[0]);
    setValidationError(null);
    onReset();
  };

  const applySample = (sample: typeof SAMPLE_QUERIES[0]) => {
    setMode(sample.mode);
    setFlightNumber(sample.flightNumber);
    setAirline(sample.airline);
    setDepIata(sample.depIata);
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Search Header and Tabs */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            Search Flights
          </h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => handleModeChange('flight')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              mode === 'flight'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Flight Number
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('route')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              mode === 'route'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Route Search
          </button>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'flight' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Flight Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                Flight Number
              </label>
              <input
                type="text"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="e.g. AI101 or 6E502"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
              />
            </div>

            {/* Airline */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                Airline / Carrier
              </label>
              <input
                type="text"
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                placeholder="e.g. Air India, IndiGo, BA"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Departure Airport */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                Departure Airport (IATA)
              </label>
              <input
                type="text"
                value={depIata}
                maxLength={4}
                onChange={(e) => setDepIata(e.target.value.toUpperCase())}
                placeholder="e.g. HYD, BOM, LHR"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 uppercase font-mono transition"
              />
            </div>

            {/* Arrival Airport */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-emerald-400 rotate-45" />
                Arrival Airport (IATA)
              </label>
              <input
                type="text"
                value={arrIata}
                maxLength={4}
                onChange={(e) => setArrIata(e.target.value.toUpperCase())}
                placeholder="e.g. DEL, BLR, JFK"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 uppercase font-mono transition"
              />
            </div>
          </div>
        )}

        {/* Date Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            Flight Date
          </label>
          <input
            type="date"
            value={flightDate}
            onChange={(e) => setFlightDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
          />
        </div>

        {/* Validation Alert */}
        {validationError && (
          <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2 font-medium">
            {validationError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-slate-950" />
            )}
            <span>Search Flights</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all text-sm font-medium flex items-center gap-1.5 active:scale-[0.98]"
            title="Reset search fields"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </form>

      {/* Quick Demo Search Chips */}
      <div className="mt-5 pt-4 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-medium text-slate-300">Quick Test Searches:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUERIES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySample(sample)}
              className="text-xs bg-slate-950 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-700/50 px-2.5 py-1 rounded-lg transition-all font-mono"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
