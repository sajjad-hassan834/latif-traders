const { db } = require('../config/database');

console.log('--- Starting Multi-Tenancy Hardening Migration ---');

const tables = [
  'products', 'batches', 'categories', 'brands', 'units', 'customers',
  'suppliers', 'sales', 'sale_items', 'purchases', 'purchase_items',
  'payments', 'expenses', 'expense_categories', 'inventory_movements',
  'stock_adjustments', 'audit_logs', 'users', 'tenant_settings'
];

db.transaction(() => {
  // 1. Backfill any existing records without tenant_id to 'latif_001'
  for (const table of tables) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      const hasTenantCol = cols.some(c => c.name === 'tenant_id');
      if (hasTenantCol) {
        if (table === 'users') {
          const res = db.prepare("UPDATE users SET tenant_id = 'latif_001' WHERE tenant_id IS NULL AND role != 'superowner'").run();
          console.log(`Backfilled ${res.changes} users to latif_001`);
        } else {
          const res = db.prepare(`UPDATE ${table} SET tenant_id = 'latif_001' WHERE tenant_id IS NULL`).run();
          if (res.changes > 0) {
            console.log(`Backfilled ${res.changes} rows in ${table} to latif_001`);
          }
        }
      }
    } catch (err) {
      console.warn(`Error backfilling ${table}:`, err.message);
    }
  }

  // 2. Create explicit performance and tenant-isolation indexes on tenant_id
  const indexTables = [
    'products', 'batches', 'categories', 'brands', 'units', 'customers',
    'suppliers', 'sales', 'sale_items', 'purchases', 'purchase_items',
    'payments', 'expenses', 'expense_categories', 'inventory_movements',
    'stock_adjustments', 'audit_logs', 'users', 'tenant_settings'
  ];

  for (const t of indexTables) {
    try {
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_${t}_tenant ON ${t}(tenant_id)`).run();
      console.log(`Ensured index idx_${t}_tenant`);
    } catch (err) {
      console.warn(`Could not create index on ${t}:`, err.message);
    }
  }

  // 3. Composite unique indexes
  try {
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_adjustments_tenant_no ON stock_adjustments(tenant_id, adjustment_no)').run();
    console.log('Ensured composite unique index on stock_adjustments(tenant_id, adjustment_no)');
  } catch (err) {
    console.warn('Index on stock_adjustments:', err.message);
  }

  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone)').run();
    console.log('Ensured index on customers(tenant_id, phone)');
  } catch (err) {
    console.warn('Index on customers:', err.message);
  }

  // 4. Update Latif Traders default walk-in customer name if needed
  try {
    db.prepare("UPDATE customers SET name = 'Walk-in Customer' WHERE name = 'Counter Walk-in Customer'").run();
  } catch (err) {
    // Ignore
  }
})();

console.log('--- Multi-Tenancy Hardening Migration Completed Successfully ---');
