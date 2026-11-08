const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const testDbPath = path.resolve(__dirname, '../data/benchmark_index_test.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new Database(testDbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('Generating 50,000 synthetic products in SQLite for index benchmark...');
db.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insert = db.prepare('INSERT INTO products (tenant_id, name, sku, barcode) VALUES (?, ?, ?, ?)');
const insertMany = db.transaction((count) => {
  for (let i = 1; i <= count; i++) {
    const tenantId = i % 5 === 0 ? 'tenant_b' : 'tenant_a';
    const sku = `SKU-${String(i).padStart(6, '0')}`;
    const barcode = `8901234${String(i).padStart(6, '0')}`;
    insert.run(tenantId, `Product ${i}`, sku, barcode);
  }
});

const genStart = Date.now();
insertMany(50000);
console.log(`Inserted 50,000 rows in ${Date.now() - genStart}ms.`);

console.log('Measuring: CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode)...');
const start = process.hrtime.bigint();
db.exec('CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode);');
const end = process.hrtime.bigint();

const durationMs = Number(end - start) / 1e6;
console.log(`------------------------------------------------------------------------`);
console.log(`CREATE INDEX Duration on 50,000 rows: ${durationMs.toFixed(2)} ms`);
console.log(`Verdict: ${durationMs < 500 ? 'SAFE FOR BOOT (well under 500ms)' : 'REQUIRES BACKGROUND / MIGRATION'}`);
console.log(`------------------------------------------------------------------------`);

db.close();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
