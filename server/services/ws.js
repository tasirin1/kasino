/**
 * WebSocket Manager — real-time sync for all connected browsers.
 * Broadcasts config/jackpot/balance changes instantly.
 */

const WebSocket = require('ws');

let wss = null;
const clients = new Set();

function init(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[WS] Client connected. Total:', clients.size);

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[WS] Client disconnected. Total:', clients.size);
    });

    ws.on('error', () => clients.delete(ws));
  });

  console.log('[WS] WebSocket server ready on /ws');
}

function broadcast(message) {
  if (!wss) return;
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(data); } catch { clients.delete(ws); }
    }
  }
}

function broadcastConfig(config) {
  broadcast({ type: 'configChanged', config });
}

function broadcastJackpot(value) {
  broadcast({ type: 'jackpotChanged', value });
}

function broadcastBalance(username, balance) {
  broadcast({ type: 'balanceChanged', player: username, balance });
}

function broadcastDifficulty(level, winRate, payoutMultiplier) {
  broadcast({ type: 'difficultyChanged', level, winRate, payoutMultiplier });
}

function broadcastReset() {
  broadcast({ type: 'resetGame' });
}

module.exports = { init, broadcast, broadcastConfig, broadcastJackpot, broadcastBalance, broadcastDifficulty, broadcastReset };
