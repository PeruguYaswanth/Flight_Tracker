import React from 'react';
import { Flight } from '../types/flight';
import { FlightCard } from './FlightCard';
import { PlaneTakeoff, Info } from 'lucide-react';

interface FlightResultsProps {
  flights: Flight[];
  selectedFlight: Flight | null;
  onSelectFlight: (flight: Flight) => void;
}

export const FlightResults: React.FC<FlightResultsProps> = ({
  flights,
  selectedFlight,
  onSelectFlight,
}) => {
  return (
    <div className="space-y-4">
      {/* Results Header Info Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
        <span className="font-bold uppercase tracking-wider flex items-center gap-2 text-slate-800">
          <PlaneTakeoff className="w-4 h-4 text-sky-600" />
          Available Flight Results ({flights.length})
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Click any flight to view radar & live telemetry
        </span>
      </div>

      {/* Flight Cards Grid / List */}
      <div className="space-y-3">
        {flights.map((flight) => (
          <FlightCard
            key={flight.id}
            flight={flight}
            isSelected={selectedFlight?.id === flight.id}
            onSelect={onSelectFlight}
          />
        ))}
      </div>
    </div>
  );
};
