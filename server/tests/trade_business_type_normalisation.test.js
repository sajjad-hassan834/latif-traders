const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTradeId, isBatchlessActive } = require('../utils/tradeBatch');
const { LEGACY_TENANT_ID } = require('../constants/tenant');
const { db } = require('../config/database');

test('TRADE BUSINESS TYPE NORMALISATION & PARITY TEST SUITE', async (t) => {
  await t.test('1. Normalisation Decision Table - Server resolveTradeId', () => {
    // Missing / NULL / empty cases
    assert.equal(resolveTradeId(null, LEGACY_TENANT_ID), 'frozen_food', 'NULL for latif_001 must resolve to frozen_food');
    assert.equal(resolveTradeId('', LEGACY_TENANT_ID), 'frozen_food', 'Empty string for latif_001 must resolve to frozen_food');
    assert.equal(resolveTradeId(undefined, LEGACY_TENANT_ID), 'frozen_food', 'Undefined for latif_001 must resolve to frozen_food');
    assert.equal(resolveTradeId(null, 'default'), 'frozen_food', 'default tenant must resolve to frozen_food');

    // Missing for any other tenant -> retail_general
    assert.equal(resolveTradeId(null, 't_other_store'), 'retail_general', 'NULL for non-Latif tenant must safely resolve to retail_general');
    assert.equal(resolveTradeId('', 't_other_store'), 'retail_general', 'Empty string for non-Latif tenant must safely resolve to retail_general');
    assert.equal(resolveTradeId(undefined, 't_other_store'), 'retail_general', 'Undefined for non-Latif tenant must safely resolve to retail_general');

    // Legacy and compound casing
    assert.equal(resolveTradeId('Frozen Food', 't_any'), 'frozen_food', 'Title case "Frozen Food" must resolve to frozen_food');
    assert.equal(resolveTradeId('frozen food', 't_any'), 'frozen_food', 'Space separated "frozen food" must resolve to frozen_food');
    assert.equal(resolveTradeId('FROZEN_FOOD', 't_any'), 'frozen_food', 'Uppercase "FROZEN_FOOD" must resolve to frozen_food');
    assert.equal(resolveTradeId('frozen_food', 't_any'), 'frozen_food', 'Exact "frozen_food" must resolve to frozen_food');
    assert.equal(resolveTradeId('meat', 't_any'), 'frozen_food', 'Alias "meat" must resolve to frozen_food');
    assert.equal(resolveTradeId('poultry', 't_any'), 'frozen_food', 'Alias "poultry" must resolve to frozen_food');
    assert.equal(resolveTradeId('frozen', 't_any'), 'frozen_food', 'Alias "frozen" must resolve to frozen_food');

    // Retail variations
    assert.equal(resolveTradeId('retail', 't_any'), 'retail_general', 'Alias "retail" must resolve to retail_general');
    assert.equal(resolveTradeId('general', 't_any'), 'retail_general', 'Alias "general" must resolve to retail_general');
    assert.equal(resolveTradeId('retail_general', 't_any'), 'retail_general', 'Exact "retail_general" must resolve to retail_general');
    assert.equal(resolveTradeId('Retail Store', 't_any'), 'retail_general', 'Fuzzy "Retail Store" must resolve to retail_general');

    // Other supported trades
    assert.equal(resolveTradeId('pharmacy', 't_any'), 'pharmacy', 'pharmacy trade resolves correctly');
    assert.equal(resolveTradeId('medical', 't_any'), 'pharmacy', 'Alias "medical" resolves to pharmacy');
    assert.equal(resolveTradeId('clothing', 't_any'), 'clothing', 'clothing trade resolves correctly');
    assert.equal(resolveTradeId('apparel', 't_any'), 'clothing', 'Alias "apparel" resolves to clothing');
  });

  await t.test('2. Database Integration & isBatchlessActive Behavior', async () => {
    const retailTenant = `t_norm_retail_${Date.now()}`;

    // Tenant latif_001 simulation with empty string business_type
    try {
      await db.run(
        "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'Latif Stand-in', 'Latif Owner', 'pro', '', 1)",
        [LEGACY_TENANT_ID]
      );
    } catch (_) {
      // If latif_001 already exists in db, update it
      await db.run("UPDATE tenants SET business_type = '' WHERE id = ?", [LEGACY_TENANT_ID]);
    }

    // latif_001 with empty business_type must NEVER be batchless (frozen_food preserved)
    const latifBatchless = await isBatchlessActive(db, LEGACY_TENANT_ID);
    assert.equal(latifBatchless, false, 'latif_001 with empty business_type must strictly keep batch/cold room mode (not batchless)');

    // Other tenant with empty business_type resolves to retail_general
    await db.run(
      "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES (?, 'New Generic Shop', 'New Owner', 'free', '', 1)",
      [retailTenant]
    );

    // If retail tenant enables trade_ui_v2, it activates batchless
    await db.run(
      "INSERT INTO tenant_settings (tenant_id, key, value) VALUES (?, 'trade_ui_v2', 'true') ON CONFLICT(tenant_id, key) DO UPDATE SET value = 'true'",
      [retailTenant]
    );
    const retailBatchless = await isBatchlessActive(db, retailTenant);
    assert.equal(retailBatchless, true, 'retail tenant with empty business_type resolving to retail_general activates batchless mode when flag is ON');
  });
});
