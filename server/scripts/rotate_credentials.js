/**
 * ShopOS Security Credential Rotation & Account Deactivation Utility
 *
 * Requirements:
 * 1. Must act on ONE explicitly named account or an explicit tenant staff group:
 *    - --superowner
 *    - --user <username>
 *    - --tenant <tenant_id> --admin-only
 *    - --tenant <tenant_id> --all-staff [--exclude-user <username>]
 * 2. Never sets the same password for several accounts.
 * 3. Never touches other tenants' admins.
 * 4. Requires --yes confirmation; without --yes, prints dry-run list of affected accounts (usernames only).
 * 5. Bumps token_version to invalidate prior sessions and sets must_change_password = 1.
 * 6. Supports --disable flag to set status = 'inactive' and bump token_version for ONE named account.
 *    - Safeguard 1: Refuses to disable the active superowner configured in SUPEROWNER_USERNAME.
 *    - Safeguard 2: Refuses to disable the LAST active admin of any tenant.
 *
 * Usage Examples:
 *   # Dry-run previews (no changes made):
 *   node server/scripts/rotate_credentials.js --user cashier_01
 *   node server/scripts/rotate_credentials.js --tenant <tenant_id> --admin-only
 *   node server/scripts/rotate_credentials.js --tenant <tenant_id> --all-staff
 *   node server/scripts/rotate_credentials.js --disable --user old_superowner
 *
 *   # Execute rotation with confirmation:
 *   node server/scripts/rotate_credentials.js --user cashier_01 --yes
 *   node server/scripts/rotate_credentials.js --tenant <tenant_id> --admin-only --yes
 *   node server/scripts/rotate_credentials.js --tenant <tenant_id> --all-staff --exclude-user my_admin --yes
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
  return pass + 'A1!';
}

async function rotateCredentials(customArgs = null) {
  const args = customArgs || process.argv.slice(2);
  let isSuperOwner = false;
  let targetUsername = null;
  let targetTenantId = null;
  let adminOnly = false;
  let allStaff = false;
  let excludeUsername = null;
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
    } else if (arg === '--all-staff') {
      allStaff = true;
    } else if (arg === '--exclude-user' && args[i + 1]) {
      excludeUsername = args[i + 1].trim();
      i++;
    } else if (arg === '--disable') {
      isDisable = true;
    } else if (arg === '--password' && args[i + 1]) {
      explicitPassword = args[i + 1];
      i++;
    } else if (arg === '--yes') {
      confirmedYes = true;
    }
  }

  // Validate target arguments
  const targetsSpecified = [isSuperOwner, !!targetUsername, !!targetTenantId].filter(Boolean).length;
  if (targetsSpecified !== 1) {
    console.error('\n❌ ERROR: You must specify exactly one target:');
    console.error('   1. --superowner');
    console.error('   2. --user <username>');
    console.error('   3. --tenant <tenant_id> --admin-only');
    console.error('   4. --tenant <tenant_id> --all-staff [--exclude-user <username>]\n');
    if (customArgs) throw new Error('Invalid target specification');
    process.exit(1);
  }

  if (targetTenantId && !adminOnly && !allStaff) {
    console.error('\n❌ ERROR: When targeting by tenant, specify either --admin-only or --all-staff.\n');
    if (customArgs) throw new Error('Specify --admin-only or --all-staff');
    process.exit(1);
  }

  if (isDisable && targetTenantId) {
    console.error('\n❌ ERROR: The --disable flag must act on ONE named account (--user <username> or --superowner), not an entire tenant.\n');
    if (customArgs) throw new Error('--disable requires single user');
    process.exit(1);
  }

  // Find targeted accounts
  let targetUsers = [];
  if (isSuperOwner) {
    targetUsers = await db.all("SELECT id, username, role, status, tenant_id FROM users WHERE role = 'superowner'");
  } else if (targetUsername) {
    const row = await db.get("SELECT id, username, role, status, tenant_id FROM users WHERE LOWER(username) = ?", [targetUsername.toLowerCase()]);
    if (row) targetUsers = [row];
  } else if (targetTenantId && adminOnly) {
    targetUsers = await db.all("SELECT id, username, role, status, tenant_id FROM users WHERE tenant_id = ? AND role = 'admin'", [targetTenantId]);
  } else if (targetTenantId && allStaff) {
    let rows = await db.all("SELECT id, username, role, status, tenant_id FROM users WHERE tenant_id = ? AND status = 'active'", [targetTenantId]);
    if (excludeUsername) {
      rows = rows.filter(u => u.username.toLowerCase() !== excludeUsername.toLowerCase());
    }
    targetUsers = rows;
  }

  if (targetUsers.length === 0) {
    console.error('\n❌ ERROR: No matching account found for specified target.\n');
    if (customArgs) throw new Error('No matching account found');
    process.exit(1);
  }

  if (isDisable && targetUsers.length !== 1) {
    console.error(`\n❌ ERROR: --disable can only operate on exactly one account (${targetUsers.length} found). Specify --user <username> directly.\n`);
    if (customArgs) throw new Error('--disable requires single user');
    process.exit(1);
  }

  // DEACTIVATION MODE (--disable) SAFEGUARDS
  if (isDisable) {
    const target = targetUsers[0];

    // Safeguard 1: Refuse to disable active environment superowner
    const envSuperowner = (process.env.SUPEROWNER_USERNAME || '').trim().toLowerCase();
    if (envSuperowner && target.username.toLowerCase() === envSuperowner) {
      const errMsg = `Refusing to disable the active platform superowner account "${target.username}" configured in SUPEROWNER_USERNAME.`;
      console.error(`\n❌ ERROR: ${errMsg}\n`);
      if (customArgs) throw new Error(errMsg);
      process.exit(1);
    }

    // Safeguard 2: Refuse to disable the last active administrator of any tenant
    if (target.role === 'admin' && target.tenant_id) {
      const adminCountRow = await db.get(
        "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'admin' AND status = 'active'",
        [target.tenant_id]
      );
      if (adminCountRow && Number(adminCountRow.count) <= 1) {
        const errMsg = `Refusing to disable user "${target.username}". This is the LAST ACTIVE ADMINISTRATOR for tenant "${target.tenant_id}". Every tenant must maintain at least one active administrator to prevent permanent administrative lockout.`;
        console.error(`\n❌ ERROR: ${errMsg}\n`);
        if (customArgs) throw new Error(errMsg);
        process.exit(1);
      }
    }

    if (!confirmedYes) {
      console.log('\n======================================================');
      console.log('   ShopOS Security Account Deactivation: DRY RUN');
      console.log('======================================================');
      console.log(`Target Account to Deactivate: ${target.username} (Role: ${target.role}${target.tenant_id ? `, Tenant: ${target.tenant_id}` : ''})`);
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
    console.log(`Target Mode: ${isSuperOwner ? 'SuperOwner' : targetUsername ? `Single User (${targetUsername})` : allStaff ? `All Staff for Tenant (${targetTenantId})` : `Tenant Admins (${targetTenantId})`}`);
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
      : allStaff
      ? `node server/scripts/rotate_credentials.js --tenant ${targetTenantId} --all-staff${excludeUsername ? ` --exclude-user ${excludeUsername}` : ''} --yes`
      : `node server/scripts/rotate_credentials.js --tenant ${targetTenantId} --admin-only --yes`;
    console.log(`  ${exampleCmd}\n======================================================\n`);
    return { dryRun: true, count: targetUsers.length, users: targetUsers.map(u => u.username) };
  }

  // EXECUTION WITH --YES CONFIRMATION
  console.log('\n======================================================');
  console.log('   ShopOS Security Credential Rotation: EXECUTING');
  console.log('======================================================');

  if (targetUsers.length > 1 && explicitPassword) {
    console.error('\n❌ ERROR: Setting an identical explicit password for multiple accounts is forbidden.');
    console.error('   Each account will be assigned a distinct cryptographically random password.\n');
    if (customArgs) throw new Error('Identical explicit password forbidden for multi-account');
    process.exit(1);
  }

  const generatedCredentials = [];

  for (const u of targetUsers) {
    const plainPassword = (targetUsers.length === 1 && explicitPassword)
      ? explicitPassword
      : generateSecureRandomPassword();

    if (plainPassword.length < 10) {
      console.error('\n❌ ERROR: Password must be at least 10 characters long.\n');
      if (customArgs) throw new Error('Password too short');
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

  return { dryRun: false, count: targetUsers.length, accounts: targetUsers.map(u => u.username), credentials: generatedCredentials };
}

if (require.main === module) {
  rotateCredentials().then(() => process.exit(0)).catch(err => {
    console.error('Rotation error:', err.message);
    process.exit(1);
  });
}

module.exports = { rotateCredentials };
