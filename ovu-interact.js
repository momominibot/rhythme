/* Rhythme proximity prompts. When she stands near something she can use, a small pill rises above her head
 * ("Tap to water", "Tap to sit a while") and an action button sits at the scene's lower right; either one does what a
 * tap on the object would do. Tapping objects directly keeps working. The pill reads the layout's own hotspots, so new
 * zones get prompts for free; a hotspot can give its own verb with `prompt`. */
(function (root) {
  'use strict';
  var R = root.OvuRoom, W = root.OvuWalk, doc = root.document;
  var NEAR = 9; /* iso units: about one stride and a half */
  var pill, btn, current = null, timer = 0, actors = {};
  function iso(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) / 0.5); }
  function verb(h) {
    if (h.prompt) return h.prompt;
    var parts = String(h.label || '').split(' · ');
    var v = parts[1] ? parts[1].trim() : parts[0].trim();
    v = v.replace(/^(open|tap|see)\s+/i, '');
    v = v.charAt(0).toLowerCase() + v.slice(1);
    if (/^back\b/.test(v)) v = 'go ' + v; /* "back to the street" reads as "Tap to go back to the street" */
    return 'Tap to ' + v;
  }
  /* the nearest hotspot of a layout to a point, by its stand point when it has one; null when none is within reach */
  function nearest(pos, hotspots, near) {
    var best = null, bd = (near || NEAR);
    (hotspots || []).forEach(function (h) {
      var at = h.wp || h; if (!isFinite(at.x) || !isFinite(at.y)) return;
      var d = iso(pos, at); if (d < bd) { bd = d; best = h; }
    });
    return best;
  }
  /* anything that should keep the prompt down: a sheet, a session or practice HUD, a walk or a journey, a visit, sitting */
  function blocked() {
    return doc.hidden || R.busy() || R.visiting() || (W && W.walking && W.walking()) || (W && W.travelling && W.travelling()) ||
      R.els.avatar.classList.contains('walking') || R.els.scene.classList.contains('sitting') || (R.els.hud && R.els.hud.classList.contains('on'));
  }
  function candidates(L) { return (L.hotspots || []).concat(L.prompts || []); }
  function build() {
    var scene = R.els.scene;
    pill = doc.createElement('div'); pill.className = 'nearpill'; pill.id = 'interactPrompt'; pill.setAttribute('aria-hidden', 'true');
    btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'actbtn'; btn.id = 'actBtn'; btn.hidden = true; btn.disabled = true; btn.innerHTML = '<span class="ms" aria-hidden="true">touch_app</span>';
    scene.appendChild(pill); scene.appendChild(btn);
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!current || blocked()) return hide();
      var L = R.layout(), h = L && nearest(R.pos(), candidates(L)); /* re-check at the moment of the tap: she may have moved, a sheet may have opened */
      if (!h || h !== current) return hide();
      hide();
      if (h.bed || h.actor) { var fn = actors[h.actor || (L && L.id)]; if (fn) fn(h); return; }
      R.tap(h);
    });
  }
  function hide() { current = null; pill.classList.remove('on'); btn.classList.remove('on'); btn.hidden = true; btn.disabled = true; }
  function place() {
    var a = R.els.avatar.getBoundingClientRect(), s = R.els.scene.getBoundingClientRect();
    pill.style.left = (a.left + a.width / 2 - s.left) + 'px'; pill.style.top = (a.top - s.top - 6) + 'px';
  }
  function tick() {
    if (!pill) return;
    var L = R.layout(); if (!L || blocked()) return hide();
    var h = nearest(R.pos(), candidates(L));
    if (!h) return hide();
    if (!h.bed && !h.actor && !doc.querySelector('.hotspot[data-id="' + h.id + '"]')) return hide();
    if (h !== current) { current = h; pill.textContent = verb(h); btn.setAttribute('aria-label', verb(h)); }
    place(); pill.classList.add('on'); btn.classList.add('on'); btn.hidden = false; btn.disabled = false;
  }
  function mount() {
    build();
    timer = root.setInterval(tick, 250);
    R.on('walk', function () { hide(); });
    R.on('beforeWalk', function () { hide(); });
    R.on('layout', function () { hide(); });
  }
  R.on('boot', mount);
  /* a zone's own prompts (not hotspots) name an actor: setActor('farm', fn) answers 'Tap to tend the bed' for that zone */
  root.OvuInteract = { NEAR: NEAR, nearest: nearest, verb: verb, blocked: blocked, current: function () { return current; }, tick: tick, setActor: function (id, fn) { actors[id] = fn; } };
})(window);
