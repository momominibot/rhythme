/* Luna's look: the friend who sits in the corner of the room. The choice lives in the profile.
 * The full sprite shows on the welcome, the consent header and the picker; the head badge, when a
 * look has one, shows on the small Luna button. Luna stays Luna whichever face she wears. */
(function (root) {
  'use strict';
  var ART = 'assets/room/dream/';
  /* Jamie, 18 Oct 23:50: one Luna, the pastel crescent moon. The other looks stay on disk but are not offered. */
  var LIST = [
    { id: 'moon', name: 'Luna the moon', img: 'orb-moon.webp', head: null, note: 'The glowing crescent Rhythme began with.' } /* Jamie, 19 Oct: the crescent on its own everywhere, no round badge */
  ];
  function store() { return root.OvuStore || null; }
  function byId(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }
  function current() { var id = null; try { var s = store(); id = s && s.profile().mascot; } catch (e) { } return byId(id) || LIST[0]; }
  function src(m, head) { m = m || current(); return ART + (head && m.head ? m.head : m.img); }
  function apply() {
    var m = current(), d = root.document; if (!d || typeof d.querySelectorAll !== 'function') return m;
    var imgs = d.querySelectorAll('img[data-mascot]');
    for (var i = 0; i < imgs.length; i++) { var want = src(m, imgs[i].getAttribute('data-mascot') === 'head'); if (imgs[i].getAttribute('src') !== want) imgs[i].src = want; }
    return m;
  }
  function set(id) { var m = byId(id); if (!m) return current(); var s = store(); if (s) s.setProfile({ mascot: id }); apply(); return m; }
  root.OvuMascot = { LIST: LIST, current: current, set: set, apply: apply, src: src };
})(typeof window !== 'undefined' ? window : this);
