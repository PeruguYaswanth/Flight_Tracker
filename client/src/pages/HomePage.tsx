import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, MapPin, Info, ArrowRight, Radar } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FlightSearch } from '../components/FlightSearch';
import { useAuth } from '../context/AuthContext';
import { FlightSearchFilters } from '../types/flight';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handleSearch = (filters: FlightSearchFilters) => {
    navigate('/flight-status', { state: { filters } });
  };

  return (
    <Layout>
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-medium px-3 py-1.5 rounded-full">
            <Radar className="w-3.5 h-3.5" />
            Real-time flight status, powered by live aviation data
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Track any flight, anywhere.
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            AeroTrack gives you live flight status, schedules, and route tracking for flights around the world.
            Search by flight number or route to see departure and arrival details, delays, and live position when available.
          </p>

          {!isAuthenticated && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/signup"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm shadow-lg shadow-cyan-500/20 transition-all"
              >
                Create a free account
              </Link>
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition-all"
              >
                Login
              </Link>
            </div>
          )}
          {isAuthenticated && (
            <p className="text-sm text-slate-300">
              Welcome back, <span className="font-semibold text-cyan-400">{user?.name}</span>.
            </p>
          )}
        </section>

        {/* Search */}
        <section className="max-w-xl mx-auto w-full">
          <FlightSearch onSearch={handleSearch} onReset={() => {}} isLoading={false} />
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/flight-status"
            className="bg-slate-900 border border-slate-800 hover:border-cyan-700/60 rounded-2xl p-5 flex items-start gap-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0">
              <Plane className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-1">
                Flight Status
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Search by flight number or route and track live status on the map.</p>
            </div>
          </Link>

          <Link
            to="/airports"
            className="bg-slate-900 border border-slate-800 hover:border-cyan-700/60 rounded-2xl p-5 flex items-start gap-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-1">
                Airports
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Browse airports and view current departures and arrivals.</p>
            </div>
          </Link>

          <Link
            to="/about"
            className="bg-slate-900 border border-slate-800 hover:border-cyan-700/60 rounded-2xl p-5 flex items-start gap-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-1">
                About
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Learn what AeroTrack does and where the data comes from.</p>
            </div>
          </Link>
        </section>
      </div>
    </Layout>
  );
};
