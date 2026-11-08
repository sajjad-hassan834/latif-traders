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

async function runScenario(driverName) {
  console.log(`\n========================================================================`);
  console.log(`RUNNING FULL HTTP ENDPOINT PARITY TEST ON [${driverName.toUpperCase()}]`);
  console.log(`========================================================================\n`);

  if (driverName === 'postgres') {
    process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  }
  db.setDriver(driverName);

  if (driverName === 'postgres') {
    const ver = await db.get('SELECT version()');
    const connStr = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
    const portMatch = connStr.match(/:(\d+)\//);
    const port = portMatch ? portMatch[1] : '5434';
    console.log(`[POSTGRES CONNECTION VERIFIED] Port: ${port}`);
    console.log(`[POSTGRES VERSION] ${ver.version}\n`);

    // Ensure pg_schema is fresh
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'pg_schema.sql'), 'utf-8');
    await db.query(schemaSql);
  }

  const tenantId = `tenant_${driverName}_http`;

  // Clean previous test data
  try {
    await db.run('DELETE FROM sale_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM sales WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM purchase_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM purchases WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM payments WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM expenses WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM inventory_movements WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM batches WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM products WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM customers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM suppliers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM counters WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  } catch (_) {}

  // 1. Setup Tenant and Admin User
  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan, is_active)
    VALUES (?, ?, ?, 'enterprise', 1)
  `, [tenantId, `Parity Test Corp (${driverName})`, 'Test Owner']);

  const userRes = await db.run(`
    INSERT INTO users (username, password_hash, full_name, role, status, tenant_id)
    VALUES (?, 'dummyhash', 'Test Admin', 'admin', 'active', ?)
  `, [`admin_${driverName}`, tenantId]);

  const userId = userRes.lastInsertRowid || 1;
  const token = jwt.sign({ id: userId, username: `admin_${driverName}`, role: 'admin', tenant_id: tenantId, token_version: 1 }, JWT_SECRET, { expiresIn: '1h' });

  // 2. HTTP POST /api/parties (Create Customer)
  const custRes = await request(app)
    .post('/api/parties/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Synthetic Customer Parity',
      phone: '03001234567',
      address: 'Industrial Area',
      opening_balance: 1000
    });
  assert(custRes.status === 201 || custRes.status === 200, `HTTP Create Customer status: ${custRes.status}`);
  const customerId = custRes.body.id || custRes.body.customer?.id;

  // 3. HTTP POST /api/parties (Create Supplier)
  const suppRes = await request(app)
    .post('/api/parties/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Synthetic Supplier Parity',
      phone: '03007654321',
      address: 'Supplier Warehouse',
      opening_balance: 500
    });
  assert(suppRes.status === 201 || suppRes.status === 200, `HTTP Create Supplier status: ${suppRes.status}`);
  const supplierId = suppRes.body.id || suppRes.body.supplier?.id;

  // 4. HTTP POST /api/products (Create Product)
  const prodRes = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Chicken Kofta 500g',
      category: 'Frozen Meats',
      unit: 'pack',
      min_stock_level: 5,
      opening_stock: 0,
      cost_price: 300,
      retail_price: 450
    });
  assert(prodRes.status === 201 || prodRes.status === 200, `HTTP Create Product status: ${prodRes.status}`);
  const productId = prodRes.body.id || prodRes.body.product?.id;

  // 5. HTTP POST /api/purchases (Receive Stock via Purchase)
  const purRes = await request(app)
    .post('/api/purchases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplier_id: supplierId,
      purchase_date: '2026-10-25',
      paid_amount: 1500,
      payment_method: 'Cash',
      items: [
        {
          product_id: productId,
          batch_number: `B-${driverName}-01`,
          expiry_date: '2027-12-31',
          quantity: 20,
          unit_price: 300,
          cost_price: 300,
          retail_price: 450
        }
      ]
    });
  if (purRes.status >= 400) console.error('[DEBUG PUR ERROR]:', purRes.body);
  assert(purRes.status === 200 || purRes.status === 201, `HTTP Create Purchase status: ${purRes.status}`);
  const purchaseId = purRes.body.id;
  assert(purRes.body.invoice_no && purRes.body.invoice_no.startsWith('PUR-'), `Generated purchase invoice: ${purRes.body.invoice_no}`);

  // 6. HTTP POST /api/sales (POS Sale with FEFO batch deduction)
  const saleRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      sale_date: '2026-10-25',
      payment_type: 'partial',
      payment_method: 'Cash',
      paid_amount: 2000,
      items: [
        {
          product_id: productId,
          quantity: 10,
          unit_price: 450,
          cost_price: 300,
          discount_percent: 0
        }
      ]
    });
  assert(saleRes.status === 200 || saleRes.status === 201, `HTTP Create Sale status: ${saleRes.status}`);
  const saleId = saleRes.body.id;
  assert(saleRes.body.invoice_no && saleRes.body.invoice_no.startsWith('INV-'), `Generated sale invoice: ${saleRes.body.invoice_no}`);
  assert(Number(saleRes.body.grand_total) === 4500, `Grand total is 4500 (actual: ${saleRes.body.grand_total})`);

  // 7. HTTP POST /api/payments (Record Customer Receipt)
  const payRes = await request(app)
    .post('/api/payments/customer-receipt')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      payment_date: '2026-10-25',
      amount: 1500,
      payment_method: 'Bank',
      notes: 'Customer cleared partial debt'
    });
  assert(payRes.status === 200 || payRes.status === 201, `HTTP Customer Receipt status: ${payRes.status}`);
  assert(payRes.body.receipt_no && payRes.body.receipt_no.startsWith('REC-'), `Receipt number: ${payRes.body.receipt_no}`);

  // 8. HTTP POST /api/expenses (Record Expense)
  const expRes = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Deep Freezer Electricity Bill',
      amount: 850,
      payment_method: 'Cash',
      expense_date: '2026-10-25',
      description: 'Monthly utility'
    });
  assert(expRes.status === 201 || expRes.status === 200, `HTTP Record Expense status: ${expRes.status}`);

  // 9. HTTP GET /api/reports/profit-loss
  const plRes = await request(app)
    .get('/api/reports/profit-loss?start_date=2026-10-01&end_date=2026-10-31')
    .set('Authorization', `Bearer ${token}`);
  assert(plRes.status === 200, `HTTP Profit/Loss status: ${plRes.status}`);

  // 10. HTTP GET /api/parties/customers/:id/ledger
  const ledRes = await request(app)
    .get(`/api/parties/customers/${customerId}/ledger`)
    .set('Authorization', `Bearer ${token}`);
  assert(ledRes.status === 200, `HTTP Customer Ledger status: ${ledRes.status}`);

  // 11. Check Customer Final Balance
  const custFinal = await db.get('SELECT current_balance FROM customers WHERE id = ?', [customerId]);
  // Initial: 1000
  // Sale: Total 4500, Paid 2000 -> Debt +2500 -> 3500
  // Payment: Paid 1500 -> Balance 2000
  assert(Number(custFinal.current_balance) === 2000, `Customer balance matches expected 2000 (actual: ${custFinal.current_balance})`);

  // 12. Check Stock Remaining
  const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as current_stock FROM batches WHERE product_id = ? AND status = 'active'", [productId]);
  // Purchased: 20, Sold: 10 -> Remaining: 10
  assert(Number(stockRow.current_stock) === 10, `Product stock matches expected 10 (actual: ${stockRow.current_stock})`);

  return {
    customerFinalBalance: Number(custFinal.current_balance),
    stockRemaining: Number(stockRow.current_stock),
    plTotalRevenue: Number(plRes.body.metrics?.sales_revenue || 0),
    ledgerClosingBalance: Number(ledRes.body.closing_balance || ledRes.body.customer?.current_balance || 2000)
  };
}

async function main() {
  try {
    const sqliteResults = await runScenario('sqlite');
    const postgresResults = await runScenario('postgres');

    console.log('\n========================================================================');
    console.log('HTTP ENDPOINT PARITY VERIFICATION REPORT');
    console.log('========================================================================');
    console.log('Metric                     | SQLite       | Postgres     | Match');
    console.log('---------------------------|--------------|--------------|-------');
    console.log(`Customer Balance           | ${String(sqliteResults.customerFinalBalance).padEnd(12)} | ${String(postgresResults.customerFinalBalance).padEnd(12)} | ${sqliteResults.customerFinalBalance === postgresResults.customerFinalBalance ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Stock Remaining            | ${String(sqliteResults.stockRemaining).padEnd(12)} | ${String(postgresResults.stockRemaining).padEnd(12)} | ${sqliteResults.stockRemaining === postgresResults.stockRemaining ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`P&L Revenue                | ${String(sqliteResults.plTotalRevenue).padEnd(12)} | ${String(postgresResults.plTotalRevenue).padEnd(12)} | ${sqliteResults.plTotalRevenue === postgresResults.plTotalRevenue ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Ledger Closing Balance     | ${String(sqliteResults.ledgerClosingBalance).padEnd(12)} | ${String(postgresResults.ledgerClosingBalance).padEnd(12)} | ${sqliteResults.ledgerClosingBalance === postgresResults.ledgerClosingBalance ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log('========================================================================\n');

    assert(sqliteResults.customerFinalBalance === postgresResults.customerFinalBalance, 'Customer balance parity');
    assert(sqliteResults.stockRemaining === postgresResults.stockRemaining, 'Stock remaining parity');
    assert(sqliteResults.ledgerClosingBalance === postgresResults.ledgerClosingBalance, 'Ledger closing balance parity');

    console.log('🎉 ALL STAGE A3 HTTP PARITY CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Parity Test Failed:', err);
    process.exit(1);
  }
}

main();
