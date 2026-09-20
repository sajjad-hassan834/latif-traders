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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      short_code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      invoice_no TEXT UNIQUE NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      name TEXT UNIQUE NOT NULL,
      description TEXT
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
      adjustment_no TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      original_invoice_id INTEGER,
      original_invoice_no TEXT,
      party_id INTEGER,
      total_amount REAL NOT NULL,
      reason TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  `;

  db.exec(schema);

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

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('Seeding initial users and configurations...');
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const cashierHash = bcrypt.hashSync('cashier123', salt);
    const storeHash = bcrypt.hashSync('store123', salt);
    const accountantHash = bcrypt.hashSync('accountant123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('admin', 'admin@latiftraders.com', adminHash, 'Latif Admin (Owner)', 'admin', 'active');
    insertUser.run('cashier', 'cashier@latiftraders.com', cashierHash, 'Tariq Cashier', 'sales', 'active');
    insertUser.run('store', 'store@latiftraders.com', storeHash, 'Bilal Inventory Staff', 'inventory', 'active');
    insertUser.run('accountant', 'accountant@latiftraders.com', accountantHash, 'Zubair Accountant', 'accountant', 'active');
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

  const supplierCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
  if (supplierCount === 0) {
    const insertSup = db.prepare(`
      INSERT INTO suppliers (name, phone, address, contact_person, opening_balance, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertSup.run("K&N's Foods Distribution", '042-111567567', 'Gulberg III, Industrial Area, Lahore', 'Rashid Mehmood (Area Manager)', 0, 0, 'Authorized K&N distributor');
    insertSup.run('Dawn Bread & Frozen Foods', '042-35889901', 'Quaid-e-Azam Industrial Estate, Kot Lakhpat', 'Asim Butt', 0, 0, 'Parathas, nuggets and frozen bakery');
    insertSup.run('Sufi Group Frozen Division', '042-111117834', '1-A Garden Town, Lahore', 'Khurram Shahzad', 0, 0, 'Sufi chicken products');
  }

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (customerCount === 0) {
    const insertCust = db.prepare(`
      INSERT INTO customers (name, phone, address, customer_type, opening_balance, credit_limit, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCust.run('Counter Walk-in Customer', '', 'Retail Counter', 'Retail', 0, 0, 0, 'Default retail counter sales');
    insertCust.run('Al-Madina Fast Food & Cafe', '0322-4455667', 'Main Boulevard, Allama Iqbal Town, Lahore', 'Wholesale', 0, 50000, 0, 'Wholesale cafe buyer - weekly credit settlement');
    insertCust.run('Royal Bakers & Mart', '0300-8899112', 'Ferozepur Road, Lahore', 'Wholesale', 0, 100000, 0, 'Supermart branch - 15 days credit');
  }

  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (prodCount === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (name, sku, barcode, category_id, brand, unit, purchase_price, sale_price, wholesale_price, min_stock_level, storage_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertBatch = db.prepare(`
      INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, storage_location)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_type, reason, user_id)
      VALUES (?, ?, 'PURCHASE', ?, ?, ?, 'OPENING', 'Initial opening stock', 1)
    `);

    const today = new Date();
    const expiryFar = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const expirySoon = new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sampleProducts = [
      { name: "K&N's Chicken Nuggets 1kg", sku: 'KN-NUG-1000', barcode: '89640001001', catId: 1, brand: "K&N's", unit: 'pkt', pPrice: 1350, sPrice: 1550, wPrice: 1450, min: 10, loc: 'Freezer #1 - Shelf A', qty: 25, exp: expiryFar, batch: 'KN-2608-A' },
      { name: 'Menu Plain Crispy Fries 1.5kg', sku: 'MN-FRS-1500', barcode: '89640001002', catId: 2, brand: 'Menu', unit: 'pkt', pPrice: 880, sPrice: 1050, wPrice: 980, min: 8, loc: 'Freezer #2 - Shelf B', qty: 30, exp: expiryFar, batch: 'MN-2609-01' },
      { name: 'Dawn Plain Paratha 10s Pack', sku: 'DW-PRT-010', barcode: '89640001003', catId: 3, brand: 'Dawn', unit: 'pkt', pPrice: 420, sPrice: 500, wPrice: 460, min: 15, loc: 'Freezer #3 - Shelf A', qty: 40, exp: expiryFar, batch: 'DW-2608-P1' },
      { name: 'Sufi Chicken Seekh Kabab 800g', sku: 'SF-SKB-800', barcode: '89640001004', catId: 5, brand: 'Sufi', unit: 'pkt', pPrice: 1100, sPrice: 1300, wPrice: 1200, min: 6, loc: 'Freezer #1 - Shelf C', qty: 18, exp: expiryFar, batch: 'SF-2607-K9' },
      { name: 'Seasons Chicken Cheese Samosa 12s', sku: 'SN-SAM-012', barcode: '89640001005', catId: 4, brand: 'Seasons', unit: 'box', pPrice: 620, sPrice: 750, wPrice: 690, min: 12, loc: 'Freezer #2 - Shelf C', qty: 5, exp: expirySoon, batch: 'SN-2603-EXP' },
      { name: 'Big Bird Crispy Tender Pops 500g', sku: 'BB-POP-500', barcode: '89640001006', catId: 1, brand: 'Big Bird', unit: 'pkt', pPrice: 750, sPrice: 900, wPrice: 820, min: 10, loc: 'Freezer #1 - Shelf B', qty: 15, exp: expiryFar, batch: 'BB-2609-04' }
    ];

    for (const p of sampleProducts) {
      const pRes = insertProd.run(p.name, p.sku, p.barcode, p.catId, p.brand, p.unit, p.pPrice, p.sPrice, p.wPrice, p.min, p.loc);
      const prodId = pRes.lastInsertRowid;
      const bRes = insertBatch.run(prodId, p.batch, p.exp, p.qty, p.pPrice, p.loc);
      const batchId = bRes.lastInsertRowid;
      insertMovement.run(prodId, batchId, p.qty, p.pPrice, p.qty);
    }
  }
}

initializeDatabase();

module.exports = {
  db,
  initializeDatabase,
  DB_PATH,
  DATA_DIR
};
