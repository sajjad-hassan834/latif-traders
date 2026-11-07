#!/usr/bin/env node
/**
 * scripts/verify_backup.js
 * 
 * Verifies SQLite database integrity and calculates aggregate baseline totals.
 * STRICT PRIVACY REQUIREMENT: Aggregates only. Never prints names or individual rows.
 * 
 * Usage: node scripts/verify_backup.js <path-to-db-file>
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.argv[2];

if (!dbPath) {
  console.error('Usage: node scripts/verify_backup.js <file.db>');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), dbPath);

if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: File not found at "${resolvedPath}"`);
  process.exit(1);
}

const stats = fs.statSync(resolvedPath);
const sizeKb = (stats.size / 1024).toFixed(2);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log('========================================================================');
console.log('SQLITE DATABASE BACKUP INTEGRITY & AGGREGATE AUDIT');
console.log('========================================================================');
console.log(`Database File:  ${path.basename(resolvedPath)}`);
console.log(`File Size:      ${sizeKb} KB (${sizeMb} MB)`);
console.log(`Last Modified:  ${stats.mtime.toISOString()}`);
console.log('------------------------------------------------------------------------');

let db;
try {
  db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
} catch (err) {
  console.error(`❌ CRITICAL: Failed to open SQLite database: ${err.message}`);
  process.exit(1);
}

try {
  // 1. PRAGMA integrity_check
  const integrityRows = db.prepare('PRAGMA integrity_check').all();
  const isOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';

  if (isOk) {
    console.log('Integrity Check:  ✅ OK (Zero corruption detected)');
  } else {
    console.error('Integrity Check:  ❌ CORRUPT / ERRORS DETECTED:');
    integrityRows.forEach(r => console.error(`  - ${JSON.stringify(r)}`));
  }

  // 2. Table Row Counts (Aggregates Only)
  console.log('\n--- Table Row Counts ---');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  
  let totalRows = 0;
  tables.forEach(t => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
      console.log(`  • ${t.name.padEnd(28)} : ${count.toLocaleString()} rows`);
      totalRows += count;
    } catch (_) {
      console.log(`  • ${t.name.padEnd(28)} : (query error)`);
    }
  });
  console.log(`  ----------------------------------------------------`);
  console.log(`  Total Tables: ${tables.length} | Total Database Rows: ${totalRows.toLocaleString()}`);

  // 3. Financial & Ledger Aggregate Totals (No PII / No Names / No Rows)
  console.log('\n--- Financial & Operational Aggregates ---');

  // Receivables
  let custReceivables = 0;
  try {
    custReceivables = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as tot FROM customers WHERE current_balance > 0').get().tot;
  } catch (_) {}

  // Payables
  let suppPayables = 0;
  try {
    suppPayables = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as tot FROM suppliers WHERE current_balance > 0').get().tot;
  } catch (_) {}

  // Stock Values
  let stockCost = 0;
  let stockRetail = 0;
  try {
    stockCost = db.prepare('SELECT COALESCE(SUM(quantity * purchase_price), 0) as tot FROM batches WHERE quantity > 0').get().tot;
    stockRetail = db.prepare('SELECT COALESCE(SUM(quantity * sale_price), 0) as tot FROM batches WHERE quantity > 0').get().tot;
  } catch (_) {}

  // Orders Count
  let ordersCount = 0;
  let newestInvoice = 'N/A';
  let oldestInvoice = 'N/A';
  try {
    const saleRow = db.prepare('SELECT COUNT(*) as cnt, MIN(sale_date) as oldest, MAX(sale_date) as newest FROM sales').get();
    ordersCount = saleRow.cnt || 0;
    oldestInvoice = saleRow.oldest || 'N/A';
    newestInvoice = saleRow.newest || 'N/A';
  } catch (_) {}

  // Payments Count
  let paymentsCount = 0;
  let paymentsTotal = 0;
  try {
    const payRow = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as tot FROM payments').get();
    paymentsCount = payRow.cnt || 0;
    paymentsTotal = payRow.tot || 0;
  } catch (_) {}

  console.log(`  Customer Receivables (Udhaar) : Rs ${Number(custReceivables).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Supplier Payables (Due)       : Rs ${Number(suppPayables).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Inventory Stock Value (Cost)  : Rs ${Number(stockCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Inventory Stock Value (Retail): Rs ${Number(stockRetail).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Total Orders / Invoices       : ${ordersCount.toLocaleString()}`);
  console.log(`  Total Payment Transactions    : ${paymentsCount.toLocaleString()} (Total Rs ${Number(paymentsTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
  console.log(`  Oldest Invoice Date           : ${oldestInvoice}`);
  console.log(`  Newest Invoice Date           : ${newestInvoice}`);

  console.log('\n========================================================================');
  console.log(isOk ? '✅ VERIFICATION PASSED: Database is healthy, consistent, and ready.' : '❌ VERIFICATION FAILED: Corruption detected.');
  console.log('========================================================================');

} catch (err) {
  console.error(`Error during audit: ${err.message}`);
} finally {
  db.close();
}

