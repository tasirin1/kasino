/**
 * Audit Logger — records security events
 * All logs saved to data/audit.log
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../data/audit.log');

function _timestamp() {
  return new Date().toISOString();
}

function _write(level, event, details) {
  try {
    const msg = `[${_timestamp()}] [${level}] [${event}] ${JSON.stringify(details)}\n`;
    fs.appendFileSync(LOG_FILE, msg, 'utf8');
  } catch (e) {
    console.error('[Logger] Write failed:', e.message);
  }
}

const logger = {
  info(event, details = {}) {
    _write('INFO', event, details);
  },

  warn(event, details = {}) {
    _write('WARN', event, details);
  },

  error(event, details = {}) {
    _write('ERROR', event, details);
  },

  // Specific audit events
  login(username, success, ip) {
    _write(success ? 'INFO' : 'WARN', 'LOGIN', { username, success, ip });
  },

  logout(username, ip) {
    _write('INFO', 'LOGOUT', { username, ip });
  },

  register(username, success, ip) {
    _write(success ? 'INFO' : 'WARN', 'REGISTER', { username, success, ip });
  },

  adminLogin(username, ip) {
    _write('INFO', 'ADMIN_LOGIN', { username, ip });
  },

  configChange(changedBy, updates) {
    _write('INFO', 'CONFIG_CHANGE', { changedBy, updates });
  },

  userCreated(by, newUser) {
    _write('INFO', 'USER_CREATED', { by, newUser });
  },

  userDeleted(by, username) {
    _write('INFO', 'USER_DELETED', { by, username });
  },

  balanceReset(by, username, amount) {
    _write('INFO', 'BALANCE_RESET', { by, username, amount });
  },

  spin(username, bet, win, payout, gameId) {
    // Only log significant spins (high value or wins)
    if (win && payout > 10000) {
      _write('INFO', 'SPIN_WIN', { username, bet, payout, gameId });
    }
  },

  error(event, message, ip) {
    _write('ERROR', event, { message, ip });
  }
};

module.exports = logger;
