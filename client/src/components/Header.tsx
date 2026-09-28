import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Plane, Radio, RefreshCw, Menu, X, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { formatDisplayName } from '../utils/formatUser';

interface HeaderProps {
  onRefresh?: () => void;
  isLoading?: boolean;
  lastUpdated?: string | null;
  showLiveStatus?: boolean;
}

const NAV_LINKS = [
  { label: 'Search Flights', to: '/flight-status' },
  { label: 'Airports', to: '/airports' },
  { label: 'About', to: '/about' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg ${
    isActive
      ? 'text-sky-700 bg-sky-50'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
  }`;

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isLoading,
  lastUpdated,
  showLiveStatus = false,
}) => {
  const [time, setTime] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!showLiveStatus) return;
    const update = () => {
      const now = new Date();
      setTime(now.toUTCString().slice(17, 25) + ' UTC');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [showLiveStatus]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
      {/* Brand Identity */}
      <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setMobileMenuOpen(false)}>
        <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-sm">
          <Plane className="w-5 h-5 text-white -rotate-45" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5">
              Flight Tracker
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                PRO
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">Live Flight Status & Route Tracking</p>
        </div>
      </Link>

      {/* Primary Navigation (desktop) */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} className={navLinkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Center Status Indicators (Flight Status page only) */}
      {showLiveStatus && (
        <div className="hidden lg:flex items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="text-slate-500">Radar Feed:</span>
            <span className="text-emerald-700 font-bold">ONLINE</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg font-mono font-semibold text-slate-700">
            {time}
          </div>
        </div>
      )}

      {/* Right Controls & Auth */}
      <div className="flex items-center gap-2.5">
        {lastUpdated && (
          <div className="hidden sm:flex flex-col text-right text-[11px] text-slate-500 font-mono pr-2">
            <span className="text-slate-400">LAST SYNC</span>
            <span className="text-slate-700 font-semibold">{new Date(lastUpdated).toLocaleTimeString()}</span>
          </div>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            title="Refresh current search"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        <NotificationBell />

        {/* Auth Actions (desktop) */}
        <div className="hidden md:flex items-center gap-2 pl-1">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-all text-xs font-semibold"
              >
                <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                {formatDisplayName(user?.name).split(' ')[0] || 'Profile'}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-all text-xs font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all text-xs font-semibold"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold transition-all text-xs shadow-sm"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="w-full md:hidden border-t border-slate-200 pt-3 mt-1 flex flex-col gap-1.5">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2 rounded-xl text-sm font-semibold ${
                  isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <div className="border-t border-slate-200 pt-3 mt-1 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <UserIcon className="w-4 h-4 text-sky-600" /> {formatDisplayName(user?.name) || 'Profile'}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 text-left"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 text-center"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold bg-sky-600 text-white text-center shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
