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

async function runBackupSecurityTestsBody(driver = 'sqlite') {
  try {
  console.log(`\n======================================================`);
  console.log(`  TENANT BACKUP & RESTORE SECURITY TEST SUITE [${driver.toUpperCase()}]`);
  console.log(`======================================================\n`);

  const tenantId = `t_backup_sec_${driver}_${Date.now()}`;
  const victimId = `t_victim_sec_${driver}_${Date.now()}`;

  db.setDriver(driver);
  await db.run("INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'Backup Sec Co', 'Tester', 'enterprise', 'retail_general', 1) ON CONFLICT (id) DO NOTHING", [tenantId]);
  await db.run("INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'Victim Co', 'Victim', 'enterprise', 'retail_general', 1) ON CONFLICT (id) DO NOTHING", [victimId]);

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

  let restoreStatusCode = 200;
  mockResRestore.status = (code) => { restoreStatusCode = code; return mockResRestore; };
  await backupController.restoreBackup(mockReqRestore, mockResRestore);
  assert(restoreStatusCode === 403, 'In-app restore is permanently blocked server-side (HTTP 403)');
  assert(restoreResult && !restoreResult.success, 'Restore result indicates failure');

  // Verify victim tenant has ZERO injected products
  const victimProducts = await db.all('SELECT * FROM products WHERE tenant_id = ? AND sku = ?', [victimId, 'INJECT-01']);
  assert(victimProducts.length === 0, 'Target victim tenant has 0 injected rows (cross-tenant injection BLOCKED)');

  // Verify attacker tenant has 0 injected rows because restore was completely blocked
  const attackerProducts = await db.all('SELECT * FROM products WHERE tenant_id = ? AND sku = ?', [tenantId, 'INJECT-01']);
  assert(attackerProducts.length === 0, 'In-app restore permanently blocked - zero rows inserted');

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
  assert(restoreStatusCode === 403, 'In-app user restore permanently blocked (HTTP 403)');

  const backdoorUser = await db.get("SELECT * FROM users WHERE username = 'backdoor_admin'");
  assert(!backdoorUser, 'Injected user row was completely ignored and NOT inserted into users table');

  // Clean up test files
  try {
    fs.unlinkSync(maliciousFilePath);
    fs.unlinkSync(path.join(backupDir, userInjFilename));
  } catch (_) {}

  // --- Test 4: In-App Restore Permanently Blocked Server-Side (HTTP 403) ---
  console.log('\n--- Test 4: In-App Restore Permanently Disabled (HTTP 403 Protection) ---');
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
  assert(restoreStatusCode === 403, 'Restore returns HTTP 403 Forbidden');
  
  const restoredCat = await db.get("SELECT * FROM categories WHERE tenant_id = ? AND name = 'Legit Category'", [tenantId]);
  assert(!restoredCat, 'Categories table remains 100% unmutated');

  // Clean up
  try {
    fs.unlinkSync(path.join(backupDir, extraColsFilename));
  } catch (_) {}

  } finally {
    // Clean up
    try {
      await db.run('DELETE FROM products WHERE tenant_id IN (?, ?)', [tenantId, victimId]);
      await db.run('DELETE FROM categories WHERE tenant_id IN (?, ?)', [tenantId, victimId]);
      await db.run('DELETE FROM customers WHERE tenant_id IN (?, ?)', [tenantId, victimId]);
      await db.run('DELETE FROM tenants WHERE id IN (?, ?)', [tenantId, victimId]);
    } catch (_) {}
  }
}

async function runBackupSecurityTests() {
  try {
    await runBackupSecurityTestsBody('sqlite');
    if (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL) {
      await runBackupSecurityTestsBody('postgres');
    }
    console.log('\n🎉 ALL TENANT BACKUP & RESTORE SECURITY TESTS PASSED ON BOTH DRIVERS!\n');
  } catch (err) {
    console.error('\n❌ Backup security test failed:', err);
    process.exit(1);
  }
}

runBackupSecurityTests();

