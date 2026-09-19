const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

exports.getSettings = (req, res) => {
  try {
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

