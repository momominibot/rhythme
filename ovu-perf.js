/* Rhythme on slower phones (23 Oct 2026, the phone-app speed budget): the room has frosted-glass panels over a moving scene,
 * soft shadows on every sprite and a few dozen gentle loops. A mid-range Android phone can drop well below 60 frames a
 * second under all of that, so the room has two looks: full, and lighter (no glass blur, fewer shadows, the ambient
 * sparkles and idle sways still, smaller canvas effects). Nothing she does or saves changes between them.
 *
 * Which one: her own choice in Settings (full or lighter) wins; on Automatic, a phone that says it is small (two or fewer
 * CPU cores, or 2 GB of memory or less) starts lighter, and otherwise the room measures itself for a few seconds after it
 * opens: when one frame in four takes longer than 28 ms (under about 35 frames a second) it switches to lighter and keeps
 * that answer on this phone for a week. html[data-perf] carries the look for room.css; OvuPerf.lite() tells canvases.
 * Pure rules first (tested in node), then the measuring. */
(function (root) {
  'use strict';
  var KEY = 'rhythme_perf', WEEK = 7 * 86400000, SLOW_MS = 28, SAMPLE_MS = 4000, MIN_FRAMES = 40;
  /* the 75th-percentile frame time of a list of frame gaps in ms; gaps over 250 ms (a stall, a tab switch) are left out */
  function p75(gaps) {
    var g = (gaps || []).filter(function (x) { return isFinite(x) && x > 0 && x < 250; }).sort(function (a, b) { return a - b; });
    if (!g.length) return null; return g[Math.min(g.length - 1, Math.floor(g.length * 0.75))];
  }
  /* what the phone says about itself: lighter from the start on a small phone */
  function smallPhone(hints) {
    hints = hints || {};
    return (isFinite(hints.cores) && hints.cores > 0 && hints.cores <= 2) || (isFinite(hints.memory) && hints.memory > 0 && hints.memory <= 2);
  }
  /* the look to use: choice is 'full', 'lite' or 'auto'; saved is the last measured answer {look, at} */
  function decide(choice, saved, hints, now) {
    if (choice === 'full' || choice === 'lite') return { look: choice, why: 'chosen' };
    if (smallPhone(hints)) return { look: 'lite', why: 'small' };
    if (saved && (saved.look === 'full' || saved.look === 'lite') && isFinite(saved.at) && now - saved.at < WEEK) return { look: saved.look, why: 'measured' };
    return { look: 'full', why: 'measure' }; /* not known yet: full, and measure */
  }
  /* a measured answer from frame gaps; too few frames (a hidden or stalled page) gives no answer */
  function judge(gaps) {
    var n = (gaps || []).filter(function (x) { return isFinite(x) && x > 0 && x < 250; }).length; if (n < MIN_FRAMES) return null;
    var t = p75(gaps); return t === null ? null : (t > SLOW_MS ? 'lite' : 'full');
  }
  function read() { try { var v = JSON.parse(root.localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function write(v) { try { root.localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } }
  function hints() { var n = root.navigator || {}; return { cores: Number(n.hardwareConcurrency), memory: Number(n.deviceMemory) }; }
  var current = 'full', why = 'measure', listeners = [];
  function apply(look, w) {
    current = look === 'lite' ? 'lite' : 'full'; why = w || why;
    try { if (root.document && root.document.documentElement) root.document.documentElement.dataset.perf = current; } catch (e) { }
    listeners.forEach(function (f) { try { f(current); } catch (e) { } });
  }
  function choice() { var c = read().choice; return c === 'full' || c === 'lite' ? c : 'auto'; }
  function setChoice(c) { var v = read(); v.choice = c === 'full' || c === 'lite' ? c : 'auto'; write(v); var d = decide(v.choice, v.measured, hints(), Date.now()); apply(d.look, d.why); if (d.why === 'measure') measure(); return v.choice; }
  /* measure after the room has settled: a few seconds of frames while the page is visible */
  var measuring = false;
  function measure() {
    if (measuring || !root.requestAnimationFrame || !root.document) return; measuring = true;
    var gaps = [], last = 0, t0 = 0;
    function frame(t) {
      if (root.document.hidden) { measuring = false; return; } /* away: try again next time the room opens */
      if (last) gaps.push(t - last); else t0 = t; last = t;
      if (t - t0 < SAMPLE_MS) { root.requestAnimationFrame(frame); return; }
      measuring = false; var look = judge(gaps); if (!look) return;
      var v = read(); v.measured = { look: look, at: Date.now(), p75: Math.round(p75(gaps)) }; write(v);
      if (choice() === 'auto') apply(look, 'measured');
    }
    root.setTimeout(function () { root.requestAnimationFrame(frame); }, 2500);
  }
  function start() {
    var v = read(), d = decide(choice(), v.measured, hints(), Date.now()); apply(d.look, d.why);
    if (d.why === 'measure' && !root.navigator.webdriver) measure(); /* the browser tests choose their own look */
  }
  root.OvuPerf = {
    KEY: KEY, SLOW_MS: SLOW_MS, p75: p75, smallPhone: smallPhone, decide: decide, judge: judge,
    lite: function () { return current === 'lite'; }, look: function () { return current; }, why: function () { return why; },
    choice: choice, setChoice: setChoice, onChange: function (f) { if (typeof f === 'function') listeners.push(f); }, measure: measure
  };
  if (root.document && root.localStorage !== undefined) start();
})(typeof window !== 'undefined' ? window : this);
