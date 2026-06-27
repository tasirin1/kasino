/**
 * Admin Dashboard JavaScript — includes games management
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (!api._token) { window.location.href = 'login.html'; return; }

  const me = await api.get('/api/user');
  if (me.error || !me.isAdmin) { window.location.href = '/'; return; }

  const fmt = n => 'Rp' + (n ?? 0).toLocaleString('id-ID');
  const rupiah = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const sliderPct = v => (parseInt(v) / 2).toFixed(1) + '%';
  const sliderMult = v => (parseInt(v) / 2).toFixed(1) + 'x';
  const sliderJackpotRate = v => (parseInt(v) / 2).toFixed(1) + '%';
  const sliderRupiah = v => rupiah(parseInt(v));

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
  const cfgJackpotRate = $('cfgJackpotRate'), cfgJackpotVal = $('cfgJackpotVal');
  const cfgStartMoneyVal = $('cfgStartMoneyVal'), cfgMinBetVal = $('cfgMinBetVal'), cfgMaxBetVal = $('cfgMaxBetVal');
  const cfgJackpotRateVal = $('cfgJackpotRateVal');
  const cfgSave = $('cfgSave'), accountList = $('accountList'), accountCount = $('accountCount');
  const btnAddAccount = $('btnAddAccount'), btnResetAll = $('btnResetAll');
  const adminLogout = $('adminLogout');
  const settingsOverlay = $('settingsOverlay');
  const settingsForm = $('settingsForm');
  const settingsTitle = $('settingsTitle');
  const settingsCancel = $('settingsCancel');
  const gameList = $('gameList'), gameCount = $('gameCount');
  const btnAddGame = $('btnAddGame');
  const cfgDebugMode = $('cfgDebugMode');
  const debugPanel = $('debugPanel');
  const debugLogs = $('debugLogs');

  // Debug mode toggle
  let debugActive = false;
  cfgDebugMode?.addEventListener('change', () => {
    debugActive = cfgDebugMode.checked;
    debugPanel.style.display = debugActive ? 'block' : 'none';
    document.getElementById('cfgDebugStatus').textContent = debugActive ? 'Aktif' : 'Nonaktif';
    if (debugActive) addDebugLog('🔍 Debug mode diaktifkan');
  });

  function addDebugLog(msg) {
    if (!debugLogs) return;
    const d = new Date();
    const time = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0');
    debugLogs.innerHTML += '<div>[' + time + '] ' + msg + '</div>';
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }

  function validateWinRate(val) {
    const v = parseFloat(val);
    if (isNaN(v) || v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }
  dbgTestBtn?.addEventListener('click', async () => {
    if (!api._token) return;
    const result = await api.post('/api/spin', { bet: 100, gameId: 'classic777' });
    if (result.error) { dbgTestResults.innerHTML = '<div style="color:#FF6B6B">Error: ' + result.error + '</div>'; return; }
    
    // Update debug panel
    const d = result._debug || {};
    dbgWinRate.textContent = d.winRate ? (d.winRate * 100).toFixed(1) + '%' : (result.winRate * 100).toFixed(1) + '%';
    dbgRandom.textContent = (result.roll * 100).toFixed(2) + '%';
    dbgResult.textContent = result.win ? 'WIN ✅' : 'LOSE ❌';
    dbgResult.style.color = result.win ? '#4CAF50' : '#FF6B6B';
    dbgRoll.textContent = result.roll.toFixed(6);
    dbgThreshold.textContent = d.threshold || ((result.winRate || 0) * 100).toFixed(1) + '%';
    
    // Add to history
    const entry = document.createElement('div');
    entry.className = 'debug-entry ' + (result.win ? 'win' : 'lose');
    const ts = new Date().toLocaleTimeString();
    entry.innerHTML = `<span>${ts}</span><span>WR:${(result.winRate*100).toFixed(1)}%</span><span>Roll:${(result.roll*100).toFixed(2)}%</span><span>${result.win ? 'WIN' : 'LOSE'}</span>`;
    dbgTestResults.prepend(entry);
    if (dbgTestResults.children.length > 20) dbgTestResults.lastChild?.remove();
  });

  DIFFICULTIES.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = DIFF_LABELS[i];
    cfgDifficulty.appendChild(opt);
  });

  let currentSettingsUser = null;

  function openSettings(username, currentSettings) {
    currentSettingsUser = username;
    settingsTitle.textContent = `Pengaturan: ${username}`;
    _setOverrideSlider('sWinRate', currentSettings.winRate, currentSettings.winRate !== undefined ? Math.round(currentSettings.winRate * 200) : null);
    _setOverrideSlider('sPayoutMult', currentSettings.payoutMultiplier, currentSettings.payoutMultiplier !== undefined ? Math.round(currentSettings.payoutMultiplier * 2) : null);
    _setOverrideSlider('sMinBet', currentSettings.minBet, currentSettings.minBet ?? null);
    _setOverrideSlider('sMaxBet', currentSettings.maxBet, currentSettings.maxBet ?? null);
    _setOverrideSlider('sJackpotRate', currentSettings.jackpotHitRate, currentSettings.jackpotHitRate !== undefined ? Math.round(currentSettings.jackpotHitRate * 200) : null);
    $('sNote').textContent = '';
    settingsOverlay.style.display = 'flex';
  }

  function _setOverrideSlider(id, rawValue, sliderValue) {
    const input = $(id);
    const valSpan = $(id + 'Val');
    const btn = input?.parentElement?.querySelector('.slider-global-btn');
    if (!input || !valSpan) return;
    if (sliderValue === null || rawValue === undefined) {
      // Use Global
      input.disabled = true;
      input.classList.add('use-global');
      valSpan.textContent = 'Global';
      if (btn) btn.classList.add('active');
    } else {
      input.value = sliderValue;
      input.disabled = false;
      input.classList.remove('use-global');
      if (id === 'sWinRate' || id === 'sJackpotRate') valSpan.textContent = sliderPct(sliderValue);
      else if (id === 'sPayoutMult') valSpan.textContent = sliderMult(sliderValue);
      else if (id === 'sMinBet' || id === 'sMaxBet' || id === 'sStartMoney') valSpan.textContent = sliderRupiah(sliderValue);
      if (btn) btn.classList.remove('active');
    }
  }

  function _attachGlobalToggle(id) {
    const input = $(id);
    const valSpan = $(id + 'Val');
    const btn = input?.parentElement?.querySelector('.slider-global-btn');
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
      if (input.disabled) {
        // Enable override
        input.disabled = false;
        input.classList.remove('use-global');
        btn.classList.remove('active');
        // Trigger input to update display
        input.dispatchEvent(new Event('input'));
      } else {
        // Revert to global
        input.disabled = true;
        input.classList.add('use-global');
        valSpan.textContent = 'Global';
        btn.classList.add('active');
      }
    });
    // Live update
    input.addEventListener('input', () => {
      if (input.disabled) return;
      if (id === 'sWinRate' || id === 'sJackpotRate') valSpan.textContent = sliderPct(input.value);
      else if (id === 'sPayoutMult') valSpan.textContent = sliderMult(input.value);
      else if (id === 'sMinBet' || id === 'sMaxBet') valSpan.textContent = sliderRupiah(input.value);
    });
  }

  function closeSettings() {
    settingsOverlay.style.display = 'none';
    currentSettingsUser = null;
    gameSettingsGameId = null;
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
    if (wr !== '' && wr !== null && !wr.disabled) settings.winRate = parseInt(wr.value) / 200;
    if (pm !== '' && pm !== null && !pm.disabled) settings.payoutMultiplier = parseInt(pm.value) / 2;
    if (minb !== '' && minb !== null && !minb.disabled) settings.minBet = parseInt(minb.value);
    if (maxb !== '' && maxb !== null && !maxb.disabled) settings.maxBet = parseInt(maxb.value);
    if (jr !== '' && jr !== null && !jr.disabled) settings.jackpotHitRate = parseInt(jr.value) / 200;
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
    cfgWinRate.value = Math.round((cfg.winRate || 0.15) * 200);
    cfgWinRateVal.textContent = sliderPct(cfgWinRate.value); _updateSliderFill(cfgWinRate);
    cfgPayout.value = Math.round((cfg.payoutMultiplier || 3) * 2);
    cfgPayoutVal.textContent = sliderMult(cfgPayout.value); _updateSliderFill(cfgPayout);
    cfgJackpotRate.value = Math.round((cfg.jackpotHitRate || 0.005) * 200);
    cfgJackpotRateVal.textContent = sliderJackpotRate(cfgJackpotRate.value); _updateSliderFill(cfgJackpotRate);
    cfgJackpot.value = cfg.jackpot || 5000000;
    cfgJackpotVal.textContent = sliderRupiah(cfgJackpot.value); _updateSliderFill(cfgJackpot);
    cfgStartMoney.value = cfg.startingMoney || 10000;
    cfgStartMoneyVal.textContent = sliderRupiah(cfgStartMoney.value); _updateSliderFill(cfgStartMoney);
    cfgMinBet.value = cfg.minBet || 1000;
    cfgMinBetVal.textContent = sliderRupiah(cfgMinBet.value); _updateSliderFill(cfgMinBet);
    cfgMaxBet.value = cfg.maxBet || 100000;
    cfgMaxBetVal.textContent = sliderRupiah(cfgMaxBet.value); _updateSliderFill(cfgMaxBet);
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

  function _updateSliderFill(el) {
    const min = parseInt(el.min) || 0;
    const max = parseInt(el.max) || 100;
    const val = parseInt(el.value) || min;
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 50;
    el.style.setProperty('--slider-pct', pct + '%');
  }

  cfgWinRate.oninput = () => { cfgWinRateVal.textContent = sliderPct(cfgWinRate.value); _updateSliderFill(cfgWinRate); };
  cfgPayout.oninput = () => { cfgPayoutVal.textContent = sliderMult(cfgPayout.value); _updateSliderFill(cfgPayout); };
  cfgJackpotRate.oninput = () => { cfgJackpotRateVal.textContent = sliderJackpotRate(cfgJackpotRate.value); _updateSliderFill(cfgJackpotRate); };
  cfgJackpot.oninput = () => { cfgJackpotVal.textContent = sliderRupiah(cfgJackpot.value); _updateSliderFill(cfgJackpot); };
  cfgStartMoney.oninput = () => { cfgStartMoneyVal.textContent = sliderRupiah(cfgStartMoney.value); _updateSliderFill(cfgStartMoney); };
  cfgMinBet.oninput = () => { cfgMinBetVal.textContent = sliderRupiah(cfgMinBet.value); _updateSliderFill(cfgMinBet); };
  cfgMaxBet.oninput = () => { cfgMaxBetVal.textContent = sliderRupiah(cfgMaxBet.value); _updateSliderFill(cfgMaxBet); };

  cfgSave.onclick = async () => {
    await api.post('/api/admin/config', {
      winRate: parseInt(cfgWinRate.value) / 200,
      payoutMultiplier: parseInt(cfgPayout.value) / 2,
      jackpotHitRate: parseInt(cfgJackpotRate.value) / 200,
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
      _setOverrideSlider('sWinRate', cfg.winRate, cfg.winRate !== undefined ? Math.round(cfg.winRate * 200) : null);
      _setOverrideSlider('sPayoutMult', cfg.payoutMultiplier, cfg.payoutMultiplier !== undefined ? Math.round(cfg.payoutMultiplier * 2) : null);
      _setOverrideSlider('sMinBet', cfg.minBet, cfg.minBet ?? null);
      _setOverrideSlider('sMaxBet', cfg.maxBet, cfg.maxBet ?? null);
      _setOverrideSlider('sJackpotRate', cfg.jackpotHitRate, cfg.jackpotHitRate !== undefined ? Math.round(cfg.jackpotHitRate * 200) : null);
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
      if (wr !== '' && wr !== null && !wr.disabled) updates.winRate = parseInt(wr.value) / 200;
      if (pm !== '' && pm !== null && !pm.disabled) updates.payoutMultiplier = parseInt(pm.value) / 2;
      if (minb !== '' && minb !== null && !minb.disabled) updates.minBet = parseInt(minb.value);
      if (maxb !== '' && maxb !== null && !maxb.disabled) updates.maxBet = parseInt(maxb.value);
      if (jr !== '' && jr !== null && !jr.disabled) updates.jackpotHitRate = parseInt(jr.value) / 200;
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
