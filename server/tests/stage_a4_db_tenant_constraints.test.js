const { Client } = require('pg');
const assert = require('assert');

async function testDatabaseTenantConstraints() {
  console.log('========================================================================');
  console.log('STAGE A4: DATABASE-LEVEL TENANT PROTECTION RAW SQL CONSTRAINTS TEST');
  console.log('========================================================================');

  const pgUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  const ver = await client.query('SELECT version()');
  const portMatch = pgUrl.match(/:(\d+)\//);
  console.log(`[POSTGRES CONNECTION VERIFIED] Port: ${portMatch ? portMatch[1] : 5432}`);
  console.log(`[POSTGRES VERSION] ${ver.rows[0].version}\n`);

  try {
    // Clean test tables
    await client.query("DELETE FROM tenants WHERE id IN ('tenant_alpha', 'tenant_beta')");

    // 1. Seed two isolated tenants
    await client.query(`
      INSERT INTO tenants (id, business_name, owner_name)
      VALUES 
        ('tenant_alpha', 'Alpha Enterprises', 'Owner Alpha'),
        ('tenant_beta', 'Beta Corporation', 'Owner Beta')
    `);

    // 2. Seed customers, suppliers, categories, products for both
    const custAlphaRes = await client.query(`
      INSERT INTO customers (tenant_id, name) VALUES ('tenant_alpha', 'Alpha Customer') RETURNING id
    `);
    const custBetaRes = await client.query(`
      INSERT INTO customers (tenant_id, name) VALUES ('tenant_beta', 'Beta Customer') RETURNING id
    `);
    const custAlphaId = custAlphaRes.rows[0].id;
    const custBetaId = custBetaRes.rows[0].id;

    const prodAlphaRes = await client.query(`
      INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price) 
      VALUES ('tenant_alpha', 'Alpha Product', 'SKU-A', 10, 20) RETURNING id
    `);
    const prodBetaRes = await client.query(`
      INSERT INTO products (tenant_id, name, sku, purchase_price, sale_price) 
      VALUES ('tenant_beta', 'Beta Product', 'SKU-B', 15, 30) RETURNING id
    `);
    const prodAlphaId = prodAlphaRes.rows[0].id;
    const prodBetaId = prodBetaRes.rows[0].id;

    const catAlphaRes = await client.query(`
      INSERT INTO expense_categories (tenant_id, name) VALUES ('tenant_alpha', 'Alpha Utilities') RETURNING id
    `);
    const catBetaRes = await client.query(`
      INSERT INTO expense_categories (tenant_id, name) VALUES ('tenant_beta', 'Beta Logistics') RETURNING id
    `);
    const catAlphaId = catAlphaRes.rows[0].id;
    const catBetaId = catBetaRes.rows[0].id;

    const supAlphaRes = await client.query(`
      INSERT INTO suppliers (tenant_id, name) VALUES ('tenant_alpha', 'Alpha Supplier') RETURNING id
    `);
    const supBetaRes = await client.query(`
      INSERT INTO suppliers (tenant_id, name) VALUES ('tenant_beta', 'Beta Supplier') RETURNING id
    `);
    const supAlphaId = supAlphaRes.rows[0].id;
    const supBetaId = supBetaRes.rows[0].id;

    console.log('✓ Seeded isolated tenant master entities.');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 1: Direct Non-Existent Tenant Insertion Block
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 1: Inserting into customer with non-existent tenant ---');
    let t1FailedAsExpected = false;
    try {
      await client.query("INSERT INTO customers (tenant_id, name) VALUES ('ghost_tenant_xyz', 'Ghost')");
    } catch (err) {
      t1FailedAsExpected = err.code === '23503'; // foreign_key_violation
      console.log(`  ✅ Database REJECTED non-existent tenant: [${err.code}] ${err.detail || err.message}`);
    }
    assert(t1FailedAsExpected, 'Database MUST reject row with invalid tenant_id foreign key');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 2: Cross-Tenant Customer in Sales (Bypassing App via Raw SQL)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 2: Inserting sale for Tenant Alpha with Tenant Beta Customer ---');
    let t2FailedAsExpected = false;
    try {
      await client.query(`
        INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, grand_total)
        VALUES ('tenant_alpha', 'INV-X-001', $1, '2026-10-25', 100)
      `, [custBetaId]);
    } catch (err) {
      t2FailedAsExpected = err.code === '23503';
      console.log(`  ✅ Database REJECTED cross-tenant customer in sale: [${err.code}] ${err.detail || err.message}`);
    }
    assert(t2FailedAsExpected, 'Database MUST reject cross-tenant customer reference');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 3: Cross-Tenant Product in Sale Items (Bypassing App via Raw SQL)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 3: Inserting sale_item for Tenant Alpha referencing Tenant Beta Product ---');
    // First insert a legitimate sale for Alpha
    const validSaleAlpha = await client.query(`
      INSERT INTO sales (tenant_id, invoice_no, customer_id, sale_date, grand_total)
      VALUES ('tenant_alpha', 'INV-A-001', $1, '2026-10-25', 100) RETURNING id
    `, [custAlphaId]);
    const saleAlphaId = validSaleAlpha.rows[0].id;

    let t3FailedAsExpected = false;
    try {
      await client.query(`
        INSERT INTO sale_items (tenant_id, sale_id, product_id, quantity, unit_price, total_price)
        VALUES ('tenant_alpha', $1, $2, 5, 20, 100)
      `, [saleAlphaId, prodBetaId]);
    } catch (err) {
      t3FailedAsExpected = err.code === '23503';
      console.log(`  ✅ Database REJECTED cross-tenant product in sale_items: [${err.code}] ${err.detail || err.message}`);
    }
    assert(t3FailedAsExpected, 'Database MUST reject cross-tenant product reference in sale_items');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 4: Cross-Tenant Supplier in Purchases (Bypassing App via Raw SQL)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 4: Inserting purchase for Tenant Alpha referencing Tenant Beta Supplier ---');
    let t4FailedAsExpected = false;
    try {
      await client.query(`
        INSERT INTO purchases (tenant_id, invoice_no, supplier_id, purchase_date, grand_total)
        VALUES ('tenant_alpha', 'PUR-X-001', $1, '2026-10-25', 500)
      `, [supBetaId]);
    } catch (err) {
      t4FailedAsExpected = err.code === '23503';
      console.log(`  ✅ Database REJECTED cross-tenant supplier in purchase: [${err.code}] ${err.detail || err.message}`);
    }
    assert(t4FailedAsExpected, 'Database MUST reject cross-tenant supplier reference');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 5: Cross-Tenant Batch in Sale Items
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 5: Inserting sale_item for Tenant Alpha referencing Tenant Beta Batch ---');
    const batchBetaRes = await client.query(`
      INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price)
      VALUES ('tenant_beta', $1, 'BATCH-BETA-1', 50, 15) RETURNING id
    `, [prodBetaId]);
    const batchBetaId = batchBetaRes.rows[0].id;

    let t5FailedAsExpected = false;
    try {
      await client.query(`
        INSERT INTO sale_items (tenant_id, sale_id, product_id, batch_id, quantity, unit_price, total_price)
        VALUES ('tenant_alpha', $1, $2, $3, 1, 20, 20)
      `, [saleAlphaId, prodAlphaId, batchBetaId]);
    } catch (err) {
      t5FailedAsExpected = err.code === '23503';
      console.log(`  ✅ Database REJECTED cross-tenant batch in sale_items: [${err.code}] ${err.detail || err.message}`);
    }
    assert(t5FailedAsExpected, 'Database MUST reject cross-tenant batch reference');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 6: Cross-Tenant Expense Category
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 6: Inserting expense for Tenant Alpha with Tenant Beta Expense Category ---');
    let t6FailedAsExpected = false;
    try {
      await client.query(`
        INSERT INTO expenses (tenant_id, category_id, title, amount, expense_date)
        VALUES ('tenant_alpha', $1, 'Office Rent', 500, '2026-10-25')
      `, [catBetaId]);
    } catch (err) {
      t6FailedAsExpected = err.code === '23503';
      console.log(`  ✅ Database REJECTED cross-tenant expense category: [${err.code}] ${err.detail || err.message}`);
    }
    assert(t6FailedAsExpected, 'Database MUST reject cross-tenant expense category');

    // ═════════════════════════════════════════════════════════════════════════
    // TEST 7: Legitimate Same-Tenant Insertion Success
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- Test 7: Legitimate Same-Tenant Operations ---');
    const validBatchAlpha = await client.query(`
      INSERT INTO batches (tenant_id, product_id, batch_no, quantity, purchase_price)
      VALUES ('tenant_alpha', $1, 'BATCH-ALPHA-1', 50, 10) RETURNING id
    `, [prodAlphaId]);
    const batchAlphaId = validBatchAlpha.rows[0].id;

    const validItemRes = await client.query(`
      INSERT INTO sale_items (tenant_id, sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES ('tenant_alpha', $1, $2, $3, 2, 20, 40) RETURNING id
    `, [saleAlphaId, prodAlphaId, batchAlphaId]);
    assert(validItemRes.rows[0].id, 'Legitimate same-tenant sale_item inserted successfully');
    console.log('  ✅ Legitimate same-tenant sale_item accepted cleanly by PostgreSQL constraints.');

    console.log('\n========================================================================');
    console.log('🎉 ALL DATABASE-LEVEL TENANT CONSTRAINT TESTS PASSED WITH 100% SUCCESS');
    console.log('========================================================================\n');
  } finally {
    await client.query("DELETE FROM tenants WHERE id IN ('tenant_alpha', 'tenant_beta')");
    await client.end();
  }
}

testDatabaseTenantConstraints().catch(err => {
  console.error('❌ Database tenant constraint test failed:', err);
  process.exit(1);
});
