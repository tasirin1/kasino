/**
 * Game Loader — Loads game modules into game.html
 * Routes /play/:gameId to the correct game module
 */
(async function() {
  const gameId = window.location.pathname.split('/play/')[1]?.split('?')[0] || 'classic777';
  const gTitle = document.getElementById('gameTitle');
  const gBalance = document.getElementById('gBalance');
  const gUsername = document.getElementById('gUsername');
  const gAuthArea = document.getElementById('gAuthArea');
  const gUserArea = document.getElementById('gUserArea');
  const container = document.getElementById('gameCanvas');

  let currentGame = null;

  // Show error in game container
  function showError(title, msg) {
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(180,160,220,0.6)">' +
      '<h2 style="color:#FF6B6B;font-size:16px;margin-bottom:8px">' + title + '</h2>' +
      '<p style="font-size:12px;margin-bottom:12px">' + msg + '</p>' +
      '<a href="/" style="display:inline-block;padding:6px 14px;background:linear-gradient(180deg,#D5AD6D,#B8860B);color:#1a0020;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700">Kembali ke Lobby</a></div>';
  }
  function showComingSoon(gameId) {
    if (!container) return;
    const gameNames = { 'diceroll': 'Dice Roll', 'scratchcard': 'Scratch Card', 'luckybox': 'Lucky Box', 'wheel': 'Wheel of Fortune' };
    const name = gameNames[gameId] || gameId;
    container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:20px">' +
      '<div style="font-size:48px">🚧</div>' +
      '<h2 style="color:#D5AD6D;font-size:18px;font-weight:800">' + name + '</h2>' +
      '<p style="color:rgba(180,160,220,0.5);font-size:12px;max-width:280px">Game sedang dalam pengembangan. Akan segera hadir!</p>' +
      '<div style="display:flex;gap:8px;margin-top:4px">' +
      '<a href="/play/classic777" style="padding:6px 16px;border:none;border-radius:6px;background:linear-gradient(180deg,#FFD700,#B8860B);color:#1a0020;font-size:12px;font-weight:700;text-decoration:none">Main Classic 777</a>' +
      '<a href="/" style="padding:6px 16px;border:1px solid rgba(213,173,109,0.2);border-radius:6px;color:#D5AD6D;font-size:12px;font-weight:600;text-decoration:none">Kembali</a></div></div>';
  }

  // Auth modal
  function showAuthModal(formType) {
    const modal = document.getElementById('gameAuthModal');
    const body = document.getElementById('gameAuthModalBody');
    if (!modal || !body) return;
    modal.style.display = 'flex';
    if (formType === 'register') {
      body.innerHTML = `
        <div class="auth-card-compact">
          <h2 class="auth-title">DAFTAR AKUN</h2>
          <form id="gRegForm">
            <div class="form-group"><label>Username</label><input type="text" id="gRegUser" required minlength="3"></div>
            <div class="form-group"><label>Password</label><input type="password" id="gRegPass" required minlength="4"></div>
            <div id="gRegError" class="form-error"></div>
            <button type="submit" class="auth-btn">DAFTAR</button>
          </form>
          <p class="auth-link">Sudah punya akun? <a href="#" id="gSwitchLogin">Masuk</a></p>
        </div>`;
      const form = document.getElementById('gRegForm');
      if (form) form.onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('gRegUser')?.value?.trim();
        const p = document.getElementById('gRegPass')?.value;
        if (!u || !p) { document.getElementById('gRegError').textContent = 'Isi semua field'; return; }
        const r = await api.post('/api/register', { username: u, password: p });
        if (r.error) { const err = document.getElementById('gRegError'); if (err) err.textContent = r.error; return; }
        api.setToken(r.token);
        if (r.user && r.user.isAdmin) { window.location.href = '/admin.html'; return; }
        modal.style.display = 'none';
        _updateAuthUI(r.user);
        if (currentGame && currentGame._loadUser) currentGame._loadUser();
      };
      const sw = document.getElementById('gSwitchLogin');
      if (sw) sw.onclick = (e) => { e.preventDefault(); showAuthModal('login'); };
    } else {
      body.innerHTML = `
        <div class="auth-card-compact">
          <h2 class="auth-title">MASUK</h2>
          <form id="gLoginForm">
            <div class="form-group"><label>Username</label><input type="text" id="gLoginUser" required></div>
            <div class="form-group"><label>Password</label><input type="password" id="gLoginPass" required></div>
            <div id="gLoginError" class="form-error"></div>
            <button type="submit" class="auth-btn">MASUK</button>
          </form>
          <p class="auth-link">Belum punya akun? <a href="#" id="gSwitchRegister">Daftar</a></p>
        </div>`;
      const form = document.getElementById('gLoginForm');
      if (form) form.onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('gLoginUser')?.value?.trim();
        const p = document.getElementById('gLoginPass')?.value;
        if (!u || !p) { document.getElementById('gLoginError').textContent = 'Isi semua field'; return; }
        const r = await api.post('/api/login', { username: u, password: p });
        if (r.error) { const err = document.getElementById('gLoginError'); if (err) err.textContent = r.error; return; }
        api.setToken(r.token);
        if (r.user && r.user.isAdmin) { window.location.href = '/admin.html'; return; }
        modal.style.display = 'none';
        _updateAuthUI(r.user);
        if (currentGame && currentGame._loadUser) currentGame._loadUser();
      };
      const sw = document.getElementById('gSwitchRegister');
      if (sw) sw.onclick = (e) => { e.preventDefault(); showAuthModal('register'); };
    }
  }

  const modalClose = document.getElementById('gameAuthModalClose');
  if (modalClose) modalClose.onclick = () => {
    const modal = document.getElementById('gameAuthModal');
    if (modal) modal.style.display = 'none';
  };

  function _updateAuthUI(user) {
    if (!gAuthArea || !gUserArea) return;
    if (user && user.username) {
      gAuthArea.style.display = 'none';
      gUserArea.style.display = 'flex';
      if (gUsername) gUsername.textContent = user.username;
      if (gBalance) gBalance.textContent = 'Rp' + (user.balance || 0).toLocaleString('id-ID');
    } else {
      gAuthArea.style.display = 'flex';
      gUserArea.style.display = 'none';
    }
  }

  // Load game module
  async function loadGameModule() {
    try {
      if (!container) { console.error('[GameLoader] No container'); return; }
      container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:rgba(180,160,220,0.5)"><div class="spinner"></div><p style="font-size:13px">Memuat game...</p></div>';

      // 1. Get game info
      const gameInfo = await api.get('/api/games/' + gameId);
      if (gameInfo.error || !gameInfo.enabled) {
        showError(gameInfo.error || 'Game tidak tersedia', 'Game tidak ditemukan atau dinonaktifkan');
        return;
      }
      if (gTitle) gTitle.textContent = gameInfo.name;

      // 2. Check auth status
      const user = await api.get('/api/user');
      if (!user.error && user.username) _updateAuthUI(user);

      // 3. Load game script
      const module = await loadScript(gameId);
      if (!module) {
        showComingSoon(gameId);
        return;
      }

      // 4. Get effective config
      let config = gameInfo.config || {};
      if (user && !user.error && user.username) {
        try {
          const effConfig = await api.get('/api/games/' + gameId + '/config');
          if (effConfig && !effConfig.error) config = effConfig;
        } catch(e) { console.warn('[GameLoader] Config fetch failed, using default'); }
      }

      // 5. Init game module
      currentGame = module;
      try {
        container.innerHTML = '';
        await module.init(container, config);
      } catch (e) {
        console.error('[GameLoader] Init error:', e);
        showError('Gagal memulai game', e.message || 'Terjadi error saat inisialisasi');
        return;
      }

      // 6. Periodic balance update
      if (api._token) {
        setInterval(async () => {
          if (currentGame && currentGame._loadUser) currentGame._loadUser();
        }, 10000);
      }
    } catch (e) {
      console.error('[GameLoader] Fatal:', e);
      showError('Fatal Error', e.message || 'Terjadi error yang tidak diketahui');
    }
  }

  // Load game script dynamically, returns module or null
  function loadScript(gameId) {
    return new Promise((resolve) => {
      try {
        // Check if already loaded
        if (window.__gameModules && window.__gameModules[gameId]) {
          resolve(window.__gameModules[gameId]);
          return;
        }

        const script = document.createElement('script');
        script.src = '/games/' + gameId + '/index.js';
        script.onload = () => {
          const mod = window.__gameModules ? window.__gameModules[gameId] : null;
          resolve(mod);
        };
        script.onerror = () => {
          console.error('[GameLoader] Script load failed:', gameId);
          resolve(null);
        };
        document.body.appendChild(script);
      } catch (e) {
        console.error('[GameLoader] Script error:', e);
        resolve(null);
      }
    });
  }

  // Back to lobby
  const backBtn = document.getElementById('backToLobby');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (currentGame && currentGame.destroy) currentGame.destroy();
    window.location.href = '/';
  });

  // Login button
  const loginBtn = document.getElementById('gLoginBtn');
  if (loginBtn) loginBtn.addEventListener('click', () => showAuthModal('login'));

  // WebSocket balance updates
  wsClient.on('balanceChanged', (data) => {
    if (currentGame && currentGame._loadUser) {
      currentGame._loadUser();
    }
  });

  // Start
  loadGameModule();
})();
