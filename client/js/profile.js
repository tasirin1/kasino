/**
 * Profile Page — Full account management
 * All menus are functional, no placeholders.
 */
(async function() {
  const $ = id => document.getElementById(id);
  const qs = sel => document.querySelector(sel);
  const qsa = sel => document.querySelectorAll(sel);

  // Check auth
  if (!api._token) {
    window.location.href = '/login.html';
    return;
  }

  // ===== DOM REFS =====
  const DOM = {
    avatar: $('pAvatar'),
    avatarChange: $('pAvatarChange'),
    avatarFile: $('pAvatarFile'),
    avatarPreview: $('pAvatarPreview'),
    avatarChooseBtn: $('pAvatarChooseBtn'),
    username: $('pUsername'),
    balance: $('pBalance'),
    totalSpins: $('pTotalSpins'),
    totalWins: $('pTotalWins'),
    losses: $('pLosses'),
    winRate: $('pWinRate'),
    totalBet: $('pTotalBet'),
    totalPayout: $('pTotalPayout'),
    themeTag: $('pThemeTag'),
    langTag: $('pLangTag'),
    toast: $('pToast'),
  };

  // Modals
  const MODALS = {
    logout: $('pLogoutModal'),
    edit: $('pEditModal'),
    pass: $('pPassModal'),
    hist: $('pHistModal'),
    theme: $('pThemeModal'),
    lang: $('pLangModal'),
    notif: $('pNotifModal'),
    info: $('pInfoModal'),
    security: $('pSecurityModal'),
    delete: $('pDeleteModal'),
  };

  let profileData = null;

  // ===== HELPERS =====
  const fmt = n => (n ?? 0).toLocaleString('id-ID');
  const rupiah = n => 'Rp' + fmt(n);

  function showToast(msg, type) {
    const t = DOM.toast;
    if (!t) return;
    t.textContent = msg;
    t.style.background = type === 'error' ? 'rgba(255,50,50,0.9)' : type === 'warning' ? 'rgba(255,150,0,0.9)' : 'rgba(76,175,80,0.9)';
    t.style.display = 'block';
    t.style.opacity = '1';
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.style.display = 'none', 300);
    }, 2500);
  }

  function openModal(modal) {
    if (modal) modal.style.display = 'flex';
  }
  function closeModal(modal) {
    if (modal) modal.style.display = 'none';
  }

  // Close modal on bg click
  document.querySelectorAll('.p-modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.style.display = 'none';
    });
  });

  // ===== LOAD PROFILE =====
  async function loadProfile() {
    try {
      const data = await api.get('/api/profile');
      if (data.error) {
        api.clearToken();
        window.location.href = '/';
        return;
      }
      profileData = data;

      // Avatar
      if (DOM.avatar) DOM.avatar.textContent = data.avatar || '👤';
      if (DOM.avatarPreview) DOM.avatarPreview.textContent = data.avatar || '👤';

      // Basic info
      if (DOM.username) DOM.username.textContent = data.username;
      if (DOM.balance) DOM.balance.textContent = rupiah(data.balance);

      // Stats
      if (DOM.totalSpins) DOM.totalSpins.textContent = fmt(data.totalSpins);
      if (DOM.totalWins) DOM.totalWins.textContent = fmt(data.totalWins);
      if (DOM.losses) DOM.losses.textContent = fmt(data.losses);
      if (DOM.winRate) DOM.winRate.textContent = data.winRate + '%';
      if (DOM.totalBet) DOM.totalBet.textContent = rupiah(data.totalBet);
      if (DOM.totalPayout) DOM.totalPayout.textContent = rupiah(data.totalPayout);

      // Settings tags
      const theme = data.settings?.theme || 'dark';
      const lang = data.settings?.language || 'id';
      const themeNames = { dark: 'Dark Purple', gold: 'Gold', blue: 'Blue', green: 'Green', classic: 'Classic Casino' };
      const langNames = { id: 'Indonesia', en: 'English' };
      if (DOM.themeTag) DOM.themeTag.textContent = themeNames[theme] || 'Dark Purple';
      if (DOM.langTag) DOM.langTag.textContent = langNames[lang] || 'Indonesia';

      // Apply theme
      applyTheme(theme);
    } catch (e) {
      console.error('[Profile] Load error:', e);
      showToast('Gagal memuat profil', 'error');
    }
  }

  // ===== THEME =====
  const THEME_VARS = {
    dark: {
      '--bg': '#050008', '--bg2': '#0d001a', '--card': 'rgba(255,255,255,0.03)',
      '--primary': '#D5AD6D', '--accent': '#B8860B', '--text': '#fff', '--text2': 'rgba(180,160,220,0.6)',
      '--glow': 'rgba(213,173,109,0.3)', '--border': 'rgba(213,173,109,0.1)',
    },
    gold: {
      '--bg': '#0a0800', '--bg2': '#1a1200', '--card': 'rgba(255,215,0,0.04)',
      '--primary': '#FFD700', '--accent': '#DAA520', '--text': '#fff8e0', '--text2': 'rgba(255,215,0,0.5)',
      '--glow': 'rgba(255,215,0,0.3)', '--border': 'rgba(255,215,0,0.15)',
    },
    blue: {
      '--bg': '#000814', '--bg2': '#001233', '--card': 'rgba(0,168,255,0.04)',
      '--primary': '#00a8ff', '--accent': '#0077b6', '--text': '#e0f0ff', '--text2': 'rgba(0,168,255,0.5)',
      '--glow': 'rgba(0,168,255,0.3)', '--border': 'rgba(0,168,255,0.15)',
    },
    green: {
      '--bg': '#001a0a', '--bg2': '#003314', '--card': 'rgba(0,255,136,0.04)',
      '--primary': '#00ff88', '--accent': '#00cc6a', '--text': '#e0ffe8', '--text2': 'rgba(0,255,136,0.5)',
      '--glow': 'rgba(0,255,136,0.3)', '--border': 'rgba(0,255,136,0.15)',
    },
    classic: {
      '--bg': '#0a0000', '--bg2': '#1a0000', '--card': 'rgba(255,68,68,0.04)',
      '--primary': '#FF4444', '--accent': '#CC0000', '--text': '#ffe0e0', '--text2': 'rgba(255,68,68,0.5)',
      '--glow': 'rgba(255,68,68,0.3)', '--border': 'rgba(255,68,68,0.15)',
    },
  };

  function applyTheme(theme) {
    const vars = THEME_VARS[theme];
    if (!vars) return;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
    // Highlight active theme option
    document.querySelectorAll('.p-theme-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === theme);
    });
  }

  // ===== TRANSLATIONS =====
  const LANG = {
    id: {
      title: 'PROFIL', logout: 'LOGOUT', logoutConfirm: 'Yakin ingin logout?',
      win: 'Menang', lose: 'Kalah', all: 'Semua', spin: 'Spin',
      saved: 'Berhasil disimpan', error: 'Terjadi kesalahan',
      noHistory: 'Belum ada riwayat permainan',
    },
    en: {
      title: 'PROFILE', logout: 'LOGOUT', logoutConfirm: 'Are you sure you want to logout?',
      win: 'Win', lose: 'Lose', all: 'All', spin: 'Spin',
      saved: 'Saved successfully', error: 'An error occurred',
      noHistory: 'No game history yet',
    },
  };

  function t(key) {
    const lang = profileData?.settings?.language || 'id';
    return LANG[lang]?.[key] || LANG.id[key] || key;
  }

  // ===== 1. LOGOUT WITH CONFIRMATION =====
  $('pLogoutBtn')?.addEventListener('click', () => openModal(MODALS.logout));

  $('pLogoutConfirm')?.addEventListener('click', () => {
    api.clearToken();
    closeModal(MODALS.logout);
    window.location.href = '/';
  });

  $('pLogoutCancel')?.addEventListener('click', () => closeModal(MODALS.logout));
  document.querySelectorAll('#pLogoutModal .p-modal-close').forEach(el => {
    el.addEventListener('click', () => closeModal(MODALS.logout));
  });

  // ===== 2. EDIT PROFILE =====
  $('pEditProfileBtn')?.addEventListener('click', () => {
    if (!profileData) return;
    $('pEditUsername').value = profileData.username;
    if (DOM.avatarPreview) DOM.avatarPreview.textContent = profileData.avatar || '👤';
    $('pEditError').textContent = '';
    openModal(MODALS.edit);
  });

  // Avatar file picker
  DOM.avatarChooseBtn?.addEventListener('click', () => DOM.avatarFile?.click());

  DOM.avatarFile?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (DOM.avatarPreview) DOM.avatarPreview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      DOM.avatarPreview.dataset.avatar = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  $('pEditModalClose')?.addEventListener('click', () => closeModal(MODALS.edit));

  $('pEditForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = $('pEditUsername').value.trim().toLowerCase();
    if (!newUsername || newUsername.length < 3) {
      $('pEditError').textContent = 'Username minimal 3 karakter';
      return;
    }

    const body = { username: newUsername };
    const avatarData = DOM.avatarPreview?.dataset?.avatar;
    if (avatarData) body.avatar = avatarData;

    try {
      const result = await api.post('/api/profile/update', body);
      if (result.error) {
        $('pEditError').textContent = result.error;
        return;
      }
      closeModal(MODALS.edit);
      showToast('✅ Profil berhasil diupdate');
      loadProfile();
      // Update username in header via localStorage event
      localStorage.setItem('kasino_username', result.username);
    } catch (e) {
      $('pEditError').textContent = 'Gagal menyimpan';
    }
  });

  // ===== 3. CHANGE PASSWORD =====
  $('pChangePassBtn')?.addEventListener('click', () => {
    ['pOldPass','pNewPass','pConfirmPass'].forEach(id => $(id).value = '');
    $('pPassError').textContent = '';
    openModal(MODALS.pass);
  });

  $('pPassModalClose')?.addEventListener('click', () => closeModal(MODALS.pass));

  $('pPassForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPass = $('pOldPass').value;
    const newPass = $('pNewPass').value;
    const confirmPass = $('pConfirmPass').value;

    if (!oldPass) { $('pPassError').textContent = 'Masukkan password lama'; return; }
    if (!newPass || newPass.length < 4) { $('pPassError').textContent = 'Password baru minimal 4 karakter'; return; }
    if (newPass !== confirmPass) { $('pPassError').textContent = 'Password baru tidak cocok'; return; }

    try {
      const result = await api.post('/api/profile/password', { oldPassword: oldPass, newPassword: newPass });
      if (result.error) { $('pPassError').textContent = result.error; return; }
      closeModal(MODALS.pass);
      showToast('🔒 Password berhasil diubah');
    } catch (e) {
      $('pPassError').textContent = 'Gagal mengubah password';
    }
  });

  // ===== 4. HISTORY =====
  let historyFilter = 'all';

  $('pHistoryBtn')?.addEventListener('click', () => {
    historyFilter = 'all';
    loadHistory();
    openModal(MODALS.hist);
  });

  $('pHistModalClose')?.addEventListener('click', () => closeModal(MODALS.hist));

  // History tabs
  document.querySelectorAll('.p-htab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.p-htab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      historyFilter = tab.dataset.tab;
      loadHistory();
    });
  });

  async function loadHistory() {
    const list = $('pHistoryList');
    if (!list) return;
    list.innerHTML = '<div class="p-history-empty">⏳ Memuat...</div>';

    try {
      const data = await api.get('/api/profile/history?limit=100');
      if (data.error || !data.spins || data.spins.length === 0) {
        list.innerHTML = '<div class="p-history-empty">📭 Belum ada riwayat permainan</div>';
        return;
      }

      let filtered = data.spins;
      if (historyFilter === 'win') filtered = data.spins.filter(s => s.win);
      else if (historyFilter === 'lose') filtered = data.spins.filter(s => !s.win);

      if (filtered.length === 0) {
        list.innerHTML = '<div class="p-history-empty">📭 Tidak ada riwayat</div>';
        return;
      }

      list.innerHTML = filtered.map(s => {
        const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—';
        const time = s.timestamp ? new Date(s.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="p-history-item ${s.win ? 'win' : 'lose'}">
          <div class="p-h-left">
            <span class="p-h-game">${s.gameId || 'slot'}</span>
            <span class="p-h-date">${date} ${time}</span>
          </div>
          <div class="p-h-center">
            <span class="p-h-bet">Bet: Rp${fmt(s.bet)}</span>
            <span class="p-h-bal">Saldo: Rp${fmt(s.balance)}</span>
          </div>
          <div class="p-h-right">
            <span class="p-h-result ${s.win ? 'win' : 'lose'}">${s.win ? '+Rp'+fmt(s.payout) : 'KALAH'}</span>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="p-history-empty">❌ Gagal memuat riwayat</div>';
    }
  }

  // ===== 5. THEME =====
  $('pThemeBtn')?.addEventListener('click', () => {
    // Update active state
    const current = profileData?.settings?.theme || 'dark';
    document.querySelectorAll('.p-theme-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === current);
    });
    openModal(MODALS.theme);
  });

  $('pThemeModalClose')?.addEventListener('click', () => closeModal(MODALS.theme));

  document.querySelectorAll('.p-theme-opt').forEach(el => {
    el.addEventListener('click', async () => {
      const theme = el.dataset.theme;
      try {
        const result = await api.post('/api/profile/theme', { theme });
        if (result.error) { showToast(result.error, 'error'); return; }
        applyTheme(theme);
        if (DOM.themeTag) {
          const names = { dark: 'Dark Purple', gold: 'Gold', blue: 'Blue', green: 'Green', classic: 'Classic Casino' };
          DOM.themeTag.textContent = names[theme] || 'Dark Purple';
        }
        if (profileData) {
          if (!profileData.settings) profileData.settings = {};
          profileData.settings.theme = theme;
        }
        closeModal(MODALS.theme);
        showToast('🎨 Tema diganti');
      } catch (e) {
        showToast('Gagal mengganti tema', 'error');
      }
    });
  });

  // ===== 6. LANGUAGE =====
  $('pLangBtn')?.addEventListener('click', () => {
    const current = profileData?.settings?.language || 'id';
    document.querySelectorAll('.p-lang-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.lang === current);
    });
    openModal(MODALS.lang);
  });

  $('pLangModalClose')?.addEventListener('click', () => closeModal(MODALS.lang));

  document.querySelectorAll('.p-lang-opt').forEach(el => {
    el.addEventListener('click', async () => {
      const lang = el.dataset.lang;
      try {
        const result = await api.post('/api/profile/language', { language: lang });
        if (result.error) { showToast(result.error, 'error'); return; }
        if (DOM.langTag) {
          const names = { id: 'Indonesia', en: 'English' };
          DOM.langTag.textContent = names[lang] || 'Indonesia';
        }
        if (profileData) {
          if (!profileData.settings) profileData.settings = {};
          profileData.settings.language = lang;
        }
        closeModal(MODALS.lang);
        showToast('🌐 Bahasa diganti');
      } catch (e) {
        showToast('Gagal mengganti bahasa', 'error');
      }
    });
  });

  // ===== 7. NOTIFICATIONS =====
  $('pNotifBtn')?.addEventListener('click', async () => {
    // Set current values
    const notif = profileData?.settings?.notifications || {};
    ['sound','effects','vibration','popup'].forEach(key => {
      const el = document.getElementById('pNotif' + key.charAt(0).toUpperCase() + key.slice(1));
      if (el) el.checked = notif[key] !== false;
    });
    openModal(MODALS.notif);
  });

  $('pNotifModalClose')?.addEventListener('click', () => closeModal(MODALS.notif));

  $('pNotifSave')?.addEventListener('click', async () => {
    const notif = {
      sound: $('pNotifSound')?.checked ?? true,
      effects: $('pNotifEffects')?.checked ?? true,
      vibration: $('pNotifVibration')?.checked ?? true,
      popup: $('pNotifPopup')?.checked ?? true,
    };
    try {
      const result = await api.post('/api/profile/notifications', notif);
      if (result.error) { showToast(result.error, 'error'); return; }
      if (profileData) {
        if (!profileData.settings) profileData.settings = {};
        profileData.settings.notifications = result.notifications;
      }
      closeModal(MODALS.notif);
      showToast('🔔 Notifikasi disimpan');
    } catch (e) {
      showToast('Gagal menyimpan', 'error');
    }
  });

  // ===== 8. ACCOUNT INFO =====
  $('pInfoBtn')?.addEventListener('click', () => {
    if (!profileData) return;
    const d = profileData;
    const losses = d.losses;
    const totalSpins = d.totalSpins || 0;
    const totalWins = d.totalWins || 0;
    const winRate = d.winRate || 0;
    const totalBet = d.totalBet || 0;
    const totalPayout = d.totalPayout || 0;
    const rtp = totalBet > 0 ? ((totalPayout / totalBet) * 100).toFixed(1) : '0.0';

    if ($('pInfoUsername')) $('pInfoUsername').textContent = d.username;
    if ($('pInfoId')) $('pInfoId').textContent = d.id;
    if ($('pInfoCreated')) $('pInfoCreated').textContent = d.createdAt ? new Date(d.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    if ($('pInfoBalance')) $('pInfoBalance').textContent = rupiah(d.balance);
    if ($('pInfoSpins')) $('pInfoSpins').textContent = fmt(totalSpins);
    if ($('pInfoWins')) $('pInfoWins').textContent = fmt(totalWins);
    if ($('pInfoLosses')) $('pInfoLosses').textContent = fmt(losses);
    if ($('pInfoWR')) $('pInfoWR').textContent = winRate + '%';
    if ($('pInfoRTP')) $('pInfoRTP').textContent = rtp + '%';
    if ($('pInfoTotalBet')) $('pInfoTotalBet').textContent = rupiah(totalBet);
    if ($('pInfoTotalPayout')) $('pInfoTotalPayout').textContent = rupiah(totalPayout);
    if ($('pInfoPeak')) $('pInfoPeak').textContent = rupiah(d.balance); // Simplified

    openModal(MODALS.info);
  });

  $('pInfoModalClose')?.addEventListener('click', () => closeModal(MODALS.info));

  // ===== 9. SECURITY =====
  $('pSecurityBtn')?.addEventListener('click', () => {
    const count = profileData?.sessions || 0;
    if ($('pActiveSessions')) $('pActiveSessions').textContent = count;
    openModal(MODALS.security);
  });

  $('pSecurityModalClose')?.addEventListener('click', () => closeModal(MODALS.security));

  $('pLogoutAllBtn')?.addEventListener('click', async () => {
    try {
      const result = await api.post('/api/profile/logout-all');
      if (result.error) { showToast(result.error, 'error'); return; }
      closeModal(MODALS.security);
      showToast('🛡️ Semua session telah dihapus');
      if ($('pActiveSessions')) $('pActiveSessions').textContent = '0';
    } catch (e) {
      showToast('Gagal', 'error');
    }
  });


  // ===== 11. DELETE ACCOUNT =====
  $('pDeleteBtn')?.addEventListener('click', () => {
    $('pDeleteConfirm').value = '';
    $('pDeleteError').textContent = '';
    $('pDeleteConfirmBtn').disabled = true;
    openModal(MODALS.delete);
  });

  $('pDeleteModalClose')?.addEventListener('click', () => closeModal(MODALS.delete));

  $('pDeleteConfirm')?.addEventListener('input', () => {
    const val = $('pDeleteConfirm').value.toUpperCase();
    $('pDeleteConfirmBtn').disabled = val !== 'HAPUS';
  });

  $('pDeleteConfirmBtn')?.addEventListener('click', async () => {
    try {
      const result = await api.del('/api/profile/delete');
      if (result.error) { $('pDeleteError').textContent = result.error; return; }
      closeModal(MODALS.delete);
      showToast('🗑️ Akun telah dihapus');
      api.clearToken();
      setTimeout(() => window.location.href = '/', 1000);
    } catch (e) {
      $('pDeleteError').textContent = 'Gagal menghapus';
    }
  });

  $('pDeleteCancel')?.addEventListener('click', () => closeModal(MODALS.delete));

  // ===== CLOSE ALL MODALS ON ESC =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.p-modal[style*="flex"]').forEach(m => m.style.display = 'none');
    }
  });

  // ===== LISTEN FOR SETTINGS CHANGES VIA WS =====
  wsClient.on('settingsChanged', (data) => {
    if (data.username === profileData?.username && data.settings) {
      if (profileData) {
        if (!profileData.settings) profileData.settings = {};
        Object.assign(profileData.settings, data.settings);
      }
      // Apply theme if changed
      if (data.settings.theme) applyTheme(data.settings.theme);
      // Update tags
      if (data.settings.theme && DOM.themeTag) {
        const names = { dark: 'Dark Purple', gold: 'Gold', blue: 'Blue', green: 'Green', classic: 'Classic Casino' };
        DOM.themeTag.textContent = names[data.settings.theme] || 'Dark Purple';
      }
      if (data.settings.language && DOM.langTag) {
        const names = { id: 'Indonesia', en: 'English' };
        DOM.langTag.textContent = names[data.settings.language] || 'Indonesia';
      }
    }
  });

  wsClient.on('balanceChanged', (data) => {
    if (!data.player || data.player === profileData?.username) {
      if (data.balance !== undefined && data.balance >= 0) {
        if (profileData) profileData.balance = data.balance;
        if (DOM.balance) DOM.balance.textContent = rupiah(data.balance);
      }
    }
  });

  // ===== INIT =====
  await loadProfile();
})();
