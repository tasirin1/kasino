/**
 * Games Routes — public endpoints for game list and per-game config
 */
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');
const gamesService = require('../services/games');
const ws = require('../services/ws');

const router = Router();

// Get all enabled games (public — no auth needed for lobby)
router.get('/games', (req, res) => {
  const games = gamesService.getGames().map(g => ({
    id: g.id,
    name: g.name,
    category: g.category,
    description: g.description,
    thumbnail: g.thumbnail,
    enabled: g.enabled,
    sortOrder: g.sortOrder,
    config: g.config ? {
      minBet: g.config.minBet,
      maxBet: g.config.maxBet,
      maxWin: g.config.maxWin,
      maxMultiplier: g.config.maxMultiplier,
    } : {},
  }));
  res.json(games);
});

// Get single game config (includes game-specific settings)
router.get('/games/:gameId', (req, res) => {
  const game = gamesService.getGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json({
    id: game.id,
    name: game.name,
    category: game.category,
    description: game.description,
    thumbnail: game.thumbnail,
    enabled: game.enabled,
    config: game.config || {},
  });
});

// Get effective config for authenticated user (merges global + game + user)
router.get('/games/:gameId/config', authenticate, (req, res) => {
  const username = req.user.username;
  const effective = gamesService.getEffectiveGameConfig(req.params.gameId, username);
  if (!effective) return res.status(404).json({ error: 'Game not found' });
  res.json(effective);
});

// Lobby data: jackpot, player count, etc.
router.get('/lobby', (req, res) => {
  const jackpot = storage.getJackpot();
  const users = storage.getUsers();
  const playerCount = users.filter(u => !u.isAdmin).length;
  const games = gamesService.getEnabledGames().map(g => ({
    id: g.id,
    name: g.name,
    category: g.category,
    description: g.description,
    thumbnail: g.thumbnail,
  }));
  res.json({
    jackpot: jackpot.value,
    playerCount,
    onlineCount: Math.max(1, Math.floor(Math.random() * playerCount) + 1),
    totalGames: games.length,
    games,
  });
});

module.exports = router;
