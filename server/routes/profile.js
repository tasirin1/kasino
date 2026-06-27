const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');
const ws = require('../services/ws');

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// GET /api/profile — full profile data
router.get('/', (req, res) => {
  const profile = storage.getFullProfile(req.user.username);
  if (!profile) return res.status(404).json({ error: 'User not found' });

  const spins = storage.getSpins(storage.findUser(req.user.username).id, 100);
  const wins = spins.filter(s => s.payout > 0).length;
  profile.wins = wins;

  res.json(profile);
});

// POST /api/profile/update — update username, avatar, or settings
router.post('/update', async (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, avatar, settings } = req.body;

  // Change username
  if (username && username !== req.user.username) {
    const name = username.trim().toLowerCase();
    if (name.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter' });
    const existing = storage.findUser(name);
    if (existing && existing.username !== req.user.username) return res.status(400).json({ error: 'Username sudah digunakan' });
    storage.updateUser(req.user.username, { username: name });
    req.user.username = name;
  }

  // Change avatar
  if (avatar !== undefined) {
    storage.updateUser(req.user.username, { avatar });
  }

  // Update settings
  if (settings) {
    storage.updateUserSettings(req.user.username, settings);
  }

  const updated = storage.findUser(req.user.username);
  res.json({
    success: true,
    username: updated.username,
    balance: updated.balance,
    avatar: updated.avatar,
    settings: updated.settings || {},
  });
});

// POST /api/profile/password — change password
router.post('/password', async (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan baru diperlukan' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Password baru minimal 4 karakter' });
  }

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) return res.status(400).json({ error: 'Password lama salah' });

  const hashed = await bcrypt.hash(newPassword, 10);
  storage.updateUser(req.user.username, { password: hashed });
  res.json({ success: true, message: 'Password berhasil diubah' });
});

// POST /api/profile/theme — change theme
router.post('/theme', (req, res) => {
  const { theme } = req.body;
  if (!theme) return res.status(400).json({ error: 'Theme required' });
  const valid = ['dark', 'gold', 'blue', 'green', 'classic'];
  if (!valid.includes(theme)) return res.status(400).json({ error: 'Theme tidak valid' });
  const result = storage.updateUserTheme(req.user.username, theme);
  if (!result) return res.status(404).json({ error: 'User not found' });
  ws.broadcast({ type: 'settingsChanged', username: req.user.username, settings: { theme } });
  res.json({ success: true, theme });
});

// POST /api/profile/language — change language
router.post('/language', (req, res) => {
  const { language } = req.body;
  if (!language) return res.status(400).json({ error: 'Language required' });
  const valid = ['id', 'en'];
  if (!valid.includes(language)) return res.status(400).json({ error: 'Language tidak valid' });
  const result = storage.updateUserLanguage(req.user.username, language);
  if (!result) return res.status(404).json({ error: 'User not found' });
  ws.broadcast({ type: 'settingsChanged', username: req.user.username, settings: { language } });
  res.json({ success: true, language });
});

// POST /api/profile/notifications — update notification settings
router.post('/notifications', (req, res) => {
  const { sound, effects, vibration, popup } = req.body;
  const notif = {};
  if (sound !== undefined) notif.sound = !!sound;
  if (effects !== undefined) notif.effects = !!effects;
  if (vibration !== undefined) notif.vibration = !!vibration;
  if (popup !== undefined) notif.popup = !!popup;
  const result = storage.updateUserNotifications(req.user.username, notif);
  if (!result) return res.status(404).json({ error: 'User not found' });
  ws.broadcast({ type: 'settingsChanged', username: req.user.username, settings: { notifications: result.settings.notifications } });
  res.json({ success: true, notifications: result.settings.notifications });
});

// POST /api/profile/logout — logout from current device
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) storage.removeUserSession(req.user.username, token);
  res.json({ success: true, message: 'Logout berhasil' });
});

// POST /api/profile/logout-all — logout from all devices
router.post('/logout-all', (req, res) => {
  storage.removeAllUserSessions(req.user.username);
  res.json({ success: true, message: 'Semua session telah dihapus' });
});

// POST /api/profile/reset-stats — reset game statistics
router.post('/reset-stats', (req, res) => {
  const result = storage.resetUserStats(req.user.username);
  if (!result) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, message: 'Statistik berhasil direset' });
});

// DELETE /api/profile/delete — permanently delete account
router.delete('/delete', (req, res) => {
  const username = req.user.username;
  const user = storage.findUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ error: 'Akun admin tidak bisa dihapus' });
  storage.removeAllUserSessions(username);
  storage.deleteUser(username);
  res.json({ success: true, message: 'Akun berhasil dihapus' });
});

// GET /api/profile/history — spin history (enhanced)
router.get('/history', (req, res) => {
  const user = storage.findUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const spins = storage.getSpins(user.id, limit);

  res.json({
    total: spins.length,
    spins: spins.map(s => ({
      gameId: s.gameId,
      bet: s.bet,
      payout: s.payout,
      win: s.payout > 0,
      balance: s.balanceAfter || 0,
      timestamp: s.timestamp || new Date().toISOString(),
    })),
  });
});

module.exports = router;
