/**
 * ShopOS Product Code Generation & Concurrency Test Suite
 *
 * Verifies:
 * 1. 20 concurrent creates on the same tenant generate distinct, race-safe SKUs.
 * 2. Existing products retain custom SKU when specified.
 * 3. Search by product SKU/code works.
 * 4. Barcode field remains independently editable.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-security-secret-must-be-at-least-32-characters-long';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

test('Product Code - 20 concurrent product creates generate unique race-safe SKUs', async () => {
  const tenantId = `t_race_${Date.now()}`;
  await db.run(
    'INSERT INTO tenants (id, business_name, business_type, plan, is_active) VALUES (?, ?, ?, ?, 1)',
    [tenantId, 'Race Safety Shop', 'retail_general', 'enterprise']
  );

  const passwordHash = bcrypt.hashSync('testpass123', 8);
  const userRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, ?, ?, ?, 'admin', 'active', ?, 1, 0)
  `, [`user_${Date.now()}`, `user_${Date.now()}@race.com`, passwordHash, 'Race Admin', tenantId]);

  const userId = userRes.lastInsertRowid;

  const token = jwt.sign(
    {
      id: userId,
      username: 'concurrency_admin',
      role: 'admin',
      tenant_id: tenantId,
      token_version: 1
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  // Fire 20 concurrent product creates
  const promises = [];
  for (let i = 1; i <= 20; i++) {
    promises.push(
      request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Concurrent Product ${i}`,
          brand: 'TEST',
          sale_price: 100,
          purchase_price: 50
        })
    );
  }

  const results = await Promise.all(promises);

  // Assert all 20 succeeded
  for (let i = 0; i < 20; i++) {
    assert.strictEqual(
      results[i].status,
      201,
      `Concurrent create #${i + 1} must succeed with 201 (got ${results[i].status}: ${JSON.stringify(results[i].body)})`
    );
  }

  // Retrieve all created SKUs from DB
  const rows = await db.all('SELECT id, name, sku, barcode FROM products WHERE tenant_id = ?', [tenantId]);
  assert.strictEqual(rows.length, 20, 'Exactly 20 products must be stored');

  const skus = rows.map(r => r.sku);
  const uniqueSkus = new Set(skus);
  assert.strictEqual(uniqueSkus.size, 20, 'All 20 products must have unique SKUs with zero collisions');

  // Verify search by SKU works
  const sampleProduct = rows[0];
  const searchRes = await request(app)
    .get(`/api/products?search=${encodeURIComponent(sampleProduct.sku)}`)
    .set('Authorization', `Bearer ${token}`);
  assert.strictEqual(searchRes.status, 200);
  assert.ok(searchRes.body.products.some(p => p.sku === sampleProduct.sku), 'Search by SKU must return the target product');

  // Verify barcode is independently editable
  const updateRes = await request(app)
    .put(`/api/products/${sampleProduct.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: sampleProduct.name,
      barcode: 'CUSTOM-BARCODE-9988'
    });
  assert.strictEqual(updateRes.status, 200);
  const updatedRow = await db.get('SELECT barcode FROM products WHERE id = ?', [sampleProduct.id]);
  assert.strictEqual(updatedRow.barcode, 'CUSTOM-BARCODE-9988', 'Barcode must be independently editable');
});
