const path = require('path');
const fs = require('fs');

// Set isolated test database path in scratch directory
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test_ledger_reconciliation.db');
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');

process.env.DB_PATH = TEST_DB_PATH;

const { db, initializeDatabase } = require('../config/database');
const ledgerService = require('../services/ledgerService');

console.log('--- Initializing Test Database for Ledger Reconciliation ---');
initializeDatabase();

function assertEqual(actual, expected, message) {
  if (Math.abs(actual - expected) > 0.001) {
    console.error(`❌ FAILED: ${message} (Expected ${expected}, got ${actual})`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message} (${actual})`);
}

function runTests() {
  console.log('\n======================================================');
  console.log('RUNNING PRIORITY 1: LEDGER RECONCILIATION TEST SUITE');
  console.log('======================================================\n');

  const tenantA = 'tenant_alpha';
  const tenantB = 'tenant_beta';

  // 1. Scenario 1: Customer with Opening Balance + Partial Payment Sale
  console.log('--- Scenario 1: Opening Balance + Partial Payment Sale ---');
  const custRes = db.prepare(`
    INSERT INTO customers (tenant_id, name, phone, opening_balance, current_balance)
    VALUES (?, 'Fasial Walton', '03001234567', 1000, 1000)
  `).run(tenantA);
  const custId = custRes.lastInsertRowid;

  // Invoice 1: 10,000 billed, 4,000 paid at time of sale, 6,000 balance due
  const sRes = db.prepare(`
    INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, subtotal, grand_total, paid_amount, balance_due, payment_method)
    VALUES (?, 'INV-001', ?, '2026-10-20', 10000, 10000, 4000, 6000, 'Cash')
  `).run(tenantA, custId);
  const saleId = sRes.lastInsertRowid;

  // Insert POS payment receipt
  db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, reference_id, reference_no, amount, payment_method, payment_date)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, 'INV-001', 4000, 'Cash', '2026-10-20')
  `).run(tenantA, custId, saleId);

  // Update cached balance inside the transaction
  db.prepare('UPDATE customers SET current_balance = current_balance + 6000 WHERE id = ?').run(custId);

  let ledger = ledgerService.calculateCustomerLedger(custId, tenantA);
  assertEqual(ledger.summary.total_billed, 11000, 'Total Billed (10,000 + 1,000 opening)');
  assertEqual(ledger.summary.total_paid, 4000, 'Total Received');
  assertEqual(ledger.summary.closing_balance, 7000, 'Ledger Closing Balance (1,000 + 6,000)');
  assertEqual(ledger.ledger[0].running_balance, 7000, 'Top row running balance equals closing balance');

  // Verify stored customer balance matches ledger
  const custRow1 = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(custId);
  assertEqual(custRow1.current_balance, ledger.summary.closing_balance, 'List stored balance equals ledger closing balance');

  // 2. Scenario 2: Overpayment on Sale (Bill = 5,000, Paid = 7,000)
  console.log('\n--- Scenario 2: Overpayment on Sale (Overpaid) ---');
  const sRes2 = db.prepare(`
    INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, subtotal, grand_total, paid_amount, balance_due, payment_method)
    VALUES (?, 'INV-002', ?, '2026-10-21', 5000, 5000, 7000, 0, 'Cash')
  `).run(tenantA, custId);

  db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, reference_id, reference_no, amount, payment_method, payment_date)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, 'INV-002', 7000, 'Cash', '2026-10-21')
  `).run(tenantA, custId, sRes2.lastInsertRowid);

  // Overpayment of 2,000 reduces balance: 7,000 - 2,000 = 5,000
  db.prepare('UPDATE customers SET current_balance = current_balance + (5000 - 7000) WHERE id = ?').run(custId);

  ledger = ledgerService.calculateCustomerLedger(custId, tenantA);
  assertEqual(ledger.summary.closing_balance, 5000, 'Ledger balance after overpayment');
  const custRow2 = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(custId);
  assertEqual(custRow2.current_balance, ledger.summary.closing_balance, 'List balance matches ledger after overpayment');

  // Verify overpayment entry is not labeled "Paid in Full"
  const overpayRow = ledger.ledger.find(r => r.type === 'SALE_INVOICE' && r.ref_no === 'INV-002');
  if (overpayRow.status_chip === 'PAID') {
    throw new Error('Overpaid invoice should not be simply labeled PAID');
  }
  console.log(`✅ PASSED: Overpaid invoice labeled correctly: ${overpayRow.status_label}`);

  const overpayReceipt = ledger.ledger.find(r => r.type === 'PAYMENT_RECEIPT' && r.reference_id === sRes2.lastInsertRowid);
  if (!overpayReceipt.is_extra_payment) {
    throw new Error('Extra payment flag not set on overpaid receipt');
  }
  console.log(`✅ PASSED: Extra payment receipt recognized: ${overpayReceipt.notes}`);

  // 3. Scenario 3: Standalone Customer Receipt (e.g. Paid 2,000 against account balance)
  console.log('\n--- Scenario 3: Standalone Customer Receipt ---');
  db.prepare(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, reference_no, amount, payment_method, payment_date, notes)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 'REC-STANDALONE', 2000, 'Bank Transfer', '2026-10-22', 'Direct Bank Deposit')
  `).run(tenantA, custId);
  db.prepare('UPDATE customers SET current_balance = current_balance - 2000 WHERE id = ?').run(custId);

  ledger = ledgerService.calculateCustomerLedger(custId, tenantA);
  assertEqual(ledger.summary.closing_balance, 3000, 'Ledger balance after standalone receipt (5000 - 2000)');
  const custRow3 = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(custId);
  assertEqual(custRow3.current_balance, ledger.summary.closing_balance, 'List balance matches ledger after standalone receipt');

  // 4. Scenario 4: Sales Return (Return of 500)
  console.log('\n--- Scenario 4: Sales Return Credit ---');
  db.prepare(`
    INSERT INTO returns (tenant_id, return_no, type, original_invoice_id, party_id, total_amount, reason)
    VALUES (?, 'RET-001', 'SALE_RETURN', ?, ?, 500, 'Damaged product return')
  `).run(tenantA, saleId, custId);
  db.prepare('UPDATE customers SET current_balance = current_balance - 500 WHERE id = ?').run(custId);

  ledger = ledgerService.calculateCustomerLedger(custId, tenantA);
  assertEqual(ledger.summary.total_returns, 500, 'Total Returns');
  assertEqual(ledger.summary.closing_balance, 2500, 'Ledger balance after return (3000 - 500)');
  const custRow4 = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(custId);
  assertEqual(custRow4.current_balance, ledger.summary.closing_balance, 'List balance matches ledger after return');

  // 5. Scenario 5: Audit & Sync Balances
  console.log('\n--- Scenario 5: Audit & Sync Balances Diff Preview ---');
  // Intentionally desynchronize stored balance to test audit detection
  db.prepare('UPDATE customers SET current_balance = 99999 WHERE id = ?').run(custId);

  const auditResult = ledgerService.auditCustomerBalances(tenantA);
  assertEqual(auditResult.discrepancies_count, 1, 'Audit correctly detected discrepancy');
  assertEqual(auditResult.discrepancies[0].stored_balance, 99999, 'Audit detected old balance');
  assertEqual(auditResult.discrepancies[0].calculated_balance, 2500, 'Audit calculated true balance');

  // Run sync
  const syncResult = ledgerService.syncCustomerBalances(tenantA, [custId]);
  assertEqual(syncResult.updated_count, 1, 'Sync updated 1 customer');
  const custRowSync = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(custId);
  assertEqual(custRowSync.current_balance, 2500, 'Stored balance successfully restored to true ledger balance');

  // 6. Scenario 6: Multi-Tenant Isolation Test (Tenant Alpha vs Tenant Beta)
  console.log('\n--- Scenario 6: Multi-Tenant Isolation ---');
  // Tenant B has its own customer with same phone number
  const custBRes = db.prepare(`
    INSERT INTO customers (tenant_id, name, phone, opening_balance, current_balance)
    VALUES (?, 'Tenant B Customer', '03001234567', 0, 0)
  `).run(tenantB);
  const custBId = custBRes.lastInsertRowid;

  const ledgerTenantB = ledgerService.calculateCustomerLedger(custBId, tenantB);
  assertEqual(ledgerTenantB.summary.closing_balance, 0, 'Tenant B customer balance is isolated and 0');

  const auditTenantB = ledgerService.auditCustomerBalances(tenantB);
  assertEqual(auditTenantB.discrepancies_count, 0, 'Tenant B has zero discrepancies');

  console.log('\n======================================================');
  console.log('🎉 ALL LEDGER RECONCILIATION TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

try {
  runTests();
} finally {
  // Clean up test DB
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
  if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
}
