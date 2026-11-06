const { resolveOpeningBatch } = require('../utils/tradeBatch');
const { getPlanLimits } = require('../config/plans');
const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List all products with calculated stock, category, supplier and brand info
exports.getProducts = async (req, res) => {
  try {
    const { search, category_id, brand, supplier_id, low_stock, status } = req.query;
    const tenantId = req.tenantId || req.tenant_id;

    let query = `
      SELECT p.*, c.name as category_name, s.name as supplier_name,
        COALESCE(SUM(b.quantity), 0) as current_stock,
        COUNT(DISTINCT b.id) as batch_count,
        fifo_b.purchase_price as fifo_purchase_price,
        fifo_b.sale_price as fifo_sale_price,
        fifo_b.wholesale_price as fifo_wholesale_price,
        fifo_b.id as fifo_batch_id,
        fifo_b.batch_no as fifo_batch_no,
        fifo_b.quantity as fifo_batch_qty
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active'
      LEFT JOIN batches fifo_b ON fifo_b.id = (
        SELECT b2.id FROM batches b2
        WHERE b2.product_id = p.id AND b2.status = 'active' AND b2.quantity > 0
        ORDER BY b2.id ASC
        LIMIT 1
      )
      WHERE p.tenant_id = ?
    `;
    const params = [tenantId];

    if (search) {
      query += ` AND (p.name ILIKE ? OR p.sku ILIKE ? OR p.barcode ILIKE ? OR p.brand ILIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (category_id) {
      query += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    if (brand) {
      query += ` AND p.brand = ?`;
      params.push(brand);
    }

    if (supplier_id) {
      query += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY p.id, c.name, s.name, fifo_b.purchase_price, fifo_b.sale_price, fifo_b.wholesale_price, fifo_b.id, fifo_b.batch_no, fifo_b.quantity ORDER BY p.name ASC`;

    // Fetch all active batches in strict FIFO order (id ASC)
    const activeBatchesList = await db.all(`
      SELECT id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location
      FROM batches
      WHERE status = 'active' AND quantity > 0 AND tenant_id = ?
      ORDER BY id ASC
    `, [tenantId]);

    const batchesByProduct = {};
    for (const b of activeBatchesList) {
      if (!batchesByProduct[b.product_id]) batchesByProduct[b.product_id] = [];
      batchesByProduct[b.product_id].push({
        id: b.id,
        batch_no: b.batch_no,
        expiry_date: b.expiry_date,
        quantity: Number(b.quantity) || 0,
        purchase_price: Number(b.purchase_price) || 0,
        sale_price: Number(b.sale_price) || 0,
        wholesale_price: Number(b.wholesale_price) || 0,
        storage_location: b.storage_location
      });
    }

    const rawProducts = await db.all(query, params);
    const products = rawProducts.map(p => {
      const prodBatches = batchesByProduct[p.id] || [];
      const firstBatch = prodBatches.length > 0 ? prodBatches[0] : null;

      const activeSale = (firstBatch && firstBatch.sale_price > 0)
        ? firstBatch.sale_price
        : ((p.fifo_sale_price !== null && p.fifo_sale_price !== undefined && Number(p.fifo_sale_price) > 0)
            ? Number(p.fifo_sale_price)
            : Number(p.sale_price));

      const activeCost = (firstBatch && firstBatch.purchase_price > 0)
        ? firstBatch.purchase_price
        : ((p.fifo_purchase_price !== null && p.fifo_purchase_price !== undefined && Number(p.fifo_purchase_price) > 0)
            ? Number(p.fifo_purchase_price)
            : Number(p.purchase_price));

      const activeWholesale = (firstBatch && firstBatch.wholesale_price > 0)
        ? firstBatch.wholesale_price
        : ((p.fifo_wholesale_price !== null && p.fifo_wholesale_price !== undefined && Number(p.fifo_wholesale_price) > 0)
            ? Number(p.fifo_wholesale_price)
            : Number(p.wholesale_price));

      const totalStock = prodBatches.reduce((acc, b) => acc + b.quantity, 0);

      return {
        ...p,
        current_stock: totalStock,
        active_sale_price: activeSale,
        active_cost_price: activeCost,
        active_wholesale_price: activeWholesale,
        active_batches: prodBatches
      };
    });

    let filtered = products;
    if (low_stock === 'true') {
      filtered = filtered.filter(p => Number(p.current_stock) <= Number(p.min_stock_level));
    }

    return res.json({ success: true, products: filtered });
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
};

// Get single product with detailed batches and stock movements
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.tenant_id;

    const product = await db.get(`
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id

      WHERE p.id = ? AND p.tenant_id = ?
    `, [String(id), tenantId]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const batches = await db.all(`
      SELECT b.*, COALESCE(s.name, 'Default Vendor') as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = ? AND b.status = 'active' AND b.quantity > 0 AND b.tenant_id = ?
      ORDER BY b.id ASC
    `, [product.id, tenantId]);

    const movements = await db.all(`
      SELECT m.*, u.full_name as user_name, b.batch_no
      FROM inventory_movements m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN batches b ON m.batch_id = b.id
      WHERE m.product_id = ? AND m.tenant_id = ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [product.id, tenantId]);

    const totalStock = batches.reduce((sum, b) => sum + Number(b.quantity), 0);

    return res.json({
      success: true,
      product: {
        ...product,
        current_stock: totalStock,
        batches: batches || [],
        recent_movements: movements || []
      },
      batches: batches || [],
      movements: movements || []
    });
  } catch (err) {
    console.error('Error fetching product details:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch product details.' });
  }
};

// Create Product with opening batch
exports.createProduct = async (req, res) => {
  try {
    const newId = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const plan = (req.user?.plan || req.tenant?.plan || 'free').toLowerCase();
      const planLimits = getPlanLimits(plan);
      if (planLimits.products !== null) {
        const prodCountRes = await db.get('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [tenantId]);
        const currentCount = Number(prodCountRes?.count || 0);
        if (currentCount >= planLimits.products) {
          const err = new Error(`The ${plan.toUpperCase()} plan limit of ${planLimits.products} products has been reached. Upgrade to Pro for unlimited products.`);
          err.statusCode = 403;
          err.limitReached = 'products';
          throw err;
        }
      }
      const {
        name, sku, barcode, category_id, brand, unit, supplier_id,
        purchase_price, sale_price, wholesale_price,
        min_stock_level, storage_location,
        opening_stock, batch_no, expiry_date
      } = req.body;

      if (!name || !name.trim()) {
        throw new Error('Product name is required.');
      }

      let result;
      let finalSku = sku ? sku.trim().toUpperCase() : '';
      let finalBarcode = barcode && barcode.trim() ? barcode.trim() : null;

      for (let attempt = 0; attempt < 10; attempt++) {
        if (!finalSku || attempt > 0) {
          const brandClean = brand ? brand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() : 'SKU';
          const maxIdRes = await db.get('SELECT MAX(id) as maxId, COUNT(*) as count FROM products WHERE tenant_id = ?', [tenantId]);
          let seq = Number(maxIdRes?.maxId || maxIdRes?.count || 0) + 1 + attempt;
          finalSku = `${brandClean}-${String(seq).padStart(4, '0')}`;
          while (await db.get('SELECT id FROM products WHERE sku = ? AND tenant_id = ?', [finalSku, tenantId])) {
            seq++;
            finalSku = `${brandClean}-${String(seq).padStart(4, '0')}`;
          }
        } else {
          const existing = await db.get('SELECT id FROM products WHERE sku = ? AND tenant_id = ?', [finalSku, tenantId]);
          if (existing) {
            do {
              finalSku = `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
            } while (await db.get('SELECT id FROM products WHERE sku = ? AND tenant_id = ?', [finalSku, tenantId]));
          }
        }

        const barcodeToSave = finalBarcode || finalSku.replace(/[^a-zA-Z0-9]/g, '');

        try {
          result = await db.run(`
            INSERT INTO products (
              name, sku, barcode, category_id, brand, unit, supplier_id,
              purchase_price, sale_price, wholesale_price,
              min_stock_level, storage_location, status, tenant_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
          `, [
            name.trim(),
            finalSku,
            barcodeToSave,
            category_id ? Number(category_id) : null,
            brand ? brand.trim() : null,
            unit || 'pcs',
            supplier_id ? Number(supplier_id) : null,
            Number(purchase_price) || 0,
            Number(sale_price) || 0,
            Number(wholesale_price) || Number(sale_price) || 0,
            Number(min_stock_level) || 5,
            storage_location || null,
            tenantId
          ]);
          break;
        } catch (insertErr) {
          const isUniqueViolation = 
            (insertErr.message && insertErr.message.includes('UNIQUE constraint failed')) ||
            insertErr.code === '23505' ||
            insertErr.code === 'SQLITE_CONSTRAINT';
          if (isUniqueViolation && attempt < 9) {
            finalSku = '';
            continue;
          }
          throw insertErr;
        }
      }

      const productId = result.lastInsertRowid;

      const qty = Number(opening_stock) || 0;
      if (qty > 0) {
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const bNo = (batch_no && batch_no.trim())
          ? batch_no.trim()
          : `LOT-${yy}${mm}-${Date.now().toString().slice(-4)}`;
        const expDate = expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

        const bRes = await db.run(`
          INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location, supplier_id, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          productId, bNo, expDate, qty,
          Number(purchase_price) || 0,
          Number(sale_price) || 0,
          Number(wholesale_price) || Number(sale_price) || 0,
          storage_location || null,
          supplier_id ? Number(supplier_id) : null,
          tenantId
        ]);

        await db.run(`
          INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_type, reason, user_id, tenant_id)
          VALUES (?, ?, 'PURCHASE', ?, ?, ?, 'OPENING', 'Opening stock on product creation', ?, ?)
        `, [productId, bRes.lastInsertRowid, qty, Number(purchase_price) || 0, qty, req.user?.id || 1, tenantId]);
      }

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'CREATE', 'PRODUCT', productId, `Created product: ${name} (${finalSku})`, req);
      return productId;
    });

    return res.status(201).json({ success: true, message: 'Product created successfully.', id: newId });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, sku, barcode, category_id, brand, unit, supplier_id,
      purchase_price, sale_price, wholesale_price,
      min_stock_level, storage_location, status
    } = req.body;


    const tenantId = req.tenantId || req.tenant_id;
    const existing = await db.get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found in your catalog.' });
    }

    if (sku && sku !== existing.sku) {
      const duplicate = await db.get('SELECT id FROM products WHERE sku = ? AND CAST(id AS TEXT) != ? AND tenant_id = ?', [sku, String(id), tenantId]);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `SKU "${sku}" is already in use.` });
      }
    }

    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superowner');
    const updatedBrand = isAdmin && brand !== undefined ? (brand ? brand.trim() : null) : existing.brand;

    const finalPurchasePrice = (purchase_price !== undefined && purchase_price !== null && purchase_price !== '' && !isNaN(Number(purchase_price)))
      ? Number(purchase_price)
      : Number(existing.purchase_price);

    const finalSalePrice = (sale_price !== undefined && sale_price !== null && sale_price !== '' && !isNaN(Number(sale_price)))
      ? Number(sale_price)
      : Number(existing.sale_price);

    const finalWholesalePrice = (wholesale_price !== undefined && wholesale_price !== null && wholesale_price !== '' && !isNaN(Number(wholesale_price)))
      ? Number(wholesale_price)
      : Number(existing.wholesale_price);

    const finalMinStock = (min_stock_level !== undefined && min_stock_level !== null && min_stock_level !== '' && !isNaN(Number(min_stock_level)))
      ? Number(min_stock_level)
      : Number(existing.min_stock_level);

    await db.run(`
      UPDATE products SET
        name = ?, sku = ?, barcode = ?, category_id = ?, brand = ?, unit = ?, supplier_id = ?,
        purchase_price = ?, sale_price = ?, wholesale_price = ?,
        min_stock_level = ?, storage_location = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [
      name ? name.trim() : existing.name,
      sku ? sku.trim() : existing.sku,
      barcode !== undefined ? barcode : existing.barcode,
      category_id !== undefined ? (category_id ? Number(category_id) : null) : existing.category_id,
      updatedBrand,
      unit || existing.unit,
      supplier_id !== undefined ? (supplier_id ? Number(supplier_id) : null) : existing.supplier_id,
      finalPurchasePrice,
      finalSalePrice,
      finalWholesalePrice,
      finalMinStock,
      storage_location !== undefined ? storage_location : existing.storage_location,
      status || existing.status,
      existing.id,
      tenantId
    ]);

    if (isAdmin) {
      const priceChanged = finalPurchasePrice !== Number(existing.purchase_price) || finalSalePrice !== Number(existing.sale_price) || finalWholesalePrice !== Number(existing.wholesale_price);
      if (priceChanged) {
        await db.run(`
          UPDATE batches SET
            purchase_price = ?,
            sale_price = ?,
            wholesale_price = ?
          WHERE product_id = ? AND status = 'active' AND tenant_id = ?
        `, [finalPurchasePrice, finalSalePrice, finalWholesalePrice, existing.id, tenantId]);
      }
    }

    await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'UPDATE', 'PRODUCT', existing.id, `Updated product #${existing.id}`, req);

    return res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { force, archive } = req.query;
    const tenantId = req.tenantId || req.tenant_id;


    const product = await db.get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in your catalog.' });
    }

    if (archive === 'true') {
      await db.run("UPDATE products SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [product.id, tenantId]);
      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'ARCHIVE', 'PRODUCT', product.id, `Archived product #${product.id}: ${product.name}`, req);
      return res.json({ success: true, message: `Product "${product.name}" has been marked as Inactive.` });
    }

    const salesRow = await db.get('SELECT COUNT(*) as c FROM sale_items WHERE product_id = ?', [product.id]);
    const purchasesRow = await db.get('SELECT COUNT(*) as c FROM purchase_items WHERE product_id = ?', [product.id]);

    const adjustmentsRow = await db.get('SELECT COUNT(*) as c FROM stock_adjustments WHERE product_id = ? AND tenant_id = ?', [product.id, tenantId]);
    const returnsRow = await db.get('SELECT COUNT(*) as c FROM return_items WHERE product_id = ?', [product.id]);

    const salesCount = Number(salesRow?.c || 0);
    const purchasesCount = Number(purchasesRow?.c || 0);
    const adjustmentsCount = Number(adjustmentsRow?.c || 0);
    const returnsCount = Number(returnsRow?.c || 0);
    const totalReferences = salesCount + purchasesCount + adjustmentsCount + returnsCount;

    if (totalReferences > 0 && force !== 'true') {
      return res.json({
        success: false,
        hasHistory: true,
        salesCount,
        purchasesCount,
        adjustmentsCount,
        returnsCount,
        message: `Product "${product.name}" has ${totalReferences} transaction records (${salesCount} sales, ${purchasesCount} purchases).`
      });
    }

    await db.transaction(async () => {
      if (totalReferences > 0 && force === 'true') {
        await db.run('DELETE FROM return_items WHERE product_id = ?', [product.id]);

        await db.run('DELETE FROM stock_adjustments WHERE product_id = ? AND tenant_id = ?', [product.id, tenantId]);
        await db.run('DELETE FROM sale_items WHERE product_id = ?', [product.id]);
        await db.run('DELETE FROM purchase_items WHERE product_id = ?', [product.id]);
      }


      await db.run('DELETE FROM inventory_movements WHERE product_id = ? AND tenant_id = ?', [product.id, tenantId]);
      await db.run('DELETE FROM batches WHERE product_id = ? AND tenant_id = ?', [product.id, tenantId]);
      await db.run('DELETE FROM products WHERE id = ? AND tenant_id = ?', [product.id, tenantId]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'DELETE', 'PRODUCT', product.id, `Deleted product #${product.id}: ${product.name} (${product.sku})`, req);
    });

    return res.json({
      success: true,
      message: `Product "${product.name}" was successfully deleted.`
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete product.' });
  }
};

