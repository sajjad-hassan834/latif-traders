const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List sales with customer details, order statuses, product summaries, and statistics
exports.getSales = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date, customer_id, sale_type, search, order_status, payment_status, payment_method } = req.query;

    let query = `
      SELECT s.*, 
        COALESCE(s.order_status, 'Completed') as order_status,
        c.name as customer_name, c.phone as customer_phone, u.full_name as user_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) as total_qty,
        (SELECT GROUP_CONCAT(pr.name, ', ') FROM (SELECT DISTINCT pr.name FROM sale_items si JOIN products pr ON si.product_id = pr.id WHERE si.sale_id = s.id LIMIT 4) pr) as product_summary,
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
        s.invoice_no ILIKE ? 
        OR c.name ILIKE ? 
        OR c.phone ILIKE ?
        OR EXISTS (
          SELECT 1 FROM sale_items si 
          JOIN products pr ON si.product_id = pr.id 
          WHERE si.sale_id = s.id AND pr.name ILIKE ?
        )
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY s.id DESC`;
    const sales = await db.all(query, params);

    // Compute dynamic summary metrics respecting current date range/filters
    const totalOrders = sales.length;
    let newOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;
    let totalBalanceDue = 0;

    for (const sale of sales) {
      sale.order_status = sale.order_status || 'Completed';
      const st = String(sale.order_status).trim().toLowerCase();
      if (st === 'new' || st === 'pending') {
        newOrders++;
      } else if (st === 'cancelled' || st === 'void') {
        cancelledOrders++;
      } else {
        completedOrders++;
      }

      totalRevenue += Number(sale.grand_total) || 0;
      totalBalanceDue += Number(sale.balance_due) || 0;
    }

    return res.json({
      success: true,
      sales,
      summary: {
        totalOrders,
        newOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        totalBalanceDue
      }
    });
  } catch (err) {
    console.error('Error fetching sales:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales history.' });
  }
};

// Get single sale details with items and business info for thermal printing
exports.getSaleById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;

    const sale = await db.get(`
      SELECT s.*, 
        c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
        u.full_name as cashier_name
      FROM sales s

      LEFT JOIN customers c ON s.customer_id = c.id AND c.tenant_id = s.tenant_id
      LEFT JOIN users u ON s.user_id = u.id AND u.tenant_id = s.tenant_id
      WHERE (s.id = ? OR s.invoice_no = ?) AND s.tenant_id = ?
    `, [String(id), String(id), tenantId]);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found.' });
    }

    const items = await db.all(`
      SELECT si.*, pr.name as product_name, pr.sku, pr.brand as brand_name, sup.name as supplier_name
      FROM sale_items si
      JOIN products pr ON si.product_id = pr.id
      LEFT JOIN suppliers sup ON pr.supplier_id = sup.id

      WHERE si.sale_id = ? AND si.tenant_id = ?
    `, [sale.id, tenantId]);

    const settingsList = await db.all('SELECT key, value FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
    const settings = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }

    const tenant = await db.get('SELECT business_name, email, phone, address, logo_url FROM tenants WHERE id = ?', [tenantId]);
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

