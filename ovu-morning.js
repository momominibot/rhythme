/* Morning start (Jamie, 20 Oct 2026: "a simple and accessible morning routine. Upon waking up, a short breath and body
 * awareness + brushing teeth"). How it is offered and shown was agreed with a Codex review (docs/research/2026-10-20-morning-start.md):
 * - offered, never started for her: one invitation in Today from 04:00 to 11:59 by the real clock, which she can put away
 *   for the day, and always from Everyday and the mat while she is awake. Saving a night never starts it.
 * - two short captioned steps (arrive, notice) with no breath counts, no pacing and no breathing animation, then brushing
 *   once she says she is at the sink, either her own way or with Erin's own morning brushing guide, kept whole.
 * - DeepSeek and Doubao reviewed the copy once Ark was back (20 Oct, same doc): the greeting follows the clock (Good morning
 *   only in the morning window), dizziness on waking, no need to change the breath, touch as an anchor for low vision,
 *   any sink and time for prayer first. Rhythme's lines are read in Erin's voice (as her other interim lines are, with her
 *   consent) and the captions match the clips word for word; Quiet keeps it captions only.
 * - she stays where she is, in her own outfit; Pause, Next, Stop and Quiet are always there; sleep cancels it at once.
 * - one honest entry, saved only if she says she did it and practised 30 seconds or more, earning the same small
 *   practice thank-you as anything else on the mat.
 * The data and rules come first and are pure (tools/test-core.js checks them); the panel follows. */
