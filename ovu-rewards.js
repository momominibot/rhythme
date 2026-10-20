/* Hearts: a small reward ledger that encourages logging. Points never affect
 * health logic; they only unlock cosmetic props placed in the room. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var RULES = { sleep: 10, period: 10, symptom: 8, food: 6, reflection: 5, mindfulness: 0, exercise: 6 };
  var SHOP = [
    /* pets in a slot are options: one kitten and one puppy show at a time, the rest wait in your inventory.
     * posAs borrows the layout spot of the original pet; wk keeps each sprite the same height as the original. */
    { id: 'cat', name: 'Mochi the kitten', cost: 150, kind: 'pet', slot: 'cat', note: 'Cream and peach, curls up by the bed and purrs when you log.', img: 'prop-cat.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'catblack', name: 'Sesame the black kitten', cost: 150, kind: 'pet', slot: 'cat', posAs: 'cat', wk: 1.03, note: 'Golden eyes and a little moon charm. Happiest at night.', img: 'prop-cat-black.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'catginger', name: 'Mango the ginger tabby', cost: 150, kind: 'pet', slot: 'cat', posAs: 'cat', wk: 1.17, note: 'Orange stripes, a lavender collar and a jingly bell.', img: 'prop-cat-ginger.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'dog', name: 'Peach the corgi', cost: 220, kind: 'pet', slot: 'dog', wk: 1.02, note: 'Big ears, short legs and a lilac bow. Waits for you with a wiggly tail.', img: 'prop-corgi.webp', pos: { x: 22.9, y: 68.5, w: 8.5 } },
    { id: 'shiba', name: 'Hana the shiba', cost: 220, kind: 'pet', slot: 'dog', posAs: 'dog', wk: 1.13, note: 'Honey fur, a curly tail and a lavender bandana.', img: 'prop-shiba.webp', pos: { x: 22.9, y: 68.5, w: 8.5 } },
    { id: 'plant', name: 'Fairy-light monstera', cost: 60, kind: 'furniture', note: 'A glow-wrapped plant for the corner.', img: 'prop-plant.webp', slot: 'corner', pos: { x: 95.5, y: 71, w: 8 } },
    { id: 'bookshelf', name: 'Arched bookshelf', cost: 100, kind: 'furniture', note: 'Pastel books, a plush bunny and a tiny candle. Swaps with the monstera.', img: 'prop-bookshelf.webp', slot: 'corner', pos: { x: 87, y: 66, w: 10 } },
    { id: 'lamp', name: 'Crescent floor lamp', cost: 80, kind: 'furniture', note: 'Warm moonlight beside the wardrobe.', img: 'prop-lamp.webp', slot: 'lamp', pos: { x: 85.7, y: 72, w: 6.2 } },
    { id: 'mushlamp', name: 'Mushroom lamp', cost: 60, kind: 'furniture', note: 'A spotty pink glow. Swaps with the other lamps.', img: 'prop-mushlamp.webp', slot: 'lamp', pos: { x: 85.7, y: 72, w: 6.4 } },
    { id: 'starlamp', name: 'Star lantern', cost: 70, kind: 'furniture', note: 'A puffy star on a slim pole. Swaps with the other lamps.', img: 'prop-starlamp.webp', slot: 'lamp', pos: { x: 85.7, y: 72, w: 5.6 } },
    { id: 'beanbag', name: 'Bunny beanbag', cost: 70, kind: 'furniture', note: 'Floppy ears and a pompom tail, on the rug. Swaps with the cloud armchair.', img: 'prop-beanbag.webp', slot: 'seat', pos: { x: 57, y: 70.5, w: 9 } },
    { id: 'armchair', name: 'Cloud armchair', cost: 90, kind: 'furniture', note: 'A puffy lilac cloud to sink into. Swaps with the bunny beanbag.', img: 'prop-armchair.webp', slot: 'seat', pos: { x: 57, y: 70.5, w: 9.5 } },
    { id: 'scale', name: 'Weighing scale', cost: 5, kind: 'furniture', note: 'Switches on weigh-ins: tap it to note your weight. Private, never judged, and no hearts for numbers.', img: 'prop-scale.webp', pos: { x: 44, y: 74.5, w: 7 } },
    { id: 'mewmew', name: 'Mewmew the Pomeranian', cost: 180, kind: 'pet', note: 'Jamie’s real girl: cream fluff, a pink nose and the happiest smile in Singapore. She sits wherever you place her.', img: 'prop-mewmew-v3.webp', pos: { x: 62, y: 86, w: 9 } },
    /* pet shop shelves: treats are packs you use up (a treat tops up Full and Fun between meals), accessories are worn by one pet at a time */
    { id: 'treat-fish', name: 'Fish biscuits', cost: 12, kind: 'treat', qty: 5, for: 'cat', note: 'Five crunchy little fish for a kitten.', img: 'pet-treat-fish.webp' },
    { id: 'treat-bone', name: 'Bone crunchies', cost: 12, kind: 'treat', qty: 5, for: 'dog', note: 'Five pastel bones for a puppy.', img: 'pet-treat-bone.webp' },
    { id: 'treat-cake', name: 'Pupcake', cost: 10, kind: 'treat', qty: 1, for: 'any', note: 'One little cake for a special day. Any pet.', img: 'pet-treat-cake.webp' },
    { id: 'acc-bow', name: 'Satin bow', cost: 40, kind: 'accessory', wear: 'head', note: 'A big pink bow for the top of a head.', img: 'acc-bow.webp' },
    { id: 'acc-hat', name: 'Party hat', cost: 45, kind: 'accessory', wear: 'head', note: 'A tiny lilac hat with a pompom.', img: 'acc-hat.webp' },
    { id: 'acc-bandana', name: 'Polka bandana', cost: 40, kind: 'accessory', wear: 'neck', note: 'Lilac with cream dots, tied at the neck.', img: 'acc-bandana.webp' },
    { id: 'acc-charm', name: 'Moon charm collar', cost: 50, kind: 'accessory', wear: 'neck', note: 'A cream collar with a golden crescent.', img: 'acc-charm.webp' },
    /* jev-1.13.0 (18 Oct): 1500 hearts chosen over 1200/2000/3000 (0.73) as motivating yet long-term; letting people visit first scored 0.74 */
    { id: 'house', name: 'Two-storey dream house', cost: 1500, kind: 'home', note: 'A cottage of your own: a sunny bedroom upstairs, a study and a yoga corner below, flowers at the door. Visit any time; move in when you have the hearts.', img: 'house-thumb.webp' },
    { id: 'bathhouse', name: 'Dream house with a bathtub', cost: 2500, kind: 'home', note: 'The cottage with a bubble bath upstairs beside your bedroom: tap the tub for a mindful soak. Visit first, move in when you have the hearts.', img: 'house-bath-thumb.webp' },
    { id: 'familyhome', name: 'Family dream home', cost: 4000, kind: 'home', note: 'A pastel kitchen for your food diary, a comfy living room with a big pink sofa, and a bubble bath upstairs. Visit first, move in when you have the hearts.', img: 'house-family-thumb.webp' }
  ];
  /* items taken out of the shop: anyone who bought one gets the hearts back once */
  var RETIRED = { catgrey: 150 };
  /* Movement is logged data, so it earns like a meal, but once a day: the first exercise log of the day pays RULES.exercise,
     later ones that day pay nothing. Hearts never depend on minutes, effort or MET, so nothing rewards doing more or harder
     than you did (economy review, 19 Oct: one award per domain per day, nothing for health outcomes). */
  function exercisePoints(l) {
    var day = S.today();
    if (!l.moveDay || l.moveDay.day !== day) l.moveDay = { day: day, pts: 0 };
    var add = Math.max(0, Math.min(RULES.exercise, RULES.exercise - l.moveDay.pts));
    l.moveDay.pts += add; return add;
  }
  function ledger() {
    var st = S.state(), l = st.rewards || { hearts: 0, earned: 0, log: [], owned: [], placed: {}, lastDay: null, streak: 0 };
    var gone = (l.owned || []).filter(function (id) { return RETIRED[id]; });
    if (!gone.length) return l;
    gone.forEach(function (id) { l.hearts += RETIRED[id]; l.owned.splice(l.owned.indexOf(id), 1); delete l.placed[id]; l.log.unshift({ at: new Date().toISOString(), type: 'refund', item: id, points: RETIRED[id] }); });
    if (l.owned.indexOf('cat') > -1 && !SHOP.some(function (o) { return o.slot === 'cat' && l.placed[o.id]; })) l.placed.cat = true;
    S.setState({ rewards: l }); return l;
  }
  function write(l) { S.setState({ rewards: l }); return l; }
  /* tester mode (room.html?tester=hearts): nothing is deducted on this device, so every shelf can be tried */
  function tester() { var t = S.state().tester; return !!(t && t.hearts); }
  /* Practice is a small, flat thank-you (Jamie, 19 Oct: hearts are for logging data; mindfulness contributes a small
     amount): 2 hearts for a completed practice, session or watering, at most 6 a day across all practice, nothing for
     length, taps or first times. Moon Tap counts once a session reaches a full minute; seconds are not carried. */
  var PRACTICE = { points: 2, cap: 6 };
  function practicePoints(l, ev) {
    var d = ev.data || {}, day = S.today();
    if (d.kind === 'breathtap' && (Number(d.seconds) || 0) < 60) return 0;
    if (!l.mindDay || l.mindDay.day !== day) l.mindDay = { day: day, pts: 0 };
    var add = Math.max(0, Math.min(PRACTICE.points, PRACTICE.cap - l.mindDay.pts));
    l.mindDay.pts += add; return add;
  }
  /* Award for a saved entry; a first log on a new day also grows the streak. */
  /* a saved record earns once: editing it again returns the same receipt and no hearts */
  function receipted(l, ev) { l.receipts = l.receipts || {}; if (!ev || !ev.id) return false; if (l.receipts[ev.id]) return true; l.receipts[ev.id] = 1; var ks = Object.keys(l.receipts); if (ks.length > 3000) ks.slice(0, ks.length - 3000).forEach(function (k) { delete l.receipts[k]; }); return false; }
  function award(ev) {
    if (ev.type === 'weight') return { points: 0, bonus: 0, hearts: ledger().hearts }; /* numbers are never rewarded */
    var l0 = ledger(); if (receipted(l0, ev)) { write(l0); return { points: 0, bonus: 0, hearts: l0.hearts, streak: l0.streak, again: true }; } write(l0);
    if (ev.type === 'mindfulness' && ev.data && ev.data.kind === 'breathtap') {
      /* Moon Tap: the flat practice thank-you once a session reaches a full minute; never touches the streak, nothing for taps */
      var lb = ledger(), bp = practicePoints(lb, ev);
      if (bp) { lb.hearts += bp; lb.earned += bp; lb.log = lb.log || []; lb.log.unshift({ at: new Date().toISOString(), type: 'breathtap', points: bp }); lb.log = lb.log.slice(0, 200); }
      write(lb); return { points: bp, bonus: 0, hearts: lb.hearts, streak: lb.streak };
    }
    var l = ledger(), pts = RULES[ev.type] || 0;
    if (ev.type === 'exercise') pts = exercisePoints(l);
    if (ev.type === 'mindfulness') pts = practicePoints(l, ev); /* a flat small thank-you, capped per day */
    /* no streak bonus and no per-item meal bonus (four-persona review, 20 Oct, every persona and every model: a run of days and
     * a longer meal list are pressure, and hearts are for logging, not for logging more). The days-logged count stays as a
     * plain record; it never changes what anything earns. */
    var today = S.today(), bonus = 0;
    if (l.lastDay !== today) { l.streak = l.lastDay === S.addDays(today, -1) ? l.streak + 1 : 1; l.lastDay = today; }
    var total = pts + bonus;
    if (total <= 0) return { points: 0, bonus: 0, hearts: l.hearts };
    l.hearts += total; l.earned += total; l.log.unshift({ at: new Date().toISOString(), type: ev.type, points: pts, bonus: bonus }); l.log = l.log.slice(0, 200);
    write(l); return { points: pts, bonus: bonus, hearts: l.hearts, streak: l.streak };
  }
  function buy(id) {
    var l = ledger(), item = SHOP.filter(function (s) { return s.id === id; })[0];
    if (!item || item.locked) throw new Error('Not available yet.');
    if (item.kind !== 'treat' && l.owned.indexOf(id) > -1) throw new Error('Already yours.');
    if (l.hearts < item.cost && !tester()) throw new Error('You need ' + (item.cost - l.hearts) + ' more hearts.');
    if (!tester()) l.hearts -= item.cost;
    if (item.kind === 'treat') { l.treats = l.treats || {}; l.treats[id] = (l.treats[id] || 0) + (item.qty || 1); write(l); return item; }
    l.owned.push(id); l.placed[id] = item.kind !== 'accessory'; item.swapped = swapOut(l, item);
    if (item.kind === 'pet' && l.placed[id] && petsAtHome(l, id) >= 2) { l.placed[id] = false; item.waiting = true; } /* adopted, waits in the inventory until a pet goes away */
    write(l); return item;
  }
  function item(id) { return SHOP.filter(function (s) { return s.id === id; })[0] || null; }
  function petKind(petId) { var p = item(petId); return p && p.slot === 'cat' ? 'cat' : 'dog'; }
  /* treats in the cupboard that this pet can have, most plentiful first */
  function treatsFor(petId) {
    var l = ledger(), t = l.treats || {}, k = petKind(petId);
    return SHOP.filter(function (s) { return s.kind === 'treat' && (t[s.id] || 0) > 0 && (s.for === 'any' || s.for === k); })
      .map(function (s) { return { id: s.id, name: s.name, img: s.img, left: t[s.id] }; }).sort(function (a, b) { return b.left - a.left; });
  }
  function useTreat(petId, treatId) {
    var l = ledger(), t = l.treats || {}; if (!(t[treatId] > 0)) throw new Error('None of those left.');
    t[treatId] -= 1; if (!t[treatId]) delete t[treatId]; l.treats = t; write(l); return { left: t[treatId] || 0, item: item(treatId) };
  }
  /* accessories: one per pet, and each piece is worn by one pet at a time */
  function wearing(petId) { var w = ledger().wear || {}; return w[petId] ? item(w[petId]) : null; }
  function wear(petId, accId) {
    var l = ledger(), w = l.wear || {};
    if (accId && (l.owned.indexOf(accId) < 0 || !item(accId) || item(accId).kind !== 'accessory')) throw new Error('Not in the drawer.');
    Object.keys(w).forEach(function (p) { if (w[p] === accId) delete w[p]; });
    if (accId) w[petId] = accId; else delete w[petId];
    l.wear = w; write(l); return accId ? item(accId) : null;
  }
  /* tap Dress up again and again: each owned piece in turn, then nothing */
  function nextWear(petId) {
    var l = ledger(), owned = SHOP.filter(function (s) { return s.kind === 'accessory' && l.owned.indexOf(s.id) > -1; }).map(function (s) { return s.id; });
    if (!owned.length) return null;
    var cur = (l.wear || {})[petId] || null, i = owned.indexOf(cur), next = i < 0 ? owned[0] : (i + 1 < owned.length ? owned[i + 1] : null);
    return wear(petId, next);
  }
  /* a one-off gift, e.g. finishing the intro */
  function grant(points, type) { var l = ledger(); points = Math.max(0, Math.round(points)); if (!points) return l; l.gifts = l.gifts || {}; if (l.gifts[type] || (l.log || []).some(function (x) { return x.type === type && x.gift; })) return l; l.gifts[type] = true; l.hearts += points; l.earned += points; l.log.unshift({ at: new Date().toISOString(), type: type, points: points, bonus: 0, gift: true }); write(l); return l; }
  /* two pets at home at a time, whatever their kind */
  function petsAtHome(l, except) { return SHOP.filter(function (s) { return s.kind === 'pet' && s.id !== except && l.owned.indexOf(s.id) > -1 && l.placed[s.id]; }).length; }
  function toggle(id, on) { var l = ledger(); if (l.owned.indexOf(id) < 0) return false; var it = item(id); if (it && it.kind === 'pet' && !l.placed[id] && !(it.slot && SHOP.some(function (o) { return o.slot === it.slot && o.id !== id && l.placed[o.id]; })) && petsAtHome(l, id) >= 2) throw new Error('Two pets at home at a time. Put one away first.'); l.placed[id] = !l.placed[id]; if (l.placed[id]) swapOut(l, SHOP.filter(function (s) { return s.id === id; })[0]); write(l); return l.placed[id]; }
  /* One piece per slot (seat, lamp, corner): placing one puts the others in its slot away. */
  var SLOTS = { seat: 'Seat on the rug', lamp: 'Lamp by the wardrobe', corner: 'Corner by the wardrobe', cat: 'One kitten at a time', dog: 'One puppy at a time' };
  function swapOut(l, item) { var out = []; if (!item || !item.slot) return out; SHOP.forEach(function (o) { if (o.slot === item.slot && o.id !== item.id && l.placed[o.id]) { l.placed[o.id] = false; out.push(o.name); } }); return out; }
  /* Pet care earns nothing (Jamie, 19 Oct: hearts are for logging, not for play); the kindness is its own reward.
     The function stays so the pets' actions keep working and the ledger shape is unchanged. */
  var CARE = { feed: 0, play: 0, clean: 0, cuddle: 0 }, CARE_CAP = 0;
  function care(pet, action) {
    var l = ledger(), today = S.today(), pts = CARE[action] || 0;
    var c = l.care && l.care.day === today ? l.care : { day: today, by: {} };
    var got = c.by[pet] || 0, add = Math.max(0, Math.min(pts, CARE_CAP - got));
    c.by[pet] = got + add; l.care = c;
    if (add) { l.hearts += add; l.earned += add; l.log = l.log || []; l.log.unshift({ at: new Date().toISOString(), type: 'petcare', pet: pet, action: action, points: add }); l.log = l.log.slice(0, 200); }
    write(l); return { points: add, hearts: l.hearts, capped: add < pts };
  }
  root.OvuRewards = { SHOP: SHOP, SLOTS: SLOTS, RULES: RULES, PRACTICE: PRACTICE, ledger: ledger, award: award, buy: buy, tester: tester, toggle: toggle, grant: grant, care: care, item: item, treatsFor: treatsFor, useTreat: useTreat, wearing: wearing, wear: wear, nextWear: nextWear, CARE: CARE, CARE_CAP: CARE_CAP };
})(window);
