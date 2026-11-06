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

  const tenantNoFlagRes = spawnSync('node', [scriptPath, '--tenant', LEGACY_TENANT_ID], { encoding: 'utf8' });
  assert.strictEqual(tenantNoFlagRes.status, 1, 'Tenant target without --admin-only or --all-staff must exit 1');
  console.log('  ✅ Tenant target without sub-flag is rejected');

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

  // 4. Safeguard: Refusing to disable active SUPEROWNER_USERNAME
  const superuser = `active_so_${Date.now()}`;
  await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, token_version)
    VALUES (?, ?, 'hash', 'Active SuperOwner', 'superowner', 'active', 1)
  `, [superuser, `so_${Date.now()}@shopos.com`]);

  const disSuperRes = spawnSync('node', [scriptPath, '--disable', '--user', superuser, '--yes'], {
    encoding: 'utf8',
    env: { ...process.env, SUPEROWNER_USERNAME: superuser }
  });
  assert.strictEqual(disSuperRes.status, 1, 'Must reject disabling active SUPEROWNER_USERNAME');
  assert.ok(disSuperRes.stderr.includes('Refusing to disable the active platform superowner account'));
  console.log('  ✅ Safeguard: Refusing to disable active SUPEROWNER_USERNAME enforced');

  // 5. Safeguard: Refusing to disable the LAST active admin of a tenant
  const isolatedTenant = `t_sole_admin_${Date.now()}`;
  await db.run("INSERT INTO tenants (id, business_name, plan, is_active) VALUES (?, 'Sole Admin Shop', 'pro', 1)", [isolatedTenant]);
  const soleAdminUser = `sole_admin_${Date.now()}`;
  await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version)
    VALUES (?, ?, 'hash', 'Sole Admin', 'admin', 'active', ?, 1)
  `, [soleAdminUser, `sole_${Date.now()}@test.com`, isolatedTenant]);

  const disSoleAdminRes = spawnSync('node', [scriptPath, '--disable', '--user', soleAdminUser, '--yes'], { encoding: 'utf8' });
  assert.strictEqual(disSoleAdminRes.status, 1, 'Must reject disabling the last active admin of a tenant');
  assert.ok(disSoleAdminRes.stderr.includes('LAST ACTIVE ADMINISTRATOR'));
  console.log('  ✅ Safeguard: Refusing to disable the last active administrator enforced');

  // 6. Deactivation with --disable succeeds when a secondary admin exists
  const secondaryAdmin = `second_admin_${Date.now()}`;
  await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version)
    VALUES (?, ?, 'hash', 'Second Admin', 'admin', 'active', ?, 1)
  `, [secondaryAdmin, `sec_${Date.now()}@test.com`, isolatedTenant]);

  // Now soleAdminUser can be disabled because secondaryAdmin exists
  const execDisableRes = spawnSync('node', [scriptPath, '--disable', '--user', soleAdminUser, '--yes'], { encoding: 'utf8' });
  assert.strictEqual(execDisableRes.status, 0, 'Disable execution must exit 0 when second admin exists');
  const userAfterExecDis = await db.get('SELECT status, token_version FROM users WHERE username = ?', [soleAdminUser]);
  assert.strictEqual(userAfterExecDis.status, 'inactive');
  assert.strictEqual(userAfterExecDis.token_version, 2);
  console.log('  ✅ Deactivation succeeds when another active tenant admin is present');

  // 7. --all-staff dry run and execution with --exclude-user
  const staff1 = `staff1_${Date.now()}`;
  const staff2 = `staff2_${Date.now()}`;
  await db.run("INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version) VALUES (?, ?, 'hash', 'Staff 1', 'sales', 'active', ?, 1)", [staff1, `s1_${Date.now()}@test.com`, isolatedTenant]);
  await db.run("INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version) VALUES (?, ?, 'hash', 'Staff 2', 'inventory', 'active', ?, 1)", [staff2, `s2_${Date.now()}@test.com`, isolatedTenant]);

  // Dry run excluding secondaryAdmin
  const staffDryRes = spawnSync('node', [scriptPath, '--tenant', isolatedTenant, '--all-staff', '--exclude-user', secondaryAdmin], { encoding: 'utf8' });
  assert.strictEqual(staffDryRes.status, 0);
  assert.ok(staffDryRes.stdout.includes(`Username: ${staff1}`));
  assert.ok(staffDryRes.stdout.includes(`Username: ${staff2}`));
  assert.ok(!staffDryRes.stdout.includes(`Username: ${secondaryAdmin}`), 'Excluded admin must NOT be listed in staff target list');
  console.log('  ✅ --all-staff dry-run correctly lists staff and excludes requesting admin');

  // Execution with --yes
  const staffExecRes = spawnSync('node', [scriptPath, '--tenant', isolatedTenant, '--all-staff', '--exclude-user', secondaryAdmin, '--yes'], { encoding: 'utf8' });
  assert.strictEqual(staffExecRes.status, 0);
  const staff1After = await db.get('SELECT must_change_password, token_version FROM users WHERE username = ?', [staff1]);
  assert.strictEqual(staff1After.must_change_password, 1);
  assert.strictEqual(staff1After.token_version, 2);

  const adminAfter = await db.get('SELECT must_change_password, token_version FROM users WHERE username = ?', [secondaryAdmin]);
  assert.strictEqual(adminAfter.token_version, 1, 'Excluded admin session must remain untouched');
  console.log('  ✅ --all-staff with --yes rotates staff and leaves excluded admin completely untouched');

  console.log('\n======================================================');
  console.log('  🎉 ALL rotate_credentials.js TESTS PASSED!          ');
  console.log('======================================================\n');
}

testRotateCredentials().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
