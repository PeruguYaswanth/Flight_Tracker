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
    if (!isoString) return { time: '--:--', date: 'Not available' };
    try {
      const d = new Date(isoString);
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    } catch {
      return { time: '--:--', date: 'Not available' };
    }
  };

  const depScheduled = formatDateTime(flight.departure.scheduledTime);
  const depEstimated = formatDateTime(flight.departure.estimatedTime);
  const depActual = formatDateTime(flight.departure.actualTime);

  const arrScheduled = formatDateTime(flight.arrival.scheduledTime);
  const arrEstimated = formatDateTime(flight.arrival.estimatedTime);
  const arrActual = formatDateTime(flight.arrival.actualTime);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 lg:p-7 shadow-sm space-y-6">
      {/* Top Banner: Flight Number, Airline, Codeshare, Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shadow-2xs">
            <Plane className="w-7 h-7 -rotate-45" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-black font-mono tracking-tight text-slate-900">
                {flight.flightNumber}
              </h2>
              {flight.flightIcao && (
                <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                  ICAO: {flight.flightIcao}
                </span>
              )}
              {flight.operatingFlightIata && flight.operatingFlightIata !== flight.flightNumber && (
                <span className="text-xs font-mono font-medium text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                  Codeshare · Operated by {flight.operatingFlightIata}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600 font-semibold mt-0.5">
              {flight.airline.name || 'Commercial Carrier'} {flight.airline.iata ? `(${flight.airline.iata})` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FlightStatusBadge status={flight.status} size="lg" />
        </div>
      </div>

      {/* Main Route Progression Stations (FlightStats layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Departure Station Card */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-sky-700 uppercase">
              Origin Departure
            </span>
            <span className="font-mono font-bold text-sm px-2.5 py-1 rounded bg-white text-sky-800 border border-sky-200 shadow-2xs">
              {flight.departure.iata || 'DEP'}
            </span>
          </div>

          <div>
            <div className="text-lg font-bold text-slate-900 leading-snug">
              {flight.departure.name || 'Departure Airport'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">
              {flight.departure.city ? `${flight.departure.city}, ` : ''}{flight.departure.country || ''}
            </div>
          </div>

          {/* Terminal / Gate / Baggage Grid */}
          <div className="grid grid-cols-3 gap-2 bg-white border border-slate-200 rounded-xl p-3 text-center text-xs shadow-2xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Terminal</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {flight.departure.terminal || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Gate</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {flight.departure.gate || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Baggage</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {flight.departure.baggage || 'N/A'}
              </span>
            </div>
          </div>

          {/* Departure Timings */}
          <div className="space-y-2 pt-1 text-xs divide-y divide-slate-200/60">
            <div className="flex justify-between items-center text-slate-600 pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Scheduled Time
              </span>
              <span className="font-mono font-bold text-slate-800">{depScheduled.time}</span>
            </div>

            {flight.departure.estimatedTime && (
              <div className="flex justify-between items-center text-slate-600 pt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-sky-600" /> Estimated Time
                </span>
                <span className="font-mono font-bold text-sky-700">{depEstimated.time}</span>
              </div>
            )}

            {flight.departure.actualTime && (
              <div className="flex justify-between items-center text-slate-600 pt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Actual Takeoff
                </span>
                <span className="font-mono font-bold text-emerald-700">{depActual.time}</span>
              </div>
            )}

            {flight.departure.delayMinutes && flight.departure.delayMinutes > 0 ? (
              <div className="flex justify-between items-center text-amber-900 pt-2 font-semibold">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Departure Delay
                </span>
                <span className="font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  +{flight.departure.delayMinutes} min
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Arrival Station Card */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-emerald-700 uppercase">
              Destination Arrival
            </span>
            <span className="font-mono font-bold text-sm px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
              {flight.arrival.iata || 'ARR'}
            </span>
          </div>

          <div>
            <div className="text-lg font-bold text-slate-900 leading-snug">
              {flight.arrival.name || 'Arrival Airport'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">
              {flight.arrival.city ? `${flight.arrival.city}, ` : ''}{flight.arrival.country || ''}
            </div>
          </div>

          {/* Terminal / Gate / Baggage Grid */}
          <div className="grid grid-cols-3 gap-2 bg-white border border-slate-200 rounded-xl p-3 text-center text-xs shadow-2xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Terminal</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {flight.arrival.terminal || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Gate</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {flight.arrival.gate || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Baggage</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {flight.arrival.baggage || 'N/A'}
              </span>
            </div>
          </div>

          {/* Arrival Timings */}
          <div className="space-y-2 pt-1 text-xs divide-y divide-slate-200/60">
            <div className="flex justify-between items-center text-slate-600 pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Scheduled Time
              </span>
              <span className="font-mono font-bold text-slate-800">{arrScheduled.time}</span>
            </div>

            {flight.arrival.estimatedTime && (
              <div className="flex justify-between items-center text-slate-600 pt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-sky-600" /> Estimated Time
                </span>
                <span className="font-mono font-bold text-sky-700">{arrEstimated.time}</span>
              </div>
            )}

            {flight.arrival.actualTime && (
              <div className="flex justify-between items-center text-slate-600 pt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Actual Touchdown
                </span>
                <span className="font-mono font-bold text-emerald-700">{arrActual.time}</span>
              </div>
            )}

            {flight.arrival.delayMinutes && flight.arrival.delayMinutes > 0 ? (
              <div className="flex justify-between items-center text-amber-900 pt-2 font-semibold">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Arrival Delay
                </span>
                <span className="font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  +{flight.arrival.delayMinutes} min
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Aircraft & Live Flight Telemetry Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-sky-600" />
            Aircraft & Live Telemetry Details
          </span>
          <span className="text-slate-400 font-normal">Real-time ADS-B telemetry</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          {/* Aircraft Model / Registration */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Aircraft Type
            </div>
            <div className="font-mono text-xs font-bold text-slate-900 truncate">
              {flight.aircraft?.model || 'Not available'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {flight.aircraft?.registration ? `Reg: ${flight.aircraft.registration}` : flight.aircraft?.icao24 ? `Hex: ${flight.aircraft.icao24}` : 'Fleet standard'}
            </div>
          </div>

          {/* Live Altitude */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Mountain className="w-3 h-3 text-sky-600" /> Altitude
            </div>
            <div className="font-mono text-xs font-bold text-slate-900">
              {flight.live?.altitude != null ? `${flight.live.altitude.toLocaleString()} ft` : 'Not available'}
            </div>
            <div className="text-[11px] text-slate-500">
              {flight.live?.isGround ? 'On Runway / Ground' : flight.live?.altitude ? 'Airborne' : 'Telemetry pending'}
            </div>
          </div>

          {/* Live Ground Speed */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3 text-sky-600" /> Ground Speed
            </div>
            <div className="font-mono text-xs font-bold text-slate-900">
              {flight.live?.speed != null ? `${flight.live.speed} km/h` : 'Not available'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {flight.live?.speed != null ? `~${Math.round(flight.live.speed * 0.5399)} kts` : 'Radar lock'}
            </div>
          </div>

          {/* Live Track / Heading */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Compass className="w-3 h-3 text-sky-600" /> Heading / Track
            </div>
            <div className="font-mono text-xs font-bold text-slate-900">
              {flight.live?.heading != null ? `${flight.live.heading}°` : 'Not available'}
            </div>
            <div className="text-[11px] text-slate-500">
              {flight.live?.heading != null ? `Bearing ${Math.round(flight.live.heading)}°` : 'Compass track'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info: Flight Date & Sync Timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Flight Date: <b className="text-slate-700 font-mono">{flight.flightDate}</b></span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Last synchronized: <span className="text-sky-700 font-semibold">{new Date(flight.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
