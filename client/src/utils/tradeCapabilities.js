/**
 * ShoppyOS Trade Capabilities Engine
 *
 * Configures industry-specific modules, form fields, and POS workflows
 * dynamically when a merchant selects their category.
 *
 * RULE: Frozen Food (frozen_food) is the baseline reference profile
 * and is strictly preserved with all batch, expiry, and cold-chain features.
 */

import { getTerminology, BUSINESS_TYPE_LABELS } from './terminology';

export const TRADE_CAPABILITIES = {
  frozen_food: {
    id: 'frozen_food',
    name: 'Frozen Food & Cold Chain',
    icon: '🧊',
    posMode: 'frozen_lot',
    // Flags
    enableBatches: true,
    enableExpiry: true,
    enableColdChain: true,
    enableWeightCartonPricing: true,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: false,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: true,
    enableBulkPricingTiers: true,
    enableFastBarcodeScan: true,
    defaultUnits: ['kg', 'pkt', 'carton', 'box', 'piece'],
    suggestedCategories: ['Chicken & Poultry', 'Beef & Mutton', 'Fish & Seafood', 'Nuggets & Snacks', 'Ready to Cook', 'Fries & Potato']
  },

  retail_general: {
    id: 'retail_general',
    name: 'Retail & General Store',
    icon: '🛒',
    posMode: 'fast_retail',
    // Flags: Clean, high-speed checkout without cumbersome batch/expiry prompts
    enableBatches: false,
    enableExpiry: false,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: false,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: false,
    enableBulkPricingTiers: false,
    enableFastBarcodeScan: true,
    defaultUnits: ['piece', 'pkt', 'box', 'dozen'],
    suggestedCategories: ['Beverages', 'Snacks & Biscuits', 'Cosmetics & Toiletries', 'Household Cleaning', 'Stationery', 'Confectionery']
  },

  pharmacy: {
    id: 'pharmacy',
    name: 'Pharmacy & Medical Store',
    icon: '💊',
    posMode: 'pharmacy_rx',
    // Flags: Strict batch + expiry + generic formula search
    enableBatches: true,
    enableExpiry: true,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: true,        // e.g. "Paracetamol 500mg"
    enablePrescriptionFlag: true,   // Requires doctor prescription (Rx)
    enableStripTabletUnits: true,   // Box to strip to tablet math
    enableVariants: false,
    enableArticleCode: false,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: false,
    enableBulkPricingTiers: false,
    enableFastBarcodeScan: true,
    defaultUnits: ['box', 'strip', 'tablet', 'syrup', 'vial', 'tube', 'piece'],
    suggestedCategories: ['Antibiotics', 'Pain & Fever', 'Cardiovascular', 'Pediatric Drops', 'Syrups & Suspensions', 'Dermatology & Topicals', 'Surgical & Medical Devices']
  },

  clothing: {
    id: 'clothing',
    name: 'Clothing, Garments & Fashion',
    icon: '👕',
    posMode: 'fashion_variants',
    // Flags: Size & color matrices, style article numbers, zero expiry
    enableBatches: false,
    enableExpiry: false,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: true,           // Size (S/M/L/XL) & Color picker
    enableArticleCode: true,        // Style # or Article code
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: false,
    enableBulkPricingTiers: false,
    enableFastBarcodeScan: true,
    defaultUnits: ['piece', 'suit', 'pair', 'set', 'meter'],
    suggestedCategories: ['Men Shalwar Kameez', 'Men Shirts & Trousers', 'Ladies Unstitched', 'Ladies Pret / Ready-to-Wear', 'Kids Wear', 'Footwear', 'Accessories']
  },

  restaurant: {
    id: 'restaurant',
    name: 'Restaurant, Cafe & Fast Food',
    icon: '🍕',
    posMode: 'restaurant_kot',
    // Flags: Dine-in table management, Kitchen Order Tickets (KOT), add-ons
    enableBatches: false,
    enableExpiry: false,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: false,
    enableTablesKOT: true,          // Table 1, Table 2, Token #
    enableDineInTakeaway: true,     // Dine-In / Takeaway / Delivery
    enableKitchenModifiers: true,   // Extra Cheese, Less Spicy, No Mayo
    enableMeasurements: false,
    enableDeliveryChallan: false,
    enableBulkPricingTiers: false,
    enableFastBarcodeScan: false,
    defaultUnits: ['portion', 'serving', 'cup', 'glass', 'piece'],
    suggestedCategories: ['Burgers & Sandwiches', 'Pizza', 'Karahi & Handi', 'BBQ & Grills', 'Rice & Biryani', 'Beverages & Shakes', 'Desserts']
  },

  hardware: {
    id: 'hardware',
    name: 'Hardware, Sanitary & Building',
    icon: '🔧',
    posMode: 'bulk_wholesale',
    // Flags: Multi-dimensional units (feet/meters/bags), delivery challans
    enableBatches: false,
    enableExpiry: false,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: true,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: true,       // Length, Gauge, Weight
    enableDeliveryChallan: true,    // Gate pass & site delivery
    enableBulkPricingTiers: true,
    enableFastBarcodeScan: true,
    defaultUnits: ['feet', 'meter', 'bag', 'bundle', 'kg', 'ton', 'piece'],
    suggestedCategories: ['Paints & Chemicals', 'Pipes & Sanitary Fittings', 'Power Tools & Hand Tools', 'Electrical & Wiring', 'Cement & Steel', 'Nuts, Bolts & Fasteners']
  },

  wholesale: {
    id: 'wholesale',
    name: 'Wholesale & B2B Distribution',
    icon: '📦',
    posMode: 'bulk_wholesale',
    // Flags: Master cartons, credit terms, salesman routes
    enableBatches: true,
    enableExpiry: true,
    enableColdChain: false,
    enableWeightCartonPricing: true,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: true,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: true,
    enableBulkPricingTiers: true,
    enableFastBarcodeScan: true,
    defaultUnits: ['carton', 'case', 'dozen', 'piece', 'bundle'],
    suggestedCategories: ['Master Cases', 'Imported Goods', 'Bulk FMCG', 'Commodities', 'Wholesale Packs']
  },

  grocery: {
    id: 'grocery',
    name: 'Grocery & Supermarket',
    icon: '🛒',
    posMode: 'fast_retail',
    enableBatches: false,
    enableExpiry: true,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: false,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: false,
    enableBulkPricingTiers: false,
    enableFastBarcodeScan: true,
    defaultUnits: ['kg', 'gram', 'liter', 'pkt', 'piece', 'bottle'],
    suggestedCategories: ['Rice, Flour & Grains', 'Cooking Oil & Ghee', 'Pulses & Daal', 'Spices & Masalas', 'Dairy & Eggs', 'Household & Soaps']
  },

  other: {
    id: 'other',
    name: 'General Business',
    icon: '⚙️',
    posMode: 'fast_retail',
    enableBatches: false,
    enableExpiry: false,
    enableColdChain: false,
    enableWeightCartonPricing: false,
    enableDrugFormula: false,
    enablePrescriptionFlag: false,
    enableStripTabletUnits: false,
    enableVariants: false,
    enableArticleCode: false,
    enableTablesKOT: false,
    enableDineInTakeaway: false,
    enableKitchenModifiers: false,
    enableMeasurements: false,
    enableDeliveryChallan: false,
    enableBulkPricingTiers: false,
    enableFastBarcodeScan: true,
    defaultUnits: ['piece', 'unit', 'set', 'box'],
    suggestedCategories: ['General Items', 'Miscellaneous', 'Supplies']
  }
};

