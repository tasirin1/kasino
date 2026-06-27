const { Router } = require('express');
const { register, login } = require('../services/auth');
const { loginRateLimit, registerRateLimit } = require('../middleware/rateLimit');
const logger = require('../services/logger');

const router = Router();

router.post('/register', registerRateLimit, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const result = await register(username, password);
  if (result.error) return res.status(400).json(result);
  logger.register(username, true, req.ip);
  res.json(result);
});

router.post('/login', loginRateLimit, async (req, res) => {
  const { username, password } = req.body;
  const result = await login(username, password);
  if (result.error) return res.status(401).json(result);
  logger.login(username, true, req.ip);
  if (result.user && result.user.isAdmin) logger.adminLogin(username, req.ip);
  res.json(result);
});

module.exports = router;
