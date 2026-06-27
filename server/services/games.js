/**
 * Games Registry Service
 * Manages game definitions and per-game configurations.
 * Stored as JSON in data/games.json
 * All inputs sanitized — never trust client data.
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
    provider: 'SlotCasino',
    rtp: 97.5,
    thumbnail: '/assets/games/classic777.svg',
    badge: 'HOT',
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
    provider: 'SlotCasino',
    rtp: 96.8,
    thumbnail: '/assets/games/luckyfruits.svg',
    badge: 'NEW',
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
    provider: 'SlotCasino',
    rtp: 99.1,
    thumbnail: '/assets/games/plinko.svg',
    badge: '',
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
    provider: 'SlotCasino',
    rtp: 98.2,
    thumbnail: '/assets/games/coinflip.svg',
    badge: '',
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
    provider: 'SlotCasino',
    rtp: 97.0,
    thumbnail: '/assets/games/diceroll.svg',
    badge: '',
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
  const name = (gameData.name || '').trim().substring(0, 50);
  if (!name) return null;
  const id = gameData.id || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (games.find(g => g.id === id)) return null;
  const game = {
    id,
    name,
    category: ['slot', 'arcade', 'table', 'instant-win'].includes(gameData.category) ? gameData.category : 'other',
    description: (gameData.description || '').substring(0, 200),
    provider: 'SlotCasino',
    thumbnail: (gameData.thumbnail || '').substring(0, 200),
    badge: '',
    enabled: gameData.enabled !== false,
    sortOrder: games.length + 1,
    config: {
      winRate: Math.max(0, Math.min(1, parseFloat(gameData.config?.winRate) || 0.2)),
      payoutMultiplier: Math.max(0.1, Math.min(1000, parseFloat(gameData.config?.payoutMultiplier) || 2)),
      minBet: Math.max(1, parseInt(gameData.config?.minBet) || 10),
      maxBet: Math.min(999999999, parseInt(gameData.config?.maxBet) || 5000),
      jackpotHitRate: Math.max(0, Math.min(1, parseFloat(gameData.config?.jackpotHitRate) || 0.005)),
      maxWin: Math.max(0, parseInt(gameData.config?.maxWin) || 1000000),
      maxMultiplier: Math.max(1, parseInt(gameData.config?.maxMultiplier) || 100),
      ...(gameData.config ? {} : {}),
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
  games[idx].enabled = !!enabled;
  saveGames(games);
  return games[idx];
}

function updateGameMeta(gameId, updates) {
  const games = getGames();
  const idx = games.findIndex(g => g.id === gameId);
  if (idx === -1) return null;
  const allowed = ['name', 'category', 'description', 'thumbnail', 'sortOrder'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === 'category') {
        const valid = ['slot', 'arcade', 'table', 'instant-win', 'other'];
        if (valid.includes(String(updates[key]))) games[idx][key] = String(updates[key]);
      } else {
        games[idx][key] = updates[key];
      }
    }
  }
  saveGames(games);
  return games[idx];
}

// Per-game + per-account merged config
function getEffectiveGameConfig(gameId, username) {
  const gameConfig = getGameConfig(gameId);
  if (!gameConfig) return null;

  // Start with game defaults
  const merged = { ...gameConfig };

  // Global admin config OVERRIDES game defaults
  const global = getGlobalConfig();
  for (const key of Object.keys(global)) {
    if (global[key] !== undefined) {
      merged[key] = global[key];
    }
  }

  // User per-account settings have highest priority
  if (username) {
    const userSettings = getUserGameSettings(username, gameId);
    if (userSettings) {
      for (const key of Object.keys(userSettings)) {
        if (userSettings[key] !== undefined) {
          merged[key] = userSettings[key];
        }
      }
    }
  }

  // Clamp all numeric values
  if (merged.winRate !== undefined) merged.winRate = Math.max(0, Math.min(1, parseFloat(merged.winRate) || 0.15));
  if (merged.payoutMultiplier !== undefined) merged.payoutMultiplier = Math.max(0.1, Math.min(1000, parseFloat(merged.payoutMultiplier) || 2));
  if (merged.minBet !== undefined) merged.minBet = Math.max(1, parseInt(merged.minBet) || 10);
  if (merged.maxBet !== undefined) merged.maxBet = Math.min(999999999, parseInt(merged.maxBet) || 10000);
  if (merged.jackpotHitRate !== undefined) merged.jackpotHitRate = Math.max(0, Math.min(1, parseFloat(merged.jackpotHitRate) || 0.005));

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
