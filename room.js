/* Ovumind dream room — interaction engine.
 * One fixed-aspect scene holds the illustration, labelled hotspot buttons,
 * avatar waypoints and overlays, so everything scales together. Data goes
 * through OvuStore; pattern notes come from OvuAgents. */
(function () {
  'use strict';
  var S = window.OvuStore, A = window.OvuAgents;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ART = 'assets/room/dream/';

  /* ---------- scene configuration (percent of the 4:5 scene) ---------- */
  var HOTSPOTS = [
    { id: 'bed', x: 36, y: 56, label: 'Bed · go to sleep', icon: 'bedtime', wp: { x: 42, y: 72, flip: true } },
    { id: 'clock', x: 13.5, y: 57, label: 'Clock · record sleep', icon: 'alarm', wp: { x: 20, y: 71, flip: true } },
    { id: 'calendar', x: 49.5, y: 44, label: 'Calendar · cycle & symptoms', icon: 'calendar_month', wp: { x: 54, y: 64, flip: false } },
    { id: 'computer', x: 65, y: 46, label: 'Computer · learn', icon: 'computer', wp: { x: 63, y: 66, flip: false } },
    { id: 'wardrobe', x: 81, y: 52, label: 'Wardrobe · outfits', icon: 'checkroom', wp: { x: 76, y: 73, flip: false } },
    { id: 'diary', x: 64, y: 73, label: 'Diary · food journal', icon: 'menu_book', wp: { x: 54, y: 80, flip: false } },
    { id: 'window', x: 44, y: 29, label: 'Window · tonight', icon: 'dark_mode', wp: null }
  ];
  var HOME = { x: 44, y: 79, flip: false };
  var OUTFITS = [
    { id: 'base', name: 'Cosy knit', note: 'Cream sweater & blush skirt' },
    { id: 'pajamas', name: 'Starry pyjamas', note: 'For sleepy nights' },
    { id: 'sundress', name: 'Blush sundress', note: 'Soft & sweet' },
    { id: 'cozy', name: 'Cloud hoodie', note: 'Lazy Sunday' },
    { id: 'yoga', name: 'Mint yoga set', note: 'Move gently' },
    { id: 'party', name: 'Lilac tulle', note: 'Sparkle day' },
    /* cabin-crew sarong kebaya, rank colours: blue flight stewardess, green leading, red chief */
    { id: 'kebaya-navy', name: 'Navy kebaya', note: 'Flight stewardess' },
    { id: 'kebaya-green', name: 'Green kebaya', note: 'Leading stewardess' },
    { id: 'kebaya-red', name: 'Red kebaya', note: 'Chief stewardess' }
  ];
  var TOPICS = [
    ['hormones.html', 'show_chart', 'Hormones 101', 'What rises and falls each cycle'],
    ['cycle-home.html', 'bloodtype', 'Your cycle', 'Phases, length and what is typical'],
    ['fertility.html', 'spa', 'Fertile window', 'Ovulation signs, explained'],
    ['journey-bloom.html', 'local_florist', 'First cycles', 'Teens and the first years'],
    ['journey-grow.html', 'eco', 'Trying to conceive', 'Timing, tests and support'],
    ['journey-nurture.html', 'favorite', 'After pregnancy', 'Recovery and cycles returning'],
    ['journey-peri.html', 'dark_mode', 'Perimenopause', 'Hot flushes, sleep and mood'],
    ['journey-post.html', 'wb_sunny', 'After menopause', 'Bone, heart and bleeding rules'],
    ['sleep.html', 'bedtime', 'Sleep & your cycle', 'Why some weeks feel lighter'],
    ['foods.html', 'restaurant', 'Foods by phase', 'Iron, magnesium and comfort'],
    ['mindfulness.html', 'self_improvement', 'Mindfulness', 'Guided pauses with Erin'],
    ['mental-health.html', 'psychology', 'Mood & calm', 'When to reach for support']
  ];
  var VIDEOS = [
    ['normal', 'normal-v4.mp4', 'A normal cycle', 'What typical looks like'],
    ['hormones', 'hormones-v4.mp4', 'Hormones', 'Oestrogen & progesterone'],
    ['fertile', 'fertile-v4.mp4', 'Fertile window', 'Your most fertile days'],
    ['menarche', 'menarche-v1.mp4', 'First period', 'Menarche explained'],
    ['peri', 'peri-v4.mp4', 'Perimenopause', 'The transition years'],
    ['menopause', 'menopause-v1.mp4', 'Menopause', 'Life after periods']
  ];
  var PHASE_TIPS = {
    menstrual: { title: 'Menstrual phase', text: 'Iron-rich and warming foods help many people feel steadier while bleeding.', foods: ['Lentils', 'Spinach', 'Dark chocolate', 'Ginger tea'] },
    follicular: { title: 'Follicular phase', text: 'Energy often rises. Fresh vegetables, fermented foods and lean protein suit this stretch.', foods: ['Salmon', 'Broccoli', 'Kimchi', 'Berries'] },
    ovulatory: { title: 'Ovulatory phase', text: 'Lighter, fibre-rich meals with plenty of colour tend to feel good now.', foods: ['Quinoa', 'Leafy greens', 'Citrus', 'Avocado'] },
    luteal: { title: 'Luteal phase', text: 'Magnesium and slow carbs can soften cravings and support sleep before a period.', foods: ['Pumpkin seeds', 'Sweet potato', 'Oats', 'Banana'] },
    late: { title: 'Past your usual length', text: 'Keep eating regularly and note how you feel; a late period is worth a note in your journal.', foods: ['Balanced plate', 'Water', 'Protein', 'Veg'] },
    none: { title: 'Any phase', text: 'A balanced plate with protein, colour and slow carbs is a good default while your pattern builds.', foods: ['Eggs', 'Greens', 'Whole grains', 'Fruit'] }
  };

  /* ---------- helpers ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function prettyDate(iso, opts) { var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  var toastTimer;
  function toast(text, icon) {
    var t = $('#toast'); t.innerHTML = '<span class="ms">' + esc(icon || 'auto_awesome') + '</span><span>' + esc(text) + '</span>';
    t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  /* opt-in tiny chime; nothing plays until the user turns sound on */
  var audioCtx = null;
  function chime(kind) {
    if (!S.state().sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = kind === 'save' ? 880 : kind === 'sleep' ? 392 : 660;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.4);
    } catch (e) { /* no audio */ }
  }

  /* ---------- scene build ---------- */
  var scene = $('#scene'), inner = $('#sceneInner'), avatar = $('#avatar'), avatarImg = $('#avatarImg'), sleeper = $('#sleeper');
  function buildScene() {
    var hs = $('#hotspots');
    HOTSPOTS.forEach(function (h) {
      var b = document.createElement('button');
      b.className = 'hotspot'; b.type = 'button'; b.dataset.id = h.id; b.setAttribute('aria-label', h.label);
      b.style.left = h.x + '%'; b.style.top = h.y + '%';
      b.innerHTML = '<span class="glow"></span><span class="pulse" aria-hidden="true"></span><span class="tip" aria-hidden="true">' + esc(h.label.split(' · ')[1] ? cap(h.label.split(' · ')[1]) : h.label) + '</span>';
      b.addEventListener('click', function () { tap(h); });
      hs.appendChild(b);
    });
    var sp = $('#sparkles');
    for (var i = 0; i < 14; i++) { var s = document.createElement('i'); s.className = 'sparkle'; s.style.left = (5 + Math.random() * 90) + '%'; s.style.top = (4 + Math.random() * 60) + '%'; s.style.animationDelay = (Math.random() * 4) + 's'; s.style.animationDuration = (3 + Math.random() * 3) + 's'; sp.appendChild(s); }
    var st = $('#stars');
    for (var j = 0; j < 26; j++) { var z = document.createElement('i'); z.className = 'star'; z.style.left = (2 + Math.random() * 96) + '%'; z.style.top = (2 + Math.random() * 40) + '%'; z.style.animationDelay = (Math.random() * 3) + 's'; z.style.transform = 'scale(' + (0.5 + Math.random()) + ')'; st.appendChild(z); }
    /* optional generated night plate */
    var night = $('#roomNight');
    night.addEventListener('load', function () { scene.classList.add('has-night-img'); });
    night.addEventListener('error', function () { night.remove(); });
    night.src = ART + 'room-night.webp';
    /* gentle parallax on pointer devices only */
    if (!reduced && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      scene.addEventListener('pointermove', function (e) { var r = scene.getBoundingClientRect(); var dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5; inner.style.transform = 'rotateY(' + (dx * 4) + 'deg) rotateX(' + (-dy * 3) + 'deg) scale(1.02)'; });
      scene.addEventListener('pointerleave', function () { inner.style.transform = ''; });
    }
  }

  /* ---------- avatar ---------- */
  var pos = { x: HOME.x, y: HOME.y }, walkTimer = null, idleTimer = null;
  function setOutfit(id, silent) {
    if (!OUTFITS.some(function (o) { return o.id === id; })) id = 'base';
    var img = new Image();
    img.onload = function () { avatarImg.src = img.src; if (!silent) { avatar.classList.add('poofing'); setTimeout(function () { avatar.classList.remove('poofing'); }, 700); } };
    img.src = ART + 'avatar-' + id + '.webp';
    S.setProfile({ outfit: id });
    $$('.outfit').forEach(function (el) { el.classList.toggle('on', el.dataset.id === id); });
  }
  function placeAvatar(p, flip) { pos = { x: p.x, y: p.y }; avatar.style.left = p.x + '%'; avatar.style.top = p.y + '%'; avatar.classList.toggle('flip', !!flip); }
  function walkTo(wp, done) {
    if (!wp || reduced) { if (wp) placeAvatar(wp, wp.flip); done && done(); return; }
    var dx = wp.x - pos.x, dy = wp.y - pos.y, dist = Math.sqrt(dx * dx + dy * dy);
    var ms = Math.min(1100, Math.max(350, dist * 22));
    avatar.style.transitionDuration = ms + 'ms';
    avatar.classList.remove('idle'); avatar.classList.add('walking');
    avatar.classList.toggle('flip', dx < 0);
    clearTimeout(walkTimer);
    requestAnimationFrame(function () { placeAvatar(wp, dx < 0); });
    walkTimer = setTimeout(function () {
      avatar.classList.remove('walking'); avatar.classList.add('landing'); avatar.classList.toggle('flip', !!wp.flip);
      setTimeout(function () { avatar.classList.remove('landing'); avatar.classList.add('idle'); }, 420);
      done && done();
    }, ms + 30);
  }
  function goHome() { clearTimeout(idleTimer); idleTimer = setTimeout(function () { if (!S.state().sleeping) walkTo(HOME); }, 1400); }

  /* ---------- sheets ---------- */
  var sheet = $('#sheet'), veil = $('#veil'), body = $('#sheetBody'), current = null;
  function openSheet(id, title, sub, icon, html) {
    current = id; $('#sheetTitle').innerHTML = esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('#sheetIcon').innerHTML = '<span class="ms">' + esc(icon) + '</span>';
    body.innerHTML = html; body.scrollTop = 0;
    sheet.classList.add('on'); veil.classList.add('on'); scene.classList.add('quiet');
    sheet.setAttribute('aria-hidden', 'false');
    var first = body.querySelector('input,button,select,textarea,a'); if (first && window.matchMedia('(hover:hover)').matches) try { first.focus({ preventScroll: true }); } catch (e) { }
  }
  function closeSheet() { current = null; sheet.classList.remove('on'); veil.classList.remove('on'); scene.classList.remove('quiet'); sheet.setAttribute('aria-hidden', 'true'); stopVideo(); goHome(); }
  veil.addEventListener('click', closeSheet); $('#sheetClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); hideBubble(); } });
  function message(el, text, ok) { el.textContent = text; el.className = 'msg on ' + (ok ? 'ok' : 'err'); }

  /* ---------- tap routing ---------- */
  function tap(h) {
    var btn = $('.hotspot[data-id="' + h.id + '"]'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    chime('tap'); hideBubble();
    var visited = S.state().visited || {}; visited[h.id] = true; S.setState({ visited: visited });
    $('#hint').classList.remove('on');
    if (h.id === 'window') { openWindow(); return; }
    if (S.state().sleeping && h.id !== 'bed' && h.id !== 'clock') { openSheetFor(h.id); return; }
    walkTo(h.wp, function () { openSheetFor(h.id); });
  }
  function openSheetFor(id) {
    if (id === 'bed') return S.state().sleeping ? openWake() : openBedtime();
    if (id === 'clock') return openSleepRecord();
    if (id === 'calendar') return openCalendar('period');
    if (id === 'computer') return openLearn();
    if (id === 'wardrobe') return openWardrobe();
    if (id === 'diary') return openDiary();
  }

  /* ---------- sleep flows ---------- */
  function moonsHTML(name, val) { var out = ''; for (var i = 1; i <= 5; i++) out += '<button type="button" data-q="' + i + '" class="' + (val >= i ? 'on' : '') + '" aria-label="Quality ' + i + ' of 5">' + (val >= i ? '🌕' : '🌑') + '</button>'; return '<div class="moons" data-name="' + name + '">' + out + '</div>'; }
  function wireMoons(root) { $$('.moons', root).forEach(function (m) { m.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var v = Number(b.dataset.q); m.dataset.value = v; $$('button', m).forEach(function (x, i) { x.classList.toggle('on', i < v); x.textContent = i < v ? '🌕' : '🌑'; }); }); }); }
  function sleepListHTML() {
    var st = S.sleepStats(7);
    if (!st.nights.length) return '<div class="empty">No nights recorded yet. Your first entry starts the pattern.</div>';
    return '<div class="entries">' + st.nights.slice().reverse().map(function (n) { return '<div class="entry"><span class="ms">bedtime</span><div class="body"><b>' + esc(prettyDate(n.date)) + ' · ' + esc(A.fmtHours(n.hours)) + '</b><span>' + (n.quality ? 'Quality ' + n.quality + '/5' : 'Quality not rated') + '</span></div><button class="del" data-del="' + esc(n.id) + '" aria-label="Delete"><span class="ms">delete</span></button></div>'; }).join('') + '</div>';
  }
  function openBedtime() {
    openSheet('bedtime', 'Ready for bed?', 'Your room will dim while you sleep', 'bedtime',
      '<div class="stat"><span class="ms">dark_mode</span><div><b>Bedtime ' + esc(nowHM()) + '</b><span>Tap the bed again when you wake up and I will finish the entry.</span></div></div>' +
      '<div class="field"><label for="bedTimeNow">Bedtime</label><input class="input" id="bedTimeNow" type="time" value="' + nowHM() + '"></div>' +
      '<div class="field"><label>Pyjamas</label><div class="chips"><button type="button" class="chipbtn on" id="pjToggle"><span class="ms">checkroom</span>Change into starry pyjamas</button></div></div>' +
      '<div class="row"><button class="btn primary" id="goodnight"><span class="ms">bedtime</span>Good night</button><button class="btn ghost" id="recordInstead">Record a past night instead</button></div>' +
      '<div class="msg" id="sleepMsg"></div>');
    $('#pjToggle').addEventListener('click', function () { this.classList.toggle('on'); });
    $('#recordInstead').addEventListener('click', openSleepRecord);
    $('#goodnight').addEventListener('click', function () {
      var bt = $('#bedTimeNow').value; if (!S.validTime(bt)) return message($('#sleepMsg'), 'Enter a bedtime.', false);
      var prev = S.profile().outfit;
      S.setState({ sleeping: { startedAt: new Date().toISOString(), bedTime: bt, prevOutfit: prev, pj: $('#pjToggle').classList.contains('on') } });
      enterNight(true); closeSheet(); chime('sleep'); toast('Sweet dreams. Tap the bed when you wake up.', 'dark_mode');
    });
  }
  function openWake() {
    var sl = S.state().sleeping || {};
    openSheet('wake', 'Good morning!', 'Finish last night’s sleep entry', 'wb_twilight',
      '<div class="stat"><span class="ms">bedtime</span><div><b>Bedtime ' + esc(sl.bedTime || '--:--') + '</b><span>Started ' + esc(sl.startedAt ? new Date(sl.startedAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '</span></div></div>' +
      '<div class="grid2"><div class="field"><label for="wakeTime">Wake time</label><input class="input" id="wakeTime" type="time" value="' + nowHM() + '"></div><div class="field"><label for="wakeDate">Morning of</label><input class="input" id="wakeDate" type="date" value="' + S.today() + '" max="' + S.today() + '"></div></div>' +
      '<div class="field"><span class="lbl">How did you sleep?</span>' + moonsHTML('q', 0) + '</div>' +
      '<div class="field"><label for="wakeNotes">Notes (optional)</label><textarea class="input" id="wakeNotes" placeholder="Woke twice, vivid dreams, warm night..."></textarea></div>' +
      '<div class="row"><button class="btn primary" id="saveWake"><span class="ms">wb_sunny</span>Save my sleep</button><button class="btn ghost" id="cancelSleep">I did not sleep</button></div>' +
      '<div class="msg" id="sleepMsg"></div>');
    wireMoons(body);
    $('#cancelSleep').addEventListener('click', function () { exitNight(); S.setState({ sleeping: null }); closeSheet(); toast('No worries. Nothing was recorded.', 'wb_sunny'); });
    $('#saveWake').addEventListener('click', function () {
      try {
        var q = Number($('.moons', body).dataset.value || 0) || null;
        var ev = S.add('sleep', $('#wakeDate').value, { bedTime: sl.bedTime, wakeTime: $('#wakeTime').value, quality: q, notes: $('#wakeNotes').value.trim(), mode: 'room' });
        exitNight(); S.setState({ sleeping: null }); closeSheet(); chime('save');
        afterSave(ev, 'Slept ' + A.fmtHours(S.sleepHours(ev.data)) + '. Saved to your journal.');
      } catch (e) { message($('#sleepMsg'), e.message, false); }
    });
  }
  function openSleepRecord() {
    openSheet('sleep', 'Record sleep', 'Any night, any date', 'alarm',
      '<div class="grid2"><div class="field"><label for="slDate">Morning of</label><input class="input" id="slDate" type="date" value="' + S.today() + '" max="' + S.today() + '"></div><div class="field"><label for="slBed">Bedtime</label><input class="input" id="slBed" type="time" value="23:00"></div></div>' +
      '<div class="grid2"><div class="field"><label for="slWake">Wake time</label><input class="input" id="slWake" type="time" value="07:00"></div><div class="field"><span class="lbl">Quality</span>' + moonsHTML('q', 0) + '</div></div>' +
      '<div class="field"><label for="slNotes">Notes (optional)</label><textarea class="input" id="slNotes" placeholder="Night sweats, cramps, late coffee..."></textarea></div>' +
      '<button class="btn primary" id="saveSleep" style="width:100%"><span class="ms">check</span>Save night</button><div class="msg" id="sleepMsg"></div>' +
      '<div class="field"><span class="lbl">Last 7 nights</span><div id="sleepList">' + sleepListHTML() + '</div></div>');
    wireMoons(body);
    $('#saveSleep').addEventListener('click', function () {
      try {
        var q = Number($('.moons', body).dataset.value || 0) || null;
        var ev = S.add('sleep', $('#slDate').value, { bedTime: $('#slBed').value, wakeTime: $('#slWake').value, quality: q, notes: $('#slNotes').value.trim(), mode: 'manual' });
        if (!S.validTime(ev.data.bedTime) || !S.validTime(ev.data.wakeTime)) { S.remove(ev.id); throw new Error('Enter both bedtime and wake time.'); }
        message($('#sleepMsg'), 'Saved: ' + A.fmtHours(S.sleepHours(ev.data)) + ' of sleep.', true); chime('save');
        $('#sleepList').innerHTML = sleepListHTML(); afterSave(ev);
      } catch (e) { message($('#sleepMsg'), e.message, false); }
    });
    body.addEventListener('click', function (e) { var d = e.target.closest('[data-del]'); if (d && confirm('Delete this night?')) { S.remove(d.dataset.del); $('#sleepList').innerHTML = sleepListHTML(); renderDeck(); } });
  }
  function enterNight(withPj) {
    scene.classList.add('is-night'); avatar.classList.add('hidden');
    var sl = S.state().sleeping; if (withPj && sl && sl.pj) setOutfit('pajamas', true);
    setTimeout(function () { sleeper.classList.add('on'); }, 500);
    $('#phaseChip').classList.add('hidden');
    updateGreeting();
  }
  function exitNight() {
    sleeper.classList.remove('on'); scene.classList.remove('is-night');
    var prev = (S.state().sleeping || {}).prevOutfit;
    setTimeout(function () { avatar.classList.remove('hidden'); placeAvatar(HOME, false); avatar.classList.add('idle'); }, 400);
    var p = S.profile(); if (p.outfit === 'pajamas' && prev) setOutfit(prev, true);
    $('#phaseChip').classList.remove('hidden'); updateGreeting();
  }
  sleeper.addEventListener('click', function () { openWake(); });

  /* ---------- calendar: period + symptoms with backdating ---------- */
  var cal = { y: 0, m: 0, tab: 'period', sel: S.today() };
  function openCalendar(tab, date) {
    var d = new Date(); cal.y = d.getFullYear(); cal.m = d.getMonth(); cal.tab = tab || 'period'; cal.sel = date || S.today();
    openSheet('calendar', 'Your calendar', 'Tap any past day to log or backdate', 'calendar_month',
      '<div class="tabs" id="calTabs"><button data-tab="period" class="on">Period</button><button data-tab="symptom">Symptoms</button></div>' +
      '<div class="cal-head"><button class="cal-nav" id="calPrev" aria-label="Previous month"><span class="ms">chevron_left</span></button><b id="calTitle"></b><button class="cal-nav" id="calNext" aria-label="Next month"><span class="ms">chevron_right</span></button></div>' +
      '<div class="cal-grid" id="calGrid" role="grid"></div>' +
      '<div class="legend"><span><i style="background:#e58aa8"></i>Period</span><span><i style="background:repeating-linear-gradient(135deg,#fff 0 3px,#f6e3ea 3px 6px);border:1px solid #f0cfdb"></i>Expected</span><span><i style="background:#eaf5ee;border:1px solid #cfe6d8"></i>Est. fertile</span><span><i style="background:#7a5c96;border-radius:50%"></i>Symptoms</span></div>' +
      '<div id="cycleStat"></div><div class="day-editor" id="dayEditor"></div>');
    $('#calTabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cal.tab = b.dataset.tab; $$('button', $('#calTabs')).forEach(function (x) { x.classList.toggle('on', x === b); }); renderEditor(); });
    $('#calPrev').addEventListener('click', function () { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } renderCal(); });
    $('#calNext').addEventListener('click', function () { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } renderCal(); });
    $('#calGrid').addEventListener('click', function (e) { var b = e.target.closest('.cal-day'); if (!b || !b.dataset.date || b.classList.contains('future')) return; cal.sel = b.dataset.date; renderCal(); renderEditor(); });
    renderCal(); renderEditor();
  }
  function renderCal() {
    var first = new Date(cal.y, cal.m, 1), days = new Date(cal.y, cal.m + 1, 0).getDate(), startDow = (first.getDay() + 6) % 7;
    $('#calTitle').textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    var periods = {}; S.list('period').forEach(function (e) { if (e.data.flow && e.data.flow !== 'none') periods[e.date] = e.data.flow; });
    var syms = {}; S.list('symptom').forEach(function (e) { syms[e.date] = true; });
    var cs = S.cycleStats(), predicted = {}, fertile = {};
    if (cs.predictedNext) { var pl = cs.periodLength || 5; for (var i = 0; i < pl; i++) predicted[S.addDays(cs.predictedNext, i)] = true; var ov = S.addDays(cs.predictedNext, -14); for (var k = -5; k <= 1; k++) fertile[S.addDays(ov, k)] = true; }
    var html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');
    for (var b = 0; b < startDow; b++) html += '<div class="cal-day empty"></div>';
    var today = S.today();
    for (var dd = 1; dd <= days; dd++) {
      var iso = cal.y + '-' + String(cal.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var cls = 'cal-day' + (iso === today ? ' today' : '') + (iso > today ? ' future' : '') + (iso === cal.sel ? ' sel' : '');
      if (periods[iso]) cls += ' p-' + periods[iso]; else if (predicted[iso]) cls += ' predicted'; else if (fertile[iso] && iso >= today) cls += ' fertile';
      html += '<button type="button" class="' + cls + '" data-date="' + iso + '" aria-label="' + prettyDate(iso) + '">' + dd + (syms[iso] ? '<span class="sdot"></span>' : '') + '</button>';
    }
    $('#calGrid').innerHTML = html;
    var statHtml = cs.lastStart ? '<div class="stat"><span class="ms">water_drop</span><div><b>Day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') + '</b><span>Next period expected around ' + prettyDate(cs.predictedNext) + ' (estimate from ' + esc(cs.basis) + ').</span></div></div>' : '<div class="stat"><span class="ms">water_drop</span><div><b>No period logged yet</b><span>Tap the first day of your last period, or use the button below.</span></div></div>';
    statHtml += '<div class="row"><button class="btn blush" id="menstruatingNow"><span class="ms">water_drop</span>I’m menstruating now</button></div>';
    $('#cycleStat').innerHTML = statHtml;
    $('#menstruatingNow').addEventListener('click', function () { var ev = S.add('period', S.today(), { flow: 'medium', clots: false, impact: false }); cal.sel = S.today(); renderCal(); renderEditor(); afterSave(ev, 'Period logged for today.'); });
  }
  function renderEditor() {
    var ed = $('#dayEditor'), date = cal.sel;
    if (cal.tab === 'period') {
      var cur = S.list('period', { from: date, to: date })[0], data = cur ? cur.data : { flow: 'none', clots: false, impact: false };
      ed.innerHTML = '<h3>' + esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
        '<div class="field"><span class="lbl">Bleeding</span><div class="chips" id="flowChips">' + ['none', 'spotting', 'light', 'medium', 'heavy'].map(function (f) { return '<button type="button" class="chipbtn flow-' + f + (data.flow === f ? ' on' : '') + '" data-flow="' + f + '">' + cap(f) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">Details</span><div class="chips"><button type="button" class="chipbtn' + (data.clots ? ' on' : '') + '" id="clots"><span class="ms">bubble_chart</span>Clots</button><button type="button" class="chipbtn' + (data.impact ? ' on' : '') + '" id="impact"><span class="ms">event_busy</span>Affected my day</button></div></div>' +
        '<div class="row"><button class="btn primary" id="savePeriod"><span class="ms">check</span>Save day</button>' + (cur ? '<button class="btn ghost" id="clearPeriod">Clear</button>' : '') + '</div><div class="msg" id="calMsg"></div>';
      $('#flowChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#flowChips')).forEach(function (x) { x.classList.toggle('on', x === b); }); });
      $('#clots').addEventListener('click', function () { this.classList.toggle('on'); }); $('#impact').addEventListener('click', function () { this.classList.toggle('on'); });
      $('#savePeriod').addEventListener('click', function () {
        try {
          var flow = ($('#flowChips .on') || {}).dataset ? $('#flowChips .on').dataset.flow : 'none';
          var ev;
          if (flow === 'none') { if (cur) S.remove(cur.id); message($('#calMsg'), 'Marked as no bleeding.', true); renderCal(); renderEditor(); renderDeck(); return; }
          ev = S.add('period', date, { flow: flow, clots: $('#clots').classList.contains('on'), impact: $('#impact').classList.contains('on') });
          message($('#calMsg'), 'Saved ' + flow + ' flow for ' + prettyDate(date) + '.', true); renderCal(); afterSave(ev);
        } catch (e) { message($('#calMsg'), e.message, false); }
      });
      if (cur) $('#clearPeriod').addEventListener('click', function () { S.remove(cur.id); renderCal(); renderEditor(); renderDeck(); });
    } else {
      var cs = S.list('symptom', { from: date, to: date })[0], sd = cs ? cs.data : { symptoms: [], pain: 0, mood: '', notes: '' };
      ed.innerHTML = '<h3>' + esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
        '<div class="field"><span class="lbl">Symptoms</span><div class="chips" id="symChips">' + A.SYMPTOMS.map(function (s) { return '<button type="button" class="chipbtn' + ((sd.symptoms || []).indexOf(s) > -1 ? ' on' : '') + '" data-sym="' + esc(s) + '">' + esc(cap(s)) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="pain">Pain · <span id="painVal">' + (sd.pain || 0) + '</span>/10</label><input class="range" type="range" id="pain" min="0" max="10" step="1" value="' + (sd.pain || 0) + '"></div>' +
        '<div class="field"><span class="lbl">Mood</span><div class="faces" id="moodFaces">' + [['great', 'sentiment_very_satisfied'], ['good', 'sentiment_satisfied'], ['ok', 'sentiment_neutral'], ['low', 'sentiment_dissatisfied'], ['bad', 'sentiment_very_dissatisfied']].map(function (m) { return '<button type="button" data-mood="' + m[0] + '" class="' + (sd.mood === m[0] ? 'on' : '') + '"><span class="ms">' + m[1] + '</span>' + cap(m[0]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="symNotes">Notes</label><textarea class="input" id="symNotes" placeholder="Anything else you noticed...">' + esc(sd.notes || '') + '</textarea></div>' +
        '<div class="row"><button class="btn primary" id="saveSym"><span class="ms">check</span>Save day</button>' + (cs ? '<button class="btn ghost" id="clearSym">Clear</button>' : '') + '</div><div class="msg" id="calMsg"></div>';
      $('#symChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) b.classList.toggle('on'); });
      $('#pain').addEventListener('input', function () { $('#painVal').textContent = this.value; });
      $('#moodFaces').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#moodFaces')).forEach(function (x) { x.classList.toggle('on', x === b && !x.classList.contains('on')); }); });
      $('#saveSym').addEventListener('click', function () {
        try {
          var list = $$('#symChips .on').map(function (b) { return b.dataset.sym; }), mood = ($('#moodFaces .on') || {}).dataset ? $('#moodFaces .on').dataset.mood : '';
          var ev = S.add('symptom', date, { symptoms: list, pain: Number($('#pain').value), mood: mood, notes: $('#symNotes').value.trim() });
          message($('#calMsg'), 'Saved for ' + prettyDate(date) + '.', true); renderCal(); afterSave(ev);
        } catch (e) { message($('#calMsg'), e.message, false); }
      });
      if (cs) $('#clearSym').addEventListener('click', function () { S.remove(cs.id); renderCal(); renderEditor(); renderDeck(); });
    }
  }

  /* ---------- diary: food journal ---------- */
  var diaryDate = S.today();
  function foodEntriesHTML(date) {
    var items = S.list('food', { from: date, to: date });
    if (!items.length) return '<div class="empty">Nothing logged for ' + esc(prettyDate(date)) + ' yet.</div>';
    return '<div class="entries">' + items.map(function (e) { return '<div class="entry"><span class="ms">' + ({ breakfast: 'egg_alt', lunch: 'rice_bowl', dinner: 'dinner_dining', snack: 'icecream' })[e.data.meal] + '</span><div class="body"><b>' + esc(cap(e.data.meal)) + (e.data.time ? ' · ' + esc(e.data.time) : '') + '</b><span>' + esc(e.data.foods) + ((e.data.tags || []).length ? '\n' + esc(e.data.tags.join(' · ')) : '') + '</span></div><button class="del" data-del="' + esc(e.id) + '" aria-label="Delete"><span class="ms">delete</span></button></div>'; }).join('') + '</div>';
  }
  function openDiary() {
    diaryDate = S.today();
    var cs = S.cycleStats(), tip = PHASE_TIPS[cs.phase] || PHASE_TIPS.none;
    var h = new Date().getHours(), defMeal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack';
    openSheet('diary', 'Food diary', 'What nourished you today?', 'menu_book',
      '<div class="stat"><span class="ms">local_florist</span><div><b>' + esc(tip.title) + '</b><span>' + esc(tip.text) + ' Try: ' + esc(tip.foods.join(', ')) + '.</span></div></div>' +
      '<div class="grid2"><div class="field"><label for="fdDate">Date</label><input class="input" id="fdDate" type="date" value="' + diaryDate + '" max="' + S.today() + '"></div><div class="field"><label for="fdTime">Time</label><input class="input" id="fdTime" type="time" value="' + nowHM() + '"></div></div>' +
      '<div class="field"><span class="lbl">Meal</span><div class="chips" id="mealChips">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (m) { return '<button type="button" class="chipbtn' + (m === defMeal ? ' on' : '') + '" data-meal="' + m + '">' + cap(m) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><label for="fdFoods">What did you eat?</label><textarea class="input" id="fdFoods" placeholder="Oats with berries and a latte"></textarea></div>' +
      '<div class="field"><span class="lbl">Tags</span><div class="chips" id="tagChips">' + A.FOOD_TAGS.map(function (t) { return '<button type="button" class="chipbtn" data-tag="' + esc(t) + '">' + esc(cap(t)) + '</button>'; }).join('') + '</div></div>' +
      '<button class="btn primary" id="saveFood" style="width:100%"><span class="ms">check</span>Add to diary</button><div class="msg" id="foodMsg"></div>' +
      '<div class="field"><span class="lbl">Entries for <span id="fdLabel">' + esc(prettyDate(diaryDate)) + '</span></span><div id="foodList">' + foodEntriesHTML(diaryDate) + '</div></div>' +
      '<a class="btn soft" href="food-journal.html" style="margin-top:12px"><span class="ms">restaurant</span>Open the full food journal</a>');
    $('#mealChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#mealChips')).forEach(function (x) { x.classList.toggle('on', x === b); }); });
    $('#tagChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) b.classList.toggle('on'); });
    $('#fdDate').addEventListener('change', function () { diaryDate = this.value; $('#fdLabel').textContent = prettyDate(diaryDate); $('#foodList').innerHTML = foodEntriesHTML(diaryDate); });
    $('#saveFood').addEventListener('click', function () {
      try {
        var foods = $('#fdFoods').value.trim(); if (!foods) throw new Error('Write what you ate, even one word.');
        var ev = S.add('food', $('#fdDate').value, { meal: $('#mealChips .on').dataset.meal, time: $('#fdTime').value, foods: foods, tags: $$('#tagChips .on').map(function (b) { return b.dataset.tag; }) });
        $('#fdFoods').value = ''; $$('#tagChips .on').forEach(function (b) { b.classList.remove('on'); });
        message($('#foodMsg'), 'Added to your diary.', true); $('#foodList').innerHTML = foodEntriesHTML(diaryDate); afterSave(ev);
      } catch (e) { message($('#foodMsg'), e.message, false); }
    });
    body.addEventListener('click', function (e) { var d = e.target.closest('[data-del]'); if (d && confirm('Delete this entry?')) { S.remove(d.dataset.del); $('#foodList').innerHTML = foodEntriesHTML(diaryDate); renderDeck(); } });
  }

  /* ---------- computer: learn ---------- */
  var player = null;
  function stopVideo() { if (player) { try { player.pause(); } catch (e) { } player = null; } }
  function openLearn() {
    openSheet('learn', 'Learn', 'Women’s health, in small sips', 'computer',
      '<div class="screen"><h3>Welcome back to your desk</h3><p>Short, sourced reads and six little videos. Nothing here is personal medical advice; bring questions to your clinician.</p></div>' +
      '<div class="field"><span class="lbl">Watch</span><div class="videos" id="videos">' + VIDEOS.map(function (v) { return '<button class="vid" data-src="assets/eduvid/' + v[1] + '" data-poster="assets/eduvid/' + v[0] + '.jpg"><img src="assets/eduvid/' + v[0] + '.jpg" alt=""><b>' + esc(v[2]) + '</b><small>' + esc(v[3]) + '</small></button>'; }).join('') + '</div><div class="player" id="player"></div></div>' +
      '<div class="field"><span class="lbl">Read</span><div class="topics">' + TOPICS.map(function (t) { return '<a class="topic" href="' + t[0] + '"><span class="ic"><span class="ms">' + t[1] + '</span></span><span><b>' + esc(t[2]) + '</b><small>' + esc(t[3]) + '</small></span></a>'; }).join('') + '</div></div>');
    $('#videos').addEventListener('click', function (e) {
      var b = e.target.closest('.vid'); if (!b) return; stopVideo();
      var p = $('#player'); p.innerHTML = '<video controls playsinline poster="' + b.dataset.poster + '" src="' + b.dataset.src + '"></video>'; p.classList.add('on'); player = p.querySelector('video'); player.play().catch(function () { });
      p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ---------- wardrobe ---------- */
  function openWardrobe() {
    var cur = S.profile().outfit || 'base';
    openSheet('wardrobe', 'Wardrobe', 'Pick an outfit for today', 'checkroom',
      '<div class="outfits">' + OUTFITS.map(function (o) { return '<button type="button" class="outfit' + (o.id === cur ? ' on' : '') + '" data-id="' + o.id + '"><img src="' + ART + 'avatar-' + o.id + '.webp" alt=""><b>' + esc(o.name) + '</b><small>' + esc(o.note) + '</small></button>'; }).join('') + '</div>' +
      '<div class="field"><label for="nameInput">What should I call you?</label><div class="row" style="margin-top:0"><input class="input" id="nameInput" maxlength="24" placeholder="Your name" value="' + esc(S.profile().name || '') + '"><button class="btn soft" id="saveName" style="flex:0 0 auto">Save</button></div></div>' +
      '<p class="help">Your avatar remembers her outfit on this device. Pyjamas go on automatically at bedtime.</p>');
    body.addEventListener('click', function (e) { var o = e.target.closest('.outfit'); if (!o) return; setOutfit(o.dataset.id); chime('tap'); toast(OUTFITS.filter(function (x) { return x.id === o.dataset.id; })[0].name + ' it is!', 'checkroom'); });
    $('#saveName').addEventListener('click', function () { S.setProfile({ name: $('#nameInput').value.trim() }); updateGreeting(); toast('Nice to meet you' + (S.profile().name ? ', ' + S.profile().name : '') + '.', 'favorite'); });
  }

  /* ---------- window: tonight ---------- */
  function openWindow() {
    var cs = S.cycleStats(), st = S.sleepStats(7), d = new Date();
    openSheet('window', 'Tonight', d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), 'dark_mode',
      '<div class="stat"><span class="ms">bedtime</span><div><b>' + (st.avg ? 'Averaging ' + st.avg + ' h over ' + st.count + ' nights' : 'No sleep logged this week') + '</b><span>Adults generally do best with 7 hours or more.</span></div></div>' +
      '<div class="stat"><span class="ms">water_drop</span><div><b>' + (cs.cycleDay ? 'Cycle day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') : 'Cycle not started') + '</b><span>' + (cs.predictedNext ? 'Next period expected around ' + prettyDate(cs.predictedNext) + '.' : 'Log a period on the wall calendar to start predictions.') + '</span></div></div>' +
      '<div class="row"><button class="btn primary" id="winSleep"><span class="ms">bedtime</span>' + (S.state().sleeping ? 'Wake up' : 'Go to sleep') + '</button><button class="btn soft" id="winSound"><span class="ms">' + (S.state().sound ? 'volume_up' : 'volume_off') + '</span>Sounds ' + (S.state().sound ? 'on' : 'off') + '</button></div>' +
      '<p class="help">Sounds are tiny chimes and stay off unless you turn them on.</p>');
    $('#winSleep').addEventListener('click', function () { closeSheet(); tap(HOTSPOTS[0]); });
    $('#winSound').addEventListener('click', function () { S.setState({ sound: !S.state().sound }); chime('tap'); openWindow(); });
  }

  /* ---------- avatar bubble ---------- */
  var bubble = $('#bubble');
  function hideBubble() { bubble.classList.remove('on'); }
  avatar.addEventListener('click', function (e) {
    e.stopPropagation(); chime('tap');
    var r = avatar.getBoundingClientRect(), sr = scene.getBoundingClientRect();
    bubble.style.left = Math.min(sr.width - 95, Math.max(95, r.left - sr.left + r.width / 2)) + 'px'; bubble.style.top = (r.top - sr.top - 6) + 'px';
    bubble.innerHTML = '<button data-act="wardrobe"><span class="ms">checkroom</span>Change outfit</button><button data-act="sleep"><span class="ms">bedtime</span>' + (S.state().sleeping ? 'Wake up' : 'Go to sleep') + '</button><button data-act="journal"><span class="ms">auto_stories</span>Open my journal</button>';
    bubble.classList.add('on');
  });
  bubble.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; hideBubble(); if (b.dataset.act === 'wardrobe') tap(HOTSPOTS[4]); if (b.dataset.act === 'sleep') tap(HOTSPOTS[0]); if (b.dataset.act === 'journal') location.href = 'journal.html'; });
  document.addEventListener('click', function (e) { if (!e.target.closest('#bubble') && !e.target.closest('#avatar')) hideBubble(); });

  /* ---------- after save: agents ---------- */
  function afterSave(ev, text) {
    var res = A.analyze(ev);
    var hi = res.flags.filter(function (f) { return f.level === 'high'; })[0], w = res.flags.filter(function (f) { return f.level === 'watch'; })[0];
    if (hi) toast(hi.title + '. Please see the note in your journal.', 'emergency_home');
    else if (w) toast('Saved. Pattern note added: ' + w.title + '.', 'flag');
    else toast(text || 'Saved to your journal.', 'check_circle');
    renderDeck();
  }

  /* ---------- deck below the scene ---------- */
  function renderDeck() {
    var cs = S.cycleStats(), st = S.sleepStats(7), today = S.today();
    var lastNight = S.list('sleep', { from: today, to: today })[0] || S.list('sleep').slice(-1)[0];
    var meals = S.list('food', { from: today, to: today }).length;
    var sym = S.list('symptom', { from: today, to: today })[0];
    $('#tiles').innerHTML =
      '<button class="tile" data-go="calendar"><span class="ms">water_drop</span><b>' + (cs.cycleDay ? 'Day ' + cs.cycleDay : '—') + '</b><small>' + (cs.phase ? cap(cs.phase) : 'Log a period') + '</small></button>' +
      '<button class="tile" data-go="clock"><span class="ms">bedtime</span><b>' + (lastNight ? A.fmtHours(S.sleepHours(lastNight.data)) : '—') + '</b><small>' + (lastNight ? (lastNight.date === today ? 'Last night' : prettyDate(lastNight.date)) : 'No sleep yet') + '</small></button>' +
      '<button class="tile" data-go="diary"><span class="ms">restaurant</span><b>' + meals + '</b><small>' + (meals === 1 ? 'meal today' : 'meals today') + '</small></button>';
    var flags = A.allFlags();
    $('#flagCard').style.display = flags.length ? '' : 'none';
    $('#flags').innerHTML = flags.slice(0, 3).map(function (f) { return '<div class="flag ' + f.level + '"><span class="ms">' + (f.level === 'high' ? 'emergency_home' : f.level === 'watch' ? 'flag' : 'info') + '</span><div><b>' + esc(f.title) + '</b><span>' + esc(f.detail) + '</span></div></div>'; }).join('');
    $('#journalBtn').classList.toggle('has-flag', flags.some(function (f) { return f.level !== 'info'; }));
    var daily = A.dailySummary(today);
    $('#dailyText').textContent = daily.text;
    $('#symLine').textContent = sym ? ((sym.data.symptoms || []).length ? 'Today: ' + sym.data.symptoms.join(', ') + (sym.data.mood ? ' · mood ' + sym.data.mood : '') : 'No symptoms ticked today') : 'No symptoms logged today. Tap the calendar to add or backdate.';
    var sum = S.load().summaries || [];
    $('#shareSub').textContent = sum.length ? 'Last summary saved ' + prettyDate(sum[sum.length - 1].range.to) : 'Create a 4-week summary for your clinician';
  }
  $('#tiles').addEventListener('click', function (e) { var t = e.target.closest('[data-go]'); if (!t) return; var h = HOTSPOTS.filter(function (x) { return x.id === t.dataset.go; })[0]; tap(h); });

  /* ---------- greeting ---------- */
  function updateGreeting() {
    var h = new Date().getHours(), p = S.profile(), name = p.name ? ', ' + p.name : '';
    var g = S.state().sleeping ? 'Sleep well' : h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('#greetTitle').textContent = g + name;
    $('#greetSub').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    var cs = S.cycleStats(); var chip = $('#phaseChip');
    chip.innerHTML = '<span class="ms">water_drop</span>' + (cs.cycleDay ? 'Day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') : 'Start your cycle');
  }
  $('#phaseChip').addEventListener('click', function () { tap(HOTSPOTS[2]); });

  /* ---------- boot ---------- */
  function boot() {
    buildScene();
    setOutfit(S.profile().outfit || 'base', true);
    placeAvatar(HOME, false); avatar.classList.add('idle');
    if (S.state().sleeping) enterNight(false);
    updateGreeting(); renderDeck();
    S.subscribe(function (reason) { if (reason === 'external') { renderDeck(); updateGreeting(); } });
    $('#journalBtn').href = 'journal.html'; $('#shareBtn').href = 'journal.html#share';
    if (!S.state().tourDone) { setTimeout(function () { $('#hint').classList.add('on'); }, 1200); setTimeout(function () { $('#hint').classList.remove('on'); S.setState({ tourDone: true }); }, 7000); }
    setTimeout(function () { $('#loading').classList.add('hidden'); }, 500);
    /* clock in the status bar */
    function tick() { var d = new Date(); $('#clockTime').textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); } tick(); setInterval(tick, 20000);
  }
  var dayImg = $('#roomDay');
  if (dayImg.complete) boot(); else { dayImg.addEventListener('load', boot); dayImg.addEventListener('error', boot); }
})();
