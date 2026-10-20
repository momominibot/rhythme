/* ovu-deck.js: Today and the cards live in a pull-up drawer under the scene, so the game fills the screen (Jamie, 20 Oct).
 * The handle peeks above the nav with a one-line summary; a tap or an upward swipe opens it, a downward swipe or a tap
 * on the scene closes it. Escape closes it too. Nothing about the cards' own content changes. */
(function (root) {
  'use strict';
  var doc = root.document; if (!doc) return;
  function boot() {
    var deck = doc.getElementById('deck'), handle = doc.getElementById('deckHandle'), body = doc.getElementById('deckBody'), peek = doc.getElementById('deckPeek'), nav = doc.querySelector('.nav'), frame = doc.getElementById('frame');
    if (!deck || !handle || !body) return;
    function navH() { if (nav && frame) frame.style.setProperty('--navh', nav.offsetHeight + 'px'); }
    function set(open) { deck.classList.toggle('open', !!open); handle.setAttribute('aria-expanded', open ? 'true' : 'false'); if (!open) body.scrollTop = 0; }
    function isOpen() { return deck.classList.contains('open'); }
    /* the peek line: the first Today bullet, or the empty-day line */
    function summary() {
      var li = doc.querySelector('#dailyText li span:not(.ms)') || doc.querySelector('#dailyText li'), txt = li ? li.textContent : (doc.getElementById('dailyText') || {}).textContent || '';
      txt = String(txt).replace(/\s+/g, ' ').trim(); if (peek) peek.textContent = txt || 'Nothing logged yet';
    }
    handle.addEventListener('click', function () { set(!isOpen()); });
    var y0 = null, t0 = 0;
    handle.addEventListener('pointerdown', function (e) { y0 = e.clientY; t0 = Date.now(); });
    root.addEventListener('pointerup', function (e) { if (y0 === null) return; var dy = e.clientY - y0; y0 = null; if (Math.abs(dy) > 28 && Date.now() - t0 < 800) { set(dy < 0); e.preventDefault(); handle.dataset.swiped = '1'; setTimeout(function () { delete handle.dataset.swiped; }, 50); } });
    handle.addEventListener('click', function (e) { if (handle.dataset.swiped) { e.stopImmediatePropagation(); } }, true);
    /* a swipe down from the top of the open body closes it, like a sheet */
    var by0 = null; body.addEventListener('touchstart', function (e) { by0 = body.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    body.addEventListener('touchend', function (e) { if (by0 === null) return; var dy = e.changedTouches[0].clientY - by0; by0 = null; if (dy > 60) set(false); }, { passive: true });
    var scene = doc.getElementById('scene'); if (scene) scene.addEventListener('pointerdown', function () { if (isOpen()) set(false); }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) set(false); });
    /* anything that focuses or jumps into a card opens the drawer first */
    body.addEventListener('focusin', function () { if (!isOpen()) set(true); });
    var dt = doc.getElementById('dailyText'); if (dt && root.MutationObserver) new MutationObserver(summary).observe(dt, { childList: true, subtree: true, characterData: true });
    navH(); summary(); root.addEventListener('resize', navH);
    root.OvuDeck = { open: function () { set(true); }, close: function () { set(false); }, isOpen: isOpen };
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
