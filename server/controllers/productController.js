const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

// List all products with calculated stock and category info
exports.getProducts = (req, res) => {
  try {
    const { search, category_id, low_stock, status } = req.query;

    let query = `
      SELECT p.*, c.name as category_name,
        COALESCE(SUM(b.quantity), 0) as current_stock,
        COUNT(b.id) as batch_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active'
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

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY p.id ORDER BY p.name ASC`;

    const products = db.prepare(query).all(...params);

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

// Get single product with batches and recent movements
exports.getProductById = (req, res) => {
  try {
    const { id } = req.params;
    const product = db.prepare(`
      SELECT p.*, c.name as category_name,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'active'
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const batches = db.prepare(`
      SELECT * FROM batches
      WHERE product_id = ? AND status = 'active'
      ORDER BY expiry_date ASC
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
      name, sku, barcode, category_id, brand, unit,
      purchase_price, sale_price, wholesale_price,
      min_stock_level, storage_location,
      opening_stock, batch_no, expiry_date
    } = req.body;

    if (!name || !sku) {
      throw new Error('Product name and SKU are required.');
    }

    // Check unique SKU
    const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
    if (existing) {
      throw new Error(`SKU "${sku}" is already assigned to another product.`);
    }

    const insertProd = db.prepare(`
      INSERT INTO products (
        name, sku, barcode, category_id, brand, unit,
        purchase_price, sale_price, wholesale_price,
        min_stock_level, storage_location, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = insertProd.run(
      name.trim(),
      sku.trim(),
      barcode ? barcode.trim() : null,
      category_id || null,
      brand ? brand.trim() : null,
      unit || 'pkt',
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
      const bNo = batch_no ? batch_no.trim() : `INIT-${Date.now().toString().slice(-6)}`;
      const expDate = expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

      const insertBatch = db.prepare(`
        INSERT INTO batches (product_id, batch_no, expiry_date, quantity, purchase_price, storage_location)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const bRes = insertBatch.run(productId, bNo, expDate, qty, Number(purchase_price) || 0, storage_location || null);

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
      name, sku, barcode, category_id, brand, unit,
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

    db.prepare(`
      UPDATE products SET
        name = ?, sku = ?, barcode = ?, category_id = ?, brand = ?, unit = ?,
        purchase_price = ?, sale_price = ?, wholesale_price = ?,
        min_stock_level = ?, storage_location = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      sku ? sku.trim() : existing.sku,
      barcode !== undefined ? barcode : existing.barcode,
      category_id !== undefined ? category_id : existing.category_id,
      updatedBrand,
      unit || existing.unit,
      Number(purchase_price) ?? existing.purchase_price,
      Number(sale_price) ?? existing.sale_price,
      Number(wholesale_price) ?? existing.wholesale_price,
      Number(min_stock_level) ?? existing.min_stock_level,
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
