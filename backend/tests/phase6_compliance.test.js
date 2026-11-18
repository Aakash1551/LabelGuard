const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(60000);

let mongoServer;
let app;
let adminToken;
let inspectorToken;
let Inspection;
let Product;
let ComplianceRule;

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

  Inspection = require('../src/models/Inspection');
  Product = require('../src/models/Product');
  ComplianceRule = require('../src/models/ComplianceRule');
  app = require('../src/app');

  // Login as admin
  const resAdmin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
  adminToken = resAdmin.body.access_token;

  // Register an inspector
  await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'inspector.sharma@labelguard.ai',
      password: 'InspectorPass123!',
      full_name: 'Inspector R. K. Sharma',
      role: 'INSPECTOR',
    });

  // Login as inspector to obtain bearer token
  const resInspLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'inspector.sharma@labelguard.ai', password: 'InspectorPass123!' });
  inspectorToken = resInspLogin.body.access_token;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Phase 6: Statutory Compliance Rules & Decision Engine', () => {
  let compliantInspectionId;
  let nonCompliantInspectionId;
  let lowConfInspectionId;

  // -------------------------------------------------------------
  // Test 1: Fully Compliant Package Evaluation
  // -------------------------------------------------------------
  it('1. Fully Compliant Package should evaluate to COMPLIANT with 100% score', async () => {
    const product = await Product.create({
      name: 'Organic Basmati Rice',
      brand: 'Himalayan Harvest',
      category: 'FOOD',
      barcodeGtin: '8901234567890',
    });

    const compliantInspection = new Inspection({
      inspectionNumber: 'INS-20261118-TEST1',
      productId: product._id,
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'PROCESSING',
      images: [
        {
          filePath: 'uploads/test/front.jpg',
          originalFilename: 'front.jpg',
          fileSizeBytes: 50000,
          mimeType: 'image/jpeg',
          panelType: 'FRONT',
          ocrTokens: [
            { detectedText: 'Organic Basmati Rice', confidence: 0.95, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'NET WT 500 g', confidence: 0.94, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'MRP Rs. 150.00 INCL OF ALL TAXES', confidence: 0.92, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'USP Rs. 0.30 / g', confidence: 0.91, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'MFD ON 04/2024', confidence: 0.93, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'Manufactured by Himalayan Foods Ltd Karnal 132001', confidence: 0.90, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'Country of Origin India', confidence: 0.96, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'Consumer Care 1800 123 4567 care@himalayan.com', confidence: 0.94, polygonBbox: [], normalizedBbox: [] },
          ],
        },
      ],
      extractedDeclarations: [
        {
          fieldType: 'NET_QUANTITY',
          rawText: 'NET WT 500 g',
          parsedValue: { value: 500, unit: 'g', standard_unit: 'g', is_standard_unit: true },
          confidence: 0.94,
        },
        {
          fieldType: 'MRP',
          rawText: 'MRP Rs. 150.00 INCL OF ALL TAXES',
          parsedValue: { amount: 150.0, currency: 'INR', inclusive_of_taxes: true },
          confidence: 0.92,
        },
        {
          fieldType: 'UNIT_SALE_PRICE',
          rawText: 'USP Rs. 0.30 / g',
          parsedValue: { price: 0.30, unit: 'g', currency: 'INR' },
          confidence: 0.91,
        },
        {
          fieldType: 'MFG_DATE',
          rawText: 'MFD ON 04/2024',
          parsedValue: { date_type: 'MFG_DATE', month: 4, year: 2024, formatted: '04/2024' },
          confidence: 0.93,
        },
        {
          fieldType: 'MANUFACTURER_ADDRESS',
          rawText: 'Manufactured by Himalayan Foods Ltd Karnal 132001',
          parsedValue: { role: 'MANUFACTURER', pincode: '132001', has_pincode: true },
          confidence: 0.90,
        },
        {
          fieldType: 'COUNTRY_OF_ORIGIN',
          rawText: 'Country of Origin India',
          parsedValue: { country: 'India', is_declared: true },
          confidence: 0.96,
        },
        {
          fieldType: 'CONSUMER_CARE',
          rawText: 'Consumer Care 1800 123 4567 care@himalayan.com',
          parsedValue: { phone: '1800 123 4567', email: 'care@himalayan.com', has_phone: true, has_email: true },
          confidence: 0.94,
        },
      ],
    });
    await compliantInspection.save();
    compliantInspectionId = compliantInspection._id.toString();

    // Trigger compliance evaluation API
    const res = await request(app)
      .post(`/api/v1/inspections/${compliantInspectionId}/evaluate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overall_status).toBe('COMPLIANT');
    expect(res.body.overall_score).toBe(100.0);
    expect(res.body.failed_count).toBe(0);
    expect(res.body.manual_review_count).toBe(0);
    expect(res.body.total_rules_evaluated).toBe(10);
  });

  // -------------------------------------------------------------
  // Test 2: Potentially Non-Compliant Declarations (Statutory Violations)
  // -------------------------------------------------------------
  it('2. Package with non-standard unit (gms) and missing tax disclosure should evaluate to POTENTIALLY_NON_COMPLIANT', async () => {
    const nonCompliantInspection = new Inspection({
      inspectionNumber: 'INS-20261118-TEST2',
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'PROCESSING',
      images: [
        {
          filePath: 'uploads/test/violating.jpg',
          originalFilename: 'violating.jpg',
          fileSizeBytes: 50000,
          mimeType: 'image/jpeg',
          panelType: 'FRONT',
          ocrTokens: [
            { detectedText: 'NET WT 500 gms', confidence: 0.91, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'MRP Rs. 150.00', confidence: 0.90, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'Mfg by ABC Foods, India', confidence: 0.88, polygonBbox: [], normalizedBbox: [] },
          ],
        },
      ],
      extractedDeclarations: [
        {
          fieldType: 'NET_QUANTITY',
          rawText: 'NET WT 500 gms',
          // Non-standard unit 'gms' is prohibited under Rule 12 & 13
          parsedValue: { value: 500, unit: 'gms', standard_unit: 'g', is_standard_unit: false },
          confidence: 0.91,
        },
        {
          fieldType: 'MRP',
          rawText: 'MRP Rs. 150.00',
          // Missing mandatory 'inclusive of all taxes' under Rule 6(1)(e)
          parsedValue: { amount: 150.0, currency: 'INR', inclusive_of_taxes: false },
          confidence: 0.90,
        },
        {
          fieldType: 'MANUFACTURER_ADDRESS',
          rawText: 'Mfg by ABC Foods, India',
          // Missing 6-digit postal PIN code under Rule 6(1)(a)
          parsedValue: { role: 'MANUFACTURER', pincode: null, has_pincode: false },
          confidence: 0.88,
        },
      ],
    });
    await nonCompliantInspection.save();
    nonCompliantInspectionId = nonCompliantInspection._id.toString();

    const res = await request(app)
      .post(`/api/v1/inspections/${nonCompliantInspectionId}/evaluate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overall_status).toBe('POTENTIALLY_NON_COMPLIANT');
    expect(res.body.failed_count).toBeGreaterThanOrEqual(2);

    const findings = res.body.findings;

    // Verify unit violation finding
    const unitFinding = findings.find((f) => f.rule_code === 'PCR-R06-1-C-UNIT');
    expect(unitFinding.status).toBe('FAIL');
    expect(unitFinding.explanation).toContain('Non-standard unit symbol');

    // Verify MRP tax violation finding
    const mrpFinding = findings.find((f) => f.rule_code === 'PCR-R06-1-E');
    expect(mrpFinding.status).toBe('FAIL');
    expect(mrpFinding.explanation).toContain('inclusive of all taxes');

    // Verify Manufacturer address PIN code violation finding
    const mfgFinding = findings.find((f) => f.rule_code === 'PCR-R06-1-A');
    expect(mfgFinding.status).toBe('FAIL');
    expect(mfgFinding.explanation).toContain('missing statutory 6-digit postal PIN code');
  });

  // -------------------------------------------------------------
  // Test 3: Low-Confidence OCR / Ambiguous Declarations (Manual Review)
  // -------------------------------------------------------------
  it('3. Low-confidence OCR with missing declarations should evaluate to REQUIRES_MANUAL_REVIEW (Never false non-compliance)', async () => {
    const lowConfInspection = new Inspection({
      inspectionNumber: 'INS-20261118-TEST3',
      inspectorId: new mongoose.Types.ObjectId(),
      status: 'PROCESSING',
      images: [
        {
          filePath: 'uploads/test/blurred.jpg',
          originalFilename: 'blurred.jpg',
          fileSizeBytes: 45000,
          mimeType: 'image/jpeg',
          panelType: 'FRONT',
          // Low OCR confidence (blurred or glare-affected label)
          ocrTokens: [
            { detectedText: 'NET ...', confidence: 0.52, polygonBbox: [], normalizedBbox: [] },
            { detectedText: 'Rs ...', confidence: 0.48, polygonBbox: [], normalizedBbox: [] },
          ],
        },
      ],
      extractedDeclarations: [],
    });
    await lowConfInspection.save();
    lowConfInspectionId = lowConfInspection._id.toString();

    const res = await request(app)
      .post(`/api/v1/inspections/${lowConfInspectionId}/evaluate`)
      .set('Authorization', `Bearer ${inspectorToken}`);

    expect(res.status).toBe(200);
    // Crucial statutory defense: Must NOT fail the package when evidence is simply unreadable
    expect(res.body.overall_status).toBe('REQUIRES_MANUAL_REVIEW');
    expect(res.body.manual_review_count).toBeGreaterThan(0);

    const findings = res.body.findings;
    const mrpFinding = findings.find((f) => f.rule_code === 'PCR-R06-1-E');
    expect(mrpFinding.status).toBe('REQUIRES_MANUAL_REVIEW');
    expect(mrpFinding.manual_review_recommendation).toBeDefined();
  });

  // -------------------------------------------------------------
  // Test 4: Inspection Findings & Compliance Summary APIs
  // -------------------------------------------------------------
  it('4. GET /api/v1/inspections/:id/compliance and /findings should return authoritative statutory data', async () => {
    const summaryRes = await request(app)
      .get(`/api/v1/inspections/${compliantInspectionId}/compliance`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.overall_status).toBe('COMPLIANT');
    expect(summaryRes.body.overall_score).toBe(100.0);
    expect(summaryRes.body.total_rules_evaluated).toBe(10);

    const findingsRes = await request(app)
      .get(`/api/v1/inspections/${compliantInspectionId}/findings`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(findingsRes.status).toBe(200);
    expect(findingsRes.body).toHaveLength(10);

    for (const finding of findingsRes.body) {
      expect(finding.rule_code).toBeDefined();
      expect(finding.legal_citation).toContain('The Legal Metrology');
      expect(finding.status).toBe('PASS');
    }
  });

  // -------------------------------------------------------------
  // Test 5: Audited Manual Override by Inspector
  // -------------------------------------------------------------
  it('5. PUT /api/v1/inspections/:id/override should record inspector override with mandatory reason', async () => {
    // Missing reason should return 400
    const failRes = await request(app)
      .put(`/api/v1/inspections/${lowConfInspectionId}/override`)
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({ override_status: 'COMPLIANT' });

    expect(failRes.status).toBe(400);
    expect(failRes.body.detail).toContain('Both override_status and reason are required');

    // Valid override with audit reason
    const overrideRes = await request(app)
      .put(`/api/v1/inspections/${lowConfInspectionId}/override`)
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({
        override_status: 'COMPLIANT',
        reason: 'Physical package verified by Inspector Sharma under standard daylight. All mandatory declarations confirmed present and legible on embossed seal.',
      });

    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.status).toBe('COMPLIANT');
    expect(overrideRes.body.is_manual_override).toBe(true);

    // Verify in MongoDB persistence
    const saved = await Inspection.findById(lowConfInspectionId);
    expect(saved.status).toBe('COMPLIANT');
    expect(saved.isManualOverride).toBe(true);
    expect(saved.manualOverrideReason).toContain('Physical package verified by Inspector Sharma');
  });
});
