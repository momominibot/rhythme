/* Rhythme: Tideline Gym workouts (Jamie, 22 Oct 2026: gym animations on the treadmill, the weights and the yoga mat, with her
 * changing into a workout outfit automatically, Animal Crossing style; the bike joined them). Design note and Codex review:
 * docs/design/2026-10-22-gym-workouts.md.
 * Each station of the gym (ovu-lanescene.js GYMSPOTS) is a workout she does on the machine while the person moves too: she
 * turns into her workout clothes (room.js dressFor, a picture that is never saved), a frame strip plays on the machine while
 * a clock counts up, and at the end she turns back into her own clothes. Only her Save in the movement log writes anything
 * (checkpoint 29), and the log is only offered after a minute of active time. Pure parts first (testable in node), then
 * the runner, which mounts on boot like the other scene files. */
(function (root) {
  'use strict';
  var MIN_LOG_S = 60, LENGTHS = [5, 10, 15, 20, 30], DEFAULT_LEN = 10;
  /* the coach the shopkeepers branch puts in the gym stands here; no stand point or machine spot may be in it */
  var COACH = { x0: 38.5, x1: 42.5, y0: 51.8, y1: 54.6 };
  /* her two gym kits: the Mint yoga set, or a covered-head kit for a tudung wearer (never a kit that shows her hair) */
  var KITS = ['yoga', 'gym-tudung'];
  function kitFor(saved) { return saved === 'tudung' ? 'gym-tudung' : 'yoga'; }
  /* the strips (tools/art/walkcycle.py, one row of cells, feet on the bottom edge, scaled to the kit's standing sprite):
     frames, cell width and height, and the standing sprite's width, all in sprite pixels. test-core checks them against
     the files and their sidecars */
  var STRIPS = {
    yoga: {
      treadmill: { file: 'avatar-walk-yoga-side.webp', frames: 8, w: 380, h: 720, standW: 318 }, /* her own walk strip */
      bike: { file: 'avatar-gym-bike-yoga.webp', frames: 2, w: 482, h: 753, standW: 318 },
      weights: { file: 'avatar-gym-weights-yoga.webp', frames: 2, w: 364, h: 715, standW: 318 },
      mat: { file: 'avatar-gym-mat-yoga.webp', frames: 4, w: 574, h: 715, standW: 318 }
    },
    'gym-tudung': {
      treadmill: { file: 'avatar-walk-gym-tudung-side.webp', frames: 8, w: 370, h: 720, standW: 318 },
      bike: { file: 'avatar-gym-bike-gym-tudung.webp', frames: 2, w: 462, h: 764, standW: 318 },
      weights: { file: 'avatar-gym-weights-gym-tudung.webp', frames: 2, w: 406, h: 716, standW: 318 },
      mat: { file: 'avatar-gym-mat-gym-tudung.webp', frames: 4, w: 640, h: 773, standW: 318 }
    }
  };
  /* positions read off a 1% grid of shop-gym-2f-v1.webp. on: her feet on the machine; clip: the part of the plate in front
     of her there (a polygon in plate percent), so the window's arch and the low front wall hide what they should.
     anim: loop (frames at fps), or fade (each frame held, then cross-faded) */
  var STATIONS = {
    treadmill: { id: 'treadmill', act: 'walk', title: 'A walk on the treadmill', on: { x: 33.8, y: 64.6 }, flip: true, anim: { kind: 'loop', fps: 8 }, still: 0,
      clip: [[30.3, 0], [100, 0], [100, 100], [30.3, 100]] },
    bike: { id: 'bike', act: 'cycle', title: 'A ride on the bike', on: { x: 36, y: 75.5 }, flip: false, anim: { kind: 'loop', fps: 2.5 }, still: 0, /* her bike covers the plate's, its base behind the low wall as the plate's is */
      clip: [[30.2, 0], [42.3, 0], [42.3, 73.6], [40, 73.5], [38, 73], [36, 72.4], [33, 71.3], [30.2, 70.3]] }, /* between the window's arch and the door's, above the low wall */
    weights: { id: 'weights', act: 'strength', title: 'Slow lifts at the rack', on: { x: 55.5, y: 56.5 }, flip: false, anim: { kind: 'fade', hold: 2000, fade: 900 }, still: 0, clip: null },
    mat: { id: 'mat', act: 'yoga', title: 'A slow flow on the mat', on: { x: 48.5, y: 60.2 }, flip: false, anim: { kind: 'fade', hold: 5000, fade: 1200 }, still: 0, clip: null }
  };
  var ORDER = ['treadmill', 'bike', 'mat', 'weights']; /* GYMSPOTS order */
  function strip(kit, id) { var k = STRIPS[kit] || {}; return k[id] || null; }
  /* which frame shows after `ms` of active time; under reduced motion the station's still frame */
  function frameAt(anim, n, ms, reduced) {
    if (!(n > 0)) return 0;
    if (reduced || !anim) return 0;
    var t = Math.max(0, Number(ms) || 0);
    if (anim.kind === 'loop') return Math.floor(t * anim.fps / 1000) % n;
    return Math.floor(t / anim.hold) % n;
  }
  /* minutes the movement log is filled with: nothing under a minute of active time (59.9 s is not a minute) */
  function minutesFor(ms) { var s = Math.max(0, Number(ms) || 0) / 1000; return s < MIN_LOG_S ? 0 : Math.max(1, Math.round(s / 60)); }
  /* the element's box in plate percent (feet at on.x, on.y; width w; height h) and a plate polygon in its own percent */
  function box(on, w, h) { return { left: on.x - w / 2, top: on.y - h, w: w, h: h }; }
  function clipLocal(poly, b) {
    if (!poly || !b || !(b.w > 0) || !(b.h > 0)) return '';
    return 'polygon(' + poly.map(function (p) { return ((p[0] - b.left) / b.w * 100).toFixed(2) + '% ' + ((p[1] - b.top) / b.h * 100).toFixed(2) + '%'; }).join(', ') + ')';
  }
  /* active time: only while she is on the machine and the workout runs, never paused or hidden. hold(at) can end a span at
     the last moment it was seen running, so a page that froze without telling us adds nothing */
  function mono() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); } /* a clock change never adds minutes */
  function makeClock(now) {
    now = now || mono;
    var ms = 0, since = null;
    return {
      run: function () { if (since === null) since = now(); },
      hold: function (at) { if (since !== null) { var t = typeof at === 'number' ? Math.min(at, now()) : now(); ms += Math.max(0, t - since); since = null; } },
      ms: function () { return ms + (since === null ? 0 : now() - since); },
      running: function () { return since !== null; }
    };
  }
  function inCoach(p) { return p.x >= COACH.x0 && p.x <= COACH.x1 && p.y >= COACH.y0 && p.y <= COACH.y1; }
  var GY = { STATIONS: STATIONS, ORDER: ORDER, STRIPS: STRIPS, KITS: KITS, LENGTHS: LENGTHS, DEFAULT_LEN: DEFAULT_LEN, MIN_LOG_S: MIN_LOG_S, COACH: COACH,
    mono: mono, kitFor: kitFor, strip: strip, frameAt: frameAt, minutesFor: minutesFor, box: box, clipLocal: clipLocal, makeClock: makeClock, inCoach: inCoach };
  root.OvuGym = GY;

  /* ---------- the runner (browser only) ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, LN = root.OvuLane, LS = root.OvuLaneScene, doc = root.document;
  if (!S || !R || !W || !LN || !LS || !doc || !doc.createElement) return;
  var GYM = 'lane-gym', GAP = 2500, URGENT = (root.OvuPulse && root.OvuPulse.BEFORE && root.OvuPulse.BEFORE.urgent) || 'Chest pain, pressure or tightness, unusual breathlessness, collapse or stroke signs: call your local emergency number.';
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reduced() { return !!(R.reduced && R.reduced()); }
  function station(id) { return (LN.STATIONS || []).filter(function (s) { return s.id === id; })[0] || null; } /* its name, line and icon */
  function spot(id) { return (LS.GYMSPOTS || []).filter(function (g) { return g.id === id; })[0] || null; } /* its stand point */
  function inGym() { var L = R.layout(); return !!L && L.id === GYM; }
  function clockText(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function place(id) { var ln = station(id); return ln ? ln.name.toLowerCase() : id; }

  /* the station's sheet: its line, a length, Begin, and the movement log as it always was */
  var lenPick = DEFAULT_LEN;
  function open(id) {
    var st = STATIONS[id], ln = station(id); if (!st || !ln) return false;
    if (run) { reveal(); return true; }
    if (R.refuseBusy && R.refuseBusy()) return true;
    if (R.asleep()) { R.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return true; }
    R.openSheet('gym-' + id, ln.name, 'Tideline Gym · move along with her', ln.icon,
      '<p class="mintro">' + esc(ln.line) + '</p>' +
      '<div class="field"><span class="lbl">How long?</span><div class="chips" id="gymLen">' + LENGTHS.map(function (n) { return '<button type="button" class="chipbtn' + (n === lenPick ? ' on' : '') + '" data-len="' + n + '" aria-pressed="' + (n === lenPick) + '">' + n + ' min</button>'; }).join('') + '</div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="gymBegin"><span class="ms">play_arrow</span>Begin</button><button type="button" class="btn soft" id="gymJustLog"><span class="ms">add</span>Just log movement</button></div>' +
      '<p class="help">Move along with her for real, at your own pace. She changes into her workout clothes, and back into her own after. After a minute or more you can log it in your movement log; nothing is saved unless you do. Stop whenever you like, and stop at once if something hurts or you feel dizzy or unwell.</p>' +
      '<p class="help pulseurgent gymurgent"><span class="ms">emergency</span>' + esc(URGENT) + '</p>');
    $('gymLen').addEventListener('click', function (e) { var b = e.target.closest('[data-len]'); if (!b) return; lenPick = Number(b.dataset.len) || DEFAULT_LEN; Array.prototype.forEach.call(this.querySelectorAll('[data-len]'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); });
    $('gymBegin').addEventListener('click', function () { begin(id, lenPick); });
    $('gymJustLog').addEventListener('click', function () { if (R.openExercise) R.openExercise(st.act); if (R.moment) R.moment('gym', { quiet: true }); });
    return true;
  }

  var run = null, panel = null, pendingAsk = null, askWait = 0;
  function otherOwner() {
    if (R.asleep()) return ['She is asleep. Tap the bed to wake her first.', 'bedtime'];
    var a = R.activityNow && R.activityNow(); if (a && a.kind !== 'gym') return [R.busyLine(a), a.icon, true];
    if (R.sessionOn() || R.practiceOn() || R.meditating()) return ['Finish what you are doing first.', 'info'];
    return null;
  }
  function begin(id, minutes) {
    var st = STATIONS[id], ln = station(id), sp = spot(id); if (!st || !ln || !sp || run) return;
    if (!inGym() || !LN.openNow('gym')) { R.hideSheet(); LN.openPlace('gym'); return; }
    var other = otherOwner(); if (other) { if (!(other[2] && R.refuseBusy && R.refuseBusy())) R.toast(other[0], other[1]); return; }
    minutes = LENGTHS.indexOf(Number(minutes)) > -1 ? Number(minutes) : DEFAULT_LEN;
    R.chime('tap'); dropAsk();
    R.emit('activity', 'gym', id); /* a try-on, a greenhouse minute, a care step: everything else steps aside first */
    if (W.walking && W.walking()) { try { W.stop(); } catch (e) { } }
    try { R.freezeWalk(); } catch (e) { }
    R.cancelIdle(); if (R.endMoment) R.endMoment();
    if (root.OvuPodcast) { try { root.OvuPodcast.pause(); } catch (e) { } }
    R.hideSheet();
    var kit = kitFor(R.savedOutfit ? R.savedOutfit() : 'base'), meta = strip(kit, id);
    run = { id: id, st: st, ln: ln, sp: sp, kit: kit, meta: meta, minutes: minutes, total: minutes * 60000, clock: makeClock(), phase: 'dress', paused: false, el: null, img: null, frame: -1, timer: 0, last: 0, h: 0, day: S.today(), born: born() };
    var r = run;
    R.placeAvatar(sp.wp, !!sp.wp.flip);
    showPanel();
    /* the strip loads while she turns; she steps on once both are done (or after the turn's time, whatever the picture did) */
    var ready = { dressed: false, strip: !meta };
    function go() { if (run !== r || r.phase !== 'dress' || !ready.dressed || !ready.strip) return; mount(r); }
    if (meta) {
      var im = new Image(), got = function (ok) { if (run !== r || ready.strip) return; r.img = ok ? im : null; ready.strip = true; go(); };
      im.onload = function () { if (im.decode) im.decode().then(function () { got(true); }, function () { got(true); }); else got(true); }; /* she is hidden only once the strip can be drawn */
      im.onerror = function () { got(false); }; im.src = R.ART + meta.file;
    }
    R.dressFor(kit, function () { if (run !== r) return; ready.dressed = true; go(); });
    setTimeout(function () { if (run !== r) return; ready.dressed = true; go(); }, reduced() ? 300 : 1600); /* a turn cut short never holds her off the machine */
    setTimeout(function () { if (run !== r || ready.strip) return; r.img = null; ready.strip = true; go(); }, 4000); /* nor a strip that never answers: she works out standing beside it */
  }
  /* she steps onto the machine: her standing picture hides and the strip plays there; without a strip she stays standing
     beside it, visible, in her workout clothes, and the clock still runs */
  function mount(r) {
    r.phase = 'move';
    var L = R.layout(), aw = (L && L.avatarW) || 9, m = r.meta;
    if (m && r.img) {
      var w = aw * m.w / m.standW, h = w * (m.h / m.w) * ((L.w || 1024) / (L.h || 1280)), el = doc.createElement('div');
      el.className = 'nb nosolid gymworker gym-' + r.id + (r.st.flip ? ' flip' : '') + (r.st.anim.kind === 'fade' ? ' gwfade' : '');
      el.dataset.id = 'gymworker'; el.setAttribute('aria-hidden', 'true');
      el.style.left = r.st.on.x + '%'; el.style.top = r.st.on.y + '%'; el.style.width = w.toFixed(2) + '%';
      var cp = clipLocal(r.st.clip, box(r.st.on, w, h)); if (cp) { el.style.clipPath = cp; el.style.webkitClipPath = cp; }
      el.innerHTML = '<div class="gwcell" style="aspect-ratio:' + m.w + '/' + m.h + '"><img class="gwa" alt="" src="' + R.ART + m.file + '" style="width:' + (m.frames * 100) + '%"><img class="gwb" alt="" src="' + R.ART + m.file + '" style="width:' + (m.frames * 100) + '%"></div>';
      R.els.props.appendChild(el); r.el = el; r.h = h;
      R.els.avatar.classList.add('hidden'); R.els.scene.classList.add('gymming'); r.hid = true;
      if (W.sortDepth) W.sortDepth();
    }
    r.last = mono();
    if (doc.hidden) { r.paused = true; r.away = true; if (r.el) r.el.classList.add('paused'); } /* locked while she changed: she waits on the machine, nothing counted (Codex diff review, 22 Oct) */
    else r.clock.run();
    paint(true); paintPanel();
    clearInterval(r.timer); r.timer = setInterval(tick, 100);
  }
  /* off the machine: the strip goes; she is shown again and stands at its stand point only while the gym still owns her (a
     new scene has already placed her there, bedtime and the mat hide her themselves: Codex design review, 22 Oct) */
  function unmount(r) {
    if (r.el && r.el.parentNode) r.el.remove(); r.el = null;
    R.els.scene.classList.remove('gymming');
    var owned = R.meditating() || R.els.scene.classList.contains('is-night'); /* the mat or this tab's night shows her its own way */
    if (r.hid && !owned) R.els.avatar.classList.remove('hidden'); /* a new scene, or bedtime in another tab, does not show her by itself (Codex diff review, 22 Oct) */
    r.hid = false;
    if (!owned && inGym() && !R.asleep()) R.placeAvatar(r.sp.wp, !!r.sp.wp.flip); /* in a new scene she is already where it put her */
  }
  function showFrame(img, f, n) { if (img) img.style.transform = 'translate3d(-' + (f * 100 / n).toFixed(3) + '%,0,0)'; }
  /* the frame for the active time so far: a loop steps; a fade holds each frame and cross-fades to the next */
  function paint(force) {
    var r = run; if (!r || !r.el || !r.meta) return;
    var n = r.meta.frames, f = reduced() ? r.st.still || 0 : frameAt(r.st.anim, n, r.clock.ms(), false);
    if (f === r.frame && !force) return;
    var a = r.el.querySelector('.gwa'), b = r.el.querySelector('.gwb');
    if (r.st.anim.kind === 'fade' && !reduced() && r.frame >= 0) {
      showFrame(b, r.frame, n); b.style.transition = 'none'; b.style.opacity = '1';
      showFrame(a, f, n); a.style.transition = 'none'; a.style.opacity = '0'; void a.offsetWidth;
      a.style.transition = 'opacity ' + r.st.anim.fade + 'ms ease'; a.style.opacity = '1'; b.style.transition = 'opacity ' + r.st.anim.fade + 'ms ease'; b.style.opacity = '0';
    } else { showFrame(a, f, n); a.style.opacity = '1'; if (b) b.style.opacity = '0'; }
    r.frame = f;
  }
  function tick() {
    var r = run; if (!r || r.phase !== 'move') return;
    var now = mono();
    if (doc.hidden || now - r.last > GAP) { if (!r.paused) { pause(r.last); r.away = true; paintPanel(); } r.last = now; return; } /* hidden, or a page that froze: the clock stops where it was last seen running */
    r.last = now;
    if (r.paused) return;
    if (r.clock.ms() >= r.total) { finish(true); return; }
    paint(false); paintClock();
  }

  /* the panel: the seats panel's shape, its own ids; the clock sits outside the spoken status */
  function ensurePanel() {
    if (panel) return panel;
    panel = doc.createElement('section'); panel.className = 'mpanel seatpanel gympanel'; panel.id = 'gpanel'; panel.hidden = true; panel.tabIndex = -1; panel.setAttribute('aria-labelledby', 'gpTitle');
    panel.innerHTML = '<p class="mp-count"><span id="gpWhat"></span> · <span id="gpClock" aria-hidden="true"></span></p><div class="mp-say" aria-live="polite" aria-atomic="true"><h3 id="gpTitle"></h3><p id="gpText"></p></div>' +
      '<div class="mp-btns"><button type="button" class="btn primary" id="gpPause">Pause</button><button type="button" class="btn ghost" id="gpStop">Stop</button></div>';
    var mp = $('mpanel'); if (mp && mp.parentNode) mp.parentNode.insertBefore(panel, mp.nextSibling); else doc.body.appendChild(panel);
    $('gpPause').addEventListener('click', pauseToggle); $('gpStop').addEventListener('click', stop);
    return panel;
  }
  function showPanel() { ensurePanel(); panel.hidden = false; paintPanel(); try { panel.focus({ preventScroll: true }); } catch (e) { } }
  function hidePanel() { if (panel) panel.hidden = true; }
  function reveal() { if (run) showPanel(); }
  function activeMs(r) { return Math.min(r.total, r.clock.ms()); } /* never past the length she chose */
  function paintClock() { var r = run, c = $('gpClock'); if (!r || !c) return; c.textContent = clockText(activeMs(r)) + ' of ' + r.minutes + ' min'; }
  function paintPanel() {
    var r = run; if (!r || !panel) return;
    $('gpWhat').textContent = r.ln.name + (r.paused ? ' · paused' : '');
    $('gpTitle').textContent = r.st.title;
    $('gpText').textContent = r.phase === 'dress' ? 'Changing into her workout clothes.' : r.paused ? (r.away ? 'Paused while the app was away; that time is not counted. Resume when you are ready, or stop here.' : 'Paused. Resume when you are ready, or stop here.') : r.ln.line;
    var p = $('gpPause'); p.textContent = r.paused ? 'Resume' : 'Pause'; p.disabled = r.phase !== 'move';
    paintClock();
  }
  /* every stop of the clock goes through here: a Pause tap or a hidden page delivered after the page froze ends at the last
     moment it was seen running, never later (Codex diff review, 22 Oct) */
  function holdClock(r, at) { var now = mono(); r.clock.hold(typeof at === 'number' ? at : now - r.last > GAP ? r.last : now); }
  function pause(at) {
    var r = run; if (!r || r.phase !== 'move' || r.paused) return;
    r.paused = true; holdClock(r, at);
    if (r.el) { /* a cross-fade stops where it is: the current frame, fully drawn */
      r.el.classList.add('paused'); var a = r.el.querySelector('.gwa'), b = r.el.querySelector('.gwb');
      if (a) { a.style.transition = 'none'; a.style.opacity = '1'; } if (b) { b.style.transition = 'none'; b.style.opacity = '0'; }
    }
    paintPanel();
  }
  function resume() { var r = run; if (!r || r.phase !== 'move' || !r.paused) return; r.paused = false; r.away = false; r.last = mono(); r.clock.run(); r.el && r.el.classList.remove('paused'); paintPanel(); }
  function pauseToggle() { var r = run; if (!r) return; R.chime('tap'); if (r.paused) resume(); else pause(); }
  function stop() { if (run) { R.chime('tap'); finish(false); } }

  /* the planned length, or Stop: off the machine, back into her own clothes, and the movement log filled in, after a minute */
  function finish(done, quiet) {
    var r = run; if (!r) return;
    clearInterval(r.timer); if (!r.paused && r.phase === 'move') holdClock(r);
    var mins = minutesFor(activeMs(r)), name = place(r.id);
    run = null; hidePanel(); unmount(r);
    R.undress(!!quiet || R.asleep());
    if (R.asleep()) return;
    if (!mins) { R.toast(r.phase === 'dress' ? 'Stopped before starting. That is fine.' : 'Stopped. Nothing under a minute is recorded.', 'fitness_center'); return; }
    var intro = (done ? 'That is ' + mins + ' minute' + (mins > 1 ? 's' : '') + ' on the ' + name + '.' : 'About ' + mins + ' minute' + (mins > 1 ? 's' : '') + ' on the ' + name + '.') + ' Save it if you really moved too.';
    /* the offer waits for her turn back, and for any other sheet to close; anything else starting, bedtime, leaving the gym or
       the account changing drops it (Codex design review, 22 Oct) */
    dropAsk();
    var tok = pendingAsk = { act: r.st.act, mins: mins, born: r.born };
    function ask() {
      if (pendingAsk !== tok) return;
      if (R.asleep() || !inGym() || (R.activityNow && R.activityNow()) || !R.openExercise) { dropAsk(); return; }
      if (R.sheetOpen()) return; /* never over another sheet: asked again when it closes */
      dropAsk(); R.openExercise(r.st.act, { minutes: mins, intro: intro, date: r.day, strengthTick: false });
    }
    if (R.sheetOpen()) R.toast('Well done. Your movement log opens when you close this.', 'fitness_center');
    askTimer = setTimeout(function () { ask(); if (pendingAsk === tok) askWait = setInterval(ask, 400); }, quiet || reduced() ? 0 : 1100);
  }
  var askTimer = 0;
  function dropAsk() { clearTimeout(askTimer); clearInterval(askWait); askTimer = 0; askWait = 0; pendingAsk = null; }
  /* leaving the gym, bedtime, clearing or importing data, another activity: it ends at once, her own clothes back, nothing asked */
  function cancel() {
    dropAsk();
    var r = run; if (!r) { R.undress(true); return; }
    run = null; clearInterval(r.timer); hidePanel(); unmount(r);
    R.undress(true);
  }

  GY.open = open; GY.begin = begin; GY.stop = stop; GY.cancel = cancel; GY.pause = pause; GY.resume = resume; GY.reveal = reveal;
  GY.active = function () { return !!run; }; GY.pendingAsk = function () { return !!pendingAsk; };
  GY.state = function () { return run ? { id: run.id, kit: run.kit, title: run.st.title, phase: run.phase, paused: run.paused, away: !!run.away, minutes: run.minutes, ms: run.clock.ms(), frame: run.frame, mounted: !!run.el } : null; };
  /* the camera follows what you see: the middle of her on the machine, while her standing picture is hidden */
  GY.focus = function () { var r = run; return r && r.el && r.h ? { x: r.st.on.x, y: r.st.on.y - r.h / 2 } : null; };
  /* when the diary was begun: Delete everything or a restore that replaces it, here or in another tab, gives a new one */
  function born() { return S.born ? S.born() : null; }
  R.on('boot', function () {
    R.on('activity', function (kind, id) { if (kind === 'gym' && run && id === run.id) return; if (run) cancel(); else dropAsk(); });
    R.on('layout', function (L) { if ((run || pendingAsk) && (!L || L.id !== GYM)) cancel(); });
    R.on('beforeWalk', function () { if (run) finish(false, true); }); /* walks are refused while she works out; this is the safety net */
    R.on('meditate', function () { if (run) finish(false, true); }); /* the Mind tab seats her on the mat: off the machine first, the log offered once its sheet closes */
    R.on('props', function () { if (run && run.el && !run.el.isConnected && inGym()) { R.els.props.appendChild(run.el); if (W.sortDepth) W.sortDepth(); } }); /* a props rebuild (a game-save pull, a sky change) keeps her on the machine, clock and frame as they were */
    S.subscribe(function (reason) {
      if (!run && !pendingAsk) return;
      var now = born(), was = run ? run.born : pendingAsk.born;
      if (reason === 'clear' || reason === 'import' || (now && was && now !== was) || (S.state() && S.state().sleeping)) cancel(); /* another tab's reset or restore arrives as 'external' (Codex diff review, 22 Oct) */
    });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden && run && run.phase === 'move' && !run.paused) { pause(); run.away = true; paintPanel(); } }); /* away: the clock holds; she comes back to Resume or Stop */
  });
})(typeof window !== 'undefined' ? window : this);
