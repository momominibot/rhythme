/* Rhythme seats (Jamie, 21 Oct 2026: "each of the sitting interface should be different with some animation and different
 * practice with erin, i want it refreshing for each chair... for the sitting in the cave will be different - it's purely
 * frequency sounds"). The shape follows a Codex design review of the same day (docs/design/2026-10-21-seats.md).
 * Every seat keeps "just sit", where nothing is counted. Each bench has its own seated practice of about three minutes in
 * Erin Lee's cloned voice (Rhythme's words, with her permission): the street bench listens, the bench by the board wishes
 * well, the bench by the tree rests in the shade, the harbour bench watches the water. The garden bench keeps Breathe with Erin (ovu-garden.js) and the cave's warm stone
 * is the crystals' tone with no voice at all (ovu-tones.js). Each seat has its own small animation layer: environmental,
 * never timed to breath, still under reduced motion. Pure parts first (testable in node), then the runner. */
(function (root) {
  'use strict';
  var GUIDE = 'assets/audio/guide-interim/', MIN_SAVE_S = 60; /* a minute of active practice time, unrounded, before anything is saved */
  var CREDIT = 'Rhythme’s words, read in Erin Lee’s cloned voice with her permission';
  /* secs = her clip + the silence after it + 0.6 s (one guarded voice run, 21 Oct 2026; durations from ffprobe) */
  var SCRIPTS = {
    street: { name: 'Sounds of the street', icon: 'hearing', about: 'Listening, eyes open or closed', steps: [
      { text: 'Settle onto the bench and find a position that works for you. Keep your eyes open or closed. You can move, skip a step, or stop whenever you need.', secs: 21 },
      { text: 'Notice a sound around you, beyond your phone. If listening does not suit you, notice a colour or a shape instead.', secs: 25 },
      { text: 'Perhaps notice a sound farther away. There is no need to strain.', secs: 21 },
      { text: 'Sounds arrive, stay a while, and pass. Each time one catches you, notice it, and let it go on its way.', secs: 34 },
      { text: 'If your thoughts carry you off, that is what thoughts do. When you notice, come back to one sound.', secs: 31 },
      { text: 'Notice whatever sounds are here, near or far. You do not need to take them all in.', secs: 31 },
      { text: 'When you are ready, notice the space around you. You can stay here, or carry on with your day.', secs: 13 }
    ] },
    plaza: { name: 'Wishing well', icon: 'volunteer_activism', about: 'A kindness practice, every part optional', steps: [
      { text: 'Make yourself comfortable on the bench, in a position that works for you. Keep your eyes open or closed. You can skip a step, or stop whenever you need.', secs: 21 },
      { text: 'If someone, or an animal, comes easily to mind, you might wish them well. May you be safe. May you be at ease. Otherwise, simply notice the square.', secs: 35 },
      { text: 'If you would like, offer yourself the same wish. May I be safe. May I be at ease. You can change the words, stay with the first person, or skip this part.', secs: 35 },
      { text: 'If you would like, think of someone you pass most days but hardly know, and wish them the same. May you be safe. May you be at ease.', secs: 29 },
      { text: 'If you would like, let the wish widen to everyone in the square, and out past it, to everyone going about their day. May we all be safe. May we all be at ease.', secs: 34 },
      { text: 'If this feels uncomfortable, stop now, or look around you. Nothing has to change. You can simply sit.', secs: 14 }
    ] },
    tree: { name: 'In the shade', icon: 'park', about: 'Light, leaves and one small thing you are glad of, every part optional', steps: [
      { text: 'Settle onto the bench in the shade of the tree, in a position that works for you. Keep your eyes open or half closed. You can skip a step, or stop whenever you need.', secs: 23 },
      { text: 'Let your eyes rest on the leaves of the tree, or on a patch of light and shadow near you. Notice whether it stays still or moves. There is no need to follow every leaf.', secs: 34 },
      { text: 'Notice where the air touches your skin. Perhaps it feels cool, perhaps it is still. Notice the seat under you, and your feet on the ground.', secs: 32 },
      { text: 'If a thought pulls you away, that is all right. Notice where it took you, and come back to the light through the leaves.', secs: 30 },
      { text: 'If you would like, bring to mind one small thing from today that you are glad of. A warm drink, a kind word, this bit of shade. If nothing comes to mind, that is fine too.', secs: 35 },
      { text: 'When you are ready, look around you again. You can stay a while longer, or carry on with your day.', secs: 15 }
    ] },
    harbour: { name: 'Watching the water', icon: 'water', about: 'Eyes on the water, nothing to do', steps: [
      { text: 'Sit back on the bench. Let your eyes rest on the water, or on a still spot nearby. There is nothing to do here but watch. You can stop whenever you need.', secs: 23 },
      { text: 'Follow one ripple from where it starts to where it fades. Then another.', secs: 26 },
      { text: 'Notice the weight of your body on the bench, your feet on the ground, the air on your face. Let the water keep moving while you stay still.', secs: 31 },
      { text: 'There is no need to change your breathing. You can keep your attention on the water.', secs: 24 },
      { text: 'If a thought pulls you away, let it drift like something on the surface, and come back to the water.', secs: 28 },
      { text: 'The guide ends here. You can keep sitting without recording, or get up when you are ready.', secs: 11 }
    ] }
  };
  /* with reduced motion the water does not ripple on the plate, so the second line asks for a colour instead (Codex, 21 Oct) */
  var HARBOUR_RM = { text: 'Notice a colour or a reflection on the water. Let your eyes rest there.', secs: 26, file: 'seat-harbourrm-0-0.mp3' };
  /* the seats: which scene, which words, which animation, what the plain sit is called. Every bench has its own words and
   * its own animation, and each is its own seat, one thank-you a day each (Codex, 21 Oct: the bench by the tree had shared
   * the board bench's words; its own clips came from one guarded voice run the same day) */
  var SEATS = {
    street: { id: 'street', scene: 'street', practice: 'street', title: 'The street bench', sub: 'Under the lanterns', fx: 'lanterns', sit: 'Just sit a while' },
    'plaza:bench': { id: 'plaza:bench', scene: 'plaza', practice: 'plaza', title: 'The bench by the board', sub: 'On the square', fx: 'square', sit: 'Just sit a while' },
    'plaza:bench2': { id: 'plaza:bench2', scene: 'plaza', practice: 'tree', title: 'The bench by the tree', sub: 'In the shade', fx: 'shade', sit: 'Just sit a while' },
    harbour: { id: 'harbour', scene: 'harbour', practice: 'harbour', title: 'The bench', sub: 'Under the sea-almond tree', fx: 'water', sit: 'Just watch the water' },
  };
  function steps(practice, reduced) {
    var p = SCRIPTS[practice]; if (!p) return [];
    return p.steps.map(function (s, i) {
      var st = { key: practice + i, text: s.text, secs: s.secs, audio: GUIDE + 'seat-' + practice + '-0-' + i + '.mp3' };
      if (reduced && practice === 'harbour' && i === 1) { st.text = HARBOUR_RM.text; st.secs = HARBOUR_RM.secs; st.audio = GUIDE + HARBOUR_RM.file; }
      return st;
    });
  }
  function total(practice, reduced) { return steps(practice, reduced).reduce(function (t, s) { return t + s.secs; }, 0); }
  /* the one entry a confirmed practice saves, or null under a minute (eligibility on the unrounded time: 59.9 s is not a minute) */
  function entry(seatId, o) {
    var seat = SEATS[seatId], p = seat && SCRIPTS[seat.practice], raw = Math.max(0, Number(o && o.seconds) || 0);
    if (!p || raw < MIN_SAVE_S || !o.confirmed) return null;
    var secs = Math.round(raw);
    return { kind: 'informal', activity: 'seat', seat: seatId, scene: seat.scene, activityName: p.name, variation: 0, seconds: secs, minutes: Math.round(secs / 6) / 10,
      completed: !!o.finished, finished: !!o.finished, stoppedEarly: !o.finished, confirmedReal: true, startedAt: o.startedAt || null, guide: CREDIT };
  }
  /* practice time: only while a step is running, never while paused or while the page is hidden */
  function makeClock(now) {
    now = now || function () { return Date.now(); };
    var ms = 0, since = null;
    return {
      run: function () { if (since === null) since = now(); },
      hold: function () { if (since !== null) { ms += now() - since; since = null; } },
      ms: function () { return ms + (since === null ? 0 : now() - since); },
      running: function () { return since !== null; }
    };
  }
  var SE = { SEATS: SEATS, SCRIPTS: SCRIPTS, HARBOUR_RM: HARBOUR_RM, MIN_SAVE_S: MIN_SAVE_S, CREDIT: CREDIT, GUIDE: GUIDE, steps: steps, total: total, entry: entry, makeClock: makeClock };
  root.OvuSeats = SE;

  /* ---------- the runner (browser only) ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, G = root.OvuGarden, doc = root.document;
  if (!R || !S || !doc || !G || !W) return;
  var ART = R.ART;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reduced() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  /* where each seat is and where she comes back to; the harbour keeps its own bench sit (ovu-harbour.js) */
  function spotFor(seatId) {
    var L = R.LAYOUTS, C = root.OvuCommunity, ST = root.OvuStreet, HB = root.OvuHarbour;
    if (seatId === 'street' && L.street) return { spot: L.street.meditator, back: ST && ST.BENCH_WP };
    if (seatId === 'plaza:bench' && L.plaza) return { spot: L.plaza.meditator, back: { x: 34, y: 64, flip: true } };
    if (seatId === 'plaza:bench2' && C && C.BENCH2) return { spot: C.BENCH2.sit, back: C.BENCH2.back };
    if (seatId === 'harbour' && HB && HB.LAYOUT) return { spot: { seat: HB.LAYOUT.seat }, back: null };
    return null;
  }
  var lastSit = null; /* which bench she is just sitting on, so the plaza's two benches keep their own animation */
  function plainSit(seatId) {
    lastSit = seatId;
    if (seatId === 'harbour') { if (root.OvuHarbour && root.OvuHarbour.sitDown) root.OvuHarbour.sitDown(); return; }
    var sp = spotFor(seatId); if (sp && sp.spot) G.sitDown(sp.spot, sp.back);
  }
  function doneToday(seatId) { try { var l = root.OvuRewards && root.OvuRewards.ledger(); return !!(l && l.seatDay && l.seatDay.day === S.today() && l.seatDay.seats && l.seatDay.seats[seatId]); } catch (e) { return false; } }

  /* the bench sheet: Erin's practice, or just sitting */
  function open(seatId) {
    var seat = SEATS[seatId], p = seat && SCRIPTS[seat.practice]; if (!seat) return;
    if (W.napping && W.napping()) return;
    if (R.sessionOn() || R.practiceOn() || run) { R.hudOn(true); return; }
    var mins = Math.max(1, Math.round(total(seat.practice, reduced()) / 60));
    R.openSheet('seat-' + seat.practice, seat.title, seat.sub, 'chair',
      '<div class="erin small"><img src="assets/avatars/erin/erin-chibi-face.webp" alt="Erin Lee"><div><b>' + esc(p.name) + '</b><small>' + esc(p.about) + '. About ' + mins + ' minutes in Erin’s voice, seated. Pause, skip a step or stop whenever you like.</small></div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="seatBegin"><span class="ms">' + p.icon + '</span>Begin</button><button type="button" class="btn soft" id="seatSit"><span class="ms">chair</span>' + esc(seat.sit) + '</button></div>' +
      '<p class="help">A practice of a minute or more can be saved to your journal, with the small thank-you once a day for this seat (practices share up to six hearts a day)' + (doneToday(seatId) ? ' (already said today)' : '') + '. Sitting is just sitting: nothing is counted. ' + esc(CREDIT) + '.</p>');
    $('seatSit').addEventListener('click', function () { R.hideSheet(); plainSit(seatId); });
    $('seatBegin').addEventListener('click', function () { begin(seatId); });
  }

  var run = null, panel = null, pendingAsk = null, doneWait = 0;
  function otherOwner() {
    if (R.asleep()) return ['She is asleep. Tap the bed to wake her first.', 'bedtime'];
    if (R.sessionOn() || R.practiceOn() || R.meditating() || (root.OvuMorning && root.OvuMorning.active())) return ['Finish what you are doing first.', 'info'];
    return null;
  }
  function begin(seatId) {
    var seat = SEATS[seatId]; if (!seat || run) return;
    if (root.OvuSound) root.OvuSound.play('boop'); /* a practice begins */
    var L = R.layout(); if (!L || L.id !== seat.scene) return;
    var other = otherOwner(); if (other) { R.toast(other[0], other[1]); return; }
    var sp = spotFor(seatId); if (!sp || !sp.spot || !sp.spot.seat) return;
    var st = steps(seat.practice, reduced()), audio = null;
    try { audio = new Audio(); } catch (e) { }
    run = { seat: seat, id: seatId, spot: sp.spot, back: sp.back, steps: st, i: -1, paused: false, quiet: !!(root.OvuVoice && root.OvuVoice.muted && root.OvuVoice.muted()), /* a remembered mute starts her quiet (perimenopause walk, 21 Oct) */ timer: null, left: 0, t0: 0, waits: 0, clock: makeClock(), startedAt: new Date().toISOString(), audio: audio, pending: null, preloaded: null, el: null };
    /* the first line starts inside the tap, which unlocks the one audio element for the rest (as the room's practices do) */
    if (audio) { try { audio.src = st[0].audio; run.preloaded = st[0].audio; var pr = audio.play(); if (pr && pr.catch) pr.catch(function () { }); } catch (e) { } }
    R.emit('activity', 'seat', seatId); /* the care steps, a float on the water, the greenhouse minute: everything else steps aside first */
    if (W.walking && W.walking()) { try { W.stop(); } catch (e) { } }
    try { R.freezeWalk(); } catch (e) { }
    R.cancelIdle(); if (R.endMoment) R.endMoment();
    if (root.OvuPodcast) { try { root.OvuPodcast.pause(); } catch (e) { } }
    R.hideSheet();
    mount(); showPanel(); next(false); fxTick();
  }
  function mount() {
    var el = doc.createElement('div'), outfit = (function (o) { return /^[a-z0-9-]{1,32}$/.test(o || '') ? o : 'base'; })(S.profile().outfit); /* an imported outfit name never becomes markup (Codex sweep, 21 Oct) */
    el.className = 'nb springsitter seatsitter'; el.dataset.id = 'seatsitter'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<img src="' + ART + 'avatar-' + outfit + '.webp" alt="">';
    R.els.props.appendChild(el); G.seatPlace(el, run.spot.seat); G.seatedImg(el.querySelector('img'), el.querySelector('img').src);
    run.el = el; R.els.scene.classList.add('sitting', 'springsit', 'seatpractice'); R.els.avatar.classList.add('hidden'); /* hidden outright, so the camera does not follow an invisible standing avatar */
  }
  function unmount(r) {
    if (r.el && r.el.parentNode) r.el.remove();
    R.els.scene.classList.remove('sitting', 'springsit', 'seatpractice'); R.els.avatar.classList.remove('hidden');
  }
  /* the panel: the Morning start panel's shape and styles, its own ids */
  function ensurePanel() {
    if (panel) return panel;
    panel = doc.createElement('section'); panel.className = 'mpanel seatpanel'; panel.id = 'spanel'; panel.hidden = true; panel.tabIndex = -1; panel.setAttribute('aria-labelledby', 'spTitle');
    panel.innerHTML = '<p class="mp-count" id="spCount"></p><div class="mp-say" aria-live="polite" aria-atomic="true"><h3 id="spTitle"></h3><p id="spText"></p></div>' +
      '<div class="mp-btns" id="spBtns"><button type="button" class="btn primary" id="spPause">Pause</button><button type="button" class="btn ghost" id="spNext">Next</button><button type="button" class="btn ghost" id="spQuiet">Voice off</button><button type="button" class="btn ghost" id="spStop">Stop</button></div>';
    var mp = $('mpanel'); if (mp && mp.parentNode) mp.parentNode.insertBefore(panel, mp.nextSibling); else doc.body.appendChild(panel);
    $('spPause').addEventListener('click', pauseToggle); $('spNext').addEventListener('click', function () { next(true); }); $('spQuiet').addEventListener('click', quietToggle); $('spStop').addEventListener('click', stop);
    return panel;
  }
  function showPanel() { ensurePanel(); panel.hidden = false; try { panel.focus({ preventScroll: true }); } catch (e) { } }
  function hidePanel() { if (panel) panel.hidden = true; }
  function step() { return run && run.steps[run.i]; }
  function paint() {
    var s = step(); if (!s || !run) return;
    $('spCount').textContent = 'Step ' + (run.i + 1) + ' of ' + run.steps.length + (run.paused ? ' · paused' : '');
    $('spTitle').textContent = SCRIPTS[run.seat.practice].name; $('spText').textContent = s.text;
    $('spPause').textContent = run.paused ? 'Resume' : 'Pause'; $('spQuiet').textContent = run.quiet ? 'Voice on' : 'Voice off';
    $('spNext').textContent = run.i >= run.steps.length - 1 ? 'Finish' : 'Next';
  }
  function play(url) {
    var a = run && run.audio; if (!a) return;
    try {
      if (run.preloaded === url) { run.preloaded = null; if (a.paused && !a.ended) { var p0 = a.play(); if (p0 && p0.catch) p0.catch(function () { }); } return; }
      a.pause(); a.src = url; a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () { });
    } catch (e) { }
  }
  function silence(a) { if (!a) return; try { a.pause(); } catch (e) { } }
  function arm() { clearTimeout(run.timer); run.t0 = Date.now(); run.timer = setTimeout(due, Math.max(0, run.left)); }
  /* a step's time is up: if its line is still being said (a clip that started late), wait a second at a time, at most eight */
  function due() {
    if (!run) return; var a = run.audio;
    if (a && !run.quiet && a.src && !a.paused && !a.ended && run.waits < 8) { run.waits++; run.left = 1000; arm(); return; }
    next(false);
  }
  function next(byHand) {
    if (!run) return;
    if (run.i >= run.steps.length - 1) { finish(true); return; }
    run.i++; var s = step(); run.left = s.secs * 1000; run.waits = 0; paint();
    if (!run.paused) { run.clock.run(); arm(); }
    if (run.quiet) { run.pending = null; silence(run.audio); } else if (run.paused) run.pending = s.audio; else play(s.audio);
    if (byHand) R.chime('tap');
  }
  function pauseToggle() {
    if (!run) return;
    if (!run.paused) { run.paused = true; run.left = Math.max(0, run.left - (Date.now() - run.t0)); clearTimeout(run.timer); run.clock.hold(); silence(run.audio); }
    else {
      run.paused = false; run.clock.run(); arm();
      if (!run.quiet) { if (run.pending) { var p = run.pending; run.pending = null; play(p); } else if (run.audio && run.audio.src && !run.audio.ended) { try { var pr = run.audio.play(); if (pr && pr.catch) pr.catch(function () { }); } catch (e) { } } }
    }
    paint();
  }
  function quietToggle() {
    if (!run) return; run.quiet = !run.quiet;
    if (!run.quiet && root.OvuVoice && root.OvuVoice.muted && root.OvuVoice.muted()) root.OvuVoice.set(false); /* Voice on lifts the app's remembered mute, as Morning start does */
    if (run.quiet) { silence(run.audio); run.pending = null; }
    else { var s = step(); if (s && !run.paused) play(s.audio); else if (s) run.pending = s.audio; } /* the voice comes back with the current line from its start */
    paint();
  }
  function stop() { if (run) finish(false); }
  /* the guide ends or she stops: she stays seated as on any bench; a minute or more of active time may be saved, once confirmed */
  function finish(finished) {
    var r = run; if (!r) return;
    clearTimeout(r.timer); r.clock.hold(); silence(r.audio);
    var exact = r.clock.ms() / 1000, secs = Math.round(exact), day = S.today(), seatId = r.id, name = SCRIPTS[r.seat.practice].name;
    run = null; hidePanel(); unmount(r);
    if (R.asleep()) { fxTick(); return; }
    plainSit(seatId); fxTick();
    if (exact < MIN_SAVE_S) { R.toast(finished ? 'That is the practice.' : 'Stopped. Nothing under a minute is recorded.', 'chair'); return; }
    var saved = false, mins = Math.max(1, Math.round(secs / 60));
    function ask() {
      clearInterval(doneWait); pendingAsk = null;
      R.openSheet('seatDone', finished ? name : 'Stopping early', 'About ' + mins + ' minute' + (mins > 1 ? 's' : '') + ' of practice', 'chair',
        '<p class="mintro">' + (mins > 1 ? 'Save these ' + mins + ' minutes' : 'Save this minute') + ' to your journal?</p>' +
        '<div class="row"><button type="button" class="btn primary" id="sdYes"><span class="ms">check</span>Save practice</button><button type="button" class="btn ghost" id="sdNo">Not this time</button></div>' +
        '<p class="help">Save it if you really did it. A mind that wandered and came back still counts: noticing is the practice.</p>');
      $('sdYes').addEventListener('click', function () {
        if (saved) return; if (R.asleep()) { R.hideSheet(); return; }
        var data = entry(seatId, { seconds: exact, confirmed: true, finished: finished, startedAt: r.startedAt }); if (!data) { R.hideSheet(); return; }
        var ev; try { ev = S.add('mindfulness', day, data); } catch (e) { R.toast('This practice could not be saved: ' + e.message + ' Try again, or tap Not this time.', 'error'); return; } /* the sheet stays for a retry */
        saved = true; R.hideSheet(); R.afterSave(ev, 'Saved to your journal.');
      });
      $('sdNo').addEventListener('click', function () { R.hideSheet(); R.toast('No worries. The bench is there whenever you like.', 'chair'); });
    }
    /* another sheet is open (a symptoms form, the bed): never replace it; ask once it closes, unless she falls asleep */
    clearInterval(doneWait); pendingAsk = null;
    if (R.sheetOpen()) {
      R.toast('The practice is done. It will ask about saving when you close this.', 'chair'); pendingAsk = ask;
      doneWait = setInterval(function () { if (R.asleep()) { clearInterval(doneWait); pendingAsk = null; return; } if (!R.sheetOpen()) { clearInterval(doneWait); ask(); } }, 400);
      return;
    }
    ask();
  }
  /* sleep, clear, import, leaving the scene, another activity, bedtime: the practice ends at once, nothing asked, nothing left behind */
  function cancel() {
    clearInterval(doneWait); pendingAsk = null;
    if (R.sheetId && R.sheetId() === 'seatDone') R.hideSheet();
    var r = run; if (!r) return; run = null;
    clearTimeout(r.timer); r.clock.hold(); silence(r.audio); hidePanel(); unmount(r); fxTick();
  }

  /* ---------- the animation layers: small, environmental, below the sitter, inside the plate so the camera carries them ---------- */
  var fx = null, fxKind = null;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function wanted() {
    var L = R.layout(); if (!L) return null;
    if (run) return run.seat.fx;
    var sat = G.sitting && G.sitting();
    if (L.id === 'garden' && (sat || (R.meditating() && R.els.meditator.classList.contains('onseat')))) return 'petals';
    if (L.id === 'street' && sat) return 'lanterns';
    if (L.id === 'plaza' && sat) return lastSit === 'plaza:bench2' ? 'shade' : 'square';
    if (L.id === 'harbour' && root.OvuHarbour && root.OvuHarbour.sitting && root.OvuHarbour.sitting()) return 'water';
    if (L.id === 'cave' && root.OvuTones && root.OvuTones.sitting && root.OvuTones.sitting()) return 'crystals';
    return null;
  }
  /* each kind: a handful of pooled elements with their own place, size and timing, so nothing moves in step with anything */
  var FX = {
    petals: function (add) { for (var i = 0; i < 10; i++) add('i', 'petal', { left: rnd(8, 62), top: rnd(14, 48), w: rnd(1.1, 1.9), d: rnd(9, 15), delay: -rnd(0, 15) }); },
    lanterns: function (add) { for (var i = 0; i < 12; i++) add('i', 'mote', { left: rnd(22, 84), top: rnd(42, 66), w: rnd(0.8, 1.4), d: rnd(6, 11), delay: -rnd(0, 11) }); },
    square: function (add) { for (var i = 0; i < 9; i++) add('i', 'spark', { left: rnd(38, 60), top: rnd(38, 52), w: rnd(0.7, 1.3), d: rnd(2.6, 4.8), delay: -rnd(0, 5) }); for (var j = 0; j < 6; j++) add('i', 'leaf', { left: rnd(58, 90), top: rnd(40, 60), w: rnd(1, 1.6), d: rnd(10, 16), delay: -rnd(0, 16) }); },
    water: function (add) { for (var i = 0; i < 5; i++) add('b', 'ring', { left: rnd(50, 88), top: rnd(50, 70), w: rnd(4, 7), d: rnd(5.5, 9.5), delay: -rnd(0, 9) }); for (var j = 0; j < 6; j++) add('i', 'streak', { left: rnd(48, 92), top: rnd(49, 72), w: rnd(4, 8), d: rnd(5, 8), delay: -rnd(0, 8) }); },
    shade: function (add) { for (var i = 0; i < 14; i++) add('i', 'fleck', { left: rnd(62, 93), top: rnd(56, 70), w: rnd(2.2, 4.2), d: rnd(7, 13), delay: -rnd(0, 13) }); },
    crystals: function (add) { for (var i = 0; i < 7; i++) add('i', 'glint', { left: rnd(15, 33), top: rnd(31, 48), w: rnd(1.4, 2.4), d: i % 2 ? 11 : 7, delay: -rnd(0, 11) }); }
  };
  function showFx(kind) {
    hideFx(); if (!kind || !FX[kind] || !R.els.inner) return;
    fx = doc.createElement('div'); fx.id = 'seatfx'; fx.className = kind; fx.setAttribute('aria-hidden', 'true');
    FX[kind](function (tag, cls, o) {
      var el = doc.createElement(tag); el.className = cls;
      el.style.left = o.left.toFixed(1) + '%'; el.style.top = o.top.toFixed(1) + '%'; el.style.width = o.w.toFixed(2) + '%';
      el.style.animationDuration = o.d.toFixed(1) + 's'; el.style.animationDelay = o.delay.toFixed(1) + 's';
      fx.appendChild(el);
    });
    var props = R.els.props; if (props && props.parentNode === R.els.inner) R.els.inner.insertBefore(fx, props); else R.els.inner.appendChild(fx);
    fxKind = kind;
  }
  function hideFx() { if (fx && fx.parentNode) fx.remove(); fx = null; fxKind = null; }
  function fxTick() { var k = wanted(); if (k !== fxKind) showFx(k); else if (k && fx && !fx.isConnected) showFx(k); }

  SE.open = open; SE.begin = begin; SE.cancel = cancel; SE.stop = stop; SE.active = function () { return !!run; };
  SE.state = function () { return run ? { seat: run.id, i: run.i, key: step() && step().key, paused: run.paused, quiet: run.quiet, left: run.left, seconds: Math.round(run.clock.ms() / 1000), ms: run.clock.ms() } : null; };
  SE.fxKind = function () { return fxKind; }; SE.pendingAsk = function () { return !!pendingAsk; };
  R.on('boot', function () {
    /* the street and plaza benches open their own seats (the garden keeps Breathe with Erin on its bench) */
    var prevBench = R.hotspotHandlers.bench, prevBench2 = R.hotspotHandlers.bench2;
    R.hotspotHandlers.bench = function (id, L) {
      if (L && L.id === 'street') { open('street'); return true; }
      if (L && L.id === 'plaza') { open('plaza:bench'); return true; }
      return prevBench ? prevBench(id, L) : false;
    };
    R.hotspotHandlers.bench2 = function (id, L) { if (L && L.id === 'plaza') { open('plaza:bench2'); return true; } return prevBench2 ? prevBench2(id, L) : false; };
    R.on('layout', function (L) { if (run && (!L || L.id !== run.seat.scene)) cancel(); fxTick(); });
    R.on('activity', function (kind, id) { if (run && !(kind === 'seat' && id === run.id)) cancel(); });
    R.on('beforeWalk', function () { if (run) cancel(); });
    R.on('props', function () { if (run && run.el && !run.el.isConnected) R.els.props.appendChild(run.el); fxTick(); });
    S.subscribe(function (reason) {
      if (!run && !pendingAsk) return;
      if (reason === 'clear' || reason === 'import' || reason === 'external' || String(reason).indexOf('sync') === 0) cancel();
      else if (reason === 'state' && S.state().sleeping) cancel();
    });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden && run && !run.paused) pauseToggle(); }); /* away: the clock holds and the voice waits */
    R.on('sheetHide', function () { setTimeout(fxTick, 60); }); /* the plain sits start from a sheet button: the weather follows at once */
    if (root.OvuTones && root.OvuTones.onChange) root.OvuTones.onChange(function () { fxTick(); }); /* the cave's glints come and go with the sound */
    setInterval(fxTick, 300);
  });
})(typeof window !== 'undefined' ? window : this);
