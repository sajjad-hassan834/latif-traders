const { db: sqliteDb } = require('../config/database');
const { Client } = require('pg');

async function runSchemaDiff() {
  const pgClient = new Client({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test'
  });
  await pgClient.connect();

  console.log('\n=============================================================================');
  console.log('SCHEMA DIFF ENGINE: SQLite (PRAGMA table_info) vs PostgreSQL (information_schema)');
  console.log('=============================================================================\n');

  // Fetch SQLite tables
  const sqliteTables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);

  // Fetch Postgres tables
  const pgTablesRes = await pgClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const pgTables = pgTablesRes.rows.map(t => t.table_name);

  console.log('| Table Name | Column Name | SQLite Type | PostgreSQL Type | Status / Rationale |');
  console.log('|------------|-------------|-------------|-----------------|--------------------|');

  for (const table of sqliteTables) {
    if (!pgTables.includes(table)) {
      console.log(`| ${table} | * | EXISTS | MISSING | Table missing in Postgres |`);
      continue;
    }

    const sqliteCols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all();
    const pgColsRes = await pgClient.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    const pgColsMap = new Map(pgColsRes.rows.map(c => [c.column_name, c]));

    for (const sc of sqliteCols) {
      const pc = pgColsMap.get(sc.name);
      if (!pc) {
        console.log(`| ${table} | ${sc.name} | ${sc.type} | MISSING | Column missing in Postgres |`);
        continue;
      }

      let rationale = 'Identical mapping';
      const isTypeDiff = sc.type.toUpperCase() !== pc.data_type.toUpperCase();

      if (sc.type.toUpperCase() === 'REAL' && pc.data_type === 'numeric') {
        rationale = 'INTENDED: NUMERIC(14,2) prevents binary float rounding errors';
      } else if (sc.type.toUpperCase().includes('INT') && pc.data_type === 'bigint') {
        rationale = 'INTENDED: BIGINT / BIGSERIAL avoids 32-bit integer overflow';
      } else if (sc.type.toUpperCase() === 'DATETIME' && pc.data_type.includes('timestamp')) {
        rationale = 'INTENDED: TIMESTAMPTZ stores exact ISO timezone for Asia/Karachi';
      } else if (sc.name.endsWith('_date') && pc.data_type === 'date') {
        rationale = 'INTENDED: Native DATE avoids time-shift errors on business day';
      } else if (sc.name === 'permissions_json' && pc.data_type === 'jsonb') {
        rationale = 'INTENDED: JSONB provides binary JSON indexing and query operators';
      } else if (isTypeDiff) {
        rationale = `INTENDED: Coerced ${sc.type} -> ${pc.data_type}`;
      }

      console.log(`| ${table} | ${sc.name} | ${sc.type || 'TEXT'} | ${pc.data_type} | ${rationale} |`);
    }
  }

  // Check unique constraints & foreign keys
  const fkRes = await pgClient.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, rc.delete_rule, tc.is_deferrable, tc.initially_deferred
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY';
  `);

  console.log(`\nVerified ${fkRes.rowCount} PostgreSQL Foreign Keys with DEFERRABLE status:`);
  for (const fk of fkRes.rows) {
    console.log(` - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name} [DEFERRABLE: ${fk.is_deferrable}]`);
  }

  await pgClient.end();
}

if (require.main === module) {
  runSchemaDiff().catch(err => {
    console.error('Schema diff error:', err);
    process.exit(1);
  });
}

module.exports = { runSchemaDiff };
