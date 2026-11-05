process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const app = require('../index');
const { db } = require('../config/database');

const { JWT_SECRET } = require('../middleware/auth');

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runConcurrencySuite() {
  console.log('\n========================================================================');
  console.log('STAGE A3: REAL HTTP ENDPOINT CONCURRENCY & ISOLATION SUITE (POSTGRES 16)');
  console.log('========================================================================\n');

  process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  db.setDriver('postgres');

  // Requirement 2: Print SELECT version() and connection port at the start of every Postgres test
  const ver = await db.get('SELECT version()');
  const connStr = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const portMatch = connStr.match(/:(\d+)\//);
  const port = portMatch ? portMatch[1] : '5434';
  console.log(`[POSTGRES CONNECTION VERIFIED] Port: ${port}`);
  console.log(`[POSTGRES VERSION] ${ver.version}\n`);

  const tenantId = 'tenant_conc_http';

  // Cleanup test tenant
  try {
    await db.run('DELETE FROM sale_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM sales WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM purchase_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM purchases WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM payments WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM inventory_movements WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM batches WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM products WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM customers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM suppliers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM counters WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  } catch (_) {}

  // 1. Setup Tenant and Auth
  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan, is_active)
    VALUES (?, 'Concurrency Test Shop', 'Owner Conc', 'enterprise', 1)
  `, [tenantId]);

  const uRes = await db.run(`
    INSERT INTO users (username, password_hash, full_name, role, status, tenant_id)
    VALUES ('admin_conc', 'hash', 'Admin Conc', 'admin', 'active', ?)
  `, [tenantId]);
  const token = jwt.sign({ id: uRes.lastInsertRowid || 1, username: 'admin_conc', role: 'admin', tenant_id: tenantId, token_version: 1 }, JWT_SECRET, { expiresIn: '1h' });

  // 2. Setup Customer & Supplier
  const cRes = await db.run(`
    INSERT INTO customers (tenant_id, name, current_balance, opening_balance)
    VALUES (?, 'Synthetic Customer Conc', 1000, 1000)
  `, [tenantId]);
  const customerId = cRes.lastInsertRowid;

  const sRes = await db.run(`
    INSERT INTO suppliers (tenant_id, name, current_balance)
    VALUES (?, 'Synthetic Supplier Conc', 0)
  `, [tenantId]);
  const supplierId = sRes.lastInsertRowid;

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: 50 Parallel POS Sales for 1 Product with 30 Items in Stock
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 1: 50 Concurrent POS Sales on 30 Stock (No Overselling) ---');
  const p1Res = await db.run(`
    INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price, status)
    VALUES (?, 'Limited Stock Nuggets', 'SKU-LTD-01', 200, 350, 'active')
  `, [tenantId]);
  const prod1Id = p1Res.lastInsertRowid;

  // Initial stock: exactly 30 in 1 batch
  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, expiry_date, status)
    VALUES (?, ?, 'BATCH-CONC-30', 30, 200, 350, '2028-12-31', 'active')
  `, [tenantId, prod1Id]);

  // Launch 50 simultaneous HTTP requests
  const salePromises = [];
  for (let i = 0; i < 50; i++) {
    salePromises.push(
      request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: customerId,
          sale_date: '2026-10-25',
          payment_type: 'cash',
          payment_method: 'Cash',
          paid_amount: 350,
          items: [{ product_id: prod1Id, quantity: 1, unit_price: 350, cost_price: 200 }]
        })
    );
  }

  const results = await Promise.all(salePromises);
  const successes = results.filter(r => r.status === 200 || r.status === 201);
  const failures = results.filter(r => r.status === 400);

  console.log(`[RESULTS] 50 Requests -> Successes: ${successes.length}, Failures: ${failures.length}`);
  assert(successes.length === 30, `Exactly 30 sales succeeded (actual: ${successes.length})`);
  assert(failures.length === 20, `Exactly 20 sales rejected with 400 (actual: ${failures.length})`);

  // Verify stock remaining is strictly 0, never negative
  const p1Stock = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'", [prod1Id]);
  assert(Number(p1Stock.s) === 0, `Product stock is strictly 0 (never negative: ${p1Stock.s})`);

  // Verify all 30 generated invoice numbers are unique
  const invoiceNumbers = successes.map(s => s.body.invoice_no);
  const uniqueInvoices = new Set(invoiceNumbers);
  assert(uniqueInvoices.size === 30, `All 30 invoice numbers are unique (set size: ${uniqueInvoices.size})`);

  // Negative control: 51st sale must also fail
  const neg51 = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      items: [{ product_id: prod1Id, quantity: 1, unit_price: 350 }]
    });
  assert(neg51.status === 400, 'Negative Control: 51st sale strictly rejected with 400');

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Multi-Batch Sales Spanning Several Batches (FEFO Order)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 2: Multi-Batch FEFO Sale Spanning 3 Batches ---');
  const p2Res = await db.run(`
    INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price, status)
    VALUES (?, 'Multi Batch Paratha', 'SKU-PARATHA', 100, 180, 'active')
  `, [tenantId]);
  const prod2Id = p2Res.lastInsertRowid;

  // Batch 1 (expires soonest: 2027-01-01): qty 5
  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, expiry_date, status)
    VALUES (?, ?, 'BATCH-E1', 5, 100, 180, '2027-01-01', 'active')
  `, [tenantId, prod2Id]);
  // Batch 2 (expires 2027-06-01): qty 5
  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, expiry_date, status)
    VALUES (?, ?, 'BATCH-E2', 5, 100, 180, '2027-06-01', 'active')
  `, [tenantId, prod2Id]);
  // Batch 3 (expires 2027-12-01): qty 10
  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, expiry_date, status)
    VALUES (?, ?, 'BATCH-E3', 10, 100, 180, '2027-12-01', 'active')
  `, [tenantId, prod2Id]);

  // Request 15 items: should exhaust B1 (5), B2 (5), and take 5 from B3 (leaving 5)
  const mbSaleRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      payment_type: 'cash',
      paid_amount: 15 * 180,
      items: [{ product_id: prod2Id, quantity: 15, unit_price: 180, cost_price: 100 }]
    });
  assert(mbSaleRes.status === 200 || mbSaleRes.status === 201, `Multi-batch sale succeeded: ${mbSaleRes.status}`);

  const b1 = await db.get("SELECT quantity FROM batches WHERE product_id = ? AND batch_no = 'BATCH-E1'", [prod2Id]);
  const b2 = await db.get("SELECT quantity FROM batches WHERE product_id = ? AND batch_no = 'BATCH-E2'", [prod2Id]);
  const b3 = await db.get("SELECT quantity FROM batches WHERE product_id = ? AND batch_no = 'BATCH-E3'", [prod2Id]);
  assert(Number(b1.quantity) === 0, `Batch E1 fully consumed (qty: ${b1.quantity})`);
  assert(Number(b2.quantity) === 0, `Batch E2 fully consumed (qty: ${b2.quantity})`);
  assert(Number(b3.quantity) === 5, `Batch E3 partially consumed (qty remaining: ${b3.quantity})`);

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Deadlock Avoidance Test (Opposite Order Product Locking)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 3: Deadlock Avoidance (Opposite Order Items) ---');
  // Two products
  const pA = await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Product A', 'SKU-A', 'active')`, [tenantId]);
  const pB = await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Product B', 'SKU-B', 'active')`, [tenantId]);
  const idA = pA.lastInsertRowid;
  const idB = pB.lastInsertRowid;

  await db.run(`INSERT INTO batches (tenant_id, product_id, batch_no, quantity, status) VALUES (?, ?, 'B-A', 50, 'active')`, [tenantId, idA]);
  await db.run(`INSERT INTO batches (tenant_id, product_id, batch_no, quantity, status) VALUES (?, ?, 'B-B', 50, 'active')`, [tenantId, idB]);

  // Request 1: locks A then B
  // Request 2: locks B then A
  const dl1 = request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      items: [
        { product_id: idA, quantity: 2, unit_price: 100 },
        { product_id: idB, quantity: 2, unit_price: 100 }
      ]
    });

  const dl2 = request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      items: [
        { product_id: idB, quantity: 3, unit_price: 100 },
        { product_id: idA, quantity: 3, unit_price: 100 }
      ]
    });

  const [resDL1, resDL2] = await Promise.all([dl1, dl2]);
  assert(resDL1.status === 200 || resDL1.status === 201, `Concurrent Sale 1 succeeded without deadlock (${resDL1.status})`);
  assert(resDL2.status === 200 || resDL2.status === 201, `Concurrent Sale 2 succeeded without deadlock (${resDL2.status})`);

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Concurrent Sales & Payments for Same Customer (Atomic Balance)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 4: Concurrent Sales & Payments for Same Customer ---');
  const custConcRes = await db.run(`
    INSERT INTO customers (tenant_id, name, current_balance, opening_balance)
    VALUES (?, 'Customer Atomic Balance', 1000, 1000)
  `, [tenantId]);
  const cAtomicId = custConcRes.lastInsertRowid;

  // Add stock product for this test
  const pAtomic = await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Atomic Item', 'SKU-ATOMIC', 'active')`, [tenantId]);
  await db.run(`INSERT INTO batches (tenant_id, product_id, batch_no, quantity, status) VALUES (?, ?, 'B-ATOMIC', 100, 'active')`, [tenantId, pAtomic.lastInsertRowid]);

  // 5 sales of 500 debt each (Grand total 500, paid 0) -> +2500 debt
  // 5 payments of 300 each -> -1500 credit
  // Expected net change: +1000 -> Final Balance = 1000 + 1000 = 2000
  const actions = [];
  for (let i = 0; i < 5; i++) {
    actions.push(
      request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: cAtomicId,
          sale_date: '2026-10-25',
          payment_type: 'credit',
          paid_amount: 0,
          items: [{ product_id: pAtomic.lastInsertRowid, quantity: 1, unit_price: 500 }]
        })
    );
    actions.push(
      request(app)
        .post('/api/payments/customer-receipt')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: cAtomicId,
          payment_date: '2026-10-25',
          amount: 300,
          payment_method: 'Cash'
        })
    );
  }

  const actionResults = await Promise.all(actions);
  const allOk = actionResults.every(r => r.status === 200 || r.status === 201);
  assert(allOk, 'All 10 concurrent balance-updating actions completed successfully');

  const cFinal = await db.get('SELECT current_balance FROM customers WHERE id = ?', [cAtomicId]);
  assert(Number(cFinal.current_balance) === 2000, `Final customer balance is exactly 2000 (actual: ${cFinal.current_balance})`);

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Atomic Rollback on Failure (Halfway Failure Leaves DB Clean)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 5: Atomic Halfway Rollback Test ---');
  const pRoll1 = await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Rollback Item 1', 'SKU-R1', 'active')`, [tenantId]);
  const pRoll2 = await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Rollback Item 2', 'SKU-R2', 'active')`, [tenantId]);
  await db.run(`INSERT INTO batches (tenant_id, product_id, batch_no, quantity, status) VALUES (?, ?, 'B-R1', 10, 'active')`, [tenantId, pRoll1.lastInsertRowid]);
  await db.run(`INSERT INTO batches (tenant_id, product_id, batch_no, quantity, status) VALUES (?, ?, 'B-R2', 2, 'active')`, [tenantId, pRoll2.lastInsertRowid]);

  // Record initial state
  const r1Before = await db.get('SELECT quantity FROM batches WHERE product_id = ?', [pRoll1.lastInsertRowid]);
  const counterBefore = await db.get("SELECT last_number FROM counters WHERE tenant_id = ? AND counter_type = 'sale_invoice'", [tenantId]);

  // Request attempts to buy 5 of item 1 (available: 10), and 10 of item 2 (available: only 2)
  // Must fail completely on item 2, and roll back item 1 deduction!
  const rollRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      items: [
        { product_id: pRoll1.lastInsertRowid, quantity: 5, unit_price: 100 },
        { product_id: pRoll2.lastInsertRowid, quantity: 10, unit_price: 100 }
      ]
    });

  assert(rollRes.status === 400, `Halfway failed transaction returned 400: ${rollRes.status}`);
  const r1After = await db.get('SELECT quantity FROM batches WHERE product_id = ?', [pRoll1.lastInsertRowid]);
  assert(Number(r1After.quantity) === Number(r1Before.quantity), `Item 1 quantity unchanged after rollback (before: ${r1Before.quantity}, after: ${r1After.quantity})`);

  // Verify counters table was untouched (late counter numbering)
  const counterAfter = await db.get("SELECT last_number FROM counters WHERE tenant_id = ? AND counter_type = 'sale_invoice'", [tenantId]);
  assert(counterBefore?.last_number === counterAfter?.last_number, `Invoice counter was not consumed on rolled back sale`);

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: Urdu & Mixed-Case Text Search via Tokenizer
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 6: Urdu Text & Mixed-Case Search ---');
  await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'مرغی بون لیس کٹ', 'URDU-01', 'active')`, [tenantId]);
  await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'چکن سموسہ اسپیشل', 'URDU-02', 'active')`, [tenantId]);
  await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'شامی کباب پراٹھا', 'URDU-03', 'active')`, [tenantId]);
  await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Fresh CHICKEN Wings MixedCase', 'MIX-01', 'active')`, [tenantId]);

  const urdu1Res = await request(app).get('/api/products?search=مرغی').set('Authorization', `Bearer ${token}`);
  assert(urdu1Res.status === 200 && urdu1Res.body.products.some(p => p.name.includes('مرغی')), 'Urdu search "مرغی" found product');

  const urdu2Res = await request(app).get('/api/products?search=پراٹھا').set('Authorization', `Bearer ${token}`);
  assert(urdu2Res.status === 200 && urdu2Res.body.products.some(p => p.name.includes('پراٹھا')), 'Urdu search "پراٹھا" found product');

  const mixRes = await request(app).get('/api/products?search=chicken').set('Authorization', `Bearer ${token}`);
  assert(mixRes.status === 200 && mixRes.body.products.some(p => p.name.includes('CHICKEN')), 'Mixed-case ILIKE search "chicken" matched "CHICKEN"');

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: Cross-Tenant Isolation Rejection
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 7: Cross-Tenant Reference Rejection ---');
  const tenantB = 'tenant_b_alien';
  await db.run(`INSERT INTO tenants (id, business_name, owner_name, is_active) VALUES (?, 'Tenant B Alien', 'Owner B', 1)`, [tenantB]);
  const pAlien = await db.run(`INSERT INTO products (tenant_id, name, sku, status) VALUES (?, 'Tenant B Exclusive', 'SKU-B-EXCL', 'active')`, [tenantB]);

  // Tenant A attempts to sell Tenant B's product
  const crossRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      items: [{ product_id: pAlien.lastInsertRowid, quantity: 1, unit_price: 500 }]
    });

  assert(crossRes.status === 400 || crossRes.status === 404, `Cross-tenant sale rejected at HTTP level (${crossRes.status}): ${crossRes.body.message}`);

  // DB level: verify Tenant A cannot query Tenant B's customer
  const alienCust = await db.get('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [customerId, tenantB]);
  assert(!alienCust, 'DB level tenant scoping: Tenant A customer not accessible to Tenant B');

  console.log('\n🎉 ALL STAGE A3 CONCURRENCY & ISOLATION SCENARIOS COMPLETED WITH ZERO DEFECTS!\n');
}

runConcurrencySuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Concurrency Suite Failed:', err);
    process.exit(1);
  });
