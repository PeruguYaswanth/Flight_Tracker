import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
}) => {
  return (
    <div className="bg-rose-950/30 border border-rose-800/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-xl">
      <div className="w-12 h-12 rounded-xl bg-rose-900/40 border border-rose-700/60 flex items-center justify-center text-rose-400">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-rose-200">Unable to Process Request</h3>
        <p className="text-xs text-rose-300 max-w-sm font-medium leading-relaxed">
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold border border-rose-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
