import React from 'react';
import { Plus, Minus, Crosshair, Maximize2 } from 'lucide-react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterAircraft: () => void;
  onFitBounds: () => void;
  hasAircraftPosition: boolean;
  hasRoute: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onCenterAircraft,
  onFitBounds,
  hasAircraftPosition,
  hasRoute,
}) => {
  return (
    <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="flex flex-col bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <button
          type="button"
          onClick={onZoomIn}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition border-b border-slate-800"
          title="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Recenter & Fit bounds */}
      <div className="flex flex-col bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <button
          type="button"
          onClick={onCenterAircraft}
          disabled={!hasAircraftPosition}
          className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed border-b border-slate-800"
          title={hasAircraftPosition ? "Center on aircraft" : "Live aircraft position unavailable"}
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onFitBounds}
          disabled={!hasRoute}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          title={hasRoute ? "Fit full route in view" : "Route unavailable"}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
