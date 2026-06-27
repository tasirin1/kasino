const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// GET /api/profile — full profile data
router.get('/', (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const spins = storage.getSpins(user.id, 100);
  const wins = spins.filter(s => s.payout > 0);
  const totalSpins = user.totalSpins || 0;
  const totalWins = user.totalWins || 0;
  const losses = totalSpins - wins.length;
  const winRate = totalSpins > 0 ? ((totalWins / totalSpins) * 100).toFixed(1) : '0.0';

  res.json({
    id: user.id,
    username: user.username,
    balance: user.balance,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    totalSpins,
    totalWins,
    losses,
    totalBet: user.totalBet || 0,
    totalPayout: user.totalPayout || 0,
    winRate: parseFloat(winRate),
    settings: user.settings || {},
  });
});

// PUT /api/profile — update username or settings
router.put('/', async (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, settings } = req.body;

  // Change username
  if (username && username !== req.user.username) {
    const name = username.trim().toLowerCase();
    if (name.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter' });
    const existing = storage.findUser(name);
    if (existing) return res.status(400).json({ error: 'Username sudah digunakan' });

    storage.updateUser(req.user.username, { username: name });
    req.user.username = name;
  }

  // Update settings
  if (settings) {
    storage.updateUserSettings(req.user.username, settings);
  }

  const updated = storage.findUser(req.user.username);
  res.json({
    success: true,
    username: updated.username,
    balance: updated.balance,
    settings: updated.settings || {},
  });
});

// PUT /api/profile/password — change password
router.put('/password', async (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password dan new password diperlukan' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Password baru minimal 4 karakter' });
  }

  // Verify old password
  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) return res.status(400).json({ error: 'Password lama salah' });

  const hashed = await bcrypt.hash(newPassword, 10);
  storage.updateUser(req.user.username, { password: hashed });
  res.json({ success: true, message: 'Password berhasil diubah' });
});

// GET /api/profile/history — spin history
router.get('/history', (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const spins = storage.getSpins(user.id, limit);

  res.json({
    total: spins.length,
    spins: spins.map(s => ({
      gameId: s.gameId,
      bet: s.bet,
      payout: s.payout,
      win: s.payout > 0,
      timestamp: s.timestamp,
    })),
  });
});

module.exports = router;
