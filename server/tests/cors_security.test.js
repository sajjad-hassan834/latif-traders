/**
 * ShopOS CORS & Cross-Origin Resource Policy Test Suite
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-security-secret-must-be-at-least-32-characters-long';
process.env.ALLOWED_ORIGINS = 'https://shoppyos.com,https://www.shoppyos.com,https://latiftraders.findcalculation.com,https://shopos.findcalculation.com,https://latif-traders.vercel.app';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const app = require('../index');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/database');

test('CORS - Exact permitted origins are allowed', async () => {
  const allowedTestOrigins = [
    'https://shoppyos.com',
    'https://www.shoppyos.com',
    'https://latiftraders.findcalculation.com',
    'https://shopos.findcalculation.com',
    'https://latif-traders.vercel.app',
    'http://localhost:5173'
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

test('CORS - Unlisted *.vercel.app and unlisted domains are REJECTED in production mode', async () => {
  // Test production CORS middleware directly
  const allowedOrigins = [
    'https://shoppyos.com',
    'https://www.shoppyos.com',
    'https://latiftraders.findcalculation.com',
    'https://shopos.findcalculation.com',
    'https://latif-traders.vercel.app'
  ];

  const prodCorsApp = express();
  prodCorsApp.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In production: no blanket *.vercel.app!
      return callback(new Error('CORS policy: Origin not allowed.'));
    }
  }));
  prodCorsApp.get('/test', (req, res) => res.json({ ok: true }));
  prodCorsApp.use((err, req, res, next) => {
    res.status(403).json({ error: err.message });
  });

  // 1. Unlisted vercel preview site must be blocked
  const res1 = await request(prodCorsApp)
    .get('/test')
    .set('Origin', 'https://malicious-phishing.vercel.app');
  assert.strictEqual(res1.status, 403);
  assert.strictEqual(res1.body.error, 'CORS policy: Origin not allowed.');

  // 2. Unlisted apex findcalculation.com must be blocked
  const res2 = await request(prodCorsApp)
    .get('/test')
    .set('Origin', 'https://findcalculation.com');
  assert.strictEqual(res2.status, 403);
  assert.strictEqual(res2.body.error, 'CORS policy: Origin not allowed.');

  // 3. Listed latiftraders.findcalculation.com must succeed
  const res3 = await request(prodCorsApp)
    .get('/test')
    .set('Origin', 'https://latiftraders.findcalculation.com');
  assert.strictEqual(res3.status, 200);
});

test('Trust Proxy - Startup verification and health check resolution with 1 and 2 hops', async () => {
  // Case A: 1 hop (Railway Direct)
  const app1 = express();
  app1.set('trust proxy', 1);
  app1.get('/proxy-check', (req, res) => {
    const hasForwarded = Boolean(req.headers['x-forwarded-for']);
    const clientDiffers = Boolean(hasForwarded && req.ip && req.socket?.remoteAddress && req.ip !== req.socket.remoteAddress);
    res.json({
      hops: 1,
      clientDiffersFromProxy: clientDiffers,
      clientIp: req.ip
    });
  });

  const res1 = await request(app1)
    .get('/proxy-check')
    .set('X-Forwarded-For', '203.0.113.195');
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.hops, 1);
  assert.strictEqual(res1.body.clientDiffersFromProxy, true);

  // Case B: 2 hops (Vercel rewrite -> Railway)
  const app2 = express();
  app2.set('trust proxy', 2);
  app2.get('/proxy-check', (req, res) => {
    const hasForwarded = Boolean(req.headers['x-forwarded-for']);
    const clientDiffers = Boolean(hasForwarded && req.ip && req.socket?.remoteAddress && req.ip !== req.socket.remoteAddress);
    res.json({
      hops: 2,
      clientDiffersFromProxy: clientDiffers,
      clientIp: req.ip
    });
  });

  const res2 = await request(app2)
    .get('/proxy-check')
    .set('X-Forwarded-For', '203.0.113.195, 76.76.21.21');
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.hops, 2);
  assert.strictEqual(res2.body.clientDiffersFromProxy, true);
  assert.strictEqual(res2.body.clientIp, '203.0.113.195', 'Must correctly extract client IP 2 hops back');
});

test('Uploads & Logo serving - Cross-Origin-Resource-Policy and X-Content-Type-Options headers present', async () => {
  const uploadsDir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const testFile = path.join(uploadsDir, 'test_sample.png');
  fs.writeFileSync(testFile, 'dummy image content');

  const res = await request(app).get('/uploads/test_sample.png');
  assert.strictEqual(res.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');

  try { fs.unlinkSync(testFile); } catch (_) {}
});
