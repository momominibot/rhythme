/* Rhythme shopkeepers (Jamie, 22 Oct: "To make the world more lively I want NPC in each store"). Each store has one keeper
 * standing by the counter, drawn in the same clay style and at her height. A keeper idles gently; a tap says one short
 * friendly line (a hello first each day, then the shop's own lines in turn). Keepers sell nothing themselves, give no advice
 * about health, take nothing and save nothing; the shop's own counter still opens the shop. Pure data first (tested in node). */
(function (root) {
  'use strict';
  /* wk: a keeper whose pose is wider than her canvas (the rod) has a wider canvas at the same height; x, y: the keeper's feet in plate percent (behind the counter, above its top edge so the counter is never covered); flip:
     facing left; block: the floor she cannot walk into, around the keeper's feet */
  var KEEPERS = {
    'lane-grocer': { id: 'grocer', name: 'Auntie Lin', role: 'the grocer', img: 'keeper-grocer.webp', x: 36, y: 60.5, flip: false, block: { x0: 32, x1: 40, y0: 57.5, y1: 62 },
      lines: ['The kangkong came in fresh this morning.', 'Rice, tofu, garlic, coconut: whatever your kitchen needs.', 'Take your time. Shopping slowly is a nice way to spend a minute.', 'Seeds swap at the rack; a good trade is a happy trade.'] },
    'lane-boutique': { id: 'boutique', name: 'Mira', role: 'the boutique owner', img: 'keeper-boutique.webp', x: 19.5, y: 69.5, flip: false, block: null, /* in the fitting alcove before its curtain, a fitting assistant (by the counter she stood on the stairs) */
      lines: ['Try anything on. The mirror here is a kind one.', 'Every outfit on the rails comes in your size.', 'New arrivals come in as soon as they are sewn.', 'That colour suits you.'] },
    'lane-gym': { id: 'gym', name: 'Coach Ren', role: 'the gym coach', img: 'keeper-gym.webp', x: 57.5, y: 60, flip: true, block: { x0: 55.5, x1: 59.5, y0: 58.5, y1: 61.5 }, /* on the floor before the stairs, not on the bottom step */
      lines: ['Move at your own pace. Nothing here counts unless you log it.', 'Water break whenever you like.', 'Rest days are part of training too.', 'The mats are free. So is the stretching.'] },
    'lane': { id: 'fish', name: 'Uncle Hamid', role: 'the tackle seller', img: 'keeper-fish.webp', wk: 1.22, x: 60, y: 77, flip: true, block: { x0: 57.5, x1: 62.5, y0: 75.5, y1: 78.5 }, /* on the grey paving before his shelf, facing the street */
      lines: ['Catch and release only. The fish say thank you.', 'The grouper likes the rocks by the jetty.', 'A slow cast is a good cast.', 'Floats are for looks; the fish do not mind the colour.'] },
    'shop-pet': { id: 'pet', name: 'Hana', role: 'the pet keeper', img: 'keeper-pet.webp', x: 79, y: 68.5, flip: true, block: { x0: 76.5, x1: 81.5, y0: 66.5, y1: 70 }, /* on the floor under the window, right of the stairs: behind the counter the display bed's pets would hide her */
      lines: ['This little one just woke from a nap.', 'Every pet here comes with a cuddle.', 'Treats are in the jars by the till.', 'They all have names already, but you can change them.'] },
    'shop-furniture': { id: 'furniture', name: 'Ben', role: 'the furniture maker', img: 'keeper-furniture.webp', x: 30.5, y: 65.5, flip: false, block: null,
      lines: ['A lamp can change a whole room.', 'Pieces that share a spot swap places. Easy.', 'Sit on anything you like. It is a showroom.', 'I sanded this shelf myself this morning.'] },
    'shop-homes': { id: 'homes', name: 'Ms Clara', role: 'the homes agent', img: 'keeper-homes.webp', x: 27, y: 69.5, flip: false, block: { x0: 23.5, x1: 30.5, y0: 67, y1: 71.5 },
      lines: ['Visit any house first. No rush at all.', 'The bathhouse is lovely at night.', 'Move in when your hearts are ready.', 'Every home has a window for the moon.'] }
  };
  function hello(name, hour) { return (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') + '! I am ' + name + '.'; }
  /* the line for a tap: a hello first on a new day, then the shop's lines in turn */
  function nextLine(k, mem, day, hour) {
    mem = mem || {}; if (mem.day !== day) return { text: hello(k.name, hour), mem: { day: day, i: 0 } };
    var i = (mem.i || 0) % k.lines.length; return { text: k.lines[i], mem: { day: day, i: i + 1 } };
  }
  var K = { KEEPERS: KEEPERS, nextLine: nextLine, hello: hello };
  root.OvuKeepers = K;

  /* ---------- the scenes ---------- */
  var R = root.OvuRoom, doc = root.document;
  if (!R || !doc || !doc.createElement) return;
  var ART = R.ART || 'assets/room/dream/', mem = {}, bubbleT = 0;
  function layoutFor(id) { var L = (R.LAYOUTS && R.LAYOUTS[id]) || null; if (!L && root.OvuLaneScene) L = root.OvuLaneScene.LAYOUTS[id]; return L; }
  /* each keeper's feet are a solid where one is given, so she walks round them (added once, to the layout's own list) */
  Object.keys(KEEPERS).forEach(function (lid) { var k = KEEPERS[lid], L = layoutFor(lid); if (k.block && L && L.solids && !L.solids.some(function (s) { return s.id === 'keeper'; })) L.solids.push(Object.assign({ id: 'keeper' }, k.block)); });
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function say(el, k) {
    var r = nextLine(k, mem[k.id], today(), new Date().getHours()); mem[k.id] = r.mem;
    var b = el.querySelector('.keepsay'); if (!b) return;
    b.textContent = r.text; el.classList.add('saying'); clearTimeout(bubbleT); bubbleT = setTimeout(function () { el.classList.remove('saying'); }, 4200);
    var live = doc.getElementById('keeperLive'); if (live) live.textContent = k.name + ': ' + r.text; /* read aloud by screen readers */
    if (R.chime) R.chime('tap');
  }
  function render() {
    var wrap = R.els && R.els.props; if (!wrap) return;
    Array.prototype.slice.call(wrap.querySelectorAll('.keeper')).forEach(function (e) { e.remove(); });
    var L = R.layout && R.layout(), k = L && KEEPERS[L.id]; if (!k) return;
    var el = doc.createElement('button'); el.type = 'button'; el.className = 'keeper' + (k.flip ? ' flip' : ''); el.dataset.id = 'keeper-' + k.id;
    el.setAttribute('aria-label', k.name + ', ' + k.role + '. Tap to say hello');
    el.style.left = k.x + '%'; el.style.top = k.y + '%'; el.style.width = ((L.avatarW || 10) * (k.wk || 1)).toFixed(2) + '%'; /* her own sprite width: every keeper is drawn on her canvas at her figure height; wk widens a wider pose */
    el.innerHTML = '<img src="' + ART + k.img + '" alt="" draggable="false"><span class="keepsay" aria-hidden="true"></span>';
    el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); say(el, k); });
    wrap.appendChild(el);
    if (!doc.getElementById('keeperLive')) { var lv = doc.createElement('div'); lv.id = 'keeperLive'; lv.className = 'sr-only'; lv.setAttribute('aria-live', 'polite'); doc.body.appendChild(lv); }
  }
  K.render = render;
  if (R.on) { R.on('layout', render); R.on('props', function () { var L = R.layout && R.layout(); if (L && KEEPERS[L.id] && !(R.els.props && R.els.props.querySelector('.keeper'))) render(); }); R.on('boot', render); }
})(typeof window !== 'undefined' ? window : this);
