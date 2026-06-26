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

  // Auth modal
  function showAuthModal(formType) {
    const modal = document.getElementById('gameAuthModal');
    const body = document.getElementById('gameAuthModalBody');
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
      document.getElementById('gRegForm').onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('gRegUser').value.trim();
        const p = document.getElementById('gRegPass').value;
        const r = await api.post('/api/register', { username: u, password: p });
        if (r.error) { document.getElementById('gRegError').textContent = r.error; return; }
        api.setToken(r.token);
        modal.style.display = 'none';
        _updateAuthUI(r.user);
        if (currentGame && currentGame._loadUser) currentGame._loadUser();
      };
      document.getElementById('gSwitchLogin').onclick = (e) => { e.preventDefault(); showAuthModal('login'); };
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
      document.getElementById('gLoginForm').onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('gLoginUser').value.trim();
        const p = document.getElementById('gLoginPass').value;
        const r = await api.post('/api/login', { username: u, password: p });
        if (r.error) { document.getElementById('gLoginError').textContent = r.error; return; }
        api.setToken(r.token);
        modal.style.display = 'none';
        _updateAuthUI(r.user);
        if (currentGame && currentGame._loadUser) currentGame._loadUser();
      };
      document.getElementById('gSwitchRegister').onclick = (e) => { e.preventDefault(); showAuthModal('register'); };
    }
  }

  document.getElementById('gameAuthModalClose').onclick = () => {
    document.getElementById('gameAuthModal').style.display = 'none';
  };

  function _updateAuthUI(user) {
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

  // Load game config
  async function loadGameModule() {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Memuat game...</p></div>';

    try {
      // Get game info
      const gameInfo = await api.get('/api/games/' + gameId);
      if (gameInfo.error || !gameInfo.enabled) {
        container.innerHTML = `<div class="error-page"><h2>Game tidak tersedia</h2><p>${gameInfo.error || 'Game dinonaktifkan'}</p><a href="/" class="lobby-btn">Kembali ke Lobby</a></div>`;
        return;
      }

      if (gTitle) gTitle.textContent = gameInfo.name;

      // Check auth status
      const user = await api.get('/api/user');
      if (!user.error && user.username) {
        _updateAuthUI(user);
      }

      // Load game script dynamically
      const script = document.createElement('script');
      script.src = `/games/${gameId}/index.js`;
      script.onload = async () => {
        const module = window.__gameModules?.[gameId];
        if (!module) {
          container.innerHTML = `<div class="error-page"><h2>Module not found</h2><p>Game module ${gameId} tidak ditemukan</p></div>`;
          return;
        }

        // Get effective config
        let config = gameInfo.config || {};
        if (user && !user.error && user.username) {
          const effConfig = await api.get(`/api/games/${gameId}/config`);
          if (effConfig && !effConfig.error) config = effConfig;
        }

        currentGame = module;
        await module.init(container, config);

        // Update balance periodically if logged in
        if (api._token) {
          setInterval(async () => {
            if (currentGame && currentGame._loadUser) currentGame._loadUser();
          }, 10000);
        }
      };
      script.onerror = () => {
        container.innerHTML = `<div class="error-page"><h2>Error loading game</h2><p>Gagal memuat modul game</p></div>`;
      };
      document.body.appendChild(script);

    } catch (e) {
      console.error('[GameLoader]', e);
      container.innerHTML = `<div class="error-page"><h2>Error</h2><p>Gagal memuat game</p></div>`;
    }
  }

  // Back to lobby
  document.getElementById('backToLobby')?.addEventListener('click', () => {
    if (currentGame && currentGame.destroy) currentGame.destroy();
    window.location.href = '/';
  });

  // Login button
  document.getElementById('gLoginBtn')?.addEventListener('click', () => showAuthModal('login'));

  // WebSocket balance updates
  wsClient.on('balanceChanged', (data) => {
    if (data.player === api._token?.username) {
      if (currentGame && currentGame._loadUser) currentGame._loadUser();
    }
  });

  loadGameModule();
})();
