const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List sales with customer details, order statuses, product summaries, and statistics
exports.getSales = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { start_date, end_date, customer_id, sale_type, search, order_status, payment_status, payment_method } = req.query;

    let query = `
      SELECT s.*, 
        COALESCE(s.order_status, 'Completed') as order_status,
        c.name as customer_name, c.phone as customer_phone, u.full_name as user_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id AND si.tenant_id = s.tenant_id) as item_count,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si WHERE si.sale_id = s.id AND si.tenant_id = s.tenant_id) as total_qty,
        (SELECT GROUP_CONCAT(pr.name, ', ') FROM (SELECT DISTINCT si.product_id, pr.name FROM sale_items si JOIN products pr ON si.product_id = pr.id WHERE si.sale_id = s.id AND si.tenant_id = s.tenant_id LIMIT 3) pr) as product_summary,
        CASE 
          WHEN s.balance_due <= 0 THEN 'Paid' 
          WHEN s.paid_amount > 0 AND s.balance_due > 0 THEN 'Partially Paid' 
          ELSE 'Unpaid' 
        END as calculated_payment_status
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id AND c.tenant_id = s.tenant_id
      LEFT JOIN users u ON s.user_id = u.id AND u.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
    `;
    const params = [tenantId];

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
    if (payment_method && payment_method !== 'all') {
      query += ` AND s.payment_method = ?`;
      params.push(payment_method);
    }
    if (order_status && order_status !== 'all') {
      query += ` AND LOWER(COALESCE(s.order_status, 'Completed')) = LOWER(?)`;
      params.push(order_status);
    }
    if (payment_status && payment_status !== 'all') {
      if (payment_status === 'Paid') {
        query += ` AND s.balance_due <= 0`;
      } else if (payment_status === 'Partially Paid') {
        query += ` AND s.paid_amount > 0 AND s.balance_due > 0`;
      } else if (payment_status === 'Unpaid') {
        query += ` AND s.paid_amount <= 0 AND s.balance_due > 0`;
      }
    }
    if (search) {
      query += ` AND (
        s.invoice_no LIKE ? 
        OR c.name LIKE ? 
        OR c.phone LIKE ?
        OR EXISTS (
          SELECT 1 FROM sale_items si 
          JOIN products pr ON si.product_id = pr.id 
          WHERE si.sale_id = s.id AND si.tenant_id = s.tenant_id AND pr.name LIKE ?
        )
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY s.id DESC`;
    const sales = db.prepare(query).all(...params);

    // Compute dynamic summary metrics respecting current date range/filters
    const totalOrders = sales.length;
    let newOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;
    let totalBalanceDue = 0;

    for (const sale of sales) {
      const st = (sale.order_status || 'Completed').toLowerCase();
      if (st === 'new') newOrders++;
      else if (st === 'completed' || st === 'delivered') completedOrders++;
      else if (st === 'cancelled') cancelledOrders++;

      totalRevenue += Number(sale.grand_total) || 0;
      totalBalanceDue += Number(sale.balance_due) || 0;
    }

    const stats = {
      total_orders: totalOrders,
      new_orders: newOrders,
      completed_orders: completedOrders,
      cancelled_orders: cancelledOrders,
      total_revenue: totalRevenue,
      total_balance_due: totalBalanceDue
    };

    return res.json({ success: true, sales, stats });
  } catch (err) {
    console.error('Error fetching sales:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales.' });
  }
};

