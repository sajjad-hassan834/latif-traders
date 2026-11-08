#!/usr/bin/env node
/**
 * scripts/postgres_since_cutover_report.js
 * Read-only audit tool for post-cutover activity in PostgreSQL.
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/postgres_since_cutover_report.js [ISO_TIMESTAMP]
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('ERROR: DATABASE_URL environment variable is required to run this report.');
    process.exit(1);
  }

  // Default cutover timestamp if none passed (November 8, 2026 00:00:00 UTC)
  const sinceTimestamp = process.argv[2] || '2026-11-08T00:00:00.000Z';
  console.log(`Connecting to PostgreSQL (Read-Only)...`);
  console.log(`Auditing records created since: ${sinceTimestamp}`);

  const client = new Client({
    connectionString: connStr,
    ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  await client.connect();

  const report = {
    audit_timestamp: new Date().toISOString(),
    since_timestamp: sinceTimestamp,
    tables_count_since: {},
    new_sales_summary: [],
    new_purchases_summary: [],
    new_payments_summary: []
  };

  try {
    // 1. Table counts created since cutover
    const tables = ['sales', 'purchases', 'payments', 'customers', 'suppliers', 'products', 'batches', 'expenses'];
    for (const t of tables) {
      const q = `SELECT COUNT(*) FROM ${t} WHERE created_at > $1`;
      const res = await client.query(q, [sinceTimestamp]);
      report.tables_count_since[t] = parseInt(res.rows[0].count, 10);
    }

    // 2. Sales (id, date, invoice_no, grand_total, balance_due ONLY - no personal/PII)
    const salesRes = await client.query(
      `SELECT id, sale_date, invoice_no, grand_total, balance_due, payment_status, created_at 
       FROM sales 
       WHERE created_at > $1 
       ORDER BY id ASC`,
      [sinceTimestamp]
    );
    report.new_sales_summary = salesRes.rows.map(r => ({
      id: r.id,
      sale_date: r.sale_date,
      invoice_no: r.invoice_no,
      grand_total: r.grand_total,
      balance_due: r.balance_due,
      payment_status: r.payment_status,
      created_at: r.created_at
    }));

    // 3. Purchases (id, purchase_date, invoice_no, grand_total ONLY)
    const purchasesRes = await client.query(
      `SELECT id, purchase_date, invoice_no, grand_total, payment_status, created_at 
       FROM purchases 
       WHERE created_at > $1 
       ORDER BY id ASC`,
      [sinceTimestamp]
    );
    report.new_purchases_summary = purchasesRes.rows.map(r => ({
      id: r.id,
      purchase_date: r.purchase_date,
      invoice_no: r.invoice_no,
      grand_total: r.grand_total,
      payment_status: r.payment_status,
      created_at: r.created_at
    }));

    // 4. Payments (id, payment_date, reference_no, amount, type ONLY)
    const paymentsRes = await client.query(
      `SELECT id, payment_date, reference_no, amount, type, payment_method, created_at 
       FROM payments 
       WHERE created_at > $1 
       ORDER BY id ASC`,
      [sinceTimestamp]
    );
    report.new_payments_summary = paymentsRes.rows.map(r => ({
      id: r.id,
      payment_date: r.payment_date,
      reference_no: r.reference_no,
      amount: r.amount,
      type: r.type,
      payment_method: r.payment_method,
      created_at: r.created_at
    }));

    const outPath = path.join(process.cwd(), 'data', 'postgres_post_cutover_report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n--- AUDIT COMPLETE ---');
    console.log('Counts created since cutover:');
    console.table(report.tables_count_since);
    console.log(`Report written safely to: ${outPath}`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Audit execution error:', err.message);
  process.exit(1);
});

