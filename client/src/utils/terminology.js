/**
 * ShopOS Terminology Map per Business Type
 * Adapts sidebar navigation, page titles, buttons and table headers
 * while keeping internal routes and API names identical.
 */

export const TERMINOLOGY_MAP = {
  frozen_food: {
    products: 'Products',
    productSingular: 'Product',
    addProduct: 'Add Product',
    productsSubtitle: 'Frozen items, meat cuts, nuggets and inventory list',
    inventorySection: 'Inventory & Warehouse',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Supplier purchase orders and warehouse receiving',
    stockTitle: 'Stock Value',
    productTableHeader: 'PRODUCT',
    hasBatches: true,
    hasExpiry: true
  },
  grocery: {
    products: 'Items',
    productSingular: 'Item',
    addProduct: 'Add Item',
    productsSubtitle: 'Kirana, food grains, staples, oils and daily household essentials',
    inventorySection: 'Stock & Grocery',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Wholesale distributor purchases and stock intake',
    stockTitle: 'Stock Value',
    productTableHeader: 'ITEM',
    hasBatches: false,
    hasExpiry: true
  },
  pharmacy: {
    products: 'Medicines',
    productSingular: 'Medicine',
    addProduct: 'Add Medicine',
    productsSubtitle: 'Prescription drugs, syrups, healthcare and medical supplies',
    inventorySection: 'Pharmacy & Stock',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Pharmaceutical distributor orders and medicine stock',
    stockTitle: 'Stock Value',
    productTableHeader: 'MEDICINE',
    hasBatches: true,
    hasExpiry: true
  },
  bakery: {
    products: 'Bakery Items',
    productSingular: 'Bakery Item',
    addProduct: 'Add Item',
    productsSubtitle: 'Cakes, breads, pastries, cookies and confections',
    inventorySection: 'Bakery Stock',
    purchases: 'Raw Material Purchases',
    purchaseSingular: 'Ingredient Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Flour, dairy, sugar and baking ingredients receiving',
    stockTitle: 'Stock Value',
    productTableHeader: 'BAKERY ITEM',
    hasBatches: true,
    hasExpiry: true
  },
  retail_general: {
    products: 'Products',
    productSingular: 'Product',
    addProduct: 'Add Product',
    productsSubtitle: 'Store inventory, retail merchandise and catalog items',
    inventorySection: 'Inventory & Warehouse',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Supplier invoices and incoming inventory stock',
    stockTitle: 'Stock Value',
    productTableHeader: 'PRODUCT',
    hasBatches: false,
    hasExpiry: false
  },
  wholesale: {
    products: 'Goods & SKU Catalog',
    productSingular: 'SKU Item',
    addProduct: 'Add SKU',
    productsSubtitle: 'Bulk inventory cartons, lots and warehouse trade inventory',
    inventorySection: 'Warehouse & Logistics',
    purchases: 'Procurement Purchases',
    purchaseSingular: 'Procurement Order',
    newPurchase: 'New Procurement',
    purchasesSubtitle: 'Factory & importer consignments and trade goods',
    stockTitle: 'Stock Value',
    productTableHeader: 'SKU / ITEM',
    hasBatches: true,
    hasExpiry: true
  },
  restaurant: {
    products: 'Menu Items',
    productSingular: 'Menu Item',
    addProduct: 'Add Menu Item',
    productsSubtitle: 'Dishes, drinks, fast food and beverage catalog',
    inventorySection: 'Menu & Stock',
    purchases: 'Ingredient Purchases',
    purchaseSingular: 'Ingredient Purchase',
    newPurchase: 'Add Ingredient Purchase',
    purchasesSubtitle: 'Manage kitchen raw materials and ingredient bills',
    stockTitle: 'Stock Value',
    productTableHeader: 'MENU ITEM',
    hasBatches: false,
    hasExpiry: false
  },
  clothing: {
    products: 'Items',
    productSingular: 'Item',
    addProduct: 'Add Item',
    productsSubtitle: 'Apparel, garments, fabric and fashion collection',
    inventorySection: 'Inventory & Stock',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Wholesale textile and garment supply purchases',
    stockTitle: 'Stock Value',
    productTableHeader: 'ITEM',
    hasBatches: false,
    hasExpiry: false
  }
};

export function getTerminology(businessType) {
  if (!businessType) return TERMINOLOGY_MAP.retail_general;
  const key = String(businessType).toLowerCase().trim();
  if (key === 'restaurant' || key === 'food' || key === 'cafe') return TERMINOLOGY_MAP.restaurant;
  if (key === 'pharmacy' || key === 'medical') return TERMINOLOGY_MAP.pharmacy;
  if (key === 'bakery' || key === 'baker') return TERMINOLOGY_MAP.bakery;
  if (key === 'grocery' || key === 'kirana') return TERMINOLOGY_MAP.grocery;
  if (key === 'wholesale' || key === 'distributor') return TERMINOLOGY_MAP.wholesale;
  if (key === 'clothing' || key === 'apparel' || key === 'boutique') return TERMINOLOGY_MAP.clothing;
  if (key === 'frozen_food' || key === 'meat' || key === 'poultry') return TERMINOLOGY_MAP.frozen_food;
  return TERMINOLOGY_MAP.retail_general;
}
