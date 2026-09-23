import React from 'react';
import { Flight } from '../types/flight';
import { FlightStatusBadge } from './FlightStatusBadge';
import {
  Plane,
  Clock,
  Compass,
  Gauge,
  Mountain,
  Calendar,
  AlertCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface FlightDetailsProps {
  flight: Flight;
}

export const FlightDetails: React.FC<FlightDetailsProps> = ({ flight }) => {
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return { time: '--:--', date: 'N/A' };
    try {
      const d = new Date(isoString);
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    } catch {
      return { time: '--:--', date: 'N/A' };
    }
  };

  const depScheduled = formatDateTime(flight.departure.scheduledTime);
  const depEstimated = formatDateTime(flight.departure.estimatedTime);
  const depActual = formatDateTime(flight.departure.actualTime);

  const arrScheduled = formatDateTime(flight.arrival.scheduledTime);
  const arrEstimated = formatDateTime(flight.arrival.estimatedTime);
  const arrActual = formatDateTime(flight.arrival.actualTime);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:p-6 shadow-2xl space-y-6">
      {/* Top Banner: Flight Number, Airline, Aircraft, Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Plane className="w-6 h-6 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono tracking-wider text-white">
                {flight.flightNumber}
              </h2>
              {flight.flightIcao && (
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  {flight.flightIcao}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-300 font-medium">
              {flight.airline.name} {flight.airline.iata ? `(${flight.airline.iata})` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FlightStatusBadge status={flight.status} size="lg" />
        </div>
      </div>

      {/* Main Route Progression Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Departure Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 lg:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-cyan-400 font-mono font-semibold">
            <span>ORIGIN DEPARTURE</span>
            <span className="bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded">
              {flight.departure.iata || 'DEP'}
            </span>
          </div>

          <div>
            <div className="text-base font-bold text-white leading-tight">
              {flight.departure.name}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {flight.departure.city ? `${flight.departure.city}, ` : ''}{flight.departure.country || ''}
            </div>
          </div>

          {/* Terminal / Gate / Baggage */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Terminal</span>
              <span className="font-mono font-semibold text-slate-200">
                {flight.departure.terminal || '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Gate</span>
              <span className="font-mono font-semibold text-slate-200">
                {flight.departure.gate || '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Baggage</span>
              <span className="font-mono font-semibold text-slate-200">
                {flight.departure.baggage || '--'}
              </span>
            </div>
          </div>

          {/* Departure Timings */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Scheduled
              </span>
              <span className="font-mono font-medium text-slate-200">{depScheduled.time}</span>
            </div>
            {flight.departure.estimatedTime && (
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Estimated
                </span>
                <span className="font-mono font-medium text-cyan-300">{depEstimated.time}</span>
              </div>
            )}
            {flight.departure.actualTime && (
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Actual Takeoff
                </span>
                <span className="font-mono font-medium text-emerald-400">{depActual.time}</span>
              </div>
            )}
            {flight.departure.delayMinutes && flight.departure.delayMinutes > 0 ? (
              <div className="flex justify-between items-center text-amber-400 pt-1 border-t border-slate-800/60 font-medium">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Departure Delay
                </span>
                <span className="font-mono">+{flight.departure.delayMinutes} min</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Arrival Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 lg:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-mono font-semibold">
            <span>DESTINATION ARRIVAL</span>
            <span className="bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded">
              {flight.arrival.iata || 'ARR'}
            </span>
          </div>

          <div>
            <div className="text-base font-bold text-white leading-tight">
              {flight.arrival.name}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {flight.arrival.city ? `${flight.arrival.city}, ` : ''}{flight.arrival.country || ''}
            </div>
          </div>

          {/* Terminal / Gate / Baggage */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Terminal</span>
              <span className="font-mono font-semibold text-slate-200">
                {flight.arrival.terminal || '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Gate</span>
              <span className="font-mono font-semibold text-slate-200">
                {flight.arrival.gate || '--'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Baggage</span>
              <span className="font-mono font-semibold text-slate-200">
                {flight.arrival.baggage || '--'}
              </span>
            </div>
          </div>

          {/* Arrival Timings */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Scheduled
              </span>
              <span className="font-mono font-medium text-slate-200">{arrScheduled.time}</span>
            </div>
            {flight.arrival.estimatedTime && (
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Estimated
                </span>
                <span className="font-mono font-medium text-cyan-300">{arrEstimated.time}</span>
              </div>
            )}
            {flight.arrival.actualTime && (
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Actual Touchdown
                </span>
                <span className="font-mono font-medium text-emerald-400">{arrActual.time}</span>
              </div>
            )}
            {flight.arrival.delayMinutes && flight.arrival.delayMinutes > 0 ? (
              <div className="flex justify-between items-center text-amber-400 pt-1 border-t border-slate-800/60 font-medium">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Arrival Delay
                </span>
                <span className="font-mono">+{flight.arrival.delayMinutes} min</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Live Telemetry & Aircraft Specifications */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
        {/* Aircraft Registration / Model */}
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Aircraft</span>
          </div>
          <div className="font-mono text-xs font-semibold text-white truncate">
            {flight.aircraft?.model || flight.aircraft?.registration || 'Standard Fleet'}
          </div>
          {flight.aircraft?.registration && (
            <div className="text-[10px] text-slate-400 font-mono">
              Reg: {flight.aircraft.registration}
            </div>
          )}
        </div>

        {/* Live Altitude */}
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Mountain className="w-3.5 h-3.5 text-cyan-400" />
            <span>Altitude</span>
          </div>
          <div className="font-mono text-xs font-semibold text-white">
            {flight.live?.altitude != null ? `${flight.live.altitude.toLocaleString()} ft` : 'Unavailable'}
          </div>
          <div className="text-[10px] text-slate-400">
            {flight.live?.isGround ? 'On Ground' : 'Cruising'}
          </div>
        </div>

        {/* Live Speed */}
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ground Speed</span>
          </div>
          <div className="font-mono text-xs font-semibold text-white">
            {flight.live?.speed != null ? `${flight.live.speed} km/h` : 'Unavailable'}
          </div>
          <div className="text-[10px] text-slate-400">
            {flight.live?.speed != null ? `~${Math.round(flight.live.speed * 0.5399)} kts` : 'Radar'}
          </div>
        </div>

        {/* Live Heading */}
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Heading / Track</span>
          </div>
          <div className="font-mono text-xs font-semibold text-white">
            {flight.live?.heading != null ? `${flight.live.heading}°` : 'Unavailable'}
          </div>
          <div className="text-[10px] text-slate-400">
            {flight.live?.heading != null ? `Bearing ${Math.round(flight.live.heading)}°` : 'Radar'}
          </div>
        </div>
      </div>

      {/* Footer info: Flight Date & Sync Timestamp */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Flight Date: <b className="text-slate-300 font-mono">{flight.flightDate}</b></span>
        </div>
        <div className="font-mono text-[11px]">
          Data synchronized: <span className="text-cyan-400">{new Date(flight.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
