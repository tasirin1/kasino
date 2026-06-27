/**
 * Lucky Fruits — Fruit-themed slot machine
 * Reuses Classic777's ReelEngine
 */
const LuckyFruits = {
  id: 'luckyfruits',
  name: 'Lucky Fruits',
  config: null,

  async init(container, config) {
    this.config = config;

    wsClient.on('configChanged', (data) => {
      if (data.config) {
        this.config = { ...this.config, ...data.config };
        this._updateUI();
      }
    });
    // Same layout as classic777
    container.innerHTML = `
      <div id="c777">
        <div id="c777WinMsg" class="win-msg"><span id="c777WinText" class="win-text">🍇 LUCKY FRUITS</span></div>
        <div id="c777Reels" class="reels">
          <div class="reel" data-reel="0"></div>
          <div class="reel" data-reel="1"></div>
          <div class="reel" data-reel="2"></div>
        </div>
        <div id="c777Controls" class="controls">
          <div class="c-row c-top">
            <div class="bet-group">
              <button id="c777BetDown" class="bet-btn-sm">−</button>
              <div class="bet-display"><span class="bet-lbl">BET</span><span id="c777BetDisplay" class="bet-val">100</span></div>
              <button id="c777BetUp" class="bet-btn-sm">+</button>
            </div>
            <div class="win-group"><span class="win-lbl">WIN</span><span id="c777WinDisplay" class="win-val">—</span></div>
          </div>
          <div class="c-row c-bottom">
            <div class="ctrl-left">
              <label class="toggle-sm"><input type="checkbox" id="c777Auto"><span>AUTO</span></label>
              <label class="toggle-sm"><input type="checkbox" id="c777Turbo"><span>TURBO</span></label>
            </div>
            <button id="c777SpinBtn" class="spin-btn-lg">SPIN</button>
            <div class="ctrl-right"><button id="c777MaxBet" class="ctrl-btn-sm">MAX</button></div>
          </div>
        </div>
      </div>`;

    this.state = { balance: 0, bet: 100, spinning: false, autoplay: false, turbo: false, username: null };
    this.reels = [];
    this._initReels();
    this._bindEvents();
    this._loadUser();
  },

  _initReels() {
    const els = document.querySelectorAll('#c777Reels .reel');
    for (const el of els) this.reels.push(new ReelEngine(el));
    for (const r of this.reels) r.loadStrip(['CHERRY','CHERRY','CHERRY']);
  },

  _bindEvents() {
    document.getElementById('c777SpinBtn')?.addEventListener('click', () => this.spin());
    document.getElementById('c777BetDown')?.addEventListener('click', () => this._adjustBet(-50));
    document.getElementById('c777BetUp')?.addEventListener('click', () => this._adjustBet(50));
    document.getElementById('c777MaxBet')?.addEventListener('click', () => {
      this.state.bet = Math.min(this.config?.maxBet || 5000, this.state.balance);
      this._updateUI();
    });
    document.getElementById('c777Auto')?.addEventListener('change', () => {
      this.state.autoplay = document.getElementById('c777Auto').checked;
      if (this.state.autoplay && !this.state.spinning && this.state.balance >= this.state.bet) this.spin();
    });
    document.getElementById('c777Turbo')?.addEventListener('change', () => {
      this.state.turbo = document.getElementById('c777Turbo').checked;
    });
    window.addEventListener('resize', () => {
      for (const r of this.reels) if (r.resize) r.resize();
    });
  },

  async _loadUser() {
    const user = await api.get('/api/user');
    if (!user.error && user.balance !== undefined) {
      this.state.balance = user.balance;
      this.state.username = user.username;
      this._updateUI();
    }
  },

  _adjustBet(delta) {
    const minB = this.config?.minBet || 10;
    const maxB = this.config?.maxBet || Math.min(this.state.balance, 5000);
    this.state.bet = Math.max(minB, Math.min(maxB, this.state.bet + delta));
    this._updateUI();
  },

  _updateUI() {
    const f = n => "Rp" + (n ?? 0).toLocaleString("id-ID");
    const bd = document.getElementById('c777BetDisplay');
    if (bd) bd.textContent = this.state.bet;
    const gb = document.getElementById('gBalance');
    if (gb) gb.textContent = f(this.state.balance);
  },

  _showMsg(text, color) {
    const el = document.getElementById('c777WinText');
    if (el) { el.textContent = text || ''; el.style.color = color || '#4CAF50'; }
  },

  async spin() {
    if (this.state.spinning) return;
    await this._loadUser();
    if (this.state.balance < this.state.bet) {
      this._showMsg('💸 SALDO TIDAK CUKUP', '#FF6B6B');
      return;
    }
    this.state.spinning = true;
    this.state.balance -= this.state.bet;
    this._updateUI();
    document.getElementById('c777SpinBtn').disabled = true;
    document.querySelectorAll('#c777 .sym.highlight').forEach(el => el.classList.remove('highlight'));
    this._showMsg('🍇 SPINNING!');

    try {
      const result = await api.post('/api/spin', { bet: this.state.bet, gameId: 'luckyfruits' });
      if (result.error) {
        this.state.balance += this.state.bet;
        this._showMsg('⚠️ ' + result.error, '#FF6B6B');
        this.state.spinning = false;
        document.getElementById('c777SpinBtn').disabled = false;
        this._updateUI();
        return;
      }
      this.state.balance = result.balance;
      const turbo = this.state.turbo;
      const stagger = turbo ? 200 : 280;
      const baseDur = turbo ? 800 : 1200;
      const durations = [baseDur, baseDur + stagger, baseDur + stagger * 2];
      const promises = this.reels.map((reel, i) => reel.spin(result.grid[i], durations[i]));
      await Promise.all(promises);

      if (result.win && result.payout > 0) {
        this._showMsg(`🎉 WIN Rp${result.payout.toLocaleString("id-ID")}!`, '#FF6B6B');
        const wd = document.getElementById('c777WinDisplay');
        if (wd) {
          wd.textContent = "Rp" + result.payout.toLocaleString("id-ID");
          wd.classList.add('flash');
          setTimeout(() => wd.classList.remove('flash'), 900);
        }
      } else {
        this._showMsg('');
        const wd = document.getElementById('c777WinDisplay');
        if (wd) wd.textContent = '—';
      }
    } catch (e) {
      console.error('[LF Error]', e);
      this._showMsg('⚠️ ERROR', '#FF6B6B');
    }

    this.state.spinning = false;
    document.getElementById('c777SpinBtn').disabled = false;
    this._updateUI();
    if (this.state.autoplay && this.state.balance >= this.state.bet) {
      setTimeout(() => this.spin(), this.state.turbo ? 100 : 400);
    } else {
      const ap = document.getElementById('c777Auto');
      if (ap) ap.checked = false;
      this.state.autoplay = false;
    }
  },

  destroy() {
    const container = document.getElementById('gameCanvas');
    if (container) container.innerHTML = '';
  }
};

window.__gameModules = window.__gameModules || {};
window.__gameModules.luckyfruits = LuckyFruits;
