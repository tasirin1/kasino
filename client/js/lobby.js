/**
 * Casino Lobby — Main entry page
 */
document.addEventListener('DOMContentLoaded', async () => {
  const el = id => document.getElementById(id);

  const jackpotEl = el('lobbyJackpot');
  const onlineEl = el('lobbyOnline');
  const gridEl = el('gameGrid');
  const authArea = el('lobbyAuthArea');
  const profileArea = el('lobbyProfileArea');
  const balanceEl = el('lobbyBalance');
  const usernameEl = el('lobbyUsername');
  const loginBtn = el('lobbyLoginBtn');
  const registerBtn = el('lobbyRegisterBtn');
  const logoutBtn = el('lobbyLogoutBtn');
  const modal = el('authModal');
  const modalBody = el('authModalBody');
  const modalClose = el('authModalClose');
  const bannerTrack = el('bannerTrack');
  const bannerDots = el('bannerDots');
  const toast = el('toast');

  let bannerIdx = 0;
  let bannerTimer = null;

  const fmt = n => 'Rp' + (n ?? 0).toLocaleString('id-ID');

  // ===== TOAST =====
  function showToast(msg, type) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#C62828' : type === 'success' ? '#2E7D32' : '#1a0020';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  // ===== AUTH CHECK =====
  async function checkAuth() {
    const user = await api.get('/api/user');
    if (!user.error && user.username) {
      authArea.style.display = 'none';
      profileArea.style.display = 'flex';
      if (balanceEl) balanceEl.textContent = fmt(user.balance);
      if (usernameEl) usernameEl.textContent = user.username;
      return user;
    }
    authArea.style.display = 'flex';
    profileArea.style.display = 'none';
    return null;
  }

  // ===== AUTH MODAL =====
  function showAuthModal(formType) {
    modal.style.display = 'flex';
    if (formType === 'register') {
      modalBody.innerHTML = `
        <div class="auth-card-compact">
          <h2 class="auth-title">DAFTAR AKUN</h2>
          <form id="lRegForm">
            <div class="form-group"><label>Username</label><input type="text" id="lRegUser" required minlength="3"></div>
            <div class="form-group"><label>Password</label><input type="password" id="lRegPass" required minlength="4"></div>
            <div id="lRegError" class="form-error"></div>
            <button type="submit" class="auth-btn">DAFTAR</button>
          </form>
          <p class="auth-link">Sudah punya akun? <a href="#" id="lSwitchLogin">Masuk</a></p>
        </div>`;
      document.getElementById('lRegForm').onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('lRegUser').value.trim();
        const p = document.getElementById('lRegPass').value;
        const r = await api.post('/api/register', { username: u, password: p });
        if (r.error) { document.getElementById('lRegError').textContent = r.error; return; }
        api.setToken(r.token);
        modal.style.display = 'none';
        showToast('Registrasi berhasil! Selamat datang ' + u, 'success');
        checkAuth();
      };
      document.getElementById('lSwitchLogin').onclick = (e) => { e.preventDefault(); showAuthModal('login'); };
    } else {
      modalBody.innerHTML = `
        <div class="auth-card-compact">
          <h2 class="auth-title">MASUK</h2>
          <form id="lLoginForm">
            <div class="form-group"><label>Username</label><input type="text" id="lLoginUser" required></div>
            <div class="form-group"><label>Password</label><input type="password" id="lLoginPass" required></div>
            <div id="lLoginError" class="form-error"></div>
            <button type="submit" class="auth-btn">MASUK</button>
          </form>
          <p class="auth-link">Belum punya akun? <a href="#" id="lSwitchRegister">Daftar</a></p>
        </div>`;
      document.getElementById('lLoginForm').onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('lLoginUser').value.trim();
        const p = document.getElementById('lLoginPass').value;
        const r = await api.post('/api/login', { username: u, password: p });
        if (r.error) { document.getElementById('lLoginError').textContent = r.error; return; }
        api.setToken(r.token);
        modal.style.display = 'none';
        showToast('Selamat datang kembali, ' + u + '!', 'success');
        checkAuth();
      };
      document.getElementById('lSwitchRegister').onclick = (e) => { e.preventDefault(); showAuthModal('register'); };
    }
  }

  loginBtn.onclick = () => showAuthModal('login');
  registerBtn.onclick = () => showAuthModal('register');
  modalClose.onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  logoutBtn.onclick = () => {
    api.clearToken();
    showToast('Berhasil logout', 'success');
    checkAuth();
    location.reload();
  };

  // ===== BANNER CAROUSEL =====
  let slides = [];
  function initBanner() {
    slides = bannerTrack?.querySelectorAll('.banner-slide');
    if (!slides?.length) return;
    const dotsContainer = bannerDots;
    dotsContainer.innerHTML = '';
    for (let i = 0; i < slides.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'banner-dot' + (i === 0 ? ' active' : '');
      dot.dataset.idx = i;
      dot.onclick = () => goToBanner(i);
      dotsContainer.appendChild(dot);
    }
    startBannerAuto();
  }

  function goToBanner(idx) {
    if (!slides?.length) return;
    bannerIdx = idx;
    bannerTrack.style.transform = `translateX(-${idx * 100}%)`;
    document.querySelectorAll('.banner-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    startBannerAuto();
  }

  function startBannerAuto() {
    if (bannerTimer) clearInterval(bannerTimer);
    bannerTimer = setInterval(() => {
      goToBanner((bannerIdx + 1) % slides.length);
    }, 5000);
  }

  // ===== GAME GRID =====
  async function loadGames(category) {
    try {
      const data = await api.get('/api/games');
      if (data.error) { gridEl.innerHTML = '<p>Gagal memuat game</p>'; return; }

      const filtered = category === 'all' ? data : data.filter(g => g.category === category);

      if (filtered.length === 0) {
        gridEl.innerHTML = '<p class="empty-cat">Tidak ada game di kategori ini</p>';
        return;
      }

      gridEl.innerHTML = filtered.map(g => `
        <div class="game-card" data-game="${g.id}">
          <div class="game-card-thumb ${g.category}-thumb">
            <span class="game-card-icon">${g.category === 'slot' ? '🎰' : g.category === 'arcade' ? '🎮' : '🎯'}</span>
          </div>
          <div class="game-card-body">
            <h3 class="game-card-name">${g.name}</h3>
            <p class="game-card-desc">${g.description || ''}</p>
            <span class="game-card-cat">${g.category}</span>
          </div>
          <div class="game-card-footer">
            <span class="game-card-bet">${fmt(g.config?.minBet || 10)} - ${fmt(g.config?.maxBet || 10000)}</span>
            <a href="/play/${g.id}" class="game-card-play">MAIN</a>
          </div>
        </div>
      `).join('');

      // Add hover animation
      document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-4px)');
        card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');
      });
    } catch (e) {
      gridEl.innerHTML = '<p>Gagal memuat game</p>';
    }
  }

  // ===== TABS =====
  document.querySelectorAll('.lobby-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lobby-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadGames(tab.dataset.cat);
    });
  });

  // ===== LOBBY DATA =====
  async function loadLobbyData() {
    try {
      const data = await api.get('/api/lobby');
      if (data.error) return;
      if (jackpotEl) jackpotEl.textContent = '💰 ' + fmt(data.jackpot);
      if (onlineEl) onlineEl.textContent = '👥 ' + (data.onlineCount || 0) + ' online';
    } catch {}
  }

  // ===== WEBSOCKET =====
  wsClient.on('jackpotChanged', (data) => {
    if (jackpotEl) jackpotEl.textContent = '💰 ' + fmt(data.value);
  });
  wsClient.on('gamesUpdated', () => {
    const activeTab = document.querySelector('.lobby-tab.active');
    loadGames(activeTab?.dataset.cat || 'all');
  });
  wsClient.on('balanceChanged', (data) => {
    checkAuth();
  });

  // ===== INIT =====
  checkAuth();
  loadLobbyData();
  loadGames('all');
  initBanner();

  setInterval(loadLobbyData, 15000);
});
