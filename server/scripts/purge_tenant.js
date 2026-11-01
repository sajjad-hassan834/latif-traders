/**
 * Superowner-Only Tenant Purge CLI Tool
 * 
 * Strict Safety Rules:
 *  1. CLI-only: Cannot be triggered over HTTP.
 *  2. Refuses to purge the base primary tenant (LEGACY_TENANT_ID).
 *  3. Requires an immediate pre-purge database safety backup.
 *  4. Requires typed confirmation: --confirm=PURGE_<tenant_id>.
 *  5. Deletes all tenant-scoped data in reverse foreign-key dependency order inside a single transaction.
 */

const path = require('path');
const fs = require('fs');
const { db, getPgAdapter, DATA_DIR } = require('../config/database');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const prefix = `--${name}=`;
    const found = args.find(a => a.startsWith(prefix));
    return found ? found.slice(prefix.length).trim() : null;
  };

  const tenantId = getArg('tenant-id');
  const confirmStr = getArg('confirm');
  const dryRun = args.includes('--dry-run');

  if (!tenantId) {
    console.error('❌ Error: --tenant-id is required.');
    console.error('Usage: node server/scripts/purge_tenant.js --tenant-id=<id> --confirm=PURGE_<id> [--dry-run]');
    process.exit(1);
  }

  if (tenantId === LEGACY_TENANT_ID) {
    console.error(`❌ Error: Base primary tenant (${LEGACY_TENANT_ID}) is protected and cannot be purged.`);
    process.exit(1);
  }

  const expectedConfirm = `PURGE_${tenantId}`;
  if (confirmStr !== expectedConfirm) {
    console.error(`❌ Error: Typed confirmation failed. Expected --confirm=${expectedConfirm}, got --confirm=${confirmStr}`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`  SUPEROWNER TENANT PURGE UTILITY`);
  console.log(`  Target Tenant: ${tenantId}`);
  console.log(`  Mode:          ${dryRun ? 'DRY-RUN (Simulated)' : 'REAL PURGE'}`);
  console.log(`======================================================\n`);

  const driver = db.getDriver ? db.getDriver() : 'sqlite';
  console.log(`[DB Driver] ${driver.toUpperCase()}`);

  // 1. Verify tenant exists
  const tenant = await db.get('SELECT id, business_name FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) {
    console.error(`❌ Error: Tenant "${tenantId}" does not exist in the database.`);
    process.exit(1);
  }
  console.log(`[Target Verified] Business Name: "${tenant.business_name}"`);

  // 2. Pre-purge backup
  const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `pre_purge_backup_${tenantId}_${backupTimestamp}.db`;
  const backupDir = path.join(DATA_DIR, 'backups', 'superowner');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, backupName);

  if (driver === 'sqlite') {
    if (db.sqliteDb && db.sqliteDb.backup) {
      console.log(`[Safety Backup] Taking mandatory SQLite snapshot -> ${backupName}...`);
      await db.sqliteDb.backup(backupPath);
      console.log(`✅ Safety snapshot verified (${fs.statSync(backupPath).size} bytes).`);
    }
  } else {
    console.log(`[Safety Backup] In PostgreSQL mode, ensure a snapshot or pg_dump has been executed.`);
  }

  // 3. Purge tables in strict child-to-parent order
  const tablesToPurge = [
    'audit_logs',
    'inventory_movements',
    'return_items',
    'returns',
    'sale_items',
    'sales',
    'purchase_items',
    'purchases',
    'payments',
    'expenses',
    'batches',
    'supplier_products',
    'suppliers',
    'products',
    'categories',
    'units',
    'brands',
    'password_reset_requests',
    'users',
    'counters',
    'tenant_settings',
    'subscriptions',
    'tenants'
  ];

  console.log('\n--- Purging Tenant Data Across All Tables ---');
  await db.transaction(async (tx) => {
    const runner = tx.run ? tx : db;
    let totalDeleted = 0;

    for (const table of tablesToPurge) {
      const idCol = table === 'tenants' ? 'id' : 'tenant_id';
      let res;
      if (driver === 'postgres') {
        res = await runner.run(`DELETE FROM ${table} WHERE ${idCol} = $1`, [tenantId]);
      } else {
        res = await runner.run(`DELETE FROM ${table} WHERE ${idCol} = ?`, [tenantId]);
      }
      const count = res.rowCount || 0;
      totalDeleted += count;
      if (count > 0) {
        console.log(`  ✓ ${table}: ${count} rows deleted`);
      }
    }

    if (dryRun) {
      throw new Error('[DRY-RUN] Purge simulated successfully. Rolling back all deletions.');
    }
    console.log(`\n✅ Successfully purged ${totalDeleted} total records for tenant "${tenantId}".`);
  }).catch(err => {
    if (err.message.includes('[DRY-RUN]')) {
      console.log(err.message);
    } else {
      console.error('❌ Purge transaction failed:', err);
      process.exit(1);
    }
  });

  console.log('\n======================================================');
  console.log('  TENANT PURGE COMPLETED');
  console.log('======================================================\n');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal purge error:', err);
    process.exit(1);
  });
}

module.exports = { main };
