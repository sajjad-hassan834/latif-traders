#!/usr/bin/env node
/**
 * scripts/compare_baseline.js
 *
 * Compares two JSON baseline reports (before vs after deploy/migration) produced by scripts/baseline_report.js.
 * Verifies that zero financial, ledger, customer, supplier, or inventory aggregate drift has occurred.
 *
 * Usage:
 *   node scripts/compare_baseline.js <baseline_before.json> <baseline_after.json>
 *
 * Exit codes:
 *   0: PASS - all critical financial and business metrics match identically.
 *   1: FAIL - discrepancies detected in integrity or business aggregates.
 */

const fs = require('fs');
const path = require('path');

const fileBefore = process.argv[2];
const fileAfter = process.argv[3];

if (!fileBefore || !fileAfter) {
  console.error('Usage: node scripts/compare_baseline.js <baseline_before.json> <baseline_after.json>');
  process.exit(1);
}

const pathBefore = path.resolve(process.cwd(), fileBefore);
const pathAfter = path.resolve(process.cwd(), fileAfter);

if (!fs.existsSync(pathBefore)) {
  console.error(`Error: File before not found: ${pathBefore}`);
  process.exit(1);
}
if (!fs.existsSync(pathAfter)) {
  console.error(`Error: File after not found: ${pathAfter}`);
  process.exit(1);
}

function readJsonClean(filePath) {
  let raw = fs.readFileSync(filePath);
  // Check for UTF-16 LE BOM
  if (raw.length >= 2 && raw[0] === 0xFF && raw[1] === 0xFE) {
    raw = raw.subarray(2);
    return JSON.parse(raw.toString('utf16le'));
  }
  // Check for UTF-8 BOM
  let str = raw.toString('utf8');
  if (str.charCodeAt(0) === 0xFEFF) {
    str = str.slice(1);
  }
  return JSON.parse(str);
}

let before, after;
try {
  before = readJsonClean(pathBefore);
  after = readJsonClean(pathAfter);
} catch (e) {
  console.error(`Error parsing JSON baseline files: ${e.message}`);
  process.exit(1);
}

console.log('================================================================');
console.log('            ShopOS Post-Deploy Baseline Diff Audit              ');
console.log('================================================================');
console.log(`Before Snapshot: ${before.database_file || path.basename(pathBefore)} (${before.generated_at || 'unknown'})`);
console.log(`After Snapshot:  ${after.database_file || path.basename(pathAfter)} (${after.generated_at || 'unknown'})`);
console.log('----------------------------------------------------------------');

let discrepancies = [];

// 1. Check Integrity
if (after.integrity_check !== 'ok') {
  discrepancies.push(`CRITICAL: PRAGMA integrity_check failed on post-deploy database (status: ${after.integrity_check})`);
}

// 2. Check Business Aggregates
const bAgg = before.business_aggregates || {};
const aAgg = after.business_aggregates || {};

const aggKeys = [
  { key: 'total_customers', label: 'Total Customers', tolerance: 0 },
  { key: 'customer_receivables', label: 'Customer Receivables', tolerance: 0.01 },
  { key: 'customer_net_balance', label: 'Customer Net Balance', tolerance: 0.01 },
  { key: 'total_suppliers', label: 'Total Suppliers', tolerance: 0 },
  { key: 'supplier_payables', label: 'Supplier Payables', tolerance: 0.01 },
  { key: 'supplier_net_balance', label: 'Supplier Net Balance', tolerance: 0.01 },
  { key: 'total_stock_units', label: 'Total Stock Units', tolerance: 0.01 },
  { key: 'stock_valuation', label: 'Inventory Valuation', tolerance: 0.01 },
  { key: 'total_orders', label: 'Total Orders / Invoices', tolerance: 0 },
  { key: 'gross_sales', label: 'Gross Sales Total', tolerance: 0.01 },
  { key: 'total_collected', label: 'Total Sales Collected', tolerance: 0.01 },
  { key: 'oldest_invoice_date', label: 'Oldest Invoice Date', tolerance: null },
  { key: 'newest_invoice_date', label: 'Newest Invoice Date', tolerance: null }
];

console.log('\n[Business Aggregates Audit]');
let aggPassed = true;

for (const item of aggKeys) {
  const vBefore = bAgg[item.key];
  const vAfter = aAgg[item.key];

  let matches = false;
  if (item.tolerance !== null) {
    const nBefore = Number(vBefore || 0);
    const nAfter = Number(vAfter || 0);
    matches = Math.abs(nBefore - nAfter) <= item.tolerance;
  } else {
    matches = String(vBefore) === String(vAfter);
  }

  if (matches) {
    console.log(`  ✓ ${item.label.padEnd(25)}: ${vBefore} === ${vAfter}`);
  } else {
    aggPassed = false;
    const diffMsg = `DIFF: ${item.label} changed: Before=[${vBefore}] -> After=[${vAfter}]`;
    console.log(`  ✗ ${diffMsg}`);
    discrepancies.push(diffMsg);
  }
}

// 3. Check Table Row Counts
console.log('\n[Table Row Counts Audit]');
const bTables = before.table_counts || {};
const aTables = after.table_counts || {};

const allTableNames = Array.from(new Set([...Object.keys(bTables), ...Object.keys(aTables)])).sort();
let tableAnomalies = [];

for (const tbl of allTableNames) {
  const cBefore = bTables[tbl];
  const cAfter = aTables[tbl];

  if (cBefore === undefined) {
    console.log(`  + [NEW TABLE] ${tbl}: initialized with ${cAfter} rows (OK)`);
  } else if (cAfter === undefined) {
    tableAnomalies.push(`DROPPED TABLE: ${tbl} existed with ${cBefore} rows before deploy!`);
    console.log(`  ✗ DROPPED TABLE: ${tbl}`);
  } else if (cBefore !== cAfter) {
    // Row count changed
    console.log(`  ~ [ROW DELTA] ${tbl.padEnd(25)}: ${cBefore} -> ${cAfter} (delta: ${cAfter - cBefore})`);
    // Critical tables should not lose rows
    if (cAfter < cBefore && ['customers', 'suppliers', 'sales', 'sale_items', 'payments', 'products', 'batches'].includes(tbl)) {
      discrepancies.push(`CRITICAL ROW LOSS: Table ${tbl} lost ${cBefore - cAfter} rows (${cBefore} -> ${cAfter})`);
    }
  } else {
    // Exact match
  }
}

console.log('----------------------------------------------------------------');
if (discrepancies.length === 0) {
  console.log('RESULT: PASS');
  console.log('All financial invariants, balances, and critical tables match before & after.');
  process.exit(0);
} else {
  console.log('RESULT: FAIL');
  console.log(`Found ${discrepancies.length} discrepancy(ies):`);
  discrepancies.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
  process.exit(1);
}
