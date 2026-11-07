#!/usr/bin/env node
/**
 * scripts/baseline_report.js
 * 
 * Generates an automated JSON baseline summary of database metrics for pre/post deploy verification.
 * STRICT PRIVACY REQUIREMENT: Aggregates only. Never outputs names, customer lists, or row data.
 * 
 * Usage: node scripts/baseline_report.js <path-to-db-file>
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.argv[2];

if (!dbPath) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/baseline_report.js <file.db>' }, null, 2));
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), dbPath);

if (!fs.existsSync(resolvedPath)) {
  console.error(JSON.stringify({ error: `File not found at "${resolvedPath}"` }, null, 2));
  process.exit(1);
}

const stats = fs.statSync(resolvedPath);

let db;
try {
  db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
} catch (err) {
  console.error(JSON.stringify({ error: `Failed to open SQLite database: ${err.message}` }, null, 2));
  process.exit(1);
}

try {
  // 1. Integrity
  const integrityRows = db.prepare('PRAGMA integrity_check').all();
  const integrityOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';

  // 2. Table row counts
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tableCounts = {};
  let totalRows = 0;

  tables.forEach(t => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
      tableCounts[t.name] = count;
      totalRows += count;
    } catch (_) {
      tableCounts[t.name] = null;
    }
  });

  // 3. Aggregates
  let custReceivables = 0;
  try {
    custReceivables = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as tot FROM customers WHERE current_balance > 0').get().tot;
  } catch (_) {}

  let suppPayables = 0;
  try {
    suppPayables = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as tot FROM suppliers WHERE current_balance > 0').get().tot;
  } catch (_) {}

  let stockCost = 0;
  let stockRetail = 0;
  let batchCount = 0;
  try {
    const bRow = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(quantity * purchase_price), 0) as cost, COALESCE(SUM(quantity * sale_price), 0) as retail FROM batches WHERE quantity > 0').get();
    batchCount = bRow.cnt || 0;
    stockCost = bRow.cost || 0;
    stockRetail = bRow.retail || 0;
  } catch (_) {}

  let ordersCount = 0;
  let oldestInvoice = null;
  let newestInvoice = null;
  let ordersTotal = 0;
  try {
    const saleRow = db.prepare('SELECT COUNT(*) as cnt, MIN(sale_date) as oldest, MAX(sale_date) as newest, COALESCE(SUM(grand_total), 0) as tot FROM sales').get();
    ordersCount = saleRow.cnt || 0;
    oldestInvoice = saleRow.oldest || null;
    newestInvoice = saleRow.newest || null;
    ordersTotal = saleRow.tot || 0;
  } catch (_) {}

  let paymentsCount = 0;
  let paymentsTotal = 0;
  try {
    const payRow = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as tot FROM payments').get();
    paymentsCount = payRow.cnt || 0;
    paymentsTotal = payRow.tot || 0;
  } catch (_) {}

  const report = {
    metadata: {
      filename: path.basename(resolvedPath),
      file_size_bytes: stats.size,
      file_size_kb: Number((stats.size / 1024).toFixed(2)),
      last_modified: stats.mtime.toISOString(),
      report_generated_at: new Date().toISOString()
    },
    integrity: {
      check: integrityOk ? 'ok' : 'failed',
      raw: integrityRows
    },
    aggregates: {
      customer_receivables_total: Number(custReceivables.toFixed(2)),
      supplier_payables_total: Number(suppPayables.toFixed(2)),
      inventory_stock_cost_total: Number(stockCost.toFixed(2)),
      inventory_stock_retail_total: Number(stockRetail.toFixed(2)),
      active_batches_count: batchCount,
      total_orders_count: ordersCount,
      total_orders_amount: Number(ordersTotal.toFixed(2)),
      oldest_invoice_date: oldestInvoice,
      newest_invoice_date: newestInvoice,
      total_payments_count: paymentsCount,
      total_payments_amount: Number(paymentsTotal.toFixed(2))
    },
    database_summary: {
      total_tables: tables.length,
      total_rows: totalRows,
      table_rows: tableCounts
    }
  };

  console.log(JSON.stringify(report, null, 2));

} catch (err) {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
} finally {
  db.close();
}

