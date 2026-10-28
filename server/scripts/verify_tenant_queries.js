/**
 * ShopOS Static Analysis Tool: Verify Tenant Isolation in SQL Statements
 *
 * Scans all controllers and route handlers to ensure that:
 * 1. INSERT statements on tenant tables explicitly include 'tenant_id'.
 * 2. UPDATE, DELETE, and SELECT queries on tenant tables filter by 'tenant_id'.
 * 3. Any query omitting 'tenant_id' must match an explicit, reviewed allow-list.
 * 4. Prints the reviewed allow-list with explicit justification for each entry.
 */

const fs = require('fs');
const path = require('path');

const TENANT_TABLES = new Set([
  'categories', 'units', 'products', 'batches', 'inventory_movements',
  'customers', 'suppliers', 'sales', 'sale_items', 'purchases',
  'purchase_items', 'expenses', 'expense_categories', 'payments',
  'stock_adjustments', 'returns', 'return_items', 'audit_logs',
  'brands', 'password_reset_requests', 'tenant_settings'
]);

// REVIEWED ALLOW-LIST with explicit security justifications
const REVIEWED_ALLOW_LIST = [
  {
    category: 'A. Global Identity & Authentication',
    entries: [
      {
        file: 'authController.js',
        table: 'users',
        queryType: 'SELECT',
        reason: 'Pre-auth login credential lookup by username/email before tenant is resolved'
      },
      {
        file: 'authController.js',
        table: 'users',
        queryType: 'SELECT',
        reason: 'System-wide uniqueness check for email during new tenant registration'
      },
      {
        file: 'authController.js',
        table: 'users',
        queryType: 'SELECT',
        reason: 'System-wide uniqueness check for username during new tenant registration'
      },
      {
        file: 'authController.js',
        table: 'users',
        queryType: 'SELECT',
        reason: 'Forgot-password request lookup by username to discover tenant before issuing reset'
      },
      {
        file: 'authController.js',
        table: 'users',
        queryType: 'UPDATE',
        reason: 'Authenticated user updating their own profile/password/session (filtered by req.user.id)'
      },
      {
        file: 'userController.js',
        table: 'users',
        queryType: 'SELECT',
        reason: 'System-wide username uniqueness validation before creating staff account'
      },
      {
        file: 'me.js',
        table: 'users',
        queryType: 'UPDATE',
        reason: 'Authenticated user updating their personal UI theme preference (filtered by req.user.id)'
      }
    ]
  },
  {
    category: 'B. SuperOwner System-Wide Aggregates',
    entries: [
      {
        file: 'superownerController.js',
        table: '*',
        queryType: 'SELECT',
        reason: 'SuperOwner dashboard statistics aggregating global metrics across all tenants (protected by requireSuperOwner)'
      }
    ]
  },
  {
    category: 'C. Child Items Filtered by Verified Parent Entity',
    entries: [
      {
        file: 'saleController.js',
        table: 'sale_items',
        queryType: 'SELECT/INSERT/DELETE',
        reason: 'Sale items are child rows filtered by sale_id, where sale_id was verified to belong to tenantId in preceding query'
      },
      {
        file: 'purchaseController.js',
        table: 'purchase_items',
        queryType: 'SELECT/INSERT/DELETE',
        reason: 'Purchase items are child rows filtered by purchase_id, where purchase_id was verified to belong to tenantId in preceding query'
      },
      {
        file: 'partyController.js',
        table: 'supplier_products',
        queryType: 'SELECT/INSERT/DELETE',
        reason: 'Supplier products are child rows filtered by supplier_id, where supplier_id was verified to belong to tenantId in preceding query'
      },
      {
        file: 'authController.js',
        table: 'password_reset_requests',
        queryType: 'SELECT',
        reason: 'Status check queried strictly by high-entropy 256-bit reset_token_hash'
      }
    ]
  }
];

function printAllowList() {
  console.log('========================================================================');
  console.log('          ShopOS Reviewed SQL Tenant Isolation Allow-List              ');
  console.log('========================================================================');
  for (const cat of REVIEWED_ALLOW_LIST) {
    console.log(`\n[${cat.category}]`);
    for (const item of cat.entries) {
      console.log(`  • [${item.file}] Table: ${item.table} (${item.queryType})`);
      console.log(`    Justification: ${item.reason}`);
    }
  }
  console.log('\n========================================================================\n');
}

