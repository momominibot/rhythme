/* Rhythme no-stress pet care (a gentle Tamagotchi). Pets can be fed, played with, cuddled and
 * tidied up after, and nothing bad ever happens: needs fade slowly but never below "would love a
 * snack", there is no illness, sadness, death or nagging notification, and a little poop appears
 * about 90 minutes after a meal (at most two waiting) and simply waits until it is tapped.
 * State lives in the store under state.pets so it syncs and exports with everything else. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var NAMES = { cat: 'Mochi', catblack: 'Sesame', catginger: 'Mango', dog: 'Peach', shiba: 'Hana', mewmew: 'Mewmew' };
  var FLOOR = 35, DECAY_FULL = 6, DECAY_FUN = 5, POOP_AFTER = 90, MAX_POOPS = 2, FULL_ENOUGH = 88, FUN_ENOUGH = 92;
  function all() { return Object.assign({}, S.state().pets || {}); }
  function iso(t) { return new Date(t).toISOString(); }
  function now(t) { return typeof t === 'number' ? t : Date.now(); }
  /* The pet as of time t: needs faded since the last save, and the meal's poop added once it is due. */
  function current(id, t) {
    t = now(t);
    var saved = all()[id] || {};
    var p = { full: 70, fun: 70, at: null, fedAt: null, playedAt: null, cuddledAt: null, poops: [], poopFor: null };
    Object.keys(saved).forEach(function (k) { p[k] = saved[k]; });
    p.poops = (p.poops || []).slice();
    var h = p.at ? Math.max(0, (t - Date.parse(p.at)) / 3600000) : 0;
    p.full = Math.max(FLOOR, Math.min(100, p.full - DECAY_FULL * h));
    p.fun = Math.max(FLOOR, Math.min(100, p.fun - DECAY_FUN * h));
    p.at = iso(t);
    if (p.fedAt && p.poopFor !== p.fedAt && t - Date.parse(p.fedAt) >= POOP_AFTER * 60000) {
      p.poopFor = p.fedAt;
      if (p.poops.length < MAX_POOPS) p.poops.push({ id: 'p' + t.toString(36) + p.poops.length, side: p.poops.length ? -1 : 1, at: iso(Date.parse(p.fedAt) + POOP_AFTER * 60000) });
    }
    return p;
  }
  function save(id, p) {
    var a = all();
    a[id] = { full: Math.round(p.full), fun: Math.round(p.fun), at: p.at, fedAt: p.fedAt, playedAt: p.playedAt, cuddledAt: p.cuddledAt, poops: p.poops, poopFor: p.poopFor };
    S.setState({ pets: a });
    return current(id, Date.parse(p.at));
  }
  function tick(id, t) { return save(id, current(id, t)); }
  function feed(id, t) {
    t = now(t); var p = current(id, t);
    if (p.full >= FULL_ENOUGH) { save(id, p); return { ok: false, reason: 'full', pet: p }; }
    p.full = 100; p.fedAt = iso(t); return { ok: true, pet: save(id, p) };
  }
  function play(id, t) {
    t = now(t); var p = current(id, t);
    if (p.fun >= FUN_ENOUGH) { save(id, p); return { ok: false, reason: 'played', pet: p }; }
    p.fun = 100; p.full = Math.max(FLOOR, p.full - 4); p.playedAt = iso(t); return { ok: true, pet: save(id, p) };
  }
  /* a treat between meals: a top-up, never a full meal, and still one poop per feed */
  function treat(id, t) {
    t = now(t); var p = current(id, t);
    if (p.full >= 96) { save(id, p); return { ok: false, reason: 'full', pet: p }; }
    p.full = Math.min(100, p.full + 25); p.fun = Math.min(100, p.fun + 12); p.fedAt = iso(t); return { ok: true, pet: save(id, p) };
  }
  /* where a head piece or a neck piece sits, as fractions of the sprite box (x from the left, y from the top, w of the box width) */
  var WEAR = {
    cat: { head: { x: 0.50, y: 0.10, w: 0.46 }, neck: { x: 0.50, y: 0.60, w: 0.42 } },
    catblack: { head: { x: 0.50, y: 0.10, w: 0.46 }, neck: { x: 0.50, y: 0.60, w: 0.42 } },
    catginger: { head: { x: 0.50, y: 0.10, w: 0.46 }, neck: { x: 0.50, y: 0.60, w: 0.42 } },
    dog: { head: { x: 0.52, y: 0.08, w: 0.46 }, neck: { x: 0.50, y: 0.68, w: 0.52 } },
    shiba: { head: { x: 0.52, y: 0.08, w: 0.46 }, neck: { x: 0.50, y: 0.66, w: 0.52 } },
    mewmew: { head: { x: 0.50, y: 0.10, w: 0.46 }, neck: { x: 0.50, y: 0.62, w: 0.50 } }
  };
  function wearSpot(id, where) { var w = WEAR[id] || WEAR.cat; return w[where] || w.head; }
  function cuddle(id, t) { t = now(t); var p = current(id, t); p.fun = Math.min(100, p.fun + 8); p.cuddledAt = iso(t); return { ok: true, pet: save(id, p) }; }
  function clean(id, poopId, t) {
    var p = current(id, now(t)), n = p.poops.length;
    p.poops = p.poops.filter(function (x) { return poopId ? x.id !== poopId : false; });
    return { ok: p.poops.length < n, cleaned: n - p.poops.length, pet: save(id, p) };
  }
  /* Gentle wording only. A mess is mentioned first because it is the one thing to tap. */
  function mood(id, opts) {
    opts = opts || {}; var p = current(id, opts.t), name = NAMES[id] || 'Your pet';
    if (p.poops.length) return { key: 'mess', icon: 'cleaning_services', text: name + ' left a little surprise. No rush.' };
    if (opts.night) return { key: 'nap', icon: 'bedtime', text: name + ' is napping. Cuddles are still welcome.' };
    if (p.full < 55) return { key: 'snack', icon: 'restaurant', text: name + ' would love a snack.' };
    if (p.fun < 55) return { key: 'play', icon: 'sports_baseball', text: name + ' wants to play.' };
    return { key: 'happy', icon: 'favorite', text: name + ' is happy and cosy.' };
  }
  /* 2 to 5 little hearts: the floor keeps it from ever looking empty. */
  function pips(v) { return Math.max(2, Math.min(5, Math.round(v / 20))); }
  root.OvuPets = { NAMES: NAMES, current: current, tick: tick, feed: feed, treat: treat, play: play, cuddle: cuddle, clean: clean, mood: mood, pips: pips, wearSpot: wearSpot, WEAR: WEAR, FLOOR: FLOOR, POOP_AFTER: POOP_AFTER, MAX_POOPS: MAX_POOPS };
})(window);
