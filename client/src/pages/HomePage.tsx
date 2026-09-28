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
      {/* Hero Aviation Background Header Section */}
      <div className="relative w-full overflow-hidden bg-sky-900 border-b border-sky-800/30">
        {/* Bright Aviation Daylight Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90 transition-all duration-700"
          style={{ backgroundImage: "url('/flight-bg.jpg')" }}
        />
        {/* Soft daylight gradient overlay for contrast without darkening */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/40 via-sky-900/20 to-slate-900/60" />

        {/* Hero Content Container */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 space-y-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/90 border border-sky-200 text-sky-900 text-xs font-bold px-4 py-1.5 rounded-full shadow-md backdrop-blur">
              <Radar className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
              <span>Live Global Flight Tracking & Navigation System</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              Track Any Commercial Flight, <span className="text-sky-200 underline decoration-sky-400 decoration-2">Anywhere.</span>
            </h1>

            <p className="text-sm sm:text-base text-white font-medium max-w-2xl mx-auto leading-relaxed drop-shadow">
              Real-time flight status, delay alerts, gate schedules, and live ADS-B radar tracking. Search by flight number or enter origin & destination cities.
            </p>

            {!isAuthenticated ? (
              <div className="flex items-center justify-center gap-3 pt-1">
                <Link
                  to="/signup"
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-lg shadow-sky-900/30 transition-all active:scale-[0.98]"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className="px-5 py-2.5 rounded-xl bg-white/95 hover:bg-white text-slate-800 border border-white/50 font-bold text-sm backdrop-blur shadow-md transition-all"
                >
                  Sign In
                </Link>
              </div>
            ) : (
              <p className="text-sm font-semibold text-white bg-slate-900/40 inline-block px-4 py-1 rounded-full backdrop-blur">
                Welcome back, <span className="text-sky-300 font-bold">{user?.name}</span>
              </p>
            )}
          </div>

          {/* Hero Search Box Container */}
          <div className="max-w-2xl mx-auto w-full shadow-2xl rounded-2xl ring-1 ring-black/10">
            <FlightSearch onSearch={handleSearch} onReset={() => {}} isLoading={false} />
          </div>
        </div>
      </div>

      {/* Main Page Features Section */}
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-10 py-10">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Link
            to="/flight-status"
            className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-6 flex items-start gap-4 transition-all shadow-2xs hover:shadow-md group"
          >
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 group-hover:scale-105 transition-transform">
              <Plane className="w-6 h-6 -rotate-45" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-bold text-slate-900 flex items-center gap-1">
                Flight Status
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lookup any flight by number or city route with scheduled, estimated, and actual takeoff & landing times.
              </p>
            </div>
          </Link>

          <Link
            to="/airports"
            className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-6 flex items-start gap-4 transition-all shadow-2xs hover:shadow-md group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-bold text-slate-900 flex items-center gap-1">
                Airports Directory
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Browse major commercial airports globally to view active departure and arrival boards.
              </p>
            </div>
          </Link>

          <Link
            to="/about"
            className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-6 flex items-start gap-4 transition-all shadow-2xs hover:shadow-md group"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
              <Info className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-bold text-slate-900 flex items-center gap-1">
                Aviation Feeds
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Understand ADS-B transponder telemetry, flight schedules, and data integrity verification.
              </p>
            </div>
          </Link>
        </section>
      </div>
    </Layout>
  );
};
