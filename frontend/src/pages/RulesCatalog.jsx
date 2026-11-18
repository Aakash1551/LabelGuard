import React from 'react';
import { BookOpen } from 'lucide-react';

export const RulesCatalog = () => {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Statutory Rules Catalog</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Official statutory rules under Legal Metrology (Packaged Commodities) Rules, 2011.
        </p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">PCR 2011 Rules Knowledge Base</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Statutory rule citations, penalty schedules, and legal provisions scheduled for Step 7.2.
        </p>
      </div>
    </div>
  );
};
