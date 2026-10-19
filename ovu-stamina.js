/* Rhythme stamina. Farm and outdoor actions cost a little energy; a night's sleep (the bed, which is also the sleep
 * log) and the turn of the day fill it back up. Low stamina slows her walk and washes the colour out of the scene, so
 * the body's limit is felt without a fail state: nothing is lost, she just needs rest. Kept in state.stamina. */
(function (root) {
  'use strict';
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, GT = root.OvuGameTime, doc = root.document;
  var MAX = 100, LOW = 25;
  var COSTS = { plant: 2, water: 6, harvest: 4, clear: 5, fish: 3, forage: 2, travel: 1 };
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
    if (v < c) { if (!quiet && R) R.toast('Too tired for that. A rest first.', 'bedtime'); return false; }
    s.v = Math.max(0, v - c); write(s); return true;
  }
  function refill() { write(fresh()); }
  function low() { return value() < LOW; }
  function apply() {
    var isLow = low(), scene = R && R.els && R.els.scene;
    if (scene) scene.classList.toggle('tired', isLow);
    if (W && W.setSpeedScale) W.setSpeedScale(isLow ? 0.72 : 1);
  }
  /* sleep refills: the bed sets state.sleeping; when it turns on, the night does its work */
  if (S && S.subscribe) S.subscribe(function (reason) {
    if (reason !== 'state' && reason !== 'external' && String(reason).indexOf('sync') !== 0) return;
    var asleep = !!S.state().sleeping, justSlept = wasAsleep === false && asleep;
    wasAsleep = asleep; /* latch first: refill() writes state and re-enters this subscriber */
    if (justSlept) refill(); else apply(); /* a state change from elsewhere (another tab, a sync, a test) must show the same tiredness */
  });
  if (S) wasAsleep = !!S.state().sleeping;
  if (GT) GT.onNewDay(function () { value(); });
  if (R && R.on) R.on('boot', apply);
  root.OvuStamina = { MAX: MAX, LOW: LOW, COSTS: COSTS, value: value, can: can, spend: spend, refill: refill, low: low, onChange: function (f) { fns.push(f); } };
})(typeof window !== 'undefined' ? window : this);
