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
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-400 animate-pulse',
          icon: Plane,
        };
      case 'scheduled':
        return {
          label: 'SCHEDULED',
          bg: 'bg-sky-500/15 border-sky-500/40 text-sky-400',
          dot: 'bg-sky-400',
          icon: Clock,
        };
      case 'landed':
        return {
          label: 'LANDED',
          bg: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
          dot: 'bg-slate-400',
          icon: CheckCircle2,
        };
      case 'delayed':
        return {
          label: 'DELAYED',
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
          dot: 'bg-amber-400 animate-ping',
          icon: AlertTriangle,
        };
      case 'cancelled':
        return {
          label: 'CANCELLED',
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
          dot: 'bg-rose-400',
          icon: XCircle,
        };
      case 'diverted':
        return {
          label: 'DIVERTED',
          bg: 'bg-purple-500/15 border-purple-500/40 text-purple-400',
          dot: 'bg-purple-400',
          icon: AlertOctagon,
        };
      case 'incident':
        return {
          label: 'INCIDENT',
          bg: 'bg-red-600/20 border-red-500/50 text-red-300',
          dot: 'bg-red-400 animate-pulse',
          icon: AlertOctagon,
        };
      default:
        return {
          label: 'UNKNOWN',
          bg: 'bg-slate-800 border-slate-700 text-slate-400',
          dot: 'bg-slate-500',
          icon: Clock,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium tracking-wide',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold tracking-wider',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bg} ${sizeClasses} ${className} font-mono`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      <span>{config.label}</span>
    </span>
  );
};
