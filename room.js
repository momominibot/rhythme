/* Rhythme dream room — interaction engine.
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
      winPatch: { x: 14.470, y: 11.522, w: 44.701, base: 'room-v3-sky2-room-' },
      props: { cat: { x: 50, y: 88, w: 9 }, dog: { x: 12, y: 74, w: 9.5 }, plant: { x: 78, y: 77, w: 9 }, bookshelf: { x: 87, y: 66, w: 10 }, lamp: { x: 84, y: 76, w: 7 }, mushlamp: { x: 84, y: 76, w: 7.5 }, starlamp: { x: 84, y: 76, w: 6.2 }, beanbag: { x: 54.5, y: 69.5, w: 10 }, armchair: { x: 54.5, y: 70, w: 11 }, scale: { x: 40, y: 73.5, w: 7 }, mewmew: { x: 62, y: 88, w: 12 } }
    },
    house: {
      id: 'house', name: 'Your dream house', img: 'house-v1.webp', w: 1024, h: 1280, avatarW: 8, cam: { z: 1.5 }, /* drawn at a smaller scale: zoomed 1.5x she is her usual size (Jamie, 19 Oct); fit shows the whole house */
      winPatches: [{ x: 27.539, y: 10.859, w: 42.480, base: 'house-v1-sky2-house-' }],
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
      props: { cat: { x: 27, y: 80, w: 7 }, dog: { x: 53, y: 51, w: 7 }, plant: { x: 76, y: 80, w: 7 }, bookshelf: { x: 76, y: 80, w: 7 }, lamp: { x: 76, y: 50, w: 5.5 }, mushlamp: { x: 76, y: 50, w: 5.8 }, starlamp: { x: 76, y: 50, w: 4.8 }, beanbag: { x: 18, y: 82, w: 7.5 }, armchair: { x: 18, y: 82, w: 8 }, scale: { x: 64, y: 51, w: 5.5 }, mewmew: { x: 62, y: 86, w: 8.5 } }
    },
    /* rendered 18 Oct 2026 (Seedream 5.0 pro, seed 7201): bedroom and bubble bath upstairs, sofa, study and wardrobe below */
    bathhouse: {
      id: 'bathhouse', name: 'Your bath house', img: 'house-bath-v1.webp', w: 1024, h: 1280, avatarW: 8, cam: { z: 1.5 }, /* drawn at a smaller scale: zoomed 1.5x she is her usual size (Jamie, 19 Oct); fit shows the whole house */
      winPatches: [{ x: 26.465, y: 13.438, w: 36.230, base: 'house-bath-v1-sky2-bathhouse-' }],
      stairs: [{ x: 42, y: 75 }, { x: 52, y: 51 }], upstairsY: 55,
      hotspots: [
        { id: 'bed', x: 37, y: 42, label: 'Bed · go to sleep', icon: 'bedtime', wp: { x: 44, y: 50, flip: true } },
        { id: 'clock', x: 18, y: 41, label: 'Clock · reminders', icon: 'alarm', wp: { x: 25, y: 50, flip: true } },
        { id: 'calendar', x: 33, y: 33, label: 'Calendar · cycle & symptoms', icon: 'calendar_month', wp: { x: 34, y: 50, flip: true } },
        { id: 'bath', x: 66, y: 44, label: 'Bathtub · a mindful soak', icon: 'bathtub', wp: { x: 60, y: 50, flip: false } },
        { id: 'window', x: 52.5, y: 30.5, label: 'Window · tonight', icon: 'dark_mode', wp: null },
        { id: 'sofa', x: 27, y: 71, label: 'Sofa · tell Luna about today', icon: 'chair', wp: { x: 32, y: 79, flip: true } },
        { id: 'diary', x: 40, y: 71, label: 'Diary · food journal', icon: 'menu_book', wp: { x: 40, y: 80, flip: true } },
        { id: 'computer', x: 62, y: 66, label: 'Computer · learn', icon: 'computer', wp: { x: 60, y: 80, flip: false } },
        { id: 'wardrobe', x: 73, y: 69, label: 'Wardrobe · outfits', icon: 'checkroom', wp: { x: 68, y: 80, flip: false } },
        { id: 'mat', x: 29, y: 82, label: 'Yoga mat · mindfulness with Erin', icon: 'self_improvement', wp: { x: 42, y: 82, flip: true } },
        { id: 'coach', x: 13, y: 58, label: 'M · everyday mindfulness', icon: 'self_improvement', badge: 'M', wp: { x: 24, y: 81, flip: true } }
      ],
      home: { x: 50, y: 82, flip: false },
      sleeper: { x: 38, y: 43, w: 18, rot: 12 }, zzz: { x: 40, y: 31 },
      meditator: { x: 33, y: 80, w: 8 }, aura: { x: 33, y: 78, w: 13 }, holo: { x: 45, y: 78, w: 10 },
      window: { x: 52.5, y: 30.5, rx: 7, ry: 5.6 },
      props: { cat: { x: 41, y: 86, w: 6.5 }, dog: { x: 54, y: 51, w: 6.5 }, plant: { x: 86, y: 80, w: 6.5 }, bookshelf: { x: 86, y: 80, w: 6.5 }, lamp: { x: 81, y: 51, w: 5 }, mushlamp: { x: 81, y: 51, w: 5.3 }, starlamp: { x: 81, y: 51, w: 4.4 }, beanbag: { x: 20, y: 82, w: 7 }, armchair: { x: 20, y: 82, w: 7.5 }, scale: { x: 74, y: 51, w: 5.5 }, mewmew: { x: 60, y: 85, w: 7.5 } }
    },
    /* rendered 18 Oct 2026 (seed 7202): kitchen and comfy living room below, bedroom, wardrobe and bubble bath upstairs */
    familyhome: {
      id: 'familyhome', name: 'Your family home', img: 'house-family-v1.webp', w: 896, h: 1120, avatarW: 8, cam: { z: 1.5 }, /* drawn at a smaller scale: zoomed 1.5x she is her usual size (Jamie, 19 Oct); fit shows the whole house */
      winPatches: [{ x: 15.513, y: 14.107, w: 35.491, base: 'house-family-v1-sky2-familyhome-' }, { x: 61.496, y: 50.000, w: 32.478, base: 'house-family-v1-sky2-familyhome2-' }],
      stairs: [{ x: 45, y: 78 }, { x: 58, y: 52 }], upstairsY: 55,
      hotspots: [
        { id: 'bed', x: 35, y: 44, label: 'Bed · go to sleep', icon: 'bedtime', wp: { x: 40, y: 51, flip: true } },
        { id: 'clock', x: 16, y: 44, label: 'Clock · reminders', icon: 'alarm', wp: { x: 22, y: 51, flip: true } },
        { id: 'calendar', x: 14, y: 36, label: 'Calendar · cycle & symptoms', icon: 'calendar_month', wp: { x: 20, y: 51, flip: true } },
        { id: 'wardrobe', x: 56, y: 39, label: 'Wardrobe · outfits', icon: 'checkroom', wp: { x: 55, y: 51, flip: false } },
        { id: 'bath', x: 80, y: 45, label: 'Bathtub · a mindful soak', icon: 'bathtub', wp: { x: 72, y: 51, flip: false } },
        { id: 'window', x: 40, y: 30, label: 'Window · tonight', icon: 'dark_mode', wp: null },
        { id: 'diary', x: 33, y: 75, label: 'Kitchen · food diary', icon: 'menu_book', wp: { x: 34, y: 84, flip: true } },
        { id: 'fridge', x: 16, y: 72, label: 'Fridge · food ideas, teas and herbs', icon: 'kitchen', wp: { x: 22, y: 85, flip: true } },
        { id: 'coach', x: 22, y: 62, label: 'M · everyday mindfulness', icon: 'self_improvement', badge: 'M', wp: { x: 28, y: 85, flip: true } },
        { id: 'computer', x: 66, y: 64, label: 'Computer · learn', icon: 'computer', wp: { x: 62, y: 82, flip: false } },
        { id: 'sofa', x: 78, y: 71, label: 'Sofa · tell Luna about today', icon: 'chair', wp: { x: 72, y: 85, flip: false } },
        { id: 'mat', x: 61, y: 82, label: 'Yoga mat · mindfulness with Erin', icon: 'self_improvement', wp: { x: 50, y: 86, flip: false } }
      ],
      home: { x: 48, y: 88, flip: false },
      sleeper: { x: 35, y: 45, w: 19, rot: 14 }, zzz: { x: 37, y: 33 },
      meditator: { x: 58, y: 83, w: 8 }, aura: { x: 58, y: 81, w: 13 }, holo: { x: 70, y: 80, w: 10 },
      window: { x: 40, y: 30, rx: 9, ry: 7 },
      props: { cat: { x: 35, y: 88, w: 6.5 }, dog: { x: 46, y: 52, w: 6.5 }, plant: { x: 88, y: 86, w: 6 }, bookshelf: { x: 88, y: 86, w: 6.5 }, lamp: { x: 63, y: 51, w: 4.6 }, mushlamp: { x: 63, y: 51, w: 5 }, starlamp: { x: 63, y: 51, w: 4.2 }, beanbag: { x: 15, y: 87, w: 7 }, armchair: { x: 15, y: 87, w: 7.5 }, scale: { x: 70, y: 52, w: 5.5 }, mewmew: { x: 76, y: 88, w: 7.5 } }
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
    { id: 'cycle', name: 'Cycle basics', color: '#f6c9d6', items: [['page', 'room.html#cycle', 'bloodtype', 'Your cycle', 'Phases, length and what is typical'], ['page', 'hormones.html', 'show_chart', 'Hormones 101', 'What rises and falls each cycle'], ['video', 'normal', 'A normal cycle', 'What typical looks like'], ['video', 'hormones', 'Hormones', 'Oestrogen & progesterone'], ['page', 'period-start.html', 'water_drop', 'Period start', 'Logging the first day']] },
    { id: 'fertility', name: 'Fertility', color: '#bfe3d4', items: [['page', 'fertility.html', 'spa', 'Fertile window', 'Ovulation signs, explained'], ['video', 'fertile', 'Fertile window', 'Your most fertile days'], ['page', 'journey-grow.html', 'eco', 'Trying to conceive', 'Timing, tests and support'], ['page', 'ovarian-health.html', 'menu_book', 'Understand your records', 'What your entries can and cannot show']] },
    { id: 'chapters', name: 'Life chapters', color: '#c9b6e6', items: [['page', 'life-journey.html', 'auto_stories', 'Your life journey', 'Five chapters, one body'], ['video', 'menarche', 'First period', 'Menarche explained'], ['page', 'journey-nurture.html', 'favorite', 'After pregnancy', 'Recovery and cycles returning'], ['page', 'journey-peri.html', 'dark_mode', 'Perimenopause', 'Hot flushes, sleep and mood'], ['video', 'peri', 'Perimenopause', 'The transition years'], ['page', 'journey-post.html', 'wb_sunny', 'After menopause', 'Bone, heart and bleeding rules'], ['video', 'menopause', 'Menopause', 'Life after periods']] },
    { id: 'nutrition', name: 'Nutrition', color: '#f3d49b', items: [['page', 'foods.html', 'restaurant', 'Foods by phase', 'TCM and Western notes'], ['page', 'nutrients.html', 'medication', 'Micronutrients', 'Iron, folate, magnesium'], ['page', 'medas14.html', 'nutrition', 'Mediterranean score', 'A 14-point check'], ['page', 'hydration.html', 'water_full', 'Hydration', 'Fluids through the cycle'], ['action', 'diary', 'menu_book', 'Open the food diary', 'Snap, scan or search']] },
    { id: 'mind', name: 'Mind & mood', color: '#b8cde0', items: [['page', 'room.html#mind', 'self_improvement', 'Mindfulness hub', 'Erin Lee’s pauses and podcasts'], ['link', 'https://erinmindfulmoments.substack.com/p/the-quiet-work-of-change', 'article', 'The Quiet Work of Change', 'An essay by Erin'], ['page', 'mental-health.html', 'psychology', 'Mood & calm', 'When to reach for support'], ['page', 'breathe.html', 'air', 'Breathing', 'Guided breath'], ['action', 'mat', 'self_improvement', 'Sit on the mat', 'A session with Erin']] },
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
  var ACU_PREG = 'Pregnant or might be? Check with your maternity team before using this point. Traditional caution is not proof that touching it causes harm.';
  var ACU_PREG_BELLY = 'Pregnant or might be? Check with your maternity team first, and avoid firm pressure on the belly. Traditional caution is not proof that touching it causes harm.';
  var ACU_CAUTION = { sp6: ACU_PREG, li4: ACU_PREG, cv3: ACU_PREG_BELLY, cv4: ACU_PREG_BELLY, cv6: ACU_PREG_BELLY, st29: ACU_PREG_BELLY };

  /* ---------- evidence guides behind every (i) ---------- */
  function padSVG(level) {
    var fills = { spotting: 0.08, light: 0.25, medium: 0.55, heavy: 0.95 }[level] || 0;
    var w = Math.round(44 * fills), clots = level === 'heavy' ? '<circle cx="26" cy="24" r="3.4" fill="#7a1f3a"/><circle cx="36" cy="30" r="2.6" fill="#7a1f3a"/>' : '';
    var dots = level === 'spotting' ? '<circle cx="30" cy="26" r="1.8" fill="#c1517a"/><circle cx="37" cy="31" r="1.3" fill="#c1517a"/>' : '';
    return '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="6" y="10" width="52" height="28" rx="14" fill="#fff" stroke="#e5d7f0" stroke-width="2"/>' +
      (fills > 0.1 ? '<rect x="' + (32 - w / 2) + '" y="14" width="' + w + '" height="20" rx="10" fill="' + (level === 'heavy' ? '#b43f68' : level === 'medium' ? '#dd6f94' : '#f3b9cb') + '"/>' : '') + dots + clots + '</svg>';
  }
  var GUIDES = {
    nova: {
      icon: 'factory', title: 'How processed is it? (NOVA)',
      body: '<p>Foods are grouped by the nature, extent and purpose of the industrial processing they have been through, using the NOVA system: <b>1 whole or minimally processed</b> (fruit, vegetables, eggs, plain rice, fresh meat and fish, plain milk), <b>2 kitchen staples</b> (oil, butter, sugar, salt), <b>3 processed</b> (cheese, canned fish, bakery bread) and <b>4 ultra-processed</b> (soft drinks, instant noodles, sausages, luncheon meat, fishballs, biscuits, chocolate bars, malt drink powders).</p><p>Packaged foods use the NOVA group published by Open Food Facts. Generic foods, hawker items and photo estimates have no published group, so Rhythme estimates one from the food type and says so; <b>likely</b> means the name alone cannot settle it (sliced bread, otah, bubble tea). NOVA studies split home and hawker dishes into their ingredients using recipes. Rhythme has no recipes yet, so freshly made dishes and drinks such as bak chor mee or kopi are not scored. They are shown in their own colour and flagged when they include parts such as fishballs, luncheon meat or coloured syrups.</p><p>The headline is the share of calories from ultra-processed foods among the foods Rhythme could classify, shown with how much of your log that covers. When less than half is classified, it gives no percentage. Large studies link diets high in ultra-processed foods with poorer health, but they show association, not cause, and one meal says little. Use it as a gentle pattern guide, not a verdict on a meal or on you. Tap <b>Words only</b> to hide the numbers.</p>'
    },
    bleeding: {
      icon: 'water_drop', title: 'What light, medium and heavy mean',
      body: '<div class="flows">' +
        '<div class="flow">' + padSVG('spotting') + '<b>Spotting</b><small>A few drops; a liner is enough</small></div>' +
        '<div class="flow">' + padSVG('light') + '<b>Light</b><small>A pad or tampon lasts most of the day</small></div>' +
        '<div class="flow">' + padSVG('medium') + '<b>Medium</b><small>Change about every 3 to 4 hours</small></div>' +
        '<div class="flow">' + padSVG('heavy') + '<b>Heavy</b><small>Change every 1 to 2 hours, clots over 2.5 cm, leaks</small></div></div>' +
        '<p>Heavy bleeding is defined by its effect on your life, not a number. Signs the NHS lists: changing protection every 1 to 2 hours, clots larger than about 2.5 cm (a 10p coin), bleeding through clothes or bedding, needing two products together, or periods longer than 7 days. Tick <b>Clots</b> and <b>Affected my day</b> on those days so the pattern is visible to your clinician.</p>'
    },
    pain: {
      icon: 'spa', title: 'The 0 to 10 pain scale',
      body: '<div class="scale"><div><b>0</b><small>No pain</small></div><div><b>1 to 3</b><small>Mild, easy to ignore</small></div><div><b>4 to 6</b><small>Moderate, hard to ignore</small></div><div><b>7 to 10</b><small>Severe, stops normal activity</small></div></div><p>Rate the worst pain of the day. Period pain that reaches 7 or more, needs time off, or does not respond to usual pain relief is worth a conversation; the app flags 8 or more.</p>'
    },
    sleep: {
      icon: 'bedtime', title: 'How the sleep notes work',
      body: '<p>Duration is bedtime to wake time, so it counts time in bed rather than measured sleep. Quality is your own 1 to 5 rating. The app notes weeks averaging under 6 hours and runs of three nights under 5 hours.</p>'
    },
    food: {
      icon: 'restaurant', title: 'Where the numbers come from',
      body: '<p>Nutrients are calculated as <b>value per 100 g × grams you confirm ÷ 100</b>. Generic foods use USDA FoodData Central (SR Legacy, per 100 g edible portion, with USDA household measures). Barcodes use Open Food Facts label transcriptions, kept per 100 g or 100 ml as published. Local dishes that Luna recognises in a photo use the Health Promotion Board’s Singapore Food Insights Database (SG FoodID, formerly FOCOS): HPB per-100 g values, converted to per 100 g as served, times the grams on your plate, or the HPB serving weight when the photo estimate is far from a normal serving. Dishes without an HPB match keep the model’s estimate and say so. Contains information from SG FoodID, Health Promotion Board, accessed 18 October 2026, made available under <a href="https://pphtpc.hpb.gov.sg/web/sgfoodid" target="_blank" rel="noopener">its terms</a>; the data is provided as is and HPB does not endorse this app. Missing values show as <b>?</b> and are left out of totals rather than counted as zero. Carbohydrate follows USDA “by difference” and already includes fibre. Phase picks come from the Rhythme food notes (TCM and Western), matched to USDA entries where one exists.</p><p>Photos are kept only as a reminder. In a 2026 NIH controlled test, photo-only apps under-counted meals by about a third, mostly hidden fats and portions, which is why you confirm the food and the amount here.</p>'
    },
    cycle: {
      icon: 'calendar_month', title: 'How predictions are made',
      body: '<p>The next period is estimated from the average of your last logged cycles (or your profile setting, or 28 days until there is history). The fertile window shown is a calendar estimate around 14 days before the expected period and is not a contraceptive method. Tapping a past day fills a typical period length so you can backdate quickly, then adjust any day.</p>'
    },
    acu: {
      icon: 'spa', title: 'What the research says about acupressure',
      body: '<p>Studies of acupressure for primary period pain are promising but limited: reviews describe low-quality evidence, mixed results for SP6 alone, and small trials that combine points. Gentle pressure is low risk for most people; it is not a treatment for pelvic pain that limits your life, which deserves clinical assessment.</p>'
    },
    reminders: {
      icon: 'alarm', title: 'Why these four nudges',
      body: '<p>Regular sleep and wake times, water through the day, short movement breaks and a couple of minutes of slow breathing are the everyday habits with the broadest support for sleep, energy and mood. The clock reminds you; it does not track whether you did it. Notifications depend on your phone: they fire while Rhythme is open or installed to the Home Screen, and the calendar file gives you alarms that always ring.</p>'
    },
    luna: {
      icon: 'dark_mode', title: 'How Luna reads your notes',
      body: '<p>Luna tries her own simple rules on this phone first: sleep times, period words, the symptom list, pain out of 10, mood, meals and minutes of practice. When they cannot read a note, and you have said yes, her AI help reads that note alone, never with your name. Food photos work the same way: she suggests the dishes and nutrients, using Singapore’s HPB data where she can, and you check and change everything before it is saved. Photo estimates are rough, especially for oil, sauces and portions. You can switch any of this off here or under Your choices in You.</p>'
    }
  };
  function infoBtn(topic) { return '<button type="button" class="ibtn" data-guide="' + topic + '" aria-label="Evidence and guidance">i</button>'; }
  function guideHTML(topic) { var g = GUIDES[topic]; if (!g) return ''; var ev = window.OvuEvidence ? OvuEvidence.forTopic(topic) : []; return '<div class="guide" data-guide-panel="' + topic + '"><h4><span class="ms">' + g.icon + '</span>' + esc(g.title) + '</h4>' + g.body + '<div class="ev">' + (ev.length ? '<b>Sources</b><p class="evrefs">' + ev.map(function (e) { return '<a href="evidence.html#' + e.id + '" target="_blank" rel="noopener">' + esc(e.short) + ' <i>' + e.id + '</i></a>'; }).join('') + '</p>' : '') + '<span>Guidance, not a diagnosis. Bring the pattern to a clinician you trust. Look up any number on the <a href="evidence.html" target="_blank" rel="noopener">Evidence page</a>.</span></div></div>'; }
  function wireGuides(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.ibtn'); if (!b) return;
      var panel = root.querySelector('.guide[data-guide-panel="' + b.dataset.guide + '"]');
      if (!panel) { /* a sheet that shows the (i) without its panel gets the panel right under the button's row (Jamie: every (i) must work) */
        var html = guideHTML(b.dataset.guide); if (!html) return;
        var host = b.closest('.field, .stat, .card, .row, .quick, section, div') || b.parentNode, wrap = document.createElement('div'); wrap.innerHTML = html; panel = wrap.firstChild;
        if (host && host.parentNode) host.parentNode.insertBefore(panel, host.nextSibling); else b.parentNode.appendChild(panel);
      }
      var on = !panel.classList.contains('on'); panel.classList.toggle('on', on); b.classList.toggle('on', on);
      if (on) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function prettyDate(iso, opts) { var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  /* "31 Oct to 3 Nov": the observed window of likely start days from cycleStats, never a single date. */
  function windowText(cs) {
    if (!cs || !cs.predictedFrom || !cs.predictedTo) return '';
    if (cs.predictedFrom === cs.predictedTo) return 'around ' + prettyDate(cs.predictedFrom);
    return 'between ' + prettyDate(cs.predictedFrom) + ' and ' + prettyDate(cs.predictedTo);
  }
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
      var hl = h.id === 'window' && window.OvuSun ? OvuSun.phase().windowLabel : h.label;
      b.className = 'hotspot'; b.type = 'button'; b.dataset.id = h.id; b.setAttribute('aria-label', hl);
      b.style.left = h.x + '%'; b.style.top = h.y + '%';
      if (h.badge) b.classList.add('m');
      b.innerHTML = '<span class="glow"></span>' + (h.badge ? '<span class="mbadge" aria-hidden="true">' + h.badge + '</span>' : '<span class="pulse" aria-hidden="true"></span>') + '<span class="tip" aria-hidden="true">' + esc(hl.split(' · ')[1] ? cap(hl.split(' · ')[1]) : hl) + '</span>';
      b.addEventListener('click', function () { tap(h); });
      hs.appendChild(b);
    });
  }
  function place(el, p) { if (!el || !p) return; el.style.left = p.x + '%'; el.style.top = p.y + '%'; if (p.w) el.style.width = p.w + '%'; }
  function houseItem(id) { return RW.SHOP.filter(function (s) { return s.id === (id || 'house'); })[0]; }
  function currentHomeId() { var h = S.state().home; return h && h !== 'room' && LAYOUTS[h] && RW.ledger().owned.indexOf(h) > -1 ? h : 'room'; }
  /* Switch the plate and every percent-positioned overlay to a layout; asVisit previews without moving in. */
  function applyLayout(id, asVisit) {
    if (typeof camFit === 'function' && inner) camFit(false);
    L = LAYOUTS[id] || LAYOUTS.room; HOTSPOTS = L.hotspots; HOME = L.home; visiting = asVisit ? L.id : null;
    scene.style.aspectRatio = L.w + '/' + (L.h * spanOf(L)); scene.style.setProperty('--span', spanOf(L)); scene.dataset.layout = L.id; /* a wide plate (L.span box widths) keeps the box's own view aspect */
    if (dayImg.getAttribute('src') !== ART + L.img) dayImg.src = ART + L.img;
    dayImg.width = L.w; dayImg.height = L.h;
    buildHotspots();
    avatar.style.width = L.avatarW + '%';
    if (L.sleeper) { place(sleeper, L.sleeper); sleeper.style.transform = 'translate(-50%,-50%) rotate(' + L.sleeper.rot + 'deg)'; }
    place($('.zzz'), L.zzz); place(meditator, L.meditator); place($('#aura'), L.aura); place(holo, L.holo);
    var mp = $('#matProp'); if (mp) { mp.style.display = L.mat ? '' : 'none'; if (L.mat) place(mp, L.mat); }
    /* window skies: model-repainted views composited inside each window's exact opening (tools/art/window_inpaint2.py);
     * a layout lists its windows in winPatches, and the images are rebuilt on every switch so none can linger */
    var wps = L.winPatches || (L.winPatch ? [L.winPatch] : []), wbox = $('#winPatches');
    if (wbox && wbox.dataset.layout !== L.id) {
      wbox.innerHTML = wps.map(function (wp) { return ['night', 'sunset', 'sunrise'].map(function (k) { return '<img class="win-patch ' + k + '" alt="" src="' + ART + wp.base + k + '.webp" style="left:' + wp.x + '%;top:' + wp.y + '%;width:' + wp.w + '%">'; }).join(''); }).join('');
      wbox.dataset.layout = L.id;
    }
    scene.classList.toggle('has-win-patch', wps.length > 0);
    var wn = $('#winNight'); if (wn && L.window) { wn.style.left = L.window.x + '%'; wn.style.top = L.window.y + '%'; wn.style.width = (L.window.rx * 2) + '%'; wn.style.height = (L.window.ry * 2) + '%'; }
    var vb = $('#visitBar'); if (vb) { vb.classList.toggle('on', !!visiting); vb.innerHTML = visiting && houseItem(L.id) ? '<span class="ms">cottage</span><span>Visiting ' + esc(houseItem(L.id).name.replace(/^./, function (c) { return c.toLowerCase(); })) + ' · <b>' + houseItem(L.id).cost + ' ♥ to move in</b></span><button type="button" id="visitBack"><span class="ms">arrow_back</span>Back</button>' : ''; }
    renderProps(); placeAvatar(HOME, false);
    emit('layout', L, !!asVisit); /* the scene modules (walk, garden, community) re-read floors, doors and props */
  }
  /* ---------- camera: zoom and pan any scene. Built for the room and houses now, and for a future
   * city map or a neighbour's home: each is just a layout, and the camera works on whichever is showing. */
  var cam = { z: 1, x: 0, y: 0 }, CAM_MAX = 3, camPointers = new Map(), camGesture = null, camSuppressClick = false;
  /* a wide plate (docs/design/2026-10-19-wide-street.md) is drawn span box widths wide inside the box-sized inner, with
   * coordinates in percent of the box, so x runs to 100 * span; the clamp keeps the whole plate covering the box */
  function spanOf(l) { return l && l.span > 1 ? l.span : 1; }
  function camClamp() { var W = scene.clientWidth, H = scene.clientHeight, sp = spanOf(L); cam.z = Math.max(1, Math.min(CAM_MAX, cam.z)); cam.x = Math.min(0, Math.max(W - W * sp * cam.z, cam.x)); cam.y = Math.min(0, Math.max(H - H * cam.z, cam.y)); }
  function camApply(anim) {
    camClamp(); inner.style.transformOrigin = '0 0'; inner.style.transition = anim ? 'transform .35s ease' : 'none';
    inner.style.transform = cam.z > 1.001 || Math.abs(cam.x) > 0.05 || Math.abs(cam.y) > 0.05 ? 'translate(' + cam.x.toFixed(1) + 'px,' + cam.y.toFixed(1) + 'px) scale(' + cam.z.toFixed(3) + ')' : ''; /* a wide plate pans at zoom 1 too */
    scene.classList.toggle('zoomed', cam.z > 1.01); var f = $('#camFit'); if (f) { var wide = spanOf(L) > 1; f.disabled = cam.z <= 1.01 && !wide; f.setAttribute('aria-label', wide ? 'Zoom out and find her' : 'Show the whole home'); } /* on a wide plate fit also brings the view back to her after a drag */
  }
  function camZoomAt(px, py, z, anim) { var cx = (px - cam.x) / cam.z, cy = (py - cam.y) / cam.z; cam.z = Math.max(1, Math.min(CAM_MAX, z)); cam.x = px - cx * cam.z; cam.y = py - cy * cam.z; camApply(anim); }
  /* fit: the whole plate. A wide plate cannot fit, so the person's fit there zooms to 1 about her (aboutHer) rather than
   * jumping to its left end; a layout change always starts from the plain reset */
  function camFit(anim, aboutHer) {
    if (aboutHer && spanOf(L) > 1) { var f = (hooks.camFocus && hooks.camFocus()) || { x: scene.clientWidth / 2, y: scene.clientHeight / 2 }; camZoomAt(f.x, f.y, 1, anim); return; } /* sitting or meditating she is hidden: keep the part of the street in view */
    cam = { z: 1, x: 0, y: 0 }; camApply(anim);
  }
  function camLocal(e) { var r = scene.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function camInteractive(t) { return t.closest('.hotspot,.avatar,.prop.owned.pet,.prop.owned.tool,.poop,.camctl,.topbar,.chip,.bubble,.visitbar,.propctl,.walkpad,.minimap,.nb,.plot,button,a,input'); }
  scene.addEventListener('pointerdown', function (e) {
    if (arranging || e.pointerType === 'mouse' && e.button !== 0) return;
    camPointers.set(e.pointerId, camLocal(e));
    if (camPointers.size === 2) { var pts = Array.from(camPointers.values()); camGesture = { type: 'pinch', d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), z: cam.z, mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2, x: cam.x, y: cam.y }; }
    else if ((cam.z > 1.01 || spanOf(L) > 1) && !camInteractive(e.target)) { var p = camLocal(e); camGesture = { type: 'pan', sx: p.x, sy: p.y, x: cam.x, y: cam.y, moved: 0 }; }
  });
  scene.addEventListener('pointermove', function (e) {
    if (!camPointers.has(e.pointerId)) return; camPointers.set(e.pointerId, camLocal(e));
    if (camGesture && camGesture.type === 'pinch' && camPointers.size === 2) {
      var pts = Array.from(camPointers.values()), d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      var z = Math.max(1, Math.min(CAM_MAX, camGesture.z * d / Math.max(20, camGesture.d)));
      var cx = (camGesture.mx - camGesture.x) / camGesture.z, cy = (camGesture.my - camGesture.y) / camGesture.z;
      if (!camGesture.told) { camGesture.told = true; emit('cam', 'pinch'); } cam.z = z; cam.x = mx - cx * z; cam.y = my - cy * z; camApply(false); camSuppressClick = true; e.preventDefault();
    } else if (camGesture && camGesture.type === 'pan') {
      var q = camLocal(e), dx = q.x - camGesture.sx, dy = q.y - camGesture.sy; camGesture.moved = Math.max(camGesture.moved, Math.abs(dx) + Math.abs(dy));
      if (camGesture.moved > 6 && (camGesture.told || cam.z > 1.01 || Math.abs(dx) > Math.abs(dy))) { if (!camGesture.told) { camGesture.told = true; emit('cam', 'pan'); } /* at zoom 1 a wide plate only pans sideways; an upward or downward drag is the page's */ cam.x = camGesture.x + dx; cam.y = camGesture.y + dy; camApply(false); camSuppressClick = true; e.preventDefault(); }
    }
  }, { passive: false });
  function camEnd(e) { camPointers.delete(e.pointerId); if (camPointers.size < 2 && camGesture && camGesture.type === 'pinch') camGesture = null; if (!camPointers.size) camGesture = null; if (camSuppressClick) setTimeout(function () { camSuppressClick = false; }, 60); }
  scene.addEventListener('pointerup', camEnd); scene.addEventListener('pointercancel', camEnd); scene.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') camEnd(e); });
  /* a drag or a pinch is not a tap: swallow the click that follows it */
  scene.addEventListener('click', function (e) { if (camSuppressClick) { e.stopPropagation(); e.preventDefault(); camSuppressClick = false; } }, true);
  /* trackpad pinch (ctrl + wheel) and double-tap zoom where you point */
  scene.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); var p = camLocal(e); emit('cam', 'wheel'); camZoomAt(p.x, p.y, cam.z * Math.exp(-e.deltaY * 0.01), false); }, { passive: false });
  scene.addEventListener('dblclick', function (e) { if (camInteractive(e.target)) return; var p = camLocal(e); if (cam.z > 1.2) { emit('cam', 'fit'); camFit(true, true); } else { emit('cam', 'dbl'); camZoomAt(p.x, p.y, 2, true); } });
  function camControls() {
    if ($('#camCtl')) return;
    var c = document.createElement('div'); c.className = 'camctl'; c.id = 'camCtl';
    c.innerHTML = '<button type="button" id="camIn" aria-label="Zoom in"><span class="ms">add</span></button><button type="button" id="camOut" aria-label="Zoom out"><span class="ms">remove</span></button><button type="button" id="camFit" aria-label="Show the whole home" disabled><span class="ms">fit_screen</span></button>';
    scene.appendChild(c);
    var mid = function () { var f = hooks.camFocus && hooks.camFocus(); return f || { x: scene.clientWidth / 2, y: scene.clientHeight / 2 }; }; /* the follow camera zooms about her */
    $('#camIn').addEventListener('click', function (e) { e.stopPropagation(); var m = mid(); emit('cam', 'zoom'); camZoomAt(m.x, m.y, cam.z * 1.5, true); });
    $('#camOut').addEventListener('click', function (e) { e.stopPropagation(); var m = mid(); emit('cam', 'zoom'); camZoomAt(m.x, m.y, cam.z / 1.5, true); });
    $('#camFit').addEventListener('click', function (e) { e.stopPropagation(); emit('cam', 'fit'); camFit(true, true); });
    window.addEventListener('resize', function () { camApply(false); });
  }
  function buildScene() {
    var aura = document.createElement('div'); aura.className = 'aura'; aura.id = 'aura'; inner.insertBefore(aura, meditator);
    var sp = $('#sparkles');
    for (var i = 0; i < 14; i++) { var s = document.createElement('i'); s.className = 'sparkle'; s.style.left = (5 + Math.random() * 90) + '%'; s.style.top = (4 + Math.random() * 60) + '%'; s.style.animationDelay = (Math.random() * 4) + 's'; s.style.animationDuration = (3 + Math.random() * 3) + 's'; sp.appendChild(s); }
    var st = $('#stars');
    for (var j = 0; j < 26; j++) { var z = document.createElement('i'); z.className = 'star'; z.style.left = (2 + Math.random() * 96) + '%'; z.style.top = (2 + Math.random() * 40) + '%'; z.style.animationDelay = (Math.random() * 3) + 's'; z.style.transform = 'scale(' + (0.5 + Math.random()) + ')'; st.appendChild(z); }
    applyLayout(currentHomeId(), false);
    camControls();
  }
  /* where an owned prop sits: the user's own arrangement, else the layout default, else the shop default */
  function propPosFor(it) { var pp = (S.state().propPos || {})[L.id] || {}; var o = pp[it.id]; var base = (L.props && (L.props[it.id] || (it.posAs && L.props[it.posAs]))) || it.pos; if (!base) return null; var w = base.w * (it.wk || 1); return o ? { x: o.x !== undefined ? o.x : base.x, y: o.y !== undefined ? o.y : base.y, w: w, flip: !!o.flip } : { x: base.x, y: base.y, w: w, flip: !!base.flip }; }
  /* owned props from Dream Street, placed per layout */
  function renderProps() {
    var l = RW.ledger(), wrap = $('#ownedProps'); wrap.innerHTML = '';
    RW.SHOP.forEach(function (it) {
      if (!it.img || it.kind === 'home' || it.kind === 'treat' || it.kind === 'accessory' || l.owned.indexOf(it.id) < 0 || !l.placed[it.id]) return;
      if (L.only && L.only.indexOf(it.kind) < 0) return; /* outdoors only pets come along; the plaza shows none of your things */
      var p = propPosFor(it); if (!p) return;
      var d = document.createElement('div'); d.className = 'prop owned ' + it.kind + (p.flip ? ' flip' : ''); d.dataset.id = it.id; d.style.left = p.x + '%'; d.style.top = p.y + '%'; d.style.width = p.w + '%';
      var worn = it.kind === 'pet' && RW.wearing ? RW.wearing(it.id) : null, wornFile = worn && PETS && PETS.wornSprite ? PETS.wornSprite(it.id, worn.id) : null, spot = worn && !wornFile && PETS ? PETS.wearSpot(it.id, worn.wear) : null;
      /* a pet wearing a piece is its own rendered sprite; the positioned overlay is only the fallback for a combination without one */
      d.innerHTML = '<span class="petbody"><img src="' + ART + (wornFile || it.img) + '" alt="">' + (spot ? '<img class="worn ' + worn.wear + '" src="' + ART + worn.img + '" alt="" style="left:' + (spot.x * 100) + '%;top:' + (spot.y * 100) + '%;width:' + (spot.w * 100) + '%">' : '') + '</span>'; wrap.appendChild(d);
      if (it.id === 'scale') { d.classList.add('tool'); d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', 'Weighing scale. Tap to note your weight.'); }
      if (it.kind === 'pet' && PETS) {
        var pet = PETS.tick(it.id), md = PETS.mood(it.id, { night: isNight() });
        d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', md.text + ' Tap to feed, play or cuddle.');
        if (md.key === 'nap') d.classList.add('napping');
        if (md.key === 'snack' || md.key === 'play') d.insertAdjacentHTML('beforeend', '<span class="petmood" aria-hidden="true"><span class="ms">' + md.icon + '</span></span>');
        pet.poops.forEach(function (pp) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'poop'; b.dataset.pet = it.id; b.dataset.poop = pp.id;
          b.setAttribute('aria-label', 'Tidy up after ' + (PETS.NAMES[it.id] || 'your pet'));
          b.style.left = (p.x + (pp.side || 1) * p.w * 0.72) + '%'; b.style.top = (p.y + 0.6) + '%'; b.style.width = (p.w * 0.42) + '%';
          b.innerHTML = '<img src="' + ART + 'pet-poop.webp" alt="">'; wrap.appendChild(b);
        });
      }
    });
    $('#heartsVal').textContent = RW.tester && RW.tester() ? '∞' : l.hearts;
    emit('props', L);
  }
  /* ---------- no-stress pet care (ovu-pets.js): feed, play, cuddle, tidy up ---------- */
  var PETS = window.OvuPets || null;
  function isNight() { return !!S.state().sleeping || (scene && scene.dataset.sky === 'night'); }
  function petEl(id) { return document.querySelector('.prop.owned.pet[data-id="' + id + '"]'); }
  function petPips(v) { var n = PETS.pips(v); return '<span class="pips">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') + '</span>'; }
  function openPetBubble(id, el) {
    if (!PETS) return;
    chime('tap');
    var cur = PETS.current(id), md = PETS.mood(id, { night: isNight() }), name = PETS.NAMES[id] || 'Your pet';
    var treats = RW.treatsFor ? RW.treatsFor(id) : [], worn = RW.wearing ? RW.wearing(id) : null, hasAcc = RW.SHOP.some(function (o) { return o.kind === 'accessory' && RW.ledger().owned.indexOf(o.id) > -1; });
    var r = el.getBoundingClientRect(), sr = scene.getBoundingClientRect();
    bubble.style.left = Math.min(sr.width - 105, Math.max(105, r.left - sr.left + r.width / 2)) + 'px'; bubble.style.top = (r.top - sr.top - 6) + 'px';
    bubble.innerHTML = '<div class="pethead"><b>' + esc(name) + '</b><span>' + esc(md.text) + '</span><div class="petstat"><span title="Full"><span class="ms">restaurant</span>' + petPips(cur.full) + '</span><span title="Fun"><span class="ms">sports_baseball</span>' + petPips(cur.fun) + '</span></div></div>' +
      (cur.poops.length ? '<button type="button" data-pact="tidy"><span class="ms">cleaning_services</span>Tidy up</button>' : '') +
      '<button type="button" data-pact="feed"><span class="ms">restaurant</span>Feed</button><button type="button" data-pact="play"><span class="ms">sports_baseball</span>Play ball</button><button type="button" data-pact="cuddle"><span class="ms">favorite</span>Cuddle</button>' +
      (treats.length ? '<button type="button" data-pact="treat"><span class="ms">cookie</span>' + esc(treats[0].name) + ' <small>' + treats[0].left + ' left</small></button>' : '') +
      (hasAcc ? '<button type="button" data-pact="dress"><span class="ms">checkroom</span>' + (worn ? 'Wearing ' + esc(worn.name) : 'Dress up') + '</button>' : '');
    bubble.dataset.pet = id; bubble.classList.add('on', 'petbub'); fitBubble();
  }
  function petFx(id, act) {
    var el = petEl(id); if (!el) return; var wrap = $('#ownedProps');
    var x = parseFloat(el.style.left), y = parseFloat(el.style.top), w = parseFloat(el.style.width);
    el.classList.remove('eat', 'hop', 'wiggle'); void el.offsetWidth; el.classList.add(act === 'feed' ? 'eat' : act === 'play' ? 'hop' : 'wiggle');
    if (act === 'feed' || act === 'play') {
      var fx = document.createElement('img'); fx.className = 'petfx ' + (act === 'feed' ? 'bowl' : 'ball'); fx.src = ART + (act === 'feed' ? 'pet-bowl.webp' : 'pet-ball.webp'); fx.alt = '';
      fx.style.left = (x + (act === 'feed' ? w * 0.6 : -w * 0.75)) + '%'; fx.style.top = (y + 0.5) + '%'; fx.style.width = (w * (act === 'feed' ? 0.55 : 0.42)) + '%';
      wrap.appendChild(fx); setTimeout(function () { fx.remove(); }, 2300);
    }
    for (var i = 0; i < 3; i++) {
      var h = document.createElement('span'); h.className = 'petheart ms'; h.textContent = 'favorite';
      h.style.left = (x - w * 0.25 + i * w * 0.25) + '%'; h.style.top = (y - w * 0.95) + '%'; h.style.animationDelay = (i * 0.18) + 's';
      wrap.appendChild(h); (function (n) { setTimeout(function () { n.remove(); }, 2000); })(h);
    }
  }
  function cleanPoop(id, poopId, btn) {
    var res = PETS.clean(id, poopId); if (!res.ok) { renderProps(); return; }
    var rw = RW.care(id, 'clean');
    if (btn) { btn.classList.add('poof'); btn.disabled = true; }
    chime('tap'); toast('All tidy. ' + (PETS.NAMES[id] || 'Your pet') + ' thanks you.' + (rw.points ? ' +' + rw.points + ' ♥' : ''), 'cleaning_services');
    setTimeout(renderProps, 650);
  }
  function petAction(id, act) {
    var name = PETS.NAMES[id] || 'Your pet';
    if (act === 'tidy') { PETS.current(id).poops.forEach(function (pp) { cleanPoop(id, pp.id, document.querySelector('.poop[data-poop="' + pp.id + '"]')); }); return; }
    if (act === 'dress') { var piece = RW.nextWear(id); chime('save'); renderProps(); toast(piece ? name + ' is wearing the ' + piece.name.toLowerCase() + '.' : name + ' is back to her natural look.', 'checkroom'); bubble.classList.remove('on', 'petbub'); return; }
    if (act === 'treat') {
      var tl = RW.treatsFor(id); if (!tl.length) { toast('The treat cupboard is empty. Dream Street has more.', 'cookie'); return; }
      var tr = PETS.treat(id); if (!tr.ok) { toast(name + ' is full right now. Save the treat for later.', 'favorite'); return; }
      var used = RW.useTreat(id, tl[0].id); petFx(id, 'feed'); chime('save');
      toast(name + ' loved the ' + used.item.name.toLowerCase() + '.' + (used.left ? ' ' + used.left + ' left.' : ' That was the last one.'), 'cookie');
      bubble.classList.remove('on', 'petbub'); setTimeout(renderProps, 2400); return;
    }
    var r = act === 'feed' ? PETS.feed(id) : act === 'play' ? PETS.play(id) : PETS.cuddle(id);
    if (!r.ok) { toast(act === 'feed' ? name + ' is already full. Maybe a cuddle instead?' : name + ' is happily tired. Maybe a cuddle instead?', 'favorite'); return; }
    var rw = RW.care(id, act);
    petFx(id, act); chime('save');
    toast((act === 'feed' ? name + ' munched happily.' : act === 'play' ? name + ' loved chasing the ball.' : name + ' snuggled in.') + (rw.points ? ' +' + rw.points + ' ♥' : ''), act === 'feed' ? 'restaurant' : act === 'play' ? 'sports_baseball' : 'favorite');
    setTimeout(renderProps, act === 'cuddle' ? 1500 : 2400);
  }
  $('#ownedProps').addEventListener('click', function (e) {
    if (arranging) return;
    var pb = e.target.closest('.poop'); if (pb) { e.stopPropagation(); cleanPoop(pb.dataset.pet, pb.dataset.poop, pb); return; }
    var pe = e.target.closest('.prop.owned.pet'); if (pe) { e.stopPropagation(); openPetBubble(pe.dataset.id, pe); return; }
    var tl = e.target.closest('.prop.owned.tool'); if (tl) { e.stopPropagation(); chime('tap'); openWeigh(); }
  });
  $('#ownedProps').addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var pe = e.target.closest('.prop.owned.pet'); if (pe && !arranging) { e.preventDefault(); openPetBubble(pe.dataset.id, pe); return; } var tl = e.target.closest('.prop.owned.tool'); if (tl && !arranging) { e.preventDefault(); openWeigh(); } });


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
  function placeAvatar(p, flip) { pos = { x: p.x, y: p.y }; avatar.style.left = p.x + '%'; avatar.style.top = p.y + '%'; avatar.classList.toggle('flip', !!flip); emit('placed', pos); } /* the walk engine re-ranks her depth */
  function sameFloor(a, b) { if (!L.stairs) return true; return (a.y < L.upstairsY) === (b.y < L.upstairsY); }
  function walkTo(wp, done) {
    if (wp && !reduced && hooks.walkTo && hooks.walkTo(wp, function () { avatar.classList.toggle('flip', !!wp.flip); scheduleLife(); done && done(); })) return; /* routed around furniture, with her walk cycle */
    if (wp && !reduced && !sameFloor(pos, wp)) {
      var up = wp.y < L.upstairsY, seq = (up ? L.stairs.slice() : L.stairs.slice().reverse()).concat([wp]), i = 0;
      (function next() { if (i >= seq.length) { done && done(); return; } walkLeg(seq[i++], next); })();
      return;
    }
    walkLeg(wp, done);
  }
  function walkLeg(wp, done) {
    emit('beforeWalk'); /* a floor walk in progress commits its live position first, so this leg starts from there */
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
  function goHome() { clearTimeout(idleTimer); idleTimer = setTimeout(function () { if (!S.state().sleeping && !meditating && !current && !(hooks.moving && hooks.moving())) walkTo(HOME); }, 1400); }

  /* ---------- sheets ---------- */
  var sheet = $('#sheet'), veil = $('#veil'), body = $('#sheetBody'), current = null;
  function openSheet(id, title, sub, icon, html) {
    if (current === 'diary') stopCamera();
    current = id; $('#sheetTitle').innerHTML = esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('#sheetIcon').innerHTML = '<span class="ms">' + esc(icon) + '</span>';
    /* a fresh body node each time, so listeners from the previous sheet (or a re-render of this one) never pile up */
    var fresh = body.cloneNode(false); body.parentNode.replaceChild(fresh, body); body = fresh; wireGuides(body);
    body.innerHTML = html; body.scrollTop = 0;
    sheet.classList.add('on'); veil.classList.add('on'); scene.classList.add('quiet'); var pm = document.getElementById('podMini'); if (pm) pm.hidden = true;
    sheet.setAttribute('aria-hidden', 'false');
    var first = body.querySelector('input,button,select,textarea,a'); if (first && window.matchMedia('(hover:hover)').matches) try { first.focus({ preventScroll: true }); } catch (e) { }
  }
  function hideSheet() { current = null; setTab('home'); if (typeof updatePodMini === 'function') setTimeout(updatePodMini, 0); scheduleLife(); sheet.classList.remove('on'); veil.classList.remove('on'); scene.classList.remove('quiet'); sheet.setAttribute('aria-hidden', 'true'); }
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
    if (!h) return;
    var btn = $('.hotspot[data-id="' + h.id + '"]'); if (btn) { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); }
    chime('tap'); hideBubble(); clearTimeout(idleTimer); /* a pending walk home must not cancel this walk */
    var visited = S.state().visited || {}; visited[h.id] = true; S.setState({ visited: visited });
    $('#hint').classList.remove('on');
    if (h.id === 'window') { openWindow(); return; }
    if (!awake(h.id)) return;
    if (meditating) { openSheetFor(h.id); return; }
    walkTo(h.wp, function () { openSheetFor(h.id); });
  }
  /* outdoors (or in a neighbour's home) the bed, clock and the rest are not in this layout: the scene modules
   * hand back a stand-in so the avatar menu, Today tiles and the phase chip still work by going home first */
  function hotspot(id) { return HOTSPOTS.filter(function (h) { return h.id === id; })[0] || (hooks.fallbackHotspot ? hooks.fallbackHotspot(id) : undefined); }
  function openSheetFor(id) {
    if (!awake(id)) return;
    var ext = hooks.hotspotHandlers[id]; if (ext && ext(id, L) === true) return; /* garden gate, plot, bench, noticeboard... */
    if (id === 'bed') { if (visiting && !S.state().sleeping) { toast('A lovely bed, but it is not yours yet. Head back to sleep in your own.', 'cottage'); return; } return S.state().sleeping ? openWake() : openBedtime(); }
    if (id === 'clock') return openClock();
    if (id === 'bath') return openEveryday('shower');
    if (id === 'fridge') return openDiary('ideas');
    if (id === 'sofa') return openLuna();
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
    return '<div class="entries">' + (st.entries || st.nights).slice().reverse().map(function (n) { /* one row per entry, so each can be deleted; the agents count one night per date */ return '<div class="entry"><span class="ms">bedtime</span><div class="body"><b>' + esc(prettyDate(n.date)) + ' · ' + esc(A.fmtHours(n.hours)) + '</b><span>' + (n.quality ? 'Quality ' + n.quality + '/5' : 'Quality not rated') + '</span></div><button class="del" data-del="' + esc(n.id) + '" aria-label="Delete"><span class="ms">delete</span></button></div>'; }).join('') + '</div>';
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
    if (!RM.supported() || ios) return '<div class="stat"><span class="ms">ios_share</span><div><b>' + (ios ? 'Add Rhythme to your Home Screen for notifications' : 'This browser cannot show notifications') + '</b><span>' + (ios ? 'In Safari tap Share, then “Add to Home Screen”, and open Rhythme from there. Or add the reminders to your calendar below; those alarms always ring.' : 'Add the reminders to your calendar below instead; those alarms always ring.') + '</span></div></div>';
    if (p === 'granted') return '<div class="stat"><span class="ms">notifications_active</span><div><b>Notifications are on</b><span>They fire while Rhythme is open or installed. For alarms that always ring, add them to your calendar too.</span></div></div>';
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
      '<p class="help">Reminders live on this device. Notifications fire while Rhythme is open or installed to your Home Screen; the calendar file carries the same reminders, with alarms, into your phone’s own calendar.</p>');
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
      if (e.target.closest('#remAllow')) { RM.requestPermission().then(function (p) { if (p === 'granted') RM.notify('Rhythme', 'Reminders are on. I will nudge you gently.', 'ovumind-test'); openClock(); }); return; }
      if (e.target.closest('#remIcs')) { if (!RM.list().some(function (x) { return x.on; })) { toast('Add a reminder first.', 'alarm'); return; } RM.download(); toast('Calendar file ready. Open it to add the alarms.', 'event'); return; }
      if (e.target.closest('#remTest')) { RM.notify('Rhythme', 'This is how a reminder looks.', 'ovumind-test').then(function (ok) { toast(ok ? 'Sent. Check your notifications.' : 'Allow notifications first, or use the calendar file.', 'notifications'); }); }
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
  function stopEverything() {
    /* bedtime: a running practice, breathing session, Moon Tap or garden task ends quietly before she sleeps */
    try { if (practice) stopPractice(); } catch (e) { }
    try { if (session) finishSession(false); } catch (e) { }
    try { if (window.OvuBreathTap) OvuBreathTap.close(); } catch (e) { }
    try { if (hooks.hudStop) hooks.hudStop(); } catch (e) { }
    hud.classList.remove('on'); avatar.classList.remove('acting');
  }
  function asleep() { return !!S.state().sleeping; }
  /* Jamie, 19 Oct: once she is asleep nothing else happens until the bed wakes her. The bed and the window (its sheet
     offers "Wake up") stay open, and so does You: account, privacy and export are never locked away. */
  var AWAKE_FREE = { bed: 1, window: 1, you: 1 };
  function awake(id) { if (!asleep() || AWAKE_FREE[id]) return true; toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return false; }
  function enterNight(withPj) {
    stopEverything();
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
      '<p class="help calhint"><span class="ms">touch_app</span>Tap a pink day twice to untick it. Tap the day after a period to add just that day.</p><div id="cycleStat"></div><div class="day-editor" id="dayEditor"></div>');
    $('#calTabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cal.tab = b.dataset.tab; $$('button', $('#calTabs')).forEach(function (x) { x.classList.toggle('on', x === b); }); renderEditor(); });
    $('#calPrev').addEventListener('click', function () { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } renderCal(); });
    $('#calNext').addEventListener('click', function () { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } renderCal(); });
    $('#calGrid').addEventListener('click', function (e) {
      var b = e.target.closest('.cal-day'); if (!b || !b.dataset.date || b.classList.contains('future')) return;
      var day = b.dataset.date, wasSel = cal.sel === day;
      cal.sel = day;
      if (cal.tab === 'period') {
        var have = S.list('period', { from: day, to: day })[0];
        /* You stay in charge: a second tap on a pink day unticks it; a day next to a marked day adds just that
         * day; only a brand-new start fills the usual length, and any of those days can be unticked. */
        if (have && wasSel) { S.remove(have.id); cal.lastFill = cal.lastFill.filter(function (id) { return id !== have.id; }); chime('tap'); toast('Unticked ' + prettyDate(day) + '.', 'remove_done'); renderDeck(); }
        else if (!have) {
          var near = S.list('period', { from: S.addDays(day, -1), to: S.addDays(day, 1) }).filter(function (x) { return x.data.flow && x.data.flow !== 'none'; }).length;
          if (near) { var ev1 = S.add('period', day, { flow: 'light', clots: false, impact: false }); cal.lastFill = []; chime('save'); toast('Added ' + prettyDate(day) + '. Tap it again to untick.', 'water_drop'); renderDeck(); }
          else autoFillPeriod(day);
        }
      }
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
    toast('Marked ' + days + ' day' + (days === 1 ? '' : 's') + ' from ' + prettyDate(start) + '. Tap a pink day twice to untick it.', 'water_drop');
    renderDeck();
  }
  function renderCal() {
    var first = new Date(cal.y, cal.m, 1), days = new Date(cal.y, cal.m + 1, 0).getDate(), startDow = (first.getDay() + 6) % 7;
    $('#calTitle').textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    var periods = {}; S.list('period').forEach(function (e) { if (e.data.flow && e.data.flow !== 'none') periods[e.date] = e.data.flow; });
    var syms = {}; S.list('symptom').forEach(function (e) { syms[e.date] = true; });
    var cs = S.cycleStats(), predicted = {}, fertile = {};
    /* The predicted band is the observed window of likely start days, not one date plus a period length. */
    if (cs.predictedFrom && cs.predictedTo) { for (var pd = cs.predictedFrom; pd <= cs.predictedTo; pd = S.addDays(pd, 1)) predicted[pd] = true; }
    if (cs.predictedNext) { var ov = S.addDays(cs.predictedNext, -14); for (var k = -5; k <= 1; k++) fertile[S.addDays(ov, k)] = true; }
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
    var statHtml = cs.lastStart ? '<div class="stat"><span class="ms">water_drop</span><div><b>Day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') + '</b><span>' + (cs.predictedFrom ? 'Next period expected ' + windowText(cs) + ' (estimate from ' + esc(cs.basis) + ')' + (cs.uncertain ? ', a loose estimate while cycles are changing' : '') + '.' : (cs.mode === 'suspended' ? 'Predictions are paused for your situation; your entries still count.' : 'Add a cycle length in your intro or log another period to start predictions.')) + '</span></div></div>' : '<div class="stat"><span class="ms">water_drop</span><div><b>No period logged yet</b><span>Tap the first day of your last period and ' + periodFillLength() + ' typical days are filled for you to adjust.</span></div></div>';
    statHtml += '<div class="row"><button class="btn blush" id="menstruatingNow"><span class="ms">water_drop</span>I’m menstruating now</button>' + (cal.lastFill.length ? '<button class="btn ghost" id="undoFill"><span class="ms">undo</span>Undo ' + cal.lastFill.length + '-day fill</button>' : '') + '</div>';
    $('#cycleStat').innerHTML = statHtml;
    $('#menstruatingNow').addEventListener('click', function () { var ev = S.add('period', S.today(), { flow: 'medium', clots: false, impact: false }); cal.sel = S.today(); cal.lastFill = []; renderCal(); renderEditor(); afterSave(ev, 'Period logged for today.'); });
    var undo = $('#undoFill'); if (undo) undo.addEventListener('click', function () { cal.lastFill.forEach(function (id) { S.remove(id); }); cal.lastFill = []; renderCal(); renderEditor(); renderDeck(); toast('Fill removed.', 'undo'); });
  }
  function renderEditor() {
    var ed = $('#dayEditor'), date = cal.sel;
    if (cal.tab === 'period') {
      var cur = S.list('period', { from: date, to: date })[0], data = cur ? cur.data : { flow: 'none', clots: false, largeClots: false, flooding: false, impact: false };
      var symToday = S.list('symptom', { from: date, to: date })[0], painToday = symToday && typeof symToday.data.pain === 'number' ? symToday.data.pain : 0;
      ed.innerHTML = '<h3>' + esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
        '<div class="field"><div class="lbl-row"><span class="lbl">Bleeding</span>' + infoBtn('bleeding') + '</div><div class="chips" id="flowChips">' + ['none', 'spotting', 'light', 'medium', 'heavy'].map(function (f) { return '<button type="button" class="chipbtn flow-' + f + (data.flow === f ? ' on' : '') + '" data-flow="' + f + '">' + cap(f) + '</button>'; }).join('') + '</div>' + guideHTML('bleeding') + '</div>' +
        '<div class="field"><span class="lbl">Details</span><div class="chips"><button type="button" class="chipbtn' + (data.clots ? ' on' : '') + '" id="clots"><span class="ms">bubble_chart</span>Clots</button><button type="button" class="chipbtn' + (data.largeClots ? ' on' : '') + '" id="largeClots"><span class="ms">circle</span>Clots over 2.5 cm</button><button type="button" class="chipbtn' + (data.flooding ? ' on' : '') + '" id="flooding"><span class="ms">water_damage</span>Soaked through or changed every 1 to 2 h</button><button type="button" class="chipbtn' + (data.impact ? ' on' : '') + '" id="impact"><span class="ms">event_busy</span>Affected my day</button></div>' +
        '<div class="field"><div class="lbl-row"><label for="ppain" class="lbl" style="margin:0">Pain today · <span id="ppainVal">' + painToday + '</span>/10</label>' + infoBtn('pain') + '</div><input class="range" type="range" id="ppain" min="0" max="10" step="1" value="' + painToday + '">' + '</div></div>' +
        '<div class="row"><button class="btn primary" id="savePeriod"><span class="ms">check</span>Save day</button>' + (cur ? '<button class="btn ghost" id="clearPeriod"><span class="ms">remove_done</span>Untick this day</button>' : '') + '</div><div class="msg" id="calMsg"></div>';
      $('#flowChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#flowChips')).forEach(function (x) { x.classList.toggle('on', x === b); }); });
      ['clots', 'largeClots', 'flooding', 'impact'].forEach(function (k) { $('#' + k).addEventListener('click', function () { this.classList.toggle('on'); if (k === 'largeClots' && this.classList.contains('on')) $('#clots').classList.add('on'); }); });
      $('#ppain').addEventListener('input', function () { $('#ppainVal').textContent = this.value; });
      $('#savePeriod').addEventListener('click', function () {
        try {
          var flow = ($('#flowChips .on') || {}).dataset ? $('#flowChips .on').dataset.flow : 'none';
          if (flow === 'none') { if (cur) S.remove(cur.id); message($('#calMsg'), 'Marked as no bleeding.', true); renderCal(); renderEditor(); renderDeck(); return; }
          var ev = S.add('period', date, { flow: flow, clots: $('#clots').classList.contains('on'), largeClots: $('#largeClots').classList.contains('on'), flooding: $('#flooding').classList.contains('on'), impact: $('#impact').classList.contains('on') });
          var pn = Number($('#ppain').value); if (pn > 0 || symToday) S.add('symptom', date, { pain: pn }, 'room', { merge: true });
          message($('#calMsg'), 'Saved ' + flow + ' flow for ' + prettyDate(date) + '.', true); renderCal(); afterSave(ev);
        } catch (e) { message($('#calMsg'), e.message, false); }
      });
      if (cur) $('#clearPeriod').addEventListener('click', function () { S.remove(cur.id); cal.lastFill = cal.lastFill.filter(function (id) { return id !== cur.id; }); chime('tap'); renderCal(); renderEditor(); renderDeck(); });
    } else {
      var cs = S.list('symptom', { from: date, to: date })[0], sd = cs ? cs.data : { symptoms: [], pain: 0, mood: '', notes: '' };
      ed.innerHTML = '<h3>' + esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h3>' +
        '<div class="field"><span class="lbl">Symptoms</span><div class="chips" id="symChips">' + '<button type="button" class="chipbtn symnone' + (sd.none ? ' on' : '') + '" data-none="1">None</button>' + A.SYMPTOMS.map(function (s) { return '<button type="button" class="chipbtn' + ((sd.symptoms || []).indexOf(s) > -1 ? ' on' : '') + '" data-sym="' + esc(s) + '">' + esc(cap(s)) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><div class="lbl-row"><label for="pain" class="lbl" style="margin:0">Pain · <span id="painVal">' + (sd.pain || 0) + '</span>/10</label>' + infoBtn('pain') + '</div><input class="range" type="range" id="pain" min="0" max="10" step="1" value="' + (sd.pain || 0) + '">' + guideHTML('pain') + '</div>' +
        '<div class="field"><span class="lbl">Mood</span><div class="faces" id="moodFaces">' + [['great', 'sentiment_very_satisfied'], ['good', 'sentiment_satisfied'], ['ok', 'sentiment_neutral'], ['low', 'sentiment_dissatisfied'], ['bad', 'sentiment_very_dissatisfied']].map(function (m) { return '<button type="button" data-mood="' + m[0] + '" class="' + (sd.mood === m[0] ? 'on' : '') + '"><span class="ms">' + m[1] + '</span>' + cap(m[0]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="symNotes">Notes</label><textarea class="input" id="symNotes" placeholder="Anything else you noticed...">' + esc(sd.notes || '') + '</textarea></div>' +
        '<div class="row"><button class="btn primary" id="saveSym"><span class="ms">check</span>Save day</button>' + (cs ? '<button class="btn ghost" id="clearSym">Clear</button>' : '') + '<button class="btn soft" id="acuFromSym"><span class="ms">spa</span>Cramp relief points</button></div><div class="msg" id="calMsg"></div>';
      /* None (Jamie, 19 Oct) is its own answer: it clears the symptoms, and ticking a symptom clears it */
      $('#symChips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; b.classList.toggle('on'); if (!b.classList.contains('on')) return; $$('#symChips .on').forEach(function (x) { if (x !== b && (b.dataset.none || x.dataset.none)) x.classList.remove('on'); }); });
      $('#pain').addEventListener('input', function () { $('#painVal').textContent = this.value; });
      $('#moodFaces').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', $('#moodFaces')).forEach(function (x) { x.classList.toggle('on', x === b && !x.classList.contains('on')); }); });
      $('#acuFromSym').addEventListener('click', openAcupressure);
      $('#saveSym').addEventListener('click', function () {
        try {
          var list = $$('#symChips .on').map(function (b) { return b.dataset.sym; }).filter(Boolean), mood = ($('#moodFaces .on') || {}).dataset ? $('#moodFaces .on').dataset.mood : '';
          var none = !list.length && !!$('#symChips [data-none].on'), data = { symptoms: list, pain: Number($('#pain').value), mood: mood, notes: $('#symNotes').value.trim() };
          if (none) data.none = true;
          /* None replaces the day's symptoms rather than joining them; everything else keeps the usual same-day merge */
          var ev = none && cs ? S.update(cs.id, { data: Object.assign({}, data, { notes: data.notes || '' }) }) : S.add('symptom', date, data);
          message($('#calMsg'), 'Saved for ' + prettyDate(date) + '.', true); renderCal(); afterSave(ev);
        } catch (e) { message($('#calMsg'), e.message, false); }
      });
      if (cs) $('#clearSym').addEventListener('click', function () { S.remove(cs.id); renderCal(); renderEditor(); renderDeck(); });
    }
  }

  /* ---------- diary: camera-assisted food journal ---------- */
  var diaryDate = S.today(), draft = { items: [], photo: null }, picked = null, stopScan = null, ovarian = null;
  function stopCamera() { if (stopScan) { try { stopScan(); } catch (e) { } stopScan = null; } var cw = $('#camwrap'); if (cw) cw.classList.remove('on'); }
  var NV = window.OvuNova || null;
  function novaChip(c) {
    if (!NV || !c) return '';
    var g = NV.GROUPS[c.group] || NV.GROUPS.unknown;
    return '<span class="nchip" style="--nc:' + g.color + '" title="' + esc(NV.basisText(c)) + '">' + esc(g.label) + (typeof c.group === 'number' ? ' · NOVA ' + c.group : '') + (c.upfParts ? ' · has processed parts' : '') + '</span>';
  }
  function novaWords() { try { return localStorage.getItem('ovumind_nova_words') === '1'; } catch (e) { return false; } }
  function novaBar(sh, titleHtml) {
    if (!NV || !sh || !sh.items) return '';
    var words = novaWords(), order = [1, 2, 3, 4, 'cooked', 'unknown'].filter(function (k) { return sh.count[k] > 0; }), cov = NV.coverageText(sh, words);
    return '<div class="nbar-wrap">' + '<div class="nbar-t"><span>' + (titleHtml || 'How processed') + '</span><button type="button" class="nwords" data-nwords="1">' + (words ? 'Show numbers' : 'Words only') + '</button></div>' +
      (words || sh.total <= 0 ? '' : '<div class="nbar" role="img" aria-label="' + esc(NV.headline(sh)) + '">' + order.filter(function (k) { return sh.kcal[k] > 0; }).map(function (k) { return '<i style="flex:' + sh.kcal[k].toFixed(1) + ';background:' + NV.GROUPS[k].color + '"></i>'; }).join('') + '</div>') +
      '<div class="nbar-h">' + esc(NV.headline(sh, words)) + '</div>' + (cov ? '<div class="nbar-c">' + esc(cov) + '</div>' : '') +
      '<div class="nbar-k">' + order.map(function (k) { return '<span>' + (words ? '' : '<i style="background:' + NV.GROUPS[k].color + '"></i>') + esc(NV.GROUPS[k].label) + (words ? '' : ' · ' + sh.count[k]) + '</span>'; }).join('') + '</div></div>';
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-nwords]')) return;
    try { localStorage.setItem('ovumind_nova_words', novaWords() ? '0' : '1'); } catch (err) { }
    var fl = document.getElementById('foodList'); if (fl && typeof diaryDate !== 'undefined') fl.innerHTML = foodEntriesHTML(diaryDate);
    if (document.getElementById('items')) renderItems();
  });
  function foodEntriesHTML(date) {
    var items = S.list('food', { from: date, to: date });
    if (!items.length) return '<div class="empty">Nothing logged for ' + esc(prettyDate(date)) + ' yet.</div>';
    var dayItems = NV ? NV.entriesItems(items) : [];
    var dayBar = dayItems.length ? novaBar(NV.share(dayItems), 'How processed ' + (date === S.today() ? 'today' : 'on ' + esc(prettyDate(date))) + ' ' + infoBtn('nova')) : '';
    return dayBar + '<div class="entries">' + items.map(function (e) {
      var d = e.data, tot = d.items && d.items.length ? FD.sum(d.items) : null;
      return '<div class="entry">' + (d.photo ? '<img class="ethumb" src="' + d.photo + '" alt="">' : '<span class="ms">' + ({ breakfast: 'egg_alt', lunch: 'rice_bowl', dinner: 'dinner_dining', snack: 'icecream' })[d.meal] + '</span>') + '<div class="body"><b>' + esc(cap(d.meal)) + (d.time ? ' · ' + esc(d.time) : '') + '</b><span>' + esc(d.foods) + (tot ? '\n' + esc(FD.line(tot.totals)) : '') + ((d.tags || []).length ? '\n' + esc(d.tags.join(' · ')) : '') + '</span>' + (NV && d.items && d.items.length ? '<small class="nmini">' + esc(NV.short(NV.share(d.items), novaWords())) + '</small>' : '') + '</div><button class="del" data-del="' + esc(e.id) + '" aria-label="Delete"><span class="ms">delete</span></button></div>';
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
    return '<div class="field"><span class="lbl">Foods to try in this phase</span>' + (ph ? '<p class="help" style="margin:0 0 6px">' + esc(ph.text) + '</p>' : '') + '<div class="picks">' + list.map(function (f) { return '<button type="button" class="pick" data-usda="' + esc(f.usda || '') + '" data-name="' + esc(f.name) + '"><b>' + esc(f.emoji + ' ' + f.name) + '</b><small>' + esc(f.tags) + '</small><em>' + esc(f.usda ? 'Tap to add with USDA values' : f.tcm) + '</em></button>'; }).join('') + '</div></div>';
  }
  function showPicker(food) {
    picked = { food: food, portion: food.portions[1] || food.portions[0], grams: (food.portions[1] || food.portions[0]).g };
    var p = $('#picker'); p.classList.add('on');
    var cls = NV ? NV.classify(food) : null, offerLabel = cls && (cls.group === 'unknown' || (cls.likely && cls.basis !== 'label'));
    p.innerHTML = '<h4>' + esc(food.name) + '</h4><div class="src">' + esc(food.source.label) + (food.source.ref ? ' · ' + esc(food.source.ref) : '') + (food.source.date ? ' · ' + esc(food.source.date) : '') + (food.source.detail ? '<br>' + esc(food.source.detail) : '') + '</div>' + (cls ? '<div class="nrow">' + novaChip(cls) + '<small>' + esc(NV.basisText(cls)) + '</small></div>' : '') +
      (offerLabel ? labelSnapHTML('pk') : '') +
      '<div class="portions" id="portions">' + food.portions.map(function (po, i) { return '<button type="button" class="chipbtn' + (po === picked.portion ? ' on' : '') + '" data-i="' + i + '">' + esc(po.label) + ' · ' + po.g + ' g</button>'; }).join('') + '</div>' +
      '<div class="grams"><input class="input" type="number" id="gramsIn" min="1" max="3000" step="1" value="' + picked.grams + '"><span>' + (food.basis === '100ml' ? 'ml' : 'g') + ' you ate</span></div>' +
      '<div class="nutline" id="nutline"></div>' +
      '<div class="row"><button class="btn primary" id="addItem"><span class="ms">add</span>Add to this meal</button><button class="btn ghost" id="cancelPick">Cancel</button></div>';
    function refresh() { var n = FD.scale(food.n, picked.grams); $('#nutline').innerHTML = esc(FD.line(n)) + '<small>' + esc(FD.line(n, ['fe', 'ca', 'sugar', 'na'])) + ' · ? means the source has no value</small>'; }
    $('#portions').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; picked.portion = food.portions[Number(b.dataset.i)]; picked.grams = picked.portion.g; $('#gramsIn').value = picked.grams; $$('button', $('#portions')).forEach(function (x) { x.classList.toggle('on', x === b); }); refresh(); });
    $('#gramsIn').addEventListener('input', function () { var v = Number(this.value); if (v > 0) { picked.grams = v; picked.portion = { label: v + (food.basis === '100ml' ? ' ml' : ' g'), g: v }; $$('button', $('#portions')).forEach(function (x) { x.classList.remove('on'); }); refresh(); } });
    $('#cancelPick').addEventListener('click', function () { p.classList.remove('on'); picked = null; });
    if (offerLabel) wireLabelSnap('pk', function (r) {
      if (!picked || picked.food !== food) return; /* the picker moved on or closed while Luna was reading */
      food.ingredients = { text: r.ingredientsText, source: 'label-photo', rule: 'ingredients-v1' };
      var was = { portion: picked.portion, grams: picked.grams };
      showPicker(food);
      picked.portion = was.portion; picked.grams = was.grams; $('#gramsIn').value = was.grams;
      $$('button', $('#portions')).forEach(function (x) { x.classList.toggle('on', food.portions[Number(x.dataset.i)] === was.portion); });
      refresh();
    });
    $('#addItem').addEventListener('click', function () {
      if (!picked || !(picked.grams > 0)) return;
      draft.items.push(FD.makeItem(food, picked.portion, picked.grams, picked.portion.g === picked.grams && picked.portion.label.indexOf(' g') < 0 ? 'household measure' : 'typed amount'));
      p.classList.remove('on'); picked = null; chime('tap'); renderItems();
      var fs = $('#fdSearch'); if (fs) { fs.value = ''; $('#fdResults').innerHTML = ''; }
    });
    refresh(); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function wireItemGrams() {
    var wrap = $('#items'); if (!wrap || wrap.dataset.gw) return; wrap.dataset.gw = '1';
    wrap.addEventListener('change', function (e) { var g = e.target.closest('[data-g]'); if (!g) return; var i = Number(g.dataset.g); if (draft.items[i]) { draft.items[i] = ORB.regram(draft.items[i], g.value); renderItems(); } });
  }
  function renderItems() {
    wireItemGrams();
    var wrap = $('#items'), tot = $('#totals');
    if (!draft.items.length) { wrap.innerHTML = ''; tot.innerHTML = ''; return; }
    wrap.innerHTML = draft.items.map(function (it, i) { return '<div class="item"><span class="ms">' + (it.source.kind === 'off' ? 'qr_code_2' : it.source.kind === 'custom' ? 'edit' : it.source.kind === 'hpb' ? 'verified' : it.source.kind === 'estimate' ? 'photo_camera' : 'restaurant') + '</span><span><b>' + esc(it.name) + '</b><small>' + esc(it.portionLabel) + ' · ' + it.grams + ' g · ' + esc(FD.fmt('kcal', it.nutrients.kcal)) + ' kcal · ' + esc(FD.fmt('protein', it.nutrients.protein)) + ' g protein</small>' + (NV ? novaChip(NV.classify(it)) : '') + '</span>' + (it.source.kind === 'estimate' || it.source.kind === 'hpb' ? '<label class="igrams"><input class="input" type="number" inputmode="numeric" min="1" max="2000" data-g="' + i + '" value="' + Math.round(it.grams || 0) + '" aria-label="Grams of ' + esc(it.name) + '">g</label>' : '') + '<button class="del" data-i="' + i + '" aria-label="Remove"><span class="ms">close</span></button></div>'; }).join('');
    var sm = FD.sum(draft.items), miss = ['kcal', 'protein', 'carb', 'fat', 'fiber'].filter(function (k) { return sm.missing[k]; });
    tot.innerHTML = '<b>This meal</b><div class="nuts">' + ['kcal', 'protein', 'carb', 'fat', 'fiber'].map(function (k) { return '<div><strong>' + esc(FD.fmt(k, sm.totals[k])) + '</strong><small>' + esc(k === 'kcal' ? 'kcal' : FD.LABEL[k]) + '</small></div>'; }).join('') + '</div><p>' + sm.count + ' item' + (sm.count === 1 ? '' : 's') + (miss.length ? ' · ' + miss.map(function (k) { return sm.missing[k] + ' missing ' + FD.LABEL[k].toLowerCase(); }).join(', ') : ' · all values present') + '. Estimated from the sources shown, with the amounts you confirmed.</p>' + (NV ? novaBar(NV.share(draft.items), 'How processed this meal is') : '');
  }
  /* "Snap the ingredients list": Luna transcribes the panel once (same permission as food photos), the NOVA
   * rule in ovu-nova.js runs on the phone, and the photo is not kept. */
  function labelSnapHTML(id) {
    return '<div class="labelsnap" id="ls-' + id + '"><label class="btn soft"><span class="ms">document_scanner</span>Snap the ingredients list<input type="file" id="lsFile-' + id + '" accept="image/*" capture="environment" hidden></label><div class="msg" id="lsMsg-' + id + '"></div></div>';
  }
  function wireLabelSnap(id, done) {
    var inp = $('#lsFile-' + id), m = $('#lsMsg-' + id), wrap = $('#ls-' + id); if (!inp || !m) return;
    var busy = false;
    inp.addEventListener('change', function () {
      var f = this.files && this.files[0]; this.value = ''; if (!f || busy) return;
      var go = function () {
        busy = true; wrap.classList.add('busy'); message(m, 'Reading the label…', true);
        FD.shrink(f, 1536).then(function (rs) { return ORB.parseLabel(rs.dataUrl); }).then(function (r) {
          busy = false; wrap.classList.remove('busy');
          if (!document.body.contains(m)) return; /* the picker or form was closed while Luna was reading */
          if (!r.isLabel || !r.ingredientsText) { message(m, 'I could not read an ingredients list in that photo. Try a flatter, brighter shot of the label.', false); return; }
          /* the transcript is shown before it is used: Luna can misread, and a cut-off list can change the group */
          m.className = 'msg on'; m.innerHTML = '<b>Check the list Luna read</b>' + (r.complete === false || r.note ? '<span class="lsnote"><span class="ms">warning</span>' + esc(r.note || 'Part of the list may be cut off. Fix it below or take the photo again.') + '</span>' : '') +
            '<textarea class="input lstext" id="lsText-' + id + '" rows="4" maxlength="4000">' + esc(r.ingredientsText) + '</textarea>' +
            '<div class="row"><button type="button" class="btn primary" id="lsUse-' + id + '"><span class="ms">check</span>Use this list</button><button type="button" class="btn ghost" id="lsNo-' + id + '">Cancel</button></div>';
          $('#lsUse-' + id).addEventListener('click', function () { var txt = $('#lsText-' + id).value.trim(); if (!txt) return; message(m, 'Classified from the label you photographed.', true); done({ isLabel: true, ingredientsText: txt, productName: r.productName, quantity: r.quantity, note: r.note }); });
          $('#lsNo-' + id).addEventListener('click', function () { m.className = 'msg'; m.innerHTML = ''; });
        }).catch(function (e) { busy = false; wrap.classList.remove('busy'); if (document.body.contains(m)) message(m, e.message, false); });
      };
      if (ORB.photosAllowed()) { go(); return; }
      m.className = 'msg on'; m.innerHTML = '<b>Let Luna read the label?</b> She reads the photo once and does not keep it. <button type="button" class="btn soft" id="lsAllow-' + id + '">Allow food photos</button>';
      $('#lsAllow-' + id).addEventListener('click', function () { var c = ORB.aiConfig(); c.photos = true; c.provider = c.provider || 'ovumind'; ORB.setAiConfig(c, 'jit'); go(); });
    });
  }
  var customIngredients = null;
  function customFoodForm() {
    customIngredients = null;
    return '<div class="picker on" id="customForm"><h4>Custom food from the label</h4><div class="src">Type the per-100 g (or per-100 ml) values printed on the pack. Leave blanks for anything not shown.</div>' +
      '<div class="field"><label for="cfName">Name</label><input class="input" id="cfName" maxlength="60" placeholder="e.g. Meiji low-fat milk"></div>' +
      '<div class="grid2"><div class="field"><label for="cfKcal">Energy kcal /100</label><input class="input" id="cfKcal" type="number" min="0" step="0.1"></div><div class="field"><label for="cfProt">Protein g /100</label><input class="input" id="cfProt" type="number" min="0" step="0.1"></div></div>' +
      '<div class="grid2"><div class="field"><label for="cfCarb">Carbs g /100</label><input class="input" id="cfCarb" type="number" min="0" step="0.1"></div><div class="field"><label for="cfFat">Fat g /100</label><input class="input" id="cfFat" type="number" min="0" step="0.1"></div></div>' +
      '<div class="grid2"><div class="field"><label for="cfFib">Fibre g /100</label><input class="input" id="cfFib" type="number" min="0" step="0.1"></div><div class="field"><label for="cfServe">Serving size g</label><input class="input" id="cfServe" type="number" min="1" step="1" placeholder="optional"></div></div>' +
      labelSnapHTML('cf') + '<div class="nrow" id="cfNova"></div>' +
      '<div class="row"><button class="btn primary" id="cfUse"><span class="ms">check</span>Use this food</button><button class="btn ghost" id="cfCancel">Cancel</button></div></div>';
  }
  function num(id) { var v = $(id).value; return v === '' ? null : Number(v); }
  function openDiary(pane) {
    diaryDate = S.today(); draft = { items: [], photo: null }; picked = null;
    var cs = S.cycleStats(), phase = cs.phase || 'none', tip = PHASE_TIPS[phase] || PHASE_TIPS.none;
    var h = new Date().getHours(), defMeal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : h < 22 ? 'dinner' : 'snack';
    openSheet('diary', 'Food diary', 'Add a meal, see today, or find ideas', 'menu_book',
      '<div class="dtabs" id="dTabs" role="tablist"><button type="button" role="tab" data-dpane="add" class="on"><span class="ms">add_circle</span>Add a meal</button><button type="button" role="tab" data-dpane="today"><span class="ms">today</span>Today</button><button type="button" role="tab" data-dpane="ideas"><span class="ms">local_florist</span>Ideas</button></div>' +
      '<div class="dpane" data-pane="add">' +
        '<section class="dsec"><h4><i>1</i>When</h4>' + '<div class="grid2"><div class="field"><label for="fdDate">Date</label><input class="input" id="fdDate" type="date" value="' + diaryDate + '" max="' + S.today() + '"></div><div class="field"><label for="fdTime">Time</label><input class="input" id="fdTime" type="time" value="' + nowHM() + '"></div></div>' + '<div class="field"><span class="lbl">Meal</span><div class="chips" id="mealChips">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (m) { return '<button type="button" class="chipbtn' + (m === defMeal ? ' on' : '') + '" data-meal="' + m + '">' + cap(m) + '</button>'; }).join('') + '</div></div>' + '</section>' +
        '<section class="dsec"><h4><i>2</i>What you ate</h4>' + '<div class="field"><div class="lbl-row"><span class="lbl">Search, scan or snap</span>' + infoBtn('food') + '</div>' +
      '<div class="foodmodes"><button type="button" data-mode="search" class="on"><span class="ms">search</span>Search foods</button><button type="button" data-mode="scan"><span class="ms">qr_code_scanner</span>Scan barcode</button><button type="button" data-mode="photo"><span class="ms">photo_camera</span>Snap a photo</button></div>' + guideHTML('food') +
      '<div id="modeArea"></div><img class="thumb" id="thumb" alt=""><div class="picker" id="picker"></div><div id="customWrap"></div><div class="items" id="items"></div><div class="totals" id="totals"></div></div>' + '</section>' +
        '<section class="dsec"><h4><i>3</i>Anything else <small>optional</small></h4>' + '<div class="field"><label for="fdFoods">Notes or anything not in the list</label><textarea class="input" id="fdFoods" placeholder="Kopi C, two slices of kaya toast..."></textarea></div>' + '<div class="field"><span class="lbl">Tags</span><div class="chips" id="tagChips">' + A.FOOD_TAGS.map(function (t) { return '<button type="button" class="chipbtn" data-tag="' + esc(t) + '">' + esc(cap(t)) + '</button>'; }).join('') + '</div></div>' + '</section>' +
        '<button class="btn primary" id="saveFood" style="width:100%"><span class="ms">check</span>Save meal</button><div class="msg" id="foodMsg"></div>' +
      '</div>' +
      '<div class="dpane" data-pane="today" hidden>' + guideHTML('nova') + '<div class="field"><span class="lbl">Entries for <span id="fdLabel">' + esc(prettyDate(diaryDate)) + '</span></span><div id="foodList">' + foodEntriesHTML(diaryDate) + '</div></div>' + '</div>' +
      '<div class="dpane" data-pane="ideas" hidden>' + '<p class="help" style="margin:2px 0 10px"><span class="ms" style="font-size:16px;vertical-align:-3px">yard</span> Teas and herbs now live in the garden greenhouse, with pictures, research and who should take care.</p>' + '<div class="phasechips chips" id="ideaPhases" role="group" aria-label="Food ideas for each phase">' + [['menstrual', 'Period'], ['follicular', 'Follicular'], ['ovulatory', 'Ovulation'], ['luteal', 'Luteal']].map(function (q) { return '<button type="button" class="chipbtn" data-iphase="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</div>' +
      '<div id="ideaTip"></div><div id="picksWrap"></div><p class="help">General food ideas for each part of the cycle, not a diet or a treatment.</p></div>');
    /* food ideas for every phase (Jamie, 20 Oct): your phase is chosen when the app knows it, otherwise the period; tap any other */
    var ideaPhase = phase === 'late' ? 'luteal' : (PHASE_TIPS[phase] && phase !== 'none' ? phase : 'menstrual');
    function showIdeas(k) {
      ideaPhase = k; $$('#ideaPhases [data-iphase]').forEach(function (b) { var on = b.dataset.iphase === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      var t = PHASE_TIPS[k], cur = k === (phase === 'late' ? 'luteal' : phase);
      $('#ideaTip').innerHTML = '<div class="stat"><span class="ms">local_florist</span><div><b>' + esc(t.title) + (cur ? ' · now' : '') + '</b><span>' + esc(t.text) + '</span></div></div>';
      var w = $('#picksWrap'); if (w) w.innerHTML = picksHTML(k);
    }
    $('#ideaPhases').addEventListener('click', function (e) { var b = e.target.closest('[data-iphase]'); if (b) { chime('tap'); showIdeas(b.dataset.iphase); } });
    showIdeas(ideaPhase);
    (ovarian ? Promise.resolve(ovarian) : loadJSON('assets/data/ovarian-foods.json').then(function (d) { ovarian = d; return d; })).then(function () { showIdeas(ideaPhase); }).catch(function () { });
    function setPane(k) { $$('#dTabs button').forEach(function (b) { var on = b.dataset.dpane === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); $$('.dpane', body).forEach(function (pn) { pn.hidden = pn.dataset.pane !== k; }); if (k !== 'add') stopCamera(); body.scrollTop = 0; }
    $('#dTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-dpane]'); if (b) { chime('tap'); setPane(b.dataset.dpane); } });
    if (pane) setPane(pane);
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
        area.innerHTML = '<div class="camwrap on" id="camwrap"><video id="bcVideo" playsinline muted></video><div class="reticle"></div><div class="camhint">Point the camera at the barcode</div></div><div class="row" style="margin-top:8px"><input class="input" id="bcManual" placeholder="Barcode digits or a product name, e.g. Milo" autocomplete="off" enterkeyhint="search"><button type="button" class="btn soft" id="bcLookup" style="flex:0 0 auto">Search</button></div><div class="msg" id="bcMsg"></div><div id="bcResults"></div>';
        if (FD.warmDecoder) FD.warmDecoder();
        stopScan = FD.scanLive($('#bcVideo'), function (code) { stopCamera(); $('#bcManual').value = code; lookup(code); }, function (err) { message($('#bcMsg'), err.message, false); }, function () { var h = $('.camhint'); if (h) h.textContent = 'Hold the pack steady and closer so the barcode fills the box, or type the digits below.'; });
        FD.load();
        var bcTimer = null, bcSeq = 0;
        var bcGo = function (now) {
          var q = $('#bcManual').value.trim(), out = $('#bcResults'), digits = q.replace(/[\s-]/g, '');
          clearTimeout(bcTimer);
          if (/^\d{8,14}$/.test(digits)) { if (now) { out.innerHTML = ''; lookup(digits); } return; }
          if (q.length < 2) { out.innerHTML = ''; return; }
          var local = FD.search(q, 5), seq = ++bcSeq;
          var head = (local.length ? '<div class="bchead">From the food table</div>' + resultsHTML(local) : '') + '<div class="bchead">Packaged products</div>';
          out.innerHTML = head + '<div class="bcbusy">Searching Open Food Facts…</div>';
          bcTimer = setTimeout(function () {
            (FD.searchProducts ? FD.searchProducts(q) : Promise.reject(new Error('Product search is not available in this version.'))).then(function (list) {
              if (seq !== bcSeq) return;
              var groups = FD.groupProducts ? FD.groupProducts(list).slice(0, 10) : list.map(function (p) { return { name: p.name, brands: p.brands, best: p, image: p.image, nova: p.nova, sg: p.sg, sizes: [] }; });
              out.innerHTML = head + (groups.length ? '<div class="results">' + groups.map(function (g) { var one = g.sizes.length < 2; return '<div class="pgroup"><button type="button" class="result" data-code="' + esc(g.best.code) + '">' + (g.image ? '<img src="' + esc(g.image) + '" alt="" loading="lazy">' : '<span class="ms">qr_code_2</span>') + '<span><b>' + esc(g.name) + '</b><small>' + esc([g.brands, one && g.sizes[0] && g.sizes[0].label !== 'size not listed' ? g.sizes[0].label : ''].filter(Boolean).join(' · ')) + (g.sg ? ' · sold in Singapore' : '') + (one ? '' : ' · ' + g.sizes.length + ' sizes') + '</small>' + (NV && g.nova ? novaChip(NV.classify({ nova: g.nova })) : '') + '</span></button>' + (one ? '' : '<div class="psizes"><span>Pick your size</span>' + g.sizes.map(function (z) { return '<button type="button" class="chipbtn" data-code="' + esc(z.code) + '">' + esc(z.label) + '</button>'; }).join('') + '</div>') + '</div>'; }).join('') + '</div><p class="help">Product data from Open Food Facts, a community database. Check the label if something looks off.</p>' : '<p class="help">No packaged products found for “' + esc(q) + '”. Try the brand name, or add it as a custom food from the label.</p>');
            }).catch(function (err) { if (seq === bcSeq) out.innerHTML = head + '<p class="help">' + esc(err.message) + '</p>'; });
          }, now ? 0 : 450);
        };
        $('#bcLookup').addEventListener('click', function () { bcGo(true); });
        $('#bcManual').addEventListener('input', function () { bcGo(false); });
        $('#bcManual').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); bcGo(true); } });
        $('#bcResults').addEventListener('click', function (e) { var b = e.target.closest('[data-code]'); if (!b) return; stopCamera(); lookup(b.dataset.code); });
      } else {
        area.innerHTML = '<div class="snapbtns"><label class="btn primary"><span class="ms">photo_camera</span>Take a photo<input type="file" id="fdPhotoCam" accept="image/*" capture="environment" hidden></label><label class="btn soft"><span class="ms">photo_library</span>Choose from library<input type="file" id="fdPhotoLib" accept="image/*" hidden></label></div>' +
          '<div id="fdPhotoState"></div>' +
          '<p class="help">' + (ORB.photosAllowed() ? 'Luna recognises the dishes and fills them in below, with Singapore HPB values where the dish matches. Check the amounts, then save.' : 'Luna can recognise the dishes for you if you allow food photos. Otherwise the photo stays as a reminder and you pick the foods below.') + ' A barcode in the photo is read on this phone.</p>' +
          '<input class="input" id="fdSearch" placeholder="Add something else: type a food…" autocomplete="off" style="margin-top:8px"><div class="results" id="fdResults"></div>';
        var inp2 = $('#fdSearch'); inp2.addEventListener('input', function () { $('#fdResults').innerHTML = resultsHTML(FD.search(inp2.value, 12)); });
        FD.load();
        var st = $('#fdPhotoState');
        var recognise = function (big) {
          st.innerHTML = '<div class="fdstate busy"><span class="ms">auto_awesome</span>Luna is looking at your plate…</div>';
          ORB.parsePhoto(big).then(function (res) {
            if (!res.isFood || !res.items.length) { st.innerHTML = '<div class="fdstate"><span class="ms">help</span>I could not see food in that photo. Pick what you ate below, or try a closer, brighter shot from above.</div>'; inp2.focus(); return; }
            res.items.forEach(function (it) { draft.items.push(it); }); renderItems();
            var hpb = res.items.filter(function (it) { return it.source && it.source.kind === 'hpb'; }).length;
            st.innerHTML = '<div class="fdstate ok"><span class="ms">check_circle</span>Found ' + res.items.length + ' item' + (res.items.length === 1 ? '' : 's') + (res.mealName ? ': ' + esc(res.mealName) : '') + '. ' + (hpb ? hpb + ' matched to HPB values. ' : '') + 'Change the grams below if they look off, then save.</div>';
          }).catch(function (err) { st.innerHTML = '<div class="fdstate"><span class="ms">error</span>' + esc(err.message) + ' You can pick the foods below.</div>'; });
        };
        var onPhoto = function () {
          var f = this.files && this.files[0]; this.value = ''; if (!f) return;
          Promise.all([FD.shrink(f, 420), FD.shrink(f, 1024)]).then(function (rs) {
            draft.photo = rs[0].dataUrl; var t = $('#thumb'); t.src = rs[0].dataUrl; t.classList.add('on');
            return FD.detectInImage(rs[0].image).then(function (code) {
              if (code) { toast('Barcode found: ' + code, 'qr_code_2'); lookup(code); return; }
              if (ORB.photosAllowed()) { recognise(rs[1].dataUrl); return; }
              st.innerHTML = '<div class="fdstate ask"><span class="ms">photo_camera</span><div><b>Let Luna recognise the food?</b><span>She looks at the photo once and does not keep it. A small thumbnail stays on this phone.</span><div class="row"><button type="button" class="btn primary" id="fdAllow">Allow food photos</button><button type="button" class="btn ghost" id="fdPick">I’ll pick myself</button></div></div></div>';
              $('#fdAllow').addEventListener('click', function () { var c = ORB.aiConfig(); c.photos = true; c.provider = c.provider || 'ovumind'; ORB.setAiConfig(c, 'jit'); recognise(rs[1].dataUrl); });
              $('#fdPick').addEventListener('click', function () { st.innerHTML = ''; inp2.focus(); });
            });
          }).catch(function (e) { toast(e.message, 'error'); });
        };
        $('#fdPhotoCam').addEventListener('change', onPhoto);
        $('#fdPhotoLib').addEventListener('change', onPhoto);
      }
    }
    function lookup(code) {
      var m = $('#bcMsg'); if (m) message(m, 'Looking up ' + code + '…', true);
      FD.lookupBarcode(code).then(function (food) { if (m) message(m, 'Found: ' + food.name, true); showPicker(food); }).catch(function (e) { if (m) message(m, e.message, false); else toast(e.message, 'error'); $('#customWrap').innerHTML = customFoodForm(); wireCustom(); });
    }
    function wireCustom() {
      $('#cfCancel').addEventListener('click', function () { $('#customWrap').innerHTML = ''; });
      wireLabelSnap('cf', function (r) {
        if (!$('#customForm')) return;
        customIngredients = { text: r.ingredientsText, source: 'label-photo', rule: 'ingredients-v1' };
        if (r.productName && !$('#cfName').value.trim()) $('#cfName').value = r.productName.slice(0, 60);
        if (NV) { var c = NV.classify({ name: $('#cfName').value, ingredients: customIngredients }); $('#cfNova').innerHTML = novaChip(c) + '<small>' + esc(NV.basisText(c)) + '</small>'; }
      });
      $('#cfUse').addEventListener('click', function () {
        var name = $('#cfName').value.trim(); if (!name) return toast('Give the food a name.', 'error');
        var serve = num('#cfServe'), food = { id: 'custom:' + Date.now(), name: name, cat: 'custom', basis: '100g', ingredients: customIngredients, n: { kcal: num('#cfKcal'), protein: num('#cfProt'), carb: num('#cfCarb'), fat: num('#cfFat'), fiber: num('#cfFib') }, portions: [{ label: '100 g', g: 100 }].concat(serve > 0 ? [{ label: '1 serving', g: serve }] : []), source: { kind: 'custom', label: 'Typed from the label', ref: null, date: S.today(), detail: 'Values entered by you; unknowns stay blank.' } };
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
        $('#foodList').innerHTML = foodEntriesHTML(diaryDate); afterSave(ev); setPane('today');
      } catch (e) { message($('#foodMsg'), e.message, false); }
    });
  }

  /* ---------- computer: a little desktop with draggable folders and your own wallpaper ---------- */
  var player = null, DESK_KEY = 'ovumind_desk_v1';
  var WALLS = [{ id: 'cat', name: 'Me & Mochi', src: ART + 'wallpaper-cat.webp' }, { id: 'room', name: 'My room', src: ART + 'room-v3.webp' }, { id: 'house', name: 'Dream house', src: ART + 'house-v1.webp' }, { id: 'sky', name: 'Morning sky', src: '' }];
  var SKY = 'linear-gradient(160deg,#cfe6ff,#f6d7ec 60%,#fde7c9)';
  function deskPrefs() { try { return JSON.parse(localStorage.getItem(DESK_KEY) || 'null') || { pos: {}, wall: 'cat', custom: null }; } catch (e) { return { pos: {}, wall: 'cat', custom: null }; } }
  function setDeskPrefs(p) { try { localStorage.setItem(DESK_KEY, JSON.stringify(p)); return true; } catch (e) { toast('Could not save that (storage is full).', 'error'); return false; } }
  /* The desk screen is 16:10. A photo wallpaper keeps a framing (x, y in percent, zoom z) so a portrait can
   * show the face instead of the centre; ar is the photo's width / height, needed to zoom and drag. */
  function fitOf(p) { var f = (p && p.customFit) || {}; return { x: isFinite(f.x) ? f.x : 50, y: isFinite(f.y) ? f.y : 22, z: isFinite(f.z) ? Math.min(3, Math.max(1, f.z)) : 1, ar: f.ar > 0 ? f.ar : null }; }
  function customWallCss(p) { var f = fitOf(p); return 'background-image:url(' + p.custom + ');background-repeat:no-repeat;background-size:' + (f.ar ? (Math.round(f.z * Math.max(100, 62.5 * f.ar) * 10) / 10) + '% auto' : 'cover') + ';background-position:' + f.x + '% ' + f.y + '%'; }
  function photoAr(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im.naturalHeight ? im.naturalWidth / im.naturalHeight : null); }; im.onerror = function () { res(null); }; im.src = src; }); }
  function wallStyle(p) { if (p.wall === 'custom' && p.custom) return customWallCss(p); var w = WALLS.filter(function (x) { return x.id === p.wall; })[0] || WALLS[0]; return w.src ? 'background-image:url(' + w.src + ')' : 'background:' + SKY; }
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
      '<div class="desk"><div class="menubar"><span class="brandy">RHYTHME</span><span>Learn</span><span class="sp"></span><button type="button" class="mbtn" id="wallBtn" aria-label="Change wallpaper"><span class="ms">wallpaper</span></button><span id="deskClock">' + esc(nowHM()) + '</span></div>' +
      '<div class="wallpaper" id="wallpaper" style="' + wallStyle(p) + '"><div class="dicons free" id="dicons">' + FOLDERS.map(function (f, i) { var q = p.pos[f.id] || [2 + (i % 4) * 25, 4 + Math.floor(i / 4) * 46]; return '<button type="button" class="dicon" data-folder="' + f.id + '" style="left:' + q[0] + '%;top:' + q[1] + '%">' + folderSVG(f.color) + '<span>' + esc(f.name) + '</span></button>'; }).join('') + '</div></div>' +
      '<div class="dock"><button type="button" data-dock="videos" aria-label="Videos"><span class="ms">play_circle</span></button><button type="button" data-dock="mind" aria-label="Erin"><span class="ms">self_improvement</span></button><button type="button" data-dock="acu" aria-label="Acupressure"><span class="ms">spa</span></button><button type="button" data-dock="luna" aria-label="Luna"><span class="ms">dark_mode</span></button><button type="button" data-dock="doctor" aria-label="Share with doctor"><span class="ms">medical_services</span></button></div></div>' +
      '<div class="wallpanel" id="wallpanel"><b>Wallpaper</b><div class="wadjust" id="wallAdjust" hidden><p><span class="ms">open_with</span>Drag your photo on the screen above to move it, and use the slider to zoom.</p><div class="field"><label for="wallZoom">Zoom</label><input type="range" id="wallZoom" min="100" max="300" step="5" value="100"></div><div class="row"><button type="button" class="btn primary" id="wallDone"><span class="ms">check</span>Done</button><button type="button" class="btn ghost" id="wallReset">Reset</button></div></div><div class="walls">' + WALLS.map(function (w) { return '<button type="button" class="wall' + (p.wall === w.id ? ' on' : '') + '" data-wall="' + w.id + '" style="' + (w.src ? 'background-image:url(' + w.src + ')' : 'background:' + SKY) + '"><span>' + esc(w.name) + '</span></button>'; }).join('') + '<button type="button" class="wall upload' + (p.wall === 'custom' ? ' on' : '') + '" data-wall="custom" style="' + (p.custom ? customWallCss(p).replace(/background-size:[^;]+/, 'background-size:cover') : '') + '"><span class="ms">add_photo_alternate</span><span>' + (p.custom ? 'My photo' : 'Upload a photo') + '</span></button></div><input type="file" id="wallFile" accept="image/*" hidden><div class="row" style="margin-top:8px"><button type="button" class="btn ghost" id="deskTidy"><span class="ms">grid_view</span>Tidy the icons</button>' + (p.custom ? '<button type="button" class="btn ghost" id="wallAdjustBtn"><span class="ms">open_with</span>Adjust my photo</button><button type="button" class="btn ghost" id="wallForget"><span class="ms">delete</span>Forget my photo</button>' : '') + '</div><p class="help">Your photo is stored only on this device.</p></div>' +
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
    /* ---------- photo framing: drag to move, slider to zoom ---------- */
    var adj = null, wdrag = null, wpEl = $('#wallpaper');
    function clampPct(v) { return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10; }
    function applyAdj() { var pr = deskPrefs(); pr.customFit = adj; wpEl.style.cssText = customWallCss(pr); }
    function startAdjust() {
      var pr = deskPrefs(); if (!pr.custom) return;
      if (pr.wall !== 'custom') setWall('custom');
      var f0 = fitOf(pr);
      (f0.ar ? Promise.resolve(f0.ar) : photoAr(pr.custom)).then(function (ar) {
        var pr2 = deskPrefs(); adj = fitOf(pr2); adj.ar = ar || 1; pr2.customFit = adj; setDeskPrefs(pr2);
        wpEl.classList.add('adjusting'); applyAdj();
        var box = $('#wallAdjust'); box.hidden = false; $('#wallZoom').value = Math.round(adj.z * 100);
        try { wpEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (err) { }
      });
    }
    function endAdjust(save) {
      if (save && adj) { var pr = deskPrefs(); pr.customFit = adj; setDeskPrefs(pr); toast('Photo position saved.', 'wallpaper'); }
      adj = null; wdrag = null; wpEl.classList.remove('adjusting'); wpEl.style.cssText = wallStyle(deskPrefs()); $('#wallAdjust').hidden = true;
      var tile = document.querySelector('.wall.upload'); var pr3 = deskPrefs(); if (tile && pr3.custom) tile.style.cssText = customWallCss(pr3).replace(/background-size:[^;]+/, 'background-size:cover');
    }
    wpEl.addEventListener('pointerdown', function (e) { if (!adj) return; wdrag = { x: e.clientX, y: e.clientY, fx: adj.x, fy: adj.y }; try { wpEl.setPointerCapture(e.pointerId); } catch (err) { } e.preventDefault(); });
    wpEl.addEventListener('pointermove', function (e) {
      if (!adj || !wdrag) return;
      var r = wpEl.getBoundingClientRect(), W = r.width, H = r.height, iw = W * adj.z * Math.max(1, 0.625 * adj.ar), ih = iw / adj.ar;
      adj.x = W - iw < -0.5 ? clampPct(wdrag.fx + (e.clientX - wdrag.x) / (W - iw) * 100) : 50;
      adj.y = H - ih < -0.5 ? clampPct(wdrag.fy + (e.clientY - wdrag.y) / (H - ih) * 100) : 50;
      applyAdj();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) { wpEl.addEventListener(ev, function () { wdrag = null; }); });
    $('#wallZoom').addEventListener('input', function () { if (!adj) return; adj.z = Math.min(3, Math.max(1, Number(this.value) / 100)); applyAdj(); });
    $('#wallFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      shrinkPhoto(f).then(function (data) { return photoAr(data).then(function (ar) { var pr = deskPrefs(); pr.custom = data; pr.wall = 'custom'; pr.customFit = { x: 50, y: ar && ar < 1 ? 22 : 45, z: 1, ar: ar }; if (setDeskPrefs(pr)) { toast('Wallpaper changed. Tap Adjust my photo to move or zoom it.', 'wallpaper'); openLearn(); $('#wallpanel').classList.add('on'); } }); }).catch(function (err) { toast(err.message, 'error'); });
    });
    body.addEventListener('click', function (e) {
      if (e.target.closest('#wallBtn')) { chime('tap'); $('#wallpanel').classList.toggle('on'); return; }
      var wl = e.target.closest('[data-wall]'); if (wl) { chime('tap'); if (wl.dataset.wall === 'custom' && !deskPrefs().custom) { $('#wallFile').click(); return; } if (wl.dataset.wall === 'custom') { $('#wallFile').value = ''; } setWall(wl.dataset.wall); if (wl.dataset.wall === 'custom') { /* tapping the photo tile again swaps it */ $('#wallFile').click(); } return; }
      if (e.target.closest('#wallAdjustBtn')) { chime('tap'); startAdjust(); return; }
      if (e.target.closest('#wallDone')) { chime('save'); endAdjust(true); return; }
      if (e.target.closest('#wallReset')) { if (adj) { adj.x = 50; adj.y = adj.ar && adj.ar < 1 ? 22 : 45; adj.z = 1; $('#wallZoom').value = 100; applyAdj(); } return; }
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
      '<p class="help">Your avatar remembers her outfit on this device. Pyjamas go on automatically at bedtime. Pets and furniture come from Dream Street.</p>');
    body.addEventListener('click', function (e) { var o = e.target.closest('.outfit'); if (!o) return; setOutfit(o.dataset.id); chime('tap'); toast(OUTFITS.filter(function (x) { return x.id === o.dataset.id; })[0].name + ' it is!', 'checkroom'); });
    $('#saveName').addEventListener('click', function () { S.setProfile({ name: $('#nameInput').value.trim() }); updateGreeting(); toast('Nice to meet you' + (S.profile().name ? ', ' + S.profile().name : '') + '.', 'favorite'); });
  }

  /* ---------- metric slider bars: height and weight ---------- */
  function ftIn(cm) { var t = Math.round(cm / 2.54), f = Math.floor(t / 12); return f + ' ft ' + (t - f * 12) + ' in'; }
  function lbs(kg) { return Math.round(kg * 2.20462) + ' lb'; }
  function sliderHTML(id, label, unit, min, max, step, val, set) {
    var v = val || Math.round((min + max) / 2);
    return '<div class="mslider' + (set ? ' set' : '') + '" data-unit="' + unit + '"><div class="mstop"><label for="' + id + '">' + esc(label) + '</label><output id="' + id + 'Out" for="' + id + '">' + (set ? '<b>' + v + '</b> ' + unit + '<small>' + (unit === 'cm' ? ftIn(v) : lbs(v)) + '</small>' : '<em>Slide to set</em>') + '</output></div>' +
      '<input type="range" class="mrange" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '"' + (set ? ' data-set="1"' : '') + ' aria-valuetext="' + v + ' ' + unit + '"><div class="mscale"><span>' + min + '</span><span>' + max + ' ' + unit + '</span></div></div>';
  }
  function wireSliders(root) {
    $$('.mrange', root).forEach(function (r) {
      var paint = function () { var unit = r.closest('.mslider').dataset.unit, v = Number(r.value), pct = (v - Number(r.min)) / (Number(r.max) - Number(r.min)) * 100; r.style.setProperty('--fill', pct + '%'); if (r.dataset.set) { $('#' + r.id + 'Out').innerHTML = '<b>' + (unit === 'kg' ? v.toFixed(1) : v) + '</b> ' + unit + '<small>' + (unit === 'cm' ? ftIn(v) : lbs(v)) + '</small>'; r.setAttribute('aria-valuetext', v + ' ' + unit); } };
      r.addEventListener('input', function () { r.dataset.set = '1'; r.closest('.mslider').classList.add('set'); paint(); });
      paint();
    });
  }
  function sliderVal(id) { var r = $('#' + id); return r && r.dataset.set ? Number(r.value) : null; }

  /* ---------- weighing scale (5 hearts in the shop): a private note, never rewarded ---------- */
  function openWeigh() {
    var P = S.profile(), logs = S.list('weight').slice(-6).reverse(), last = logs[0] ? logs[0].data.kg : (P.weightKg || null), mine = S.byDate(S.today()).filter(function (e) { return e.type === 'weight'; })[0];
    var hist = logs.length ? '<div class="field"><span class="lbl">Recent notes</span><div class="whist">' + logs.map(function (e) { return '<div><span>' + esc(prettyDate(e.date)) + '</span><b>' + e.data.kg + ' kg</b></div>'; }).join('') + '</div>' + (logs.length > 1 ? '<p class="help">Since ' + esc(prettyDate(logs[logs.length - 1].date)) + ': ' + (function (d) { return (d > 0 ? '+' : '') + d.toFixed(1); })(logs[0].data.kg - logs[logs.length - 1].data.kg) + ' kg. Day-to-day changes are mostly water.</p>' : '') + '</div>' : '';
    openSheet('weigh', 'Weighing scale', 'A private note, never judged', 'monitor_weight',
      '<div class="weighart"><img src="' + ART + 'prop-scale.webp" alt=""></div>' +
      sliderHTML('wKg', mine ? 'Today’s weight (update it)' : 'Today’s weight', 'kg', 30, 150, 0.1, last, !!last) +
      '<div class="row"><button type="button" class="btn primary" id="wSave"><span class="ms">check</span>' + (mine ? 'Update today' : 'Save today') + '</button></div><div class="msg" id="wMsg"></div>' + hist +
      '<details class="field"><summary class="lbl" style="cursor:pointer">My height</summary>' + sliderHTML('wCm', 'Height', 'cm', 130, 200, 1, P.heightCm || null, !!P.heightCm) + '<div class="row"><button type="button" class="btn soft" id="wCmSave"><span class="ms">save</span>Save height</button></div></details>' +
      '<p class="help">Weight shifts a kilo or two with your cycle, salt, sleep and water. Rhythme never judges it and gives no hearts for numbers, so there is nothing to chase. If weighing yourself feels stressful, put the scale away in the heart shop any time.</p>');
    wireSliders(body);
    $('#wSave').addEventListener('click', function () {
      var kg = sliderVal('wKg'); if (!kg) { message($('#wMsg'), 'Slide to your weight first.', false); return; }
      kg = Math.round(kg * 10) / 10;
      try { S.add('weight', S.today(), { kg: kg }, 'scale'); S.setProfile({ weightKg: kg }); chime('save'); toast('Noted: ' + kg + ' kg. One number among many.', 'monitor_weight'); renderDeck(); openWeigh(); } catch (err) { message($('#wMsg'), err.message, false); }
    });
    $('#wCmSave').addEventListener('click', function () { var cm = sliderVal('wCm'); if (!cm) return; S.setProfile({ heightCm: cm }); chime('save'); toast('Height saved: ' + cm + ' cm.', 'height'); });
  }

  /* ---------- bottom tabs: every tab opens a sheet in the room, so the look and the data never change ---------- */
  var TABS = { cycle: function () { openCalendar('period'); }, food: function () { openDiary(); }, mind: function () { openMindfulness(); }, you: function () { openYou(); } };
  function setTab(k) { $$('.nav a').forEach(function (a) { var on = (a.dataset.tab || 'home') === k; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
  function goTab(k) {
    hideBubble();
    if (k === 'home' || !TABS[k]) { if (current) closeSheet(); setTab('home'); return; }
    if (!awake(k)) { setTab(current ? current : 'home'); return; }
    TABS[k](); setTab(k);
  }
  function measureNav() { var n = $('.nav'), f = $('#frame'); if (n && f) f.style.setProperty('--navh', n.offsetHeight + 'px'); }
  measureNav(); window.addEventListener('resize', measureNav);
  $$('.nav a').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); chime('tap'); requireConsent(function () { goTab(a.dataset.tab || 'home'); }); }); });

  /* ---------- You: name, outfit, hearts, settings and your data, all in the room ---------- */
  function openChoices() {
    if (!window.OvuConsent) return;
    openSheet('choices', 'Your choices', 'Each use of your data, separately', 'fact_check', OvuConsent.choicesHTML());
    OvuConsent.wireChoices(body, { toast: toast, chime: chime, rerender: openChoices });
  }
  function openYou(confirmDelete) {
    var P = S.profile(), l = RW.ledger(), dates = {};
    S.TYPES.forEach(function (t) { S.list(t).forEach(function (e) { dates[e.date] = 1; }); });
    var days = Object.keys(dates).length;
    var row = function (icon, title, sub, act, href) { return (href ? '<a class="yrow" href="' + href + '"' : '<button type="button" class="yrow" data-yact="' + act + '"') + '><span class="ms">' + icon + '</span><span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span><span class="ms go">chevron_right</span>' + (href ? '</a>' : '</button>'); };
    openSheet('you', P.name ? P.name : 'You', 'Your room, your answers, your data', 'person',
      '<div class="you-card"><img src="' + ART + 'avatar-' + esc(P.outfit || 'base') + '.webp" alt=""><div><b>' + esc(P.name || 'Hello there') + '</b><span>' + days + ' day' + (days === 1 ? '' : 's') + ' logged · ' + (l.hearts || 0) + ' hearts' + (l.streak ? ' · ' + l.streak + '-day streak' : '') + '</span></div></div>' +
      '<div class="field"><label for="youName">What should I call you?</label><div class="row" style="margin-top:0"><input class="input" id="youName" maxlength="24" placeholder="Your name" value="' + esc(P.name || '') + '"><button type="button" class="btn soft" id="youNameSave" style="flex:0 0 auto;min-width:0"><span class="ms">check</span>Save</button></div></div>' +
      '<div id="youAccount"></div>' +
      '<div class="ygroup"><span class="lbl">Your room</span>' + row('waving_hand', 'Getting to know you', 'Update your answers any time', 'intro') + row('checkroom', 'Wardrobe', 'Change your outfit', 'wardrobe') + row('format_size', 'Text size', 'Bigger words and buttons', 'text') + row('storefront', 'Dream Street', 'Pet shop, furniture store, property showroom', 'shop') + (RW.tester && RW.tester() ? row('science', 'Tester mode is on', 'Unlimited hearts for trying things out. Tap to turn off', 'testeroff') : '') + row('alarm', 'Reminders', 'Gentle nudges, set by you', 'clock') + '</div>' +
      '<div class="ygroup"><span class="lbl">Your records</span>' + row('auto_stories', 'My journal', 'Daily logs and Luna’s readings', '', 'journal.html') + row('medical_services', 'Share with my doctor', 'A 4-week summary card', '', 'journal.html#share') + row('menu_book', 'Evidence', 'Every source behind the guides, by number', '', 'evidence.html') + '</div>' +
      '<div class="ygroup"><span class="lbl">Your data</span>' + row('auto_awesome', 'Rhythme Plus', (window.OvuPodcast && OvuPodcast.plusActive() ? 'On for this phone' : 'Erin’s full library · preview'), 'plus') + row('fact_check', 'Your choices', 'Each use of your data, on or off, and your receipt', 'choices') + row('dark_mode', 'Luna’s settings', 'Reading, food photos and readings', 'luna') + row('move_to_inbox', 'Import from Apple Health or Google', (window.OvuHealth ? OvuHealth.importedCount(S) : 0) ? OvuHealth.importedCount(S) + ' entries brought in so far' : 'Sleep, weight and period days you already have', 'import') + row('download', 'Export my data', 'A copy of everything, as a file', 'export') + row('delete', 'Delete everything', 'Start fresh on this phone', 'delete') + '</div>' +
      (confirmDelete ? '<div class="flag high" id="yDel"><span class="ms">warning</span><div><b>Delete everything on this phone?</b><span>Every entry, answer, photo thumbnail and heart is removed, and this cannot be undone. Export a copy first if you want to keep it.</span><div class="row"><button type="button" class="btn danger" data-yact="delete-yes"><span class="ms">delete</span>Delete everything</button><button type="button" class="btn ghost" data-yact="delete-no">Keep my data</button></div></div></div>' : '') +
      '<p class="help" style="text-align:center"><a href="privacy.html">Privacy notes</a> · <a href="terms.html">Terms</a> · Rhythme is not a medical device and never replaces care.</p>');
    $('#youNameSave').addEventListener('click', function () { S.setProfile({ name: $('#youName').value.trim() }); updateGreeting(); chime('save'); toast('Nice to meet you' + (S.profile().name ? ', ' + S.profile().name : '') + '.', 'favorite'); openYou(); });
    if (window.OvuAuth) { var ya = $('#youAccount'); if (ya) OvuAuth.renderAccount(ya, { toast: toast, chime: chime }); }
    if (confirmDelete) { var yd = $('#yDel'); if (yd) yd.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-yact]'); if (!b) return; var act = b.dataset.yact; chime('tap');
      if (act === 'intro') { var A0 = JSON.parse(JSON.stringify(P)); Object.assign(A0, P.habits || {}); ['cycleLength', 'periodLength'].forEach(function (k) { if (A0[k] !== null && A0[k] !== undefined) A0[k] = String(A0[k]); }); openOnboarding(0, A0); return; }
      if (act === 'text') return window.OvuTextSize && OvuTextSize.open ? OvuTextSize.open() : undefined;
      if (act === 'wardrobe') return openWardrobe();
      if (act === 'shop') return openShop();
      if (act === 'testeroff') { S.setState({ tester: null }); renderProps(); toast('Tester mode is off. Hearts count again.', 'science'); return; }
      if (act === 'mascot') return openMascot();
      if (act === 'clock') return openClock();
      if (act === 'plus') return openPlus();
      if (act === 'choices') return openChoices();
      if (act === 'luna') { openLuna(); var ab = $('#aibox'); if (ab) { ab.open = true; setTimeout(function () { ab.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); } return; }
      if (act === 'import') return openImport();
      if (act === 'export') {
        try { var blob = new Blob([S.exportJSON()], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rhythme-' + S.today() + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Your data is saved as a file.', 'download'); } catch (err) { toast('Could not export: ' + err.message, 'error'); }
        return;
      }
      if (act === 'delete') return openYou(true);
      if (act === 'delete-no') return openYou();
      if (act === 'delete-yes') { S.clearAll(); ['ovumind_ai_v1', 'ovumind_desk_v1', 'ovumind_nova_words', 'ovuluna_onboarding'].forEach(function (k) { try { localStorage.removeItem(k); } catch (err) { } }); location.replace('room.html'); }
    });
  }

  /* ---------- import from Apple Health or Google Takeout (ovu-health.js): read on this phone, never uploaded ---------- */
  var importing = false, importRuns = 0;
  function openImport(view) {
    var H = window.OvuHealth, n = H ? H.importedCount(S) : 0;
    openSheet('import', 'Bring in your health data', 'Read on this phone, never uploaded', 'move_to_inbox',
      '<p class="help" style="margin-top:6px">Sleep, weight and period days you already have can join your diary. Rhythme reads the file right here on your phone and sends nothing anywhere.</p>' +
      '<div class="imp-card"><div class="imp-head"><span class="ms">ios</span><div><b>Apple Health</b><small>From an iPhone</small></div></div>' +
        '<ol class="imp-steps"><li>Open the Health app and tap your picture or initials at the top right.</li><li>Scroll down, tap <b>Export All Health Data</b>, then <b>Export</b>. It takes a minute or two.</li><li>Save <b>export.zip</b> to Files, then choose it here. Big files are fine; only sleep, weight and period days are kept.</li></ol>' +
        '<label class="btn primary imp-pick"><span class="ms">folder_open</span>Choose export.zip<input type="file" id="impApple" accept=".zip,.xml,application/zip,text/xml,application/xml" hidden></label></div>' +
      '<div class="imp-card"><div class="imp-head"><span class="ms">android</span><div><b>Google</b><small>Fit data through Google Takeout</small></div></div>' +
        '<ol class="imp-steps"><li>Go to <b>takeout.google.com</b>, tap <b>Deselect all</b>, then tick <b>Fit</b> only.</li><li>Tap <b>Next step</b>, keep <b>Export once</b> and the zip format, then <b>Create export</b>.</li><li>Download the zip when Google emails you, then choose it here, or pick the files from its Fit folder.</li></ol>' +
        '<p class="help">Health Connect has no file export yet; it can only back up to cloud storage for moving to another phone. Period days are not in Takeout’s Fit folder, so those stay with the calendar.</p>' +
        '<label class="btn primary imp-pick"><span class="ms">folder_open</span>Choose Takeout zip or Fit files<input type="file" id="impGoogle" accept=".zip,.json,.csv,application/zip,application/json,text/csv" multiple hidden></label></div>' +
      '<div id="impProgress"' + (importing ? '' : ' hidden') + '><div class="ibar"><i id="impBar" style="width:' + (importing ? '30%' : '0') + '"></i></div><p class="help" id="impStatus" role="status" aria-live="polite">' + (importing ? 'Still reading your file…' : '') + '</p></div>' +
      '<div id="impSummary" data-run="' + importRuns + '"></div>' +
      '<div id="impRemoveWrap">' + (n ? '<div class="row"><button type="button" class="btn ghost" id="impRemove"><span class="ms">delete_sweep</span>Remove imported data (' + n + ')</button></div>' : '') + '</div>' +
      (view === 'confirm-remove' && n ? '<div class="flag high" id="impDel"><span class="ms">warning</span><div><b>Remove ' + n + ' imported entr' + (n === 1 ? 'y' : 'ies') + '?</b><span>Only entries brought in from Apple Health or Google go. Everything you logged yourself stays exactly as it is.</span><div class="row"><button type="button" class="btn danger" id="impDelYes"><span class="ms">delete_sweep</span>Remove imported</button><button type="button" class="btn ghost" id="impDelNo">Keep them</button></div></div></div>' : '') +
      '<p class="help">A day you logged yourself always wins: an imported entry never replaces one you wrote by hand. Imported entries are marked, so one tap removes only them.</p>');
    if (!H) { $('#impSummary').innerHTML = '<div class="flag watch"><span class="ms">info</span><div><b>The import helper did not load</b><span>Reload the room once and try again.</span></div></div>'; return; }
    ['impApple', 'impGoogle'].forEach(function (id) {
      var inp = $('#' + id); if (!inp) return;
      inp.addEventListener('change', function () { var files = Array.prototype.slice.call(inp.files || []); inp.value = ''; if (files.length) runImport(files); });
    });
    var rm = $('#impRemove'); if (rm) rm.addEventListener('click', function () { chime('tap'); openImport('confirm-remove'); var d = $('#impDel'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    var yes = $('#impDelYes'); if (yes) yes.addEventListener('click', function () { var gone = H.removeImported(S); chime('save'); renderDeck(); renderProps(); toast('Removed ' + gone + ' imported entr' + (gone === 1 ? 'y' : 'ies') + '. Your own entries are untouched.', 'delete_sweep'); openImport(); });
    var no = $('#impDelNo'); if (no) no.addEventListener('click', function () { chime('tap'); openImport(); });
  }
  /* The sheet body is rebuilt on every open, so progress writes look the elements up fresh and simply miss when another sheet is showing. */
  function runImport(files) {
    var H = window.OvuHealth; if (!H || importing) return; importing = true;
    var ui = function (id) { return current === 'import' ? $('#' + id) : null; }, last = 0;
    var show = function (frac, label) { var p = ui('impProgress'), b = ui('impBar'), st = ui('impStatus'); if (p) p.hidden = false; if (b) b.style.width = Math.max(2, Math.min(100, Math.round(frac * 100))) + '%'; if (st) st.textContent = label; };
    var busy = function (on) { $$('.imp-pick').forEach(function (l) { l.classList.toggle('busy', on); }); };
    busy(true); var sm = ui('impSummary'); if (sm) sm.innerHTML = ''; show(0.02, 'Opening ' + files[0].name + '…');
    H.importFiles(files, { onProgress: function (f, label) { var now = Date.now(); if (f < 1 && now - last < 120) return; last = now; show(f, label + ' · ' + Math.round(f * 100) + '%'); } })
      .then(function (res) { show(1, 'Adding to your diary…'); return new Promise(function (r) { setTimeout(r, 40); }).then(function () { var p = H.apply(res, S); showImportSummary(res, p); }); })
      .catch(function (err) { show(0, ''); var p = ui('impProgress'); if (p) p.hidden = true; var s2 = ui('impSummary'); if (s2) s2.innerHTML = '<div class="flag watch"><span class="ms">info</span><div><b>That file did not go through</b><span>' + esc(err && err.message ? err.message : String(err)) + '</span></div></div>'; })
      .then(function () { importing = false; busy(false); });
  }
  function showImportSummary(res, p) {
    var H = window.OvuHealth, c = p.counts, plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
    var long = { day: 'numeric', month: 'short', year: 'numeric' };
    var stat = function (icon, big, small) { return '<div class="stat"><span class="ms">' + icon + '</span><div><b>' + esc(big) + '</b><span>' + esc(small) + '</span></div></div>'; };
    var google = res.source === H.SOURCE.google;
    var html = stat('bedtime', plural(c.sleep, 'night', 'nights'), c.sleep ? 'Bedtime, wake time and hours asleep' + (res.inBedNights ? ', ' + res.inBedNights + ' from time in bed only' : '') + (res.naps ? ' · ' + plural(res.naps, 'nap', 'naps') + ' left out' : '') : 'No sleep records in this file') +
      stat('monitor_weight', plural(c.weight, 'weigh-in', 'weigh-ins'), c.weight ? 'One per day, in kilograms' : 'No weight records in this file') +
      stat('water_drop', plural(c.period, 'period day', 'period days'), google ? 'Takeout’s Fit folder carries no period data' : (c.period ? 'Flow as recorded' + (res.counts.flowNone ? '; days marked no bleeding were skipped' : '') : 'No period records in this file'));
    var notes = [];
    if (p.from) notes.push('From ' + prettyDate(p.from, long) + ' to ' + prettyDate(p.to, long) + '.');
    if (p.refreshed) notes.push(plural(p.refreshed, 'entry', 'entries') + ' from an earlier import refreshed.');
    if (p.kept) notes.push(plural(p.kept, 'day', 'days') + ' you logged yourself left as they were.');
    if (p.future) notes.push(plural(p.future, 'future-dated entry', 'future-dated entries') + ' skipped.');
    if (res.skippedTotal) { var kinds = Object.keys(res.skipped).sort(function (a, b) { return res.skipped[b] - res.skipped[a]; }).slice(0, 3).map(H.friendlyType); notes.push('Skipped ' + res.skippedTotal.toLocaleString() + ' records of ' + plural(res.skippedKinds, 'other kind', 'other kinds') + ' Rhythme has no place for yet (' + kinds.join(', ') + (res.skippedKinds > 3 ? ' and more' : '') + ').'); }
    if (!p.total && !p.kept) notes.push('Nothing here was new for your diary.');
    notes.push('This file was read on your phone and never left it.');
    html += '<p class="help">' + esc(notes.join(' ')) + '</p>';
    importRuns++;
    var sm = $('#impSummary'); if (current === 'import' && sm) { sm.innerHTML = html; sm.dataset.run = String(importRuns); var st = $('#impStatus'); if (st) st.textContent = 'Done.'; }
    var n = H.importedCount(S), wrap = current === 'import' ? $('#impRemoveWrap') : null;
    if (wrap) { wrap.innerHTML = n ? '<div class="row"><button type="button" class="btn ghost" id="impRemove"><span class="ms">delete_sweep</span>Remove imported data (' + n + ')</button></div>' : ''; var rm = $('#impRemove'); if (rm) rm.addEventListener('click', function () { chime('tap'); openImport('confirm-remove'); }); }
    chime('save'); renderDeck(); renderProps();
    toast(p.total ? 'Brought in ' + plural(c.sleep, 'night', 'nights') + ', ' + plural(c.weight, 'weigh-in', 'weigh-ins') + ' and ' + plural(c.period, 'period day', 'period days') + '.' : 'Nothing new to add from that file.', 'move_to_inbox');
  }

  /* ---------- Luna's look: pick the friend who sits in the corner ---------- */
  function openMascot() {
    var M = window.OvuMascot; if (!M) return; var cur = M.current();
    openSheet('mascot', 'Luna’s look', 'Pick the friend who keeps you company. Luna stays Luna whichever face she wears.', 'auto_awesome',
      '<div class="mascots">' + M.LIST.map(function (m) { return '<button type="button" data-mascot-pick="' + m.id + '" class="' + (m.id === cur.id ? 'on' : '') + '" aria-pressed="' + (m.id === cur.id) + '"><img src="' + M.src(m) + '" alt=""><b>' + esc(m.name) + '</b><small>' + esc(m.note) + '</small></button>'; }).join('') + '</div>');
    body.addEventListener('click', function (e) { var b = e.target.closest('[data-mascot-pick]'); if (!b) return; chime('save'); var m = M.set(b.dataset.mascotPick); toast(m.name + ' will keep you company.', 'auto_awesome'); openMascot(); });
  }
  /* ---------- Dream Street: a pet shop, a furniture store and a property showroom, plus arranging what you own ---------- */
  var shopTab = 'street', arranging = false, dragProp = null;
  var STORES = {
    pet: { title: 'Pet shop', tag: 'Adopt a friend', sub: 'One kitten and one puppy are home at a time; the others nap in your inventory until you swap.', icon: 'pets', img: 'shop-pets.webp', blurb: 'Kittens and puppies' },
    furniture: { title: 'Furniture store', tag: 'Pieces for your room', sub: 'Lamps, seats and shelves. Pieces that share a spot swap with each other.', icon: 'chair', img: 'shop-furniture.webp', blurb: 'Lamps, seats and shelves' },
    home: { title: 'Property showroom', tag: 'Dream houses to move into', sub: 'Visit any home first. Move in when you have the hearts.', icon: 'cottage', img: 'shop-homes.webp', blurb: 'Houses to visit and move into' }
  };
  var NEXT_HOMES = [{ icon: 'yard', name: 'Garden', note: 'Outdoor practices among the flowers: watering, morning light, a bench for tea.' }, { icon: 'groups', name: 'Community plaza', note: 'A fountain, lanterns and a tea stall where neighbours gather; friends join once accounts arrive.' }];
  function shopItemHTML(it, l, home) {
        var owned = l.owned.indexOf(it.id) > -1, placed = !!l.placed[it.id], ctl, extra = '';
        if (it.kind === 'home') {
          var pct = Math.min(100, Math.round(l.hearts / it.cost * 100));
          ctl = owned ? '<button type="button" class="btn soft" data-home="' + (home === it.id ? 'room' : it.id) + '">' + (home === it.id ? 'Back to my room' : 'Move in') + '</button>'
            : '<button type="button" class="btn primary" data-buy="' + it.id + '"' + (l.hearts < it.cost ? ' disabled' : '') + '>Move in</button><button type="button" class="btn ghost" data-visit="' + it.id + '">Visit</button>';
          if (!owned) extra = '<div class="bar"><i style="width:' + pct + '%"></i></div><small>' + pct + '% saved' + (l.hearts < it.cost ? ' · ' + (it.cost - l.hearts) + ' hearts to go' : ' · you can move in!') + '</small>';
        } else {
          if (it.kind === 'treat') { var have = (l.treats || {})[it.id] || 0; ctl = '<button type="button" class="btn primary" data-buy="' + it.id + '"' + (l.hearts < it.cost ? ' disabled' : '') + '>Buy ' + it.qty + '</button>'; if (have) extra = '<small>' + have + ' in the cupboard</small>'; }
          else if (it.kind === 'accessory') { var by = Object.keys(l.wear || {}).filter(function (p) { return l.wear[p] === it.id; })[0]; ctl = owned ? '<span class="ownchip">' + (by ? 'Worn by ' + esc(PETS && PETS.NAMES[by] || 'a pet') : 'In the drawer') + '</span>' : '<button type="button" class="btn primary" data-buy="' + it.id + '"' + (l.hearts < it.cost ? ' disabled' : '') + '>Buy</button>'; if (owned) extra = '<small>Tap a pet, then Dress up.</small>'; }
          else {
          var slotBusy = it.slot && !placed && RW.SHOP.some(function (o) { return o.slot === it.slot && o.id !== it.id && l.placed[o.id]; });
          ctl = owned ? '<button type="button" class="btn soft" data-toggle="' + it.id + '">' + (placed ? 'Put away' : (slotBusy ? 'Swap in' : 'Place')) + '</button>' : '<button type="button" class="btn primary" data-buy="' + it.id + '"' + (l.hearts < it.cost ? ' disabled' : '') + '>' + (it.kind === 'pet' ? 'Adopt' : 'Buy') + '</button>';
          }
        }
        return '<div class="shopitem' + (it.kind === 'home' ? ' home' : '') + '">' + (it.img ? '<img src="' + ART + it.img + '" alt="">' : '<span class="ph"><span class="ms">cottage</span></span>') + '<span><b>' + esc(it.name) + (it.slot && RW.SLOTS ? ' <em class="slotchip">' + esc(RW.SLOTS[it.slot]) + '</em>' : '') + '</b><small>' + esc(it.note) + '</small>' + extra + '</span><span class="cost"><b><span class="ms fill">favorite</span>' + it.cost + '</b>' + ctl + '</span></div>';
      }
  function shopList(items, l, home) { return '<div class="shop">' + items.map(function (it) { return shopItemHTML(it, l, home); }).join('') + '</div>'; }
  var SHOP_OPEN = 9, SHOP_CLOSE = 22;
  /* hours and names belong to the street (ovu-street.js); without it the whole street keeps 9 to 22 */
  function storeTab(it) { return !it ? 'street' : it.kind === 'home' ? 'home' : it.kind === 'furniture' ? 'furniture' : 'pet'; }
  function shopOpenNow(tab) {
    if (RW.tester && RW.tester()) return true;
    var ST = window.OvuStreet;
    if (ST && ST.openNow && tab && tab !== 'street') return ST.openNow(tab);
    if (ST && ST.openNow && (!tab || tab === 'street')) return ['pet', 'furniture', 'home'].some(function (t) { return ST.openNow(t); });
    var h = new Date().getHours(); return h >= SHOP_OPEN && h < SHOP_CLOSE;
  }
  function storeName(tab) { var ST = window.OvuStreet, st = ST && ST.storeFor ? ST.storeFor(tab) : null; return st && st.name ? st.name : STORES[tab].title; }
  function storeHours(tab) { var ST = window.OvuStreet; return ST && ST.hoursText ? ST.hoursText(tab) : '9 am to 10 pm'; }
  function openShop(tab) {
    if (tab) shopTab = tab;
    if (shopTab !== 'street' && !STORES[shopTab]) shopTab = 'street';
    if (!shopOpenNow(shopTab) || asleep()) {
      var closedName = shopTab === 'street' ? 'Dream Street' : storeName(shopTab), hoursLine = shopTab === 'street' ? ['pet', 'furniture', 'home'].map(function (t) { return storeName(t) + ' ' + storeHours(t); }).join(' · ') : storeName(shopTab) + ' opens ' + storeHours(shopTab) + ', every day';
      openSheet('shop', closedName, asleep() ? 'The shops can wait until morning' : 'Closed right now', 'storefront',
        '<div class="closedcard"><span class="ms">' + (asleep() ? 'nights_stay' : 'schedule') + '</span><b>' + (asleep() ? 'She is asleep.' : closedName + ' is closed right now.') + '</b><p>' + (asleep() ? 'Tap the bed to wake her, then come back.' : hoursLine + '. Your things are still yours; arranging the home works any time.') + '</p>' +
        (!asleep() && RW.ledger().owned.some(function (id) { var it = RW.item(id); return it && it.kind !== 'home'; }) ? '<div class="row"><button type="button" class="btn soft" id="arrangeBtn"><span class="ms">open_with</span>Arrange my home</button></div>' : '') + '</div>');
      /* your things stay yours when the shops are shut (Jamie, 20 Oct): the inventory shows with its place, wear and visit buttons; only buying waits */
      var lc = RW.ledger(), mine = RW.SHOP.filter(function (it) { return lc.owned.indexOf(it.id) > -1; });
      if (!asleep() && mine.length) body.insertAdjacentHTML('beforeend', '<p class="shelf"><span class="ms">inventory_2</span>Your things</p>' + shopList(mine, lc, currentHomeId()) + '<div class="msg" id="shopMsg"></div>');
      body.addEventListener('click', function (e) {
        if (e.target.closest('#arrangeBtn')) { enterArrange(); return; }
        var t = e.target.closest('[data-toggle]'), v = e.target.closest('[data-visit]'), hm = e.target.closest('[data-home]');
        try { if (t) shopAct('toggle', t.dataset.toggle, { sheet: true }); if (v) shopAct('visit', v.dataset.visit, { sheet: true }); if (hm) shopAct('home', hm.dataset.home, { sheet: true }); }
        catch (err) { var m = $('#shopMsg'); if (m) message(m, err.message, false); }
      });
      return;
    }
    var l = RW.ledger(), home = currentHomeId(), st = STORES[shopTab], street = shopTab === 'street';
    var testing = RW.tester && RW.tester(); if (testing) l = Object.assign({}, l, { hearts: 999999 });
    var items = street ? [] : RW.SHOP.filter(function (it) { return it.kind === shopTab; });
    var SHELVES = { treat: 'Treats', accessory: 'Accessories' };
    var nav = street
      ? '<div class="street">' + Object.keys(STORES).map(function (k) {
          var s = STORES[k], all = RW.SHOP.filter(function (it) { return it.kind === k; }), mine = all.filter(function (it) { return l.owned.indexOf(it.id) > -1; }).length;
          var openK = shopOpenNow(k); return '<button type="button" class="store' + (openK ? '' : ' closed') + '" data-tab="' + k + '"><img src="' + ART + s.img + '" alt=""><span><b>' + esc(storeName(k)) + '</b><small>' + s.blurb + ' · ' + all.length + (mine ? ' · ' + mine + ' yours' : '') + '</small><small class="hours">' + (openK ? 'Open now · ' : 'Closed · opens ') + esc(storeHours(k)) + '</small></span><span class="ms">chevron_right</span></button>';
        }).join('') + '</div>'
      : '<div class="streetnav"><button type="button" class="back" data-tab="street"><span class="ms">arrow_back</span>Dream Street</button><span class="heartsmini"><span class="ms fill">favorite</span>' + (testing ? '∞' : l.hearts) + '</span></div><p class="help">' + st.sub + '</p>';
    openSheet('shop', street ? 'Dream Street' : storeName(shopTab), street ? 'Three little shops. Hearts from logging pay for everything.' : st.tag + ' · ' + storeHours(shopTab), street ? 'storefront' : st.icon,
      (street ? '<div class="heartbar"><div class="big"><span class="ms fill">favorite</span>' + (testing ? '∞' : l.hearts) + '</div><p>' + l.earned + ' earned in total' + (l.streak ? ' · ' + l.streak + '-day streak' : '') + '. Sleep 10, period 10, symptoms 8, meals 6 (+2 per confirmed item), reflections 5, calm 2 per minute, everyday practice 5 (+10 the first time), +5 from day three of a streak.</p></div>' : '') +
      nav +
      (street ? '' : shopList(items, l, home) +
        (shopTab === 'pet' ? Object.keys(SHELVES).map(function (k) { var li = RW.SHOP.filter(function (it) { return it.kind === k; }); return li.length ? '<p class="shelf"><span class="ms">' + (k === 'treat' ? 'cookie' : 'checkroom') + '</span>' + SHELVES[k] + '</p>' + shopList(li, l, home) : ''; }).join('') : '')) +
      (shopTab === 'street' || shopTab === 'home' ? '<div class="nexthomes"><b>Growing next</b>' + NEXT_HOMES.map(function (n) { return '<div><span class="ms">' + n.icon + '</span><span><b>' + esc(n.name) + '</b><small>' + esc(n.note) + '</small></span></div>'; }).join('') + '</div>' : '') +
      (l.owned.some(function (id) { var it = RW.SHOP.filter(function (s) { return s.id === id; })[0]; return it && it.kind !== 'home'; }) ? '<div class="row"><button type="button" class="btn soft" id="arrangeBtn"><span class="ms">open_with</span>Arrange my home</button></div><p class="help">Drag pets and furniture anywhere; the bed, clock, calendar and the rest stay where they are so logging keeps working.</p>' : '') +
      '<div class="msg" id="shopMsg"></div>');
    body.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-tab]'); if (tb) { chime('tap'); openShop(tb.dataset.tab); return; }
      var b = e.target.closest('[data-buy]'), t = e.target.closest('[data-toggle]'), v = e.target.closest('[data-visit]'), hm = e.target.closest('[data-home]');
      try {
        if (b) shopAct('buy', b.dataset.buy, { sheet: true });
        if (t) shopAct('toggle', t.dataset.toggle, { sheet: true });
        if (v) shopAct('visit', v.dataset.visit, { sheet: true });
        if (hm) shopAct('home', hm.dataset.home, { sheet: true });
        if (e.target.closest('#arrangeBtn')) enterArrange();
      } catch (err) { message($('#shopMsg'), err.message, false); }
    });
  }
  /* One place for every Dream Street action: the store sheet uses it, and so do the walkable store interiors
   * (ovu-shops.js). opts.sheet re-opens the sheet afterwards; opts.go(layoutId, asVisit) replaces the plain
   * applyLayout when the caller wants its own fade. Throws the same messages as before when hearts are short. */
  function shopAct(action, id, opts) {
    opts = opts || {}; var again = function () { if (opts.sheet) openShop(); }, go = function (lid, asVisit) { if (opts.go) opts.go(lid, asVisit); else applyLayout(lid, asVisit); };
    if (action === 'buy') {
      /* one hours check for every way of buying: the sheet, the storefront cards and the interiors */
      if (asleep()) throw new Error('She is asleep. Tap the bed to wake her first.');
      var sit = RW.item(id); if (!shopOpenNow(storeTab(sit))) throw new Error(storeName(storeTab(sit)) + ' is closed now. Open ' + storeHours(storeTab(sit)) + '.');
      var it = RW.buy(id); chime('save', true);
      if (it.kind === 'home') { S.setState({ home: it.id }); closeSheet(); go(it.id, false); toast('Welcome home. ' + it.name + ' is yours!', 'cottage'); }
      else if (it.kind === 'treat') { toast(it.name + ' are in the cupboard. Tap a pet to give one.', 'cookie'); again(); }
      else if (it.kind === 'accessory') { toast(it.name + ' is in the drawer. Tap a pet, then Dress up.', 'checkroom'); again(); }
      else if (it.waiting) { toast(it.name + ' is yours and waits in the inventory: two pets at home at a time.', 'pets'); again(); }
      else { renderProps(); toast(it.name + ' is now in your home!' + (it.swapped && it.swapped.length ? ' ' + it.swapped.join(' and ') + ' went into storage; swap back any time.' : ''), 'favorite'); again(); }
      return it;
    }
    if (action === 'toggle') { var on = RW.toggle(id); renderProps(); again(); return on; }
    if (action === 'visit') { chime('tap'); closeSheet(); go(id, true); toast('Have a look around. Tap Back when you are done.', 'cottage'); return true; }
    if (action === 'home') { chime('tap'); S.setState({ home: id }); go(id, false); again(); toast(id !== 'room' ? 'Moved in.' : 'Back in your room.', 'home'); return true; }
    throw new Error('Unknown shop action ' + action);
  }
  $('#heartsChip').addEventListener('click', function () { chime('tap'); openShop(); });
  /* arrange mode: drag what you own; hotspots and the avatar pause until Done */
  function enterArrange() {
    arranging = true; hideSheet(); scene.classList.add('arranging');
    var vb = $('#visitBar'); vb.classList.add('on');
    vb.innerHTML = '<span class="ms">open_with</span><span>Drag to move. Tap one to turn it or put it away.</span><button type="button" id="arrReset"><span class="ms">restart_alt</span>Reset</button><button type="button" id="arrDone"><span class="ms">check</span>Done</button>';
    toast('Arranging. Drag anything you own.', 'open_with');
  }
  function exitArrange(reset) {
    hidePropCtl();
    if (reset) { var pp = S.state().propPos || {}; delete pp[L.id]; S.setState({ propPos: pp }); }
    arranging = false; scene.classList.remove('arranging'); applyLayout(L.id, !!visiting);
    toast(reset ? 'Back to the default arrangement.' : 'Saved your arrangement.', 'check_circle');
  }
  var owned = $('#ownedProps');
  owned.addEventListener('pointerdown', function (e) {
    if (!arranging || e.target.closest('.propctl')) return; var p = e.target.closest('.prop'); if (!p) return;
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
  function endPropDrag(e) {
    if (!dragProp) return; var d = dragProp; dragProp = null; d.el.classList.remove('lift');
    var moved = e && e.clientX !== undefined ? Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) : 99;
    if (moved < 6) { showPropCtl(d.el); return; } /* a tap, not a drag: offer turn and put away */
    var pp = S.state().propPos || {}; pp[L.id] = pp[L.id] || {}; pp[L.id][d.id] = Object.assign({}, pp[L.id][d.id] || {}, { x: Math.round(parseFloat(d.el.style.left) * 10) / 10, y: Math.round(parseFloat(d.el.style.top) * 10) / 10 }); S.setState({ propPos: pp });
    hidePropCtl();
  }
  /* turn (mirror) or put away a piece while arranging; put-away pieces wait in Dream Street */
  function hidePropCtl() { var c = $('#propCtl'); if (c) c.remove(); }
  function showPropCtl(el) {
    hidePropCtl(); var id = el.dataset.id, it = RW.SHOP.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var c = document.createElement('div'); c.id = 'propCtl'; c.className = 'propctl';
    c.style.left = el.style.left; c.style.top = 'calc(' + el.style.top + ' - ' + (el.offsetHeight / inner.offsetHeight * 100 + 1.5).toFixed(1) + '%)';
    c.innerHTML = '<b>' + esc(it.name) + '</b><button type="button" data-pc="flip" data-id="' + id + '"><span class="ms">flip</span>Turn</button><button type="button" data-pc="store" data-id="' + id + '"><span class="ms">inventory_2</span>Put away</button>';
    $('#ownedProps').appendChild(c); chime('tap');
  }
  owned.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pc]'); if (!b || !arranging) return; e.stopPropagation();
    var id = b.dataset.id, it = RW.SHOP.filter(function (x) { return x.id === id; })[0];
    if (b.dataset.pc === 'flip') { var pp = S.state().propPos || {}; pp[L.id] = pp[L.id] || {}; var cur = pp[L.id][id] || {}; pp[L.id][id] = Object.assign({}, cur, { flip: !cur.flip }); S.setState({ propPos: pp }); renderProps(); var el = $('#ownedProps .prop.owned[data-id="' + id + '"]'); if (el) showPropCtl(el); chime('tap'); }
    if (b.dataset.pc === 'store') { if (RW.ledger().placed[id]) RW.toggle(id); hidePropCtl(); renderProps(); chime('save'); toast((it ? it.name : 'It') + ' is back in your inventory. Place it again from the heart shop.', 'inventory_2'); }
  }, true);
  owned.addEventListener('pointerup', function (e) { if (e.target.closest('.propctl')) return; endPropDrag(e); }); owned.addEventListener('pointercancel', endPropDrag);

  /* ---------- Luna, the moon orb ---------- */
  var lunaLog = [];
  function openLuna(prefill, draft) {
    var cfg = ORB.aiConfig();
    openSheet('luna', 'Luna', 'Tell me how you are; I’ll write it down', 'dark_mode',
      '<div class="chat" id="chat"></div>' +
      '<div class="quick" id="quick">' + ['Slept 11pm to 7am, quality 4', 'Period started today, medium', 'Cramps and bloating, pain 5, mood ok', 'Had oats and a latte for breakfast', 'Meditated 10 min'].map(function (q) { return '<span class="qchip"><button type="button" class="qsend" data-q="' + esc(q) + '">' + esc(q) + '</button><button type="button" class="qpen" data-q="' + esc(q) + '" aria-label="Edit this shortcut before sending"><span class="ms">edit</span></button></span>'; }).join('') + '</div>' +
      '<div class="composer"><label class="btn soft lphoto" for="lunaPhoto" aria-label="Take or upload a food photo" title="Take or upload a food photo"><span class="ms">add_a_photo</span></label><input type="file" id="lunaPhoto" accept="image/*" hidden><textarea class="input" id="lunaIn" rows="3" maxlength="400" enterkeyhint="send" placeholder="e.g. slept badly, cramps 6/10, ate chicken rice">' + esc(prefill || '') + '</textarea><button type="button" class="btn primary" id="lunaSend" aria-label="Send"><span class="ms">send</span></button></div>' +
      '<details class="aibox" id="aibox"><summary><span class="ms">auto_awesome</span>' + (cfg.on ? 'Luna’s reading is on' : 'Luna’s reading is off · rules only') + infoBtn('luna') + '</summary>' + guideHTML('luna') +
      '<label class="perm"><input type="checkbox" id="aiInsights"' + (cfg.insights === true ? ' checked' : '') + '><span class="ms">menu_book</span><div><b>Write journal readings</b><span>Luna writes a short reading of your last 7 or 28 days.</span></div></label>' +
      '<label class="perm"><input type="checkbox" id="aiPhotos"' + (cfg.photos === true ? ' checked' : '') + '><span class="ms">photo_camera</span><div><b>Recognise food photos</b><span>Luna names the food in your photo. Only a small thumbnail is kept, on this phone.</span></div></label>' +
      '<div class="row"><button type="button" class="btn soft" id="aiSave"><span class="ms">save</span>Save</button><button type="button" class="btn ghost" id="aiToggle">' + (cfg.on ? 'Turn Luna’s reading off (rules only)' : 'Turn Luna’s reading on') + '</button></div><p>You always see what Luna understood before it is saved. These choices are also under Your choices in You.</p></details>');
    var chat = $('#chat');
    function bubble(kind, html) { var d = document.createElement('div'); d.className = 'bub ' + (kind === 'luna' ? 'from-luna' : kind); d.innerHTML = html; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d; }
    if (!lunaLog.length) bubble('luna', '<b>Luna</b>Hello' + (S.profile().name ? ', ' + esc(S.profile().name) : '') + '. Tell me about your sleep, your period, how you feel, what you ate, or a pause you took, or send a photo of your meal with the camera button. I will show you what I understood before saving.');
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
    /* Red flags are read on the device before any parsing or saving. The card is guidance, not a save:
     * the entries still go through the confirm card below it. */
    function urgentCard(u) {
      var emergency = u.level === 'emergency';
      /* a card that brings its own words and call links (thoughts of harming yourself or your baby: 995, SOS 1767, WhatsApp 9151 1767) */
      if (u.message) {
        var own = '<b>' + esc(u.title) + '</b><p>' + esc(u.message) + '</p><div class="row">' + (u.actions || []).map(function (a, i) { var web = /^https:/.test(a.href); return '<a class="btn ' + (i ? 'soft' : 'primary') + '" href="' + esc(a.href) + '"' + (web ? ' target="_blank" rel="noopener"' : '') + '><span class="ms">' + (web ? 'chat' : 'call') + '</span>' + esc(a.label) + '</a>'; }).join('') + '</div>' +
          '<small>Rhythme cannot assess how you are or diagnose. No clinician or helpline receives this alert.</small>';
        var ownCard = bubble('urgent emergency', own); remember('urgent emergency', own);
        try { chime('alert', true); } catch (err) { }
        return ownCard;
      }
      var html = '<b>' + esc(u.title) + '</b>' +
        (emergency
          ? '<p>' + esc(cap(u.trigger)) + ' needs medical assessment now. Go to the nearest emergency department, or KK Women’s and Children’s Hospital’s 24-hour Urgent O&amp;G Centre. Do not wait to finish logging. If pregnancy is possible, say so when you arrive.</p><p class="esc">Call 995 now if the bleeding is excessive or will not stop, you faint, have trouble breathing, or have chest pain.</p>'
          : '<p>Any bleeding after menopause should be checked by a clinician promptly. Book a GP or gynaecologist visit this week; it is usually not serious, but it needs a check.</p>') +
        '<div class="row">' + (emergency ? '<a class="btn primary" href="tel:995"><span class="ms">call</span>Call 995</a><a class="btn soft" href="https://www.kkh.com.sg/our-specialties/urgent-og-centre" target="_blank" rel="noopener"><span class="ms">local_hospital</span>KKH Urgent O&amp;G (24h)</a>' : '') + '<a class="btn ghost" href="journal.html"><span class="ms">medical_information</span>Show my chart</a></div>' +
        '<small>Rhythme cannot assess your condition or diagnose. This alert follows published guidance (KKH, SCDF, NHS). No clinician receives this alert.</small>';
      var card = bubble('urgent' + (emergency ? ' emergency' : ''), html); remember('urgent' + (emergency ? ' emergency' : ''), html);
      try { chime('alert', true); } catch (err) { }
      return card;
    }
    function send(text, again) {
      text = (text || '').trim(); if (!text) return;
      if (!again) { bubble('me', esc(text)); remember('me', esc(text)); $('#lunaIn').value = ''; }
      var u = ORB.urgent(text, S.profile()); if (u) urgentCard(u);
      var local = ORB.parseLocal(text), cfg2 = ORB.aiConfig(), aiOk = cfg2.on;
      /* Short canonical notes (the shortcut chips) are read by the rules instantly; longer or
       * unmatched notes go to the model first, and the rules stay as the offline fallback. */
      /* a note that only says there is no period is an observation the rules have read: it is not sent to the model */
      if (aiOk && (!local.length || text.length > 36) && !(!local.length && ORB.noPeriod && ORB.noPeriod(text))) {
        var thinking = bubble('luna', '<b>Luna</b>Reading your note…');
        ORB.parseAI(text).then(function (res) {
          thinking.remove();
          /* the rules have the last word on a note that says there is no bleeding: a period day the model read into it is dropped */
          if (ORB.noPeriod && ORB.noPeriod(text)) res.entries = res.entries.filter(function (e) { return e.type !== 'period'; });
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
      if (ORB.noPeriod && ORB.noPeriod(text)) { var np = '<b>Luna</b>Noted: no bleeding. Nothing was added to your period days.'; bubble('luna', np); remember('luna', np); return; }
      if (aiOk) { bubble('luna', '<b>Luna</b>I did not catch a sleep time, period, symptom, meal or practice in that. Try "slept 11pm to 7am", "period started, heavy", "cramps 6/10", "had chicken rice for lunch" or "meditated 10 min".'); return; }
      /* AI help is off: offer it just in time, saying where the note would go, and only send after a tap. */
      var ask = bubble('luna', '<b>Luna</b>I did not catch a sleep time, period, symptom, meal or practice in that. Try "slept 11pm to 7am", "cramps 6/10" or "had chicken rice for lunch".' +
        '<span class="jit">Or I can read it with my AI help. Your name is never added, and nothing is kept.</span>' +
        '<div class="row"><button type="button" class="btn primary" data-aion="1"><span class="ms">auto_awesome</span>Turn on and read it</button><button type="button" class="btn ghost" data-aino="1">Not now</button></div>');
      ask.querySelector('[data-aion]').addEventListener('click', function () {
        var c = ORB.aiConfig(); c.on = true; ORB.setAiConfig(c, 'jit'); /* recorded as a first-use grant of ai_reading */
        ask.remove(); send(text, true);
      });
      ask.querySelector('[data-aino]').addEventListener('click', function () { ask.querySelector('.row').remove(); });
    }
    /* the message box is a roomy textarea (Jamie, 19 Oct): it grows with the text up to six lines; Enter sends, Shift+Enter adds a line, and Enter that finishes an input-method word never sends */
    function fitIn() { var t = $('#lunaIn'); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 3, 168) + 'px'; }
    function sendIn() { send($('#lunaIn').value); setTimeout(fitIn, 0); }
    $('#lunaSend').addEventListener('click', sendIn);
    $('#lunaIn').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); sendIn(); } });
    $('#lunaIn').addEventListener('input', fitIn); fitIn();
    /* ---------- food photos ---------- */
    var byHand = '<div class="row"><button type="button" class="btn ghost" data-byhand="1"><span class="ms">menu_book</span>Log it by hand</button></div>';
    chat.addEventListener('click', function (e) { if (e.target.closest('[data-byhand]')) openDiary(); });
    $('#lunaPhoto').addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) photoFlow(f); });
    function askPhotos(f) {
      var ask = bubble('luna', '<b>Luna</b>To recognise the food I read this photo once with my AI help. Nothing is kept except a small thumbnail on this phone.' +
        '<div class="row"><button type="button" class="btn primary" data-allow="1"><span class="ms">photo_camera</span>Allow food photos</button><button type="button" class="btn ghost" data-byhand="1">Log it by hand</button></div>');
      ask.querySelector('[data-allow]').addEventListener('click', function () { var c = ORB.aiConfig(); c.photos = true; c.provider = c.provider || 'ovumind'; ORB.setAiConfig(c, 'jit'); ask.remove(); photoFlow(f); });
    }
    function photoFlow(f) {
      if (!ORB.photosAllowed()) { askPhotos(f); return; }
      Promise.all([FD.shrink(f, 1024), FD.shrink(f, 360)]).then(function (rs) {
        var big = rs[0].dataUrl, thumb = rs[1].dataUrl;
        bubble('me photo', '<img class="lphoto-img" src="' + thumb + '" alt="Your meal photo">'); remember('me', 'Sent a food photo.');
        var thinking = bubble('luna', '<b>Luna</b>Looking at your meal…');
        ORB.parsePhoto(big).then(function (res) {
          thinking.remove();
          if (!res.isFood || !res.items.length) { bubble('luna', '<b>Luna</b>I could not see food in that photo. Try a closer, brighter shot from above, or log it by hand.' + byHand); return; }
          foodCard(res, thumb);
        }).catch(function (err) { thinking.remove(); bubble('luna', '<b>Luna</b>' + esc(err.message) + byHand); });
      }).catch(function (err) { toast(err.message, 'error'); });
    }
    /* Says where the numbers on the card come from. The SG FoodID licence (s.11) asks for a conspicuous notice. */
    function foodNote(items) {
      var h = items.filter(function (it) { return it.source && it.source.kind === 'hpb'; }).length, n = items.length;
      var hpbLine = ' Contains information from the Singapore Food Insights Database (SG FoodID), Health Promotion Board, under <a href="https://pphtpc.hpb.gov.sg/web/sgfoodid" target="_blank" rel="noopener">its terms</a>.';
      if (!h) return 'Estimated from your photo by Luna. Hawker portions vary, so change the grams if they look off.';
      if (h === n) return (n === 1 ? 'This dish uses' : 'All ' + n + ' dishes use') + ' Health Promotion Board SG FoodID values for the grams shown. Hawker portions vary, so change the grams if they look off.' + hpbLine;
      return h + ' of ' + n + ' dishes use Health Promotion Board SG FoodID values; the rest are estimated from your photo by Luna. Change the grams if they look off.' + hpbLine;
    }
    function foodCard(res, thumb) {
      var hr = new Date().getHours(), meal = hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr >= 17 && hr < 22 ? 'dinner' : 'snack';
      var items = res.items.slice(), editing = false, card = bubble('confirm foodlog', '');
      function render() {
        var t = FD.sum(items).totals;
        card.innerHTML = '<h4><span class="ms">edit_note</span>Log for today</h4>' +
          '<div class="fl-head"><img src="' + thumb + '" alt=""><div><div class="fl-meals">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (m) { return '<button type="button" class="fl-meal' + (m === meal ? ' on' : '') + '" data-meal="' + m + '">' + cap(m) + '</button>'; }).join('') + '</div>' +
          '<b class="fl-kcal">About ' + FD.fmt('kcal', t.kcal) + ' kcal</b>' + (res.mealName ? '<small>' + esc(res.mealName) + '</small>' : '') + '</div></div>' +
          '<div class="fl-items">' + items.map(function (it, i) {
            var hpb = it.source && it.source.kind === 'hpb';
            var chip = '<i class="fl-src ' + (hpb ? 'hpb' : 'est') + '" title="' + esc(hpb ? it.source.ref + ' · ' + it.source.detail : 'Estimated from the photo by Luna') + '">' + (hpb ? 'HPB' : 'photo estimate') + '</i>';
            return '<div class="fl-item">' + (editing
              ? '<input class="input fl-name" data-name="' + i + '" value="' + esc(it.name) + '" aria-label="Food name"><label class="fl-g"><input class="input" type="number" inputmode="numeric" min="1" max="2000" data-grams="' + i + '" value="' + Math.round(it.grams || 0) + '" aria-label="Grams">' + (it.basis === '100ml' ? 'ml' : 'g') + '</label><button type="button" class="fl-x" data-x="' + i + '" aria-label="Remove ' + esc(it.name) + '"><span class="ms">close</span></button>'
              : '<div><b>' + esc(it.name) + '</b><span>' + esc(it.portionLabel) + (it.confidence === 'low' ? ' · not sure' : '') + ' ' + chip + '</span>' + (NV ? novaChip(NV.classify(it)) : '') + '</div>') +
              '<em>' + FD.fmt('kcal', it.nutrients.kcal) + ' kcal</em></div>';
          }).join('') + '</div>' +
          '<div class="fl-macros"><span><i class="d p"></i>Protein ' + FD.fmt('protein', t.protein) + ' g</span><span><i class="d c"></i>Carbs ' + FD.fmt('carb', t.carb) + ' g</span><span><i class="d f"></i>Fat ' + FD.fmt('fat', t.fat) + ' g</span></div>' +
          (NV ? novaBar(NV.share(items), '') : '') +
          '<p class="fl-note">' + foodNote(items) + '</p>' +
          '<div class="row"><button type="button" class="btn primary" data-act="save"><span class="ms">check</span>Save</button><button type="button" class="btn ghost" data-act="edit">' + (editing ? 'Done' : 'Edit') + '</button><button type="button" class="btn ghost" data-act="skip">Not now</button></div>';
      }
      render();
      card.addEventListener('click', function (e) {
        var m = e.target.closest('[data-meal]'), x = e.target.closest('[data-x]'), a = e.target.closest('[data-act]');
        if (m) { meal = m.dataset.meal; render(); return; }
        if (x) { items.splice(Number(x.dataset.x), 1); render(); return; }
        if (!a) return;
        if (a.dataset.act === 'edit') { editing = !editing; render(); return; }
        if (a.dataset.act === 'skip') { card.remove(); bubble('luna', '<b>Luna</b>Okay, nothing saved.'); return; }
        if (!items.length) { toast('Keep at least one food, or tap Not now.', 'info'); return; }
        var now = new Date(), sm = FD.sum(items);
        var ev = S.add('food', S.today(), { meal: meal, time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), foods: items.map(function (it) { return it.name; }).join(', '), notes: res.note || '', tags: [], items: items, photo: thumb, totals: sm.totals, method: 'luna-photo v1' }, 'luna');
        card.remove();
        var line = '<b>Luna</b>Saved your ' + meal + ', about ' + FD.fmt('kcal', sm.totals.kcal) + ' kcal. It is in your food diary, where you can change it any time.';
        bubble('luna', line); remember('luna', line); afterSave(ev, 'Meal saved from your photo.');
      });
      card.addEventListener('change', function (e) {
        var g = e.target.closest('[data-grams]'), n = e.target.closest('[data-name]');
        if (g) { var i = Number(g.dataset.grams); items[i] = ORB.regram(items[i], g.value); render(); }
        if (n) { var j = Number(n.dataset.name), v = n.value.trim(); if (v) { items[j] = ORB.rename(items[j], v); render(); } }
      });
    }
    $('#quick').addEventListener('click', function (e) {
      var pen = e.target.closest('.qpen'), go = e.target.closest('.qsend');
      if (pen) { var inp = $('#lunaIn'); inp.value = pen.dataset.q; fitIn(); inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (err) { } toast('Edit the numbers, then send.', 'edit'); return; }
      if (go) send(go.dataset.q);
    });
    $('#aiSave').addEventListener('click', function () { var c = ORB.aiConfig(); c.insights = $('#aiInsights').checked; c.photos = $('#aiPhotos').checked; ORB.setAiConfig(c, 'settings'); chime('save'); toast('Luna’s settings saved.', 'check_circle'); openLuna($('#lunaIn').value); });
    $('#aiToggle').addEventListener('click', function () { var c = ORB.aiConfig(); c.on = !c.on; ORB.setAiConfig(c, 'settings'); openLuna($('#lunaIn').value); });
    if (prefill && !draft) send(prefill);
  }
  $('#lunaBtn').addEventListener('click', function () { if (!awake('luna')) return; chime('tap'); $('#lunaBtn').classList.remove('hinting'); openLuna(); });

  /* ---------- yoga mat: mindfulness with Erin projected beside you ---------- */
  var meditating = false, session = null;
  function enterMeditation() { meditating = true; avatar.classList.add('hidden'); setTimeout(function () { meditator.classList.add('on'); $('#aura').classList.add('on'); }, 350); }
  function exitMeditation() { meditating = false; meditator.classList.remove('on'); $('#aura').classList.remove('on'); holo.classList.remove('on'); hud.classList.remove('on'); setTimeout(function () { avatar.classList.remove('hidden'); placeAvatar(HOME, false); avatar.classList.add('idle'); }, 300); }
  meditator.addEventListener('click', function () { if (current !== 'mind') openMindfulness(); });
  /* Erin's lines play on ONE audio element per session, created and first played inside the tap that began it: a fresh
   * element started from a promise chain is silent on the iPhone, which is why her voice came and went. A guard moves
   * the chain on if a clip stalls, so "breathe in" is always followed by "breathe out". */
  function playClip(name) {
    return new Promise(function (resolve) {
      if (!session || session.stopped) return resolve();
      caption(CAPTION[name] || '');
      var a = session.audio || (session.audio = new Audio()), done = false, guard = 0;
      var fin = function () { if (done) return; done = true; clearTimeout(guard); a.onended = a.onerror = null; resolve(); };
      a.onended = fin; a.onerror = fin;
      a.onloadedmetadata = function () { if (isFinite(a.duration) && a.duration > 0) { clearTimeout(guard); guard = setTimeout(fin, a.duration * 1000 + 1500); } };
      guard = setTimeout(fin, 12000);
      try { a.pause(); a.src = ERIN + name + '.mp3'; a.currentTime = 0; } catch (e) { }
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () { fin(); });
    });
  }
  function wait(ms) { return new Promise(function (resolve) { if (!session || session.stopped) return resolve(); session.timer = setTimeout(resolve, ms); }); }
  function setOrb(phase, text) { var o = $('#orb'), t = $('#orbText'); if (o) { o.className = 'orb ' + phase; if (text) t.textContent = text; } var ho = $('#hudOrb'); ho.className = 'hud-orb ' + phase; if (text) $('#hudLine').textContent = text; }
  function caption(text) { if (!text) return; $('#hudLine').textContent = text; var t = $('#orbText'); if (t) t.textContent = text; }
  function runSession(kind, minutes) {
    if (asleep()) { toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; }
    if (window.OvuPodcast) OvuPodcast.pause();
    session = { kind: kind, minutes: minutes, startedAt: Date.now(), stopped: false, audio: kind === 'erin' ? new Audio() : null, timer: null };
    hideSheet(); holo.classList.toggle('on', kind === 'erin'); hud.classList.add('on'); $('#hudTitle').textContent = kind === 'erin' ? 'With Erin' : 'Just breathe';
    var total = minutes * 60000, cycleMs = kind === 'erin' ? 11000 : 14000, hour = new Date().getHours();
    var today = S.today(), cramps = S.list('symptom', { from: today, to: today }).some(function (e) { return (e.data.symptoms || []).indexOf('cramps') > -1; }) || S.list('period', { from: today, to: today }).length > 0;
    var guides = ['guide_soften', 'guide_feet', 'guide_wander', 'guide_nothing_to_fix', 'guide_quiet_work'].concat(cramps ? ['guide_cramps'] : []);
    var p = Promise.resolve();
    if (kind === 'erin') {
      setOrb('hold', 'Hello'); p = playClip(hour >= 5 && hour < 12 ? 'greeting_morning' : hour >= 12 && hour < 17 ? 'greeting_welcome' : 'greeting_evening') /* never good morning after midnight (Jamie, 20 Oct) */ /* started inside the tap, which unlocks the element for every later line */
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
  $('#hudStop').addEventListener('click', function () { if (practice) stopPractice(); else if (hooks.hudStop && hooks.hudStop()) return; else stopSession(false); });
  /* ---------- Listen with Erin: Take A Pause, streamed from her own Substack ---------- */
  var POD = window.OvuPodcast;
  function podLabel(ep) { var n = POD.indexOf ? POD.indexOf(ep.id) : 0; return (n ? 'Episode ' + n + ' · ' : '') + Math.round(ep.durationSeconds / 60) + ' min'; }
  function fillPodShelf() {
    var el = $('#podShelf'); if (!el || !POD) return;
    POD.load().then(function () {
      var cs = S.cycleStats(), sug = POD.suggestFor(cs.mode === 'suspended' ? null : cs.phase), last = POD.lastId() && POD.episode(POD.lastId());
      var pick = last && POD.progress(last.id) && !POD.finished(last.id) ? last : sug;
      el.innerHTML = '<img src="assets/avatars/erin/erin-chibi.webp" alt="" class="podshelf-erin"><div><span class="lbl">Listen with Erin</span><b>' + esc(pick.title) + '</b><small>' + (pick === last ? 'Continue where you left off · ' : 'A starting point for today · ') + esc(podLabel(pick)) + '</small><div class="row" style="margin-top:6px"><button type="button" class="btn soft" data-pod-open="' + pick.id + '"><span class="ms">headphones</span>Listen</button><button type="button" class="btn ghost" data-pod-open="">All 19 episodes</button></div></div>';
    }).catch(function () { el.innerHTML = ''; });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pod-open]'); if (!b) return; chime('tap'); openListen(b.dataset.podOpen || null); });
  function openListen(selId) {
    if (!POD) return;
    if (current === 'mind' && !session && meditating) exitMeditation();
    POD.load().then(function (d) {
      var cs = S.cycleStats(), sug = POD.suggestFor(cs.mode === 'suspended' ? null : cs.phase), last = POD.lastId() && POD.episode(POD.lastId());
      if (selId) POD.select(selId); else if (!POD.state().ep) POD.select((last || sug).id);
      openSheet('erin-listen', 'Listen with Erin', 'Take A Pause, by Erin Lee', 'headphones',
        '<div class="erin small"><img src="assets/avatars/erin/erin-chibi-face.webp" alt="Erin Lee"><div><b>Erin Lee · certified MBSR teacher</b><small>Short talks on patience, kindness and balance, drawn from the Dhammapada. Put one on when the day feels loud.</small></div></div>' +
        '<div id="podPlayer"></div>' +
        (sug ? '<div class="podsug"><span class="ms">wb_twilight</span><span>' + (cs.phase && cs.mode !== 'suspended' ? 'A gentle pick for your ' + esc(cs.phase === 'late' ? 'luteal' : cs.phase) + ' days: ' : 'A gentle place to start: ') + '<button type="button" class="linkbtn" data-ep="' + sug.id + '">' + esc(sug.title) + '</button>. Choose anything that suits you.</span></div>' : '') +
        '<div class="field"><span class="lbl">All episodes</span><div class="podlist">' + d.episodes.map(podCard).join('') + '</div></div>' +
        '<p class="help">From <a href="' + esc(d.publication) + '" target="_blank" rel="noopener">Take A Pause by Erin Lee</a>. Each episode links to its post, where you can read Erin’s notes.</p>');
      renderPodPlayer();
      body.addEventListener('click', function (e) {
        var ep = e.target.closest('[data-ep]'); if (ep) { chime('tap'); POD.select(ep.dataset.ep); renderPodPlayer(); var pl = $('#podPlayer'); if (pl) pl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
        if (e.target.closest('#podPlay')) { POD.toggle(); return; }
        if (e.target.closest('#podBack')) { POD.skip(-15); return; }
        if (e.target.closest('#podFwd')) { POD.skip(15); return; }
        var sp = e.target.closest('[data-speed]'); if (sp) { POD.setSpeed(Number(sp.dataset.speed)); renderPodPlayer(); return; }
        var sl = e.target.closest('[data-sleep]'); if (sl) { var v = sl.dataset.sleep; POD.setSleep(v === 'off' ? null : v === 'end' ? 'end' : Number(v)); toast(v === 'off' ? 'Sleep timer off.' : v === 'end' ? 'Stops at the end of this episode.' : 'Stops in ' + v + ' minutes.', 'bedtime'); renderPodPlayer(); return; }
        if (e.target.closest('#podReflect')) { var q = POD.state().ep && POD.state().ep.question; openLuna(q ? 'Reflecting on Erin’s question, “' + q + '”: ' : 'After listening to Erin: ', true); return; }
      });
      body.addEventListener('input', function (e) { if (e.target.id === 'podSeek') POD.seekTo(Number(e.target.value) / 1000); });
    }).catch(function (err) { toast(err.message, 'error'); });
  }
  /* Rhythme Plus preview: access codes until purchases open (Codex review: say plainly it is a preview) */
  function openPlus() {
    if (!POD) return;
    POD.load().then(function (d) {
      var prem = d.episodes.filter(function (e) { return e.access === 'premium'; }), mins = Math.round(prem.reduce(function (a, e) { return a + e.durationSeconds; }, 0) / 60), on = POD.plusActive(), p = POD.plus();
      openSheet('rhythme-plus', 'Rhythme Plus', 'A preview, opened with an access code', 'auto_awesome',
        '<div class="plushero"><img src="assets/avatars/erin/erin-chibi.webp" alt=""><div><b>Erin’s full Take A Pause library</b><span>' + prem.length + ' more episodes, about ' + (mins >= 120 ? (Math.round(mins / 6) / 10) + ' hours' : mins + ' minutes') + ', on patience, honesty, kindness and steady effort, listened to right here in your room.</span></div></div>' +
        (on ? '<div class="flag info"><span class="ms">check_circle</span><div><b>Plus is on for this phone</b><span>Until ' + esc(new Date(p.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })) + '.</span></div></div><div class="row"><button type="button" class="btn soft" data-pod-open=""><span class="ms">headphones</span>Listen now</button><button type="button" class="btn ghost" id="plusRemove">Remove from this phone</button></div>'
          : '<div class="field"><label for="plusCode">I have an access code</label><div class="row" style="margin-top:0"><input class="input" id="plusCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="RHY-XXXXX-XXXXX-…"><button type="button" class="btn primary" id="plusGo" style="flex:0 0 auto;min-width:0"><span class="ms">lock_open</span>Unlock</button></div><div class="msg" id="plusMsg"></div></div>') +
        '<p class="help">Purchases are not open yet. During this preview, an access code from the Rhythme team opens Plus on this phone for 12 months from when you use it. If you clear this browser or change phones, ask the team for help.</p>' +
        '<p class="help">When you use a code, Rhythme’s service records that the code was used, with a scrambled form of your network address to stop misuse. Nothing from your diary is involved.</p>');
      if (on) { $('#plusRemove').addEventListener('click', function () { POD.removePlus(); chime('tap'); toast('Plus removed from this phone.', 'lock'); openPlus(); }); return; }
      var go = function () {
        var code = $('#plusCode').value.trim(); if (!code) { message($('#plusMsg'), 'Type or paste your code first.', false); return; }
        $('#plusGo').disabled = true; message($('#plusMsg'), 'Checking your code…', true);
        POD.redeem(code).then(function () { chime('save', true); toast('Rhythme Plus is on. Enjoy Erin’s full library.', 'auto_awesome'); openListen(POD.state().ep && POD.state().ep.id); })
          .catch(function (e) { $('#plusGo').disabled = false; message($('#plusMsg'), e.message, false); });
      };
      $('#plusGo').addEventListener('click', go); $('#plusCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-plus-open]')) { chime('tap'); openPlus(); } });
  function podCard(ep) {
    var pos = POD.progress(ep.id), pct = ep.durationSeconds ? Math.min(100, Math.round(pos / ep.durationSeconds * 100)) : 0, done = POD.finished(ep.id), sel = POD.state().ep && POD.state().ep.id === ep.id;
    var locked = ep.access === 'premium' && !POD.plusActive();
    return '<button type="button" class="podep' + (sel ? ' on' : '') + (locked ? ' locked' : '') + '" data-ep="' + ep.id + '"><i>' + (ep.number || '') + '</i><span><b>' + esc(ep.title) + (ep.access === 'premium' ? ' <em class="pluschip">Plus</em>' : '') + '</b><small>' + Math.round(ep.durationSeconds / 60) + ' min' + (ep.themes && ep.themes[0] ? ' · ' + esc(ep.themes[0].pali) : '') + (done ? ' · listened' : '') + '</small>' + (pct && !done ? '<em class="bar" style="--p:' + pct + '%"></em>' : '') + '</span><span class="ms">' + (locked ? 'lock' : done ? 'check_circle' : 'play_circle') + '</span></button>';
  }
  function renderPodPlayer() {
    var host = $('#podPlayer'), st = POD && POD.state(); if (!host || !st || !st.ep) return;
    var ep = st.ep, frac = st.duration ? st.time / st.duration : 0;
    host.innerHTML = '<div class="podplayer"><div class="podhead"><img src="' + esc(ep.cover || 'assets/avatars/erin/erin-chibi-face.webp') + '" alt="" onerror="this.src=\'assets/avatars/erin/erin-chibi-face.webp\'"><div><small>' + esc(podLabel(ep)) + '</small><b>' + esc(ep.title) + '</b><span>' + esc(ep.subtitle || '') + '</span></div></div>' +
      '<input type="range" class="mrange podseek" id="podSeek" min="0" max="1000" value="' + Math.round(frac * 1000) + '" aria-label="Position in the episode" style="--fill:' + (frac * 100).toFixed(1) + '%"><div class="podtimes"><span id="podT">' + POD.fmt(st.time) + '</span><span id="podD">-' + POD.fmt(Math.max(0, st.duration - st.time)) + '</span></div>' +
      (ep.access === 'premium' && !POD.plusActive() ? '<div class="pluslock"><span class="ms">lock</span><span><b>A Rhythme Plus episode</b>Unlock Erin’s full library to listen.</span><button type="button" class="btn primary" data-plus-open="1"><span class="ms">auto_awesome</span>Rhythme Plus</button></div>' : '') +
      '<div class="podctl' + (ep.access === 'premium' && !POD.plusActive() ? ' hidden' : '') + '"><button type="button" id="podBack" aria-label="Back 15 seconds"><span class="ms">replay</span><small>15</small></button><button type="button" class="big" id="podPlay" aria-label="' + (st.playing ? 'Pause' : 'Play') + '"><span class="ms">' + (st.playing ? 'pause' : 'play_arrow') + '</span></button><button type="button" id="podFwd" aria-label="Forward 15 seconds"><span class="ms">forward_media</span><small>15</small></button></div>' +
      '<div class="podopts"><span class="lbl">Speed</span><div class="chips">' + [0.75, 1, 1.25, 1.5].map(function (r) { return '<button type="button" class="chipbtn' + (Math.abs(st.speed - r) < 0.01 ? ' on' : '') + '" data-speed="' + r + '">' + r + '×</button>'; }).join('') + '</div><span class="lbl">Sleep timer</span><div class="chips">' + [['off', 'Off'], ['10', '10 min'], ['20', '20 min'], ['30', '30 min'], ['end', 'End of episode']].map(function (o) { var on = (o[0] === 'off' && !st.sleep) || (o[0] === 'end' && st.sleep === 'end'); return '<button type="button" class="chipbtn' + (on ? ' on' : '') + '" data-sleep="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      (ep.themes && ep.themes.length ? '<div class="podthemes">' + ep.themes.map(function (t) { return '<span class="slotchip">' + esc(t.name) + ' · ' + esc(t.pali) + '</span>'; }).join('') + '</div>' : '') +
      (ep.quote ? '<blockquote class="podquote">' + esc(ep.quote) + '</blockquote>' : '') +
      '<div class="row"><button type="button" class="btn soft" id="podReflect"><span class="ms">dark_mode</span>' + (ep.question ? 'Reflect with Luna' : 'Tell Luna how it felt') + '</button></div>' +
      (ep.question ? '<p class="help">Erin asks: “' + esc(ep.question) + '”</p>' : '') + '</div>';
    $$('.podep', body).forEach(function (b) { b.classList.toggle('on', b.dataset.ep === ep.id); });
  }
  function updatePodMini() {
    var m = $('#podMini'), st = POD && POD.state(); if (!m || !st) return;
    var show = !!st.ep && !current && (st.playing || st.time > 1);
    m.hidden = !show; if (!show) return;
    $('#podMiniTitle').textContent = st.ep.title; $('#podMiniSub').textContent = POD.fmt(st.time) + ' / ' + POD.fmt(st.duration) + ' · Erin Lee';
    $('#podMiniPlay').innerHTML = '<span class="ms">' + (st.playing ? 'pause' : 'play_arrow') + '</span>'; $('#podMiniPlay').setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
  }
  if (POD) POD.on(function (type, st) {
    if (current === 'erin-listen') {
      if (type === 'time') { var sk = $('#podSeek'); if (sk && document.activeElement !== sk && st.duration) { sk.value = Math.round(st.time / st.duration * 1000); sk.style.setProperty('--fill', (st.time / st.duration * 100).toFixed(1) + '%'); } var t1 = $('#podT'), t2 = $('#podD'); if (t1) t1.textContent = POD.fmt(st.time); if (t2) t2.textContent = '-' + POD.fmt(Math.max(0, st.duration - st.time)); }
      else renderPodPlayer();
    }
    if (type === 'blocked') toast('Tap play once more to start the episode.', 'play_circle');
    if (type === 'locked') openPlus();
    if (type === 'preparing') toast('Getting the episode ready…', 'hourglass_top');
    if (type === 'plus' && current === 'erin-listen') openListen(st.ep && st.ep.id);
    if (type === 'error') toast('This episode will not play right now. Try again in a little while.', 'error');
    if (type === 'ended') toast('Episode finished. Take a breath before the next thing.', 'self_improvement');
    if (type === 'sleep') toast('Sleep timer: paused.', 'bedtime');
    updatePodMini();
  });
  (function wireMini() {
    var m = $('#podMini'); if (!m) return;
    $('#podMiniOpen').addEventListener('click', function () { chime('tap'); openListen(); });
    $('#podMiniPlay').addEventListener('click', function () { POD.toggle(); });
    $('#podMiniClose').addEventListener('click', function () { POD.pause(); m.hidden = true; });
  })();

  function openMindfulness() {
    if (session) { hud.classList.add('on'); return; }
    var recent = S.list('mindfulness', { from: S.addDays(S.today(), -6), to: S.today() }), mins = recent.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0);
    enterMeditation();
    setTimeout(fillPodShelf, 0);
    /* what fits now: the hour, today's cycle and this week's practice choose one suggestion; everything else is one tap away */
    var hr = new Date().getHours(), cs = S.cycleStats(), today = S.today();
    var crampy = S.list('symptom', { from: today, to: today }).some(function (e) { return (e.data.symptoms || []).indexOf('cramps') > -1; }) || S.list('period', { from: today, to: today }).length > 0;
    var sessions = recent.length, days = {}; recent.forEach(function (e) { days[e.date] = 1; });
    var sug = hr >= 20 || hr < 5 ? { t: 'Tonight: wind down', s: 'Two quiet minutes with the orb, then bed.', kind: 'breathe', min: 2, icon: 'bedtime' }
      : crampy ? { t: 'Today: ease the cramps', s: 'Three minutes with Erin, then the pressure points.', kind: 'erin', min: 3, icon: 'spa' }
      : hr < 11 ? { t: 'This morning: start slow', s: 'Three guided minutes before the day picks up.', kind: 'erin', min: 3, icon: 'wb_twilight' }
      : !mins ? { t: 'This week: a first pause', s: 'Erin guides three minutes. Nothing to get right.', kind: 'erin', min: 3, icon: 'self_improvement' }
      : { t: 'This afternoon: a reset', s: 'Five silent minutes, follow the orb.', kind: 'breathe', min: 5, icon: 'light_mode' };
    var last = S.list('mindfulness', { from: S.addDays(today, -30), to: today }).slice(-3).reverse();
    function label(e) { var k = e.data.kind; return k === 'erin' ? 'With Erin' : k === 'breathe' ? 'Just breathe' : k === 'breathtap' ? 'Koi Pond' : k === 'garden' ? 'Garden watering' : k === 'informal' ? 'Everyday practice' : 'Practice'; }
    openSheet('mind', 'Your mat', 'Erin appears beside you while you practise', 'self_improvement',
      '<div class="podshelf" id="podShelf"></div>' +
      '<div class="matnow"><span class="ms">' + sug.icon + '</span><div><b>' + esc(sug.t) + '</b><small>' + esc(sug.s) + '</small></div><button type="button" class="btn primary" data-kind="' + sug.kind + '" data-min="' + sug.min + '">Start</button></div>' +
      '<div class="mattiles">' +
        '<button type="button" class="mattile" data-kind="erin" data-min="3"><span class="ms">record_voice_over</span><b>With Erin</b><small>3 min, guided</small></button>' +
        '<button type="button" class="mattile" data-kind="erin" data-min="6"><span class="ms">record_voice_over</span><b>With Erin</b><small>6 min, longer settle</small></button>' +
        '<button type="button" class="mattile" data-kind="breathe" data-min="2"><span class="ms">blur_circular</span><b>Just breathe</b><small>2 min, 4-4-6 with a bell</small></button>' +
        '<button type="button" class="mattile" data-kind="breathe" data-min="5"><span class="ms">blur_circular</span><b>Just breathe</b><small>5 min, silent</small></button>' +
        '<button type="button" class="mattile" id="mindTap"><span class="ms">water_drop</span><b>Koi Pond</b><small>Tap the water, the koi come, 3 to 5 min</small></button>' +
        '<button type="button" class="mattile" id="mindEveryday"><span class="ms">home</span><b>Everyday practice</b><small>Teeth, tea, dishes, plants</small></button>' +
        '<button type="button" class="mattile" id="mindAcu"><span class="ms">spa</span><b>Cramp relief points</b><small>Pressure points on your body</small></button>' +
      '</div>' +
      '<div class="matweek"><span><b>' + Math.round(mins) + '</b> min this week</span><span><b>' + sessions + '</b> ' + (sessions === 1 ? 'session' : 'sessions') + '</span><span><b>' + Object.keys(days).length + '</b> ' + (Object.keys(days).length === 1 ? 'day' : 'days') + '</span></div>' +
      (last.length ? '<ul class="matlast">' + last.map(function (e) { return '<li><span>' + esc(label(e)) + '</span><small>' + esc(e.date === today ? 'Today' : S.fmtDate ? S.fmtDate(e.date) : e.date) + ' · ' + (Math.round((Number(e.data.minutes) || 0) * 10) / 10) + ' min</small></li>'; }).join('') + '</ul>' : '') +
      '<div class="erin small"><img src="assets/avatars/erin/erin-chibi-face.webp" alt="Erin Lee"><div><b>Erin Lee · certified MBSR teacher</b><small>Her projection sits beside you on the mat and speaks in her own voice, pre-recorded with her consent, so it works offline.</small></div></div>' +
      '<p class="help">Sessions of a minute or more are saved to your journal.</p>');
    body.addEventListener('click', function (e) { var b = e.target.closest('[data-kind][data-min]'); if (!b || session) return; chime('tap'); runSession(b.dataset.kind, Number(b.dataset.min)); });
    $('#mindAcu').addEventListener('click', openAcupressure);
    $('#mindEveryday').addEventListener('click', function () { openEveryday(); });
    $('#mindTap').addEventListener('click', function () { if (!window.OvuBreathTap) return; if (asleep()) { toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; } chime('tap'); hideSheet(); OvuBreathTap.open({ pet: window.OvuMascot ? OvuMascot.src(null, false) : null, onSaved: function (ev) { afterSave(ev); }, onClose: function () { renderDeck(); } }); });
  }

  /* ---------- acupressure: numbered points on your avatar, then a zoomed locator ---------- */
  var acuData = null;
  /* region illustrations (Seedream, 18 Oct) and where each point sits on them, percent of the image */
  var ACU_REGIONS = {
    belly: { img: 'belly', title: 'Lower belly', pts: { cv6: [[50.5, 64]], cv4: [[50.5, 76]], cv3: [[50.5, 84]], st29: [[36, 84], [65, 84]] } },
    innerleg: { img: 'innerleg', title: 'Inner lower leg', pts: { sp6: [[54, 61]], ki3: [[59.5, 74.5]], sp10: [] } },
    outerleg: { img: 'outerleg', title: 'Outer lower leg', pts: { st36: [[47, 42]] } },
    foot: { img: 'foot', title: 'Top of the foot', pts: { lr3: [[45.5, 45]] } },
    hand: { img: 'hand', title: 'Back of the hand', pts: { li4: [[42, 61]] } },
    forearm: { img: 'forearm', title: 'Inner forearm, palm up', pts: { pc6: [[50, 52]] } },
    back: { img: 'back', title: 'Lower back', pts: { bl23: [[44, 43], [56, 43]], gv4: [[50, 43]] } }
  };
  var ACU_ORDER = ['belly', 'innerleg', 'outerleg', 'foot', 'hand', 'forearm', 'back'];
  /* one badge per body region on the small avatar, so the markers never crowd */
  var ACU_BADGE = { belly: [50, 70], innerleg: [51, 93], outerleg: [39, 87], foot: [44, 99], hand: [71, 75], forearm: [69, 68.5] };
  var ACU_FIND = {
    sp6: 'Find the bump of your inner ankle. Lay four fingers flat above it; the point is level with your top finger, just behind the shin bone.',
    cv6: 'Two finger-widths straight below your navel, on the midline.',
    cv4: 'Four finger-widths below your navel, on the midline.',
    cv3: 'On the midline, one thumb-width above the top edge of the pubic bone (about four finger-widths plus a thumb below the navel).',
    st29: 'Level with CV3, three finger-widths either side of the midline.',
    st36: 'Find the dip just below the outer edge of the kneecap. Go four finger-widths down and one finger-width outward from the shin bone.',
    sp10: 'Sit with the knee bent. Two thumb-widths above the top inner corner of the kneecap, on the bulge of the thigh muscle. The picture hides this spot under the shorts, so use the steps.',
    ki3: 'In the hollow between the inner ankle bone and the Achilles tendon, level with the tip of the bone.',
    lr3: 'Slide a finger up from the web between the big toe and the second toe. Stop in the soft dip just before the two long bones join.',
    li4: 'Press the thumb against the index finger; the point is the highest spot of the mound on the back of the hand, toward the index-finger bone.',
    pc6: 'Three finger-widths above the inner wrist crease, between the two tendons you feel when you make a fist.',
    bl23: 'At waist level, two finger-widths either side of the spine. The exact level is hard to find on yourself; the marker shows the area.',
    gv4: 'On the spine at waist level, in a small dip between two bones. The exact spot is hard to find on yourself; the marker shows the area.'
  };
  /* What each point is for, kept apart: what tradition says and what research has shown (Codex source review, 18 Oct 2026). */
  var ACU_USE = {
    sp6: ['Period cramps', 'Small studies suggest pressing or needling it may ease period pain; the evidence is limited.', ['E25', 'E19']],
    cv6: ['Lower-belly comfort during periods', 'Often chosen in needle and heat-therapy trials; a benefit from pressing it yourself is not established.', ['E26', 'E27']],
    cv4: ['Lower-belly comfort during periods', 'Often chosen in needle and heat-therapy trials; a benefit from pressing it yourself is not established.', ['E26', 'E27']],
    cv3: ['Lower-belly discomfort around periods', 'Traditional use only; there is little direct research.', ['E27']],
    st29: ['Period discomfort', 'Traditional use only; it has not been shown to make periods regular.', ['E27']],
    sp10: ['Period discomfort', 'Traditional use only; it has not been shown to change circulation or cycle regularity.', ['E27']],
    ki3: ['Low-back ache', 'Traditional use only; a benefit from pressing it alone is not established.', ['E28']],
    lr3: ['Period cramps', 'Small acupressure studies suggest possible relief from period cramps.', ['E29']],
    li4: ['Headache and general pain', 'Traditional use, with modest expectations; in period-pain studies it is usually combined with other points.', ['E30']],
    pc6: ['Nausea', 'Wrist PC6 stimulation may help prevent nausea and vomiting after surgery (low confidence). It has not been shown to help travel sickness.', ['E31', 'E34']],
    st36: ['Digestion and tiredness', 'Traditional use; relief of digestion or everyday tiredness is not confirmed by research.', ['E28']],
    bl23: ['Low-back discomfort', 'Traditional use; one small trial after childbirth, so direct evidence is limited.', ['E32', 'E28']],
    gv4: ['Low-back ache', 'Traditional use only; a benefit from pressing it yourself is not established.', ['E28']]
  };
  function acuRefs(ids) { return ids.map(function (id) { var e = window.OvuEvidence && OvuEvidence.get(id); return e ? '<a href="evidence.html#' + id + '" target="_blank" rel="noopener">' + esc(e.short) + ' <i>' + id + '</i></a>' : ''; }).join(''); }
  function regionOf(id) { var r = null; Object.keys(ACU_REGIONS).forEach(function (k) { if (ACU_REGIONS[k].pts[id]) r = k; }); return r; }
  function openAcupressure() {
    if (current !== 'mind' && meditating && !session) exitMeditation();
    (acuData ? Promise.resolve(acuData) : loadJSON('assets/data/acupoints.json').then(function (d) { acuData = d; return d; })).then(function (d) {
      var byId = {}; d.points.forEach(function (p) { byId[p.id] = p; });
      var order = []; ACU_ORDER.forEach(function (rk) { Object.keys(ACU_REGIONS[rk].pts).forEach(function (id) { if (byId[id] && order.indexOf(id) < 0) order.push(id); }); });
      var num = {}; order.forEach(function (id, k) { num[id] = k + 1; });
      openSheet('acu', 'Cramp relief points', 'Numbered on you, then zoomed in so you can find them', 'spa',
        '<p class="help">Tap a number. Use a thumb or fingertip, press gently for one to two minutes on each side, breathe slowly, and stop if anything hurts. An educational atlas, not a treatment plan. ' + infoBtn('acu') + '</p>' + guideHTML('acu') +
        '<div class="acuwrap"><div class="acufig"><img src="' + ART + 'avatar-base.webp" alt="Your avatar, standing">' + ACU_ORDER.filter(function (rk) { return ACU_BADGE[rk]; }).map(function (rk) { var ids = Object.keys(ACU_REGIONS[rk].pts).filter(function (id) { return byId[id]; }); if (!ids.length) return ''; var ns = ids.map(function (id) { return num[id]; }); var lab = ns.length > 1 ? ns[0] + '–' + ns[ns.length - 1] : String(ns[0]); return '<button type="button" class="pt range" data-region="' + rk + '" data-pt="' + ids[0] + '" style="left:' + ACU_BADGE[rk][0] + '%;top:' + ACU_BADGE[rk][1] + '%" aria-label="' + esc(ACU_REGIONS[rk].title + ', points ' + lab) + '">' + lab + '</button>'; }).join('') + '</div>' +
        '<div class="aculist" id="aculist">' + ACU_ORDER.map(function (rk) { var ids = Object.keys(ACU_REGIONS[rk].pts).filter(function (id) { return byId[id]; }); if (!ids.length) return ''; return '<h5>' + esc(ACU_REGIONS[rk].title) + '</h5>' + ids.map(function (id) { return '<button type="button" data-pt="' + id + '"><i>' + num[id] + '</i><span><b>' + esc(byId[id].code) + ' · ' + esc(byId[id].name) + '</b><small>' + esc(byId[id].kind === 'abdomen' ? 'below the navel' : byId[id].kind) + (ACU_CAUTION[id] ? ' · ask first if pregnant' : '') + '</small>' + (ACU_USE[id] ? '<em>For: ' + esc(ACU_USE[id][0]) + '</em>' : '') + '</span></button>'; }).join(''); }).join('') + '</div></div>' +
        '<div class="locator" id="locator"></div>');
      function show(id) {
        var p = byId[id]; if (!p) return; var rk = regionOf(id), R = ACU_REGIONS[rk];
        $$('[data-pt]', body).forEach(function (b) { b.classList.toggle('on', b.dataset.region ? b.dataset.region === rk : b.dataset.pt === id); });
        $('#locator').innerHTML = '<div class="zoom"><img src="assets/room/acu/' + R.img + '.webp" alt="' + esc(R.title) + '">' + R.pts[id].map(function (xy) { return '<i class="mark' + (ACU_CAUTION[id] ? ' caution' : '') + '" style="left:' + xy[0] + '%;top:' + xy[1] + '%"></i>'; }).join('') + '<span class="ztitle">' + num[id] + ' · ' + esc(p.code) + ' · ' + esc(R.title.toLowerCase()) + '</span></div>' +
          '<div class="txt"><h3>' + esc(p.code) + ' · ' + esc(p.name) + '<small>' + esc(p.cn) + ' · ' + esc(p.channel) + '</small></h3>' +
          '<div class="find"><span class="ms">touch_app</span><span>' + esc(ACU_FIND[id] || p.location) + (p.bilateral ? ' Both sides.' : '') + '</span></div>' +
          (ACU_USE[id] ? '<div class="acuuse"><div><span class="ms">favorite</span><span><b>Traditionally used for</b>' + esc(ACU_USE[id][0]) + '</span></div><div><span class="ms">science</span><span><b>What research says</b>' + esc(ACU_USE[id][1]) + '</span></div><p class="evrefs">' + acuRefs(ACU_USE[id][2]) + '</p></div>' : '') +
          '<div class="how"><div><span class="ms">touch_app</span>Thumb or fingertip</div><div><span class="ms">timer</span>1 to 2 minutes</div><div><span class="ms">air</span>Slow breaths</div></div>' + (ACU_CAUTION[id] ? '<div class="warn">' + esc(ACU_CAUTION[id]) + '</div>' : '') +
          '<div class="fingerkey"><b>Measure with your own hand</b><div><span><i>1</i>thumb-width</span><span><i>2</i>finger-widths</span><span><i>3</i>finger-widths</span><span><i>4</i>finger-widths</span></div><small>Your own fingers fit your own body, so the distances work for any size. The pink dot shows the area; press around it until you find a slightly tender spot. Location checked against the WHO standard (2008), p. ' + p.whoPage + '.</small></div></div>';
        $('#locator').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      body.addEventListener('click', function (e) { var b = e.target.closest('[data-pt]'); if (b) { chime('tap'); show(b.dataset.pt); } });
      show('sp6');
    }).catch(function (e) { toast('Could not load the atlas: ' + e.message, 'error'); });
  }

  /* ---------- a livelier avatar: micro-moments between taps ---------- */
  var lifeTimer = null, lifeBusy = false;
  /* Jamie, 18 Oct: no random moments. The avatar keeps her outfit and pose until she is asked to do something. */
  var LIFE_MOMENTS = false;
  function scheduleLife() { clearTimeout(lifeTimer); if (reduced || !LIFE_MOMENTS) return; lifeTimer = setTimeout(lifeMoment, 12000 + Math.random() * 14000); }
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
  /* one audio element per practice, first played inside the tap that began it (see playClip): later lines reuse it, and a
   * guard moves the script on if a clip stalls or is missing, so the captions and bells never wait on silence */
  function playUrl(url) {
    return new Promise(function (resolve) {
      if (!practice || practice.stopped) return resolve();
      var a = practice.audio || (practice.audio = new Audio()), done = false, guard = 0;
      var fin = function () { if (done) return; done = true; clearTimeout(guard); a.onended = a.onerror = null; resolve(); };
      a.onended = fin; a.onerror = fin;
      a.onloadedmetadata = function () { if (isFinite(a.duration) && a.duration > 0) { clearTimeout(guard); guard = setTimeout(fin, Math.max(0, a.duration - a.currentTime) * 1000 + 1500); } };
      guard = setTimeout(fin, 20000);
      if (practice.pre === url) { practice.pre = null; if (a.error || a.ended) fin(); else if (isFinite(a.duration) && a.duration > 0) { clearTimeout(guard); guard = setTimeout(fin, Math.max(0, a.duration - a.currentTime) * 1000 + 1500); } return; } /* already playing from the tap */
      try { a.pause(); a.src = url; a.currentTime = 0; } catch (e) { }
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () { fin(); });
    });
  }
  function pwait(ms) { return new Promise(function (resolve) { if (!practice || practice.stopped) return resolve(); practice.timer = setTimeout(resolve, ms); }); }
  /* Pose and outfit images include their props (a watering can, a pillow, a wardrobe), so each one is
   * scaled by how wide the girl's head is in it: [image width relative to her head, her centre as a
   * fraction of the image]. Her head, and so her size, stays the same in every pose. */
  var AVATAR_FIT = {'act-bed':[1.551,0.643],'act-coffee':[1.14,0.563],'act-dishes':[1.523,0.634],'act-outfit':[1.559,0.684],'act-pets':[1.089,0.533],'act-plants':[1.428,0.654],'act-shower':[1.209,0.543],'act-stretch':[1.187,0.479],'act-teeth':[1.165,0.576],'base':[1.0,0.509],'cozy':[1.0,0.513],'kebaya-blue':[1.236,0.417],'kebaya-green':[1.0,0.509],'kebaya-red':[1.233,0.414],'pajamas':[1.0,0.513],'party':[1.088,0.549],'sundress':[1.0,0.513],'yoga':[1.0,0.513]};
  function fitAvatar() {
    var m = /avatar-([a-z0-9-]+)\.webp/.exec(avatarImg.src || ''), f = m && AVATAR_FIT[m[1]]; if (!f) f = [1, 0.5];
    avatarImg.style.width = (f[0] * 100).toFixed(2) + '%'; avatarImg.style.maxWidth = 'none';
    avatarImg.style.marginLeft = ((0.5 - f[1] * f[0]) * 100).toFixed(2) + '%';
    avatarImg.style.transformOrigin = (f[1] * 100).toFixed(1) + '% 100%';
  }
  avatarImg.addEventListener('load', fitAvatar); if (avatarImg.complete) fitAvatar();
  /* a pose is drawn in what she is wearing (Jamie, 19 Oct: "it cannot be changing outfit while watering"); the shower robe and
   * the stretch's yoga set are that activity's own clothes, so those two keep their one sprite. A missing file falls back to
   * the original pose */
  var OUTFIT_POSES = { plants: 1, coffee: 1, teeth: 1, dishes: 1, pets: 1, bed: 1, outfit: 1 };
  function poseSrc(pose, outfit) { return ART + 'avatar-act-' + pose + (OUTFIT_POSES[pose] && outfit && outfit !== 'base' ? '-' + outfit : '') + '.webp'; }
  function setPose(pose) {
    var want = poseSrc(pose, S.profile().outfit || 'base'), plain = poseSrc(pose, 'base'), img = new Image();
    img.onload = function () { avatarImg.src = img.src; };
    img.onerror = function () { if (img.src.indexOf(plain) < 0) img.src = plain; };
    img.src = want;
  }
  function restorePose() { setOutfit(S.profile().outfit || 'base', true); }
  function openEveryday(selId) {
    var ex = MF.explored();
    openSheet('everyday', 'Everyday mindfulness', 'Guides for things you are really doing', 'self_improvement',
      '<div class="erin small"><img src="assets/avatars/erin/erin-chibi-face.webp" alt="Erin Lee"><div><b>Informal practice, with Erin</b><small>Pick what you are about to do for real, press Begin as you start, and let the guide walk alongside you. The guides are spoken in Erin’s voice from interim scripts; her own written scripts will replace them one by one.</small></div></div>' +
      '<div class="acts" id="acts">' + MF.ACTIVITIES.map(function (a) { var n = ex[a.id] || 0; return '<button type="button" class="act' + (selId === a.id ? ' on' : '') + '" data-act="' + a.id + '"><img src="' + ART + 'avatar-act-' + a.pose + '.webp" alt=""><span><b>' + esc(a.name) + '</b><small>' + esc(a.when) + ' · ' + a.minutes + ' min</small></span><em>' + (n ? '<span class="ms">check_circle</span>' + n : '<span class="ms fill">favorite</span>15') + '</em></button>'; }).join('') + '</div>' +
      '<div class="actdetail" id="actDetail"></div>' +
      '<p class="help">Each completed practice earns 2 hearts, up to 6 a day. The point is not the points: it is two ordinary minutes, fully lived. Please only confirm practices you really did.</p>');
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
    if (asleep()) { toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; }
    var a = MF.byId(id); if (!a || practice) return; var v = a.variations[vi] || a.variations[0]; vi = a.variations.indexOf(v);
    if (window.OvuPodcast) OvuPodcast.pause();
    practice = { a: a, vi: vi, v: v, startedAt: Date.now(), stopped: false, audio: new Audio(), timer: null, total: MF.totalSecs(v), pre: null };
    try { var first = GUIDE + id + '-' + vi + '-0.mp3'; practice.audio.src = first; practice.pre = first; var pr0 = practice.audio.play(); if (pr0 && pr0.catch) pr0.catch(function () { }); } catch (e) { } /* the first line starts inside the tap, which unlocks the element for the rest */
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

  /* ---------- Rhythme welcome + getting to know you (in the room, so the theme never changes) ---------- */
  var ONB = [
    { id: 'agerange', icon: 'cake', pose: 'coffee', title: 'Your age range (optional)', sub: 'Only so the notes stay honest about what is typical at different ages. Skip if you prefer; Rhythme is for adults and never asks your date of birth.', type: 'chips', key: 'ageRange', optional: true, options: [['18-24', '18–24'], ['25-29', '25–29'], ['30-34', '30–34'], ['35-39', '35–39'], ['40-44', '40–44'], ['45-49', '45–49'], ['50+', '50 and over']] },
    { id: 'regular', icon: 'calendar_month', pose: 'stretch', title: 'Your periods', sub: 'Pick what fits best. If you are pregnant or past menopause, choose the closest; you can change it later.', type: 'rows', rows: [{ key: 'regularity', label: 'How regular', options: [['regular', 'Fairly regular'], ['irregular', 'Irregular'], ['rare', 'Rare, with gaps of 3 months or more'], ['none12', 'No period for 12 months or more'], ['notyet', 'My periods haven’t started yet'], ['unsure', 'Not sure']] }, { key: 'menarche', label: 'Age at your first period (optional)', options: [['lt10', 'Under 10'], ['10-12', '10–12'], ['13-15', '13–15'], ['16+', '16 or older'], ['unknown', 'Don’t remember']], showIf: function (A) { return !!A.regularity && A.regularity !== 'notyet'; } }] },
    { id: 'preg', icon: 'pregnant_woman', pose: 'plants', title: 'Pregnancy and plans', sub: 'These change how dates should be read.', type: 'rows', rows: [{ key: 'pregState', label: 'Right now', options: [['none', 'None of these'], ['maybe', 'I could be pregnant'], ['pregnant', 'Pregnant'], ['postpartum', 'Gave birth in the last year'], ['loss', 'Recent pregnancy loss']] }, { key: 'breastfeeding', label: 'Breastfeeding', options: [['yes', 'Yes'], ['no', 'No']], showIf: function (A) { return A.pregState === 'postpartum'; } }, { key: 'periodsBack', label: 'Have periods returned?', options: [['yes', 'Yes'], ['no', 'Not yet']], showIf: function (A) { return A.pregState === 'postpartum'; } }, { key: 'plans', label: 'Plans', options: [['ttc', 'Trying to conceive now'], ['later', 'Maybe later'], ['no', 'Not planning']] }, { key: 'ttcMonths', label: 'Months trying', showIf: function (A) { return A.plans === 'ttc'; }, options: [['0-5', '0–5'], ['6-11', '6–11'], ['12+', '12 or more']], showIf: function (A) { return A.plans === 'ttc'; } }, { key: 'fertilityTx', label: 'Fertility treatment before?', options: [['no', 'No'], ['yes', 'Yes']], showIf: function (A) { return A.plans === 'ttc'; } }] },
    { id: 'hormones', icon: 'medication', pose: 'outfit', title: 'Hormones and medicines', sub: 'Tick what you use now. These change what cycle dates mean.', type: 'multi', key: 'hormones', options: [['pill', 'Combined pill'], ['pop', 'Progestogen-only pill'], ['iud_h', 'Hormonal IUD'], ['iud_cu', 'Copper IUD'], ['implant', 'Implant or injection'], ['hrt', 'HRT (MHT)'], ['fertility', 'Fertility medicines'], ['ec', 'Emergency contraception this month'], ['other', 'Other relevant medicine'], ['none', 'None']], exclusive: ['none'] },
    { id: 'recall', icon: 'calendar_month', pose: 'bed', title: 'Which periods do you remember?', sub: 'Tap the first day of each period you remember. A few is enough.', type: 'recall', optional: true, showIf: function (A) { return periodsMayCome(A); } },
    { id: 'bleedlen', icon: 'water_drop', pose: 'stretch', title: 'How long does bleeding usually last?', sub: 'Count the days of real bleeding, not spotting.', type: 'rows', optional: true, showIf: function (A) { return periodsMayCome(A) && !(A.periodRecall && A.periodRecall.status === 'no-periods'); }, rows: [{ key: 'periodLength', label: 'Usually', options: [['3', '1 to 3 days'], ['5', '4 to 5 days'], ['7', '6 to 8 days'], ['9', 'More than 8 days'], ['weeks', 'Weeks or months'], ['unknown', 'Not sure']] }] },
    { id: 'bleed', icon: 'water_drop', pose: 'teeth', title: 'Bleeding and pain', sub: 'Tick anything that happens. These are worth a conversation, not a worry.', type: 'multi', key: 'bleedSigns', options: [['flooding', 'Soaking through protection every 1 to 2 hours, or flooding'], ['between', 'Bleeding between periods or after sex'], ['postmeno', 'Bleeding after 12+ months without periods'], ['painlife', 'Pain that disrupts school, work or sleep'], ['none', 'None of these']], exclusive: ['none'], showIf: function (A) { return A.regularity !== 'notyet'; } },
    { id: 'urgent', icon: 'emergency', pose: 'shower', title: 'Anything happening right now?', sub: 'Only tick if it is happening today.', type: 'multi', key: 'urgent', options: [['severepain', 'Sudden severe pelvic pain'], ['faint', 'Fainting or dizziness with bleeding'], ['shoulder', 'Shoulder-tip pain with pelvic pain'], ['uncontrolled', 'Bleeding I cannot control'], ['none', 'None of these']], exclusive: ['none'] },
    { id: 'dx', icon: 'stethoscope', pose: 'dishes', title: 'Has a clinician told you about any of these?', sub: 'Self-reported is fine. Tick all that apply.', type: 'multi', key: 'conditions', options: [['pcos', 'PCOS'], ['endo', 'Endometriosis'], ['fibroids', 'Fibroids'], ['thyroid', 'Thyroid condition'], ['poi', 'Early menopause or POI'], ['cysts', 'Ovarian cysts'], ['pid', 'Pelvic infection'], ['surgery', 'Surgery on womb, tubes or ovaries'], ['oophorectomy', 'One or both ovaries removed'], ['hysterectomy', 'Hysterectomy'], ['chemo', 'Chemotherapy or pelvic radiotherapy'], ['anaemia', 'Low iron or anaemia'], ['other', 'Something else'], ['unsure', 'Not sure'], ['none', 'None']], exclusive: ['none'] },
    { id: 'family', icon: 'family_restroom', pose: 'pets', title: 'In your family', sub: 'Relationships only, no names. Family patterns help read your own.', type: 'multi', key: 'family', options: [['meno40', 'Mother or sister: menopause before 40'], ['meno44', 'Mother or sister: menopause at 40–44'], ['pcosendo', 'PCOS or endometriosis'], ['cancer', 'Ovarian or breast cancer'], ['brca', 'Known BRCA or Lynch finding'], ['none', 'None that I know of'], ['unknown', 'Don’t know']], exclusive: ['none', 'unknown'] },
    { id: 'signals', icon: 'monitor_heart', pose: 'coffee', title: 'Body signals lately', sub: 'New or persistent in the last few months.', type: 'multi', key: 'signals', options: [['hair', 'New facial or body hair'], ['discharge', 'Nipple discharge (not breastfeeding)'], ['weight', 'Big weight change'], ['restrict', 'Restrictive eating or intense training'], ['bloating', 'Persistent bloating or feeling full quickly'], ['pelvic', 'New pelvic pain or needing to wee more often'], ['flushes', 'Hot flushes or night sweats'], ['none', 'None of these']], exclusive: ['none'] },
    { id: 'goals', icon: 'favorite', pose: 'plants', title: 'What would you like from Rhythme?', sub: 'Pick as many as you like. The room will lean toward them.', type: 'multi', key: 'goals', options: [['understand', 'Understand my cycle'], ['conceive', 'Conceive'], ['symptoms', 'Ease cramps and PMS'], ['sleep', 'Sleep better'], ['peri', 'Perimenopause support'], ['calm', 'Build calm habits'], ['doctor', 'Clear records for my doctor']] },
    { id: 'habits', icon: 'spa', pose: 'stretch', title: 'Everyday habits (optional)', sub: 'No judgement. Smoking and sleep in particular shape ovarian health over the years.', type: 'rows', optional: true, rows: [{ key: 'smoking', label: 'Smoking', options: [['no', 'No'], ['sometimes', 'Sometimes'], ['daily', 'Daily']] }, { key: 'alcohol', label: 'Alcohol', options: [['none', 'None'], ['weekly', 'Some weeks'], ['most', 'Most days']] }, { key: 'sleep', label: 'Usual sleep', options: [['lt6', 'Under 6 h'], ['6-7', '6–7 h'], ['7-8', '7–8 h'], ['8+', '8 h or more']] }, { key: 'exercise', label: 'Movement days a week', options: [['0', '0'], ['1-2', '1–2'], ['3-4', '3–4'], ['5+', '5+']] }] },
    { id: 'body', icon: 'monitor_weight', pose: 'shower', title: 'Height and weight (optional)', sub: 'Only if you want. Weight at either extreme can change ovulation, so it helps the notes.', type: 'body', optional: true },
    { id: 'final', icon: 'waving_hand', pose: 'outfit', title: 'Lastly, what should I call you?', sub: 'A first name or a nickname, or leave it blank.', type: 'final' }
  ];
  var onb = null;
  function periodsMayCome(A) { return A.regularity !== 'notyet' && A.regularity !== 'none12' && A.pregState !== 'pregnant' && !(A.pregState === 'postpartum' && A.periodsBack === 'no'); }
  function onbVisible(A) { return ONB.filter(function (s) { return !s.showIf || s.showIf(A); }); }
  function chipRow(key, options, val, multi) { return '<div class="chips" data-key="' + key + '"' + (multi ? ' data-multi="1"' : '') + '>' + options.map(function (o) { var v = o[0], lab = o[1], on = multi ? (val || []).indexOf(v) > -1 : val === v; return '<button type="button" class="chipbtn' + (on ? ' on' : '') + '" data-v="' + esc(v) + '">' + esc(lab) + '</button>'; }).join('') + '</div>'; }
  /* ---------- remembered periods: a 12-month calendar, newest month first ---------- */
  function recallState(A) { var r = A.periodRecall; if (!r || !Array.isArray(r.starts)) r = A.periodRecall = { version: 1, status: '', starts: [], clusters: {}, complete: '', latest: '' }; if (!r.clusters) r.clusters = {}; return r; }
  function recallDays(r) { return r.starts.filter(function (x) { return x.precision === 'day'; }).map(function (x) { return x.date; }).sort(); }
  function shortDate(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function recallHTML(A) {
    var r = recallState(A), today = S.today(), t = new Date(today + 'T00:00:00'), h = '<p class="help rhelp">Mark when bleeding began, not spotting or every bleeding day. If one bleed lasted weeks, mark its start once. Remember the month but not the day? Tap <b>About this month</b>.</p><div class="rcal" id="rcal">';
    for (var k = 0; k < 12; k++) {
      var d0 = new Date(t.getFullYear(), t.getMonth() - k, 1), y = d0.getFullYear(), m = d0.getMonth(), mk = y + '-' + String(m + 1).padStart(2, '0');
      var lead = (d0.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
      var ap = r.starts.some(function (x) { return x.precision === 'month' && x.month === mk; });
      h += '<div class="rmonth"><div class="rmhead"><b>' + d0.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</b><button type="button" class="rapprox' + (ap ? ' on' : '') + '" data-rmonth="' + mk + '" aria-pressed="' + ap + '">' + (ap ? '<span class="ms">check</span>' : '') + 'About this month</button></div><div class="rgrid">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (x) { return '<i>' + x + '</i>'; }).join('') + new Array(lead + 1).join('<span></span>');
      for (var d = 1; d <= dim; d++) {
        var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), on = r.starts.some(function (x) { return x.precision === 'day' && x.date === iso; });
        h += '<button type="button" class="rday' + (on ? ' on' : '') + (iso === today ? ' today' : '') + '" data-rday="' + iso + '"' + (iso > today ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + esc(shortDate(iso) + (iso === today ? ', today' : '') + (on ? ', period start' : '')) + '">' + d + '</button>';
      }
      h += '</div></div>';
    }
    return h + '</div><div id="recallMore">' + recallMoreHTML(A) + '</div>';
  }
  function rchips(attr, val, cur, opts) { return '<div class="chips">' + opts.map(function (o) { return '<button type="button" class="chipbtn' + (cur === o[0] ? ' on' : '') + '" ' + attr + '="' + esc(val) + '" data-rv="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
  function recallMoreHTML(A) {
    var r = recallState(A), days = recallDays(r), months = r.starts.filter(function (x) { return x.precision === 'month'; }).length, n = days.length + months, h = '';
    h += '<div class="rstatus"><span class="ms">' + (r.status === 'no-periods' ? 'pause_circle' : 'favorite') + '</span>' + (n ? n + ' start' + (n === 1 ? '' : 's') + ' remembered. You can add more later.' : (r.status === 'none-remembered' ? 'That’s okay. Start with your next period.' : (r.status === 'no-periods' ? 'No periods right now. Predictions stay paused.' : 'Newest months are at the top. Scroll down for older ones.'))) + '</div>';
    for (var i = 1; i < days.length; i++) {
      var g = S.diffDays(days[i - 1], days[i]);
      if (g <= 14) { var key = days[i - 1] + '|' + days[i]; h += '<div class="field"><span class="lbl">' + esc(shortDate(days[i - 1]) + ' and ' + shortDate(days[i]) + ' are ' + g + ' days apart') + '</span>' + rchips('data-rcl', key, r.clusters[key] || '', [['separate', 'Separate periods'], ['one', 'One bleed that stopped and restarted'], ['unsure', 'Not sure']]) + '</div>'; }
    }
    if (days.length >= 2) h += '<div class="field"><span class="lbl">Could any periods be missing between these marks?</span>' + rchips('data-rk', 'complete', r.complete || '', [['yes', 'No, these are all'], ['some', 'Some may be missing'], ['unsure', 'Not sure']]) + '</div>';
    if (days.length) h += '<div class="field"><span class="lbl">' + esc('Was ' + shortDate(days[days.length - 1]) + ' your most recent period start?') + '</span>' + rchips('data-rk', 'latest', r.latest || '', [['yes', 'Yes'], ['no', 'No, there was a later one'], ['unsure', 'Not sure']]) + '</div>';
    h += '<div class="field"><span class="lbl">Or</span>' + rchips('data-rk', 'status', n ? '' : r.status, [['none-remembered', 'I don’t remember any'], ['no-periods', 'No periods right now']]) + '</div>';
    return h;
  }
  function recallClick(e, A) {
    var rd = e.target.closest('[data-rday]'), ra = e.target.closest('[data-rmonth]'), rk = e.target.closest('[data-rk]'), rc = e.target.closest('[data-rcl]');
    if (!rd && !ra && !rk && !rc) return false;
    var r = recallState(A), before = recallDays(r).slice(-1)[0];
    if (rd && !rd.disabled) {
      var iso = rd.dataset.rday, had = r.starts.some(function (x) { return x.precision === 'day' && x.date === iso; });
      r.starts = had ? r.starts.filter(function (x) { return !(x.precision === 'day' && x.date === iso); }) : r.starts.concat([{ id: 'r' + Date.now().toString(36) + r.starts.length, precision: 'day', date: iso }]);
      rd.classList.toggle('on', !had); rd.setAttribute('aria-pressed', String(!had)); r.status = 'entered';
    }
    if (ra) {
      var mk = ra.dataset.rmonth, hadM = r.starts.some(function (x) { return x.precision === 'month' && x.month === mk; });
      r.starts = hadM ? r.starts.filter(function (x) { return !(x.precision === 'month' && x.month === mk); }) : r.starts.concat([{ id: 'r' + Date.now().toString(36) + r.starts.length, precision: 'month', month: mk }]);
      ra.classList.toggle('on', !hadM); ra.setAttribute('aria-pressed', String(!hadM)); ra.innerHTML = (!hadM ? '<span class="ms">check</span>' : '') + 'About this month'; r.status = 'entered';
    }
    if (rk) {
      r[rk.dataset.rk] = rk.dataset.rv;
      if (rk.dataset.rk === 'status') { r.starts = []; r.clusters = {}; r.complete = ''; r.latest = ''; $$('.rday.on', body).forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); $$('.rapprox.on', body).forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); b.innerHTML = 'About this month'; }); }
    }
    if (rc) r.clusters[rc.dataset.rcl] = rc.dataset.rv;
    /* a new most-recent mark needs its own confirmation */
    if (recallDays(r).slice(-1)[0] !== before) r.latest = '';
    A.lastPeriodStatus = r.status === 'no-periods' ? 'none' : '';
    $('#recallMore').innerHTML = recallMoreHTML(A); chime('tap');
    return true;
  }
  function openOnboarding(i, a) {
    if (!onb || a !== undefined) onb = { i: 0, a: a || {} };
    var steps = onbVisible(onb.a), A = onb.a;
    onb.i = Math.max(0, Math.min(steps.length - 1, i || 0));
    var st = steps[onb.i], last = onb.i === steps.length - 1, html = '';
    if (st.type === 'info') html = st.items.map(function (it) { return '<div class="stat"><span class="ms">' + it[0] + '</span><div><b>' + esc(it[1]) + '</b><span>' + esc(it[2]) + '</span></div></div>'; }).join('');
    if (st.type === 'chips') html = chipRow(st.key, st.options, A[st.key], false) + (st.note && st.note(A) ? '<div class="onb-note"><span class="ms">favorite</span>' + esc(st.note(A)) + '</div>' : '');
    if (st.type === 'multi') html = chipRow(st.key, st.options, A[st.key], true);
    if (st.type === 'date') html = '<div class="field"><input class="input" id="onbDate" type="date" max="' + S.today() + '" value="' + esc(A[st.key] || '') + '"></div>' + (st.extra ? chipRow(st.extraKey, st.extra, A[st.extraKey], false) : '');
    if (st.type === 'rows') html = st.rows.filter(function (r) { return !r.showIf || r.showIf(A); }).map(function (r) { return '<div class="field"><span class="lbl">' + esc(r.label) + '</span>' + chipRow(r.key, r.options, A[r.key], false) + '</div>'; }).join('');
    if (st.type === 'recall') html = recallHTML(A);
    if (st.type === 'body') html = sliderHTML('onbH', 'Height', 'cm', 130, 200, 1, A.heightCm || 160, !!A.heightCm) + sliderHTML('onbW', 'Weight', 'kg', 30, 150, 0.5, A.weightKg || 55, !!A.weightKg) +
      (RW.ledger().owned.indexOf('scale') > -1 ? '' : '<div class="field scaleoffer"><img src="' + ART + 'prop-scale.webp" alt=""><div><span class="lbl">Add a weighing scale to your room?</span><p class="help" style="margin:0 0 6px">' + (S.profile().onboarded ? 'It costs 5 hearts.' : 'It costs 5 of the 20 hearts you get for finishing.') + ' Tap it any day to note your weight; nothing is rewarded or judged.</p>' + chipRow('wantScale', [['yes', 'Yes, add it'], ['no', 'Not now']], A.wantScale, false) + '</div></div>');
    if (st.type === 'final') html = '<div class="field"><input class="input" id="onbName" maxlength="24" placeholder="Your name" value="' + esc(A.name || S.profile().name || '') + '"></div>';
    openSheet('onboarding', 'Getting to know you', 'Step ' + (onb.i + 1) + ' of ' + steps.length, 'favorite',
      '<div class="onb"><div class="onb-head"><div class="onb-ico" aria-hidden="true"><span class="ms">' + (st.icon || 'favorite') + '</span></div><div><h3>' + esc(st.title) + '</h3><p>' + esc(st.sub) + '</p></div></div><div class="onb-dots">' + steps.map(function (_, k) { return '<i class="' + (k <= onb.i ? 'on' : '') + '"></i>'; }).join('') + '</div>' + html +
      '<div class="onb-nav">' + (onb.i ? '<button type="button" class="btn ghost" id="onbBack"><span class="ms">arrow_back</span>Back</button>' : '') + '<span class="sp"></span>' + (st.optional ? '<button type="button" class="btn ghost" id="onbSkip">Skip</button>' : '') + '<button type="button" class="btn primary" id="onbNext">' + (last ? '<span class="ms">favorite</span>Enter my room' : 'Next<span class="ms">arrow_forward</span>') + '</button></div><div class="msg" id="onbMsg"></div></div>');
    if (st.type === 'body') wireSliders(body);
    if (st.type === 'date' && st.extraKey) $('#onbDate').addEventListener('input', function () { if (this.value) { delete A[st.extraKey]; $$('.chips[data-key="' + st.extraKey + '"] .chipbtn').forEach(function (b) { b.classList.remove('on'); }); } });
    function collect() {
      if (st.type === 'date') { var d = $('#onbDate').value; A[st.key] = S.validDate(d) && d <= S.today() ? d : ''; if (A[st.key] && st.extraKey) A[st.extraKey] = ''; }
      if (st.type === 'body') { var hv = sliderVal('onbH'), wv = sliderVal('onbW'); A.heightCm = hv || A.heightCm || null; A.weightKg = wv || A.weightKg || null; }
      if (st.type === 'final') { A.name = $('#onbName').value.trim(); }
      if (st.type === 'recall') { var rr0 = recallState(A); if (!rr0.starts.length && !rr0.status) rr0.status = 'none-remembered'; }
    }
    body.addEventListener('click', function (e) {
      if (st.type === 'recall' && recallClick(e, A)) return;
      var c = e.target.closest('.chipbtn[data-v]');
      if (c) {
        var row = c.parentNode, key = row.dataset.key, v = c.dataset.v;
        if (row.dataset.multi) { var cur = (A[key] || []).slice(), excl = st.exclusive || []; if (cur.indexOf(v) > -1) cur = cur.filter(function (x) { return x !== v; }); else if (excl.indexOf(v) > -1) cur = [v]; else cur = cur.filter(function (x) { return excl.indexOf(x) < 0; }).concat([v]); A[key] = cur; $$('.chipbtn', row).forEach(function (b) { b.classList.toggle('on', cur.indexOf(b.dataset.v) > -1); }); }
        else { A[key] = v; $$('.chipbtn', row).forEach(function (b) { b.classList.toggle('on', b === c); }); if (st.type === 'date' && key === st.extraKey && $('#onbDate')) { $('#onbDate').value = ''; A[st.key] = ''; } if (st.type === 'rows' && st.rows.some(function (r) { return r.showIf; }) || st.note) openOnboarding(onb.i); }
        chime('tap'); return;
      }
      if (e.target.closest('#onbBack')) { collect(); openOnboarding(onb.i - 1); return; }
      if (e.target.closest('#onbSkip')) { if (st.key) delete A[st.key]; if (st.rows) st.rows.forEach(function (r) { delete A[r.key]; }); if (st.type === 'body') { delete A.heightCm; delete A.weightKg; delete A.wantScale; } if (st.type === 'recall') { A.periodRecall = { version: 1, status: 'none-remembered', starts: [], clusters: {}, complete: '', latest: '' }; A.lastPeriodStatus = ''; } openOnboarding(onb.i + 1); return; }
      if (e.target.closest('#onbNext')) {
        collect();
        if (st.id === 'urgent' && (A.urgent || []).some(function (x) { return x !== 'none'; })) { openUrgentCard(function () { openOnboarding(onb.i + 1); }); return; }
        if (last) finishOnboarding(A); else openOnboarding(onb.i + 1);
      }
    });
  }
  function openUrgentCard(next) {
    openSheet('urgent', 'Please get care today', 'This is not something to track; it needs a clinician now', 'emergency_home',
      '<div class="flag high"><span class="ms">emergency_home</span><div><b>Sudden severe pelvic pain, fainting with bleeding, shoulder-tip pain or bleeding you cannot control</b><span>In Singapore call 995 or go to the nearest A&E; KK Women’s and Children’s Hospital runs a 24-hour O&G emergency service. If you could be pregnant, say so when you arrive.</span></div></div>' +
      '<p class="help">Rhythme cannot assess this. Your answers are kept as a note for your records, not sent anywhere.</p>' +
      '<div class="row"><a class="btn primary" href="tel:995"><span class="ms">call</span>Call 995</a><button type="button" class="btn ghost" id="urgentNext">Continue</button></div>');
    $('#urgentNext').addEventListener('click', next);
  }
  function predictionModeFor(A) {
    var h = A.hormones || [], c = A.conditions || [];
    if (h.some(function (x) { return ['pill', 'pop', 'iud_h', 'implant', 'hrt', 'fertility'].indexOf(x) > -1; }) || A.pregState === 'pregnant' || A.pregState === 'maybe' || A.regularity === 'notyet' || A.periodsStarted === 'no' || A.regularity === 'none12' || A.lastPeriodStatus === 'none' || c.indexOf('hysterectomy') > -1) return 'suspended';
    if (A.regularity === 'rare' || A.regularity === 'irregular' || A.pregState === 'postpartum' || A.pregState === 'loss' || h.indexOf('ec') > -1 || A.periodLength === 'weeks' || (A.signals || []).indexOf('flushes') > -1) return 'wide';
    return 'normal';
  }
  function intakeNotes(A) {
    var n = [], bs = A.bleedSigns || [], sg = A.signals || [], fam = A.family || [], ur = A.urgent || [];
    if (bs.indexOf('flooding') > -1) n.push({ level: 'watch', title: 'Heavy bleeding signs', detail: 'You reported soaking through protection every 1 to 2 hours or flooding. The NHS lists this among the signs of heavy periods worth discussing.' });
    if (bs.indexOf('between') > -1) n.push({ level: 'watch', title: 'Bleeding between periods or after sex', detail: 'Worth a clinician’s review, especially if new or recurring.' });
    if (bs.indexOf('postmeno') > -1) n.push({ level: 'high', title: 'Bleeding after 12 months without periods', detail: 'Postmenopausal bleeding should always be assessed by a clinician.' });
    if (bs.indexOf('painlife') > -1) n.push({ level: 'watch', title: 'Period pain that disrupts your days', detail: 'Pain that stops school, work or sleep deserves assessment rather than endurance.' });
    if (A.regularity === 'notyet' || A.periodsStarted === 'no') n.push({ level: 'watch', title: 'Periods not yet started', detail: 'Periods that have not started by 15 are worth an assessment, so please discuss this with a clinician.' });
    if (A.regularity === 'rare') n.push({ level: 'watch', title: 'Long gaps between periods', detail: 'Gaps of three months or more are worth discussing with a clinician.' });
    if (A.plans === 'ttc' && (A.ttcMonths === '12+' || (A.ttcMonths === '6-11' && ['35-39', '40-44', '45-49', '50+'].indexOf(A.ageRange) > -1))) n.push({ level: 'watch', title: 'Time to consider a fertility check', detail: 'ASRM suggests an evaluation after 12 months of trying under 35, or 6 months at 35 and over.' });
    if (sg.indexOf('bloating') > -1 || sg.indexOf('pelvic') > -1) n.push({ level: 'watch', title: 'New persistent bloating, fullness, pelvic pain or urinary frequency', detail: 'The NHS advises a GP review when these are new, frequent and persistent.' });
    if (sg.indexOf('hair') > -1 || sg.indexOf('discharge') > -1) n.push({ level: 'watch', title: 'New body signals', detail: 'New facial or body hair, or nipple discharge outside breastfeeding, are worth a review.' });
    if (fam.indexOf('meno40') > -1) n.push({ level: 'watch', title: 'Family history of menopause before 40', detail: 'Worth mentioning when you discuss fertility or ovarian health.' });
    if (fam.indexOf('brca') > -1 || fam.indexOf('cancer') > -1) n.push({ level: 'watch', title: 'Family history of ovarian or breast cancer', detail: 'A clinician can advise whether genetic counselling is relevant.' });
    if (ur.some(function (x) { return x !== 'none'; })) n.push({ level: 'high', title: 'Urgent symptoms reported at set-up', detail: 'You were shown urgent-care guidance. Please follow it today.' });
    /* remembered periods: only gaps the person confirmed as consecutive say anything */
    if (A.periodRecall) {
      var rr = S.rhythmFromRecall(A.periodRecall, S.today()), shortCut = 24; /* the adult cut-off; Rhythme is 18+ */
      var shortGap = rr.adjacent.filter(function (x) { return x.gap < shortCut && (x.gap >= 15 || (A.periodRecall.clusters || {})[x.from + '|' + x.to] === 'separate'); })[0];
      if (shortGap) n.push({ level: 'watch', title: 'Periods starting close together', detail: 'You remember starts ' + shortGap.gap + ' days apart. Check these dates; periods that start less than ' + shortCut + ' days apart are worth discussing.' });
      var longGap = rr.adjacent.filter(function (x) { return x.gap > 90; })[0];
      if (longGap) n.push({ level: 'watch', title: 'A long gap between periods', detail: 'You remember a gap of ' + longGap.gap + ' days without another period. Consider discussing this with a clinician.' });
    }
    if (A.periodLength === '9' || A.periodLength === 'weeks') n.push({ level: 'watch', title: 'Bleeding that lasts more than 8 days', detail: 'FIGO describes bleeding beyond 8 days as prolonged. It is worth a clinician’s review, especially if it is new.' });
    return n;
  }
  function finishOnboarding(A) {
    var num = function (v) { var x = Number(v); return isFinite(x) && x > 0 ? x : null; };
    var patch = { name: A.name || S.profile().name || '', ageRange: A.ageRange || '', ageBand: '', minorAck: '', periodsStarted: A.regularity === 'notyet' ? 'no' : (A.regularity ? 'yes' : (A.periodsStarted || '')), lastPeriodStatus: A.lastPeriodStatus || '', menarche: A.menarche || '', regularity: A.regularity || '', pregState: A.pregState || '', breastfeeding: A.breastfeeding || '', periodsBack: A.periodsBack || '', plans: A.plans || '', ttcMonths: A.ttcMonths || '', fertilityTx: A.fertilityTx || '', hormones: A.hormones || [], lastPeriodStart: (function () { var r = A.periodRecall, d = r ? recallDays(recallState(A)) : []; return r && r.latest === 'yes' && d.length ? d[d.length - 1] : ''; })(), cycleLength: null, periodLength: num(A.periodLength), periodLengthAnswer: A.periodLength || '', periodRecall: A.periodRecall ? Object.assign({}, A.periodRecall, { capturedAt: new Date().toISOString() }) : null, cycleVaries: false, bleedSigns: A.bleedSigns || [], urgent: A.urgent || [], conditions: A.conditions || [], family: A.family || [], signals: A.signals || [], goals: A.goals || [], habits: { smoking: A.smoking || '', alcohol: A.alcohol || '', sleep: A.sleep || '', exercise: A.exercise || '' }, heightCm: A.heightCm || null, weightKg: A.weightKg || null, predictionMode: predictionModeFor(A), intakeNotes: intakeNotes(A), lifeStage: A.regularity === 'none12' && ['40-44', '45-49', '50+'].indexOf(A.ageRange) > -1 && A.pregState !== 'pregnant' && A.pregState !== 'postpartum' && !(A.hormones || []).some(function (x) { return x !== 'none' && x !== 'other' && x !== 'iud_cu'; }) ? 'post' : (A.pregState === 'pregnant' ? 'pregnant' : (A.plans === 'ttc' ? 'ttc' : (['40-44', '45-49', '50+'].indexOf(A.ageRange) > -1 && (A.signals || []).indexOf('flushes') > -1 ? 'peri' : ''))), onboarded: true, onboardedAt: new Date().toISOString() };
    S.setProfile(patch);
    try { localStorage.setItem('ovuluna_onboarding', JSON.stringify(Object.assign({ completed: true, completedAt: patch.onboardedAt, source: 'room' }, patch))); } catch (e) { }
    RW.grant(20, 'welcome');
    var gotScale = false; if (A.wantScale === 'yes') { try { RW.buy('scale'); gotScale = true; } catch (e) { gotScale = RW.ledger().owned.indexOf('scale') > -1; } }
    onb = null; closeSheet(); updateGreeting(); renderDeck(); renderProps();
    toast('Welcome home' + (patch.name ? ', ' + patch.name : '') + '. ' + (gotScale ? 'Your scale is by the rug, and 15 hearts are left for your nest.' : '20 hearts to start your nest.'), 'favorite');
  }
  /* ---------- data notice and the 18+ gate: ovu-consent.js owns the record and the sheet; this is the room's doorway ---------- */
  function hasConsent() { return !!(window.OvuConsent && !OvuConsent.needsSheet()); }
  function requireConsent(next) { if (!window.OvuConsent) { toast('Rhythme could not load its consent record. Please reload.', 'error'); return; } OvuConsent.require(next, { chime: chime, toast: toast }); }
  function showWelcome() {
    var w = $('#welcome'); if (!w) return; w.hidden = false;
    $('#wBegin').addEventListener('click', function () { chime('tap'); w.hidden = true; requireConsent(function () { S.setState({ welcomeSeen: true }); openOnboarding(0, {}); }); });
    $('#wSkip').addEventListener('click', function () { chime('tap'); w.hidden = true; requireConsent(function () { S.setState({ welcomeSeen: true }); toast('Welcome back. Your intro is under the window whenever you want it.', 'favorite'); }); });
  }

  /* ---------- window: follows the sun (ovu-sun.js) ---------- */
  function sunNow() { return window.OvuSun ? OvuSun.phase() : { key: 'night', title: 'Tonight', icon: 'dark_mode', sunrise: '', sunset: '' }; }
  function applySky() {
    var sp = sunNow(); var was = scene.dataset.sky; scene.dataset.sky = sp.key; scene.classList.toggle('sky-night', sp.key === 'night'); try { document.documentElement.setAttribute('data-sky', sp.key); } catch (e) { } if (was && was !== sp.key && window.OvuPets) renderProps();
    var wb = document.querySelector('.hotspot[data-id="window"]');
    if (wb && sp.windowLabel) { wb.setAttribute('aria-label', sp.windowLabel); var tip = wb.querySelector('.tip'); if (tip) tip.textContent = cap(sp.windowLabel.split(' · ')[1]); }
    updateGreeting();
  }
  function openWindow() {
    var cs = S.cycleStats(), st = S.sleepStats(7), d = new Date(), sp = sunNow(), sleeping = S.state().sleeping;
    var loggedToday = S.byDate(S.today()).some(function (e) { return e.type === 'sleep'; });
    var act = sleeping ? { id: 'bed', icon: 'wb_sunny', text: 'Wake up' }
      : (sp.key === 'sunrise' || sp.key === 'morning') ? (loggedToday ? { id: 'mat', icon: 'self_improvement', text: 'Breathe with Erin' } : { id: 'log', icon: 'edit_calendar', text: 'Log last night’s sleep' })
      : sp.key === 'afternoon' ? { id: 'mat', icon: 'self_improvement', text: 'Take a short rest' }
      : { id: 'bed', icon: 'bedtime', text: 'Go to sleep' };
    openSheet('window', sp.title, d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + (sp.sunrise ? ' · sunrise ' + sp.sunrise + ', sunset ' + sp.sunset : ''), sp.icon,
      '<div class="stat"><span class="ms">bedtime</span><div><b>' + (st.avg ? 'Averaging ' + st.avg + ' h over ' + st.count + ' nights' : 'No sleep logged this week') + '</b><span>Adults generally do best with 7 hours or more.</span></div></div>' +
      '<div class="stat"><span class="ms">water_drop</span><div><b>' + (cs.cycleDay ? 'Cycle day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') : 'Cycle not started') + '</b><span>' + (cs.predictedFrom ? 'Next period expected ' + windowText(cs) + (cs.uncertain ? ' (a loose estimate while cycles are changing).' : '.') : (cs.mode === 'suspended' ? 'Predictions are paused for your situation; your entries still count.' : (cs.lastStart ? 'Predictions begin once your next period is logged, or add your usual cycle length in Tell me about you.' : 'Log a period on the wall calendar to start predictions.'))) + '</span></div></div>' +
      '<div class="row"><button class="btn primary" id="winSleep"><span class="ms">' + act.icon + '</span>' + act.text + '</button><button class="btn soft" id="winSound"><span class="ms">' + (S.state().sound ? 'volume_up' : 'volume_off') + '</span>Sounds ' + (S.state().sound ? 'on' : 'off') + '</button></div>' +
      '<div class="row"><a class="btn ghost" href="settings.html"><span class="ms">settings</span>Settings & health connections</a><a class="btn ghost" href="face-ppg.html"><span class="ms">monitor_heart</span>Calm check (beta)</a></div>' +
      '<div class="row"><button type="button" class="btn ghost" id="winIntro"><span class="ms">favorite</span>' + (S.profile().onboarded ? 'Update my intro' : 'Tell me about you') + '</button></div>' +
      '<p class="help">Sounds are tiny chimes plus Erin’s good-night and good-morning lines; they stay off unless you turn them on. Guided sessions always play when you start one.</p>');
    $('#winSleep').addEventListener('click', function () { if (act.id === 'log') { openSleepRecord(); return; } closeSheet(); tap(hotspot(act.id)); });
    $('#winSound').addEventListener('click', function () { S.setState({ sound: !S.state().sound }); chime('tap'); openWindow(); });
    $('#winIntro').addEventListener('click', function () { openOnboarding(0, {}); });
  }

  /* ---------- avatar bubble ---------- */
  var bubble = $('#bubble');
  function hideBubble() { bubble.classList.remove('on', 'petbub'); }
  /* the menu sits above her head; when the camera holds her tall on screen there is no room above, so it stays inside the box */
  function fitBubble() { var minTop = bubble.offsetHeight + 6; if (parseFloat(bubble.style.top) < minTop) bubble.style.top = minTop + 'px'; }
  /* a tap on her is a little hop and nothing more (Jamie, 19 Oct: the menu over her head is gone; every choice it held has its own place) */
  avatar.addEventListener('click', function (e) { e.stopPropagation(); chime('tap'); joy(); hideThought(); hideBubble(); });
  bubble.addEventListener('click', function (e) { var pb = e.target.closest('[data-pact]'); if (pb) { var pid = bubble.dataset.pet; hideBubble(); petAction(pid, pb.dataset.pact); return; } var b = e.target.closest('button'); if (!b) return; hideBubble(); if (b.dataset.act !== 'sleep' && !awake(b.dataset.act)) return; var id = { wardrobe: 'wardrobe', sleep: 'bed', mat: 'mat' }[b.dataset.act]; if (id) tap(hotspot(id)); if (b.dataset.act === 'journal') location.href = 'journal.html'; if (b.dataset.act === 'acu') openAcupressure(); if (b.dataset.act === 'luna') openLuna(); if (b.dataset.act === 'everyday') openEveryday(); if (b.dataset.act === 'intro') openOnboarding(0, {}); });
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
    var ins = window.OvuInsight ? window.OvuInsight.cachedDaily(today) : null;
    /* short bullet points, one per topic; Luna's longer reading stays in the journal so nothing repeats */
    $('#dailyText').innerHTML = daily.items && daily.items.length ? '<ul class="daylist">' + daily.items.map(function (it) { return '<li><span class="ms">' + it.icon + '</span><span>' + esc(it.text.replace(/\.$/, '')) + '</span></li>'; }).join('') + '</ul>' : esc(daily.text);
    $('#symLine').textContent = sym ? ((sym.data.symptoms || []).length ? 'Today: ' + sym.data.symptoms.join(', ') + (sym.data.mood ? ' · mood ' + sym.data.mood : '') : sym.data.none ? 'Today: no symptoms' + (sym.data.mood ? ' · mood ' + sym.data.mood : '') : 'No symptoms ticked today') : 'No symptoms logged today. Tap the calendar to add or backdate.';
    var sum = S.load().summaries || [];
    $('#shareSub').textContent = sum.length ? 'Last summary saved ' + prettyDate(sum[sum.length - 1].range.to) : 'Create a 4-week summary for your clinician';
  }
  $('#tiles').addEventListener('click', function (e) { var t = e.target.closest('[data-go]'); if (!t) return; tap(hotspot(t.dataset.go)); });

  /* ---------- greeting ---------- */
  function updateGreeting() {
    var h = new Date().getHours(), p = S.profile(), name = p.name ? ', ' + p.name : '';
    var g = S.state().sleeping ? 'Sleep well' : window.OvuSun ? OvuSun.phase().greeting : h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('#greetTitle').textContent = g + name;
    $('#greetSub').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    var cs = S.cycleStats(); var chip = $('#phaseChip');
    chip.innerHTML = '<span class="ms">water_drop</span>' + (cs.cycleDay ? 'Day ' + cs.cycleDay + (cs.phase ? ' · ' + cap(cs.phase) : '') : 'Start your cycle');
  }
  $('#phaseChip').addEventListener('click', function () { tap(hotspot('calendar')); });

  /* ---------- hooks for the scene modules: ovu-walk.js, ovu-garden.js, ovu-community.js ----------
   * They add layouts, doors and hotspot handlers of their own and listen for layout, props and boot;
   * everything else here stays private. */
  var hooks = { on: {}, hotspotHandlers: {}, fallbackHotspot: null, hudStop: null, moving: null, camFocus: null, walkTo: null }, booted = false;
  function emit(name, a, b) { (hooks.on[name] || []).forEach(function (f) { try { f(a, b); } catch (e) { console.error('room hook ' + name, e); } }); }
  window.OvuRoom = {
    LAYOUTS: LAYOUTS, ART: ART, hotspotHandlers: hooks.hotspotHandlers,
    on: function (name, f) { (hooks.on[name] = hooks.on[name] || []).push(f); if (name === 'boot' && booted) f(); },
    setFallbackHotspot: function (f) { hooks.fallbackHotspot = f; }, setHudStop: function (f) { hooks.hudStop = f; }, setMoving: function (f) { hooks.moving = f; }, emit: emit,
    /* the camera, for ovu-camera.js: read it, set it, and say where + and − should zoom about */
    cam: function () { return { x: cam.x, y: cam.y, z: cam.z }; }, camSet: function (x, y, z, anim) { cam.z = z; cam.x = x; cam.y = y; camApply(anim); }, setCamFocus: function (f) { hooks.camFocus = f; },
    setWalkTo: function (f) { hooks.walkTo = f; }, /* the walk engine routes her own walks around furniture; false hands a walk back to the straight line */
    layout: function () { return L; }, pos: function () { return { x: pos.x, y: pos.y }; }, visiting: function () { return visiting; }, homeId: currentHomeId,
    /* anything that should pause walking and scene changes */
    busy: function () { var w = $('#welcome'), c = $('#consent'), ld = $('#loading'); return !!(current || S.state().sleeping || meditating || session || practice || arranging || dragProp || (w && !w.hidden) || (c && !c.hidden) || (ld && !ld.classList.contains('hidden'))); },
    sheetOpen: function () { return !!current; }, cancelIdle: function () { clearTimeout(idleTimer); },
    els: { scene: scene, inner: inner, avatar: avatar, avatarImg: avatarImg, hud: hud, meditator: meditator, holo: holo, props: $('#ownedProps'), visitBar: $('#visitBar') },
    applyLayout: applyLayout, buildHotspots: buildHotspots, placeAvatar: placeAvatar, walkTo: walkTo, tap: tap, hotspot: hotspot,
    openSheet: openSheet, closeSheet: closeSheet, hideSheet: hideSheet, toast: toast, chime: chime, esc: esc, afterSave: afterSave, renderDeck: renderDeck, openShop: openShop, shopAct: shopAct, STORES: STORES,
    enterMeditation: enterMeditation, exitMeditation: exitMeditation, runSession: runSession, sessionOn: function () { return !!session; },
    asleep: asleep, stopEverything: stopEverything, poseSrc: poseSrc, shopOpenNow: shopOpenNow,
    setPose: setPose, restorePose: restorePose, caption: caption, showThought: showThought, hideThought: hideThought, joy: joy, isNight: isNight, renderProps: renderProps, propPosFor: propPosFor, hudOn: function (on, title) { hud.classList.toggle('on', !!on); if (title) $('#hudTitle').textContent = title; }
  };

  /* ---------- boot ---------- */
  function boot() {
    if (booted) return; booted = true;
    buildScene();
    setOutfit(S.profile().outfit || 'base', true);
    avatar.classList.add('idle');
    if (S.state().sleeping) enterNight(false);
    try { var tq = new URLSearchParams(location.search).get('tester'); if (tq === 'hearts') { S.setState({ tester: { hearts: true } }); toast('Tester mode: hearts are unlimited on this device.', 'science'); } else if (tq === 'off') { S.setState({ tester: null }); } if (tq) history.replaceState(null, '', location.pathname + location.hash); } catch (e) { }
    if (window.OvuMascot) OvuMascot.apply();
    updateGreeting(); renderDeck(); renderProps(); applySky();
    setInterval(function () { applySky(); if (window.OvuPets) renderProps(); }, 5 * 60 * 1000); document.addEventListener('visibilitychange', function () { if (!document.hidden) applySky(); });
    FD.load().catch(function () { });
    /* accounts and cloud backup: quiet until the person signs in and opts in */
    if (window.OvuAuth) OvuAuth.init();
    if (window.OvuSync) OvuSync.init();
    S.subscribe(function (reason) { if (reason === 'external' || (reason && reason.indexOf('sync') === 0)) { renderDeck(); renderProps(); updateGreeting(); } });
    $('#journalBtn').href = 'journal.html'; $('#shareBtn').href = 'journal.html#share';
    if (!S.state().tourDone) { setTimeout(function () { $('#hint').classList.add('on'); }, 1200); setTimeout(function () { $('#hint').classList.remove('on'); S.setState({ tourDone: true }); }, 7000); }
    if (!S.state().lunaSeen) { setTimeout(function () { $('#lunaBtn').classList.add('hinting'); }, 2500); setTimeout(function () { $('#lunaBtn').classList.remove('hinting'); S.setState({ lunaSeen: true }); }, 9000); }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () { });
    RM.start(function (h) { chime('bell', true); toast(h.item.label + (h.item.note ? ' · ' + h.item.note : ''), h.item.icon); });
    document.addEventListener('click', function (e) { if (e.target.closest('#visitBack')) { chime('tap'); applyLayout(currentHomeId(), false); toast('Back home.', 'home'); } if (e.target.closest('#arrDone')) exitArrange(false); if (e.target.closest('#arrReset')) exitArrange(true); });
    var hk = (location.hash || '').slice(1);
    if (hk === 'onboarding') setTimeout(function () { requireConsent(function () { openOnboarding(0, {}); }); }, 400);
    else if (!S.profile().onboarded && !S.state().welcomeSeen) showWelcome();
    else setTimeout(function () { requireConsent(function () { if (hk === 'luna') openLuna(); else if (hk === 'learn') openLearn(); else if (TABS[hk]) goTab(hk); }); }, hk ? 600 : 0);
    if (hk) { try { history.replaceState(null, '', location.pathname); } catch (e) { } }
    setTimeout(function () { $('#loading').classList.add('hidden'); joy(); }, 500);
    scheduleLife();
    function tick() { var d = new Date(); $('#clockTime').textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); var dc = $('#deskClock'); if (dc) dc.textContent = nowHM(); } tick(); setInterval(tick, 20000);
    emit('boot');
  }
  var dayImg = $('#roomDay');
  /* boot once: the same image changes src on every scene change, so its load must never boot again */
  if (dayImg.complete) boot(); else { dayImg.addEventListener('load', boot, { once: true }); dayImg.addEventListener('error', boot, { once: true }); }
})();
