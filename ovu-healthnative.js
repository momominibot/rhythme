/* Rhythme direct health read: Apple Health (HealthKit) on an iPhone, through the native shell only.
 *
 * A web page cannot reach HealthKit, so this module does nothing in a browser. Inside the Capacitor iOS
 * shell, the app registers a small read-only plugin, RhythmeHealth (ios/App/App/RhythmeHealthPlugin.swift),
 * which hands back raw HealthKit samples. Each sample is fed into OvuHealth's Apple scanner exactly as a
 * <Record> from export.xml would be, so a direct read is just another source: the same kinds() list, the
 * same picker with nothing ticked, the same plan() and apply(), and source 'apple-health' on every entry.
 *
 * It is switched off unless OVU_CONFIG.nativeHealth.apple is true (ovu-config.js). With the switch off, or
 * outside the iOS shell, available() is false and nothing is shown or called.
 *
 * What it reads, and only for the window asked (90 days by default): sleep, menstrual flow and spotting
 * between periods. It never asks to write to Health. HealthKit never tells an app whether reading was
 * allowed (a refusal looks the same as no data), so an empty read is reported as "nothing came back",
 * never as "you have no data". The pure parts are unit-tested in tools/test-core.js with a fake plugin. */
(function (root) {
  'use strict';
  var NAME = 'RhythmeHealth';
  var DAY = 86400000;
  /* the plugin's own names for the three types; the Swift side accepts nothing else */
  var READS = [
    { id: 'sleep', label: 'Sleep', note: 'Time asleep and in bed, from your watch or iPhone' },
    { id: 'menstrualFlow', label: 'Period days', note: 'Flow as you or another app recorded it' },
    { id: 'intermenstrualBleeding', label: 'Spotting between periods', note: 'Shown as spotting; it never starts a new cycle' }
  ];
  var TYPE_IDS = READS.map(function (r) { return r.id; });

  function enabled() { var c = root.OVU_CONFIG; return !!(c && c.nativeHealth && c.nativeHealth.apple === true); }
  /* the shell's bridge, when this page runs inside the iOS app and the plugin is registered */
  function bridge() {
    var C = root.Capacitor;
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
    if (typeof C.getPlatform !== 'function' || C.getPlatform() !== 'ios') return null;
    if (!(C.PluginHeaders || []).some(function (h) { return h && h.name === NAME; })) return null;
    if (typeof C.nativePromise !== 'function') return null;
    return { call: function (method, opts) { return C.nativePromise(NAME, method, opts || {}); } };
  }
  function available() { return enabled() && !!bridge(); }

  function need() {
    if (!enabled()) return Promise.reject(new Error('Apple Health is not switched on in this build.'));
    var b = bridge(); if (!b) return Promise.reject(new Error('Apple Health can only be reached from the Rhythme app on an iPhone.'));
    return Promise.resolve(b);
  }
  function friendly(err) {
    var m = err && err.message ? err.message : String(err || '');
    if (/not available/i.test(m)) return new Error('Health data is not available on this device (an iPad without the Health app, or a managed device).');
    return new Error(m || 'Apple Health did not answer.');
  }

  /* shows Apple's own sheet for the three read types. It resolves once the sheet is dealt with; it does not
   * mean reading was allowed, because HealthKit keeps that private. */
  function connect() {
    return need().then(function (b) { return b.call('isAvailable').then(function (r) {
      if (!r || r.available !== true) throw new Error('not available');
      return b.call('requestAuthorization', { types: TYPE_IDS });
    }); }).then(function (r) { return { requested: !!(r && r.requested) }; }, function (e) { throw friendly(e); });
  }

  /* pure: samples from the plugin -> the same result shape OvuHealth.importFiles gives for export.xml */
  function fromSamples(samples, win) {
    var H = root.OvuHealth; if (!H || !H.appleScanner) throw new Error('The import helper did not load.');
    var sc = H.appleScanner(), byType = {};
    (samples || []).forEach(function (s) { if (s && s.type) byType[s.type] = (byType[s.type] || 0) + 1; sc.record(s); });
    var res = sc.result();
    res.origin = 'healthkit';
    res.window = win || null;
    res.counts.byType = byType;
    res.empty = !(res.sleep.length || res.period.length || res.spotting.length);
    return res;
  }

  /* reads each type for the window, one call per type, then maps. opts: {days (1..366, default 90), now (ms)} */
  function read(opts) {
    opts = opts || {};
    var days = Math.max(1, Math.min(366, Math.round(Number(opts.days) || 90)));
    var to = isFinite(opts.now) ? Number(opts.now) : Date.now(), from = to - days * DAY;
    var progress = opts.onProgress || function () { };
    return need().then(function (b) {
      var all = [], i = 0;
      function next() {
        if (i >= READS.length) return Promise.resolve();
        var r = READS[i++]; progress(i / READS.length, 'Reading ' + r.label.toLowerCase());
        return b.call('readSamples', { type: r.id, from: from, to: to }).then(function (out) {
          var list = out && Array.isArray(out.samples) ? out.samples : [];
          for (var k = 0; k < list.length; k++) all.push(list[k]);
          return next();
        });
      }
      return next().then(function () { return fromSamples(all, { from: from, to: to, days: days }); });
    }).catch(function (e) { throw friendly(e); });
  }

  function connectAndRead(opts) { return connect().then(function () { return read(opts); }); }

  root.OvuHealthNative = { NAME: NAME, READS: READS, enabled: enabled, available: available, bridge: bridge, connect: connect, read: read, connectAndRead: connectAndRead, fromSamples: fromSamples };
})(typeof window !== 'undefined' ? window : this);
