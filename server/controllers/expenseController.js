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
exports.getExpenses = (req, res) => {
  try {
    const { start_date, end_date, category_id, payment_method, search } = req.query;

    let query = `
      SELECT e.*, ec.name as category_name, u.full_name as user_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (e.title LIKE ? OR e.description LIKE ? OR ec.name LIKE ?)';
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
    const expenses = db.prepare(query).all(...params);

    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

    return res.json({ success: true, expenses, total_amount: totalAmount });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch expenses.' });
  }
};

// Create Expense
exports.createExpense = (req, res) => {
  try {
    const { category_id, title, amount, payment_method, expense_date, description, receipt_path, receipt_base64 } = req.body;

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Expense title and a valid amount are required.' });
    }

    const savedReceipt = saveReceiptFile(receipt_base64, receipt_path);

    const stmt = db.prepare(`
      INSERT INTO expenses (category_id, title, amount, payment_method, expense_date, description, receipt_path, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      category_id || null,
      title.trim(),
      Number(amount),
      payment_method || 'Cash',
      expense_date || new Date().toISOString().split('T')[0],
      description ? description.trim() : null,
      savedReceipt,
      req.user.id
    );

    logAudit(req.user.id, req.user.full_name, 'CREATE', 'EXPENSE', result.lastInsertRowid, `Recorded expense: ${title} (₨ ${amount})`, req);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, receipt_path: savedReceipt, message: 'Expense recorded.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Update Expense
exports.updateExpense = (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, title, amount, payment_method, expense_date, description, receipt_path, receipt_base64 } = req.body;

    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Expense record not found.' });

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Expense title and a valid amount are required.' });
    }

    const savedReceipt = saveReceiptFile(receipt_base64, receipt_path !== undefined ? receipt_path : existing.receipt_path);

    db.prepare(`
      UPDATE expenses
      SET category_id = ?, title = ?, amount = ?, payment_method = ?, expense_date = ?, description = ?, receipt_path = ?
      WHERE id = ?
    `).run(
      category_id || null,
      title.trim(),
      Number(amount),
      payment_method || 'Cash',
      expense_date || existing.expense_date,
      description ? description.trim() : null,
      savedReceipt,
      id
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'EXPENSE', id, `Updated expense #${id}: ${title} (₨ ${amount})`, req);

    return res.json({ success: true, message: 'Expense updated.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete expense (Admin only)
exports.deleteExpense = (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Expense record not found.' });

    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    logAudit(req.user.id, req.user.full_name, 'DELETE', 'EXPENSE', id, `Deleted expense #${id}: ${existing.title} (₨ ${existing.amount})`, req);

    return res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete expense.' });
  }
};

// Expense Categories
exports.getCategories = (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT ec.*, COUNT(e.id) as expense_count, COALESCE(SUM(e.amount), 0) as total_spent
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.id = e.category_id
      GROUP BY ec.id
      ORDER BY ec.name ASC
    `).all();
    return res.json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch expense categories.' });
  }
};

exports.createCategory = (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

    const stmt = db.prepare('INSERT INTO expense_categories (name, description) VALUES (?, ?)');
    const result = stmt.run(name.trim(), description ? description.trim() : null);

    return res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Category created.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
