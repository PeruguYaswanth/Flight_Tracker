import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle2, Mail, LogOut } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Layout>
      <div className="max-w-md w-full mx-auto p-4 sm:p-6 pt-10 sm:pt-16">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <UserCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{user?.name}</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user?.email}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Account ID</span>
              <span className="font-mono text-slate-300">{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="text-slate-300">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-300">{user?.email}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-rose-950/60 text-slate-200 hover:text-rose-300 border border-slate-700/80 hover:border-rose-800/60 font-medium py-2.5 rounded-xl transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </Layout>
  );
};
