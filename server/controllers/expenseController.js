const path = require('path');
const fs = require('fs');
const { db, DATA_DIR } = require('../config/database');
const { logAudit } = require('../middleware/audit');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const saveReceiptFile = (base64String, existingPath) => {
  if (!base64String) return existingPath || null;
  if (!base64String.startsWith('data:')) return base64String;
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      let ext = matches[1].split('/')[1] || 'png';
      if (ext.includes('jpeg')) ext = 'jpg';
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '');
      const filename = `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}.${safeExt}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));
      return `/uploads/${filename}`;
    }
  } catch (err) {
    console.error('Error writing receipt file:', err);
  }
  return existingPath || null;
};

// List expenses with category info
exports.getExpenses = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { start_date, end_date, category_id, payment_method, search } = req.query;

    let query = `
      SELECT e.*, ec.name as category_name, u.full_name as user_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id AND ec.tenant_id = e.tenant_id
      LEFT JOIN users u ON e.user_id = u.id AND u.tenant_id = e.tenant_id
      WHERE e.tenant_id = ?
    `;
    const params = [tenantId];

    if (search) {
      query += ' AND (e.title ILIKE ? OR e.description ILIKE ? OR ec.name ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (start_date) {
      query += ' AND e.expense_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND e.expense_date <= ?';
      params.push(end_date);
    }
    if (category_id) {
      query += ' AND e.category_id = ?';
      params.push(category_id);
    }
    if (payment_method) {
      query += ' AND e.payment_method = ?';
      params.push(payment_method);
    }

    query += ' ORDER BY e.expense_date DESC, e.id DESC';
    const expenses = await db.all(query, params);

    const totalAmount = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

    return res.json({ success: true, expenses, total_amount: totalAmount });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch expenses.' });
  }
};

// Create Expense
exports.createExpense = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { category_id, title, amount, payment_method, expense_date, description, receipt_path, receipt_base64 } = req.body;

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Expense title and a valid amount are required.' });
    }

    const savedReceipt = saveReceiptFile(receipt_base64, receipt_path);

    const result = await db.run(`
      INSERT INTO expenses (tenant_id, category_id, title, amount, payment_method, expense_date, description, receipt_path, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      category_id || null,
      title.trim(),
      Number(amount),
      payment_method || 'Cash',
      expense_date || new Date().toISOString().split('T')[0],
      description ? description.trim() : null,
      savedReceipt,
      req.user?.id || 1
    ]);

    await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'CREATE', 'EXPENSE', result.lastInsertRowid, `Recorded expense: ${title} (₨ ${amount})`, req);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, receipt_path: savedReceipt, message: 'Expense recorded.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update Expense
exports.updateExpense = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { category_id, title, amount, payment_method, expense_date, description, receipt_path, receipt_base64 } = req.body;


    const existing = await db.get('SELECT * FROM expenses WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
 (feat(stage-a4): complete Stage A4 database-level tenant isolation, deep verification, and http parity)
    if (!existing) return res.status(404).json({ success: false, message: 'Expense record not found.' });

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Expense title and a valid amount are required.' });
    }

    const savedReceipt = saveReceiptFile(receipt_base64, receipt_path !== undefined ? receipt_path : existing.receipt_path);

    await db.run(`
      UPDATE expenses
      SET category_id = ?, title = ?, amount = ?, payment_method = ?, expense_date = ?, description = ?, receipt_path = ?

      WHERE id = ? AND tenant_id = ?
 (feat(stage-a4): complete Stage A4 database-level tenant isolation, deep verification, and http parity)
    `, [
      category_id || null,
      title.trim(),
      Number(amount),
      payment_method || 'Cash',
      expense_date || existing.expense_date,
      description ? description.trim() : null,
      savedReceipt,
      String(id),
      tenantId
    ]);

    await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'UPDATE', 'EXPENSE', existing.id, `Updated expense #${id}: ${title} (₨ ${amount})`, req);

    return res.json({ success: true, message: 'Expense updated.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete expense (Admin only)
exports.deleteExpense = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM expenses WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Expense record not found.' });

    await db.run('DELETE FROM expenses WHERE id = ? AND tenant_id = ?', [String(id), tenantId]);
 (feat(stage-a4): complete Stage A4 database-level tenant isolation, deep verification, and http parity)
    await logAudit(req.user?.id || 1, req.user?.full_name || 'Admin', 'DELETE', 'EXPENSE', existing.id, `Deleted expense #${id}: ${existing.title} (₨ ${existing.amount})`, req);

    return res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete expense.' });
  }
};

// Expense Categories
exports.getCategories = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
 (feat(stage-a4): complete Stage A4 database-level tenant isolation, deep verification, and http parity)
    const categories = await db.all(`
      SELECT ec.*, COUNT(e.id) as expense_count, COALESCE(SUM(e.amount), 0) as total_spent
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.id = e.category_id AND e.tenant_id = ec.tenant_id
      WHERE ec.tenant_id = ?
      GROUP BY ec.id
      ORDER BY ec.name ASC
    `, [tenantId]);
    return res.json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch expense categories.' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

    const result = await db.run('INSERT INTO expense_categories (tenant_id, name, description) VALUES (?, ?, ?)',
      [tenantId, name.trim(), description ? description.trim() : null]);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Category created.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
