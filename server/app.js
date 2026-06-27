const express = require('express');
const path = require('path');
const helmet = require('helmet');

// Load .env if exists
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const gamesRoutes = require('./routes/games');
const profileRoutes = require('./routes/profile');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — only allow our own origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || origin.includes(host) || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.') || origin.includes('10.')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Body parsing (limited to prevent DOS)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// API routes
app.use('/api', authRoutes);
app.use('/api', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', gamesRoutes);
app.use('/api/profile', profileRoutes);

// Route-specific pages (must be before static to avoid index.html hijack)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/lobby.html'));
});
app.get('/play/:gameId', (req, res) => {
  // Validate gameId to prevent path traversal
  const gameId = req.params.gameId;
  if (!/^[a-z0-9-]+$/.test(gameId)) {
    return res.status(400).send('Invalid game ID');
  }
  res.sendFile(path.join(__dirname, '../client/game.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/profile.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// Static files — path traversal protection
app.use('/js', (req, res, next) => {
  if (req.path.includes('..') || req.path.includes('~') || req.path.includes('/etc/') || req.path.includes('/root/')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
app.use(express.static(path.join(__dirname, '../client'), { index: false }));
app.use('/games', express.static(path.join(__dirname, '../client/games'), { index: false }));
app.use('/assets', express.static(path.join(__dirname, '../client/assets'), { index: false }));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// SPA fallback — hanya untuk route aplikasi, bukan file statis
app.get(['/', '/play', '/play/*', '/lobby', '/game', '/admin', '/login', '/register', '/profile', '/wallet'], (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else if (req.path.match(/\.(css|js|svg|png|jpg|ico|json|html)$/)) {
    res.status(404).send('Not found');
  } else {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  }
});

// Global error handler — NEVER expose stack traces
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
