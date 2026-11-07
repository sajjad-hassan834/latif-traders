const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { tenantContext } = require('./tenantContext');

const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  console.error('FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters in production.');
  process.exit(1);
}


// In test/development environment, ensure a valid fallback only if not in production
const effectiveJwtSecret = JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret-key-for-unit-tests-at-least-32-chars' : 'shopos-dev-jwt-secret-not-for-production-min-32-chars');
async function authenticate(req, res, next) {
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

    // Algorithm strictly pinned to HS256 to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, effectiveJwtSecret, { algorithms: ['HS256'] });
    const user = await db.get(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, u.tenant_id,
             COALESCE(u.token_version, 1) as token_version,
             COALESCE(u.must_change_password, 0) as must_change_password,
             COALESCE(u.theme, 'classic') as theme,
             t.business_name, t.business_type, t.plan, t.logo_url
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ?
    `, [decoded.id]);

    if (user && user.tenant_id && user.business_name) {
      user.tenant = {
        id: user.tenant_id,
        business_name: user.business_name,
        business_type: user.business_type || 'retail_general',
        plan: user.plan || 'free',
        logo_url: user.logo_url || null
      };
    }

    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User account is inactive or invalid.' });
    }


    // Session revocation check: verify token_version claim is present and matches current user token_version
    if (decoded.token_version === undefined || decoded.token_version === null) {
      return res.status(401).json({ success: false, message: 'Session token is invalid or missing token version. Please sign in again.' });
    }
    if (Number(decoded.token_version) !== Number(user.token_version)) {
      return res.status(401).json({ success: false, message: 'Session has been invalidated. Please sign in again.' });
    }

    // Enforce forced password rotation: block all business routes except password change, logout, and me
    if (user.must_change_password === 1) {
      const fullPath = ((req.baseUrl || '') + req.path).replace(/\/+$/, '');
      const pathOnly = req.path.replace(/\/+$/, '');
      const isAllowed = pathOnly === '/change-password' ||
                        pathOnly === '/logout' ||
                        pathOnly === '/me' ||
                        fullPath === '/api/auth/change-password' ||
                        fullPath === '/api/auth/logout' ||
                        fullPath === '/api/auth/me' ||
                        fullPath === '/api/me' ||
                        req.baseUrl === '/api/me';

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          must_change_password: true,
          message: 'Password change required before accessing other features.'
        });
      }
    }


    req.user = user;
    req.isSuperOwner = user.role === 'superowner';
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
  tenantContext,
  requireRoles,
  JWT_SECRET: effectiveJwtSecret
};
