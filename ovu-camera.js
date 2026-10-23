/* ovu-camera.js: the camera follows her. The scene box is a window onto the plate; as she walks, the window keeps her
 * near its middle, with a dead zone so a small move leaves the view still and exponential smoothing so the view never
 * jumps. Every scene opens with the whole plate in view (zoom 1, every hotspot a tap away; Jamie, 19 Oct). A drag, a pinch or a double tap takes the camera over until
 * her next walk; + and − zoom about her; fit shows the whole scene. It only drives the transform room.js already keeps
 * on #sceneInner, so taps, hotspots and props never need to know the camera moved. The HUD, the visit bar, the top bar,
 * the greeting, the phase chip and the hint are lifted out of the plate into the box at mount, so the window never crops them.
 * Design, sources and the review outcomes: docs/design/2026-10-19-follow-camera.md. A wide plate (L.span box widths, the
 * street) is followed at any zoom, clamped to its own width: docs/design/2026-10-19-wide-street.md. The maths comes first and has no
 * DOM, so tools/test-core.js can load this file and check it. */
(function (root) {
  'use strict';
  var ZOOM_OUT = 1, ZOOM_HOME = 1;                /* every scene opens fitted to the screen (Jamie, 19 Oct: "always zoomed out fit to screen"); + still zooms in; a layout may carry its own cam: { z } */
  var SCREEN = { x: 0.5, y: 0.58 };               /* where on the box her feet are held: centred, a little below the middle */
  var DEAD = { x: 0.06, y: 0.05 };                /* dead zone, a fraction of the box each side of that point */
  var TAU = 0.16, REST = 600, EPS = 0.3;          /* smoothing time constant (s), idle time before the loop sleeps (ms), settle tolerance (px) */
  function zoomFor(L, sceneOf) {
    if (!L) return ZOOM_HOME;
    if (L.cam && typeof L.cam.z === 'number') return Math.max(1, L.cam.z);
    var s = sceneOf ? sceneOf(L) : (L.scene || 'home');
    return s === 'home' ? ZOOM_HOME : ZOOM_OUT;
  }
  /* the camera translation must keep the plate covering the box: x in [w - w span z, 0], y in [h - h z, 0]. span is how
   * many box widths a wide plate is drawn (docs/design/2026-10-19-wide-street.md); 1 for every other plate */
  function sp(span) { return span > 1 ? span : 1; }
  function clamp(x, y, z, w, h, span) { return { x: Math.min(0, Math.max(w - w * sp(span) * z, x)), y: Math.min(0, Math.max(h - h * z, y)) }; }
  /* a plate point (percent) on the box (px) under camera c = { x, y, z } */
  function toScreen(f, c, w, h) { return { x: c.x + f.x / 100 * w * c.z, y: c.y + f.y / 100 * h * c.z }; }
  /* the translation that puts plate point f at the screen position, clamped */
  function centreOn(f, z, w, h, span, sy) { return clamp(w * SCREEN.x - f.x / 100 * w * z, h * (sy || SCREEN.y) - f.y / 100 * h * z, z, w, h, span); }
  /* where the camera should go from c: inside the dead zone nothing moves; beyond it, only by the overshoot. The answer
   * does not depend on c beyond its zoom (moving the camera moves her on screen by the same amount), so the smoothing
   * below chases one fixed point and cannot pile corrections up */
  function target(f, c, w, h, span, sy) {
    var s = toScreen(f, c, w, h), ex = s.x - w * SCREEN.x, ey = s.y - h * (sy || SCREEN.y), dx = w * DEAD.x, dy = h * DEAD.y;
    var mx = Math.abs(ex) > dx ? ex - (ex > 0 ? dx : -dx) : 0, my = Math.abs(ey) > dy ? ey - (ey > 0 ? dy : -dy) : 0;
    return clamp(c.x - mx, c.y - my, c.z, w, h, span);
  }
  /* exponential smoothing, the same result whatever the frame rate: the gap closes by 1 - e^(-dt/tau) */
  function approach(cur, tgt, dt, tau) { var k = 1 - Math.exp(-dt / (tau || TAU)); return cur + (tgt - cur) * k; }
  var M = { ZOOM_OUT: ZOOM_OUT, ZOOM_HOME: ZOOM_HOME, SCREEN: SCREEN, DEAD: DEAD, TAU: TAU, REST: REST, EPS: EPS, zoomFor: zoomFor, clamp: clamp, toScreen: toScreen, centreOn: centreOn, target: target, approach: approach };
  root.OvuCamera = { M: M };

  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement || !R.cam) return;
  var doc = root.document, reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SCREEN_UI = ['topbar', 'greeting', 'phaseChip', 'hint', 'hud', 'visitBar', 'bubble']; /* screen-space UI that room.html keeps inside the plate; the avatar and pet menus (bubble) are placed in box pixels */
  var scene, inner, avatar, raf = 0, last = 0, held = false, gesture = false, fitting = false, quietUntil = 0, snapUntil = 0, restAt = 0, lastFocus = null, lifted = false;
  function now() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }
  function view() { return { w: scene.clientWidth, h: scene.clientHeight }; }
  function sceneOf(L) { return root.OvuWalk && root.OvuWalk.sceneOf ? root.OvuWalk.sceneOf(L) : (L && L.scene) || 'home'; }
  /* her feet in plate percent, read from the avatar's own box (not its bobbing image) against the plate's rendered box:
   * covers the walk engine's per-frame transform, the room's CSS walks to hotspots and stairs, and any jump */
  function focus() {
    if (!avatar || avatar.classList.contains('hidden')) return null;
    var a = avatar.getBoundingClientRect(), p = inner.getBoundingClientRect();
    if (!a.width || !p.width || !p.height) return null;
    var f = { x: ((a.left + a.width / 2) - p.left) / p.width * 100, y: (a.bottom - p.top) / p.height * 100 };
    return isFinite(f.x) && isFinite(f.y) ? f : null;
  }
  function span() { var L = R.layout(); return L && L.span > 1 ? L.span : 1; }
  /* where her feet are held down the box: a layout may lower it (cam.sy) so a street with empty ground below shows its roofs */
  function sy() { var L = R.layout(); return L && L.cam && L.cam.sy > 0 && L.cam.sy < 1 ? L.cam.sy : SCREEN.y; }
  /* the view can move when zoomed in, or on a wide plate at any zoom */
  function on() { var c = R.cam(); return (c.z > 1.01 || span() > 1) && !held && !fitting; }
  function tick(t) {
    raf = 0;
    if (!on() || reduced) { last = 0; return; }
    if (gesture) { restAt = t; last = 0; raf = root.requestAnimationFrame(tick); return; } /* a finger is down: a pan may be starting, so write nothing */
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    var c = R.cam(), v = view(), f = focus();
    if (f && v.w && v.h) {
      if (!lastFocus || Math.abs(f.x - lastFocus.x) > 0.05 || Math.abs(f.y - lastFocus.y) > 0.05) restAt = t;
      lastFocus = f;
      if (t >= quietUntil) {
        var snap = t < snapUntil, s = span(), tg = snap ? centreOn(f, c.z, v.w, v.h, s, sy()) : target(f, c, v.w, v.h, s, sy());
        var nx = snap || !dt ? tg.x : approach(c.x, tg.x, dt), ny = snap || !dt ? tg.y : approach(c.y, tg.y, dt);
        if (Math.abs(tg.x - c.x) > EPS || Math.abs(tg.y - c.y) > EPS) { R.camSet(nx, ny, c.z, false); restAt = t; }
      }
    }
    if (t - restAt < REST || t < snapUntil || t < quietUntil) raf = root.requestAnimationFrame(tick); else last = 0;
  }
  /* reduced motion: no per-frame motion and no eased flights; if the person zoomed in, the view steps once, unanimated,
   * each time she comes to rest */
  function settle() {
    if (!on() || gesture || avatar.classList.contains('walking') || root.OvuWalk && root.OvuWalk.walking()) return;
    var c = R.cam(), v = view(), f = focus(); if (!f) return;
    var tg = target(f, c, v.w, v.h, span(), sy()); if (Math.abs(tg.x - c.x) > EPS || Math.abs(tg.y - c.y) > EPS) R.camSet(tg.x, tg.y, c.z, false);
  }
  function wake() {
    if (reduced) { settle(); return; }
    if (raf || !on()) return;
    restAt = now(); last = 0; raf = root.requestAnimationFrame(tick);
  }
  /* centre on her as she stands right now, with no smoothing (under a fade, or after a jump nobody should see) */
  function snapNow() {
    var c = R.cam(), v = view(), f = focus(); if (!f || !v.w || !v.h) return;
    var t = centreOn(f, c.z, v.w, v.h, span(), sy()); R.camSet(t.x, t.y, c.z, false); lastFocus = f;
  }
  /* a new scene: its zoom, centred on her; the snap window covers the entry point placed right after the layout event,
   * and the scene event (after travel's own placement, before the fade lifts) snaps once more, synchronously */
  function arrive(L) {
    if (fitting) return;
    held = false; var z = reduced ? 1 : zoomFor(L, sceneOf), v = view(), p = R.pos();
    var c = centreOn(p, z, v.w, v.h, span(), sy()); R.camSet(c.x, c.y, z, false);
    snapUntil = now() + 450; lastFocus = null; wake();
  }
  /* the screen-space UI leaves the plate for the box: same offsets, same boxes at zoom 1, never cropped at zoom */
  function liftUI() {
    var before = doc.getElementById('camCtl') || null;
    SCREEN_UI.forEach(function (id) { var el = doc.getElementById(id); if (el && inner.contains(el)) scene.insertBefore(el, before); });
    lifted = true;
  }
  function mount() {
    scene = R.els.scene; inner = R.els.inner; avatar = R.els.avatar;
    liftUI();
    R.on('layout', arrive);
    R.on('scene', snapNow);
    R.on('walk', function () { held = false; wake(); });        /* an accepted walk of her own: a floor tap, a key, a retarget */
    R.on('beforeWalk', function () { held = false; wake(); });  /* the room's own walk to a hotspot or up the stairs */
    R.on('cam', function (kind) {
      if (kind === 'pan' || kind === 'pinch' || kind === 'dbl' || kind === 'wheel') held = true;   /* the person looks where they like */
      else if (kind === 'fit') { held = false; if (span() > 1) { quietUntil = now() + 400; wake(); } } /* nothing to follow at zoom 1, except along a wide plate */
      else if (kind === 'zoom') { if (!held) quietUntil = now() + 400; wake(); }                   /* let the button's eased zoom finish first */
    });
    /* + and − zoom about her while following, about the box centre once the person holds the view */
    R.setCamFocus(function () { if (held) return null; var f = focus(); if (!f) return null; var c = R.cam(), v = view(); return toScreen(f, c, v.w, v.h); });
    /* a finger down on a zoomed scene may become a pan: the loop keeps its hands off until the finger lifts */
    scene.addEventListener('pointerdown', function () { if (R.cam().z > 1.01 || span() > 1) gesture = true; wake(); }, true);
    /* the box never scrolls (room.css clips it); if anything scrolls it anyway, put it back so taps and the view agree */
    scene.addEventListener('scroll', function () { if (scene.scrollLeft || scene.scrollTop) { scene.scrollLeft = 0; scene.scrollTop = 0; } });
    /* keyboard focus on a pin the view does not show (along a wide plate, or zoomed in): bring it into view and hold there */
    inner.addEventListener('focusin', function (e) {
      var b = e.target && e.target.closest && e.target.closest('.hotspot,.nb,.prop.owned,.keeper'); if (!b) return;
      var sr = scene.getBoundingClientRect(), r = b.getBoundingClientRect();
      if (r.left >= sr.left && r.right <= sr.right && r.top >= sr.top && r.bottom <= sr.bottom) return;
      var f = { x: parseFloat(b.style.left), y: parseFloat(b.style.top) }; if (!isFinite(f.x) || !isFinite(f.y)) return;
      var c = R.cam(), v = view(), t = centreOn(f, c.z, v.w, v.h, span(), sy()); held = true; R.camSet(t.x, t.y, c.z, !reduced);
    });
    var lift = function () { if (gesture) { gesture = false; wake(); } };
    scene.addEventListener('pointerup', lift, true); scene.addEventListener('pointercancel', lift, true); scene.addEventListener('pointerleave', lift, true);
    /* arranging drags props by the untransformed box, so the room fits itself while the person arranges */
    if (root.MutationObserver) {
      new MutationObserver(function () { wake(); }).observe(avatar, { attributes: true, attributeFilter: ['class', 'style'] });
      new MutationObserver(function () {
        var fit = scene.classList.contains('arranging');
        if (fit === fitting) return; fitting = fit;
        if (fitting) { held = true; R.camSet(0, 0, 1, true); } else arrive(R.layout());
      }).observe(scene, { attributes: true, attributeFilter: ['class'] });
    }
    doc.addEventListener('keydown', function () { wake(); });
    root.addEventListener('resize', function () { lastFocus = null; wake(); });
    root.addEventListener('pageshow', function () { last = 0; wake(); });
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) { last = 0; wake(); } });
    arrive(R.layout());
  }
  root.OvuCamera.held = function () { return held; };
  root.OvuCamera.state = function () { var c = R.cam(); return { x: c.x, y: c.y, z: c.z, held: held, gesture: gesture, fitting: fitting, running: !!raf, lifted: lifted, focus: focus() }; };
  root.OvuCamera.wake = wake;
  R.on('boot', mount);
})(window);
