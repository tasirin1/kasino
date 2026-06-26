const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');
const game = require('../services/game');
const gamesService = require('../services/games');
const ws = require('../services/ws');

const router = Router();

// Get game config (global)
router.get('/config', (req, res) => {
  res.json(storage.getConfig());
});

// Get jackpot
router.get('/jackpot', (req, res) => {
  res.json(storage.getJackpot());
});

// SPIN (authenticated) — supports multi-game
router.post('/spin', authenticate, async (req, res) => {
  const { bet, gameId, pick, risk } = req.body;
  const username = req.user.username;
  const user = storage.findUser(username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Use per-game effective config
  const effectiveGameId = gameId || 'classic777';
  const config = gamesService.getEffectiveGameConfig(effectiveGameId, username);
  if (!config) return res.status(400).json({ error: 'Game not found' });

  const betAmount = parseInt(bet) || config.minBet || 100;

  if (betAmount < (config.minBet || 10) || betAmount > (config.maxBet || 10000)) {
    return res.status(400).json({ error: `Bet must be between ${config.minBet || 10} and ${config.maxBet || 10000}` });
  }
  if (user.balance < betAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Deduct bet
  user.balance -= betAmount;
  user.totalSpins++;
  user.totalBet += betAmount;

  const winRate = config.winRate || 0.15;
  const roll = Math.random();
  const isWin = roll < winRate;
  const payoutMult = config.payoutMultiplier || 2;

  let payout = 0;
  let result = {};

  if (effectiveGameId === 'coinflip') {
    // Coin Flip logic
    const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
    const playerPick = pick || 'heads';
    const won = isWin && playerPick === coinResult;
    if (won) {
      payout = Math.floor(betAmount * payoutMult);
      user.balance += payout;
      user.totalWins++;
      user.totalPayout += payout;
    }
    result = { coinResult, playerPick };
  } else if (effectiveGameId === 'plinko') {
    // Plinko logic
    const riskMult = { low: 1.5, medium: 3, high: 6 };
    const mult = (riskMult[risk] || riskMult.medium) * (isWin ? 1 : 0);
    const slotIndex = Math.floor(Math.random() * 7);
    if (isWin && mult > 0) {
      payout = Math.floor(betAmount * mult);
      user.balance += payout;
      user.totalWins++;
      user.totalPayout += payout;
    }
    result = { multiplier: mult, slotIndex };
  } else {
    // Slot games (classic777, luckyfruits, etc.)
    const { generateResult, totalWin } = game;
    const { grid, wins } = generateResult(isWin, betAmount);
    const total = totalWin(wins);
    if (total > 0) {
      payout = Math.floor(total * payoutMult);
      user.balance += payout;
      user.totalWins++;
      user.totalPayout += payout;
    }
    result = { grid, wins };
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
    gameId: effectiveGameId,
    timestamp: new Date().toISOString(),
    ...(result.grid ? { grid: result.grid } : {}),
  });

  res.json({
    gameId: effectiveGameId,
    win: payout > 0,
    payout,
    bet: betAmount,
    balance: user.balance,
    roll,
    winRate,
    ...result,
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
