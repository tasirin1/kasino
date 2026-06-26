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
    settings: u.settings || {},
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


// Get user settings
router.get('/users/:username/settings', (req, res) => {
  const settings = storage.getUserSettings(req.params.username);
  if (settings === null) return res.status(404).json({ error: 'User not found' });
  res.json(settings);
});

// Update user settings (per-account overrides)
router.put('/users/:username/settings', (req, res) => {
  const { username } = req.params;
  const user = storage.findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates = req.body;
  const settings = storage.updateUserSettings(username, updates);
  if (settings) {
    // Broadcast settings change to this specific user
    ws.broadcast({ type: 'settingsChanged', username: username, settings: settings });
    res.json(settings);
  } else {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Reset specific user balance to starting money
router.post('/users/:username/reset-balance', (req, res) => {
  const { username } = req.params;
  const config = storage.getConfig();
  const updated = storage.updateUser(username, { balance: config.startingMoney });
  if (updated) {
    ws.broadcastBalance(username, updated.balance);
    res.json({ username, balance: updated.balance });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});


// ===== GAMES MANAGEMENT =====

// Get all games (with full config, includes disabled)
router.get('/games', (req, res) => {
  const { getGames } = require('../services/games');
  res.json(getGames());
});

// Create new game
router.post('/games', (req, res) => {
  const { createGame } = require('../services/games');
  const game = createGame(req.body);
  if (!game) return res.status(400).json({ error: 'Game ID already exists' });
  ws.broadcast({ type: 'gamesUpdated' });
  res.json(game);
});

// Update game meta (name, category, thumbnail, etc.)
router.put('/games/:gameId', (req, res) => {
  const { updateGameMeta, getGame } = require('../services/games');
  const game = getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const updated = updateGameMeta(req.params.gameId, req.body);
  ws.broadcast({ type: 'gamesUpdated' });
  res.json(updated);
});

// Update game config (winRate, payout, etc.)
router.put('/games/:gameId/config', (req, res) => {
  const { updateGameConfig, getGame } = require('../services/games');
  const game = getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const updated = updateGameConfig(req.params.gameId, req.body);
  ws.broadcast({ type: 'gameConfigChanged', gameId: req.params.gameId, config: req.body });
  res.json(updated);
});

// Toggle game enabled/disabled
router.post('/games/:gameId/toggle', (req, res) => {
  const { toggleGame, getGame } = require('../services/games');
  const game = getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const enabled = req.body.enabled !== undefined ? req.body.enabled : !game.enabled;
  const updated = toggleGame(req.params.gameId, enabled);
  ws.broadcast({ type: 'gamesUpdated' });
  res.json(updated);
});

// Delete game
router.delete('/games/:gameId', (req, res) => {
  const { deleteGame } = require('../services/games');
  const deleted = deleteGame(req.params.gameId);
  ws.broadcast({ type: 'gamesUpdated' });
  res.json({ deleted });
});

// Update per-account game settings
router.put('/users/:username/game-settings/:gameId', (req, res) => {
  const { username, gameId } = req.params;
  const user = require('../services/storage').findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const settings = req.body;
  const users = require('../services/storage').getUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (!users[idx].settings) users[idx].settings = {};
  if (!users[idx].settings.games) users[idx].settings.games = {};
  users[idx].settings.games[gameId] = { ...(users[idx].settings.games[gameId] || {}), ...settings };
  require('../services/storage').saveUsers(users);
  ws.broadcast({ type: 'settingsChanged', username, settings: users[idx].settings });
  res.json(users[idx].settings.games[gameId]);
});

module.exports = router;
