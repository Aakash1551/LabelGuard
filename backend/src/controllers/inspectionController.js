const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Inspection = require('../models/Inspection');
const Product = require('../models/Product');
const { validateMagicBytes } = require('../middleware/upload');
const { processImageWithAI } = require('../services/aiService');

const generateInspectionNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INS-${dateStr}-${randomSuffix}`;
};

// @desc    Upload multi-panel packaging images, preprocess with CV, run RapidOCR, save to DB
// @route   POST /api/v1/inspections/upload
const uploadPackagingImages = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ detail: 'No files were provided for inspection.' });
    }

    const { panels, product_id, productId, notes } = req.body;
    const linkedProductId = product_id || productId || null;

    // Parse panel assignments
    let parsedPanels = [];
    if (panels) {
      try {
        const loaded = JSON.parse(panels);
        if (Array.isArray(loaded)) parsedPanels = loaded.map((p) => String(p).toUpperCase());
      } catch (e) {
        parsedPanels = panels.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
      }
    }

    const defaultPanels = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'BULK'];
    const inspectionNumber = generateInspectionNumber();

    // 1. Create inspection document
    const inspection = new Inspection({
      inspectionNumber,
      productId: linkedProductId,
      inspectorId: req.user._id,
      status: 'PROCESSING',
      overallScore: 0.0,
      notes: notes || null,
      images: [],
    });

    const targetDir = path.join('uploads', 'packaging', inspection._id.toString());
    fs.mkdirSync(targetDir, { recursive: true });

    // 2. Process each image with binary verification and AI microservice
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const verifiedMime = validateMagicBytes(file.buffer, file.originalname);

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

      // Call Python AI microservice (OpenCV + RapidOCR)
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
    }

    await inspection.save();

    return res.status(201).json(inspection.toJSON());
  } catch (err) {
    return res.status(400).json({ detail: err.message });
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

module.exports = { uploadPackagingImages, listInspections, getInspection };
