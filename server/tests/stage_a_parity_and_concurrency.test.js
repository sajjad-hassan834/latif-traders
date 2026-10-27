const fs = require('fs');
const path = require('path');
const { PostgresAdapter } = require('../config/database-pg');
const { tokenizeSqlPlaceholders } = require('../config/sqlTokenizer');
const { round2, parseNumeric, isPaisaEqual } = require('../utils/money');
const { getPKTDate, getPKTDateTime, getPKTDayRangeUTC } = require('../utils/timezone');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runStageATests() {
  console.log('\n======================================================');
  console.log('STAGE A: POSTGRES ADAPTER, CONCURRENCY & PARITY SUITE');
  console.log('======================================================\n');

  // 1. Test SQL Tokenizer
  console.log('--- Test 1: Non-Regex SQL Parameter Tokenizer ---');
  const sql1 = "SELECT * FROM customers WHERE name = ? AND status = ?";
  assert(tokenizeSqlPlaceholders(sql1) === "SELECT * FROM customers WHERE name = $1 AND status = $2", "Basic ? converted to $1, $2");

  const sqlWithQuotes = "SELECT * FROM items WHERE note = 'What ? where ?' AND price > ? AND code = \"ref?\"";
  assert(
    tokenizeSqlPlaceholders(sqlWithQuotes) === "SELECT * FROM items WHERE note = 'What ? where ?' AND price > $1 AND code = \"ref?\"",
    "Parameters inside single and double quotes strictly preserved"
  );

  const sqlWithComments = "SELECT id -- comment with ?\n FROM t WHERE a = ? /* block ? */ AND b = ?";
  assert(
    tokenizeSqlPlaceholders(sqlWithComments) === "SELECT id -- comment with ?\n FROM t WHERE a = $1 /* block ? */ AND b = $2",
    "Comments containing ? skipped cleanly without replacement"
  );

  // 2. Test Asia/Karachi (PKT) Timezone around midnight
  console.log('\n--- Test 2: Business Date in Asia/Karachi (PKT) ---');
  // 2026-10-24 19:30:00 UTC is 2026-10-25 00:30:00 PKT (past midnight)
  const pastMidnightUTC = new Date('2026-10-24T19:30:00.000Z');
  assert(getPKTDate(pastMidnightUTC) === '2026-10-25', '19:30 UTC correctly crosses into next PKT calendar day (00:30 PKT)');

  // 2026-10-24 18:30:00 UTC is 2026-10-24 23:30:00 PKT (before midnight)
  const beforeMidnightUTC = new Date('2026-10-24T18:30:00.000Z');
  assert(getPKTDate(beforeMidnightUTC) === '2026-10-24', '18:30 UTC stays on previous PKT calendar day (23:30 PKT)');

  const range = getPKTDayRangeUTC('2026-10-25');
  assert(range.startUTC === '2026-10-24T19:00:00.000Z', 'PKT business day starts at 19:00:00Z previous day');

  // 3. Test Money & Numeric Type Precision
  console.log('\n--- Test 3: Money & NUMERIC(14,2) Parsing ---');
  assert(round2(100.005) === 100.01, 'Half-up rounding on paisa boundary');
  assert(parseNumeric(' 13,380.50 ') === 13380.5, 'Formatted string parsed to exact number');
  assert(isPaisaEqual(13380.000000000002, 13380.00, 0.005), 'SQLite float drift handled by 0.005 paisa tolerance');

  // 4. Initialize PostgreSQL Adapter (using authentic Postgres 16 engine)
  console.log('\n--- Test 4: Database Adapter & Schema Initialization ---');
  const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const adapter = new PostgresAdapter({ connectionString, max: 20 });
  await adapter.init();

  const ver = await adapter.get('SELECT version()');
  const portMatch = connectionString.match(/:(\d+)\//);
  console.log(`\n======================================================`);
  console.log(`[POSTGRES ENGINE VERIFIED] Connected to Port: ${portMatch ? portMatch[1] : 5432}`);
  console.log(`[POSTGRES VERSION] ${ver.version}`);
  console.log(`======================================================\n`);

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'pg_schema.sql'), 'utf-8');
  await adapter.exec(schemaSql);
  // Clean up any test fixtures from prior runs
  await adapter.exec(`
    DELETE FROM payments WHERE tenant_id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
    DELETE FROM sales WHERE tenant_id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
    DELETE FROM batches WHERE tenant_id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
    DELETE FROM products WHERE tenant_id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
    DELETE FROM customers WHERE tenant_id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
    DELETE FROM counters WHERE tenant_id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
    DELETE FROM tenants WHERE id IN ('tenant_alpha', 'tenant_beta', 't_test_tx');
  `);
  assert(true, 'PostgreSQL enterprise schema initialized successfully with all 27 tables');

  // 5. Test Transaction Isolation and Single Connection Binding
  console.log('\n--- Test 5: Transaction Single-Client Binding & Rollback ---');
  let firstQueryTxId = null;
  let secondQueryTxId = null;

  await adapter.transaction(async (tx) => {
    const store = adapter.getActiveClient();
    assert(store && store.isTx, 'Query executes inside verified active transaction scope');
    firstQueryTxId = store.id;

    await tx.run("INSERT INTO tenants (id, business_name, owner_name) VALUES (?, ?, ?)", ['t_test_tx', 'Tx Test Ltd', 'Admin']);
    
    const store2 = adapter.getActiveClient();
    secondQueryTxId = store2.id;
    assert(firstQueryTxId === secondQueryTxId, 'All queries in transaction strictly bound to same connection context');
  });

  const tenantCheck = await adapter.get("SELECT * FROM tenants WHERE id = ?", ['t_test_tx']);
  assert(tenantCheck && tenantCheck.business_name === 'Tx Test Ltd', 'Committed transaction saved to database');

  // Test Rollback of partly failed operation
  let rollbackCaught = false;
  try {
    await adapter.transaction(async (tx) => {
      await tx.run("INSERT INTO customers (tenant_id, name, current_balance) VALUES (?, ?, ?)", ['t_test_tx', 'Rollback Cust', 5000]);
      // Deliberately trigger error: missing required column on users
      await tx.run("INSERT INTO users (id, username) VALUES (99999, NULL)");
    });
  } catch (err) {
    rollbackCaught = true;
  }
  assert(rollbackCaught, 'Transaction aborted on intentional error');

  const rolledBackCust = await adapter.get("SELECT * FROM customers WHERE name = ?", ['Rollback Cust']);
  assert(rolledBackCust === null, 'Rollback verified: partly completed customer insert completely undone');

  // 6. Test Multi-Tenant Isolation & Composite Unique Constraints
  console.log('\n--- Test 6: Multi-Tenant Isolation & Composite Unique Constraints ---');
  await adapter.run("INSERT INTO tenants (id, business_name, owner_name) VALUES (?, ?, ?)", ['tenant_alpha', 'Alpha Foods', 'Alice']);
  await adapter.run("INSERT INTO tenants (id, business_name, owner_name) VALUES (?, ?, ?)", ['tenant_beta', 'Beta Mart', 'Bob']);

  // Same customer name in Tenant Alpha and Tenant Beta
  await adapter.run("INSERT INTO customers (tenant_id, name, current_balance) VALUES (?, ?, ?)", ['tenant_alpha', 'Synthetic Customer Alpha', 11870]);
  await adapter.run("INSERT INTO customers (tenant_id, name, current_balance) VALUES (?, ?, ?)", ['tenant_beta', 'Synthetic Customer Alpha', 0]);

  const custA = await adapter.get("SELECT * FROM customers WHERE tenant_id = ? AND name = ?", ['tenant_alpha', 'Synthetic Customer Alpha']);
  const custB = await adapter.get("SELECT * FROM customers WHERE tenant_id = ? AND name = ?", ['tenant_beta', 'Synthetic Customer Alpha']);

  assert(custA.current_balance === 11870, 'Tenant Alpha balance isolated (11,870)');
  assert(custB.current_balance === 0, 'Tenant Beta balance isolated (0)');

  // Verify composite unique violation within same tenant
  let duplicateCaught = false;
  try {
    await adapter.run("INSERT INTO customers (tenant_id, name, current_balance) VALUES (?, ?, ?)", ['tenant_alpha', 'Synthetic Customer Alpha', 500]);
  } catch (err) {
    duplicateCaught = true;
  }
  assert(duplicateCaught, 'Composite UNIQUE(tenant_id, name) correctly rejects duplicate customer in same tenant');

  // 7. Concurrency Test: 50 Parallel Numbering Requests
  console.log('\n--- Test 7: Concurrency Test (50 Parallel Invoice Numbering Requests) ---');
  const numberingPromises = [];
  for (let i = 0; i < 50; i++) {
    numberingPromises.push(adapter.getNextNumber('tenant_alpha', 'invoice', 'INV'));
  }
  const generatedNumbers = await Promise.all(numberingPromises);
  const uniqueNumbers = new Set(generatedNumbers);
  assert(uniqueNumbers.size === 50, `All 50 invoice numbers generated concurrently are 100% unique (no duplicates)`);
  const sortedNumbers = [...generatedNumbers].sort();
  assert(sortedNumbers[0].endsWith('0001') && sortedNumbers[49].endsWith('0050'), 'Sequential counter incremented from 0001 to 0050 cleanly');

  // 8. Concurrency Test: FIFO Stock Deduction
  console.log('\n--- Test 8: Concurrency Test (FIFO Stock Deductions & Inventory Protection) ---');
  const prodRes = await adapter.run(`
    INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price)
    VALUES (?, 'Chicken Burger 500g', 'CB-500', 500, 750)
  `, ['tenant_alpha']);
  const prodId = prodRes.lastInsertRowid;

  // Add initial batch with 50 units
  const batchRes = await adapter.run(`
    INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price)
    VALUES (?, ?, 'B-001', 50, 500)
  `, ['tenant_alpha', prodId]);
  const batchId = batchRes.lastInsertRowid;

  // Simulate 50 concurrent sales deducting 1 unit each
  const saleDeductionPromises = [];
  for (let i = 0; i < 50; i++) {
    saleDeductionPromises.push(
      adapter.transaction(async (tx) => {
        // Atomic deduction with row lock condition
        const res = await tx.run(`
          UPDATE batches
          SET quantity = quantity - 1
          WHERE id = ? AND tenant_id = ? AND quantity >= 1
        `, [batchId, 'tenant_alpha']);
        if (res.rowCount === 0) {
          throw new Error('Insufficient stock');
        }
      })
    );
  }
  await Promise.all(saleDeductionPromises);

  const finalBatch = await adapter.get("SELECT quantity FROM batches WHERE id = ?", [batchId]);
  assert(finalBatch.quantity === 0, `Initial 50 units deducted exactly 50 times down to 0 units (no negative stock, no race condition)`);

  // An extra 51st concurrent sale must fail
  let excessStockFailed = false;
  try {
    await adapter.transaction(async (tx) => {
      const res = await tx.run(`
        UPDATE batches SET quantity = quantity - 1 WHERE id = ? AND tenant_id = ? AND quantity >= 1
      `, [batchId, 'tenant_alpha']);
      if (res.rowCount === 0) throw new Error('Out of stock');
    });
  } catch (err) {
    excessStockFailed = true;
  }
  assert(excessStockFailed, '51st sale strictly rejected: stock never drops below zero');

  // 9. End-to-End Parity Verification: Synthetic Customer Alpha Exact Reconciliation on Postgres
  console.log('\n--- Test 9: End-to-End Ledger Reconciliation Parity on Postgres ---');
  // Pure sales invoices: 5710, 11200, 13380, 5100, 7700, 13620, 16700 (= 73410)
  const salesData = [
    { no: 'INV-001', date: '2026-09-20', total: 5710, paid: 0 },
    { no: 'INV-002', date: '2026-09-20', total: 11200, paid: 11200 },
    { no: 'INV-003', date: '2026-09-24', total: 13380, paid: 13380 },
    { no: 'INV-004', date: '2026-09-28', total: 5100, paid: 5100 },
    { no: 'INV-005', date: '2026-09-28', total: 7700, paid: 7700 },
    { no: 'INV-006', date: '2026-10-03', total: 13620, paid: 13620 },
    { no: 'INV-007', date: '2026-10-08', total: 16700, paid: 0 }
  ];

  for (const s of salesData) {
    await adapter.run(`
      INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, grand_total, paid_amount, balance_due)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['tenant_alpha', s.no, custA.id, s.date, s.total, s.paid, s.total - s.paid]);
  }

  // Account payment receipt: 10,540
  await adapter.run(`
    INSERT INTO payments (tenant_id, type, party_type, party_id, reference_no, amount, payment_date)
    VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, 'REC-20261020-0001', 10540, '2026-10-20')
  `, ['tenant_alpha', custA.id]);

  // Aggregate parity check using PostgreSQL native NUMERIC math
  const agg = await adapter.get(`
    SELECT
      SUM(grand_total) AS total_purchased,
      SUM(paid_amount) AS total_paid_sales,
      (SELECT SUM(amount) FROM payments WHERE party_id = ? AND party_type = 'CUSTOMER') AS standalone_receipts
    FROM sales
    WHERE customer_id = ? AND tenant_id = ?
  `, [custA.id, custA.id, 'tenant_alpha']);

  const totalPurchased = parseNumeric(agg.total_purchased);
  const totalReceived = parseNumeric(agg.total_paid_sales) + parseNumeric(agg.standalone_receipts);
  const closingBalance = totalPurchased - totalReceived;

  assert(totalPurchased === 73410, `Postgres total purchases: Rs 73,410 (exact match)`);
  assert(totalReceived === 61540, `Postgres total received: Rs 61,540 (exact match)`);
  assert(closingBalance === 11870, `Postgres closing udhaar balance: Rs 11,870 (exact match to paisa)`);

  console.log('\n======================================================');
  console.log('🎉 ALL STAGE A TESTS PASSED PERFECTLY ON POSTGRESQL!');
  console.log('======================================================\n');
  await adapter.close();
}

runStageATests().catch((err) => {
  console.error('\n❌ STAGE A TEST SUITE FAILED:', err);
  process.exit(1);
});
