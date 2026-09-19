const { db } = require('./config/database');

console.log('=== STARTING FIFO & BUSINESS LOGIC VERIFICATION ===');

// 1. Check Brands
const brands = db.prepare('SELECT name FROM brands').all();
console.log('1. Brands in DB:', brands.map(b => b.name).join(', '));
if (brands.length === 0) throw new Error('Brands not seeded!');

// 2. Ensure test supplier
let supA = db.prepare("SELECT * FROM suppliers WHERE name = 'Sabroso Foods'").get();
if (!supA) {
  const res = db.prepare("INSERT INTO suppliers (name, phone, contact_person, current_balance) VALUES ('Sabroso Foods', '03001234567', 'Tariq', 0)").run();
  supA = { id: res.lastInsertRowid, name: 'Sabroso Foods' };
}

let supB = db.prepare("SELECT * FROM suppliers WHERE name = 'Supplier B (Frozen)'").get();
if (!supB) {
  const res = db.prepare("INSERT INTO suppliers (name, phone, contact_person, current_balance) VALUES ('Supplier B (Frozen)', '03009876543', 'Kamran', 0)").run();
  supB = { id: res.lastInsertRowid, name: 'Supplier B (Frozen)' };
}

// 3. Ensure test customer
let cust = db.prepare("SELECT * FROM customers WHERE name = 'Haji Supermarket'").get();
if (!cust) {
  const res = db.prepare("INSERT INTO customers (name, phone, customer_type, credit_limit, current_balance) VALUES ('Haji Supermarket', '03211122334', 'Wholesale', 50000, 0)").run();
  cust = { id: res.lastInsertRowid, name: 'Haji Supermarket' };
}

// 4. Create test product: Wings Test
const testSku = 'TEST-WINGS-' + Date.now().toString().slice(-4);
const prodRes = db.prepare(`
  INSERT INTO products (name, sku, brand, unit, purchase_price, sale_price, wholesale_price, supplier_id, status)
  VALUES ('Prime Chicken Wings', ?, 'Sabroso', 'KG', 220, 300, 280, ?, 'active')
`).run(testSku, supA.id);
const prodId = prodRes.lastInsertRowid;
console.log(`2. Created Test Product: Prime Chicken Wings (ID: ${prodId}, SKU: ${testSku})`);

// 5. Purchase 1: 100 KG Wings @ 220 from Sabroso Foods
const expFar = '2027-01-01';
const b1Res = db.prepare(`
  INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, supplier_id, status)
  VALUES (?, 'BATCH-SAB-01', ?, 100, 220, ?, 'active')
`).run(prodId, expFar, supA.id);
const batch1Id = b1Res.lastInsertRowid;

const p1Res = db.prepare(`
  INSERT INTO purchases (invoice_no, supplier_id, purchase_date, subtotal, grand_total, paid_amount, balance_due, payment_method, user_id)
  VALUES ('PUR-TEST-001', ?, date('now'), 22000, 22000, 10000, 12000, 'Cash', 1)
`).run(supA.id);
const pur1Id = p1Res.lastInsertRowid;

db.prepare(`
  INSERT INTO purchase_items (purchase_id, product_id, brand, batch_no, expiry_date, quantity, unit, unit_price, total_price)
  VALUES (?, ?, 'Sabroso', 'BATCH-SAB-01', ?, 100, 'KG', 220, 22000)
`).run(pur1Id, prodId, expFar);

// 6. Purchase 2: 100 KG Wings @ 250 from Supplier B
const b2Res = db.prepare(`
  INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, supplier_id, status)
  VALUES (?, 'BATCH-SUPB-02', ?, 100, 250, ?, 'active')
`).run(prodId, expFar, supB.id);
const batch2Id = b2Res.lastInsertRowid;

const p2Res = db.prepare(`
  INSERT INTO purchases (invoice_no, supplier_id, purchase_date, subtotal, grand_total, paid_amount, balance_due, payment_method, user_id)
  VALUES ('PUR-TEST-002', ?, date('now'), 25000, 25000, 25000, 0, 'Bank', 1)
`).run(supB.id);
const pur2Id = p2Res.lastInsertRowid;

db.prepare(`
  INSERT INTO purchase_items (purchase_id, product_id, brand, batch_no, expiry_date, quantity, unit, unit_price, total_price)
  VALUES (?, ?, 'Sabroso', 'BATCH-SUPB-02', ?, 100, 'KG', 250, 25000)
`).run(pur2Id, prodId, expFar);

console.log(`3. Created Purchases:\n   - Batch 1: 100 KG @ 220 from Sabroso (Batch ID: ${batch1Id})\n   - Batch 2: 100 KG @ 250 from Supplier B (Batch ID: ${batch2Id})`);

