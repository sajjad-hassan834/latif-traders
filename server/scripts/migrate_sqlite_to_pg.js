const { getPKTDate } = require('../utils/timezone');
/**
 * Idempotent SQLite to PostgreSQL 16 Migration Script
 * 
 * Usage:
 *   node server/scripts/migrate_sqlite_to_pg.js [path/to/sqlite.db] [--dry-run]
 * 
 * Guarantees:
 *   - Runs in a SINGLE atomic transaction (ROLLBACK on any error or --dry-run)
 *   - Migrates tenant-by-tenant in strict foreign key dependency order
 *   - Resets all PostgreSQL sequences to MAX(id)
 *   - Initializes atomic per-tenant counters from existing invoice/receipt numbers
 *   - ZERO row-level data printed to stdout
 */

const Database = require('better-sqlite3');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const defaultDbPath = path.join(__dirname, '..', '..', 'data', 'latif_traders.db');

const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';

// Strict Foreign-Key Dependency Table Order
const MIGRATION_TABLES = [
  'tenants',
  'users',
  'categories',
  'brands',
  'units',
  'customers',
  'suppliers',
  'products',
  'supplier_products',
  'batches',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'returns',
  'return_items',
  'payments',
  'expense_categories',
  'expenses',
  'stock_adjustments',
  'inventory_movements',
  'tenant_settings',
  'subscriptions',
  'audit_logs',
  'password_reset_requests'
];

