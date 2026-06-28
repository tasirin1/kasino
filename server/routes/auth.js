const { Router } = require('express');
const { register, login } = require('../services/auth');
const { loginRateLimit, registerRateLimit, resetLoginAttempts, _getIp, _getFingerprint } = require('../middleware/rateLimit');
const security = require('../services/security');
const storage = require('../services/storage');
const logger = require('../services/logger');

const router = Router();

// GET /api/captcha — get a CAPTCHA challenge
router.get('/captcha', (req, res) => {
  const c = security.createCaptcha();
  res.json(c);
});

router.post('/register', registerRateLimit, async (req, res) => {
  const { username, password, captchaId, captchaAnswer, fingerprint } = req.body;
  
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  // Validate CAPTCHA
  if (!captchaId || captchaAnswer === undefined) {
    return res.status(400).json({ error: 'CAPTCHA wajib diisi' });
  }
  if (!security.verifyCaptcha(captchaId, captchaAnswer)) {
    security.logRegistration(username, _getIp(req), fingerprint || 'unknown', false, 'CAPTCHA salah');
    return res.status(400).json({ error: 'CAPTCHA salah' });
  }
  
  const ip = _getIp(req);
  const fp = fingerprint || _getFingerprint(req);
  
  // Check if IP is blocked
  if (security.isIpBlocked(ip)) {
    security.logRegistration(username, ip, fp, false, 'IP diblokir');
    return res.status(403).json({ error: 'Pendaftaran dari IP ini diblokir. Hubungi admin.' });
  }
  
  // Check if fingerprint is blocked
  if (security.isFingerprintBlocked(fp)) {
    security.logRegistration(username, ip, fp, false, 'Perangkat diblokir');
    return res.status(403).json({ error: 'Pendaftaran dari perangkat ini diblokir. Hubungi admin.' });
  }
  
  // Track IP and fingerprint
  security.trackIp(ip, username);
  security.trackFingerprint(fp, username, ip);
  
  // Determine starting money
  const moneyResult = security.shouldGiveStartingMoney(ip, fp);
  let startingMoney = storage.getConfig().startingMoney || 10000;
  
  if (!moneyResult.give) {
    startingMoney = 0;
  } else if (moneyResult.amount === 'half') {
    startingMoney = Math.floor(startingMoney / 2);
  }
  
  // Create user with adjusted starting money
  const result = await register(username, password, startingMoney);
  if (result.error) {
    security.logRegistration(username, ip, fp, false, result.error);
    return res.status(400).json(result);
  }
  
  // Log successful registration
  security.logRegistration(username, ip, fp, true, 'berhasil');
  logger.register(username, true, ip, fp);
  
  res.json({ 
    ...result, 
    notice: moneyResult.amount === 'half' ? 'Saldo awal dikurangi karena perangkat/IP sudah terdaftar.' :
            moneyResult.amount === 'none' ? 'Akun dibuat tanpa saldo awal karena terlalu banyak akun dari perangkat/IP ini.' : undefined
  });
});

router.post('/login', loginRateLimit, async (req, res) => {
  const { username, password, fingerprint } = req.body;
  const result = await login(username, password);
  const ip = _getIp(req);
  const fp = fingerprint || _getFingerprint(req);
  
  if (result.error) {
    logger.login(username, false, ip);
    return res.status(401).json(result);
  }
  
  // Track login
  security.trackIp(ip, username);
  if (fp) security.trackFingerprint(fp, username, ip);
  
  // Reset login attempts on success
  resetLoginAttempts(req);
  
  logger.login(username, true, ip);
  if (result.user && result.user.isAdmin) logger.adminLogin(username, ip);
  
  // Add warnings if needed
  const ipData = security.getAccountsByIp(ip);
  const fpData = fp ? security.getAccountsByFingerprint(fp) : null;
  
  res.json({
    ...result,
    warnings: {
      multiAccount: ipData.accounts.length >= 3 ? `IP ini terdaftar dengan ${ipData.accounts.length} akun` : undefined,
      sameDevice: fpData && fpData.accounts.length >= 3 ? `Perangkat ini terdaftar dengan ${fpData.accounts.length} akun` : undefined,
    }
  });
});

module.exports = router;
