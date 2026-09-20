const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

exports.getSettings = (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
};

exports.updateSettings = (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
    }

    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateTransaction = db.transaction((entries) => {
      for (const [key, val] of Object.entries(entries)) {
        upsert.run(key, String(val));
      }
    });

    updateTransaction(updates);

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'SETTINGS', null, `Updated system settings: ${Object.keys(updates).join(', ')}`, req);

    return res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
};

// UI Database Explorer (Admin Only)
exports.getDatabaseTables = (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all();

    const tableStats = tables.map(t => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
      return { name: t.name, count };
    });

    return res.json({ success: true, tables: tableStats });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch database tables.' });
  }
};

exports.getTableData = (req, res) => {
  try {
    const { tableName } = req.params;
    // Security check: ensure valid table name from schema
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Table does not exist.' });
    }

    const columnsInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    const columns = columnsInfo.map(c => ({ name: c.name, type: c.type, pk: c.pk }));

    const limit = Math.min(200, Number(req.query.limit) || 100);
    const rows = db.prepare(`SELECT * FROM "${tableName}" ORDER BY rowid DESC LIMIT ?`).all(limit);
    const totalRows = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get().count;

    return res.json({
      success: true,
      tableName,
      columns,
      totalRows,
      rows
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch table records.' });
  }
};

exports.updateTableRow = (req, res) => {
  try {
    const { tableName, id } = req.params;
    const updates = req.body;

    // Security check: verify table exists
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Table does not exist.' });
    }

    // Disallow editing audit_logs or internal schema
    if (tableName === 'audit_logs' || tableName.startsWith('sqlite_')) {
      return res.status(403).json({ success: false, message: 'Editing audit logs is strictly prohibited.' });
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided for update.' });
    }

    const columnsInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    const validColNames = columnsInfo.map(c => c.name);

    if (tableName === 'settings') {
      // settings uses `key` as PK
      const stmt = db.prepare("UPDATE settings SET value = ? WHERE key = ?");
      stmt.run(String(updates.value ?? ''), id);
    } else {
      // Standard table with id as PK
      const setClauses = [];
      const values = [];
      for (const [col, val] of Object.entries(updates)) {
        if (col === 'id' || !validColNames.includes(col)) continue;
        setClauses.push(`"${col}" = ?`);
        values.push(val === '' ? null : val);
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid columns provided to update.' });
      }

      values.push(id);
      const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      stmt.run(...values);
    }

    logAudit(req.user.id, req.user.full_name, 'UPDATE', tableName.toUpperCase(), id, `Updated record in ${tableName}: ${JSON.stringify(updates)}`, req);

    return res.json({ success: true, message: `Record in ${tableName} updated successfully.` });
  } catch (err) {
    console.error('Error updating table record:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update record.' });
  }
};

// Admin: Wipe dummy test data and set Mudassir Arif as sole Admin for delivery
exports.wipeDataForDelivery = (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const wipeTx = db.transaction(() => {
      db.prepare('DELETE FROM sale_items').run();
      db.prepare('DELETE FROM sales').run();
      db.prepare('DELETE FROM purchase_items').run();
      db.prepare('DELETE FROM purchases').run();
      db.prepare('DELETE FROM return_items').run();
      db.prepare('DELETE FROM returns').run();
      db.prepare('DELETE FROM payments').run();
      db.prepare('DELETE FROM expenses').run();
      db.prepare('DELETE FROM stock_adjustments').run();
      db.prepare('DELETE FROM inventory_movements').run();
      db.prepare('DELETE FROM batches').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM suppliers').run();
      db.prepare('DELETE FROM password_reset_requests').run();
      db.prepare('DELETE FROM audit_logs').run();

      // Keep only default Counter Walk-in Customer (id: 1)
      db.prepare('DELETE FROM customers WHERE id != 1').run();
      db.prepare('UPDATE customers SET current_balance = 0, opening_balance = 0 WHERE id = 1').run();

      // Update single Admin to Mudassir Arif, delete all demo staff
      const salt = bcrypt.genSaltSync(10);
      const adminHash = bcrypt.hashSync('admin123', salt);
      const existingAdmin = db.prepare('SELECT id FROM users WHERE id = 1').get();
      if (existingAdmin) {
        db.prepare("UPDATE users SET full_name = 'Mudassir Arif', username = 'admin', email = 'admin@latiftraders.com', password_hash = ?, role = 'admin', status = 'active' WHERE id = 1").run(adminHash);
      } else {
        db.prepare("INSERT INTO users (id, username, email, password_hash, full_name, role, status) VALUES (1, 'admin', 'admin@latiftraders.com', ?, 'Mudassir Arif', 'admin', 'active')").run(adminHash);
      }
      db.prepare('DELETE FROM users WHERE id != 1').run();

      // Reset auto increment sequence
      const tablesToReset = [
        'products', 'batches', 'inventory_movements', 'suppliers',
        'purchases', 'purchase_items', 'sales', 'sale_items',
        'payments', 'expenses', 'stock_adjustments', 'returns',
        'return_items', 'password_reset_requests', 'audit_logs'
      ];
      for (const tbl of tablesToReset) {
        try {
          db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tbl);
        } catch (_) {}
      }

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('production_delivery_wipe_done', 'true')").run();
    });

    wipeTx();

    return res.json({
      success: true,
      message: 'All dummy products, batches, sales, and demo staff successfully wiped. Mudassir Arif is sole Admin.'
    });
  } catch (err) {
    console.error('Wipe data error:', err);
    return res.status(500).json({ success: false, message: 'Failed to wipe data: ' + err.message });
  }
};



