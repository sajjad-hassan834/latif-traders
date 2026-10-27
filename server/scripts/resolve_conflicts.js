const fs = require('fs');

// 1. server/index.js
let idx = fs.readFileSync('server/index.js', 'utf8');
idx = idx.replace(/<<<<<<< HEAD[\s\S]*?driver: 'sqlite',[\s\S]*?=======[\s\S]*?driver: db\.getDriver \? db\.getDriver\(\) : 'sqlite',[\s\S]*?>>>>>>> 63dbf46/,
`    const latencyMs = db.measureLatency ? await db.measureLatency() : 0;
    res.json({
      status: 'ok',
      app: 'ShopOS Management System',
      driver: db.getDriver ? db.getDriver() : 'sqlite',
      latency_ms: latencyMs,
      timestamp: new Date().toISOString()
    });`);
idx = idx.replace(/<<<<<<< HEAD[\s\S]*?console\.log\('\\n[\s\S]*?module\.exports\.server = server;[\s\S]*?=======[\s\S]*?>>>>>>> 63dbf46/,
`    console.log('\\n======================================================');
    console.log('  ShopOS - Multi-Tenant Point of Sale Server');
    console.log(\`  Local:   http://localhost:\${PORT}\`);
    console.log('  Network: Accessible across LAN devices');
    console.log(\`  API:     http://localhost:\${PORT}/api\`);
    console.log('======================================================\\n');
  });
}

module.exports = app;
module.exports.server = server;`);
fs.writeFileSync('server/index.js', idx, 'utf8');

// List of files where all conflicts take HEAD
const headFiles = [
  'server/middleware/audit.js',
  'server/middleware/auth.js',
  'server/controllers/authController.js',
  'server/controllers/backupController.js',
  'server/controllers/partyController.js',
  'server/controllers/paymentController.js',
  'server/controllers/reportController.js',
  'server/controllers/saleController.js',
  'server/controllers/superownerController.js',
  'server/controllers/userController.js',
  'server/controllers/expenseController.js',
  'server/controllers/purchaseController.js',
  'server/controllers/productController.js'
];

for (const file of headFiles) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/<<<<<<< HEAD([\s\S]*?)=======[\s\S]*?>>>>>>> 63dbf46/g, '$1');
  fs.writeFileSync(file, content, 'utf8');
}

// 15. server/services/ledgerService.js
// Keep async implementation from 63dbf46, but retain Fasial Walton opening balance sanitization from HEAD
let ls = fs.readFileSync('server/services/ledgerService.js', 'utf8');
// In ledgerService, conflict is around Fasial Walton opening balance:
// HEAD has the opening balance sanitization:
const fasialSanitization = `
  const isFasialLatif = tenantId === LEGACY_TENANT_ID && customer.name && (customer.name.toLowerCase().includes('fasial') || customer.name.toLowerCase().includes('faisal'));

  // Sanitize duplicate / corrupted opening balance of 21,940 for Fasial Walton
  if (isFasialLatif || Number(customer.opening_balance) === 21940) {
    customer.opening_balance = 0;
  }
`;
ls = ls.replace(/<<<<<<< HEAD([\s\S]*?)=======([\s\S]*?)>>>>>>> 63dbf46/, fasialSanitization);
fs.writeFileSync('server/services/ledgerService.js', ls, 'utf8');

// 16. server/config/database.js
let dbContent = fs.readFileSync('server/config/database.js', 'utf8');
// Remove line 729-732 conflict
dbContent = dbContent.replace(/<<<<<<< HEAD\r?\n\r?\n=======\r?\n>>>>>>> 63dbf46[^\n]*\r?\n/g, '');
// stock_adjustments conflict: keep HEAD
dbContent = dbContent.replace(/<<<<<<< HEAD([\s\S]*?)tenant_id TEXT DEFAULT '\$\{LEGACY_TENANT_ID\}',[\s\S]*?>>>>>>> 63dbf46[^\n]*\r?\n/g, (m, p1) => {
  return p1 + `tenant_id TEXT DEFAULT '\${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, adjustment_no)
        );
        INSERT INTO stock_adjustments_new (id, adjustment_no, product_id, batch_id, type, quantity, unit_cost, reason, user_id, created_at, tenant_id)
        SELECT id, adjustment_no, product_id, batch_id, type, quantity, unit_cost, reason, user_id, created_at, tenant_id FROM stock_adjustments;\n`;
});
// returns conflict: keep HEAD
dbContent = dbContent.replace(/<<<<<<< HEAD([\s\S]*?)tenant_id TEXT DEFAULT '\$\{LEGACY_TENANT_ID\}',[\s\S]*?>>>>>>> 63dbf46[^\n]*\r?\n/g, (m, p1) => {
  return p1 + `tenant_id TEXT DEFAULT '\${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, return_no)
        );
        INSERT INTO returns_new (id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id, created_at, tenant_id)
        SELECT id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id, created_at, tenant_id FROM returns;\n`;
});
// line 811-814 conflict
dbContent = dbContent.replace(/<<<<<<< HEAD\r?\n\r?\n=======\r?\n>>>>>>> 63dbf46[^\n]*\r?\n/g, '');

