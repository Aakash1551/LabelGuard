import React from 'react';
import { UploadCloud } from 'lucide-react';

export const NewInspection = () => {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Multi-Panel Inspection</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Upload packaging panels for automated OpenCV deskewing, RapidOCR, and PCR 2011 verification.
        </p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <UploadCloud className="w-10 h-10 text-brand-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Multi-Panel Drag & Drop Uploader</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Interactive drag-and-drop packaging uploader scheduled for Step 7.3.
        </p>
      </div>
    </div>
  );
};
