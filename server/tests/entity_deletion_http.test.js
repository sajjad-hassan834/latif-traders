process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
const http = require('http');
const app = require('../index');
const { db } = require('../config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request({ ...options, port, host: '127.0.0.1' }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runEntityDeletionTests() {
  console.log('\n======================================================');
  console.log('  REFERENCED ENTITY DELETION TEST SUITE (HTTP API)');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));

  const drivers = ['sqlite', 'postgres'];

  for (const driver of drivers) {
    console.log(`\n--- Testing Deletion Rules on Driver: ${driver.toUpperCase()} ---`);
    db.setDriver(driver);

    const uid = Date.now().toString().slice(-6);
    const tenantId = `t_del_${driver}_${uid}`;
    const username = `admin_${driver}_${uid}`;
    
    // Seed tenant
    if (driver === 'postgres') {
      await db.run("INSERT INTO tenants (id, business_name, owner_name) VALUES (?, 'Deletion Test Co', 'Tester') ON CONFLICT (id) DO NOTHING", [tenantId]);
      await db.run("INSERT INTO users (tenant_id, username, password_hash, full_name, role) VALUES (?, ?, 'hash', 'Admin', 'admin') ON CONFLICT (tenant_id, username) DO NOTHING", [tenantId, username]);
    } else {
      await db.run("INSERT OR IGNORE INTO tenants (id, business_name, owner_name) VALUES (?, 'Deletion Test Co', 'Tester')", [tenantId]);
      await db.run("INSERT OR IGNORE INTO users (tenant_id, username, password_hash, full_name, role) VALUES (?, ?, 'hash', 'Admin', 'admin')", [tenantId, username]);
    }
    const user = await db.get("SELECT id FROM users WHERE username = ?", [username]);
    const userId = user?.id || 1;

    const token = jwt.sign(
      { id: userId, username, role: 'admin', tenantId, token_version: 1 },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Referenced Customer with Balance > 0 -> Deletion BLOCKED
    console.log('  [Customer Deletion Check]');
    const custRes = await db.run("INSERT INTO customers (tenant_id, name, current_balance) VALUES (?, 'Customer With Debt', 5000)", [tenantId]);
    const custId = custRes.lastInsertRowid;

    const delCustRes = await makeRequest(server, {
      method: 'DELETE',
      path: `/api/parties/customers/${custId}`,
      headers: authHeaders
    });
    console.log('    Response status:', delCustRes.status, 'body:', delCustRes.body);
    assert(delCustRes.status === 400, `${driver}: Deleting customer with active balance was BLOCKED with HTTP 400`);
    assert(delCustRes.body.message.includes('active balance'), `${driver}: Error message specifies active balance restriction`);

    // 2. Referenced Supplier with Balance > 0 -> Deletion BLOCKED
    console.log('  [Supplier Deletion Check]');
    const supRes = await db.run("INSERT INTO suppliers (tenant_id, name, current_balance) VALUES (?, 'Supplier With Payable', 8000)", [tenantId]);
    const supId = supRes.lastInsertRowid;

    const delSupRes = await makeRequest(server, {
      method: 'DELETE',
      path: `/api/parties/suppliers/${supId}`,
      headers: authHeaders
    });
    assert(delSupRes.status === 400, `${driver}: Deleting supplier with active balance was BLOCKED with HTTP 400`);
    assert(delSupRes.body.message.includes('active payable balance'), `${driver}: Error message specifies active payable restriction`);

    // 3. Product with Sales History -> Deletion without force BLOCKED
    console.log('  [Product with History Deletion Check]');
    const prodRes = await db.run("INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price) VALUES (?, 'Historical Product', ?, 10, 20)", [tenantId, `SKU-HIST-${driver}`]);
    const prodId = prodRes.lastInsertRowid;
    const saleRes = await db.run("INSERT INTO sales (tenant_id, invoice_no, grand_total, paid_amount, sale_date) VALUES (?, ?, 100, 100, '2026-10-31')", [tenantId, `INV-HIST-${driver}`]);
    const saleId = saleRes.lastInsertRowid;
    await db.run("INSERT INTO sale_items (tenant_id, sale_id, product_id, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, 5, 'pkt', 20, 100)", [tenantId, saleId, prodId]);

    const delProdRes = await makeRequest(server, {
      method: 'DELETE',
      path: `/api/products/${prodId}`,
      headers: authHeaders
    });
    assert(delProdRes.body.hasHistory === true, `${driver}: Deleting product with transactions is BLOCKED without force parameter`);
    assert(delProdRes.body.salesCount > 0, `${driver}: Reports transaction history details to user`);

    // Clean up test data
    await db.run('DELETE FROM sale_items WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM sales WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM products WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM suppliers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM customers WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM users WHERE tenant_id = ?', [tenantId]);
    await db.run('DELETE FROM tenants WHERE id = ?', [tenantId]);
  }

  server.close();
  console.log('\n======================================================');
  console.log('  🎉 ALL REFERENCED ENTITY DELETION TESTS PASSED ON BOTH DRIVERS!');
  console.log('======================================================\n');
}

runEntityDeletionTests().catch(err => {
  console.error('\n❌ Entity deletion test failed:', err);
  process.exit(1);
});
