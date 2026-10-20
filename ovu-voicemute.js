/* ovu-voicemute.js: a mute for Erin's voice during practices, watering and sessions (Jamie, 19 Oct). Muting keeps every
 * clip playing silently, so each step still ends on time and the captions move on as before. Only the app's own voice
 * clips (assets/audio/) are muted; the podcast player and videos keep their own controls. Remembered on this phone. */
(function (root) {
  'use strict';
  var KEY = 'rhythme_voice_muted', live = [];
  function read() { try { return root.localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  var muted = read();
  function ours(el) { var s = (el && (el.currentSrc || el.src)) || ''; return el && el.tagName === 'AUDIO' && s.indexOf('assets/audio/') > -1; }
  var play = root.HTMLMediaElement && root.HTMLMediaElement.prototype.play;
  if (play) root.HTMLMediaElement.prototype.play = function () {
    if (ours(this)) { this.muted = muted; if (live.indexOf(this) < 0) { live.push(this); if (live.length > 12) live.shift(); } }
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
    live.forEach(function (a) { if (ours(a)) a.muted = muted; }); paint();
  }
  root.OvuVoice = { muted: function () { return muted; }, set: set, toggle: function () { set(!muted); } };
  function wire() { var b = root.document.getElementById('hudMute'); if (!b) return; paint(); b.addEventListener('click', function (e) { e.stopPropagation(); set(!muted); }); }
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', wire); else wire(); }
})(window);
