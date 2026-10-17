/* Ovumind — shared app logic: bottom nav, storage, cycle calc */
(function() {
  'use strict';

  const PAGES = {
    room: { label: 'Room', icon: 'home', url: 'room.html' },
    cycle: { label: 'Cycle', icon: 'water_drop', url: 'cycle.html' },
    food: { label: 'Food', icon: 'restaurant', url: 'food.html' },
    mind: { label: 'Mind', icon: 'self_improvement', url: 'mind.html' },
    you: { label: 'You', icon: 'person', url: 'you.html' }
  };

  function currentPage() {
    const p = location.pathname.split('/').pop().replace('.html', '');
    return PAGES[p] ? p : 'room';
  }

  function injectNav() {
    if (document.getElementById('ovumind-nav')) return;
    const page = currentPage();
    const nav = document.createElement('nav');
    nav.id = 'ovumind-nav';
    nav.innerHTML = Object.entries(PAGES).map(([key, p]) => {
      const active = key === page ? ' active' : '';
      const center = key === 'room' ? ' center' : '';
      return `<a href="${p.url}" class="nav-item${active}${center}">
        <span class="material-symbols-outlined">${p.icon}</span>
        <span>${p.label}</span>
      </a>`;
    }).join('');
    document.body.appendChild(nav);
  }

  // Storage helpers
  const Store = {
    get(key, def) {
      try { const v = localStorage.getItem('ovumind_' + key); return v ? JSON.parse(v) : def; }
      catch { return def; }
    },
    set(key, val) { localStorage.setItem('ovumind_' + key, JSON.stringify(val)); },
    has(key) { return localStorage.getItem('ovumind_' + key) !== null; }
  };

  // Cycle calculations
  const Cycle = {
    getLastPeriod() {
      const d = Store.get('last_period', null);
      return d ? new Date(d) : null;
    },
    getCycleLength() { return Store.get('cycle_length', 28); },
    getPeriodLength() { return Store.get('period_length', 5); },

    getPhase(date) {
      const last = this.getLastPeriod();
      if (!last) return 'unknown';
      const len = this.getCycleLength();
      const day = Math.floor((date - last) / 86400000) + 1;
      if (day <= this.getPeriodLength()) return 'menstrual';
      if (day <= len - 14) return 'follicular';
      if (day <= len - 12) return 'ovulation';
      return 'luteal';
    },

    getNextPeriod() {
      const last = this.getLastPeriod();
      if (!last) return null;
      const next = new Date(last);
      next.setDate(next.getDate() + this.getCycleLength());
      return next;
    },

    getOvulationDay() {
      const last = this.getLastPeriod();
      if (!last) return null;
      const ov = new Date(last);
      ov.setDate(ov.getDate() + this.getCycleLength() - 14);
      return ov;
    },

    daysUntil(date) {
      if (!date) return null;
      const today = new Date(); today.setHours(0,0,0,0);
      const target = new Date(date); target.setHours(0,0,0,0);
      return Math.ceil((target - today) / 86400000);
    }
  };

  // Onboarding check
  function checkOnboarding() {
    if (!Store.has('onboarding_complete') && location.pathname.indexOf('onboarding') === -1) {
      location.href = 'onboarding.html';
    }
  }

  // Material icons
  function ensureIcons() {
    if (!document.querySelector('link[href*="material-symbols"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0';
      document.head.appendChild(link);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureIcons();
    injectNav();
  });

  window.Ovumind = { Store, Cycle, checkOnboarding, PAGES };
})();
