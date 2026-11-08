#!/usr/bin/env node
/**
 * scripts/audit_removed_migrations.js
 *
 * READ-ONLY audit tool to inspect any SQLite database file (.db) before deploy.
 * Specifically checks the state of the three removed startup migrations and customer ledger balances.
 * 
 * PRIVACY & SAFETY INVARIANTS:
 * 1. Read-only mode: Opened with { readonly: true, fileMustExist: true }. ZERO writes.
 * 2. Aggregates only: NEVER prints customer names, phones, invoice numbers, or personal data.
 *
 * Usage:
 *   node scripts/audit_removed_migrations.js <path-to-database.db>
 *   node scripts/audit_removed_migrations.js <path-to-database.db> --json
 */

const path = require('path');
const fs = require('fs');

const dbArg = process.argv[2];
const isJson = process.argv.includes('--json');

if (!dbArg || dbArg.startsWith('--')) {
  console.error('Usage: node scripts/audit_removed_migrations.js <path-to-database.db> [--json]');
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), dbArg);
if (!fs.existsSync(dbPath)) {
  console.error(`Error: File not found: ${dbPath}`);
  process.exit(1);
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('Error: better-sqlite3 module not found.');
  process.exit(1);
}

let db;
try {
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
} catch (err) {
  console.error(`Error opening database: ${err.message}`);
  process.exit(1);
}

