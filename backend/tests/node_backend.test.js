const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Extend Jest timeout for first-time binary cache download
jest.setTimeout(180000);

let mongoServer;
let app;

// Helper to create synthetic JPEG bytes with valid magic bytes FF D8 FF
const createSyntheticJpeg = () => {
  // A minimal valid 1x1 JPEG buffer
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
    0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0xff,
    0xd9,
  ]);
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SECRET_KEY = 'test_secret_key_32_bytes_minimum_length_hs256!';
  process.env.FIRST_SUPERUSER_EMAIL = 'admin@labelguard.ai';
  process.env.FIRST_SUPERUSER_PASSWORD = 'AdminSecurePassword123!';

  mongoServer = await MongoMemoryServer.create({
    binary: { version: '4.4.18' }
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Seed Admin and PCR 2011 rules
  const seedRulesAndAdmin = require('../src/seeds/seedRulesAndAdmin');
  await seedRulesAndAdmin();

  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('1. System Health & Diagnostics', () => {
  it('GET /api/v1/health should return 200 with online status and healthy database', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.database).toBe('healthy');
  });
});

describe('2. Authentication & RBAC', () => {
  let adminToken;
  let inspectorToken;

  it('POST /api/v1/auth/login should authenticate seeded admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.role).toBe('ADMIN');
    adminToken = res.body.access_token;
  });

  it('POST /api/v1/auth/register should create new inspector user', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'inspector.node@gov.in',
      password: 'SecurePassword123!',
      full_name: 'Metrology Testing Officer',
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('inspector.node@gov.in');
    expect(res.body.role).toBe('INSPECTOR');
  });

  it('GET /api/v1/auth/me should return inspector profile with bearer token', async () => {
    // Login as new inspector
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inspector.node@gov.in', password: 'SecurePassword123!' });
    inspectorToken = loginRes.body.access_token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${inspectorToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('inspector.node@gov.in');
  });

  it('RBAC: Non-admin inspector cannot access /api/v1/users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${inspectorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('Administrative privileges required');
  });

  it('RBAC: Admin CAN access /api/v1/users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('3. Statutory PCR 2011 Rules Catalog', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
    token = res.body.access_token;
  });

  it('GET /api/v1/rules should return all 10 seeded statutory rules', async () => {
    const res = await request(app)
      .get('/api/v1/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(10);

    const codes = res.body.map((r) => r.rule_code);
    expect(codes).toContain('PCR-R06-1-A'); // Manufacturer
    expect(codes).toContain('PCR-R06-1-C'); // Net Qty
    expect(codes).toContain('PCR-R06-1-D'); // Date
    expect(codes).toContain('PCR-R06-1-E'); // MRP
    expect(codes).toContain('PCR-R06-1-N'); // Consumer Care
  });

  it('GET /api/v1/rules/:code should return specific rule details', async () => {
    const res = await request(app)
      .get('/api/v1/rules/PCR-R06-1-E')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rule_code).toBe('PCR-R06-1-E');
    expect(res.body.category).toBe('MRP');
  });
});

describe('4. Product Catalog CRUD', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
    token = res.body.access_token;
  });

  it('POST /api/v1/products should create product', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'MERN Certified Basmati Rice',
        brand: 'Heritage Agro',
        category: 'FOOD',
        barcode_gtin: '8901234567899',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('MERN Certified Basmati Rice');
    expect(res.body.category).toBe('FOOD');
  });

  it('GET /api/v1/products should list created product', async () => {
    const res = await request(app)
      .get('/api/v1/products?search=Basmati')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].name).toContain('Basmati Rice');
  });
});

describe('5. Multi-Panel Inspection Upload & Security', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@labelguard.ai', password: 'AdminSecurePassword123!' });
    token = res.body.access_token;
  });

  it('Rejection of fake image file (spoofed extension with non-image bytes)', async () => {
    const fakeBuffer = Buffer.from('FAKE TEXT CONTENT DISGUISED AS JPG');

    const res = await request(app)
      .post('/api/v1/inspections/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', fakeBuffer, 'malicious.jpg');

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('Invalid file content signature');
  });

  it('Successful multi-panel upload and inspection persistence in MongoDB', async () => {
    const jpegBuffer = createSyntheticJpeg();

    const res = await request(app)
      .post('/api/v1/inspections/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('panels', JSON.stringify(['FRONT']))
      .field('notes', 'Inspection test under MERN architecture')
      .attach('files', jpegBuffer, 'front_label.jpg');

    expect(res.status).toBe(201);
    expect(res.body.inspection_number).toMatch(/^INS-\d{8}-[A-F0-9]{4}$/);
    expect(res.body.status).toBe('PROCESSING');
    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0].panel_type).toBe('FRONT');
    expect(res.body.images[0].file_path).toBeDefined();

    const inspectionId = res.body.id;

    // Retrieve inspection detail
    const detailRes = await request(app)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(inspectionId);
    expect(detailRes.body.images).toHaveLength(1);
  });
});
