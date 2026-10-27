/**
 * ShopOS Security Credential Rotation Utility
 *
 * Usage:
 *   node server/scripts/rotate_credentials.js --target superowner --password "YourNewPass123!"
 *   node server/scripts/rotate_credentials.js --target admins --password "YourNewPass123!"
 *   node server/scripts/rotate_credentials.js --target all --password "YourNewPass123!"
 *
 * Or set NEW_PASSWORD environment variable:
 *   NEW_PASSWORD="YourNewPass123!" node server/scripts/rotate_credentials.js --target superowner
 *
 * Security:
 *   - NEVER prints password values to stdout or logs
 *   - Enforces must_change_password = 1
 *   - Increments token_version to invalidate all existing sessions
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function rotateCredentials() {
  const args = process.argv.slice(2);
  let target = 'superowner';
  let password = process.env.NEW_PASSWORD || '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      target = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    }
  }

  if (!['superowner', 'admins', 'all'].includes(target)) {
    console.error('Error: Invalid --target. Must be one of: superowner, admins, all');
    process.exit(1);
  }

  if (!password || password.length < 12) {
    console.error('Error: A secure password of at least 12 characters is required (via --password or NEW_PASSWORD env var).');
    process.exit(1);
  }

  console.log(`[ShopOS Security] Initiating credential rotation for target: [${target}]...`);

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(password, salt);

  try {
    let affected = 0;
    if (target === 'superowner') {
      const res = await db.run(`
        UPDATE users
        SET password_hash = ?,
            must_change_password = 1,
            token_version = COALESCE(token_version, 1) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE role = 'superowner'
      `, [hash]);
      affected = res.changes || res.rowCount || 0;
    } else if (target === 'admins') {
      const res = await db.run(`
        UPDATE users
        SET password_hash = ?,
            must_change_password = 1,
            token_version = COALESCE(token_version, 1) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE role = 'admin'
      `, [hash]);
      affected = res.changes || res.rowCount || 0;
    } else if (target === 'all') {
      const res = await db.run(`
        UPDATE users
        SET password_hash = ?,
            must_change_password = 1,
            token_version = COALESCE(token_version, 1) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE role IN ('superowner', 'admin')
      `, [hash]);
      affected = res.changes || res.rowCount || 0;
    }

    console.log(`[ShopOS Security] Successfully rotated credentials for ${affected} account(s).`);
    console.log('[ShopOS Security] All associated sessions have been revoked (token_version incremented).');
    console.log('[ShopOS Security] must_change_password flag set to 1.');
  } catch (err) {
    console.error('[ShopOS Security] Credential rotation failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  rotateCredentials().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { rotateCredentials };
