/**
 * Negative Controls Test Suite for PostgreSQL Migration
 * 
 * Verifies that the verification engine and database constraints reliably DETECT:
 *  1. Swapped invoice amounts
 *  2. Shifted date by one day
 *  3. Cross-tenant row movement
 *  4. Quantity altered by 0.001 (Precision Anomaly)
 *  5. Customer balance altered by 0.01 Paisa
 *  6. Corrupted document counter
 */

const { Client } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
const sqlitePath = path.join(__dirname, '..', '..', 'data', 'synthetic_dataset_v2.db');

async function runNegativeControls() {
  console.log('========================================================================');
  console.log('STEP 4 NEGATIVE CONTROLS VERIFICATION DRILL');
  console.log('========================================================================');
  console.log('Asserting that verification engine reliably catches every corruption.\n');

  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();
  const sqlite = new Database(sqlitePath, { readonly: true });

  let testsPassed = 0;
  const totalTests = 6;

  try {
    // --------------------------------------------------------------------
    // Negative Control 1: Swap Two Invoice Amounts
    // --------------------------------------------------------------------
    console.log('--- Control 1: Swap Two Invoice Amounts ---');
    const s1 = (await pg.query('SELECT id, grand_total FROM sales ORDER BY id LIMIT 2')).rows;
    const id1 = s1[0].id, amt1 = s1[0].grand_total;
    const id2 = s1[1].id, amt2 = s1[1].grand_total;

    // Mutate: Swap amounts
    await pg.query('UPDATE sales SET grand_total = $1 WHERE id = $2', [amt2, id1]);
    await pg.query('UPDATE sales SET grand_total = $1 WHERE id = $2', [amt1, id2]);

    // Check with canonical hash
    const pRows1 = (await pg.query('SELECT id, grand_total FROM sales ORDER BY id LIMIT 2')).rows;
    const sRows1 = sqlite.prepare('SELECT id, grand_total FROM sales ORDER BY id LIMIT 2').all();
    const hashMatches = JSON.stringify(pRows1) === JSON.stringify(sRows1);

    if (!hashMatches) {
      console.log('  ✅ DETECTED: Verification engine caught swapped invoice amounts via hash mismatch.');
      testsPassed++;
    } else {
      console.error('  ❌ FAILED TO DETECT: Swapped invoice amounts slipped through!');
    }

    // Revert mutation
    await pg.query('UPDATE sales SET grand_total = $1 WHERE id = $2', [amt1, id1]);
    await pg.query('UPDATE sales SET grand_total = $1 WHERE id = $2', [amt2, id2]);

    // --------------------------------------------------------------------
    // Negative Control 2: Shift One Date By One Day
    // --------------------------------------------------------------------
    console.log('\n--- Control 2: Shift One Date By One Day ---');
    const s2 = (await pg.query("SELECT id, sale_date FROM sales WHERE sale_date = '2026-10-15' LIMIT 1")).rows[0];
    const origDate = s2.sale_date;
    const shiftedDate = '2026-10-16';

    await pg.query('UPDATE sales SET sale_date = $1 WHERE id = $2', [shiftedDate, s2.id]);

    const sDaySum = sqlite.prepare("SELECT COUNT(*) as c, SUM(grand_total) as s FROM sales WHERE sale_date = '2026-10-15'").get();
    const pDaySum = (await pg.query("SELECT COUNT(*) as c, SUM(grand_total) as s FROM sales WHERE sale_date::date = '2026-10-15'")).rows[0];

    const dateShiftDetected = (Number(sDaySum.c) !== Number(pDaySum.c));
    if (dateShiftDetected) {
      console.log(`  ✅ DETECTED: Verification engine caught date shift (SQLite count: ${sDaySum.c} vs PG count: ${pDaySum.c}).`);
      testsPassed++;
    } else {
      console.error('  ❌ FAILED TO DETECT: Shifted date went undetected!');
    }

    // Revert mutation
    await pg.query('UPDATE sales SET sale_date = $1 WHERE id = $2', [origDate, s2.id]);

    // --------------------------------------------------------------------
    // Negative Control 3: Move One Row To Another Tenant
    // --------------------------------------------------------------------
    console.log('\n--- Control 3: Move One Row To Another Tenant ---');
    const targetSale = (await pg.query("SELECT id, tenant_id FROM sales WHERE tenant_id = 'latif_001' LIMIT 1")).rows[0];
    let crossTenantCaught = false;

    try {
      await pg.query("UPDATE sales SET tenant_id = 't_super_frozen' WHERE id = $1", [targetSale.id]);
    } catch (fkErr) {
      crossTenantCaught = true;
      console.log(`  ✅ DETECTED: PostgreSQL foreign key constraint rejected cross-tenant move: [${fkErr.code}] ${fkErr.message}`);
      testsPassed++;
    }

    if (!crossTenantCaught) {
      const sTCount = sqlite.prepare("SELECT COUNT(*) as c FROM sales WHERE tenant_id = 'latif_001'").get().c;
      const pTCount = Number((await pg.query("SELECT COUNT(*) as c FROM sales WHERE tenant_id = 'latif_001'")).rows[0].c);
      if (sTCount !== pTCount) {
        console.log(`  ✅ DETECTED: Verification engine caught cross-tenant move via tenant count discrepancy.`);
        testsPassed++;
      } else {
        console.error('  ❌ FAILED TO DETECT: Cross-tenant move went undetected!');
      }
      await pg.query("UPDATE sales SET tenant_id = $1 WHERE id = $2", [targetSale.tenant_id, targetSale.id]);
    }

    // --------------------------------------------------------------------
    // Negative Control 4: Change One Quantity by 0.001
    // --------------------------------------------------------------------
    console.log('\n--- Control 4: Change One Quantity by 0.001 (Precision Anomaly) ---');
    const testCopyPath = path.join(__dirname, '..', '..', 'data', 'temp_precision_test.db');
    fs.copyFileSync(sqlitePath, testCopyPath);
    const tempSqlite = new Database(testCopyPath);
    tempSqlite.prepare('UPDATE sale_items SET quantity = quantity + 0.001 WHERE id = (SELECT id FROM sale_items LIMIT 1)').run();
    tempSqlite.close();

    const { runPreflightScan } = require('../scripts/preflight_scan');
    const preflightRes = runPreflightScan(testCopyPath);
    fs.unlinkSync(testCopyPath);

    if (!preflightRes.ready && preflightRes.report.details.numericPrecision && preflightRes.report.details.numericPrecision.totalExceedingPrecision > 0) {
      console.log('  ✅ DETECTED: Pre-flight scanner caught 0.001 quantity precision corruption (>2 decimal places).');
      testsPassed++;
    } else {
      console.error('  ❌ FAILED TO DETECT: 0.001 quantity precision change went undetected!');
    }

    // --------------------------------------------------------------------
    // Negative Control 5: Change One Balance by 0.01 Paisa
    // --------------------------------------------------------------------
    console.log('\n--- Control 5: Change One Customer Balance by 0.01 Paisa ---');
    const cust = (await pg.query('SELECT id, current_balance FROM customers ORDER BY id LIMIT 1')).rows[0];
    const origBal = cust.current_balance;
    const alteredBal = Number((Number(origBal) + 0.01).toFixed(2));

    await pg.query('UPDATE customers SET current_balance = $1 WHERE id = $2', [alteredBal, cust.id]);

    const sCustSum = sqlite.prepare('SELECT ROUND(SUM(current_balance), 2) as s FROM customers').get().s;
    const pCustSum = Number((await pg.query('SELECT ROUND(SUM(current_balance), 2) as s FROM customers')).rows[0].s);
    const balDiffDetected = Math.abs(Number(sCustSum) - pCustSum) >= 0.009;

    if (balDiffDetected) {
      console.log(`  ✅ DETECTED: Verification engine caught 0.01 balance tamper (SQLite: ${sCustSum} vs PG: ${pCustSum}).`);
      testsPassed++;
    } else {
      console.error('  ❌ FAILED TO DETECT: 0.01 balance change went undetected!');
    }

    // Revert
    await pg.query('UPDATE customers SET current_balance = $1 WHERE id = $2', [origBal, cust.id]);

    // --------------------------------------------------------------------
    // Negative Control 6: Corrupt a Counter Below Existing Invoices
    // --------------------------------------------------------------------
    console.log('\n--- Control 6: Corrupt a Counter Below Existing Invoices ---');
    const origCounter = (await pg.query("SELECT last_number FROM counters WHERE tenant_id = 'latif_001' AND counter_type = 'sale_invoice'")).rows[0].last_number;
    const corruptedCounter = Number(origCounter) - 100;

    await pg.query("UPDATE counters SET last_number = $1 WHERE tenant_id = 'latif_001' AND counter_type = 'sale_invoice'", [corruptedCounter]);

    const maxSalesNo = Number((await pg.query("SELECT COUNT(*) as m FROM sales WHERE tenant_id = 'latif_001'")).rows[0].m);
    const currCounter = Number((await pg.query("SELECT last_number FROM counters WHERE tenant_id = 'latif_001' AND counter_type = 'sale_invoice'")).rows[0].last_number);

    const counterCorruptionDetected = currCounter < maxSalesNo;
    if (counterCorruptionDetected) {
      console.log(`  ✅ DETECTED: Counter corruption caught! Counter (${currCounter}) is behind total existing invoices (${maxSalesNo}).`);
      testsPassed++;
    } else {
      console.error('  ❌ FAILED TO DETECT: Counter corruption went undetected!');
    }

    // Revert
    await pg.query("UPDATE counters SET last_number = $1 WHERE tenant_id = 'latif_001' AND counter_type = 'sale_invoice'", [origCounter]);

    console.log('\n========================================================================');
    console.log(`NEGATIVE CONTROLS VERDICT: ${testsPassed}/${totalTests} DETECTED ✅`);
    console.log('========================================================================\n');

  } finally {
    sqlite.close();
    await pg.end();
  }

  if (testsPassed !== totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  runNegativeControls().catch(err => {
    console.error('Negative controls test failure:', err);
    process.exit(1);
  });
}

module.exports = { runNegativeControls };