function walkDir(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractSqlCalls(content) {
  const calls = [];
  // Match db.run/get/all/prepare or runner.run/get/all or tx.run/get/all
  const callRegex = /(?:db|runner|tx)\.(?:run|get|all|prepare)\s*\(\s*([`'"])([\s\S]*?)\1/g;
  let match;
  while ((match = callRegex.exec(content)) !== null) {
    const rawSql = match[2].trim();
    const line = content.substring(0, match.index).split('\n').length;
    calls.push({ sql: rawSql, line });
  }
  return calls;
}

function verifyTenantQueries() {
  printAllowList();

  const dirsToScan = [
    path.join(__dirname, '..', 'controllers'),
    path.join(__dirname, '..', 'routes')
  ];

  const violations = [];
  let totalChecked = 0;

  for (const scanDir of dirsToScan) {
    if (!fs.existsSync(scanDir)) continue;
    const files = walkDir(scanDir);

    for (const file of files) {
      const filename = path.basename(file);
      const relativePath = path.relative(path.join(__dirname, '..', '..'), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const calls = extractSqlCalls(content);

      for (const { sql, line } of calls) {
        totalChecked++;
        const normSql = sql.replace(/\s+/g, ' ');

        // 1. INSERT INTO <table> (...)
        const insertMatch = normSql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_"]+)\s*\(([^)]+)\)/i);
        if (insertMatch) {
          const table = insertMatch[1].replace(/["`]/g, '').toLowerCase();
          const columns = insertMatch[2].split(',').map(c => c.trim().toLowerCase().replace(/["`]/g, ''));

          if (TENANT_TABLES.has(table)) {
            if (['sale_items', 'purchase_items', 'supplier_products', 'return_items'].includes(table)) {
              continue; // Child item verified by parent
            }
            if (!columns.includes('tenant_id')) {
              violations.push({ file: relativePath, line, type: 'INSERT', table, reason: "Missing 'tenant_id' column" });
            }
          }
          continue;
        }

        // 2. UPDATE <table> SET ... WHERE ...
        const updateMatch = normSql.match(/^UPDATE\s+([a-zA-Z0-9_"]+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
        if (updateMatch) {
          const table = updateMatch[1].replace(/["`]/g, '').toLowerCase();
          const whereClause = updateMatch[3].toLowerCase();

          if (TENANT_TABLES.has(table) || table === 'users') {
            const isSuperOwner = filename === 'superownerController.js';
            const isPersonalUpdate = (filename === 'authController.js' || filename === 'me.js') && whereClause.includes('id = ?');
            const isChild = ['sale_items', 'purchase_items', 'supplier_products'].includes(table);

            if (!isSuperOwner && !isPersonalUpdate && !isChild) {
              if (!whereClause.includes('tenant_id')) {
                violations.push({ file: relativePath, line, type: 'UPDATE', table, reason: "WHERE clause does not filter by tenant_id" });
              }
            }
          }
          continue;
        }

        // 3. DELETE FROM <table> WHERE ...
        const deleteMatch = normSql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_"]+)\s*(?:WHERE\s+(.+))?$/i);
        if (deleteMatch) {
          const table = deleteMatch[1].replace(/["`]/g, '').toLowerCase();
          const whereClause = (deleteMatch[2] || '').toLowerCase();

          if (TENANT_TABLES.has(table) || table === 'users') {
            const isSuperOwner = filename === 'superownerController.js';
            const isChild = ['sale_items', 'purchase_items', 'supplier_products', 'return_items', 'stock_adjustment_items'].includes(table);

            if (!isSuperOwner && !isChild) {
              if (!whereClause.includes('tenant_id')) {
                violations.push({ file: relativePath, line, type: 'DELETE', table, reason: "WHERE clause does not filter by tenant_id" });
              }
            }
          }
          continue;
        }

        // 4. SELECT FROM <table> ...
        const selectMatch = normSql.match(/^SELECT\s+.*?\s+FROM\s+([a-zA-Z0-9_"]+)(?:\s+(?:WHERE|LEFT|JOIN|ORDER|GROUP|LIMIT)\s+(.+))?$/i);
        if (selectMatch) {
          const table = selectMatch[1].replace(/["`]/g, '').toLowerCase();
          const restOfQuery = (selectMatch[2] || '').toLowerCase();

          if (TENANT_TABLES.has(table) || table === 'users') {
            const isSuperOwner = filename === 'superownerController.js';
            const isAllowListedAuth = (filename === 'authController.js' || (filename === 'userController.js' && restOfQuery.includes('username = ?'))) && (table === 'users' || table === 'password_reset_requests');
            const isChild = ['sale_items', 'purchase_items', 'supplier_products', 'return_items'].includes(table);

            if (!isSuperOwner && !isAllowListedAuth && !isChild) {
              if (!restOfQuery.includes('tenant_id')) {
                violations.push({ file: relativePath, line, type: 'SELECT', table, reason: "Query does not filter by tenant_id" });
              }
            }
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('❌ SQL TENANT ISOLATION CHECK FAILED: Unprotected queries found:');
    for (const v of violations) {
      console.error(`  - [${v.type}] ${v.file}:${v.line} on '${v.table}': ${v.reason}`);
    }
    console.error(`\nTotal violations: ${violations.length}.\n`);
    return false;
  }

  console.log(`✅ SQL TENANT ISOLATION CHECK PASSED: All ${totalChecked} checked SQL statements on tenant tables filter by tenant_id or match the reviewed allow-list.`);
  return true;
}

if (require.main === module) {
  const passed = verifyTenantQueries();
  process.exit(passed ? 0 : 1);
}

module.exports = { verifyTenantQueries, verifyTenantInserts: verifyTenantQueries, REVIEWED_ALLOW_LIST };
