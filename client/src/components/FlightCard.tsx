import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flight } from '../types/flight';
import { FlightStatusBadge } from './FlightStatusBadge';
import { Plane, ArrowRight, Clock, AlertCircle, Navigation, ExternalLink } from 'lucide-react';

interface FlightCardProps {
  flight: Flight;
  isSelected: boolean;
  onSelect: (flight: Flight) => void;
}

export const FlightCard: React.FC<FlightCardProps> = ({
  flight,
  isSelected,
  onSelect,
}) => {
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '--:--';
    }
  };

  const depTime = flight.departure.actualTime || flight.departure.estimatedTime || flight.departure.scheduledTime;
  const arrTime = flight.arrival.actualTime || flight.arrival.estimatedTime || flight.arrival.scheduledTime;

  const navigate = useNavigate();

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/flight/${encodeURIComponent(flight.flightNumber)}`, { state: { flight } });
  };

  return (
    <div
      onClick={() => onSelect(flight)}
      className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 border text-left ${
        isSelected
          ? 'bg-slate-800/90 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/40'
          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
      }`}
    >
      {/* Top row: Flight identifier & Status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="font-mono text-base font-bold text-white tracking-wider flex items-center gap-1.5">
            <Plane className="w-4 h-4 text-cyan-400 -rotate-45" />
            {flight.flightNumber}
          </div>
          <span className="text-xs text-slate-400 truncate max-w-[140px]">
            {flight.airline.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FlightStatusBadge status={flight.status} size="sm" />
          <button
            onClick={handleViewDetails}
            title="View full flight details"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Route & Times row */}
      <div className="flex items-center justify-between bg-slate-950/60 rounded-lg p-3 border border-slate-800/60 mb-2.5">
        {/* Origin */}
        <div className="text-left">
          <div className="text-lg font-bold font-mono text-cyan-300">
            {flight.departure.iata || '---'}
          </div>
          <div className="text-xs text-slate-400 truncate max-w-[90px]">
            {flight.departure.city || flight.departure.name || 'Origin'}
          </div>
          <div className="text-xs font-mono text-slate-300 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {formatTime(depTime)}
          </div>
        </div>

        {/* Arrow / Flight path representation */}
        <div className="flex flex-col items-center px-2">
          <ArrowRight className="w-4 h-4 text-slate-500" />
          {flight.hasLiveTracking && (
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5 mt-0.5">
              <Navigation className="w-2.5 h-2.5 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Destination */}
        <div className="text-right">
          <div className="text-lg font-bold font-mono text-cyan-300">
            {flight.arrival.iata || '---'}
          </div>
          <div className="text-xs text-slate-400 truncate max-w-[90px]">
            {flight.arrival.city || flight.arrival.name || 'Destination'}
          </div>
          <div className="text-xs font-mono text-slate-300 mt-1 flex items-center justify-end gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {formatTime(arrTime)}
          </div>
        </div>
      </div>

      {/* Footer Info: Delays & Aircraft */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <div className="truncate">
          {flight.aircraft?.model ? `Aircraft: ${flight.aircraft.model}` : `Date: ${flight.flightDate}`}
        </div>
        {flight.departure.delayMinutes && flight.departure.delayMinutes > 0 ? (
          <span className="text-amber-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Delayed +{flight.departure.delayMinutes}m
          </span>
        ) : (
          <span className="text-emerald-400/90 font-mono">On Time</span>
        )}
      </div>

      {/* View Details */}
      <div className="flex justify-end pt-2 mt-2 border-t border-slate-800/60">
        <button
          onClick={handleViewDetails}
          className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          View Flight Details
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
