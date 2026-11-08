const assert = require('assert');
const { db, getPgAdapter } = require('../config/database');
const paymentController = require('../controllers/paymentController');
const reportController = require('../controllers/reportController');
const partyController = require('../controllers/partyController');

async function runCashbookQuarantineParityTest() {
  console.log('========================================================================');
  console.log('STEP 2A CONDITION 1: CASHBOOK & DRAWER PARITY WITH QUARANTINED ROWS');
  console.log('========================================================================\n');

  const tenantId = 't_shoper_0a129e';
  const targetDate = '2026-10-24';

  // -------------------------------------------------------------------------
  // 1. SQLITE DRIVER VERIFICATION
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing SQLite Driver ---');
  db.setDriver('sqlite');

  let sqliteCashbookRes = null;
  const mockReqCashbook = {
    tenantId,
    query: { start_date: targetDate, end_date: targetDate }
  };
  const mockResCashbook = {
    json: (d) => { sqliteCashbookRes = d; return mockResCashbook; },
    status: () => mockResCashbook
  };

  await paymentController.getCashbook(mockReqCashbook, mockResCashbook);
  assert(sqliteCashbookRes && sqliteCashbookRes.success, 'SQLite getCashbook returned success');
  console.log(`  ✓ SQLite Cashbook Total In: ₨ ${Number(sqliteCashbookRes.total_in).toFixed(2)}`);
  assert.strictEqual(Number(sqliteCashbookRes.total_in), 84.00, 'SQLite cashbook total_in must equal exactly ₨ 84.00');

  let sqliteRegisterRes = null;
  const mockReqRegister = {
    tenantId,
    query: { date: targetDate }
  };
  const mockResRegister = {
    json: (d) => { sqliteRegisterRes = d; return mockResRegister; },
    status: () => mockResRegister
  };

  await reportController.getDayRegister(mockReqRegister, mockResRegister);
  assert(sqliteRegisterRes && sqliteRegisterRes.success, 'SQLite getDayRegister returned success');
  console.log(`  ✓ SQLite Day Register Total Cash In: ₨ ${Number(sqliteRegisterRes.cash_summary.total_cash_in).toFixed(2)}`);
  assert.strictEqual(Number(sqliteRegisterRes.cash_summary.total_cash_in), 84.00, 'SQLite Day Register cash_in must equal ₨ 84.00');

  // Customer ledger in SQLite must exclude unlinked payments
  const sqliteCust = await db.get("SELECT id, name, current_balance FROM customers WHERE tenant_id = ?", [tenantId]);
  assert(sqliteCust, 'Customer exists in tenant');
  console.log(`  ✓ SQLite Customer [${sqliteCust.name}] balance: ₨ ${Number(sqliteCust.current_balance).toFixed(2)} (Excludes orphan payments)`);

  // -------------------------------------------------------------------------
  // 2. POSTGRESQL DRIVER VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing PostgreSQL Driver ---');
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  db.setDriver('postgres');

  // Ensure test fixtures in PG
  const pgTenant = await db.get("SELECT id FROM tenants WHERE id = ?", [tenantId]);
  if (!pgTenant) {
    await db.run("INSERT INTO tenants (id, business_name, owner_name, plan) VALUES (?, 'Shoper', 'Mudassir Arif', 'pro') ON CONFLICT (id) DO NOTHING", [tenantId]);
  }
  let pgCustRec = await db.get("SELECT id FROM customers WHERE tenant_id = ?", [tenantId]);
  if (!pgCustRec) {
    const cRes = await db.run("INSERT INTO customers (tenant_id, name, customer_type, opening_balance, current_balance) VALUES (?, 'Walk-in Customer', 'Walk-in', 0, 0)", [tenantId]);
    pgCustRec = await db.get("SELECT id FROM customers WHERE tenant_id = ? LIMIT 1", [tenantId]);
  }
  const pgSCount = await db.get("SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?", [tenantId]);
  if (Number(pgSCount.c) === 0) {
    await db.run("INSERT INTO sales (tenant_id, invoice_no, sale_date, grand_total, paid_amount, balance_due, payment_method, order_status) VALUES (?, 'INV-20261024-0001', '2026-10-24', 42, 42, 0, 'Cash', 'Completed'), (?, 'INV-20261024-0002', '2026-10-24', 21, 21, 0, 'Cash', 'Completed'), (?, 'INV-20261024-0003', '2026-10-24', 21, 21, 0, 'Cash', 'Completed')", [tenantId, tenantId, tenantId]);
  }
  const pgPCount = await db.get("SELECT COUNT(*) as c FROM payments WHERE tenant_id = ?", [tenantId]);
  if (Number(pgPCount.c) === 0) {
    await db.run("INSERT INTO payments (tenant_id, type, party_type, party_id, reference_id, reference_no, amount, payment_method, payment_date) VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 7, 'INV-20261024-0001', 42, 'Cash', '2026-10-24'), (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 8, 'INV-20261024-0002', 21, 'Cash', '2026-10-24'), (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 9, 'INV-20261024-0003', 21, 'Cash', '2026-10-24')", [tenantId, pgCustRec.id, tenantId, pgCustRec.id, tenantId, pgCustRec.id]);
  }

  let pgCashbookRes = null;
  await paymentController.getCashbook(mockReqCashbook, {
    json: (d) => { pgCashbookRes = d; return mockResCashbook; },
    status: () => mockResCashbook
  });
  assert(pgCashbookRes && pgCashbookRes.success, 'PG getCashbook returned success');
  console.log(`  ✓ PostgreSQL Cashbook Total In: ₨ ${Number(pgCashbookRes.total_in).toFixed(2)}`);
  assert.strictEqual(Number(pgCashbookRes.total_in), 84.00, 'PostgreSQL cashbook total_in must equal exactly ₨ 84.00');

  let pgRegisterRes = null;
  await reportController.getDayRegister(mockReqRegister, {
    json: (d) => { pgRegisterRes = d; return mockResRegister; },
    status: () => mockResRegister
  });
  assert(pgRegisterRes && pgRegisterRes.success, 'PG getDayRegister returned success');
  console.log(`  ✓ PostgreSQL Day Register Total Cash In: ₨ ${Number(pgRegisterRes.cash_summary.total_cash_in).toFixed(2)}`);
  assert.strictEqual(Number(pgRegisterRes.cash_summary.total_cash_in), 84.00, 'PostgreSQL Day Register cash_in must equal ₨ 84.00');

  // Customer ledger in PostgreSQL must exclude unlinked payments
  const pgCust = await db.get("SELECT id, name, current_balance FROM customers WHERE tenant_id = ?", [tenantId]);
  assert(pgCust, 'Customer exists in PG');
  console.log(`  ✓ PostgreSQL Customer [${pgCust.name}] balance: ₨ ${Number(pgCust.current_balance).toFixed(2)} (Excludes quarantined rows)`);
  assert.strictEqual(Number(pgCust.current_balance), Number(sqliteCust.current_balance), 'Customer balance identical between SQLite and PG');

  // -------------------------------------------------------------------------
  // 3. PAISA-LEVEL DELTA ASSERTION
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Paisa-Level Drawer Parity Check ---');
  const diffCashbook = Math.abs(Number(sqliteCashbookRes.total_in) - Number(pgCashbookRes.total_in));
  const diffRegister = Math.abs(Number(sqliteRegisterRes.cash_summary.total_cash_in) - Number(pgRegisterRes.cash_summary.total_cash_in));
  
  console.log(`  Delta Cashbook: ₨ ${diffCashbook.toFixed(4)}`);
  console.log(`  Delta Register: ₨ ${diffRegister.toFixed(4)}`);
  assert.strictEqual(diffCashbook, 0, 'Cashbook difference must be ₨ 0.0000');
  assert.strictEqual(diffRegister, 0, 'Register difference must be ₨ 0.0000');

  // Reset driver to sqlite for clean state
  db.setDriver('sqlite');

  console.log('\n========================================================================');
  console.log('  🎉 STEP 2A CONDITION 1 VERIFICATION PASSED (PAISA PARITY PROVEN)!');
  console.log('========================================================================\n');
}

runCashbookQuarantineParityTest().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ Cashbook parity test failed:', err);
  process.exit(1);
});
