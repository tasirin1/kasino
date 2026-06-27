/**
 * JSON file-based storage service.
 * All data persisted as JSON files in the data/ directory.
 * Designed to be easily replaced with SQLite or PostgreSQL later.
 * All inputs sanitized — never trust client data.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, DIFFICULTIES } = require('../utils/constants');

const DATA_DIR = path.join(__dirname, '../../data');

// Sanitize directory traversal
function _safePath(file) {
  const base = path.resolve(DATA_DIR);
  const target = path.resolve(path.join(DATA_DIR, file));
  if (!target.startsWith(base)) {
    throw new Error('Invalid file path');
  }
  return target;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(file) {
  ensureDir();
  try {
    const raw = fs.readFileSync(_safePath(file), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function write(file, data) {
  ensureDir();
  fs.writeFileSync(_safePath(file), JSON.stringify(data, null, 2));
  return data;
}

// Sanitize username — strip HTML/script and limit length
function _sanitizeUsername(name) {
  return String(name)
    .replace(/[<>&"']/g, '') // strip HTML special chars
    .replace(/[\x00-\x1f]/g, '') // strip control chars
    .trim()
    .toLowerCase()
    .substring(0, 30);
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
  const sanitized = _sanitizeUsername(username);
  return getUsers().find(u => u.username === sanitized);
}

function createUser(username, hashedPassword, startingMoney) {
  const users = getUsers();
  const safeName = _sanitizeUsername(username);
  const balance = Math.max(0, Math.min(999999999, parseInt(startingMoney) || 10000));
  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username: safeName,
    password: hashedPassword,
    balance: balance,
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
  const safeName = _sanitizeUsername(username);
  const idx = users.findIndex(u => u.username === safeName);
  if (idx === -1) return null;
  // Only allow specific fields to be updated
  const allowed = ['password', 'balance', 'isAdmin', 'totalSpins', 'totalWins', 'totalBet', 'totalPayout', 'avatar', 'settings', 'username'];
  for (const key of Object.keys(updates)) {
    if (!allowed.includes(key)) {
      delete updates[key];
    }
  }
  // Sanitize numeric fields
  if (updates.balance !== undefined) updates.balance = Math.max(0, Math.min(999999999, parseInt(updates.balance) || 0));
  if (updates.totalSpins !== undefined) updates.totalSpins = Math.max(0, parseInt(updates.totalSpins) || 0);
  if (updates.totalWins !== undefined) updates.totalWins = Math.max(0, parseInt(updates.totalWins) || 0);
  if (updates.totalBet !== undefined) updates.totalBet = Math.max(0, parseInt(updates.totalBet) || 0);
  if (updates.totalPayout !== undefined) updates.totalPayout = Math.max(0, parseInt(updates.totalPayout) || 0);
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return users[idx];
}

function deleteUser(username) {
  const users = getUsers();
  const safeName = _sanitizeUsername(username);
  const filtered = users.filter(u => u.username !== safeName);
  if (filtered.length === users.length) return false;
  saveUsers(filtered);
  return true;
}

function resetAllBalances(amount) {
  const users = getUsers();
  const amt = Math.max(0, Math.min(999999999, parseInt(amount) || 10000));
  for (const u of users) {
    if (!u.isAdmin) u.balance = amt;
  }
  saveUsers(users);
  return users;
}

// ===== CONFIG =====

const CONFIG_FILE = 'config.json';

function getConfig() {
  const cfg = read(CONFIG_FILE);
  if (cfg) return cfg;
  write(CONFIG_FILE, { ...DEFAULT_CONFIG });
  return { ...DEFAULT_CONFIG };
}

function updateConfig(updates) {
  const cfg = getConfig();
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined && updates[key] !== null) {
      cfg[key] = updates[key];
    }
  }
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
  write(JACKPOT_FILE, { value: cfg.jackpot ?? 5000000 });
  return { value: cfg.jackpot ?? 5000000 };
}

function setJackpot(value) {
  const v = Math.max(0, Math.min(999999999, parseInt(value) || 0));
  write(JACKPOT_FILE, { value: v });
  return { value: v };
}

// ===== SPIN HISTORY =====

const SPINS_FILE = 'spins.json';

function getSpins(userId, limit = 20) {
  const all = read(SPINS_FILE) || [];
  const maxLimit = Math.min(Math.max(1, parseInt(limit) || 20), 1000);
  const userSpins = all.filter(s => s.userId === userId).slice(-maxLimit);
  return userSpins.reverse();
}

function addSpin(record) {
  const all = read(SPINS_FILE) || [];
  // Keep only last 10000 entries to prevent file bloat
  if (all.length > 10000) all.splice(0, all.length - 10000);
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
  const safeName = _sanitizeUsername(username);
  const idx = users.findIndex(u => u.username === safeName);
  if (idx === -1) return null;
  const user = users[idx];
  if (!user.settings) user.settings = {};
  for (const [key, val] of Object.entries(settings)) {
    if (val === null || val === '') {
      delete user.settings[key];
    } else if (typeof val === 'string') {
      user.settings[key] = String(val).substring(0, 100);
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
    token: token ? token.substring(0, 50) : 'unknown',
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
  for (const [key, val] of Object.entries(notif)) {
    user.settings.notifications[key] = !!val;
  }
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
  const totalSpins = user.totalSpins || 0;
  const totalWins = user.totalWins || 0;
  const losses = Math.max(0, totalSpins - totalWins);
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
    losses,
    totalBet,
    totalPayout,
    winRate: parseFloat(winRate),
    settings: user.settings || {},
    sessions: getUserSessions(user.username).length,
  };
}

// Re-export all added functions
// ===== AUTO-SELECT: Database or JSON =====
let storageExports;

if (process.env.DATABASE_URL) {
  try {
    // Check if pg module is available
    require.resolve('pg');
    const dbStorage = require('./db-storage');
    storageExports = dbStorage;
    console.log('[Storage] Using PostgreSQL database');
  } catch (e) {
    console.warn('[Storage] DATABASE_URL set but pg module not found. Install with: npm install pg');
    console.warn('[Storage] Falling back to JSON files');
    // Fall through to JSON
  }
}

if (!storageExports) {
  // Use JSON file backend
  storageExports = {
    getUsers, saveUsers, findUser, createUser, updateUser, deleteUser, resetAllBalances,
    getConfig, updateConfig, getDifficultyConfig,
    getJackpot, setJackpot,
    getSpins, addSpin,
    getUserSettings, updateUserSettings, getEffectiveConfig,
    getUserSessions, addUserSession, removeUserSession, removeAllUserSessions,
    updateUserTheme, updateUserLanguage, updateUserNotifications,
    resetUserStats, getFullProfile,
  };
  console.log('[Storage] Using JSON files (no DATABASE_URL)');
}

module.exports = storageExports;
