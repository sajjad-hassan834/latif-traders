#!/usr/bin/env node
/**
 * scripts/baseline_report.js
 *
 * Emits a structured JSON baseline snapshot of key aggregate business metrics from a SQLite database file.
 * Used for strict Before vs After diff verification across releases and database migrations.
 * PRIVACY/SECURITY: Outputs AGGREGATE NUMBERS ONLY. Never exports customer names, phones, or rows.
 *
 * Usage:
 *   node scripts/baseline_report.js <path-to-database.db>
 *   node scripts/baseline_report.js <path-to-database.db> > baseline.json
 */

const path = require('path');
const fs = require('fs');

const dbArg = process.argv[2];
if (!dbArg) {
  console.error(JSON.stringify({ error: 'Missing database path argument. Usage: node scripts/baseline_report.js <file.db>' }, null, 2));
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), dbArg);
if (!fs.existsSync(dbPath)) {
  console.error(JSON.stringify({ error: `File not found: ${dbPath}` }, null, 2));
  process.exit(1);
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error(JSON.stringify({ error: 'better-sqlite3 not available' }, null, 2));
  process.exit(1);
}

const fileStat = fs.statSync(dbPath);
let db;
try {
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
} catch (err) {
  console.error(JSON.stringify({ error: `Cannot open database: ${err.message}` }, null, 2));
  process.exit(1);
}

try {
  // 1. PRAGMA integrity_check
  const integrity = db.prepare('PRAGMA integrity_check').all();
  const integrityStatus = integrity.length === 1 && integrity[0].integrity_check === 'ok' ? 'ok' : 'corrupted';

  // 2. Table row counts
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const tableCounts = {};
  for (const t of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
      tableCounts[t.name] = row ? row.count : 0;
    } catch (_) {
      tableCounts[t.name] = null;
    }
  }

  // 3. Customers
  let totalCustomers = 0;
  let customerReceivables = 0;
  let customerNetBalance = 0;
  try {
    const custRes = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as receivables,
        COALESCE(SUM(current_balance), 0) as net
      FROM customers
    `).get();
    totalCustomers = custRes.total;
    customerReceivables = Number(custRes.receivables);
    customerNetBalance = Number(custRes.net);
  } catch (_) {}

  // 4. Suppliers
  let totalSuppliers = 0;
  let supplierPayables = 0;
  let supplierNetBalance = 0;
  try {
    const supRes = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as payables,
        COALESCE(SUM(current_balance), 0) as net
      FROM suppliers
    `).get();
    totalSuppliers = supRes.total;
    supplierPayables = Number(supRes.payables);
    supplierNetBalance = Number(supRes.net);
  } catch (_) {}

  // 5. Stock
  let totalStockUnits = 0;
  let stockValuation = 0;
  try {
    const stockRes = db.prepare(`
      SELECT 
        COALESCE(SUM(quantity), 0) as units,
        COALESCE(SUM(quantity * purchase_price), 0) as val
      FROM batches 
      WHERE status = 'active'
    `).get();
    totalStockUnits = Number(stockRes.units);
    stockValuation = Number(stockRes.val);
  } catch (_) {}

  // 6. Sales
  let totalOrders = 0;
  let grossSales = 0;
  let totalCollected = 0;
  let oldestInvoiceDate = null;
  let newestInvoiceDate = null;
  try {
    const salesRes = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(grand_total), 0) as gross,
        COALESCE(SUM(paid_amount), 0) as collected,
        MIN(sale_date) as oldest,
        MAX(sale_date) as newest
      FROM sales
    `).get();
    totalOrders = salesRes.total;
    grossSales = Number(salesRes.gross);
    totalCollected = Number(salesRes.collected);
    oldestInvoiceDate = salesRes.oldest || null;
    newestInvoiceDate = salesRes.newest || null;
  } catch (_) {}

  const report = {
    database_file: path.basename(dbPath),
    generated_at: new Date().toISOString(),
    file_size_bytes: fileStat.size,
    file_size_kb: Number((fileStat.size / 1024).toFixed(2)),
    file_size_mb: Number((fileStat.size / (1024 * 1024)).toFixed(2)),
    integrity_check: integrityStatus,
    table_counts: tableCounts,
    business_aggregates: {
      total_customers: totalCustomers,
      customer_receivables: customerReceivables,
      customer_net_balance: customerNetBalance,
      total_suppliers: totalSuppliers,
      supplier_payables: supplierPayables,
      supplier_net_balance: supplierNetBalance,
      total_stock_units: totalStockUnits,
      stock_valuation: stockValuation,
      total_orders: totalOrders,
      gross_sales: grossSales,
      total_collected: totalCollected,
      oldest_invoice_date: oldestInvoiceDate,
      newest_invoice_date: newestInvoiceDate
    }
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
}

