import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  Search,
  Route,
  FileText,
  Radar,
  BellRing,
  LayoutList,
  MonitorSmartphone,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { PasswordInput } from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { formatDisplayName } from '../utils/formatUser';

const BENEFITS = [
  { icon: Search, title: 'Search by flight number', text: 'Find a flight by its IATA or ICAO number, such as EK527 or UAE527.' },
  { icon: Route, title: 'Search by route', text: 'Look up flights between two airports using a city name or airport code.' },
  { icon: FileText, title: 'Detailed flight information', text: 'Status, schedule, terminal, gate and codeshare details from our flight-data provider.' },
  { icon: Radar, title: 'Live aircraft position', text: 'View live aircraft position when available from supported live-flight data.' },
  { icon: BellRing, title: 'Track flights and get notified', text: 'Get a notification when a tracked flight changes status, times, gate or terminal.' },
  { icon: LayoutList, title: 'Manage from your account', text: 'See tracked flights in your profile and alerts from the bell in the header.' },
  { icon: MonitorSmartphone, title: 'Desktop and mobile', text: 'Use Flight Tracker in your browser on desktop, tablet or phone.' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

    if (!name.trim()) {
      setValidationError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(formatDisplayName(name), email.trim(), password);
      navigate('/profile', { replace: true });
    } catch (err: any) {
      setServerError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 pt-8 sm:pt-12 lg:pt-16 grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] items-start">
        <div className="w-full max-w-sm mx-auto lg:max-w-none lg:order-2 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 mx-auto shadow-2xs">
              <UserPlus className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
            <p className="text-xs text-slate-500">Track flights and manage alerts</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-name" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-600" />
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                className="w-full bg-white border border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-600" />
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-white border border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-600" />
                Password
              </label>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-confirm-password" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-600" />
                Confirm Password
              </label>
              <PasswordInput
                id="signup-confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>

            {(validationError || serverError) && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 font-medium">
                {validationError || serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold py-2.5 rounded-xl shadow-2xs transition-all disabled:opacity-50 text-sm"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center pt-1 border-t border-slate-100">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-600 hover:text-sky-700 font-semibold">
              Sign In
            </Link>
          </p>
        </div>

        <section aria-labelledby="signup-benefits-title" className="lg:order-1 lg:pt-2 space-y-5">
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono font-bold tracking-wider text-sky-700 uppercase">Flight Tracker account</p>
            <h2 id="signup-benefits-title" className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Everything you need to follow a flight
            </h2>
            <p className="text-sm text-slate-600 max-w-prose">
              Search is open to everyone. An account adds flight tracking and status notifications.
            </p>
          </div>

          <ul className="grid gap-2.5 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  );
};
