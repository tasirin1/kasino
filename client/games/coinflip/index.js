/**
 * Coin Flip — Tebak kepala (Heads) atau ekor (Tails)
 */
const CoinFlip = {
  id: 'coinflip',
  name: 'Coin Flip',
  config: null,

  async init(container, config) {
    this.config = config;
    this.state = { balance: 0, bet: 100, spinning: false, username: null };
    container.innerHTML = `
      <div id="cfGame" class="cf-game">
        <div id="cfWinMsg" class="win-msg"><span id="cfWinText" class="win-text">Pilih Heads atau Tails!</span></div>
        <div id="cfCoin" class="cf-coin">
          <div class="cf-coin-face heads">👑</div>
          <div class="cf-coin-face tails">🦅</div>
        </div>
        <div class="cf-pick">
          <button id="cfPickHeads" class="cf-pick-btn heads-btn">👑 HEADS</button>
          <button id="cfPickTails" class="cf-pick-btn tails-btn">🦅 TAILS</button>
        </div>
        <div class="c-row c-top">
          <div class="bet-group">
            <button id="cfBetDown" class="bet-btn-sm">−</button>
            <div class="bet-display"><span class="bet-lbl">BET</span><span id="cfBetDisplay" class="bet-val">100</span></div>
            <button id="cfBetUp" class="bet-btn-sm">+</button>
          </div>
          <div class="win-group"><span class="win-lbl">WIN</span><span id="cfWinDisplay" class="win-val">—</span></div>
        </div>
      </div>`;
    this._bindEvents();
    this._loadUser();
  },

  _bindEvents() {
    document.getElementById('cfPickHeads')?.addEventListener('click', () => this.flip('heads'));
    document.getElementById('cfPickTails')?.addEventListener('click', () => this.flip('tails'));
    document.getElementById('cfBetDown')?.addEventListener('click', () => this._adjustBet(-50));
    document.getElementById('cfBetUp')?.addEventListener('click', () => this._adjustBet(50));
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
    const maxB = this.config?.maxBet || Math.min(this.state.balance, 10000);
    this.state.bet = Math.max(minB, Math.min(maxB, this.state.bet + delta));
    this._updateUI();
  },

  _updateUI() {
    const f = n => "Rp" + (n ?? 0).toLocaleString("id-ID");
    const bd = document.getElementById('cfBetDisplay');
    if (bd) bd.textContent = this.state.bet;
    const gb = document.getElementById('gBalance');
    if (gb) gb.textContent = f(this.state.balance);
  },

  _showMsg(text, color) {
    const el = document.getElementById('cfWinText');
    if (el) { el.textContent = text || ''; el.style.color = color || '#D5AD6D'; }
  },

  async flip(pick) {
    if (this.state.spinning) return;
    await this._loadUser();
    if (this.state.balance < this.state.bet) {
      this._showMsg('💸 SALDO TIDAK CUKUP', '#FF6B6B');
      return;
    }
    this.state.spinning = true;
    this.state.balance -= this.state.bet;
    this._updateUI();
    this._showMsg('🪙 Melempar koin...');
    document.querySelectorAll('.cf-pick-btn').forEach(b => b.disabled = true);

    // Coin flip animation
    const coin = document.getElementById('cfCoin');
    if (coin) {
      coin.classList.add('flipping');
      setTimeout(() => coin.classList.remove('flipping'), 800);
    }

    try {
      const result = await api.post('/api/spin', { bet: this.state.bet, gameId: 'coinflip', pick });
      if (result.error) {
        this.state.balance += this.state.bet;
        this._showMsg('⚠️ ' + result.error, '#FF6B6B');
        this.state.spinning = false;
        document.querySelectorAll('.cf-pick-btn').forEach(b => b.disabled = false);
        this._updateUI();
        return;
      }

      this.state.balance = result.balance;
      const won = result.win;
      const payout = result.payout || 0;

      // Wait for animation
      await new Promise(r => setTimeout(r, 800));

      if (won && payout > 0) {
        this._showMsg(`🎉 MENANG Rp${payout.toLocaleString("id-ID")}!`, '#4CAF50');
        const wd = document.getElementById('cfWinDisplay');
        if (wd) {
          wd.textContent = "Rp" + payout.toLocaleString("id-ID");
          wd.classList.add('flash');
          setTimeout(() => wd.classList.remove('flash'), 900);
        }
      } else {
        this._showMsg('😔 KALAH! Coba lagi', '#FF6B6B');
        const wd = document.getElementById('cfWinDisplay');
        if (wd) wd.textContent = '—';
      }
    } catch (e) {
      console.error('[CF Error]', e);
      this._showMsg('⚠️ ERROR', '#FF6B6B');
    }

    this.state.spinning = false;
    document.querySelectorAll('.cf-pick-btn').forEach(b => b.disabled = false);
    this._updateUI();
  },

  destroy() {
    const container = document.getElementById('gameCanvas');
    if (container) container.innerHTML = '';
  }
};

window.__gameModules = window.__gameModules || {};
window.__gameModules.coinflip = CoinFlip;
