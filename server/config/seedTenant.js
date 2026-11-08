const { db } = require('./database');
const { BUSINESS_TYPES } = require('./businessTypes');

/**
 * Seeds a newly registered tenant with categories, units, expense categories,
 * default settings, and a default walk-in customer based on their selected business type.
 * Fully asynchronous and compatible with both SQLite and PostgreSQL.
 */
async function seedNewTenant(tenantId, businessType, businessName, email = '', phone = '', address = '', city = '') {
  const typeConfig = BUSINESS_TYPES[businessType] || BUSINESS_TYPES.custom;

  // 1. Seed Categories
  if (Array.isArray(typeConfig.categories)) {
    for (const cat of typeConfig.categories) {
      await db.run(`
        INSERT INTO categories (name, description, tenant_id)
        VALUES (?, ?, ?)
        ON CONFLICT DO NOTHING
      `, [cat.name, cat.description || '', tenantId]);
    }
  }

  // 2. Seed Units
  if (Array.isArray(typeConfig.units)) {
    for (const u of typeConfig.units) {
      await db.run(`
        INSERT INTO units (name, short_code, tenant_id)
        VALUES (?, ?, ?)
        ON CONFLICT DO NOTHING
      `, [u.name, u.short_code, tenantId]);
    }
  }

  // 3. Seed Expense Categories
  if (Array.isArray(typeConfig.expenseCategories)) {
    for (const ec of typeConfig.expenseCategories) {
      await db.run(`
        INSERT INTO expense_categories (name, description, tenant_id)
        VALUES (?, ?, ?)
        ON CONFLICT DO NOTHING
      `, [ec.name, ec.description || '', tenantId]);
    }
  }

  // 4. Seed Tenant Settings
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
    print_default_format: 'thermal',
    theme: 'classic',
    onboarding_dismissed: 'false'
  };

  for (const [k, v] of Object.entries(defaultSettings)) {
    await db.run(`
      INSERT INTO tenant_settings (tenant_id, key, value)
      VALUES (?, ?, ?)
      ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value
    `, [tenantId, k, String(v)]);
  }

  // 5. Seed ONE Default Walk-in Customer (Retail, NO phone, NO address)
  await db.run(`
    INSERT INTO customers (name, phone, address, customer_type, opening_balance, credit_limit, current_balance, notes, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `, [
    'Walk-in Customer',
    null,
    null,
    'Retail',
    0,
    0,
    0,
    'Default retail counter sales',
    tenantId
  ]);
}

module.exports = {
  seedNewTenant
};
