/**
 * Admin Dashboard JavaScript
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (!api._token) { window.location.href = 'login.html'; return; }

  // Check admin
  const me = await api.get('/api/user');
  if (me.error || !me.isAdmin) { window.location.href = 'index.html'; return; }

  const DIFFICULTIES = ['very-easy','easy','medium','hard','very-hard','impossible'];
  const DIFF_LABELS = ['Very Easy','Easy','Medium','Hard','Very Hard','Impossible'];

  // Cache DOM
  const $ = id => document.getElementById(id);
  const statUsers = $('statUsers'), statBalance = $('statBalance'), statSpins = $('statSpins');
  const statRTP = $('statRTP'), statJackpot = $('statJackpot');
  const cfgDifficulty = $('cfgDifficulty'), cfgWinRate = $('cfgWinRate'), cfgWinRateVal = $('cfgWinRateVal');
  const cfgPayout = $('cfgPayout'), cfgPayoutVal = $('cfgPayoutVal'), cfgJackpot = $('cfgJackpot');
  const cfgStartMoney = $('cfgStartMoney'), cfgMinBet = $('cfgMinBet'), cfgMaxBet = $('cfgMaxBet');
  const cfgSave = $('cfgSave'), accountList = $('accountList'), accountCount = $('accountCount');
  const btnAddAccount = $('btnAddAccount'), btnResetAll = $('btnResetAll');
  const adminLogout = $('adminLogout');

  adminLogout?.addEventListener('click', () => { api.clearToken(); window.location.href = 'login.html'; });

  // Populate difficulty dropdown
  DIFFICULTIES.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = DIFF_LABELS[i];
    cfgDifficulty.appendChild(opt);
  });

  // Load data
  async function loadStats() {
    const stats = await api.get('/api/admin/stats');
    if (stats.error) return;
    statUsers.textContent = stats.totalUsers;
    statBalance.textContent = stats.totalBalance.toLocaleString('id-ID');
    statSpins.textContent = stats.totalSpins;
    statRTP.textContent = stats.rtp + '%';
    statJackpot.textContent = (stats.jackpot || 0).toLocaleString('id-ID');
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
          <span class="acc-balance">${(u.balance || 0).toLocaleString('id-ID')}</span>
          <span class="acc-stats">${u.totalSpins || 0} spins</span>
        </div>
        <div class="acc-actions">
          <button class="admin-btn tiny edit-btn" data-user="${u.username}" data-balance="${u.balance}">✏</button>
          <button class="admin-btn tiny red del-btn" data-user="${u.username}">✕</button>
        </div>
      `;
      accountList.appendChild(row);

      row.querySelector('.edit-btn').onclick = () => editUser(u.username, u.balance);
      row.querySelector('.del-btn').onclick = async () => {
        if (!confirm(`Hapus ${u.username}?`)) return;
        await api.del(`/api/admin/users/${u.username}`);
        loadUsers(); loadStats();
      };
    }
  }

  async function editUser(username, balance) {
    const newBal = prompt(`Balance untuk ${username}:`, balance);
    if (newBal === null) return;
    await api.put(`/api/admin/users/${username}`, { balance: parseInt(newBal) });
    loadUsers(); loadStats();
  }

  // Event handlers
  cfgDifficulty.onchange = async () => {
    const diff = cfgDifficulty.value;
    const idx = DIFFICULTIES.indexOf(diff);
    if (idx >= 0 && idx < 6) {
      // Apply preset values
      const presets = [
        { wr: 500, pay: 15 },  // Very Easy
        { wr: 300, pay: 20 },  // Easy
        { wr: 150, pay: 30 },  // Medium
        { wr: 80, pay: 50 },   // Hard
        { wr: 30, pay: 100 },  // Very Hard
        { wr: 5, pay: 200 },   // Impossible
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
    const val = parseInt(cfgWinRate.value) / 10;
    cfgWinRateVal.textContent = val.toFixed(1) + '%';
  };
  cfgPayout.oninput = () => {
    const val = parseInt(cfgPayout.value) / 10;
    cfgPayoutVal.textContent = val.toFixed(1) + 'x';
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
    alert('Config saved!');
  };

  btnAddAccount.onclick = () => {
    const user = prompt('Username:');
    if (!user) return;
    const pass = prompt('Password:');
    if (!pass) return;
    api.post('/api/admin/users', { username: user, password: pass }).then(r => {
      if (r.error) { alert(r.error); return; }
      loadUsers(); loadStats();
    });
  };

  btnResetAll.onclick = async () => {
    if (!confirm('Reset semua saldo akun?')) return;
    await api.post('/api/admin/reset-balances');
    loadUsers(); loadStats();
  };

  // WebSocket live updates
  wsClient.on('configChanged', () => { loadConfig(); loadStats(); });
  wsClient.on('balanceChanged', () => { loadUsers(); loadStats(); });

  // Initial load
  await Promise.all([loadStats(), loadConfig(), loadUsers()]);
});
