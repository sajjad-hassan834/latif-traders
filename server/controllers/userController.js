const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

exports.getUsers = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const users = db.prepare(`
      SELECT id, username, email, full_name, role, status, created_at, updated_at 
      FROM users 
      WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'
      ORDER BY id ASC
    `).all(tenantId);
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

exports.createUser = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const plan = req.user?.plan || 'free';

    // Disallow creating superowner via UI
    if (req.body?.role === 'superowner') {
      return res.status(403).json({ success: false, message: 'Invalid role specified.' });
    }

    // Plan limits on staff users
    if (plan === 'free') {
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'").get(tenantId)?.count || 0;
      if (userCount >= 1) {
        return res.status(403).json({
          success: false,
          limitReached: 'users',
          message: 'The Free plan is limited to 1 user account (owner only). Upgrade to Pro to add staff members.'
        });
      }
    } else if (plan === 'pro') {
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'").get(tenantId)?.count || 0;
      if (userCount >= 5) {
        return res.status(403).json({
          success: false,
          limitReached: 'users',
          message: 'The Pro plan is limited to 5 staff accounts. Upgrade to Enterprise for unlimited users.'
        });
      }
    }

    const { username, email, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, password, and full name are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username is already taken by another account.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `);

    const result = stmt.run(
      cleanUsername,
      email ? email.trim() : null,
      hash,
      full_name.trim(),
      role || 'sales',
      tenantId
    );

    logAudit(req.user.id, req.user.full_name, 'CREATE', 'USER', result.lastInsertRowid, `Created staff user ${cleanUsername} (${role})`, req);

    return res.status(201).json({ success: true, message: 'Staff user created successfully.', id: result.lastInsertRowid });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUser = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const { id } = req.params;
    const { full_name, email, role, status, password } = req.body;

    if (role === 'superowner') {
      return res.status(403).json({ success: false, message: 'Cannot assign this role.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!user || user.is_hidden === 1 || user.role === 'superowner') {
      return res.status(404).json({ success: false, message: 'User not found in your business.' });
    }

    if (user.is_system_account === 1 && !req.isSuperOwner) {
      return res.status(403).json({ success: false, message: 'System accounts cannot be modified.' });
    }

    // Protect master admin of tenant from being deactivated
    if (user.role === 'admin' && status === 'inactive' && Number(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own owner account.' });
    }

    let passwordHash = user.password_hash;
    if (password && password.trim().length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      passwordHash = bcrypt.hashSync(password.trim(), salt);
    }

    db.prepare(`
      UPDATE users SET
        full_name = ?,
        email = ?,
        role = ?,
        status = ?,
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(
      full_name ? full_name.trim() : user.full_name,
      email !== undefined ? (email ? email.trim() : null) : user.email,
      role || user.role,
      status || user.status,
      passwordHash,
      id,
      tenantId
    );

    logAudit(req.user.id, req.user.full_name, 'UPDATE', 'USER', id, `Updated staff user #${id}`, req);

    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteUser = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const { id } = req.params;

    if (Number(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own active account.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!user || user.is_hidden === 1 || user.role === 'superowner') {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.is_system_account === 1) {
      return res.status(403).json({ success: false, message: 'System account cannot be deleted.' });
    }

    db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').run(id, tenantId);
    logAudit(req.user.id, req.user.full_name, 'DELETE', 'USER', id, `Deleted staff user #${id} (${user.username})`, req);

    return res.json({ success: true, message: `User "${user.full_name}" deleted.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
};

exports.getAuditLogs = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const { limit = 100 } = req.query;
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      WHERE tenant_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(tenantId, Number(limit));

    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

// Admin: Get all staff password reset requests
exports.getPasswordResetRequests = (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
    const requests = db.prepare(`
      SELECT 
        r.*,
        u.role as user_role,
        u.status as user_status,
        admin.full_name as resolved_by_name
      FROM password_reset_requests r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users admin ON r.resolved_by = admin.id
      WHERE r.tenant_id = ?
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.id DESC
    `).all(tenantId);

    const pendingCount = db.prepare("SELECT COUNT(*) as count FROM password_reset_requests WHERE status = 'pending' AND tenant_id = ?").get(tenantId)?.count || 0;

    return res.json({ success: true, requests, pending_count: pendingCount });
  } catch (err) {
    console.error('Error fetching password reset requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reset requests.' });
  }
};

// Admin: Approve and set new password or Reject request
exports.resolvePasswordResetRequest = (req, res) => {
  const tenantId = req.tenant_id || req.user?.tenant_id || 'latif_001';
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const { action, new_password, admin_note } = req.body;

    const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!request) {
      throw new Error('Reset request not found.');
    }

    if (request.status !== 'pending') {
      throw new Error(`This request has already been ${request.status}.`);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(request.user_id, tenantId);
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
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?')
        .run(hash, user.id, tenantId);

      // Update request record with admin approval
      db.prepare(`
        UPDATE password_reset_requests SET
          status = 'approved',
          admin_note = ?,
          temporary_password = ?,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = ?
        WHERE id = ? AND tenant_id = ?
      `).run(
        admin_note ? admin_note.trim() : 'Password has been successfully reset by Administrator.',
        new_password.trim(),
        req.user.id,
        id,
        tenantId
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
        WHERE id = ? AND tenant_id = ?
      `).run(
        admin_note ? admin_note.trim() : 'Password reset request rejected by Administrator.',
        req.user.id,
        id,
        tenantId
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