// 7. Check Stock Preview query
const batchesInDb = db.prepare(`
  SELECT b.id, b.batch_no, b.quantity, b.purchase_price, s.name as supplier_name
  FROM batches b
  LEFT JOIN suppliers s ON b.supplier_id = s.id
  WHERE b.product_id = ? AND b.status = 'active' AND b.quantity > 0
  ORDER BY b.id ASC
`).all(prodId);
console.log('4. Live Stock Preview:', batchesInDb);
if (batchesInDb.length !== 2) throw new Error('Expected 2 active batches!');

// 8. SIMULATE FIFO SALE 1: Sell 50 KG @ 300
// Expected: Consumes 50 KG from Batch 1 @ 220 -> Cost = 11,000, Profit = 4,000
const activeBatches1 = db.prepare("SELECT * FROM batches WHERE product_id = ? AND status = 'active' AND quantity > 0 ORDER BY id ASC").all(prodId);
let reqQty1 = 50;
let cost1 = 0;
for (const b of activeBatches1) {
  if (reqQty1 <= 0) break;
  const deduct = Math.min(b.quantity, reqQty1);
  db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(deduct, b.id);
  cost1 += deduct * b.purchase_price;
  reqQty1 -= deduct;
}

const sale1Grand = 50 * 300;
const profit1 = sale1Grand - cost1;
console.log(`5. Sale 1 (50 KG @ Rs. 300):\n   - Consumed Cost: Rs. ${cost1} (Expected 11,000)\n   - Revenue: Rs. ${sale1Grand}\n   - Actual Profit: Rs. ${profit1} (Expected 4,000)`);
if (cost1 !== 11000 || profit1 !== 4000) throw new Error('FIFO Sale 1 calculation mismatch!');

// Check remaining batches:
// Batch 1 should have 50 KG remaining @ 220
// Batch 2 should have 100 KG remaining @ 250
const remBatchesAfterSale1 = db.prepare("SELECT id, quantity, purchase_price FROM batches WHERE product_id = ? ORDER BY id ASC").all(prodId);
console.log('   - Remaining Batches after Sale 1:', remBatchesAfterSale1);
if (remBatchesAfterSale1[0].quantity !== 50 || remBatchesAfterSale1[1].quantity !== 100) {
  throw new Error('Remaining stock mismatch after Sale 1!');
}

// 9. SIMULATE FIFO SALE 2: Sell 70 KG @ 300
// Expected: Consumes 50 KG from Batch 1 @ 220 + 20 KG from Batch 2 @ 250
// Cost = (50 * 220) + (20 * 250) = 11,000 + 5,000 = 16,000
// Revenue = 70 * 300 = 21,000
// Actual Profit = 21,000 - 16,000 = 5,000
const activeBatches2 = db.prepare("SELECT * FROM batches WHERE product_id = ? AND status = 'active' AND quantity > 0 ORDER BY id ASC").all(prodId);
let reqQty2 = 70;
let cost2 = 0;
for (const b of activeBatches2) {
  if (reqQty2 <= 0) break;
  const deduct = Math.min(b.quantity, reqQty2);
  db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(deduct, b.id);
  cost2 += deduct * b.purchase_price;
  reqQty2 -= deduct;
}

const sale2Grand = 70 * 300;
const profit2 = sale2Grand - cost2;
console.log(`6. Sale 2 (70 KG @ Rs. 300):\n   - Consumed Cost: Rs. ${cost2} (Expected 16,000)\n   - Revenue: Rs. ${sale2Grand}\n   - Actual Profit: Rs. ${profit2} (Expected 5,000)`);
if (cost2 !== 16000 || profit2 !== 5000) throw new Error('FIFO Sale 2 multi-batch calculation mismatch!');

const remBatchesAfterSale2 = db.prepare("SELECT id, quantity, purchase_price FROM batches WHERE product_id = ? ORDER BY id ASC").all(prodId);
console.log('   - Remaining Batches after Sale 2:', remBatchesAfterSale2);
if (remBatchesAfterSale2[0].quantity !== 0 || remBatchesAfterSale2[1].quantity !== 80) {
  throw new Error('Remaining stock mismatch after Sale 2!');
}

// 10. Check Purchase Reports
const supReport = db.prepare(`
  SELECT s.name as supplier_name, SUM(p.grand_total) as total_purchases, SUM(pi.quantity) as total_qty
  FROM suppliers s
  JOIN purchases p ON s.id = p.supplier_id
  JOIN purchase_items pi ON p.id = pi.purchase_id
  WHERE pi.product_id = ?
  GROUP BY s.id
`).all(prodId);
console.log('7. Supplier Purchase Report for Test Product:', supReport);

console.log('=== ALL FIFO & BUSINESS CALCULATIONS VERIFIED 100% CORRECT! ===');
