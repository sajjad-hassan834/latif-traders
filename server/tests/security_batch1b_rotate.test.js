const assert = require('assert');
const { db } = require('../config/database');
const { LEGACY_TENANT_ID } = require('../constants/tenant');
const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'rotate_credentials.js');

async function testRotateCredentials() {
  console.log('\n======================================================');
  console.log('   Testing rotate_credentials.js Safety & Semantics   ');
  console.log('======================================================\n');

  // 1. Dry run without --yes produces dry run output and does NOT change token_version or password_hash
  const userBefore = await db.get('SELECT password_hash, token_version, must_change_password FROM users WHERE username = ?', ['admin']);
  const dryRunRes = spawnSync('node', [scriptPath, '--user', 'admin'], { encoding: 'utf8' });
  assert.strictEqual(dryRunRes.status, 0, 'Dry run must exit 0');
  assert.ok(dryRunRes.stdout.includes('DRY RUN'), 'Output must indicate DRY RUN');
  assert.ok(dryRunRes.stdout.includes('Username: admin'), 'Output must list matching username');
  assert.ok(!dryRunRes.stdout.includes('One-Time Password:'), 'Dry run must not print any passwords');

  const userAfterDry = await db.get('SELECT password_hash, token_version, must_change_password FROM users WHERE username = ?', ['admin']);
  assert.strictEqual(userAfterDry.password_hash, userBefore.password_hash, 'Password hash must NOT change in dry run');
  assert.strictEqual(userAfterDry.token_version, userBefore.token_version, 'token_version must NOT change in dry run');
  console.log('  ✅ Dry run prints affected usernames and makes zero changes');

  // 2. Rejecting invalid combinations
  const noTargetRes = spawnSync('node', [scriptPath], { encoding: 'utf8' });
  assert.strictEqual(noTargetRes.status, 1, 'Missing target must exit 1');
  console.log('  ✅ Calling without an explicit target is rejected');

  const multiTargetRes = spawnSync('node', [scriptPath, '--superowner', '--user', 'admin'], { encoding: 'utf8' });
  assert.strictEqual(multiTargetRes.status, 1, 'Multiple targets must exit 1');
  console.log('  ✅ Specifying conflicting targets is rejected');

  const tenantNoAdminRes = spawnSync('node', [scriptPath, '--tenant', LEGACY_TENANT_ID], { encoding: 'utf8' });
  assert.strictEqual(tenantNoAdminRes.status, 1, 'Tenant target without --admin-only must exit 1');
  console.log('  ✅ Tenant target without --admin-only is rejected');

  // 3. Execution with --yes on a test account
  const testUser = `rot_test_${Date.now()}`;
  await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES (?, ?, 'initial_hash', 'Rotation Test', 'admin', 'active', ?, 1, 0)
  `, [testUser, `rot_${Date.now()}@test.com`, LEGACY_TENANT_ID]);

  const execRes = spawnSync('node', [scriptPath, '--user', testUser, '--yes'], { encoding: 'utf8' });
  assert.strictEqual(execRes.status, 0, 'Rotation with --yes must succeed');
  assert.ok(execRes.stdout.includes('Successfully rotated credentials'), 'Must indicate success');
  assert.ok(execRes.stdout.includes('One-Time Password:'), 'One-time password must be printed once');

  const userAfterRot = await db.get('SELECT password_hash, token_version, must_change_password FROM users WHERE username = ?', [testUser]);
  assert.notStrictEqual(userAfterRot.password_hash, 'initial_hash', 'Password hash must be updated');
  assert.strictEqual(userAfterRot.token_version, 2, 'token_version must be incremented to 2');
  assert.strictEqual(userAfterRot.must_change_password, 1, 'must_change_password must be 1');
  console.log('  ✅ Execution with --yes updates hash, sets must_change_password=1, and increments token_version');

  console.log('\n======================================================');
  console.log('  🎉 ALL rotate_credentials.js TESTS PASSED!          ');
  console.log('======================================================\n');
}

testRotateCredentials().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
