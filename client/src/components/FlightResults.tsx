import React from 'react';
import { Flight } from '../types/flight';
import { FlightCard } from './FlightCard';
import { PlaneTakeoff } from 'lucide-react';

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
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
          <PlaneTakeoff className="w-3.5 h-3.5 text-cyan-400" />
          Matching Flights ({flights.length})
        </span>
        <span>Select to track</span>
      </div>

      <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
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
