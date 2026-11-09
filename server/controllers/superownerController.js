const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { db, DB_PATH, DATA_DIR } = require('../config/database');
const { logAudit } = require('../middleware/audit');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

const SUPEROWNER_BACKUP_DIR = path.join(DATA_DIR, 'backups', 'superowner_full');
if (!fs.existsSync(SUPEROWNER_BACKUP_DIR)) {
  fs.mkdirSync(SUPEROWNER_BACKUP_DIR, { recursive: true });
}

// GET /api/superowner/stats
exports.getStats = async (req, res) => {
  try {
    const totRow = await db.get('SELECT COUNT(*) as count FROM tenants');
    const totalTenants = totRow?.count || 0;
    
    // Active tenants: status = 1 and had activity or registered
    const actRow = await db.get('SELECT COUNT(*) as count FROM tenants WHERE is_active = 1');
    const activeTenants = actRow?.count || 0;
    
    // Total lifetime sales across all businesses
    const sRow = await db.get('SELECT COALESCE(SUM(grand_total), 0) as total FROM sales');
    const totalSales = sRow?.total || 0;
    
    // Current month sales volume
    const currentMonth = new Date().toISOString().slice(0, 7);
    const mRow = await db.get("SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE CAST(sale_date AS TEXT) LIKE ?", [`${currentMonth}%`]);
    const monthlySales = mRow?.total || 0;

    // Subscription estimated MRR in PKR and USD (Standardized Pakistani Retail Pricing)
    const pRow = await db.get("SELECT COUNT(*) as count FROM tenants WHERE plan = 'pro' AND is_active = 1 AND (deleted_at IS NULL)");
    const proTenants = pRow?.count || 0;
    const eRow = await db.get("SELECT COUNT(*) as count FROM tenants WHERE plan = 'enterprise' AND is_active = 1 AND (deleted_at IS NULL)");
    const entTenants = eRow?.count || 0;
    const proRatePkr = 4999;
    const entRatePkr = 14999;
    const estimatedMRRPkr = (proTenants * proRatePkr) + (entTenants * entRatePkr);
    const estimatedMRRUsd = (proTenants * 18) + (entTenants * 54);

    return res.json({
      success: true,
      stats: {
        totalTenants,
        activeTenants,
        totalSales,
        monthlySales,
        monthlyRevenue: estimatedMRRPkr,
        monthlyRevenuePkr: estimatedMRRPkr,
        monthlyRevenueUsd: estimatedMRRUsd,
        proTenants,
        entTenants
      }
    });
  } catch (err) {
    console.error('Superowner getStats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve superowner statistics.' });
  }
};

// GET /api/superowner/tenants
exports.getTenants = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const filterStatus = req.query.status || 'all'; // 'all', 'active', 'archived'

    let whereClause = '';
    if (filterStatus === 'archived') {
      whereClause = 'WHERE t.deleted_at IS NOT NULL';
    } else if (filterStatus === 'active') {
      whereClause = 'WHERE (t.deleted_at IS NULL) AND t.is_active = 1';
    } else {
      whereClause = 'WHERE (t.deleted_at IS NULL)';
    }

    const tenants = await db.all(`
      SELECT 
        t.id,
        t.business_name,
        t.business_type,
        t.owner_name,
        t.email,
        t.phone,
        t.plan,
        t.is_active,
        t.deleted_at,
        t.feature_flags,
        t.max_users,
        t.max_products,
        t.storage_quota_mb,
        COALESCE(t.is_default, CASE WHEN t.id = '${LEGACY_TENANT_ID}' THEN 1 ELSE 0 END) as is_default,
        t.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND (u.is_hidden IS NULL OR u.is_hidden = 0) AND u.role != 'superowner') as user_count,
        (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id) as product_count,
        (SELECT COALESCE(SUM(s.grand_total), 0) FROM sales s WHERE s.tenant_id = t.id) as total_sales,
        (SELECT COALESCE(SUM(s.grand_total), 0) FROM sales s WHERE s.tenant_id = t.id AND CAST(s.sale_date AS TEXT) LIKE ?) as monthly_sales,
        (SELECT MAX(s.sale_date) FROM sales s WHERE s.tenant_id = t.id) as last_sale_date,
        (SELECT MAX(a.created_at) FROM audit_logs a WHERE a.user_id IN (SELECT id FROM users WHERE tenant_id = t.id)) as last_active
      FROM tenants t
      ${whereClause}
      ORDER BY t.created_at DESC
    `, [`${currentMonth}%`]);

    return res.json({ success: true, tenants });
  } catch (err) {
    console.error('Superowner getTenants error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve tenants list.' });
  }
};

