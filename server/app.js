const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const gamesRoutes = require('./routes/games');
const profileRoutes = require('./routes/profile');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
  res.sendFile(path.join(__dirname, '../client/game.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/profile.html'));
});

// Static files
app.use(express.static(path.join(__dirname, '../client'), { index: false }));
app.use('/games', express.static(path.join(__dirname, '../client/games'), { index: false }));
app.use('/assets', express.static(path.join(__dirname, '../client/assets'), { index: false }));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// SPA fallback — hanya untuk route aplikasi, bukan file statis
app.get(['/', '/play', '/play/*', '/lobby', '/game', '/admin', '/login', '/register', '/profile', '/wallet'], (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 404 untuk asset yang tidak ditemukan
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else if (req.path.match(/\.(css|js|svg|png|jpg|ico|json|html)$/)) {
    res.status(404).send('Not found');
  } else {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  }
});

module.exports = app;
