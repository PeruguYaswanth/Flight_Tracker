import React from 'react';
import { Loader2, Plane } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Retrieving real-time flight data...',
}) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[240px]">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
          <Plane className="w-7 h-7 text-sky-600 animate-pulse -rotate-45" />
        </div>
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin absolute -bottom-1 -right-1" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-800">Processing Flight Query</h3>
        <p className="text-xs text-slate-500 max-w-xs">{message}</p>
      </div>
    </div>
  );
};
