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
 */
export function resolveTradeId(tradeInput) {
  if (!tradeInput) return 'frozen_food';
  const raw = String(tradeInput).toLowerCase().trim();
  if (TRADE_CAPABILITIES[raw]) return raw;
  if (TRADE_ALIASES[raw]) return TRADE_ALIASES[raw];

  // Fuzzy fallback
  for (const [alias, target] of Object.entries(TRADE_ALIASES)) {
    if (raw.includes(alias)) return target;
  }
  return 'retail_general';
}

/**
 * Returns capability flags and terminology for a given business type.
 * Always safely defaults to frozen_food if the trade is unknown.
 */
export function getTradeCapabilities(businessType) {
  const tradeId = resolveTradeId(businessType);
  const resolvedTrade = TRADE_CAPABILITIES[tradeId] || TRADE_CAPABILITIES.frozen_food;
  const terminology = getTerminology(resolvedTrade.id);

  return {
    ...resolvedTrade,
    terminology
  };
}

export default getTradeCapabilities;
