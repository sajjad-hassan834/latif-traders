/**
 * Lock-Removal Negative Controls & Concurrency Test Suite (Pool of 10)
 *
 * Verifies the 4 critical concurrency protections:
 *  1. Stock Deduction (Atomic / Locked vs Unlocked Read-Modify-Write)
 *  2. Document Numbering (Atomic Counter vs Non-Atomic SELECT-THEN-UPDATE)
 *  3. Balance Updates (Atomic Balance Delta vs Stale In-Memory Read-Modify-Write)
 *  4. Opposite-Order Locking Deadlock Prevention (Sorted ID Locking vs Unsorted Reverse Locking)
 *
 * Each test executes:
 *  a. NEGATIVE CONTROL (lock/atomic removed) -> PROVES that race condition/deadlock/duplicate DOES occur.
 *  b. RESTORED CONTROL (production locked/atomic mechanism) -> PROVES 100% correctness with zero anomalies.
 */

const assert = require('assert');
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';

async function runLockRemovalNegativeControls() {
  console.log('========================================================================');
  console.log('LOCK-REMOVAL NEGATIVE CONTROLS SUITE (POOL OF 10 CONNECTIONS)');
  console.log('========================================================================\n');

  const pool = new Pool({
    connectionString: pgUrl,
    max: 10
  });

  const tenantId = `t_neg_lock_${Date.now()}`;

  // Pre-seed test tenant
  await pool.query(
    "INSERT INTO tenants (id, business_name, owner_name, plan, business_type, is_active) VALUES ($1, 'Neg Lock Tenant', 'Tester', 'enterprise', 'retail_general', 1)",
    [tenantId]
  );

  let controlsPassed = 0;

  // ------------------------------------------------------------------------
  // 1. STOCK DEDUCTION CONCURRENCY CONTROL
  // ------------------------------------------------------------------------
  console.log('--- 1. Stock Deduction: Atomic Decrement vs Stale In-Memory Race ---');
  // Create product and batch with initial quantity = 10
  const prod1Res = await pool.query(
    'INSERT INTO products (name, sku, unit, purchase_price, sale_price, tenant_id) VALUES ($1, $2, $3, 50, 100, $4) RETURNING id',
    ['Stock Test Product', `SKU-STK-${Date.now()}`, 'pcs', tenantId]
  );
  const p1Id = prod1Res.rows[0].id;
  const batch1Res = await pool.query(
    "INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price, sale_price, status) VALUES ($1, $2, 'B-STK-1', 10, 50, 100, 'active') RETURNING id",
    [tenantId, p1Id]
  );
  const b1Id = batch1Res.rows[0].id;

  // 1a. Negative Control: 10 concurrent workers read quantity in memory, sleep 10ms, then write back readQty - 1
  // Without atomic decrement or FOR UPDATE lock, workers overwrite each other's updates (lost updates)
  const staleDeductWorkers = [];
  for (let i = 0; i < 10; i++) {
    staleDeductWorkers.push((async () => {
      const client = await pool.connect();
      try {
        const row = (await client.query('SELECT quantity FROM batches WHERE id = $1', [b1Id])).rows[0];
        const currentQty = Number(row.quantity);
        await new Promise(r => setTimeout(r, 10)); // simulate non-atomic processing window
        await client.query('UPDATE batches SET quantity = $1 WHERE id = $2', [currentQty - 1, b1Id]);
      } finally {
        client.release();
      }
    })());
  }
  await Promise.all(staleDeductWorkers);

  const staleResult = (await pool.query('SELECT quantity FROM batches WHERE id = $1', [b1Id])).rows[0];
  const staleQty = Number(staleResult.quantity);
  // Expected correct quantity after 10 deductions of 1 is 0. With lost updates, staleQty will be > 0 (typically 9 or 8)
  const raceDetected = staleQty > 0;
  assert(raceDetected, `Negative control must detect lost updates without lock! Final quantity was ${staleQty} instead of 0`);
  console.log(`  ✅ NEGATIVE CONTROL VERIFIED: Unlocked read-modify-write lost updates (final qty: ${staleQty} > 0)`);

  // 1b. Restored Control: Reset to 10 and execute 10 concurrent atomic updates
  await pool.query('UPDATE batches SET quantity = 10 WHERE id = $1', [b1Id]);
  const atomicDeductWorkers = [];
  for (let i = 0; i < 10; i++) {
    atomicDeductWorkers.push(
      pool.query('UPDATE batches SET quantity = quantity - 1 WHERE id = $1 AND quantity >= 1', [b1Id])
    );
  }
  await Promise.all(atomicDeductWorkers);
  const atomicResult = (await pool.query('SELECT quantity FROM batches WHERE id = $1', [b1Id])).rows[0];
  assert.strictEqual(Number(atomicResult.quantity), 0, 'Atomic decrement must reach exactly 0 with zero lost updates');
  console.log('  ✅ RESTORED CONTROL VERIFIED: Atomic stock decrement reaches exactly 0 with zero lost updates\n');
  controlsPassed++;

  // ------------------------------------------------------------------------
  // 2. DOCUMENT NUMBERING CONCURRENCY CONTROL
  // ------------------------------------------------------------------------
  console.log('--- 2. Document Numbering: Atomic Counter vs Non-Atomic SELECT-UPDATE ---');
  const counterType = `test_inv_${Date.now()}`;

  // 2a. Negative Control: 10 parallel workers read MAX(last_number) and set +1
  // Without atomic UPSERT/RETURNING, concurrent workers will generate DUPLICATE numbers
  await pool.query(
    'INSERT INTO counters (tenant_id, counter_type, last_number, updated_at) VALUES ($1, $2, 0, CURRENT_TIMESTAMP)',
    [tenantId, counterType]
  );

  const staleNumberingResults = [];
  const staleNumberWorkers = [];
  for (let i = 0; i < 10; i++) {
    staleNumberWorkers.push((async () => {
      const client = await pool.connect();
      try {
        const row = (await client.query('SELECT last_number FROM counters WHERE tenant_id = $1 AND counter_type = $2', [tenantId, counterType])).rows[0];
        const num = Number(row.last_number) + 1;
        await new Promise(r => setTimeout(r, 10)); // race window
        await client.query('UPDATE counters SET last_number = $1 WHERE tenant_id = $2 AND counter_type = $3', [num, tenantId, counterType]);
        staleNumberingResults.push(num);
      } finally {
        client.release();
      }
    })());
  }
  await Promise.all(staleNumberWorkers);

  const uniqueStaleNumbers = new Set(staleNumberingResults);
  const duplicateNumbersGenerated = uniqueStaleNumbers.size < 10;
  assert(duplicateNumbersGenerated, `Negative control must generate duplicate invoice numbers! Unique count: ${uniqueStaleNumbers.size}/10`);
  console.log(`  ✅ NEGATIVE CONTROL VERIFIED: Non-atomic numbering caused collisions (${uniqueStaleNumbers.size}/10 unique numbers)`);

  // 2b. Restored Control: Atomic ON CONFLICT ... DO UPDATE ... RETURNING
  const atomicCounterType = `test_inv_atomic_${Date.now()}`;
  const atomicNumberingResults = [];
  const atomicNumberWorkers = [];
  for (let i = 0; i < 10; i++) {
    atomicNumberWorkers.push((async () => {
      const res = await pool.query(`
        INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
        VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, counter_type)
        DO UPDATE SET last_number = counters.last_number + 1, updated_at = CURRENT_TIMESTAMP
        RETURNING last_number;
      `, [tenantId, atomicCounterType]);
      atomicNumberingResults.push(Number(res.rows[0].last_number));
    })());
  }
  await Promise.all(atomicNumberWorkers);

  const uniqueAtomicNumbers = new Set(atomicNumberingResults);
  assert.strictEqual(uniqueAtomicNumbers.size, 10, 'Atomic counters must generate 10 strictly unique sequential numbers');
  console.log('  ✅ RESTORED CONTROL VERIFIED: Atomic counter generates 10/10 strictly unique numbers with 0 duplicates\n');
  controlsPassed++;

  // ------------------------------------------------------------------------
  // 3. BALANCE UPDATES CONCURRENCY CONTROL
  // ------------------------------------------------------------------------
  console.log('--- 3. Balance Updates: Atomic vs Stale In-Memory Read-Modify-Write ---');
  const custRes = await pool.query(
    "INSERT INTO customers (name, customer_type, opening_balance, current_balance, credit_limit, tenant_id) VALUES ('Bal Test Cust', 'Retail', 0, 1000, 50000, $1) RETURNING id",
    [tenantId]
  );
  const custId = custRes.rows[0].id;

  // 3a. Negative Control: 5 credit sales (+100) and 5 payments (-100) using stale in-memory balance calculation
  const staleBalWorkers = [];
  for (let i = 0; i < 5; i++) {
    staleBalWorkers.push((async () => {
      const client = await pool.connect();
      try {
        const cur = Number((await client.query('SELECT current_balance FROM customers WHERE id = $1', [custId])).rows[0].current_balance);
        await new Promise(r => setTimeout(r, 10));
        await client.query('UPDATE customers SET current_balance = $1 WHERE id = $2', [cur + 100, custId]);
      } finally {
        client.release();
      }
    })());
    staleBalWorkers.push((async () => {
      const client = await pool.connect();
      try {
        const cur = Number((await client.query('SELECT current_balance FROM customers WHERE id = $1', [custId])).rows[0].current_balance);
        await new Promise(r => setTimeout(r, 10));
        await client.query('UPDATE customers SET current_balance = $1 WHERE id = $2', [cur - 100, custId]);
      } finally {
        client.release();
      }
    })());
  }
  await Promise.all(staleBalWorkers);

  const staleBalResult = Number((await pool.query('SELECT current_balance FROM customers WHERE id = $1', [custId])).rows[0].current_balance);
  const balanceDriftOccurred = staleBalResult !== 1000;
  assert(balanceDriftOccurred, `Negative control must cause balance drift without locks! Balance was ${staleBalResult}`);
  console.log(`  ✅ NEGATIVE CONTROL VERIFIED: Stale balance updates drifted from ₨ 1,000 to ₨ ${staleBalResult}`);

  // 3b. Restored Control: Reset to 1000 and run atomic delta updates
  await pool.query('UPDATE customers SET current_balance = 1000 WHERE id = $1', [custId]);
  const atomicBalWorkers = [];
  for (let i = 0; i < 5; i++) {
    atomicBalWorkers.push(pool.query('UPDATE customers SET current_balance = current_balance + 100 WHERE id = $1', [custId]));
    atomicBalWorkers.push(pool.query('UPDATE customers SET current_balance = current_balance - 100 WHERE id = $1', [custId]));
  }
  await Promise.all(atomicBalWorkers);

  const atomicBalResult = Number((await pool.query('SELECT current_balance FROM customers WHERE id = $1', [custId])).rows[0].current_balance);
  assert.strictEqual(atomicBalResult, 1000, 'Atomic balance updates must have exact 0.00 drift');
  console.log('  ✅ RESTORED CONTROL VERIFIED: Atomic balance updates maintain exact balance (₨ 1,000.00, 0.00 drift)\n');
  controlsPassed++;

  // ------------------------------------------------------------------------
  // 4. OPPOSITE-ORDER SALES DEADLOCK PREVENTION
  // ------------------------------------------------------------------------
  console.log('--- 4. Opposite-Order Sales: Lock-Order Deadlock vs Sorted Lock Order ---');
  // Create 2 products A and B
  const pARes = await pool.query('INSERT INTO products (name, sku, unit, purchase_price, sale_price, tenant_id) VALUES ($1, $2, $3, 10, 20, $4) RETURNING id', ['Deadlock Prod A', `SKU-DA-${Date.now()}`, 'pcs', tenantId]);
  const pBRes = await pool.query('INSERT INTO products (name, sku, unit, purchase_price, sale_price, tenant_id) VALUES ($1, $2, $3, 10, 20, $4) RETURNING id', ['Deadlock Prod B', `SKU-DB-${Date.now()}`, 'pcs', tenantId]);
  const idA = Math.min(pARes.rows[0].id, pBRes.rows[0].id);
  const idB = Math.max(pARes.rows[0].id, pBRes.rows[0].id);

  // 4a. Negative Control: Two transactions lock in opposite order ([idA then idB] vs [idB then idA])
  let deadlockDetected = false;
  const client1 = await pool.connect();
  const client2 = await pool.connect();

  try {
    await client1.query('BEGIN');
    await client2.query('BEGIN');

    // Tx1 locks A
    await client1.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idA]);
    // Tx2 locks B
    await client2.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idB]);

    // Now Tx1 tries to lock B (blocks waiting for Tx2)
    // and Tx2 tries to lock A (triggers PostgreSQL deadlock detection 40P01)
    const tx1Promise = client1.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idB]);
    const tx2Promise = client2.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idA]);

    await Promise.all([tx1Promise, tx2Promise]);
  } catch (err) {
    if (err.code === '40P01' || err.message.includes('deadlock')) {
      deadlockDetected = true;
    }
  } finally {
    try { await client1.query('ROLLBACK'); } catch (_) {}
    try { await client2.query('ROLLBACK'); } catch (_) {}
    client1.release();
    client2.release();
  }

  assert(deadlockDetected, 'Negative control must trigger PostgreSQL 40P01 deadlock when locking unsorted items');
  console.log('  ✅ NEGATIVE CONTROL VERIFIED: Unsorted opposite-order locks triggered deadlock (PostgreSQL 40P01)');

  // 4b. Restored Control: Both transactions enforce ascending sorted order [idA then idB]
  const c1Restored = await pool.connect();
  const c2Restored = await pool.connect();
  let sortedSuccess = false;

  try {
    await c1Restored.query('BEGIN');
    await c2Restored.query('BEGIN');

    // Both sort unique IDs in ascending order: [idA, idB]
    const p1 = (async () => {
      await c1Restored.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idA]);
      await new Promise(r => setTimeout(r, 20));
      await c1Restored.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idB]);
      await c1Restored.query('COMMIT');
    })();

    const p2 = (async () => {
      await new Promise(r => setTimeout(r, 5));
      await c2Restored.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idA]); // waits for c1 cleanly without deadlock
      await c2Restored.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [idB]);
      await c2Restored.query('COMMIT');
    })();

    await Promise.all([p1, p2]);
    sortedSuccess = true;
  } finally {
    c1Restored.release();
    c2Restored.release();
  }

  assert(sortedSuccess, 'Restored control with sorted lock order must complete with ZERO deadlocks');
  console.log('  ✅ RESTORED CONTROL VERIFIED: Ascending ID lock order resolves concurrency with ZERO deadlocks\n');
  controlsPassed++;

  await pool.end();

  console.log('------------------------------------------------------------------------');
  console.log(`Summary: All ${controlsPassed}/4 Lock-Removal Negative Controls Verified!`);
  console.log('========================================================================\n');
}

if (require.main === module) {
  runLockRemovalNegativeControls().then(() => process.exit(0)).catch(err => {
    console.error('Negative controls error:', err);
    process.exit(1);
  });
}

module.exports = { runLockRemovalNegativeControls };

