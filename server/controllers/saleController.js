const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List sales with customer details
exports.getSales = (req, res) => {
  try {
    const { start_date, end_date, customer_id, sale_type, search } = req.query;

    let query = `
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.full_name as user_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ` AND s.sale_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND s.sale_date <= ?`;
      params.push(end_date);
    }
    if (customer_id) {
      query += ` AND s.customer_id = ?`;
      params.push(customer_id);
    }
    if (sale_type) {
      query += ` AND s.sale_type = ?`;
      params.push(sale_type);
    }
    if (search) {
      query += ` AND (s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ` ORDER BY s.id DESC`;
    const sales = db.prepare(query).all(...params);

    return res.json({ success: true, sales });
  } catch (err) {
    console.error('Error fetching sales:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales.' });
  }
};

// Get single sale invoice with items and company settings for printing
exports.getSaleById = (req, res) => {
  try {
    const { id } = req.params;
    const sale = db.prepare(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
        c.current_balance as customer_current_balance, u.full_name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ? OR s.invoice_no = ?
    `).get(id, id);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found.' });
    }

    const items = db.prepare(`
      SELECT si.*, pr.name as product_name, pr.sku
      FROM sale_items si
      JOIN products pr ON si.product_id = pr.id
      WHERE si.sale_id = ?
    `).all(sale.id);

    // Fetch business profile settings for invoice header
    const settingsList = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }

    return res.json({ success: true, sale, items, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch invoice details.' });
  }
};

// Create POS / Sale (Atomic Transaction with FEFO & Strict Negative Stock Check)
exports.createSale = (req, res) => {
  const transaction = db.transaction(() => {
    const {
      customer_id, sale_type, sale_date,
      items, discount, tax, paid_amount, payment_method, notes
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invoice must contain at least one product item.');
    }

    // Check if negative stock is allowed in system settings
    const negSetting = db.prepare("SELECT value FROM settings WHERE key = 'allow_negative_stock'").get();
    const allowNegative = negSetting && negSetting.value === 'true';

    // Calculate subtotal & validate stock
    let subtotal = 0;
    for (const item of items) {
      const qty = Number(item.quantity);
      if (qty <= 0) throw new Error('Item quantity must be greater than 0.');

      const prod = db.prepare('SELECT id, name, sale_price, wholesale_price FROM products WHERE id = ?').get(item.product_id);
      if (!prod) throw new Error(`Product #${item.product_id} not found.`);

      // Check available stock
      const totalAvailable = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(item.product_id).s;

      if (!allowNegative && totalAvailable < qty) {
        throw new Error(`Insufficient stock for "${prod.name}". Available: ${totalAvailable}, Requested: ${qty}. Sale blocked by negative-stock policy.`);
      }

      const fallbackRate = Number(item.unit_price) ?? (sale_type === 'Wholesale' ? prod.wholesale_price : prod.sale_price);
      const rawLineTotal = (item.total_price !== undefined && item.total_price !== null && !isNaN(Number(item.total_price)) && Number(item.total_price) > 0)
        ? Number(item.total_price)
        : (qty * fallbackRate);
      const lineTotal = Math.max(0, rawLineTotal - (Number(item.discount) || 0));
      subtotal += lineTotal;
    }

    const disc = Number(discount) || 0;
    const tx = Number(tax) || 0;
    const grand_total = Math.max(0, subtotal - disc + tx);
    const paid = Number(paid_amount) || 0;
    const balance_due = Math.max(0, grand_total - paid);

    // If credit balance exists, customer is required!
    if (balance_due > 0 && !customer_id) {
      throw new Error('Customer selection is required for credit sales with an unpaid balance.');
    }

    // If customer selected, check credit limit
    if (customer_id && balance_due > 0) {
      const cust = db.prepare('SELECT id, name, credit_limit, current_balance FROM customers WHERE id = ?').get(customer_id);
      if (cust && cust.credit_limit > 0 && (cust.current_balance + balance_due) > cust.credit_limit) {
        throw new Error(`Customer "${cust.name}" credit limit of ₨ ${cust.credit_limit} would be exceeded (Current balance: ₨ ${cust.current_balance}, new balance: ₨ ${cust.current_balance + balance_due}).`);
      }
    }

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    const dateStr = (sale_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const existingInvoices = db.prepare('SELECT invoice_no FROM sales WHERE invoice_no LIKE ?').all(`INV-${dateStr}-%`);
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
    const invoice_no = `INV-${dateStr}-${String(maxSuffix + 1).padStart(4, '0')}`;

    const insertSale = db.prepare(`
      INSERT INTO sales (
        invoice_no, customer_id, sale_type, sale_date,
        subtotal, discount, tax, grand_total, paid_amount, balance_due,
        payment_method, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sRes = insertSale.run(
      invoice_no,
      customer_id || null,
      sale_type || 'Retail',
      sale_date || new Date().toISOString().split('T')[0],
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

    const saleId = sRes.lastInsertRowid;

    // Deduct stock using FEFO (First-Expired, First-Out)
    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, batch_id, batch_no,
        quantity, unit, unit_price, cost_price, discount, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_id, reference_type, reason, user_id
      ) VALUES (?, ?, 'SALE', ?, ?, ?, ?, 'SALE_INVOICE', ?, ?)
    `);

    for (const item of items) {
      let remainingQtyToDeduct = Number(item.quantity);
      const totalItemQty = remainingQtyToDeduct;
      const itemDisc = Number(item.discount) || 0;
      const rawLineTotal = (item.total_price !== undefined && item.total_price !== null && !isNaN(Number(item.total_price)) && Number(item.total_price) > 0)
        ? Number(item.total_price)
        : (remainingQtyToDeduct * Number(item.unit_price));
      const lineTotal = Math.max(0, rawLineTotal - itemDisc);
      const effectiveRate = totalItemQty > 0 ? (rawLineTotal / totalItemQty) : Number(item.unit_price);

      // Find active batches ordered by id ASC (Strict FIFO: First-In, First-Out)
      const batches = db.prepare(`
        SELECT * FROM batches
        WHERE product_id = ? AND status = 'active' AND quantity > 0
        ORDER BY id ASC
      `).all(item.product_id);

      let totalCostForLine = 0;
      const consumedBatches = [];

      if (batches.length > 0) {
        for (const b of batches) {
          if (remainingQtyToDeduct <= 0) break;

          const deduct = Math.min(b.quantity, remainingQtyToDeduct);
          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(deduct, b.id);

          const batchUnitCost = Number(b.purchase_price) || 0;
          totalCostForLine += (deduct * batchUnitCost);

          consumedBatches.push({
            batchId: b.id,
            batchNo: b.batch_no,
            deduct,
            unitCost: batchUnitCost,
            supplierId: b.supplier_id
          });

          remainingQtyToDeduct -= deduct;
        }
      }

      // If quantity still remains (allowed in negative stock mode or zero batch fallback)
      if (remainingQtyToDeduct > 0) {
        const fallbackBatch = db.prepare('SELECT * FROM batches WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(item.product_id);
        const fallbackUnitCost = fallbackBatch ? (Number(fallbackBatch.purchase_price) || 0) : 0;
        totalCostForLine += (remainingQtyToDeduct * fallbackUnitCost);

        if (fallbackBatch) {
          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(remainingQtyToDeduct, fallbackBatch.id);
        }

        consumedBatches.push({
          batchId: fallbackBatch ? fallbackBatch.id : null,
          batchNo: fallbackBatch ? fallbackBatch.batch_no : 'NEGATIVE_STOCK',
          deduct: remainingQtyToDeduct,
          unitCost: fallbackUnitCost,
          supplierId: fallbackBatch ? fallbackBatch.supplier_id : null
        });
      }

      // Insert into sale_items
      const primaryBatchId = consumedBatches[0]?.batchId || null;
      const costPrice = totalItemQty > 0 ? (totalCostForLine / totalItemQty) : 0;
      const batchNotes = consumedBatches.length > 1
        ? consumedBatches.map(c => `${c.batchNo || 'Lot'}: ${c.deduct}@${c.unitCost}`).join(', ')
        : (consumedBatches[0]?.batchNo || null);

      insertSaleItem.run(
        saleId,
        item.product_id,
        primaryBatchId,
        batchNotes,
        totalItemQty,
        item.unit || 'pkt',
        effectiveRate,
        costPrice,
        itemDisc,
        lineTotal
      );

      // Record detailed inventory movement per consumed FIFO batch
      const totalStockAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(item.product_id).s;

      if (consumedBatches.length > 0) {
        for (const c of consumedBatches) {
          insertMovement.run(
            item.product_id,
            c.batchId,
            -c.deduct,
            c.unitCost,
            totalStockAfter,
            saleId,
            `FIFO Sale ${invoice_no} [Batch ${c.batchNo} @ ₨${c.unitCost}]`,
            req.user.id
          );
        }
      } else {
        insertMovement.run(
          item.product_id,
          null,
          -totalItemQty,
          costPrice,
          totalStockAfter,
          saleId,
          `Sale Invoice ${invoice_no}`,
          req.user.id
        );
      }
    }

    // Update Customer Balance if credit remains
    if (customer_id && balance_due > 0) {
      db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?')
        .run(balance_due, customer_id);
    }

    // Record receipt if paid > 0
    if (paid > 0) {
      db.prepare(`
        INSERT INTO payments (
          type, party_type, party_id, reference_id, reference_no,
          amount, payment_method, payment_date, notes, user_id
        ) VALUES ('CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer_id || 1, // 1 is counter walk-in
        saleId,
        invoice_no,
        paid,
        payment_method || 'Cash',
        sale_date || new Date().toISOString().split('T')[0],
        `Receipt for Invoice ${invoice_no}`,
        req.user.id
      );
    }

    logAudit(
      req.user.id,
      req.user.full_name,
      'CREATE',
      'SALE',
      saleId,
      `Sale ${invoice_no}: ₨ ${grand_total} (Paid: ₨ ${paid}, Due: ₨ ${balance_due})`,
      req
    );

    return { id: saleId, invoice_no, grand_total, paid_amount: paid, balance_due };
  });

  try {
    const result = transaction();
    return res.status(201).json({ success: true, message: 'Sale invoice generated successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Sales Return
exports.createSaleReturn = (req, res) => {
  const transaction = db.transaction(() => {
    const { original_sale_id, reason, items } = req.body;

    if (!original_sale_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Original sale invoice and return items are required.');
    }

    const origSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(original_sale_id);
    if (!origSale) {
      throw new Error('Original sale invoice not found.');
    }

    const retNo = `SRET-${Date.now().toString().slice(-7)}`;
    let totalAmount = 0;

    for (const item of items) {
      totalAmount += (Number(item.quantity) * Number(item.unit_price));
    }

    const retRes = db.prepare(`
      INSERT INTO returns (return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id)
      VALUES (?, 'SALE_RETURN', ?, ?, ?, ?, ?, ?)
    `).run(retNo, origSale.id, origSale.invoice_no, origSale.customer_id, totalAmount, reason || 'Customer Return', req.user.id);

    const returnId = retRes.lastInsertRowid;

    for (const item of items) {
      const qty = Number(item.quantity);
      const rate = Number(item.unit_price);
      const lineTotal = qty * rate;
      const isResellable = (item.condition || 'RESELLABLE') === 'RESELLABLE';

      db.prepare(`
        INSERT INTO return_items (return_id, product_id, batch_id, quantity, unit_price, total_amount, condition)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(returnId, item.product_id, item.batch_id || null, qty, rate, lineTotal, item.condition || 'RESELLABLE');

      // If resellable, increment stock back into batch
      if (isResellable) {
        if (item.batch_id) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(qty, item.batch_id);
        } else {
          // Add back to first active batch or create return lot
          const b = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' LIMIT 1").get(item.product_id);
          if (b) {
            db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(qty, b.id);
          }
        }

        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(item.product_id).s;

        db.prepare(`
          INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
          VALUES (?, ?, 'RETURN', ?, ?, ?, ?, 'SALE_RETURN', ?, ?)
        `).run(item.product_id, item.batch_id || null, qty, rate, totalAfter, returnId, `Sale Return ${retNo} (Resellable)`, req.user.id);
      } else {
        // Record movement as 0 delta or damaged note
        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(item.product_id).s;
        db.prepare(`
          INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
          VALUES (?, ?, 'RETURN', 0, ?, ?, ?, 'SALE_RETURN_DAMAGED', ?, ?)
        `).run(item.product_id, item.batch_id || null, rate, totalAfter, returnId, `Sale Return ${retNo} (Non-resellable / Damaged: ${item.condition})`, req.user.id);
      }
    }

    // Adjust customer balance if registered customer
    if (origSale.customer_id && totalAmount > 0) {
      // Reduce the customer's outstanding balance by the return amount
      db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ?')
        .run(totalAmount, origSale.customer_id);
    }

    // Update the original sale's financial state
    const newPaidAmount = Math.max(0, origSale.paid_amount - totalAmount);
    const newBalanceDue = Math.max(0, origSale.grand_total - newPaidAmount);
    db.prepare('UPDATE sales SET paid_amount = ?, balance_due = ?, notes = COALESCE(notes || ?, ?) WHERE id = ?')
      .run(newPaidAmount, newBalanceDue, ' | ', `Return ${retNo} for ₨${totalAmount}`, origSale.id);

    // If payment was made originally, record a reversal payment (refund)
    if (totalAmount > 0 && origSale.paid_amount > 0) {
      const refundAmount = Math.min(totalAmount, origSale.paid_amount);
      db.prepare(`
        INSERT INTO payments (
          type, party_type, party_id, reference_id, reference_no,
          amount, payment_method, payment_date, notes, user_id
        ) VALUES ('CUSTOMER_REFUND', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        origSale.customer_id || 1,
        origSale.id,
        retNo,
        refundAmount,
        origSale.payment_method || 'Cash',
        origSale.sale_date,
        `Refund for return ${retNo} against ${origSale.invoice_no}`,
        req.user.id
      );
    }

    logAudit(req.user.id, req.user.full_name, 'RETURN', 'SALE', returnId, `Sale return ${retNo} for ₨ ${totalAmount} against invoice ${origSale.invoice_no}`, req);

    return { return_no: retNo, total_amount: totalAmount };
  });

  try {
    const result = transaction();
    return res.status(201).json({ success: true, message: 'Sale return processed successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete Sale (Admin only) - Full reversal: stock, payments, customer balance
exports.deleteSale = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) throw new Error('Sale invoice not found.');

    // 1. Reverse stock: Add back quantities to batches (FIFO reversal)
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_id, reference_type, reason, user_id
      ) VALUES (?, ?, 'STOCK_REVERSAL', ?, ?, ?, ?, 'SALE_DELETE', ?, ?)
    `);

    for (const item of saleItems) {
      if (item.batch_id) {
        db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?')
          .run(item.quantity, item.batch_id);
      } else {
        const fallbackBatch = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' LIMIT 1").get(item.product_id);
        if (fallbackBatch) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?')
            .run(item.quantity, fallbackBatch.id);
        }
      }

      const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(item.product_id).s;
      insertMovement.run(
        item.product_id, item.batch_id, item.quantity, item.cost_price || item.unit_price,
        totalAfter, sale.id, `Deleted sale ${sale.invoice_no} - ${reason || 'Admin reversal'}`, req.user.id
      );
    }

    // 2. Reverse customer balance (if credit sale)
    if (sale.customer_id && sale.balance_due > 0) {
      db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ?')
        .run(sale.balance_due, sale.customer_id);
    }

    // 3. Delete payment records
    db.prepare("DELETE FROM payments WHERE reference_id = ? AND reference_no = ?").run(sale.id, sale.invoice_no);

    // 4. Delete sale items and sale
    db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sale.id);
    db.prepare('DELETE FROM sales WHERE id = ?').run(sale.id);

    logAudit(
      req.user.id, req.user.full_name, 'DELETE', 'SALE', sale.id,
      `Deleted sale ${sale.invoice_no} for ₨ ${sale.grand_total} - ${reason || 'Admin reversal'}`, req
    );

    return { success: true, message: `Sale ${sale.invoice_no} deleted and stock reversed.` };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
