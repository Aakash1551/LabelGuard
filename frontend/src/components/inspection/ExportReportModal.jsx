import React, { useState } from 'react';
import {
  FileText,
  Download,
  ShieldCheck,
  ShieldAlert,
  Printer,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  X,
  Loader2,
  Info,
  RefreshCw,
  Lock
} from 'lucide-react';
import {
  downloadReportPdf,
  verifyReportSha256,
  downloadDossierJson,
  downloadDossierCsv,
  generateReport,
} from '../../api/inspections';

export const ExportReportModal = ({
  isOpen,
  onClose,
  inspection,
  onReportGenerated = () => {},
  onPrint = () => {},
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !inspection) return null;

  const currentReport = inspection.report;
  const inspectionNumber = inspection.inspection_number || inspection.id;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setErrorMessage(null);
    try {
      const filename = `${inspectionNumber}_statutory_report.pdf`;
      await downloadReportPdf(inspection.id, filename);
      // Refresh inspection to pick up newly generated report metadata
      onReportGenerated();
    } catch (err) {
      console.error('PDF download failed:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to generate or download PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleVerifySha256 = async () => {
    setVerifying(true);
    setErrorMessage(null);
    try {
      const result = await verifyReportSha256(inspection.id);
      setVerificationResult(result);
    } catch (err) {
      console.error('SHA-256 verification failed:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to verify report integrity.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    try {
      await downloadDossierJson(inspection.id, `${inspectionNumber}_dossier.json`);
    } catch (err) {
      console.error('JSON export failed:', err);
      setErrorMessage('Failed to export JSON dossier.');
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      await downloadDossierCsv(inspection.id, `${inspectionNumber}_findings.csv`);
    } catch (err) {
      console.error('CSV export failed:', err);
      setErrorMessage('Failed to export CSV report.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleCopyHash = () => {
    if (currentReport?.sha256_hash) {
      navigator.clipboard.writeText(currentReport.sha256_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Inspection Dossier Export & PDF Reports
              </h2>
              <p className="text-xs text-slate-500 font-mono">Dossier: {inspectionNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs">
            {errorMessage}
          </div>
        )}

        {/* 1. Official PDF Inspection Report Card */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Official Regulatory Inspection Report (PDF)
              </span>
            </div>
            {currentReport ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                {currentReport.report_number}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                Ready to Generate
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Generates an official document containing multi-panel metadata, extracted statutory declarations, rule-wise PCR 2011 findings, and officer audit notes.
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  {currentReport ? 'Download PDF Report' : 'Generate & Download PDF'}
                </>
              )}
            </button>

            <button
              onClick={onPrint}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all"
              title="Print regulatory dossier layout"
            >
              <Printer className="w-3.5 h-3.5" />
              Print View
            </button>
          </div>

          {/* Cryptographic SHA-256 Hash Display & Verification */}
          {currentReport?.sha256_hash && (
            <div className="pt-2 border-t border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-500" />
                  Cryptographic Integrity Hash (SHA-256)
                </span>
                <button
                  onClick={handleVerifySha256}
                  disabled={verifying}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {verifying ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Verify On Disk
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] text-slate-700">
                <span className="truncate flex-1" title={currentReport.sha256_hash}>
                  {currentReport.sha256_hash}
                </span>
                <button
                  onClick={handleCopyHash}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0"
                  title="Copy SHA-256 hash"
                >
                  {copiedHash ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Live Verification Badge */}
              {verificationResult && (
                <div
                  className={`p-2.5 rounded-lg border flex items-start gap-2 text-[11px] animate-fadeIn ${
                    verificationResult.verified
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {verificationResult.verified ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {verificationResult.verified
                        ? 'SHA-256 Hash Intact (Verified)'
                        : 'Integrity Check Failed (Hash Mismatch)'}
                    </span>
                    <span className="leading-snug">{verificationResult.message}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Structured Data Export (JSON & CSV) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Structured Data Exports
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* JSON Export */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  Complete Dossier JSON
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Full machine-readable archive with tokens, normalized coordinates, and audit log.
                </p>
              </div>
              <button
                onClick={handleDownloadJson}
                disabled={downloadingJson}
                className="w-full py-1.5 px-3 border border-slate-300 hover:bg-white rounded-lg font-semibold text-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all text-xs"
              >
                {downloadingJson ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export .JSON
              </button>
            </div>

            {/* CSV Export */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Findings & Declarations CSV
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  RFC 4180 spreadsheet with Rule 6 declarations and compliance finding rows.
                </p>
              </div>
              <button
                onClick={handleDownloadCsv}
                disabled={downloadingCsv}
                className="w-full py-1.5 px-3 border border-slate-300 hover:bg-white rounded-lg font-semibold text-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all text-xs"
              >
                {downloadingCsv ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export .CSV
              </button>
            </div>
          </div>
        </div>

        {/* Technical & Legal Note */}
        <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-xl flex items-start gap-2 text-blue-900 text-[11px]">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong>Cryptographic Integrity Notice:</strong> SHA-256 hash calculation verifies byte-level document integrity to detect post-generation file tampering. It does not constitute digital signature or certification of authorship under the Information Technology Act.
          </span>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
export default ExportReportModal;
