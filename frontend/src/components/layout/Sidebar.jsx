import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileCheck,
  UploadCloud,
  Package,
  BookOpen,
  Users,
} from 'lucide-react';

export const Sidebar = () => {
  const { user, isAdmin } = useAuth();

  const navItems = [
    { to: '/', label: 'Overview Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/inspections', label: 'Inspections History', icon: FileCheck },
    { to: '/inspections/new', label: 'New Inspection', icon: UploadCloud },
    { to: '/products', label: 'Product Catalog', icon: Package },
    { to: '/rules', label: 'Statutory Rules (PCR)', icon: BookOpen },
  ];

  if (isAdmin) {
    navItems.push({ to: '/users', label: 'User Management', icon: Users });
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex shrink-0">
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Regulatory Modules
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold border-r-2 border-brand-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800">Compliance Standard</p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          The Legal Metrology (Packaged Commodities) Rules, 2011 & Amendments.
        </p>
      </div>
    </aside>
  );
};
