/**
 * ShopOS Security: Log and Audit Redaction Verification Test Suite
 *
 * Verifies that during:
 * - register
 * - successful login
 * - failed login
 * - forgot-password
 * - change-password
 *
 * Neither stdout, stderr, nor audit_logs contain sensitive secrets
 * (plain passwords, raw JWT tokens, reset links, or raw auth request bodies).
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-security-secret-must-be-at-least-32-characters-long';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../index');
const { db } = require('../config/database');

test('Log & Audit Sanitization - No secrets leaked during auth lifecycle', async () => {
  const SENSITIVE_STRINGS = [
    'TestPassWord_Reg_999!',
    'TestPassWord_Fail_888!',
    'TestPassWord_Reset_777!',
    'TestPassWord_Changed_666!'
  ];

  const capturedLogs = [];
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  function intercept(chunk) {
    if (typeof chunk === 'string') capturedLogs.push(chunk);
    else if (Buffer.isBuffer(chunk)) capturedLogs.push(chunk.toString('utf8'));
  }

  process.stdout.write = function (chunk, encoding, callback) {
    intercept(chunk);
    return origStdoutWrite.apply(process.stdout, arguments);
  };

  process.stderr.write = function (chunk, encoding, callback) {
    intercept(chunk);
    return origStderrWrite.apply(process.stderr, arguments);
  };

  try {
    const testEmail = `audit_redact_${Date.now()}@teststore.com`;

    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        business_name: 'Audit Redaction Shop',
        business_type: 'retail_general',
        fullName: 'Log Auditor',
        email: testEmail,
        password: SENSITIVE_STRINGS[0],
        phone: '03001234567',
        location: 'Test City'
      });
    assert.strictEqual(regRes.status, 201);
    const registeredUser = regRes.body.user;
    const regToken = regRes.body.token;

    // 2. Successful Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: testEmail,
        password: SENSITIVE_STRINGS[0]
      });
    assert.strictEqual(loginRes.status, 200);
    const authToken = loginRes.body.token;

    // 3. Failed Login
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: testEmail,
        password: SENSITIVE_STRINGS[1]
      });
    assert.strictEqual(failRes.status, 401);

    // 4. Forgot Password
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({
        username: registeredUser.username,
        contact_info: '03001234567'
      });
    assert.strictEqual(forgotRes.status, 200);
    const rawResetToken = forgotRes.body.reset_token;

    // 5. Change Password (authenticated)
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: SENSITIVE_STRINGS[0],
        newPassword: SENSITIVE_STRINGS[3]
      });
    assert.strictEqual(changeRes.status, 200);

    // Stop interception
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;

    // --- VERIFICATION 1: STDOUT & STDERR LOG OUTPUT ---
    const allCapturedOutput = capturedLogs.join('\n');

    for (const secret of SENSITIVE_STRINGS) {
      assert.strictEqual(
        allCapturedOutput.includes(secret),
        false,
        `Plaintext secret "${secret}" must NEVER appear in stdout/stderr logs`
      );
    }

    if (authToken) {
      assert.strictEqual(
        allCapturedOutput.includes(authToken),
        false,
        'JWT token string must NEVER appear in stdout/stderr logs'
      );
    }

    if (rawResetToken) {
      assert.strictEqual(
        allCapturedOutput.includes(rawResetToken),
        false,
        'Raw reset token must NEVER appear in stdout/stderr logs'
      );
    }

    // --- VERIFICATION 2: AUDIT_LOGS TABLE CONTENT ---
    const auditEntries = await db.all(
      'SELECT action, details FROM audit_logs WHERE details LIKE ?',
      [`%${testEmail}%`]
    );

    for (const entry of auditEntries) {
      for (const secret of SENSITIVE_STRINGS) {
        assert.strictEqual(
          String(entry.details).includes(secret),
          false,
          `Secret "${secret}" must NEVER appear in audit_logs details`
        );
      }
      if (authToken) {
        assert.strictEqual(
          String(entry.details).includes(authToken),
          false,
          'Auth JWT token must NEVER appear in audit_logs details'
        );
      }
      if (rawResetToken) {
        assert.strictEqual(
          String(entry.details).includes(rawResetToken),
          false,
          'Raw reset token must NEVER appear in audit_logs details'
        );
      }
    }

  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
});
