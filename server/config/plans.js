/**
 * ShoppyOS Subscription Plans & Limits Master Configuration
 * Single source of truth for pricing, resource limits, and feature flags.
 */

const { BRAND_NAME } = require('./brand');

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For small shops getting started with digital billing.',
    pricePKR: 0,
    priceUSD: 0,
    billingCadence: 'Free forever',
    popular: false,
    limits: {
      products: 50,
      invoicesPerMonth: 100,
      users: 1
    },
    features: [
      { id: 'products_limit', name: '50 products & 100 invoices/month', available: true },
      { id: 'single_user', name: '1 user account (owner)', available: true },
      { id: 'pos_receipts', name: 'Fast POS billing & thermal receipts', available: true },
      { id: 'customer_khata', name: 'Customer udhaar (credit) khata', available: true },
      { id: 'thermal_a4_print', name: 'Thermal & A4 invoice printing', available: true },
      { id: 'staff_roles', name: 'Staff accounts & role permissions', available: false },
      { id: 'unlimited_catalog', name: 'Unlimited inventory catalog', available: false },
      { id: 'multi_branch', name: 'Multi-branch sync', available: false, comingSoon: true }
    ]
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For busy retailers, pharmacies, and wholesale shops.',
    pricePKR: 2500,
    priceUSD: 9, // approximate conversion
    billingCadence: '/ month',
    popular: true,
    limits: {
      products: null, // unlimited
      invoicesPerMonth: null, // unlimited
      users: 5
    },
    features: [
      { id: 'unlimited_products', name: 'Unlimited products & inventory batches', available: true },
      { id: 'unlimited_invoices', name: 'Unlimited sales invoices & receipts', available: true },
      { id: 'staff_users', name: 'Up to 5 staff accounts with roles', available: true },
      { id: 'barcodes_labels', name: 'Barcode scanning & sticker printing', available: true },
      { id: 'supplier_ledger', name: 'Supplier ledger & purchase tracking', available: true },
      { id: 'analytics_reports', name: 'Profit & loss and expense analytics', available: true },
      { id: 'manual_backups', name: 'One-click full system data backups', available: true },
      { id: 'daily_cloud_backups', name: 'Automated daily cloud backups', available: false, comingSoon: true }
    ]
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For growing businesses requiring unlimited scale & support.',
    pricePKR: 8000,
    priceUSD: 29, // approximate conversion
    billingCadence: '/ month',
    popular: false,
    limits: {
      products: null,
      invoicesPerMonth: null,
      users: null // unlimited
    },
    features: [
      { id: 'unlimited_everything', name: 'Unlimited products, invoices & staff users', available: true },
      { id: 'advanced_roles', name: 'Full role-based security & audit logging', available: true },
      { id: 'priority_support', name: 'Priority WhatsApp & phone setup assistance', available: true },
      { id: 'data_migration', name: 'Assisted data migration from Excel/desktop', available: true },
      { id: 'daily_cloud_backups', name: 'Automated daily cloud backups', available: false, comingSoon: true },
      { id: 'multi_branch', name: 'Multi-branch sync', available: false, comingSoon: true },
      { id: 'dedicated_db', name: 'Dedicated cloud database', available: false, comingSoon: true },
      { id: 'custom_domain', name: 'Custom domain connection (yourshop.com)', available: false, comingSoon: true }
    ]
  }
};

/**
 * Returns limits for a plan identifier.
 */
function getPlanLimits(planId) {
  const plan = PLANS[planId] || PLANS.free;
  return plan.limits;
}

module.exports = {
  PLANS,
  getPlanLimits
};
