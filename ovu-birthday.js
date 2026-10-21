/* Rhythme: her birthday (Jamie, 21 Oct: "I just want a birthing wishing with a good life advice direction based on the
 * birthdate entered during onboarding"; then, on the year: "many other apps can ask for birthdate").
 * Her birthday is a month and a day she may give in the intro (Getting to know you) or in You, with the year if she
 * chooses. A year that would make her under 18 is refused, since Rhythme is for adults. It stays on this phone (ovu-sync.js
 * keeps both fields out of the cloud copy) and no health screen reads it. On the day the room greets her, a cake with
 * balloons stands on her table for a week, and a card opens once: one warm wish; with the year, who she is from the day
 * she was born (the BaZi Day Master, in the words of Jamie's YourDigitalDNA); and a direction for the year ahead read the
 * Pythagorean way (the digits of her birth month, her birth day and the year the birthday falls in, added up to a number
 * from 1 to 9, so it changes every birthday). The card says how both are read and that others born on the same day share
 * them. No hearts change hands: hearts are for logging. Pure parts tested in tools/test-core.js. */
(function (root) {
  'use strict';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var ADULT = 18, OLDEST = 100;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* a birthday is MM-DD: month 1 to 12, a day that month can have (29 February allowed); anything else, a year included, is refused */
  function clean(v) {
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(String(v == null ? '' : v).trim()); if (!m) return null;
    var mo = +m[1], d = +m[2]; if (mo < 1 || mo > 12 || d < 1 || d > DAYS_IN[mo - 1]) return null;
    return pad(mo) + '-' + pad(d);
  }
  function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  /* the birth year, when she gives one: a whole year that has her birthday in it and makes her an adult today; '' when it is fine */
  function yearError(y, mmdd, today) {
    mmdd = clean(mmdd); y = Number(y);
    if (!mmdd) return 'Choose the month and the day first.';
    if (!(Math.floor(y) === y) || y < 1900 || !/^\d{4}-\d{2}-\d{2}$/.test(String(today || '')) || y > +today.slice(0, 4)) return 'Choose a year from the list.';
    if (mmdd === '02-29' && !leap(y)) return 'That year has no 29 February. Check the year, or leave it out.';
    var age = +today.slice(0, 4) - y - (today.slice(5) < mmdd ? 1 : 0);
    if (age < ADULT) return 'Rhythme is for adults, 18 and over. Check the year, or leave it out.';
    return '';
  }
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

  /* the wish: the same warm words for everyone, one picked by the year and the date, so each birthday reads differently */
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
    while (out.length < Math.min(n || 1, idx.length)) out.push(idx.splice(Math.floor(r() * idx.length), 1)[0]);
    return out.map(function (i) { return LINES[i]; });
  }
  /* the Pythagorean personal year that begins on this birthday: the digits of the birth month, the birth day and the year the
     birthday falls in, added and reduced to 1 to 9 (21 October in 2026: 1+0 + 2+1 + 2+0+2+6 = 14, and 1+4 = 5) */
  function digits(n) { return String(Math.abs(Math.floor(Number(n) || 0))).split('').reduce(function (a, c) { return a + (+c); }, 0); }
  function personalYear(mmdd, y) {
    mmdd = clean(mmdd); y = Math.floor(Number(y)); if (!mmdd || !(y > 0)) return 0;
    var n = digits(+mmdd.slice(0, 2)) + digits(+mmdd.slice(3)) + digits(y);
    while (n > 9) n = digits(n);
    return n;
  }
  /* the direction for each personal year, in the classic themes of the nine years; an invitation and one small first step,
     never a prediction, never about her health */
  var YEARS = {
    1: { title: 'A year for beginnings', text: 'Start the thing you keep circling back to. It does not need to be big, only yours, and you do not need to feel ready first.', step: 'Write down one first step, and take it this week.' },
    2: { title: 'A year for patience and people', text: 'What matters this year grows slowly and grows better shared. Let people help, and let some things take their time.', step: 'Say yes the next time someone offers to help.' },
    3: { title: 'A year for your voice', text: 'Make things, say things and share them. Your ideas and your joy are allowed to take up space.', step: 'Share one thing you made, or one thing you think.' },
    4: { title: 'A year for foundations', text: 'Small routines, kept kindly, become the floor you stand on. Steady is the point this year, not a compromise.', step: 'Choose one small routine and keep it for a month.' },
    5: { title: 'A year for change', text: 'Leave a door open for the unexpected: a new place, a new idea, a new way of doing an old thing. You adapt better than you think.', step: 'Try one thing you have never done before.' },
    6: { title: 'A year for care', text: 'Home, the people you love, and you. Give generously this year, and remember that you are on your own list.', step: 'Keep one evening a month only for yourself.' },
    7: { title: 'A year for looking inward', text: 'Quiet is not lost time. Rest, read and ask the bigger questions; this year the answers come when you slow down.', step: 'Keep one quiet hour a week that is only yours.' },
    8: { title: 'A year for your strength', text: 'Ask for what your work is worth, and let yourself be seen doing well. Your effort deserves its reward.', step: 'Say one thing you are proud of out loud.' },
    9: { title: 'A year for letting go', text: 'Finish what is ready to finish, forgive what you can, and set down what is done. You are making room for what comes next.', step: 'Clear out one thing: a drawer, a habit or a worry.' }
  };
  /* who she is, from the day she was born: the heavenly stem of that day in the BaZi day count, (JDN - 11) mod 60 and its
     stem mod 10, which is what YourDigitalDNA's engine gives with the birth hour unknown (checked in tools/test-core.js on
     300 dates and two published anchors). The names, lines and reframes are YourDigitalDNA's, with Rhythme's punctuation */
  var DAY_MASTERS = [
    { stem: '甲', pinyin: 'Jia', element: 'Wood', name: 'The Pillar', line: 'Upright, principled, grows toward the light and shelters others.', reframe: 'Stubbornness is just a spine that won’t round. Aimed well, you are the thing others lean on.' },
    { stem: '乙', pinyin: 'Yi', element: 'Wood', name: 'The Vine', line: 'Adaptive and quietly persistent, it bends without breaking.', reframe: 'What looks like indecision is range: you survive rooms that break rigid people.' },
    { stem: '丙', pinyin: 'Bing', element: 'Fire', name: 'The Sun', line: 'Radiant and generous, warming every room it enters.', reframe: 'Too much, too bright? That same heat is the warmth people return to. Don’t dim it; aim it.' },
    { stem: '丁', pinyin: 'Ding', element: 'Fire', name: 'The Lantern', line: 'Focused inner fire, intimate warmth, illumination at close range.', reframe: 'Your fire is small on purpose. Depth over reach: one person, fully seen, is your superpower.' },
    { stem: '戊', pinyin: 'Wu', element: 'Earth', name: 'The Mountain', line: 'Steady, dependable, the ground others come to stand on.', reframe: 'Slow to move is not slow to think. You are the ground in a storm; that is not a weakness.' },
    { stem: '己', pinyin: 'Ji', element: 'Earth', name: 'The Field', line: 'Nurturing and resourceful, it turns everything it holds into growth.', reframe: 'You give until it costs, because you can grow anything. The work is choosing whose soil you are.' },
    { stem: '庚', pinyin: 'Geng', element: 'Metal', name: 'The Blade', line: 'Decisive and unbending, cutting straight to what matters.', reframe: 'Blunt is not unkind. Your clarity is a mercy in a world of people who won’t say the true thing.' },
    { stem: '辛', pinyin: 'Xin', element: 'Metal', name: 'The Jewel', line: 'Refined and discerning, value concentrated into a small, bright thing.', reframe: 'Sensitivity is discernment under pressure. You feel the flaw first because you know the standard.' },
    { stem: '壬', pinyin: 'Ren', element: 'Water', name: 'The Ocean', line: 'Wide, strategic, moving whole landscapes without seeming to try.', reframe: 'Restless is just deep water moving. You think in systems while others think in steps.' },
    { stem: '癸', pinyin: 'Gui', element: 'Water', name: 'The Mist', line: 'Intuitive and pervasive, reaching quietly into every corner.', reframe: 'Quiet is not absent. You reach into corners others can’t; your intuition arrives before the proof.' }
  ];
  /* the Julian day number of a calendar date (Fliegel and Van Flandern) */
  function jdn(y, m, d) { var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3; return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045; }
  function dayStem(y, m, d) { return (((jdn(y, m, d) - 11) % 60) + 60) % 60 % 10; }
  function dayMaster(y, mmdd) { mmdd = clean(mmdd); y = Number(y); if (!mmdd || !(Math.floor(y) === y && y >= 1900) || (mmdd === '02-29' && !leap(y))) return null; return DAY_MASTERS[dayStem(y, +mmdd.slice(0, 2), +mmdd.slice(3))]; }
  function card(c) {
    c = c || {}; var mmdd = clean(c.mmdd), y = Math.floor(Number(c.year)) || 0, n = personalYear(mmdd, y), nm = String(c.name || '').trim();
    return { title: 'Happy birthday' + (nm ? ', ' + nm : '') + '!', date: text(mmdd), year: y,
      wish: pick(y * 1000 + (mmdd ? +mmdd.slice(0, 2) * 31 + +mmdd.slice(3) : 0), 1)[0], number: n, direction: n ? YEARS[n] : null,
      who: c.birthYear ? dayMaster(c.birthYear, mmdd) : null, outfit: c.canGown ? 'gown' : 'party' };
  }
  /* the three selects, shared by the intro step and You: a month and a day, and the year if she likes (adults only) */
  function fieldHTML(mmdd, year, p, today) {
    var cur = clean(mmdd), mo = cur ? +cur.slice(0, 2) : 0, d = cur ? +cur.slice(3) : 0, ty = /^\d{4}/.test(String(today || '')) ? +String(today).slice(0, 4) : new Date().getFullYear(), yrs = [];
    for (var yy = ty - ADULT; yy >= ty - OLDEST; yy--) yrs.push(yy);
    return '<div class="byrow">' +
      '<select class="input" id="' + p + 'Month" aria-label="Birthday month"><option value="0">Month</option>' + MONTHS.map(function (n, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === mo ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
      '<select class="input" id="' + p + 'Day" aria-label="Birthday day"><option value="0">Day</option>' + Array.apply(null, Array(31)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === d ? ' selected' : '') + '>' + (i + 1) + '</option>'; }).join('') + '</select>' +
      '<select class="input" id="' + p + 'Year" aria-label="Birth year, optional"><option value="0">Year (optional)</option>' + yrs.map(function (v) { return '<option value="' + v + '"' + (v === Number(year) ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>';
  }
  /* what the selects hold: { birthday: 'MM-DD' or null, year: a checked year or null, error: '' or what to fix } */
  function readField(d, p, today) {
    var mo = d && d.getElementById(p + 'Month'), dy = d && d.getElementById(p + 'Day'), yr = d && d.getElementById(p + 'Year');
    if (!mo || !dy) return { birthday: null, year: null, error: '' };
    var b = clean(mo.value + '-' + dy.value), y = yr ? Number(yr.value) : 0;
    if (!b) return { birthday: null, year: null, error: (+mo.value || +dy.value || y) ? 'Choose a month and a day that month has.' : '' };
    if (!y) return { birthday: b, year: null, error: '' };
    var e = yearError(y, b, today); return { birthday: b, year: e ? null : y, error: e };
  }

  var B = { MONTHS: MONTHS, LINES: LINES, YEARS: YEARS, DAY_MASTERS: DAY_MASTERS, clean: clean, yearError: yearError, dayOf: dayOf, isDay: isDay, yearOf: yearOf, text: text, pick: pick, personalYear: personalYear, jdn: jdn, dayStem: dayStem, dayMaster: dayMaster, card: card, dateIn: dateIn, fieldHTML: fieldHTML, readField: readField };
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
  function birthYear() { var b = mmdd(), y = Number(S.profile().birthYear); return b && y && !yearError(y, b, S.today()) ? y : null; }
  function isToday() { var b = mmdd(); return !!b && isDay(S.today(), b); }
  function inWeek() { var b = mmdd(); return !!b && dayOf(S.today(), b) >= 0; }
  function canGown() { return !!(R.outfitLocked && !R.outfitLocked('gown')); }
  function year() { return yearOf(S.today(), mmdd()); }
  function model() { return card({ name: S.profile().name, mmdd: mmdd(), year: year(), birthYear: birthYear(), canGown: canGown() }); }
  function openCard() {
    var m = model(), outfitName = m.outfit === 'gown' ? 'Starlight gown' : 'party outfit', dir = m.direction, who = m.who, how = [];
    if (who) how.push('you were born on a ' + who.pinyin + ' ' + who.element + ' day in the BaZi day count, which everyone born that day shares');
    if (dir) how.push('your birth month, your birth day and ' + m.year + ' add up to ' + m.number + ' the Pythagorean way, a direction everyone with your birthday shares this year');
    R.openSheet('birthday', m.title, 'A postcard from your room', 'cake',
      '<div class="bcard"><div class="bhead"><img src="' + ART + CAKE + '" alt=""><div><b>' + esc(m.title) + '</b><small>' + esc(m.date) + (m.year ? ' · ' + m.year : '') + '</small></div></div>' +
      '<p class="bline bwish">' + esc(m.wish) + '</p>' +
      (who ? '<div class="bwho"><span class="lbl">Who you are, from the day you were born</span><b>' + esc(who.name) + '</b><p>' + esc(who.line) + '</p><p class="bquote">“' + esc(who.reframe) + '”</p></div>' : '') +
      (dir ? '<div class="bdir"><span class="lbl">Your direction for the year ahead</span><b>' + esc(dir.title) + '</b><p>' + esc(dir.text) + '</p><p class="bstep"><span class="ms" aria-hidden="true">footprint</span><span>A first step, if you like: ' + esc(dir.step.charAt(0).toLowerCase() + dir.step.slice(1)) + '</span></p></div>' : '') +
      '<p class="bfrom">With love from your room, and from Luna.</p></div>' +
      '<div class="row"><button type="button" class="btn primary" data-b="party"><span class="ms">checkroom</span>Wear the ' + esc(outfitName) + '</button><button type="button" class="btn soft" data-b="close"><span class="ms">favorite</span>Thank you</button></div>' +
      '<p class="help">' + (how.length ? 'How this is read: ' + how.join('; and ') + '. ' : '') + 'A reflection, not a prediction or health advice. No hearts are involved.</p>');
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
  /* the field in You: a month and a day, and the year if she likes, or none */
  function renderField(el) {
    if (!el) return;
    var cur = mmdd(), by = birthYear();
    el.innerHTML = '<div class="field byou"><span class="lbl" id="bLbl">Your birthday (optional)</span><div role="group" aria-labelledby="bLbl">' + fieldHTML(cur, by, 'b', S.today()) + '</div>' +
      '<div class="byrow"><button type="button" class="btn soft" id="bSave"><span class="ms">check</span>Save</button>' + (cur ? '<button type="button" class="btn ghost" id="bClear">Remove</button>' : '') + '</div>' +
      '<p class="help" id="bHelp">' + (cur ? 'Kept: ' + esc(text(cur)) + (by ? ' ' + by : '') + '. ' : '') + 'A month and a day, and the year if you like, kept on this phone. On the day: a wish, a direction for your year ahead and a cake on your table for the week; the year adds who you are from the day you were born. Nothing else uses it.</p></div>';
    var save = function (patch) { try { S.setProfile(patch); } catch (e) { if (R.toast) R.toast('Could not save that on this device.', 'error'); return false; } if (R.updateGreeting) R.updateGreeting(); if (R.renderProps) R.renderProps(); opened = false; tries = 0; renderField(el); return true; };
    doc.getElementById('bSave').addEventListener('click', function () {
      var r = readField(doc, 'b', S.today()), h = doc.getElementById('bHelp');
      if (r.error || !r.birthday) { if (h) h.textContent = r.error || 'Choose a month and a day that month has.'; return; }
      if (!save({ birthday: r.birthday, birthYear: r.year })) return;
      if (R.chime) R.chime('save'); if (R.toast) R.toast('Kept. ' + text(r.birthday) + ' is yours.', 'cake');
      if (isToday()) { markShown(year()); openCard(); } /* her birthday is today: the card replaces the You sheet straight away */
    });
    var cl = doc.getElementById('bClear'); if (cl) cl.addEventListener('click', function () { save({ birthday: null, birthYear: null }); if (R.chime) R.chime('tap'); if (R.toast) R.toast('Removed.', 'cake'); });
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
