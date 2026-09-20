const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List all products with calculated stock, category, supplier and brand info
exports.getProducts = (req, res) => {
  try {
    const { search, category_id, brand, supplier_id, low_stock, status } = req.query;

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
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)`;
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

    query += ` GROUP BY p.id ORDER BY p.name ASC`;

    // Fetch all active batches in strict FIFO order (id ASC)
    const activeBatchesList = db.prepare(`
      SELECT id, product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location
      FROM batches
      WHERE status = 'active' AND quantity > 0
      ORDER BY id ASC
    `).all();

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

    const products = db.prepare(query).all(...params).map(p => {
      const prodBatches = batchesByProduct[p.id] || [];

      // Dynamic FIFO Active Batch Pricing:
      // First active batch or fallback to catalog price
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

      return {
        ...p,
        sale_price: activeSale,
        purchase_price: activeCost,
        wholesale_price: activeWholesale,
        catalog_sale_price: p.sale_price,
        catalog_purchase_price: p.purchase_price,
        catalog_wholesale_price: p.wholesale_price,
        fifo_batch_id: firstBatch ? firstBatch.id : p.fifo_batch_id,
        fifo_batch_no: firstBatch ? firstBatch.batch_no : p.fifo_batch_no,
        fifo_batch_qty: firstBatch ? firstBatch.quantity : p.fifo_batch_qty,
        batches: prodBatches
      };
    });

    // Filter low stock if requested
    const result = low_stock === 'true'
      ? products.filter(p => p.current_stock <= p.min_stock_level)
      : products;

    return res.json({ success: true, products: result });
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
};

// Get single product with batches (including supplier) and recent movements
exports.getProductById = (req, res) => {
  try {
    const { id } = req.params;
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, s.name as supplier_name,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active'
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Return batches in strict FIFO order (id ASC) with vendor supplier details
    const batches = db.prepare(`
      SELECT b.*, s.name as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = ? AND b.status = 'active'
      ORDER BY b.id ASC
    `).all(id);

    const movements = db.prepare(`
      SELECT m.*, u.full_name as user_name
      FROM inventory_movements m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.product_id = ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `).all(id);

    return res.json({ success: true, product, batches, movements });
  } catch (err) {
    console.error('Error fetching product detail:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch product details.' });
  }
};

// Create a new product
exports.createProduct = (req, res) => {
  const transaction = db.transaction(() => {
    const {
      name, sku, barcode, category_id, brand, unit, supplier_id,
      purchase_price, sale_price, wholesale_price,
      min_stock_level, storage_location,
      opening_stock, batch_no, expiry_date
    } = req.body;

    if (!name || !name.trim()) {
      throw new Error('Product name is required.');
    }

    // Auto-generate clean unique SKU if not manually specified
    let finalSku = sku ? sku.trim().toUpperCase() : '';
    if (!finalSku) {
      const brandClean = brand ? brand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() : 'LT';
      const maxIdRes = db.prepare('SELECT MAX(id) as maxId, COUNT(*) as count FROM products').get();
      let seq = (maxIdRes?.maxId || maxIdRes?.count || 0) + 1;
      finalSku = `${brandClean || 'LT'}-${String(seq).padStart(4, '0')}`;
      while (db.prepare('SELECT id FROM products WHERE sku = ?').get(finalSku)) {
        seq++;
        finalSku = `${brandClean || 'LT'}-${String(seq).padStart(4, '0')}`;
      }
    } else {
      // Check unique SKU if manually specified
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(finalSku);
      if (existing) {
        throw new Error(`SKU "${finalSku}" is already assigned to another product.`);
      }
    }

    // Auto-generate barcode matching SKU if empty
    const finalBarcode = barcode && barcode.trim()
      ? barcode.trim()
      : finalSku.replace(/[^a-zA-Z0-9]/g, '');

    const insertProd = db.prepare(`
      INSERT INTO products (
        name, sku, barcode, category_id, brand, unit, supplier_id,
        purchase_price, sale_price, wholesale_price,
        min_stock_level, storage_location, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = insertProd.run(
      name.trim(),
      finalSku,
      finalBarcode,
      category_id || null,
      brand ? brand.trim() : null,
      unit || 'pkt',
      supplier_id ? Number(supplier_id) : null,
      Number(purchase_price) || 0,
      Number(sale_price) || 0,
      Number(wholesale_price) || Number(sale_price) || 0,
      Number(min_stock_level) || 5,
      storage_location || null
    );

    const productId = result.lastInsertRowid;

    // If opening stock provided, create batch & movement
    const qty = Number(opening_stock) || 0;
    if (qty > 0) {
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const bNo = (batch_no && batch_no.trim())
        ? batch_no.trim()
        : `LOT-${yy}${mm}-${Date.now().toString().slice(-4)}`;
      const expDate = expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

      const insertBatch = db.prepare(`
        INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location, supplier_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const bRes = insertBatch.run(
        productId, bNo, expDate, qty,
        Number(purchase_price) || 0,
        Number(sale_price) || 0,
        Number(wholesale_price) || Number(sale_price) || 0,
        storage_location || null,
        supplier_id ? Number(supplier_id) : null
      );

      db.prepare(`
        INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_type, reason, user_id)
        VALUES (?, ?, 'PURCHASE', ?, ?, ?, 'OPENING', 'Opening stock on product creation', ?)
      `).run(productId, bRes.lastInsertRowid, qty, Number(purchase_price) || 0, qty, req.user.id);
    }

    logAudit(req.user.id, req.user.full_name, 'CREATE', 'PRODUCT', productId, `Created product: ${name} (${sku})`, req);
    return productId;
  });

  try {
    const newId = transaction();
    return res.status(201).json({ success: true, message: 'Product created successfully.', id: newId });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update product
exports.updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, sku, barcode, category_id, brand, unit, supplier_id,
      purchase_price, sale_price, wholesale_price,
      min_stock_level, storage_location, status
    } = req.body;

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (sku && sku !== existing.sku) {
      const duplicate = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku, id);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `SKU "${sku}" is already in use.` });
      }
    }

    const isAdmin = req.user && req.user.role === 'admin';
    const updatedBrand = isAdmin && brand !== undefined ? (brand ? brand.trim() : null) : existing.brand;

    const finalPurchasePrice = (purchase_price !== undefined && purchase_price !== null && purchase_price !== '' && !isNaN(Number(purchase_price)))
      ? Number(purchase_price)
      : existing.purchase_price;

    const finalSalePrice = (sale_price !== undefined && sale_price !== null && sale_price !== '' && !isNaN(Number(sale_price)))
      ? Number(sale_price)
      : existing.sale_price;

    const finalWholesalePrice = (wholesale_price !== undefined && wholesale_price !== null && wholesale_price !== '' && !isNaN(Number(wholesale_price)))
      ? Number(wholesale_price)
      : existing.wholesale_price;

    const finalMinStock = (min_stock_level !== undefined && min_stock_level !== null && min_stock_level !== '' && !isNaN(Number(min_stock_level)))
      ? Number(min_stock_level)
      : existing.min_stock_level;

    db.prepare(`
      UPDATE products SET
        name = ?, sku = ?, barcode = ?, category_id = ?, brand = ?, unit = ?, supplier_id = ?,
        purchase_price = ?, sale_price = ?, wholesale_price = ?,
        min_stock_level = ?, storage_location = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
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
      id
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'PRODUCT', id, `Updated product #${id}`, req);

    return res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
};

// Delete product
exports.deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    const { force, archive } = req.query;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // If archiving requested
    if (archive === 'true') {
      db.prepare("UPDATE products SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      logAudit(req.user.id, req.user.full_name, 'ARCHIVE', 'PRODUCT', id, `Archived product #${id}: ${product.name}`, req);
      return res.json({ success: true, message: `Product "${product.name}" has been marked as Inactive.` });
    }

    // Check if product is referenced in transactions
    const salesCount = db.prepare('SELECT COUNT(*) as c FROM sale_items WHERE product_id = ?').get(id)?.c || 0;
    const purchasesCount = db.prepare('SELECT COUNT(*) as c FROM purchase_items WHERE product_id = ?').get(id)?.c || 0;
    const adjustmentsCount = db.prepare('SELECT COUNT(*) as c FROM stock_adjustments WHERE product_id = ?').get(id)?.c || 0;
    const returnsCount = db.prepare('SELECT COUNT(*) as c FROM return_items WHERE product_id = ?').get(id)?.c || 0;

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

    const transaction = db.transaction(() => {
      if (totalReferences > 0 && force === 'true') {
        db.prepare('DELETE FROM return_items WHERE product_id = ?').run(id);
        db.prepare('DELETE FROM stock_adjustments WHERE product_id = ?').run(id);
        db.prepare('DELETE FROM sale_items WHERE product_id = ?').run(id);
        db.prepare('DELETE FROM purchase_items WHERE product_id = ?').run(id);
      }

      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM batches WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);

      logAudit(req.user.id, req.user.full_name, 'DELETE', 'PRODUCT', id, `Deleted product #${id}: ${product.name} (${product.sku})`, req);
    });

    transaction();

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
exports.adjustStock = (req, res) => {
  const transaction = db.transaction(() => {
    const { product_id, batch_id, type, quantity, reason } = req.body;

    if (!product_id || !type || !quantity || !reason) {
      throw new Error('Product, adjustment type, quantity, and reason are required.');
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      throw new Error('Adjustment quantity must be greater than 0.');
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      throw new Error('Product not found.');
    }

    let targetBatch = null;
    if (batch_id) {
      targetBatch = db.prepare('SELECT * FROM batches WHERE id = ? AND product_id = ?').get(batch_id, product_id);
    } else {
      targetBatch = db.prepare("SELECT * FROM batches WHERE product_id = ? AND status = 'active' ORDER BY expiry_date ASC LIMIT 1").get(product_id);
    }

    if (!targetBatch) {
      throw new Error('No active batch found for this product.');
    }

    // Adjust batch quantity: if DAMAGE, EXPIRED, MELTED, SAMPLE -> decrease.
    // If COUNT_DIFF, can increase or decrease (specified in type or notes).
    const isReduction = ['DAMAGE', 'EXPIRED', 'MELTED', 'SAMPLE', 'LOST', 'COUNT_REDUCE'].includes(type);
    const delta = isReduction ? -qty : qty;

    if (isReduction && targetBatch.quantity < qty) {
      throw new Error(`Cannot adjust ${qty} units. Batch ${targetBatch.batch_no} currently has only ${targetBatch.quantity} units available.`);
    }

    const newBatchQty = targetBatch.quantity + delta;
    db.prepare('UPDATE batches SET quantity = ? WHERE id = ?').run(newBatchQty, targetBatch.id);

    // Calculate new total stock
    const totalStock = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(product_id).s;

    // Record adjustment
    const adjNo = `ADJ-${Date.now().toString().slice(-7)}`;
    db.prepare(`
      INSERT INTO stock_adjustments (adjustment_no, product_id, batch_id, type, quantity, unit_cost, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adjNo, product_id, targetBatch.id, type, qty, targetBatch.purchase_price, reason, req.user.id);

    // Record inventory movement
    db.prepare(`
      INSERT INTO inventory_movements (product_id, batch_id, type, quantity_delta, unit_price, balance_after, reference_type, reason, user_id)
      VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, 'STOCK_ADJUSTMENT', ?, ?)
    `).run(product_id, targetBatch.id, delta, targetBatch.purchase_price, totalStock, `${type}: ${reason}`, req.user.id);

    logAudit(req.user.id, req.user.full_name, 'ADJUST', 'STOCK', product_id, `Stock adjustment ${adjNo}: ${delta} units (${type}) for ${product.name}`, req);

    return { adjustment_no: adjNo, new_stock: totalStock };
  });

  try {
    const result = transaction();
    return res.json({ success: true, message: 'Stock adjustment recorded successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Get stock adjustments history
exports.getAdjustments = (req, res) => {
  try {
    const adjustments = db.prepare(`
      SELECT sa.*, p.name as product_name, p.sku, p.unit, b.batch_no, u.full_name as user_name
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN batches b ON sa.batch_id = b.id
      LEFT JOIN users u ON sa.user_id = u.id
      ORDER BY sa.created_at DESC
      LIMIT 100
    `).all();

    return res.json({ success: true, adjustments });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch adjustments history.' });
  }
};

// Quick Restock Product (Inward new batch with FIFO & price update)
exports.restockProduct = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const { quantity, purchase_price, sale_price, wholesale_price, supplier_id, batch_no, expiry_date, storage_location } = req.body;

    const qty = Number(quantity);
    if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0.');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) throw new Error('Product not found.');

    const pPrice = purchase_price !== undefined && purchase_price !== '' ? Number(purchase_price) : product.purchase_price;
    const sPrice = sale_price !== undefined && sale_price !== '' ? Number(sale_price) : product.sale_price;
    const wPrice = wholesale_price !== undefined && wholesale_price !== '' ? Number(wholesale_price) : product.wholesale_price;
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const batchCode = (batch_no && batch_no.trim())
      ? batch_no.trim()
      : `LOT-${yy}${mm}-${Date.now().toString().slice(-4)}`;
    const exp = expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

    // Create new FIFO batch with its own cost and selling prices
    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, sale_price, wholesale_price, storage_location, supplier_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, batchCode, exp, qty, pPrice, sPrice, wPrice, storage_location || product.storage_location, supplier_id ? Number(supplier_id) : (product.supplier_id || null));

    // Update product latest purchase price and optional new sale_price
    db.prepare(`
      UPDATE products SET
        purchase_price = ?,
        sale_price = ?,
        wholesale_price = ?,
        supplier_id = COALESCE(?, supplier_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      pPrice,
      sPrice,
      wPrice,
      supplier_id ? Number(supplier_id) : null,
      id
    );

    // Record inventory movement
    const newTotal = db.prepare("SELECT COALESCE(SUM(quantity), 0) as s FROM batches WHERE product_id = ? AND status = 'active'").get(id).s;

    db.prepare(`
      INSERT INTO inventory_movements (
        product_id, batch_id, type, quantity_delta, unit_price,
        balance_after, reference_type, reason, user_id
      ) VALUES (?, ?, 'PURCHASE', ?, ?, ?, 'DIRECT_RESTOCK', ?, ?)
    `).run(
      id,
      bRes.lastInsertRowid,
      qty,
      pPrice,
      newTotal,
      `Inward Restock Lot ${batchCode} (+${qty} ${product.unit})`,
      req.user.id
    );

    return { success: true, message: `Successfully added ${qty} ${product.unit} to ${product.name}! Available stock is now ${newTotal} ${product.unit}.` };
  });

  try {
    const result = transaction();
    return res.json(result);
  } catch (err) {
    console.error('Restock error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Categories CRUD
exports.getCategories = (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();
    return res.json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
};

exports.createCategory = (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

    const stmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    const result = stmt.run(name.trim(), description ? description.trim() : null);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Category added.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Units CRUD
exports.getUnits = (req, res) => {
  try {
    const units = db.prepare('SELECT * FROM units ORDER BY name ASC').all();
    return res.json({ success: true, units });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch units.' });
  }
};

exports.createUnit = (req, res) => {
  try {
    const { name, short_code } = req.body;
    if (!name || !short_code) return res.status(400).json({ success: false, message: 'Unit name and short code required.' });

    const stmt = db.prepare('INSERT INTO units (name, short_code) VALUES (?, ?)');
    const result = stmt.run(name.trim(), short_code.trim().toLowerCase());

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Unit added.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Brands CRUD
exports.getBrands = (req, res) => {
  try {
    const brands = db.prepare(`
      SELECT b.*, COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON b.name = p.brand
      GROUP BY b.id
      ORDER BY b.name ASC
    `).all();
    return res.json({ success: true, brands });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch brands.' });
  }
};

exports.createBrand = (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Brand name is required.' });

    const stmt = db.prepare('INSERT INTO brands (name, description) VALUES (?, ?)');
    const result = stmt.run(name.trim(), description ? description.trim() : null);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Brand added successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message.includes('UNIQUE') ? 'Brand already exists.' : err.message });
  }
};

exports.updateCategory = (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Category name is required.' });
    db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(name.trim(), description ? description.trim() : null, id);
    return res.json({ success: true, message: 'Category updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteCategory = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUnit = (req, res) => {
  try {
    const { id } = req.params;
    const { name, short_code } = req.body;
    if (!name || !short_code) return res.status(400).json({ success: false, message: 'Name and short code required.' });
    db.prepare('UPDATE units SET name = ?, short_code = ? WHERE id = ?').run(name.trim(), short_code.trim().toLowerCase(), id);
    return res.json({ success: true, message: 'Unit updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteUnit = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM units WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Unit deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateBrand = (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Brand name is required.' });
    const existing = db.prepare('SELECT name FROM brands WHERE id = ?').get(id);
    if (existing && existing.name !== name.trim()) {
      db.prepare('UPDATE products SET brand = ? WHERE brand = ?').run(name.trim(), existing.name);
    }
    db.prepare('UPDATE brands SET name = ?, description = ? WHERE id = ?').run(name.trim(), description ? description.trim() : null, id);
    return res.json({ success: true, message: 'Brand updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBrand = (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT name FROM brands WHERE id = ?').get(id);
    if (existing) {
      db.prepare('UPDATE products SET brand = NULL WHERE brand = ?').run(existing.name);
    }
    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Brand deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
