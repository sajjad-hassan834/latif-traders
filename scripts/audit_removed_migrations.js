#!/usr/bin/env node
/**
 * scripts/audit_removed_migrations.js
 * Scans a target SQLite database file to verify if historical data affected
 * by previously removed destructive migrations is present.
 * Read-only. Counts only.
 */

const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = process.argv[2];
if (!dbPath) {
  console.error('Usage: node scripts/audit_removed_migrations.js <path-to-database.db>');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`Database file does not exist at: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log(`Auditing SQLite database (Read-Only): ${dbPath}`);
console.log('--------------------------------------------------');

// 1. Settings migration flags check
const flags = ['clean_auto_payments_v2', 'clean_duplicate_receipts_v2', 'fix_customer_ledger_opening_bal_v5'];
console.log('Migration Settings Flags:');
flags.forEach(f => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(f);
  console.log(`  - ${f}: ${row ? row.value : 'NOT SET'}`);
});

// 2. Count payments with auto-generated references
const autoPayments = db.prepare(`
  SELECT COUNT(*) as cnt FROM payments 
  WHERE reference_id IS NOT NULL 
     OR reference_no LIKE 'INV-%' 
     OR reference_no LIKE 'PUR-%'
`).get();
console.log(`Auto-generated payment references count: ${autoPayments.cnt}`);

// 3. Count Fasial Walton opening balance entries
const fasialSales = db.prepare(`
  SELECT COUNT(*) as cnt FROM sales s
  JOIN customers c ON s.customer_id = c.id
  WHERE (c.name LIKE '%Fasial%' OR c.name LIKE '%Faisal%')
    AND (s.grand_total = 21940 OR s.balance_due = 21940 OR s.notes LIKE '%Opening%' OR s.invoice_no LIKE '%OPN%')
`).get();
console.log(`Fasial opening balance sales count: ${fasialSales.cnt}`);

db.close();
console.log('--------------------------------------------------');
console.log('Audit complete.');
