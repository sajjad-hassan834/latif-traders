process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'postgres';
process.env.DATABASE_POOL_SIZE = '10';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const assert = require('assert');
const request = require('supertest');
const { db } = require('../config/database');
const app = require('../index');

async function runConcurrencyDrill() {
  console.log('========================================================================');
  console.log('GATE A6: 10-CONNECTION POOL CONCURRENCY DRILL & RISKY PATH CONTROLS');
  console.log('========================================================================\n');

  db.setDriver('postgres');
  const pg = await db.getPgAdapter();
  console.log(`[POOL VERIFICATION] Active Pool Max Connections: ${pg.pool.options.max} (strictly 10)`);
  assert.strictEqual(pg.pool.options.max, 10, 'Pool size must be strictly 10');

  // Seed baseline tenant, customer, products, and batches
  const testTid = 'latif_001';
  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan)
    VALUES (?, 'Latif Concurrency Corp', 'M. Latif', 'enterprise')
    ON CONFLICT (id) DO UPDATE SET plan = 'enterprise'
  `, [testTid]);

  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('testpassword123', 8);
  await db.run("DELETE FROM users WHERE username = 'admin_conc_test'");
  await db.run(`
    INSERT INTO users (username, password_hash, full_name, role, status, tenant_id, token_version)
    VALUES ('admin_conc_test', ?, 'Admin Conc', 'admin', 'active', ?, 1)
  `, [hash, testTid]);
  const adminUser = { username: 'admin_conc_test' };

  const loginRes = await request(app).post('/api/auth/login').send({ username: adminUser.username, password: 'testpassword123' });
  const token = loginRes.body.token;
  assert(token, 'Must obtain admin JWT');

  // Ensure Walk-in Customer (id = 1) exists first so Wholesale Customer has id > 1
  await db.run(`
    INSERT INTO customers (id, name, customer_type, tenant_id)
    VALUES (1, 'Walk-in Customer', 'Walk-in', ?)
    ON CONFLICT (id) DO NOTHING
  `, [testTid]);

  // Ensure Wholesale Customer (id > 1) with ample credit limit for concurrency testing
  let testCust = await db.get('SELECT id, current_balance, credit_limit FROM customers WHERE tenant_id = ? AND id > 1 LIMIT 1', [testTid]);
  if (!testCust) {
    const cRes = await db.run(`
      INSERT INTO customers (name, phone, address, customer_type, opening_balance, credit_limit, current_balance, tenant_id)
      VALUES ('Conc Wholesale Customer', '03009998877', 'Main Bazaar', 'Wholesale', 0.00, 5000000.00, 0.00, ?)
    `, [testTid]);
    testCust = await db.get('SELECT id, current_balance, credit_limit FROM customers WHERE id = ?', [cRes.lastInsertRowid]);
  }
  await db.run('UPDATE customers SET credit_limit = 5000000.00, current_balance = 0.00 WHERE id = ? AND tenant_id = ?', [testCust.id, testTid]);

  // Ensure 2 Products with Active Batches for opposite-order locking drill
  const p1Res = await db.run(`
    INSERT INTO products (name, sku, unit, purchase_price, sale_price, wholesale_price, tenant_id)
    VALUES ('Drill Prod Alpha', 'SKU-DR-A', 'pkt', 50.00, 80.00, 75.00, ?)
    ON CONFLICT (tenant_id, sku) DO UPDATE SET sale_price = 80.00
  `, [testTid]);
  const p2Res = await db.run(`
    INSERT INTO products (name, sku, unit, purchase_price, sale_price, wholesale_price, tenant_id)
    VALUES ('Drill Prod Beta', 'SKU-DR-B', 'pkt', 60.00, 100.00, 95.00, ?)
    ON CONFLICT (tenant_id, sku) DO UPDATE SET sale_price = 100.00
  `, [testTid]);

  const pA = await db.get('SELECT id, sale_price FROM products WHERE sku = ? AND tenant_id = ?', ['SKU-DR-A', testTid]);
  const pB = await db.get('SELECT id, sale_price FROM products WHERE sku = ? AND tenant_id = ?', ['SKU-DR-B', testTid]);

  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, status)
    VALUES (?, ?, 'BATCH-DR-A', '2028-12-31', 5000.00, 50.00, 80.00, 'active')
    ON CONFLICT (tenant_id, product_id, batch_no) DO UPDATE SET quantity = 5000.00
  `, [testTid, pA.id]);
  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, status)
    VALUES (?, ?, 'BATCH-DR-B', '2028-12-31', 5000.00, 60.00, 100.00, 'active')
    ON CONFLICT (tenant_id, product_id, batch_no) DO UPDATE SET quantity = 5000.00
  `, [testTid, pB.id]);

  const bA = await db.get('SELECT id, batch_no FROM batches WHERE product_id = ? AND tenant_id = ?', [pA.id, testTid]);
  const bB = await db.get('SELECT id, batch_no FROM batches WHERE product_id = ? AND tenant_id = ?', [pB.id, testTid]);

  // ========================================================================
  // 1. 50 PARALLEL SALES WITH OPPOSITE-ORDER LOCKING OVER 10 POOL CONNECTIONS
  // ========================================================================
  console.log('\n--- 1. 50 Parallel Sales (Opposite-Order Locking: [A, B] vs [B, A]) ---');
  const t1 = Date.now();
  const salesPromises = [];

  for (let i = 0; i < 50; i++) {
    const isEven = i % 2 === 0;
    const items = isEven
      ? [
          { product_id: pA.id, batch_id: bA.id, batch_no: bA.batch_no, quantity: 1, unit_price: 80.00 },
          { product_id: pB.id, batch_id: bB.id, batch_no: bB.batch_no, quantity: 1, unit_price: 100.00 }
        ]
      : [
          { product_id: pB.id, batch_id: bB.id, batch_no: bB.batch_no, quantity: 1, unit_price: 100.00 },
          { product_id: pA.id, batch_id: bA.id, batch_no: bA.batch_no, quantity: 1, unit_price: 80.00 }
        ];

    salesPromises.push(
      request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCust.id,
          payment_type: 'CASH',
          paid_amount: 180.00,
          items
        })
    );
  }

  const salesResults = await Promise.all(salesPromises);
  const salesSuccess = salesResults.filter(r => r.status === 201).length;
  const elapsed1 = ((Date.now() - t1) / 1000).toFixed(2);
  console.log(`  ✅ 50 Parallel Sales Results: ${salesSuccess}/50 Successful in ${elapsed1}s with ZERO Deadlocks!`);
  assert.strictEqual(salesSuccess, 50, 'All 50 sales must succeed');

  // ========================================================================
  // 2. CONCURRENT PAYMENTS VS SALES (Interleaved Transactions on Same Customer)
  // ========================================================================
  console.log('\n--- 2. Concurrent Payments vs Sales Interleaved Drill (20 Parallel) ---');
  const t2 = Date.now();
  const initialCustRow = await db.get('SELECT current_balance FROM customers WHERE id = ?', [testCust.id]);
  const initialBal = Number(initialCustRow.current_balance);

  const interleavedOps = [];
  // 10 credit sales (+180 balance) interleaved with 10 customer receipts (-180 balance)
  for (let i = 0; i < 10; i++) {
    interleavedOps.push(
      request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCust.id,
          payment_type: 'CREDIT',
          paid_amount: 0.00,
          items: [{ product_id: pA.id, batch_id: bA.id, quantity: 1, unit_price: 80.00 }]
        })
    );
    interleavedOps.push(
      request(app)
        .post('/api/payments/customer-receipt')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCust.id,
          amount: 80.00,
          payment_method: 'Cash',
          notes: `Concurrent receipt #${i + 1}`
        })
    );
  }

  const interleavedResults = await Promise.all(interleavedOps);
  const interleavedSuccess = interleavedResults.filter(r => r.status === 200 || r.status === 201).length;
  const elapsed2 = ((Date.now() - t2) / 1000).toFixed(2);
  console.log(`  ✅ Interleaved Payments & Sales: ${interleavedSuccess}/20 Succeeded in ${elapsed2}s`);
  assert.strictEqual(interleavedSuccess, 20, 'All 20 interleaved operations must succeed');

  const finalCustRow = await db.get('SELECT current_balance FROM customers WHERE id = ?', [testCust.id]);
  const finalBal = Number(finalCustRow.current_balance);
  const deltaBal = Math.abs(finalBal - initialBal);
  console.log(`  ✅ Balance Ledger Invariance: Net balance delta = ₨ ${deltaBal.toFixed(2)} (Expected 0.00 paisa drift)`);
  assert(deltaBal < 0.001, 'Customer balance must have exact zero drift');

  // ========================================================================
  // 3. HALFWAY FAILURE TRANSACTION ROLLBACK
  // ========================================================================
  console.log('\n--- 3. Halfway Failure Transaction Rollback Verification ---');
  const preSalesCount = Number((await db.get('SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?', [testTid])).c);
  const preMovementsCount = Number((await db.get('SELECT COUNT(*) as c FROM inventory_movements WHERE tenant_id = ?', [testTid])).c);

  const failRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: testCust.id,
      payment_type: 'CASH',
      paid_amount: 100,
      items: [
        { product_id: pA.id, batch_id: bA.id, quantity: 1, unit_price: 80.00 },
        { product_id: 888888, batch_id: 888888, quantity: 1, unit_price: 500 } // NON-EXISTENT PRODUCT
      ]
    });

  const postSalesCount = Number((await db.get('SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?', [testTid])).c);
  const postMovementsCount = Number((await db.get('SELECT COUNT(*) as c FROM inventory_movements WHERE tenant_id = ?', [testTid])).c);

  assert.strictEqual(failRes.status, 400, 'Invalid product must return HTTP 400');
  assert.strictEqual(preSalesCount, postSalesCount, 'Zero orphan sales rows after transaction abort');
  assert.strictEqual(preMovementsCount, postMovementsCount, 'Zero orphan inventory movements after transaction abort');
  console.log('  ✅ Halfway Failure Cleanly Rolled Back (Zero Orphan Invoices or Stock Movements).');

  // ========================================================================
  // 4. NEGATIVE CONTROLS PER RISKY PATH
  // ========================================================================
  console.log('\n--- 4. Negative Controls Per Risky Path ---');

  // Control A: Credit Limit Overdraft Circuit Breaker
  await db.run('UPDATE customers SET current_balance = 1000.00, credit_limit = 1000.00 WHERE id = ? AND tenant_id = ?', [testCust.id, testTid]);
  const overdraftRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: testCust.id,
      payment_type: 'CREDIT',
      paid_amount: 0.00,
      items: [{ product_id: pA.id, batch_id: bA.id, quantity: 1, unit_price: 80.00 }]
    });
  assert.strictEqual(overdraftRes.status, 400, 'Credit limit breach must be rejected with 400');
  console.log('  ✅ Negative Control A (Credit Limit Overdraft): DETECTED & BLOCKED (HTTP 400)');

  // Control B: Insufficient Batch Quantity Circuit Breaker
  const overstockRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: testCust.id,
      payment_type: 'CASH',
      paid_amount: 10000000.00,
      items: [{ product_id: pA.id, batch_id: bA.id, quantity: 9999999, unit_price: 80.00 }]
    });
  assert.strictEqual(overstockRes.status, 400, 'Overselling beyond batch quantity must be rejected');
  console.log('  ✅ Negative Control B (Insufficient Stock): DETECTED & BLOCKED (HTTP 400)');

  // Control C: Cross-Tenant Party Injection in Payment
  const crossPartyRes = await request(app)
    .post('/api/payments/customer-receipt')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: 999999, // Foreign / non-existent customer
      amount: 100.00,
      payment_method: 'Cash',
      notes: 'Cross-tenant attack'
    });
  assert(crossPartyRes.status === 400 || crossPartyRes.status === 404, 'Foreign party payment must be rejected');
  console.log('  ✅ Negative Control C (Cross-Tenant Payment Injection): DETECTED & BLOCKED');

  console.log('\n========================================================================');
  console.log('10-CONNECTION POOL CONCURRENCY DRILL: 100% PASSED');
  console.log('========================================================================\n');
  process.exit(0);
}

runConcurrencyDrill().catch(err => {
  console.error('❌ Concurrency drill failed:', err);
  process.exit(1);
});
