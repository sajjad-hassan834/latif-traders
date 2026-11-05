/**
 * ShopOS Security Credential Rotation & Account Deactivation Utility
 *
 * Requirements:
 * 1. Must act on ONE explicitly named account:
 *    - --superowner
 *    - --user <username>
 *    - --tenant <tenant_id> --admin-only (per-account random password printed once)
 * 2. Never sets the same password for several accounts.
 * 3. Never touches other tenants' admins.
 * 4. Requires --yes confirmation; without --yes, prints dry-run list of affected accounts (usernames only).
 * 5. Bumps token_version to invalidate prior sessions and sets must_change_password = 1.
 * 6. Supports --disable flag to set status = 'inactive' and bump token_version for ONE named account.
 *
 * Usage:
 *   # Dry-run preview (no changes made):
 *   node server/scripts/rotate_credentials.js --superowner
 *   node server/scripts/rotate_credentials.js --user cashier_01
 *   node server/scripts/rotate_credentials.js --tenant t_shop_01 --admin-only
 *   node server/scripts/rotate_credentials.js --disable --user old_superowner
 *
 *   # Execute rotation with confirmation:
 *   node server/scripts/rotate_credentials.js --superowner --yes
 *   node server/scripts/rotate_credentials.js --user cashier_01 --password "NewPass123!@#" --yes
 *   node server/scripts/rotate_credentials.js --tenant t_shop_01 --admin-only --yes
 *   node server/scripts/rotate_credentials.js --disable --user old_superowner --yes
 */

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

function generateSecureRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(16);
  let pass = '';
  for (let i = 0; i < 16; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  // Ensure mixed complexity
  return pass + 'A1!';
}

