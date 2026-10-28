/**
 * ShopOS Security Test Suite: Batch 1b - Client UI Flows & Contracts
 *
 * Tests:
 * 1. Login Forgot-Password Flow:
 *    - Submits forgot-password request -> returns generic response + 64-char reset_token
 *    - Status endpoint /api/auth/forgot-password-status?token=... returns status only (never plaintext password)
 * 2. Admin Temporary Password Resolution Flow:
 *    - Admin approves reset request -> temporary password returned ONCE in resolve response
 *    - Database stores NULL for temporary_password (cannot be queried again)
 *    - Subsequent queries to reset request or status endpoint omit temporary_password
 * 3. Forced Password Change Flow:
 *    - User with must_change_password=1 receives 403 on tenant business routes with must_change_password: true
 *    - User successfully calls /api/auth/change-password with restricted token
 *    - Fresh token issued with must_change_password=0 and token_version incremented
 * 4. Token Version Mismatch (401 Session Revocation):
 *    - Stale token with old token_version receives 401 with explicit invalidation message
 */

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-batch1b-ui-tests-min-32-chars';

const app = require('../index');
const { db } = require('../config/database');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const payload = body ? JSON.stringify(body) : null;

    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   ShopOS Security Hardening: Batch 1b Client Flows   ');
  console.log('======================================================\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  try {
    // Seed test users
    const testUsername = `staff_ui_${Date.now()}`;
    const salt = bcrypt.genSaltSync(12);
    const initialHash = bcrypt.hashSync('OldPassword123!', salt);

    const userRes = await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
      VALUES (?, ?, ?, 'UI Flow Staff', 'sales', 'active', ?, 1, 0)
    `, [testUsername, `${testUsername}@test.com`, initialHash, LEGACY_TENANT_ID]);
    const staffUserId = userRes.lastInsertRowid;

    // --- FLOW 1: Forgot-Password Generic Submission & Token Status Endpoint ---
    console.log('--- Flow 1: Login Forgot-Password UI Contract ---');
    const forgotRes = await request('POST', '/api/auth/forgot-password', {
      username: testUsername,
      request_note: 'Lost staff credentials on POS terminal'
    });

    assert.strictEqual(forgotRes.status, 200, 'Forgot password should return 200');
    assert.strictEqual(forgotRes.body.success, true);
    assert.ok(forgotRes.body.message.includes('If an active account exists'), 'Should return generic message');
    assert.ok(forgotRes.body.reset_token, 'Should return reset_token for tracking');
    const resetToken = forgotRes.body.reset_token;
    assert.strictEqual(resetToken.length, 64, 'Reset token should be 64-character hex string');
    console.log('  ✅ Forgot-password returns generic response and 64-char reset tracking token');

    // Check status of pending request using the token
    const statusResPending = await request('GET', `/api/auth/forgot-password-status?token=${resetToken}`);
    assert.strictEqual(statusResPending.status, 200);
    assert.strictEqual(statusResPending.body.status, 'pending');
    assert.strictEqual(statusResPending.body.temporary_password, undefined, 'Status endpoint MUST NOT leak password');
    console.log('  ✅ /auth/forgot-password-status?token=... returns status: pending (no temporary_password)');

    // Verify deleted endpoint /auth/forgot-password-status/:username is not accessible
    const deletedEndpointRes = await request('GET', `/api/auth/forgot-password-status/${testUsername}`);
    // Should be 400 (missing token) or 404
    assert.ok([400, 404].includes(deletedEndpointRes.status), 'Legacy username-based status endpoint is defunct');
    console.log('  ✅ Legacy username-based status route is rejected');

    // --- FLOW 2: Admin Temporary Password Resolution & One-Time Display Contract ---
    console.log('\n--- Flow 2: Admin Reset Resolution & One-Time Display Contract ---');
    // Admin logs in to resolve request
    const adminToken = jwt.sign(
      { id: 1, username: 'admin', role: 'admin', tenant_id: LEGACY_TENANT_ID, token_version: 1 },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const pendingRow = await db.get(`
      SELECT id FROM password_reset_requests WHERE username = ? AND status = 'pending' ORDER BY id DESC LIMIT 1
    `, [testUsername]);
    assert.ok(pendingRow, 'Pending reset request must exist in DB');

    const tempPasswordAssigned = 'TempPass123!@#';
    const resolveRes = await request('POST', `/api/users/reset-requests/${pendingRow.id}/resolve`, {
      action: 'approve',
      new_password: tempPasswordAssigned,
      admin_note: 'Use this temporary password once to sign in'
    }, {
      'Authorization': `Bearer ${adminToken}`,
      'x-tenant-id': LEGACY_TENANT_ID
    });

    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(resolveRes.body.success, true);
    assert.strictEqual(resolveRes.body.temporary_password, tempPasswordAssigned, 'Resolve response returns temp password ONCE to Admin');
    console.log('  ✅ Admin resolve endpoint returns temporary_password once to admin caller');

    // Verify DB stores NULL for temporary_password
    const updatedRequestRow = await db.get('SELECT * FROM password_reset_requests WHERE id = ?', [pendingRow.id]);
    assert.strictEqual(updatedRequestRow.temporary_password, null, 'Database MUST store NULL for temporary_password');
    assert.strictEqual(updatedRequestRow.status, 'approved');
    assert.strictEqual(updatedRequestRow.is_used, 1);
    console.log('  ✅ Database guarantees temporary_password is NULL in password_reset_requests');

    // Verify user record has must_change_password = 1 and token_version incremented
    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [staffUserId]);
    assert.strictEqual(updatedUser.must_change_password, 1, 'must_change_password must be 1');
    assert.strictEqual(updatedUser.token_version, 2, 'token_version must be incremented to 2');
    console.log('  ✅ Target user record marked with must_change_password=1 and token_version=2');

    // Verify public status check shows approved but NEVER leaks temporary_password
    const statusResApproved = await request('GET', `/api/auth/forgot-password-status?token=${resetToken}`);
    assert.strictEqual(statusResApproved.status, 200);
    assert.strictEqual(statusResApproved.body.status, 'approved');
    assert.strictEqual(statusResApproved.body.temporary_password, undefined, 'Status endpoint never returns temp password');
    console.log('  ✅ Token status endpoint confirms "approved" status without password leakage');

    // --- FLOW 3: Forced Password Change Flow ---
    console.log('\n--- Flow 3: Forced Password Change & Restricted Token Navigation ---');
    // Staff logs in using temporary password
    const loginRes = await request('POST', '/api/auth/login', {
      username: testUsername,
      password: tempPasswordAssigned
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.user.must_change_password, true, 'Login payload informs client must_change_password is true');
    const restrictedToken = loginRes.body.token;
    console.log('  ✅ User login with temporary password succeeds and returns must_change_password=true');

    // Business route attempt with restricted token must be rejected with 403
    const blockedRouteRes = await request('GET', '/api/products', null, {
      'Authorization': `Bearer ${restrictedToken}`,
      'x-tenant-id': LEGACY_TENANT_ID
    });
    assert.strictEqual(blockedRouteRes.status, 403, 'Business route blocked for restricted user');
    assert.strictEqual(blockedRouteRes.body.must_change_password, true);
    console.log('  ✅ Business routes return HTTP 403 with must_change_password: true');

    // Calling /api/auth/change-password with restricted token
    const newPermanentPassword = 'PermanentPass2026!';
    const changePwRes = await request('POST', '/api/auth/change-password', {
      currentPassword: tempPasswordAssigned,
      newPassword: newPermanentPassword
    }, {
      'Authorization': `Bearer ${restrictedToken}`
    });
    assert.strictEqual(changePwRes.status, 200);
    assert.strictEqual(changePwRes.body.success, true);
    assert.ok(changePwRes.body.token, 'change-password returns fresh token');
    const freshToken = changePwRes.body.token;
    console.log('  ✅ /api/auth/change-password succeeds with restricted token and issues fresh token');

    // Access business route with fresh token succeeds with 200
    const allowedRouteRes = await request('GET', '/api/products', null, {
      'Authorization': `Bearer ${freshToken}`,
      'x-tenant-id': LEGACY_TENANT_ID
    });
    assert.strictEqual(allowedRouteRes.status, 200, 'Fresh token accesses business routes');
    console.log('  ✅ Business routes immediately accessible with fresh token');

    // --- FLOW 4: Token Version Mismatch (Session Revocation) ---
    console.log('\n--- Flow 4: Session Invalidation & Token Version Mismatch ---');
    // Using restrictedToken (which had token_version = 2) after password change (now token_version = 3)
    const revokedTokenRes = await request('GET', '/api/products', null, {
      'Authorization': `Bearer ${restrictedToken}`,
      'x-tenant-id': LEGACY_TENANT_ID
    });
    assert.strictEqual(revokedTokenRes.status, 401, 'Outdated token_version must return 401');
    assert.ok(revokedTokenRes.body.message.includes('Session has been invalidated'), 'Message must indicate invalidation');
    console.log('  ✅ Outdated token_version returns HTTP 401: "Session has been invalidated"');

    console.log('\n======================================================');
    console.log('  🎉 ALL BATCH 1b CLIENT UI FLOW TESTS PASSED!       ');
    console.log('======================================================\n');
  } finally {
    if (server) server.close();
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
