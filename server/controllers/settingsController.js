const path = require('path');
const fs = require('fs');
const { db, DATA_DIR } = require('../config/database');
const { logAudit } = require('../middleware/audit');

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Fetch tenant settings & business profile
exports.getSettings = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Authentication required. No tenant resolved.' });
    }

    const rows = await db.all('SELECT key, value FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    // Attach tenant profile & branding
    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    if (tenant) {
      settings.business_name = tenant.business_name;
      settings.shop_name = settings.shop_name || tenant.business_name;
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
exports.updateSettings = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
    }

    await db.transaction(async (tx) => {
      const runner = tx.run ? tx : db;
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined && val !== null) {
          await runner.run(`
            INSERT INTO tenant_settings (tenant_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value
          `, [tenantId, key, String(val)]);
        }
      }

      // Sync business profile changes to tenants table
      if (updates.shop_name || updates.business_name) {
        const nameToSet = String(updates.shop_name || updates.business_name).trim();
        await runner.run('UPDATE tenants SET business_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nameToSet, tenantId]);
      }
      if (updates.logo_url !== undefined) {
        await runner.run('UPDATE tenants SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [updates.logo_url ? String(updates.logo_url).trim() : null, tenantId]);
      }
      if (updates.phone) {
        await runner.run('UPDATE tenants SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [String(updates.phone).trim(), tenantId]);
      }
      if (updates.email) {
        await runner.run('UPDATE tenants SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [String(updates.email).trim(), tenantId]);
      }
      if (updates.address) {
        await runner.run('UPDATE tenants SET address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [String(updates.address).trim(), tenantId]);
      }
      if (updates.business_type) {
        await runner.run('UPDATE tenants SET business_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [String(updates.business_type).trim(), tenantId]);
      }
    });

    await logAudit(req.user?.id, req.user?.full_name, 'UPDATE', 'SETTINGS', null, `Updated business settings: ${Object.keys(updates).join(', ')}`, req);

    return res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
};

// Plan & Billing Usage Analytics
exports.getBillingInfo = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    const subscription = await db.get(`
      SELECT * FROM subscriptions 
      WHERE tenant_id = ? 
      ORDER BY id DESC LIMIT 1
    `, [tenantId]);

    const subscriptionHistory = await db.all(`
      SELECT * FROM subscriptions 
      WHERE tenant_id = ? 
      ORDER BY id DESC LIMIT 10
    `, [tenantId]);

    // Live usage metrics strictly for this tenant
    const prodRow = await db.get('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [tenantId]);
    const productsCount = prodRow?.count || 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const invRow = await db.get('SELECT COUNT(*) as count FROM sales WHERE tenant_id = ? AND CAST(sale_date AS TEXT) LIKE ?', [tenantId, `${currentMonth}%`]);
    const invoicesThisMonth = invRow?.count || 0;
    const staffRow = await db.get("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'", [tenantId]);
    const staffCount = staffRow?.count || 0;

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
exports.upgradePlan = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { plan } = req.body;
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription plan specified.' });
    }

    const prices = { free: 0, pro: 2999, enterprise: 6999 };
    const price = prices[plan];
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

    await db.run(`
      UPDATE tenants SET plan = ?, plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [plan, expiresAt, tenantId]);

    await db.run(`
      INSERT INTO subscriptions (tenant_id, plan, price, expires_at, payment_status)
      VALUES (?, ?, ?, ?, 'active')
    `, [tenantId, plan, price, expiresAt]);

    await logAudit(req.user?.id, req.user?.full_name, 'UPGRADE_PLAN', 'TENANT', null, `Upgraded tenant ${tenantId} to ${plan.toUpperCase()}`, req);

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

// Onboarding Status: Checks real tenant database counts
exports.getOnboardingStatus = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const pRow = await db.get('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?', [tenantId]);
    const prodCount = pRow?.c || 0;
    const sRow = await db.get('SELECT COUNT(*) as c FROM sales WHERE tenant_id = ?', [tenantId]);
    const saleCount = sRow?.c || 0;
    const cRow = await db.get("SELECT COUNT(*) as c FROM customers WHERE tenant_id = ? AND LOWER(name) NOT LIKE '%walk-in%'", [tenantId]);
    const custCount = cRow?.c || 0;
    
    const tenant = await db.get('SELECT logo_url, address, business_name FROM tenants WHERE id = ?', [tenantId]);
    const hasProfileAndLogo = Boolean(tenant && tenant.logo_url && tenant.address);

    const dismissedRow = await db.get("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'onboarding_dismissed'", [tenantId]);
    const dismissed = dismissedRow?.value === 'true';

    const hasProduct = prodCount > 0;
    const hasSale = saleCount > 0;
    const hasCustomer = custCount > 0;
    const allDone = hasProduct && hasSale && hasCustomer && hasProfileAndLogo;

    return res.json({
      success: true,
      onboarding: {
        hasProduct,
        hasSale,
        hasCustomer,
        hasProfileAndLogo,
        dismissed,
        allDone
      }
    });
  } catch (err) {
    console.error('getOnboardingStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch onboarding status.' });
  }
};

// Logo Upload Endpoint: stores in data/uploads/<tenant_id>/
exports.uploadLogo = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: 'Logo image data is required.' });
    }

    // Match Base64 format: data:image/(png|jpeg|jpg|webp);base64,...
    const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, message: 'Invalid image format. Supported formats: PNG, JPG, JPEG, WEBP.' });
    }

    const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only PNG and JPG/JPEG images are allowed.' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Logo file size exceeds the 1 MB limit.' });
    }

    const tenantUploadDir = path.join(UPLOAD_DIR, path.basename(tenantId));
    if (!fs.existsSync(tenantUploadDir)) {
      fs.mkdirSync(tenantUploadDir, { recursive: true });
    }

    const outFilename = `logo_${Date.now()}.${ext}`;
    const destPath = path.join(tenantUploadDir, outFilename);
    fs.writeFileSync(destPath, buffer);

    const logoUrl = `/api/settings/logo/${tenantId}/${outFilename}`;

    // Update tenant and settings
    await db.run('UPDATE tenants SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [logoUrl, tenantId]);
    await db.run(`
      INSERT INTO tenant_settings (tenant_id, key, value) VALUES (?, 'logo_url', ?)
      ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value
    `, [tenantId, logoUrl]);

    await logAudit(req.user?.id, req.user?.full_name, 'UPLOAD_LOGO', 'TENANT', null, `Uploaded new shop logo: ${outFilename}`, req);

    return res.json({
      success: true,
      message: 'Logo uploaded successfully.',
      logo_url: logoUrl
    });
  } catch (err) {
    console.error('Upload logo error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload logo: ' + err.message });
  }
};

// Serve tenant logo safely
exports.serveLogo = (req, res) => {
  try {
    const { tenantId, filename } = req.params;
    // Strict alphanumeric/dash/underscore enforcement for tenantId
    if (!tenantId || !/^[A-Za-z0-9_-]+$/.test(tenantId)) {
      return res.status(400).json({ success: false, message: 'Invalid tenant identifier.' });
    }

    // Strict filename check
    if (!filename || filename.includes('..') || path.isAbsolute(filename) || path.basename(filename) !== filename) {
      return res.status(400).json({ success: false, message: 'Invalid file parameter.' });
    }

    const tenantUploadDir = path.join(UPLOAD_DIR, tenantId);
    let filePath = path.join(tenantUploadDir, filename);

    if (!fs.existsSync(filePath)) {
      // Legacy root uploads directory fallback
      const legacyPath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(legacyPath)) {
        filePath = legacyPath;
      } else {
        return res.status(404).json({ success: false, message: 'Logo not found.' });
      }
    }

    // Strict boundary enforcement: resolved path must strictly stay within UPLOAD_DIR
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(resolvedPath);
  } catch (err) {
    console.error('Serve logo error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve logo.' });
  }
};