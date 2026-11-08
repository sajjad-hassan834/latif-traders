process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

test('SKU INTEGRITY: Legacy codes (FRE-0001) remain untouched, searchable, and present in sales and exports', async (t) => {
  const now = Date.now();
  const tenantId = `t_sku_legacy_${now}`;

  // 1. Provision tenant
  await db.run(
    "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'Legacy SKU Mart', 'Owner', 'pro', 'frozen_food', 1)",
    [tenantId]
  );

  // Create admin user for this tenant
  const passwordHash = bcrypt.hashSync('testpass123', 8);
  const userRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, ?, ?, 'Legacy Admin', 'admin', 'active', ?, 1, 0)
  `, [`legacy_admin_${now}`, `legacy_${now}@test.com`, passwordHash, tenantId]);
  const userId = userRes.lastInsertRowid;

  const token = jwt.sign(
    { id: userId, username: `legacy_admin_${now}`, role: 'admin', tenant_id: tenantId, token_version: 1 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  // 2. Insert legacy product with FRE-0001
  const legacySku = 'FRE-0001';
  const legacyBarcode = '890123456789';
  const prodRes = await db.run(
    `INSERT INTO products (tenant_id, name, sku, barcode, purchase_price, sale_price, unit, min_stock_level, status)
     VALUES (?, 'Legacy Frozen Rolls', ?, ?, 150, 250, 'pkt', 5, 'active')`,
    [tenantId, legacySku, legacyBarcode]
  );
  const productId = prodRes.lastInsertRowid || prodRes.lastID;

  // Add stock batch
  await db.run(
    `INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, expiry_date, status)
     VALUES (?, ?, 'BATCH-LEGACY-01', 100, 150, 250, '2028-12-31', 'active')`,
    [tenantId, productId]
  );

  // Create customer
  const custRes = await db.run(
    "INSERT INTO customers (tenant_id, name, phone, current_balance) VALUES (?, 'Legacy Customer', '03001234567', 0)",
    [tenantId]
  );
  const customerId = custRes.lastInsertRowid;

  await t.test('1. Legacy product code is preserved exactly and not modified', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    const products = res.body.products || res.body.data;
    assert.ok(Array.isArray(products), 'Products list must be returned');
    const item = products.find(p => p.id === productId);
    assert.ok(item, 'Legacy product must exist in list');
    assert.equal(item.sku, legacySku, 'SKU must match FRE-0001');
    assert.equal(item.barcode, legacyBarcode, 'Barcode must match 890123456789');
  });

  await t.test('2. Searching by legacy SKU returns the product', async () => {
    const res = await request(app)
      .get(`/api/products?search=${legacySku}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    const products = res.body.products || res.body.data;
    assert.ok(Array.isArray(products), 'Products list must be returned');
    const match = products.find(p => p.sku === legacySku);
    assert.ok(match, 'Search by FRE-0001 must return the product');
  });

  let saleId;
  await t.test('3. POS sale creates invoice preserving legacy SKU in line items', async () => {
    const salePayload = {
      customer_id: customerId,
      payment_method: 'Cash',
      paid_amount: 500,
      discount: 0,
      notes: 'Legacy SKU test sale',
      items: [
        {
          product_id: productId,
          quantity: 2,
          unit_price: 250,
          total_price: 500
        }
      ]
    };

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send(salePayload);

    if (res.status !== 201) console.log('Sale error:', res.status, res.body);
    assert.equal(res.status, 201, 'POS sale creation must succeed');
    saleId = res.body.sale?.id || res.body.data?.id;
    assert.ok(saleId, 'Sale ID must be returned');
  });

  await t.test('4. Fetching sale receipt displays legacy SKU in line items', async () => {
    const res = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    const items = res.body.items || res.body.data?.items || res.body.sale?.items;
    assert.ok(items && items.length > 0, 'Line items must be present');
    const lineItem = items[0];
    assert.equal(lineItem.sku, legacySku, 'Line item must preserve legacy SKU FRE-0001');
  });

  await t.test('5. CSV export representation formats legacy SKU cleanly', async () => {
    // Simulate the exportToCSV logic used in Inventory.jsx
    const productsRes = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);
    const products = productsRes.body.products || productsRes.body.data;
    const target = products.find(p => p.id === productId);

    const csvRow = [
      `"${target.name}"`,
      `"${target.sku}"`,
      `"${target.barcode}"`,
      target.sale_price,
      target.purchase_price
    ].join(',');

    assert.ok(csvRow.includes(`"${legacySku}"`), 'CSV row must include "FRE-0001"');
    assert.ok(csvRow.includes(`"${legacyBarcode}"`), 'CSV row must include "890123456789"');
  });
});
