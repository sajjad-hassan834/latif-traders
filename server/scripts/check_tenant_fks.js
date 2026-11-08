const { db } = require('../config/database');
const { Client } = require('pg');

async function main() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
  const tablesWithTenant = [];
  const sqliteWithoutTenantFk = [];

  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all();
    if (cols.some(c => c.name === 'tenant_id')) {
      tablesWithTenant.push(t);
      const fks = db.prepare(`PRAGMA foreign_key_list(${t})`).all();
      const hasTenantFk = fks.some(fk => fk.table === 'tenants');
      if (!hasTenantFk) {
        sqliteWithoutTenantFk.push(t);
      }
    }
  }

  console.log(`\n--- SQLite Inspection ---`);
  console.log(`Total tables with tenant_id: ${tablesWithTenant.length}`);
  console.log(`Tables with tenant_id:`, tablesWithTenant);
  console.log(`Tables with tenant_id WITHOUT foreign key to tenants: ${sqliteWithoutTenantFk.length}`);
  console.log(sqliteWithoutTenantFk);

  // Check PostgreSQL
  const pgClient = new Client({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test'
  });
  await pgClient.connect();

  const pgColsRes = await pgClient.query(`
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
  `);
  const pgTablesWithTenant = pgColsRes.rows.map(r => r.table_name);

  const pgFkRes = await pgClient.query(`
    SELECT tc.table_name, ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'tenants';
  `);
  const pgTablesWithTenantFk = new Set(pgFkRes.rows.map(r => r.table_name));
  const pgWithoutTenantFk = pgTablesWithTenant.filter(t => !pgTablesWithTenantFk.has(t));

  console.log(`\n--- PostgreSQL Inspection ---`);
  console.log(`Total PostgreSQL tables with tenant_id: ${pgTablesWithTenant.length}`);
  console.log(`Tables with tenant_id WITHOUT foreign key to tenants: ${pgWithoutTenantFk.length}`);
  console.log(pgWithoutTenantFk);

  await pgClient.end();
}

main().catch(console.error);
