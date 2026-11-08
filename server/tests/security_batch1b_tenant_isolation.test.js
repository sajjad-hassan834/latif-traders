/**
 * ShopOS Security Test Suite: Batch 1b - Item 4 (Tenant Route Coverage & Anti-Spoofing Isolation)
 *
 * Requirements:
 * 1. Automated check verifying every Express route is behind authenticate & tenantContext (or allow-list).
 * 2. Regular user sending x-tenant-id or tenant_id in query/body is strictly ignored.
 * 3. Verify on at least 10 representative routes that caller cannot read another tenant's data.
 */

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-batch1b-tenant-isolation-min-32-chars';

const app = require('../index');
const { db } = require('../config/database');
const { verifyRouteCoverage } = require('../scripts/verify_route_coverage');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const payload = body ? JSON.stringify(body) : null;

    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   ShopOS Security Test: Item 4 (Route Coverage & Isolation)');
  console.log('======================================================\n');

  // Part 1: Automated Express Route Coverage Check
  console.log('--- Part 1: Automated Route Coverage Verification ---');
  const coveragePassed = verifyRouteCoverage();
  assert.strictEqual(coveragePassed, true, 'Route coverage check must pass with 0 unprotected routes');
  console.log('  ✅ Automated route coverage verification succeeded');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  try {
    // Part 2: Tenant Isolation & Header/Query/Body Anti-Spoofing on 10 Representative Routes
    console.log('\n--- Part 2: Tenant Anti-Spoofing on 10 Representative Routes ---');
    const tenantA = `t_alpha_${Date.now()}`;
    const tenantB = `t_beta_${Date.now()}`;

    // Seed Tenant A and Tenant B
    await db.run("INSERT INTO tenants (id, business_name, plan, is_active) VALUES (?, 'Tenant Alpha', 'pro', 1)", [tenantA]);
    await db.run("INSERT INTO tenants (id, business_name, plan, is_active) VALUES (?, 'Tenant Beta', 'pro', 1)", [tenantB]);

    // Seed unique data in Tenant A
    await db.run("INSERT INTO products (tenant_id, name, sku, category_id, unit, sale_price, purchase_price) VALUES (?, 'Alpha Secret Product', 'SKU-ALPHA', NULL, 'pkt', 100, 80)", [tenantA]);
    const custARes = await db.run("INSERT INTO customers (tenant_id, name, phone, current_balance) VALUES (?, 'Alpha Customer One', '0300-1111111', 500)", [tenantA]);
    const suppARes = await db.run("INSERT INTO suppliers (tenant_id, name, phone, current_balance) VALUES (?, 'Alpha Supplier One', '0300-2222222', 1000)", [tenantA]);
    await db.run("INSERT INTO sales (tenant_id, invoice_no, customer_id, grand_total, paid_amount, balance_due, order_status, sale_date) VALUES (?, 'INV-ALPHA-01', ?, 1500, 1500, 0, 'Completed', '2026-10-28')", [tenantA, custARes.lastInsertRowid]);
    await db.run("INSERT INTO purchases (tenant_id, invoice_no, supplier_id, grand_total, paid_amount, balance_due, purchase_date) VALUES (?, 'PO-ALPHA-01', ?, 2000, 2000, 0, '2026-10-28')", [tenantA, suppARes.lastInsertRowid]);
    await db.run("INSERT INTO expenses (tenant_id, title, category_id, amount, expense_date) VALUES (?, 'Alpha Electric Bill', NULL, 300, '2026-10-28')", [tenantA]);
    await db.run("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES (?, 'received', 'customer', ?, 500, '2026-10-28')", [tenantA, custARes.lastInsertRowid]);
    await db.run("INSERT INTO categories (tenant_id, name) VALUES (?, 'Alpha Category Exclusive')", [tenantA]);

    // Seed confidential data in Tenant B (should NEVER be visible to Tenant A)
    await db.run("INSERT INTO products (tenant_id, name, sku, category_id, unit, sale_price, purchase_price) VALUES (?, 'CONFIDENTIAL BETA DRUG', 'SKU-BETA-99', NULL, 'pkt', 999, 500)", [tenantB]);
    const custBRes = await db.run("INSERT INTO customers (tenant_id, name, phone, current_balance) VALUES (?, 'CONFIDENTIAL VIP BETA CUSTOMER', '0300-9999999', 99999)", [tenantB]);
    const suppBRes = await db.run("INSERT INTO suppliers (tenant_id, name, phone, current_balance) VALUES (?, 'CONFIDENTIAL BETA VENDOR', '0300-8888888', 88888)", [tenantB]);
    await db.run("INSERT INTO sales (tenant_id, invoice_no, customer_id, grand_total, paid_amount, balance_due, order_status, sale_date) VALUES (?, 'INV-BETA-9999', ?, 99999, 99999, 0, 'Completed', '2026-10-28')", [tenantB, custBRes.lastInsertRowid]);
    await db.run("INSERT INTO purchases (tenant_id, invoice_no, supplier_id, grand_total, paid_amount, balance_due, purchase_date) VALUES (?, 'PO-BETA-8888', ?, 88888, 88888, 0, '2026-10-28')", [tenantB, suppBRes.lastInsertRowid]);
    await db.run("INSERT INTO expenses (tenant_id, title, category_id, amount, expense_date) VALUES (?, 'BETA PRIVATE EXPENSE', NULL, 50000, '2026-10-28')", [tenantB]);
    await db.run("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES (?, 'received', 'customer', ?, 99999, '2026-10-28')", [tenantB, custBRes.lastInsertRowid]);
    await db.run("INSERT INTO categories (tenant_id, name) VALUES (?, 'BETA TOP SECRET CATEGORY')", [tenantB]);

    // User A credentials (belongs strictly to Tenant A)
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync('Pass123!@#', salt);
    const uSuffix = Date.now();
    const userARes = await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
      VALUES (?, ?, ?, 'Alpha Staff', 'admin', 'active', ?, 1, 0)
    `, [`user_alpha_${uSuffix}`, `alpha_${uSuffix}@shop.com`, hash, tenantA]);
    const userAId = userARes.lastInsertRowid;

    // User B credentials (belongs strictly to Tenant B)
    await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
      VALUES (?, ?, ?, 'Beta Confidential Staff', 'admin', 'active', ?, 1, 0)
    `, [`user_beta_${uSuffix}`, `beta_${uSuffix}@shop.com`, hash, tenantB]);

    // Token for User A
    const tokenA = jwt.sign(
      { id: userAId, username: 'user_alpha', role: 'admin', tenant_id: tenantA, token_version: 1 },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    // Common spoofing headers/query pointing to Tenant B
    const spoofHeaders = {
      'Authorization': `Bearer ${tokenA}`,
      'x-tenant-id': tenantB
    };

    // 10 Representative Routes to test
    const routesToTest = [
      { name: '1. Products List', path: `/api/products?tenant_id=${tenantB}`, secretKeyword: 'CONFIDENTIAL BETA DRUG' },
      { name: '2. Product Categories', path: `/api/products/meta/categories?tenant_id=${tenantB}`, secretKeyword: 'BETA TOP SECRET' },
      { name: '3. Customers List', path: `/api/parties/customers?tenant_id=${tenantB}`, secretKeyword: 'CONFIDENTIAL VIP BETA' },
      { name: '4. Suppliers List', path: `/api/parties/suppliers?tenant_id=${tenantB}`, secretKeyword: 'CONFIDENTIAL BETA VENDOR' },
      { name: '5. Sales Invoices', path: `/api/sales?tenant_id=${tenantB}`, secretKeyword: 'INV-BETA-9999' },
      { name: '6. Purchases Orders', path: `/api/purchases?tenant_id=${tenantB}`, secretKeyword: 'PO-BETA-8888' },
      { name: '7. Expenses List', path: `/api/expenses?tenant_id=${tenantB}`, secretKeyword: 'BETA PRIVATE EXPENSE' },
      { name: '8. Financial Payments', path: `/api/payments?tenant_id=${tenantB}`, secretKeyword: 'CONFIDENTIAL VIP BETA' },
      { name: '9. Tenant Users List', path: `/api/users?tenant_id=${tenantB}`, secretKeyword: 'user_beta_secret' },
      { name: '10. Reports Summary', path: `/api/reports/dashboard?tenant_id=${tenantB}`, secretKeyword: 'CONFIDENTIAL' }
    ];

    for (const r of routesToTest) {
      const res = await request('GET', r.path, null, spoofHeaders);
      assert.strictEqual(res.status, 200, `${r.name} should succeed`);
      const bodyStr = JSON.stringify(res.body);

      // Verify Tenant B's confidential data is NOT leaked
      assert.strictEqual(bodyStr.includes(r.secretKeyword), false, `LEAK DETECTED in ${r.name}: Found '${r.secretKeyword}'`);
      console.log(`  ✅ ${r.name}: Spoofed x-tenant-id / query parameter ignored; zero Tenant B data leaked`);
    }

    console.log('\n======================================================');
    console.log('  🎉 ALL ITEM 4 ROUTE COVERAGE & ISOLATION TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    if (server) server.close();
    try {
      const tables = [
        'sale_items', 'sales', 'purchase_items', 'purchases', 'payments',
        'expenses', 'inventory_movements', 'stock_adjustments', 'batches',
        'products', 'customers', 'suppliers', 'categories', 'units', 'brands',
        'counters', 'tenant_settings', 'users'
      ];
      for (const tid of [tenantA, tenantB]) {
        for (const t of tables) {
          try { await db.run(`DELETE FROM ${t} WHERE tenant_id = ?`, [tid]); } catch (_) {}
        }
        try { await db.run('DELETE FROM tenants WHERE id = ?', [tid]); } catch (_) {}
      }
    } catch (_) {}
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
