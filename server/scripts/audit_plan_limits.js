#!/usr/bin/env node
/**
 * ShoppyOS Plan Limits Tenant Audit Script (READ-ONLY)
 *
 * Scans all tenants in the database and lists tenant IDs whose current usage
 * exceeds the limits of their assigned subscription plan (Free / Pro / Enterprise).
 *
 * Output: Tenant IDs only with exceeded resource indicators.
 * Safe to run against live snapshots (zero writes, read-only queries only).
 */

require('dotenv').config();
const { db } = require('../config/database');
const { getPlanLimits } = require('../config/plans');

function getKarachiCurrentMonth() {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000); // PKT = UTC+5
  return d.toISOString().slice(0, 7);
}

async function runPlanAudit() {
  console.log('======================================================');
  console.log('   ShoppyOS Tenant Plan Limits Usage Audit (Read-Only)');
  console.log('======================================================\n');

  const currentMonth = getKarachiCurrentMonth();
  console.log(`Auditing active Karachi billing month: ${currentMonth}\n`);

  const tenants = await db.all('SELECT id, business_name, plan FROM tenants ORDER BY id ASC');
  const exceedingTenants = [];
  const compliantTenants = [];

  for (const t of tenants) {
    const planId = (t.plan || 'free').toLowerCase();
    const limits = getPlanLimits(planId);

    // 1. Product count
    const prodRow = await db.get('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [t.id]);
    const productCount = Number(prodRow?.count || 0);

    // 2. Invoice count this Karachi month
    const invRow = await db.get(
      'SELECT COUNT(*) as count FROM sales WHERE tenant_id = ? AND CAST(sale_date AS TEXT) LIKE ?',
      [t.id, `${currentMonth}%`]
    );
    const invoiceCount = Number(invRow?.count || 0);

    // 3. User count (active non-system staff accounts)
    const userRow = await db.get(
      "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'",
      [t.id]
    );
    const userCount = Number(userRow?.count || 0);

    const violations = [];
    if (limits.products !== null && productCount > limits.products) {
      violations.push(`products (${productCount} > limit ${limits.products})`);
    }
    if (limits.invoicesPerMonth !== null && invoiceCount > limits.invoicesPerMonth) {
      violations.push(`monthly_invoices (${invoiceCount} > limit ${limits.invoicesPerMonth})`);
    }
    if (limits.users !== null && userCount > limits.users) {
      violations.push(`users (${userCount} > limit ${limits.users})`);
    }

    if (violations.length > 0) {
      exceedingTenants.push({
        id: t.id,
        plan: planId,
        violations
      });
    } else {
      compliantTenants.push({
        id: t.id,
        plan: planId,
        productCount,
        invoiceCount,
        userCount
      });
    }
  }

  console.log(`Total Tenants Audited: ${tenants.length}`);
  console.log(`Compliant Tenants:     ${compliantTenants.length}`);
  console.log(`Exceeding Tenants:     ${exceedingTenants.length}\n`);

  if (exceedingTenants.length > 0) {
    console.log('--- TENANTS EXCEEDING PLAN LIMITS (TENANT IDS ONLY) ---');
    for (const item of exceedingTenants) {
      console.log(`Tenant ID: ${item.id} [Plan: ${item.plan}] -> Exceeded: ${item.violations.join(', ')}`);
    }
    console.log('\nNOTE: Grandfathering policy preserves existing data and normal sales on existing catalog.');
    console.log('Only creating NEW products, invoices, or users beyond the plan threshold is blocked.\n');
  } else {
    console.log('✅ All tenants currently within their assigned plan limits.');
  }

  console.log('======================================================\n');
  return { exceeding: exceedingTenants.map(e => e.id), total: tenants.length };
}

if (require.main === module) {
  runPlanAudit().then(() => process.exit(0)).catch(err => {
    console.error('Plan audit error:', err);
    process.exit(1);
  });
}

module.exports = { runPlanAudit };
