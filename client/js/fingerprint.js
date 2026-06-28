/**
 * Device Fingerprint Generator
 * Generates a unique device fingerprint for anti-abuse tracking.
 */
(function() {
  'use strict';

  function getDeviceId() {
    let id = localStorage.getItem('kasino_device_id');
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('kasino_device_id', id);
    }
    return id;
  }

  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('SlotCasinoTasirin', 10, 10);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('FP', 150, 30);
      return canvas.toDataURL().split('').reduce(function(a, c) {
        return ((a << 5) - a) + c.charCodeAt(0) | 0;
      }, 0).toString(36);
    } catch(e) {
      return 'canvas_unavailable';
    }
  }

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate a device fingerprint string.
   * Combines multiple browser characteristics into a stable-ish hash.
   */
  window.getDeviceFingerprint = function() {
    var components = [
      navigator.userAgent,
      navigator.language || navigator.userLanguage || '',
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      navigator.platform || '',
      getCanvasFingerprint(),
      getDeviceId()
    ];
    return simpleHash(components.join('|||'));
  };
})();
