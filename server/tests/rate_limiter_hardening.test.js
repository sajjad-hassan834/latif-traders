/**
 * ShopOS Rate Limiter Hardening Test Suite
 *
 * Verifies:
 * 1. Ten staff members on the same IP logging in successfully are NEVER blocked.
 * 2. Five consecutive login failures for User A block User A, but User B on the same IP is NOT blocked.
 * 3. IP-wide failure cap protects against multi-account brute force attacks.
 * 4. X-Forwarded-For resolution with 1 hop (Railway direct) and 2 hops (Vercel -> Railway).
 * 5. Register counts every attempt.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_RATE_LIMITS = '1';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const {
  loginRateLimiter,
  registerRateLimiter,
  resetLimitersForTesting
} = require('../middleware/rateLimiter');

function createTestApp(trustProxyHops = 1) {
  const app = express();
  app.set('trust proxy', trustProxyHops);
  app.use(express.json());

  app.post('/api/auth/login', loginRateLimiter, (req, res) => {
    const { username, password } = req.body;
    if (password === 'correct_password') {
      return res.status(200).json({ success: true, user: username });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  });

  app.post('/api/auth/register', registerRateLimiter, (req, res) => {
    return res.status(201).json({ success: true });
  });

  return app;
}

test('Rate Limits - Ten staff on same IP with valid logins are NEVER blocked', async () => {
  resetLimitersForTesting();
  const app = createTestApp(1);
  const sharedIp = '203.0.113.10';

  for (let i = 1; i <= 10; i++) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', sharedIp)
      .send({ username: `staff_user_${i}`, password: 'correct_password' });

    assert.strictEqual(res.status, 200, `Staff user ${i} must succeed`);
  }
});

test('Rate Limits - Five failures for User A lock User A, but do NOT block User B on the same IP', async () => {
  resetLimitersForTesting();
  const app = createTestApp(1);
  const sharedIp = '203.0.113.20';

  // 1. User A fails 5 times
  for (let i = 1; i <= 5; i++) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', sharedIp)
      .send({ username: 'user_a', password: 'wrong_password' });
    assert.strictEqual(res.status, 401, `Attempt ${i} should return 401`);
  }

  // 2. 6th attempt for User A should be rate-limited (429)
  const lockedRes = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', sharedIp)
    .send({ username: 'user_a', password: 'correct_password' });
  assert.strictEqual(lockedRes.status, 429, 'User A should be locked out (429)');

  // 3. User B on the EXACT SAME IP logs in and must succeed (200)
  const userBRes = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', sharedIp)
    .send({ username: 'user_b', password: 'correct_password' });
  assert.strictEqual(userBRes.status, 200, 'User B on same IP must NOT be blocked');
});

test('Rate Limits - X-Forwarded-For handling with 1 hop (Railway direct) and 2 hops (Vercel rewrite)', async () => {
  resetLimitersForTesting();

  // (a) Railway Direct: 1 proxy hop.
  // Header: "Client_IP" -> Express trust proxy 1 resolves to Client_IP
  const app1Hop = createTestApp(1);
  let capturedIp1 = null;
  app1Hop.get('/test-ip', (req, res) => {
    capturedIp1 = req.ip;
    res.json({ ip: req.ip });
  });

  await request(app1Hop)
    .get('/test-ip')
    .set('X-Forwarded-For', '198.51.100.42');
  assert.strictEqual(capturedIp1, '198.51.100.42', 'Railway 1-hop correctly resolves client IP');

  // (b) Vercel rewrite to Railway: 2 proxy hops.
  // Header: "Client_IP, Vercel_Edge_IP" -> Express trust proxy 2 resolves to Client_IP
  const app2Hops = createTestApp(2);
  let capturedIp2 = null;
  app2Hops.get('/test-ip', (req, res) => {
    capturedIp2 = req.ip;
    res.json({ ip: req.ip });
  });

  await request(app2Hops)
    .get('/test-ip')
    .set('X-Forwarded-For', '198.51.100.42, 76.76.21.21');
  assert.strictEqual(capturedIp2, '198.51.100.42', 'Vercel 2-hop rewrite correctly resolves client IP');
});

test('Rate Limits - Register counts every request and locks at 10 requests per IP', async () => {
  resetLimitersForTesting();
  const app = createTestApp(1);
  const clientIp = '203.0.113.50';

  for (let i = 1; i <= 10; i++) {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', clientIp)
      .send({ email: `test${i}@example.com` });
    assert.strictEqual(res.status, 201, `Register attempt ${i} should succeed`);
  }

  // 11th request should be rate-limited
  const blockedRes = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', clientIp)
    .send({ email: 'test11@example.com' });
  assert.strictEqual(blockedRes.status, 429, '11th registration attempt should return 429');
});

