#!/usr/bin/env node
/**
 * scripts/compare_sqlite_and_postgres.js
 * Read-only side-by-side comparison between an SQLite file and PostgreSQL.
 *
 * Usage:
 *   node scripts/compare_sqlite_and_postgres.js [path/to/backup.db]
 *
 * It reads DATABASE_URL from your environment or .env file.
 * It NEVER writes or alters any data.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

async function main() {
  const sqlitePath = process.argv[2] || path.join(process.cwd(), 'data', 'latif_traders.db');
  const pgUrl = process.env.DATABASE_URL;

  console.log('\n========================================================================');
  console.log('       SIDE-BY-SIDE VERIFICATION: SQLITE BACKUP VS LIVE POSTGRESQL');
  console.log('========================================================================');
  console.log(`SQLite File:  ${sqlitePath}`);
  console.log(`PostgreSQL:   ${pgUrl ? 'Configured (via DATABASE_URL)' : 'NOT CONFIGURED'}`);
  console.log('------------------------------------------------------------------------\n');

  if (!fs.existsSync(sqlitePath)) {
    console.error(`ERROR: SQLite file not found at ${sqlitePath}`);
    process.exit(1);
  }

  if (!pgUrl) {
    console.error('ERROR: DATABASE_URL is missing. Please set it in your environment or .env.');
    process.exit(1);
  }

  const sdb = new Database(sqlitePath, { readonly: true });
  const pgClient = new Client({
    connectionString: pgUrl,
    ssl: pgUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  await pgClient.connect();

  try {
    // 1. Core Financial Aggregates
    const sSales = sdb.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM sales').get();
    const pgSales = (await pgClient.query('SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM sales')).rows[0];

    const sPurchases = sdb.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM purchases').get();
    const pgPurchases = (await pgClient.query('SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM purchases')).rows[0];

    const sCust = sdb.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(current_balance), 0) as total FROM customers').get();
    const pgCust = (await pgClient.query('SELECT COUNT(*) as cnt, COALESCE(SUM(current_balance), 0) as total FROM customers')).rows[0];

    const sSupp = sdb.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(current_balance), 0) as total FROM suppliers').get();
    const pgSupp = (await pgClient.query('SELECT COUNT(*) as cnt, COALESCE(SUM(current_balance), 0) as total FROM suppliers')).rows[0];

    const sBatches = sdb.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(quantity), 0) as qty FROM batches').get();
    const pgBatches = (await pgClient.query('SELECT COUNT(*) as cnt, COALESCE(SUM(quantity), 0) as qty FROM batches')).rows[0];

    console.log('--- FINANCIAL & BUSINESS TOTALS ---');
    console.table([
      {
        Metric: 'Total Sales Invoices',
        SQLite: Number(sSales.cnt).toLocaleString(),
        Postgres: Number(pgSales.cnt).toLocaleString(),
        Diff: Number(pgSales.cnt) - Number(sSales.cnt)
      },
      {
        Metric: 'Gross Sales (Rs)',
        SQLite: Number(sSales.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Postgres: Number(pgSales.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Diff: (Number(pgSales.total) - Number(sSales.total)).toFixed(2)
      },
      {
        Metric: 'Total Purchases',
        SQLite: Number(sPurchases.cnt).toLocaleString(),
        Postgres: Number(pgPurchases.cnt).toLocaleString(),
        Diff: Number(pgPurchases.cnt) - Number(sPurchases.cnt)
      },
      {
        Metric: 'Gross Purchases (Rs)',
        SQLite: Number(sPurchases.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Postgres: Number(pgPurchases.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Diff: (Number(pgPurchases.total) - Number(sPurchases.total)).toFixed(2)
      },
      {
        Metric: 'Customer Receivables (Rs)',
        SQLite: Number(sCust.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Postgres: Number(pgCust.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Diff: (Number(pgCust.total) - Number(sCust.total)).toFixed(2)
      },
      {
        Metric: 'Supplier Payables (Rs)',
        SQLite: Number(sSupp.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Postgres: Number(pgSupp.total).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        Diff: (Number(pgSupp.total) - Number(sSupp.total)).toFixed(2)
      },
      {
        Metric: 'Total Stock Quantity',
        SQLite: Number(sBatches.qty).toLocaleString(),
        Postgres: Number(pgBatches.qty).toLocaleString(),
        Diff: Number(pgBatches.qty) - Number(sBatches.qty)
      }
    ]);

    // 2. Row Counts for All Tables
    const tables = [
      'users', 'tenants', 'customers', 'suppliers', 'products', 'batches',
      'sales', 'sale_items', 'purchases', 'purchase_items', 'payments',
      'returns', 'return_items', 'expenses', 'stock_adjustments'
    ];

    const tableRows = [];
    for (const t of tables) {
      let sCount = 'N/A';
      try {
        sCount = sdb.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
      } catch (_) {}

      let pgCount = 'N/A';
      try {
        const r = await pgClient.query(`SELECT COUNT(*) as c FROM ${t}`);
        pgCount = r.rows[0].c;
      } catch (_) {}

      tableRows.push({
        Table: t,
        'SQLite Rows': sCount,
        'Postgres Rows': pgCount,
        Match: (sCount === pgCount && sCount !== 'N/A') ? '✅ EXACT' : (sCount === 'N/A' || pgCount === 'N/A' ? '⚠️ Missing' : 'ℹ️ Diff')
      });
    }

    console.log('\n--- TABLE ROW COUNTS ---');
    console.table(tableRows);

  } finally {
    sdb.close();
    await pgClient.end();
    console.log('\n========================================================================\n');
  }
}

main().catch(e => {
  console.error('Comparison error:', e.message);
  process.exit(1);
});

