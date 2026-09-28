import React from 'react';
import { Link } from 'react-router-dom';
import { Plane } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 px-6 text-xs text-slate-500 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 flex-wrap justify-center font-medium">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <div className="w-6 h-6 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <Plane className="w-3.5 h-3.5 -rotate-45" />
            </div>
            <span>Flight Tracker PRO</span>
          </div>
          <Link to="/flight-status" className="hover:text-sky-700 transition-colors">Search Flights</Link>
          <Link to="/airports" className="hover:text-sky-700 transition-colors">Airports</Link>
          <Link to="/about" className="hover:text-sky-700 transition-colors">About</Link>
          <Link to="/login" className="hover:text-sky-700 transition-colors">Login</Link>
          <Link to="/signup" className="hover:text-sky-700 transition-colors">Sign Up</Link>
        </div>
        <div className="text-center sm:text-right space-y-1">
          <div className="font-semibold text-slate-700">&copy; {new Date().getFullYear()} Flight Tracker Application</div>
          <div className="text-slate-400 text-[11px]">Flight data and live radar positions powered by global aviation feeds. Availability subject to active ADS-B broadcast.</div>
        </div>
      </div>
    </footer>
  );
};
