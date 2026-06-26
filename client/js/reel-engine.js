/**
 * ReelEngine — 3-reel real spinning slot machine
 * Extracted from game.js for reuse in modular games
 */
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