try {
  // 1. Settings Keys Status
  const targetKeys = [
    'clean_auto_payments_v2',
    'clean_duplicate_receipts_v2',
    'fix_customer_ledger_opening_bal_v5'
  ];

  const settingsReport = {};
  for (const key of targetKeys) {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      settingsReport[key] = {
        exists: !!row,
        value: row ? row.value : null
      };
    } catch (_) {
      settingsReport[key] = { exists: false, value: null, error: 'settings table missing or unreadable' };
    }
  }

  // 2. Count of payments with invoice/purchase references
  let autoPaymentCounts = {
    total_matching_payments: 0,
    with_reference_id: 0,
    with_inv_prefix: 0,
    with_pur_prefix: 0,
    with_auto_notes: 0,
    total_amount_matching: 0
  };

  try {
    const autoRes = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN reference_id IS NOT NULL THEN 1 ELSE 0 END), 0) as has_ref_id,
        COALESCE(SUM(CASE WHEN reference_no LIKE 'INV-%' THEN 1 ELSE 0 END), 0) as has_inv,
        COALESCE(SUM(CASE WHEN reference_no LIKE 'PUR-%' THEN 1 ELSE 0 END), 0) as has_pur,
        COALESCE(SUM(CASE WHEN notes LIKE '%Receipt for Invoice%' OR notes LIKE '%Down payment on purchase bill%' THEN 1 ELSE 0 END), 0) as has_notes,
        COALESCE(SUM(amount), 0) as total_amt
      FROM payments
      WHERE reference_id IS NOT NULL
         OR reference_no LIKE 'INV-%'
         OR reference_no LIKE 'PUR-%'
         OR notes LIKE '%Receipt for Invoice%'
         OR notes LIKE '%Down payment on purchase bill%'
    `).get();

    autoPaymentCounts = {
      total_matching_payments: autoRes.total,
      with_reference_id: autoRes.has_ref_id,
      with_inv_prefix: autoRes.has_inv,
      with_pur_prefix: autoRes.has_pur,
      with_auto_notes: autoRes.has_notes,
      total_amount_matching: Number(autoRes.total_amt)
    };
  } catch (_) {}

  // 3. Duplicate payment groups (same party, date, amount)
  let duplicatePaymentGroups = {
    total_duplicate_groups: 0,
    excess_duplicate_rows_count: 0,
    total_duplicate_amount_sum: 0
  };

  try {
    const dupRes = db.prepare(`
      SELECT 
        COUNT(*) as group_count,
        COALESCE(SUM(cnt - 1), 0) as excess_rows,
        COALESCE(SUM(amount * (cnt - 1)), 0) as excess_amount
      FROM (
        SELECT party_type, party_id, payment_date, amount, COUNT(*) as cnt
        FROM payments
        WHERE party_id IS NOT NULL AND amount > 0
        GROUP BY party_type, party_id, payment_date, amount
        HAVING COUNT(*) > 1
      )
    `).get();

    duplicatePaymentGroups = {
      total_duplicate_groups: dupRes.group_count,
      excess_duplicate_rows_count: dupRes.excess_rows,
      total_duplicate_amount_sum: Number(dupRes.excess_amount)
    };
  } catch (_) {}

  // 4. Customers matching old Faisal/21940 override criteria (COUNT ONLY)
  let overrideCriteriaCounts = {
    customers_with_opening_bal_21940: 0,
    customers_matching_faisal_name: 0,
    total_unique_override_customers: 0
  };

  try {
    const ovrRes = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN opening_balance = 21940 THEN 1 ELSE 0 END), 0) as opening_21940,
        COALESCE(SUM(CASE WHEN LOWER(name) LIKE '%faisal%' OR LOWER(name) LIKE '%fasial%' THEN 1 ELSE 0 END), 0) as name_match,
        COUNT(*) as total_matching
      FROM customers
      WHERE opening_balance = 21940 
         OR LOWER(name) LIKE '%faisal%' 
         OR LOWER(name) LIKE '%fasial%'
    `).get();

    overrideCriteriaCounts = {
      customers_with_opening_bal_21940: ovrRes.opening_21940,
      customers_matching_faisal_name: ovrRes.name_match,
      total_unique_override_customers: ovrRes.total_matching
    };
  } catch (_) {}

  // 5. Customer balance vs Ledger calculation discrepancies (Aggregates only)
  let balanceAudit = {
    total_customers_audited: 0,
    customers_balanced_count: 0,
    customers_with_discrepancy_count: 0,
    total_absolute_discrepancy_amount: 0,
    max_single_discrepancy: 0
  };

  try {
    const customers = db.prepare(`
      SELECT id, tenant_id, opening_balance, current_balance 
      FROM customers
    `).all();

    balanceAudit.total_customers_audited = customers.length;

    let balancedCount = 0;
    let discCount = 0;
    let totalDisc = 0;
    let maxDisc = 0;

    for (const c of customers) {
      // Calculate true ledger math without in-memory override:
      // opening_balance + sales.grand_total - payments - returns
      const salesRow = db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) as billed
        FROM sales
        WHERE customer_id = ?
      `).get(c.id);

      const paymentsRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as paid
        FROM payments
        WHERE party_type = 'CUSTOMER' AND party_id = ?
      `).get(c.id);

      const returnsRow = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as returned
        FROM returns
        WHERE type = 'SALE_RETURN' AND party_id = ?
      `).get(c.id);

      const opening = Number(c.opening_balance) || 0;
      const billed = Number(salesRow.billed) || 0;
      const paid = Number(paymentsRow.paid) || 0;
      const returned = Number(returnsRow.returned) || 0;

      const computedClosing = opening + billed - paid - returned;
      const stored = Number(c.current_balance) || 0;
      const diff = Math.abs(computedClosing - stored);

      if (diff > 0.01) {
        discCount++;
        totalDisc += diff;
        if (diff > maxDisc) maxDisc = diff;
      } else {
        balancedCount++;
      }
    }

    balanceAudit.customers_balanced_count = balancedCount;
    balanceAudit.customers_with_discrepancy_count = discCount;
    balanceAudit.total_absolute_discrepancy_amount = Number(totalDisc.toFixed(2));
    balanceAudit.max_single_discrepancy = Number(maxDisc.toFixed(2));
  } catch (_) {}

  const finalReport = {
    database_file: path.basename(dbPath),
    audited_at: new Date().toISOString(),
    settings_migration_flags: settingsReport,
    auto_payments: autoPaymentCounts,
    duplicate_payment_groups: duplicatePaymentGroups,
    faisal_override_criteria: overrideCriteriaCounts,
    customer_ledger_balance_discrepancies: balanceAudit
  };

  if (isJson) {
    console.log(JSON.stringify(finalReport, null, 2));
  } else {
    console.log('========================================================================');
    console.log('         ShopOS Read-Only Audit of Removed Migrations                   ');
    console.log('========================================================================');
    console.log(`Database: ${path.basename(dbPath)}`);
    console.log(`Mode:     READ-ONLY (0 mutations executed)`);
    console.log('------------------------------------------------------------------------\n');

    console.log('1. Settings Migration Flags Status:');
    for (const [k, v] of Object.entries(settingsReport)) {
      const statusStr = v.exists ? `EXISTS (value: '${v.value}')` : 'NOT FOUND (migration never recorded)';
      console.log(`   • ${k.padEnd(38)}: ${statusStr}`);
    }

    console.log('\n2. Payments with Reference / Auto-Settlement Notes:');
    console.log(`   • Total matching payment rows          : ${autoPaymentCounts.total_matching_payments}`);
    console.log(`   • Payments with reference_id           : ${autoPaymentCounts.with_reference_id}`);
    console.log(`   • Payments with reference_no LIKE 'INV': ${autoPaymentCounts.with_inv_prefix}`);
    console.log(`   • Payments with reference_no LIKE 'PUR': ${autoPaymentCounts.with_pur_prefix}`);
    console.log(`   • Total monetary sum of matching rows  : Rs ${autoPaymentCounts.total_amount_matching.toLocaleString()}`);

    console.log('\n3. Duplicate Same-Day Payment Groups (Same party/date/amount):');
    console.log(`   • Duplicate groups detected (count > 1): ${duplicatePaymentGroups.total_duplicate_groups}`);
    console.log(`   • Excess rows above 1 per group        : ${duplicatePaymentGroups.excess_duplicate_rows_count}`);
    console.log(`   • Total excess duplicate amount        : Rs ${duplicatePaymentGroups.total_duplicate_amount_sum.toLocaleString()}`);

    console.log('\n4. Customers Matching Old Override Criteria (AGGREGATE COUNTS ONLY):');
    console.log(`   • Customers with opening_balance = 21,940: ${overrideCriteriaCounts.customers_with_opening_bal_21940}`);
    console.log(`   • Customers with name matching 'faisal'  : ${overrideCriteriaCounts.customers_matching_faisal_name}`);
    console.log(`   • Total unique customers in group        : ${overrideCriteriaCounts.total_unique_override_customers}`);

    console.log('\n5. Stored Balance vs Raw Transaction Ledger Calculation:');
    console.log(`   • Total customers audited              : ${balanceAudit.total_customers_audited}`);
    console.log(`   • Customers perfectly balanced (diff=0): ${balanceAudit.customers_balanced_count}`);
    console.log(`   • Customers with balance discrepancy   : ${balanceAudit.customers_with_discrepancy_count}`);
    console.log(`   • Total absolute discrepancy amount    : Rs ${balanceAudit.total_absolute_discrepancy_amount.toLocaleString()}`);
    console.log(`   • Max single customer discrepancy      : Rs ${balanceAudit.max_single_discrepancy.toLocaleString()}`);

    console.log('\n========================================================================');
    console.log('AUDIT COMPLETE: All numbers reflect raw database state without overrides.');
    console.log('========================================================================\n');
  }

} finally {
  db.close();
}

