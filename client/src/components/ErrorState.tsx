import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  title = 'Unable to Complete Request',
  onRetry,
}) => {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-2xs">
      <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-rose-900">{title}</h3>
        <p className="text-xs text-rose-700 max-w-sm font-medium leading-relaxed">
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
