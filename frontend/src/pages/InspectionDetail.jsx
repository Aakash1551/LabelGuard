import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Play,
  FileCheck,
  Sliders,
  Layers,
  FileText,
  Clock,
  UserCheck,
  Calendar,
  AlertCircle,
  Package,
  CheckCircle2,
  Lock,
  Loader2
} from 'lucide-react';
import { getInspection, evaluateInspection, triggerExtraction } from '../api/inspections';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { OcrImageViewer } from '../components/inspection/OcrImageViewer';
import { DeclarationsPanel } from '../components/inspection/DeclarationsPanel';
import { FindingsPanel } from '../components/inspection/FindingsPanel';
import { ManualOverrideModal } from '../components/inspection/ManualOverrideModal';

export const InspectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePanelIndex, setActivePanelIndex] = useState(0);

  // Cross-component Selection State
  const [selectedToken, setSelectedToken] = useState(null);
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);

  // Actions State
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('COMMAND_CENTER'); // 'COMMAND_CENTER' | 'DECLARATIONS' | 'FINDINGS' | 'RAW_TOKENS'

  const fetchDossier = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInspection(id);
      setInspection(data);
    } catch (err) {
      console.error('Failed to load inspection dossier:', err);
      setError(err.response?.data?.detail || 'Unable to retrieve inspection record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
  }, [id]);

  // Handle cross-interaction: select declaration -> switch panel if needed & highlight
  const handleSelectDeclaration = (decl) => {
    setSelectedDeclaration(decl);
    setSelectedToken(null);

    // If declaration has a sourceImageId, automatically switch viewer to that panel
    if (decl.source_image_id && inspection?.images) {
      const targetIndex = inspection.images.findIndex((img) => img.id === decl.source_image_id);
      if (targetIndex >= 0) {
        setActivePanelIndex(targetIndex);
      }
    }
  };

  const handleSelectToken = (token) => {
    setSelectedToken(token);
    setSelectedDeclaration(null);
  };

  const handleRunEvaluation = async () => {
    setActionLoading(true);
    setActionSuccessMessage(null);
    try {
      await evaluateInspection(id);
      setActionSuccessMessage('Compliance rules evaluated successfully.');
      await fetchDossier();
    } catch (err) {
      console.error('Evaluation failed:', err);
      setError(err.response?.data?.detail || 'Failed to run compliance evaluation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReRunExtraction = async () => {
    setActionLoading(true);
    setActionSuccessMessage(null);
    try {
      await triggerExtraction(id);
      setActionSuccessMessage('Statutory declaration extraction updated from OCR tokens.');
      await fetchDossier();
    } catch (err) {
      console.error('Re-extraction failed:', err);
      setError(err.response?.data?.detail || 'Failed to re-run declaration extraction.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-1/3"></div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-200 rounded-xl"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-8 text-center space-y-4 max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Inspection Dossier Error</h2>
        <p className="text-xs text-rose-600">{error || 'Record does not exist'}</p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/inspections')}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to List
          </button>
          <button
            onClick={fetchDossier}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isOverrideAllowed = ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_OFFICER'].includes(
    user?.role?.toUpperCase()
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation and Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              to="/inspections"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              title="Return to inspections list"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {inspection.inspection_number || inspection.id}
            </h1>
            <StatusBadge status={inspection.status} size="md" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pl-8">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(inspection.created_at || Date.now()).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              {inspection.images?.length || 0} Packaging Panels
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {inspection.extracted_declarations?.length || 0} Declarations Extracted
            </span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Run / Re-run Compliance Evaluation */}
          <button
            onClick={handleRunEvaluation}
            disabled={actionLoading}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Evaluate Compliance
          </button>

          {/* Re-run Token Extraction */}
          <button
            onClick={handleReRunExtraction}
            disabled={actionLoading}
            className="px-3 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Re-run spatial-regex declaration extraction on current OCR tokens"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-Extract
          </button>

          {/* Manual Override Action */}
          <button
            onClick={() => setIsOverrideModalOpen(true)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isOverrideAllowed
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
            title={
              isOverrideAllowed
                ? 'Apply audited compliance determination override'
                : 'Restricted to Compliance Officers & Administrators'
            }
          >
            <FileCheck className="w-3.5 h-3.5" />
            Manual Override
          </button>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-600 font-bold hover:text-emerald-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Manual Override Audit Banner */}
      {inspection.is_manual_override && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Audited Compliance Determination Override Active</span>
            </div>
            <span className="font-mono text-[11px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">
              Status Enforced: {inspection.status}
            </span>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-amber-200/80 space-y-1">
            <p className="font-semibold text-slate-800">Officer Substantive Justification:</p>
            <p className="text-slate-700 leading-relaxed italic">
              &ldquo;{inspection.manual_override_reason || 'Administrative reclassification.'}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Secondary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('COMMAND_CENTER')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'COMMAND_CENTER'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Interactive Command Center
        </button>
        <button
          onClick={() => setActiveTab('DECLARATIONS')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'DECLARATIONS'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Extracted Declarations ({inspection.extracted_declarations?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('FINDINGS')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'FINDINGS'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Rule Findings ({inspection.findings?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('RAW_TOKENS')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'RAW_TOKENS'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Raw OCR Tokens
        </button>
      </div>

      {/* Tab 1: Interactive Command Center (Split View) */}
      {activeTab === 'COMMAND_CENTER' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive OCR Viewer (7 cols) */}
          <div className="xl:col-span-7 space-y-4">
            <OcrImageViewer
              images={inspection.images || []}
              activePanelIndex={activePanelIndex}
              onSelectPanel={setActivePanelIndex}
              selectedTokenId={selectedToken?.id}
              selectedDeclaration={selectedDeclaration}
              onSelectToken={handleSelectToken}
            />

            {/* Officer Inspection Notes */}
            {inspection.notes && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs space-y-1">
                <span className="font-bold text-slate-700 uppercase tracking-wider block">
                  Field Officer Remarks
                </span>
                <p className="text-slate-600 leading-relaxed">{inspection.notes}</p>
              </div>
            )}
          </div>

          {/* Right Column: Declarations & Findings Accordion/Stack (5 cols) */}
          <div className="xl:col-span-5 space-y-6">
            <DeclarationsPanel
              declarations={inspection.extracted_declarations || []}
              images={inspection.images || []}
              selectedDeclaration={selectedDeclaration}
              onSelectDeclaration={handleSelectDeclaration}
            />

            <FindingsPanel
              findings={inspection.findings || []}
              overallStatus={inspection.status}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Full Declarations View */}
      {activeTab === 'DECLARATIONS' && (
        <div className="max-w-4xl mx-auto">
          <DeclarationsPanel
            declarations={inspection.extracted_declarations || []}
            images={inspection.images || []}
            selectedDeclaration={selectedDeclaration}
            onSelectDeclaration={handleSelectDeclaration}
          />
        </div>
      )}

      {/* Tab 3: Full Findings View */}
      {activeTab === 'FINDINGS' && (
        <div className="max-w-4xl mx-auto">
          <FindingsPanel
            findings={inspection.findings || []}
            overallStatus={inspection.status}
          />
        </div>
      )}

      {/* Tab 4: Raw OCR Tokens Table */}
      {activeTab === 'RAW_TOKENS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Detected OCR Tokens ({inspection.images[activePanelIndex]?.ocr_tokens?.length || 0} tokens in active panel)
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Panel:</span>
              <select
                value={activePanelIndex}
                onChange={(e) => setActivePanelIndex(Number(e.target.value))}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs bg-white"
              >
                {inspection.images?.map((img, idx) => (
                  <option key={img.id || idx} value={idx}>
                    {img.panel_type || `Panel ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Detected OCR Text</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Line Index</th>
                  <th className="py-2.5 px-3">Normalized Bounding Box</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {inspection.images[activePanelIndex]?.ocr_tokens?.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 text-slate-900 font-sans font-semibold">
                      {t.detected_text}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          (t.confidence || 0) > 0.85
                            ? 'bg-emerald-50 text-emerald-700'
                            : (t.confidence || 0) > 0.6
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {Math.round((t.confidence || 0) * 100)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{t.line_index ?? 0}</td>
                    <td className="py-2 px-3 text-[11px] text-slate-500 truncate max-w-xs">
                      {JSON.stringify(t.normalized_bbox)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Override Audited Modal */}
      <ManualOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        inspection={inspection}
        currentUser={user}
        onSuccess={(updated) => {
          setInspection(updated);
          setActionSuccessMessage('Compliance determination overridden successfully with audit record.');
        }}
      />
    </div>
  );
};
export default InspectionDetail;
