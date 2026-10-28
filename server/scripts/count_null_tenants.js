const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'data', 'latif_traders.db');
if (!fs.existsSync(dbPath)) {
  console.log('Database file not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
const counts = {};
let totalNulls = 0;

for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all();
  if (cols.some(c => c.name === 'tenant_id')) {
    const res = db.prepare(`SELECT COUNT(*) as c FROM "${t}" WHERE tenant_id IS NULL`).get();
    counts[t] = res.c;
    totalNulls += res.c;
  }
}

console.log('NULL tenant_id row counts per table:');
console.table(counts);
console.log('Total NULL rows across all tenant tables:', totalNulls);
