/* Every page follows the sun: html[data-sky] is set here before first paint, so night pages open dark and
 * calm and day pages open light (ovu-night.css reads it). The room refines it with OvuSun's real sunrise
 * and sunset; other pages use the hour: night from 6 pm to half past six, sunrise until half past seven. */
(function () {
  function key() {
    try { if (window.OvuSun && OvuSun.phase) return OvuSun.phase().key; } catch (e) { }
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 18 || h < 6.5 ? 'night' : h < 7.5 ? 'sunrise' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'sunset';
  }
  function apply(k) { k = k || key(); var el = document.documentElement; if (el.getAttribute('data-sky') !== k) el.setAttribute('data-sky', k); return k; }
  apply();
  setInterval(function () { apply(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  window.OvuSky = { apply: apply, key: key };
})();
