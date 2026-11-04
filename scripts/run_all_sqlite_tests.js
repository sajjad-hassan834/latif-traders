#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('========================================================================');
console.log('RUNNING ALL SQLITE RELEASE CANDIDATE TEST SUITES');
console.log('========================================================================');

const suites = [
  { name: 'Branch Assertion Guard', cmd: 'node scripts/assert_branch.js' },
  { name: 'No Old UI Guard', cmd: 'node scripts/check_no_old_ui.js' },
  { name: 'Trade Matrix Shared JSON & Aliases', cmd: 'node server/tests/trade_shared_json.test.js' },
  { name: 'Trade Batchless Lifecycle (7/7)', cmd: 'node server/tests/trade_batchless_lifecycle.test.js' },
  { name: 'UI Smoke & Brand Tokens (10/10)', cmd: 'node scripts/ui_smoke_test.js' },
  { name: 'Security Batch 1 (Auth/JWT/Tenants)', cmd: 'node server/tests/security_batch1.test.js' },
  { name: 'Security Batch 1b (Tokens/Edges)', cmd: 'node server/tests/security_batch1b_more_tests.test.js' },
  { name: 'Security Batch 1b (Reset Flow)', cmd: 'node server/tests/security_batch1b_reset_shape.test.js' },
  { name: 'Security Batch 1b (Credential Rotation)', cmd: 'node server/tests/security_batch1b_rotate.test.js' },
  { name: 'Security Batch 1b (Tenant Isolation)', cmd: 'node server/tests/security_batch1b_tenant_isolation.test.js' },
  { name: 'Security Migrations Idempotency', cmd: 'node server/tests/security_batch1b_migrations_idempotency.test.js' },
  { name: 'Cashbook Quarantine Parity', cmd: 'node server/tests/cashbook_quarantine_parity.test.js' },
  { name: 'Negative Controls Drill (6/6)', cmd: 'node server/tests/negative_controls.test.js' }
];

const results = [];
let allPassed = true;

for (const s of suites) {
  process.stdout.write(`Running: ${s.name.padEnd(45)} `);
  const start = Date.now();
  try {
    execSync(s.cmd, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'test' } });
    const elapsed = Date.now() - start;
    console.log(`✅ PASS (${elapsed} ms)`);
    results.push({ name: s.name, status: 'PASS', elapsed: `${elapsed} ms` });
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ FAIL (${elapsed} ms)`);
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    console.error(output.slice(0, 500));
    results.push({ name: s.name, status: 'FAIL', elapsed: `${elapsed} ms` });
    allPassed = false;
  }
}

console.log('\n========================================================================');
console.log('SQLITE RELEASE CANDIDATE TEST MATRIX SUMMARY');
console.log('========================================================================');
console.log('| # | Test Suite | Result | Time |');
console.log('|---|---|---|---|');
results.forEach((r, idx) => {
  console.log(`| ${idx + 1} | ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${r.elapsed} |`);
});
console.log('========================================================================\n');

if (!allPassed) {
  console.error('❌ One or more test suites failed.');
  process.exit(1);
} else {
  console.log('🎉 ALL 13 TEST SUITES PASSED ON SQLITE RELEASE CANDIDATE!');
  process.exit(0);
}
