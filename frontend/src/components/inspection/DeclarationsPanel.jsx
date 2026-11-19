import React from 'react';
import {
  FileText,
  DollarSign,
  Scale,
  Calendar,
  Building2,
  Globe2,
  Headphones,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Crosshair,
  Percent
} from 'lucide-react';

const STATUTORY_DECLARATION_DEFS = [
  {
    type: 'MRP',
    label: 'Maximum Retail Price (MRP)',
    rule: 'Rule 6(1)(e)',
    icon: DollarSign,
    color: 'emerald',
  },
  {
    type: 'NET_QUANTITY',
    label: 'Net Quantity & SI Units',
    rule: 'Rule 6(1)(c) & R11-13',
    icon: Scale,
    color: 'blue',
  },
  {
    type: 'UNIT_SALE_PRICE',
    label: 'Unit Sale Price (USP)',
    rule: 'Rule 6(1)(e) (Amended)',
    icon: Percent,
    color: 'violet',
  },
  {
    type: 'MANUFACTURER',
    label: 'Manufacturer / Packer / Importer',
    rule: 'Rule 6(1)(a)',
    icon: Building2,
    color: 'amber',
  },
  {
    type: 'COUNTRY_OF_ORIGIN',
    label: 'Country of Origin',
    rule: 'Rule 6(1)(aa)',
    icon: Globe2,
    color: 'teal',
  },
  {
    type: 'MFG_DATE',
    label: 'Month & Year of Mfg / Pkg / Imp',
    rule: 'Rule 6(1)(d)',
    icon: Calendar,
    color: 'indigo',
  },
  {
    type: 'CONSUMER_CARE',
    label: 'Consumer Care Cell Details',
    rule: 'Rule 6(1)(n)',
    icon: Headphones,
    color: 'rose',
  },
];

export const DeclarationsPanel = ({
  declarations = [],
  images = [],
  selectedDeclaration = null,
  onSelectDeclaration = () => {},
}) => {
  // Helper to find image panel name by sourceImageId
  const getPanelName = (sourceImageId) => {
    if (!sourceImageId) return 'All Panels';
    const img = images.find((i) => i.id === sourceImageId);
    return img ? img.panel_type || 'Package Panel' : 'Panel';
  };

  // Format parsed value nicely based on field type
  const renderParsedValue = (decl) => {
    const { field_type, parsed_value } = decl;
    if (!parsed_value) return <span className="text-slate-400">None parsed</span>;

    if (field_type === 'MRP') {
      return (
        <div className="space-y-1">
          <div className="text-base font-bold text-slate-900">
            {parsed_value.currency || '₹'} {parsed_value.amount?.toFixed(2)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${
                parsed_value.inclusive_of_taxes
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {parsed_value.inclusive_of_taxes ? '✓ Incl. of all taxes' : '⚠ Missing tax disclaimer'}
            </span>
          </div>
        </div>
      );
    }

    if (field_type === 'NET_QUANTITY') {
      return (
        <div className="space-y-1">
          <div className="text-base font-bold text-slate-900">
            {parsed_value.value} {parsed_value.unit}
          </div>
          <div className="text-[11px] text-slate-500">
            Quantity Type:{' '}
            <span className="font-semibold text-slate-700 capitalize">
              {parsed_value.dimension || 'standard'}
            </span>
          </div>
        </div>
      );
    }

    if (field_type === 'UNIT_SALE_PRICE') {
      return (
        <div className="text-base font-bold text-slate-900">
          ₹ {parsed_value.price_per_unit?.toFixed(2)} / {parsed_value.unit}
        </div>
      );
    }

    if (field_type === 'MFG_DATE') {
      return (
        <div className="space-y-1">
          <div className="text-sm font-bold text-slate-900">
            {parsed_value.month ? `${parsed_value.month}/` : ''}
            {parsed_value.year || parsed_value.raw_date}
          </div>
          {parsed_value.date_type && (
            <span className="text-[11px] text-slate-500 font-medium">
              Type: {parsed_value.date_type.toUpperCase()}
            </span>
          )}
        </div>
      );
    }

    if (field_type === 'MANUFACTURER') {
      return (
        <div className="space-y-1 text-xs text-slate-800">
          {parsed_value.company_name && (
            <p className="font-bold text-slate-900">{parsed_value.company_name}</p>
          )}
          {parsed_value.full_address && (
            <p className="text-slate-600 leading-snug">{parsed_value.full_address}</p>
          )}
          {parsed_value.pincode && (
            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
              PIN: {parsed_value.pincode}
            </span>
          )}
        </div>
      );
    }

    if (field_type === 'COUNTRY_OF_ORIGIN') {
      return (
        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <span>{parsed_value.country || parsed_value.raw_match}</span>
        </div>
      );
    }

    if (field_type === 'CONSUMER_CARE') {
      return (
        <div className="space-y-1 text-xs">
          {parsed_value.email && (
            <p className="text-slate-800">
              <strong className="text-slate-600">Email:</strong> {parsed_value.email}
            </p>
          )}
          {parsed_value.phone && (
            <p className="text-slate-800">
              <strong className="text-slate-600">Helpline:</strong> {parsed_value.phone}
            </p>
          )}
          {parsed_value.address && (
            <p className="text-slate-600 text-[11px] leading-snug">{parsed_value.address}</p>
          )}
        </div>
      );
    }

    return (
      <div className="text-xs text-slate-800 font-mono">
        {typeof parsed_value === 'object' ? JSON.stringify(parsed_value) : String(parsed_value)}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Extracted Statutory Declarations</h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
          {declarations.length} Detected
        </span>
      </div>

      {/* Declarations List */}
      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[640px] p-2 space-y-2">
        {STATUTORY_DECLARATION_DEFS.map((def) => {
          // Find matching declaration
          const decl = declarations.find((d) => d.field_type === def.type);
          const isSelected = selectedDeclaration && selectedDeclaration.id === decl?.id;
          const hasBbox = Boolean(decl?.primary_bbox);

          if (!decl) {
            // Un-detected field (do not fabricate, show absent / pending review state)
            return (
              <div
                key={def.type}
                className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <def.icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">{def.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{def.rule}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Not recognized in scanned package panels.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600 shrink-0">
                  Not Detected
                </span>
              </div>
            );
          }

          return (
            <div
              key={decl.id || def.type}
              onClick={() => onSelectDeclaration(decl)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-400'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 bg-white'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <def.icon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900">{def.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                    {def.rule}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasBbox ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Crosshair className="w-3 h-3" />
                      Visual Evidence
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Text Only
                    </span>
                  )}
                  <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {Math.round((decl.confidence || 1.0) * 100)}%
                  </span>
                </div>
              </div>

              {/* Parsed Value Display */}
              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                {renderParsedValue(decl)}
              </div>

              {/* Raw OCR Text & Panel Provenance */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <div className="truncate max-w-[220px]" title={decl.raw_text}>
                  <span className="font-semibold text-slate-600">Raw:</span> &ldquo;{decl.raw_text}&rdquo;
                </div>
                <span className="font-medium text-slate-600 shrink-0">
                  Panel: <strong className="text-slate-800">{getPanelName(decl.source_image_id)}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default DeclarationsPanel;
