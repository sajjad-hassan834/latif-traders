const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function rebuild() {
  const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  console.log('Connecting to PostgreSQL to rebuild schema with database-level tenant isolation...');
  const ver = await client.query('SELECT version()');
  console.log('[POSTGRES VERSION]', ver.rows[0].version);

  // Drop public schema with cascade and recreate
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO postgres');
  await client.query('GRANT ALL ON SCHEMA public TO public');

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'pg_schema.sql'), 'utf8');
  await client.query(schemaSql);

  console.log('✅ PostgreSQL Schema successfully created with hard composite foreign keys and tenant isolation!');

  // Verify all foreign keys
  const fksRes = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `);

  console.log(`\nVerified ${fksRes.rows.length} Foreign Key Constraints in PostgreSQL:`);
  const tenantFks = fksRes.rows.filter(r => r.column_name === 'tenant_id');
  console.log(`Tables with direct tenant_id -> tenants(id) FK: ${tenantFks.length}`);
  
  await client.end();
}

rebuild().catch(err => {
  console.error('❌ Rebuild failed:', err);
  process.exit(1);
});
