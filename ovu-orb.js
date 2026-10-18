/* Luna, the crystal moon orb. Type a note; Luna turns it into journal entries.
 * A local rule parser runs first and never leaves the device. When the rules
 * cannot read a note, Luna reads it through Rhythme's own service, and every
 * extracted entry is still shown for confirmation before it is saved. */
(function (root) {
  'use strict';
  var S = root.OvuStore, A = root.OvuAgents, FD = root.OvuFood;
  var AI_KEY = 'ovumind_ai_v1';
  var PROXY_URL = ((root.OVU_CONFIG && root.OVU_CONFIG.functionsBase) || 'https://zodkohwaznqgrfrcfdkf.supabase.co/functions/v1') + '/luna'; /* Rhythme's own service: origin-locked, about 80 notes a day per person */

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
    /* Under-16s who mention a possible pregnancy get support contacts, never logging advice. */
    if (['under13', '13-16', '13-17'].indexOf((profile && profile.ageBand) || '') > -1 && /\b(pregnan\w*|missed (my )?period|period (is |was )?late|late period|unprotected|condom (broke|tore)|morning after pill|plan b|pregnancy test)\b/.test(t)) return { level: 'safeguard', code: 'MINOR_PREGNANCY', title: 'You don’t have to handle this alone', trigger: 'a possible pregnancy at 16 or under' };
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

  /* ---------- Luna's reading through Rhythme's own service ---------- */
  /* Switched on when the data notice is accepted at first launch; reading notes, written readings
   * (insights) and food photos can each be switched off in Luna's settings. */
  function defaults() { return { on: false, provider: 'ovumind', insights: false, photos: false }; }
  function aiConfig() { var c; try { c = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); } catch (e) { c = null; } if (!c) return defaults(); return { on: !!c.on, provider: 'ovumind', insights: c.insights === true, photos: c.photos === true }; }
  function setAiConfig(cfg) { localStorage.setItem(AI_KEY, JSON.stringify(cfg)); }
  function okEntry(e) { return e && S.TYPES.indexOf(e.type) > -1 && S.validDate(e.date) && e.date <= S.today() && e.data; }
  function parseAI(text) {
    var cfg = aiConfig();
    if (!cfg.on) return Promise.reject(new Error('AI mode is off.'));
    return fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, today: S.today() }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna could not answer just now (' + r.status + '). Try again in a moment.')); return d; }); })
        .then(function (d) { return { entries: (d.entries || []).filter(okEntry), reply: d.reply || '', usage: d.usage || null }; });
  }

  /* ---------- food photos: Luna's relay looks at the photo, the user confirms ---------- */
  function photosAllowed() { var c = aiConfig(); return c.photos === true; }
  function clampNum(v, max) { var n = Number(v); return isFinite(n) && n >= 0 ? Math.min(max, Math.round(n * 10) / 10) : null; }
  function conf(c) { return ['high', 'medium', 'low'].indexOf(c) > -1 ? c : 'low'; }
  /* One diary item straight from the model's numbers, labelled as an estimate. */
  function estimateItem(it, name, grams, model) {
    var n = { kcal: clampNum(it.kcal, 3000), protein: clampNum(it.protein_g, 300), carb: clampNum(it.carb_g, 500), fat: clampNum(it.fat_g, 300), fiber: clampNum(it.fiber_g, 100) };
    var per100 = {}; Object.keys(n).forEach(function (k) { per100[k] = grams && n[k] !== null ? n[k] * 100 / grams : null; });
    var nutrients = {}; (FD ? FD.KEYS : Object.keys(n)).forEach(function (k) { nutrients[k] = n.hasOwnProperty(k) ? n[k] : null; });
    var portion = String(it.portion || 'serving').slice(0, 20);
    return {
      name: name, foodId: null, basis: '100g', prep: null,
      source: { kind: 'estimate', label: 'Luna’s photo estimate', ref: 'Luna', date: S.today(), detail: 'Estimated from a photo; confidence ' + conf(it.confidence) },
      grams: grams || 0, portionLabel: '1 ' + portion + (grams ? ' (about ' + Math.round(grams) + ' g)' : ''), method: 'photo estimate',
      confidence: conf(it.confidence), per100: per100, nutrients: nutrients
    };
  }
  /* The same dish from an HPB SG FoodID row: HPB per-100 g values × the model's grams, or × the HPB
   * serving weight when the model's grams are missing or far from a normal serving (under 40 % or over
   * 250 % of it). The model's own estimate is kept on the item so a rename can fall back to it. */
  function hpbItem(m, est) {
    var f = m.food, sv = (f.serving && f.serving.g) || null, g = est.grams || null, unit = f.basis === '100ml' ? 'ml' : 'g', viaServing = false;
    if (!g || (sv && (g < sv * 0.4 || g > sv * 2.5))) { g = sv || g || 100; viaServing = !!sv; }
    return {
      name: f.name, foodId: f.id, basis: f.basis || '100g', prep: null, source: f.source, grams: g,
      portionLabel: viaServing ? (f.serving.label || '1 serving') + ' (HPB serving)' : (est.portionLabel.replace(/\s*\(.*\)$/, '') || '1 serving') + ' (about ' + Math.round(g) + ' ' + unit + ')',
      method: 'photo + HPB SG FoodID', confidence: est.confidence, per100: f.n, nutrients: FD.scale(f.n, g),
      hpb: { crId: f.crId, cat: f.cat || null, desc: String(f.desc || '').slice(0, 200), alias: m.alias, servingG: sv, viaServing: viaServing, modelName: est.name, modelGrams: est.grams || null, modelKcal: est.nutrients.kcal },
      estimate: est
    };
  }
  /* Turns the relay's estimate into diary items in the same shape as hand-logged foods. A dish whose
   * name matches an HPB SG FoodID row (when the table is loaded) uses HPB's per-100 g values and is
   * labelled 'hpb'; anything else stays the model's estimate. Nutrients are kept per item and also per
   * 100 g so changing the grams rescales them. */
  function foodItemsFrom(food, model) {
    if (!food || food.is_food !== true || !Array.isArray(food.items)) return [];
    var items = food.items.slice(0, 8).map(function (it) {
      var name = String((it && it.name) || '').trim().slice(0, 80); if (!name) return null;
      var est = estimateItem(it, name, clampNum(it.grams, 2000) || null, model);
      var m = FD && FD.sgMatch ? FD.sgMatch(name) : null;
      return m ? hpbItem(m, est) : est;
    }).filter(Boolean);
    /* The model often names the dish only in meal_name ("Bak chor mee dry with soup") and describes the
     * items ("dry flat noodles with minced pork ..."). When nothing matched by item name, the meal name
     * is matched onto the dominant dish (at least 60 % of the photo's kcal), so sides such as the soup
     * stay estimates and a set split into several parts is never counted twice. */
    var mm = FD && FD.sgMatch && items.length && !items.some(function (it) { return it.source.kind === 'hpb'; }) ? FD.sgMatch(food.meal_name) : null;
    if (mm) {
      var total = 0, main = null;
      items.forEach(function (it) { var k = it.nutrients.kcal || 0; total += k; if (!main || k > (main.nutrients.kcal || 0)) main = it; });
      if (main && (items.length === 1 || (total > 0 && (main.nutrients.kcal || 0) / total >= 0.6))) {
        var i = items.indexOf(main), viaMeal = hpbItem(mm, main);
        viaMeal.hpb.via = 'meal name'; viaMeal.hpb.mealName = String(food.meal_name || '').slice(0, 80);
        items[i] = viaMeal;
      }
    }
    return items;
  }
  /* A renamed item is matched again: an HPB row if the new name has one, otherwise the model's own estimate under the new name. */
  function rename(item, name) {
    name = String(name || '').trim().slice(0, 80); if (!name) return item;
    var est = Object.assign({}, item.estimate || item, { name: name });
    if (est.source && est.source.kind === 'hpb') { est = Object.assign({}, est, { foodId: null, source: { kind: 'estimate', label: 'Luna’s photo estimate', ref: 'renamed', date: S.today(), detail: 'Renamed; the HPB match no longer applies' }, method: 'photo estimate', per100: {}, hpb: undefined, estimate: undefined }); }
    var m = FD && FD.sgMatch ? FD.sgMatch(name) : null;
    if (m) { var it = hpbItem(m, Object.assign({}, est, { grams: item.grams })); return it; }
    return regram(est, item.grams) || est;
  }
  function regram(item, grams) {
    grams = clampNum(grams, 2000); if (!grams) return item;
    var unit = item.basis === '100ml' ? 'ml' : 'g', base = item.hpb && item.hpb.viaServing ? '1 serving' : item.portionLabel.replace(/\s*\([^()]*\)$/, '');
    var out = Object.assign({}, item, { grams: grams, portionLabel: base + ' (about ' + Math.round(grams) + ' ' + unit + ')', nutrients: Object.assign({}, item.nutrients) });
    if (item.hpb) out.hpb = Object.assign({}, item.hpb, { viaServing: false });
    Object.keys(item.per100 || {}).forEach(function (k) { var v = item.per100[k]; out.nutrients[k] = v === null || v === undefined ? null : Math.round(v * grams / 10) / 10; });
    return out;
  }
  function parsePhoto(dataUrl) {
    if (!photosAllowed()) return Promise.reject(new Error('Food photos are off. Allow them in Luna’s settings first.'));
    var table = FD && FD.sgLoad ? FD.sgLoad().catch(function () { return null; }) : Promise.resolve(null);
    var relay = fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, today: S.today() }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna could not answer just now (' + r.status + '). Try again in a moment.')); return d; }); });
    return Promise.all([table, relay]).then(function (rs) { var d = rs[1], f = d.food || {}; return { isFood: f.is_food === true, mealName: f.meal_name || '', note: f.note || '', items: foodItemsFrom(f), hpb: !!rs[0] }; });
  }

  /* Ingredients label photo: Luna transcribes the list once (same permission as food photos); the NOVA rule runs on the phone. */
  function parseLabel(dataUrl) {
    if (!photosAllowed()) return Promise.reject(new Error('Food photos are off. Allow them in Luna’s settings first.'));
    return fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, mode: 'label', today: S.today() }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna could not answer just now (' + r.status + '). Try again in a moment.')); return d; }); })
      .then(function (d) { var l = d.label || {}; var str = function (v) { return typeof v === 'string' ? v.trim() : ''; }; return { isLabel: l.is_label === true && !!str(l.ingredients_text), productName: str(l.product_name), quantity: str(l.quantity), ingredientsText: str(l.ingredients_text), complete: l.complete !== false, note: str(l.note) }; });
  }

  /* ---------- describe entries for the confirmation card ---------- */
  function describe(e) {
    var d = e.data;
    if (e.type === 'sleep') return 'Sleep ' + d.bedTime + ' → ' + d.wakeTime + ' (' + A.fmtHours(S.sleepHours(d)) + ')' + (d.quality ? ', quality ' + d.quality + '/5' : '');
    if (e.type === 'period') return 'Period: ' + d.flow + ' flow' + (d.largeClots ? ', clots over 2.5 cm' : d.clots ? ', clots' : '') + (d.flooding ? ', soaked through' : '') + (d.impact ? ', affected the day' : '');
    if (e.type === 'symptom') return 'Symptoms: ' + ((d.symptoms || []).join(', ') || 'none ticked') + (d.pain !== null && d.pain !== undefined ? ', pain ' + d.pain + '/10' : '') + (d.mood ? ', mood ' + d.mood : '');
    if (e.type === 'food') return (d.meal ? d.meal.charAt(0).toUpperCase() + d.meal.slice(1) : 'Meal') + ': ' + d.foods + ((d.tags || []).length ? ' (' + d.tags.join(', ') + ')' : '');
    if (e.type === 'mindfulness') return 'Mindfulness: ' + d.minutes + ' min';
    if (e.type === 'weight') return 'Weight: ' + d.kg + ' kg';
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

  root.OvuOrb = { parseLocal: parseLocal, parseAI: parseAI, urgent: urgent, parsePhoto: parsePhoto, parseLabel: parseLabel, foodItemsFrom: foodItemsFrom, regram: regram, rename: rename, photosAllowed: photosAllowed, describe: describe, save: save, aiConfig: aiConfig, setAiConfig: setAiConfig, reply: reply, PROXY_URL: PROXY_URL, dateFrom: dateFrom };
})(window);
