/* Rhythme harbour (Jamie, 21 Oct 2026: "generation of the harbour port and fishing capability"; the design is Codex's
 * harbour review, docs/design/2026-10-21-harbour-and-fishing.md). A small kelong-style jetty off the farm island's shore:
 * a timber jetty on stilts with a lantern shelter, a moored bumboat, a hut, a bench under a sea-almond tree, rocks.
 * Fishing is catch-and-release only. Cast, watch the float, and when a fish comes, Lift gently whenever you like: no
 * reaction window, no tension bar, no escape, no bait to lose. See it, write it in the catch book, let it go. Six
 * Singapore species, each with one plain fact from a named source; they prefer a spot and a time of day, that is all.
 * No hearts, no rarity tiers, no clocks, no completion. The bench just watches the water, for anyone who would rather
 * not hook a fish. A cast costs the energy of a cast (OvuStamina.COSTS.fish), charged only when a fish is written in the
 * book, in the same save; Stop at any point changes nothing. Nothing here writes a diary entry.
 * Pure rules first (testable in node), then the scene. */
(function (root) {
  'use strict';
  var SPECIES = [
    { id: 'grouper', name: 'Orange-spotted grouper', local: 'kerapu', spots: ['rocks', 'jetty'], time: 'any', img: 'fish-grouper.webp',
      fact: 'Young groupers grow up in estuaries and mangroves; the adults live out on the reefs.', source: 'Wikipedia, orange-spotted grouper', url: 'https://en.wikipedia.org/wiki/Orange-spotted_grouper' },
    { id: 'snapper', name: 'Mangrove red snapper', local: 'ikan merah', spots: ['rocks'], time: 'any', img: 'fish-snapper.webp',
      fact: 'At home among mangrove roots when young, it moves out to open water to breed.', source: 'Wikipedia, mangrove red snapper', url: 'https://en.wikipedia.org/wiki/Mangrove_red_snapper' },
    { id: 'barramundi', name: 'Barramundi', local: 'siakap', spots: ['jetty'], time: 'any', img: 'fish-barramundi.webp',
      fact: 'Barramundi start life as males. In one study at a Singapore farm, most had become females by two to three years old.', source: 'Aquaculture Reports, 2021', url: 'https://doi.org/10.1016/j.aqrep.2021.100712' },
    { id: 'mullet', name: 'Flathead grey mullet', local: 'belanak', spots: ['jetty', 'rocks'], time: 'day', img: 'fish-mullet.webp',
      fact: 'It feeds by sucking up the top layer of the sea floor, for tiny algae and bits of food.', source: 'FAO species fact sheet', url: 'https://www.fao.org/fishery/culturedspecies/mugil_cephalus/en' },
    { id: 'rabbitfish', name: 'White-spotted rabbitfish', local: 'pek tor her', spots: ['rocks'], time: 'day', img: 'fish-rabbitfish.webp',
      fact: 'A grazer of seaweed and seagrass, with venom in its fin spines, so fishers handle it with care. Teochew families prize it at Chinese New Year.', source: 'Wikipedia, white-spotted rabbitfish', url: 'https://en.wikipedia.org/wiki/Siganus_canaliculatus' },
    { id: 'squid', name: 'Bigfin reef squid', local: 'sotong', spots: ['jetty'], time: 'night', img: 'fish-squid.webp',
      fact: 'It changes the colour of its skin to match the sea floor beneath it.', source: 'Scientific Reports, 2022', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8960755/' }
  ];
  var SPOTS = { jetty: { name: 'The jetty', where: 'out over the deep water', float: { x: 89, y: 60 } }, rocks: { name: 'The rocks', where: 'by the shore', float: { x: 46, y: 68 } } };
  function species(id) { return SPECIES.filter(function (s) { return s.id === id; })[0] || null; }
  function phaseOf(sky) { sky = String(sky || ''); return /night|dusk|sunset|evening/.test(sky) ? 'night' : 'day'; }
  function candidates(spot, phase) { return SPECIES.filter(function (s) { return s.spots.indexOf(spot) > -1 && (s.time === 'any' || s.time === phase); }); }
  /* which fish comes: an even choice among those that suit the spot and the time of day; rnd is 0 to 1 (the scene passes Math.random) */
  function pick(spot, phase, rnd) { var c = candidates(spot, phase); if (!c.length) return null; var i = Math.min(c.length - 1, Math.max(0, Math.floor((Number(rnd) || 0) * c.length))); return c[i]; }
  var CAP = 999999;
  function realDate(S, d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!S.validDate || S.validDate(d)); }
  function harbourState(S) {
    var h = S.state().harbour || {}, book = {};
    Object.keys(h.book || {}).forEach(function (k) { var e = h.book[k]; if (!species(k) || !e) return; var n = Math.floor(Number(e.n)); if (!(isFinite(n) && n > 0)) return; /* a zero-count entry is no meeting */ book[k] = { first: realDate(S, e.first) ? e.first : null, n: Math.min(CAP, n) }; });
    var casts = Math.floor(Number(h.casts)); return Object.assign({}, h, { book: book, casts: isFinite(casts) && casts > 0 ? Math.min(CAP, casts) : 0 });
  }
  function seen(S, id) { var e = harbourState(S).book[id]; return !!(e && e.n > 0); }
  function seenCount(S) { var b = harbourState(S).book; return Object.keys(b).filter(function (k) { return b[k].n > 0; }).length; }
  /* a fish lifted and seen goes in the book (first day kept, times counted) and the cast's energy is charged in the same save;
     with no energy module the save is plain. A failed save changes nothing. */
  function record(S, id, day, ST) {
    var sp = species(id); if (!sp) return { ok: false, why: 'unknown fish' };
    var h = JSON.parse(JSON.stringify(harbourState(S))), e = h.book[id] || { first: null, n: 0 }, first = !e.n;
    e.n = Math.min(CAP, e.n + 1); if (first || !e.first) e.first = day; h.book[id] = e; h.casts = Math.min(CAP, h.casts + 1); /* the first meeting is today when none was counted before */
    try {
      if (ST && ST.spendWith) { if (!ST.COSTS || ST.COSTS.fish == null) return { ok: false, why: 'unknown action' }; if (!ST.spendWith('fish', { harbour: h })) return { ok: false, why: 'Too tired for that. Energy comes back with a night’s sleep, or with the new day.' }; }
      else if (S.commit) S.commit({ harbour: h }); else S.setState({ harbour: h });
    } catch (err) { return { ok: false, why: 'That could not be saved just now.' }; }
    return { ok: true, first: first, n: e.n, species: sp };
  }
  /* rendered 21 Oct 2026 (Seedream 5.0 pro, seed 21, 1024x1280): positions read off a 5% grid */
  var HARBOUR = {
    id: 'harbour', scene: 'harbour', name: 'The harbour', img: 'harbour-v1.webp', w: 1024, h: 1280, avatarW: 12, only: [], mapIcon: 'sailing',
    hotspots: [
      { id: 'harbourexit', x: 36, y: 79, label: 'Path · back to the farm', prompt: 'Tap to go back to the farm', icon: 'agriculture', wp: { x: 34, y: 73, flip: false } },
      { id: 'hbjetty', x: 78, y: 47, label: 'Jetty · cast a line', prompt: 'Tap to fish from the jetty', icon: 'phishing', wp: { x: 77, y: 53, flip: false } },
      { id: 'hbrocks', x: 11, y: 58, label: 'Rocks · cast from the shore', prompt: 'Tap to fish from the rocks', icon: 'phishing', wp: { x: 26, y: 58, flip: true } },
      { id: 'hbbench', x: 40, y: 39, label: 'Bench · watch the water', prompt: 'Tap to sit a while', icon: 'chair', wp: { x: 41, y: 47, flip: false } },
      { id: 'hbhut', x: 27, y: 43, label: 'Harbour hut · the catch book', prompt: 'Tap to open the catch book', icon: 'menu_book', wp: { x: 31, y: 51, flip: true } },
      /* the little post by the hut points up Harbour Lane (ovu-lane.js, 21 Oct): its shops are sheets until the lane's plate is drawn */
      { id: 'hblane', x: 19, y: 44, label: 'Signpost · Harbour Lane', prompt: 'Tap to read the signpost', icon: 'signpost', wp: { x: 23, y: 51, flip: true } }
    ],
    home: { x: 34, y: 73, flip: false },
    zones: [[[8, 46], [18, 41], [34, 34], [50, 32], [63, 36], [60, 42], [50, 47], [44, 52], [39, 60], [37, 68], [45, 76], [40, 81], [28, 80], [12, 72], [3, 62], [3, 52]],
      [[44, 42.5], [49, 41.5], [70, 47.5], [85, 45.5], [86, 54], [72, 55.5], [70, 52.5], [44, 47.5]]], /* the meadow and sand; the planks and the deck only, not the water between the stilts (Codex, 21 Oct) */
    solids: [{ id: 'hut', x0: 18, x1: 35, y0: 33, y1: 48 }, { id: 'tree', x0: 32, x1: 37, y0: 37, y1: 41 }, { id: 'bench', x0: 35, x1: 46, y0: 36, y1: 43 }, { id: 'rocks', x0: 1, x1: 21, y0: 53, y1: 69 }, { id: 'sign', x0: 17, x1: 21, y0: 44, y1: 49 }, { id: 'lantern', x0: 72, x1: 76, y0: 43, y1: 49 }],
    doors: [{ id: 'harbourexit', to: 'farm', x: 34, y: 73, r: 4, flip: false }],
    seat: { x: 40.5, seatY: 39.5, groundY: 44, face: 'right' },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  var HB = { SPECIES: SPECIES, SPOTS: SPOTS, LAYOUT: HARBOUR, species: species, phaseOf: phaseOf, candidates: candidates, pick: pick, harbourState: harbourState, seen: seen, seenCount: seenCount, record: record };
  root.OvuHarbour = HB;

  /* ---------- the scene ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, ST = root.OvuStamina, GT = root.OvuGameTime, Z = root.OvuZones, CARE = root.OvuCare, doc = root.document;
  if (!R || !S || !doc || !Z) return;
  var ART = R.ART;
  function today() { return GT ? GT.dayKey() : S.today(); }
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function here() { var L = R.layout(); return !!L && L.id === 'harbour'; }
  function idle() { return !((W.napping && W.napping()) || (CARE && CARE.live && CARE.live())); }
  function phaseNow() { return phaseOf(R.els && R.els.scene ? R.els.scene.dataset.sky : ''); }
  Z.register(HARBOUR, { label: 'Harbour', icon: 'sailing', after: 'farm' });

  /* the float on the water while a line is out, and the line from her to it; `enc` is the encounter token: a bite is only good while nothing has moved under it (Codex, 21 Oct) */
  var line = null, enc = 0;
  function spotSheet() { var id = R.sheetId ? R.sheetId() : ''; var m = /^harbour-(jetty|rocks)$/.exec(id || ''); return m ? m[1] : null; }
  function invalidate(reopen) { enc++; clearLine(); var sp = spotSheet(); if (reopen && sp && here() && R.sheetOpen()) openSpot(sp); }
  /* the float she chose at Bait & Fin (ovu-lane.js); blush is everyone's from the start */
  function floatOf() { var LN = root.OvuLane; return LN && LN.floatOf ? LN.floatOf(S) : { id: 'blush', top: '#e58aa8' }; }
  function clearLine() { if (line) { if (line.parentNode) line.remove(); line = null; } R.els.scene.classList.remove('fishing', 'bite'); }
  function castLine(spot) {
    clearLine();
    var f = SPOTS[spot].float, p = R.pos ? R.pos() : null;
    var el = doc.createElement('div'); el.className = 'harbourthing castline'; el.setAttribute('aria-hidden', 'true');
    var x0 = p ? p.x : f.x, y0 = p ? p.y - 9 : f.y;
    el.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M' + x0 + ' ' + y0 + ' Q ' + ((x0 + f.x) / 2) + ' ' + (Math.min(y0, f.y) - 6) + ' ' + f.x + ' ' + f.y + '" fill="none" stroke="rgba(255,255,255,.85)" stroke-width=".35" vector-effect="non-scaling-stroke"/></svg>' +
      '<span class="float' + (floatOf().glow && phaseNow() === 'night' ? ' glow' : '') + '" style="left:' + f.x + '%;top:' + f.y + '%;--floatc:' + floatOf().top + '"><i class="ring"></i><i class="ring r2"></i><b></b></span>';
    R.els.props.appendChild(el); line = el; R.els.scene.classList.add('fishing');
  }
  function waterSVG(stage, sp) {
    var s = '<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="hbw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfc3f3"/><stop offset="1" stop-color="#9a8ad8"/></linearGradient></defs><rect width="100" height="70" fill="url(#hbw)"/>';
    s += '<path d="M0 24 q 10 -4 20 0 t 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.6"/><path d="M0 46 q 10 -4 20 0 t 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6"/>';
    if (stage === 'bite') s += '<ellipse class="hbshadow" cx="46" cy="44" rx="16" ry="6" fill="rgba(60,40,110,.35)"/>';
    if (stage !== 'ready') s += '<g class="hbfloat' + (stage === 'bite' ? ' dip' : '') + '"><circle cx="52" cy="30" r="4.5" fill="#fff"/><circle cx="52" cy="28" r="3" fill="' + floatOf().top + '"/>' + (stage === 'bite' ? '' : '<circle cx="52" cy="30" r="9" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1" class="hbring"/>') + '</g>';
    return s + '</svg>';
  }
  function spotHot(id) { return HARBOUR.hotspots.filter(function (h) { return h.id === id; })[0]; }
  function bookLine() { var n = seenCount(S), c = harbourState(S).casts; return '<p class="help pantryline"><span class="ms">menu_book</span>' + (n ? n + ' of ' + SPECIES.length + ' kinds met, ' + c + ' fish recorded.' : 'Nothing in the catch book yet.') + ' Every fish goes back in the water.</p>'; }
  function step(box, o, done) { if (!CARE || !CARE.step) { done(); return; } CARE.step(box, Object.assign({ scene: 'harbour' }, o), done); }

  /* one spot: Cast, the float drifts (a slow step; Stop reels in nothing), a fish comes, Lift gently whenever she likes, see it, let it go */
  function openSpot(spot) {
    var sp = SPOTS[spot]; if (!sp) return;
    R.openSheet('harbour-' + spot, sp.name, 'Catch and release, ' + sp.where, 'phishing',
      '<div class="bedcard"><div class="bedpic hbpic">' + waterSVG('ready') + '</div><div class="bedtext"><b>Cast a line</b><span>Then lift whenever you like. Nothing bites back, nothing is lost, and every fish goes home.</span></div></div>' +
      '<div class="row" id="spotActs"><button type="button" class="btn primary" data-act="cast"><span class="ms">phishing</span>Cast</button><button type="button" class="btn ghost" data-act="book"><span class="ms">menu_book</span>Catch book</button></div>' +
      bookLine() + '<p class="help">A cast costs a little energy once a fish is in the book. Fish prefer a spot and a time of day; there is nothing to complete.</p>');
    var acts = doc.getElementById('spotActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      if (btn.dataset.act === 'book') { openBook(spot); return; }
      if (ST && !ST.can('fish')) { R.toast('Too tired for that. Energy comes back with a night’s sleep, or with the new day.', 'bedtime'); return; }
      if (!here()) { R.hideSheet(); return; }
      var pic = doc.querySelector('#sheet .hbpic'); if (pic) pic.innerHTML = waterSVG('cast');
      castLine(spot);
      step(acts, { ms: 7000, moment: 'cast', verb: 'The float drifts…', cancel: function () { clearLine(); openSpot(spot); }, undo: clearLine }, function () {
        var fish = pick(spot, phaseNow(), Math.random()); if (!fish) { clearLine(); openSpot(spot); return; }
        bite(spot, fish);
      });
    });
  }
  function bite(spot, fish) {
    var my = ++enc;
    R.els.scene.classList.add('bite');
    var pic = doc.querySelector('#sheet .hbpic'); if (pic) pic.innerHTML = waterSVG('bite');
    var line2 = R.moment ? R.moment('bite', { quiet: true }) : '';
    var acts = doc.getElementById('spotActs'); if (!acts) return;
    var old = acts.parentNode.querySelector('.hbline'); if (old) old.remove();
    if (line2) { var pl = doc.createElement('p'); pl.className = 'mindline hbline'; pl.innerHTML = '<span class="ms">phishing</span><span>' + esc(line2) + '</span>'; acts.parentNode.insertBefore(pl, acts); } /* the line sits above the row, never inside it */
    acts.className = 'row'; acts.innerHTML = '<button type="button" class="btn primary" data-bite="lift"><span class="ms">phishing</span>Lift gently</button><button type="button" class="btn ghost" data-bite="leave">Let it be</button>';
    acts.onclick = function (e) {
      var btn = e.target.closest('[data-bite]'); if (!btn) return; acts.onclick = null;
      if (btn.dataset.bite === 'leave') { clearLine(); R.toast('It swims on. Nothing lost.', 'water'); openSpot(spot); return; }
      if (my !== enc || !here() || S.state().sleeping || (CARE && CARE.asleepNow && CARE.asleepNow())) { clearLine(); R.hideSheet(); return; } /* the moment passed: a reset, another tab, sleep */
      if (ST && !ST.can('fish')) { R.toast('Too tired for that. Energy comes back with a night’s sleep, or with the new day.', 'bedtime'); clearLine(); openSpot(spot); return; }
      var r = record(S, fish.id, today(), ST);
      clearLine();
      if (!r.ok) { R.toast(r.why, 'info'); openSpot(spot); return; }
      R.chime('save'); reveal(spot, r);
    };
  }
  function reveal(spot, r) {
    var sp = r.species, line3 = R.moment ? R.moment('release', { quiet: true }) : '';
    R.openSheet('harbour-fish', sp.name, (r.first ? 'First time! ' : '') + esc(sp.local) + (r.n > 1 ? ' · met ' + r.n + ' times' : ''), 'set_meal',
      '<div class="fishcard"><img src="' + ART + sp.img + '" alt="' + esc(sp.name) + '"><div><b>' + esc(sp.name) + '</b><small>' + esc(sp.local) + '</small></div></div>' +
      '<p class="fishfact">' + esc(sp.fact) + ' <span class="fishsrc">' + esc(sp.source) + (sp.url ? ' <a class="fishlink" href="' + esc(sp.url) + '" target="_blank" rel="noopener">Read the source</a>' : '') + '</span></p>' +
      (line3 ? '<p class="mindline"><span class="ms">spa</span><span>' + esc(line3) + '</span></p>' : '') +
      '<div class="row"><button type="button" class="btn primary" id="fishGo"><span class="ms">water</span>Let it go</button><button type="button" class="btn ghost" id="fishBook"><span class="ms">menu_book</span>Catch book</button></div>' +
      '<p class="help">It is already written in your catch book. Back it goes, the same as every fish here.</p>');
    var go = doc.getElementById('fishGo'), bk = doc.getElementById('fishBook');
    if (go) go.addEventListener('click', function () { R.toast('Back in the water.', 'water'); openSpot(spot); });
    if (bk) bk.addEventListener('click', function () { openBook(spot); });
  }
  function openBook(backTo) {
    var h = harbourState(S), n = seenCount(S);
    var rows = SPECIES.map(function (sp) {
      var e = h.book[sp.id], met = !!(e && e.n > 0);
      return '<li class="bookrow' + (met ? '' : ' unseen') + '">' + (met ? '<img src="' + ART + sp.img + '" alt="">' : '<span class="bookq">?</span>') + '<span><b>' + (met ? esc(sp.name) : 'Not met yet') + '</b><small>' + (met ? esc(sp.local) + ' · first ' + esc(e.first || '') + ' · ' + e.n + (e.n === 1 ? ' time' : ' times') + '<br>' + esc(sp.fact) + ' <em>' + esc(sp.source) + '</em>' : (sp.spots.join(' or ') === 'jetty' ? 'Try the jetty' : sp.spots.indexOf('jetty') > -1 ? 'The jetty or the rocks' : 'Try the rocks') + (sp.time === 'night' ? ', after dark' : sp.time === 'day' ? ', in daylight' : '')) + '</small></span></li>';
    }).join('');
    R.openSheet('harbourbook', 'The catch book', n ? n + ' of ' + SPECIES.length + ' kinds met' : 'Nothing met yet', 'menu_book',
      '<ul class="booklist">' + rows + '</ul><p class="help">' + h.casts + ' fish recorded so far. Every fish went back in the water. There is nothing to complete here; the book is for noticing.</p>' +
      (backTo ? '<div class="row"><button type="button" class="btn soft" id="bookBack"><span class="ms">phishing</span>Back to ' + esc(SPOTS[backTo].name.toLowerCase()) + '</button></div>' : ''));
    var b = doc.getElementById('bookBack'); if (b) b.addEventListener('click', function () { openSpot(backTo); });
  }
  /* the bench: her seated sprite, Stop any time, no timer, no save (the hidden spring's warm stone, by the water) */
  var sitting = null;
  function openBench() {
    R.openSheet('harbourbench', 'The bench', 'Under the sea-almond tree', 'chair',
      '<p>Sit and watch the water for as long as you like. Nothing is counted, and no fish is hooked.</p><div class="row"><button type="button" class="btn primary" id="benchGo"><span class="ms">chair</span>Watch the water</button></div>');
    doc.getElementById('benchGo').addEventListener('click', function () { R.hideSheet(); sitDown(); });
  }
  function sitDown() {
    if (sitting || !here() || !idle()) return;
    var G = root.OvuGarden, el = doc.createElement('div'), outfit = S.profile().outfit || 'base';
    el.className = 'nb springsitter benchsitter'; el.dataset.id = 'benchsitter';
    el.innerHTML = '<img src="' + ART + 'avatar-' + outfit + '.webp" alt="">';
    var stop = doc.createElement('button'); stop.type = 'button'; stop.className = 'springstop'; stop.id = 'benchStop'; stop.innerHTML = '<span class="ms">stop_circle</span>Stop watching';
    R.els.props.appendChild(el); R.els.scene.appendChild(stop);
    if (G && G.seatPlace) { G.seatPlace(el, HARBOUR.seat); G.seatedImg(el.querySelector('img'), el.querySelector('img').src); }
    else { el.style.left = HARBOUR.seat.x + '%'; el.style.top = HARBOUR.seat.groundY + '%'; el.style.width = '9%'; }
    sitting = { el: el, stop: stop }; R.els.scene.classList.add('sitting', 'springsit');
    stop.addEventListener('click', function (e) { e.stopPropagation(); standUp(); });
    try { stop.focus({ preventScroll: true }); } catch (e) { }
    if (R.moment) R.moment('watchwater', { quiet: true, pose: null });
  }
  function standUp() {
    if (!sitting) return; var s = sitting; sitting = null;
    if (s.el.parentNode) s.el.remove(); if (s.stop.parentNode) s.stop.remove();
    R.els.scene.classList.remove('sitting', 'springsit');
  }
  HB.standUp = standUp; HB.sitting = function () { return !!sitting; }; HB.sitDown = sitDown;
  var OPEN = { hbjetty: function () { openSpot('jetty'); }, hbrocks: function () { openSpot('rocks'); }, hbbench: function () { if (root.OvuSeats && root.OvuSeats.open) root.OvuSeats.open('harbour'); else openBench(); }, /* since 21 Oct the bench offers Watching the water (ovu-seats.js) as well as just watching */ hbhut: function () { openBook(null); } }; /* ids of their own: the garden and the street have a bench too */
  function handler(id) { return function (hid, L) { if (!L || L.id !== 'harbour') return false; if ((W.napping && W.napping()) || R.busy() || !idle()) return true; OPEN[id](); return true; }; }
  R.hotspotHandlers.hbjetty = handler('hbjetty');
  R.hotspotHandlers.hbrocks = handler('hbrocks');
  R.hotspotHandlers.hbbench = handler('hbbench');
  R.hotspotHandlers.hbhut = handler('hbhut');
  R.hotspotHandlers.harbourexit = function (id, L) { if (!L || L.id !== 'harbour') return false; standUp(); clearLine(); W.travel('farm'); return true; };
  /* the farm's way down: steps on the island's lower shore */
  R.hotspotHandlers.harboursteps = function (id, L) { if (!L || L.id !== 'farm') return false; if (W.napping && W.napping()) return true; W.travel('harbour'); return true; };
  R.on('boot', function () {
    R.on('layout', function (L) { if (!L || L.id !== 'harbour') { standUp(); invalidate(false); } });
    R.on('props', function () { if (sitting && !sitting.el.isConnected) R.els.props.appendChild(sitting.el); if (line && !line.isConnected) R.els.props.appendChild(line); });
    R.on('beforeWalk', standUp); R.on('walk', standUp); R.on('activity', function () { standUp(); invalidate(false); });
    R.on('sheetHide', function () { invalidate(false); }); /* the line comes in with the sheet */
    R.on('sheetReplace', function () { invalidate(false); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) invalidate(false); else if (spotSheet()) invalidate(true); }); /* away and back: the float is gone, the spot sheet is drawn fresh */
    S.subscribe(function (reason) { if (reason === 'clear' || reason === 'import' || reason === 'external' || String(reason).indexOf('sync') === 0) { if (enc && (line || spotSheet())) invalidate(true); } else if (reason === 'state' && S.state().sleeping && (line || spotSheet())) invalidate(false); }); /* a reset or another tab under a bite: the old fish is forgotten */
  });
  HB.openSpot = openSpot; HB.openBook = openBook; HB.openBench = openBench;
})(typeof window !== 'undefined' ? window : this);
