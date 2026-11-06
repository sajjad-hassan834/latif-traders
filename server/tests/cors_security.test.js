/**
 * ShopOS CORS & Cross-Origin Resource Policy Test Suite
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-security-secret-must-be-at-least-32-characters-long';
process.env.ALLOWED_ORIGINS = 'https://findcalculation.com,https://app.findcalculation.com';
process.env.FRONTEND_URL = 'https://custom-frontend.com';
process.env.CLIENT_URL = 'https://client-frontend.com';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/database');

test('CORS - Allowed origins from ALLOWED_ORIGINS, FRONTEND_URL, CLIENT_URL, vercel.app, and localhost', async () => {
  const allowedTestOrigins = [
    'https://findcalculation.com',
    'https://app.findcalculation.com',
    'https://custom-frontend.com',
    'https://client-frontend.com',
    'https://my-preview.vercel.app',
    'http://localhost:5173',
    'https://shoppyos.com',
    'https://www.shoppyos.com'
  ];

  for (const origin of allowedTestOrigins) {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET');

    assert.strictEqual(
      res.headers['access-control-allow-origin'],
      origin,
      `Expected origin ${origin} to be permitted in CORS header`
    );
  }
});

test('CORS - No Origin header (server-to-server, curl, mobile native) is permitted', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
});

test('Uploads & Logo serving - Cross-Origin-Resource-Policy and X-Content-Type-Options headers present', async () => {
  // Ensure a test file in uploads
  const uploadsDir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const testFile = path.join(uploadsDir, 'test_sample.png');
  fs.writeFileSync(testFile, 'dummy image content');

  const res = await request(app).get('/uploads/test_sample.png');
  assert.strictEqual(res.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');

  try { fs.unlinkSync(testFile); } catch (_) {}
});
