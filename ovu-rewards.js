/* Hearts: a small reward ledger that encourages logging. Points never affect
 * health logic; they only unlock cosmetic props placed in the room. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var RULES = { sleep: 10, period: 10, symptom: 8, food: 6, reflection: 5, mindfulness: 0 };
  var SHOP = [
    { id: 'cat', name: 'Mochi the kitten', cost: 150, kind: 'pet', note: 'Curls up by the bed and purrs when you log.', img: 'prop-cat.webp', pos: { x: 55.4, y: 81, w: 8 } },
    { id: 'dog', name: 'Biscuit the puppy', cost: 220, kind: 'pet', note: 'Waits for you on the floor with a wagging tail.', img: 'prop-dog.webp', pos: { x: 22.9, y: 68.5, w: 8.5 } },
    { id: 'plant', name: 'Fairy-light monstera', cost: 60, kind: 'furniture', note: 'A glow-wrapped plant for the corner.', img: 'prop-plant.webp', pos: { x: 95.5, y: 71, w: 8 } },
    { id: 'lamp', name: 'Crescent floor lamp', cost: 80, kind: 'furniture', note: 'Warm moonlight beside the wardrobe.', img: 'prop-lamp.webp', pos: { x: 85.7, y: 72, w: 6.2 } },
    { id: 'house', name: 'Two-storey dream house', cost: 2000, kind: 'home', note: 'A bigger home with a second floor. Coming soon; hearts you save now count.', img: null, locked: true }
  ];
  function ledger() { var st = S.state(); return st.rewards || { hearts: 0, earned: 0, log: [], owned: [], placed: {}, lastDay: null, streak: 0 }; }
  function write(l) { S.setState({ rewards: l }); return l; }
  /* Award for a saved entry; a first log on a new day also grows the streak. */
  function award(ev) {
    var l = ledger(), pts = RULES[ev.type] || 0;
    if (ev.type === 'food') pts += Math.min(6, ((ev.data.items || []).length) * 2);
    if (ev.type === 'mindfulness') pts = Math.min(20, Math.round(Number(ev.data.minutes) || 0) * 2);
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
    l.hearts -= item.cost; l.owned.push(id); l.placed[id] = true; write(l); return item;
  }
  function toggle(id) { var l = ledger(); if (l.owned.indexOf(id) < 0) return false; l.placed[id] = !l.placed[id]; write(l); return l.placed[id]; }
  root.OvuRewards = { SHOP: SHOP, RULES: RULES, ledger: ledger, award: award, buy: buy, toggle: toggle };
})(window);
