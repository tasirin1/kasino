const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const storage = require('./storage');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_USER = process.env.ADMIN_USERNAME || 'tasirin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '255280';
const TOKEN_EXPIRY = '24h';

// Generate nonce for session fixation prevention
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.isAdmin, nonce: generateNonce() },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function register(username, password, startingMoneyOverride) {
  if (!username || !password) return { error: 'Username and password required' };
  const name = username.trim().toLowerCase();
  if (name.length < 3) return { error: 'Username must be at least 3 characters' };
  if (!/^[a-z0-9_]+$/.test(name)) return { error: 'Username hanya boleh huruf, angka, dan underscore' };
  if (password.length < 8) return { error: 'Password minimal 8 karakter' };
  if (!/[A-Z]/.test(password)) return { error: 'Password harus mengandung huruf besar' };
  if (!/[a-z]/.test(password)) return { error: 'Password harus mengandung huruf kecil' };
  if (!/[0-9]/.test(password)) return { error: 'Password harus mengandung angka' };

  const existing = storage.findUser(name);
  if (existing) return { error: 'Username already exists' };

  const isAdmin = name === ADMIN_USER.toLowerCase();
  const hashed = await bcrypt.hash(password, 10);
  const config = storage.getConfig();
  let startingMoney = Math.max(0, Math.min(999999999, parseInt(config.startingMoney) || 10000));
  if (startingMoneyOverride !== undefined) startingMoney = Math.max(0, Math.min(999999999, parseInt(startingMoneyOverride) || 0));
  const user = storage.createUser(name, hashed, isAdmin ? 999999999 : startingMoney);

  if (isAdmin) {
    storage.updateUser(name, { isAdmin: true });
  }

  const token = generateToken(user);
  return { token, user: { id: user.id, username: user.username, balance: user.balance, isAdmin: user.isAdmin } };
}

async function login(username, password) {
  if (!username || !password) return { error: 'Username and password required' };
  const name = username.trim().toLowerCase();

  let user = storage.findUser(name);

  // Auto-create admin if not exists
  if (!user && name === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
    const hashed = await bcrypt.hash(password, 10);
    user = storage.createUser(name, hashed, 999999999);
    storage.updateUser(name, { isAdmin: true });
    user = storage.findUser(name);
    console.log('[Auth] Admin user auto-created');
  }

  if (!user) return { error: 'Invalid username or password' };

  // Allow admin bypass (for the configured admin account)
  if (name === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
    if (!user.isAdmin) {
      storage.updateUser(name, { isAdmin: true });
      user = storage.findUser(name);
    }
    const token = generateToken(user);
    return { token, user: { id: user.id, username: user.username, balance: user.balance, isAdmin: user.isAdmin } };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return { error: 'Invalid username or password' };

  const token = generateToken(user);
  return { token, user: { id: user.id, username: user.username, balance: user.balance, isAdmin: user.isAdmin } };
}

module.exports = { generateToken, verifyToken, generateNonce, register, login, ADMIN_USER, ADMIN_PASS };
