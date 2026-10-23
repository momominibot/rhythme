/* Rhythme direct health read: Apple Health (HealthKit) on an iPhone and Health Connect on Android,
 * through the native app shells only.
 *
 * A web page cannot reach HealthKit or Health Connect, so this module does nothing in a browser. Inside a
 * Capacitor shell the app registers a small read-only plugin named RhythmeHealth
 * (ios/App/App/RhythmeHealthPlugin.swift, android/app/src/main/java/.../RhythmeHealthPlugin.kt).
 * Every record that comes back is turned into the record an Apple Health export would hold and fed into
 * OvuHealth's Apple scanner, so a direct read is just another source: the same kinds() list, the same
 * picker with nothing ticked, the same plan() and apply(). iPhone entries carry source 'apple-health'
 * like the export file; Health Connect entries carry 'google-fit', the source Google's data already uses,
 * so the store, journal, rewards and dashboards treat them the same without new rules.
 *
 * Each platform has its own switch, OVU_CONFIG.nativeHealth.apple and .android (ovu-config.js). With its
 * switch off, or outside its shell, available() is false and nothing is shown or called.
 *
 * What it reads, and only for the window asked (90 days by default): sleep, period days and spotting
 * between periods. It never asks to write. HealthKit never tells an app whether reading was allowed (a
 * refusal looks the same as no data); Health Connect does, so on Android the types that were not allowed
 * are not read and the person is told which. Health Connect shows apps only the last 30 days unless the
 * person also allows past data, and that is said too. The pure parts are tested in tools/test-core.js. */
