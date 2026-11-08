const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { db } = require(path.resolve('server/config/database'));
const { JWT_SECRET } = require(path.resolve('server/middleware/auth'));

// Import routers
const authRouter = require(path.resolve('server/routes/auth'));
const paymentsRouter = require(path.resolve('server/routes/payments'));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/payments', paymentsRouter);
  return app;
}

test('Manager Override & Cash Drawer Shift Flow Tests', async (t) => {
  const app = createTestApp();
  const testTenant = `t_shift_${Date.now()}`;
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  // Setup Tenant with is_active = 1
  await db.run(
    'INSERT INTO tenants (id, business_name, business_type, plan, is_active) VALUES (?, ?, ?, ?, 1)',
    [testTenant, 'Shift Test Mart', 'retail_general', 'pro']
  );

  // Setup Admin user
  const adminRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version)
    VALUES (?, ?, ?, ?, 'admin', 'active', ?, 1)
  `, [`mgr_${Date.now()}`, `mgr_${Date.now()}@test.com`, passwordHash, 'Test Manager', testTenant]);
  const adminId = adminRes.lastInsertRowid;
  const adminUser = await db.get('SELECT * FROM users WHERE id = ?', [adminId]);

  // Setup Sales Cashier user
  const cashierRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version)
    VALUES (?, ?, ?, ?, 'sales', 'active', ?, 1)
  `, [`cash_${Date.now()}`, `cash_${Date.now()}@test.com`, passwordHash, 'Test Cashier', testTenant]);
  const cashierId = cashierRes.lastInsertRowid;
  const cashierUser = await db.get('SELECT * FROM users WHERE id = ?', [cashierId]);

  const cashierToken = jwt.sign(
    { id: cashierUser.id, username: cashierUser.username, role: cashierUser.role, tenant_id: testTenant, token_version: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  await t.test('1. Manager Override fails with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/manager-override')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        managerUsername: adminUser.username,
        managerPassword: 'WrongPassword',
        action: 'VOID_CART'
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  await t.test('2. Manager Override succeeds with valid manager credentials', async () => {
    const res = await request(app)
      .post('/api/auth/manager-override')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        managerUsername: adminUser.username,
        managerPassword: 'Admin@123',
        action: 'VOID_CART',
        reason: 'Customer cancelled basket'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.overrideToken);
    assert.equal(res.body.authorizedBy, adminUser.full_name);
  });

  await t.test('3. Cashier opens a shift drawer with opening cash float', async () => {
    const res = await request(app)
      .post('/api/payments/shift/open')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        opening_cash: 2500,
        notes: 'Morning shift opening float'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.session.opening_cash, 2500);
    assert.equal(res.body.session.status, 'open');
  });

  await t.test('4. Cashier closes shift with blind cash count and calculates variance', async () => {
    const res = await request(app)
      .post('/api/payments/shift/close')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        counted_cash: 2500, // Matches opening cash, 0 sales made, variance = 0
        denominations: { 1000: '2', 500: '1' },
        notes: 'Balanced drawer'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.variance, 0);
    assert.equal(res.body.countedCash, 2500);
    assert.equal(res.body.expectedCash, 2500);
    assert.equal(res.body.session.status, 'closed');
  });

  await t.test('5. Verify shift ledger list for reporting', async () => {
    const adminToken = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: adminUser.role, tenant_id: testTenant, token_version: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/payments/shifts')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.sessions));
    assert.ok(res.body.sessions.length >= 1);
  });
});
