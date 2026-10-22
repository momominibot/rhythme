/* Rhythme shopkeepers (Jamie, 22 Oct: "To make the world more lively I want NPC in each store"). Each store has one keeper
 * standing by the counter, drawn in the same clay style and at her height. A keeper idles gently; a tap says one short
 * friendly line (a hello first each day, then the shop's own lines in turn). Keepers sell nothing themselves, give no advice
 * about health, take nothing and save nothing; the shop's own counter still opens the shop. Pure data first (tested in node). */
(function (root) {
  'use strict';
  /* wk: a keeper whose pose is wider than her canvas (the rod) has a wider canvas at the same height; x, y: the keeper's feet in plate percent (behind the counter, above its top edge so the counter is never covered); flip:
     facing left; block: the floor she cannot walk into, around the keeper's feet */
  /* each keeper's outline on its canvas (alpha traced, dilated 5 px, every opaque pixel inside; tools: the session's
   * keeper_outline.py): the picture is clipped to it, which changes nothing you see but lets a tap on the empty canvas
   * beside her legs reach the stock behind (Codex and the browser suite, 22 Oct) */
  var OUTLINE = {
    grocer: '72.6% 0%,60.4% 0.4%,50.9% 4.2%,34.9% 5.8%,25.8% 8.3%,16% 13.6%,11.3% 19.2%,13.5% 24.3%,11% 26.4%,11.3% 29.2%,24.2% 35.7%,36.8% 38.3%,25.8% 42.4%,15.1% 49.4%,11.6% 49.2%,6.3% 50.3%,6.9% 51.7%,4.4% 52.8%,6.3% 54.4%,4.4% 59.2%,6% 62.9%,11.6% 65.3%,20.8% 66%,17.3% 78.9%,25.2% 81.1%,26.1% 87.2%,30.8% 89.2%,20.4% 92.6%,19.2% 96%,28.6% 97.9%,45.3% 96.9%,47.2% 99%,53.1% 99.9%,64.2% 99.7%,74.5% 97.1%,74.2% 92.6%,72.3% 91.1%,77.7% 89%,76.7% 81.8%,79.2% 70.6%,84% 69.6%,81.1% 64.7%,83.6% 61.3%,77% 57.8%,78.9% 51.7%,76.4% 45.6%,70.1% 40.6%,64.8% 38.6%,76.7% 37.5%,89.3% 33.3%,95% 24.7%,94.7% 20.4%,89.3% 13.8%,91.5% 11%,90.6% 6.1%,83.6% 2.5%',
    boutique: '45.3% 0%,29.2% 2.6%,17.6% 7.4%,10.7% 13.1%,3.1% 24.2%,2.2% 30%,8.8% 34.9%,21.1% 37.8%,30.8% 36%,36.5% 36.4%,25.5% 39.4%,22.3% 41.4%,15.1% 50.7%,8.8% 55.3%,11% 57.4%,5.3% 63.9%,5% 66.5%,10.7% 68.6%,16% 67.1%,17% 65.7%,18.2% 66.1%,14.8% 74.3%,27% 77.4%,31.4% 88.9%,22.6% 94.4%,23% 96.9%,33% 98.2%,47.2% 95.4%,47.8% 91%,45.3% 88.6%,45.6% 78.2%,53.8% 89.9%,48.4% 95.8%,48.4% 98.5%,53.5% 99.9%,61.3% 99.9%,69.8% 97.5%,70.4% 92.4%,67.9% 90.3%,68.2% 82.4%,65.1% 77.8%,75.5% 75.6%,74.2% 71%,79.2% 71.7%,85.5% 69.7%,84.6% 65.8%,88.7% 63.6%,87.7% 61.3%,82.7% 59%,83% 56.8%,74.5% 42.1%,63.5% 37.2%,80.8% 37.5%,89.9% 35.8%,96.5% 32.1%,97.8% 26.8%,94.7% 15.1%,85.2% 6.7%,64.8% 0.7%',
    gym: '74.2% 0%,63.5% 0.4%,54.7% 2.8%,38.7% 1.7%,24.2% 3.3%,7.9% 9.2%,0.9% 15.6%,0% 19.7%,5% 24%,4.4% 26.1%,7.9% 31.7%,12.9% 33.8%,15.1% 33.3%,13.2% 31%,25.8% 34%,23.9% 34.9%,24.5% 36.9%,15.7% 41%,7.9% 51%,1.9% 56%,3.1% 59%,0.9% 66.1%,4.1% 68.1%,11.3% 67.6%,16.7% 80.7%,16% 83.5%,20.8% 86.4%,18.9% 88.5%,4.7% 93.2%,4.1% 95.7%,11% 97.4%,22% 97.6%,35.2% 96.8%,39.6% 95.7%,38.4% 89.7%,35.8% 88.1%,40.6% 82.2%,42.8% 86%,47.2% 87.5%,49.7% 89.9%,41.8% 95.8%,41.2% 98.8%,47.2% 99.7%,59.7% 99.9%,67.6% 97.2%,66.4% 91.8%,63.2% 89.3%,67% 82.8%,61.3% 75.7%,59.7% 69.2%,65.7% 69.6%,71.7% 67.9%,71.7% 60.8%,73.9% 59.6%,74.2% 56.7%,61.9% 40.7%,53.8% 36.4%,53.1% 33.9%,56.6% 32.6%,60.4% 33.3%,63.5% 31.9%,65.1% 35%,69.2% 37.5%,77.4% 39.3%,89.3% 39.6%,90.6% 38.5%,84.9% 35.1%,91.5% 35.8%,92.5% 34.4%,96.9% 33.2%,89.9% 30.4%,91.2% 24.9%,96.2% 26%,99.4% 25.4%,93.4% 19.6%,94% 14%,89.9% 6.7%',
    fish: '54.1% 0%,44.1% 2.2%,34% 10%,24% 12.8%,18.3% 17.2%,20.1% 22.1%,29.9% 27.8%,33% 35.8%,42.8% 40.4%,30.9% 50.8%,24.5% 48.6%,11.1% 23.2%,3.9% 14.6%,0% 14.6%,2.6% 45%,1.5% 55.4%,5.2% 56.5%,8% 55.3%,5.4% 51.5%,4.1% 23.6%,8.8% 30.6%,16.2% 49.2%,13.1% 51.2%,13.4% 57.4%,15.7% 59.2%,20.4% 60%,20.9% 63.6%,22.7% 64.7%,28.4% 64%,28.6% 61.1%,33.2% 61.7%,34.8% 68.1%,37.6% 69.7%,38.4% 86%,39.7% 86.9%,29.4% 90.3%,27.6% 94.9%,31.4% 96.4%,37.6% 97.2%,58% 95.6%,57.5% 97.8%,60.1% 99.2%,75.8% 99.9%,79.9% 99%,82.7% 96.5%,81.4% 89.7%,84% 88.5%,84.3% 85.6%,82% 76.1%,89.7% 75.6%,94.1% 73.9%,95.9% 71.2%,95.1% 66.4%,97.9% 64.9%,96.9% 56%,92.8% 49%,85.6% 41.1%,75.8% 37.2%,83% 34.4%,95.4% 31.7%,99.7% 28.3%,99.7% 24.3%,93% 18.9%,90.7% 9%,84.8% 4.6%,71.6% 0.7%',
    pet: '48.4% 0%,40.6% 1%,32.4% 3.5%,23.6% 7.8%,18.6% 11.8%,17.3% 23.5%,21.1% 26.5%,13.8% 32.4%,13.5% 35.4%,4.4% 37.8%,4.7% 39.9%,7.5% 41.2%,4.1% 43.8%,2.8% 48.5%,5.7% 52.8%,12.6% 55.3%,14.2% 57.4%,8.2% 71.2%,15.4% 73.6%,23.3% 74.7%,27.4% 84.7%,27% 88.2%,29.2% 89.6%,20.1% 94%,19.2% 97.4%,34% 98.5%,45.9% 96.7%,43.1% 89.9%,45% 88.1%,41.8% 76.2%,45.3% 76.4%,54.7% 86.4%,55% 89.4%,57.5% 90.8%,51.9% 95.7%,51.3% 98.8%,55.3% 99.7%,66.4% 99.9%,75.2% 97.2%,74.2% 92.9%,71.7% 90.7%,73% 87.5%,63.8% 76.2%,74.5% 73.8%,67.3% 58.9%,71.1% 57.2%,71.1% 56.1%,67% 53.8%,71.4% 51.8%,73.6% 49.3%,73% 38.5%,81.8% 41.5%,81.8% 44.4%,84.3% 46.1%,93.4% 45.3%,96.5% 42.6%,88.1% 39.2%,88.4% 36.8%,84.9% 33.9%,85.5% 31.1%,83.3% 29.7%,86.8% 28.5%,91.2% 24.4%,88.4% 13.9%,81.4% 6%,71.4% 2.1%,57.9% 0%',
    furniture: '30.2% 0%,27% 1.4%,26.1% 3.9%,21.4% 4.2%,17.6% 3.3%,14.8% 4.2%,14.2% 6%,16.4% 8.2%,11.6% 10.7%,6% 11.4%,9.4% 16.2%,7.5% 19.3%,11.9% 20.6%,15.1% 23.9%,12.9% 25.8%,14.5% 29.6%,18.2% 31.2%,24.5% 31.8%,29.2% 34.9%,42.1% 36.4%,30.8% 39.4%,24.8% 42.2%,13.2% 50.4%,11% 54%,11% 56.7%,13.8% 59%,19.2% 60.6%,26.1% 61%,20.8% 76.4%,23.3% 77.9%,28% 78.6%,28.3% 89.6%,18.2% 92.5%,16.7% 96.7%,19.8% 97.8%,28.9% 98.5%,49.1% 97.1%,50% 98.8%,53.1% 99.6%,68.9% 99.9%,76.7% 97.6%,75.5% 92.1%,78% 91.1%,73.6% 74%,79.2% 73.3%,75.5% 66.1%,78.9% 64.6%,79.2% 63.1%,73.6% 60%,82.4% 56.7%,84% 51.2%,77.4% 41%,68.2% 36.8%,61% 35.8%,64.5% 35.1%,68.2% 35.7%,72.3% 34%,78% 33.9%,80.2% 30.7%,89.3% 27.9%,91.2% 22.5%,89% 20.7%,93.7% 16.8%,90.6% 15%,86.8% 9.3%,77% 3.9%,69.8% 3.6%,61.9% 0.7%,56.9% 1.2%,47.8% 0.6%,34.6% 1.8%,32.4% 0%',
    homes: '51.6% 0%,39.6% 1.9%,27.7% 6.8%,21.1% 12.5%,16.4% 21.7%,16.7% 25.4%,21.4% 29%,31.4% 31.5%,44.7% 31.8%,32.7% 35.6%,24.2% 41.2%,13.2% 39.7%,10.1% 41.1%,0.9% 42.2%,3.1% 48.2%,0.3% 49.6%,0% 52.4%,1.9% 54.9%,8.5% 56.9%,11.3% 59.4%,25.2% 59.9%,25.2% 62.4%,28.9% 63.5%,32.4% 88.9%,35.8% 90.1%,25.5% 94%,24.5% 97.5%,38.1% 98.9%,53.8% 96.8%,51.9% 90.3%,55.3% 88.6%,55.3% 81%,57.5% 89.7%,61% 91.4%,55.7% 95%,54.7% 98.6%,60.7% 99.9%,71.1% 99.9%,79.6% 97.6%,77% 91%,80.8% 89.9%,78% 77.5%,88.7% 77.6%,91.2% 76.7%,93.4% 72.8%,87.1% 69.2%,94.3% 66.7%,93.1% 62.1%,95.3% 61.1%,91.5% 49.7%,84.6% 38.9%,80.8% 35.8%,71.1% 32.1%,84.9% 31.5%,92.8% 29.9%,98.1% 26.7%,99.4% 22.5%,92.8% 10.8%,86.8% 6.1%,79.2% 3.2%,70.8% 2.2%,66% 0.7%'
  };
  var KEEPERS = {
    'lane-grocer': { id: 'grocer', name: 'Auntie Lin', role: 'the grocer', img: 'keeper-grocer.webp', x: 36, y: 60.5, flip: false, block: { x0: 32, x1: 40, y0: 57.5, y1: 62 },
      lines: ['The kangkong came in fresh this morning.', 'Rice, tofu, garlic, coconut: whatever your kitchen needs.', 'Take your time. Shopping slowly is a nice way to spend a minute.', 'Seeds swap at the rack; a good trade is a happy trade.'] },
    'lane-boutique': { id: 'boutique', name: 'Mira', role: 'the boutique owner', img: 'keeper-boutique.webp', x: 19.5, y: 69.5, flip: false, block: null, alcove: true, /* in the fitting alcove before its curtain, a fitting assistant (by the counter she stood on the stairs) */
      lines: ['Try anything on. The mirror here is a kind one.', 'Every outfit on the rails comes in your size.', 'New arrivals come in as soon as they are sewn.', 'That colour suits you.'] },
    'lane-gym': { id: 'gym', name: 'Coach Ren', role: 'the gym coach', img: 'keeper-gym.webp', x: 40.5, y: 53.2, flip: false, block: { x0: 38.5, x1: 42.5, y0: 51.8, y1: 54.6 }, /* on the floor in front of the rolled yoga mats, between the little plant and the rolls (the old spot had his feet on the banister's base, Codex 22 Oct) */
      lines: ['Move at your own pace. Nothing here counts unless you log it.', 'Water break whenever you like.', 'Rest days are part of training too.', 'The mats are free. So is the stretching.'] },
    'lane': { id: 'fish', name: 'Uncle Hamid', role: 'the tackle seller', img: 'keeper-fish.webp', wk: 1.22, x: 60, y: 77, flip: true, block: { x0: 57.5, x1: 62.5, y0: 75.5, y1: 78.5 }, /* on the grey paving before his shelf, facing the street */
      lines: ['Catch and release only. The fish say thank you.', 'The grouper likes the rocks by the jetty.', 'A slow cast is a good cast.', 'Floats are for looks; the fish do not mind the colour.'] },
    'shop-pet': { id: 'pet', name: 'Hana', role: 'the pet keeper', img: 'keeper-pet.webp', x: 56, y: 71.3, flip: true, block: { x0: 54, x1: 58, y0: 69.8, y1: 72.8 }, /* on the floor between the round rug and the foot of the stairs (under the window she stood on the trim, beside a spare pet spot; behind the counter the display bed's pets would hide her) */
      lines: ['This little one just woke from a nap.', 'Every pet here comes with a cuddle.', 'Treats are in the jars by the till.', 'They all have names already, but you can change them.'] },
    'shop-furniture': { id: 'furniture', name: 'Ben', role: 'the furniture maker', img: 'keeper-furniture.webp', x: 44, y: 70.5, flip: true, block: { x0: 42, x1: 46, y0: 69, y1: 72 }, /* on the rug's front-left, clear of the display platform he stood on and of the purple bench's stock */
      lines: ['A lamp can change a whole room.', 'Pieces that share a spot swap places. Easy.', 'Sit on anything you like. It is a showroom.', 'I sanded this shelf myself this morning.'] },
    'shop-homes': { id: 'homes', name: 'Ms Clara', role: 'the homes agent', img: 'keeper-homes.webp', x: 32.5, y: 70.5, flip: true, block: { x0: 30.5, x1: 34, y0: 69, y1: 72 }, /* beside the sofa's arm by the way in, turned to the models: the one stretch of this floor where she hides none of them (in front of the rug she hid the first model and took its taps) */
      lines: ['Visit any house first. No rush at all.', 'The bathhouse is lovely at night.', 'Move in when your hearts are ready.', 'Every home has a window for the moon.'] }
  };
  function hello(name, hour) { return (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') + '! I am ' + name + '.'; }
  /* the line for a tap: a hello first on a new day, then the shop's lines in turn */
  function nextLine(k, mem, day, hour) {
    mem = mem || {}; if (mem.day !== day) return { text: hello(k.name, hour), mem: { day: day, i: 0 } };
    var i = (mem.i || 0) % k.lines.length; return { text: k.lines[i], mem: { day: day, i: i + 1 } };
  }
  var K = { OUTLINE: OUTLINE, KEEPERS: KEEPERS, nextLine: nextLine, hello: hello };
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
    if (OUTLINE[k.id]) el.querySelector('img').style.clipPath = 'polygon(' + OUTLINE[k.id] + ')'; /* only her figure takes a tap */
    el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); say(el, k); });
    wrap.appendChild(el);
    if (root.OvuWalk && root.OvuWalk.sortDepth) root.OvuWalk.sortDepth(); /* ranked by its feet with her, the pets and the stock (Codex, 22 Oct) */
    if (!doc.getElementById('keeperLive')) { var lv = doc.createElement('div'); lv.id = 'keeperLive'; lv.className = 'sr-only'; lv.setAttribute('aria-live', 'polite'); doc.body.appendChild(lv); }
  }
  K.render = render;
  if (R.on) { R.on('layout', render); R.on('props', function () { var L = R.layout && R.layout(); if (L && KEEPERS[L.id] && !(R.els.props && R.els.props.querySelector('.keeper'))) render(); }); R.on('boot', render); }
})(typeof window !== 'undefined' ? window : this);
