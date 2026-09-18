const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { db, DB_PATH, DATA_DIR } = require('../config/database');
const { logAudit } = require('../middleware/audit');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create a safe, online backup using SQLite's native backup API
exports.createBackup = async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `latif_traders_backup_${timestamp}.db`;
    const destinationPath = path.join(BACKUP_DIR, backupFileName);

    // native online backup in better-sqlite3
    await db.backup(destinationPath);

    const stats = fs.statSync(destinationPath);

    logAudit(
      req.user.id,
      req.user.full_name,
      'BACKUP',
      'DATABASE',
      null,
      `Created database backup: ${backupFileName} (${(stats.size / 1024).toFixed(1)} KB)`,
      req
    );

    return res.json({
      success: true,
      message: 'Backup created successfully.',
      backup: {
        filename: backupFileName,
        size_kb: (stats.size / 1024).toFixed(1),
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Backup creation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create database backup: ' + err.message });
  }
};

// List available backups
exports.listBackups = (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size_kb: (stats.size / 1024).toFixed(1),
          created_at: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, backups: files });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list backups.' });
  }
};

// Download a backup file
exports.downloadBackup = (req, res) => {
  try {
    const { filename } = req.params;
    // Prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Backup file not found.' });
    }

    logAudit(req.user.id, req.user.full_name, 'DOWNLOAD', 'BACKUP', null, `Downloaded backup file ${safeName}`, req);
    return res.download(filePath, safeName);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to download backup.' });
  }
};

// Restore from an existing local backup file
exports.restoreBackup = async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename is required for restore.' });
    }

    const safeName = path.basename(filename);
    const backupPath = path.join(BACKUP_DIR, safeName);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, message: 'Backup file does not exist.' });
    }

    // Verify backup integrity before restoring!
    const testDb = new Database(backupPath, { readonly: true });
    const check = testDb.pragma('integrity_check');
    testDb.close();

    if (!check || check[0]?.integrity_check !== 'ok') {
      return res.status(400).json({ success: false, message: 'Backup file failed integrity verification. Restore aborted.' });
    }

    // Create a safety backup of current live DB before replacing
    const safetyName = `pre_restore_safety_${Date.now()}.db`;
    await db.backup(path.join(BACKUP_DIR, safetyName));

    // Restore from backup: close current connection, overwrite DB_PATH, reopen
    // In better-sqlite3 we can perform a reverse backup: load backup into live DB
    const sourceDb = new Database(backupPath, { readonly: true });
    await sourceDb.backup(DB_PATH);
    sourceDb.close();

    logAudit(req.user.id, req.user.full_name, 'RESTORE', 'DATABASE', null, `Restored database from ${safeName}`, req);

    return res.json({
      success: true,
      message: `Database successfully restored from ${safeName}. Safety snapshot saved as ${safetyName}.`
    });
  } catch (err) {
    console.error('Restore error:', err);
    return res.status(500).json({ success: false, message: 'Failed to restore database: ' + err.message });
  }
};
