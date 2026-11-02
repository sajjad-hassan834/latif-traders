const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const app = require('../index');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret-key-for-unit-tests-at-least-32-chars' : 'shopos-dev-jwt-secret-not-for-production-min-32-chars');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function setupTenant(driver, tenantId, businessName, username, password) {
  const hash = await bcrypt.hash(password, 10);

  // Clean prior data if any
  try {
    await db.run('DELETE FROM sale_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM sales WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM return_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM returns WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM purchase_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM purchases WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM payments WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM expenses WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM inventory_movements WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM stock_adjustments WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM batches WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM products WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM customers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM suppliers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM expense_categories WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM counters WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  } catch (_) {}

  await db.run(`
    INSERT INTO tenants (id, business_name, owner_name, plan, is_active)
    VALUES (?, ?, 'Owner', 'enterprise', 1)
  `, [tenantId, businessName]);

  const userRes = await db.run(`
    INSERT INTO users (username, password_hash, full_name, role, status, tenant_id)
    VALUES (?, ?, 'Admin User', 'admin', 'active', ?)
  `, [username, hash, tenantId]);

  const userId = userRes.lastInsertRowid || 1;
  const token = jwt.sign({ id: userId, username, role: 'admin', tenant_id: tenantId, token_version: 1 }, JWT_SECRET, { expiresIn: '2h' });

  return { tenantId, userId, username, password, token };
}

async function runTestOnDriver(driverName) {
  console.log(`\n================================================================================`);
  console.log(`  STARTING COMPLETE HTTP PARITY & ISOLATION SUITE ON [${driverName.toUpperCase()}]`);
  console.log(`================================================================================\n`);

  db.setDriver(driverName);

  if (driverName === 'postgres') {
    const ver = await db.get('SELECT version()');
    const connStr = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
    const portMatch = connStr.match(/:(\d+)\//);
    const port = portMatch ? portMatch[1] : '5434';
    console.log(`[POSTGRES CONNECTION VERIFIED] Port: ${port}`);
    console.log(`[POSTGRES VERSION] ${ver.version}\n`);

    // Ensure pg_schema is fresh
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'pg_schema.sql'), 'utf-8');
    await db.query(schemaSql);
  }

  const prefix = `http_${driverName}_${Date.now().toString().slice(-4)}`;
  const tenantAId = `tenant_a_${prefix}`;
  const tenantBId = `tenant_b_${prefix}`;

  console.log(`[STEP 1] Setting up Tenant A (${tenantAId}) and Tenant B (${tenantBId})...`);
  const tenantA = await setupTenant(driverName, tenantAId, 'Tenant Alpha Supermarket', `admin_a_${prefix}`, 'Pass123!A');
  const tenantB = await setupTenant(driverName, tenantBId, 'Tenant Beta Traders', `admin_b_${prefix}`, 'Pass123!B');

  // 1. Auth Login & Me
  console.log(`\n[STEP 2] Testing Auth Login & Profile (POST /api/auth/login, GET /api/auth/me)...`);
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: tenantA.username, password: tenantA.password });
  assert(loginRes.status === 200, `Login status 200 for Tenant A`);
  assert(loginRes.body.token, `Login returned valid JWT token`);

  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tenantA.token}`);
  assert(meRes.status === 200, `GET /api/auth/me status 200`);
  assert(meRes.body.user.tenant_id === tenantAId, `User profile belongs to Tenant A`);

  // 2. Settings Parity & Isolation
  console.log(`\n[STEP 3] Testing Settings Endpoints (POST /api/settings, GET /api/settings)...`);
  const setRes = await request(app)
    .post('/api/settings')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({ business_name: 'Alpha Mega Mart', phone: '03009998888', tax_percentage: 5 });
  assert(setRes.status === 200, `Tenant A updated settings`);

  const getSetA = await request(app)
    .get('/api/settings')
    .set('Authorization', `Bearer ${tenantA.token}`);
  assert(getSetA.body.settings.business_name === 'Alpha Mega Mart', `Tenant A retrieved updated business name`);

  const getSetB = await request(app)
    .get('/api/settings')
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(getSetB.body.settings.business_name !== 'Alpha Mega Mart', `Tenant B settings isolated from Tenant A`);

  // 3. Product CRUD & Stock Adjustment
  console.log(`\n[STEP 4] Testing Product CRUD & Stock Adjustments (POST /api/products, POST /api/products/adjust)...`);
  const p1Res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      name: 'Frozen Chicken Nuggets 1kg',
      sku: `SKU-A-NUG-${prefix}`,
      barcode: `BAR-A-1-${prefix}`,
      purchase_price: 500,
      sale_price: 750,
      wholesale_price: 700,
      min_stock_level: 10,
      unit: 'PACK'
    });
  assert(p1Res.status === 201, `Tenant A created Product 1`);
  const prod1Id = p1Res.body.id || p1Res.body.product?.id;

  const p2Res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      name: 'Frozen Seekh Kabab 1kg',
      sku: `SKU-A-SKB-${prefix}`,
      barcode: `BAR-A-2-${prefix}`,
      purchase_price: 600,
      sale_price: 900,
      wholesale_price: 850,
      min_stock_level: 5,
      unit: 'PACK'
    });
  assert(p2Res.status === 201, `Tenant A created Product 2`);
  const prod2Id = p2Res.body.id || p2Res.body.product?.id;

  // Tenant B creates a product
  const pBRes = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${tenantB.token}`)
    .send({
      name: 'Beta Frozen Patties 500g',
      sku: `SKU-B-PAT-${prefix}`,
      purchase_price: 300,
      sale_price: 450,
      unit: 'PACK'
    });
  assert(pBRes.status === 201, `Tenant B created Beta Product`);
  const prodBId = pBRes.body.id || pBRes.body.product?.id;

  // 4. Purchase with Batch Lot & Purchase Return
  console.log(`\n[STEP 5] Testing Purchase with Batches & Purchase Return (POST /api/purchases, POST /api/purchases/returns)...`);
  const suppRes = await request(app)
    .post('/api/parties/suppliers')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({ name: 'Alpha Poultry Wholesalers', phone: '03112223334', opening_balance: 0 });
  assert(suppRes.status === 201, `Tenant A created supplier`);
  const suppId = suppRes.body.id || suppRes.body.supplier?.id;

  const purchRes = await request(app)
    .post('/api/purchases')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      supplier_id: suppId,
      invoice_no: `PUR-${prefix}-001`,
      purchase_date: '2026-10-25',
      payment_type: 'CREDIT',
      paid_amount: 0,
      items: [
        {
          product_id: prod1Id,
          quantity: 50,
          purchase_price: 500,
          sale_price: 750,
          batch_no: `BATCH-NUG-${prefix}`,
          expiry_date: '2027-10-25'
        },
        {
          product_id: prod2Id,
          quantity: 30,
          purchase_price: 600,
          sale_price: 900,
          batch_no: `BATCH-SKB-${prefix}`,
          expiry_date: '2027-10-25'
        }
      ]
    });
  if (purchRes.status !== 201) {
    console.error('Purchase failed with status:', purchRes.status, purchRes.body);
  }
  assert(purchRes.status === 201, `Tenant A recorded purchase of 50 nuggets and 30 kababs`);
  const purchaseId = purchRes.body.id || purchRes.body.data?.id;

  // Stock Adjustment (+5 units)
  const adjRes = await request(app)
    .post('/api/products/adjust')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      product_id: prod1Id,
      type: 'AUDIT_ADD',
      quantity: 5,
      reason: 'Physical inventory count found 5 bonus units'
    });
  if (adjRes.status !== 200) {
    console.error('Adjustment failed with status:', adjRes.status, adjRes.body);
  }
  assert(adjRes.status === 200, `Stock adjustment (+5 units) executed successfully`);

  // Purchase Return (Return 5 kababs back to supplier)
  const pretRes = await request(app)
    .post('/api/purchases/returns')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      original_purchase_id: purchaseId,
      reason: 'Damaged packaging from supplier shipment',
      items: [
        { product_id: prod2Id, quantity: 5, unit_price: 600 }
      ]
    });
  if (pretRes.status !== 201) {
    console.error('Purchase return failed with status:', pretRes.status, pretRes.body);
  }
  assert(pretRes.status === 201, `Purchase return of 5 kababs executed`);

  // Supplier Payment
  const spayRes = await request(app)
    .post('/api/payments/supplier-payment')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      supplier_id: suppId,
      amount: 10000,
      payment_method: 'Bank Transfer',
      notes: 'Partial advance against purchase order'
    });
  assert(spayRes.status === 201, `Supplier payment of ₨ 10,000 recorded`);

  // 5. Credit Sale & Production Invoice Number Format Verification
  console.log(`\n[STEP 6] Testing Credit Sale & Invoice Number Format (INV-YYYYMMDD-NNNN)...`);
  const custRes = await request(app)
    .post('/api/parties/customers')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({ name: 'Alpha Retailer Supermarket', phone: '03223334445', opening_balance: 0 });
  assert(custRes.status === 201, `Tenant A created customer`);
  const custId = custRes.body.id || custRes.body.customer?.id;

  const creditSaleRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      customer_id: custId,
      sale_date: '2026-10-25',
      payment_type: 'credit',
      paid_amount: 0,
      items: [
        { product_id: prod1Id, quantity: 10, unit_price: 750 }
      ]
    });
  assert(creditSaleRes.status === 201, `Credit sale recorded (10 nuggets @ 750 = ₨ 7,500)`);
  const creditInvoiceNo = creditSaleRes.body.sale?.invoice_no || creditSaleRes.body.data?.invoice_no;
  console.log(`    Generated Credit Invoice Number: ${creditInvoiceNo}`);
  assert(/^INV-\d{8}-\d{4}$/.test(creditInvoiceNo), `Invoice format strictly equals INV-YYYYMMDD-NNNN (e.g. INV-20261025-0001)`);

  // 6. Partial Sale
  console.log(`\n[STEP 7] Testing Partial Sale (Paid: ₨ 3,000 / Total: ₨ 7,500)...`);
  const partialSaleRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      customer_id: custId,
      sale_date: '2026-10-25',
      payment_type: 'partial',
      paid_amount: 3000,
      payment_method: 'Cash',
      items: [
        { product_id: prod1Id, quantity: 10, unit_price: 750 }
      ]
    });
  assert(partialSaleRes.status === 201, `Partial sale recorded`);
  const partialInvoiceNo = partialSaleRes.body.sale?.invoice_no || partialSaleRes.body.data?.invoice_no;
  const partialSaleId = partialSaleRes.body.sale?.id || partialSaleRes.body.data?.id;
  console.log(`    Generated Partial Invoice Number: ${partialInvoiceNo}`);
  assert(/^INV-\d{8}-\d{4}$/.test(partialInvoiceNo), `Partial sale invoice matches INV-YYYYMMDD-NNNN`);

  // 7. Customer Receipt
  console.log(`\n[STEP 8] Testing Customer Receipt (POST /api/payments/customer-receipt)...`);
  const receiptRes = await request(app)
    .post('/api/payments/customer-receipt')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      customer_id: custId,
      amount: 4500,
      payment_method: 'Cash',
      notes: 'Settlement against credit invoice'
    });
  assert(receiptRes.status === 201, `Customer receipt of ₨ 4,500 recorded`);

  // 8. Sale Return
  console.log(`\n[STEP 9] Testing Sale Return (POST /api/sales/returns)...`);
  const sretRes = await request(app)
    .post('/api/sales/returns')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      original_sale_id: partialSaleId,
      reason: 'Customer ordered wrong nugget size',
      items: [
        { product_id: prod1Id, quantity: 2, unit_price: 750, condition: 'RESELLABLE' }
      ]
    });
  assert(sretRes.status === 201, `Sale return of 2 nuggets processed (restoring stock)`);

  // 9. Void / Delete Sale
  console.log(`\n[STEP 10] Testing Sale Deletion / Void Reversal (DELETE /api/sales/:id)...`);
  // Record small cash sale to void
  const voidSaleRes = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      payment_type: 'cash',
      paid_amount: 750,
      items: [{ product_id: prod1Id, quantity: 1, unit_price: 750 }]
    });
  assert(voidSaleRes.status === 201, `Temporary sale created to test voiding`);
  const voidSaleId = voidSaleRes.body.sale?.id || voidSaleRes.body.data?.id;

  const deleteSaleRes = await request(app)
    .delete(`/api/sales/${voidSaleId}`)
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({ reason: 'Accidental double entry by cashier' });
  assert(deleteSaleRes.status === 200, `Sale void / reversal executed successfully via DELETE /api/sales/:id`);

  // 10. Expenses
  console.log(`\n[STEP 11] Testing Expense Creation (POST /api/expenses)...`);
  const expRes = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tenantA.token}`)
    .send({
      title: 'Cold Storage Electricity',
      amount: 15000,
      payment_method: 'Cash',
      expense_date: '2026-10-25',
      description: 'Monthly chiller unit bill'
    });
  assert(expRes.status === 201, `Expense of ₨ 15,000 recorded`);

  // 11. Reports & Notifications (Expiry and Low Stock)
  console.log(`\n[STEP 12] Testing Notifications & Alerts (GET /api/reports/expiry, GET /api/reports/stock)...`);
  const expiryRes = await request(app)
    .get('/api/reports/expiry?days=400')
    .set('Authorization', `Bearer ${tenantA.token}`);
  if (expiryRes.status !== 200) {
    console.error('Expiry report failed with status:', expiryRes.status, expiryRes.body);
  }
  assert(expiryRes.status === 200, `GET /api/reports/expiry status 200`);

  const stockReportRes = await request(app)
    .get('/api/reports/stock')
    .set('Authorization', `Bearer ${tenantA.token}`);
  assert(stockReportRes.status === 200, `GET /api/reports/stock status 200`);

  // 12. Backup Creation and Download Isolation
  console.log(`\n[STEP 13] Testing Backup Creation & Download (POST /api/backups/create, GET /api/backups)...`);
  const bCreateRes = await request(app)
    .post('/api/backups/create')
    .set('Authorization', `Bearer ${tenantA.token}`);
  assert(bCreateRes.status === 200, `Tenant A created backup snapshot`);
  const alphaBackupFile = bCreateRes.body.backup?.filename;
  assert(alphaBackupFile, `Backup filename generated: ${alphaBackupFile}`);

  // Download Alpha backup by Alpha
  const bDownloadAlpha = await request(app)
    .get(`/api/backups/download/${alphaBackupFile}`)
    .set('Authorization', `Bearer ${tenantA.token}`);
  assert(bDownloadAlpha.status === 200, `Tenant A downloaded own backup`);

  // 13. Deep HTTP Tenant Isolation Assertions
  console.log(`\n[STEP 14] Testing Deep HTTP Tenant Isolation (Tenant B accessing Tenant A)...`);

  // A. Tenant B attempts to read Tenant A's Product by ID
  const bReadProd = await request(app)
    .get(`/api/products/${prod1Id}`)
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bReadProd.status === 404, `Tenant B reading Tenant A product by ID blocked: HTTP 404`);

  // B. Tenant B attempts to update Tenant A's Product
  const bUpdateProd = await request(app)
    .put(`/api/products/${prod1Id}`)
    .set('Authorization', `Bearer ${tenantB.token}`)
    .send({ name: 'Hacked Nugget Name' });
  assert(bUpdateProd.status === 404, `Tenant B updating Tenant A product blocked: HTTP 404`);

  // C. Tenant B attempts to delete Tenant A's Product
  const bDeleteProd = await request(app)
    .delete(`/api/products/${prod1Id}`)
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bDeleteProd.status === 404, `Tenant B deleting Tenant A product blocked: HTTP 404`);

  // D. Tenant B attempts to read Tenant A's Sale Invoice by ID
  const bReadSale = await request(app)
    .get(`/api/sales/${partialSaleId}`)
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bReadSale.status === 404, `Tenant B reading Tenant A sale invoice blocked: HTTP 404`);

  // E. Tenant B attempts to read Tenant A's Purchase by ID
  const bReadPurchase = await request(app)
    .get(`/api/purchases/${purchaseId}`)
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bReadPurchase.status === 404, `Tenant B reading Tenant A purchase blocked: HTTP 404`);

  // F. Tenant B product search cannot leak Tenant A products
  const bSearch = await request(app)
    .get(`/api/products?search=Nuggets`)
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bSearch.status === 200, `Tenant B search status 200`);
  const leakedProducts = (bSearch.body.products || []).filter(p => p.id === prod1Id);
  assert(leakedProducts.length === 0, `Tenant B product search returned 0 items from Tenant A`);

  // G. Tenant B notifications cannot leak Tenant A inventory alerts
  const bExpiryAlerts = await request(app)
    .get('/api/reports/expiry?days=400')
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bExpiryAlerts.status === 200, `Tenant B expiry alerts status 200`);
  const leakedAlerts = (bExpiryAlerts.body.batches || []).filter(b => b.product_id === prod1Id);
  assert(leakedAlerts.length === 0, `Tenant B notifications tray returned 0 items from Tenant A`);

  // H. Tenant B attempts to download Tenant A's Backup File
  const bCrossDownload = await request(app)
    .get(`/api/backups/download/${alphaBackupFile}`)
    .set('Authorization', `Bearer ${tenantB.token}`);
  assert(bCrossDownload.status === 404, `Tenant B downloading Tenant A backup file blocked: HTTP 404`);

  // 14. Maintenance Mode HTTP Enforcement
  console.log(`\n[STEP 15] Testing MAINTENANCE_MODE HTTP Circuit Breaker...`);
  process.env.MAINTENANCE_MODE = 'true';
  try {
    const healthDuringMaint = await request(app).get('/api/health');
    assert(healthDuringMaint.status === 200, `GET /api/health remains accessible during maintenance`);
    assert(typeof healthDuringMaint.body.latency_ms === 'number', `Health endpoint reports query latency (${healthDuringMaint.body.latency_ms.toFixed(2)}ms)`);

    const tenantCallDuringMaint = await request(app)
      .get('/api/sales')
      .set('Authorization', `Bearer ${tenantA.token}`);
    assert(tenantCallDuringMaint.status === 503, `Tenant API blocked with HTTP 503 during maintenance`);
    assert(tenantCallDuringMaint.body.maintenance === true, `Response body contains maintenance flag`);
  } finally {
    process.env.MAINTENANCE_MODE = 'false';
  }

  console.log(`\n================================================================================`);
  console.log(`  ALL HTTP PARITY & ISOLATION CHECKS PASSED ON [${driverName.toUpperCase()}]`);
  console.log(`================================================================================\n`);
}

async function main() {
  try {
    await runTestOnDriver('sqlite');
    await runTestOnDriver('postgres');
    console.log(`\n🎉 STAGE A4 HTTP PARITY & ISOLATION: 100% SUCCESSFUL ON BOTH ENGINES!\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ STAGE A4 HTTP TEST FAILED:', err);
    process.exit(1);
  }
}

main();
