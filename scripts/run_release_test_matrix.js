#!/usr/bin/env node
/**
 * scripts/run_release_test_matrix.js
 *
 * Runs the comprehensive test matrix for release/1.0-sqlite:
 * 1. Every unit/integration test under server/tests/
 * 2. scripts/ui_smoke_test.js
 * 3. scripts/e2e_sqlite_flows.js
 * 4. All static CI guards (assert_branch, check_no_old_ui, ci_grep_legacy_tenant,
 *    verify_route_coverage, verify_tenant_queries, verify_tenant_inserts)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-release-matrix-jwt-secret-key-32bytes-min',
  DATA_DIR: path.join(__dirname, '..', 'data'),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test',
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test'
};

const serverTestsDir = path.join(__dirname, '..', 'server', 'tests');
const testFiles = fs.readdirSync(serverTestsDir)
  .filter(f => f.endsWith('.test.js'))
  .map(f => path.join('server', 'tests', f).replace(/\\/g, '/'))
  .sort();

const allSuites = [
  // 1. Static Guards
  { category: 'Static Guard', file: 'scripts/assert_branch.js' },
  { category: 'Static Guard', file: 'scripts/check_no_old_ui.js' },
  { category: 'Static Guard', file: 'server/scripts/ci_grep_legacy_tenant.js' },
  { category: 'Static Guard', file: 'server/scripts/verify_route_coverage.js' },
  { category: 'Static Guard', file: 'server/scripts/verify_tenant_queries.js' },
  { category: 'Static Guard', file: 'server/scripts/verify_tenant_inserts.js' },

  // 2. Client & Flows Smoke Tests
  { category: 'UI & Flows', file: 'scripts/ui_smoke_test.js' },
  { category: 'UI & Flows', file: 'scripts/e2e_sqlite_flows.js' },

  // 3. All server/tests/*.test.js
  ...testFiles.map(f => ({ category: 'Server Suite', file: f }))
];

console.log('========================================================================');
console.log(`RUNNING FULL RC7 MATRIX ON release/1.0-sqlite (${allSuites.length} SUITES)`);
console.log('========================================================================\n');

const results = [];
let passedCount = 0;
let skippedCount = 0;
let failedCount = 0;

for (let i = 0; i < allSuites.length; i++) {
  const item = allSuites[i];
  const file = item.file;
  const name = path.basename(file, '.js');
  process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${allSuites.length}] ${name.padEnd(42)} `);

  const start = Date.now();
  try {
    execSync(`node "${file}"`, { stdio: ['ignore', 'pipe', 'pipe'], env, timeout: 240000 });
    const elapsed = Date.now() - start;
    console.log(`✅ PASS (${elapsed} ms)`);
    results.push({ ...item, name, status: 'PASS', elapsed: `${elapsed} ms`, note: '' });
    passedCount++;
  } catch (err) {
    const elapsed = Date.now() - start;
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    
    // Check if test is PostgreSQL-only and skipped because PG docker is not running
    if (output.includes('ECONNREFUSED') && (file.includes('postgres') || file.includes('concurrency_pool10') || file.includes('stage_a4_db_tenant_constraints') || file.includes('lock_removal'))) {
      console.log(`⚠️  SKIP (Postgres required)`);
      results.push({ ...item, name, status: 'SKIP', elapsed: `${elapsed} ms`, note: 'Postgres test (Skipped on SQLite trunk)' });
      skippedCount++;
    } else {
      console.log(`❌ FAIL (${elapsed} ms)`);
      console.error('--- Output snippet ---');
      console.error(output.slice(0, 400));
      console.error('----------------------');
      results.push({ ...item, name, status: 'FAIL', elapsed: `${elapsed} ms`, note: output.slice(0, 100).replace(/\n/g, ' ') });
      failedCount++;
    }
  }
}

console.log('\n========================================================================');
console.log('             FULL RC7 TEST MATRIX EXECUTION SUMMARY                     ');
console.log('========================================================================');
console.log('| # | Category | Suite / Script | Status | Duration | Notes |');
console.log('|---|---|---|---|---|---|');
results.forEach((r, idx) => {
  const icon = r.status === 'PASS' ? '✅ PASS' : (r.status === 'SKIP' ? '⚠️ SKIP' : '❌ FAIL');
  console.log(`| ${idx + 1} | ${r.category} | \`${r.name}\` | ${icon} | ${r.elapsed} | ${r.note || '-'} |`);
});
console.log('========================================================================');
console.log(`Total: ${allSuites.length} | Passed: ${passedCount} | Skipped (PG-only): ${skippedCount} | Failed: ${failedCount}`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL EXECUTABLE SQLITE SUITES & GUARDS PASSED ON release/1.0-sqlite!');
  process.exit(0);
}

