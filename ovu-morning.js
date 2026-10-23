/* Morning start (Jamie, 20 Oct 2026: "a simple and accessible morning routine. Upon waking up, a short breath and body
 * awareness + brushing teeth"). How it is offered and shown was agreed with a Codex review (docs/research/2026-10-20-morning-start.md):
 * - offered, never started for her: one invitation in Today from 04:00 to 11:59 by the real clock, which she can put away
 *   for the day, and always from Everyday and the mat while she is awake. Saving a night never starts it.
 * - two short captioned steps (arrive, notice) with no breath counts, no pacing and no breathing animation, then brushing
 *   once she says she is at the sink, either her own way or with Erin's own morning brushing guide, kept whole.
 * - DeepSeek and Doubao reviewed the copy once Ark was back (20 Oct, same doc): the greeting follows the clock (Good morning
 *   only in the morning window), dizziness on waking, no need to change the breath, touch as an anchor for low vision,
 *   any sink and time for prayer first. Since 23 Oct nothing is spoken (Jamie: "Take a moment to arrive? - remove
 *   erin's voice"; Erin speaks only in the mindfulness begun from Mind): every step is its caption, timed; Quiet drops the bells.
 * - she stays where she is, in her own outfit; Pause, Next, Stop and Quiet are always there; sleep cancels it at once.
 * - one honest entry, saved only if she says she did it and practised 30 seconds or more, earning the same small
 *   practice thank-you as anything else on the mat.
 * The data and rules come first and are pure (tools/test-core.js checks them); the panel follows. */
