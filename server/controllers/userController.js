const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { logAudit } = require('../middleware/audit');

exports.getUsers = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const users = await db.all(`
      SELECT id, username, email, full_name, role, status, created_at, updated_at 
      FROM users 
      WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'
      ORDER BY id ASC
    `, [tenantId]);
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const plan = req.user?.plan || 'free';

    // Disallow creating superowner via UI
    if (req.body?.role === 'superowner') {
      return res.status(403).json({ success: false, message: 'Invalid role specified.' });
    }

    // Plan limits on staff users
    if (plan === 'free') {
      const uRow = await db.get("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'", [tenantId]);
      const userCount = uRow?.count || 0;
      if (userCount >= 1) {
        return res.status(403).json({
          success: false,
          limitReached: 'users',
          message: 'The Free plan is limited to 1 user account (owner only). Upgrade to Pro to add staff members.'
        });
      }
    } else if (plan === 'pro') {
      const uRow = await db.get("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (is_hidden IS NULL OR is_hidden = 0) AND role != 'superowner'", [tenantId]);
      const userCount = uRow?.count || 0;
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
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username is already taken by another account.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const result = await db.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `, [
      cleanUsername,
      email ? email.trim() : null,
      hash,
      full_name.trim(),
      role || 'sales',
      tenantId
    ]);

    await logAudit(req.user?.id, req.user?.full_name, 'CREATE', 'USER', result.lastInsertRowid, `Created staff user ${cleanUsername} (${role})`, req);

    return res.status(201).json({ success: true, message: 'Staff user created successfully.', id: result.lastInsertRowid });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;
    const { full_name, email, role, status, password } = req.body;

    if (role === 'superowner') {
      return res.status(403).json({ success: false, message: 'Cannot assign this role.' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!user || user.is_hidden === 1 || user.role === 'superowner') {
      return res.status(404).json({ success: false, message: 'User not found in your business.' });
    }

    if (user.is_system_account === 1 && !req.isSuperOwner) {
      return res.status(403).json({ success: false, message: 'System accounts cannot be modified.' });
    }

    // Protect master admin of tenant from being deactivated
    if (user.role === 'admin' && status === 'inactive' && Number(id) === req.user?.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own owner account.' });
    }

    let passwordHash = user.password_hash;
    if (password && password.trim().length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      passwordHash = bcrypt.hashSync(password.trim(), salt);
    }

    await db.run(`
      UPDATE users SET
        full_name = ?,
        email = ?,
        role = ?,
        status = ?,
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [
      full_name ? full_name.trim() : user.full_name,
      email !== undefined ? (email ? email.trim() : null) : user.email,
      role || user.role,
      status || user.status,
      passwordHash,
      id,
      tenantId
    ]);

    await logAudit(req.user?.id, req.user?.full_name, 'UPDATE', 'USER', id, `Updated staff user #${id}`, req);

    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { id } = req.params;

    if (Number(id) === req.user?.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own active account.' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!user || user.is_hidden === 1 || user.role === 'superowner') {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.is_system_account === 1) {
      return res.status(403).json({ success: false, message: 'System account cannot be deleted.' });
    }

    await db.run('DELETE FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    await logAudit(req.user?.id, req.user?.full_name, 'DELETE', 'USER', id, `Deleted staff user #${id} (${user.username})`, req);

    return res.json({ success: true, message: `User "${user.full_name}" deleted.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant_id;
    const { limit = 100 } = req.query;
    const logs = await db.all(`
      SELECT * FROM audit_logs
      WHERE tenant_id = ?
      ORDER BY id DESC
      LIMIT ?
    `, [tenantId, Number(limit)]);

    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

// Admin: Get all staff password reset requests
exports.getPasswordResetRequests = async (req, res) => {
  try {

    const tenantId = req.tenantId || req.tenant_id;
    const requests = await db.all(`
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
    `, [tenantId]);

    const pRow = await db.get("SELECT COUNT(*) as count FROM password_reset_requests WHERE status = 'pending' AND tenant_id = ?", [tenantId]);
    const pendingCount = pRow?.count || 0;

    return res.json({ success: true, requests, pending_count: pendingCount });
  } catch (err) {
    console.error('Error fetching password reset requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reset requests.' });
  }
};

// Admin: Approve and set new password or Reject request
exports.resolvePasswordResetRequest = async (req, res) => {

  const tenantId = req.tenantId || req.tenant_id;
  try {
    const result = await db.transaction(async (tx) => {
      const runner = tx.get ? tx : db;
      const { id } = req.params;
      const { action, new_password, admin_note } = req.body;

      const request = await runner.get('SELECT * FROM password_reset_requests WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!request) {
        throw new Error('Reset request not found.');
      }

      if (request.status !== 'pending') {
        throw new Error(`This request has already been ${request.status}.`);
      }

      const user = await runner.get('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [request.user_id, tenantId]);
      if (!user) {
        throw new Error('Target user account no longer exists.');
      }

      if (action === 'approve') {
        if (!new_password || new_password.trim().length < 6) {
          throw new Error('New password must be at least 6 characters long.');
        }


        const salt = bcrypt.genSaltSync(12);
        const hash = bcrypt.hashSync(new_password.trim(), salt);
        const tempExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // Update user password, set 24h temp_password_expires_at, temp_password_used=0, enforce password change on next login, and revoke prior sessions
        await runner.run(`
          UPDATE users 
          SET password_hash = ?, 
              must_change_password = 1, 
              temp_password_expires_at = ?,
              temp_password_used = 0,
              token_version = COALESCE(token_version, 1) + 1, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND tenant_id = ?
        `, [hash, tempExpiresAt, user.id, tenantId]);

        // Update request record with admin approval, NULL temporary_password, and mark used
        await runner.run(`
          UPDATE password_reset_requests SET
            status = 'approved',
            admin_note = ?,

            temporary_password = NULL,
            is_used = 1,
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = ?
          WHERE id = ? AND tenant_id = ?
        `, [
          admin_note ? admin_note.trim() : 'Password has been successfully reset by Administrator.',
          req.user?.id,
          id,
          tenantId
        ]);


        await logAudit(req.user?.id, req.user?.full_name, 'RESET_PASSWORD_APPROVED', 'USER', user.id, 'Admin approved password reset for staff user', req);

        return {
          message: `Temporary password for ${user.username} has been successfully generated!`,
          username: user.username,
          temporary_password: new_password.trim()
        };
      } else if (action === 'reject') {
        await runner.run(`
          UPDATE password_reset_requests SET
            status = 'rejected',
            admin_note = ?,
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = ?
          WHERE id = ? AND tenant_id = ?
        `, [
          admin_note ? admin_note.trim() : 'Password reset request rejected by Administrator.',
          req.user?.id,
          id,
          tenantId
        ]);

        await logAudit(req.user?.id, req.user?.full_name, 'RESET_PASSWORD_REJECTED', 'USER', user.id, `Admin rejected password reset for user ${user.username}`, req);

        return {
          message: `Password reset request for ${user.username} has been rejected.`
        };
      } else {
        throw new Error('Invalid action. Must be approve or reject.');
      }
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
