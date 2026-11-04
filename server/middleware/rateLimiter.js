/**
 * In-Memory Rate Limiting Middleware
 * 
 * Rules:
 * - Login: Counts only FAILED attempts (401). Successful login (200) resets counter. Max 5 fails per 15 mins.
 * - Register: Counts EVERY attempt. Max 10 attempts per hour per IP.
 * - Supports reverse proxy header inspection via trust proxy (req.ip).
 */

const failedLogins = new Map(); // key: `${ip}:${username}` -> { count, expiresAt }
const registrationAttempts = new Map(); // key: ip -> { count, expiresAt }

// Cleanup expired buckets periodically (every 5 mins)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of failedLogins.entries()) {
    if (v.expiresAt <= now) failedLogins.delete(k);
  }
  for (const [k, v] of registrationAttempts.entries()) {
    if (v.expiresAt <= now) registrationAttempts.delete(k);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Login Rate Limiter Middleware
 * Intercepts response to record only failed authentications.
 */
function loginRateLimiter(req, res, next) {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITS) {
    return next();
  }

  const ip = getClientIp(req);
  const username = String(req.body?.username || '').toLowerCase().trim();
  const key = `${ip}:${username}`;
  const now = Date.now();

  const record = failedLogins.get(key);
  if (record && record.expiresAt > now && record.count >= 5) {
    const waitMins = Math.ceil((record.expiresAt - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${waitMins} minute(s).`
    });
  }

  // Hook into response finish to evaluate outcome
  const originalEnd = res.end;
  res.end = function (...args) {
    if (res.statusCode === 401) {
      // Failed login: increment counter
      const cur = failedLogins.get(key);
      if (!cur || cur.expiresAt <= now) {
        failedLogins.set(key, { count: 1, expiresAt: now + 15 * 60 * 1000 });
      } else {
        cur.count++;
      }
    } else if (res.statusCode === 200) {
      // Successful login: reset failed attempts
      failedLogins.delete(key);
    }
    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Registration Rate Limiter Middleware
 * Counts every request per IP (max 10/hr).
 */
function registerRateLimiter(req, res, next) {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITS) {
    return next();
  }

  const ip = getClientIp(req);
  const now = Date.now();

  const record = registrationAttempts.get(ip);
  if (record && record.expiresAt > now && record.count >= 10) {
    const waitMins = Math.ceil((record.expiresAt - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Registration rate limit exceeded. Please try again in ${waitMins} minute(s).`
    });
  }

  if (!record || record.expiresAt <= now) {
    registrationAttempts.set(ip, { count: 1, expiresAt: now + 60 * 60 * 1000 });
  } else {
    record.count++;
  }

  next();
}

function resetLimitersForTesting() {
  failedLogins.clear();
  registrationAttempts.clear();
}

module.exports = {
  loginRateLimiter,
  registerRateLimiter,
  resetLimitersForTesting
};
