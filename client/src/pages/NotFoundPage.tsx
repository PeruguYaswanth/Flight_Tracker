import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Layout } from '../components/Layout';

export const NotFoundPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-md w-full mx-auto p-6 pt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
          <Compass className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">404 - Page not found</h1>
        <p className="text-sm text-slate-400">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm transition-all"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </Layout>
  );
};