(function (root) {
  'use strict';
  var NAME = 'RhythmeHealth';
  var DAY = 86400000;
  /* the plugins' own names for the three types; the native side accepts nothing else */
  var READS = [
    { id: 'sleep', label: 'Sleep', note: 'Time asleep and in bed, from your watch, ring or phone' },
    { id: 'menstrualFlow', label: 'Period days', note: 'Flow as you or another app recorded it' },
    { id: 'intermenstrualBleeding', label: 'Spotting between periods', note: 'Shown as spotting; it never starts a new cycle' }
  ];
  var TYPE_IDS = READS.map(function (r) { return r.id; });
  var PLATFORMS = {
    ios: { flag: 'apple', name: 'Apple Health', device: 'this iPhone', origin: 'healthkit', manage: 'Settings, then Health, then Data Access and Devices, then Rhythme' },
    android: { flag: 'android', name: 'Health Connect', device: 'this phone', origin: 'health-connect', manage: 'the Health Connect app (or Settings, then Health Connect), then App permissions, then Rhythme' }
  };

  /* the shell's platform when this page runs inside a Rhythme app that registered the plugin */
  function shell() {
    var C = root.Capacitor;
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
    var p = typeof C.getPlatform === 'function' ? C.getPlatform() : null; if (!PLATFORMS[p]) return null;
    if (!(C.PluginHeaders || []).some(function (h) { return h && h.name === NAME; })) return null;
    if (typeof C.nativePromise !== 'function') return null;
    return { platform: p, call: function (method, opts) { return C.nativePromise(NAME, method, opts || {}); } };
  }
  function enabledFor(p) { var c = root.OVU_CONFIG, f = PLATFORMS[p] && PLATFORMS[p].flag; return !!(f && c && c.nativeHealth && c.nativeHealth[f] === true); }
  function bridge() { var b = shell(); return b && enabledFor(b.platform) ? b : null; }
  function available() { return !!bridge(); }
  function info() { var b = shell(); return b ? PLATFORMS[b.platform] : PLATFORMS.ios; }
  function enabled() { var b = shell(); return b ? enabledFor(b.platform) : false; }

  function need() {
    var b = shell();
    if (!b) return Promise.reject(new Error('Health data can only be read from the Rhythme app on a phone.'));
    if (!enabledFor(b.platform)) return Promise.reject(new Error(PLATFORMS[b.platform].name + ' is not switched on in this build.'));
    return Promise.resolve(b);
  }
  function friendly(err, p) {
    var m = err && err.message ? err.message : String(err || '');
    if (/not available/i.test(m)) return new Error(p === 'android' ? 'Health Connect is not on this phone yet. Install or update it from Google Play, then try again.' : 'Health data is not available on this device (an iPad without the Health app, or a managed device).');
    return new Error(m || 'The health app did not answer.');
  }

  /* shows the platform's own permission screen for the three read types. On iOS it only means the sheet was
   * dealt with; on Android `granted` lists the types the person allowed and `history` whether past data was. */
  function connect() {
    var plat = null;
    return need().then(function (b) {
      plat = b.platform;
      return b.call('isAvailable').then(function (r) {
        if (!r || r.available !== true) throw new Error('not available');
        return b.call('requestAuthorization', { types: TYPE_IDS });
      });
    }).then(function (r) {
      r = r || {};
      var granted = Array.isArray(r.granted) ? r.granted.filter(function (t) { return TYPE_IDS.indexOf(t) > -1; }) : null;
      return { platform: plat, requested: !!r.requested, granted: plat === 'android' ? (granted || []) : null, history: plat === 'android' ? r.history === true : null };
    }, function (e) { throw friendly(e, plat); });
  }

  /* ---------- Health Connect records -> the records an Apple Health export holds ----------
   * Sleep stages (SleepSessionRecord.STAGE_TYPE_*): 0 unknown, 1 awake, 2 sleeping, 3 out of bed, 4 light,
   * 5 deep, 6 REM, 7 awake in bed. Asleep kinds keep their Apple equivalents (2 asleep, 4 core, 5 deep,
   * 6 REM); awake kinds are dropped like Apple's awake; unknown counts as time in bed. A session with no
   * stages is kept as time in bed, so it is labelled as such rather than claimed as sleep.
   * Flow (MenstruationFlowRecord.FLOW_*): 0 unknown, 1 light, 2 medium, 3 heavy. A MenstruationPeriodRecord
   * (a span some apps write instead of daily flow) marks each day it covers with flow not recorded; a day
   * with recorded flow keeps the stronger value. */
  var HC_STAGE = { 0: '0', 1: '2', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '2' };
  var HC_FLOW = { 0: '1', 1: '2', 2: '3', 3: '4' };
  var MAX_PERIOD_DAYS = 20;
  function offsetOf(s) { var m = /(Z|[+-]\d{2}:?\d{2})$/.exec(String(s || '')); return m ? m[1] : 'Z'; }
  function fromHealthConnect(records) {
    var H = root.OvuHealth, T = H.HK, out = [];
    (records || []).forEach(function (r) {
      if (!r || typeof r.record !== 'string') return;
      if (r.record === 'SleepSession') {
        var st = Array.isArray(r.stages) ? r.stages : [];
        if (!st.length) { out.push({ type: T.sleep, startDate: r.start, endDate: r.end, value: '0' }); return; }
        st.forEach(function (s) { var v = HC_STAGE[s && s.stage]; if (v !== undefined) out.push({ type: T.sleep, startDate: s.start, endDate: s.end, value: v }); });
      } else if (r.record === 'MenstruationFlow') {
        var f = HC_FLOW[r.flow]; if (f !== undefined) out.push({ type: T.menstrualFlow, startDate: r.time, endDate: r.time, value: f });
      } else if (r.record === 'MenstruationPeriod') {
        var a = H.parseStamp(r.start), b = H.parseStamp(r.end); if (!a || !b || b.wall < a.wall) return;
        var off = offsetOf(r.start), d = H.wallDate(a.wall), last = H.wallDate(b.wall);
        /* a span ending exactly at midnight does not include that day */
        if (H.wallHM(b.wall) === '00:00' && last > d) last = H.wallDate(b.wall - DAY);
        for (var i = 0; i < MAX_PERIOD_DAYS && d <= last; i++) {
          out.push({ type: T.menstrualFlow, startDate: d + 'T12:00:00' + off, endDate: d + 'T12:00:00' + off, value: '1' });
          d = H.wallDate(Date.parse(d + 'T00:00:00Z') + DAY);
        }
      } else if (r.record === 'IntermenstrualBleeding') {
        out.push({ type: T.intermenstrualBleeding, startDate: r.time, endDate: r.time, value: '0' });
      }
    });
    return out;
  }

  /* pure: export-shaped samples -> the same result shape OvuHealth.importFiles gives for export.xml.
   * opts.platform 'android' marks it as Health Connect: source google-fit, its own label and origin. */
  function fromSamples(samples, win, opts) {
    var H = root.OvuHealth; if (!H || !H.appleScanner) throw new Error('The import helper did not load.');
    opts = opts || {}; var p = PLATFORMS[opts.platform] || PLATFORMS.ios;
    var sc = H.appleScanner(), byType = {};
    (samples || []).forEach(function (s) { if (s && s.type) byType[s.type] = (byType[s.type] || 0) + 1; sc.record(s); });
    var res = sc.result();
    if (opts.platform === 'android') res.source = H.SOURCE.google;
    res.origin = p.origin;
    res.sourceLabel = p.name;
    res.window = win || null;
    res.counts.byType = byType;
    res.empty = !(res.sleep.length || res.period.length || res.spotting.length);
    return res;
  }

  /* reads each allowed type for the window, one call per type, then maps.
   * opts: {days (1..366, default 90), now (ms), granted (Android: the types allowed), history (Android)} */
  function read(opts) {
    opts = opts || {};
    var days = Math.max(1, Math.min(366, Math.round(Number(opts.days) || 90)));
    var to = isFinite(opts.now) ? Number(opts.now) : Date.now(), from = to - days * DAY;
    var progress = opts.onProgress || function () { };
    var plat = null;
    return need().then(function (b) {
      plat = b.platform;
      var want = READS.filter(function (r) { return !Array.isArray(opts.granted) || opts.granted.indexOf(r.id) > -1; });
      var all = [], i = 0;
      function next() {
        if (i >= want.length) return Promise.resolve();
        var r = want[i++]; progress(i / Math.max(1, want.length), 'Reading ' + r.label.toLowerCase());
        return b.call('readSamples', { type: r.id, from: from, to: to }).then(function (out) {
          var list = plat === 'android' ? fromHealthConnect(out && out.records) : (out && Array.isArray(out.samples) ? out.samples : []);
          for (var k = 0; k < list.length; k++) all.push(list[k]);
          return next();
        });
      }
      return next().then(function () {
        var res = fromSamples(all, { from: from, to: to, days: days }, { platform: plat });
        if (plat === 'android') { res.granted = Array.isArray(opts.granted) ? opts.granted.slice() : null; res.history = opts.history === true; res.seenDays = res.history ? days : Math.min(days, 30); }
        return res;
      });
    }).catch(function (e) { throw friendly(e, plat); });
  }

  function connectAndRead(opts) {
    opts = opts || {};
    return connect().then(function (c) {
      if (c.platform === 'android' && !c.granted.length) {
        var none = fromSamples([], null, { platform: 'android' }); none.granted = []; none.history = c.history; return none;
      }
      return read(Object.assign({}, opts, c.platform === 'android' ? { granted: c.granted, history: c.history } : {}));
    });
  }

  root.OvuHealthNative = { NAME: NAME, READS: READS, PLATFORMS: PLATFORMS, enabled: enabled, available: available, info: info, bridge: bridge, connect: connect, read: read, connectAndRead: connectAndRead, fromSamples: fromSamples, fromHealthConnect: fromHealthConnect };
})(typeof window !== 'undefined' ? window : this);
