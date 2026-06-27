/**
 * Navigation helper with smooth page transitions.
 * Adds fade-in animation on page load.
 */
(function() {
  'use strict';

  // Fade in on page load
  document.addEventListener('DOMContentLoaded', function() {
    const app = document.getElementById('app') || document.querySelector('main') || document.body;
    if (app) {
      app.classList.add('page-transition');
    }

    // Intercept internal links for smooth navigation
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (href.startsWith('/api/')) return;
      if (link.getAttribute('target') === '_blank') return;

      // For game links, allow direct navigation
      // For other internal links, just let the browser navigate naturally
      // The CSS animation will handle the fade effect
    });

    // Fix for browser back/forward — re-trigger animation
    window.addEventListener('pageshow', function(e) {
      if (e.persisted) {
        const app = document.getElementById('app') || document.querySelector('main') || document.body;
        if (app) {
          app.classList.remove('page-transition');
          void app.offsetWidth;
          app.classList.add('page-transition');
        }
      }
    });
  });

  // Register page-specific initializers
  window.initPage = function(pageName, fn) {
    if (!window._pageInits) window._pageInits = {};
    window._pageInits[pageName] = fn;
  };

  // Expose navigation helper
  window.nav = {
    go: function(path) {
      // Fade out current page
      const app = document.getElementById('app') || document.querySelector('main') || document.body;
      if (app) {
        app.style.animation = 'pageFadeOut 0.15s ease forwards';
        setTimeout(function() {
          window.location.href = path;
        }, 150);
      } else {
        window.location.href = path;
      }
    }
  };
})();
