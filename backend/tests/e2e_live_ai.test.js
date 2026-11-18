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
const AI_PORT = 8001;

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

  // 1. Launch Python AI microservice
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

describe('E2E: Node.js Backend + Python RapidOCR Microservice Live Pipeline', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
    token = res.body.access_token;
  });

  it('Health endpoint should show AI microservice is online and accessible', async () => {
    const aiHealth = require('../src/services/aiService');
    const health = await aiHealth.checkAIHealth();
    expect(health.status).toBe('online');
    expect(health.engines.ocr).toContain('RapidOCR');
  });

  it('End-to-End Image Upload -> OpenCV -> RapidOCR -> MongoDB OCR Tokens persistence', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/sample_label.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    // Upload package image
    const uploadRes = await request(app)
      .post('/api/v1/inspections/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('panels', JSON.stringify(['FRONT']))
      .field('notes', 'End-to-end integration test with live RapidOCR microservice')
      .attach('files', fixturePath);

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.inspection_number).toBeDefined();
    expect(uploadRes.body.images).toHaveLength(1);

    const inspectionId = uploadRes.body.id;

    // Fetch full inspection dossier from MongoDB
    const dossierRes = await request(app)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(dossierRes.status).toBe(200);
    const dossier = dossierRes.body;
    expect(dossier.images).toHaveLength(1);

    const frontImage = dossier.images[0];
    expect(frontImage.panel_type).toBe('FRONT');
    expect(frontImage.width_px).toBeGreaterThan(0);
    expect(frontImage.height_px).toBeGreaterThan(0);

    // Verify OCR tokens extracted by RapidOCR
    const tokens = frontImage.ocr_tokens;
    expect(tokens.length).toBeGreaterThan(0);

    const allDetectedText = tokens.map((t) => t.detected_text).join(' ');
    console.log('[E2E OCR Result] Extracted text from sample package:', allDetectedText);

    // Assert that text from sample_label.jpg was read
    expect(allDetectedText).toMatch(/(QUANTITY|500|MRP|150)/i);

    // Check token coordinates normalization and schema structure
    const sampleToken = tokens[0];
    expect(sampleToken.confidence).toBeGreaterThan(0.5);
    expect(sampleToken.polygon_bbox).toHaveLength(4);
    expect(sampleToken.normalized_bbox).toHaveLength(4);

    // Verify [0.0, 1.0] bounding box normalization
    sampleToken.normalized_bbox.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0.0);
      expect(x).toBeLessThanOrEqual(1.0);
      expect(y).toBeGreaterThanOrEqual(0.0);
      expect(y).toBeLessThanOrEqual(1.0);
    });
  });
});
