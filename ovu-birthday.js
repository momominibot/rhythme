/* Rhythme: her birthday week (Jamie, 21 Oct: "special birthday drop.. I think it's good to have some
 * heartfelt advise and motivation in life ... have the cute report sent as postcard").
 * Her birthday is a month and a day she may give in You. Optional, never a year, and no health screen reads it. On the
 * day the room greets her, a cake with balloons stands on her table for a week, and a postcard arrives once: three warm
 * lines chosen for this year, her own year in Rhythme in numbers that exist on this phone, and the party outfit to wear
 * (the Starlight gown when Plus is on). No hearts change hands: hearts are for logging. Nothing here reads anything into
 * her birth date; the same kind words go to everyone, picked afresh each year. Pure parts tested in tools/test-core.js. */
(function (root) {
  'use strict';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* a birthday is MM-DD: month 1 to 12, a day that month can have (29 February allowed); anything else, a year included, is refused */
  function clean(v) {
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(v == null ? '' : v).trim()); if (!m) return null;
    var mo = +m[1], d = +m[2]; if (mo < 1 || mo > 12 || d < 1 || d > DAYS_IN[mo - 1]) return null;
    return pad(mo) + '-' + pad(d);
  }
  function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  /* the birthday in a given year as an ISO date; 29 February falls on the 28th when the year has none */
  function dateIn(y, mmdd) { var mo = +mmdd.slice(0, 2), d = +mmdd.slice(3); if (mo === 2 && d === 29 && !leap(y)) d = 28; return y + '-' + pad(mo) + '-' + pad(d); }
  function dayNum(iso) { return Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000); }
  /* 0 on the day, 1 to 6 on the six days after (the cake's week), else -1; the week can cross a year end */
  function dayOf(today, mmdd) {
    mmdd = clean(mmdd); if (!mmdd || !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return -1;
    var y = +today.slice(0, 4), t = dayNum(today);
    for (var k = 0; k >= -1; k--) { var d = t - dayNum(dateIn(y + k, mmdd)); if (d >= 0 && d <= 6) return d; }
    return -1;
  }
  function isDay(today, mmdd) { return dayOf(today, mmdd) === 0; }
  /* the birthday year this week belongs to (a week that crosses New Year keeps the old year), or null outside the week */
  function yearOf(today, mmdd) { var d = dayOf(today, mmdd); if (d < 0) return null; var y = +today.slice(0, 4); return dayNum(today) - dayNum(dateIn(y, clean(mmdd))) >= 0 ? y : y - 1; }
  function text(mmdd) { mmdd = clean(mmdd); return mmdd ? (+mmdd.slice(3)) + ' ' + MONTHS[+mmdd.slice(0, 2) - 1] : ''; }

  /* the same warm words for everyone; three are picked by the year, so each birthday reads differently */
  var LINES = [
    'Another year of you. Not a finished version, a continuing one, and that is the good news.',
    'You do not have to earn rest. Tonight, let the day be enough.',
    'The small things you kept doing this year were not small. They were the year.',
    'Be as kind to yourself today as you would be to a friend on her birthday.',
    'Growing older is the one gift not everyone gets to open. Happy unwrapping.',
    'You are allowed to want things for yourself this year, and to say them out loud.',
    'Whatever this year held, you walked through it. Sit down, have cake.',
    'Nobody has your exact mix of people, places and mornings. Keep making it yours.',
    'Some wishes take years. Blow the candles out anyway.',
    'Your body carried you here. Thank it before you ask anything more of it.',
    'The next twelve months do not need a plan today. They need you rested and here.',
    'Look back only long enough to notice how far. Then face the cake.',
    'You are the reason someone’s day was lighter this year. Today, let that someone be you.',
    'Here is to the ordinary days ahead, which is where most of the good life hides.'
  ];
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pick(seed, n) {
    var r = rng(Number(seed) || 1), idx = LINES.map(function (_, i) { return i; }), out = [];
    while (out.length < Math.min(n || 3, idx.length)) out.push(idx.splice(Math.floor(r() * idx.length), 1)[0]);
    return out.map(function (i) { return LINES[i]; });
  }
  /* her year in numbers, from what this phone holds: dates with any note (deduped, within the year), pauses, hearts, harvest, friends */
  function stats(c) {
    c = c || {}; var seen = {}, days = 0;
    (c.dates || []).forEach(function (d) { if (typeof d !== 'string' || seen[d]) return; if (c.from && d < c.from) return; if (c.today && d > c.today) return; seen[d] = 1; days++; });
    var rows = [];
    if (days) rows.push({ n: days, label: days === 1 ? 'day with a note' : 'days with a note' });
    if (c.practices > 0) rows.push({ n: Math.floor(c.practices), label: c.practices === 1 ? 'pause with Erin' : 'pauses with Erin' });
    if (c.earned > 0) rows.push({ n: Math.floor(c.earned), label: 'hearts earned in all' });
    if (c.harvest > 0) rows.push({ n: Math.floor(c.harvest), label: c.harvest === 1 ? 'thing harvested' : 'things harvested' });
    if (c.friends > 0) rows.push({ n: Math.floor(c.friends), label: c.friends === 1 ? 'plaza friend' : 'plaza friends' });
    return rows;
  }
  function card(c) {
    c = c || {}; var mmdd = clean(c.mmdd), y = Number(c.year) || 0;
    return { title: 'Happy birthday' + (c.name ? ', ' + String(c.name).trim() : '') + '!', date: text(mmdd), year: y,
      lines: pick(y * 1000 + (mmdd ? +mmdd.slice(0, 2) * 31 + +mmdd.slice(3) : 0), 3), stats: stats(c), outfit: c.canGown ? 'gown' : 'party' };
  }

  var B = { MONTHS: MONTHS, LINES: LINES, clean: clean, dayOf: dayOf, isDay: isDay, yearOf: yearOf, text: text, pick: pick, stats: stats, card: card, dateIn: dateIn };
  root.OvuBirthday = B;

  /* ---------- the room ---------- */
  var R = root.OvuRoom, S = root.OvuStore, doc = root.document;
  if (!R || !S || !doc || !doc.createElement) return;
  var ART = R.ART, CAKE = 'prop-cake.webp', opened = false, tries = 0, tryT = 0;
  var POS = { room: { x: 66, y: 66.5, w: 7.6 } }; /* on the round table by the diary; other homes put it a step from where she stands */
  /* exported before the boot hook below: when the room has already booted (a cached reload), R.on('boot') runs the hook at once,
     and the hook's greeting refresh reads these through window.OvuBirthday (function declarations hoist, so this is safe here) */
  B.isToday = isToday; B.inWeek = inWeek; B.openCard = openCard; B.renderField = renderField; B.model = model;
  function mmdd() { return clean(S.profile().birthday); }
  function isToday() { var b = mmdd(); return !!b && isDay(S.today(), b); }
  function inWeek() { var b = mmdd(); return !!b && dayOf(S.today(), b) >= 0; }
  function canGown() { return !!(R.outfitLocked && !R.outfitLocked('gown')); }
  function year() { return yearOf(S.today(), mmdd()); }
  function model() {
    var today = S.today(), from = S.addDays ? S.addDays(today, -364) : null, dates = [];
    (S.TYPES || []).forEach(function (t) { try { S.list(t).forEach(function (e) { dates.push(e.date); }); } catch (e) { } });
    var l = root.OvuRewards ? root.OvuRewards.ledger() : {}, farm = root.OvuFarm && root.OvuFarm.farmState ? root.OvuFarm.farmState(S) : { harvest: {} };
    var harvest = Object.keys(farm.harvest || {}).reduce(function (a, k) { var n = Math.floor(Number(farm.harvest[k])); return a + (n > 0 ? n : 0); }, 0);
    var fs = null; try { fs = root.OvuFriends && root.OvuFriends.state ? root.OvuFriends.state() : null; } catch (e) { }
    var friends = fs && fs.inbox && fs.inbox.ok ? (fs.inbox.friends || []).length : 0;
    var practices = 0; try { practices = S.list('mindfulness', { from: from, to: today }).length; } catch (e) { }
    return card({ name: S.profile().name, mmdd: mmdd(), year: year(), dates: dates, from: from, today: today, practices: practices, earned: l.earned, harvest: harvest, friends: friends, canGown: canGown() });
  }
  function openCard() {
    var m = model(), outfitName = m.outfit === 'gown' ? 'Starlight gown' : 'party outfit';
    R.openSheet('birthday', m.title, 'A postcard from your room', 'cake',
      '<div class="bcard"><div class="bhead"><img src="' + ART + CAKE + '" alt=""><div><b>' + esc(m.title) + '</b><small>' + esc(m.date) + (m.year ? ' · ' + m.year : '') + '</small></div></div>' +
      '<div class="blines">' + m.lines.map(function (l) { return '<p class="bline">' + esc(l) + '</p>'; }).join('') + '</div>' +
      (m.stats.length ? '<span class="lbl">Your year in Rhythme</span><div class="bstats">' + m.stats.map(function (s) { return '<div><b>' + s.n + '</b><span>' + esc(s.label) + '</span></div>'; }).join('') + '</div>' : '<p class="help">Your first birthday here. Next year this card will carry your year in numbers.</p>') +
      '<p class="bfrom">With love from your room, and from Luna.</p></div>' +
      '<div class="row"><button type="button" class="btn primary" data-b="party"><span class="ms">checkroom</span>Wear the ' + esc(outfitName) + '</button><button type="button" class="btn soft" data-b="close"><span class="ms">favorite</span>Thank you</button></div>' +
      '<p class="help">The same warm words go to everyone on their birthday, picked afresh each year. The numbers are yours, from this phone only. Nothing here reads anything into your birth date, and no hearts are involved.</p>');
    var bodyEl = doc.getElementById('sheetBody'); if (!bodyEl) return; /* a fresh node for every sheet, so this listener dies with the card */
    bodyEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b) return;
      if (b.dataset.b === 'party') { if (R.setOutfit) R.setOutfit(m.outfit); if (R.chime) R.chime('save'); if (R.toast) R.toast('Dressed for the day. Happy birthday.', 'cake'); R.closeSheet(); }
      else { if (R.chime) R.chime('tap'); R.closeSheet(); }
    });
  }
  /* once a birthday: the postcard opens by itself the first time the room is free that day */
  function maybeOpen() {
    if (opened || !isToday()) return;
    var y = year(), st = S.state().birthday || {}; if (st.shown === y) { opened = true; return; }
    if (R.busy()) { if (tries++ < 12) { root.clearTimeout(tryT); tryT = root.setTimeout(maybeOpen, 900); } return; }
    markShown(y); openCard();
  }
  function markShown(y) { opened = true; try { S.setState({ birthday: { shown: y } }); } catch (e) { } }
  /* the cake on her table for the week; props re-render clears the wrap, so it is drawn again on every props event */
  function drawCake(L) {
    var wrap = R.els.props; if (!wrap) return;
    Array.prototype.slice.call(wrap.querySelectorAll('.prop.cake')).forEach(function (el) { el.remove(); });
    if (!inWeek() || !L || (R.visiting && R.visiting())) return;
    var home = R.homeId ? R.homeId() : 'room'; if (L.id !== home) return;
    var p = POS[L.id] || (L.home ? { x: L.home.x + 14, y: L.home.y - 2, w: 7 } : null); if (!p) return;
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'prop event cake'; b.style.left = p.x + '%'; b.style.top = p.y + '%'; b.style.width = p.w + '%';
    b.setAttribute('aria-label', 'Birthday cake. Tap to read your postcard.'); b.innerHTML = '<img src="' + ART + CAKE + '" alt="">';
    b.addEventListener('click', function (e) { e.stopPropagation(); if (R.chime) R.chime('tap'); openCard(); });
    wrap.appendChild(b);
  }
  /* the field in You: a month and a day, or none */
  function renderField(el) {
    if (!el) return;
    var cur = mmdd(), mo = cur ? +cur.slice(0, 2) : 0, d = cur ? +cur.slice(3) : 0;
    el.innerHTML = '<div class="field byou"><span class="lbl" id="bLbl">Your birthday (optional)</span><div class="byrow" role="group" aria-labelledby="bLbl">' +
      '<select class="input" id="bMonth" aria-label="Month"><option value="0">Month</option>' + MONTHS.map(function (n, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === mo ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
      '<select class="input" id="bDay" aria-label="Day"><option value="0">Day</option>' + Array.apply(null, Array(31)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === d ? ' selected' : '') + '>' + (i + 1) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn soft" id="bSave"><span class="ms">check</span>Save</button>' + (cur ? '<button type="button" class="btn ghost" id="bClear">Remove</button>' : '') + '</div>' +
      '<p class="help" id="bHelp">' + (cur ? 'Kept: ' + esc(text(cur)) + '. ' : '') + 'A month and a day only, kept on this phone. On the day: a greeting, a cake on your table for the week, and a postcard. Nothing else uses it.</p></div>';
    var save = function (v) { try { S.setProfile({ birthday: v }); } catch (e) { if (R.toast) R.toast('Could not save that on this device.', 'error'); return; } if (R.updateGreeting) R.updateGreeting(); if (R.renderProps) R.renderProps(); opened = false; tries = 0; renderField(el); };
    doc.getElementById('bSave').addEventListener('click', function () {
      var v = clean(doc.getElementById('bMonth').value + '-' + doc.getElementById('bDay').value);
      if (!v) { var h = doc.getElementById('bHelp'); if (h) h.textContent = 'Choose a month and a day that month has.'; return; }
      save(v); if (R.chime) R.chime('save'); if (R.toast) R.toast('Kept. ' + text(v) + ' is yours.', 'cake');
      if (isToday()) { markShown(year()); openCard(); } /* her birthday is today: the card replaces the You sheet straight away */
    });
    var cl = doc.getElementById('bClear'); if (cl) cl.addEventListener('click', function () { save(null); if (R.chime) R.chime('tap'); if (R.toast) R.toast('Removed.', 'cake'); });
  }
  R.on('boot', function () {
    R.on('props', drawCake);
    R.on('layout', function () { drawCake(R.layout()); });
    drawCake(R.layout()); /* the first props render happened before this hook was in place */
    if (isToday() && R.updateGreeting) R.updateGreeting(); /* the boot greeting ran before this module loaded */
    S.subscribe(function () { if (isToday()) maybeOpen(); });
    maybeOpen();
  });
})(typeof window !== 'undefined' ? window : this);
