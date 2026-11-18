import React from 'react';
import { Users as UsersIcon } from 'lucide-react';

export const Users = () => {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User & Role Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Role-based access control for Inspectors, Compliance Officers, and Administrators.
        </p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <UsersIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">RBAC User Management Console</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Inspector role management and activation controls scheduled for Step 7.2.
        </p>
      </div>
    </div>
  );
};