async function rotateCredentials() {
  const args = process.argv.slice(2);
  let isSuperOwner = false;
  let targetUsername = null;
  let targetTenantId = null;
  let adminOnly = false;
  let isDisable = false;
  let explicitPassword = process.env.NEW_PASSWORD || null;
  let confirmedYes = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--superowner') {
      isSuperOwner = true;
    } else if (arg === '--user' && args[i + 1]) {
      targetUsername = args[i + 1].trim();
      i++;
    } else if (arg === '--tenant' && args[i + 1]) {
      targetTenantId = args[i + 1].trim();
      i++;
    } else if (arg === '--admin-only') {
      adminOnly = true;
    } else if (arg === '--disable') {
      isDisable = true;
    } else if (arg === '--password' && args[i + 1]) {
      explicitPassword = args[i + 1];
      i++;
    } else if (arg === '--yes') {
      confirmedYes = true;
    }
  }

  // Validate target arguments: must be mutually exclusive and explicitly named
  const targetsSpecified = [isSuperOwner, !!targetUsername, !!targetTenantId].filter(Boolean).length;
  if (targetsSpecified !== 1) {
    console.error('\n❌ ERROR: You must specify exactly one target:');
    console.error('   1. --superowner');
    console.error('   2. --user <username>');
    console.error('   3. --tenant <tenant_id> --admin-only\n');
    process.exit(1);
  }

  if (targetTenantId && !adminOnly) {
    console.error('\n❌ ERROR: When rotating by tenant, --admin-only is required to prevent accidental mass user reset.\n');
    process.exit(1);
  }

  if (isDisable && targetTenantId) {
    console.error('\n❌ ERROR: The --disable flag must act on ONE named account (--user <username> or --superowner), not an entire tenant.\n');
    process.exit(1);
  }

  // Find targeted accounts
  let targetUsers = [];
  if (isSuperOwner) {
    const rows = await db.all("SELECT id, username, role, status, tenant_id FROM users WHERE role = 'superowner'");
    targetUsers = rows;
  } else if (targetUsername) {
    const row = await db.get("SELECT id, username, role, status, tenant_id FROM users WHERE LOWER(username) = ?", [targetUsername.toLowerCase()]);
    if (row) targetUsers = [row];
  } else if (targetTenantId && adminOnly) {
    const rows = await db.all("SELECT id, username, role, status, tenant_id FROM users WHERE tenant_id = ? AND role = 'admin'", [targetTenantId]);
    targetUsers = rows;
  }

  if (targetUsers.length === 0) {
    console.error('\n❌ ERROR: No matching account found for specified target.\n');
    process.exit(1);
  }

  if (isDisable && targetUsers.length !== 1) {
    console.error(`\n❌ ERROR: --disable can only operate on exactly one account (${targetUsers.length} found). Specify --user <username> directly.\n`);
    process.exit(1);
  }

  // DEACTIVATION MODE (--disable)
  if (isDisable) {
    const target = targetUsers[0];
    if (!confirmedYes) {
      console.log('\n======================================================');
      console.log('   ShopOS Security Account Deactivation: DRY RUN');
      console.log('======================================================');
      console.log(`Target Mode: Disable Single User`);
      console.log(`Account to Deactivate:`);
      console.log(`  - Username: ${target.username} (Role: ${target.role}, Current Status: ${target.status || 'active'}${target.tenant_id ? `, Tenant: ${target.tenant_id}` : ''})`);
      console.log('\n[DRY RUN ONLY] Zero accounts were modified.');
      console.log('To execute this deactivation, re-run with the --yes confirmation flag:');
      console.log(`  node server/scripts/rotate_credentials.js --disable --user ${target.username} --yes\n======================================================\n`);
      return { dryRun: true, disabled: false, count: 1, user: target.username };
    }

    await db.run(`
      UPDATE users
      SET status = 'inactive',
          token_version = COALESCE(token_version, 1) + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [target.id]);

    console.log('\n======================================================');
    console.log(`✅ Successfully deactivated account '${target.username}'.`);
    console.log('  - Status set to: inactive');
    console.log('  - All existing active sessions revoked (token_version incremented).');
    console.log('======================================================\n');
    return { dryRun: false, disabled: true, count: 1, user: target.username };
  }

  // DRY-RUN PREVIEW (if --yes is not supplied)
  if (!confirmedYes) {
    console.log('\n======================================================');
    console.log('   ShopOS Security Credential Rotation: DRY RUN');
    console.log('======================================================');
    console.log(`Target Mode: ${isSuperOwner ? 'SuperOwner' : targetUsername ? `Single User (${targetUsername})` : `Tenant Admins (${targetTenantId})`}`);
    console.log(`Matching Accounts (${targetUsers.length} found):`);
    for (const u of targetUsers) {
      console.log(`  - Username: ${u.username} (Role: ${u.role}${u.tenant_id ? `, Tenant: ${u.tenant_id}` : ''})`);
    }
    console.log('\n[DRY RUN ONLY] Zero credentials were modified.');
    console.log('To execute this rotation, re-run with the --yes confirmation flag:');
    const exampleCmd = isSuperOwner
      ? 'node server/scripts/rotate_credentials.js --superowner --yes'
      : targetUsername
      ? `node server/scripts/rotate_credentials.js --user ${targetUsername} --yes`
      : `node server/scripts/rotate_credentials.js --tenant ${targetTenantId} --admin-only --yes`;
    console.log(`  ${exampleCmd}\n======================================================\n`);
    return { dryRun: true, count: targetUsers.length };
  }

  // EXECUTION WITH --YES CONFIRMATION
  console.log('\n======================================================');
  console.log('   ShopOS Security Credential Rotation: EXECUTING');
  console.log('======================================================');

  // Multi-account target check: never set identical password for several accounts
  if (targetUsers.length > 1 && explicitPassword) {
    console.error('\n❌ ERROR: Setting an identical explicit password for multiple accounts is forbidden.');
    console.error('   Each account will be assigned a distinct cryptographically random password.\n');
    process.exit(1);
  }

  const generatedCredentials = [];

  for (const u of targetUsers) {
    // Generate distinct password per account unless a single user specified an explicit password
    const plainPassword = (targetUsers.length === 1 && explicitPassword)
      ? explicitPassword
      : generateSecureRandomPassword();

    if (plainPassword.length < 10) {
      console.error('\n❌ ERROR: Password must be at least 10 characters long.\n');
      process.exit(1);
    }

    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(plainPassword, salt);

    await db.run(`
      UPDATE users
      SET password_hash = ?,
          must_change_password = 1,
          token_version = COALESCE(token_version, 1) + 1,
          password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hash, u.id]);

    generatedCredentials.push({
      username: u.username,
      password: plainPassword
    });
  }

  console.log(`\n✅ Successfully rotated credentials for ${targetUsers.length} account(s):`);
  for (const cred of generatedCredentials) {
    console.log(`  • Username: ${cred.username}`);
    console.log(`    One-Time Password: ${cred.password}`);
  }
  console.log('\n[SECURITY STATUS]');
  console.log('  - All existing active sessions revoked (token_version incremented).');
  console.log('  - must_change_password flag set to 1 (users forced to change password on next login).');
  console.log('  - password_changed_at timestamp updated.');
  console.log('======================================================\n');

  return { dryRun: false, count: targetUsers.length, accounts: targetUsers.map(u => u.username) };
}

if (require.main === module) {
  rotateCredentials().then(() => process.exit(0)).catch(err => {
    console.error('Rotation error:', err);
    process.exit(1);
  });
}

module.exports = { rotateCredentials };
