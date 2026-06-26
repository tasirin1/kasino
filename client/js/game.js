/**
 * Kasino Slot — 3-reel real spinning slot machine
 * Architecture: ReelEngine + GameManager
 * Real transform: translateY animation with requestAnimationFrame
 */

// ========== SYMBOL RENDER DATA ==========
const SYM_RENDER = {
  JACKPOT:    { icon: '💰', bg: 'linear-gradient(135deg,#4a0030,#8b0060,#4a0030)', color: '#FFD700' },
  DIAMOND:    { icon: '💎', bg: 'linear-gradient(135deg,#003366,#0099FF,#003366)', color: '#00FFFF' },
  SEVEN:      { icon: '7',  bg: 'linear-gradient(135deg,#1a0000,#CC0000,#1a0000)', color: '#FF0000' },
  '3BAR':     { icon: 'Ⅲ', bg: 'linear-gradient(135deg,#1a1a2e,#444466,#1a1a2e)', color: '#FFFFFF' },
  '2BAR':     { icon: 'Ⅱ', bg: 'linear-gradient(135deg,#2a2a3e,#555577,#2a2a3e)', color: '#CCCCCC' },
  BAR:        { icon: 'Ⅰ', bg: 'linear-gradient(135deg,#3a3a4e,#666688,#3a3a4e)', color: '#AAAAAA' },
  BELL:       { icon: '🔔', bg: 'linear-gradient(135deg,#4a3000,#8B6800,#4a3000)', color: '#FFD700' },
  CHERRY:     { icon: '🍒', bg: 'linear-gradient(135deg,#660000,#CC0033,#660000)', color: '#FF6666' },
  LEMON:      { icon: '🍋', bg: 'linear-gradient(135deg,#3a5000,#8BB800,#3a5000)', color: '#FFFF66' },
  ORANGE:     { icon: '🍊', bg: 'linear-gradient(135deg,#803000,#FF6600,#803000)', color: '#FFCC66' },
  PLUM:       { icon: '🍑', bg: 'linear-gradient(135deg,#400060,#9900CC,#400060)', color: '#FF99CC' },
  GRAPES:     { icon: '🍇', bg: 'linear-gradient(135deg,#1a003a,#6600AA,#1a003a)', color: '#CC99FF' },
  WATERMELON: { icon: '🍉', bg: 'linear-gradient(135deg,#004D00,#00AA00,#004D00)', color: '#66FF66' },
};

const ALL_SYMS = Object.keys(SYM_RENDER);

function renderSym(id) { return SYM_RENDER[id] || SYM_RENDER.BAR; }

// ========== REEL ENGINE ==========
class ReelEngine {
  constructor(reelEl) {
    this.reelEl = reelEl;
    this.stripEl = null;
    this.symHeight = 50;
    this.totalSyms = 0;
    this._build();
    this._calcHeight();
  }

  _build() {
    this.reelEl.innerHTML = '';
    this.stripEl = document.createElement('div');
    this.stripEl.className = 'reel-strip';
    this.stripEl.style.cssText = 'position:absolute;left:0;right:0;top:0;will-change:transform;';
    this.reelEl.appendChild(this.stripEl);
  }

  _calcHeight() {
    const h = this.reelEl.clientHeight;
    if (h > 0) this.symHeight = h / 3;
  }

  loadStrip(symbols) {
    this.totalSyms = symbols.length;
    this.stripEl.innerHTML = '';
    const fs = Math.max(16, Math.min(38, this.symHeight * 0.5));

    for (const id of symbols) {
      const d = renderSym(id);
      const div = document.createElement('div');
      div.className = 'sym';
      div.textContent = d.icon;
      div.style.cssText = `height:${this.symHeight}px;font-size:${fs}px;background:${d.bg};color:${d.color};display:flex;align-items:center;justify-content:center;font-weight:800;text-shadow:0 2px 6px rgba(0,0,0,0.5);border-bottom:1px solid rgba(255,255,255,0.03)`;
      this.stripEl.appendChild(div);
    }
    this.stripEl.style.height = (this.totalSyms * this.symHeight) + 'px';
  }

  _buildSpinStrip(finalSyms, count = 25) {
    const s = [];
    for (let i = 0; i < count; i++) s.push(ALL_SYMS[Math.floor(Math.random() * ALL_SYMS.length)]);
    s.push(...finalSyms);
    return s;
  }

