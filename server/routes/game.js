const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');
const game = require('../services/game');
const ws = require('../services/ws');

const router = Router();

// Get game config
router.get('/config', (req, res) => {
  res.json(storage.getConfig());
});

// Get jackpot
router.get('/jackpot', (req, res) => {
  res.json(storage.getJackpot());
});

// SPIN (authenticated)
router.post('/spin', authenticate, async (req, res) => {
  const { bet } = req.body;
  const username = req.user.username;
  const user = storage.findUser(username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const config = storage.getEffectiveConfig(username);
  const betAmount = parseInt(bet) || config.betAmount;

  if (betAmount < config.minBet || betAmount > config.maxBet) {
    return res.status(400).json({ error: `Bet must be between ${config.minBet} and ${config.maxBet}` });
  }
  if (user.balance < betAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Deduct bet
  user.balance -= betAmount;
  user.totalSpins++;
  user.totalBet += betAmount;

  // RNG: determine win/loss based on config winRate
  const winRate = config.winRate;
  const roll = Math.random();
  const isWin = roll < winRate;

  const { grid, wins } = game.generateResult(isWin, betAmount);
  const total = game.totalWin(wins);

  // Apply payout multiplier
  const payoutMult = config.payoutMultiplier;
  let payout = 0;
  if (total > 0) {
    payout = Math.floor(total * payoutMult);
    user.balance += payout;
    user.totalWins++;
    user.totalPayout += payout;
  }

  storage.updateUser(username, {
    balance: user.balance,
    totalSpins: user.totalSpins,
    totalWins: user.totalWins,
    totalBet: user.totalBet,
    totalPayout: user.totalPayout,
  });

  // Save spin history
  storage.addSpin({
    userId: user.id,
    username,
    bet: betAmount,
    payout,
    grid,
    timestamp: new Date().toISOString(),
  });

  res.json({
    grid,
    win: total > 0,
    payout,
    bet: betAmount,
    balance: user.balance,
    wins,
    roll,
    winRate,
  });
});

// Get spin history
router.get('/history', authenticate, (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(storage.getSpins(user.id, 20));
});

// Get user data
router.get('/user', authenticate, (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const settings = user.settings || {};
  res.json({
    id: user.id,
    username: user.username,
    balance: user.balance,
    isAdmin: user.isAdmin,
    totalSpins: user.totalSpins,
    totalWins: user.totalWins,
    totalBet: user.totalBet,
    totalPayout: user.totalPayout,
    settings,
  });
});

module.exports = router;
