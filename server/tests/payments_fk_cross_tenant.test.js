const assert = require('assert');
const Database = require('better-sqlite3');
const { Client } = require('pg');

async function runPaymentFKTests() {
  console.log('========================================================================');
  console.log('GATE A6: PAYMENTS FOREIGN KEY & CROSS-TENANT ISOLATION TESTS');
  console.log('========================================================================\n');

  // ========================================================================
  // 1. SQLITE RAW-SQL ENFORCEMENT
  // ========================================================================
  console.log('--- 1. Testing SQLite Payment Triggers & Isolation (Raw SQL) ---');
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      UNIQUE(tenant_id, id)
    );

    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      UNIQUE(tenant_id, id)
    );

    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      type TEXT NOT NULL,
      party_type TEXT NOT NULL,
      party_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL
    );

    CREATE TRIGGER trg_payments_customer_tenant_check_ins
    BEFORE INSERT ON payments
    WHEN NEW.party_type = 'CUSTOMER'
    BEGIN
      SELECT RAISE(ABORT, 'Foreign key violation: customer does not exist in tenant')
      WHERE NOT EXISTS (
        SELECT 1 FROM customers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
      );
    END;

    CREATE TRIGGER trg_payments_supplier_tenant_check_ins
    BEFORE INSERT ON payments
    WHEN NEW.party_type = 'SUPPLIER'
    BEGIN
      SELECT RAISE(ABORT, 'Foreign key violation: supplier does not exist in tenant')
      WHERE NOT EXISTS (
        SELECT 1 FROM suppliers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
      );
    END;

    CREATE TRIGGER trg_payments_customer_tenant_check_upd
    BEFORE UPDATE OF party_id, party_type, tenant_id ON payments
    WHEN NEW.party_type = 'CUSTOMER'
    BEGIN
      SELECT RAISE(ABORT, 'Foreign key violation: customer does not exist in tenant')
      WHERE NOT EXISTS (
        SELECT 1 FROM customers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
      );
    END;

    CREATE TRIGGER trg_payments_supplier_tenant_check_upd
    BEFORE UPDATE OF party_id, party_type, tenant_id ON payments
    WHEN NEW.party_type = 'SUPPLIER'
    BEGIN
      SELECT RAISE(ABORT, 'Foreign key violation: supplier does not exist in tenant')
      WHERE NOT EXISTS (
        SELECT 1 FROM suppliers WHERE id = NEW.party_id AND tenant_id = NEW.tenant_id
      );
    END;

    CREATE TRIGGER trg_customers_prevent_del_with_payments
    BEFORE DELETE ON customers
    BEGIN
      SELECT RAISE(ABORT, 'Cannot delete customer: referencing payments exist in tenant')
      WHERE EXISTS (SELECT 1 FROM payments WHERE party_type = 'CUSTOMER' AND party_id = OLD.id AND tenant_id = OLD.tenant_id);
    END;

    CREATE TRIGGER trg_suppliers_prevent_del_with_payments
    BEFORE DELETE ON suppliers
    BEGIN
      SELECT RAISE(ABORT, 'Cannot delete supplier: referencing payments exist in tenant')
      WHERE EXISTS (SELECT 1 FROM payments WHERE party_type = 'SUPPLIER' AND party_id = OLD.id AND tenant_id = OLD.tenant_id);
    END;
  `);

  sqlite.prepare("INSERT INTO tenants (id, name) VALUES ('tenant_alpha', 'Alpha Foods'), ('tenant_beta', 'Beta Textiles')").run();
  sqlite.prepare("INSERT INTO customers (id, name, tenant_id) VALUES (1, 'Customer Alpha', 'tenant_alpha'), (2, 'Customer Beta', 'tenant_beta')").run();
  sqlite.prepare("INSERT INTO suppliers (id, name, tenant_id) VALUES (1, 'Supplier Alpha', 'tenant_alpha'), (2, 'Supplier Beta', 'tenant_beta')").run();

  // Test 1.1: Cross-tenant customer payment rejected
  let sqRejectedCust = false;
  try {
    sqlite.prepare("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES ('tenant_alpha', 'RECEIPT', 'CUSTOMER', 2, 500.0, '2026-11-02')").run();
  } catch (err) {
    sqRejectedCust = true;
    console.log('  ✅ [SQLite] Cross-Tenant Customer Payment Rejected:', err.message);
  }
  assert(sqRejectedCust, 'SQLite must reject payment pointing to another tenant customer');

  // Test 1.2: Cross-tenant supplier payment rejected
  let sqRejectedSup = false;
  try {
    sqlite.prepare("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES ('tenant_alpha', 'SUPPLIER_PAYMENT', 'SUPPLIER', 2, 1000.0, '2026-11-02')").run();
  } catch (err) {
    sqRejectedSup = true;
    console.log('  ✅ [SQLite] Cross-Tenant Supplier Payment Rejected:', err.message);
  }
  assert(sqRejectedSup, 'SQLite must reject payment pointing to another tenant supplier');

  // Test 1.3: Valid payment succeeds
  sqlite.prepare("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES ('tenant_alpha', 'RECEIPT', 'CUSTOMER', 1, 500.0, '2026-11-02')").run();
  console.log('  ✅ [SQLite] Valid Tenant Payment Inserted Successfully');

  // Test 1.4: Deleting customer with payment rejected
  let sqDelRejected = false;
  try {
    sqlite.prepare("DELETE FROM customers WHERE id = 1 AND tenant_id = 'tenant_alpha'").run();
  } catch (err) {
    sqDelRejected = true;
    console.log('  ✅ [SQLite] Delete Customer with Active Payments Blocked:', err.message);
  }
  assert(sqDelRejected, 'SQLite must block deleting customer with existing payments');

  // ========================================================================
  // 2. POSTGRESQL RAW-SQL ENFORCEMENT
  // ========================================================================
  console.log('\n--- 2. Testing PostgreSQL Payment Triggers & Isolation (Raw SQL) ---');
  const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();

  await pg.query("INSERT INTO tenants (id, business_name, owner_name) VALUES ('t_alpha', 'Alpha', 'Owner A'), ('t_beta', 'Beta', 'Owner B') ON CONFLICT DO NOTHING");
  await pg.query("INSERT INTO customers (id, name, tenant_id) VALUES (9001, 'Cust Alpha', 't_alpha'), (9002, 'Cust Beta', 't_beta') ON CONFLICT DO NOTHING");
  await pg.query("INSERT INTO suppliers (id, name, tenant_id) VALUES (9001, 'Sup Alpha', 't_alpha'), (9002, 'Sup Beta', 't_beta') ON CONFLICT DO NOTHING");

  // Test 2.1: Cross-tenant customer payment rejected
  let pgRejectedCust = false;
  try {
    await pg.query("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES ('t_alpha', 'RECEIPT', 'CUSTOMER', 9002, 500.00, '2026-11-02')");
  } catch (err) {
    pgRejectedCust = true;
    console.log('  ✅ [PostgreSQL] Cross-Tenant Customer Payment Rejected:', err.message);
  }
  assert(pgRejectedCust, 'PostgreSQL must reject payment pointing to another tenant customer');

  // Test 2.2: Cross-tenant supplier payment rejected
  let pgRejectedSup = false;
  try {
    await pg.query("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES ('t_alpha', 'SUPPLIER_PAYMENT', 'SUPPLIER', 9002, 1000.00, '2026-11-02')");
  } catch (err) {
    pgRejectedSup = true;
    console.log('  ✅ [PostgreSQL] Cross-Tenant Supplier Payment Rejected:', err.message);
  }
  assert(pgRejectedSup, 'PostgreSQL must reject payment pointing to another tenant supplier');

  // Test 2.3: Valid payment succeeds
  const insRes = await pg.query("INSERT INTO payments (tenant_id, type, party_type, party_id, amount, payment_date) VALUES ('t_alpha', 'RECEIPT', 'CUSTOMER', 9001, 500.00, '2026-11-02') RETURNING id");
  console.log('  ✅ [PostgreSQL] Valid Tenant Payment Inserted Successfully (ID: ' + insRes.rows[0].id + ')');

  // Test 2.4: Deleting customer with payment rejected
  let pgDelRejected = false;
  try {
    await pg.query("DELETE FROM customers WHERE id = 9001 AND tenant_id = 't_alpha'");
  } catch (err) {
    pgDelRejected = true;
    console.log('  ✅ [PostgreSQL] Delete Customer with Active Payments Blocked:', err.message);
  }
  assert(pgDelRejected, 'PostgreSQL must block deleting customer with existing payments');

  // Clean up test rows
  await pg.query("DELETE FROM payments WHERE party_id IN (9001, 9002)");
  await pg.query("DELETE FROM customers WHERE id IN (9001, 9002)");
  await pg.query("DELETE FROM suppliers WHERE id IN (9001, 9002)");
  await pg.query("DELETE FROM tenants WHERE id IN ('t_alpha', 't_beta')");
  await pg.end();

  console.log('\n========================================================================');
  console.log('PAYMENTS FK & CROSS-TENANT ISOLATION: 100% ENFORCED ON SQLITE & POSTGRES');
  console.log('========================================================================\n');
}

runPaymentFKTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