  spin(finalSyms, duration) {
    return new Promise(resolve => {
      if (!this.stripEl) { resolve(); return; }
      const strip = this._buildSpinStrip(finalSyms);
      this.loadStrip(strip);

      const stopIdx = this.totalSyms - 3;
      const stopOffset = -(stopIdx * this.symHeight);

      const startTime = performance.now();
      const animate = now => {
        const p = Math.min((now - startTime) / duration, 1);
        let eased;
        if (p < 0.55) {
          eased = (p / 0.55) * 0.88;
        } else {
          const d = (p - 0.55) / 0.45;
          eased = 0.88 + 0.12 * (1 - Math.pow(1 - d, 4));
        }
        eased = Math.min(eased, 1);
        this.stripEl.style.transform = `translateY(${(stopOffset) * eased}px)`;

        if (p < 1) {
          requestAnimationFrame(animate);
        } else {
          this.stripEl.style.transform = `translateY(${stopOffset}px)`;
          setTimeout(resolve, 50);
        }
      };
      requestAnimationFrame(animate);
    });
  }

  resize() { this._calcHeight(); }
}

// ========== GAME MANAGER ==========
class GameManager {
  constructor() {
    this.reels = [];
    this.state = {
      balance: 0,
      bet: 100,
      spinning: false,
      turbo: false,
      autoplay: false,
    };
    this.config = {};
    this.el = {};

    // Win highlighting
    this._hlCells = [];

    this._init();
  }

  _init() {
    this._cacheDOM();
    this._initReels();
    this._bindEvents();
    this._loadUser();

    // WebSocket listeners
    wsClient.on('configChanged', (data) => {
      if (data.config) this.config = data.config;
    });
    wsClient.on('balanceChanged', (data) => {
      if (data.balance !== undefined && data.balance >= 0) {
        if (!data.player || data.player === this.state.username) {
          this.state.balance = data.balance;
          this._updateUI();
        }
      }
    });
    wsClient.on('jackpotChanged', () => {});
    wsClient.on('settingsChanged', (data) => {
      if (data.username === this.state.username && data.settings) {
        this.state.settings = data.settings;
        this._updateUI();
      }
    });

    window.addEventListener('resize', () => {
      for (const r of this.reels) r.resize();
    });
  }

  _cacheDOM() {
    for (const id of ['balanceDisplay','betDisplay','betDisplay2','winDisplay',
      'winText','spinBtn','autoplay','turboMode','betDown','betUp','maxBet','logoutBtn']) {
      this.el[id] = document.getElementById(id);
    }
  }

  _initReels() {
    const els = document.querySelectorAll('.reel');
    for (const el of els) this.reels.push(new ReelEngine(el));
    // Initial display
    for (const r of this.reels) r.loadStrip(['BAR','BAR','BAR']);
  }

