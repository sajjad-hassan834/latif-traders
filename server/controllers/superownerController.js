const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { db, DB_PATH, DATA_DIR } = require('../config/database');
const { logAudit } = require('../middleware/audit');

const SUPEROWNER_BACKUP_DIR = path.join(DATA_DIR, 'backups', 'superowner_full');
if (!fs.existsSync(SUPEROWNER_BACKUP_DIR)) {
  fs.mkdirSync(SUPEROWNER_BACKUP_DIR, { recursive: true });
}

// GET /api/superowner/stats
exports.getStats = (req, res) => {
  try {
    const totalTenants = db.prepare('SELECT COUNT(*) as count FROM tenants').get()?.count || 0;
    
    // Active tenants: status = 1 and had activity or registered
    const activeTenants = db.prepare('SELECT COUNT(*) as count FROM tenants WHERE is_active = 1').get()?.count || 0;
    
    // Total lifetime sales across all businesses
    const totalSales = db.prepare('SELECT COALESCE(SUM(grand_total), 0) as total FROM sales').get()?.total || 0;
    
    // Current month sales volume
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlySales = db.prepare("SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE sale_date LIKE ?").get(`${currentMonth}%`)?.total || 0;

    // Subscription estimated MRR based on plans
    // Pro: $29/mo (~₨ 8,000), Enterprise: $79/mo (~₨ 22,000)
    const proTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan = 'pro' AND is_active = 1").get()?.count || 0;
    const entTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan = 'enterprise' AND is_active = 1").get()?.count || 0;
    const estimatedMRR = (proTenants * 29) + (entTenants * 79);

    return res.json({
      success: true,
      stats: {
        totalTenants,
        activeTenants,
        totalSales,
        monthlySales,
        monthlyRevenue: estimatedMRR,
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
exports.getTenants = (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const tenants = db.prepare(`
      SELECT 
        t.id,
        t.business_name,
        t.business_type,
        t.owner_name,
        t.email,
        t.phone,
        t.plan,
        t.is_active,
        t.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND (u.is_hidden IS NULL OR u.is_hidden = 0) AND u.role != 'superowner') as user_count,
        (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id) as product_count,
        (SELECT COALESCE(SUM(s.grand_total), 0) FROM sales s WHERE s.tenant_id = t.id) as total_sales,
        (SELECT COALESCE(SUM(s.grand_total), 0) FROM sales s WHERE s.tenant_id = t.id AND s.sale_date LIKE ?) as monthly_sales,
        (SELECT MAX(s.sale_date) FROM sales s WHERE s.tenant_id = t.id) as last_sale_date,
        (SELECT MAX(a.created_at) FROM audit_logs a WHERE a.user_id IN (SELECT id FROM users WHERE tenant_id = t.id)) as last_active
      FROM tenants t
      ORDER BY t.created_at DESC
    `).all(`${currentMonth}%`);

    return res.json({ success: true, tenants });
  } catch (err) {
    console.error('Superowner getTenants error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve tenants list.' });
  }
};

// POST /api/superowner/tenants/:id/status
exports.updateTenantStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const newStatus = is_active ? 1 : 0;
    db.prepare('UPDATE tenants SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

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
exports.updateTenantPlan = (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    db.prepare('UPDATE tenants SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(plan, id);
    return res.json({ success: true, message: `Tenant plan updated to ${plan}.` });
  } catch (err) {
    console.error('Superowner updateTenantPlan error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tenant plan.' });
  }
};

// DELETE /api/superowner/tenants/:id
exports.deleteTenant = (req, res) => {
  try {
    const { id } = req.params;
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    // Protect primary demo/seed tenant from accidental deletion
    if (id === 'latif_001') {
      return res.status(400).json({ success: false, message: 'The primary base tenant (latif_001) cannot be permanently deleted. You can suspend it instead.' });
    }

    // Cascade delete tenant records
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE tenant_id = ?)').run(id);
      db.prepare('DELETE FROM sales WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE tenant_id = ?)').run(id);
      db.prepare('DELETE FROM purchases WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM inventory_movements WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM batches WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM customers WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM suppliers WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM expenses WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM payments WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM tenant_settings WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM subscriptions WHERE tenant_id = ?').run(id);
      db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
    });

    deleteTx();

    return res.json({ success: true, message: `Tenant "${tenant.business_name}" and all associated data have been permanently deleted.` });
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `full_database_backup_${timestamp}.db`;
    const destinationPath = path.join(SUPEROWNER_BACKUP_DIR, backupFileName);

    await db.backup(destinationPath);
    const stats = fs.statSync(destinationPath);
    const sizeKb = (stats.size / 1024).toFixed(1);

    logAudit(
      req.user.id,
      req.user.full_name,
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
exports.downloadFullDatabaseBackup = (req, res) => {
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

    logAudit(req.user.id, req.user.full_name, 'DOWNLOAD_FULL_BACKUP', 'SYSTEM_DATABASE', null, `SuperOwner downloaded full backup: ${filename}`, req);
    return res.download(resolvedPath, filename);
  } catch (err) {
    console.error('Superowner download full backup error:', err);
    return res.status(500).json({ success: false, message: 'Failed to download full database backup.' });
  }
};

// POST /api/superowner/backup/restore
exports.restoreFullDatabaseBackup = async (req, res) => {
  try {
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

    logAudit(req.user.id, req.user.full_name, 'RESTORE_FULL_BACKUP', 'SYSTEM_DATABASE', null, `SuperOwner restored full database from: ${filename}`, req);

    return res.json({
      success: true,
      message: `Full system database successfully restored from ${filename}. Safety snapshot saved as ${safetyName}.`
    });
  } catch (err) {
    console.error('Superowner full restore error:', err);
    return res.status(500).json({ success: false, message: 'Failed to restore full database: ' + err.message });
  }
};

