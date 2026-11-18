const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Inspection = require('../models/Inspection');
const Product = require('../models/Product');
const { processImageWithAI, extractDeclarationsFromTokens } = require('../services/aiService');
const { evaluateInspectionCompliance } = require('../services/compliance/decisionEngine');
const { verifyImageMagicBytes } = require('../middleware/upload');

// Helper to generate compliant inspection numbers: INS-YYYYMMDD-XXXX
const generateInspectionNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INS-${dateStr}-${randomHex}`;
};

// @desc    Upload multi-panel packaging images and process OCR + Declaration Extraction
// @route   POST /api/v1/inspections/upload
const uploadPackagingImages = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ detail: 'At least one packaging panel image is required.' });
    }

    // Verify magic bytes for all files
    for (const file of files) {
      verifyImageMagicBytes(file.buffer, file.originalname);
    }

    const inspectorId = req.user._id;
    const { product_id, notes, panels } = req.body;

    let parsedPanels = [];
    if (panels) {
      try {
        parsedPanels = typeof panels === 'string' ? JSON.parse(panels) : panels;
      } catch (_) {
        parsedPanels = [panels];
      }
    }

    const defaultPanels = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

    const inspection = new Inspection({
      inspectionNumber: generateInspectionNumber(),
      productId: product_id || null,
      inspectorId,
      status: 'PROCESSING',
      notes: notes || '',
      images: [],
      extractedDeclarations: [],
    });

    const targetDir = path.join(process.cwd(), 'uploads', 'packaging', inspection._id.toString());
    fs.mkdirSync(targetDir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const verifiedMime = verifyImageMagicBytes(file.buffer, file.originalname);

      let panelType = 'OTHER';
      if (i < parsedPanels.length) {
        panelType = parsedPanels[i];
      } else if (i < defaultPanels.length) {
        panelType = defaultPanels[i];
      }

      const fileUuid = crypto.randomUUID();
      const rawFilename = `raw_${fileUuid}.jpg`;
      const rawPath = path.join(targetDir, rawFilename);
      const prepFilename = `prep_${fileUuid}.jpg`;
      const prepPath = path.join(targetDir, prepFilename);

      // Write raw file to disk
      fs.writeFileSync(rawPath, file.buffer);

      // Call Python AI microservice (OpenCV + RapidOCR + Extraction)
      const aiResult = await processImageWithAI(rawPath, prepPath);

      const relRawPath = path.relative(process.cwd(), rawPath).replace(/\\/g, '/');
      const relPrepPath = fs.existsSync(prepPath)
        ? path.relative(process.cwd(), prepPath).replace(/\\/g, '/')
        : relRawPath;

      // Map OCR tokens
      const ocrTokens = (aiResult.tokens || []).map((t) => ({
        detectedText: t.text,
        confidence: t.confidence,
        polygonBbox: t.polygon_bbox,
        normalizedBbox: t.normalized_bbox,
        lineIndex: t.line_index,
      }));

      inspection.images.push({
        filePath: relRawPath,
        preprocessedFilePath: relPrepPath,
        originalFilename: file.originalname || 'package_image.jpg',
        fileSizeBytes: file.size,
        mimeType: verifiedMime,
        panelType,
        widthPx: aiResult.processed_width || null,
        heightPx: aiResult.processed_height || null,
        ocrTokens,
      });

      const addedImage = inspection.images[inspection.images.length - 1];

      // Map extracted declarations from this panel
      if (Array.isArray(aiResult.declarations) && aiResult.declarations.length > 0) {
        for (const decl of aiResult.declarations) {
          inspection.extractedDeclarations.push({
            fieldType: decl.field_type,
            rawText: decl.raw_text,
            parsedValue: decl.parsed_value,
            confidence: decl.confidence,
            primaryBbox: decl.primary_bbox,
            sourceImageId: addedImage._id,
          });
        }
      }
    }

    await inspection.save();

    return res.status(201).json(inspection.toJSON());
  } catch (err) {
    return res.status(400).json({ detail: err.message });
  }
};

// @desc    Get dashboard inspection analytics/metrics
// @route   GET /api/v1/inspections/stats
const getInspectionStats = async (req, res) => {
  try {
    const total = await Inspection.countDocuments();
    const compliant = await Inspection.countDocuments({ status: 'COMPLIANT' });
    const nonCompliant = await Inspection.countDocuments({ status: 'POTENTIALLY_NON_COMPLIANT' });
    const manualReview = await Inspection.countDocuments({ status: 'REQUIRES_MANUAL_REVIEW' });
    const processing = await Inspection.countDocuments({ status: 'PROCESSING' });

    const complianceRate = total > 0 ? Number(((compliant / total) * 100).toFixed(1)) : 0.0;

    return res.status(200).json({
      total_inspections: total,
      compliant_count: compliant,
      potentially_non_compliant_count: nonCompliant,
      requires_manual_review_count: manualReview,
      processing_count: processing,
      compliance_rate: complianceRate,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    List conducted inspections
// @route   GET /api/v1/inspections
const listInspections = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { status_filter, status } = req.query;

    const query = {};
    const filter = status_filter || status;
    if (filter) query.status = filter.toUpperCase();

    const inspections = await Inspection.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(200).json(inspections.map((ins) => ins.toJSON()));
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Get single inspection dossier
// @route   GET /api/v1/inspections/:id
const getInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    return res.status(200).json(inspection.toJSON());
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Get extracted declarations for an inspection
// @route   GET /api/v1/inspections/:id/declarations
const getInspectionDeclarations = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    const json = inspection.toJSON();
    return res.status(200).json(json.extracted_declarations);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Trigger/re-run declaration extraction across all panels of an inspection
// @route   POST /api/v1/inspections/:id/extract
const triggerExtraction = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    // Collect all tokens across all panels
    const allTokens = [];
    for (const img of inspection.images) {
      for (const t of img.ocrTokens) {
        allTokens.push({
          text: t.detectedText,
          confidence: t.confidence,
          polygon_bbox: t.polygonBbox,
          normalized_bbox: t.normalizedBbox,
          line_index: t.lineIndex,
        });
      }
    }

    const aiRes = await extractDeclarationsFromTokens(allTokens);

    inspection.extractedDeclarations = [];
    if (aiRes.declarations) {
      for (const decl of aiRes.declarations) {
        inspection.extractedDeclarations.push({
          fieldType: decl.field_type,
          rawText: decl.raw_text,
          parsedValue: decl.parsed_value,
          confidence: decl.confidence,
          primaryBbox: decl.primary_bbox,
          sourceImageId: inspection.images[0] ? inspection.images[0]._id : null,
        });
      }
    }

    await inspection.save();
    return res.status(200).json(inspection.toJSON());
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

module.exports = {
  uploadPackagingImages,
  listInspections,
  getInspectionStats,
  getInspection,
  getInspectionDeclarations,
  triggerExtraction,
};
