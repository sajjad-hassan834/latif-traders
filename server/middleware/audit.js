const { db } = require('../config/database');

function logAudit(userId, userName, action, entityType, entityId, details, req) {
  try {
    const isSuperOwner = req?.user?.role === 'superowner' || req?.isSuperOwner;
    const finalUserId = isSuperOwner ? null : (userId || null);
    const finalUserName = isSuperOwner ? 'System' : (userName || 'System');

    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      finalUserId,
      finalUserName,
      action,
      entityType,
      entityId || null,
      typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
      String(ip)
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = {
  logAudit
};
