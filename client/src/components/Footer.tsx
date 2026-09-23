import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-6 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <span className="font-mono font-semibold text-slate-300">AEROTRACK</span>
          <Link to="/flight-status" className="hover:text-cyan-400 transition-colors">Flight Status</Link>
          <Link to="/airports" className="hover:text-cyan-400 transition-colors">Airports</Link>
          <Link to="/about" className="hover:text-cyan-400 transition-colors">About</Link>
          <Link to="/login" className="hover:text-cyan-400 transition-colors">Login</Link>
          <Link to="/signup" className="hover:text-cyan-400 transition-colors">Sign Up</Link>
        </div>
        <div className="text-center sm:text-right space-y-0.5">
          <div>&copy; {new Date().getFullYear()} AeroTrack &mdash; Flight Tracker</div>
          <div className="text-slate-600">Flight data provided by Aviationstack. Availability of live position, delay, and schedule fields depends on the data provider.</div>
        </div>
      </div>
    </footer>
  );
};
