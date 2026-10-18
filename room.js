/* Ovumind dream room — interaction engine.
 * One fixed-aspect scene holds the illustration, labelled hotspot buttons,
 * avatar waypoints and overlays, so everything scales together. Data goes
 * through OvuStore; pattern notes come from OvuAgents; food maths from OvuFood;
 * Luna (the moon orb) from OvuOrb; hearts and props from OvuRewards. */
(function () {
  'use strict';
  var S = window.OvuStore, A = window.OvuAgents, FD = window.OvuFood, ORB = window.OvuOrb, RW = window.OvuRewards;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ART = 'assets/room/dream/';

  /* ---------- scene configuration (percent of each plate) ---------- */
  /* Two homes share one engine: the room (a 1472x1840 plate, 18 Oct morning render)
   * and the two-storey dream house (1024x1280). Every position is a percent of its
   * own plate, read off a 5% grid overlay. */
  var LAYOUTS = {
    room: {
      id: 'room', name: 'Your room', img: 'room-v3.webp', w: 1472, h: 1840, avatarW: 12,
      hotspots: [
        { id: 'bed', x: 30, y: 56, label: 'Bed · go to sleep', icon: 'bedtime', wp: { x: 40, y: 72, flip: true } },
        { id: 'clock', x: 14, y: 60, label: 'Clock · reminders', icon: 'alarm', wp: { x: 21, y: 70, flip: true } },
        { id: 'calendar', x: 56, y: 30, label: 'Calendar · cycle & symptoms', icon: 'calendar_month', wp: { x: 55, y: 60, flip: false } },
        { id: 'computer', x: 58, y: 42, label: 'Computer · learn', icon: 'computer', wp: { x: 60, y: 61, flip: false } },
        { id: 'wardrobe', x: 78, y: 48, label: 'Wardrobe · outfits', icon: 'checkroom', wp: { x: 72, y: 64, flip: false } },
        { id: 'diary', x: 66, y: 73, label: 'Diary · food journal', icon: 'menu_book', wp: { x: 58, y: 78, flip: false } },
        { id: 'mat', x: 28, y: 79, label: 'Yoga mat · mindfulness with Erin', icon: 'self_improvement', wp: { x: 36, y: 83, flip: true } },
        { id: 'window', x: 37, y: 30, label: 'Window · tonight', icon: 'dark_mode', wp: null }
      ],
      home: { x: 48, y: 80, flip: false },
      sleeper: { x: 31, y: 58, w: 21, rot: 34 }, zzz: { x: 30, y: 44 },
      meditator: { x: 28, y: 77, w: 11.5 }, aura: { x: 28, y: 75, w: 18 }, holo: { x: 39, y: 75, w: 15 },
      window: { x: 37.3, y: 31.5, rx: 7, ry: 9.6 },
      props: { cat: { x: 50, y: 88, w: 9 }, dog: { x: 12, y: 74, w: 9.5 }, plant: { x: 78, y: 77, w: 9 }, lamp: { x: 86, y: 73, w: 7 }, mewmew: { x: 63, y: 86, w: 9 } }
    },
    house: {
      id: 'house', name: 'Your dream house', img: 'house-v1.webp', w: 1024, h: 1280, avatarW: 8,
      stairs: [{ x: 46, y: 78 }, { x: 55, y: 57 }], upstairsY: 55,
      hotspots: [
        { id: 'bed', x: 28, y: 46, label: 'Bed · go to sleep', icon: 'bedtime', wp: { x: 44, y: 52, flip: true } },
        { id: 'clock', x: 37, y: 34, label: 'Clock · reminders', icon: 'alarm', wp: { x: 42, y: 52, flip: true } },
        { id: 'calendar', x: 52, y: 38, label: 'Calendar · cycle & symptoms', icon: 'calendar_month', wp: { x: 54, y: 52, flip: false } },
        { id: 'computer', x: 68, y: 64, label: 'Computer · learn', icon: 'computer', wp: { x: 58, y: 80, flip: false } },
        { id: 'wardrobe', x: 67, y: 40, label: 'Wardrobe · outfits', icon: 'checkroom', wp: { x: 62, y: 52, flip: false } },
        { id: 'diary', x: 38, y: 74, label: 'Diary · food journal', icon: 'menu_book', wp: { x: 31, y: 80, flip: false } },
        { id: 'mat', x: 49, y: 83, label: 'Yoga mat · mindfulness with Erin', icon: 'self_improvement', wp: { x: 40, y: 86, flip: true } },
        { id: 'window', x: 48, y: 27, label: 'Window · tonight', icon: 'dark_mode', wp: null },
        { id: 'coach', x: 20, y: 59, label: 'M · everyday mindfulness', icon: 'self_improvement', badge: 'M', wp: { x: 28, y: 80, flip: true } }
      ],
      home: { x: 56, y: 82, flip: false },
      sleeper: { x: 34, y: 44, w: 20, rot: 14 }, zzz: { x: 36, y: 30 },
      meditator: { x: 49, y: 82, w: 8 }, aura: { x: 49, y: 80, w: 13 }, holo: { x: 62, y: 80, w: 10 },
      window: { x: 48, y: 27, rx: 6.8, ry: 5.4 },
      props: { cat: { x: 27, y: 80, w: 7 }, dog: { x: 53, y: 51, w: 7 }, plant: { x: 76, y: 80, w: 7 }, lamp: { x: 76, y: 50, w: 5.5 }, mewmew: { x: 63, y: 85, w: 6.5 } }
    }
  };
  var L = LAYOUTS.room, HOTSPOTS = L.hotspots, HOME = L.home, visiting = null;
  var OUTFITS = [
    { id: 'base', name: 'Cosy knit', note: 'Cream sweater & blush skirt' },
    { id: 'pajamas', name: 'Starry pyjamas', note: 'For sleepy nights' },
    { id: 'sundress', name: 'Blush sundress', note: 'Soft & sweet' },
    { id: 'cozy', name: 'Cloud hoodie', note: 'Lazy Sunday' },
    { id: 'yoga', name: 'Mint yoga set', note: 'Move gently' },
    { id: 'party', name: 'Lilac tulle', note: 'Sparkle day' },
    /* Singapore Girl sarong kebaya (Balmain batik); rank colours: cobalt blue flight stewardess, green leading, red chief */
    { id: 'kebaya-blue', name: 'Blue kebaya', note: 'Flight stewardess' },
    { id: 'kebaya-green', name: 'Green kebaya', note: 'Leading stewardess' },
    { id: 'kebaya-red', name: 'Red kebaya', note: 'Chief stewardess' }
  ];
  var VIDEOS = [
    ['normal', 'normal-v4.mp4', 'A normal cycle', 'What typical looks like'],
    ['hormones', 'hormones-v4.mp4', 'Hormones', 'Oestrogen & progesterone'],
    ['fertile', 'fertile-v4.mp4', 'Fertile window', 'Your most fertile days'],
    ['menarche', 'menarche-v1.mp4', 'First period', 'Menarche explained'],
    ['peri', 'peri-v4.mp4', 'Perimenopause', 'The transition years'],
    ['menopause', 'menopause-v1.mp4', 'Menopause', 'Life after periods']
  ];
  /* desktop folders on the computer */
  var FOLDERS = [
    { id: 'cycle', name: 'Cycle basics', color: '#f6c9d6', items: [['page', 'cycle-home.html', 'bloodtype', 'Your cycle', 'Phases, length and what is typical'], ['page', 'hormones.html', 'show_chart', 'Hormones 101', 'What rises and falls each cycle'], ['video', 'normal', 'A normal cycle', 'What typical looks like'], ['video', 'hormones', 'Hormones', 'Oestrogen & progesterone'], ['page', 'period-start.html', 'water_drop', 'Period start', 'Logging the first day']] },
    { id: 'fertility', name: 'Fertility', color: '#bfe3d4', items: [['page', 'fertility.html', 'spa', 'Fertile window', 'Ovulation signs, explained'], ['video', 'fertile', 'Fertile window', 'Your most fertile days'], ['page', 'journey-grow.html', 'eco', 'Trying to conceive', 'Timing, tests and support'], ['page', 'ovarian-health.html', 'menu_book', 'Understand your records', 'What your entries can and cannot show']] },
    { id: 'chapters', name: 'Life chapters', color: '#c9b6e6', items: [['page', 'life-journey.html', 'auto_stories', 'Your life journey', 'Five chapters, one body'], ['page', 'journey-bloom.html', 'local_florist', 'First cycles', 'Teens and the first years'], ['video', 'menarche', 'First period', 'Menarche explained'], ['page', 'journey-nurture.html', 'favorite', 'After pregnancy', 'Recovery and cycles returning'], ['page', 'journey-peri.html', 'dark_mode', 'Perimenopause', 'Hot flushes, sleep and mood'], ['video', 'peri', 'Perimenopause', 'The transition years'], ['page', 'journey-post.html', 'wb_sunny', 'After menopause', 'Bone, heart and bleeding rules'], ['video', 'menopause', 'Menopause', 'Life after periods']] },
    { id: 'nutrition', name: 'Nutrition', color: '#f3d49b', items: [['page', 'foods.html', 'restaurant', 'Foods by phase', 'TCM and Western notes'], ['page', 'nutrients.html', 'medication', 'Micronutrients', 'Iron, folate, magnesium'], ['page', 'medas14.html', 'nutrition', 'Mediterranean score', 'A 14-point check'], ['page', 'hydration.html', 'water_full', 'Hydration', 'Fluids through the cycle'], ['action', 'diary', 'menu_book', 'Open the food diary', 'Snap, scan or search']] },
    { id: 'mind', name: 'Mind & mood', color: '#b8cde0', items: [['page', 'mindfulness.html', 'self_improvement', 'Mindfulness hub', 'Erin Lee’s pauses and podcasts'], ['link', 'https://erinmindfulmoments.substack.com/p/the-quiet-work-of-change', 'article', 'The Quiet Work of Change', 'Erin’s essay on Substack'], ['page', 'mental-health.html', 'psychology', 'Mood & calm', 'When to reach for support'], ['page', 'breathe.html', 'air', 'Breathing', 'Guided breath'], ['action', 'mat', 'self_improvement', 'Sit on the mat', 'A session with Erin']] },
    { id: 'body', name: 'Body & relief', color: '#f5c6b8', items: [['action', 'acu', 'spa', 'Acupressure on your avatar', 'Points for cramps, with evidence'], ['page', 'sleep.html', 'bedtime', 'Sleep & your cycle', 'Why some weeks feel lighter'], ['page', 'face-ppg.html', 'monitor_heart', 'Calm check (beta)', 'Pulse from your face camera'], ['page', 'ppg.html', 'fingerprint', 'Finger pulse', 'Camera and flash'], ['page', 'stress.html', 'self_improvement', 'Stress check-in', 'PSS-10 questionnaire']] },
    { id: 'videos', name: 'All videos', color: '#e7dcf5', items: VIDEOS.map(function (v) { return ['video', v[0], v[2], v[3]]; }) },
    { id: 'doctor', name: 'Share with doctor', color: '#ffffff', items: [['page', 'journal.html#share', 'medical_services', 'Dr shares card', 'Your 4-week summary'], ['page', 'doctor.html', 'stethoscope', 'Doctor view', 'How your clinician opens it']] }
  ];
  var PHASE_TIPS = {
    menstrual: { title: 'Menstrual phase', text: 'Iron-rich and warming foods help many people feel steadier while bleeding.' },
    follicular: { title: 'Follicular phase', text: 'Energy often rises. Fresh vegetables, fermented foods and lean protein suit this stretch.' },
    ovulatory: { title: 'Ovulatory phase', text: 'Lighter, fibre-rich meals with plenty of colour tend to feel good now.' },
    luteal: { title: 'Luteal phase', text: 'Magnesium and slow carbs can soften cravings and support sleep before a period.' },
    late: { title: 'Past your usual length', text: 'Keep eating regularly and note how you feel; a late period is worth a note in your journal.' },
    none: { title: 'Any phase', text: 'A balanced plate with protein, colour and slow carbs is a good default while your pattern builds.' }
  };
  /* Erin's clips and the captions shown while they play */
  var ERIN = 'assets/audio/erin-tts/';
  var CAPTION = { greeting_morning: 'Erin says good morning', greeting_evening: 'Erin says good evening', greeting_welcome: 'Welcome', meditation_begin: 'Settling in', breathing_in: 'Breathe in', breathing_out: 'Breathe out', meditation_end: 'Coming back', closing_steady: 'Steady, and done', closing_patience: 'Patience, and done', guide_soften: 'Let your shoulders soften, and notice the breath moving on its own.', guide_nothing_to_fix: 'There is nothing to fix right now. Just this one breath.', guide_quiet_work: 'Change is quiet work. One small, kind choice at a time.', guide_wander: 'When your mind wanders, that is not a mistake. Gently come back.', guide_feet: 'Feel your feet, your seat, and the weight of your hands.', guide_thanks: 'Before you go, thank yourself for pausing today.', guide_cramps: 'If there is cramping, breathe into your belly and let it be soft.' };
  /* acupoint markers on the standing avatar sprite (percent of the image) */
  var ACU_XY = { cv6: [50, 66], cv4: [50, 70.5], cv3: [50, 75], st29: [57, 75], sp10: [54, 82.5], st36: [41, 87.5], sp6: [48, 94], ki3: [50, 96.5], lr3: [44, 98.5], li4: [70, 74.5], pc6: [69, 69.5] };
  var ACU_CAUTION = { sp6: 'SP6 is traditionally avoided in pregnancy. Ask your clinician before using it if you are or might be pregnant.', li4: 'LI4 is traditionally avoided in pregnancy. Ask your clinician before using it if you are or might be pregnant.' };

  /* ---------- evidence guides behind every (i) ---------- */
  function padSVG(level) {
    var fills = { spotting: 0.08, light: 0.25, medium: 0.55, heavy: 0.95 }[level] || 0;
    var w = Math.round(44 * fills), clots = level === 'heavy' ? '<circle cx="26" cy="24" r="3.4" fill="#7a1f3a"/><circle cx="36" cy="30" r="2.6" fill="#7a1f3a"/>' : '';
    var dots = level === 'spotting' ? '<circle cx="30" cy="26" r="1.8" fill="#c1517a"/><circle cx="37" cy="31" r="1.3" fill="#c1517a"/>' : '';
    return '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="6" y="10" width="52" height="28" rx="14" fill="#fff" stroke="#e5d7f0" stroke-width="2"/>' +
      (fills > 0.1 ? '<rect x="' + (32 - w / 2) + '" y="14" width="' + w + '" height="20" rx="10" fill="' + (level === 'heavy' ? '#b43f68' : level === 'medium' ? '#dd6f94' : '#f3b9cb') + '"/>' : '') + dots + clots + '</svg>';
  }
  var GUIDES = {
    bleeding: {
      icon: 'water_drop', title: 'What light, medium and heavy mean',
      body: '<div class="flows">' +
        '<div class="flow">' + padSVG('spotting') + '<b>Spotting</b><small>A few drops; a liner is enough</small></div>' +
        '<div class="flow">' + padSVG('light') + '<b>Light</b><small>A pad or tampon lasts most of the day</small></div>' +
        '<div class="flow">' + padSVG('medium') + '<b>Medium</b><small>Change about every 3 to 4 hours</small></div>' +
        '<div class="flow">' + padSVG('heavy') + '<b>Heavy</b><small>Change every 1 to 2 hours, clots over 2.5 cm, leaks</small></div></div>' +
        '<p>Heavy bleeding is defined by its effect on your life, not a number. Signs the NHS lists: changing protection every 1 to 2 hours, clots larger than about 2.5 cm (a 10p coin), bleeding through clothes or bedding, needing two products together, or periods longer than 7 days. Tick <b>Clots</b> and <b>Affected my day</b> on those days so the pattern is visible to your clinician.</p>',
      evidence: [
        ['NHS, Heavy periods: signs of heavy bleeding (2.5 cm clots, 1 to 2 hourly changes, bleeding through, 7+ days)', 'https://www.nhs.uk/conditions/heavy-periods/'],
        ['NICE NG88 (2018, updated 2021): heavy menstrual bleeding is excessive loss that interferes with physical, emotional, social and material quality of life', 'https://www.nice.org.uk/guidance/ng88'],
        ['Higham, O’Brien & Shaw 1990, BJOG: pictorial blood loss assessment chart; a score of 100 or more corresponds to about 80 mL loss', 'https://doi.org/10.1111/j.1471-0528.1990.tb16249.x'],
        ['FIGO AUB System 1 (Munro et al. 2018): typical cycle 24 to 38 days, bleeding up to 8 days', 'https://doi.org/10.1002/ijgo.12666']
      ]
    },
    pain: {
      icon: 'spa', title: 'The 0 to 10 pain scale',
      body: '<div class="scale"><div><b>0</b><small>No pain</small></div><div><b>1 to 3</b><small>Mild, easy to ignore</small></div><div><b>4 to 6</b><small>Moderate, hard to ignore</small></div><div><b>7 to 10</b><small>Severe, stops normal activity</small></div></div><p>Rate the worst pain of the day. Period pain that reaches 7 or more, needs time off, or does not respond to usual pain relief is worth a conversation; the app flags 8 or more.</p>',
      evidence: [
        ['Hjermstad et al. 2011, J Pain Symptom Manage: systematic review supporting 0 to 10 numeric rating scales for pain intensity', 'https://doi.org/10.1016/j.jpainsymman.2010.08.016'],
        ['NHS guidance: period pain affecting daily life warrants assessment', 'https://www.nhs.uk/conditions/period-pain/']
      ]
    },
    sleep: {
      icon: 'bedtime', title: 'How the sleep notes work',
      body: '<p>Duration is bedtime to wake time, so it counts time in bed rather than measured sleep. Quality is your own 1 to 5 rating. The app notes weeks averaging under 6 hours and runs of three nights under 5 hours.</p>',
      evidence: [['American Academy of Sleep Medicine and Sleep Research Society consensus (Watson et al. 2015, Sleep): adults should sleep 7 or more hours per night on a regular basis', 'https://doi.org/10.5665/sleep.4716']]
    },
    food: {
      icon: 'restaurant', title: 'Where the numbers come from',
      body: '<p>Nutrients are calculated as <b>value per 100 g × grams you confirm ÷ 100</b>. Generic foods use USDA FoodData Central (SR Legacy, per 100 g edible portion, with USDA household measures). Barcodes use Open Food Facts label transcriptions, kept per 100 g or 100 ml as published. Missing values show as <b>?</b> and are left out of totals rather than counted as zero. Carbohydrate follows USDA “by difference” and already includes fibre. Phase picks come from the Ovuluna food notes (TCM and Western), matched to USDA entries where one exists.</p><p>Photos are kept only as a reminder. In a 2026 NIH controlled test, photo-only apps under-counted meals by about a third, mostly hidden fats and portions, which is why you confirm the food and the amount here.</p>',
      evidence: [
        ['USDA FoodData Central, SR Legacy data and documentation', 'https://fdc.nal.usda.gov/'],
        ['Open Food Facts API and data fields', 'https://openfoodfacts.github.io/openfoodfacts-server/api/'],
        ['NIH-led evaluation of photo-based calorie apps, NUTRITION 2026 (preliminary conference abstract)', 'https://www.eurekalert.org/news-releases/1136415']
      ]
    },
    cycle: {
      icon: 'calendar_month', title: 'How predictions are made',
      body: '<p>The next period is estimated from the average of your last logged cycles (or your profile setting, or 28 days until there is history). The fertile window shown is a calendar estimate around 14 days before the expected period and is not a contraceptive method. Tapping a past day fills a typical period length so you can backdate quickly, then adjust any day.</p>',
      evidence: [['FIGO AUB System 1 (Munro et al. 2018): normal frequency 24 to 38 days, regularity within 7 to 9 days, duration up to 8 days', 'https://doi.org/10.1002/ijgo.12666']]
    },
    acu: {
      icon: 'spa', title: 'What the research says about acupressure',
      body: '<p>Studies of acupressure for primary period pain are promising but limited: reviews describe low-quality evidence, mixed results for SP6 alone, and small trials that combine points. Gentle pressure is low risk for most people; it is not a treatment for pelvic pain that limits your life, which deserves clinical assessment.</p>',
      evidence: []
    },
    reminders: {
      icon: 'alarm', title: 'Why these four nudges',
      body: '<p>Regular sleep and wake times, water through the day, short movement breaks and a couple of minutes of slow breathing are the everyday habits with the broadest support for sleep, energy and mood. The clock reminds you; it does not track whether you did it. Notifications depend on your phone: they fire while Ovumind is open or installed to the Home Screen, and the calendar file gives you alarms that always ring.</p>',
      evidence: [
        ['American Academy of Sleep Medicine and Sleep Research Society consensus (Watson et al. 2015, Sleep): 7 or more hours on a regular schedule', 'https://doi.org/10.5665/sleep.4716'],
        ['WHO 2020 guidelines on physical activity and sedentary behaviour: limit sitting time and replace it with activity of any intensity', 'https://www.who.int/publications/i/item/9789240015128'],
        ['EFSA 2010 scientific opinion on dietary reference values for water: adequate total water intake 2.0 L a day for women', 'https://doi.org/10.2903/j.efsa.2010.1459'],
        ['Zaccaro et al. 2018, Frontiers in Human Neuroscience: slow breathing techniques and psychophysiological outcomes, systematic review', 'https://doi.org/10.3389/fnhum.2018.00353']
      ]
    },
    luna: {
      icon: 'dark_mode', title: 'How Luna reads your notes',
      body: '<p>Luna first tries simple rules on this device (sleep times, period words, the symptom list, pain out of 10, mood words, meal words, minutes of practice). If the rules cannot read a note, Luna’s own model reads it: the note alone (no name, no history) goes through a small Ovumind relay to a Doubao model, the reply is shown to you for confirmation, and nothing is stored on the way. You can switch to your own OpenRouter or Ark key, or turn AI off and keep the rules only. Luna never diagnoses.</p>',
      evidence: [['Model: Doubao Seed 2.1 turbo on Volcengine Ark, strict JSON, temperature 0; relay allows about 80 notes a day per person', 'https://www.volcengine.com/docs/82379'], ['Own-key default: jev-1.13.0 preferred Gemini 2.5 Flash-Lite for cost and strict JSON (0.73), Qwen3 30B as runner-up', 'https://openrouter.ai/models']]
    }
  };
  function infoBtn(topic) { return '<button type="button" class="ibtn" data-guide="' + topic + '" aria-label="Evidence and guidance">i</button>'; }
  function guideHTML(topic) { var g = GUIDES[topic]; if (!g) return ''; return '<div class="guide" data-guide-panel="' + topic + '"><h4><span class="ms">' + g.icon + '</span>' + esc(g.title) + '</h4>' + g.body + '<div class="ev"><b>Evidence</b>' + g.evidence.map(function (e) { return '<a href="' + e[1] + '" target="_blank" rel="noopener">' + esc(e[0]) + '</a>'; }).join('') + '<span>Guidance, not a diagnosis. Bring the pattern to a clinician you trust.</span></div></div>'; }
  function wireGuides(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.ibtn'); if (!b) return;
      var panel = root.querySelector('.guide[data-guide-panel="' + b.dataset.guide + '"]'); if (!panel) return;
      var on = !panel.classList.contains('on'); panel.classList.toggle('on', on); b.classList.toggle('on', on);
      if (on) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function prettyDate(iso, opts) { var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function loadJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  var toastTimer;
  function toast(text, icon) {
    var t = $('#toast'); t.innerHTML = '<span class="ms">' + esc(icon || 'auto_awesome') + '</span><span>' + esc(text) + '</span>';
    t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  var audioCtx = null;
  function chime(kind, force) {
    if (!S.state().sound && !force) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = kind === 'save' ? 880 : kind === 'sleep' ? 392 : kind === 'bell' ? 523 : 660;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(kind === 'bell' ? 0.12 : 0.08, audioCtx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (kind === 'bell' ? 1.2 : 0.35));
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + (kind === 'bell' ? 1.3 : 0.4));
    } catch (e) { /* no audio */ }
  }

  /* ---------- scene build ---------- */
  var scene = $('#scene'), inner = $('#sceneInner'), avatar = $('#avatar'), avatarImg = $('#avatarImg'), sleeper = $('#sleeper'), meditator = $('#meditator'), holo = $('#holo'), hud = $('#hud');
  function buildHotspots() {
    var hs = $('#hotspots'); hs.innerHTML = '';
    HOTSPOTS.forEach(function (h) {
      var b = document.createElement('button');
      b.className = 'hotspot'; b.type = 'button'; b.dataset.id = h.id; b.setAttribute('aria-label', h.label);
      b.style.left = h.x + '%'; b.style.top = h.y + '%';
      if (h.badge) b.classList.add('m');
      b.innerHTML = '<span class="glow"></span>' + (h.badge ? '<span class="mbadge" aria-hidden="true">' + h.badge + '</span>' : '<span class="pulse" aria-hidden="true"></span>') + '<span class="tip" aria-hidden="true">' + esc(h.label.split(' · ')[1] ? cap(h.label.split(' · ')[1]) : h.label) + '</span>';
      b.addEventListener('click', function () { tap(h); });
      hs.appendChild(b);
    });
  }
  function place(el, p) { if (!el || !p) return; el.style.left = p.x + '%'; el.style.top = p.y + '%'; if (p.w) el.style.width = p.w + '%'; }
  function houseItem() { return RW.SHOP.filter(function (s) { return s.id === 'house'; })[0]; }
  function currentHomeId() { return S.state().home === 'house' && RW.ledger().owned.indexOf('house') > -1 ? 'house' : 'room'; }
  /* Switch the plate and every percent-positioned overlay to a layout; asVisit previews without moving in. */
  function applyLayout(id, asVisit) {
    L = LAYOUTS[id] || LAYOUTS.room; HOTSPOTS = L.hotspots; HOME = L.home; visiting = asVisit ? L.id : null;
    scene.style.aspectRatio = L.w + '/' + L.h; scene.dataset.layout = L.id;
    if (dayImg.getAttribute('src') !== ART + L.img) dayImg.src = ART + L.img;
    dayImg.width = L.w; dayImg.height = L.h;
    buildHotspots();
    avatar.style.width = L.avatarW + '%';
    place(sleeper, L.sleeper); sleeper.style.transform = 'translate(-50%,-50%) rotate(' + L.sleeper.rot + 'deg)';
    place($('.zzz'), L.zzz); place(meditator, L.meditator); place($('#aura'), L.aura); place(holo, L.holo);
    var mp = $('#matProp'); if (mp) { mp.style.display = L.mat ? '' : 'none'; if (L.mat) place(mp, L.mat); }
    var wn = $('#winNight'); if (wn) { wn.style.left = L.window.x + '%'; wn.style.top = L.window.y + '%'; wn.style.width = (L.window.rx * 2) + '%'; wn.style.height = (L.window.ry * 2) + '%'; }
    var vb = $('#visitBar'); if (vb) { vb.classList.toggle('on', !!visiting); vb.innerHTML = visiting ? '<span class="ms">cottage</span><span>Visiting the dream house · <b>' + houseItem().cost + ' ♥ to move in</b></span><button type="button" id="visitBack"><span class="ms">arrow_back</span>Back</button>' : ''; }
    renderProps(); placeAvatar(HOME, false);
  }
  function buildScene() {
    var aura = document.createElement('div'); aura.className = 'aura'; aura.id = 'aura'; inner.insertBefore(aura, meditator);
    var sp = $('#sparkles');
    for (var i = 0; i < 14; i++) { var s = document.createElement('i'); s.className = 'sparkle'; s.style.left = (5 + Math.random() * 90) + '%'; s.style.top = (4 + Math.random() * 60) + '%'; s.style.animationDelay = (Math.random() * 4) + 's'; s.style.animationDuration = (3 + Math.random() * 3) + 's'; sp.appendChild(s); }
    var st = $('#stars');
    for (var j = 0; j < 26; j++) { var z = document.createElement('i'); z.className = 'star'; z.style.left = (2 + Math.random() * 96) + '%'; z.style.top = (2 + Math.random() * 40) + '%'; z.style.animationDelay = (Math.random() * 3) + 's'; z.style.transform = 'scale(' + (0.5 + Math.random()) + ')'; st.appendChild(z); }
    if (!reduced && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      scene.addEventListener('pointermove', function (e) { var r = scene.getBoundingClientRect(); var dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5; inner.style.transform = 'rotateY(' + (dx * 4) + 'deg) rotateX(' + (-dy * 3) + 'deg) scale(1.02)'; });
      scene.addEventListener('pointerleave', function () { inner.style.transform = ''; });
    }
    applyLayout(currentHomeId(), false);
  }
  /* where an owned prop sits: the user's own arrangement, else the layout default, else the shop default */
  function propPosFor(it) { var pp = (S.state().propPos || {})[L.id] || {}; var o = pp[it.id]; var base = (L.props && L.props[it.id]) || it.pos; if (!base) return null; return o ? { x: o.x, y: o.y, w: base.w } : base; }
  /* owned props from the reward shop, placed per layout */
  function renderProps() {
    var l = RW.ledger(), wrap = $('#ownedProps'); wrap.innerHTML = '';
    RW.SHOP.forEach(function (it) {
      if (!it.img || it.kind === 'home' || l.owned.indexOf(it.id) < 0 || !l.placed[it.id]) return;
      var p = propPosFor(it); if (!p) return;
      var d = document.createElement('div'); d.className = 'prop owned ' + it.kind; d.dataset.id = it.id; d.style.left = p.x + '%'; d.style.top = p.y + '%'; d.style.width = p.w + '%';
      d.innerHTML = '<img src="' + ART + it.img + '" alt="">'; wrap.appendChild(d);
    });
    $('#heartsVal').textContent = l.hearts;
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
  function sameFloor(a, b) { if (!L.stairs) return true; return (a.y < L.upstairsY) === (b.y < L.upstairsY); }
  function walkTo(wp, done) {
    if (wp && !reduced && !sameFloor(pos, wp)) {
      var up = wp.y < L.upstairsY, seq = (up ? L.stairs.slice() : L.stairs.slice().reverse()).concat([wp]), i = 0;
      (function next() { if (i >= seq.length) { done && done(); return; } walkLeg(seq[i++], next); })();
      return;
    }
    walkLeg(wp, done);
  }
  function walkLeg(wp, done) {
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
      scheduleLife(); done && done();
    }, ms + 30);
  }
  function goHome() { clearTimeout(idleTimer); idleTimer = setTimeout(function () { if (!S.state().sleeping && !meditating) walkTo(HOME); }, 1400); }

  /* ---------- sheets ---------- */
  var sheet = $('#sheet'), veil = $('#veil'), body = $('#sheetBody'), current = null;
  function openSheet(id, title, sub, icon, html) {
    if (current === 'diary') stopCamera();
    current = id; $('#sheetTitle').innerHTML = esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('#sheetIcon').innerHTML = '<span class="ms">' + esc(icon) + '</span>';
    /* a fresh body node each time, so listeners from the previous sheet (or a re-render of this one) never pile up */
    var fresh = body.cloneNode(false); body.parentNode.replaceChild(fresh, body); body = fresh; wireGuides(body);
    body.innerHTML = html; body.scrollTop = 0;
    sheet.classList.add('on'); veil.classList.add('on'); scene.classList.add('quiet');
    sheet.setAttribute('aria-hidden', 'false');
    var first = body.querySelector('input,button,select,textarea,a'); if (first && window.matchMedia('(hover:hover)').matches) try { first.focus({ preventScroll: true }); } catch (e) { }
  }
  function hideSheet() { current = null; scheduleLife(); sheet.classList.remove('on'); veil.classList.remove('on'); scene.classList.remove('quiet'); sheet.setAttribute('aria-hidden', 'true'); }
  function closeSheet() {
    if (current === 'diary') stopCamera();
    if (current === 'mind' && session) stopSession(true);
    if (current === 'mind' && !session && meditating) exitMeditation();
    hideSheet(); stopVideo(); goHome();
  }
  veil.addEventListener('click', closeSheet); $('#sheetClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); hideBubble(); } });
  wireGuides(body);
  function message(el, text, ok) { el.textContent = text; el.className = 'msg on ' + (ok ? 'ok' : 'err'); }

  /* ---------- tap routing ---------- */
  function tap(h) {
    var btn = $('.hotspot[data-id="' + h.id + '"]'); if (btn) { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); }
    chime('tap'); hideBubble(); clearTimeout(idleTimer); /* a pending walk home must not cancel this walk */
    var visited = S.state().visited || {}; visited[h.id] = true; S.setState({ visited: visited });
    $('#hint').classList.remove('on');
    if (h.id === 'window') { openWindow(); return; }
    if ((S.state().sleeping && h.id !== 'bed' && h.id !== 'clock') || meditating) { openSheetFor(h.id); return; }
    walkTo(h.wp, function () { openSheetFor(h.id); });
  }
  function hotspot(id) { return HOTSPOTS.filter(function (h) { return h.id === id; })[0]; }
  function openSheetFor(id) {
    if (id === 'bed') return S.state().sleeping ? openWake() : openBedtime();
    if (id === 'clock') return openClock();
    if (id === 'calendar') return openCalendar('period');
    if (id === 'computer') return openLearn();
    if (id === 'wardrobe') return openWardrobe();
    if (id === 'diary') return openDiary();
    if (id === 'mat') return openMindfulness();
    if (id === 'coach') return openEveryday();
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
      enterNight(true); closeSheet(); chime('sleep'); if (S.state().sound) new Audio(ERIN + 'night_sweet_dreams.mp3').play().catch(function () { });
      toast('Sweet dreams. Tap the bed when you wake up.', 'dark_mode');
    });
  }
  function openWake() {
    var sl = S.state().sleeping || {};
    openSheet('wake', 'Good morning!', 'Finish last night’s sleep entry', 'wb_twilight',
      '<div class="stat"><span class="ms">bedtime</span><div><b>Bedtime ' + esc(sl.bedTime || '--:--') + '</b><span>Started ' + esc(sl.startedAt ? new Date(sl.startedAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '</span></div></div>' +
      '<div class="grid2"><div class="field"><label for="wakeTime">Wake time</label><input class="input" id="wakeTime" type="time" value="' + nowHM() + '"></div><div class="field"><label for="wakeDate">Morning of</label><input class="input" id="wakeDate" type="date" value="' + S.today() + '" max="' + S.today() + '"></div></div>' +
      '<div class="field"><div class="lbl-row"><span class="lbl">How did you sleep?</span>' + infoBtn('sleep') + '</div>' + moonsHTML('q', 0) + guideHTML('sleep') + '</div>' +
      '<div class="field"><label for="wakeNotes">Notes (optional)</label><textarea class="input" id="wakeNotes" placeholder="Woke twice, vivid dreams, warm night..."></textarea></div>' +
      '<div class="row"><button class="btn primary" id="saveWake"><span class="ms">wb_sunny</span>Save my sleep</button><button class="btn ghost" id="cancelSleep">I did not sleep</button></div>' +
      '<div class="msg" id="sleepMsg"></div>');
    wireMoons(body);
    if (S.state().sound) new Audio(ERIN + 'morning_how.mp3').play().catch(function () { });
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
  /* ---------- bedside clock: reminders you set yourself ---------- */
  var RM = window.OvuRemind;
  var DAYN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], DAYF = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function clockTabs(on) { return '<div class="tabs" id="clockTabs"><button type="button" data-tab="reminders" class="' + (on === 'reminders' ? 'on' : '') + '">Reminders</button><button type="button" data-tab="sleep" class="' + (on === 'sleep' ? 'on' : '') + '">Record a night</button></div>'; }
  function wireClockTabs() { var t = $('#clockTabs'); if (!t) return; t.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; chime('tap'); if (b.dataset.tab === 'sleep') openSleepRecord(); else openClock(); }); }
  function daysText(days) { if (days.length === 7) return 'Every day'; if (days.join() === '1,2,3,4,5') return 'Weekdays'; if (days.join() === '0,6') return 'Weekends'; return days.map(function (d) { return DAYF[d].slice(0, 3); }).join(', '); }
  function fmtTime(t) { var h = Number(t.slice(0, 2)), m = t.slice(3), ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (m === '00' ? '' : ':' + m) + ap; }
  function permBox() {
    var p = RM.permission(), ios = RM.isIOS() && !RM.standalone();
    if (!RM.supported() || ios) return '<div class="stat"><span class="ms">ios_share</span><div><b>' + (ios ? 'Add Ovumind to your Home Screen for notifications' : 'This browser cannot show notifications') + '</b><span>' + (ios ? 'In Safari tap Share, then “Add to Home Screen”, and open Ovumind from there. Or add the reminders to your calendar below; those alarms always ring.' : 'Add the reminders to your calendar below instead; those alarms always ring.') + '</span></div></div>';
    if (p === 'granted') return '<div class="stat"><span class="ms">notifications_active</span><div><b>Notifications are on</b><span>They fire while Ovumind is open or installed. For alarms that always ring, add them to your calendar too.</span></div></div>';
    if (p === 'denied') return '<div class="stat"><span class="ms">notifications_off</span><div><b>Notifications are blocked</b><span>Allow them for this site in your browser settings, or add the reminders to your calendar below.</span></div></div>';
    return '<div class="stat"><span class="ms">notifications</span><div><b>Allow notifications</b><span>So the clock can nudge you at the times you choose.</span></div><button type="button" class="btn soft" id="remAllow" style="flex:0 0 auto">Allow</button></div>';
  }
  function reminderRow(it) {
    var next = RM.nextFor(it);
    return '<div class="rem' + (it.on ? '' : ' off') + '"><span class="ms ico">' + esc(it.icon) + '</span><div class="body"><b>' + esc(it.label) + '</b><span>' + it.times.map(fmtTime).join(' · ') + ' · ' + esc(daysText(it.days)) + '</span>' + (next && it.on ? '<small>Next ' + esc(next.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + '</small>' : '') + '</div><button type="button" class="pen" data-edit="' + it.id + '" aria-label="Edit ' + esc(it.label) + '"><span class="ms">edit</span></button><button type="button" class="sw' + (it.on ? ' on' : '') + '" role="switch" aria-checked="' + (it.on ? 'true' : 'false') + '" data-toggle="' + it.id + '" aria-label="' + (it.on ? 'Turn off ' : 'Turn on ') + esc(it.label) + '"><i></i></button></div>';
  }
  function timeChips(times) { return times.map(function (t) { return '<span class="chipbtn on tm" data-t="' + t + '">' + fmtTime(t) + '<button type="button" aria-label="Remove ' + fmtTime(t) + '">×</button></span>'; }).join(''); }
  function openClock(editItem) {
    var items = RM.list();
    openSheet('clock', 'Bedside clock', 'Gentle nudges, set by you', 'alarm',
      clockTabs('reminders') + permBox() +
      '<div class="field"><div class="lbl-row"><span class="lbl">Your reminders</span>' + infoBtn('reminders') + '</div>' + guideHTML('reminders') + '<div class="rems" id="rems">' + (items.length ? items.map(reminderRow).join('') : '<div class="empty">No reminders yet. Start with one of the templates below.</div>') + '</div></div>' +
      '<div class="field"><span class="lbl">Add one</span><div class="chips">' + RM.TEMPLATES.map(function (t) { return '<button type="button" class="chipbtn" data-tpl="' + t.kind + '"><span class="ms">' + t.icon + '</span>' + esc({ sleep: 'Sleep', water: 'Water', move: 'Move', breathe: 'Breathe' }[t.kind] || t.label) + '</button>'; }).join('') + '<button type="button" class="chipbtn" data-tpl="custom"><span class="ms">add</span>Custom</button></div></div>' +
      '<div class="remedit" id="remEdit"></div>' +
      '<div class="row"><button type="button" class="btn soft" id="remIcs"><span class="ms">event</span>Add to my calendar</button><button type="button" class="btn ghost" id="remTest"><span class="ms">notifications</span>Send a test</button></div>' +
      '<p class="help">Reminders live on this device. Notifications fire while Ovumind is open or installed to your Home Screen; the calendar file carries the same reminders, with alarms, into your phone’s own calendar.</p>');
    wireClockTabs();
    function editor(it) {
      var old = $('#remEdit'), ed = old.cloneNode(false); old.parentNode.replaceChild(ed, old);
      ed.innerHTML = '<div class="editcard"><div class="field"><label for="remLabel">What should it say?</label><input class="input" id="remLabel" maxlength="60" value="' + esc(it.label) + '" placeholder="e.g. Take iron with orange juice"></div>' +
        '<div class="field"><span class="lbl">Icon</span><div class="chips icons">' + RM.ICONS.map(function (ic) { return '<button type="button" class="chipbtn' + (ic === it.icon ? ' on' : '') + '" data-icon="' + ic + '" aria-label="' + ic.replace(/_/g, ' ') + '"><span class="ms">' + ic + '</span></button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">Times</span><div class="chips" id="remTimes">' + timeChips(it.times) + '</div><div class="row" style="margin-top:8px"><input class="input" id="remNewTime" type="time" value="09:00"><button type="button" class="btn soft" id="remAddTime" style="flex:0 0 auto"><span class="ms">add</span>Add time</button></div></div>' +
        '<div class="field"><span class="lbl">Days</span><div class="chips days" id="remDays">' + DAYN.map(function (d, i) { return '<button type="button" class="chipbtn' + (it.days.indexOf(i) > -1 ? ' on' : '') + '" data-day="' + i + '" aria-label="' + DAYF[i] + '">' + d + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="remNote">Note shown with it (optional)</label><input class="input" id="remNote" maxlength="160" value="' + esc(it.note || '') + '"></div>' +
        '<div class="row"><button type="button" class="btn primary" id="remSave"><span class="ms">check</span>Save reminder</button>' + (it.id ? '<button type="button" class="btn ghost" id="remDelete">Delete</button>' : '<button type="button" class="btn ghost" id="remCancel">Cancel</button>') + '</div><div class="msg" id="remMsg"></div></div>';
      ed.classList.add('on'); ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      var icon = it.icon, times = it.times.slice(), days = it.days.slice();
      ed.addEventListener('click', function (e) {
        var ic = e.target.closest('[data-icon]'); if (ic) { icon = ic.dataset.icon; $$('[data-icon]', ed).forEach(function (b) { b.classList.toggle('on', b === ic); }); return; }
        var dy = e.target.closest('[data-day]'); if (dy) { var d = Number(dy.dataset.day); days = days.indexOf(d) > -1 ? days.filter(function (x) { return x !== d; }) : days.concat([d]); dy.classList.toggle('on', days.indexOf(d) > -1); return; }
        var rm = e.target.closest('.tm button'); if (rm) { var t = rm.parentNode.dataset.t; times = times.filter(function (x) { return x !== t; }); rm.parentNode.remove(); return; }
        if (e.target.closest('#remAddTime')) { var nt = $('#remNewTime').value; if (RM.valid(nt) && times.indexOf(nt) < 0) { times.push(nt); times.sort(); $('#remTimes').innerHTML = timeChips(times); } return; }
        if (e.target.closest('#remSave')) { try { RM.upsert({ id: it.id, kind: it.kind, label: $('#remLabel').value, icon: icon, times: times, days: days, note: $('#remNote').value, on: it.on !== false }); chime('save'); toast('Reminder saved.', 'alarm'); openClock(); } catch (err) { message($('#remMsg'), err.message, false); } return; }
        if (e.target.closest('#remDelete')) { RM.remove(it.id); toast('Reminder removed.', 'alarm'); openClock(); return; }
        if (e.target.closest('#remCancel')) { ed.classList.remove('on'); ed.innerHTML = ''; }
      });
    }
    body.addEventListener('click', function (e) {
      var tpl = e.target.closest('[data-tpl]'); if (tpl) { chime('tap'); editor(RM.fromTemplate(tpl.dataset.tpl)); return; }
      var ed = e.target.closest('[data-edit]'); if (ed) { editor(RM.get(ed.dataset.edit)); return; }
      var tg = e.target.closest('[data-toggle]'); if (tg) { RM.toggle(tg.dataset.toggle); chime('tap'); openClock(); return; }
      if (e.target.closest('#remAllow')) { RM.requestPermission().then(function (p) { if (p === 'granted') RM.notify('Ovumind', 'Reminders are on. I will nudge you gently.', 'ovumind-test'); openClock(); }); return; }
      if (e.target.closest('#remIcs')) { if (!RM.list().some(function (x) { return x.on; })) { toast('Add a reminder first.', 'alarm'); return; } RM.download(); toast('Calendar file ready. Open it to add the alarms.', 'event'); return; }
      if (e.target.closest('#remTest')) { RM.notify('Ovumind', 'This is how a reminder looks.', 'ovumind-test').then(function (ok) { toast(ok ? 'Sent. Check your notifications.' : 'Allow notifications first, or use the calendar file.', 'notifications'); }); }
    });
    if (editItem) editor(editItem);
  }
  function openSleepRecord() {
    openSheet('sleep', 'Bedside clock', 'Record any night, any date', 'alarm',
      clockTabs('sleep') + '<div class="grid2"><div class="field"><label for="slDate">Morning of</label><input class="input" id="slDate" type="date" value="' + S.today() + '" max="' + S.today() + '"></div><div class="field"><label for="slBed">Bedtime</label><input class="input" id="slBed" type="time" value="23:00"></div></div>' +
      '<div class="grid2"><div class="field"><label for="slWake">Wake time</label><input class="input" id="slWake" type="time" value="07:00"></div><div class="field"><div class="lbl-row"><span class="lbl">Quality</span>' + infoBtn('sleep') + '</div>' + moonsHTML('q', 0) + '</div></div>' + guideHTML('sleep') +
      '<div class="field"><label for="slNotes">Notes (optional)</label><textarea class="input" id="slNotes" placeholder="Night sweats, cramps, late coffee..."></textarea></div>' +
      '<button class="btn primary" id="saveSleep" style="width:100%"><span class="ms">check</span>Save night</button><div class="msg" id="sleepMsg"></div>' +
      '<div class="field"><span class="lbl">Last 7 nights</span><div id="sleepList">' + sleepListHTML() + '</div></div>');
    wireMoons(body); wireClockTabs();
    $('#saveSleep').addEventListener('click', function () {
      try {
        var q = Number($('.moons', body).dataset.value || 0) || null;
        if (!S.validTime($('#slBed').value) || !S.validTime($('#slWake').value)) throw new Error('Enter both bedtime and wake time.');
        var ev = S.add('sleep', $('#slDate').value, { bedTime: $('#slBed').value, wakeTime: $('#slWake').value, quality: q, notes: $('#slNotes').value.trim(), mode: 'manual' });
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

  /* ---------- calendar: period (5-day fill) + symptoms with backdating ---------- */
  var cal = { y: 0, m: 0, tab: 'period', sel: S.today(), lastFill: [] };
  function openCalendar(tab, date) {
    var d = new Date(); cal.y = d.getFullYear(); cal.m = d.getMonth(); cal.tab = tab || 'period'; cal.sel = date || S.today(); cal.lastFill = [];
    openSheet('calendar', 'Your calendar', 'Tap a past day to log or backdate', 'calendar_month',
      '<div class="tabs" id="calTabs"><button data-tab="period" class="' + (cal.tab === 'period' ? 'on' : '') + '">Period</button><button data-tab="symptom" class="' + (cal.tab === 'symptom' ? 'on' : '') + '">Symptoms</button></div>' +
      '<div class="cal-head"><button class="cal-nav" id="calPrev" aria-label="Previous month"><span class="ms">chevron_left</span></button><b id="calTitle"></b><button class="cal-nav" id="calNext" aria-label="Next month"><span class="ms">chevron_right</span></button></div>' +
      '<div class="cal-grid" id="calGrid" role="grid"></div>' +
      '<div class="legend"><span><i style="background:#e58aa8"></i>Period</span><span><i style="background:repeating-linear-gradient(135deg,#fff 0 3px,#f6e3ea 3px 6px);border:1px solid #f0cfdb"></i>Expected</span><span><i style="background:#eaf5ee;border:1px solid #cfe6d8"></i>Est. fertile</span><span><i style="background:#7a5c96;border-radius:50%"></i>Symptoms</span>' + infoBtn('cycle') + '</div>' + guideHTML('cycle') +
      '<div id="cycleStat"></div><div class="day-editor" id="dayEditor"></div>');
    $('#calTabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cal.tab = b.dataset.tab; $$('button', $('#calTabs')).forEach(function (x) { x.classList.toggle('on', x === b); }); renderEditor(); });
    $('#calPrev').addEventListener('click', function () { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } renderCal(); });
    $('#calNext').addEventListener('click', function () { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } renderCal(); });
    $('#calGrid').addEventListener('click', function (e) {
      var b = e.target.closest('.cal-day'); if (!b || !b.dataset.date || b.classList.contains('future')) return;
      cal.sel = b.dataset.date;
      if (cal.tab === 'period' && !S.list('period', { from: cal.sel, to: cal.sel }).length) autoFillPeriod(cal.sel);
      renderCal(); renderEditor();
    });
    renderCal(); renderEditor();
  }
  /* Observed length only counts once two full periods (3+ days) are logged; otherwise the
     profile setting or a typical 5 days, so a single half-logged day never shortens the fill. */
  function periodFillLength() {
    var p = S.profile(), eps = S.periodEpisodes().filter(function (ep) { return ep.length >= 3; });
    var observed = eps.length >= 2 ? Math.round(eps.slice(-3).reduce(function (a, e) { return a + e.length; }, 0) / Math.min(3, eps.length)) : null;
    return Math.min(10, Math.max(3, Number(p.periodLength) || observed || 5));
  }
  function autoFillPeriod(start) {
    var len = periodFillLength(), today = S.today(), ids = [], days = 0;
    for (var i = 0; i < len; i++) {
      var d = S.addDays(start, i); if (d > today) break;
      if (S.list('period', { from: d, to: d }).length) break;
      var ev = S.add('period', d, { flow: i < 3 ? 'medium' : 'light', clots: false, impact: false, autofill: true }); ids.push(ev.id); days++;
    }
    cal.lastFill = ids; chime('save');
    toast('Marked ' + days + ' day' + (days === 1 ? '' : 's') + ' from ' + prettyDate(start) + '. Adjust any day or undo.', 'water_drop');
    renderDeck();
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
    var statHtml = cs.lastStart ? '<div class="stat"><span class="ms">water_drop</span><div><b>Day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') + '</b><span>' + (cs.predictedNext ? 'Next period expected around ' + prettyDate(cs.predictedNext) + ' (estimate from ' + esc(cs.basis) + ')' + (cs.uncertain ? ', a loose estimate while cycles are changing' : '') + '.' : (cs.mode === 'suspended' ? 'Predictions are paused for your situation; your entries still count.' : 'Add a cycle length in your intro or log another period to start predictions.')) + '</span></div></div>' : '<div class="stat"><span class="ms">water_drop</span><div><b>No period logged yet</b><span>Tap the first day of your last period and ' + periodFillLength() + ' typical days are filled for you to adjust.</span></div></div>';
    statHtml += '<div class="row"><button class="btn blush" id="menstruatingNow"><span class="ms">water_drop</span>I’m menstruating now</button>' + (cal.lastFill.length ? '<button class="btn ghost" id="undoFill"><span class="ms">undo</span>Undo ' + cal.lastFill.length + '-day fill</button>' : '') + '</div>';
    $('#cycleStat').innerHTML = statHtml;
    $('#menstruatingNow').addEventListener('click', function () { var ev = S.add('period', S.today(), { flow: 'medium', clots: false, impact: false }); cal.sel = S.today(); cal.lastFill = []; renderCal(); renderEditor(); afterSave(ev, 'Period logged for today.'); });
    var undo = $('#undoFill'); if (undo) undo.addEventListener('click', function () { cal.lastFill.forEach(function (id) { S.remove(id); }); cal.lastFill = []; renderCal(); renderEditor(); renderDeck(); toast('Fill removed.', 'undo'); });
  }
  function renderEditor() {
    var ed = $('#dayEditor'), date = cal.sel;
    if (cal.tab === 'period') {
      var cur = S.list('period', { from: date, to: date })[0], data = cur ? cur.data : { flow: 'none', clots: false, impact: false };
      ed.innerHTML = '<h3>' + esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
        '<div class="field"><div class="lbl-row"><span class="lbl">Bleeding</span>' + infoBtn('bleeding') + '</div><div class="chips" id="flowChips">' + ['none', 'spotting', 'light', 'medium', 'heavy'].map(function (f) { return '<button type="button" class="chipbtn flow-' + f + (data.flow === f ? ' on' : '') + '" data-flow="' + f + '">' + cap(f) + '</button>'; }).join('') + '</div>' + guideHTML('bleeding') + '</div>' +
        '<div class="field"><span class="lbl">Details</span><div class="chips"><button type="button" class="chipbtn' + (data.clots ? ' on' : '') + '" id="clots"><span class="ms">bubble_chart</span>Clots</button><button type="button" class="chipbtn' + (data.impact ? ' on' : '') + '" id="impact"><span class="ms">event_busy</span>Affected my day</button></div></div>' +
        '<div class="row"><button class="btn primary" id="savePeriod"><span class="ms">check</span>Save day</button>' + (cur ? '<button class="btn ghost" id="clearPeriod">Clear</button>' : '') + '</div><div class="msg" id="calMsg"></div>';
      $('#flowChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#flowChips')).forEach(function (x) { x.classList.toggle('on', x === b); }); });
      $('#clots').addEventListener('click', function () { this.classList.toggle('on'); }); $('#impact').addEventListener('click', function () { this.classList.toggle('on'); });
      $('#savePeriod').addEventListener('click', function () {
        try {
          var flow = ($('#flowChips .on') || {}).dataset ? $('#flowChips .on').dataset.flow : 'none';
          if (flow === 'none') { if (cur) S.remove(cur.id); message($('#calMsg'), 'Marked as no bleeding.', true); renderCal(); renderEditor(); renderDeck(); return; }
          var ev = S.add('period', date, { flow: flow, clots: $('#clots').classList.contains('on'), impact: $('#impact').classList.contains('on') });
          message($('#calMsg'), 'Saved ' + flow + ' flow for ' + prettyDate(date) + '.', true); renderCal(); afterSave(ev);
        } catch (e) { message($('#calMsg'), e.message, false); }
      });
      if (cur) $('#clearPeriod').addEventListener('click', function () { S.remove(cur.id); renderCal(); renderEditor(); renderDeck(); });
    } else {
      var cs = S.list('symptom', { from: date, to: date })[0], sd = cs ? cs.data : { symptoms: [], pain: 0, mood: '', notes: '' };
      ed.innerHTML = '<h3>' + esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
        '<div class="field"><span class="lbl">Symptoms</span><div class="chips" id="symChips">' + A.SYMPTOMS.map(function (s) { return '<button type="button" class="chipbtn' + ((sd.symptoms || []).indexOf(s) > -1 ? ' on' : '') + '" data-sym="' + esc(s) + '">' + esc(cap(s)) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><div class="lbl-row"><label for="pain" class="lbl" style="margin:0">Pain · <span id="painVal">' + (sd.pain || 0) + '</span>/10</label>' + infoBtn('pain') + '</div><input class="range" type="range" id="pain" min="0" max="10" step="1" value="' + (sd.pain || 0) + '">' + guideHTML('pain') + '</div>' +
        '<div class="field"><span class="lbl">Mood</span><div class="faces" id="moodFaces">' + [['great', 'sentiment_very_satisfied'], ['good', 'sentiment_satisfied'], ['ok', 'sentiment_neutral'], ['low', 'sentiment_dissatisfied'], ['bad', 'sentiment_very_dissatisfied']].map(function (m) { return '<button type="button" data-mood="' + m[0] + '" class="' + (sd.mood === m[0] ? 'on' : '') + '"><span class="ms">' + m[1] + '</span>' + cap(m[0]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="symNotes">Notes</label><textarea class="input" id="symNotes" placeholder="Anything else you noticed...">' + esc(sd.notes || '') + '</textarea></div>' +
        '<div class="row"><button class="btn primary" id="saveSym"><span class="ms">check</span>Save day</button>' + (cs ? '<button class="btn ghost" id="clearSym">Clear</button>' : '') + '<button class="btn soft" id="acuFromSym"><span class="ms">spa</span>Cramp relief points</button></div><div class="msg" id="calMsg"></div>';
      $('#symChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) b.classList.toggle('on'); });
      $('#pain').addEventListener('input', function () { $('#painVal').textContent = this.value; });
      $('#moodFaces').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#moodFaces')).forEach(function (x) { x.classList.toggle('on', x === b && !x.classList.contains('on')); }); });
      $('#acuFromSym').addEventListener('click', openAcupressure);
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

  /* ---------- diary: camera-assisted food journal ---------- */
  var diaryDate = S.today(), draft = { items: [], photo: null }, picked = null, stopScan = null, ovarian = null;
  function stopCamera() { if (stopScan) { try { stopScan(); } catch (e) { } stopScan = null; } var cw = $('#camwrap'); if (cw) cw.classList.remove('on'); }
  function foodEntriesHTML(date) {
    var items = S.list('food', { from: date, to: date });
    if (!items.length) return '<div class="empty">Nothing logged for ' + esc(prettyDate(date)) + ' yet.</div>';
    return '<div class="entries">' + items.map(function (e) {
      var d = e.data, tot = d.items && d.items.length ? FD.sum(d.items) : null;
      return '<div class="entry">' + (d.photo ? '<img class="ethumb" src="' + d.photo + '" alt="">' : '<span class="ms">' + ({ breakfast: 'egg_alt', lunch: 'rice_bowl', dinner: 'dinner_dining', snack: 'icecream' })[d.meal] + '</span>') + '<div class="body"><b>' + esc(cap(d.meal)) + (d.time ? ' · ' + esc(d.time) : '') + '</b><span>' + esc(d.foods) + (tot ? '\n' + esc(FD.line(tot.totals)) : '') + ((d.tags || []).length ? '\n' + esc(d.tags.join(' · ')) : '') + '</span></div><button class="del" data-del="' + esc(e.id) + '" aria-label="Delete"><span class="ms">delete</span></button></div>';
    }).join('') + '</div>';
  }
  function resultsHTML(list) {
    if (!list.length) return '<div class="empty">No match in the food table. Try another word, scan the barcode, or add a custom food.</div>';
    return list.map(function (f) { return '<button type="button" class="result" data-food="' + esc(f.id) + '">' + (f.image ? '<img src="' + f.image + '" alt="">' : '<span class="ms">' + (f.cat === 'packaged' ? 'qr_code_2' : 'restaurant') + '</span>') + '<span><b>' + esc(f.name) + '</b><small>' + esc(f.n.kcal !== null && f.n.kcal !== undefined ? Math.round(f.n.kcal) + ' kcal' : '? kcal') + ' · ' + esc(FD.fmt('protein', f.n.protein)) + ' g protein per 100 ' + (f.basis === '100ml' ? 'ml' : 'g') + (f.sr ? ' · ' + esc(f.sr.slice(0, 48)) + (f.sr.length > 48 ? '…' : '') : '') + '</small></span></button>'; }).join('');
  }
  function picksHTML(phase) {
    if (!ovarian) return '';
    var ph = ovarian.phases[phase] || null, list = ovarian.foods.filter(function (f) { return (f.phase || []).indexOf(phase) > -1; }).slice(0, 10);
    if (!list.length) return '';
    return '<div class="field"><span class="lbl">Ovarian-friendly picks for this phase</span>' + (ph ? '<p class="help" style="margin:0 0 6px">' + esc(ph.text) + '</p>' : '') + '<div class="picks">' + list.map(function (f) { return '<button type="button" class="pick" data-usda="' + esc(f.usda || '') + '" data-name="' + esc(f.name) + '"><b>' + esc(f.emoji + ' ' + f.name) + '</b><small>' + esc(f.tags) + '</small><em>' + esc(f.usda ? 'Tap to add with USDA values' : f.tcm) + '</em></button>'; }).join('') + '</div></div>';
  }
  function showPicker(food) {
    picked = { food: food, portion: food.portions[1] || food.portions[0], grams: (food.portions[1] || food.portions[0]).g };
    var p = $('#picker'); p.classList.add('on');
    p.innerHTML = '<h4>' + esc(food.name) + '</h4><div class="src">' + esc(food.source.label) + (food.source.ref ? ' · ' + esc(food.source.ref) : '') + (food.source.date ? ' · ' + esc(food.source.date) : '') + (food.source.detail ? '<br>' + esc(food.source.detail) : '') + '</div>' +
      '<div class="portions" id="portions">' + food.portions.map(function (po, i) { return '<button type="button" class="chipbtn' + (po === picked.portion ? ' on' : '') + '" data-i="' + i + '">' + esc(po.label) + ' · ' + po.g + ' g</button>'; }).join('') + '</div>' +
      '<div class="grams"><input class="input" type="number" id="gramsIn" min="1" max="3000" step="1" value="' + picked.grams + '"><span>' + (food.basis === '100ml' ? 'ml' : 'g') + ' you ate</span></div>' +
      '<div class="nutline" id="nutline"></div>' +
      '<div class="row"><button class="btn primary" id="addItem"><span class="ms">add</span>Add to this meal</button><button class="btn ghost" id="cancelPick">Cancel</button></div>';
    function refresh() { var n = FD.scale(food.n, picked.grams); $('#nutline').innerHTML = esc(FD.line(n)) + '<small>' + esc(FD.line(n, ['fe', 'ca', 'sugar', 'na'])) + ' · ? means the source has no value</small>'; }
    $('#portions').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; picked.portion = food.portions[Number(b.dataset.i)]; picked.grams = picked.portion.g; $('#gramsIn').value = picked.grams; $$('button', $('#portions')).forEach(function (x) { x.classList.toggle('on', x === b); }); refresh(); });
    $('#gramsIn').addEventListener('input', function () { var v = Number(this.value); if (v > 0) { picked.grams = v; picked.portion = { label: v + (food.basis === '100ml' ? ' ml' : ' g'), g: v }; $$('button', $('#portions')).forEach(function (x) { x.classList.remove('on'); }); refresh(); } });
    $('#cancelPick').addEventListener('click', function () { p.classList.remove('on'); picked = null; });
    $('#addItem').addEventListener('click', function () {
      if (!picked || !(picked.grams > 0)) return;
      draft.items.push(FD.makeItem(food, picked.portion, picked.grams, picked.portion.g === picked.grams && picked.portion.label.indexOf(' g') < 0 ? 'household measure' : 'typed amount'));
      p.classList.remove('on'); picked = null; chime('tap'); renderItems();
      var fs = $('#fdSearch'); if (fs) { fs.value = ''; $('#fdResults').innerHTML = ''; }
    });
    refresh(); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function renderItems() {
    var wrap = $('#items'), tot = $('#totals');
    if (!draft.items.length) { wrap.innerHTML = ''; tot.innerHTML = ''; return; }
    wrap.innerHTML = draft.items.map(function (it, i) { return '<div class="item"><span class="ms">' + (it.source.kind === 'off' ? 'qr_code_2' : it.source.kind === 'custom' ? 'edit' : 'restaurant') + '</span><span><b>' + esc(it.name) + '</b><small>' + esc(it.portionLabel) + ' · ' + it.grams + ' g · ' + esc(FD.fmt('kcal', it.nutrients.kcal)) + ' kcal · ' + esc(FD.fmt('protein', it.nutrients.protein)) + ' g protein</small></span><button class="del" data-i="' + i + '" aria-label="Remove"><span class="ms">close</span></button></div>'; }).join('');
    var sm = FD.sum(draft.items), miss = ['kcal', 'protein', 'carb', 'fat', 'fiber'].filter(function (k) { return sm.missing[k]; });
    tot.innerHTML = '<b>This meal</b><div class="nuts">' + ['kcal', 'protein', 'carb', 'fat', 'fiber'].map(function (k) { return '<div><strong>' + esc(FD.fmt(k, sm.totals[k])) + '</strong><small>' + esc(k === 'kcal' ? 'kcal' : FD.LABEL[k]) + '</small></div>'; }).join('') + '</div><p>' + sm.count + ' item' + (sm.count === 1 ? '' : 's') + (miss.length ? ' · ' + miss.map(function (k) { return sm.missing[k] + ' missing ' + FD.LABEL[k].toLowerCase(); }).join(', ') : ' · all values present') + '. Estimated from the sources shown, with the amounts you confirmed.</p>';
  }
  function customFoodForm() {
    return '<div class="picker on" id="customForm"><h4>Custom food from the label</h4><div class="src">Type the per-100 g (or per-100 ml) values printed on the pack. Leave blanks for anything not shown.</div>' +
      '<div class="field"><label for="cfName">Name</label><input class="input" id="cfName" maxlength="60" placeholder="e.g. Meiji low-fat milk"></div>' +
      '<div class="grid2"><div class="field"><label for="cfKcal">Energy kcal /100</label><input class="input" id="cfKcal" type="number" min="0" step="0.1"></div><div class="field"><label for="cfProt">Protein g /100</label><input class="input" id="cfProt" type="number" min="0" step="0.1"></div></div>' +
      '<div class="grid2"><div class="field"><label for="cfCarb">Carbs g /100</label><input class="input" id="cfCarb" type="number" min="0" step="0.1"></div><div class="field"><label for="cfFat">Fat g /100</label><input class="input" id="cfFat" type="number" min="0" step="0.1"></div></div>' +
      '<div class="grid2"><div class="field"><label for="cfFib">Fibre g /100</label><input class="input" id="cfFib" type="number" min="0" step="0.1"></div><div class="field"><label for="cfServe">Serving size g</label><input class="input" id="cfServe" type="number" min="1" step="1" placeholder="optional"></div></div>' +
      '<div class="row"><button class="btn primary" id="cfUse"><span class="ms">check</span>Use this food</button><button class="btn ghost" id="cfCancel">Cancel</button></div></div>';
  }
  function num(id) { var v = $(id).value; return v === '' ? null : Number(v); }
  function openDiary() {
    diaryDate = S.today(); draft = { items: [], photo: null }; picked = null;
    var cs = S.cycleStats(), phase = cs.phase || 'none', tip = PHASE_TIPS[phase] || PHASE_TIPS.none;
    var h = new Date().getHours(), defMeal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack';
    openSheet('diary', 'Food diary', 'Snap, scan or search, then confirm the amount', 'menu_book',
      '<div class="stat"><span class="ms">local_florist</span><div><b>' + esc(tip.title) + '</b><span>' + esc(tip.text) + '</span></div></div>' +
      '<div id="picksWrap"></div>' +
      '<div class="grid2"><div class="field"><label for="fdDate">Date</label><input class="input" id="fdDate" type="date" value="' + diaryDate + '" max="' + S.today() + '"></div><div class="field"><label for="fdTime">Time</label><input class="input" id="fdTime" type="time" value="' + nowHM() + '"></div></div>' +
      '<div class="field"><span class="lbl">Meal</span><div class="chips" id="mealChips">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (m) { return '<button type="button" class="chipbtn' + (m === defMeal ? ' on' : '') + '" data-meal="' + m + '">' + cap(m) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><div class="lbl-row"><span class="lbl">What did you eat?</span>' + infoBtn('food') + '</div>' +
      '<div class="foodmodes"><button type="button" data-mode="search" class="on"><span class="ms">search</span>Search foods</button><button type="button" data-mode="scan"><span class="ms">qr_code_scanner</span>Scan barcode</button><button type="button" data-mode="photo"><span class="ms">photo_camera</span>Snap a photo</button></div>' + guideHTML('food') +
      '<div id="modeArea"></div><img class="thumb" id="thumb" alt=""><div class="picker" id="picker"></div><div id="customWrap"></div><div class="items" id="items"></div><div class="totals" id="totals"></div></div>' +
      '<div class="field"><label for="fdFoods">Notes or anything not in the list</label><textarea class="input" id="fdFoods" placeholder="Kopi C, two slices of kaya toast..."></textarea></div>' +
      '<div class="field"><span class="lbl">Tags</span><div class="chips" id="tagChips">' + A.FOOD_TAGS.map(function (t) { return '<button type="button" class="chipbtn" data-tag="' + esc(t) + '">' + esc(cap(t)) + '</button>'; }).join('') + '</div></div>' +
      '<button class="btn primary" id="saveFood" style="width:100%"><span class="ms">check</span>Save meal</button><div class="msg" id="foodMsg"></div>' +
      '<div class="field"><span class="lbl">Entries for <span id="fdLabel">' + esc(prettyDate(diaryDate)) + '</span></span><div id="foodList">' + foodEntriesHTML(diaryDate) + '</div></div>' +
      '<a class="btn soft" href="food-journal.html" style="margin-top:12px"><span class="ms">restaurant</span>Open the full food journal</a>');
    (ovarian ? Promise.resolve(ovarian) : loadJSON('assets/data/ovarian-foods.json').then(function (d) { ovarian = d; return d; })).then(function () { var w = $('#picksWrap'); if (w) w.innerHTML = picksHTML(phase === 'late' ? 'luteal' : phase); }).catch(function () { });
    var area = $('#modeArea');
    function setMode(mode) {
      stopCamera(); $$('.foodmodes button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
      if (mode === 'search') {
        area.innerHTML = '<input class="input" id="fdSearch" placeholder="Type a food: oats, salmon, tofu, bee hoon…" autocomplete="off"><div class="results" id="fdResults"></div><div class="row"><button type="button" class="btn ghost" id="customBtn"><span class="ms">edit</span>Add a custom food</button></div>';
        var inp = $('#fdSearch');
        FD.load().then(function () { $('#fdResults').innerHTML = resultsHTML(['rice-white', 'egg-boiled', 'chicken-breast', 'oats-cooked', 'salmon', 'tofu-firm', 'banana', 'yogurt-greek'].map(FD.byId).filter(Boolean)); }).catch(function (e) { $('#fdResults').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        inp.addEventListener('input', function () { $('#fdResults').innerHTML = resultsHTML(FD.search(inp.value, 12)); });
        $('#customBtn').addEventListener('click', function () { $('#customWrap').innerHTML = customFoodForm(); wireCustom(); });
      } else if (mode === 'scan') {
        area.innerHTML = '<div class="camwrap on" id="camwrap"><video id="bcVideo" playsinline muted></video><div class="reticle"></div><div class="camhint">Point the camera at the barcode</div></div><div class="row" style="margin-top:8px"><input class="input" id="bcManual" inputmode="numeric" placeholder="or type the barcode digits"><button type="button" class="btn soft" id="bcLookup" style="flex:0 0 auto">Look up</button></div><div class="msg" id="bcMsg"></div>';
        stopScan = FD.scanLive($('#bcVideo'), function (code) { stopCamera(); $('#bcManual').value = code; lookup(code); }, function (err) { message($('#bcMsg'), err.message, false); });
        $('#bcLookup').addEventListener('click', function () { lookup($('#bcManual').value); });
      } else {
        area.innerHTML = '<label class="btn soft" style="width:100%;cursor:pointer"><span class="ms">photo_camera</span>Take a photo of the plate<input type="file" id="fdPhoto" accept="image/*" capture="environment" hidden></label><p class="help">The photo is kept as a reminder on this device. If it shows a barcode we read it; otherwise pick what is on the plate below and confirm how much.</p><input class="input" id="fdSearch" placeholder="Pick what is on the plate…" autocomplete="off" style="margin-top:8px"><div class="results" id="fdResults"></div>';
        var inp2 = $('#fdSearch'); inp2.addEventListener('input', function () { $('#fdResults').innerHTML = resultsHTML(FD.search(inp2.value, 12)); });
        FD.load();
        $('#fdPhoto').addEventListener('change', function () {
          var f = this.files[0]; if (!f) return;
          FD.shrink(f, 420).then(function (r) {
            draft.photo = r.dataUrl; var t = $('#thumb'); t.src = r.dataUrl; t.classList.add('on');
            return FD.detectInImage(r.image).then(function (code) { if (code) { toast('Barcode found: ' + code, 'qr_code_2'); lookup(code); } else { toast('Photo saved. Now pick the foods you see.', 'photo_camera'); inp2.focus(); } });
          }).catch(function (e) { toast(e.message, 'error'); });
        });
      }
    }
    function lookup(code) {
      var m = $('#bcMsg'); if (m) message(m, 'Looking up ' + code + '…', true);
      FD.lookupBarcode(code).then(function (food) { if (m) message(m, 'Found: ' + food.name, true); showPicker(food); }).catch(function (e) { if (m) message(m, e.message, false); else toast(e.message, 'error'); $('#customWrap').innerHTML = customFoodForm(); wireCustom(); });
    }
    function wireCustom() {
      $('#cfCancel').addEventListener('click', function () { $('#customWrap').innerHTML = ''; });
      $('#cfUse').addEventListener('click', function () {
        var name = $('#cfName').value.trim(); if (!name) return toast('Give the food a name.', 'error');
        var serve = num('#cfServe'), food = { id: 'custom:' + Date.now(), name: name, cat: 'custom', basis: '100g', n: { kcal: num('#cfKcal'), protein: num('#cfProt'), carb: num('#cfCarb'), fat: num('#cfFat'), fiber: num('#cfFib') }, portions: [{ label: '100 g', g: 100 }].concat(serve > 0 ? [{ label: '1 serving', g: serve }] : []), source: { kind: 'custom', label: 'Typed from the label', ref: null, date: S.today(), detail: 'Values entered by you; unknowns stay blank.' } };
        $('#customWrap').innerHTML = ''; showPicker(food);
      });
    }
    setMode('search');
    $('.foodmodes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
    body.addEventListener('click', function (e) {
      var r = e.target.closest('.result'); if (r) { var f = r.dataset.food.indexOf('off:') === 0 ? null : FD.byId(r.dataset.food); if (f) showPicker(f); return; }
      var pk = e.target.closest('.pick'); if (pk) { if (pk.dataset.usda) { FD.load().then(function () { var f = FD.byId(pk.dataset.usda); if (f) showPicker(f); }); } else { var ta = $('#fdFoods'); ta.value = (ta.value ? ta.value + ', ' : '') + pk.dataset.name; toast(pk.dataset.name + ' added to your notes (no USDA entry yet).', 'edit'); } return; }
      var del = e.target.closest('#items .del'); if (del) { draft.items.splice(Number(del.dataset.i), 1); renderItems(); return; }
      var d = e.target.closest('#foodList [data-del]'); if (d && confirm('Delete this entry?')) { S.remove(d.dataset.del); $('#foodList').innerHTML = foodEntriesHTML(diaryDate); renderDeck(); }
    });
    $('#mealChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#mealChips')).forEach(function (x) { x.classList.toggle('on', x === b); }); });
    $('#tagChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) b.classList.toggle('on'); });
    $('#fdDate').addEventListener('change', function () { diaryDate = this.value; $('#fdLabel').textContent = prettyDate(diaryDate); $('#foodList').innerHTML = foodEntriesHTML(diaryDate); });
    $('#saveFood').addEventListener('click', function () {
      try {
        var notes = $('#fdFoods').value.trim();
        if (!draft.items.length && !notes) throw new Error('Add at least one food, or write a note.');
        var names = draft.items.map(function (it) { return it.name.split(' · ')[0]; });
        var sm = draft.items.length ? FD.sum(draft.items) : null;
        var ev = S.add('food', $('#fdDate').value, { meal: $('#mealChips .on').dataset.meal, time: $('#fdTime').value, foods: (names.join(', ') + (notes ? (names.length ? ' · ' : '') + notes : '')), notes: notes, tags: $$('#tagChips .on').map(function (b) { return b.dataset.tag; }), items: draft.items, photo: draft.photo, totals: sm ? sm.totals : null, method: 'camera-assisted v1' });
        draft = { items: [], photo: null }; renderItems(); $('#thumb').classList.remove('on'); $('#fdFoods').value = ''; $$('#tagChips .on').forEach(function (b) { b.classList.remove('on'); });
        message($('#foodMsg'), 'Saved' + (sm && sm.totals.kcal !== null ? ': ' + Math.round(sm.totals.kcal) + ' kcal, ' + FD.fmt('protein', sm.totals.protein) + ' g protein, ' + FD.fmt('fiber', sm.totals.fiber) + ' g fibre.' : '.'), true);
        $('#foodList').innerHTML = foodEntriesHTML(diaryDate); afterSave(ev);
      } catch (e) { message($('#foodMsg'), e.message, false); }
    });
  }

  /* ---------- computer: a little desktop with draggable folders and your own wallpaper ---------- */
  var player = null, DESK_KEY = 'ovumind_desk_v1';
  var WALLS = [{ id: 'cat', name: 'Me & Mochi', src: ART + 'wallpaper-cat.webp' }, { id: 'room', name: 'My room', src: ART + 'room-v3.webp' }, { id: 'house', name: 'Dream house', src: ART + 'house-v1.webp' }, { id: 'sky', name: 'Morning sky', src: '' }];
  var SKY = 'linear-gradient(160deg,#cfe6ff,#f6d7ec 60%,#fde7c9)';
  function deskPrefs() { try { return JSON.parse(localStorage.getItem(DESK_KEY) || 'null') || { pos: {}, wall: 'cat', custom: null }; } catch (e) { return { pos: {}, wall: 'cat', custom: null }; } }
  function setDeskPrefs(p) { try { localStorage.setItem(DESK_KEY, JSON.stringify(p)); return true; } catch (e) { toast('Could not save that (storage is full).', 'error'); return false; } }
  function wallStyle(p) { if (p.wall === 'custom' && p.custom) return 'background-image:url(' + p.custom + ')'; var w = WALLS.filter(function (x) { return x.id === p.wall; })[0] || WALLS[0]; return w.src ? 'background-image:url(' + w.src + ')' : 'background:' + SKY; }
  function stopVideo() { if (player) { try { player.pause(); } catch (e) { } player = null; } }
  function folderSVG(color) { return '<svg viewBox="0 0 64 54" aria-hidden="true"><path d="M4 12a6 6 0 0 1 6-6h14l6 6h28a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="' + color + '"/><path d="M4 20h56v24a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="#fff" fill-opacity=".55"/><circle cx="50" cy="38" r="4" fill="#fff" fill-opacity=".8"/></svg>'; }
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = Math.min(960, img.width), h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        var q = 0.82, out = c.toDataURL('image/jpeg', q); while (out.length > 420000 && q > 0.4) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file is not an image I can read.')); };
      img.src = url;
    });
  }
  function openLearn() {
    var p = deskPrefs();
    openSheet('learn', 'Your desk', 'Drag the folders around; make it yours', 'computer',
      '<div class="desk"><div class="menubar"><span class="brandy">OVUMIND</span><span>Learn</span><span class="sp"></span><button type="button" class="mbtn" id="wallBtn" aria-label="Change wallpaper"><span class="ms">wallpaper</span></button><span id="deskClock">' + esc(nowHM()) + '</span></div>' +
      '<div class="wallpaper" id="wallpaper" style="' + wallStyle(p) + '"><div class="dicons free" id="dicons">' + FOLDERS.map(function (f, i) { var q = p.pos[f.id] || [2 + (i % 4) * 25, 4 + Math.floor(i / 4) * 46]; return '<button type="button" class="dicon" data-folder="' + f.id + '" style="left:' + q[0] + '%;top:' + q[1] + '%">' + folderSVG(f.color) + '<span>' + esc(f.name) + '</span></button>'; }).join('') + '</div></div>' +
      '<div class="dock"><button type="button" data-dock="videos" aria-label="Videos"><span class="ms">play_circle</span></button><button type="button" data-dock="mind" aria-label="Erin"><span class="ms">self_improvement</span></button><button type="button" data-dock="acu" aria-label="Acupressure"><span class="ms">spa</span></button><button type="button" data-dock="luna" aria-label="Luna"><span class="ms">dark_mode</span></button><button type="button" data-dock="doctor" aria-label="Share with doctor"><span class="ms">medical_services</span></button></div></div>' +
      '<div class="wallpanel" id="wallpanel"><b>Wallpaper</b><div class="walls">' + WALLS.map(function (w) { return '<button type="button" class="wall' + (p.wall === w.id ? ' on' : '') + '" data-wall="' + w.id + '" style="' + (w.src ? 'background-image:url(' + w.src + ')' : 'background:' + SKY) + '"><span>' + esc(w.name) + '</span></button>'; }).join('') + '<button type="button" class="wall upload' + (p.wall === 'custom' ? ' on' : '') + '" data-wall="custom" style="' + (p.custom ? 'background-image:url(' + p.custom + ')' : '') + '"><span class="ms">add_photo_alternate</span><span>' + (p.custom ? 'My photo' : 'Upload a photo') + '</span></button></div><input type="file" id="wallFile" accept="image/*" hidden><div class="row" style="margin-top:8px"><button type="button" class="btn ghost" id="deskTidy"><span class="ms">grid_view</span>Tidy the icons</button>' + (p.custom ? '<button type="button" class="btn ghost" id="wallForget"><span class="ms">delete</span>Forget my photo</button>' : '') + '</div><p class="help">Your photo is stored only on this device.</p></div>' +
      '<div class="finder" id="finder"></div><div class="player" id="player"></div>' +
      '<p class="help" style="margin-top:10px">Short, sourced reads and six little videos. Nothing here is personal medical advice; bring questions to your clinician.</p>');
    function openFolder(id) {
      var f = FOLDERS.filter(function (x) { return x.id === id; })[0]; if (!f) return;
      var fd = $('#finder');
      fd.innerHTML = '<div class="fbar"><span class="lights"><i></i><i></i><i></i></span>' + esc(f.name) + '<button class="x" aria-label="Close folder"><span class="ms">close</span></button></div>' + f.items.map(function (it) {
        if (it[0] === 'video') return '<button type="button" class="frow" data-video="' + it[1] + '"><img src="assets/eduvid/' + it[1] + '.jpg" alt=""><span><b>' + esc(it[2]) + '</b><small>' + esc(it[3]) + '</small></span></button>';
        if (it[0] === 'link') return '<a class="frow" href="' + it[1] + '" target="_blank" rel="noopener"><span class="ms">' + it[2] + '</span><span><b>' + esc(it[3]) + '</b><small>' + esc(it[4]) + '</small></span></a>';
        if (it[0] === 'action') return '<button type="button" class="frow" data-action="' + it[1] + '"><span class="ms">' + it[2] + '</span><span><b>' + esc(it[3]) + '</b><small>' + esc(it[4]) + '</small></span></button>';
        return '<a class="frow" href="' + it[1] + '"><span class="ms">' + it[2] + '</span><span><b>' + esc(it[3]) + '</b><small>' + esc(it[4]) + '</small></span></a>';
      }).join('');
      fd.classList.add('on'); fd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    /* drag the folders; a short press without movement opens the folder */
    var icons = $('#dicons'), drag = null;
    icons.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.dicon'); if (!b) return;
      var r = icons.getBoundingClientRect();
      drag = { b: b, id: b.dataset.folder, sx: e.clientX, sy: e.clientY, ox: parseFloat(b.style.left) || 0, oy: parseFloat(b.style.top) || 0, rw: r.width, rh: r.height, moved: false };
      try { b.setPointerCapture(e.pointerId); } catch (err) { }
      b.classList.add('lift'); e.preventDefault();
    });
    icons.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (!drag.moved) return;
      var x = Math.max(0, Math.min(78, drag.ox + dx / drag.rw * 100)), y = Math.max(0, Math.min(64, drag.oy + dy / drag.rh * 100));
      drag.b.style.left = x + '%'; drag.b.style.top = y + '%';
    });
    function endDrag() {
      if (!drag) return; var d = drag; drag = null; d.b.classList.remove('lift');
      if (d.moved) { var pr = deskPrefs(); pr.pos[d.id] = [Math.round(parseFloat(d.b.style.left) * 10) / 10, Math.round(parseFloat(d.b.style.top) * 10) / 10]; setDeskPrefs(pr); }
      else { chime('tap'); openFolder(d.id); }
    }
    icons.addEventListener('pointerup', endDrag); icons.addEventListener('pointercancel', endDrag);
    function setWall(id) { var pr = deskPrefs(); pr.wall = id; setDeskPrefs(pr); $('#wallpaper').style.cssText = wallStyle(pr); $$('.wall').forEach(function (w) { w.classList.toggle('on', w.dataset.wall === id); }); }
    $('#wallFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      shrinkPhoto(f).then(function (data) { var pr = deskPrefs(); pr.custom = data; pr.wall = 'custom'; if (setDeskPrefs(pr)) { toast('Wallpaper changed.', 'wallpaper'); openLearn(); $('#wallpanel').classList.add('on'); } }).catch(function (err) { toast(err.message, 'error'); });
    });
    body.addEventListener('click', function (e) {
      if (e.target.closest('#wallBtn')) { chime('tap'); $('#wallpanel').classList.toggle('on'); return; }
      var wl = e.target.closest('[data-wall]'); if (wl) { chime('tap'); if (wl.dataset.wall === 'custom' && !deskPrefs().custom) { $('#wallFile').click(); return; } if (wl.dataset.wall === 'custom') { $('#wallFile').value = ''; } setWall(wl.dataset.wall); if (wl.dataset.wall === 'custom') { /* tapping the photo tile again swaps it */ $('#wallFile').click(); } return; }
      if (e.target.closest('#deskTidy')) { var pr = deskPrefs(); pr.pos = {}; setDeskPrefs(pr); openLearn(); $('#wallpanel').classList.add('on'); return; }
      if (e.target.closest('#wallForget')) { var pr2 = deskPrefs(); pr2.custom = null; if (pr2.wall === 'custom') pr2.wall = 'cat'; setDeskPrefs(pr2); openLearn(); $('#wallpanel').classList.add('on'); return; }
      var dk = e.target.closest('[data-dock]'); if (dk) { var k = dk.dataset.dock; chime('tap'); if (k === 'videos' || k === 'mind' || k === 'doctor') openFolder(k); if (k === 'acu') openAcupressure(); if (k === 'luna') openLuna(); return; }
      if (e.target.closest('.finder .x')) { $('#finder').classList.remove('on'); return; }
      var v = e.target.closest('[data-video]'); if (v) { var meta = VIDEOS.filter(function (x) { return x[0] === v.dataset.video; })[0]; stopVideo(); var pl = $('#player'); pl.innerHTML = '<video controls playsinline poster="assets/eduvid/' + meta[0] + '.jpg" src="assets/eduvid/' + meta[1] + '"></video>'; pl.classList.add('on'); player = pl.querySelector('video'); player.play().catch(function () { }); pl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      var act = e.target.closest('[data-action]'); if (act) { var a = act.dataset.action; if (a === 'diary') openDiary(); if (a === 'mat') tap(hotspot('mat')); if (a === 'acu') openAcupressure(); }
    });
  }

  /* ---------- wardrobe ---------- */
  function openWardrobe() {
    var cur = S.profile().outfit || 'base';
    openSheet('wardrobe', 'Wardrobe', 'Pick an outfit for today', 'checkroom',
      '<div class="outfits">' + OUTFITS.map(function (o) { return '<button type="button" class="outfit' + (o.id === cur ? ' on' : '') + '" data-id="' + o.id + '"><img src="' + ART + 'avatar-' + o.id + '.webp" alt=""><b>' + esc(o.name) + '</b><small>' + esc(o.note) + '</small></button>'; }).join('') + '</div>' +
      '<div class="field"><label for="nameInput">What should I call you?</label><div class="row" style="margin-top:0"><input class="input" id="nameInput" maxlength="24" placeholder="Your name" value="' + esc(S.profile().name || '') + '"><button class="btn soft" id="saveName" style="flex:0 0 auto">Save</button></div></div>' +
      '<p class="help">Your avatar remembers her outfit on this device. Pyjamas go on automatically at bedtime. Pets and furniture live in the heart shop.</p>');
    body.addEventListener('click', function (e) { var o = e.target.closest('.outfit'); if (!o) return; setOutfit(o.dataset.id); chime('tap'); toast(OUTFITS.filter(function (x) { return x.id === o.dataset.id; })[0].name + ' it is!', 'checkroom'); });
    $('#saveName').addEventListener('click', function () { S.setProfile({ name: $('#nameInput').value.trim() }); updateGreeting(); toast('Nice to meet you' + (S.profile().name ? ', ' + S.profile().name : '') + '.', 'favorite'); });
  }

  /* ---------- heart shop: pets, furniture and homes, plus arranging what you own ---------- */
  var shopTab = 'all', arranging = false, dragProp = null;
  var NEXT_HOMES = [{ icon: 'yard', name: 'Garden', note: 'Outdoor practices among the flowers: watering, morning light, a bench for tea.' }, { icon: 'groups', name: 'Activity hall', note: 'A gentle place for circles and community gatherings with Erin.' }];
  function openShop(tab) {
    if (tab) shopTab = tab;
    var l = RW.ledger(), home = currentHomeId();
    var items = RW.SHOP.filter(function (it) { return shopTab === 'all' || (shopTab === 'pet' && it.kind === 'pet') || (shopTab === 'furniture' && it.kind === 'furniture') || (shopTab === 'home' && it.kind === 'home'); });
    openSheet('shop', 'Heart shop', 'Hearts come from logging; spend them on your home', 'favorite',
      '<div class="heartbar"><div class="big"><span class="ms fill">favorite</span>' + l.hearts + '</div><p>' + l.earned + ' earned in total' + (l.streak ? ' · ' + l.streak + '-day streak' : '') + '. Sleep 10, period 10, symptoms 8, meals 6 (+2 per confirmed item), reflections 5, calm 2 per minute, everyday practice 5 (+10 the first time), +5 from day three of a streak.</p></div>' +
      '<div class="tabs" id="shopTabs">' + [['all', 'All'], ['pet', 'Pets'], ['furniture', 'Furniture'], ['home', 'Homes']].map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (shopTab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="shop">' + items.map(function (it) {
        var owned = l.owned.indexOf(it.id) > -1, placed = !!l.placed[it.id], ctl, extra = '';
        if (it.kind === 'home') {
          var pct = Math.min(100, Math.round(l.hearts / it.cost * 100));
          ctl = owned ? '<button type="button" class="btn soft" data-home="' + (home === 'house' ? 'room' : 'house') + '">' + (home === 'house' ? 'Back to my room' : 'Move in') + '</button>'
            : '<button type="button" class="btn primary" data-buy="' + it.id + '"' + (l.hearts < it.cost ? ' disabled' : '') + '>Move in</button><button type="button" class="btn ghost" data-visit="house">Visit</button>';
          if (!owned) extra = '<div class="bar"><i style="width:' + pct + '%"></i></div><small>' + pct + '% saved' + (l.hearts < it.cost ? ' · ' + (it.cost - l.hearts) + ' hearts to go' : ' · you can move in!') + '</small>';
        } else {
          ctl = owned ? '<button type="button" class="btn soft" data-toggle="' + it.id + '">' + (placed ? 'Hide' : 'Place') + '</button>' : '<button type="button" class="btn primary" data-buy="' + it.id + '"' + (l.hearts < it.cost ? ' disabled' : '') + '>' + (it.kind === 'pet' ? 'Adopt' : 'Buy') + '</button>';
        }
        return '<div class="shopitem' + (it.kind === 'home' ? ' home' : '') + '">' + (it.img ? '<img src="' + ART + it.img + '" alt="">' : '<span class="ph"><span class="ms">cottage</span></span>') + '<span><b>' + esc(it.name) + '</b><small>' + esc(it.note) + '</small>' + extra + '</span><span class="cost"><b><span class="ms fill">favorite</span>' + it.cost + '</b>' + ctl + '</span></div>';
      }).join('') + '</div>' +
      (shopTab === 'all' || shopTab === 'home' ? '<div class="nexthomes"><b>Growing next</b>' + NEXT_HOMES.map(function (n) { return '<div><span class="ms">' + n.icon + '</span><span><b>' + esc(n.name) + '</b><small>' + esc(n.note) + '</small></span></div>'; }).join('') + '</div>' : '') +
      (l.owned.some(function (id) { var it = RW.SHOP.filter(function (s) { return s.id === id; })[0]; return it && it.kind !== 'home'; }) ? '<div class="row"><button type="button" class="btn soft" id="arrangeBtn"><span class="ms">open_with</span>Arrange my home</button></div><p class="help">Drag pets and furniture anywhere; the bed, clock, calendar and the rest stay where they are so logging keeps working.</p>' : '') +
      '<div class="msg" id="shopMsg"></div>');
    $('#shopTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) { chime('tap'); openShop(b.dataset.tab); } });
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-buy]'), t = e.target.closest('[data-toggle]'), v = e.target.closest('[data-visit]'), hm = e.target.closest('[data-home]');
      try {
        if (b) {
          var it = RW.buy(b.dataset.buy); chime('save', true);
          if (it.kind === 'home') { S.setState({ home: 'house' }); closeSheet(); applyLayout('house', false); toast('Welcome home. The dream house is yours!', 'cottage'); }
          else { renderProps(); toast(it.name + ' is now in your home!', 'favorite'); openShop(); }
        }
        if (t) { RW.toggle(t.dataset.toggle); renderProps(); openShop(); }
        if (v) { chime('tap'); closeSheet(); applyLayout('house', true); toast('Have a look around. Tap Back when you are done.', 'cottage'); }
        if (hm) { chime('tap'); S.setState({ home: hm.dataset.home }); applyLayout(hm.dataset.home, false); openShop(); toast(hm.dataset.home === 'house' ? 'Moved in.' : 'Back in your room.', 'home'); }
        if (e.target.closest('#arrangeBtn')) enterArrange();
      } catch (err) { message($('#shopMsg'), err.message, false); }
    });
  }
  $('#heartsChip').addEventListener('click', function () { chime('tap'); openShop(); });
  /* arrange mode: drag what you own; hotspots and the avatar pause until Done */
  function enterArrange() {
    arranging = true; hideSheet(); scene.classList.add('arranging');
    var vb = $('#visitBar'); vb.classList.add('on');
    vb.innerHTML = '<span class="ms">open_with</span><span>Drag pets and furniture where you like</span><button type="button" id="arrReset"><span class="ms">restart_alt</span>Reset</button><button type="button" id="arrDone"><span class="ms">check</span>Done</button>';
    toast('Arranging. Drag anything you own.', 'open_with');
  }
  function exitArrange(reset) {
    if (reset) { var pp = S.state().propPos || {}; delete pp[L.id]; S.setState({ propPos: pp }); }
    arranging = false; scene.classList.remove('arranging'); applyLayout(L.id, !!visiting);
    toast(reset ? 'Back to the default arrangement.' : 'Saved your arrangement.', 'check_circle');
  }
  var owned = $('#ownedProps');
  owned.addEventListener('pointerdown', function (e) {
    if (!arranging) return; var p = e.target.closest('.prop'); if (!p) return;
    var r = scene.getBoundingClientRect();
    dragProp = { el: p, id: p.dataset.id, sx: e.clientX, sy: e.clientY, ox: parseFloat(p.style.left), oy: parseFloat(p.style.top), rw: r.width, rh: r.height };
    try { p.setPointerCapture(e.pointerId); } catch (err) { }
    p.classList.add('lift'); e.preventDefault();
  });
  owned.addEventListener('pointermove', function (e) {
    if (!dragProp) return;
    var x = Math.max(2, Math.min(98, dragProp.ox + (e.clientX - dragProp.sx) / dragProp.rw * 100)), y = Math.max(10, Math.min(99, dragProp.oy + (e.clientY - dragProp.sy) / dragProp.rh * 100));
    dragProp.el.style.left = x + '%'; dragProp.el.style.top = y + '%';
  });
  function endPropDrag() {
    if (!dragProp) return; var d = dragProp; dragProp = null; d.el.classList.remove('lift');
    var pp = S.state().propPos || {}; pp[L.id] = pp[L.id] || {}; pp[L.id][d.id] = { x: Math.round(parseFloat(d.el.style.left) * 10) / 10, y: Math.round(parseFloat(d.el.style.top) * 10) / 10 }; S.setState({ propPos: pp });
  }
  owned.addEventListener('pointerup', endPropDrag); owned.addEventListener('pointercancel', endPropDrag);

  /* ---------- Luna, the moon orb ---------- */
  var lunaLog = [];
  function openLuna(prefill) {
    var cfg = ORB.aiConfig();
    openSheet('luna', 'Luna', 'Tell me how you are; I’ll write it down', 'dark_mode',
      '<div class="chat" id="chat"></div>' +
      '<div class="quick" id="quick">' + ['Slept 11pm to 7am, quality 4', 'Period started today, medium', 'Cramps and bloating, pain 5, mood ok', 'Had oats and a latte for breakfast', 'Meditated 10 min'].map(function (q) { return '<span class="qchip"><button type="button" class="qsend" data-q="' + esc(q) + '">' + esc(q) + '</button><button type="button" class="qpen" data-q="' + esc(q) + '" aria-label="Edit this shortcut before sending"><span class="ms">edit</span></button></span>'; }).join('') + '</div>' +
      '<div class="composer"><input class="input" id="lunaIn" maxlength="400" placeholder="e.g. slept badly, cramps 6/10, ate chicken rice" value="' + esc(prefill || '') + '"><button type="button" class="btn primary" id="lunaSend" aria-label="Send"><span class="ms">send</span></button></div>' +
      '<details class="aibox" id="aibox"><summary><span class="ms">auto_awesome</span>' + (cfg.on ? (cfg.provider === 'ovumind' ? 'Luna’s own model is on' : 'AI mode on · your own key') : 'AI mode off · rules only') + infoBtn('luna') + '</summary>' + guideHTML('luna') +
      '<div class="field"><label for="aiProv">Who reads a note the rules cannot</label><select class="input" id="aiProv"><option value="ovumind"' + (cfg.provider === 'ovumind' ? ' selected' : '') + '>Luna’s own model (Doubao Seed 2.1, free, no key)</option><option value="openrouter"' + (cfg.provider === 'openrouter' ? ' selected' : '') + '>My OpenRouter key</option><option value="ark"' + (cfg.provider === 'ark' ? ' selected' : '') + '>My Volcengine Ark key</option></select></div>' +
      '<div class="grid2 ownkey' + (cfg.provider === 'ovumind' ? ' hidden' : '') + '" id="ownKey"><div class="field"><label for="aiModel">Model</label><input class="input" id="aiModel" value="' + esc(cfg.model || '') + '" placeholder="' + esc(ORB.OR_MODEL) + '"></div><div class="field"><label for="aiKey">API key (stays on this device)</label><input class="input" id="aiKey" type="password" autocomplete="off" value="' + esc(cfg.key || '') + '" placeholder="sk-or-..."></div></div>' +
      '<div class="row"><button type="button" class="btn soft" id="aiSave"><span class="ms">save</span>Save</button><button type="button" class="btn ghost" id="aiToggle">' + (cfg.on ? 'Turn AI off (rules only)' : 'Turn AI on') + '</button></div><p>Luna’s own model runs through a small Ovumind relay that holds the key, allows about 80 notes a day per person and keeps nothing. Rules on this device always run first, and whatever is understood is shown to you before it is saved.</p></details>');
    var chat = $('#chat');
    function bubble(kind, html) { var d = document.createElement('div'); d.className = 'bub ' + (kind === 'luna' ? 'from-luna' : kind); d.innerHTML = html; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d; }
    if (!lunaLog.length) bubble('luna', '<b>Luna</b>Hello' + (S.profile().name ? ', ' + esc(S.profile().name) : '') + '. Tell me about your sleep, your period, how you feel, what you ate, or a pause you took. I will show you what I understood before saving.');
    lunaLog.forEach(function (m) { bubble(m.kind, m.html); });
    function remember(kind, html) { lunaLog.push({ kind: kind, html: html }); lunaLog = lunaLog.slice(-12); }
    function confirmCard(entries) {
      var card = bubble('confirm', '<h4>Here is what I understood</h4>' + entries.map(function (e, i) { return '<label><input type="checkbox" checked data-i="' + i + '"><span>' + esc(ORB.describe(e)) + ' <em style="color:var(--rm-ink-3);font-style:normal">· ' + esc(prettyDate(e.date)) + '</em></span></label>'; }).join('') + '<div class="row"><button type="button" class="btn primary" id="lunaSave"><span class="ms">check</span>Save ticked</button><button type="button" class="btn ghost" id="lunaDiscard">Discard</button></div>');
      card.querySelector('#lunaDiscard').addEventListener('click', function () { card.remove(); });
      card.querySelector('#lunaSave').addEventListener('click', function () {
        var picked = $$('input[type=checkbox]', card).filter(function (c) { return c.checked; }).map(function (c) { return entries[Number(c.dataset.i)]; });
        if (!picked.length) return card.remove();
        var saved = ORB.save(picked); card.remove();
        var r = ORB.reply(), line = '<b>Luna</b>' + esc(r) + ' Saved ' + saved.length + ' entr' + (saved.length === 1 ? 'y' : 'ies') + '.';
        bubble('luna', line); remember('luna', line);
        saved.forEach(function (ev) { afterSave(ev, 'Saved through Luna.'); });
      });
    }
    function send(text) {
      text = (text || '').trim(); if (!text) return;
      bubble('me', esc(text)); remember('me', esc(text)); $('#lunaIn').value = '';
      var local = ORB.parseLocal(text), cfg2 = ORB.aiConfig(), aiOk = cfg2.on && (cfg2.provider === 'ovumind' || cfg2.key);
      /* Short canonical notes (the shortcut chips) are read by the rules instantly; longer or
       * unmatched notes go to the model first, and the rules stay as the offline fallback. */
      if (aiOk && (!local.length || text.length > 36)) {
        var thinking = bubble('luna', '<b>Luna</b>Thinking with ' + esc(cfg2.provider === 'ovumind' ? 'Doubao' : (cfg2.model || ORB.OR_MODEL)) + '…');
        ORB.parseAI(text).then(function (res) {
          thinking.remove();
          if (res.entries.length) { if (res.reply) bubble('luna', '<b>Luna</b>' + esc(res.reply)); confirmCard(res.entries); }
          else if (local.length) confirmCard(local);
          else bubble('luna', '<b>Luna</b>' + esc(res.reply || 'I could not find anything to log in that. Try naming the sleep, period, symptom, meal or minutes.'));
        }).catch(function (e) {
          thinking.remove();
          if (local.length) { bubble('luna', '<b>Luna</b>' + esc(e.message) + ' I used the on-device rules instead.'); confirmCard(local); }
          else bubble('luna', '<b>Luna</b>' + esc(e.message));
        });
        return;
      }
      if (local.length) { confirmCard(local); return; }
      bubble('luna', '<b>Luna</b>I did not catch a sleep time, period, symptom, meal or practice in that. Try "slept 11pm to 7am", "period started, heavy", "cramps 6/10", "had chicken rice for lunch" or "meditated 10 min". Turn AI on in the panel below and freer wording works too.');
    }
    $('#lunaSend').addEventListener('click', function () { send($('#lunaIn').value); });
    $('#lunaIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(this.value); });
    $('#quick').addEventListener('click', function (e) {
      var pen = e.target.closest('.qpen'), go = e.target.closest('.qsend');
      if (pen) { var inp = $('#lunaIn'); inp.value = pen.dataset.q; inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (err) { } toast('Edit the numbers, then send.', 'edit'); return; }
      if (go) send(go.dataset.q);
    });
    $('#aiProv').addEventListener('change', function () { $('#ownKey').classList.toggle('hidden', this.value === 'ovumind'); });
    $('#aiSave').addEventListener('click', function () { var c = ORB.aiConfig(); c.provider = $('#aiProv').value; c.model = $('#aiModel').value.trim(); c.key = $('#aiKey').value.trim(); if (c.provider !== 'ovumind' && !c.key) { toast('Paste a key, or choose Luna’s own model.', 'key'); return; } c.on = true; ORB.setAiConfig(c); toast('Saved on this device.', 'save'); openLuna($('#lunaIn').value); });
    $('#aiToggle').addEventListener('click', function () { var c = ORB.aiConfig(); c.on = !c.on; if (c.on && c.provider !== 'ovumind' && !c.key) c.provider = 'ovumind'; ORB.setAiConfig(c); openLuna($('#lunaIn').value); });
    if (prefill) send(prefill);
  }
  $('#lunaBtn').addEventListener('click', function () { chime('tap'); $('#lunaBtn').classList.remove('hinting'); openLuna(); });

  /* ---------- yoga mat: mindfulness with Erin projected beside you ---------- */
  var meditating = false, session = null;
  function enterMeditation() { meditating = true; avatar.classList.add('hidden'); setTimeout(function () { meditator.classList.add('on'); $('#aura').classList.add('on'); }, 350); }
  function exitMeditation() { meditating = false; meditator.classList.remove('on'); $('#aura').classList.remove('on'); holo.classList.remove('on'); hud.classList.remove('on'); setTimeout(function () { avatar.classList.remove('hidden'); placeAvatar(HOME, false); avatar.classList.add('idle'); }, 300); }
  meditator.addEventListener('click', function () { if (current !== 'mind') openMindfulness(); });
  function playClip(name) {
    return new Promise(function (resolve) {
      if (!session || session.stopped) return resolve();
      caption(CAPTION[name] || ''); var a = new Audio(ERIN + name + '.mp3'); session.audio = a;
      a.onended = function () { resolve(); }; a.onerror = function () { resolve(); };
      a.play().catch(function () { resolve(); });
    });
  }
  function wait(ms) { return new Promise(function (resolve) { if (!session || session.stopped) return resolve(); session.timer = setTimeout(resolve, ms); }); }
  function setOrb(phase, text) { var o = $('#orb'), t = $('#orbText'); if (o) { o.className = 'orb ' + phase; if (text) t.textContent = text; } var ho = $('#hudOrb'); ho.className = 'hud-orb ' + phase; if (text) $('#hudLine').textContent = text; }
  function caption(text) { if (!text) return; $('#hudLine').textContent = text; var t = $('#orbText'); if (t) t.textContent = text; }
  function runSession(kind, minutes) {
    session = { kind: kind, minutes: minutes, startedAt: Date.now(), stopped: false, audio: null, timer: null };
    hideSheet(); holo.classList.toggle('on', kind === 'erin'); hud.classList.add('on'); $('#hudTitle').textContent = kind === 'erin' ? 'With Erin' : 'Just breathe';
    var total = minutes * 60000, cycleMs = kind === 'erin' ? 11000 : 14000, hour = new Date().getHours();
    var today = S.today(), cramps = S.list('symptom', { from: today, to: today }).some(function (e) { return (e.data.symptoms || []).indexOf('cramps') > -1; }) || S.list('period', { from: today, to: today }).length > 0;
    var guides = ['guide_soften', 'guide_feet', 'guide_wander', 'guide_nothing_to_fix', 'guide_quiet_work'].concat(cramps ? ['guide_cramps'] : []);
    var p = Promise.resolve();
    if (kind === 'erin') {
      p = p.then(function () { setOrb('hold', 'Hello'); return playClip(hour < 12 ? 'greeting_morning' : 'greeting_evening'); })
        .then(function () { setOrb('hold', 'Settling in'); return playClip('meditation_begin'); });
    }
    p = p.then(function () {
      var fixed = kind === 'erin' ? 52000 : 0, cycles = Math.max(3, Math.round((total - fixed) / cycleMs)), chain = Promise.resolve(), gi = 0;
      for (var i = 0; i < cycles; i++) {
        (function (idx) {
          chain = chain.then(function () { if (session.stopped) return; setOrb('in', 'Breathe in'); if (kind === 'erin') return playClip('breathing_in').then(function () { return wait(2000); }); chime('bell', true); return wait(4000); })
            .then(function () { if (session.stopped) return; setOrb('hold', 'Hold'); return wait(kind === 'erin' ? 3000 : 4000); })
            .then(function () { if (session.stopped) return; setOrb('out', 'Breathe out'); if (kind === 'erin') return playClip('breathing_out').then(function () { return wait(3000); }); return wait(6000); })
            .then(function () { if (session.stopped || kind !== 'erin') return; if (idx % 2 === 1 && gi < guides.length) { setOrb('hold', ''); return playClip(guides[gi++]).then(function () { return wait(1500); }); } });
        })(i);
      }
      return chain;
    });
    if (kind === 'erin') p = p.then(function () { setOrb('hold', 'Coming back'); return playClip('meditation_end'); }).then(function () { return playClip('guide_thanks'); }).then(function () { return playClip(Math.random() < 0.5 ? 'closing_steady' : 'closing_patience'); });
    p.then(function () { if (!session || session.stopped) return; finishSession(true); });
  }
  function finishSession(completed) {
    if (!session) return;
    var mins = Math.max(0.5, Math.round((Date.now() - session.startedAt) / 6000) / 10);
    var ev = S.add('mindfulness', S.today(), { kind: session.kind, minutes: completed ? session.minutes : mins, completed: completed, startedAt: new Date(session.startedAt).toISOString(), guide: session.kind === 'erin' ? 'Erin Lee, Take A Pause (cloned voice clips)' : 'Breathing orb' });
    session.stopped = true; session = null;
    setOrb('out', completed ? 'Well done' : 'Paused'); chime('bell', true);
    setTimeout(exitMeditation, 2500); afterSave(ev, (completed ? 'Session complete. ' : 'Session saved. ') + (ev.data.minutes) + ' min of calm added to your journal.');
  }
  function stopSession(fromClose) {
    if (!session) { if (meditating) exitMeditation(); return; }
    var elapsedMin = (Date.now() - session.startedAt) / 60000;
    session.stopped = true; clearTimeout(session.timer); if (session.audio) { try { session.audio.pause(); } catch (e) { } }
    if (elapsedMin >= 1) finishSession(false); else { session = null; exitMeditation(); if (!fromClose) toast('Stopped. Nothing under a minute is recorded.', 'self_improvement'); }
  }
  $('#hudStop').addEventListener('click', function () { if (practice) stopPractice(); else stopSession(false); });
  function openMindfulness() {
    if (session) { hud.classList.add('on'); return; }
    var recent = S.list('mindfulness', { from: S.addDays(S.today(), -6), to: S.today() }), mins = recent.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0);
    enterMeditation();
    openSheet('mind', 'Your mat', 'Erin appears beside you while you practise', 'self_improvement',
      '<div class="erin"><img src="assets/avatars/erin/erin_square.jpeg" alt="Erin Lee"><div><b>Erin Lee · Mindful Moments</b><small>Mindfulness teacher and author in Singapore. When you begin, the sheet closes and Erin’s projection sits beside you on the mat, speaking in her voice: a greeting, settling in, slow breaths with gentle reminders, and a soft close. Her words are shown as captions.</small><a href="https://mindfulmoments.sg/" target="_blank" rel="noopener">mindfulmoments.sg</a></div></div>' +
      '<div class="sessions" id="sessions"><button type="button" class="session on" data-kind="erin" data-min="3"><b>Erin · 3 minutes</b><small>Guided breathing, a soft close</small></button><button type="button" class="session" data-kind="erin" data-min="6"><b>Erin · 6 minutes</b><small>A longer settle and more reminders</small></button><button type="button" class="session" data-kind="breathe" data-min="2"><b>Just breathe · 2 min</b><small>4-4-6 orb with a quiet bell</small></button><button type="button" class="session" data-kind="breathe" data-min="5"><b>Just breathe · 5 min</b><small>Silent, follow the orb</small></button></div>' +
      '<div class="orbwrap"><div class="orb out" id="orb"></div><div class="orbtext" id="orbText">Ready when you are</div><div class="orbsub" id="orbSub">' + (mins ? Math.round(mins) + ' min this week' : 'First session this week') + '</div></div>' +
      '<div class="row"><button class="btn primary" id="mindStart"><span class="ms">self_improvement</span>Begin</button><button class="btn soft" id="mindAcu"><span class="ms">spa</span>Cramp relief points</button></div>' +
      '<div class="row"><button type="button" class="btn soft" id="mindEveryday"><span class="ms">home</span>Everyday practice</button><a class="btn ghost" href="https://erinmindfulmoments.substack.com/p/the-quiet-work-of-change" target="_blank" rel="noopener"><span class="ms">article</span>Read Erin</a></div>' +
      '<p class="help">Sessions of a minute or more are saved to your journal. Erin’s clips are pre-recorded in her cloned voice (with her consent), so this works offline once loaded.</p>');
    $('#sessions').addEventListener('click', function (e) { var b = e.target.closest('.session'); if (!b || session) return; $$('.session').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    $('#mindStart').addEventListener('click', function () { if (session) return; var sel = $('.session.on'); runSession(sel.dataset.kind, Number(sel.dataset.min)); });
    $('#mindAcu').addEventListener('click', openAcupressure);
    $('#mindEveryday').addEventListener('click', function () { openEveryday(); });
  }

  /* ---------- acupressure: numbered points on your avatar, then a zoomed locator ---------- */
  var acuData = null;
  /* region illustrations (Seedream, 18 Oct) and where each point sits on them, percent of the image */
  var ACU_REGIONS = {
    belly: { img: 'belly', title: 'Lower belly', pts: { cv6: [[56, 63]], cv4: [[56, 73.5]], cv3: [[56, 81]], st29: [[42, 81], [70, 81]] } },
    innerleg: { img: 'innerleg', title: 'Inner lower leg', pts: { sp6: [[61, 63]], ki3: [[68, 79]], sp10: [[49, 7]] } },
    outerleg: { img: 'outerleg', title: 'Outer lower leg', pts: { st36: [[41, 36]] } },
    foot: { img: 'foot', title: 'Top of the foot', pts: { lr3: [[46, 46]] } },
    hand: { img: 'hand', title: 'Back of the hand', pts: { li4: [[40, 55]] } },
    forearm: { img: 'forearm', title: 'Inner forearm, palm up', pts: { pc6: [[53, 58]] } },
    back: { img: 'back', title: 'Lower back', pts: { bl23: [[44, 43], [56, 43]], gv4: [[50, 43]] } }
  };
  var ACU_ORDER = ['belly', 'innerleg', 'outerleg', 'foot', 'hand', 'forearm', 'back'];
  /* one badge per body region on the small avatar, so the markers never crowd */
  var ACU_BADGE = { belly: [50, 70], innerleg: [51, 93], outerleg: [39, 87], foot: [44, 99], hand: [71, 75], forearm: [69, 68.5] };
  var ACU_FIND = {
    sp6: 'Find the bump of your inner ankle. Lay four fingers flat above it; the point is level with your top finger, just behind the shin bone.',
    cv6: 'Two finger-widths straight below your navel, on the midline.',
    cv4: 'Four finger-widths below your navel, on the midline.',
    cv3: 'One thumb-width above the pubic bone on the midline (four finger-widths plus a thumb below the navel).',
    st29: 'Level with CV3, three finger-widths either side of the midline.',
    st36: 'Find the dip just below the outer edge of the kneecap. Go four finger-widths down and one finger-width outward from the shin bone.',
    sp10: 'Sit with the knee bent. Two thumb-widths above the top inner corner of the kneecap, on the bulge of the thigh muscle.',
    ki3: 'In the hollow between the inner ankle bone and the Achilles tendon, level with the tip of the bone.',
    lr3: 'Slide a finger up from the web between the big toe and the second toe until it stops where the two long bones meet.',
    li4: 'Press the thumb against the index finger; the point is the highest spot of the mound on the back of the hand, toward the index-finger bone.',
    pc6: 'Three finger-widths above the inner wrist crease, between the two tendons you feel when you make a fist.',
    bl23: 'At waist level, two finger-widths either side of the spine, roughly level with your navel at the front.',
    gv4: 'On the spine at waist level, in the dip below the second lumbar bone, roughly level with your navel.'
  };
  function regionOf(id) { var r = null; Object.keys(ACU_REGIONS).forEach(function (k) { if (ACU_REGIONS[k].pts[id]) r = k; }); return r; }
  function openAcupressure() {
    if (current !== 'mind' && meditating && !session) exitMeditation();
    (acuData ? Promise.resolve(acuData) : loadJSON('assets/data/acupoints.json').then(function (d) { acuData = d; return d; })).then(function (d) {
      var ev = d.evidence['atlas-period-pain'];
      GUIDES.acu.evidence = ev.sources.map(function (s) { return [s.authors + ' (' + s.year + '), ' + s.journal + ': ' + s.title, s.url]; });
      var byId = {}; d.points.forEach(function (p) { byId[p.id] = p; });
      var order = []; ACU_ORDER.forEach(function (rk) { Object.keys(ACU_REGIONS[rk].pts).forEach(function (id) { if (byId[id] && order.indexOf(id) < 0) order.push(id); }); });
      var num = {}; order.forEach(function (id, k) { num[id] = k + 1; });
      openSheet('acu', 'Cramp relief points', 'Numbered on you, then zoomed in so you can find them', 'spa',
        '<p class="help">Tap a number. Use a thumb or fingertip, press gently for one to two minutes on each side, breathe slowly, and stop if anything hurts. An educational atlas, not a treatment plan. ' + infoBtn('acu') + '</p>' + guideHTML('acu') +
        '<div class="acuwrap"><div class="acufig"><img src="' + ART + 'avatar-base.webp" alt="Your avatar, standing">' + ACU_ORDER.filter(function (rk) { return ACU_BADGE[rk]; }).map(function (rk) { var ids = Object.keys(ACU_REGIONS[rk].pts).filter(function (id) { return byId[id]; }); if (!ids.length) return ''; var ns = ids.map(function (id) { return num[id]; }); var lab = ns.length > 1 ? ns[0] + '–' + ns[ns.length - 1] : String(ns[0]); return '<button type="button" class="pt range" data-region="' + rk + '" data-pt="' + ids[0] + '" style="left:' + ACU_BADGE[rk][0] + '%;top:' + ACU_BADGE[rk][1] + '%" aria-label="' + esc(ACU_REGIONS[rk].title + ', points ' + lab) + '">' + lab + '</button>'; }).join('') + '</div>' +
        '<div class="aculist" id="aculist">' + ACU_ORDER.map(function (rk) { var ids = Object.keys(ACU_REGIONS[rk].pts).filter(function (id) { return byId[id]; }); if (!ids.length) return ''; return '<h5>' + esc(ACU_REGIONS[rk].title) + '</h5>' + ids.map(function (id) { return '<button type="button" data-pt="' + id + '"><i>' + num[id] + '</i><span><b>' + esc(byId[id].code) + ' · ' + esc(byId[id].name) + '</b><small>' + esc(byId[id].kind === 'abdomen' ? 'below the navel' : byId[id].kind) + (ACU_CAUTION[id] ? ' · not in pregnancy' : '') + '</small></span></button>'; }).join(''); }).join('') + '</div></div>' +
        '<div class="locator" id="locator"></div>');
      function show(id) {
        var p = byId[id]; if (!p) return; var rk = regionOf(id), R = ACU_REGIONS[rk];
        $$('[data-pt]', body).forEach(function (b) { b.classList.toggle('on', b.dataset.region ? b.dataset.region === rk : b.dataset.pt === id); });
        $('#locator').innerHTML = '<div class="zoom"><img src="assets/room/acu/' + R.img + '.webp" alt="' + esc(R.title) + '">' + R.pts[id].map(function (xy) { return '<i class="mark' + (ACU_CAUTION[id] ? ' caution' : '') + '" style="left:' + xy[0] + '%;top:' + xy[1] + '%"></i>'; }).join('') + '<span class="ztitle">' + num[id] + ' · ' + esc(p.code) + ' · ' + esc(R.title.toLowerCase()) + '</span></div>' +
          '<div class="txt"><h3>' + esc(p.code) + ' · ' + esc(p.name) + '<small>' + esc(p.cn) + ' · ' + esc(p.channel) + '</small></h3>' +
          '<div class="find"><span class="ms">touch_app</span><span>' + esc(ACU_FIND[id] || p.location) + (p.bilateral ? ' Both sides.' : '') + '</span></div>' +
          '<p><b>Atlas wording:</b> ' + esc(p.location) + '</p>' + (p.research ? '<p>' + esc(p.research) + '</p>' : '') +
          '<div class="how"><div><span class="ms">touch_app</span>Thumb or fingertip</div><div><span class="ms">timer</span>1 to 2 minutes</div><div><span class="ms">air</span>Slow breaths</div></div>' + (ACU_CAUTION[id] ? '<div class="warn">' + esc(ACU_CAUTION[id]) + '</div>' : '') +
          '<p class="cunkey">Finger-widths are the traditional body units (B-cun): one thumb-width is 1, two fingers 1.5, three fingers 2, four fingers 3. The marker shows the area; the written location is the standard. WHO standard acupuncture point locations (2008), page ' + p.whoPage + '.</p></div>';
        $('#locator').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      body.addEventListener('click', function (e) { var b = e.target.closest('[data-pt]'); if (b) { chime('tap'); show(b.dataset.pt); } });
      show('sp6');
    }).catch(function (e) { toast('Could not load the atlas: ' + e.message, 'error'); });
  }

  /* ---------- a livelier avatar: micro-moments between taps ---------- */
  var lifeTimer = null, lifeBusy = false;
  function scheduleLife() { clearTimeout(lifeTimer); if (reduced) return; lifeTimer = setTimeout(lifeMoment, 12000 + Math.random() * 14000); }
  function lifeMoment() {
    if (S.state().sleeping || meditating || practice || current || arranging || lifeBusy || document.hidden || avatar.classList.contains('walking')) { scheduleLife(); return; }
    lifeBusy = true;
    var h = new Date().getHours(), pool = h < 11 ? ['coffee', 'stretch', 'plants', 'bed'] : h < 18 ? ['plants', 'pets', 'outfit', 'coffee'] : ['bed', 'stretch', 'pets', 'coffee'];
    var pose = pool[Math.floor(Math.random() * pool.length)];
    var thought = { coffee: '☕', stretch: '✨', bed: '💤', plants: '🌱', pets: '🐾', outfit: '👗' }[pose];
    avatar.classList.add('moment'); setPose(pose); showThought(thought);
    setTimeout(function () { avatar.classList.remove('moment'); if (!practice) restorePose(); hideThought(); lifeBusy = false; scheduleLife(); }, 3200 + Math.random() * 1400);
  }
  function showThought(t) { var el = $('#thought'); if (!el) return; el.textContent = t; el.classList.add('on'); }
  function hideThought() { var el = $('#thought'); if (el) el.classList.remove('on'); }
  function joy() { avatar.classList.remove('joy'); void avatar.offsetWidth; avatar.classList.add('joy'); setTimeout(function () { avatar.classList.remove('joy'); }, 560); }

  /* ---------- everyday mindfulness: guides for what you are really doing ---------- */
  var MF = window.OvuMindful, practice = null, GUIDE = 'assets/audio/guide-interim/';
  function playUrl(url) { return new Promise(function (resolve) { if (!practice || practice.stopped) return resolve(); var a = new Audio(url); practice.audio = a; a.onended = function () { resolve(); }; a.onerror = function () { resolve(); }; a.play().catch(function () { resolve(); }); }); }
  function pwait(ms) { return new Promise(function (resolve) { if (!practice || practice.stopped) return resolve(); practice.timer = setTimeout(resolve, ms); }); }
  function setPose(pose) { var img = new Image(); img.onload = function () { avatarImg.src = img.src; }; img.src = ART + 'avatar-act-' + pose + '.webp'; }
  function restorePose() { setOutfit(S.profile().outfit || 'base', true); }
  function openEveryday(selId) {
    var ex = MF.explored();
    openSheet('everyday', 'Everyday mindfulness', 'Guides for things you are really doing', 'self_improvement',
      '<div class="erin small"><img src="assets/avatars/erin/erin_square.jpeg" alt="Erin Lee"><div><b>Informal practice, with Erin</b><small>Pick what you are about to do for real, press Begin as you start, and let the guide walk alongside you. The guides are spoken in Erin’s voice from interim scripts; her own written scripts will replace them one by one.</small></div></div>' +
      '<div class="acts" id="acts">' + MF.ACTIVITIES.map(function (a) { var n = ex[a.id] || 0; return '<button type="button" class="act' + (selId === a.id ? ' on' : '') + '" data-act="' + a.id + '"><img src="' + ART + 'avatar-act-' + a.pose + '.webp" alt=""><span><b>' + esc(a.name) + '</b><small>' + esc(a.when) + ' · ' + a.minutes + ' min</small></span><em>' + (n ? '<span class="ms">check_circle</span>' + n : '<span class="ms fill">favorite</span>15') + '</em></button>'; }).join('') + '</div>' +
      '<div class="actdetail" id="actDetail"></div>' +
      '<p class="help">Each completed practice earns 5 hearts, and 10 more the first time you try an activity. The point is not the points: it is two ordinary minutes, fully lived. Please only confirm practices you really did.</p>');
    function detail(id) {
      var a = MF.byId(id), v = MF.nextVariation(a), vi = a.variations.indexOf(v), n = MF.timesDone(id);
      $$('.act', body).forEach(function (b) { b.classList.toggle('on', b.dataset.act === id); });
      $('#actDetail').innerHTML = '<div class="actcard"><div class="acthead"><img src="' + ART + 'avatar-act-' + a.pose + '.webp" alt=""><div><h3>' + esc(a.name) + '</h3><p>' + esc(a.intro) + '</p><small>Script ' + (vi + 1) + ' of ' + a.variations.length + ' · “' + esc(v.title) + '” · about ' + Math.max(1, Math.round(MF.totalSecs(v) / 60)) + ' min' + (n ? ' · done ' + n + ' time' + (n > 1 ? 's' : '') : ' · first time: +10 ♥') + '</small></div></div>' +
        '<ol class="steps">' + v.steps.map(function (s) { return '<li>' + esc(s.text) + '</li>'; }).join('') + '</ol>' +
        '<div class="row"><button type="button" class="btn primary" id="actStart" data-act="' + id + '" data-v="' + vi + '"><span class="ms">play_arrow</span>Begin as you begin</button></div></div>';
      $('#actDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    body.addEventListener('click', function (e) { var st = e.target.closest('#actStart'); if (st) { runPractice(st.dataset.act, Number(st.dataset.v)); return; } var b = e.target.closest('[data-act]'); if (b) { chime('tap'); detail(b.dataset.act); } });
    if (selId) detail(selId);
  }
  function runPractice(id, vi) {
    var a = MF.byId(id); if (!a || practice) return; var v = a.variations[vi] || a.variations[0]; vi = a.variations.indexOf(v);
    practice = { a: a, vi: vi, v: v, startedAt: Date.now(), stopped: false, audio: null, timer: null, total: MF.totalSecs(v) };
    hideSheet(); hud.classList.add('on'); $('#hudTitle').textContent = a.name; setPose(a.pose); avatar.classList.add('acting');
    var chain = Promise.resolve();
    v.steps.forEach(function (s, si) {
      chain = chain.then(function () {
        if (!practice || practice.stopped) return;
        caption(s.text); if (si) chime('bell', true);
        var t0 = Date.now();
        return playUrl(GUIDE + id + '-' + vi + '-' + si + '.mp3').then(function () { return pwait(Math.max(0, s.secs * 1000 - (Date.now() - t0))); });
      });
    });
    chain.then(function () { if (practice && !practice.stopped) askPracticeDone(true); });
  }
  function askPracticeDone(finished) {
    var p = practice; if (!p) return;
    p.stopped = true; clearTimeout(p.timer); if (p.audio) { try { p.audio.pause(); } catch (e) { } }
    var secs = Math.round((Date.now() - p.startedAt) / 1000);
    chime('bell', true); caption(finished ? 'That is the practice.' : 'Paused');
    openSheet('practiceDone', finished ? 'How was that?' : 'Stopping early', p.a.name, 'self_improvement',
      '<div class="orbwrap"><div class="orb out"></div><div class="orbtext">' + (finished ? 'Did you really do it, with attention?' : 'You did about ' + Math.max(1, Math.round(secs / 60)) + ' minute' + (secs >= 90 ? 's' : '') + '. Count it?') + '</div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="pdYes"><span class="ms">check</span>Yes, I did</button><button type="button" class="btn ghost" id="pdNo">Not really</button></div>' +
      '<p class="help">Only real practice counts. This stays between you and your room.</p>');
    function end(confirmed) {
      hud.classList.remove('on'); avatar.classList.remove('acting'); restorePose(); practice = null; closeSheet();
      if (confirmed && secs >= 30) { var r = MF.complete(p.a.id, p.vi, secs, true); afterSave(r.event, (r.first ? 'First ' + p.a.name.toLowerCase() + ' practice! ' : '') + 'Saved to your journal.'); }
      else toast('No worries. The practice is there whenever you are.', 'self_improvement');
    }
    $('#pdYes').addEventListener('click', function () { end(true); });
    $('#pdNo').addEventListener('click', function () { end(false); });
  }
  function stopPractice() {
    if (!practice) return;
    var elapsed = (Date.now() - practice.startedAt) / 1000;
    if (elapsed >= Math.min(60, practice.total * 0.5)) { askPracticeDone(false); return; }
    practice.stopped = true; clearTimeout(practice.timer); if (practice.audio) { try { practice.audio.pause(); } catch (e) { } }
    hud.classList.remove('on'); avatar.classList.remove('acting'); restorePose(); practice = null;
    toast('Stopped. Nothing under a minute is recorded.', 'self_improvement');
  }

  /* ---------- ERIN welcome + getting to know you (in the room, so the theme never changes) ---------- */
  var ONB = [
    { id: 'privacy', pose: 'bed', title: 'First, the honest part', sub: 'Before any question, here is what happens to your answers.', type: 'info', items: [['lock', 'They stay in this browser', 'Entries, answers and hearts live on this phone. There is no account and nothing is uploaded.'], ['tune', 'They tune your room', 'Cycle answers shape predictions; the rest chooses guides and notes. Nothing here diagnoses.'], ['visibility', 'Nobody is watching', 'No one at Ovumind sees your records or receives alerts. The relay that reads a Luna note keeps nothing.']] },
    { id: 'age', pose: 'coffee', title: 'How old are you?', sub: 'Age shapes what is typical for cycles, so the notes stay honest.', type: 'chips', key: 'ageBand', options: [['under13', 'Under 13'], ['13-17', '13–17'], ['18-24', '18–24'], ['25-29', '25–29'], ['30-34', '30–34'], ['35-39', '35–39'], ['40-44', '40–44'], ['45-49', '45–49'], ['50+', '50+']], note: function (A) { return A.ageBand === 'under13' ? 'Please set Ovumind up together with a parent or guardian. We keep it gentle and short.' : (A.ageBand === '13-17' ? 'Welcome. Your answers stay private on this phone; a trusted adult can help if anything here feels confusing.' : ''); } },
    { id: 'started', pose: 'teeth', title: 'Have your periods started?', sub: 'Everything that follows adapts to this.', type: 'rows', rows: [{ key: 'periodsStarted', label: 'Periods', options: [['yes', 'Yes'], ['no', 'Not yet'], ['unsure', 'Not sure']] }, { key: 'menarche', label: 'How old were you at the first one?', options: [['lt10', 'Under 10'], ['10-12', '10–12'], ['13-15', '13–15'], ['16+', '16 or older'], ['unknown', 'Don’t remember']], showIf: function (A) { return A.periodsStarted === 'yes'; } }] },
    { id: 'regular', pose: 'stretch', title: 'How regular are they?', sub: 'Regular means you can roughly guess the next one.', type: 'chips', key: 'regularity', options: [['regular', 'Fairly regular'], ['irregular', 'Irregular'], ['rare', 'Rare, with gaps of 3 months or more'], ['none12', 'No period for 12 months or more'], ['unsure', 'Not sure']], showIf: function (A) { return A.periodsStarted !== 'no'; } },
    { id: 'preg', pose: 'plants', title: 'Pregnancy and plans', sub: 'These change how dates should be read.', type: 'rows', rows: [{ key: 'pregState', label: 'Right now', options: [['none', 'None of these'], ['maybe', 'I could be pregnant'], ['pregnant', 'Pregnant'], ['postpartum', 'Gave birth in the last year'], ['loss', 'Recent pregnancy loss']] }, { key: 'breastfeeding', label: 'Breastfeeding', options: [['yes', 'Yes'], ['no', 'No']], showIf: function (A) { return A.pregState === 'postpartum'; } }, { key: 'periodsBack', label: 'Have periods returned?', options: [['yes', 'Yes'], ['no', 'Not yet']], showIf: function (A) { return A.pregState === 'postpartum'; } }, { key: 'plans', label: 'Plans', options: [['ttc', 'Trying to conceive now'], ['later', 'Maybe later'], ['no', 'Not planning']] }, { key: 'ttcMonths', label: 'Months trying', options: [['0-5', '0–5'], ['6-11', '6–11'], ['12+', '12 or more']], showIf: function (A) { return A.plans === 'ttc'; } }, { key: 'fertilityTx', label: 'Fertility treatment before?', options: [['no', 'No'], ['yes', 'Yes']], showIf: function (A) { return A.plans === 'ttc'; } }] },
    { id: 'hormones', pose: 'outfit', title: 'Hormones and medicines', sub: 'Tick what you use now. These change what cycle dates mean.', type: 'multi', key: 'hormones', options: [['pill', 'Combined pill'], ['pop', 'Progestogen-only pill'], ['iud_h', 'Hormonal IUD'], ['iud_cu', 'Copper IUD'], ['implant', 'Implant or injection'], ['hrt', 'HRT (MHT)'], ['fertility', 'Fertility medicines'], ['ec', 'Emergency contraception this month'], ['other', 'Other relevant medicine'], ['none', 'None']], exclusive: ['none'] },
    { id: 'last', pose: 'bed', title: 'When did your last period start?', sub: 'The first day of bleeding, not spotting. Skip if you are not sure.', type: 'date', key: 'lastPeriodStart', optional: true, showIf: function (A) { return A.periodsStarted !== 'no' && A.regularity !== 'none12'; } },
    { id: 'cycle', pose: 'stretch', title: 'Your usual rhythm', sub: 'Cycle length is from the first day of one period to the first day of the next.', type: 'rows', showIf: function (A) { return A.periodsStarted !== 'no' && A.regularity !== 'none12'; }, rows: [{ key: 'cycleLength', label: 'Days from one period to the next', options: [['19', 'Under 21'], ['23', '21–24'], ['28', '25–30'], ['33', '31–35'], ['40', '36–45'], ['rare', '46 or more'], ['varies', 'Varies a lot'], ['unknown', 'Don’t know']] }, { key: 'periodLength', label: 'Days of bleeding', options: [['1', '1'], ['3', '2–3'], ['5', '4–5'], ['6', '6–7'], ['8', '8 or more']] }] },
    { id: 'bleed', pose: 'teeth', title: 'Bleeding and pain', sub: 'Tick anything that happens. These are worth a conversation, not a worry.', type: 'multi', key: 'bleedSigns', options: [['flooding', 'Soaking through protection every 1 to 2 hours, or flooding'], ['between', 'Bleeding between periods or after sex'], ['postmeno', 'Bleeding after 12+ months without periods'], ['painlife', 'Pain that disrupts school, work or sleep'], ['none', 'None of these']], exclusive: ['none'], showIf: function (A) { return A.periodsStarted !== 'no'; } },
    { id: 'urgent', pose: 'shower', title: 'Anything happening right now?', sub: 'Only tick if it is happening today.', type: 'multi', key: 'urgent', options: [['severepain', 'Sudden severe pelvic pain'], ['faint', 'Fainting or dizziness with bleeding'], ['shoulder', 'Shoulder-tip pain with pelvic pain'], ['uncontrolled', 'Bleeding I cannot control'], ['none', 'None of these']], exclusive: ['none'] },
    { id: 'dx', pose: 'dishes', title: 'Has a clinician told you about any of these?', sub: 'Self-reported is fine. Tick all that apply.', type: 'multi', key: 'conditions', options: [['pcos', 'PCOS'], ['endo', 'Endometriosis'], ['fibroids', 'Fibroids'], ['thyroid', 'Thyroid condition'], ['poi', 'Early menopause or POI'], ['cysts', 'Ovarian cysts'], ['pid', 'Pelvic infection'], ['surgery', 'Surgery on womb, tubes or ovaries'], ['oophorectomy', 'One or both ovaries removed'], ['hysterectomy', 'Hysterectomy'], ['chemo', 'Chemotherapy or pelvic radiotherapy'], ['anaemia', 'Low iron or anaemia'], ['other', 'Something else'], ['unsure', 'Not sure'], ['none', 'None']], exclusive: ['none'] },
    { id: 'family', pose: 'pets', title: 'In your family', sub: 'Relationships only, no names. Family patterns help read your own.', type: 'multi', key: 'family', options: [['meno40', 'Mother or sister: menopause before 40'], ['meno44', 'Mother or sister: menopause at 40–44'], ['pcosendo', 'PCOS or endometriosis'], ['cancer', 'Ovarian or breast cancer'], ['brca', 'Known BRCA or Lynch finding'], ['none', 'None that I know of'], ['unknown', 'Don’t know']], exclusive: ['none', 'unknown'] },
    { id: 'signals', pose: 'coffee', title: 'Body signals lately', sub: 'New or persistent in the last few months.', type: 'multi', key: 'signals', options: [['hair', 'New facial or body hair'], ['discharge', 'Nipple discharge (not breastfeeding)'], ['weight', 'Big weight change'], ['restrict', 'Restrictive eating or intense training'], ['bloating', 'Persistent bloating or feeling full quickly'], ['pelvic', 'New pelvic pain or needing to wee more often'], ['flushes', 'Hot flushes or night sweats'], ['none', 'None of these']], exclusive: ['none'] },
    { id: 'goals', pose: 'plants', title: 'What would you like from Ovumind?', sub: 'Pick as many as you like. The room will lean toward them.', type: 'multi', key: 'goals', options: [['understand', 'Understand my cycle'], ['conceive', 'Conceive'], ['symptoms', 'Ease cramps and PMS'], ['sleep', 'Sleep better'], ['peri', 'Perimenopause support'], ['calm', 'Build calm habits'], ['doctor', 'Clear records for my doctor']] },
    { id: 'habits', pose: 'stretch', title: 'Everyday habits (optional)', sub: 'No judgement. Smoking and sleep in particular shape ovarian health over the years.', type: 'rows', optional: true, rows: [{ key: 'smoking', label: 'Smoking', options: [['no', 'No'], ['sometimes', 'Sometimes'], ['daily', 'Daily']] }, { key: 'alcohol', label: 'Alcohol', options: [['none', 'None'], ['weekly', 'Some weeks'], ['most', 'Most days']] }, { key: 'sleep', label: 'Usual sleep', options: [['lt6', 'Under 6 h'], ['6-7', '6–7 h'], ['7-8', '7–8 h'], ['8+', '8 h or more']] }, { key: 'exercise', label: 'Movement days a week', options: [['0', '0'], ['1-2', '1–2'], ['3-4', '3–4'], ['5+', '5+']] }] },
    { id: 'body', pose: 'shower', title: 'Height and weight (optional)', sub: 'Only if you want. Weight at either extreme can change ovulation, so it helps the notes.', type: 'body', optional: true },
    { id: 'final', pose: 'outfit', title: 'Lastly, what should I call you?', sub: 'A first name or a nickname, or leave it blank.', type: 'final' }
  ];
  var onb = null;
  function onbVisible(A) { return ONB.filter(function (s) { return !s.showIf || s.showIf(A); }); }
  function chipRow(key, options, val, multi) { return '<div class="chips" data-key="' + key + '"' + (multi ? ' data-multi="1"' : '') + '>' + options.map(function (o) { var v = o[0], lab = o[1], on = multi ? (val || []).indexOf(v) > -1 : val === v; return '<button type="button" class="chipbtn' + (on ? ' on' : '') + '" data-v="' + esc(v) + '">' + esc(lab) + '</button>'; }).join('') + '</div>'; }
  function openOnboarding(i, a) {
    if (!onb || a !== undefined) onb = { i: 0, a: a || {} };
    var steps = onbVisible(onb.a), A = onb.a;
    onb.i = Math.max(0, Math.min(steps.length - 1, i || 0));
    var st = steps[onb.i], last = onb.i === steps.length - 1, html = '';
    if (st.type === 'info') html = st.items.map(function (it) { return '<div class="stat"><span class="ms">' + it[0] + '</span><div><b>' + esc(it[1]) + '</b><span>' + esc(it[2]) + '</span></div></div>'; }).join('');
    if (st.type === 'chips') html = chipRow(st.key, st.options, A[st.key], false) + (st.note && st.note(A) ? '<div class="onb-note"><span class="ms">favorite</span>' + esc(st.note(A)) + '</div>' : '');
    if (st.type === 'multi') html = chipRow(st.key, st.options, A[st.key], true);
    if (st.type === 'date') html = '<div class="field"><input class="input" id="onbDate" type="date" max="' + S.today() + '" value="' + esc(A[st.key] || '') + '"></div>';
    if (st.type === 'rows') html = st.rows.filter(function (r) { return !r.showIf || r.showIf(A); }).map(function (r) { return '<div class="field"><span class="lbl">' + esc(r.label) + '</span>' + chipRow(r.key, r.options, A[r.key], false) + '</div>'; }).join('');
    if (st.type === 'body') html = '<div class="grid2"><div class="field"><label for="onbH">Height (cm)</label><input class="input" id="onbH" type="number" inputmode="numeric" min="120" max="220" value="' + (A.heightCm || '') + '"></div><div class="field"><label for="onbW">Weight (kg)</label><input class="input" id="onbW" type="number" inputmode="decimal" min="30" max="250" step="0.1" value="' + (A.weightKg || '') + '"></div></div>';
    if (st.type === 'final') html = '<div class="field"><input class="input" id="onbName" maxlength="24" placeholder="Your name" value="' + esc(A.name || S.profile().name || '') + '"></div>' +
      '<div class="stat"><span class="ms">lock</span><div><b>On this phone only</b><span>Entries live in this browser. The page loads fonts from Google; GitHub Pages serves the files with ordinary server logs; if Luna’s model reads a note, only that note goes through the Ovumind relay and comes straight back to you.</span></div></div>' +
      '<label class="agree"><input type="checkbox" id="onbAgree"' + (A.consent ? ' checked' : '') + '> I have read the <a href="privacy.html" target="_blank" rel="noopener">privacy notes</a> and <a href="terms.html" target="_blank" rel="noopener">terms</a>. Ovumind is not a medical device and does not replace care.</label>' +
      (A.ageBand === 'under13' ? '<div class="onb-note"><span class="ms">family_restroom</span>Under 13: a parent or guardian should tick this with you.</div>' : '');
    openSheet('onboarding', 'Getting to know you', 'Step ' + (onb.i + 1) + ' of ' + steps.length, 'favorite',
      '<div class="onb"><div class="onb-head"><img src="' + ART + 'avatar-act-' + st.pose + '.webp" alt=""><div><h3>' + esc(st.title) + '</h3><p>' + esc(st.sub) + '</p></div></div><div class="onb-dots">' + steps.map(function (_, k) { return '<i class="' + (k <= onb.i ? 'on' : '') + '"></i>'; }).join('') + '</div>' + html +
      '<div class="onb-nav">' + (onb.i ? '<button type="button" class="btn ghost" id="onbBack"><span class="ms">arrow_back</span>Back</button>' : '') + '<span class="sp"></span>' + (st.optional ? '<button type="button" class="btn ghost" id="onbSkip">Skip</button>' : '') + '<button type="button" class="btn primary" id="onbNext">' + (last ? '<span class="ms">favorite</span>Enter my room' : 'Next<span class="ms">arrow_forward</span>') + '</button></div><div class="msg" id="onbMsg"></div></div>');
    function collect() {
      if (st.type === 'date') { var d = $('#onbDate').value; A[st.key] = S.validDate(d) && d <= S.today() ? d : ''; }
      if (st.type === 'body') { A.heightCm = Number($('#onbH').value) || null; A.weightKg = Number($('#onbW').value) || null; }
      if (st.type === 'final') { A.name = $('#onbName').value.trim(); A.consent = $('#onbAgree').checked; }
    }
    body.addEventListener('click', function (e) {
      var c = e.target.closest('.chipbtn[data-v]');
      if (c) {
        var row = c.parentNode, key = row.dataset.key, v = c.dataset.v;
        if (row.dataset.multi) { var cur = (A[key] || []).slice(), excl = st.exclusive || []; if (cur.indexOf(v) > -1) cur = cur.filter(function (x) { return x !== v; }); else if (excl.indexOf(v) > -1) cur = [v]; else cur = cur.filter(function (x) { return excl.indexOf(x) < 0; }).concat([v]); A[key] = cur; $$('.chipbtn', row).forEach(function (b) { b.classList.toggle('on', cur.indexOf(b.dataset.v) > -1); }); }
        else { A[key] = v; $$('.chipbtn', row).forEach(function (b) { b.classList.toggle('on', b === c); }); if (st.type === 'rows' && st.rows.some(function (r) { return r.showIf; }) || st.note) openOnboarding(onb.i); }
        chime('tap'); return;
      }
      if (e.target.closest('#onbBack')) { collect(); openOnboarding(onb.i - 1); return; }
      if (e.target.closest('#onbSkip')) { if (st.key) delete A[st.key]; if (st.rows) st.rows.forEach(function (r) { delete A[r.key]; }); if (st.type === 'body') { delete A.heightCm; delete A.weightKg; } openOnboarding(onb.i + 1); return; }
      if (e.target.closest('#onbNext')) {
        collect();
        if (st.type === 'final' && !A.consent) { message($('#onbMsg'), 'Please tick the box to continue.', false); return; }
        if (st.id === 'urgent' && (A.urgent || []).some(function (x) { return x !== 'none'; })) { openUrgentCard(function () { openOnboarding(onb.i + 1); }); return; }
        if (last) finishOnboarding(A); else openOnboarding(onb.i + 1);
      }
    });
  }
  function openUrgentCard(next) {
    openSheet('urgent', 'Please get care today', 'This is not something to track; it needs a clinician now', 'emergency_home',
      '<div class="flag high"><span class="ms">emergency_home</span><div><b>Sudden severe pelvic pain, fainting with bleeding, shoulder-tip pain or bleeding you cannot control</b><span>In Singapore call 995 or go to the nearest A&E; KK Women’s and Children’s Hospital runs a 24-hour O&G emergency service. If you could be pregnant, say so when you arrive.</span></div></div>' +
      '<p class="help">Ovumind cannot assess this. Your answers are kept as a note for your records, not sent anywhere.</p>' +
      '<div class="row"><a class="btn primary" href="tel:995"><span class="ms">call</span>Call 995</a><button type="button" class="btn ghost" id="urgentNext">Continue</button></div>');
    $('#urgentNext').addEventListener('click', next);
  }
  function predictionModeFor(A) {
    var h = A.hormones || [], c = A.conditions || [];
    if (A.pregState === 'pregnant' || A.pregState === 'maybe' || A.periodsStarted === 'no' || A.regularity === 'none12' || c.indexOf('hysterectomy') > -1) return 'suspended';
    if (A.regularity === 'rare' || A.regularity === 'irregular' || A.pregState === 'postpartum' || A.pregState === 'loss' || A.ageBand === '13-17' || A.cycleLength === 'varies' || h.some(function (x) { return ['pill', 'pop', 'iud_h', 'implant', 'hrt', 'fertility', 'ec'].indexOf(x) > -1; }) || (A.signals || []).indexOf('flushes') > -1) return 'wide';
    return 'normal';
  }
  function intakeNotes(A) {
    var n = [], bs = A.bleedSigns || [], sg = A.signals || [], fam = A.family || [], ur = A.urgent || [];
    if (bs.indexOf('flooding') > -1) n.push({ level: 'watch', title: 'Heavy bleeding signs', detail: 'You reported soaking through protection every 1 to 2 hours or flooding. The NHS lists this among the signs of heavy periods worth discussing.' });
    if (bs.indexOf('between') > -1) n.push({ level: 'watch', title: 'Bleeding between periods or after sex', detail: 'Worth a clinician’s review, especially if new or recurring.' });
    if (bs.indexOf('postmeno') > -1) n.push({ level: 'high', title: 'Bleeding after 12 months without periods', detail: 'Postmenopausal bleeding should always be assessed by a clinician.' });
    if (bs.indexOf('painlife') > -1) n.push({ level: 'watch', title: 'Period pain that disrupts your days', detail: 'Pain that stops school, work or sleep deserves assessment rather than endurance.' });
    if (A.periodsStarted === 'no' && A.ageBand && A.ageBand !== 'under13') n.push({ level: 'watch', title: 'Periods not yet started', detail: 'Guidance suggests an assessment if periods have not started by 15.' });
    if (A.regularity === 'rare') n.push({ level: 'watch', title: 'Long gaps between periods', detail: 'Gaps of three months or more are worth discussing with a clinician.' });
    if (A.plans === 'ttc' && (A.ttcMonths === '12+' || (A.ttcMonths === '6-11' && ['35-39', '40-44', '45-49', '50+'].indexOf(A.ageBand) > -1))) n.push({ level: 'watch', title: 'Time to consider a fertility check', detail: 'ASRM suggests an evaluation after 12 months of trying under 35, or 6 months at 35 and over.' });
    if (sg.indexOf('bloating') > -1 || sg.indexOf('pelvic') > -1) n.push({ level: 'watch', title: 'New persistent bloating, fullness, pelvic pain or urinary frequency', detail: 'The NHS advises a GP review when these are new, frequent and persistent.' });
    if (sg.indexOf('hair') > -1 || sg.indexOf('discharge') > -1) n.push({ level: 'watch', title: 'New body signals', detail: 'New facial or body hair, or nipple discharge outside breastfeeding, are worth a review.' });
    if (fam.indexOf('meno40') > -1) n.push({ level: 'watch', title: 'Family history of menopause before 40', detail: 'Worth mentioning when you discuss fertility or ovarian health.' });
    if (fam.indexOf('brca') > -1 || fam.indexOf('cancer') > -1) n.push({ level: 'watch', title: 'Family history of ovarian or breast cancer', detail: 'A clinician can advise whether genetic counselling is relevant.' });
    if (ur.some(function (x) { return x !== 'none'; })) n.push({ level: 'high', title: 'Urgent symptoms reported at set-up', detail: 'You were shown urgent-care guidance. Please follow it today.' });
    return n;
  }
  function finishOnboarding(A) {
    var num = function (v) { var x = Number(v); return isFinite(x) && x > 0 ? x : null; };
    var patch = { name: A.name || S.profile().name || '', ageBand: A.ageBand || '', periodsStarted: A.periodsStarted || '', menarche: A.menarche || '', regularity: A.regularity || '', pregState: A.pregState || '', breastfeeding: A.breastfeeding || '', periodsBack: A.periodsBack || '', plans: A.plans || '', ttcMonths: A.ttcMonths || '', fertilityTx: A.fertilityTx || '', hormones: A.hormones || [], lastPeriodStart: A.lastPeriodStart || '', cycleLength: num(A.cycleLength), periodLength: num(A.periodLength), cycleVaries: A.cycleLength === 'varies' || A.cycleLength === 'rare', bleedSigns: A.bleedSigns || [], urgent: A.urgent || [], conditions: A.conditions || [], family: A.family || [], signals: A.signals || [], goals: A.goals || [], habits: { smoking: A.smoking || '', alcohol: A.alcohol || '', sleep: A.sleep || '', exercise: A.exercise || '' }, heightCm: A.heightCm || null, weightKg: A.weightKg || null, predictionMode: predictionModeFor(A), intakeNotes: intakeNotes(A), lifeStage: A.regularity === 'none12' ? 'post' : (A.pregState === 'pregnant' ? 'pregnant' : (A.plans === 'ttc' ? 'ttc' : (A.ageBand && ['40-44', '45-49', '50+'].indexOf(A.ageBand) > -1 && (A.signals || []).indexOf('flushes') > -1 ? 'peri' : ''))), consent: { terms: true, at: new Date().toISOString() }, onboarded: true, onboardedAt: new Date().toISOString() };
    S.setProfile(patch);
    if (patch.lastPeriodStart && !S.list('period').length) { try { S.add('period', patch.lastPeriodStart, { flow: 'medium', clots: false, impact: false }, 'onboarding'); } catch (e) { } }
    try { localStorage.setItem('ovuluna_onboarding', JSON.stringify(Object.assign({ completed: true, completedAt: patch.onboardedAt, source: 'room' }, patch))); } catch (e) { }
    RW.grant(20, 'welcome');
    onb = null; closeSheet(); updateGreeting(); renderDeck(); renderProps();
    toast('Welcome home' + (patch.name ? ', ' + patch.name : '') + '. 20 hearts to start your nest.', 'favorite');
  }
  function showWelcome() {
    var w = $('#welcome'); if (!w) return; w.hidden = false;
    $('#wBegin').addEventListener('click', function () { chime('tap'); w.hidden = true; S.setState({ welcomeSeen: true }); openOnboarding(0, {}); });
    $('#wSkip').addEventListener('click', function () { chime('tap'); w.hidden = true; S.setState({ welcomeSeen: true }); toast('Welcome back. Your intro is under the window whenever you want it.', 'favorite'); });
  }

  /* ---------- window: tonight ---------- */
  function openWindow() {
    var cs = S.cycleStats(), st = S.sleepStats(7), d = new Date();
    openSheet('window', 'Tonight', d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), 'dark_mode',
      '<div class="stat"><span class="ms">bedtime</span><div><b>' + (st.avg ? 'Averaging ' + st.avg + ' h over ' + st.count + ' nights' : 'No sleep logged this week') + '</b><span>Adults generally do best with 7 hours or more.</span></div></div>' +
      '<div class="stat"><span class="ms">water_drop</span><div><b>' + (cs.cycleDay ? 'Cycle day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') : 'Cycle not started') + '</b><span>' + (cs.predictedNext ? 'Next period expected around ' + prettyDate(cs.predictedNext) + (cs.uncertain ? ' (a loose estimate while cycles are changing).' : '.') : (cs.mode === 'suspended' ? 'Predictions are paused for your situation; your entries still count.' : 'Log a period on the wall calendar to start predictions.')) + '</span></div></div>' +
      '<div class="row"><button class="btn primary" id="winSleep"><span class="ms">bedtime</span>' + (S.state().sleeping ? 'Wake up' : 'Go to sleep') + '</button><button class="btn soft" id="winSound"><span class="ms">' + (S.state().sound ? 'volume_up' : 'volume_off') + '</span>Sounds ' + (S.state().sound ? 'on' : 'off') + '</button></div>' +
      '<div class="row"><a class="btn ghost" href="settings.html"><span class="ms">settings</span>Settings & health connections</a><a class="btn ghost" href="face-ppg.html"><span class="ms">monitor_heart</span>Calm check (beta)</a></div>' +
      '<div class="row"><button type="button" class="btn ghost" id="winIntro"><span class="ms">favorite</span>' + (S.profile().onboarded ? 'Update my intro' : 'Tell me about you') + '</button></div>' +
      '<p class="help">Sounds are tiny chimes plus Erin’s good-night and good-morning lines; they stay off unless you turn them on. Guided sessions always play when you start one.</p>');
    $('#winSleep').addEventListener('click', function () { closeSheet(); tap(hotspot('bed')); });
    $('#winSound').addEventListener('click', function () { S.setState({ sound: !S.state().sound }); chime('tap'); openWindow(); });
    $('#winIntro').addEventListener('click', function () { openOnboarding(0, {}); });
  }

  /* ---------- avatar bubble ---------- */
  var bubble = $('#bubble');
  function hideBubble() { bubble.classList.remove('on'); }
  avatar.addEventListener('click', function (e) {
    e.stopPropagation(); chime('tap'); joy(); hideThought();
    var r = avatar.getBoundingClientRect(), sr = scene.getBoundingClientRect();
    bubble.style.left = Math.min(sr.width - 95, Math.max(95, r.left - sr.left + r.width / 2)) + 'px'; bubble.style.top = (r.top - sr.top - 6) + 'px';
    bubble.innerHTML = '<button data-act="wardrobe"><span class="ms">checkroom</span>Change outfit</button><button data-act="sleep"><span class="ms">bedtime</span>' + (S.state().sleeping ? 'Wake up' : 'Go to sleep') + '</button><button data-act="mat"><span class="ms">self_improvement</span>Sit with Erin</button><button data-act="acu"><span class="ms">spa</span>Cramp relief points</button><button data-act="luna"><span class="ms">dark_mode</span>Tell Luna</button><button data-act="journal"><span class="ms">auto_stories</span>Open my journal</button><button data-act="everyday"><span class="ms">home</span>Everyday practice</button>' + (S.profile().onboarded ? '' : '<button data-act="intro"><span class="ms">favorite</span>Tell me about you</button>') + '';
    bubble.classList.add('on');
  });
  bubble.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; hideBubble(); var id = { wardrobe: 'wardrobe', sleep: 'bed', mat: 'mat' }[b.dataset.act]; if (id) tap(hotspot(id)); if (b.dataset.act === 'journal') location.href = 'journal.html'; if (b.dataset.act === 'acu') openAcupressure(); if (b.dataset.act === 'luna') openLuna(); if (b.dataset.act === 'everyday') openEveryday(); if (b.dataset.act === 'intro') openOnboarding(0, {}); });
  document.addEventListener('click', function (e) { if (!e.target.closest('#bubble') && !e.target.closest('#avatar')) hideBubble(); });

  /* ---------- after save: agents + hearts ---------- */
  function afterSave(ev, text) {
    var res = A.analyze(ev), rw = RW.award(ev);
    var hi = res.flags.filter(function (f) { return f.level === 'high'; })[0], w = res.flags.filter(function (f) { return f.level === 'watch'; })[0];
    var heartsText = rw.points ? ' +' + (rw.points + rw.bonus) + ' ♥' : '';
    if (hi) toast(hi.title + '. Please see the note in your journal.', 'emergency_home');
    else if (w) toast('Saved. Pattern note added: ' + w.title + '.' + heartsText, 'flag');
    else toast((text || 'Saved to your journal.') + heartsText, 'check_circle');
    var chip = $('#heartsChip'); chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
    renderProps(); renderDeck();
  }

  /* ---------- deck below the scene ---------- */
  function renderDeck() {
    var cs = S.cycleStats(), today = S.today();
    var lastNight = S.list('sleep', { from: today, to: today })[0] || S.list('sleep').slice(-1)[0];
    var foodToday = S.list('food', { from: today, to: today }), meals = foodToday.length;
    var items = []; foodToday.forEach(function (f) { items = items.concat(f.data.items || []); });
    var sm = items.length ? FD.sum(items) : null;
    var sym = S.list('symptom', { from: today, to: today })[0];
    $('#tiles').innerHTML =
      '<button class="tile" data-go="calendar"><span class="ms">water_drop</span><b>' + (cs.cycleDay ? 'Day ' + cs.cycleDay : '—') + '</b><small>' + (cs.phase ? cap(cs.phase) : 'Log a period') + '</small></button>' +
      '<button class="tile" data-go="clock"><span class="ms">bedtime</span><b>' + (lastNight ? A.fmtHours(S.sleepHours(lastNight.data)) : '—') + '</b><small>' + (lastNight ? (lastNight.date === today ? 'Last night' : prettyDate(lastNight.date)) : 'No sleep yet') + '</small></button>' +
      '<button class="tile" data-go="diary"><span class="ms">restaurant</span><b>' + (sm && sm.totals.kcal !== null ? Math.round(sm.totals.kcal) : meals) + '</b><small>' + (sm && sm.totals.kcal !== null ? 'kcal · ' + FD.fmt('protein', sm.totals.protein) + ' g protein' : (meals === 1 ? 'meal today' : 'meals today')) + '</small></button>';
    var flags = A.allFlags().concat((S.profile().intakeNotes || []).map(function (n) { return { level: n.level || 'watch', title: n.title, detail: n.detail }; }));
    $('#flagCard').style.display = flags.length ? '' : 'none';
    $('#flags').innerHTML = flags.slice(0, 3).map(function (f) { return '<div class="flag ' + f.level + '"><span class="ms">' + (f.level === 'high' ? 'emergency_home' : f.level === 'watch' ? 'flag' : 'info') + '</span><div><b>' + esc(f.title) + '</b><span>' + esc(f.detail) + '</span></div></div>'; }).join('');
    $('#journalBtn').classList.toggle('has-flag', flags.some(function (f) { return f.level !== 'info'; }));
    var daily = A.dailySummary(today);
    $('#dailyText').textContent = daily.text;
    $('#symLine').textContent = sym ? ((sym.data.symptoms || []).length ? 'Today: ' + sym.data.symptoms.join(', ') + (sym.data.mood ? ' · mood ' + sym.data.mood : '') : 'No symptoms ticked today') : 'No symptoms logged today. Tap the calendar to add or backdate.';
    var sum = S.load().summaries || [];
    $('#shareSub').textContent = sum.length ? 'Last summary saved ' + prettyDate(sum[sum.length - 1].range.to) : 'Create a 4-week summary for your clinician';
  }
  $('#tiles').addEventListener('click', function (e) { var t = e.target.closest('[data-go]'); if (!t) return; tap(hotspot(t.dataset.go)); });

  /* ---------- greeting ---------- */
  function updateGreeting() {
    var h = new Date().getHours(), p = S.profile(), name = p.name ? ', ' + p.name : '';
    var g = S.state().sleeping ? 'Sleep well' : h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('#greetTitle').textContent = g + name;
    $('#greetSub').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    var cs = S.cycleStats(); var chip = $('#phaseChip');
    chip.innerHTML = '<span class="ms">water_drop</span>' + (cs.cycleDay ? 'Day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') : 'Start your cycle');
  }
  $('#phaseChip').addEventListener('click', function () { tap(hotspot('calendar')); });

  /* ---------- boot ---------- */
  function boot() {
    buildScene();
    setOutfit(S.profile().outfit || 'base', true);
    avatar.classList.add('idle');
    if (S.state().sleeping) enterNight(false);
    updateGreeting(); renderDeck(); renderProps();
    FD.load().catch(function () { });
    S.subscribe(function (reason) { if (reason === 'external') { renderDeck(); renderProps(); updateGreeting(); } });
    $('#journalBtn').href = 'journal.html'; $('#shareBtn').href = 'journal.html#share';
    if (!S.state().tourDone) { setTimeout(function () { $('#hint').classList.add('on'); }, 1200); setTimeout(function () { $('#hint').classList.remove('on'); S.setState({ tourDone: true }); }, 7000); }
    if (!S.state().lunaSeen) { setTimeout(function () { $('#lunaBtn').classList.add('hinting'); }, 2500); setTimeout(function () { $('#lunaBtn').classList.remove('hinting'); S.setState({ lunaSeen: true }); }, 9000); }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () { });
    RM.start(function (h) { chime('bell', true); toast(h.item.label + (h.item.note ? ' · ' + h.item.note : ''), h.item.icon); });
    document.addEventListener('click', function (e) { if (e.target.closest('#visitBack')) { chime('tap'); applyLayout(currentHomeId(), false); toast('Back home.', 'home'); } if (e.target.closest('#arrDone')) exitArrange(false); if (e.target.closest('#arrReset')) exitArrange(true); });
    if (location.hash === '#luna') setTimeout(function () { openLuna(); }, 600);
    if (location.hash === '#onboarding') setTimeout(function () { openOnboarding(0, {}); }, 400);
    else if (!S.profile().onboarded && !S.state().welcomeSeen) showWelcome();
    setTimeout(function () { $('#loading').classList.add('hidden'); joy(); }, 500);
    scheduleLife();
    function tick() { var d = new Date(); $('#clockTime').textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); var dc = $('#deskClock'); if (dc) dc.textContent = nowHM(); } tick(); setInterval(tick, 20000);
  }
  var dayImg = $('#roomDay');
  if (dayImg.complete) boot(); else { dayImg.addEventListener('load', boot); dayImg.addEventListener('error', boot); }
})();
