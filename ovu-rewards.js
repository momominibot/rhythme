/* Hearts: a small reward ledger that encourages logging. Points never affect
 * health logic; they only unlock cosmetic props placed in the room. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var RULES = { sleep: 10, period: 10, symptom: 8, food: 6, reflection: 5, mindfulness: 0 };
  var SHOP = [
    /* pets in a slot are options: one kitten and one puppy show at a time, the rest wait in your inventory.
     * posAs borrows the layout spot of the original pet; wk keeps each sprite the same height as the original. */
    { id: 'cat', name: 'Mochi the kitten', cost: 150, kind: 'pet', slot: 'cat', note: 'Cream and peach, curls up by the bed and purrs when you log.', img: 'prop-cat.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'catgrey', name: 'Pebble the British shorthair', cost: 150, kind: 'pet', slot: 'cat', posAs: 'cat', wk: 0.99, note: 'Round, grey and very serious about naps.', img: 'prop-cat-grey.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'catblack', name: 'Sesame the black kitten', cost: 150, kind: 'pet', slot: 'cat', posAs: 'cat', wk: 1.03, note: 'Golden eyes and a little moon charm. Happiest at night.', img: 'prop-cat-black.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'catginger', name: 'Mango the ginger tabby', cost: 150, kind: 'pet', slot: 'cat', posAs: 'cat', wk: 1.17, note: 'Orange stripes, a lavender collar and a jingly bell.', img: 'prop-cat-ginger.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'dog', name: 'Peach the corgi', cost: 220, kind: 'pet', slot: 'dog', wk: 1.02, note: 'Big ears, short legs and a lilac bow. Waits for you with a wiggly tail.', img: 'prop-corgi.webp', pos: { x: 22.9, y: 68.5, w: 8.5 } },
    { id: 'shiba', name: 'Hana the shiba', cost: 220, kind: 'pet', slot: 'dog', posAs: 'dog', wk: 1.13, note: 'Honey fur, a curly tail and a lavender bandana.', img: 'prop-shiba.webp', pos: { x: 22.9, y: 68.5, w: 8.5 } },
    { id: 'plant', name: 'Fairy-light monstera', cost: 60, kind: 'furniture', note: 'A glow-wrapped plant for the corner.', img: 'prop-plant.webp', slot: 'corner', pos: { x: 95.5, y: 71, w: 8 } },
    { id: 'bookshelf', name: 'Arched bookshelf', cost: 100, kind: 'furniture', note: 'Pastel books, a plush bunny and a tiny candle. Swaps with the monstera.', img: 'prop-bookshelf.webp', slot: 'corner', pos: { x: 94.5, y: 71.5, w: 8.5 } },
    { id: 'lamp', name: 'Crescent floor lamp', cost: 80, kind: 'furniture', note: 'Warm moonlight beside the wardrobe.', img: 'prop-lamp.webp', slot: 'lamp', pos: { x: 85.7, y: 72, w: 6.2 } },
    { id: 'mushlamp', name: 'Mushroom lamp', cost: 60, kind: 'furniture', note: 'A spotty pink glow. Swaps with the other lamps.', img: 'prop-mushlamp.webp', slot: 'lamp', pos: { x: 85.7, y: 72, w: 6.4 } },
    { id: 'starlamp', name: 'Star lantern', cost: 70, kind: 'furniture', note: 'A puffy star on a slim pole. Swaps with the other lamps.', img: 'prop-starlamp.webp', slot: 'lamp', pos: { x: 85.7, y: 72, w: 5.6 } },
    { id: 'beanbag', name: 'Bunny beanbag', cost: 70, kind: 'furniture', note: 'Floppy ears and a pompom tail, on the rug. Swaps with the cloud armchair.', img: 'prop-beanbag.webp', slot: 'seat', pos: { x: 57, y: 70.5, w: 9 } },
    { id: 'armchair', name: 'Cloud armchair', cost: 90, kind: 'furniture', note: 'A puffy lilac cloud to sink into. Swaps with the bunny beanbag.', img: 'prop-armchair.webp', slot: 'seat', pos: { x: 57, y: 70.5, w: 9.5 } },
    { id: 'scale', name: 'Weighing scale', cost: 5, kind: 'furniture', note: 'Switches on weigh-ins: tap it to note your weight. Private, never judged, and no hearts for numbers.', img: 'prop-scale.webp', pos: { x: 44, y: 74.5, w: 7 } },
    { id: 'mewmew', name: 'Mewmew the Pomeranian', cost: 180, kind: 'pet', note: 'Jamie’s real girl: cream fluff, a pink nose and the happiest smile in Singapore. She sits wherever you place her.', img: 'prop-mewmew-v3.webp', pos: { x: 62, y: 86, w: 9 } },
    /* jev-1.13.0 (18 Oct): 1500 hearts chosen over 1200/2000/3000 (0.73) as motivating yet long-term; letting people visit first scored 0.74 */
    { id: 'house', name: 'Two-storey dream house', cost: 1500, kind: 'home', note: 'A cottage of your own: a sunny bedroom upstairs, a study and a yoga corner below, flowers at the door. Visit any time; move in when you have the hearts.', img: 'house-thumb.webp' },
    { id: 'bathhouse', name: 'Dream house with a bathtub', cost: 2500, kind: 'home', note: 'The cottage with a bubble bath upstairs beside your bedroom: tap the tub for a mindful soak. Visit first, move in when you have the hearts.', img: 'house-bath-thumb.webp' },
    { id: 'familyhome', name: 'Family dream home', cost: 4000, kind: 'home', note: 'A pastel kitchen for your food diary, a comfy living room with a big pink sofa, and a bubble bath upstairs. Visit first, move in when you have the hearts.', img: 'house-family-thumb.webp' }
  ];
  function ledger() { var st = S.state(); return st.rewards || { hearts: 0, earned: 0, log: [], owned: [], placed: {}, lastDay: null, streak: 0 }; }
  function write(l) { S.setState({ rewards: l }); return l; }
  /* Award for a saved entry; a first log on a new day also grows the streak. */
  function award(ev) {
    if (ev.type === 'weight') return { points: 0, bonus: 0, hearts: ledger().hearts }; /* numbers are never rewarded */
    var l = ledger(), pts = RULES[ev.type] || 0;
    if (ev.type === 'food') pts += Math.min(6, ((ev.data.items || []).length) * 2);
    if (ev.type === 'mindfulness') pts = ev.data.kind === 'informal' ? 5 + (ev.data.first ? 10 : 0) : Math.min(20, Math.round(Number(ev.data.minutes) || 0) * 2); /* everyday practice: 5, +10 the first time (jev 0.58 / 0.72) */
    var today = S.today(), bonus = 0;
    if (l.lastDay !== today) { l.streak = l.lastDay === S.addDays(today, -1) ? l.streak + 1 : 1; l.lastDay = today; if (l.streak >= 3) bonus = 5; }
    var total = pts + bonus;
    if (total <= 0) return { points: 0, bonus: 0, hearts: l.hearts };
    l.hearts += total; l.earned += total; l.log.unshift({ at: new Date().toISOString(), type: ev.type, points: pts, bonus: bonus }); l.log = l.log.slice(0, 200);
    write(l); return { points: pts, bonus: bonus, hearts: l.hearts, streak: l.streak };
  }
  function buy(id) {
    var l = ledger(), item = SHOP.filter(function (s) { return s.id === id; })[0];
    if (!item || item.locked) throw new Error('Not available yet.');
    if (l.owned.indexOf(id) > -1) throw new Error('Already yours.');
    if (l.hearts < item.cost) throw new Error('You need ' + (item.cost - l.hearts) + ' more hearts.');
    l.hearts -= item.cost; l.owned.push(id); l.placed[id] = true; item.swapped = swapOut(l, item); write(l); return item;
  }
  /* a one-off gift, e.g. finishing the intro */
  function grant(points, type) { var l = ledger(); points = Math.max(0, Math.round(points)); if (!points) return l; if ((l.log || []).some(function (x) { return x.type === type && x.gift; })) return l; l.hearts += points; l.earned += points; l.log.unshift({ at: new Date().toISOString(), type: type, points: points, bonus: 0, gift: true }); write(l); return l; }
  function toggle(id, on) { var l = ledger(); if (l.owned.indexOf(id) < 0) return false; l.placed[id] = !l.placed[id]; if (l.placed[id]) swapOut(l, SHOP.filter(function (s) { return s.id === id; })[0]); write(l); return l.placed[id]; }
  /* One piece per slot (seat, lamp, corner): placing one puts the others in its slot away. */
  var SLOTS = { seat: 'Seat on the rug', lamp: 'Lamp by the wardrobe', corner: 'Corner by the wardrobe', cat: 'One kitten at a time', dog: 'One puppy at a time' };
  function swapOut(l, item) { var out = []; if (!item || !item.slot) return out; SHOP.forEach(function (o) { if (o.slot === item.slot && o.id !== item.id && l.placed[o.id]) { l.placed[o.id] = false; out.push(o.name); } }); return out; }
  /* Pet care: a few hearts for kindness, capped per pet per day so it never becomes a chore. */
  var CARE = { feed: 2, play: 2, clean: 1, cuddle: 1 }, CARE_CAP = 10;
  function care(pet, action) {
    var l = ledger(), today = S.today(), pts = CARE[action] || 0;
    var c = l.care && l.care.day === today ? l.care : { day: today, by: {} };
    var got = c.by[pet] || 0, add = Math.max(0, Math.min(pts, CARE_CAP - got));
    c.by[pet] = got + add; l.care = c;
    if (add) { l.hearts += add; l.earned += add; l.log = l.log || []; l.log.unshift({ at: new Date().toISOString(), type: 'petcare', pet: pet, action: action, points: add }); l.log = l.log.slice(0, 200); }
    write(l); return { points: add, hearts: l.hearts, capped: add < pts };
  }
  root.OvuRewards = { SHOP: SHOP, SLOTS: SLOTS, RULES: RULES, ledger: ledger, award: award, buy: buy, toggle: toggle, grant: grant, care: care, CARE: CARE, CARE_CAP: CARE_CAP };
})(window);
