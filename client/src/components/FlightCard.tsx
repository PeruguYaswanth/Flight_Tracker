import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flight } from '../types/flight';
import { FlightStatusBadge } from './FlightStatusBadge';
import { Plane, ArrowRight, AlertCircle, Navigation, ChevronRight } from 'lucide-react';

interface FlightCardProps {
  flight: Flight;
  isSelected?: boolean;
  onSelect?: (flight: Flight) => void;
}

export const FlightCard: React.FC<FlightCardProps> = ({
  flight,
  isSelected = false,
  onSelect,
}) => {
  const navigate = useNavigate();

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '--:--';
    }
  };

  const depTime = flight.departure.actualTime || flight.departure.estimatedTime || flight.departure.scheduledTime;
  const arrTime = flight.arrival.actualTime || flight.arrival.estimatedTime || flight.arrival.scheduledTime;

  const handleClick = () => {
    if (onSelect) {
      onSelect(flight);
    } else {
      navigate(`/flight/${encodeURIComponent(flight.flightNumber)}`, { state: { flight } });
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/flight/${encodeURIComponent(flight.flightNumber)}`, { state: { flight } });
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-200 text-left shadow-2xs hover:shadow-md ${
        isSelected
          ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md'
          : 'border-slate-200/90 hover:border-sky-300'
      }`}
    >
      {/* Top row: Flight identifier, Airline, Operating carrier (codeshare), Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-bold shrink-0">
            <Plane className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-slate-900 tracking-tight">
                {flight.flightNumber}
              </span>
              {flight.operatingFlightIata && flight.operatingFlightIata !== flight.flightNumber && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Operated by {flight.operatingFlightIata}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 font-medium">
              {flight.airline.name || 'Commercial Airline'}
            </div>
            {flight.codeshares && flight.codeshares.length > 0 && (
              <div className="text-[11px] text-slate-500 mt-0.5" title={flight.codeshares.join(', ')}>
                Also sold as {flight.codeshares.slice(0, 3).join(', ')}
                {flight.codeshares.length > 3 ? ` +${flight.codeshares.length - 3} more` : ''}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <FlightStatusBadge status={flight.status} size="sm" />
        </div>
      </div>

      {/* Main Flight Path & Timings (FlightStats information hierarchy) */}
      <div className="grid grid-cols-7 items-center gap-2 py-4">
        {/* Origin / Departure */}
        <div className="col-span-3 text-left space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
              {flight.departure.iata || '---'}
            </span>
            <span className="text-sm font-semibold text-sky-700 font-mono">
              {formatTime(depTime)}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-800 truncate">
            {flight.departure.city || flight.departure.name || 'Origin City'}
          </div>
          <div className="text-[11px] text-slate-500 truncate max-w-full">
            {flight.departure.name || 'Departure Airport'}
          </div>
        </div>

        {/* Path Connector & Live Status */}
        <div className="col-span-1 flex flex-col items-center justify-center px-1">
          <div className="w-full flex items-center justify-center relative">
            <div className="w-full h-0.5 bg-slate-200 absolute top-1/2 -translate-y-1/2" />
            <div className="relative bg-white p-1 rounded-full border border-slate-200 text-slate-400 group-hover:text-sky-600 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          {flight.hasLiveTracking && (
            <span className="text-[10px] font-mono font-bold text-emerald-600 flex items-center gap-0.5 mt-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <Navigation className="w-2.5 h-2.5 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Destination / Arrival */}
        <div className="col-span-3 text-right space-y-1">
          <div className="flex items-baseline justify-end gap-2">
            <span className="text-sm font-semibold text-emerald-700 font-mono">
              {formatTime(arrTime)}
            </span>
            <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
              {flight.arrival.iata || '---'}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-800 truncate">
            {flight.arrival.city || flight.arrival.name || 'Destination City'}
          </div>
          <div className="text-[11px] text-slate-500 truncate max-w-full">
            {flight.arrival.name || 'Arrival Airport'}
          </div>
        </div>
      </div>

      {/* Footer Info: Terminal/Gate, Delay notice, Date, Details link */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-slate-400">Terminal/Gate:</span>
            <span className="font-semibold text-slate-700">
              {flight.departure.terminal ? `T${flight.departure.terminal}` : '--'}
              {flight.departure.gate ? ` / G${flight.departure.gate}` : ''}
            </span>
          </div>

          {flight.departure.delayMinutes && flight.departure.delayMinutes > 0 ? (
            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Delayed +{flight.departure.delayMinutes}m
            </span>
          ) : (
            <span className="text-emerald-700 font-medium">On Schedule</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400">
            {flight.flightDate}
          </span>
          <button
            onClick={handleViewDetails}
            className="text-xs font-semibold text-sky-600 group-hover:text-sky-700 flex items-center gap-0.5 hover:underline"
          >
            <span>View Flight</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
