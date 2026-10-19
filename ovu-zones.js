/* Rhythme zones registry. New places register here as layouts in the room's own shape (plate, floor polygons, solids,
 * doors, hotspots with stand points) so the walk engine, camera, pets and prompts work in them unchanged, and the
 * mini-map gains a stop for each one. A zone is reachable by its doors; the registry only names it. */
(function (root) {
  'use strict';
  var R = root.OvuRoom, doc = root.document;
  var ZONES = [];
  function register(L, opts) {
    opts = opts || {};
    if (!L || !L.id) return;
    R.LAYOUTS[L.id] = L; ZONES.push({ id: L.id, label: opts.label || L.name, icon: opts.icon || 'map', after: opts.after || null });
    addStop(ZONES[ZONES.length - 1]);
  }
  /* the mini-map is built by the walk engine at boot; a registered zone adds its own stop after a named one */
  function addStop(z) {
    var mini = doc.getElementById('minimap'); if (!mini || mini.querySelector('[data-scene="' + z.id + '"]')) return;
    var ref = z.after ? mini.querySelector('[data-scene="' + z.after + '"]') : null, sample = mini.querySelector('[data-scene]');
    if (!sample) return;
    var b = sample.cloneNode(true); b.dataset.scene = z.id; b.classList.remove('on'); b.setAttribute('aria-label', z.label);
    var ms = b.querySelector('.ms'); if (ms) ms.textContent = z.icon;
    var txt = b.querySelector('i') || b.querySelector('span:not(.ms)'); if (txt) txt.textContent = z.label; else { Array.prototype.slice.call(b.childNodes).forEach(function (n) { if (n.nodeType === 3) n.textContent = z.label; }); } /* the walk engine's stops carry their word in an <i> */
    if (ref && ref.nextSibling) ref.parentNode.insertBefore(b, ref.nextSibling); else (ref ? ref.parentNode : sample.parentNode).appendChild(b);
  }
  function list() { return ZONES.slice(); }
  R.on('boot', function () { ZONES.forEach(addStop); });
  root.OvuZones = { register: register, list: list };
})(window);
