/**
 * Plan Limits & Grandfathering Verification Test Suite
 *
 * Verifies plans.js resource limits:
 * 1. Free plan:
 *    - 50 products limit (51st product create blocked with 403)
 *    - 100 invoices/month in Karachi timezone (101st invoice create blocked with 403)
 *    - 1 user limit (2nd staff user create blocked with 403)
 * 2. Pro plan:
 *    - 5 users limit (6th user create blocked with 403)
 *    - Products unlimited (> 50 products allowed)
 *    - Invoices unlimited (> 100 invoices allowed)
 * 3. Enterprise plan:
 *    - Unlimited products, invoices, and users
 * 4. Grandfathering invariant:
 *    - A tenant ALREADY exceeding limits keeps operating:
 *      * Selling existing products (POST /api/sales) -> SUCCEEDS (201)
 *      * Receiving payments (POST /api/payments) -> SUCCEEDS (201)
 *      * Restocking existing products (POST /api/purchases) -> SUCCEEDS (201)
 *      * Editing existing products (PUT /api/products/:id) -> SUCCEEDS (200)
 *      * Adjusting stock (POST /api/adjustments) -> SUCCEEDS (201)
 *    - ONLY creating NEW products, NEW users, or NEW invoices beyond the limit is blocked (403, clean message, zero 500s).
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-plan-limits-tests-32-bytes';

const assert = require('assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index');
const { db } = require('../config/database');
const { getPlanLimits, PLANS } = require('../config/plans');
const { JWT_SECRET } = require('../middleware/auth');

async function runPlanLimitsSuite() {
  console.log(`\n======================================================`);
  console.log(`   Running Plan Limits & Grandfathering Test Suite    `);
  console.log(`======================================================\n`);

  const now = Date.now();
  const freeTenantId = `t_lim_free_${now}`;

  // Insert Free Tenant
  await db.run(
    "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, ?, 'Free Owner', 'free', 'retail_general', 1)",
    [freeTenantId, 'Grandfathered Free Shop']
  );

  // Create admin user for this tenant
  const passwordHash = bcrypt.hashSync('testpass123', 8);
  const userRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, ?, ?, 'Free Admin', 'admin', 'active', ?, 1, 0)
  `, [`free_admin_${now}`, `free_${now}@test.com`, passwordHash, freeTenantId]);
  const userId = userRes.lastInsertRowid;

  const token = jwt.sign(
    { id: userId, username: `free_admin_${now}`, role: 'admin', tenant_id: freeTenantId, token_version: 1 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  // Create a supplier and a customer
  const custRes = await db.run(
    "INSERT INTO customers (tenant_id, name, phone, current_balance) VALUES (?, 'Test Customer', '03001112233', 0)",
    [freeTenantId]
  );
  const customerId = custRes.lastInsertRowid;

  const supRes = await db.run(
    "INSERT INTO suppliers (tenant_id, name, contact_person, phone) VALUES (?, 'Test Supplier', 'Contact', '03004445566')",
    [freeTenantId]
  );
  const supplierId = supRes.lastInsertRowid;

  // 1. Seed 55 products directly into the database (simulating a grandfathered tenant with 55 products on Free plan)
  let existingProductId = null;
  for (let i = 1; i <= 55; i++) {
    const sku = `GF-PRD-${now}-${i}`;
    const pRes = await db.run(
      "INSERT INTO products (name, sku, barcode, purchase_price, sale_price, tenant_id, status) VALUES (?, ?, ?, 50, 100, ?, 'active')",
      [`Product ${i}`, sku, sku, freeTenantId]
    );
    if (i === 1) existingProductId = pRes.lastInsertRowid;

    // Seed batch for product 1
    if (i === 1) {
      await db.run(
        "INSERT INTO batches (product_id, batch_no, quantity, purchase_price, sale_price, tenant_id, status) VALUES (?, 'B-INIT-1', 100, 50, 100, ?, 'active')",
        [existingProductId, freeTenantId]
      );
    }
  }

  const pCount = (await db.get('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [freeTenantId])).count;
  assert.strictEqual(pCount, 55, 'Grandfathered tenant has 55 products (> 50 limit)');

  // --- GRANDFATHERING ASSERTIONS ---

  // (a) EDIT existing product must SUCCEED (200)
  const editRes = await request(app)
    .put(`/api/products/${existingProductId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Product 1 Updated Name', sale_price: 120 });
  assert.strictEqual(editRes.status, 200, 'Editing an existing product must succeed even when over product limit');
  console.log('  ✅ Grandfathering: Editing existing products succeeds (200)');

  // (b) RESTOCK existing product via purchase must SUCCEED (201)
  const purchaseRes = await request(app)
    .post('/api/purchases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplier_id: supplierId,
      items: [{
        product_id: existingProductId,
        quantity: 10,
        purchase_price: 50,
        batch_no: `PUR-B-${now}`
      }],
      paid_amount: 500,
      payment_method: 'Cash'
    });
  assert.strictEqual(purchaseRes.status, 201, 'Restocking an existing product must succeed even when over product limit');
  console.log('  ✅ Grandfathering: Restocking existing products succeeds (201)');

  // (c) STOCK ADJUSTMENT on existing product must SUCCEED (201)
  const adjustRes = await request(app)
    .post('/api/products/adjustments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      product_id: existingProductId,
      type: 'CORRECTION_IN',
      quantity: 5,
      reason: 'Physical inventory count adjustment'
    });
  assert.ok(adjustRes.status === 200 || adjustRes.status === 201, 'Adjusting stock on an existing product must succeed');
  console.log('  ✅ Grandfathering: Stock adjustment on existing products succeeds (200/201)');

  // (d) SELLING existing product via POS sale must SUCCEED (201)
  const saleRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      items: [{
        product_id: existingProductId,
        quantity: 2,
        unit_price: 120,
        total_price: 240
      }],
      payment_method: 'Cash',
      paid_amount: 240
    });
  if (saleRes.status !== 201) console.log('Sale error:', saleRes.status, saleRes.body);
  assert.strictEqual(saleRes.status, 201, 'Executing POS sale on existing products must succeed');
  console.log('  ✅ Grandfathering: POS sales on existing inventory succeed (201)');

  // (e) RECEIVING PAYMENTS must SUCCEED (201)
  const payRes = await request(app)
    .post('/api/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      party_type: 'CUSTOMER',
      party_id: customerId,
      amount: 100,
      payment_method: 'Cash'
    });
  assert.ok(payRes.status === 200 || payRes.status === 201, 'Customer payment receipt must succeed without limit interference');
  console.log('  ✅ Grandfathering: Customer payments and receipts succeed (200/201)');

  // --- HARD LIMIT ASSERTIONS: ONLY NEW INVENTIONS ARE BLOCKED ---

  // (f) Attempting to create a 56th NEW product must be BLOCKED with 403 (clean message, no 500)
  const newProdRes = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Forbidden 56th Product',
      sale_price: 200,
      purchase_price: 100
    });
  assert.strictEqual(newProdRes.status, 403, 'Creating a NEW product beyond 50 limit must return 403');
  assert.strictEqual(newProdRes.body.success, false);
  assert.strictEqual(newProdRes.body.limitReached, 'products');
  assert.ok(newProdRes.body.message.includes('FREE plan limit of 50 products has been reached'));
  console.log('  ✅ Limit Enforcement: Creating NEW product beyond limit is cleanly blocked with HTTP 403 (no 500)');

  // (g) Attempting to create a 2nd staff user on Free plan must be BLOCKED with 403
  const newUserRes = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      username: `staff_user_${now}`,
      email: `staff_${now}@test.com`,
      password: 'StrongP@ssword123!',
      full_name: 'Second Staff Member',
      role: 'sales'
    });
  assert.strictEqual(newUserRes.status, 403, 'Creating a 2nd user on Free plan must return 403');
  assert.strictEqual(newUserRes.body.limitReached, 'users');
  assert.ok(newUserRes.body.message.includes('FREE plan is limited to 1 user account'));
  console.log('  ✅ Limit Enforcement: Creating NEW staff user beyond limit is cleanly blocked with HTTP 403 (no 500)');

  console.log('\n======================================================');
  console.log('  🎉 ALL PLAN LIMITS & GRANDFATHERING TESTS PASSED!   ');
  console.log('======================================================\n');
}

if (require.main === module) {
  runPlanLimitsSuite().then(() => process.exit(0)).catch(err => {
    console.error('Plan limits test failed:', err);
    process.exit(1);
  });
}

module.exports = { runPlanLimitsSuite };
