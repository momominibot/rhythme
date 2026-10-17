/* ══════════════════════════════════════════════════════════════
   OVULUNA · Onboarding Flow
   Multi-step questionnaire that personalizes the app experience.
   Saves answers to localStorage under 'ovuluna_onboarding'.
   Answers are preferences and self-reported context, not a clinical prediction.
   ══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  var t = (window.OVULUNA_I18N && window.OVULUNA_I18N.t) || function(s) { return s; };

  var STORAGE_KEY = 'ovuluna_onboarding';
  var answers = {language: 'en'};
  var currentStep = 0;
  var expectedRaw = null, readable = true, persistenceStatus;

  /* ── Step definitions ── */
  var steps = [
    {
      id: 'welcome',
      section: 'Welcome',
      type: 'welcome',
      title: 'Welcome to Ovumind',
      subtitle: 'A few quick questions to make the app feel like yours.'
    },
    {
      id: 'age',
      section: 'About You',
      type: 'wheel',
      title: 'How old are you?',
      subtitle: 'This helps us show you relevant info.',
      field: 'age',
      min: 10, max: 100, default: 28, unit: t('years')
    },
    {
      id: 'height-weight',
      section: 'About You',
      type: 'height-weight',
      title: 'Your height and weight',
      subtitle: 'Helps us personalize your daily tips.',
      fields: ['heightCm', 'weightKg']
    },
    {
      id: 'cycle-status',
      section: 'Your Cycle',
      type: 'single',
      title: 'How would you describe your cycle?',
      subtitle: 'So we can give you the right guidance.',
      field: 'cycle',
      options: [
        { value: 'regular', label: 'Regular cycles', desc: 'Predictable 21-35 day cycles' },
        { value: 'variable', label: 'Variable / irregular', desc: 'Cycle length varies by 7+ days' },
        { value: 'newbie', label: 'Just started my period', desc: 'Cycles still regulating (first 2-3 years)' },
        { value: 'skipped', label: 'Skipped periods', desc: 'Occasionally miss periods' },
        { value: 'contraceptive', label: 'On hormonal contraception', desc: 'Pill, IUD, implant, or ring' },
        { value: 'post12', label: 'Post-menopause', desc: 'My clinician or my own history identifies this chapter' }
      ]
    },
    {
      id: 'cycle-length',
      section: 'Your Cycle',
      type: 'wheel',
      title: "What's your average cycle length?",
      subtitle: 'Count from day 1 of your period to day 1 of the next.',
      field: 'cycleLength',
      min: 21, max: 45, default: 28, unit: t('days'),
      showIf: function(a) { return a.cycle === 'regular' || a.cycle === 'variable'; }
    },
    {
      id: 'last-period',
      section: 'Your Cycle',
      type: 'calendar',
      title: 'When did your last period start?',
      subtitle: 'Tap the date on the calendar.',
      field: 'lastPeriod',
      showIf: function(a) { return a.cycle !== 'post12' && a.cycle !== 'contraceptive'; }
    },
    {
      id: 'first-period-age',
      section: 'Your Cycle',
      type: 'wheel',
      title: 'How old were you when your first period started?',
      subtitle: "Helps us understand your patterns. Skip if unsure.",
      field: 'firstPeriodAge',
      min: 8, max: 18, default: 12, unit: t('years'),
      showIf: function(a) { return a.cycle !== 'post12'; }
    },
    {
      id: 'mom-meno',
      section: 'Family History',
      type: 'wheel',
      title: 'At what age did your mother reach menopause?',
      subtitle: 'Optional family history. Skip if unsure.',
      field: 'momMeno',
      min: 35, max: 60, default: 51, unit: t('years'),
      optional: true, optionalLabel: "I don't know"
    },
    {
      id: 'smoking',
      section: 'Lifestyle',
      type: 'single',
      title: 'Do you smoke?',
      subtitle: 'Helps us tailor your wellness tips.',
      field: 'smoke',
      options: [
        { value: 'never', label: 'Never smoked' },
        { value: 'former', label: 'Former smoker' },
        { value: 'current', label: 'Current smoker' }
      ]
    },
    {
      id: 'sleep',
      section: 'Lifestyle',
      type: 'single',
      title: 'How would you describe your sleep?',
      subtitle: 'Sleep affects your energy and cycle.',
      field: 'sleep',
      options: [
        { value: 'good', label: 'Good — 7-9h, consistent' },
        { value: 'normal', label: 'Fair — mostly okay' },
        { value: 'poor', label: 'Poor — trouble sleeping' }
      ]
    },
    {
      id: 'circadian',
      section: 'Lifestyle',
      type: 'single',
      title: 'Do you work night shifts or have irregular sleep hours?',
      subtitle: 'Consistent sleep rhythms support regular cycles and ovarian wellness.',
      field: 'circ',
      options: [
        { value: 'none', label: 'No — regular schedule' },
        { value: 'some', label: 'Occasionally' },
        { value: 'chronic', label: 'Often / night shifts' }
      ]
    },
    {
      id: 'activity',
      section: 'Lifestyle',
      type: 'single',
      title: 'How active are you?',
      subtitle: 'This helps us set movement goals that fit your lifestyle.',
      field: 'activity',
      options: [
        { value: 'sedentary', label: 'Mostly sedentary', desc: 'Little or no exercise' },
        { value: 'light', label: 'Lightly active', desc: 'Light exercise 1-3 days/week' },
        { value: 'moderate', label: 'Moderately active', desc: 'Moderate exercise 3-5 days/week' },
        { value: 'active', label: 'Very active', desc: 'Hard exercise 6-7 days/week' }
      ]
    },
    {
      id: 'goals',
      section: 'Your Goals',
      type: 'multi',
      title: 'What are your main wellness goals?',
      subtitle: "Select all that apply — we'll personalize your journey around what matters to you.",
      field: 'goals',
      options: [
        { value: 'wellness', label: 'Overall wellness' },
        { value: 'cycle', label: 'Cycle tracking' },
        { value: 'education', label: 'Cycle education & body literacy' },
        { value: 'mental', label: 'Mental health & stress' },
        { value: 'sports', label: 'Sports & performance' },
        { value: 'fertility', label: 'Fertility / trying to conceive' },
        { value: 'perimenopause', label: 'Perimenopause support' },
        { value: 'hormones', label: 'Understanding hormones' },
        { value: 'longevity', label: 'Healthy aging and future chapters' }
      ],
      minSelect: 1
    },
    {
      id: 'diet',
      section: 'Your Goals',
      type: 'multi',
      title: 'Any dietary preferences?',
      subtitle: "We'll tailor food suggestions to your preferences.",
      field: 'diet',
      options: [
        { value: 'omnivore', label: 'No restrictions' },
        { value: 'vegetarian', label: 'Vegetarian' },
        { value: 'vegan', label: 'Vegan' },
        { value: 'pescatarian', label: 'Pescatarian' },
        { value: 'gluten-free', label: 'Gluten-free' },
        { value: 'dairy-free', label: 'Dairy-free' }
      ],
      optional: true
    },
    {
      id: 'personalize',
      section: 'Your Profile',
      type: 'personalize',
      title: "We're crafting your personalized experience"
    },
    {
      id: 'done',
      section: 'All Set',
      type: 'done',
      title: 'Welcome to Ovuluna',
      subtitle: 'Your personalized ovarian wellness journey is ready to begin.'
    }
  ];

  /* ── DOM references ── */
  var scrollEl, footEl, backBtn, skipBtn, jsection, jcount, barfill, jdots;

  function init() {
    scrollEl = document.getElementById('scroll');
    footEl = document.getElementById('foot');
    backBtn = document.getElementById('back');
    skipBtn = document.getElementById('skip');
    jsection = document.getElementById('jsection');
    jcount = document.getElementById('jcount');
    barfill = document.getElementById('barfill');
    jdots = document.getElementById('jdots');

    // Restore only a usable object. Damaged or newer data is never overwritten.
    persistenceStatus = document.createElement('p');
    persistenceStatus.id = 'onboarding-storage-status';
    persistenceStatus.setAttribute('role', 'status');
    persistenceStatus.setAttribute('aria-live', 'polite');
    persistenceStatus.style.cssText = 'position:relative;z-index:1;padding:12px 18px;margin:0;font:600 12px/1.5 var(--sans);color:var(--ink);background:var(--card);border-top:1px solid var(--line);';
    persistenceStatus.hidden = true;
    footEl.parentNode.insertBefore(persistenceStatus, footEl);
    try {
      expectedRaw = localStorage.getItem(STORAGE_KEY);
      if (expectedRaw !== null) {
        var saved = JSON.parse(expectedRaw);
        if (!saved || typeof saved !== 'object' || Array.isArray(saved) || (saved.version !== undefined && saved.version !== 1)) throw new Error('Damaged or unsupported answers');
        answers = saved;
      }
    } catch(e) {
      readable = false;
      showPersistence('Saved preferences could not be read. Existing data is unchanged. You can explore without saving from the entry page, or review local data in Settings.');
    }
    window.addEventListener('storage', function(event) {
      if (event.key === STORAGE_KEY || event.key === null) showPersistence('Saved preferences changed or were deleted in another tab. Your draft stays here. Reload to review the latest saved version before continuing.');
    });

    backBtn.addEventListener('click', goBack);
    skipBtn.addEventListener('click', skipStep);

    renderStep();
  }

  /* ── Get visible steps (filter by showIf) ── */
  function getVisibleSteps() {
    return steps.filter(function(s) {
      if (!s.showIf) return true;
      try { return s.showIf(answers); } catch(e) { return true; }
    });
  }

  /* ── Render current step ── */
  function renderStep() {
    var visible = getVisibleSteps();
    var step = visible[currentStep];
    if (!step) { finish(); return; }

    // Update header
    jsection.textContent = t(step.section) || '';
    jcount.textContent = (currentStep + 1) + ' / ' + visible.length;
    var progress = ((currentStep + 1) / visible.length) * 100;
    barfill.style.width = progress + '%';

    // Back button
    if (currentStep > 0 && step.type !== 'welcome') {
      backBtn.classList.remove('hide');
    } else {
      backBtn.classList.add('hide');
    }

    // Skip button (for optional steps)
    if (step.optional || step.type === 'welcome' || step.type === 'done') {
      skipBtn.classList.add('hide');
    } else if (step.type === 'personalize') {
      skipBtn.classList.add('hide');
    } else {
      skipBtn.classList.remove('hide');
    }

    // Render content based on type
    scrollEl.innerHTML = '';
    switch(step.type) {
      case 'welcome': renderWelcome(step); break;
      case 'language': renderLanguage(step); break;
      case 'wheel': renderWheel(step); break;
      case 'height-weight': renderHeightWeight(step); break;
      case 'single': renderSingle(step); break;
      case 'multi': renderMulti(step); break;
      case 'calendar': renderCalendar(step); break;
      case 'personalize': renderPersonalize(step); break;
      case 'done': renderDone(step); break;
    }
  }

  /* ── Welcome step ── */
  function renderWelcome(step) {
    var div = document.createElement('div');
    div.className = 'welcome';
    div.innerHTML =
      '<div class="brandmark"><span class="dot"></span><b>OVULUNA</b></div>' +
      '<img class="hero" src="assets/onboarding/luna.png" alt="Ovuluna" onerror="this.style.display=\'none\'">' +
      '<h1>' + t(step.title) + '</h1>' +
      '<p>' + t(step.subtitle) + '</p>';
    scrollEl.appendChild(div);
    footEl.innerHTML = '<button class="cta" id="nextBtn">' + t('Get Started') + '</button>';
    document.getElementById('nextBtn').addEventListener('click', nextStep);
  }

  /* ── Language step ── */
  function renderLanguage(step) {
    var languages = [
      { code: 'en', name: 'English' },
      { code: 'zh', name: '中文' },
      { code: 'ja', name: '日本語' },
      { code: 'ms', name: 'Bahasa Melayu' },
      { code: 'es', name: 'Español' },
      { code: 'de', name: 'Deutsch' },
      { code: 'vi', name: 'Tiếng Việt' },
      { code: 'id', name: 'Bahasa Indonesia' },
      { code: 'th', name: 'ไทย' },
      { code: 'ko', name: '한국어' },
      { code: 'tl', name: 'Filipino' },
      { code: 'hi', name: 'हिन्दी' }
    ];
    var selected = answers.language || 'en';
    var div = document.createElement('div');
    div.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:center;padding:20px 24px;';
    div.innerHTML =
      '<h1 class="q">' + t(step.title) + '</h1>' +
      '<p class="sub">' + t(step.subtitle) + '</p>' +
      '<div id="langList" style="display:flex;flex-direction:column;gap:10px;margin-top:8px"></div>';
    scrollEl.appendChild(div);

    var list = document.getElementById('langList');
    languages.forEach(function(lang) {
      var el = document.createElement('div');
      el.className = 'opt' + (selected === lang.code ? ' selected' : '');
      el.style.cssText = 'display:flex;align-items:center;gap:14px;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;cursor:pointer;transition:.15s;background:var(--card)';
      if (selected === lang.code) {
        el.style.borderColor = 'var(--sage, #5E9B93)';
        el.style.background = 'var(--sage-tint, #E8EBE2)';
      }
      el.innerHTML =
        '<span style="width:32px;height:32px;border-radius:50%;background:var(--mauve-tint,#f3eef7);display:flex;align-items:center;justify-content:center;font:700 12px var(--sans);color:var(--mauve,#7c5fa8);flex-shrink:0;text-transform:uppercase">' + lang.code + '</span>' +
        '<div style="flex:1"><div style="font:700 15px var(--sans);color:var(--ink)">' + lang.name + '</div></div>' +
        '<span class="tick" style="margin-left:auto;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          (selected === lang.code ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--sage,#5E9B93)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
        '</span>';
      el.addEventListener('click', function() {
        answers.language = lang.code;
        saveAnswers();
        if (window.OVULUNA_I18N && window.OVULUNA_I18N.setLang) {
          try { window.OVULUNA_I18N.setLang(lang.code); } catch (_) { showPersistence('Language could not be saved. Your answers stay in this draft.'); }
        } else {
          try { localStorage.setItem('ovuluna_language', lang.code); } catch (_) { showPersistence('Language changed for this visit. Browser storage could not save that preference.'); }
          document.documentElement.setAttribute('lang', lang.code);
        }
        list.querySelectorAll('.opt').forEach(function(o) {
          o.style.borderColor = 'var(--line)';
          o.style.background = 'var(--card)';
          o.querySelector('.tick').innerHTML = '';
        });
        el.style.borderColor = 'var(--sage, #5E9B93)';
        el.style.background = 'var(--sage-tint, #E8EBE2)';
        el.querySelector('.tick').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--sage,#5E9B93)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        document.getElementById('nextBtn').disabled = false;
      });
      list.appendChild(el);
    });

    footEl.innerHTML = '<button class="cta" id="nextBtn" ' + (selected ? '' : 'disabled') + '>' + t('Continue') + '</button>';
    document.getElementById('nextBtn').addEventListener('click', nextStep);
  }

  /* ── Wheel / slider step ── */
  function renderWheel(step) {
    var val = answers[step.field] || step.default;
    var div = document.createElement('div');
    div.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:center;padding:20px 24px;';
    div.innerHTML =
      '<h1 class="q">' + t(step.title) + '</h1>' +
      '<p class="sub">' + t(step.subtitle) + '</p>' +
      '<div class="wheel">' +
        '<div class="val" id="wheelVal">' + val + '</div>' +
        '<input type="range" min="' + step.min + '" max="' + step.max + '" value="' + val + '" id="wheelInput">' +
      '</div>' +
      (step.optional ? '<button class="gdk" id="dontKnow">' + (step.optionalLabel || "Skip") + '</button>' : '');
    scrollEl.appendChild(div);

    var input = document.getElementById('wheelInput');
    var valEl = document.getElementById('wheelVal');
    input.addEventListener('input', function() {
      valEl.textContent = this.value;
      answers[step.field] = parseInt(this.value);
      saveAnswers();
    });

    if (step.optional) {
      document.getElementById('dontKnow').addEventListener('click', function() {
        answers[step.field] = null;
        saveAnswers();
        nextStep();
      });
    }

    footEl.innerHTML = '<button class="cta" id="nextBtn" disabled>' + t('Continue') + '</button>';
    var nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = false; // wheel always has a default value
    nextBtn.addEventListener('click', nextStep);
  }

  /* ── Height & Weight step (dual metric/imperial) ── */
  function renderHeightWeight(step) {
    var units = answers.units || storedPreference('ovuluna_units') || 'metric';
    var hCm = answers.heightCm || '';
    var wKg = answers.weightKg || '';
    var div = document.createElement('div');
    div.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:center;padding:20px 24px;';
    div.innerHTML =
      '<h1 class="q">' + t(step.title) + '</h1>' +
      '<p class="sub">' + t(step.subtitle) + '</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:18px;background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:4px">' +
        '<button id="unitMetric" style="flex:1;padding:10px;border:none;border-radius:9px;font:700 13px var(--sans);cursor:pointer;transition:.15s;background:' + (units==='metric'?'var(--mauve)':'transparent') + ';color:' + (units==='metric'?'#fff':'var(--muted)') + '">Metric (cm/kg)</button>' +
        '<button id="unitImperial" style="flex:1;padding:10px;border:none;border-radius:9px;font:700 13px var(--sans);cursor:pointer;transition:.15s;background:' + (units==='imperial'?'var(--mauve)':'transparent') + ';color:' + (units==='imperial'?'#fff':'var(--muted)') + '">Imperial (ft/lbs)</button>' +
      '</div>' +
      '<div id="metricInputs" style="display:' + (units==='metric'?'flex':'none') + ';gap:14px;margin-bottom:16px">' +
        '<div style="flex:1">' +
          '<label style="font:700 12px var(--sans);color:var(--mauve);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">Height (cm)</label>' +
          '<input type="number" id="heightInput" value="' + hCm + '" placeholder="165" min="120" max="220" style="width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;font:600 16px var(--sans);color:var(--ink);background:var(--card);outline:none">' +
        '</div>' +
        '<div style="flex:1">' +
          '<label style="font:700 12px var(--sans);color:var(--mauve);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">Weight (kg)</label>' +
          '<input type="number" id="weightInput" value="' + wKg + '" placeholder="58" min="30" max="200" style="width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;font:600 16px var(--sans);color:var(--ink);background:var(--card);outline:none">' +
        '</div>' +
      '</div>' +
      '<div id="imperialInputs" style="display:' + (units==='imperial'?'flex':'none') + ';gap:14px;margin-bottom:16px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:80px">' +
          '<label style="font:700 12px var(--sans);color:var(--mauve);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">Height (ft)</label>' +
          '<input type="number" id="heightFtInput" placeholder="5" min="4" max="7" style="width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;font:600 16px var(--sans);color:var(--ink);background:var(--card);outline:none">' +
        '</div>' +
        '<div style="flex:1;min-width:80px">' +
          '<label style="font:700 12px var(--sans);color:var(--mauve);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">Height (in)</label>' +
          '<input type="number" id="heightInInput" placeholder="5" min="0" max="11" style="width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;font:600 16px var(--sans);color:var(--ink);background:var(--card);outline:none">' +
        '</div>' +
        '<div style="flex:1;min-width:100px">' +
          '<label style="font:700 12px var(--sans);color:var(--mauve);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px">Weight (lbs)</label>' +
          '<input type="number" id="weightLbsInput" placeholder="128" min="66" max="440" style="width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;font:600 16px var(--sans);color:var(--ink);background:var(--card);outline:none">' +
        '</div>' +
      '</div>' +
      '<p style="font:500 12px var(--sans);color:var(--muted);text-align:center">Optional context only. Your health needs may differ.</p>';
    scrollEl.appendChild(div);

    // Pre-fill imperial if metric exists
    if (units === 'imperial' && hCm) {
      var totalIn = Math.round(hCm / 2.54);
      document.getElementById('heightFtInput').value = Math.floor(totalIn / 12);
      document.getElementById('heightInInput').value = totalIn % 12;
    }
    if (units === 'imperial' && wKg) {
      document.getElementById('weightLbsInput').value = Math.round(wKg * 2.20462);
    }

    function validate() {
      var btn = document.getElementById('nextBtn');
      var currentUnits = document.getElementById('metricInputs').style.display === 'flex' ? 'metric' : 'imperial';
      if (currentUnits === 'metric') {
        var h = parseInt(document.getElementById('heightInput').value);
        var w = parseInt(document.getElementById('weightInput').value);
        if (h >= 120 && h <= 220 && w >= 30 && w <= 200) {
          btn.disabled = false;
          answers.heightCm = h;
          answers.weightKg = w;
          saveAnswers();
        } else {
          btn.disabled = true;
        }
      } else {
        var ft = parseInt(document.getElementById('heightFtInput').value);
        var inch = parseInt(document.getElementById('heightInInput').value);
        var lbs = parseInt(document.getElementById('weightLbsInput').value);
        if (ft >= 4 && ft <= 7 && inch >= 0 && inch <= 11 && lbs >= 66 && lbs <= 440) {
          btn.disabled = false;
          answers.heightCm = Math.round((ft * 12 + inch) * 2.54);
          answers.weightKg = Math.round(lbs / 2.20462);
          saveAnswers();
        } else {
          btn.disabled = true;
        }
      }
    }

    // Unit toggle
    document.getElementById('unitMetric').addEventListener('click', function() {
      answers.units = 'metric';
      try { localStorage.setItem('ovuluna_units', 'metric'); } catch (_) { showPersistence('Units changed for this visit. Browser storage could not save that preference.'); }
      document.getElementById('metricInputs').style.display = 'flex';
      document.getElementById('imperialInputs').style.display = 'none';
      this.style.background = 'var(--mauve)';
      this.style.color = '#fff';
      document.getElementById('unitImperial').style.background = 'transparent';
      document.getElementById('unitImperial').style.color = 'var(--muted)';
      // Sync values
      if (answers.heightCm) document.getElementById('heightInput').value = answers.heightCm;
      if (answers.weightKg) document.getElementById('weightInput').value = answers.weightKg;
      validate();
    });
    document.getElementById('unitImperial').addEventListener('click', function() {
      answers.units = 'imperial';
      try { localStorage.setItem('ovuluna_units', 'imperial'); } catch (_) { showPersistence('Units changed for this visit. Browser storage could not save that preference.'); }
      document.getElementById('metricInputs').style.display = 'none';
      document.getElementById('imperialInputs').style.display = 'flex';
      this.style.background = 'var(--mauve)';
      this.style.color = '#fff';
      document.getElementById('unitMetric').style.background = 'transparent';
      document.getElementById('unitMetric').style.color = 'var(--muted)';
      // Sync values
      if (answers.heightCm) {
        var totalIn = Math.round(answers.heightCm / 2.54);
        document.getElementById('heightFtInput').value = Math.floor(totalIn / 12);
        document.getElementById('heightInInput').value = totalIn % 12;
      }
      if (answers.weightKg) {
        document.getElementById('weightLbsInput').value = Math.round(answers.weightKg * 2.20462);
      }
      validate();
    });

    ['heightInput','weightInput','heightFtInput','heightInInput','weightLbsInput'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', validate);
    });

    footEl.innerHTML = '<button class="cta" id="nextBtn" disabled>' + t('Continue') + '</button>';
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    validate();
  }

  /* ── Single choice step ── */
  function renderSingle(step) {
    var div = document.createElement('div');
    div.style.cssText = 'flex:1;display:flex;flex-direction:column;padding:20px 24px;';
    div.innerHTML =
      '<h1 class="q">' + t(step.title) + '</h1>' +
      '<p class="sub">' + t(step.subtitle) + '</p>' +
      '<div id="optList" style="display:flex;flex-direction:column;gap:10px"></div>';
    scrollEl.appendChild(div);

    var list = document.getElementById('optList');
    step.options.forEach(function(opt) {
      var el = document.createElement('div');
      el.className = 'opt' + (answers[step.field] === opt.value ? ' selected' : '');
      el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;cursor:pointer;transition:.15s;background:var(--card)';
      if (answers[step.field] === opt.value) {
        el.style.borderColor = 'var(--sage, #5E9B93)';
        el.style.background = 'var(--sage-tint, #E8EBE2)';
      }
      el.innerHTML =
        '<div style="flex:1;min-width:0">' +
          '<div style="font:700 14px var(--sans);color:var(--ink)">' + t(opt.label) + '</div>' +
          (opt.desc ? '<div style="font:500 12px var(--sans);color:var(--muted);margin-top:2px">' + t(opt.desc) + '</div>' : '') +
        '</div>' +
        '<span class="tick" style="margin-left:auto;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          (answers[step.field] === opt.value ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--sage,#5E9B93)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
        '</span>';
      el.addEventListener('click', function() {
        answers[step.field] = opt.value;
        saveAnswers();
        // Update visual
        list.querySelectorAll('.opt').forEach(function(o) {
          o.style.borderColor = 'var(--line)';
          o.style.background = 'var(--card)';
          o.querySelector('.tick').innerHTML = '';
        });
        el.style.borderColor = 'var(--sage, #5E9B93)';
        el.style.background = 'var(--sage-tint, #E8EBE2)';
        el.querySelector('.tick').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--sage,#5E9B93)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        document.getElementById('nextBtn').disabled = false;
      });
      list.appendChild(el);
    });

    footEl.innerHTML = '<button class="cta" id="nextBtn" disabled>' + t('Continue') + '</button>';
    if (answers[step.field]) document.getElementById('nextBtn').disabled = false;
    document.getElementById('nextBtn').addEventListener('click', nextStep);
  }

  /* ── Multi choice step ── */
  function renderMulti(step) {
    var selected = answers[step.field] || [];
    var div = document.createElement('div');
    div.style.cssText = 'flex:1;display:flex;flex-direction:column;padding:20px 24px;';
    div.innerHTML =
      '<h1 class="q">' + t(step.title) + '</h1>' +
      '<p class="sub">' + t(step.subtitle) + '</p>' +
      '<div id="optGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"></div>';
    scrollEl.appendChild(div);

    var grid = document.getElementById('optGrid');
    step.options.forEach(function(opt) {
      // Hide fertility/perimenopause goals for teens (age < 18)
      if ((opt.value === 'fertility' || opt.value === 'perimenopause') && answers.age && answers.age < 18) {
        return;
      }
      var isSel = selected.indexOf(opt.value) !== -1;
      var el = document.createElement('div');
      el.className = 'gcard' + (isSel ? ' selected' : '');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 10px;border:1.5px solid var(--line);border-radius:16px;cursor:pointer;transition:.15s;background:var(--card);text-align:center;min-height:120px;justify-content:center';
      if (isSel) {
        el.style.borderColor = 'var(--sage, #5E9B93)';
        el.style.background = 'var(--sage-tint, #E8EBE2)';
      }
      el.innerHTML =
        '<span style="font:600 12.5px var(--sans);color:var(--ink);line-height:1.2">' + t(opt.label) + '</span>';
      el.addEventListener('click', function() {
        var idx = selected.indexOf(opt.value);
        if (idx === -1) {
          selected.push(opt.value);
          el.style.borderColor = 'var(--sage, #5E9B93)';
          el.style.background = 'var(--sage-tint, #E8EBE2)';
        } else {
          selected.splice(idx, 1);
          el.style.borderColor = 'var(--line)';
          el.style.background = 'var(--card)';
        }
        answers[step.field] = selected.slice();
        saveAnswers();
        var min = step.minSelect || 0;
        document.getElementById('nextBtn').disabled = selected.length < min;
      });
      grid.appendChild(el);
    });

    footEl.innerHTML = '<button class="cta" id="nextBtn" ' + (selected.length < (step.minSelect || 0) ? 'disabled' : '') + '>' + t('Continue') + '</button>';
    document.getElementById('nextBtn').addEventListener('click', nextStep);
  }

  /* ── Calendar step ── */
  function renderCalendar(step) {
    var today = new Date();
    var selected = answers[step.field] ? new Date(answers[step.field]) : null;
    var div = document.createElement('div');
    div.style.cssText = 'flex:1;display:flex;flex-direction:column;padding:20px 24px;';
    div.innerHTML =
      '<h1 class="q">' + t(step.title) + '</h1>' +
      '<p class="sub">' + t(step.subtitle) + '</p>' +
      '<div class="cal" id="calWidget"></div>';
    scrollEl.appendChild(div);

    var calWidget = document.getElementById('calWidget');
    var month = today.getMonth();
    var year = today.getFullYear();

    function renderMonth() {
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var dowNames = ['S','M','T','W','T','F','S'];

      var html = '<div class="cmh">' +
        '<button id="prevMonth" style="border:none;background:none;cursor:pointer;font-size:18px;color:var(--mauve)">‹</button>' +
        '<span>' + monthNames[month] + ' ' + year + '</span>' +
        '<button id="nextMonth" style="border:none;background:none;cursor:pointer;font-size:18px;color:var(--mauve)">›</button>' +
      '</div><div class="cgrid">';
      dowNames.forEach(function(d) { html += '<div class="dow">' + d + '</div>'; });
      for (var i = 0; i < firstDay; i++) html += '<div></div>';
      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
        var isSel = selected && selected.toISOString().slice(0,10) === dateStr;
        var isFuture = new Date(year, month, d) > today;
        html += '<button class="day' + (isSel ? ' on' : '') + (isFuture ? ' mut' : '') + '" data-date="' + dateStr + '"' + (isFuture ? ' disabled' : '') + '>' + d + '</button>';
      }
      html += '</div>';
      calWidget.innerHTML = html;

      document.getElementById('prevMonth').addEventListener('click', function() {
        month--; if (month < 0) { month = 11; year--; }
        renderMonth();
      });
      document.getElementById('nextMonth').addEventListener('click', function() {
        month++; if (month > 11) { month = 0; year++; }
        renderMonth();
      });
      calWidget.querySelectorAll('.day:not(.mut)').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selected = new Date(this.dataset.date);
          answers[step.field] = selected.toISOString();
          saveAnswers();
          calWidget.querySelectorAll('.day').forEach(function(d) { d.classList.remove('on'); });
          this.classList.add('on');
          document.getElementById('nextBtn').disabled = false;
        });
      });
    }
    renderMonth();

    footEl.innerHTML = '<button class="cta" id="nextBtn" ' + (selected ? '' : 'disabled') + '>' + t('Continue') + '</button>';
    document.getElementById('nextBtn').addEventListener('click', nextStep);
  }

  /* ── Personalize / loading step ── */
  function renderPersonalize(step) {
    var div = document.createElement('div');
    div.className = 'pers';
    div.innerHTML =
      '<div class="pers-orb">' +
        '<img src="assets/onboarding/luna.png" alt="" onerror="this.style.display=\'none\'">' +
        '<div class="sparkles">' +
          '<i style="--s:8px;--d:2s;--t:0s;left:20%;top:15%"></i>' +
          '<i style="--s:12px;--d:2.8s;--t:.5s;left:75%;top:25%"></i>' +
          '<i style="--s:6px;--d:2.2s;--t:1s;left:85%;top:60%"></i>' +
          '<i style="--s:10px;--d:3s;--t:1.5s;left:15%;top:70%"></i>' +
          '<i style="--s:8px;--d:2.5s;--t:.8s;left:50%;top:10%"></i>' +
        '</div>' +
      '</div>' +
      '<h2 id="persTitle">Making space for your preferences…</h2>' +
      '<div class="plist">' +
        '<div class="pl" id="pl1"><span class="pc">✓</span> Cycle context</div>' +
        '<div class="pl" id="pl2"><span class="pc">✓</span> Lifestyle factors</div>' +
        '<div class="pl" id="pl3"><span class="pc">✓</span> Learning interests</div>' +
        '<div class="pl" id="pl4"><span class="pc">✓</span> Your local profile</div>' +
      '</div>';
    scrollEl.appendChild(div);
    footEl.innerHTML = '';

    // Animate checklist
    var items = ['pl1','pl2','pl3','pl4'];
    var titles = ['Making space for your preferences…', 'Keeping your cycle context…', 'Saving your learning interests…', 'Preparing your local profile…', 'Almost ready…'];
    var i = 0;
    var interval = setInterval(function() {
      if (i < items.length) {
        document.getElementById(items[i]).classList.add('done');
        if (i < titles.length) document.getElementById('persTitle').textContent = titles[i+1] || titles[titles.length-1];
        i++;
      } else {
        clearInterval(interval);
        setTimeout(nextStep, 600);
      }
    }, 500);
  }

  /* ── Done step ── */
  function renderDone(step) {
    // Questionnaire answers do not support an ovarian-age or menopause prediction.
    // Preserve any older stored estimate for the user to review/delete in Settings;
    // this onboarding flow neither reads, displays nor rewrites that legacy data.
    var isTeen = typeof answers.age === 'number' && answers.age < 18;
    var ovInfo = '<div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:16px 0;text-align:center">' +
      '<div style="font:700 11px var(--sans);color:var(--mauve);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Your changing chapters</div>' +
      '<div style="font-family:var(--serif);font-size:22px;color:var(--ink);margin:4px 0 8px">Begin with curiosity</div>' +
      '<div style="font:500 12px var(--sans);color:var(--muted);line-height:1.6">Your answers are self-reported context and learning preferences. They do not calculate an ovarian age, confirm ovulation, identify a reproductive stage or predict menopause.</div>' +
      '<a href="life-journey.html" style="display:inline-block;margin-top:12px;color:var(--mauve)">Explore your life chapters</a>' +
    '</div>';
    var minorNote = isTeen ? '<p style="font:500 12px var(--sans);color:var(--muted);margin-top:8px">A trusted adult, school counselor or healthcare professional can help you with questions about your body or feelings.</p>' : '';

    var div = document.createElement('div');
    div.className = 'welcome';
    div.innerHTML =
      '<div class="brandmark"><span class="dot"></span><b>OVULUNA</b></div>' +
      '<img class="hero" src="assets/onboarding/luna.png" alt="" onerror="this.style.display=\'none\'">' +
      '<h1>' + t(step.title) + '</h1>' +
      '<p>' + step.subtitle + '</p>' +
      ovInfo +
      minorNote +
      '<p class="disc">This onboarding saves your answers in this browser\'s local storage; it does not upload them. You can review local data and deletion options in Settings. Ovuluna provides education and observations, not a diagnosis or a fertility forecast.</p>';
    scrollEl.appendChild(div);
    footEl.innerHTML = '<button class="cta coral" id="enterBtn">Enter Ovuluna</button>';
    document.getElementById('enterBtn').addEventListener('click', function() {
      finish();
    });
  }

  /* ── Navigation ── */
  function nextStep() {
    // Do not report progress past an unsaved draft.
    if (!saveAnswers()) return;
    var visible = getVisibleSteps();
    currentStep++;
    if (currentStep >= visible.length) {
      finish();
    } else {
      renderStep();
      scrollEl.scrollTop = 0;
    }
  }

  function goBack() {
    if (currentStep > 0) {
      currentStep--;
      renderStep();
      scrollEl.scrollTop = 0;
    }
  }

  function skipStep() {
    var visible = getVisibleSteps();
    var step = visible[currentStep];
    if (step && step.field) {
      answers[step.field] = null;
      saveAnswers();
    }
    nextStep();
  }

  function finish() {
    var hadCompleted = Object.prototype.hasOwnProperty.call(answers, 'completed');
    var previousCompleted = answers.completed;
    var hadTime = Object.prototype.hasOwnProperty.call(answers, 'completedAt');
    var previousTime = answers.completedAt;
    answers.completed = true;
    answers.completedAt = new Date().toISOString();
    if (!saveAnswers()) {
      if (hadCompleted) answers.completed = previousCompleted; else delete answers.completed;
      if (hadTime) answers.completedAt = previousTime; else delete answers.completedAt;
      return;
    }
    window.location.href = 'home.html';
  }

  /* ── Persistence ── */
  function showPersistence(message) {
    persistenceStatus.textContent = message;
    persistenceStatus.hidden = !message;
  }
  function storedPreference(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function saveAnswers() {
    if (!readable) {
      showPersistence('Saved preferences are unavailable. Your draft is not saved, and existing data is unchanged. Review local data in Settings or reload after browser storage is available.');
      return false;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== expectedRaw) throw new Error('stale');
      var next = JSON.stringify(answers);
      localStorage.setItem(STORAGE_KEY, next);
      if (localStorage.getItem(STORAGE_KEY) !== next) throw new Error('verification');
      expectedRaw = next;
      showPersistence('');
      return true;
    } catch(e) {
      showPersistence(e.message === 'stale' ? 'Saved preferences changed or were deleted in another tab. Your draft is not saved. Reload to review the latest saved version before continuing.' : 'Your preferences could not be saved. Your draft stays on this page. Check browser storage, then tap Continue to retry.');
      return false;
    }
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
