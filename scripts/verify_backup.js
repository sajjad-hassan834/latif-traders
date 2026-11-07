#!/usr/bin/env node
/**
 * scripts/verify_backup.js
 *
 * Verifies the structural integrity and aggregate business metrics of a SQLite database file.
 * PRIVACY/SECURITY: Outputs AGGREGATE METRICS ONLY. Never logs individual rows, customer names,
 * phone numbers, product names, or sensitive records.
 *
 * Usage:
 *   node scripts/verify_backup.js <path-to-file.db>
 */

const path = require('path');
const fs = require('fs');

const dbArg = process.argv[2];
if (!dbArg) {
  console.error('\nUsage: node scripts/verify_backup.js <path-to-database.db>');
  console.error('Example: node scripts/verify_backup.js data/latif_traders.db\n');
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), dbArg);
if (!fs.existsSync(dbPath)) {
  console.error(`\n[ERROR] File not found: ${dbPath}\n`);
  process.exit(1);
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('\n[ERROR] better-sqlite3 module not found. Run npm install.\n');
  process.exit(1);
}

const fileStat = fs.statSync(dbPath);
const fileSizeKb = (fileStat.size / 1024).toFixed(2);
const fileSizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);

console.log('========================================================================');
console.log('   SHOPPYOS DATABASE BACKUP INTEGRITY & AGGREGATE METRICS AUDIT');
console.log('========================================================================');
console.log(`Database File:     ${path.basename(dbPath)}`);
console.log(`Full Path:         ${dbPath}`);
console.log(`File Size:         ${fileSizeKb} KB (${fileSizeMb} MB)`);
console.log(`Last Modified:     ${fileStat.mtime.toISOString()}`);

let db;
try {
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
} catch (err) {
  console.error(`\n[FATAL] Could not open database file: ${err.message}\n`);
  process.exit(1);
}

try {
  // 1. PRAGMA integrity_check
  const integrity = db.prepare('PRAGMA integrity_check').all();
  const isHealthy = integrity.length === 1 && integrity[0].integrity_check === 'ok';

  console.log('\n--- 1. Database Health Check ---');
  if (isHealthy) {
    console.log('  ✅ PRAGMA integrity_check: OK (Zero corruption detected)');
  } else {
    console.error('  ❌ PRAGMA integrity_check FAILED:');
    integrity.forEach(r => console.error('     ', r.integrity_check));
  }

  // 2. Table Row Counts
  console.log('\n--- 2. Table Row Counts (Aggregates Only) ---');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const counts = {};
  for (const t of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
      counts[t.name] = row ? row.count : 0;
      console.log(`  • ${t.name.padEnd(28)} : ${String(counts[t.name]).padStart(8)} rows`);
    } catch (e) {
      counts[t.name] = 'ERROR';
      console.log(`  • ${t.name.padEnd(28)} : ERROR (${e.message})`);
    }
  }

  // 3. Financial & Ledger Aggregate Totals
  console.log('\n--- 3. Financial & Business Baseline Totals ---');

  // Customer Receivables
  let customerReceivables = 0;
  let customerCount = 0;
  try {
    const custRes = db.prepare(`
      SELECT 
        COUNT(*) as total_customers,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as receivables,
        COALESCE(SUM(current_balance), 0) as net_balance
      FROM customers
    `).get();
    customerCount = custRes.total_customers;
    customerReceivables = custRes.receivables;
    console.log(`  • Total Customers                : ${customerCount}`);
    console.log(`  • Customer Receivables (Udhaar)  : ₨ ${Number(customerReceivables).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  • Customer Net Ledger Balance    : ₨ ${Number(custRes.net_balance).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  } catch (e) {
    console.log(`  • Customers Query Error          : ${e.message}`);
  }

  // Supplier Payables
  let supplierPayables = 0;
  let supplierCount = 0;
  try {
    const supRes = db.prepare(`
      SELECT 
        COUNT(*) as total_suppliers,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as payables,
        COALESCE(SUM(current_balance), 0) as net_balance
      FROM suppliers
    `).get();
    supplierCount = supRes.total_suppliers;
    supplierPayables = supRes.payables;
    console.log(`  • Total Suppliers                : ${supplierCount}`);
    console.log(`  • Supplier Payables (Outstanding): ₨ ${Number(supplierPayables).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  } catch (e) {
    console.log(`  • Suppliers Query Error          : ${e.message}`);
  }

  // Stock Inventory Value
  try {
    const stockRes = db.prepare(`
      SELECT 
        COALESCE(SUM(quantity * purchase_price), 0) as stock_valuation,
        COALESCE(SUM(quantity), 0) as total_units
      FROM batches 
      WHERE status = 'active'
    `).get();
    console.log(`  • Active Stock Total Units       : ${Number(stockRes.total_units).toLocaleString('en-PK')}`);
    console.log(`  • Active Inventory Stock Value   : ₨ ${Number(stockRes.stock_valuation).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  } catch (e) {
    console.log(`  • Batches Stock Query Error      : ${e.message}`);
  }

  // Orders / Sales Metrics
  try {
    const salesRes = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(grand_total), 0) as gross_sales,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        MIN(sale_date) as oldest_sale,
        MAX(sale_date) as newest_sale
      FROM sales
    `).get();
    console.log(`  • Total Orders / Invoices Count  : ${salesRes.total_orders}`);
    console.log(`  • Gross Lifetime Sales Volume    : ₨ ${Number(salesRes.gross_sales).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  • Total Cash / Amount Collected  : ₨ ${Number(salesRes.total_collected).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  • Oldest Invoice Date            : ${salesRes.oldest_sale || 'N/A'}`);
    console.log(`  • Newest Invoice Date            : ${salesRes.newest_sale || 'N/A'}`);
  } catch (e) {
    console.log(`  • Sales Orders Query Error       : ${e.message}`);
  }

  console.log('\n========================================================================');
  if (isHealthy) {
    console.log('✅ AUDIT COMPLETE: Database structure is valid and verified.');
  } else {
    console.log('⚠️ AUDIT WARNING: Database failed integrity check.');
  }
  console.log('========================================================================\n');
} finally {
  db.close();
}