// POST /api/superowner/tenants/:id/archive (Soft-Delete with Typed Business Name Confirmation)
exports.archiveTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm_business_name } = req.body || {};

    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    if (id === LEGACY_TENANT_ID) {
      return res.status(400).json({ success: false, message: 'The primary base tenant cannot be archived. You can suspend it instead.' });
    }

    if (!confirm_business_name || confirm_business_name.trim().toLowerCase() !== tenant.business_name.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: `Confirmation mismatch. You must type the exact business name "${tenant.business_name}" to archive.`
      });
    }

    await db.transaction(async () => {
      await db.run('UPDATE tenants SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, deleted_by = ? WHERE id = ?', [req.user?.id || 1, id]);
      await db.run("UPDATE users SET status = 'inactive', token_version = COALESCE(token_version, 1) + 1 WHERE tenant_id = ?", [id]);
    });

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'ARCHIVE_TENANT',
      'TENANT',
      null,
      `SuperOwner archived tenant "${tenant.business_name}" (ID: ${id}). Sessions revoked.`,
      req
    );

    return res.json({
      success: true,
      message: `Tenant "${tenant.business_name}" has been safely archived. Financial ledgers and history preserved. You can restore it anytime from the Archived tab.`
    });
  } catch (err) {
    console.error('Superowner archiveTenant error:', err);
    return res.status(500).json({ success: false, message: 'Failed to archive tenant: ' + err.message });
  }
};

// POST /api/superowner/tenants/:id/restore (One-Click Tenant Restoration)
exports.restoreTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    await db.transaction(async () => {
      await db.run('UPDATE tenants SET deleted_at = NULL, is_active = 1, deleted_by = NULL WHERE id = ?', [id]);
      await db.run("UPDATE users SET status = 'active' WHERE tenant_id = ? AND role = 'admin'", [id]);
    });

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'RESTORE_TENANT',
      'TENANT',
      null,
      `SuperOwner restored tenant "${tenant.business_name}" (ID: ${id}).`,
      req
    );

    return res.json({
      success: true,
      message: `Tenant "${tenant.business_name}" has been restored and is now active.`
    });
  } catch (err) {
    console.error('Superowner restoreTenant error:', err);
    return res.status(500).json({ success: false, message: 'Failed to restore tenant: ' + err.message });
  }
};

// POST /api/superowner/impersonate/start (Governed Impersonation with Mandatory Reason)
exports.startImpersonation = async (req, res) => {
  try {
    const { tenant_id, reason_code, notes } = req.body;
    if (!tenant_id || !reason_code) {
      return res.status(400).json({ success: false, message: 'Tenant ID and Reason Code are required.' });
    }

    const tenant = await db.get('SELECT id, business_name FROM tenants WHERE id = ?', [tenant_id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Target tenant not found.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const insRes = await db.run(`
      INSERT INTO impersonation_logs (superowner_id, tenant_id, reason_code, notes, started_at, ip_address)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `, [req.user?.id || 1, tenant_id, reason_code, notes || null, String(ip).split(',')[0].trim()]);

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'IMPERSONATE_START',
      'TENANT',
      null,
      `SuperOwner initiated impersonation of "${tenant.business_name}" (ID: ${tenant_id}). Reason: ${reason_code}`,
      req
    );

    return res.json({
      success: true,
      sessionId: insRes.lastInsertRowid,
      tenant
    });
  } catch (err) {
    console.error('Superowner startImpersonation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate impersonation: ' + err.message });
  }
};

