import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/profile';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setServerError(err.message || 'Unable to log in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-sm w-full mx-auto p-4 sm:p-6 pt-10 sm:pt-16">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 mx-auto">
              <LogIn className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-white">Log in to AeroTrack</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition"
              />
            </div>

            {(validationError || serverError) && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2 font-medium">
                {validationError || serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={() => setShowForgotNotice(true)}
              className="w-full text-xs text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Forgot Password?
            </button>
            {showForgotNotice && (
              <p className="text-xs text-slate-400 text-center">
                Password reset isn't available yet. Please contact support.
              </p>
            )}
          </form>

          <p className="text-xs text-slate-400 text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};
