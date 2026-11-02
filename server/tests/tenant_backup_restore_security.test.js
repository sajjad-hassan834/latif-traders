const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');
const backupController = require('../controllers/backupController');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function runBackupSecurityTests() {
  console.log('\n======================================================');
  console.log('  TENANT BACKUP & RESTORE SECURITY TEST SUITE');
  console.log('======================================================\n');

  const tenantId = 't_backup_sec_test';
  const victimId = 't_victim_sec_test';

  // Setup test tenants in SQLite
  db.setDriver('sqlite');
  await db.run("INSERT INTO tenants (id, business_name, owner_name) VALUES (?, 'Backup Sec Co', 'Tester') ON CONFLICT (id) DO NOTHING", [tenantId]);
  await db.run("INSERT INTO tenants (id, business_name, owner_name) VALUES (?, 'Victim Co', 'Victim') ON CONFLICT (id) DO NOTHING", [victimId]);

  // Seed sample product and customer for test tenant
  await db.run("INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price) VALUES (?, 'Secure Product', 'SKU-SEC', 10, 20) ON CONFLICT (tenant_id, sku) DO NOTHING", [tenantId]);
  await db.run("INSERT INTO customers (tenant_id, name, current_balance) VALUES (?, 'Secure Customer', 100)", [tenantId]);

  // --- Test 1: Tenant Export Contains Zero Password Hashes / Secrets ---
  console.log('--- Test 1: Tenant Export Content Audit ---');
  let exportJson = null;
  const mockReqExport = {
    tenant_id: tenantId,
    user: { id: 1, full_name: 'Admin Tester', tenant_id: tenantId }
  };
  const mockResExport = {
    json: (data) => { exportJson = data; return mockResExport; },
    status: () => mockResExport
  };

  await backupController.createBackup(mockReqExport, mockResExport);
  assert(exportJson && exportJson.success, 'Backup created successfully');

  const backupDir = path.join(__dirname, '..', '..', 'data', 'backups', tenantId);
  const backupFile = path.join(backupDir, exportJson.backup.filename);
  const fileContent = fs.readFileSync(backupFile, 'utf8');
  const parsedBackup = JSON.parse(fileContent);

  // Assert no auth tables exported
  assert(!parsedBackup.tables.users, 'users table is NOT included in tenant export');
  assert(!parsedBackup.tables.password_reset_requests, 'password_reset_requests table is NOT included in tenant export');
  assert(!parsedBackup.tables.tenants, 'tenants table is NOT included in tenant export');

  // String scan for sensitive keywords
  const secretKeywords = ['password_hash', 'reset_token_hash', 'jwt_secret'];
  for (const kw of secretKeywords) {
    assert(!fileContent.includes(kw), `Export payload contains zero "${kw}" occurrences`);
  }

  // --- Test 2: Injected Spoofed tenant_id is Overwritten / Prevented ---
  console.log('\n--- Test 2: Malicious Injected tenant_id Protection ---');
  const maliciousPayload = {
    version: '2.0',
    tenant_id: victimId, // Attempting to inject into victim tenant
    shop_name: 'Hacked Shop',
    tables: {
      products: [
        { name: 'Injected Malicious Item', sku: 'INJECT-01', purchase_price: 1, sale_price: 2, tenant_id: victimId }
      ]
    }
  };

  const maliciousFilename = 'malicious_injection_test.json';
  const maliciousFilePath = path.join(backupDir, maliciousFilename);
  fs.writeFileSync(maliciousFilePath, JSON.stringify(maliciousPayload), 'utf8');

  const mockReqRestore = {
    tenant_id: tenantId,
    user: { id: 1, full_name: 'Attacker Tester', tenant_id: tenantId },
    body: { filename: maliciousFilename }
  };
  let restoreResult = null;
  const mockResRestore = {
    json: (data) => { restoreResult = data; return mockResRestore; },
    status: () => mockResRestore
  };

  await backupController.restoreBackup(mockReqRestore, mockResRestore);
  assert(restoreResult && restoreResult.success, 'Restore executed within tenant bounds');

  // Verify victim tenant has ZERO injected products
  const victimProducts = await db.all('SELECT * FROM products WHERE tenant_id = ? AND sku = ?', [victimId, 'INJECT-01']);
  assert(victimProducts.length === 0, 'Target victim tenant has 0 injected rows (cross-tenant injection BLOCKED)');

  // Verify product was forced to attacker tenant_id
  const attackerProducts = await db.all('SELECT * FROM products WHERE tenant_id = ? AND sku = ?', [tenantId, 'INJECT-01']);
  assert(attackerProducts.length === 1 && attackerProducts[0].tenant_id === tenantId, 'Injected row was forced strictly to caller tenant_id');

  // --- Test 3: Injected Admin User Row is Completely Rejected ---
  console.log('\n--- Test 3: Injected users Table Protection ---');
  const userInjectionPayload = {
    version: '2.0',
    tenant_id: tenantId,
    tables: {
      users: [
        { username: 'backdoor_admin', role: 'admin', password_hash: 'evil_hash', full_name: 'Backdoor' }
      ]
    }
  };
  const userInjFilename = 'user_injection_test.json';
  fs.writeFileSync(path.join(backupDir, userInjFilename), JSON.stringify(userInjectionPayload), 'utf8');

  mockReqRestore.body.filename = userInjFilename;
  await backupController.restoreBackup(mockReqRestore, mockResRestore);

  const backdoorUser = await db.get("SELECT * FROM users WHERE username = 'backdoor_admin'");
  assert(!backdoorUser, 'Injected user row was completely ignored and NOT inserted into users table');

  // --- Test 4: Injected Extra / Unknown Columns are Stripped by Allowed Whitelist ---
  console.log('\n--- Test 4: Injected Extra Columns Protection ---');
  const extraColsPayload = {
    version: '2.0',
    tenant_id: tenantId,
    tables: {
      categories: [
        { name: 'Legit Category', description: 'Test', malicious_column: 'DROP TABLE', is_admin_payload: true }
      ]
    }
  };
  const extraColsFilename = 'extra_cols_test.json';
  fs.writeFileSync(path.join(backupDir, extraColsFilename), JSON.stringify(extraColsPayload), 'utf8');

  mockReqRestore.body.filename = extraColsFilename;
  await backupController.restoreBackup(mockReqRestore, mockResRestore);
  const restoredCat = await db.get("SELECT * FROM categories WHERE tenant_id = ? AND name = 'Legit Category'", [tenantId]);
  assert(restoredCat && restoredCat.name === 'Legit Category', 'Row with extra columns inserted safely with only allowed columns');

  // --- Test 5: Oversized File (>25MB) is Strictly Blocked ---
  console.log('\n--- Test 5: Oversized File Rejection ---');
  const oversizedFilename = 'oversized_backup_test.json';
  const oversizedPath = path.join(backupDir, oversizedFilename);
  // Create a 26MB dummy file
  const buffer26MB = Buffer.alloc(26 * 1024 * 1024);
  fs.writeFileSync(oversizedPath, buffer26MB);

  let oversizeErrorStatus = null;
  let oversizeErrorBody = null;
  const mockResOversize = {
    status: (code) => { oversizeErrorStatus = code; return mockResOversize; },
    json: (body) => { oversizeErrorBody = body; return mockResOversize; }
  };
  mockReqRestore.body.filename = oversizedFilename;
  await backupController.restoreBackup(mockReqRestore, mockResOversize);
  fs.unlinkSync(oversizedPath);

  assert(oversizeErrorStatus === 400, 'Oversized file rejected with HTTP 400');
  assert(oversizeErrorBody.message.includes('exceeds maximum allowed size'), 'Oversized rejection message matches policy');

  // --- Test 6: Dry-Run Diff Preview Mode (No DB Mutation) ---
  console.log('\n--- Test 6: Dry-Run Diff Preview ---');
  let dryRunRes = null;
  const mockResDryRun = {
    json: (body) => { dryRunRes = body; return mockResDryRun; },
    status: () => mockResDryRun
  };
  mockReqRestore.body = { filename: maliciousFilename, dry_run: true };
  await backupController.restoreBackup(mockReqRestore, mockResDryRun);

  assert(dryRunRes && dryRunRes.dry_run === true, 'Dry-run preview flag returned true');
  assert(dryRunRes.diff && dryRunRes.diff.products, 'Dry-run diff calculated for products table');
  assert(dryRunRes.message.includes('No changes written'), 'Dry-run confirmed zero database mutations');

  // Clean up
  await db.run('DELETE FROM products WHERE tenant_id IN (?, ?)', [tenantId, victimId]);
  await db.run('DELETE FROM customers WHERE tenant_id IN (?, ?)', [tenantId, victimId]);
  await db.run('DELETE FROM tenants WHERE id IN (?, ?)', [tenantId, victimId]);

  console.log('\n======================================================');
  console.log('  🎉 ALL TENANT BACKUP & RESTORE SECURITY TESTS PASSED!');
  console.log('======================================================\n');
}

runBackupSecurityTests().catch(err => {
  console.error('\n❌ Backup security test failed:', err);
  process.exit(1);
});

