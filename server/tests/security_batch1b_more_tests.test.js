process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret-key-for-unit-tests-at-least-32-chars' : 'shopos-dev-jwt-secret-not-for-production-min-32-chars');

test('Security Batch 1b - Item 9: Edge cases (deactivated user, expired token, missing token_version, suspended tenant, user ID spoofing in body)', async (t) => {
  const testSuffix = Date.now();
  const testTenantId = `t_edge_${testSuffix}`;
  const suspendedTenantId = `t_susp_${testSuffix}`;

  // 1. Setup active tenant and suspended tenant
  db.prepare(`
    INSERT INTO tenants (id, business_name, business_type, owner_name, email, is_active)
    VALUES (?, 'Edge Test Corp', 'retail_general', 'Owner Edge', 'edge@test.com', 1)
  `).run(testTenantId);

  db.prepare(`
    INSERT INTO tenants (id, business_name, business_type, owner_name, email, is_active)
    VALUES (?, 'Suspended Corp', 'retail_general', 'Owner Susp', 'susp@test.com', 0)
  `).run(suspendedTenantId);

  // 2. Setup user accounts
  // User A (active user)
  const userARes = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, 'usera@test.com', 'hash', 'User A Original', 'staff', 'active', ?, 1, 0)
  `).run(`usera_${testSuffix}`, testTenantId);
  const userAId = userARes.lastInsertRowid;

  // User B (victim user)
  const userBRes = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, 'userb@test.com', 'hash', 'User B Target', 'staff', 'active', ?, 1, 0)
  `).run(`userb_${testSuffix}`, testTenantId);
  const userBId = userBRes.lastInsertRowid;

  // Deactivated user
  const userDeactRes = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, 'deact@test.com', 'hash', 'Deactivated User', 'staff', 'inactive', ?, 1, 0)
  `).run(`deact_${testSuffix}`, testTenantId);
  const userDeactId = userDeactRes.lastInsertRowid;

  // User belonging to suspended tenant
  const userSuspRes = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, 'suspuser@test.com', 'hash', 'Suspended Tenant User', 'staff', 'active', ?, 1, 0)
  `).run(`suspuser_${testSuffix}`, suspendedTenantId);
  const userSuspId = userSuspRes.lastInsertRowid;

  await t.test('1. Deactivated user token -> HTTP 401', async () => {
    const token = jwt.sign(
      { id: userDeactId, username: `deact_${testSuffix}`, role: 'staff', token_version: 1 },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 401, 'Deactivated user must receive HTTP 401');
    assert.strictEqual(res.body.success, false);
  });

  await t.test('2. Expired JWT token -> HTTP 401', async () => {
    // Generate token that expired 1 hour ago
    const expiredToken = jwt.sign(
      { id: userAId, username: `usera_${testSuffix}`, role: 'staff', token_version: 1, iat: Math.floor(Date.now() / 1000) - 7200 },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '-1h' }
    );

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${expiredToken}`);

    assert.strictEqual(res.status, 401, 'Expired token must receive HTTP 401');
    assert.strictEqual(res.body.success, false);
  });

  await t.test('3. JWT token without a token_version claim -> HTTP 401', async () => {
    // Generate token omitting token_version
    const legacyTokenNoVersion = jwt.sign(
      { id: userAId, username: `usera_${testSuffix}`, role: 'staff' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${legacyTokenNoVersion}`);

    assert.strictEqual(res.status, 401, 'Token without token_version must receive HTTP 401');
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('token version') || res.body.message.includes('invalid'), 'Message explains invalid token version');
  });

  await t.test('4. Suspended tenant -> HTTP 403 on tenant routes', async () => {
    const suspUserToken = jwt.sign(
      { id: userSuspId, username: `suspuser_${testSuffix}`, role: 'staff', token_version: 1 },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const testRoutes = [
      '/api/products',
      '/api/parties/customers',
      '/api/sales',
      '/api/expenses',
      '/api/purchases'
    ];

    for (const route of testRoutes) {
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${suspUserToken}`);

      assert.strictEqual(res.status, 403, `Suspended tenant user must receive 403 on ${route}`);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.toLowerCase().includes('suspended') || res.body.message.toLowerCase().includes('inactive'));
    }
  });

  await t.test('5. Token from User A with User B ID in body is strictly ignored and cannot mutate User B', async () => {
    const userAToken = jwt.sign(
      { id: userAId, username: `usera_${testSuffix}`, role: 'staff', token_version: 1 },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    // User A calls PUT /api/auth/profile passing User B's ID in the body
    const profileRes = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        id: userBId,
        user_id: userBId,
        full_name: 'Attacker Impersonation',
        email: 'attacker@evil.com'
      });

    assert.strictEqual(profileRes.status, 200);

    // Verify User B in database was completely untouched
    const userBInDb = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(userBId);
    assert.strictEqual(userBInDb.full_name, 'User B Target', 'User B profile name was not mutated');
    assert.strictEqual(userBInDb.email, 'userb@test.com', 'User B email was not mutated');

    // Verify User A was the only entity mutated
    const userAInDb = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(userAId);
    assert.strictEqual(userAInDb.full_name, 'Attacker Impersonation', 'User A was properly updated');

    // User A calls PATCH /api/me/preferences passing User B's ID
    const prefRes = await request(app)
      .patch('/api/me/preferences')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        id: userBId,
        user_id: userBId,
        theme: 'dark'
      });

    assert.strictEqual(prefRes.status, 200);

    // Verify User B's theme was not touched
    const userBTheme = db.prepare('SELECT theme FROM users WHERE id = ?').get(userBId).theme;
    assert.strictEqual(userBTheme, 'classic', 'User B theme was not modified by User A');
  });

  // Cleanup
  db.prepare('DELETE FROM users WHERE id IN (?, ?, ?, ?)').run(userAId, userBId, userDeactId, userSuspId);
  db.prepare('DELETE FROM tenants WHERE id IN (?, ?)').run(testTenantId, suspendedTenantId);
});