(function (root) {
  'use strict';
  var START_HOUR = 4, END_HOUR = 12, MIN_SAVE_S = 30, BRUSH_MIN_MS = 5000;
  /* 10 ms of silence, used only to ready the voice inside a tap: not an app voice file, so the shared voice mute leaves it alone */
  var STEPS = {
    /* the greeting comes from GREETINGS by the clock; clips are 23 s (Good morning) and 27 s (Hello), so 35 s leaves a quiet moment */
    arrive: { key: 'arrive', part: 1, title: 'Arrive', secs: 35,
      text: 'Sit, lie down or stand, whatever is easiest. If you feel dizzy, stay sitting or lying. Your eyes can be open or closed. There is no need to change your breathing. If you like, notice it as it is, or a sound, a colour, or something you can touch.' },
    notice: { key: 'notice', part: 2, title: 'Notice', secs: 55, /* a 21 s clip, then quiet */
      text: 'You don’t need to move. If you like, notice where your body is resting, on the bed, the floor or a chair. There is nothing you need to change. If this doesn’t feel right, choose a sound or a colour instead, or stop at any time.' },
    ready: { key: 'ready', part: 3, title: 'Brushing', gate: true, group: 'teeth', ready: 'Ready to brush', skip: 'Skip brushing',
      text: 'Go to wherever you brush, whenever you are ready. Take any time you need first, for prayer or anything else. Getting there is not part of the practice.' },
    yourway: { key: 'yourway', part: 3, title: 'Brush your way', open: true, pose: 'teeth',
      text: 'Brush as you usually do. If you like, notice one sensation, a taste or a sound. Tap Done when you finish.' }
  };
  var GREETINGS = ['Good morning.', 'Hello.']; /* clip mstart-arrive-0 says the first, mstart-arrive-1 the second, mstart-arrive-2 neither */
  var VERSIONS = {
    erin: { id: 'erin', name: 'Erin’s morning: wake, brush, sip', sub: 'Three short practices in her own words and voice. Take one part or all three.' },
    yourway: { id: 'yourway', name: 'A short pause, then brush your way', sub: '90 seconds of gentle noticing, then brushing at your own pace' }
  };
  /* the fuller routine (Jamie, 21 Oct: "a more complete morning routine - breath and body upon waking up, brushing teeth, mindful drinking";
   * shape agreed with a Codex design review, docs/design/2026-10-21-erin-morning-routine.md): Erin's wake-up script, a gate, her brushing
   * script, a gate, her mindful sip. Each part can be skipped or stopped; each part she really did is saved on its own. */
  var GATES = {
    brush: { key: 'ready', part: 2, title: 'Brushing', gate: true, group: 'teeth', ready: 'Ready to brush', skip: 'Skip this part', text: '' },
    sip: { key: 'sipready', part: 3, title: 'A mindful sip', gate: true, group: 'sip', ready: 'Ready to sip', skip: 'Skip this part',
      text: 'Choose a drink that is comfortable to sip: coffee, tea, water, anything. Take any time you need to make it; making it is not part of the practice. You can skip this part. No drink, fasting, or simply not wanting one are all fine reasons.' }
  };
  GATES.brush.text = STEPS.ready.text;
  var PARTS = { wake: { activity: 'wake', name: 'Waking up with breath and body', did: 'woke up with breath and body' }, teeth: { activity: 'teeth', name: 'Brushing teeth', did: 'brushed' }, sip: { activity: 'coffee', name: 'A mindful sip', did: 'took a mindful sip' } };
  var CARE_WAKE = 'Sit comfortably, in a chair or a wheelchair, or stand with support. Leave out any movement you do not want to do. There is no need to match the picture, or to change your breathing.';

  /* the morning window, read from the real clock at the moment of asking */
  function inWindow(d) { var h = (d || new Date()).getHours(); return h >= START_HOUR && h < END_HOUR; }
  /* Erin's own morning brushing script, whole and in her order, with her recorded clips */
  /* one of Erin's scripts as timed steps, in her order, with her clips */
  function erinPart(actId, group, part, title, poseFor) {
    var MF = root.OvuMindful, a = MF && MF.byId(actId); if (!a) return [];
    var vi = -1; a.variations.forEach(function (v, i) { if (vi < 0 && v.when === 'morning' && v.author === 'erin') vi = i; });
    if (vi < 0) return [];
    return a.variations[vi].steps.map(function (s, si) { return { key: group + si, part: part, group: group, title: title, secs: s.secs, text: s.text, pose: poseFor(si, s), erin: true }; });
  }
  /* the wake-up: the stretch pose only on the two movement passages (shoulders, arms); still otherwise. The sip: the coffee pose throughout. */
  function wakeSteps() { return erinPart('wake', 'wake', 1, 'Waking up with breath and body', function (si, s) { return /lifting your shoulders|reaching your arms/i.test(s.text) ? 'stretch' : null; }); }
  function sipSteps() { return erinPart('coffee', 'sip', 3, 'A mindful sip', function () { return 'coffee'; }); }
  function erinSteps(part) {
    var MF = root.OvuMindful, a = MF && MF.byId('teeth'); if (!a) return [];
    var vi = -1; a.variations.forEach(function (v, i) { if (vi < 0 && v.when === 'morning' && v.author === 'erin') vi = i; });
    if (vi < 0) return [];
    /* brushing starts after her line "When you're ready, beginning to brush"; the lines before it only pick up the brush */
    var st = a.variations[vi].steps, from = -1; st.forEach(function (s, si) { if (from < 0 && /begin(ning)? to brush/i.test(s.text)) from = si + 1; });
    if (from < 0) from = 1;
    return st.map(function (s, si) {
      return { key: 'erin' + si, part: part || 3, group: 'teeth', title: 'Brushing with Erin', secs: s.secs, text: s.text, pose: 'teeth', erin: true, brushing: si >= from };
    });
  }
  /* Arrive says Good morning only inside the morning window (she can open it from Everyday at any hour), with the matching
   * clip, decided once when she begins. With Erin's guide it has no greeting: Erin greets her at the sink in her own words,
   * so she never hears Hello and then Good morning, or Good morning twice (Codex follow-up check, 20 Oct). */
  function arriveFor(d, version) {
    var win = root.OvuMorning && root.OvuMorning.inWindow || inWindow, g = version === 'erin' ? 2 : win(d || new Date()) ? 0 : 1, a = {};
    for (var k in STEPS.arrive) a[k] = STEPS.arrive[k];
    a.text = (g < 2 ? GREETINGS[g] + ' ' : '') + STEPS.arrive.text;
    return a;
  }
  function plan(version, d) {
    if (version === 'erin') { var w = wakeSteps(), sp = sipSteps(); if (w.length && sp.length) return w.concat([GATES.brush], erinSteps(2), [GATES.sip], sp); return [arriveFor(d, version), STEPS.notice, STEPS.ready].concat(erinSteps()); } /* an older data file: the old shape */
    return [arriveFor(d, version), STEPS.notice, STEPS.ready, STEPS.yourway];
  }
  /* the parts of a plan, in order, with their total scripted seconds (gates have none) */
  function partsOf(steps) { var out = [], seen = {}; (steps || []).forEach(function (s) { if (!s.group) return; if (!seen[s.group]) { seen[s.group] = { group: s.group, name: PARTS[s.group] ? PARTS[s.group].name : s.title, secs: 0 }; out.push(seen[s.group]); } seen[s.group].secs += s.secs || 0; }); return out; }
  /* one entry per part she really did (30 seconds or more of it, and only if she says so); stopped early is said plainly */
  function partEntry(group, o) {
    var p = PARTS[group], raw = Math.max(0, Number(o && o.seconds) || 0), secs = Math.round(raw);
    if (!p || raw < MIN_SAVE_S || !o.confirmed) return null;
    return { kind: 'informal', activity: p.activity, activityName: p.name, routine: 'morning', version: 'erin', seconds: secs, minutes: Math.round(secs / 6) / 10, completed: !!o.finished, finished: !!o.finished, stoppedEarly: !o.finished, confirmedReal: true, guide: 'Words by Erin Lee, in her own voice' };
  }
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
      guide: o.version === 'erin' ? 'Opening words by Rhythme; brushing guide in Erin Lee’s own words, as captions' : 'Words by Rhythme, as captions'
    };
  }

  /* ---------- the panel and the flow (browser only) ---------- */
  var run = null, ticker = null, doneWait = null, pendingAsk = null, heard = [];
  function $(s) { return document.querySelector(s); }
  function R() { return root.OvuRoom; }
  function S() { return root.OvuStore; }
  function active() { return !!run; }
  /* bells unless app sound is off; nothing here is ever spoken */
  function soundOn() { return root.OvuSound ? root.OvuSound.enabled() : !!(S().state() || {}).sound; } /* the app's own rule: never chosen is on */
  function quietDefault() { return !soundOn(); }
  /* putting her outfit back writes her profile; if storage fails, the routine and its save prompt still go on */
  function settle(room) { try { if (room.restorePose) room.restorePose(); } catch (e) { } }
  function markToday(patch, day) { day = day || S().today(); var st = S().state(); if (st.morningStart && st.morningStart.date > day) return; /* today's Not today or done stands */ var m = st.morningStart && st.morningStart.date === day ? st.morningStart : { date: day }; for (var k in patch) m[k] = patch[k]; S().setState({ morningStart: m }); }

  function renderInvite() {
    var el = $('#morningInvite'); if (!el || !S()) return;
    var show = offered(S().state(), S().today(), new Date()) && !run;
    el.hidden = !show; if (!show) { el.innerHTML = ''; el.dataset.on = ''; return; }
    if (el.dataset.on === '1') return;
    el.dataset.on = '1';
    el.innerHTML = '<span class="ms" aria-hidden="true">wb_twilight</span><div><b>Morning start</b><small>Wake, brush, sip. Take one part or all three.</small></div>' +
      '<div class="minvite-btns"><button type="button" class="btn primary" id="miBegin">Begin</button><button type="button" class="btn ghost" id="miLater">Not today</button></div>';
    $('#miBegin').addEventListener('click', function () { open(); });
    $('#miLater').addEventListener('click', function () { markToday({ dismissed: true }); el.dataset.on = ''; renderInvite(); R().toast('Put away for today. Morning start is always in Everyday, and on the meditation mat.', 'wb_twilight'); });
  }
  function hideInvite() { var el = $('#morningInvite'); if (el) { el.hidden = true; el.dataset.on = ''; el.innerHTML = ''; } }

  function open() {
    var room = R(); if (!room) return;
    if (room.asleep()) { room.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; }
    if (run) { showPanel(); return; }
    if (room.refuseBusy && room.refuseBusy()) return; /* one activity at a time (room.js activityNow): no choice sheet over a running one */
    var quiet = quietDefault(), esc = room.esc;
    room.openSheet('morning', 'Morning start', 'A gentle way into the day', 'wb_twilight',
      '<p class="mintro">Three short practices in Erin’s own words (waking up with breath and body, brushing teeth, a mindful sip), or a short pause and brushing your way. Take one part or all three; any position is fine, and you can stop at any time.</p>' +
      '<fieldset class="mchoice"><legend>How would you like it?</legend>' +
      ['erin', 'yourway'].map(function (k, i) { var v = VERSIONS[k], sub = v.sub; if (k === 'erin') { var ps = partsOf(plan('erin')); if (ps.length) sub = 'About ' + Math.round(ps.reduce(function (t, p) { return t + p.secs; }, 0) / 60) + ' minutes as captions: ' + ps.map(function (p) { return p.name + ' (' + Math.max(1, Math.round(p.secs / 60)) + ' min)'; }).join(', ') + '. Plus any time you need between parts.'; } return '<label class="mopt"><input type="radio" name="mver" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(v.name) + '</b><small>' + esc(sub) + '</small></span></label>'; }).join('') +
      '</fieldset>' +
      '<label class="mquiet"><input type="checkbox" id="mQuiet"' + (quiet ? ' checked' : '') + '><span>Quiet: no bells</span></label>' +
      '<div class="row"><button type="button" class="btn primary" id="mBegin"><span class="ms" aria-hidden="true">play_arrow</span>Begin</button></div>' +
      '<p class="help">Words by Erin Lee, shown as captions; the short pause uses Rhythme’s words. Saved only if you say you did it, one entry for each part you did, with the same small thank-you as any practice, never a streak.</p>');
    $('#mBegin').addEventListener('click', function () {
      var ver = (document.querySelector('input[name=mver]:checked') || {}).value || 'erin';
      begin(ver, $('#mQuiet').checked);
    });
  }

  function begin(version, quiet) {
    var room = R(); if (room.asleep() || run) return;
    var other = otherOwner(room); if (other) { if (!(other[2] && room.refuseBusy && room.refuseBusy())) room.toast(other[0], other[1]); return; } /* nothing, not even a waiting prompt, goes over another activity */
    if (pendingAsk) { room.hideSheet(); pendingAsk(); return; } /* the last one is still waiting to be saved or let go: ask that first */
    if (room.endTryOn) { try { room.endTryOn(true); } catch (e) { } } /* a try-on in the boutique ends: the routine (and its save) is in her own clothes (Codex design review, 21 Oct) */
    if (root.OvuGarden && root.OvuGarden.sitting && root.OvuGarden.sitting()) { try { root.OvuGarden.standUp(); } catch (e) { } } /* off the bench, where she is, so the brushing pose shows */
    if (root.OvuPodcast) { try { root.OvuPodcast.pause(); } catch (e) { } }
    heard.forEach(function (el) { try { if (!el.paused) el.pause(); } catch (e) { } }); heard = []; /* a greeting still playing (the wake sheet's) stops: one voice at a time */
    if (root.OvuWalk && root.OvuWalk.walking && root.OvuWalk.walking()) { try { root.OvuWalk.stop(); } catch (e) { } } /* a walk in progress stops where she is */
    if (room.freezeWalk) { try { room.freezeWalk(); } catch (e) { } } /* and so does the room's own fallback walk */
    if (room.emit) room.emit('activity', 'morning', version); /* as a practice does: a sit by the water, a pending care step or a greenhouse minute steps aside first */
    room.hideSheet(); hideInvite();
    run = { version: version, steps: plan(version), i: -1, quiet: !!quiet, spent: {}, done: {}, brushMs: 0, stepMs: 0, waits: 0, paused: false, timer: null, left: 0, t0: 0, clock: makeClock(), skipped: [], brushed: 'no', audio: null }; /* made inside the Begin tap, so later clips may play on phones */
    if (room.endMoment) room.endMoment();
    /* from the mat she sits there hidden: bring her back first, or the routine plays to an empty room */
    var onMat = room.meditating ? room.meditating() : !!(room.els && room.els.meditator && room.els.meditator.classList.contains('on'));
    if (onMat && !(room.sessionOn && room.sessionOn())) room.exitMeditation(); /* by the room's own state, so a start during the mat's entrance also stands her up */
    settle(room);
    if (room.els && room.els.avatar) room.els.avatar.classList.remove('acting');
    showPanel(); next();
    var pnl = $('#mpanel'); if (pnl) { pnl.setAttribute('tabindex', '-1'); pnl.focus(); } /* focus leaves the closed sheet for the panel */
    clearInterval(ticker); ticker = setInterval(function () {
      if (run && room.asleep()) { cancel(); return; }
      if (run && room.sheetOpen() && step() && step().gate && run.audioKey === step().key && run.audio && !run.audio.paused) { stopAudio(); run.audioKey = null; } /* the sink line stops under a sheet */
      if (run && room.sheetOpen() && !run.paused && step() && !step().gate) { pauseToggle(); room.toast('Morning start is paused while this is open. Tap Resume when you are back.', 'pause'); } /* a sheet covers her controls */
    }, 1000);
  }
  /* anything else that owns her, the HUD or the sound right now (Codex sweeps, 20 Oct): Morning start waits for it */
  function otherOwner(room) {
    var a = room.activityNow && room.activityNow(); if (a && a.kind !== 'morning') return [room.busyLine(a), a.icon, true]; /* a practice, a session or a bench practice (room.js); true: refuseBusy brings its controls back */
    if ((room.sessionOn && room.sessionOn()) || (room.practiceOn && room.practiceOn())) return ['Finish or stop the practice that is running first.', 'self_improvement'];
    if (root.OvuGreenhouse && root.OvuGreenhouse.brewing && root.OvuGreenhouse.brewing()) return ['Finish the cup first.', 'local_cafe'];
    if (root.OvuGreenhouse && root.OvuGreenhouse.caring && root.OvuGreenhouse.caring()) return ['Finish the minute with the plant first.', 'potted_plant'];
    if (root.OvuGarden && root.OvuGarden.watering && root.OvuGarden.watering()) return ['Finish watering the garden first.', 'water_drop'];
    if (root.OvuWalk && root.OvuWalk.travelling && root.OvuWalk.travelling()) return ['One moment, she is on her way.', 'directions_walk'];
    if (root.document && root.document.body && root.document.body.classList.contains('btap-open')) return ['Close Light Flower or Moon Tap first.', 'spa']; /* their overlays, setup screens too */
    return null;
  }
  function showPanel() { var p = $('#mpanel'); if (p) p.hidden = false; }
  function hidePanel() { var p = $('#mpanel'); if (p) p.hidden = true; }
  function bell() { if (run && !run.quiet && soundOn()) R().chime('bell'); }
  function step() { return run && run.steps[run.i]; }

  function next(skippedNow) {
    if (!run) return;
    if (R().asleep()) { cancel(); return; }
    var cur = step(); if (cur && skippedNow && run.skipped.indexOf(cur.key) < 0 && !cur.erin) run.skipped.push(cur.key);
    if (cur && cur.group && !cur.gate && skippedNow) { run.nexted = run.nexted || {}; run.nexted[cur.group] = true; } /* Next before a line was over: that part was not finished (Codex sweep, 21 Oct) */
    if (cur && cur.group && !cur.gate && !run.skipping && run.i === groupEnd(cur.group) && !(run.nexted && run.nexted[cur.group])) run.done[cur.group] = true; /* the last line of a part, reached: that part was finished */
    clearTimeout(run.timer); stopAudio(); leaveStep();
    run.i++;
    var s = step(); if (!s) { finish(true); return; }
    if (run.i > 0) bell();
    var room = R();
    if (s.pose) { try { room.setPose(s.pose); } catch (e) { } } else settle(room);
    if (room.els && room.els.avatar) room.els.avatar.classList.remove('acting'); /* no pulse: it would read as a breathing pace */
    if (s.gate) { run.paused = false; run.clock.hold(); } else if (!run.paused) run.clock.run(); /* the sink has no Pause, so it is never left paused */
    run.stepMs = run.clock.ms(); /* her own way counts as brushed only when she taps Done; Erin's on time spent brushing (leaveStep) */
    paint();
    run.left = s.secs ? s.secs * 1000 : 0; run.pending = null; run.waits = 0;
    if (s.secs && !run.paused) arm(); /* a paused routine keeps the new step's full time for Resume */
  }
  /* leaving a step: the practice time actually spent on it (the clock never runs while paused or at the sink) is what the
   * end summary may claim: arrived, noticed, and with Erin, brushing on her brushing lines */
  function leaveStep() {
    var cur = step(); if (!run || !cur) return;
    var d = Math.max(0, run.clock.ms() - run.stepMs); run.stepMs = run.clock.ms();
    run.spent[cur.key] = (run.spent[cur.key] || 0) + d;
    if (cur.brushing) { run.brushMs += d; if (run.brushMs >= BRUSH_MIN_MS) run.brushed = 'erin'; }
  }
  /* a step's time is up: if its line is still being said (a clip that started late), wait a second at a time, at most
   * eight, so no line is cut off; Pause, Next and Stop keep working while it waits */
  function due() {
    if (!run) return;
    var s = step(), a = run.audio;
    if (s && s.audio && !run.quiet && a && run.audioKey === s.key && !a.paused && !a.ended && run.waits < 8) { run.waits++; run.left = 1000; arm(); return; }
    next(false);
  }
  function arm() { clearTimeout(run.timer); run.t0 = Date.now(); run.timer = setTimeout(due, run.left); }
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
    }
    paint();
  }
  function ready() { if (!run) return; run.paused = false; next(false); }
  function groupEnd(g) { var last = -1; (run ? run.steps : []).forEach(function (s, i) { if (s.group === g && !s.gate) last = i; }); return last; }
  /* at a gate: the part is left out (Already brushed, Skip this part) and the routine goes on to the next part, or ends when it was the last */
  function skipGate() {
    var s = step(); if (!run || !s || !s.gate) return;
    leaveStep();
    if (s.group === 'teeth') run.brushed = 'no';
    run.skipped.push(s.group === 'teeth' ? 'brushing' : s.group);
    clearTimeout(run.timer); stopAudio();
    var end = groupEnd(s.group); if (end < 0 || end >= run.steps.length - 1) { finish(true); return; }
    var r0 = run; run.skipping = true; run.i = end; next(false); if (run === r0) run.skipping = false;
  }
  var skipBrushing = skipGate;
  /* in the middle of a part: the rest of it is left out; time already spent on it counts */
  function skipPart() {
    var s = step(); if (!run || !s || s.gate || !s.group) return;
    leaveStep(); /* her time goes to the line she was on, before the index moves (persona walk, 21 Oct: wake-up listening was booked as brushing) */
    run.skipped.push(s.group); clearTimeout(run.timer); stopAudio();
    var r0 = run; run.skipping = true; run.i = groupEnd(s.group); next(false); if (run === r0) run.skipping = false; /* skipping the last part ends the run (Codex sweep, 21 Oct) */
  }
  function stop() { if (!run) return; finish(false); }
  /* sleep, or anything that ends the room's day: everything stops at once and nothing is offered */
  function cancel() {
    if (!run) return; clearTimeout(run.timer); stopAudio(); clearInterval(ticker);
    run = null; hidePanel(); clearInterval(doneWait); var room = R(); if (!room.asleep()) settle(room);
  }
  function finish(finished) {
    var r = run; if (!r) return;
    if (R().asleep()) { cancel(); return; } /* asleep: nothing to confirm */
    leaveStep();
    clearTimeout(r.timer); stopAudio(); r.clock.hold(); clearInterval(ticker);
    var exact = r.clock.ms() / 1000, secs = Math.round(exact), room = R(), day = S().today(); /* the day she practised, even if she confirms after midnight */
    run = null; hidePanel(); settle(room);
    var byPart = {}; r.steps.forEach(function (s) { if (s.group && !s.gate) byPart[s.group] = (byPart[s.group] || 0) + (r.spent[s.key] || 0); });
    var parts = r.version === 'erin' ? Object.keys(PARTS).filter(function (g) { return (byPart[g] || 0) / 1000 >= MIN_SAVE_S; }) : [];
    if (r.version === 'erin' ? !parts.length : exact < MIN_SAVE_S) { room.toast(r.version === 'erin' ? 'Stopped. No part reached 30 seconds, so nothing was added to your journal.' : 'Stopped. Pauses under 30 seconds are not saved.', 'wb_twilight'); renderInvite(); return; } /* one entry per part she really did, never a generic one (menopause walk, 21 Oct) */
    var did = [];
    if (r.version === 'erin') parts.forEach(function (g) { did.push(g === 'teeth' && r.brushed !== 'erin' ? 'began at the sink with Erin' : PARTS[g].did); }); /* brushed only once she spent time on the brushing lines */
    else { if ((r.spent.arrive || 0) >= 5000) did.push('arrived'); if ((r.spent.notice || 0) >= 5000) did.push('noticed'); if (r.brushed !== 'no') did.push('brushed'); } /* only what she spent time on */
    var saved = false;
    /* another sheet is open (a symptoms form, the bed): never replace it; ask once it closes, unless she falls asleep */
    clearInterval(doneWait); pendingAsk = null;
    if (room.sheetOpen()) {
      room.toast('Morning start finished. It will ask about saving when you close this.', 'wb_twilight');
      pendingAsk = ask;
      doneWait = setInterval(function () { if (room.asleep()) { clearInterval(doneWait); pendingAsk = null; return; } if (!room.sheetOpen() && !otherOwner(room)) { clearInterval(doneWait); ask(); } }, 400);
      return;
    }
    ask();
    function ask() {
    clearInterval(doneWait); pendingAsk = null;
    room.openSheet('morningDone', finished ? 'Morning start' : 'Stopping early', 'About ' + Math.max(1, Math.round(secs / 60)) + ' minute' + (secs >= 90 ? 's' : '') + ' of practice', 'wb_twilight',
      '<p class="mintro">' + (did.length ? 'You ' + (did.length > 1 ? did.slice(0, -1).join(', ') + ' and ' + did[did.length - 1] : did[0]) + '.' : 'You paused for a moment.') + ' Save this pause to your journal?</p>' +
      '<div class="row"><button type="button" class="btn primary" id="mdYes"><span class="ms" aria-hidden="true">check</span>Yes, I did it</button><button type="button" class="btn ghost" id="mdNo">Not this time</button></div>' +
      '<p class="help">Save it if you really did it. A mind that wandered and came back still counts.</p>');
    $('#mdYes').addEventListener('click', function () {
      if (saved) return;
      if (room.asleep()) { room.closeSheet(); return; }
      /* one entry per part she really did; a morning with no part of 30 seconds (she stopped in Erin's opening words) saves the plain morning entry, as the short pause does */
      var datas = r.version === 'erin' ? parts.map(function (g) { return partEntry(g, { seconds: byPart[g] / 1000, confirmed: true, finished: !!r.done[g] }); }).filter(Boolean) : [entryData({ seconds: exact, confirmed: true, version: r.version, skipped: r.skipped, brushed: r.brushed, finished: finished })].filter(Boolean);
      if (!datas.length) { room.closeSheet(); return; }
      var evs = r.savedEvs = r.savedEvs || []; r.savedIdx = r.savedIdx || {};
      try { datas.forEach(function (data, i) { if (r.savedIdx[i]) return; evs.push(S().add('mindfulness', day, data)); r.savedIdx[i] = true; }); } catch (e) { room.toast('Part of this could not be saved: ' + e.message + ' Tap Yes to try the rest again, or Not this time.', 'error'); return; } /* the sheet stays; parts already saved are not saved twice (Codex sweep, 21 Oct) */ /* the sheet stays for a retry; parts already saved are not saved twice */
      saved = true; room.closeSheet();
      try { markToday({ done: true }, day); } catch (e) { } /* the entries are saved; only the invitation's note for today failed */
      hideInvite();
      evs.forEach(function (ev, i) { room.afterSave(ev, i === evs.length - 1 ? (evs.length > 1 ? evs.length + ' parts saved to your journal.' : 'Saved to your journal.') : ''); });
    });
    $('#mdNo').addEventListener('click', function () { room.closeSheet(); room.toast('No worries. Morning start is there whenever you like.', 'wb_twilight'); renderInvite(); });
    }
  }

  function paint() {
    var s = step(); if (!s || !run) return;
    var parts = 3;
    $('#mpCount').textContent = (run.version === 'erin' ? 'Part ' : 'Step ') + s.part + ' of ' + parts + (run.paused ? ' · paused' : '');
    $('#mpTitle').textContent = s.title;
    $('#mpText').textContent = s.text;
    var care = document.getElementById('mpCare'); /* the adaptation line for the wake-up, visible before its movements (Codex, 21 Oct) */
    if (s.group === 'wake' && !s.gate) { if (!care) { care = document.createElement('p'); care.id = 'mpCare'; care.className = 'mpcare'; $('#mpBtns').parentNode.insertBefore(care, $('#mpBtns')); } care.textContent = CARE_WAKE; } else if (care) care.remove();
    var b = '';
    if (s.gate) b = '<button type="button" class="btn primary" id="mpReady">' + (s.ready || 'Ready') + '</button><button type="button" class="btn ghost" id="mpSkipBrush">' + (s.skip || 'Skip this part') + '</button>';
    else if (s.open) b = '<button type="button" class="btn primary" id="mpDone">Done</button><button type="button" class="btn ghost" id="mpPause">' + (run.paused ? 'Resume' : 'Pause') + '</button>';
    else b = '<button type="button" class="btn ghost" id="mpPause">' + (run.paused ? 'Resume' : 'Pause') + '</button><button type="button" class="btn ghost" id="mpNext">Next</button>' + (s.group && run.version === 'erin' ? '<button type="button" class="btn ghost" id="mpSkipPart">Skip this part</button>' : '');
    b += '<button type="button" class="btn ghost" id="mpStop">Stop</button>';
    var row = $('#mpBtns'), pnl = $('#mpanel'), ae = document.activeElement, focusId = ae && ae.id, inPanel = !!(ae && pnl && (pnl.contains(ae) || ae === document.body));
    row.innerHTML = b;
    var bind = function (id, f) { var el = document.getElementById(id); if (el) el.addEventListener('click', f); };
    bind('mpReady', ready); bind('mpSkipBrush', skipGate); bind('mpSkipPart', skipPart); bind('mpDone', function () { if (run) run.brushed = 'yourway'; finish(true); }); bind('mpPause', pauseToggle); bind('mpNext', function () { next(true); }); bind('mpStop', stop);
    var keep = focusId && document.getElementById(focusId);
    if (keep && row.contains(keep)) keep.focus(); /* keyboard focus stays where she was */
    else if (inPanel && focusId !== 'mpanel') { var first = row.querySelector('button'); if (first) first.focus(); } /* or moves to the first control, never lost */
  }

  root.OvuMorning = {
    START_HOUR: START_HOUR, END_HOUR: END_HOUR, MIN_SAVE_S: MIN_SAVE_S, STEPS: STEPS, VERSIONS: VERSIONS,
    inWindow: inWindow, GREETINGS: GREETINGS, arriveFor: arriveFor, plan: plan, erinSteps: erinSteps, wakeSteps: wakeSteps, sipSteps: sipSteps, GATES: GATES, PARTS: PARTS, CARE_WAKE: CARE_WAKE, partsOf: partsOf, partEntry: partEntry, offered: offered, makeClock: makeClock, entryData: entryData,
    open: open, begin: begin, active: active, cancel: cancel, renderInvite: renderInvite, reveal: function () { if (run) showPanel(); },
    repose: function () { var s = step(); if (s && s.pose) { try { R().setPose(s.pose); } catch (e) { } } }, /* after she picks another outfit mid-step */ _due: function () { if (run) { clearTimeout(run.timer); due(); } }, /* tests only: a step's time is up now */
    state: function () { return run ? { version: run.version, i: run.i, key: step() && step().key, paused: run.paused, left: run.left, audioKey: run.audioKey || null, pending: run.pending || null, quiet: run.quiet, seconds: run.clock.seconds(), skipped: run.skipped.slice(), brushed: run.brushed } : null; }
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () { setInterval(function () { if (!run) renderInvite(); }, 60000); });
    /* away from the app (another app, the lock screen): pause, so time away is never counted; she resumes on return */
    document.addEventListener('visibilitychange', function () {
      if (!run) return;
      if (document.hidden) { var s = step(); if (s && s.gate) { stopAudio(); run.audioKey = null; } else if (s && !run.paused) { pauseToggle(); run.away = true; } } /* at the sink there is no clock to pause: the line just stops, its caption stays */
      else if (run.away) { run.away = false; R().toast('Paused while you were away. Tap Resume when you are ready.', 'pause'); }
    });
    /* one voice at a time: while Morning start runs, other audio (the podcast mini-player, whose element is not in the page)
     * is refused at play(), the same place the shared voice mute hooks in; the podcast treats it as an aborted start */
    var MP = root.HTMLMediaElement && root.HTMLMediaElement.prototype, mplay = MP && MP.play;
    if (mplay) MP.play = function () {
      var sounds = this.tagName === 'AUDIO' || (!this.muted && !this.srcObject); /* a muted camera preview (barcode scanning) is not competing sound */
      if (run && this !== run.audio && sounds) {
        try { R().toast('Morning start is running. Other audio waits until it ends.', 'headphones'); } catch (x) { }
        var err; try { err = new DOMException('Morning start is running', 'AbortError'); } catch (x) { err = new Error('Morning start is running'); err.name = 'AbortError'; }
        return Promise.reject(err);
      }
      if (this.tagName === 'AUDIO' && heard.indexOf(this) < 0) { heard.push(this); if (heard.length > 8) heard.shift(); } /* so a later Begin can quiet it */
      return mplay.apply(this, arguments);
    };
  }
})(typeof window !== 'undefined' ? window : this);
