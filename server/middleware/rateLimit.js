/**
 * Rate Limiting — per-IP limits for login, register, and spin
 */
const crypto = require('crypto');

const attempts = new Map();
const REGISTER_LOCK = new Map();
const SPIN_LIMIT = new Map();

// Cleanup old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of attempts) {
    if (now - data.start > 120000) attempts.delete(key);
  }
  for (const [key, data] of REGISTER_LOCK) {
    if (now - data.start > 120000) REGISTER_LOCK.delete(key);
  }
  for (const [key, data] of SPIN_LIMIT) {
    if (now - data.start > 30000) SPIN_LIMIT.delete(key);
  }
}, 60000);

function _getIp(req) {
  return req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
}

function loginRateLimit(req, res, next) {
  const ip = _getIp(req);
  const now = Date.now();
  const windowMs = 60000;
  const maxAttempts = 5;

  if (!attempts.has(ip)) {
    attempts.set(ip, { count: 1, start: now });
    return next();
  }

  const data = attempts.get(ip);
  if (now - data.start > windowMs) {
    attempts.set(ip, { count: 1, start: now });
    return next();
  }

  data.count++;
  if (data.count > maxAttempts) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi 1 menit.' });
  }
  next();
}

function registerRateLimit(req, res, next) {
  const ip = _getIp(req);
  const now = Date.now();
  const windowMs = 60000;
  const maxRegistrations = 3;

  if (!REGISTER_LOCK.has(ip)) {
    REGISTER_LOCK.set(ip, { count: 1, start: now });
    return next();
  }

  const data = REGISTER_LOCK.get(ip);
  if (now - data.start > windowMs) {
    REGISTER_LOCK.set(ip, { count: 1, start: now });
    return next();
  }

  data.count++;
  if (data.count > maxRegistrations) {
    return res.status(429).json({ error: 'Terlalu banyak registrasi. Coba lagi 1 menit.' });
  }
  next();
}

function spinRateLimit(req, res, next) {
  const ip = _getIp(req);
  const now = Date.now();
  const windowMs = 1000;
  const maxSpins = 10;

  if (!SPIN_LIMIT.has(ip)) {
    SPIN_LIMIT.set(ip, { count: 1, start: now });
    return next();
  }

  const data = SPIN_LIMIT.get(ip);
  if (now - data.start > windowMs) {
    SPIN_LIMIT.set(ip, { count: 1, start: now });
    return next();
  }

  data.count++;
  if (data.count > maxSpins) {
    return res.status(429).json({ error: 'Terlalu cepat. Tunggu sebentar.' });
  }
  next();
}

module.exports = { loginRateLimit, registerRateLimit, spinRateLimit };
