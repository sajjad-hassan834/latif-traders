const { db, initializeDatabase } = require('../config/database');
const { PostgresAdapter } = require('../config/database-pg');
const { getPKTDate } = require('../utils/timezone');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function runDocumentNumberingTests() {
  console.log('\n======================================================');
  console.log('  DOCUMENT NUMBERING & PKT MIDNIGHT TEST SUITE');
  console.log('======================================================\n');

  // Test 1: PKT Midnight Date Calculations
  console.log('--- Test Group 1: PKT Midnight Boundaries (Asia/Karachi, UTC+5) ---');
  // 18:59:50 UTC on 2026-10-31 is 23:59:50 PKT on 2026-10-31
  const justBeforeMidnightUTC = new Date('2026-10-31T18:59:50.000Z');
  const dateBeforeMidnight = getPKTDate(justBeforeMidnightUTC);
  assert(dateBeforeMidnight === '2026-10-31', '18:59:50 UTC resolves strictly to 2026-10-31 in PKT');

  // 19:00:10 UTC on 2026-10-31 is 00:00:10 PKT on 2026-11-01
  const justAfterMidnightUTC = new Date('2026-10-31T19:00:10.000Z');
  const dateAfterMidnight = getPKTDate(justAfterMidnightUTC);
  assert(dateAfterMidnight === '2026-11-01', '19:00:10 UTC resolves strictly to 2026-11-01 (next business day) in PKT');

  // Test 2: SQLite Document Types & Numbering
  console.log('\n--- Test Group 2: SQLite Document Numbering Across Types ---');
  db.setDriver('sqlite');
  await db.run("DELETE FROM counters WHERE tenant_id = 't_doc_test'");

  const testDocTypes = [
    { type: 'sale_invoice', prefix: 'INV' },
    { type: 'purchase_invoice', prefix: 'PUR' },
    { type: 'receipt_voucher', prefix: 'REC' },
    { type: 'return_invoice', prefix: 'RET' },
    { type: 'stock_adjustment', prefix: 'ADJ' },
    { type: 'cashbook_ref', prefix: 'CB' }
  ];

  for (const doc of testDocTypes) {
    const num1 = await db.getNextNumber('t_doc_test', doc.type, doc.prefix, 4, justBeforeMidnightUTC);
    const num2 = await db.getNextNumber('t_doc_test', doc.type, doc.prefix, 4, justBeforeMidnightUTC);
    const numNextDay = await db.getNextNumber('t_doc_test', doc.type, doc.prefix, 4, justAfterMidnightUTC);

    assert(num1 === `${doc.prefix}-20261031-0001`, `${doc.type} generated correctly for day 1 (0001)`);
    assert(num2 === `${doc.prefix}-20261031-0002`, `${doc.type} incremented sequentially for day 1 (0002)`);
    assert(numNextDay === `${doc.prefix}-20261101-0001`, `${doc.type} rolled over to 0001 for next business day across PKT midnight`);
  }

  // Test 3: PostgreSQL Document Types & Numbering
  console.log('\n--- Test Group 3: PostgreSQL Atomic Document Numbering (Docker PG16) ---');
  const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const pgAdapter = new PostgresAdapter({ connectionString: pgUrl, max: 10 });
  await pgAdapter.init();

  // Clean test tenant counters
  await pgAdapter.query("DELETE FROM counters WHERE tenant_id = 't_doc_test'");
  await pgAdapter.query("INSERT INTO tenants (id, business_name, owner_name) VALUES ('t_doc_test', 'Doc Test Tenant', 'Tester') ON CONFLICT (id) DO NOTHING");

  for (const doc of testDocTypes) {
    const num1 = await pgAdapter.getNextNumber('t_doc_test', doc.type, doc.prefix, 4, justBeforeMidnightUTC);
    const num2 = await pgAdapter.getNextNumber('t_doc_test', doc.type, doc.prefix, 4, justBeforeMidnightUTC);
    const numNextDay = await pgAdapter.getNextNumber('t_doc_test', doc.type, doc.prefix, 4, justAfterMidnightUTC);

    assert(num1 === `${doc.prefix}-20261031-0001`, `PostgreSQL: ${doc.type} generated correctly for day 1 (0001)`);
    assert(num2 === `${doc.prefix}-20261031-0002`, `PostgreSQL: ${doc.type} incremented sequentially for day 1 (0002)`);
    assert(numNextDay === `${doc.prefix}-20261101-0001`, `PostgreSQL: ${doc.type} rolled over to 0001 for next business day across PKT midnight`);
  }

  // Test 4: Counter Initialization from Highest Existing Number
  console.log('\n--- Test Group 4: Initialization from Highest Existing Number ---');
  // Seed an existing counter at 142
  await pgAdapter.query(`
    INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
    VALUES ('t_doc_test', 'sale_invoice_20261031', 142, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, counter_type) DO UPDATE SET last_number = 142
  `);

  const nextFrom142 = await pgAdapter.getNextNumber('t_doc_test', 'sale_invoice', 'INV', 4, justBeforeMidnightUTC);
  assert(nextFrom142 === 'INV-20261031-0143', 'Next counter correctly continues from 142 to 0143 (NO collision or restart)');

  // Clean up
  await pgAdapter.query("DELETE FROM counters WHERE tenant_id = 't_doc_test'");
  await pgAdapter.query("DELETE FROM tenants WHERE id = 't_doc_test'");
  await pgAdapter.close();

  console.log('\n======================================================');
  console.log('  🎉 ALL DOCUMENT NUMBERING & PKT MIDNIGHT TESTS PASSED!');
  console.log('======================================================\n');
}

runDocumentNumberingTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});

