import React from 'react';
import { Plane, Search } from 'lucide-react';

interface EmptyStateProps {
  type?: 'initial' | 'no-results';
  customMessage?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'initial',
  customMessage,
}) => {
  if (type === 'no-results') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
          <Search className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-200">No Matching Flight Found</h3>
          <p className="text-xs text-slate-400 max-w-xs">
            {customMessage || 'Please check the flight number, airline, or date and try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
      <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
        <Plane className="w-7 h-7 text-slate-400 -rotate-45" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-200">No Flight Selected</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Search for a flight by number or route above to view live radar position, telemetry, and detailed schedules.
        </p>
      </div>
    </div>
  );
};
