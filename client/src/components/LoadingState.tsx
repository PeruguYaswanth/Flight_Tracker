import React from 'react';
import { Loader2, Plane } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Retrieving flight and telemetry data...',
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-xl min-h-[260px]">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center">
          <Plane className="w-7 h-7 text-cyan-400 animate-pulse -rotate-45" />
        </div>
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin absolute -bottom-1 -right-1" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-200">Processing Request</h3>
        <p className="text-xs text-slate-400 max-w-xs">{message}</p>
      </div>
    </div>
  );
};
