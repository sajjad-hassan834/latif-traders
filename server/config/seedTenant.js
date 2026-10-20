const { db } = require('./database');
const { BUSINESS_TYPES } = require('./businessTypes');

/**
 * Seeds a newly registered tenant with categories, units, expense categories,
 * default settings, and a default walk-in customer based on their selected business type.
 */
function seedNewTenant(tenantId, businessType, businessName, email = '', phone = '', address = '', city = '') {
  const typeConfig = BUSINESS_TYPES[businessType] || BUSINESS_TYPES.custom;

  const seedTx = db.transaction(() => {
    // 1. Seed Categories
    const insertCat = db.prepare(`
      INSERT OR IGNORE INTO categories (name, description, tenant_id)
      VALUES (?, ?, ?)
    `);
    if (Array.isArray(typeConfig.categories)) {
      for (const cat of typeConfig.categories) {
        insertCat.run(cat.name, cat.description || '', tenantId);
      }
    }

    // 2. Seed Units
    const insertUnit = db.prepare(`
      INSERT OR IGNORE INTO units (name, short_code, tenant_id)
      VALUES (?, ?, ?)
    `);
    if (Array.isArray(typeConfig.units)) {
      for (const u of typeConfig.units) {
        insertUnit.run(u.name, u.short_code, tenantId);
      }
    }

    // 3. Seed Expense Categories
    const insertExpCat = db.prepare(`
      INSERT OR IGNORE INTO expense_categories (name, description, tenant_id)
      VALUES (?, ?, ?)
    `);
    if (Array.isArray(typeConfig.expenseCategories)) {
      for (const ec of typeConfig.expenseCategories) {
        insertExpCat.run(ec.name, ec.description || '', tenantId);
      }
    }

    // 4. Seed Tenant Settings
    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO tenant_settings (tenant_id, key, value)
      VALUES (?, ?, ?)
    `);

    const defaultSettings = {
      shop_name: businessName || 'My Business',
      tagline: typeConfig.name || 'Retail & Inventory Management',
      business_type: businessType || 'retail_general',
      phone: phone || '',
      email: email || '',
      address: address || city || '',
      city: city || '',
      currency: 'PKR',
      currency_symbol: '₨',
      near_expiry_days: typeConfig.hasExpiry ? '15' : '0',
      allow_negative_stock: 'false',
      invoice_footer: `Thank you for choosing ${businessName || 'our shop'}! For queries or exchanges, please retain your bill.`,
      print_thermal_width: '80mm',
      print_default_format: 'thermal'
    };

    for (const [k, v] of Object.entries(defaultSettings)) {
      insertSetting.run(tenantId, k, String(v));
    }

    // 5. Seed Default Walk-in Customer
    const insertCustomer = db.prepare(`
      INSERT OR IGNORE INTO customers (name, phone, address, customer_type, opening_balance, credit_limit, current_balance, notes, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCustomer.run(
      'Counter Walk-in Customer',
      phone || '',
      address || 'Retail Counter',
      'Retail',
      0,
      0,
      0,
      'Default retail counter sales',
      tenantId
    );
  });

  seedTx();
}

module.exports = {
  seedNewTenant
};
