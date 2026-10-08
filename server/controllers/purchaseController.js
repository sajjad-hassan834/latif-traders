const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List purchases with supplier info
exports.getPurchases = (req, res) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;

    let query = `
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, u.full_name as user_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM returns WHERE original_invoice_id = p.id) as returned_amount
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ` AND p.purchase_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND p.purchase_date <= ?`;
      params.push(end_date);
    }
    if (supplier_id) {
      query += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }

    query += ` ORDER BY p.id DESC`;
    const purchases = db.prepare(query).all(...params);

    return res.json({ success: true, purchases });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch purchases.' });
  }
};

// Get single purchase invoice with line items
exports.getPurchaseById = (req, res) => {
  try {
    const { id } = req.params;
    const purchase = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.address as supplier_address,
        u.full_name as user_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(id);

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });
    }

    const items = db.prepare(`
      SELECT pi.*, pr.name as product_name, pr.sku
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = ?
    `).all(id);

    return res.json({ success: true, purchase, items });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch purchase invoice.' });
  }
};

// Create Purchase (Atomic Transaction)
exports.createPurchase = (req, res) => {
  const transaction = db.transaction(() => {
    const {
      supplier_id, supplier_invoice_no, purchase_date,
      items, discount, tax, paid_amount, payment_method, notes
    } = req.body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Supplier and at least one item are required.');
    }

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
    if (!supplier) {
      throw new Error('Supplier not found.');
    }

    // Generate unique internal purchase invoice number: PUR-YYYYMMDD-XXXX
    const dateStr = (purchase_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const existingInvoices = db.prepare('SELECT invoice_no FROM purchases WHERE invoice_no LIKE ?').all(`PUR-${dateStr}-%`);
    let maxSuffix = 0;
    for (const inv of existingInvoices) {
      const parts = inv.invoice_no.split('-');
      if (parts.length === 3) {
        const suffix = parseInt(parts[2], 10);
        if (!isNaN(suffix) && suffix > maxSuffix) {
          maxSuffix = suffix;
        }
      }
    }
    const finalInvoice = `PUR-${dateStr}-${String(maxSuffix + 1).padStart(4, '0')}`;

    let subtotal = 0;
    for (const item of items) {
      const lineTotal = (Number(item.quantity) * Number(item.unit_price)) - (Number(item.discount) || 0);
      subtotal += lineTotal;
    }

    const disc = Number(discount) || 0;
    const tx = Number(tax) || 0;
    const grand_total = Math.max(0, subtotal - disc + tx);
    const paid = Number(paid_amount) || 0;
    const balance_due = Math.max(0, grand_total - paid);

    const insertPurchase = db.prepare(`
      INSERT INTO purchases (
        invoice_no, supplier_invoice_no, supplier_id, purchase_date,
        subtotal, discount, tax, grand_total, paid_amount, balance_due,
        payment_method, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const pRes = insertPurchase.run(
      finalInvoice,
      supplier_invoice_no ? supplier_invoice_no.trim() : null,
      supplier_id,
      purchase_date || new Date().toISOString().split('T')[0],
      subtotal,
      disc,
      tx,
      grand_total,
      paid,
      balance_due,
      payment_method || 'Cash',
      notes ? notes.trim() : null,
      req.user.id
    );

    const purchaseId = pRes.lastInsertRowid;

    // Process line items & stock additions
    const insertItem = db.prepare(`
      INSERT INTO purchase_items (
        purchase_id, product_id, brand, batch_no, expiry_date,
        quantity, unit, unit_price, discount, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_id, reference_type, reason, user_id
      ) VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?, 'PURCHASE_INVOICE', ?, ?)
    `);

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const qty = Number(item.quantity);
      const rate = Number(item.unit_price);
      const lineTotal = (qty * rate) - (Number(item.discount) || 0);

      // Fetch product to resolve brand if not explicitly provided
      const prodInfo = db.prepare('SELECT brand, supplier_id FROM products WHERE id = ?').get(item.product_id);
      const itemBrand = item.brand ? item.brand.trim() : (prodInfo?.brand || null);

      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const itemBatchNo = (item.batch_no && item.batch_no.trim())
        ? item.batch_no.trim()
        : `LOT-${yy}${mm}-${Date.now().toString().slice(-4)}${idx > 0 ? '-' + (idx + 1) : ''}`;

      insertItem.run(
        purchaseId,
        item.product_id,
        itemBrand,
        itemBatchNo,
        item.expiry_date || null,
        qty,
        item.unit || 'pkt',
        rate,
        Number(item.discount) || 0,
        lineTotal
      );

      // Retrieve product to obtain current selling prices if not provided on invoice
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      const batchSalePrice = item.sale_price !== undefined && item.sale_price !== '' && Number(item.sale_price) > 0
        ? Number(item.sale_price)
        : (prod?.sale_price || 0);
      const batchWholesalePrice = item.wholesale_price !== undefined && item.wholesale_price !== '' && Number(item.wholesale_price) > 0
        ? Number(item.wholesale_price)
        : (prod?.wholesale_price || batchSalePrice);

      // Create distinct batch with explicit supplier_id for true FIFO tracking
      let batchId = null;
      const existingBatch = db.prepare(`
        SELECT * FROM batches
        WHERE product_id = ? AND batch_no = ? AND supplier_id = ? AND status = 'active'
      `).get(item.product_id, itemBatchNo, supplier_id);

      if (existingBatch) {
        db.prepare('UPDATE batches SET quantity = quantity + ?, purchase_price = ? WHERE id = ?')
          .run(qty, rate, existingBatch.id);
        batchId = existingBatch.id;
      } else {
        const exp = item.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
        const bRes = db.prepare(`
          INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location, supplier_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(item.product_id, itemBatchNo, exp, qty, rate, batchSalePrice, batchWholesalePrice, item.storage_location || null, supplier_id);
        batchId = bRes.lastInsertRowid;
      }

      // Update product's latest purchase price, sale/wholesale prices, and default supplier
      db.prepare(`
        UPDATE products SET
          purchase_price = ?,
          sale_price = CASE WHEN ? > 0 THEN ? ELSE sale_price END,
          wholesale_price = CASE WHEN ? > 0 THEN ? ELSE wholesale_price END,
          supplier_id = COALESCE(supplier_id, ?),
          brand = COALESCE(brand, ?),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(rate, batchSalePrice, batchSalePrice, batchWholesalePrice, batchWholesalePrice, supplier_id, itemBrand, item.product_id);

      // Calculate total stock after
      const newTotal = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'")
        .get(item.product_id).s;

      insertMovement.run(
        item.product_id,
        batchId,
        qty,
        rate,
        newTotal,
        purchaseId,
        `Purchase Invoice ${finalInvoice} (${supplier.name})`,
        req.user.id
      );
    }

    // Update Supplier Balance: Increase by unpaid balance_due
    db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?')
      .run(balance_due, supplier_id);



    logAudit(
      req.user.id,
      req.user.full_name,
      'CREATE',
      'PURCHASE',
      purchaseId,
      `Created purchase ${finalInvoice} from supplier ${supplier.name} for ₨ ${grand_total} (Paid: ₨ ${paid})`,
      req
    );

    return { id: purchaseId, invoice_no: finalInvoice, grand_total, balance_due };
  });

  try {
    const result = transaction();
    return res.status(201).json({ success: true, message: 'Purchase invoice saved successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Purchase Return
exports.createPurchaseReturn = (req, res) => {
  const transaction = db.transaction(() => {
    const { original_purchase_id, reason, items } = req.body;

    if (!original_purchase_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Original purchase ID and return items are required.');
    }

    const origPurchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(original_purchase_id);
    if (!origPurchase) {
      throw new Error('Original purchase not found.');
    }

    const retNo = `PRET-${Date.now().toString().slice(-7)}`;
    let totalAmount = 0;

    for (const item of items) {
      totalAmount += (Number(item.quantity) * Number(item.unit_price));
    }

    const retRes = db.prepare(`
      INSERT INTO returns (return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id)
      VALUES (?, 'PURCHASE_RETURN', ?, ?, ?, ?, ?, ?)
    `).run(retNo, origPurchase.id, origPurchase.invoice_no, origPurchase.supplier_id, totalAmount, reason || 'Return to supplier', req.user.id);

    const returnId = retRes.lastInsertRowid;

    for (const item of items) {
      const qty = Number(item.quantity);
      const rate = Number(item.unit_price);
      const lineTotal = qty * rate;

      db.prepare(`
        INSERT INTO return_items (return_id, product_id, batch_id, quantity, unit_price, total_amount, condition)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(returnId, item.product_id, item.batch_id || null, qty, rate, lineTotal, item.condition || 'RESELLABLE');

      // Reduce batch quantity
      if (item.batch_id) {
        db.prepare('UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(qty, item.batch_id);
      } else {
        // Reduce from earliest active batch
        const b = db.prepare("SELECT id, quantity FROM batches WHERE product_id = ? AND status = 'active' AND quantity > 0 ORDER BY expiry_date ASC LIMIT 1").get(item.product_id);
        if (b) {
          db.prepare('UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(qty, b.id);
        }
      }

      const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(item.product_id).s;

      db.prepare(`
        INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
        VALUES (?, ?, 'RETURN', ?, ?, ?, ?, 'PURCHASE_RETURN', ?, ?)
      `).run(item.product_id, item.batch_id || null, -qty, rate, totalAfter, returnId, `Purchase return ${retNo}`, req.user.id);
    }

    // Reduce supplier balance
    db.prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?').run(totalAmount, origPurchase.supplier_id);

    logAudit(req.user.id, req.user.full_name, 'RETURN', 'PURCHASE', returnId, `Created purchase return ${retNo} for ₨ ${totalAmount}`, req);

    return { return_no: retNo, total_amount: totalAmount };
  });

  try {
    const result = transaction();
    return res.status(201).json({ success: true, message: 'Purchase return processed successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete Purchase (reverses all batch, inventory, and supplier balance effects)
exports.deletePurchase = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;

    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    if (!purchase) throw new Error('Purchase invoice not found.');

    const hasReturns = db.prepare('SELECT COUNT(*) as count FROM returns WHERE original_invoice_id = ?').get(id).count;
    if (hasReturns > 0) {
      throw new Error('Cannot delete a purchase that has return records. Delete the returns first or contact admin.');
    }

    const hasSales = db.prepare(`
      SELECT COUNT(*) as count FROM inventory_movements
      WHERE reference_type = 'PURCHASE_INVOICE' AND reference_id = ? AND type = 'PURCHASE'
    `).get(id).count;

    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);

    for (const item of items) {
      const batch = db.prepare(`
        SELECT * FROM batches WHERE product_id = ? AND batch_no = ? AND supplier_id = ?
      `).get(item.product_id, item.batch_no, purchase.supplier_id);

      if (batch) {
        const newQty = batch.quantity - item.quantity;
        if (newQty <= 0) {
          db.prepare("UPDATE batches SET quantity = 0, status = 'expired' WHERE id = ?").run(batch.id);
        } else {
          db.prepare('UPDATE batches SET quantity = ? WHERE id = ?').run(newQty, batch.id);
        }
      }
    }

    db.prepare("DELETE FROM inventory_movements WHERE reference_id = ? AND reference_type = 'PURCHASE_INVOICE'").run(id);

    if (purchase.balance_due > 0) {
      db.prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?')
        .run(purchase.balance_due, purchase.supplier_id);
    }

    if (purchase.paid_amount > 0) {
      db.prepare("DELETE FROM payments WHERE reference_id = ? AND party_type = 'SUPPLIER' AND party_id = ?")
        .run(id, purchase.supplier_id);
    }

    db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
    db.prepare('DELETE FROM purchases WHERE id = ?').run(id);

    logAudit(req.user.id, req.user.full_name, 'DELETE', 'PURCHASE', id, `Deleted purchase ${purchase.invoice_no} (₨ ${purchase.grand_total})`, req);
    return { success: true, message: `Purchase ${purchase.invoice_no} deleted successfully.` };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update Purchase (edit header fields: supplier, date, paid amount, payment method, notes)
exports.updatePurchase = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const { supplier_id, supplier_invoice_no, purchase_date, paid_amount, payment_method, notes } = req.body;

    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    if (!purchase) throw new Error('Purchase invoice not found.');

    const hasReturns = db.prepare('SELECT COUNT(*) as count FROM returns WHERE original_invoice_id = ?').get(id).count;
    if (hasReturns > 0) {
      throw new Error('Cannot edit a purchase that has return records. Delete the returns first.');
    }

    const newSupplierId = supplier_id ? Number(supplier_id) : purchase.supplier_id;
    const newPaid = paid_amount !== undefined && paid_amount !== '' ? Math.max(0, Number(paid_amount)) : purchase.paid_amount;
    const newBalance = Math.max(0, purchase.grand_total - newPaid);

    const oldBalanceDue = purchase.balance_due;
    const oldSupplierId = purchase.supplier_id;

    if (newSupplierId !== oldSupplierId) {
      if (oldBalanceDue > 0) {
        db.prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?').run(oldBalanceDue, oldSupplierId);
      }
      if (newBalance > 0) {
        db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?').run(newBalance, newSupplierId);
      }

      for (const item of (db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id))) {
        db.prepare('UPDATE batches SET supplier_id = ? WHERE product_id = ? AND batch_no = ? AND supplier_id = ?')
          .run(newSupplierId, item.product_id, item.batch_no, oldSupplierId);
      }
    } else {
      const balanceDiff = newBalance - oldBalanceDue;
      if (balanceDiff !== 0) {
        db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?').run(balanceDiff, newSupplierId);
      }
    }

    if (purchase.paid_amount !== newPaid) {
      db.prepare("DELETE FROM payments WHERE reference_id = ? AND party_type = 'SUPPLIER' AND party_id = ?")
        .run(id, oldSupplierId);

      if (newPaid > 0) {
        db.prepare(`
          INSERT INTO payments (type, party_type, party_id, reference_id, reference_no, amount, payment_method, payment_date, notes, user_id)
          VALUES ('SUPPLIER_PAYMENT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newSupplierId, id, purchase.invoice_no, newPaid,
          payment_method || purchase.payment_method,
          purchase_date || purchase.purchase_date,
          'Payment recorded with purchase edit',
          req.user.id
        );
      }
    }

    db.prepare(`
      UPDATE purchases SET
        supplier_id = ?, supplier_invoice_no = ?, purchase_date = ?,
        paid_amount = ?, balance_due = ?,
        payment_method = ?, notes = ?
      WHERE id = ?
    `).run(
      newSupplierId,
      supplier_invoice_no !== undefined ? (supplier_invoice_no || null) : purchase.supplier_invoice_no,
      purchase_date || purchase.purchase_date,
      newPaid,
      newBalance,
      payment_method || purchase.payment_method,
      notes !== undefined ? (notes || null) : purchase.notes,
      id
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'PURCHASE', id, `Updated purchase ${purchase.invoice_no}`, req);
    return { success: true, message: 'Purchase updated successfully.' };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Preview existing stock & active batches with vendor history for a product
exports.getProductStockPreview = (req, res) => {
  try {
    const { productId } = req.params;
    const product = db.prepare(`
      SELECT p.id, p.name, p.sku, p.brand, p.unit, p.purchase_price, p.sale_price, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const batches = db.prepare(`
      SELECT b.id, b.batch_no, b.quantity, b.purchase_price, b.sale_price, b.wholesale_price, b.expiry_date, b.created_at,
        COALESCE(s.name, 'Initial Opening') as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = ? AND b.status = 'active' AND b.quantity > 0
      ORDER BY b.id ASC
    `).all(productId);

    const current_stock = batches.reduce((sum, b) => sum + Number(b.quantity), 0);

    return res.json({
      success: true,
      product,
      current_stock,
      batches
    });
  } catch (err) {
    console.error('Error fetching stock preview:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stock preview.' });
  }
};

