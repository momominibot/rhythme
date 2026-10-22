/* Rhythme community plaza: a fountain, lanterns, a noticeboard, a tea stall and two benches, with
 * neighbours standing about. Until accounts land the neighbours are samples, kept behind
 * OvuCommunity.neighbours() so real friends can be plugged in without touching the scene. Visiting a
 * neighbour applies her home layout as a read-only visit: hotspots are inert, your own props are not
 * drawn, and nothing you tap there writes to anyone's diary. Pure data and rules first (testable in
 * node), then the scene wiring, which mounts when room.js announces boot through window.OvuRoom. */
(function (root) {
  'use strict';
  /* ---------- samples until accounts exist ---------- */
  var NEIGHBOURS = [
    { id: 'mei', name: 'Mei', outfit: 'kebaya-blue', pet: { id: 'corgi', img: 'prop-corgi.webp', name: 'Butter', w: 8.5 }, home: 'house', spot: { x: 42, y: 60, flip: false }, petSpot: { x: 35, y: 62 }, line: 'Lovely light today. My plot is almost in bloom.', sample: true },
    { id: 'nadia', name: 'Nadia', outfit: 'kebaya-green', pet: { id: 'catginger', img: 'prop-cat-ginger.webp', name: 'Teh', w: 8 }, home: 'bathhouse', spot: { x: 54, y: 55, flip: true }, petSpot: { x: 60, y: 60 }, line: 'I sit by the fountain when my head is full. It helps.', sample: true },
    { id: 'priya', name: 'Priya', outfit: 'cozy', pet: { id: 'shiba', img: 'prop-shiba.webp', name: 'Momo', w: 8.5 }, home: 'familyhome', spot: { x: 24, y: 60, flip: true }, petSpot: { x: 16, y: 60 }, line: 'Tea first, then everything else.', sample: true },
    { id: 'sofia', name: 'Sofia', outfit: 'party', pet: { id: 'cat', img: 'prop-cat.webp', name: 'Pudding', w: 8 }, home: 'house', spot: { x: 80, y: 62, flip: true }, petSpot: { x: 74, y: 63 }, line: 'Three slow breaths on the bench. That is my whole plan.', sample: true }
  ];
  /* the one seam for real people: ovu-friends.js hands over the plaza-card holders in her group,
   * [{id, real, handle, name, outfit, friend, spot}]; while any are shown the samples step aside, so a sample is never
   * mistaken for a person */
  var people = null, openPerson = null;
  function neighbours() { var real = people ? people() : null; return real && real.length ? real : NEIGHBOURS.slice(); }
  function neighbour(id) { return neighbours().filter(function (n) { return n.id === id; })[0] || null; }
  function setPeople(fn, open) { people = typeof fn === 'function' ? fn : null; openPerson = typeof open === 'function' ? open : null; }
  /* gentle prompts for the noticeboard, one per day, chosen by the date so everyone sees the same one */
  var PROMPTS = [
    'Notice three sounds on the way home today.',
    'One kind sentence to yourself before bed. That is all.',
    'Drink a glass of water before your next coffee.',
    'Step outside for two minutes of daylight, no phone.',
    'Stretch your neck, slowly, each side, while the kettle boils.',
    'Tell someone one small thing that went right today.',
    'Put your feet up for five minutes. Really up.',
    'Write down what you are carrying. It can wait on paper.',
    'Walk the long way round once today, just because.',
    'Breathe out longer than you breathe in, four times.',
    'Eat one meal today without a screen.',
    'Say no to one thing that does not need you today.',
    'Open a window. Let the room breathe with you.',
    'A warm drink, held with both hands, for a whole minute.'
  ];
  var NOTES = [
    { by: 'Mei', text: 'The bench under the blossom tree gets the evening light. Try it around six.', sample: true },
    { by: 'Nadia', text: 'Sat by the fountain for two minutes and just listened. The water sounds like rain.', sample: true }, /* no sample note claims a remedy worked (four-persona review, 20 Oct) */
    { by: 'Priya', text: 'Day 12 of watering. The plot has leaves! No pressure, it waits for you.', sample: true }
  ];
  function dayIndex(iso) { var t = Date.parse((iso || '1970-01-01') + 'T00:00:00Z'); return Math.floor(t / 86400000); }
  function promptFor(iso) { var i = dayIndex(iso) % PROMPTS.length; return PROMPTS[(i + PROMPTS.length) % PROMPTS.length]; }
  var C = { NEIGHBOURS: NEIGHBOURS, PROMPTS: PROMPTS, NOTES: NOTES, neighbours: neighbours, neighbour: neighbour, setPeople: setPeople, promptFor: promptFor, dayIndex: dayIndex };
  root.OvuCommunity = C;

  /* rendered 18 Oct 2026 (Seedream 5.0 pro, seed 7302, 1472x1840): positions read off a 5% grid */
  var PLAZA = {
    id: 'plaza', scene: 'plaza', name: 'The plaza', img: 'plaza-v1.webp', w: 1472, h: 1840, avatarW: 12, only: [],
    hotspots: [
      { id: 'arch', x: 12, y: 51, label: 'Arch · back to the street', icon: 'park', wp: { x: 20, y: 58, flip: true } },
      { id: 'board', x: 30, y: 41, label: 'Noticeboard · today’s note', icon: 'push_pin', wp: { x: 30, y: 56, flip: true } },
      { id: 'fountain', x: 50, y: 39, label: 'Fountain · make a wish', icon: 'water', wp: { x: 50, y: 56, flip: false } },
      { id: 'stall', x: 66, y: 43, label: 'Tea stall · a cup for your phase', icon: 'emoji_food_beverage', wp: { x: 62, y: 58, flip: false } },
      { id: 'bench', x: 38, y: 69, label: 'Bench · sit a while', icon: 'chair', wp: { x: 34, y: 64, flip: true } },
      { id: 'bench2', x: 73, y: 60, label: 'Bench · sit a while', icon: 'chair', wp: { x: 62, y: 62, flip: false } },
      { id: 'gate', x: 62, y: 67, label: 'Gate · home', icon: 'door_open', wp: { x: 54, y: 64, flip: false } }
    ],
    home: { x: 20, y: 58, flip: false },
    zones: [[[50, 44], [90, 58], [50, 76], [10, 58]]],
    solids: [{ id: 'board', x0: 22, x1: 38, y0: 38, y1: 52 }, { id: 'fountain', x0: 38, x1: 60, y0: 40, y1: 52 }, { id: 'stall', x0: 56, x1: 76, y0: 44, y1: 56 }, { id: 'tree', x0: 76, x1: 94, y0: 46, y1: 60 }, { id: 'bench', x0: 64, x1: 82, y0: 58, y1: 65 }, { id: 'bench', x0: 30, x1: 46, y0: 66, y1: 74 }, { id: 'gate', x0: 58, x1: 68, y0: 64, y1: 72 }, { id: 'pot', x0: 20, x1: 30, y0: 62, y1: 70 }, { id: 'pot', x0: 46, x1: 56, y0: 70, y1: 78 }, { id: 'pot', x0: 64, x1: 70, y0: 67, y1: 72 }, { id: 'arch', x0: 6, x1: 19, y0: 46, y1: 62 }],
    doors: [{ id: 'arch', to: 'street', x: 20, y: 58, r: 5, flip: true }, { id: 'gate', to: 'home', x: 54, y: 64, r: 4.5, flip: false }],
    meditator: { x: 37, y: 66, w: 11, seat: { x: 36.5, seatY: 66, groundY: 70, face: 'left' } }, aura: { x: 37, y: 64, w: 17 }, holo: { x: 47, y: 64, w: 14 },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 },
    props: {}
  };
  var BENCH2 = { sit: { x: 72, y: 59, w: 11, seat: { x: 71.5, seatY: 60, groundY: 63.5, face: 'left' } }, holo: { x: 82, y: 58, w: 14 }, back: { x: 62, y: 62, flip: false } };
  C.LAYOUT = PLAZA; C.BENCH2 = BENCH2;
  /* ---------- the scene ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var S = root.OvuStore, doc = root.document, ART = R.ART, visit = null;
  R.LAYOUTS.plaza = PLAZA;
  function esc(s) { return R.esc(s); }
  function inPlaza(L) { return L && L.id === 'plaza'; }
  function notesState() { var c = S.state().community || {}; return { notes: (c.notes || []).slice(), hellos: c.hellos || {} }; }
  function copiedNotes() { return JSON.parse(JSON.stringify(S.state().community || {})); }

  /* display-only nodes: the class .nb keeps them out of the room's pet and tool click handling */
  function nbNode(n, spot, cls) {
    var d = doc.createElement('div'); d.className = 'nb ' + cls + (spot.flip ? ' flip' : ''); d.dataset.id = 'nb-' + n.id; d.dataset.nb = n.id;
    d.style.left = spot.x + '%'; d.style.top = spot.y + '%'; d.style.width = (spot.w || 11) + '%';
    return d;
  }
  function renderNeighbours() {
    var wrap = R.els.props;
    Array.prototype.slice.call(wrap.querySelectorAll('.nb')).forEach(function (el) { el.remove(); }); /* props re-render clears the wrap, a layout change does not */
    neighbours().forEach(function (n) {
      var el = nbNode(n, n.spot, 'nbperson' + (n.real ? ' nbreal' + (n.friend ? ' nbfriend' : '') : '')); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', n.real ? n.name + (n.friend ? ', your friend' : '') + ', in your group. Tap to see her card.' : n.name + (n.sample ? ', a sample neighbour' : '') + '. Tap to say hello or visit.');
      el.innerHTML = '<img src="' + ART + 'avatar-' + n.outfit + '.webp" alt=""><span class="nbtag">' + (n.friend ? '<span class="ms" aria-hidden="true">favorite</span>' : '') + esc(n.name) + '</span>'; wrap.appendChild(el);
      if (n.pet) { var p = nbNode(n, { x: n.petSpot.x, y: n.petSpot.y, w: n.pet.w }, 'nbpet'); p.innerHTML = '<img src="' + ART + n.pet.img + '" alt="">'; wrap.appendChild(p); }
    });
  }
  function openNeighbour(id) {
    var n = neighbour(id); if (!n || root.OvuWalk.napping()) return; var hellos = notesState().hellos, said = hellos[id] === S.today();
    R.openSheet('neighbour', n.name, n.sample ? 'A sample neighbour, until friends can join' : 'Your neighbour', 'waving_hand',
      '<div class="nbcard"><img src="' + ART + 'avatar-' + n.outfit + '.webp" alt=""><div><p>“' + esc(n.line) + '”</p><small>' + (n.pet ? 'With ' + esc(n.pet.name) + '. ' : '') + 'Lives in ' + esc({ house: 'the two-storey cottage', bathhouse: 'the cottage with the bath', familyhome: 'the family home' }[n.home] || 'a dream house') + '.</small></div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="nbHello"' + (said ? ' disabled' : '') + '><span class="ms">waving_hand</span>' + (said ? 'You said hello today' : 'Say hello') + '</button><button type="button" class="btn soft" id="nbVisit"><span class="ms">cottage</span>Visit her home</button></div>' +
      '<p class="help">Neighbours are samples for now. Nothing here is sent anywhere, and visiting changes nothing of theirs or yours.</p>');
    doc.getElementById('nbHello').addEventListener('click', function () {
      var c = copiedNotes(); c.hellos = c.hellos || {}; c.hellos[id] = S.today();
      try { S.commit({ community: c }); } catch (e) { R.toast('Your hello could not be saved. Please try again.', 'info'); return; }
      R.closeSheet(); R.chime('save'); R.toast(n.name + ' waves back. ' + ['A good day to you too.', 'Nice to see you.', 'See you at the fountain.'][Math.floor(Math.random() * 3)], 'waving_hand', R.moment ? R.moment('hello', { quiet: true }) : '');
      var el = doc.querySelector('.nbperson[data-nb="' + id + '"]'); if (el) { el.classList.remove('wave'); void el.offsetWidth; el.classList.add('wave'); }
    });
    doc.getElementById('nbVisit').addEventListener('click', function () { R.closeSheet(); root.setTimeout(function () { visitNeighbour(id); }, 60); });
  }
  /* a visit: her home layout as a read-only scene; your own things stay home, hers stand in */
  function visitNeighbour(id) {
    var n = neighbour(id); if (!n || !R.LAYOUTS[n.home]) return;
    var ok = root.OvuWalk.travel(n.home, { visit: true, after: function (L) { visit = n; dressVisit(L); R.renderProps(); R.toast('Visiting ' + n.name + '. Tap Back when you are done.', 'cottage'); } });
    if (!ok) return;
  }
  function dressVisit(L) {
    R.els.scene.classList.add('nbvisit');
    var vb = R.els.visitBar; vb.classList.add('on');
    vb.innerHTML = '<span class="ms">cottage</span><span>Visiting <b>' + esc(visit.name) + '’s home</b> · a sample until friends can join</span><button type="button" id="nbBack"><span class="ms">arrow_back</span>Back</button>';
  }
  function renderVisit() {
    if (!visit) return; var wrap = R.els.props, L = R.layout(); wrap.innerHTML = '';
    var spot = { x: L.home.x - 14, y: L.home.y, flip: false, w: (L.avatarW || 10) * 0.95 };
    var el = nbNode(visit, spot, 'nbperson'); el.innerHTML = '<img src="' + ART + 'avatar-' + visit.outfit + '.webp" alt=""><span class="nbtag">' + esc(visit.name) + '</span>'; wrap.appendChild(el);
    if (visit.pet) { var isDog = /corgi|shiba/.test(visit.pet.id), pp = (L.props && (isDog ? L.props.dog : L.props.cat)) || { x: 55, y: 82, w: 8 }; var p = nbNode(visit, { x: pp.x, y: pp.y, w: pp.w }, 'nbpet'); p.innerHTML = '<img src="' + ART + visit.pet.img + '" alt="">'; wrap.appendChild(p); }
    if (!R.els.visitBar.querySelector('#nbBack')) dressVisit(L);
  }
  function endVisit() { if (!visit) return; visit = null; R.els.scene.classList.remove('nbvisit'); }
  function openBoard() {
    if (root.OvuWalk.napping()) return;
    var st = notesState(), today = S.today();
    R.openSheet('board', 'Noticeboard', 'A gentle note for today, and what neighbours pinned', 'push_pin',
      '<div class="notice today"><span class="ms">auto_awesome</span><div><b>Today’s gentle prompt</b><p>' + esc(promptFor(today)) + '</p></div></div>' +
      '<div class="notices">' + NOTES.map(function (n) { return '<div class="notice"><span class="ms">sticky_note_2</span><div><p>' + esc(n.text) + '</p><small>' + esc(n.by) + (n.sample ? ' · sample' : '') + '</small></div></div>'; }).join('') +
      st.notes.slice(-3).reverse().map(function (n) { return '<div class="notice mine"><span class="ms">favorite</span><div><p>' + esc(n.text) + '</p><small>You · ' + esc(n.date) + ' · only on this phone</small></div></div>'; }).join('') + '</div>' +
      '<div class="field"><label for="noteText">Pin a note of your own</label><textarea class="input" id="noteText" maxlength="140" placeholder="Something kind, something useful, something you noticed..."></textarea></div>' +
      '<div class="row"><button type="button" class="btn primary" id="notePin"><span class="ms">push_pin</span>Pin it</button></div>' +
      '<p class="help">Your notes stay on this phone until friends can join; then you will choose what to share. No likes, no counts, no feed.</p>');
    doc.getElementById('notePin').addEventListener('click', function () {
      var t = doc.getElementById('noteText').value.trim(); if (!t) return;
      var c = copiedNotes(); c.notes = (c.notes || []).concat([{ text: t.slice(0, 140), date: today }]).slice(-20);
      /* Keep the sheet and her words in place until the save succeeds. */
      try { S.commit({ community: c }); } catch (e) { R.toast('Your note could not be saved. Please try again.', 'info'); return; }
      R.chime('save'); openBoard(); R.toast('Pinned. It stays with you.', 'push_pin');
    });
  }
  C.openBoard = openBoard; /* the Today card's Channel tab opens the board from home (ovu-today.js) */
  function openStall() {
    if (root.OvuWalk.napping()) return;
    var H = root.OvuHerbs, cs = S.cycleStats(), teas = H ? H.forPhase(cs.mode === 'suspended' ? null : cs.phase).slice(0, 3) : [];
    R.openSheet('stall', 'The tea stall', 'A cup for where you are in your cycle', 'emoji_food_beverage',
      '<p class="help">' + (cs.phase ? 'Day ' + cs.cycleDay + ', ' + esc(cs.phase) + ' phase: these come first.' : 'No phase yet, so a few gentle favourites.') + ' Food notes, not medicine. If you are pregnant, trying to conceive, breastfeeding or on medicines, ask first.</p>' +
      '<div class="teas">' + teas.map(function (t) { return '<div class="tea"><span class="ms">' + esc(t.icon || 'local_cafe') + '</span><div><b>' + esc(t.name) + '</b><span>' + esc(t.why) + '</span><small>' + esc(t.research) + '</small>' + (t.care ? '<em>' + esc(t.care) + '</em>' : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn soft" id="stallSip"><span class="ms">emoji_food_beverage</span>Sip one slowly</button></div>');
    doc.getElementById('stallSip').addEventListener('click', function () { R.closeSheet(); if (R.moment) R.moment('tea', { line: 'Both hands on the cup. Notice the warmth before the taste.' }); R.toast('A cup of tea at the stall.', 'emoji_food_beverage'); });
  }
  var WISHES = ['A petal drifts. A wish for a gentle day.', 'The water keeps moving. So can you, slowly.', 'A coin would be nice, but a breath is free.', 'Wish made. Now one soft breath out.'];
  function openFountain() {
    if (root.OvuWalk.napping()) return;
    var wrap = R.els.props, fx = doc.createElement('div'); fx.className = 'wish'; fx.setAttribute('aria-hidden', 'true'); fx.style.left = '50%'; fx.style.top = '44%'; fx.style.width = '18%';
    for (var i = 0; i < 6; i++) fx.innerHTML += '<i style="left:' + (15 + i * 14) + '%;animation-delay:' + (i * 0.12) + 's"></i>';
    wrap.appendChild(fx); root.setTimeout(function () { fx.remove(); }, 2400);
    R.joy(); R.showThought('✨'); root.setTimeout(R.hideThought, 2600); R.chime('bell', true); R.toast(WISHES[Math.floor(Math.random() * WISHES.length)], 'auto_awesome');
  }
  R.hotspotHandlers.board = function (id, L) { if (!inPlaza(L)) return false; openBoard(); return true; };
  R.hotspotHandlers.stall = function (id, L) { if (!inPlaza(L)) return false; openStall(); return true; };
  R.hotspotHandlers.fountain = function (id, L) { if (!inPlaza(L)) return false; openFountain(); return true; };
  R.hotspotHandlers.bench2 = function (id, L) { if (!inPlaza(L)) return false; root.OvuGarden.openBench(BENCH2.sit, BENCH2.holo, BENCH2.back); return true; };
  var prevBench = R.hotspotHandlers.bench, prevArch = R.hotspotHandlers.arch;
  R.hotspotHandlers.bench = function (id, L) { if (inPlaza(L)) { root.OvuGarden.openBench(PLAZA.meditator, PLAZA.holo, { x: 34, y: 64, flip: true }); return true; } return prevBench ? prevBench(id, L) : false; };
  R.hotspotHandlers.arch = function (id, L) { if (inPlaza(L)) { root.OvuWalk.travel('street'); return true; } return prevArch ? prevArch(id, L) : false; };
  C.visiting = function () { return visit; }; C.visitNeighbour = visitNeighbour; C.openNeighbour = openNeighbour; C.LAYOUT = PLAZA; C.openBoard = openBoard;
  C.redraw = function () { if (!visit && inPlaza(R.layout())) renderNeighbours(); };
  function tapPerson(id) { var n = neighbour(id); if (n && n.real) { if (openPerson) openPerson(n.handle); } else openNeighbour(id); }
  R.on('boot', function () {
    R.on('props', function (L) { if (visit) renderVisit(); else if (inPlaza(L)) renderNeighbours(); });
    R.on('layout', function (L) { if (visit && (L.id !== visit.home || !R.visiting())) endVisit(); if (inPlaza(L)) renderNeighbours(); });
    R.els.props.addEventListener('click', function (e) { var n = e.target.closest('.nbperson'); if (n && !visit) { e.stopPropagation(); R.chime('tap'); tapPerson(n.dataset.nb); } });
    R.els.props.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var n = e.target.closest('.nbperson'); if (n && !visit) { e.preventDefault(); tapPerson(n.dataset.nb); } });
    doc.addEventListener('click', function (e) { if (e.target.closest('#nbBack')) { R.chime('tap'); root.OvuWalk.travel('plaza', { entry: { x: 54, y: 64, flip: false } }); } });
  });
})(window);
