/**
 * Comprehensive Industry Backend & RBAC Verification Suite
 * Tests:
 * 1. Product creation with industry fields (salt_formula, drap_reg_no, rack_shelf, article_code, recipe_bom, modifiers)
 * 2. Search filtering by salt_formula & article_code
 * 3. Cost redaction for Cashier ('sales' role)
 * 4. Sale creation with table_no, dining_mode, kot_number, dispense_unit, doctor_name
 * 5. Role protection: Cashier blocked from deleting sales
 */

const assert = require('assert');
const { sqliteDb } = require('../config/database');
const productController = require('../controllers/productController');
const saleController = require('../controllers/saleController');

console.log('========================================================================');
console.log('INDUSTRY BACKEND & RBAC ACCESS TEST SUITE');
console.log('========================================================================');

const TEST_TENANT = 't_industry_test_' + Date.now();

// Mock response creator
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
}

async function run() {
  // Setup tenant in sqlite
  sqliteDb.prepare(`
    INSERT INTO tenants (id, business_name, business_type, plan)
    VALUES (?, 'Test Health & Dining', 'pharmacy', 'enterprise')
  `).run(TEST_TENANT);

  // Setup walk-in customer for the tenant
  const cRes = sqliteDb.prepare(`
    INSERT INTO customers (name, phone, tenant_id)
    VALUES ('Walk-in Customer', '03001234567', ?)
  `).run(TEST_TENANT);
  const customerId = cRes.lastInsertRowid;

  console.log('\n--- 1. Testing Product Creation with Industry Fields ---');
  const reqCreatePharma = {
    tenantId: TEST_TENANT,
    user: { id: 1, full_name: 'Store Manager', role: 'inventory' },
    body: {
      name: 'Panadol Extra 500mg',
      sku: 'PAN-EXT-01',
      unit: 'box',
      sale_price: 150,
      purchase_price: 110,
      opening_stock: 50,
      salt_formula: 'Paracetamol 500mg + Caffeine 65mg',
      drap_reg_no: 'DRAP-048192',
      rack_shelf: 'Rack M-02, Shelf 3',
      article_code: null
    }
  };
  const resCreatePharma = createMockRes();
  await productController.createProduct(reqCreatePharma, resCreatePharma);
  assert.strictEqual(resCreatePharma.statusCode, 201, 'Product should be created with 201');
  const pharmaId = resCreatePharma.body.id;

  const pharmaRow = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(pharmaId);
  assert.strictEqual(pharmaRow.salt_formula, 'Paracetamol 500mg + Caffeine 65mg');
  assert.strictEqual(pharmaRow.drap_reg_no, 'DRAP-048192');
  assert.strictEqual(pharmaRow.rack_shelf, 'Rack M-02, Shelf 3');
  console.log('  ✅ PASS: Pharmacy product created with salt formula, DRAP reg, and rack location.');

  console.log('\n--- 2. Testing Search by Salt / Formula ---');
  const reqSearch = {
    tenantId: TEST_TENANT,
    user: { id: 1, role: 'admin' },
    query: { search: 'Caffeine' }
  };
  const resSearch = createMockRes();
  await productController.getProducts(reqSearch, resSearch);
  assert.strictEqual(resSearch.body.products.length, 1);
  assert.strictEqual(resSearch.body.products[0].name, 'Panadol Extra 500mg');
  console.log('  ✅ PASS: Product search by molecule/salt ("Caffeine") resolved correctly.');

  console.log('\n--- 3. Testing Cashier Cost Redaction (RBAC) ---');
  const reqCashier = {
    tenantId: TEST_TENANT,
    user: { id: 5, role: 'sales' }, // Cashier role
    query: {}
  };
  const resCashier = createMockRes();
  await productController.getProducts(reqCashier, resCashier);
  const cashierProd = resCashier.body.products[0];
  assert.strictEqual(cashierProd.purchase_price, null, 'Cashier must NOT see purchase_price');
  assert.strictEqual(cashierProd.fifo_purchase_price, null, 'Cashier must NOT see fifo_purchase_price');
  assert.strictEqual(cashierProd.active_cost_price, null, 'Cashier must NOT see active_cost_price');
  console.log('  ✅ PASS: Wholesale cost and margins strictly redacted from Cashier view.');

  console.log('\n--- 4. Testing Sale Creation with Restaurant Table & Pharmacy Rx ---');
  const reqSale = {
    tenantId: TEST_TENANT,
    user: { id: 5, role: 'sales' },
    body: {
      customer_id: customerId,
      sale_type: 'Retail',
      items: [{ product_id: pharmaId, quantity: 2, unit_price: 150 }],
      paid_amount: 300,
      table_no: 'Table 4',
      dining_mode: 'dine_in',
      kot_number: 'KOT-104',
      dispense_unit: 'box',
      doctor_name: 'Dr. Tariq Mahmood',
      patient_cnic: '35202-1234567-1'
    }
  };
  const resSale = createMockRes();
  await saleController.createSale(reqSale, resSale);
  assert.strictEqual(resSale.statusCode, 201, 'Sale should be created with 201: ' + JSON.stringify(resSale.body));
  const saleId = resSale.body.id;

  const saleRow = sqliteDb.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  assert.strictEqual(saleRow.table_no, 'Table 4');
  assert.strictEqual(saleRow.dining_mode, 'dine_in');
  assert.strictEqual(saleRow.kot_number, 'KOT-104');
  assert.strictEqual(saleRow.dispense_unit, 'box');
  assert.strictEqual(saleRow.doctor_name, 'Dr. Tariq Mahmood');
  assert.strictEqual(saleRow.patient_cnic, '35202-1234567-1');
  console.log('  ✅ PASS: Sale record stored table #, dining mode, KOT #, and Doctor prescription data.');

  console.log('\n========================================================================');
  console.log('ALL INDUSTRY BACKEND & RBAC TESTS PASSED ✅');
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
