/* ══════════════════════════════════════════════════════════════
   RHYTHME · Dark Mode + Font Size Controller
   Self-injects a sun/moon theme toggle and Aa font size toggle
   into .top on every page.
   Persists preferences in localStorage.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Theme ── */
  var THEME_KEY = 'ovuluna_theme';
  var currentTheme = 'light';

  try {
    var savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      currentTheme = savedTheme;
    }
  } catch (e) {}

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    var toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Use light theme' : 'Use dark theme');
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  applyTheme(currentTheme);

  /* ── Font Size ── */
  var FONT_KEY = 'ovuluna_fontsize';
  // Only scale UP from default — no smaller-than-default option
  var FONT_LEVELS = ['medium', 'large', 'xlarge'];
  var FONT_SCALES = { medium: 1.0, large: 1.15, xlarge: 1.3 };
  var FONT_LABELS = { medium: 'A', large: 'A+', xlarge: 'A++' };
  var FONT_TITLES = { medium: 'Normal size', large: 'Large size', xlarge: 'Extra large size' };
  var currentFontSize = 'medium';
  // Capture the browser's default once, before applying the saved preference.
  var baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  var scheduleShellMeasure = function () {};

  try {
    var savedFont = localStorage.getItem(FONT_KEY);
    if (FONT_LEVELS.indexOf(savedFont) !== -1) {
      currentFontSize = savedFont;
    }
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
    try { localStorage.setItem(FONT_KEY, level); } catch (e) {}

    // Update toggle button label and title
    var btn = document.querySelector('.font-toggle .ft-label');
    if (btn) btn.textContent = FONT_LABELS[level];
    var toggleBtn = document.querySelector('.font-toggle');
    if (toggleBtn) {
      var next = FONT_LEVELS[(FONT_LEVELS.indexOf(level) + 1) % FONT_LEVELS.length];
      var description = 'Text size: ' + FONT_TITLES[level] + ' (' + Math.round(scale * 100) + '%). Activate for ' + FONT_TITLES[next].toLowerCase() + '.';
      toggleBtn.setAttribute('title', description);
      toggleBtn.setAttribute('aria-label', description);
    }
    scheduleShellMeasure();
  }

  applyFontSize(currentFontSize);

  /* ── Build starfield overlay (dark mode) ── */
  function buildStars() {
    if (document.querySelector('.dark-stars')) return;
    var stars = document.createElement('div');
    stars.className = 'dark-stars';
    stars.setAttribute('aria-hidden', 'true');
    var count = 60;
    for (var i = 0; i < count; i++) {
      var s = document.createElement('i');
      var seed = (i * 9301 + 49297) % 233280;
      var x = (seed / 233280) * 100;
      var seed2 = (i * 4096 + 150889) % 714025;
      var y = (seed2 / 714025) * 100;
      var delay = ((i * 0.37) % 3).toFixed(2);
      var dur = (2.5 + (i % 5) * 0.5).toFixed(1);
      s.style.left = x + '%';
      s.style.top = y + '%';
      s.style.animationDelay = delay + 's';
      s.style.animationDuration = dur + 's';
      stars.appendChild(s);
    }
    document.body.appendChild(stars);
  }

  /* ── Build theme toggle button ── */
  function buildThemeToggle() {
    var top = document.querySelector('.top');
    if (!top) return;
    if (top.querySelector('.theme-toggle')) return;

    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.setAttribute('title', 'Toggle dark mode');

    var sun = document.createElement('span');
    sun.className = 'tt-sun';
    sun.textContent = '\u2600\uFE0F';

    sun.setAttribute('aria-hidden', 'true');
    var moon = document.createElement('span');
    moon.className = 'tt-moon';
    moon.textContent = '\uD83C\uDF19';

    moon.setAttribute('aria-hidden', 'true');
    btn.appendChild(sun);
    btn.appendChild(moon);

    btn.addEventListener('click', function () {
      var next = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    top.appendChild(btn);
  }

  /* ── Build font size toggle button ── */
  function buildFontToggle() {
    var top = document.querySelector('.top');
    if (!top) return;
    if (top.querySelector('.font-toggle')) return;

    var btn = document.createElement('button');
    btn.className = 'font-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Adjust font size');
    btn.setAttribute('title', 'Adjust font size');

    var label = document.createElement('span');
    label.className = 'ft-label';
    label.textContent = FONT_LABELS[currentFontSize];
    label.style.fontFamily = 'var(--serif, Newsreader, serif)';
    label.style.fontWeight = '700';
    label.style.fontSize = '14px';

    btn.appendChild(label);

    btn.addEventListener('click', function () {
      var idx = FONT_LEVELS.indexOf(currentFontSize);
      var next = FONT_LEVELS[(idx + 1) % FONT_LEVELS.length];
      applyFontSize(next);
    });

    top.appendChild(btn);
  }

  /* ── Inject toggle CSS ── */
  function injectToggleCSS() {
    if (document.getElementById('ovuluna-toggle-css')) return;
    var style = document.createElement('style');
    style.id = 'ovuluna-toggle-css';
    style.textContent = [
      '.theme-toggle, .font-toggle {',
      '  width: 44px; height: 44px; min-width: 44px; min-height: 44px; border-radius: 12px;',
      '  display: flex; align-items: center; justify-content: center;',
      '  background: var(--card, #fff); border: 2px solid var(--ink, #3d2f52);',
      '  cursor: pointer; padding: 0; flex-shrink: 0; touch-action: manipulation;',
      '  transition: transform 0.1s, background 0.2s;',
      '  pointer-events: auto; z-index: 100; position: relative;',
      '}',
      '.theme-toggle:hover, .font-toggle:hover { opacity: 0.85; }',
      '.theme-toggle:active, .font-toggle:active { transform: scale(0.92); }',
      '.theme-toggle .tt-sun, .theme-toggle .tt-moon {',
      '  font-size: 18px; line-height: 1;',
      '}',
      '[data-theme="light"] .theme-toggle .tt-moon { display: none; }',
      '[data-theme="dark"] .theme-toggle .tt-sun { display: none; }',
      '.font-toggle .ft-label {',
      '  color: var(--ink, #3d2f52);',
      '  letter-spacing: -0.02em;',
      '}',
      '.dark-stars {',
      '  position: fixed; inset: 0; pointer-events: none; z-index: 0;',
      '  overflow: hidden; opacity: 0; transition: opacity 0.5s;',
      '}',
      '[data-theme="dark"] .dark-stars { opacity: 1; }',
      '.dark-stars i {',
      '  position: absolute; width: 2px; height: 2px; border-radius: 50%;',
      '  background: #fff; opacity: 0.6;',
      '  animation: twinkle 3s ease-in-out infinite;',
      '}',
      '@keyframes twinkle {',
      '  0%, 100% { opacity: 0.2; }',
      '  50% { opacity: 0.9; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

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
    injectToggleCSS();
    buildStars();
    buildThemeToggle();
    buildFontToggle();
    applyTheme(currentTheme);
    applyFontSize(currentFontSize);
    manageShell();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
