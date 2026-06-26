const api = {
  _token: localStorage.getItem('kasino_token'),

  setToken(t) {
    this._token = t;
    localStorage.setItem('kasino_token', t);
  },

  clearToken() {
    this._token = null;
    localStorage.removeItem('kasino_token');
  },

  async get(path) {
    const headers = { 'Accept': 'application/json' };
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;
    try {
      const r = await fetch(path, { headers });
      const data = await r.json();
      if (r.status === 401) { this.clearToken(); }
      return data;
    } catch { return { error: 'Connection failed' }; }
  },

  async put(path, body) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;
    try {
      const r = await fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) });
      return await r.json();
    } catch { return { error: 'Connection failed' }; }
  },

  async post(path, body) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;
    try {
      const r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await r.json();
      if (r.status === 401) { this.clearToken(); }
      return data;
    } catch { return { error: 'Connection failed' }; }
  },

  async del(path) {
    const headers = { 'Accept': 'application/json' };
    if (this._token) headers['Authorization'] = 'Bearer ' + this._token;
    try {
      const r = await fetch(path, { method: 'DELETE', headers });
      return await r.json();
    } catch { return { error: 'Connection failed' }; }
  },
};
