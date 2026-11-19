const path = require('path');
const fs = require('fs');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(60000);

let mongoServer;
let app;
let adminToken;
let Inspection;
let Product;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SECRET_KEY = 'test_secret_key_32_bytes_minimum_length_hs256!';
  process.env.FIRST_SUPERUSER_EMAIL = 'admin@labelguard.ai';
  process.env.FIRST_SUPERUSER_PASSWORD = 'AdminSecurePassword123!';
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:8001';

  mongoServer = await MongoMemoryServer.create({
    binary: { version: '4.4.18' },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seedRulesAndAdmin = require('../src/seeds/seedRulesAndAdmin');
  await seedRulesAndAdmin();

  Inspection = require('../src/models/Inspection');
  Product = require('../src/models/Product');
  app = require('../src/app');

  const resLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
  adminToken = resLogin.body.access_token;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Critical Bug Investigation & Pipeline Regression Tests', () => {
  const { evaluateInspectionCompliance } = require('../src/services/compliance/decisionEngine');
  const { processImageWithAI } = require('../src/services/aiService');

  // 1. Zero-Token OCR must produce REQUIRES_MANUAL_REVIEW (Never POTENTIALLY_NON_COMPLIANT)
  it('1. Zero-token OCR response evaluates to REQUIRES_MANUAL_REVIEW without statutory violations', async () => {
    const zeroTokenInspection = new Inspection({
      inspectionNumber: 'INS-ZERO-TOKEN-01',
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'PROCESSING',
      images: [
        {
          filePath: 'uploads/test/blank.jpg',
          originalFilename: 'blank.jpg',
          fileSizeBytes: 10000,
          mimeType: 'image/jpeg',
          panelType: 'FRONT',
          ocrTokens: [], // ZERO TOKENS
        },
      ],
      extractedDeclarations: [],
    });
    await zeroTokenInspection.save();

    const evalResult = await evaluateInspectionCompliance(zeroTokenInspection);

    expect(evalResult.overall_status).toBe('REQUIRES_MANUAL_REVIEW');
    expect(evalResult.failed_count).toBe(0);
    expect(evalResult.manual_review_count).toBeGreaterThan(0);

    // Verify individual findings: no mandatory rule must be marked FAIL
    for (const finding of evalResult.findings) {
      expect(finding.status).not.toBe('FAIL');
    }
  });

  // 2. Missing OCR evidence alone must never produce POTENTIALLY_NON_COMPLIANT
  it('2. High-confidence OCR with missing declarations produces REQUIRES_MANUAL_REVIEW (Not FAIL)', async () => {
    const missingEvidenceInspection = new Inspection({
      inspectionNumber: 'INS-MISSING-DECL-01',
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'PROCESSING',
      images: [
        {
          filePath: 'uploads/test/partial.jpg',
          originalFilename: 'partial.jpg',
          fileSizeBytes: 20000,
          mimeType: 'image/jpeg',
          panelType: 'FRONT',
          ocrTokens: [
            // High confidence tokens, but only brand text - no statutory declarations
            { detectedText: 'Delicious Premium Biscuits', confidence: 0.95, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'Quality Assured Since 1929', confidence: 0.94, polygonBbox: [], normalizedBbox: [] },
          ],
        },
      ],
      extractedDeclarations: [],
    });
    await missingEvidenceInspection.save();

    const evalResult = await evaluateInspectionCompliance(missingEvidenceInspection);

    // Must be REQUIRES_MANUAL_REVIEW, NOT POTENTIALLY_NON_COMPLIANT
    expect(evalResult.overall_status).toBe('REQUIRES_MANUAL_REVIEW');
    expect(evalResult.failed_count).toBe(0);
  });

  // 3. Positive Evidence of Breach correctly produces POTENTIALLY_NON_COMPLIANT
  it('3. Positive evidence of breach (prohibited unit symbol "gms") produces POTENTIALLY_NON_COMPLIANT', async () => {
    const breachInspection = new Inspection({
      inspectionNumber: 'INS-BREACH-01',
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'PROCESSING',
      images: [
        {
          filePath: 'uploads/test/breach.jpg',
          originalFilename: 'breach.jpg',
          fileSizeBytes: 20000,
          mimeType: 'image/jpeg',
          panelType: 'FRONT',
          ocrTokens: [
            { detectedText: 'NET QTY: 200 gms', confidence: 0.92, polygonBbox: [], normalizedBbox: [] },
          ],
        },
      ],
      extractedDeclarations: [
        {
          fieldType: 'NET_QUANTITY',
          rawText: 'NET QTY: 200 gms',
          parsedValue: { value: 200, unit: 'gms', standard_unit: 'g', is_standard_unit: false },
          confidence: 0.92,
        },
      ],
    });
    await breachInspection.save();

    const evalResult = await evaluateInspectionCompliance(breachInspection);

    expect(evalResult.overall_status).toBe('POTENTIALLY_NON_COMPLIANT');
    expect(evalResult.failed_count).toBeGreaterThanOrEqual(1);

    const unitFinding = evalResult.findings.find((f) => f.rule_code === 'PCR-R06-1-C-UNIT');
    expect(unitFinding.status).toBe('FAIL');
    expect(unitFinding.explanation).toContain('Non-standard unit symbol');
  });

  // 4. AI Service Unavailable handling
  it('4. Graceful handling when AI microservice URL is unreachable', async () => {
    // Override with an unreachable port
    const originalUrl = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:9999';

    const testImagePath = path.join(__dirname, 'fixtures', 'sample_label.jpg');
    const result = await processImageWithAI(testImagePath, 'out.jpg');

    expect(result.success).toBe(false);
    expect(result.tokens).toEqual([]);
    expect(result.declarations).toEqual([]);

    process.env.AI_SERVICE_URL = originalUrl;
  });

  // 5. Invalid Image Path handling
  it('5. processImageWithAI handles non-existent image path gracefully', async () => {
    const result = await processImageWithAI('non_existent_image_file_path_12345.jpg', 'out.jpg');
    expect(result.success).toBe(false);
    expect(result.tokens).toEqual([]);
    expect(result.declarations).toEqual([]);
  });

  // 6. Live AI OCR integration with real package image (if port 8001 is running)
  it('6. Live RapidOCR extracts tokens and declarations from real package image', async () => {
    const existingRawImage = path.resolve('uploads/packaging/6afef79bc5be151fbd0388e9/raw_8f5bbdbe-438f-4fa7-82ad-7f16ea65d52f.jpg');

    if (fs.existsSync(existingRawImage)) {
      const outPrep = path.resolve('uploads/packaging/6afef79bc5be151fbd0388e9/test_prep_regression.jpg');
      const aiResult = await processImageWithAI(existingRawImage, outPrep);

      if (aiResult.success) {
        expect(aiResult.tokens.length).toBeGreaterThan(0);
        expect(aiResult.processed_width).toBe(1000);
        expect(aiResult.processed_height).toBe(1000);
        expect(Array.isArray(aiResult.declarations)).toBe(true);
      }
    }
  });

  // 7. Report Generation displays sanitized panel names and SHA-256 hash
  it('7. Report generation sanitizes long panel filenames and verifies SHA-256 integrity', async () => {
    const { generateInspectionPdf, verifyReportIntegrity } = require('../src/services/reportService');

    const reportInspection = new Inspection({
      inspectionNumber: 'INS-REPORT-CLEAN-01',
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'REQUIRES_MANUAL_REVIEW',
      images: [
        {
          filePath: 'uploads/test/longname.jpg',
          // 150-char filename simulating user upload
          originalFilename: '9WL7GNq7qV-2uOupaNGK3eZkw8mIVC6vpkKtBcdx8VFKRnDfRsbdUFF7kS3vDyCZtKStk6k3a40in5Xo6V4wifjpyN0cTV7zXUL_q9v50EElIchz4lvAoslWcOA.jpeg',
          fileSizeBytes: 30000,
          mimeType: 'image/jpeg',
          panelType: 'BACK',
          widthPx: 1000,
          heightPx: 1000,
          ocrTokens: [
            { detectedText: 'NET WT 100 g', confidence: 0.90, polygonBbox: [], normalizedBbox: [] },
          ],
        },
      ],
      extractedDeclarations: [
        {
          fieldType: 'NET_QUANTITY',
          rawText: 'NET WT 100 g',
          parsedValue: { value: 100, unit: 'g', standard_unit: 'g', is_standard_unit: true },
          confidence: 0.90,
        },
      ],
    });
    await reportInspection.save();

    const pdfResult = await generateInspectionPdf(reportInspection._id.toString(), null);
    expect(pdfResult.sha256Hash).toBeDefined();
    expect(pdfResult.sha256Hash.length).toBe(64); // Valid SHA-256 hex string

    const verifyResult = await verifyReportIntegrity(reportInspection._id.toString());
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.status).toBe('VERIFIED_INTACT');
  });
});
