/* Luna's look: the friend who sits in the corner of the room. The choice lives in the profile.
 * The full sprite shows on the welcome, the consent header and the picker; the head badge, when a
 * look has one, shows on the small Luna button. Luna stays Luna whichever face she wears. */
(function (root) {
  'use strict';
  var ART = 'assets/room/dream/';
  var LIST = [
    { id: 'rabbit', name: 'Moon rabbit', img: 'orb-bunny.webp', head: 'orb-bunny-head.webp', note: 'Curled on her crescent with a star to hold.' },
    { id: 'moon', name: 'Luna the moon', img: 'orb-moon.webp', head: 'orb-moon-head.webp', note: 'The glowing crescent Rhythme began with.' },
    { id: 'kitten', name: 'Cloud kitten', img: 'orb-kitten.webp', head: 'orb-kitten-head.webp', note: 'Sits on a puff of cloud with a moon charm.' },
    { id: 'star', name: 'Star sprite', img: 'orb-star.webp', head: 'orb-star-head.webp', note: 'A little star with stubby arms and stardust.' },
    { id: 'fox', name: 'Starry fox', img: 'orb-fox.webp', head: 'orb-fox-head.webp', note: 'A fluffy tail that fades into galaxy sparkles.' },
    { id: 'whale', name: 'Moon whale', img: 'orb-whale.webp', head: 'orb-whale-head.webp', note: 'Plump, lilac and freckled with stars.' },
    { id: 'seal', name: 'Moon seal', img: 'orb-seal.webp', head: 'orb-seal-head.webp', note: 'A chubby pup with a crescent on her forehead.' },
    { id: 'axolotl', name: 'Axolotl', img: 'orb-axolotl.webp', head: 'orb-axolotl-head.webp', note: 'Frilly gills that glow like tiny stars.' },
    { id: 'bear', name: 'Moon bear', img: 'orb-bear.webp', head: 'orb-bear-head.webp', note: 'Hugs a star pillow, a crescent on the chest.' }
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