  _bindEvents() {
    this.el.spinBtn?.addEventListener('click', () => this.spin());
    this.el.betDown?.addEventListener('click', () => this._adjustBet(-50));
    this.el.betUp?.addEventListener('click', () => this._adjustBet(50));
    this.el.maxBet?.addEventListener('click', () => {
      this.state.bet = Math.min(10000, this.state.balance);
      this._updateUI();
    });
    this.el.autoplay?.addEventListener('change', () => {
      this.state.autoplay = this.el.autoplay.checked;
      if (this.state.autoplay && !this.state.spinning && this.state.balance >= this.state.bet) this.spin();
    });
    this.el.turboMode?.addEventListener('change', () => {
      this.state.turbo = this.el.turboMode.checked;
    });
    this.el.logoutBtn?.addEventListener('click', () => {
      api.clearToken();
      window.location.href = 'login.html';
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.state.spinning) { e.preventDefault(); this.spin(); }
    });
  }

  async _loadUser() {
    const user = await api.get('/api/user');
    if (user.error) { window.location.href = 'login.html'; return; }
    this.state.balance = user.balance;
    this.state.username = user.username;
    this.state.settings = user.settings || {};
    this._updateUI();
    this._showMsg('🎰 SPIN TO WIN');
  }

  _adjustBet(delta) {
    const s = this.state.settings || {};
    const minB = s.minBet || 10;
    const maxB = s.maxBet || Math.min(this.state.balance, 10000);
    this.state.bet = Math.max(minB, Math.min(maxB, this.state.bet + delta));
    this._updateUI();
  }

  _updateUI() {
    const f = n => "Rp" + (n ?? 0).toLocaleString("id-ID");
    if (this.el.balanceDisplay) this.el.balanceDisplay.textContent = f(this.state.balance);
    if (this.el.betDisplay) this.el.betDisplay.textContent = f(this.state.bet);
    if (this.el.betDisplay2) this.el.betDisplay2.textContent = f(this.state.bet);
  }

  _showMsg(text, color) {
    if (this.el.winText) { this.el.winText.textContent = text || ''; this.el.winText.style.color = color || '#D5AD6D'; }
  }

  _clearHighlights() {
    document.querySelectorAll('.sym.highlight').forEach(el => el.classList.remove('highlight'));
  }

  // ===== SPIN =====
  async spin() {
    if (this.state.spinning) return;
    if (this.state.balance < this.state.bet) {
      this._showMsg('💸 SALDO TIDAK CUKUP', '#FF6B6B');
      return;
    }

    this.state.spinning = true;
    this.state.balance -= this.state.bet;
    this._updateUI();
    this.el.spinBtn.disabled = true;
    this._clearHighlights();
    this.el.spinBtn.classList.add('pulse');
    setTimeout(() => this.el.spinBtn.classList.remove('pulse'), 300);

    this._showMsg('🎰 SPINNING!');

    try {
      // Call server spin API
      const result = await api.post('/api/spin', { bet: this.state.bet });
      if (result.error) {
        this.state.balance += this.state.bet;
        this._showMsg('⚠️ ' + result.error, '#FF6B6B');
        this.state.spinning = false;
        this.el.spinBtn.disabled = false;
        this._updateUI();
        return;
      }

      // Update balance from server
      this.state.balance = result.balance;

      // Spin reels simultaneously with staggered stop
      const turbo = this.state.turbo;
      const stagger = turbo ? 200 : 280;
      const baseDur = turbo ? 800 : 1200;
      const durations = [baseDur, baseDur + stagger, baseDur + stagger * 2];

      const promises = this.reels.map((reel, i) => reel.spin(result.grid[i], durations[i]));
      await Promise.all(promises);

      // Show win
      if (result.win && result.payout > 0) {
        this._showMsg(`🎉 WIN Rp${result.payout.toLocaleString("id-ID")}!`, '#FF6B6B');
        if (this.el.winDisplay) {
          this.el.winDisplay.textContent = "Rp" + result.payout.toLocaleString("id-ID");
          this.el.winDisplay.classList.add('flash');
          setTimeout(() => this.el.winDisplay.classList.remove('flash'), 900);
        }
        // Particle burst
        if (this.el.spinBtn) {
          const rect = this.el.spinBtn.getBoundingClientRect();
          this._burst(rect.left + rect.width/2, rect.top);
        }
      } else {
        this._showMsg('');
        if (this.el.winDisplay) this.el.winDisplay.textContent = '—';
      }
    } catch (e) {
      console.error('[Spin Error]', e);
      this._showMsg('⚠️ ERROR', '#FF6B6B');
    }

    this.state.spinning = false;
    this.el.spinBtn.disabled = false;
    this._updateUI();

    // Auto-spin
    if (this.state.autoplay && this.state.balance >= this.state.bet) {
      setTimeout(() => this.spin(), this.state.turbo ? 100 : 400);
    } else {
      if (this.el.autoplay) this.el.autoplay.checked = false;
      this.state.autoplay = false;
    }
  }

  _burst(x, y) {
    const container = document.getElementById('app');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 3 + Math.random() * 6;
      const color = ['#FFD700','#FF6B6B','#00FFFF','#FF66FF'][Math.floor(Math.random()*4)];
      p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};pointer-events:none;z-index:999;box-shadow:0 0 6px ${color}`;
      container.appendChild(p);
      const angle = (i/20)*Math.PI*2 + Math.random()*0.3;
      const dist = 30 + Math.random()*100;
      p.animate([
        {transform:'translate(0,0) scale(1)',opacity:1},
        {transform:`translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(0)`,opacity:0}
      ],{duration:600+Math.random()*400,easing:'ease-out'}).onfinish = () => p.remove();
    }
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  if (!api._token) { window.location.href = 'login.html'; return; }
  window.game = new GameManager();
});
