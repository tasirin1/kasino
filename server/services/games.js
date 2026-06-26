/**
 * Games Registry Service
 * Manages game definitions and per-game configurations.
 * Stored as JSON in data/games.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const GAMES_FILE = 'games.json';

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(file) {
  ensureDir();
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function write(file, data) {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
  return data;
}

const DEFAULT_GAMES = [
  {
    id: 'classic777',
    name: 'Classic 777',
    category: 'slot',
    description: 'Slot klasik 3 reel dengan simbol BAR, 7, dan Bell',
    thumbnail: '',
    enabled: true,
    sortOrder: 1,
    config: {
      winRate: 0.25,
      payoutMultiplier: 3,
      minBet: 10,
      maxBet: 10000,
      jackpotHitRate: 0.005,
      maxWin: 1000000,
      maxMultiplier: 500,
    }
  },
  {
    id: 'luckyfruits',
    name: 'Lucky Fruits',
    category: 'slot',
    description: 'Slot buah-buahan dengan jackpot progresif',
    thumbnail: '',
    enabled: true,
    sortOrder: 2,
    config: {
      winRate: 0.22,
      payoutMultiplier: 2.5,
      minBet: 10,
      maxBet: 5000,
      jackpotHitRate: 0.003,
      maxWin: 500000,
      maxMultiplier: 300,
    }
  },
  {
    id: 'plinko',
    name: 'Plinko',
    category: 'arcade',
    description: 'Jatuhkan bola dan menangkan multiplier besar',
    thumbnail: '',
    enabled: true,
    sortOrder: 3,
    config: {
      winRate: 0.4,
      payoutMultiplier: 1.5,
      minBet: 10,
      maxBet: 5000,
      riskLevels: ['low', 'medium', 'high'],
      defaultRisk: 'medium',
      maxWin: 1000000,
      maxMultiplier: 1000,
    }
  },
  {
    id: 'coinflip',
    name: 'Coin Flip',
    category: 'arcade',
    description: 'Tebak kepala atau ekor, 50:50 fair chance',
    thumbnail: '',
    enabled: true,
    sortOrder: 4,
    config: {
      winRate: 0.45,
      payoutMultiplier: 1.8,
      minBet: 10,
      maxBet: 10000,
      maxWin: 500000,
      maxMultiplier: 2,
    }
  },
  {
    id: 'diceroll',
    name: 'Dice Roll',
    category: 'arcade',
    description: 'Tebak angka dadu untuk menang besar',
    thumbnail: '',
    enabled: true,
    sortOrder: 5,
    config: {
      winRate: 0.3,
      payoutMultiplier: 2.5,
      minBet: 10,
      maxBet: 5000,
      maxWin: 500000,
      maxMultiplier: 6,
    }
  },
];

function getGames() {
  let games = read(GAMES_FILE);
  if (!games || !Array.isArray(games) || games.length === 0) {
    write(GAMES_FILE, DEFAULT_GAMES);
    return JSON.parse(JSON.stringify(DEFAULT_GAMES));
  }
  return games;
}

function saveGames(games) {
  write(GAMES_FILE, games);
  return games;
}

function getGame(gameId) {
  const games = getGames();
  return games.find(g => g.id === gameId) || null;
}

function getEnabledGames() {
  return getGames().filter(g => g.enabled);
}

function getGameConfig(gameId) {
  const game = getGame(gameId);
  if (!game) return null;
  return game.config || {};
}

function updateGameConfig(gameId, configUpdates) {
  const games = getGames();
  const idx = games.findIndex(g => g.id === gameId);
  if (idx === -1) return null;
  games[idx].config = { ...games[idx].config, ...configUpdates };
  saveGames(games);
  return games[idx];
}

function createGame(gameData) {
  const games = getGames();
  const id = gameData.id || gameData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (games.find(g => g.id === id)) return null;
  const game = {
    id,
    name: gameData.name,
    category: gameData.category || 'other',
    description: gameData.description || '',
    thumbnail: gameData.thumbnail || '',
    enabled: gameData.enabled !== false,
    sortOrder: games.length + 1,
    config: {
      winRate: 0.2,
      payoutMultiplier: 2,
      minBet: 10,
      maxBet: 5000,
      jackpotHitRate: 0.005,
      maxWin: 1000000,
      maxMultiplier: 100,
      ...(gameData.config || {}),
    }
  };
  games.push(game);
  saveGames(games);
  return game;
}

function deleteGame(gameId) {
  const games = getGames();
  const filtered = games.filter(g => g.id !== gameId);
  if (filtered.length === games.length) return false;
  saveGames(filtered);
  return true;
}

function toggleGame(gameId, enabled) {
  const games = getGames();
  const idx = games.findIndex(g => g.id === gameId);
  if (idx === -1) return null;
  games[idx].enabled = enabled;
  saveGames(games);
  return games[idx];
}

function updateGameMeta(gameId, updates) {
  const games = getGames();
  const idx = games.findIndex(g => g.id === gameId);
  if (idx === -1) return null;
  const allowed = ['name', 'category', 'description', 'thumbnail', 'sortOrder'];
  for (const key of allowed) {
    if (updates[key] !== undefined) games[idx][key] = updates[key];
  }
  saveGames(games);
  return games[idx];
}

// Per-game + per-account merged config
function getEffectiveGameConfig(gameId, username) {
  const gameConfig = getGameConfig(gameId);
  if (!gameConfig) return null;

  // Start with global config
  const global = getGlobalConfig();

  // Merge game config over global
  const merged = { ...global, ...gameConfig };

  // Merge per-account game settings if available
  if (username) {
    const userSettings = getUserGameSettings(username, gameId);
    if (userSettings) {
      Object.assign(merged, userSettings);
    }
  }

  return merged;
}

function getGlobalConfig() {
  try {
    const storage = require('./storage');
    const cfg = storage.getConfig();
    return {
      winRate: cfg.winRate,
      payoutMultiplier: cfg.payoutMultiplier,
      minBet: cfg.minBet,
      maxBet: cfg.maxBet,
      jackpotHitRate: cfg.jackpotHitRate,
    };
  } catch {
    return {
      winRate: 0.15,
      payoutMultiplier: 3,
      minBet: 10,
      maxBet: 10000,
      jackpotHitRate: 0.005,
    };
  }
}

function getUserGameSettings(username, gameId) {
  try {
    const storage = require('./storage');
    const user = storage.findUser(username);
    if (!user || !user.settings || !user.settings.games) return null;
    return user.settings.games[gameId] || null;
  } catch {
    return null;
  }
}

module.exports = {
  getGames, getGame, getEnabledGames,
  getGameConfig, updateGameConfig,
  createGame, deleteGame, toggleGame, updateGameMeta,
  getEffectiveGameConfig, saveGames,
  DEFAULT_GAMES,
};
