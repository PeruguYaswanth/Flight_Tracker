import React from 'react';
import { FlightStatus } from '../types/flight';
import { Plane, CheckCircle2, Clock, AlertTriangle, XCircle, AlertOctagon } from 'lucide-react';

interface FlightStatusBadgeProps {
  status: FlightStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FlightStatusBadge: React.FC<FlightStatusBadgeProps> = ({
  status,
  className = '',
  size = 'md',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          label: 'IN FLIGHT',
          bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
          dot: 'bg-emerald-500 animate-pulse',
          icon: Plane,
        };
      case 'scheduled':
        return {
          label: 'SCHEDULED',
          bg: 'bg-sky-50 border-sky-300 text-sky-800',
          dot: 'bg-sky-500',
          icon: Clock,
        };
      case 'landed':
        return {
          label: 'LANDED',
          bg: 'bg-slate-100 border-slate-300 text-slate-700',
          dot: 'bg-slate-500',
          icon: CheckCircle2,
        };
      case 'delayed':
        return {
          label: 'DELAYED',
          bg: 'bg-amber-50 border-amber-300 text-amber-900',
          dot: 'bg-amber-500 animate-ping',
          icon: AlertTriangle,
        };
      case 'cancelled':
        return {
          label: 'CANCELLED',
          bg: 'bg-rose-50 border-rose-300 text-rose-800',
          dot: 'bg-rose-500',
          icon: XCircle,
        };
      case 'diverted':
        return {
          label: 'DIVERTED',
          bg: 'bg-purple-50 border-purple-300 text-purple-800',
          dot: 'bg-purple-500',
          icon: AlertOctagon,
        };
      case 'incident':
        return {
          label: 'INCIDENT',
          bg: 'bg-red-50 border-red-300 text-red-900',
          dot: 'bg-red-500 animate-pulse',
          icon: AlertOctagon,
        };
      default:
        return {
          label: 'UNKNOWN',
          bg: 'bg-slate-100 border-slate-200 text-slate-600',
          dot: 'bg-slate-400',
          icon: Clock,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold tracking-wide',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold tracking-wider',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${config.bg} ${sizeClasses} ${className} font-mono`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <Icon className={size === 'lg' ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>{config.label}</span>
    </span>
  );
};
