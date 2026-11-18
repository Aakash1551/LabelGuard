import React from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const InspectionDetail = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inspection Dossier</h1>
        <p className="text-sm text-slate-500 mt-0.5 font-mono">Dossier ID: {id}</p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <ShieldCheck className="w-10 h-10 text-brand-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Inspection Command Center</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Interactive packaging viewer with SVG bounding boxes, extracted declarations, and statutory findings scheduled for Step 7.3.
        </p>
      </div>
    </div>
  );
};
