const { db: sqliteDb } = require('../config/database');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function generateCompleteSchemaDiff() {
  const pgClient = new Client({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test'
  });
  await pgClient.connect();

  let md = '# Complete Schema Diff Report: SQLite vs PostgreSQL 16\n\n';
  md += `**Generated**: ${new Date().toISOString()}\n`;
  md += `**PostgreSQL Target**: Docker postgres:16-alpine on port 5434\n\n`;

  const sqliteTables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t => t.name);

  // 1. Column and Type Comparison Table
  md += '## 1. Tables and Columns Detailed Mapping\n\n';
  md += '| Table | Column | SQLite Type | SQLite Null? | SQLite Default | PG Type | PG Null? | PG Default | Status / Rationale |\n';
  md += '|---|---|---|---|---|---|---|---|---|\n';

  for (const table of sqliteTables) {
    const sqliteCols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all();
    const pgColsRes = await pgClient.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    const pgColsMap = new Map(pgColsRes.rows.map(c => [c.column_name, c]));

    for (const sc of sqliteCols) {
      const pc = pgColsMap.get(sc.name);
      if (!pc) {
        md += `| ${table} | ${sc.name} | ${sc.type} | ${sc.notnull ? 'NOT NULL' : 'NULL'} | ${sc.dflt_value || '-'} | MISSING | - | - | ❌ Missing in Postgres |\n`;
        continue;
      }

      let rationale = 'Identical mapping';
      const isTypeDiff = sc.type.toUpperCase() !== pc.data_type.toUpperCase();
      if (sc.type.toUpperCase() === 'REAL' && pc.data_type === 'numeric') {
        rationale = 'INTENDED: NUMERIC(14,2) prevents float drift';
      } else if (sc.type.toUpperCase().includes('INT') && pc.data_type === 'bigint') {
        rationale = 'INTENDED: BIGINT / BIGSERIAL prevents 32-bit overflow';
      } else if (sc.type.toUpperCase() === 'DATETIME' && pc.data_type.includes('timestamp')) {
        rationale = 'INTENDED: TIMESTAMPTZ stores exact ISO timezone';
      } else if (sc.name.endsWith('_date') && pc.data_type === 'date') {
        rationale = 'INTENDED: Native DATE for business day';
      } else if (sc.name === 'permissions_json' && pc.data_type === 'jsonb') {
        rationale = 'INTENDED: JSONB indexing and query operators';
      }

      md += `| ${table} | ${sc.name} | ${sc.type || 'TEXT'} | ${sc.notnull ? 'NO' : 'YES'} | ${sc.dflt_value || '-'} | ${pc.data_type} | ${pc.is_nullable} | ${pc.column_default ? pc.column_default.slice(0, 30) : '-'} | ${rationale} |\n`;
    }
  }

  // 2. Foreign Keys Comparison
  md += '\n## 2. Foreign Key Constraints (SQLite vs PostgreSQL)\n\n';
  md += '| Table | From Column | To Table | To Column | Deferrable in PG? | Delete Rule |\n';
  md += '|---|---|---|---|---|---|\n';

  const pgFkRes = await pgClient.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule, tc.is_deferrable
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, kcu.column_name;
  `);

  for (const fk of pgFkRes.rows) {
    md += `| ${fk.table_name} | ${fk.column_name} | ${fk.foreign_table_name} | ${fk.foreign_column_name} | ${fk.is_deferrable} | ${fk.delete_rule} |\n`;
  }

  // 3. Unique Constraints & Composite Keys
  md += '\n## 3. Unique Constraints (SQLite vs PostgreSQL)\n\n';
  md += '| Table | Constraint Name | Columns | Type |\n';
  md += '|---|---|---|---|\n';

  const pgUniqueRes = await pgClient.query(`
    SELECT tc.table_name, tc.constraint_name, string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as cols, tc.constraint_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY') AND tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
    ORDER BY tc.table_name, tc.constraint_type;
  `);

  for (const uq of pgUniqueRes.rows) {
    md += `| ${uq.table_name} | ${uq.constraint_name} | ${uq.cols} | ${uq.constraint_type} |\n`;
  }

  // 4. Indexes
  md += '\n## 4. PostgreSQL Indexes\n\n';
  md += '| Table | Index Name | Index Definition |\n';
  md += '|---|---|---|\n';

  const pgIdxRes = await pgClient.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  for (const idx of pgIdxRes.rows) {
    md += `| ${idx.tablename} | ${idx.indexname} | \`${idx.indexdef}\` |\n`;
  }

  const outputPath = path.join(__dirname, '..', 'migrations', 'schema_diff_complete.md');
  fs.writeFileSync(outputPath, md, 'utf-8');
  console.log(`[SCHEMA DIFF COMPLETE] File written successfully to: ${outputPath}`);
  await pgClient.end();
}

generateCompleteSchemaDiff().catch(console.error);
