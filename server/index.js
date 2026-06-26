const http = require('http');
const app = require('./app');
const ws = require('./services/ws');

const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const server = http.createServer(app);

// Init WebSocket on the same HTTP server
ws.init(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Kasino running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] WebSocket ready on ws://0.0.0.0:${PORT}/ws`);
});
