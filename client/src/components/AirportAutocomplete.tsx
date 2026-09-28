import React, { useState, useRef, useEffect } from 'react';
import { Plane, MapPin, X, Check } from 'lucide-react';
import {
  AirportRecord,
  searchAirports,
  formatAirportDisplay,
  resolveToIata,
} from '../data/airportDatabase';

interface AirportAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (displayValue: string, iataCode: string | null) => void;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const AirportAutocomplete: React.FC<AirportAutocompleteProps> = ({
  label,
  placeholder = 'City name, airport, or code (e.g. Hyderabad, HYD)',
  value,
  onChange,
  icon: Icon = MapPin,
  iconColor = 'text-sky-600',
  disabled = false,
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AirportRecord[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search when value changes or user focuses
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Strip bracketed IATA code if searching after selection
    const cleanQuery = value.replace(/\s*\([A-Za-z]{3}\)\s*$/, '').trim();
    if (cleanQuery.length > 0) {
      const results = searchAirports(cleanQuery, 6);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [value]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const resolvedIata = resolveToIata(text);
    onChange(text, resolvedIata);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleSelect = (airport: AirportRecord) => {
    const formatted = formatAirportDisplay(airport);
    onChange(formatted, airport.iata);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', null);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const currentIata = resolveToIata(value);

  return (
    <div ref={containerRef} className={`relative space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          {label}
        </label>
        {currentIata && (
          <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            IATA: {currentIata}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-sm pr-16"
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Clear field"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Select Airport / City</span>
            <span>IATA Code</span>
          </div>

          {suggestions.map((airport, idx) => {
            const isHighlighted = idx === highlightedIndex;
            const isSelected = currentIata === airport.iata;

            return (
              <div
                key={airport.iata}
                onClick={() => handleSelect(airport)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-3 text-left ${
                  isHighlighted ? 'bg-sky-50/80 text-sky-950' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900 leading-snug">
                      {airport.city}
                    </span>
                    <span className="text-xs text-slate-500">· {airport.country}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[280px] sm:max-w-sm flex items-center gap-1">
                    <Plane className="w-3 h-3 text-slate-400 shrink-0 rotate-45" />
                    <span className="truncate">{airport.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200 tracking-wider">
                    {airport.iata}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