// Final export conflict in database.js:
// We want dualDb, but getPgAdapter must NOT have fallback URL!
const dualDbSection = `const { PostgresAdapter } = require('./database-pg');
const { tokenizeSqlForDriver } = require('./sqlTokenizer');

let currentDriver = process.env.DB_DRIVER || 'sqlite';
let pgAdapter = null;

async function getPgAdapter() {
  if (!pgAdapter) {
    const connStr = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    }
    pgAdapter = new PostgresAdapter({ connectionString: connStr, max: 20 });
    await pgAdapter.init();
  }
  return pgAdapter;
}

const dualDb = {
  // Underlying drivers & diagnostics
  sqliteDb: db,
  getSqliteDb: () => db,
  getPgAdapter,
  getDriver: () => currentDriver,
  setDriver: (d) => { currentDriver = d; },

  async query(sql, params = []) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.query(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    const isSelect = /^\\s*(SELECT|PRAGMA|WITH)/i.test(tokenizedSql);
    if (isSelect) {
      const rows = db.prepare(tokenizedSql).all(...params);
      return { rows, rowCount: rows.length };
    } else {
      const res = db.prepare(tokenizedSql).run(...params);
      return { rows: [], rowCount: res.changes, lastInsertRowid: res.lastInsertRowid };
    }
  },

  async all(sql, params = []) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.all(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    return db.prepare(tokenizedSql).all(...params);
  },

  async get(sql, params = []) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.get(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    return db.prepare(tokenizedSql).get(...params);
  },

  async run(sql, params = []) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.run(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    const res = db.prepare(tokenizedSql).run(...params);
    return {
      rowCount: res.changes,
      lastInsertRowid: res.lastInsertRowid
    };
  },

  async exec(sql) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.exec(sql);
    }
    return db.exec(sql);
  },

  async transaction(callback) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.transaction(callback);
    }
    db.prepare('BEGIN IMMEDIATE').run();
    try {
      const result = await callback(dualDb);
      db.prepare('COMMIT').run();
      return result;
    } catch (err) {
      try { db.prepare('ROLLBACK').run(); } catch (_) {}
      throw err;
    }
  },

  async getNextNumber(tenantId, counterType, prefix, padLength = 4) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.getNextNumber(tenantId, counterType, prefix, padLength);
    }
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fullType = \`\${counterType}_\${today}\`;
    db.prepare(\`
      INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, counter_type)
      DO UPDATE SET last_number = counters.last_number + 1, updated_at = CURRENT_TIMESTAMP
    \`).run(tenantId, fullType);

    const row = db.prepare('SELECT last_number FROM counters WHERE tenant_id = ? AND counter_type = ?').get(tenantId, fullType);
    const num = row ? row.last_number : 1;
    const formattedNum = String(num).padStart(padLength, '0');
    return \`\${prefix}-\${today}-\${formattedNum}\`;
  },

  async measureLatency() {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      return pg.measureLatency();
    }
    const start = Date.now();
    db.prepare('SELECT 1').get();
    return Date.now() - start;
  },

  prepare(sql) {
    const tokenizedSql = tokenizeSqlForDriver(sql, currentDriver);
    if (currentDriver === 'sqlite') {
      return db.prepare(tokenizedSql);
    }
    return {
      get: (...args) => {
        throw new Error(\`Synchronous db.prepare().get() called in Postgres mode for query: \${sql}. Convert to await db.get()\`);
      },
      all: (...args) => {
        throw new Error(\`Synchronous db.prepare().all() called in Postgres mode for query: \${sql}. Convert to await db.all()\`);
      },
      run: (...args) => {
        throw new Error(\`Synchronous db.prepare().run() called in Postgres mode for query: \${sql}. Convert to await db.run()\`);
      }
    };
  },

  pragma(p) {
    if (currentDriver === 'sqlite') {
      return db.pragma(p);
    }
    return null;
  }
};

module.exports = {
  db: dualDb,
  sqliteDb: db,
  getPgAdapter,
  initializeDatabase,
  DB_PATH,
  DATA_DIR,
  resolveDatabasePath
};`;

dbContent = dbContent.replace(/<<<<<<< HEAD[\s\S]*?\/\/\s*SQLite async and compatibility helpers[\s\S]*?>>>>>>> 63dbf46[^\n]*\r?\n/, dualDbSection + '\n');
fs.writeFileSync('server/config/database.js', dbContent, 'utf8');

console.log('All 16 conflict files successfully resolved.');
