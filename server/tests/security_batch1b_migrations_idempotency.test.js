process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

test('Security Batch 1b - Item 8: Migrations idempotency and non-destructive execution verification', async (t) => {
  const prodDbPath = path.join(__dirname, '..', '..', 'data', 'latif_traders.db');
  const tempDbPath = path.join(__dirname, '..', '..', 'data', `test_migrations_idempotency_${Date.now()}.db`);

  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  fs.copyFileSync(prodDbPath, tempDbPath);

  const db = new Database(tempDbPath);

  // Define the exact schema migration steps from database.js
  const runBatch1Migrations = () => {
    // 1. users table additive columns
    const userCols = db.prepare('PRAGMA table_info("users")').all();
    if (!userCols.some(c => c.name === 'token_version')) {
      db.prepare('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1').run();
    }
    if (!userCols.some(c => c.name === 'must_change_password')) {
      db.prepare('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'is_hidden')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_hidden INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'is_system_account')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_system_account INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'temp_password_expires_at')) {
      db.prepare('ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME').run();
    }
    if (!userCols.some(c => c.name === 'temp_password_used')) {
      db.prepare('ALTER TABLE users ADD COLUMN temp_password_used INTEGER DEFAULT 0').run();
    }

    // 2. password_reset_requests additive columns and plaintext nullification
    const resetCols = db.prepare('PRAGMA table_info("password_reset_requests")').all();
    if (!resetCols.some(c => c.name === 'reset_token_hash')) {
      db.prepare('ALTER TABLE password_reset_requests ADD COLUMN reset_token_hash TEXT').run();
    }
    if (!resetCols.some(c => c.name === 'expires_at')) {
      db.prepare('ALTER TABLE password_reset_requests ADD COLUMN expires_at DATETIME').run();
    }
    if (!resetCols.some(c => c.name === 'is_used')) {
      db.prepare('ALTER TABLE password_reset_requests ADD COLUMN is_used INTEGER DEFAULT 0').run();
    }
    db.prepare('UPDATE password_reset_requests SET temporary_password = NULL WHERE temporary_password IS NOT NULL').run();

    // 3. tenants table additive is_default column
    const tenantCols = db.prepare('PRAGMA table_info("tenants")').all();
    if (!tenantCols.some(c => c.name === 'is_default')) {
      db.prepare('ALTER TABLE tenants ADD COLUMN is_default INTEGER DEFAULT 0').run();
      db.prepare('UPDATE tenants SET is_default = 1 WHERE id = ?').run(LEGACY_TENANT_ID);
    }

    // 4. NULL tenant backfill
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
    db.prepare("UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL AND role != 'superowner'").run(LEGACY_TENANT_ID);
  };

  await t.test('1. First execution of Batch 1 migrations on production-shaped database', () => {
    assert.doesNotThrow(() => {
      runBatch1Migrations();
    }, 'First run of migrations must execute cleanly');

    // Verify all columns exist
    const userCols = db.prepare('PRAGMA table_info("users")').all().map(c => c.name);
    assert.ok(userCols.includes('token_version'));
    assert.ok(userCols.includes('must_change_password'));
    assert.ok(userCols.includes('temp_password_expires_at'));
    assert.ok(userCols.includes('temp_password_used'));
    assert.ok(userCols.includes('is_hidden'));
    assert.ok(userCols.includes('is_system_account'));

    const resetCols = db.prepare('PRAGMA table_info("password_reset_requests")').all().map(c => c.name);
    assert.ok(resetCols.includes('reset_token_hash'));
    assert.ok(resetCols.includes('expires_at'));
    assert.ok(resetCols.includes('is_used'));

    const tenantCols = db.prepare('PRAGMA table_info("tenants")').all().map(c => c.name);
    assert.ok(tenantCols.includes('is_default'));
  });

  // Capture snapshot of schema state after Run 1
  const userColsSnapshot1 = db.prepare('PRAGMA table_info("users")').all();
  const resetColsSnapshot1 = db.prepare('PRAGMA table_info("password_reset_requests")').all();
  const tenantColsSnapshot1 = db.prepare('PRAGMA table_info("tenants")').all();
  const usersCount1 = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const tenantsCount1 = db.prepare('SELECT COUNT(*) as c FROM tenants').get().c;

  await t.test('2. Second execution of Batch 1 migrations (Idempotency verification)', () => {
    assert.doesNotThrow(() => {
      runBatch1Migrations();
    }, 'Second run of migrations must execute without error');

    const userColsSnapshot2 = db.prepare('PRAGMA table_info("users")').all();
    const resetColsSnapshot2 = db.prepare('PRAGMA table_info("password_reset_requests")').all();
    const tenantColsSnapshot2 = db.prepare('PRAGMA table_info("tenants")').all();
    const usersCount2 = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const tenantsCount2 = db.prepare('SELECT COUNT(*) as c FROM tenants').get().c;

    // Deep compare schema definition before and after second run
    assert.deepStrictEqual(userColsSnapshot2, userColsSnapshot1, 'User table columns must remain identical');
    assert.deepStrictEqual(resetColsSnapshot2, resetColsSnapshot1, 'Password reset table columns must remain identical');
    assert.deepStrictEqual(tenantColsSnapshot2, tenantColsSnapshot1, 'Tenant table columns must remain identical');
    assert.strictEqual(usersCount2, usersCount1, 'User count must remain unchanged');
    assert.strictEqual(tenantsCount2, tenantsCount1, 'Tenant count must remain unchanged');
  });

  // Cleanup
  db.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
});
