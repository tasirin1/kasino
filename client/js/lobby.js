/**
 * Premium Casino Lobby
 */
document.addEventListener('DOMContentLoaded', () => {
  // ===== HELPERS =====
  const $ = id => document.getElementById(id);
  const fmt = n => (n ?? 0).toLocaleString('id-ID');
  const rupiah = n => 'Rp' + fmt(n);

  // ===== DOM CACHE =====
  const jackpotVal = $('lJackpotVal');
  const jackpotBar = $('lJackpotBar');
  const onlineCount = $('lOnlineCount');
  const totalGames = $('lTotalGames');
  const guestArea = $('lGuestArea');
  const userArea = $('lUserArea');
  const balanceVal = $('lBalanceVal');
  const avatar = $('lAvatar');
  const loginBtn = $('lLoginBtn');
  const registerBtn = $('lRegisterBtn');
  const grid = $('gameGrid');
  const modal = $('authModal');
  const modalBody = $('authModalBody');
  const modalClose = $('authModalClose');
  const heroTrack = $('heroTrack');
  const heroDots = $('heroDots');
  const particles = $('particles');

  let heroIdx = 0;
  let heroTimer = null;
  let slides = [];

  // ===== PARTICLES =====
  function initParticles() {
    if (!particles) return;
    const count = 30;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'l-particle';
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const size = 1 + Math.random() * 3;
      const delay = Math.random() * 5;
      const dur = 3 + Math.random() * 4;
      p.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s`;
      particles.appendChild(p);
    }
  }

  // ===== HERO BANNER =====
  function initHero() {
    slides = heroTrack?.querySelectorAll('.l-hero-slide');
    if (!slides?.length) return;
    heroDots.innerHTML = '';
    for (let i = 0; i < slides.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'l-hero-dot' + (i === 0 ? ' active' : '');
      dot.dataset.idx = i;
      dot.addEventListener('click', () => goHero(i));
      heroDots.appendChild(dot);
    }
    startHeroAuto();
  }

  function goHero(idx) {
    if (!slides?.length) return;
    heroIdx = idx;
    heroTrack.style.transform = `translateX(-${idx * 100}%)`;
    document.querySelectorAll('.l-hero-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    startHeroAuto();
  }

  function startHeroAuto() {
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => {
      goHero((heroIdx + 1) % slides.length);
    }, 5000);
  }

  // ===== AUTH =====
  async function checkAuth() {
    const user = await api.get('/api/user');
    if (!user.error && user.username) {
      guestArea.style.display = 'none';
      userArea.style.display = 'flex';
      balanceVal.textContent = fmt(user.balance);
      return user;
    }
    guestArea.style.display = 'flex';
    userArea.style.display = 'none';
    return null;
  }

  function showAuthModal(type) {
    modal.style.display = 'flex';
    if (type === 'register') {
      modalBody.innerHTML = `
        <div class="l-auth-card">
          <div class="l-auth-logo">🎰</div>
          <h2 class="l-auth-title">Daftar Akun</h2>
          <form id="lRegForm">
            <div class="l-input-group">
              <label>Username</label>
              <input type="text" id="lRegUser" required minlength="3" placeholder="Buat username">
            </div>
            <div class="l-input-group">
              <label>Password</label>
              <input type="password" id="lRegPass" required minlength="4" placeholder="Buat password">
            </div>
            <div id="lRegError" class="l-form-err"></div>
            <button type="submit" class="l-btn l-btn-gold l-btn-full">Daftar</button>
          </form>
          <p class="l-auth-link">Sudah punya akun? <a href="#" id="lSwitchLogin">Masuk</a></p>
        </div>`;
      document.getElementById('lRegForm').onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('lRegUser').value.trim();
        const p = document.getElementById('lRegPass').value;
        const r = await api.post('/api/register', { username: u, password: p });
        if (r.error) { document.getElementById('lRegError').textContent = r.error; return; }
        api.setToken(r.token);
        modal.style.display = 'none';
        showToast('🎉 Selamat datang ' + u + '!');
        checkAuth(); loadLobbyData();
      };
      document.getElementById('lSwitchLogin').onclick = (e) => { e.preventDefault(); showAuthModal('login'); };
    } else {
      modalBody.innerHTML = `
        <div class="l-auth-card">
          <div class="l-auth-logo">🎰</div>
          <h2 class="l-auth-title">Masuk</h2>
          <form id="lLoginForm">
            <div class="l-input-group">
              <label>Username</label>
              <input type="text" id="lLoginUser" required placeholder="Masukkan username">
            </div>
            <div class="l-input-group">
              <label>Password</label>
              <input type="password" id="lLoginPass" required placeholder="Masukkan password">
            </div>
            <div id="lLoginError" class="l-form-err"></div>
            <button type="submit" class="l-btn l-btn-gold l-btn-full">Masuk</button>
          </form>
          <p class="l-auth-link">Belum punya akun? <a href="#" id="lSwitchRegister">Daftar</a></p>
        </div>`;
      document.getElementById('lLoginForm').onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('lLoginUser').value.trim();
        const p = document.getElementById('lLoginPass').value;
        const r = await api.post('/api/login', { username: u, password: p });
        if (r.error) { document.getElementById('lLoginError').textContent = r.error; return; }
        api.setToken(r.token);
        modal.style.display = 'none';
        showToast('👋 Selamat datang kembali!');
        checkAuth(); loadLobbyData();
      };
      document.getElementById('lSwitchRegister').onclick = (e) => { e.preventDefault(); showAuthModal('register'); };
    }
  }

  loginBtn?.addEventListener('click', () => showAuthModal('login'));
  registerBtn?.addEventListener('click', () => showAuthModal('register'));
  modalClose?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // ===== TOAST =====
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'l-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    t.style.animation = 'toastIn 0.3s ease';
    setTimeout(() => {
      t.style.animation = 'toastOut 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, 2500);
  }

  // ===== GAME GRID =====
  async function loadGames(cat) {
    try {
      const data = await api.get('/api/games');
      if (data.error) { grid.innerHTML = '<div class="l-empty">Gagal memuat game</div>'; return; }

      const filtered = cat === 'all' ? data : data.filter(g => g.category === cat);
      if (filtered.length === 0) {
        grid.innerHTML = '<div class="l-empty">Tidak ada game di kategori ini</div>';
        return;
      }

      grid.innerHTML = filtered.map(g => {
        const badge = g.badge ? `<span class="l-game-badge l-badge-${g.badge.toLowerCase()}">${g.badge}</span>` : '';
        const minB = rupiah(g.config?.minBet || 10);
        const maxB = rupiah(g.config?.maxBet || 10000);
        return `
        <div class="l-game" data-game="${g.id}">
          <div class="l-game-thumb" style="background-image:url('${g.thumbnail || ''}')">
            ${badge}
            <div class="l-game-thumb-overlay">
              <a href="/play/${g.id}" class="l-game-play-btn">Main</a>
            </div>
          </div>
          <div class="l-game-info">
            <h3 class="l-game-name">${g.name}</h3>
            <span class="l-game-provider">${g.provider || 'SlotCasino'}</span>
            <div class="l-game-meta">
              <span class="l-game-rtp">RTP ${g.rtp || 97}%</span>
              <span class="l-game-bet">${minB} - ${maxB}</span>
            </div>
          </div>
        </div>`;
      }).join('');

      // Entrance animation
      document.querySelectorAll('.l-game').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
          card.style.transition = 'all 0.4s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 60);
      });
    } catch { grid.innerHTML = '<div class="l-empty">Error loading games</div>'; }
  }

  // ===== CATEGORY TABS =====
  document.querySelectorAll('.l-cat').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.l-cat').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadGames(tab.dataset.cat);
    });
  });

  // ===== LOBBY DATA =====
  async function loadLobbyData() {
    try {
      const data = await api.get('/api/lobby');
      if (data.error) return;
      const jp = rupiah(data.jackpot);
      if (jackpotVal) jackpotVal.textContent = jp;
      if (jackpotBar) jackpotBar.textContent = jp;
      if (onlineCount) onlineCount.textContent = data.onlineCount || 0;
      if (totalGames) totalGames.textContent = data.totalGames || 0;
    } catch {}
  }

  // ===== WEBSOCKET =====
  wsClient.on('jackpotChanged', (data) => {
    const jp = rupiah(data.value);
    if (jackpotVal) jackpotVal.textContent = jp;
    if (jackpotBar) jackpotBar.textContent = jp;
  });
  wsClient.on('gamesUpdated', () => {
    const active = document.querySelector('.l-cat.active');
    loadGames(active?.dataset.cat || 'all');
  });
  wsClient.on('balanceChanged', () => checkAuth());

  // ===== BOTTOM NAV =====
  // Wallet navigates to game page, Profile shows auth modal
  document.getElementById('navWallet')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (api._token) showWalletModal();
    else showAuthModal('login');
  });
  document.getElementById('navProfile')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (api._token) showProfileModal();
    else showAuthModal('login');
  });
  document.getElementById('navPromo')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('🎁 Promo akan segera hadir!');
  });
  document.getElementById('navGames')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.l-grid')?.scrollIntoView({ behavior: 'smooth' });
  });

  // ===== PROFILE MODAL =====
  async function showProfileModal() {
    const user = await api.get('/api/user');
    if (user.error) { showAuthModal('login'); return; }
    modal.style.display = 'flex';
    modalBody.innerHTML = `
      <div class="l-auth-card" style="text-align:center">
        <div style="font-size:48px;margin-bottom:8px">👤</div>
        <h2 class="l-auth-title" style="font-size:16px">${user.username}</h2>
        <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0">
          <div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
            <span style="color:rgba(180,160,220,0.5);font-size:12px">Saldo</span>
            <span style="color:#4CAF50;font-weight:700;font-size:14px">Rp${(user.balance||0).toLocaleString('id-ID')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
            <span style="color:rgba(180,160,220,0.5);font-size:12px">Total Spin</span>
            <span style="color:#D5AD6D;font-weight:700;font-size:14px">${user.totalSpins||0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
            <span style="color:rgba(180,160,220,0.5);font-size:12px">Menang</span>
            <span style="color:#FF6B6B;font-weight:700;font-size:14px">${user.totalWins||0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
            <span style="color:rgba(180,160,220,0.5);font-size:12px">Total Taruhan</span>
            <span style="color:#FFD700;font-weight:700;font-size:14px">Rp${(user.totalBet||0).toLocaleString('id-ID')}</span>
          </div>
        </div>
        <button class="l-btn l-btn-gold l-btn-full" onclick="document.getElementById('authModal').style.display='none'">Tutup</button>
      </div>`;
  }

  // ===== WALLET MODAL =====
  async function showWalletModal() {
    const user = await api.get('/api/user');
    if (user.error) { showAuthModal('login'); return; }
    modal.style.display = 'flex';
    modalBody.innerHTML = `
      <div class="l-auth-card" style="text-align:center">
        <div style="font-size:48px;margin-bottom:8px">💰</div>
        <h2 class="l-auth-title" style="font-size:16px">Dompet</h2>
        <div style="background:linear-gradient(135deg,rgba(213,173,109,0.1),rgba(184,134,11,0.1));border-radius:12px;padding:16px;margin:12px 0">
          <div style="font-size:10px;color:rgba(180,160,220,0.4);margin-bottom:4px">SALDO SAAT INI</div>
          <div style="font-size:28px;font-weight:800;color:#D5AD6D">Rp${(user.balance||0).toLocaleString('id-ID')}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <a href="/play/classic777" class="l-btn l-btn-gold" style="flex:1;text-align:center;text-decoration:none;font-size:12px">Main</a>
          <button class="l-btn l-btn-outline" style="flex:1;font-size:12px" onclick="document.getElementById('authModal').style.display='none'">Tutup</button>
        </div>
      </div>`;
  }

  // ===== INIT =====
  initParticles();
  initHero();
  checkAuth();
  loadLobbyData();
  loadGames('all');

  // Refresh every 15s
  setInterval(loadLobbyData, 15000);
});
