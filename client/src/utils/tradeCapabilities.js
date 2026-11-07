/**
 * Trade Capabilities Matrix (ShoppyOS Multi-Trade Support)
 *
 * Backed by /shared/tradeCapabilities.json for server & client parity.
 * frozen_food is the benchmark gold reference and remains byte-identical.
 */

import sharedData from '../../../shared/tradeCapabilities.json';
import { getTerminology, BUSINESS_TYPE_LABELS } from './terminology';

export const TRADE_CAPABILITIES = sharedData.trades;
export const TRADE_ALIASES = sharedData.aliases;

/**
 * Resolves a trade identifier applying aliases ('retail' -> 'retail_general').
 * If tradeInput is missing/null/empty, safely defaults to 'retail_general'.
 */
export function resolveTradeId(tradeInput) {
  if (!tradeInput) {
    return 'retail_general';
  }

  const clean = String(tradeInput).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (TRADE_CAPABILITIES[clean]) return clean;
  if (TRADE_ALIASES[clean]) return TRADE_ALIASES[clean];

  const raw = String(tradeInput).toLowerCase().trim();
  if (TRADE_CAPABILITIES[raw]) return raw;
  if (TRADE_ALIASES[raw]) return TRADE_ALIASES[raw];

  // Fuzzy fallback
  for (const [alias, target] of Object.entries(TRADE_ALIASES)) {
    if (clean.includes(alias) || raw.includes(alias)) return target;
  }
  return 'retail_general';
}

/**
 * Returns capability flags and terminology for a given business type.
 */
export function getTradeCapabilities(businessType) {
  const tradeId = resolveTradeId(businessType);
  const resolvedTrade = TRADE_CAPABILITIES[tradeId] || TRADE_CAPABILITIES.retail_general;
  const terminology = getTerminology(resolvedTrade.id);

  return {
    ...resolvedTrade,
    terminology
  };
}

export default getTradeCapabilities;
