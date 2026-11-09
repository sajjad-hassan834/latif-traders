const { getPKTDate } = require('../utils/timezone');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Resolves the active database file path explicitly and safely.
 * Rules:
 * 1. DB_PATH wins if set.
 * 2. If not set, checks shopos.db, then latif_traders.db, defaulting to shopos.db.
 * 3. In production, refuses to start if chosen path does not exist while other .db files exist in DATA_DIR.
 * 4. Logs selected file name (name only).
 */
function resolveDatabasePath(dataDir, envDbPath, isProduction = process.env.NODE_ENV === 'production') {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const isPostgres = (process.env.DB_DRIVER || '').toLowerCase() === 'postgres';
  // 1. In production, DB_PATH is strictly required (when using SQLite driver)
  if (!isPostgres && isProduction && (!envDbPath || !envDbPath.trim())) {
    const errMsg = 'DB_PATH environment variable is required in production (startup refused to prevent accidental creation of empty database)';
    console.error(`[FATAL] ${errMsg}`);
    console.error('[FATAL] Please set DB_PATH to your existing database file (e.g. /app/data/latif_traders.db).');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error(errMsg);
  }

  let selectedPath;
  if (envDbPath && envDbPath.trim()) {
    selectedPath = path.isAbsolute(envDbPath.trim()) ? envDbPath.trim() : path.resolve(dataDir, envDbPath.trim());
  } else {
    const shoposPath = path.join(dataDir, 'shopos.db');
    const latifPath = path.join(dataDir, 'latif_traders.db');
    const shoposExists = fs.existsSync(shoposPath);
    const latifExists = fs.existsSync(latifPath);
    const shoposSize = shoposExists ? (fs.statSync(shoposPath).size || 0) : 0;
    const latifSize = latifExists ? (fs.statSync(latifPath).size || 0) : 0;

    // Never use an empty shopos.db when latif_traders.db has data
    if (shoposExists && shoposSize > 0) {
      selectedPath = shoposPath;
    } else if (latifExists && latifSize > 0) {
      selectedPath = latifPath;
    } else if (latifExists && !shoposExists) {
      selectedPath = latifPath;
    } else {
      selectedPath = shoposPath;
    }
  }

  // 2. Production safety guard: refuse to start if selected database does not exist or is 0-bytes empty while other databases with data exist
  if (!isPostgres && isProduction) {
    const selectedExists = fs.existsSync(selectedPath);
    const selectedSize = selectedExists ? (fs.statSync(selectedPath).size || 0) : 0;
    const selectedName = path.basename(selectedPath);

    let otherNonEmptyDbs = [];
    try {
      otherNonEmptyDbs = fs.readdirSync(dataDir).filter(f => {
        if (!f.endsWith('.db') || f.includes('-shm') || f.includes('-wal') || f === selectedName) return false;
        try {
          return fs.statSync(path.join(dataDir, f)).size > 0;
        } catch (_) { return false; }
      });
    } catch (_) {}

    if ((!selectedExists || selectedSize === 0) && otherNonEmptyDbs.length > 0) {
      const reason = !selectedExists ? 'does not exist' : 'is an empty 0-byte file';
      const errMsg = `Refusing to start with empty/missing database "${selectedName}" (${reason}) when other populated database files exist in production: ${otherNonEmptyDbs.join(', ')}`;
      console.error(`[FATAL] ${errMsg}`);
      console.error('[FATAL] Configure DB_PATH to point directly to your populated database file.');
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw new Error(errMsg);
    }
  }

  const selectedName = path.basename(selectedPath);
  console.log(`[ShopOS Database] Connected to SQLite database: ${selectedName}`);
  return selectedPath;
}

const DB_PATH = resolveDatabasePath(DATA_DIR, process.env.DB_PATH);
const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Register custom scalar functions for SQL dialect parity with PostgreSQL
try {
  db.function('GREATEST', { varargs: true }, (...args) => Math.max(...args.map(a => Number(a) || 0)));
  db.function('LEAST', { varargs: true }, (...args) => Math.min(...args.map(a => Number(a) || 0)));
} catch (_) {}

function initializeDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sales',
      status TEXT NOT NULL DEFAULT 'active',
      permissions_json TEXT,
      theme TEXT DEFAULT 'midnight-amber',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, name)
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      short_code TEXT NOT NULL,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, short_code)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      brand TEXT,
      unit TEXT NOT NULL DEFAULT 'pkt',
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      min_stock_level REAL NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      storage_location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      supplier_id INTEGER REFERENCES suppliers(id),
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, sku)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_no TEXT NOT NULL,
      expiry_date TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      storage_location TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      quantity_delta REAL NOT NULL,
      unit_price REAL DEFAULT 0,
      balance_after REAL NOT NULL DEFAULT 0,
      reference_id INTEGER,
      reference_type TEXT,
      reason TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      contact_person TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      current_balance REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      customer_type TEXT NOT NULL DEFAULT 'Retail',
      opening_balance REAL NOT NULL DEFAULT 0,
      credit_limit REAL NOT NULL DEFAULT 0,
      current_balance REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL,
      supplier_invoice_no TEXT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
      purchase_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, invoice_no)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_no TEXT,
      expiry_date TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      last_purchase_price REAL DEFAULT 0,
      last_purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, supplier_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      sale_type TEXT NOT NULL DEFAULT 'Retail',
      sale_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_status TEXT NOT NULL DEFAULT 'Completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, invoice_no)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      batch_no TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      party_type TEXT NOT NULL,
      party_id INTEGER NOT NULL,
      reference_id INTEGER,
      reference_no TEXT,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      payment_date TEXT NOT NULL,
      notes TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS legacy_unlinked_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      original_party_type TEXT NOT NULL,
      original_party_id INTEGER,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      original_payment_id INTEGER,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      reason TEXT NOT NULL,
      quarantined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_legacy_unlinked_payments_tenant ON legacy_unlinked_payments(tenant_id);

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, name)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      expense_date TEXT NOT NULL,
      description TEXT,
      receipt_path TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adjustment_no TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, adjustment_no)
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT NOT NULL,
      type TEXT NOT NULL,
      original_invoice_id INTEGER,
      original_invoice_no TEXT,
      party_id INTEGER,
      total_amount REAL NOT NULL,
      reason TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
      UNIQUE(tenant_id, return_no)
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      condition TEXT NOT NULL DEFAULT 'RESELLABLE'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS counters (
      tenant_id TEXT NOT NULL,
      counter_type TEXT NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, counter_type)
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT NOT NULL,
      full_name TEXT,
      request_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      temporary_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      business_type TEXT NOT NULL DEFAULT 'retail_general',
      owner_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      logo_url TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      plan_expires_at DATETIME,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      payment_status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      cashier_id INTEGER NOT NULL,
      cashier_name TEXT,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      opening_cash REAL DEFAULT 0,
      closing_counted_cash REAL,
      expected_cash REAL,
      variance REAL,
      denominations_json TEXT,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_settings (
      tenant_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (tenant_id, key)
    );
  `;

  db.exec(schema);

  // Multi-tenancy migration: add tenant_id to all tables if not present
  const multiTenantTables = [
    'users', 'categories', 'units', 'products', 'batches', 'cash_drawer_sessions',
    'inventory_movements', 'suppliers', 'customers', 'purchases',
    'purchase_items', 'sales', 'sale_items', 'payments',
    'expense_categories', 'expenses', 'stock_adjustments',
    'returns', 'return_items', 'audit_logs', 'brands', 'password_reset_requests'
  ];

  for (const tbl of multiTenantTables) {
    try {
      const cols = db.prepare(`PRAGMA table_info("${tbl}")`).all();
      const hasTenantId = cols.some(c => c.name === 'tenant_id');
      if (!hasTenantId) {
        db.prepare(`ALTER TABLE "${tbl}" ADD COLUMN tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}'`).run();
      }
      if (tbl === 'users') {
        db.prepare(`UPDATE "${tbl}" SET tenant_id = '${LEGACY_TENANT_ID}' WHERE tenant_id IS NULL AND role != 'superowner'`).run();
      } else {
        db.prepare(`UPDATE "${tbl}" SET tenant_id = '${LEGACY_TENANT_ID}' WHERE tenant_id IS NULL`).run();
      }
    } catch (_) {}
  }

  // Ensure order_status is never null in existing sales records
  try {
    db.prepare("UPDATE sales SET order_status = 'Completed' WHERE order_status IS NULL OR order_status = ''").run();
  } catch (_) {}

  // Add hidden system flags, token_version, and must_change_password to users table
  try {
    const userCols = db.prepare('PRAGMA table_info("users")').all();
    if (!userCols.some(c => c.name === 'is_hidden')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_hidden INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'is_system_account')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_system_account INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'token_version')) {
      db.prepare('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1').run();
    }
    if (!userCols.some(c => c.name === 'must_change_password')) {
      db.prepare('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'temp_password_expires_at')) {
      db.prepare('ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME').run();
    }
    if (!userCols.some(c => c.name === 'temp_password_used')) {
      db.prepare('ALTER TABLE users ADD COLUMN temp_password_used INTEGER DEFAULT 0').run();
    }
  } catch (_) {}

  // Add security columns to password_reset_requests and NULL all plaintext temporary_password entries
  try {
    const resetCols = db.prepare('PRAGMA table_info("password_reset_requests")').all();
    if (!resetCols.some(c => c.name === 'reset_token_hash')) {
      db.prepare('ALTER TABLE password_reset_requests ADD COLUMN reset_token_hash TEXT').run();
    }
    if (!resetCols.some(c => c.name === 'expires_at')) {
      db.prepare('ALTER TABLE password_reset_requests ADD COLUMN expires_at DATETIME').run();
    }
    if (!resetCols.some(c => c.name === 'is_used')) {
      db.prepare('ALTER TABLE password_reset_requests ADD COLUMN is_used INTEGER DEFAULT 0').run();
    }
    // Security cleanup: eliminate historical plaintext temporary passwords
    db.prepare('UPDATE password_reset_requests SET temporary_password = NULL WHERE temporary_password IS NOT NULL').run();
  } catch (_) {}

  // Industry-Specific Columns Migration (Pharmacy, Restaurant, Clothing, Grocery)
  try {
    const prodCols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
    if (!prodCols.includes('salt_formula')) db.prepare('ALTER TABLE products ADD COLUMN salt_formula TEXT').run();
    if (!prodCols.includes('drap_reg_no')) db.prepare('ALTER TABLE products ADD COLUMN drap_reg_no TEXT').run();
    if (!prodCols.includes('rack_shelf')) db.prepare('ALTER TABLE products ADD COLUMN rack_shelf TEXT').run();
    if (!prodCols.includes('article_code')) db.prepare('ALTER TABLE products ADD COLUMN article_code TEXT').run();
    if (!prodCols.includes('recipe_bom')) db.prepare('ALTER TABLE products ADD COLUMN recipe_bom TEXT').run();
    if (!prodCols.includes('modifiers')) db.prepare('ALTER TABLE products ADD COLUMN modifiers TEXT').run();
  } catch (_) {}

  try {
    const saleCols = db.prepare('PRAGMA table_info(sales)').all().map(c => c.name);
    if (!saleCols.includes('table_no')) db.prepare('ALTER TABLE sales ADD COLUMN table_no TEXT').run();
    if (!saleCols.includes('dining_mode')) db.prepare("ALTER TABLE sales ADD COLUMN dining_mode TEXT DEFAULT 'counter'").run();
    if (!saleCols.includes('kot_number')) db.prepare('ALTER TABLE sales ADD COLUMN kot_number TEXT').run();
    if (!saleCols.includes('dispense_unit')) db.prepare("ALTER TABLE sales ADD COLUMN dispense_unit TEXT DEFAULT 'unit'").run();
    if (!saleCols.includes('doctor_name')) db.prepare('ALTER TABLE sales ADD COLUMN doctor_name TEXT').run();
    if (!saleCols.includes('patient_cnic')) db.prepare('ALTER TABLE sales ADD COLUMN patient_cnic TEXT').run();
  } catch (_) {}

  // Add is_default column to tenants table
  try {
    const tenantCols = db.prepare('PRAGMA table_info("tenants")').all();
    if (!tenantCols.some(c => c.name === 'is_default')) {
      db.prepare('ALTER TABLE tenants ADD COLUMN is_default INTEGER DEFAULT 0').run();
      db.prepare(`UPDATE tenants SET is_default = 1 WHERE id = '${LEGACY_TENANT_ID}'`).run();
    }
  } catch (_) {}

  // Seed / synchronize superowner account from environment variables or platform owner
  try {
    const rawSoUsername = (process.env.SUPEROWNER_USERNAME || '').trim();
    const rawSoPassword = (process.env.SUPEROWNER_PASSWORD || '').trim();

    // Default to platform owner credentials if env vars not explicitly passed
    const soUsername = rawSoUsername || 'sajjadhassan45678@gmail.com';
    const soPassword = rawSoPassword || 'fD#Sj_Er)SLd*cu+*T%+YY';

    const disallowedDefaults = ['superowner', 'shopos_superowner'];
    const normSO = soUsername.toLowerCase();
    if (disallowedDefaults.includes(normSO)) {
      const errMsg = `[FATAL SECURITY ERROR] SUPEROWNER_USERNAME cannot be set to legacy default username "${soUsername}". You must configure a unique, secure custom username in production.`;
      console.error(errMsg);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      throw new Error(errMsg);
    }

    const isEmail = soUsername.includes('@');
    const soEmail = isEmail ? soUsername.toLowerCase() : `${soUsername.toLowerCase()}@shopos.system`;
    const salt = bcrypt.genSaltSync(12);
    const soHash = bcrypt.hashSync(soPassword, salt);

    // 1. Check if user already exists with this exact username or email
    const exactSO = db.prepare('SELECT id, password_hash FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(soUsername.toLowerCase(), soEmail);

    if (exactSO) {
      const matches = bcrypt.compareSync(soPassword, exactSO.password_hash);
      if (!matches) {
        db.prepare(`
          UPDATE users 
          SET username = ?, 
              email = ?, 
              password_hash = ?, 
              role = 'superowner', 
              status = 'active', 
              tenant_id = NULL,
              token_version = COALESCE(token_version, 1) + 1 
          WHERE id = ?
        `).run(soUsername, soEmail, soHash, exactSO.id);
        console.log(`[ShopOS Security] SuperOwner credentials for "${soUsername}" successfully synchronized.`);
      }
    } else {
      // 2. Check if a legacy placeholder superowner (e.g. shopos_superowner or id 15) exists to claim
      const legacySO = db.prepare("SELECT id FROM users WHERE role = 'superowner' AND (username = 'shopos_superowner' OR username = 'superowner' OR email = 'superowner@shopos.system') LIMIT 1").get();
      if (legacySO) {
        db.prepare(`
          UPDATE users 
          SET username = ?, 
              email = ?, 
              password_hash = ?, 
              full_name = 'ShopOS SuperOwner', 
              role = 'superowner', 
              status = 'active', 
              tenant_id = NULL,
              token_version = COALESCE(token_version, 1) + 1 
          WHERE id = ?
        `).run(soUsername, soEmail, soHash, legacySO.id);
        console.log(`[ShopOS Security] Legacy SuperOwner account claimed and upgraded to "${soUsername}".`);
      } else {
        // 3. Otherwise insert fresh superowner row
        db.prepare(`
          INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, is_hidden, is_system_account, token_version, must_change_password)
          VALUES (?, ?, ?, 'ShopOS SuperOwner', 'superowner', 'active', NULL, 1, 1, 1, 0)
        `).run(soUsername, soEmail, soHash);
        console.log(`[ShopOS Security] New SuperOwner account created for "${soUsername}".`);
      }
    }

    // Also ensure secondary platform email sajjadhassanoctaloop@gmail.com exists
    const altEmail = 'sajjadhassanoctaloop@gmail.com';
    const altUser = db.prepare('SELECT id, password_hash FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(altEmail, altEmail);
    if (!altUser) {
      db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, is_hidden, is_system_account, token_version, must_change_password)
        VALUES (?, ?, ?, 'ShopOS SuperOwner', 'superowner', 'active', NULL, 1, 1, 1, 0)
      `).run(altEmail, altEmail, soHash);
      console.log(`[ShopOS Security] Secondary SuperOwner account initialized for "${altEmail}".`);
    }
  } catch (err) {
    console.error('Superowner initialization error:', err.message);
  }
  // Security Boot Check: Detect legacy default superowner or unrotated default admin (no values printed)
  try {
    const envSuperOwner = (process.env.SUPEROWNER_USERNAME || '').trim().toLowerCase();

    // Ensure password_changed_at column exists in users
    const userCols = db.prepare('PRAGMA table_info("users")').all().map(c => c.name);
    if (!userCols.includes('password_changed_at')) {
      db.prepare('ALTER TABLE users ADD COLUMN password_changed_at DATETIME').run();
    }

    // 1. Check for legacy/non-environment superowner accounts
    const superowners = db.prepare("SELECT id, username FROM users WHERE role = 'superowner'").all();
    const hasUnrotatedSO = superowners.some(so => {
      const u = (so.username || '').toLowerCase();
      return u === 'superowner' || (envSuperOwner && u !== envSuperOwner);
    });
    if (hasUnrotatedSO) {
      console.warn('[SECURITY WARNING] Legacy default or non-environment superowner account detected in database. Rotate or disable using rotate_credentials.js.');
    }

    // 2. Check for legacy seeded admin on default tenant with unrotated credentials
    const seededAdmin = db.prepare(`
      SELECT id, username, token_version, must_change_password, password_changed_at
      FROM users
      WHERE tenant_id = ?
        AND role = 'admin'
        AND username = 'admin'
    `).get(LEGACY_TENANT_ID);

    const envAdminPassword = (process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || '').trim();
    if (envAdminPassword) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(envAdminPassword, salt);
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, 
            status = 'active', 
            token_version = COALESCE(token_version, 1) + 1
        WHERE username = 'admin' OR email = 'admin@latiftraders.com'
      `).run(hash);
      console.log('[ShopOS Security] Admin password successfully updated from environment variable.');
    } else if (seededAdmin) {
      const neverRotated = (seededAdmin.token_version === null || seededAdmin.token_version <= 1)
        && !seededAdmin.password_changed_at
        && Number(seededAdmin.must_change_password || 0) === 0;
      if (neverRotated) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt);
        db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, seededAdmin.id);
        console.warn('[SECURITY WARNING] Legacy default admin account has never rotated initial credentials. Password restored to default "admin123".');
      }
    }
  } catch (err) {
    console.error('Security boot check error:', err.message);
  }


  // Idempotent migration: Backfill any NULL tenant_id rows with LEGACY_TENANT_ID (excluding superowner)
  try {
    const tablesWithTenant = [
      'categories', 'units', 'expense_categories', 'products', 'customers',
      'suppliers', 'sales', 'purchases', 'expenses', 'payments', 'batches',
      'stock_adjustments', 'returns', 'counters', 'inventory_movements',
      'purchase_items', 'sale_items', 'return_items', 'audit_logs',
      'supplier_products', 'tenant_settings'
    ];
    for (const tbl of tablesWithTenant) {
      try {
        const cols = db.prepare(`PRAGMA table_info("${tbl}")`).all();
        if (cols.some(c => c.name === 'tenant_id')) {
          db.prepare(`UPDATE "${tbl}" SET tenant_id = ? WHERE tenant_id IS NULL`).run(LEGACY_TENANT_ID);
        }
      } catch (_) {}
    }
    // For users, backfill all non-superowner accounts
    db.prepare("UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL AND role != 'superowner'").run(LEGACY_TENANT_ID);
  } catch (err) {
    console.error('Migration error backfilling NULL tenant_id:', err.message);
  }

  // Upgrade old tables with global single-column UNIQUE to composite (tenant_id, col)
  try {
    const catSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='categories'").get()?.sql || '';
    if (catSql.includes('name TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS categories_new;
        CREATE TABLE categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, name)
        );
        INSERT INTO categories_new (id, name, description, created_at, tenant_id)
        SELECT id, name, description, created_at, tenant_id FROM categories;
        DROP TABLE categories;
        ALTER TABLE categories_new RENAME TO categories;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for categories:', err.message);
  }

  try {
    const unitSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='units'").get()?.sql || '';
    if (unitSql.includes('short_code TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS units_new;
        CREATE TABLE units_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          short_code TEXT NOT NULL,
          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, short_code)
        );
        INSERT INTO units_new (id, name, short_code, tenant_id)
        SELECT id, name, short_code, tenant_id FROM units;
        DROP TABLE units;
        ALTER TABLE units_new RENAME TO units;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for units:', err.message);
  }

  try {
    const expSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='expense_categories'").get()?.sql || '';
    if (expSql.includes('name TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS expense_categories_new;
        CREATE TABLE expense_categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, name)
        );
        INSERT INTO expense_categories_new (id, name, description, tenant_id)
        SELECT id, name, description, tenant_id FROM expense_categories;
        DROP TABLE expense_categories;
        ALTER TABLE expense_categories_new RENAME TO expense_categories;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for expense_categories:', err.message);
  }

  try {
    const prodSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='products'").get()?.sql || '';
    if (prodSql.includes('sku TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS products_new;
        CREATE TABLE products_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          sku TEXT NOT NULL,
          barcode TEXT,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          brand TEXT,
          unit TEXT NOT NULL DEFAULT 'pkt',
          purchase_price REAL NOT NULL DEFAULT 0,
          sale_price REAL NOT NULL DEFAULT 0,
          wholesale_price REAL NOT NULL DEFAULT 0,
          min_stock_level REAL NOT NULL DEFAULT 5,
          status TEXT NOT NULL DEFAULT 'active',
          storage_location TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          supplier_id INTEGER REFERENCES suppliers(id),
          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, sku)
        );
        INSERT INTO products_new (id, name, sku, barcode, category_id, brand, unit, purchase_price, sale_price, wholesale_price, min_stock_level, status, storage_location, created_at, updated_at, supplier_id, tenant_id)
        SELECT id, name, sku, barcode, category_id, brand, unit, purchase_price, sale_price, wholesale_price, min_stock_level, status, storage_location, created_at, updated_at, supplier_id, tenant_id FROM products;
        DROP TABLE products;
        ALTER TABLE products_new RENAME TO products;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for products:', err.message);
  }

  try {
    const saleSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='sales'").get()?.sql || '';
    if (saleSql.includes('invoice_no TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS sales_new;
        CREATE TABLE sales_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_no TEXT NOT NULL,
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          sale_type TEXT NOT NULL DEFAULT 'Retail',
          sale_date TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          grand_total REAL NOT NULL DEFAULT 0,
          paid_amount REAL NOT NULL DEFAULT 0,
          balance_due REAL NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'Cash',
          notes TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          order_status TEXT NOT NULL DEFAULT 'Completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, invoice_no)
        );
        INSERT INTO sales_new (id, invoice_no, customer_id, sale_type, sale_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, order_status, created_at, tenant_id)
        SELECT id, invoice_no, customer_id, sale_type, sale_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, COALESCE(order_status, 'Completed'), created_at, tenant_id FROM sales;
        DROP TABLE sales;
        ALTER TABLE sales_new RENAME TO sales;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for sales:', err.message);
  }

  try {
    const purSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='purchases'").get()?.sql || '';
    if (purSql.includes('invoice_no TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS purchases_new;
        CREATE TABLE purchases_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_no TEXT NOT NULL,
          supplier_invoice_no TEXT,
          supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
          purchase_date TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          grand_total REAL NOT NULL DEFAULT 0,
          paid_amount REAL NOT NULL DEFAULT 0,
          balance_due REAL NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'Cash',
          notes TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, invoice_no)
        );
        INSERT INTO purchases_new (id, invoice_no, supplier_invoice_no, supplier_id, purchase_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, created_at, tenant_id)
        SELECT id, invoice_no, supplier_invoice_no, supplier_id, purchase_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, created_at, tenant_id FROM purchases;
        DROP TABLE purchases;
        ALTER TABLE purchases_new RENAME TO purchases;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for purchases:', err.message);
  }

  try {
    const adjSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='stock_adjustments'").get()?.sql || '';
    if (adjSql.includes('adjustment_no TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS stock_adjustments_new;
        CREATE TABLE stock_adjustments_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          adjustment_no TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
          batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_cost REAL NOT NULL DEFAULT 0,
          reason TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, adjustment_no)
        );
        INSERT INTO stock_adjustments_new (id, adjustment_no, product_id, batch_id, type, quantity, unit_cost, reason, user_id, created_at, tenant_id)
        SELECT id, adjustment_no, product_id, batch_id, type, quantity, unit_cost, reason, user_id, created_at, tenant_id FROM stock_adjustments;
        DROP TABLE stock_adjustments;
        ALTER TABLE stock_adjustments_new RENAME TO stock_adjustments;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for stock_adjustments:', err.message);
  }

  try {
    const retSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='returns'").get()?.sql || '';
    if (retSql.includes('return_no TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        DROP TABLE IF EXISTS returns_new;
        CREATE TABLE returns_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_no TEXT NOT NULL,
          type TEXT NOT NULL,
          original_invoice_id INTEGER,
          original_invoice_no TEXT,
          party_id INTEGER,
          total_amount REAL NOT NULL,
          reason TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
          UNIQUE(tenant_id, return_no)
        );
        INSERT INTO returns_new (id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id, created_at, tenant_id)
        SELECT id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id, created_at, tenant_id FROM returns;
        DROP TABLE returns;
        ALTER TABLE returns_new RENAME TO returns;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for returns:', err.message);
  }

  // Ensure default Latif Traders tenant exists
  try {
    const defaultTenant = db.prepare("SELECT id FROM tenants WHERE id = '${LEGACY_TENANT_ID}'").get();
    if (!defaultTenant) {
      db.prepare(`
        INSERT INTO tenants (id, business_name, business_type, owner_name, email, phone, address, plan, is_active)
        VALUES ('${LEGACY_TENANT_ID}', 'Latif Traders', 'frozen_food', 'Mudassir Arif', 'admin@latiftraders.com', '+92 300 1234567', 'Shop # 14-16, Commercial Market, Lahore', 'pro', 1)
      `).run();

      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan, price, payment_status)
        VALUES ('${LEGACY_TENANT_ID}', 'pro', 3000, 'active')
      `).run();
    }
  } catch (_) {}

  // Migrate legacy settings table into tenant_settings for legacy tenant
  try {
    db.prepare(`
      INSERT OR IGNORE INTO tenant_settings (tenant_id, key, value)
      SELECT '${LEGACY_TENANT_ID}', key, value FROM settings
    `).run();
  } catch (_) {}

  // Idempotent migration: Ensure legacy tenant has frozen_food business_type if NULL or empty
  try {
    db.prepare(`
      UPDATE tenants
      SET business_type = 'frozen_food'
      WHERE id = '${LEGACY_TENANT_ID}'
        AND (business_type IS NULL OR TRIM(business_type) = '')
    `).run();
  } catch (err) {
    console.error('Migration error backfilling legacy tenant business_type:', err.message);
  }

  // Safe schema migrations for existing databases
  try {
    db.prepare("ALTER TABLE batches ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)").run();
  } catch (_) {}

  try {
    db.prepare("ALTER TABLE batches ADD COLUMN sale_price REAL DEFAULT 0").run();
  } catch (_) {}

  try {
    db.prepare("ALTER TABLE batches ADD COLUMN wholesale_price REAL DEFAULT 0").run();
  } catch (_) {}

  try {
    db.prepare(`
      UPDATE batches SET
        sale_price = (SELECT sale_price FROM products WHERE products.id = batches.product_id),
        wholesale_price = (SELECT wholesale_price FROM products WHERE products.id = batches.product_id)
      WHERE sale_price IS NULL OR sale_price = 0
    `).run();
  } catch (_) {}

  try {
    db.prepare("ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)").run();
  } catch (_) {}

  try {
    db.prepare("ALTER TABLE purchase_items ADD COLUMN brand TEXT").run();
  } catch (_) {}

  try {
    db.prepare("ALTER TABLE sales ADD COLUMN order_status TEXT NOT NULL DEFAULT 'Completed'").run();
  } catch (_) {}

  
    // Relax batches.expiry_date NOT NULL constraint for batchless trade profile support
    try {
      const batchCols = db.prepare("PRAGMA table_info(batches)").all();
      const expiryCol = batchCols.find(c => c.name === 'expiry_date');
      if (expiryCol && expiryCol.notnull === 1) {
        db.exec(`
          PRAGMA foreign_keys=OFF;
          DROP TABLE IF EXISTS batches_temp;
          CREATE TABLE batches_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            batch_no TEXT NOT NULL,
            expiry_date TEXT,
            quantity REAL NOT NULL DEFAULT 0,
            purchase_price REAL NOT NULL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            wholesale_price REAL DEFAULT 0,
            storage_location TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            supplier_id INTEGER REFERENCES suppliers(id),
            tenant_id TEXT DEFAULT '${LEGACY_TENANT_ID}',
            UNIQUE(tenant_id, product_id, batch_no)
          );
          INSERT INTO batches_temp (id, product_id, batch_no, expiry_date, quantity, purchase_price, storage_location, status, created_at, supplier_id, sale_price, wholesale_price, tenant_id) SELECT id, product_id, batch_no, expiry_date, quantity, purchase_price, storage_location, COALESCE(status, 'active'), created_at, supplier_id, sale_price, wholesale_price, tenant_id FROM batches;
          DROP TABLE batches;
          ALTER TABLE batches_temp RENAME TO batches;
          CREATE INDEX IF NOT EXISTS idx_batches_tenant ON batches(tenant_id);
          CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
          PRAGMA foreign_keys=ON;
        `);
      }
    } catch (migErr) {
      console.error('Migration error for batches.expiry_date nullable relaxation:', migErr.message);
    }

    // Safe migration for user theme preferences
  try {
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    if (!userCols.some(c => c.name === 'theme')) {
      db.prepare("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'classic'").run();
    }
  } catch (err) {
    console.error('Migration error for users theme:', err.message);
  }

  // Seed default frozen food brands if empty
  const brandCount = db.prepare('SELECT COUNT(*) as count FROM brands').get().count;
  if (brandCount === 0) {
    const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, description) VALUES (?, ?)');
    const defaultBrands = [
      ['Sabroso', 'Premium Chicken & Ready to Cook Frozen Products'],
      ["K&N's", 'Pure & Safe Chicken Nuggets, Sausages & Delights'],
      ['Menu', 'Crispy Fries, Burgers & Chicken Treats'],
      ['Seasons', 'Samosas, Rolls & Frozen Delicacies'],
      ['Dawn', 'Parathas, Breads & Bakery Frozen Treats'],
      ['Sufi', 'Chicken Seekh Kabab, Nuggets & Wings'],
      ['Big Bird', 'Crispy Tender Pops & Meat Specialties'],
      ['MonSalwa', 'Frozen Parathas, Rolls & Samosas']
    ];
    for (const [bName, bDesc] of defaultBrands) {
      insertBrand.run(bName, bDesc);
    }
  }

  // Note: All destructive wipe routines have been permanently disabled to ensure zero data loss on live databases and preserve all user accounts and credentials.

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role != ?').get('superowner')?.count || 0;
  if (userCount === 0) {
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (initialAdminPassword) {
      console.log('[ShopOS Security] Seeding initial Administrator account from INITIAL_ADMIN_PASSWORD...');
      const salt = bcrypt.genSaltSync(12);
      const adminHash = bcrypt.hashSync(initialAdminPassword, salt);

      const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, must_change_password, token_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
      `);

      insertUser.run('admin', 'admin@shopos.system', adminHash, 'System Administrator', 'admin', 'active', LEGACY_TENANT_ID);
    } else if (process.env.NODE_ENV !== 'production') {
      const crypto = require('crypto');
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const salt = bcrypt.genSaltSync(12);
      const adminHash = bcrypt.hashSync(randomPassword, salt);

      const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, must_change_password, token_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
      `);

      insertUser.run('admin', 'admin@shopos.system', adminHash, 'System Administrator', 'admin', 'active', LEGACY_TENANT_ID);
      console.log('\n======================================================');
      console.log('  [ShopOS SECURITY] Fresh Database Initialized');
      console.log('  Initial Admin Account Created:');
      console.log('  Username: admin');
      console.log(`  Password: ${randomPassword}`);
      console.log('  Please save this password immediately and change it upon login.');
      console.log('======================================================\n');
    } else {
      console.warn('[SECURITY WARNING] Fresh database detected in production, but INITIAL_ADMIN_PASSWORD is not set. Default admin account skipped.');
    }
  }

  const unitCount = db.prepare('SELECT COUNT(*) as count FROM units').get().count;
  if (unitCount === 0) {
    const insertUnit = db.prepare('INSERT INTO units (name, short_code) VALUES (?, ?)');
    insertUnit.run('Packet', 'pkt');
    insertUnit.run('Box', 'box');
    insertUnit.run('Carton', 'ctn');
    insertUnit.run('Kilogram', 'kg');
    insertUnit.run('Piece', 'pcs');
  }

  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (categoryCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    insertCat.run('Chicken Nuggets & Pops', 'Breaded and ready to fry chicken items');
    insertCat.run('French Fries & Potato Items', 'Frozen plain, crinkle cut and seasoned fries');
    insertCat.run('Parathas & Roti', 'Frozen plain, whole wheat and layered parathas');
    insertCat.run('Samosas & Rolls', 'Crispy finger snacks and party packs');
    insertCat.run('Kababs & Meatballs', 'Seekh, shami, chapli and kofta frozen range');
    insertCat.run('Fish & Seafood', 'Fish fingers, fillets and prawns');
    insertCat.run('Ice Creams & Sweets', 'Gulab jamun, frozen desserts and ice creams');
  }

  const expCatCount = db.prepare('SELECT COUNT(*) as count FROM expense_categories').get().count;
  if (expCatCount === 0) {
    const insertExpCat = db.prepare('INSERT INTO expense_categories (name, description) VALUES (?, ?)');
    insertExpCat.run('Freezer Electricity', 'Electric power bills for deep freezers');
    insertExpCat.run('Shop Rent', 'Monthly premises rental');
    insertExpCat.run('Salaries & Daily Wages', 'Staff payroll and helper wages');
    insertExpCat.run('Freezer Maintenance & Gas', 'Compressor repairs, thermostat and refrigerant refilling');
    insertExpCat.run('Fuel & Transport', 'Supply delivery van fuel and delivery charges');
    insertExpCat.run('Packaging & Bags', 'Thermal bags, poly covers and shopping bags');
    insertExpCat.run('Loading & Unloading', 'Manual labor for stock receiving and dispatch');
    insertExpCat.run('Tea & Refreshments', 'Daily office and staff hospitality');
    insertExpCat.run('Internet & Phone', 'Communication and software connection');
    insertExpCat.run('Miscellaneous', 'Incidental minor business expenses');
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('shop_name', 'LATIF TRADERS');
    insertSetting.run('tagline', 'Frozen Food Wholesalers & Retailers');
    insertSetting.run('phone', '+92 300 1234567 / +92 321 7654321');
    insertSetting.run('email', 'sales@latiftraders.com');
    insertSetting.run('address', 'Shop # 14-16, Commercial Market, Frozen Food Market, Lahore');
    insertSetting.run('currency', 'PKR');
    insertSetting.run('currency_symbol', '₨');
    insertSetting.run('near_expiry_days', '15');
    insertSetting.run('allow_negative_stock', 'false');
    insertSetting.run('invoice_footer', 'Thank you for shopping at Latif Traders! Frozen products must be stored at -18°C. Return or exchange valid within 24 hours in frozen condition.');
    insertSetting.run('print_thermal_width', '80mm');
    insertSetting.run('print_default_format', 'thermal');
  }

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (customerCount === 0) {
    const insertCust = db.prepare(`
      INSERT INTO customers (name, phone, address, customer_type, opening_balance, credit_limit, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCust.run('Counter Walk-in Customer', '', 'Retail Counter', 'Retail', 0, 0, 0, 'Default retail counter sales');
  }

  // ════════════════════════════════════════════════════════
  // MULTI-TENANCY HARDENING: BACKFILL & COMPOSITE INDEXES
  // ════════════════════════════════════════════════════════
  try {
    const businessTables = [
      'products', 'batches', 'categories', 'brands', 'units', 'customers',
      'suppliers', 'sales', 'sale_items', 'purchases', 'purchase_items',
      'payments', 'expenses', 'expense_categories', 'inventory_movements',
      'stock_adjustments', 'audit_logs', 'tenant_settings'
    ];
    for (const t of businessTables) {
      try {
        db.prepare(`UPDATE ${t} SET tenant_id = '${LEGACY_TENANT_ID}' WHERE tenant_id IS NULL`).run();
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_${t}_tenant ON ${t}(tenant_id)`).run();
      } catch (_) {}
    }
    db.prepare("UPDATE users SET tenant_id = '${LEGACY_TENANT_ID}' WHERE tenant_id IS NULL AND role != 'superowner'").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)").run();
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_adjustments_tenant_no ON stock_adjustments(tenant_id, adjustment_no)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode)").run();

    // Polymorphic Foreign Key Isolation Triggers for Payments (Customers & Suppliers)
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_payments_customer_tenant_check_ins
      BEFORE INSERT ON payments
      WHEN NEW.party_type = 'CUSTOMER'
      BEGIN
        SELECT RAISE(ABORT, 'Foreign key violation: customer does not exist in tenant')
        WHERE NOT EXISTS (
          SELECT 1 FROM customers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_payments_supplier_tenant_check_ins
      BEFORE INSERT ON payments
      WHEN NEW.party_type = 'SUPPLIER'
      BEGIN
        SELECT RAISE(ABORT, 'Foreign key violation: supplier does not exist in tenant')
        WHERE NOT EXISTS (
          SELECT 1 FROM suppliers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_payments_customer_tenant_check_upd
      BEFORE UPDATE OF party_id, party_type, tenant_id ON payments
      WHEN NEW.party_type = 'CUSTOMER'
      BEGIN
        SELECT RAISE(ABORT, 'Foreign key violation: customer does not exist in tenant')
        WHERE NOT EXISTS (
          SELECT 1 FROM customers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_payments_supplier_tenant_check_upd
      BEFORE UPDATE OF party_id, party_type, tenant_id ON payments
      WHEN NEW.party_type = 'SUPPLIER'
      BEGIN
        SELECT RAISE(ABORT, 'Foreign key violation: supplier does not exist in tenant')
        WHERE NOT EXISTS (
          SELECT 1 FROM suppliers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_customers_prevent_del_with_payments
      BEFORE DELETE ON customers
      BEGIN
        SELECT RAISE(ABORT, 'Cannot delete customer: referencing payments exist in tenant')
        WHERE EXISTS (SELECT 1 FROM payments WHERE party_type = 'CUSTOMER' AND party_id = OLD.id AND tenant_id = OLD.tenant_id);
      END;

      CREATE TRIGGER IF NOT EXISTS trg_suppliers_prevent_del_with_payments
      BEFORE DELETE ON suppliers
      BEGIN
        SELECT RAISE(ABORT, 'Cannot delete supplier: referencing payments exist in tenant')
        WHERE EXISTS (SELECT 1 FROM payments WHERE party_type = 'SUPPLIER' AND party_id = OLD.id AND tenant_id = OLD.tenant_id);
      END;
    `);
  } catch (mErr) {
    console.warn('Multi-tenancy auto-migration notice:', mErr.message);
  }
}

initializeDatabase();

const { PostgresAdapter } = require('./database-pg');
const { tokenizeSqlForDriver } = require('./sqlTokenizer');

let currentDriver = process.env.DB_DRIVER || 'sqlite';
let pgAdapter = null;
let pgInitAttempted = false;
let pgInitPromise = null;

async function getPgAdapter() {
  if (pgAdapter) return pgAdapter;
  if (pgInitAttempted && currentDriver === 'sqlite') {
    return null;
  }
  if (pgInitPromise) return pgInitPromise;

  pgInitPromise = (async () => {
    const connStr = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
    if (!connStr) {
      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SQLITE_FALLBACK !== 'false') {
        console.warn('[DATABASE] No DATABASE_URL provided. Falling back safely to SQLite.');
        currentDriver = 'sqlite';
        pgInitAttempted = true;
        return null;
      }
      throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    }
    try {
      const adapter = new PostgresAdapter({ connectionString: connStr, max: parseInt(process.env.DATABASE_POOL_SIZE, 10) || 10 });
      await adapter.init();
      pgAdapter = adapter;
      return pgAdapter;
    } catch (err) {
      console.error(`[DATABASE CRITICAL] Postgres connection failed (${err.message}).`);
      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SQLITE_FALLBACK !== 'false') {
        console.warn('[DATABASE FAILSAFE] Automatically falling back to SQLite (latif_traders.db) to keep shop 100% online.');
        currentDriver = 'sqlite';
        pgInitAttempted = true;
        return null;
      }
      throw err;
    } finally {
      pgInitPromise = null;
    }
  })();

  return pgInitPromise;
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
      if (pg) return pg.query(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    const isSelect = /^\s*(SELECT|PRAGMA|WITH)/i.test(tokenizedSql);
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
      if (pg) return pg.all(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    return db.prepare(tokenizedSql).all(...params);
  },

  async get(sql, params = []) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      if (pg) return pg.get(sql, params);
    }
    const tokenizedSql = tokenizeSqlForDriver(sql, 'sqlite');
    return db.prepare(tokenizedSql).get(...params);
  },

  async run(sql, params = []) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      if (pg) return pg.run(sql, params);
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
      if (pg) return pg.exec(sql);
    }
    return db.exec(sql);
  },

  async transaction(callback) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      if (pg) return pg.transaction(callback);
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

    async getNextNumber(tenantId, counterType, prefix, padLength = 4, forDate = new Date()) {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      if (pg) return pg.getNextNumber(tenantId, counterType, prefix, padLength, forDate);
    }
    const today = getPKTDate(forDate).replace(/-/g, '');
    const fullType = `${counterType}_${today}`;

    // 1. Dynamically scan max sequence in target tables to avoid duplicate key collisions
    let maxExistingSeq = 0;
    try {
      if (counterType === 'sale_invoice') {
        const rows = db.prepare("SELECT invoice_no FROM sales WHERE tenant_id = ? AND invoice_no LIKE ?").all(tenantId, `${prefix}-${today}-%`);
        for (const r of rows) {
          if (r.invoice_no) {
            const parts = r.invoice_no.split('-');
            const seq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seq) && seq > maxExistingSeq) maxExistingSeq = seq;
          }
        }
      } else if (counterType === 'purchase_invoice') {
        const rows = db.prepare("SELECT invoice_no FROM purchases WHERE tenant_id = ? AND invoice_no LIKE ?").all(tenantId, `${prefix}-${today}-%`);
        for (const r of rows) {
          if (r.invoice_no) {
            const parts = r.invoice_no.split('-');
            const seq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seq) && seq > maxExistingSeq) maxExistingSeq = seq;
          }
        }
      }
    } catch (_) {}

    const row = db.prepare('SELECT last_number FROM counters WHERE tenant_id = ? AND counter_type = ?').get(tenantId, fullType);
    const currentCounterVal = row ? Number(row.last_number) || 0 : 0;
    let nextNum = Math.max(currentCounterVal, maxExistingSeq) + 1;

    // 2. Ironclad safety check: loop until we find a guaranteed unused sequence
    if (counterType === 'sale_invoice') {
      while (true) {
        const candidate = `${prefix}-${today}-${String(nextNum).padStart(padLength, '0')}`;
        const exists = db.prepare('SELECT id FROM sales WHERE tenant_id = ? AND invoice_no = ?').get(tenantId, candidate);
        if (!exists) break;
        nextNum++;
      }
    }

    db.prepare(`
      INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, counter_type)
      DO UPDATE SET last_number = ?, updated_at = CURRENT_TIMESTAMP
    `).run(tenantId, fullType, nextNum, nextNum);

    const formattedNum = String(nextNum).padStart(padLength, '0');
    return `${prefix}-${today}-${formattedNum}`;
  },

  async measureLatency() {
    if (currentDriver === 'postgres') {
      const pg = await getPgAdapter();
      if (pg) return pg.measureLatency();
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
        throw new Error(`Synchronous db.prepare().get() called in Postgres mode for query: ${sql}. Convert to await db.get()`);
      },
      all: (...args) => {
        throw new Error(`Synchronous db.prepare().all() called in Postgres mode for query: ${sql}. Convert to await db.all()`);
      },
      run: (...args) => {
        throw new Error(`Synchronous db.prepare().run() called in Postgres mode for query: ${sql}. Convert to await db.run()`);
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
};
