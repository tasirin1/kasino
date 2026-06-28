/**
 * Enhanced Rate Limiting — per-IP limits for login, register, spin
 * 
 * Rules:
 * - Login: max 5 attempts per 10 minutes per IP
 * - Register: max 3 registrations per 24 hours per IP
 * - Register cooldown: min 60 seconds between registrations
 * - Spin: max 10 per second per IP
 */

const crypto = require('crypto');

const LOGIN_ATTEMPTS = new Map();
const REGISTER_TRACKER = new Map();
const REGISTER_COOLDOWN = new Map();
const SPIN_LIMIT = new Map();

// Cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of LOGIN_ATTEMPTS) {
    if (now - data.start > 600000) LOGIN_ATTEMPTS.delete(key); // 10 min
  }
  for (const [key, data] of REGISTER_TRACKER) {
    if (now - data.start > 86400000) REGISTER_TRACKER.delete(key); // 24h
  }
  for (const [key, data] of REGISTER_COOLDOWN) {
    if (now - data.start > 120000) REGISTER_COOLDOWN.delete(key); // 2 min
  }
  for (const [key, data] of SPIN_LIMIT) {
    if (now - data.start > 30000) SPIN_LIMIT.delete(key);
  }
}, 60000);

function _getIp(req) {
  return req.ip || req.connection.remoteAddress || 
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function _getFingerprint(req) {
  // Build a fingerprint from available request data
  const ua = req.headers['user-agent'] || '';
  const accept = req.headers['accept'] || '';
  const acceptLang = req.headers['accept-language'] || '';
  const secCh = req.headers['sec-ch-ua'] || '';
  const raw = ua + '|' + accept + '|' + acceptLang + '|' + secCh;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

// Login: max 5 attempts per 10 minutes
function loginRateLimit(req, res, next) {
  const ip = _getIp(req);
  const now = Date.now();
  const windowMs = 600000; // 10 minutes
  const maxAttempts = 5;

  const data = LOGIN_ATTEMPTS.get(ip);
  if (!data || now - data.start > windowMs) {
    LOGIN_ATTEMPTS.set(ip, { count: 1, start: now });
    return next();
  }

  data.count++;
  if (data.count > maxAttempts) {
    const retryAfter = Math.ceil((windowMs - (now - data.start)) / 60000);
    return res.status(429).json({ 
      error: `Terlalu banyak percobaan login. Coba lagi ${retryAfter} menit lagi.`,
      retryAfter 
    });
  }
  next();
}

// Reset login attempts on successful login
function resetLoginAttempts(req) {
  const ip = _getIp(req);
  LOGIN_ATTEMPTS.delete(ip);
}

// Register: max 3 per 24 hours per IP + 60s cooldown
function registerRateLimit(req, res, next) {
  const ip = _getIp(req);
  const now = Date.now();
  const windowMs = 86400000; // 24 hours
  const maxRegistrations = 3;
  const cooldownMs = 60000; // 60 seconds

  // Cooldown check: minimum time between registrations
  const lastReg = REGISTER_COOLDOWN.get(ip);
  if (lastReg && now - lastReg.start < cooldownMs) {
    const wait = Math.ceil((cooldownMs - (now - lastReg.start)) / 1000);
    return res.status(429).json({ 
      error: `Harap tunggu ${wait} detik sebelum registrasi lagi.`,
      retryAfter: wait 
    });
  }

  // 24h quota check
  const data = REGISTER_TRACKER.get(ip);
  if (!data || now - data.start > windowMs) {
    REGISTER_TRACKER.set(ip, { count: 1, start: now });
    REGISTER_COOLDOWN.set(ip, { start: now });
    return next();
  }

  if (data.count >= maxRegistrations) {
    return res.status(429).json({ 
      error: 'Terlalu banyak registrasi dari IP ini dalam 24 jam.' 
    });
  }

  data.count++;
  REGISTER_COOLDOWN.set(ip, { start: now });
  next();
}

// Spin: max 10 per second
function spinRateLimit(req, res, next) {
  const ip = _getIp(req);
  const now = Date.now();
  const windowMs = 1000;
  const maxSpins = 10;

  const data = SPIN_LIMIT.get(ip);
  if (!data || now - data.start > windowMs) {
    SPIN_LIMIT.set(ip, { count: 1, start: now });
    return next();
  }

  data.count++;
  if (data.count > maxSpins) {
    return res.status(429).json({ error: 'Terlalu cepat. Tunggu sebentar.' });
  }
  next();
}

module.exports = { loginRateLimit, registerRateLimit, spinRateLimit, resetLoginAttempts, _getIp, _getFingerprint };
