/**
 * High-Speed Batch Chunked Restore into Railway PostgreSQL
 */
const { Client } = require('pg');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const PG_URL = process.env.TARGET_DATABASE_URL || 'postgresql://postgres:brelAfzXfDEPNoQGzLtHFZNeEXWrsKEN@hayabusa.proxy.rlwy.net:13507/railway';
const JSON_BACKUP_PATH = 'C:/Users/ALLAH/Downloads/latif_traders_backup_2026-11-08_0427.json';
const SQLITE_PATH = path.join(__dirname, '..', '..', 'data', 'latif_traders.db');

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function runFastRestore() {
  console.log('========================================================================');
  console.log('HIGH-SPEED BATCH RESTORE INTO RAILWAY POSTGRESQL');
  console.log('========================================================================');
  const startTime = Date.now();

  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  const backup = JSON.parse(fs.readFileSync(JSON_BACKUP_PATH, 'utf8'));
  const tenantId = backup.tenant_id || 'latif_001';

  try {
    await pg.query('BEGIN');
    console.log('🔒 Transaction started...');

    // 1. Ensure Tenant Record Exists
    console.log('\n--- 1. Ensuring Tenant Exists ---');
    await pg.query(`
      INSERT INTO tenants (id, business_name, business_type, owner_name, plan, is_active, is_default)
      VALUES ($1, $2, $3, $4, $5, 1, 1)
      ON CONFLICT (id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        business_type = EXCLUDED.business_type,
        plan = EXCLUDED.plan,
        updated_at = CURRENT_TIMESTAMP
    `, [tenantId, backup.shop_name || 'Latif Traders', backup.business_type || 'frozen_food', 'Owner', backup.plan || 'enterprise']);
    console.log(`✓ Tenant [${tenantId}] (${backup.shop_name}) confirmed.`);

    // 2. Ensure Core Store Users Exist
    console.log('\n--- 2. Migrating Store Users ---');
    const storeUsers = sqlite.prepare(`
      SELECT id, username, email, password_hash, full_name, role, status, permissions_json, theme, created_at, updated_at
      FROM users
      WHERE tenant_id = 'latif_001' OR role = 'superowner'
    `).all();

    for (const u of storeUsers) {
      await pg.query(`
        INSERT INTO users (id, username, email, password_hash, full_name, role, status, permissions_json, theme, tenant_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.status,
        u.permissions_json ? JSON.stringify(typeof u.permissions_json === 'string' ? JSON.parse(u.permissions_json) : u.permissions_json) : null,
        u.theme, u.role === 'superowner' ? null : tenantId, u.created_at || new Date(), u.updated_at || new Date()
      ]);
    }
    console.log(`✓ Migrated ${storeUsers.length} store user accounts.`);

    // Valid FK sets
    const validUsers = new Set((await pg.query('SELECT id FROM users WHERE tenant_id = $1 OR tenant_id IS NULL', [tenantId])).rows.map(r => Number(r.id)));
    let validSuppliers = new Set();
    let validCustomers = new Set();
    let validCategories = new Set();
    let validBrands = new Set();
    let validUnits = new Set();
    let validProducts = new Set();
    let validBatches = new Set();

    // 3. Strict Dependency Table Order
    const tableOrder = [
      'categories',
      'units',
      'brands',
      'suppliers',
      'customers',
      'products',
      'batches',
      'purchases',
      'purchase_items',
      'sales',
      'sale_items',
      'payments',
      'expense_categories',
      'expenses',
      'inventory_movements',
      'tenant_settings'
    ];

    console.log('\n--- 3. Restoring Backup Tables in High-Speed Batches ---');
    for (const table of tableOrder) {
      const rows = backup.tables[table] || [];
      if (rows.length === 0) {
        console.log(`  • ${table.padEnd(25)}:        0 rows`);
        continue;
      }

      // Check PostgreSQL columns
      const pgColsRes = await pg.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      const pgColMap = new Map(pgColsRes.rows.map(r => [r.column_name, r.data_type]));

      // Clean existing data for this tenant in this table
      await pg.query(`DELETE FROM "${table}" WHERE tenant_id = $1`, [tenantId]);

      // Populate valid parent sets
      if (table === 'products') {
        validSuppliers = new Set((await pg.query('SELECT id FROM suppliers WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
        validCategories = new Set((await pg.query('SELECT id FROM categories WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
        validBrands = new Set((await pg.query('SELECT id FROM brands WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
        validUnits = new Set((await pg.query('SELECT id FROM units WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
      } else if (table === 'batches') {
        validProducts = new Set((await pg.query('SELECT id FROM products WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
        validSuppliers = new Set((await pg.query('SELECT id FROM suppliers WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
      } else if (table === 'sales') {
        validCustomers = new Set((await pg.query('SELECT id FROM customers WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
      } else if (table === 'sale_items') {
        validBatches = new Set((await pg.query('SELECT id FROM batches WHERE tenant_id = $1', [tenantId])).rows.map(r => Number(r.id)));
      }

      const sampleCols = Object.keys(rows[0]).filter(c => pgColMap.has(c));
      const colList = sampleCols.map(c => `"${c}"`).join(', ');

      // Pre-sanitize rows
      const sanitizedRows = [];
      for (const row of rows) {
        row.tenant_id = tenantId;

        // Foreign Key sanitization
        if (table === 'products') {
          if (row.supplier_id && !validSuppliers.has(Number(row.supplier_id))) row.supplier_id = null;
          if (row.category_id && !validCategories.has(Number(row.category_id))) row.category_id = null;
          if (row.brand_id && !validBrands.has(Number(row.brand_id))) row.brand_id = null;
          if (row.unit_id && !validUnits.has(Number(row.unit_id))) row.unit_id = null;
        } else if (table === 'batches') {
          if (row.supplier_id && !validSuppliers.has(Number(row.supplier_id))) row.supplier_id = null;
          if (row.product_id && !validProducts.has(Number(row.product_id))) continue;
        } else if (table === 'sales') {
          if (row.user_id && !validUsers.has(Number(row.user_id))) row.user_id = null;
          if (row.customer_id && !validCustomers.has(Number(row.customer_id))) row.customer_id = null;
        } else if (table === 'purchases') {
          if (row.user_id && !validUsers.has(Number(row.user_id))) row.user_id = null;
          if (row.supplier_id && !validSuppliers.has(Number(row.supplier_id))) row.supplier_id = null;
        } else if (table === 'payments') {
          if (row.user_id && !validUsers.has(Number(row.user_id))) row.user_id = null;
          if (row.party_type === 'CUSTOMER' && row.party_id && !validCustomers.has(Number(row.party_id))) continue;
          if (row.party_type === 'SUPPLIER' && row.party_id && !validSuppliers.has(Number(row.party_id))) continue;
        } else if (table === 'expenses') {
          if (row.user_id && !validUsers.has(Number(row.user_id))) row.user_id = null;
        } else if (table === 'inventory_movements') {
          if (row.user_id && !validUsers.has(Number(row.user_id))) row.user_id = null;
          if (row.batch_id && !validBatches.has(Number(row.batch_id))) row.batch_id = null;
        }

        sanitizedRows.push(row);
      }

      // Execute in 50-row batches
      const chunks = chunkArray(sanitizedRows, 50);
      let insertedCount = 0;

      for (const chunk of chunks) {
        const valueClauses = [];
        const params = [];
        let pIdx = 1;

        for (const row of chunk) {
          const rowPlaceholders = [];
          for (const c of sampleCols) {
            rowPlaceholders.push(`$${pIdx++}`);
            let val = row[c];
            if (val === undefined) val = null;
            const dt = pgColMap.get(c);
            if (dt === 'jsonb' && val !== null) {
              val = typeof val === 'object' ? JSON.stringify(val) : String(val);
            }
            if ((dt === 'numeric' || dt === 'decimal') && (val === '' || val === null)) {
              val = 0;
            }
            params.push(val);
          }
          valueClauses.push(`(${rowPlaceholders.join(', ')})`);
        }

        const batchSql = `INSERT INTO "${table}" (${colList}) VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`;
        await pg.query(batchSql, params);
        insertedCount += chunk.length;
      }

      console.log(`  ✓ ${table.padEnd(25)}: ${String(insertedCount).padStart(8)} rows restored`);
    }

    // 4. Reset Sequences
    console.log('\n--- 4. Resetting PostgreSQL Sequences ---');
    for (const table of tableOrder) {
      try {
        const maxRes = await pg.query(`SELECT MAX(id) as m FROM "${table}"`);
        const maxVal = maxRes.rows[0]?.m;
        if (maxVal) {
          const seqRes = await pg.query(`SELECT pg_get_serial_sequence('"${table}"', 'id') as seq`);
          const seqName = seqRes.rows[0]?.seq;
          if (seqName) {
            await pg.query(`SELECT setval($1, $2, true)`, [seqName, Number(maxVal)]);
            console.log(`  ✓ Reset sequence for [${table}] to ${maxVal}`);
          }
        }
      } catch (_) {}
    }

    // 5. Initialize Document Counters
    console.log('\n--- 5. Initializing Document Counters ---');
    const salesCountRes = await pg.query(`SELECT COUNT(*) as cnt FROM sales WHERE tenant_id = $1`, [tenantId]);
    const purchasesCountRes = await pg.query(`SELECT COUNT(*) as cnt FROM purchases WHERE tenant_id = $1`, [tenantId]);

    const salesCount = Number(salesCountRes.rows[0]?.cnt || 0);
    const purchasesCount = Number(purchasesCountRes.rows[0]?.cnt || 0);

    await pg.query(`
      INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
      VALUES ($1, 'sale_invoice_counter', $2, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, counter_type) DO UPDATE SET
        last_number = GREATEST(counters.last_number, EXCLUDED.last_number),
        updated_at = CURRENT_TIMESTAMP
    `, [tenantId, salesCount]);

    await pg.query(`
      INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
      VALUES ($1, 'purchase_invoice_counter', $2, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, counter_type) DO UPDATE SET
        last_number = GREATEST(counters.last_number, EXCLUDED.last_number),
        updated_at = CURRENT_TIMESTAMP
    `, [tenantId, purchasesCount]);

    console.log(`✓ Counters initialized: sales (${salesCount}), purchases (${purchasesCount}).`);

    await pg.query('COMMIT');
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n========================================================================');
    console.log(`🎉 ALL LIVE DATA RESTORED TO RAILWAY POSTGRESQL IN ${totalTime}s!`);
    console.log('========================================================================\n');

  } catch (err) {
    await pg.query('ROLLBACK');
    console.error('❌ Restore failed, rolled back:', err);
    throw err;
  } finally {
    await pg.end();
    sqlite.close();
  }
}

runFastRestore().catch(err => {
  console.error(err);
  process.exit(1);
});
