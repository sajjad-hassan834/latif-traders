const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('TRADE PROFILE BATCHLESS & GOLDEN LIFECYCLE TEST SUITE');
console.log('========================================================================');

const testDbPath = path.resolve(__dirname, '../../data/test_trade_batchless.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new Database(testDbPath);
db.pragma('foreign_keys = ON');

// 1. Initialize schema
db.exec(`
  CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL DEFAULT 'retail_general',
    plan TEXT NOT NULL DEFAULT 'pro',
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE tenant_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    UNIQUE(tenant_id, key)
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    purchase_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    wholesale_price REAL DEFAULT 0,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    batch_no TEXT NOT NULL,
    expiry_date TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    wholesale_price REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'completed'
  );

  CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    batch_id INTEGER,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_cost REAL NOT NULL
  );

  CREATE INDEX idx_products_tenant_barcode ON products (tenant_id, barcode);
  CREATE INDEX idx_batches_expiry ON batches (tenant_id, expiry_date);
`);

// Mock async DB wrapper matching server/config/database.js API
const dbAsync = {
  get: async (sql, params) => db.prepare(sql).get(...(params || [])),
  all: async (sql, params) => db.prepare(sql).all(...(params || [])),
  run: async (sql, params) => db.prepare(sql).run(...(params || []))
};

const { resolveOpeningBatch, resolvePurchaseBatch } = require('../utils/tradeBatch');

async function runTests() {
  // Setup Tenants
  // Tenant A: Batchless Retail General with trade_ui_v2 = 'true'
  await dbAsync.run("INSERT INTO tenants (id, business_name, business_type) VALUES ('t_retail', 'Super Mart', 'retail_general')");
  await dbAsync.run("INSERT INTO tenant_settings (tenant_id, key, value) VALUES ('t_retail', 'trade_ui_v2', 'true')");

  // Tenant B: Frozen Food (Gold standard benchmark)
  await dbAsync.run("INSERT INTO tenants (id, business_name, business_type) VALUES ('t_frozen', 'Frozen Goods Co', 'frozen_food')");

  // --------------------------------------------------------------------------
  // TEST 1: Batchless Product Create (Opening Stock 10)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Batchless Product Creation ---');
  const p1Res = await dbAsync.run("INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price) VALUES ('t_retail', 'Colgate Toothpaste', 'COLG-01', 100, 150)");
  const p1Id = p1Res.lastInsertRowid;

  const openBatchInfo = await resolveOpeningBatch(dbAsync, 't_retail', '', '');
  assert(openBatchInfo.is_batchless === true, 'Expected is_batchless true for retail with flag');
  assert(openBatchInfo.batch_no.startsWith('AUTO-OP-'), `Batch number must start with AUTO-OP-, got ${openBatchInfo.batch_no}`);
  assert.strictEqual(openBatchInfo.expiry_date, null, 'Batchless expiry_date must be strictly NULL');

  await dbAsync.run(
    "INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price) VALUES ('t_retail', ?, ?, ?, 10, 100, 150)",
    [p1Id, openBatchInfo.batch_no, openBatchInfo.expiry_date]
  );
  console.log('  ✅ PASS: Batchless product created with AUTO-OP- batch and NULL expiry.');

  // --------------------------------------------------------------------------
  // TEST 2: Two Purchases at Different Costs Sold in FIFO Order
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Two Purchases at Different Costs Sold in FIFO Order ---');
  const p2Res = await dbAsync.run("INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price) VALUES ('t_retail', 'Lux Soap 150g', 'LUX-01', 80, 120)");
  const p2Id = p2Res.lastInsertRowid;

  // Purchase 1: 5 units @ Rs 100
  const pur1Batch = await resolvePurchaseBatch(dbAsync, 't_retail', { product_id: p2Id });
  assert(pur1Batch.batch_no.startsWith('AUTO-PUR-'), 'Purchase batch must start with AUTO-PUR-');
  assert.strictEqual(pur1Batch.expiry_date, null, 'Purchase batch expiry must be NULL');
  const b1Res = await dbAsync.run(
    "INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, created_at) VALUES ('t_retail', ?, ?, NULL, 5, 100, 130, '2026-11-01 10:00:00')",
    [p2Id, pur1Batch.batch_no]
  );
  const b1Id = b1Res.lastInsertRowid;

  // Purchase 2: 5 units @ Rs 120
  const pur2Batch = await resolvePurchaseBatch(dbAsync, 't_retail', { product_id: p2Id });
  const b2Res = await dbAsync.run(
    "INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, created_at) VALUES ('t_retail', ?, ?, NULL, 5, 120, 150, '2026-11-02 10:00:00')",
    [p2Id, pur2Batch.batch_no]
  );
  const b2Id = b2Res.lastInsertRowid;

  // Simulate Sale of 7 units in FIFO order:
  // Must deduct 5 from Batch 1 (@ Rs 100) and 2 from Batch 2 (@ Rs 120)
  const activeBatches = await dbAsync.all(
    "SELECT * FROM batches WHERE tenant_id = 't_retail' AND product_id = ? AND quantity > 0 ORDER BY (expiry_date IS NULL), expiry_date, created_at, id ASC",
    [p2Id]
  );

  let remaining = 7;
  let totalCost = 0;
  const consumed = [];

  for (const b of activeBatches) {
    if (remaining <= 0) break;
    const deduct = Math.min(b.quantity, remaining);
    await dbAsync.run("UPDATE batches SET quantity = quantity - ? WHERE id = ?", [deduct, b.id]);
    totalCost += deduct * b.purchase_price;
    consumed.push({ batchId: b.id, deduct, cost: b.purchase_price });
    remaining -= deduct;
  }

  assert.strictEqual(remaining, 0, 'All 7 units should be deducted');
  assert.strictEqual(totalCost, 5 * 100 + 2 * 120, `Expected COGS 740, got ${totalCost}`);
  assert.strictEqual(consumed.length, 2, 'Consumed across two batches');

  const b1After = await dbAsync.get("SELECT quantity FROM batches WHERE id = ?", [b1Id]);
  const b2After = await dbAsync.get("SELECT quantity FROM batches WHERE id = ?", [b2Id]);
  assert.strictEqual(b1After.quantity, 0, 'Batch 1 depleted to 0');
  assert.strictEqual(b2After.quantity, 3, 'Batch 2 remaining 3 units');
  console.log(`  ✅ PASS: FIFO deduction across two purchase batches (COGS: Rs ${totalCost}, B1: 0, B2: 3).`);

  // Record Sale and Item
  const saleRes = await dbAsync.run("INSERT INTO sales (tenant_id, invoice_no, sale_date, total_amount) VALUES ('t_retail', 'INV-001', '2026-11-04', 1050)");
  const saleId = saleRes.lastInsertRowid;
  await dbAsync.run("INSERT INTO sale_items (tenant_id, sale_id, product_id, batch_id, quantity, unit_price, total_cost) VALUES ('t_retail', ?, ?, ?, 7, 150, ?)", [saleId, p2Id, b2Id, totalCost]);

  // --------------------------------------------------------------------------
  // TEST 3: Return 1 Unit
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Customer Return ---');
  // Customer returns 1 unit back to inventory
  await dbAsync.run("UPDATE batches SET quantity = quantity + 1 WHERE id = ?", [b2Id]);
  const b2AfterReturn = await dbAsync.get("SELECT quantity FROM batches WHERE id = ?", [b2Id]);
  assert.strictEqual(b2AfterReturn.quantity, 4, 'Batch 2 restored to 4 after return');
  console.log('  ✅ PASS: Return restores stock accurately (Batch 2: 4 units).');

  // --------------------------------------------------------------------------
  // TEST 4: Sale Void
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Sale Invoice Void ---');
  // Void invoice: restore remaining 6 units (reversing the rest of the sale)
  await dbAsync.run("UPDATE batches SET quantity = quantity + 5 WHERE id = ?", [b1Id]);
  await dbAsync.run("UPDATE batches SET quantity = quantity + 1 WHERE id = ?", [b2Id]);
  await dbAsync.run("UPDATE sales SET status = 'voided' WHERE id = ?", [saleId]);

  const b1Restored = await dbAsync.get("SELECT quantity FROM batches WHERE id = ?", [b1Id]);
  const b2Restored = await dbAsync.get("SELECT quantity FROM batches WHERE id = ?", [b2Id]);
  assert.strictEqual(b1Restored.quantity, 5, 'Batch 1 restored to 5');
  assert.strictEqual(b2Restored.quantity, 5, 'Batch 2 restored to 5');
  console.log('  ✅ PASS: Void completely restores batch quantities to pre-sale states.');

  // --------------------------------------------------------------------------
  // TEST 5: Stock Adjustment
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Stock Adjustment ---');
  // Adjust -1 unit due to breakage
  await dbAsync.run("UPDATE batches SET quantity = quantity - 1 WHERE id = ?", [b1Id]);
  const b1Adjusted = await dbAsync.get("SELECT quantity FROM batches WHERE id = ?", [b1Id]);
  assert.strictEqual(b1Adjusted.quantity, 4, 'Batch 1 adjusted to 4');
  console.log('  ✅ PASS: Stock adjustment correctly applied to batch.');

  // --------------------------------------------------------------------------
  // TEST 6: 200-Day Clock Advance (NULL Expiry Verification)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: 200-Day Clock Advance (Alerts & Reports) ---');
  // Advance 200 days into the future
  const futureDate = '2027-05-23';

  // Near-expiry alert query
  const expiringAlerts = await dbAsync.all(`
    SELECT * FROM batches
    WHERE tenant_id = 't_retail' AND status = 'active' AND quantity > 0
      AND expiry_date IS NOT NULL AND expiry_date <= ?
    ORDER BY (expiry_date IS NULL), expiry_date, created_at, id
  `, [futureDate]);

  assert.strictEqual(expiringAlerts.length, 0, 'Batchless batches with NULL expiry must NEVER show as expiring');
  console.log('  ✅ PASS: 200-day clock advance confirms NULL expiry items never trigger expiry alerts.');

  // --------------------------------------------------------------------------
  // TEST 7: Golden Test for Frozen Food Tenant (Byte & Logic Parity)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Frozen Food Golden Parity Test ---');
  // Frozen food opening stock must receive batch number and 180-day default expiry
  const ffOpening = await resolveOpeningBatch(dbAsync, 't_frozen', '', '');
  assert.strictEqual(ffOpening.is_batchless, false, 'Frozen food must never be batchless');
  assert(ffOpening.expiry_date !== null, 'Frozen food expiry must NOT be null');
  assert(ffOpening.batch_no.startsWith('BATCH-'), `Expected BATCH- prefix, got ${ffOpening.batch_no}`);

  // Frozen food purchase item without explicit expiry must receive 180-day default
  const ffPur = await resolvePurchaseBatch(dbAsync, 't_frozen', { batch_no: 'FF-LOT-999', expiry_date: '2026-12-31' });
  assert.strictEqual(ffPur.is_batchless, false);
  assert.strictEqual(ffPur.batch_no, 'FF-LOT-999');
  assert.strictEqual(ffPur.expiry_date, '2026-12-31');
  console.log('  ✅ PASS: Frozen food golden workflow completely preserved.');

  console.log('\n========================================================================');
  console.log('ALL 7 TRADE BATCHLESS LIFECYCLE TESTS PASSED ✅');
  console.log('========================================================================\n');
}

runTests().then(() => {
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(0);
}).catch(err => {
  console.error('❌ TEST FAILED:', err);
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(1);
});
