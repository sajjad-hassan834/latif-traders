/**
 * In-Memory Rate Limiting Middleware
 * 
 * Rules:
 * - Login: Counts ONLY FAILED attempts (401).
 *   - Keyed by IP + username (max 5 fails per 15 mins).
 *   - IP-wide failure cap (max 25 fails per 15 mins across all usernames).
 *   - Successful login (200) resets the IP+username counter.
 *   - Valid logins never blocked (ten staff on one IP with valid credentials proceed freely).
 * - Register: Counts EVERY request (max 10 attempts per hour per IP).
 * - Forgot Password: Max 5 attempts per 15 mins per IP.
 * - Change Password: Max 10 attempts per 15 mins per IP.
 * - Supports reverse proxy header inspection via trust proxy (req.ip).
 */

const failedLogins = new Map(); // key: `${ip}:${username}` -> { count, expiresAt }
const failedLoginsByIp = new Map(); // key: `${ip}` -> { count, expiresAt }
const registrationAttempts = new Map(); // key: ip -> { count, expiresAt }
const forgotPasswordAttempts = new Map(); // key: ip -> { count, expiresAt }
const changePasswordAttempts = new Map(); // key: ip -> { count, expiresAt }

// Cleanup expired buckets periodically (every 5 mins)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of failedLogins.entries()) {
    if (v.expiresAt <= now) failedLogins.delete(k);
  }
  for (const [k, v] of failedLoginsByIp.entries()) {
    if (v.expiresAt <= now) failedLoginsByIp.delete(k);
  }
  for (const [k, v] of registrationAttempts.entries()) {
    if (v.expiresAt <= now) registrationAttempts.delete(k);
  }
  for (const [k, v] of forgotPasswordAttempts.entries()) {
    if (v.expiresAt <= now) forgotPasswordAttempts.delete(k);
  }
  for (const [k, v] of changePasswordAttempts.entries()) {
    if (v.expiresAt <= now) changePasswordAttempts.delete(k);
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
  const userKey = `${ip}:${username}`;
  const now = Date.now();

  // Check 1: User-specific failure threshold (5 failures per 15 min)
  const userRecord = failedLogins.get(userKey);
  if (userRecord && userRecord.expiresAt > now && userRecord.count >= 5) {
    const waitMins = Math.ceil((userRecord.expiresAt - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts for this account. Temporarily locked for security. Please try again in ${waitMins} minute(s).`
    });
  }

  // Check 2: IP-wide failure cap (25 failures per 15 min across all accounts)
  const ipRecord = failedLoginsByIp.get(ip);
  if (ipRecord && ipRecord.expiresAt > now && ipRecord.count >= 25) {
    const waitMins = Math.ceil((ipRecord.expiresAt - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts from this network. Temporarily rate-limited. Please try again in ${waitMins} minute(s).`
    });
  }

  // Hook into response finish to evaluate outcome
  const originalEnd = res.end;
  res.end = function (...args) {
    if (res.statusCode === 401) {
      // Failed login: increment user counter
      const curUser = failedLogins.get(userKey);
      if (!curUser || curUser.expiresAt <= now) {
        failedLogins.set(userKey, { count: 1, expiresAt: now + 15 * 60 * 1000 });
      } else {
        curUser.count++;
      }

      // Increment IP-wide failure counter
      const curIp = failedLoginsByIp.get(ip);
      if (!curIp || curIp.expiresAt <= now) {
        failedLoginsByIp.set(ip, { count: 1, expiresAt: now + 15 * 60 * 1000 });
      } else {
        curIp.count++;
      }
    } else if (res.statusCode === 200) {
      // Successful login: reset user failed attempts
      failedLogins.delete(userKey);
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

function forgotPasswordRateLimiter(req, res, next) {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITS) return next();
  const ip = getClientIp(req);
  const now = Date.now();
  const record = forgotPasswordAttempts.get(ip);
  if (record && record.expiresAt > now && record.count >= 5) {
    const waitMins = Math.ceil((record.expiresAt - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many password reset requests. Please try again in ${waitMins} minute(s).`
    });
  }
  const cur = forgotPasswordAttempts.get(ip);
  if (!cur || cur.expiresAt <= now) {
    forgotPasswordAttempts.set(ip, { count: 1, expiresAt: now + 15 * 60 * 1000 });
  } else {
    cur.count++;
  }
  next();
}

function changePasswordRateLimiter(req, res, next) {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITS) return next();
  const ip = getClientIp(req);
  const now = Date.now();
  const record = changePasswordAttempts.get(ip);
  if (record && record.expiresAt > now && record.count >= 10) {
    const waitMins = Math.ceil((record.expiresAt - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many password change attempts. Please try again in ${waitMins} minute(s).`
    });
  }
  const cur = changePasswordAttempts.get(ip);
  if (!cur || cur.expiresAt <= now) {
    changePasswordAttempts.set(ip, { count: 1, expiresAt: now + 15 * 60 * 1000 });
  } else {
    cur.count++;
  }
  next();
}

function resetLimitersForTesting() {
  failedLogins.clear();
  failedLoginsByIp.clear();
  registrationAttempts.clear();
  forgotPasswordAttempts.clear();
  changePasswordAttempts.clear();
}

module.exports = {
  loginRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
  changePasswordRateLimiter,
  resetLimitersForTesting
};
