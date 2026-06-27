/**
 * Anti-FOUC (Flash of Unstyled Content) Manager
 * 
 * - Hides body until CSS + critical assets are loaded
 * - Shows a casino-themed splash screen immediately
 * - Controls page transitions (smooth fade/slide)
 * - Works on all browsers including old Android
 * 
 * Must be loaded as FIRST script in <head>.
 */
(function() {
  'use strict';

  // ===== SPLASH SCREEN =====
  // Create splash overlay immediately — no waiting
  function createSplash() {
    const existing = document.getElementById('appSplash');
    if (existing) return existing;

    const splash = document.createElement('div');
    splash.id = 'appSplash';
    splash.innerHTML = [
      '<div class="splash-inner">',
      '  <div class="splash-icon">🎰</div>',
      '  <div class="splash-title">SLOTCASINO</div>',
      '  <div class="splash-sub">Tasirin</div>',
      '  <div class="splash-spinner"><div class="splash-bar"></div></div>',
      '</div>'
    ].join('\n');
    document.body.prepend(splash);
    return splash;
  }

  // Hide splash with fade-out animation
  function hideSplash() {
    const splash = document.getElementById('appSplash');
    if (!splash) return;

    // First show body content
    document.body.style.opacity = '1';
    
    // Fade out splash
    splash.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    splash.style.opacity = '0';
    splash.style.transform = 'scale(0.95)';
    
    // Remove splash after animation
    setTimeout(() => {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
      document.body.classList.remove('fouc-hidden');
      
      // Trigger page entrance animation
      const main = document.querySelector('main, #app, .page-content, .lobby-wrapper');
      if (main) {
        main.classList.add('page-enter');
        setTimeout(() => main.classList.remove('page-enter'), 400);
      }
    }, 500);
  }

  // Show splash (for navigation)
  function showSplash() {
    // Hide body content
    document.body.style.opacity = '0';
    
    // Create and show splash
    const splash = createSplash();
    splash.style.opacity = '1';
    splash.style.transform = 'scale(1)';
    splash.style.display = 'flex';
    
    return splash;
  }

  // ===== NAVIGATION =====
  // Intercept all internal link clicks for smooth transitions
  function initNavigation() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (href.startsWith('/api/')) return;
      if (link.getAttribute('target') === '_blank') return;

      e.preventDefault();
      
      // Show splash before navigating
      showSplash();
      
      // Navigate after a brief delay for splash to show
      setTimeout(function() {
        window.location.href = href;
      }, 200);
    });
  }

  // ===== PAGE VISIBILITY =====
  // Handle back/forward cache
  function initPageVisibility() {
    window.addEventListener('pageshow', function(e) {
      // If page is loaded from bfcache (back/forward)
      if (e.persisted || document.getElementById('appSplash')) {
        document.body.style.opacity = '1';
        hideSplash();
      }
    });
  }

  // ===== INIT =====
  // Phase 1: Immediately create splash (runs sync in <head>)
  function init() {
    // Show body, create splash
    document.body.style.cssText = 'opacity:0;background:#050008;margin:0;padding:0;overflow-x:hidden';
    createSplash();

    // Phase 2: Wait for full page load
    if (document.readyState === 'complete') {
      hideSplash();
    } else {
      window.addEventListener('load', hideSplash);
      // Fallback: if takes too long, hide after 3s
      setTimeout(hideSplash, 3000);
    }

    // Phase 3: Init navigation after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNavigation);
      document.addEventListener('DOMContentLoaded', initPageVisibility);
    } else {
      initNavigation();
      initPageVisibility();
    }
  }

  // Run
  init();
})();
