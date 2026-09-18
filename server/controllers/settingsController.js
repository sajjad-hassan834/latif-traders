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
