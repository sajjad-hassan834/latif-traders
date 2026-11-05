/**
 * ShopOS Terminology Map per Business Type
 * Adapts sidebar navigation, page titles, buttons and table headers
 * while keeping internal routes and API names identical.
 */

export const BUSINESS_TYPES_LIST = [
  { id: 'frozen_food', icon: '🧊', label: 'Frozen Food' },
  { id: 'retail_general', icon: '🛒', label: 'Retail' },
  { id: 'pharmacy', icon: '💊', label: 'Pharmacy' },
  { id: 'clothing', icon: '👕', label: 'Clothing' },
  { id: 'restaurant', icon: '🍕', label: 'Restaurant' },
  { id: 'hardware', icon: '🔧', label: 'Hardware' },
  { id: 'wholesale', icon: '📦', label: 'Wholesale' },
  { id: 'other', icon: '⚙️', label: 'Other' }
];

export const BUSINESS_TYPE_LABELS = {
  frozen_food: { name: 'Frozen Food', icon: '🧊' },
  retail_general: { name: 'Retail', icon: '🛒' },
  clothing: { name: 'Clothing', icon: '👕' },
  pharmacy: { name: 'Pharmacy', icon: '💊' },
  restaurant: { name: 'Restaurant', icon: '🍕' },
  hardware: { name: 'Hardware', icon: '🔧' },
  electronics: { name: 'Electronics', icon: '📱' },
  wholesale: { name: 'Wholesale', icon: '📦' },
  grocery: { name: 'Grocery', icon: '🛒' },
  bakery: { name: 'Bakery', icon: '🥐' },
  other: { name: 'Other', icon: '⚙️' }
};

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
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Batch',
    storageLabel: 'Location',
    defaultStorageLocation: 'Freezer #1',
    stockUnitContext: 'in cold room',
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
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Lot',
    storageLabel: 'Location',
    defaultStorageLocation: 'Shelf #1',
    stockUnitContext: 'in stock',
    hasBatches: false,
    hasExpiry: false
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
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Lot',
    storageLabel: 'Location',
    defaultStorageLocation: 'Aisle #1',
    stockUnitContext: 'in stock',
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
    brandLabel: 'Manufacturer',
    productCodeLabel: 'Code',
    lotLabel: 'Batch',
    storageLabel: 'Location',
    defaultStorageLocation: 'Shelf #1',
    stockUnitContext: 'in stock',
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
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Batch',
    storageLabel: 'Location',
    defaultStorageLocation: 'Pantry #1',
    stockUnitContext: 'in stock',
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
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Kitchen raw materials and ingredient bills',
    stockTitle: 'Stock Value',
    productTableHeader: 'MENU ITEM',
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Lot',
    storageLabel: 'Location',
    defaultStorageLocation: 'Kitchen',
    stockUnitContext: 'in stock',
    hasBatches: false,
    hasExpiry: false
  },
  clothing: {
    products: 'Items',
    productSingular: 'Article',
    addProduct: 'Add Article',
    productsSubtitle: 'Apparel, garments, fabric and fashion collection',
    inventorySection: 'Inventory & Stock',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Wholesale textile and garment supply purchases',
    stockTitle: 'Stock Value',
    productTableHeader: 'ARTICLE',
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Lot',
    storageLabel: 'Location',
    defaultStorageLocation: 'Rack #1',
    stockUnitContext: 'in stock',
    hasBatches: false,
    hasExpiry: false
  },
  hardware: {
    products: 'Items',
    productSingular: 'Item',
    addProduct: 'Add Item',
    productsSubtitle: 'Tools, building materials, sanitary and hardware inventory',
    inventorySection: 'Inventory & Warehouse',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Supplier orders and construction materials receiving',
    stockTitle: 'Stock Value',
    productTableHeader: 'ITEM',
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Lot',
    storageLabel: 'Location',
    defaultStorageLocation: 'Shelf #1',
    stockUnitContext: 'in stock',
    hasBatches: false,
    hasExpiry: false
  },
  wholesale: {
    products: 'Goods',
    productSingular: 'Item',
    addProduct: 'Add Item',
    productsSubtitle: 'Bulk inventory cartons, lots and warehouse trade inventory',
    inventorySection: 'Warehouse & Logistics',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Factory & importer consignments and trade goods',
    stockTitle: 'Stock Value',
    productTableHeader: 'ITEM',
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Batch',
    storageLabel: 'Location',
    defaultStorageLocation: 'Bay #1',
    stockUnitContext: 'in warehouse',
    hasBatches: true,
    hasExpiry: true
  },
  other: {
    products: 'Products',
    productSingular: 'Product',
    addProduct: 'Add Product',
    productsSubtitle: 'General catalog, items and stock inventory',
    inventorySection: 'Inventory & Stock',
    purchases: 'Purchases',
    purchaseSingular: 'Purchase',
    newPurchase: 'New Purchase',
    purchasesSubtitle: 'Supplier bills and stock intake',
    stockTitle: 'Stock Value',
    productTableHeader: 'PRODUCT',
    brandLabel: 'Brand',
    productCodeLabel: 'Code',
    lotLabel: 'Lot',
    storageLabel: 'Location',
    defaultStorageLocation: 'Shelf #1',
    stockUnitContext: 'in stock',
    hasBatches: false,
    hasExpiry: false
  }
};

export function getTerminology(businessType) {
  if (!businessType) return TERMINOLOGY_MAP.retail_general;
  const key = String(businessType).toLowerCase().trim();
  if (key === 'restaurant' || key === 'food' || key === 'cafe') return TERMINOLOGY_MAP.restaurant;
  if (key === 'pharmacy' || key === 'medical') return TERMINOLOGY_MAP.pharmacy;
  if (key === 'clothing' || key === 'apparel' || key === 'boutique') return TERMINOLOGY_MAP.clothing;
  if (key === 'hardware' || key === 'sanitary' || key === 'construction') return TERMINOLOGY_MAP.hardware;
  if (key === 'wholesale' || key === 'distributor') return TERMINOLOGY_MAP.wholesale;
  if (key === 'frozen_food' || key === 'meat' || key === 'poultry') return TERMINOLOGY_MAP.frozen_food;
  if (key === 'grocery' || key === 'kirana') return TERMINOLOGY_MAP.grocery;
  if (key === 'bakery' || key === 'baker') return TERMINOLOGY_MAP.bakery;
  if (key === 'other' || key === 'custom') return TERMINOLOGY_MAP.other;
  return TERMINOLOGY_MAP.retail_general;
}
