/* Rhythme: a soak in the hidden spring (Jamie, 22 Oct: "can the avatar goes in to hot spring with a towel on the head just
 * show head and shoulder"). Tapping the warm water walks her to the edge; then only her head and shoulders show above the
 * water, a folded towel on her head, with a little steam. In the tudung she wears a swim hood under the towel, so her hair
 * never shows. Nothing is counted: no hearts, no energy, no diary, no timer. Get out (or walking, leaving, sleep, a practice,
 * the screen going dark) ends it, as with sitting by the water (ovu-tones.js). */
(function (root) {
  'use strict';
  var PIC = { base: 'soak-base.webp', tudung: 'soak-tudung.webp' };
  /* which picture for what she wears: the hood for the tudung, the towel alone for everything else */
  function picFor(outfit) { return outfit === 'tudung' ? PIC.tudung : PIC.base; }
  var Q = { PIC: PIC, picFor: picFor };
  root.OvuSoak = Q;

  var R = root.OvuRoom, S = root.OvuStore, W = root.OvuWalk, CARE = root.OvuCare, doc = root.document;
  if (!R || !S || !W || !doc || !doc.createElement) return;
  var ART = R.ART || 'assets/room/dream/', soaking = null;
  function cave() { var L = R.layout && R.layout(); return L && L.id === 'cave' ? L : null; }
  function idle() { return !((W.napping && W.napping()) || (CARE && CARE.live && CARE.live())); }
  function soakIn() {
    var L = cave(); if (!L || soaking || !idle()) return;
    if (R.refuseBusy && R.refuseBusy()) return;
    if (root.OvuTones && root.OvuTones.sitting && root.OvuTones.sitting()) root.OvuTones.standUp();
    var outfit = (function (o) { return /^[a-z0-9-]{1,32}$/.test(o || '') ? o : 'base'; })(S.profile().outfit);
    var el = doc.createElement('div'); el.className = 'nb soaker'; el.dataset.id = 'soaker'; el.setAttribute('aria-hidden', 'true');
    el.style.left = L.soak.x + '%'; el.style.top = L.soak.y + '%'; el.style.width = ((L.avatarW || 11) * 0.97).toFixed(2) + '%'; /* her head the same size as when she stands (measured, 22 Oct) */
    el.innerHTML = '<img src="' + ART + picFor(outfit) + '" alt=""><i class="ripple"></i><i class="steam s1"></i><i class="steam s2"></i><i class="steam s3"></i>';
    var stop = doc.createElement('button'); stop.type = 'button'; stop.className = 'springstop'; stop.id = 'soakStop'; stop.innerHTML = '<span class="ms">dry</span>Get out';
    R.els.props.appendChild(el); R.els.scene.appendChild(stop);
    soaking = { el: el, stop: stop }; R.els.scene.classList.add('sitting', 'soaking');
    stop.addEventListener('click', function (e) { e.stopPropagation(); getOut(); });
    try { stop.focus({ preventScroll: true }); } catch (e) { }
    if (R.moment) R.moment('springsoak', { quiet: true, pose: null });
  }
  function getOut() {
    if (!soaking) return; var s = soaking; soaking = null;
    if (s.el.parentNode) s.el.remove(); if (s.stop.parentNode) s.stop.remove();
    R.els.scene.classList.remove('sitting', 'soaking');
  }
  Q.soakIn = soakIn; Q.getOut = getOut; Q.soaking = function () { return !!soaking; };
  R.hotspotHandlers.springsoak = function (id, L) { if (!L || L.id !== 'cave') return false; if ((W.napping && W.napping()) || R.busy() || !idle()) return true; soakIn(); return true; };
  R.on('boot', function () {
    R.on('layout', function (L) { if (!L || L.id !== 'cave') getOut(); });
    R.on('props', function () { if (soaking && !soaking.el.isConnected) R.els.props.appendChild(soaking.el); });
    R.on('activity', getOut); R.on('beforeWalk', getOut); R.on('walk', getOut);
    R.on('outfit', function () { if (soaking) { var o = S.profile().outfit; soaking.el.querySelector('img').src = ART + picFor(/^[a-z0-9-]{1,32}$/.test(o || '') ? o : 'base'); } });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) getOut(); });
    S.subscribe(function (reason) { if (reason === 'clear' || reason === 'import' || reason === 'external' || String(reason).indexOf('sync') === 0) getOut(); else if (reason === 'state' && S.state().sleeping) getOut(); });
  });
})(typeof window !== 'undefined' ? window : this);
