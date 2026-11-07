const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTradeId, isBatchlessActive } = require('../utils/tradeBatch');
const { LEGACY_TENANT_ID } = require('../constants/tenant');
const { db } = require('../config/database');

test('TRADE BUSINESS TYPE NORMALISATION & MIGRATION TEST SUITE', async (t) => {
  await t.test('1. Normalisation Decision Table - Pure resolveTradeId (zero tenant hardcoding)', () => {
    // Missing / NULL / empty cases strictly return retail_general without tenant checking
    assert.equal(resolveTradeId(null), 'retail_general', 'NULL must safely default to retail_general');
    assert.equal(resolveTradeId(''), 'retail_general', 'Empty string must safely default to retail_general');
    assert.equal(resolveTradeId(undefined), 'retail_general', 'Undefined must safely default to retail_general');
    assert.equal(resolveTradeId('   '), 'retail_general', 'Whitespace must safely default to retail_general');

    // Frozen Food variations & aliases
    assert.equal(resolveTradeId('Frozen Food'), 'frozen_food', 'Title case "Frozen Food" must resolve to frozen_food');
    assert.equal(resolveTradeId('frozen food'), 'frozen_food', 'Space separated "frozen food" must resolve to frozen_food');
    assert.equal(resolveTradeId('FROZEN_FOOD'), 'frozen_food', 'Uppercase "FROZEN_FOOD" must resolve to frozen_food');
    assert.equal(resolveTradeId('frozen_food'), 'frozen_food', 'Exact "frozen_food" must resolve to frozen_food');
    assert.equal(resolveTradeId('meat'), 'frozen_food', 'Alias "meat" must resolve to frozen_food');
    assert.equal(resolveTradeId('poultry'), 'frozen_food', 'Alias "poultry" must resolve to frozen_food');
    assert.equal(resolveTradeId('frozen'), 'frozen_food', 'Alias "frozen" must resolve to frozen_food');

    // Retail variations & aliases
    assert.equal(resolveTradeId('retail'), 'retail_general', 'Alias "retail" must resolve to retail_general');
    assert.equal(resolveTradeId('general'), 'retail_general', 'Alias "general" must resolve to retail_general');
    assert.equal(resolveTradeId('retail_general'), 'retail_general', 'Exact "retail_general" must resolve to retail_general');
    assert.equal(resolveTradeId('Retail Store'), 'retail_general', 'Fuzzy "Retail Store" must resolve to retail_general');

    // Other supported trades
    assert.equal(resolveTradeId('pharmacy'), 'pharmacy', 'pharmacy trade resolves correctly');
    assert.equal(resolveTradeId('medical'), 'pharmacy', 'Alias "medical" resolves to pharmacy');
    assert.equal(resolveTradeId('clothing'), 'clothing', 'clothing trade resolves correctly');
    assert.equal(resolveTradeId('apparel'), 'clothing', 'Alias "apparel" resolves to clothing');
  });

  await t.test('2. Additive, Idempotent Migration: Backfill LEGACY_TENANT_ID business_type', async () => {
    // 1. Reset LEGACY_TENANT_ID business_type to empty string to simulate legacy unmigrated record
    try {
      await db.run(
        "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'Latif Traders', 'Mudassir Arif', 'pro', '', 1)",
        [LEGACY_TENANT_ID]
      );
    } catch (_) {
      await db.run("UPDATE tenants SET business_type = '' WHERE id = ?", [LEGACY_TENANT_ID]);
    }

    // Verify row was set to empty
    let tenantRow = await db.get("SELECT business_type FROM tenants WHERE id = ?", [LEGACY_TENANT_ID]);
    assert.equal(tenantRow.business_type, '', 'Pre-condition: legacy tenant has empty business_type');

    // 2. Define the exact migration statement from database.js
    const runMigration = async () => {
      await db.run(`
        UPDATE tenants
        SET business_type = 'frozen_food'
        WHERE id = ?
          AND (business_type IS NULL OR TRIM(business_type) = '')
      `, [LEGACY_TENANT_ID]);
    };

    // Run 1: First execution
    await runMigration();
    tenantRow = await db.get("SELECT business_type FROM tenants WHERE id = ?", [LEGACY_TENANT_ID]);
    assert.equal(tenantRow.business_type, 'frozen_food', 'Run 1: legacy tenant business_type backfilled to frozen_food');

    // Run 2: Second execution (Idempotency assertion)
    await runMigration();
    tenantRow = await db.get("SELECT business_type FROM tenants WHERE id = ?", [LEGACY_TENANT_ID]);
    assert.equal(tenantRow.business_type, 'frozen_food', 'Run 2: Idempotent execution preserves frozen_food without side-effects');

    // Verify isBatchlessActive remains false (cold room / batches strictly preserved for legacy tenant)
    const latifBatchless = await isBatchlessActive(db, LEGACY_TENANT_ID);
    assert.equal(latifBatchless, false, 'Legacy tenant with frozen_food keeps batch and cold room features active');

    // 3. Non-legacy tenant with empty business_type is untouched by migration
    const nonLegacyTenant = `t_unmigrated_retail_${Date.now()}`;
    await db.run(
      "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'New Generic Shop', 'Owner', 'free', '', 1)",
      [nonLegacyTenant]
    );

    // Run migration again: must not touch nonLegacyTenant
    await runMigration();
    const otherRow = await db.get("SELECT business_type FROM tenants WHERE id = ?", [nonLegacyTenant]);
    assert.equal(otherRow.business_type, '', 'Migration only targets LEGACY_TENANT_ID; other tenants untouched');

    // For other tenant, resolveTradeId cleanly returns retail_general
    assert.equal(resolveTradeId(otherRow.business_type), 'retail_general');
  });
});
