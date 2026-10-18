/**
 * Rhythme Shared Layout Injector
 * Injects canonical header and bottom nav into every page.
 * This ensures 100% consistency across all 80+ pages.
 * Usage: add <div id="app-header"></div> and <div id="app-nav"></div> to any page,
 *        then include <script src="app-layout.js"></script> before </body>.
 */
(function() {
  'use strict';

  // Get current page filename for active nav state
  const currentPage = window.location.pathname.split('/').pop() || 'home.html';

  // Persona from localStorage
  function getPersona() {
    try {
      return localStorage.getItem('ovuluna_persona') || 'grow';
    } catch(e) { return 'grow'; }
  }

  // Canonical header HTML
  function renderHeader() {
    const persona = getPersona();
    const personaNames = { grow: 'Grow', nurture: 'Nurture', wisdom: 'Wisdom' };
    return `
    <div class="top" id="app-top-bar">
      <div class="brandline" style="cursor:pointer" onclick="window.location.href='home.html'"><b style="font-family:var(--serif);font-weight:600;font-size:17px;letter-spacing:.18em;color:var(--mauve)">RHYTHME</b></div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="t-icon" id="app-font-toggle" title="Adjust font size" style="background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:var(--cocoa);font-size:16px;font-weight:700" onclick="window.cycleFontSize && window.cycleFontSize()">A</button>
        <button class="t-icon" id="app-theme-toggle" title="Toggle dark mode" style="background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:var(--cocoa);font-size:16px" onclick="window.toggleDarkMode && window.toggleDarkMode()"><span class="ms" style="font-size:18px">dark_mode</span></button>
        <a class="t-icon ms" href="notifications.html" title="Notifications" style="text-decoration:none;color:var(--cocoa);padding:6px">notifications</a>
        <a class="t-icon ms" href="cycle-trends.html" title="Cycle calendar" style="text-decoration:none;color:var(--cocoa);padding:6px">calendar_today</a>
      </div>
    </div>`;
  }

  // Canonical nav HTML
  function renderNav() {
    const items = [
      { href: 'home.html', icon: 'home', label: 'Home' },
      { href: 'cycle-home.html', icon: 'cycle', label: 'Cycle' },
      { href: 'food-journal.html', icon: 'restaurant', label: 'Food' },
      { href: 'mindfulness.html', icon: 'self_improvement', label: 'Mind' },
      { href: 'profile.html', icon: 'person', label: 'You' }
    ];
    return `<nav class="nav">` + items.map(item => {
      const active = currentPage === item.href ? ' class="active"' : '';
      return `<a href="${item.href}"${active}><span class="n-ic">${item.icon}</span>${item.label}</a>`;
    }).join('') + `</nav>`;
  }

  // Inject into placeholders
  function inject() {
    const headerPlaceholder = document.getElementById('app-header');
    const navPlaceholder = document.getElementById('app-nav');

    if (headerPlaceholder) {
      headerPlaceholder.outerHTML = renderHeader();
    }
    if (navPlaceholder) {
      navPlaceholder.outerHTML = renderNav();
    }

    // Update theme toggle icon based on current theme
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const toggle = document.getElementById('app-theme-toggle');
    if (!toggle) return;
    const isDark = document.documentElement.classList.contains('dark') ||
                    document.body.classList.contains('dark') ||
                    localStorage.getItem('ovuluna_theme') === 'dark';
    const span = toggle.querySelector('.ms');
    if (span) span.textContent = isDark ? 'light_mode' : 'dark_mode';
  }

  // Font size cycling
  if (!window.cycleFontSize) {
    const fontSizes = ['100%', '112%', '125%'];
    let fontIndex = 0;
    try {
      const saved = localStorage.getItem('ovuluna_font_size');
      if (saved) {
        fontIndex = Math.max(0, fontSizes.indexOf(saved));
        document.documentElement.style.fontSize = saved;
      }
    } catch(e) {}
    window.cycleFontSize = function() {
      fontIndex = (fontIndex + 1) % fontSizes.length;
      const size = fontSizes[fontIndex];
      document.documentElement.style.fontSize = size;
      try { localStorage.setItem('ovuluna_font_size', size); } catch(e) {}
    };
  }

  // Dark mode toggle
  if (!window.toggleDarkMode) {
    window.toggleDarkMode = function() {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        try { localStorage.setItem('ovuluna_theme', 'light'); } catch(e) {}
      } else {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        try { localStorage.setItem('ovuluna_theme', 'dark'); } catch(e) {}
      }
      updateThemeIcon();
    };
  }

  // Apply saved theme on load
  try {
    if (localStorage.getItem('ovuluna_theme') === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }
    const savedFont = localStorage.getItem('ovuluna_font_size');
    if (savedFont) {
      document.documentElement.style.fontSize = savedFont;
    }
  } catch(e) {}

  // Run injection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
