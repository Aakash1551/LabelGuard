const fs = require('fs');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let authToken;
let adminUser;
let testInspectionId;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SECRET_KEY = 'test_secret_key_32_bytes_minimum_length_hs256!';
  process.env.FIRST_SUPERUSER_EMAIL = 'admin@labelguard.ai';
  process.env.FIRST_SUPERUSER_PASSWORD = 'AdminSecurePassword123!';

  mongoServer = await MongoMemoryServer.create({
    binary: { version: '4.4.18' },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seedRulesAndAdmin = require('../src/seeds/seedRulesAndAdmin');
  await seedRulesAndAdmin();

  app = require('../src/app');

  // Authenticate as Admin
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'admin@labelguard.ai',
      password: 'AdminSecurePassword123!',
    });
  authToken = loginRes.body.access_token;
  const inspectorId = loginRes.body.user_id;

  // Create test inspection with declarations and findings
  const Inspection = require('../src/models/Inspection');
  const testInspection = new Inspection({
    inspectionNumber: 'INS-20261119-TEST',
    inspectorId: inspectorId,
    status: 'COMPLIANT',
    overallScore: 100.0,
    notes: 'Sample verified batch during testing.',
    images: [
      {
        filePath: 'uploads/packaging/test/sample_front.jpg',
        originalFilename: 'front_panel.jpg',
        fileSizeBytes: 102400,
        mimeType: 'image/jpeg',
        panelType: 'FRONT',
        widthPx: 1000,
        heightPx: 1000,
        ocrTokens: [
          {
            detectedText: 'MRP Rs 150.00 INCL TAX',
            confidence: 0.98,
            polygonBbox: [[10, 10], [100, 10], [100, 30], [10, 30]],
            normalizedBbox: [[0.01, 0.01], [0.1, 0.01], [0.1, 0.03], [0.01, 0.03]],
            lineIndex: 0,
          },
          {
            detectedText: 'NET QTY 500 g',
            confidence: 0.97,
            polygonBbox: [[10, 40], [80, 40], [80, 60], [10, 60]],
            normalizedBbox: [[0.01, 0.04], [0.08, 0.04], [0.08, 0.06], [0.01, 0.06]],
            lineIndex: 1,
          },
        ],
      },
    ],
    extractedDeclarations: [
      {
        fieldType: 'MRP',
        rawText: 'MRP Rs 150.00 INCL TAX',
        parsedValue: { amount: 150.0, currency: 'INR', inclusive_of_taxes: true },
        confidence: 0.98,
        primaryBbox: [[0.01, 0.01], [0.1, 0.01], [0.1, 0.03], [0.01, 0.03]],
      },
      {
        fieldType: 'NET_QUANTITY',
        rawText: 'NET QTY 500 g',
        parsedValue: { value: 500, unit: 'g', dimension: 'weight' },
        confidence: 0.97,
        primaryBbox: [[0.01, 0.04], [0.08, 0.04], [0.08, 0.06], [0.01, 0.06]],
      },
    ],
    findings: [
      {
        ruleCode: 'PCR-R06-1-E',
        fieldName: 'mrp',
        status: 'PASS',
        detectedEvidence: 'MRP Rs 150.00 INCL TAX',
        expectedFormat: 'Maximum Retail Price Rs ... inclusive of all taxes',
        confidenceScore: 0.98,
        explanation: 'MRP declaration is prominently visible with mandatory tax inclusion.',
        legalCitation: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e)',
      },
      {
        ruleCode: 'PCR-R06-1-C-UNIT',
        fieldName: 'net_quantity',
        status: 'PASS',
        detectedEvidence: '500 g',
        expectedFormat: 'Approved SI metric symbol (g/kg/ml/l)',
        confidenceScore: 0.97,
        explanation: 'Standard metric SI unit symbol "g" declared correctly.',
        legalCitation: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 12 & Rule 13',
      },
    ],
  });

  await testInspection.save();
  testInspectionId = testInspection._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Step 7.4: Inspection Report Generation & Cryptographic Integrity', () => {
  test('1. POST /api/v1/inspections/:id/report generates PDF and records SHA-256 hash', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${testInspectionId}/report`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(201);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.report_number).toMatch(/^REP-\d{8}-[A-F0-9]{4}$/);
    expect(res.body.report.pdf_file_path).toContain('uploads/reports');
    expect(res.body.report.file_size_bytes).toBeGreaterThan(1000);
    expect(res.body.report.sha256_hash).toHaveLength(64);

    // Verify PDF file on disk starts with %PDF-
    const fullPath = path.resolve(process.cwd(), res.body.report.pdf_file_path);
    expect(fs.existsSync(fullPath)).toBe(true);
    const buffer = fs.readFileSync(fullPath);
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
  });

  test('2. POST /api/v1/inspections/:id/report/verify verifies genuine PDF integrity', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${testInspectionId}/report/verify`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.status).toBe('VERIFIED_INTACT');
    expect(res.body.calculated_hash).toBe(res.body.stored_hash);
  });

  test('3. POST /api/v1/inspections/:id/report/verify detects tampered PDF file', async () => {
    const Inspection = require('../src/models/Inspection');
    const inspection = await Inspection.findById(testInspectionId);
    const fullPath = path.resolve(process.cwd(), inspection.report.pdfFilePath);

    // Tamper with file by appending invalid bytes
    fs.appendFileSync(fullPath, '\n%%TAMPERED_BYTES_TESTING%%');

    const res = await request(app)
      .post(`/api/v1/inspections/${testInspectionId}/report/verify`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.status).toBe('TAMPERED_OR_CORRUPT');
    expect(res.body.calculated_hash).not.toBe(res.body.stored_hash);

    // Restore clean report
    const { generateInspectionPdf } = require('../src/services/reportService');
    await generateInspectionPdf(testInspectionId, null);
  });

  test('4. GET /api/v1/inspections/:id/report/download streams PDF file', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${testInspectionId}/report/download`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-report-sha256']).toHaveLength(64);
  });

  test('5. GET /api/v1/inspections/:id/export/json exports complete inspection dossier', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${testInspectionId}/export/json`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dossier).toBeDefined();
    expect(res.body.dossier.inspection_number).toBe('INS-20261119-TEST');
    expect(res.body.dossier.extracted_declarations).toHaveLength(2);
    expect(res.body.dossier.findings).toHaveLength(2);
  });

  test('6. GET /api/v1/inspections/:id/export/csv exports well-formed RFC 4180 CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${testInspectionId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('LABELGUARD AI STATUTORY COMPLIANCE INSPECTION EXPORT');
    expect(res.text).toContain('PCR-R06-1-E');
    expect(res.text).toContain('NET_QUANTITY');
  });

  test('7. Unauthorized requests fail with 401', async () => {
    const res = await request(app).get(`/api/v1/inspections/${testInspectionId}/export/json`);
    expect(res.status).toBe(401);
  });
});
