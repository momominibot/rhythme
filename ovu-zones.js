/* Rhythme zones registry. New places register here as layouts in the room's own shape (plate, floor polygons, solids,
 * doors, hotspots with stand points) so the walk engine, camera, pets and prompts work in them unchanged. A zone is
 * reachable only by its doors (there are no place shortcuts, Jamie 20 Oct); the map (ovu-map.js) finds it by walking the
 * doors from home, so the registry only names it. */
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
  function addStop() { } /* the old place shortcut bar is gone; kept so a zone file written for it still loads */
  function list() { return ZONES.slice(); }
  R.on('boot', function () { ZONES.forEach(addStop); });
  root.OvuZones = { register: register, list: list };
})(window);
