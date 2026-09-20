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

// Admin: Get all staff password reset requests
exports.getPasswordResetRequests = (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT 
        r.*,
        u.role as user_role,
        u.status as user_status,
        admin.full_name as resolved_by_name
      FROM password_reset_requests r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users admin ON r.resolved_by = admin.id
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.id DESC
    `).all();

    const pendingCount = db.prepare("SELECT COUNT(*) as count FROM password_reset_requests WHERE status = 'pending'").get().count;

    return res.json({ success: true, requests, pending_count: pendingCount });
  } catch (err) {
    console.error('Error fetching password reset requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reset requests.' });
  }
};

// Admin: Approve and set new password or Reject request
exports.resolvePasswordResetRequest = (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const { action, new_password, admin_note } = req.body;

    const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(id);
    if (!request) {
      throw new Error('Reset request not found.');
    }

    if (request.status !== 'pending') {
      throw new Error(`This request has already been ${request.status}.`);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user_id);
    if (!user) {
      throw new Error('Target user account no longer exists.');
    }

    if (action === 'approve') {
      if (!new_password || new_password.trim().length < 6) {
        throw new Error('New password must be at least 6 characters long.');
      }

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(new_password.trim(), salt);

      // Update user password
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hash, user.id);

      // Update request record with admin approval
      db.prepare(`
        UPDATE password_reset_requests SET
          status = 'approved',
          admin_note = ?,
          temporary_password = ?,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = ?
        WHERE id = ?
      `).run(
        admin_note ? admin_note.trim() : 'Password has been successfully reset by Administrator.',
        new_password.trim(),
        req.user.id,
        id
      );

      logAudit(req.user.id, req.user.full_name, 'RESET_PASSWORD_APPROVED', 'USER', user.id, `Admin approved password reset for user ${user.username}`, req);

      return {
        message: `Password for ${user.username} has been successfully reset!`,
        username: user.username,
        new_password: new_password.trim()
      };
    } else if (action === 'reject') {
      db.prepare(`
        UPDATE password_reset_requests SET
          status = 'rejected',
          admin_note = ?,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = ?
        WHERE id = ?
      `).run(
        admin_note ? admin_note.trim() : 'Password reset request rejected by Administrator.',
        req.user.id,
        id
      );

      logAudit(req.user.id, req.user.full_name, 'RESET_PASSWORD_REJECTED', 'USER', user.id, `Admin rejected password reset for user ${user.username}`, req);

      return {
        message: `Password reset request for ${user.username} has been rejected.`
      };
    } else {
      throw new Error('Invalid action. Must be approve or reject.');
    }
  });

  try {
    const result = transaction();
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

