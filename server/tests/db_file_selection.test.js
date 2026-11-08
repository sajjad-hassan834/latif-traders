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

test('DB File Selection (a) - latif_traders.db in DATA_DIR and DB_PATH pointing to it -> uses it', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopos_test_db_a_'));
  const latifPath = path.join(tempDir, 'latif_traders.db');
  fs.writeFileSync(latifPath, 'dummy sqlite data header');

  // Both prod and non-prod with DB_PATH set to latif_traders.db
  const resolved = resolveDatabasePath(tempDir, latifPath, true);
  assert.strictEqual(resolved, latifPath, 'Must use latif_traders.db when DB_PATH points to it');

  const resolvedRelative = resolveDatabasePath(tempDir, 'latif_traders.db', true);
  assert.strictEqual(resolvedRelative, latifPath, 'Must resolve relative DB_PATH against DATA_DIR');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('DB File Selection (b) - DB_PATH unset in production -> refuses to start', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopos_test_db_b_'));
  const latifPath = path.join(tempDir, 'latif_traders.db');
  fs.writeFileSync(latifPath, 'dummy data');

  // Empty string or undefined DB_PATH in production must throw
  assert.throws(
    () => {
      resolveDatabasePath(tempDir, '', true);
    },
    /DB_PATH environment variable is required in production/,
    'Must refuse startup if DB_PATH is empty in production'
  );

  assert.throws(
    () => {
      resolveDatabasePath(tempDir, undefined, true);
    },
    /DB_PATH environment variable is required in production/,
    'Must refuse startup if DB_PATH is undefined in production'
  );

  assert.throws(
    () => {
      resolveDatabasePath(tempDir, '   ', true);
    },
    /DB_PATH environment variable is required in production/,
    'Must refuse startup if DB_PATH is only whitespace in production'
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('DB File Selection (c) - empty shopos.db plus latif_traders.db in DATA_DIR -> never creates or uses an empty database', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopos_test_db_c_'));
  const shoposPath = path.join(tempDir, 'shopos.db');
  const latifPath = path.join(tempDir, 'latif_traders.db');

  // Create empty 0-byte shopos.db and populated latif_traders.db
  fs.writeFileSync(shoposPath, ''); // 0 bytes empty
  fs.writeFileSync(latifPath, 'populated sqlite data'); // populated

  // 1. In non-production fallback (no DB_PATH), it should detect shopos.db is empty and pick populated latif_traders.db
  const resolvedFallback = resolveDatabasePath(tempDir, '', false);
  assert.strictEqual(resolvedFallback, latifPath, 'Must pick populated latif_traders.db instead of empty 0-byte shopos.db');

  // 2. In production, if DB_PATH explicitly points to the 0-byte shopos.db while latif_traders.db has data, it must refuse to start
  assert.throws(
    () => {
      resolveDatabasePath(tempDir, shoposPath, true);
    },
    /Refusing to start with empty\/missing database "shopos\.db" \(is an empty 0-byte file\) when other populated database files exist in production: latif_traders\.db/,
    'Must refuse to start in production if target database is empty 0-byte while populated DB exists'
  );

  // 3. In production, if DB_PATH points to a nonexistent file while latif_traders.db exists, it must refuse to start
  const missingPath = path.join(tempDir, 'nonexistent.db');
  assert.throws(
    () => {
      resolveDatabasePath(tempDir, missingPath, true);
    },
    /Refusing to start with empty\/missing database "nonexistent\.db" \(does not exist\) when other populated database files exist in production: latif_traders\.db/,
    'Must refuse to create a missing database in production when populated DB exists'
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});
