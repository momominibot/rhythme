/* ══════════════════════════════════════════════════════════════
   RHYTHME · light theme and text size for the older pages
   Since 22 Oct 2026 these pages wear the room's light palette only
   (the room has no night colours), and their text size follows the
   room's one setting (You > Text size, profile.textSize), so there is
   no theme button and no separate A button any more.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Theme: light only ── */
  var THEME_KEY = 'ovuluna_theme';

  /* a dark choice saved by the old theme button is not honoured: one light look everywhere */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', 'light');
    try { localStorage.setItem(THEME_KEY, 'light'); } catch (e) {}
  }

  applyTheme();

  /* ── Font Size ── */
  var FONT_SCALES = { medium: 1.0, large: 1.12, xlarge: 1.25 }; /* the room's Large and Larger (ovu-textsize.js) */
  var ROOM_LEVEL = { 'default': 'medium', large: 'large', larger: 'xlarge' };
  var currentFontSize = 'medium';
  // Capture the browser's default once, before applying the saved preference.
  var baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  var scheduleShellMeasure = function () {};

  /* the room's Text size, read from the diary's profile on this phone */
  try {
    var db = JSON.parse(localStorage.getItem('ovumind_db_v1') || 'null'), ts = db && db.profile && db.profile.textSize;
    if (ROOM_LEVEL[ts]) currentFontSize = ROOM_LEVEL[ts];
  } catch (e) {}

  function applyFontSize(level) {
    currentFontSize = level;
    var scale = FONT_SCALES[level] || 1.0;
    var root = document.documentElement;
    var remPage = document.body && document.body.matches('.text-scaled-page, .home-page, .bio-age-page');
    root.setAttribute('data-font-mode', remPage ? 'rem' : 'legacy');
    root.style.setProperty('--shell-text-scale', String(scale));
    root.style.setProperty('--shell-base-font-size', baseFontSize + 'px');
    // Clear the old inline zoom. The mode-specific CSS owns the one content scale.
    document.querySelectorAll('.app > .scroll, .app > .content').forEach(function (content) { content.style.removeProperty('zoom'); });
    root.style.fontSize = (baseFontSize * scale) + 'px';
    document.documentElement.setAttribute('data-fontsize', level);

    scheduleShellMeasure();
  }

  applyFontSize(currentFontSize);

  /* Measure fixed bars after responsive wrapping, safe-area and font changes.
     ResizeObserver observes geometry, not scroll, so this does not run per frame. */
  function manageShell() {
    var root = document.documentElement;
    var app = document.querySelector('.app');
    if (!app) return;
    var top = document.querySelector('.top');
    var nav = document.querySelector('.nav, .bottom-nav');
    if (top) {
      var iconLabels = { 'notifications.html': 'Notifications', 'cycle-trends.html': 'Cycle calendar' };
      top.querySelectorAll('a').forEach(function (link) {
        var label = iconLabels[link.getAttribute('href')];
        if (label && !link.hasAttribute('aria-label')) link.setAttribute('aria-label', label);
      });
    }
    var pending = false;
    function measure() {
      pending = false;
      top = document.querySelector('.top'); nav = document.querySelector('.nav, .bottom-nav'); /* appnav.js may add the tab bar after this first ran */
      var topSize = top ? Math.ceil(top.getBoundingClientRect().height) : 0;
      var bottomSize = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0;
      if (root.style.getPropertyValue('--shell-top-size') !== topSize + 'px') root.style.setProperty('--shell-top-size', topSize + 'px');
      if (root.style.getPropertyValue('--shell-bottom-size') !== bottomSize + 'px') root.style.setProperty('--shell-bottom-size', bottomSize + 'px');
      root.setAttribute('data-shell-ready', 'true');
    }
    scheduleShellMeasure = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(measure);
    };
    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(scheduleShellMeasure);
      // Safe-area changes alter padding even when the content box is unchanged.
      if (top) observer.observe(top, { box: 'border-box' });
      if (nav) observer.observe(nav, { box: 'border-box' });
    }
    window.addEventListener('resize', scheduleShellMeasure, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleShellMeasure, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleShellMeasure);
    measure();
  }

  /* ── Boot ── */
  function init() {
    applyTheme();
    applyFontSize(currentFontSize);
    manageShell();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
