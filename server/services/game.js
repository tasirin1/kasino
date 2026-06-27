/**
 * Game Engine — Unified slot game logic
 * ALL games use this single engine.
 * 
 * PRINCIPLE:
 * - Win rate controls HOW OFTEN you win
 * - RTP (Return to Player) controls HOW MUCH you win when you do
 * - Every spin: SERVER decides win/loss via RNG + winRate
 * - If win: SERVER calculates payout via RTP formula
 * - Client ONLY animates the result
 * 
 * FORMULA:
 *   payout = betAmount * (RTP_TARGET / winRate) * variance * multiplier
 * 
 * Where:
 *   RTP_TARGET  = 0.90 (90% — standard house edge ~10%)
 *   variance    = random 0.5x - 1.5x for excitement
 *   multiplier  = payoutMultiplier from admin config
 * 
 * EXPECTED RTP:
 *   For any winRate, average RTP → ~90%
 *   winRate 50% → avg payout ~1.8x bet → RTP ≈ 90%
 *   winRate 15% → avg payout ~6.0x bet → RTP ≈ 90%  
 *   winRate 1%  → avg payout ~90x bet → RTP ≈ 90%
 *   winRate 0%  → never wins → RTP = 0% (correct)
 */

const { SYMBOLS, ALL_SYMBOL_IDS } = require('../utils/constants');
const { randomSymbol } = require('../utils/helpers');

// Target RTP (Return to Player) — house edge ~10%
// Adjusted by avg variance (1.0) so expected RTP = RTP_TARGET
const RTP_TARGET = 0.90;

/**
 * Unified payout calculation for ALL games.
 */
function calculatePayout(bet, winRate, mult) {
  if (!bet || bet <= 0) return 0;
  const rate = Math.max(0.001, winRate ?? 0.15);
  
  // Base: (RTP_TARGET / winRate) gives the avg multiplier when winning
  // e.g., 90% / 15% = 6x → you win 6x bet on average when you do win
  const baseMultiplier = (RTP_TARGET / rate) * (mult || 1);
  
  // Variance: 0.5x to 1.5x for excitement (avg 1.0x → no bias)
  const variance = 0.5 + Math.random();
  const finalMultiplier = baseMultiplier * variance;
  
  return Math.max(0, Math.floor(bet * finalMultiplier));
}

/**
 * Generate a spin result.
 * 
 * @param {boolean} isWin   - Whether the player wins (determined by RNG + winRate)
 * @param {number}  bet     - Bet amount
 * @param {number}  winRate - Win rate (0.0 - 1.0)
 * @param {number}  mult    - Payout multiplier (from admin config)
 * @returns {{ grid: string[][], wins: Array, payout: number }}
 */
function generateResult(isWin, bet, winRate, mult) {
  if (isWin) {
    return generateWin(bet, winRate, mult);
  }
  return generateLoss();
}

/**
 * Generate a winning grid with properly calculated payout.
 */
function generateWin(bet, winRate, mult) {
  const payout = calculatePayout(bet, winRate, mult);
  
  if (payout <= 0) {
    return generateLoss();
  }
  
  // Pick a random winning symbol
  const winSym = randomSymbol(SYMBOLS);
  
  // Pick random payline for the win
  const winLines = [
    [[0,0],[1,0],[2,0]],
    [[0,1],[1,1],[2,1]],
    [[0,2],[1,2],[2,2]],
    [[0,0],[1,1],[2,2]],
    [[0,2],[1,1],[2,0]],
  ];
  const winLineIdx = Math.floor(Math.random() * winLines.length);
  const winLine = winLines[winLineIdx];
  
  const grid = [[null,null,null],[null,null,null],[null,null,null]];
  for (const [r, c] of winLine) grid[r][c] = winSym;
  
  // Fill rest with non-matching symbols
  const otherSymbols = ALL_SYMBOL_IDS.filter(s => s !== winSym && s !== 'DIAMOND');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
      }
    }
  }
  
  const wins = [{
    payline: winLineIdx,
    symbol: winSym,
    count: 3,
    amount: payout,
    positions: winLine,
  }];
  
  return { grid, wins, payout };
}

/**
 * Generate a losing grid — NO matching symbols on any line.
 */
function generateLoss() {
  const rows = [
    ['BAR','CHERRY','LEMON'],
    ['ORANGE','PLUM','BELL'],
    ['SEVEN','GRAPES','WATERMELON'],
    ['2BAR','3BAR','CHERRY'],
    ['LEMON','ORANGE','PLUM'],
    ['BELL','GRAPES','BAR'],
    ['WATERMELON','SEVEN','2BAR'],
    ['3BAR','CHERRY','LEMON'],
    ['ORANGE','PLUM','BELL'],
  ];
  
  for (let attempt = 0; attempt < 10; attempt++) {
    const grid = Array(3).fill().map(() => Array(3).fill(''));
    for (let r = 0; r < 3; r++) {
      const rowIdx = Math.floor(Math.random() * rows.length);
      for (let c = 0; c < 3; c++) {
        grid[r][c] = rows[rowIdx][Math.floor(Math.random() * 3)];
      }
    }
    
    // Verify no winning combination
    let hasWin = false;
    for (let r = 0; r < 3; r++) {
      if (grid[r][0] === grid[r][1] && grid[r][1] === grid[r][2]) { hasWin = true; break; }
    }
    if (!hasWin) {
      for (let c = 0; c < 3; c++) {
        if (grid[0][c] === grid[1][c] && grid[1][c] === grid[2][c]) { hasWin = true; break; }
      }
    }
    if (!hasWin && grid[0][0] === grid[1][1] && grid[1][1] === grid[2][2]) hasWin = true;
    if (!hasWin && grid[0][2] === grid[1][1] && grid[1][1] === grid[2][0]) hasWin = true;
    
    if (!hasWin) {
      return { grid, wins: [], payout: 0 };
    }
  }
  
  return {
    grid: [['BAR','CHERRY','LEMON'],['ORANGE','PLUM','BELL'],['SEVEN','GRAPES','WATERMELON']],
    wins: [],
    payout: 0,
  };
}

module.exports = { generateResult, calculatePayout };
