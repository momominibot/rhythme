/* Rhythme care steps, shared by the farm, the barn and the hidden spring (moved out of ovu-farm.js on 21 Oct so every
 * place uses one rule). A care step is done slowly, on purpose: one line to notice, a soft bar that fills once (it never
 * pulses, so it is not a breathing pacer), and Stop, which changes nothing. The step belongs to the scene it started in:
 * it is dropped when its sheet closes or changes, the scene changes, another activity starts, the page is hidden or
 * sleep begins, and only a step that reaches the end of its bar, still in its own sheet and scene, runs its save.
 * OvuCare.slowMs = 0 runs steps at once (tests). */
(function (root) {
  'use strict';
  var R = root.OvuRoom, S = root.OvuStore, W = root.OvuWalk, doc = root.document;
  var C = { slowMs: null };
  root.OvuCare = C;
  if (!R || !S || !doc) return;
  var cur = null;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reducedMo() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } /* read each time: the setting can change */
  function asleepNow() { return !!((W && W.napping && W.napping()) || S.state().sleeping); }
  function here() { var L = R.layout(); return L ? L.id : null; }
  function cancel() { if (!cur) return; var c = cur; root.clearTimeout(c.t); cur = null; if (c.undo) { try { c.undo(); } catch (e) { } } /* its scene effects come back however the step ended (Codex: X, the veil and Escape left eggs in the air) */ if (c.box.isConnected && R.sheetOpen() && c.cancel) { try { c.cancel(); } catch (e) { } } } /* a step dropped from outside redraws its sheet, so no bar is left behind */
  /* the step on screen, or null: one whose sheet closed, changed or was left behind is dropped at once */
  function live() { if (cur && !(cur.box.isConnected && R.sheetOpen() && here() === cur.scene)) cancel(); return cur; }
  function step(box, o, done) {
    if (live() || !box || !o || !o.scene) return false;
    var ms = C.slowMs != null ? C.slowMs : o.ms, line = R.moment && o.moment ? R.moment(o.moment, { quiet: true }) : ''; /* her pose and a small sound */
    if (!ms) { done(); return true; }
    var still = reducedMo(), tok = cur = { box: box, scene: o.scene, cancel: o.cancel, undo: o.undo };
    box.className = 'slowbox';
    box.innerHTML = '<div class="slowstep">' + (line ? '<p class="mindline"><span class="ms">spa</span><span>' + esc(line) + '</span></p>' : '') +
      '<div class="slowbar' + (still ? ' still' : '') + '" aria-hidden="true"><i></i></div><p class="slowverb" role="status">' + esc(o.verb) + '</p>' +
      '<button type="button" class="btn ghost" data-slow="stop">Stop</button></div>';
    var bar = box.querySelector('.slowbar i');
    if (o.start) o.start(ms); /* the thing the line says to watch happens with reduced motion too, just without its animation (Codex, 21 Oct) */
    if (!still) root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '100%'; }); });
    tok.t = root.setTimeout(function () {
      if (cur !== tok) return; cur = null;
      if (!box.isConnected || !R.sheetOpen() || here() !== tok.scene) return; /* closed or left: nothing is saved */
      if (asleepNow()) { R.hideSheet(); return; } /* sleep began meanwhile: nothing is saved */
      done();
    }, ms);
    box.querySelector('[data-slow=stop]').addEventListener('click', function (e) { e.stopPropagation(); if (cur !== tok) return; cur = null; root.clearTimeout(tok.t); if (R.endMoment) R.endMoment(); if (o.undo) { try { o.undo(); } catch (err) { } } if (o.cancel) o.cancel(); });
    return true;
  }
  /* anything else taking over drops a pending step at once: a new place, another activity, the page going away */
  R.on('layout', cancel);
  R.on('activity', cancel);
  R.on('sheetHide', cancel); /* X, the veil, Escape: the step ends with the sheet (Codex, 21 Oct) */
  if (S.subscribe) S.subscribe(function (reason) { if (reason === 'clear' || reason === 'import') cancel(); }); /* Delete everything, or a restored copy, under a running step: nothing of it is saved */
  doc.addEventListener('visibilitychange', function () { if (doc.hidden) cancel(); });
  C.step = step; C.live = live; C.cancel = cancel; C.asleepNow = asleepNow;
})(typeof window !== 'undefined' ? window : this);
