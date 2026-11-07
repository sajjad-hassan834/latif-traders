/**
 * Trade Batch & Expiry Helper (Server-side)
 * Handles auto lot generation and expiry policy based on trade capability matrix and tenant settings.
 */

const sharedData = require('../../shared/tradeCapabilities.json');

const TRADES = sharedData.trades;
const ALIASES = sharedData.aliases;

/**
 * Normalises business_type applying aliases ('retail' -> 'retail_general').
 * If businessType is falsy, safely defaults to 'retail_general'.
 */
function resolveTradeId(businessType) {
  if (!businessType) {
    return 'retail_general';
  }

  const clean = String(businessType).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (TRADES[clean]) return clean;
  if (ALIASES[clean]) return ALIASES[clean];

  const raw = String(businessType).toLowerCase().trim();
  if (TRADES[raw]) return raw;
  if (ALIASES[raw]) return ALIASES[raw];

  for (const [alias, target] of Object.entries(ALIASES)) {
    if (clean.includes(alias) || raw.includes(alias)) return target;
  }
  return 'retail_general';
}

/**
 * Checks if batchless mode is active for this tenant.
 * Conditions:
 * 1. Trade has enableBatches === false
 * 2. tenant_settings key 'trade_ui_v2' is strictly === 'true' (missing, 'false', '0', '' mean OFF)
 */
async function isBatchlessActive(db, tenantId) {
  try {
    // 1. Get tenant business_type
    const tenantRow = await db.get('SELECT business_type FROM tenants WHERE id = ?', [tenantId]);
    const tradeId = resolveTradeId(tenantRow?.business_type);
    const tradeConfig = TRADES[tradeId] || TRADES.frozen_food;

    if (tradeConfig.enableBatches !== false) {
      return false; // Batches are explicitly enabled for this trade (e.g. frozen_food, pharmacy)
    }

    // 2. Check tenant_settings for trade_ui_v2
    const settingRow = await db.get(
      'SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = ?',
      [tenantId, 'trade_ui_v2']
    );

    // Read strictly as === 'true'
    return settingRow?.value === 'true';
  } catch (err) {
    console.error('Error resolving isBatchlessActive:', err.message);
    return false;
  }
}

/**
 * Generates opening stock batch details.
 * If batchless active:
 *   - Auto lot number prefixed with 'AUTO-OP-'
 *   - expiry_date is strictly null
 * Otherwise:
 *   - Uses user-provided batch_no and expiry_date (or default 180-day for frozen_food / flag off)
 */
async function resolveOpeningBatch(db, tenantId, userBatchNo, userExpiryDate) {
  const batchless = await isBatchlessActive(db, tenantId);

  if (batchless) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const autoLot = `AUTO-OP-${timestamp}`;
    return {
      batch_no: autoLot,
      expiry_date: null,
      is_batchless: true
    };
  }

  // Standard legacy workflow (frozen_food or flag off)
  const finalBatchNo = userBatchNo && String(userBatchNo).trim()
    ? String(userBatchNo).trim()
    : `BATCH-${Date.now().toString().slice(-6)}`;

  let finalExpiry = userExpiryDate && String(userExpiryDate).trim()
    ? String(userExpiryDate).trim()
    : null;

  if (!finalExpiry) {
    // 180-day default expiry applies strictly when frozen_food or flag is off
    const d = new Date();
    d.setDate(d.getDate() + 180);
    finalExpiry = d.toISOString().slice(0, 10);
  }

  return {
    batch_no: finalBatchNo,
    expiry_date: finalExpiry,
    is_batchless: false
  };
}

/**
 * Generates purchase item batch details.
 * If batchless active:
 *   - Auto lot number prefixed with 'AUTO-PUR-'
 *   - expiry_date is strictly null
 * Otherwise:
 *   - Uses item.batch_no and item.expiry_date (or 180-day default for frozen_food / flag off)
 */
async function resolvePurchaseBatch(db, tenantId, item) {
  const batchless = await isBatchlessActive(db, tenantId);

  if (batchless) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const autoLot = `AUTO-PUR-${timestamp}-${rand}`;
    return {
      batch_no: autoLot,
      expiry_date: null,
      is_batchless: true
    };
  }

  // Standard workflow
  const finalBatchNo = item.batch_no && String(item.batch_no).trim()
    ? String(item.batch_no).trim()
    : `BATCH-${Date.now().toString().slice(-6)}`;

  let finalExpiry = item.expiry_date && String(item.expiry_date).trim()
    ? String(item.expiry_date).trim()
    : null;

  if (!finalExpiry) {
    const d = new Date();
    d.setDate(d.getDate() + 180);
    finalExpiry = d.toISOString().slice(0, 10);
  }

  return {
    batch_no: finalBatchNo,
    expiry_date: finalExpiry,
    is_batchless: false
  };
}

module.exports = {
  TRADES,
  ALIASES,
  resolveTradeId,
  isBatchlessActive,
  resolveOpeningBatch,
  resolvePurchaseBatch
};
