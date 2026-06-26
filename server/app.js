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

// Static files
app.use(express.static(path.join(__dirname, '../client')));
app.use('/games', express.static(path.join(__dirname, '../client/games')));
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', authRoutes);
app.use('/api', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', gamesRoutes);

// Serve SPA fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/lobby.html'));
});
app.get('/play/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/game.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

module.exports = app;
