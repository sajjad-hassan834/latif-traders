const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'latif-traders-secure-jwt-secret-key-2026';

function authenticate(req, res, next) {
  let token = null;

  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    // Check httpOnly cookie
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, u.tenant_id,
             COALESCE(u.theme, 'classic') as theme,
             COALESCE(t.business_name, 'ShopOS Business') as business_name,
             COALESCE(t.business_type, 'retail_general') as business_type,
             COALESCE(t.plan, 'free') as plan,
             COALESCE(t.is_active, 1) as tenant_active,
             t.logo_url
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ?
    `).get(decoded.id);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User account is inactive or invalid.' });
    }

    if (user.role === 'superowner') {
      req.isSuperOwner = true;
      const targetTenantId = req.headers['x-tenant-id'] || req.query.tenant_id || (req.body && req.body.tenant_id) || 'latif_001';
      const tenantRow = db.prepare('SELECT * FROM tenants WHERE id = ?').get(targetTenantId);
      
      req.user = {
        ...user,
        role: 'superowner',
        tenant_id: targetTenantId,
        business_name: tenantRow?.business_name || user.business_name || 'ShopOS SuperOwner',
        business_type: tenantRow?.business_type || user.business_type || 'retail_general',
        plan: tenantRow?.plan || 'enterprise'
      };
      req.tenant_id = targetTenantId;
      req.tenant = {
        id: targetTenantId,
        business_name: tenantRow?.business_name || 'ShopOS Business',
        business_type: tenantRow?.business_type || 'retail_general',
        plan: tenantRow?.plan || 'enterprise',
        logo_url: tenantRow?.logo_url || null
      };
      return next();
    }

    if (user.tenant_active === 0) {
      return res.status(403).json({ success: false, message: 'Your business account is suspended or inactive. Please contact support.' });
    }

    req.user = user;
    req.tenant_id = user.tenant_id || 'latif_001';
    req.tenant = {
      id: user.tenant_id || 'latif_001',
      business_name: user.business_name,
      business_type: user.business_type,
      plan: user.plan,
      logo_url: user.logo_url
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please sign in again.' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Admin and Superowner bypass all role restrictions
    if (req.user.role === 'superowner' || req.user.role === 'admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`
    });
  };
}

module.exports = {
  authenticate,
  requireRoles,
  JWT_SECRET
};
