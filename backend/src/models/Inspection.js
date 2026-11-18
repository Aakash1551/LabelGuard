const mongoose = require('mongoose');

const ocrTokenSchema = new mongoose.Schema({
  detectedText: { type: String, required: true },
  confidence: { type: Number, required: true },
  polygonBbox: { type: mongoose.Schema.Types.Mixed, required: true },
  normalizedBbox: { type: mongoose.Schema.Types.Mixed, required: true },
  lineIndex: { type: Number, default: 0 },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

const inspectionImageSchema = new mongoose.Schema({
  filePath: { type: String, required: true },
  preprocessedFilePath: { type: String },
  originalFilename: { type: String, required: true },
  fileSizeBytes: { type: Number, required: true },
  mimeType: { type: String, required: true },
  panelType: {
    type: String,
    enum: ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'BULK', 'OTHER'],
    default: 'FRONT',
  },
  widthPx: { type: Number },
  heightPx: { type: Number },
  ocrTokens: [ocrTokenSchema],
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

const extractedDeclarationSchema = new mongoose.Schema({
  fieldType: { type: String, required: true },
  rawText: { type: String, required: true },
  parsedValue: { type: mongoose.Schema.Types.Mixed, required: true },
  confidence: { type: Number, default: 1.0 },
  primaryBbox: { type: mongoose.Schema.Types.Mixed },
  sourceImageId: { type: mongoose.Schema.Types.ObjectId },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

const complianceFindingSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceRule' },
  ruleCode: { type: String, required: true },
  fieldName: { type: String, required: true },
  status: {
    type: String,
    enum: ['PASS', 'FAIL', 'REQUIRES_MANUAL_REVIEW', 'EXEMPTED'],
    required: true,
  },
  detectedEvidence: { type: String },
  expectedFormat: { type: String },
  confidenceScore: { type: Number, default: 1.0 },
  explanation: { type: String, required: true },
  legalCitation: { type: String, required: true },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

const inspectionReportSchema = new mongoose.Schema({
  reportNumber: { type: String, required: true, unique: true },
  pdfFilePath: { type: String, required: true },
  fileSizeBytes: { type: Number, required: true },
  sha256Hash: { type: String, required: true },
  generatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

const inspectionSchema = new mongoose.Schema(
  {
    inspectionNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    inspectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLIANT', 'POTENTIALLY_NON_COMPLIANT', 'REQUIRES_MANUAL_REVIEW', 'FAILED'],
      default: 'PROCESSING',
      index: true,
    },
    overallScore: {
      type: Number,
      default: 0.0,
    },
    notes: {
      type: String,
    },
    isManualOverride: {
      type: Boolean,
      default: false,
    },
    manualOverrideById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    manualOverrideReason: {
      type: String,
      default: null,
    },
    images: [inspectionImageSchema],
    extractedDeclarations: [extractedDeclarationSchema],
    findings: [complianceFindingSchema],
    report: {
      type: inspectionReportSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.inspection_number = ret.inspectionNumber;
        ret.overall_score = ret.overallScore;
        ret.is_manual_override = ret.isManualOverride;
        ret.created_at = ret.createdAt;
        ret.updated_at = ret.updatedAt;

        if (ret.images) {
          ret.images = ret.images.map((img) => ({
            id: img._id ? img._id.toString() : img.id,
            file_path: img.filePath,
            preprocessed_file_path: img.preprocessedFilePath,
            original_filename: img.originalFilename,
            file_size_bytes: img.fileSizeBytes,
            mime_type: img.mimeType,
            panel_type: img.panelType,
            width_px: img.widthPx,
            height_px: img.heightPx,
            created_at: img.createdAt,
            ocr_tokens: (img.ocrTokens || []).map((t) => ({
              id: t._id ? t._id.toString() : t.id,
              detected_text: t.detectedText,
              confidence: t.confidence,
              polygon_bbox: t.polygonBbox,
              normalized_bbox: t.normalizedBbox,
              line_index: t.lineIndex,
            })),
          }));
        }

        if (ret.extractedDeclarations) {
          ret.extracted_declarations = ret.extractedDeclarations.map((d) => ({
            id: d._id ? d._id.toString() : d.id,
            field_type: d.fieldType,
            raw_text: d.rawText,
            parsed_value: d.parsedValue,
            confidence: d.confidence,
            primary_bbox: d.primaryBbox,
            source_image_id: d.sourceImageId ? d.sourceImageId.toString() : null,
            created_at: d.createdAt,
          }));
        } else {
          ret.extracted_declarations = [];
        }
        ret.findings = ret.findings || [];
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Inspection', inspectionSchema);
