import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Filter,
  Scale,
  ExternalLink,
  Info
} from 'lucide-react';

export const FindingsPanel = ({ findings = [], overallStatus = 'PROCESSING' }) => {
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredFindings = findings.filter((f) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PASS') return f.status === 'PASS' || f.status === 'EXEMPTED';
    if (statusFilter === 'FAIL') return f.status === 'FAIL';
    if (statusFilter === 'REVIEW') return f.status === 'REQUIRES_MANUAL_REVIEW';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            FAIL / NON-COMPLIANT
          </span>
        );
      case 'REQUIRES_MANUAL_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            REQUIRES MANUAL REVIEW
          </span>
        );
      case 'EXEMPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            EXEMPTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            Statutory Compliance Findings (PCR 2011)
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({findings.length})
          </button>
          <button
            onClick={() => setStatusFilter('PASS')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              statusFilter === 'PASS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Compliant
          </button>
          <button
            onClick={() => setStatusFilter('FAIL')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              statusFilter === 'FAIL'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            Failures
          </button>
          <button
            onClick={() => setStatusFilter('REVIEW')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              statusFilter === 'REVIEW'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            Manual Review
          </button>
        </div>
      </div>

      {/* Caution Legal Metrology Notice */}
      <div className="bg-amber-50/60 border-b border-amber-100 px-5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          <strong className="font-semibold text-amber-950">Statutory Notice:</strong> Under Rule 6 & Section 36 of the Legal Metrology Act, 2009, an OCR non-detection does not inherently prove omission. All &ldquo;POTENTIALLY_NON_COMPLIANT&rdquo; or &ldquo;REQUIRES_MANUAL_REVIEW&rdquo; findings must be corroborated by physical sample inspection before initiating seizure or compounding proceedings.
        </p>
      </div>

      {/* Findings List */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-[640px]">
        {filteredFindings.length === 0 ? (
          <div className="text-center py-10 text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No findings match this filter</p>
          </div>
        ) : (
          filteredFindings.map((finding) => (
            <div
              key={finding.id || finding.rule_code}
              className={`p-4 rounded-xl border transition-all space-y-3 ${
                finding.status === 'FAIL'
                  ? 'border-rose-200 bg-rose-50/30'
                  : finding.status === 'REQUIRES_MANUAL_REVIEW'
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Finding Card Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                    {finding.rule_code}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {finding.field_name?.replace(/_/g, ' ')}
                  </span>
                </div>
                {getStatusBadge(finding.status)}
              </div>

              {/* Legal Citation & Explanation */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-600 w-24 shrink-0">Statutory Ref:</span>
                  <span className="text-slate-800 font-medium font-mono text-[11px]">
                    {finding.legal_citation}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-600 w-24 shrink-0">Reason:</span>
                  <span className="text-slate-800 leading-relaxed font-medium">
                    {finding.explanation}
                  </span>
                </div>

                {finding.expected_format && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-slate-600 w-24 shrink-0">Mandated:</span>
                    <span className="text-slate-700 italic">{finding.expected_format}</span>
                  </div>
                )}

                {finding.detected_evidence && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-slate-600 w-24 shrink-0">OCR Evidence:</span>
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                      &ldquo;{finding.detected_evidence}&rdquo;
                    </span>
                  </div>
                )}

                {finding.manual_review_recommendation && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-start gap-2 text-amber-900 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold text-amber-950">Inspector Action Required:</strong>{' '}
                      {finding.manual_review_recommendation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default FindingsPanel;
