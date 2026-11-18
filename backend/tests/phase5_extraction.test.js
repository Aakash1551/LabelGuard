const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(60000);

let mongoServer;
let app;
let aiProcess;
const AI_PORT = 8003;

// Helper to poll until Python microservice is ready
const waitForAIService = async (maxAttempts = 30, intervalMs = 500) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${AI_PORT}/health`, (response) => {
          resolve(response.statusCode);
        });
        req.on('error', reject);
        req.setTimeout(400);
      });
      if (res === 200) return true;
    } catch (_) {
      // Retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Python AI Microservice failed to become healthy within timeout.');
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SECRET_KEY = 'test_secret_key_32_bytes_minimum_length_hs256!';
  process.env.FIRST_SUPERUSER_EMAIL = 'admin@labelguard.ai';
  process.env.FIRST_SUPERUSER_PASSWORD = 'AdminSecurePassword123!';
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${AI_PORT}`;

  // 1. Launch Python AI microservice on AI_PORT
  const pythonExe = path.resolve(__dirname, '../venv/Scripts/python.exe');
  const aiServiceDir = path.resolve(__dirname, '../../ai_service');

  aiProcess = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(AI_PORT)], {
    cwd: aiServiceDir,
    stdio: 'ignore',
  });

  await waitForAIService();

  // 2. Start MongoMemoryServer with cached 4.4.18 binary
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '4.4.18' },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // 3. Seed Admin and Rules
  const seedRulesAndAdmin = require('../src/seeds/seedRulesAndAdmin');
  await seedRulesAndAdmin();

  app = require('../src/app');
});

afterAll(async () => {
  if (aiProcess) {
    aiProcess.kill();
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Phase 5: Statutory Declaration Extraction Engine Integration', () => {
  let token;
  let inspectionId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
    token = res.body.access_token;
  });

  it('1. Upload packaging label & automatically extract statutory declarations', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/statutory_label.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const res = await request(app)
      .post('/api/v1/inspections/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('panels', JSON.stringify(['FRONT']))
      .field('notes', 'Phase 5 Statutory Declaration Extraction Test')
      .attach('files', fixturePath);

    expect(res.status).toBe(201);
    expect(res.body.inspection_number).toBeDefined();
    expect(res.body.images).toHaveLength(1);

    inspectionId = res.body.id;
    const declarations = res.body.extracted_declarations;
    expect(declarations.length).toBeGreaterThanOrEqual(4);

    const fieldTypes = declarations.map((d) => d.field_type);
    console.log('[Phase 5 Extraction] Detected declaration types:', fieldTypes);

    // Verify presence of primary statutory fields
    expect(fieldTypes).toContain('NET_QUANTITY');
    expect(fieldTypes).toContain('MRP');
  });

  it('2. GET /api/v1/inspections/:id/declarations should return all parsed declarations with provenance', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${inspectionId}/declarations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const declarations = res.body;
    expect(declarations.length).toBeGreaterThanOrEqual(4);

    // Verify Net Quantity details
    const netQty = declarations.find((d) => d.field_type === 'NET_QUANTITY');
    expect(netQty).toBeDefined();
    expect(netQty.parsed_value.value).toBe(500);
    expect(netQty.parsed_value.unit).toBe('g');
    expect(netQty.parsed_value.is_standard_unit).toBe(true);
    expect(netQty.confidence).toBeGreaterThan(0.7);
    expect(netQty.primary_bbox).toBeDefined();

    // Verify MRP details
    const mrp = declarations.find((d) => d.field_type === 'MRP');
    expect(mrp).toBeDefined();
    expect(mrp.parsed_value.amount).toBe(150);
    expect(mrp.parsed_value.currency).toBe('INR');
    expect(mrp.parsed_value.inclusive_of_taxes).toBe(true);

    // Verify Unit Sale Price details
    const usp = declarations.find((d) => d.field_type === 'UNIT_SALE_PRICE');
    if (usp) {
      expect(usp.parsed_value.price).toBe(0.3);
      expect(usp.parsed_value.unit).toBe('g');
    }

    // Verify Date details
    const mfgDate = declarations.find((d) => d.field_type === 'MFG_DATE');
    if (mfgDate) {
      expect(mfgDate.parsed_value.month).toBe(4);
      expect(mfgDate.parsed_value.year).toBe(2024);
    }

    // Verify Country of Origin
    const origin = declarations.find((d) => d.field_type === 'COUNTRY_OF_ORIGIN');
    if (origin) {
      expect(origin.parsed_value.country).toBe('India');
    }
  });

  it('3. POST /api/v1/inspections/:id/extract should allow re-triggering multi-panel aggregation', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspectionId}/extract`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.extracted_declarations.length).toBeGreaterThanOrEqual(4);
  });
});
