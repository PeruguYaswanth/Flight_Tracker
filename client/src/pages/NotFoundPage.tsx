import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Layout } from '../components/Layout';

export const NotFoundPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-md w-full mx-auto p-6 pt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 mx-auto shadow-2xs">
          <Compass className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">404 - Page Not Found</h1>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          The flight or page you're searching for does not exist or has been relocated.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-2xs transition-all"
        >
          <Home className="w-4 h-4" />
          Back to Flight Search
        </Link>
      </div>
    </Layout>
  );
};
