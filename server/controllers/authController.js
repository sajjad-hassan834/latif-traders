const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

exports.login = (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set secure httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logAudit(user.id, user.full_name, 'LOGIN', 'USER', user.id, 'User logged in successfully', req);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during sign in.' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  if (req.user) {
    logAudit(req.user.id, req.user.full_name, 'LOGOUT', 'USER', req.user.id, 'User signed out', req);
  }
  return res.json({ success: true, message: 'Successfully signed out.' });
};

exports.getCurrentUser = (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
};

exports.changePassword = (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);
    logAudit(req.user.id, req.user.full_name, 'CHANGE_PASSWORD', 'USER', req.user.id, 'Changed personal password', req);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
};

exports.updateProfile = (req, res) => {
  try {
    const { full_name, email } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    db.prepare('UPDATE users SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(full_name.trim(), email ? email.trim() : null, req.user.id);

    const updatedUser = db.prepare('SELECT id, username, email, full_name, role, status FROM users WHERE id = ?').get(req.user.id);
    logAudit(req.user.id, full_name.trim(), 'UPDATE_PROFILE', 'USER', req.user.id, 'Updated personal profile details', req);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

// Staff submits a password reset request to Admin
exports.requestPasswordReset = (req, res) => {
  try {
    const { username, request_note, contact_info } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your Username or Staff ID.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT id, username, full_name, status FROM users WHERE LOWER(username) = ?').get(cleanUsername);
    if (!user) {
      return res.status(404).json({ success: false, message: `Staff username "${username}" not found. Please contact Administrator.` });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact Administrator directly.' });
    }

    // Check if there is already a pending request
    const existing = db.prepare("SELECT id, created_at FROM password_reset_requests WHERE LOWER(username) = ? AND status = 'pending'").get(cleanUsername);
    if (existing) {
      return res.json({
        success: true,
        alreadyPending: true,
        message: 'A password reset request is already pending Admin review. Admin has been notified.'
      });
    }

    const note = request_note && request_note.trim()
      ? `${request_note.trim()}${contact_info ? ' (Contact: ' + contact_info.trim() + ')' : ''}`
      : (contact_info ? `Contact: ${contact_info.trim()}` : 'Password reset requested via login terminal');

    const result = db.prepare(`
      INSERT INTO password_reset_requests (user_id, username, full_name, request_note, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(user.id, user.username, user.full_name, note);

    logAudit(user.id, user.full_name, 'FORGOT_PASSWORD_REQUEST', 'USER', user.id, `Password reset requested by ${user.username}`, req);

    return res.status(201).json({
      success: true,
      message: 'Password reset request submitted successfully! Your administrator has been notified to approve and set your new password.',
      requestId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit password reset request.' });
  }
};

// Staff checks the status of their reset request
exports.getResetRequestStatus = (req, res) => {
  try {
    const { username } = req.params;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const latest = db.prepare(`
      SELECT id, username, full_name, status, admin_note, temporary_password, created_at, resolved_at
      FROM password_reset_requests
      WHERE LOWER(username) = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(cleanUsername);

    return res.json({
      success: true,
      request: latest || null
    });
  } catch (err) {
    console.error('Fetch reset status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to check reset status.' });
  }
};

