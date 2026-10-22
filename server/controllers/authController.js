const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { seedNewTenant } = require('../config/seedTenant');

exports.register = (req, res) => {
  try {
    const fullName = (req.body.fullName || req.body.full_name || '').trim();
    const email = (req.body.email || '').trim();
    const password = req.body.password || '';
    const phone = (req.body.phone || req.body.mobile || '').trim();
    const businessName = (req.body.businessName || req.body.business_name || '').trim();
    const businessType = req.body.businessType || req.body.business_type || 'retail_general';
    const city = (req.body.city || req.body.location || '').trim();
    const businessPhone = (req.body.businessPhone || req.body.business_phone || phone || '').trim();
    const plan = req.body.plan || 'free';

    if (!fullName || !email || !password || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, password, and business name are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    // Generate unique tenant ID and clean username
    const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 15) || 'shop';
    const tenantId = `t_${baseSlug}_${crypto.randomBytes(3).toString('hex')}`;
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'owner';
    let username = baseUsername;
    let counter = 1;
    while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      username = `${baseUsername}${counter++}`;
    }

    const bType = businessType || 'retail_general';
    const chosenPlan = ['free', 'pro', 'enterprise'].includes(plan) ? plan : 'free';
    const planPrice = chosenPlan === 'enterprise' ? 6999 : (chosenPlan === 'pro' ? 2999 : 0);

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    let newUserId;

    const registerTx = db.transaction(() => {
      // 1. Create Tenant
      db.prepare(`
        INSERT INTO tenants (id, business_name, business_type, owner_name, email, phone, address, plan, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        tenantId,
        businessName.trim(),
        bType,
        fullName.trim(),
        normalizedEmail,
        businessPhone || phone || '',
        city || '',
        chosenPlan
      );

      // 2. Create Subscription
      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan, price, payment_status)
        VALUES (?, ?, ?, 'active')
      `).run(tenantId, chosenPlan, planPrice);

      // 3. Create Admin / Owner User
      const userRes = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id)
        VALUES (?, ?, ?, ?, 'admin', 'active', ?)
      `).run(username, normalizedEmail, passwordHash, fullName.trim(), tenantId);

      newUserId = userRes.lastInsertRowid;
    });

    registerTx();

    // 4. Pre-seed default categories, units, expense categories, settings and walk-in customer
    seedNewTenant(
      tenantId,
      bType,
      businessName.trim(),
      normalizedEmail,
      businessPhone || phone || '',
      city || '',
      city || ''
    );

    // 5. Issue JWT Token with tenant payload
    const token = jwt.sign(
      {
        id: newUserId,
        username,
        role: 'admin',
        tenantId,
        businessType: bType,
        plan: chosenPlan
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logAudit(newUserId, fullName.trim(), 'REGISTER', 'TENANT', newUserId, `Registered new ${chosenPlan} tenant: ${businessName}`, req);

    return res.status(201).json({
      success: true,
      message: `Welcome to ShopOS, ${businessName}! Your business environment is ready.`,
      token,
      user: {
        id: newUserId,
        username,
        email: normalizedEmail,
        full_name: fullName.trim(),
        role: 'admin',
        tenant_id: tenantId,
        business_name: businessName.trim(),
        business_type: bType,
        plan: chosenPlan,
        theme: 'classic',
        is_first_login: true
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error during business onboarding.' });
  }
};

exports.login = (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
    }

    const normalizedInput = username.trim().toLowerCase();
    const user = db.prepare(`
      SELECT u.*, 
             COALESCE(t.business_name, 'ShopOS Business') as business_name,
             COALESCE(t.business_type, 'retail_general') as business_type,
             COALESCE(t.plan, 'free') as plan,
             COALESCE(t.is_active, 1) as tenant_active,
             t.logo_url
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?
    `).get(normalizedInput, normalizedInput);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username/email and password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is deactivated. Please contact your administrator.' });
    }

    if (user.tenant_active === 0 && user.role !== 'superowner') {
      return res.status(403).json({ success: false, message: 'Your business account is suspended or inactive. Please contact support.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username/email and password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenant_id || (user.role === 'superowner' ? null : 'latif_001'),
        businessType: user.business_type || 'retail_general',
        plan: user.plan || (user.role === 'superowner' ? 'enterprise' : 'free')
      },
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

    if (user.role === 'superowner') {
      logAudit(null, 'System', 'LOGIN', 'SYSTEM', 0, 'System operator session initiated', req);
    } else {
      logAudit(user.id, user.full_name, 'LOGIN', 'USER', user.id, `User logged in to tenant ${user.tenant_id}`, req);
    }

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        tenant_id: user.tenant_id || (user.role === 'superowner' ? null : 'latif_001'),
        business_name: user.role === 'superowner' ? 'ShopOS SuperOwner' : user.business_name,
        business_type: user.business_type,
        plan: user.role === 'superowner' ? 'enterprise' : user.plan,
        theme: user.theme || 'classic',
        logo_url: user.logo_url
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

