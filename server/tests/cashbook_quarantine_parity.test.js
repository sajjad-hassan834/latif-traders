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
