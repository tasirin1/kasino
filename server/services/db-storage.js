/**
 * PostgreSQL-backed storage service using node-postgres.
 * Same API as storage.js — drop-in replacement.
 * Activated automatically when DATABASE_URL is set.
 */

// pg loaded lazily in getPool()

let pool;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function toNum(v) { return Number(v) || 0; }
function bigint(v) { return BigInt(Math.round(Number(v) || 0)); }

// ===== MIGRATION =====
async function migrate() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      balance BIGINT DEFAULT 10000,
      "isAdmin" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "totalSpins" INT DEFAULT 0,
      "totalWins" INT DEFAULT 0,
      "totalBet" BIGINT DEFAULT 0,
      "totalPayout" BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT DEFAULT 'dark',
      language TEXT DEFAULT 'id',
      notifications BOOLEAN DEFAULT true,
      "winRate" REAL, "payoutMultiplier" REAL,
      "minBet" BIGINT, "maxBet" BIGINT, "jackpotHitRate" REAL
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL, device TEXT DEFAULT '',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS spins (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL, bet BIGINT NOT NULL,
      payout BIGINT DEFAULT 0, "gameId" TEXT DEFAULT 'classic777',
      grid JSONB, timestamp TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS config (
      id TEXT PRIMARY KEY DEFAULT 'global',
      difficulty TEXT DEFAULT 'medium',
      "winRate" REAL DEFAULT 0.15, "payoutMultiplier" REAL DEFAULT 3.0,
      "minSpinsBeforeWin" INT DEFAULT 10,
      "jackpotHitRate" REAL DEFAULT 0.005,
      jackpot BIGINT DEFAULT 5000000, "startingMoney" BIGINT DEFAULT 10000,
      "minBet" BIGINT DEFAULT 10, "maxBet" BIGINT DEFAULT 10000,
      "betAmount" BIGINT DEFAULT 100
    );
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      category TEXT DEFAULT 'slot', description TEXT DEFAULT '',
      provider TEXT DEFAULT 'SlotCasino', rtp REAL DEFAULT 97.0,
      thumbnail TEXT DEFAULT '', badge TEXT DEFAULT '',
      enabled BOOLEAN DEFAULT true, "sortOrder" INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS game_configs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "gameId" TEXT UNIQUE REFERENCES games(id) ON DELETE CASCADE,
      "winRate" REAL DEFAULT 0.25, "payoutMultiplier" REAL DEFAULT 3.0,
      "minBet" BIGINT DEFAULT 10, "maxBet" BIGINT DEFAULT 10000,
      "jackpotHitRate" REAL DEFAULT 0.005,
      "maxWin" BIGINT DEFAULT 1000000, "maxMultiplier" REAL DEFAULT 500,
      "riskLevels" JSONB, "defaultRisk" TEXT DEFAULT 'medium'
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      action TEXT NOT NULL, username TEXT NOT NULL,
      detail TEXT DEFAULT '', ip TEXT DEFAULT '',
      timestamp TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO config (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
  `);
}

// ===== USERS =====
async function getUsers() {
  const {rows} = await getPool().query(
    'SELECT u.*, us.theme, us.language, us.notifications, us."winRate" as s_winRate, ' +
    'us."payoutMultiplier" as s_payoutMult, us."minBet" as s_minBet, us."maxBet" as s_maxBet, ' +
    'us."jackpotHitRate" as s_jackpotRate FROM users u LEFT JOIN user_settings us ON us."userId"=u.id'
  );
  return rows.map(r => ({
    id: r.id, username: r.username, password: r.password,
    balance: toNum(r.balance), isAdmin: r.isAdmin,
    createdAt: r.createdAt, totalSpins: r.totalSpins || 0,
    totalWins: r.totalWins || 0, totalBet: toNum(r.totalBet),
    totalPayout: toNum(r.totalPayout),
    settings: {
      theme: r.theme || 'dark', language: r.language || 'id',
      notifications: r.notifications !== false,
      winRate: r.s_winRate, payoutMultiplier: r.s_payoutMult,
      minBet: r.s_minBet ? toNum(r.s_minBet) : undefined,
      maxBet: r.s_maxBet ? toNum(r.s_maxBet) : undefined,
      jackpotHitRate: r.s_jackpotRate,
    },
  }));
}

async function findUser(username) {
  const {rows} = await getPool().query(
    'SELECT u.*, us.theme, us.language, us.notifications, us."winRate" as s_winRate, ' +
    'us."payoutMultiplier" as s_payoutMult, us."minBet" as s_minBet, us."maxBet" as s_maxBet, ' +
    'us."jackpotHitRate" as s_jackpotRate FROM users u LEFT JOIN user_settings us ON us."userId"=u.id WHERE u.username=$1',
    [username.toLowerCase().trim()]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id, username: r.username, password: r.password,
    balance: toNum(r.balance), isAdmin: r.isAdmin,
    createdAt: r.createdAt, totalSpins: r.totalSpins || 0,
    totalWins: r.totalWins || 0, totalBet: toNum(r.totalBet),
    totalPayout: toNum(r.totalPayout),
    settings: {
      theme: r.theme || 'dark', language: r.language || 'id',
      notifications: r.notifications !== false,
      winRate: r.s_winRate, payoutMultiplier: r.s_payoutMult,
      minBet: r.s_minBet ? toNum(r.s_minBet) : undefined,
      maxBet: r.s_maxBet ? toNum(r.s_maxBet) : undefined,
      jackpotHitRate: r.s_jackpotRate,
    },
  };
}

async function createUser(username, hashedPassword, startingMoney) {
  const {rows} = await getPool().query(
    'INSERT INTO users (username, password, balance) VALUES ($1,$2,$3) RETURNING id, username, balance',
    [username.toLowerCase().trim(), hashedPassword, bigint(startingMoney || 10000)]
  );
  return { id: rows[0].id, username: rows[0].username, balance: toNum(rows[0].balance) };
}

async function updateUser(username, updates) {
  const sets = []; const vals = []; let i = 1;
  if (updates.balance !== undefined) { sets.push(`balance=$${i++}`); vals.push(bigint(updates.balance)); }
  if (updates.password !== undefined) { sets.push(`password=$${i++}`); vals.push(updates.password); }
  if (updates.totalSpins !== undefined) { sets.push(`"totalSpins"=$${i++}`); vals.push(updates.totalSpins); }
  if (updates.totalWins !== undefined) { sets.push(`"totalWins"=$${i++}`); vals.push(updates.totalWins); }
  if (updates.totalBet !== undefined) { sets.push(`"totalBet"=$${i++}`); vals.push(bigint(updates.totalBet)); }
  if (updates.totalPayout !== undefined) { sets.push(`"totalPayout"=$${i++}`); vals.push(bigint(updates.totalPayout)); }
  if (!sets.length) return { error: 'No fields to update' };
  vals.push(username);
  await getPool().query(`UPDATE users SET ${sets.join(',')} WHERE username=$${i}`, vals);
  return { success: true };
}

async function deleteUser(username) {
  const user = await findUser(username);
  if (!user) return { error: 'User not found' };
  if (user.isAdmin) return { error: 'Cannot delete admin' };
  await getPool().query('DELETE FROM users WHERE username=$1', [username]);
  return { success: true };
}

async function resetAllBalances(amount) {
  const {rowCount} = await getPool().query(
    'UPDATE users SET balance=$1 WHERE "isAdmin"=false', [bigint(amount || 10000)]
  );
  return { success: true, count: rowCount };
}

// ===== CONFIG =====
async function getConfig() {
  const {rows} = await getPool().query('SELECT * FROM config WHERE id=$1', ['global']);
  if (!rows.length) {
    await getPool().query('INSERT INTO config (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', ['global']);
    return { difficulty:'medium', winRate:0.15, payoutMultiplier:3, minSpinsBeforeWin:10,
      jackpotHitRate:0.005, jackpot:5000000, startingMoney:10000, minBet:10, maxBet:10000, betAmount:100 };
  }
  const c = rows[0];
  return {
    difficulty: c.difficulty, winRate: c.winRate,
    payoutMultiplier: c.payoutMultiplier, minSpinsBeforeWin: c.minSpinsBeforeWin,
    jackpotHitRate: c.jackpotHitRate, jackpot: toNum(c.jackpot),
    startingMoney: toNum(c.startingMoney), minBet: toNum(c.minBet),
    maxBet: toNum(c.maxBet), betAmount: toNum(c.betAmount),
  };
}

async function updateConfig(updates) {
  const sets = []; const vals = []; let i = 1;
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined || val === null) continue;
    switch (key) {
      case 'difficulty': sets.push(`difficulty=$${i++}`); vals.push(String(val)); break;
      case 'winRate': sets.push(`"winRate"=$${i++}`); vals.push(parseFloat(val)); break;
      case 'payoutMultiplier': sets.push(`"payoutMultiplier"=$${i++}`); vals.push(parseFloat(val)); break;
      case 'minSpinsBeforeWin': sets.push(`"minSpinsBeforeWin"=$${i++}`); vals.push(parseInt(val) || 0); break;
      case 'jackpotHitRate': sets.push(`"jackpotHitRate"=$${i++}`); vals.push(parseFloat(val)); break;
      case 'jackpot': sets.push(`jackpot=$${i++}`); vals.push(bigint(val)); break;
      case 'startingMoney': sets.push(`"startingMoney"=$${i++}`); vals.push(bigint(val)); break;
      case 'minBet': sets.push(`"minBet"=$${i++}`); vals.push(bigint(val)); break;
      case 'maxBet': sets.push(`"maxBet"=$${i++}`); vals.push(bigint(val)); break;
      case 'betAmount': sets.push(`"betAmount"=$${i++}`); vals.push(bigint(val)); break;
    }
  }
  if (sets.length) {
    await getPool().query(`UPDATE config SET ${sets.join(',')} WHERE id='global'`, vals);
  }
  return getConfig();
}

async function getDifficultyConfig(difficultyKey) {
  const { DIFFICULTIES } = require('../utils/constants');
  const diff = DIFFICULTIES[difficultyKey];
  if (diff) return diff;
  const cfg = await getConfig();
  return { winRate: cfg.winRate, payoutMult: cfg.payoutMultiplier,
    minSpinsBeforeWin: cfg.minSpinsBeforeWin, jackpotHitRate: cfg.jackpotHitRate };
}

// ===== JACKPOT =====
async function getJackpot() {
  const cfg = await getConfig();
  return { value: cfg.jackpot };
}

async function setJackpot(value) {
  const v = Math.max(0, Math.min(999999999, parseInt(value) || 0));
  await getPool().query('UPDATE config SET jackpot=$1 WHERE id=$2', [bigint(v), 'global']);
  return { value: v };
}

// ===== SPINS =====
async function getSpins(userId, limit = 20) {
  const {rows} = await getPool().query(
    'SELECT * FROM spins WHERE "userId"=$1 ORDER BY timestamp DESC LIMIT $2', [userId, limit]
  );
  return rows.map(r => ({
    userId: r.userId, username: r.username, bet: toNum(r.bet),
    payout: toNum(r.payout), gameId: r.gameId, timestamp: r.timestamp, grid: r.grid,
  }));
}

async function addSpin(record) {
  await getPool().query(
    'INSERT INTO spins ("userId", username, bet, payout, "gameId", grid) VALUES ($1,$2,$3,$4,$5,$6)',
    [record.userId, record.username, bigint(record.bet), bigint(record.payout || 0),
     record.gameId || 'classic777', record.grid ? JSON.stringify(record.grid) : null]
  );
}

// ===== USER SETTINGS =====
async function getUserSettings(username) {
  const {rows} = await getPool().query(
    'SELECT us.* FROM user_settings us JOIN users u ON u.id=us."userId" WHERE u.username=$1', [username]
  );
  if (!rows.length) return {};
  const r = rows[0];
  return {
    theme: r.theme, language: r.language, notifications: r.notifications,
    winRate: r.winRate, payoutMultiplier: r.payoutMultiplier,
    minBet: r.minBet ? toNum(r.minBet) : undefined,
    maxBet: r.maxBet ? toNum(r.maxBet) : undefined,
    jackpotHitRate: r.jackpotHitRate,
  };
}

async function updateUserSettings(username, settings) {
  const user = await findUser(username);
  if (!user) return { error: 'User not found' };
  const sets = []; const vals = []; let i = 1;
  if (settings.winRate !== undefined) { sets.push(`"winRate"=$${i++}`); vals.push(settings.winRate); }
  if (settings.payoutMultiplier !== undefined) { sets.push(`"payoutMultiplier"=$${i++}`); vals.push(settings.payoutMultiplier); }
  if (settings.minBet !== undefined) { sets.push(`"minBet"=$${i++}`); vals.push(bigint(settings.minBet)); }
  if (settings.maxBet !== undefined) { sets.push(`"maxBet"=$${i++}`); vals.push(bigint(settings.maxBet)); }
  if (settings.jackpotHitRate !== undefined) { sets.push(`"jackpotHitRate"=$${i++}`); vals.push(settings.jackpotHitRate); }
  if (settings.theme !== undefined) { sets.push(`theme=$${i++}`); vals.push(settings.theme); }
  if (settings.language !== undefined) { sets.push(`language=$${i++}`); vals.push(settings.language); }
  if (settings.notifications !== undefined) { sets.push(`notifications=$${i++}`); vals.push(settings.notifications); }
  if (!sets.length) return { success: true };
  vals.push(user.id);
  const q = `INSERT INTO user_settings ("userId", ${sets.join(',')}) VALUES ($${i}, ${sets.join(',')})
    ON CONFLICT ("userId") DO UPDATE SET ${sets.map((s,idx) => s.replace('=$'+(idx+1), '=EXCLUDED.'+s.split('=')[0])).join(',')}`;
  await getPool().query(q, vals);
  return { success: true };
}

async function getEffectiveConfig(username) {
  const cfg = await getConfig();
  if (!username) return cfg;
  const us = await getUserSettings(username);
  return {
    ...cfg,
    winRate: us.winRate ?? cfg.winRate,
    payoutMultiplier: us.payoutMultiplier ?? cfg.payoutMultiplier,
    minBet: us.minBet ?? cfg.minBet,
    maxBet: us.maxBet ?? cfg.maxBet,
    jackpotHitRate: us.jackpotHitRate ?? cfg.jackpotHitRate,
  };
}

// ===== SESSIONS =====
async function getUserSessions(username) {
  const {rows} = await getPool().query(
    'SELECT s.* FROM user_sessions s JOIN users u ON u.id=s."userId" WHERE u.username=$1', [username]
  );
  return rows;
}

async function addUserSession(username, token, device) {
  const user = await findUser(username);
  if (!user) return;
  await getPool().query(
    'INSERT INTO user_sessions ("userId", token, device) VALUES ($1,$2,$3)', [user.id, token, device || '']
  );
}

async function removeUserSession(username, token) {
  const user = await findUser(username);
  if (!user) return;
  await getPool().query('DELETE FROM user_sessions WHERE "userId"=$1 AND token=$2', [user.id, token]);
}

async function removeAllUserSessions(username) {
  const user = await findUser(username);
  if (!user) return;
  await getPool().query('DELETE FROM user_sessions WHERE "userId"=$1', [user.id]);
}

// ===== THEME / LANGUAGE / NOTIFICATIONS =====
async function updateUserTheme(username, theme) { return updateUserSettings(username, { theme }); }
async function updateUserLanguage(username, lang) { return updateUserSettings(username, { language: lang }); }
async function updateUserNotifications(username, notif) { return updateUserSettings(username, { notifications: notif }); }

// ===== STATS =====
async function resetUserStats(username) {
  const user = await findUser(username);
  if (!user) return { error: 'User not found' };
  await getPool().query(
    'UPDATE users SET "totalSpins"=0, "totalWins"=0, "totalBet"=0, "totalPayout"=0 WHERE username=$1', [username]
  );
  return { success: true };
}

async function getFullProfile(username) {
  const user = await findUser(username);
  if (!user) return null;
  const spins = await getSpins(user.id, 50);
  const settings = await getUserSettings(username);
  const sessions = await getUserSessions(username);
  return { ...user, password: undefined, settings, recentSpins: spins, sessions: sessions.length };
}

async function disconnect() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = {
  migrate, disconnect,
  getUsers, findUser, createUser, updateUser, deleteUser, resetAllBalances,
  getConfig, updateConfig, getDifficultyConfig,
  getJackpot, setJackpot,
  getSpins, addSpin,
  getUserSettings, updateUserSettings, getEffectiveConfig,
  getUserSessions, addUserSession, removeUserSession, removeAllUserSessions,
  updateUserTheme, updateUserLanguage, updateUserNotifications,
  resetUserStats, getFullProfile,
};
