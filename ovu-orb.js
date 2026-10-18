/* Luna, the crystal moon orb. Type a note; Luna turns it into journal entries.
 * A local rule parser runs first and never leaves the device. When the rules
 * cannot read a note, Luna's own model reads it through a keyless Ovumind relay
 * (or the user's own OpenRouter/Ark key), and every extracted entry is still
 * shown for confirmation before it is saved. */
(function (root) {
  'use strict';
  var S = root.OvuStore, A = root.OvuAgents, FD = root.OvuFood;
  var AI_KEY = 'ovumind_ai_v1';
  var PROXY_URL = 'https://zodkohwaznqgrfrcfdkf.supabase.co/functions/v1/luna'; /* keyless relay: Doubao Seed 2.1 turbo, origin-locked, 80 notes a day per person */
  var DEFAULT_MODEL = 'doubao-seed-2-1-turbo-260628';
  var OR_MODEL = 'google/gemini-2.5-flash-lite'; /* default when someone brings an OpenRouter key; jev-1.13.0: 0.73 */
  var FALLBACK_MODEL = 'qwen/qwen3-30b-a3b-instruct';
  var SYSTEM = 'You convert one short personal health note into strict JSON for a women\'s health journal. Output only JSON: {"entries":[...],"reply":"one warm sentence"}. Entry shapes: {"type":"sleep","date":"YYYY-MM-DD","data":{"bedTime":"HH:MM","wakeTime":"HH:MM","quality":1-5|null,"notes":""}}; {"type":"period","date":"YYYY-MM-DD","data":{"flow":"spotting|light|medium|heavy","clots":bool,"impact":bool}}; {"type":"symptom","date":"YYYY-MM-DD","data":{"symptoms":[from: cramps, headache, bloating, breast tenderness, back pain, fatigue, nausea, acne, cravings, insomnia, hot flushes, dizziness, spotting, discharge change, low mood, anxiety, irritability, brain fog],"pain":0-10|null,"mood":"great|good|ok|low|bad|","notes":""}}; {"type":"food","date":"YYYY-MM-DD","data":{"meal":"breakfast|lunch|dinner|snack","time":"HH:MM"|null,"foods":"text","tags":[]}}; {"type":"mindfulness","date":"YYYY-MM-DD","data":{"kind":"breathe","minutes":number}}. Use the given today date; "yesterday" means the day before. Never invent values that are not in the note; use null. Do not diagnose.';

  function todayPlus(n) { return S.addDays(S.today(), n); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function toTime(h, m, ap) {
    h = Number(h); m = Number(m || 0);
    if (ap) { ap = ap.toLowerCase(); if (ap[0] === 'p' && h < 12) h += 12; if (ap[0] === 'a' && h === 12) h = 0; }
    if (h > 23 || m > 59) return null;
    return pad(h) + ':' + pad(m);
  }
  function dateFrom(text) {
    var t = text.toLowerCase();
    if (/\byesterday\b/.test(t)) return todayPlus(-1);
    if (/\bday before yesterday\b/.test(t)) return todayPlus(-2);
    var m = t.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
    if (m) { var mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2]) + 1; var y = new Date().getFullYear(); var d = y + '-' + pad(mo) + '-' + pad(m[1]); if (d > S.today()) d = (y - 1) + d.slice(4); return S.validDate(d) ? d : S.today(); }
    var iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/); if (iso && S.validDate(iso[1]) && iso[1] <= S.today()) return iso[1];
    return S.today();
  }

  /* ---------- local rules ---------- */
  /* ---------- red flags read before anything else ---------- */
  var SOAK = /\b(?:soak(?:ing|ed|s)?\s+(?:through|a|my|the|one)\b|flood(?:ing|ed|s)?\b|(?:pads?|tampons?|cups?|protection)\s+(?:every|each)\s+(?:hour|half|\d+\s*(?:min|minutes))|(?:chang(?:e|ing|ed)|new)\s+(?:my\s+|a\s+)?(?:pads?|tampons?)\s+(?:every|each)\s+(?:hour|half|\d+\s*min)|bleeding\s+(?:won'?t|will\s*not|does\s*not|doesn'?t|hasn'?t)\s+stop|can'?t\s+stop\s+(?:the\s+)?bleeding|bleeding\s+through\s+(?:my\s+)?(?:clothes|sheets|bedding))/;
  var DIZZY = /\b(?:dizz(?:y|iness)|light-?headed|faint(?:ed|ing|y)?|passed\s+out|black(?:ed|ing)\s+out|woozy)\b/;
  var SEVERE_PAIN = /\b(?:sudden|severe|worst|unbearable|excruciating|stabbing|can'?t\s+stand)\b[^.;]{0,40}\b(?:pelvi\w*|abdom\w*|tummy|belly|stomach|side)\b[^.;]{0,12}\bpain\b|\bpain\b[^.;]{0,25}\b(?:sudden|severe|unbearable|excruciating|worst)\b/;
  var BLEED_WORDS = /\b(?:bleed\w*|period|spotting|blood)\b/;
  /* Returns an urgent card to show before parsing, or null. Emergency cards need care now (995 or an
   * emergency department); the postmenopausal card is prompt care, not an emergency. Rules only, never a model. */
  function urgent(text, profile) {
    var t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    if (/\bno (?:period|bleeding|pain)\b/.test(t) && !SOAK.test(t)) return null;
    var heavy = SOAK.test(t) || (/\bheavy\b/.test(t) && BLEED_WORDS.test(t)), dizzy = DIZZY.test(t);
    if (SOAK.test(t) && !/\b(?:yesterday|last (?:week|month|cycle)|used to|before)\b/.test(t)) return { level: 'emergency', code: 'HEAVY_BLEED_NOW', title: 'Get emergency care now', trigger: 'bleeding that soaks through protection every hour' + (dizzy ? ' with dizziness' : '') };
    if (heavy && dizzy) return { level: 'emergency', code: 'HEAVY_DIZZY_NOW', title: 'Get emergency care now', trigger: 'heavy bleeding with dizziness or faintness' };
    if (/\b(?:fainted|passed out|blacked out|collapsed)\b/.test(t) && BLEED_WORDS.test(t)) return { level: 'emergency', code: 'FAINT_BLEED_NOW', title: 'Get emergency care now', trigger: 'fainting with bleeding' };
    if (/\bpregnan\w*\b/.test(t) && !/\bnot pregnant\b/.test(t) && (BLEED_WORDS.test(t) || SEVERE_PAIN.test(t))) return { level: 'emergency', code: 'PREG_BLEED_NOW', title: 'Get emergency care now', trigger: 'bleeding or severe pain in pregnancy' };
    if (SEVERE_PAIN.test(t) || (/\bshoulder[- ]tip\b/.test(t) && /\bpain\b/.test(t))) return { level: 'emergency', code: 'SEVERE_PAIN_NOW', title: 'Get emergency care now', trigger: 'sudden severe pelvic or abdominal pain' };
    var stage = (profile && profile.lifeStage) || '';
    if (['post', 'postmenopause', 'postmenopausal'].indexOf(stage) > -1 && BLEED_WORDS.test(t)) return { level: 'prompt', code: 'POSTMENO_BLEED', title: 'Please get this checked this week', trigger: 'bleeding after menopause' };
    return null;
  }

  function parseLocal(text) {
    var t = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ', date = dateFrom(text), entries = [];
    // sleep: "slept 7h", "slept 11pm to 7am", "bed at 11:30 woke 6:45", "sleep quality 4"
    var times = t.match(/(?:slept|sleep|bed)\D{0,12}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until|till|→)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    var hours = t.match(/slept\s*(?:for\s*)?(\d{1,2}(?:\.\d)?)\s*(?:h|hr|hrs|hours)/);
    var quality = t.match(/quality\s*(\d)(?:\s*\/\s*5)?/) || t.match(/(\d)\s*\/\s*5/);
    if (times) {
      var bt = toTime(times[1], times[2], times[3] || (Number(times[1]) >= 8 && Number(times[1]) <= 12 ? 'pm' : null)), wt = toTime(times[4], times[5], times[6] || 'am');
      if (bt && wt) entries.push({ type: 'sleep', date: date, data: { bedTime: bt, wakeTime: wt, quality: quality ? Number(quality[1]) : null, notes: '' } });
    } else if (hours) {
      var h = Number(hours[1]), wake = '07:00', mins = Math.round(h * 60), bm = (7 * 60 - mins + 1440) % 1440;
      entries.push({ type: 'sleep', date: date, data: { bedTime: pad(Math.floor(bm / 60)) + ':' + pad(bm % 60), wakeTime: wake, quality: quality ? Number(quality[1]) : null, notes: 'Luna assumed a 07:00 wake time from "' + hours[0].trim() + '"' } });
    }
    // period. Soaking through protection, flooding or bleeding that will not stop is heavy flow with impact,
    // even when the word "period" is missing (the red-flag sentences are written that way).
    var soaking = SOAK.test(t);
    if ((/\b(period|menses|menstruat|bleeding|bleed|flow|pads?|tampons?)\b/.test(t) || soaking) && !/\bno (period|bleeding)\b/.test(t)) {
      var flow = (soaking || /\bheavy\b/.test(t)) ? 'heavy' : /\blight\b/.test(t) ? 'light' : /\bspotting\b/.test(t) ? 'spotting' : 'medium';
      entries.push({ type: 'period', date: date, data: { flow: flow, clots: /\bclots?\b/.test(t), impact: soaking || /\b(couldn'?t|missed|stayed home|affected)\b/.test(t) } });
    }
    // symptoms, pain, mood
    var syms = A.SYMPTOMS.filter(function (s) { return t.indexOf(' ' + s) > -1 || (s === 'cramps' && /\bcramp/.test(t)) || (s === 'anxiety' && /\banxious\b/.test(t)) || (s === 'low mood' && /\b(sad|down|low)\b/.test(t) && !/\blow (flow|energy)\b/.test(t)) || (s === 'fatigue' && /\b(tired|exhausted)\b/.test(t)) || (s === 'headache' && /\bmigraine\b/.test(t)) || (s === 'dizziness' && DIZZY.test(t)) || (s === 'discharge change' && /\bdischarge\b/.test(t)); });
    var pain = t.match(/\bpain\D{0,6}(\d{1,2})(?:\s*(?:\/|out of)\s*10)?/) || t.match(/\b(\d{1,2})\s*(?:\/|out of)\s*10\b/);
    var mood = /\b(great|amazing|wonderful)\b/.test(t) ? 'great' : /\b(good|happy|fine|calm)\b/.test(t) ? 'good' : /\b(ok|okay|meh|so-so)\b/.test(t) ? 'ok' : /\b(low|sad|down|flat)\b/.test(t) ? 'low' : /\b(bad|awful|terrible|miserable)\b/.test(t) ? 'bad' : '';
    if (syms.length || pain || mood) entries.push({ type: 'symptom', date: date, data: { symptoms: syms, pain: pain ? Math.min(10, Number(pain[1])) : null, mood: mood, notes: '' } });
    // food
    var meal = /\bbreakfast\b/.test(t) ? 'breakfast' : /\blunch\b/.test(t) ? 'lunch' : /\bdinner\b/.test(t) ? 'dinner' : /\b(snack|tea break)\b/.test(t) ? 'snack' : null;
    var ate = t.match(/\b(?:ate|had|eating|drank|having)\s+(.{3,120}?)(?:\s+for\s+(?:breakfast|lunch|dinner|snack)|[.!,;]|$)/);
    var skipped = /\b(?:skip|skipped|skipping|missed|no|without|didn'?t (?:have|eat)|haven'?t (?:had|eaten)|forgot)\b[^.;,]{0,14}\b(?:breakfast|lunch|dinner|snack|meals?)\b/.test(t);
    // A meal word alone ("since lunch", "before dinner") is not a meal: an eating cue is needed, and a red-flag
    // sentence is never a meal.
    var eatingCue = /\b(?:for|ate|eat|eating|had|having|drank|grabbed|cooked|ordered|bought)\b/.test(t);
    if ((ate || (meal && eatingCue)) && !skipped && !soaking && !urgent(text)) {
      var foods = ate ? ate[1].trim() : text.trim();
      var hr = new Date().getHours(); if (!meal) meal = hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr < 20 ? 'dinner' : 'snack';
      var tags = []; if (/\bcoffee|kopi|latte|espresso|tea\b/.test(t)) tags.push('caffeine'); if (/\bwine|beer|cocktail|alcohol\b/.test(t)) tags.push('alcohol'); if (/\bhome ?cooked|cooked at home\b/.test(t)) tags.push('home-cooked');
      entries.push({ type: 'food', date: date, data: { meal: meal, time: null, foods: foods.replace(/^(a|an|some|my)\s+/, ''), tags: tags } });
    }
    // mindfulness
    var med = t.match(/\b(?:meditat|breath|yoga|mindful)\w*\D{0,20}(\d{1,3})\s*(?:min|mins|minutes)/) || t.match(/(\d{1,3})\s*(?:min|mins|minutes)\D{0,20}\b(?:meditat|breath|yoga|mindful)/);
    if (med) entries.push({ type: 'mindfulness', date: date, data: { kind: 'breathe', minutes: Number(med[1]), completed: true, guide: 'Logged through Luna' } });
    return entries;
  }

  /* ---------- AI mode: Luna's own model through the relay, or the user's own key ---------- */
  /* Off until the user says yes: notes stay on the device unless Luna's model was allowed in onboarding
   * or in Luna's settings, and written readings need their own separate permission (insights). */
  function defaults() { return { on: false, provider: 'ovumind', key: '', model: '', insights: false }; }
  function aiConfig() { try { var c = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); if (!c || !c.provider || (c.provider !== 'ovumind' && !c.key)) return defaults(); return c; } catch (e) { return defaults(); } }
  function setAiConfig(cfg) { localStorage.setItem(AI_KEY, JSON.stringify(cfg)); }
  function okEntry(e) { return e && S.TYPES.indexOf(e.type) > -1 && S.validDate(e.date) && e.date <= S.today() && e.data; }
  function parseAI(text) {
    var cfg = aiConfig();
    if (!cfg.on) return Promise.reject(new Error('AI mode is off.'));
    if (cfg.provider === 'ovumind') {
      return fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, today: S.today() }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna’s relay replied ' + r.status + '.')); return d; }); })
        .then(function (d) { return { entries: (d.entries || []).filter(okEntry), reply: d.reply || '', usage: d.usage || null }; });
    }
    if (!cfg.key) return Promise.reject(new Error('Paste a key in Luna’s settings, or choose Luna’s own model.'));
    var url = cfg.provider === 'ark' ? 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    var body = { model: cfg.model || OR_MODEL, temperature: 0, max_tokens: 400, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: 'Today is ' + S.today() + '. Note: ' + text }] };
    if (cfg.provider !== 'ark') body.response_format = { type: 'json_object' };
    return fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'Ovumind Luna' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('The model replied ' + r.status + '. Check the key and model name in Luna’s settings.'); return r.json(); })
      .then(function (d) {
        var txt = (((d.choices || [])[0] || {}).message || {}).content || '';
        var m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('The model did not return JSON.');
        var out = JSON.parse(m[0]);
        var entries = (out.entries || []).filter(okEntry);
        return { entries: entries, reply: out.reply || '', usage: d.usage || null };
      });
  }

  /* ---------- describe entries for the confirmation card ---------- */
  function describe(e) {
    var d = e.data;
    if (e.type === 'sleep') return 'Sleep ' + d.bedTime + ' → ' + d.wakeTime + ' (' + A.fmtHours(S.sleepHours(d)) + ')' + (d.quality ? ', quality ' + d.quality + '/5' : '');
    if (e.type === 'period') return 'Period: ' + d.flow + ' flow' + (d.clots ? ', clots' : '') + (d.impact ? ', affected the day' : '');
    if (e.type === 'symptom') return 'Symptoms: ' + ((d.symptoms || []).join(', ') || 'none ticked') + (d.pain !== null && d.pain !== undefined ? ', pain ' + d.pain + '/10' : '') + (d.mood ? ', mood ' + d.mood : '');
    if (e.type === 'food') return (d.meal ? d.meal.charAt(0).toUpperCase() + d.meal.slice(1) : 'Meal') + ': ' + d.foods + ((d.tags || []).length ? ' (' + d.tags.join(', ') + ')' : '');
    if (e.type === 'mindfulness') return 'Mindfulness: ' + d.minutes + ' min';
    return e.type;
  }
  function save(entries) {
    var saved = [];
    entries.forEach(function (e) {
      var data = e.data;
      if (e.type === 'food') { data = { meal: data.meal || 'snack', time: data.time || null, foods: data.foods || '', notes: '', tags: data.tags || [], items: [], photo: null, totals: null, method: 'luna-note' }; }
      if (e.type === 'symptom') { data = { symptoms: (data.symptoms || []).filter(function (s) { return A.SYMPTOMS.indexOf(s) > -1; }), pain: data.pain === null || data.pain === undefined ? null : Math.max(0, Math.min(10, Number(data.pain))), mood: A.MOODS.indexOf(data.mood) > -1 ? data.mood : '', notes: data.notes || '' }; }
      if (e.type === 'sleep') { if (!S.validTime(data.bedTime) || !S.validTime(data.wakeTime)) return; data = { bedTime: data.bedTime, wakeTime: data.wakeTime, quality: data.quality ? Math.max(1, Math.min(5, Number(data.quality))) : null, notes: data.notes || '', mode: 'luna' }; }
      if (e.type === 'period') { data = { flow: ['spotting', 'light', 'medium', 'heavy'].indexOf(data.flow) > -1 ? data.flow : 'medium', clots: !!data.clots, impact: !!data.impact }; }
      if (e.type === 'mindfulness') { data = { kind: 'breathe', minutes: Math.max(1, Number(data.minutes) || 1), completed: true, guide: 'Logged through Luna' }; }
      saved.push(S.add(e.type, e.date, data, 'luna', { merge: e.type === 'symptom' || e.type === 'period' }));
    });
    return saved;
  }
  var REPLIES = ['Noted, gently.', 'Written down. Thank you for telling me.', 'Got it. One small step logged.', 'Saved. Be soft with yourself today.'];
  function reply() { return REPLIES[Math.floor(Math.random() * REPLIES.length)]; }

  root.OvuOrb = { parseLocal: parseLocal, parseAI: parseAI, urgent: urgent, describe: describe, save: save, aiConfig: aiConfig, setAiConfig: setAiConfig, reply: reply, DEFAULT_MODEL: DEFAULT_MODEL, OR_MODEL: OR_MODEL, FALLBACK_MODEL: FALLBACK_MODEL, PROXY_URL: PROXY_URL, dateFrom: dateFrom };
})(window);
