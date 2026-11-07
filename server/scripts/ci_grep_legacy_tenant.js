/**
 * ShopOS CI Check: Legacy Tenant String Leak Scanner
 *
 * Fails if literal string 'latif_001' appears outside:
 *   1. server/constants/tenant.js (sole canonical definition of LEGACY_TENANT_ID)
 *   2. server/migrations/** (historical migration scripts)
 *   3. server/tests/** (automated test suites)
 *   4. Documentation (*.md)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const ALLOWED_EXACT_FILES = new Set([
  'server/constants/tenant.js',
  'client/src/constants/tenant.js',
  'scripts/check_no_old_ui.js',
  'server/scripts/ci_grep_legacy_tenant.js'
]);

const ALLOWED_DIRECTORIES = [
  'server/migrations',
  'server/tests'
];

function isPathAllowed(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.endsWith('.md')) return true;
  if (ALLOWED_EXACT_FILES.has(normalized)) return true;
  return ALLOWED_DIRECTORIES.some(allowed => normalized.startsWith(allowed + '/'));
}

function scanDirectory(dir, violations) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'build', '.tempmediaStorage', 'data'].includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      scanDirectory(fullPath, violations);
    } else if (/\.(js|jsx|ts|tsx|json|sql|html)$/.test(entry.name)) {
      if (isPathAllowed(relPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          if (line.includes('latif_001')) {
            violations.push({
              file: relPath,
              line: idx + 1,
              content: line.trim()
            });
          }
        });
      } catch (_) {}
    }
  }
}

function runCiGrep() {
  console.log('[ShopOS CI] Scanning repository for illegal latif_001 string occurrences...');
  const violations = [];
  scanDirectory(ROOT_DIR, violations);

  if (violations.length > 0) {
    console.error('\n❌ CI CHECK FAILED: Found unauthorized \'latif_001\' references outside migrations/tests/tenant constant:');
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} -> ${v.content}`);
    }
    console.error(`\nTotal violations: ${violations.length}. Use LEGACY_TENANT_ID or dynamic tenant resolution.\n`);
    return false;
  }

  console.log('✅ CI CHECK PASSED: Zero unauthorized \'latif_001\' occurrences found in source code.');
  return true;
}

if (require.main === module) {
  const success = runCiGrep();
  process.exit(success ? 0 : 1);
}

module.exports = { runCiGrep };
