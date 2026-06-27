const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { spinRateLimit } = require('../middleware/rateLimit');
const storage = require('../services/storage');
const game = require('../services/game');
const gamesService = require('../services/games');
const ws = require('../services/ws');
const logger = require('../services/logger');

const router = Router();

// Get game config (global)
router.get('/config', (req, res) => {
  res.json(storage.getConfig());
});

// Get jackpot
router.get('/jackpot', (req, res) => {
  res.json(storage.getJackpot());
});

// SPIN — ONE ENGINE TO RULE THEM ALL
router.post('/spin', authenticate, spinRateLimit, async (req, res) => {
  const { bet, gameId, pick, risk } = req.body;
  const username = req.user.username;
  const user = storage.findUser(username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Validate gameId
  const effectiveGameId = gameId || 'classic777';
  if (typeof effectiveGameId !== 'string' || effectiveGameId.length > 50) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  // FRESH config every spin — no caching
  const config = gamesService.getEffectiveGameConfig(effectiveGameId, username);
  if (!config) return res.status(400).json({ error: 'Game not found' });

  // Validate bet
  let betAmount = parseInt(bet);
  if (isNaN(betAmount) || betAmount <= 0) betAmount = config.minBet ?? 100;
  const minBet = Math.max(1, config.minBet ?? 10);
  const maxBet = Math.min(100000000, config.maxBet ?? 10000);

  if (betAmount < minBet || betAmount > maxBet) {
    return res.status(400).json({ error: `Bet must be between ${minBet} and ${maxBet}` });
  }

  if (!user.balance || user.balance < betAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Deduct bet FIRST — balance is source of truth on server only
  user.balance = Math.max(0, user.balance - betAmount);
  user.totalSpins = (user.totalSpins || 0) + 1;
  user.totalBet = (user.totalBet || 0) + betAmount;

  // RNG — strictly controlled by win rate from server config
  const winRate = parseFloat(config.winRate);
  const safeWinRate = isNaN(winRate) ? 0.15 : Math.max(0, Math.min(1, winRate));
  const payoutMult = parseFloat(config.payoutMultiplier) || 1;
  const safePayoutMult = isNaN(payoutMult) || payoutMult <= 0 ? 1 : Math.min(payoutMult, 100);

  const roll = Math.random();
  const isWin = roll < safeWinRate;

  let payout = 0;
  let result = {};

  if (effectiveGameId === 'coinflip') {
    // Coin Flip — 50/50 chance WITHIN the win
    const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
    const playerPick = pick || 'heads';
    const won = isWin && playerPick === coinResult;
    
    if (won) {
      // Same unified payout engine
      payout = game.calculatePayout(betAmount, safeWinRate, safePayoutMult);
    }
    result = { coinResult, playerPick };
    
  } else if (effectiveGameId === 'plinko') {
    // Plinko — risk multiplier WITHIN the win
    const riskMult = { low: 1.5, medium: 3, high: 6 };
    const riskLevel = riskMult[risk] || riskMult.medium;
    const basePayout = game.calculatePayout(betAmount, safeWinRate, safePayoutMult);
    
    if (isWin) {
      payout = Math.floor(basePayout * riskLevel);
    }
    result = { 
      multiplier: isWin ? riskLevel : 0, 
      slotIndex: Math.floor(Math.random() * 7) 
    };
    
  } else {
    // ALL SLOT GAMES (classic777, luckyfruits, etc.)
    const { payout: calculatedPayout, grid, wins } = game.generateResult(isWin, betAmount, safeWinRate, safePayoutMult);
    payout = calculatedPayout;
    result = { grid, wins };
  }

  // Apply payout
  if (payout > 0) {
    user.balance += payout;
    user.totalWins = (user.totalWins || 0) + 1;
    user.totalPayout = (user.totalPayout || 0) + payout;
  }

  // Clamp balance
  user.balance = Math.min(user.balance, 999999999);

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
    balanceAfter: user.balance,
    winRate: safeWinRate,
    roll: roll,
    timestamp: new Date().toISOString(),
    ...(result.grid ? { grid: result.grid } : {}),
  });

  // Log high-value wins
  logger.spin(username, betAmount, payout > 0, payout, effectiveGameId);

  res.json({
    gameId: effectiveGameId,
    win: payout > 0,
    payout,
    bet: betAmount,
    balance: user.balance,
    winRate: safeWinRate,
    roll: roll,
    threshold: (safeWinRate * 100).toFixed(1) + '%',
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
