const { Router } = require('express');
const { authenticate, adminOnly } = require('../middleware/auth');
const storage = require('../services/storage');
const ws = require('../services/ws');

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, adminOnly);

// Get dashboard stats
router.get('/stats', (req, res) => {
  const users = storage.getUsers();
  const config = storage.getConfig();
  const jackpot = storage.getJackpot();

  const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
  const totalSpins = users.reduce((sum, u) => sum + (u.totalSpins || 0), 0);
  const totalPayout = users.reduce((sum, u) => sum + (u.totalPayout || 0), 0);
  const totalBet = users.reduce((sum, u) => sum + (u.totalBet || 0), 0);
  const rtp = totalBet > 0 ? ((totalPayout / totalBet) * 100).toFixed(2) : 0;
  const activeUsers = users.filter(u => !u.isAdmin && (u.totalSpins || 0) > 0).length;

  res.json({
    totalUsers: users.filter(u => !u.isAdmin).length,
    totalBalance,
    totalSpins,
    totalPayout,
    totalBet,
    rtp: parseFloat(rtp),
    activeUsers,
    jackpot: jackpot.value,
    config,
  });
});

// List all users (non-admin)
router.get('/users', (req, res) => {
  const users = storage.getUsers().filter(u => !u.isAdmin).map(u => ({
    id: u.id,
    username: u.username,
    balance: u.balance,
    createdAt: u.createdAt,
    totalSpins: u.totalSpins || 0,
    totalWins: u.totalWins || 0,
    totalBet: u.totalBet || 0,
    totalPayout: u.totalPayout || 0,
  }));
  res.json(users);
});

// Create user
router.post('/users', async (req, res) => {
  const { username, password, balance } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const existing = storage.findUser(username);
  if (existing) return res.status(400).json({ error: 'User exists' });

  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash(password, 10);
  const config = storage.getConfig();
  const user = storage.createUser(username, hashed, balance || config.startingMoney);
  res.json({ id: user.id, username: user.username, balance: user.balance });
});

// Update user
router.put('/users/:username', async (req, res) => {
  const { username } = req.params;
  const { balance, password } = req.body;

  const user = storage.findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates = {};
  if (balance !== undefined) updates.balance = parseInt(balance);
  if (password) {
    const bcrypt = require('bcryptjs');
    updates.password = await bcrypt.hash(password, 10);
  }

  const updated = storage.updateUser(username, updates);
  if (updated) {
    ws.broadcastBalance(username, updated.balance);
    res.json({ username, balance: updated.balance });
  } else {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete user
router.delete('/users/:username', (req, res) => {
  const deleted = storage.deleteUser(req.params.username);
  res.json({ deleted });
});

// Reset all balances
router.post('/reset-balances', (req, res) => {
  const config = storage.getConfig();
  storage.resetAllBalances(config.startingMoney);
  ws.broadcastReset();
  ws.broadcastConfig(storage.getConfig());
  res.json({ success: true, startingMoney: config.startingMoney });
});

// Update config
router.post('/config', (req, res) => {
  const updates = req.body;
  const config = storage.updateConfig(updates);
  ws.broadcastConfig(config);

  // Broadcast specific changes
  if (updates.jackpot !== undefined) ws.broadcastJackpot(updates.jackpot);
  if (updates.difficulty) {
    const { DIFFICULTIES } = require('../utils/constants');
    const diff = DIFFICULTIES[updates.difficulty];
    if (diff) ws.broadcastDifficulty(diff.label, diff.winRate, diff.payoutMult);
  }

  res.json(config);
});

// Update jackpot
router.post('/jackpot', (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Value required' });
  const jp = storage.setJackpot(parseInt(value));
  ws.broadcastJackpot(jp.value);
  res.json(jp);
});

module.exports = router;
