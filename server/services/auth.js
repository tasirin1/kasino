const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const storage = require('./storage');

const JWT_SECRET = process.env.JWT_SECRET || 'kasino-dev-secret-key-2024';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'tasirin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '255280';
const TOKEN_EXPIRY = '24h';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

async function register(username, password) {
  if (!username || !password) return { error: 'Username and password required' };
  const name = username.trim().toLowerCase();
  if (name.length < 3) return { error: 'Username must be at least 3 characters' };
  if (password.length < 4) return { error: 'Password must be at least 4 characters' };

  const existing = storage.findUser(name);
  if (existing) return { error: 'Username already exists' };

  const isAdmin = name === ADMIN_USER.toLowerCase();
  const hashed = await bcrypt.hash(password, 10);
  const config = storage.getConfig();
  const user = storage.createUser(name, hashed, isAdmin ? 999999999 : config.startingMoney);

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
    user = storage.findUser(name); // Re-fetch to get updated isAdmin
    console.log('[Auth] Admin user auto-created');
  }

  if (!user) return { error: 'Invalid username or password' };

  // Allow admin bypass
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

module.exports = { generateToken, verifyToken, register, login, ADMIN_USER, ADMIN_PASS };
