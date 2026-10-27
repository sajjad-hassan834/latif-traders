/**
 * ShopOS Static Analysis Tool: Verify Tenant ID in SQL INSERT Statements
 *
 * Scans all controllers and services to ensure that every INSERT statement
 * on tenant-scoped tables explicitly includes the 'tenant_id' column.
 * Exits with code 1 if any tenant INSERT omits 'tenant_id'.
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

function verifyTenantInserts() {
  const dirsToScan = [
    path.join(__dirname, '..', 'controllers')
  ];

  const violations = [];

  for (const scanDir of dirsToScan) {
    if (!fs.existsSync(scanDir)) continue;
    const files = walkDir(scanDir);

    for (const file of files) {
      const relativePath = path.relative(path.join(__dirname, '..', '..'), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');

      // Match INSERT INTO <table> (...) queries
      const insertRegex = /INSERT\s+INTO\s+([a-zA-Z0-9_"]+)\s*\(([^)]+)\)/gis;
      let match;

      while ((match = insertRegex.exec(content)) !== null) {
        const rawTableName = match[1].replace(/["`]/g, '').toLowerCase();
        const columns = match[2].split(',').map(c => c.trim().toLowerCase().replace(/["`]/g, ''));

        if (TENANT_TABLES.has(rawTableName)) {
          if (!columns.includes('tenant_id')) {
            const upToMatch = content.substring(0, match.index);
            const lineNumber = upToMatch.split('\n').length;
            violations.push({
              file: relativePath,
              line: lineNumber,
              table: rawTableName,
              columns: columns
            });
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ TENANT ISOLATION CHECK FAILED: Found INSERT statements omitting tenant_id:');
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} -> INSERT INTO ${v.table} omits 'tenant_id'. (Present: ${v.columns.join(', ')})`);
    }
    console.error(`\nTotal violations: ${violations.length}. Every INSERT on a tenant table must explicitly include tenant_id.\n`);
    return false;
  }

  console.log(`✅ TENANT ISOLATION CHECK PASSED: All INSERT statements on tenant tables explicitly include tenant_id.`);
  return true;
}

if (require.main === module) {
  const passed = verifyTenantInserts();
  process.exit(passed ? 0 : 1);
}

module.exports = { verifyTenantInserts };