// Get single sale invoice with items and company settings for printing
exports.getSaleById = (req, res) => {
  try {
    const tenantId = req.tenant_id || 'latif_001';
    const { id } = req.params;
    const sale = db.prepare(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
        c.current_balance as customer_current_balance, u.full_name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id AND c.tenant_id = s.tenant_id
      LEFT JOIN users u ON s.user_id = u.id AND u.tenant_id = s.tenant_id
      WHERE (s.id = ? OR s.invoice_no = ?) AND s.tenant_id = ?
    `).get(id, id, tenantId);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found.' });
    }

    const items = db.prepare(`
      SELECT si.*, pr.name as product_name, pr.sku, pr.brand as brand_name, sup.name as supplier_name
      FROM sale_items si
      JOIN products pr ON si.product_id = pr.id
      LEFT JOIN suppliers sup ON pr.supplier_id = sup.id
      WHERE si.sale_id = ? AND si.tenant_id = ?
    `).all(sale.id, tenantId);

    // Fetch business profile settings for invoice header
    const settingsList = db.prepare('SELECT key, value FROM tenant_settings WHERE tenant_id = ?').all(tenantId);
    const settings = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }

    // Tenant info
    const tenant = db.prepare('SELECT business_name, email, phone, address, logo_url FROM tenants WHERE id = ?').get(tenantId);
    if (tenant) {
      if (!settings.company_name) settings.company_name = tenant.business_name;
      if (!settings.company_phone) settings.company_phone = tenant.phone;
      if (!settings.company_email) settings.company_email = tenant.email;
      if (!settings.company_address) settings.company_address = tenant.address;
    }

    return res.json({ success: true, sale, items, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch invoice details.' });
  }
};

// Create POS / Sale (Atomic Transaction with FEFO & Strict Negative Stock Check)
exports.createSale = (req, res) => {
  const transaction = db.transaction(() => {
    const tenantId = req.tenant_id || 'latif_001';
    const tenantPlan = req.tenant?.plan || 'free';

    // Plan limit enforcement: Free plan max 100 invoices/month
    if (tenantPlan === 'free') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const invoiceCount = db.prepare(`
        SELECT COUNT(*) as count FROM sales 
        WHERE tenant_id = ? AND sale_date LIKE ?
      `).get(tenantId, `${currentMonth}%`).count;

      if (invoiceCount >= 100) {
        throw new Error("You have reached the Free Plan limit of 100 invoices this month. Please upgrade to Pro for unlimited invoices.");
      }
    }

    const {
      customer_id, sale_type, sale_date,
      items, discount, tax, paid_amount, payment_method, notes
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invoice must contain at least one product item.');
    }

    // Check if negative stock is allowed in tenant settings
    const negSetting = db.prepare("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'allow_negative_stock'").get(tenantId);
    const allowNegative = negSetting && negSetting.value === 'true';

    // Calculate subtotal & validate stock
    let subtotal = 0;
    for (const item of items) {
      const qty = Number(item.quantity);
      if (qty <= 0) throw new Error('Item quantity must be greater than 0.');

      const prod = db.prepare('SELECT id, name, sale_price, wholesale_price FROM products WHERE id = ? AND tenant_id = ?').get(item.product_id, tenantId);
      if (!prod) throw new Error(`Product #${item.product_id} not found.`);

      // Check available stock
      const totalAvailable = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;

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
      const cust = db.prepare('SELECT id, name, credit_limit, current_balance FROM customers WHERE id = ? AND tenant_id = ?').get(customer_id, tenantId);
      if (cust && cust.credit_limit > 0 && (cust.current_balance + balance_due) > cust.credit_limit) {
        throw new Error(`Customer "${cust.name}" credit limit of ₨ ${cust.credit_limit} would be exceeded (Current balance: ₨ ${cust.current_balance}, new balance: ₨ ${cust.current_balance + balance_due}).`);
      }
    }

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    const dateStr = (sale_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const existingInvoices = db.prepare('SELECT invoice_no FROM sales WHERE invoice_no LIKE ? AND tenant_id = ?').all(`INV-${dateStr}-%`, tenantId);
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
        tenant_id, invoice_no, customer_id, sale_type, sale_date,
        subtotal, discount, tax, grand_total, paid_amount, balance_due,
        payment_method, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sRes = insertSale.run(
      tenantId,
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

    // Deduct stock using FIFO
    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (
        tenant_id, sale_id, product_id, batch_id, batch_no,
        quantity, unit, unit_price, cost_price, discount, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_id, reference_type, reason, user_id
      ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, 'SALE_INVOICE', ?, ?)
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

      // Find active batches ordered by id ASC (Strict FIFO)
      const batches = db.prepare(`
        SELECT * FROM batches
        WHERE product_id = ? AND status = 'active' AND quantity > 0 AND tenant_id = ?
        ORDER BY id ASC
      `).all(item.product_id, tenantId);

      let totalCostForLine = 0;
      const consumedBatches = [];

      if (batches.length > 0) {
        for (const b of batches) {
          if (remainingQtyToDeduct <= 0) break;

          const deduct = Math.min(b.quantity, remainingQtyToDeduct);
          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?').run(deduct, b.id, tenantId);

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
        const fallbackBatch = db.prepare('SELECT * FROM batches WHERE product_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1').get(item.product_id, tenantId);
        const fallbackUnitCost = fallbackBatch ? (Number(fallbackBatch.purchase_price) || 0) : 0;
        totalCostForLine += (remainingQtyToDeduct * fallbackUnitCost);

        if (fallbackBatch) {
          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?').run(remainingQtyToDeduct, fallbackBatch.id, tenantId);
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
        tenantId,
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
      const totalStockAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;

      if (consumedBatches.length > 0) {
        for (const c of consumedBatches) {
          insertMovement.run(
            tenantId,
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
          tenantId,
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

    // Update Customer Balance
    if (customer_id && Number(customer_id) > 1) {
      const netBalanceDelta = grand_total - paid;
      if (Math.abs(netBalanceDelta) > 0.001) {
        db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ? AND tenant_id = ?')
          .run(netBalanceDelta, customer_id, tenantId);
      }
    }

    // Record initial payment entry in payments table if paid > 0
    if (paid > 0) {
      db.prepare(`
        INSERT INTO payments (
          tenant_id, type, party_type, party_id, reference_id, reference_no,
          amount, payment_method, payment_date, notes, user_id
        ) VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenantId,
        customer_id || 1,
        saleId,
        invoice_no,
        paid,
        payment_method || 'Cash',
        sale_date || new Date().toISOString().split('T')[0],
        `POS Receipt for invoice #${invoice_no}`,
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
    const tenantId = req.tenant_id || 'latif_001';
    const { original_sale_id, reason, items } = req.body;

    if (!original_sale_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Original sale invoice and return items are required.');
    }

    const origSale = db.prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?').get(original_sale_id, tenantId);
    if (!origSale) {
      throw new Error('Original sale invoice not found.');
    }

    const retNo = `SRET-${Date.now().toString().slice(-7)}`;
    let totalAmount = 0;

    for (const item of items) {
      totalAmount += (Number(item.quantity) * Number(item.unit_price));
    }

    const retRes = db.prepare(`
      INSERT INTO returns (tenant_id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id)
      VALUES (?, ?, 'SALE_RETURN', ?, ?, ?, ?, ?, ?)
    `).run(tenantId, retNo, origSale.id, origSale.invoice_no, origSale.customer_id, totalAmount, reason || 'Customer Return', req.user.id);

    const returnId = retRes.lastInsertRowid;

    for (const item of items) {
      const qty = Number(item.quantity);
      const rate = Number(item.unit_price);
      const lineTotal = qty * rate;
      const isResellable = (item.condition || 'RESELLABLE') === 'RESELLABLE';

      db.prepare(`
        INSERT INTO return_items (tenant_id, return_id, product_id, batch_id, quantity, unit_price, total_amount, condition)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tenantId, returnId, item.product_id, item.batch_id || null, qty, rate, lineTotal, item.condition || 'RESELLABLE');

      // If resellable, increment stock back into batch
      if (isResellable) {
        if (item.batch_id) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(qty, item.batch_id, tenantId);
        } else {
          const b = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1").get(item.product_id, tenantId);
          if (b) {
            db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(qty, b.id, tenantId);
          }
        }

        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;

        db.prepare(`
          INSERT INTO inventory_movements (tenant_id, product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
          VALUES (?, ?, ?, 'RETURN', ?, ?, ?, ?, 'SALE_RETURN', ?, ?)
        `).run(tenantId, item.product_id, item.batch_id || null, qty, rate, totalAfter, returnId, `Sale Return ${retNo} (Resellable)`, req.user.id);
      } else {
        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;
        db.prepare(`
          INSERT INTO inventory_movements (tenant_id, product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
          VALUES (?, ?, ?, 'RETURN', 0, ?, ?, ?, 'SALE_RETURN_DAMAGED', ?, ?)
        `).run(tenantId, item.product_id, item.batch_id || null, rate, totalAfter, returnId, `Sale Return ${retNo} (Non-resellable / Damaged: ${item.condition})`, req.user.id);
      }
    }

    // Adjust customer balance if registered customer
    if (origSale.customer_id && totalAmount > 0) {
      db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ? AND tenant_id = ?')
        .run(totalAmount, origSale.customer_id, tenantId);
    }

    // Update the original sale's financial state
    const newPaidAmount = Math.max(0, origSale.paid_amount - totalAmount);
    const newBalanceDue = Math.max(0, origSale.grand_total - newPaidAmount);
    db.prepare('UPDATE sales SET paid_amount = ?, balance_due = ?, notes = COALESCE(notes || ?, ?) WHERE id = ? AND tenant_id = ?')
      .run(newPaidAmount, newBalanceDue, ' | ', `Return ${retNo} for ₨${totalAmount}`, origSale.id, tenantId);

    // Refund entry if paid originally
    if (totalAmount > 0 && origSale.paid_amount > 0) {
      const refundAmount = Math.min(totalAmount, origSale.paid_amount);
      db.prepare(`
        INSERT INTO payments (
          tenant_id, type, party_type, party_id, reference_id, reference_no,
          amount, payment_method, payment_date, notes, user_id
        ) VALUES (?, 'CUSTOMER_REFUND', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenantId,
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
    const tenantId = req.tenant_id || 'latif_001';
    const { id } = req.params;
    const { reason } = req.body;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!sale) throw new Error('Sale invoice not found.');

    // 1. Reverse stock
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?').all(sale.id, tenantId);
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_id, reference_type, reason, user_id
      ) VALUES (?, ?, ?, 'STOCK_REVERSAL', ?, ?, ?, ?, 'SALE_DELETE', ?, ?)
    `);

    for (const item of saleItems) {
      if (item.batch_id) {
        db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?')
          .run(item.quantity, item.batch_id, tenantId);
      } else {
        const fallbackBatch = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1").get(item.product_id, tenantId);
        if (fallbackBatch) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?')
            .run(item.quantity, fallbackBatch.id, tenantId);
        }
      }

      const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;
      insertMovement.run(
        tenantId, item.product_id, item.batch_id, item.quantity, item.cost_price || item.unit_price,
        totalAfter, sale.id, `Deleted sale ${sale.invoice_no} - ${reason || 'Admin reversal'}`, req.user.id
      );
    }

    // 2. Reverse customer balance
    if (sale.customer_id && sale.balance_due > 0) {
      db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ? AND tenant_id = ?')
        .run(sale.balance_due, sale.customer_id, tenantId);
    }

    // 3. Delete payments
    db.prepare("DELETE FROM payments WHERE reference_id = ? AND reference_no = ? AND tenant_id = ?").run(sale.id, sale.invoice_no, tenantId);

    // 4. Delete sale items and sale
    db.prepare('DELETE FROM sale_items WHERE sale_id = ? AND tenant_id = ?').run(sale.id, tenantId);
    db.prepare('DELETE FROM sales WHERE id = ? AND tenant_id = ?').run(sale.id, tenantId);

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

// Edit / Update Sale Invoice (Admin only)
exports.updateSale = (req, res) => {
  const transaction = db.transaction(() => {
    const tenantId = req.tenant_id || 'latif_001';
    const { id } = req.params;
    const { items, discount, paid_amount, reason } = req.body;

    const oldSale = db.prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!oldSale) throw new Error('Sale invoice not found.');

    const oldSaleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?').all(oldSale.id, tenantId);

    if (!items || !Array.isArray(items)) {
      throw new Error('Valid items list is required.');
    }

    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_id, reference_type, reason, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SALE_EDIT', ?, ?)
    `);

    // Process each item in the payload
    for (const item of items) {
      const oldItem = oldSaleItems.find(o => o.id === item.id || (item.product_id && o.product_id === item.product_id));
      const oldQty = oldItem ? Number(oldItem.quantity) : 0;
      const newQty = Math.max(0, Number(item.quantity) || 0);
      const qtyDelta = newQty - oldQty;

      if (qtyDelta < -0.0001) {
        const returnQty = Math.abs(qtyDelta);
        let batchToUse = oldItem?.batch_id;
        if (batchToUse) {
          const bExists = db.prepare('SELECT id FROM batches WHERE id = ? AND tenant_id = ?').get(batchToUse, tenantId);
          if (!bExists) batchToUse = null;
        }

        if (batchToUse) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(returnQty, batchToUse, tenantId);
        } else {
          const activeBatch = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? ORDER BY id ASC LIMIT 1").get(item.product_id, tenantId)
            || db.prepare("SELECT id FROM batches WHERE product_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1").get(item.product_id, tenantId);
          if (activeBatch) {
            batchToUse = activeBatch.id;
            db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(returnQty, activeBatch.id, tenantId);
          }
        }

        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;
        insertMovement.run(
          tenantId,
          item.product_id,
          batchToUse || null,
          'RETURN',
          returnQty,
          item.unit_price,
          totalAfter,
          oldSale.id,
          `Sale ${oldSale.invoice_no} edited: reduced qty ${oldQty} -> ${newQty}${reason ? ` (${reason})` : ''}`,
          req.user.id
        );
      } else if (qtyDelta > 0.0001) {
        let toDeduct = qtyDelta;
        const batches = db.prepare(`
          SELECT * FROM batches
          WHERE product_id = ? AND status = 'active' AND quantity > 0 AND tenant_id = ?
          ORDER BY id ASC
        `).all(item.product_id, tenantId);

        let consumedBatchId = null;
        for (const b of batches) {
          if (toDeduct <= 0) break;
          const d = Math.min(b.quantity, toDeduct);
          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?').run(d, b.id, tenantId);
          toDeduct -= d;
          consumedBatchId = b.id;
        }

        if (toDeduct > 0) {
          const fallback = db.prepare('SELECT id FROM batches WHERE product_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1').get(item.product_id, tenantId);
          if (fallback) {
            db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?').run(toDeduct, fallback.id, tenantId);
            consumedBatchId = fallback.id;
          }
        }

        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;
        insertMovement.run(
          tenantId,
          item.product_id,
          consumedBatchId,
          'SALE',
          -qtyDelta,
          item.unit_price,
          totalAfter,
          oldSale.id,
          `Sale ${oldSale.invoice_no} edited: increased qty ${oldQty} -> ${newQty}${reason ? ` (${reason})` : ''}`,
          req.user.id
        );
      }

      const itemDisc = Number(item.discount) || 0;
      const rate = Number(item.unit_price) || (oldItem ? oldItem.unit_price : 0);
      const lineTotal = Math.max(0, (newQty * rate) - itemDisc);

      if (newQty > 0) {
        if (oldItem) {
          db.prepare(`
            UPDATE sale_items
            SET quantity = ?, unit_price = ?, discount = ?, total_price = ?
            WHERE id = ? AND tenant_id = ?
          `).run(newQty, rate, itemDisc, lineTotal, oldItem.id, tenantId);
        } else {
          db.prepare(`
            INSERT INTO sale_items (
              tenant_id, sale_id, product_id, batch_id, batch_no,
              quantity, unit, unit_price, cost_price, discount, total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            tenantId, oldSale.id, item.product_id, item.batch_id || null, item.batch_no || null,
            newQty, item.unit || 'pkt', rate, oldItem?.cost_price || 0, itemDisc, lineTotal
          );
        }
      } else if (oldItem) {
        db.prepare('DELETE FROM sale_items WHERE id = ? AND tenant_id = ?').run(oldItem.id, tenantId);
      }
    }

    // Old items completely removed
    for (const oldIt of oldSaleItems) {
      const stillPresent = items.find(i => i.id === oldIt.id || (i.product_id && i.product_id === oldIt.product_id));
      if (!stillPresent) {
        if (oldIt.batch_id) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(oldIt.quantity, oldIt.batch_id, tenantId);
        } else {
          const ab = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? ORDER BY id ASC LIMIT 1").get(oldIt.product_id, tenantId);
          if (ab) db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(oldIt.quantity, ab.id, tenantId);
        }
        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(oldIt.product_id, tenantId).s;
        insertMovement.run(
          tenantId, oldIt.product_id, oldIt.batch_id, 'RETURN', oldIt.quantity, oldIt.unit_price, totalAfter,
          oldSale.id, `Sale ${oldSale.invoice_no} edited: item removed from bill (${reason || 'Admin edit'})`, req.user.id
        );
        db.prepare('DELETE FROM sale_items WHERE id = ? AND tenant_id = ?').run(oldIt.id, tenantId);
      }
    }

    // Recalculate bill financial values
    const currentItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?').all(oldSale.id, tenantId);
    const newSubtotal = currentItems.reduce((acc, it) => acc + Number(it.total_price), 0);
    const newDiscount = (discount !== undefined && discount !== null && !isNaN(Number(discount)))
      ? Number(discount)
      : Number(oldSale.discount || 0);
    const newGrandTotal = Math.max(0, newSubtotal - newDiscount);

    const newPaidAmount = (paid_amount !== undefined && paid_amount !== null && !isNaN(Number(paid_amount)))
      ? Number(paid_amount)
      : Math.min(Number(oldSale.paid_amount), newGrandTotal);
    const newBalanceDue = Math.max(0, newGrandTotal - newPaidAmount);

    // Update Customer Balance
    if (oldSale.customer_id && Number(oldSale.customer_id) > 1) {
      const oldNet = Number(oldSale.grand_total) - Number(oldSale.paid_amount);
      const newNet = newGrandTotal - newPaidAmount;
      const customerBalanceDelta = newNet - oldNet;
      if (Math.abs(customerBalanceDelta) > 0.001) {
        db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance + ?) WHERE id = ? AND tenant_id = ?')
          .run(customerBalanceDelta, oldSale.customer_id, tenantId);
      }
    }

    let updatedNotes = oldSale.notes || '';
    if (reason && reason.trim()) {
      updatedNotes = updatedNotes ? `${updatedNotes} | Edited: ${reason.trim()}` : `Edited: ${reason.trim()}`;
    }

    db.prepare(`
      UPDATE sales
      SET subtotal = ?, discount = ?, grand_total = ?, paid_amount = ?, balance_due = ?, notes = ?
      WHERE id = ? AND tenant_id = ?
    `).run(newSubtotal, newDiscount, newGrandTotal, newPaidAmount, newBalanceDue, updatedNotes, oldSale.id, tenantId);

    logAudit(
      req.user.id,
      req.user.full_name,
      'UPDATE',
      'SALE',
      oldSale.id,
      `Edited sale ${oldSale.invoice_no}: items updated, Grand Total: ₨ ${oldSale.grand_total} -> ₨ ${newGrandTotal}, Paid: ₨ ${oldSale.paid_amount} -> ₨ ${newPaidAmount}${reason ? ` (${reason})` : ''}`,
      req
    );

    return {
      id: oldSale.id,
      invoice_no: oldSale.invoice_no,
      grand_total: newGrandTotal,
      paid_amount: newPaidAmount,
      balance_due: newBalanceDue
    };
  });

  try {
    const result = transaction();
    return res.json({ success: true, message: `Sale ${result.invoice_no} updated successfully.`, data: result });
  } catch (err) {
    console.error('Error updating sale:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update individual order status
exports.updateOrderStatus = (req, res) => {
  const transaction = db.transaction(() => {
    const tenantId = req.tenant_id || 'latif_001';
    const { id } = req.params;
    const { status, reason } = req.body;

    const allowedStatuses = ['New', 'Pending', 'Confirmed', 'Processing', 'Ready for Delivery', 'Delivered', 'Completed', 'Cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
    }

    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!sale) throw new Error('Order not found.');

    const oldStatus = sale.order_status || 'Completed';
    if (oldStatus === status) {
      return { success: true, message: `Order status is already ${status}.`, sale };
    }

    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?').all(sale.id, tenantId);
      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (
          tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
          balance_after, reference_id, reference_type, reason, user_id
        ) VALUES (?, ?, ?, 'STOCK_REVERSAL', ?, ?, ?, ?, 'ORDER_CANCEL', ?, ?)
      `);

      for (const item of saleItems) {
        if (item.batch_id) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(item.quantity, item.batch_id, tenantId);
        } else {
          const ab = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1").get(item.product_id, tenantId);
          if (ab) db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(item.quantity, ab.id, tenantId);
        }

        const totalAfter = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;
        insertMovement.run(
          tenantId, item.product_id, item.batch_id, item.quantity, item.cost_price || item.unit_price,
          totalAfter, sale.id, `Order ${sale.invoice_no} cancelled: stock reversed${reason ? ` (${reason})` : ''}`, req.user.id
        );
      }

      if (sale.customer_id && sale.balance_due > 0) {
        db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ? AND tenant_id = ?')
          .run(sale.balance_due, sale.customer_id, tenantId);
      }
    } else if (oldStatus === 'Cancelled' && status !== 'Cancelled') {
      const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?').all(sale.id, tenantId);
      for (const item of saleItems) {
        const totalAvail = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?").get(item.product_id, tenantId).s;
        if (totalAvail < item.quantity) {
          throw new Error(`Cannot re-activate order: Insufficient stock for product #${item.product_id} (Available: ${totalAvail}, needed: ${item.quantity}).`);
        }
      }

      for (const item of saleItems) {
        if (item.batch_id) {
          db.prepare('UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ? AND tenant_id = ?').run(item.quantity, item.batch_id, tenantId);
        } else {
          const ab = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1").get(item.product_id, tenantId);
          if (ab) db.prepare('UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ? AND tenant_id = ?').run(item.quantity, ab.id, tenantId);
        }
      }

      if (sale.customer_id && sale.balance_due > 0) {
        db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ? AND tenant_id = ?')
          .run(sale.balance_due, sale.customer_id, tenantId);
      }
    }

    let updatedNotes = sale.notes || '';
    if (reason && reason.trim()) {
      updatedNotes = updatedNotes ? `${updatedNotes} | Status (${status}): ${reason.trim()}` : `Status (${status}): ${reason.trim()}`;
    }

    db.prepare('UPDATE sales SET order_status = ?, notes = ? WHERE id = ? AND tenant_id = ?').run(status, updatedNotes, sale.id, tenantId);

    logAudit(
      req.user.id, req.user.full_name, 'UPDATE_STATUS', 'SALE', sale.id,
      `Updated order ${sale.invoice_no} status: ${oldStatus} -> ${status}${reason ? ` (${reason})` : ''}`, req
    );

    const updatedSale = db.prepare('SELECT s.*, c.name as customer_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND s.tenant_id = ?').get(sale.id, tenantId);
    return { success: true, message: `Order #${sale.invoice_no} status updated to ${status}.`, sale: updatedSale };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    console.error('Error updating order status:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Bulk update order status
exports.bulkUpdateStatus = (req, res) => {
  const transaction = db.transaction(() => {
    const tenantId = req.tenant_id || 'latif_001';
    const { ids, status, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('No order IDs provided.');
    }
    const allowedStatuses = ['New', 'Pending', 'Confirmed', 'Processing', 'Ready for Delivery', 'Delivered', 'Completed', 'Cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    let updatedCount = 0;
    for (const id of ids) {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?').get(id, tenantId);
      if (!sale) continue;
      if (sale.order_status === status) continue;

      if (status === 'Cancelled' && sale.order_status !== 'Cancelled') {
        const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?').all(sale.id, tenantId);
        for (const item of saleItems) {
          if (item.batch_id) {
            db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(item.quantity, item.batch_id, tenantId);
          } else {
            const ab = db.prepare("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1").get(item.product_id, tenantId);
            if (ab) db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?').run(item.quantity, ab.id, tenantId);
          }
        }
        if (sale.customer_id && sale.balance_due > 0) {
          db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ? AND tenant_id = ?')
            .run(sale.balance_due, sale.customer_id, tenantId);
        }
      }

      db.prepare('UPDATE sales SET order_status = ? WHERE id = ? AND tenant_id = ?').run(status, sale.id, tenantId);
      updatedCount++;
    }

    logAudit(req.user.id, req.user.full_name, 'BULK_UPDATE_STATUS', 'SALE', null, `Bulk updated ${updatedCount} orders to ${status}`, req);
    return { success: true, message: `Successfully updated ${updatedCount} order(s) to ${status}.` };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    console.error('Error in bulk status update:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Record payment directly for an order
exports.recordOrderPayment = (req, res) => {
  const transaction = db.transaction(() => {
    const tenantId = req.tenant_id || 'latif_001';
    const { id } = req.params;
    const { amount, payment_method, notes, payment_date } = req.body;

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }

    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!sale) throw new Error('Order not found.');

    if (sale.balance_due <= 0) {
      throw new Error('This order is already fully paid.');
    }

    const payAmt = Math.min(amt, sale.balance_due);
    const newPaid = Number(sale.paid_amount) + payAmt;
    const newBalance = Math.max(0, Number(sale.grand_total) - newPaid);

    db.prepare('UPDATE sales SET paid_amount = ?, balance_due = ? WHERE id = ? AND tenant_id = ?')
      .run(newPaid, newBalance, sale.id, tenantId);

    // If order had customer, reduce customer receivable balance
    if (sale.customer_id) {
      db.prepare('UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ? AND tenant_id = ?')
        .run(payAmt, sale.customer_id, tenantId);
    }

    // Insert payment record
    const refNo = `REC-${sale.invoice_no}`;
    db.prepare(`
      INSERT INTO payments (
        tenant_id, type, party_type, party_id, reference_id, reference_no,
        amount, payment_method, payment_date, notes, user_id
      ) VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenantId,
      sale.customer_id || 1,
      sale.id,
      refNo,
      payAmt,
      payment_method || sale.payment_method || 'Cash',
      payment_date || new Date().toISOString().split('T')[0],
      notes ? `Payment on #${sale.invoice_no}: ${notes}` : `Payment on #${sale.invoice_no}`,
      req.user.id
    );

    logAudit(req.user.id, req.user.full_name, 'RECEIPT', 'SALE', sale.id, `Recorded payment of ₨ ${payAmt} for order ${sale.invoice_no}`, req);

    return {
      success: true,
      message: `Payment of ₨ ${payAmt} recorded successfully. Remaining balance: ₨ ${newBalance}.`,
      sale: { ...sale, paid_amount: newPaid, balance_due: newBalance }
    };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    console.error('Error recording order payment:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};
