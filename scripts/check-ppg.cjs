#!/usr/bin/env node
// Deterministic camera/page lifecycle checks with fake frames, timers and media.
// No camera, network, browser storage or clinical validation is involved.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'ppg.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'ppg.html'), 'utf8');
const pageScript = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
const passed = [];
function harness(options = {}) {
  let grantPermission;
  let now = 0, nextId = 0, startCount = 0, readyCount = 0, stoppedTracks = 0, writes = 0;
  const frames = new Map(), timers = new Map(), elements = new Map(), cameras = [];
  const drawContext = new Proxy({}, { get: (target, name) => target[name] || (() => {}), set: (target, name, value) => { target[name] = value; return true; } });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, style: {}, textContent: '', innerHTML: '', width: 300, height: 80,
      readyState: 4, videoWidth: 640, videoHeight: 480, offsetParent: {},
      parentElement: { getBoundingClientRect: () => ({ width: 300, height: 80 }) },
      handlers: {}, children: [], classList: { add() {}, remove() {} },
      addEventListener(type, callback) { this.handlers[type] = callback; },
      appendChild(child) { this.children.push(child); },
      getContext: () => drawContext, play: async () => {}
    });
    return elements.get(id);
  }
  const track = { stop: () => stoppedTracks++, getCapabilities: () => ({}), applyConstraints: async () => {} };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const context = {
    console, Number, Math, Float64Array, performance: { now: () => now },
    navigator: { mediaDevices: { getUserMedia: () => options.deferPermission ? new Promise(resolve => { grantPermission = () => resolve(stream); }) : Promise.resolve(stream) } },
    document: { getElementById: element, querySelectorAll: () => [], createElement: id => element('created-' + id + (++nextId)) },
    window: { addEventListener() {}, location: {} },
    localStorage: { getItem: () => null, setItem: () => writes++ },
    requestAnimationFrame: fn => { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, delay) => { const id = ++nextId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => { const id = ++nextId; timers.set(id, { fn, at: now + delay, delay }); return id; },
    clearInterval: id => timers.delete(id),
    alert: text => { throw new Error(text); }
  };
  vm.createContext(context); vm.runInContext(engine, context);
  const EngineCamera = context.window.OvulunaPPG.CameraPPG;
  context.window.OvulunaPPG.CameraPPG = class extends EngineCamera {
    constructor(canvas, video, options) {
      const onReady = options.onCalibrationChange;
      super(canvas, video, { ...options, onCalibrationChange: (...args) => { if (args[2]) readyCount++; onReady(...args); } });
      cameras.push(this);
    }
    extractRedMean() { return 200; }
    startMeasurement(...args) { const result = super.startMeasurement(...args); if (result) startCount++; return result; }
  };
  vm.runInContext(pageScript, context);
  function tick(ms) {
    const end = now + ms;
    while (now < end) {
      now += 1000 / 60;
      for (const [id, timer] of [...timers]) {
        if (timer.at > now || !timers.has(id)) continue;
        if (timer.delay) timer.at += timer.delay; else timers.delete(id);
        timer.fn();
      }
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(fn => fn());
    }
  }
  return { tick, element, cameras, context, grant: () => grantPermission(), now: () => now, click: id => element(id).handlers.click(),
    stats: () => ({ startCount, readyCount, stoppedTracks, writes, frames: frames.size, timers: timers.size }) };
}
(async () => {
  const stable = harness(); await stable.click('startBtn'); stable.tick(4000);
  assert.equal(stable.stats().readyCount, 1); assert.equal(stable.stats().startCount, 1);
  assert.equal(stable.stats().frames, 2); // One preview loop, one acquisition loop.
  assert.ok(stable.cameras[0].rawData.length > 20);
  const recording = stable.cameras[0].rawData;
  assert.equal(stable.cameras[0].startMeasurement(60, () => {}), false);
  assert.equal(stable.cameras[0].rawData, recording);
  passed.push('Steady placement starts once; duplicate start cannot reset samples or multiply loops');

  const cancelled = harness(); await cancelled.click('startBtn');
  while (!cancelled.stats().readyCount) cancelled.tick(1000 / 60);
  await cancelled.click('cancelBtn2'); cancelled.tick(1000);
  assert.equal(cancelled.stats().startCount, 0); assert.equal(cancelled.stats().frames, 0);
  assert.equal(cancelled.stats().timers, 0); assert.equal(cancelled.stats().stoppedTracks, 1);
  passed.push('Cancel during readiness delay prevents measurement and releases all scheduled work');

  const retry = harness(); await retry.click('startBtn');
  while (!retry.stats().readyCount) retry.tick(1000 / 60);
  await retry.click('cancelBtn2'); await retry.click('startBtn'); retry.tick(4000);
  assert.equal(retry.stats().startCount, 1); assert.equal(retry.cameras.length, 2);
  assert.equal(retry.cameras[0].rawData.length, 0); assert.ok(retry.cameras[1].rawData.length > 20);
  passed.push('Retry cannot be started or overwritten by an earlier session callback');

  const late = harness({ deferPermission: true });
  const pendingStart = late.click('startBtn');
  await late.click('cancelBtn2'); late.grant(); await pendingStart; late.tick(4000);
  assert.equal(late.stats().startCount, 0); assert.equal(late.stats().frames, 0);
  assert.equal(late.stats().timers, 0); assert.equal(late.stats().stoppedTracks, 1);
  passed.push('A late camera permission response after Cancel is released without restarting UI');

  const lostDuringDelay = harness(); await lostDuringDelay.click('startBtn');
  while (!lostDuringDelay.stats().readyCount) lostDuringDelay.tick(1000 / 60);
  lostDuringDelay.cameras[0].extractRedMean = () => 100; lostDuringDelay.tick(1000);
  assert.equal(lostDuringDelay.cameras[0].rawData.length, 0);
  assert.equal(lostDuringDelay.stats().frames, 0); assert.equal(lostDuringDelay.stats().timers, 0);
  passed.push('Finger loss during the readiness delay leaves no recording or completion timer');

  const interrupted = harness(); await interrupted.click('startBtn'); interrupted.tick(4000);
  const firstCamera = interrupted.cameras[0]; assert.ok(firstCamera.rawData.length > 20);
  firstCamera.extractRedMean = () => 100; interrupted.tick(100);
  assert.equal(firstCamera.rawData.length, 0); assert.equal(interrupted.stats().frames, 0);
  assert.equal(interrupted.stats().timers, 0); assert.equal(interrupted.stats().stoppedTracks, 1);
  assert.match(interrupted.element('measuringStatus').textContent, /discarded/);
  assert.equal(interrupted.element('countdownNumber').textContent, 60);
  const restartedAt = interrupted.now(); await interrupted.click('resumeBtn'); interrupted.tick(4000);
  assert.equal(interrupted.cameras.length, 2); assert.equal(interrupted.stats().startCount, 2);
  assert.ok(interrupted.cameras[1].rawData.length > 20);
  assert.ok(interrupted.cameras[1].rawData.every(sample => sample.time >= restartedAt));
  assert.equal(firstCamera.rawData.length, 0);
  passed.push('Finger loss discards the entire recording; restart recalibrates a fresh continuous window');

  const api = stable.context.window.OvulunaPPG;
  const mapper = new api.PulseObservationMapper();
  for (const quality of ['poor', 'insufficient', 'unreliable', 'uncertain', 'unknown', undefined]) {
    assert.equal(mapper.analyze({ bpm: 90, hrv: 10, quality }).accepted, false);
  }
  assert.equal(mapper.analyze({ bpm: NaN, hrv: 10, quality: 'good' }).accepted, false);
  assert.equal(mapper.analyze({ bpm: 70, hrv: Infinity, quality: 'good' }).accepted, false);
  const accepted = mapper.analyze({ bpm: 70, hrv: 32, quality: 'good' });
  assert.equal(accepted.accepted, true); assert.equal(accepted.diagnosis, undefined); assert.equal(accepted.flags, undefined);
  passed.push('Only finite observations passing signal gates are accepted; no diagnostic flags are emitted');

  for (const quality of ['good', 'unreliable', 'uncertain']) {
    const result = harness(); await result.click('startBtn'); result.tick(4000);
    result.cameras[0].processor.process = () => ({ bpm: 70, hrv: 32, quality });
    result.cameras[0].stop(); result.tick(120);
    assert.equal(result.element('resultBPM').textContent, quality === 'good' ? 70 : '--');
    assert.equal(result.element('resultHRV').textContent, quality === 'good' ? 32 : '--');
    assert.equal(result.stats().writes, 0); assert.equal(result.stats().frames, 0); assert.equal(result.stats().timers, 0);
    assert.equal(result.stats().stoppedTracks, 1);
  }
  passed.push('Actual results page withholds rejected numbers, writes no baseline and releases camera/timers');

  const processor = new api.PPGProcessor();
  assert.equal(processor.calculateHRV([0, 1, 2, 3], [0, 1000, 2020, 3000]), 32);
  assert.equal(processor.calculateBPM([0, 1, 2, 3], [0, 1000, 2000, 3000]), 60);
  passed.push('Known beat timestamps retain correct BPM and rounded RMSSD arithmetic');
  console.log(JSON.stringify({ passed: passed.length, checks: passed, scope: 'Deterministic software behavior only; no clinical or hardware validation' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
