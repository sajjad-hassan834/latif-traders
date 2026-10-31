/**
 * ShopOS DB File Selection & Production Safety Guard Test Suite
 */

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveDatabasePath } = require('../config/database');

test('DB File Selection - Explicit DB_PATH wins', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopos_test_db_'));
  const customDb = path.join(tempDir, 'custom_override.db');
  fs.writeFileSync(customDb, '');

  const resolved = resolveDatabasePath(tempDir, customDb, false);
  assert.strictEqual(resolved, customDb, 'Explicit DB_PATH must win');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('DB File Selection - Fallback hierarchy (shopos.db vs latif_traders.db)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopos_test_db_'));
  const shoposPath = path.join(tempDir, 'shopos.db');
  const latifPath = path.join(tempDir, 'latif_traders.db');

  // Case A: neither exists -> defaults to shopos.db
  const defaultResolved = resolveDatabasePath(tempDir, '', false);
  assert.strictEqual(defaultResolved, shoposPath, 'Defaults to shopos.db when neither exists in non-prod');

  // Case B: only latif_traders.db exists -> picks latif_traders.db
  fs.writeFileSync(latifPath, '');
  const latifResolved = resolveDatabasePath(tempDir, '', false);
  assert.strictEqual(latifResolved, latifPath, 'Picks existing latif_traders.db');

  // Case C: both exist -> shopos.db takes priority
  fs.writeFileSync(shoposPath, '');
  const bothResolved = resolveDatabasePath(tempDir, '', false);
  assert.strictEqual(bothResolved, shoposPath, 'Picks shopos.db when both exist');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('DB File Selection - Production safety guard against accidental empty database creation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopos_test_db_'));
  const existingOtherDb = path.join(tempDir, 'latif_traders.db');
  fs.writeFileSync(existingOtherDb, ''); // Real shop data file

  // In production, configuring a nonexistent DB_PATH while other DB exists must throw
  const missingDb = path.join(tempDir, 'missing_target.db');
  assert.throws(
    () => {
      resolveDatabasePath(tempDir, missingDb, true);
    },
    /Refusing to create empty database "missing_target\.db" when other database files exist in production/,
    'Must refuse to create empty database in production when another DB exists'
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});