/**
 * Returns capability flags and terminology for a given business type.
 * Always safely defaults to frozen_food if the trade is unknown.
 */
export function getTradeCapabilities(businessType) {
  if (!businessType) return TRADE_CAPABILITIES.frozen_food;
  const key = String(businessType).toLowerCase().trim();

  let resolvedTrade = TRADE_CAPABILITIES[key];

  if (!resolvedTrade) {
    if (key.includes('food') || key.includes('meat') || key.includes('frozen')) {
      resolvedTrade = TRADE_CAPABILITIES.frozen_food;
    } else if (key.includes('pharm') || key.includes('med')) {
      resolvedTrade = TRADE_CAPABILITIES.pharmacy;
    } else if (key.includes('cloth') || key.includes('garment') || key.includes('fashion') || key.includes('apparel')) {
      resolvedTrade = TRADE_CAPABILITIES.clothing;
    } else if (key.includes('rest') || key.includes('cafe') || key.includes('pizza') || key.includes('burger')) {
      resolvedTrade = TRADE_CAPABILITIES.restaurant;
    } else if (key.includes('hard') || key.includes('tool') || key.includes('sanitary')) {
      resolvedTrade = TRADE_CAPABILITIES.hardware;
    } else if (key.includes('whole') || key.includes('distrib')) {
      resolvedTrade = TRADE_CAPABILITIES.wholesale;
    } else if (key.includes('groc') || key.includes('super') || key.includes('kirana')) {
      resolvedTrade = TRADE_CAPABILITIES.grocery;
    } else {
      resolvedTrade = TRADE_CAPABILITIES.retail_general;
    }
  }

  const terminology = getTerminology(resolvedTrade.id);

  return {
    ...resolvedTrade,
    terminology
  };
}
