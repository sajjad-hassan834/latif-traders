const assert = require('assert');
const crypto = require('crypto');
const shared = require('../../shared/tradeCapabilities.json');
const { resolveTradeId, isBatchlessActive } = require('../utils/tradeBatch');

console.log('========================================================================');
console.log('TRADE MATRIX SHARED JSON & ALIAS NORMALIZATION TEST');
console.log('========================================================================');

// 1. Golden Hash Test: frozen_food matrix must remain byte-identical
const GOLDEN_FROZEN_FOOD_HASH = '61bae8adc15ead32543dff4e80ea2241a595676f347761146db8f39825693645';
const currentFFString = JSON.stringify(shared.trades.frozen_food);
const actualHash = crypto.createHash('sha256').update(currentFFString).digest('hex');

assert.strictEqual(
  actualHash,
  GOLDEN_FROZEN_FOOD_HASH,
  `CRITICAL REGRESSION: frozen_food capability matrix altered! Expected ${GOLDEN_FROZEN_FOOD_HASH}, got ${actualHash}`
);
console.log('  ✅ PASS: frozen_food capability matrix is byte-identical to golden reference.');

// 2. Alias Normalization Test
const aliasTests = [
  ['retail', 'retail_general'],
  ['RETAIL', 'retail_general'],
  ['General Store', 'retail_general'],
  ['kirana', 'grocery'],
  ['supermarket', 'grocery'],
  ['medical', 'pharmacy'],
  ['rx', 'pharmacy'],
  ['garments', 'clothing'],
  ['cafe', 'restaurant'],
  ['food', 'restaurant'],
  ['frozen', 'frozen_food'],
  ['unknown_xyz', 'retail_general']
];

for (const [input, expected] of aliasTests) {
  const resolved = resolveTradeId(input);
  assert.strictEqual(resolved, expected, `Failed resolving alias '${input}'. Expected '${expected}', got '${resolved}'`);
}
console.log('  ✅ PASS: 12/12 trade aliases normalized correctly.');

// 3. Strict Flag Reading Test for trade_ui_v2
const mockDb = (settingVal, businessType = 'retail_general') => ({
  get: async (sql, params) => {
    if (sql.includes('FROM tenants')) {
      return { business_type: businessType };
    }
    if (sql.includes('FROM tenant_settings')) {
      return settingVal !== undefined ? { value: settingVal } : null;
    }
    return null;
  }
});

async function runFlagTests() {
  // 'true' string -> ACTIVE
  assert.strictEqual(await isBatchlessActive(mockDb('true'), 't1'), true, "'true' should be active");

  // Missing, false, 0, empty -> ALL OFF
  assert.strictEqual(await isBatchlessActive(mockDb(undefined), 't1'), false, "Missing setting should be OFF");
  assert.strictEqual(await isBatchlessActive(mockDb('false'), 't1'), false, "'false' should be OFF");
  assert.strictEqual(await isBatchlessActive(mockDb('0'), 't1'), false, "'0' should be OFF");
  assert.strictEqual(await isBatchlessActive(mockDb(''), 't1'), false, "'' should be OFF");
  assert.strictEqual(await isBatchlessActive(mockDb('1'), 't1'), false, "'1' should be OFF (strictly === 'true')");
  assert.strictEqual(await isBatchlessActive(mockDb(null), 't1'), false, "null should be OFF");

  // Frozen food tenant with trade_ui_v2='true' must still NOT be batchless (enableBatches === true)
  assert.strictEqual(
    await isBatchlessActive(mockDb('true', 'frozen_food'), 't_ff'),
    false,
    "frozen_food must never be batchless even if trade_ui_v2 === 'true'"
  );
  console.log('  ✅ PASS: Strict flag reading verified (strictly === "true", frozen_food never batchless).');
}

runFlagTests().then(() => {
  console.log('========================================================================');
  console.log('ALL TRADE MATRIX & ALIAS TESTS PASSED ✅');
  console.log('========================================================================\n');
  process.exit(0);
}).catch(err => {
  console.error('❌ FAILED:', err);
  process.exit(1);
});
