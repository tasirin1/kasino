const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const gamesRoutes = require('./routes/games');

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

// Route-specific pages (must be before static to avoid index.html hijack)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/lobby.html'));
});
app.get('/play/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/game.html'));
});

// Static files
app.use(express.static(path.join(__dirname, '../client'), { index: false }));
app.use('/games', express.static(path.join(__dirname, '../client/games'), { index: false }));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

module.exports = app;
