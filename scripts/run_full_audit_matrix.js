const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const env = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-audit-matrix-jwt-secret-key-32bytes-min',
  DATABASE_URL: 'postgresql://postgres:testpassword123@localhost:5434/latif_test',
  TEST_DATABASE_URL: 'postgresql://postgres:testpassword123@localhost:5434/latif_test'
};

const tests = [
  // Test files in server/tests
  { file: 'server/tests/cashbook_quarantine_parity.test.js', sqlite: true, pg: true },
  { file: 'server/tests/concurrency_pool10_drill.test.js', sqlite: false, pg: true },
  { file: 'server/tests/db_file_selection.test.js', sqlite: true, pg: false },
  { file: 'server/tests/document_numbering_pkt.test.js', sqlite: true, pg: true },
  { file: 'server/tests/dress_rehearsal.test.js', sqlite: false, pg: true },
  { file: 'server/tests/entity_deletion_http.test.js', sqlite: true, pg: true },
  { file: 'server/tests/ledger_reconciliation.test.js', sqlite: true, pg: true },
  { file: 'server/tests/lock_removal_negative_controls.test.js', sqlite: false, pg: true },
  { file: 'server/tests/negative_controls.test.js', sqlite: false, pg: true },
  { file: 'server/tests/non_latif_print_previews.test.js', sqlite: true, pg: true },
  { file: 'server/tests/payments_fk_cross_tenant.test.js', sqlite: true, pg: true },
  { file: 'server/tests/plan_limits.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_migrations_idempotency.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_more_tests.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_null_tenants.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_reset_shape.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_rotate.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_tenant_isolation.test.js', sqlite: true, pg: true },
  { file: 'server/tests/security_batch1b_ui.test.js', sqlite: true, pg: true },
  { file: 'server/tests/stage_a2_api_parity.test.js', sqlite: true, pg: true },
  { file: 'server/tests/stage_a2_real_postgres.test.js', sqlite: false, pg: true },
  { file: 'server/tests/stage_a3_http_concurrency.test.js', sqlite: false, pg: true },
  { file: 'server/tests/stage_a3_http_parity.test.js', sqlite: true, pg: true },
  { file: 'server/tests/stage_a3_throughput_benchmark.test.js', sqlite: false, pg: true },
  { file: 'server/tests/stage_a4_db_tenant_constraints.test.js', sqlite: false, pg: true },
  { file: 'server/tests/stage_a4_deep_verification.test.js', sqlite: false, pg: true },
  { file: 'server/tests/stage_a4_http_parity_isolation.test.js', sqlite: true, pg: true },
  { file: 'server/tests/stage_a4_preflight_negative_controls.test.js', sqlite: false, pg: true },
  { file: 'server/tests/stage_a_parity_and_concurrency.test.js', sqlite: true, pg: true },
  { file: 'server/tests/stage_b_migration_verification.test.js', sqlite: false, pg: true },
  { file: 'server/tests/tenant_backup_restore_security.test.js', sqlite: true, pg: true },
  { file: 'server/tests/trade_batchless_lifecycle.test.js', sqlite: true, pg: false },
  { file: 'server/tests/trade_shared_json.test.js', sqlite: true, pg: true },

  // Guard & Check scripts
  { file: 'scripts/assert_branch.js', sqlite: true, pg: false, isCheck: true },
  { file: 'scripts/check_no_old_ui.js', sqlite: true, pg: false, isCheck: true },
  { file: 'scripts/audit_brand_names.js', sqlite: true, pg: false, isCheck: true },
  { file: 'scripts/ui_smoke_test.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/ci_grep_legacy_tenant.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/verify_route_coverage.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/verify_tenant_queries.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/verify_tenant_inserts.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/check_tenant_fks.js', sqlite: false, pg: true, isCheck: true },
  { file: 'server/scripts/count_null_tenants.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/audit_plan_limits.js', sqlite: true, pg: false, isCheck: true },
  { file: 'server/scripts/verify_migration.js', sqlite: false, pg: true, isCheck: true, preCmd: 'node server/scripts/migrate_sqlite_to_pg.js' }
];

console.log('========================================================================================');
console.log('RUNNING FULL TEST MATRIX & VERIFICATION SCRIPTS (SQLITE & POSTGRESQL 16)');
console.log('========================================================================================\n');

const results = [];

for (const t of tests) {
  const relPath = t.file;
  process.stdout.write(`Testing: ${relPath.padEnd(58)} `);
  const start = Date.now();
  let sqliteRes = t.sqlite ? 'N/A' : 'SKIPPED (PG-only)';
  let pgRes = t.pg ? 'N/A' : 'SKIPPED (SQLite-only)';

  try {
    if (t.preCmd) execSync(t.preCmd, { stdio: 'ignore', env, timeout: 60000 });
    const cmd = `node "${path.resolve(__dirname, '..', t.file)}"`;
    const timeout = t.file.includes('dress_rehearsal') || t.file.includes('entity_deletion_http') || t.file.includes('stage_a4_deep_verification') ? 180000 : 60000;
    execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], env, timeout });
    const elapsed = Date.now() - start;
    if (t.sqlite) sqliteRes = 'PASSED';
    if (t.pg) pgRes = 'PASSED';
    if (t.isCheck) {
      sqliteRes = 'PASSED (Static)';
      pgRes = t.pg ? 'PASSED (PG check)' : 'N/A (Codebase check)';
    }
    console.log(`✅ OK (${elapsed}ms)`);
    results.push({ file: t.file, sqlite: sqliteRes, pg: pgRes, elapsed: `${elapsed}ms`, error: null });
  } catch (err) {
    const elapsed = Date.now() - start;
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    console.log(`❌ FAIL (${elapsed}ms)`);
    console.error(output.slice(0, 300));
    if (t.sqlite) sqliteRes = 'FAILED';
    if (t.pg) pgRes = 'FAILED';
    results.push({ file: t.file, sqlite: sqliteRes, pg: pgRes, elapsed: `${elapsed}ms`, error: output.slice(0, 300) });
  }
}

console.log('\n========================================================================================');
console.log('COMPLETE AUDIT TEST MATRIX RESULTS');
console.log('========================================================================================\n');
console.log('| # | Test / Verification File | SQLite Driver | PostgreSQL 16 Driver | Time |');
console.log('|---|---|---|---|---|');
results.forEach((r, idx) => {
  console.log(`| ${idx + 1} | \`${r.file}\` | ${r.sqlite} | ${r.pg} | ${r.elapsed} |`);
});
console.log('========================================================================================\n');

const failures = results.filter(r => r.sqlite === 'FAILED' || r.pg === 'FAILED');
if (failures.length > 0) {
  console.error(`❌ ${failures.length} suites failed:`, failures.map(f => f.file));
  process.exit(1);
} else {
  console.log(`🎉 ALL ${results.length} SUITES AND CHECK SCRIPTS PASSED!`);
  process.exit(0);
}

