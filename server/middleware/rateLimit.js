const attempts = new Map();

function loginRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxAttempts = 10;

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
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  next();
}

module.exports = { loginRateLimit };
