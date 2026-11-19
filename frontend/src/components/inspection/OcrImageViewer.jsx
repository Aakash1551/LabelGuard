import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Layers,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

export const OcrImageViewer = ({
  images = [],
  activePanelIndex = 0,
  onSelectPanel = () => {},
  selectedTokenId = null,
  selectedDeclaration = null,
  onSelectToken = () => {},
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [overlayMode, setOverlayMode] = useState('ALL'); // 'ALL' | 'DECLARATIONS_ONLY' | 'NONE'
  const [hoveredToken, setHoveredToken] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef(null);

  const activeImage = images[activePanelIndex] || images[0];

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [activePanelIndex, activeImage?.id]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  // Determine image source URL
  const getImageSrc = (img) => {
    if (!img) return '';
    const path = img.preprocessed_file_path || img.file_path;
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/')) return path;
    return `/${path}`;
  };

  // Convert normalized 4-point polygon [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] to SVG polygon points string
  const getSvgPoints = (normalizedBbox) => {
    if (!normalizedBbox || !Array.isArray(normalizedBbox) || normalizedBbox.length < 3) {
      return '';
    }
    return normalizedBbox
      .map(([x, y]) => {
        const px = Math.min(Math.max(x * 1000, 0), 1000);
        const py = Math.min(Math.max(y * 1000, 0), 1000);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
  };

  // Check if declaration matches active panel
  const declarationBbox =
    selectedDeclaration &&
    (!selectedDeclaration.source_image_id ||
      selectedDeclaration.source_image_id === activeImage?.id)
      ? selectedDeclaration.primary_bbox
      : null;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col shadow-lg">
      {/* Top Toolbar */}
      <div className="bg-slate-800/90 backdrop-blur px-4 py-2.5 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        {/* Panel Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-thin">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Panels:
          </span>
          {images.map((img, idx) => {
            const isActive = idx === activePanelIndex;
            return (
              <button
                key={img.id || idx}
                onClick={() => onSelectPanel(idx)}
                className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <span>{img.panel_type || `Panel ${idx + 1}`}</span>
                {img.ocr_tokens && img.ocr_tokens.length > 0 && (
                  <span className="px-1 py-0.2 text-[10px] bg-slate-900/60 rounded font-mono">
                    {img.ocr_tokens.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Viewport and Layer Controls */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Overlay Filter Toggle */}
          <div className="flex items-center bg-slate-900/80 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => setOverlayMode('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                overlayMode === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all detected OCR tokens"
            >
              All OCR
            </button>
            <button
              onClick={() => setOverlayMode('DECLARATIONS_ONLY')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                overlayMode === 'DECLARATIONS_ONLY'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show only bounding boxes with extracted statutory evidence"
            >
              Declarations
            </button>
            <button
              onClick={() => setOverlayMode('NONE')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                overlayMode === 'NONE'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hide all bounding box overlays"
            >
              Clean
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-900/80 rounded p-0.5 border border-slate-700">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-40"
              disabled={zoomLevel <= 0.5}
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-300 w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-40"
              disabled={zoomLevel >= 3}
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Reset Zoom to 100%"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[480px] max-h-[640px] bg-slate-950 overflow-auto flex items-center justify-center p-4 scrollbar-thin"
      >
        {!activeImage ? (
          <div className="text-center p-8 text-slate-500 space-y-2">
            <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold">No packaging images in this inspection</p>
          </div>
        ) : imageError ? (
          <div className="text-center p-8 text-rose-400 space-y-2">
            <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
            <p className="text-sm font-semibold">Failed to load package image</p>
            <p className="text-xs text-slate-500 font-mono">{activeImage.file_path}</p>
          </div>
        ) : (
          <div
            className="relative transition-transform duration-150 inline-block"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            {/* The Original / Preprocessed Image */}
            <img
              src={getImageSrc(activeImage)}
              alt={activeImage.original_filename || 'Packaging Panel'}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className="max-h-[580px] w-auto block rounded shadow-2xl select-none"
              style={{ display: 'block' }}
            />

            {/* SVG Normalized Bounding Box Overlay */}
            {imageLoaded && overlayMode !== 'NONE' && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-auto"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
              >
                {/* 1. Normal OCR Tokens Layer */}
                {overlayMode === 'ALL' &&
                  activeImage.ocr_tokens?.map((token) => {
                    const isSelected = selectedTokenId === token.id;
                    const isHovered = hoveredToken?.id === token.id;
                    const points = getSvgPoints(token.normalized_bbox);
                    if (!points) return null;

                    return (
                      <polygon
                        key={token.id}
                        points={points}
                        onClick={() => onSelectToken(token)}
                        onMouseEnter={() => setHoveredToken(token)}
                        onMouseLeave={() => setHoveredToken(null)}
                        className="cursor-pointer transition-all duration-100"
                        stroke={isSelected ? '#10b981' : isHovered ? '#60a5fa' : '#38bdf8'}
                        strokeWidth={isSelected ? '4' : isHovered ? '2.5' : '1.2'}
                        strokeDasharray={isSelected ? 'none' : 'none'}
                        fill={
                          isSelected
                            ? 'rgba(16, 185, 129, 0.35)'
                            : isHovered
                            ? 'rgba(96, 165, 250, 0.25)'
                            : 'rgba(56, 189, 248, 0.08)'
                        }
                      />
                    );
                  })}

                {/* 2. Selected Statutory Declaration Evidence Polygon */}
                {declarationBbox && (
                  <polygon
                    points={getSvgPoints(declarationBbox)}
                    className="animate-pulse pointer-events-none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    fill="rgba(245, 158, 11, 0.35)"
                  />
                )}
              </svg>
            )}
          </div>
        )}

        {/* Hover / Active Token Floating HUD Tooltip */}
        {(hoveredToken || selectedDeclaration) && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-lg p-3 shadow-2xl z-20 text-xs space-y-1 animate-fadeIn">
            {hoveredToken ? (
              <>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="font-mono">Token Line #{hoveredToken.line_index ?? 0}</span>
                  <span className="font-semibold text-emerald-400">
                    Confidence: {Math.round((hoveredToken.confidence || 0) * 100)}%
                  </span>
                </div>
                <p className="font-mono text-slate-100 font-semibold bg-slate-800 px-2 py-1 rounded">
                  &ldquo;{hoveredToken.detected_text}&rdquo;
                </p>
              </>
            ) : selectedDeclaration ? (
              <>
                <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold">
                  <span>EVIDENCE: {selectedDeclaration.field_type}</span>
                  <span>Confidence: {Math.round((selectedDeclaration.confidence || 0) * 100)}%</span>
                </div>
                <p className="font-mono text-slate-200 text-xs bg-slate-800/80 p-1.5 rounded">
                  {selectedDeclaration.raw_text}
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="bg-slate-800/80 px-4 py-2 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            Panel: <strong className="text-slate-200">{activeImage?.panel_type || 'N/A'}</strong>
          </span>
          <span>
            Dimensions:{' '}
            <strong className="text-slate-200">
              {activeImage?.width_px && activeImage?.height_px
                ? `${activeImage.width_px} × ${activeImage.height_px} px`
                : 'Native'}
            </strong>
          </span>
          <span>
            Tokens: <strong className="text-slate-200">{activeImage?.ocr_tokens?.length || 0}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-400/30 border border-sky-400"></span>
          <span>OCR Token</span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-500 ml-2"></span>
          <span>Statutory Evidence</span>
        </div>
      </div>
    </div>
  );
};
export default OcrImageViewer;
