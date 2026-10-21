/* Rhythme stamina. Farm and outdoor actions cost a little energy; a night's sleep (the bed, which is also the sleep
 * log) and the turn of the day fill it back up. Low stamina slows her walk and washes the colour out of the scene, so
 * the body's limit is felt without a fail state: nothing is lost, she just needs rest. Kept in state.stamina. */
(function (root) {
  'use strict';
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, GT = root.OvuGameTime, doc = root.document;
  var MAX = 100, LOW = 25;
  var COSTS = { plant: 2, water: 6, harvest: 4, clear: 5, fish: 3, forage: 2, travel: 1, egg: 1, milk: 2 }; /* the barn: one visit to the nests, one milking (21 Oct) */
  var fns = [], wasAsleep = null;
  function today() { return GT ? GT.dayKey() : new Date().toISOString().slice(0, 10); }
  function read() { var s = S.state().stamina; return s && typeof s.v === 'number' ? s : { v: MAX, max: MAX, day: today() }; }
  function write(s) { S.setState({ stamina: s }); apply(); fns.slice().forEach(function (f) { try { f(s.v, s.max); } catch (e) { } }); }
  function fresh() { return { v: MAX, max: MAX, day: today() }; }
  /* the day's turn refills; read() through value() so a stale day never shows */
  function value() { var s = read(); if (s.day < today()) { s = fresh(); write(s); } return s.v; } /* only a later date refills; a clock set back keeps today's energy */
  function can(action) { return value() >= (COSTS[action] || 0); }
  function spend(action, quiet) {
    var c = COSTS[action] || 0, v = value(), s = read();
    if (v < c) { if (!quiet && R) R.toast('Too tired for that. Energy comes back with a night’s sleep, or with the new day.', 'bedtime'); return false; }
    s.v = Math.max(0, v - c); write(s); return true;
  }
  function refill() { write(fresh()); }
  function low() { return value() < LOW; }
  function apply() {
    var isLow = low(), scene = R && R.els && R.els.scene;
    if (scene) scene.classList.toggle('tired', isLow);
    if (W && W.setSpeedScale) W.setSpeedScale(isLow ? 0.72 : 1);
  }
  /* rest refills (Codex, 20 Oct: going to bed used to refill at once, even before "I did not sleep"). A saved night refills
   * when at least REST_H real hours passed since she went to bed; the turn of the day refills too. Getting into bed alone,
   * or "I did not sleep", changes nothing. */
  var REST_H = 3, bedMono = null;
  /* three hours by the phone's clock; when the app stayed open since bedtime its own steady timer must agree too, so moving
   * the clock forward in an open app does not count (a closed app can only go by the clock: a soft rule, not a lock) */
  function restedEnough(startedAt, now, mono) {
    var t = Date.parse(startedAt); if (!isFinite(t) || now - t < REST_H * 3600000) return false;
    if (mono && mono.at === startedAt && typeof mono.t === 'number' && typeof mono.now === 'number' && mono.now - mono.t < REST_H * 3600000) return false;
    return true;
  }
  function monoNow() { return root.performance && root.performance.now ? root.performance.now() : null; }
  function rested(startedAt) { var m = bedMono && monoNow() !== null ? { at: bedMono.at, t: bedMono.t, now: monoNow() } : null; if (!restedEnough(startedAt, Date.now(), m)) return false; refill(); return true; }
  if (S && S.subscribe) S.subscribe(function (reason) {
    if (reason !== 'state' && reason !== 'external' && String(reason).indexOf('sync') !== 0) return;
    var sl = S.state().sleeping, asleep = !!sl;
    if (asleep && wasAsleep === false && reason === 'state' && monoNow() !== null) bedMono = { at: sl.startedAt || sl.at, t: monoNow() }; /* she went to bed in this open app: another tab's bedtime arrives late, so it never starts the timer */
    if (!asleep) bedMono = bedMono && wasAsleep ? bedMono : null;
    wasAsleep = asleep;
    apply(); /* a state change from elsewhere (another tab, a sync, a test) must show the same tiredness */
  });
  /* spend energy and write something else in the same save (the big watering can): both land or neither does */
  function spendWith(action, patch) {
    var c = COSTS[action] || 0, v = value(); if (v < c) return false;
    var s = Object.assign({}, read()); s.v = Math.max(0, v - c);
    var p = Object.assign({ stamina: s }, patch || {}); if (S.commit) S.commit(p); else S.setState(p);
    apply(); fns.slice().forEach(function (f) { try { f(s.v, s.max); } catch (e) { } }); return true;
  }
  if (S) wasAsleep = !!S.state().sleeping;
  if (GT) GT.onNewDay(function () { value(); });
  if (R && R.on) R.on('boot', apply);
  root.OvuStamina = { MAX: MAX, LOW: LOW, COSTS: COSTS, REST_H: REST_H, restedEnough: restedEnough, rested: rested, spendWith: spendWith, value: value, can: can, spend: spend, refill: refill, low: low, onChange: function (f) { fns.push(f); } };
})(typeof window !== 'undefined' ? window : this);
