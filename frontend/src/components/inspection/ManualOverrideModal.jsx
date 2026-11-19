import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  Lock,
  Loader2,
  Info
} from 'lucide-react';
import { overrideInspectionCompliance } from '../../api/inspections';

const OVERRIDE_OPTIONS = [
  {
    value: 'COMPLIANT',
    label: 'COMPLIANT (Statutory Declarations Verified)',
    desc: 'Package meets all mandatory PCR 2011 declarations upon physical or manual inspection.',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    value: 'POTENTIALLY_NON_COMPLIANT',
    label: 'POTENTIALLY NON-COMPLIANT (Confirmed Breach)',
    desc: 'Omission, font size infraction, or deceptive declaration confirmed for regulatory notice.',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  {
    value: 'REQUIRES_MANUAL_REVIEW',
    label: 'REQUIRES MANUAL REVIEW (Further Inquiry Needed)',
    desc: 'Ambiguous or unreadable text requiring physical laboratory or legal metrology verification.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
];

export const ManualOverrideModal = ({
  isOpen,
  onClose,
  inspection,
  currentUser,
  onSuccess = () => {},
}) => {
  const [targetStatus, setTargetStatus] = useState('COMPLIANT');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !inspection) return null;

  // Authorization check
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_OFFICER'];
  const userRole = currentUser?.role?.toUpperCase();
  const isAuthorized = allowedRoles.includes(userRole);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthorized) {
      setErrorMessage('You do not possess the statutory authority to override an inspection determination.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      setErrorMessage('A detailed substantive rationale of at least 10 characters is required for auditing.');
      return;
    }

    if (!confirmed) {
      setErrorMessage('You must confirm administrative responsibility for this regulatory override.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await overrideInspectionCompliance(
        inspection.id,
        targetStatus,
        reason.trim()
      );
      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Failed to apply override:', err);
      setErrorMessage(
        err.response?.data?.detail || 'Failed to submit override. Check server connection.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Audited Compliance Determination Override
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Dossier: {inspection.inspection_number || inspection.id}
              </p>
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
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs space-y-1">
            <p className="font-bold">Override Submission Rejected</p>
            <p>{errorMessage}</p>
          </div>
        )}

        {!isAuthorized ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <Lock className="w-4 h-4 text-amber-600" />
              Restricted Administrative Action
            </div>
            <p>
              Your active role (<strong className="font-mono">{userRole || 'VIEWER'}</strong>) is not authorized to enact statutory overrides. This action is reserved strictly for{' '}
              <strong>COMPLIANCE_OFFICER</strong> and <strong>ADMIN</strong> officers.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Current vs Proposed Status */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  Current Engine Status
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {inspection.status}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  Proposed Override Status
                </span>
                <span className="font-mono font-bold text-indigo-700">{targetStatus}</span>
              </div>
            </div>

            {/* Target Status Select */}
            <div>
              <label className="font-bold text-slate-800 uppercase block mb-1.5">
                Select New Compliance Determination
              </label>
              <div className="space-y-2">
                {OVERRIDE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      targetStatus === opt.value
                        ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetStatus"
                      value={opt.value}
                      checked={targetStatus === opt.value}
                      onChange={(e) => setTargetStatus(e.target.value)}
                      className="mt-0.5 w-4 h-4 text-indigo-600"
                    />
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Substantive Reason Field */}
            <div>
              <label className="font-bold text-slate-800 uppercase block mb-1">
                Substantive Officer Justification / Audit Log Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide detailed legal metrology justification (e.g. Physical examination confirmed legible MRP stamp on outer container with approved SI metric unit)."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This explanation will be permanently recorded in the immutable audit trail along with your Officer ID and timestamp.
              </p>
            </div>

            {/* Legal Notice */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-start gap-2 text-slate-600 text-[11px]">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Administrative Disclaimer:</strong> Manual overrides represent regulatory supervisory determinations within LabelGuard AI and do not constitute a conclusive court finding or statutory certificate.
              </span>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span className="text-slate-700 leading-snug">
                I hereby certify that this manual determination has been verified by an authorized officer in accordance with the Legal Metrology (Packaged Commodities) Rules, 2011.
              </span>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !confirmed || reason.trim().length < 10}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Recording Override...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Apply Regulatory Override
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
export default ManualOverrideModal;