// POST /api/superowner/impersonate/end
exports.endImpersonation = async (req, res) => {
  try {
    const { sessionId, tenant_id } = req.body;
    if (sessionId) {
      await db.run('UPDATE impersonation_logs SET ended_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId]);
    } else if (tenant_id) {
      await db.run('UPDATE impersonation_logs SET ended_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND ended_at IS NULL', [tenant_id]);
    }

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'IMPERSONATE_END',
      'TENANT',
      null,
      `SuperOwner concluded impersonation session for tenant ${tenant_id || ''}`,
      req
    );

    return res.json({ success: true, message: 'Impersonation session concluded.' });
  } catch (err) {
    console.error('Superowner endImpersonation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to conclude impersonation: ' + err.message });
  }
};

// POST /api/superowner/support/reset-link (Support Desk One-Click Reset Link)
exports.generateResetLink = async (req, res) => {
  try {
    const crypto = require('crypto');
    const { user_id, username } = req.body;

    let targetUser;
    if (user_id) {
      targetUser = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    } else if (username) {
      targetUser = await db.get('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [username.toLowerCase(), username.toLowerCase()]);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Staff user account not found.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.run(`
      INSERT INTO password_reset_requests (user_id, username, reset_token_hash, expires_at, status, is_used, request_note)
      VALUES (?, ?, ?, ?, 'Approved', 0, 'Generated by SuperOwner Support Desk')
    `, [targetUser.id, targetUser.username, tokenHash, expiresAt]);

    const frontendBase = process.env.FRONTEND_URL || 'https://shoppyos.com';
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}`;

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'GENERATE_RESET_LINK',
      'USER',
      targetUser.id,
      `SuperOwner generated password reset link for user "${targetUser.username}"`,
      req
    );

    return res.json({
      success: true,
      message: 'Password reset link successfully generated. Valid for 24 hours.',
      reset_token: resetToken,
      reset_url: resetUrl,
      username: targetUser.username,
      full_name: targetUser.full_name
    });
  } catch (err) {
    console.error('Superowner generateResetLink error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate reset link: ' + err.message });
  }
};

// POST /api/superowner/support/force-logout
exports.forceLogout = async (req, res) => {
  try {
    const { user_id, tenant_id } = req.body;
    if (!user_id && !tenant_id) {
      return res.status(400).json({ success: false, message: 'User ID or Tenant ID is required.' });
    }

    if (user_id) {
      await db.run('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?', [user_id]);
    } else if (tenant_id) {
      await db.run('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE tenant_id = ?', [tenant_id]);
    }

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'FORCE_LOGOUT',
      user_id ? 'USER' : 'TENANT',
      user_id || null,
      `SuperOwner revoked active sessions for ${user_id ? `user ID ${user_id}` : `tenant ${tenant_id}`}`,
      req
    );

    return res.json({ success: true, message: 'Active login sessions successfully terminated across all devices.' });
  } catch (err) {
    console.error('Superowner forceLogout error:', err);
    return res.status(500).json({ success: false, message: 'Failed to force logout: ' + err.message });
  }
};

// POST /api/superowner/tenants/:id/status
exports.updateTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const newStatus = is_active ? 1 : 0;
    await db.run('UPDATE tenants SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

    return res.json({
      success: true,
      message: `Tenant "${tenant.business_name}" is now ${newStatus === 1 ? 'Active' : 'Suspended'}.`,
      is_active: newStatus
    });
  } catch (err) {
    console.error('Superowner updateTenantStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tenant status.' });
  }
};

// POST /api/superowner/tenants/:id/plan
exports.updateTenantPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    await db.run('UPDATE tenants SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [plan, id]);
    return res.json({ success: true, message: `Tenant plan updated to ${plan}.` });
  } catch (err) {
    console.error('Superowner updateTenantPlan error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tenant plan.' });
  }
};

