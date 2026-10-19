/* Rhythme game HUD: one small pill in screen space (outside the camera's plate) with the day, the season and the hour,
 * a stamina bar, and the zone's name for two seconds whenever she arrives somewhere. Hearts already live in the top
 * bar's chip, so they are not repeated here. Hidden during Erin's sessions and practices, which have their own HUD. */
(function (root) {
  'use strict';
  var R = root.OvuRoom, GT = root.OvuGameTime, ST = root.OvuStamina, doc = root.document;
  var hud, bar, dayEl, zone, zoneTimer = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function build() {
    var scene = R.els.scene;
    hud = doc.createElement('div'); hud.className = 'gamehud'; hud.id = 'gameHud'; hud.setAttribute('role', 'status'); hud.setAttribute('aria-live', 'off');
    hud.innerHTML = '<span class="gh-day" id="ghDay"></span><span class="gh-stam" title="Energy"><span class="ms">bolt</span><i id="ghBar"><b></b></i></span>';
    zone = doc.createElement('div'); zone.className = 'zonename'; zone.id = 'zoneName'; zone.setAttribute('aria-live', 'polite');
    scene.appendChild(hud); scene.appendChild(zone);
    bar = hud.querySelector('#ghBar b'); dayEl = hud.querySelector('#ghDay');
  }
  function render() {
    if (!hud) return;
    /* season and hour on the pill; the count of days played goes in the title and the label, so "Day 1" never sits beside the cycle's "Day 2" chip */
    var sn = GT ? GT.season() : 'spring', ic = GT ? GT.ICONS[sn] : 'bolt', season = sn.charAt(0).toUpperCase() + sn.slice(1), hr = GT ? GT.hourLabel() : '', n = GT ? GT.day() : 1;
    dayEl.innerHTML = '<span class="ms" aria-hidden="true">' + esc(ic) + '</span>' + esc(season) + ' <small>' + esc(hr) + '</small>';
    hud.title = season + ', day ' + n + ' of play, ' + hr;
    var v = ST ? ST.value() : 100, max = ST ? ST.MAX : 100;
    bar.style.width = Math.round(100 * v / max) + '%'; hud.classList.toggle('low', ST ? ST.low() : false);
    hud.setAttribute('aria-label', hud.title + ', energy ' + Math.round(100 * v / max) + ' of 100');
    hud.classList.toggle('hidden', !!(R.sessionOn && R.sessionOn()) || R.els.scene.classList.contains('arranging') || !!(R.els.hud && R.els.hud.classList.contains('on')));
  }
  function showZone(L) {
    if (!zone || !L) return;
    zone.textContent = L.name || ''; zone.classList.add('on');
    root.clearTimeout(zoneTimer); zoneTimer = root.setTimeout(function () { zone.classList.remove('on'); }, 2000);
  }
  function mount() {
    build(); render();
    R.on('layout', function (L) { render(); showZone(L); });
    if (ST && ST.onChange) ST.onChange(render);
    if (GT && GT.onNewDay) GT.onNewDay(render);
    root.setInterval(function () { if (!doc.hidden) render(); }, 30000);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) render(); });
    root.addEventListener('pageshow', render);
    if (R.els.hud && root.MutationObserver) new MutationObserver(render).observe(R.els.hud, { attributes: true, attributeFilter: ['class'] });
    if (root.MutationObserver) new MutationObserver(render).observe(R.els.scene, { attributes: true, attributeFilter: ['class'] });
  }
  R.on('boot', mount);
  root.OvuHud = { render: render, showZone: showZone };
})(window);
