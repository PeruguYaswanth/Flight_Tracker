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
      <div className="bg-white border border-slate-200/90 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
          <Search className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800">No Matching Flights Found</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {customMessage || 'Please verify the flight number, airline, or route and try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
        <Plane className="w-7 h-7 text-sky-600 -rotate-45" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-slate-800">Ready to Track Flights</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Search by flight number (e.g. 6E6372, AI101) or by route (e.g. Hyderabad to Delhi) to view live status, schedules, and radar position.
        </p>
      </div>
    </div>
  );
};
