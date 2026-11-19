import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileImage,
  X,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Loader2,
  Info,
  RefreshCw,
  Plus
} from 'lucide-react';
import { uploadPackagingImages, evaluateInspection } from '../api/inspections';
import { listProducts } from '../api/products';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_FILES = 10;

const PANEL_TYPES = [
  { value: 'FRONT', label: 'Front Panel (PDP / Principal Display)' },
  { value: 'BACK', label: 'Back Panel (Informational Panel)' },
  { value: 'LEFT', label: 'Left Side Panel' },
  { value: 'RIGHT', label: 'Right Side Panel' },
  { value: 'TOP', label: 'Top Lid / Flap' },
  { value: 'BOTTOM', label: 'Bottom Base' },
  { value: 'BULK', label: 'Bulk / Outer Shipper Case' },
  { value: 'OTHER', label: 'Other Packaging Surface' },
];

export const NewInspection = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form State
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ file, previewUrl, panelType, id }]
  const [productId, setProductId] = useState('');
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [notes, setNotes] = useState('');
  const [autoEvaluate, setAutoEvaluate] = useState(true);

  // Upload/Processing State
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState(''); // 'uploading' | 'ai_processing' | 'evaluating'
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch product catalog for optional linkage
  useEffect(() => {
    const fetchCatalog = async () => {
      setLoadingProducts(true);
      try {
        const data = await listProducts({ limit: 50 });
        setProductsList(data || []);
      } catch (err) {
        console.warn('Could not load product list for selection:', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchCatalog();
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [selectedFiles]);

  const processIncomingFiles = (incomingFileList) => {
    setErrorMessage(null);
    const filesArray = Array.from(incomingFileList);

    if (selectedFiles.length + filesArray.length > MAX_FILES) {
      setErrorMessage(`Maximum limit of ${MAX_FILES} panel images exceeded. Only the first permitted files will be added.`);
    }

    const availableSlots = MAX_FILES - selectedFiles.length;
    const allowedNewFiles = filesArray.slice(0, availableSlots);

    const defaultPanels = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'OTHER'];
    const newItems = [];

    for (let i = 0; i < allowedNewFiles.length; i++) {
      const file = allowedNewFiles[i];

      // File type check
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setErrorMessage(`File "${file.name}" was skipped. Only JPG, PNG, and WebP images are supported.`);
        continue;
      }

      // File size check
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`File "${file.name}" exceeds the 15MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
        continue;
      }

      const assignedIndex = selectedFiles.length + newItems.length;
      const defaultPanel = assignedIndex < defaultPanels.length ? defaultPanels[assignedIndex] : 'OTHER';

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        panelType: defaultPanel,
      });
    }

    if (newItems.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
      // Reset input value so same file can be re-selected if removed
      e.target.value = null;
    }
  };

  const handleRemoveFile = (id) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handlePanelChange = (id, newPanelType) => {
    setSelectedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, panelType: newPanelType } : item))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMessage('Please upload at least one packaging panel image to initiate inspection.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setProcessingStage('uploading');
    setErrorMessage(null);

    try {
      const formData = new FormData();

      // Append files
      selectedFiles.forEach((item) => {
        formData.append('files', item.file);
      });

      // Append panels mapping array as JSON string
      const panelsArray = selectedFiles.map((item) => item.panelType);
      formData.append('panels', JSON.stringify(panelsArray));

      if (productId) {
        formData.append('product_id', productId);
      }
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      setProcessingStage('ai_processing');
      const response = await uploadPackagingImages(formData, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      const inspectionId = response.id;

      // Optional immediate compliance evaluation
      if (autoEvaluate && inspectionId) {
        setProcessingStage('evaluating');
        try {
          await evaluateInspection(inspectionId);
        } catch (evalErr) {
          console.warn('Auto evaluation encountered a non-blocking issue:', evalErr);
        }
      }

      // Navigate to the newly created inspection command center
      navigate(`/inspections/${inspectionId}`);
    } catch (err) {
      console.error('Inspection upload failed:', err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Failed to upload packaging images. Ensure Python AI microservice and backend are operational.';
      setErrorMessage(detail);
      setUploading(false);
      setProcessingStage('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Multi-Panel Inspection</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Upload package panels for OpenCV preprocessing, RapidOCR text recognition, and PCR 2011 compliance analysis.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Upload / Processing Error</p>
            <p className="text-xs text-rose-700">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Image Upload Area */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">1. Package Panel Images</h2>
            </div>
            <span className="text-xs text-slate-500">
              {selectedFiles.length} of {MAX_FILES} panels selected
            </span>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <UploadCloud className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              Drag & Drop package panel images here, or <span className="text-indigo-600 underline">browse files</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Supported formats: JPEG, PNG, WebP (up to 15MB per image). You can upload up to 10 panels (Front, Back, Sides, Top, Bottom) in a single inspection session.
            </p>
          </div>

          {/* Selected Panels Grid */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Panel Label Assignment ({selectedFiles.length})
                </h4>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add more panels
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative bg-slate-50 rounded-lg border border-slate-200 overflow-hidden group hover:border-slate-300 transition-all flex flex-col"
                  >
                    {/* Thumbnail preview */}
                    <div className="h-44 bg-slate-900/5 relative flex items-center justify-center overflow-hidden border-b border-slate-200">
                      <img
                        src={item.previewUrl}
                        alt={`Panel ${idx + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(item.id);
                        }}
                        className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-rose-600 hover:text-white rounded-full text-slate-600 shadow-sm transition-all"
                        title="Remove panel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/80 text-white rounded text-[11px] font-mono">
                        Panel #{idx + 1}
                      </div>
                    </div>

                    {/* Metadata & Panel Selector */}
                    <div className="p-3 space-y-2 bg-white flex-1 flex flex-col justify-between">
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                          Surface / Panel Type
                        </label>
                        <select
                          value={item.panelType}
                          onChange={(e) => handlePanelChange(item.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {PANEL_TYPES.map((pt) => (
                            <option key={pt.value} value={pt.value}>
                              {pt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Product Linkage and Notes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">2. Product Linkage & Inspection Notes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                Link Existing Product (Optional)
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Standalone / Unlinked Package --</option>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} - {p.name} {p.barcode_gtin ? `(${p.barcode_gtin})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Linking to a registered product enables automatic GTIN and commodity cross-verification.
              </p>
            </div>

            {/* Auto-evaluate toggle */}
            <div className="flex flex-col justify-center">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEvaluate}
                  onChange={(e) => setAutoEvaluate(e.target.checked)}
                  className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    Automatically Evaluate Statutory Compliance
                  </span>
                  <p className="text-xs text-slate-500">
                    Immediately run the 10 Legal Metrology (PCR 2011) compliance rules upon OCR completion.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Notes field */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
              Field Officer Remarks / Batch Information (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Seized from retail store in Zone B; batch #B-2024-09."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Upload & Processing Progress Bar */}
        {uploading && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                {processingStage === 'uploading' && `Uploading images to secure storage (${uploadProgress}%)...`}
                {processingStage === 'ai_processing' && 'Processing OpenCV deskewing, RapidOCR, & Declaration Extraction...'}
                {processingStage === 'evaluating' && 'Evaluating statutory compliance rules under PCR 2011...'}
              </span>
              <span className="font-mono text-indigo-700 font-bold">{uploadProgress}%</span>
            </div>

            <div className="w-full bg-indigo-200/60 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(uploadProgress, processingStage !== 'uploading' ? 95 : 5)}%` }}
              ></div>
            </div>

            <p className="text-[11px] text-indigo-700">
              Please do not navigate away while the AI microservice performs optical recognition and spatial parsing.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/inspections')}
            disabled={uploading}
            className="px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={uploading || selectedFiles.length === 0}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Panels...
              </>
            ) : (
              <>
                Start Packaging Inspection
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
export default NewInspection;
