import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Clock } from 'lucide-react';

export const InspectionsList = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inspections Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit history across packaged commodities under Legal Metrology Rules.
          </p>
        </div>
        <Link
          to="/inspections/new"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Inspection</span>
        </Link>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Inspections Ledger Module</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Full filterable ledger with search, category filtering, and status tabs scheduled for Step 7.2.
        </p>
      </div>
    </div>
  );
};
