/**
 * JSON file-based storage service.
 * All data persisted as JSON files in the data/ directory.
 * Designed to be easily replaced with SQLite or PostgreSQL later.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, DIFFICULTIES } = require('../utils/constants');

const DATA_DIR = path.join(__dirname, '../../data');

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

// ===== USERS =====

const USERS_FILE = 'users.json';

function getUsers() {
  return read(USERS_FILE) || [];
}

function saveUsers(users) {
  write(USERS_FILE, users);
}

function findUser(username) {
  return getUsers().find(u => u.username === username);
}

function createUser(username, hashedPassword, startingMoney) {
  const users = getUsers();
  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username,
    password: hashedPassword,
    balance: startingMoney,
    isAdmin: false,
    createdAt: new Date().toISOString(),
    totalSpins: 0,
    totalWins: 0,
    totalBet: 0,
    totalPayout: 0,
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function updateUser(username, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return users[idx];
}

function deleteUser(username) {
  const users = getUsers();
  const filtered = users.filter(u => u.username !== username);
  if (filtered.length === users.length) return false;
  saveUsers(filtered);
  return true;
}

function resetAllBalances(amount) {
  const users = getUsers();
  for (const u of users) {
    if (!u.isAdmin) u.balance = amount;
  }
  saveUsers(users);
  return users;
}

// ===== CONFIG =====

const CONFIG_FILE = 'config.json';

function getConfig() {
  const cfg = read(CONFIG_FILE);
  if (cfg) return cfg;
  // Initialize with defaults
  write(CONFIG_FILE, { ...DEFAULT_CONFIG });
  return { ...DEFAULT_CONFIG };
}

function updateConfig(updates) {
  const cfg = getConfig();
  Object.assign(cfg, updates);
  write(CONFIG_FILE, cfg);
  return cfg;
}

function getDifficultyConfig(difficultyKey) {
  const diff = DIFFICULTIES[difficultyKey];
  if (diff) return diff;
  const cfg = getConfig();
  return {
    winRate: cfg.winRate,
    payoutMult: cfg.payoutMultiplier,
    minSpinsBeforeWin: cfg.minSpinsBeforeWin,
    jackpotHitRate: cfg.jackpotHitRate,
  };
}

// ===== JACKPOT =====

const JACKPOT_FILE = 'jackpot.json';

function getJackpot() {
  const jp = read(JACKPOT_FILE);
  if (jp) return jp;
  const cfg = getConfig();
  write(JACKPOT_FILE, { value: cfg.jackpot });
  return { value: cfg.jackpot };
}

function setJackpot(value) {
  write(JACKPOT_FILE, { value });
  return { value };
}

// ===== SPIN HISTORY =====

const SPINS_FILE = 'spins.json';

function getSpins(userId, limit = 20) {
  const all = read(SPINS_FILE) || [];
  const userSpins = all.filter(s => s.userId === userId).slice(-limit);
  return userSpins.reverse();
}

function addSpin(record) {
  const all = read(SPINS_FILE) || [];
  all.push(record);
  write(SPINS_FILE, all);
  return record;
}



// ===== PER-ACCOUNT SETTINGS =====

function getUserSettings(username) {
  const user = findUser(username);
  if (!user) return null;
  return user.settings || {};
}

function updateUserSettings(username, settings) {
  const users = getUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return null;
  const user = users[idx];
  if (!user.settings) user.settings = {};
  // Merge settings
  for (const [key, val] of Object.entries(settings)) {
    if (val === null || val === '') {
      delete user.settings[key];
    } else {
      user.settings[key] = val;
    }
  }
  saveUsers(users);
  return user.settings;
}

function getEffectiveConfig(username) {
  const cfg = getConfig();
  const user = findUser(username);
  if (!user || !user.settings || Object.keys(user.settings).length === 0) {
    return cfg;
  }
  // Merge user settings over global config
  return { ...cfg, ...user.settings };
}

module.exports = {
  getUsers, saveUsers, findUser, createUser, updateUser, deleteUser, resetAllBalances,
  getConfig, updateConfig, getDifficultyConfig,
  getJackpot, setJackpot,
  getSpins, addSpin,
  getUserSettings, updateUserSettings, getEffectiveConfig,
};

// ===== SESSIONS =====
const SESSIONS_FILE = 'sessions.json';

function getUserSessions(username) {
  const all = read(SESSIONS_FILE) || [];
  return all.filter(s => s.username === username);
}

function addUserSession(username, token, device) {
  const all = read(SESSIONS_FILE) || [];
  all.push({
    username,
    token,
    device: device || 'unknown',
    createdAt: new Date().toISOString()
  });
  write(SESSIONS_FILE, all);
}

function removeUserSession(username, token) {
  const all = read(SESSIONS_FILE) || [];
  const filtered = all.filter(s => !(s.username === username && s.token === token));
  write(SESSIONS_FILE, filtered);
}

function removeAllUserSessions(username) {
  const all = read(SESSIONS_FILE) || [];
  const filtered = all.filter(s => s.username !== username);
  write(SESSIONS_FILE, filtered);
}

// ===== PROFILE SETTINGS =====
function updateUserTheme(username, theme) {
  return updateUserSettings(username, { theme });
}

function updateUserLanguage(username, lang) {
  return updateUserSettings(username, { language: lang });
}

function updateUserNotifications(username, notif) {
  const user = findUser(username);
  if (!user) return null;
  if (!user.settings) user.settings = {};
  if (!user.settings.notifications) user.settings.notifications = {};
  Object.assign(user.settings.notifications, notif);
  return updateUser(username, { settings: user.settings });
}

// ===== RESET STATS =====
function resetUserStats(username) {
  const user = findUser(username);
  if (!user) return null;
  return updateUser(username, {
    totalSpins: 0,
    totalWins: 0,
    totalBet: 0,
    totalPayout: 0,
  });
}

// ===== GET FULL PROFILE =====
function getFullProfile(username) {
  const user = findUser(username);
  if (!user) return null;
  const spins = getSpins(user.id, 1000);
  const wins = spins.filter(s => s.payout > 0);
  const totalSpins = user.totalSpins || 0;
  const totalWins = user.totalWins || 0;
  const losses = totalSpins - totalWins;
  const winRate = totalSpins > 0 ? ((totalWins / totalSpins) * 100).toFixed(1) : '0.0';
  const totalBet = user.totalBet || 0;
  const totalPayout = user.totalPayout || 0;

  return {
    id: user.id,
    username: user.username,
    balance: user.balance,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    totalSpins,
    totalWins,
    losses: Math.max(0, losses),
    totalBet,
    totalPayout,
    winRate: parseFloat(winRate),
    settings: user.settings || {},
    sessions: getUserSessions(user.username).length,
  };
}

module.exports = {
  getUsers, saveUsers, findUser, createUser, updateUser, deleteUser, resetAllBalances,
  getConfig, updateConfig, getDifficultyConfig,
  getJackpot, setJackpot,
  getSpins, addSpin,
  getUserSettings, updateUserSettings, getEffectiveConfig,
  getUserSessions, addUserSession, removeUserSession, removeAllUserSessions,
  updateUserTheme, updateUserLanguage, updateUserNotifications,
  resetUserStats, getFullProfile,
};
