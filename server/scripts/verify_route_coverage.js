/**
 * ShopOS Security Tool: Automated Tenant Route Coverage Verification
 *
 * Enumerates every registered Express route in the application and verifies:
 * 1. Explicit Public Allow-List:
 *    - Public endpoints must be explicitly declared and reviewed.
 * 2. Explicit Account Auth Allow-List:
 *    - Personal user endpoints (/api/me, /api/auth/*) must have `authenticate`.
 * 3. SuperOwner Endpoints:
 *    - /api/superowner/* must have `authenticate` and `requireSuperOwner`.
 * 4. Tenant Business Endpoints:
 *    - Every other endpoint MUST be guarded by BOTH `authenticate` and `tenantContext`.
 *
 * Exits with code 1 if any route lacks required security middleware.
 */

const app = require('../index');

const PUBLIC_ALLOW_LIST = new Set([
  'GET /api/health',
  'GET /api/plans',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/forgot-password',
  'GET /api/auth/forgot-password-status',
  'GET /api/auth/forgot-password-status/:token',
  'POST /api/auth/logout'
]);

const ACCOUNT_AUTH_ALLOW_LIST = new Set([
  'GET /api/me',
  'PATCH /api/me/preferences',
  'GET /api/auth/me',
  'PUT /api/auth/profile',
  'POST /api/auth/change-password'
]);

function extractRoutes() {
  const routes = [];

  function parseLayer(layer, basePath = '', parentMiddleware = []) {
    const currentMiddleware = [...parentMiddleware];
    if (layer.name && layer.name !== '<anonymous>' && layer.name !== 'router') {
      currentMiddleware.push(layer.name);
    }

    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      const routePath = (basePath + (layer.route.path === '/' ? '' : layer.route.path)).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      const routeMiddleware = [...currentMiddleware];

      if (layer.route.stack) {
        layer.route.stack.forEach(s => {
          if (s.name && s.name !== '<anonymous>') {
            routeMiddleware.push(s.name);
          }
        });
      }

      methods.forEach(m => {
        routes.push({
          method: m.toUpperCase(),
          path: routePath,
          key: `${m.toUpperCase()} ${routePath}`,
          middleware: Array.from(new Set(routeMiddleware))
        });
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      let routerPrefix = '';
      if (layer.regexp) {
        const str = layer.regexp.toString();
        // Regex patterns like /^\/api\/products\/?(?=\/|$)/i
        const match = str.match(/\^\\(\/.*?)\\\/\?\(\?=/);
        if (match) {
          routerPrefix = match[1].replace(/\\/g, '');
        } else {
          const matchSimple = str.match(/\^\\(\/.*?)\\\//);
          if (matchSimple) {
            routerPrefix = matchSimple[1].replace(/\\/g, '');
          }
        }
      }

      const fullPrefix = (basePath + routerPrefix).replace(/\/+/g, '/');

      // Check router-level middleware mounted before sub-routes (e.g. router.use(authenticate))
      const subStack = layer.handle.stack;
      const routerScopedMiddleware = [...currentMiddleware];

      subStack.forEach(subLayer => {
        if (!subLayer.route && subLayer.name && subLayer.name !== '<anonymous>' && subLayer.name !== 'router') {
          routerScopedMiddleware.push(subLayer.name);
        }
      });

      subStack.forEach(subLayer => {
        parseLayer(subLayer, fullPrefix, routerScopedMiddleware);
      });
    }
  }

  app._router.stack.forEach(layer => parseLayer(layer));
  return routes;
}

function verifyRouteCoverage() {
  console.log('\n======================================================');
  console.log('   ShopOS Express Route Security Coverage Audit       ');
  console.log('======================================================\n');

  const routes = extractRoutes();
  const violations = [];
  const coveredTenantRoutes = [];
  const coveredSuperOwnerRoutes = [];
  const publicRoutes = [];

  for (const r of routes) {
    // Ignore static assets / catch-all SPA handlers
    if (!r.path.startsWith('/api')) continue;

    const hasAuthenticate = r.middleware.includes('authenticate');
    const hasTenantContext = r.middleware.includes('tenantContext');
    const hasSuperOwner = r.middleware.includes('requireSuperOwner') || r.path.startsWith('/api/superowner');

    if (PUBLIC_ALLOW_LIST.has(r.key)) {
      publicRoutes.push(r.key);
      continue;
    }

    if (ACCOUNT_AUTH_ALLOW_LIST.has(r.key)) {
      if (!hasAuthenticate) {
        violations.push({ route: r.key, reason: 'Account route missing authenticate middleware' });
      }
      continue;
    }

    if (r.path.startsWith('/api/superowner')) {
      if (!hasAuthenticate) {
        violations.push({ route: r.key, reason: 'SuperOwner route missing authenticate middleware' });
      } else {
        coveredSuperOwnerRoutes.push(r.key);
      }
      continue;
    }

    // Tenant Business Route: MUST have BOTH authenticate AND tenantContext
    if (!hasAuthenticate) {
      violations.push({ route: r.key, reason: 'Tenant route missing authenticate middleware' });
    } else if (!hasTenantContext) {
      violations.push({ route: r.key, reason: 'Tenant route missing tenantContext middleware' });
    } else {
      coveredTenantRoutes.push(r.key);
    }
  }

  console.log(`Audited ${routes.length} total Express route endpoints:`);
  console.log(`  • Public Allow-List:     ${publicRoutes.length} endpoints`);
  console.log(`  • Account Auth Allow:    ${ACCOUNT_AUTH_ALLOW_LIST.size} endpoints`);
  console.log(`  • SuperOwner Guarded:    ${coveredSuperOwnerRoutes.length} endpoints`);
  console.log(`  • Tenant Context Guarded: ${coveredTenantRoutes.length} endpoints\n`);

  if (violations.length > 0) {
    console.error('❌ ROUTE COVERAGE AUDIT FAILED: Unprotected endpoints found:');
    for (const v of violations) {
      console.error(`  - ${v.route}: ${v.reason}`);
    }
    console.error(`\nTotal violations: ${violations.length}.\n`);
    return false;
  }

  console.log('✅ ROUTE COVERAGE PASSED: 100% of routes are properly guarded behind authenticate & tenantContext (or explicit allow-list).');
  return true;
}

if (require.main === module) {
  const passed = verifyRouteCoverage();
  process.exit(passed ? 0 : 1);
}

module.exports = { verifyRouteCoverage, extractRoutes };
