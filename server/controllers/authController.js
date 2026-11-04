const { BRAND_NAME } = require('../config/brand');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { seedNewTenant } = require('../config/seedTenant');

exports.register = async (req, res) => {
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

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
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
    while (await db.get('SELECT id FROM users WHERE username = ?', [username])) {
      username = `${baseUsername}${counter++}`;
    }

    const bType = businessType || 'retail_general';
    const chosenPlan = 'free';
    const planPrice = 0;

    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);

    let newUserId;

    await db.transaction(async () => {
      // 1. Create Tenant
      await db.run(`
        INSERT INTO tenants (id, business_name, business_type, owner_name, email, phone, address, plan, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        tenantId,
        businessName.trim(),
        bType,
        fullName.trim(),
        normalizedEmail,
        businessPhone || phone || '',
        city || '',
        chosenPlan
      ]);

      // 2. Create Subscription
      await db.run(`
        INSERT INTO subscriptions (tenant_id, plan, price, payment_status)
        VALUES (?, ?, ?, 'active')
      `, [tenantId, chosenPlan, planPrice]);


      // 3. Create Admin / Owner User with default token_version = 1, must_change_password = 0
      const userRes = await db.run(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
        VALUES (?, ?, ?, ?, 'admin', 'active', ?, 1, 0)
      `, [username, normalizedEmail, passwordHash, fullName.trim(), tenantId]);

      newUserId = userRes.lastInsertRowid;
    });

    // 4. Pre-seed default categories, units, expense categories, settings and walk-in customer
    try {
      seedNewTenant(
        tenantId,
        bType,
        businessName.trim(),
        normalizedEmail,
        businessPhone || phone || '',
        city || '',
        city || ''
      );
    } catch (_) {}

    // 5. Issue JWT Token with algorithm pinning
    const token = jwt.sign(
      {
        id: newUserId,
        username,
        role: 'admin',
        tenantId,
        token_version: 1,
        businessType: bType,
        plan: chosenPlan
      },
      JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });


    await logAudit(newUserId, fullName.trim(), 'REGISTER', 'TENANT', newUserId, `Registered new ${chosenPlan} business`, req);

    const tenantObj = {
      id: tenantId,
      business_name: businessName.trim(),
      business_type: bType,
      plan: chosenPlan,
      logo_url: null
    };

    return res.status(201).json({
      success: true,
      message: `Welcome to ${BRAND_NAME}, ${businessName}! Your business environment is ready.`,
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
        theme: 'brand',
        is_first_login: true,
        must_change_password: false,
        tenant: tenantObj
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error during business onboarding.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
    }

    const normalizedInput = username.trim().toLowerCase();
    const user = await db.get(`
      SELECT u.*, 
             COALESCE(u.token_version, 1) as token_version,
             COALESCE(u.must_change_password, 0) as must_change_password,
             COALESCE(t.business_name, '${BRAND_NAME} Business') as business_name,
             COALESCE(t.business_type, 'retail_general') as business_type,
             COALESCE(t.plan, 'free') as plan,
             COALESCE(t.plan_expires_at, null) as plan_expires_at,
             COALESCE(t.is_active, 1) as tenant_active,
             t.logo_url
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?
    `, [normalizedInput, normalizedInput]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username/email and password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is deactivated. Please contact your administrator.' });
    }

    if (user.role !== 'superowner') {
      if (!user.tenant_id) {
        return res.status(401).json({ success: false, message: 'No valid business tenant associated with this account.' });
      }
      if (Number(user.tenant_active) === 0) {
        return res.status(403).json({ success: false, message: 'Your business account is suspended or inactive. Please contact support.' });
      }
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username/email and password.' });
    }

    // Enforce 24h expiration and single use for temporary passwords
    if (Number(user.must_change_password) === 1) {
      if (user.temp_password_expires_at && new Date(user.temp_password_expires_at) < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Temporary password has expired (24-hour limit). Please request a new password reset.'
        });
      }
      if (Number(user.temp_password_used) === 1) {
        return res.status(401).json({
          success: false,
          message: 'Temporary password has already been used. Please request a new password reset.'
        });
      }

      // Mark temporary password as used (single-use enforcement)
      await db.run('UPDATE users SET temp_password_used = 1 WHERE id = ?', [user.id]);
    }

    const tokenTenantId = user.role === 'superowner' ? null : user.tenant_id;
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        tenant_id: tokenTenantId,
        token_version: user.token_version || 1,
        businessType: user.business_type || 'retail_general',
        plan: user.role === 'superowner' ? 'enterprise' : (user.plan || 'free')
      },
      JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    if (user.role === 'superowner') {
      await logAudit(null, 'System', 'LOGIN', 'SYSTEM', 0, 'System operator session initiated', req);
    } else {

      await logAudit(user.id, user.full_name, 'LOGIN', 'USER', user.id, `User logged in`, req);
    }

    const tenantObj = user.role === 'superowner' ? {
      id: 'superowner',
      business_name: '${BRAND_NAME} SuperOwner',
      business_type: 'retail_general',
      plan: 'enterprise',
      logo_url: null
    } : {
      id: user.tenant_id,
      business_name: user.business_name,
      business_type: user.business_type,
      plan: user.plan || 'free',
      plan_expires_at: user.plan_expires_at,
      logo_url: user.logo_url
    };

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        tenant_id: tokenTenantId,
        business_name: tenantObj.business_name,
        business_type: tenantObj.business_type,
        plan: tenantObj.plan,
        theme: user.theme || 'brand',
        logo_url: user.logo_url,
        must_change_password: Number(user.must_change_password) === 1,
        tenant: tenantObj
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during sign in.' });
  }
};

