/**
 * WebSocket client for real-time config sync
 */
const wsClient = {
  ws: null,
  reconnectTimer: null,
  reconnectAttempts: 0,

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      return this._scheduleReconnect();
    }

    this.ws.onopen = () => { this.reconnectAttempts = 0; };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this._handle(data);
      } catch {}
    };
    this.ws.onclose = () => { if (!this._closed) this._scheduleReconnect(); };
    this.ws.onerror = () => {};
  },

  _closed: false,
  disconnect() { this._closed = true; if (this.ws) { try { this.ws.close(); } catch {} } },

  _scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 5000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  },

  _listeners: {},
  on(type, fn) { if (!this._listeners[type]) this._listeners[type] = []; this._listeners[type].push(fn); },
  off(type, fn) { if (!this._listeners[type]) return; this._listeners[type] = this._listeners[type].filter(f => f !== fn); },

  _handle(data) {
    const handlers = this._listeners[data.type] || [];
    for (const fn of handlers) fn(data);
    // 'configChanged' also triggers generic 'config' handler
    if (data.type === 'configChanged' && this._listeners['config']) {
      for (const fn of this._listeners['config']) fn(data.config);
    }
  },
};

// Auto-connect
document.addEventListener('DOMContentLoaded', () => wsClient.connect());
