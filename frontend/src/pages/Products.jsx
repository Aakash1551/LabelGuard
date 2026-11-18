import React from 'react';
import { Package } from 'lucide-react';

export const Products = () => {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Packaged commodities catalog indexed by Barcode / GTIN under Legal Metrology standards.
        </p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Product Management Console</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Product CRUD and GTIN barcode search module scheduled for Step 7.2.
        </p>
      </div>
    </div>
  );
};
