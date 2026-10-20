/**
 * ShopOS SaaS Business Type Configuration
 * Defines pre-seeded categories, units, expense categories, and feature flags per business type.
 */

const BUSINESS_TYPES = {
  frozen_food: {
    id: 'frozen_food',
    name: 'Frozen Food Wholesalers & Retailers',
    icon: '🧊',
    shortName: 'Frozen Food',
    subtitle: 'Cold Storage & Freshness Surveillance',
    hasBatches: true,
    hasExpiry: true,
    hasVariants: false,
    categories: [
      { name: 'Chicken Nuggets & Pops', description: 'Breaded and ready to fry chicken items' },
      { name: 'French Fries & Potato Items', description: 'Frozen plain, crinkle cut and seasoned fries' },
      { name: 'Parathas & Roti', description: 'Frozen plain, whole wheat and layered parathas' },
      { name: 'Samosas & Rolls', description: 'Crispy finger snacks and party packs' },
      { name: 'Kababs & Meatballs', description: 'Seekh, shami, chapli and kofta frozen range' },
      { name: 'Fish & Seafood', description: 'Fish fingers, fillets and prawns' },
      { name: 'Ice Creams & Desserts', description: 'Gulab jamun, frozen desserts and ice creams' }
    ],
    units: [
      { name: 'Packet', short_code: 'pkt' },
      { name: 'Box', short_code: 'box' },
      { name: 'Carton', short_code: 'ctn' },
      { name: 'Kilogram', short_code: 'kg' },
      { name: 'Piece', short_code: 'pcs' }
    ],
    expenseCategories: [
      { name: 'Freezer Electricity', description: 'Electric power bills for deep freezers' },
      { name: 'Shop Rent', description: 'Monthly premises rental' },
      { name: 'Salaries & Wages', description: 'Staff payroll and helper wages' },
      { name: 'Freezer Maintenance & Gas', description: 'Compressor repairs, thermostat and gas refilling' },
      { name: 'Delivery Fuel & Transport', description: 'Supply delivery van fuel and charges' },
      { name: 'Packaging & Bags', description: 'Thermal bags, poly covers and shopping bags' },
      { name: 'Miscellaneous', description: 'Incidental minor business expenses' }
    ]
  },

  retail_general: {
    id: 'retail_general',
    name: 'General Retail & Grocery Shop',
    icon: '🛒',
    shortName: 'Retail Shop',
    subtitle: 'Store Operations & Counter POS',
    hasBatches: false,
    hasExpiry: false,
    hasVariants: false,
    categories: [
      { name: 'Beverages & Soft Drinks', description: 'Cold drinks, juices and mineral water' },
      { name: 'Snacks & Confectionery', description: 'Chips, biscuits, chocolates and sweets' },
      { name: 'Groceries & Staples', description: 'Rice, flour, pulses, spices and cooking oil' },
      { name: 'Dairy & Bakery Items', description: 'Milk, bread, butter, eggs and cheese' },
      { name: 'Personal Care & Hygiene', description: 'Soaps, shampoos, toothpaste and cosmetics' },
      { name: 'Household Cleaners', description: 'Detergents, floor cleaners and dishwash' },
      { name: 'Stationery & General', description: 'Pens, notebooks, batteries and general items' }
    ],
    units: [
      { name: 'Piece', short_code: 'pcs' },
      { name: 'Box', short_code: 'box' },
      { name: 'Pack', short_code: 'pk' },
      { name: 'Dozen', short_code: 'doz' },
      { name: 'Kilogram', short_code: 'kg' },
      { name: 'Liter', short_code: 'ltr' }
    ],
    expenseCategories: [
      { name: 'Shop Rent', description: 'Premises monthly rent' },
      { name: 'Shop Electricity & Bills', description: 'Utility bills and lighting' },
      { name: 'Staff Salaries', description: 'Salesman and helper compensation' },
      { name: 'Stock Transport & Freight', description: 'Delivery van and courier expenses' },
      { name: 'Shopping Bags & Packaging', description: 'Customer shopping bags' },
      { name: 'Tea & Refreshments', description: 'Staff and guest hospitality' },
      { name: 'Miscellaneous Expenses', description: 'Incidental store expenses' }
    ]
  },

  pharmacy: {
    id: 'pharmacy',
    name: 'Pharmacy & Medical Store',
    icon: '💊',
    shortName: 'Pharmacy',
    subtitle: 'Medical Dispensing & Expiry Surveillance',
    hasBatches: true,
    hasExpiry: true,
    hasVariants: false,
    categories: [
      { name: 'Prescription Tablets & Capsules', description: 'Antibiotics, cardiovascular, diabetic drugs' },
      { name: 'Syrups & Suspensions', description: 'Cough, pediatric and antibiotic syrups' },
      { name: 'Injections & IV Fluids', description: 'Injectable medicines, drips and cannulas' },
      { name: 'Ointments & Creams', description: 'Topical skin, burn and antiseptic creams' },
      { name: 'Vitamins & Supplements', description: 'Multivitamins, calcium and nutrition boosters' },
      { name: 'First Aid & Surgical', description: 'Bandages, gauze, syringes, masks and gloves' },
      { name: 'Baby Care & Diapers', description: 'Baby milk powders, wipes and diapers' },
      { name: 'Medical Devices & Diagnostics', description: 'BP monitors, glucometers and thermometers' }
    ],
    units: [
      { name: 'Strip', short_code: 'str' },
      { name: 'Bottle', short_code: 'btl' },
      { name: 'Box', short_code: 'box' },
      { name: 'Piece', short_code: 'pcs' },
      { name: 'Tube', short_code: 'tube' },
      { name: 'Vial', short_code: 'vial' }
    ],
    expenseCategories: [
      { name: 'Shop Rent', description: 'Pharmacy premises rental' },
      { name: 'Air Conditioning & Fridge Electricity', description: 'Mandatory cold medicine temperature maintenance' },
      { name: 'Pharmacist & Staff Salaries', description: 'Certified staff and dispensers' },
      { name: 'Drug Regulatory & Licensing Fees', description: 'Legal renewal and health authority fee' },
      { name: 'Distributor Delivery Charges', description: 'Wholesale medicine transport' },
      { name: 'Packaging & Medicine Bags', description: 'Prescription bags and envelopes' },
      { name: 'Miscellaneous', description: 'Incidental medical store costs' }
    ]
  },

  clothing: {
    id: 'clothing',
    name: 'Clothing, Boutique & Textiles',
    icon: '👕',
    shortName: 'Apparel Store',
    subtitle: 'Fashion Inventory & Size Variants',
    hasBatches: false,
    hasExpiry: false,
    hasVariants: true,
    categories: [
      { name: "Men's Ready to Wear", description: 'Kurta pajama, shirts, trousers and jackets' },
      { name: "Women's Stitched Apparel", description: 'Pret 2-piece, 3-piece suits and frocks' },
      { name: 'Unstitched Lawn & Cotton', description: 'Designer unstitched fabrics and dress material' },
      { name: 'Kids & Infants Wear', description: 'Boys and girls casual and party dresses' },
      { name: 'Footwear & Shoes', description: 'Formal, casual and ethnic footwear' },
      { name: 'Shawls, Dupattas & Stoles', description: 'Winter shawls and embroidered dupattas' },
      { name: 'Fashion Accessories', description: 'Belts, ties, cufflinks and jewelry' }
    ],
    units: [
      { name: 'Piece', short_code: 'pcs' },
      { name: 'Suit', short_code: 'suit' },
      { name: 'Meter', short_code: 'mtr' },
      { name: 'Pair', short_code: 'pair' },
      { name: 'Set', short_code: 'set' }
    ],
    expenseCategories: [
      { name: 'Showroom Rent', description: 'Outlet premises rental' },
      { name: 'Lighting & Display Electricity', description: 'High-power boutique lighting and AC' },
      { name: 'Staff & Sales Salaries', description: 'Showroom salesmen and helpers' },
      { name: 'Tailoring & Alterations', description: 'Master tailor and alteration costs' },
      { name: 'Branded Hangers & Shopping Bags', description: 'Custom printed garment bags' },
      { name: 'Social Media & Marketing', description: 'Instagram, photo shoots and advertising' },
      { name: 'Miscellaneous', description: 'Incidental boutique expenses' }
    ]
  },

  restaurant: {
    id: 'restaurant',
    name: 'Restaurant, Cafe & Fast Food',
    icon: '🍕',
    shortName: 'Restaurant & Cafe',
    subtitle: 'Kitchen Sales & Counter Billing',
    hasBatches: false,
    hasExpiry: false,
    hasVariants: false,
    categories: [
      { name: 'Burgers & Sandwiches', description: 'Zinger, beef burgers, club sandwiches and wraps' },
      { name: 'Pizza & Pasta', description: 'Pan pizzas, pasta and garlic breads' },
      { name: 'BBQ & Karahi Specialties', description: 'Chicken tikka, boti, mutton karahi and naan' },
      { name: 'Starters & Fried Bites', description: 'Wings, fries, nuggets and garlic rolls' },
      { name: 'Hot Beverages & Tea', description: 'Doodh patti, green tea and espresso' },
      { name: 'Cold Drinks, Shakes & Juices', description: 'Sodas, mocktails and ice cream shakes' },
      { name: 'Desserts & Sweets', description: 'Lava cake, brownies, kheer and ice cream' }
    ],
    units: [
      { name: 'Serving', short_code: 'srv' },
      { name: 'Plate', short_code: 'plt' },
      { name: 'Piece', short_code: 'pcs' },
      { name: 'Glass', short_code: 'gls' },
      { name: 'Portion', short_code: 'prt' }
    ],
    expenseCategories: [
      { name: 'Premises Rent', description: 'Dine-in and kitchen location rent' },
      { name: 'Kitchen Gas & Commercial LPG', description: 'Sui gas and commercial cylinders' },
      { name: 'Kitchen Electricity & AC', description: 'Dining hall AC and refrigeration' },
      { name: 'Chef & Waiter Salaries', description: 'Cooks, tandoorchi and service staff' },
      { name: 'Fresh Ingredients & Poultry', description: 'Daily chicken, meat, vegetable procurement' },
      { name: 'Takeaway Boxes & Disposable Cutlery', description: 'Boxes, butter paper and delivery bags' },
      { name: 'Miscellaneous', description: 'Cleaning supplies and hospitality' }
    ]
  },

  hardware: {
    id: 'hardware',
    name: 'Hardware, Sanitary & Building Materials',
    icon: '🔧',
    shortName: 'Hardware Store',
    subtitle: 'Building Materials & Tool Inventory',
    hasBatches: false,
    hasExpiry: false,
    hasVariants: false,
    categories: [
      { name: 'Cement & Masonry Supplies', description: 'OPC, SRC cement bags, white cement and plaster' },
      { name: 'Steel, Rebars & Binding Wire', description: 'Grade 60 steel bars, G.I. wire and mesh' },
      { name: 'Paints, Enamels & Primers', description: 'Wall paints, distemper, rollers and brushes' },
      { name: 'Plumbing & PVC Pipes', description: 'UPVC, PPRC pipes, elbows, valves and taps' },
      { name: 'Electrical & Wiring', description: 'Copper cables, switches, breakers and LED lights' },
      { name: 'Power Tools & Hand Tools', description: 'Drills, grinders, hammers, wrenches and screws' },
      { name: 'Locks, Handles & Fasteners', description: 'Door locks, hinges, bolts and anchors' }
    ],
    units: [
      { name: 'Bag', short_code: 'bag' },
      { name: 'Piece', short_code: 'pcs' },
      { name: 'Kilogram', short_code: 'kg' },
      { name: 'Meter', short_code: 'mtr' },
      { name: 'Bundle', short_code: 'bdl' },
      { name: 'Liter', short_code: 'ltr' }
    ],
    expenseCategories: [
      { name: 'Shop & Warehouse Rent', description: 'Store and storage yard rental' },
      { name: 'Transport & Truck Freight', description: 'Truck deliveries and heavy logistics' },
      { name: 'Loading & Mazdoori Labor', description: 'Heavy material loading and unloading' },
      { name: 'Staff Salaries', description: 'Sales staff and storekeeper wages' },
      { name: 'Electricity Bills', description: 'Lighting and heavy machinery charging' },
      { name: 'Delivery Van Fuel', description: 'Local customer drop-off transport' },
      { name: 'Miscellaneous', description: 'Incidental store maintenance' }
    ]
  },

  wholesale: {
    id: 'wholesale',
    name: 'Wholesale & Distribution Agency',
    icon: '📦',
    shortName: 'Wholesale Distributor',
    subtitle: 'Bulk Distribution & Credit Ledgers',
    hasBatches: true,
    hasExpiry: true,
    hasVariants: false,
    categories: [
      { name: 'Bulk Cartons & Cases', description: 'Master packaging cases for retail resale' },
      { name: 'Fast Moving Consumer Goods (FMCG)', description: 'High turnover branded wholesale stock' },
      { name: 'Bulk Cooking Oil & Ghee', description: '16L tins and carton boxes' },
      { name: 'Grains, Flour & Sugar Bags', description: '50kg jute and polypropylene sacks' },
      { name: 'Tea & Beverage Cases', description: 'Wholesale distribution beverage packs' }
    ],
    units: [
      { name: 'Carton', short_code: 'ctn' },
      { name: 'Bag', short_code: 'bag' },
      { name: 'Case', short_code: 'case' },
      { name: 'Drum', short_code: 'drum' },
      { name: 'Kilogram', short_code: 'kg' }
    ],
    expenseCategories: [
      { name: 'Godown / Warehouse Rent', description: 'Main logistics warehouse premises' },
      { name: 'Logistics & Inter-city Freight', description: 'Heavy trailer and truck delivery freight' },
      { name: 'Warehouse Labor & Forklift', description: 'Pallet moving and stacking workers' },
      { name: 'Field Salesmen Commission', description: 'Order bookers and sales incentives' },
      { name: 'Staff & Management Payroll', description: 'Accountants and dispatch managers' },
      { name: 'Packaging & Strapping Material', description: 'Stretch wrap, pallets and tape' },
      { name: 'Miscellaneous', description: 'Incidental distribution expenses' }
    ]
  },

  custom: {
    id: 'custom',
    name: 'General Business / Custom Shop',
    icon: '⚙️',
    shortName: 'Custom Business',
    subtitle: 'Universal Business Management',
    hasBatches: false,
    hasExpiry: false,
    hasVariants: false,
    categories: [
      { name: 'General Products', description: 'Primary business products' },
      { name: 'Specialty Items', description: 'Secondary product lines' },
      { name: 'Services & Labor', description: 'Service charges and fees' }
    ],
    units: [
      { name: 'Piece', short_code: 'pcs' },
      { name: 'Box', short_code: 'box' },
      { name: 'Kilogram', short_code: 'kg' },
      { name: 'Unit', short_code: 'unit' }
    ],
    expenseCategories: [
      { name: 'Shop / Office Rent', description: 'Premises rent' },
      { name: 'Electricity & Utilities', description: 'Bills and connections' },
      { name: 'Staff Salaries', description: 'Payroll and wages' },
      { name: 'Transport & Freight', description: 'Shipping and logistics' },
      { name: 'Office Supplies & Hospitality', description: 'Tea and office maintenance' },
      { name: 'Miscellaneous', description: 'Incidental costs' }
    ]
  }
};

module.exports = {
  BUSINESS_TYPES
};
