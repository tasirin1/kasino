const { Router } = require('express');
const { register, login } = require('../services/auth');
const { loginRateLimit } = require('../middleware/rateLimit');

const router = Router();

router.post('/register', loginRateLimit, async (req, res) => {
  const { username, password } = req.body;
  const result = await register(username, password);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/login', loginRateLimit, async (req, res) => {
  const { username, password } = req.body;
  const result = await login(username, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

module.exports = router;
