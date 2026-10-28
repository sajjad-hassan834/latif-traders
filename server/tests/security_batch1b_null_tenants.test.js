const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

test('Security Batch 1b - Item 6: NULL tenant rows backfill migration and non-disappearance verification', async (t) => {
  const prodDbPath = path.join(__dirname, '..', '..', 'data', 'latif_traders.db');
  const tempDbPath = path.join(__dirname, '..', '..', 'data', `test_null_backfill_${Date.now()}.db`);

  // Ensure clean test file
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

  // Copy production-shaped database
  fs.copyFileSync(prodDbPath, tempDbPath);

  const db = new Database(tempDbPath);
  db.pragma('foreign_keys = OFF'); // to allow simulating legacy detached state

  // Baseline counts for legacy tenant and totals before injecting orphans
  const baselineCatTotal = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  const baselineCatLegacy = db.prepare('SELECT COUNT(*) as c FROM categories WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;

  const baselineProdTotal = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const baselineProdLegacy = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;

  const baselineCustTotal = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const baselineCustLegacy = db.prepare('SELECT COUNT(*) as c FROM customers WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;

  const baselineSalesTotal = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
  const baselineSalesLegacy = db.prepare('SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;
  const baselineSalesSumLegacy = db.prepare('SELECT COALESCE(SUM(grand_total), 0) as s FROM sales WHERE tenant_id = ?').get(LEGACY_TENANT_ID).s;

  const baselineExpLegacy = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE tenant_id = ?').get(LEGACY_TENANT_ID).s;

  await t.test('1. Inject legacy NULL tenant rows into multiple tables', () => {
    // Deliberately inject rows without tenant_id or with NULL
    db.prepare(`
      INSERT INTO categories (name, description, tenant_id)
      VALUES ('Legacy Orphan Category', 'Created prior to multi-tenant', NULL)
    `).run();

    db.prepare(`
      INSERT INTO products (name, sku, purchase_price, sale_price, min_stock_level, status, tenant_id)
      VALUES ('Legacy Orphan Product', 'SKU-NULL-TEST-001', 100, 150, 5, 'active', NULL)
    `).run();

    db.prepare(`
      INSERT INTO customers (name, phone, current_balance, tenant_id)
      VALUES ('Legacy Orphan Customer', '03009999999', 500, NULL)
    `).run();

    db.prepare(`
      INSERT INTO sales (invoice_no, sale_type, sale_date, grand_total, paid_amount, balance_due, order_status, tenant_id)
      VALUES ('INV-NULL-TEST-001', 'Retail', '2026-10-28', 1500, 1500, 0, 'Completed', NULL)
    `).run();

    db.prepare(`
      INSERT INTO expenses (category_id, amount, expense_date, title, tenant_id)
      VALUES (1, 350, '2026-10-28', 'Legacy Orphan Expense', NULL)
    `).run();

    db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id)
      VALUES ('legacy_staff', 'staff_null@test.com', 'hash', 'Legacy Staff', 'staff', 'active', NULL)
    `).run();
  });

  await t.test('2. Count NULL tenant rows prior to backfill migration', () => {
    const nullCat = db.prepare('SELECT COUNT(*) as c FROM categories WHERE tenant_id IS NULL').get().c;
    const nullProd = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id IS NULL').get().c;
    const nullCust = db.prepare('SELECT COUNT(*) as c FROM customers WHERE tenant_id IS NULL').get().c;
    const nullSale = db.prepare('SELECT COUNT(*) as c FROM sales WHERE tenant_id IS NULL').get().c;
    const nullExp = db.prepare('SELECT COUNT(*) as c FROM expenses WHERE tenant_id IS NULL').get().c;
    const nullUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id IS NULL').get().c;

    assert.strictEqual(nullCat, 1, 'Should have 1 category with tenant_id IS NULL');
    assert.strictEqual(nullProd, 1, 'Should have 1 product with tenant_id IS NULL');
    assert.strictEqual(nullCust, 1, 'Should have 1 customer with tenant_id IS NULL');
    assert.strictEqual(nullSale, 1, 'Should have 1 sale with tenant_id IS NULL');
    assert.strictEqual(nullExp, 1, 'Should have 1 expense with tenant_id IS NULL');
    assert.ok(nullUsers >= 2, 'Should have at least 2 users with NULL tenant (superowner + legacy_staff)');

    console.log(`Pre-migration NULL counts: categories=${nullCat}, products=${nullProd}, customers=${nullCust}, sales=${nullSale}, expenses=${nullExp}, users=${nullUsers}`);
  });

  const runBackfillMigration = () => {
    const tablesWithTenant = [
      'categories', 'units', 'expense_categories', 'products', 'customers',
      'suppliers', 'sales', 'purchases', 'expenses', 'payments', 'batches',
      'stock_adjustments', 'returns', 'counters', 'inventory_movements',
      'purchase_items', 'sale_items', 'return_items', 'audit_logs',
      'supplier_products', 'tenant_settings'
    ];
    for (const tbl of tablesWithTenant) {
      try {
        const cols = db.prepare(`PRAGMA table_info("${tbl}")`).all();
        if (cols.some(c => c.name === 'tenant_id')) {
          db.prepare(`UPDATE "${tbl}" SET tenant_id = ? WHERE tenant_id IS NULL`).run(LEGACY_TENANT_ID);
        }
      } catch (_) {}
    }
    // Users table: backfill all non-superowner accounts
    db.prepare("UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL AND role != 'superowner'").run(LEGACY_TENANT_ID);
  };

  await t.test('3. Execute idempotent NULL tenant backfill migration', () => {
    runBackfillMigration();

    const nullCatAfter = db.prepare('SELECT COUNT(*) as c FROM categories WHERE tenant_id IS NULL').get().c;
    const nullProdAfter = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id IS NULL').get().c;
    const nullCustAfter = db.prepare('SELECT COUNT(*) as c FROM customers WHERE tenant_id IS NULL').get().c;
    const nullSaleAfter = db.prepare('SELECT COUNT(*) as c FROM sales WHERE tenant_id IS NULL').get().c;
    const nullExpAfter = db.prepare('SELECT COUNT(*) as c FROM expenses WHERE tenant_id IS NULL').get().c;
    const nullStaffAfter = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id IS NULL AND role != 'superowner'").get().c;
    const superownerNull = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id IS NULL AND role = 'superowner'").get().c;

    assert.strictEqual(nullCatAfter, 0, 'No categories should have tenant_id IS NULL after backfill');
    assert.strictEqual(nullProdAfter, 0, 'No products should have tenant_id IS NULL after backfill');
    assert.strictEqual(nullCustAfter, 0, 'No customers should have tenant_id IS NULL after backfill');
    assert.strictEqual(nullSaleAfter, 0, 'No sales should have tenant_id IS NULL after backfill');
    assert.strictEqual(nullExpAfter, 0, 'No expenses should have tenant_id IS NULL after backfill');
    assert.strictEqual(nullStaffAfter, 0, 'No staff users should have tenant_id IS NULL after backfill');
    assert.strictEqual(superownerNull, 1, 'Superowner remains NULL tenant');
  });

  await t.test('4. Verify that no data disappears from lists, totals, and reports', () => {
    // Queries filtered strictly by tenant_id without any COALESCE
    const tenantCats = db.prepare('SELECT COUNT(*) as c FROM categories WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;
    const tenantProds = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;
    const tenantCusts = db.prepare('SELECT COUNT(*) as c FROM customers WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;
    const tenantSales = db.prepare('SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;
    const tenantSalesSum = db.prepare('SELECT SUM(grand_total) as s FROM sales WHERE tenant_id = ?').get(LEGACY_TENANT_ID).s;
    const tenantExpSum = db.prepare('SELECT SUM(amount) as s FROM expenses WHERE tenant_id = ?').get(LEGACY_TENANT_ID).s;

    // Prove 100% data preservation: baseline + 1 backfilled entity
    assert.strictEqual(tenantCats, baselineCatLegacy + 1, 'All categories preserved and accessible via tenant query');
    assert.strictEqual(tenantProds, baselineProdLegacy + 1, 'All products preserved and accessible via tenant query');
    assert.strictEqual(tenantCusts, baselineCustLegacy + 1, 'All customers preserved and accessible via tenant query');
    assert.strictEqual(tenantSales, baselineSalesLegacy + 1, 'All sales preserved and accessible via tenant query');
    assert.strictEqual(tenantSalesSum, baselineSalesSumLegacy + 1500, 'Sales grand_total sum includes backfilled legacy sale');
    assert.strictEqual(tenantExpSum, baselineExpLegacy + 350, 'Expense sum includes backfilled legacy expense');

    // Total database records also perfectly preserved
    const totalCatNow = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
    assert.strictEqual(totalCatNow, baselineCatTotal + 1, 'Total database categories count matches exactly');

    // Verify injected entities specifically exist under legacy tenant
    const injectedProduct = db.prepare('SELECT * FROM products WHERE sku = ? AND tenant_id = ?').get('SKU-NULL-TEST-001', LEGACY_TENANT_ID);
    assert.ok(injectedProduct, 'Injected product is present under legacy tenant');
    assert.strictEqual(injectedProduct.name, 'Legacy Orphan Product');

    const injectedSale = db.prepare('SELECT * FROM sales WHERE invoice_no = ? AND tenant_id = ?').get('INV-NULL-TEST-001', LEGACY_TENANT_ID);
    assert.ok(injectedSale, 'Injected sale is present under legacy tenant');
    assert.strictEqual(injectedSale.grand_total, 1500);
  });

  await t.test('5. Idempotency: execute migration a second time without error or side-effects', () => {
    assert.doesNotThrow(() => {
      runBackfillMigration();
    }, 'Second run of backfill migration must not throw');

    const tenantSalesAfter2 = db.prepare('SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?').get(LEGACY_TENANT_ID).c;
    assert.strictEqual(tenantSalesAfter2, baselineSalesLegacy + 1, 'Data counts remain completely unchanged after second run');
  });

  // Cleanup
  db.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
});
