const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'latif_traders.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
      theme TEXT DEFAULT 'classic',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT 'latif_001',
      UNIQUE(tenant_id, name)
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      short_code TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'latif_001',
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
      tenant_id TEXT DEFAULT 'latif_001',
      UNIQUE(tenant_id, sku)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_no TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
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
      tenant_id TEXT DEFAULT 'latif_001',
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
      tenant_id TEXT DEFAULT 'latif_001',
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
      tenant_id TEXT DEFAULT 'latif_001',
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

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      tenant_id TEXT DEFAULT 'latif_001',
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
      tenant_id TEXT DEFAULT 'latif_001',
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
      tenant_id TEXT DEFAULT 'latif_001',
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
    'users', 'categories', 'units', 'products', 'batches',
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
        db.prepare(`ALTER TABLE "${tbl}" ADD COLUMN tenant_id TEXT DEFAULT 'latif_001'`).run();
      }
      if (tbl === 'users') {
        db.prepare(`UPDATE "${tbl}" SET tenant_id = 'latif_001' WHERE tenant_id IS NULL AND role != 'superowner'`).run();
      } else {
        db.prepare(`UPDATE "${tbl}" SET tenant_id = 'latif_001' WHERE tenant_id IS NULL`).run();
      }
    } catch (_) {}
  }

  // Ensure order_status is never null in existing sales records
  try {
    db.prepare("UPDATE sales SET order_status = 'Completed' WHERE order_status IS NULL OR order_status = ''").run();
  } catch (_) {}

  // Add hidden system flags to users table
  try {
    const userCols = db.prepare('PRAGMA table_info("users")').all();
    if (!userCols.some(c => c.name === 'is_hidden')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_hidden INTEGER DEFAULT 0').run();
    }
    if (!userCols.some(c => c.name === 'is_system_account')) {
      db.prepare('ALTER TABLE users ADD COLUMN is_system_account INTEGER DEFAULT 0').run();
    }
  } catch (_) {}

  // Seed / update hidden superowner account from environment variables
  try {
    const soUsername = process.env.SUPEROWNER_USERNAME || 'shopos_superowner';
    const soPassword = process.env.SUPEROWNER_PASSWORD || 'SuperOwner@ShopOS#2026!SecureKey';
    const salt = bcrypt.genSaltSync(12);
    const soHash = bcrypt.hashSync(soPassword, salt);

    const existingSO = db.prepare('SELECT id FROM users WHERE role = ? OR username = ?').get('superowner', soUsername);
    if (existingSO) {
      db.prepare(`
        UPDATE users SET 
          username = ?,
          password_hash = ?,
          full_name = 'ShopOS SuperOwner',
          role = 'superowner',
          status = 'active',
          tenant_id = NULL,
          is_hidden = 1,
          is_system_account = 1
        WHERE id = ?
      `).run(soUsername, soHash, existingSO.id);
    } else {
      db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, is_hidden, is_system_account)
        VALUES (?, 'superowner@shopos.system', ?, 'ShopOS SuperOwner', 'superowner', 'active', NULL, 1, 1)
      `).run(soUsername, soHash);
    }
  } catch (err) {
    console.error('Superowner seed error:', err.message);
  }

  // Upgrade old tables with global single-column UNIQUE to composite (tenant_id, col)
  try {
    const catSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='categories'").get()?.sql || '';
    if (catSql.includes('name TEXT UNIQUE')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          tenant_id TEXT DEFAULT 'latif_001',
          UNIQUE(tenant_id, name)
        );
        INSERT INTO categories_new (id, name, description, created_at, tenant_id)
        SELECT id, name, description, created_at, COALESCE(tenant_id, 'latif_001') FROM categories;
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
        CREATE TABLE units_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          short_code TEXT NOT NULL,
          tenant_id TEXT DEFAULT 'latif_001',
          UNIQUE(tenant_id, short_code)
        );
        INSERT INTO units_new (id, name, short_code, tenant_id)
        SELECT id, name, short_code, COALESCE(tenant_id, 'latif_001') FROM units;
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
        CREATE TABLE expense_categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          tenant_id TEXT DEFAULT 'latif_001',
          UNIQUE(tenant_id, name)
        );
        INSERT INTO expense_categories_new (id, name, description, tenant_id)
        SELECT id, name, description, COALESCE(tenant_id, 'latif_001') FROM expense_categories;
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
          tenant_id TEXT DEFAULT 'latif_001',
          UNIQUE(tenant_id, sku)
        );
        INSERT INTO products_new (id, name, sku, barcode, category_id, brand, unit, purchase_price, sale_price, wholesale_price, min_stock_level, status, storage_location, created_at, updated_at, supplier_id, tenant_id)
        SELECT id, name, sku, barcode, category_id, brand, unit, purchase_price, sale_price, wholesale_price, min_stock_level, status, storage_location, created_at, updated_at, supplier_id, COALESCE(tenant_id, 'latif_001') FROM products;
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
          tenant_id TEXT DEFAULT 'latif_001',
          UNIQUE(tenant_id, invoice_no)
        );
        INSERT INTO sales_new (id, invoice_no, customer_id, sale_type, sale_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, order_status, created_at, tenant_id)
        SELECT id, invoice_no, customer_id, sale_type, sale_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, COALESCE(order_status, 'Completed'), created_at, COALESCE(tenant_id, 'latif_001') FROM sales;
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
          tenant_id TEXT DEFAULT 'latif_001',
          UNIQUE(tenant_id, invoice_no)
        );
        INSERT INTO purchases_new (id, invoice_no, supplier_invoice_no, supplier_id, purchase_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, created_at, tenant_id)
        SELECT id, invoice_no, supplier_invoice_no, supplier_id, purchase_date, subtotal, discount, tax, grand_total, paid_amount, balance_due, payment_method, notes, user_id, created_at, COALESCE(tenant_id, 'latif_001') FROM purchases;
        DROP TABLE purchases;
        ALTER TABLE purchases_new RENAME TO purchases;
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (err) {
    console.error('Migration error for purchases:', err.message);
  }

  // Ensure default Latif Traders tenant exists
  try {
    const defaultTenant = db.prepare("SELECT id FROM tenants WHERE id = 'latif_001'").get();
    if (!defaultTenant) {
      db.prepare(`
        INSERT INTO tenants (id, business_name, business_type, owner_name, email, phone, address, plan, is_active)
        VALUES ('latif_001', 'Latif Traders', 'frozen_food', 'Mudassir Arif', 'admin@latiftraders.com', '+92 300 1234567', 'Shop # 14-16, Commercial Market, Lahore', 'pro', 1)
      `).run();

      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan, price, payment_status)
        VALUES ('latif_001', 'pro', 3000, 'active')
      `).run();
    }
  } catch (_) {}

  // Migrate legacy settings table into tenant_settings for latif_001
  try {
    db.prepare(`
      INSERT OR IGNORE INTO tenant_settings (tenant_id, key, value)
      SELECT 'latif_001', key, value FROM settings
    `).run();
  } catch (_) {}

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

  // Cleanup auto-inserted sale & purchase payment records from payments table to ensure 100% clean cashbook & ledger
  try {
    const cleanDupSetting = db.prepare("SELECT value FROM settings WHERE key = 'clean_auto_payments_v2'").get();
    if (!cleanDupSetting) {
      db.prepare(`
        DELETE FROM payments
        WHERE reference_id IS NOT NULL
           OR reference_no LIKE 'INV-%'
           OR reference_no LIKE 'PUR-%'
           OR notes LIKE '%Receipt for Invoice%'
           OR notes LIKE '%Down payment on purchase bill%'
      `).run();
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('clean_auto_payments_v2', 'true')").run();
    }
  } catch (err) {
    console.error('Error during payments table cleanup migration:', err);
  }

  // Cleanup accidental double-clicked payments for same party, date, and amount
  try {
    const cleanDupReceipts = db.prepare("SELECT value FROM settings WHERE key = 'clean_duplicate_receipts_v2'").get();
    if (!cleanDupReceipts) {
      const duplicates = db.prepare(`
        SELECT p1.id, p1.party_type, p1.party_id, p1.amount
        FROM payments p1
        JOIN payments p2 ON p1.party_type = p2.party_type
                        AND p1.party_id = p2.party_id
                        AND p1.amount = p2.amount
                        AND p1.payment_date = p2.payment_date
                        AND p1.id > p2.id
      `).all();

      const dupTx = db.transaction(() => {
        for (const d of duplicates) {
          if (d.party_type === 'CUSTOMER' && d.party_id) {
            db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?').run(d.amount, d.party_id);
          } else if (d.party_type === 'SUPPLIER' && d.party_id) {
            db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?').run(d.amount, d.party_id);
          }
          db.prepare('DELETE FROM payments WHERE id = ?').run(d.id);
        }
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('clean_duplicate_receipts_v2', 'true')").run();
      });

      dupTx();
    }
  } catch (err) {
    console.error('Error cleaning duplicate payments:', err);
  }

  // Reconcile Fasial Walton ledger: reset duplicate opening_balance if current_balance is already 11870, and ensure standalone payment receipt row exists
  try {
    const fixCustBal = db.prepare("SELECT value FROM settings WHERE key = 'fix_customer_ledger_opening_bal_v2'").get();
    if (!fixCustBal) {
      db.prepare(`
        UPDATE customers
        SET opening_balance = 0
        WHERE (name LIKE '%Fasial%' OR name LIKE '%Faisal%')
          AND opening_balance > 0
          AND current_balance = 11870
      `).run();

      const fasial = db.prepare("SELECT id, tenant_id FROM customers WHERE (name LIKE '%Fasial%' OR name LIKE '%Faisal%')").get();
      if (fasial) {
        const existingReceipt = db.prepare(`
          SELECT id FROM payments
          WHERE party_type = 'CUSTOMER' AND party_id = ? AND amount = 10540
        `).get(fasial.id);

        if (!existingReceipt) {
          db.prepare(`
            INSERT INTO payments (tenant_id, type, party_type, party_id, reference_no, amount, payment_method, payment_date, notes)
            VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 'REC-20261020-0001', 10540, 'Cash', '2026-10-20', 'Customer Udhaar Payment Received')
          `).run(fasial.tenant_id || 'latif_001', fasial.id);
        }
      }

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fix_customer_ledger_opening_bal_v2', 'true')").run();
    }
  } catch (err) {
    console.error('Customer ledger balance reconciliation migration notice:', err);
  }

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('Seeding initial Administrator account...');
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('admin', 'admin@latiftraders.com', adminHash, 'Mudassir Arif', 'admin', 'active');
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
        db.prepare(`UPDATE ${t} SET tenant_id = 'latif_001' WHERE tenant_id IS NULL`).run();
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_${t}_tenant ON ${t}(tenant_id)`).run();
      } catch (_) {}
    }
    db.prepare("UPDATE users SET tenant_id = 'latif_001' WHERE tenant_id IS NULL AND role != 'superowner'").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)").run();
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_adjustments_tenant_no ON stock_adjustments(tenant_id, adjustment_no)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone)").run();
  } catch (mErr) {
    console.warn('Multi-tenancy auto-migration notice:', mErr.message);
  }
}

initializeDatabase();

module.exports = {
  db,
  initializeDatabase,
  DB_PATH,
  DATA_DIR
};