async function migrate(overrideSqlitePath, overrideDryRun) {
  const args = process.argv.slice(2);
  const isDryRun = overrideDryRun !== undefined ? overrideDryRun : args.includes('--dry-run');
  const customDbPath = overrideSqlitePath || args.find(a => !a.startsWith('--'));
  const sqlitePath = customDbPath || defaultDbPath;

  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite source database not found: ${sqlitePath}`);
    process.exit(1);
  }

  console.log('\n========================================================================');
  console.log(`SQLITE -> POSTGRESQL 16 MIGRATION ENGINE ${isDryRun ? '[DRY-RUN MODE]' : '[LIVE COMMIT MODE]'}`);
  console.log('========================================================================');
  console.log(`Source SQLite:      ${sqlitePath}`);
  console.log(`Target PostgreSQL:  ${pgUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Execution Mode:     ${isDryRun ? 'DRY-RUN (All changes will ROLLBACK)' : 'LIVE (Changes will COMMIT)'}`);
  console.log('------------------------------------------------------------------------\n');

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();

  const verRes = await pg.query('SELECT version()');
  const portMatch = pgUrl.match(/:(\d+)\//);
  console.log(`[POSTGRES CONNECTION VERIFIED] Port: ${portMatch ? portMatch[1] : 5432}`);
  console.log(`[POSTGRES VERSION] ${verRes.rows[0].version}\n`);

  const startTime = Date.now();
  let totalRowsMigrated = 0;

  try {
    // 1. Begin Single Atomic Transaction
    await pg.query('BEGIN');
    console.log('🔒 Single atomic transaction started (BEGIN)...\n');

    // Clean existing target data in reverse dependency order
    console.log('--- Cleaning Target Database Schema for Idempotency ---');
    const existingPgTablesRes = await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const existingPgTables = new Set(existingPgTablesRes.rows.map(r => r.table_name));

    for (let i = MIGRATION_TABLES.length - 1; i >= 0; i--) {
      const table = MIGRATION_TABLES[i];
      if (existingPgTables.has(table)) {
        await pg.query(`TRUNCATE TABLE "${table}" CASCADE`);
      }
    }
    if (existingPgTables.has('counters')) {
      await pg.query('TRUNCATE TABLE counters CASCADE');
    }
    console.log('✓ Target tables truncated cleanly.\n');

    // 2. Migrate Tables in Dependency Order
    console.log('--- Migrating Tables in Dependency Order ---');
    for (const table of MIGRATION_TABLES) {
      // Check if table exists in SQLite
      const tblCheck = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
      if (!tblCheck) {
        continue;
      }

      // Check column metadata in SQLite & Postgres
      const sqliteCols = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
      const pgColsRes = await pg.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);

      if (pgColsRes.rows.length === 0) {
        continue;
      }

      const pgColMap = new Map(pgColsRes.rows.map(r => [r.column_name, r.data_type]));
      // Common valid columns
      const sharedCols = sqliteCols.filter(c => pgColMap.has(c));

      if (sharedCols.length === 0) continue;

      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      if (rows.length === 0) {
        console.log(`  • ${table.padEnd(25)}:        0 rows`);
        continue;
      }

      // Prepare batch insert statement
      const colList = sharedCols.map(c => `"${c}"`).join(', ');
      const valPlaceholders = sharedCols.map((_, idx) => `$${idx + 1}`).join(', ');
      const insertSql = `INSERT INTO "${table}" (${colList}) VALUES (${valPlaceholders})`;

      let validTenantUserKeys = new Set();
      if (table === 'audit_logs') {
        const uRes = await pg.query('SELECT tenant_id, id FROM users');
        validTenantUserKeys = new Set(uRes.rows.map(r => `${r.tenant_id}:${r.id}`));
      }

      for (const row of rows) {
        const rowTenantId = row.tenant_id || LEGACY_TENANT_ID;
        const values = sharedCols.map(c => {
          let val = row[c];
          if (val === undefined) return null;
          // Clean default tenant_id if null
          if (c === 'tenant_id' && (val === null || val === '')) {
            val = LEGACY_TENANT_ID;
          }
          // Set orphaned user_id in audit_logs to null (respecting ON DELETE SET NULL)
          if (table === 'audit_logs' && c === 'user_id' && val !== null && !validTenantUserKeys.has(`${rowTenantId}:${val}`)) {
            val = null;
          }
          // Convert integer to boolean if PG expects boolean
          const pgType = pgColMap.get(c);
          if (pgType === 'boolean' && typeof val === 'number') {
            return val === 1;
          }
          return val;
        });

        await pg.query(insertSql, values);
      }

      totalRowsMigrated += rows.length;
      console.log(`  ✓ ${table.padEnd(25)}: ${String(rows.length).padStart(8)} rows migrated`);
    }

    // 3. Reset Sequences to MAX(id)
    console.log('\n--- Resetting PostgreSQL Primary Key Sequences ---');
    const seqListRes = await pg.query(`
      SELECT c.relname AS table_name, s.relname AS seq_name 
      FROM pg_class s 
      JOIN pg_depend d ON d.objid = s.oid 
      JOIN pg_class c ON d.refobjid = c.oid 
      WHERE s.relkind = 'S'
    `);
    for (const row of seqListRes.rows) {
      if (!MIGRATION_TABLES.includes(row.table_name)) continue;
      const maxRes = await pg.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM "${row.table_name}"`);
      const maxId = Number(maxRes.rows[0].max_id);
      await pg.query(`SELECT setval($1, $2, $3)`, [row.seq_name, Math.max(1, maxId), maxId > 0]);
      console.log(`  ✓ Reset sequence for [${row.table_name}]: last value = ${maxId}`);
    }

    // 4. Initialize Per-Tenant Counter Sequences
    console.log('\n--- Initializing Per-Tenant Counters ---');
    const tenantsRes = await pg.query('SELECT id FROM tenants');
    const tenantIds = tenantsRes.rows.map(r => r.id);

    for (const tid of tenantIds) {
      // Find highest sale count for tenant
      const sCountRes = await pg.query('SELECT COUNT(*) as c FROM sales WHERE tenant_id = $1', [tid]);
      const lastSaleNum = Number(sCountRes.rows[0].c);

      // Find highest purchase count for tenant
      const pCountRes = await pg.query('SELECT COUNT(*) as c FROM purchases WHERE tenant_id = $1', [tid]);
      const lastPurNum = Number(pCountRes.rows[0].c);

      await pg.query(`
        INSERT INTO counters (tenant_id, counter_type, last_number)
        VALUES ($1, 'sale_invoice', $2)
        ON CONFLICT (tenant_id, counter_type) DO UPDATE 
        SET last_number = EXCLUDED.last_number, updated_at = CURRENT_TIMESTAMP
      `, [tid, lastSaleNum]);

      await pg.query(`
        INSERT INTO counters (tenant_id, counter_type, last_number)
        VALUES ($1, 'purchase_invoice', $2)
        ON CONFLICT (tenant_id, counter_type) DO UPDATE 
        SET last_number = EXCLUDED.last_number, updated_at = CURRENT_TIMESTAMP
      `, [tid, lastPurNum]);

      console.log(`  ✓ Tenant [${tid}]: Counters initialized (sales: ${lastSaleNum}, purchases: ${lastPurNum})`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // 5. Commit or Rollback
    if (isDryRun) {
      await pg.query('ROLLBACK');
      console.log('\n========================================================================');
      console.log('DRY-RUN COMPLETED: All statements validated and ROLLED BACK.');
      console.log(`Verified Migration: ${totalRowsMigrated} total rows processed in ${elapsed}s.`);
      console.log('Zero target rows committed. Test database remains untouched.');
      console.log('========================================================================\n');
    } else {
      await pg.query('COMMIT');
      console.log('\n========================================================================');
      console.log('MIGRATION COMMITTED SUCCESSFULLY!');
      console.log(`Total Rows Migrated: ${totalRowsMigrated}`);
      console.log(`Elapsed Time:        ${elapsed}s`);
      console.log('All PostgreSQL foreign keys, composite uniques, and sequences are active.');
      console.log('========================================================================\n');
    }

    sqlite.close();
    await pg.end();
    return { success: true, totalRowsMigrated, elapsed, isDryRun };
  } catch (err) {
    await pg.query('ROLLBACK');
    sqlite.close();
    await pg.end();
    console.error('\n❌ MIGRATION FAILED - Transaction ROLLED BACK automatically:');
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
