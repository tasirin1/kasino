const { Router } = require('express');
const { authenticate, adminOnly } = require('../middleware/auth');
const storage = require('../services/storage');
const ws = require('../services/ws');
const logger = require('../services/logger');

const router = Router();

// Helper: validate numeric fields in config updates
function sanitizeNumeric(val, min, max, fallback) {
  const num = parseFloat(val);
  if (isNaN(num) || !isFinite(num) || num < min || num > max) return fallback;
  return num;
}

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
  let { username, password, balance } = req.body;
  username = (username || '').toString().trim().toLowerCase();
  password = (password || '').toString();

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter' });
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username hanya boleh huruf, angka, dan underscore' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password minimal 4 karakter' });
  }

  const existing = storage.findUser(username);
  if (existing) return res.status(400).json({ error: 'User exists' });

  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash(password, 10);
  const config = storage.getConfig();
  balance = sanitizeNumeric(balance, 0, 999999999, config.startingMoney);
  const user = storage.createUser(username, hashed, balance);
  logger.userCreated(req.user.username, username);
  res.json({ id: user.id, username: user.username, balance: user.balance });
});

// Update user
router.put('/users/:username', async (req, res) => {
  const { username } = req.params;
  const { balance, password } = req.body;

  const user = storage.findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ error: 'Tidak bisa mengubah admin' });

  const updates = {};
  if (balance !== undefined) {
    const bal = sanitizeNumeric(balance, 0, 999999999, user.balance);
    updates.balance = bal;
  }
  if (password) {
    if (password.length < 4) return res.status(400).json({ error: 'Password minimal 4 karakter' });
    const bcrypt = require('bcryptjs');
    updates.password = await bcrypt.hash(password, 10);
  }

  const updated = storage.updateUser(username, updates);
  if (updated) {
    ws.broadcastBalance(username, updated.balance);
    logger.balanceReset(req.user.username, username, updated.balance);
    res.json({ username, balance: updated.balance });
  } else {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete user
router.delete('/users/:username', (req, res) => {
  const user = storage.findUser(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ error: 'Tidak bisa menghapus admin' });
  const deleted = storage.deleteUser(req.params.username);
  logger.userDeleted(req.user.username, req.params.username);
  res.json({ deleted });
});

// Reset all balances
router.post('/reset-balances', (req, res) => {
  const config = storage.getConfig();
  storage.resetAllBalances(config.startingMoney);
  ws.broadcastReset();
  ws.broadcastConfig(storage.getConfig());
  logger.balanceReset(req.user.username, 'ALL', config.startingMoney);
  res.json({ success: true, startingMoney: config.startingMoney });
});