exports.logout = async (req, res) => {

  try {
    res.clearCookie('token');
    if (req.user) {
      await db.run('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?', [req.user.id]);
      await logAudit(req.user.id, req.user.full_name, 'LOGOUT', 'USER', req.user.id, 'User signed out', req);
    }
    return res.json({ success: true, message: 'Successfully signed out.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Server error during sign out.' });
  }
};

exports.getCurrentUser = (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const salt = bcrypt.genSaltSync(12);
    const newHash = bcrypt.hashSync(newPassword, salt);
    const newTokenVersion = (user.token_version || 1) + 1;


    await db.run(`
      UPDATE users 
      SET password_hash = ?, 
          must_change_password = 0, 
          temp_password_expires_at = NULL,
          temp_password_used = 0,
          token_version = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [newHash, newTokenVersion, req.user.id]);

    await logAudit(req.user.id, req.user.full_name, 'CHANGE_PASSWORD', 'USER', req.user.id, 'Changed personal password', req);

    // Issue refreshed token with the new token_version so active session can continue
    const tokenTenantId = user.role === 'superowner' ? null : user.tenant_id;
    const refreshedToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        tenant_id: tokenTenantId,
        token_version: newTokenVersion
      },
      JWT_SECRET,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    res.cookie('token', refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Password updated successfully.',
      token: refreshedToken
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, email } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    await db.run('UPDATE users SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [full_name.trim(), email ? email.trim() : null, req.user.id]);

    const updatedUser = await db.get('SELECT id, username, email, full_name, role, status FROM users WHERE id = ?', [req.user.id]);
    await logAudit(req.user.id, full_name.trim(), 'UPDATE_PROFILE', 'USER', req.user.id, 'Updated personal profile details', req);

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

// Security: Generic response returned in all scenarios to prevent username enumeration,
// including identical JSON shape with a 64-hex-char reset_token for existing and non-existing users
exports.requestPasswordReset = async (req, res) => {
  try {
    const { username, request_note, contact_info } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your Username or Staff ID.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    const user = await db.get('SELECT id, username, full_name, role, status, tenant_id FROM users WHERE LOWER(username) = ?', [cleanUsername]);

    // If user does not exist, or is superowner (superowner reset requests are silently blocked), or is inactive:
    // Generate a meaningless random reset token so the response shape is identical
    if (!user || user.role === 'superowner' || user.status !== 'active') {
      const meaninglessToken = crypto.randomBytes(32).toString('hex');
      return res.json({
        success: true,
        message: 'If an active account exists for this username, a reset request has been logged for your administrator.',
        reset_token: meaninglessToken
      });
    }

    // Generate secure random reset token and store only its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h expiry

    const note = request_note && request_note.trim()
      ? `${request_note.trim()}${contact_info ? ' (Contact: ' + contact_info.trim() + ')' : ''}`
      : (contact_info ? `Contact: ${contact_info.trim()}` : 'Password reset requested via login terminal');


    await db.run(`
      INSERT INTO password_reset_requests (tenant_id, user_id, username, full_name, request_note, status, reset_token_hash, expires_at, is_used)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0)
    `, [user.tenant_id, user.id, user.username, user.full_name, note, resetTokenHash, expiresAt]);

    await logAudit(user.id, user.full_name, 'FORGOT_PASSWORD_REQUEST', 'USER', user.id, 'Password reset requested via login terminal', req);

    return res.json({
      success: true,
      message: 'If an active account exists for this username, a reset request has been logged for your administrator.',
      reset_token: rawToken
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
  }
};

// Staff checks the status of their reset request by token only
exports.getResetRequestStatus = async (req, res) => {
  try {
    const token = req.query.token || req.params.token;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const request = await db.get(`
      SELECT status, expires_at, is_used
      FROM password_reset_requests
      WHERE reset_token_hash = ?
      ORDER BY id DESC
      LIMIT 1
    `, [tokenHash]);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    // Verify 24h expiration
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This reset token has expired.' });
    }

    return res.json({
      success: true,
      status: request.status
    });
  } catch (err) {
    console.error('Fetch reset status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to check reset status.' });
  }
};
