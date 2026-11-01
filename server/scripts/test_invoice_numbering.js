const { db, initializeDatabase } = require('../config/database');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

async function testInvoiceNumbering() {
  process.env.DB_DRIVER = 'postgres';
  
  await initializeDatabase();
  const n1 = await db.getNextNumber(LEGACY_TENANT_ID, 'sale_invoice', 'INV');
  const n2 = await db.getNextNumber(LEGACY_TENANT_ID, 'sale_invoice', 'INV');
  const n3 = await db.getNextNumber(LEGACY_TENANT_ID, 'purchase_invoice', 'PUR');

  console.log('[POSTGRES INVOICE GENERATION]');
  console.log('Sale Invoice 1:    ', n1);
  console.log('Sale Invoice 2:    ', n2);
  console.log('Purchase Invoice 1:', n3);

  const row = await db.get("SELECT * FROM counters WHERE tenant_id = ? AND counter_type LIKE 'sale_invoice_%'", [LEGACY_TENANT_ID]);
  console.log('Counter row in DB: ', row);

  if (db.close) await db.close();
}

testInvoiceNumbering().catch(console.error);
