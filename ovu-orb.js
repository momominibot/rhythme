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
  /* Notes are lower-cased with curly apostrophes made straight (iOS types ’), so "can’t" and "haven’t" read like "can't". */
  function norm(text) { return ' ' + String(text || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ') + ' '; }

  /* ---------- what a note says did NOT happen ----------
   * A negation removes only the words it negates, then the rest of the note is read as usual. Once, a leading
   * "no bleeding" returned before the severe pain rule ran, so "No bleeding, but sudden severe pelvic pain" showed
   * no card (docs/debate/2026-10-18-persona-safety-recheck.md). A negated span is a cue (no, not, without, never,
   * nor, -n't), optional helper words ("have", "any", "heavy"), then one or more of the terms below joined by "or"
   * or "nor": "no cramps or bloating" negates both, "no cramps but a headache" keeps the headache. Severe pain,
   * soaking and self-harm are always read from the whole note, so a negation never hides them. */
  var SYM_TERMS = "hot (?:flush|flash)(?:es)?|night sweats?|sweats|breast tenderness|tender breasts|back ?pain|backache|brain fog|low mood|mood swings?|discharge(?: change)?|cramp(?:s|ing)?|headaches?|migraines?|bloat(?:ing|ed)?|fatigue|tired(?:ness)?|exhaust(?:ed|ion)|nause(?:a|ous)|acne|cravings?|insomnia|flush(?:es|ing)?|dizz(?:y|iness)|light-?headed|anxi(?:ety|ous)|irritab(?:le|ility)|forgetful(?:ness)?|foggy|tearful|sad(?:ness)?|low|down|flat|aches?|pain";
  var BLEED_TERMS = "periods?|menses|menstruation|bleed(?:ing|s)?|bled|blood|spotting|flow|pads?|tampons?";
  var NEG_CUE = "(?:\\bno\\b|\\bnot\\b|\\bwithout\\b|\\bnever\\b|\\bnor\\b|\\bzero\\b|\\bcannot\\b|\\b(?:do|does|did|is|are|was|were|has|have|had|ca|could|would|should|wo|ai)n'?t\\b)";
  var NEG_HELP = "(?:have|has|had|get|got|getting|having|feel|felt|feeling|notice|noticed|experience|experienced|been|seen|see|on|in|even)";
  var NEG_ADJ = "(?:any|a|an|my|the|more|real|major|big|bad|heavy|light|medium|new|unusual|abnormal|vaginal|serious|actual|single|proper|further|other|(?:signs?|trace|hint)\\s+of)";
  var NEG_TERM = "(?:" + SYM_TERMS + "|" + BLEED_TERMS + ")";
  var NEG_SPAN = new RegExp(NEG_CUE + "(?:\\s+" + NEG_HELP + ")*(?:\\s+" + NEG_ADJ + ")*\\s+" + NEG_TERM + "\\b(?:\\s+(?:or|nor)(?:\\s+" + NEG_ADJ + ")*\\s+" + NEG_TERM + "\\b)*", 'g');
  /* "my period has not returned", "hasn't come back", "is 5 days late", "missed my period", and a period named only
   * as a time reference ("low before my period") are statements about no bleeding, never flow. */
  var NO_PERIOD_AFTER = /\b(?:my |the |a )?(?:periods?|menses|bleeding) (?:still )?(?:(?:has|have|had|is|was|are|were|does|did|do) ?(?:not|n't)|never|(?:is|are) yet to) (?:yet |still |ever )?(?:come back|came back|returned|return|started|start|come|came|arrived|arrive|resumed|resume|begun|begin|began|back|shown up|showed up|show up|here)\b/g;
  var NO_PERIOD_LATE = /\b(?:my |the )?periods? (?:is|are|was|seems|feels) (?:\w+ ){0,2}?(?:late|overdue|due)\b|\b(?:missed|skipped|skip|miss|missing) (?:a |my |the |this month's )?periods?\b|\bperiods? (?:late|overdue|missed|missing|due)\b|\b(?:before|until|till|ahead of|leading up to|expecting|waiting for|waiting on) (?:my |the |next |a )?periods?\b/g;
  var BLEED_RE = new RegExp('\\b(?:' + BLEED_TERMS + ')\\b');
  /* the note with negated words and no-period statements blanked out (a ';' keeps the neighbours apart) */
  function positive(t) { return t.replace(NEG_SPAN, ' ; ').replace(NO_PERIOD_AFTER, ' ; ').replace(NO_PERIOD_LATE, ' ; '); }
  /* True when the note says there is no period or no bleeding, and nothing left in it names bleeding. Such a note is
   * an observation: it is acknowledged, and it never creates a period day (the calendar's "None" removes a day too). */
  function noPeriod(text) {
    var t = norm(text), said = false;
    (t.match(NEG_SPAN) || []).forEach(function (m) { if (BLEED_RE.test(m)) said = true; });
    if (NO_PERIOD_AFTER.test(t) || NO_PERIOD_LATE.test(t)) said = true;
    NO_PERIOD_AFTER.lastIndex = 0; NO_PERIOD_LATE.lastIndex = 0;
    return said && !BLEED_RE.test(positive(t)) && !SOAK.test(t);
  }

  /* ---------- red flags read before anything else ---------- */
  var SOAK = /\b(?:soak(?:ing|ed|s)?\s+(?:through|a|my|the|one)\b|flood(?:ing|ed|s)?\b|(?:pads?|tampons?|cups?|protection)\s+(?:every|each)\s+(?:hour|half|\d+\s*(?:min|minutes))|(?:chang(?:e|ing|ed)|new)\s+(?:my\s+|a\s+)?(?:pads?|tampons?)\s+(?:every|each)\s+(?:hour|half|\d+\s*min)|bleeding\s+(?:won'?t|will\s*not|does\s*not|doesn'?t|hasn'?t)\s+stop|can'?t\s+stop\s+(?:the\s+)?bleeding|bleeding\s+through\s+(?:my\s+)?(?:clothes|sheets|bedding))/;
  var DIZZY = /\b(?:dizz(?:y|iness)|light-?headed|faint(?:ed|ing|y)?|passed\s+out|black(?:ed|ing)\s+out|woozy)\b/;
  var SEVERE_PAIN = /\b(?:sudden|severe|worst|unbearable|excruciating|stabbing|can'?t\s+stand)\b[^.;]{0,40}\b(?:pelvi\w*|abdom\w*|tummy|belly|stomach|side)\b[^.;]{0,12}\bpain\b|\bpain\b[^.;]{0,25}\b(?:sudden|severe|unbearable|excruciating|worst)\b/;
  var BLEED_WORDS = /\b(?:bleed\w*|period|spotting|blood)\b/;
  /* Thoughts of harming yourself or your baby (design doc section 9; the CDC lists them among urgent maternal warning
   * signs, KKH calls postnatal psychotic depression a psychiatric emergency). Read from the whole note, negation
   * included, because the card's own words are conditional ("If you have thoughts ..."). Everyday phrases ("my feet
   * are killing me", "I hurt my back carrying the baby", "am I hurting my baby by drinking coffee?") do not match:
   * harm to the baby needs a wish, fear or thought in front of it. */
  var SELF_ACT = "(?:hurt(?:ing)?|harm(?:ing)?|kill(?:ing)?|cut(?:ting)?|injur(?:e|ing)|punish(?:ing)?|end(?:ing)?) (?:myself|my (?:own )?life)";
  var BABY_ACT = "(?:hurt(?:ing)?|harm(?:ing)?|kill(?:ing)?|shak(?:e|ing)|smother(?:ing)?|suffocat(?:e|ing)|drown(?:ing)?|hit(?:ting)?|throw(?:ing)?) (?:my|the|our) (?:baby|babies|newborn|infant|little one|child|kids?|son|daughter)";
  var HARM_INTENT = "(?:want(?:ed|s|ing)? to|wanna|feel(?:ing|s)? like|felt like|thoughts? (?:of|about)|think(?:s|ing)? (?:of|about)|thought about|urges? to|tempted to|going to|gonna|plan(?:ning|ned)? to|might|could|would|will|'ll|'d|keep|kept|(?:scared|afraid|worried|terrified) (?:that )?i(?:'ll| will| might| could| would)?|imagin(?:e|ing))";
  var SELF_HARM = new RegExp("\\b" + HARM_INTENT + " (?:i )?(?:" + SELF_ACT + "|" + BABY_ACT + ")\\b|\\bsuicid\\w*|\\bself[- ]?harm\\w*|\\bkill(?:ing)? myself\\b|\\btak(?:e|ing) my (?:own )?life\\b|\\bend(?:ing)? (?:it all|my life)\\b|\\b(?:want(?:ed|s)? to|wanting to|wanna|wish i could) die\\b|\\bwish (?:i )?(?:was|were) dead\\b|\\b(?:don't|do not|no longer) want to (?:live|be alive|be here|exist|wake up)\\b|\\bbetter off (?:dead|without me)\\b");
  var SELF_HARM_COPY = 'If you have thoughts of harming yourself or your baby, you need help now. Call 995 or go to A&E, and ask someone you trust to stay with you. SOS is available 24 hours on 1767, or WhatsApp 9151 1767.'; /* SOS contacts checked 18 October 2026 against the SOS services overview */
  /* Returns an urgent card to show before parsing, or null. Emergency cards need care now (995 or an
   * emergency department); the postmenopausal card is prompt care, not an emergency. Rules only, never a model.
   * A card with its own `message` and `actions` (self-harm) is shown with those words; the others keep the
   * KKH Urgent O&G Centre and 995 copy in the room. */
  function urgent(text, profile) {
    var t = norm(text);
    if (SELF_HARM.test(t)) return { level: 'emergency', code: 'SELF_HARM_NOW', title: 'Please get help now', trigger: 'thoughts of harming yourself or your baby', message: SELF_HARM_COPY, actions: [{ label: 'Call 995', href: 'tel:995' }, { label: 'Call SOS 1767', href: 'tel:1767' }, { label: 'WhatsApp SOS', href: 'https://wa.me/6591511767' }] };
    var pos = positive(t), painText = t.replace(/\b(?:no|without|not in) (?:any )?pain\b/g, ' ; '); /* only a bare "no pain" is set aside for the pain rule */
    var bleeding = BLEED_WORDS.test(pos), soak = SOAK.test(t), dizzy = DIZZY.test(t), severe = SEVERE_PAIN.test(painText);
    var heavy = soak || (/\bheavy\b/.test(pos) && bleeding);
    if (soak && !/\b(?:yesterday|last (?:week|month|cycle)|used to|before)\b/.test(t)) return { level: 'emergency', code: 'HEAVY_BLEED_NOW', title: 'Get emergency care now', trigger: 'bleeding that soaks through protection every hour' + (dizzy ? ' with dizziness' : '') };
    if (heavy && dizzy) return { level: 'emergency', code: 'HEAVY_DIZZY_NOW', title: 'Get emergency care now', trigger: 'heavy bleeding with dizziness or faintness' };
    if (/\b(?:fainted|passed out|blacked out|collapsed)\b/.test(t) && bleeding) return { level: 'emergency', code: 'FAINT_BLEED_NOW', title: 'Get emergency care now', trigger: 'fainting with bleeding' };
    if (/\bpregnan\w*\b/.test(t) && !/\bnot pregnant\b/.test(t) && (bleeding || severe)) return { level: 'emergency', code: 'PREG_BLEED_NOW', title: 'Get emergency care now', trigger: 'bleeding or severe pain in pregnancy' };
    if (severe || (/\bshoulder[- ]tip\b/.test(t) && /\bpain\b/.test(painText))) return { level: 'emergency', code: 'SEVERE_PAIN_NOW', title: 'Get emergency care now', trigger: 'sudden severe pelvic or abdominal pain' };
    var stage = (profile && profile.lifeStage) || '';
    if (['post', 'postmenopause', 'postmenopausal'].indexOf(stage) > -1 && bleeding) return { level: 'prompt', code: 'POSTMENO_BLEED', title: 'Please get this checked this week', trigger: 'bleeding after menopause' };
    return null;
  }

  /* Symptom words people use, mapped onto the app's list (ovu-agents.js SYMPTOMS). Read from the note with negated
   * words removed, so "no hot flushes" logs none. "Flat" is a mood, not a flat white, flatbread or flat noodles. */
  var FLAT_MOOD = "flat(?! ?(?:white|bread|breads|noodles?|rice|tyres?|tires?|shoes?|out|iron|lay|screen|feet|tummy|stomach|belly|mate|share)\\b)";
  var SYM_WORDS = {
    'cramps': /\bcramp/, 'anxiety': /\banxious\b/, 'fatigue': /\b(?:tired|exhausted)\b/, 'headache': /\bmigraine\b/,
    'hot flushes': /\bhot (?:flush|flash)(?:es)?\b|\bnight sweats?\b/, 'irritability': /\birritab(?:le|ility)\b/,
    'brain fog': /\bforgetful(?:ness)?\b|\bfoggy\b/, 'discharge change': /\bdischarge\b/,
    'low mood': new RegExp('\\b(?:sad|down|low|tearful|' + FLAT_MOOD + ')\\b')
  };
  /* "had" is a meal only when what follows is food: "had night sweats", "had cramps after lunch", "had a bad night" are not */
  var NOT_FOOD = new RegExp("^(?:(?:a|an|some|my|the|bad|terrible|awful|really|very|mild|slight|little|bit of|lot of|lots of|such|more|another|no)\\s+)*(?:" + SYM_TERMS + "|" + BLEED_TERMS + "|fever|temperature|nightmares?|(?:bad|good|rough|long|hard|restless|great|terrible|awful|late|early|lazy|busy|tough) (?:night|day|sleep|morning|evening|week)|naps?|sleep|trouble|difficulty|sex|scan|test|appointment|shower|bath|dreams?|baby|contractions?|chills|cold|flu|cough|sore throat|diarrh?o?ea|constipation)\\b");

  function parseLocal(text) {
    var t = norm(text), pos = positive(t), date = dateFrom(text), entries = [];
    // sleep: "slept 7h", "slept 11pm to 7am", "bed at 11:30 woke 6:45", "sleep quality 4"
    var times = t.match(/(?:slept|sleep|bed)\D{0,12}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until|till|→)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    var hours = t.match(/slept\s*(?:for\s*)?(\d{1,2}(?:\.\d)?)\s*(?:h|hr|hrs|hours)/);
    var quality = t.match(/quality\s*(\d)(?:\s*\/\s*5)?/) || t.match(/(\d)\s*\/\s*5/);
    if (times) {
      var bt = toTime(times[1], times[2], times[3] || (Number(times[1]) >= 8 && Number(times[1]) <= 12 ? 'pm' : null)), wt = toTime(times[4], times[5], times[6] || 'am');
      if (bt && wt) entries.push({ type: 'sleep', date: date, data: { bedTime: bt, wakeTime: wt, quality: quality ? Number(quality[1]) : null, notes: '' } });
    } else if (hours) {
      /* Only the length was given: the clock times are back-computed from an assumed 07:00 wake, so the entry says
       * so (assumed: true) and timing rules can leave it out; its duration still counts. */
      var h = Number(hours[1]), wake = '07:00', mins = Math.round(h * 60), bm = (7 * 60 - mins + 1440) % 1440;
      entries.push({ type: 'sleep', date: date, data: { bedTime: pad(Math.floor(bm / 60)) + ':' + pad(bm % 60), wakeTime: wake, quality: quality ? Number(quality[1]) : null, notes: 'Luna assumed a 07:00 wake time from "' + hours[0].trim() + '"', assumed: true } });
    }
    // period. Soaking through protection, flooding or bleeding that will not stop is heavy flow with impact,
    // even when the word "period" is missing (the red-flag sentences are written that way). Negated bleeding
    // ("no period", "not bleeding", "my period has not returned") is never flow.
    var soaking = SOAK.test(t);
    if (/\b(period|menses|menstruat|bleeding|bleed|flow|pads?|tampons?)\b/.test(pos) || soaking) {
      var flow = (soaking || /\bheavy\b/.test(pos)) ? 'heavy' : /\blight\b/.test(pos) ? 'light' : /\bspotting\b/.test(pos) ? 'spotting' : 'medium';
      entries.push({ type: 'period', date: date, data: { flow: flow, clots: /\bclots?\b/.test(pos), impact: soaking || /\b(couldn'?t|missed|stayed home|affected)\b/.test(pos) } });
    }
    // symptoms, pain, mood
    var syms = A.SYMPTOMS.filter(function (s) { return pos.indexOf(' ' + s) > -1 || (SYM_WORDS[s] && SYM_WORDS[s].test(pos) && !(s === 'low mood' && /\blow (?:flow|energy)\b/.test(pos) && !/\b(?:sad|down|tearful)\b/.test(pos))) || (s === 'dizziness' && DIZZY.test(pos)); });
    var pain = pos.match(/\bpain\D{0,6}(\d{1,2})(?:\s*(?:\/|out of)\s*10)?/) || pos.match(/\b(\d{1,2})\s*(?:\/|out of)\s*10\b/);
    var mood = /\b(great|amazing|wonderful)\b/.test(pos) ? 'great' : /\b(good|happy|fine|calm)\b/.test(pos) ? 'good' : /\b(ok|okay|meh|so-so)\b/.test(pos) ? 'ok' : new RegExp('\\b(?:low|sad|down|tearful|' + FLAT_MOOD + ')\\b').test(pos) ? 'low' : /\b(bad|awful|terrible|miserable)\b/.test(pos) ? 'bad' : '';
    if (syms.length || pain || mood) entries.push({ type: 'symptom', date: date, data: { symptoms: syms, pain: pain ? Math.min(10, Number(pain[1])) : null, mood: mood, notes: '' } });
    // food
    var meal = /\bbreakfast\b/.test(t) ? 'breakfast' : /\blunch\b/.test(t) ? 'lunch' : /\bdinner\b/.test(t) ? 'dinner' : /\b(snack|tea break)\b/.test(t) ? 'snack' : null;
    var ateRe = /\b(ate|had|eating|drank|having)\s+(.{3,120}?)(?:\s+for\s+(?:breakfast|lunch|dinner|snack)|[.!,;]|$)/g, ate = null, m, hadOther = false;
    while ((m = ateRe.exec(t))) { if ((m[1] === 'had' || m[1] === 'having') && NOT_FOOD.test(m[2].trim())) { hadOther = true; continue; } ate = m; break; }
    var skipped = /\b(?:skip|skipped|skipping|missed|no|without|didn'?t (?:have|eat)|haven'?t (?:had|eaten)|forgot)\b[^.;,]{0,14}\b(?:breakfast|lunch|dinner|snack|meals?)\b/.test(t);
    // A meal word alone ("since lunch", "before dinner") is not a meal: an eating cue is needed, and a red-flag
    // sentence is never a meal. "Had" counts as a cue only when it was not about a symptom ("had cramps after lunch").
    var eatingCue = /\b(?:for|ate|eat|eating|drank|grabbed|cooked|ordered|bought)\b/.test(t) || (!hadOther && /\b(?:had|having)\b/.test(t));
    if ((ate || (meal && eatingCue)) && !skipped && !soaking && !urgent(text)) {
      var foods = ate ? ate[2].trim() : text.trim();
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
  /* The consent record (ovu-consent.js) is the truth for Luna's three switches; this localStorage copy is its mirror,
     kept for pages that load without the consent module. A method names where a change was made: 'settings', the
     'sheet', or 'jit' at the first use of a feature. */
  function aiConfig() {
    var C = root.OvuConsent;
    if (C) return { on: C.allows('ai_reading'), provider: 'ovumind', insights: C.allows('ai_summaries'), photos: C.allows('food_photo_ai') };
    var c; try { c = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); } catch (e) { c = null; } if (!c) return defaults(); return { on: !!c.on, provider: 'ovumind', insights: c.insights === true, photos: c.photos === true };
  }
  function setAiConfig(cfg, method) {
    var C = root.OvuConsent;
    if (C) { C.setMany({ ai_reading: !!cfg.on, ai_summaries: cfg.insights === true, food_photo_ai: cfg.photos === true }, method || 'settings'); return; }
    localStorage.setItem(AI_KEY, JSON.stringify(cfg));
  }
  /* the phone's word on the purpose, plus the account's token (refreshed if needed) whenever there is a session, so the
     server checks the account's own record and a withdrawal made on another phone holds here too */
  function hdr(p) {
    var h = Object.assign({ 'Content-Type': 'application/json' }, root.OvuConsent ? root.OvuConsent.header(p) : {});
    var A = root.OvuAuth; if (!A || !A.session || !A.session()) return Promise.resolve(h);
    return A.token().then(function (at) { if (at) h.Authorization = 'Bearer ' + at; return h; }, function () { return h; });
  }
  function okEntry(e) { return e && S.TYPES.indexOf(e.type) > -1 && S.validDate(e.date) && e.date <= S.today() && e.data; }
  function parseAI(text) {
    var cfg = aiConfig();
    if (!cfg.on) return Promise.reject(new Error('AI mode is off.'));
    return hdr('ai_reading').then(function (h) { return fetch(PROXY_URL, { method: 'POST', headers: h, body: JSON.stringify({ text: text, today: S.today() }) }); })
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
   * 100 g so changing the grams rescales them. Each item is matched on the relay's local_name first
   * ("bak chor mee (dry)", "kopi c"), then on its descriptive name; hpb.via records which one matched. */
  function foodItemsFrom(food, model) {
    if (!food || food.is_food !== true || !Array.isArray(food.items)) return [];
    var items = food.items.slice(0, 8).map(function (it) {
      var name = String((it && it.name) || '').trim().slice(0, 80); if (!name) return null;
      var local = typeof (it && it.local_name) === 'string' ? it.local_name.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
      var est = estimateItem(it, name, clampNum(it.grams, 2000) || null, model);
      var m = null, via = '';
      if (FD && FD.sgMatch) {
        if (local) { m = FD.sgMatch(local); via = 'local name'; }
        if (!m) { m = FD.sgMatch(name); via = 'item name'; }
      }
      if (!m) return est;
      var out = hpbItem(m, est); out.hpb.via = via;
      if (local) out.hpb.localName = local;
      return out;
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
    var relay = hdr('food_photo_ai').then(function (h) { return fetch(PROXY_URL, { method: 'POST', headers: h, body: JSON.stringify({ image: dataUrl, today: S.today() }) }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna could not answer just now (' + r.status + '). Try again in a moment.')); return d; }); });
    return Promise.all([table, relay]).then(function (rs) { var d = rs[1], f = d.food || {}; return { isFood: f.is_food === true, mealName: f.meal_name || '', note: f.note || '', items: foodItemsFrom(f), hpb: !!rs[0] }; });
  }

  /* A dish name neither table knows: Luna estimates it from the name (her note-reading permission), the phone matches HPB rows */
  function parseDish(name) {
    var table = FD && FD.sgLoad ? FD.sgLoad().catch(function () { return null; }) : Promise.resolve(null);
    var relay = hdr('ai_reading').then(function (h) { return fetch(PROXY_URL, { method: 'POST', headers: h, body: JSON.stringify({ dish: String(name || '').slice(0, 80), today: S.today() }) }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna could not answer just now (' + r.status + '). Try again in a moment.')); return d; }); });
    return Promise.all([table, relay]).then(function (rs) { var f = rs[1].food || {}; return { isFood: f.is_food === true, mealName: f.meal_name || '', note: f.note || '', items: foodItemsFrom(f) }; });
  }
  /* Ingredients label photo: Luna transcribes the list once (same permission as food photos); the NOVA rule runs on the phone. */
  function parseLabel(dataUrl) {
    if (!photosAllowed()) return Promise.reject(new Error('Food photos are off. Allow them in Luna’s settings first.'));
    return hdr('food_photo_ai').then(function (h) { return fetch(PROXY_URL, { method: 'POST', headers: h, body: JSON.stringify({ image: dataUrl, mode: 'label', today: S.today() }) }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Luna could not answer just now (' + r.status + '). Try again in a moment.')); return d; }); })
      .then(function (d) { var l = d.label || {}; var str = function (v) { return typeof v === 'string' ? v.trim() : ''; }; return { isLabel: l.is_label === true && !!str(l.ingredients_text), productName: str(l.product_name), quantity: str(l.quantity), ingredientsText: str(l.ingredients_text), complete: l.complete !== false, note: str(l.note) }; });
  }

  /* ---------- describe entries for the confirmation card ---------- */
  function describe(e) {
    var d = e.data;
    if (e.type === 'sleep') return 'Sleep ' + d.bedTime + ' → ' + d.wakeTime + ' (' + A.fmtHours(S.sleepHours(d)) + ')' + (d.quality ? ', quality ' + d.quality + '/5' : '') + (d.assumed ? ', wake time assumed' : '');
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
      if (e.type === 'sleep') { if (!S.validTime(data.bedTime) || !S.validTime(data.wakeTime)) return; data = { bedTime: data.bedTime, wakeTime: data.wakeTime, quality: data.quality ? Math.max(1, Math.min(5, Number(data.quality))) : null, notes: data.notes || '', mode: 'luna' }; if (e.data.assumed === true) data.assumed = true; }
      if (e.type === 'period') { data = { flow: ['spotting', 'light', 'medium', 'heavy'].indexOf(data.flow) > -1 ? data.flow : 'medium', clots: !!data.clots, impact: !!data.impact }; }
      if (e.type === 'mindfulness') { data = { kind: 'breathe', minutes: Math.max(1, Number(data.minutes) || 1), completed: true, guide: 'Logged through Luna' }; }
      saved.push(S.add(e.type, e.date, data, 'luna', { merge: e.type === 'symptom' || e.type === 'period' }));
    });
    return saved;
  }
  var REPLIES = ['Noted, gently.', 'Written down. Thank you for telling me.', 'Got it. One small step logged.', 'Saved. Be soft with yourself today.'];
  function reply() { return REPLIES[Math.floor(Math.random() * REPLIES.length)]; }

  root.OvuOrb = { parseLocal: parseLocal, parseAI: parseAI, urgent: urgent, noPeriod: noPeriod, parsePhoto: parsePhoto, parseDish: parseDish, parseLabel: parseLabel, foodItemsFrom: foodItemsFrom, regram: regram, rename: rename, photosAllowed: photosAllowed, describe: describe, save: save, aiConfig: aiConfig, setAiConfig: setAiConfig, reply: reply, PROXY_URL: PROXY_URL, dateFrom: dateFrom };
})(window);