// Create POS / Sale (Atomic Transaction with FEFO, Consistent Product Ordering, Late Counter Locking)
exports.createSale = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const tenantPlan = req.tenant?.plan || 'free';

      // Plan limit enforcement: Free plan max 100 invoices/month
      if (tenantPlan === 'free') {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const invoiceRow = await db.get(`
          SELECT COUNT(*) as count FROM sales 
          WHERE tenant_id = ? AND sale_date LIKE ?
        `, [tenantId, `${currentMonth}%`]);

        if (invoiceRow && invoiceRow.count >= 100) {
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
      const negSetting = await db.get("SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'allow_negative_stock'", [tenantId]);
      const allowNegative = negSetting && negSetting.value === 'true';

      // DEADLOCK AVOIDANCE: Sort unique product IDs in strictly ascending order
      // and lock them consistently via SELECT FOR UPDATE (in Postgres)
      const sortedProductIds = [...new Set(items.map(i => Number(i.product_id)))].sort((a, b) => a - b);
      for (const pId of sortedProductIds) {
        const pCheck = await db.get('SELECT id, name, sale_price, wholesale_price FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE', [pId, tenantId]);
        if (!pCheck) {
          throw new Error(`Product #${pId} not found for this tenant.`);
        }
      }

      // Calculate subtotal & validate stock
      let subtotal = 0;
      for (const item of items) {
        const qty = Number(item.quantity);
        if (qty <= 0) throw new Error('Item quantity must be greater than 0.');

        const prod = await db.get('SELECT id, name, sale_price, wholesale_price FROM products WHERE id = ? AND tenant_id = ?', [item.product_id, tenantId]);
        if (!prod) throw new Error(`Product #${item.product_id} not found.`);

        // Check available stock
        const totalStockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [item.product_id, tenantId]);
        const totalAvailable = Number(totalStockRow?.s || 0);

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

      // If customer selected, check existence within current tenant and credit limit
      if (customer_id) {
        const cust = await db.get('SELECT id, name, credit_limit, current_balance FROM customers WHERE id = ? AND tenant_id = ?', [customer_id, tenantId]);
        if (!cust) {
          throw new Error(`Customer #${customer_id} not found for this tenant.`);
        }
        if (balance_due > 0 && cust.credit_limit > 0 && (Number(cust.current_balance) + balance_due) > cust.credit_limit) {
          throw new Error(`Customer "${cust.name}" credit limit of ₨ ${cust.credit_limit} would be exceeded (Current balance: ₨ ${cust.current_balance}, new balance: ₨ ${Number(cust.current_balance) + balance_due}).`);
        }
      }

      // LATE NUMBERING: Acquire counter number as late as possible right before insert
      const invoice_no = await db.getNextNumber(tenantId, 'sale_invoice', 'INV');

      const sRes = await db.run(`
        INSERT INTO sales (
          tenant_id, invoice_no, customer_id, sale_type, sale_date,
          subtotal, discount, tax, grand_total, paid_amount, balance_due,
          payment_method, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
        req.user?.id || 1
      ]);

      const saleId = sRes.lastInsertRowid;

      // Deduct stock using strict FIFO / FEFO across batches
      for (const item of items) {
        let remainingQtyToDeduct = Number(item.quantity);
        const totalItemQty = remainingQtyToDeduct;
        const itemDisc = Number(item.discount) || 0;
        const rawLineTotal = (item.total_price !== undefined && item.total_price !== null && !isNaN(Number(item.total_price)) && Number(item.total_price) > 0)
          ? Number(item.total_price)
          : (remainingQtyToDeduct * Number(item.unit_price));
        const lineTotal = Math.max(0, rawLineTotal - itemDisc);
        const effectiveRate = totalItemQty > 0 ? (rawLineTotal / totalItemQty) : Number(item.unit_price);

        // Fetch active batches ordered by id ASC (Strict FIFO) with row locks
        const batches = await db.all(`
          SELECT * FROM batches
          WHERE product_id = ? AND status = 'active' AND quantity > 0 AND tenant_id = ?
          ORDER BY id ASC FOR UPDATE
        `, [item.product_id, tenantId]);

        let totalCostForLine = 0;
        const consumedBatches = [];

        if (batches.length > 0) {
          for (const b of batches) {
            if (remainingQtyToDeduct <= 0) break;

            const deduct = Math.min(Number(b.quantity), remainingQtyToDeduct);
            await db.run('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?', [deduct, b.id, tenantId]);

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

        // If quantity still remains (negative stock policy)
        if (remainingQtyToDeduct > 0) {
          const fallbackBatch = await db.get('SELECT * FROM batches WHERE product_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1', [item.product_id, tenantId]);
          const fallbackUnitCost = fallbackBatch ? (Number(fallbackBatch.purchase_price) || 0) : 0;
          totalCostForLine += (remainingQtyToDeduct * fallbackUnitCost);

          if (fallbackBatch) {
            await db.run('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?', [remainingQtyToDeduct, fallbackBatch.id, tenantId]);
          }

          consumedBatches.push({
            batchId: fallbackBatch ? fallbackBatch.id : null,
            batchNo: fallbackBatch ? fallbackBatch.batch_no : 'NEGATIVE_STOCK',
            deduct: remainingQtyToDeduct,
            unitCost: fallbackUnitCost,
            supplierId: fallbackBatch ? fallbackBatch.supplier_id : null
          });
        }

        const primaryBatchId = consumedBatches[0]?.batchId || null;
        const costPrice = totalItemQty > 0 ? (totalCostForLine / totalItemQty) : 0;
        const batchNotes = consumedBatches.length > 1
          ? consumedBatches.map(c => `${c.batchNo || 'Lot'}: ${c.deduct}@${c.unitCost}`).join(', ')
          : (consumedBatches[0]?.batchNo || null);

        await db.run(`
          INSERT INTO sale_items (
            tenant_id, sale_id, product_id, batch_id, batch_no,
            quantity, unit, unit_price, cost_price, discount, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
        ]);

        const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [item.product_id, tenantId]);
        const totalStockAfter = Number(stockRow?.s || 0);

        if (consumedBatches.length > 0) {
          for (const c of consumedBatches) {
            await db.run(`
              INSERT INTO inventory_movements (
                tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
                balance_after, reference_id, reference_type, reason, user_id
              ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, 'SALE_INVOICE', ?, ?)
            `, [
              tenantId,
              item.product_id,
              c.batchId,
              -c.deduct,
              c.unitCost,
              totalStockAfter,
              saleId,
              `FIFO Sale ${invoice_no} [Batch ${c.batchNo} @ ₨${c.unitCost}]`,
              req.user?.id || 1
            ]);
          }
        } else {
          await db.run(`
            INSERT INTO inventory_movements (
              tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
              balance_after, reference_id, reference_type, reason, user_id
            ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, 'SALE_INVOICE', ?, ?)
          `, [
            tenantId,
            item.product_id,
            null,
            -totalItemQty,
            costPrice,
            totalStockAfter,
            saleId,
            `Sale Invoice ${invoice_no}`,
            req.user?.id || 1
          ]);
        }
      }

      // Update Customer Balance atomically in SQL (never read-modify-write in JS)
      if (customer_id && Number(customer_id) > 1) {
        const netBalanceDelta = grand_total - paid;
        if (Math.abs(netBalanceDelta) > 0.001) {
          await db.run('UPDATE customers SET current_balance = current_balance + ? WHERE id = ? AND tenant_id = ?',
            [netBalanceDelta, customer_id, tenantId]);
        }
      }

      // Record initial payment entry in payments table if paid > 0
      if (paid > 0) {
        await db.run(`
          INSERT INTO payments (
            tenant_id, type, party_type, party_id, reference_id, reference_no,
            amount, payment_method, payment_date, notes, user_id
          ) VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId,
          customer_id || 1,
          saleId,
          invoice_no,
          paid,
          payment_method || 'Cash',
          sale_date || new Date().toISOString().split('T')[0],
          `POS Receipt for invoice #${invoice_no}`,
          req.user?.id || 1
        ]);
      }

      await logAudit(
        req.user?.id || 1,
        req.user?.full_name || 'Admin',
        'CREATE',
        'SALE',
        saleId,
        `Sale ${invoice_no}: ₨ ${grand_total} (Paid: ₨ ${paid}, Due: ₨ ${balance_due})`,
        req
      );

      return { id: saleId, invoice_no, grand_total, paid_amount: paid, balance_due };
    });

    return res.status(201).json({ success: true, message: 'Sale invoice generated successfully.', data: result, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Sales Return
exports.createSaleReturn = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { original_sale_id, reason, items } = req.body;

      if (!original_sale_id || !items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Original sale invoice and return items are required.');
      }

      const origSale = await db.get('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [original_sale_id, tenantId]);
      if (!origSale) {
        throw new Error('Original sale invoice not found.');
      }

      const retNo = await db.getNextNumber(tenantId, 'sale_return', 'SRET');
      let totalAmount = 0;

      for (const item of items) {
        totalAmount += (Number(item.quantity) * Number(item.unit_price));
      }

      const retRes = await db.run(`
        INSERT INTO returns (tenant_id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id)
        VALUES (?, ?, 'SALE_RETURN', ?, ?, ?, ?, ?, ?)
      `, [tenantId, retNo, origSale.id, origSale.invoice_no, origSale.customer_id, totalAmount, reason || 'Customer Return', req.user?.id || 1]);

      const returnId = retRes.lastInsertRowid;

      for (const item of items) {
        const qty = Number(item.quantity);
        const rate = Number(item.unit_price);
        const lineTotal = qty * rate;
        const isResellable = (item.condition || 'RESELLABLE') === 'RESELLABLE';

        await db.run(`
          INSERT INTO return_items (tenant_id, return_id, product_id, batch_id, quantity, unit_price, total_amount, condition)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [tenantId, returnId, item.product_id, item.batch_id || null, qty, rate, lineTotal, item.condition || 'RESELLABLE']);

        if (isResellable) {
          if (item.batch_id) {
            await db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [qty, item.batch_id, tenantId]);
          } else {
            const b = await db.get("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1", [item.product_id, tenantId]);
            if (b) {
              await db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [qty, b.id, tenantId]);
            }
          }

          const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [item.product_id, tenantId]);
          const totalAfter = Number(stockRow?.s || 0);

          await db.run(`
            INSERT INTO inventory_movements (tenant_id, product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
            VALUES (?, ?, ?, 'RETURN', ?, ?, ?, ?, 'SALE_RETURN', ?, ?)
          `, [tenantId, item.product_id, item.batch_id || null, qty, rate, totalAfter, returnId, `Sale Return ${retNo} (Resellable)`, req.user?.id || 1]);
        }
      }

      // Adjust customer balance atomically
      if (origSale.customer_id && totalAmount > 0) {
        await db.run('UPDATE customers SET current_balance = GREATEST(0, current_balance - ?) WHERE id = ? AND tenant_id = ?',
          [totalAmount, origSale.customer_id, tenantId]);
      }

      // Update original sale financial state
      const newPaidAmount = Math.max(0, Number(origSale.paid_amount) - totalAmount);
      const newBalanceDue = Math.max(0, Number(origSale.grand_total) - newPaidAmount);
      await db.run('UPDATE sales SET paid_amount = ?, balance_due = ?, notes = COALESCE(notes || ?, ?) WHERE id = ? AND tenant_id = ?',
        [newPaidAmount, newBalanceDue, ' | ', `Return ${retNo} for ₨${totalAmount}`, origSale.id, tenantId]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'RETURN', 'SALE', returnId, `Sale return ${retNo} for ₨ ${totalAmount} against invoice ${origSale.invoice_no}`, req);

      return { return_no: retNo, total_amount: totalAmount };
    });

    return res.status(201).json({ success: true, message: 'Sale return processed successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete / Void Sale (Admin only) - Reverses stock, payments, customer balance
exports.deleteSale = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { id } = req.params;
      const { reason } = req.body || {};

      const sale = await db.get('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!sale) throw new Error('Sale invoice not found.');

      // 1. Reverse stock
      const saleItems = await db.all('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?', [sale.id, tenantId]);

      for (const item of saleItems) {
        if (item.batch_id) {
          await db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?',
            [item.quantity, item.batch_id, tenantId]);
        } else {
          const fallbackBatch = await db.get("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1", [item.product_id, tenantId]);
          if (fallbackBatch) {
            await db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?',
              [item.quantity, fallbackBatch.id, tenantId]);
          }
        }

        const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [item.product_id, tenantId]);
        const totalAfter = Number(stockRow?.s || 0);

        await db.run(`
          INSERT INTO inventory_movements (
            tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
            balance_after, reference_id, reference_type, reason, user_id
          ) VALUES (?, ?, ?, 'STOCK_REVERSAL', ?, ?, ?, ?, 'SALE_DELETE', ?, ?)
        `, [
          tenantId, item.product_id, item.batch_id, item.quantity, item.cost_price || item.unit_price,
          totalAfter, sale.id, `Deleted sale ${sale.invoice_no} - ${reason || 'Admin reversal'}`, req.user?.id || 1
        ]);
      }

      // 2. Reverse customer balance
      if (sale.customer_id && Number(sale.balance_due) > 0) {
        await db.run('UPDATE customers SET current_balance = GREATEST(0, current_balance - ?) WHERE id = ? AND tenant_id = ?',
          [sale.balance_due, sale.customer_id, tenantId]);
      }

      // 3. Delete payments
      await db.run("DELETE FROM payments WHERE reference_id = ? AND reference_no = ? AND tenant_id = ?", [sale.id, sale.invoice_no, tenantId]);

      // 4. Delete sale items and sale
      await db.run('DELETE FROM sale_items WHERE sale_id = ? AND tenant_id = ?', [sale.id, tenantId]);
      await db.run('DELETE FROM sales WHERE id = ? AND tenant_id = ?', [sale.id, tenantId]);

      await logAudit(
        req.user?.id || 1, req.user?.full_name || 'Admin', 'DELETE', 'SALE', sale.id,
        `Deleted sale ${sale.invoice_no} for ₨ ${sale.grand_total} - ${reason || 'Admin reversal'}`, req
      );

      return { success: true, message: `Sale ${sale.invoice_no} deleted and stock reversed.` };
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { id } = req.params;
      const { status, reason } = req.body;

      const allowedStatuses = ['New', 'Pending', 'Confirmed', 'Processing', 'Ready for Delivery', 'Delivered', 'Completed', 'Cancelled'];
      if (!status || !allowedStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
      }

      const sale = await db.get('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!sale) throw new Error('Order not found.');

      const oldStatus = sale.order_status || 'Completed';
      if (oldStatus === status) {
        return { success: true, message: `Order status is already ${status}.`, sale };
      }

      if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
        const saleItems = await db.all('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?', [sale.id, tenantId]);
        for (const item of saleItems) {
          if (item.batch_id) {
            await db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [item.quantity, item.batch_id, tenantId]);
          } else {
            const ab = await db.get("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1", [item.product_id, tenantId]);
            if (ab) await db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [item.quantity, ab.id, tenantId]);
          }

          const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [item.product_id, tenantId]);
          const totalAfter = Number(stockRow?.s || 0);

          await db.run(`
            INSERT INTO inventory_movements (
              tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
              balance_after, reference_id, reference_type, reason, user_id
            ) VALUES (?, ?, ?, 'STOCK_REVERSAL', ?, ?, ?, ?, 'ORDER_CANCEL', ?, ?)
          `, [
            tenantId, item.product_id, item.batch_id, item.quantity, item.cost_price || item.unit_price,
            totalAfter, sale.id, `Order ${sale.invoice_no} cancelled: stock reversed${reason ? ` (${reason})` : ''}`, req.user?.id || 1
          ]);
        }

        if (sale.customer_id && Number(sale.balance_due) > 0) {
          await db.run('UPDATE customers SET current_balance = GREATEST(0, current_balance - ?) WHERE id = ? AND tenant_id = ?',
            [sale.balance_due, sale.customer_id, tenantId]);
        }
      }

      let updatedNotes = sale.notes || '';
      if (reason && reason.trim()) {
        updatedNotes = updatedNotes ? `${updatedNotes} | Status (${status}): ${reason.trim()}` : `Status (${status}): ${reason.trim()}`;
      }

      await db.run('UPDATE sales SET order_status = ?, notes = ? WHERE id = ? AND tenant_id = ?', [status, updatedNotes, sale.id, tenantId]);

      await logAudit(
        req.user?.id || 1, req.user?.full_name || 'Admin', 'UPDATE_STATUS', 'SALE', sale.id,
        `Updated order ${sale.invoice_no} status: ${oldStatus} -> ${status}${reason ? ` (${reason})` : ''}`, req
      );

      const updatedSale = await db.get('SELECT s.*, c.name as customer_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND s.tenant_id = ?', [sale.id, tenantId]);
      return { success: true, message: `Order #${sale.invoice_no} status updated to ${status}.`, sale: updatedSale };
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Record payment directly for an order
exports.recordOrderPayment = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { id } = req.params;
      const { amount, payment_method, notes, payment_date } = req.body;

      const amt = Number(amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error('Payment amount must be greater than 0.');
      }

      const sale = await db.get('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!sale) throw new Error('Order not found.');

      if (Number(sale.balance_due) <= 0) {
        throw new Error('This order is already fully paid.');
      }

      const payAmt = Math.min(amt, Number(sale.balance_due));
      const newPaid = Number(sale.paid_amount) + payAmt;
      const newBalance = Math.max(0, Number(sale.grand_total) - newPaid);

      await db.run('UPDATE sales SET paid_amount = ?, balance_due = ? WHERE id = ? AND tenant_id = ?',
        [newPaid, newBalance, sale.id, tenantId]);

      if (sale.customer_id) {
        await db.run('UPDATE customers SET current_balance = GREATEST(0, current_balance - ?) WHERE id = ? AND tenant_id = ?',
          [payAmt, sale.customer_id, tenantId]);
      }

      const refNo = await db.getNextNumber(tenantId, 'customer_receipt', 'REC');
      await db.run(`
        INSERT INTO payments (
          tenant_id, type, party_type, party_id, reference_id, reference_no,
          amount, payment_method, payment_date, notes, user_id
        ) VALUES (?, 'CUSTOMER_RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        sale.customer_id || 1,
        sale.id,
        refNo,
        payAmt,
        payment_method || sale.payment_method || 'Cash',
        payment_date || new Date().toISOString().split('T')[0],
        notes ? `Payment on #${sale.invoice_no}: ${notes}` : `Payment on #${sale.invoice_no}`,
        req.user?.id || 1
      ]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'RECEIPT', 'SALE', sale.id, `Recorded payment of ₨ ${payAmt} for order ${sale.invoice_no}`, req);

      return {
        success: true,
        message: `Payment of ₨ ${payAmt} recorded successfully. Remaining balance: ₨ ${newBalance}.`,
        sale: { ...sale, paid_amount: newPaid, balance_due: newBalance }
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Bulk update order status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      const runner = tx.run ? tx : db;

      const tenantId = req.tenantId || req.tenant_id;
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('No order IDs provided.');
      }
      const allowedStatuses = ['New', 'Pending', 'Confirmed', 'Processing', 'Ready for Delivery', 'Delivered', 'Completed', 'Cancelled'];
      if (!status || !allowedStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      let updatedCount = 0;
      for (const id of ids) {
        const sale = await runner.get('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        if (!sale) continue;
        if (sale.order_status === status) continue;

        if (status === 'Cancelled' && sale.order_status !== 'Cancelled') {
          const saleItems = await runner.all('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?', [sale.id, tenantId]);
          for (const item of saleItems) {
            if (item.batch_id) {
              await runner.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [item.quantity, item.batch_id, tenantId]);
            } else {
              const ab = await runner.get("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1", [item.product_id, tenantId]);
              if (ab) await runner.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [item.quantity, ab.id, tenantId]);
            }
          }
          if (sale.customer_id && Number(sale.balance_due) > 0) {
            await runner.run('UPDATE customers SET current_balance = GREATEST(0, current_balance - ?) WHERE id = ? AND tenant_id = ?',
              [sale.balance_due, sale.customer_id, tenantId]);
          }
        }

        await runner.run('UPDATE sales SET order_status = ? WHERE id = ? AND tenant_id = ?', [status, sale.id, tenantId]);
        updatedCount++;
      }

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'BULK_UPDATE_STATUS', 'SALE', null, `Bulk updated ${updatedCount} orders to ${status}`, req);
      return { success: true, message: `Successfully updated ${updatedCount} order(s) to ${status}.` };
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update sale
exports.updateSale = async (req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      const runner = tx.run ? tx : db;

      const tenantId = req.tenantId || req.tenant_id;
      const { id } = req.params;
      const { items = [], discount, paid_amount, notes, reason } = req.body;

      const oldSale = await runner.get('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!oldSale) throw new Error('Sale not found.');

      const oldSaleItems = await runner.all('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?', [oldSale.id, tenantId]);

      for (const item of items) {
        const oldItem = oldSaleItems.find(oi => oi.id === item.id || (oi.product_id === item.product_id && (item.id === undefined || item.id === oi.id)));
        const oldQty = oldItem ? Number(oldItem.quantity) : 0;
        const newQty = Number(item.quantity) || 0;
        const qtyDelta = newQty - oldQty;

        if (qtyDelta < -0.0001) {
          const returnQty = Math.abs(qtyDelta);
          let batchToUse = item.batch_id || (oldItem ? oldItem.batch_id : null);
          if (batchToUse) {
            await runner.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [returnQty, batchToUse, tenantId]);
          } else {
            const ab = await runner.get("SELECT id FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? LIMIT 1", [item.product_id, tenantId]);
            if (ab) {
              await runner.run('UPDATE batches SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?', [returnQty, ab.id, tenantId]);
              batchToUse = ab.id;
            }
          }
        } else if (qtyDelta > 0.0001) {
          let toDeduct = qtyDelta;
          const batches = await runner.all("SELECT * FROM batches WHERE product_id = ? AND status = 'active' AND quantity > 0 AND tenant_id = ? ORDER BY id ASC", [item.product_id, tenantId]);
          for (const b of batches) {
            if (toDeduct <= 0) break;
            const d = Math.min(Number(b.quantity), toDeduct);
            await runner.run('UPDATE batches SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?', [d, b.id, tenantId]);
            toDeduct -= d;
          }
        }

        const itemDisc = Number(item.discount) || 0;
        const rate = Number(item.unit_price) || (oldItem ? oldItem.unit_price : 0);
        const lineTotal = Math.max(0, (newQty * rate) - itemDisc);

        if (newQty > 0) {
          if (oldItem) {
            await runner.run(`
              UPDATE sale_items
              SET quantity = ?, unit_price = ?, discount = ?, total_price = ?
              WHERE id = ? AND tenant_id = ?
            `, [newQty, rate, itemDisc, lineTotal, oldItem.id, tenantId]);
          } else {
            await runner.run(`
              INSERT INTO sale_items (
                tenant_id, sale_id, product_id, batch_id, batch_no,
                quantity, unit, unit_price, cost_price, discount, total_price
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              tenantId, oldSale.id, item.product_id, item.batch_id || null, item.batch_no || null,
              newQty, item.unit || 'pkt', rate, oldItem?.cost_price || 0, itemDisc, lineTotal
            ]);
          }
        } else if (oldItem) {
          await runner.run('DELETE FROM sale_items WHERE id = ? AND tenant_id = ?', [oldItem.id, tenantId]);
        }
      }

      // Recalculate bill financial values
      const currentItems = await runner.all('SELECT * FROM sale_items WHERE sale_id = ? AND tenant_id = ?', [oldSale.id, tenantId]);
      const newSubtotal = currentItems.reduce((acc, it) => acc + Number(it.total_price), 0);
      const newDiscount = (discount !== undefined && discount !== null && !isNaN(Number(discount)))
        ? Number(discount)
        : Number(oldSale.discount || 0);
      const newGrandTotal = Math.max(0, newSubtotal - newDiscount);

      const newPaidAmount = (paid_amount !== undefined && paid_amount !== null && !isNaN(Number(paid_amount)))
        ? Number(paid_amount)
        : Math.min(Number(oldSale.paid_amount), newGrandTotal);
      const newBalanceDue = Math.max(0, newGrandTotal - newPaidAmount);

      if (oldSale.customer_id && Number(oldSale.customer_id) > 1) {
        const oldNet = Number(oldSale.grand_total) - Number(oldSale.paid_amount);
        const newNet = newGrandTotal - newPaidAmount;
        const customerBalanceDelta = newNet - oldNet;
        if (Math.abs(customerBalanceDelta) > 0.001) {
          await runner.run('UPDATE customers SET current_balance = GREATEST(0, current_balance + ?) WHERE id = ? AND tenant_id = ?',
            [customerBalanceDelta, oldSale.customer_id, tenantId]);
        }
      }

      let updatedNotes = oldSale.notes || '';
      if (reason && reason.trim()) {
        updatedNotes = updatedNotes ? `${updatedNotes} | Edited: ${reason.trim()}` : `Edited: ${reason.trim()}`;
      }

      await runner.run(`
        UPDATE sales
        SET subtotal = ?, discount = ?, grand_total = ?, paid_amount = ?, balance_due = ?, notes = ?
        WHERE id = ? AND tenant_id = ?
      `, [newSubtotal, newDiscount, newGrandTotal, newPaidAmount, newBalanceDue, updatedNotes, oldSale.id, tenantId]);

      await logAudit(
        req.user?.id || 1, req.user?.full_name || 'Admin', 'UPDATE', 'SALE', oldSale.id,
        `Edited sale ${oldSale.invoice_no}: Grand Total: ₨ ${oldSale.grand_total} -> ₨ ${newGrandTotal}, Paid: ₨ ${oldSale.paid_amount} -> ₨ ${newPaidAmount}`, req
      );

      return {
        id: oldSale.id,
        invoice_no: oldSale.invoice_no,
        grand_total: newGrandTotal,
        paid_amount: newPaidAmount,
        balance_due: newBalanceDue
      };
    });

    return res.json({ success: true, message: `Sale ${result.invoice_no} updated successfully.`, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

