import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, LogOut, User, Bell } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between shadow-2xs">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">LabelGuard</span>
          <span className="text-brand-600 font-extrabold text-lg ml-0.5">AI</span>
          <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
            PCR 2011 Metrology
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-3 border-r border-slate-200 pr-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{user.fullName}</p>
              <span className="inline-block text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded px-1.5 py-0.2">
                {user.role}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors"
          title="Sign out of LabelGuard"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
