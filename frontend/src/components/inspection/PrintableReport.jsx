import React from 'react';
import { Scale, ShieldCheck, AlertCircle, FileText } from 'lucide-react';

export const PrintableReport = ({ inspection }) => {
  if (!inspection) return null;

  const inspectionNumber = inspection.inspection_number || inspection.id;
  const decls = inspection.extracted_declarations || [];
  const findings = inspection.findings || [];

  return (
    <div className="hidden print:block p-8 bg-white text-slate-900 font-sans max-w-4xl mx-auto space-y-6">
      {/* Print Header */}
      <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-slate-900" />
            <h1 className="text-xl font-bold uppercase tracking-tight">
              LabelGuard AI — Statutory Compliance Dossier
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Official Inspection Record under Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="font-mono font-bold">{inspectionNumber}</p>
          <p className="text-slate-500">{new Date(inspection.created_at || Date.now()).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Summary Metadata */}
      <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 border border-slate-300 text-xs rounded">
        <div>
          <span className="font-bold block text-slate-600 uppercase text-[10px]">Overall Determination</span>
          <span className="font-bold text-sm text-slate-900">{inspection.status}</span>
        </div>
        <div>
          <span className="font-bold block text-slate-600 uppercase text-[10px]">Compliance Score</span>
          <span className="font-bold text-sm text-slate-900">{inspection.overall_score ?? 0}%</span>
        </div>
        <div>
          <span className="font-bold block text-slate-600 uppercase text-[10px]">Panels Evaluated</span>
          <span className="font-bold text-sm text-slate-900">{inspection.images?.length || 0} Surfaces</span>
        </div>
      </div>

      {/* Manual Override Notice (if applicable) */}
      {inspection.is_manual_override && (
        <div className="p-3 border border-amber-300 bg-amber-50 text-xs rounded space-y-1">
          <span className="font-bold text-amber-900 block uppercase text-[10px]">
            Audited Administrative Override Applied
          </span>
          <p className="text-amber-800 italic">
            &ldquo;{inspection.manual_override_reason || 'Manual determination recorded by officer.'}&rdquo;
          </p>
        </div>
      )}

      {/* Declarations Table */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
          1. Extracted Statutory Declarations (PCR 2011 Rule 6)
        </h2>
        <table className="w-full text-left text-xs border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-[11px]">
              <th className="p-2 border-r border-slate-300">Statutory Field</th>
              <th className="p-2 border-r border-slate-300">Extracted / Parsed Value</th>
              <th className="p-2 border-r border-slate-300 w-16">Conf.</th>
              <th className="p-2">Raw OCR Text</th>
            </tr>
          </thead>
          <tbody>
            {decls.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-2 text-center text-slate-500 italic">
                  No statutory declarations extracted.
                </td>
              </tr>
            ) : (
              decls.map((d, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-2 font-semibold border-r border-slate-200">{d.field_type}</td>
                  <td className="p-2 border-r border-slate-200">
                    {typeof d.parsed_value === 'object'
                      ? JSON.stringify(d.parsed_value)
                      : String(d.parsed_value || d.raw_text)}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono">
                    {Math.round((d.confidence || 1.0) * 100)}%
                  </td>
                  <td className="p-2 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                    {d.raw_text}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Compliance Findings Table */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
          2. Rule Compliance Findings
        </h2>
        <table className="w-full text-left text-xs border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-[11px]">
              <th className="p-2 border-r border-slate-300">Rule</th>
              <th className="p-2 border-r border-slate-300">Result</th>
              <th className="p-2 border-r border-slate-300">Statutory Citation</th>
              <th className="p-2">Explanation / Evidence</th>
            </tr>
          </thead>
          <tbody>
            {findings.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-2 text-center text-slate-500 italic">
                  No rule findings available.
                </td>
              </tr>
            ) : (
              findings.map((f, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-2 font-mono font-bold border-r border-slate-200">{f.rule_code}</td>
                  <td className="p-2 font-bold border-r border-slate-200">
                    <span
                      className={
                        f.status === 'PASS'
                          ? 'text-emerald-700'
                          : f.status === 'FAIL'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="p-2 text-[11px] border-r border-slate-200 font-mono">
                    {f.legal_citation || 'PCR 2011'}
                  </td>
                  <td className="p-2 text-[11px] text-slate-700">
                    {f.explanation}
                    {f.detected_evidence && (
                      <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                        Evidence: &ldquo;{f.detected_evidence}&rdquo;
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Officer Remarks */}
      {inspection.notes && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
          <span className="font-bold text-slate-700 uppercase text-[10px]">Officer Remarks</span>
          <p className="text-slate-800">{inspection.notes}</p>
        </div>
      )}

      {/* Disclaimers & Integrity */}
      <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-500 space-y-1">
        <p>
          <strong>Statutory Notice:</strong> This automated report provides regulatory intelligence under the Legal Metrology Act, 2009. An OCR non-detection does not alone constitute statutory proof of omission under Section 36 without physical verification of the packaged commodity.
        </p>
        {inspection.report?.sha256_hash && (
          <p className="font-mono text-[9px] text-slate-600">
            SHA-256 Digest: {inspection.report.sha256_hash} (Report #{inspection.report.report_number})
          </p>
        )}
      </div>
    </div>
  );
};
export default PrintableReport;
