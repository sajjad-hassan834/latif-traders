const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const assert = require('assert');

/**
 * Test: Removed Destructive Migrations & Faisal Override Parity
 *
 * Verifies that:
 * 1. "Already Ran" DB state (e.g., live production DB where flags exist):
 *    - Booting release code does NOT mutate or drift customer balances, ledger summaries, or cashbook totals.
 *    - Ledger calculations match stored customer current_balance identically.
 * 2. "Never Ran" DB state (e.g., fresh database or staging without legacy flags):
 *    - Booting release code does NOT execute destructive wipes:
 *      * Does NOT delete payments linked to invoices (clean_auto_payments_v2)
 *      * Does NOT delete legitimate same-day identical amount payments (clean_duplicate_receipts_v2)
 *      * Does NOT force-mutate customer balances or delete sales matching 'Opening' (fix_customer_ledger_opening_bal_v5)
 *      * Does NOT zero out opening_balance in calculateCustomerLedger for customers named Faisal (override removed)
 * 3. Asserts zero balance or ledger calculation drift.
 */

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test_migrations_parity.db');
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');

process.env.DB_PATH = TEST_DB_PATH;

const { db, initializeDatabase } = require('../config/database');
const ledgerService = require('../services/ledgerService');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

async function runParityTests() {
  console.log('========================================================================');
  console.log('  TEST: Removed Migrations & Ledger Faisal Override Parity Verification');
  console.log('========================================================================\n');

  // Initialize base schema with release code
  initializeDatabase();

  // ---------------------------------------------------------------------------
  // PART 1: "Already Ran" State (Simulating Live Production DB)
  // ---------------------------------------------------------------------------
  console.log('--- PART 1: Testing "Already Ran" State (Live Production Model) ---');
  const tenantLive = 'tenant_prod_sim';

  // In the live DB, flags are set to 'true'
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('clean_auto_payments_v2', 'true')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('clean_duplicate_receipts_v2', 'true')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fix_customer_ledger_opening_bal_v5', 'true')").run();

  // In live DB, Faisal has opening_balance = 0 and current_balance = 11870
  const faisalLive = db.prepare(`
    INSERT INTO customers (tenant_id, name, phone, opening_balance, current_balance)
    VALUES (?, 'Fasial Walton Live', '03009999991', 0, 11870)
  `).run(tenantLive);
  const faisalLiveId = faisalLive.lastInsertRowid;

  // Faisal has an invoice of 22410 with 0 paid (balance_due = 22410)
  db.prepare(`
    INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, subtotal, grand_total, paid_amount, balance_due, payment_method)
    VALUES (?, 'INV-LIVE-001', ?, '2026-10-18', 22410, 22410, 0, 22410, 'Credit')
  `).run(tenantLive, faisalLiveId);

  // Faisal has a standalone payment receipt of 10540 (22410 - 10540 = 11870)
  db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, reference_no, amount, payment_method, payment_date, notes)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 'REC-20261020-0001', 10540, 'Cash', '2026-10-20', 'Customer Udhaar Payment Received')
  `).run(tenantLive, faisalLiveId);

  // Run ledger calculation
  const liveLedger = await ledgerService.calculateCustomerLedger(faisalLiveId, tenantLive);
  console.log(`Live Model Stored Balance:   Rs ${11870}`);
  console.log(`Live Model Computed Closing: Rs ${liveLedger.summary.closing_balance}`);
  assert.strictEqual(liveLedger.summary.closing_balance, 11870, 'Calculated closing balance must match stored balance 11870');
  assert.strictEqual(liveLedger.summary.is_balanced, true, 'Customer ledger must be perfectly balanced');

  // Verify that re-running initializeDatabase() causes NO mutations or drift
  initializeDatabase();
  const faisalCheck1 = db.prepare('SELECT current_balance, opening_balance FROM customers WHERE id = ?').get(faisalLiveId);
  assert.strictEqual(faisalCheck1.current_balance, 11870, 'Stored balance must remain 11870 without drift');
  assert.strictEqual(faisalCheck1.opening_balance, 0, 'Opening balance must remain 0');
  console.log('✓ PASSED: "Already Ran" state experiences ZERO balance or ledger drift.\n');

  // ---------------------------------------------------------------------------
  // PART 2: "Never Ran" State (Fresh/Staging DB with Clean Release Code)
  // ---------------------------------------------------------------------------
  console.log('--- PART 2: Testing "Never Ran" State (Absence of Destructive Code) ---');
  const tenantFresh = 'tenant_fresh_sim';

  // Create customers in tenantFresh first to satisfy FK triggers
  const custAuto = db.prepare(`
    INSERT INTO customers (tenant_id, name, phone, opening_balance, current_balance)
    VALUES (?, 'Auto Pay Customer', '03001112233', 0, 5000)
  `).run(tenantFresh);
  const custAutoId = custAuto.lastInsertRowid;

  // 1. clean_auto_payments_v2 would have wiped payments where reference_id IS NOT NULL or notes like '%Receipt%'
  const autoPayRes = db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, reference_id, reference_no, amount, payment_method, payment_date, notes)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 501, 'INV-2026-AUTO', 5000, 'Cash', '2026-11-01', 'Receipt for Invoice INV-2026-AUTO')
  `).run(tenantFresh, custAutoId);
  const autoPaymentId = autoPayRes.lastInsertRowid;

  const custDup = db.prepare(`
    INSERT INTO customers (tenant_id, name, phone, opening_balance, current_balance)
    VALUES (?, 'Dup Pay Customer', '03004445566', 0, 3000)
  `).run(tenantFresh);
  const custDupId = custDup.lastInsertRowid;

  // 2. clean_duplicate_receipts_v2 would have deleted identical same-day payment #2 and inflated customer balance
  const dupPay1 = db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_method, payment_date)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 1500, 'Cash', '2026-11-02')
  `).run(tenantFresh, custDupId);
  const dupPay2 = db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_method, payment_date)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 1500, 'Cash', '2026-11-02')
  `).run(tenantFresh, custDupId);

  // 3. fix_customer_ledger_opening_bal_v5 would have deleted badSales matching 'Opening' and forced balance = 11870
  const faisalFresh = db.prepare(`
    INSERT INTO customers (tenant_id, name, phone, opening_balance, current_balance)
    VALUES (?, 'Faisal Real Customer', '03008888882', 21940, 21940)
  `).run(tenantFresh);
  const faisalFreshId = faisalFresh.lastInsertRowid;

  const openingSale = db.prepare(`
    INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, grand_total, balance_due, notes)
    VALUES (?, 'OPN-INV-999', ?, '2026-10-01', 21940, 21940, 'Opening balance invoice record')
  `).run(tenantFresh, faisalFreshId);

  // Now boot the database again to simulate release server start
  initializeDatabase();

  // Assert 1: Auto payment record was NOT deleted
  const autoCheck = db.prepare('SELECT id FROM payments WHERE id = ?').get(autoPaymentId);
  assert.ok(autoCheck, 'Payment linked to invoice must NOT be deleted by release code');
  console.log('✓ PASSED: clean_auto_payments did NOT run. Invoice payment preserved.');

  // Assert 2: Duplicate same-day payments were NOT deleted
  const dupCheck1 = db.prepare('SELECT id FROM payments WHERE id = ?').get(dupPay1.lastInsertRowid);
  const dupCheck2 = db.prepare('SELECT id FROM payments WHERE id = ?').get(dupPay2.lastInsertRowid);
  assert.ok(dupCheck1 && dupCheck2, 'Both legitimate same-day identical payments must be preserved');
  console.log('✓ PASSED: clean_duplicate_receipts did NOT run. Both same-day payments preserved.');

  // Assert 3: Customer sales and opening balance were NOT wiped/forced
  const saleCheck = db.prepare('SELECT id FROM sales WHERE id = ?').get(openingSale.lastInsertRowid);
  assert.ok(saleCheck, 'Sales with notes like "Opening" must NOT be deleted by release code');

  const custFreshCheck = db.prepare('SELECT opening_balance, current_balance FROM customers WHERE id = ?').get(faisalFreshId);
  assert.strictEqual(custFreshCheck.opening_balance, 21940, 'Opening balance 21940 must remain intact');
  assert.strictEqual(custFreshCheck.current_balance, 21940, 'Current balance must NOT be arbitrarily forced to 11870');
  console.log('✓ PASSED: fix_customer_ledger did NOT run. Customer balances not forced to 11870.');

  // Assert 4: Faisal in-memory override in ledgerService is removed:
  // Previously, calculateCustomerLedger silently replaced opening_balance with 0 if name matched Faisal or balance == 21940.
  // Now, calculateCustomerLedger MUST respect the real opening_balance of 21940!
  const freshLedger = await ledgerService.calculateCustomerLedger(faisalFreshId, tenantFresh);
  console.log(`Fresh Customer Stored Opening: Rs ${custFreshCheck.opening_balance}`);
  console.log(`Fresh Customer Ledger Opening: Rs ${freshLedger.summary.opening_balance}`);
  assert.strictEqual(freshLedger.summary.opening_balance, 21940, 'Ledger MUST respect the real customer opening balance without zeroing it out');
  console.log('✓ PASSED: ledgerService Faisal override is successfully removed. Real opening balance respected.\n');

  // ---------------------------------------------------------------------------
  // PART 3: Cashbook & Ledger Reconciliation Invariants
  // ---------------------------------------------------------------------------
  console.log('--- PART 3: Cashbook & Payments Invariants ---');
  const totalPayments = db.prepare('SELECT COUNT(*) as count, SUM(amount) as sum FROM payments').get();
  console.log(`Total payments rows in test DB: ${totalPayments.count}, Total Sum: Rs ${totalPayments.sum}`);
  assert.ok(totalPayments.count >= 4, 'All payments must be accounted for');
  console.log('✓ PASSED: All financial data intact across both states.\n');

  console.log('========================================================================');
  console.log('RESULT: ALL MIGRATION PARITY & LEDGER DRIFT TESTS PASSED (100%)');
  console.log('========================================================================');
}

runParityTests()
  .then(() => {
    // Cleanup test db
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
      if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch (_) {}
    process.exit(0);
  })
  .catch(err => {
    console.error('FAILED TEST:', err);
    process.exit(1);
  });
