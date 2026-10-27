const { db, initializeDatabase } = require('../config/database');

async function testInvoiceNumbering() {
  process.env.DB_DRIVER = 'postgres';
  process.env.DATABASE_URL = 'postgresql://postgres:testpassword123@localhost:5434/latif_test';
  
  await initializeDatabase();
  const n1 = await db.getNextNumber('latif_001', 'sale_invoice', 'INV');
  const n2 = await db.getNextNumber('latif_001', 'sale_invoice', 'INV');
  const n3 = await db.getNextNumber('latif_001', 'purchase_invoice', 'PUR');

  console.log('[POSTGRES INVOICE GENERATION]');
  console.log('Sale Invoice 1:    ', n1);
  console.log('Sale Invoice 2:    ', n2);
  console.log('Purchase Invoice 1:', n3);

  const row = await db.get("SELECT * FROM counters WHERE tenant_id = 'latif_001' AND counter_type LIKE 'sale_invoice_%'");
  console.log('Counter row in DB: ', row);

  await db.close();
}

testInvoiceNumbering().catch(console.error);
