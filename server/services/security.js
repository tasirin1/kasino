/**
 * Security service — Anti Multi-Account & Anti Abuse
 * 
 * Tracks IP addresses, device fingerprints, and registration patterns.
 * All data persisted to JSON files in data/security/ directory.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEC_DIR = path.join(__dirname, '../../data/security');

function ensureDir() {
  if (!fs.existsSync(SEC_DIR)) fs.mkdirSync(SEC_DIR, { recursive: true });
}

function read(file) {
  ensureDir();
  try {
    const raw = fs.readFileSync(path.join(SEC_DIR, file), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function write(file, data) {
  ensureDir();
  fs.writeFileSync(path.join(SEC_DIR, file), JSON.stringify(data, null, 2));
}

// ===== IP TRACKING =====
// Structure: { "192.168.1.1": { accounts: ["user1","user2"], firstSeen: "...", lastSeen: "..." } }

function getIpRecords() {
  return read('ips.json') || {};
}

function saveIpRecords(records) {
  write('ips.json', records);
}

function trackIp(ip, username) {
  const records = getIpRecords();
  if (!records[ip]) {
    records[ip] = { accounts: [], firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), blocked: false };
  }
  if (!records[ip].accounts.includes(username)) {
    records[ip].accounts.push(username);
  }
  records[ip].lastSeen = new Date().toISOString();
  saveIpRecords(records);
  return records[ip];
}

function getAccountsByIp(ip) {
  const records = getIpRecords();
  return records[ip] || { accounts: [], firstSeen: null, lastSeen: null, blocked: false };
}

function getAllIps() {
  return getIpRecords();
}

function blockIp(ip) {
  const records = getIpRecords();
  if (records[ip]) records[ip].blocked = true;
  saveIpRecords(records);
}

function unblockIp(ip) {
  const records = getIpRecords();
  if (records[ip]) records[ip].blocked = false;
  saveIpRecords(records);
}

function isIpBlocked(ip) {
  const records = getIpRecords();
  return records[ip]?.blocked === true;
}

// ===== FINGERPRINT TRACKING =====
// Structure: { "sha256hash": { accounts: ["user1","user2"], ips: ["ip1","ip2"], firstSeen: "..." } }

function getFingerprintRecords() {
  return read('fingerprints.json') || {};
}

function saveFingerprintRecords(records) {
  write('fingerprints.json', records);
}

function trackFingerprint(fp, username, ip) {
  const records = getFingerprintRecords();
  if (!records[fp]) {
    records[fp] = { accounts: [], ips: [], firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), blocked: false, suspicious: false };
  }
  if (!records[fp].accounts.includes(username)) {
    records[fp].accounts.push(username);
  }
  if (!records[fp].ips.includes(ip)) {
    records[fp].ips.push(ip);
  }
  records[fp].lastSeen = new Date().toISOString();
  
  // Mark as suspicious if too many accounts from same fingerprint
  if (records[fp].accounts.length >= 3) {
    records[fp].suspicious = true;
  }
  
  saveFingerprintRecords(records);
  return records[fp];
}

function getAccountsByFingerprint(fp) {
  const records = getFingerprintRecords();
  return records[fp] || { accounts: [], ips: [], firstSeen: null, lastSeen: null, blocked: false, suspicious: false };
}

function getAllFingerprints() {
  return getFingerprintRecords();
}

function blockFingerprint(fp) {
  const records = getFingerprintRecords();
  if (records[fp]) records[fp].blocked = true;
  saveFingerprintRecords(records);
}

function unblockFingerprint(fp) {
  const records = getFingerprintRecords();
  if (records[fp]) records[fp].blocked = false;
  saveFingerprintRecords(records);
}

function isFingerprintBlocked(fp) {
  const records = getFingerprintRecords();
  return records[fp]?.blocked === true;
}

// ===== REGISTRATION LOGS =====
function getRegistrationLogs(limit = 100) {
  const logs = read('registrations.json') || [];
  return logs.slice(-limit).reverse();
}

function logRegistration(username, ip, fingerprint, success, reason) {
  const logs = read('registrations.json') || [];
  logs.push({
    username,
    ip,
    fingerprint,
    success,
    reason: reason || (success ? 'berhasil' : 'gagal'),
    userAgent: '',
    timestamp: new Date().toISOString(),
  });
  // Keep only last 1000 entries
  if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  write('registrations.json', logs);
}

// ===== DAILY REGISTRATION STATS =====
function getTodayRegistrations() {
  const logs = read('registrations.json') || [];
  const today = new Date().toISOString().slice(0, 10);
  return logs.filter(l => l.timestamp && l.timestamp.slice(0, 10) === today && l.success);
}

function getSuspiciousRegistrations() {
  const logs = read('registrations.json') || [];
  const fingerprints = getFingerprintRecords();
  const ips = getIpRecords();
  
  // Find registrations from IPs with many accounts or flagged fingerprints
  return logs.filter(l => {
    const ipData = ips[l.ip];
    const fpData = fingerprints[l.fingerprint];
    const ipCount = ipData ? ipData.accounts.length : 0;
    const fpCount = fpData ? fpData.accounts.length : 0;
    return ipCount >= 3 || fpCount >= 3 || (ipData && ipData.blocked) || (fpData && fpData.blocked);
  }).slice(-50);
}

// ===== CAPTCHA =====
// Simple math-based CAPTCHA

function generateCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const ops = ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer;
  switch (op) {
    case '+': answer = a + b; break;
    case '-': answer = a - b; break;
    case '*': answer = a * b; break;
  }
  const id = crypto.randomBytes(8).toString('hex');
  return { id, question: `${a} ${op} ${b} = ?`, answer };
}

const captchaStore = new Map();
// Cleanup old captchas
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of captchaStore) {
    if (now - data.created > 300000) captchaStore.delete(id); // 5 min
  }
}, 60000);

function createCaptcha() {
  const c = generateCaptcha();
  captchaStore.set(c.id, { answer: c.answer, created: Date.now() });
  return { id: c.id, question: c.question };
}

function verifyCaptcha(id, answer) {
  const data = captchaStore.get(id);
  if (!data) return false;
  captchaStore.delete(id); // One-time use
  return parseInt(answer) === data.answer;
}

// ===== STARTING MONEY PROTECTION =====

function shouldGiveStartingMoney(ip, fingerprint) {
  // Check if this IP already has accounts
  const ipData = getAccountsByIp(ip);
  const fpData = getAccountsByFingerprint(fingerprint);
  
  // First account from this IP/fingerprint → full starting money
  if (ipData.accounts.length === 0 && fpData.accounts.length === 0) {
    return { give: true, amount: 'full' };
  }
  
  // Has existing accounts but not flagged → reduced starting money
  if (ipData.accounts.length < 3 && fpData.accounts.length < 3) {
    return { give: true, amount: 'half' };
  }
  
  // Many accounts from same source → no starting money
  return { give: false, amount: 'none' };
}

// ===== SUMMARY FOR ADMIN =====
function getSecuritySummary() {
  const ips = getIpRecords();
  const fps = getFingerprintRecords();
  const todayRegs = getTodayRegistrations();
  
  const multiAccountIps = Object.entries(ips)
    .filter(([_, data]) => data.accounts.length >= 2)
    .map(([ip, data]) => ({ ip, accounts: data.accounts.length, blocked: data.blocked }));
  
  const multiAccountFps = Object.entries(fps)
    .filter(([_, data]) => data.accounts.length >= 2)
    .map(([fp, data]) => ({ 
      fingerprint: fp, 
      accounts: data.accounts.length, 
      ips: data.ips.length,
      blocked: data.blocked,
      suspicious: data.suspicious 
    }));
  
  const suspicious = getSuspiciousRegistrations();
  
  return {
    totalIps: Object.keys(ips).length,
    totalFingerprints: Object.keys(fps).length,
    todayRegistrations: todayRegs.length,
    multiAccountIps: multiAccountIps.length,
    multiAccountFps: multiAccountFps.length,
    suspiciousCount: suspicious.length,
    blockedIps: Object.values(ips).filter(d => d.blocked).length,
    blockedFingerprints: Object.values(fps).filter(d => d.blocked).length,
  };
}

module.exports = {
  trackIp, getAccountsByIp, getAllIps, blockIp, unblockIp, isIpBlocked,
  trackFingerprint, getAccountsByFingerprint, getAllFingerprints,
  blockFingerprint, unblockFingerprint, isFingerprintBlocked,
  logRegistration, getRegistrationLogs, getTodayRegistrations, getSuspiciousRegistrations,
  createCaptcha, verifyCaptcha,
  shouldGiveStartingMoney,
  getSecuritySummary,
};
