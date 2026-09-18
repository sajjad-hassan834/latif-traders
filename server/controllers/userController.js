const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

exports.getUsers = (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, email, full_name, role, status, created_at, updated_at FROM users ORDER BY id ASC').all();
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

exports.createUser = (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, password, and full name are required.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

    const result = stmt.run(username.trim().toLowerCase(), email ? email.trim() : null, hash, full_name.trim(), role || 'sales');

    logAudit(req.user.id, req.user.full_name, 'CREATE', 'USER', result.lastInsertRowid, `Created user ${username} (${role})`, req);

    return res.status(201).json({ success: true, message: 'User created successfully.', id: result.lastInsertRowid });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUser = (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, status, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Protect master admin from being demoted or deactivated
    if (user.username === 'admin' && (status === 'inactive' || role !== 'admin')) {
      return res.status(400).json({ success: false, message: 'Master Admin cannot be deactivated or have role changed.' });
    }

    let passwordHash = user.password_hash;
    if (password && password.trim().length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      passwordHash = bcrypt.hashSync(password.trim(), salt);
    }

    db.prepare(`
      UPDATE users SET
        full_name = ?, email = ?, role = ?, status = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      full_name ? full_name.trim() : user.full_name,
      email !== undefined ? email : user.email,
      role || user.role,
      status || user.status,
      passwordHash,
      id
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'USER', id, `Updated user account #${id} (${user.username})`, req);

    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
};

exports.getAuditLogs = (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY id DESC
      LIMIT ?
    `).all(Number(limit));

    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};
