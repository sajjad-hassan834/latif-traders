const path = require('path');
const fs = require('fs');
const { db, DATA_DIR } = require('../config/database');
const { logAudit } = require('../middleware/audit');
const { LEGACY_TENANT_ID } = require('../constants/tenant');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Safely get tenant backup folder
function getTenantBackupDir(tenantId) {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.includes('..') || path.isAbsolute(tenantId)) {
    throw new Error('Invalid tenant context.');
  }
  const cleanId = path.basename(tenantId);
  const tenantDir = path.join(BACKUP_DIR, cleanId);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }
  return tenantDir;
}

// Automatically detect and migrate legacy pre-multitenancy backups into tenant folders
async function migrateLegacyBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    let tenants = [];
    try {
      tenants = await db.all('SELECT id, business_name FROM tenants');
    } catch (_) {}

    const tenantIds = new Set(tenants.map(t => t.id));
    tenantIds.add(LEGACY_TENANT_ID);

    // 1. Scan root BACKUP_DIR for loose backup files
    const rootEntries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isDirectory()) continue;
      const file = entry.name;
      if (file === '.gitkeep' || file.startsWith('.')) continue;

      // Only process backup file extensions
      if (!file.endsWith('.json') && !file.endsWith('.db') && !file.endsWith('.db-shm') && !file.endsWith('.db-wal')) {
        continue;
      }

      const fullSourcePath = path.join(BACKUP_DIR, file);
      let targetTenantId = null;

      // Check if JSON file has explicit tenant_id
      if (file.endsWith('.json')) {
        try {
          const content = JSON.parse(fs.readFileSync(fullSourcePath, 'utf8'));
          if (content.tenant_id && tenantIds.has(content.tenant_id)) {
            targetTenantId = content.tenant_id;
          }
        } catch (_) {}
      }

      // Check matching by tenant slug or ID
      if (!targetTenantId) {
        for (const t of tenants) {
          const slug = (t.business_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
          if (slug && file.toLowerCase().startsWith(slug)) {
            targetTenantId = t.id;
            break;
          }
          if (t.id && file.includes(t.id)) {
            targetTenantId = t.id;
            break;
          }
        }
      }

      // Default to primary legacy tenant for pre-multitenancy backups
      if (!targetTenantId) {
        targetTenantId = LEGACY_TENANT_ID;
      }

      const targetDir = path.join(BACKUP_DIR, targetTenantId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, file);
      if (!fs.existsSync(targetPath)) {
        try {
          fs.renameSync(fullSourcePath, targetPath);
        } catch (moveErr) {
          try {
            fs.copyFileSync(fullSourcePath, targetPath);
            fs.unlinkSync(fullSourcePath);
          } catch (_) {}
        }
      } else {
        // If exact same file already in target, remove redundant root file
        try {
          const s1 = fs.statSync(fullSourcePath);
          const s2 = fs.statSync(targetPath);
          if (s1.size === s2.size) {
            fs.unlinkSync(fullSourcePath);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Backup legacy auto-migration notice:', err.message);
  }
}

// Format display name: "<Shop Name> backup - 19 Sep 2026, 12:19 PM"
function formatBackupDisplayName(shopName, date, filename = '') {
  if (filename) {
    if (filename.startsWith('backup_before_client_delivery')) {
      return `${shopName} - Delivery Snapshot`;
    }
    if (filename.includes('initial')) {
      return `${shopName} - Initial System Backup`;
    }
    if (filename.startsWith('latif_traders_safety_backup') || filename.startsWith('pre_restore_safety') || filename.startsWith('pre_multitenancy')) {
      return `${shopName} - Safety Snapshot`;
    }
  }
  const d = new Date(date);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()] || 'Jan';
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${shopName} backup - ${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

// Format filename: <shop-slug>_backup_YYYY-MM-DD_HHmm.json
function generateBackupFilename(shopName, date) {
  const d = new Date(date);
  const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'shop';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${slug}_backup_${yyyy}-${mm}-${dd}_${hh}${min}.json`;
}

// Exported tenant tables for scoped backup
const TENANT_TABLES = [
  'categories',
  'units',
  'brands',
  'products',
  'batches',
  'customers',
  'suppliers',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'payments',
  'expenses',
  'expense_categories',
  'inventory_movements',
  'stock_adjustments',
  'tenant_settings'
];

// Create tenant-scoped backup
exports.createBackup = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant context required.' });
    }



    const tenantDir = getTenantBackupDir(tenantId);
    const tenant = await db.get('SELECT business_name, business_type, plan FROM tenants WHERE id = ?', [tenantId]);
    const shopName = tenant?.business_name || req.tenant?.business_name || 'Shop';
    const now = new Date();

    const filename = generateBackupFilename(shopName, now);
    const destinationPath = path.join(tenantDir, filename);

    // Collect tenant-scoped rows only
    const backupData = {
      version: '2.0',
      tenant_id: tenantId,
      shop_name: shopName,
      business_type: tenant?.business_type || 'retail_general',
      plan: tenant?.plan || 'free',
      exported_at: now.toISOString(),
      display_name: formatBackupDisplayName(shopName, now, filename),
      tables: {}
    };

    for (const table of TENANT_TABLES) {
      try {
        const rows = await db.all(`SELECT * FROM ${table} WHERE tenant_id = ?`, [tenantId]);
        backupData.tables[table] = rows;
      } catch (tableErr) {
        backupData.tables[table] = [];
      }
    }

    fs.writeFileSync(destinationPath, JSON.stringify(backupData, null, 2), 'utf8');

    const stats = fs.statSync(destinationPath);
    const sizeKb = (stats.size / 1024).toFixed(1);

    await logAudit(
      req.user?.id,
      req.user?.full_name,
      'BACKUP',
      'TENANT_DATA',
      null,
      `Created tenant backup: ${filename} (${sizeKb} KB)`,
      req
    );

    return res.json({
      success: true,
      message: 'Backup created successfully.',
      backup: {
        filename,
        display_name: backupData.display_name,
        size_kb: sizeKb,
        created_at: now.toISOString()
      }
    });
  } catch (err) {
    console.error('Tenant backup creation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create backup: ' + err.message });
  }
};

// List available tenant backups
exports.listBackups = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant context required.' });
    }



    await migrateLegacyBackups();

    const tenantDir = getTenantBackupDir(tenantId);
    const tenant = await db.get('SELECT business_name FROM tenants WHERE id = ?', [tenantId]);
    const shopName = tenant?.business_name || req.tenant?.business_name || 'Shop';

    const fileMap = new Map();

    const processFile = (dir, file) => {
      if (fileMap.has(file)) return;
      const filePath = path.join(dir, file);
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);
      let displayName = formatBackupDisplayName(shopName, stats.mtime || stats.birthtime, file);

      if (file.endsWith('.json')) {
        try {
          const preview = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (preview.display_name) {
            displayName = preview.display_name;
          }
        } catch (e) {}
      }

      fileMap.set(file, {
        filename: file,
        display_name: displayName,
        size_kb: (stats.size / 1024).toFixed(1),
        created_at: stats.mtime || stats.birthtime
      });
    };

    if (fs.existsSync(tenantDir)) {
      const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json') || f.endsWith('.db'));
      for (const f of files) {
        processFile(tenantDir, f);
      }
    }


    if (tenantId === LEGACY_TENANT_ID && fs.existsSync(BACKUP_DIR)) {
 (feat(stage-a4): complete Stage A4 database-level tenant isolation, deep verification, and http parity)
      const rootFiles = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
      for (const entry of rootFiles) {
        if (!entry.isDirectory() && (entry.name.endsWith('.json') || entry.name.endsWith('.db'))) {
          processFile(BACKUP_DIR, entry.name);
        }
      }
    }

    const result = Array.from(fileMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, backups: result });
  } catch (err) {
    console.error('List backups error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list backups.' });
  }
};

// Download a tenant backup file
exports.downloadBackup = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant context required.' });
    }

    const { filename } = req.params;
    if (!filename || filename.includes('..') || path.isAbsolute(filename) || path.basename(filename) !== filename) {
      return res.status(400).json({ success: false, message: 'Invalid file parameter.' });
    }

    await migrateLegacyBackups();

    const tenantDir = getTenantBackupDir(tenantId);
    let filePath = path.join(tenantDir, filename);

    let resolvedPath = path.resolve(filePath);
    const resolvedTenantDir = path.resolve(tenantDir);

    if (!resolvedPath.startsWith(resolvedTenantDir) || !fs.existsSync(resolvedPath)) {
      if (tenantId === LEGACY_TENANT_ID) {
        const rootPath = path.join(BACKUP_DIR, filename);
        if (fs.existsSync(rootPath)) {
          resolvedPath = path.resolve(rootPath);
        } else {
          return res.status(404).json({ success: false, message: 'Backup file not found.' });
        }
      } else {
        return res.status(404).json({ success: false, message: 'Backup file not found.' });
      }
    }

    await logAudit(req.user?.id, req.user?.full_name, 'DOWNLOAD', 'BACKUP', null, `Downloaded tenant backup ${filename}`, req);
    return res.download(resolvedPath, filename);
  } catch (err) {
    console.error('Download backup error:', err);
    return res.status(500).json({ success: false, message: 'Failed to download backup.' });
  }
};

// Restore tenant data from tenant backup file
exports.restoreBackup = async (req, res) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant context required.' });
    }



    const { filename } = req.body;
    if (!filename || filename.includes('..') || path.isAbsolute(filename) || path.basename(filename) !== filename) {
      return res.status(400).json({ success: false, message: 'Filename is required for restore.' });
    }

    await migrateLegacyBackups();

    const tenantDir = getTenantBackupDir(tenantId);
    let filePath = path.join(tenantDir, filename);

    if (!fs.existsSync(filePath)) {
      if (tenantId === LEGACY_TENANT_ID) {
        const rootPath = path.join(BACKUP_DIR, filename);
        if (fs.existsSync(rootPath)) {
          filePath = rootPath;
        } else {
          return res.status(404).json({ success: false, message: 'Backup file does not exist.' });
        }
      } else {
        return res.status(404).json({ success: false, message: 'Backup file does not exist.' });
      }
    }

    if (!filename.endsWith('.json')) {
      return res.status(400).json({
        success: false,
        message: 'Legacy full database (.db) files can only be restored by the System SuperOwner. Tenant self-service supports JSON backup packages.'
      });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const backup = JSON.parse(content);

    if (!backup || !backup.tables || typeof backup.tables !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid backup structure. Restore aborted.' });
    }

    const safetyFilename = `pre_restore_safety_${Date.now()}.json`;
    const safetyPath = path.join(tenantDir, safetyFilename);
    const tenant = await db.get('SELECT business_name, business_type, plan FROM tenants WHERE id = ?', [tenantId]);
    const safetyBackup = {
      version: '2.0',
      tenant_id: tenantId,
      shop_name: tenant?.business_name || 'Shop',
      exported_at: new Date().toISOString(),
      display_name: `Safety backup before restore - ${filename}`,
      tables: {}
    };
    for (const table of TENANT_TABLES) {
      try {
        safetyBackup.tables[table] = await db.all(`SELECT * FROM ${table} WHERE tenant_id = ?`, [tenantId]);
      } catch (e) {
        safetyBackup.tables[table] = [];
      }
    }
    fs.writeFileSync(safetyPath, JSON.stringify(safetyBackup, null, 2), 'utf8');

    await db.transaction(async (tx) => {
      const runner = tx.run ? tx : db;
      const tablesToClean = [
        'sale_items',
        'sales',
        'purchase_items',
        'purchases',
        'payments',
        'expenses',
        'stock_adjustments',
        'inventory_movements',
        'batches',
        'products',
        'categories',
        'brands',
        'units',
        'customers',
        'suppliers',
        'tenant_settings'
      ];

      for (const table of tablesToClean) {
        try {
          await runner.run(`DELETE FROM ${table} WHERE tenant_id = ?`, [tenantId]);
        } catch (delErr) {
          console.warn(`Could not delete from ${table}:`, delErr.message);
        }
      }

      for (const table of TENANT_TABLES) {
        const rows = backup.tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        for (const row of rows) {
          const rowData = { ...row, tenant_id: tenantId };
          const cols = Object.keys(rowData);
          const placeholders = cols.map(() => '?').join(', ');
          const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
          try {
            await runner.run(sql, Object.values(rowData));
          } catch (insertErr) {
            console.warn(`Error inserting into ${table}:`, insertErr.message);
          }
        }
      }
    });

    await logAudit(req.user?.id, req.user?.full_name, 'RESTORE', 'TENANT_DATA', null, `Restored tenant data from ${filename}`, req);

    return res.json({
      success: true,
      message: `Shop data successfully restored from ${filename}. Safety snapshot saved as ${safetyFilename}.`
    });
  } catch (err) {
    console.error('Tenant restore error:', err);
    return res.status(500).json({ success: false, message: 'Failed to restore backup: ' + err.message });
  }
};
