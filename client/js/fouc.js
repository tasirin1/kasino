/**
 * Anti-FOUC Manager — inline splash + smooth page transitions
 * 
 * The splash is embedded inline in every HTML page.
 * This script controls when to hide it and handles navigation.
 */
(function() {
  'use strict';

  function getSplash() {
    return document.getElementById('appSplash');
  }

  function hideSplash() {
    var splash = getSplash();
    if (!splash) {
      document.body.style.opacity = '1';
      return;
    }
    // Show body
    document.body.style.opacity = '1';
    // Fade splash out
    splash.style.opacity = '0';
    splash.style.transform = 'scale(0.95)';
    splash.style.pointerEvents = 'none';
    // Remove after animation
    setTimeout(function() {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 500);
  }

  function showSplash() {
    var splash = getSplash();
    if (!splash) {
      document.body.style.opacity = '0';
      return;
    }
    document.body.style.opacity = '0';
    splash.style.opacity = '1';
    splash.style.transform = 'scale(1)';
    splash.style.display = 'flex';
    splash.style.pointerEvents = 'auto';
  }

  // Intercept navigation for smooth transitions
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('/api/')) return;
    if (link.getAttribute('target') === '_blank') return;
    e.preventDefault();
    showSplash();
    setTimeout(function() { window.location.href = href; }, 150);
  });

  // Handle back/forward cache
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
      document.body.style.opacity = '1';
      var s = getSplash();
      if (s) { s.style.display = 'none'; s.parentNode.removeChild(s); }
    }
  });

  // Hide splash when page fully loads
  if (document.readyState === 'complete') {
    hideSplash();
  } else {
    window.addEventListener('load', hideSplash);
    // Fallback: force hide after 2s
    setTimeout(hideSplash, 2000);
  }
})();
