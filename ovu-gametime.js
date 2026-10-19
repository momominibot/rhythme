/* Rhythme game calendar. One clock, the real one: the room's day and night, the stores' hours, the pets' bedtime and
 * Erin's morning and evening scripts all follow the phone's real time, and crops grow by real days, so the calendar
 * only names what the real clock already is: the day count since she first played, the season of the month, the hour.
 * (The build prompt proposed a second, faster in-game clock; that is a decision for Jamie, recorded in
 * docs/design/2026-10-19-life-sim-inventory.md. This module is where it would live.)
 * Nothing here writes a diary entry; state.game holds only the first day played. */
(function (root) {
  'use strict';
  var S = root.OvuStore, doc = root.document;
  var SEASONS = { winter: [12, 1, 2], spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11] };
  var ICONS = { winter: 'ac_unit', spring: 'local_florist', summer: 'wb_sunny', autumn: 'eco' };
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function game() { return (S && S.state().game) || null; }
  function ensure() {
    var g = game();
    if (!g || !g.firstDay) { g = Object.assign({}, g || {}, { firstDay: dayKey() }); if (S) S.setState({ game: g }); }
    return g;
  }
  function day(d) { var g = ensure(); return Math.max(1, (S ? S.diffDays(g.firstDay, dayKey(d)) : 0) + 1); } /* never below 1, even when the clock is set before the first day */
  function season(d) {
    var m = (d || new Date()).getMonth() + 1, out = 'spring';
    Object.keys(SEASONS).forEach(function (k) { if (SEASONS[k].indexOf(m) > -1) out = k; });
    return out;
  }
  function hour(d) { d = d || new Date(); return d.getHours() + d.getMinutes() / 60; }
  function hourLabel(d) { d = d || new Date(); var h = d.getHours(), m = d.getMinutes(); var h12 = h % 12 || 12; return h12 + (m ? ':' + pad(m) : '') + ' ' + (h < 12 ? 'am' : 'pm'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function label(d) { return 'Day ' + day(d) + ' · ' + cap(season(d)) + ' · ' + hourLabel(d); }
  /* new-day watchers: crops, weeds and stamina listen for the date to turn while the app is open or on its return */
  var last = dayKey(), fns = [];
  function check() {
    var k = dayKey(); if (k === last) return;
    var prev = last; last = k;
    fns.slice().forEach(function (f) { try { f(k, prev); } catch (e) { } });
  }
  if (root.setInterval) root.setInterval(check, 30000);
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', function () { if (!doc.hidden) check(); });
  if (root.addEventListener) root.addEventListener('pageshow', check); /* WebKit restores pages from its cache without a reload */
  root.OvuGameTime = { SEASONS: SEASONS, ICONS: ICONS, dayKey: dayKey, day: day, season: season, hour: hour, hourLabel: hourLabel, label: label, onNewDay: function (f) { fns.push(f); return function () { fns = fns.filter(function (x) { return x !== f; }); }; }, check: check };
})(typeof window !== 'undefined' ? window : this);
