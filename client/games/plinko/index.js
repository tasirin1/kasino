/**
 * Plinko — Drop ball, win multiplier
 */
const PlinkoGame = {
  id: 'plinko',
  name: 'Plinko',
  config: null,

  async init(container, config) {
    this.config = config;

    wsClient.on('configChanged', (data) => {
      if (data.config) {
        this.config = { ...this.config, ...data.config };
      }
    });
    this.state = { balance: 0, bet: 100, spinning: false, username: null };
    container.innerHTML = `
      <div id="plinkoGame" class="plinko-game">
        <div id="plinkoWinMsg" class="win-msg"><span id="plinkoWinText" class="win-text">Pilih risiko & jatuhkan bola!</span></div>
        <div id="plinkoBoard" class="plinko-board">
          <canvas id="plinkoCanvas" width="320" height="400"></canvas>
        </div>
        <div class="plinko-risks">
          <button class="plinko-risk-btn active" data-risk="low">🟢 Low</button>
          <button class="plinko-risk-btn" data-risk="medium">🟡 Medium</button>
          <button class="plinko-risk-btn" data-risk="high">🔴 High</button>
        </div>
        <div class="c-row c-top">
          <div class="bet-group">
            <button id="plinkoBetDown" class="bet-btn-sm">−</button>
            <div class="bet-display"><span class="bet-lbl">BET</span><span id="plinkoBetDisplay" class="bet-val">100</span></div>
            <button id="plinkoBetUp" class="bet-btn-sm">+</button>
          </div>
          <button id="plinkoDropBtn" class="plinko-drop-btn">⬇ JATUHKAN</button>
        </div>
        <div class="win-group"><span class="win-lbl">WIN</span><span id="plinkoWinDisplay" class="win-val">—</span></div>
      </div>`;
    this.risk = 'medium';
    this._bindEvents();
    this._loadUser();
    this._initCanvas();
  },

  _bindEvents() {
    document.getElementById('plinkoDropBtn')?.addEventListener('click', () => this.drop());
    document.getElementById('plinkoBetDown')?.addEventListener('click', () => this._adjustBet(-50));
    document.getElementById('plinkoBetUp')?.addEventListener('click', () => this._adjustBet(50));
    document.querySelectorAll('.plinko-risk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.plinko-risk-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.risk = btn.dataset.risk;
      });
    });
  },

  _initCanvas() {
    this.canvas = document.getElementById('plinkoCanvas');
    this.ctx = this.canvas?.getContext('2d');
    if (!this.ctx) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = Math.min(rect.width - 20, 320);
    this.canvas.height = Math.min(rect.height - 10, 400);
    this._drawBoard();
  },

  _drawBoard() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, w, h);

    // Pins
    const cols = 8;
    const rows = 8;
    const spacingX = w / (cols + 1);
    const spacingY = h / (rows + 2);
    const pinRadius = 3;

    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 0 ? 0 : spacingX / 2;
      const count = row % 2 === 0 ? cols : cols - 1;
      for (let col = 0; col < count; col++) {
        const x = spacingX + col * spacingX + offset;
        const y = spacingY * (row + 1.5);
        ctx.beginPath();
        ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#D5AD6D';
        ctx.fill();
        ctx.shadowColor = '#D5AD6D';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Multiplier slots at bottom
    const multipliers = this._getMultipliers();
    const slotW = w / multipliers.length;
    for (let i = 0; i < multipliers.length; i++) {
      const x = i * slotW;
      const color = multipliers[i] >= 10 ? '#FF6B6B' : multipliers[i] >= 3 ? '#FFD700' : '#4CAF50';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, h - 30, slotW, 30);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(multipliers[i] + 'x', x + slotW/2, h - 12);
    }

    this._pinsX = spacingX;
    this._pinsY = spacingY;
  },

  _getMultipliers() {
    const riskMult = { low: 1, medium: 2, high: 3 };
    const base = [1, 2, 3, 5, 3, 2, 1];
    return base.map(m => m * (riskMult[this.risk] || 2));
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
    const bd = document.getElementById('plinkoBetDisplay');
    if (bd) bd.textContent = this.state.bet;
    const gb = document.getElementById('gBalance');
    if (gb) gb.textContent = f(this.state.balance);
  },

  _showMsg(text, color) {
    const el = document.getElementById('plinkoWinText');
    if (el) { el.textContent = text || ''; el.style.color = color || '#D5AD6D'; }
  },

  async drop() {
    if (this.state.spinning) return;
    await this._loadUser();
    if (this.state.balance < this.state.bet) {
      this._showMsg('💸 SALDO TIDAK CUKUP', '#FF6B6B');
      return;
    }

    this.state.spinning = true;
    this.state.balance -= this.state.bet;
    this._updateUI();
    document.getElementById('plinkoDropBtn').disabled = true;
    this._showMsg('⬇ Menjatuhkan bola...');

    try {
      const result = await api.post('/api/spin', {
        bet: this.state.bet,
        gameId: 'plinko',
        risk: this.risk,
      });

      if (result.error) {
        this.state.balance += this.state.bet;
        this._showMsg('⚠️ ' + result.error, '#FF6B6B');
        this.state.spinning = false;
        document.getElementById('plinkoDropBtn').disabled = false;
        this._updateUI();
        return;
      }

      this.state.balance = result.balance;
      const won = result.win;
      const payout = result.payout || 0;

      // Animate ball drop
      await this._animateBallDrop(result.slotIndex || 3);

      if (won && payout > 0) {
        this._showMsg(`🎉 MENANG Rp${payout.toLocaleString("id-ID")}!`, '#4CAF50');
        const wd = document.getElementById('plinkoWinDisplay');
        if (wd) {
          wd.textContent = "Rp" + payout.toLocaleString("id-ID");
          wd.classList.add('flash');
          setTimeout(() => wd.classList.remove('flash'), 900);
        }
      } else {
        this._showMsg('😔 Coba lagi!', '#FF6B6B');
        const wd = document.getElementById('plinkoWinDisplay');
        if (wd) wd.textContent = '—';
      }
    } catch (e) {
      console.error('[Plinko Error]', e);
      this._showMsg('⚠️ ERROR', '#FF6B6B');
    }

    this.state.spinning = false;
    document.getElementById('plinkoDropBtn').disabled = false;
    this._updateUI();
  },

  _animateBallDrop(targetSlot) {
    return new Promise(resolve => {
      if (!this.ctx) { resolve(); return; }
      const w = this.canvas.width;
      const h = this.canvas.height;
      const steps = 30;
      let step = 0;
      const ballX = (targetSlot + 0.5) * (w / (this._getMultipliers().length || 8));
      const ballY = 30;

      const anim = () => {
        step++;
        this._drawBoard();
        const progress = step / steps;
        const y = ballY + progress * (h - 60);
        const wobble = Math.sin(progress * 20) * 8;
        const x = ballX + wobble;

        this.ctx.beginPath();
        this.ctx.arc(x, y, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 15;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        if (step < steps) {
          requestAnimationFrame(anim);
        } else {
          // Flash landing
          const slotW = w / this._getMultipliers().length;
          this.ctx.fillStyle = '#FFD700';
          this.ctx.globalAlpha = 0.5;
          this.ctx.fillRect(targetSlot * slotW, h - 30, slotW, 30);
          this.ctx.globalAlpha = 1;
          setTimeout(resolve, 200);
        }
      };
      anim();
    });
  },

  destroy() {
    const container = document.getElementById('gameCanvas');
    if (container) container.innerHTML = '';
  }
};

window.__gameModules = window.__gameModules || {};
window.__gameModules.plinko = PlinkoGame;
