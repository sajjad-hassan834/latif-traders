const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// Fetch tenant settings & business profile
exports.getSettings = (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';

    const rows = db.prepare('SELECT key, value FROM tenant_settings WHERE tenant_id = ?').all(tenantId);
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    // Attach tenant profile & branding
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (tenant) {
      settings.business_name = tenant.business_name;
      settings.business_type = tenant.business_type;
      settings.owner_name = tenant.owner_name;
      settings.plan = tenant.plan;
      settings.plan_expires_at = tenant.plan_expires_at;
      settings.logo_url = tenant.logo_url;
      settings.phone = settings.phone || tenant.phone;
      settings.email = settings.email || tenant.email;
      settings.address = settings.address || tenant.address;
    }

    return res.json({ success: true, settings });
  } catch (err) {
    console.error('Settings fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
};

// Update tenant settings & branding
exports.updateSettings = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
    }

    const upsert = db.prepare(`
      INSERT INTO tenant_settings (tenant_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value
    `);

    const updateTransaction = db.transaction((entries) => {
      for (const [key, val] of Object.entries(entries)) {
        if (val !== undefined && val !== null) {
          upsert.run(tenantId, key, String(val));
        }
      }

      // Sync business profile changes to tenants table
      if (entries.shop_name) {
        db.prepare('UPDATE tenants SET business_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(String(entries.shop_name).trim(), tenantId);
      }
      if (entries.logo_url !== undefined) {
        db.prepare('UPDATE tenants SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(entries.logo_url ? String(entries.logo_url).trim() : null, tenantId);
      }
      if (entries.phone) {
        db.prepare('UPDATE tenants SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(String(entries.phone).trim(), tenantId);
      }
      if (entries.email) {
        db.prepare('UPDATE tenants SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(String(entries.email).trim(), tenantId);
      }
      if (entries.address) {
        db.prepare('UPDATE tenants SET address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(String(entries.address).trim(), tenantId);
      }
    });

    updateTransaction(updates);

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'SETTINGS', null, `Updated business settings: ${Object.keys(updates).join(', ')}`, req);

    return res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
};

// Plan & Billing Usage Analytics
exports.getBillingInfo = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    const subscription = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE tenant_id = ? 
      ORDER BY id DESC LIMIT 1
    `).get(tenantId);

    const subscriptionHistory = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE tenant_id = ? 
      ORDER BY id DESC LIMIT 10
    `).all(tenantId);

    // Live usage metrics
    const productsCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?').get(tenantId)?.count || 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const invoicesThisMonth = db.prepare('SELECT COUNT(*) as count FROM sales WHERE tenant_id = ? AND sale_date LIKE ?').get(tenantId, `${currentMonth}%`)?.count || 0;
    const staffCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'").get(tenantId)?.count || 0;

    const currentPlan = tenant?.plan || 'free';
    const limits = {
      free: { products: 50, invoices: 100, staff: 1 },
      pro: { products: 'unlimited', invoices: 'unlimited', staff: 5 },
      enterprise: { products: 'unlimited', invoices: 'unlimited', staff: 'unlimited' }
    };

    const currentLimits = limits[currentPlan] || limits.free;

    return res.json({
      success: true,
      billing: {
        tenantId,
        businessName: tenant?.business_name,
        businessType: tenant?.business_type,
        plan: currentPlan,
        planExpiresAt: tenant?.plan_expires_at,
        subscription,
        subscriptionHistory,
        usage: {
          products: {
            used: productsCount,
            limit: currentLimits.products,
            percent: currentLimits.products === 'unlimited' ? 0 : Math.min(100, Math.round((productsCount / currentLimits.products) * 100))
          },
          invoices: {
            used: invoicesThisMonth,
            limit: currentLimits.invoices,
            percent: currentLimits.invoices === 'unlimited' ? 0 : Math.min(100, Math.round((invoicesThisMonth / currentLimits.invoices) * 100))
          },
          staff: {
            used: staffCount,
            limit: currentLimits.staff,
            percent: currentLimits.staff === 'unlimited' ? 0 : Math.min(100, Math.round((staffCount / currentLimits.staff) * 100))
          }
        }
      }
    });
  } catch (err) {
    console.error('Billing info error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch billing information.' });
  }
};

// Plan Upgrade Endpoint
exports.upgradePlan = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const { plan } = req.body;
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription plan specified.' });
    }

    const prices = { free: 0, pro: 2999, enterprise: 6999 };
    const price = prices[plan];
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

    db.prepare(`
      UPDATE tenants SET plan = ?, plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(plan, expiresAt, tenantId);

    db.prepare(`
      INSERT INTO subscriptions (tenant_id, plan, price, expires_at, payment_status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(tenantId, plan, price, expiresAt);

    logAudit(req.user.id, req.user.full_name, 'UPGRADE_PLAN', 'TENANT', null, `Upgraded tenant ${tenantId} to ${plan.toUpperCase()}`, req);

    return res.json({
      success: true,
      message: `Your account has been upgraded to ${plan.toUpperCase()}! All plan features are now active.`,
      plan
    });
  } catch (err) {
    console.error('Upgrade plan error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process plan upgrade.' });
  }
};
