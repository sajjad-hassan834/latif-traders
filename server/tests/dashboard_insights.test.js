const assert = require('assert');
const { db } = require('../config/database');
const reportController = require('../controllers/reportController');

async function runDashboardInsightsTest() {
  console.log('========================================================================');
  console.log('PHASE 2: DASHBOARD INSIGHTS AUDIT & PARITY TEST');
  console.log('========================================================================\n');

  // Find an active tenant with sales in the database
  const tenantRow = await db.get("SELECT tenant_id FROM sales LIMIT 1") ||
                    await db.get("SELECT id as tenant_id FROM tenants LIMIT 1");
  const tenantId = tenantRow?.tenant_id || 't_shoper_0a129e';

  console.log(`Using Tenant ID: ${tenantId}`);

  // 1. Fetch from existing /dashboard endpoint
  let dashboardRes = null;
  const mockReqDash = {
    tenantId,
    tenant_id: tenantId,
    user: { role: 'admin', tenant_id: tenantId }
  };
  const mockResDash = {
    json: (d) => { dashboardRes = d; return mockResDash; },
    status: () => mockResDash
  };

  await reportController.getDashboardMetrics(mockReqDash, mockResDash);
  assert(dashboardRes && dashboardRes.success, 'getDashboardMetrics must succeed');
  const dMetrics = dashboardRes.data;

  // 2. Fetch from new /dashboard/insights endpoint (Admin role)
  let insightsAdminRes = null;
  const mockReqInsightsAdmin = {
    tenantId,
    tenant_id: tenantId,
    query: { period: 'today' },
    user: { role: 'admin', tenant_id: tenantId }
  };
  const mockResInsightsAdmin = {
    json: (d) => { insightsAdminRes = d; return mockResInsightsAdmin; },
    status: () => mockResInsightsAdmin
  };

  await reportController.getDashboardInsights(mockReqInsightsAdmin, mockResInsightsAdmin);
  assert(insightsAdminRes && insightsAdminRes.success, 'getDashboardInsights (Admin) must succeed');
  const insData = insightsAdminRes.data;

  // 3. Parity Assertions
  console.log('--- Checking KPI Parity between /dashboard and /dashboard/insights ---');
  console.log(`  Sales Total:      Dashboard = ${dMetrics.today_sales} | Insights = ${insData.kpi.sales.total}`);
  assert.strictEqual(Number(insData.kpi.sales.total), Number(dMetrics.today_sales), 'Sales total must match');

  console.log(`  Invoices Count:   Dashboard = ${dMetrics.today_invoices} | Insights = ${insData.kpi.sales.invoice_count}`);
  assert.strictEqual(Number(insData.kpi.sales.invoice_count), Number(dMetrics.today_invoices), 'Invoices count must match');

  console.log(`  Receivables:      Dashboard = ${dMetrics.total_receivables} | Insights = ${insData.kpi.receivables.total}`);
  assert.strictEqual(Number(insData.kpi.receivables.total), Number(dMetrics.total_receivables), 'Receivables must match');

  console.log(`  Payables (Admin): Dashboard = ${dMetrics.total_payables} | Insights = ${insData.kpi.payables.total}`);
  assert.strictEqual(Number(insData.kpi.payables.total), Number(dMetrics.total_payables), 'Payables must match');

  console.log(`  Low Stock Count:  Dashboard = ${dMetrics.low_stock_count} | Insights = ${insData.kpi.stock.low_stock_count}`);
  assert.strictEqual(Number(insData.kpi.stock.low_stock_count), Number(dMetrics.low_stock_count), 'Low stock count must match');

  // 4. Role Scoping Test (Sales role)
  console.log('\n--- Checking Role Scoping (Sales Role Restriction) ---');
  let insightsSalesRes = null;
  const mockReqInsightsSales = {
    tenantId,
    tenant_id: tenantId,
    query: { period: 'today' },
    user: { role: 'sales', tenant_id: tenantId }
  };
  const mockResInsightsSales = {
    json: (d) => { insightsSalesRes = d; return mockResInsightsSales; },
    status: () => mockResInsightsSales
  };

  await reportController.getDashboardInsights(mockReqInsightsSales, mockResInsightsSales);
  assert(insightsSalesRes && insightsSalesRes.success, 'getDashboardInsights (Sales) must succeed');
  const salesData = insightsSalesRes.data;

  assert.strictEqual(salesData.kpi.payables.total, 0, 'Sales role must not see payables total');
  assert.strictEqual(salesData.kpi.payables.is_restricted, true, 'Sales role must be marked as restricted for payables');
  console.log('  ✓ Sales role restricted payables successfully masked to 0');

  // 5. Check Donuts & Grouped Bar
  console.log('\n--- Checking Analytic Structure (Donuts & Grouped Bar) ---');
  assert(Array.isArray(insData.donuts.sales_by_payment.items), 'sales_by_payment items must be array');
  assert(Array.isArray(insData.donuts.stock_by_category.items), 'stock_by_category items must be array');
  assert(Array.isArray(insData.grouped_bar.months), 'grouped_bar months must be array of 6 months');
  assert.strictEqual(insData.grouped_bar.months.length, 6, 'grouped_bar months must have 6 entries');
  console.log('  ✓ Donut arrays and 6-month grouped bar structures validated');

  // 6. Check Periods (7d, 30d, custom)
  console.log('\n--- Checking Period Parameters ---');
  for (const period of ['7d', '30d', 'custom']) {
    let pRes = null;
    const reqP = {
      tenantId,
      tenant_id: tenantId,
      query: { period, start_date: '2026-10-01', end_date: '2026-10-31' },
      user: { role: 'admin', tenant_id: tenantId }
    };
    const resP = {
      json: (d) => { pRes = d; return resP; },
      status: () => resP
    };
    await reportController.getDashboardInsights(reqP, resP);
    assert(pRes && pRes.success, `Period ${period} must return success`);
    console.log(`  ✓ Period [${period}]: Start=${pRes.data.startDate}, End=${pRes.data.endDate}`);
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL DASHBOARD INSIGHTS PARITY & SECURITY TESTS PASSED!');
  console.log('========================================================================');
}

if (require.main === module) {
  runDashboardInsightsTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test Failed:', err);
      process.exit(1);
    });
}

module.exports = { runDashboardInsightsTest };
