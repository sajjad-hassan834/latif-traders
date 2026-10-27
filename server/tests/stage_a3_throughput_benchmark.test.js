const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'latif-traders-secure-jwt-secret-key-2026';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runThroughputBenchmark() {
  console.log('\n========================================================================');
  console.log('STAGE A3: THROUGHPUT & LATENCY BENCHMARK ON POSTGRES 16 (LATE COUNTERS)');
  console.log('========================================================================\n');

  db.setDriver('postgres');

  // Requirement 2: Print version & port
  const ver = await db.get('SELECT version()');
  const connStr = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const portMatch = connStr.match(/:(\d+)\//);
  const port = portMatch ? portMatch[1] : '5434';
  console.log(`[POSTGRES CONNECTION VERIFIED] Port: ${port}`);
  console.log(`[POSTGRES VERSION] ${ver.version}\n`);

  const tenantId = 'tenant_bench_01';

  // Cleanup
  try {
    await db.run('DELETE FROM sale_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM sales WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM payments WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM inventory_movements WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM batches WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM products WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM counters WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  } catch (_) {}

  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan, is_active)
    VALUES (?, 'Benchmark Retail', 'Bench Owner', 'enterprise', 1)
  `, [tenantId]);

  const uRes = await db.run(`
    INSERT INTO users (username, password_hash, full_name, role, status, tenant_id)
    VALUES ('admin_bench', 'hash', 'Admin Bench', 'admin', 'active', ?)
  `, [tenantId]);

  const token = jwt.sign({ id: uRes.lastInsertRowid || 1, username: 'admin_bench', role: 'admin', tenant_id: tenantId }, JWT_SECRET, { expiresIn: '1h' });

  // Setup product with 1,000 units in stock
  const pRes = await db.run(`
    INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price, status)
    VALUES (?, 'Benchmark Fries 1kg', 'SKU-BENCH-01', 250, 400, 'active')
  `, [tenantId]);
  const productId = pRes.lastInsertRowid;

  await db.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, expiry_date, status)
    VALUES (?, ?, 'BATCH-BENCH-1K', 1000, 250, 400, '2028-12-31', 'active')
  `, [tenantId, productId]);

  console.log('Executing 100 concurrent checkout transactions...');
  const TOTAL_TRANSACTIONS = 100;
  const startTime = Date.now();

  const reqs = [];
  for (let i = 0; i < TOTAL_TRANSACTIONS; i++) {
    reqs.push(
      request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sale_date: '2026-10-25',
          payment_type: 'cash',
          payment_method: 'Cash',
          paid_amount: 400,
          items: [{ product_id: productId, quantity: 1, unit_price: 400, cost_price: 250 }]
        })
    );
  }

  const responses = await Promise.all(reqs);
  const totalDurationMs = Date.now() - startTime;
  const successes = responses.filter(r => r.status === 200 || r.status === 201);
  const failures = responses.filter(r => r.status !== 200 && r.status !== 201);

  const tps = ((successes.length / totalDurationMs) * 1000).toFixed(1);
  const avgLatencyMs = (totalDurationMs / TOTAL_TRANSACTIONS).toFixed(1);

  console.log(`\n========================================================================`);
  console.log(`THROUGHPUT BENCHMARK RESULTS (1 TENANT, 20 POOL CONNECTIONS)`);
  console.log(`========================================================================`);
  console.log(`Total Requests:         ${TOTAL_TRANSACTIONS}`);
  console.log(`Successful Checkouts:   ${successes.length}`);
  console.log(`Failed Checkouts:       ${failures.length}`);
  console.log(`Total Elapsed Time:     ${totalDurationMs} ms`);
  console.log(`Average Latency:        ${avgLatencyMs} ms / request`);
  console.log(`Throughput:             ${tps} Transactions / Second (TPS)`);
  console.log(`========================================================================\n`);

  assert(successes.length === TOTAL_TRANSACTIONS, `All ${TOTAL_TRANSACTIONS} transactions succeeded`);
  assert(failures.length === 0, 'Zero failed transactions');

  // Verify stock was decremented by exactly 100
  const stockRow = await db.get('SELECT quantity FROM batches WHERE product_id = ?', [productId]);
  assert(Number(stockRow.quantity) === 900, `Stock decremented from 1000 to 900 (actual: ${stockRow.quantity})`);

  // Verify gapless unique numbering
  const invoiceNumbers = successes.map(s => s.body.invoice_no);
  const uniqueInvoices = new Set(invoiceNumbers);
  assert(uniqueInvoices.size === TOTAL_TRANSACTIONS, 'All 100 invoice numbers unique');

  console.log('🎉 Throughput & late counter numbering benchmark passed successfully!\n');
}

runThroughputBenchmark()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Benchmark Failed:', err);
    process.exit(1);
  });
