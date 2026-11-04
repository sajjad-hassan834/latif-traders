const { resolvePurchaseBatch } = require('../utils/tradeBatch');
const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List purchases with supplier info, search, filtering & pagination
exports.getPurchases = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date, date_from, date_to, supplier_id, search, payment_status, page, limit } = req.query;

    let baseWhere = ` WHERE p.tenant_id = ?`;
    const params = [tenantId];

    const fromDate = start_date || date_from;
    const toDate = end_date || date_to;

    if (fromDate) {
      baseWhere += ` AND p.purchase_date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      baseWhere += ` AND p.purchase_date <= ?`;
      params.push(toDate);
    }
    if (supplier_id && supplier_id !== 'all') {
      baseWhere += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }
    if (payment_status && payment_status !== 'all') {
      const ps = String(payment_status).toUpperCase();
      if (ps === 'PAID') {
        baseWhere += ` AND (p.balance_due <= 0 OR p.paid_amount >= p.grand_total)`;
      } else if (ps === 'PARTIAL') {
        baseWhere += ` AND (p.paid_amount > 0 AND p.balance_due > 0 AND p.paid_amount < p.grand_total)`;
      } else if (ps === 'UNPAID') {
        baseWhere += ` AND (p.paid_amount <= 0)`;
      }
    }
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      baseWhere += ` AND (
        p.invoice_no ILIKE ?
        OR p.supplier_invoice_no ILIKE ?
        OR s.name ILIKE ?
        OR EXISTS (
          SELECT 1 FROM purchase_items pi
          JOIN products pr ON pi.product_id = pr.id AND pr.tenant_id = pi.tenant_id
          WHERE pi.purchase_id = p.id AND pi.tenant_id = p.tenant_id
            AND (pr.name ILIKE ? OR pr.sku ILIKE ?)
        )
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id AND s.tenant_id = p.tenant_id
      ${baseWhere}
    `;
    const countRow = await db.get(countQuery, params);
    const total = Number(countRow ? countRow.total : 0);

    let query = `
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, u.full_name as user_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id AND pi.tenant_id = p.tenant_id) as item_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM returns r WHERE r.original_invoice_id = p.id AND r.tenant_id = p.tenant_id) as returned_amount
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id AND s.tenant_id = p.tenant_id
      LEFT JOIN users u ON p.user_id = u.id AND u.tenant_id = p.tenant_id
      ${baseWhere}
      ORDER BY p.id DESC
    `;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const queryParams = [...params];

    if (!isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0) {
      const offset = (pageNum - 1) * limitNum;
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNum, offset);
    }

    const purchases = await db.all(query, queryParams);
    const totalPages = (!isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0) ? Math.ceil(total / limitNum) : 1;

    return res.json({
      success: true,
      purchases,
      total,
      page: pageNum || 1,
      limit: limitNum || purchases.length,
      totalPages
    });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch purchases.' });
  }
};

// Get single purchase invoice with line items
exports.getPurchaseById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const purchase = await db.get(`
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.address as supplier_address,
        u.full_name as user_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id AND s.tenant_id = p.tenant_id
      LEFT JOIN users u ON p.user_id = u.id AND u.tenant_id = p.tenant_id

      WHERE p.id = ? AND p.tenant_id = ?
    `, [String(id), tenantId]);

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });
    }

    const items = await db.all(`
      SELECT pi.*, pr.name as product_name, pr.sku
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id AND pr.tenant_id = pi.tenant_id
      WHERE pi.purchase_id = ? AND pi.tenant_id = ?
    `, [purchase.id, tenantId]);

    return res.json({ success: true, purchase, items });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch purchase invoice.' });
  }
};

// Create Purchase (Atomic Transaction)
exports.createPurchase = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const {
        supplier_id, supplier_invoice_no, purchase_date,
        items, discount, tax, paid_amount, payment_method, notes
      } = req.body;

      if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Supplier and at least one item are required.');
      }

      const supplier = await db.get('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [supplier_id, tenantId]);
      if (!supplier) {
        throw new Error('Supplier not found.');
      }

      // Generate unique sequential purchase invoice number atomically
      const finalInvoice = await db.getNextNumber(tenantId, 'purchase_invoice', 'PUR');

      let subtotal = 0;
      for (const item of items) {
        const rate = Number(item.unit_price !== undefined ? item.unit_price : (item.cost_price || 0));
        const lineTotal = (Number(item.quantity) * rate) - (Number(item.discount) || 0);
        subtotal += lineTotal;
      }

      const disc = Number(discount) || 0;
      const tx = Number(tax) || 0;
      const grand_total = Math.max(0, subtotal - disc + tx);
      const paid = Number(paid_amount) || 0;
      const balance_due = Math.max(0, grand_total - paid);

      const finalSupplierInvoice = (supplier_invoice_no && supplier_invoice_no.trim())
        ? supplier_invoice_no.trim()
        : finalInvoice.replace('PUR-', 'BILL-');

      const pRes = await db.run(`
        INSERT INTO purchases (
          tenant_id, invoice_no, supplier_invoice_no, supplier_id, purchase_date,
          subtotal, discount, tax, grand_total, paid_amount, balance_due,
          payment_method, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        finalInvoice,
        finalSupplierInvoice,
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
        req.user?.id || 1
      ]);

      const purchaseId = pRes.lastInsertRowid;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const qty = Number(item.quantity);
        const rate = Number(item.unit_price !== undefined ? item.unit_price : (item.cost_price || 0));
        const lineTotal = (qty * rate) - (Number(item.discount) || 0);


        const prodInfo = await db.get('SELECT brand, supplier_id FROM products WHERE id = ? AND tenant_id = ?', [item.product_id, tenantId]);
        const itemBrand = item.brand ? item.brand.trim() : (prodInfo?.brand || null);

        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const itemBatchNo = (item.batch_no && item.batch_no.trim())
          ? item.batch_no.trim()
          : `LOT-${yy}${mm}-${Date.now().toString().slice(-4)}${idx > 0 ? '-' + (idx + 1) : ''}`;

        await db.run(`
          INSERT INTO purchase_items (
            tenant_id, purchase_id, product_id, brand, batch_no, expiry_date,
            quantity, unit, unit_price, discount, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId,
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
        ]);

        const prod = await db.get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [item.product_id, tenantId]);
        const batchSalePrice = item.sale_price !== undefined && item.sale_price !== '' && Number(item.sale_price) > 0
          ? Number(item.sale_price)
          : (Number(prod?.sale_price) || 0);
        const batchWholesalePrice = item.wholesale_price !== undefined && item.wholesale_price !== '' && Number(item.wholesale_price) > 0
          ? Number(item.wholesale_price)
          : (Number(prod?.wholesale_price) || batchSalePrice);

        let batchId = null;
        const existingBatch = await db.get(`
          SELECT * FROM batches
          WHERE product_id = ? AND batch_no = ? AND supplier_id = ? AND status = 'active' AND tenant_id = ?
        `, [item.product_id, itemBatchNo, supplier_id, tenantId]);

        if (existingBatch) {
          await db.run('UPDATE batches SET quantity = quantity + ?, purchase_price = ? WHERE id = ? AND tenant_id = ?',
            [qty, rate, existingBatch.id, tenantId]);
          batchId = existingBatch.id;
        } else {
          const exp = item.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
          const bRes = await db.run(`
            INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [tenantId, item.product_id, itemBatchNo, exp, qty, rate, batchSalePrice, batchWholesalePrice, item.storage_location || null, supplier_id]);
          batchId = bRes.lastInsertRowid;
        }

        await db.run(`
          UPDATE products SET
            purchase_price = ?,
            sale_price = CASE WHEN ? > 0.0 THEN ? ELSE sale_price END,
            wholesale_price = CASE WHEN ? > 0.0 THEN ? ELSE wholesale_price END,
            supplier_id = COALESCE(supplier_id, ?),
            brand = COALESCE(brand, ?),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `, [rate, batchSalePrice, batchSalePrice, batchWholesalePrice, batchWholesalePrice, supplier_id, itemBrand, item.product_id, tenantId]);

        await db.run(`
          INSERT INTO supplier_products (tenant_id, supplier_id, product_id, last_purchase_price, last_purchased_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(tenant_id, supplier_id, product_id) DO UPDATE SET
            last_purchase_price = excluded.last_purchase_price,
            last_purchased_at = CURRENT_TIMESTAMP
        `, [tenantId, supplier_id, item.product_id, rate]);

        const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?",
          [item.product_id, tenantId]);
        const newTotal = Number(stockRow?.s || 0);

        await db.run(`
          INSERT INTO inventory_movements (
            tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
            balance_after, reference_id, reference_type, reason, user_id
          ) VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?, ?, 'PURCHASE_INVOICE', ?, ?)
        `, [
          tenantId,
          item.product_id,
          batchId,
          qty,
          rate,
          newTotal,
          purchaseId,
          `Purchase Invoice ${finalInvoice} (${supplier.name})`,
          req.user?.id || 1
        ]);
      }

      // Update Supplier Balance atomically in SQL
      if (Math.abs(balance_due) > 0.001) {
        await db.run('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ? AND tenant_id = ?',
          [balance_due, supplier_id, tenantId]);
      }

      // If paid > 0, record supplier payment
      if (paid > 0) {
        await db.run(`
          INSERT INTO payments (
            tenant_id, type, party_type, party_id, reference_id, reference_no,
            amount, payment_method, payment_date, notes, user_id
          ) VALUES (?, 'SUPPLIER_PAYMENT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId,
          supplier_id,
          purchaseId,
          finalInvoice,
          paid,
          payment_method || 'Cash',
          purchase_date || new Date().toISOString().split('T')[0],
          `Payment on purchase #${finalInvoice}`,
          req.user?.id || 1
        ]);
      }

      await logAudit(
        req.user?.id || 1,
        req.user?.full_name || 'Admin',
        'CREATE',
        'PURCHASE',
        purchaseId,
        `Created purchase ${finalInvoice} from supplier ${supplier.name} for ₨ ${grand_total} (Paid: ₨ ${paid})`,
        req
      );

      return { id: purchaseId, invoice_no: finalInvoice, grand_total, balance_due };
    });

    return res.status(201).json({ success: true, message: 'Purchase invoice saved successfully.', data: result, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Purchase Return
exports.createPurchaseReturn = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { original_purchase_id, reason, items } = req.body;

      if (!original_purchase_id || !items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Original purchase ID and return items are required.');
      }

      const origPurchase = await db.get('SELECT * FROM purchases WHERE id = ? AND tenant_id = ?', [original_purchase_id, tenantId]);
      if (!origPurchase) {
        throw new Error('Original purchase not found.');
      }

      const retNo = await db.getNextNumber(tenantId, 'purchase_return', 'PRET');
      let totalAmount = 0;

      for (const item of items) {
        totalAmount += (Number(item.quantity) * Number(item.unit_price));
      }

      const retRes = await db.run(`
        INSERT INTO returns (tenant_id, return_no, type, original_invoice_id, original_invoice_no, party_id, total_amount, reason, user_id)
        VALUES (?, ?, 'PURCHASE_RETURN', ?, ?, ?, ?, ?, ?)
      `, [tenantId, retNo, origPurchase.id, origPurchase.invoice_no, origPurchase.supplier_id, totalAmount, reason || 'Return to supplier', req.user?.id || 1]);

      const returnId = retRes.lastInsertRowid;

      for (const item of items) {
        const qty = Number(item.quantity);
        const rate = Number(item.unit_price);
        const lineTotal = qty * rate;

        await db.run(`
          INSERT INTO return_items (tenant_id, return_id, product_id, batch_id, quantity, unit_price, total_amount, condition)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [tenantId, returnId, item.product_id, item.batch_id || null, qty, rate, lineTotal, item.condition || 'RESELLABLE']);

        if (item.batch_id) {
          await db.run('UPDATE batches SET quantity = GREATEST(0, quantity - ?) WHERE id = ? AND tenant_id = ?', [qty, item.batch_id, tenantId]);
        } else {
          const b = await db.get("SELECT id, quantity FROM batches WHERE product_id = ? AND status = 'active' AND quantity > 0 AND tenant_id = ? ORDER BY (expiry_date IS NULL), expiry_date, created_at, id LIMIT 1", [item.product_id, tenantId]);
          if (b) {
            await db.run('UPDATE batches SET quantity = GREATEST(0, quantity - ?) WHERE id = ? AND tenant_id = ?', [qty, b.id, tenantId]);
          }
        }

        const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [item.product_id, tenantId]);
        const totalAfter = Number(stockRow?.s || 0);

        await db.run(`
          INSERT INTO inventory_movements (tenant_id, product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_id, reference_type, reason, user_id)
          VALUES (?, ?, ?, 'RETURN', ?, ?, ?, ?, 'PURCHASE_RETURN', ?, ?)
        `, [tenantId, item.product_id, item.batch_id || null, -qty, rate, totalAfter, returnId, `Purchase return ${retNo}`, req.user?.id || 1]);
      }

      // Reduce supplier balance atomically
      await db.run('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ? AND tenant_id = ?', [totalAmount, origPurchase.supplier_id, tenantId]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'RETURN', 'PURCHASE', returnId, `Created purchase return ${retNo} for ₨ ${totalAmount}`, req);

      return { return_no: retNo, total_amount: totalAmount };
    });

    return res.status(201).json({ success: true, message: 'Purchase return processed successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete Purchase
exports.deletePurchase = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { id } = req.params;

      const purchase = await db.get('SELECT * FROM purchases WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!purchase) throw new Error('Purchase invoice not found.');

      const retRow = await db.get('SELECT COUNT(*) as count FROM returns WHERE original_invoice_id = ? AND tenant_id = ?', [id, tenantId]);
      if (retRow && Number(retRow.count) > 0) {
        throw new Error('Cannot delete a purchase that has return records. Delete the returns first or contact admin.');
      }

      const items = await db.all('SELECT * FROM purchase_items WHERE purchase_id = ? AND tenant_id = ?', [id, tenantId]);

      for (const item of items) {
        const batch = await db.get(`
          SELECT * FROM batches WHERE product_id = ? AND batch_no = ? AND supplier_id = ? AND tenant_id = ?
        `, [item.product_id, item.batch_no, purchase.supplier_id, tenantId]);

        if (batch) {
          const newQty = Number(batch.quantity) - Number(item.quantity);
          if (newQty <= 0) {
            await db.run("UPDATE batches SET quantity = 0, status = 'expired' WHERE id = ? AND tenant_id = ?", [batch.id, tenantId]);
          } else {
            await db.run('UPDATE batches SET quantity = ? WHERE id = ? AND tenant_id = ?', [newQty, batch.id, tenantId]);
          }
        }
      }

      await db.run("DELETE FROM inventory_movements WHERE reference_id = ? AND reference_type = 'PURCHASE_INVOICE' AND tenant_id = ?", [id, tenantId]);

      if (Number(purchase.balance_due) > 0) {
        await db.run('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ? AND tenant_id = ?',
          [purchase.balance_due, purchase.supplier_id, tenantId]);
      }

      if (Number(purchase.paid_amount) > 0) {
        await db.run("DELETE FROM payments WHERE reference_id = ? AND party_type = 'SUPPLIER' AND party_id = ? AND tenant_id = ?",
          [id, purchase.supplier_id, tenantId]);
      }

      await db.run('DELETE FROM purchase_items WHERE purchase_id = ? AND tenant_id = ?', [id, tenantId]);
      await db.run('DELETE FROM purchases WHERE id = ? AND tenant_id = ?', [id, tenantId]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'DELETE', 'PURCHASE', id, `Deleted purchase ${purchase.invoice_no} (₨ ${purchase.grand_total})`, req);
      return { success: true, message: `Purchase ${purchase.invoice_no} deleted successfully.` };
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updatePurchase = async (req, res) => {

  const tenantId = req.tenantId || req.tenant_id;
  const { id } = req.params;
  const { supplier_id, supplier_invoice_no, purchase_date, paid_amount, payment_method, notes } = req.body;

  try {
    const result = await db.transaction(async (tx) => {
      const runner = tx.get ? tx : db;
      const purchase = await runner.get('SELECT * FROM purchases WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!purchase) {
        throw new Error('Purchase record not found.');
      }

      const newSupplierId = supplier_id || purchase.supplier_id;
      const newPaid = paid_amount !== undefined ? Number(paid_amount) : Number(purchase.paid_amount);
      const newBalance = Number(purchase.grand_total) - newPaid;

      if (purchase.supplier_id !== newSupplierId) {
        if (Number(purchase.balance_due) > 0) {
          await runner.run('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ? AND tenant_id = ?', [purchase.balance_due, purchase.supplier_id, tenantId]);
        }
        if (newBalance > 0) {
          await runner.run('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ? AND tenant_id = ?', [newBalance, newSupplierId, tenantId]);
        }
      } else {
        const balanceDiff = newBalance - Number(purchase.balance_due);
        if (balanceDiff !== 0) {
          await runner.run('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ? AND tenant_id = ?', [balanceDiff, newSupplierId, tenantId]);
        }
      }

      await runner.run(`
        UPDATE purchases SET
          supplier_id = ?, supplier_invoice_no = ?, purchase_date = ?,
          paid_amount = ?, balance_due = ?,
          payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `, [
        newSupplierId,
        supplier_invoice_no !== undefined ? (supplier_invoice_no || null) : purchase.supplier_invoice_no,
        purchase_date || purchase.purchase_date,
        newPaid,
        newBalance,
        payment_method || purchase.payment_method,
        notes !== undefined ? (notes || null) : purchase.notes,
        id,
        tenantId
      ]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'UPDATE', 'PURCHASE', id, `Updated purchase ${purchase.invoice_no}`, req);
      return { success: true, message: 'Purchase updated successfully.' };
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};


// Preview existing stock & active batches with vendor history for a product
exports.getProductStockPreview = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { productId } = req.params;
    const product = await db.get(`
      SELECT p.id, p.name, p.sku, p.brand, p.unit, p.purchase_price, p.sale_price, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id AND s.tenant_id = p.tenant_id

      WHERE p.id = ? AND p.tenant_id = ?
    `, [String(productId), tenantId]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const batches = await db.all(`
      SELECT b.id, b.batch_no, b.quantity, b.purchase_price, b.sale_price, b.wholesale_price, b.expiry_date, b.created_at,
        COALESCE(s.name, 'Initial Opening') as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id AND s.tenant_id = b.tenant_id
      WHERE b.product_id = ? AND b.status = 'active' AND b.quantity > 0 AND b.tenant_id = ?
      ORDER BY b.id ASC
    `, [product.id, tenantId]);

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

// Fetch supplier-linked products with fallback to full catalog
exports.getSupplierProducts = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { supplierId } = req.params;

    // Query supplier mapped products (via supplier_products, products.supplier_id, or past purchases)
    const mappedProducts = await db.all(`
      SELECT p.id, p.name, p.sku, p.barcode, p.brand, p.unit, p.sale_price, p.wholesale_price,
        COALESCE(
          (SELECT sp.last_purchase_price FROM supplier_products sp WHERE sp.product_id = p.id AND sp.supplier_id = ? AND sp.tenant_id = p.tenant_id),
          (SELECT pi.unit_price FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pi.product_id = p.id AND pu.supplier_id = ? AND pu.tenant_id = p.tenant_id ORDER BY pu.id DESC LIMIT 1),
          p.purchase_price,
          0
        ) as last_purchase_cost,
        COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.status = 'active' AND b.tenant_id = p.tenant_id), 0) as current_stock,
        1 as is_mapped
      FROM products p
      WHERE p.tenant_id = ? AND p.status = 'active'
        AND (
          p.supplier_id = ?
          OR EXISTS (SELECT 1 FROM supplier_products sp WHERE sp.product_id = p.id AND sp.supplier_id = ? AND sp.tenant_id = p.tenant_id)
          OR EXISTS (SELECT 1 FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pi.product_id = p.id AND pu.supplier_id = ? AND pu.tenant_id = p.tenant_id)
        )
      ORDER BY p.name ASC
    `, [supplierId, supplierId, tenantId, supplierId, supplierId, supplierId]);

    // Query all catalog products
    const allProducts = await db.all(`
      SELECT p.id, p.name, p.sku, p.barcode, p.brand, p.unit, p.sale_price, p.wholesale_price,
        COALESCE(
          (SELECT sp.last_purchase_price FROM supplier_products sp WHERE sp.product_id = p.id AND sp.supplier_id = ? AND sp.tenant_id = p.tenant_id),
          (SELECT pi.unit_price FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pi.product_id = p.id AND pu.supplier_id = ? AND pu.tenant_id = p.tenant_id ORDER BY pu.id DESC LIMIT 1),
          p.purchase_price,
          0
        ) as last_purchase_cost,
        COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.status = 'active' AND b.tenant_id = p.tenant_id), 0) as current_stock,
        CASE WHEN (
          p.supplier_id = ?
          OR EXISTS (SELECT 1 FROM supplier_products sp WHERE sp.product_id = p.id AND sp.supplier_id = ? AND sp.tenant_id = p.tenant_id)
          OR EXISTS (SELECT 1 FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pi.product_id = p.id AND pu.supplier_id = ? AND pu.tenant_id = p.tenant_id)
        ) THEN 1 ELSE 0 END as is_mapped
      FROM products p
      WHERE p.tenant_id = ? AND p.status = 'active'
      ORDER BY p.name ASC
    `, [supplierId, supplierId, supplierId, supplierId, supplierId, tenantId]);

    return res.json({
      success: true,
      supplier_id: Number(supplierId),
      mapped_products: mappedProducts,
      all_products: allProducts,
      mapped_count: mappedProducts.length
    });
  } catch (err) {
    console.error('Error fetching supplier products:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch supplier products.' });
  }
};
