const Database = require('better-sqlite3');
const path = require('path');

function cleanDb(dbPath) {
  console.log('Cleaning test artifacts from:', dbPath);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = OFF');
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);

  db.transaction(() => {
    // Delete orphan rows referencing non-existent tenants
    for (const t of tables) {
      try {
        const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
        if (cols.includes('tenant_id')) {
          const res = db.prepare(`DELETE FROM ${t} WHERE tenant_id NOT IN (SELECT id FROM tenants)`).run();
          if (res.changes > 0) {
            console.log(`Cleaned ${res.changes} orphan tenant rows from ${t}`);
          }
        }
      } catch (e) {
        console.error(`Error cleaning ${t}:`, e.message);
      }
    }

    // Delete known test tenants from tenants table and cascading children
    const testTenants = db.prepare("SELECT id FROM tenants WHERE id LIKE 't_alpha_%' OR id LIKE 't_beta_%' OR id LIKE 'tenant_a_http_%' OR id LIKE 'tenant_b_http_%' OR id LIKE 't_del_sqlite_%' OR id LIKE 't_test_%' OR id LIKE 't_backup_%' OR id LIKE 't_doc_%' OR id LIKE 't_edge_%'").all().map(r => r.id);
    for (const tid of testTenants) {
      for (const t of tables) {
        try {
          const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
          if (cols.includes('tenant_id')) {
            db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(tid);
          }
        } catch (_) {}
      }
      try {
        db.prepare('DELETE FROM tenants WHERE id = ?').run(tid);
      } catch (_) {}
    }
  })();

  db.pragma('foreign_keys = ON');
  db.close();
  console.log('Cleaned test artifacts successfully.');
}

cleanDb(path.join(__dirname, '..', '..', 'data', 'latif_traders.db'));
if (require('fs').existsSync(path.join(__dirname, '..', '..', 'data', 'anonymized_test_copy.db'))) {
  cleanDb(path.join(__dirname, '..', '..', 'data', 'anonymized_test_copy.db'));
}
