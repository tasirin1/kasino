/**
 * Admin Dashboard JavaScript — includes games management
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (!api._token) { window.location.href = 'login.html'; return; }

  const me = await api.get('/api/user');
  if (me.error || !me.isAdmin) { window.location.href = 'index.html'; return; }

  const fmt = n => 'Rp' + (n ?? 0).toLocaleString('id-ID');

  const DIFFICULTIES = ['very-easy','easy','medium','hard','very-hard','impossible'];
  const DIFF_LABELS = ['Very Easy','Easy','Medium','Hard','Very Hard','Impossible'];
  const CATEGORIES = ['slot','arcade','table','instant','other'];
  const CAT_LABELS = ['Slot','Arcade','Table','Instant Win','Other'];

  const $ = id => document.getElementById(id);
  const statUsers = $('statUsers'), statBalance = $('statBalance'), statSpins = $('statSpins');
  const statRTP = $('statRTP'), statJackpot = $('statJackpot');
  const cfgDifficulty = $('cfgDifficulty'), cfgWinRate = $('cfgWinRate'), cfgWinRateVal = $('cfgWinRateVal');
  const cfgPayout = $('cfgPayout'), cfgPayoutVal = $('cfgPayoutVal'), cfgJackpot = $('cfgJackpot');
  const cfgStartMoney = $('cfgStartMoney'), cfgMinBet = $('cfgMinBet'), cfgMaxBet = $('cfgMaxBet');
  const cfgSave = $('cfgSave'), accountList = $('accountList'), accountCount = $('accountCount');
  const btnAddAccount = $('btnAddAccount'), btnResetAll = $('btnResetAll');
  const adminLogout = $('adminLogout');
  const settingsOverlay = $('settingsOverlay');
  const settingsForm = $('settingsForm');
  const settingsTitle = $('settingsTitle');
  const settingsCancel = $('settingsCancel');
  const gameList = $('gameList'), gameCount = $('gameCount');
  const btnAddGame = $('btnAddGame');

  adminLogout?.addEventListener('click', () => { api.clearToken(); window.location.href = 'login.html'; });

  DIFFICULTIES.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = DIFF_LABELS[i];
    cfgDifficulty.appendChild(opt);
  });

  let currentSettingsUser = null;

  function openSettings(username, currentSettings) {
    currentSettingsUser = username;
    settingsTitle.textContent = `Pengaturan: ${username}`;
    $('sWinRate').value = currentSettings.winRate !== undefined ? Math.round(currentSettings.winRate * 1000) : '';
    $('sPayoutMult').value = currentSettings.payoutMultiplier !== undefined ? Math.round(currentSettings.payoutMultiplier * 10) : '';
    $('sMinBet').value = currentSettings.minBet ?? '';
    $('sMaxBet').value = currentSettings.maxBet ?? '';
    $('sJackpotRate').value = currentSettings.jackpotHitRate !== undefined ? (currentSettings.jackpotHitRate * 1000).toFixed(1) : '';
    $('sNote').textContent = '';
    settingsOverlay.style.display = 'flex';
  }

  function closeSettings() {
    settingsOverlay.style.display = 'none';
    currentSettingsUser = null;
  }

  settingsCancel.onclick = closeSettings;

  settingsForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentSettingsUser) return;
    const settings = {};
    const wr = $('sWinRate').value;
    const pm = $('sPayoutMult').value;
    const minb = $('sMinBet').value;
    const maxb = $('sMaxBet').value;
    const jr = $('sJackpotRate').value;
    if (wr !== '') settings.winRate = parseInt(wr) / 1000;
    if (pm !== '') settings.payoutMultiplier = parseInt(pm) / 10;
    if (minb !== '') settings.minBet = parseInt(minb);
    if (maxb !== '') settings.maxBet = parseInt(maxb);
    if (jr !== '') settings.jackpotHitRate = parseFloat(jr) / 1000;
    const res = await api.put(`/api/admin/users/${currentSettingsUser}/settings`, settings);
    if (res.error) { $('sNote').textContent = 'Error: ' + res.error; }
    else { closeSettings(); loadUsers(); loadStats(); }
  };

  async function loadStats() {
    const stats = await api.get('/api/admin/stats');
    if (stats.error) return;
    statUsers.textContent = stats.totalUsers;
    statBalance.textContent = 'Rp' + fmt(stats.totalBalance);
    statSpins.textContent = stats.totalSpins;
    statRTP.textContent = stats.rtp + '%';
    statJackpot.textContent = 'Rp' + fmt(stats.jackpot || 0);
  }

  async function loadConfig() {
    const cfg = await api.get('/api/config');
    if (cfg.error) return;
    cfgDifficulty.value = cfg.difficulty || 'medium';
    cfgWinRate.value = Math.round((cfg.winRate || 0.15) * 1000);
    cfgWinRateVal.textContent = ((cfg.winRate || 0.15) * 100).toFixed(1) + '%';
    cfgPayout.value = Math.round((cfg.payoutMultiplier || 3) * 10);
    cfgPayoutVal.textContent = (cfg.payoutMultiplier || 3) + 'x';
    cfgJackpot.value = cfg.jackpot || 5000000;
    cfgStartMoney.value = cfg.startingMoney || 10000;
    cfgMinBet.value = cfg.minBet || 10;
    cfgMaxBet.value = cfg.maxBet || 10000;
  }

  async function loadUsers() {
    const users = await api.get('/api/admin/users');
    if (users.error) return;
    accountList.innerHTML = '';
    accountCount.textContent = `(${users.length})`;
    if (users.length === 0) {
      accountList.innerHTML = '<p style="color:#666;padding:10px;">Belum ada pemain</p>';
      return;
    }
    for (const u of users) {
      const row = document.createElement('div');
      row.className = 'account-row';
      row.innerHTML = `
        <div class="acc-info">
          <strong class="acc-name">${u.username}</strong>
          <span class="acc-balance">Rp${fmt(u.balance || 0)}</span>
          <span class="acc-stats">${u.totalSpins || 0} spins</span>
        </div>
        <div class="acc-actions">
          <button class="admin-btn tiny edit-btn" data-user="${u.username}" data-balance="${u.balance}">✏</button>
          <button class="admin-btn tiny settings-btn" data-user="${u.username}">⚙</button>
          <button class="admin-btn tiny red del-btn" data-user="${u.username}">✕</button>
        </div>
      `;
      accountList.appendChild(row);
      row.querySelector('.edit-btn').onclick = () => editUser(u.username, u.balance);
      row.querySelector('.settings-btn').onclick = () => openSettings(u.username, u.settings || {});
      row.querySelector('.del-btn').onclick = async () => {
        if (!confirm(`Hapus ${u.username}?`)) return;
        await api.del(`/api/admin/users/${u.username}`);
        loadUsers(); loadStats();
      };
    }
  }

  async function editUser(username, balance) {
    const newBal = prompt(`Balance untuk ${username} (Rp):`, balance);
    if (newBal === null) return;
    await api.put(`/api/admin/users/${username}`, { balance: parseInt(newBal) });
    loadUsers(); loadStats();
  }

  cfgDifficulty.onchange = async () => {
    const diff = cfgDifficulty.value;
    const idx = DIFFICULTIES.indexOf(diff);
    if (idx >= 0) {
      const presets = [
        { wr: 500, pay: 15 }, { wr: 300, pay: 20 }, { wr: 150, pay: 30 },
        { wr: 80, pay: 50 }, { wr: 30, pay: 100 }, { wr: 5, pay: 200 },
      ];
      const p = presets[idx];
      cfgWinRate.value = p.wr;
      cfgWinRateVal.textContent = (p.wr / 10).toFixed(1) + '%';
      cfgPayout.value = p.pay;
      cfgPayoutVal.textContent = (p.pay / 10) + 'x';
    }
    await api.post('/api/admin/config', { difficulty: diff });
    loadConfig(); loadStats();
  };

  cfgWinRate.oninput = () => {
    cfgWinRateVal.textContent = (parseInt(cfgWinRate.value) / 10).toFixed(1) + '%';
  };
  cfgPayout.oninput = () => {
    cfgPayoutVal.textContent = (parseInt(cfgPayout.value) / 10).toFixed(1) + 'x';
  };

  cfgSave.onclick = async () => {
    await api.post('/api/admin/config', {
      winRate: parseInt(cfgWinRate.value) / 1000,
      payoutMultiplier: parseInt(cfgPayout.value) / 10,
      jackpot: parseInt(cfgJackpot.value),
      startingMoney: parseInt(cfgStartMoney.value),
      minBet: parseInt(cfgMinBet.value),
      maxBet: parseInt(cfgMaxBet.value),
    });
    await api.post('/api/admin/jackpot', { value: parseInt(cfgJackpot.value) });
    loadConfig(); loadStats();
    showToast('Config saved!');
  };

  btnAddAccount.onclick = () => {
    const user = prompt('Username:'); if (!user) return;
    const pass = prompt('Password:'); if (!pass) return;
    api.post('/api/admin/users', { username: user, password: pass }).then(r => {
      if (r.error) { alert(r.error); return; }
      loadUsers(); loadStats();
    });
  };

  btnResetAll.onclick = async () => {
    if (!confirm('Reset semua saldo akun ke Starting Money?')) return;
    await api.post('/api/admin/reset-balances');
    loadUsers(); loadStats();
  };

  // ===== GAMES MANAGEMENT =====
  let gameSettingsGameId = null;

  function showGameSettings(gameId) {
    gameSettingsGameId = gameId;
    settingsTitle.textContent = `Config Game: ${gameId}`;
    // Fetch current game config
    api.get('/api/games/' + gameId).then(game => {
      if (game.error) return;
      const cfg = game.config || {};
      $('sWinRate').value = cfg.winRate !== undefined ? Math.round(cfg.winRate * 1000) : '';
      $('sPayoutMult').value = cfg.payoutMultiplier !== undefined ? Math.round(cfg.payoutMultiplier * 10) : '';
      $('sMinBet').value = cfg.minBet ?? '';
      $('sMaxBet').value = cfg.maxBet ?? '';
      $('sJackpotRate').value = cfg.jackpotHitRate !== undefined ? (cfg.jackpotHitRate * 1000).toFixed(1) : '';
      $('sNote').textContent = 'Mengubah config game ' + gameId;
      settingsOverlay.style.display = 'flex';
    });
  }

  // Override settings form submit for game configs
  const origSubmit = settingsForm.onsubmit;
  settingsForm.onsubmit = async (e) => {
    e.preventDefault();
    if (gameSettingsGameId && !currentSettingsUser) {
      // Game config save
      const updates = {};
      const wr = $('sWinRate').value;
      const pm = $('sPayoutMult').value;
      const minb = $('sMinBet').value;
      const maxb = $('sMaxBet').value;
      const jr = $('sJackpotRate').value;
      if (wr !== '') updates.winRate = parseInt(wr) / 1000;
      if (pm !== '') updates.payoutMultiplier = parseInt(pm) / 10;
      if (minb !== '') updates.minBet = parseInt(minb);
      if (maxb !== '') updates.maxBet = parseInt(maxb);
      if (jr !== '') updates.jackpotHitRate = parseFloat(jr) / 1000;
      const res = await api.put(`/api/admin/games/${gameSettingsGameId}/config`, updates);
      if (res.error) { $('sNote').textContent = 'Error: ' + res.error; }
      else { closeSettings(); gameSettingsGameId = null; loadGames(); }
      return;
    }
    // User settings save
    if (currentSettingsUser) {
      const settings = {};
      const wr = $('sWinRate').value;
      const pm = $('sPayoutMult').value;
      const minb = $('sMinBet').value;
      const maxb = $('sMaxBet').value;
      const jr = $('sJackpotRate').value;
      if (wr !== '') settings.winRate = parseInt(wr) / 1000;
      if (pm !== '') settings.payoutMultiplier = parseInt(pm) / 10;
      if (minb !== '') settings.minBet = parseInt(minb);
      if (maxb !== '') settings.maxBet = parseInt(maxb);
      if (jr !== '') settings.jackpotHitRate = parseFloat(jr) / 1000;
      const res = await api.put(`/api/admin/users/${currentSettingsUser}/settings`, settings);
      if (res.error) { $('sNote').textContent = 'Error: ' + res.error; }
      else { closeSettings(); currentSettingsUser = null; loadUsers(); loadStats(); }
    }
  };

  async function loadGames() {
    const games = await api.get('/api/admin/games');
    if (games.error) return;
    gameList.innerHTML = '';
    gameCount.textContent = `(${games.length})`;
    if (games.length === 0) {
      gameList.innerHTML = '<p style="color:#666;padding:10px;">Belum ada game</p>';
      return;
    }
    for (const g of games) {
      const row = document.createElement('div');
      row.className = 'account-row';
      row.innerHTML = `
        <div class="acc-info">
          <strong class="acc-name">${g.name}</strong>
          <span class="acc-stats">${g.category} • ${g.enabled ? '🟢' : '🔴'}</span>
          <span class="acc-balance" style="font-size:11px;color:rgba(180,160,220,0.5)">${g.id} • WR:${((g.config?.winRate||0)*100).toFixed(0)}%</span>
        </div>
        <div class="acc-actions">
          <button class="admin-btn tiny config-btn" data-game="${g.id}">⚙</button>
          <button class="admin-btn tiny ${g.enabled?'green':'red'} toggle-btn" data-game="${g.id}">${g.enabled?'ON':'OFF'}</button>
          <button class="admin-btn tiny red del-game-btn" data-game="${g.id}">✕</button>
        </div>
      `;
      gameList.appendChild(row);
      row.querySelector('.config-btn').onclick = () => showGameSettings(g.id);
      row.querySelector('.toggle-btn').onclick = async () => {
        await api.post(`/api/admin/games/${g.id}/toggle`, { enabled: !g.enabled });
        loadGames();
      };
      row.querySelector('.del-game-btn').onclick = async () => {
        if (!confirm(`Hapus game ${g.name}?`)) return;
        await api.del(`/api/admin/games/${g.id}`);
        loadGames();
      };
    }
  }

  btnAddGame.onclick = () => {
    const name = prompt('Nama game:'); if (!name) return;
    const cat = prompt('Kategori (slot/arcade/table/instant/other):', 'slot');
    api.post('/api/admin/games', { name, category: cat || 'slot' }).then(r => {
      if (r.error) { alert(r.error); return; }
      loadGames();
    });
  };

  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1a0020;color:#D5AD6D;padding:10px 20px;border-radius:8px;border:1px solid rgba(213,173,109,0.3);z-index:2000;font-size:13px';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  wsClient.on('configChanged', () => { loadConfig(); loadStats(); });
  wsClient.on('balanceChanged', () => { loadUsers(); loadStats(); });
  wsClient.on('gamesUpdated', () => { loadGames(); });

  await Promise.all([loadStats(), loadConfig(), loadUsers(), loadGames()]);
});
