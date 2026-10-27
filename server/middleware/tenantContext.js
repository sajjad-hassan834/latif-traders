const { db } = require('../config/database');

/**
 * Tenant Context Middleware for ShopOS
 * 
 * Enforces strict tenant resolution for all tenant-scoped routes.
 * Decoupled from user authentication:
 *  - Regular users: tenant_id is sourced strictly from user record.
 *  - Superowner: must explicitly pass 'x-tenant-id' header (no default fallback).
 *  - Inactive/suspended tenants are rejected with HTTP 403.
 *  - Never falls back to hardcoded tenant IDs.
 */
async function tenantContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required before tenant resolution.'
    });
  }

  let targetTenantId = null;

  if (req.user.role === 'superowner') {
    // Superowners must explicitly provide target tenant context for tenant-scoped operations
    targetTenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'] || req.query?.tenant_id || (req.body && req.body.tenant_id);
    if (!targetTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Explicit tenant context header (x-tenant-id) is required for superowner on tenant-scoped routes.'
      });
    }
  } else {
    // Regular users are strictly bound to their assigned tenant
    targetTenantId = req.user.tenant_id;
  }

  if (!targetTenantId) {
    return res.status(401).json({
      success: false,
      message: 'No valid business tenant associated with this account. Access denied.'
    });
  }

  try {
    const tenantRow = await db.get(
      'SELECT id, business_name, business_type, plan, plan_expires_at, logo_url, is_active FROM tenants WHERE id = ?',
      [targetTenantId]
    );

    if (!tenantRow || tenantRow.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: 'Your business account is suspended or inactive. Please contact support.'
      });
    }

    const tenantObj = {
      id: tenantRow.id,
      business_name: tenantRow.business_name,
      business_type: tenantRow.business_type,
      plan: tenantRow.plan || 'free',
      plan_expires_at: tenantRow.plan_expires_at,
      logo_url: tenantRow.logo_url
    };

    req.tenantId = targetTenantId;
    req.tenant_id = targetTenantId;
    req.tenant = tenantObj;
    next();
  } catch (err) {
    console.error('Tenant resolution error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify business tenant context.'
    });
  }
}

module.exports = {
  tenantContext
};
