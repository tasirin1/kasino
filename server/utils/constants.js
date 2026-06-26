const DIFFICULTIES = {
  'very-easy': { id: 0, label: 'Very Easy', winRate: 0.50, payoutMult: 1.5, minSpinsBeforeWin: 2, jackpotHitRate: 0.02 },
  'easy':      { id: 1, label: 'Easy',      winRate: 0.30, payoutMult: 2.0, minSpinsBeforeWin: 5, jackpotHitRate: 0.01 },
  'medium':    { id: 2, label: 'Medium',    winRate: 0.15, payoutMult: 3.0, minSpinsBeforeWin: 10, jackpotHitRate: 0.005 },
  'hard':      { id: 3, label: 'Hard',      winRate: 0.08, payoutMult: 5.0, minSpinsBeforeWin: 20, jackpotHitRate: 0.002 },
  'very-hard': { id: 4, label: 'Very Hard', winRate: 0.03, payoutMult: 10.0, minSpinsBeforeWin: 50, jackpotHitRate: 0.001 },
  'impossible':{ id: 5, label: 'Impossible',winRate: 0.005, payoutMult: 20.0, minSpinsBeforeWin: 100, jackpotHitRate: 0.0001 },
};

const DEFAULT_CONFIG = {
  difficulty: 'medium',
  winRate: 0.15,
  payoutMultiplier: 3.0,
  minSpinsBeforeWin: 10,
  jackpotHitRate: 0.005,
  jackpot: 5000000,
  startingMoney: 10000,
  minBet: 10,
  maxBet: 10000,
  betAmount: 100,
};

const SYMBOLS = {
  JACKPOT:    { icon: '💰', weight: 2,  mult: [0,0,500,2500,10000] },
  DIAMOND:    { icon: '💎', weight: 3,  mult: [0,0,200,1000,4000], wild: true },
  SEVEN:      { icon: '7',  weight: 5,  mult: [0,0,100,500,2000] },
  '3BAR':     { icon: 'Ⅲ', weight: 6,  mult: [0,0,60,250,1000] },
  '2BAR':     { icon: 'Ⅱ', weight: 7,  mult: [0,0,40,150,600] },
  BAR:        { icon: 'Ⅰ', weight: 8,  mult: [0,0,25,100,400] },
  BELL:       { icon: '🔔', weight: 8,  mult: [0,0,15,60,250] },
  CHERRY:     { icon: '🍒', weight: 10, mult: [0,3,10,40,150] },
  LEMON:      { icon: '🍋', weight: 10, mult: [0,2,8,30,100] },
  ORANGE:     { icon: '🍊', weight: 11, mult: [0,1,6,20,75] },
  PLUM:       { icon: '🍑', weight: 10, mult: [0,0,5,15,50] },
  GRAPES:     { icon: '🍇', weight: 10, mult: [0,0,4,12,40] },
  WATERMELON: { icon: '🍉', weight: 10, mult: [0,0,3,10,30] },
};

const ALL_SYMBOL_IDS = Object.keys(SYMBOLS);

const PAYLINES = [
  [[0,0],[1,0],[2,0]],
  [[0,1],[1,1],[2,1]],
  [[0,2],[1,2],[2,2]],
  [[0,0],[1,1],[2,2]],
  [[0,2],[1,1],[2,0]],
];

module.exports = { DIFFICULTIES, DEFAULT_CONFIG, SYMBOLS, ALL_SYMBOL_IDS, PAYLINES };
