/* Rhythme garden: the first outdoor scene. A plate behind every home's door with a path, flower beds,
 * a bench under a blossom tree, a pond, a little greenhouse and a raised plot that grows a stage for
 * every day you logged anything or watered it. A missed day adds nothing and takes nothing away.
 * Growth is kept as a set of credited dates in state.garden so it exports and syncs with the diary;
 * deleting a health entry later never shrinks the plant. Pure data and rules first (testable in node),
 * then the scene wiring, which mounts when room.js announces boot through window.OvuRoom. */
(function (root) {
  'use strict';
  var STAGES = [
    { at: 0, name: 'Soil', note: 'Freshly turned soil. The first day you log anything, a sprout appears.' },
    { at: 1, name: 'Sprout', note: 'A sprout. Every day with an entry or a watering adds to it.' },
    { at: 3, name: 'Leaves', note: 'Leaves unfolding. No rush, and no day is ever taken away.' },
    { at: 6, name: 'Bud', note: 'A bud. Keep going at your own pace.' },
    { at: 10, name: 'Bloom', note: 'In bloom. Gentle days add up.' },
    { at: 15, name: 'Full bloom', note: 'Full bloom. The plot stays this way; new days still count for you.' }
  ];
  /* ---------- rules (no DOM) ---------- */
  function stageFor(n) { var s = 0; for (var i = 0; i < STAGES.length; i++) if (n >= STAGES[i].at) s = i; return s; }
  function nextAt(n) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].at > n) return STAGES[i].at; return null; }
  function gardenState(S) { var g = S.state().garden || {}; return { credited: (g.credited || []).slice(), watered: (g.watered || []).slice() }; }
  /* merge every diary date (not in the future) and every watering day into the credited set; monotonic */
  function credit(S) {
    var g = gardenState(S), set = {}, today = S.today();
    g.credited.forEach(function (d) { set[d] = 1; });
    g.watered.forEach(function (d) { set[d] = 1; });
    S.list().forEach(function (e) { if (e.date && e.date <= today) set[e.date] = 1; });
    var arr = Object.keys(set).sort();
    if (arr.length !== g.credited.length) { g.credited = arr; S.setState({ garden: g }); }
    return arr.length;
  }
  function wateredToday(S) { return gardenState(S).watered.indexOf(S.today()) > -1; }
  /* record a watering day; the mindful minute is saved as a diary entry only the first time that day */
  function water(S) {
    var g = gardenState(S), today = S.today(), first = g.watered.indexOf(today) < 0;
    if (first) { g.watered.push(today); g.watered.sort(); S.setState({ garden: g }); }
    var n = credit(S);
    return { first: first, days: n, stage: stageFor(n) };
  }
  function summary(S) { var n = credit(S); var s = stageFor(n); return { days: n, stage: s, name: STAGES[s].name, note: STAGES[s].note, nextAt: nextAt(n), wateredToday: wateredToday(S) }; }
  /* the plant as inline SVG in the brand palette: soil, stem, leaves, bud, blooms */
  function plantSVG(stage) {
    var leaf = '#8fcfae', leaf2 = '#6ba88a', stem = '#7fb894', pink = '#f6a9c1', pink2 = '#e58aa8', gold = '#f3d49b';
    var s = '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    s += '<ellipse cx="50" cy="104" rx="30" ry="7" fill="rgba(70,40,100,.16)"/>';
    if (stage >= 1) {
      var h = [0, 22, 40, 52, 58, 62][stage];
      s += '<path d="M50 104 C 50 ' + (104 - h * 0.5) + ', 50 ' + (104 - h * 0.8) + ', 50 ' + (104 - h) + '" stroke="' + stem + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
      s += '<path d="M50 94 C 38 92, 32 84, 34 76 C 42 78, 48 84, 50 94 Z" fill="' + leaf + '"/><path d="M50 90 C 62 88, 68 80, 66 72 C 58 74, 52 80, 50 90 Z" fill="' + leaf2 + '"/>';
    }
    if (stage >= 2) s += '<path d="M50 78 C 36 76, 28 66, 30 58 C 40 60, 47 68, 50 78 Z" fill="' + leaf2 + '"/><path d="M50 74 C 64 72, 72 62, 70 54 C 60 56, 53 64, 50 74 Z" fill="' + leaf + '"/>';
    if (stage === 3) s += '<ellipse cx="50" cy="48" rx="7" ry="10" fill="' + pink + '"/><path d="M50 58 C 44 54, 44 46, 50 40 C 56 46, 56 54, 50 58 Z" fill="' + leaf2 + '" opacity=".7"/>';
    if (stage >= 4) {
      var bloom = function (cx, cy, r, c) { var o = ''; for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; o += '<ellipse cx="' + (cx + Math.cos(a) * r).toFixed(1) + '" cy="' + (cy + Math.sin(a) * r).toFixed(1) + '" rx="' + (r * 0.75).toFixed(1) + '" ry="' + (r * 0.55).toFixed(1) + '" transform="rotate(' + (a * 180 / Math.PI).toFixed(0) + ' ' + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1) + ')" fill="' + c + '"/>'; } return o + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.5).toFixed(1) + '" fill="' + gold + '"/>'; };
      s += bloom(50, 44, 11, pink);
      if (stage >= 5) { s += '<path d="M50 70 C 36 66, 30 56, 30 50" stroke="' + stem + '" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 72 C 64 68, 72 58, 72 50" stroke="' + stem + '" stroke-width="3" fill="none" stroke-linecap="round"/>' + bloom(30, 48, 8, pink2) + bloom(72, 48, 8, pink2); s += '<circle cx="22" cy="36" r="1.6" fill="#fff" opacity=".9"/><circle cx="80" cy="30" r="1.3" fill="#fff" opacity=".8"/><circle cx="56" cy="24" r="1.4" fill="#fff" opacity=".9"/>'; }
    }
    return s + '</svg>';
  }
  var G = { STAGES: STAGES, stageFor: stageFor, nextAt: nextAt, credit: credit, water: water, wateredToday: wateredToday, summary: summary, plantSVG: plantSVG, gardenState: gardenState };
  root.OvuGarden = G;

  /* rendered 18 Oct 2026 (Seedream 5.0 pro, seed 7301, 1472x1840): positions read off a 5% grid */
  var GARDEN = {
    id: 'garden', scene: 'garden', name: 'Your garden', img: 'garden-v1.webp', w: 1472, h: 1840, avatarW: 12, only: ['pet'],
    hotspots: [
      { id: 'gate', x: 19, y: 52, label: 'Gate · back home', icon: 'door_open', wp: { x: 29, y: 58, flip: true } },
      { id: 'bench', x: 33, y: 41, label: 'Bench · sit a while', icon: 'chair', wp: { x: 37, y: 53, flip: true } },
      { id: 'plot', x: 50, y: 60, label: 'Plot · water the plants', icon: 'yard', wp: { x: 50, y: 71.5, flip: false } },
      { id: 'pond', x: 70, y: 55, label: 'Pond · a quiet moment', icon: 'water', wp: { x: 66, y: 67, flip: false } },
      { id: 'greenhouse', x: 68, y: 35, label: 'Greenhouse · teas and herbs', icon: 'local_florist', wp: { x: 62, y: 49, flip: false } },
      { id: 'arch', x: 86, y: 45, label: 'Arch · on to Dream Street', icon: 'park', wp: { x: 80, y: 55, flip: false } }
    ],
    home: { x: 29, y: 58, flip: false },
    zones: [[[50, 36], [92, 58], [50, 77], [8, 58]]],
    solids: [{ id: 'bench', x0: 22, x1: 44, y0: 38, y1: 50 }, { id: 'tree', x0: 12, x1: 26, y0: 40, y1: 48 }, { id: 'greenhouse', x0: 56, x1: 82, y0: 30, y1: 46 }, { id: 'pond', x0: 57, x1: 78, y0: 52, y1: 64 }, { id: 'planter', x0: 41, x1: 61, y0: 60, y1: 69 }, { id: 'can', x0: 39, x1: 47, y0: 65, y1: 70 }],
    doors: [{ id: 'gate', to: 'home', x: 29, y: 58, r: 5, flip: true }, { id: 'arch', to: 'street', x: 80, y: 55, r: 5, flip: false }],
    meditator: { x: 33, y: 47, w: 11, seat: { x: 32.5, seatY: 45, groundY: 49.5, face: 'right' } }, aura: { x: 33, y: 45, w: 17 }, holo: { x: 43, y: 45, w: 14 },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 },
    props: { cat: { x: 44, y: 57, w: 9 }, dog: { x: 66, y: 66, w: 9.5 }, mewmew: { x: 36, y: 66, w: 12 } }
  };
  var PLOT = { x: 51, y: 61, w: 15 };
  G.LAYOUT = GARDEN; G.PLOT = PLOT;
  /* ---------- the scene ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var S = root.OvuStore, doc = root.document, ART = R.ART;
  R.LAYOUTS.garden = GARDEN;
  var WATER_LINES = ['Pick up the can. Feel its weight before you pour.', 'Let the water fall slowly. Watch the soil darken.', 'Breathe in as you move to the next corner.', 'Nothing to hurry. The plants drink at their own pace.', 'Notice the sound of it, and the smell of wet earth.', 'Set the can down. One ordinary minute, fully lived.'];
  var watering = null, lastWaterAt = 0, VOICE = 'assets/audio/guide-interim/garden-water-';
  /* Erin's cloned voice reads each line (pre-recorded clips, like the everyday practices); a missing clip is just silent */
  /* one audio element, created and first played inside the tap that starts the minute, then reused for every later line:
   * a fresh element started from a timer is silent on the iPhone, which is why only the first line used to be heard */
  function say(i) { try { if (!watering) return; var a = watering.audio || (watering.audio = new Audio()); a.pause(); a.src = VOICE + i + '.mp3'; a.currentTime = 0; a.play().catch(function () { }); } catch (e) { } }

  function esc(s) { return R.esc(s); }
  function placeEl(el, p) { if (!el || !p) return; el.style.left = p.x + '%'; el.style.top = p.y + '%'; if (p.w) el.style.width = p.w + '%'; }
  /* the plant lives in #ownedProps so the walk engine depth-sorts it with the pets; it is not a solid */
  function renderPlot() {
    if (R.layout().id !== 'garden') return;
    var wrap = R.els.props, old = wrap.querySelector('.plot'); if (old) old.remove();
    var sm = summary(S), el = doc.createElement('div');
    el.className = 'plot stage-' + sm.stage; el.dataset.id = 'plot'; el.setAttribute('aria-hidden', 'true');
    el.style.left = PLOT.x + '%'; el.style.top = PLOT.y + '%'; el.style.width = PLOT.w + '%';
    el.innerHTML = plantSVG(sm.stage);
    wrap.appendChild(el);
  }
  function openPlot() {
    if (root.OvuWalk.napping()) return;
    var sm = summary(S), total = STAGES[STAGES.length - 1].at;
    R.openSheet('plot', 'Your plot', 'It grows with your days, never against them', 'yard',
      '<div class="plotcard"><div class="plotart">' + plantSVG(sm.stage) + '</div><div><b>' + esc(sm.name) + '</b><p>' + esc(sm.note) + '</p><small>' + sm.days + ' day' + (sm.days === 1 ? '' : 's') + ' counted' + (sm.nextAt ? ' · next stage at ' + sm.nextAt : '') + '</small><div class="bar"><i style="width:' + Math.min(100, Math.round(sm.days / total * 100)) + '%"></i></div></div></div>' +
      '<div class="stat"><span class="ms">' + (sm.wateredToday ? 'check_circle' : 'water_drop') + '</span><div><b>' + (sm.wateredToday ? 'Watered today' : 'Water the plants') + '</b><span>' + (sm.wateredToday ? 'The plants are happy. Another minute is welcome any time; it just will not add hearts twice.' : 'A mindful minute with the watering can. Saved to your journal as one minute of calm.') + '</span></div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="plotWater"><span class="ms">water_drop</span>' + (sm.wateredToday ? 'Another mindful minute' : 'Water, one mindful minute') + '</button></div>' +
      '<p class="help">A day counts once, whether you logged sleep, a period, a meal, a symptom, a reflection or a watering. Entries you delete later never shrink the plant.</p>');
    doc.getElementById('plotWater').addEventListener('click', function () { startWatering(); });
  }
  function startWatering() {
    if (watering || R.sessionOn() || root.OvuWalk.napping()) return;
    var sm = summary(S);
    watering = { startedAt: Date.now(), timers: [], done: false, rewarded: !sm.wateredToday };
    R.hideSheet(); R.hudOn(true, 'Watering'); R.caption(WATER_LINES[0]); say(0);
    R.setPose('plants'); R.els.avatar.classList.add('acting');
    var wrap = R.els.props, drops = doc.createElement('div'); drops.className = 'drops'; drops.setAttribute('aria-hidden', 'true');
    drops.style.left = PLOT.x + '%'; drops.style.top = (PLOT.y - 2) + '%'; drops.style.width = PLOT.w + '%';
    for (var i = 0; i < 7; i++) drops.innerHTML += '<i style="left:' + (10 + i * 12) + '%;animation-delay:' + (i * 0.17) + 's"></i>';
    wrap.appendChild(drops); watering.drops = drops;
    WATER_LINES.forEach(function (line, i) { if (i) watering.timers.push(root.setTimeout(function () { if (watering && !watering.done) { R.caption(line); R.chime('bell', true); root.setTimeout(function () { if (watering && !watering.done) say(i); }, 350); } }, i * 10000)); });
    watering.timers.push(root.setTimeout(function () { finishWatering(true); }, 60000));
    R.setHudStop(function () { if (!watering) return false; finishWatering(false); return true; });
  }
  /* one completion path, one saved entry, one award, however it ends */
  function finishWatering(completed) {
    var w = watering; if (!w || w.done) return; w.done = true;
    w.timers.forEach(root.clearTimeout); if (w.drops) w.drops.remove(); if (w.audio) { try { w.audio.pause(); } catch (e) { } } watering = null; R.setHudStop(null);
    R.hudOn(false); R.els.avatar.classList.remove('acting'); R.restorePose();
    if (!completed) { R.toast('Stopped. The plants are glad of the drink anyway.', 'yard'); return; }
    lastWaterAt = Date.now();
    var res = water(S); renderPlot(); R.chime('bell', true);
    /* every completed minute is a practice like the everyday ones: the flat practice thank-you (ovu-rewards.js PRACTICE) and a journal entry */
    /* the very first watering ever: the day list has only today in it and today was just added (no extra field, which
     * gardenState would drop; Codex caught that the first-time bonus would otherwise pay every time) */
    var g = gardenState(S), ever = !(res.first && g.watered.length === 1);
    var ev = null;
    try { ev = S.add('mindfulness', S.today(), { kind: 'informal', first: !ever, practice: 'garden', minutes: 1, completed: true, startedAt: new Date(w.startedAt).toISOString(), guide: 'Garden watering, one mindful minute' }); } catch (e) { R.toast('The minute could not be saved: ' + e.message, 'error'); }
    if (ev) R.afterSave(ev, 'One mindful minute in the garden. ' + (res.first && res.stage > stageFor(res.days - 1) ? 'Your plot reached ' + STAGES[res.stage].name.toLowerCase() + '!' : res.first ? 'Saved to your journal.' : 'The plants had their drink already today; the minute still counts.'));
  }
  /* a seat is a bench or a chair: she sits on it in her own clothes (assets/room/dream/avatar-sit-<outfit>.webp, hips at
   * seat height, feet down); the cross-legged pose stays for the yoga mat. A missing seated sprite falls back to the
   * standing one, never to the cross-legged one */
  /* lap line (where the body meets the seat) and height/width of each seated sprite, measured from the files */
  var SIT = { base: { hip: 0.695, aspect: 2.063 }, sundress: { hip: 0.766, aspect: 2.031 }, pajamas: { hip: 0.765, aspect: 2.019 }, cozy: { hip: 0.705, aspect: 2.035 }, yoga: { hip: 0.762, aspect: 2.013 }, party: { hip: 0.761, aspect: 1.902 }, 'kebaya-blue': { hip: 0.747, aspect: 1.672 }, 'kebaya-green': { hip: 0.746, aspect: 2.031 }, 'kebaya-red': { hip: 0.733, aspect: 1.674 } };
  function outfitId() { var o = S.profile().outfit; return SIT[o] ? o : 'base'; }
  function seatedSrc() { return ART + 'avatar-sit-' + outfitId() + '.webp'; }
  /* place a seated sprite on a seat: feet on the ground line, lap on the seat, facing the way the bench faces.
   * seat = { x, seatY, groundY, face } in plate percent; the width follows from the seat height so her legs reach */
  function seatPlace(el, seat) {
    var L = R.layout(), m = SIT[outfitId()], drop = Math.max(1.5, seat.groundY - seat.seatY);
    var w = drop / ((1 - m.hip) * (L.w / L.h) * m.aspect);
    el.style.left = seat.x + '%'; el.style.top = seat.groundY + '%'; el.style.width = Math.min(14, Math.max(7, w)).toFixed(2) + '%';
    el.classList.toggle('faceright', seat.face === 'right');
  }
  function seatedImg(img, fallback) {
    var want = seatedSrc(), probe = new Image();
    probe.onload = function () { img.src = want; img.classList.add('seated'); };
    probe.onerror = function () { img.src = fallback; img.classList.remove('seated'); };
    probe.src = want;
  }
  /* the bench: breathing with Erin or the orb, seated on the bench itself */
  var meditatorWatch = null;
  function sitAt(spot, holoSpot, back) {
    var L = R.layout(); placeEl(R.els.meditator, spot); placeEl(doc.getElementById('aura'), { x: spot.x, y: spot.y - 2, w: spot.w * 1.55 }); placeEl(R.els.holo, holoSpot || { x: spot.x + 10, y: spot.y - 2, w: spot.w * 1.27 });
    if (back) { L.home.x = back.x; L.home.y = back.y; L.home.flip = !!back.flip; } /* she comes back beside the bench, not to the gate */
    var img = R.els.meditator && R.els.meditator.querySelector('img');
    if (img) {
      seatedImg(img, ART + 'avatar-meditate.webp'); R.els.meditator.classList.add('onseat');
      if (spot.seat) seatPlace(R.els.meditator, spot.seat); else R.els.meditator.classList.remove('faceright');
      if (!meditatorWatch && root.MutationObserver) {
        /* when the session ends the mat gets its own pose back, so the next mat session is cross-legged again */
        meditatorWatch = new MutationObserver(function () { if (!R.els.meditator.classList.contains('on') && R.els.meditator.classList.contains('onseat')) { R.els.meditator.classList.remove('onseat', 'faceright'); img.classList.remove('seated'); img.src = ART + 'avatar-meditate.webp'; } });
        meditatorWatch.observe(R.els.meditator, { attributes: true, attributeFilter: ['class'] });
      }
    }
  }
  var sitting = null;
  function sitDown(spot, back) {
    if (root.OvuWalk.napping()) return;
    standUp(); var wrap = R.els.props, el = doc.createElement('div');
    el.className = 'nb sitter'; el.dataset.id = 'sitter'; el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', 'You are sitting on the bench. Tap to get up.');
    el.style.left = spot.x + '%'; el.style.top = spot.y + '%'; el.style.width = spot.w + '%';
    if (spot.seat) seatPlace(el, spot.seat);
    el.innerHTML = '<img src="' + ART + 'avatar-' + outfitId() + '.webp" alt="">'; wrap.appendChild(el); seatedImg(el.querySelector('img'), el.querySelector('img').src);
    sitting = { spot: spot, back: back, el: el }; R.els.scene.classList.add('sitting'); R.chime('tap');
    R.toast('Sitting a while. Tap anywhere to get up.', 'chair');
  }
  function standUp() {
    if (!sitting) return; var st = sitting; sitting = null;
    if (st.el && st.el.parentNode) st.el.remove(); R.els.scene.classList.remove('sitting');
    if (st.back) { R.els.avatar.style.transition = 'none'; R.placeAvatar(st.back, st.back.flip); void R.els.avatar.offsetWidth; R.els.avatar.style.transition = ''; }
  }
  function openBench(spot, holoSpot, back) {
    if (root.OvuWalk.napping()) return;
    if (R.sessionOn()) { R.hudOn(true); return; }
    var recent = S.list('mindfulness', { from: S.addDays(S.today(), -6), to: S.today() }), mins = recent.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0);
    R.openSheet('bench', 'Sit a while', 'The bench is yours for a few minutes', 'chair',
      '<div class="erin small"><img src="assets/avatars/erin/erin-chibi-face.webp" alt="Erin Lee"><div><b>Breathe with Erin, outdoors</b><small>Pick a length and Erin sits beside you on the bench, speaking in her own voice. Or follow the breathing orb with its soft bell.</small></div></div>' +
      '<div class="sessions" id="benchSessions"><button type="button" class="session on" data-kind="erin" data-min="3"><b>Erin · 3 minutes</b><small>Guided breathing, a soft close</small></button><button type="button" class="session" data-kind="erin" data-min="6"><b>Erin · 6 minutes</b><small>A longer settle</small></button><button type="button" class="session" data-kind="breathe" data-min="2"><b>Orb · 2 min</b><small>4-4-6 with a quiet bell</small></button><button type="button" class="session" data-kind="breathe" data-min="5"><b>Orb · 5 min</b><small>Follow the orb</small></button></div>' +
      '<div class="orbwrap"><div class="orb out" id="orb"></div><div class="orbtext" id="orbText">Ready when you are</div><div class="orbsub" id="orbSub">' + (mins ? Math.round(mins) + ' min this week' : 'First session this week') + '</div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="benchStart"><span class="ms">self_improvement</span>Begin</button><button type="button" class="btn soft" id="benchSit"><span class="ms">chair</span>Just sit a while</button></div>' +
      '<p class="help">Sessions of a minute or more are saved to your journal, the same as on your mat. Sitting is just sitting.</p>');
    doc.getElementById('benchSit').addEventListener('click', function () { R.hideSheet(); sitDown(spot, back); });
    doc.getElementById('benchSessions').addEventListener('click', function (e) { var b = e.target.closest('.session'); if (!b) return; Array.prototype.slice.call(doc.querySelectorAll('#benchSessions .session')).forEach(function (x) { x.classList.toggle('on', x === b); }); });
    doc.getElementById('benchStart').addEventListener('click', function () {
      if (R.sessionOn()) return; var sel = doc.querySelector('#benchSessions .session.on');
      sitAt(spot, holoSpot, back); R.enterMeditation(); R.runSession(sel.dataset.kind, Number(sel.dataset.min));
    });
  }
  var POND_LINES = ['A lotus opens in its own time. So do you.', 'Three slow breaths by the water. In, and out.', 'Whatever today held, it can rest here a moment.', 'Still water, still mind, for a breath or two.'];
  function openPond() {
    if (root.OvuWalk.napping()) return;
    var line = POND_LINES[Math.floor(Date.now() / 3600000) % POND_LINES.length];
    R.showThought('🌸'); root.setTimeout(R.hideThought, 2600); R.toast(line, 'water');
    var wrap = R.els.props, rip = doc.createElement('div'); rip.className = 'ripple'; rip.setAttribute('aria-hidden', 'true'); rip.style.left = '68%'; rip.style.top = '58%'; rip.style.width = '14%'; wrap.appendChild(rip); root.setTimeout(function () { rip.remove(); }, 2200);
  }
  function openGreenhouse() {
    if (root.OvuWalk.napping()) return;
    var H = root.OvuHerbs, cs = S.cycleStats(), teas = H ? H.forPhase(cs.mode === 'suspended' ? null : cs.phase) : []; /* every tea, the ones for this phase first */
    R.openSheet('greenhouse', 'The greenhouse', 'Teas and herbs, with their evidence', 'local_florist',
      '<p class="help">' + (cs.phase ? 'Picked for your ' + esc(cs.phase) + ' phase first.' : 'Pick what sounds kind today.') + ' Guidance, not a prescription; check with a clinician if you are pregnant, breastfeeding or on medicines.</p>' +
      '<div class="teas">' + teas.map(function (t) { return '<div class="tea">' + (t.img ? '<img class="teaimg" src="' + R.ART + t.img + '" alt="">' : '<span class="ms">' + esc(t.icon || 'local_cafe') + '</span>') + '<div><b>' + esc(t.name) + '</b><span>' + esc(t.why) + '</span><small>' + esc(t.research) + '</small>' + (t.care ? '<em>' + esc(t.care) + '</em>' : '') + '</div></div>'; }).join('') + '</div>' +
      (H && H.TAKE_CARE ? '<p class="help">' + esc(typeof H.TAKE_CARE === 'string' ? H.TAKE_CARE : '') + '</p>' : ''));
  }
  /* hotspot handlers are consulted first by the room; each checks it is in the garden */
  function inGarden(L) { return L && L.id === 'garden'; }
  R.hotspotHandlers.gate = function (id, L) { if (!inGarden(L) && L.id !== 'plaza') return false; root.OvuWalk.travel('home'); return true; };
  R.hotspotHandlers.arch = function (id, L) { if (!inGarden(L)) return false; root.OvuWalk.travel('street'); return true; };
  R.hotspotHandlers.plot = function (id, L) { if (!inGarden(L)) return false; openPlot(); return true; };
  R.hotspotHandlers.pond = function (id, L) { if (!inGarden(L)) return false; openPond(); return true; };
  R.hotspotHandlers.greenhouse = function (id, L) { if (!inGarden(L)) return false; openGreenhouse(); return true; };
  R.hotspotHandlers.bench = function (id, L) { if (!inGarden(L)) return false; openBench(GARDEN.meditator, GARDEN.holo, { x: 37, y: 53, flip: true }); return true; };
  G.openBench = openBench; G.sitAt = sitAt; G.sitDown = sitDown; G.standUp = standUp; G.sitting = function () { return !!sitting; }; G.renderPlot = renderPlot; G.openPlot = openPlot; G.watering = function () { return !!watering; };
  R.on('boot', function () {
    R.on('props', function (L) { renderPlot(L); if (sitting && !R.els.props.contains(sitting.el)) R.els.props.appendChild(sitting.el); }); /* a props re-render keeps her seated */
    R.on('layout', function (L) { if (watering) finishWatering(false); if (sitting) { sitting.el.remove(); sitting = null; R.els.scene.classList.remove('sitting'); } if (inGarden(L)) renderPlot(); });
    /* seated: the first tap anywhere stands her up, then the tap goes on to do what it does */
    R.els.scene.addEventListener('click', function (e) { if (sitting && !e.defaultPrevented) standUp(); }, true); /* not the click the camera swallowed after a drag */
    doc.addEventListener('keydown', function (e) { if (sitting && /^(Arrow|w|a|s|d|W|A|S|D)/.test(e.key)) standUp(); }, true);
  });
})(window);
