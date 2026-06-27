/**
 * Simple SPA Router with smooth page transitions.
 * Intercepts link clicks, loads pages via fetch,
 * applies fade/slide transitions, and preserves browser history.
 */
class AppRouter {
  constructor() {
    this.cache = {};
    this.isTransitioning = false;
    this.currentPath = window.location.pathname;
    this._init();
  }

  _init() {
    // Intercept all navigation clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (href.startsWith('/api/')) return;
      if (link.getAttribute('target') === '_blank') return;

      e.preventDefault();
      this.navigate(href);
    });

    // Intercept popstate (back/forward buttons)
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.path) {
        this._load(e.state.path, true);
      }
    });

    // Auto-navigate initial page
    const initialPath = window.location.pathname;
    if (initialPath !== '/' && initialPath !== '/lobby') {
      // Map old page paths to SPA routes
      this._load(initialPath, true);
    }
  }

  async navigate(path) {
    if (this.isTransitioning || path === this.currentPath) return;
    
    // Update browser history
    this.currentPath = path;
    window.history.pushState({ path }, '', path);

    await this._load(path, false);
  }

  async _load(path, isPopState) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const app = document.getElementById('app');
    if (!app) { this.isTransitioning = false; return; }

    try {
      // Show loading state
      this._showLoading(app);

      // Fetch content
      const response = await fetch(path);
      
      // Check if API response
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // API route — don't navigate
        this.isTransitioning = false;
        return;
      }

      const html = await response.text();
      
      // Extract page content from HTML
      const pageContent = this._extractContent(html, path);

      // Apply transition
      await this._transition(app, pageContent, path);

      // Re-init scripts for the new page
      this._reinitPage(path);

      // Update active nav links
      this._updateNav(path);

    } catch (e) {
      console.error('[Router] Navigation error:', e);
      app.innerHTML = '<div class="error-page"><h2>Error</h2><p>Halaman tidak dapat dimuat.</p><a href="/" class="btn">Kembali</a></div>';
    }

    this.isTransitioning = false;
  }

  _showLoading(app) {
    if (!app.querySelector('.spinner-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'spinner-overlay';
      overlay.innerHTML = '<div class="spinner"></div>';
      overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,0,8,0.8);z-index:9999;opacity:0;transition:opacity 0.2s';
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');
    }
  }

  _hideLoading() {
    const overlay = document.querySelector('.spinner-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }

  _extractContent(html, path) {
    // Extract <main> or #app content from fetched HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Try to find main content area
    let content = doc.querySelector('main') || doc.querySelector('#app') || doc.querySelector('.page-content') || doc.body;
    
    if (!content || content === doc.body) {
      // Fallback: use entire body content
      content = doc.body;
    }
    
    return content.innerHTML;
  }

  async _transition(app, content, path) {
    // Fade out current content
    app.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    app.style.opacity = '0';
    app.style.transform = 'translateY(8px)';
    
    await this._delay(150);
    
    // Replace content
    app.innerHTML = content;
    app.style.transform = 'translateY(-8px)';
    
    // Force reflow
    app.offsetHeight;
    
    // Fade in new content
    app.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    app.style.opacity = '1';
    app.style.transform = 'translateY(0)';
    
    await this._delay(200);
    
    // Clean up
    app.style.transition = '';
    app.style.transform = '';
    this._hideLoading();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  _reinitPage(path) {
    // Reload scripts for the current page
    // Use path to determine which scripts to init
    
    // Always re-init WebSocket
    if (typeof wsClient !== 'undefined' && wsClient.connect) {
      wsClient.connect();
    }

    // Re-init navigation
    if (typeof window.initNav === 'function') window.initNav();

    // Page-specific init based on path
    const page = path.split('?')[0].split('#')[0];
    if (page === '/' || page === '/lobby' || page === '') {
      if (typeof window.initLobby === 'function') window.initLobby();
    } else if (page === '/profile') {
      if (typeof window.initProfilePage === 'function') window.initProfilePage();
    } else if (page.startsWith('/play/')) {
      if (typeof window.initGamePage === 'function') window.initGamePage();
    } else if (page === '/admin') {
      if (typeof window.initAdmin === 'function') window.initAdmin();
    }
  }

  _updateNav(path) {
    document.querySelectorAll('.nav-link, .bottom-nav a, .menu-item').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === path || (path.startsWith(href + '/') && href !== '/'));
    });
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Init router on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.router = new AppRouter();
});
