/**
 * Game Engine — 3-reel slot machine logic
 * Pure functions: no side effects, no I/O.
 * RNG determines result BEFORE grid is built.
 * Win/loss strictly follows configured win rate.
 */

const { SYMBOLS, ALL_SYMBOL_IDS, PAYLINES } = require('../utils/constants');
const { randomSymbol } = require('../utils/helpers');

// Paylines as [reel, row] indices
// reel: 0=left, 1=middle, 2=right
// row: 0=top, 1=middle, 2=bottom

function getPayout(symbolId, count) {
  const sym = SYMBOLS[symbolId];
  if (!sym) return 0;
  const idx = Math.min(Math.max(count - 1, 0), sym.mult.length - 1);
  return sym.mult[idx];
}

function minCount(symbolId) {
  return (symbolId === 'CHERRY' || symbolId === 'LEMON' || symbolId === 'ORANGE') ? 2 : 3;
}

function evaluate(grid, bet) {
  if (!grid || grid.length < 3) return [];
  const wins = [];

  for (let pi = 0; pi < PAYLINES.length; pi++) {
    const line = PAYLINES[pi];
    const syms = line.map(([r, c]) => (grid[r] && grid[r][c]) ? grid[r][c] : 'BAR');

    let first = null;
    for (const s of syms) {
      if (s !== 'DIAMOND' && s !== 'JACKPOT') { first = s; break; }
    }
    if (!first) first = 'SEVEN';

    let count = 0;
    for (const s of syms) {
      if (s === first || s === 'DIAMOND') count++;
      else break;
    }

    if (count < minCount(first)) continue;
    const mult = getPayout(first, count);
    if (mult <= 0) continue;

    wins.push({
      payline: pi,
      symbol: first,
      count,
      multiplier: mult,
      amount: Math.floor(bet * mult),
      positions: line.slice(0, count),
    });
  }

  return wins;
}

function totalWin(wins) {
  return wins.reduce((sum, w) => sum + w.amount, 0);
}

/**
 * Generate a 3x3 grid based on RNG result.
 *
 * @param {boolean} isWin - Whether this spin should win
 * @param {number} bet - Current bet amount
 * @returns {{ grid: string[][], wins: Array }}
 */
function generateResult(isWin, bet) {
  if (isWin) {
    return generateWin(bet);
  }
  return generateLoss();
}

function generateWin(bet) {
  const winSym = randomSymbol(SYMBOLS);

  // Build grid with winning symbol on a random payline
  const winLineIndex = Math.floor(Math.random() * 5);
  const winLines = [
    [[0,0],[1,0],[2,0]],
    [[0,1],[1,1],[2,1]],
    [[0,2],[1,2],[2,2]],
    [[0,0],[1,1],[2,2]],
    [[0,2],[1,1],[2,0]],
  ];
  const winLine = winLines[winLineIndex];

  const grid = [[null,null,null],[null,null,null],[null,null,null]];

  for (const [r, c] of winLine) {
    grid[r][c] = winSym;
  }

  // Fill rest with non-matching symbols
  const otherSymbols = ALL_SYMBOL_IDS.filter(s => s !== winSym && s !== 'DIAMOND');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
      }
    }
  }

  let wins = evaluate(grid, bet);
  if (wins.length === 0) {
    // Force middle line
    grid[0][1] = winSym;
    grid[1][1] = winSym;
    grid[2][1] = winSym;
    wins = evaluate(grid, bet);
  }

  return { grid, wins };
}

function generateLoss() {
  // Guaranteed non-winning grid
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
      for (let c = 0; c < 3; c++) {
        grid[r][c] = rows[r * 3 + c][Math.floor(Math.random() * 3)];
      }
    }
    if (evaluate(grid, 100).length === 0) {
      return { grid, wins: [] };
    }
  }

  // Deterministic fallback
  return {
    grid: [['BAR','CHERRY','LEMON'],['ORANGE','PLUM','BELL'],['SEVEN','GRAPES','WATERMELON']],
    wins: [],
  };
}

module.exports = { evaluate, totalWin, generateResult };
