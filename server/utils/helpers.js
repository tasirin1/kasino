function randomSymbol(symbols) {
  const pool = [];
  for (const [id, sym] of Object.entries(symbols)) {
    for (let i = 0; i < sym.weight; i++) pool.push(id);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function weightedRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

module.exports = { randomSymbol, weightedRandom, clamp };
