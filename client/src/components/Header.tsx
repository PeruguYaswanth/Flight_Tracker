import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Plane, Radio, RefreshCw, Menu, X, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onRefresh?: () => void;
  isLoading?: boolean;
  lastUpdated?: string | null;
  showLiveStatus?: boolean;
}

const NAV_LINKS = [
  { label: 'Flight Status', to: '/flight-status' },
  { label: 'Airports', to: '/airports' },
  { label: 'About', to: '/about' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-cyan-400' : 'text-slate-300 hover:text-white'
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
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand Identity */}
      <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setMobileMenuOpen(false)}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
          <Plane className="w-5 h-5 text-white -rotate-45" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              AEROTRACK
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
                Pro
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">Live Global Flight Tracking & Radar Console</p>
        </div>
      </Link>

      {/* Primary Navigation (desktop) */}
      <nav className="hidden md:flex items-center gap-6">
        {NAV_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} className={navLinkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Center Status Indicators (Flight Status page only) */}
      {showLiveStatus && (
        <div className="hidden lg:flex items-center gap-6 text-xs text-slate-300">
          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 px-3 py-1.5 rounded-lg">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">Feed Status:</span>
            <span className="text-emerald-400 font-medium">LIVE</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 px-3 py-1.5 rounded-lg font-mono text-cyan-300">
            {time}
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <div className="hidden sm:flex flex-col text-right text-[11px] text-slate-400 font-mono">
            <span className="text-slate-500">LAST SYNC</span>
            <span className="text-slate-300">{new Date(lastUpdated).toLocaleTimeString()}</span>
          </div>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Refresh current search"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* Auth Actions (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all text-xs font-medium"
              >
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                {user?.name?.split(' ')[0] || 'Profile'}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-200 hover:text-rose-300 border border-slate-700/80 hover:border-rose-800/60 transition-all text-xs font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3.5 py-1.5 rounded-lg text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 transition-all text-xs font-medium"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold transition-all text-xs shadow-sm"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-200"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="w-full md:hidden border-t border-slate-800 pt-3 mt-1 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-slate-800 text-cyan-400' : 'text-slate-300 hover:bg-slate-800/60'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <div className="border-t border-slate-800 pt-2 mt-1 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 flex items-center gap-2"
                >
                  <UserIcon className="w-4 h-4 text-cyan-400" /> {user?.name || 'Profile'}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 text-left"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-500 text-slate-950 text-center"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