(function (root) {
  'use strict';
  var GUIDE = 'assets/audio/guide-interim/';
  var START_HOUR = 4, END_HOUR = 12, MIN_SAVE_S = 30;
  var STEPS = {
    /* the greeting comes from GREETINGS by the clock; clips are 23 s (Good morning) and 27 s (Hello), so 35 s leaves a quiet moment */
    arrive: { key: 'arrive', part: 1, title: 'Arrive', secs: 35,
      text: 'Sit, lie down or stand, whatever is easiest. If you feel dizzy, stay sitting or lying. Your eyes can be open or closed. There is no need to change your breathing. If you like, notice it as it is, or a sound, a colour, or something you can touch.' },
    notice: { key: 'notice', part: 2, title: 'Notice', secs: 55, audio: GUIDE + 'mstart-notice.mp3', /* a 21 s clip, then quiet */
      text: 'You don’t need to move. If you like, notice where your body is resting, on the bed, the floor or a chair. There is nothing you need to change. If this doesn’t feel right, choose a sound or a colour instead, or stop at any time.' },
    ready: { key: 'ready', part: 3, title: 'Brushing', gate: true, audio: GUIDE + 'mstart-ready.mp3',
      text: 'Go to wherever you brush, whenever you are ready. Take any time you need first, for prayer or anything else. Getting there is not part of the practice.' },
    yourway: { key: 'yourway', part: 3, title: 'Brush your way', open: true, pose: 'teeth', audio: GUIDE + 'mstart-yourway.mp3',
      text: 'Brush as you usually do. If you like, notice one sensation, a taste or a sound. Tap Done when you finish.' }
  };
  var GREETINGS = ['Good morning.', 'Hello.']; /* clip mstart-arrive-0 says the first, mstart-arrive-1 the second, mstart-arrive-2 neither */
  var VERSIONS = {
    yourway: { id: 'yourway', name: 'A short pause, then brush your way', sub: '90 seconds of gentle noticing, then brushing at your own pace' },
    erin: { id: 'erin', name: 'With Erin’s brushing guide', sub: 'About 5 minutes, with Erin’s own morning script in her voice' }
  };

  /* the morning window, read from the real clock at the moment of asking */
  function inWindow(d) { var h = (d || new Date()).getHours(); return h >= START_HOUR && h < END_HOUR; }
  /* Erin's own morning brushing script, whole and in her order, with her recorded clips */
  function erinSteps() {
    var MF = root.OvuMindful, a = MF && MF.byId('teeth'); if (!a) return [];
    var vi = -1; a.variations.forEach(function (v, i) { if (vi < 0 && v.when === 'morning' && v.author === 'erin') vi = i; });
    if (vi < 0) return [];
    return a.variations[vi].steps.map(function (s, si) {
      return { key: 'erin' + si, part: 3, title: 'Brushing with Erin', secs: s.secs, text: s.text, pose: 'teeth', audio: GUIDE + 'teeth-' + vi + '-' + si + '.mp3', erin: true };
    });
  }
  /* Arrive says Good morning only inside the morning window (she can open it from Everyday at any hour), with the matching
   * clip, decided once when she begins. With Erin's guide it has no greeting: Erin greets her at the sink in her own words,
   * so she never hears Hello and then Good morning, or Good morning twice (Codex follow-up check, 20 Oct). */
  function arriveFor(d, version) {
    var win = root.OvuMorning && root.OvuMorning.inWindow || inWindow, g = version === 'erin' ? 2 : win(d || new Date()) ? 0 : 1, a = {};
    for (var k in STEPS.arrive) a[k] = STEPS.arrive[k];
    a.text = (g < 2 ? GREETINGS[g] + ' ' : '') + STEPS.arrive.text; a.audio = GUIDE + 'mstart-arrive-' + g + '.mp3';
    return a;
  }
  function plan(version, d) { return [arriveFor(d, version), STEPS.notice, STEPS.ready].concat(version === 'erin' ? erinSteps() : [STEPS.yourway]); }
  /* is the invitation in Today for this moment? never while asleep, only in the window, not once done or put away today */
  function offered(state, today, d) {
    state = state || {};
    if (state.sleeping) return false;
    var win = root.OvuMorning && root.OvuMorning.inWindow || inWindow; if (!win(d)) return false;
    var m = state.morningStart; return !(m && m.date === today && (m.done || m.dismissed));
  }
  /* practice time: only while a step is running, never while paused or walking to the sink */
  function makeClock(now) {
    now = now || function () { return Date.now(); };
    var ms = 0, since = null;
    return {
      run: function () { if (since === null) since = now(); },
      hold: function () { if (since !== null) { ms += now() - since; since = null; } },
      ms: function () { return ms + (since === null ? 0 : now() - since); },
      seconds: function () { return Math.round((ms + (since === null ? 0 : now() - since)) / 1000); },
      running: function () { return since !== null; }
    };
  }
  /* the one entry a confirmed morning start saves, or null under 30 seconds */
  function entryData(o) {
    var raw = Math.max(0, Number(o.seconds) || 0), secs = Math.round(raw);
    if (raw < MIN_SAVE_S || !o.confirmed) return null; /* eligibility on the unrounded time: 29.5 s is not 30 */
    return {
      kind: 'informal', activity: 'morning', activityName: 'Morning start', version: o.version === 'erin' ? 'erin' : 'yourway',
      seconds: secs, minutes: Math.round(secs / 6) / 10, skipped: (o.skipped || []).slice(), brushed: o.brushed || 'no',
      finished: !!o.finished, completed: !!o.finished, confirmedReal: true,
      guide: o.version === 'erin' ? 'Opening words by Rhythme in Erin’s voice; brushing guide in Erin Lee’s own words' : 'Words by Rhythme, read in Erin’s voice'
    };
  }

  /* ---------- the panel and the flow (browser only) ---------- */
  var run = null, ticker = null;
  function $(s) { return document.querySelector(s); }
  function R() { return root.OvuRoom; }
  function S() { return root.OvuStore; }
  function active() { return !!run; }
  function quietDefault() { return !(S().state() || {}).sound; }
  function markToday(patch) { var st = S().state(), m = st.morningStart && st.morningStart.date === S().today() ? st.morningStart : { date: S().today() }; for (var k in patch) m[k] = patch[k]; S().setState({ morningStart: m }); }

  function renderInvite() {
    var el = $('#morningInvite'); if (!el || !S()) return;
    var show = offered(S().state(), S().today(), new Date()) && !run;
    el.hidden = !show; if (!show) { el.innerHTML = ''; el.dataset.on = ''; return; }
    if (el.dataset.on === '1') return;
    el.dataset.on = '1';
    el.innerHTML = '<span class="ms" aria-hidden="true">wb_twilight</span><div><b>Morning start</b><small>A short pause, then brushing your way. Sitting or lying is fine.</small></div>' +
      '<div class="minvite-btns"><button type="button" class="btn primary" id="miBegin">Begin</button><button type="button" class="btn ghost" id="miLater">Not today</button></div>';
    $('#miBegin').addEventListener('click', function () { open(); });
    $('#miLater').addEventListener('click', function () { markToday({ dismissed: true }); el.dataset.on = ''; renderInvite(); R().toast('Put away for today. Morning start is always in Everyday, and on the meditation mat.', 'wb_twilight'); });
  }
  function hideInvite() { var el = $('#morningInvite'); if (el) { el.hidden = true; el.dataset.on = ''; el.innerHTML = ''; } }

  function open() {
    var room = R(); if (!room) return;
    if (room.asleep()) { room.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; }
    if (run) { showPanel(); return; }
    var quiet = quietDefault(), esc = room.esc;
    room.openSheet('morning', 'Morning start', 'A gentle way into the day', 'wb_twilight',
      '<p class="mintro">About 90 seconds of gentle noticing, then brushing your teeth. Any position is fine, eyes open or closed, and you can stop at any time.</p>' +
      '<fieldset class="mchoice"><legend>How would you like it?</legend>' +
      ['yourway', 'erin'].map(function (k, i) { var v = VERSIONS[k]; return '<label class="mopt"><input type="radio" name="mver" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(v.name) + '</b><small>' + esc(v.sub) + '</small></span></label>'; }).join('') +
      '</fieldset>' +
      '<label class="mquiet"><input type="checkbox" id="mQuiet"' + (quiet ? ' checked' : '') + '><span>Quiet: captions only, no voice and no bells</span></label>' +
      '<div class="row"><button type="button" class="btn primary" id="mBegin"><span class="ms" aria-hidden="true">play_arrow</span>Begin</button></div>' +
      '<p class="help">Read in Erin’s voice: the opening words are Rhythme’s, the brushing guide is Erin’s own. Saved only if you say you did it, with the same small thank-you as any practice, never a streak.</p>');
    $('#mBegin').addEventListener('click', function () {
      var ver = (document.querySelector('input[name=mver]:checked') || {}).value || 'yourway';
      begin(ver, $('#mQuiet').checked);
    });
  }

  function begin(version, quiet) {
    var room = R(); if (room.asleep() || run) return;
    if ((room.sessionOn && room.sessionOn()) || (room.practiceOn && room.practiceOn())) { room.toast('Finish or stop the practice that is running first.', 'self_improvement'); return; }
    if (root.OvuGreenhouse && root.OvuGreenhouse.caring && root.OvuGreenhouse.caring()) { room.toast('Finish the minute with the plant first.', 'potted_plant'); return; } /* the greenhouse minute owns the HUD and saves its own entry */
    if (root.OvuPodcast) { try { root.OvuPodcast.pause(); } catch (e) { } }
    if (root.OvuWalk && root.OvuWalk.walking && root.OvuWalk.walking()) { try { root.OvuWalk.stop(); } catch (e) { } } /* a walk in progress stops where she is */
    if (room.freezeWalk) { try { room.freezeWalk(); } catch (e) { } } /* and so does the room's own fallback walk */
    room.hideSheet(); hideInvite();
    run = { version: version, steps: plan(version), i: -1, quiet: !!quiet, reached: {}, paused: false, timer: null, left: 0, t0: 0, clock: makeClock(), skipped: [], brushed: 'no', audio: typeof Audio !== 'undefined' ? new Audio() : null, done: false }; /* made inside the Begin tap, so later clips may play on phones */
    if (room.endMoment) room.endMoment();
    /* from the mat she sits there hidden: bring her back first, or the routine plays to an empty room */
    if (room.els && room.els.meditator && room.els.meditator.classList.contains('on') && !(room.sessionOn && room.sessionOn())) room.exitMeditation();
    if (room.restorePose) room.restorePose();
    if (room.els && room.els.avatar) room.els.avatar.classList.remove('acting');
    showPanel(); next(); if (run && run.quiet) unlock(); /* a quiet start still readies the voice, inside this tap */
    var pnl = $('#mpanel'); if (pnl) { pnl.setAttribute('tabindex', '-1'); pnl.focus(); } /* focus leaves the closed sheet for the panel */
    clearInterval(ticker); ticker = setInterval(function () { if (run && room.asleep()) cancel(); }, 1000);
  }
  function showPanel() { var p = $('#mpanel'); if (p) p.hidden = false; }
  function hidePanel() { var p = $('#mpanel'); if (p) p.hidden = true; }
  function bell() { if (run && !run.quiet && (S().state() || {}).sound) R().chime('bell'); }
  function step() { return run && run.steps[run.i]; }

  function next(skippedNow) {
    if (!run) return;
    if (R().asleep()) { cancel(); return; }
    var cur = step(); if (cur && skippedNow && run.skipped.indexOf(cur.key) < 0 && !cur.erin) run.skipped.push(cur.key);
    clearTimeout(run.timer); stopAudio();
    run.i++;
    var s = step(); if (!s) { finish(true); return; }
    run.reached[s.key] = true; /* what she actually reached, for the honest summary at the end */
    if (run.i > 0) bell();
    var room = R();
    if (s.pose) room.setPose(s.pose); else if (room.restorePose) room.restorePose();
    if (room.els && room.els.avatar) room.els.avatar.classList.remove('acting'); /* no pulse: it would read as a breathing pace */
    if (s.gate) { run.paused = false; run.clock.hold(); } else if (!run.paused) run.clock.run(); /* the sink has no Pause, so it is never left paused */
    if (s.key === 'yourway' || s.erin) run.brushed = s.erin ? 'erin' : 'yourway';
    paint();
    run.left = s.secs ? s.secs * 1000 : 0; run.pending = null;
    if (s.secs && !run.paused) arm(); /* a paused routine keeps the new step's full time for Resume */
    if (s.audio && !run.quiet) { if (run.paused) run.pending = s.audio; else playAudio(s.audio); }
  }
  function arm() { clearTimeout(run.timer); run.t0 = Date.now(); run.timer = setTimeout(function () { next(false); }, run.left); }
  function playAudio(url) {
    run.audioKey = step() && step().key; var r = run;
    try {
      var a = run.audio || (run.audio = new Audio()); a.muted = false; a.src = url; a.currentTime = 0; var p = a.play();
      if (p && p.catch) p.catch(function (e) { if (e && e.name === 'NotAllowedError') held(r); });
    } catch (e) { }
  }
  /* the phone refused to play: say so and show Voice off, rather than a silent Voice on; tapping Voice on readies it */
  function held(r) { if (!run || run !== r || run.quiet) return; run.quiet = true; run.audioKey = null; run.pending = null; run.unlocked = false; paint(); R().toast('Your phone held the voice back. Tap Voice on to hear it from the next line.', 'volume_off'); }
  /* inside a tap (Begin while quiet, or Voice on): play a clip muted for a moment so later lines may play on phones that
   * only allow sound that a tap started; it never sounds, and a real line that starts meanwhile is left alone */
  function unlock() {
    if (!run || !run.audio || run.unlocked) return;
    var a = run.audio, s = step(), src = (s && s.audio) || (run.steps.filter(function (x) { return x.audio; })[0] || {}).audio; if (!src) return;
    run.unlocked = true;
    try {
      a.muted = true; a.src = src; var p = a.play(), r = run;
      var undo = function () { if (run === r && !run.audioKey) { try { a.pause(); } catch (e) { } } a.muted = false; };
      if (p && p.then) p.then(undo, function () { a.muted = false; if (run === r) run.unlocked = false; }); else undo();
    } catch (e) { a.muted = false; }
  }
  function stopAudio() { if (run && run.audio) { try { run.audio.pause(); } catch (e) { } } }
  function pauseToggle() {
    if (!run) return; var s = step(); if (!s || s.gate) return;
    if (!run.paused) {
      run.paused = true; run.clock.hold();
      if (s.secs) { clearTimeout(run.timer); run.left = Math.max(0, run.left - (Date.now() - run.t0)); }
      stopAudio();
    } else {
      run.paused = false; run.clock.run();
      if (s.secs) arm();
      if (run.pending) { playAudio(run.pending); run.pending = null; }
      else if (s.audio && !run.quiet && run.audio && run.audioKey === s.key && !run.audio.ended) { /* a finished line is not said again */ /* only this step's own clip resumes; a muted or older clip never does */ try { var p = run.audio.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
    }
    paint();
  }
  function quietToggle() {
    if (!run) return; run.quiet = !run.quiet;
    if (run.quiet) { stopAudio(); run.pending = null; run.audioKey = null; } /* on again: the voice speaks from the next line, so no line is cut short */
    else unlock(); /* this tap readies the voice for that next line */
    paint();
  }
  function ready() { if (!run) return; run.paused = false; next(false); }
  function skipBrushing() { if (!run) return; run.skipped.push('brushing'); run.brushed = 'no'; clearTimeout(run.timer); stopAudio(); finish(true); }
  function stop() { if (!run) return; finish(false); }
  /* sleep, or anything that ends the room's day: everything stops at once and nothing is offered */
  function cancel() {
    if (!run) return; clearTimeout(run.timer); stopAudio(); clearInterval(ticker);
    run = null; hidePanel(); var room = R(); if (room.restorePose && !room.asleep()) room.restorePose();
  }
  function finish(finished) {
    var r = run; if (!r) return;
    if (R().asleep()) { cancel(); return; } /* asleep: nothing to confirm */
    clearTimeout(r.timer); stopAudio(); r.clock.hold(); clearInterval(ticker);
    var exact = r.clock.ms() / 1000, secs = Math.round(exact), room = R();
    run = null; hidePanel(); if (room.restorePose) room.restorePose();
    if (exact < MIN_SAVE_S) { room.toast('Stopped. Pauses under 30 seconds are not saved.', 'wb_twilight'); renderInvite(); return; }
    var did = [];
    if (r.reached.arrive && r.skipped.indexOf('arrive') < 0) did.push('arrived'); if (r.reached.notice && r.skipped.indexOf('notice') < 0) did.push('noticed'); if (r.brushed !== 'no') did.push('brushed'); /* only steps she reached */
    var saved = false;
    room.openSheet('morningDone', finished ? 'Morning start' : 'Stopping early', 'About ' + Math.max(1, Math.round(secs / 60)) + ' minute' + (secs >= 90 ? 's' : '') + ' of practice', 'wb_twilight',
      '<p class="mintro">' + (did.length ? 'You ' + (did.length > 1 ? did.slice(0, -1).join(', ') + ' and ' + did[did.length - 1] : did[0]) + '.' : 'You paused for a moment.') + ' Save this pause to your journal?</p>' +
      '<div class="row"><button type="button" class="btn primary" id="mdYes"><span class="ms" aria-hidden="true">check</span>Yes, I did it</button><button type="button" class="btn ghost" id="mdNo">Not this time</button></div>' +
      '<p class="help">Save it if you really did it. A mind that wandered and came back still counts.</p>');
    $('#mdYes').addEventListener('click', function () {
      if (saved) return; saved = true;
      if (room.asleep()) { room.closeSheet(); return; }
      var data = entryData({ seconds: exact, confirmed: true, version: r.version, skipped: r.skipped, brushed: r.brushed, finished: finished });
      room.closeSheet();
      if (!data) return;
      var ev = S().add('mindfulness', S().today(), data);
      markToday({ done: true }); hideInvite();
      room.afterSave(ev, 'Saved to your journal.');
    });
    $('#mdNo').addEventListener('click', function () { room.closeSheet(); room.toast('No worries. Morning start is there whenever you like.', 'wb_twilight'); renderInvite(); });
  }

  function paint() {
    var s = step(); if (!s || !run) return;
    var parts = 3;
    $('#mpCount').textContent = 'Step ' + s.part + ' of ' + parts + (run.paused ? ' · paused' : '');
    $('#mpTitle').textContent = s.title;
    $('#mpText').textContent = s.text;
    var b = '';
    if (s.gate) b = '<button type="button" class="btn primary" id="mpReady">Ready to brush</button><button type="button" class="btn ghost" id="mpSkipBrush">Skip brushing</button>';
    else if (s.open) b = '<button type="button" class="btn primary" id="mpDone">Done</button><button type="button" class="btn ghost" id="mpPause">' + (run.paused ? 'Resume' : 'Pause') + '</button>';
    else b = '<button type="button" class="btn ghost" id="mpPause">' + (run.paused ? 'Resume' : 'Pause') + '</button><button type="button" class="btn ghost" id="mpNext">Next</button>';
    if (s.audio) b += '<button type="button" class="btn ghost" id="mpQuiet" aria-pressed="' + (run.quiet ? 'true' : 'false') + '">' + (run.quiet ? 'Voice off' : 'Voice on') + '</button>';
    b += '<button type="button" class="btn ghost" id="mpStop">Stop</button>';
    var row = $('#mpBtns'), pnl = $('#mpanel'), ae = document.activeElement, focusId = ae && ae.id, inPanel = !!(ae && pnl && (pnl.contains(ae) || ae === document.body));
    row.innerHTML = b;
    var bind = function (id, f) { var el = document.getElementById(id); if (el) el.addEventListener('click', f); };
    bind('mpReady', ready); bind('mpSkipBrush', skipBrushing); bind('mpDone', function () { finish(true); }); bind('mpPause', pauseToggle); bind('mpNext', function () { next(true); }); bind('mpQuiet', quietToggle); bind('mpStop', stop);
    var keep = focusId && document.getElementById(focusId);
    if (keep && row.contains(keep)) keep.focus(); /* keyboard focus stays where she was */
    else if (inPanel && focusId !== 'mpanel') { var first = row.querySelector('button'); if (first) first.focus(); } /* or moves to the first control, never lost */
  }

  root.OvuMorning = {
    START_HOUR: START_HOUR, END_HOUR: END_HOUR, MIN_SAVE_S: MIN_SAVE_S, STEPS: STEPS, VERSIONS: VERSIONS,
    inWindow: inWindow, GREETINGS: GREETINGS, arriveFor: arriveFor, plan: plan, erinSteps: erinSteps, offered: offered, makeClock: makeClock, entryData: entryData,
    open: open, begin: begin, active: active, cancel: cancel, renderInvite: renderInvite,
    state: function () { return run ? { version: run.version, i: run.i, key: step() && step().key, paused: run.paused, left: run.left, audioKey: run.audioKey || null, pending: run.pending || null, quiet: run.quiet, seconds: run.clock.seconds(), skipped: run.skipped.slice(), brushed: run.brushed } : null; }
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () { setInterval(function () { if (!run) renderInvite(); }, 60000); });
  }
})(typeof window !== 'undefined' ? window : this);
