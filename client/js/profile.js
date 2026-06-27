/**
 * Profile Page — Full account management with premium casino UI
 */
(async function() {
  const $ = id => document.getElementById(id);

  // Check auth
  if (!api._token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM refs
  const avatar = $('pAvatar');
  const username = $('pUsername');
  const balance = $('pBalance');
  const totalSpins = $('pTotalSpins');
  const totalWins = $('pTotalWins');
  const losses = $('pLosses');
  const winRate = $('pWinRate');
  const totalBet = $('pTotalBet');
  const totalPayout = $('pTotalPayout');
  const infoUsername = $('pInfoUsername');
  const infoId = $('pInfoId');
  const infoCreated = $('pInfoCreated');

  const editModal = $('pEditModal');
  const passModal = $('pPassModal');
  const histModal = $('pHistModal');
  const toast = $('pToast');

  let profileData = null;

  // Format helpers
  const fmt = n => (n ?? 0).toLocaleString('id-ID');
  const rupiah = (n) => 'Rp' + fmt(n);

  function showToast(msg, type) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = type === 'error' ? 'rgba(255,50,50,0.9)' : 'rgba(76,175,80,0.9)';
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.style.display = 'none', 300);
    }, 2500);
  }

  // Load profile
  async function loadProfile() {
    try {
      const data = await api.get('/api/profile');
      if (data.error) {
        api.clearToken();
        window.location.href = '/login.html';
        return;
      }
      profileData = data;

      // Hero
      if (username) username.textContent = data.username;
      if (balance) balance.textContent = rupiah(data.balance);
      if (infoUsername) infoUsername.textContent = data.username;
      if (infoId) infoId.textContent = data.id;
      if (infoCreated) infoCreated.textContent = data.createdAt ? new Date(data.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

      // Stats
      if (totalSpins) totalSpins.textContent = fmt(data.totalSpins);
      if (totalWins) totalWins.textContent = fmt(data.totalWins);
      if (losses) losses.textContent = fmt(data.losses);
      if (winRate) winRate.textContent = data.winRate + '%';
      if (totalBet) totalBet.textContent = rupiah(data.totalBet);
      if (totalPayout) totalPayout.textContent = rupiah(data.totalPayout);
    } catch (e) {
      console.error('[Profile] Load error:', e);
      showToast('Gagal memuat profil', 'error');
    }
  }

  // ===== LOGOUT =====
  $('pLogoutBtn')?.addEventListener('click', () => {
    api.clearToken();
    window.location.href = '/';
  });

  // ===== EDIT PROFILE =====
  $('pEditProfileBtn')?.addEventListener('click', () => {
    if (!profileData) return;
    $('pEditUsername').value = profileData.username;
    $('pEditError').textContent = '';
    editModal.style.display = 'flex';
  });

  $('pEditModalClose')?.addEventListener('click', () => editModal.style.display = 'none');
  editModal?.addEventListener('click', (e) => { if (e.target === editModal) editModal.style.display = 'none'; });

  $('pEditForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = $('pEditUsername').value.trim().toLowerCase();
    if (!newUsername || newUsername.length < 3) {
      $('pEditError').textContent = 'Username minimal 3 karakter';
      return;
    }

    try {
      const result = await api.put('/api/profile', { username: newUsername });
      if (result.error) {
        $('pEditError').textContent = result.error;
        return;
      }
      editModal.style.display = 'none';
      showToast('✅ Profil berhasil diupdate');
      loadProfile();
    } catch (e) {
      $('pEditError').textContent = 'Gagal menyimpan';
    }
  });

  // ===== CHANGE PASSWORD =====
  $('pChangePassBtn')?.addEventListener('click', () => {
    $('pOldPass').value = '';
    $('pNewPass').value = '';
    $('pConfirmPass').value = '';
    $('pPassError').textContent = '';
    passModal.style.display = 'flex';
  });

  $('pPassModalClose')?.addEventListener('click', () => passModal.style.display = 'none');
  passModal?.addEventListener('click', (e) => { if (e.target === passModal) passModal.style.display = 'none'; });

  $('pPassForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPass = $('pOldPass').value;
    const newPass = $('pNewPass').value;
    const confirmPass = $('pConfirmPass').value;

    if (!oldPass) { $('pPassError').textContent = 'Masukkan password lama'; return; }
    if (!newPass || newPass.length < 4) { $('pPassError').textContent = 'Password baru minimal 4 karakter'; return; }
    if (newPass !== confirmPass) { $('pPassError').textContent = 'Password baru tidak cocok'; return; }

    try {
      const result = await api.put('/api/profile/password', { oldPassword: oldPass, newPassword: newPass });
      if (result.error) {
        $('pPassError').textContent = result.error;
        return;
      }
      passModal.style.display = 'none';
      showToast('🔒 Password berhasil diubah');
    } catch (e) {
      $('pPassError').textContent = 'Gagal mengubah password';
    }
  });

  // ===== HISTORY =====
  $('pHistoryBtn')?.addEventListener('click', async () => {
    histModal.style.display = 'flex';
    const list = $('pHistoryList');
    if (!list) return;
    list.innerHTML = '<div class="p-history-empty">⏳ Memuat...</div>';

    try {
      const data = await api.get('/api/profile/history?limit=50');
      if (data.error || !data.spins || data.spins.length === 0) {
        list.innerHTML = '<div class="p-history-empty">📭 Belum ada riwayat permainan</div>';
        return;
      }

      list.innerHTML = data.spins.map(s => {
        const win = s.win;
        const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—';
        const time = s.timestamp ? new Date(s.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="p-history-item ${win ? 'win' : 'lose'}">
          <div class="p-h-left">
            <span class="p-h-game">${s.gameId || 'slot'}</span>
            <span class="p-h-date">${date} ${time}</span>
          </div>
          <div class="p-h-center">
            <span class="p-h-bet">Bet: Rp${fmt(s.bet)}</span>
          </div>
          <div class="p-h-right">
            <span class="p-h-result ${win ? 'win' : 'lose'}">${win ? 'Rp'+fmt(s.payout) : 'KALAH'}</span>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="p-history-empty">❌ Gagal memuat riwayat</div>';
    }
  });

  $('pHistModalClose')?.addEventListener('click', () => histModal.style.display = 'none');
  histModal?.addEventListener('click', (e) => { if (e.target === histModal) histModal.style.display = 'none'; });

  // ===== COMING SOON for disabled menu items =====
  document.querySelectorAll('.p-menu-item.disabled')?.forEach(el => {
    el.addEventListener('click', () => {
      showToast('🔧 Fitur akan segera hadir!');
    });
  });

  // ===== INIT =====
  await loadProfile();
})();
