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
  var NO_PERIOD_LATE = /\b(?:my |the )?periods? (?:is|are|was|seems|feels) (?:\w+ ){0,2}?(?:late|overdue|due)\b|\b(?:missed|skipped|skip|miss|missing) (?:a |my |the |this month's )?periods?\b|\bperiods? (?:late|overdue|missed|missing|due)\b|\b(?:before|until|till|ahead of|leading up to|expecting|waiting for|waiting on) (?:my |the |next |a )?periods?\b|\bperiods?\s+(?:is\s+|are\s+|already\s+)?(?:\d+|one|two|three|a few|few)\s+(?:days?|weeks?|wks?)\s+(?:late|overdue)\b|\blate\s+(?:by\s+)?(?:\d+|a few|few|two|three)\s+(?:days?|weeks?)\b/g;
  var BLEED_RE = new RegExp('\\b(?:' + BLEED_TERMS + ')\\b');
  /* worry about a period, or one that is coming, is a feeling or a wait, never flow (four-persona review, 20 Oct: Wei Ling's
   * "worried my period is coming" was offered as a medium period day). The feeling itself is still read as a symptom. */
  var PERIOD_WORRY = /\b(?:worried|worry|worrying|worries|anxious|nervous|scared|afraid|dread(?:ing|ed)?|hop(?:e|ing|ed)|praying|wondering|thinking|stress(?:ed|ing)?|obsessing)\b(?: so much)?(?: about| that| if| whether| over)?(?: my| the| this| next| another)? periods?\b|\bperiods? (?:is |are )?(?:coming|will come|might come|may come|could come|going to come|gonna come|about to (?:start|come)|on (?:its|the) way|will (?:start|arrive)|might (?:start|arrive))\b|\bwhen (?:will|does|is|do) (?:my |the |a )?periods?\b/g;
  /* the note with negated words and no-period statements blanked out (a ';' keeps the neighbours apart) */
  function positive(t) { return t.replace(NEG_SPAN, ' ; ').replace(NO_PERIOD_AFTER, ' ; ').replace(NO_PERIOD_LATE, ' ; ').replace(PERIOD_WORRY, function (m) { return m.replace(/\bperiods?\b/g, ' ; '); }); }
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
  var SOAK = /\b(?:soak(?:ing|ed|s)?\s+(?:through\s+)?(?:(?:a|my|the|one|\d+|two|three)\s+)?(?:\w+\s+)?(?:pads?|tampons?|cups?|liners?|underwear|panties|pants|shorts|sheets?|bedsheets?|mattress|clothes|jeans|uniform|skirt)\b|soaking\s+through\b|(?:pads?|tampons?|cups?)\s+(?:is\s+|are\s+|get\s+|gets\s+)?(?:full|soaked|soaking|filled|leaking)\s+(?:every|each|in|within)?\s*(?:\d+\s*(?:min|mins|minutes)|half\s+(?:an\s+)?hour|an?\s+hour|1\s*(?:h|hr|hour))|(?:pads?|tampons?)\s+(?:soak\w*|full)\s+(?:hourly|every\s+hour)|flood(?:ing|ed|s)?\b|(?:pads?|tampons?|cups?|protection)\s+(?:every|each)\s+(?:hour|half|\d+\s*(?:min|minutes))|(?:chang(?:e|ing|ed)|new)\s+(?:my\s+|a\s+)?(?:pads?|tampons?)\s+(?:every|each)\s+(?:hour|half|\d+\s*min)|soak\w*\s+(?:through\s+)?(?:\d+|two|three|four|five|several|many)\s+(?:pads?|tampons?|liners?)|(?:\d+|two|three|four|five)\s+(?:pads?|tampons?)\s+(?:in|within|per|an?)\s+(?:1\s+|one\s+)?(?:hour|hr|h)\b|bleeding\s+(?:won'?t|will\s*not|does\s*not|doesn'?t|hasn'?t)\s+stop|can'?t\s+stop\s+(?:the\s+)?bleeding|bleeding\s+through\s+(?:my\s+)?(?:clothes|sheets|bedding))/;
  var DIZZY = /\b(?:dizz(?:y|iness)|light-?headed|faint(?:ed|ing|y)?|passed\s+out|black(?:ed|ing)\s+out|woozy|giddy|giddiness|pengsan|pitam|black ?out)\b/;
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
  /* the baby is named only when the note or the profile has one (four-persona review, 20 Oct: Mrs Tan at 54 was told about "your baby") */
  var SELF_HARM_COPY_SELF = 'If you have thoughts of harming yourself, you need help now. Call 995 or go to A&E, and ask someone you trust to stay with you. SOS is available 24 hours on 1767, or WhatsApp 9151 1767.';
  var SOS_ACTIONS = [{ label: 'Call 995', href: 'tel:995' }, { label: 'Call SOS 1767', href: 'tel:1767' }, { label: 'WhatsApp SOS', href: 'https://wa.me/6591511767' }];
  var CALL_995 = [{ label: 'Call 995', href: 'tel:995' }];

  /* ---------- emergencies beyond the period (four-persona review, 20 Oct 2026, docs/debate/2026-10-20-four-personas.md) ----------
   * Rules only, never a model. A symptom counts when it is said, not when it is denied: "no chest pain" or "I don't have
   * a fever" never raise a card, "no fever but chest pain" does. The emergency signs follow SCDF's list for calling 995
   * and the NHS/RCOG/KKH pages cited in the debate file; the same-day signs follow the CDC's maternal warning signs,
   * RCOG on ectopic pregnancy and pelvic infection, and the NHS on blood clots. */
  /* A sign counts when it is said, not when it is denied (Codex branch review, 20 Oct):
   * - a denial is a cue in the same small clause just before the sign ("no chest pain", "I don't have a fever"); a clause
   *   ends at punctuation and at and, but, also, plus, then, now, though, so "no fever and my chest is tight" keeps the chest;
   * - phrases that deny the improvement, not the sign ("no improvement in", "not getting better", "won't stop") are not denials;
   * - a denial inside the matched words ("my face is not swollen") denies it, apart from the can't of "can't breathe";
   * - opts.unless: a benign explanation clears only the comma-clause that holds the sign ("my arm went numb sleeping on it"),
   *   never another sign elsewhere in the note. */
  var CLAUSE_END = /[.;!?,]|\b(?:and|but|also|plus|then|now|though|although|however)\b/;
  var NOT_DENIAL = /\b(?:no|not|isn'?t|is not|hasn'?t|has not|haven'?t|have not)\s+(?:any\s+)?(?:improvement|better|easing|relief|change|let ?up|end|sign of (?:it )?(?:stopping|easing|going)|getting better|going away|gone away|stopping|help|helping|working)\b|\b(?:won'?t|doesn'?t|does not|will not|can'?t|cannot)\s+(?:stop|ease|settle|go away|get better)\b|\bnothing\s+(?:helps|works)\b/g;
  var DENY = /\b(?:no|not|without|never|nor|zero|denies?|none)\b|n't\b/;
  /* a benign explanation in the clause, not itself denied ("but no pins and needles" explains nothing) */
  function explained(re, text, from, to) {
    var g = new RegExp(re.source, 'g'), m;
    while ((m = g.exec(text))) {
      if (m[0] === '') { g.lastIndex++; continue; }
      /* the words leading up to the explanation, but never the sign's own words (the can't of "can't breathe") */
      var lead = m.index >= to ? text.slice(to, m.index) : text.slice(Math.max(0, m.index - 16), Math.min(m.index, from >= 0 ? from : m.index));
      /* denied when a denial is followed only by linking words: "but no pins and needles", "not due to sleeping on it";
       * "with no pain from sleeping on it" denies the pain, not the explanation */
      if (!/(?:\b(?:no|not|never|without)|n't)\s+(?:(?:due|because|caused|related|from|after|by|of|to|it|is|was|that|this|really|just|from)\s+){0,3}$/.test(' ' + lead.split(/[.;!?,]/).pop())) return true;
    }
    return false;
  }
  function said(re, t, opts) {
    var g = new RegExp(re.source, 'g'), m;
    while ((m = g.exec(t))) {
      if (m[0] === '') { g.lastIndex++; continue; }
      var before = t.slice(Math.max(0, m.index - 40), m.index).replace(NOT_DENIAL, ' ').split(CLAUSE_END).pop();
      var inside = m[0].replace(/\b(?:can'?t|cannot|could\s*n'?t|couldn'?t|unable)\b/g, ' ').replace(/\b(?:aren'?t|are not|isn'?t|is not|weren'?t|were not|not)\s+(?:really\s+)?there\b/g, ' ').replace(/\b(?:no ?one|nobody)(?:\s+else)?\b/g, ' ').replace(/\bno\s+(?:strength|power|feeling)\b/g, ' weak ').replace(NOT_DENIAL, ' ');
      var after = t.slice(m.index + m[0].length, m.index + m[0].length + 16);
      if (DENY.test(before) || DENY.test(inside) || /^\s*[:?=-]?\s*(?:none|nil|nope|n\/a)\s*(?:[.;,!?]|$|today|now)|^\s*[:?=-]?\s*,?\s*(?:no|not really)\s*(?:[.;,!?]|$)/.test(after)) continue; /* "chest pain: none", "chest pain? no." but never "chest pain no fever" */
      if (opts && opts.unless) {
        /* the clause around the sign: back to the last boundary before it, on to the next one after it; opts.sentence widens
         * that to the sentence (punctuation only), for explanations that are joined by "and" ("numb with pins and needles") */
        var END = opts.sentence ? /[.;!?]/ : CLAUSE_END;
        var head = t.slice(0, m.index).split(END).pop(), tail = t.slice(m.index + m[0].length).split(END)[0];
        if (explained(opts.unless, head + m[0] + tail, head.length, head.length + m[0].length)) continue;
      }
      return true;
    }
    return false;
  }
  var CHEST = /\bchest\s+(?:pains?|tight\w*|pressure|hurts?|hurting|aches?|aching)\b|\bpains?\s+in\s+(?:my\s+)?chest\b|\btight\s+chest\b|\bcrushing\b[^.;]{0,15}\bchest\b|\bchest\b[^.;]{0,12}\b(?:feels?|is|was|felt|getting)\s+(?:so\s+|very\s+|really\s+)?(?:tight|heavy|crushed|painful)\b|\bchest\b(?!\s+of\s+drawers)(?:\s+\w+){0,2}?\s+(?:tight|tightness|heavy|crushing|pressure)\b/;
  var BREATH = /\b(?:can'?t|cannot|could\s*n'?t|struggling to|struggle to|hard to|unable to)\s+(?:catch\s+my\s+)?breath\w*\b|\b(?:can'?t|cannot)\s+(?:catch|get)\s+my\s+breath\b|\b(?:trouble|difficulty|difficult|problems?)\s+breathing\b|\bgasping\b|\bbreathing\s+(?:is\s+|got\s+|getting\s+|also\s+got\s+|become\s+)?(?:worse|hard|difficult|noisy|laboured|labored|struggling|very fast)\b|\bwheez\w*\b|\b(?:inhaler|puffer|ventolin)\s+(?:no|not|doesn'?t|didn'?t|isn'?t|also no|cannot)\s+(?:help\w*|work\w*)\b|\b(?:short(?:ness)?\s+of\s+breath|breathless(?:ness)?)\b[^.;]{0,25}\b(?:rest|sitting|lying|sudden\w*|worse|worsening|even)\b|\b(?:sudden\w*|very|really|so|extremely|severely|badly)\s+(?:breathless\w*|short of breath)\b/;
  var STROKE = /\b(?:face|mouth)\s+(?:is\s+|has\s+|went\s+)?(?:droop\w*|lopsided|fallen)\b|\bdroop\w*\s+(?:face|mouth|on one side)\b|\bslurr\w*\s+(?:speech|words|my words|talking)\b|\b(?:speech|words)\s+(?:is\s+|are\s+)?slurr\w*\b|\bsudden\w*\s+(?:loss of|lost)\s+(?:vision|sight|my sight)\b|\bsudden\w*\s+(?:can'?t|cannot)\s+(?:see|speak|talk|move)\b|\b(?:can'?t|cannot|can not)\s+(?:speak|talk|find my words)\s+(?:properly|clearly|well)\b|\b(?:face|mouth)\b[^.;]{0,15}?\bdroop\w*\b|\b(?:speech|words|talking|voice)\b[^.;]{0,20}?\bslurr\w*\b|\b(?:half|part)\s+(?:of\s+)?my\s+(?:\w+\s+)?(?:vision|sight)\s+(?:is\s+|went\s+)?(?:gone|lost|black|dark|missing)\b|\bvision\s+(?:gone|went black|blacked out)\b/;
  var STROKE_LIMB = /\b(?:arm|face)\s+(?:went|is|feels?|felt|going|has gone)\s+(?:weak|numb|dead|limp)\b|\bsudden\w*\b[^.;]{0,15}?\b(?:arm|leg|face|one side)\b[^.;]{0,15}?\b(?:weak|numb|limp)\w*\b|\bone side\b[^.;]{0,20}?\b(?:weak|numb)\w*\b|\b(?:arm|hand|face|one side)\b[^.;]{0,12}?\b(?:go|goes|went|gone|is|feels?|felt)\s+(?:all\s+|very\s+|so\s+)?(?:numb|weak|limp|dead)\b|\b(?:arm|hand)\b[^.;]{0,15}?\b(?:can'?t|cannot)\s+(?:lift|move|hold|grip)\b|\b(?:can'?t|cannot)\s+(?:hold|grip|lift)\b[^.;]{0,20}?\b(?:cup|things|phone|pen|spoon)\b|\b(?:arm|hand|one side)\b[^.;]{0,10}?\bno\s+(?:strength|power|feeling)\b/;
  var STROKE_NOT = /\b(?:sleeping on|slept on|lying on|lay on|sitting on|sat on|crossed my legs|cross-legged|pins and needles|sitting|sat|stand(?:ing)? up|stood up|got up|squatting|kneeling|lean(?:ing|ed)? on)\b/;
  var ALLERGY = /\b(?:swollen|swelling|swelled|swell|swells)\b[^.;]{0,15}?\b(?:face|lips?|tongue|throat|mouth|eyes?|eyelids?)\b|\b(?:face|lips?|tongue|throat|mouth)\b[^.;]{0,30}?\b(?:swollen|swelling|swelled|swell|swells|puff\w* up)\b|\bthroat\b[^.;]{0,12}?\b(?:closing|tight\w*)\b|\b(?:puffy|puffed up)\s+(?:lips?|tongue|throat)\b|\bthroat\s+(?:is\s+|feels?\s+)?(?:closing|tight\w*)\b|\banaphyla\w*\b/;
  var PSYCHOSIS = /\bhallucinat\w*\b|\bvoices?\s+in\s+my\s+head\b|\bvoices?\b[^.;]{0,25}?\b(?:no ?one|nobody)\s+else\b|\bseeing\s+(?:things|people)\b[^.;]{0,25}?\b(?:aren'?t|are not|isn'?t|weren'?t|not)\s+(?:really\s+)?there\b|\bhear(?:ing)?\s+(?:someone|somebody|people|a voice|voices|things|my name)\b[^.;]{0,45}?\b(?:no ?one|nobody)\b(?:\s+else)?(?:\s+(?:is|was))?\s*(?:there|around|home|at home|else|in the room)?|\bsee(?:ing)?\s+(?:dark\s+)?(?:shadows?|figures?|people|someone|things)\b[^.;]{0,35}?\b(?:no ?one|nobody|not there|aren'?t there|isn'?t there)\b|\bsee(?:ing)?\s+(?:dark\s+)?(?:shadows?|figures?)\s+(?:standing|near|by|beside|around|over)\b|\b(?:tv|television|radio|phone|songs?|numbers?|signs?|car plates?)\b[^.;]{0,20}?\b(?:sends?|sending|send|giving|gives|talks?|talking)\s+(?:to\s+)?me\s+(?:special\s+|secret\s+|hidden\s+|private\s+)?(?:messages?|signs?|signals?|codes?)\b|\bspecial\s+messages?\s+(?:for|to|only for)\s+me\b/;
  var PSY_HEARD = /\bhearing\s+(?:voices|things)\b|\bhear\s+voices\b|\bvoices\b[^.;]{0,20}?\btell(?:ing)?\s+me\b|\bvoices?\s+(?:say|says|said|saying|tell|tells|told|telling|ask|asking|order|ordering)\b|\b(?:people|everyone|they|someone)\s+(?:are|is)\s+(?:watching|following|plotting against|out to get)\s+me\b/;
  var PSY_ORDINARY = /\b(?:tv|television|radio|zoom|teams|video|call|meeting|neighbou?rs?|next door|outside|upstairs|downstairs|podcast|youtube|phone|stream|livestream|cctv|camera|baby monitor|kitchen|living room|the street|my (?:friends?|family|husband|partner|kids?|children|mum|mom|mother|sister|brother))\b|\bfrom\s+(?:my|the|our)\b/;
  var VISION_SIGN = "(?:(?:blurr\\w*|double|dim|patchy)\\s+vision|vision\\s+(?:is\\s+|went\\s+|goes\\s+|getting\\s+|has\\s+gone\\s+|keeps\\s+going\\s+)?(?:very\\s+|really\\s+|so\\s+|a\\s+bit\\s+|quite\\s+|all\\s+)?(?:blurr\\w*|funny|strange|dark|dim|spotty|patchy|double|weird)|(?:everything|things)\\s+(?:looks?|looking|is|are|went|seems?)\\s+(?:very\\s+|really\\s+|so\\s+|a\\s+bit\\s+)?(?:blurr\\w*|double|dark|dim)|(?:my\\s+)?eyes\\s+(?:are|went|feel|look)\\s+(?:very\\s+|so\\s+|a\\s+bit\\s+)?blurr\\w*|seeing\\s+(?:spots|stars|flash\\w*|double|blurr\\w*)|flash\\w*\\s+lights?|spots\\s+(?:in|before)\\s+my\\s+eyes|vision\\s+changes?|lost\\s+(?:my\\s+)?vision|can'?t\\s+see\\s+(?:properly|clearly|well))";
  var HEAD_VISION = new RegExp("\\b(?:severe|bad|worst|terrible|pounding|sudden|excruciating|splitting)\\b[^.;]{0,20}?\\bheadache\\b[^.;]{0,40}?\\b" + VISION_SIGN + "|\\b" + VISION_SIGN + "\\b[^.;]{0,40}?\\b(?:severe|bad|worst|terrible|pounding|splitting)\\b[^.;]{0,15}?\\bheadache\\b|\\bworst headache\\b|\\bthunderclap\\b");
  var SADDLE = /\bnumb\w*\b[^.;]{0,25}?\b(?:groin|bottom|buttocks|between my legs|saddle)\b|\b(?:groin|saddle)\b[^.;]{0,15}?\bnumb\w*/;
  /* pregnant now, or possibly: "trying to get pregnant", "not pregnant" and "pregnancy test was negative" are not (an earlier rule raised
   * the pregnancy-bleeding emergency for "trying to get pregnant, period came today") */
  function pregnantNow(t) {
    var s = t.replace(/\b(?:get|getting|got|become|becoming|trying (?:to|for)|try (?:to|for)|tried (?:to|for)|chances? of|want(?:ed|ing|s)? to|hop(?:e|ed|ing) to|not|never been|wasn'?t|isn'?t|am not|i'm not|planning to|plan to)\s+(?:get\s+|be\s+|been\s+|a\s+|getting\s+)?(?:pregnan\w*|preggy|preggers)/g, ' ; ').replace(/\b(?:urine\s+)?pregnancy tests?\b[^.;]{0,25}\bnegative\b|\bnegative\b[^.;]{0,15}\b(?:urine\s+)?pregnancy tests?\b/g, ' ; ').replace(/\bpregnancy tests?\b/g, ' test ');
    /* a positive test is a pregnancy test unless another test is named in it or right after it ("positive covid test",
     * "positive test for covid"); words further away ("and blood in my discharge", "but not pregnant") do not count */
    var OTHER = '(?:covid|art|antigen|pcr|flu|dengue|ovulation|opk|lh|strep|uti|drug|swab|blood|hiv|std|sti)';
    var rv = /\b(?:pregnancy|preg|hpt)\s+tests?\b([^.;]{0,24}?)\bpositive\b/g, rm, positiveTest = false;
    while ((rm = rv.exec(t))) { if (!DENY.test(' ' + rm[1] + ' ') && !/\b(?:never|didn'?t|did not|wasn'?t|was not)\b/.test(rm[1])) positiveTest = true; } /* every mention, not only the first */
    var g = /\bpositive\b[^.;]{0,20}?\b(?:test|line)\b/g, m2, OTHER_RE = new RegExp('\\b' + OTHER + '\\b');
    while ((m2 = g.exec(t))) {
      var right = t.slice(m2.index + m2[0].length, m2.index + m2[0].length + 24), left = t.slice(Math.max(0, m2.index - 28), m2.index).split(/[.;!?,]|\bbut\b|\band\b/).pop();
      var preg = /\bpregnan|\bhcg\b|\bhpt\b/.test(left + m2[0]), other = OTHER_RE.test(m2[0]) || OTHER_RE.test(left) || new RegExp('^\\s+for\\s+(?:a\\s+|the\\s+)?' + OTHER + '\\b').test(right);
      if ((preg || !other) && !/\b(?:not|never|no)\s+$/.test(left)) positiveTest = true; /* only a denial right before it ("not positive"); "no pain + positive test" stays positive */
    }
    return /\bpregnan\w*\b|\bpreggy\b|\bpreggers\b|\b\d+\s*(?:weeks?|wks?|w)\s+(?:preg\w*|along)\b/.test(s) || /\bfaint (?:second )?line\b|\bbfp\b/.test(t) || positiveTest;
  }
  var ONE_SIDE = /\b(?:one[- ]sided|on one side|(?:left|right)[- ]sided)\b[^.;]{0,25}?\b(?:pain|ache|cramp\w*|hurts?)\b|\b(?:pain|ache|cramp\w*|hurts?|hurting)\b[^.;]{0,25}?\b(?:on one side|on (?:the|my) (?:left|right)|(?:left|right) side)\b|\b(?:left|right) side\b[^.;]{0,15}?\b(?:pain|ache|hurts?|hurting|cramp\w*)\b|\b(?:only\s+)?one\s+side\b|\b(?:left|right)\s+(?:lower\s+)?(?:abdomen|abdominal|tummy|belly|stomach|pelvis|pelvic|groin)\b[^.;]{0,20}?\b(?:pain|ache|hurts?|hurting|cramp\w*)\b|\bshoulder[- ]tip\b/;
  var FEVER = /\bfevers?\b|\bfeverish\b|\bhigh temp(?:erature)?\b|\btemp(?:erature)? (?:of )?3[89]\b|\b3[89](?:\.\d)?\s*(?:°|deg|degrees|c)\b|\bchills\b|\bshivering\b|\brigors?\b/;
  var INFECT_WITH = /\bpelvi\w*\b|\blower (?:tummy|belly|abdomen|stomach)\b|\b(?:tummy|belly|abdominal|stomach|womb) (?:pain|ache|cramps?)\b|\b(?:smelly|foul|fishy|green|yellow|unusual|strange|bad[- ]smelling)\b[^.;]{0,15}?\bdischarge\b|\bdischarge\b[^.;]{0,15}?\b(?:smells|smelly|foul|fishy|green|yellow)\b|\bbreasts?\b[^.;]{0,20}?\b(?:hot|red|painful|sore|hard|lump\w*|swollen)\b|\b(?:hot|red|painful|sore|hard|swollen)\b[^.;]{0,12}?\bbreasts?\b|\bmastitis\b|\bbreastfeed\w*\b[^.;]{0,30}?\b(?:hot|red|hard|lump\w*|painful|sore|swollen|swell\w*)\b|\b(?:nipple|boobs?)\b[^.;]{0,20}?\b(?:hot|red|hard|painful|sore|swollen|lump\w*)\b|\b(?:wound|stitches|scar|incision)\b|\b(?:burn\w*|sting\w*|pain\w*|hurts?)\b[^.;]{0,15}?\b(?:pee|peeing|wee|weeing|urinat\w*)\b|\b(?:back|flank|kidney) pain\b/;
  var URINE_BLOOD = /\bblood\b[^.;]{0,15}?\b(?:urine|pee|wee)\b|\b(?:urine|pee|wee)\b[^.;]{0,15}?\b(?:bloody|red|pink|blood)\b/;
  var LEG_CLOT = /\b(?:one|my|left|right|a)\s+(?:calf|leg|thigh)\b(?!s)[^.;]{0,25}?\b(?:swollen|swelling|swell|swells|swelled|painful|hot|red|tender|hard|throbbing|warm to (?:the )?touch)\b|\b(?:swollen|painful|hot|red|tender|throbbing)\s+(?:calf|leg)\b(?!s)/;
  var LEG_EXERCISE = /\b(?:after|from)\s+(?:the\s+)?(?:gym|run\w*|exercis\w*|workout|training|hik\w*|walk\w*|yoga|class)\b|\b(?:leg|calf|thigh|muscle|foot)\s+cramp\w*\b|\bcramp\w*\s+in\s+(?:my\s+)?(?:leg|calf|thigh|foot)\b|\bcharley horse\b/;
  var FALL = /\b(?:fell|fallen|slipped|tripped|had a fall)\b[^.;]{0,40}?\b(?:can'?t (?:stand|walk|move|get up|put weight)|severe pain|very painful|hip|wrist|broke|broken|fractur\w*|hit my head|banged my head)\b/;
  var PMB_EXTRA = /\b(?:pink|brown|red|blood[- ]?stained|bloody)\s+(?:discharge|spots?|staining|mucus|smear)\b|\bstaining\b/;
  /* something that happened before, or was checked, is history: "chest pain years ago", "doctor cleared it" */
  var PAST = /\b(?:years?|months?|weeks?)\s+ago\b|\blast\s+(?:year|month)\b|\bin\s+the\s+past\b|\bpreviously\b|\bhistory of\b|\bwas checked\b|\bgot checked\b|\bcleared\b|\brecovered\b|\bused to\b|\bnothing since\b/;
  /* every self-harm match is either denied right before it ("no thoughts of self-harm", "not suicidal", "I'd never hurt my baby"
   * stays as it was) or reported from a show ("drama character said I want to die") */
  function selfHarmDenied(t) {
    var g = new RegExp(SELF_HARM.source, 'g'), m, any = false;
    while ((m = g.exec(t))) {
      if (m[0] === '') { g.lastIndex++; continue; }
      any = true;
      var before = t.slice(Math.max(0, m.index - 40), m.index).split(/[.;!?,]|\bbut\b/).pop();
      var denied = /\b(?:no|not|never|without|don'?t have|do not have|haven'?t had|have not had|denies?)\s+(?:any\s+)?(?:thoughts?\s+(?:of|about)\s+)?$/.test(before) || /\bnot\s+(?:feeling\s+)?$/.test(before);
      var reported = /\b(?:character|drama|show|movie|film|song|lyrics?|book|story|actor|actress|episode)\b[^.;!?]{0,25}\b(?:said|says|saying|sang|sings|line)\b[^.;!?]{0,6}$/.test(t.slice(Math.max(0, m.index - 50), m.index));
      if (!denied && !reported) return false;
    }
    return any;
  }
  function card(level, code, title, trigger, message, actions) { return { level: level, code: code, title: title, trigger: trigger, message: message, actions: actions }; }
  function hasBaby(t, profile) { var p = profile || {}; return p.pregState === 'postpartum' || p.pregState === 'pregnant' || p.lifeStage === 'pregnant' || /\b(?:baby|babies|newborn|infant|little one|gave birth|give birth|delivered|born|postpartum|postnatal|confinement)\b/.test(t) || pregnantNow(t); }
  /* Returns an urgent card to show before parsing, or null. Emergency cards need care now (995 or an
   * emergency department); the postmenopausal card is prompt care, not an emergency. Rules only, never a model.
   * A card with its own `message` and `actions` (self-harm) is shown with those words; the others keep the
   * KKH Urgent O&G Centre and 995 copy in the room. */
  function urgent(text, profile) {
    var t = norm(text);
    if (SELF_HARM.test(t) && !selfHarmDenied(t)) { var baby = hasBaby(t, profile); return { level: 'emergency', code: 'SELF_HARM_NOW', title: 'Please get help now', trigger: baby ? 'thoughts of harming yourself or your baby' : 'thoughts of harming yourself', message: baby ? SELF_HARM_COPY : SELF_HARM_COPY_SELF, actions: SOS_ACTIONS.slice() }; }
    var pos = positive(t), painText = t.replace(/\b(?:no|without|not in) (?:any )?pain\b/g, ' ; ').replace(/\b(?:no|not|without)\s+(?:any\s+)?(?:sudden|severe|worst|unbearable|excruciating|stabbing)\b[^.;,]{0,30}?\bpain\b/g, ' ; '); /* only a bare "no pain" is set aside for the pain rule */
    var bleeding = BLEED_WORDS.test(pos), soak = SOAK.test(t) && !/\b(?:soak\w*\s+(?:my\s+)?(?:laundry|clothes in|beans|rice|feet))\b/.test(t) && said(SOAK, t), dizzy = said(DIZZY, t), severe = SEVERE_PAIN.test(painText);
    var heavy = soak || (/\bheavy\b/.test(pos) && bleeding);
    if (soak && !/\b(?:yesterday|last (?:week|month|cycle)|used to|before)\b/.test(t)) return { level: 'emergency', code: 'HEAVY_BLEED_NOW', title: 'Get emergency care now', trigger: 'bleeding that soaks through protection every hour' + (dizzy ? ' with dizziness' : '') };
    if (heavy && dizzy) return { level: 'emergency', code: 'HEAVY_DIZZY_NOW', title: 'Get emergency care now', trigger: 'heavy bleeding with dizziness or faintness' };
    if (/\b(?:fainted|passed out|blacked out|collapsed)\b/.test(t) && bleeding) return { level: 'emergency', code: 'FAINT_BLEED_NOW', title: 'Get emergency care now', trigger: 'fainting with bleeding' };
    /* signs any adult should call 995 for, whatever the cycle says */
    if (said(CHEST, t, { unless: PAST, sentence: true }) || said(BREATH, t, { unless: /\b(?:through my nose|blocked nose|stuffy|stuffed up|runny nose)\b|\b(?:years?|months?)\s+ago\b|\bcleared\b|\brecovered\b/ })) return card('emergency', 'CHEST_BREATH_NOW', 'Call 995 now', 'chest pain or trouble breathing', 'Chest pain, chest tightness or trouble breathing needs emergency help. Call 995 now. Do not wait to finish logging, and do not drive yourself.', CALL_995.slice());
    if (said(STROKE, t, { unless: PAST, sentence: true }) || said(STROKE_LIMB, t, { unless: new RegExp(STROKE_NOT.source + '|' + PAST.source), sentence: true })) return card('emergency', 'STROKE_NOW', 'Call 995 now', 'possible stroke signs', 'A drooping face, weakness or numbness on one side, slurred speech or sudden loss of vision can be a stroke. Call 995 now and note the time it started.', CALL_995.slice());
    if (said(ALLERGY, t)) return card('emergency', 'ALLERGY_NOW', 'Call 995 now', 'swelling of the face, lips, tongue or throat', 'Swelling of your face, lips, tongue or throat can be a serious allergic reaction. If you have an adrenaline pen, use it now as directed. Call 995 now, even if you start to feel better.', CALL_995.slice());
    if (said(SADDLE, t)) return card('emergency', 'SADDLE_NUMB_NOW', 'Get emergency care now', 'numbness around the groin or bottom', 'New numbness around your groin or bottom, or new trouble controlling your bladder or bowels, needs emergency care now. Go to A&E or call 995.', CALL_995.slice());
    if (said(HEAD_VISION, t)) return card('emergency', 'HEADACHE_VISION_NOW', 'Get emergency care now', 'a severe headache with vision changes', 'A severe headache with blurred vision or flashing lights, or the worst headache of your life, needs emergency care now. Call 995 or go to A&E.' + (hasBaby(t, profile) ? ' Tell them if you are pregnant or had a baby recently.' : ''), CALL_995.slice());
    if (said(PSYCHOSIS, t) || said(PSY_HEARD, t, { unless: PSY_ORDINARY })) return card('emergency', 'PSYCHOSIS_NOW', 'Please get help now', 'hearing or seeing things others do not', 'Hearing voices, seeing things that others cannot, or feeling sure people are against you needs emergency help now. Ask someone you trust to stay with you' + (hasBaby(t, profile) ? ' and your baby' : '') + ', and go to A&E or call 995. This can be treated.', SOS_ACTIONS.slice());
    if (pregnantNow(t) && (bleeding || severe)) return { level: 'emergency', code: 'PREG_BLEED_NOW', title: 'Get emergency care now', trigger: 'bleeding or severe pain in pregnancy' };
    /* a late or missed period, a positive test or a possible pregnancy, with one-sided pain: RCOG lists one-sided tummy pain
     * and shoulder-tip pain among the signs of an ectopic pregnancy, and a negative test does not rule it out early on */
    var maybePreg = pregnantNow(t) || (t.match(NO_PERIOD_LATE) || []).some(function (m) { return /\b(?:late|overdue|missed|missing|skipped|skip|miss)\b/.test(m); }); NO_PERIOD_LATE.lastIndex = 0;
    if (maybePreg && said(ONE_SIDE, painText)) return card('emergency', 'ECTOPIC_NOW', 'Get urgent care now', 'one-sided pain when pregnancy is possible', 'One-sided tummy pain or shoulder-tip pain when your period is late or you could be pregnant needs urgent assessment now, even if a test was negative or you have not done one. Call 995 if the pain is sudden or severe, you feel dizzy, weak or faint, or you cannot travel safely. Otherwise go with someone to KKH’s 24-hour Urgent O&G Centre or an A&E.', [{ label: 'Call 995', href: 'tel:995' }, { label: 'KKH Urgent O&G (24h)', href: 'https://www.kkh.com.sg/our-specialties/urgent-og-centre' }]);
    if (severe || (/\bshoulder[- ]tip\b/.test(t) && /\bpain\b/.test(painText))) return { level: 'emergency', code: 'SEVERE_PAIN_NOW', title: 'Get emergency care now', trigger: 'sudden severe pelvic or abdominal pain' };
    /* the same day: a doctor today, A&E if very unwell */
    /* in pregnancy or after a birth a fever with these signs can be sepsis: KKH now, not a clinic later (RCOG Green-top 64a; DeepSeek wording review) */
    if (said(FEVER, t) && said(INFECT_WITH, t)) return hasBaby(t, profile) ? card('emergency', 'FEVER_INFECTION_NOW', 'Get urgent care now', 'a fever with pain, an unusual discharge, a sore breast or wound, or painful peeing, in pregnancy or after a birth', 'A fever with pelvic or tummy pain, an unusual discharge, a hot painful breast, a sore wound or painful peeing needs urgent care now when you are pregnant or have had a baby. Go to KKH’s 24-hour Urgent O&G Centre or an A&E now. Call 995 if you feel very unwell, faint or confused.', [{ label: 'KKH Urgent O&G (24h)', href: 'https://www.kkh.com.sg/our-specialties/urgent-og-centre' }, { label: 'Call 995', href: 'tel:995' }]) : card('today', 'FEVER_INFECTION_TODAY', 'Please see a doctor today', 'a fever with pain, an unusual discharge, a sore breast or wound, or painful peeing', 'A fever together with pelvic or tummy pain, an unusual discharge, a hot painful breast, a sore wound or painful peeing needs a doctor today. See a GP or polyclinic today if one is open. If none is open, or you feel very unwell, faint or confused, go to A&E or KKH’s 24-hour Urgent O&G Centre.', [{ label: 'KKH Urgent O&G (24h)', href: 'https://www.kkh.com.sg/our-specialties/urgent-og-centre' }, { label: 'Call 995', href: 'tel:995' }]);
    if (said(LEG_CLOT, t, { unless: LEG_EXERCISE })) return card('today', 'LEG_CLOT_TODAY', 'Please get this checked today', 'one swollen, painful or red leg', 'One swollen, painful, hot or red leg should be checked today, as it can be a blood clot. Go to your GP, a polyclinic or A&E today. If you also have chest pain or trouble breathing, call 995.', CALL_995.slice());
    if (said(FALL, t)) return card('today', 'FALL_TODAY', 'Please get this checked today', 'severe pain after a fall', 'After a fall, severe pain, a hip or wrist that hurts to move, or not being able to stand or bear weight needs checking today. A knock to the head needs A&E now if you blacked out, are confused or very drowsy, keep vomiting, or have a worsening headache, weakness or a fit. Call 995 if you cannot get up, or feel faint or confused.', CALL_995.slice());
    if (said(URINE_BLOOD, t)) return card('prompt', 'URINE_BLOOD', 'Please get this checked soon', 'blood in your urine', 'Blood in your urine should be checked by a doctor. Please book your GP or polyclinic this week, sooner if you have a fever, back pain or feel unwell.', []);
    var stage = (profile && profile.lifeStage) || '';
    if (['post', 'postmenopause', 'postmenopausal'].indexOf(stage) > -1 && (bleeding || said(PMB_EXTRA, t))) return { level: 'prompt', code: 'POSTMENO_BLEED', title: 'Please get this checked this week', trigger: 'bleeding after menopause' };
    return null;
  }

  /* Symptom words people use, mapped onto the app's list (ovu-agents.js SYMPTOMS). Read from the note with negated
   * words removed, so "no hot flushes" logs none. "Flat" is a mood, not a flat white, flatbread or flat noodles. */
  var FLAT_MOOD = "flat(?! ?(?:white|bread|breads|noodles?|rice|tyres?|tires?|shoes?|out|iron|lay|screen|feet|tummy|stomach|belly|mate|share)\\b)";
  var SYM_WORDS = {
    'cramps': /\bcramp/, 'anxiety': /\banxious\b/, 'fatigue': /\b(?:tired|exhausted)\b/, 'headache': /\bmigraine\b/,
    'hot flushes': /\bhot (?:flush|flash)(?:es)?\b|\bnight sweats?\b/, 'irritability': /\birritab(?:le|ility)\b/,
    'brain fog': /\bforgetful(?:ness)?\b|\bfoggy\b/, 'discharge change': /\bdischarge\b/,
    'low mood': new RegExp('\\b(?:sad|down|low|tearful|' + FLAT_MOOD + ')\\b'),
    'vaginal dryness': /\bvaginal(?:ly)? dry\w*|\bdry(?:ness)? down there\b|\bvaginal dryness\b/,
    'urinary discomfort': /\b(?:burn\w*|sting\w*|pain\w*|hurts?)\b[^.;]{0,15}\b(?:when (?:i )?|while )?(?:pee|peeing|wee|weeing|urinat\w*)\b|\bpee(?:ing)? (?:all the time|so often|more often)\b|\burinary\b/,
    'pain during sex': /\b(?:pain|painful|hurts?|hurt|sore)\b[^.;]{0,15}\b(?:during|with|after|in)\s+(?:sex|intercourse)\b|\bpainful (?:sex|intercourse)\b|\bsex (?:is|was) painful\b|\bdyspareunia\b/
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
  function aiPaused() { return !(root.OVU_CONFIG && root.OVU_CONFIG.aiPaused === false); } /* paused unless explicitly turned off */
  function hdr(p) {
    if (aiPaused()) return Promise.reject(new Error('Luna’s AI help is paused for now. Your diary and Luna’s own rules work as usual.'));
    var h = Object.assign({ 'Content-Type': 'application/json' }, root.OvuConsent ? root.OvuConsent.header(p) : {});
    var A = root.OvuAuth; if (!A || !A.session || !A.session()) {
      /* a choice recorded on an account is not sent anonymously after the session ended (Codex recheck, 20 Oct) */
      if (root.OvuConsent && root.OvuConsent.boundTo && root.OvuConsent.boundTo(p)) return Promise.reject(new Error('Please sign in again to use Luna’s AI help.'));
      return Promise.resolve(h);
    }
    /* signed in: the account's own consent record must be checked, so a token that cannot be refreshed stops the request
       instead of sending it without the account (Codex launch review, 20 Oct) */
    var again = function () { throw new Error('Please sign in again to use Luna’s AI help.'); };
    return A.token().then(function (at) { if (!at) again(); h.Authorization = 'Bearer ' + at; return h; }, again);
  }
  function okEntry(e) { return e && S.TYPES.indexOf(e.type) > -1 && S.validDate(e.date) && e.date <= S.today() && e.data; }
  function parseAI(text) {
    var cfg = aiConfig();
    if (!cfg.on) return Promise.reject(new Error(aiPaused() ? 'Luna’s AI help is paused for now. Your diary and Luna’s own rules work as usual.' : 'AI mode is off.'));
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
    if (!photosAllowed()) return Promise.reject(new Error(aiPaused() ? 'Food photo recognition is paused for now.' : 'Food photos are off. Allow them in Luna’s settings first.'));
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
    if (!photosAllowed()) return Promise.reject(new Error(aiPaused() ? 'Food photo recognition is paused for now.' : 'Food photos are off. Allow them in Luna’s settings first.'));
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

  /* The same reading for entries saved by hand (the calendar, the symptom editor, sleep and meal notes, an import), so a red
   * flag never waits in the journal (four-persona review, 20 Oct: Siti's flooding with dizziness and Mrs Tan's spotting only
   * showed a toast). Notes are read with urgent(); the structured parts add three cards: heavy bleeding with dizziness on the
   * same day, any bleeding or spotting after menopause, and pain of 9 or 10 today. Cards that say "now" or "today" are
   * raised only for today or yesterday; a backdated day from last week is history, and its patterns stay in the journal.
   * Imported days are never read here: a year of Apple Health must not open a card. */
  function entryUrgent(ev, profile) {
    if (!ev || !ev.data || ev.source === 'apple-health' || ev.source === 'google-fit') return null;
    var p = profile || {}, d = ev.data, today = S.today(), recent = ev.date >= S.addDays(today, -1) && ev.date <= today;
    var post = ['post', 'postmenopause', 'postmenopausal'].indexOf(p.lifeStage || '') > -1;
    var notes = [d.notes, d.note, d.reflection].filter(function (x) { return typeof x === 'string' && x.trim(); }).join('. ');
    var u = notes ? urgent(notes, p) : null;
    /* a note's "now" and "today" cards need today or yesterday; its prompt card the same 28 days as a logged bleed (Codex branch review) */
    if (u && (recent || (u.level === 'prompt' && ev.date >= S.addDays(today, -27) && ev.date <= today))) return u;
    var day = S.byDate(ev.date), heavy = day.some(function (x) { return x.type === 'period' && (x.data.flow === 'heavy' || x.data.flooding); });
    var dizzy = day.some(function (x) { return x.type === 'symptom' && (x.data.symptoms || []).indexOf('dizziness') > -1; });
    if (recent && heavy && dizzy && (ev.type === 'period' || ev.type === 'symptom')) return { level: 'emergency', code: 'HEAVY_DIZZY_NOW', title: 'Get emergency care now', trigger: 'heavy bleeding with dizziness or faintness' };
    if (post && ev.date >= S.addDays(today, -27) && ((ev.type === 'period' && d.flow && d.flow !== 'none') || (ev.type === 'symptom' && (d.symptoms || []).indexOf('spotting') > -1))) return { level: 'prompt', code: 'POSTMENO_BLEED', title: 'Please get this checked this week', trigger: 'bleeding after menopause' };
    /* sleep: the two-week check's notes (ovu-agents.js sleepCheckNotes) for two weeks after it, and a night that woke her gasping */
    var AG = root.OvuAgents;
    if (ev.type === 'sleepcheck' && AG && AG.sleepCheckNotes && ev.date >= S.addDays(today, -13) && ev.date <= today) {
      var sc = AG.sleepCheckNotes(d).filter(function (x) { return x.level !== 'info'; })[0];
      if (sc) return card(sc.level, sc.code, sc.title, sc.trigger, sc.message);
    }
    if (ev.type === 'sleep' && recent && AG && AG.breathingNote && d.details && Array.isArray(d.details.woke) && d.details.woke.indexOf('gasp') > -1) { var bn = AG.breathingNote(); return card(bn.level, bn.code, bn.title, bn.trigger, bn.message); }
    var pain = typeof d.pain === 'number' ? d.pain : null;
    if (ev.type === 'symptom' && ev.date === today && pain !== null && pain >= 9) return card('today', 'PAIN_SEVERE_TODAY', 'Pain this strong deserves care today', 'pain of ' + pain + ' out of 10', 'Pain of ' + pain + ' out of 10 deserves a doctor today. If it came on suddenly, is on one side, or you could be pregnant, get emergency care now at KKH’s 24-hour Urgent O&G Centre or an A&E, and call 995 if you feel faint.', [{ label: 'KKH Urgent O&G (24h)', href: 'https://www.kkh.com.sg/our-specialties/urgent-og-centre' }, { label: 'Call 995', href: 'tel:995' }]);
    return null;
  }

  root.OvuOrb = { aiPaused: aiPaused, parseLocal: parseLocal, parseAI: parseAI, urgent: urgent, entryUrgent: entryUrgent, noPeriod: noPeriod, parsePhoto: parsePhoto, parseDish: parseDish, parseLabel: parseLabel, foodItemsFrom: foodItemsFrom, regram: regram, rename: rename, photosAllowed: photosAllowed, describe: describe, save: save, aiConfig: aiConfig, setAiConfig: setAiConfig, reply: reply, PROXY_URL: PROXY_URL, dateFrom: dateFrom };
})(window);