// Update config with validation
router.post('/config', (req, res) => {
  const updates = {};
  const allowedFields = [
    'difficulty', 'winRate', 'payoutMultiplier', 'minSpinsBeforeWin',
    'jackpotHitRate', 'jackpot', 'startingMoney', 'minBet', 'maxBet', 'betAmount'
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      switch (key) {
        case 'difficulty':
          const validDiffs = ['very-easy','easy','medium','hard','very-hard','impossible'];
          if (validDiffs.includes(String(req.body[key]))) {
            updates[key] = String(req.body[key]);
          }
          break;
        case 'winRate':
          updates[key] = sanitizeNumeric(req.body[key], 0, 1, null);
          break;
        case 'jackpotHitRate':
          updates[key] = sanitizeNumeric(req.body[key], 0, 1, null);
          break;
        case 'payoutMultiplier':
          updates[key] = sanitizeNumeric(req.body[key], 0.1, 1000, null);
          break;
        case 'startingMoney':
        case 'jackpot':
        case 'minBet':
        case 'maxBet':
        case 'betAmount':
          updates[key] = sanitizeNumeric(req.body[key], 0, 999999999, null);
          break;
        case 'minSpinsBeforeWin':
          updates[key] = sanitizeNumeric(req.body[key], 0, 10000, null);
          break;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const config = storage.updateConfig(updates);
  logger.configChange(req.user.username, updates);
  ws.broadcastConfig(config);

  if (updates.jackpot !== undefined) ws.broadcastJackpot(updates.jackpot);
  if (updates.difficulty) {
    const { DIFFICULTIES } = require('../utils/constants');
    const diff = DIFFICULTIES[updates.difficulty];
    if (diff) ws.broadcastDifficulty(diff.label, diff.winRate, diff.payoutMult);
  }

  res.json(config);
});

// Update jackpot with validation
router.post('/jackpot', (req, res) => {
  const value = sanitizeNumeric(req.body.value, 0, 999999999, null);
  if (value === null) return res.status(400).json({ error: 'Value must be a positive number' });
  const jp = storage.setJackpot(value);
  ws.broadcastJackpot(jp.value);
  logger.configChange(req.user.username, { jackpot: value });
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
  if (user.isAdmin) return res.status(400).json({ error: 'Tidak bisa mengubah admin settings' });

  const updates = req.body;
  // Sanitize settings fields
  if (updates.winRate !== undefined) updates.winRate = sanitizeNumeric(updates.winRate, 0, 1, user.settings?.winRate);
  if (updates.payoutMultiplier !== undefined) updates.payoutMultiplier = sanitizeNumeric(updates.payoutMultiplier, 0.1, 1000, user.settings?.payoutMultiplier);

  const settings = storage.updateUserSettings(username, updates);
  if (settings) {
    ws.broadcast({ type: 'settingsChanged', username, settings });
    res.json(settings);
  } else {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Reset specific user balance to starting money
router.post('/users/:username/reset-balance', (req, res) => {
  const { username } = req.params;
  const user = storage.findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ error: 'Tidak bisa reset balance admin' });

  const config = storage.getConfig();
  const updated = storage.updateUser(username, { balance: config.startingMoney });
  if (updated) {
    ws.broadcastBalance(username, updated.balance);
    logger.balanceReset(req.user.username, username, config.startingMoney);
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
  const body = req.body;
  if (!body.name || !body.name.trim()) return res.status(400).json({ error: 'Game name required' });
  body.name = body.name.trim().substring(0, 50);
  const game = createGame(body);
  if (!game) return res.status(400).json({ error: 'Game ID already exists' });
  ws.broadcast({ type: 'gamesUpdated' });
  res.json(game);
});

// Update game meta (name, category, thumbnail, etc.)
router.put('/games/:gameId', (req, res) => {
  const { updateGameMeta, getGame } = require('../services/games');
  const game = getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const sanitized = {};
  if (req.body.name) sanitized.name = String(req.body.name).trim().substring(0, 50);
  if (req.body.category) sanitized.category = String(req.body.category).trim().substring(0, 20);
  if (req.body.description) sanitized.description = String(req.body.description).trim().substring(0, 200);
  if (req.body.thumbnail) sanitized.thumbnail = String(req.body.thumbnail).trim().substring(0, 200);
  if (req.body.sortOrder !== undefined) sanitized.sortOrder = sanitizeNumeric(req.body.sortOrder, 0, 1000, game.sortOrder);
  const updated = updateGameMeta(req.params.gameId, sanitized);
  ws.broadcast({ type: 'gamesUpdated' });
  res.json(updated);
});

// Update game config (winRate, payout, etc.)
router.put('/games/:gameId/config', (req, res) => {
  const { updateGameConfig, getGame } = require('../services/games');
  const game = getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const sanitized = {};
  if (req.body.winRate !== undefined) sanitized.winRate = sanitizeNumeric(req.body.winRate, 0, 1, game.config.winRate);
  if (req.body.payoutMultiplier !== undefined) sanitized.payoutMultiplier = sanitizeNumeric(req.body.payoutMultiplier, 0.1, 1000, game.config.payoutMultiplier);
  if (req.body.minBet !== undefined) sanitized.minBet = sanitizeNumeric(req.body.minBet, 1, 999999999, game.config.minBet);
  if (req.body.maxBet !== undefined) sanitized.maxBet = sanitizeNumeric(req.body.maxBet, 1, 999999999, game.config.maxBet);
  if (req.body.jackpotHitRate !== undefined) sanitized.jackpotHitRate = sanitizeNumeric(req.body.jackpotHitRate, 0, 1, game.config.jackpotHitRate);

  const updated = updateGameConfig(req.params.gameId, sanitized);
  ws.broadcast({ type: 'gameConfigChanged', gameId: req.params.gameId, config: sanitized });
  res.json(updated);
});

// Toggle game enabled/disabled
router.post('/games/:gameId/toggle', (req, res) => {
  const { toggleGame, getGame } = require('../services/games');
  const game = getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const enabled = req.body.enabled !== undefined ? !!req.body.enabled : !game.enabled;
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
  const user = storage.findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ error: 'Tidak bisa mengubah admin settings' });

  const settings = req.body;
  const users = storage.getUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (!users[idx].settings) users[idx].settings = {};
  if (!users[idx].settings.games) users[idx].settings.games = {};
  users[idx].settings.games[gameId] = { ...(users[idx].settings.games[gameId] || {}), ...settings };
  storage.saveUsers(users);
  ws.broadcast({ type: 'settingsChanged', username, settings: users[idx].settings });
  res.json(users[idx].settings.games[gameId]);
});

module.exports = router;
