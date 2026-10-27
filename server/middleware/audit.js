const { db } = require('../config/database');

/**
 * Sanitizes sensitive fields from details before writing to audit logs
 */
function sanitizeAuditDetails(details) {
  if (!details) return '';
  if (typeof details === 'string') {
    return details
      .replace(/(password|token|reset_token|secret|temporary_password)\s*[:=]\s*["']?[^"'\s,]+["']?/gi, '$1=[REDACTED]');
  }
  if (typeof details === 'object') {
    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'new_password', 'old_password', 'temporary_password', 'token', 'reset_token', 'jwt', 'secret'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return JSON.stringify(sanitized);
  }
  return String(details);
}

async function logAudit(userId, userName, action, entityType, entityId, details, req) {
  try {
    const isSuperOwner = req?.user?.role === 'superowner' || req?.isSuperOwner;
    const finalUserId = isSuperOwner ? null : (userId || null);
    const finalUserName = isSuperOwner ? 'System' : (userName || 'System');

    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    let tenantId = req?.tenantId || req?.tenant_id || req?.user?.tenant_id;
    if (!tenantId && finalUserId) {
      try {
        const u = await db.get('SELECT tenant_id FROM users WHERE id = ?', [finalUserId]);
        if (u) tenantId = u.tenant_id;
      } catch (_) {}
    }
    
    // Never attribute unattributed or superowner logs to any specific tenant
    const finalTenantId = tenantId || (isSuperOwner ? 'system' : null);

    const sanitizedDetails = sanitizeAuditDetails(details);

    await db.run(`
      INSERT INTO audit_logs (tenant_id, user_id, user_name, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalTenantId,
      finalUserId,
      finalUserName,
      action,
      entityType,
      entityId || null,
      sanitizedDetails,
      String(ip)
    ]);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = {
  logAudit,
  sanitizeAuditDetails
};