// DELETE /api/superowner/tenants/:id (Safe Soft-Deletion)
exports.deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm_tenant_id } = req.body || {};

    if (!confirm_tenant_id || confirm_tenant_id !== id) {
      return res.status(400).json({
        success: false,
        message: `To delete this tenant, you must confirm by passing confirm_tenant_id: "${id}".`
      });
    }

    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    if (id === LEGACY_TENANT_ID) {
      return res.status(400).json({ success: false, message: 'The primary base tenant cannot be deleted. You can suspend it instead.' });
    }

    // Create safety backup snapshot before soft deletion
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const snapshotPath = path.join(backupDir, `tenant_soft_delete_${id}_${Date.now()}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify({ tenant, deleted_at: new Date().toISOString() }, null, 2));

    // Safe Soft-Deletion: Deactivate tenant, revoke all active sessions
    await db.transaction(async (tx) => {
      const runner = tx.run ? tx : db;
      await runner.run("UPDATE tenants SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
      await runner.run("UPDATE users SET is_active = 0, token_version = token_version + 1 WHERE tenant_id = ?", [id]);
    });

    return res.json({
      success: true,
      message: `Tenant "${tenant.business_name}" has been deactivated and soft-deleted. All sessions revoked. Snapshot archived. To permanently hard-purge, run: node server/scripts/hard_purge_tenant.js --tenant ${id} --confirm-purge`
    });
  } catch (err) {
    console.error('Superowner deleteTenant error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete tenant: ' + err.message });
  }
};

// ════════════════════════════════════════════════════════
// SUPEROWNER ONLY: FULL DATABASE SYSTEM BACKUP & RESTORE
// ════════════════════════════════════════════════════════

// POST /api/superowner/backup/create
exports.createFullDatabaseBackup = async (req, res) => {
  try {
    if (db.getDriver && db.getDriver() === 'postgres') {
      return res.json({
        success: true,
        message: 'PostgreSQL full database backups are managed via pg_dump / automated volume snapshots.',
        driver: 'postgres'
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `full_database_backup_${timestamp}.db`;
    const destinationPath = path.join(SUPEROWNER_BACKUP_DIR, backupFileName);

    await db.backup(destinationPath);
    const stats = fs.statSync(destinationPath);
    const sizeKb = (stats.size / 1024).toFixed(1);

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'FULL_BACKUP',
      'SYSTEM_DATABASE',
      null,
      `SuperOwner created full system database backup: ${backupFileName} (${sizeKb} KB)`,
      req
    );

    return res.json({
      success: true,
      message: 'Full system database backup created successfully.',
      backup: {
        filename: backupFileName,
        size_kb: sizeKb,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Superowner full backup error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create full database backup: ' + err.message });
  }
};

// GET /api/superowner/backup
exports.listFullDatabaseBackups = (req, res) => {
  try {
    if (db.getDriver && db.getDriver() === 'postgres') {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(SUPEROWNER_BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(file => {
        const filePath = path.join(SUPEROWNER_BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size_kb: (stats.size / 1024).toFixed(1),
          created_at: stats.mtime || stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, backups: files });
  } catch (err) {
    console.error('Superowner list full backups error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list full backups.' });
  }
};

// GET /api/superowner/backup/download/:filename
exports.downloadFullDatabaseBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('..') || path.isAbsolute(filename) || path.basename(filename) !== filename) {
      return res.status(400).json({ success: false, message: 'Invalid file parameter.' });
    }

    const filePath = path.join(SUPEROWNER_BACKUP_DIR, filename);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(SUPEROWNER_BACKUP_DIR);

    if (!resolvedPath.startsWith(resolvedDir) || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Full database backup file not found.' });
    }

    await logAudit(req.user?.id, req.user?.full_name, 'DOWNLOAD_FULL_BACKUP', 'SYSTEM_DATABASE', null, `SuperOwner downloaded full backup: ${filename}`, req);
    return res.download(resolvedPath, filename);
  } catch (err) {
    console.error('Superowner download full backup error:', err);
    return res.status(500).json({ success: false, message: 'Failed to download full database backup.' });
  }
};

// POST /api/superowner/backup/restore
exports.restoreFullDatabaseBackup = async (req, res) => {
  try {
    if (db.getDriver && db.getDriver() === 'postgres') {
      return res.json({
        success: true,
        message: 'PostgreSQL full database restores are managed via pg_restore / migration tool.',
        driver: 'postgres'
      });
    }

    const { filename } = req.body;
    if (!filename || filename.includes('..') || path.isAbsolute(filename) || path.basename(filename) !== filename) {
      return res.status(400).json({ success: false, message: 'Filename is required for full database restore.' });
    }

    const backupPath = path.join(SUPEROWNER_BACKUP_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, message: 'Full database backup file does not exist.' });
    }

    // Integrity check
    const testDb = new Database(backupPath, { readonly: true });
    const check = testDb.pragma('integrity_check');
    testDb.close();

    if (!check || check[0]?.integrity_check !== 'ok') {
      return res.status(400).json({ success: false, message: 'Backup file failed SQLite integrity check. Restore aborted.' });
    }

    // Safety snapshot
    const safetyName = `pre_superowner_restore_safety_${Date.now()}.db`;
    await db.backup(path.join(SUPEROWNER_BACKUP_DIR, safetyName));

    // Restore full database
    const sourceDb = new Database(backupPath, { readonly: true });
    await sourceDb.backup(DB_PATH);
    sourceDb.close();

    await logAudit(req.user?.id, req.user?.full_name, 'RESTORE_FULL_BACKUP', 'SYSTEM_DATABASE', null, `SuperOwner restored full database from: ${filename}`, req);

    return res.json({
      success: true,
      message: `Full system database successfully restored from ${filename}. Safety snapshot saved as ${safetyName}.`
    });
  } catch (err) {
    console.error('Superowner full restore error:', err);
    return res.status(500).json({ success: false, message: 'Failed to restore full database: ' + err.message });
  }
};

// ════════════════════════════════════════════════════════
// MODERN SUPERADMIN: PROVISIONING, SAFE FIXES, AUDIT, HEALTH
// ════════════════════════════════════════════════════════

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { seedNewTenant } = require('../config/seedTenant');

// POST /api/superowner/tenants/provision (Create from Industry Preset)
exports.provisionTenant = async (req, res) => {
  try {
    const { business_name, owner_name, email, phone, business_type, plan, city, password } = req.body;

    if (!business_name || !owner_name || !email) {
      return res.status(400).json({ success: false, message: 'Business name, owner name, and email are required.' });
    }

    const bType = business_type || 'retail_general';
    const chosenPlan = plan || 'free';
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already in use
    const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email address already exists.' });
    }

    const baseSlug = business_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 15) || 'shop';
    const tenantId = `t_${baseSlug}_${crypto.randomBytes(3).toString('hex')}`;
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'owner';
    let username = baseUsername;
    let counter = 1;
    while (await db.get('SELECT id FROM users WHERE username = ?', [username])) {
      username = `${baseUsername}${counter++}`;
    }

    const initialPassword = password || 'Admin123.';
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(initialPassword, salt);

    await db.transaction(async () => {
      await db.run(`
        INSERT INTO tenants (id, business_name, business_type, owner_name, email, phone, address, plan, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [tenantId, business_name.trim(), bType, owner_name.trim(), normalizedEmail, phone || '', city || '', chosenPlan]);

      await db.run(`
        INSERT INTO subscriptions (tenant_id, plan, price, payment_status)
        VALUES (?, ?, ?, 'active')
      `, [tenantId, chosenPlan, chosenPlan === 'enterprise' ? 14999 : (chosenPlan === 'pro' ? 4999 : 0)]);

      await db.run(`
        INSERT INTO users (username, email, password_hash, full_name, role, status, tenant_id, token_version, must_change_password)
        VALUES (?, ?, ?, ?, 'admin', 'active', ?, 1, 0)
      `, [username, normalizedEmail, passwordHash, owner_name.trim(), tenantId]);
    });

    // Seed preset catalog, categories, units & walk-in customer
    try {
      await seedNewTenant(tenantId, bType, business_name.trim(), normalizedEmail, phone || '', city || '', city || '');
    } catch (_) {}

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'PROVISION_TENANT',
      'TENANT',
      null,
      `SuperOwner provisioned new ${bType} tenant: "${business_name}" (ID: ${tenantId}, Plan: ${chosenPlan})`,
      req
    );

    return res.status(201).json({
      success: true,
      message: `Business "${business_name}" successfully provisioned with ${bType.replace('_', ' ')} preset.`,
      tenant: {
        id: tenantId,
        business_name: business_name.trim(),
        business_type: bType,
        plan: chosenPlan,
        owner_name: owner_name.trim(),
        email: normalizedEmail,
        username,
        initialPassword
      }
    });
  } catch (err) {
    console.error('Superowner provisionTenant error:', err);
    return res.status(500).json({ success: false, message: 'Failed to provision tenant: ' + err.message });
  }
};

