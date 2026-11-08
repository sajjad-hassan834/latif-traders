#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'latif_traders.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const targetKeys = ['clean_auto_payments_v2', 'clean_duplicate_receipts_v2', 'fix_customer_ledger_opening_bal_v5'];

console.log(`Auditing settings flags in: ${dbPath}`);
const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${targetKeys.map(() => '?').join(',')})`).all(...targetKeys);

console.log('Found flags:');
targetKeys.forEach(k => {
  const row = rows.find(r => r.key === k);
  if (row) {
    console.log(`  ✓ ${k} = "${row.value}"`);
  } else {
    console.log(`  ⚠️ ${k} is MISSING`);
  }
});

db.close();
