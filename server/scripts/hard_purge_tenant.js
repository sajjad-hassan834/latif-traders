#!/usr/bin/env node
/**
 * CLI Tool: Hard Purge Tenant
 * Permanently deletes a soft-deleted tenant and all associated records.
 * Requires explicit CLI confirmation flag: --confirm-purge
 */

const { db } = require('../config/database');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

async function main() {
  const args = process.argv.slice(2);
  const tenantIdx = args.indexOf('--tenant');
  const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;
  const isConfirmed = args.includes('--confirm-purge');

  if (!tenantId) {
    console.error('Usage: node server/scripts/hard_purge_tenant.js --tenant <tenant_id> --confirm-purge');
    process.exit(1);
  }

  if (tenantId === LEGACY_TENANT_ID) {
    console.error(`ERROR: The primary base tenant (${LEGACY_TENANT_ID}) can never be hard-purged.`);
    process.exit(1);
  }

  if (!isConfirmed) {
    console.error('ERROR: Refusing to delete without explicit confirmation flag --confirm-purge.');
    process.exit(1);
  }

  const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) {
    console.error(`ERROR: Tenant '${tenantId}' does not exist.`);
    process.exit(1);
  }

  if (tenant.is_default) {
    console.error(`ERROR: Tenant '${tenantId}' is marked as default and cannot be purged.`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`HARD PURGE: Permanently deleting tenant '${tenantId}' (${tenant.business_name})`);
  console.log(`======================================================`);

  await db.transaction(async (tx) => {
    const runner = tx.run ? tx : db;
    await runner.run('DELETE FROM sale_items WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM sales WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM purchase_items WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM purchases WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM inventory_movements WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM batches WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM products WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM customers WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM suppliers WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM expenses WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM payments WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM subscriptions WHERE tenant_id = ?', [tenantId]);
    await runner.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  });

  console.log(`✅ Tenant '${tenantId}' and all associated records permanently purged.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Hard purge failed:', err);
  process.exit(1);
});