// Stock Adjustment (damage, melted, sample, counting difference)
exports.adjustStock = async (req, res) => {
  try {
    const result = await db.transaction(async () => {
      const { product_id, batch_id, type, quantity, reason } = req.body;

      const tenantId = req.tenantId || req.tenant_id;

      if (!product_id || !type || !quantity || !reason) {
        throw new Error('Product, adjustment type, quantity, and reason are required.');
      }

      const qty = Number(quantity);
      if (qty <= 0) {
        throw new Error('Adjustment quantity must be greater than 0.');
      }

      const product = await db.get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [product_id, tenantId]);
      if (!product) {
        throw new Error('Product not found.');
      }

      let targetBatch = null;
      if (batch_id) {
        targetBatch = await db.get('SELECT * FROM batches WHERE id = ? AND product_id = ? AND tenant_id = ?', [batch_id, product_id, tenantId]);
      } else {
        targetBatch = await db.get("SELECT * FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ? ORDER BY (expiry_date IS NULL), expiry_date, created_at, id LIMIT 1", [product_id, tenantId]);
      }

      if (!targetBatch) {
        throw new Error('No active batch found for this product.');
      }

      const isReduction = ['DAMAGE', 'EXPIRED', 'MELTED', 'SAMPLE', 'LOST', 'COUNT_REDUCE'].includes(type);
      const delta = isReduction ? -qty : qty;

      if (isReduction && Number(targetBatch.quantity) < qty) {
        throw new Error(`Cannot adjust ${qty} units. Batch ${targetBatch.batch_no} currently has only ${targetBatch.quantity} units available.`);
      }

      const newBatchQty = Number(targetBatch.quantity) + delta;
      await db.run('UPDATE batches SET quantity = ? WHERE id = ? AND tenant_id = ?', [newBatchQty, targetBatch.id, tenantId]);

      const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [product_id, tenantId]);
      const totalStock = Number(stockRow?.s || 0);

      const adjNo = await db.getNextNumber(tenantId, 'stock_adjustment', 'ADJ');

      await db.run(`
        INSERT INTO stock_adjustments (tenant_id, adjustment_no, product_id, batch_id, type, quantity, unit_cost, reason, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [tenantId, adjNo, product_id, targetBatch.id, type, qty, targetBatch.purchase_price, reason, req.user?.id || 1]);

      await db.run(`
        INSERT INTO inventory_movements (tenant_id, product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_type, reason, user_id)
        VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, 'STOCK_ADJUSTMENT', ?, ?)
      `, [tenantId, product_id, targetBatch.id, delta, targetBatch.purchase_price, totalStock, `${type}: ${reason}`, req.user?.id || 1]);

      await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'ADJUST', 'STOCK', product_id, `Stock adjustment ${adjNo}: ${delta} units (${type}) for ${product.name}`, req);

      return { adjustment_no: adjNo, new_stock: totalStock };
    });

    return res.json({ success: true, message: 'Stock adjustment recorded successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Get stock adjustments history
exports.getAdjustments = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const adjustments = await db.all(`
      SELECT sa.*, p.name as product_name, p.sku, p.unit, b.batch_no, u.full_name as user_name
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN batches b ON sa.batch_id = b.id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE sa.tenant_id = ?
      ORDER BY sa.created_at DESC
      LIMIT 100
    `, [tenantId]);

    return res.json({ success: true, adjustments });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch adjustments history.' });
  }
};

// Quick Restock Product
exports.restockProduct = async (req, res) => {
  try {
    const result = await db.transaction(async () => {

      const tenantId = req.tenantId || req.tenant_id;
      const { id } = req.params;
      const { quantity, purchase_price, sale_price, wholesale_price, supplier_id, batch_no, expiry_date, storage_location } = req.body;

      const qty = Number(quantity);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0.');


      const product = await db.get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
      if (!product) throw new Error('Product not found.');

      const pPrice = purchase_price !== undefined && purchase_price !== '' ? Number(purchase_price) : Number(product.purchase_price);
      const sPrice = sale_price !== undefined && sale_price !== '' ? Number(sale_price) : Number(product.sale_price);
      const wPrice = wholesale_price !== undefined && wholesale_price !== '' ? Number(wholesale_price) : Number(product.wholesale_price);
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const batchCode = (batch_no && batch_no.trim())
        ? batch_no.trim()
        : `LOT-${yy}${mm}-${Date.now().toString().slice(-4)}`;
      const exp = expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

      const bRes = await db.run(`
        INSERT INTO batches (tenant_id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location, supplier_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [tenantId, product.id, batchCode, exp, qty, pPrice, sPrice, wPrice, storage_location || product.storage_location, supplier_id ? Number(supplier_id) : (product.supplier_id || null)]);

      await db.run(`
        UPDATE products SET
          purchase_price = ?,
          sale_price = ?,
          wholesale_price = ?,
          supplier_id = COALESCE(?, supplier_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `, [
        pPrice,
        sPrice,
        wPrice,
        supplier_id ? Number(supplier_id) : null,
        product.id,
        tenantId
      ]);

      const stockRow = await db.get("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active' AND tenant_id = ?", [product.id, tenantId]);
      const newTotal = Number(stockRow?.s || 0);

      await db.run(`
        INSERT INTO inventory_movements (
          tenant_id, product_id, batch_id, type, quantity_delta, unit_price,
          balance_after, reference_type, reason, user_id
        ) VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?, 'DIRECT_RESTOCK', ?, ?)
      `, [
        tenantId,
        product.id,
        bRes.lastInsertRowid,
        qty,
        pPrice,
        newTotal,
        `Inward Restock Lot ${batchCode} (+${qty} ${product.unit})`,
        req.user?.id || 1
      ]);

      return { success: true, message: `Successfully added ${qty} ${product.unit} to ${product.name}! Available stock is now ${newTotal} ${product.unit}.` };
    });

    return res.json(result);
  } catch (err) {
    console.error('Restock error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Categories CRUD
exports.getCategories = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const categories = await db.all(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.tenant_id = c.tenant_id
      WHERE c.tenant_id = ?
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [tenantId]);
    return res.json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

    const result = await db.run('INSERT INTO categories (tenant_id, name, description) VALUES (?, ?, ?)',
      [tenantId, name.trim(), description ? description.trim() : null]);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Category added.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Category name is required.' });
    await db.run('UPDATE categories SET name = ?, description = ? WHERE id = ? AND tenant_id = ?',
      [name.trim(), description ? description.trim() : null, String(id), tenantId]);
    return res.json({ success: true, message: 'Category updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    await db.run('UPDATE products SET category_id = NULL WHERE category_id = ? AND tenant_id = ?', [String(id), tenantId]);
    await db.run('DELETE FROM categories WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Units CRUD
exports.getUnits = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const units = await db.all('SELECT * FROM units WHERE tenant_id = ? ORDER BY name ASC', [tenantId]);
    return res.json({ success: true, units });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch units.' });
  }
};

exports.createUnit = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { name, short_code } = req.body;
    if (!name || !short_code) return res.status(400).json({ success: false, message: 'Unit name and short code required.' });

    const result = await db.run('INSERT INTO units (tenant_id, name, short_code) VALUES (?, ?, ?)',
      [tenantId, name.trim(), short_code.trim().toLowerCase()]);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Unit added.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { name, short_code } = req.body;
    if (!name || !short_code) return res.status(400).json({ success: false, message: 'Name and short code required.' });
    await db.run('UPDATE units SET name = ?, short_code = ? WHERE id = ? AND tenant_id = ?',
      [name.trim(), short_code.trim().toLowerCase(), String(id), tenantId]);
    return res.json({ success: true, message: 'Unit updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    await db.run('DELETE FROM units WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    return res.json({ success: true, message: 'Unit deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Brands CRUD
exports.getBrands = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const brands = await db.all(`
      SELECT b.*, COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON b.name = p.brand AND p.tenant_id = b.tenant_id
      WHERE b.tenant_id = ?
      GROUP BY b.id
      ORDER BY b.name ASC
    `, [tenantId]);
    return res.json({ success: true, brands });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch brands.' });
  }
};

exports.createBrand = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Brand name is required.' });

    const result = await db.run('INSERT INTO brands (tenant_id, name, description) VALUES (?, ?, ?)',
      [tenantId, name.trim(), description ? description.trim() : null]);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Brand added successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message.includes('UNIQUE') ? 'Brand already exists.' : err.message });
  }
};

exports.updateBrand = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Brand name is required.' });
    const existing = await db.get('SELECT name FROM brands WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    if (existing && existing.name !== name.trim()) {
      await db.run('UPDATE products SET brand = ? WHERE brand = ? AND tenant_id = ?', [name.trim(), existing.name, tenantId]);
    }
    await db.run('UPDATE brands SET name = ?, description = ? WHERE id = ? AND tenant_id = ?',
      [name.trim(), description ? description.trim() : null, String(id), tenantId]);
    return res.json({ success: true, message: 'Brand updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;

    const existing = await db.get('SELECT name FROM brands WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    if (existing) {
      await db.run('UPDATE products SET brand = NULL WHERE brand = ? AND tenant_id = ?', [existing.name, tenantId]);
    }
    await db.run('DELETE FROM brands WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    return res.json({ success: true, message: 'Brand deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
