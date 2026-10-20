/* Morning start (Jamie, 20 Oct 2026: "a simple and accessible morning routine. Upon waking up, a short breath and body
 * awareness + brushing teeth"). How it is offered and shown was agreed with a Codex review (docs/research/2026-10-20-morning-start.md):
 * - offered, never started for her: one invitation in Today from 04:00 to 11:59 by the real clock, which she can put away
 *   for the day, and always from Everyday and the mat while she is awake. Saving a night never starts it.
 * - two quiet captioned steps (arrive, notice) with no breath counts, no pacing and no breathing animation, then brushing
 *   once she says she is at the sink, either her own way or with Erin's own morning brushing guide, kept whole.
 * - she stays where she is, in her own outfit; Pause, Next, Stop and Quiet are always there; sleep cancels it at once.
 * - one honest entry, saved only if she says she did it and practised 30 seconds or more, earning the same small
 *   practice thank-you as anything else on the mat.
 * The data and rules come first and are pure (tools/test-core.js checks them); the panel follows. */
(function (root) {
  'use strict';
  var GUIDE = 'assets/audio/guide-interim/';
  var START_HOUR = 4, END_HOUR = 12, MIN_SAVE_S = 30;
  var STEPS = {
    arrive: { key: 'arrive', part: 1, title: 'Arrive', secs: 30,
      text: 'Good morning. Stay in any position that works for you, sitting, lying or standing. Eyes open is welcome. Notice your breathing as it is, or a sound or a colour nearby.' },
    notice: { key: 'notice', part: 2, title: 'Notice', secs: 60,
      text: 'If it feels comfortable, notice where your body is supported, by the bed, the floor or a chair. There is nothing to fix. You can choose another anchor, or stop at any time.' },
    ready: { key: 'ready', part: 3, title: 'Brushing', gate: true,
      text: 'Go to the sink whenever you are ready. Getting there is not part of the practice.' },
    yourway: { key: 'yourway', part: 3, title: 'Brush your way', open: true, pose: 'teeth',
      text: 'Brush as you usually do. If you like, notice one sensation, a taste or a sound. Tap Done when you finish.' }
  };
  var VERSIONS = {
    yourway: { id: 'yourway', name: 'A short pause, then brush your way', sub: '90 seconds of quiet noticing, then brushing at your own pace' },
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
  function plan(version) { return [STEPS.arrive, STEPS.notice, STEPS.ready].concat(version === 'erin' ? erinSteps() : [STEPS.yourway]); }
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
      guide: o.version === 'erin' ? 'Captions by Rhythme; brushing guide in Erin Lee’s own words' : 'Captions by Rhythme'
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
    $('#miLater').addEventListener('click', function () { markToday({ dismissed: true }); el.dataset.on = ''; renderInvite(); R().toast('Put away for today. Morning start is always in Everyday on the mat.', 'wb_twilight'); });
  }
  function hideInvite() { var el = $('#morningInvite'); if (el) { el.hidden = true; el.dataset.on = ''; el.innerHTML = ''; } }

  function open() {
    var room = R(); if (!room) return;
    if (room.asleep()) { room.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; }
    if (run) { showPanel(); return; }
    var quiet = quietDefault(), esc = room.esc;
    room.openSheet('morning', 'Morning start', 'A gentle way into the day', 'wb_twilight',
      '<p class="mintro">About 90 seconds of quiet noticing, then brushing your teeth. Sitting or lying is fine, eyes open is fine, and you can stop at any time.</p>' +
      '<fieldset class="mchoice"><legend>How would you like it?</legend>' +
      ['yourway', 'erin'].map(function (k, i) { var v = VERSIONS[k]; return '<label class="mopt"><input type="radio" name="mver" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(v.name) + '</b><small>' + esc(v.sub) + '</small></span></label>'; }).join('') +
      '</fieldset>' +
      '<label class="mquiet"><input type="checkbox" id="mQuiet"' + (quiet ? ' checked' : '') + '><span>Quiet: captions only, no voice and no bells</span></label>' +
      '<div class="row"><button type="button" class="btn primary" id="mBegin"><span class="ms" aria-hidden="true">play_arrow</span>Begin</button></div>' +
      '<p class="help">Saved only if you say you did it. It earns the same small thank-you as any practice, never a streak.</p>');
    $('#mBegin').addEventListener('click', function () {
      var ver = (document.querySelector('input[name=mver]:checked') || {}).value || 'yourway';
      begin(ver, $('#mQuiet').checked);
    });
  }

  function begin(version, quiet) {
    var room = R(); if (room.asleep() || run) return;
    if ((room.sessionOn && room.sessionOn()) || (room.practiceOn && room.practiceOn())) { room.toast('Finish or stop the practice that is running first.', 'self_improvement'); return; }
    if (root.OvuPodcast) { try { root.OvuPodcast.pause(); } catch (e) { } }
    if (root.OvuWalk && root.OvuWalk.walking && root.OvuWalk.walking()) { try { root.OvuWalk.stop(); } catch (e) { } } /* a walk in progress stops where she is */
    room.hideSheet(); hideInvite();
    run = { version: version, steps: plan(version), i: -1, quiet: !!quiet, paused: false, timer: null, left: 0, t0: 0, clock: makeClock(), skipped: [], brushed: 'no', audio: version === 'erin' ? new Audio() : null, done: false };
    if (room.endMoment) room.endMoment();
    /* from the mat she sits there hidden: bring her back first, or the routine plays to an empty room */
    if (room.els && room.els.meditator && room.els.meditator.classList.contains('on') && !(room.sessionOn && room.sessionOn())) room.exitMeditation();
    if (room.restorePose) room.restorePose();
    if (room.els && room.els.avatar) room.els.avatar.classList.remove('acting');
    showPanel(); next();
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
    if (run.i > 0) bell();
    var room = R();
    if (s.pose) room.setPose(s.pose); else if (room.restorePose) room.restorePose();
    if (room.els && room.els.avatar) room.els.avatar.classList.remove('acting'); /* no pulse: it would read as a breathing pace */
    if (s.gate) run.clock.hold(); else if (!run.paused) run.clock.run();
    if (s.key === 'yourway' || s.erin) run.brushed = s.erin ? 'erin' : 'yourway';
    paint();
    run.left = s.secs ? s.secs * 1000 : 0; run.pending = null;
    if (s.secs && !run.paused) arm(); /* a paused routine keeps the new step's full time for Resume */
    if (s.audio && !run.quiet) { if (run.paused) run.pending = s.audio; else playAudio(s.audio); }
  }
  function arm() { clearTimeout(run.timer); run.t0 = Date.now(); run.timer = setTimeout(function () { next(false); }, run.left); }
  function playAudio(url) { run.audioKey = step() && step().key; try { var a = run.audio || (run.audio = new Audio()); a.src = url; a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
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
      else if (s.audio && !run.quiet && run.audio && run.audioKey === s.key) { /* only this step's own clip resumes; a muted or older clip never does */ try { var p = run.audio.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
    }
    paint();
  }
  function quietToggle() {
    if (!run) return; run.quiet = !run.quiet;
    if (run.quiet) { stopAudio(); run.pending = null; run.audioKey = null; } /* on again: Erin speaks from the next line, so no line is cut short */
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
    if (exact < MIN_SAVE_S) { room.toast('Stopped. Nothing under 30 seconds is saved.', 'wb_twilight'); renderInvite(); return; }
    var did = [];
    if (r.skipped.indexOf('arrive') < 0) did.push('arrived'); if (r.skipped.indexOf('notice') < 0) did.push('noticed'); if (r.brushed !== 'no') did.push('brushed');
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
    if (s.erin) b += '<button type="button" class="btn ghost" id="mpQuiet" aria-pressed="' + (run.quiet ? 'true' : 'false') + '">' + (run.quiet ? 'Voice off' : 'Voice on') + '</button>';
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
    inWindow: inWindow, plan: plan, erinSteps: erinSteps, offered: offered, makeClock: makeClock, entryData: entryData,
    open: open, begin: begin, active: active, cancel: cancel, renderInvite: renderInvite,
    state: function () { return run ? { version: run.version, i: run.i, key: step() && step().key, paused: run.paused, left: run.left, audioKey: run.audioKey || null, pending: run.pending || null, quiet: run.quiet, seconds: run.clock.seconds(), skipped: run.skipped.slice(), brushed: run.brushed } : null; }
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () { setInterval(function () { if (!run) renderInvite(); }, 60000); });
  }
})(typeof window !== 'undefined' ? window : this);