// PUT /api/superowner/tenants/:id/config (Configure Quotas & Feature Flags)
exports.updateTenantConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { max_users, max_products, storage_quota_mb, feature_flags, plan } = req.body;

    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const flagsStr = typeof feature_flags === 'object' ? JSON.stringify(feature_flags) : (feature_flags || '{}');

    await db.run(`
      UPDATE tenants
      SET max_users = COALESCE(?, max_users),
          max_products = COALESCE(?, max_products),
          storage_quota_mb = COALESCE(?, storage_quota_mb),
          feature_flags = ?,
          plan = COALESCE(?, plan),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [max_users || null, max_products || null, storage_quota_mb || null, flagsStr, plan || null, id]);

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'UPDATE_CONFIG',
      'TENANT',
      null,
      `SuperOwner updated configuration for tenant "${tenant.business_name}" (ID: ${id})`,
      req
    );

    return res.json({ success: true, message: 'Tenant configuration and feature flags successfully updated.' });
  } catch (err) {
    console.error('Superowner updateTenantConfig error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tenant configuration.' });
  }
};

// POST /api/superowner/data-fix/run (Safe Guided Data Diagnostics & Fixes)
exports.runDataFix = async (req, res) => {
  try {
    const { recipe, tenant_id, apply } = req.body;
    if (!recipe || !tenant_id) {
      return res.status(400).json({ success: false, message: 'Recipe name and tenant_id are required.' });
    }

    const isApply = apply === true;

    if (recipe === 'ledger_resync') {
      // Recipe 1: Customer Ledger Balance Re-synchronization
      const customers = await db.all('SELECT id, name, current_balance FROM customers WHERE tenant_id = ?', [tenant_id]);
      const discrepancies = [];

      for (const cust of customers) {
        // Calculate true balance from sales (balance_due) - payments
        const salesRow = await db.get('SELECT COALESCE(SUM(balance_due), 0) as due FROM sales WHERE customer_id = ? AND tenant_id = ?', [cust.id, tenant_id]);
        const calcDue = Number(salesRow?.due || 0);

        if (Math.abs(Number(cust.current_balance) - calcDue) > 0.01) {
          discrepancies.push({
            customer_id: cust.id,
            name: cust.name,
            cached_balance: Number(cust.current_balance),
            verified_balance: calcDue,
            variance: Number(cust.current_balance) - calcDue
          });

          if (isApply) {
            await db.run('UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?', [calcDue, cust.id, tenant_id]);
          }
        }
      }

      if (isApply && discrepancies.length > 0) {
        await logAudit(
          req.user?.id,
          req.user?.full_name,
          'SAFE_FIX_APPLY',
          'LEDGER',
          null,
          `SuperOwner reconciled ledger balances for ${discrepancies.length} customers in tenant ${tenant_id}`,
          req
        );
      }

      return res.json({
        success: true,
        recipe,
        tenant_id,
        is_simulation: !isApply,
        found_discrepancies: discrepancies.length,
        items: discrepancies,
        message: isApply
          ? `Successfully synchronized ${discrepancies.length} customer balances with verified transaction ledger.`
          : `Dry-Run Simulation Complete: Found ${discrepancies.length} balance discrepancies. No live changes applied.`
      });

    } else if (recipe === 'sequence_repair') {
      // Recipe 2: Invoice Sequence Collision & Gap Repair
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fullType = `sale_invoice_${today}`;

      const rows = await db.all("SELECT invoice_no FROM sales WHERE tenant_id = ? AND invoice_no LIKE ?", [tenant_id, `INV-${today}-%`]);
      let maxSeq = 0;
      for (const r of rows) {
        if (r.invoice_no) {
          const parts = r.invoice_no.split('-');
          const seq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }

      const counterRow = await db.get('SELECT last_number FROM counters WHERE tenant_id = ? AND counter_type = ?', [tenant_id, fullType]);
      const currentCounter = counterRow ? Number(counterRow.last_number) || 0 : 0;
      const targetCounter = Math.max(currentCounter, maxSeq);

      if (isApply && targetCounter > currentCounter) {
        await db.run('INSERT INTO counters (tenant_id, counter_type, last_number) VALUES (?, ?, ?) ON CONFLICT(tenant_id, counter_type) DO UPDATE SET last_number = ?', [tenant_id, fullType, targetCounter, targetCounter]);
      }

      return res.json({
        success: true,
        recipe,
        tenant_id,
        is_simulation: !isApply,
        current_counter: currentCounter,
        max_existing_invoice_sequence: maxSeq,
        realigned_to: targetCounter,
        message: isApply
          ? `Invoice sequence counter realigned to ${targetCounter}. Collision risk eliminated.`
          : `Simulation Complete: Sequence counter is at ${currentCounter}, maximum recorded invoice is ${maxSeq}.`
      });

    } else {
      return res.status(400).json({ success: false, message: `Unknown recipe "${recipe}".` });
    }
  } catch (err) {
    console.error('Superowner runDataFix error:', err);
    return res.status(500).json({ success: false, message: 'Data fix execution error: ' + err.message });
  }
};

// GET /api/superowner/audit-logs (Universal Platform Audit Log)
exports.getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100);
    const logs = await db.all(`
      SELECT 
        a.id,
        a.user_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.ip_address,
        a.created_at,
        a.tenant_id,
        COALESCE(t.business_name, 'System Platform') as business_name
      FROM audit_logs a
      LEFT JOIN tenants t ON a.tenant_id = t.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [limit]);

    return res.json({ success: true, logs });
  } catch (err) {
    console.error('Superowner getAuditLogs error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
};

// GET /api/superowner/tenants/:id/export (Per-Tenant Isolated Complete Data Export)
exports.exportTenantData = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const [products, customers, suppliers, sales, purchases] = await Promise.all([
      db.all('SELECT * FROM products WHERE tenant_id = ?', [id]),
      db.all('SELECT * FROM customers WHERE tenant_id = ?', [id]),
      db.all('SELECT * FROM suppliers WHERE tenant_id = ?', [id]),
      db.all('SELECT * FROM sales WHERE tenant_id = ? LIMIT 500', [id]),
      db.all('SELECT * FROM purchases WHERE tenant_id = ? LIMIT 500', [id])
    ]);

    const payload = {
      tenant,
      exported_at: new Date().toISOString(),
      counts: {
        products: products.length,
        customers: customers.length,
        suppliers: suppliers.length,
        sales: sales.length,
        purchases: purchases.length
      },
      products,
      customers,
      suppliers,
      sales,
      purchases
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=tenant_${id}_${Date.now()}.json`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Superowner exportTenantData error:', err);
    return res.status(500).json({ success: false, message: 'Failed to export tenant data.' });
  }
};

// GET /api/superowner/system/health (Live Infrastructure Telemetry)
exports.getSystemHealth = async (req, res) => {
  try {
    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);

    const driver = db.getDriver ? db.getDriver() : 'sqlite';
    const activeDriverName = driver === 'postgres' ? 'PostgreSQL 16 Pool' : 'SQLite Failsafe (latif_traders.db)';

    return res.json({
      success: true,
      health: {
        database_driver: activeDriverName,
        status: 'healthy',
        uptime: `${hours}h ${minutes}m`,
        memory_rss_mb: (mem.rss / 1024 / 1024).toFixed(1),
        memory_heap_used_mb: (mem.heapUsed / 1024 / 1024).toFixed(1),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'production'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'System health check failed.' });
  }
};
