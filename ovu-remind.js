/* Reminders: wind down for sleep, drink water, move, breathe, or anything you
 * name yourself. Everything is stored on the device. Reminders fire while the
 * app is open or installed to the home screen; for phones that limit web
 * notifications they can also be exported as a calendar file with alarms. */
(function (root) {
  'use strict';
  var KEY = 'ovumind_reminders_v1';
  var ALL = [0, 1, 2, 3, 4, 5, 6], WEEK = [1, 2, 3, 4, 5];
  var TEMPLATES = [
    { kind: 'sleep', label: 'Wind down for sleep', icon: 'bedtime', times: ['22:30'], days: ALL, note: 'Dim the lights, put the phone away, then tap the bed when you lie down.' },
    { kind: 'water', label: 'Drink some water', icon: 'water_drop', times: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'], days: ALL, note: 'A glass now. Small sips through the day beat one big bottle at night.' },
    { kind: 'move', label: 'Stand up and move', icon: 'directions_walk', times: ['10:30', '14:30', '16:30'], days: WEEK, note: 'Two minutes of walking or stretching, shoulders down.' },
    { kind: 'breathe', label: 'Two minutes of breathing', icon: 'air', times: ['14:00'], days: ALL, note: 'Open the mat and let Erin or the orb guide you.' }
  ];
  var ICONS = ['notifications', 'bedtime', 'water_drop', 'directions_walk', 'air', 'self_improvement', 'medication', 'restaurant', 'favorite', 'spa', 'wb_sunny', 'local_cafe'];

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { items: [], fired: {} }; } catch (e) { return { items: [], fired: {} }; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); return d; }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function valid(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

  function list() { return load().items; }
  function get(id) { return list().filter(function (x) { return x.id === id; })[0] || null; }
  function upsert(item) {
    var d = load();
    item.id = item.id || uid();
    item.label = String(item.label || '').trim().slice(0, 60) || 'Reminder';
    item.icon = ICONS.indexOf(item.icon) > -1 ? item.icon : 'notifications';
    item.times = (item.times || []).filter(valid).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
    item.days = (item.days || []).map(Number).filter(function (x) { return x >= 0 && x <= 6; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    item.note = String(item.note || '').trim().slice(0, 160);
    item.on = item.on !== false;
    if (!item.times.length) throw new Error('Add at least one time.');
    if (!item.days.length) throw new Error('Pick at least one day.');
    var i = -1; d.items.forEach(function (x, k) { if (x.id === item.id) i = k; });
    if (i > -1) d.items[i] = item; else d.items.push(item);
    save(d); return item;
  }
  function remove(id) { var d = load(); d.items = d.items.filter(function (x) { return x.id !== id; }); save(d); }
  function toggle(id, on) { var d = load(); d.items.forEach(function (x) { if (x.id === id) x.on = on === undefined ? !x.on : !!on; }); save(d); }
  function fromTemplate(kind) {
    var t = TEMPLATES.filter(function (x) { return x.kind === kind; })[0];
    if (t) return { id: null, kind: t.kind, label: t.label, icon: t.icon, times: t.times.slice(), days: t.days.slice(), note: t.note, on: true };
    return { id: null, kind: 'custom', label: '', icon: 'notifications', times: ['09:00'], days: ALL.slice(), note: '', on: true };
  }
  function nextFor(item) {
    /* next occurrence as a Date, or null */
    if (!item.on || !item.times.length || !item.days.length) return null;
    var now = new Date();
    for (var add = 0; add < 8; add++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
      if (item.days.indexOf(day.getDay()) < 0) continue;
      for (var i = 0; i < item.times.length; i++) {
        var hm = item.times[i].split(':'), at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(hm[0]), Number(hm[1]));
        if (at > now) return at;
      }
    }
    return null;
  }

  /* ---------- notifications ---------- */
  function supported() { return 'Notification' in root; }
  function permission() { return supported() ? Notification.permission : 'unsupported'; }
  function requestPermission() { if (!supported()) return Promise.resolve('unsupported'); try { return Promise.resolve(Notification.requestPermission()); } catch (e) { return Promise.resolve('denied'); } }
  function standalone() { return root.matchMedia && root.matchMedia('(display-mode: standalone)').matches || root.navigator.standalone === true; }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function notify(title, body, tag) {
    if (permission() !== 'granted') return Promise.resolve(false);
    var opts = { body: body || '', tag: tag || 'ovumind', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/badge-96.png', renotify: true, data: { url: 'room.html' } };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      return navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.showNotification) return reg.showNotification(title, opts).then(function () { return true; });
        try { new Notification(title, opts); return true; } catch (e) { return false; }
      }).catch(function () { try { new Notification(title, opts); return true; } catch (e) { return false; } });
    }
    try { new Notification(title, opts); return Promise.resolve(true); } catch (e) { return Promise.resolve(false); }
  }

  /* ---------- scheduler (runs while the page lives) ---------- */
  var timer = null, onFire = null;
  function due() {
    var d = load(), now = new Date(), hm = pad(now.getHours()) + ':' + pad(now.getMinutes()), day = now.getDay(), today = isoDate(now), hits = [], changed = false;
    d.items.forEach(function (it) {
      if (!it.on || it.days.indexOf(day) < 0) return;
      it.times.forEach(function (t) {
        var k = it.id + '@' + t;
        if (t === hm && d.fired[k] !== today) { d.fired[k] = today; hits.push({ item: it, time: t }); changed = true; }
      });
    });
    if (changed) { Object.keys(d.fired).forEach(function (k) { if (d.fired[k] !== today) delete d.fired[k]; }); save(d); }
    return hits;
  }
  function check() { due().forEach(function (h) { notify(h.item.label, h.item.note || 'From your Ovumind room', 'ovumind-' + h.item.id); if (onFire) onFire(h); }); }
  function start(cb) {
    onFire = cb || null;
    if (timer) clearInterval(timer);
    timer = setInterval(check, 20000); check();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  }

  /* ---------- calendar export (.ics with alarms) ---------- */
  function escIcs(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function ics() {
    var d = load(), BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], now = new Date();
    var stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ovumind//Reminders//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Ovumind reminders'];
    d.items.forEach(function (it) {
      if (!it.on) return;
      it.times.forEach(function (t) {
        lines.push('BEGIN:VEVENT', 'UID:' + it.id + '-' + t.replace(':', '') + '@ovumind', 'DTSTAMP:' + stamp,
          'DTSTART:' + isoDate(now).replace(/-/g, '') + 'T' + t.replace(':', '') + '00', 'DURATION:PT5M',
          'SUMMARY:' + escIcs(it.label), 'DESCRIPTION:' + escIcs(it.note || 'From your Ovumind room'),
          'RRULE:FREQ=WEEKLY;BYDAY=' + it.days.map(function (x) { return BY[x]; }).join(','),
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escIcs(it.label), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
      });
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  function download() {
    var blob = new Blob([ics()], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'ovumind-reminders.ics'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  root.OvuRemind = { TEMPLATES: TEMPLATES, ICONS: ICONS, list: list, get: get, upsert: upsert, remove: remove, toggle: toggle, fromTemplate: fromTemplate, nextFor: nextFor, supported: supported, permission: permission, requestPermission: requestPermission, standalone: standalone, isIOS: isIOS, notify: notify, start: start, check: check, ics: ics, download: download, valid: valid };
})(window);
