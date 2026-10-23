/* ovu-voicemute.js: Erin's voice speaks only in mindfulness (Jamie, 23 Oct 2026: "remove all of Erin's voice, or on any of
 * the activities or conversations made. I think we can have a M icon. If they wish to practice mindfulness, then Erin's
 * voice will be out to assist"). A clip of the app's own (assets/audio/) plays aloud only when the run that owns it is a
 * mindfulness practice begun from the Mind tab (the M) and has said so with allow(); every other clip is muted, so no
 * greeting, activity or walk-in line can ever be heard. The HUD's mute button quiets her for a practice and is remembered
 * on this phone. Muted clips keep playing silently, so a step still ends on time and the captions move on as before. The
 * podcast player and videos keep their own controls. */
(function (root) {
  'use strict';
  var KEY = 'rhythme_guide_muted', live = [];
  function read() { try { return root.localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  var muted = read();
  function ours(el) { var s = (el && (el.currentSrc || el.src)) || ''; return el && el.tagName === 'AUDIO' && s.indexOf('assets/audio/') > -1; }
  function quiet(el) { return !el.__ovuAllow || muted; }
  var play = root.HTMLMediaElement && root.HTMLMediaElement.prototype.play;
  if (play) root.HTMLMediaElement.prototype.play = function () {
    if (ours(this)) { this.muted = quiet(this); if (live.indexOf(this) < 0) { live.push(this); if (live.length > 12) live.shift(); } }
    return play.apply(this, arguments);
  };
  function paint() {
    var b = root.document && root.document.getElementById('hudMute'); if (!b) return;
    b.setAttribute('aria-pressed', muted ? 'true' : 'false');
    b.setAttribute('aria-label', muted ? 'Turn Erin’s voice back on' : 'Mute Erin’s voice');
    b.innerHTML = '<span class="ms" aria-hidden="true">' + (muted ? 'volume_off' : 'volume_up') + '</span>';
  }
  function set(on) {
    muted = !!on; try { root.localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { }
    live.forEach(function (a) { if (ours(a)) a.muted = quiet(a); }); paint();
  }
  /* a mindfulness run from the Mind tab marks its own element: only that element may be heard */
  function allow(el, on) { if (!el) return; el.__ovuAllow = on !== false; if (ours(el)) el.muted = quiet(el); }
  function allowed(el) { return !!(el && el.__ovuAllow); }
  root.OvuVoice = { muted: function () { return muted; }, set: set, toggle: function () { set(!muted); }, allow: allow, allowed: allowed, heard: function (el) { return !!el && !quiet(el); } };
  function wire() { var b = root.document.getElementById('hudMute'); if (!b) return; paint(); b.addEventListener('click', function (e) { e.stopPropagation(); set(!muted); }); }
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', wire); else wire(); }
})(window);
