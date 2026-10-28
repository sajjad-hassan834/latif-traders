/**
 * ShopOS Security Test Suite: Batch 1b - Item 3 (Reset Shape & Temp Password Expiry/Single-Use)
 *
 * Requirements:
 * 1. Deep comparison of forgot-password JSON responses between existing and non-existing users.
 * 2. Enforce 24h expiration for temporary passwords at login.
 * 3. Enforce single-use for temporary passwords at login.
 */

const assert = require('assert');
const http = require('http');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-batch1b-reset-shape-tests-min-32-chars';

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

function getObjectStructure(obj) {
  const structure = {};
  for (const [k, v] of Object.entries(obj)) {
    structure[k] = {
      type: typeof v,
      length: typeof v === 'string' ? v.length : undefined
    };
  }
  return structure;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   ShopOS Security Test: Item 3 (Shape & Temp Passwords)');
  console.log('======================================================\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  try {
    // Seed test users
    const existingStaff = `staff_shape_${Date.now()}`;
    const salt = bcrypt.genSaltSync(12);
    const initialHash = bcrypt.hashSync('StaffInitialPass123!', salt);

    await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
      VALUES (?, ?, ?, 'Staff Shape User', 'sales', 'active', ?, 1, 0)
    `, [existingStaff, `${existingStaff}@test.com`, initialHash, LEGACY_TENANT_ID]);

    // --- TEST 1: Deep Comparison of Forgot-Password JSON Shapes ---
    console.log('--- Test 1: JSON Shape Comparison (Existing vs Non-Existing vs Superowner) ---');
    const resExisting = await request('POST', '/api/auth/forgot-password', {
      username: existingStaff
    });
    const resNonExisting = await request('POST', '/api/auth/forgot-password', {
      username: 'totally_non_existent_fake_user_xyz_9999'
    });
    const resSuperOwner = await request('POST', '/api/auth/forgot-password', {
      username: 'superowner'
    });

    assert.strictEqual(resExisting.status, 200);
    assert.strictEqual(resNonExisting.status, 200);
    assert.strictEqual(resSuperOwner.status, 200);

    const keysExisting = Object.keys(resExisting.body).sort();
    const keysNonExisting = Object.keys(resNonExisting.body).sort();
    const keysSuperOwner = Object.keys(resSuperOwner.body).sort();

    assert.deepStrictEqual(keysExisting, ['message', 'reset_token', 'success']);
    assert.deepStrictEqual(keysNonExisting, keysExisting, 'Non-existing user shape keys must match existing user shape keys');
    assert.deepStrictEqual(keysSuperOwner, keysExisting, 'Superowner shape keys must match existing user shape keys');

    // Deep compare structure and lengths
    const structExisting = getObjectStructure(resExisting.body);
    const structNonExisting = getObjectStructure(resNonExisting.body);
    const structSuperOwner = getObjectStructure(resSuperOwner.body);

    assert.strictEqual(structExisting.success.type, 'boolean');
    assert.strictEqual(structNonExisting.success.type, 'boolean');
    assert.strictEqual(structSuperOwner.success.type, 'boolean');

    assert.strictEqual(structExisting.reset_token.type, 'string');
    assert.strictEqual(structExisting.reset_token.length, 64, 'Reset token must be 64 characters');
    assert.strictEqual(structNonExisting.reset_token.type, 'string');
    assert.strictEqual(structNonExisting.reset_token.length, 64, 'Fake reset token must also be 64 characters');
    assert.strictEqual(structSuperOwner.reset_token.type, 'string');
    assert.strictEqual(structSuperOwner.reset_token.length, 64, 'Superowner fake token must also be 64 characters');

    assert.strictEqual(resExisting.body.message, resNonExisting.body.message, 'Message text must be identical');
    assert.strictEqual(resExisting.body.message, resSuperOwner.body.message, 'Message text must be identical');
    console.log('  ✅ Forgot-password responses have identical JSON keys, types, lengths, and messages');

    // --- TEST 2: 24h Expiry for Temporary Passwords at Login ---
    console.log('\n--- Test 2: Enforce 24h Expiry on Temporary Password at Login ---');
    const expiredUser = `user_expired_${Date.now()}`;
    const expiredTempPass = 'ExpiredTempPass123!';
    const expiredHash = bcrypt.hashSync(expiredTempPass, salt);
    const pastExpiresAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h in the past

    await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password, temp_password_expires_at, temp_password_used)
      VALUES (?, ?, ?, 'Expired User', 'sales', 'active', ?, 1, 1, ?, 0)
    `, [expiredUser, `${expiredUser}@test.com`, expiredHash, LEGACY_TENANT_ID, pastExpiresAt]);

    const expiredLoginRes = await request('POST', '/api/auth/login', {
      username: expiredUser,
      password: expiredTempPass
    });

    assert.strictEqual(expiredLoginRes.status, 401, 'Expired temporary password must be rejected with 401');
    assert.ok(expiredLoginRes.body.message.includes('expired'), 'Error message must state temporary password has expired');
    console.log('  ✅ Login with expired temporary password (> 24h) is rejected with HTTP 401');

    // --- TEST 3: Single-Use Enforcement on Temporary Password at Login ---
    console.log('\n--- Test 3: Enforce Single-Use on Temporary Password at Login ---');
    const singleUseUser = `user_singleuse_${Date.now()}`;
    const validTempPass = 'ValidSingleUsePass123!';
    const singleUseHash = bcrypt.hashSync(validTempPass, salt);
    const futureExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h in future

    await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password, temp_password_expires_at, temp_password_used)
      VALUES (?, ?, ?, 'Single Use User', 'sales', 'active', ?, 1, 1, ?, 0)
    `, [singleUseUser, `${singleUseUser}@test.com`, singleUseHash, LEGACY_TENANT_ID, futureExpiresAt]);

    // First login attempt (valid temporary password, first use)
    const firstLoginRes = await request('POST', '/api/auth/login', {
      username: singleUseUser,
      password: validTempPass
    });
    assert.strictEqual(firstLoginRes.status, 200, 'First login with valid temp password must succeed');
    assert.strictEqual(firstLoginRes.body.user.must_change_password, true);

    // Verify temp_password_used was set to 1 in DB
    const dbRecord = await db.get('SELECT temp_password_used FROM users WHERE username = ?', [singleUseUser]);
    assert.strictEqual(dbRecord.temp_password_used, 1, 'temp_password_used must be 1 after first login');
    console.log('  ✅ First login succeeds and sets temp_password_used = 1 in database');

    // Second login attempt using the same temporary password before changing it
    const secondLoginRes = await request('POST', '/api/auth/login', {
      username: singleUseUser,
      password: validTempPass
    });
    assert.strictEqual(secondLoginRes.status, 401, 'Second login attempt with temporary password must be rejected');
    assert.ok(secondLoginRes.body.message.includes('already been used'), 'Message must indicate password was already used');
    console.log('  ✅ Re-using temporary password is rejected with HTTP 401: "Temporary password has already been used"');

    console.log('\n======================================================');
    console.log('  🎉 ALL ITEM 3 SHAPE & TEMP PASSWORD TESTS PASSED!    ');
    console.log('======================================================\n');
  } finally {
    if (server) server.close();
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
