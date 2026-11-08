/**
 * ShopOS Security Hardening Batch 1 Test Suite
 *
 * Verifies:
 *   1. Secrets & Production Validation (JWT secret enforcement, alg pinning, none-alg rejection)
 *   2. Session Revocation via token_version & must_change_password enforcement
 *   3. Decoupled Authentication & TenantContext (superowner / public / tenant isolation)
 *   4. Hardened Password Reset Flow (token hashing, 24h expiry, generic responses, superowner protection)
 *   5. Static analysis verification (tenant INSERT verification & CI legacy string grep)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-security-secret-must-be-at-least-32-characters-long';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../index');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { LEGACY_TENANT_ID } = require('../constants/tenant');
const { rotateCredentials } = require('../scripts/rotate_credentials');
const { verifyTenantInserts } = require('../scripts/verify_tenant_inserts');
const { runCiGrep } = require('../scripts/ci_grep_legacy_tenant');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function runSecurityBatch1Tests() {
  console.log('\n======================================================');
  console.log('   ShopOS Security Hardening: Batch 1 Test Suite');
  console.log('======================================================\n');

  // Setup isolated test tenants and users
  const testTenantActive = 't_sec_batch1_active';
  const testTenantSuspended = 't_sec_batch1_suspended';

  await db.run('DELETE FROM audit_logs WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM password_reset_requests WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM products WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM users WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM tenants WHERE id IN (?, ?)', [testTenantActive, testTenantSuspended]);

  // Clean test superowner and staff
  await db.run("DELETE FROM users WHERE username IN ('sec_superowner', 'sec_staff_user', 'sec_admin_user')");

  // Create active tenant
  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan, is_active)
    VALUES (?, 'ShopOS Test Active Store', 'Owner', 'pro', 1)
  `, [testTenantActive]);

  // Create suspended tenant
  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan, is_active)
    VALUES (?, 'ShopOS Suspended Store', 'Suspended Owner', 'pro', 0)
  `, [testTenantSuspended]);

  // Add dummy product to active tenant
  await db.run(`
    INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price, unit)
    VALUES (?, 'Security Test Item', 'SKU-SEC-001', 10, 20, 'pkt')
  `, [testTenantActive]);

  const passwordHash = bcrypt.hashSync('SecurePassword123!', 12);

  // 1. Create Superowner (no tenant_id)
  const soRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES ('sec_superowner', 'so@shopos.system', ?, 'Super Owner', 'superowner', 'active', NULL, 1, 0)
  `, [passwordHash]);
  const superownerId = soRes.lastInsertRowid;

  // 2. Create Active Admin
  const adminRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES ('sec_admin_user', 'admin@secbatch1.test', ?, 'Sec Admin', 'admin', 'active', ?, 1, 0)
  `, [passwordHash, testTenantActive]);
  const adminId = adminRes.lastInsertRowid;

  // 3. Create Staff User
  const staffRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES ('sec_staff_user', 'staff@secbatch1.test', ?, 'Sec Staff', 'sales', 'active', ?, 1, 0)
  `, [passwordHash, testTenantActive]);
  const staffId = staffRes.lastInsertRowid;

  // 4. Create Suspended Tenant User
  const suspRes = await db.run(`
    INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
    VALUES ('sec_susp_user', 'susp@secbatch1.test', ?, 'Suspended User', 'sales', 'active', ?, 1, 0)
  `, [passwordHash, testTenantSuspended]);
  const suspUserId = suspRes.lastInsertRowid;

  // Sign valid tokens
  const adminToken = jwt.sign(
    { id: adminId, username: 'sec_admin_user', role: 'admin', tenant_id: testTenantActive, token_version: 1 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  const superownerToken = jwt.sign(
    { id: superownerId, username: 'sec_superowner', role: 'superowner', tenant_id: null, token_version: 1 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  const suspUserToken = jwt.sign(
    { id: suspUserId, username: 'sec_susp_user', role: 'sales', tenant_id: testTenantSuspended, token_version: 1 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  // ==========================================
  // SECTION 1: SECRETS & ALGORITHM PINNING
  // ==========================================
  console.log('\n--- Test Group 1: Secrets & Algorithm Pinning ---');

  // Test 1.1: Forged token signed with old fallback secret returns 401
  const forgedToken = jwt.sign(
    { id: adminId, username: 'sec_admin_user', role: 'admin', tenant_id: testTenantActive, token_version: 1 },
    'latif-traders-secure-jwt-secret-key-2026',
    { algorithm: 'HS256', expiresIn: '2h' }
  );
  const forgeRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${forgedToken}`);
  assert(forgeRes.status === 401, 'Token signed with legacy fallback secret is rejected with HTTP 401');

  // Test 1.2: alg: "none" attack token is rejected
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify({ id: adminId, username: 'sec_admin_user', role: 'admin', tenant_id: testTenantActive, token_version: 1 })).toString('base64url');
  const noneAlgToken = `${headerB64}.${payloadB64}.`;
  const noneRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${noneAlgToken}`);
  assert(noneRes.status === 401, 'alg: "none" token is rejected with HTTP 401');

  // ==========================================
  // SECTION 2: SESSIONS & TOKEN_VERSION
  // ==========================================
  console.log('\n--- Test Group 2: Session Revocation & Password Rotation ---');

  // Test 2.1: Valid token accesses tenant route
  const validProdRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(validProdRes.status === 200, 'Valid token accesses tenant products endpoint with HTTP 200');

  // Test 2.2: Increment token_version -> old token immediately invalidated
  await db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [adminId]);
  const revokedRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(revokedRes.status === 401, 'Token with outdated token_version is immediately rejected with HTTP 401');

  // Test 2.3: must_change_password enforcement
  // Create staff token with current token_version
  const staffToken = jwt.sign(
    { id: staffId, username: 'sec_staff_user', role: 'sales', tenant_id: testTenantActive, token_version: 1 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  // Set must_change_password = 1 on staff user
  await db.run('UPDATE users SET must_change_password = 1, token_version = 1 WHERE id = ?', [staffId]);

  // Attempt to access business route
  const blockedBizRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${staffToken}`);
  assert(blockedBizRes.status === 403, 'User with must_change_password=1 is blocked from business routes with HTTP 403');
  assert(blockedBizRes.body.must_change_password === true, 'Response contains must_change_password: true flag');

  // Allowed to access /api/me
  const allowedMeRes = await request(app)
    .get('/api/me')
    .set('Authorization', `Bearer ${staffToken}`);
  assert(allowedMeRes.status === 200, 'User with must_change_password=1 can access /api/me');

  // Successfully change password
  const changeRes = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ currentPassword: 'SecurePassword123!', newPassword: 'BrandNewPassword456!' });
  assert(changeRes.status === 200, 'User successfully updates password via /api/auth/change-password');
  assert(changeRes.body.token, 'Password change returns fresh token with updated token_version');

  // Verify must_change_password cleared in DB
  const updatedStaff = await db.get('SELECT must_change_password, token_version FROM users WHERE id = ?', [staffId]);
  assert(updatedStaff.must_change_password === 0, 'must_change_password reset to 0 in database');
  assert(updatedStaff.token_version === 2, 'token_version incremented to 2 in database');

  // Prior staffToken now rejected (token_version was 1)
  const oldStaffRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${staffToken}`);
  assert(oldStaffRes.status === 401, 'Old session token revoked after password change');

  // ==========================================
  // SECTION 3: DECOUPLED AUTH & TENANT CONTEXT
  // ==========================================
  console.log('\n--- Test Group 3: Decoupled TenantContext & Isolation ---');

  // Test 3.1: Public routes succeed without tenant or authentication
  const healthRes = await request(app).get('/api/health');
  assert(healthRes.status === 200, 'Public /api/health succeeds without auth');
  assert(healthRes.body.app.includes('ShoppyOS') || healthRes.body.app.includes('ShopOS'), 'App branding matches brand constant');

  // Test 3.2: Superowner stats and tenants succeed WITHOUT any tenant context
  const soStatsRes = await request(app)
    .get('/api/superowner/stats')
    .set('Authorization', `Bearer ${superownerToken}`);
  assert(soStatsRes.status === 200, 'Superowner /api/superowner/stats succeeds without tenant');

  const soTenantsRes = await request(app)
    .get('/api/superowner/tenants')
    .set('Authorization', `Bearer ${superownerToken}`);
  assert(soTenantsRes.status === 200, 'Superowner /api/superowner/tenants succeeds without tenant');

  // Test 3.3: Superowner accessing tenant route WITHOUT x-tenant-id header returns 400 (never defaults to latif_001)
  const soNoHeaderRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${superownerToken}`);
  assert(soNoHeaderRes.status === 400, 'Superowner on tenant route without x-tenant-id is rejected with HTTP 400');

  // Test 3.4: Superowner accessing tenant route WITH x-tenant-id succeeds
  const soWithHeaderRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${superownerToken}`)
    .set('x-tenant-id', testTenantActive);
  assert(soWithHeaderRes.status === 200, 'Superowner with explicit x-tenant-id accesses tenant resources');
  assert(soWithHeaderRes.body.products.length >= 1, 'Tenant product returned');

  // Test 3.5: User from suspended tenant is rejected with HTTP 403
  const suspResCheck = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${suspUserToken}`);
  assert(suspResCheck.status === 403, 'Suspended tenant user is rejected with HTTP 403');

  // ==========================================
  // SECTION 4: HARDENED PASSWORD RESET FLOW
  // ==========================================
  console.log('\n--- Test Group 4: Hardened Password Reset Flow ---');

  // Test 4.1: Forgot password with non-existent user returns generic message
  const forgotNonExistentRes = await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'non_existent_random_user_9999' });
  assert(forgotNonExistentRes.status === 200, 'Forgot password returns HTTP 200 for non-existent user');
  assert(forgotNonExistentRes.body.message.includes('If an active account exists'), 'Generic message returned');

  // Test 4.2: Forgot password with existing staff returns IDENTICAL generic message
  const forgotStaffRes = await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'sec_staff_user', request_note: 'Terminal reset test' });
  assert(forgotStaffRes.status === 200, 'Forgot password returns HTTP 200 for existing staff');
  assert(forgotStaffRes.body.message === forgotNonExistentRes.body.message, 'Identical generic message prevents username enumeration');

  // Test 4.3: DB stores only reset_token_hash, never raw token, temporary_password is null
  const resetRow = await db.get('SELECT * FROM password_reset_requests WHERE username = ? AND status = ?', ['sec_staff_user', 'pending']);
  assert(resetRow !== undefined, 'Password reset row created in DB');
  assert(resetRow.reset_token_hash !== null && resetRow.reset_token_hash.length === 64, 'Stored token is SHA-256 hash (64 hex chars)');
  assert(resetRow.temporary_password === null, 'temporary_password is NULL in database');
  assert(resetRow.expires_at !== null, 'expires_at timestamp set');

  // Test 4.4: Superowner forgot-password is silently blocked (no row created)
  const forgotSoRes = await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'sec_superowner' });
  assert(forgotSoRes.status === 200, 'Superowner forgot-password returns generic 200');
  const soResetRow = await db.get('SELECT * FROM password_reset_requests WHERE username = ?', ['sec_superowner']);
  assert(!soResetRow, 'Zero reset request rows created for superowner (silently blocked)');

  // Test 4.5: Token status check by hash
  const statusNoTokenRes = await request(app).get('/api/auth/forgot-password-status');
  assert(statusNoTokenRes.status === 400, 'Status check without token returns HTTP 400');

  // Test 4.6: Admin resolves password reset
  // Re-generate fresh admin token
  const freshAdminToken = jwt.sign(
    { id: adminId, username: 'sec_admin_user', role: 'admin', tenant_id: testTenantActive, token_version: 2 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2h' }
  );

  const resolveRes = await request(app)
    .post(`/api/users/reset-requests/${resetRow.id}/resolve`)
    .set('Authorization', `Bearer ${freshAdminToken}`)
    .send({ action: 'approve', new_password: 'TempPassword123!' });
  assert(resolveRes.status === 200, 'Admin approves password reset with HTTP 200');
  assert(resolveRes.body.temporary_password === 'TempPassword123!', 'Temporary password returned once to admin');

  // Verify target user state in DB: must_change_password = 1, token_version incremented
  const staffAfterReset = await db.get('SELECT must_change_password, token_version FROM users WHERE id = ?', [staffId]);
  assert(staffAfterReset.must_change_password === 1, 'must_change_password set to 1 after admin reset');
  assert(staffAfterReset.token_version === 3, 'token_version incremented after admin reset');

  // Verify request row in DB: temporary_password is NULL, is_used = 1
  const updatedResetRow = await db.get('SELECT temporary_password, is_used, status FROM password_reset_requests WHERE id = ?', [resetRow.id]);
  assert(updatedResetRow.temporary_password === null, 'temporary_password remains NULL in database');
  assert(updatedResetRow.is_used === 1, 'is_used marked as 1');
  assert(updatedResetRow.status === 'approved', 'status marked as approved');

  // ==========================================
  // SECTION 5: STATIC & INTEGRITY CHECKS
  // ==========================================
  console.log('\n--- Test Group 5: Static Checks & Code Integrity ---');

  // Test 5.1: Tenant INSERT verification
  const insertChecksPassed = verifyTenantInserts();
  assert(insertChecksPassed === true, 'All SQL INSERT statements on tenant tables include tenant_id');

  // Test 5.2: CI grep for raw 'latif_001' string leak
  const ciGrepPassed = runCiGrep();
  assert(ciGrepPassed === true, 'Zero unauthorized \'latif_001\' occurrences found in repository');

  // Cleanup test data
  await db.run('DELETE FROM audit_logs WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM password_reset_requests WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM products WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM users WHERE tenant_id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run('DELETE FROM tenants WHERE id IN (?, ?)', [testTenantActive, testTenantSuspended]);
  await db.run("DELETE FROM users WHERE username IN ('sec_superowner', 'sec_staff_user', 'sec_admin_user')");

  console.log('\n======================================================');
  console.log('  🎉 ALL BATCH 1 SECURITY HARDENING TESTS PASSED!');
  console.log('======================================================\n');
}

if (require.main === module) {
  runSecurityBatch1Tests().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runSecurityBatch1Tests };
