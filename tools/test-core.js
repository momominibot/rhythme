#!/usr/bin/env node
/* Ovumind core checks: loads the browser scripts (store, agents, orb) under a
 * tiny window shim with in-memory localStorage and asserts behaviour that the
 * Ebb review (docs/debate/2026-10-18-*) found wrong. Run: node tools/test-core.js
 * Exit code 1 when any check fails. No network, no files written. */
'use strict';
process.env.TZ = 'Asia/Singapore'; /* sun checks assume Singapore time */
var fs = require('fs'), path = require('path'), vm = require('vm');
var root = path.join(__dirname, '..');
function mkStorage() { var m = {}; return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, key: function (i) { return Object.keys(m)[i] || null; }, get length() { return Object.keys(m).length; }, _m: m }; }
function fresh(todayIso) {
  var w = { localStorage: mkStorage(), navigator: { userAgent: 'node', language: 'en-SG' }, document: { addEventListener: function () { }, querySelector: function () { return null; } }, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Date: Date, JSON: JSON, Math: Math, Promise: Promise, Object: Object, Array: Array, Number: Number, String: String, Boolean: Boolean, RegExp: RegExp, Error: Error, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); }, atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); }, crypto: require('crypto').webcrypto, TextEncoder: TextEncoder, TextDecoder: TextDecoder, fetch: function () { return Promise.reject(new Error('no network in tests')); }, location: { origin: 'http://127.0.0.1', hostname: '127.0.0.1' } };
  w.window = w; w.self = w; w.globalThis = w;
  var ctx = vm.createContext(w);
  w.Uint8Array = Uint8Array; w.ArrayBuffer = ArrayBuffer; w.isFinite = isFinite; w.isNaN = isNaN; w.Blob = Blob; w.File = File;
  ['ovu-store.js', 'ovu-exercise.js', 'ovu-food.js', 'ovu-nova.js', 'ovu-agents.js', 'ovu-orb.js', 'ovu-rewards.js', 'ovu-water.js', 'ovu-pets.js', 'ovu-pdf.js', 'ovu-mascot.js', 'assets/vendor/fflate-0.8.2.umd.min.js', 'ovu-health.js', 'ovu-sound.js', 'ovu-breathtap.js', 'ovu-lightflower.js', 'ovu-moments.js', 'ovu-mindful.js', 'ovu-morning.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); });
  ['ovu-store.js', 'ovu-food.js', 'ovu-nova.js', 'ovu-agents.js', 'ovu-orb.js', 'ovu-rewards.js', 'ovu-water.js', 'ovu-pets.js', 'ovu-pdf.js', 'ovu-mascot.js', 'assets/vendor/fflate-0.8.2.umd.min.js', 'ovu-health.js', 'ovu-sync.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); });
  if (todayIso) { var S = w.OvuStore; if (typeof S.today === 'function') { S._today = S.today; S.today = function () { return todayIso; }; } }
  /* ovu-sync.js fails closed without the consent module (nothing moves); the sync blocks here test the sync, so they get a
   * double that says the gate is open; blocks that load the real ovu-consent.js replace it */
  if (!w.OvuConsent) w.OvuConsent = { double: true, needsSheet: function () { return false; }, allows: function (p) { return p === 'cloud_sync'; }, record: function () { }, pullAccountState: function () { return Promise.resolve(null); }, flush: function () { return Promise.resolve(0); }, recordedOnAccount: function () { return true; }, boundTo: function () { return false; }, header: function () { return {}; } }; /* only the backup door is open and already on the account; nothing else is granted */
  return w;
}
var fails = 0, passes = 0;
var openHarness = {}; /* async harnesses register here and clear on finish, so one that stalls fails the run instead of silently dropping its checks */
function check(name, cond, detail) { if (cond) { passes++; console.log('  ok   ' + name); } else { fails++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); } }
function addDays(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

(function spottingShouldNotStartCycle() {
  console.log('spotting between periods must not start a new cycle episode');
  var w = fresh(), S = w.OvuStore, today = S.today();
  var start = addDays(today, -20);
  for (var i = 0; i < 5; i++) S.add('period', addDays(start, i), { flow: i < 2 ? 'medium' : 'light', clots: false, impact: false });
  S.add('period', addDays(start, 12), { flow: 'spotting', clots: false, impact: false });
  var cs = S.cycleStats(today);
  check('one period episode after a spotting day on cycle day 13', cs.starts.length === 1, 'starts=' + JSON.stringify(cs.starts));
  check('last start is the real period start', cs.lastStart === start, 'lastStart=' + cs.lastStart);
})();

(function secondSymptomLogMustMerge() {
  console.log('a second symptom log the same day must keep the first');
  var w = fresh(), S = w.OvuStore, O = w.OvuOrb, today = S.today();
  O.save([{ type: 'symptom', date: today, data: { symptoms: ['cramps'], pain: 6, mood: 'ok', notes: '' } }]);
  O.save([{ type: 'symptom', date: today, data: { symptoms: ['anxiety'], pain: null, mood: '', notes: '' } }]);
  var day = S.byDate(today).filter(function (e) { return e.type === 'symptom'; });
  var syms = day.length ? day[0].data.symptoms : [];
  check('cramps survive after logging anxiety', syms.indexOf('cramps') > -1 && syms.indexOf('anxiety') > -1, 'symptoms=' + JSON.stringify(syms));
  check('pain 6 survives when the second note has no pain', day.length && day[0].data.pain === 6, 'pain=' + (day[0] && day[0].data.pain));
})();

(function emergencySentenceIsNotLunch() {
  console.log('the Ebb 4a emergency sentence must not become a meal');
  var w = fresh(), O = w.OvuOrb;
  var entries = O.parseLocal('soaking through a pad every hour since lunch, feeling a bit dizzy');
  var types = entries.map(function (e) { return e.type; });
  check('no food entry from "since lunch"', types.indexOf('food') < 0, 'types=' + JSON.stringify(types));
  check('dizziness is captured as a symptom', entries.some(function (e) { return e.type === 'symptom' && (e.data.symptoms || []).indexOf('dizziness') > -1; }), 'entries=' + JSON.stringify(entries));
  check('heavy flow is captured', entries.some(function (e) { return e.type === 'period' && e.data.flow === 'heavy'; }), 'entries=' + JSON.stringify(entries));
})();

(function postmenopausalFlagMustFire() {
  console.log('bleeding after menopause must raise the high flag with the lifeStage the onboarding writes');
  var w = fresh(), S = w.OvuStore, A = w.OvuAgents, today = S.today();
  S.setProfile({ lifeStage: 'post', predictionMode: 'suspended' });
  S.add('period', addDays(today, -1), { flow: 'light', clots: false, impact: false });
  var codes = A.allFlags(today).map(function (f) { return f.code; });
  check('POSTMENO_BLEED raised for lifeStage "post"', codes.indexOf('POSTMENO_BLEED') > -1, 'codes=' + JSON.stringify(codes));
})();

(function wideModeWidensAndSuspendedHasNoPhase() {
  console.log('prediction modes must change the numbers, not only the wording');
  var w = fresh(), S = w.OvuStore, today = S.today();
  var s1 = addDays(today, -60), s2 = addDays(today, -31), s3 = addDays(today, -3);
  [s1, s2, s3].forEach(function (s) { for (var i = 0; i < 4; i++) S.add('period', addDays(s, i), { flow: 'medium', clots: false, impact: false }); });
  S.setProfile({ predictionMode: 'normal' });
  var n = S.cycleStats(today);
  S.setProfile({ predictionMode: 'wide' });
  var wd = S.cycleStats(today);
  check('normal mode gives a predicted window (from/to), not only a single date', n.predictedFrom && n.predictedTo && n.predictedFrom <= n.predictedTo, 'predicted=' + JSON.stringify({ from: n.predictedFrom, to: n.predictedTo, next: n.predictedNext }));
  check('wide mode gives a wider window than normal', wd.predictedFrom && n.predictedFrom && (wd.predictedFrom < n.predictedFrom || wd.predictedTo > n.predictedTo), 'normal=' + JSON.stringify([n.predictedFrom, n.predictedTo]) + ' wide=' + JSON.stringify([wd.predictedFrom, wd.predictedTo]));
  var w2 = fresh(), S2 = w2.OvuStore;
  S2.setProfile({ predictionMode: 'suspended' });
  S2.add('period', addDays(S2.today(), -40), { flow: 'medium', clots: false, impact: false });
  var sp = S2.cycleStats(S2.today());
  check('suspended mode has no phase and no prediction', !sp.phase && !sp.predictedNext, 'phase=' + sp.phase + ' next=' + sp.predictedNext);
})();

(function urgentRulesAndChips() {
  console.log('urgent rules fire before parsing, and the shortcut chips still parse');
  var w = fresh(), O = w.OvuOrb;
  var u1 = O.urgent('soaking through a pad every hour since lunch, feeling a bit dizzy', {});
  check('emergency card for hourly soaking with dizziness', u1 && u1.level === 'emergency', JSON.stringify(u1));
  check('emergency card for sudden severe pelvic pain', (O.urgent('sudden severe pelvic pain on the right, pain 9/10', {}) || {}).level === 'emergency');
  check('emergency card for bleeding in pregnancy', (O.urgent('I am 8 weeks pregnant and bleeding', {}) || {}).level === 'emergency');
  check('one-sided pain with "I could be pregnant" in the profile is the ectopic card, with no pregnancy word in the note (persona walk, 21 Oct)', (O.urgent('pain on one side of my lower tummy since this morning', { pregState: 'maybe' }) || {}).code === 'ECTOPIC_NOW');
  check('bleeding with pregnancy in the profile is emergency care, with no pregnancy word in the note', (O.urgent('some bleeding today and cramps', { pregState: 'pregnant' }) || {}).code === 'PREG_BLEED_NOW');
  check('a denied faint line is not a pregnancy', !/PREG|ECTOPIC/.test(((O.urgent('no faint second line this morning, mild cramps', {}) || {}).code || '')));
  check('prompt (not emergency) card for bleeding after menopause', (O.urgent('some bleeding again today', { lifeStage: 'post' }) || {}).level === 'prompt');
  check('no card for an ordinary medium period', O.urgent('period started today, medium, cramps 4/10', {}) === null);
  check('no card for "no bleeding today"', O.urgent('no bleeding today, slept well', { lifeStage: 'post' }) === null);
  var chips = { 'Slept 11pm to 7am, quality 4': 'sleep', 'Period started today, medium': 'period', 'Cramps and bloating, pain 5, mood ok': 'symptom', 'Had oats and a latte for breakfast': 'food', 'Meditated 10 min': 'mindfulness' };
  Object.keys(chips).forEach(function (q) { var types = O.parseLocal(q).map(function (e) { return e.type; }); check('chip parses: ' + q, types.indexOf(chips[q]) > -1, 'types=' + JSON.stringify(types)); });
  check('"skipped lunch" is still not a meal', O.parseLocal('skipped lunch, cramps 3/10').every(function (e) { return e.type !== 'food'; }));
  check('"had chicken rice for lunch" is a meal', O.parseLocal('had chicken rice for lunch').some(function (e) { return e.type === 'food' && e.data.meal === 'lunch'; }));
  check('spotting alone is a symptom, not a period day', (function () { var es = O.parseLocal('a bit of spotting today'); return es.some(function (e) { return e.type === 'symptom' && e.data.symptoms.indexOf('spotting') > -1; }) && !es.some(function (e) { return e.type === 'period'; }); })());
  delete w.OvuConsent; /* the orb's own default, with no consent module present */
  check('model is off by default until permission is given', O.aiConfig().on === false && O.aiConfig().insights === false, JSON.stringify(O.aiConfig()));
})();

/* ---------- persona safety re-check (docs/debate/2026-10-18-persona-safety-recheck.md), the seven release blockers ---------- */
(function negationIsClauseAware() {
  console.log('1. a negation removes only what it negates: severe pain and bleeding after menopause still raise their cards');
  var w = fresh(), O = w.OvuOrb, post = { lifeStage: 'post' };
  function code(text, p) { var u = O.urgent(text, p || {}); return u ? u.code : null; }
  check('"No bleeding, but sudden severe pelvic pain." is an emergency', code('No bleeding, but sudden severe pelvic pain.') === 'SEVERE_PAIN_NOW', code('No bleeding, but sudden severe pelvic pain.'));
  check('"No period, but severe abdominal pain." is an emergency', code('No period, but severe abdominal pain.') === 'SEVERE_PAIN_NOW', code('No period, but severe abdominal pain.'));
  check('the same without a comma', code('no bleeding but sudden severe pelvic pain') === 'SEVERE_PAIN_NOW');
  check('"No period for two years, but spotting today" after menopause raises the bleeding prompt', code('No period for two years, but spotting today', post) === 'POSTMENO_BLEED', code('No period for two years, but spotting today', post));
  check('a curly apostrophe reads like a straight one', code('I haven’t bled in years but there’s spotting today', post) === 'POSTMENO_BLEED');
  check('negated bleeding alone after menopause raises nothing', code('no bleeding today, slept well', post) === null && code('Not bleeding at all', post) === null && code('My period has not returned.', post) === null && code('I haven’t had a period since 2023', post) === null);
  check('a negation never hides severe pain', code('Never had pain this severe in my tummy') === 'SEVERE_PAIN_NOW' && code('no severe pelvic pain until tonight, now sudden severe pelvic pain') === 'SEVERE_PAIN_NOW');
  check('"no pain" on its own is not read as severe pain', code('No pain, severe bloating today') === null);
  check('soaking still wins over a leading "no pain"', code('No pain but soaking through a pad every hour') === 'HEAVY_BLEED_NOW');
  check('"no heavy bleeding" with dizziness is not heavy bleeding with dizziness', code('no heavy bleeding, just a bit dizzy') === null);
  check('pregnancy with negated bleeding and no pain raises nothing', code('8 weeks pregnant, no bleeding, no pain') === null);
  check('pregnancy with severe pain is still an emergency after a negation', code('pregnant, no bleeding but sudden severe pelvic pain') === 'PREG_BLEED_NOW');
})();

(function selfHarmCardComesFirst() {
  console.log('2. thoughts of harming yourself or your baby raise the emergency card before anything is parsed');
  var w = fresh(), O = w.OvuOrb;
  var COPY = 'If you have thoughts of harming yourself or your baby, you need help now. Call your local emergency number or go to the nearest emergency department, and ask someone you trust to stay with you. A crisis helpline can also help, at any hour.';
  var COPY_SELF = 'If you have thoughts of harming yourself, you need help now. Call your local emergency number or go to the nearest emergency department, and ask someone you trust to stay with you. A crisis helpline can also help, at any hour.';
  /* the baby is named only when the note or the profile has one (four-persona review, 20 Oct) */
  [['I want to hurt myself', COPY_SELF], ['I feel like killing myself', COPY_SELF], ['thoughts of hurting my baby', COPY], ['I’m scared I might hurt my baby', COPY], ['I don’t want to be alive anymore', COPY_SELF], ['having suicidal thoughts again', COPY_SELF]].forEach(function (c) {
    var u = O.urgent(c[0], {});
    check('self-harm card for "' + c[0] + '"', u && u.level === 'emergency' && u.code === 'SELF_HARM_NOW' && u.message === c[1], JSON.stringify(u));
  });
  check('after a birth the card names the baby even when the note does not', (O.urgent('I want to hurt myself', { pregState: 'postpartum' }) || {}).message === COPY);
  var both = O.urgent('soaking through a pad every hour and I want to hurt myself', {});
  check('the self-harm card comes first, even with heavy bleeding', both && both.code === 'SELF_HARM_NOW', JSON.stringify(both));
  var u = O.urgent('I want to hurt myself', { lifeStage: 'post' });
  check('the card carries one link, an international helpline directory, and no country-specific number (22 Oct: the app is for the whole world)', u && JSON.stringify(u.actions) === JSON.stringify([{ label: 'Find a helpline', href: 'https://findahelpline.com' }]), JSON.stringify(u && u.actions));
  check('"I think about hurting myself" and "I’d hurt my baby" raise it too, "I’d never hurt my baby" does not', (O.urgent('Sometimes I think about hurting myself', {}) || {}).code === 'SELF_HARM_NOW' && (O.urgent('I’m so tired I’d hurt my baby', {}) || {}).code === 'SELF_HARM_NOW' && O.urgent('I’d never hurt my baby, just so tired', {}) === null);
  check('an ordinary hurt is not a self-harm card', O.urgent('I hurt my back carrying the baby', {}) === null && O.urgent('my feet are killing me', {}) === null && O.urgent('am I hurting my baby by drinking coffee?', {}) === null);
  check('the existing bleeding cards keep their codes and no self-harm copy', (function () { var h = O.urgent('soaking through a pad every hour', {}); return h && h.code === 'HEAVY_BLEED_NOW' && !h.message; })());
})();

(function emergenciesBeyondThePeriod() {
  console.log('2b. four-persona review (20 Oct): chest pain, stroke signs, allergy, ectopic pain, infection, a clot, a fall and psychosis raise cards; everyday phrases do not');
  var w = fresh(), O = w.OvuOrb;
  var cases = [
 // [text, profile, expectedCode or null]
 ['My arm went numb but not due to sleeping on it',{},'STROKE_NOW'],['Chest pain: not really improving',{},'CHEST_BREATH_NOW'],['I have a bad headache after editing blurry photos',{},null],
 ['Pregnancy test was never positive before. Pregnancy test is positive today and I am bleeding',{},'PREG_BLEED_NOW'],['No pain + positive pregnancy test + spotting',{},'PREG_BLEED_NOW'],['severe headache and my eyes are blurry',{},'HEADACHE_VISION_NOW'],
 ['Severe headache and my vision is very blurry',{},'HEADACHE_VISION_NOW'],['worst headache and everything looks blurry',{},'HEADACHE_VISION_NOW'],['My arm went numb with no pain from sleeping on it',{},null],['Chest pain: not really',{},null],
 ['My COVID test shows a positive line and my period started today',{},null],['My pregnancy test never turned positive, period started today',{},null],['my pregnancy test turned positive and I am spotting',{},'PREG_BLEED_NOW'],
 ['Chest pain no fever',{},'CHEST_BREATH_NOW'],['Chest pain no relief after resting',{},'CHEST_BREATH_NOW'],['My arm is weak but no pins and needles',{},'STROKE_NOW'],['I hear voices no one else can hear while in the kitchen',{},'PSYCHOSIS_NOW'],
 ['I hear voices on the radio telling me the weather',{},null],['I have a bad headache but my vision is not blurry',{},null],['severe headache, my vision is blurry',{},'HEADACHE_VISION_NOW'],['I have a positive test and blood in my discharge',{},'PREG_BLEED_NOW'],
 ['Positive covid test but not pregnant and my period started today',{},null],['pregnancy test came back positive and I am bleeding',{},'PREG_BLEED_NOW'],['positive ovulation test today',{lifeStage:'ttc'},null],
 ['Chest pain: none',{},null],['chest pain? no',{},null],['I have left calf swelling with period cramps',{},'LEG_CLOT_TODAY'],['Positive test for covid and my period started today',{},null],['I am hearing voices from my friends in the kitchen',{},null],
 ['I have pain on my left side and a positive urine pregnancy test',{},'ECTOPIC_NOW'],['My leg is swollen and not painful',{},'LEG_CLOT_TODAY'],['I am hallucinating while on a call to my doctor',{},'PSYCHOSIS_NOW'],['I have fever and painful peeing but I am not pregnant',{},'FEVER_INFECTION_TODAY'],
 ['My arm is numb with pins and needles from sleeping on it',{},null],['took a pregnancy test, it was negative, period started',{},null],['voices in my head telling me things',{},'PSYCHOSIS_NOW'],
 ['No improvement in chest pain',{},'CHEST_BREATH_NOW'],['No fever and my chest is tight',{},'CHEST_BREATH_NOW'],['My face is not swollen',{},null],['my leg is not swollen',{},null],['chest pain won\'t stop',{},'CHEST_BREATH_NOW'],
 ['My face is drooping and I have pins and needles in one arm',{},'STROKE_NOW'],['My left calf is swollen and painful, also period cramps',{},'LEG_CLOT_TODAY'],['I am breathless even at rest',{},'CHEST_BREATH_NOW'],['so breathless I can barely talk',{},'CHEST_BREATH_NOW'],['breathless after climbing the stairs',{},null],
 ['Positive covid test yesterday, period started today',{},null],['My period is due tomorrow and pain on my left side',{},null],['positive ovulation test and pain on my left side',{lifeStage:'ttc'},null],['positive pregnancy test and pain on my left side',{},'ECTOPIC_NOW'],
 ['I am hearing voices from the TV',{},null],['People are watching me on Zoom',{},null],['I keep hearing voices nobody else hears',{pregState:'postpartum'},'PSYCHOSIS_NOW'],
 ['chest pain since this morning',{},'CHEST_BREATH_NOW'],['no chest pain, just tired',{},null],['I don\'t have chest pain',{},null],['no fever but my chest feels tight',{},'CHEST_BREATH_NOW'],
 ['struggling to breathe',{},'CHEST_BREATH_NOW'],['can\'t breathe through my nose, blocked nose',{},null],['short of breath at rest',{},'CHEST_BREATH_NOW'],['bit short of breath after running',{},null],
 ['my face is drooping on one side',{},'STROKE_NOW'],['slurred speech and my arm went weak',{},'STROKE_NOW'],['my leg went numb from sitting cross-legged',{},null],['my arm went numb sleeping on it',{},null],['suddenly weak and tired after period',{},null],
 ['lips swollen after eating prawns',{},'ALLERGY_NOW'],['puffy eyes this morning',{},null],['puffy face after crying',{},null],
 ['numbness around my groin and bottom',{},'SADDLE_NUMB_NOW'],
 ['severe headache and blurred vision',{pregState:'postpartum'},'HEADACHE_VISION_NOW'],['worst headache of my life',{},'HEADACHE_VISION_NOW'],['headache 4/10',{},null],
 ['I keep hearing voices telling me things',{pregState:'postpartum'},'PSYCHOSIS_NOW'],['I\'m paranoid my period is late',{},null],['seeing things that aren\'t there',{},'PSYCHOSIS_NOW'],
 ['period is 10 days late and sharp pain on my left side',{},'ECTOPIC_NOW'],['positive test yesterday, pain on the right side',{},'ECTOPIC_NOW'],['could be pregnant, shoulder tip pain',{},'ECTOPIC_NOW'],
 ['trying to get pregnant, period came today, so sad',{lifeStage:'ttc'},null],['negative pregnancy test and my period started',{},null],['pregnancy test negative, period started, cramps 5/10',{},null],['ovulation pain on my left side, trying to conceive',{lifeStage:'ttc'},null],
 ['I am 8 weeks pregnant and bleeding',{},'PREG_BLEED_NOW'],['pregnant, no bleeding but sudden severe pelvic pain',{},'PREG_BLEED_NOW'],['8 weeks pregnant, no bleeding, no pain',{},null],
 ['fever and pelvic pain',{},'FEVER_INFECTION_TODAY'],['fever 38.5 and my breast is red and hot',{pregState:'postpartum',breastfeeding:'yes'},'FEVER_INFECTION_NOW'],['no fever, smelly discharge',{},null],['fever and a cough',{},null],['burning when I pee and chills',{},'FEVER_INFECTION_TODAY'],
 ['my left calf is swollen and painful',{},'LEG_CLOT_TODAY'],['legs ache after the gym',{},null],['leg cramp at night',{},null],['my leg is sore after my walk',{},null],
 ['slipped in the bathroom and my hip hurts, can\'t stand',{lifeStage:'post'},'FALL_TODAY'],
 ['blood in my urine',{},'URINE_BLOOD'],['blood in my pee',{lifeStage:'post'},'URINE_BLOOD'],
 ['pink discharge today',{lifeStage:'post'},'POSTMENO_BLEED'],['brown spots on my underwear',{lifeStage:'post'},'POSTMENO_BLEED'],['dryness and itching',{lifeStage:'post'},null],
 ['hot flushes 6 times last night',{lifeStage:'peri'},null],['heavy period, soaking a pad every hour',{},'HEAVY_BLEED_NOW'],['period started today, medium, cramps 4/10',{},null],
 ['worried my period is coming',{},null],['I want to hurt myself',{},'SELF_HARM_NOW'],['I\'m scared I might hurt my baby',{pregState:'postpartum'},'SELF_HARM_NOW'],
 ['face and tongue swelling after my new pill',{},'ALLERGY_NOW'],['my wound from the c-section is red and I have a fever',{pregState:'postpartum'},'FEVER_INFECTION_NOW'],
 ['tired, low, didn\'t sleep',{},null],['ate chicken rice for lunch',{},null],['chest of drawers arrived',{},null],
];
  cases.forEach(function (c) { var u = O.urgent(c[0], c[1]); check('"' + c[0] + '" -> ' + c[2], (u ? u.code : null) === c[2], u ? u.code : 'null'); });
  check('every new card brings its own words; an emergency card says emergency and names no country\'s number', ['chest pain', 'my face is drooping on one side', 'lips swollen', 'hearing voices', 'period is late and pain on my left side'].every(function (t) { var u = O.urgent(t, {}); return u && u.message && (u.level !== 'emergency' || (/emergency/i.test(u.message + ' ' + u.title) && !/\b995\b|1767|KKH/.test(u.message))); }));
  var w2 = fresh(), O2 = w2.OvuOrb;
  check('Luna reads worry about a period as a feeling, never a period day', ['worried my period is coming', 'dreading my period', 'when will my period come', 'my period is coming soon I think'].every(function (t) { return !O2.parseLocal(t).some(function (e) { return e.type === 'period'; }); }) && O2.parseLocal('anxious about my period this month').some(function (e) { return e.type === 'symptom' && e.data.symptoms.indexOf('anxiety') > -1; }) && O2.parseLocal('worried, period started heavy today').some(function (e) { return e.type === 'period' && e.data.flow === 'heavy'; }));
})();

(function handSavedRedFlags() {
  console.log('2c. a red flag saved by hand opens its card at once (four-persona review, 20 Oct)');
  var w = fresh(), S = w.OvuStore, O = w.OvuOrb, today = S.today();
  var p1 = S.add('period', today, { flow: 'heavy', clots: false, impact: false, flooding: true });
  check('heavy flooding alone opens no emergency card (it asks for a GP or polyclinic today)', (O.entryUrgent(p1, {}) || {}).level !== 'emergency' && (O.entryUrgent(p1, {}) || {}).code === 'FLOODING_TODAY');
  var s1 = S.add('symptom', today, { symptoms: ['dizziness'], pain: null, mood: '', notes: '' });
  check('dizziness on a heavy day opens the heavy-with-dizziness card', (O.entryUrgent(s1, {}) || {}).code === 'HEAVY_DIZZY_NOW');
  var w2 = fresh(), S2 = w2.OvuStore, O2 = w2.OvuOrb, t2 = S2.today(), post = { lifeStage: 'post' };
  var sp = S2.add('symptom', t2, { symptoms: ['spotting'], pain: null, mood: '', notes: '' });
  check('spotting after menopause opens the prompt card', (O2.entryUrgent(sp, post) || {}).code === 'POSTMENO_BLEED');
  var pd = S2.add('period', S2.addDays(t2, -6), { flow: 'light', clots: false, impact: false });
  check('a light day after menopause last week still opens it', (O2.entryUrgent(pd, post) || {}).code === 'POSTMENO_BLEED');
  check('the same day before menopause opens nothing', O2.entryUrgent(pd, {}) === null);
  var n1 = S2.add('symptom', t2, { symptoms: [], pain: null, mood: 'low', notes: 'chest feels tight since lunch' });
  check('a note saved by hand is read like a note to Luna', (O2.entryUrgent(n1, {}) || {}).code === 'CHEST_BREATH_NOW');
  var old = S2.add('sleep', S2.addDays(t2, -9), { bedTime: '23:00', wakeTime: '06:00', quality: 3, notes: 'chest pain last week' });
  check('a backdated note from last week opens no "now" card', O2.entryUrgent(old, {}) === null);
  check('chest pain in the day\'s note still wins when pain is added to that day', (O2.entryUrgent(S2.add('symptom', t2, { pain: 9 }, 'room', { merge: true }), {}) || {}).code === 'CHEST_BREATH_NOW');
  var w4 = fresh(), S4 = w4.OvuStore, O4 = w4.OvuOrb;
  check('pain of 9 today opens the same-day card', (O4.entryUrgent(S4.add('symptom', S4.today(), { symptoms: ['cramps'], pain: 9, mood: '', notes: '' }), {}) || {}).code === 'PAIN_SEVERE_TODAY');
  check('pain of 9 last week opens nothing', O4.entryUrgent(S4.add('symptom', S4.addDays(S4.today(), -7), { symptoms: ['cramps'], pain: 9, mood: '', notes: '' }), {}) === null);
  var imp = { type: 'period', date: t2, data: { flow: 'medium' }, source: 'apple-health' };
  check('an imported day never opens a card', O2.entryUrgent(imp, post) === null);
  var w3 = fresh(), S3 = w3.OvuStore, A3 = w3.OvuAgents, t3 = S3.today();
  S3.setProfile({ pregState: 'postpartum' });
  [0, 2, 4].forEach(function (k) { S3.add('symptom', S3.addDays(t3, -k), { symptoms: [], pain: null, mood: 'low', notes: '' }); });
  check('after a birth, three low days in two weeks raise the support note', A3.allFlags().some(function (f) { return f.code === 'MOOD_LOW' && /1771/.test(f.detail); }));
})();

(function mindfulMoments() {
  console.log('2d. every activity has a mindful line and an action (Jamie, 20 Oct): lines are short, kind and free of scores');
  var w = fresh(), M = w.OvuMoments;
  check('the moments module loads', !!(M && M.MOMENTS));
  var keys = Object.keys(M.MOMENTS), bad = [];
  keys.forEach(function (k) { M.MOMENTS[k].lines.forEach(function (l) { var words = l.trim().split(/\s+/).length; if (words > 18 || /\u2014|\u2013| - /.test(l) || /\b(?:streak|score|points?|goal|target|should|must|failing|failed)\b/i.test(l) || !/[.!?]$/.test(l)) bad.push(k + ': ' + l); }); if (!M.MOMENTS[k].lines.length) bad.push(k + ': no lines'); });
  check('every line is at most 18 words, ends cleanly, and has no em dash, score, streak or "should"', bad.length === 0, bad.join(' | '));
  var need = ['period', 'symptom', 'sleep', 'food', 'weight', 'exercise', 'session', 'practice', 'moontap', 'luna', 'import', 'acupressure', 'podcast', 'learn', 'greenhouse', 'plant', 'weed', 'farmwater', 'harvest', 'shop', 'adopt', 'petfeed', 'petplay', 'petcuddle', 'pettidy', 'petdress', 'wardrobe', 'reminder', 'plaza', 'friend', 'hello', 'tea', 'scan'];
  check('every activity the review walked has a moment', need.every(function (k) { return !!M.MOMENTS[k]; }), need.filter(function (k) { return !M.MOMENTS[k]; }).join(','));
  check('saved entries map to their moment', M.forEntry({ type: 'period', data: {} }) === 'period' && M.forEntry({ type: 'period', data: {} }, true) === 'bleed_post' && M.forEntry({ type: 'mindfulness', data: { kind: 'breathtap' } }) === 'moontap' && M.forEntry({ type: 'mindfulness', data: { kind: 'informal' } }) === 'practice' && M.forEntry({ type: 'mindfulness', data: { kind: 'erin' } }) === 'session' && M.forEntry({ type: 'food', data: {} }) === 'food' && M.forEntry({ type: 'weight', data: {} }) === 'weight');
  var seen = {}; for (var i = 0; i < 6; i++) seen[M.line('symptom')] = 1;
  check('lines take turns rather than repeating', Object.keys(seen).length === M.MOMENTS.symptom.lines.length);
  var fs = require('fs'), path = require('path'), missing = [];
  keys.forEach(function (k) { var p = M.MOMENTS[k].pose; if (p && !fs.existsSync(path.join(root, 'assets/room/dream/avatar-act-' + p + '.webp'))) missing.push(p); });
  check('every pose has its sprite', missing.length === 0, missing.join(','));
})();

(function codexBranchReview() {
  console.log('2e. Codex branch review (20 Oct): note dates, the postpartum pause and no streak');
  var w = fresh(), S = w.OvuStore, O = w.OvuOrb, RW = w.OvuRewards, t = S.today(), post = { lifeStage: 'post' };
  var old = S.add('symptom', S.addDays(t, -365), { symptoms: [], pain: null, mood: '', notes: 'pink discharge today' });
  check('a note from a year ago opens no prompt card', O.entryUrgent(old, post) === null);
  var wk = S.add('symptom', S.addDays(t, -6), { symptoms: [], pain: null, mood: '', notes: 'pink discharge today' });
  check('the same note last week still opens it', (O.entryUrgent(wk, post) || {}).code === 'POSTMENO_BLEED');
  var w2 = fresh(), S2 = w2.OvuStore;
  S2.setProfile({ pregState: 'postpartum', periodsBack: 'no', predictionMode: 'wide', onboardedAt: '2026-07-01T00:00:00Z' });
  [-60, -32, -4].forEach(function (k) { for (var i = 0; i < 4; i++) S2.add('period', S2.addDays(S2.today(), k + i), { flow: 'medium' }); });
  check('after a birth with periods not back, nothing is predicted whatever the set-up date', S2.cycleStats().mode === 'suspended' && !S2.cycleStats().predictedNext);
  S2.setProfile({ periodsBack: 'yes' });
  check('once she says periods are back, predictions start again', S2.cycleStats().mode !== 'suspended');
  var w3 = fresh(), S3 = w3.OvuStore, RW3 = w3.OvuRewards;
  RW3.award(S3.add('sleep', S3.today(), { bedTime: '23:00', wakeTime: '07:00', quality: 3 }));
  check('logging never counts a streak', (RW3.ledger().streak || 0) === 0);
})();

(function singaporeNotes() {
  console.log('2f. notes written by DeepSeek, Doubao and Codex the way women in Singapore type: every urgent one raises a card, no ordinary one does');
  var w = fresh(), O = w.OvuOrb, fx = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures/urgent-notes-sg-2026-10-20.json'), 'utf8')).notes, wrong = [];
  fx.forEach(function (x) { var u = O.urgent(x.note, {}); if ((x.expect === 'urgent') !== !!u) wrong.push('[' + x.expect + '] ' + x.note + ' -> ' + (u ? u.code : 'none')); });
  check('all ' + fx.length + ' notes read as expected', wrong.length === 0, wrong.join(' | '));
})();

(function everyOutfitHasItsOwnSprites() {
  console.log('2g. every outfit she can pick has its own standing, meditating, sleeping and seated sprite, so no fallback changes her clothes');
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), garden = fs.readFileSync(path.join(root, 'ovu-garden.js'), 'utf8'), friends = fs.readFileSync(path.join(root, 'ovu-friends.js'), 'utf8');
  var list = src.slice(src.indexOf('var OUTFITS = ['), src.indexOf('];', src.indexOf('var OUTFITS = ['))).replace(/\/\*[\s\S]*?\*\//g, '');
  var ids = (list.match(/\{ id: '([a-z0-9-]+)'/g) || []).map(function (m) { return /'([a-z0-9-]+)'/.exec(m)[1]; });
  var sit = /var SIT = (\{[^\n]*\});/.exec(garden)[1], art = path.join(root, 'assets/room/dream'), missing = [];
  ids.forEach(function (o) {
    ['avatar-' + o, o === 'yoga' ? 'avatar-meditate' : 'avatar-meditate-' + o, o === 'pajamas' ? 'avatar-sleeping' : 'avatar-sleeping-' + o, 'avatar-sit-' + o].forEach(function (f) { if (!fs.existsSync(path.join(art, f + '.webp'))) missing.push(f); });
    if (sit.indexOf(o === 'base' ? 'base:' : (/-/.test(o) ? "'" + o + "'" : o + ':')) < 0) missing.push('SIT.' + o);
  });
  check(ids.length + ' outfits, each with all four sprites and a seat measurement', ids.length >= 9 && missing.length === 0, missing.join(', '));
  check('the tudung outfit waits until its sprites are drawn', ids.indexOf('tudung') < 0 || missing.length === 0);
  var looks = (friends.slice(friends.indexOf('var LOOKS = ['), friends.indexOf(']];', friends.indexOf('var LOOKS = [')) + 2).match(/\['([a-z0-9-]+)', '[^']+'\]/g) || []).map(function (m) { return /'([a-z0-9-]+)'/.exec(m)[1]; });
  check('every friend card look is an outfit with a standing sprite', looks.length >= 9 && looks.every(function (l) { return ids.indexOf(l) >= 0; }), looks.join(','));
})();

(function mapWithoutShortcuts() {
  console.log('2h. no place shortcuts: the map finds every place by its doors, routes one-way doors, and lays the places out apart');
  var ctx = vm.createContext({ window: { document: null } }); ctx.window.window = ctx.window;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-map.js'), 'utf8'), ctx, { filename: 'ovu-map.js' });
  var M = ctx.window.OvuMap, hs = function (id, label) { return { id: id, label: label }; };
  var LAY = {
    room: { id: 'room', name: 'Your room', img: 'room.webp', doors: [{ id: 'door', to: 'garden', x: 50, y: 80 }], hotspots: [hs('door', 'Door · out to the garden')] },
    house: { id: 'house', name: 'Your dream house', img: 'house.webp', doors: [{ id: 'door', to: 'garden', x: 50, y: 80 }], hotspots: [] },
    garden: { id: 'garden', name: 'Your garden', img: 'g.webp', doors: [{ id: 'gate', to: 'home', x: 29, y: 58 }, { id: 'arch', to: 'street', x: 80, y: 55 }, { id: 'farmpath', to: 'farm', x: 70, y: 66 }, { id: 'ghdoor', to: 'greenhouse', x: 62, y: 49 }],
      hotspots: [hs('gate', 'Gate · back home'), hs('arch', 'Arch · on to Dream Street'), hs('farmpath', 'Path · down to the farm'), hs('ghdoor', 'Door · into the greenhouse')] },
    greenhouse: { id: 'greenhouse', name: 'The greenhouse', img: 'gh.webp', doors: [{ id: 'ghout', to: 'garden', x: 50, y: 80 }], hotspots: [hs('ghout', 'Door · back to the garden')] },
    farm: { id: 'farm', name: 'Your farm', img: 'f.webp', doors: [{ id: 'farmgate', to: 'garden', x: 15, y: 57 }], hotspots: [hs('farmgate', 'Gate · back to the garden')] },
    street: { id: 'street', name: 'Dream Street', img: 's.webp', doors: [{ id: 'arch', to: 'garden', x: 16, y: 60 }, { id: 'arch2', to: 'plaza', x: 84, y: 60 }, { id: 'petshop', tap: 'petshop', to: 'shop-pet', x: 23, y: 62 }, { id: 'furniture', tap: 'furniture', to: 'shop-furniture', x: 50, y: 62 }, { id: 'homes', tap: 'homes', to: 'shop-homes', x: 74, y: 62 }],
      hotspots: [hs('arch', 'Arch · back to the garden'), hs('arch2', 'Arch · on to the plaza'), hs('petshop', 'Whisker & Paw · pets'), hs('furniture', 'The Cosy Nook · furniture'), hs('homes', 'Moonrise Homes · houses')] },
    plaza: { id: 'plaza', name: 'The plaza', img: 'p.webp', doors: [{ id: 'arch', to: 'street', x: 20, y: 58 }, { id: 'gate', to: 'home', x: 54, y: 64 }], hotspots: [hs('arch', 'Arch · back to the street'), hs('gate', 'Gate · home')] },
    'shop-pet': { id: 'shop-pet', store: 'pet', name: 'Whisker & Paw', img: 'sp.webp', doors: [{ id: 'mat', to: 'street', x: 46, y: 76 }], hotspots: [hs('mat', 'Door mat · back to the street')] },
    'shop-furniture': { id: 'shop-furniture', store: 'furniture', name: 'The Cosy Nook', img: 'sf.webp', doors: [{ id: 'mat', to: 'street', x: 48, y: 76 }], hotspots: [hs('mat', 'Door mat · back to the street')] },
    'shop-homes': { id: 'shop-homes', store: 'home', name: 'Moonrise Homes', img: 'sh.webp', doors: [{ id: 'mat', to: 'street', x: 35, y: 73 }], hotspots: [hs('mat', 'Door mat · back to the street')] }
  };
  var g = M.graph(LAY, 'room'), ids = Object.keys(g.nodes).sort();
  check('every door-connected place is found from home, a new zone included, and a neighbour visit is not', ids.join(',') === 'farm,garden,greenhouse,home,plaza,shop-furniture,shop-homes,shop-pet,street', ids.join(','));
  var doors = function (r) { return r ? r.map(function (e) { return e.door; }).join('>') : 'none'; };
  check('home to the plaza is the door, the garden arch and the street arch', doors(M.route(g, 'home', 'plaza')) === 'door>arch>arch2', doors(M.route(g, 'home', 'plaza')));
  check('the plaza gate is a one-way way home', doors(M.route(g, 'plaza', 'home')) === 'gate', doors(M.route(g, 'plaza', 'home')));
  check('from the pet shop home: door mat, the street arch, the garden gate', doors(M.route(g, 'shop-pet', 'home')) === 'mat>arch>gate', doors(M.route(g, 'shop-pet', 'home')));
  check('directions use the labels she sees on each door', M.route(g, 'farm', 'home').map(function (e) { return M.stepText(g, e).door; }).join(' / ') === 'Gate · back to the garden / Gate · back home');
  check('names read naturally: Garden, Plaza, a shop keeps its own name', g.nodes.garden.name === 'Garden' && g.nodes.plaza.name === 'Plaza' && g.nodes['shop-furniture'].name === 'The Cosy Nook' && g.nodes.home.name === 'Home' && M.at(g, 'street') === 'on Dream Street');
  var P = M.place(g), keys = Object.keys(P), apart = true, inside = true;
  keys.forEach(function (a) { var p = P[a]; if (p[0] < 5 || p[0] > 95 || p[1] < 5 || p[1] > 75) inside = false; keys.forEach(function (b) { if (a < b && Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) < 12) apart = false; }); });
  check('every place gets a spot on the map, inside it and apart from the others (the new greenhouse too)', keys.length === 9 && apart && inside && !!P.greenhouse, JSON.stringify(P));
  var bent = M.lines(g, P).filter(function (l) { return l.curve; }).length;
  check('the plaza gate home bends round the garden instead of crossing it', bent >= 1, bent);
  check('there is no route to a place that is not on the map', M.route(g, 'home', 'house') === null);
})();

(function morningStart() {
  console.log('2i. Morning start (Jamie, 20 Oct): offered 04:00 to 11:59 by the real clock, never asleep, put away for the day; Erin\'s brushing script whole; no breath counts; 30 seconds; the shared heart cap');
  var w = fresh('2026-10-20'), M = w.OvuMorning, MF = w.OvuMindful, S = w.OvuStore, RW = w.OvuRewards, MO = w.OvuMoments;
  var at = function (h, m, sec) { return new Date(2026, 9, 20, h, m || 0, sec || 0); };
  check('the window opens at 04:00 and closes at noon', !M.inWindow(at(3, 59, 59)) && M.inWindow(at(4)) && M.inWindow(at(11, 59, 59)) && !M.inWindow(at(12)) && !M.inWindow(at(0, 30)) && !M.inWindow(at(21)));
  check('the invitation: never while asleep, not once done or put away today, back the next morning', M.offered({}, '2026-10-20', at(8)) && !M.offered({ sleeping: { startedAt: 'x' } }, '2026-10-20', at(8)) &&
    !M.offered({ morningStart: { date: '2026-10-20', dismissed: true } }, '2026-10-20', at(8)) && !M.offered({ morningStart: { date: '2026-10-20', done: true } }, '2026-10-20', at(9)) &&
    M.offered({ morningStart: { date: '2026-10-19', done: true } }, '2026-10-20', at(7)) && !M.offered({}, '2026-10-20', at(13)));
  var yw = M.plan('yourway').map(function (x) { return x.key; }), er = M.plan('erin'), teeth = MF.byId('teeth'), mv = teeth.variations.filter(function (v) { return v.when === 'morning' && v.author === 'erin'; })[0];
  check('your way: arrive, notice, then brushing only after she says she is ready', yw.join() === 'arrive,notice,ready,yourway' && M.STEPS.ready.gate && M.STEPS.yourway.open && !M.STEPS.yourway.secs, yw.join());
  var wakeV = MF.byId('wake').variations[0], sipV = MF.byId('coffee').variations.filter(function (v) { return v.when === 'morning' && v.author === 'erin'; })[0], sipI = MF.byId('coffee').variations.indexOf(sipV);
  var groups = er.map(function (x) { return x.gate ? 'gate:' + x.group : x.group; }).filter(function (g, i, a) { return g !== a[i - 1]; }).join(',');
  check('with Erin (21 Oct): her wake-up script, a gate, her brushing script, a gate, her mindful sip, in her words and order with her clips', er.length === wakeV.steps.length + 1 + mv.steps.length + 1 + sipV.steps.length && groups === 'wake,gate:teeth,teeth,gate:sip,sip' && er.slice(0, wakeV.steps.length).every(function (x, i) { return x.text === wakeV.steps[i].text && x.secs === wakeV.steps[i].secs && x.audio === 'assets/audio/guide-interim/wake-0-' + i + '.mp3' && x.erin && x.part === 1; }) && er.slice(-sipV.steps.length).every(function (x, i) { return x.text === sipV.steps[i].text && x.audio === 'assets/audio/guide-interim/coffee-' + sipI + '-' + i + '.mp3' && x.pose === 'coffee' && x.part === 3; }), groups);
  var brush = er.filter(function (x) { return x.group === 'teeth' && !x.gate; });
  check('with Erin the brushing part is her whole script, in the brushing pose, with her clips', brush.length === mv.steps.length && brush.every(function (x, i) { return x.text === mv.steps[i].text && x.secs === mv.steps[i].secs && x.audio === 'assets/audio/guide-interim/teeth-' + teeth.variations.indexOf(mv) + '-' + i + '.mp3' && x.pose === 'teeth' && x.erin && x.part === 2; }), brush.length);
  var poses = er.slice(0, wakeV.steps.length).map(function (x) { return x.pose || '-'; }).join(',');
  check('the wake-up stands still except on its two movement passages (shoulders, arms), which take the stretch pose', poses === '-,-,stretch,stretch,-,-', poses);
  var ps = M.partsOf(er), tot = ps.reduce(function (t, p) { return t + p.secs; }, 0);
  check('about 90 seconds before brushing your way; with Erin about ten minutes in three parts of three to four minutes, gates untimed', M.STEPS.arrive.secs + M.STEPS.notice.secs === 90 && ps.map(function (p) { return p.group; }).join() === 'wake,teeth,sip' && ps.every(function (p) { return p.secs >= 150 && p.secs <= 260; }) && tot >= 540 && tot <= 660, JSON.stringify(ps));
  check('the gates: Ready to brush or Skip this part; Ready to sip or Skip this part, with water, fasting and no drink all fine reasons', M.GATES.brush.ready === 'Ready to brush' && M.GATES.brush.skip === 'Skip this part' && M.GATES.sip.ready === 'Ready to sip' && M.GATES.sip.skip === 'Skip this part' && /Water|water/.test(M.GATES.sip.text) && /fasting/.test(M.GATES.sip.text) && !/should/.test(M.GATES.sip.text) && /wheelchair/.test(M.CARE_WAKE) && /change your breathing/.test(M.CARE_WAKE));
  var copy = [M.STEPS.arrive, M.STEPS.notice, M.STEPS.ready, M.STEPS.yourway].map(function (x) { return x.title + ' ' + x.text; }).concat(Object.keys(M.VERSIONS).map(function (k) { return M.VERSIONS[k].name + ' ' + M.VERSIONS[k].sub; }));
  check('no breath counts, pacing or promises in the copy, no "should", no em dash', copy.every(function (t) { return !/\b(count|inhale for|exhale for|hold for|4-7-8|box breath|breathe in for|per minute|should|cure|heal|reduce)\b/i.test(t) && t.indexOf('—') < 0; }) && !/\d/.test(M.STEPS.arrive.text + M.STEPS.notice.text), copy.filter(function (t) { return /\d|—/.test(t); }).join(' | '));
  check('the first steps invite any position, care for dizziness, leave the breath alone, offer touch, sound and colour, and stopping', /Sit, lie down or stand/.test(M.STEPS.arrive.text) && /dizzy, stay sitting or lying/.test(M.STEPS.arrive.text) && /eyes can be open or closed/.test(M.STEPS.arrive.text) && /no need to change your breathing/.test(M.STEPS.arrive.text) && /something you can touch/.test(M.STEPS.arrive.text) && /don’t need to move/.test(M.STEPS.notice.text) && /a sound or a colour instead/.test(M.STEPS.notice.text) && /stop at any time/.test(M.STEPS.notice.text));
  check('any sink, and time for prayer or anything else before brushing', /wherever you brush/.test(M.STEPS.ready.text) && /prayer or anything else/.test(M.STEPS.ready.text) && !/the sink/.test(M.STEPS.ready.text));
  var am = M.plan('yourway', at(8))[0], pm = M.plan('yourway', at(19))[0], gm = M.arriveFor(at(4)), hi = M.arriveFor(at(12));
  check('Good morning only inside the morning window, Hello at any other hour, each with its own clip', am.text.indexOf('Good morning. Sit') === 0 && /mstart-arrive-0\.mp3$/.test(am.audio) && pm.text.indexOf('Hello. Sit') === 0 && /mstart-arrive-1\.mp3$/.test(pm.audio) && gm.text.indexOf('Good morning') === 0 && hi.text.indexOf('Hello') === 0 && M.STEPS.arrive.text.indexOf('Good') < 0, am.text.slice(0, 20) + ' | ' + pm.text.slice(0, 20));
  var brushAt = brush.map(function (x) { return x.brushing ? 1 : 0; }).join('');
  check('with Erin, brushing counts only from the line after "beginning to brush", not while she picks up the brush', brushAt === '00011111' && /beginning to brush/.test(brush[2].text), brushAt);
  var e8 = M.plan('erin', at(8))[0], e19 = M.plan('erin', at(19))[0], e2 = M.arriveFor(at(8), 'erin');
  check('with Erin the first words are her own Good morning from the wake-up, at any hour, so no Rhythme greeting comes before hers', e8.text.indexOf('Good morning.') === 0 && e19.text === e8.text && /wake-0-0\.mp3$/.test(e8.audio) && e2.text.indexOf('Sit, lie down') === 0 && /mstart-arrive-2\.mp3$/.test(e2.audio), e8.text.slice(0, 20));
  var voiced = [am, pm, e8, M.STEPS.notice, M.STEPS.ready, M.STEPS.yourway].concat(er.filter(function (x) { return x.audio; }));
  check('every Rhythme step has its own clip on disk, read in Erin\'s voice; Quiet keeps it captions only', voiced.every(function (x) { return x.audio && fs.existsSync(path.join(root, x.audio)) && fs.statSync(path.join(root, x.audio)).size > 20000; }), voiced.map(function (x) { return x.audio; }).join());
  var now = 0, c = M.makeClock(function () { return now; });
  c.run(); now = 10000; c.hold(); now = 25000; c.run(); now = 55000;
  check('practice time counts only while a step runs, not while paused or walking to the sink', c.seconds() === 40 && c.running(), c.seconds());
  check('nothing under 30 seconds, nothing unconfirmed; 29.6 seconds does not round up to 30', M.entryData({ seconds: 29, confirmed: true }) === null && M.entryData({ seconds: 29.6, confirmed: true }) === null && M.entryData({ seconds: 300, confirmed: false }) === null && M.entryData({ seconds: 30.4, confirmed: true }).seconds === 30);
  var c2 = M.makeClock(function () { return now; }); now = 0; c2.run(); now = 29600; c2.hold();
  check('the clock keeps exact milliseconds for the 30-second rule', c2.ms() === 29600 && c2.seconds() === 30);
  var d = M.entryData({ seconds: 30, confirmed: true, version: 'yourway', skipped: ['notice'], brushed: 'yourway', finished: true });
  check('one honest entry: informal, morning, real seconds, what was skipped, whether it finished', d && d.kind === 'informal' && d.activity === 'morning' && d.seconds === 30 && d.minutes === 0.5 && d.skipped.join() === 'notice' && d.finished && d.completed && d.confirmedReal && d.brushed === 'yourway', JSON.stringify(d));
  var e2 = M.entryData({ seconds: 95, confirmed: true, version: 'erin', brushed: 'no', finished: false });
  check('a stopped routine is saved as not finished and says brushing did not happen; the credit says whose words and whose voice', e2 && !e2.finished && !e2.completed && e2.brushed === 'no' && /Erin Lee/.test(e2.guide) && /Rhythme in Erin’s voice/.test(e2.guide) && /read in Erin’s voice/.test(d.guide));
  var pts = [1, 2, 3].map(function () { return RW.award(S.add('mindfulness', S.today(), M.entryData({ seconds: 120, confirmed: true, version: 'yourway', brushed: 'yourway', finished: true }))).points; });
  check('the morning pays its small thank-you once a day: repeating it earns nothing more, and there is never a streak', pts.join() === '2,0,0' && (RW.ledger().streak || 0) === 0, pts.join());
  var pe = M.partEntry('wake', { seconds: 193, confirmed: true, finished: true }), ps2 = M.partEntry('sip', { seconds: 41.2, confirmed: true, finished: false });
  check('one entry per part she did: the wake-up as the wake practice, the sip as the coffee practice, stopped early said plainly, nothing under 30 seconds or unconfirmed', pe && pe.activity === 'wake' && pe.routine === 'morning' && pe.completed && !pe.stoppedEarly && pe.seconds === 193 && ps2 && ps2.activity === 'coffee' && !ps2.completed && ps2.stoppedEarly && ps2.seconds === 41 && /Erin Lee/.test(ps2.guide) && M.partEntry('sip', { seconds: 29.9, confirmed: true, finished: true }) === null && M.partEntry('wake', { seconds: 60, confirmed: false }) === null && M.partEntry('nap', { seconds: 60, confirmed: true }) === null);
  var pp = ['wake', 'sip', 'wake', 'sip'].map(function (g) { return RW.award(S.add('mindfulness', S.today(), M.partEntry(g, { seconds: 120, confirmed: true, finished: true }))).points; });
  check('the wake-up and the sip each pay once a day on top of the brushing slot, inside the same 6 cap; a repeat of either pays nothing', pp.join() === '2,2,0,0', pp.join());
  var n0 = S.list('mindfulness').length, ls = w.localStorage, realSet = ls.setItem, threw = false;
  ls.setItem = function () { throw new Error('storage full'); };
  try { S.add('mindfulness', S.today(), M.entryData({ seconds: 60, confirmed: true, version: 'yourway', brushed: 'yourway', finished: true })); } catch (e) { threw = true; }
  ls.setItem = realSet;
  var n1 = S.list('mindfulness').length, again = S.add('mindfulness', S.today(), M.entryData({ seconds: 60, confirmed: true, version: 'yourway', brushed: 'yourway', finished: true }));
  check('a save that fails (storage full) throws and leaves memory as it was, so a retry saves exactly one', threw && n1 === n0 && again && S.list('mindfulness').length === n0 + 1 && S.list('mindfulness').filter(function (e) { return e.id === again.id; }).length === 1, n0 + ',' + n1);
  S.remove(again.id);
  var ev = S.list('mindfulness').filter(function (e) { return e.data.activity === 'morning'; }).slice(-1)[0]; /* the short-pause morning; a routine part is a practice of its own */
  check('the moment after it: "That pause was yours", not a claim about minutes', MO.forEntry(ev) === 'morning' && MO.MOMENTS.morning.lines.indexOf('That pause was yours.') >= 0 && MO.MOMENTS.morning.pose === null);
})();

(function gameMinutesNeedConfirmation() {
  console.log('garden and games: diary writes require a confirmed mindful minute; stale watering cannot claim a new activity');
  function node() { return { style: {}, dataset: {}, innerHTML: '', hidden: false, textContent: '', ls: {}, classList: { add: function () { }, remove: function () { }, contains: function () { return false; } }, setAttribute: function () { }, addEventListener: function (k, f) { this.ls[k] = f; }, querySelector: function () { return null; }, appendChild: function () { }, remove: function () { }, focus: function () { }, fire: function () { if (this.ls.click) this.ls.click(); } }; }
  function plantWorld(greenhouse) {
    var w = fresh('2026-10-22'), nodes = {}, q = [], hooks = {}, calls = [], stop = null, active = false, sheetOpen = false, intervals = [];
    function el(id) { return nodes[id] || (nodes[id] = node()); }
    w.setTimeout = function (f, ms) { var t = { f: f, ms: ms, live: true }; q.push(t); return t; }; w.clearTimeout = function (t) { if (t) t.live = false; }; w.setInterval = function (f) { var t = { f: f, live: true }; intervals.push(t); return t; }; w.clearInterval = w.clearTimeout;
    w.document = { createElement: node, addEventListener: function () { }, getElementById: el };
    w.Audio = function () { this.pause = function () { calls.push('pause'); }; this.play = function () { return Promise.resolve(); }; };
    var R = w.OvuRoom = { ART: '', LAYOUTS: {}, hotspotHandlers: {}, els: { props: node(), avatar: node(), scene: node() }, layout: function () { return { id: greenhouse ? 'greenhouse' : 'garden' }; },
      on: function (k, f) { (hooks[k] = hooks[k] || []).push(f); }, esc: function (x) { return x; }, sessionOn: function () { return active; }, sheetOpen: function () { return sheetOpen; }, asleep: function () { return false; }, practiceOn: function () { return false; }, busy: function () { return false; },
      hideSheet: function () { calls.push('hideSheet'); }, openSheet: function (id) { calls.push(id); }, setHudStop: function (f) { stop = f; calls.push('stopHook'); }, hudOn: function (x) { calls.push('hud:' + x); }, caption: function (x) { calls.push('caption:' + x); }, setPose: function () { calls.push('pose'); }, restorePose: function () { calls.push('restore'); }, chime: function () { }, toast: function (x) { calls.push(x); }, afterSave: function (ev) { w.OvuRewards.award(ev); calls.push('saved'); } };
    w.OvuWalk = { napping: function () { return false; } };
    var file = greenhouse ? 'ovu-greenhouse.js' : 'ovu-garden.js', src = fs.readFileSync(path.join(root, file), 'utf8');
    if (greenhouse) src = src.replace('})(window);', 'root.__minuteStart = function () { runMinute({ kind: "care", id: "hoya", name: "Hoya", title: "Hoya" }, ["one", "two", "three", "four"], "plants"); };\n})(window);');
    else src = src.replace('})(window);', 'root.__minuteStart = startWatering;\n})(window);');
    vm.runInContext(src, w, { filename: file }); (hooks.boot || []).forEach(function (f) { f(); });
    return { w: w, q: q, calls: calls, el: el, intervals: intervals, sheet: function (v) { sheetOpen = v; }, wait: function () { intervals.forEach(function (t) { if (t.live) t.f(); }); }, start: w.__minuteStart, stop: function () { return stop; }, active: function (x) { active = x; }, emit: function (k) { (hooks[k] || []).forEach(function (f) { f(); }); }, finish: function () { q.filter(function (t) { return t.live && t.ms === 60000; }).slice(-1)[0].f(); } };
  }
  var g = plantWorld(false); g.start(); var stale = g.q.map(function (t) { return t.f; }), oldStop = g.stop();
  g.emit('activity'); g.active(true); var endedAt = g.calls.length; stale.forEach(function (f) { f(); }); oldStop();
  check('garden watering cancels synchronously on activity, pauses audio and leaves a new session\'s HUD, pose, Stop and diary untouched', !g.w.OvuGarden.watering() && g.q.every(function (t) { return !t.live; }) && g.calls.indexOf('pause') > -1 && g.calls.length === endedAt && g.w.OvuStore.list('mindfulness').length === 0);
  g.active(false); g.start(); var newerAt = g.calls.length; stale.forEach(function (f) { f(); }); oldStop();
  check('a cancelled watering\'s clips, captions, completion and Stop callbacks cannot act inside its replacement', g.w.OvuGarden.watering() && g.calls.length === newerAt && g.w.OvuStore.list('mindfulness').length === 0);
  g.emit('beforeWalk');
  check('beforeWalk cancels watering at once and restores the old pose without a journal entry', !g.w.OvuGarden.watering() && g.calls.indexOf('restore') > -1 && g.w.OvuStore.list('mindfulness').length === 0);
  [false, true].forEach(function (gh) {
    var p = plantWorld(gh), S = p.w.OvuStore, id = gh ? 'gh' : 'garden'; p.start(); p.finish();
    check((gh ? 'greenhouse' : 'garden') + ' completion asks Yes/No and writes no mindfulness automatically' + (gh ? '' : ', while the plot keeps its watering'), S.list('mindfulness').length === 0 && p.calls.indexOf(gh ? 'greenhouseDone' : 'gardenDone') > -1 && (gh || S.state().garden.watered.indexOf(S.today()) > -1));
    p.el(id + 'No').fire(); check((gh ? 'greenhouse' : 'garden') + ' No leaves the journal empty', S.list('mindfulness').length === 0);
    p.start(); p.sheet(true); var asked = p.calls.filter(function (c) { return c === (gh ? 'greenhouseDone' : 'gardenDone'); }).length; p.finish(); p.wait(); var whileOpen = p.calls.filter(function (c) { return c === (gh ? 'greenhouseDone' : 'gardenDone'); }).length; p.sheet(false); p.wait();
    check((gh ? 'greenhouse' : 'garden') + ' a finished minute waits for an open journal form to close before asking', asked === whileOpen && p.calls.filter(function (c) { return c === (gh ? 'greenhouseDone' : 'gardenDone'); }).length === asked + 1 && S.list('mindfulness').length === 0); p.el(id + 'No').fire();
    p.start(); p.finish(); var add = S.add, fail = true; S.add = function () { if (fail) throw new Error('quota'); return add.apply(S, arguments); };
    p.el(id + 'Yes').fire(); var beforeRetry = S.list('mindfulness').length; fail = false; p.el(id + 'Yes').fire(); p.el(id + 'Yes').fire();
    check((gh ? 'greenhouse' : 'garden') + ' a failed Yes keeps the confirmation for retry, then saves and awards once', beforeRetry === 0 && S.list('mindfulness').length === 1 && S.list('mindfulness')[0].data.confirmedReal === true && p.calls.filter(function (c) { return c === 'saved'; }).length === 1 && p.w.OvuRewards.ledger().hearts === 2);
    var d = plantWorld(gh); d.start(); d.sheet(true); d.finish(); var oldAsk = d.intervals[0].f; d.start(); d.sheet(false); var atNew = d.calls.length; oldAsk();
    check((gh ? 'greenhouse' : 'garden') + ' an old deferred question cannot open over a new minute', d.calls.length === atNew); d.finish(); var atDone = d.calls.length; oldAsk(); check((gh ? 'greenhouse' : 'garden') + ' a new completion invalidates the previous deferred question', d.calls.length === atDone);
  });
  function gameWorld(flower) {
    var w = fresh('2026-10-22'), nodes = {}, stamp = 100000, now = Date.now(), prefix = flower ? 'lf' : 'btap';
    function el(id) { return nodes[id] || (nodes[id] = node()); }
    w.__gameEl = { querySelector: el }; w.document.body = { classList: { remove: function () { } } }; w.performance = { now: function () { return stamp; } }; w.cancelAnimationFrame = function () { };
    var file = flower ? 'ovu-lightflower.js' : 'ovu-breathtap.js', src = fs.readFileSync(path.join(root, file), 'utf8'), name = flower ? 'OvuLightFlower' : 'OvuBreathTap';
    var seed = flower ? 'st = {t0: root.performance.now() - seconds * 1000, plan: 0, startedAt: "start", pace: "own"};' : 'state = {startedAt: Date.now() - seconds * 1000, preset: "own", taps: 3, plan: 0};';
    src = src.replace('  root.' + name + ' = ', '  el = root.__gameEl; root.__gameTest = { seed: function(seconds, cb) { opts = {onSaved: cb}; pending = null; ' + seed + ' }, pending: function() { return pending; }, confirm: function() { return finishSave(pending); } };\n  root.' + name + ' = ');
    vm.runInContext(src, w, { filename: file }); return { w: w, S: w.OvuStore, game: w[name], T: w.__gameTest, el: function (s) { return el('#' + prefix + s); } };
  }
  [false, true].forEach(function (flower) {
    var a = gameWorld(flower), label = flower ? 'Light Flower' : 'Koi Pond', awarded = 0;
    function award(ev) { awarded++; a.w.OvuRewards.award(ev); }
    a.T.seed(61, award); a.game.stop(false);
    check(label + ' Stop asks about saving a mindful minute and writes nothing before Yes', a.S.list('mindfulness').length === 0 && a.T.pending() && /Save this mindful minute/.test(a.el('Done b').textContent));
    if (!flower) check('Koi Pond keeps its ripple count while asking about journal saving', /3 ripples/.test(a.el('Sum').textContent));
    a.game.close(); check(label + ' No or Close discards the game without a diary entry', a.S.list('mindfulness').length === 0 && !a.T.pending());
    a.T.seed(59.9, award); a.game.stop(false); check(label + ' never rounds a sub-minute game up into save eligibility', !a.T.pending() && a.S.list('mindfulness').length === 0);
    a.T.seed(90, award); a.game.stop(false, true); check(label + ' a silent bedtime close cannot save a long game', !a.T.pending() && a.S.list('mindfulness').length === 0);
    a.T.seed(90, award); a.game.stop(false); var original = a.S.add, fail = true; a.S.add = function () { if (fail) throw new Error('quota'); return original.apply(a.S, arguments); }; a.T.confirm();
    check(label + ' a failed long save says Your pause could not be saved and keeps Retry with its payload', a.S.list('mindfulness').length === 0 && a.T.pending() && a.T.pending().data.seconds === 90 && a.el('Done b').textContent === 'Your pause could not be saved' && !a.el('Retry').hidden);
    fail = false; a.T.confirm(); a.T.confirm(); check(label + ' Retry inserts and awards the confirmed minute exactly once', a.S.list('mindfulness').length === 1 && a.S.list('mindfulness')[0].data.confirmedReal === true && awarded === 1 && !a.T.pending());
    var b = gameWorld(flower), attempts = 0; b.T.seed(80, function (ev) { attempts++; if (attempts === 1) throw new Error('reward quota'); b.w.OvuRewards.award(ev); }); b.game.stop(false); b.T.confirm();
    check(label + ' distinguishes an already saved entry from a failed award', b.S.list('mindfulness').length === 1 && b.T.pending() && b.T.pending().ev && /hearts could not be saved/.test(b.el('Sum').textContent));
    b.T.confirm(); check(label + ' reward retry uses the same entry instead of duplicating the journal', b.S.list('mindfulness').length === 1 && attempts === 2 && b.w.OvuRewards.ledger().hearts === 2 && !b.T.pending());
    var c = gameWorld(flower), tries = 0; c.T.seed(75, function (ev) { tries++; if (tries === 1) return { rewardFailed: true }; c.w.OvuRewards.award(ev); return { rewardFailed: false }; }); c.game.stop(false); c.T.confirm(); var retained = !!(c.T.pending() && c.T.pending().ev); c.T.confirm();
    check(label + ' the room\'s nonthrowing rewardFailed result also keeps Retry and reuses the saved entry', retained && tries === 2 && c.S.list('mindfulness').length === 1 && c.w.OvuRewards.ledger().hearts === 2 && !c.T.pending());
  });
})();

(function soundKitAndLightFlower() {
  console.log('2i. the sound kit: one switch (never chosen is on), quiet volume, no stacking; Light Flower lights without flashing and saves only time');
  var w = fresh(), S = w.OvuStore, SD = w.OvuSound, LF = w.OvuLightFlower, RW = w.OvuRewards, MO = w.OvuMoments;
  check('never choosing counts as sound on; switching off is off; the default volume is a quarter, at the reviewed loudness', SD.enabled() === true && (S.setState({ sound: false }), SD.enabled() === false) && (S.setState({ sound: true }), SD.enabled() === true) && SD.volume() === 0.25 && SD.gainFor(0.25) === 1);
  check('the volume is kept between silent and full', SD.setVolume(2) === 1 && SD.volume() === 1 && SD.setVolume(-1) === 0 && (SD.setVolume(0.25), SD.volume() === 0.25));
  check('fast taps never stack: a flower note at most every 1.2 s, a tap click every 120 ms', SD.allowed('petal', 1000, 0) && !SD.allowed('petal', 2100, 1000) && SD.allowed('petal', 2300, 1000) && SD.allowed('tap', 1130, 1000) && !SD.allowed('tap', 1100, 1000) && !SD.allowed('nosuch', 5, 0));
  var walk = true; for (var i = 0; i < SD.SCALE.length; i++) [0.1, 0.9].forEach(function (r) { var n = SD.nextPetal(i, r); if (n < 0 || n >= SD.SCALE.length || Math.abs(n - i) !== 1) walk = false; });
  check('the flower notes walk to a neighbouring note of a pentatonic scale, never a leap', walk && SD.SCALE.length === 7);
  check('with no audio device nothing breaks: play and the air simply do nothing', SD.play('petal') === false && SD.ambience(true) === false);
  check('a petal rises over 180 ms and settles over three seconds; nothing faster', LF.glowAt(0) === 0 && Math.abs(LF.glowAt(180) - 1) < 1e-9 && LF.glowAt(90) > 0.4 && LF.glowAt(90) < 0.6 && LF.glowAt(2000) > 0 && LF.glowAt(3180) === 0 && LF.glowAt(800) > LF.glowAt(1600));
  var h0 = LF.headAt(0), h3 = LF.headAt(LF.BREATH_S / 4), hs = LF.headAt(30, true), breathOk = true; for (var q = 0; q < 60; q += 0.37) { var hh = LF.headAt(q); if (Math.abs(hh.s - 1) > 0.025) breathOk = false; }
  check('the flower turns slowly (a quarter turn in half a minute) and breathes within a few percent; reduced motion keeps it still', h0.s === 1 && h3.s > 1.02 && breathOk && Math.abs(LF.headAt(30).rot - h0.rot - Math.PI / 2) < 1e-9 && hs.s === 1 && hs.rot === h0.rot);
  var held = [500, 1500, 2500].every(function (t) { return Math.abs(LF.glowAt(LF.holdFrom(t)) - LF.glowAt(t)) < 1e-6; });
  check('tapping a glowing petal holds its brightness (no jump, no flash) and a dark one rises from dark', held && LF.holdFrom(5000) === 0 && LF.holdFrom(100) === 100);
  check('at most one new petal every 400 ms, so nothing can flash three times a second', LF.MIN_GAP_MS >= 334);
  var r = 100, rot = 0.14, up = LF.petalFor(Math.cos(rot - Math.PI / 2) * 60, Math.sin(rot - Math.PI / 2) * 60, r, 3, rot), right = LF.petalFor(Math.cos(rot + Math.PI / 6) * 60, Math.sin(rot + Math.PI / 6) * 60, r, 3, rot);
  check('a tap on a petal lights that petal; a tap off the flower lights the next one round', up === 0 && right === 2 && LF.petalFor(500, 500, r, 3, rot) === 4 && LF.petalFor(500, 500, r, 5, rot) === 0);
  var e = LF.entryFor(125.4, 2, 'a', 'b');
  check('the saved entry is practice time and the plan, nothing about taps', e.kind === 'lightflower' && e.seconds === 125 && e.minutes === 2.1 && e.planned === 2 && e.completed === true && !('taps' in e) && LF.entryFor(30, 0).completed === false);
  var w2 = fresh(), S2 = w2.OvuStore, R2 = w2.OvuRewards;
  var short = R2.award(S2.add('mindfulness', S2.today(), LF.entryFor(40, 0), 'room')), full = R2.award(S2.add('mindfulness', S2.today(), LF.entryFor(75, 0), 'room'));
  check('hearts: nothing under a full minute, then the small flat practice thank-you', short.points === 0 && full.points === 2);
  check('cute activity sounds: nom nom for food, a dig for planting, a sprinkle for watering, a coin at the shop; logging stays quiet', SD.forMoment('food') === 'munch' && SD.forMoment('plant') === 'dig' && SD.forMoment('farmwater') === 'water' && SD.forMoment('harvest') === 'pop' && SD.forMoment('shop') === 'coin' && SD.forMoment('period') === null && SD.forMoment('symptom') === null && ['munch', 'dig', 'water', 'pop', 'coin', 'pet', 'page', 'swish', 'boop', 'hup', 'sit', 'step', 'door'].every(function (k) { return !!SD.KIT[k] && SD.KIT[k].peak <= 0.05; }));
  check('footsteps follow the ground: wood indoors and in shops, grass in the garden and farm, stone on the street and plaza', SD.surfaceFor({ id: 'room' }) === 'wood' && SD.surfaceFor({ id: 'shop-pet', scene: 'street', store: 'pet' }) === 'wood' && SD.surfaceFor({ id: 'garden', scene: 'garden' }) === 'grass' && SD.surfaceFor({ id: 'farm', scene: 'farm' }) === 'grass' && SD.surfaceFor({ id: 'street', scene: 'street' }) === 'stone' && SD.surfaceFor({ id: 'plaza', scene: 'plaza' }) === 'stone');
  check('footsteps never pile up: at most one every 150 ms', !SD.allowed('step', 1100, 1000) && SD.allowed('step', 1160, 1000));
  check('after Light Flower she listens, with a line about noticing', MO.forEntry({ type: 'mindfulness', data: { kind: 'lightflower' } }) === 'lightflower' && MO.pose('lightflower') === 'listen');
})();

(function heartsLoopAndFarmShop() {
  console.log('2j. hearts: each kind of log earns once a day, nothing twice; hearts buy seed packs, local crops and farm tools, saved in one write');
  var w = fresh(), S = w.OvuStore, RW = w.OvuRewards, t = S.today();
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  var F = w.OvuFarm;
  var food = [1, 2, 3].map(function () { return RW.award(S.add('food', t, { meal: 'lunch', foods: 'chicken rice' }, 'room')).points; });
  check('three identical lunches earn once (6, 0, 0)', food.join(',') === '6,0,0', food.join(','));
  var sy = S.add('symptom', t, { symptoms: ['cramps'] }, 'room'), a1 = RW.award(sy).points; S.remove(sy.id); var a2 = RW.award(S.add('symptom', t, { symptoms: ['cramps'] }, 'room')).points;
  check('deleting and re-making a symptom earns nothing the second time', a1 === 8 && a2 === 0, a1 + ',' + a2);
  check('each kind still earns once: a night of sleep and a period day are 10 each', RW.award(S.add('sleep', t, { bedTime: '23:00', wakeTime: '07:00', quality: 3 }, 'room')).points === 10 && RW.award(S.add('period', t, { flow: 'medium' }, 'room')).points === 10);
  var back = S.add('food', S.addDays(t, -6), { meal: 'dinner', foods: 'soup' }, 'room');
  check('a backfilled day earns nothing extra: the award is for the day she logs, not the day logged', RW.award(back).points === 0);
  check('editing a saved entry earns nothing again, and weight never earns', RW.award(sy).points === 0 && RW.award(S.add('weight', t, { kg: 55 }, 'scale')).points === 0);
  var left = RW.todayLeft();
  check('the hearts card can say what is left to earn today', left.indexOf('food') < 0 && left.indexOf('sleep') < 0 && left.indexOf('reflection') > -1 && left.indexOf('exercise') > -1);
  var l = RW.ledger(); l.dailyLast = S.addDays(t, 30); S.setState({ rewards: l });
  check('a clock set back earns nothing until the real date passes the last day that earned', RW.award(S.add('reflection', t, { text: 'calm' }, 'room')).points === 0);
  l = RW.ledger(); l.dailyLast = t; l.hearts = 5; S.setState({ rewards: l });
  var f0 = JSON.stringify(S.state().farm || null), h0 = RW.ledger().hearts, threw = false;
  try { RW.spend(40, 'test', { farm: { seeds: { radish: 9 } } }); } catch (e) { threw = /more hearts/.test(e.message); }
  check('spending more hearts than she has is refused and changes nothing', threw && RW.ledger().hearts === h0 && JSON.stringify(S.state().farm || null) === f0);
  check('the first five crops are free to grow; local crops wait for hearts', F.STARTER.every(function (k) { return F.canGrow(F.farmState(S), k); }) && !F.canGrow(F.farmState(S), 'kangkong') && !F.takeSeed(S, 'kangkong', t).ok && !F.buyPack(S, RW, 'kangkong').ok);
  var before = JSON.stringify(S.state().farm || null), u0 = F.unlockCrop(S, RW, 'kangkong');
  check('unlocking with too few hearts says so and leaves the farm exactly as it was', !u0.ok && /more hearts/.test(u0.why) && JSON.stringify(S.state().farm || null) === before && RW.ledger().hearts === 5);
  l = RW.ledger(); l.hearts = 400; S.setState({ rewards: l });
  var u1 = F.unlockCrop(S, RW, 'kangkong');
  check('kangkong unlocked for 40 hearts, with one seed to start, and then grows from the free shed too', u1.ok && RW.ledger().hearts === 360 && (F.farmState(S).seeds.kangkong || 0) === 1 && F.canGrow(F.farmState(S), 'kangkong') && F.takeSeed(S, 'kangkong', t).ok && !F.unlockCrop(S, RW, 'kangkong').ok);
  var pk = F.buyPack(S, RW, 'radish');
  check('a seed pack is 3 seeds for 10 hearts, hearts and seeds in one save', pk.ok && pk.n === 3 && RW.ledger().hearts === 350 && (F.farmState(S).seeds.radish || 0) >= 3 && RW.ledger().log[0].what === 'seeds:radish');
  var sh = F.buyTool(S, RW, 'shelf');
  check('the seed shelf gives five free seeds a day instead of three', sh.ok && F.seedsADay(F.farmState(S)) === 5 && RW.ledger().hearts === 200 && !F.buyTool(S, RW, 'shelf').ok);
  var cn = F.buyTool(S, RW, 'bigcan'), dry = F.BEDS.filter(function (b) { return !F.hasWeeds(null, b.id, t); }).slice(0, 3).map(function (b) { return b.id; });
  dry.forEach(function (id) { var f = F.farmState(S); f.seeds.radish = (f.seeds.radish || 0) + 1; S.setState({ farm: f }); F.plant(S, id, 'radish', t); });
  var wa = F.waterAll(S, t);
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  check('the breathing session never asks for a hold: in gently, out slowly (Codex, 20 Oct)', rs.indexOf("setOrb('hold', 'Hold')") < 0 && rs.indexOf('Breathe out slowly') > -1 && rs.indexOf('Breathe in gently') > -1);
  check('the big watering can waters every dry bed once, and only once a day', cn.ok && wa.ok && wa.n === 3 && dry.every(function (id) { return F.wateredToday(F.bed(S, id), t); }) && !F.waterAll(S, t).ok);
})();

(function farmWateringCan() {
  console.log('2k2. the watering can: drawn at the well, one pour a bed, charged in the same save (Jamie, 20 Oct: "I cant fill the watering can")');
  var w = fresh(), S = w.OvuStore, t = S.today();
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  var F = w.OvuFarm, ls = w.localStorage, realSet = ls.setItem;
  function full(on) { ls.setItem = on ? function () { throw new Error('QuotaExceededError'); } : realSet; }
  var clean = F.BEDS.filter(function (b) { return !F.hasWeeds(null, b.id, t); }).map(function (b) { return b.id; });
  S.setState({ farm: { seeds: { radish: 5 } } }); clean.slice(0, 5).forEach(function (id) { F.plant(S, id, 'radish', t); });
  var e0 = F.pour(S, clean[0], t);
  check('an empty can pours nothing and says where the water is', !e0.ok && e0.empty && /well/.test(e0.why) && !F.wateredToday(F.bed(S, clean[0]), t));
  var f1 = F.fillCan(S);
  check('the well fills the can to three pours, and a full can is not filled again', f1.ok && f1.n === 3 && F.canLevel(S) === 3 && !F.fillCan(S).ok);
  var p1 = F.pour(S, clean[0], t);
  check('a pour waters one bed for the day and leaves two pours', p1.ok && p1.days === 1 && p1.left === 2 && F.canLevel(S) === 2 && F.wateredToday(F.bed(S, clean[0]), t));
  var p2 = F.pour(S, clean[0], t);
  check('a bed already watered today takes no water from the can', !p2.ok && F.canLevel(S) === 2);
  full(true); var p3 = F.pour(S, clean[1], t); full(false);
  check('a pour that cannot be saved waters nothing and keeps the water', !p3.ok && !F.wateredToday(F.bed(S, clean[1]), t) && F.canLevel(S) === 2);
  var stub = { n: 0, spendWith: function (a, patch) { this.n++; this.a = a; S.commit(Object.assign({ stamina: { v: 40, max: 100, day: t } }, patch)); return true; } };
  var p4 = F.pour(S, clean[1], t, stub);
  check('with the energy module a pour charges one watering in the same save as the bed and the can', p4.ok && p4.charged && stub.n === 1 && stub.a === 'water' && S.state().stamina.v === 40 && F.canLevel(S) === 1);
  var tired = { spendWith: function () { return false; } }, p5 = F.pour(S, clean[2], t, tired);
  check('too tired: nothing is watered and the water stays in the can', !p5.ok && !F.wateredToday(F.bed(S, clean[2]), t) && F.canLevel(S) === 1);
  var odd = S.state().farm; odd.can = 99; S.setState({ farm: odd });
  check('a can level from elsewhere is never more than the can holds', F.canLevel(S) === 3);
  odd.can = 'x'; S.setState({ farm: odd });
  check('a level that is not a number reads as empty', F.canLevel(S) === 0);
  var l = w.OvuRewards.ledger(); l.hearts = 500; S.setState({ rewards: l }); F.buyTool(S, w.OvuRewards, 'bigcan');
  check('the big can holds twelve pours, one for every bed', F.canCap(F.farmState(S)) === 12 && F.BEDS.length === 12 && F.fillCan(S).n === 12);
  odd = S.state().farm; odd.can = 2; S.setState({ farm: odd });
  var dry = F.dryBeds(S, t).length, wa = F.waterAll(S, t, null, { can: true });
  check('the big can waters as many dry beds as its water reaches, one pour each', dry >= 3 && wa.ok && wa.n === 2 && F.canLevel(S) === 0 && F.dryBeds(S, t).length === dry - 2);
  var we = F.waterAll(S, t, null, { can: true });
  check('with the big can empty, watering all is refused and nothing changes', !we.ok && we.empty && F.dryBeds(S, t).length === dry - 2);
  var ws = F.BEDS.filter(function (b) { return F.hasWeeds(null, b.id, t); }).map(function (b) { return b.id; })[0];
  var sd0 = F.seedsLeftToday(S, t), occ = clean[0], ps = F.plantFromShed(S, occ, 'radish', t);
  check('a free seed planted into a bed that is taken is refused and uses up no seed of the day', !ps.ok && F.seedsLeftToday(S, t) === sd0);
  var empty = F.BEDS.filter(function (b) { return !F.hasWeeds(null, b.id, t) && !F.bed(S, b.id); })[0].id, pk = F.plantFromShed(S, empty, 'carrot', t);
  check('a free seed planted into an empty bed takes one seed of the day and plants it, in one save', pk.ok && F.bed(S, empty).crop === 'carrot' && F.seedsLeftToday(S, t) === sd0 - 1);
  odd = S.state().farm; odd.can = 12; S.setState({ farm: odd });
  var d2 = F.dryBeds(S, t), last = d2[d2.length - 1], tg = F.bulkTargets(S, t, last, 2);
  check('the big can starts with the bed she is looking at, then the rest in order', d2.length >= 2 && tg[0] === last && tg.length === 2 && tg[1] === d2[0]);
  var moved = F.waterAll(S, t, null, { can: true, ids: tg.concat(['bed99']) });
  check('if the shown beds changed, watering all refuses and changes nothing', !moved.ok && moved.changed && F.canLevel(S) === 12 && F.dryBeds(S, t).length === d2.length);
  var shown = F.waterAll(S, t, null, { can: true, ids: tg });
  check('watering all waters exactly the beds she was shown', shown.ok && shown.n === 2 && !F.wateredToday(F.bed(S, d2[1]), t) === (d2.length > 2 && d2[1] !== tg[1]) && F.wateredToday(F.bed(S, last), t) && F.canLevel(S) === 10);
  var src = fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8');
  check('Codex (22 Oct, after the night palette went): completed cycle milestones read dark on their pale gradient, and the journal provenance badge keeps its own selector', /\.ready \.dot\.on i\{[^}]*color:#2a1d44\}/.test(fs.readFileSync(path.join(root, 'room.css'), 'utf8')) && /\}\.srcchip\{/.test(fs.readFileSync(path.join(root, 'journal.html'), 'utf8')) && !/html\.srcchip/.test(fs.readFileSync(path.join(root, 'journal.html'), 'utf8')));
  check('farm beds draw rendered stage pictures (Jamie, 22 Oct: "aesthetic can be better and realistic"): a shared seedling, then every crop half grown and ripe exist as sprites, picked by stage; weeds and the water drop stay as an overlay', Object.keys(F.CROPS).every(function (k) { return fs.existsSync(path.join(root, 'assets/room/farm/crops', k + '-grow.webp')) && fs.existsSync(path.join(root, 'assets/room/farm/crops', k + '-ripe.webp')); }) && fs.existsSync(path.join(root, 'assets/room/farm/crops/seedling.webp')) && F.cropSprite('tomato', 1) === 'seedling' && F.cropSprite('tomato', 2) === 'tomato-grow' && F.cropSprite('tomato', 3) === 'tomato-ripe' && /class="bedcrop ' \+ k\[0\] \+ '" src="assets\/room\/farm\/crops\/' \+ cropSprite\(b\.crop, st\)/.test(src) && /class="bedover"/.test(src) && /if \(weeds\)/.test(src) && /if \(wet\)/.test(src) && src.indexOf('bedSVG') < 0);
  check('the bed sheet waters from the can, with the well one tap away when it is empty', src.indexOf("res = pour(S, id, t, ST)") > -1 && src.indexOf('data-bed="well"') > -1 && src.indexOf('Fill the can at the well') > -1 && src.indexOf("res = water(S, id, now)") < 0);
  check('care steps are slow and stoppable, and save only when the bar is full and the sheet still open', (function () { var care = fs.readFileSync(path.join(root, 'ovu-care.js'), 'utf8'); return /function step[\s\S]*?!box\.isConnected \|\| !R\.sheetOpen\(\) \|\| here\(\) !== tok\.scene[\s\S]*?asleepNow\(\)/.test(care) && care.indexOf('data-slow="stop"') > -1 && src.indexOf("scene: 'farm'") > -1; })() && true);
})();

(function animalLove() {
  console.log('2k3b. animal love (Jamie, 22 Oct): pet, brush and a treat each add one heart a day, up to ten; game state only');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-barn.js'), 'utf8'), w, { filename: 'ovu-barn.js' });
  var B = w.OvuBarn, S = w.OvuStore, F = w.OvuFarm, n0 = S.list().length;
  var a = B.care(S, 'clover', 'pet', '2026-10-21'), b = B.care(S, 'clover', 'pet', '2026-10-21'), c = B.care(S, 'clover', 'brush', '2026-10-21');
  check('a first pet and a first brush each add a heart; a second pet the same day adds nothing', a.gained && !b.gained && c.gained && B.love(S, 'clover') === 2);
  var back = B.care(S, 'clover', 'brush', '2026-10-20');
  check('a clock set back to an earlier day adds nothing', !back.gained && B.love(S, 'clover') === 2);
  for (var i = 0; i < 12; i++) { var d = '2026-11-' + String(i + 1).padStart(2, '0'); B.care(S, 'mochi', 'pet', d); B.care(S, 'mochi', 'brush', d); }
  check('the meter stops at ten', B.love(S, 'mochi') === B.LOVE_MAX && B.LOVE_MAX === 10);
  var f = F.farmState(S); f.harvest = { kangkong: 2 }; S.setState({ farm: f });
  var t = B.giveTreat(S, 'hens', 'kangkong', '2026-12-01');
  check('a treat for the hens adds a heart to each hen that had none from a treat that day', t.ok && t.gained && B.love(S, 'kaya') === 1);
  check('love never writes a diary entry and never touches the logging hearts', S.list().length === n0 && !/OvuRewards/.test(fs.readFileSync(path.join(root, 'ovu-barn.js'), 'utf8').split('function heartPop')[0]));
})();

(function staleRunnersAndPracticeSave() {
  console.log('confirmed audit defects: old session and Everyday callbacks, bedtime threshold, atomic practice confirmation');
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), finished = false;
  function fn(name) { var i = src.indexOf('function ' + name + '('), j = src.indexOf('{', i), d = 0; for (var k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } throw new Error('Missing runner ' + name); }
  function hudFn() { var i = src.indexOf('hudOn: function'), j = src.indexOf('{', i), d = 0; for (var k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i + 7, k + 1); } throw new Error('Missing HUD handover'); }
  function env() {
    var w = fresh('2026-10-22'), now = Date.parse('2026-10-22T10:00:00+08:00'), timers = [], els = {}, clips = [], captions = [], poses = [], saves = [], sheets = [], toasts = [];
    function node(id) { if (els[id]) return els[id]; var cls = {}; return els[id] = { textContent: '', events: {}, classList: { add: function (k) { cls[k] = true; }, remove: function (k) { delete cls[k]; }, contains: function (k) { return !!cls[k]; }, toggle: function (k, on) { if (on) cls[k] = true; else delete cls[k]; } }, addEventListener: function (k, f) { this.events[k] = f; } }; }
    function FD(v) { return arguments.length ? new Date(v) : new Date(now); } FD.now = function () { return now; };
    var c = { window: {}, S: w.OvuStore, MF: w.OvuMindful, session: null, practice: null, meditating: true, activityGen: 0, fadeTimer: null, medTimer: 0, GUIDE: 'guide/', ERIN: 'erin/', CAPTION: {}, HOME: {}, hooks: { on: {} },
      Date: FD, Promise: Promise, Math: Math, isFinite: isFinite, console: console,
      Audio: function () { this.pause = function () { this.paused = true; }; this.play = function () { clips.push(this.src + ':' + (c.session ? c.session.kind : c.practice ? c.practice.a.id : 'none')); this.paused = false; return Promise.resolve(); }; },
      setTimeout: function (f, ms) { var t = { f: f, ms: ms, live: true }; timers.push(t); return t; }, clearTimeout: function (t) { if (t) t.live = false; },
      $: node, hud: node('hud'), avatar: node('avatar'), meditator: node('meditator'), holo: node('holo'),
      refuseBusy: function () { return false; }, asleep: function () { return false; }, erin: function () { }, endMoment: function () { }, endTryOn: function () { },
      hideSheet: function () { c.current = null; }, closeSheet: function () { c.current = null; }, openSheet: function (id) { c.current = id; sheets.push(id); },
      setPose: function (p) { poses.push(p); }, restorePose: function () { poses.push('restore'); }, placeAvatar: function () { poses.push('home'); },
      setOrb: function (phase, text) { captions.push(text); }, caption: function (text) { captions.push(text); }, chime: function () { },
      hudClockStart: function () { c.clock = true; }, hudClockStop: function () { c.clock = false; },
      afterSave: function (ev) { saves.push(ev); }, toast: function (text) { toasts.push(text); }, esc: function (t) { return t; } };
    vm.createContext(c);
    ['emit', 'sessionCurrent', 'cancelRunner', 'playClip', 'wait', 'runSession', 'finishSession', 'stopSession', 'exitMeditation', 'stopEverything', 'practiceCurrent', 'playUrl', 'pwait', 'runPractice', 'askPracticeDone', 'practiceMs', 'stopPractice'].forEach(function (n) { vm.runInContext(fn(n), c); });
    vm.runInContext('hudOn = ' + hudFn(), c);
    return { c: c, w: w, timers: timers, clips: clips, captions: captions, poses: poses, saves: saves, sheets: sheets, toasts: toasts, node: node, advance: function (ms) { now += ms; }, call: function (code) { return vm.runInContext(code, c); } };
  }
  function flush() { var p = Promise.resolve(); for (var i = 0; i < 100; i++) p = p.then(function () { }); return p; }
  process.on('exit', function () { if (!finished) { console.error('  FAIL runner regression promises did not settle'); process.exitCode = 1; } });
  var s = env(); s.call('runSession("erin", 3)'); var old = s.c.session, ended = old.audio.onended, metadata = old.audio.onloadedmetadata;
  s.call('stopSession(false)'); s.call('runSession("breathe", 5)'); var replacement = s.c.session;
  ended(); metadata();
  flush().then(function () {
    check('a stopped Erin greeting settles without clips or captions entering the replacement breathing session', s.c.session === replacement && s.clips.length === 1 && !s.captions.some(function (t) { return t === 'Settling in' || t === 'Coming back'; }) && old.audio.paused && old.cancelWait === null, s.clips.join(' | '));
    var timer = replacement.timer, settled = false;
    s.call('wait(250, session)').then(function () { settled = true; }); s.call('stopSession(false)'); s.call('runSession("erin", 3)'); var newest = s.c.session;
    if (timer) timer.f();
    return flush().then(function () { check('cancelling a timed wait resolves it, clears its own timer, and an old timer cannot act on the next session', settled && !replacement.timer && s.c.session === newest && !s.clips.some(function (t) { return /meditation_begin/.test(t); })); });
  }).then(function () {
    var p = env(); p.call('runPractice("plants", 0)');
    return flush().then(function () {
      var oldP = p.c.practice, fin = oldP.audio.onended, meta = oldP.audio.onloadedmetadata;
      p.call('stopPractice()'); p.call('runPractice("teeth", 0)'); var nextP = p.c.practice; if (fin) fin(); if (meta) meta();
      return flush().then(function () {
        check('Everyday callbacks and captions belong to the originating practice, with the old audio and wait cancelled', p.c.practice === nextP && oldP.audio.paused && oldP.cancelWait === null && p.clips.length === 2 && p.clips[0].indexOf('plants-0-0') > -1 && p.clips[1].indexOf('teeth-0-0') > -1 && p.captions.length === 2, p.clips.join(' | '));
        var b = env(); b.call('runSession("erin", 3)'); var bedRun = b.c.session; b.advance(5000); var openingPaused = false; b.c.erinAudio = { pause: function () { openingPaused = true; } }; b.call('stopEverything()');
        check('bedtime stops the session audio and pending callbacks, saving nothing below a full minute', b.c.session === null && bedRun.audio.paused && openingPaused && bedRun.cancelWait === null && !b.timers.some(function (t) { return t.live; }) && b.w.OvuStore.list('mindfulness').length === 0 && !b.c.clock);
        var long = env(); long.call('runSession("erin", 3)'); var lr = long.c.session; long.advance(61000); long.call('stopEverything()');
        check('bedtime and Stop share the one-minute rule and stopped-session duration, with no delayed fade into night', long.c.session === null && lr.audio.paused && long.w.OvuStore.list('mindfulness').length === 1 && long.w.OvuStore.list('mindfulness')[0].data.minutes === 1 && !long.timers.some(function (t) { return t.live; }));
        var failed = env(); failed.call('runSession("erin", 3)'); var fr = failed.c.session; failed.advance(61000); failed.w.localStorage.setItem = function () { throw new Error('quota'); }; failed.call('stopEverything()');
        check('a bedtime save failure leaves no stopped session, live media timer or false completion behind', failed.c.session === null && fr.audio.paused && fr.cancelWait === null && !failed.timers.some(function (t) { return t.live; }) && !failed.w.OvuStore.list('mindfulness').length && !failed.saves.length && failed.toasts[0] === 'Your session could not be saved.');
        var owner = env(); owner.call('exitMeditation()'); var restore = owner.timers[owner.timers.length - 1], before = owner.poses.length; owner.call('hudOn(true, "Watering")'); restore.f();
        owner.c.meditating = true; owner.call('runSession("breathe", 1)'); owner.advance(61000); owner.call('finishSession(false)'); var fade = owner.timers[owner.timers.length - 1]; owner.call('hudOn(true, "Plant care")'); fade.f();
        check('old mat restoration and saved-session fades cannot change the avatar or hide a newer garden or greenhouse HUD', owner.poses.length === before && owner.c.hud.classList.contains('on'));
      });
    });
  }).then(function () {
    var p = env(); p.call('runPractice("plants", 0)');
    return flush().then(function () {
      p.advance(65000); p.call('stopPractice()'); var pending = p.c.practice, yes = p.node('#pdYes').events.click, storage = p.w.localStorage, original = storage.setItem, writes = 0;
      storage.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('quota'); return original.call(storage, k, v); };
      yes();
      var intact = p.c.practice === pending && p.c.current === 'practiceDone' && p.w.OvuStore.list('mindfulness').length === 0 && !p.w.OvuStore.state().explored;
      storage.setItem = function (k, v) { if (k === 'ovumind_db_v1') writes++; return original.call(storage, k, v); }; yes(); yes();
      var events = p.w.OvuStore.list('mindfulness');
      check('failed Everyday confirmation keeps the prompt and exact pending practice, with no event or explored count left in memory', intact && /could not be saved/.test(p.toasts[0] || ''), p.toasts.join(' | '));
      check('retry confirms the same practice once, committing its entry and exploration count in one database write', p.c.practice === null && p.c.current === null && events.length === 1 && p.w.OvuStore.state().explored.plants === 1 && events[0].data.confirmedReal && writes === 1 && p.saves.length === 1, JSON.stringify({ writes: writes, events: events.length }));
      var no = env(); no.call('runPractice("plants", 0)'); no.advance(65000); no.call('stopPractice()'); no.node('#pdNo').events.click();
      check('declining Everyday confirmation saves neither a journal entry nor an exploration completion', !no.w.OvuStore.list('mindfulness').length && !no.w.OvuStore.state().explored && no.c.practice === null);
    });
  }).then(function () { finished = true; }).catch(function (e) { check('runner regression chain completes', false, e.stack); finished = true; });
})();

(function erinOnEveryAction() {
  console.log('2k3c. Erin speaks for every action (Jamie, 22 Oct): one clip per action, each one on disk with its script');
  var rj = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), lines = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/erin-actions/lines.json'), 'utf8'));
  var ids = lines.map(function (l) { return l.id; }), m = /var MOMENT_ERIN = (\{[^}]*\});/.exec(rj), map = m ? (new Function('return ' + m[1]))() : {};
  var used = Object.keys(map).map(function (k) { return map[k]; }).concat(['brush-hen']);
  var src = fs.readdirSync(root).filter(function (f) { return /^ovu-.*\.js$/.test(f); }).map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }).join('\n') + rj;
  (src.match(/\.erin\('([a-z-]+)'\)/g) || []).forEach(function (x) { used.push(/'([a-z-]+)'/.exec(x)[1]); });
  var missing = used.filter(function (id) { return ids.indexOf(id) < 0 || !fs.existsSync(path.join(root, 'assets/audio/erin-actions', id + '.mp3')); });
  check('every Erin line the app plays has a script and an mp3', m && Object.keys(map).length > 40 && missing.length === 0, missing.join());
  check('every scripted line has its clip, and no script has an em dash', lines.every(function (l) { return fs.existsSync(path.join(root, 'assets/audio/erin-actions', l.id + '.mp3')) && l.text.indexOf('\u2014') < 0; }));
  check('moment() plays her line before any early return, and stays quiet while her guided practice speaks', /if \(!opt\.tries && !mindfulQuick\(\)\) erin\(/.test(rj) && /function erin\(id\) \{\n    if \(!id \|\| !erinCuesOn\(\) \|\| !soundOn\(\) \|\| asleep\(\) \|\| session \|\| practice \|\| meditating/.test(rj));
})();

(function scoresAndVillagers() {
  console.log('2k3d. cycle and circadian scores (Codex sol formulas, 22 Oct) and the villagers');
  var w = { console: console }; w.window = w; vm.createContext(w);
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-scores.js'), 'utf8'), w, { filename: 'ovu-scores.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-villagers.js'), 'utf8'), w, { filename: 'ovu-villagers.js' });
  var SC = w.OvuScores, V = w.OvuVillagers;
  function ep(start, len, pains) { var days = []; for (var k = 0; k < len; k++) { var d = new Date(start + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); days.push({ date: d.toISOString().slice(0, 10), pain: pains === undefined ? undefined : pains }); } return { start: start, end: days[days.length - 1].date, days: days }; }
  var eps = [ep('2026-06-01', 5, 2), ep('2026-06-29', 5, 2), ep('2026-07-27', 5, 2), ep('2026-08-24', 5, 2), ep('2026-09-21', 5, 2)];
  var c = SC.cycleScore(eps, '2026-10-22', '26-41');
  check('cycle: four 28-day cycles, 5-day periods, pain 2 of 10 give regularity, frequency and length 100 and comfort 80, so 94', c.parts.regularity === 100 && c.parts.frequency === 100 && c.parts.duration === 100 && c.parts.comfort === 80 && c.score === 94 && c.version === 'cycle-v1', JSON.stringify(c));
  var noPain = SC.cycleScore(eps.map(function (e) { return ep(e.start, 5); }), '2026-10-22', '26-41');
  check('cycle: no pain answers leave comfort and the total empty (never 0), and say what is needed', noPain.score === null && noPain.parts.comfort === null && noPain.need.join().indexOf('pain answer') > -1);
  var noAge = SC.cycleScore(eps, '2026-10-22', null);
  check('cycle: without an age band no regularity limit is invented, so no total', noAge.parts.regularity === null && noAge.score === null && noAge.need.join().indexOf('age range') > -1);
  check('cycle: two cycles are not enough', SC.cycleScore(eps.slice(0, 3), '2026-10-22', '26-41').score === null);
  var irregular = SC.cycleScore([ep('2026-05-01', 5, 0), ep('2026-05-23', 5, 0), ep('2026-07-01', 5, 0), ep('2026-07-25', 5, 0), ep('2026-09-02', 5, 0)], '2026-10-22', '26-41');
  check('cycle: cycles of 22, 39, 24 and 39 days (a 17-day spread, one of four within 24 to 38) score regularity 23 and frequency 25', irregular.parts.regularity === 23 && irregular.parts.frequency === 25, JSON.stringify(irregular.parts));
  var nights = []; for (var k = 0; k < 14; k++) { var d = new Date('2026-10-09T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); nights.push({ date: d.toISOString().slice(0, 10), bed: '23:00', wake: '07:00' }); }
  var sl = SC.sleepScore(nights, '2026-10-22');
  check('circadian: fourteen nights 23:00 to 07:00 give steady timing 100 and enough sleep 100', sl.score === 100 && sl.parts.timing === 100 && sl.parts.duration === 100 && sl.midSpread === 0, JSON.stringify(sl.parts));
  var short = SC.sleepScore(nights.map(function (n) { return { date: n.date, bed: '02:00', wake: '06:00' }; }), '2026-10-22');
  check('circadian: steady four-hour nights score 70, so length always shows beside the total', short.score === 70 && short.parts.duration === 0);
  check('circadian: seven nights are not enough (10, with 4 in each week)', SC.sleepScore(nights.slice(7), '2026-10-22').score === null);
  check('circadian: the circular spread treats 23:30 and 00:30 as an hour apart, not a day', Math.round(SC.circular([1410, 30]).sd) > 20 && Math.round(SC.circular([1410, 30]).sd) < 40);
  var t1 = V.talk({}, 'shen', '2026-10-22'), t2 = V.talk(t1.state, 'shen', '2026-10-22');
  check('villagers: talking adds 3 points once a day; a second talk adds nothing', t1.gained === 3 && t2.gained === 0 && V.stateOf({ villagers: t2.state }, 'shen').points === 3);
  var g1 = V.gift(t2.state, 'shen', '2026-10-22', 'pandanrice', 'dish'), g2 = V.gift(g1.state, 'shen', '2026-10-22', 'egg', 'pantry');
  check('villagers: one gift a day; a loved dish is worth 8', g1.ok && g1.loved && g1.gained === 8 && !g2.ok);
  var st = {}; for (var day = 1; day <= 12; day++) { var dd = '2026-11-' + String(day).padStart(2, '0'); st = V.talk(st, 'lu', dd).state; st = V.gift(st, 'lu', dd, 'tomatoegg', 'dish').state; }
  var lu = V.stateOf({ villagers: st }, 'lu');
  check('villagers: hearts reach 10 at 100 points and the first heart scene waits to be seen', V.hearts(lu.points) === 10 && V.nextEvent(lu) === 2 && !V.canPropose(lu, true));
  lu.seen = [2, 4, 6, 8, 10];
  check('villagers: a proposal needs every scene, a red heart and a home of her own', V.canPropose(lu, true) && !V.canPropose(lu, false) && V.colour(10)[0] === 'Red' && V.colour(0)[0] === 'Black');
  check('villagers: original characters, no real names; game state only, no diary writes', V.VILLAGERS.map(function (v) { return v.name; }).join() === 'Shen Yuan,Lu Chen' && !/S\.add\(|OvuStore\.add\(/.test(fs.readFileSync(path.join(root, 'ovu-villagers.js'), 'utf8')));
})();

(function villagerTalks() {
  console.log('2k3e. villagers at her height on open floor, and Harvest Moon talks (22 Oct): a greeting that knows the day, a topic a day, gifts named, never upset');
  var w = scenes('2026-10-22'), K = w.OvuWalk, C = w.OvuCommunity, src = fs.readFileSync(path.join(root, 'ovu-villagers.js'), 'utf8');
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-friends.js'), 'utf8'), w, { filename: 'ovu-friends.js' });
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js', 'ovu-villagers.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var V = w.OvuVillagers, F = w.OvuFriends, LAY = { plaza: w.LAYOUTS.plaza, harbour: w.OvuHarbour.LAYOUT };
  /* the people and pets who stand in each scene: the sample neighbours, the friends' eight places, the neighbours' pets */
  var others = { plaza: C.NEIGHBOURS.map(function (n) { return { id: n.id, x: n.spot.x, y: n.spot.y, w: 11 }; }).concat(C.NEIGHBOURS.map(function (n) { return { id: n.id + '-pet', x: n.petSpot.x, y: n.petSpot.y, w: n.pet.w }; })).concat(F.SPOTS.map(function (p, i) { return { id: 'friend' + i, x: p.x, y: p.y, w: 11 }; })), harbour: [] };
  V.VILLAGERS.forEach(function (v) {
    var L = LAY[v.scene], box = V.blockOf(v), bad = [];
    var around = K.world(L, others[v.scene]), withMe = K.world(Object.assign({}, L, { solids: L.solids.concat([box]) }), others[v.scene]);
    if (box.x1 - box.x0 > 6 || box.y1 - box.y0 > 4 || !K.inBox(box, v.spot.x, v.spot.y)) bad.push('his block is not a small box at his feet');
    if (!K.inZones(L.zones, v.spot.x, v.spot.y) || K.blocked(around.solids, v.spot.x, v.spot.y)) bad.push('feet not on open floor');
    var points = L.hotspots.map(function (h) { return [h.id, h.wp]; }).concat(L.doors.map(function (d) { return [d.id + ' door', d]; })).concat([['home', L.home]]).concat(others[v.scene].map(function (o) { return [o.id, o]; }));
    points.forEach(function (p) { if (K.inBox(box, p[1].x, p[1].y)) bad.push(p[0] + ' inside his box'); });
    if (!K.inZones(L.zones, v.talkAt.x, v.talkAt.y) || K.blocked(withMe.solids, v.talkAt.x, v.talkAt.y)) bad.push('her talk spot is not free');
    if (v.talkAt.x >= v.spot.x || v.talkAt.flip) bad.push('she does not stand beside him facing him');
    L.doors.forEach(function (d) { if (!K.plan(withMe, { x: d.x, y: d.y }, v.talkAt, 2)) bad.push('no walk from ' + d.id); });
    L.hotspots.forEach(function (h) { if (!K.plan(withMe, v.talkAt, h.wp, 2)) bad.push('he blocks the walk to ' + h.id); });
    check(v.name + ': feet on open floor in the ' + v.scene + ', clear of every stand point, door and person; she can walk to him and on to every hotspot', bad.length === 0, bad.join('; '));
  });
  var wsrc = fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8');
  check('each villager is his own button (not a neighbour .nb a friends redraw clears), drawn at her width times his canvas factor, clipped to his traced outline, ranked with her by his feet and not a solid (his block is in the layout, added once)', /el\.style\.width = \(\(L\.avatarW \|\| 12\) \* \(v\.wk \|\| 1\)\)/.test(src) && /style\.clipPath = 'polygon\(' \+ v\.outline \+ '\)'/.test(src) && /el\.className = 'villager';/.test(src) && V.VILLAGERS.every(function (v) { return v.outline.split(',').length >= 20 && /^[0-9. %,]+$/.test(v.outline); }) && /\.villager\{[^}]*pointer-events:none/.test(css) && /\.villager img\{[^}]*pointer-events:auto/.test(css) && /#ownedProps \.villager, #plateOcc/.test(wsrc) && /!el\.classList\.contains\('villager'\)/.test(wsrc) && /if \(L\.solids && !L\.solids\.some\(function \(b\) \{ return b\.id === 'villager-' \+ v\.id; \}\)\) L\.solids\.push\(blockOf\(v\)\)/.test(src) && /closest\('\.hotspot,\.nb,\.prop\.owned[^']*,\.villager'/.test(fs.readFileSync(path.join(root, 'ovu-camera.js'), 'utf8')));
  var looks = F.LOOKS.map(function (l) { return l[0]; }).concat(C.NEIGHBOURS.map(function (n) { return n.outfit; })), csrc = fs.readFileSync(path.join(root, 'ovu-community.js'), 'utf8');
  check('every neighbour and friend look has its traced outline, and a neighbour\'s picture (on the plaza and on a visit) is clipped to it with only the picture taking a tap, so her empty canvas and name tag never hide Shen', looks.every(function (l) { return C.OUTLINE[l] && C.OUTLINE[l].split(',').length >= 20 && /^[0-9. %,]+$/.test(C.OUTLINE[l]); }) && (csrc.match(/clipTo\(el\.querySelector\('img'\), (n|visit)\.outfit\)/g) || []).length === 2 && /\.nbperson\{pointer-events:none;cursor:pointer\}\.nbperson img\{pointer-events:auto\}/.test(css));
  check('nobody floats: a villager stands like her, his canvas bottom on the floor line (translate -100%), with her soft contact shadow at his feet sized to her footprint on any canvas width, and no offset drop shadow', /\.villager\{position:absolute;transform:translate\(-50%,-100%\)[^}]*filter:drop-shadow\(0 1px 2px rgba\(70,40,100,\.2\)\)/.test(css) && /\.avatar::before,[^{]*\.villager::before\{/.test(css) && /\.villager\{--cs:\.62\}/.test(css) && /\.avatar\{position:absolute;[^}]*transform:translate\(-50%,-100%\)/.test(css) && /setProperty\('--cs', \(0\.62 \/ \(v\.wk \|\| 1\)\)/.test(src));
  check('a friends redraw (no props event) ranks the new neighbours with her and Shen; a cutout is ranked by its centre, not its left edge', /renderNeighbours\(\) \{[\s\S]*?if \(root\.OvuWalk && root\.OvuWalk\.sortDepth\) root\.OvuWalk\.sortDepth\(\);[^\n]*\n  \}/.test(csrc) && /cx: occ \? x \+ w \/ 2 : x/.test(wsrc) && /return \{ y: p\.y, x: p\.cx, w: p\.w \}/.test(wsrc));
  /* the plaza's crowd: four neighbours, their pets, Shen and her (Codex, 22 Oct: Shen at 54.5 and her at 54.4 both had z 2) */
  var crowd = C.NEIGHBOURS.map(function (n) { return { y: n.spot.y, x: n.spot.x, w: 11 }; }).concat(C.NEIGHBOURS.map(function (n) { return { y: n.petSpot.y, x: n.petSpot.x, w: n.pet.w }; })).concat([{ y: 52.6, x: 40, w: 12 }]);
  var zBehind = K.depthRank(crowd.concat([{ y: 52.5 }])), zFront = K.depthRank(crowd.concat([{ y: 52.7 }])), sh = crowd.length, her = crowd.length;
  var meiZ = zFront[0], shenZ = zFront[sh - 1];
  check('in the plaza crowd she and Shen never share a level: just behind him he is in front, just in front she is, and Mei (in front of him) stays in front', zBehind[sh - 1] > zBehind[her] && zFront[her] > zFront[sh - 1] && meiZ > shenZ && Math.max.apply(null, zFront) <= 9 && Math.min.apply(null, zFront) >= 2, JSON.stringify({ behind: zBehind, front: zFront }));
  var apart = K.depthRank(new Array(12).fill(0).map(function (_, i) { return { y: 50 + i, x: (i % 2) * 60 + 10, w: 10 }; }));
  check('sprites that do not overlap across share levels, so twelve on two sides of the plate still each sit in front of the one behind on their side', apart.every(function (z, i) { return i < 2 || z > apart[i - 2]; }), apart.join());
  /* the talk data */
  var shape = [];
  V.VILLAGERS.forEach(function (v) {
    V.PARTS.forEach(function (p) { if (!(v.open[p] && v.open[p].length === 2)) shape.push(v.id + ' open ' + p); });
    if (v.body.length !== 5 || v.body.some(function (b) { return b.length < 2; })) shape.push(v.id + ' body');
    ['spring', 'summer', 'autumn', 'winter'].forEach(function (s) { if (!v.season[s]) shape.push(v.id + ' season ' + s); });
    var ids = v.topics.map(function (t) { return t.id; }), mins = v.topics.map(function (t) { return t.min; });
    if (v.topics.length < 6 || ids.some(function (x, i) { return ids.indexOf(x) !== i; })) shape.push(v.id + ' topics');
    if (mins.filter(function (m) { return m === 0; }).length < 2 || mins.some(function (m, i) { return m < 0 || m > 10 || (i && m < mins[i - 1]); })) shape.push(v.id + ' topic hearts');
    v.topics.forEach(function (t) { var rs = t.replies.map(function (r) { return r.id; }); if (t.replies.length < 2 || t.replies.length > 3 || rs.some(function (x, i) { return rs.indexOf(x) !== i; }) || t.replies.some(function (r) { return !r.say || !r.back; }) || !t.ask) shape.push(v.id + ' ' + t.id); });
    ['loved', 'liked', 'dish', 'other'].forEach(function (k) { if (!(v.gifts[k].length >= 2 && v.gifts[k].every(function (g) { return /\{gift\}|\{Gift\}/.test(g); }))) shape.push(v.id + ' gifts ' + k); });
  });
  check('every villager has two openings for each part of the day, five friendship tiers, four seasons, at least six topics opening from 0 to 10 hearts with two or three replies each, and gift lines that name the gift', shape.length === 0, shape.join('; '));
  var shen = V.byId('shen'), lu = V.byId('lu'), d = '2026-10-22';
  var g0 = V.greeting(shen, { points: 0, part: 'morning', season: 'autumn', day: d }), g0b = V.greeting(shen, { points: 0, part: 'morning', season: 'autumn', day: d });
  var gNight = V.greeting(shen, { points: 0, part: 'night', season: 'autumn', day: d }), gClose = V.greeting(shen, { points: 85, part: 'morning', season: 'autumn', day: d }), gWed = V.greeting(shen, { points: 100, engaged: true, part: 'morning', season: 'winter', day: d });
  check('the greeting knows the part of the day, the season and her friendship, and holds all day', g0 === g0b && g0 !== gNight && g0 !== gClose && gClose !== gWed && g0.indexOf(shen.season.autumn) > -1 && gWed.indexOf(shen.season.winter) > -1 && gNight.indexOf(shen.open.night[0]) === 0 && gClose.indexOf(shen.open.morning[1]) === 0 && shen.body[3].some(function (b) { return gClose.indexOf(b) > -1; }) && shen.body[4].some(function (b) { return gWed.indexOf(b) > -1; }));
  check('the part of the day follows the sky (sunrise and morning, afternoon, sunset, night) or an hour', V.partOfDay('sunrise') === 'morning' && V.partOfDay('morning') === 'morning' && V.partOfDay('afternoon') === 'afternoon' && V.partOfDay('sunset') === 'evening' && V.partOfDay('night') === 'night' && V.partOfDay(9) === 'morning' && V.partOfDay(15) === 'afternoon' && V.partOfDay(18) === 'evening' && V.partOfDay(23) === 'night' && V.partOfDay(2) === 'night' && V.partOfDay(null) === 'morning');
  check('friendship tiers: new under 2 hearts, friendly to 4, close to 7, very close from 8, and engaged', V.tier(0) === 0 && V.tier(19) === 0 && V.tier(20) === 1 && V.tier(49) === 1 && V.tier(50) === 2 && V.tier(79) === 2 && V.tier(80) === 3 && V.tier(100) === 3 && V.tier(10, true) === 4);
  /* topics: the first open one she has not heard, then the next; locked ones never offered */
  var s0 = V.stateOf({}, 'shen'), t0 = V.topicFor(shen, s0, d);
  var a1 = V.answer({}, 'shen', d, t0.id, t0.replies[0].id), s1 = V.stateOf({ villagers: a1.state }, 'shen');
  var t1 = V.topicFor(shen, s1, '2026-10-23');
  check('a first talk is the first topic; answering adds 3 points, remembers her reply for the day and opens the next topic tomorrow', t0.id === shen.topics[0].id && a1.ok && a1.gained === 3 && s1.points === 3 && s1.talked === d && s1.chat.topic === t0.id && s1.chat.reply === t0.replies[0].id && s1.heard.join() === t0.id && V.topicFor(shen, s1, d).id === t0.id && t1.id === shen.topics[1].id && a1.line === t0.replies[0].back && V.chatOf(shen, s1, d).reply.id === t0.replies[0].id && V.chatOf(shen, s1, '2026-10-23') === null);
  var again = V.answer(a1.state, 'shen', d, t0.id, t0.replies[1].id), other = V.answer(a1.state, 'shen', d, t1.id, t1.replies[0].id), back = V.answer(a1.state, 'shen', '2026-10-21', t1.id, t1.replies[0].id), locked = V.answer({}, 'shen', d, 'years', 'here'), noReply = V.answer({}, 'shen', d, 'tea', 'nope'), nobody = V.answer({}, 'ghost', d, 'tea', 'plain'), notToday = V.answer({}, 'shen', d, 'stories', 'cosy');
  check('talking counts once a day: once answered, any second reply (another tab, a double tap) returns the first exchange unchanged with no points', again.ok && again.already && again.gained === 0 && again.reply.id === t0.replies[0].id && JSON.stringify(again.state) === JSON.stringify(a1.state) && other.ok && other.already && other.reply.id === t0.replies[0].id);
  check('a clock set back, a topic that is not today\'s (locked or another open one), an unknown reply or villager change nothing', !back.ok && back.why === 'clock' && !locked.ok && locked.why === 'topic' && !notToday.ok && notToday.why === 'topic' && !noReply.ok && noReply.why === 'reply' && !nobody.ok);
  /* the day's topic is pinned when she taps Talk: a gift that opens a new topic before she answers never swaps it */
  var heardTwo = { shen: { points: 19, heard: ['tea', 'stories'] } }, o1 = V.offer(heardTwo, 'shen', d), tPinned = o1.topic.id;
  var afterGift = V.gift(o1.state, 'shen', d, 'pandanrice', 'dish', 'Pandan rice').state, o2 = V.offer(afterGift, 'shen', d);
  var unpinnedWouldBe = V.topicFor(shen, V.stateOf({ villagers: { shen: { points: 27, heard: ['tea', 'stories'] } } }, 'shen'), d).id;
  var aPinned = V.answer(afterGift, 'shen', d, tPinned, shen.topics.filter(function (t) { return t.id === tPinned; })[0].replies[0].id);
  check('Talk pins today\'s topic before she answers: offering again is unchanged, a gift that opens a new topic does not swap it, and the pinned one is the one she can answer', o1.ok && !o1.already && o1.state.shen.chat.reply === null && o2.ok && o2.already && o2.topic.id === tPinned && unpinnedWouldBe === 'rain' && tPinned !== 'rain' && aPinned.ok && aPinned.gained === 3 && V.answer(afterGift, 'shen', d, 'rain', 'love').why === 'topic');
  var legacy = V.answer({ shen: { points: 30, talked: d } }, 'shen', d, 'tea', 'plain');
  check('an older save that already counted today\'s talk (talked, no exchange) can still have the exchange, for no more points', legacy.ok && legacy.gained === 0 && legacy.state.shen.points === 30 && legacy.state.shen.chat.reply === 'plain');
  var anyAll = true;
  V.VILLAGERS.forEach(function (v) { v.topics.forEach(function (t) { t.replies.forEach(function (r) { var st0 = {}; st0[v.id] = { points: 100, chat: { day: d, topic: t.id, reply: null } }; var x = V.answer(st0, v.id, d, t.id, r.id); if (!x.ok || x.gained !== 3 || x.line !== r.back) anyAll = false; }); }); });
  check('there is no wrong answer: every reply to every topic is worth the same 3 points and gets its own answer', anyAll);
  var opened = function (p) { return V.unlocked(shen, p).map(function (t) { return t.id; }); };
  check('topics open as the hearts grow: two at the start, all of them at 8 hearts, and a locked topic is never today\'s', opened(0).length === 2 && opened(80).length === shen.topics.length && opened(0).indexOf('years') < 0 && V.topicFor(shen, V.stateOf({ villagers: { shen: { points: 0, heard: ['tea', 'stories'] } } }, 'shen'), d).min === 0);
  var heardAll = { lu: { points: 100, heard: lu.topics.map(function (t) { return t.id; }) } }, sA = V.stateOf({ villagers: heardAll }, 'lu'), r1 = V.topicFor(lu, sA, d), r2 = V.topicFor(lu, sA, d), seenDays = {};
  for (var k = 0; k < 16; k++) { var dd = new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10); seenDays[V.topicFor(lu, sA, dd).id] = 1; }
  check('once she has heard them all, the topic turns with the day and holds all day', r1.id === r2.id && Object.keys(seenDays).length === lu.topics.length);
  /* friendship never goes down, whatever the order */
  /* a fixed schedule: each op for each villager in turn, the day moving on every eighth step and set back by three days
   * every 29th, so set-backs, repeats on one day and new days all happen; points must never go down */
  var st = {}, last = { shen: 0, lu: 0 }, down = false, ran = {};
  for (var i = 0; i < 400; i++) {
    var who = Math.floor(i / 4) % 2 ? 'lu' : 'shen', vv = V.byId(who), op = i % 4, back = i % 29 === 28 ? 3 : 0, day = new Date(Date.UTC(2026, 9, 1 + Math.floor(i / 8) - back)).toISOString().slice(0, 10), r;
    if (op === 0) r = V.talk(st, who, day); else if (op === 1) r = V.gift(st, who, day, vv.loves[i % 3], 'dish', 'Something'); else if (op === 2) r = V.offer(st, who, day); else { var tt = V.topicFor(vv, V.stateOf({ villagers: st }, who), day); r = V.answer(st, who, day, tt.id, tt.replies[i % tt.replies.length].id); }
    if (r && r.ok) { st = r.state; ran[who + op] = (ran[who + op] || 0) + 1; }
    ['shen', 'lu'].forEach(function (x) { var p = V.stateOf({ villagers: st }, x).points; if (p < last[x]) down = true; last[x] = p; });
  }
  check('friendship never goes down: 400 talks, offers, answers and gifts in a fixed order, with days repeated and the clock set back, never lower the points (every operation ran for both villagers)', !down && last.shen > 0 && last.lu > 0 && ['shen', 'lu'].every(function (x) { return [0, 1, 2, 3].every(function (o) { return ran[x + o] >= 10; }); }), JSON.stringify(ran));
  /* every change keeps the rest: today's exchange survives a gift, a heart scene, the proposal's engagement and a reload */
  var seqSt = V.answer({}, 'lu', d, 'sea', 'shore').state; seqSt = V.gift(seqSt, 'lu', d, 'egg', 'pantry', 'Egg').state;
  var ls = V.stateOf({ villagers: seqSt }, 'lu'); ls.seen.push(2); seqSt.lu = ls; seqSt.lu = Object.assign({}, V.stateOf({ villagers: seqSt }, 'lu'), { engaged: true });
  var reload = V.stateOf({ villagers: JSON.parse(JSON.stringify(seqSt)) }, 'lu');
  check('answer, gift, a heart scene and the engagement keep each other: the exchange, the heard topic, the gift and the scene all survive a reload', reload.chat.reply === 'shore' && reload.heard.join() === 'sea' && reload.gave.key === 'egg' && reload.seen.join() === '2' && reload.engaged && reload.points === 8 && V.chatOf(lu, reload, d).reply.back === lu.topics[0].replies[1].back);
  /* old and edited saves */
  var dirty = V.stateOf({ villagers: { shen: { points: '42', talked: d, chat: { day: d, topic: 'nope', reply: 'x' }, heard: ['tea', 'tea', 'ghost', 5], gave: { day: d, key: {}, kind: 'dish' }, seen: [2, 3], extra: 1 } } }, 'shen');
  var wrongReply = V.stateOf({ villagers: { shen: { chat: { day: d, topic: 'tea', reply: 'cosy' } } } }, 'shen'), offered = V.stateOf({ villagers: { shen: { chat: { day: d, topic: 'tea', reply: null } } } }, 'shen');
  check('a saved reply must belong to its saved topic; an offered topic keeps its null reply and is not a talk yet', wrongReply.chat === null && offered.chat.topic === 'tea' && offered.chat.reply === null && V.chatOf(shen, offered, d) === null);
  var kept = V.talk({ shen: { points: 10, chat: { day: d, topic: 'tea', reply: 'honey' }, heard: ['tea'] } }, 'shen', '2026-10-23').state.shen;
  check('an old or edited save is cleaned: unknown topics, replies, heard ids and gifts drop; a talk keeps what was heard', dirty.points === 42 && dirty.chat === null && dirty.heard.join() === 'tea' && dirty.gave === null && dirty.seen.join() === '2' && !('extra' in dirty) && kept.heard.join() === 'tea' && kept.chat.topic === 'tea' && kept.points === 13);
  /* gifts name the gift */
  var gl = V.gift({}, 'shen', d, 'pandanrice', 'dish', 'Pandan rice'), gs = V.stateOf({ villagers: gl.state }, 'shen');
  var named = [['shen', 'Pandan rice', 'pandanrice', 'dish'], ['shen', 'Milk', 'milk', 'pantry'], ['shen', 'Garlic pak choy', 'garlicpakchoy', 'dish'], ['shen', 'Chilli padi', 'chilli', 'crop'], ['lu', 'Tomato and egg', 'tomatoegg', 'dish'], ['lu', 'Egg', 'egg', 'pantry'], ['lu', 'Pumpkin soup', 'pumpkinsoup', 'dish'], ['lu', 'Lemongrass', 'lemongrass', 'crop']].every(function (x) {
    return [d, '2026-10-23'].every(function (day) { var line = V.giftLine(V.byId(x[0]), x[1], x[2], x[3], 0, day); return line.toLowerCase().indexOf(x[1].toLowerCase()) > -1 && !/\{/.test(line); });
  });
  check('his thanks names the gift (loved, liked, another dish, anything else) and is remembered for the day; very close, he adds a warm line', named && gl.ok && gl.loved && gl.line.indexOf('Pandan rice') === 0 && gs.gave.name === 'Pandan rice' && gs.gifted === d && V.giftLine(shen, 'Milk', 'milk', 'pantry', 90, d).indexOf(shen.gifts.close) > 0 && V.giftLine(shen, 'Milk', 'milk', 'pantry', 10, d).indexOf(shen.gifts.close) < 0);
  /* the words */
  var words = [];
  V.VILLAGERS.forEach(function (v) {
    words.push(v.name, v.role); V.PARTS.forEach(function (p) { words = words.concat(v.open[p]); }); v.body.forEach(function (b) { words = words.concat(b); });
    Object.keys(v.season).forEach(function (s) { words.push(v.season[s]); }); v.topics.forEach(function (t) { words.push(t.ask); t.replies.forEach(function (r) { words.push(r.say, r.back); }); });
    Object.keys(v.gifts).forEach(function (g) { words = words.concat(v.gifts[g]); }); Object.keys(v.events).forEach(function (e) { words = words.concat(v.events[e]); });
  });
  var wrong = words.filter(function (t) { return /—|–|\p{Extended_Pictographic}|\p{Regional_Indicator}|995/u.test(t) || /\b(upset|angry|cross with you|disappointed|annoyed|hate|sulk|jealous|ignored|lonely without)\b/i.test(t) || /\b(period|cycle|diary|symptom|pain|weight|calorie|diet|ovulat|pregnan|fertil|hormone|mood|sleep|health|AI|GPT|Claude|Doubao)\b/i.test(t); });
  check('every villager line is warm and original: no em or en dashes, no emoji, no emergency numbers, nobody upset, nothing about her health, cycle or diary, no model names', words.length > 150 && wrong.length === 0, wrong.join(' | '));
  check('the villagers read only game state and the clock: no diary reads or writes, no hearts paid, the feather is the only spend', !/S\.add\(|OvuStore\.add\(|addMany\(|\.entries\(|S\.list\(|\.award\(|\.grant\(/.test(src) && (src.match(/RW\.spend\(/g) || []).length === 1 && /RW\.spend\(FEATHER/.test(src));
  var scenesSrc = src.split('/* ---------- the scenes (browser) ---------- */')[1] || '';
  check('every villager write (Talk, a reply, a gift, a heart scene, the proposal) runs inside the farm lock and only while its sheet is still the one open', (scenesSrc.match(/locked\(function \(\) \{\n\s*if \(!stillOpen\(/g) || []).length === 5 && (scenesSrc.match(/save\(\{ villagers/g) || []).length === 4 && !/S\.setState\(\{ villagers|S\.commit\(\{ villagers/.test(scenesSrc));
  check('a tap walks her to his side only by a route the walk engine found, and a walk overtaken by travel, another tap or an activity opens nothing', /W\.canWalkTo\(v\.talkAt\)\) R\.walkTo\(v\.talkAt, go\); else go\(\)/.test(scenesSrc) && /tok !== tapTok \|\| R\.layout\(\) !== L/.test(scenesSrc) && /R\.on\('activity', function \(\) \{ tapTok\+\+; \}\)/.test(scenesSrc) && /W\.canWalkTo = function \(wp\)/.test(wsrc));
  check('straight after a reply or a gift his answer shows first, with Continue to a heart scene that came due', /openVillager\(v\.id, \{ hold: true, say: true \}\)/.test(scenesSrc) && /openVillager\(id, \{ hold: true, say: true \}\)/.test(scenesSrc) && /if \(ev && !o\.hold\) \{ playEvent/.test(scenesSrc) && /data-v="scene"/.test(scenesSrc));
})();

(function barnAndSpring() {
  console.log('2k3. the barn, the hens, Clover and the hidden spring (Jamie, 20-21 Oct): no needs, no guilt, nothing that refills energy');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-stamina.js'), 'utf8'), w, { filename: 'ovu-stamina.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-barn.js'), 'utf8'), w, { filename: 'ovu-barn.js' });
  var F = w.OvuFarm, B = w.OvuBarn, S = w.OvuStore, K = w.OvuWalk, d1 = '2026-10-21', d2 = '2026-10-22';
  check('both hens have an egg and Clover has milk on a first visit', B.eggsReady(S, d1).join() === 'mochi,kaya' && B.milkReady(S, d1));
  var c1 = B.collectEggs(S, d1);
  check('collecting takes both eggs into the pantry in one go; the nests rest for the rest of the day', c1.ok && c1.n === 2 && F.farmState(S).pantry.egg === 2 && B.eggsReady(S, d1).length === 0 && !B.collectEggs(S, d1).ok);
  check('a clock set back gives nothing twice', B.eggsReady(S, '2026-10-20').length === 0 && !B.milkReady(S, d1) === false);
  var m1 = B.milk(S, d1);
  check('Clover gives one pail a day; a second milking that day is refused', m1.ok && F.farmState(S).pantry.milk === 1 && !B.milk(S, d1).ok && !B.milkReady(S, d1));
  check('a later day has one egg per hen and one pail: nothing stacks up while she is away', B.eggsReady(S, '2026-10-30').length === 2 && B.milkReady(S, '2026-10-30'));
  var e0 = S.state().stamina;
  var ok = B.collectEggs(S, d2, w.OvuStamina);
  check('collecting with the energy module charges the visit in the same save as the eggs', ok.ok && ok.charged && F.farmState(S).pantry.egg === 4);
  F.fillCan && F.fillCan(S);
  check('farm actions keep the barn’s pantry, animals and places (one canonical farm)', F.farmState(S).pantry.egg === 4 && F.farmState(S).animals.mochi === d2 && F.farmState(S).animals.clover === d1);
  var stam = JSON.stringify(S.state().stamina), hearts = JSON.stringify(S.state().rewards || null), diary = S.list().length;
  var ck = B.cookEggs(S);
  check('onsen eggs: up to four eggs become onsen eggs in one save', ck.ok && ck.n === 4 && F.farmState(S).pantry.egg === 0 && F.farmState(S).pantry.onsenegg === 4);
  check('the spring changes no energy, no hearts and no diary', JSON.stringify(S.state().stamina) === stam && JSON.stringify(S.state().rewards || null) === hearts && S.list().length === diary);
  check('with no eggs the basket says so and changes nothing', !B.cookEggs(S).ok && F.farmState(S).pantry.onsenegg === 4);
  var src = fs.readFileSync(path.join(root, 'ovu-barn.js'), 'utf8');
  check('no energy is ever added in the barn or the spring', !/refill\(|\.v\s*\+=|spend\([^)]*-\s*\d|OvuStamina\.refill/.test(src) && src.indexOf("'egg'") > -1 && w.OvuStamina.COSTS.egg === 1 && w.OvuStamina.COSTS.milk === 2);
  var bad = {}; S.setState({ farm: { pantry: { egg: -3, milk: 1.7, onsenegg: 'x' }, animals: { mochi: 'not a date', bogus: '2026-01-01' }, found: { cave: 5 } } });
  var fs2 = F.farmState(S);
  check('restored farm values are cleaned: whole non-negative counts, dates only; any animal id keeps a valid date (ranch animals, 22 Oct)', fs2.pantry.egg === 0 && fs2.pantry.milk === 1 && fs2.pantry.onsenegg === 0 && !fs2.animals.mochi && (!('bogus' in fs2.animals) || /^\d{4}-\d{2}-\d{2}$/.test(fs2.animals.bogus)) && !fs2.found.cave);
  S.setState({ farm: { pantry: { egg: 99 } } });
  check('a full pantry takes no more eggs and changes nothing', !B.collectEggs(S, d1).ok && F.farmState(S).pantry.egg === 99 && B.eggsReady(S, d1).length === 2);
  S.setState({ farm: null });
  check('the cave is not found at first; finding it once is remembered and finding it again changes nothing', !B.caveFound(S) && B.findCave(S, d1).first && B.caveFound(S) && B.findCave(S, d2).first === false && F.farmState(S).found.cave === d1);
  /* the four scenes: every stand point and door on the floor, and reachable from every entrance */
  [B.LAYOUT, B.BARN_IN, B.HEN_IN, B.CAVE].forEach(function (L) {
    var withCrack = L === B.LAYOUT ? Object.assign({}, L, { doors: L.doors.concat([B.CRACK_DOOR]) }) : L;
    var bad = K.checkLayout(withCrack);
    check(L.id + ': home, stand points and doors are on the floor and outside every solid', bad.length === 0, JSON.stringify(bad));
    var wd = K.world(withCrack, []), starts = withCrack.doors.map(function (x) { return { x: x.x, y: x.y }; });
    var targets = withCrack.hotspots.map(function (h) { return h.wp; }).concat(starts);
    var miss = []; starts.forEach(function (a) { targets.forEach(function (t) { if (!(Math.abs(a.x - t.x) < 0.01 && Math.abs(a.y - t.y) < 0.01) && !K.plan(wd, a, t, 2)) miss.push([a.x, a.y, t.x, t.y].join(',')); }); });
    check(L.id + ': the planner reaches every stand point and door from every entrance', miss.length === 0, miss.join(' | '));
  });
  check('the cave has no way in until it is found: the yard has no crack door in its data', B.LAYOUT.doors.every(function (x) { return x.id !== 'crack'; }));
  var M = fs.readFileSync(path.join(root, 'ovu-moments.js'), 'utf8');
  check('the barn and spring moments describe what is on screen and ask nothing', ['eggs', 'milk', 'brush', 'springlower', 'springsteam', 'springlift', 'springsit'].every(function (k) { return M.indexOf(k + ': {') > -1; }) && !/Notice its warmth|rhythm of your hands/.test(M));
  (function () { /* treats from the basket (21 Oct): the harvest has somewhere to go, and it is only a treat */
    var f0 = F.farmState(S); f0.harvest = { carrot: 2, kangkong: 1 }; S.setState({ farm: f0 });
    check('treats on offer come from the basket, and only what each animal eats', B.treatOptions(S, 'clover').join() === 'carrot' && B.treatOptions(S, 'hens').join() === 'kangkong');
    var e0 = w.OvuStamina.value(), r = B.giveTreat(S, 'clover', 'carrot', d1);
    check('a treat takes one from the basket, marks the day for that animal only, and costs no energy', r.ok && F.farmState(S).harvest.carrot === 1 && B.treatedToday(S, 'clover', d1) && !B.treatedToday(S, 'hens', d1) && w.OvuStamina.value() === e0);
    check('a crop the animal does not eat, or one with none left, is refused and changes nothing', !B.giveTreat(S, 'clover', 'kangkong', d1).ok && !B.giveTreat(S, 'hens', 'strawberry', d1).ok && F.farmState(S).harvest.carrot === 1 && F.farmState(S).harvest.kangkong === 1);
    B.giveTreat(S, 'hens', 'kangkong', d1);
    check('the last of a crop leaves the basket row behind, and the pantry and animals are untouched', F.farmState(S).harvest.kangkong === undefined && B.treatedToday(S, 'hens', d1) && F.farmState(S).pantry.egg === 0 && B.eggsReady(S, d1).length === 2);
  })();
})();

(function harbour() {
  console.log('2k4. the harbour (21 Oct): catch and release, no hearts, no clocks; fish that suit a spot and a time of day');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var H = w.OvuHarbour, F = w.OvuFarm, S = w.OvuStore, K = w.OvuWalk, ST = w.OvuStamina, d1 = '2026-10-21';
  var HS = fs.readFileSync(path.join(root, 'ovu-harbour.js'), 'utf8');
  check('six Singapore species, each with a spot, a time, a local name, a fact and a picture, and no citation', H.SPECIES.length === 6 && H.SPECIES.every(function (s) { return s.spots.length && /^(any|day|night)$/.test(s.time) && s.local && s.fact.length > 20 && !s.source && !s.url && s.img; }));
  check('every spot offers kinds by day and after dark; the squid comes to the jetty only after dark', ['jetty', 'rocks'].every(function (sp) { return H.candidates(sp, 'day').length >= 3 && H.candidates(sp, 'night').length >= 2; }) && H.candidates('jetty', 'night').some(function (s) { return s.id === 'squid'; }) && !H.candidates('jetty', 'day').some(function (s) { return s.id === 'squid'; }) && !H.candidates('rocks', 'night').some(function (s) { return s.id === 'squid'; }));
  check('the pick is even and bounded: 0 gives the first candidate, 0.999 the last, a bad number the first', H.pick('jetty', 'day', 0).id === H.candidates('jetty', 'day')[0].id && H.pick('jetty', 'day', 0.999).id === H.candidates('jetty', 'day').slice(-1)[0].id && H.pick('rocks', 'night', 'x').id === H.candidates('rocks', 'night')[0].id);
  check('sunset and night count as after dark; sunrise, morning and afternoon as day', H.phaseOf('night') === 'night' && H.phaseOf('sunset') === 'night' && H.phaseOf('sunrise') === 'day' && H.phaseOf('morning') === 'day' && H.phaseOf('afternoon') === 'day' && H.phaseOf('') === 'day');
  var e0 = ST.value(), r1 = H.record(S, 'grouper', d1, ST);
  check('a fish seen goes in the book with its first day, and the cast is charged in the same save', r1.ok && r1.first && r1.n === 1 && H.seen(S, 'grouper') && H.harbourState(S).book.grouper.first === d1 && H.harbourState(S).casts === 1 && ST.value() === e0 - ST.COSTS.fish);
  var r2 = H.record(S, 'grouper', '2026-10-22', ST);
  check('meeting the same fish again counts it, keeps the first day, and costs only the cast', r2.ok && !r2.first && r2.n === 2 && H.harbourState(S).book.grouper.first === d1 && H.seenCount(S) === 1 && ST.value() === e0 - 2 * ST.COSTS.fish);
  check('an unknown fish is refused and changes nothing', !H.record(S, 'kraken', d1, ST).ok && H.harbourState(S).casts === 2);
  var sd = (S.state().stamina || {}).day || d1; S.setState({ stamina: { v: 1, max: 100, day: sd } });
  check('too tired: the fish is not written and nothing is charged', !H.record(S, 'snapper', d1, ST).ok && !H.seen(S, 'snapper') && H.harbourState(S).casts === 2 && ST.value() === 1);
  S.setState({ harbour: { book: { grouper: { first: 'yesterday', n: -3 }, snapper: { first: '2026-99-99', n: 2 }, mullet: { first: '2020-01-01', n: 0 }, dragon: { first: d1, n: 2 } }, casts: 'many' } });
  check('restored harbour values are cleaned: known fish only, whole counts, real dates only, and a zero-count entry is no meeting', JSON.stringify(H.harbourState(S).book) === '{"snapper":{"first":null,"n":2}}' && H.harbourState(S).casts === 0 && !H.seen(S, 'grouper') && !H.seen(S, 'mullet'));
  S.setState({ stamina: { v: 100, max: 100, day: sd } });
  var rm = H.record(S, 'mullet', d1, ST), rs = H.record(S, 'snapper', d1, ST);
  check('meeting a fish whose old entry was dropped is a first meeting today; a kept count with no date gets today as its first day', rm.ok && rm.first && H.harbourState(S).book.mullet.first === d1 && rs.ok && !rs.first && rs.n === 3 && H.harbourState(S).book.snapper.first === d1);
  check('no hearts are paid at the harbour, no energy is ever added, and no diary entry is written', !/OvuRewards|\.award\(|\.grant\(|\bS\.add\(|OvuStore\.add\(|addMany\(/.test(HS) && !/refill\(|\.v\s*\+=/.test(HS));
  var L = H.LAYOUT, bad = K.checkLayout(L);
  check('harbour: home, stand points and doors are on the floor and outside every solid', bad.length === 0, JSON.stringify(bad));
  var wd = K.world(L, []), starts = L.doors.map(function (x) { return { x: x.x, y: x.y }; }), targets = L.hotspots.map(function (h) { return h.wp; }).concat(starts), miss = [];
  starts.forEach(function (a) { targets.forEach(function (t) { if (!(Math.abs(a.x - t.x) < 0.01 && Math.abs(a.y - t.y) < 0.01) && !K.plan(wd, a, t, 2)) miss.push([a.x, a.y, t.x, t.y].join(',')); }); });
  check('harbour: the planner reaches the jetty end, the rocks, the bench and the hut from the path', miss.length === 0, miss.join(' | '));
  var FL = F.LAYOUT, fbad = K.checkLayout(FL), fw = K.world(FL, []), fd = FL.doors.filter(function (d) { return d.id === 'harboursteps'; })[0];
  check('the farm has steps down to the harbour, on its floor and reachable from the garden gate', !!fd && fd.to === 'harbour' && fbad.length === 0 && !!K.plan(fw, { x: 15, y: 57 }, { x: fd.x, y: fd.y }, 2), JSON.stringify(fbad));
  var M = fs.readFileSync(path.join(root, 'ovu-moments.js'), 'utf8');
  check('the harbour moments describe the float, the fish and the water, and never hurry her', ['cast', 'bite', 'release', 'watchwater'].every(function (k) { return M.indexOf(k + ': {') > -1; }) && /no hurry/.test(M));
})();
(function tones() {
  console.log('2k5. the crystals’ tone (21 Oct): nine pitches, no claims, no diary, no hearts; the hotspot stands on the cave floor');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-tones.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var T = w.OvuTones, B = w.OvuBarn, K = w.OvuWalk, TS = fs.readFileSync(path.join(root, 'ovu-tones.js'), 'utf8');
  check('the nine pitches, labelled by pitch only, never by a promise', T.FREQS.join() === '174,285,396,417,528,639,741,852,963' && T.label(528) === '528 Hz, middle' && T.label(174) === '174 Hz, low' && T.label(963) === '963 Hz, high' && T.label(440) === '' && !/love|repair|liberation|healing|DNA|chakra/i.test(TS));
  check('the tone follows the app volume and never passes its ceiling; a bad volume is silent', T.gainFor(1) === T.CEILING && T.gainFor(0.5) === Math.round(0.5 * T.CEILING * 1000) / 1000 && T.gainFor(0) === 0 && T.gainFor('x') === 0 && T.gainFor(9) === T.CEILING);
  check('without Web Audio (node) starting a tone fails quietly and nothing is playing', T.start(528, null) === false && T.playing() === null && T.remaining() === null);
  check('each pitch has a tradition word and no health promise; the sheet says research has not shown it (22 Oct)', T.FREQS.every(function (f) { return T.MEANING[f] && !/heal|cure|repair|DNA|love|pain|anxiety/i.test(T.MEANING[f]); }) && /sound-bath tradition/.test(TS) && /Research has not shown that a pitch does this/.test(TS));
  check('she can just sit with nothing playing, or sit with rain, a stream or waves; Stop ends sound and sitting together', /\['none', 'Just sit'\]/.test(TS) && Object.keys(T.BEDS).join() === 'rain,stream,waves' && T.startBed('rain', null) === false && T.bed() === null && /function endAll\(\) \{ stop\(\); standUp\(\); \}/.test(TS));
  check('the module writes no diary entry, pays no hearts and costs no energy', !/OvuRewards|\bS\.add\(|OvuStore\.add\(|addMany\(|spend\(|spendWith\(/.test(TS));
  var L = B.CAVE, bad = K.checkLayout(L), cry = L.hotspots.filter(function (h) { return h.id === 'crystals'; })[0];
  var wd = K.world(L, []), from = { x: L.doors[0].x, y: L.doors[0].y };
  check('the crystals are a cave hotspot whose stand point is on the floor, outside the pool and the crystals, and reachable from the way in', !!cry && bad.length === 0 && !!K.plan(wd, from, cry.wp, 2), JSON.stringify(bad));
})();
(function soothingTones() {
  console.log('2k5b. the sung-bowl voice (22 Oct): slow fixed-hertz shimmer, a hum only where there is room, a dark room from seeded noise, nothing past the ceiling');
  var w = scenes('2026-10-22'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-tones.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var T = w.OvuTones, TS = fs.readFileSync(path.join(root, 'ovu-tones.js'), 'utf8');
  var ids = T.PARTIALS.map(function (p) { return p.id; });
  check('the voice is a fundamental, its octave, the struck bowl’s next mode near 2.76 and a hum an octave below, the fundamental loudest', ids.join() === 'fundamental,octave,third,hum' && T.PARTIALS[0].ratio === 1 && T.PARTIALS[1].ratio === 2 && Math.abs(T.PARTIALS[2].ratio - 2.76) < 0.01 && T.PARTIALS[3].ratio === 0.5 && T.PARTIALS.every(function (p) { return p.level <= T.PARTIALS[0].level; }));
  var offs = [].concat.apply([], T.PARTIALS.map(function (p) { return p.voices.map(function (v) { return v[0]; }); })), beats = [];
  T.PARTIALS.forEach(function (p) { for (var i = 0; i < p.voices.length; i++) for (var j = i + 1; j < p.voices.length; j++) beats.push(Math.abs(p.voices[i][0] - p.voices[j][0])); });
  var fundSwing = (function (p) { var s = p.voices.slice(1).reduce(function (a, v) { return a + v[1]; }, 0); return 20 * Math.log10((1 + s) / (1 - s)); })(T.PARTIALS[0]);
  check('the fundamental’s twins together are under a sixth of it, so its worst swing is under 3 dB (Codex: a slow beat is not a shallow one)', fundSwing < 3 && T.PARTIALS.every(function (p) { return p.voices.slice(1).every(function (v) { return v[1] <= 0.1; }); }), fundSwing);
  check('every partial has a centre sine and twins a fixed fraction of a hertz away: all beats between 0.1 and 1 Hz, so the shimmer never becomes a wobble (fluctuation strength peaks at 4 Hz)', T.PARTIALS.every(function (p) { return p.voices[0][0] === 0 && p.voices[0][1] === 1 && p.voices.length >= 2; }) && beats.every(function (b) { return b >= 0.1 && b <= 1; }) && T.PARTIALS.every(function (p) { return p.voices.slice(1).every(function (v) { return v[1] < 1 && v[1] > 0; }); }), JSON.stringify(beats));
  var ok = T.FREQS.every(function (hz) {
    var v = T.voices(hz), sL = 0, sR = 0; v.forEach(function (x) { var g = T.panGains(x.pan); sL += x.gain * g[0]; sR += x.gain * g[1]; });
    var fund = v.filter(function (x) { return x.partial === 'fundamental'; }).reduce(function (a, x) { return a + x.gain; }, 0);
    return v.length >= 7 && Math.abs(Math.max(sL, sR) - 1) < 0.002 && v.every(function (x) { return x.f > 80 && x.f < 2700 && x.gain > 0 && Math.abs(x.pan) <= 0.5; }) && fund > 0.5;
  });
  check('for every pitch the sines’ gains sum to one in the louder channel (the pre-ceiling peak), the fundamental carries more than half, and nothing sits above 2.7 kHz', ok, JSON.stringify(T.voices(963)));
  check('a centred voice counts full in both channels (it skips the panner); a panned one counts by equal power', T.panGains(0)[0] === 1 && T.panGains(0)[1] === 1 && Math.abs(T.panGains(1)[0]) < 1e-12 && Math.abs(T.panGains(1)[1] - 1) < 1e-12 && Math.abs(T.panGains(0.35)[0] * T.panGains(0.35)[0] + T.panGains(0.35)[1] * T.panGains(0.35)[1] - 1) < 1e-12);
  check('the hum sits under the higher pitches only: none below 300 Hz, full from 600 Hz, and 174 Hz has no 87 Hz sine a phone cannot play', T.humShare(174) === 0 && T.humShare(285) === 0 && T.humShare(450) === 0.5 && T.humShare(639) === 1 && !T.voices(174).some(function (x) { return x.partial === 'hum'; }) && T.voices(963).some(function (x) { return x.partial === 'hum' && Math.abs(x.f - 481.5) < 0.5; }));
  check('the low-pass follows the pitch between 700 and 1800 Hz, so no bare high partial rings', T.cutoffFor(174) === 700 && Math.abs(T.cutoffFor(528) - 1161.6) < 1e-9 && T.cutoffFor(963) === 1800 && T.cutoffFor(5000) === 1800);
  var ir = T.impulse(48000, 2.2, T.ROOM.seed), ir2 = T.impulse(48000, 2.2, T.ROOM.seed), same = true, diff = false, fin = true;
  for (var i = 0; i < ir[0].length; i++) { if (ir[0][i] !== ir2[0][i]) same = false; if (ir[0][i] !== ir[1][i]) diff = true; if (!isFinite(ir[0][i]) || Math.abs(ir[0][i]) > 1) fin = false; }
  var early = 0, late = 0; for (var k = 0; k < 4800; k++) early = Math.max(early, Math.abs(ir[0][k])); for (var k2 = ir[0].length - 4800; k2 < ir[0].length; k2++) late = Math.max(late, Math.abs(ir[0][k2]));
  var dot = 0, nL = 0, nR = 0; for (var q0 = 0; q0 < ir[0].length; q0++) { dot += ir[0][q0] * ir[1][q0]; nL += ir[0][q0] * ir[0][q0]; nR += ir[1][q0] * ir[1][q0]; }
  var corr = dot / Math.sqrt(nL * nR);
  check('the room’s impulse is 2.2 s of seeded decaying noise: repeatable from its seed, finite, within one, at least 50 dB quieter at its end than its start, and one room heard with two ears (the channels differ but correlate above 0.7)', ir[0].length === 105600 && same && diff && fin && early > 0.5 && late < early / 316 && corr > 0.7 && corr < 0.95 && T.ROOM.spread > 0 && T.ROOM.spread <= 0.6, JSON.stringify([early, late, corr]));
  var pink = T.noise('pink', 48000, 3), brown = T.noise('brown', 48000, 3), pk = 0, bk = 0; for (var j = 0; j < 48000; j++) { pk = Math.max(pk, Math.abs(pink[j])); bk = Math.max(bk, Math.abs(brown[j])); }
  check('pink and brown noise come from the seed, peak near a half, and are not the same signal', Math.abs(pk - 0.5) < 1e-4 && Math.abs(bk - 0.5) < 1e-4 && pink[100] !== brown[100] && T.noise('pink', 48000, 3)[7] === pink[7] && T.noise('pink', 48000, 4)[7] !== pink[7]);
  /* the room's own normalisation: the phasor gain equals a plain DFT at one frequency, and the per-pitch wet share bounds dry + wet at one */
  var f0 = 528.21, sr0 = 48000, re = 0, im = 0; for (var q = 0; q < ir[0].length; q++) { re += ir[0][q] * Math.cos(2 * Math.PI * f0 * q / sr0); im -= ir[0][q] * Math.sin(2 * Math.PI * f0 * q / sr0); }
  var hDirect = Math.sqrt(re * re + im * im), hFast = T.roomGain(ir[0], f0, sr0), wet528 = T.wetFor(ir, 528, sr0), maxH = 0;
  T.voices(528).forEach(function (v) { maxH = Math.max(maxH, T.roomGain(ir[0], v.f, sr0), T.roomGain(ir[1], v.f, sr0)); });
  check('the room’s gain at a sine is computed exactly (phasor against a plain DFT), and the pitch’s wet share makes its loudest sine exactly ROOM.wet, so dry + wet is at most one', Math.abs(hDirect - hFast) < 1e-6 * Math.max(1, hDirect) && Math.abs(wet528 * maxH - T.ROOM.wet) < 1e-9 && T.ROOM.dry + T.ROOM.wet <= 1 && /verb\.normalize = false/.test(TS), JSON.stringify([hDirect, hFast, wet528, maxH]));
  check('the breath is a tenth of a hertz and under a decibel; the arrival has a 2.5 s time constant and the leaving five seconds; the room is mostly dry; the low-pass has no peak (Q in dB); the ceiling is unchanged', T.SWELL.hz === 0.1 && T.SWELL.base + T.SWELL.depth <= 1 && T.SWELL.depth <= 0.1 && T.ENV.attackTau >= 2.5 && T.ENV.releaseSeconds >= 4 && T.ENV.releaseAfter >= T.ENV.releaseSeconds + 1 && T.ROOM.dry > T.ROOM.wet && T.ROOM.dry + T.ROOM.wet <= 1 && T.CEILING === 0.35 && T.FILTER_Q_DB <= -6);
  check('the envelope starts from exactly nothing, is let go by an exponential approach and then a short ramp to exactly zero, with every source stopped on the audio clock; never a ramp to a zero that cannot be', /env\.gain\.setValueAtTime\(0, now\); env\.gain\.setTargetAtTime\(1, now, ENV\.attackTau\)/.test(TS) && /p\.setTargetAtTime\(0, now, tau\); p\.setValueAtTime\(cur \* Math\.exp\(-secs \/ tau\), t0\); p\.linearRampToValueAtTime\(0, t0 \+ 0\.05\)/.test(TS) && /x\.stop\(t0 \+ 0\.1\)/.test(TS) && !/exponentialRampToValueAtTime/.test(TS) && /function liveNodes\(\)/.test(TS) && T.liveNodes() === 0);
  check('the old twin at a share of the pitch is gone, and no voice reads a random number', !/1\.0035/.test(TS) && !/Math\.random/.test(TS));
  var MS = fs.readFileSync(path.join(root, 'ovu-music.js'), 'utf8');
  check('the cave’s own tune steps aside while a tone or a bed plays (ovu-music.js exclusive)', /OvuTones[^\n]*playing\(\)[^\n]*bed\(\)/.test(MS));
})();
(function tonesLifecycle() {
  console.log('2k5c. the spring’s sound graph (22 Oct, Codex P1s): the app switch and slider reach a leaving sound, one sound at a time, Stop on the audio clock, housekeeping waits for the audio clock, nothing leaks');
  function fakeAudio() {
    var log = { created: [], gainCalls: 0, gainThrowsAt: 0, resumeMode: 'ok', state: 'running', ctx: null };
    function Param(v) { this.value = v; this.events = []; }
    ['setValueAtTime', 'setTargetAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'cancelScheduledValues'].forEach(function (m) { Param.prototype[m] = function () { var a = [].slice.call(arguments); this.events.push([m].concat(a)); if (m === 'setValueAtTime' && (a[1] == null || a[1] <= log.ctx.currentTime)) this.value = a[0]; return this; }; }); /* only a value set at or before now is the value now; a ramp's end is not */
    function Node(kind) { this.kind = kind; this.outs = []; this.disconnected = false; log.created.push(this); }
    Node.prototype.connect = function (n) { this.outs.push(n); return n; }; Node.prototype.disconnect = function () { this.outs = []; this.disconnected = true; };
    function Src(kind) { Node.call(this, kind); this.started = null; this.stopped = null; } Src.prototype = Object.create(Node.prototype);
    Src.prototype.start = function (t) { if (this.started !== null) throw new Error('InvalidStateError'); this.started = t || 0; };
    Src.prototype.stop = function (t) { if (this.stopped !== null) throw new Error('InvalidStateError'); this.stopped = t == null ? -1 : t; };
    function Ctx() { this.sampleRate = 48000; this.currentTime = 0; this.state = log.state; this.destination = new Node('destination'); log.ctx = this; }
    Ctx.prototype.createGain = function () { log.gainCalls++; if (log.gainThrowsAt && log.gainCalls === log.gainThrowsAt) throw new Error('NotSupportedError'); var n = new Node('gain'); n.gain = new Param(1); return n; };
    Ctx.prototype.createOscillator = function () { var n = new Src('osc'); n.frequency = new Param(440); n.type = 'sine'; return n; };
    Ctx.prototype.createBiquadFilter = function () { var n = new Node('biquad'); n.frequency = new Param(350); n.Q = new Param(1); n.type = 'lowpass'; return n; };
    Ctx.prototype.createConvolver = function () { var n = new Node('convolver'); n.buffer = null; n.normalize = true; return n; };
    Ctx.prototype.createStereoPanner = function () { var n = new Node('panner'); n.pan = new Param(0); return n; };
    Ctx.prototype.createBufferSource = function () { var n = new Src('bufsrc'); n.buffer = null; n.loop = false; return n; };
    Ctx.prototype.createBuffer = function (ch, len, sr) { var chans = []; for (var c = 0; c < ch; c++) chans.push(new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: function (c) { return chans[c]; } }; };
    Ctx.prototype.resume = function () { if (log.resumeMode === 'throw') throw new Error('InvalidStateError'); return log.resumeMode === 'reject' ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); }; /* a real promise: a refusal arrives after start() has returned, as in a browser */
    return { Ctx: Ctx, log: log };
  }
  function world(setup) {
    var w = scenes('2026-10-22'); w.OvuRoom = null; w.OvuZones = null;
    var fa = fakeAudio(), timers = [], sw = { on: true, vol: 0.25 }; if (setup) setup(fa.log);
    w.AudioContext = fa.Ctx; w.OvuSound = { volume: function () { return sw.vol; }, enabled: function () { return sw.on; } };
    w.setTimeout = function (fn, ms) { timers.push({ fn: fn, ms: ms }); return timers.length; }; w.clearTimeout = function (id) { if (timers[id - 1]) timers[id - 1].fn = null; };
    ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-tones.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
    function flush() { var t = timers.splice(0); t.forEach(function (x) { if (x.fn) x.fn(); }); return t; }
    return { T: w.OvuTones, log: fa.log, timers: timers, flush: flush, sw: sw };
  }
  function gains(L) { return L.created.filter(function (n) { return n.kind === 'gain'; }); }
  function vols(L, g) { return gains(L).filter(function (n) { return n.gain.events.length && n.gain.events[0][0] === 'setValueAtTime' && n.gain.events[0][1] === g && n.outs.some(function (o) { return o.kind === 'destination'; }); }); } /* a graph's vol: set to the ceiling share and wired to the output */
  var W = world(), T = W.T, L = W.log, changes = []; T.onChange(function (hz) { changes.push(hz); });
  check('a tone starts: nodes held, its vol at the ceiling for the app volume and wired to the output, the low-pass with a dB Q, the room unnormalised with a stereo impulse, every sine started at once', T.start(528, null) === true && T.playing() === 528 && T.liveNodes() > 20 && vols(L, T.gainFor(0.25)).length === 1 && vols(L, T.gainFor(0.25))[0].gain.value === T.gainFor(0.25) && L.created.filter(function (n) { return n.kind === 'biquad'; })[0].Q.value === T.FILTER_Q_DB && L.created.filter(function (n) { return n.kind === 'convolver'; })[0].normalize === false && L.created.filter(function (n) { return n.kind === 'convolver'; })[0].buffer.numberOfChannels === 2 && L.created.filter(function (n) { return n.kind === 'osc'; }).every(function (o) { return o.started === 0; }), T.liveNodes());
  var envNode = gains(L).filter(function (n) { return n.gain.events.length > 1 && n.gain.events[0][0] === 'setValueAtTime' && n.gain.events[0][1] === 0 && n.gain.events[1][0] === 'setTargetAtTime'; })[0];
  check('the envelope rises from exactly zero by an exponential approach with the 2.5 s time constant', !!envNode && envNode.gain.events[1][1] === 1 && envNode.gain.events[1][3] === T.ENV.attackTau);
  var vol1 = vols(L, T.gainFor(0.25))[0]; W.sw.vol = 0.6; T.setVolume();
  var ev = vol1.gain.events.map(function (e) { return e[0]; }).join();
  check('the slider reaches the tone: its vol holds where it is, then approaches the new ceiling share; the vol never carries a ramp of its own', /^setValueAtTime,cancelScheduledValues,setValueAtTime,setTargetAtTime$/.test(ev) && vol1.gain.events[3][1] === T.gainFor(0.6) && !vol1.gain.events.some(function (e) { return e[0] === 'linearRampToValueAtTime'; }), ev);
  var n0 = L.created.length;
  check('a bed replaces the tone, and a tone replaces the bed: never both', T.startBed('rain', null) === true && T.playing() === null && T.bed() === 'rain' && T.start(396, null) === true && T.bed() === null && T.playing() === 396 && L.created.length > n0);
  var bedVol = vols(L, T.gainFor(0.6)).filter(function (v) { return !v.outs.length || true; })[0];
  check('a bed’s arrival is its own ramp, not a ramp on its vol, so a later slider move cannot be undone by a fade-in still scheduled', gains(L).some(function (n) { return n.gain.events.length > 1 && n.gain.events[0][1] === 0 && n.gain.events[1][0] === 'setTargetAtTime' && n.gain.events[1][1] === 1 && n.gain.events[1][3] === 1; }) && vols(L, T.gainFor(0.6)).every(function (v) { return !v.gain.events.some(function (e) { return e[0] === 'linearRampToValueAtTime'; }); }));
  var sources = L.created.filter(function (n) { return n.kind === 'osc' || n.kind === 'bufsrc'; }), before = sources.filter(function (s) { return s.stopped === null; }).length;
  L.ctx.currentTime = 30; T.stop();
  var live = sources.filter(function (s) { return s.stopped === null; }), env396 = gains(L).filter(function (n) { return n.gain.events.some(function (e) { return e[0] === 'linearRampToValueAtTime' && e[1] === 0; }); });
  check('Stop: playing clears at once, every source of the leaving voice gets a stop time on the audio clock just after the ramp to zero, its close shuts after the room, and the nodes stay held for housekeeping', T.playing() === null && before > 0 && live.length === 0 && sources.filter(function (s) { return s.stopped === 30 + T.ENV.releaseSeconds + 0.1; }).length >= 9 && env396.length >= 2 && T.liveNodes() > 0, JSON.stringify([before, live.length, sources.map(function (s) { return s.stopped; }).slice(-12)]));
  var lastEnv = env396.filter(function (n) { return n.gain.events[0][1] === 0; }).pop().gain.events, idx = lastEnv.map(function (e) { return e[0]; }).join();
  check('the leaving shape: hold, approach nothing, land where the approach is, then a 50 ms ramp to exactly zero', /cancelScheduledValues,setValueAtTime,setTargetAtTime,setValueAtTime,linearRampToValueAtTime$/.test(idx) && lastEnv[lastEnv.length - 1][1] === 0 && Math.abs(lastEnv[lastEnv.length - 1][2] - (30 + T.ENV.releaseSeconds + 0.05)) < 1e-9, idx);
  var closeNode = gains(L).filter(function (n) { return n.gain.events.some(function (e) { return e[0] === 'linearRampToValueAtTime' && e[1] === 0 && Math.abs(e[2] - (30 + T.ENV.releaseSeconds + 0.3)) < 1e-9; }); })[0];
  check('the close shuts 0.2 s after the sines stop, so the room’s tail cannot escape', !!closeNode);
  W.sw.vol = 0.1; T.setVolume();
  var reached = gains(L).filter(function (n) { return n.gain.events.some(function (e) { return e[0] === 'setTargetAtTime' && e[1] === T.gainFor(0.1); }); });
  check('the slider still reaches the leaving voice (Codex P1 1): nothing plays, yet its vol approaches the new share', T.playing() === null && reached.length >= 1, reached.length);
  T.hush();
  check('the switch going off hushes the leaving voice at once', gains(L).some(function (n) { var e = n.gain.events[n.gain.events.length - 1]; return e[0] === 'setTargetAtTime' && e[1] === 0 && e[3] === 0.05; }));
  var fired = W.flush();
  check('housekeeping that fires while the audio clock is still before the final zero re-arms itself and lets nothing go (Codex P1 3)', fired.length >= 1 && T.liveNodes() > 0 && W.timers.some(function (t) { return t.fn; }), T.liveNodes());
  L.ctx.currentTime = 36; W.flush();
  check('once the audio clock is past the final zero the housekeeping lets every node go, disconnected, and nothing is live', T.liveNodes() === 0 && L.created.every(function (n) { return n.kind === 'destination' || n.disconnected; }), T.liveNodes());
  T.stop(); T.stop();
  check('every change was announced: the pitch, then null for the bed, then the pitch, then null at Stop (a Stop with nothing playing still tells listeners, as before)', changes.slice(0, 4).join() === '528,,396,' && changes.slice(4).every(function (x) { return x === null; }), changes.join());
  W.sw.on = false; var n1 = L.created.length;
  check('with the app’s sound off nothing starts: tone and bed refuse, no node is made, nothing is live', T.start(528, null) === false && T.startBed('waves', null) === false && L.created.length === n1 && T.liveNodes() === 0 && T.playing() === null && T.bed() === null);
  W.sw.on = true; L.ctx.currentTime = 60;
  check('a timed sit: ten minutes registers a timer whose firing stops the tone', T.start(741, 10) === true && W.timers.some(function (t) { return t.fn && t.ms === 600000; }) && T.remaining() > 590);
  var n2 = L.created.length, calls = L.gainCalls; L.gainThrowsAt = calls + 8; /* vol, close, dry, wet, bus, swell, lg, then the envelope: the eighth gain of a start, made after the breath LFO has started */
  var r2 = T.start(852, null), lfos = L.created.slice(n2).filter(function (n) { return n.kind === 'osc'; });
  check('a start that fails half way (at the envelope, after the breath LFO started) returns false, stops that LFO, releases every node it had built, clears the earlier timed sit and tells listeners (Codex P1 4 and P2 7); the replaced tone is still leaving, so it stays held', r2 === false && T.playing() === null && lfos.length === 1 && lfos[0].stopped !== null && L.created.slice(n2).every(function (n) { return n.disconnected; }) && T.liveNodes() > 0 && T.remaining() === null && !W.timers.some(function (t) { return t.fn && t.ms === 600000; }) && changes[changes.length - 1] === null, JSON.stringify([r2, T.liveNodes(), lfos.length, T.remaining()]));
  L.gainThrowsAt = 0; L.ctx.currentTime = 70; W.flush();
  check('and once its audio clock is past, the replaced tone is gone too', T.liveNodes() === 0);
  var W2 = world(function (log) { log.state = 'suspended'; log.resumeMode = 'reject'; }), T2 = W2.T, told = []; T2.onChange(function (hz) { told.push(hz); });
  var r3 = T2.start(528, null), armed = T2.playing() === 528 && T2.liveNodes() > 0, settled = false;
  process.on('exit', function () { if (!settled) { console.error('  FAIL the refused-resume check never ran'); process.exitCode = 1; } });
  Promise.resolve().then(function () { }).then(function () { /* the refusal lands after start() returned, as in a browser */
    settled = true;
    check('a context whose resume is refused leaves nothing armed (Codex P1 5): the start had armed a tone, the refusal undoes it, nothing plays, nothing is held, listeners are told', r3 === true && armed && T2.playing() === null && T2.liveNodes() === 0 && told[told.length - 1] === null, JSON.stringify([r3, armed, T2.playing(), T2.liveNodes(), told]));
  });
  var W3 = world(function (log) { log.state = 'suspended'; log.resumeMode = 'throw'; }), T3 = W3.T, n3 = W3.log.created.length;
  check('a resume that throws stops a start before it builds anything (only the context and its destination exist)', T3.start(528, null) === false && T3.playing() === null && T3.liveNodes() === 0 && W3.log.created.filter(function (n) { return n.kind !== 'destination'; }).length === n3);
  var loop = T.loopable(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]), 6, 2), bn = T.bedNoise('pink', 48000, 19200, 617), bpk = 0; for (var q = 0; q < bn.length; q++) bpk = Math.max(bpk, Math.abs(bn[q]));
  check('a loopable buffer blends its start with the tail past the loop point by equal power, and a bed’s loop is then scaled so its loudest sample is exactly a half (the overlap can lift a peak)', loop.length === 6 && Math.abs(loop[0] - 7) < 1e-6 && Math.abs(loop[1] - (2 * Math.SQRT1_2 + 8 * Math.SQRT1_2)) < 1e-6 && loop[2] === 3 && loop[5] === 6 && Math.abs(bpk - 0.5) < 1e-4, JSON.stringify([Array.prototype.slice.call(loop), bpk]));
  var TS = fs.readFileSync(path.join(root, 'ovu-tones.js'), 'utf8');
  var SA = T.stateAction;
  check('what a store change means (the pure table): sleep or the switch off ends everything; the switch off also hushes whatever is leaving, whichever reason brought the news; another tab, clear, import and a sync end everything; otherwise the slider is followed', SA('state', true, true).join() === 'end' && SA('state', false, false).join() === 'end,hush' && SA('state', true, false).join() === 'end,hush' && SA('state', false, true).join() === 'volume' && SA('external', false, false).join() === 'end,hush' && SA('external', false, true).join() === 'end' && SA('clear', false, true).join() === 'end' && SA('import', false, false).join() === 'end,hush' && SA('sync-pull', false, false).join() === 'end,hush' && SA('props', false, false).join() === '' && SA('entries', false, true).join() === '');
  var Wh = world(), Th = Wh.T, Lh = Wh.log; Th.start(528, null); Lh.ctx.currentTime = 10; Th.stop(); Th.hush(); Wh.sw.vol = 0.5; Th.setVolume();
  var hushedVols = vols(Lh, Th.gainFor(0.25));
  check('a hushed leaving graph stays hushed: the switch back on and a slider move never retarget its vol above zero (Codex round two P1)', hushedVols.length === 1 && hushedVols[0].gain.events[hushedVols[0].gain.events.length - 1][0] === 'setTargetAtTime' && hushedVols[0].gain.events[hushedVols[0].gain.events.length - 1][1] === 0 && !hushedVols[0].gain.events.some(function (e) { return e[0] === 'setTargetAtTime' && e[1] === Th.gainFor(0.5); }), JSON.stringify(hushedVols.map(function (v) { return v.gain.events.slice(-2); })));
  var Wc = world(), Tc = Wc.T, realCtor = Wc.log.ctx; /* a browser with no working AudioContext: the constructor throws */
  (function () { var w0 = scenes('2026-10-22'); w0.OvuRoom = null; w0.OvuZones = null; w0.AudioContext = function () { throw new Error('NotSupportedError'); }; w0.OvuSound = { volume: function () { return 0.25; }, enabled: function () { return true; } }; w0.setTimeout = function () { return 1; }; w0.clearTimeout = function () { };
    ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-tones.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w0, { filename: f }); });
    var ok = true, r1, r2; try { r1 = w0.OvuTones.start(528, null); r2 = w0.OvuTones.startBed('rain', null); } catch (e) { ok = false; }
    check('an AudioContext whose constructor throws makes a tone and a bed refuse quietly (false, no exception, nothing held)', ok && r1 === false && r2 === false && w0.OvuTones.playing() === null && w0.OvuTones.liveNodes() === 0, JSON.stringify([ok, r1, r2]));
  })();
  var Wg = world(function (log) { log.state = 'suspended'; log.resumeMode = 'reject'; }), Tg = Wg.T, gtold = []; Tg.onChange(function (hz) { gtold.push(hz); });
  var ga = Tg.start(528, null); Wg.log.resumeMode = 'throw'; var gb = Tg.start(963, null), gArmed = Tg.playing() === 528 && Tg.liveNodes() > 0, gSettled = false;
  process.on('exit', function () { if (!gSettled) { console.error('  FAIL the generation check never ran'); process.exitCode = 1; } });
  Promise.resolve().then(function () { }).then(function () {
    gSettled = true;
    check('generation ownership (Codex round two P2): a second start whose resume throws takes no generation, so the first start’s later refusal still undoes the first tone', ga === true && gb === false && gArmed && Tg.playing() === null && Tg.liveNodes() === 0 && gtold[gtold.length - 1] === null, JSON.stringify([ga, gb, gArmed, Tg.playing(), Tg.liveNodes(), gtold]));
  });
  var Ws = world(function (log) { log.state = 'suspended'; log.resumeMode = 'reject'; }), Ts = Ws.T, stold = []; Ts.onChange(function (hz) { stold.push(hz); });
  Ts.start(528, null); Ws.log.ctx.currentTime = 5; Ts.stop(); var sAfterStop = stold.length, sHeld = Ts.liveNodes(), sSettled = false;
  process.on('exit', function () { if (!sSettled) { console.error('  FAIL the stale-refusal check never ran'); process.exitCode = 1; } });
  Promise.resolve().then(function () { }).then(function () {
    sSettled = true;
    var fired = Ws.flush(), again = Ws.timers.filter(function (t) { return t.fn; }).length;
    check('a refusal that lands after Stop took the stage lets the old graph go but tells no one and clears nothing newer; the released graph’s housekeeping never re-arms (Codex round two P2)', sHeld > 0 && Ts.liveNodes() === 0 && stold.length === sAfterStop && fired.length >= 1 && again === 0, JSON.stringify([sHeld, Ts.liveNodes(), stold.length, sAfterStop, fired.length, again]));
  });
  var Wb = world(), Tb = Wb.T, Lb = Wb.log, btold = []; Tb.onChange(function (hz) { btold.push(hz); });
  Tb.start(741, 10); var nb = Lb.created.length; Lb.ctx.createBufferSource = function () { throw new Error('NotSupportedError'); };
  check('a bed that fails half way (its source could not be made) returns false, releases what it built, clears the earlier timed sit and tells listeners (the bed’s own catch, Codex round two)', Tb.startBed('rain', null) === false && Tb.bed() === null && Tb.playing() === null && Lb.created.slice(nb).every(function (n) { return n.disconnected; }) && Tb.remaining() === null && btold[btold.length - 1] === null, JSON.stringify([Tb.bed(), Tb.remaining(), btold]));
  check('Stop clears the sit timer before its early return, so a timed quiet sit ended early never stands her up later (Codex round three, a bug older than this branch)', /function stop\(\) \{ gen\+\+; clearTimer\(\); if \(!playing && !voice && !bed\) \{ notify\(\); return; \}/.test(TS));
  var b44 = T.bedNoise('pink', 44100 * 6, Math.round(44100 * 0.4), 617), p44 = 0; for (var q4 = 0; q4 < b44.length; q4++) p44 = Math.max(p44, Math.abs(b44[q4]));
  check('the six-second 44.1 kHz pink loop (the case Codex cited) peaks at exactly a half after its seam', Math.abs(p44 - 0.5) < 1e-6, p44);
  check('the sheet says why nothing plays when sound is off; the store subscription applies the pure table; the page hidden still ends everything; every node joins its graph the moment it is made', /Sound is switched off in the room/.test(TS) && /stateAction\(reason, !!S\.state\(\)\.sleeping, soundOn\(\)\)\.forEach/.test(TS) && /visibilitychange[^\n]*if \(doc\.hidden\) endAll\(\)/.test(TS) && !/ctx\.create\w+\(\)(?![^\n]*make\()/.test(TS.split('function stage')[1].split('T.start = start')[0].replace(/make\(nodes, ctx\.create\w+\(\)\)/g, 'M')), (TS.split('function stage')[1].split('T.start = start')[0].replace(/make\(nodes, ctx\.create\w+\(\)\)/g, 'M').match(/ctx\.create\w+\(\)/g) || []).join());
})();
(function phase1ReviewFixes() {
  console.log('2k. Codex review of Phase 1: a full disk never half-buys, update day never pays twice, clocks cannot reopen caps');
  var w = fresh(), S = w.OvuStore, RW = w.OvuRewards, t = S.today();
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  var F = w.OvuFarm, ls = w.localStorage, realSet = ls.setItem;
  function full(on) { ls.setItem = on ? function () { throw new Error('QuotaExceededError'); } : realSet; }
  var l = RW.ledger(); l.hearts = 100; S.setState({ rewards: l });
  full(true); var r = F.buyPack(S, RW, 'radish'); full(false);
  check('a seed pack bought while storage is full fails and leaves hearts and seeds exactly as they were, in memory too', !r.ok && RW.ledger().hearts === 100 && (F.farmState(S).seeds.radish || 0) === 0, JSON.stringify(r));
  check('after the disk frees up, one purchase takes one price', F.buyPack(S, RW, 'radish').ok && RW.ledger().hearts === 90 && F.farmState(S).seeds.radish === 3);
  l = RW.ledger(); l.hearts = 500; S.setState({ rewards: l }); F.buyTool(S, RW, 'bigcan');
  var ids = F.BEDS.filter(function (b) { return !F.hasWeeds(null, b.id, t); }).slice(0, 2).map(function (b) { return b.id; });
  ids.forEach(function (id) { F.plant(S, id, 'radish', t); });
  full(true); var wa = F.waterAll(S, t); full(false);
  check('the big can with storage full waters nothing (no half-watered farm)', !wa.ok && ids.every(function (id) { return !F.wateredToday(F.bed(S, id), t); }));
  var stub = { spends: 0, spendWith: function (a, patch) { this.spends++; S.commit(Object.assign({ stamina: { v: 50, max: 100, day: t } }, patch)); return true; } };
  var wb = F.waterAll(S, t, stub);
  check('the big can charges one watering in the same save as the beds', wb.ok && wb.charged && stub.spends === 1 && ids.every(function (id) { return F.wateredToday(F.bed(S, id), t); }) && S.state().stamina.v === 50);
  /* an install updated mid-day: the old rule paid a meal this morning */
  var w2 = fresh(), S2 = w2.OvuStore, R2 = w2.OvuRewards, l2 = R2.ledger();
  l2.log = [{ at: new Date().toISOString(), type: 'food', points: 6 }]; l2.hearts = 6; l2.earned = 6; delete l2.daily; S2.setState({ rewards: l2 });
  check('on update day a meal the old rule already paid today does not pay again', R2.award(S2.add('food', S2.today(), { meal: 'dinner', foods: 'soup' }, 'room')).points === 0 && R2.award(S2.add('sleep', S2.today(), { bedTime: '23:00', wakeTime: '07:00', quality: 3 }, 'room')).points === 10);
  /* practice: earn the day's cap, a later day, then the clock goes back */
  var w3 = fresh(), S3 = w3.OvuStore, R3 = w3.OvuRewards, l3 = R3.ledger(); l3.dailyLast = S3.addDays(S3.today(), 1); S3.setState({ rewards: l3 });
  var pr = R3.award(S3.add('mindfulness', S3.today(), { kind: 'informal', minutes: 2, completed: true }, 'room'));
  check('a clock set back cannot reopen an earlier day’s practice cap', pr.points === 0);
  var ST = { restedEnough: null }; vm.runInContext(fs.readFileSync(path.join(root, 'ovu-stamina.js'), 'utf8'), w3, { filename: 'ovu-stamina.js' }); ST = w3.OvuStamina;
  var now = 1e12, at = new Date(now - 4 * 3600000).toISOString();
  check('rest: the phone clock says four hours, but the open app’s own timer saw twenty minutes, so no refill', ST.restedEnough(at, now) && !ST.restedEnough(at, now, { at: at, t: 0, now: 20 * 60000 }) && ST.restedEnough(at, now, { at: at, t: 0, now: 4 * 3600000 }) && ST.restedEnough(at, now, { at: 'another night', t: 0, now: 60000 }));
  var room = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  check('a wake sheet left open in another tab re-reads storage and cannot save the same night twice', room.indexOf("This night was already saved.") > -1 && room.indexOf("var cur = (S.reload ? S.reload() : S.state()).sleeping; if (!cur") > -1 && typeof S3.reload === 'function');
  var w4 = fresh(), S4 = w4.OvuStore, R4 = w4.OvuRewards, l4 = R4.ledger(); l4.mindDay = { day: S4.addDays(S4.today(), 2), pts: 6 }; delete l4.dailyLast; S4.setState({ rewards: l4 });
  check('an older ledger without the watermark still blocks a clock set back (it takes the latest day it knows)', R4.award(S4.add('mindfulness', S4.today(), { kind: 'informal', minutes: 2, completed: true }, 'room')).points === 0 && R4.award(S4.add('food', S4.today(), { meal: 'lunch', foods: 'rice' }, 'room')).points === 0);
  var st5 = { spendWith: undefined }, wc = F.waterAll(S, S.addDays(t, 1), st5);
  check('with an older energy module the big can reports it did not charge, so the caller charges the watering', wc.ok === true && wc.charged === false);
})();

(function rewardWritesAreAtomic() {
  console.log('audit P1: failed reward writes leave no purchase, entitlement or receipt in memory');
  var w = fresh(), S = w.OvuStore, RW = w.OvuRewards, ls = w.localStorage, realSet = ls.setItem;
  var base = { hearts: 500, earned: 500, log: [], owned: ['cat', 'acc-bow'], placed: { cat: true }, treats: { 'treat-fish': 2 }, wear: { cat: 'acc-bow' }, lastDay: null, streak: 0 };
  var cases = [
    ['furniture purchase', function () { RW.buy('plant'); }],
    ['treat purchase', function () { RW.buy('treat-fish'); }],
    ['treat use', function () { RW.useTreat('cat', 'treat-fish'); }],
    ['accessory change', function () { RW.wear('cat', null); }],
    ['placing an item', function () { RW.toggle('cat'); }],
    ['one-off gift', function () { RW.grant(20, 'audit-gift'); }],
    ['pet care', function () { RW.care('cat', 'feed'); }],
    ['spending with state', function () { RW.spend(10, 'audit', { auditPurchase: true }); }],
    ['practice thank-you', function () { RW.thank('audit', { auditPurchase: true }); }],
    ['logging entitlement', function () { RW.recordWith('water', { auditPurchase: true }); }]
  ];
  cases.forEach(function (c) {
    S.setState({ rewards: JSON.parse(JSON.stringify(base)) });
    var snap = JSON.stringify(S.state()), threw = false;
    ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('QuotaExceededError'); return realSet.call(ls, k, v); };
    try { c[1](); } catch (e) { threw = true; }
    ls.setItem = realSet;
    check(c[0] + ': a failed commit leaves memory exactly as before', threw && JSON.stringify(S.state()) === snap);
    S.setProfile({ name: 'After failed ' + c[0] });
    check(c[0] + ': a later unrelated save cannot persist the refused action', JSON.stringify(JSON.parse(ls.getItem('ovumind_db_v1')).state) === snap);
  });
  S.setState({ rewards: { hearts: 100, earned: 100, log: [], owned: ['cat', 'catgrey'], placed: { cat: false, catgrey: true } } });
  var refund0 = JSON.stringify(S.state().rewards), refundFailed = false;
  ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('QuotaExceededError'); return realSet.call(ls, k, v); };
  try { RW.ledger(); } catch (e) { refundFailed = true; }
  ls.setItem = realSet;
  check('a refused retired-item refund changes neither hearts nor ownership', refundFailed && JSON.stringify(S.state().rewards) === refund0);
  check('the refund retries once when storage works', RW.ledger().hearts === 250 && RW.ledger().owned.join() === 'cat');
  S.setState({ rewards: JSON.parse(JSON.stringify(base)) });
  RW.buy('plant');
  check('a successful purchase commits its price and item together', RW.ledger().hearts === 440 && RW.ledger().owned.indexOf('plant') > -1 && RW.ledger().placed.plant === true);

  [
    ['daily logging', 'food', { meal: 'lunch', foods: 'rice' }, 6],
    ['seat practice', 'mindfulness', { kind: 'seat', seat: 'audit-seat', minutes: 1, completed: true }, 2],
    ['Moon Tap', 'mindfulness', { kind: 'breathtap', seconds: 60, minutes: 1, completed: true }, 2]
  ].forEach(function (c) {
    S.setState({ rewards: { hearts: 0, earned: 0, log: [], owned: [], placed: {}, lastDay: null, streak: 0 } });
    var ev = S.add(c[1], S.today(), c[2], 'room'), snap = JSON.stringify(S.state().rewards), failed = false;
    ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('QuotaExceededError'); return realSet.call(ls, k, v); };
    try { RW.award(ev); } catch (e) { failed = true; }
    ls.setItem = realSet;
    check(c[0] + ': reward failure keeps the saved entry and no receipt or entitlement', failed && !!S.get(ev.id) && JSON.stringify(S.state().rewards) === snap);
    S.load(true);
    var writes = 0;
    ls.setItem = function (k, v) { if (k === 'ovumind_db_v1' && ++writes === 2) throw new Error('second write refused'); return realSet.call(ls, k, v); };
    var r = null; try { r = RW.award(ev); } catch (e) {} ls.setItem = realSet;
    var paid = S.state().rewards, saved = JSON.parse(ls.getItem('ovumind_db_v1')).state.rewards;
    check(c[0] + ': retry writes receipt, entitlement and points in a single commit', writes === 1 && r && r.points === c[3] && paid.hearts === c[3] && paid.receipts[ev.id] === 1 && JSON.stringify(paid) === JSON.stringify(saved));
    S.load(true);
    check(c[0] + ': reloaded receipt prevents a second award', RW.award(ev).again === true && RW.ledger().hearts === c[3]);
  });
})();


(function noPeriodStatementsAreNotFlow() {
  console.log('3. "has not returned", "no period", "not bleeding" are no-period observations, never a period entry');
  var w = fresh(), O = w.OvuOrb, S = w.OvuStore;
  function periods(s) { return O.parseLocal(s).filter(function (e) { return e.type === 'period'; }); }
  ['My period has not returned.', 'My period hasn’t come back yet', 'no period this month', 'not bleeding today', 'I haven’t had a period since March', 'I missed my period', 'My period is 5 days late', 'I’m not on my period'].forEach(function (s) {
    check('no period entry from "' + s + '"', periods(s).length === 0, JSON.stringify(O.parseLocal(s)));
    check('"' + s + '" is read as a no-period observation', O.noPeriod(s) === true);
  });
  check('a real period note is not a no-period observation', O.noPeriod('Period started today, medium') === false && O.noPeriod('heavy bleeding, cramps 6/10') === false);
  check('a period chip still logs a period', periods('Period started today, medium').length === 1);
  check('a negation does not hide the bleeding that follows', (function () { var p = periods('no cramps, but heavy bleeding today'); return p.length === 1 && p[0].data.flow === 'heavy'; })());
  var mood = O.parseLocal('I feel anxious and low before my period.');
  check('a mood note before a period is not a period day', !mood.some(function (e) { return e.type === 'period'; }) && mood.some(function (e) { return e.type === 'symptom' && e.data.symptoms.indexOf('anxiety') > -1 && e.data.symptoms.indexOf('low mood') > -1; }), JSON.stringify(mood));
})();

(function symptomNegation() {
  console.log('4. a negated symptom is not logged');
  var w = fresh(), O = w.OvuOrb;
  function syms(s) { var out = []; O.parseLocal(s).forEach(function (e) { if (e.type === 'symptom') out = out.concat(e.data.symptoms); }); return out; }
  check('"No hot flushes today" logs no hot flushes', syms('No hot flushes today').indexOf('hot flushes') < 0, JSON.stringify(syms('No hot flushes today')));
  check('"no cramps or bloating" logs neither', syms('no cramps or bloating today').length === 0, JSON.stringify(syms('no cramps or bloating today')));
  check('"no cramps but a headache" keeps the headache only', (function () { var s = syms('no cramps but a headache'); return s.indexOf('headache') > -1 && s.indexOf('cramps') < 0; })(), JSON.stringify(syms('no cramps but a headache')));
  check('"didn’t have any cramps" logs no cramps', syms('didn’t have any cramps today').indexOf('cramps') < 0);
  check('"not anxious" is not anxiety and not a low mood', (function () { var e = O.parseLocal('not anxious or low today, slept fine'); return !e.some(function (x) { return x.type === 'symptom' && (x.data.symptoms.indexOf('anxiety') > -1 || x.data.mood === 'low'); }); })());
  check('an unnegated symptom is still logged', syms('Hot flushes again today').indexOf('hot flushes') > -1);
})();

(function symptomWords() {
  console.log('5. night sweats, irritable, forgetful, flat and tearful map to the symptom list');
  var w = fresh(), O = w.OvuOrb;
  function syms(s) { var out = []; O.parseLocal(s).forEach(function (e) { if (e.type === 'symptom') out = out.concat(e.data.symptoms); }); return out; }
  var ns = O.parseLocal('I had night sweats and woke at 3 am.');
  check('"I had night sweats and woke at 3 am." is not a dinner', !ns.some(function (e) { return e.type === 'food'; }), JSON.stringify(ns));
  check('night sweats are logged as hot flushes', syms('I had night sweats and woke at 3 am.').indexOf('hot flushes') > -1);
  check('irritable and forgetful map to irritability and brain fog', (function () { var s = syms('I am irritable and forgetful.'); return s.indexOf('irritability') > -1 && s.indexOf('brain fog') > -1; })(), JSON.stringify(syms('I am irritable and forgetful.')));
  check('flat and tearful map to low mood', syms('feeling flat today').indexOf('low mood') > -1 && syms('so tearful this evening').indexOf('low mood') > -1);
  check('a flat white is a coffee, not a low mood', (function () { var e = O.parseLocal('had a flat white for breakfast'); return e.some(function (x) { return x.type === 'food'; }) && !e.some(function (x) { return x.type === 'symptom'; }); })(), JSON.stringify(O.parseLocal('had a flat white for breakfast')));
  check('"had cramps after lunch" is a symptom, not a meal', (function () { var e = O.parseLocal('had cramps after lunch'); return !e.some(function (x) { return x.type === 'food'; }) && syms('had cramps after lunch').indexOf('cramps') > -1; })(), JSON.stringify(O.parseLocal('had cramps after lunch')));
  check('hot flashes, the American spelling, are hot flushes', syms('hot flashes all afternoon').indexOf('hot flushes') > -1);
})();

(function postmenoSpottingFlagPersists() {
  console.log('6. spotting after menopause logged as a symptom raises the saved flag, which stays until dismissed');
  function has(list) { return list.some(function (f) { return f.code === 'POSTMENO_BLEED'; }); }
  /* the store reads the phone's clock through new Date(): a fake clock lets a later session be 40 days on */
  function clock(w, iso) { var RealDate = Date; w.__now = new RealDate(iso + 'T12:00:00').getTime(); w.Date = function FakeDate() { var a = arguments; if (!a.length) return new RealDate(w.__now); if (a.length === 1) return new RealDate(a[0]); return new RealDate(a[0], a[1], a[2] || 1, a[3] || 0, a[4] || 0, a[5] || 0, a[6] || 0); }; w.Date.now = function () { return w.__now; }; w.Date.parse = RealDate.parse; w.Date.UTC = RealDate.UTC; w.Date.prototype = RealDate.prototype; }
  function session(prev, iso) { var n = fresh(); clock(n, iso); n.localStorage.setItem(n.OvuStore.KEY, prev.localStorage.getItem(prev.OvuStore.KEY)); n.OvuStore.load(true); return n; }
  var day0 = '2026-10-19', day40 = addDays(day0, 40);
  var w = fresh(); clock(w, day0);
  var S = w.OvuStore, A = w.OvuAgents, O = w.OvuOrb;
  S.setProfile({ lifeStage: 'post' });
  var parsed = O.parseLocal('No period for two years, but spotting today');
  check('the note is a spotting symptom, not a period day', parsed.some(function (e) { return e.type === 'symptom' && e.data.symptoms.indexOf('spotting') > -1; }) && !parsed.some(function (e) { return e.type === 'period'; }), JSON.stringify(parsed));
  var saved = O.save(parsed), res = A.analyze(saved[0]);
  check('saving it raises POSTMENO_BLEED straight away (the toast after saving)', has(res.flags), JSON.stringify(res.flags.map(function (f) { return f.code; })));
  check('the flag is high and can be dismissed', A.allFlags().some(function (f) { return f.code === 'POSTMENO_BLEED' && f.level === 'high' && f.dismissible === true && f.since === day0; }));
  var w2 = session(w, day40);
  check('a new session 40 days later still shows the flag, past the 28-day window', w2.OvuStore.today() === day40 && has(w2.OvuAgents.allFlags()), JSON.stringify(w2.OvuAgents.allFlags().map(function (f) { return f.code; })));
  check('a flag that is not dismissible cannot be dismissed', w2.OvuAgents.dismissFlag('PAIN_SEVERE') === false);
  check('dismissing it hides it', w2.OvuAgents.dismissFlag('POSTMENO_BLEED') === true && !has(w2.OvuAgents.allFlags()));
  var w3 = session(w2, day40);
  check('the dismissal holds in the next session', !has(w3.OvuAgents.allFlags()));
  w3.OvuOrb.save(w3.OvuOrb.parseLocal('a bit of spotting today'));
  check('new spotting after the dismissal raises it again', has(w3.OvuAgents.allFlags()));
  var w4 = fresh(); clock(w4, day0); var S4 = w4.OvuStore; S4.setProfile({ lifeStage: 'post' });
  S4.add('period', addDays(day0, -200), { flow: 'medium', clots: false, impact: false });
  w4.OvuAgents.dailySummary(addDays(day0, -200)); /* the journal reads past days too */
  check('a period from before menopause raises nothing, even after the journal reads its day', !has(w4.OvuAgents.allFlags()) && !S4.state().postmenoBleed, JSON.stringify(S4.state().postmenoBleed));
  var w5 = fresh(), S5 = w5.OvuStore; S5.setProfile({ lifeStage: 'post' });
  S5.add('symptom', S5.today(), { symptoms: ['cramps'], pain: null, mood: '', notes: '' });
  S5.sandbox({ profile: { lifeStage: 'post' }, events: [{ id: 'x1', type: 'symptom', date: S5.today(), data: { symptoms: ['spotting'] } }] }, function () { w5.OvuAgents.allFlags(); });
  check('a sandboxed read (the doctor sample) never writes into the real record', !S5.state().postmenoBleed && S5.list('symptom').length === 1, JSON.stringify(S5.state().postmenoBleed));
})();

(function sleepAssumedAndOneNightPerDate() {
  console.log('7. assumed sleep times are marked, and several entries on one date count as one night');
  var w = fresh(), S = w.OvuStore, A = w.OvuAgents, O = w.OvuOrb, today = S.today();
  var es = O.parseLocal('slept 7h');
  check('"slept 7h" carries data.assumed = true', es.length === 1 && es[0].type === 'sleep' && es[0].data.assumed === true, JSON.stringify(es));
  check('"slept 11pm to 7am" is not assumed', O.parseLocal('slept 11pm to 7am')[0].data.assumed !== true);
  var saved = O.save(es);
  check('the saved entry keeps assumed', saved.length === 1 && saved[0].data.assumed === true, JSON.stringify(saved[0] && saved[0].data));
  check('the confirmation line says the wake time was assumed', /assumed/.test(O.describe(es[0])), O.describe(es[0]));
  var w2 = fresh(), S2 = w2.OvuStore, A2 = w2.OvuAgents, t2 = S2.today();
  for (var i = 0; i < 5; i++) S2.add('sleep', t2, { bedTime: '02:00', wakeTime: '06:00', quality: 2, notes: '' });
  var st = S2.sleepStats(7, t2);
  check('five entries on one date count as one night of 4 h', st.count === 1 && st.nights.length === 1 && st.nights[0].hours === 4 && st.nights[0].blocks === 5, JSON.stringify(st.nights));
  check('no sleep warning from five entries on one date', !A2.allFlags(t2).some(function (f) { return /^SLEEP_/.test(f.code); }), JSON.stringify(A2.allFlags(t2).map(function (f) { return f.code; })));
  check('the per-entry list keeps all five entries for deleting', st.entries.length === 5 && st.entries.every(function (e) { return e.id; }));
  var w3 = fresh(), S3 = w3.OvuStore, t3 = S3.today();
  S3.add('sleep', t3, { bedTime: '23:00', wakeTime: '02:00', quality: null, notes: '' });
  S3.add('sleep', t3, { bedTime: '03:00', wakeTime: '07:00', quality: 3, notes: '' });
  S3.add('sleep', t3, { bedTime: '00:00', wakeTime: '07:00', quality: null, notes: '', assumed: true });
  var n3 = S3.sleepStats(1, t3).nights[0];
  check('a broken night joins its blocks: 23:00 to 02:00 plus 00:00 to 07:00 is 8 h, not 14 h', n3 && n3.hours === 8 && n3.blocks === 3, JSON.stringify(n3));
  check('a night with an assumed block is marked assumed', n3 && n3.assumed === true);
  var w4 = fresh(), S4 = w4.OvuStore, A4 = w4.OvuAgents, t4 = S4.today();
  [-6, -3, 0].forEach(function (d) { S4.add('sleep', addDays(t4, d), { bedTime: '02:00', wakeTime: '06:00', quality: null, notes: '' }); });
  check('three short nights on separate dates are not "in a row"', !A4.allFlags(t4).some(function (f) { return f.code === 'SLEEP_SHORT_RUN'; }));
  [-2, -1].forEach(function (d) { S4.add('sleep', addDays(t4, d), { bedTime: '02:00', wakeTime: '06:00', quality: null, notes: '' }); });
  check('three short nights on adjacent dates are "in a row"', A4.allFlags(t4).some(function (f) { return f.code === 'SLEEP_SHORT_RUN'; }));
})();

(function savedEntryIsNotARewardFailure() {
  console.log('a saved journal entry stays saved when its hearts write fails');
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), start = src.indexOf('  function afterSave('), end = src.indexOf('\n  /* ---------- deck', start), lines = [];
  var w = vm.createContext({ A: { analyze: function () { return { flags: [] }; } }, RW: { award: function () { throw new Error('QuotaExceededError'); } }, MO: null,
    S: { profile: function () { return {}; } }, topCare: function () { return null; }, endMoment: function () { }, moment: function () { },
    toast: function (line) { lines.push(line); }, renderProps: function () { }, renderDeck: function () { },
    $: function () { return { classList: { add: function () { }, remove: function () { } } }; } });
  vm.runInContext(src.slice(start, end), w);
  var threw = false, result; try { result = w.afterSave({ id: 'already-saved' }); } catch (e) { threw = true; }
  check('a failed award does not throw back into the diary save or claim that the entry failed', !threw && result && result.rewardFailed && lines.length === 1 && /Saved to your journal/.test(lines[0]) && /Hearts could not be saved/.test(lines[0]), lines.join());
})();

(function foodPhotoKeepsItsDraft() {
  console.log('food photos: late shrink, barcode and recognition results keep their original meal and picker');
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  var block = src.slice(src.indexOf("        var st = $('#fdPhotoState')"), src.indexOf("        $('#fdPhotoCam').addEventListener('change', onPhoto)"));
  function gate() { var resolve, reject, promise = new Promise(function (a, b) { resolve = a; reject = b; }); return { promise: promise, resolve: resolve, reject: reject }; }
  function turn() { return new Promise(function (resolve) { setImmediate(resolve); }); }
  function world(stage) {
    var g = gate(), nodes = {}, connected = true, out = { renders: 0, looks: 0, reads: 0, toasts: 0 }, current = { items: [], photo: null };
    ['#fdPhotoState', '#thumb', '#fdAllow', '#fdPick'].forEach(function (id) { nodes[id] = { innerHTML: '', classList: { add: function () { } }, addEventListener: function () { } }; });
    var w = vm.createContext({ draft: current, Promise: Promise, esc: String, inp2: { focus: function () { } },
      $: function (id) { return nodes[id]; }, document: { body: { contains: function () { return connected; } } },
      renderItems: function () { out.renders++; }, toast: function () { out.toasts++; }, lookup: function () { out.looks++; },
      FD: { shrink: function () { return stage === 'shrink' ? g.promise : Promise.resolve({ dataUrl: 'photo', image: {} }); }, detectInImage: function () { return stage === 'barcode' ? g.promise : Promise.resolve(null); } },
      ORB: { photosAllowed: function () { return true; }, parsePhoto: function () { out.reads++; return g.promise; } } });
    vm.runInContext(block, w);
    out.w = w; out.g = g; out.nodes = nodes; out.original = current; out.start = function () { return w.onPhoto.call({ files: [{}], value: 'chosen' }); };
    out.detach = function () { connected = false; }; return out;
  }
  var finished = false;
  process.on('exit', function () { if (!finished) { console.error('food photo regression did not finish'); process.exitCode = 1; } });
  var a = world('shrink'), ap = a.start(); a.w.draft = { items: [], photo: null }; a.g.resolve({ dataUrl: 'old', image: {} });
  ap.then(function () {
    check('shrinking an old photo cannot set the new meal thumbnail or start recognition', a.w.draft.photo === null && a.original.photo === null && a.reads === 0);
    var b = world('barcode'), bp = b.start();
    return turn().then(function () { b.w.draft = { items: [], photo: null }; b.g.resolve('12345678'); return bp; }).then(function () {
      check('a late barcode result never opens a picker in a new meal', b.looks === 0 && b.toasts === 0 && b.w.draft.photo === null);
    });
  }).then(function () {
    var c = world('recognition'), cp = c.start();
    return turn().then(function () { c.w.draft = { items: [], photo: null }; c.g.resolve({ isFood: true, items: [{ name: 'old noodles' }] }); return cp; }).then(function () {
      check('old recognition cannot add food to its replacement draft', c.reads === 1 && c.w.draft.items.length === 0 && c.original.items.length === 0 && c.renders === 0);
    });
  }).then(function () {
    var d = world('recognition'), dp = d.start();
    return turn().then(function () { d.detach(); d.g.reject(new Error('late failure')); return dp; }).then(function () {
      check('an old recognition failure cannot paint an error on a closed picker', d.renders === 0 && d.nodes['#fdPhotoState'].innerHTML.indexOf('late failure') < 0 && d.toasts === 0);
    });
  }).then(function () {
    var e = world('recognition'), ep = e.start();
    return turn().then(function () { e.nodes['#fdPhotoState'] = { innerHTML: '' }; e.g.resolve({ isFood: true, items: [{ name: 'old rice' }] }); return ep; }).then(function () {
      check('replacing only the photo picker also invalidates recognition', e.original.items.length === 0 && e.renders === 0);
    });
  }).then(function () {
    var f = world('recognition'), fp = f.start();
    return turn().then(function () { f.g.resolve({ isFood: true, items: [{ name: 'current rice' }] }); return fp; }).then(function () {
      check('recognition still fills its current meal exactly once', f.original.items.length === 1 && f.original.items[0].name === 'current rice' && f.renders === 1);
    });
  }).then(function () { finished = true; }).catch(function (e) { check('food photo continuations run to completion', false, e.stack); finished = true; });
})();

(function foodPhotoEstimates() {
  console.log('food photo estimates become diary items, rescale with grams, and stay opt-in');
  var w = fresh(), O = w.OvuOrb, FD = w.OvuFood;
  var food = { is_food: true, meal_name: 'Bak chor mee with soup', items: [
    { name: 'Dry minced meat noodles (bak chor mee)', portion: 'bowl', grams: 400, kcal: 510, protein_g: 24, carb_g: 62, fat_g: 19, fiber_g: 3, confidence: 'medium' },
    { name: 'Clear side soup', portion: 'bowl', grams: 250, kcal: 35, protein_g: 3, carb_g: 3, fat_g: 1, fiber_g: 0.4, confidence: 'medium' }], note: 'Noodles and soup.' };
  var items = O.foodItemsFrom(food, 'doubao-seed-2-1-pro-260915');
  check('two items in diary shape, labelled as estimates', items.length === 2 && items[0].source.kind === 'estimate' && items[0].method === 'photo estimate' && items[0].portionLabel === '1 bowl (about 400 g)', JSON.stringify(items[0] && items[0].portionLabel));
  var t = FD.sum(items).totals;
  check('totals add up (545 kcal, 27 g protein, 65 g carbs, 20 g fat)', Math.round(t.kcal) === 545 && Math.round(t.protein) === 27 && Math.round(t.carb) === 65 && Math.round(t.fat) === 20, JSON.stringify(t));
  var half = O.regram(items[0], 200);
  check('halving the grams halves the nutrients', Math.round(half.nutrients.kcal) === 255 && half.portionLabel === '1 bowl (about 200 g)', JSON.stringify([half.nutrients.kcal, half.portionLabel]));
  check('not food gives no items', O.foodItemsFrom({ is_food: false, items: food.items }).length === 0);
  var bad = O.foodItemsFrom({ is_food: true, items: [{ name: 'x', grams: -5, kcal: 'lots', protein_g: 99999 }, { name: '' }].concat(new Array(12).fill({ name: 'rice', grams: 100, kcal: 130 })) });
  check('bad numbers clamp, empty names drop, at most 8 kept (8 read, 1 empty name dropped)', bad.length === 7 && bad[0].nutrients.kcal === null && bad[0].nutrients.protein === 300 && bad[0].grams === 0, JSON.stringify(bad[0] && bad[0].nutrients));
  check('food photos are off until the user allows them', O.photosAllowed() === false && O.aiConfig().photos === false);
})();

(function hpbMatching() {
  console.log('photo dishes that match an HPB SG FoodID row use HPB values; unknown dishes stay estimates');
  var w = fresh(), O = w.OvuOrb, FD = w.OvuFood;
  var table = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'data', 'nutrients-sg-hpb.json'), 'utf8'));
  check('table has at least 80 rows, every row has crId, serving weight, per-100 g and per-serving values', table.foods.length >= 80 && table.foods.every(function (f) { return f.crId && f.serving && f.serving.g > 0 && f.n && f.perServing && typeof f.n.kcal === 'number'; }), 'rows=' + table.foods.length);
  check('no row carries -1 or an invented zero where HPB had no value', table.foods.every(function (f) { return Object.keys(f.n).every(function (k) { return f.n[k] === null || f.n[k] >= 0; }) && f.n.mg === null; }));
  check('licence notice and terms link are recorded', /SG FoodID/.test(table.licence.notice) && /termsofuse-hpbsgfoodid/.test(table.licence.terms));
  FD.sgUse(table);
  var bcm = FD.sgMatch('Dry minced meat noodles (bak chor mee)');
  check('bak chor mee matches the dry HPB row', bcm && bcm.food.crId === 'F05060002', JSON.stringify(bcm && bcm.food.name));
  check('bak chor mee soup matches the soup row', (FD.sgMatch('Minced meat noodle soup (bak chor mee soup)') || {}).food.crId === 'F05060003');
  check('chicken rice matches steamed chicken rice', (FD.sgMatch('Hainanese chicken rice') || {}).food.crId === 'F05100133');
  check('roasted chicken rice matches the roasted row', (FD.sgMatch('Roasted chicken rice') || {}).food.crId === 'F05100112');
  check('kopi c matches Kopi C, not Kopi', (FD.sgMatch('Kopi C (coffee with evaporated milk)') || {}).food.crId === 'D09010036');
  check('an unknown dish has no match', FD.sgMatch('Grilled unicorn steak with truffle') === null && FD.sgMatch('Clear side soup') === null);
  check('a qualifier the row does not cover rejects the match (kimchi fried rice, pork rendang, pork fried rice)', FD.sgMatch('Kimchi fried rice') === null && FD.sgMatch('Pork rendang') === null && FD.sgMatch('Pork fried rice') === null, JSON.stringify([FD.sgMatch('Kimchi fried rice'), FD.sgMatch('Pork rendang'), FD.sgMatch('Pork fried rice')].map(function (m) { return m && m.food.name; })));
  check('qualifiers the row does cover still match (egg fried rice, chicken rendang, beef rendang)', (FD.sgMatch('Egg fried rice') || {}).food.crId === 'F05100049' && (FD.sgMatch('Chicken rendang') || {}).food.crId === 'F11020019' && (FD.sgMatch('Beef rendang') || {}).food.crId === 'F06040005');
  function crOf(n) { var m = FD.sgMatch(n); return m ? m.food.crId : null; }
  function crsOf(names) { return JSON.stringify(names.map(function (n) { var m = FD.sgMatch(n); return [n, m && m.food.name]; })); }
  var ownMiss = []; table.foods.forEach(function (f) { [f.name].concat(f.aliases || []).forEach(function (a) { if (crOf(a) !== f.crId) ownMiss.push(a + ' -> ' + crOf(a)); }); });
  check('every row name and alias still matches its own row', ownMiss.length === 0, ownMiss.slice(0, 5).join('; '));
  check('an alias followed by a food form it is not names that food, not the alias (steamed rice cakes, fried rice vermicelli or noodles, chicken rice balls, milo powder)', ['steamed rice cakes with preserved radish', 'fried rice vermicelli with egg', 'fried rice noodles', 'chicken rice balls', 'milo powder'].every(function (n) { return crOf(n) === null; }), crsOf(['steamed rice cakes with preserved radish', 'fried rice vermicelli with egg', 'fried rice noodles', 'chicken rice balls', 'milo powder']));
  check('the form can sit further along the phrase (milo flavoured biscuits, fried rice vermicelli singapore style)', crOf('milo flavoured biscuits') === null && crOf('fried rice vermicelli singapore style') === null, crsOf(['milo flavoured biscuits', 'fried rice vermicelli singapore style']));
  check('a form the row already is keeps the match (laksa noodles, chwee kueh rice cakes, char kway teow flat rice noodles)', crOf('Laksa noodles in spicy coconut gravy') === 'F05060073' && crOf('chwee kueh rice cakes') === 'F11090005' && crOf('char kway teow flat rice noodles') === 'F05060020', crsOf(['Laksa noodles in spicy coconut gravy', 'chwee kueh rice cakes', 'char kway teow flat rice noodles']));
  check('a form in another phrase does not reject (chicken rice with rice cakes, chilli sauce after "and")', crOf('chicken rice with rice cakes') === 'F05100133' && crOf('Hainanese chicken rice with cucumber and chilli sauce') === 'F05100133');
  check('a dish named only after "with" or "and" is a side, not the item (rice with fried chicken wing, the eggs in a kaya toast set), while a bracketed gloss still names it', crOf('rice with fried chicken wing') === null && crOf('kaya toast with soft boiled eggs') !== 'F01060006' && crOf('plain rice and fried egg') !== 'F01050005' && crOf('Noodles (bak chor mee)') === 'F05060002', crsOf(['rice with fried chicken wing', 'kaya toast with soft boiled eggs', 'plain rice and fried egg', 'Noodles (bak chor mee)']));
  check('a row that says it has no noodles does not count as a noodle dish (fishball soup noodles)', crOf('fishball soup noodles') === null, crsOf(['fishball soup noodles']));
  check('regressions: steamed and Hainanese chicken rice, chwee kueh, plain white rice', crOf('Steamed chicken rice') === 'F05100133' && crOf('Hainanese chicken rice') === 'F05100133' && crOf('chwee kueh') === 'F11090005' && crOf('Chwee kueh') === 'F11090005' && crOf('steamed white rice') === 'F05090006');
  check('a bare nasi lemak names no set, so it matches no row (HPB has only fish, wing and cutlet sets and the rice alone)', crOf('nasi lemak') === null && crOf('Nasi lemak') === null && crOf('nasi lemak with egg') === null && crOf('nasi lemak with fried egg and ikan bilis') === null, crsOf(['nasi lemak', 'nasi lemak with egg']));
  check('a nasi lemak that names its set or the rice alone still matches that row', crOf('nasi lemak with fried fish') === 'F05100089' && crOf('Nasi lemak with fried chicken wing') === 'F05100087' && crOf('nasi lemak (chicken cutlet)') === 'F05100085' && crOf('nasi lemak (rice only)') === 'F05100090' && crOf('coconut rice') === 'F05100090', crsOf(['nasi lemak with fried fish', 'Nasi lemak with fried chicken wing', 'nasi lemak (chicken cutlet)', 'nasi lemak (rice only)']));
  var food = { is_food: true, meal_name: 'Bak chor mee', items: [
    { name: 'Dry minced meat noodles (bak chor mee)', portion: 'bowl', grams: 400, kcal: 510, protein_g: 24, carb_g: 62, fat_g: 19, fiber_g: 3, confidence: 'medium' },
    { name: 'Clear side soup', portion: 'bowl', grams: 250, kcal: 35, protein_g: 3, carb_g: 3, fat_g: 1, fiber_g: 0.4, confidence: 'medium' },
    { name: 'Steamed chicken rice', portion: 'plate', grams: 5, kcal: 600, protein_g: 20, carb_g: 70, fat_g: 15, fiber_g: 2, confidence: 'high' }] };
  var items = O.foodItemsFrom(food, 'doubao-seed-2-1-pro-260915'), bak = items[0], soup = items[1], cr = items[2];
  var row = table.foods.filter(function (f) { return f.crId === 'F05060002'; })[0], crRow = table.foods.filter(function (f) { return f.crId === 'F05100133'; })[0];
  check('bak chor mee item is kind hpb with the HPB reference and name', bak.source.kind === 'hpb' && /F05060002/.test(bak.source.ref) && bak.name === row.name && bak.foodId === 'hpb:bak-chor-mee', JSON.stringify(bak.source));
  check('its nutrients are HPB per-100 g × the model’s 400 g', Math.abs(bak.nutrients.kcal - row.n.kcal * 4) < 0.01 && Math.abs(bak.nutrients.protein - row.n.protein * 4) < 0.01 && bak.grams === 400 && bak.portionLabel === '1 bowl (about 400 g)', JSON.stringify([bak.nutrients.kcal, bak.portionLabel]));
  check('values HPB does not publish stay null (magnesium) and the model estimate is kept for reference', bak.nutrients.mg === null && bak.estimate && bak.estimate.nutrients.kcal === 510 && bak.hpb.modelGrams === 400);
  check('the side soup stays a photo estimate', soup.source.kind === 'estimate' && soup.nutrients.kcal === 35);
  check('implausible grams (5 g plate) fall back to the HPB serving weight', cr.source.kind === 'hpb' && cr.grams === crRow.serving.g && cr.hpb.viaServing === true && /HPB serving/.test(cr.portionLabel) && Math.abs(cr.nutrients.kcal - crRow.perServing.kcal) < 1.5, JSON.stringify([cr.grams, cr.portionLabel, cr.nutrients.kcal, crRow.perServing.kcal]));
  var half = O.regram(bak, 200);
  check('changing the grams rescales HPB values too', Math.abs(half.nutrients.kcal - row.n.kcal * 2) < 0.1 && half.portionLabel === '1 bowl (about 200 g)');
  var renamed = O.rename(soup, 'Fishball soup'), fbRow = table.foods.filter(function (f) { return f.crId === 'F03020012'; })[0];
  var expectG = 250 >= fbRow.serving.g * 0.4 && 250 <= fbRow.serving.g * 2.5 ? 250 : fbRow.serving.g;
  check('renaming an estimate to an HPB dish switches it to HPB (grams kept when plausible, else the HPB bowl)', renamed.source.kind === 'hpb' && renamed.hpb.crId === 'F03020012' && renamed.grams === expectG && Math.abs(renamed.nutrients.kcal - fbRow.n.kcal * expectG / 100) < 0.1, JSON.stringify([renamed.source.kind, renamed.hpb && renamed.hpb.crId, renamed.grams, fbRow.serving.g]));
  var teh = O.rename(soup, 'Teh');
  check('renaming the 250 g soup to Teh keeps 250 (ml) because it is a normal cup', teh.source.kind === 'hpb' && teh.hpb.crId === 'D09020066' && teh.grams === 250 && /250 ml/.test(teh.portionLabel), JSON.stringify([teh.grams, teh.portionLabel]));
  var back = O.rename(bak, 'Mystery noodles');
  check('renaming an HPB dish to something unknown falls back to the model’s estimate under the new name', back.source.kind === 'estimate' && back.name === 'Mystery noodles' && Math.round(back.nutrients.kcal) === 510, JSON.stringify([back.source.kind, back.name, back.nutrients.kcal]));
  /* the exact relay output for the Commons "Bak chor mee and soup" photo on 18 October 2026 */
  var live = { is_food: true, meal_name: 'Bak chor mee dry with soup', items: [
    { name: 'dry flat noodles with minced pork, mushrooms, pork slices, cabbage and dark sauce', portion: 'bowl', grams: 550, kcal: 640, protein_g: 34, carb_g: 72, fat_g: 24, fiber_g: 4, confidence: 'medium' },
    { name: 'clear savoury soup', portion: 'bowl', grams: 250, kcal: 45, protein_g: 3, carb_g: 3, fat_g: 2, fiber_g: 0, confidence: 'medium' }] };
  var lv = O.foodItemsFrom(live, 'doubao-seed-2-1-pro-260915');
  check('descriptive item name still matches bak chor mee (dry) by its ingredient phrase, ignoring mushrooms and cabbage in the tail', (FD.sgMatch(live.items[0].name) || {}).food.crId === 'F05060002', JSON.stringify(FD.sgMatch(live.items[0].name)));
  check('live photo: noodles are HPB bak chor mee at 550 g, the soup stays an estimate', lv[0].source.kind === 'hpb' && lv[0].hpb.crId === 'F05060002' && lv[0].grams === 550 && lv[1].source.kind === 'estimate', JSON.stringify([lv[0].source.kind, lv[0].grams, lv[1].source.kind]));
  var viaMeal = O.foodItemsFrom({ is_food: true, meal_name: 'Laksa with a drink', items: [
    { name: 'rice vermicelli in spicy coconut gravy with prawns, fishcake and bean sprouts', portion: 'bowl', grams: 500, kcal: 620, protein_g: 22, carb_g: 60, fat_g: 30, fiber_g: 3, confidence: 'medium' },
    { name: 'iced lemon tea', portion: 'glass', grams: 350, kcal: 90, protein_g: 0, carb_g: 22, fat_g: 0, fiber_g: 0, confidence: 'high' }] });
  check('a meal name matches onto the dominant dish when no item name matched (laksa bowl), the drink stays an estimate', viaMeal[0].source.kind === 'hpb' && viaMeal[0].hpb.crId === 'F05060073' && viaMeal[0].hpb.via === 'meal name' && viaMeal[1].source.kind === 'estimate', JSON.stringify(viaMeal.map(function (it) { return [it.name, it.source.kind]; })));
  var split = O.foodItemsFrom({ is_food: true, meal_name: 'Nasi lemak', items: [
    { name: 'coconut rice', portion: 'plate', grams: 200, kcal: 320, protein_g: 5, carb_g: 55, fat_g: 9, fiber_g: 1, confidence: 'high' },
    { name: 'fried chicken wing', portion: 'piece', grams: 90, kcal: 250, protein_g: 18, carb_g: 8, fat_g: 16, fiber_g: 0, confidence: 'high' },
    { name: 'fried egg', portion: 'piece', grams: 50, kcal: 90, protein_g: 6, carb_g: 0, fat_g: 7, fiber_g: 0, confidence: 'high' },
    { name: 'ikan bilis and peanuts', portion: 'serving', grams: 30, kcal: 120, protein_g: 8, carb_g: 4, fat_g: 8, fiber_g: 1, confidence: 'medium' }] });
  check('a set split into parts matches each part, never the whole-set row on top (no double count)', split.every(function (it) { return !it.hpb || it.hpb.via !== 'meal name'; }) && split[0].hpb.crId === 'F05100090' && split[1].hpb.crId === 'F11020033' && split[2].hpb.crId === 'F01050005' && split[3].source.kind === 'estimate', JSON.stringify(split.map(function (it) { return [it.name, it.source.kind, it.hpb && it.hpb.crId]; })));
  var w2 = fresh(), O2 = w2.OvuOrb;
  check('without the HPB table every dish is an estimate', O2.foodItemsFrom(food).every(function (it) { return it.source.kind === 'estimate'; }));
})();

(function localNameMatching() {
  console.log('photo items match on the relay local_name first, then the item name, then the meal name');
  var w = fresh(), O = w.OvuOrb, FD = w.OvuFood;
  FD.sgUse(JSON.parse(fs.readFileSync(path.join(root, 'assets', 'data', 'nutrients-sg-hpb.json'), 'utf8')));
  function kinds(items) { return JSON.stringify(items.map(function (it) { return [it.name, it.source.kind, it.hpb && it.hpb.crId, it.hpb && it.hpb.via, it.hpb && it.hpb.localName]; })); }
  var noodles = { name: 'flat yellow noodles tossed in chilli vinegar with minced pork, liver and meatballs', portion: 'bowl', grams: 450, kcal: 560, protein_g: 28, carb_g: 64, fat_g: 20, fiber_g: 3, confidence: 'medium' };
  var soup = { name: 'clear savoury soup', portion: 'bowl', grams: 250, kcal: 45, protein_g: 3, carb_g: 3, fat_g: 2, fiber_g: 0, confidence: 'medium' };
  check('the descriptive noodle name alone matches no HPB row', FD.sgMatch(noodles.name) === null, JSON.stringify(FD.sgMatch(noodles.name)));
  /* the same photo twice: once with local_name on each item, once without */
  var withLocal = O.foodItemsFrom({ is_food: true, meal_name: 'Bak chor mee dry with soup', items: [Object.assign({}, noodles, { local_name: 'bak chor mee (dry)' }), Object.assign({}, soup, { local_name: '' })] });
  check('with local_name: the noodles are HPB bak chor mee (dry) via the local name at the model’s 450 g, the soup stays an estimate', withLocal[0].source.kind === 'hpb' && withLocal[0].hpb.crId === 'F05060002' && withLocal[0].hpb.via === 'local name' && withLocal[0].hpb.localName === 'bak chor mee (dry)' && withLocal[0].grams === 450 && withLocal[1].source.kind === 'estimate' && !withLocal[1].hpb, kinds(withLocal));
  var withoutLocal = O.foodItemsFrom({ is_food: true, meal_name: 'Bak chor mee dry with soup', items: [noodles, soup] });
  check('without local_name: the same noodles still land on bak chor mee (dry), but only through the meal-name fallback', withoutLocal[0].source.kind === 'hpb' && withoutLocal[0].hpb.crId === 'F05060002' && withoutLocal[0].hpb.via === 'meal name' && !withoutLocal[0].hpb.localName && withoutLocal[1].source.kind === 'estimate', kinds(withoutLocal));
  var generic = { is_food: true, meal_name: 'Noodles with soup', items: [Object.assign({}, noodles, { local_name: 'bak chor mee (dry)' }), soup] };
  check('a generic meal name: the local name still matches the noodles, without it both items stay estimates', O.foodItemsFrom(generic)[0].hpb.via === 'local name' && O.foodItemsFrom({ is_food: true, meal_name: 'Noodles with soup', items: [noodles, soup] }).every(function (it) { return it.source.kind === 'estimate'; }), kinds(O.foodItemsFrom(generic)));
  var ck = O.foodItemsFrom({ is_food: true, meal_name: 'Breakfast', items: [{ name: 'steamed rice cakes with preserved radish', local_name: 'chwee kueh', portion: 'serving', grams: 200, kcal: 300, protein_g: 5, carb_g: 50, fat_g: 9, fiber_g: 1, confidence: 'medium' }] });
  check('the local name decides (chwee kueh), and the description alone no longer reads as plain rice', ck[0].hpb && ck[0].hpb.crId === 'F11090005' && ck[0].hpb.via === 'local name' && FD.sgMatch('steamed rice cakes with preserved radish') === null, kinds(ck) + ' name-only: ' + JSON.stringify((FD.sgMatch('steamed rice cakes with preserved radish') || { food: {} }).food.name));
  var plate = { name: 'coconut rice with fried chicken wing, fried egg, ikan bilis, peanuts and sambal', portion: 'plate', grams: 400, kcal: 780, protein_g: 30, carb_g: 80, fat_g: 38, fiber_g: 4, confidence: 'medium' };
  var nl = O.foodItemsFrom({ is_food: true, meal_name: 'Nasi lemak', items: [Object.assign({}, plate, { local_name: 'nasi lemak' })] });
  check('a whole nasi lemak plate named only "nasi lemak" stays the photo estimate: no fish set by local, item or meal name', nl.length === 1 && nl[0].source.kind === 'estimate' && !nl[0].hpb && nl[0].nutrients.kcal === 780, kinds(nl));
  var nlw = O.foodItemsFrom({ is_food: true, meal_name: 'Nasi lemak', items: [Object.assign({}, plate, { local_name: 'nasi lemak (chicken wing)' })] });
  check('the same plate with its set in the local name is the HPB chicken wing set at the model’s 400 g', nlw[0].hpb && nlw[0].hpb.crId === 'F05100087' && nlw[0].hpb.via === 'local name' && nlw[0].grams === 400, kinds(nlw));
  var hanzi = O.foodItemsFrom({ is_food: true, meal_name: '', items: [{ name: 'Dry minced meat noodles (bak chor mee)', local_name: '肉脞面', portion: 'bowl', grams: 400, kcal: 510, protein_g: 24, carb_g: 62, fat_g: 19, fiber_g: 3, confidence: 'medium' }] });
  check('a local name with no HPB row falls back to the item name and is still recorded', hanzi[0].hpb && hanzi[0].hpb.crId === 'F05060002' && hanzi[0].hpb.via === 'item name' && hanzi[0].hpb.localName === '肉脞面', kinds(hanzi));
  var odd = O.foodItemsFrom({ is_food: true, meal_name: '', items: [
    { name: 'Dry minced meat noodles (bak chor mee)', local_name: 42, grams: 400, kcal: 510 },
    { name: 'hot drink', local_name: '  kopi \n  c ', portion: 'cup', grams: 250, kcal: 120 },
    { name: 'Steamed chicken rice', local_name: null, grams: 400, kcal: 600 }] });
  check('a non-string local name is ignored, whitespace is collapsed (kopi c), a null local name falls back to the item name', odd[0].hpb.via === 'item name' && !odd[0].hpb.localName && odd[1].hpb && odd[1].hpb.crId === 'D09010036' && odd[1].hpb.via === 'local name' && odd[1].hpb.localName === 'kopi c' && odd[2].hpb.crId === 'F05100133' && odd[2].hpb.via === 'item name', kinds(odd));
  var lv = O.foodItemsFrom({ is_food: true, meal_name: 'Bak chor mee dry with soup', items: [{ name: 'dry flat noodles with minced pork, mushrooms, pork slices, cabbage and dark sauce', portion: 'bowl', grams: 550, kcal: 640 }] });
  check('an item name match is labelled item name', lv[0].hpb.via === 'item name', kinds(lv));
  var w2 = fresh(), O2 = w2.OvuOrb;
  check('without the HPB table a local name changes nothing (estimates only)', O2.foodItemsFrom({ is_food: true, items: [Object.assign({}, noodles, { local_name: 'bak chor mee (dry)' })] })[0].source.kind === 'estimate');
})();

(function relayCleanerLocalName() {
  console.log('the luna relay asks for local_name, passes it through clamped, and keeps the item schema otherwise unchanged');
  var src = fs.readFileSync(path.join(root, 'supabase', 'functions', 'luna', 'index.ts'), 'utf8');
  var prompt = (src.match(/const FOOD_SYSTEM = ([\s\S]*?");\n/) || [])[1] || '';
  var itemSpec = (prompt.match(/\\"items\\":\[\{([\s\S]*?)\}\]/) || [])[1] || '';
  var promptKeys = (itemSpec.match(/\\"(\w+)\\":/g) || []).map(function (k) { return k.replace(/[\\":]/g, ''); });
  var expected = ['name', 'local_name', 'portion', 'grams', 'kcal', 'protein_g', 'carb_g', 'fat_g', 'fiber_g', 'confidence'];
  check('the photo prompt’s item keys are the old ones plus local_name, and it asks for one per item', JSON.stringify(promptKeys) === JSON.stringify(expected) && /own local_name/.test(prompt) && /never make one up/.test(prompt), JSON.stringify(promptKeys));
  check('the photo prompt has no em dashes', prompt.indexOf('—') === -1);
  var mod = require('module');
  if (typeof mod.stripTypeScriptTypes !== 'function') { console.log('  skip cleaner run: this Node has no module.stripTypeScriptTypes'); return; }
  function fnSrc(name) { var i = src.indexOf('function ' + name + '('), j = src.indexOf('{', i), d = 0; if (i < 0) return ''; for (var k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; }
  var code = mod.stripTypeScriptTypes(['num', 'str', 'cleanFood'].map(fnSrc).join('\n') + '\nresult = cleanFood(JSON.parse(raw));');
  var raw = JSON.stringify({ is_food: true, meal_name: 'Bak chor mee dry with soup', note: 'Noodles and soup.', items: [
    { name: 'dry flat noodles with minced pork', local_name: '  bak chor mee\n (dry) ', portion: 'bowl', grams: 550, kcal: 640, protein_g: 34, carb_g: 72, fat_g: 24, fiber_g: 4, confidence: 'medium', extra: 'dropped' },
    { name: 'clear savoury soup', local_name: null, portion: 'bowl', grams: 250, kcal: 45, protein_g: 3, carb_g: 3, fat_g: 2, fiber_g: 0, confidence: 'medium' },
    { name: 'a drink', local_name: new Array(101).join('x'), grams: 300, kcal: 100 },
    { name: 'tea', local_name: 7, grams: 250, kcal: 80 },
    { name: 'kopi', grams: 250, kcal: 120 }] });
  var ctx = vm.createContext({ raw: raw, result: null });
  vm.runInContext(code, ctx, { filename: 'luna-cleanFood' });
  var out = JSON.parse(JSON.stringify(ctx.result)), it = out.items;
  check('the cleaner keeps exactly the prompt’s item keys (extra fields dropped)', it.every(function (x) { return JSON.stringify(Object.keys(x)) === JSON.stringify(expected); }), JSON.stringify(Object.keys(it[0])));
  check('local_name is passed through with whitespace collapsed (bak chor mee (dry))', it[0].local_name === 'bak chor mee (dry)', JSON.stringify(it[0].local_name));
  check('a null, non-string or missing local_name becomes empty, a long one is cut to 60 characters', it[1].local_name === '' && it[3].local_name === '' && it[4].local_name === '' && it[2].local_name.length === 60, JSON.stringify(it.map(function (x) { return x.local_name.length; })));
  check('the rest of the item is unchanged (name, grams, kcal, confidence)', it[0].name === 'dry flat noodles with minced pork' && it[0].grams === 550 && it[0].kcal === 640 && it[0].confidence === 'medium' && it[2].confidence === 'low' && out.meal_name === 'Bak chor mee dry with soup', JSON.stringify(it[0]));
  var w = fresh(), O = w.OvuOrb, FD = w.OvuFood;
  FD.sgUse(JSON.parse(fs.readFileSync(path.join(root, 'assets', 'data', 'nutrients-sg-hpb.json'), 'utf8')));
  var items = O.foodItemsFrom(out);
  check('the cleaned relay output flows into foodItemsFrom: noodles via local name, soup an estimate', items[0].hpb && items[0].hpb.via === 'local name' && items[0].hpb.crId === 'F05060002' && items[1].source.kind === 'estimate', JSON.stringify(items.map(function (x) { return [x.source.kind, x.hpb && x.hpb.via]; })));
})();

(function sunTimes() {
  console.log('the window follows Singapore sunrise and sunset');
  var w = { Intl: Intl, Date: Date, Math: Math, Object: Object, String: String, Promise: Promise }; w.window = w;
  var ctx = vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-sun.js'), 'utf8'), ctx, { filename: 'ovu-sun.js' });
  var Sun = w.OvuSun, t = Sun.times(new Date(2026, 9, 18, 12), 1.3521, 103.8198);
  check('18 Oct 2026 sunrise about 6:47 am and sunset about 6:52 pm', Math.abs(t.sunrise - 407) <= 4 && Math.abs(t.sunset - 1132) <= 4, Sun.hm(t.sunrise) + ' / ' + Sun.hm(t.sunset));
  var at = function (hh, mm) { return Sun.phase(new Date(2026, 9, 18, hh, mm)); };
  check('3:28 pm is afternoon, not tonight', at(15, 28).key === 'afternoon' && at(15, 28).title === 'This afternoon', at(15, 28).title);
  check('6:30 am is sunrise, 9 am is morning', at(6, 30).key === 'sunrise' && at(9, 0).key === 'morning');
  check('5:30 pm is sunset; from 6 pm it is night (Jamie: dark from 6 pm), and 8 pm is tonight', at(17, 30).key === 'sunset' && at(18, 0).key === 'night' && at(18, 30).key === 'night' && at(20, 0).key === 'night' && at(20, 0).title === 'Tonight');
  check('2 am greets "Still up"', at(2, 0).greeting === 'Still up');
})();

(function novaScore() {
  console.log('processed-food score follows NOVA, uses Open Food Facts when present, keeps dishes separate');
  var w = fresh(), N = w.OvuNova;
  var g = function (x) { var c = N.classify(x); return c.group + (c.upfParts ? '*' : ''); };
  check('Open Food Facts NOVA wins over the name', g({ name: 'Banana chips', nova: 3 }) === '3');
  check('generic foods: banana 1, olive oil 2, cheddar 3, cola 4, white bread 4', g({ name: 'Banana', cat: 'fruit' }) === '1' && g({ name: 'Olive oil', cat: 'fats' }) === '2' && g({ name: 'Cheddar cheese', cat: 'dairy' }) === '3' && g({ name: 'Cola', cat: 'drinks' }) === '4' && g({ name: 'White bread', cat: 'grains' }) === '4');
  check('hawker: kopi freshly made, Milo 4, luncheon meat 4, plain rice 1', g({ name: 'Kopi', source: { kind: 'hpb' }, hpb: { cat: 'Coffee' } }) === 'cooked' && g({ name: 'Iced Milo', source: { kind: 'hpb' }, hpb: { cat: 'Malted and chocolate drinks' } }) === '4' && g({ name: 'Luncheon meat', source: { kind: 'hpb' }, hpb: { cat: 'Processed meats' } }) === '4' && g({ name: 'Cooked white rice', source: { kind: 'hpb' }, hpb: { cat: 'Rice' } }) === '1');
  check('dishes stay dishes; fishball noodles flagged, carrot cake not', g({ name: 'Fishball noodles (dry)', source: { kind: 'hpb' }, hpb: { cat: 'Noodle/Pasta-based dishes' } }) === 'cooked*' && g({ name: 'Fried carrot cake (black)', source: { kind: 'hpb' }, hpb: { cat: 'Grain-based dishes' } }) === 'cooked' && g({ name: 'Dry minced meat noodles (bak chor mee)', source: { kind: 'estimate' } }) === 'cooked');
  var items = [
    { name: 'Cola', cat: 'drinks', nutrients: { kcal: 140 } },
    { name: 'Banana', cat: 'fruit', nutrients: { kcal: 105 } },
    { name: 'Bak chor mee (dry)', source: { kind: 'hpb' }, hpb: { cat: 'Noodle/Pasta-based dishes' }, nutrients: { kcal: 455 } },
    { name: 'Mystery snack', nutrients: { kcal: 100 } }];
  var s = N.share(items);
  check('share is NOVA 4 over classified kcal (140 of 245), dishes and unknown left out of it', N.pct(s.upfShare) === 57 && Math.round(s.resolved) === 245 && N.pct(s.coverage) === 31, JSON.stringify([s.upfShare, s.resolved, s.coverage]));
  check('under half classified: no percentage, says why', /too little classified for a percentage/.test(N.headline(s)) && /freshly made dishes and drinks are not scored/.test(N.coverageText(s)), N.headline(s));
  var s2 = N.share([{ name: 'Banana', cat: 'fruit', nutrients: { kcal: 100 } }, { name: 'Cola', cat: 'drinks', nutrients: { kcal: null } }]);
  check('an ultra-processed item without calories never reads as none', /no calories logged, so no percentage/.test(N.headline(s2)), N.headline(s2));
  var s3 = N.share([{ name: 'Cola', cat: 'drinks', nutrients: { kcal: 1 } }, { name: 'Banana', cat: 'fruit', nutrients: { kcal: 1000 } }]);
  check('a tiny share shows as under 1%, not 0%', N.headline(s3) === 'Ultra-processed: under 1% of classified calories', N.headline(s3));
  check('Codex cases: rice crackers 4, 3-in-1 kopi 4, rice with luncheon meat freshly made and flagged, OFF nova "3.5" rejected', g({ name: 'White rice crackers', source: { kind: 'estimate' } }) === '4' && g({ name: '3-in-1 kopi', source: { kind: 'estimate' } }) === '4' && g({ name: 'Brown rice with luncheon meat', source: { kind: 'estimate' } }) === 'cooked*' && g({ name: 'x', nova: '3.5' }) === 'unknown');
  check('words only never shows a number', !/\d/.test(N.headline(s, true)) && !/\d/.test(N.headline(N.share([{ name: 'Cola', cat: 'drinks', nutrients: { kcal: 140 } }, { name: 'Banana', cat: 'fruit', nutrients: { kcal: 105 } }]), true)));
})();

(function ingredientNova() {
  console.log('NOVA from ingredient lists and popcorn names');
  var w = fresh(), N = w.OvuNova, FD = w.OvuFood;
  var g = function (x) { var c = N.classify(x); return c.group + (c.likely ? '~' : ''); };
  check('popcorn: cheese 4 likely, air-popped 1, a bare packaged popcorn 3 likely, sweet and salty 4 likely', g({ name: 'Cheese popcorn', cat: 'packaged' }) === '4~' && g({ name: 'Popcorn, air-popped', cat: 'treats' }) === '1' && g({ name: 'Popcorn · Popcorn Kitchen', cat: 'packaged' }) === '3~' && g({ name: 'Sweet & Salty Popcorn', cat: 'packaged' }) === '4~', [g({ name: 'Cheese popcorn' }), g({ name: 'Popcorn, air-popped' }), g({ name: 'Popcorn · Popcorn Kitchen' })].join());
  check('popcorn chicken is not popcorn; salted plain popcorn is processed, likely', N.classify({ name: 'Popcorn chicken', source: { kind: 'hpb' }, hpb: { cat: 'Meat dishes' } }).group !== 4 && g({ name: 'Plain popcorn with salt', cat: 'packaged' }) === '3~' && g({ name: 'Butter popcorn', cat: 'packaged' }) === '4~');
  var f1 = N.fromIngredients('Popcorn, canola oil, whey (milk), maltodextrin, cheddar and blue cheese (cultured milk, salt, and enzymes), buttermilk, salt, citric acid, lactic acid.', ['en:e270', 'en:e330']);
  check('whey plus maltodextrin make it ultra-processed; E270 and E330 do not count', f1.group === 4 && f1.markers.indexOf('whey') > -1 && f1.markers.indexOf('maltodextrin') > -1 && !/E270|E330/.test(f1.markers.join()), JSON.stringify(f1));
  var f2 = N.fromIngredients('Popcorn, Sunflower oil, Salt', []);
  check('popcorn, oil and salt is processed, likely', f2.group === 3 && f2.likely && !f2.markers.length, JSON.stringify(f2));
  check('an empty list classifies nothing', N.fromIngredients('', []) === null && N.fromIngredients(null, null) === null);
  var f3 = N.fromIngredients('Milk, salt, potassium sorbate', ['en:e202']);
  check('a preservative alone does not make group 4', f3.group === 3, JSON.stringify(f3));
  var f4 = N.fromIngredients(null, null, { '4': [['ingredients', 'en:maltodextrin'], ['additives', 'en:e471']] });
  check("Open Food Facts' own markers win and read plainly", f4.group === 4 && f4.markers.join() === 'maltodextrin,e471', JSON.stringify(f4));
  var f5 = N.fromIngredients('Sugar, glucose syrup, colour: E150a, natural flavouring, emulsifier (soy lecithin)', ['en:e150a', 'en:e322']);
  check('colours, flavourings and emulsifiers are markers, named with their E numbers, one entry per class', f5.group === 4 && /colour \(E150A\)/.test(f5.markers.join()) && /emulsifier \(E322\)/.test(f5.markers.join()) && f5.markers.indexOf('flavouring') > -1 && f5.markers.indexOf('emulsifier') < 0 && f5.markers.indexOf('colour') < 0, JSON.stringify(f5));
  check('rolled oats alone reads as whole food, likely', N.fromIngredients('Wholegrain rolled oats', []).group === 1);
  check('olive oil alone is a kitchen staple, group 2', N.fromIngredients('Extra virgin olive oil', []).group === 2 && N.fromIngredients('Sea salt', []).group === 2);
  check('text in another script or nonsense is unknown, never whole food', N.fromIngredients('爆米花, 葵花籽油, 麦芽糊精', []) === null && N.fromIngredients('zxq vbnm qwerty', []) === null);
  check('denials are not markers: non-hydrogenated oil and lactose-free milk', N.fromIngredients('Milk, non-hydrogenated vegetable oil', []).group === 3 && N.fromIngredients('Lactose-free milk', []).group === 1 && N.fromIngredients('Oats, no added colours or flavours', []).group === 1);
  check('gluten, glucose syrup, spaced and suffixed E numbers are markers', N.fromIngredients('Wheat flour, vital wheat gluten', []).markers.indexOf('added gluten') > -1 && N.fromIngredients('Sugar, glucose syrup', []).group === 4 && /E471/.test(N.fromIngredients('Flour, emulsifier E 471', []).markers.join()) && /colour \(E160E\)/.test(N.fromIngredients('Milk, E160e', []).markers.join()));
  check('a long list keeps its last ingredient on the saved item, so the group cannot flip', (function () { var long = 'Water, ' + new Array(60).join('rice flour, ') + 'maltodextrin'; var f = FD.offToFood({ code: '7', product_name: 'Long', nutriments: {}, ingredients_text: long }); var it = FD.makeItem(f, null, 50); return long.length > 400 && it.ingredients.text === long && N.classify(it).group === 4 && it.ingredients.rule === 'ingredients-v1'; })());
  check("Open Food Facts group 2 markers give a kitchen staple", N.fromIngredients(null, null, { '2': [['categories', 'en:oils']] }).group === 2);
  check('a numeric Open Food Facts group still wins over everything', g({ name: 'Cheese popcorn', nova: 1, ingredients: { text: 'Sugar, flavouring', source: 'off' } }) === '1');
  var c1 = N.classify({ name: 'Mystery snack', ingredients: { text: 'Sugar, flavouring', source: 'off' } });
  check('an ingredient list beats the name rules and says where it came from', c1.group === 4 && c1.basis === 'ingredients' && /ingredient list on Open Food Facts/.test(N.basisText(c1)) && /flavouring/.test(N.basisText(c1)), N.basisText(c1));
  var c2 = N.classify({ name: 'Mystery snack', ingredients: { text: 'Milk', source: 'label-photo' } });
  check('a photographed label is labelled as such', c2.group === 1 && c2.basis === 'label' && /photographed/.test(N.basisText(c2)), N.basisText(c2));
  var food = FD.offToFood({ code: '5', product_name: 'Popcorn', brands: 'Kitchen', nutriments: {}, ingredients_text: 'Popcorn, salt', additives_tags: ['en:e202'] });
  check('offToFood carries the ingredient list and tags, and makeItem keeps them', food.ingredients && food.ingredients.text === 'Popcorn, salt' && food.ingredients.additives.join() === 'e202' && FD.makeItem(food, null, 30).ingredients.text === 'Popcorn, salt' && N.classify(FD.makeItem(food, null, 30)).group === 3);
  check('a record with no ingredient fields carries none', FD.offToFood({ code: '6', product_name: 'Popcorn', nutriments: {} }).ingredients === null);
})();

(function underSixteenSafeguard() {
  console.log('under-16s who mention a possible pregnancy get support contacts');
  var w = fresh(), O = w.OvuOrb;
  check('no under-18 safeguarding card remains: Rhythme is 18+, a possible pregnancy is not an emergency on its own', O.urgent('I think I might be pregnant', { ageRange: '25-29' }) === null && O.urgent('my period is late and the condom broke', { ageBand: '13-16' }) === null);
  check('pregnancy with bleeding is still an emergency first', (O.urgent('I am pregnant and bleeding', {}) || {}).level === 'emergency');
})();

(function noStressPets() {
  console.log('pet care never stresses: needs floor, one gentle poop per meal, capped hearts');
  var w = fresh(), P = w.OvuPets, RW = w.OvuRewards, t0 = Date.parse('2026-10-18T09:00:00Z'), H = 3600000;
  var p0 = P.current('mewmew', t0);
  check('a new pet starts content', p0.full === 70 && p0.fun === 70 && p0.poops.length === 0);
  P.tick('mewmew', t0);
  var later = P.current('mewmew', t0 + 72 * H);
  check('three days away: needs rest at the floor, never empty', later.full === P.FLOOR && later.fun === P.FLOOR, JSON.stringify([later.full, later.fun]));
  var f = P.feed('mewmew', t0 + 73 * H);
  check('feeding fills her up; feeding again right away is a gentle no', f.ok && f.pet.full === 100 && !P.feed('mewmew', t0 + 73 * H + 60000).ok);
  check('no poop before 90 minutes', P.current('mewmew', t0 + 73 * H + 80 * 60000).poops.length === 0);
  var pp = P.tick('mewmew', t0 + 73 * H + 95 * 60000);
  check('one poop about 90 minutes after the meal, and only one for that meal', pp.poops.length === 1 && P.tick('mewmew', t0 + 76 * H).poops.length === 1);
  P.feed('mewmew', t0 + 80 * H); P.tick('mewmew', t0 + 82 * H); P.feed('mewmew', t0 + 90 * H); var many = P.tick('mewmew', t0 + 92 * H);
  check('never more than two waiting', many.poops.length === 2, many.poops.length);
  var c = P.clean('mewmew', many.poops[0].id, t0 + 92 * H);
  check('tapping a poop tidies exactly that one', c.ok && c.pet.poops.length === 1);
  var texts = ['cat', 'dog', 'mewmew'].map(function (id) { return P.mood(id, { t: t0 + 200 * H }).text + ' ' + P.mood(id, { night: true, t: t0 }).text; }).join(' ');
  check('moods are kind: no hungry, sad, sick or starving', !/hungry|sad|sick|starv|dying|neglect|lonely/i.test(texts), texts);
  var got = 0; for (var i = 0; i < 12; i++) got += RW.care('mewmew', 'feed').points;
  check('pet care earns no hearts: kindness is not play money', got === 0 && RW.care('dog', 'play').points === 0, got);
})();

(function rememberedPeriods() {
  console.log('remembered period starts: kept apart from logs, conservative windows (Codex acceptance table)');
  var w = fresh('2026-03-01'), S = w.OvuStore, R = S.rhythmFromRecall;
  function rc(days, extra) { var o = { version: 1, status: 'entered', starts: days.map(function (d, i) { return /^\d{4}-\d{2}$/.test(d) ? { id: 'r' + i, precision: 'month', month: d } : { id: 'r' + i, precision: 'day', date: d }; }) }; Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; }); return o; }
  var e = R(rc([]), '2026-03-01');
  check('empty: no gaps and no window', !e.ok && e.gaps.length === 0 && e.median === null);
  var one = R(rc(['2026-01-01'], { latest: 'yes' }), '2026-01-10');
  check('one start: day anchor only, no window', !one.ok && one.latest === '2026-01-01' && one.reason === 'few');
  var two = R(rc(['2026-01-01', '2026-01-29'], { latest: 'yes' }), '2026-02-05');
  check('Jan 1 and Jan 29: one gap of 28, still no window', two.gaps.join() === '28' && !two.ok);
  var three = R(rc(['2026-01-01', '2026-01-29', '2026-02-26'], { latest: 'yes', complete: 'yes' }), '2026-02-26');
  check('three starts 28 days apart: median 28 and a window', three.ok && three.median === 28 && three.min === 28 && three.max === 28, JSON.stringify(three));
  var unk = R(rc(['2026-01-01', '2026-01-29', '2026-02-26'], { latest: 'yes', complete: 'unsure' }), '2026-02-26');
  check('short gaps still count when completeness is unsure', unk.ok);
  var longUnsure = R(rc(['2026-01-01', '2026-02-20', '2026-04-11'], { latest: 'yes', complete: 'unsure' }), '2026-04-12');
  check('50-day gaps do not count unless none are missing', !longUnsure.ok && longUnsure.adjacent.length === 0);
  var approx = R(rc(['2026-01-01', '2026-02', '2026-03-01'], { latest: 'yes', complete: 'yes' }), '2026-03-02');
  check('an approximate February breaks the chain, never bridged', approx.adjacent.length === 0 && !approx.ok && approx.approx.join() === '2026-02');
  var cluster = R(rc(['2026-01-01', '2026-01-10', '2026-02-07'], { latest: 'yes' }), '2026-02-08');
  check('starts 9 days apart stay unresolved and hold the window', cluster.gaps.join() === '9,28' && cluster.reason === 'cluster' && !cluster.ok);
  var merged = R(rc(['2026-01-01', '2026-01-10', '2026-01-29', '2026-02-26'], { latest: 'yes', clusters: { '2026-01-01|2026-01-10': 'one' } }), '2026-02-27');
  check('one bleed that restarted is counted once', merged.exact.join() === '2026-01-01,2026-01-29,2026-02-26' && merged.ok);
  var gap91 = R(rc(['2026-01-01', '2026-04-02'], { latest: 'yes', complete: 'yes' }), '2026-04-03');
  check('a confirmed 91-day gap is adjacent but gives no window', gap91.adjacent.length === 1 && gap91.adjacent[0].gap === 91 && !gap91.ok);
  var future = R(rc(['2026-01-01', '2026-05-01'], { latest: 'yes' }), '2026-02-01');
  check('future dates are ignored', future.exact.join() === '2026-01-01');
  var old = R(rc(['2025-10-01', '2025-10-29', '2025-11-26'], { latest: 'yes', complete: 'yes' }), '2026-03-01');
  check('a latest start over 60 days ago pauses the window', old.reason === 'latest-old' && !old.ok);
  var w2 = fresh('2026-03-05'), S2 = w2.OvuStore;
  S2.setProfile({ predictionMode: 'normal', periodRecall: rc(['2026-01-01', '2026-01-29', '2026-02-26'], { latest: 'yes', complete: 'yes' }) });
  var cs = S2.cycleStats('2026-03-05');
  check('cycleStats: remembered dates give day 8, a wide window and no phase', cs.cycleDay === 8 && cs.mode === 'wide' && cs.predictedFrom === '2026-03-22' && cs.predictedTo === '2026-03-30' && cs.phase === null, JSON.stringify({ d: cs.cycleDay, m: cs.mode, f: cs.predictedFrom, t: cs.predictedTo, p: cs.phase }));
  check('remembered dates create no period entries or hearts', S2.list('period').length === 0 && !((S2.state().rewards || {}).hearts));
})();

(function weighingScale() {
  console.log('weighing scale: 5 hearts, one note a day, never rewarded');
  var w = fresh(), S = w.OvuStore, RW = w.OvuRewards, today = S.today();
  RW.grant(20, 'welcome'); RW.buy('scale');
  check('the scale is free: weigh-ins are a health feature (Codex review, 20 Oct)', RW.ledger().hearts === 20 && RW.ledger().owned.indexOf('scale') > -1);
  var ev = S.add('weight', today, { kg: 54.3 }, 'scale'); var aw = RW.award(ev);
  S.add('weight', today, { kg: 54.1 }, 'scale');
  check('a weigh-in earns no hearts and no streak bonus', aw.points === 0 && RW.ledger().hearts === 20);
  check('one weight note per day, the latest wins', S.list('weight').length === 1 && S.list('weight')[0].data.kg === 54.1);
})();

(function petOptions() {
  console.log('pet options: kittens and puppies swap within their slot, Mewmew stays');
  var w = fresh(), RW = w.OvuRewards, P = w.OvuPets;
  RW.grant(2000, 'welcome'); RW.buy('cat'); RW.buy('dog'); RW.buy('mewmew'); RW.buy('catblack');
  var l = RW.ledger();
  check('buying Sesame puts Mochi away and keeps the puppy; Mewmew, adopted third, waits in the inventory (two pets at home)', l.placed.catblack && !l.placed.cat && l.placed.dog && !l.placed.mewmew && l.owned.indexOf('mewmew') > -1, JSON.stringify(l.placed));
  RW.buy('shiba'); RW.toggle('cat'); l = RW.ledger();
  check('Hana swaps with Peach, and bringing Mochi back puts Sesame away', l.placed.shiba && !l.placed.dog && l.placed.cat && !l.placed.catblack, JSON.stringify(l.placed));
  var opts = RW.SHOP.filter(function (s) { return s.slot === 'cat'; }).map(function (s) { return s.id; });
  check('three kittens and two puppies to choose from, all named', opts.join() === 'cat,catblack,catginger' && RW.SHOP.filter(function (s) { return s.slot === 'dog'; }).length === 2 && ['catblack', 'catginger', 'shiba', 'dog'].every(function (id) { return !!P.NAMES[id]; }));
  var w2 = fresh(), RW2 = w2.OvuRewards, S2 = w2.OvuStore;
  RW2.grant(400, 'welcome'); RW2.buy('cat'); var l2 = RW2.ledger(); l2.owned.push('catgrey'); l2.placed.catgrey = true; l2.placed.cat = false; S2.setState({ rewards: l2 });
  var l3 = RW2.ledger();
  check('a removed kitten is refunded once and Mochi comes back out', l3.owned.indexOf('catgrey') < 0 && l3.hearts === 400 && l3.placed.cat && RW2.ledger().hearts === 400, JSON.stringify({ h: l3.hearts, p: l3.placed }));
  check('new pets borrow the original pet spot', RW.SHOP.filter(function (s) { return s.posAs; }).every(function (s) { return s.posAs === 'cat' || s.posAs === 'dog'; }));
})();

(function cycleBasisWording() {
  console.log('cycle basis: never claims a 28-day default');
  var w = fresh('2026-10-18'), S = w.OvuStore;
  S.add('period', '2026-10-17', { flow: 'medium' }, 'test');
  var cs = S.cycleStats('2026-10-18');
  check('one period day, no length: basis says no cycle length yet, phase stays unknown', cs.basis === 'no cycle length yet' && cs.averageLength === null && cs.phase === null && cs.cycleDay === 2, JSON.stringify({ b: cs.basis, a: cs.averageLength, p: cs.phase, d: cs.cycleDay }));
  S.setProfile({ cycleLength: 30 });
  check('a stated length is named as the profile setting', S.cycleStats('2026-10-18').basis === 'your profile setting');
})();

(function cycleGapsAreBreaks() {
  console.log('cycle gaps: a gap of over 60 days between logged periods is a break, not a cycle');
  function periods(S, starts, source) { starts.forEach(function (st) { for (var i = 0; i < 4; i++) S.add('period', addDays(st, i), { flow: 'medium' }, source || 'test'); }); }
  /* the reproduced case (19 Oct 2026): one imported day in June 2025, a period logged yesterday */
  var w = fresh('2026-10-19'), S = w.OvuStore, A = w.OvuAgents;
  S.add('period', '2025-06-04', { flow: 'medium' }, 'apple-health');
  S.add('period', '2026-10-18', { flow: 'medium' }, 'room');
  var cs = S.cycleStats('2026-10-19');
  check('an old imported period plus a recent one gives no 500-day prediction', cs.predictedFrom === null && cs.predictedTo === null && cs.predictedNext === null && cs.averageLength === null && cs.lengths.length === 0, JSON.stringify({ f: cs.predictedFrom, t: cs.predictedTo, a: cs.averageLength, l: cs.lengths }));
  check('the 501-day gap is kept as a break and named for the calendar', cs.breaks.length === 1 && cs.breaks[0].days === 501 && cs.gapLeftOut && cs.gapLeftOut.to === '2026-10-18' && cs.cycles.length === 1 && cs.cycles[0].counted === false, JSON.stringify({ b: cs.breaks, g: cs.gapLeftOut }));
  check('the day count still runs from the recent period and the phase stays unknown', cs.lastStart === '2026-10-18' && cs.cycleDay === 2 && cs.phase === null && cs.basis === 'no cycle length yet', JSON.stringify({ s: cs.lastStart, d: cs.cycleDay, p: cs.phase, b: cs.basis }));
  var fl = A.allFlags('2026-10-19'), codes = fl.map(function (f) { return f.code; }), gapFlag = fl.filter(function (f) { return f.code === 'GAP_LONG'; })[0];
  check('the agent names a gap, not a 501-day cycle, as an info note', gapFlag && gapFlag.level === 'info' && /gap of 501 days/.test(gapFlag.title) && gapFlag.date === '2026-10-18' && codes.indexOf('CYCLE_LONG') < 0, JSON.stringify(fl));
  var sum = A.fourWeekSummary('2026-10-19');
  check('the clinician summary lists no 501-day cycle length and asks about the gap', sum.cycle.cycleLengths.length === 0 && sum.cycle.averageLength === null && sum.questions.some(function (q) { return /more than 60 days/.test(q); }), JSON.stringify({ l: sum.cycle.cycleLengths, q: sum.questions }));
  S.setProfile({ cycleLength: 30 });
  var cp = S.cycleStats('2026-10-19');
  check('after a break a stated profile length still predicts from the recent period', cp.basis === 'your profile setting' && cp.predictedFrom === '2026-11-15' && cp.predictedTo === '2026-11-19' && cp.gapLeftOut && cp.gapLeftOut.days === 501, JSON.stringify({ b: cp.basis, f: cp.predictedFrom, t: cp.predictedTo }));

  /* normal consecutive cycles give the same numbers as before */
  var w2 = fresh('2026-09-25'), S2 = w2.OvuStore, A2 = w2.OvuAgents; /* entry dates stay on or before the real clock: add() refuses the future */
  periods(S2, ['2026-06-01', '2026-06-29', '2026-07-28', '2026-08-25', '2026-09-22']);
  var n = S2.cycleStats('2026-09-25');
  check('consecutive cycles are unchanged: lengths, average, window, phase', n.lengths.join() === '28,29,28,28' && n.averageLength === 28 && n.predictedFrom === '2026-10-19' && n.predictedTo === '2026-10-22' && n.predictedNext === '2026-10-20' && n.phase === 'menstrual' && n.basis === '4 logged cycles', JSON.stringify({ l: n.lengths, a: n.averageLength, f: n.predictedFrom, t: n.predictedTo, x: n.predictedNext, p: n.phase, b: n.basis }));
  check('consecutive cycles have no break and no gap note', n.breaks.length === 0 && n.gapLeftOut === null && n.cycles.every(function (c) { return c.counted; }));
  check('consecutive typical cycles raise no cycle note', A2.allFlags('2026-09-25').filter(function (f) { return /^(CYCLE_|GAP_)/.test(f.code); }).length === 0);

  /* cycles since a break set the estimate; the ones before it do not */
  var w3 = fresh('2026-10-05'), S3 = w3.OvuStore;
  periods(S3, ['2025-01-01', '2025-01-23', '2025-02-14', '2026-08-01', '2026-08-31', '2026-09-30']);
  var b = S3.cycleStats('2026-10-05');
  check('only the cycles since the break count', b.lengths.join() === '30,30' && b.averageLength === 30 && b.basis === '2 logged cycles' && b.cycles.length === 5 && b.breaks.length === 1, JSON.stringify({ l: b.lengths, a: b.averageLength, c: b.cycles }));
  check('the window comes from the cycles since the break', b.predictedFrom === '2026-10-29' && b.predictedTo === '2026-10-31' && b.gapLeftOut && b.gapLeftOut.to === '2026-08-01', JSON.stringify({ f: b.predictedFrom, t: b.predictedTo, g: b.gapLeftOut }));
  S3.setProfile({ predictionMode: 'wide' });
  var bw = S3.cycleStats('2026-10-05');
  check('wide mode still widens after a break', bw.predictedFrom === '2026-10-26' && bw.predictedTo === '2026-11-03', JSON.stringify([bw.predictedFrom, bw.predictedTo]));
  S3.setProfile({ predictionMode: 'suspended' });
  var bs = S3.cycleStats('2026-10-05');
  check('suspended mode still predicts nothing after a break', bs.predictedFrom === null && bs.phase === null);

  /* the boundary: 60 days is a cycle, 61 is a break; 45 is still a long cycle */
  var w4 = fresh('2026-05-10'), S4 = w4.OvuStore;
  periods(S4, ['2026-01-01', '2026-03-02', '2026-05-02']);
  var e = S4.cycleStats('2026-05-10');
  check('a 60-day gap is a cycle and a 61-day gap is a break', e.cycles.map(function (c) { return c.days + (c.counted ? 'c' : 'b'); }).join() === '60c,61b' && e.lengths.length === 0, JSON.stringify(e.cycles));
  var w5 = fresh('2026-09-20'), S5 = w5.OvuStore, A5 = w5.OvuAgents;
  periods(S5, ['2026-07-01', '2026-08-15', '2026-09-12']);
  var lc = S5.cycleStats('2026-09-20'), lf = A5.allFlags('2026-09-20');
  check('a 45-day cycle still counts and is still flagged long', lc.lengths.join() === '45,28' && lc.breaks.length === 0 && lf.some(function (f) { return f.code === 'CYCLE_LONG' && f.date === '2026-08-15' && f.level === 'watch'; }) && !lf.some(function (f) { return f.code === 'GAP_LONG'; }), JSON.stringify({ l: lc.lengths, f: lf.map(function (f) { return f.code + '@' + f.date; }) }));
  var w6 = fresh('2026-08-01'), S6 = w6.OvuStore, A6 = w6.OvuAgents;
  periods(S6, ['2026-01-01', '2026-06-01']);
  check('an open gap of over 45 days after a break is still noted as late', A6.allFlags('2026-08-01').some(function (f) { return f.code === 'PERIOD_LATE'; }));
  var e60 = w4.OvuAgents.allFlags('2026-05-10');
  check('the 60-day cycle is flagged long on its own date and the 61-day gap is a gap', e60.some(function (f) { return f.code === 'CYCLE_LONG' && f.date === '2026-03-02' && /60 days/.test(f.title); }) && e60.some(function (f) { return f.code === 'GAP_LONG' && f.date === '2026-05-02'; }), JSON.stringify(e60.map(function (f) { return f.code + '@' + f.date; })));

  /* three breaks, then five and six cycles: the note names the latest break and goes once six cycles follow it */
  var w7 = fresh('2026-10-19'), S7 = w7.OvuStore;
  var five = ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24', '2026-08-21', '2026-09-18'];
  periods(S7, ['2024-01-01', '2024-01-29', '2024-08-01', '2025-03-01'].concat(five));
  var t5 = S7.cycleStats('2026-09-20');
  check('three breaks then five cycles: the note names the latest break and every gap stays in cycles', t5.breaks.length === 3 && t5.cycles.length === 9 && t5.lengths.length === 5 && t5.gapLeftOut && t5.gapLeftOut.to === '2026-05-01' && t5.gapLeftOut.cyclesBefore === 1, JSON.stringify({ b: t5.breaks.length, c: t5.cycles.length, l: t5.lengths, g: t5.gapLeftOut }));
  periods(S7, ['2026-10-16']);
  var t6 = S7.cycleStats('2026-10-19');
  check('six cycles after the latest break: no note, the estimate is what it always was', t6.lengths.length === 6 && t6.gapLeftOut === null && t6.basis === '6 logged cycles' && t6.averageLength === 28, JSON.stringify({ l: t6.lengths, g: t6.gapLeftOut, b: t6.basis }));

  /* one logged cycle plus valid remembered dates: the window and the words both come from the remembered dates */
  var w8 = fresh('2026-10-19'), S8 = w8.OvuStore;
  S8.add('period', '2025-06-04', { flow: 'medium' }, 'apple-health'); S8.add('period', '2026-09-11', { flow: 'medium' }, 'room'); S8.add('period', '2026-10-18', { flow: 'medium' }, 'room');
  S8.setProfile({ predictionMode: 'normal', periodRecall: { starts: ['2026-07-07', '2026-08-04', '2026-09-01'].map(function (d) { return { precision: 'day', date: d }; }), latest: 'yes', complete: 'yes' } });
  var rc8 = S8.cycleStats('2026-10-19');
  check('when remembered dates set the estimate the basis says so, not "1 logged cycle"', rc8.lengths.join() === '37' && rc8.fromRecall && rc8.averageLength === 28 && rc8.basis === 'remembered period dates' && rc8.predictedFrom === '2026-11-11' && rc8.predictedTo === '2026-11-19' && rc8.gapLeftOut && rc8.gapLeftOut.cyclesBefore === 0, JSON.stringify({ l: rc8.lengths, r: rc8.fromRecall, a: rc8.averageLength, b: rc8.basis, f: rc8.predictedFrom, t: rc8.predictedTo }));

  /* readings written from the old numbers: four-week ones (they go to clinicians) are withheld, daily ones ask to be
   * updated; nothing calls the relay by itself */
  w.OVU_CONFIG = Object.assign({}, w.OVU_CONFIG, { aiPaused: false }); /* these exercise the AI choices; the launch pause has its own checks */
  ['ovu-consent.js', 'ovu-auth.js', 'ovu-insight.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var I = w.OvuInsight, es = S.list(null, { from: '2026-09-22', to: '2026-10-19' });
  var oldSig = es.length + ':' + es.map(function (e) { return (e.updatedAt || e.createdAt || '').slice(0, 19); }).sort().slice(-1)[0];
  S.setState({ insights: { daily: { '2026-10-19': { date: '2026-10-19', sig: oldSig, summary: 'Day 2.' } }, fourweeks: { '2026-10-19': { end: '2026-10-19', sig: oldSig, clinician: { cycle: 'A 501-day cycle.' } } } } });
  check('a four-week reading from the old rules is withheld from the journal, shares and PDFs, and asks to be written again', I.cachedFourWeeks('2026-10-19') === null && I.stale('fourweeks', '2026-10-19') === true && A.fourWeekSummary('2026-10-19').cycle.cycleLengths.length === 0);
  check('a daily reading from the old rules stays readable and asks to be updated', I.cachedDaily('2026-10-19').summary === 'Day 2.' && I.stale('daily', '2026-10-19') === true);
  var st = S.state().insights; st.fourweeks['2026-10-19'].sig = 'r2|' + oldSig; st.fourweeks['2026-10-19'].rules = 'r2'; S.setState({ insights: st });
  check('a four-week reading written under the current rules is shown and is not stale', I.cachedFourWeeks('2026-10-19').clinician.cycle === 'A 501-day cycle.' && I.stale('fourweeks', '2026-10-19') === false);
  var pageSrc = ['journal.html', 'doctor.html', 'ovu-agents.js', 'room.js'].map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }).join('\n');
  check('pages reach four-week readings only through cachedFourWeeks, which applies the rules check, and shares and PDFs also drop a stale one', !/insights\.fourweeks|\.fourweeks\[/.test(pageSrc) && /var ins=I\.cachedFourWeeks\(end\);return ins&&!\(I\.stale&&I\.stale\('fourweeks',end\)\)\?ins:null;/.test(pageSrc) && /insight:freshFourWeeks\(end\)/.test(pageSrc) && /ins=freshFourWeeks\(end\)/.test(pageSrc));
  var sum6 = S2.cycleStats('2026-09-25'); periods(S2, ['2026-05-04', '2026-04-06']);
  var cs8 = S2.cycleStats('2026-09-25'), sm8 = A2.fourWeekSummary('2026-09-25');
  check('the clinician summary lists exactly the cycles the average used', cs8.lengths.length === 6 && sm8.cycle.cycleLengths.join() === cs8.lengths.join() && sm8.cycle.averageLength === cs8.averageLength && sm8.cycle.basis === '6 logged cycles' && sum6.lengths.length === 4, JSON.stringify({ l: cs8.lengths, s: sm8.cycle.cycleLengths, b: sm8.cycle.basis }));
})();

(function pdfWriter() {
  console.log('PDF writer: valid structure, page breaks, WinAnsi text, no dependency');
  var w = fresh(), P = w.OvuPdf, blocks = [{ t: 'h1', text: 'Rhythme summary for your clinician' }, { t: 'kv', label: 'Logged', text: '2 of 28 days' }, { t: 'li', text: 'A question with (parentheses) and a back\\slash' }];
  for (var i = 0; i < 80; i++) blocks.push({ t: 'p', text: 'Filler paragraph ' + i + ' that is long enough to wrap onto a second line when set in ten and a half point Helvetica on an A4 page.' });
  var m = P.make({ title: 'T', footer: 'Rhythme', blocks: blocks });
  var sx = Number((m.text.match(/startxref\n(\d+)/) || [])[1]);
  check('starts with %PDF-1.4 and the xref offset is exact', m.text.indexOf('%PDF-1.4') === 0 && m.text.slice(sx, sx + 4) === 'xref', JSON.stringify({ sx: sx, at: m.text.slice(sx, sx + 4) }));
  check('long content breaks onto several pages with a Page n of N footer', m.pages >= 3 && m.text.indexOf('Page 1 of ' + m.pages) > -1 && m.text.indexOf('/Count ' + m.pages) > -1, m.pages);
  check('parentheses and backslashes are escaped in strings', m.text.indexOf('\\(parentheses\\)') > -1 && m.text.indexOf('back\\\\slash') > -1);
  check('curly quotes and en dashes map to WinAnsi bytes, unknown glyphs become ?', P.toWin('it\u2019s \u2013 ok \u4e2d') === 'it\x92s \x96 ok ?');
  check('wrapping respects the measured width', P.wrap('one two three four five six seven eight nine ten', 10.5, false, 120).length >= 2 && P.wrap('short', 10.5, false, 300).length === 1);
})();

(function productGroups() {
  console.log('packaged search: one row per product, one chip per pack size');
  var w = fresh(), FD = w.OvuFood;
  var list = [{ code: '1', name: 'Nutella', brands: 'Nutella', quantity: '', image: null }, { code: '2', name: 'Nutella', brands: 'Nutella', quantity: '350 g', image: 'a.jpg', nova: 4, complete: 0.9, scans: 900 },
    { code: '3', name: 'nutella', brands: 'Nutella', quantity: '350g', image: null }, { code: '4', name: 'Nutella', brands: 'Nutella, Ferrero', quantity: '0.75 kg', image: 'b.jpg', sg: true }, { code: '5', name: 'Nutella B-ready', brands: 'Ferrero', quantity: '22 g' }];
  var g = FD.groupProducts(list), nut = g.filter(function (x) { return x.name.toLowerCase() === 'nutella'; })[0];
  check('four Nutella jars become one row', g.length === 2 && nut && nut.count === 4, JSON.stringify(g.map(function (x) { return [x.name, x.count]; })));
  check('pack sizes are merged and sorted, unlisted last', nut.sizes.map(function (z) { return z.label; }).join() === '350 g,750 g,size not listed', JSON.stringify(nut.sizes));
  check('the Singapore jar is the main pick and the row has a picture', nut.best.code === '4' && nut.sg && !!nut.image);
})();

(function todayBullets() {
  console.log('Today card: one bullet per topic, nothing for topics not logged');
  var w = fresh(), S = w.OvuStore, A = w.OvuAgents, today = S.today();
  S.add('sleep', today, { bedTime: '23:00', wakeTime: '07:00', quality: 4, notes: '' });
  var d = A.dailySummary(today);
  check('sleep gives one bullet with the bed icon', d.items.length >= 1 && d.items[0].icon === 'bedtime');
  check('no reflection or meal bullets when none were logged', !d.items.some(function (it) { return /reflection|meal/.test(it.text); }), JSON.stringify(d.items));
})();

(function cloudSyncMergeRules() {
  console.log('cloud sync: last write wins, tombstones, and nothing syncs without cloud consent');
  var w = fresh(), SY = w.OvuSync;
  // the gate: nothing ever syncs without a recorded cloud consent (profile.cloud)
  check('consentOk is false without profile.cloud', SY.consentOk({}) === false && SY.consentOk({ cloud: {} }) === false && SY.consentOk({ cloud: { v: 1 } }) === false);
  check('consentOk is true only with cloud {v>=1, at}', SY.consentOk({ cloud: { v: 1, at: '2026-10-19T00:00:00Z' } }) === true);

  var ev = function (id, t, data) { return { id: id, type: 'symptom', date: '2026-10-18', data: data || { symptoms: ['cramps'] }, createdAt: t, updatedAt: t, source: 'room' }; };
  var row = function (id, t, deleted, data) { return { id: id, type: 'symptom', date: '2026-10-18', data: data || { symptoms: ['cramps'] }, source: 'cloud', created_at: t, updated_at: t, deleted: !!deleted, deleted_at: deleted ? t : null }; };
  var SYNCED = '2026-10-18T00:00:00Z';

  var p = SY.merge([ev('a', '2026-10-18T01:00:00Z')], {}, [row('a', '2026-10-18T05:00:00Z', false, { symptoms: ['bloating'] })], SYNCED);
  check('remote edit newer than local wins: apply remote, push nothing', p.applyPut.length === 1 && p.applyPut[0].id === 'a' && p.pushUp.length === 0, JSON.stringify(p));

  p = SY.merge([ev('a', '2026-10-18T09:00:00Z')], {}, [row('a', '2026-10-18T05:00:00Z')], SYNCED);
  check('local edit newer than remote wins: push local, apply nothing', p.pushUp.length === 1 && p.pushUp[0].id === 'a' && p.applyPut.length === 0, JSON.stringify(p));

  p = SY.merge([ev('a', '2026-10-18T01:00:00Z')], {}, [row('a', '2026-10-18T06:00:00Z', true)], SYNCED);
  check('a newer remote tombstone deletes the local entry', p.applyDel.length === 1 && p.applyDel[0] === 'a' && p.applyPut.length === 0, JSON.stringify(p));

  p = SY.merge([], { a: '2026-10-19T00:00:00Z' }, [row('a', '2026-10-18T06:00:00Z', false)], SYNCED);
  check('a newer local deletion is pushed as a tombstone, not resurrected', p.pushDel.length === 1 && p.pushDel[0].id === 'a' && p.applyPut.length === 0, JSON.stringify(p));

  p = SY.merge([], { a: '2026-10-18T01:00:00Z' }, [row('a', '2026-10-18T06:00:00Z', false)], SYNCED);
  check('a remote edit after an older local deletion wins and restores', p.applyPut.length === 1 && p.applyPut[0].id === 'a' && p.pushDel.length === 0, JSON.stringify(p));

  p = SY.merge([ev('a', '2026-10-17T00:00:00Z')], {}, [], SYNCED);
  check('an entry already synced (older than the watermark) is not pushed again', p.pushUp.length === 0 && p.applyPut.length === 0, JSON.stringify(p));

  p = SY.merge([ev('b', '2026-10-18T09:00:00Z')], {}, [], SYNCED);
  check('a new local entry since the watermark is pushed', p.pushUp.length === 1 && p.pushUp[0].id === 'b', JSON.stringify(p));

  p = SY.merge([], {}, [row('c', '2026-10-18T03:00:00Z')], '');
  check('first sign-in on a new phone restores a cloud-only entry', p.applyPut.length === 1 && p.applyPut[0].id === 'c', JSON.stringify(p));

  var cleaned = SY.stripThumbs({ foods: 'toast', photo: 'data:image/jpeg;base64,AAAA', items: [{ name: 'egg', thumb: 'data:image/png;base64,BBBB' }], note: 'data:image/webp;base64,CCCC', meal: 'lunch' });
  check('thumbnails never upload: photo keys dropped and inline images blanked', !('photo' in cleaned) && cleaned.items[0].thumb === undefined && cleaned.note === '' && cleaned.foods === 'toast' && cleaned.meal === 'lunch', JSON.stringify(cleaned));

  var rowOut = SY.evToRow({ id: 'x', type: 'food', date: '2026-10-18', data: { foods: 'rice', photo: 'data:image/jpeg;base64,DDDD' }, createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' }, 'u1');
  check('evToRow carries the user id and strips the photo before upload', rowOut.user_id === 'u1' && rowOut.deleted === false && !('photo' in rowOut.data) && rowOut.data.foods === 'rice', JSON.stringify(rowOut));
})();

/* ---------- Movement: exercise entries, MET-minutes and the week against WHO (ovu-exercise.js) ---------- */
(function exerciseTable() {
  console.log('movement: the activity table is the 2024 Compendium, with WHO intensity bands');
  var w = fresh(), EX = w.OvuExercise, ids = {}, codes = {}, okRows = true, bad = [];
  EX.ACTIVITIES.forEach(function (a) {
    if (ids[a.id]) bad.push('dup activity ' + a.id); ids[a.id] = 1;
    var vids = {};
    a.variants.forEach(function (v) {
      if (vids[v.id]) bad.push('dup variant ' + a.id + '.' + v.id); vids[v.id] = 1;
      if (a.id === 'other') { if (v.met !== null || v.code !== null || !v.effort) bad.push('other must have no MET ' + v.id); return; }
      if (!/^\d{5}$/.test(v.code) || !(v.met > 0 && v.met < 25)) bad.push(a.id + '.' + v.id + ' code/met ' + v.code + '/' + v.met);
      if (codes[v.code] && codes[v.code] !== v.met) bad.push('code ' + v.code + ' with two METs'); codes[v.code] = v.met;
    });
  });
  check('every activity and variant is unique and carries a 5-digit Compendium code and a MET', !bad.length, bad.join('; '));
  /* spot values read from pacompendium.com on 19 Oct 2026 (2024 Adult Compendium) */
  var spot = { '17200': 4.8, '02185': 2.7, '02105': 2.8, '02150': 2.3, '12020': 7.5, '15030': 5.5, '02214': 11.0, '18240': 5.8, '01010': 4.0, '02054': 3.5 };
  check('spot-checked MET values match the 2024 Compendium', Object.keys(spot).every(function (c) { return codes[c] === spot[c]; }), JSON.stringify(Object.keys(spot).map(function (c) { return c + '=' + codes[c]; })));
  check('WHO absolute bands: under 3 light, 3 to under 6 moderate, 6 and over vigorous', EX.intensityOf(2.9) === 'light' && EX.intensityOf(3) === 'moderate' && EX.intensityOf(5.9) === 'moderate' && EX.intensityOf(6) === 'vigorous' && EX.intensityOf(null, 'moderate') === 'moderate' && EX.intensityOf(null) === null);
  check('WHO targets are 150 to 300 moderate minutes and 2 strength days', EX.WHO.moderateMin === 150 && EX.WHO.moderateMax === 300 && EX.WHO.strengthDays === 2);
})();

(function exerciseEntries() {
  console.log('movement: an entry is built only from a real choice, and copies its MET');
  var w = fresh(), EX = w.OvuExercise, S = w.OvuStore, today = S.today();
  var threw = function (fn) { try { fn(); return false; } catch (e) { return true; } };
  check('no activity, no entry', threw(function () { EX.makeEntry({ minutes: 30 }); }));
  check('an activity with several efforts needs one chosen', threw(function () { EX.makeEntry({ activity: 'walk', minutes: 30 }); }));
  check('zero or missing minutes are refused', threw(function () { EX.makeEntry({ activity: 'walk', variant: 'brisk', minutes: 0 }); }) && threw(function () { EX.makeEntry({ activity: 'walk', variant: 'brisk', minutes: '' }); }));
  check('more than 10 hours in one entry is refused', threw(function () { EX.makeEntry({ activity: 'walk', variant: 'brisk', minutes: 601 }); }));
  var d = EX.makeEntry({ activity: 'walk', variant: 'brisk', minutes: 30.4, note: '  park  ' });
  check('a brisk walk copies code 17200, 4.8 MET, moderate, rounded minutes and a trimmed note', d.code === '17200' && d.met === 4.8 && d.intensity === 'moderate' && d.minutes === 30 && d.note === 'park' && d.strength === false && d.aerobic === true, JSON.stringify(d));
  var st = EX.makeEntry({ activity: 'strength', variant: 'reps', minutes: 40 });
  var st2 = EX.makeEntry({ activity: 'strength', variant: 'reps', minutes: 40, strength: false });
  check('strength or weights is pre-ticked as a strength day but the person can untick it; never aerobic minutes', st.strength === true && st2.strength === false && st.aerobic === false && st2.aerobic === false, JSON.stringify([st, st2]));
  var one = EX.makeEntry({ activity: 'stretch', minutes: 10 });
  check('an activity with one effort needs no choice', one.variant === 'mild' && one.met === 2.3 && one.intensity === 'light');
  var oth = EX.makeEntry({ activity: 'other', variant: 'vigorous', minutes: 20 });
  check('something else has no MET and takes its intensity from the effort chosen', oth.met === null && oth.code === null && oth.intensity === 'vigorous' && EX.metMinutes(oth) === null);
  S.add('exercise', today, d); S.add('exercise', today, one);
  var w2 = fresh(); w2.localStorage.setItem('ovumind_db_v1', w.localStorage.getItem('ovumind_db_v1')); w2.OvuStore.load(true);
  check('two exercise entries on one day are both kept, and survive a reload', S.list('exercise').length === 2 && w2.OvuStore.list('exercise').length === 2);
  check('a future day is refused for exercise like any entry', threw(function () { S.add('exercise', addDays(today, 1), d); }));
})();

(function exerciseWeek() {
  console.log('movement: the last 7 days against WHO, with MET-minutes kept separate');
  var w = fresh(), EX = w.OvuExercise, end = '2026-10-19';
  var mk = function (date, input) { return { type: 'exercise', date: date, data: EX.makeEntry(input) }; };
  var list = [
    mk('2026-10-19', { activity: 'walk', variant: 'brisk', minutes: 30 }),
    mk('2026-10-17', { activity: 'walk', variant: 'brisk', minutes: 30 }),
    mk('2026-10-15', { activity: 'walk', variant: 'brisk', minutes: 30 }),
    mk('2026-10-16', { activity: 'run', variant: 'jog', minutes: 25 }),
    mk('2026-10-16', { activity: 'strength', variant: 'heavy', minutes: 40 }),
    mk('2026-10-14', { activity: 'yoga', variant: 'hatha', minutes: 20 }),
    mk('2026-10-13', { activity: 'other', variant: 'moderate', minutes: 15 }),
    mk('2026-10-12', { activity: 'run', variant: 'run', minutes: 60 }),
    { type: 'sleep', date: '2026-10-18', data: { minutes: 400 } }
  ];
  var s = EX.week(list, end);
  check('the window is the 7 days ending today; an entry 8 days back is left out', s.from === '2026-10-13' && s.sessions === 7, JSON.stringify({ from: s.from, sessions: s.sessions }));
  check('moderate 105, vigorous 25, a vigorous minute counts as two: 155 moderate-equivalent', s.moderate === 105 && s.vigorous === 25 && s.moderateEquivalent === 155, JSON.stringify(s));
  check('155 is inside WHO’s 150 to 300 range', s.status === 'in' && s.toGo === 0);
  check('light yoga and strength work are shown but not counted as aerobic minutes', s.light === 20 && s.strengthMinutes === 40);
  check('MET-minutes add MET x minutes for known values only (432 + 187.5 + 200 + 46 = 866)', s.metMinutes === 866 && s.metUnknown === 1, 'metMinutes=' + s.metMinutes + ' unknown=' + s.metUnknown);
  check('one strength day, six active days', s.strengthDays === 1 && s.activeDays === 6, JSON.stringify({ sd: s.strengthDays, ad: s.activeDays }));
  check('aerobic MET-minutes count only moderate and vigorous aerobic entries (432 + 187.5 = 620)', s.aerobicMetMinutes === 620, 'aerobic=' + s.aerobicMetMinutes);
  var yoga = EX.week([mk(end, { activity: 'yoga', variant: 'hatha', minutes: 300 })], end);
  check('300 minutes of hatha yoga: 690 MET-minutes in all, but none toward WHO’s minutes or the 500 to 1,000 guide', yoga.metMinutes === 690 && yoga.aerobicMetMinutes === 0 && yoga.moderateEquivalent === 0, JSON.stringify(yoga));
  var pil = EX.week([mk(end, { activity: 'pilates', variant: 'mat', minutes: 30, strength: true }), mk('2026-10-18', { activity: 'pilates', variant: 'mat', minutes: 30, strength: true }), mk('2026-10-17', { activity: 'pilates', variant: 'mat', minutes: 30 })], end);
  check('the person’s strength tick counts on its own: two ticked mat Pilates days are 2 strength days, an unticked one is not', pil.strengthDays === 2 && pil.light === 90, JSON.stringify(pil));
  var low = EX.week([mk(end, { activity: 'walk', variant: 'brisk', minutes: 40 })], end);
  check('below the range says how many minutes are left, kindly', low.status === 'below' && low.toGo === 110 && /110 more moderate minutes/.test(EX.weekLine(low)) && /better than none/.test(EX.weekLine(low)), EX.weekLine(low));
  var high = EX.week([mk(end, { activity: 'run', variant: 'run', minutes: 200 })], end);
  check('above the range is described, not scored or warned', high.status === 'above' && /above WHO’s weekly range/.test(EX.weekLine(high)));
  check('an empty week has its own line', /Nothing logged/.test(EX.weekLine(EX.week([], end))));
})();

(function exercisePeriodAndCopy() {
  console.log('movement: the period note follows logged data only, and the words follow the sources');
  var w = fresh(), EX = w.OvuExercise;
  check('no period note without a logged period day or cramps', EX.periodContext([]) === null && EX.periodContext([{ type: 'period', data: { flow: 'none' } }]) === null);
  check('a logged period day shows the period note', EX.periodContext([{ type: 'period', data: { flow: 'light' } }]) === 'period');
  check('spotting is not framed as a period', EX.periodContext([{ type: 'period', data: { flow: 'spotting' } }]) === null);
  check('logged cramps show the cramps note', EX.periodContext([{ type: 'symptom', data: { symptoms: ['bloating', 'cramps'] } }]) === 'cramps');
  var all = JSON.stringify(EX.COPY) + JSON.stringify(EX.ACTIVITIES);
  check('no em or en dashes anywhere in the movement words', !/[—–]/.test(all));
  check('no fixed cycle days, no "avoid HIIT", no ovulation scheduling', !/\b28\b|days? 1 ?to ?5|avoid (hiit|high)|around ovulation|peak performance/i.test(JSON.stringify(EX.COPY)));
  check('the period words say movement is optional, may help, low certainty, listen to your body', /your choice/.test(EX.COPY.period) && /may help/.test(EX.COPY.period) && /Listen to your body/.test(EX.COPY.period) && /may ease/.test(EX.COPY.periodEvidence) && /low certainty/.test(EX.COPY.periodEvidence) && /not to exercise while bleeding/.test(EX.COPY.periodEvidence));
  check('the cramps note (for example spotting with cramps) does not call it a period', !/period/i.test(EX.COPY.cramps) && /may help/.test(EX.COPY.cramps) && /Listen to your body/.test(EX.COPY.cramps));
  check('no blanket reassurance about intensity on a period', !/any intensity|no rule to stop/i.test(EX.COPY.period + EX.COPY.periodEvidence));
  check('pregnancy words carry WHO’s cautions: heat, contact and falls, lying on your back, caesarean', /excessive heat/.test(EX.COPY.pregnancy) && /contact sports/.test(EX.COPY.pregnancy) && /lying on your back/.test(EX.COPY.pregnancy) && /caesarean/.test(EX.COPY.pregnancy) && !/usually carry on/.test(EX.COPY.pregnancy));
  check('red flags include the urgent case and stopped periods with heavy training', /urgent appointment/.test(EX.COPY.redFlags) && /bleed between periods/.test(EX.COPY.redFlags) && /periods stop/.test(EX.COPY.redFlags));
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-evidence.js'), 'utf8'), w, { filename: 'ovu-evidence.js' });
  var ev = w.OvuEvidence;
  check('the movement guide cites WHO, the US guidelines, the Compendium, McNulty, Cochrane and the NHS', !!ev && ['E9', 'E67', 'E68', 'E69', 'E70', 'E71', 'E72'].every(function (id) { var e = ev.get(id); return e && e.topics.indexOf('move') > -1; }));
})();

(function exerciseHearts() {
  console.log('movement: hearts once a day for logging, never for minutes or effort');
  var w = fresh(), S = w.OvuStore, RW = w.OvuRewards, EX = w.OvuExercise, today = S.today();
  var a = S.add('exercise', today, EX.makeEntry({ activity: 'stretch', minutes: 5 }));
  var r1 = RW.award(a);
  var b = S.add('exercise', today, EX.makeEntry({ activity: 'run', variant: 'fast', minutes: 120 }));
  var r2 = RW.award(b);
  check('the first exercise log of the day earns 6', r1.points === 6, JSON.stringify(r1));
  check('a second, longer and harder log the same day earns nothing more', r2.points === 0, JSON.stringify(r2));
  check('saving the same entry again earns nothing', RW.award(a).points === 0);
  var w2 = fresh(), S2 = w2.OvuStore, R2 = w2.OvuRewards, E2 = w2.OvuExercise;
  var big = R2.award(S2.add('exercise', S2.today(), E2.makeEntry({ activity: 'run', variant: 'fast', minutes: 300 })));
  check('a long vigorous session earns the same 6 as five minutes of stretching', big.points === r1.points);
  var w3 = fresh(), A3 = w3.OvuAgents, S3 = w3.OvuStore, E3 = w3.OvuExercise;
  S3.add('exercise', S3.today(), E3.makeEntry({ activity: 'other', variant: 'vigorous', minutes: 30 }));
  var mv = A3.fourWeekSummary().movement;
  check('the four-week summary never turns an unknown MET into zero', mv.sessions === 1 && mv.metMinutes === null && mv.metUnknownSessions === 1, JSON.stringify(mv));
})();

(function exerciseSyncHold() {
  console.log('cloud sync: rows the server refuses by type are held, the rest upload, held rows go up later');
  var SY = fresh().OvuSync;
  var plan = { pushUp: [{ id: 'a' }], applyPut: [{ id: 'c' }], applyDel: ['d'], pushDel: [] };
  var evs = { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' }, d: { id: 'd' } };
  SY.addHeld(plan, { a: 1, b: 1, c: 1, d: 1, gone: 1 }, function (id) { return evs[id] || null; });
  check('held rows rejoin the push, without duplicates, skipping rows a newer cloud copy just replaced or deleted', plan.pushUp.map(function (e) { return e.id; }).join() === 'a,b', JSON.stringify(plan.pushUp));
  var sp = SY.splitByType([{ id: 1, type: 'sleep' }, { id: 2, type: 'exercise' }, { id: 3, type: 'weight' }]);
  check('a refused batch splits into the older types and the new ones', sp.ok.length === 2 && sp.held.length === 1 && sp.held[0].id === 2);
  check('a refused batch is retried one newer type at a time, so a type the server already takes is never held behind one it refuses (code path)', /Object\.keys\(byType\)\.forEach/.test(fs.readFileSync(path.join(root, 'ovu-sync.js'), 'utf8')) && /heldRows = heldRows\.concat\(byType\[t\]\)/.test(fs.readFileSync(path.join(root, 'ovu-sync.js'), 'utf8')));
  check('only a check-constraint refusal triggers the split', SY.typeRejected(new Error('rest 400 new row for relation "entries" violates check constraint "entries_type_check"')) && !SY.typeRejected(new Error('rest 401 JWT expired')));

  /* end to end, with a pretend server that refuses 'exercise' until the migration is applied */
  var w = fresh(), S = w.OvuStore, EX = w.OvuExercise, Y = w.OvuSync, migrated = false, posts = [];
  w.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve('tok'); }, userId: function () { return 'u1'; } };
  S.setProfile({ cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' } });
  var reply = function (status, body) { return Promise.resolve({ ok: status < 300, status: status, text: function () { return Promise.resolve(body == null ? '' : JSON.stringify(body)); } }); };
  w.fetch = function (url, opt) {
    var m = (opt && opt.method) || 'GET';
    if (m === 'GET') return reply(200, []);
    if (m === 'POST' && /\/entries/.test(url)) {
      var rows = JSON.parse(opt.body);
      if (!migrated && rows.some(function (r) { return r.type === 'exercise'; })) return reply(400, { code: '23514', message: 'new row for relation "entries" violates check constraint "entries_type_check"' });
      posts.push(rows.map(function (r) { return r.type + ':' + r.id; })); return reply(201, null);
    }
    return reply(201, null);
  };
  var t = S.today(), sl = S.add('sleep', t, { bedTime: '23:00', wakeTime: '07:00', quality: 3, notes: '' }), ex = S.add('exercise', t, EX.makeEntry({ activity: 'walk', variant: 'brisk', minutes: 30 }));
  return Y.syncNow().then(function (r1) {
    var st1 = syncView(w);
    check('the first sync succeeds: the sleep row uploads and the exercise row is held', r1.ok === true && r1.held === 1 && posts.length === 1 && posts[0].join() === 'sleep:' + sl.id && st1.held && st1.held[ex.id], JSON.stringify({ r1: r1, posts: posts, held: st1.held }));
    /* a later edit to another row moves the push watermark past the held row's time */
    return new Promise(function (res) { setTimeout(res, 15); }).then(function () { S.update(sl.id, { data: Object.assign({}, sl.data, { quality: 4 }) }); return Y.syncNow(); });
  }).then(function (r2) {
    check('while refused, later syncs still upload other rows and keep holding', r2.ok === true && r2.held === 1 && posts[posts.length - 1].join() === 'sleep:' + sl.id, JSON.stringify({ r2: r2, posts: posts }));
    migrated = true;
    return Y.syncNow();
  }).then(function (r3) {
    var st3 = syncView(w);
    check('once the server accepts it, the held row goes up even though the watermark moved past it', r3.ok === true && r3.held === 0 && posts[posts.length - 1].indexOf('exercise:' + ex.id) > -1 && !Object.keys(st3.held || {}).length, JSON.stringify({ r3: r3, posts: posts, held: st3.held }));
  }).catch(function (err) { check('the sync hold test ran to the end', false, String(err && err.stack || err)); });
})();

(function exerciseSyncEdgeCases() {
  console.log('cloud sync: an edit during the upload stays held; a phone that learns a new type pulls everything once');
  var mkWorld = function () {
    var w = fresh(), S = w.OvuStore;
    w.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve('tok'); }, userId: function () { return 'u1'; } };
    S.setProfile({ cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' } });
    w.reply = function (status, body) { return Promise.resolve({ ok: status < 300, status: status, text: function () { return Promise.resolve(body == null ? '' : JSON.stringify(body)); } }); };
    return w;
  };
  /* 1. the held row is accepted, but the person edits it while the upload is in flight */
  var w = mkWorld(), S = w.OvuStore, EX = w.OvuExercise, Y = w.OvuSync, refuse = true, sent = [], edited = false;
  var ex = S.add('exercise', S.today(), EX.makeEntry({ activity: 'walk', variant: 'brisk', minutes: 10 }));
  /* another phone whose clock runs an hour ahead pushes the watermark past any edit made here (Codex's case) */
  var tombGiven = false, ahead = new Date(Date.now() + 3600000).toISOString(), aheadRow = { id: 'ahead1', user_id: 'u1', type: 'reflection', date: S.today(), data: { text: 'from the other phone', mood: '' }, source: 'room', created_at: ahead, updated_at: ahead, synced_at: ahead, deleted: false, deleted_at: null }, gave = false;
  w.fetch = function (url, opt) {
    var m = (opt && opt.method) || 'GET';
    if (m === 'GET' && /\/entries/.test(url) && !gave) { gave = true; return w.reply(200, [aheadRow]); }
    /* second sync: an old deletion of the same row from another phone (it loses to the newer local entry) */
    if (m === 'GET' && /\/entries/.test(url) && gave && !refuse && !tombGiven) { tombGiven = true; return w.reply(200, [{ id: ex.id, user_id: 'u1', type: 'exercise', date: S.today(), data: {}, source: 'room', created_at: '2000-01-01T00:00:00Z', updated_at: '2000-01-01T00:00:00Z', synced_at: ahead, deleted: true, deleted_at: '2000-01-01T00:00:00Z' }]); }
    if (m === 'GET') return w.reply(200, []);
    if (m === 'POST' && /\/entries/.test(url)) {
      var rows = JSON.parse(opt.body);
      if (refuse && rows.some(function (r) { return r.type === 'exercise'; })) return w.reply(400, { message: 'new row for relation "entries" violates check constraint "entries_type_check"' });
      rows.forEach(function (r) { sent.push(r.type + ':' + r.data.minutes); });
      if (!edited && rows.some(function (r) { return r.id === ex.id; })) { edited = true; S.update(ex.id, { data: Object.assign({}, ex.data, { minutes: 20 }) }); }
      return w.reply(201, null);
    }
    return w.reply(201, null);
  };
  var t1 = Y.syncNow().then(function () { refuse = false; return Y.syncNow(); }).then(function (r2) {
    var st = syncView(w);
    check('a held row edited during its upload stays held, even when an older deletion of it arrives in the same sync', tombGiven && !!(st.held && st.held[ex.id]), JSON.stringify({ held: st.held, sent: sent, tomb: tombGiven }));
    check('and the sync reports it as still waiting, so the app cannot say "Backed up."', r2 && r2.ok === true && r2.held === 1, JSON.stringify(r2));
    return Y.syncNow();
  }).then(function () {
    var st = syncView(w);
    check('and the newer version (20 minutes) goes up on the next sync, then the hold is released', sent.indexOf('exercise:20') > -1 && !(st.held && st.held[ex.id]), JSON.stringify({ held: st.held, sent: sent }));
  });
  /* 2. an older version advanced its cursor past an exercise row it could not keep; this version pulls everything once */
  var v = mkWorld(), SV = v.OvuStore, YV = v.OvuSync, gets = [];
  v.localStorage.setItem('ovumind_sync_v1', JSON.stringify({ v: 1, userId: 'u1', shadow: {}, tombstones: {}, pulledSeq: '2026-10-19T10:00:00Z', pushedAt: '2026-10-19T10:00:00Z', profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null }));
  var cloudRow = { id: 'cloudex1', user_id: 'u1', type: 'exercise', date: SV.today(), data: { activity: 'swim', label: 'Swimming', variant: 'laps', code: '18240', met: 5.8, minutes: 30, intensity: 'moderate', strength: false, aerobic: true, note: '' }, source: 'room', created_at: '2026-10-19T09:00:00Z', updated_at: '2026-10-19T09:00:00Z', synced_at: '2026-10-19T09:30:00Z', deleted: false, deleted_at: null };
  /* a reflection that was backed up and then cleared from this phone on purpose: an untyped pull from the start would bring it back */
  var clearedRow = { id: 'oldrefl', user_id: 'u1', type: 'reflection', date: SV.today(), data: { text: 'cleared on purpose', mood: '' }, source: 'room', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', synced_at: '2026-10-01T09:30:00Z', deleted: false, deleted_at: null };
  v.fetch = function (url, opt) {
    var m = (opt && opt.method) || 'GET';
    if (m === 'GET' && /\/entries/.test(url)) { gets.push(url); if (/synced_at=gt/.test(url)) return v.reply(200, []); return v.reply(200, /type=in\.\([^)]*exercise[^)]*\)/.test(url) ? [cloudRow] : [cloudRow, clearedRow]); } /* the newer types this version knows: exercise, and sleepcheck since 21 Oct */
    if (m === 'GET') return v.reply(200, []);
    return v.reply(201, null);
  };
  var t2 = YV.syncNow().then(function (r) {
    var st = syncPull(v);
    check('after learning the exercise type, a one-time pull of that type alone brings back the row the old version skipped', gets.length === 2 && /synced_at=gt/.test(gets[0]) && /type=in\.\([^)]*exercise[^)]*\)/.test(gets[1]) && !/synced_at=gt/.test(gets[1]) && SV.list('exercise').length === 1 && st.types === SV.TYPES.join(','), JSON.stringify({ r: r, gets: gets, n: SV.list('exercise').length, types: st.types }));
    check('an older entry cleared from this phone on purpose is not brought back', SV.list('reflection').length === 0);
    return YV.syncNow();
  }).then(function () {
    check('the next sync goes back to pulling only what is new', /synced_at=gt/.test(gets[gets.length - 1] || ''), JSON.stringify(gets));
  });
  Promise.all([t1, t2]).catch(function (err) { check('the sync edge-case tests ran to the end', false, String(err && err.stack || err)); });
})();

/* A small pretend PostgREST /entries endpoint for the sync tests. It reads only the query forms the app sends (the
   synced_at cursor as gt or gte, the (synced_at, id) keyset `or` with quoted values, the type filter, id=gt, the two
   orders, limit and offset) and throws on anything else, so a new query shape cannot slip past it unread. synced_at
   is compared as an instant to the microsecond, as Postgres does, whatever its spelling ('...Z' or '+00:00'); ids
   compare as text, the same order the server uses for both the sort and the id.gt filter. */
function syncServer() {
  var rows = [], memo = {};
  function micros(s) {
    if (memo[s] !== undefined) return memo[s];
    var m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(String(s));
    if (!m) throw new Error('pretend server: not a timestamp: ' + s);
    return (memo[s] = Date.parse(m[1] + m[3]) * 1000 + Number(((m[2] || '') + '000000').slice(0, 6)));
  }
  var V = '("(?:[^"\\\\]|\\\\.)*"|[^,()"]*)';
  var KEYSET = new RegExp('^\\(synced_at\\.gt\\.' + V + ',and\\(synced_at\\.eq\\.' + V + ',id\\.gt\\.' + V + '\\)\\)$');
  function unq(v) { return v.charAt(0) === '"' ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v; }
  function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
  return {
    rows: rows,
    get: function (url) {
      var keep = [], order = null, lim = 1000, off = 0;
      new URLSearchParams(url.split('?')[1] || '').forEach(function (v, k) {
        var m;
        if (k === 'select') return;
        if (k === 'limit') { lim = Number(v); return; }
        if (k === 'offset') { off = Number(v); return; }
        if (k === 'order' && (v === 'id.asc' || v === 'synced_at.asc,id.asc')) { order = v; return; }
        if (k === 'synced_at' && (m = /^(gt|gte)\.(.+)$/.exec(v))) { var t = micros(m[2]), gte = m[1] === 'gte'; keep.push(function (r) { var x = micros(r.synced_at); return gte ? x >= t : x > t; }); return; }
        if (k === 'or' && (m = KEYSET.exec(v))) { var a = micros(unq(m[1])), b = micros(unq(m[2])), last = unq(m[3]); keep.push(function (r) { var x = micros(r.synced_at); return x > a || (x === b && r.id > last); }); return; }
        if (k === 'type' && (m = /^in\.\(([^)]*)\)$/.exec(v))) { var types = m[1].split(','); keep.push(function (r) { return types.indexOf(r.type) > -1; }); return; }
        if (k === 'id' && (m = /^gt\.(.+)$/.exec(v))) { var g = m[1]; keep.push(function (r) { return r.id > g; }); return; }
        throw new Error('pretend server: unknown query ' + k + '=' + v);
      });
      var out = rows.filter(function (r) { return keep.every(function (f) { return f(r); }); });
      out.sort(order === 'id.asc' ? byId : function (a, b) { return micros(a.synced_at) - micros(b.synced_at) || byId(a, b); });
      return out.slice(off, off + lim);
    }
  };
}
/* where the pull resumes (shared cursor, typed recovery): its own key since round four of the sync review, inside the
   main sync state before that; and the reset generation, likewise. The checks read either layout, so mutation runs
   against older sync code still mean something. */
function syncView(w) {
  var ls = w.localStorage, pos = JSON.parse(ls.getItem('ovumind_sync_pos_v1') || 'null'), main = JSON.parse(ls.getItem('ovumind_sync_v1') || '{}');
  if (pos || ls.getItem('ovumind_sync_reset_v1') != null) {
    /* round five: one position, valid only under the current reset token (after a reset with none stored yet: empty) */
    var tok = ls.getItem('ovumind_sync_reset_v1') || '';
    if (!pos || pos.token !== tok) return { userId: null, pushedAt: null, held: {}, profilePulledAt: null, lastSyncAt: null, pulledSeq: null, pulledId: null, types: null, typedAfter: null };
    return { userId: pos.uid || null, pushedAt: pos.pushedAt || null, held: pos.held || {}, profilePulledAt: pos.profilePulledAt || null, lastSyncAt: pos.lastSyncAt || null, pulledSeq: pos.pulledSeq || null, pulledId: pos.pulledId != null ? pos.pulledId : null, types: pos.types || null, typedAfter: pos.typedAfter || null };
  }
  var pull = JSON.parse(ls.getItem('ovumind_sync_pull_v1') || 'null'), out = Object.assign({}, main);
  if (pull) ['pulledSeq', 'pulledId', 'types', 'typedAfter'].forEach(function (k) { out[k] = pull[k]; });
  return out;
}
var syncPull = syncView;
/* the reset generation: a random token since round five, a counter before */
function syncGen(w) { var t = w.localStorage.getItem('ovumind_sync_reset_v1'); if (t != null) return t; var g = w.localStorage.getItem('ovumind_sync_gen_v1'); return g != null ? Number(g) : Number((JSON.parse(w.localStorage.getItem('ovumind_sync_v1') || '{}')).gen) || 0; }
/* a pretend Web Locks manager shared by pretend tabs: exclusive, granted in request order, the callback run
   asynchronously and the lock held until its promise settles; idle() resolves once nothing holds or waits */
function lockManager() {
  var held = {}, queue = {}, waiters = [];
  function busy() { return Object.keys(held).some(function (k) { return held[k]; }); }
  function wake() { if (busy()) return; var w = waiters; waiters = []; w.forEach(function (fn) { fn(); }); }
  return {
    idle: function () { return new Promise(function (res) { waiters.push(res); Promise.resolve().then(wake); }); },
    request: function (name, cb) {
      return new Promise(function (res, rej) {
        var done = function () { var q = queue[name]; if (q && q.length) q.shift()(); else { held[name] = false; Promise.resolve().then(wake); } };
        var go = function () { Promise.resolve().then(function () { return cb({ name: name, mode: 'exclusive' }); }).then(function (v) { done(); res(v); }, function (e) { done(); rej(e); }); };
        if (held[name]) (queue[name] = queue[name] || []).push(go); else { held[name] = true; go(); }
      });
    }
  };
}
/* two tabs of one phone: one storage, one lock manager, one pretend server */
function syncTabs(srv, onGetA, onGetB) {
  var mgr = lockManager(), A = syncWorld(srv, onGetA, null), B = syncWorld(srv, onGetB, null);
  B.localStorage = A.localStorage; A.navigator.locks = mgr; B.navigator.locks = mgr;
  return { A: A, B: B, mgr: mgr };
}
function ticks(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
/* a signed-in phone with cloud backup on, talking to `srv`; `state` is its saved sync position (null: a new phone,
   undefined: an older version's millisecond cursor at 10:00 on 19 Oct) */
function syncWorld(srv, onGet, state) {
  var w = fresh(), S = w.OvuStore;
  w.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve('tok'); }, userId: function () { return 'u1'; } };
  S.setProfile({ cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' } });
  var reply = function (status, body) { return Promise.resolve({ ok: status < 300, status: status, text: function () { return Promise.resolve(body == null ? '' : JSON.stringify(body)); } }); };
  w.fetch = function (url, opt) {
    var m = (opt && opt.method) || 'GET';
    if (m === 'GET' && /\/entries/.test(url)) { var res = srv.get(url); if (onGet) onGet(url, res); return reply(200, res); }
    if (m === 'GET') return reply(200, []);
    return reply(201, null);
  };
  if (state !== null) w.localStorage.setItem('ovumind_sync_v1', JSON.stringify(state || { v: 1, userId: 'u1', shadow: {}, tombstones: {}, pulledSeq: '2026-10-19T10:00:00Z', pushedAt: '2026-10-19T10:00:00Z', profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null }));
  return w;
}
function syncRow(id, type, at, data) { return { id: id, user_id: 'u1', type: type, date: '2026-10-19', data: data, source: 'room', created_at: at, updated_at: at, synced_at: at, deleted: false, deleted_at: null }; }

(function exerciseTypedRecoveryCursor() {
  console.log('cloud sync: the one-time typed pull never moves the shared cursor, and walks ids past the 20,000-row cap');
  var server = syncServer, world = syncWorld, row = syncRow;
  /* 1. another phone uploads a reflection, then exercise, between this phone's two requests */
  var srv = server(), calls = 0;
  var w = world(srv, function (url) { calls++; if (calls === 1) { srv.rows.push(row('r101', 'reflection', '2026-10-19T10:01:00Z', { text: 'between the requests', mood: '' })); srv.rows.push(row('x102', 'exercise', '2026-10-19T10:02:00Z', { activity: 'walk', label: 'Walking', variant: 'brisk', code: '17200', met: 4.8, minutes: 20, intensity: 'moderate', strength: false, aerobic: true, note: '' })); } });
  var S = w.OvuStore, Y = w.OvuSync;
  var a = Y.syncNow().then(function () {
    var st = syncPull(w);
    check('the typed pull brings the exercise row but leaves the shared cursor where it was', S.list('exercise').length === 1 && Date.parse(st.pulledSeq) === Date.parse('2026-10-19T10:00:00Z'), JSON.stringify({ seq: st.pulledSeq, n: S.list('exercise').length }));
    return Y.syncNow();
  }).then(function () {
    check('so the reflection that arrived between the two requests is pulled on the next sync', S.list('reflection').length === 1, JSON.stringify(S.list('reflection')));
  });
  /* 2. more historical exercise rows than one sync takes, all uploaded together (one shared synced_at, with
     microseconds), and the last one by id is a deletion of an entry this phone still has */
  var big = server(), gets = [], TIE = '2026-01-01T00:00:00.123456+00:00', pad = function (n) { return ('00000' + n).slice(-5); };
  for (var i = 0; i < 20000; i++) big.rows.push(row('h' + pad(i), 'exercise', TIE, { activity: 'stretch', label: 'Stretching', variant: 'mild', code: '02101', met: 2.3, minutes: 5, intensity: 'light', strength: false, aerobic: true, note: '' }));
  var tomb = row('h' + pad(20000), 'exercise', TIE, {}); tomb.deleted = true; tomb.deleted_at = '2026-01-02T00:00:00Z'; tomb.updated_at = '2026-01-02T00:00:00Z'; big.rows.push(tomb);
  var v = world(big, function (url) { gets.push(url); }), SV = v.OvuStore, YV = v.OvuSync;
  SV.putEvent({ id: 'h' + pad(20000), type: 'exercise', date: '2025-12-31', data: { activity: 'walk', label: 'Walking', variant: 'brisk', code: '17200', met: 4.8, minutes: 30, intensity: 'moderate', strength: false, aerobic: true, note: '' }, createdAt: '2025-12-31T09:00:00Z', updatedAt: '2025-12-31T09:00:00Z', source: 'cloud' });
  var b = YV.syncNow().then(function () {
    var st = syncPull(v);
    check('20,001 rows sharing one timestamp: the first sync takes 20,000 by id and is not marked recovered', SV.list('exercise').length === 20001 && !st.types && st.typedAfter === 'h19999', JSON.stringify({ n: SV.list('exercise').length, types: st.types, after: st.typedAfter }));
    return YV.syncNow();
  }).then(function () {
    var st = syncPull(v), typedGets = gets.filter(function (u) { return /type=in/.test(u); });
    check('the next sync resumes after the last id, applies the final deletion, then marks the type known', !SV.get('h' + pad(20000)) && SV.list('exercise').length === 20000 && st.types === SV.TYPES.join(',') && !st.typedAfter && /id=gt\.h19999/.test(typedGets[typedGets.length - 1]), JSON.stringify({ n: SV.list('exercise').length, types: st.types, after: st.typedAfter, last: typedGets[typedGets.length - 1] }));
    return YV.syncNow();
  }).then(function () {
    var typedGets = gets.filter(function (u) { return /type=in/.test(u); });
    check('once recovered, later syncs make no typed requests (20 pages, then 1, then none)', typedGets.length === 21, 'typed requests: ' + typedGets.length);
  });
  Promise.all([a, b]).catch(function (err) { check('the typed recovery tests ran to the end', false, String(err && err.stack || err)); });
})();

(function sharedPullKeysetCursor() {
  console.log('cloud sync: the shared pull resumes after the last (synced_at, id) it saw, so an upload larger than one sync arrives whole');
  /* One upload of 25,000 rows (a large Apple Health import, say) is stamped with one now(), microseconds and all. Three
     more rows land later in the same millisecond, so a cursor rounded to milliseconds cannot tell them apart either. */
  var TIE = '2026-10-19T12:00:00.123456+00:00', SAME_MS = '2026-10-19T12:00:00.123999+00:00', pad = function (n) { return ('0000' + n).slice(-5); };
  function load(srv) {
    for (var i = 0; i < 25000; i++) srv.rows.push(syncRow('n' + pad(i), 'reflection', TIE, { text: 'note ' + i, mood: '' }));
    ['a0', 'a1', 'a2'].forEach(function (id) { srv.rows.push(syncRow(id, 'reflection', SAME_MS, { text: 'note ' + id, mood: '' })); });
  }
  /* counts what each sync's shared pull delivers (the typed recovery's own requests are left out) */
  function tally() {
    var t = { seen: {}, per: [], sync: 0 };
    t.onGet = function (url, res) { if (/type=in/.test(url)) return; t.per[t.sync] = (t.per[t.sync] || 0) + res.length; res.forEach(function (r) { t.seen[r.id] = (t.seen[r.id] || 0) + 1; }); };
    t.twice = function () { return Object.keys(t.seen).filter(function (k) { return t.seen[k] > 1; }).length; };
    return t;
  }
  /* 1. a new phone restores the backup (no cursor yet); another phone uploads one more row between its first two syncs */
  var srv = syncServer(), t = tally();
  load(srv);
  var w = syncWorld(srv, t.onGet, null), S = w.OvuStore, Y = w.OvuSync;
  var a = Y.syncNow().then(function () {
    srv.rows.push(syncRow('late1', 'reflection', '2026-10-19T13:00:00.000001+00:00', { text: 'from the other phone', mood: '' }));
    t.sync = 1; return Y.syncNow();
  }).then(function () { t.sync = 2; return Y.syncNow(); }).then(function () {
    var st = syncPull(w);
    check('a restore larger than one sync: 20,000 rows, then the rest of the same upload and the late row, then nothing', t.per.join() === '20000,5004,0', 'per sync: ' + t.per.join());
    check('every row arrives exactly once, none skipped at the cut and none fetched again', Object.keys(t.seen).length === 25004 && t.twice() === 0 && S.list('reflection').length === 25004, JSON.stringify({ distinct: Object.keys(t.seen).length, twice: t.twice(), local: S.list('reflection').length }));
    check('the cursor keeps the server\'s own timestamp, microseconds included, and the last id', st.pulledSeq === '2026-10-19T13:00:00.000001+00:00' && st.pulledId === 'late1', JSON.stringify({ seq: st.pulledSeq, id: st.pulledId }));
  });
  /* 2. a phone that an older version left on a millisecond cursor inside the same upload (what it saved after taking
     its first 20,000 rows) catches up within two syncs and then stops pulling them */
  var srv2 = syncServer(), t2 = tally();
  load(srv2);
  var v = syncWorld(srv2, t2.onGet, { v: 1, userId: 'u1', shadow: {}, tombstones: {}, pulledSeq: '2026-10-19T12:00:00.123Z', pushedAt: '2026-10-19T12:00:00.123Z', profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null }), SV = v.OvuStore, YV = v.OvuSync;
  var b = YV.syncNow().then(function () { t2.sync = 1; return YV.syncNow(); }).then(function () { t2.sync = 2; return YV.syncNow(); }).then(function () {
    check('an older millisecond cursor resumes from that millisecond: everything arrives within two syncs, then nothing', t2.per.join() === '20000,5003,0' && Object.keys(t2.seen).length === 25003 && SV.list('reflection').length === 25003, JSON.stringify({ per: t2.per.join(), distinct: Object.keys(t2.seen).length, local: SV.list('reflection').length }));
  });
  /* 3. ids are free text (a restored backup keeps its own), so the cursor id is quoted: one with a quote, a comma,
     brackets and a backslash still resumes exactly after itself */
  var odd = 'we"ird,(id)\\', srv3 = syncServer(), t3 = tally();
  [odd, odd + 'z', 'wa', 'x1'].forEach(function (id) { srv3.rows.push(syncRow(id, 'reflection', TIE, { text: id, mood: '' })); });
  var u = syncWorld(srv3, t3.onGet, { v: 1, userId: 'u1', shadow: {}, tombstones: {}, pulledSeq: TIE, pulledId: odd, pushedAt: TIE, profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null });
  var c = u.OvuSync.syncNow().then(function () {
    check('a cursor id with quotes, commas, brackets and a backslash resumes exactly after itself', Object.keys(t3.seen).sort().join('|') === [odd + 'z', 'x1'].join('|'), JSON.stringify(Object.keys(t3.seen)));
  });
  /* 4. (Codex round one) a second tab of the same phone, in a browser without Web Locks, syncs to the end while this
     sync's upload is in flight, so it moves the cursor further (to r2), and r2 never reaches this tab's diary (as if
     cleared). This sync must not wind the cursor back, or the next sync brings r2 back. */
  var R1 = '2026-10-19T11:00:00.000001+00:00', R2 = '2026-10-19T12:00:00.000002+00:00';
  var srv4 = syncServer(), posted4 = false;
  srv4.rows.push(syncRow('r1', 'reflection', R1, { text: 'eleven', mood: '' }));
  var x = syncWorld(srv4, null, null), SX = x.OvuStore, YX = x.OvuSync, xPost = x.fetch;
  var x2 = syncWorld(srv4, null, null); x2.localStorage = x.localStorage;
  SX.add('reflection', SX.today(), { text: 'written here', mood: '' });
  x.fetch = function (url, opt) {
    if (opt && opt.method === 'POST' && /\/entries/.test(url) && !posted4) {
      posted4 = true;
      srv4.rows.push(syncRow('r2', 'reflection', R2, { text: 'twelve, cleared later', mood: '' }));
      /* the other tab pulls r2, then the phone loses it without a delete (as if cleared): with the multi-tab store (#46) a
         row another tab saved now reaches this tab, so the clear is made in the shared copy, with no tombstone sent */
      return x2.OvuSync.syncNow().then(function () { var db = JSON.parse(x.localStorage.getItem('ovumind_db_v1')); db.events = db.events.filter(function (e) { return e.id !== 'r2'; }); x.localStorage.setItem('ovumind_db_v1', JSON.stringify(db)); return xPost(url, opt); });
    }
    return xPost(url, opt);
  };
  var d = YX.syncNow().then(function () {
    var st = syncPull(x);
    check('a slower tab never winds the cursor back past where another tab moved it', st.pulledSeq === R2 && st.pulledId === 'r2', JSON.stringify({ seq: st.pulledSeq, id: st.pulledId }));
    return YX.syncNow();
  }).then(function () {
    check('so a row cleared from this phone after the other tab pulled it is not brought back', !SX.get('r2') && !!SX.get('r1'), JSON.stringify({ r1: !!SX.get('r1'), r2: !!SX.get('r2') }));
  });
  /* 5. (Codex round one, already there before) signing out or resetting the position during the upload: the
     finishing sync must not write the old account and cursor back into the cleared position */
  var srv5 = syncServer(), posted5 = false;
  srv5.rows.push(syncRow('s1', 'reflection', R1, { text: 'eleven', mood: '' }));
  var y = syncWorld(srv5, null, null), SY5 = y.OvuStore, YY = y.OvuSync, yPost = y.fetch;
  SY5.add('reflection', SY5.today(), { text: 'written here', mood: '' });
  y.fetch = function (url, opt) { if (opt && opt.method === 'POST' && /\/entries/.test(url) && !posted5) { posted5 = true; YY.resetPosition(); } return yPost(url, opt); };
  var e = YY.syncNow().then(function (r) {
    var st = syncView(y), pos = st;
    check('a reset during the upload stays a reset: no account, no cursor, no push watermark written back', posted5 && st.userId === null && !pos.pulledSeq && !pos.pulledId && st.pushedAt === null && r && r.ok === false, JSON.stringify({ r: r, userId: st.userId, seq: pos.pulledSeq, pushedAt: st.pushedAt }));
  });
  Promise.all([a, b, c, d, e]).catch(function (err) { check('the shared pull cursor tests ran to the end', false, String(err && err.stack || err)); });
})();

(function syncGenerationAcrossAccounts() {
  console.log('cloud sync: a sign-out during an upload can never carry one account into the next (Codex pre-merge blocker 2)');
  var w = fresh(), S = w.OvuStore, Y = w.OvuSync, uid = 'uA', posts = [], releasePost = null, held = null;
  w.OvuAuth = { session: function () { return { user: { id: uid } }; }, token: function () { return Promise.resolve('tok-' + uid); }, userId: function () { return uid; } };
  S.setProfile({ name: 'Ann', lifeStage: 'cycling', cloud: { v: 1, at: '2026-10-20T00:00:00Z', uid: 'uA' } });
  var reply = function (status, body) { return Promise.resolve({ ok: status < 300, status: status, text: function () { return Promise.resolve(body == null ? '' : JSON.stringify(body)); } }); };
  w.fetch = function (url, opt) {
    var m = (opt && opt.method) || 'GET', tok = ((opt && opt.headers && opt.headers.Authorization) || '').slice(7);
    if (m === 'GET' && /\/entries/.test(url)) return reply(200, []);
    if (m === 'GET' && /\/profiles/.test(url)) return reply(200, /user_id=eq\.uB/.test(url) ? [{ user_id: 'uB', display_name: 'Bea', profile: { name: 'Bea', lifeStage: 'peri' }, updated_at: '2026-10-19T08:00:00Z' }] : []);
    if (m === 'POST' && /\/profiles/.test(url)) {
      var body = JSON.parse(opt.body); posts.push({ tok: tok, user: body.user_id, name: body.profile && body.profile.name });
      /* A's first upload: hold it in the air while the person signs out and B signs in and turns on backup */
      if (body.user_id === 'uA' && !held) { held = new Promise(function (res) { releasePost = res; }); return held.then(function () { return reply(201, null); }); }
      return reply(201, null);
    }
    return reply(201, null);
  };
  var g0 = 0, first = Y.syncNow();
  var waitPost = function (n) { return new Promise(function (res) { (function poll() { if (posts.length >= n && releasePost) return res(); setTimeout(poll, 1); })(); }); };
  var done = waitPost(1).then(function () {
    g0 = syncGen(w);
    Y.resetPosition(); /* sign-out */
    uid = 'uB'; S.setProfile({ cloud: { v: 1, at: '2026-10-20T00:05:00Z', uid: 'uB' } }); /* B signs in and turns on backup */
    releasePost(); /* A's upload completes now */
    return first;
  }).then(function (r1) {
    var st = syncView(w);
    check('the overtaken sync ends cancelled and writes nothing into the reset state', r1 && r1.ok === false && r1.reason === 'cancelled' && st.userId === null && st.profilePulledAt === null && syncGen(w) !== g0, JSON.stringify({ r1: r1, st: { userId: st.userId, pulled: st.profilePulledAt, gen: syncGen(w), g0: g0 } }));
    return Y.syncNow();
  }).then(function (r2) {
    var st = syncView(w), toB = posts.filter(function (p) { return p.user === 'uB'; });
    check('B\'s first sync restores B\'s own cloud profile instead of uploading over it', r2 && r2.ok === true && S.profile().name === 'Bea' && S.profile().lifeStage === 'peri' && st.userId === 'uB' && toB.length === 0, JSON.stringify({ r2: r2, name: S.profile().name, toB: toB }));
    check('nothing of A was ever sent with B\'s token, and A\'s only upload used A\'s own token', posts.every(function (p) { return (p.user === 'uA') === (p.tok === 'tok-uA'); }) && !posts.some(function (p) { return p.user === 'uB' && p.name === 'Ann'; }), JSON.stringify(posts));
  });
  /* the lock: when the browser offers Web Locks, every sync runs inside the same named lock */
  var v = fresh(), lockNames = [];
  v.navigator.locks = { request: function (name, fn) { lockNames.push(name); return Promise.resolve().then(fn); } };
  v.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve('t'); }, userId: function () { return 'u1'; } };
  v.OvuStore.setProfile({ cloud: { v: 1, at: '2026-10-20T00:00:00Z', uid: 'u1' } });
  v.fetch = function (url, opt) { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve((opt && opt.method && opt.method !== 'GET') ? '' : '[]'); } }); };
  var locked = v.OvuSync.syncNow().then(function (r) { check('a sync runs inside the browser-wide ovumind-sync lock when Web Locks exist', lockNames.length === 1 && lockNames[0] === 'ovumind-sync' && r && r.ok === true, JSON.stringify({ locks: lockNames, r: r })); });
  /* every reset moves the generation on */
  var z = fresh(); z.localStorage.setItem('ovumind_sync_v1', JSON.stringify({ v: 1, gen: 4, userId: 'u1', shadow: {}, tombstones: {} })); z.OvuSync.resetPosition();
  check('a reset moves the generation on and clears the account', syncGen(z) !== 4 && syncView(z).userId === null);
  Promise.all([done, locked]).catch(function (err) { check('the sync generation tests ran to the end', false, String(err && err.stack || err)); });
})();

(function syncRoundFour() {
  console.log('cloud sync, round four: every request has a time limit, resets finish inside the lock, the pull position has its own key, the generation is read before queuing');
  var T1 = '2026-10-19T11:00:00.000001+00:00', T2 = '2026-10-19T12:00:00.000002+00:00', note = function (t) { return { text: t, mood: '' }; };
  var never = function () { return new Promise(function () { }); };
  /* the sync settles within `ms`, or the race says it did not */
  var within = function (p, ms) { return Promise.race([p.then(function (r) { return { r: r }; }), ticks(ms).then(function () { return null; })]); };

  /* 1. time limits. A request that never answers ends the sync within the limit, and the answer arriving later writes nothing. */
  var srv1 = syncServer(), w1 = syncWorld(srv1, null, null), release1 = null;
  srv1.rows.push(syncRow('t1', 'reflection', T1, note('t1')));
  w1.OVU_CONFIG = { syncRequestMs: 40 };
  var f1 = w1.fetch;
  w1.fetch = function (url, opt) { if (/\/entries/.test(url) && !release1) return new Promise(function (res) { release1 = function () { res(f1(url, opt)); }; }).then(function (r) { return r; }); return f1(url, opt); };
  var one = within(w1.OvuSync.syncNow(), 1500).then(function (got) {
    check('a pull that never answers ends the sync within its time limit', !!got && got.r && got.r.ok === false, JSON.stringify(got));
    if (release1) release1(); /* the answer finally arrives */
    return ticks(30);
  }).then(function () {
    var pos = syncPull(w1);
    check('and its late answer is never applied or saved', !w1.OvuStore.get('t1') && !pos.pulledSeq, JSON.stringify({ t1: !!w1.OvuStore.get('t1'), seq: pos.pulledSeq }));
  });
  var w1b = syncWorld(syncServer(), null, null);
  w1b.OVU_CONFIG = { syncRequestMs: 40 };
  w1b.OvuAuth.token = never;
  var oneB = within(w1b.OvuSync.syncNow(), 1500).then(function (got) {
    check('a sign-in token that never comes ends the sync within its time limit', !!got && got.r && got.r.ok === false, JSON.stringify(got));
  });
  /* with Web Locks, the stalled tab lets go of the lock, so the second tab's sync runs */
  var srv1c = syncServer(), tabs1 = syncTabs(srv1c), stalled = false;
  tabs1.A.OVU_CONFIG = { syncRequestMs: 40 }; tabs1.B.OVU_CONFIG = { syncRequestMs: 40 };
  var fA = tabs1.A.fetch; tabs1.A.fetch = function (url, opt) { if (/\/entries/.test(url) && !stalled) { stalled = true; return never(); } return fA(url, opt); };
  var pA1 = tabs1.A.OvuSync.syncNow(), oneC = ticks(5).then(function () { return within(tabs1.B.OvuSync.syncNow(), 1500); }).then(function (got) {
    check('a stalled sync in one tab does not hold the lock for the others', !!got && got.r && got.r.ok === true, JSON.stringify(got));
    return pA1;
  });

  /* 2. a reset in another tab lands after this sync's last check but before its write: the reset finishes inside the
     lock, after this sync lets go of it, so the write does not survive */
  var srv2 = syncServer(), tabs2 = syncTabs(srv2), fired2 = false, store2 = tabs2.A.localStorage, set2 = store2.setItem;
  srv2.rows.push(syncRow('q1', 'reflection', T1, note('q1')));
  store2.setItem = function (k, v) {
    if (!fired2 && (k === 'ovumind_sync_v1' || k === 'ovumind_sync_pull_v1' || k === 'ovumind_sync_pos_v1') && String(v).indexOf(T1) > -1) { fired2 = true; tabs2.B.OvuSync.resetPosition(); }
    return set2.call(store2, k, v);
  };
  var two = tabs2.A.OvuSync.syncNow().then(function (r) { return tabs2.mgr.idle().then(function () { return r; }); }).then(function (r) {
    var st = syncView(tabs2.A), pos = st;
    check('a reset that lands between a sync\'s last check and its write still wins once the lock is free', fired2 && !pos.pulledSeq && !pos.pulledId && st.userId === null && st.pushedAt === null && r && r.ok === false, JSON.stringify({ fired: fired2, seq: pos.pulledSeq, userId: st.userId, pushedAt: st.pushedAt, r: r }));
  });

  /* 3. the pull position has its own key. (a) Another tab's whole-state write, read before this sync finished and
     saved after it, lands late; the person then starts fresh on this phone and turns backup on again. */
  var srv3 = syncServer(), stale = null;
  srv3.rows.push(syncRow('p1', 'reflection', T1, note('p1')));
  var w3 = syncWorld(srv3, null, null), S3 = w3.OvuStore, f3 = w3.fetch;
  S3.add('reflection', S3.today(), note('written here'));
  w3.fetch = function (url, opt) { if (!stale && opt && opt.method === 'POST' && /\/entries/.test(url)) stale = w3.localStorage.getItem('ovumind_sync_v1'); return f3(url, opt); };
  var three = w3.OvuSync.syncNow().then(function () {
    w3.localStorage.setItem('ovumind_sync_v1', stale);
    S3.clearAll(); S3.setProfile({ cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' } });
    return w3.OvuSync.syncNow();
  }).then(function () {
    check('the pull position survives another tab\'s late whole-state write, so a cleared diary is not refilled', !!stale && !S3.get('p1') && S3.list('reflection').length === 0, JSON.stringify({ stale: !!stale, p1: !!S3.get('p1'), n: S3.list('reflection').length }));
  });
  /* (b) the first sync after updating starts from an older version's cursor kept in the main state (T2); another
     tab's stale write (T1) lands while that sync's pull is in flight. The cursor must still be T2 afterwards. */
  var srv3b = syncServer(), staleWritten = false;
  srv3b.rows.push(syncRow('m1', 'reflection', T1, note('m1'))); srv3b.rows.push(syncRow('m2', 'reflection', T2, note('m2, cleared here')));
  var legacy = { v: 1, gen: 0, userId: 'u1', shadow: {}, tombstones: {}, pulledSeq: T2, pulledId: 'm2', pushedAt: '2026-10-19T12:00:00.000Z', profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null };
  var w3b = syncWorld(srv3b, function () {
    if (staleWritten) return; staleWritten = true;
    var s = JSON.parse(JSON.stringify(legacy)); s.pulledSeq = T1; s.pulledId = 'm1'; w3b.localStorage.setItem('ovumind_sync_v1', JSON.stringify(s));
  }, legacy);
  var threeB = w3b.OvuSync.syncNow().then(function () { return w3b.OvuSync.syncNow(); }).then(function () {
    check('an older version\'s cursor moves to its own key before the first pull, so a stale write cannot wind it back', staleWritten && !w3b.OvuStore.get('m2'), JSON.stringify({ stale: staleWritten, m2: !!w3b.OvuStore.get('m2'), pos: syncPull(w3b) }));
  });

  /* 4. the generation is read when the sync is asked for, before it waits. (a) A reset while the token is on its way,
     then the same account turning sync back on in another tab: the waiting sync writes nothing. */
  var srv4 = syncServer(), w4 = syncWorld(srv4, null, null), giveToken = null;
  srv4.rows.push(syncRow('g1', 'reflection', T1, note('g1')));
  w4.OvuAuth.token = function () { return new Promise(function (res) { giveToken = function () { res('tok'); }; }); };
  var p4 = w4.OvuSync.syncNow();
  var four = ticks(5).then(function () {
    w4.OvuSync.resetPosition();
    var s = JSON.parse(w4.localStorage.getItem('ovumind_sync_v1') || '{"v":1,"shadow":{},"tombstones":{}}'); s.userId = 'u1'; w4.localStorage.setItem('ovumind_sync_v1', JSON.stringify(s));
    giveToken(); return p4;
  }).then(function (r) {
    var st = syncView(w4), pos = syncPull(w4);
    check('a reset while the token is on its way, then the same account back on elsewhere: the old sync writes nothing', r && r.ok === false && !pos.pulledSeq && st.pushedAt === null && !w4.OvuStore.get('g1'), JSON.stringify({ r: r, seq: pos.pulledSeq, pushedAt: st.pushedAt, g1: !!w4.OvuStore.get('g1') }));
  });
  /* (b) a sync queued in a second tab behind the first, then a reset and the same account back on: when its turn
     comes, the queued sync stops without a request */
  var srv4b = syncServer(), bGets = 0, tabs4 = syncTabs(srv4b, null, function () { bGets++; }), openGate, gate = new Promise(function (r) { openGate = r; }), postSeen, posted = new Promise(function (r) { postSeen = r; });
  srv4b.rows.push(syncRow('k1', 'reflection', T1, note('k1')));
  tabs4.A.OvuStore.add('reflection', tabs4.A.OvuStore.today(), note('written in tab A'));
  var fA4 = tabs4.A.fetch; tabs4.A.fetch = function (url, opt) { if (opt && opt.method === 'POST' && /\/entries/.test(url)) { postSeen(); return gate.then(function () { return fA4(url, opt); }); } return fA4(url, opt); };
  var pA4 = tabs4.A.OvuSync.syncNow(), pB4 = null;
  var fourB = posted.then(function () {
    pB4 = tabs4.B.OvuSync.syncNow();
    return ticks(5);
  }).then(function () {
    tabs4.A.OvuSync.resetPosition();
    var s = JSON.parse(tabs4.A.localStorage.getItem('ovumind_sync_v1') || '{"v":1,"shadow":{},"tombstones":{}}'); s.userId = 'u1'; tabs4.A.localStorage.setItem('ovumind_sync_v1', JSON.stringify(s));
    openGate(); return Promise.all([pA4, pB4]);
  }).then(function (rs) { return tabs4.mgr.idle().then(function () { return rs; }); }).then(function (rs) {
    var st = syncView(tabs4.A);
    check('a sync queued before a reset stops when its turn comes, without a request or a write', rs[1] && rs[1].ok === false && bGets === 0 && st.pushedAt === null && !syncPull(tabs4.A).pulledSeq, JSON.stringify({ rs: rs, bGets: bGets, pushedAt: st.pushedAt }));
  });
  Promise.all([one, oneB, oneC, two, three, threeB, four, fourB]).catch(function (err) { check('the round-four sync tests ran to the end', false, String(err && err.stack || err)); });
})();

(function syncRoundFive() {
  console.log('cloud sync, round five: one writer for the position, random reset tokens, and the consent check bound to its account');
  var T1 = '2026-10-19T11:00:00.000001+00:00', T2 = '2026-10-19T12:00:00.000002+00:00', note = function (t) { return { text: t, mood: '' }; };
  var empty = function (v) { return !v.userId && !v.pulledSeq && !v.pushedAt; };

  /* 1. (round four, finding 1) an older version's cursor (T2) waits in the main state while the sign-in token is on
     its way; another tab's stale write (T1) lands during that wait. The cursor must still be T2 afterwards. */
  var srv1 = syncServer(), give1 = null;
  srv1.rows.push(syncRow('m1', 'reflection', T1, note('m1'))); srv1.rows.push(syncRow('m2', 'reflection', T2, note('m2, cleared here')));
  var legacy1 = { v: 1, gen: 0, userId: 'u1', shadow: {}, tombstones: {}, pulledSeq: T2, pulledId: 'm2', pushedAt: '2026-10-19T12:00:00.000Z', profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null };
  var w1 = syncWorld(srv1, null, legacy1);
  w1.OvuAuth.token = function () { return new Promise(function (r) { give1 = r; }); };
  var p1 = w1.OvuSync.syncNow();
  var one = ticks(5).then(function () {
    var s = JSON.parse(JSON.stringify(legacy1)); s.pulledSeq = T1; s.pulledId = 'm1'; w1.localStorage.setItem('ovumind_sync_v1', JSON.stringify(s));
    give1('tok'); return p1;
  }).then(function () { w1.OvuAuth.token = function () { return Promise.resolve('tok'); }; return w1.OvuSync.syncNow(); }).then(function () {
    check('an older version\'s cursor is kept before the token wait, so a stale write during it cannot wind it back', !w1.OvuStore.get('m2'), JSON.stringify({ m2: !!w1.OvuStore.get('m2'), view: syncView(w1) }));
  });

  /* 2. (round four, finding 2) this phone last synced another account; this sync must switch accounts. Another tab's
     reset lands after this sync read the old account and before it switched: the reset must still win. */
  var srv2 = syncServer(), tabs2 = syncTabs(srv2), armed2 = false, fired2 = false, store2 = tabs2.A.localStorage, get2 = store2.getItem;
  srv2.rows.push(syncRow('n1', 'reflection', T1, note('n1')));
  store2.setItem('ovumind_sync_v1', JSON.stringify({ v: 1, userId: 'old', shadow: {}, tombstones: {}, pulledSeq: T1, pulledId: 'n0', pushedAt: '2026-10-19T11:00:00.000Z', profilePulledAt: '2026-10-19T10:00:00Z', profileDirty: false, lastSyncAt: null }));
  store2.setItem('ovumind_sync_gen_v1', '0'); /* round four's counter, so its generation check does not read the main state (round five ignores it) */
  tabs2.A.OvuAuth.token = function () { return Promise.resolve('tok').then(function (t) { armed2 = true; return t; }); };
  store2.getItem = function (k) {
    var v = get2.call(store2, k);
    /* the main object is read right after the sync has learned which account the position names (round four reads the
       account from it; round five reads the position just before), so the reset lands between that read and the switch */
    if (armed2 && !fired2 && k === 'ovumind_sync_v1') { fired2 = true; tabs2.B.OvuSync.resetPosition(); }
    return v; /* the value read before the reset */
  };
  var two = tabs2.A.OvuSync.syncNow().then(function (r) { return tabs2.mgr.idle().then(function () { return r; }); }).then(function (r) {
    var v = syncView(tabs2.A);
    check('a reset that lands while a sync switches accounts still wins: the old sync stops and the position stays empty', fired2 && r && r.ok === false && empty(v) && !tabs2.A.OvuStore.get('n1'), JSON.stringify({ fired: fired2, r: r, view: v, n1: !!tabs2.A.OvuStore.get('n1') }));
  });

  /* 3. (round four, finding 3) another tab read the main state before this phone's first sync (no account yet) and
     saves it late. The person then starts fresh on this phone and turns backup on again: the next sync must not take
     her for a new phone and download everything again. */
  var srv3 = syncServer();
  srv3.rows.push(syncRow('p1', 'reflection', T1, note('p1')));
  var w3 = syncWorld(srv3, null, null), S3 = w3.OvuStore;
  var three = w3.OvuSync.syncNow().then(function () {
    w3.localStorage.setItem('ovumind_sync_v1', JSON.stringify({ v: 1, userId: null, shadow: {}, tombstones: {}, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: null }));
    S3.clearAll(); S3.setProfile({ cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' } });
    return w3.OvuSync.syncNow();
  }).then(function () {
    check('a late "no account yet" write from another tab does not make the next sync start over', !S3.get('p1'), JSON.stringify({ p1: !!S3.get('p1'), view: syncView(w3) }));
  });

  /* 4. (round four, finding 4) two tabs reset at the same moment, and the second tab asks for a sync in between: the
     two resets must not end up sharing a generation that lets that sync through */
  var srv4 = syncServer(), tabs4 = syncTabs(srv4), inReset = false, pB4 = null, store4 = tabs4.A.localStorage, set4 = store4.setItem;
  srv4.rows.push(syncRow('h1', 'reflection', T1, note('h1')));
  store4.setItem = function (k, v) {
    if (inReset) { inReset = false; tabs4.B.OvuSync.resetPosition(); pB4 = tabs4.B.OvuSync.syncNow(); }
    return set4.call(store4, k, v);
  };
  inReset = true; tabs4.A.OvuSync.resetPosition(); inReset = false;
  var four = Promise.resolve().then(function () { return pB4; }).then(function (rB) { return tabs4.mgr.idle().then(function () { return rB; }); }).then(function (rB) {
    check('overlapping resets in two tabs never let a sync asked for between them through', !!pB4 && rB && rB.ok === false && !tabs4.B.OvuStore.get('h1') && empty(syncView(tabs4.A)), JSON.stringify({ rB: rB, h1: !!tabs4.B.OvuStore.get('h1'), view: syncView(tabs4.A) }));
  });

  /* 5. (round four, finding 5) a consent answer for one account must never be applied to another */
  function consentWorld(srv) {
    var w = syncWorld(srv, null, null), c = { who: 'uA', on: { uA: true, uB: false }, records: [], answer: null };
    w.OvuAuth = { session: function () { return { user: { id: c.who } }; }, token: function () { return Promise.resolve('tok-' + c.who); }, userId: function () { return c.who; } };
    w.OvuStore.setProfile({ cloud: { v: 1, at: '2026-10-20T00:00:00Z', uid: 'uA' } });
    /* the real module's shape: record() stamps the account signed in now, unless told which */
    w.OvuConsent = {
      needsSheet: function () { return false; }, recordedOnAccount: function () { return true; }, flush: function () { return Promise.resolve(0); },
      allows: function (p) { return p !== 'cloud_sync' || !!c.on[c.who]; },
      pullAccountState: function () { return c.hold ? new Promise(function (r) { c.answer = r; }) : Promise.resolve(null); },
      record: function (p, action, method, extra) { var ev = Object.assign({ purpose: p, action: action, method: method, uid: c.who }, extra || {}); c.records.push(ev); if (p === 'cloud_sync' && action === 'withdraw') c.on[ev.uid] = false; return ev; }
    };
    c.switchToB = function () { w.OvuSync.resetPosition(); c.who = 'uB'; c.on.uB = true; w.OvuStore.setProfile({ cloud: { v: 1, at: '2026-10-20T00:05:00Z', uid: 'uB' } }); };
    return { w: w, c: c };
  }
  /* (a) A's account record arrives after a sign-out and B signing in and turning backup on, and says A's backup is off */
  var cw = consentWorld(syncServer()); cw.c.hold = true;
  var p5 = cw.w.OvuSync.syncNow();
  var five = ticks(5).then(function () { cw.c.switchToB(); cw.c.answer({ cloud_sync: { on: false } }); return p5; }).then(function (r) {
    var toB = cw.c.records.filter(function (e) { return e.uid === 'uB'; });
    check('an old account record arriving after a switch never turns off the new account\'s backup', r && r.ok === false && toB.length === 0 && cw.c.on.uB === true, JSON.stringify({ r: r, records: cw.c.records, onB: cw.c.on.uB }));
  });
  /* (b) the server's "backup is off" refusal of A's request arrives after the same switch */
  var cw2 = consentWorld(syncServer()), deliver = null, base2 = cw2.w.fetch;
  cw2.w.fetch = function (url, opt) {
    if (/\/entries/.test(url) && !deliver) return new Promise(function (r) { deliver = function () { r({ ok: false, status: 403, text: function () { return Promise.resolve(JSON.stringify({ message: 'Cloud backup is off for this account' })); } }); }; });
    return base2(url, opt);
  };
  var p5b = cw2.w.OvuSync.syncNow();
  var fiveB = ticks(5).then(function () { cw2.c.switchToB(); deliver(); return p5b; }).then(function (r) {
    var toB = cw2.c.records.filter(function (e) { return e.uid === 'uB'; });
    check('an old account\'s "backup is off" answer arriving after a switch never turns off the new account\'s backup', !!deliver && r && r.ok === false && toB.length === 0 && cw2.c.on.uB === true, JSON.stringify({ r: r, records: cw2.c.records, onB: cw2.c.on.uB }));
  });
  /* 6. (Codex round five) one tab resets; another tab's sync, asked for right after, gets the lock first and finishes
     under the new token. Nothing the reset does afterwards may erase that sync's valid position. */
  var srv6 = syncServer(), tabs6 = syncTabs(srv6), store6 = tabs6.A.localStorage, set6 = store6.setItem, pB6 = null;
  srv6.rows.push(syncRow('v1', 'reflection', T1, note('v1')));
  store6.setItem = function (k, v) {
    var out = set6.call(store6, k, v);
    if (!pB6 && (k === 'ovumind_sync_reset_v1' || k === 'ovumind_sync_gen_v1')) pB6 = tabs6.B.OvuSync.syncNow(); /* right after the reset is published */
    return out;
  };
  tabs6.A.OvuSync.resetPosition();
  var six = Promise.resolve().then(function () { return pB6; }).then(function (rB) { return tabs6.mgr.idle().then(function () { return rB; }); }).then(function (rB) {
    var v = syncView(tabs6.A);
    check('a sync that finishes after a reset keeps its position: the reset never erases later progress', !!pB6 && rB && rB.ok === true && v.userId === 'u1' && v.pulledSeq === T1, JSON.stringify({ rB: rB, view: v }));
  });
  Promise.all([one, two, three, four, five, fiveB, six]).catch(function (err) { check('the round-five sync tests ran to the end', false, String(err && err.stack || err)); });
})();

(function consentLateAnswer() {
  console.log('consent: an answer about one account, arriving after another signed in here, changes nothing on this phone (real ovu-consent.js)');
  function world() {
    var w = syncWorld(syncServer(), null, null), c = { who: 'uA' };
    w.OvuAuth = { session: function () { return c.who ? { user: { id: c.who } } : null; }, token: function () { return Promise.resolve('tok-' + c.who); }, userId: function () { return c.who; } };
    vm.runInContext(fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8'), w, { filename: 'ovu-consent.js' });
    var C = w.OvuConsent;
    C.attestAge('sheet'); C.grant('health_tracking', 'sheet');
    c.signIn = function (u) { c.who = u; C.bindAccount(); C.grant('cloud_sync', 'you'); };
    return { w: w, C: C, c: c };
  }
  function cloudOf(t) { var p = t.w.OvuStore.profile().cloud || {}; return { v: p.v, uid: p.uid || null, allows: t.C.allows('cloud_sync') }; }
  /* 1. A turned backup on; B signed in and turned it on too; then A's account record arrives saying A's backup is off */
  var t1 = world(); t1.c.signIn('uA'); t1.c.signIn('uB');
  var before1 = t1.C.events().length;
  t1.C.record('cloud_sync', 'withdraw', 'server', { sent: true, uid: 'uA' });
  var c1 = cloudOf(t1);
  check('a withdrawal for account A, arriving while B is signed in, leaves B\'s backup on and the log unchanged', c1.v === 1 && c1.uid === 'uB' && c1.allows === true && t1.C.events().length === before1, JSON.stringify({ cloud: c1, events: t1.C.events().length - before1 }));
  /* 2. the same answer for the account that is signed in still counts */
  var t2 = world(); t2.c.signIn('uA');
  t2.C.record('cloud_sync', 'withdraw', 'server', { sent: true, uid: 'uA' });
  var c2 = cloudOf(t2);
  check('a withdrawal for the account that is signed in still turns its backup off', c2.v === 0 && c2.allows === false, JSON.stringify(c2));
  /* 3. nobody signed in any more: an answer for A changes nothing either */
  var t3 = world(); t3.c.signIn('uA'); t3.c.who = null;
  var before3 = t3.C.events().length;
  t3.C.record('cloud_sync', 'withdraw', 'server', { sent: true, uid: 'uA' });
  check('a withdrawal for account A, arriving after a sign-out, changes nothing on this phone', t3.C.events().length === before3 && (t3.w.OvuStore.profile().cloud || {}).uid === 'uA', JSON.stringify({ events: t3.C.events().length - before3, cloud: t3.w.OvuStore.profile().cloud }));
  /* 4. end to end (Codex round five, finding 2): A's sync asks A's account about backup; the answer says off; another tab
     signs B in and turns B's backup on in the instant between the sync's last check and its recording of that answer */
  var t4 = world(); t4.c.signIn('uA');
  var answer = null, C4 = t4.C, realRecord = C4.record, switched = false;
  C4.pullAccountState = function () { return new Promise(function (r) { answer = r; }); };
  C4.record = function (p, action, method, extra) {
    if (!switched && p === 'cloud_sync' && action === 'withdraw' && method === 'server') { switched = true; t4.w.OvuSync.resetPosition(); t4.c.signIn('uB'); }
    return realRecord.apply(this, arguments);
  };
  var p4 = t4.w.OvuSync.syncNow();
  var four = ticks(5).then(function () { answer({ cloud_sync: { on: false } }); return p4; }).then(function (r) {
    var c4 = cloudOf(t4);
    check('A\'s "backup is off" answer recorded just after B signed in elsewhere never turns off B\'s backup', switched && r && r.ok === false && c4.v === 1 && c4.uid === 'uB' && c4.allows === true, JSON.stringify({ switched: switched, r: r, cloud: c4 }));
  });
  four.catch(function (err) { check('the consent late-answer tests ran to the end', false, String(err && err.stack || err)); });
})();

/* ---------- garden, Dream Street, plaza and walking (ovu-walk.js, ovu-garden.js, ovu-street.js, ovu-community.js) ---------- */
function scenes(todayIso) {
  var w = fresh(todayIso);
  ['ovu-walk.js', 'ovu-garden.js', 'ovu-street.js', 'ovu-community.js', 'ovu-shops.js', 'ovu-greenhouse.js', 'ovu-camera.js', 'ovu-petwalk.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), vm.createContext ? w : w, { filename: f }); });
  /* the home layouts live inside room.js, which needs a DOM: lift the LAYOUTS literal out of the source instead */
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), m = /var LAYOUTS = (\{[\s\S]*?\n  \});\n  var L = LAYOUTS\.room/.exec(src);
  w.LAYOUTS = vm.runInContext('(' + m[1] + ')', w);
  w.OvuWalk.dressHomes(w.LAYOUTS);
  w.LAYOUTS.garden = w.OvuGarden.LAYOUT; w.LAYOUTS.street = w.OvuStreet.LAYOUT; w.LAYOUTS.plaza = w.OvuCommunity.LAYOUT;
  Object.keys(w.OvuShops.LAYOUTS).forEach(function (id) { w.LAYOUTS[id] = w.OvuShops.LAYOUTS[id]; });
  w.LAYOUTS.greenhouse = w.OvuGreenhouse.LAYOUT;
  return w;
}
(function walkGeometry() {
  console.log('walking: stays on the floor, slides along furniture, never jumps a wall, doors trigger, depth follows y');
  var w = scenes(), K = w.OvuWalk;
  var diamond = [[50, 50], [90, 70], [50, 90], [10, 70]];
  check('point-in-polygon: centre in, corner out', K.inPoly(diamond, 50, 70) && !K.inPoly(diamond, 5, 70) && !K.inPoly(diamond, 50, 95));
  var world = K.world({ zones: [diamond], solids: [{ id: 'wall', x0: 58, x1: 62, y0: 55, y1: 85 }] }, []);
  var p = K.step(world, { x: 50, y: 70 }, { x: 1, y: 0 }, 2);
  check('a long push to the right stops at the wall instead of crossing it (substeps)', p.moved && p.x < 58 && p.x > 55, JSON.stringify(p));
  var sl = K.step(world, { x: 57.5, y: 70 }, { x: 1, y: 1 }, 0.2);
  check('pushing into the wall diagonally slides down along it', sl.moved && sl.x < 58 && sl.y > 70, JSON.stringify(sl));
  var edge = K.step(world, { x: 49, y: 51 }, { x: 0, y: -1 }, 1);
  check('the floor edge holds', !edge.moved || K.inPoly(diamond, edge.x, edge.y), JSON.stringify(edge));
  var out = K.step(world, { x: 60, y: 70 }, { x: 1, y: 0 }, 0.2);
  check('standing inside furniture after a tap walk, she can still walk out', out.moved && out.x > 62, JSON.stringify(out));
  var still = K.step(world, { x: 50, y: 70 }, { x: 0, y: 0 }, 0.1);
  check('no input, no movement', !still.moved && still.x === 50 && still.y === 70);
  var dy = K.step(world, { x: 50, y: 70 }, { x: 0, y: 1 }, 0.1), dx = K.step(world, { x: 50, y: 70 }, { x: 1, y: 0 }, 0.1);
  check('a stride up the plate is foreshortened against one across', Math.abs((dy.y - 70) / (dx.x - 50) - K.Y_SCALE) < 1e-6, JSON.stringify([dy.y - 70, dx.x - 50]));
  var doors = [{ to: 'garden', x: 76, y: 75, r: 5 }];
  check('door trigger is an ellipse: 4 across hits, 4 down misses', K.doorAt(doors, 80, 75) && !K.doorAt(doors, 76, 79) && !K.doorAt(doors, 70, 75), JSON.stringify([K.doorAt(doors, 80, 75), K.doorAt(doors, 76, 79)]));
  var box = K.propBox({ id: 'cat', x: 50, y: 80, w: 10 });
  check('a pet blocks a narrow box at its feet, not its whole sprite', box.x0 === 46.6 && box.x1 === 53.4 && box.y0 === 77.8 && box.y1 === 81.2, JSON.stringify(box));
  var z = K.depthRank([{ y: 80 }, { y: 60 }, { y: 90 }, { y: 60 }]);
  check('depth ranks lower sprites in front, ties keep order, all between 2 and 9', z.join() === '4,2,5,3' && Math.max.apply(null, z) <= 9 && Math.min.apply(null, z) >= 2, z.join());
  var many = K.depthRank(new Array(30).fill(0).map(function (_, i) { return { y: i * 3 }; }));
  check('thirty sprites still fit under the hotspot pins', Math.max.apply(null, many) === 9 && Math.min.apply(null, many) === 2, JSON.stringify([Math.min.apply(null, many), Math.max.apply(null, many)]));
})();
(function tapToWalkPlanning() {
  console.log('tap to walk: A* around furniture, string pulling, snapping, no corner cutting, unreachable is null');
  var w = scenes(), K = w.OvuWalk;
  var diamond = [[50, 50], [90, 70], [50, 90], [10, 70]];
  var world = K.world({ zones: [diamond], solids: [{ id: 'wall', x0: 48, x1: 52, y0: 55, y1: 82 }] }, []);
  var m = K.rasterise(world), res = K.plan(world, { x: 30, y: 70 }, { x: 70, y: 70 });
  check('a route around the wall exists and ends at the tapped point', res && res.pts.length >= 3 && res.pts[res.pts.length - 1].x === 70 && res.pts[res.pts.length - 1].y === 70 && !res.snapped, JSON.stringify(res));
  check('every leg of the route stays on free cells', res && res.pts.every(function (p, i) { return i === 0 || K.lineFree(m, res.pts[i - 1], p); }));
  check('the route is longer than the straight line it could not take', res && res.cost > 40 && res.cost < 90, res && res.cost);
  var cells = K.astar(m, K.cellOf(30, 70), K.cellOf(70, 70));
  check('string pulling leaves far fewer corners than grid cells', cells && res.pts.length < cells.length / 3, JSON.stringify([cells && cells.length, res && res.pts.length]));
  var sn = K.plan(world, { x: 30, y: 70 }, { x: 50, y: 70 });
  check('a tap on the furniture snaps to the nearest free cell beside it', sn && sn.snapped && K.cellFree(m, K.cellOf(sn.pts[sn.pts.length - 1].x, sn.pts[sn.pts.length - 1].y).c, K.cellOf(sn.pts[sn.pts.length - 1].x, sn.pts[sn.pts.length - 1].y).r), JSON.stringify(sn && sn.pts.slice(-1)));
  check('a tap far off the floor plans nothing', K.plan(world, { x: 30, y: 70 }, { x: 5, y: 20 }) === null);
  var pinch = K.world({ zones: [[[0, 40], [100, 40], [100, 80], [0, 80]]], solids: [{ id: 'a', x0: 0, x1: 50, y0: 40, y1: 60 }, { id: 'b', x0: 50, x1: 100, y0: 60, y1: 80 }] }, []);
  check('two boxes touching at a corner cannot be slipped through diagonally', K.plan(pinch, { x: 25, y: 70 }, { x: 75, y: 50 }) === null);
  var same = K.plan(world, { x: 30, y: 70 }, { x: 30.5, y: 70.2 });
  check('a tap on the spot she stands gives a one-leg route', same && same.pts.length === 2 && same.cost < 2, JSON.stringify(same));
  var inside = K.plan(world, { x: 50, y: 70 }, { x: 70, y: 70 });
  check('starting inside furniture (after a hotspot walk) still finds a way out', inside && inside.pts.length >= 2, JSON.stringify(inside));
  var t0 = Date.now(); for (var i = 0; i < 20; i++) K.plan(world, { x: 30, y: 70 }, { x: 70, y: 70 }); var ms = (Date.now() - t0) / 20;
  check('a plan takes a few milliseconds, cheap enough on every tap', ms < 25, ms + ' ms');
  Object.keys(w.LAYOUTS).forEach(function (id) {
    var L = w.LAYOUTS[id], wl = K.world(L, []), ml = K.rasterise(wl), bad = [];
    var targets = (L.doors || []).map(function (d) { return { name: 'door ' + (d.to || d.tap), x: d.x, y: d.y }; }).concat((L.hotspots || []).filter(function (h) { return h.wp; }).map(function (h) { return { name: 'hotspot ' + h.id, x: h.wp.x, y: h.wp.y }; }));
    targets.forEach(function (t) { var r = K.plan(wl, L.home, t); if (!r) bad.push(t.name + ': no route'); else if (!r.pts.every(function (p, i) { return i === 0 || K.lineFree(ml, r.pts[i - 1], p); })) bad.push(t.name + ': leaves the floor'); });
    check(id + ': from home every door and hotspot is reachable on the floor', bad.length === 0, bad.join('; '));
  });
})();
(function walkCycle() {
  console.log('walk cycle: frames follow distance, directions follow velocity, strips exist for the base outfit');
  var w = scenes(), K = w.OvuWalk;
  check('eight frames, ten a second at full speed, so one cycle per STRIDE iso units', K.FRAMES === 8 && K.FPS === 10 && Math.abs(K.STRIDE - K.SPEED / K.FPS * K.FRAMES) < 1e-9, K.STRIDE);
  var a = 0; var seq = []; for (var i = 0; i < 16; i++) { a = K.cycleAdvance(a, K.STRIDE / 8); seq.push(K.frameOf(a)); }
  check('walking one stride steps through every frame once and wraps', seq.join() === '1,2,3,4,5,6,7,0,1,2,3,4,5,6,7,0', seq.join());
  var b = 0; for (var j = 0; j < 7; j++) b = K.cycleAdvance(b, K.STRIDE * 2 / 7);
  check('the same distance in different step sizes lands on the same phase', Math.abs((((a - b) % 1) + 1.5) % 1 - 0.5) < 1e-9, [a, b].join());
  check('no distance, no frame change', K.frameOf(K.cycleAdvance(0.4, 0)) === K.frameOf(0.4));
  check('mostly sideways uses the side strip, up uses away, down uses towards', K.dirFor(1, 0) === 'side' && K.dirFor(1, 0.3) === 'side' && K.dirFor(0, -1) === 'away' && K.dirFor(0.2, 1) === 'towards' && K.dirFor(-1, 0.2) === 'side');
  ['side', 'away', 'towards'].forEach(function (d) { check('base outfit has a ' + d + ' strip on disk', fs.existsSync(path.join(root, 'assets/room/dream/avatar-walk-base-' + d + '.webp'))); });
  var src = fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8');
  check('the walk engine never sets her outfit or writes the profile', !/setOutfit\(|setProfile\(|outfit:\s*'/.test(src));
})();
(function bigGreenhouse() {
  console.log('the greenhouse: a room through the garden door, every tea growing in it, every plant reachable, pet safety sourced');
  var w = scenes(), K = w.OvuWalk, GH = w.OvuGreenhouse, L = GH.LAYOUT, Gd = w.LAYOUTS.garden;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-herbs.js'), 'utf8'), w, { filename: 'ovu-herbs.js' }); var H = w.OvuHerbs;
  var teaIds = H.TEAS.map(function (t) { return t.id; }).sort().join(), planted = GH.PLANTS.filter(function (p) { return p.kind === 'tea'; }).map(function (p) { return p.id; }).sort().join();
  check('every tea in the tea list grows in the greenhouse, and nothing else is called a tea', teaIds === planted, teaIds + ' | ' + planted);
  var asks = GH.PLANTS.filter(function (p) { return p.kind === 'ask'; });
  check('each herb to ask about first matches a doctor-or-pharmacist caution by name', asks.length === 4 && asks.every(function (p) { return !!GH.info(p, H) && !!GH.info(p, H).ask; }), asks.map(function (p) { return p.id; }).join());
  var houses = GH.PLANTS.filter(function (p) { return p.kind === 'house'; });
  check('the houseplants include a variegated monstera and a pink princess philodendron', houses.some(function (p) { return /monstera/i.test(GH.HOUSE[p.id].name); }) && houses.some(function (p) { return /pink princess/i.test(GH.HOUSE[p.id].name); }));
  check('every houseplant names a pet-safety verdict and a linked source', houses.every(function (p) { var h = GH.HOUSE[p.id]; return /^(toxic|safe)$/.test(h.pets) && /^https:\/\//.test(h.url) && h.src && h.petText; }));
  check('every plant has its sprite on disk', GH.PLANTS.every(function (p) { return fs.existsSync(path.join(root, 'assets/room/dream', GH.sprite(p))); }), GH.PLANTS.filter(function (p) { return !fs.existsSync(path.join(root, 'assets/room/dream', GH.sprite(p))); }).map(function (p) { return p.id; }).join());
  check('the greenhouse plate is on disk', fs.existsSync(path.join(root, 'assets/room/dream', L.img)));
  var wl = K.world(L, []), unreachable = [];
  GH.PLANTS.forEach(function (p) { if (!p.wp) return; if (!K.inZones(L.zones, p.wp.x, p.wp.y) || K.blocked(L.solids, p.wp.x, p.wp.y)) unreachable.push(p.id + ' stand point'); else if (!K.plan(wl, L.home, p.wp)) unreachable.push(p.id + ' no route'); });
  check('every plant with a card has a stand point on the floor that she can walk to from the door', unreachable.length === 0, unreachable.join('; '));
  check('only tools have no card', GH.PLANTS.every(function (p) { return (p.kind === 'tool') === !GH.info(p, H); }));
  var bad = [];
  GH.PLANTS.forEach(function (p) { if (p.kind !== 'tool') GH.careLines(p).forEach(function (l) { if (l.split(/\s+/).length > 18 || /—|should|streak/i.test(l)) bad.push(p.id + ': ' + l); }); });
  check('the mindful minute: four lines a quarter-minute apart, each short, kind and free of em dashes', GH.CARE_SECONDS === 60 && GH.CARE_STEP * 4 === GH.CARE_SECONDS && bad.length === 0, bad.join(' | '));
  var gd = (Gd.doors || []).filter(function (d) { return d.to === 'greenhouse'; })[0], back = (L.doors || []).filter(function (d) { return d.to === 'garden'; })[0];
  check('the garden greenhouse is a door that opens where a walk ends, and the greenhouse has a door back', !!gd && gd.tap === 'greenhouse' && !!back);
  var inG = K.entryFor(L, 'garden', 'garden'), outG = K.entryFor(Gd, 'greenhouse', 'garden');
  check('arriving inside she stands on the doormat; leaving she stands at the greenhouse door in the garden', Math.abs(inG.x - back.x) < 0.01 && Math.abs(inG.y - back.y) < 0.01 && Math.abs(outG.x - gd.x) < 0.01 && Math.abs(outG.y - gd.y) < 0.01, JSON.stringify([inG, outG]));
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-map.js'), 'utf8'), w, { filename: 'ovu-map.js' });
  var Mp = w.OvuMap, g = Mp.graph(w.LAYOUTS, 'room'), outR = Mp.route(g, 'greenhouse', 'home'), inR = Mp.route(g, 'home', 'greenhouse');
  check('the map finds the greenhouse through the garden door, by its own name and icon, with no shortcut', !!g.nodes.greenhouse && g.nodes.greenhouse.name === 'Greenhouse' && g.nodes.greenhouse.icon === 'local_florist' && K.sceneOf(L) === 'garden', JSON.stringify(g.nodes.greenhouse));
  check('the way home from the greenhouse is its door, then the garden gate; the way in ends at the greenhouse door', outR && outR.length === 2 && outR[0].door === 'ghdoor' && outR[0].to === 'garden' && inR && inR[inR.length - 1].door === 'greenhouse', JSON.stringify([outR, inR]));
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-sound.js'), 'utf8'), w, { filename: 'ovu-sound.js' });
  check('the greenhouse sounds like stone tiles underfoot, and a plant minute ends with the watering sound', w.OvuSound.surfaceFor(L) === 'stone' && w.OvuSound.surfaceFor(Gd) === 'grass' && w.OvuSound.forMoment('plantcare') === 'water');
  check('string of pearls is never misted (RHS: a succulent that dislikes humidity); the other houseplants are', !GH.careLines(GH.plant('pearls')).some(function (l) { return /mist/i.test(l); }) && /mist/i.test(GH.careLines(GH.plant('monstera'))[0]));
  var MO = w.OvuMoments;
  check('a greenhouse minute ends with its own plant-care moment, not the two-minute practice line', MO.forEntry({ type: 'mindfulness', data: { kind: 'informal', practice: 'greenhouse' } }) === 'plantcare' && MO.pose('plantcare') === 'plants' && MO.forEntry({ type: 'mindfulness', data: { kind: 'informal', practice: 'teeth' } }) === 'practice');
})();

(function layoutsAreWalkable() {
  console.log('every stand point the engine uses is on a floor and clear of furniture, in every home and outdoors');
  var w = scenes(), K = w.OvuWalk;
  Object.keys(w.LAYOUTS).forEach(function (id) { var bad = K.checkLayout(w.LAYOUTS[id]); check(id + ': home, waypoints, doors and stairs are walkable', bad.length === 0, bad.join('; ')); });
  check('every home has a door into the garden', ['room', 'house', 'bathhouse', 'familyhome'].every(function (id) { return w.LAYOUTS[id].hotspots.some(function (h) { return h.id === 'door'; }) && w.LAYOUTS[id].doors[0].to === 'garden'; }));
  check('dressing the homes twice adds no second door', (w.OvuWalk.dressHomes(w.LAYOUTS), w.LAYOUTS.room.hotspots.filter(function (h) { return h.id === 'door'; }).length === 1));
})();
(function sceneMap() {
  console.log('the map: home to garden to Dream Street to plaza, with a gate home from the plaza');
  var w = scenes(), K = w.OvuWalk, L = w.LAYOUTS;
  function leads(from, to) { return (L[from].doors || []).some(function (d) { return d.to === to; }); }
  check('garden leads home and to the street', leads('garden', 'home') && leads('garden', 'street'));
  check('the street leads back to the garden and on to the plaza', leads('street', 'garden') && leads('street', 'plaza'));
  check('the plaza leads back to the street and home', leads('plaza', 'street') && leads('plaza', 'home'));
  check('storefront doors tap the store instead of travelling', L.street.doors.filter(function (d) { return d.tap; }).map(function (d) { return d.tap; }).join() === 'petshop,furniture,homes' && w.OvuStreet.STORES.map(function (s) { return s.tab; }).join() === 'pet,furniture,home');
  var e = K.entryFor(L.garden, 'room', 'home'), e2 = K.entryFor(L.street, 'garden', 'garden'), e3 = K.entryFor(L.plaza, 'street', 'street'), e4 = K.entryFor(L.room, 'garden', 'garden');
  var e5 = K.entryFor(L.street, 'shop-pet', 'street'); check('leaving the pet shop puts you on its own doorstep, not the garden arch', e5.x === 23 && e5.y === 58, JSON.stringify(e5));
  check('arriving puts you at the door you came through', e.x === 29 && e.y === 58 && e2.x === 16 && e3.x === 20 && e4.x === 77, JSON.stringify([e, e2, e3, e4]));
  var e6 = K.entryFor(L.street, 'plaza', 'plaza'); check('arriving from the plaza puts her at the street\'s right-hand arch', e6.x === 84 && e6.y === 60, JSON.stringify(e6));
  check('scene of a layout: homes are home, the others are themselves', K.sceneOf(L.room) === 'home' && K.sceneOf(L.familyhome) === 'home' && K.sceneOf(L.garden) === 'garden' && K.sceneOf(L.street) === 'street' && K.sceneOf(L.plaza) === 'plaza');
  check('outdoors only pets come along; the street and plaza show none of your things', L.garden.only.join() === 'pet' && L.plaza.only.length === 0 && L.street.only.length === 0);
  check('the mini-map knows four places', K.SCENES.join() === 'home,garden,street,plaza');
})();
(function storeInteriors() {
  console.log('store interiors: every catalogue item has a shelf spot that is walkable, doors lead back to the street');
  var w = scenes(), K = w.OvuWalk, L = w.LAYOUTS, SH = w.OvuShops, RW = w.OvuRewards;
  check('the three stores are layouts on the street scene with a door mat home', ['shop-pet', 'shop-furniture', 'shop-homes'].every(function (id) { return L[id] && L[id].scene === 'street' && L[id].doors[0].to === 'street' && L[id].hotspots.some(function (h) { return h.id === 'mat'; }); }));
  check('the street doors lead into the interiors and back out onto the same doorstep', w.OvuStreet.STORES.every(function (s) { var d = L.street.doors.filter(function (x) { return x.to === s.layout; })[0]; var e = K.entryFor(L.street, s.layout); return d && e.x === d.x && e.y === d.y; }));
  Object.keys(SH.LAYOUTS).forEach(function (id) {
    var pl = SH.placements(id, RW.SHOP), kinds = SH.KINDS[id];
    var missing = RW.SHOP.filter(function (it) { return kinds.indexOf(it.kind) > -1 && !pl.some(function (p) { return p.item.id === it.id; }); }).map(function (it) { return it.id; });
    check(id + ': every catalogue item of its kinds has a spot', missing.length === 0, 'unplaced: ' + missing.join(','));
    var wld = K.world(L[id], []), bad = pl.filter(function (p) { return !K.inZones(wld.zones, p.spot.wp.x, p.spot.wp.y) || K.blocked(wld.solids, p.spot.wp.x, p.spot.wp.y); }).map(function (p) { return p.item.id; });
    check(id + ': every item stand point is on the floor and clear of furniture', bad.length === 0, bad.join(','));
    var ids = pl.map(function (p) { return p.item.id; }); check(id + ': no two items share a spot', pl.length === new Set(pl.map(function (p) { return p.spot.x + ',' + p.spot.y; })).size && ids.length === new Set(ids).size);
  });
  Object.keys(SH.LAYOUTS).forEach(function (id) { var cap = SH.capacity(id), counts = {}; RW.SHOP.forEach(function (it) { if (SH.KINDS[id].indexOf(it.kind) > -1) counts[it.kind] = (counts[it.kind] || 0) + 1; }); check(id + ': every kind keeps spare spots for new stock', Object.keys(counts).every(function (k) { return cap[k] > counts[k]; }), JSON.stringify({ cap: cap, counts: counts })); });
  check('the furniture store groups by slot: lamps together, seats together, corner pieces together', (function () { var pl = SH.placements('shop-furniture', RW.SHOP), g = {}; pl.forEach(function (p) { g[p.item.slot || 'other'] = g[p.item.slot || 'other'] || []; g[p.item.slot || 'other'].push(p.group); }); return Object.keys(g).every(function (k) { return g[k].every(function (x) { return x === k; }); }) && g.lamp.length === 3 && g.seat.length === 2 && g.corner.length === 2; })());
  check('house models have a keyed sprite on disk', Object.keys(SH.MODELS).every(function (id) { return fs.existsSync(path.join(root, 'assets/room/dream', SH.MODELS[id])); }));
  /* the cubbies under the pet shop awning are three units tall: they are kept for the bow and the charm, so selling one never drops the party hat in */
  var cub = function (pl) { return pl.filter(function (p) { return p.spot.y < 38 && p.spot.x < 62; }).map(function (p) { return p.item.id; }).sort().join(); };
  check('pet shop: the awning cubbies hold the bow and the moon charm, and only those, before and after a sale', cub(SH.placements('shop-pet', RW.SHOP)) === 'acc-bow,acc-charm' && cub(SH.placements('shop-pet', RW.SHOP, { owned: ['acc-bow'] })) === 'acc-charm' && SH.placements('shop-pet', RW.SHOP, { owned: ['acc-bow'] }).filter(function (p) { return p.item.id === 'acc-hat'; })[0].spot.item === 'acc-hat');
  /* upstairs pets sit on the floor drawn behind the balcony railing or on the landing, never on the railing (its top runs at about y 41 to 44) */
  var up = SH.placements('shop-pet', RW.SHOP).filter(function (p) { return p.kind === 'pet' && p.spot.y < 50; });
  check('pet shop: three pets upstairs, each on the upstairs floor zone (balcony or landing), none on the railing', up.length === 3 && up.every(function (p) { return K.inZones([L['shop-pet'].zones[1]], p.spot.x, p.spot.y); }), JSON.stringify(up.map(function (p) { return [p.item.id, p.spot.x, p.spot.y]; })));
  var pw = K.world(L['shop-pet'], []), toLanding = K.plan(pw, L['shop-pet'].home, { x: 57.5, y: 44 }), toBalcony = K.plan(pw, L['shop-pet'].home, { x: 40, y: 40.5 });
  check('pet shop: a free walk from the door mat climbs the stairs to the landing and on to the balcony', !!toLanding && !!toBalcony, JSON.stringify([!!toLanding, !!toBalcony]));
  /* every leg of a planned route stays on the drawn floor in true geometry, so the walk arrives and the card opens */
  var legsOK = function (wld, a, b) { var r = K.plan(wld, a, b); if (!r) return 'no route'; for (var i = 1; i < r.pts.length; i++) if (!K.segClear(wld, r.pts[i - 1], r.pts[i], null)) return 'leg ' + i + ' leaves the floor ' + JSON.stringify([r.pts[i - 1], r.pts[i]]); return ''; };
  var petLegs = [[{ x: 46, y: 40 }, { x: 57.5, y: 44 }], [{ x: 57.5, y: 44 }, { x: 36, y: 41.5 }], [{ x: 30, y: 41.5 }, { x: 62, y: 44.5 }], [L['shop-pet'].home, { x: 55, y: 43.2 }], [{ x: 57.5, y: 44 }, L['shop-pet'].home]].map(function (q) { return legsOK(pw, q[0], q[1]); }).filter(Boolean);
  check('pet shop: walks between the balcony, the landing and the door mat keep every leg on the floor (none stops short behind the stair post)', petLegs.length === 0, petLegs.join('; '));
  var sold = SH.placements('shop-pet', RW.SHOP, { owned: ['cat', 'acc-bow', 'treat-fish'] }, w.LAYOUTS.room.props);
  check('bought pets and accessories leave the shelf; treats restock; shelf widths follow the room props', !sold.some(function (p) { return p.item.id === 'cat' || p.item.id === 'acc-bow'; }) && sold.some(function (p) { return p.item.id === 'treat-fish'; }) && sold.filter(function (p) { return p.item.id === 'dog'; })[0].w === w.LAYOUTS.room.props.dog.w * 1.02, JSON.stringify(sold.map(function (p) { return p.item.id + ':' + p.w; })));
})();
(function launchDeleteSweep() {
  console.log('launch sweep (20 Oct): Delete everything leaves no older copy behind; a cloud deletion empties the entry on the server');
  var w = fresh('2026-10-20'), S = w.OvuStore, L = w.localStorage;
  S.add('food', '2026-10-20', { meal: 'lunch', foods: 'laksa', items: [] });
  S.add('sleep', '2026-10-20', { bedTime: '23:00', wakeTime: '07:00', quality: 4 });
  S.add('period', '2026-10-18', { flow: 'medium' });
  ['ovuluna_daily_log_2026-10-01', 'ovuluna_medas14', 'ovuluna_ovarian_age', 'ov_hydro', 'ovumind_room', 'rhythme_podcast_v1'].forEach(function (k) { L.setItem(k, '{"x":1}'); });
  L.setItem('ovumind_auth_v1', '{"s":1}'); L.setItem('ovumind_sync_v1', '{"v":1}'); L.setItem('rhythme_plus_v1', '{"t":1}'); L.setItem('other_site_key', 'keep'); L.setItem('ov_unrelated_site', 'keep');
  var mine = function () { return Object.keys(L._m).filter(function (k) { return /^(ovumind_|ovuluna_|ov_|rhythme_)/.test(k); }).sort(); }, before = mine();
  S.clearAll();
  var left = mine();
  check('Delete everything removes the diary and every older copy by an explicit list (meal and sleep mirrors, cycle mirror, earlier pages\' logs and scores, podcast listening), keeping the sign-in, backup bookkeeping and Plus access (plus a fresh diary token, which is not diary data), and never another project\'s key on the shared origin', before.indexOf('ovumind_food_journal') > -1 && before.indexOf('ovuluna_sleep_logs') > -1 && left.join() === 'ov_unrelated_site,ovumind_auth_v1,ovumind_db_epoch_v1,ovumind_db_v1,ovumind_sync_v1,rhythme_plus_v1' && S.list(null).length === 0 && L.getItem('other_site_key') === 'keep', JSON.stringify({ before: before, left: left }));
  var w3 = fresh('2026-10-20'), S3 = w3.OvuStore, L3 = w3.localStorage;
  var pe = S3.add('period', '2026-10-18', { flow: 'medium' }); var hadCycle = !!L3.getItem('ovumind_cycle'); S3.remove(pe.id);
  S3.add('food', '2026-10-20', { meal: 'lunch', foods: 'laksa', items: [] }); S3.add('sleep', '2026-10-20', { bedTime: '23:00', wakeTime: '07:00', quality: 4 });
  S3.removeWhere(function (e) { return e.type === 'food' || e.type === 'sleep'; });
  var fj = JSON.parse(L3.getItem('ovumind_food_journal') || '{}'), meals = Object.keys(fj).reduce(function (n, d) { return n + ['breakfast', 'lunch', 'dinner', 'snack'].reduce(function (m, k) { return m + ((fj[d][k] || []).length); }, 0); }, 0), sl = JSON.parse(L3.getItem('ovuluna_sleep_logs') || '[]');
  check('deleting the last period removes its cycle copy; deleting meals and nights together removes their older copies too', hadCycle && !L3.getItem('ovumind_cycle') && meals === 0 && sl.length === 0, JSON.stringify({ hadCycle: hadCycle, cycle: L3.getItem('ovumind_cycle'), meals: meals, sleep: sl.length }));
  var w4 = fresh('2026-10-20'), S4 = w4.OvuStore, L4 = w4.localStorage, fe = S4.add('food', '2026-10-20', { meal: 'lunch', foods: 'laksa', items: [] });
  S4.update(fe.id, { date: '2026-10-18' }); S4.remove(fe.id);
  var fj4 = JSON.parse(L4.getItem('ovumind_food_journal') || '{}'), left4 = JSON.stringify(fj4).indexOf(fe.id) > -1;
  var plSrc = fs.readFileSync(path.join(root, 'privacy-local.js'), 'utf8'), plRe = /\['((?:ov|rhythme)[a-z_0-9]*)', ['"]/g, plM, plKeys = []; while ((plM = plRe.exec(plSrc))) plKeys.push(plM[1]); var own = S4.OWN_KEYS.concat(S4.KEEP_ON_CLEAR, ['ovumind_db_v1', 'ovumind_sync_v1']);
  var missing = plKeys.filter(function (k) { return own.indexOf(k) < 0; });
  check('a meal moved to another date and then deleted leaves no copy on either date; every store the privacy page lists is one Delete everything knows, and the sign-in is never listed for export', !left4 && missing.length === 0 && plKeys.indexOf('ovumind_auth_v1') < 0, JSON.stringify({ left4: left4, missing: missing }));
  var srv = syncServer(); srv.rows.push(syncRow('del1', 'reflection', '2026-10-19T09:00:00.000000+00:00', { text: 'a private note', mood: 'low' }));
  var w2 = syncWorld(srv, null, null), S2 = w2.OvuStore, Y2 = w2.OvuSync, patches = [], f0 = w2.fetch;
  w2.fetch = function (url, opt) { if (opt && opt.method === 'PATCH') patches.push(JSON.parse(opt.body)); return f0(url, opt); };
  Y2.init(); /* listens for single-entry deletes, as the app does at start */
  Y2.syncNow().then(function () { S2.remove('del1'); return Y2.syncNow(); }).then(function () {
    check('a deletion sent to the cloud copy marks it deleted and empties its data, so nothing readable is left on the server', patches.length >= 1 && patches.every(function (p) { return p.deleted === true && JSON.stringify(p.data) === '{}'; }), JSON.stringify(patches));
  }).catch(function (e) { check('a deletion sent to the cloud copy marks it deleted and empties its data', false, String(e && e.stack || e)); });
})();
(function launchAiGuards() {
  console.log('launch sweep (20 Oct): Luna\'s AI help is paused, and a signed-in request never goes out without the account');
  var w = fresh('2026-10-20'), O = w.OvuOrb, sent = [];
  delete w.OvuConsent; /* this sweep is about the account gate, with no consent module present */
  w.localStorage.setItem('ovumind_ai_v1', JSON.stringify({ on: true, provider: 'ovumind', insights: true, photos: true }));
  w.fetch = function (u) { sent.push(String(u)); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ entries: [], reply: 'ok' }); } }); };
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-insight.js'), 'utf8'), w, { filename: 'ovu-insight.js' });
  var I = w.OvuInsight;
  w.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve(null); }, userId: function () { return 'u1'; } };
  w.OVU_CONFIG = { aiPaused: false };
  var r1 = O.parseAI('slept badly').then(function () { return 'sent'; }, function (e) { return e.message; });
  var r2 = I.daily ? I.daily('2026-10-20', true).then(function () { return 'sent'; }, function (e) { return e.message; }) : Promise.resolve('no daily');
  Promise.all([r1, r2]).then(function (rs) {
    check('signed in with a token that cannot be refreshed: the note and the reading stop with "sign in again" and nothing is sent without the account', /sign in again/i.test(rs[0]) && (/sign in again/i.test(rs[1]) || rs[1] === 'no daily') && sent.length === 0, JSON.stringify({ rs: rs, sent: sent }));
    w.OVU_CONFIG = { aiPaused: true }; w.OvuAuth = null;
    return O.parseAI('slept badly').then(function () { return 'sent'; }, function (e) { return e.message; }).then(function (m) {
      check('with the launch setting (aiPaused) a note is not sent to the AI service, even when the AI choice was on before', /paused/.test(m) && sent.length === 0, JSON.stringify({ m: m, sent: sent }));
    });
  }).catch(function (e) { check('launch AI guards', false, String(e && e.stack || e)); });
})();
(function launchPassphrase() {
  var w = fresh(), C = w.OvuStore.crypto, a = C.PASS_ALPHABET, seen = {}, ok = true;
  for (var i = 0; i < 200; i++) { var p = C.generatePassphrase(); seen[p] = 1; if (!/^([A-Z2-9]{4}-){6}[A-Z2-9]{4}$/.test(p) || /[IO01]/.test(p)) ok = false; }
  check('a share passphrase is 28 characters from 32 distinct easy letters and digits (140 random bits), never repeating in 200 draws', a.length === 32 && new Set(a.split('')).size === 32 && ok && Object.keys(seen).length === 200, a);
})();
(function launchAiAfterSessionEnds() {
  var w = fresh('2026-10-20'), sent = [];
  w.OVU_CONFIG = { aiPaused: false };
  w.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve('tok'); }, userId: function () { return 'u1'; } };
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8'), w, { filename: 'ovu-consent.js' });
  w.fetch = function (u) { sent.push(String(u)); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ entries: [], reply: 'ok' }); } }); };
  w.OvuConsent.setMany({ ai_reading: true }, 'settings'); /* recorded while signed in, so bound to the account */
  var bound = w.OvuConsent.boundTo('ai_reading');
  w.OvuAuth = { session: function () { return null; }, token: function () { return Promise.resolve(null); }, userId: function () { return null; } }; /* the session has since ended */
  w.OvuOrb.parseAI('slept badly').then(function () { return 'sent'; }, function (e) { return e.message; }).then(function (m) {
    check('after the session ends, an AI choice recorded on the account asks to sign in again and sends nothing anonymously', bound && /sign in again/i.test(m) && sent.length === 0, JSON.stringify({ bound: bound, m: m, sent: sent }));
  });
})();
(function supersededImproveMirror() {
  console.log('phase 0 (22 Oct): an older unsent improve-logging mirror is closed as superseded, never counted as pending or claimed as sent');
  var w = fresh('2026-10-22'), posts = [];
  var local = { on: false, uid: 'u1', syncedAt: '2026-10-22T00:00:00Z' }; /* the account's record, as this phone last read it: off */
  w.OvuAuth = { session: function () { return { user: { id: 'u1' } }; }, token: function () { return Promise.resolve('tok'); }, userId: function () { return 'u1'; }, setImprove: function () { }, improveLocal: function () { return local; } };
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8'), w, { filename: 'ovu-consent.js' });
  w.fetch = function (u, o) { posts.push(String(u)); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: posts.length }); } }); };
  var C = w.OvuConsent;
  C.record('improve_logging', 'grant', 'you'); C.record('improve_logging', 'withdraw', 'you'); /* the account adopted the withdrawal */
  C.flush().then(function () { return C.flush(); }).then(function () {
    var evs = (w.OvuStore.profile().consentEvents || []).filter(function (e) { return e.purpose === 'improve_logging'; }), r = C.receipt();
    var grant = evs[0], wd = evs[evs.length - 1];
    check('the superseded grant is closed (superseded, not sent), the withdrawal is recorded via the account, and nothing is left pending', grant.superseded === true && !grant.sent && wd.sent === true && r.pending === 0 && C.recordedOnAccount('improve_logging') && !posts.some(function (u) { return /consent_record/.test(u); }), JSON.stringify({ evs: evs, pending: r.pending, posts: posts }));
  });
})();
(function dashboardFeedHold() {
  console.log('phase 0 (22 Oct): a hold reaches an open dashboard: the cached feed is dropped, late answers are ignored, a failed reload is retried');
  var el = function () { return { innerHTML: '', textContent: '', className: '', style: {}, dataset: {}, classList: { add: function () { }, remove: function () { }, toggle: function () { } }, setAttribute: function () { }, addEventListener: function () { }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, insertAdjacentHTML: function () { }, appendChild: function () { } }; };
  var w = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () { }, Promise: Promise, JSON: JSON, Date: Date, Math: Math, String: String, Number: Number, Array: Array, Object: Object, encodeURIComponent: encodeURIComponent, location: { search: '', hash: '', href: 'x' }, history: { replaceState: function () { } } };
  w.window = w; w.document = { getElementById: function () { return el(); }, createElement: el, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () { }, body: el(), documentElement: el(), hidden: false };
  w.OVU_CONFIG = { supabaseUrl: 'https://t.invalid', supabaseKey: 'k' };
  w.OvuAuth = { token: function () { return 't'; }, init: function () { return new Promise(function () { }); }, session: function () { return null; } };
  w.__ADMIN_TEST__ = {};
  var answers = {}, pendingFeed = [];
  w.fetch = function (u, o) {
    var name = String(u).split('/rpc/')[1], body = JSON.parse(o.body || '{}');
    if (name === 'admin_feed') return new Promise(function (res, rej) { pendingFeed.push({ args: body, res: function (rows) { res({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(rows)); } }); }, rej: function () { res({ ok: false, status: 500, text: function () { return Promise.resolve('{"message":"down"}'); } }); } }); });
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(answers[name] || {})); } });
  };
  if (!w.addEventListener) w.addEventListener = function () { }; /* a window has one: admin.js listens for another tab's sign-in */
  vm.runInContext(fs.readFileSync(path.join(root, 'admin.js'), 'utf8'), vm.createContext(w), { filename: 'admin.js' });
  var T = w.__ADMIN_TEST__.api; T.setTab('none');
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var oldRow = [{ id: 5, run_id: 'r1', title: 'cycle: 21 eligible adults', detail: { summary: { eligible: 21 } } }];
  answers.admin_overview = { latest_run: 'r1', held_runs: 0 };
  openHarness.dashboardFeedHold = true;
  T.loadOverview().then(tick).then(tick).then(function () {
    pendingFeed.shift().res(oldRow); /* the first overview's own full reload */ return tick().then(tick);
  }).then(function () {
    var inc = T.loadFeed(false); /* an incremental poll sent before the hold lands, answered late */
    answers.admin_overview = { latest_run: null, held_runs: 1 };
    return tick().then(function () { return T.loadOverview(); }).then(tick).then(tick).then(function () {
      var cleared = T.state().feed.length === 0 && T.state().needsFull;
      var full = pendingFeed.pop(); full.rej(); /* the full reload fails */
      var late = pendingFeed.shift(); late.res(oldRow); /* the stale incremental answer arrives afterwards */
      return Promise.all([inc]).then(tick).then(function () {
        var st = T.state();
        check('a hold drops the cached feed at once, and neither a failed reload nor a late older answer brings the held words back', cleared && st.feed.length === 0 && st.needsFull === true, JSON.stringify(st));
        var retry = T.loadFeed(false); /* the next ordinary poll is turned into the owed full reload */
        var wasFull = null;
        return tick().then(function () { var req = pendingFeed.shift(); wasFull = !('p_after' in req.args);
        req.res([{ id: 6, title: 'orchestrator: (held: an account withdrew the improvement choice)', detail: { held: true } }]);
        return retry; }).then(function () { var s2 = T.state(); check('the next poll makes the owed full reload, and once it succeeds the feed holds only redacted rows', wasFull && s2.needsFull === false && s2.feed.length === 1 && s2.feed[0].detail.held === true, JSON.stringify({ wasFull: wasFull, s2: s2 })); delete openHarness.dashboardFeedHold; });
      });
    });
  }).catch(function (e) { check('dashboard feed hold harness ran', false, String(e && e.stack || e)); });
})();
(function dashboardFeedFirstLoad() {
  console.log('phase 0 (23 Oct): on first load, a feed answer sent before a hold never outlives the first overview');
  var el = function () { return { innerHTML: '', textContent: '', className: '', style: {}, dataset: {}, classList: { add: function () { }, remove: function () { }, toggle: function () { } }, setAttribute: function () { }, addEventListener: function () { }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, insertAdjacentHTML: function () { }, appendChild: function () { } }; };
  var w = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () { }, Promise: Promise, JSON: JSON, Date: Date, Math: Math, String: String, Number: Number, Array: Array, Object: Object, encodeURIComponent: encodeURIComponent, location: { search: '', hash: '', href: 'x' }, history: { replaceState: function () { } } };
  w.window = w; w.document = { getElementById: function () { return el(); }, createElement: el, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () { }, body: el(), documentElement: el(), hidden: false };
  w.OVU_CONFIG = { supabaseUrl: 'https://t.invalid', supabaseKey: 'k' };
  w.OvuAuth = { token: function () { return 't'; }, init: function () { return new Promise(function () { }); }, session: function () { return null; } };
  w.__ADMIN_TEST__ = {};
  var pendingFeed = [];
  w.fetch = function (u, o) {
    var name = String(u).split('/rpc/')[1], body = JSON.parse(o.body || '{}');
    if (name === 'admin_feed') return new Promise(function (res) { pendingFeed.push({ args: body, res: function (rows) { res({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(rows)); } }); } }); });
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ latest_run: null, held_runs: 1 })); } });
  };
  if (!w.addEventListener) w.addEventListener = function () { }; /* a window has one: admin.js listens for another tab's sign-in */
  vm.runInContext(fs.readFileSync(path.join(root, 'admin.js'), 'utf8'), vm.createContext(w), { filename: 'admin.js' });
  var T = w.__ADMIN_TEST__.api; T.setTab('none');
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  openHarness.dashboardFeedFirstLoad = true;
  var boot = T.loadFeed(false); /* boot starts the feed and the overview together */
  tick().then(function () { return T.loadOverview(); }).then(tick).then(tick).then(function () {
    var early = pendingFeed.shift(), full = pendingFeed.shift();
    full.res([{ id: 6, title: 'orchestrator: (held: an account withdrew the improvement choice)', detail: { held: true } }]);
    return tick().then(function () { early.res([{ id: 5, title: 'cycle: 21 eligible adults', detail: { summary: { eligible: 21 } } }]); return boot; }).then(tick).then(function () {
      var st = T.state();
      check('the first overview owes a full reload, and the slower pre-hold answer from boot cannot bring its words back', !!full && !('p_after' in full.args) && st.needsFull === false && st.feed.length === 1 && st.feed[0].detail.held === true, JSON.stringify(st));
      delete openHarness.dashboardFeedFirstLoad;
    });
  }).catch(function (e) { check('dashboard first-load harness ran', false, String(e && e.stack || e)); });
})();
(function dashboardFeedFirstLoadFails() {
  console.log('phase 0 (23 Oct): a boot feed answered before the first overview is dropped even when the owed reload fails');
  var el = function () { return { innerHTML: '', textContent: '', className: '', style: {}, dataset: {}, classList: { add: function () { }, remove: function () { }, toggle: function () { } }, setAttribute: function () { }, addEventListener: function () { }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, insertAdjacentHTML: function () { }, appendChild: function () { } }; };
  var w = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () { }, Promise: Promise, JSON: JSON, Date: Date, Math: Math, String: String, Number: Number, Array: Array, Object: Object, encodeURIComponent: encodeURIComponent, location: { search: '', hash: '', href: 'x' }, history: { replaceState: function () { } } };
  w.window = w; w.document = { getElementById: function () { return el(); }, createElement: el, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () { }, body: el(), documentElement: el(), hidden: false };
  w.OVU_CONFIG = { supabaseUrl: 'https://t.invalid', supabaseKey: 'k' };
  w.OvuAuth = { token: function () { return 't'; }, init: function () { return new Promise(function () { }); }, session: function () { return null; } };
  w.__ADMIN_TEST__ = {};
  var pendingFeed = [];
  w.fetch = function (u, o) {
    var name = String(u).split('/rpc/')[1], body = JSON.parse(o.body || '{}');
    if (name === 'admin_feed') return new Promise(function (res) { pendingFeed.push({ args: body, res: function (rows) { res({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(rows)); } }); }, rej: function () { res({ ok: false, status: 500, text: function () { return Promise.resolve('{"message":"down"}'); } }); } }); });
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ latest_run: null, held_runs: 1 })); } });
  };
  if (!w.addEventListener) w.addEventListener = function () { }; /* a window has one: admin.js listens for another tab's sign-in */
  vm.runInContext(fs.readFileSync(path.join(root, 'admin.js'), 'utf8'), vm.createContext(w), { filename: 'admin.js' });
  var T = w.__ADMIN_TEST__.api; T.setTab('none');
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  openHarness.dashboardFeedFirstLoadFails = true;
  var boot = T.loadFeed(false);
  tick().then(function () { pendingFeed.shift().res([{ id: 5, title: 'cycle: 21 eligible adults', detail: { summary: { eligible: 21 } } }]); return boot; }).then(tick).then(function () {
    var before = T.state().feed.length;
    return T.loadOverview().then(tick).then(tick).then(function () {
      pendingFeed.shift().rej(); /* the owed full reload fails */
      return tick().then(tick).then(function () { return T.loadOverview(); }).then(tick).then(tick).then(function () {
        var st = T.state();
        check('a pre-hold boot feed is dropped by the first overview and stays dropped while the owed reload fails', before === 1 && st.feed.length === 0 && st.needsFull === true, JSON.stringify({ before: before, st: st }));
        delete openHarness.dashboardFeedFirstLoadFails;
      });
    });
  }).catch(function (e) { check('dashboard first-load failure harness ran', false, String(e && e.stack || e)); });
})();
(function dashboardHoldPaths() {
  console.log('phase 0 (23 Oct): a hold that arrives in a feed poll clears the feed, and an older overview answer cannot restore held summaries');
  function harness() {
    var el = function () { return { innerHTML: '', textContent: '', className: '', style: {}, dataset: {}, classList: { add: function () { }, remove: function () { }, toggle: function () { } }, setAttribute: function () { }, addEventListener: function () { }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, insertAdjacentHTML: function () { }, appendChild: function () { } }; };
    var w = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () { }, Promise: Promise, JSON: JSON, Date: Date, Math: Math, String: String, Number: Number, Array: Array, Object: Object, encodeURIComponent: encodeURIComponent, location: { search: '', hash: '', href: 'x' }, history: { replaceState: function () { } } };
    w.window = w; w.document = { getElementById: function () { return el(); }, createElement: el, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () { }, body: el(), documentElement: el(), hidden: false };
    w.OVU_CONFIG = { supabaseUrl: 'https://t.invalid', supabaseKey: 'k' };
    w.OvuAuth = { token: function () { return 't'; }, init: function () { return new Promise(function () { }); }, session: function () { return null; } };
    w.__ADMIN_TEST__ = {};
    var h = { feed: [], ov: [] };
    var pend = function (list, body) { return new Promise(function (res) { list.push({ args: body, res: function (v) { res({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(v)); } }); }, rej: function () { res({ ok: false, status: 500, text: function () { return Promise.resolve('{"message":"down"}'); } }); } }); }); };
    w.fetch = function (u, o) { var name = String(u).split('/rpc/')[1], body = JSON.parse(o.body || '{}'); if (name === 'admin_feed') return pend(h.feed, body); if (name === 'admin_overview') return pend(h.ov, body); return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('[]'); } }); };
    if (!w.addEventListener) w.addEventListener = function () { }; /* a window has one: admin.js listens for another tab's sign-in */
    vm.runInContext(fs.readFileSync(path.join(root, 'admin.js'), 'utf8'), vm.createContext(w), { filename: 'admin.js' });
    h.T = w.__ADMIN_TEST__.api; h.T.setTab('none');
    return h;
  }
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var oldRow = { id: 5, run_id: 'r1', kind: 'report', title: 'cycle: 21 eligible adults', detail: { summary: { eligible: 21 } } };
  openHarness.dashboardHoldPaths = true;
  var a = harness();
  var ov1 = a.T.loadOverview();
  tick().then(function () { a.ov.shift().res({ latest_run: 'r1', held_runs: 0 }); return ov1; }).then(tick).then(function () {
    a.feed.shift().res([oldRow]); return tick().then(tick);
  }).then(function () {
    var poll = a.T.loadFeed(false);
    return tick().then(function () {
      a.feed.shift().res([{ id: 6, kind: 'invalidated', title: 'orchestrator: 1 published run held until the next run (withdrawal)', detail: { runs: 1 } }]);
      return tick().then(tick);
    }).then(function () {
      var st = a.T.state(), fullSent = a.feed.length === 1 && !('p_after' in a.feed[0].args), ovSent = a.ov.length === 1;
      a.ov.shift().rej(); a.feed.shift().rej(); /* the overview and the full reload both fail */
      return poll.then(tick).then(tick).then(function () {
        var st2 = a.T.state();
        check('a hold that arrives in a feed poll drops every cached row at once, asks for a full reload and a new overview, and stays dropped when both fail', st.feed.length === 0 && fullSent && ovSent && st2.feed.length === 0 && st2.needsFull === true, JSON.stringify({ st: st, st2: st2, fullSent: fullSent, ovSent: ovSent }));
      });
    });
  }).then(function () {
    var b = harness();
    var older = b.T.loadOverview(), newer = b.T.loadOverview(); /* A sent before the withdrawal, B after */
    return tick().then(function () {
      b.ov[1].res({ latest_run: null, held_runs: 1 }); return newer;
    }).then(tick).then(function () {
      var rkB = b.T.state().releaseKey;
      b.ov[0].res({ latest_run: 'r1', held_runs: 0 }); /* the older answer lands last */
      return older.then(tick).then(function () {
        check('an older overview answer that lands after a newer held one is ignored, so the release key and held summaries never roll back', rkB === 'null|1' && b.T.state().releaseKey === 'null|1', JSON.stringify({ rkB: rkB, now: b.T.state().releaseKey }));
      });
    });
  }).then(function () {
    var c = harness(), pub = { latest_run: 'r1', held_runs: 0, latest: { cycle: [{ metric: 'eligible_people', value: 21 }] }, runs: [{ id: 'r1', summary: { eligible: 21 } }] };
    var o1 = c.T.loadOverview();
    return tick().then(function () { c.ov.shift().res(pub); return o1; }).then(tick).then(function () {
      var shown = (c.T.state().latest || {}).cycle;
      c.feed.shift().res([{ id: 9, kind: 'invalidated', title: 'orchestrator: 1 published run held until the next run (withdrawal)', detail: { runs: 1 } }, oldRow]); /* the owed full reload itself carries the hold */
      return tick().then(tick).then(function () {
        var st = c.T.state(), asked = c.ov.length === 1;
        c.ov.shift().rej(); /* the overview it asks for fails */
        return tick().then(tick).then(function () {
          var st2 = c.T.state();
          check('a hold in any feed answer, full or not, clears the summaries on Today and Agents at once, asks for a new overview, and they stay cleared when it fails', !!shown && asked && Object.keys(st.latest || {}).length === 0 && st.held >= 1 && Object.keys(st2.latest || {}).length === 0, JSON.stringify({ shown: shown, asked: asked, st: st, st2: st2 }));
          var again = c.T.loadFeed(true);
          return tick().then(function () { c.feed.shift().res([{ id: 9, kind: 'invalidated', title: 'x', detail: { runs: 1 } }]); return again; }).then(tick).then(function () {
            check('a hold already acted on does not ask again, so old invalidation events never loop', c.ov.length === 0, String(c.ov.length));
            c.T.dropResults(); var sd = c.T.state();
            check('a confirmed floor change drops results on Today, Agents and Feed at once and owes a full reload, so a failed refresh cannot leave them up', Object.keys(sd.latest || {}).length === 0 && sd.feed.length === 0 && sd.needsFull === true, JSON.stringify(sd));
            delete openHarness.dashboardHoldPaths;
          });
        });
      });
    });
  }).catch(function (e) { check('dashboard hold paths harness ran', false, String(e && e.stack || e)); });
})();
(function plotGrowth() {
  console.log('the plot grows a stage per credited day and never shrinks');
  var w = scenes('2026-10-18'), S = w.OvuStore, G = w.OvuGarden;
  check('stages: soil at 0, sprout at 1, leaves at 3, bud at 6, bloom at 10, full bloom at 15 and beyond', [0, 1, 2, 3, 5, 6, 9, 10, 14, 15, 40].map(G.stageFor).join() === '0,1,1,2,2,3,3,4,4,5,5');
  check('nothing logged: soil, next stage at 1', G.summary(S).days === 0 && G.summary(S).stage === 0 && G.summary(S).nextAt === 1);
  var a = S.add('sleep', '2026-10-16', { bedTime: '23:00', wakeTime: '07:00' }); S.add('symptom', '2026-10-16', { symptoms: ['cramps'] }); S.add('food', '2026-10-17', { meal: 'lunch', foods: 'rice', items: [] });
  check('two entries on one day count once; two days give a sprout', G.credit(S) === 2 && G.stageFor(2) === 1, G.credit(S));
  var w1 = G.water(S);
  check('first watering today is new and adds a day', w1.first && w1.days === 3 && G.wateredToday(S), JSON.stringify(w1));
  var w2 = G.water(S);
  check('a second watering the same day is not new and adds nothing', !w2.first && w2.days === 3, JSON.stringify(w2));
  S.remove(a.id);
  check('deleting an entry never shrinks the plot (credited dates are kept)', G.credit(S) === 3, G.credit(S));
  var saved = S.state().garden;
  check('credited and watered days are persisted in state for export', saved && saved.credited.length === 3 && saved.watered.join() === '2026-10-18', JSON.stringify(saved));
  check('plant art is an inline svg at every stage, bigger as it grows', [0, 1, 2, 3, 4, 5].every(function (s) { return /^<svg/.test(G.plantSVG(s)); }) && G.plantSVG(5).length > G.plantSVG(1).length);
  var WK = w.OvuWalk, GL = G.LAYOUT, free = function (x, y) { return WK.inZones(GL.zones, x, y) && !WK.blocked(GL.solids, x, y); };
  check('every side of the plot she can water from stands on the lawn, clear of the planter', G.PLOT_SIDES.every(function (p) { return free(p.x, p.y); }), JSON.stringify(G.PLOT_SIDES.filter(function (p) { return !free(p.x, p.y); })));
  var beside = G.plotStand({ x: 38.5, y: 64.5 }, free), far = G.plotStand({ x: 30, y: 62 }, free), back = G.plotStand({ x: 50, y: 55 }, free), front = G.plotStand({ x: 50, y: 80 }, free);
  check('already beside the plot she waters from where she stands; from further off she walks to the nearest side, not the front', beside.x === 38.5 && beside.y === 64.5 && far.x === 38.5 && back.y === 58 && front.x === 50 && front.y === 71.5, JSON.stringify([beside, far, back, front]));
  check('she faces the plot from either side', G.plotStand({ x: 38.5, y: 64.5 }, free).flip !== G.plotStand({ x: 63.5, y: 65.5 }, free).flip);
  var n0 = S.add('symptom', '2026-10-17', { symptoms: [], none: true, pain: 0, mood: '', notes: '' });
  check('a day logged as None keeps none: true with no symptoms', n0.data.none === true && n0.data.symptoms.length === 0, JSON.stringify(n0.data));
  var n1 = S.add('symptom', '2026-10-17', { symptoms: ['cramps'], pain: 4 });
  check('noting a symptom later the same day drops None and keeps the symptom', n1.data.none === undefined && n1.data.symptoms.join() === 'cramps' && n1.data.pain === 4, JSON.stringify(n1.data));
  S.remove(n1.id);
  var ev = S.add('mindfulness', '2026-10-18', { kind: 'garden', minutes: 1, completed: true });
  var rw = w.OvuRewards.award(ev);
  check('a watering minute is worth 2 hearts as a one-minute calm entry (plus the usual streak rule)', rw.points === 2, JSON.stringify(rw));
})();
(function neighboursAreSamples() {
  console.log('neighbours are samples behind one seam, with homes that exist and a daily prompt');
  var w = scenes('2026-10-18'), C = w.OvuCommunity, L = w.LAYOUTS;
  var ns = C.neighbours();
  check('four sample neighbours with a name, an outfit sprite, a pet and a real home layout', ns.length === 4 && ns.every(function (n) { return n.sample && n.name && /^[a-z-]+$/.test(n.outfit) && n.pet && n.pet.img && L[n.home] && n.spot && n.line; }), JSON.stringify(ns.map(function (n) { return n.id; })));
  check('neighbours stand on the plaza floor', ns.every(function (n) { return w.OvuWalk.inZones(L.plaza.zones, n.spot.x, n.spot.y); }));
  check('neighbours() hands back a copy', (C.neighbours().pop(), C.neighbours().length === 4));
  check('today’s prompt is the same all day and comes from the list', C.promptFor('2026-10-18') === C.promptFor('2026-10-18') && C.PROMPTS.indexOf(C.promptFor('2026-10-18')) > -1 && C.promptFor('2026-10-19') !== C.promptFor('2026-10-18'));
  check('noticeboard sample notes are marked as samples', C.NOTES.length >= 3 && C.NOTES.every(function (n) { return n.sample; }));
})();
(function communityFailedSavesKeepTheSheet() {
  console.log('audit P1: hello and pinned notes leave no failed action in memory and retain her words');
  var w = fresh(), S = w.OvuStore, ls = w.localStorage, realSet = ls.setItem, nodes = {}, opens = 0, closes = 0, toasts = [];
  function node() { return { value: '', handlers: {}, addEventListener: function (k, f) { this.handlers[k] = f; } }; }
  w.document = { createElement: node, getElementById: function (id) { return nodes[id] || (nodes[id] = node()); }, querySelector: function () { return null; }, addEventListener: function () {} };
  w.OvuWalk = { napping: function () { return false; } };
  w.OvuRoom = { ART: '', LAYOUTS: {}, hotspotHandlers: {}, esc: function (s) { return String(s || ''); }, on: function () {},
    openSheet: function () { opens++; nodes = {}; }, closeSheet: function () { closes++; }, chime: function () {}, toast: function (t) { toasts.push(t); } };
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-community.js'), 'utf8'), w, { filename: 'ovu-community.js' });
  var C = w.OvuCommunity;
  S.setState({ community: { notes: [{ text: 'Original', date: S.today() }], hellos: { nadia: S.today() }, extra: 'keep' } });
  C.openNeighbour('mei');
  var snap = JSON.stringify(S.state().community), opened = opens;
  ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('QuotaExceededError'); return realSet.call(ls, k, v); };
  var helloThrew = false; try { nodes.nbHello.handlers.click(); } catch (e) { helloThrew = true; } ls.setItem = realSet;
  check('a refused hello leaves memory unchanged and keeps its sheet open for retry', !helloThrew && JSON.stringify(S.state().community) === snap && opens === opened && closes === 0 && /hello could not be saved/.test(toasts[toasts.length - 1]));
  S.setProfile({ name: 'After failed hello' });
  check('the refused hello cannot leak through a later unrelated save', JSON.stringify(JSON.parse(ls.getItem('ovumind_db_v1')).state.community) === snap);
  nodes.nbHello.handlers.click();
  check('retry saves just the intended hello and closes after success', S.state().community.hellos.mei === S.today() && S.state().community.hellos.nadia === S.today() && S.state().community.extra === 'keep' && closes === 1);
  C.openBoard(); w.document.getElementById('noteText').value = 'Keep these words for retry';
  var textarea = nodes.noteText, pin = nodes.notePin, snap2 = JSON.stringify(S.state().community), opened2 = opens;
  ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('QuotaExceededError'); return realSet.call(ls, k, v); };
  var pinThrew = false; try { pin.handlers.click(); } catch (e) { pinThrew = true; } ls.setItem = realSet;
  check('a refused pin leaves memory unchanged, the entered words and the same sheet available', !pinThrew && JSON.stringify(S.state().community) === snap2 && opens === opened2 && nodes.noteText === textarea && textarea.value === 'Keep these words for retry' && /note could not be saved/.test(toasts[toasts.length - 1]));
  S.setProfile({ name: 'After failed pin' });
  check('the refused pin cannot leak through a later unrelated save', JSON.stringify(JSON.parse(ls.getItem('ovumind_db_v1')).state.community) === snap2);
  pin.handlers.click();
  check('retry pins one copy, preserves other community data and redraws after success', S.state().community.notes.length === 2 && S.state().community.notes[1].text === textarea.value && S.state().community.extra === 'keep' && opens === opened2 + 1);
})();


(function lunaLook() {
  console.log("Luna's look (ovu-mascot.js): one pastel crescent moon");
  var w = fresh(), M = w.OvuMascot;
  (function () {
    var rh = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), rj = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), pv = fs.readFileSync(path.join(root, 'ovu-pageview.js'), 'utf8');
    check('older Rhythme pages open in the in-app viewer, never by leaving the room (Jamie, 22 Oct)', /<script src="ovu-pageview\.js"><\/script>/.test(rh) && /OvuPage\.open\('journal\.html#'/.test(rj) && /e\.preventDefault\(\); open\(href\);/.test(pv) && /dispatchEvent\(new CustomEvent\('ovu-route'/.test(pv) && !/a\.target === '_blank'/.test(pv));
    check('retired pages are not linked from the room: foods, period start, account, calm check', !/'(foods|period-start|account|face-ppg)\.html'/.test(rj) && !/href="(foods|period-start|account|face-ppg)\.html"/.test(rj + rh));
  })();
  check('one look only, the soft Ovuluna crescent (Jamie, 21 Oct)', M.LIST.length === 1 && M.LIST[0].id === 'luna' && /orb-luna\.webp$/.test(M.src()));
  check('its crescent sprite is on disk and no round badge is used', fs.existsSync(path.join(root, 'assets/room/dream', M.LIST[0].img)) && !M.LIST[0].head);
  check('the crescent is the default and an unknown look (an old saved pick too) is ignored', M.current().id === 'luna' && M.set('rabbit').id === 'luna' && M.set('moon').id === 'luna');
  check('the small Luna button shows the crescent on its own, like the welcome (no round badge)', /orb-luna\.webp$/.test(M.src(null, true)) && /orb-luna\.webp$/.test(M.src(null, false)));
  check('the Luna chat button on pages without the mascot module also shows the crescent, never the old starry moon (Jamie, 22 Oct)', !/orb-moon/.test(fs.readFileSync(path.join(root, 'luna-chat.js'), 'utf8')));
})();

(function healthImportParsers() {
  console.log('health import: Apple Health export.xml records become nights, weigh-ins and period days');
  var w = fresh('2026-10-18'), H = w.OvuHealth;
  var xml = fs.readFileSync(path.join(root, 'tools/fixtures/apple-export-mini.xml'), 'utf8');
  var r = H.parseAppleXml(xml);
  check('a night that crosses midnight lands on the morning date with first asleep start and last asleep end', r.sleep[0] && r.sleep[0].date === '2025-06-02' && r.sleep[0].bedTime === '23:20' && r.sleep[0].wakeTime === '06:50', JSON.stringify(r.sleep[0]));
  check('its hours are the asleep segments added up, the awake gap and an overlapping REM record excluded (190 + 240 min)', r.sleep[0] && r.sleep[0].asleepMin === 430 && r.sleep[0].hours === 7.2, JSON.stringify(r.sleep[0]));
  check('the in-bed wrapper from the phone does not widen the night', r.sleep[0] && r.sleep[0].bedTime !== '23:05' && r.sleep[0].basis === 'asleep');
  check('an afternoon nap is left out and counted', r.sleep.length === 2 && r.naps === 1, JSON.stringify({ n: r.sleep.length, naps: r.naps }));
  check('an old numeric asleep value (1) within one date is a night of its own', r.sleep[1] && r.sleep[1].date === '2025-06-03' && r.sleep[1].bedTime === '00:40' && r.sleep[1].wakeTime === '07:25' && r.sleep[1].hours === 6.8, JSON.stringify(r.sleep[1]));
  check('body mass: pounds convert to kg and the later weigh-in of the day wins', r.weight.length === 1 && r.weight[0].date === '2025-06-02' && r.weight[0].kg === 58.1, JSON.stringify(r.weight));
  check('menstrual flow: a named Medium with a metadata child and a numeric 2 (light) become period days; None is skipped', r.period.length === 2 && r.period[0].flow === 'medium' && r.period[0].date === '2025-06-04' && r.period[1].flow === 'light' && r.counts.flowNone === 1, JSON.stringify(r.period));
  check('steps, heart rate, night sweats and a workout are skipped and counted by kind', r.skipped.HKQuantityTypeIdentifierStepCount === 5 && r.skipped.HKQuantityTypeIdentifierHeartRate === 3 && r.skippedTotal === 10 && r.skippedKinds === 4, JSON.stringify(r.skipped));
  check('friendly names for skipped kinds', H.friendlyType('HKQuantityTypeIdentifierStepCount') === 'steps' && H.friendlyType('HKQuantityTypeIdentifierSomethingNew') === 'something new');
  var sc = H.appleScanner(), cut = xml.indexOf('startDate="2025-06-02 02:50');
  sc.push(xml.slice(0, cut - 7), false); sc.push(xml.slice(cut - 7, cut + 40), false); sc.push(xml.slice(cut + 40), true);
  var r2 = sc.result();
  check('the chunked scanner gives the same result when a chunk boundary splits a Record tag', JSON.stringify([r2.sleep, r2.weight, r2.period, r2.counts.records]) === JSON.stringify([r.sleep, r.weight, r.period, r.counts.records]));
  check('stamps keep the clock time of the phone that wrote them', H.wallHM(H.parseStamp('2025-06-01 23:20:00 +0800').wall) === '23:20' && H.wallDate(H.parseStamp('2025-06-01T23:20:00.000-07:00').wall) === '2025-06-01' && H.parseStamp('yesterday') === null);
  check('weight units: lb, g and st convert; nonsense and out-of-range are rejected', H.toKg('128.5', 'lb') === 58.3 && H.toKg('58100', 'g') === 58.1 && H.toKg('9', 'st') === 57.2 && H.toKg('abc', 'kg') === null && H.toKg('5', 'kg') === null && H.toKg('58,4', 'kg') === 58.4);
  var sess = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures/fit-session-sleep.json'), 'utf8'));
  var gb = H.googleBuilder(); gb.json(JSON.stringify(sess), '2025-05-10T23_12_00+08_00_SLEEP.json'); gb.json(JSON.stringify({ fitnessActivity: 'walking', startTime: '2025-05-11T18:00:00.000+08:00', endTime: '2025-05-11T18:30:00.000+08:00' }), 'x_WALKING.json');
  gb.csv(fs.readFileSync(path.join(root, 'tools/fixtures/fit-daily-metrics.csv'), 'utf8'), 'Daily activity metrics.csv');
  gb.csv('Start time,End time,Step count,Average weight (kg),Max weight (kg),Min weight (kg)\n07:00:00.000+08:00,07:15:00.000+08:00,120,,,\n07:15:00.000+08:00,07:30:00.000+08:00,0,58.4,58.4,58.4\n', 'Takeout/Fit/Daily activity metrics/2025-05-12.csv');
  var g = gb.result();
  check('Takeout sleep session: stage segments add up, the awake segment is excluded, night on the morning date', g.sleep.length === 1 && g.sleep[0].date === '2025-05-11' && g.sleep[0].bedTime === '23:12' && g.sleep[0].wakeTime === '06:58' && g.sleep[0].asleepMin === 446, JSON.stringify(g.sleep));
  check('Takeout weights: the dated summary CSV and a per-day file named by date both give one weigh-in per day; empty cells skipped', JSON.stringify(g.weight) === JSON.stringify([{ date: '2025-05-11', kg: 57.8 }, { date: '2025-05-12', kg: 58.4 }]), JSON.stringify(g.weight));
  check('a walk is counted as another kind, not a night', g.skipped.walking === 1 && g.counts.sleepSessions === 1);
  check('CSV cells with quotes and commas parse', JSON.stringify(H.parseCsv('a,"b,c","d ""e"" f"\n1,2,3\n')) === JSON.stringify([['a', 'b,c', 'd "e" f'], ['1', '2', '3']]));
})();

(function healthImportIntoTheStore() {
  console.log('health import: hand-written days win, re-imports refresh, removal takes only imported entries');
  var w = fresh('2026-10-18'), H = w.OvuHealth, S = w.OvuStore;
  S.add('sleep', '2025-06-02', { bedTime: '22:00', wakeTime: '06:00', quality: 3, notes: 'mine' });
  S.add('weight', '2025-06-02', { kg: 60 }, 'scale');
  S.add('period', '2025-06-05', { flow: 'heavy' });
  var r = H.parseAppleXml(fs.readFileSync(path.join(root, 'tools/fixtures/apple-export-mini.xml'), 'utf8'));
  var p = H.apply(r, S, { kinds: ['sleep', 'weight', 'period'] });
  check('three hand-written days are left alone and counted', p.kept === 3 && p.written.added === 2 && p.counts.sleep === 1 && p.counts.weight === 0 && p.counts.period === 1, JSON.stringify({ kept: p.kept, w: p.written, c: p.counts }));
  var mine = S.list('sleep', { from: '2025-06-02', to: '2025-06-02' });
  check('the hand-written night is untouched and no second night was added that day', mine.length === 1 && mine[0].data.notes === 'mine' && S.list('weight', { from: '2025-06-02', to: '2025-06-02' })[0].data.kg === 60 && S.list('period', { from: '2025-06-05', to: '2025-06-05' })[0].data.flow === 'heavy');
  var imp = S.list('sleep', { from: '2025-06-03', to: '2025-06-03' })[0];
  check('an imported night carries source apple-health, the sleep-sheet shape and its asleep minutes', imp && imp.source === 'apple-health' && imp.data.bedTime === '00:40' && imp.data.wakeTime === '07:25' && imp.data.mode === 'import' && S.sleepHours(imp.data) === 6.8, JSON.stringify(imp));
  check('date range covers what was written', p.from === '2025-06-03' && p.to === '2025-06-04', JSON.stringify([p.from, p.to]));
  var again = H.apply(r, S, { kinds: ['sleep', 'weight', 'period'] });
  check('importing the same file again refreshes in place: nothing added, nothing duplicated', again.written.added === 0 && again.written.updated === 2 && again.refreshed === 2 && S.list('sleep').length === 2 && S.list('period').length === 2, JSON.stringify(again.written));
  check('importedCount sees only imported entries', H.importedCount(S) === 2);
  var gone = H.removeImported(S);
  check('Remove imported data takes out exactly the imported entries and keeps the hand-written ones', gone === 2 && S.list().length === 3 && S.list().every(function (e) { return e.source !== 'apple-health'; }), JSON.stringify({ gone: gone, left: S.list().map(function (e) { return e.type + ':' + e.source; }) }));
  var future = H.apply({ source: 'apple-health', sleep: [{ date: '2027-01-01', bedTime: '23:00', wakeTime: '07:00', hours: 8, asleepMin: 480 }], weight: [], period: [] }, S);
  check('future-dated records are skipped, not written', future.future === 1 && future.total === 0);
  var w2 = fresh(), S2 = w2.OvuStore, res = S2.addMany([{ type: 'weight', date: '2025-01-01', data: { kg: 50 }, source: 'google-fit' }, { type: 'weight', date: '2025-01-01', data: { kg: 51 }, source: 'google-fit' }, { type: 'nope', date: '2025-01-01', data: {} }, { type: 'sleep', date: 'bad', data: {} }]);
  check('addMany writes once, keeps single-per-day kinds single and skips invalid items', res.added === 1 && res.skipped === 3 && S2.list('weight').length === 1 && S2.list('weight')[0].data.kg === 50, JSON.stringify(res));
})();

(function healthImportChoose() {
  console.log('health import: every kind found is listed with counts and dates; only ticked kinds and dates are written');
  var w = fresh('2026-10-18'), H = w.OvuHealth, S = w.OvuStore;
  var r = H.parseAppleXml(fs.readFileSync(path.join(root, 'tools/fixtures/apple-export-mini.xml'), 'utf8'));
  check('spotting on a day with recorded flow is dropped; spotting on its own day is kept', JSON.stringify(r.spotting) === JSON.stringify([{ date: '2025-06-07', flow: 'spotting' }]), JSON.stringify(r.spotting));
  check('Apple symptoms map to Rhythme chips, repeats merge, NotPresent is skipped, unmapped ones are not guessed', JSON.stringify(r.symptoms) === JSON.stringify([{ date: '2025-06-04', symptoms: ['cramps', 'headache'] }]) && r.counts.symptomAbsent === 1 && r.skipped.HKCategoryTypeIdentifierNightSweats === 1, JSON.stringify({ s: r.symptoms, c: r.counts }));
  check('mindful sessions add up per day (10 + 5 minutes, 2 sessions)', JSON.stringify(r.mindful) === JSON.stringify([{ date: '2025-06-02', minutes: 15, sessions: 2 }]), JSON.stringify(r.mindful));
  check('a Workout element is counted as a kind not in Rhythme yet, its child elements are not Records', r.skipped.HKWorkout === 1 && r.counts.workouts === 1 && r.counts.records === 29, JSON.stringify(r.counts));
  var k = H.kinds(r);
  check('the picker lists the six kinds Rhythme has a place for, in order, with counts and date ranges', k.ready.map(function (x) { return x.id + ':' + x.count + ':' + x.from + ':' + x.to; }).join(' ') === 'sleep:2:2025-06-02:2025-06-03 period:2:2025-06-04:2025-06-05 spotting:1:2025-06-07:2025-06-07 symptoms:1:2025-06-04:2025-06-04 weight:1:2025-06-02:2025-06-02 mindful:1:2025-06-02:2025-06-02', JSON.stringify(k.ready));
  check('kinds with no place yet are listed by friendly name with counts and dates, most first', k.later.map(function (x) { return x.name + ':' + x.count; }).join(',') === 'steps:5,heart rate:3,night sweats:1,workouts:1' && k.later[3].from === '2025-06-03', JSON.stringify(k.later));
  var kr = H.kinds(r, { from: '2025-06-04' });
  check('a date range narrows the counts; kinds with nothing in it stay listed with zero', kr.ready.filter(function (x) { return x.id === 'sleep'; })[0].count === 0 && kr.ready.filter(function (x) { return x.id === 'period'; })[0].count === 2 && kr.ready.length === 6);
  S.add('symptom', '2025-06-04', { symptoms: ['acne'], pain: 2, mood: '', notes: 'mine' });
  var preview = H.plan(r, S, { kinds: ['symptoms', 'period'] });
  check('the plan for ticked kinds says which days she logged herself (keptBy)', preview.keptBy.symptoms === 1 && preview.keptBy.period === 0 && preview.counts.symptoms === 0 && preview.counts.period === 2);
  var none = H.plan(r, S, { kinds: [] });
  check('nothing ticked plans nothing', none.total === 0 && none.kept === 0);
  var p = H.apply(r, S, { kinds: ['sleep', 'spotting', 'mindful'], from: '2025-06-03' });
  var srcs = S.list().filter(function (e) { return H.isImported(e); }).map(function (e) { return e.type + ':' + e.date; }).sort().join(',');
  check('only ticked kinds inside the date range are written (one night, one spotting day; mindful minutes fall before the range)', srcs === 'period:2025-06-07,sleep:2025-06-03' && p.counts.sleep === 1 && p.counts.spotting === 1 && p.counts.mindful === 0, srcs);
  check('nothing unticked was written: no weight, no period flow, no symptoms from the file', S.list('weight').length === 0 && S.list('period').filter(function (e) { return e.data.flow !== 'spotting'; }).length === 0 && S.list('symptom').length === 1);
  var spot = S.list('period', { from: '2025-06-07', to: '2025-06-07' })[0];
  check('a spotting day never starts a cycle', S.cycleStats('2025-06-10').starts.length === 0 && spot.data.flow === 'spotting', JSON.stringify(S.cycleStats('2025-06-10').starts));
  H.apply(r, S, { kinds: ['mindful', 'symptoms'] });
  var mind = S.list('mindfulness')[0];
  check('mindful minutes become one mindfulness entry for the day, marked as imported', mind && mind.source === 'apple-health' && mind.data.kind === 'imported' && mind.data.minutes === 15 && mind.data.sessions === 2 && mind.data.completed === true, JSON.stringify(mind));
  var view = H.imported(S);
  check('the Health data view lists what was brought in per kind, with counts, dates and sources', view.map(function (x) { return x.id + ':' + x.count + ':' + x.sources['apple-health']; }).join(',') === 'sleep:1:1,spotting:1:1,mindful:1:1', JSON.stringify(view.map(function (x) { return [x.id, x.count, x.sources]; })));
  var gone = H.removeImported(S, 'spotting');
  check('removing one kind takes only that kind', gone === 1 && H.importedCount(S) === 2 && H.importedCount(S, 'spotting') === 0 && H.importedCount(S, 'sleep') === 1);
  var night = S.list('sleep')[0];
  S.update(night.id, { data: Object.assign({}, night.data, { quality: 4 }) });
  check('an imported night she edits by hand becomes hers', S.get(night.id).source === 'room' && H.importedCount(S, 'sleep') === 0);
  var again = H.apply(r, S, { kinds: ['sleep'] });
  check('a later import leaves her edited night alone and does not add a second one', again.keptBy.sleep === 1 && S.list('sleep', { from: '2025-06-03', to: '2025-06-03' }).length === 1 && S.list('sleep', { from: '2025-06-03', to: '2025-06-03' })[0].data.quality === 4);
  H.apply(r, S, { kinds: ['period'] });
  var pd = S.list('period', { from: '2025-06-04', to: '2025-06-04' })[0];
  S.add('period', '2025-06-04', { flow: 'heavy', clots: true, impact: false });
  check('changing an imported period day on the calendar makes it hers, and Remove keeps it', S.get(pd.id).source === 'room' && H.removeImported(S, 'period') === 1 && S.list('period', { from: '2025-06-04', to: '2025-06-04' })[0].data.flow === 'heavy');
  check('symptomPresent reads Apple severity and presence values', H.symptomPresent('HKCategoryValueSeverityMild') && H.symptomPresent('HKCategoryValueSeverityUnspecified') && !H.symptomPresent('HKCategoryValueSeverityNotPresent') && !H.symptomPresent('HKCategoryValuePresenceNotPresent') && !H.symptomPresent('1'));
  var gb = H.googleBuilder();
  gb.json(JSON.stringify({ fitnessActivity: 'meditation', startTime: '2025-05-11T07:00:00.000+08:00', endTime: '2025-05-11T07:12:00.000+08:00' }), 'x_MEDITATION.json');
  gb.json(JSON.stringify({ fitnessActivity: 'running', startTime: '2025-05-12T07:00:00.000+08:00', endTime: '2025-05-12T07:30:00.000+08:00' }), 'x_RUNNING.json');
  gb.csv(fs.readFileSync(path.join(root, 'tools/fixtures/fit-daily-metrics.csv'), 'utf8'), 'Daily activity metrics.csv');
  var g = gb.result(), gk = H.kinds(g);
  var ln = {}; gk.later.forEach(function (x) { ln[x.name] = x; });
  check('Takeout meditation sessions become mindful minutes; running and every other daily column are listed as not in Rhythme yet, weight columns are not', JSON.stringify(g.mindful) === JSON.stringify([{ date: '2025-05-11', minutes: 12, sessions: 1 }]) && ln.steps && ln.steps.count === 3 && ln.steps.from === '2025-05-10' && ln.calories && ln['heart points'] && ln.running && ln.running.count === 1 && !Object.keys(ln).some(function (n) { return /weight|date|time/.test(n); }), JSON.stringify(Object.keys(ln)));
})();

(function healthImportReviewFixes() {
  console.log('health import: overlapping mindful sessions, session counts, date edits, future dates (Codex review, 19 Oct)');
  var w = fresh('2026-10-18'), H = w.OvuHealth, S = w.OvuStore, A = w.OvuAgents;
  var x = '<HealthData>' +
    '<Record type="HKCategoryTypeIdentifierMindfulSession" sourceName="Breathe" startDate="2025-06-02 08:00:00 +0800" endDate="2025-06-02 08:10:00 +0800" value="HKCategoryValueNotApplicable"/>' +
    '<Record type="HKCategoryTypeIdentifierMindfulSession" sourceName="Calm" startDate="2025-06-02 08:00:00 +0800" endDate="2025-06-02 08:10:00 +0800" value="HKCategoryValueNotApplicable"/>' +
    '<Record type="HKCategoryTypeIdentifierMindfulSession" sourceName="Calm" startDate="2025-06-02 08:05:00 +0800" endDate="2025-06-02 08:15:00 +0800" value="HKCategoryValueNotApplicable"/>' +
    '<Record type="HKCategoryTypeIdentifierMindfulSession" sourceName="Calm" startDate="2025-06-02 21:00:00 +0800" endDate="2025-06-02 21:15:00 +0800" value="HKCategoryValueNotApplicable"/>' +
    '<Record type="HKCategoryTypeIdentifierMindfulSession" sourceName="Calm" startDate="2027-01-02 21:00:00 +0800" endDate="2027-01-02 21:15:00 +0800" value="HKCategoryValueNotApplicable"/>' +
    '</HealthData>';
  var r = H.parseAppleXml(x);
  check('the same minutes recorded by two apps are merged before adding up (08:00 to 08:15 plus 21:00 to 21:15 is 30 minutes, 2 sessions)', r.mindful[0].minutes === 30 && r.mindful[0].sessions === 2, JSON.stringify(r.mindful));
  check('the picker leaves out future dates when given today as the upper bound', H.kinds(r, { to: '2026-10-18' }).ready[0].count === 1 && H.kinds(r).ready[0].count === 2);
  H.apply(r, S, { kinds: ['mindful'] });
  check('the four-week summary counts the sessions inside a brought-in day, not the entry', A.fourWeekSummary('2025-06-10').mindfulness.sessions === 2 && A.fourWeekSummary('2025-06-10').mindfulness.minutes === 30, JSON.stringify(A.fourWeekSummary('2025-06-10').mindfulness));
  var e = S.list('mindfulness')[0];
  S.update(e.id, { date: '2025-06-03' });
  check('moving an imported entry to another date makes it hers, so Remove keeps it', S.get(e.id).source === 'room' && H.removeImported(S) === 0);  var w2 = fresh('2026-10-18'), H2 = w2.OvuHealth, S2 = w2.OvuStore, RW2 = w2.OvuRewards, before = JSON.stringify(RW2.ledger());
  H2.apply(H2.parseAppleXml(fs.readFileSync(path.join(root, 'tools/fixtures/apple-export-mini.xml'), 'utf8')), S2);
  check('bringing data in earns no hearts and leaves the hearts ledger untouched (checkpoints 18, 22, 33)', S2.list().length > 0 && JSON.stringify(RW2.ledger()) === before, JSON.stringify({ n: S2.list().length, before: before, after: RW2.ledger() }));
})();

/* The zip path is asynchronous (slices read through Blob.arrayBuffer), so it runs last and prints the totals. */
(function healthImportZips() {
  console.log('health import: zips are read by central directory and inflated one entry at a time');
  var w = fresh('2026-10-18'), H = w.OvuHealth;
  var apple = new File([fs.readFileSync(path.join(root, 'tools/fixtures/apple-export-mini.zip'))], 'export.zip');
  var takeout = new File([fs.readFileSync(path.join(root, 'tools/fixtures/takeout-fit-mini.zip'))], 'takeout-20250601T000000Z-001.zip');
  var progress = [];
  return H.zipIndex(apple).then(function (entries) {
    check('the Apple zip index lists export.xml, export_cda.xml and a folder', entries.length === 3 && entries.some(function (e) { return e.name === 'apple_health_export/export.xml' && e.method === 8 && e.csize > 0; }) && entries.some(function (e) { return e.dir; }), JSON.stringify(entries.map(function (e) { return e.name; })));
    return H.importFiles([apple], { onProgress: function (f) { progress.push(f); } });
  }).then(function (r) {
    check('export.zip gives the same two nights, one weigh-in and two period days as the bare xml', r.source === 'apple-health' && r.sleep.length === 2 && r.sleep[0].hours === 7.2 && r.weight.length === 1 && r.period.length === 2, JSON.stringify(r.sleep));
    check('progress was reported and ended at 1', progress.length >= 1 && progress[progress.length - 1] === 1, JSON.stringify(progress));
    return H.importFiles([takeout], { onProgress: function () { } });
  }).then(function (g) {
    check('the Takeout zip is recognised by its Fit folder: two nights and two weigh-ins, the walk skipped, no period data', g.source === 'google-fit' && g.sleep.length === 2 && g.weight.length === 2 && g.period.length === 0 && g.skipped.walking === 1, JSON.stringify({ s: g.sleep, w: g.weight }));
    return H.importFiles([new File([Buffer.from('not a zip at all, just text that is long enough to pass the size check')], 'random.zip')], {}).then(function () { return 'resolved'; }, function (e) { return e.message; });
  }).then(function (msg) {
    check('a non-zip named .zip fails with a plain-words message', /does not look like a zip/.test(msg), msg);
    return H.importFiles([new File([Buffer.from('x')], 'notes.txt')], {}).then(function () { return 'resolved'; }, function (e) { return e.message; });
  }).then(function (msg) {
    check('an unknown file type explains what can be read', /export\.zip or export\.xml/.test(msg), msg);
  }).catch(function (e) { check('zip tests ran without throwing', false, e && e.stack || e); });
})(); /* the summary is printed once the loop drains (end of file), never from inside one block */
(function petShopShelves() {
  console.log('pet shop shelves: treats are used up, accessories are worn by one pet at a time');
  var w = fresh(), RW = w.OvuRewards, P = w.OvuPets, S = w.OvuStore;
  var l = RW.ledger(); l.hearts = 500; S.setState({ rewards: l });
  RW.buy('cat'); RW.buy('dog'); RW.buy('treat-fish'); RW.buy('treat-fish'); RW.buy('acc-bow'); RW.buy('acc-charm');
  l = RW.ledger();
  check('two packs of fish biscuits make ten in the cupboard', l.treats && l.treats['treat-fish'] === 10, JSON.stringify(l.treats));
  check('accessories are owned but never placed as props', l.owned.indexOf('acc-bow') > -1 && !l.placed['acc-bow']);
  check('a kitten can have fish biscuits, a puppy cannot', RW.treatsFor('cat').length === 1 && RW.treatsFor('dog').length === 0);
  var t0 = Date.parse('2026-10-18T10:00:00+08:00'); P.feed('cat', t0); P.tick('cat', t0 + 5 * 3600 * 1000);
  var full0 = P.current('cat', t0 + 5 * 3600 * 1000).full, tr = P.treat('cat', t0 + 5 * 3600 * 1000);
  check('a treat tops up a hungry kitten without a full meal', tr.ok && tr.pet.full > full0 && tr.pet.full < 100, full0 + ' -> ' + (tr.pet && tr.pet.full));
  P.feed('dog', t0);
  check('a puppy straight after a meal says no to a treat', P.treat('dog', t0 + 1000).ok === false);
  var used = RW.useTreat('cat', 'treat-fish');
  check('giving one leaves nine', used.left === 9 && RW.ledger().treats['treat-fish'] === 9);
  check('dress up cycles bow, collar, then nothing', RW.nextWear('cat').id === 'acc-bow' && RW.nextWear('cat').id === 'acc-charm' && RW.nextWear('cat') === null);
  RW.wear('cat', 'acc-bow'); RW.wear('dog', 'acc-bow');
  check('one bow cannot be on two pets', !RW.wearing('cat') && RW.wearing('dog').id === 'acc-bow');
  var threw = false; try { RW.wear('cat', 'acc-hat'); } catch (e) { threw = true; }
  check('cannot wear what you do not own', threw);
  check('every shelf item has a sprite on disk', RW.SHOP.filter(function (s) { return s.kind === 'treat' || s.kind === 'accessory'; }).every(function (s) { return fs.existsSync(path.join(root, 'assets/room/dream', s.img)); }));
  check('every pet has a rendered sprite for every accessory', ['cat', 'catblack', 'catginger', 'dog', 'shiba', 'mewmew'].every(function (id) { return ['acc-bow', 'acc-hat', 'acc-bandana', 'acc-charm'].every(function (acc) { var f = P.wornSprite(id, acc); return f && fs.existsSync(path.join(root, 'assets/room/dream', f)); }); }));
  check('head and neck spots exist for every pet', ['cat', 'catblack', 'catginger', 'dog', 'shiba', 'mewmew'].every(function (id) { return P.wearSpot(id, 'head').w > 0 && P.wearSpot(id, 'neck').w > 0; }));
})();

(function moonTap() {
  console.log('Moon Tap: the ring follows the preset, stopping saves seconds, hearts never depend on taps');
  var w = fresh(), T = w.OvuBreathTap, RW = w.OvuRewards, S = w.OvuStore;
  var p0 = T.phaseAt('easy', 0), p1 = T.phaseAt('easy', 1500), p2 = T.phaseAt('easy', 3000), p3 = T.phaseAt('easy', 6000), p4 = T.phaseAt('longout', 4000 + 3000);
  check('easy starts closed on the in-breath', p0.phase === 'in' && p0.size < 0.01);
  check('halfway through the in-breath the ring is half open', p1.phase === 'in' && Math.abs(p1.size - 0.5) < 0.01, p1.size);
  check('at three seconds the out-breath begins fully open', p2.phase === 'out' && p2.size > 0.99);
  check('six seconds later a new cycle starts', p3.cycle === 1 && p3.phase === 'in');
  check('long out: three seconds into the six second out-breath is half way', p4.phase === 'out' && Math.abs(p4.progress - 0.5) < 0.01);
  var e = T.entryFor(50.4, 'steady', 3, 3);
  check('an early stop keeps the seconds, the preset and the taps, and is not completed', e.seconds === 50 && e.preset === 'steady' && e.taps === 3 && !e.completed && e.minutes === 0.8, JSON.stringify(e));
  check('a full planned session counts as completed', T.entryFor(179, 'easy', 0, 3).completed === true);
  var l0 = RW.ledger(), before = l0.hearts, day = l0.lastDay;
  var r1 = RW.award(S.add('mindfulness', S.today(), T.entryFor(50, 'easy', 40, 0), 'room'));
  var r2 = RW.award(S.add('mindfulness', S.today(), T.entryFor(65, 'easy', 0, 0), 'room'));
  check('under a minute earns nothing, a full minute earns the flat two', r1.points === 0 && r2.points === 2 && RW.ledger().hearts === before + 2, r1.points + '/' + r2.points);
  check('seconds are not carried between sessions', !RW.ledger().breathCarry);
  check('Moon Tap never touches the daily streak', RW.ledger().lastDay === day && r2.bonus === 0);
  check('taps change nothing: forty taps and none earned the same', r1.points === 0);
})();

(function windowSkies() {
  console.log('window skies: every layout that lists a window has all three sky images on disk');
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), bases = src.match(/base: '([^']+)'/g) || [];
  check('four layouts list window skies (room, house, bath house, family home with two)', bases.length === 5, bases.length);
  check('night, sunset and sunrise exist for each', bases.every(function (b) { var base = b.slice(7, -1); return ['night', 'sunset', 'sunrise'].every(function (k) { return fs.existsSync(path.join(root, 'assets/room/dream', base + k + '.webp')); }); }));
})();

(function followCamera() {
  console.log('follow camera: zoom per layout, dead zone, clamped target, frame-rate independent smoothing (ovu-camera.js)');
  var w = scenes('2026-10-19'), M = w.OvuCamera.M, sceneOf = w.OvuWalk.sceneOf, W = 390, H = 487;
  check('every scene opens fitted to the screen at zoom 1: the room, the garden, the street, the plaza and the stores', ['room', 'garden', 'street', 'plaza', 'shop-pet', 'shop-furniture', 'shop-homes'].every(function (id) { return M.zoomFor(w.LAYOUTS[id], sceneOf) === 1; }));
  check('the bought homes, drawn smaller, open at 1.5 so she is her usual size there too', ['house', 'bathhouse', 'familyhome'].every(function (id) { return M.zoomFor(w.LAYOUTS[id], sceneOf) === 1.5 && w.LAYOUTS[id].avatarW * 1.5 === 12; }));
  check("a layout's own cam.z wins and never drops below 1", M.zoomFor({ scene: 'garden', cam: { z: 2.2 } }, sceneOf) === 2.2 && M.zoomFor({ scene: 'garden', cam: { z: 0.4 } }, sceneOf) === 1 && M.zoomFor(null, sceneOf) === 1);
  var c0 = M.centreOn({ x: 50, y: 50 }, 1.6, W, H), s0 = M.toScreen({ x: 50, y: 50 }, { x: c0.x, y: c0.y, z: 1.6 }, W, H);
  check('centring puts her feet at the screen position, 50% across and 58% down the box', Math.abs(s0.x - W * 0.5) < 1e-6 && Math.abs(s0.y - H * 0.58) < 1e-6, JSON.stringify(s0));
  var z1 = M.centreOn({ x: 90, y: 10 }, 1, W, H);
  check('at zoom 1 the camera is always (0, 0)', z1.x === 0 && z1.y === 0);
  var e1 = M.centreOn({ x: 2, y: 2 }, 1.6, W, H), e2 = M.centreOn({ x: 98, y: 98 }, 1.6, W, H);
  check('near a plate edge the camera stops at the edge rather than showing past it', e1.x === 0 && e1.y === 0 && Math.abs(e2.x - (W - W * 1.6)) < 1e-9 && Math.abs(e2.y - (H - H * 1.6)) < 1e-9, JSON.stringify([e1, e2]));
  var c = { x: c0.x, y: c0.y, z: 1.6 }, inside = M.target({ x: 52, y: 51 }, c, W, H), out = M.target({ x: 60, y: 50 }, c, W, H);
  check('a small move inside the dead zone leaves the camera where it is', inside.x === c.x && inside.y === c.y, JSON.stringify(inside));
  check('a move beyond the dead zone shifts the target by the overshoot only', Math.abs((c.x - out.x) - (10 / 100 * W * 1.6 - W * 0.06)) < 1e-6 && out.y === c.y, c.x - out.x);
  var one = M.approach(0, 100, 0.1), two = M.approach(M.approach(0, 100, 0.05), 100, 0.05);
  check('two half steps of smoothing land where one full step lands', Math.abs(one - two) < 1e-9 && one > 0 && one < 100, [one, two].join(','));
  check('smoothing never overshoots', M.approach(0, 100, 10) <= 100 && M.approach(100, 0, 10) >= 0);
  var cur = { x: c.x, y: c.y, z: 1.6 }, f = { x: 70, y: 60 }, steps = [1 / 60, 1 / 30, 1 / 120, 0.05, 1 / 60];
  for (var i = 0; i < 400; i++) { var tg = M.target(f, cur, W, H), dt = steps[i % steps.length]; cur = { x: M.approach(cur.x, tg.x, dt), y: M.approach(cur.y, tg.y, dt), z: 1.6 }; }
  var fin = M.target(f, cur, W, H), sf = M.toScreen(f, cur, W, H);
  check('with uneven frames the camera settles with her resting at the dead zone edge, inside the clamp', Math.abs(fin.x - cur.x) < 0.01 && Math.abs(fin.y - cur.y) < 0.01 && Math.abs(sf.x - W * 0.56) < 0.05 && Math.abs(sf.y - H * 0.63) < 0.05 && cur.x >= W - W * 1.6 && cur.x <= 0, JSON.stringify([cur, sf]));
  var ce = { x: 0, y: 0, z: 1.6 }, te = M.target({ x: 6, y: 5 }, ce, W, H);
  check('at the plate edge the target is the clamp itself, so the loop can rest there without centring her', te.x === 0 && te.y === 0);
  check('a store layout is marked so travel can keep the street hours', ['shop-pet', 'shop-furniture', 'shop-homes'].every(function (id) { return !!w.LAYOUTS[id].store; }) && !w.LAYOUTS.street.store && !w.LAYOUTS.garden.store);
})();

(function wideStreet() {
  console.log('the wide street: a 2:1 plate drawn 2.5 box widths wide, walkable end to end, the camera clamped to it (docs/design/2026-10-19-wide-street.md)');
  var w = scenes('2026-10-19'), K = w.OvuWalk, M = w.OvuCamera.M, L = w.LAYOUTS.street = require('./fixtures/wide-street-layout.js')(), W = 390, H = 487.5; /* the wide layout lives on as a fixture */
  check('the street plate is 2048 x 1024, drawn 2.5 box widths wide, so the box keeps the 0.8 view of every other scene', L.w === 2048 && L.h === 1024 && L.span === 2.5 && Math.abs(L.w / (L.h * L.span) - 0.8) < 1e-9 && Math.abs(w.LAYOUTS.garden.w / w.LAYOUTS.garden.h - 0.8) < 1e-9);
  check('the plate is on disk with its small copy', fs.existsSync(path.join(root, 'assets/room/dream/street-wide-v1.webp')) && fs.existsSync(path.join(root, 'assets/room/dream/street-wide-v1-sm.webp')));
  var xs = [].concat.apply([], L.zones).map(function (p) { return p[0]; }).concat(L.doors.map(function (d) { return d.x; }), L.hotspots.map(function (h) { return h.x; }));
  check('every position is a percent of the box: inside 0 to 250 across, and the street really runs past the first screen', xs.every(function (x) { return x >= 0 && x <= 250; }) && Math.max.apply(null, xs) > 200 && Math.min.apply(null, xs) < 50, [Math.min.apply(null, xs), Math.max.apply(null, xs)].join());
  var arch = L.doors.filter(function (d) { return d.to === 'garden'; })[0], arch2 = L.doors.filter(function (d) { return d.to === 'plaza'; })[0];
  check('the garden arch is at the left end and the plaza arch at the right end, more than two screens apart', arch.x < 50 && arch2.x > 200 && arch2.x - arch.x > 150, [arch.x, arch2.x].join());
  var wl = K.world(L, []), m = K.rasterise(wl), m1 = K.rasterise(K.world(w.LAYOUTS.garden, []));
  check('the planner grid grows with the plate: 125 columns on the street, 50 elsewhere', m.cols === 125 && m1.cols === 50 && m.length === 125 * K.ROWS && m1.length === K.COLS * K.ROWS, [m.cols, m1.cols].join());
  check('cells past x 100 are addressed on the wide mask, and an unwidened call keeps the old clamp', K.cellOf(240, 70, m).c === 120 && K.cellOf(240, 70).c === K.COLS - 1);
  /* independent check of every route segment: sample the segment against the floor polygons and the solids directly,
   * not through the planner's own mask, so an indexing slip in the grid cannot vouch for itself */
  function segOk(world, a, b, strict) { var n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25)), e = strict ? 0 : 0.6; for (var i = 1; i <= n; i++) { var t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (!K.inZones(world.zones, x, y)) return false; if (world.solids.some(function (q) { return x > q.x0 + e && x < q.x1 - e && y > q.y0 + e && y < q.y1 - e; })) return false; } return true; } /* the floor polygons and the solids sampled directly (the middle legs may graze a corner within a cell; the first leg may not) */
  function routeOk(world, r) { return !!r && r.pts.every(function (p, i) { return i === 0 || segOk(world, r.pts[i - 1], p, i === 1); }); }
  var toPlaza = K.plan(wl, L.home, arch2), toArch = K.plan(wl, arch2, arch);
  check('from the street home spot a route reaches the plaza arch, crossing x 100 and staying on the cobbles', toPlaza && toPlaza.pts.some(function (p) { return p.x > 100; }) && routeOk(wl, toPlaza), toPlaza && JSON.stringify(toPlaza.pts));
  check('and back from the plaza arch to the garden arch, the whole length of the street', routeOk(wl, toArch) && Math.abs(toArch.pts[toArch.pts.length - 1].x - arch.x) < 2.5, toArch && JSON.stringify(toArch.pts));
  var bad = [];
  L.hotspots.forEach(function (h) { var r = K.plan(wl, L.home, h.wp); if (!r) bad.push(h.id + ': no route'); else if (!routeOk(wl, r)) bad.push(h.id + ': off the floor or through a solid'); else if (Math.hypot(r.pts[r.pts.length - 1].x - h.wp.x, r.pts[r.pts.length - 1].y - h.wp.y) > 1.5) bad.push(h.id + ': ends short'); });
  check('every storefront, both arches and the bench are reachable from the home spot, checked segment by segment', bad.length === 0, bad.join('; '));
  /* Codex, 19 Oct: a key walk can leave her on valid floor in a cell whose centre is off it or in a solid */
  var edge = { x: 198, y: 78 }, fromEdge = L.hotspots.map(function (h) { return K.plan(wl, edge, h.wp); });
  check('standing at the front edge beside the plaza arch pillar (198, 78) after a key walk, every hotspot still has a route', K.inZones(wl.zones, edge.x, edge.y) && !K.blocked(wl.solids, edge.x, edge.y) && fromEdge.every(function (r) { return routeOk(wl, r); }), JSON.stringify(fromEdge.map(function (r) { return r && r.pts.length; })));
  var byPot = { x: 108.04, y: 63.5 }, toNook = K.plan(wl, byPot, L.doors.filter(function (d) { return d.tap === 'furniture'; })[0]);
  check('just left of the Nook\u2019s pot, the first leg of a route to its doorstep never clips the pot', !K.blocked(wl.solids, byPot.x, byPot.y) && toNook && segOk(wl, toNook.pts[0], toNook.pts[1], true) && routeOk(wl, toNook), toNook && JSON.stringify(toNook.pts.slice(0, 3)));
  /* a synthetic wide floor with a wall at x 150 open only at the bottom: the planner must find the gap past x 100 */
  var wall = { zones: [[[0, 40], [250, 40], [250, 90], [0, 90]]], solids: [{ id: 'wall', x0: 150, x1: 154, y0: 40, y1: 80 }], doors: [], span: 2.5 };
  var gap = K.plan(wall, { x: 120, y: 60 }, { x: 200, y: 60 });
  function clearOf(a, b) { var n = 400, q = wall.solids[0]; for (var i = 0; i <= n; i++) { var t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1) return false; } return true; } /* the wall's interior; grazing its corner at cell precision is not crossing it */
  check('a wall beyond x 100 is routed round through its gap, never through it', gap && gap.pts.some(function (p) { return p.y > 80; }) && gap.pts.every(function (p, i) { return i === 0 || clearOf(gap.pts[i - 1], p); }), gap && JSON.stringify(gap.pts));
  check('storefronts open where a walk ends, arches take her as she steps in', L.doors.filter(function (d) { return d.tap; }).every(K.passing) && !K.passing(arch) && !K.passing(arch2));
  var near = K.plan(wl, L.home, arch), far = K.plan(wl, L.home, arch2);
  check('the mini-map walks to a near door and fades to a far one: the garden arch is near the home spot, the plaza arch is not', near.cost <= K.FAR && far.cost > K.FAR, [near.cost.toFixed(1), far.cost.toFixed(1), K.FAR].join());
  /* camera maths with the inner's content 2.5 boxes wide */
  var z = M.zoomFor(L, K.sceneOf), cs = M.clamp(-1e6, -1e6, z, W, H, 2.5), zi = 1.6, ci = M.clamp(-1e6, -1e6, zi, W, H, 2.5);
  check('the street opens fitted like every scene (zoom 1): the full height in view, and the clamp lets the view travel to the right edge W - 2.5 W, no further', z === 1 && Math.abs(cs.x - (W - W * 2.5)) < 1e-9 && cs.y === 0, JSON.stringify(cs));
  check('zoomed in with + the clamp is W - 2.5 W z across and H - H z down', Math.abs(ci.x - (W - W * 2.5 * zi)) < 1e-9 && Math.abs(ci.y - (H - H * zi)) < 1e-9, JSON.stringify(ci));
  var atArch = M.centreOn(arch, z, W, H, 2.5), atArch2 = M.centreOn(arch2, z, W, H, 2.5);
  check('centred on the garden arch the view holds the left edge; on the plaza arch it holds the right edge', atArch.x === 0 && Math.abs(atArch2.x - (W - W * 2.5 * z)) < 1e-9, JSON.stringify([atArch, atArch2]));
  var mid1 = M.centreOn({ x: 120, y: 60 }, 1, W, H, 2.5);
  check('at zoom 1 a wide plate still pans sideways (and never up or down)', Math.abs(mid1.x - (W * 0.5 - 1.2 * W)) < 1e-9 && mid1.y === 0, JSON.stringify(mid1));
  var same = [{ x: 2, y: 2 }, { x: 50, y: 50 }, { x: 98, y: 98 }, { x: 70, y: 30 }].every(function (f) { var a = M.centreOn(f, 1.6, W, H), b = M.centreOn(f, 1.6, W, H, 1), c = M.target(f, { x: -100, y: -80, z: 1.6 }, W, H), d = M.target(f, { x: -100, y: -80, z: 1.6 }, W, H, 1); return a.x === b.x && a.y === b.y && c.x === d.x && c.y === d.y; });
  check('span 1 (every other plate) gives exactly the old answers', same);
  var low = M.centreOn({ x: 120, y: 60 }, zi, W, H, 2.5, 0.68), lowS = M.toScreen({ x: 120, y: 60 }, { x: low.x, y: low.y, z: zi }, W, H);
  check('zoomed in, the street holds her feet lower on the box (cam.sy 0.68) so its roofs stay in view', L.cam.sy === 0.68 && Math.abs(lowS.y - H * 0.68) < 1e-6 && M.target({ x: 120, y: 60 }, { x: low.x, y: low.y, z: zi }, W, H, 2.5, 0.68).y === low.y, JSON.stringify(lowS));
  /* walk her the length of the street at walking speed with uneven frames: the view follows, stays in the clamp, keeps her on screen */
  var cam = M.centreOn(arch, z, W, H, 2.5); cam.z = z; var f = { x: arch.x, y: arch.y }, minS = 1e9, maxS = -1e9, inClamp = true, steps = [1 / 60, 1 / 30, 1 / 120, 0.05];
  for (var i = 0; f.x < arch2.x; i++) { var dt = steps[i % steps.length]; f = { x: Math.min(arch2.x, f.x + K.SPEED * dt), y: arch.y + (arch2.y - arch.y) * (f.x - arch.x) / (arch2.x - arch.x) }; var tg = M.target(f, cam, W, H, 2.5); cam = { x: M.approach(cam.x, tg.x, dt), y: M.approach(cam.y, tg.y, dt), z: z }; var sx = M.toScreen(f, cam, W, H).x; minS = Math.min(minS, sx); maxS = Math.max(maxS, sx); if (cam.x > 1e-9 || cam.x < W - W * 2.5 * z - 1e-9) inClamp = false; }
  check('walking the whole street the camera follows inside the clamp and she never leaves the middle of the screen', inClamp && minS > W * 0.1 && maxS < W * 0.9 && cam.x < W - W * 2.5 * z + W * 0.2, JSON.stringify({ minS: minS, maxS: maxS, cam: cam.x }));
})();

(function streetOccluders() {
  console.log('foreground cutouts on the wide street: the front pillar of each arch and the two lamps, drawn over the plate and ranked by their base');
  var w = scenes('2026-10-19'), K = w.OvuWalk, L = w.LAYOUTS.street = require('./fixtures/wide-street-layout.js')(), occ = L.occluders || [];
  /* a WebP's pixel size from its header (VP8X canvas, or a plain VP8 / VP8L frame) */
  function webpSize(file) {
    var b = fs.readFileSync(file), kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') { var v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  var PX = L.w / (100 * L.span), PY = L.h / 100; /* plate pixels per box percent */
  check('four cutouts: both arches and both lamps, each a file on disk at the plate\'s own pixels (box percent times 8.192 across, 10.24 down)', occ.length === 4 && occ.map(function (o) { return o.id; }).join() === 'garden-arch,lamp-west,lamp-east,plaza-arch' && occ.every(function (o) { var f = path.join(root, 'assets/room/dream', o.img); if (!fs.existsSync(f)) return false; var sz = webpSize(f); return Math.abs(sz.w - o.w * PX) < 0.6 && Math.abs(sz.h - o.h * PY) < 0.6; }), JSON.stringify(occ.map(function (o) { var f = path.join(root, 'assets/room/dream', o.img); return fs.existsSync(f) ? [webpSize(f), o.w * PX, o.h * PY] : 'missing ' + o.img; })));
  /* each cutout sits on its own solid: the solid's middle inside the cutout, the base inside the solid, the cutout reaching down to the base */
  var match = occ.map(function (o) { return (L.solids || []).filter(function (b) { var cx = (b.x0 + b.x1) / 2; return b.id === o.solid && cx > o.x && cx < o.x + o.w && o.base >= b.y0 && o.base <= b.y1; }); });
  check('each cutout lines up with its own solid (the arch pillar or lamp footprint): its middle inside the cutout, the base inside the footprint, the cutout reaching down past the base', match.every(function (m) { return m.length === 1; }) && match[0][0] !== match[3][0] && occ.every(function (o) { var bottom = o.y + o.h; return bottom >= o.base && bottom - o.base < 2.5; }), JSON.stringify(match.map(function (m) { return m.map(function (b) { return [b.x0, b.x1, b.y0, b.y1]; }); })));
  check('the plate pixels are those of the street plate in percent of the box (0 to 250 across)', occ.every(function (o) { return o.x >= 0 && o.x + o.w <= 100 * L.span && o.y >= 0 && o.y + o.h <= 100; }));
  /* standing anywhere behind a cutout (feet on the floor above its base, her figure overlapping it) her head stays below its top edge,
   * so the cut never shows a seam across her. Her height from the base sprite: width 12 of the box, 318 x 720 pixels, box 0.8 */
  var av = webpSize(path.join(root, 'assets/room/dream/avatar-base.webp')), tall = L.avatarW * (av.h / av.w) * (L.w / (L.h * L.span)), wl = K.world(L, []), worst = [];
  occ.forEach(function (o) {
    var low = 1e9; for (var x = o.x - L.avatarW / 2; x <= o.x + o.w + L.avatarW / 2; x += 0.25) for (var y = 0; y < o.base; y += 0.25) if (K.inZones(wl.zones, x, y) && !K.blocked(wl.solids, x, y)) { low = Math.min(low, y); break; }
    worst.push({ id: o.id, feet: low, head: +(low - tall).toFixed(2), top: o.y });
  });
  check('standing at the back of the floor behind any cutout her head (21.7 tall) stays below the cutout\'s top edge', worst.every(function (r) { return r.feet < 1e9 && r.head > r.top; }), JSON.stringify(worst));
  /* the depth: the walk engine ranks the cutouts by their base with her and a walking pet */
  var plaza = occ.filter(function (o) { return o.id === 'plaza-arch'; })[0], east = occ.filter(function (o) { return o.id === 'lamp-east'; })[0];
  function zs(herY, petY) { var items = occ.map(function (o) { return { y: o.base }; }).concat([{ y: petY }, { y: herY }]), z = K.depthRank(items); return { occ: z.slice(0, occ.length), pet: z[occ.length], her: z[z.length - 1] }; }
  var behind = zs(73, 70), front = zs(79, 70), i = occ.indexOf(plaza);
  check('standing at x 205, y 73 she is behind the plaza arch\'s front pillar (its z is higher); at y 79 she is in front', behind.occ[i] > behind.her && front.her > front.occ[i], JSON.stringify({ behind: behind, front: front }));
  var pb = zs(60, east.base - 0.6), pf = zs(60, east.base + 0.6), j = occ.indexOf(east);
  check('a walking pet passes behind the east lamp just above its base and in front just below it', pb.occ[j] > pb.pet && pf.pet > pf.occ[j], JSON.stringify({ behind: pb, front: pf }));
  /* the most the street ever ranks: the four cutouts, a walking pet, her and a bench sitter (the bench's ground line) */
  check('seven on the street (four cutouts, a pet, her, a bench sitter) rank without a tie, so she can never share a z with a pillar she is behind', [60, 62, 68.2, 73, 77, 79].every(function (y) { var items = occ.map(function (o) { return { y: o.base }; }).concat([{ y: y + 0.3 }, { y: L.meditator.seat.groundY }, { y: y }]), z = K.depthRank(items); return items.length === 7 && z.filter(function (v, k) { return z.indexOf(v) === k; }).length === z.length; }));
  check('the cutouts are the street\'s alone: every other layout (the homes, garden, plaza, stores) has none and draws as before', Object.keys(w.LAYOUTS).every(function (id) { return id === 'street' || !w.LAYOUTS[id].occluders; }));
  /* the cut script and the layout agree, so a re-cut keeps the placement it prints */
  var py = fs.readFileSync(path.join(root, 'tools/art/occluders.py'), 'utf8');
  check('tools/art/occluders.py cuts the same four, with the same files, solids and bases as the layout', occ.every(function (o) { return py.indexOf("{'id': '" + o.id + "', 'solid': '" + o.solid + "', 'file': '" + o.img + "', 'base': " + o.base.toFixed(1) + ',') > -1; }));
})();

(function petsWalk() {
  console.log('the pets walk: strides, bounded trips on the floor, no pet boxed in, worn pieces riding the head (ovu-petwalk.js)');
  var w = scenes('2026-10-19'), M = w.OvuPetWalk.M, WK = w.OvuWalk;
  check('cats walk at 11 and dogs at 13 iso units a second, eight frames per stride', M.speedFor('cat') === 11 && M.speedFor('mewmew') === 13 && M.strideFor('cat') === 11 && M.frameOf(M.cycleAdvance(0, 5.5, 'cat')) === 4 && M.frameOf(M.cycleAdvance(0, 11, 'cat')) === 0);
  var seed = 7, rand = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  var world = { zones: [[[50, 20], [95, 50], [50, 80], [5, 50]]], solids: [{ id: 'table', x0: 45, x1: 60, y0: 45, y1: 55 }], doors: [] };
  var from = { x: 30, y: 50 }, home = { x: 30, y: 50 }, found = 0, ok = true;
  for (var i = 0; i < 12; i++) { var res = M.pickTarget(WK, world, from, home, rand, 10); if (!res) continue; found++; var end = res.pts[res.pts.length - 1]; if (M.isoDist(end, from) < M.MIN_TRIP || M.isoDist(end, from) > M.RADIUS + 2 || M.isoDist(end, home) > M.LEASH || !M.segmentsClear(WK, world, res.pts)) ok = false; }
  check('trips land on the floor within reach and leash, every segment clear of the table', found >= 6 && ok, found);
  check('a segment through the table is rejected, a clear one accepted', !M.segmentsClear(WK, world, [{ x: 30, y: 50 }, { x: 70, y: 50 }]) && M.segmentsClear(WK, world, [{ x: 30, y: 50 }, { x: 40, y: 56 }]));
  check('a pet placed on the rim may start off the floor but never cross it later', M.segmentsClear(WK, world, [{ x: 3, y: 50 }, { x: 20, y: 50 }], true) && !M.segmentsClear(WK, world, [{ x: 3, y: 50 }, { x: 20, y: 50 }], false));
  var boxed = [], POS = { cat: { x: 55.4, y: 81 }, dog: { x: 22.9, y: 68.5 }, mewmew: { x: 62, y: 86 } };
  ['room', 'house', 'bathhouse', 'familyhome', 'garden'].forEach(function (id) {
    var L = w.LAYOUTS[id]; ['cat', 'dog', 'mewmew'].forEach(function (pid) {
      var base = (L.props && L.props[pid]) || POS[pid], wl = WK.world(L, []), startOff = !M.onFloor(WK, wl, base.x, base.y), got = null;
      for (var k = 0; k < 6 && !got; k++) got = M.pickTarget(WK, wl, { x: base.x, y: base.y }, { x: base.x, y: base.y }, rand, 10, startOff);
      if (!got) boxed.push(id + ':' + pid);
    });
  });
  check('no pet is boxed in: from every home spot in every home layout and the garden a trip exists', boxed.length === 0, boxed.join(','));
  var sit = { x: 100, y: 60, w: 80 }, fh = { x: 300, y: 90, w: 120 }, p = M.wornOn({ x: 110, y: 90, w: 30 }, sit, fh);
  check('a worn piece keeps its offset from the head, scaled by the head width', Math.abs(p.x - 315) < 1e-9 && Math.abs(p.y - 135) < 1e-9 && Math.abs(p.w - 45) < 1e-9, JSON.stringify(p));
  check('a sidecar must carry eight frames, sizes and anchors', M.validMeta({ frames: 8, w: 500, h: 600, standW: 377, heads: new Array(8), standHead: {} }) && !M.validMeta({ frames: 6, w: 500, h: 600, standW: 377, heads: new Array(6), standHead: {} }));
  var strips = 0; ['cat', 'catblack', 'catginger', 'dog', 'shiba', 'mewmew'].forEach(function (id) { ['side', 'away', 'towards'].forEach(function (d) { var f = path.join(root, 'assets/room/dream/pet-walk-' + id + '-' + d); if (fs.existsSync(f + '.webp') && fs.existsSync(f + '.json') && M.validMeta(JSON.parse(fs.readFileSync(f + '.json', 'utf8')))) strips++; }); });
  check('all eighteen pet strips are on disk with valid sidecars', strips === 18, strips);
  var ST = w.OvuStreet;
  check('the three stores keep different hours and the hours helper reads a date', ST.hoursFor('pet')[0] === 10 && ST.hoursFor('furniture')[0] === 11 && ST.hoursFor('home')[0] === 9 && !ST.openAt('pet', new Date(2026, 9, 19, 8, 30)) && ST.openAt('pet', new Date(2026, 9, 19, 12, 0)) && !ST.openAt('pet', new Date(2026, 9, 19, 19, 0)) && ST.openAt('home', new Date(2026, 9, 19, 9, 0)) && ST.hoursText('furniture') === '11 am to 9 pm');
  /* walking together: the pet keeps a few steps behind on her own trail, catches up, and stops when she stops */
  var her = { x: 70, y: 50 }, crumbs = [{ x: 52, y: 50 }, { x: 52, y: 60 }, { x: 70, y: 60 }], start = { x: 45, y: 50 };
  var L0 = M.pathLen(start, crumbs, her);
  check('the trail length runs from the pet through each footstep to her', Math.abs(L0 - (7 + 20 + 18 + 20)) < 1e-9, L0);
  var a1 = M.along(start, crumbs, her, 10);
  check('moving along the trail passes the footsteps in order and turns the corner (no shortcut through what she walked round)', a1.used === 1 && Math.abs(a1.x - 52) < 1e-9 && Math.abs(a1.y - 51.5) < 1e-9, JSON.stringify(a1));
  var a2 = M.along(start, crumbs, her, 1000);
  check('it never runs past her', a2.x === her.x && a2.y === her.y && a2.used === crumbs.length, JSON.stringify(a2));
  check('it catches up faster the further behind it is, gently near the end, never faster than a trot', M.followSpeed(0) === 12 && M.followSpeed(3.5) === 26 && M.followSpeed(50) === 32 && M.followSpeed(-5) === 8);
  var sim = { x: 45, y: 50 }, trail = crumbs.slice(), t = 0;
  for (var i = 0; i < 600; i++) { var len = M.pathLen(sim, trail, her); if (len <= M.LAG + 0.05) break; var r = M.along(sim, trail, her, Math.min(M.followSpeed(len - M.LAG) / 60, len - M.LAG)); trail.splice(0, r.used); sim = { x: r.x, y: r.y }; t += 1 / 60; }
  check('when she stands still the pet walks up to a few steps behind her and stops there', Math.abs(M.pathLen(sim, trail, her) - M.LAG) < 0.1 && t < 4, JSON.stringify({ sim: sim, t: t }));
  var bs = M.behindSpots({ x: 50, y: 50 }, false), bl = M.behindSpots({ x: 50, y: 50 }, true);
  check('on arrival the pet stands behind her: to her left when she faces right, to her right when she faces left', bs[0].x < 50 && bl[0].x > 50 && bs.every(function (p) { return Math.abs(p.x - 50) >= 4 || Math.abs(p.y - 50) >= 3; }));
})();

/* ---------- life-sim slice: the calendar, stamina and the proximity prompt (ovu-gametime.js, ovu-stamina.js, ovu-interact.js) ---------- */
(function lifeSim() {
  console.log('life-sim: the calendar names the real day, stamina costs and refills, the nearest hotspot prompts');
  var w = fresh('2026-10-19');
  var speed = 1, RealDate = w.Date;
  /* the modules read the phone's clock through new Date(): a fake with a settable now keeps this block the same on any day */
  w.__now = new RealDate(2026, 9, 19, 12, 0).getTime();
  w.Date = function FakeDate() { var a = arguments; if (!a.length) return new RealDate(w.__now); if (a.length === 1) return new RealDate(a[0]); return new RealDate(a[0], a[1], a[2] || 1, a[3] || 0, a[4] || 0, a[5] || 0, a[6] || 0); };
  w.Date.now = function () { return w.__now; }; w.Date.parse = RealDate.parse; w.Date.UTC = RealDate.UTC; w.Date.prototype = RealDate.prototype;
  w.OvuWalk = { walking: function () { return false; }, setSpeedScale: function (k) { speed = k; } };
  w.OvuRoom = { on: function () { }, els: { scene: { classList: { toggle: function () { }, contains: function () { return false; } } } }, busy: function () { return false; }, layout: function () { return null; }, pos: function () { return { x: 0, y: 0 }; }, visiting: function () { return false; }, toast: function () { } };
  w.setInterval = function () { return 0; }; w.clearTimeout = function () { }; w.setTimeout = function () { return 0; };
  ['ovu-gametime.js', 'ovu-stamina.js', 'ovu-interact.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var GT = w.OvuGameTime, ST = w.OvuStamina, IN = w.OvuInteract, S = w.OvuStore;
  check('dayKey is the local calendar date', GT.dayKey(new w.Date(2026, 9, 19, 23, 30)) === '2026-10-19' && GT.dayKey(new w.Date(2026, 0, 1, 0, 5)) === '2026-01-01');
  check('seasons follow the month', GT.season(new w.Date(2026, 0, 10)) === 'winter' && GT.season(new w.Date(2026, 3, 10)) === 'spring' && GT.season(new w.Date(2026, 6, 10)) === 'summer' && GT.season(new w.Date(2026, 9, 19)) === 'autumn');
  check('the hour reads like a watch', GT.hourLabel(new w.Date(2026, 9, 19, 15, 5)) === '3:05 pm' && GT.hourLabel(new w.Date(2026, 9, 19, 0, 0)) === '12 am' && GT.hourLabel(new w.Date(2026, 9, 19, 12, 30)) === '12:30 pm');
  S.setState({ game: { firstDay: '2026-10-08' } });
  check('the day count starts at 1 on the first day played and counts real days', GT.day(new w.Date(2026, 9, 8)) === 1 && GT.day(new w.Date(2026, 9, 19)) === 12);
  var seen = []; GT.onNewDay(function (k, prev) { seen.push([prev, k]); });
  check('the first open of the app stamps the first day', (function () { S.setState({ game: null }); return !!(GT.day() >= 1 && S.state().game && S.state().game.firstDay); })());
  S.setState({ stamina: null });
  check('stamina starts full and a watering costs 6', ST.value() === 100 && ST.spend('water') === true && ST.value() === 94 && ST.can('water'));
  var ok = true; for (var i = 0; i < 20; i++) ok = ST.spend('water', true) && ok;
  check('spending stops at the cost line and says no quietly when asked', ST.value() === 4 && ST.spend('water', true) === false && ST.value() === 4 && ST.low() === true && speed === 0.72);
  ST.refill();
  check('a refill is full and the walk is back to full speed', ST.value() === 100 && !ST.low() && speed === 1);
  S.setState({ stamina: { v: 10, max: 100, day: '2026-10-18' } });
  check('a new day refills on its own', ST.value() === 100);
  S.setState({ stamina: { v: 30, max: 100, day: GT.dayKey() }, sleeping: null });
  S.setState({ sleeping: { at: '2026-10-19T22:00:00Z' } });
  check('getting into bed alone refills nothing (Codex, 20 Oct: it used to refill before "I did not sleep")', ST.value() === 30);
  S.setState({ sleeping: null });
  var nowMs = w.Date.now(); /* the window's clock (fixed for this block), not the real one */
  check('a saved night refills only after three real hours in bed', ST.restedEnough(new Date(nowMs - 3.1 * 3600000).toISOString(), nowMs) && !ST.restedEnough(new Date(nowMs - 20 * 60000).toISOString(), nowMs) && !ST.restedEnough('not a date', nowMs) && ST.rested(new Date(nowMs - 20 * 60000).toISOString()) === false && ST.value() === 30 && ST.rested(new Date(nowMs - 7 * 3600000).toISOString()) === true && ST.value() === 100);
  S.setState({ stamina: { v: 30, max: 100, day: GT.dayKey() } });
  S.setState({ stamina: { v: 30, max: 100, day: '2026-10-21' } });
  check('a clock set back keeps the energy it had; only a later date refills', ST.value() === 30);
  S.setState({ game: { firstDay: '2026-10-25' } });
  check('the day count never shows 0 when the clock is before the first day', GT.day() === 1);
  S.setState({ game: { firstDay: '2026-10-08' } });
  GT.check(); var before = seen.length;
  w.__now = new RealDate(2026, 9, 20, 0, 2).getTime(); GT.check(); GT.check();
  check('the date turning fires the new-day watchers once, with the old and new keys, and a repeat check is quiet', seen.length === before + 1 && seen[seen.length - 1][0] === '2026-10-19' && seen[seen.length - 1][1] === '2026-10-20', JSON.stringify(seen));
  w.__now = new RealDate(2026, 9, 23, 9, 0).getTime(); GT.check();
  check('three skipped days fire one watcher call and the calendar moves three days', seen.length === before + 2 && seen[seen.length - 1][1] === '2026-10-23' && GT.day() === 16, JSON.stringify(seen));
  w.__now = new RealDate(2026, 9, 19, 12, 0).getTime(); GT.check();
  var hots = [{ id: 'bed', label: 'Bed · go to sleep', x: 36, y: 60, wp: { x: 40, y: 72 } }, { id: 'desk', label: 'Desk · write in your journal', x: 70, y: 60, wp: { x: 68, y: 74 } }, { id: 'mat', label: 'Yoga mat · breathe', x: 30, y: 85, prompt: 'Tap to breathe a while' }];
  check('the nearest hotspot within reach is found by its stand point, none when far', IN.nearest({ x: 41, y: 73 }, hots).id === 'bed' && IN.nearest({ x: 66, y: 73 }, hots).id === 'desk' && IN.nearest({ x: 10, y: 20 }, hots) === null);
  check('the prompt verb comes from the label after the dot, or the hotspot\'s own prompt', IN.verb(hots[0]) === 'Tap to go to sleep' && IN.verb(hots[1]) === 'Tap to write in your journal' && IN.verb(hots[2]) === 'Tap to breathe a while');
  check('a way-back label reads as a sentence: "Tap to go back to the street", "Tap to go back home"', IN.verb({ label: 'Door mat · back to the street' }) === 'Tap to go back to the street' && IN.verb({ label: 'Gate · back home' }) === 'Tap to go back home' && IN.verb({ label: 'Arch · Back to the garden' }) === 'Tap to go back to the garden');
})();


/* ---------- the farm (ovu-farm.js): rules, then the plate's floor through the real walk engine ---------- */
(function farm() {
  console.log('farm: seeds a day, planting, watering by real days, weeds, harvest; the plate is walkable');
  var w = scenes('2026-10-19');
  w.OvuRoom = null; w.OvuZones = null; /* rules only: the scene wiring stands down without a room */
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  var F = w.OvuFarm, S = w.OvuStore, K = w.OvuWalk, day = '2026-10-19', next = '2026-10-20';
  check('twelve beds sit inside the bed grid and their stand points sit outside it on the slab', F.BEDS.length === 12 && F.BEDS.every(function (b) { return K.inPoly(F.LAYOUT.zones[0], b.wp.x, b.wp.y) && K.blocked(F.LAYOUT.solids, b.wp.x, b.wp.y) === null; }), JSON.stringify(F.BEDS.map(function (b) { return b.wp; })));
  var bad = K.checkLayout(F.LAYOUT);
  check('farm: home, hotspot stand points and the gate are on the floor and outside every solid', bad.length === 0, JSON.stringify(bad));
  var wd = K.world(F.LAYOUT, []);
  check('every bed can be reached from the gate by the planner', F.BEDS.every(function (b) { return !!K.plan(wd, F.LAYOUT.home, b.wp, 2); }));
  var frame = F.LAYOUT.solids.filter(function (s) { return s.id === 'beds'; })[0];
  check('Codex (22 Oct): a focused bed shows a ring round its own soil, so an empty bed shows focus too', /\.bedplants\.focus::after\{content:""[^}]*border-radius:50%/.test(fs.readFileSync(path.join(root, 'room.css'), 'utf8')) && /pics\[bb\.id\]\.classList\.add\('focus'\)/.test(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8')));
  check('Codex (22 Oct): the bed frame is one polygon solid; every bed centre is inside it and blocked, so she never stands on a bed', !!(frame && frame.poly && frame.poly.length === 4) && F.BEDS.every(function (b) { return K.inPoly(frame.poly, b.at.x, b.at.y) && K.blocked(F.LAYOUT.solids, b.at.x, b.at.y) === frame; }));
  var soil = [F.at(-0.5, -0.5), F.at(3.5, -0.5), F.at(3.5, 2.5), F.at(-0.5, 2.5)].map(function (q) { return [q.x, q.y]; });
  check('Codex (22 Oct): every planned walk from the gate to a bed\'s stand stays off the beds\' soil (the frame solid keeps a margin round it; grid rounding may touch only that margin), sampled every quarter unit', F.BEDS.every(function (b) { var r = K.plan(wd, F.LAYOUT.home, b.wp, 2); if (!r) return false; for (var k = 1; k < r.pts.length; k++) { var a = r.pts[k - 1], c = r.pts[k], n = Math.max(2, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 0.25)); for (var q = 0; q <= n; q++) { var x = a.x + (c.x - a.x) * q / n, y = a.y + (c.y - a.y) * q / n; if (K.inPoly(soil, x, y)) return false; } } return true; }));
  check('every hotspot stand point (the well behind the beds included) is reachable from the gate by the planner', F.LAYOUT.hotspots.every(function (h) { return !!K.plan(wd, F.LAYOUT.home, h.wp, 2); }), JSON.stringify(F.LAYOUT.hotspots.filter(function (h) { return !K.plan(wd, F.LAYOUT.home, h.wp, 2); }).map(function (h) { return h.id; })));
  check('beds that share a stand point share one prompt, so no bed is shadowed by its neighbour', F.LAYOUT.prompts.length === F.STANDS.length && F.STANDS.every(function (st) { var hit = w.OvuInteract ? null : null; return st.beds.length >= 1; }) && F.STANDS.reduce(function (n, st) { return n + st.beds.length; }, 0) === 12 && F.STANDS.some(function (st) { return st.beds.length > 1; }));
  S.setState({ farm: null });
  check('the shed gives three seeds a day and no more', F.seedsLeftToday(S, day) === 3 && F.takeSeed(S, 'carrot', day).ok && F.takeSeed(S, 'carrot', day).ok && F.takeSeed(S, 'radish', day).ok && F.takeSeed(S, 'tomato', day).ok === false && F.seedsLeftToday(S, day) === 0 && F.seedsLeftToday(S, next) === 3);
  check('a clock that goes back to a claimed date gives no seeds twice', F.takeSeed(S, 'pumpkin', next).ok && F.seedsLeftToday(S, next) === 2 && F.seedsLeftToday(S, day) === 0 && !F.takeSeed(S, 'pumpkin', day).ok);
  S.setState({ farm: Object.assign({}, S.state().farm, { seeds: { carrot: 2, radish: 1 }, seedsByDay: {} }) });
  var weedy = F.BEDS.filter(function (b) { return F.hasWeeds(null, b.id, day); }).map(function (b) { return b.id; });
  var clean = F.BEDS.filter(function (b) { return !F.hasWeeds(null, b.id, day); })[0].id;
  check('weeds fall on a couple of beds a day, the same ones on every phone', weedy.length >= 1 && weedy.length <= 5 && JSON.stringify(weedy) === JSON.stringify(F.BEDS.filter(function (b) { return F.hasWeeds(null, b.id, day); }).map(function (b) { return b.id; })), JSON.stringify(weedy));
  if (weedy.length) check('a weedy bed refuses planting and watering until pulled, and stays clear that day', !F.plant(S, weedy[0], 'carrot', day).ok && F.clearWeeds(S, weedy[0], day).ok && !F.hasWeeds(F.bed(S, weedy[0]), weedy[0], day) && F.plant(S, weedy[0], 'carrot', day).ok);
  check('planting takes a seed; a second crop in the same bed is refused', F.plant(S, clean, 'carrot', day).ok && !F.plant(S, clean, 'radish', day).ok && (F.farmState(S).seeds.carrot || 0) === 0);
  /* tending as she would: pull the day's weeds first, then water */
  function tend(id, d) { if (F.hasWeeds(F.bed(S, id), id, d)) F.clearWeeds(S, id, d); return F.water(S, id, d); }
  var w1 = tend(clean, day), w2 = F.water(S, clean, day);
  check('watering counts once a day and a missed day takes nothing away', w1.ok && w1.days === 1 && !w2.ok && F.stage(F.bed(S, clean)) === 1 && tend(clean, '2026-10-22').ok && F.growthDays(F.bed(S, clean)) === 2);
  check('weeds stop the watering can until they are pulled', F.BEDS.some(function (b) { return b.id !== clean && F.hasWeeds(null, b.id, '2026-10-23'); }) && (function () { var wb = F.BEDS.filter(function (b) { return b.id !== clean && F.hasWeeds(null, b.id, '2026-10-23'); })[0].id; S.setState({ farm: Object.assign({}, S.state().farm, { seeds: { radish: 1 } }) }); F.clearWeeds(S, wb, '2026-10-23'); F.plant(S, wb, 'radish', '2026-10-23'); var st = S.state().farm; st.beds[wb].cleared = undefined; S.setState({ farm: st }); return !F.water(S, wb, '2026-10-23').ok && F.clearWeeds(S, wb, '2026-10-23').ok && F.water(S, wb, '2026-10-23').ok; })());
  check('watering dated before the planting or before the last watering is refused (the clock went back)', !F.water(S, clean, '2026-10-18').ok && !F.water(S, clean, '2026-10-21').ok && F.growthDays(F.bed(S, clean)) === 2);
  check('a carrot is ripe after three watered days, not before', !F.ripe(F.bed(S, clean)) && !F.harvest(S, clean).ok && tend(clean, '2026-10-23').ok && F.ripe(F.bed(S, clean)) && F.stage(F.bed(S, clean)) === 3);
  var before = S.list().length, h = F.harvest(S, clean);
  check('harvest fills the basket, empties the bed and writes no diary entry', h.ok && h.crop === 'carrot' && h.n === 2 && F.farmState(S).harvest.carrot === 2 && !F.bed(S, clean).crop && S.list().length === before);
  var sm = F.summary(S, day);
  check('the summary counts planted, ripe, dry and weedy beds', typeof sm.planted === 'number' && typeof sm.weeds === 'number' && sm.seedsLeft === F.seedsLeftToday(S, day));
})();

/* ---------- plaza servers (ovu-plaza.js): the words a person sees; the server rules are tested in the database ---------- */
(function freeSeedFailureIsAtomic() {
  console.log('audit P1: free seeds and their daily allowance commit together');
  var w = fresh(), S = w.OvuStore, ls = w.localStorage, realSet = ls.setItem, day = S.today();
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), w, { filename: 'ovu-farm.js' });
  var F = w.OvuFarm;
  S.setState({ farm: { seeds: { carrot: 2 }, seedsByDay: {}, beds: {}, harvest: {}, guided: true } });
  var snap = JSON.stringify(S.state().farm), failed = null;
  ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') throw new Error('QuotaExceededError'); return realSet.call(ls, k, v); };
  try { failed = F.takeSeed(S, 'carrot', day); } catch (e) { failed = null; }
  ls.setItem = realSet;
  check('a failed free-seed claim is handled, keeps the farm unchanged and retains all three claims', failed && !failed.ok && /could not be saved/.test(failed.why) && JSON.stringify(S.state().farm) === snap && F.seedsLeftToday(S, day) === 3);
  S.setProfile({ name: 'Unrelated later save' });
  check('a later save never persists the refused seed', JSON.stringify(JSON.parse(ls.getItem('ovumind_db_v1')).state.farm) === snap);
  var writes = 0; ls.setItem = function (k, v) { if (k === 'ovumind_db_v1') writes++; return realSet.call(ls, k, v); };
  var r = F.takeSeed(S, 'carrot', day); ls.setItem = realSet;
  check('retry takes one allowance and gives one seed in one commit', r.ok && writes === 1 && F.farmState(S).seeds.carrot === 3 && F.seedsLeftToday(S, day) === 2);
})();


(function plazaWords() {
  console.log('plaza servers: counts read like a person would say them; full plazas point to one with room');
  var w = fresh('2026-10-19');
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-plaza.js'), 'utf8'), w, { filename: 'ovu-plaza.js' });
  var P = w.OvuPlaza;
  check('counts: nobody, one person, many; and just you once she is in', P.countText(0) === 'nobody here yet' && P.countText(1) === '1 person here' && P.countText(7) === '7 people here' && P.countText(1, true) === 'just you for now' && P.countText(3, true) === '3 people here');
  check('a plaza row says how full it is, Full at capacity, Closed when shut', P.roomText({ people: 3, capacity: 24 }) === '3 of 24 here' && P.roomText({ people: 24, capacity: 24 }) === '24 of 24, full' && P.roomText({ people: 0, capacity: 24, open: false }) === 'Closed for now');
  check('the pill: sign in when signed out, a total when choosing, her plaza and its count once in', P.pillText({ signedIn: false }) === 'Groups · sign in to join' && P.pillText({ signedIn: true, servers: [{ people: 2 }, { people: 3 }] }) === 'Choose a group · 5 online' && P.pillText({ signedIn: true, joined: { name: 'PCOS', people: 1 } }) === 'PCOS · just you for now' && P.pillText({ signedIn: true, joined: { name: 'PCOS', people: 4 }, offline: true }) === 'PCOS · reconnecting');
  check('a full group points to Everyone when it has room, or says to try later', P.fullText({ name: 'PCOS', suggest: { name: 'Everyone' } }) === 'PCOS is full right now. Everyone has room.' && P.fullText({ name: 'Menopause' }) === 'Menopause is full right now. Try again in a little while.');
  check('each group has its own quiet icon, and an unknown group the plain one', P.icon('pcos') === 'water_drop' && P.icon('menopause') === 'spa' && P.icon('trying-to-conceive') === 'favorite' && P.icon('everyone') === 'groups' && P.icon('somewhere-new') === 'groups');
  check('the module stands down without a room page and sends nothing', typeof P.join === 'undefined' && typeof P.state === 'undefined');
})();

/* ---------- plaza friends (ovu-friends.js): names, phrases, places and words; the server rules are tested in the database ---------- */
(function plazaFriends() {
  console.log('plaza friends: the name rules match the server, the phrase list matches the database, people stand on the floor');
  var w = fresh('2026-10-19');
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-friends.js'), 'utf8'), w, { filename: 'ovu-friends.js' });
  var F = w.OvuFriends, sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261019130000_plaza_friends.sql'), 'utf8');
  var np = F.nameProblem;
  check('names: the same answers as social.name_problem in the database dry run', np('x') === 'length' && np('Mei@home') === 'chars' && np('Mei 98765') === 'contact' && np('www mei') === 'contact' && np('Staff') === 'reserved' && np('Rhythme Team') === 'reserved' && np('Admin Jo') === 'reserved' && np('Zoë') === null && np('美玲') === null && np("Ana-María O'Neil") === null && np('  Mei   Ling ') === null && F.cleanName('  Mei   Ling ') === 'Mei Ling' && np('Cassandra') === null);
  check('names: 21 letters is too long, an emoji is not a letter, four digits look like a phone number', np('Abcdefghijklmnopqrstu') === 'length' && np('Mei 🙂') === 'chars' && np('Mei 1234') === 'contact' && np('Mei 123') === null);
  check('every problem has plain words, and an unknown one falls back to "Try another name."', ['length', 'chars', 'contact', 'reserved', 'word'].every(function (k) { return F.problemText(k).length > 8; }) && F.problemText('nope') === 'Try another name.');
  var seed = []; sql.replace(/\('([a-z-]+)', '([^']+)', '(note|hello)', \d+\)/g, function (_, id, text, kind) { seed.push([id, text, kind]); });
  check('the phrase list is the one the database seeds, word for word', seed.length === F.PHRASES.length && seed.every(function (p, i) { return F.PHRASES[i][0] === p[0] && F.PHRASES[i][1] === p[1] && F.PHRASES[i][2] === p[2]; }), JSON.stringify(seed.slice(0, 2)));
  var reasons = /reason text not null check \(reason in \(([^)]+)\)\)/.exec(sql)[1].replace(/'/g, '').split(', ');
  check('report reasons are the ones the database accepts', JSON.stringify(F.REASONS.map(function (r) { return r[0]; })) === JSON.stringify(reasons));
  var words = [].concat(F.PHRASES.map(function (p) { return p[1]; }), Object.keys(F.CUES).map(function (k) { return F.CUES[k]; }), [F.WORDS], F.REASONS.map(function (r) { return r[1]; }));
  check('no em dashes anywhere in the module, and no vendor or model names in its words', fs.readFileSync(path.join(root, 'ovu-friends.js'), 'utf8').indexOf('—') < 0 && words.every(function (t) { return !/\b(AI|GPT|Claude|Doubao|Supabase|model)\b/.test(t); }));
  check('the phrases are kind and plain: no health, body or pregnancy words, none longer than 40 characters', F.PHRASES.every(function (p) { return p[1].length <= 40 && !/pregnan|baby|period|cycle|weight|pain|heal|better soon|doctor/i.test(p[1]); }));
  check('every action has its mindfulness cue', ['card', 'ask', 'accept', 'notnow', 'note', 'receive', 'block', 'report', 'unfriend'].every(function (k) { return F.CUES[k] && F.CUES[k].length > 10; }));
  var many = []; for (var i = 0; i < 11; i++) many.push({ handle: 'h' + i, name: 'P' + i, look: i === 3 ? 'spacesuit' : 'cozy', friend: i === 0 });
  var placed = F.placeFor(many);
  check('eight people stand on the plate in order, the rest are listed; an unknown look wears the cosy knit', placed.length === 8 && placed[0].id === 'r0' && placed[0].friend && placed[7].handle === 'h7' && placed[3].outfit === 'base' && placed.every(function (p, k) { return p.real && p.spot === F.SPOTS[k]; }));
  var ib = { ok: true, asks: [{ handle: 'a', name: 'Nadia', at: '2026-10-19T01:00:00Z' }], notes: [{ id: 5, name: 'Mei', read: false }, { id: 4, name: 'Mei', read: true }], friends: [{}, {}] };
  check('the badge counts asks and unread notes only; a refused inbox counts nothing', F.badgeCount(ib) === 2 && F.badgeCount({ ok: false }) === 0 && F.badgeCount(null) === 0);
  check('new since last look: an ask not seen and a note above the last id', F.freshText(F.freshSince(ib, { asks: [], note: 0 })) === '2 new things in Plaza friends.' && F.freshText(F.freshSince(ib, { asks: ['a|2026-10-19T01:00:00Z'], note: 0 })) === 'A kind note from Mei.' && F.freshText(F.freshSince(ib, { asks: [], note: 5 })) === 'Nadia asked to be friends.' && F.freshText(F.freshSince(ib, { asks: ['a|2026-10-19T01:00:00Z'], note: 5 })) === '');
  check('a form from before a change elsewhere, Plaza friends turned off elsewhere and a hidden asker each get their own plain words', /another phone/.test(F.whyText({ why: 'stale' })) && /Open Plaza friends again to turn it on/.test(F.whyText({ why: 'consent' })) && /hidden from groups/.test(F.whyText({ why: 'hidden' })));
  check('refusals in plain words; a block reads the same as someone who left', F.whyText({ why: 'gone' }) === 'She is not here right now.' && F.whyText({ why: 'name', problem: 'contact' }) === 'No contact details in a name, please.' && /^Plaza friends is paused on this account until /.test(F.whyText({ why: 'paused', until: '2026-10-26T00:00:00Z' })) && F.whyText({ why: 'mystery' }) === 'That did not work. Try again in a moment.');
  check('the You row: sign in, make a card, no friends yet, counts with what is new', F.summary({ signedIn: false }) === 'Sign in to make friends in the plaza' && F.summary({ signedIn: true, me: { card: null } }) === 'Make a plaza card to meet people' && F.summary({ signedIn: true, me: { card: {} }, inbox: { ok: true, friends: [] } }) === 'No friends yet' && F.summary({ signedIn: true, me: { card: {} }, inbox: ib }) === '2 friends · 2 new' && F.summary({ signedIn: true, me: { paused_until: 'x' } }) === 'Paused for now');
  check('the module stands down without a room page and sends nothing', typeof F.open === 'undefined' && typeof F.state === 'undefined');
  var sw = scenes('2026-10-19'), L = sw.LAYOUTS.plaza;
  var clear = F.SPOTS.every(function (p) { return sw.OvuWalk.inZones(L.zones, p.x, p.y) && !L.solids.some(function (o) { return p.x > o.x0 && p.x < o.x1 && p.y > o.y0 && p.y < o.y1; }); });
  var apart = F.SPOTS.every(function (p, k) { return F.SPOTS.every(function (q, j) { return j === k || Math.hypot(p.x - q.x, p.y - q.y) >= 5; }); });
  check('the eight places stand on the plaza floor, clear of the furniture and apart from each other', F.SPOTS.length === 8 && clear && apart);
  var C = sw.OvuCommunity;
  C.setPeople(function () { return placed.slice(0, 2); });
  var withReal = C.neighbours();
  C.setPeople(function () { return []; }); var emptyReal = C.neighbours();
  C.setPeople(null);
  check('real people take the samples’ place while any are shown; with none, the samples come back', withReal.length === 2 && withReal[0].real && emptyReal.length === 4 && emptyReal[0].sample && C.neighbours().length === 4);
})();

(function ledgerAccounting() {
  console.log('hearts accounting: a record earns once, Moon Tap caps per day, gifts never repeat, two pets at home');
  var w = fresh(), RW = w.OvuRewards, S = w.OvuStore, T = w.OvuBreathTap;
  var ev = S.add('sleep', S.today(), { bedtime: '23:00', wake: '07:00', quality: 4 }, 'room');
  var r1 = RW.award(ev), r2 = RW.award(ev);
  check('the same saved record earns only once', r1.points > 0 && r2.points === 0 && r2.again === true, r1.points + '/' + r2.points);
  var h0 = RW.ledger().hearts;
  [600, 600, 600].forEach(function (secs) { RW.award(S.add('mindfulness', S.today(), T.entryFor(secs, 'easy', 0, 0), 'room')); });
  check('three ten-minute Moon Taps in a day earn six, the practice cap, not sixty', RW.ledger().hearts - h0 === 6, RW.ledger().hearts - h0);
  var g0 = RW.ledger().hearts; RW.grant(30, 'intro'); RW.grant(30, 'intro');
  check('a one-time gift is paid once, remembered outside the log', RW.ledger().hearts - g0 === 30 && RW.ledger().gifts.intro === true);
  var l = RW.ledger(); l.hearts = 2000; S.setState({ rewards: l });
  RW.buy('cat'); RW.buy('dog'); var mm = RW.buy('mewmew');
  check('a third adopted pet waits in the inventory', mm.waiting === true && !RW.ledger().placed.mewmew && RW.ledger().owned.indexOf('mewmew') > -1);
  var threw = false; try { RW.toggle('mewmew'); } catch (e) { threw = /Two pets/.test(e.message); }
  check('placing a third pet from the inventory is refused with a plain reason', threw);
  RW.toggle('dog'); check('after putting one away the third can come home', RW.toggle('mewmew') === true);
  RW.buy('catblack'); RW.toggle('mewmew'); RW.toggle('cat');
  check('swapping a kitten for another kitten still works with two at home', RW.toggle('catblack') === true && !RW.ledger().placed.cat);
})();

(function consentRecordAndAgeGate() {
  console.log('consent record and the 18+ gate (ovu-consent.js): events, mirrors, import, receipts, headers, binding');
  var w = fresh();
  w.OVU_CONFIG = Object.assign({}, w.OVU_CONFIG, { aiPaused: false }); /* these exercise the AI choices; the launch pause has its own checks */
  ['ovu-consent.js', 'ovu-auth.js', 'ovu-insight.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  w.crypto = { getRandomValues: w.crypto.getRandomValues.bind(w.crypto), subtle: { digest: function (alg, data) { var h = require('crypto').createHash('sha256').update(Buffer.from(data)).digest(); return Promise.resolve(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength)); } } };
  var C = w.OvuConsent, S = w.OvuStore, O = w.OvuOrb, SY = w.OvuSync, A = w.OvuAuth;
  var src = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };
  var roomJs = src('room.js'), roomHtml = src('room.html'), storeJs = src('ovu-store.js'), appnav = src('appnav.js'), orbJs = src('ovu-orb.js'), terms = src('terms.html'), priv = src('privacy.html'), luna = src('supabase/functions/luna/index.ts'), insight = src('supabase/functions/insight/index.ts'), mig = src('supabase/migrations/20261019050000_consent_events.sql');
  check('one notice version, 5, in the store, the module and both page gates, which also require the 18+ attestation', S.NOTICE_V === 5 && C.NOTICE_V === 5 && /c\.v >= window\.OvuStore\.NOTICE_V && a && a\.confirmed === true/.test(storeJs) && /c\.v >= 5 && a && a\.confirmed === true/.test(appnav));
  check('the teen logic is gone from the room, the orb and the terms, and the room goes through the consent module', !/isMinor|under13|13-16|minorAck: A\.|openMinorNote|openTeenPregnancyCard|BABES|age13|CONSENT_V/.test(roomJs) && !/under13|13-16/.test(orbJs) && /OvuConsent\.require\(next/.test(roomJs) && /at least <strong>18 years old<\/strong>/.test(terms) && !/16 years old/.test(terms));
  check('the onboarding asks an optional adult age range, never a band with minors', /id: 'agerange'[^\n]*optional: true[^\n]*\['18-24'/.test(roomJs) && !/\['under13'/.test(roomJs) && /ageRange: A\.ageRange \|\| '', ageBand: '', minorAck: ''/.test(roomJs));
  check('the sheet carries the switches container, the 18+ tick, the under-18 way out and the current notice version', /id="cChoices"/.test(roomHtml) && /id="cAge"[^\n]*I confirm I am 18 or older/.test(roomHtml) && /id="cUnder"/.test(roomHtml) && new RegExp('Notice version ' + w.OvuStore.NOTICE_V + ', ').test(roomHtml) && !/13 or older/.test(roomHtml));
  (function () {
    var AU = w.OvuAuth, cap = AU.sendError(Object.assign(new Error('email rate limit exceeded'), { status: 429, code: 'over_email_send_rate_limit' })), wait = AU.sendError(Object.assign(new Error('For security purposes, you can only request this after 47 seconds.'), { status: 429 })), other = AU.sendError(new Error('Signups not allowed for otp'));
    check('a refused sign-in email reads in plain words: the hourly cap and the one-minute wait open the code box for a code already sent; other errors do not', cap.limited && /2 an hour/.test(cap.text) && /already arrived/.test(cap.text) && wait.limited && /wait 47 seconds/.test(wait.text) && !other.limited && /Could not send the code: Signups not allowed/.test(other.text), JSON.stringify([cap, wait, other]));
  })();
  check('the pages say Singapore for the backup and name the separate choices', !/outside Singapore/.test(priv) && !/outside Singapore/.test(roomHtml) && !/outside Singapore/.test(src('ovu-auth.js')) && /notice v5/.test(priv) && /version 5 \(21 October 2026\)/.test(priv) && /Version 4 \(20 October 2026\)/.test(priv) && /Help improve logging/.test(priv) && /For adults/.test(priv));
  check('both diary-reading functions gate by consent: the account record when signed in, the phone\'s word otherwise', /consentGate\(req, sb, image \? "food_photo_ai" : "ai_reading"/.test(luna) && /consentGate\(req, sb, "ai_summaries"/.test(insight) && /consent_allows/.test(luna) && /x-rhythme-consent/.test(luna) && /x-rhythme-consent/.test(insight));
  check('the migration logs events append-only, derives state, exposes allows to the service role only, and guards sync writes', /create table if not exists public\.consent_events/.test(mig) && /consent_record\(/.test(mig) && /consent_allows\(uuid, text\) to service_role/.test(mig) && /revoke all on function public\.consent_allows\(uuid, text\) from public, anon, authenticated/.test(mig) && /entries_consent_guard/.test(mig) && /profiles_consent_guard/.test(mig) && /Rollback:/.test(mig));
  /* a fresh phone */
  check('a fresh phone needs the sheet: no attestation, no state, nothing allowed', C.needsSheet() && !C.ageOk() && Object.keys(C.state()).length === 0 && !C.allows('health_tracking') && !C.allows('ai_reading'));
  var st0 = C.stateFromEvents([{ purpose: 'ai_reading', action: 'grant', at: '2026-10-19T01:00:00Z', notice: 3, method: 'sheet' }, { purpose: 'ai_reading', action: 'withdraw', at: '2026-10-19T02:00:00Z', notice: 3, method: 'you' }, { purpose: 'cloud_sync', action: 'grant', at: '2026-10-19T01:30:00Z', notice: 3, method: 'jit', uid: 'u1' }]);
  check('state is the latest event per purpose', st0.ai_reading.on === false && st0.ai_reading.method === 'you' && st0.cloud_sync.on === true && st0.cloud_sync.uid === 'u1');
  /* what today's flags become */
  var imp = C.importEventsFrom({ consent: { v: 2, at: '2026-10-18T10:00:00Z', luna: true }, cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' }, analysis: { on: true, at: '2026-10-19T00:30:00Z', uid: 'u1' } }, { on: true, insights: false, photos: true });
  var impP = imp.map(function (e) { return e.purpose; }).sort().join(',');
  check('the first run turns today\'s flags into import events dated when they were set, at the old notice', impP === 'ai_reading,cloud_sync,food_photo_ai,health_tracking,improve_logging' && imp.every(function (e) { return e.method === 'import' && e.notice === 2 && e.action === 'grant' && !e.sent; }) && imp.filter(function (e) { return e.purpose === 'cloud_sync'; })[0].uid === 'u1' && imp.filter(function (e) { return e.purpose === 'cloud_sync'; })[0].at === '2026-10-19T00:00:00Z');
  check('a phone that never agreed imports nothing', C.importEventsFrom({}, { on: true }).length === 0 && C.importEventsFrom({ consent: { v: 2 } }, {}).length === 0);
  /* a returning v2 person on this phone */
  S.setProfile({ consent: { v: 2, at: '2026-10-18T10:00:00Z', luna: true, improve: false, age13: true }, cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: 'u1' }, consentEvents: [], consentImportedAt: null });
  w.localStorage.setItem('ovumind_ai_v1', JSON.stringify({ on: true, insights: false, photos: true }));
  S.setProfile({ consentEvents: [] }); var p0 = S.profile(); delete p0.consentImportedAt;
  var imported = C.importLegacy();
  check('importLegacy writes the events once and marks the profile', imported && S.profile().consentEvents.length === 4 && !!S.profile().consentImportedAt && C.importLegacy() === false);
  C.apply();
  check('after import the sheet is still due (old notice, no attestation) and the mirrors agree with the old flags', C.needsSheet() && O.aiConfig().on === true && O.aiConfig().insights === false && O.aiConfig().photos === true && S.profile().cloud.v === 1 && S.profile().cloud.uid === 'u1');
  /* the sheet: attestation, the required purpose, the switches as shown */
  C.attestAge('sheet'); C.grant('health_tracking', 'sheet'); C.setMany({ ai_reading: true, food_photo_ai: false, ai_summaries: false, cloud_sync: true }, 'sheet', true);
  check('after the sheet nothing is due: 18+ attested once, health tracking at the current notice, photos withdrawn, the rest as ticked', !C.needsSheet() && C.ageOk() && S.profile().ageAttest.version === 1 && S.profile().consent.v === C.NOTICE_V && C.allows('ai_reading') && !C.allows('food_photo_ai') && C.allows('cloud_sync') && O.aiConfig().photos === false && O.aiConfig().on === true, JSON.stringify(S.profile().consent));
  var r = C.receipt();
  check('the receipt names the notice, the purposes, the attestation and the count', r.noticeVersion === C.NOTICE_V && r.purposes.ai_reading === true && r.purposes.food_photo_ai === false && r.purposes.health_tracking === true && r.ageAttest && r.ageAttest.confirmed === true && r.events >= 9 && r.userId === null, JSON.stringify(r));
  check('the phone\'s word travels only for an allowed purpose', C.header('ai_reading')['X-Rhythme-Consent'].indexOf('ai_reading;notice=' + C.NOTICE_V + ';device=d') === 0 && !C.header('food_photo_ai')['X-Rhythme-Consent']);
  /* Luna's switches write events with their method; the mirror follows */
  var n0 = C.events().length; O.setAiConfig({ on: true, insights: true, photos: true }, 'jit');
  var last = C.events().slice(n0);
  check('a first-use allow records only what changed, as jit, and the mirror follows', last.length === 2 && last.every(function (e) { return e.method === 'jit' && e.action === 'grant'; }) && last.map(function (e) { return e.purpose; }).sort().join(',') === 'ai_summaries,food_photo_ai' && JSON.parse(w.localStorage.getItem('ovumind_ai_v1')).photos === true);
  O.setAiConfig({ on: false, insights: true, photos: true }, 'settings');
  check('switching Luna off in her settings is a withdrawal, as easy as the grant', C.state().ai_reading.on === false && C.state().ai_reading.method === 'settings' && O.aiConfig().on === false);
  check('control state never rides in the backup', ['consentEvents', 'ageAttest', 'analysis', 'consent', 'cloud', 'consentImportedAt'].every(function (k) { return SY.CONTROL_KEYS[k] === 1 && !(k in SY.profileForCloud({ consentEvents: [], ageAttest: {}, analysis: {}, consent: {}, cloud: {}, consentImportedAt: 'x', name: 'n' })); }) && 'name' in SY.profileForCloud({ name: 'n', consentEvents: [] }));
  check('a profile with an old minor band is recognised, so the sheet can say so', (function () { S.setProfile({ ageBand: '13-16' }); var m = C.legacyMinor(); S.setProfile({ ageBand: '' }); return m && !C.legacyMinor(); })());
  /* binding at sign-in: a choice made before any account belongs to the first account, and reaches the server */
  var U = 'u-9', sent = [], sentBy = [];
  w.localStorage.setItem('ovumind_auth_v1', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: U, email: 'x@y.z' } }));
  w.fetch = function (url, o) { var b = o && o.body ? JSON.parse(o.body) : null; if (/rpc\/consent_record/.test(url)) { sent.push(b); return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ id: sent.length, purpose: b.p_purpose })); } }); } return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('{}'); } }); };
  var done = false; C.bindAccount().then(function () { done = true; });
  setTimeout(function () {
    var st = C.state(), evs = C.events();
    check('after sign-in the pre-account choices are bound to this account and every bound event reached the server once', done && st.health_tracking.uid === U && st.ai_summaries.uid === U && st.cloud_sync.uid === U && evs.filter(function (e) { return e.uid === U; }).every(function (e) { return e.sent === true; }) && sent.length === evs.filter(function (e) { return e.uid === U; }).length && sent.every(function (b) { return b.p_notice === C.NOTICE_V && typeof b.p_hash === 'string' && b.p_hash.length === 64 && b.p_method && b.p_client_at; }), JSON.stringify({ sent: sent.length, bound: evs.filter(function (e) { return e.uid === U; }).length }));
    check('a withdrawn purpose is not bound, and events never bound stay as the record of the phone', !st.ai_reading.uid && evs.filter(function (e) { return !e.uid; }).length > 0);
    check('every event carries the phone\'s own id, so a resend can never undo a later choice', sent.every(function (b) { return typeof b.p_client_id === 'string' && b.p_client_id.length > 4; }) && C.receipt().recorded === true && C.receipt().pending === 0);
    var before = sent.length; C.withdraw('ai_summaries', 'you');
    setTimeout(function () {
      check('a change made while signed in is recorded on the account at once', sent.length === before + 1 && sent[sent.length - 1].p_purpose === 'ai_summaries' && sent[sent.length - 1].p_action === 'withdraw' && sent[sent.length - 1].p_method === 'you' && C.state().ai_summaries.on === false, JSON.stringify(sent[sent.length - 1]));
      /* a choice made while a send is in flight is sent too, in order */
      var gateRes, gate = new Promise(function (res) { gateRes = res; }), order = [];
      w.fetch = function (url, o) { var b = o && o.body ? JSON.parse(o.body) : null; order.push(b.p_purpose + ':' + b.p_action); var first = order.length === 1; var resp = { ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ id: 100 + order.length, purpose: b.p_purpose })); } }; return first ? gate.then(function () { return resp; }) : Promise.resolve(resp); };
      C.grant('food_photo_ai', 'jit');
      var p1 = C.flush();
      C.withdraw('food_photo_ai', 'you');
      gateRes();
      p1.then(function () {
        return new Promise(function (res) { setTimeout(res, 5); });
      }).then(function () {
        var mine = C.events().filter(function (e) { return e.purpose === 'food_photo_ai' && e.uid === U; });
        var tail = mine.slice(-2).map(function (e) { return e.action; }).join(',');
        check('a withdrawal made during a send is drained after it, in order, and both are on record', order.join(',') === 'food_photo_ai:grant,food_photo_ai:withdraw' && tail === 'grant,withdraw' && mine.every(function (e) { return e.sent; }) && C.state().food_photo_ai.on === false, order.join(',') + ' ' + tail + ' ' + JSON.stringify(mine.map(function (e) { return !!e.sent; })));
        /* a refused event is marked and skipped; a server outage stops the queue and leaves it unsent for later */
        var calls = [];
        w.fetch = function (url, o) { var b = JSON.parse(o.body); calls.push(b.p_purpose + ':' + b.p_action); if (b.p_action === 'grant' && b.p_purpose === 'personalisation') return Promise.resolve({ ok: false, status: 400, text: function () { return Promise.resolve('{"message":"bad purpose"}'); } }); return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('{"id":7}'); } }); };
        C.record('personalisation', 'grant', 'you'); C.record('ai_reading', 'grant', 'you');
        return new Promise(function (res) { setTimeout(res, 10); });
      }).then(function () {
        var ev = C.events(), pers = ev.filter(function (e) { return e.purpose === 'personalisation'; }).pop(), air = ev.filter(function (e) { return e.purpose === 'ai_reading' && e.uid === U; }).pop();
        check('a refused event is marked failed and the next one still goes', pers && pers.failed && !pers.sent && air && air.sent === true && C.receipt().failed === 1, JSON.stringify({ pers: pers && pers.failed, air: air && air.sent }));
        w.fetch = function () { return Promise.resolve({ ok: false, status: 503, text: function () { return Promise.resolve('{"message":"down"}'); } }); };
        C.withdraw('ai_reading', 'you');
        return new Promise(function (res) { setTimeout(res, 10); });
      }).then(function () {
        var air = C.events().filter(function (e) { return e.purpose === 'ai_reading' && e.uid === U; }).pop();
        check('an outage leaves the event unsent and not failed, so the next flush retries it', air && !air.sent && !air.failed && C.receipt().pending === 1 && C.receipt().recorded === false);
        /* an account switch in the middle of a send: nothing of A goes out under B */
        sentBy.length = 0;
        /* the account changes while the first request is in the air: its reply must not be filed, and the rest must not go out under the new token */
        w.fetch = function (url, o) { var b = JSON.parse(o.body); var tok = (o.headers.Authorization || '').slice(7); sentBy.push(tok + ':' + b.p_purpose); if (sentBy.length === 1) w.localStorage.setItem('ovumind_auth_v1', JSON.stringify({ access_token: 'tB', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: 'u-B', email: 'b@y.z' } })); return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('{"id":9}'); } }); };
        var p2 = C.flush(); /* the pending ai_reading withdrawal of A */
        C.grant('cloud_sync', 'you'); /* a second A event queued while the first is in flight */
        return p2.then(function () { return new Promise(function (res) { setTimeout(res, 10); }); });
      }).then(function () {
        var aEv = C.events().filter(function (e) { return e.uid === U && !e.failed; });
        check('after a switch to another account mid-send, the reply is not filed, the first account\'s remaining events stay unsent and nothing goes out under the other token', sentBy.length === 1 && sentBy[0].indexOf('t:') === 0 && aEv.filter(function (e) { return !e.sent; }).length >= 2 && !sentBy.some(function (x) { return x.indexOf('tB:') === 0; }), JSON.stringify(sentBy) + ' unsent=' + aEv.filter(function (e) { return !e.sent; }).length);
        /* compaction keeps the latest event of every purpose */
        var big = []; for (var i = 0; i < 1600; i++) big.push({ id: 'x' + i, purpose: i === 0 ? 'health_tracking' : (i === 1 ? 'cloud_sync' : 'ai_reading'), action: 'grant', at: '2026-10-19T00:00:00Z', notice: 3, method: 'you' });
        var c2 = C.compact(big), st2 = C.stateFromEvents(c2);
        check('compaction past 1500 events keeps the latest event of every purpose and the recent tail', c2.length < 1600 && st2.health_tracking && st2.health_tracking.on && st2.cloud_sync && st2.cloud_sync.on && c2[c2.length - 1].id === 'x1599');
        /* the doorway gates sync: a session and a cloud mirror are not enough without the attestation at this notice */
        w.localStorage.setItem('ovumind_auth_v1', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: U, email: 'x@y.z' } }));
        S.setProfile({ cloud: { v: 1, at: '2026-10-19T00:00:00Z', uid: U }, ageAttest: null });
        var closed = !SY.canSync() && SY.consentOk(S.profile()) && !SY.doorOpen();
        S.setProfile({ ageAttest: { confirmed: true, version: 1, at: '2026-10-19T00:00:00Z' } });
        check('sync is shut without the 18+ attestation even with a session and the cloud mirror, and opens with it', closed && SY.doorOpen(), JSON.stringify({ closed: closed, open: SY.doorOpen(), cloud: C.allows('cloud_sync') }));
        /* readings are their own choice, and a withdrawal clears what was written */
        var I = w.OvuInsight;
        O.setAiConfig({ on: false, insights: true, photos: false }, 'settings');
        S.setState({ insights: { daily: { '2026-10-19': { summary: 'x' } }, fourweeks: {} } });
        var onAlone = I.enabled();
        C.withdraw('ai_summaries', 'you');
        check('readings can be on with note-reading off, and withdrawing them clears the cached readings', onAlone && !I.enabled() && Object.keys((S.state().insights || {}).daily || {}).length === 0);
      });
    }, 5);
  }, 10);
})();

(function recipesAndMedas() {
  console.log('recipes and the Mediterranean check: sourced links, honest notes, MEDAS without its wine point');
  var w = fresh();
  ['ovu-evidence.js', 'ovu-recipes.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var R = w.OvuRecipes, E = w.OvuEvidence, ids = {};
  var HOSTS = ['www.jeanhailes.org.au', 'www.bonehealthandosteoporosis.org', 'www.healthhub.sg'];
  var allCards = R.RECIPES.concat(R.LOCAL);
  check('every recipe and guide links over https to Jean Hailes, the Bone Health & Osteoporosis Foundation or HealthHub', allCards.every(function (r) { var u = new URL(r.url); return u.protocol === 'https:' && HOSTS.indexOf(u.host) > -1; }), JSON.stringify(allCards.filter(function (r) { return HOSTS.indexOf(new URL(r.url).host) < 0; }).map(function (r) { return r.url; })));
  var CHECKED_20OCT = ['cauliflower-cannellini-bean-soup', 'one-pot-chicken-greens', 'sardines-with-tomato-and-green-beans', 'red-rice-roast-vegetable-and-aduki-bean-salad', 'bircher-muesli', 'vegetable-frittata', 'tofu-sesame-stir-fry', 'savoury-phytoestrogen-bread', '2015/12/Spinach-and-Ricotta-Cannelloni-recipe.pdf', 'Recipe-for-Gingered-Salmon-Croquettes.pdf', 'Recipe-Cod-with-Tomatoes-and-Black-Olives.pdf', 'Recipe-Chunky-Hummus.pdf', 'Four-Bean-Salad-1.pdf', 'Recipe-Bean-Tuna-Sald-with-White-Balsamic-Vinegar.pdf', 'roasted-carrots-linseed-dukkah', 'iron-rich-granola', 'fish-and-vegetable-kebabs', 'balanced-diet-qqh-concept', 'healthyhawkerfood'];
  var urlKeys = allCards.map(function (r) { return r.url.replace(/^https:\/\/[^/]+\/(recipes\/|wp-content\/uploads\/|live-healthy\/)/, '').replace(/\/$/, ''); });
  check('the links are exactly the 19 pages checked by hand on 20 Oct (a changed path has to be checked again; this cannot tell if a page is still up)', urlKeys.join() === CHECKED_20OCT.join(), urlKeys.filter(function (k, i) { return k !== CHECKED_20OCT[i]; }).join());
  check('ids are unique, and every card has a title, a source, an icon and a line of its own', allCards.every(function (r) { var ok = !ids[r.id] && r.title && r.src && r.icon && r.why && r.why.length < 170; ids[r.id] = 1; return ok; }));
  check('each group (PCOS, menopause, everyday) has at least five recipes', R.GROUPS.every(function (g) { return R.forGroup(g.id).length >= 5; }), R.GROUPS.map(function (g) { return g.id + ':' + R.forGroup(g.id).length; }).join());
  var words = R.GROUPS.map(function (g) { return g.note; }).concat(allCards.map(function (r) { return r.why; }), [R.MEDAS_COPY.intro, R.MEDAS_COPY.wine, R.MEDAS_COPY.drinks, R.MEDAS_COPY.pregnancy, R.MEDAS_COPY.care], R.MEDAS.map(function (m) { return m.q + ' ' + (m.hint || ''); })).join(' \n ');
  check('no promises: no boost, cure, detox, balancing hormones, ovarian-friendly or fertility diet, and no em dashes', !/boost|\bcure|detox|balanc\w* (your )?hormone|ovarian[- ]friendly|fertility diet|superfood|—/i.test(words), (words.match(/boost|\bcure|detox|balanc\w* (your )?hormone|ovarian[- ]friendly|fertility diet|superfood|—/i) || [''])[0]);
  check('the notes say plainly what food cannot do', /No one diet has been shown to be best/.test(R.GROUPS[0].note) && /found insufficient evidence to recommend diet changes or soy for treating hot flushes/.test(R.GROUPS[1].note) && /treatments that work/.test(R.GROUPS[1].note) && !/has been shown to ease|does not stop/.test(R.GROUPS[1].note) && /no food has been proven to protect the ovaries/.test(R.GROUPS[2].note) && /not a hormone treatment or a treatment for hot flushes/.test(R.byId('soy-bread').why) && /renamed PMOS/.test(R.GROUPS[0].note) && /worth a doctor/.test(R.GROUPS[0].note) && /tuna to 4 cans a week/.test(R.MEDAS_COPY.pregnancy) && /400 micrograms of folic acid every day/.test(R.GROUPS[2].note) && /higher dose/.test(R.GROUPS[2].note) && /caffeine under 200 mg a day/.test(R.MEDAS_COPY.drinks) && /not that score/.test(R.MEDAS_COPY.intro) && /skip it/.test(R.MEDAS_COPY.intro));
  check('the Mediterranean check has the 13 MEDAS items and no wine item, and says why wine is left out', R.MEDAS.length === 13 && !R.MEDAS.some(function (m) { return /wine|alcohol/i.test(m.q); }) && /14th question/.test(R.MEDAS_COPY.wine) && /no alcohol when you are trying to get pregnant/.test(R.MEDAS_COPY.wine));
  check('item 13 is the real MEDAS question (chicken, turkey or rabbit over red and processed meat), not the old page\'s whole-grain bread', /chicken, turkey or rabbit over beef, veal, pork, burgers or sausages/.test(R.MEDAS[11].q) && !R.MEDAS.some(function (m) { return /whole-?grain bread/i.test(m.q); }));
  /* each item keeps the published criterion for its point (Martínez-González 2012, Table 1) */
  var MEDAS_T1 = {
    oil: [/main cooking fat/], oil4: [/About 4 tablespoons of olive oil a day or more/, /cooking, salads and meals out/], veg: [/Two or more servings of vegetables a day/, /raw or as a salad/, /200 g/, /side dish counts as half/],
    fruit: [/Three or more pieces of fruit a day/, /juice counts/], redmeat: [/Less than one serving a day of red meat, burgers or processed meat/, /100 to 150 g/], butter: [/Less than one serving a day of butter, margarine or cream/, /12 g/],
    drinks: [/Less than one sweet or fizzy drink a day/, /sweetened packet drinks/], legumes: [/three or more times a week/, /150 g/], fish: [/three or more times a week/, /100 to 150 g of fish, or 4 to 5 pieces or 200 g of shellfish/],
    sweets: [/sweets or pastries \(not homemade\)/, /custard/, /fewer than three times a week/], nuts: [/three or more times a week/, /Peanuts count/, /30 g/], poultry: [/chicken, turkey or rabbit/], sofrito: [/Twice a week or more/, /tomato with onion, leek or garlic/, /olive oil/]
  };
  var t1miss = R.MEDAS.filter(function (m) { var t = m.q + ' ' + (m.hint || ''); return !MEDAS_T1[m.id] || !MEDAS_T1[m.id].every(function (re) { return re.test(t); }); }).map(function (m) { return m.id; });
  check('every item keeps the published threshold and serving size', t1miss.length === 0 && Object.keys(MEDAS_T1).length === 13, t1miss.join());
  check('the 13 items are exactly the published ones, once each, in Table 1 order without item 8 (wine)', R.MEDAS.map(function (m) { return m.id; }).join() === 'oil,oil4,veg,fruit,redmeat,butter,drinks,legumes,fish,sweets,nuts,poultry,sofrito', R.MEDAS.map(function (m) { return m.id; }).join());
  var T1_NUMS = { oil: '', oil4: '4', veg: '200', fruit: '', redmeat: '100,150', butter: '12', drinks: '', legumes: '150', fish: '100,150,4,5,200', sweets: '', nuts: '30', poultry: '', sofrito: '' };
  var numMiss = R.MEDAS.filter(function (m) { return ((m.q + ' ' + (m.hint || '')).match(/\d+/g) || []).join() !== T1_NUMS[m.id]; }).map(function (m) { return m.id + ':' + ((m.q + ' ' + (m.hint || '')).match(/\d+/g) || []).join('/'); });
  check('every number in the questions and hints is exactly the published one (no 24 for 4, no stray amounts)', numMiss.length === 0, numMiss.join());
  check('no line sets a portion or how often to eat a dish, and no leftovers for a week', !/small bowl|weekend dish|for the week|only occasionally|treat yourself/i.test(words));
  check('every idea on the checklist is a real recipe', R.MEDAS.every(function (m) { return m.ideas.every(function (id) { return !!R.byId(id); }); }));
  var sc = R.score({ oil: true, veg: false, fish: false, nuts: 'yes', wine: true });
  check('the score counts only true answers to the 13 items; anything else is unanswered', sc.yes === 1 && sc.answered === 3 && sc.of === 13 && sc.missing.join() === 'veg,fish', JSON.stringify(sc));
  var ideas = R.ideasFor({ veg: false, fish: false, legumes: false });
  check('ideas follow the habits marked not yet, each recipe once', ideas.length === 11 && ideas[0].recipe.id === 'chicken-greens' && ideas[10].recipe.id === 'kebabs' && ideas.filter(function (x) { return x.recipe.id === 'cod'; }).length === 1, ideas.map(function (x) { return x.recipe.id; }).join());
  var roomSrc = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), cited = [];
  (roomSrc.match(/recSources\(([^;]*?)\)\)?;?\n/g) || []).join(' ').replace(/'(E\d+)'/g, function (m, id) { cited.push(id); });
  check('the sheets cite only sources in the register, all under the recipes topic', cited.length >= 8 && cited.every(function (id) { var e = E.get(id); return e && e.topics.indexOf('recipes') > -1; }), cited.join());
  var dsrc = /function deskSpots\(pos, folders\) \{[\s\S]*?\n    return \{ spots: grid, tidied: true \};\n  \}/.exec(roomSrc);
  var deskSpots = dsrc ? vm.runInContext('(' + dsrc[0] + ')', vm.createContext({ Math: Math, isFinite: isFinite, Infinity: Infinity })) : null;
  var desk = [], fre = /\{ id: '([a-z]+)', name: '([^']+)'/g, fm, fsrc = ((/var FOLDERS = \[([\s\S]*?)\n  \];/.exec(roomSrc) || [])[1] || '');
  while ((fm = fre.exec(fsrc))) desk.push({ id: fm[1], name: fm[2] });
  var folderIds = desk.map(function (f) { return f.id; });
  /* measured 21 Oct from 300 to 1280 px with the app's fallback font, Verdana and Courier New: a folder is 22% of the desk
     wide and at most 30.4% tall (a two-line name at 300 px); the boxes below use that measurement, not deskSpots' own 31 */
  var hgt = function () { return 30.4; };
  var over = function (spots) { var k = Object.keys(spots), bad = []; k.forEach(function (a, i) { k.slice(i + 1).forEach(function (b) { if (Math.abs(spots[a][0] - spots[b][0]) < 22 && spots[a][1] < spots[b][1] + hgt(b) && spots[b][1] < spots[a][1] + hgt(a)) bad.push(a + '/' + b); }); }); return bad; };
  var inside = function (spots) { return Object.keys(spots).every(function (k) { var q = spots[k]; return q[0] >= 0 && q[0] + 22 <= 100 && q[1] >= 0 && q[1] + hgt(k) <= 100; }); };
  check('the desk has room for every folder on its grid (12 places; a 13th folder needs a new layout)', folderIds.length >= 10 && folderIds.length <= 12, folderIds.join());
  var d0 = deskSpots ? deskSpots({}, desk) : { spots: {} };
  check('with no saved spots every folder fits: no two overlap and none past the edge, all pairs checked', !d0.tidied && Object.keys(d0.spots).length === desk.length && over(d0.spots).length === 0 && inside(d0.spots), JSON.stringify(d0.spots) + ' ' + over(d0.spots).join());
  var saved = { cycle: [14, 19], fertility: [64, 19], chapters: [14, 50], nutrition: [64, 50] };
  var d1 = deskSpots ? deskSpots(saved, desk) : { spots: {} };
  check('when new folders cannot fit around hers, the whole desk goes back onto the grid instead of overlapping', d1.tidied === true && over(d1.spots).length === 0 && inside(d1.spots) && JSON.stringify(d1.spots) === JSON.stringify(d0.spots), JSON.stringify(d1) + ' ' + over(d1.spots).join());
  var roomy = { cycle: [2, 4], fertility: [27, 4], chapters: [52, 4], nutrition: [77, 4] }, d2 = deskSpots ? deskSpots(roomy, desk) : { spots: {} };
  check('when there is room, her folders stay exactly where she put them and new ones take free places, no overlaps', !d2.tidied && Object.keys(roomy).every(function (k) { return d2.spots[k][0] === roomy[k][0] && d2.spots[k][1] === roomy[k][1]; }) && over(d2.spots).length === 0 && inside(d2.spots), JSON.stringify(d2.spots));
  /* Codex round three: "Share with doctor" placed top left once let a new folder in just under it */
  var tallTop = { doctor: [2, 4], fertility: [27, 4], chapters: [52, 4], nutrition: [77, 4], cycle: [2, 66], mind: [27, 35], move: [52, 35], body: [77, 35], videos: [27, 66] }, d4 = deskSpots ? deskSpots(tallTop, desk) : { spots: {} };
  check('a folder top left with a two-line name: nothing new is placed under it', over(d4.spots).length === 0 && inside(d4.spots), JSON.stringify(d4) + ' ' + over(d4.spots).join());
  var all = {}; desk.forEach(function (f, i) { all[f.id] = [40, 10 + i]; }); var d3 = deskSpots ? deskSpots(all, desk) : { spots: {} };
  check('a desk she arranged in full is never tidied for her, even if she stacked folders', !d3.tidied && desk.every(function (f) { return d3.spots[f.id][0] === all[f.id][0] && d3.spots[f.id][1] === all[f.id][1]; }));
  check('a drag keeps the whole desk as shown, so only a folder added later needs a place, and a tidy is announced', /pr\.pos = \{\}; icons\.querySelectorAll\('\.dicon'\)\.forEach/.test(roomSrc) && /if \(lay\.tidied\) \{ p\.pos = \{\}; setDeskPrefs\(p\);[^\n]*toast\(/.test(roomSrc));
  check('a folder opens on a click (so Enter and Space work), not on pointer up, and the click that ends a drag is ignored', /icons\.addEventListener\('click', function \(e\) \{\n\s*var b = e\.target\.closest\('\.dicon'\); if \(!b\) return;\n\s*if \(Date\.now\(\) - dragged < 500\) return;\n\s*chime\('tap'\); openFolder\(b\.dataset\.folder\);/.test(roomSrc) && !/else \{ chime\('tap'\); openFolder\(d\.id\); \}/.test(roomSrc) && /if \(d\.moved\) \{ dragged = Date\.now\(\);/.test(roomSrc));
  var css = fs.readFileSync(path.join(root, 'room.css'), 'utf8');
  check('the folder icon and name scale with the desk (capped at the usual sizes), so a two-line name stays under 31% of its height', /\.dicons\.free\{container-type:inline-size\}\n\.dicons\.free \.dicon svg\{width:min\(40px,10\.1cqw\);height:min\(34px,8\.6cqw\)\}\n\.dicons\.free \.dicon span\{font-size:min\(9\.5px,2\.9cqw\)\}/.test(css) && /var W = 22, H = 31,/.test(roomSrc));
  check('a link into the room waits behind the sign-in wall and a new account\'s intro, then opens once, never on a timer; another intro, a wrong account or an intro overtaken by a backup drops it', /function takePending\(\) \{ var r = pendingRoute; pendingRoute = ''; if \(r && r !== 'onboarding'\) openRoute\(r\); \}/.test(roomSrc) && /function introForLink\(\) \{ openOnboarding\(0, \{\}\); pendingOnb = onb; \}/.test(roomSrc) && /if \(!S\.profile\(\)\.onboarded\) introForLink\(\); else if \(pendingRoute\) takePending\(\);/.test(roomSrc) && /if \(hk && hk !== 'onboarding'\) pendingRoute = hk; if \(!wallOpen\(\)\) showWelcome\(\);/.test(roomSrc) && /var fromLink = onb && onb === pendingOnb; pendingOnb = null;/.test(roomSrc) && /if \(fromLink\) takePending\(\); else pendingRoute = '';/.test(roomSrc) && /function wrongAccount\(\) \{\s+pendingRoute = ''; pendingOnb = null;/.test(roomSrc) && /'cloud_done'\); pendingRoute = ''; return; \}/.test(roomSrc));
  check('for a returning visitor the link opens only if she has not opened another sheet or tapped a tab (Home too) first', /current = id; sheetSeq\+\+;/.test(roomSrc) && /function goTab\(k\) \{\s+navSeq\+\+;/.test(roomSrc) && /chime\('tap'\); navSeq\+\+; \/\* the tap itself counts/.test(roomSrc) && /bootAt = Date\.now\(\), seq0 = sheetSeq, nav0 = navSeq;/.test(roomSrc) && /else \{ setTimeout\(function \(\) \{ requireConsent\(function \(\) \{ if \(hk && \(sheetSeq !== seq0 \|\| navSeq !== nav0 \|\| current\)\) return;/.test(roomSrc));
  check('a recipe whose uncooked dressing uses mirin says it usually has alcohol and to leave it out when pregnant or trying (Codex round four)', R.RECIPES.filter(function (r) { return r.id === 'red-rice'; }).every(function (r) { return /mirin usually contains alcohol/.test(r.why) && /pregnant or trying/.test(r.why); }));
  check('the Everyday note does not call all fertility evidence observational', !/are observational and mixed/.test(R.GROUPS.filter(function (g) { return g.id === 'every'; })[0].note) && /limited and mostly observational/.test(R.GROUPS.filter(function (g) { return g.id === 'every'; })[0].note));
  check('the check starts each answer and Clear from what is on the phone now (not a cached copy) and repaints when another tab saves', /next = stored\(true\);/.test(roomSrc) && /stored\(true\); keep\(\{\}\)/.test(roomSrc) && /S\.reload \? S\.reload\(\) : S\.state\(\)\)\.medas/.test(roomSrc) && /if \(medasRefresh\) medasRefresh\(\);/.test(roomSrc));
  check('the old Mediterranean page sends people to the check in the room, and the room opens it from that link', /location\.replace\('room\.html#medas'\)/.test(fs.readFileSync(path.join(root, 'medas14.html'), 'utf8')) && /hk === 'medas'\) openMedas\(\)/.test(roomSrc) && /\['action', 'medas', 'checklist'/.test(roomSrc) && !/'medas14\.html'/.test(roomSrc));
})();

/* the summary waits for every timer and promise the blocks scheduled: the loop drains, then we report, so no async check is ever cut off */
var summarised = false;
(function cycleHistoryOverMonths() {
  console.log('cycle history: every interval kept, breaks named, recorded days apart from the span');
  var w = fresh('2026-10-20'), S = w.OvuStore, A = w.OvuAgents;
  function period(st, n) { for (var k = 0; k < n; k++) S.add('period', addDays(st, k), { flow: k === 1 ? 'heavy' : 'medium' }, 'test'); }
  ['2026-04-01', '2026-04-30', '2026-05-31', '2026-08-15', '2026-09-14'].forEach(function (st) { period(st, 4); });
  S.add('period', '2026-10-12', { flow: 'medium' }, 'test'); S.add('period', '2026-10-13', { flow: 'heavy', largeClots: true }, 'test'); S.add('period', '2026-10-15', { flow: 'light' }, 'test');
  S.add('period', '2026-07-01', { flow: 'spotting' }, 'test');
  S.add('symptom', '2026-10-13', { symptoms: ['cramps'], pain: 6, mood: 'low' }, 'test');
  var h = A.cycleHistory('2026-04-22', '2026-10-20'), r = h.rows;
  check('six rows: the interval that runs into the range is kept and marked, spotting starts nothing', r.length === 6 && r[0].start === '2026-04-01' && r[0].beforeRange && r[0].interval === 29 && r.every(function (x) { return x.start !== '2026-07-01'; }), JSON.stringify(r.map(function (x) { return [x.start, x.interval, x.beforeRange]; })));
  check('the 76-day gap stays as a dated row with its reason and is left out of the numbers', r[2].start === '2026-05-31' && r[2].interval === 76 && !r[2].counted && /break in the record/.test(r[2].excluded) && h.stats.excluded === 1, JSON.stringify(r[2]));
  check('stats use the three counted intervals inside the range: 31, 30, 28', h.stats.intervals === 3 && h.stats.median === 30 && h.stats.shortest === 28 && h.stats.longest === 31 && h.stats.variation === 3 && h.stats.starts === 5, JSON.stringify(h.stats));
  var cur = r[5];
  check('the latest period has no interval yet and counts days since it started', cur.current && cur.interval === null && cur.nextStart === null && cur.sinceStart === 9, JSON.stringify(cur));
  check('a bridged day is missing, not bleeding: 3 recorded days over a 4-day span', cur.bleedDays === 3 && cur.span === 4 && cur.missingDays === 1 && cur.heavyDays === 1 && cur.largeClots && !cur.flooding, JSON.stringify(cur));
  check('pain is the highest recorded on the period days, and null where none was recorded', cur.painMax === 6 && r[3].painMax === null, JSON.stringify([cur.painMax, r[3].painMax]));
  var clip = A.cycleHistory('2026-10-01', '2026-10-13').rows;
  check('days after the end of the range are clipped off, and the September interval into the range is kept', clip.length === 2 && clip[0].beforeRange && clip[0].interval === 28 && clip[1].bleedDays === 2 && clip[1].end === '2026-10-13' && clip[1].sinceStart === 2, JSON.stringify(clip));
  check('no normal or irregular verdict anywhere, FIGO only as a reference', !/irregular|abnormal|normal cycle/i.test(JSON.stringify(h.rows) + JSON.stringify(h.stats)) && /FIGO 2018/.test(h.reference), h.reference);
  var none = fresh('2026-10-20').OvuAgents.cycleHistory('2026-04-22', '2026-10-20');
  check('with nothing logged the history is empty and every number is null', none.rows.length === 0 && none.stats.median === null && none.stats.variation === null && none.stats.longestBleed === null, JSON.stringify(none.stats));
})();

(function patternDaysForCalendars() {
  console.log('pattern days: display bins only, missing stays missing');
  var w = fresh('2026-10-20'), S = w.OvuStore, A = w.OvuAgents;
  S.add('period', '2026-10-18', { flow: 'heavy' }, 'test');
  S.add('symptom', '2026-10-18', { symptoms: ['cramps'], pain: 6, mood: 'low' }, 'test');
  S.add('symptom', '2026-10-19', { symptoms: [], none: true, mood: 'good' }, 'test');
  S.add('sleep', '2026-10-19', { bedTime: '23:30', wakeTime: '05:00', quality: 2 }, 'test');
  S.add('sleep', '2026-10-20', { bedTime: '22:00', wakeTime: '07:30', quality: 4 }, 'test');
  var d = A.patternDays('2026-10-17', '2026-10-20');
  check('one entry per day in order', d.length === 4 && d[0].date === '2026-10-17' && d[3].date === '2026-10-20');
  check('a heavy day with pain 6 shows heavy and pain band 2 (4 to 6)', d[1].flow === 'heavy' && d[1].pain === 6 && d[1].painBand === 2, JSON.stringify(d[1]));
  check('"no symptoms" is an answer but makes no pain zero', d[2].none && d[2].pain === null && d[2].painBand === null && d[2].mood === 'good', JSON.stringify(d[2]));
  check('sleep bands: 5.5 h under 6, 9.5 h over 9 (never a failure colour, just a band)', d[2].sleepBand === 0 && d[3].sleepBand === 3 && d[3].sleep === 9.5, JSON.stringify([d[2].sleep, d[3].sleep]));
  check('a day with nothing logged has no marks at all', d[0].flow === null && d[0].pain === null && d[0].sleep === null && d[0].entries === 0, JSON.stringify(d[0]));
})();

(function todayCheckInTicks() {
  console.log("today's check-in: answers count, nothing is invented, the tick pays nothing");
  var w = fresh('2026-10-20'), S = w.OvuStore, A = w.OvuAgents, RW = w.OvuRewards, t = '2026-10-20';
  S.setProfile({ periodsStarted: 'yes', regularity: 'regular' });
  var c0 = A.todayCheckIn(t);
  check('periods expected: bleeding, sleep, symptoms and mood, water count (water took food\'s place, 21 Oct); movement and calm are optional', c0.keyCount === 4 && c0.keyDone === 0 && !c0.complete && c0.tiles.filter(function (x) { return x.key; }).map(function (x) { return x.id; }).join() === 'bleeding,sleep,symptoms,water' && c0.tiles[4].state === 'optional', JSON.stringify(c0.tiles.map(function (x) { return [x.id, x.key, x.state]; })));
  S.add('sleep', t, { bedTime: '23:00', wakeTime: '06:30', quality: 3 }, 'room');
  S.add('symptom', t, { symptoms: [], none: true, pain: null, mood: '' }, 'room');
  S.add('food', t, { meal: 'lunch', foods: 'chicken rice', items: [], tags: [] }, 'room'); w.OvuWater.add(250, t); /* a meal no longer ticks a tile; a water record does */
  var c1 = A.todayCheckIn(t), sym = c1.tiles[2];
  check('"None" for symptoms without a mood is only partly answered', sym.state === 'partial' && sym.value === 'Mood?' && c1.keyDone === 2, JSON.stringify(sym));
  var hearts = RW.ledger().hearts, events = S.list().length;
  S.setCheckinAnswer(t, 'mood', 'unsure'); S.setCheckinAnswer(t, 'bleeding', 'none');
  var c2 = A.todayCheckIn(t);
  check('"not sure" about mood and "no bleeding" complete the check-in', c2.complete && c2.keyDone === 4 && c2.tiles[0].value === 'None' && c2.tiles[0].answer && c2.tiles[2].state === 'done' && c2.tiles[2].answer, JSON.stringify(c2.tiles.map(function (x) { return [x.id, x.state, x.value]; })));
  check('answers create no entries, no period episode and no hearts', S.list().length === events && S.periodEpisodes().length === 0 && RW.ledger().hearts === hearts, JSON.stringify([S.list().length, events, RW.ledger().hearts, hearts]));
  check('the month calendar shows "no bleeding" as an answer, not as a flow', A.patternDays(t, t)[0].bleedAnswer === 'none' && A.patternDays(t, t)[0].flow === null);
  S.add('period', t, { flow: 'light' }, 'room');
  check('a logged flow wins over an earlier "no bleeding"', A.todayCheckIn(t).tiles[0].value === 'Light' && !A.todayCheckIn(t).tiles[0].answer);
  S.setCheckinAnswer(t, 'mood', null);
  check('taking an answer back reopens that check-in', !A.todayCheckIn(t).complete && A.todayCheckIn(t).tiles[2].state === 'partial');
  var bad = false; try { S.setCheckinAnswer(t, 'bleeding', 'heavy'); } catch (e) { bad = true; }
  var bad2 = false; try { S.setCheckinAnswer('20-10-2026', 'food', 'skip'); } catch (e) { bad2 = true; }
  check('only the listed answers and real dates are accepted', bad && bad2);
  check('choosing what counts changes the tick, not the tiles', A.todayCheckIn(t, { food: false, bleeding: false }).keyCount === 2 && A.todayCheckIn(t, { food: false, bleeding: false }).tiles.length === 6);
  /* storage full: the answer must not land, so no tick */
  var w2 = fresh('2026-10-20'), S2 = w2.OvuStore, A2 = w2.OvuAgents; S2.setProfile({ periodsStarted: 'yes' });
  var real = w2.localStorage.setItem; w2.localStorage.setItem = function () { throw new Error('QuotaExceededError'); };
  var threw = false; try { S2.setCheckinAnswer(t, 'food', 'skip'); } catch (e) { threw = true; }
  w2.localStorage.setItem = real;
  check('a failed save throws and leaves no answer and no tick behind', threw && !S2.checkinAnswers(t).food && A2.todayCheckIn(t).tiles[3].state === 'add', JSON.stringify(S2.checkinAnswers(t)));
  function keysFor(profile) { var x = fresh('2026-10-20'); x.OvuStore.setProfile(profile); return x.OvuAgents.todayCheckIn(t).tiles[0].key; }
  check('bleeding does not count after menopause, in pregnancy, after a birth before periods are back, or with predictions paused',
    !keysFor({ lifeStage: 'post' }) && !keysFor({ periodsStarted: 'yes', pregState: 'pregnant' }) && !keysFor({ periodsStarted: 'yes', pregState: 'maybe' }) && !keysFor({ periodsStarted: 'yes', pregState: 'postpartum', periodsBack: 'no' }) && !keysFor({ periodsStarted: 'yes', predictionMode: 'suspended' }) && !keysFor({}));
  check('after a birth with periods back, bleeding counts again', keysFor({ periodsStarted: 'yes', pregState: 'postpartum', periodsBack: 'yes' }));
})();

(function backfillAndImportsEarnNothing() {
  console.log('hearts: only today\'s own log earns');
  var w = fresh('2026-10-20'), S = w.OvuStore, RW = w.OvuRewards;
  var old = RW.award(S.add('food', '2026-10-18', { meal: 'lunch', foods: 'rice', items: [], tags: [] }, 'room'));
  var imp = RW.award(S.add('sleep', '2026-10-20', { bedTime: '23:00', wakeTime: '07:00' }, 'apple-health'));
  var now = RW.award(S.add('food', '2026-10-20', { meal: 'lunch', foods: 'rice', items: [], tags: [] }, 'room'));
  check('a backfilled meal and an imported night earn nothing; today\'s meal still earns 6', old.points === 0 && imp.points === 0 && now.points === 6 && RW.ledger().hearts === 6, JSON.stringify([old, imp, now]));
})();

(function codexDiffReviewFixes() {
  console.log('Codex diff review fixes: boundaries, exact median, unconfirmed days, failed edits, live defaults, marks, months');
  var w = fresh('2026-10-20'), S = w.OvuStore, A = w.OvuAgents, t = '2026-10-20';
  S.add('period', '2026-09-29', { flow: 'medium' }, 'test'); S.add('period', '2026-10-01', { flow: 'light' }, 'test');
  var h = A.cycleHistory('2026-10-01', t);
  check('a period still open when the range starts keeps its row (started before the range, next start not recorded)', h.rows.length === 1 && h.rows[0].start === '2026-09-29' && h.rows[0].beforeRange && h.rows[0].current && h.rows[0].sinceStart === 22, JSON.stringify(h.rows));
  var w2 = fresh(t), S2 = w2.OvuStore, A2 = w2.OvuAgents;
  ['2026-08-24', '2026-09-21', '2026-10-20'].forEach(function (d) { S2.add('period', d, { flow: 'medium' }, 'test'); });
  var st = A2.cycleHistory('2026-08-01', t).stats;
  check('the median is exact: intervals of 28 and 29 days give 28.5', st.intervals === 2 && st.median === 28.5, JSON.stringify(st));
  var w3 = fresh(t), S3 = w3.OvuStore, A3 = w3.OvuAgents; S3.setProfile({ periodsStarted: 'yes' });
  S3.add('period', t, { flow: 'medium', autofill: true }, 'room');
  S3.add('sleep', t, { bedTime: '23:00', wakeTime: '07:00' }, 'apple-health');
  var c3 = A3.todayCheckIn(t);
  check('a bleeding day filled in as typical is not a recorded answer until she checks it', c3.tiles[0].state === 'partial' && !c3.tiles[0].recorded && c3.tiles[0].value === 'Filled in', JSON.stringify(c3.tiles[0]));
  check('an imported night counts and says where it came from', c3.tiles[1].recorded && c3.tiles[1].sub === 'from Apple Health', JSON.stringify(c3.tiles[1]));
  /* a failed edit leaves the entry exactly as it was */
  var w4 = fresh(t), S4 = w4.OvuStore, A4 = w4.OvuAgents; S4.setProfile({ periodsStarted: 'yes' });
  var ev = S4.add('symptom', t, { symptoms: [], none: true, pain: null, mood: '' }, 'room');
  var real = w4.localStorage.setItem; w4.localStorage.setItem = function () { throw new Error('QuotaExceededError'); };
  var threw = false; try { S4.update(ev.id, { data: { symptoms: [], none: true, pain: null, mood: 'good' } }); } catch (e) { threw = true; }
  w4.localStorage.setItem = real;
  check('a mood edit that fails to save is rolled back in memory, so it cannot complete the check-in', threw && S4.get(ev.id).data.mood === '' && A4.todayCheckIn(t).tiles[2].state === 'partial', JSON.stringify(S4.get(ev.id).data));
  var w5 = fresh(t), S5 = w5.OvuStore, A5 = w5.OvuAgents; S5.setProfile({ periodsStarted: 'yes' });
  var keyB = function () { return A5.todayCheckIn(t, { food: false }).tiles[0].key; }, before = keyB();
  S5.setProfile({ pregState: 'pregnant' });
  check('a choice about food leaves bleeding following her situation: it stops counting once she is pregnant', before === true && keyB() === false && A5.todayCheckIn(t, { food: false }).tiles[3].key === false);
  /* calendar marks */
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-patterns.js'), 'utf8'), w5);
  S5.add('symptom', '2026-10-19', { symptoms: [], none: true, pain: null, mood: '' }, 'room');
  S5.add('period', '2026-10-18', { flow: 'unspecified' }, 'room');
  S5.setCheckinAnswer('2026-10-19', 'sleep', 'unsure'); S5.setCheckinAnswer('2026-10-19', 'mood', 'unsure');
  var pd = A5.patternDays('2026-10-17', '2026-10-19'), html = w5.OvuPatterns.calendarHTML(pd, { today: '2026-10-19' });
  var cell = function (d) { var m = html.match(new RegExp('data-pday="' + d + '"[^>]*>([\\s\\S]*?)</button>')); return m ? m[1] : ''; };
  check('"None" for symptoms draws nothing on the pain line, and "not sure" about sleep has its own sign', !/tr pn ans/.test(cell('2026-10-19')) && /tr sl uns/.test(cell('2026-10-19')) && pd[2].sleepAnswer === 'unsure' && pd[2].moodAnswer === 'unsure', cell('2026-10-19'));
  check('flow not noted has its own broken mark, never the light-flow mark', /tr bl unk/.test(cell('2026-10-18')) && !/tr bl b2/.test(cell('2026-10-18')), cell('2026-10-18'));
  check('the day details say "not sure" rather than "not recorded"', /Not sure about sleep/.test(w5.OvuPatterns.detailHTML(pd[2])) && /Mood: not sure/.test(w5.OvuPatterns.detailHTML(pd[2])));
  /* calendar months */
  check('ranges are calendar months: 6 months to 20 Oct starts 21 Apr, 12 months starts 21 Oct last year, 1 month to 31 Mar starts 1 Mar, 12 months to 29 Feb 2028 starts 1 Mar 2027',
    A.monthsBack('2026-10-20', 6) === '2026-04-21' && A.monthsBack('2026-10-20', 12) === '2025-10-21' && A.monthsBack('2026-03-31', 1) === '2026-03-01' && A.monthsBack('2028-02-29', 12) === '2027-03-01' && A.monthsBack('2026-10-20', 3) === '2026-07-21',
    [A.monthsBack('2026-10-20', 6), A.monthsBack('2026-10-20', 12), A.monthsBack('2026-03-31', 1), A.monthsBack('2028-02-29', 12)].join());
  var w6 = fresh(t), S6 = w6.OvuStore, A6 = w6.OvuAgents;
  S6.add('food', '2026-06-10', { meal: 'lunch', foods: 'laksa', items: [], tags: [] }, 'room'); S6.add('exercise', '2026-06-11', { label: 'Walking', minutes: 30 }, 'room');
  S6.add('mindfulness', '2026-06-12', { kind: 'orb', minutes: 5, completed: true }, 'room');
  var mt = A6.monthlyTotals('2026-04-21', t), june = mt.filter(function (m) { return m.month === '2026-06'; })[0];
  check('month-by-month totals keep older meals, movement and calm, with April counted from the 21st', mt.length === 7 && mt[0].month === '2026-04' && mt[0].days === 10 && june.meals === 1 && june.foodDays === 1 && june.movementSessions === 1 && june.movementMinutes === 30 && june.calmSessions === 1 && june.daysWithEntries === 3, JSON.stringify(june));
})();

(function shareDataIsCleanedBeforeDrawing() {
  console.log('Doctor view: a share is outside data, cleaned to strict types before drawing');
  var w = fresh('2026-10-20'), S = w.OvuStore, A = w.OvuAgents;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-patterns.js'), 'utf8'), w);
  var P = w.OvuPatterns, bad = '"><img src=x onerror=alert(1)>';
  var crafted = { months: [{ month: '2026-10', meals: bad, days: 20, bleedingDays: '<b>3</b>' }, { month: bad }],
    patterns: [{ date: '2026-10-20', flow: bad, painBand: bad, pain: bad, mood: bad, symptoms: [bad], sleep: bad, sleepBand: 9 }, { date: bad }],
    history: { range: { from: '2026-04-21', to: '2026-10-20' }, rows: [{ start: '2026-10-01', end: '2026-10-04', interval: bad, sinceStart: bad, current: true, bleedDays: bad, painMax: 99 }], stats: { median: bad, intervals: bad }, reference: bad, limits: 'x' } };
  var c = P.cleanShare(crafted);
  check('crafted month counts become numbers and a crafted month is dropped', c.months.length === 1 && c.months[0].meals === 0 && c.months[0].bleedingDays === 0 && c.months[0].days === 20, JSON.stringify(c.months));
  check('crafted calendar fields are dropped: unknown flow, band, mood and sleep become empty', c.patterns.length === 1 && c.patterns[0].flow === null && c.patterns[0].painBand === null && c.patterns[0].mood === null && c.patterns[0].sleep === null && c.patterns[0].sleepBand === 3, JSON.stringify(c.patterns[0]));
  var html = P.calendarHTML(c.patterns, { today: '2026-10-20' }) + P.historyHTML(c.history);
  check('nothing crafted reaches the HTML: no tag, no handler, the symptom text escaped', !/<img|onerror=alert/.test(html.replace(/&lt;img|onerror=alert\(1\)&gt;/g, '')) && html.indexOf('<img') < 0 && c.history.rows[0].interval === null && c.history.rows[0].painMax === 10, html.slice(0, 200));
  /* monthly totals: filled-in days apart, imported calm sessions counted */
  S.add('period', '2026-10-01', { flow: 'medium' }, 'room'); S.add('period', '2026-10-02', { flow: 'medium', autofill: true }, 'room'); S.add('period', '2026-10-03', { flow: 'light', autofill: true }, 'room');
  S.add('mindfulness', '2026-10-05', { kind: 'imported', minutes: 30, sessions: 3 }, 'apple-health');
  var oct = A.monthlyTotals('2026-10-01', '2026-10-20')[0];
  check('month totals keep filled-in days apart from recorded bleeding, and count imported calm sessions', oct.bleedingDays === 1 && oct.filledDays === 2 && oct.calmSessions === 3 && oct.calmMinutes === 30, JSON.stringify(oct));
})();

(function sleepDetailsAndCheck() {
  console.log('optional sleep details and the two-week sleep check (21 Oct 2026)');
  var w = fresh(), S = w.OvuStore, A = w.OvuAgents, O = w.OvuOrb, today = S.today(), y1 = addDays(today, -1), y2 = addDays(today, -2);
  /* the write boundary keeps known codes only */
  var e1 = S.add('sleep', y2, { bedTime: '23:00', wakeTime: '06:30', quality: 2, notes: '', details: { latency: '31-60', wakeups: 2, awake: '16-30', early: 'maybe', woke: ['flush', 'bogus', 'gasp'], rested: '9', extra: 'x' } });
  check('sleep details keep only known answers: numbers become codes, unknown keys and values are dropped', JSON.stringify(e1.data.details) === JSON.stringify({ latency: '31-60', wakeups: '2', awake: '16-30', woke: ['flush', 'gasp'] }), JSON.stringify(e1.data.details));
  var e2 = S.add('sleep', y2, { bedTime: '13:00', wakeTime: '14:00', details: { latency: 'soon', rested: 0 } });
  check('details with nothing valid leave no details at all, so the night stays unknown', e2.data.details === undefined);
  var e3 = S.add('sleep', y1, { bedTime: '22:30', wakeTime: '06:00', details: { wakeups: '0', awake: '31-60', latency: 'unsure' } });
  check('no waking drops any time-awake answer; "not sure" is kept as its own answer', e3.data.details.awake === undefined && e3.data.details.latency === 'unsure' && e3.data.details.wakeups === '0');
  check('a sleep check with no valid answer is refused', /Answer at least one question/.test((function () { try { S.add('sleepcheck', today, { w1: '9', driving: 'sometimes' }); return ''; } catch (e) { return e.message; } })()));
  var c1 = S.add('sleepcheck', today, { w1: '0', w2: '0', since: '3m+', breathing: 'no' });
  check('two quiet weeks drop the "how long" answer', c1.data.since === undefined && c1.data.w1 === '0');
  var c2 = S.add('sleepcheck', today, { w1: '4', w2: 'unsure', impact: 'lot', since: '3m+' });
  check('a second check on the same day replaces the first (one a day)', S.list('sleepcheck').length === 1 && S.list('sleepcheck')[0].data.w1 === '4' && c2.id === c1.id);
  var before = S.get(c1.id).date;
  check('an edit that leaves no valid answer is refused before anything changes', /Answer at least one question/.test((function () { try { S.update(c1.id, { date: y1, data: { w1: 'x' } }); return ''; } catch (e) { return e.message; } })()) && S.get(c1.id).date === before && S.get(c1.id).data.w1 === '4');
  S.update(e3.id, { data: Object.assign({}, e3.data, { details: { rested: '2', woke: ['<b>'] } }) });
  check('an edited night is cleaned the same way', JSON.stringify(S.get(e3.id).data.details) === JSON.stringify({ rested: '2' }));

  /* patterns: unknown is never zero, "not sure" is apart, a later answer wins, a symptom note's night flush counts */
  var w2 = fresh(), S2 = w2.OvuStore, A2 = w2.OvuAgents, t = S2.today(), d1 = addDays(t, -3), d2 = addDays(t, -2), d3 = addDays(t, -1);
  S2.add('sleep', d1, { bedTime: '23:00', wakeTime: '06:00', details: { latency: 'gt60', wakeups: '2', rested: '1', woke: ['flush'] } });
  S2.add('sleep', d2, { bedTime: '23:00', wakeTime: '07:00', details: { latency: 'unsure', wakeups: '0' } });
  S2.add('sleep', d3, { bedTime: '23:30', wakeTime: '07:00' });
  S2.add('symptom', d3, { symptoms: ['hot flushes'], flushNight: true, pain: null, mood: '', notes: '' });
  var sn = A2.sleepNotes(addDays(t, -27), t);
  check('nights with details are counted against recorded nights', sn.nights === 3 && sn.withDetails === 2, JSON.stringify(sn));
  check('time to fall asleep: one answered night over 30 minutes and one "not sure", counted apart', sn.fields.latency.answered === 1 && sn.fields.latency.marked === 1 && sn.fields.latency.unsure === 1);
  check('woke 2 or more times on 1 of 2 answered nights', sn.fields.wakeups.answered === 2 && sn.fields.wakeups.marked === 1);
  check('a question nobody answered counts nothing (time awake is unknown, not zero minutes)', sn.fields.awake.answered === 0 && sn.fields.awake.marked === 0 && sn.fields.awake.unsure === 0);
  check('hot flush nights come from the sleep details or the symptom note, each night once', sn.flushNights === 2 && sn.woke.flush === 1);
  var rows = A2.sleepNotesRows(sn), r1 = rows.filter(function (r) { return r[0] === 'Over 30 min to fall asleep'; })[0];
  check('the rows give counts with their own denominators and the not-sure count', rows.filter(function (r) { return r[0] === 'Sleep details'; })[0][1] === '2 of 3 recorded nights' && r1 && r1[1] === '1 of 1 answered night, 1 not sure', JSON.stringify(rows));
  check('rows leave out questions nobody answered', !rows.some(function (r) { return /Awake over 30/.test(r[0]); }));
  S2.add('sleep', d1, { bedTime: '14:00', wakeTime: '15:00', details: { latency: 'le15', woke: ['toilet'] } });
  var nd = A2.nightDetails(d1);
  check('two entries on one night: the newer answer wins and reasons for waking add up', nd.latency === 'le15' && nd.wakeups === '2' && nd.woke.indexOf('flush') > -1 && nd.woke.indexOf('toilet') > -1, JSON.stringify(nd));
  check('a night line reads in plain words', A2.sleepDetailText({ latency: '31-60', wakeups: '4+', early: 'yes', woke: ['child'] }) === 'time to fall asleep 31 to 60 min; times woken 4 or more; woke too early yes; woken by baby or child', A2.sleepDetailText({ latency: '31-60', wakeups: '4+', early: 'yes', woke: ['child'] }));

  /* the check's notes: care is never gated by how much was answered */
  var N = function (a) { return A.sleepCheckNotes(a).map(function (x) { return x.code; }); };
  check('sleepy at the wheel comes first and is a today note, even when it is the only answer', N({ driving: 'yes' })[0] === 'SLEEP_DROWSY_DRIVING' && A.sleepCheckNotes({ driving: 'yes' })[0].level === 'today');
  check('breathing noticed brings the sleep apnoea note, whatever the sleepiness', N({ breathing: 'yes' }).join() === 'SLEEP_BREATHING');
  check('restless legs feelings bring the legs note, with heavy periods and an iron test, not iron on her own', N({ legs: 'yes' }).join() === 'SLEEP_LEGS' && /heavy/.test(A.sleepCheckNotes({ legs: 'yes' })[0].message) && /before taking iron/.test(A.sleepCheckNotes({ legs: 'yes' })[0].message));
  check('3 or more hard nights in a week that affect the day bring the ongoing-trouble note', N({ w1: '3', impact: 'little' }).join() === 'SLEEP_PERSISTENT' && N({ w1: '1', w2: '4', impact: 'lot' }).join() === 'SLEEP_PERSISTENT');
  check('three months or more names the first treatment usually offered (CBT-I), sooner says not to wait', /CBT-I/.test(A.sleepCheckNotes({ w1: '5', impact: 'lot', since: '3m+' })[0].message) && /do not need to wait/.test(A.sleepCheckNotes({ w1: '5', impact: 'lot', since: 'lt2w' })[0].message));
  check('no note for 2 hard nights a week, for no effect on the day, or for "not sure"', !N({ w1: '2', w2: '2', impact: 'lot' }).length && !N({ w1: '6', impact: 'none' }).length && !N({ w1: 'unsure', w2: 'unsure', impact: 'lot' }).length);
  check('rarely enough time or place to sleep gives an information note, not a care card', N({ chance: 'rarely' }).join() === 'SLEEP_OPPORTUNITY' && A.sleepCheckNotes({ chance: 'rarely' })[0].level === 'info');
  check('quiet answers raise nothing', !N({ w1: '0', w2: '1', chance: 'usually', impact: 'none', breathing: 'no', legs: 'no', driving: 'nodrive' }).length);
  check('the check reads back in plain words', A.sleepCheckText({ w1: '4', impact: 'lot', driving: 'nodrive' }) === 'hard nights, last 7 days: 4; affects the day: a lot; sleepy while driving: does not drive', A.sleepCheckText({ w1: '4', impact: 'lot', driving: 'nodrive' }));

  /* Luna's care cards after a save */
  var w3 = fresh(), S3 = w3.OvuStore, O3 = w3.OvuOrb, t3 = S3.today();
  var drive = S3.add('sleepcheck', t3, { driving: 'yes', breathing: 'yes' }), u = O3.entryUrgent(drive, {});
  check('a check saying sleepy at the wheel shows its own today card first', u && u.level === 'today' && u.code === 'SLEEP_DROWSY_DRIVING' && /pull over/.test(u.message), JSON.stringify(u));
  check('an old check (over two weeks) brings no card', O3.entryUrgent({ id: 'x', type: 'sleepcheck', date: addDays(t3, -20), source: 'room', data: { driving: 'yes' } }, {}) === null);
  check('an information note is not a care card', O3.entryUrgent({ id: 'y', type: 'sleepcheck', date: t3, source: 'room', data: { chance: 'rarely' } }, {}) === null);
  var gasp = S3.add('sleep', t3, { bedTime: '23:00', wakeTime: '06:00', details: { woke: ['gasp'] } }), ug = O3.entryUrgent(gasp, {});
  check('a night that woke her gasping or choking brings the breathing card', ug && ug.code === 'SLEEP_BREATHING' && ug.level === 'prompt');
  check('a night without it brings none', O3.entryUrgent(S3.add('sleep', t3, { bedTime: '23:00', wakeTime: '06:00', details: { woke: ['toilet'] } }), {}) === null);

  /* hearts and backup */
  var w4 = fresh(), S4 = w4.OvuStore, R4 = w4.OvuRewards;
  var aw = R4.award(S4.add('sleepcheck', S4.today(), { w1: '2' }));
  check('answering the sleep check earns no hearts', aw.points === 0 && aw.bonus === 0);
  var sw = R4.award(S4.add('sleep', S4.today(), { bedTime: '23:00', wakeTime: '07:00', quality: 3, details: { rested: '4' } }));
  check('a night with details earns the ordinary sleep hearts, no extra', sw.points === 10 && sw.bonus === 0, JSON.stringify(sw));
  var sp = w.OvuSync.splitByType([{ id: 1, type: 'sleep' }, { id: 2, type: 'sleepcheck' }]);
  check('sleep check rows are held on the phone until the server accepts the type; sleep rows with details go up as before', sp.ok.length === 1 && sp.ok[0].type === 'sleep' && sp.held.length === 1 && sp.held[0].type === 'sleepcheck');

  /* a share from outside is cleaned before it is drawn */
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-patterns.js'), 'utf8'), w2);
  var P = w2.OvuPatterns, bad = { sleepNotes: { from: addDays(t, -27), to: t, nights: '3', withDetails: 2, fields: { latency: { answered: 1, marked: 5, unsure: '1' }, wakeups: { answered: 'x' } }, woke: { flush: 2, '<script>': 9 }, flushNights: 1, checks: [{ date: t, answers: { driving: 'yes', w1: '<img src=x onerror=alert(1)>' } }, { date: 'nope', answers: {} }] } };
  var cl = P.cleanShare(bad).sleepNotes;
  check('a shared summary keeps numbers as numbers, never more marked than answered, and only known reasons', cl.nights === 3 && cl.fields.latency.marked === 1 && cl.fields.wakeups.answered === 0 && cl.woke.flush === 2 && Object.keys(cl.woke).length === 1, JSON.stringify(cl));
  check('a shared check keeps only known answers and real dates', cl.checks.length === 1 && cl.checks[0].answers.driving === 'yes' && cl.checks[0].answers.w1 === undefined);
  var html = P.sleepNotesHTML(cl);
  check('the drawn summary carries no markup from the file, names the note raised and says it is not a score', !/<script|onerror/.test(html) && /sleepy at the wheel/i.test(html) && /not a score/.test(html), html.slice(0, 300));
  check('an empty summary says so in plain words', /No sleep details/.test(P.sleepNotesHTML({ from: t, to: t, nights: 0, withDetails: 0, fields: {}, woke: {}, flushNights: 0, checks: [] })));
  /* Codex review, 21 Oct: ties, ingress cleaning, same-day duplicates from a sync, the wording of two notes, the daily summary */
  (function () {
    var d = addDays(today, -5), ts = '2026-10-16T08:00:00.000Z';
    S.applyRemote([{ id: 'tie1', type: 'sleep', date: d, createdAt: ts, updatedAt: ts, data: { bedTime: '23:00', wakeTime: '07:00', details: { latency: 'gt60' } } }, { id: 'tie2', type: 'sleep', date: d, createdAt: ts, updatedAt: ts, data: { bedTime: '23:00', wakeTime: '07:00', details: { latency: 'le15' } } }], null);
    check('two edits with the same timestamp: the later row wins, deterministically', A.nightDetails(d).latency === 'le15');
    var d2 = addDays(today, -6);
    S.applyRemote([{ id: 'ck2', type: 'sleepcheck', date: d2, createdAt: ts, updatedAt: '2026-10-16T11:00:00.000Z', data: { driving: 'yes' } }, { id: 'ck1', type: 'sleepcheck', date: d2, createdAt: ts, updatedAt: '2026-10-16T10:00:00.000Z', data: { driving: 'no' } }], null);
    check('two checks for one day from a sync: the newest edit is the one the patterns and the card read', S.latestOnDate('sleepcheck', d2).id === 'ck2' && A.sleepNotes(d2, d2).checks.length === 1 && A.sleepNotes(d2, d2).checks[0].answers.driving === 'yes');
    var before = S.list('sleepcheck').length, imp = JSON.parse(S.exportJSON());
    imp.events.push({ id: 'junk', type: 'sleepcheck', date: addDays(today, -7), createdAt: ts, updatedAt: ts, source: 'x', data: { w1: '99', nonsense: 1 } });
    imp.events.push({ id: 'okay', type: 'sleepcheck', date: addDays(today, -8), createdAt: ts, updatedAt: ts, source: 'x', data: { w1: '2', nonsense: 1 } });
    S.importJSON(JSON.stringify(imp), 'merge');
    var okay = S.get('okay');
    check('a restored file passes the write boundary: an empty check is dropped, a valid one keeps only known answers', !S.get('junk') && S.list('sleepcheck').length === before + 1 && okay && JSON.stringify(okay.data) === '{"w1":"2"}');
    S.applyRemote([{ id: 'junk2', type: 'sleepcheck', date: addDays(today, -9), createdAt: ts, updatedAt: ts, data: { w2: 'lots' } }], null);
    check('a cloud row that cleans to nothing is not applied', !S.get('junk2'));
    var br = A.breathingNote().message, pz = A.sleepCheckNotes({ w1: '7', w2: '0', since: '3m+', impact: 'lot' }).filter(function (x) { return x.code === 'SLEEP_PERSISTENT'; })[0];
    check('the breathing note asks pregnant women and vocational drivers to say so when booking (NICE NG202 rapid assessment)', /pregnant/.test(br) && /machinery for a living/.test(br));
    check('the persistent note reports the weeks as answered, leaves chronic insomnia to the doctor, and names CBT-I as the recommended first treatment, never "usually offered"', pz && /7 nights in one of the last two weeks/.test(pz.message) && /who can say whether it is chronic insomnia/.test(pz.message) && /recommended first treatment/.test(pz.message) && !/usually offered/.test(pz.message));
    var ds = A.dailySummary(d2);
    check('the daily summary counts a check and its notes, never "Nothing logged"', /Two-week sleep check done, 1 note raised/.test(ds.text) && !/Nothing logged/.test(ds.text));
    var rows = A.sleepNotesRows(A.sleepNotes(addDays(today, -10), today)), wokeRow = rows.filter(function (r) { return r[0] === 'Woken by'; })[0];
    check('the Woken by row carries its denominator (of the nights with details)', !!wokeRow && / of \d+ nights? with details$/.test(wokeRow[1]));
  })();
})();

(function seats() {
  console.log('2k6. seats (21 Oct): three bench practices in Erin’s voice, a minute before anything is saved, one thank-you a day per seat; the cave is the tone');
  var w = fresh('2026-10-21'); w.OvuRoom = null;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-seats.js'), 'utf8'), w, { filename: 'ovu-seats.js' });
  var SE = w.OvuSeats, src = fs.readFileSync(path.join(root, 'ovu-seats.js'), 'utf8'), ids = Object.keys(SE.SCRIPTS);
  check('four practices, seven, six, six and six steps, each about two and a half to three minutes', ids.join() === 'street,plaza,tree,harbour' && SE.steps('street').length === 7 && SE.steps('plaza').length === 6 && SE.steps('tree').length === 6 && SE.steps('harbour').length === 6 && ids.every(function (id) { var t = SE.total(id); return t >= 140 && t <= 185; }), ids.map(function (id) { return SE.total(id); }).join());
  var missing = [];
  ids.forEach(function (id) { SE.steps(id).forEach(function (s) { if (!fs.existsSync(path.join(root, s.audio))) missing.push(s.audio); }); });
  SE.steps('harbour', true).forEach(function (s) { if (!fs.existsSync(path.join(root, s.audio))) missing.push(s.audio); });
  check('every clip is on disk, the reduced-motion line too', missing.length === 0, missing.join());
  var rm = SE.steps('harbour', true), plain = SE.steps('harbour', false);
  check('with reduced motion the water’s second line asks for a colour, not a ripple; nothing else changes', /colour or a reflection/.test(rm[1].text) && /ripple/.test(plain[1].text) && rm[1].audio !== plain[1].audio && rm[0].text === plain[0].text && rm[2].audio === plain[2].audio && SE.steps('street', true)[1].text === SE.steps('street')[1].text);
  var words = ids.map(function (id) { return SE.SCRIPTS[id].steps.map(function (s) { return s.text; }).join(' '); }).join(' ');
  check('no claims in the scripts: nothing cured, healed or promised, no em dashes, every part of the kindness practice optional with a way out', !/\b(cure|heal|fix|anxiety|depression|reduce stress|lower your|boost|detox|will feel)\b/i.test(words) && words.indexOf('—') < 0 && SE.SCRIPTS.plaza.steps.slice(1, 5).every(function (s) { return /If you would like|If someone|you might|Otherwise/.test(s.text); }) && /stop now/.test(SE.SCRIPTS.plaza.steps[5].text));
  var seatList = Object.keys(SE.SEATS).map(function (k) { return SE.SEATS[k]; });
  check('every bench has its own words and its own animation (Codex, 21 Oct: the bench by the tree had shared the board bench’s)', seatList.length === 4 && new Set(seatList.map(function (s) { return s.practice; })).size === 4 && new Set(seatList.map(function (s) { return s.fx; })).size === 4 && SE.SEATS['plaza:bench2'].practice === 'tree' && SE.SEATS['plaza:bench2'].fx === 'shade');
  check('the shade practice makes its small thanks optional and says so when nothing comes', /^If you would like/.test(SE.SCRIPTS.tree.steps[4].text) && /If nothing comes to mind, that is fine too/.test(SE.SCRIPTS.tree.steps[4].text) && /stop whenever you need/.test(SE.SCRIPTS.tree.steps[0].text));
  check('the credit names Erin Lee, her cloned voice and her permission', /Erin Lee/.test(SE.CREDIT) && /cloned voice/.test(SE.CREDIT) && /permission/.test(SE.CREDIT));
  var e1 = SE.entry('street', { seconds: 59.9, confirmed: true, finished: false }), e2 = SE.entry('street', { seconds: 60, confirmed: true, finished: false, startedAt: 'x' }), e3 = SE.entry('street', { seconds: 200, confirmed: false, finished: true }), e4 = SE.entry('nowhere', { seconds: 200, confirmed: true, finished: true }), e5 = SE.entry('plaza:bench2', { seconds: 168.4, confirmed: true, finished: true });
  check('59.9 seconds is not a minute; sixty is; nothing unconfirmed and no unknown seat; a finished practice is complete, a stopped one says so', e1 === null && !!e2 && e2.seconds === 60 && e2.minutes === 1 && e2.stoppedEarly && !e2.completed && e2.activity === 'seat' && e2.seat === 'street' && e2.scene === 'street' && e2.activityName === 'Sounds of the street' && e2.confirmedReal && e2.startedAt === 'x' && e2.guide === SE.CREDIT && e3 === null && e4 === null && e5.completed && !e5.stoppedEarly && e5.minutes === 2.8 && e5.scene === 'plaza', JSON.stringify([e1, e2, e5]));
  var t = 1000, clk = SE.makeClock(function () { return t; });
  clk.run(); t += 5000; clk.hold(); t += 60000; clk.run(); t += 2000;
  check('the clock counts running time only: five seconds, a minute held, two more', clk.ms() === 7000 && clk.running());
  check('the module pays no hearts and spends no energy itself, and saves only the one confirmed entry', !/OvuRewards\.(award|spend|buy)|spendWith\(|OvuStamina/.test(src) && (src.match(/S\.add\('mindfulness'/g) || []).length === 1);
  /* hearts: once a day per seat */
  var S = w.OvuStore, RW = w.OvuRewards, tdy = S.today();
  function seatEv(seat) { return S.add('mindfulness', tdy, SE.entry(seat, { seconds: 90, confirmed: true, finished: true }), 'room'); }
  var a1 = RW.award(seatEv('street')), a2 = RW.award(seatEv('street')), a3 = RW.award(seatEv('plaza:bench')), a4 = RW.award(seatEv('plaza:bench2')), a5 = RW.award(seatEv('harbour'));
  check('the street bench pays the flat practice points once; the same bench again pays nothing; the two plaza benches are two seats; each other seat pays too (cap 20 since 22 Oct)', a1.points === 2 && a2.points === 0 && a3.points === 2 && a4.points === 2 && a5.points === 2 && RW.ledger().hearts >= 8, JSON.stringify([a1.points, a2.points, a3.points, a4.points, a5.points]));
  var l = RW.ledger(); l.seatDay = null; l.mindDay = null; l.dailyLast = S.addDays(tdy, 1); S.setState({ rewards: l });
  check('a clock set back cannot reopen a seat’s thank-you either', RW.award(seatEv('street')).points === 0);
  /* the cave: both hotspots are one seat */
  var w2 = scenes('2026-10-21'); w2.OvuRoom = null; w2.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-tones.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w2, { filename: f }); });
  var CV = w2.OvuBarn.CAVE, cry = CV.hotspots.filter(function (h) { return h.id === 'crystals'; })[0], stone = CV.hotspots.filter(function (h) { return h.id === 'warmstone'; })[0];
  check('the crystals and the warm stone walk her to the same stand point', !!cry && !!stone && cry.wp.x === stone.wp.x && cry.wp.y === stone.wp.y && cry.wp.flip === stone.wp.flip);
  var TS = fs.readFileSync(path.join(root, 'ovu-tones.js'), 'utf8');
  check('the cave sheet makes no promise and keeps no pill; one Stop stands her up with the sound', !/love frequency|cellular|DNA|repair|transcend/i.test(TS) && TS.indexOf('tonePill') < 0 && /Stop sound and stand up/.test(TS) && /if \(!hz && !bed && sitting && sitting\.snd !== 'none' && endAt === null\) standUp\(\)/.test(TS)); /* a sound that ends on its own stands her up; a quiet sit does not (22 Oct) */
})();

(function ovulunaFoodArt() {
  (function noEmoji() {
    /* Jamie, 22 Oct: "never put such emoji, it must always be generated. everything has to be aesthetically cute". Nothing the
       app serves holds an emoji character; tables that must match emoji typed elsewhere write them as escapes */
    /* pictographs, flags (regional indicator pairs) and keycaps (a digit, # or * with U+20E3) */
    var bad = [], re = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
    (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) { var p = path.join(d, e.name); if (e.isDirectory()) { if (['node_modules', '.git', 'tools', 'docs', 'supabase', 'ios', 'android', 'store'].indexOf(e.name) < 0) walk(p); } else if (/\.(html|js|css|json|webmanifest|svg|txt)$/.test(e.name) && re.test(fs.readFileSync(p, 'utf8'))) bad.push(path.relative(root, p)); }); })(root);
    check('no emoji anywhere the app serves: pages, scripts, styles and data (icons and drawn pictures instead)', bad.length === 0, bad.join());
    var flag = String.fromCodePoint(0x1F1F8, 0x1F1EC), keycap = '1\uFE0F\u20E3', moon = String.fromCodePoint(0x1F319);
    check('the emoji check itself catches a moon in a JS string, the Singapore flag and a keycap, and passes plain marks (check, cross, middle dot)', re.test("var t = '" + moon + "';") && re.test('<text>' + flag + '</text>') && re.test('Step ' + keycap) && !re.test('\u2713 \u2715 \u00b7 \u2192 no emoji'));
  })();
  console.log('food pictures (21 Oct): every picture the ovarian foods name is on disk and small; no emoji (22 Oct)');
  var d = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/ovarian-foods.json'), 'utf8')), withPic = d.foods.filter(function (f) { return f.img; }), missing = withPic.filter(function (f) { return !fs.existsSync(path.join(root, f.img)); });
  (function () {
    var fsrc = fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), ksrc = fs.readFileSync(path.join(root, 'ovu-kitchen.js'), 'utf8');
    var crops = (/var CROPS = \{([\s\S]*?)\n  \};/.exec(fsrc) || [, ''])[1].match(/^    (\w+):/gm).map(function (x) { return x.trim().slice(0, -1); });
    var dishes = (ksrc.match(/\{ id: '(\w+)', name: '[^']+', icon: '[^']+', (?:added: true, )?needs:/g) || []).map(function (x) { return /id: '(\w+)'/.exec(x)[1]; });
    var miss = crops.map(function (k) { return 'assets/food/' + (k === 'sweetpotato' ? 'sweet-potato' : 'crop-' + k) + '.webp'; }).concat(dishes.map(function (d) { return 'assets/food/dish-' + d + '.webp'; })).filter(function (f) { return !fs.existsSync(path.join(root, f)); });
    check('every crop and every dish has its picture (drawn 22 Oct), small enough for a phone', crops.length >= 10 && dishes.length >= 10 && miss.length === 0, miss.join());
  })();
  check('every food card carries a picture (14 from Ovuluna, 10 drawn 22 Oct in the same style) and every file exists under assets/food', withPic.length === d.foods.length && missing.length === 0, JSON.stringify(missing.map(function (f) { return f.img; })));
  check('no food carries an emoji (Jamie, 22 Oct: "never put such emoji, it must always be generated"): every one has its picture', d.foods.every(function (f) { return !f.emoji && f.img; }));
  var big = withPic.filter(function (f) { return fs.statSync(path.join(root, f.img)).size > 40000; });
  check('the pictures are small (under 40 KB each)', big.length === 0, big.map(function (f) { return f.img; }).join());
})();

(function harbourLane() {
  console.log('2k7. Harbour Lane (21 Oct): the grocer sells the seeds and swaps three for one, floats for looks, a free gym, letters sealed until their day; no hearts paid, no diary');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js', 'ovu-lane.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var LN = w.OvuLane, F = w.OvuFarm, S = w.OvuStore, RW = w.OvuRewards, EX = w.OvuExercise, H = w.OvuHarbour, d1 = '2026-10-21';
  var src = fs.readFileSync(path.join(root, 'ovu-lane.js'), 'utf8'), farmSrc = fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8');
  var at = function (h, m) { return new Date(2026, 9, 21, h, m || 0); };
  check('five places on the lane: the grocer, the boutique, the gym, the fish store and the post box', LN.PLACES.map(function (p) { return p.id; }).join() === 'grocer,boutique,gym,fish,post');
  check('each shop keeps its own hours and the post box never shuts', !LN.openAt('grocer', at(7, 59)) && LN.openAt('grocer', at(8)) && LN.openAt('grocer', at(19, 59)) && !LN.openAt('grocer', at(20)) && LN.openAt('gym', at(6)) && !LN.openAt('gym', at(22)) && !LN.openAt('fish', at(19)) && LN.openAt('post', at(3)) && LN.hoursText('post') === 'Always open' && LN.hoursText('grocer') === '8 am to 8 pm');
  S.setState({ tester: { hearts: true } }); var tOpen = LN.openNow('grocer', at(3)); S.setState({ tester: null });
  check('tester mode visits any place at any hour, as on Dream Street', tOpen && !LN.openNow('grocer', at(3)));
  check('the harbour has a signpost to the lane with a stand point (the floor and the planner checks above cover it)', H.LAYOUT.hotspots.some(function (h) { return h.id === 'hblane' && h.wp && h.wp.x === 23 && h.wp.y === 51; }));
  /* the grocer: the shed no longer sells packs or crops; the lane does, through the farm's own one-save functions */
  check('the shed keeps its free seeds and tools; seed packs and new crops are sold at Hay & Harvest', !/data-pack|data-unlock/.test(farmSrc) && /data-pack/.test(src) && /data-unlock/.test(src) && /F(M)?\.buyPack\(/.test(src) && /F(M)?\.unlockCrop\(/.test(src) && /Hay & Harvest/.test(farmSrc));
  S.setState({ farm: { harvest: { radish: 4, carrot: 2, pumpkin: 1 } }, rewards: { hearts: 50, earned: 50, log: [], owned: [], placed: {} } });
  check('the swap offers what the basket holds three of, or a pumpkin', F.swapGivable(S).join() === 'radish,pumpkin' && F.swapNeed('radish') === 3 && F.swapNeed('pumpkin') === 1);
  var sw1 = F.swapSeed(S, 'radish', 'carrot');
  check('three radishes for one carrot seed: the basket and the seed move in one save, and no hearts change hands', sw1.ok && sw1.gave === 3 && F.farmState(S).harvest.radish === 1 && F.farmState(S).seeds.carrot === 1 && RW.ledger().hearts === 50);
  var sw2 = F.swapSeed(S, 'pumpkin', 'tomato');
  check('a pumpkin counts as three, and a used-up crop leaves the basket', sw2.ok && sw2.gave === 1 && !('pumpkin' in F.farmState(S).harvest) && F.farmState(S).seeds.tomato === 1);
  var before = JSON.stringify(S.state().farm);
  check('too few to swap, a crop she cannot grow yet, or an unknown crop: refused, nothing moves', !F.swapSeed(S, 'carrot', 'radish').ok && !F.swapSeed(S, 'radish', 'radish').ok && !F.swapSeed(S, 'carrot', 'kangkong').ok && !F.swapSeed(S, 'dragonfruit', 'radish').ok && JSON.stringify(S.state().farm) === before);
  /* floats */
  check('blush is everyone’s float from the start, and in use', LN.owns(LN.laneState(S), 'blush') && LN.floatOf(S).id === 'blush');
  var b1 = LN.buyFloat(S, RW, 'mint', d1);
  check('a mint float: 15 hearts and the float in one save, and on the line at once', b1.ok && RW.ledger().hearts === 35 && LN.laneState(S).floats.mint === d1 && LN.floatOf(S).id === 'mint');
  check('a float bought is kept: buying it again is refused and charges nothing', !LN.buyFloat(S, RW, 'mint', d1).ok && RW.ledger().hearts === 35);
  check('swapping to an owned float is free; one not owned cannot be used', LN.useFloat(S, 'blush').ok && LN.floatOf(S).id === 'blush' && !LN.useFloat(S, 'lilac').ok && LN.useFloat(S, 'mint').ok && RW.ledger().hearts === 35);
  S.setState({ rewards: Object.assign({}, RW.ledger(), { hearts: 10 }) }); var lane0 = JSON.stringify(S.state().lane);
  check('too few hearts: no float and no change', !LN.buyFloat(S, RW, 'moon', d1).ok && RW.ledger().hearts === 10 && JSON.stringify(S.state().lane) === lane0);
  S.setState({ lane: { floats: { lilac: 'soon', sunshine: d1, blush: d1, kraken: d1 }, float: 'lilac', letters: [{ id: 'x' }, 'nope', { id: 'ok', text: 'hi', written: d1, opens: '2026-10-28' }] } });
  var cl = LN.laneState(S);
  check('restored lane values are cleaned: known floats with real dates only, a float not owned falls back to blush, malformed letters dropped', JSON.stringify(cl.floats) === '{"sunshine":"2026-10-21"}' && cl.float === 'blush' && cl.letters.length === 1 && cl.letters[0].id === 'ok');
  /* the boutique's rail and the aquarium wait for their art */
  check('nothing on the rail or the aquarium can be bought before its art exists, and trying costs nothing', LN.RAIL.concat([LN.AQUARIUM]).every(function (o) { return o.ready === false && o.cost > 0; }) && /art run/.test(LN.buyRail('batik').why) && !LN.buyRail('aquarium').ok && RW.ledger().hearts === 10);
  /* the gym: four stations, each an activity the movement log knows */
  check('the gym’s four stations open activities the movement log knows, and each has one line of noticing', LN.STATIONS.length === 4 && LN.STATIONS.every(function (s) { return !!EX.activity(s.act) && s.line.split(/\s+/).length <= 18 && !/—|–/.test(s.line); }));
  /* letters */
  S.setState({ lane: null });
  var L1 = LN.writeLetter(S, '  Dear me,\r\nbe gentle.  ', 'week', d1, 0.5);
  check('a letter is posted for a week later, its text trimmed, sealed', L1.ok && L1.letter.opens === '2026-10-28' && L1.letter.text === 'Dear me,\nbe gentle.' && LN.waiting(LN.laneState(S), d1).length === 1 && LN.unread(S, d1).length === 0);
  check('an empty letter or an unknown arrival is refused', !LN.writeLetter(S, '   ', 'week', d1).ok && !LN.writeLetter(S, 'hi', 'tomorrow', d1).ok && LN.laneState(S).letters.length === 1);
  check('a month and three months arrive 30 and 91 days on', LN.writeLetter(S, 'a', 'month', d1, 0.1).letter.opens === '2026-11-20' && LN.writeLetter(S, 'b', 'season', d1, 0.2).letter.opens === '2027-01-20');
  var early = LN.openLetter(S, L1.letter.id, '2026-10-27');
  check('a letter cannot be opened before its day, and an early try marks nothing', !early.ok && early.sealed && early.opens === '2026-10-28' && !LN.laneState(S).letters.filter(function (x) { return x.id === L1.letter.id; })[0].read);
  var due = LN.unread(S, '2026-10-28').map(function (x) { return x.id; }).join(), on = LN.openLetter(S, L1.letter.id, '2026-10-28');
  check('on its day it is post for her; opened, it is marked read and no longer new', due === L1.letter.id && on.ok && on.letter.read === '2026-10-28' && LN.unread(S, '2026-10-28').length === 0 && LN.arrived(LN.laneState(S), '2026-10-28').length === 1);
  check('a letter can be deleted, sealed or read', LN.deleteLetter(S, L1.letter.id).ok && LN.laneState(S).letters.length === 2 && !LN.deleteLetter(S, L1.letter.id).ok);
  var long = LN.writeLetter(S, new Array(800).join('x'), 'week', d1, 0.3);
  check('a letter keeps at most 600 characters', long.ok && long.letter.text.length === 600);
  for (var i = 0; i < 12; i++) LN.writeLetter(S, 'n' + i, 'week', d1, i / 100);
  check('twelve letters on their way at most', LN.waiting(LN.laneState(S), d1).length === 12 && !LN.writeLetter(S, 'one more', 'week', d1).ok);
  check('letter ids are unique', (function () { var ids = LN.laneState(S).letters.map(function (x) { return x.id; }); return ids.length === new Set(ids).size; })());
  S.setState({ lane: null });
  var c1 = LN.writeLetter(S, 'one', 'week', d1, 0.42), c2 = LN.writeLetter(S, 'two', 'week', d1, 0.42);
  check('two letters posted the same day with the same draw still get different ids', c1.ok && c2.ok && c1.letter.id !== c2.letter.id);
  check('a sealed letter can be deleted before it arrives', LN.deleteLetter(S, c1.letter.id).ok && LN.laneState(S).letters.map(function (x) { return x.id; }).join() === c2.letter.id);
  S.setState({ lane: { letters: [{ id: 'm1', text: 'keep me', written: d1, opens: d1, read: true }, { id: 'm2', text: 'and me', written: d1, opens: d1, read: '' }] } });
  check('a malformed read mark is dropped, never the letter', LN.laneState(S).letters.length === 2 && LN.laneState(S).letters.every(function (x) { return !('read' in x); }));
  /* a full disk: nothing moves, no hearts go, and an arrived letter still opens (review, 21 Oct) */
  S.setState({ farm: { harvest: { radish: 3 } }, rewards: { hearts: 50, earned: 50, log: [], owned: [], placed: {} }, lane: { letters: [{ id: 'm3', text: 'hello', written: d1, opens: d1 }] } });
  var snap = JSON.stringify([S.state().farm, S.state().rewards, S.state().lane]), realCommit = S.commit;
  S.commit = function () { throw new Error('QuotaExceededError'); };
  var fSwap = F.swapSeed(S, 'radish', 'carrot'), fFloat = LN.buyFloat(S, RW, 'mint', d1), fLetter = LN.writeLetter(S, 'x', 'week', d1), fOpen = LN.openLetter(S, 'm3', d1);
  S.commit = realCommit;
  check('a failed save swaps nothing, sells no float, posts no letter and takes no hearts', !fSwap.ok && !fFloat.ok && !fLetter.ok && JSON.stringify([S.state().farm, S.state().rewards, S.state().lane]) === snap, JSON.stringify([fSwap, fFloat, fLetter]));
  check('a failed save still opens an arrived letter, which stays new', fOpen.ok && fOpen.unsaved && fOpen.letter.text === 'hello' && LN.unread(S, d1).length === 1);
  check('the lane pays no hearts, writes no diary entry, and spends hearts only on a float', !/\.award\(|\.grant\(|\bS\.add\(|OvuStore\.add\(|addMany\(/.test(src) && (src.match(/\.spend\(/g) || []).length === 1 && /function buyFloat[\s\S]*?RW\.spend\(/.test(src));
  var MS = fs.readFileSync(path.join(root, 'ovu-moments.js'), 'utf8');
  check('the lane’s moments are there: the swap, the gym, a letter posted and a letter read', ['seedswap', 'gym', 'letter', 'letterread'].every(function (k) { return MS.indexOf(k + ': {') > -1; }));
  check('room.html loads the lane after the harbour', (function () { var h = fs.readFileSync(path.join(root, 'room.html'), 'utf8'); return h.indexOf('ovu-lane.js') > h.indexOf('ovu-harbour.js') && h.indexOf('ovu-harbour.js') > -1; })());
})();

(function shopkeepersAndSoak() {
  console.log('2k7s. shopkeepers and the soak (22 Oct): a keeper in every store at her height, never in her way; a soak in the spring with a towel, a hood under it in the tudung');
  var w = scenes('2026-10-22'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js', 'ovu-lane.js', 'ovu-lanescene.js', 'ovu-barn.js', 'ovu-keepers.js', 'ovu-soak.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var KP = w.OvuKeepers, K = w.OvuWalk, LS = w.OvuLaneScene.LAYOUTS, ids = Object.keys(KP.KEEPERS);
  var lay = function (id) { return LS[id] || w.LAYOUTS[id]; };
  check('a keeper in each store (Jamie, 22 Oct: "I want NPC in each store"): the grocer, the boutique, the gym, the tackle shelf on the lane and the three Dream Street shops, each picture on disk on her own canvas', ids.slice().sort().join() === 'lane,lane-boutique,lane-grocer,lane-gym,shop-furniture,shop-homes,shop-pet' && ids.every(function (id) { var k = KP.KEEPERS[id], p = path.join(root, 'assets/room/dream', k.img); return !!lay(id) && fs.existsSync(p) && k.lines.length >= 3 && k.name && k.role; }));
  var trouble = [];
  ids.forEach(function (id) {
    var k = KP.KEEPERS[id], L = JSON.parse(JSON.stringify(lay(id)));
    if (k.x < 5 || k.x > 95 || k.y < 20 || k.y > 95) trouble.push(id + ' off the plate');
    if (k.block) L.solids = (L.solids || []).concat([Object.assign({ id: 'keeper' }, k.block)]);
    var bad = K.checkLayout(L); if (bad.length) trouble.push(id + ': ' + bad.join('; '));
    var wd = K.world(L, []), starts = (L.doors && L.doors.length ? L.doors : [L.home]).map(function (x) { return { x: x.x, y: x.y }; });
    var targets = (L.hotspots || []).filter(function (h) { return h.wp; }).map(function (h) { return h.wp; }).concat([L.home]);
    starts.forEach(function (a) { targets.forEach(function (t) { if (!(Math.abs(a.x - t.x) < 0.01 && Math.abs(a.y - t.y) < 0.01) && !K.plan(wd, a, t, 2)) trouble.push(id + ' cannot reach ' + t.x + ',' + t.y); }); });
  });
  check('with each keeper\'s floor taken, every stand point, home and door of that store is still on the floor, outside every solid, and reachable from the way in', trouble.length === 0, trouble.join(' | '));
  /* Codex (22 Oct): four keepers stood on scenery (a banister base, a window trim, a sofa, a display platform). Each keeper's
   * feet must be on the drawn floor, outside every piece of furniture, and clear of every place she stands, the stock's
   * stand points included; with the keeper's block taken, she still reaches every piece of stock from the way in */
  var footing = [];
  ids.forEach(function (id) {
    var k = KP.KEEPERS[id], L0 = lay(id), L = JSON.parse(JSON.stringify(L0)), wd0 = K.world(L0, []);
    /* an alcove keeper (the boutique's fitting alcove) stands on drawn floor outside the walkable floor, so needs no block */
    if (k.alcove ? K.inZones(wd0.zones, k.x, k.y) : !K.inZones(wd0.zones, k.x, k.y)) footing.push(id + (k.alcove ? ' alcove keeper on the walkable floor without a block' : ' feet off the floor'));
    if (K.blocked((L0.solids || []).filter(function (s) { return s.id !== 'keeper'; }), k.x, k.y)) footing.push(id + ' feet inside furniture');
    if (!k.block && !k.alcove) footing.push(id + ' has no block: she would walk through');
    var stands = (L0.hotspots || []).filter(function (h) { return h.wp; }).map(function (h) { return h.wp; }).concat([L0.home]).concat(L0.doors || []), stock = [];
    (function walk(o) { if (Array.isArray(o)) o.forEach(function (s) { if (s && s.wp) stock.push(s.wp); }); else if (o && typeof o === 'object') Object.keys(o).forEach(function (q) { walk(o[q]); }); })(L0.spots);
    stands.concat(stock).forEach(function (p) { if (Math.hypot(p.x - k.x, p.y - k.y) < 3) footing.push(id + ' within 3 of where she stands at ' + p.x + ',' + p.y); });
    if (k.block) L.solids = (L.solids || []).filter(function (s) { return s.id !== 'keeper'; }).concat([Object.assign({ id: 'keeper' }, k.block)]);
    var wd = K.world(L, []), starts = (L.doors && L.doors.length ? L.doors : [L.home]).map(function (x) { return { x: x.x, y: x.y }; });
    /* compared with the same store without its keeper: the planner here does not climb the stairs (the room walks those
     * itself), so a gallery stand point counts only if the keeper is what takes it away */
    var reach = function (w, a, t) { var pl = K.plan(w, a, t, 2), end = pl && pl.pts[pl.pts.length - 1]; return !!end && Math.hypot(end.x - t.x, end.y - t.y) <= 1; };
    stock.forEach(function (t) { if (K.blocked(wd.solids, t.x, t.y)) footing.push(id + ' stock stand point ' + t.x + ',' + t.y + ' inside a solid'); starts.forEach(function (a) { if (reach(wd0, a, t) && !reach(wd, a, t)) footing.push(id + ' takes away the way to the stock at ' + t.x + ',' + t.y); }); });
  });
  check('every keeper\'s feet are on the drawn floor, outside the furniture, at least 3 from every place she stands (the stock\'s stand points too), and with the keeper there she still reaches every piece of stock (Codex, 22 Oct)', footing.length === 0, footing.join(' | '));
  /* the browser suite (22 Oct): Ms Clara stood in front of the first house model and took its taps. A keeper's canvas
   * (her sprite width, 720/318 tall) may cover at most a third of any piece of stock, and none of the showroom's models;
   * only her own figure takes taps: every keeper has a traced outline the picture is clipped to */
  var cover = [];
  ids.forEach(function (id) {
    var k = KP.KEEPERS[id], L = lay(id); if (!L.spots || !L.w || !L.h) return;
    var aw = (L.avatarW || 10) * (k.wk || 1), ch = aw * (720 / (318 * (k.wk || 1))) * (L.w / L.h), box = [k.x - aw / 2, k.y - ch, k.x + aw / 2, k.y];
    (function walk(o) { if (Array.isArray(o)) o.forEach(function (s) { var w = s.w || 8, h = w * (L.w / L.h) * 0.9, b = [s.x - w / 2, s.y - h, s.x + w / 2, s.y], ov = Math.max(0, Math.min(box[2], b[2]) - Math.max(box[0], b[0])) * Math.max(0, Math.min(box[3], b[3]) - Math.max(box[1], b[1])) / (w * h); if (ov > (id === 'shop-homes' ? 0 : 0.34)) cover.push(id + ' covers ' + Math.round(ov * 100) + '% of the stock at ' + s.x + ',' + s.y); }); else if (o && typeof o === 'object') Object.keys(o).forEach(function (q) { walk(o[q]); }); })(L.spots);
  });
  var outlined = ids.every(function (id) { var o = KP.OUTLINE[KP.KEEPERS[id].id] || '', pts = o.split(','); return pts.length >= 12 && pts.every(function (p) { var m = /^\s*(\d+(?:\.\d)?)% (\d+(?:\.\d)?)%$/.exec(p); return m && +m[1] <= 100 && +m[2] <= 100; }); });
  var cssk = fs.readFileSync(path.join(root, 'room.css'), 'utf8');
  check('nobody floats and everyone is one size (Jamie, 22 Oct): keepers share her ground shadow under the feet and her drop shadow (never one offset downward), and the meditate event invalidates a pending session fade like activity does (Codex)', /\.avatar::before,\.keeper::before(,\.villager::before)?\{content:''/.test(cssk) && /\.keeper::before\{--cs:\.62\}/.test(cssk) && /\.keeper\{[^}]*filter:drop-shadow\(0 1px 2px rgba\(70,40,100,\.2\)\)\}/.test(cssk) && !/\.keeper\{[^}]*drop-shadow\(0 4px/.test(cssk) && /name === 'layout' \|\| name === 'meditate'\) activityGen\+\+/.test(fs.readFileSync(path.join(root, 'room.js'), 'utf8')));
  check('a keeper hides at most a third of any piece of stock and none of the showroom\'s house models; only her own figure takes a tap (each picture clipped to its traced outline, the button itself lets taps through)', cover.length === 0 && outlined && /\.keeper\{position:absolute;transform:translate\(-50%,-100%\);background:none;border:0;padding:0;cursor:pointer;pointer-events:none;/.test(fs.readFileSync(path.join(root, 'room.css'), 'utf8')), cover.join(' | ') + (outlined ? '' : ' | an outline is missing or malformed'));
  var wsrc = fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8'), csrc = fs.readFileSync(path.join(root, 'ovu-camera.js'), 'utf8'), rmsrc = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  check('keepers join the depth sort by their feet (never as a second solid: the block is in the layout) and rank themselves when drawn; keyboard focus on one brings it into view; opening Mind or the bench is an activity, so a soak or a sit by the water ends first (Codex, 22 Oct)', /#ownedProps \.keeper, (#ownedProps \.villager, )?#plateOcc/.test(wsrc) && /!el\.classList\.contains\('keeper'\)/.test(wsrc) && /wrap\.appendChild\(el\);\n    if \(root\.OvuWalk && root\.OvuWalk\.sortDepth\) root\.OvuWalk\.sortDepth\(\);/.test(fs.readFileSync(path.join(root, 'ovu-keepers.js'), 'utf8')) && /closest\('\.hotspot,\.nb,\.prop\.owned,\.keeper(,\.villager)?'\)/.test(csrc) && /endMoment\(\); emit\('meditate'\);/.test(rmsrc) && !/function enterMeditation\(\) \{[^\n]*\n[^\n]*emit\('activity'/.test(rmsrc) && ['ovu-soak.js', 'ovu-tones.js', 'ovu-barn.js', 'ovu-harbour.js', 'ovu-garden.js'].every(function (f) { return /R\.on\('meditate', /.test(fs.readFileSync(path.join(root, f), 'utf8')); }));
  var k0 = KP.KEEPERS['lane-grocer'], r1 = KP.nextLine(k0, null, '2026-10-22', 9), r2 = KP.nextLine(k0, r1.mem, '2026-10-22', 9), r3 = KP.nextLine(k0, r2.mem, '2026-10-22', 9), r4 = KP.nextLine(k0, r3.mem, '2026-10-23', 20);
  check('a tap says hello first each day (by the hour), then the shop\'s own lines in turn, and a new day says hello again', r1.text === 'Good morning! I am ' + k0.name + '.' && r2.text === k0.lines[0] && r3.text === k0.lines[1] && r4.text === 'Good evening! I am ' + k0.name + '.' && KP.hello('X', 14) === 'Good afternoon! I am X.');
  var ksrc = fs.readFileSync(path.join(root, 'ovu-keepers.js'), 'utf8');
  check('keepers sell nothing, count nothing and save nothing: no store writes, no hearts, no diary; the line is also read to screen readers', !/S\.setState|setProfile|OvuRewards|OvuStore\.add|localStorage/.test(ksrc) && /aria-live/.test(ksrc) && /aria-label/.test(ksrc));
  var Q = w.OvuSoak, CV = w.OvuBarn.CAVE, soak = CV.hotspots.filter(function (h) { return h.id === 'springsoak'; })[0];
  check('the soak: a hotspot on the warm water with its stand point by the edge; the towel picture, and the swim hood under the towel in the tudung so her hair never shows; both pictures on disk', !!soak && !!CV.soak && Q.picFor('tudung') === 'soak-tudung.webp' && Q.picFor('base') === 'soak-base.webp' && Q.picFor('gown') === 'soak-base.webp' && ['soak-base.webp', 'soak-tudung.webp'].every(function (f) { return fs.existsSync(path.join(root, 'assets/room/dream', f)); }));
  var qsrc = fs.readFileSync(path.join(root, 'ovu-soak.js'), 'utf8');
  check('the soak counts nothing and ends like sitting by the water: on walking, leaving the cave, a practice, sleep, a hidden screen or a sync; it waits its turn behind a running activity', !/OvuRewards|OvuStamina|S\.setState|OvuStore\.add/.test(qsrc) && ['beforeWalk', "'walk'", "'layout'", "'activity'", 'visibilitychange', 'sleeping', 'sync'].every(function (k) { return qsrc.indexOf(k) > -1; }) && /refuseBusy/.test(qsrc));
})();

(function harbourLaneScene() {
  console.log('2k7c. Harbour Lane as a place (21 Oct): the signpost walks her up the lane; the grocer, the boutique and the gym are rooms to walk into; every spot on the floor and reachable; the map shows the lane, not its rooms; nothing new is written');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js', 'ovu-lane.js', 'ovu-lanescene.js', 'ovu-map.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var LS = w.OvuLaneScene, LN = w.OvuLane, K = w.OvuWalk, H = w.OvuHarbour, MP = w.OvuMap;
  var src = fs.readFileSync(path.join(root, 'ovu-lanescene.js'), 'utf8');
  var ids = Object.keys(LS.LAYOUTS);
  check('the lane and three rooms: Harbour Lane, Hay & Harvest, Petal & Thread and Tideline Gym, each with its own plate on disk', ids.join() === 'lane,lane-grocer,lane-boutique,lane-gym' && ids.every(function (id) { var L = LS.LAYOUTS[id]; return L.scene === id && fs.existsSync(path.join(root, 'assets/room/dream', L.img)); }));
  ids.forEach(function (id) {
    var L = LS.LAYOUTS[id], bad = K.checkLayout(L);
    check(id + ': home, stand points and doors are on the floor and outside every solid', bad.length === 0, JSON.stringify(bad));
    var wd = K.world(L, []), starts = (L.doors.length ? L.doors : [L.home]).map(function (x) { return { x: x.x, y: x.y }; });
    var targets = L.hotspots.map(function (h) { return h.wp; }).concat(starts).concat([L.home]), miss = [];
    starts.forEach(function (a) { targets.forEach(function (t) { if (Math.abs(a.x - t.x) < 0.01 && Math.abs(a.y - t.y) < 0.01) return; var pl = K.plan(wd, a, t, 2), end = pl && pl.pts[pl.pts.length - 1]; if (!end || Math.hypot(end.x - t.x, end.y - t.y) > 1) miss.push([a.x, a.y, t.x, t.y].join(',')); }); });
    var med = L.meditator; if (!med || !K.inZones(wd.zones, med.x, med.y) || K.blocked(wd.solids, med.x, med.y) || !L.aura || !L.holo) miss.push('meditator ' + JSON.stringify(med));
    check(id + ': the planner reaches every stand point, door and resting spot from every way in, ending on it; meditation sits on this floor (Codex, 21 Oct)', miss.length === 0, miss.join(' | '));
  });
  var lane = LS.LAYOUTS.lane, door = function (L, id) { return L.doors.filter(function (d) { return d.id === id; })[0]; };
  check('the lane: four shopfronts and the post box; each front is a place in ovu-lane.js, and only the fish store has no room yet', LS.FRONTS.map(function (f) { return f.place; }).join() === 'grocer,boutique,gym,fish' && LS.FRONTS.every(function (f) { return !!LN.place(f.place); }) && lane.hotspots.some(function (h) { return h.id === 'lanepost'; }) && LS.FRONTS.filter(function (f) { return !f.layout; }).map(function (f) { return f.id; }).join() === 'lanefish');
  check('a shopfront is a doorstep that opens only where a walk ends; the path back to the harbour takes her the moment she steps on it', LS.FRONTS.every(function (f) { var d = door(lane, f.id); return d && K.passing(d) && d.tap === f.id && d.x === f.wp.x && d.y === f.wp.y && (f.layout ? d.to === f.layout : !d.to); }) && !K.passing(door(lane, 'laneexit')) && door(lane, 'laneexit').to === 'harbour');
  var hb = Object.assign({}, H.LAYOUT, { doors: H.LAYOUT.doors.concat([LS.SIGNPOST]) }), sign = H.LAYOUT.hotspots.filter(function (h) { return h.id === 'hblane'; })[0];
  check('on the harbour the signpost is a doorstep to the lane at its own stand point, on the floor and reachable from the farm path', LS.SIGNPOST.to === 'lane' && K.passing(LS.SIGNPOST) && sign && sign.wp.x === LS.SIGNPOST.x && sign.wp.y === LS.SIGNPOST.y && K.checkLayout(hb).length === 0 && !!K.plan(K.world(hb, []), { x: 34, y: 73 }, { x: LS.SIGNPOST.x, y: LS.SIGNPOST.y }, 2));
  var e1 = K.entryFor(lane, 'harbour', 'harbour'), e2 = K.entryFor(hb, 'lane', 'lane'), e3 = K.entryFor(lane, 'lane-grocer', 'lane-grocer'), e4 = K.entryFor(LS.LAYOUTS['lane-grocer'], 'lane', 'lane'), e5 = K.entryFor(LS.LAYOUTS['lane-gym'], 'lane', 'lane'), e6 = K.entryFor(lane, 'lane-gym', 'lane-gym');
  check('she arrives where she came in: the lane at its foot from the harbour, the harbour at the signpost, the lane at the door she left by, a room at its mat (the gym, whose drawn door is shut, on its floor)', e1.x === 51 && e1.y === 84 && e2.x === 23 && e2.y === 51 && e3.x === 47 && e3.y === 36 && e4.x === 50 && e4.y === 80 && e5.x === 46 && e5.y === 57 && e6.x === 55 && e6.y === 36, JSON.stringify([e1, e2, e3, e4, e5, e6]));
  check('the gym has the four stations of the lane, in the same order', LS.GYMSPOTS.map(function (g) { return g.id; }).join() === LN.STATIONS.map(function (s) { return s.id; }).join());
  var lays = {}; Object.keys(w.LAYOUTS).forEach(function (k) { lays[k] = w.LAYOUTS[k]; });
  lays.farm = w.OvuFarm.LAYOUT; lays.harbour = hb; ids.forEach(function (id) { lays[id] = LS.LAYOUTS[id]; });
  var g = MP.graph(lays, 'room'), path_ = MP.route(g, 'home', 'lane');
  check('the map finds the lane by its doors from home (home, garden, farm, harbour, lane), and its rooms are not places on the map', !!g.nodes.lane && !g.nodes['lane-grocer'] && !g.nodes['lane-boutique'] && !g.nodes['lane-gym'] && !!path_ && path_.map(function (e) { return e.to; }).join() === 'garden,farm,harbour,lane', path_ && path_.map(function (e) { return e.to; }).join());
  check('the rooms belong to the lane and are hidden from the map, as the barn’s rooms are', ids.slice(1).every(function (id) { var L = LS.LAYOUTS[id]; return L.mapHide === true && L.mapParent === 'lane' && L.indoor === true; }) && LS.onLane(lane) && LS.onLane(LS.LAYOUTS['lane-gym']) && !LS.onLane(H.LAYOUT));
  check('the lane is cobbles underfoot; the rooms are the default wood', lane.surface === 'stone' && ids.slice(1).every(function (id) { return !LS.LAYOUTS[id].surface; }));
  check('the places write nothing: no store writes, no hearts, no diary, no energy (every counter opens ovu-lane.js, whose own rules save)', !/setState\(|\.commit\(|\.award\(|\.grant\(|\.spend\(|\bS\.add\(|OvuStore|addMany\(|OvuRewards|OvuStamina/.test(src));
  check('the rooms never set a store, so the walk engine’s Dream Street hours never apply; the lane checks its own hours', !/\bstore\s*:/.test(src) && /LN\.openNow\(f\.place\)/.test(src) && /LN\.openNow\('gym'\)/.test(src) && /LN\.openNow\('boutique'\)/.test(src));
  /* the handlers, with stand-ins for the room, the walk and the lane: which place opens, and where she goes */
  var hw = vm.createContext({ console: console }); hw.window = hw;
  var calls = [], open = { grocer: true, boutique: true, gym: true, fish: true, post: true }, sleeping = false, napping_ = false, busy_ = false, regs = [];
  hw.OvuRoom = { LAYOUTS: { harbour: { id: 'harbour', doors: [{ id: 'harbourexit', to: 'farm' }], hotspots: [{ id: 'hblane', prompt: 'Tap to read the signpost' }] } }, hotspotHandlers: {}, asleep: function () { return sleeping; }, busy: function () { return busy_; }, toast: function (t) { calls.push('toast'); }, chime: function () {}, openWardrobe: function () { calls.push('wardrobe'); }, openExercise: function (a) { calls.push('exercise:' + a); }, moment: function (k) { calls.push('moment:' + k); } };
  hw.OvuWalk = { napping: function () { return napping_; }, travel: function (t) { calls.push('travel:' + t); return true; } };
  hw.OvuZones = { register: function (L) { regs.push(L.id); hw.OvuRoom.LAYOUTS[L.id] = L; } };
  hw.OvuLane = { STATIONS: LN.STATIONS, openNow: function (id) { return open[id]; }, openPlace: function (id) { calls.push('place:' + id); } };
  hw.document = { createElement: function () { return {}; } };
  vm.runInContext(src, hw, { filename: 'ovu-lanescene.js' });
  var HH = hw.OvuRoom.hotspotHandlers, Lof = function (id) { return hw.OvuRoom.LAYOUTS[id]; };
  var run = function (hid, lid) { calls = []; var r = HH[hid](hid, Lof(lid)); return { r: r, calls: calls.join() }; };
  check('the lane and its rooms register as zones, and the signpost joins the harbour’s doors once', regs.join() === 'lane,lane-grocer,lane-boutique,lane-gym' && Lof('harbour').doors.filter(function (d) { return d.id === 'hblane'; }).length === 1);
  check('the signpost walks her up the lane; while she naps nothing moves; elsewhere it is not this handler’s', run('hblane', 'harbour').calls === 'travel:lane' && (napping_ = true, run('hblane', 'harbour').calls === '') && (napping_ = false, HH.hblane('hblane', Lof('lane')) === false));
  check('an open shop takes her inside; the fish store, not drawn yet, opens its sheet; the post box opens the post', run('lanegrocer', 'lane').calls === 'travel:lane-grocer' && run('laneboutique', 'lane').calls === 'travel:lane-boutique' && run('lanegym', 'lane').calls === 'travel:lane-gym' && run('lanefish', 'lane').calls === 'place:fish' && run('lanepost', 'lane').calls === 'place:post');
  open.grocer = false; var shutG = run('lanegrocer', 'lane'); open.grocer = true; sleeping = true; var sleptB = run('laneboutique', 'lane'); sleeping = false;
  check('a shut shop or a sleeping avatar: the place’s own card says why (its hours, or that she is asleep) and she stays outside', shutG.calls === 'place:grocer' && sleptB.calls === 'place:boutique');
  check('inside: the counters open the grocer and the boutique, the fitting room opens her wardrobe, each station opens the movement log with its activity, and every way out goes to the lane', run('grocercounter', 'lane-grocer').calls === 'place:grocer' && run('grocerrack', 'lane-grocer').calls === 'place:grocer' && run('boutiquerail', 'lane-boutique').calls === 'place:boutique' && run('boutiquefit', 'lane-boutique').calls === 'wardrobe' && run('gymtreadmill', 'lane-gym').calls === 'exercise:walk,moment:gym' && run('gymweights', 'lane-gym').calls === 'exercise:strength,moment:gym' && ['grocermat:lane-grocer', 'boutiquemat:lane-boutique', 'gymdoor:lane-gym'].every(function (x) { var q = x.split(':'); return run(q[0], q[1]).calls === 'travel:lane'; }) && run('laneexit', 'lane').calls === 'travel:harbour');
  open.gym = false; var shutGym = run('gymbike', 'lane-gym'); open.gym = true; open.boutique = false; var shutFit = run('boutiquefit', 'lane-boutique'); open.boutique = true;
  check('inside after closing time a station or the fitting room shows the closed card instead, and nothing is logged or opened', shutGym.calls === 'place:gym' && shutFit.calls === 'place:boutique');
  busy_ = true; var bz = ['grocercounter:lane-grocer', 'boutiquefit:lane-boutique', 'gymtreadmill:lane-gym', 'lanepost:lane', 'lanefish:lane', 'lanegrocer:lane'].map(function (x) { var q = x.split(':'); return run(q[0], q[1]).calls; }); busy_ = false;
  check('while a session, practice or meditation runs, no counter, station, front or post box opens anything: she is told to finish first (Codex, 21 Oct)', bz.every(function (c) { return c === 'toast'; }), bz.join(' | '));
  var GR = Lof('lane-grocer'); open.grocer = false; calls = []; var adm = GR.admit(); GR.refused(); var refusedCalls = calls.join(); open.grocer = true; sleeping = true; var admSleep = GR.admit(); sleeping = false;
  check('a room asks again at the end of the walk in: shut or asleep, she stays outside and the place says why (Codex, 21 Oct)', adm === false && refusedCalls === 'place:grocer' && admSleep === false && GR.admit() === true && !Lof('lane-gym').admit === false);
  check('with the lane drawn the signpost says it walks her up the lane; without it the harbour keeps its own words (Codex, 21 Oct)', Lof('harbour').hotspots[0].prompt === 'Tap to walk up Harbour Lane' && /prompt: 'Tap to read the signpost'/.test(fs.readFileSync(path.join(root, 'ovu-harbour.js'), 'utf8')));
  check('the gym, whose door is a tap, gives the map its exit; the walk engine asks a room with its own rule before and after the fade', Lof('lane-gym').mapExits[0].to === 'lane' && /if \(T\.admit && !T\.admit\(\)\) \{ if \(T\.refused\) T\.refused\(\); return false; \}/.test(fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8')) && /var refused = !!\(T\.admit && !T\.admit\(\)\);/.test(fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8')));
  var lsrc = fs.readFileSync(path.join(root, 'ovu-lane.js'), 'utf8'), msrc = fs.readFileSync(path.join(root, 'ovu-map.js'), 'utf8');
  check('Back inside the drawn lane closes the counter, and the lane\u2019s sheet lists the places without carrying her between them; the map inside a room pins the room\u2019s own doors and starts the way with leaving it (Codex, 21 Oct)', /if \(standing\(\)\) R\.closeSheet\(\); else openLane\(\);/.test(lsrc) && /if \(box && !walkable\(\)\) box\.addEventListener/.test(lsrc) && /concat\(L\.mapExits \|\| \[\]\)/.test(msrc) && /routeHTML\(g, here, first, lead\)/.test(msrc));
  check('each handler answers only in its own place', HH.lanegrocer('lanegrocer', Lof('harbour')) === false && HH.grocercounter('grocercounter', Lof('lane')) === false && HH.gymdoor('gymdoor', Lof('lane-boutique')) === false);
  check('room.html loads the lane’s places right after the lane, and the service worker has a new version', (function () { var h = fs.readFileSync(path.join(root, 'room.html'), 'utf8'); return h.indexOf('<script src="ovu-lanescene.js"></script>') === h.indexOf('<script src="ovu-lane.js"></script>') + '<script src="ovu-lane.js"></script>\n'.length; })() && /var VERSION = 'ovumind-2026-1[01]-(2[1-9]|3[01])-[a-z0-9-]+';/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')));
})();

(function gymWorkouts() {
  console.log('2k7c2. Tideline Gym workouts (22 Oct): each station is a workout she does on the machine in her workout clothes, a picture only; the movement log is offered only after a minute; one activity at a time; she is never left half dressed or invisible');
  var read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };
  var w = scenes('2026-10-22'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js', 'ovu-lane.js', 'ovu-lanescene.js', 'ovu-gym.js'].forEach(function (f) { vm.runInContext(read(f), w, { filename: f }); });
  var GY = w.OvuGym, LS = w.OvuLaneScene, LN = w.OvuLane, gsrc = read('ovu-gym.js'), rsrc = read('room.js'), wsrc = read('ovu-walk.js'), lsrc = read('ovu-lanescene.js');
  var ART = path.join(root, 'assets/room/dream');
  function webpSize(file) {
    var b = fs.readFileSync(file), kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') { var v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  check('four workouts, one per station, in the gym\'s order, each the activity its station already logs', GY.ORDER.join() === LS.GYMSPOTS.map(function (g) { return g.id; }).join() && GY.ORDER.join() === LN.STATIONS.map(function (s) { return s.id; }).join() && LN.STATIONS.every(function (s) { return GY.STATIONS[s.id] && GY.STATIONS[s.id].act === s.act; }));
  check('her gym kit: the covered-head kit for a tudung wearer, the yoga set for everyone else', GY.kitFor('tudung') === 'gym-tudung' && ['base', 'yoga', 'gown', 'pajamas', 'kebaya-blue', undefined].every(function (o) { return GY.kitFor(o) === 'yoga'; }) && GY.KITS.join() === 'yoga,gym-tudung');
  var missing = [];
  GY.KITS.forEach(function (kit) { GY.ORDER.forEach(function (id) {
    var m = GY.strip(kit, id); if (!m) { missing.push(kit + '/' + id + ' none'); return; }
    var f = path.join(ART, m.file); if (!fs.existsSync(f)) { missing.push(m.file + ' missing'); return; }
    var sz = webpSize(f), side = path.join(ART, m.file.replace(/\.webp$/, '.json')), meta = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, 'utf8')) : null;
    if (sz.w !== m.frames * m.w || sz.h !== m.h) missing.push(m.file + ' is ' + sz.w + 'x' + sz.h);
    if (!meta || meta.frames !== m.frames || meta.w !== m.w || meta.h !== m.h || meta.standW !== m.standW) missing.push(m.file + ' sidecar ' + JSON.stringify(meta && [meta.frames, meta.w, meta.h, meta.standW]));
    if (m.frames < 2) missing.push(m.file + ' has one frame');
  }); });
  check('every station has its strip in both kits, on disk at frames times the cell, matching its sidecar, with something to animate', missing.length === 0, missing.join(' | '));
  check('the covered-head kit has its standing picture, its blink and its fit, and walks with a side strip (never a sprite that shows her hair)', fs.existsSync(path.join(ART, 'avatar-gym-tudung.webp')) && fs.existsSync(path.join(ART, 'avatar-gym-tudung-blink.webp')) && /'gym-tudung':\[1(\.0)?,0\.\d+\]/.test(rsrc) && /'gym-tudung': 'side'/.test(wsrc) && fs.existsSync(path.join(ART, 'avatar-walk-gym-tudung-side.webp')));
  var loop = { kind: 'loop', fps: 8 }, fade = { kind: 'fade', hold: 2000, fade: 900 };
  check('frames: a loop steps at its rate and wraps; a fade holds each frame; reduced motion keeps the still frame', GY.frameAt(loop, 8, 0) === 0 && GY.frameAt(loop, 8, 125) === 1 && GY.frameAt(loop, 8, 999) === 7 && GY.frameAt(loop, 8, 1000) === 0 && GY.frameAt(fade, 2, 1999) === 0 && GY.frameAt(fade, 2, 2000) === 1 && GY.frameAt(fade, 2, 4000) === 0 && GY.frameAt(loop, 8, 625, true) === 0 && GY.frameAt(fade, 4, 99999, true) === 0);
  check('minutes for the log: nothing under a minute of active time (59.9 s is not a minute), then rounded, never zero', GY.minutesFor(59999) === 0 && GY.minutesFor(59900) === 0 && GY.minutesFor(60000) === 1 && GY.minutesFor(89999) === 1 && GY.minutesFor(90000) === 2 && GY.minutesFor(600000) === 10 && GY.minutesFor(-5) === 0 && GY.minutesFor(NaN) === 0);
  var b = GY.box({ x: 50, y: 50 }, 10, 20), cp = GY.clipLocal([[50, 40], [45, 30], [55, 50]], b);
  check('the clip: a plate polygon in the strip\'s own percent (feet at the bottom centre)', b.left === 45 && b.top === 30 && cp === 'polygon(50.00% 50.00%, 0.00% 0.00%, 100.00% 100.00%)' && GY.clipLocal(null, b) === '', cp);
  var t = 0, ck = GY.makeClock(function () { return t; }); ck.run(); t = 1000; ck.hold(); t = 5000; var held = ck.ms(); ck.run(); t = 6000; ck.hold(5500);
  check('the clock counts only while running; a hold can end at the last moment it was seen, never later than now', held === 1000 && ck.ms() === 1500 && !ck.running());
  (function () {
    var w1 = fresh('2026-10-23'), S1 = w1.OvuStore, b0 = S1.born();
    S1.add('reflection', '2026-10-23', { text: 'a walk' }, 'room'); var b1 = S1.born(), backup = S1.exportJSON();
    var w2 = fresh('2026-10-23'); /* a second tab on the same storage */
    w2.localStorage = w1.localStorage; vm.runInContext(fs.readFileSync(path.join(root, 'ovu-store.js'), 'utf8'), w2, { filename: 'ovu-store.js' });
    w2.OvuStore.importJSON(backup, 'merge'); var b2 = S1.born();
    w2.OvuStore.importJSON(backup, 'replace'); var b3 = S1.born();
    w2.OvuStore.clearAll(); var b4 = S1.born();
    check('the store says which diary this is: an ordinary save or a merging restore keeps it; another tab\'s restore that replaces the diary (even a backup of this same diary, same createdAt) or Delete everything changes it, read here at once', !!b0 && b0 === b1 && b2 === b1 && b3 !== b2 && b4 !== b3 && JSON.parse(backup).createdAt && w1.localStorage.getItem('ovumind_db_epoch_v1'), JSON.stringify([b0, b1, b2, b3, b4]));
  })();
  var spots = GY.ORDER.map(function (id) { return [LS.GYMSPOTS.filter(function (g) { return g.id === id; })[0].wp, GY.STATIONS[id].on]; });
  check('no stand point and no machine spot is where the coach stands (feet 40.5, 53.2; x 38.5 to 42.5, y 51.8 to 54.6)', spots.every(function (p) { return !GY.inCoach(p[0]) && !GY.inCoach(p[1]); }) && GY.inCoach({ x: 40.5, y: 53.2 }));
  check('the gym writes nothing by itself: no diary entry, state, profile, hearts or energy; only her Save in the movement log does', !/\bS\.add\(|setState\(|setProfile\(|\.commit\(|\.award\(|\.grant\(|\.spend\(|OvuRewards|OvuStamina|addMany\(/.test(gsrc));
  check('its words: the world-wide emergency line, no country number, no em dash, no emoji', /local emergency number/.test(gsrc) && !/\b995\b|\b911\b|\b999\b/.test(gsrc) && gsrc.indexOf('—') < 0 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(gsrc));
  check('the stations open the workout when the gym module is there, else the movement log as before; the strip never blocks a walk; room.html loads it after the lane\'s places', /root\.OvuGym && root\.OvuGym\.open && root\.OvuGym\.open\(g\.id\)/.test(lsrc) && /R\.openExercise\(st\.act\); if \(R\.moment\)/.test(lsrc) && /!el\.classList\.contains\('nosolid'\)/.test(wsrc) && /'nb nosolid gymworker gym-'/.test(gsrc) && (function () { var h = read('room.html'), g = h.indexOf('<script src="ovu-gym.js"></script>'); return g > h.indexOf('<script src="ovu-lanescene.js"></script>') && g > h.indexOf('<script src="ovu-boutique.js"></script>') && h.indexOf('<script src="ovu-gym.js"></script>', g + 1) < 0; })());
  check('room.js: the workout clothes are a picture only, worn through wearing(), dropped on leaving the room they began in and at bedtime; a wardrobe pick meanwhile is saved and waits', /function wearing\(\) \{ return trying \? trying\.outfit : costume \? costume\.outfit : savedOutfit\(\); \}/.test(rsrc) && /if \(!costume\) showOutfit\(id, silent\);/.test(rsrc) && /if \(costume && \(!L2 \|\| L2\.id !== costume\.at\)\) undress\(true\);/.test(rsrc) && /OvuGym\.cancel\(\); \} catch \(e\) \{ \} \/\* and a gym workout[^\n]*\n    try \{ undress\(true\); \}/.test(rsrc) && !/costume[^\n]*setProfile|setProfile[^\n]*costume/.test(rsrc));
  check('room.js: a workout is an activity (its panel comes back when refused), keeps her off every walk, idle return and idle moment, and the bed ends it before the journey home', /kind: 'gym', name: gs && gs\.title/.test(rsrc) && /a\.kind === 'gym' && OvuGym\.reveal/.test(rsrc) && /OvuSeats\.active\(\)\) \|\| \(window\.OvuGym && OvuGym\.active && OvuGym\.active\(\)\) \|\| arranging/.test(rsrc) && /if \(\(window\.OvuGym && OvuGym\.active && OvuGym\.active\(\)\)\) return; \/\* on a gym machine/.test(rsrc) && /!\(window\.OvuGym && OvuGym\.active && OvuGym\.active\(\)\) && !\(hooks\.moving && hooks\.moving\(\)\)\) walkTo\(HOME\)/.test(rsrc) && /if \(h\.id === 'bed'\) \{ OvuGym\.cancel\(\);/.test(rsrc) && /'#gpanel'/.test(rsrc));
  check('the movement log takes the gym\'s minutes, day and words, leaves a strength day for her to tick (even if she taps Strength again, until she ticks it herself), and saves exactly as before', /function openExercise\(pre, opt\)/.test(rsrc) && /noTick: opt\.strengthTick === false/.test(rsrc) && /str\.checked = st\.tick !== null \? st\.tick : !!a\.strength && !st\.noTick;/.test(rsrc) && /\$\('#mvStr'\)\.addEventListener\('change', function \(\) \{ st\.tick = this\.checked; preview\(\); \}\);/.test(rsrc) && /var ev = S\.add\('exercise', \$\('#mvDate'\)\.value \|\| today, data, 'room'\);/.test(rsrc));
  check('room.js: going back to her own clothes falls back to the picture she wore before the workout if her own will not load, never the workout clothes; the camera follows her strip while her standing picture is hidden', /turnInto\(own, function \(ok\) \{ rec\.pending = false; if \(!ok\) wearOwn\(own, back\);/.test(rsrc) && /var from = leftOn\(\) \? lastCostume\.back : k && k\.indexOf\('act-'\) !== 0 \? ART \+ 'avatar-' \+ k \+ '\.webp' : '';/.test(rsrc) && /if \(!leftOn\(\)\) \{ lastCostume\.pending = false; return false; \}/.test(rsrc) && /if \(!leftOn\(\)\) \{ rec\.pending = false; return; \}/.test(rsrc) && /\(rec\.waits = \(rec\.waits \|\| 0\) \+ 1\) < 5\) \{ watchRestore\(rec\); return; \}[^\n]*\n      rec\.pending = false;/.test(rsrc) && !/R\.meditating && R\.meditating\(\)\) return;/.test(gsrc) && /if \(R\.restoring && R\.restoring\(\)\) return;/.test(gsrc) && /function wearOwn\(own, back\)/.test(rsrc) && /root\.OvuGym && root\.OvuGym\.focus && root\.OvuGym\.focus\(\)/.test(read('ovu-camera.js')));

  /* the runner, with stand-ins: a tiny page, the room, the walk, the store and a clock we move by hand */
  function harness(o) {
    o = o || {};
    var T = { now: 1000, timers: [], seq: 0 }, calls = [], hooks = {}, subs = [], images = [], els = {}, docH = {};
    function timer(fn, ms, rep) { var id = ++T.seq; T.timers.push({ id: id, at: T.now + (ms || 0), fn: fn, rep: rep ? Math.max(1, ms || 1) : 0 }); return id; }
    function clear(id) { T.timers = T.timers.filter(function (x) { return x.id !== id; }); }
    function advance(ms) { var end = T.now + ms; for (var g = 0; g < 100000; g++) { var due = T.timers.filter(function (x) { return x.at <= end; }).sort(function (a, b) { return a.at - b.at || a.id - b.id; })[0]; if (!due) break; T.now = Math.max(T.now, due.at); if (due.rep) due.at += due.rep; else clear(due.id); due.fn(); } T.now = end; }
    function El(tag) {
      var cls = {}, e = { tagName: tag, style: {}, dataset: {}, children: [], parentNode: null, isConnected: false, hidden: false, disabled: false, textContent: '', _h: {}, _q: {},
        classList: { add: function () { for (var i = 0; i < arguments.length; i++) cls[arguments[i]] = 1; }, remove: function () { for (var i = 0; i < arguments.length; i++) delete cls[arguments[i]]; }, contains: function (c) { return !!cls[c]; }, toggle: function (c, on) { if (on === undefined ? !cls[c] : on) cls[c] = 1; else delete cls[c]; } },
        setAttribute: function () { }, addEventListener: function (ev, fn) { (e._h[ev] = e._h[ev] || []).push(fn); }, focus: function () { },
        appendChild: function (c) { if (c.parentNode) c.remove(); c.parentNode = e; c.isConnected = true; e.children.push(c); return c; },
        insertBefore: function (c) { return e.appendChild(c); },
        remove: function () { var p = e.parentNode; if (p) p.children = p.children.filter(function (x) { return x !== e; }); e.parentNode = null; e.isConnected = false; },
        querySelector: function (s) { return e._q[s] || (e._q[s] = El('img')); }, querySelectorAll: function () { return []; },
        click: function (ev) { (e._h.click || []).forEach(function (f) { f.call(e, ev || { target: { closest: function () { return null; } } }); }); } };
      Object.defineProperty(e, 'offsetWidth', { get: function () { return 1; } });
      return e;
    }
    var doc = { hidden: false, body: El('body'), createElement: El, getElementById: function (id) { return els[id] || (els[id] = El('div')); }, addEventListener: function (ev, f) { (docH[ev] = docH[ev] || []).push(f); } };
    var st = { layout: 'lane-gym', asleep: false, saved: o.saved || 'base', other: null, open: true, sheet: null, reduced: !!o.reduced, meditating: false, state: { sleeping: false }, born: '2026-10-01T00:00:00Z' };
    var props = El('div'), avatar = El('div'), scene = El('div'); props.isConnected = true;
    var R = { ART: 'assets/room/dream/', esc: function (s) { return String(s); }, reduced: function () { return st.reduced; }, layout: function () { return { id: st.layout, avatarW: 9, w: 1024, h: 1280 }; },
      asleep: function () { return st.asleep; }, meditating: function () { return st.meditating; }, sessionOn: function () { return false; }, practiceOn: function () { return false; },
      activityNow: function () { return st.other || (hw.OvuGym.active() ? { kind: 'gym', name: 'x', icon: 'fitness_center' } : null); }, busyLine: function (a) { return a.name + ' is running.'; },
      refuseBusy: function () { if (st.other) { calls.push('refused'); return true; } if (hw.OvuGym.active()) { calls.push('reveal'); hw.OvuGym.reveal(); return true; } return false; },
      toast: function (t) { calls.push('toast:' + t); }, chime: function () { }, openSheet: function (id) { st.sheet = id; calls.push('sheet:' + id); Object.keys(els).forEach(function (k) { if (/^gym/.test(k)) delete els[k]; }); },
      hideSheet: function () { st.sheet = null; }, sheetOpen: function () { return !!st.sheet; },
      emit: function (n, a, b) { calls.push('emit:' + n + ':' + a + ':' + b); (hooks[n] || []).forEach(function (f) { f(a, b); }); }, on: function (n, f) { if (n === 'boot') { f(); return; } (hooks[n] = hooks[n] || []).push(f); },
      savedOutfit: function () { return st.saved; }, dressFor: function (k, done) { calls.push('dress:' + k); R._dressed = done; return true; }, undress: function (silent) { calls.push('undress:' + (silent ? 'silent' : 'turn')); },
      placeAvatar: function (p) { calls.push('place:' + p.x + ',' + p.y); }, freezeWalk: function () { }, cancelIdle: function () { }, endMoment: function () { },
      openExercise: function (a, opt) { calls.push('exercise:' + a + ':' + JSON.stringify(opt || null)); }, moment: function () { calls.push('moment'); },
      els: { props: props, avatar: avatar, scene: scene } };
    var hw = vm.createContext({ console: console, Date: Date, Math: Math, JSON: JSON, String: String, Number: Number, Object: Object, Array: Array, Promise: Promise });
    hw.window = hw; hw.document = doc; hw.performance = { now: function () { return T.now; } };
    hw.setTimeout = function (f, ms) { return timer(f, ms, false); }; hw.setInterval = function (f, ms) { return timer(f, ms, true); }; hw.clearTimeout = clear; hw.clearInterval = clear;
    hw.Image = function () { var im = this; images.push(im); im.decode = function () { return { then: function (ok) { ok(); } }; }; };
    hw.OvuStore = { today: function () { return '2026-10-22'; }, state: function () { return st.state; }, subscribe: function (f) { subs.push(f); }, born: function () { return st.born; } };
    hw.OvuRoom = R; hw.OvuWalk = { walking: function () { return false; }, stop: function () { }, sortDepth: function () { } };
    hw.OvuLane = { STATIONS: LN.STATIONS, openNow: function () { return st.open; }, openPlace: function (id) { calls.push('place:' + id); } };
    hw.OvuLaneScene = { GYMSPOTS: LS.GYMSPOTS };
    vm.runInContext(gsrc, hw, { filename: 'ovu-gym.js' });
    var G = hw.OvuGym;
    return { G: G, st: st, calls: calls, advance: advance, T: T, images: images, els: els, doc: doc, avatar: avatar, props: props, R: R,
      fire: function (n, a, b) { (hooks[n] || []).forEach(function (f) { f(a, b); }); }, store: function (reason) { subs.forEach(function (f) { f(reason); }); }, vis: function () { (docH.visibilitychange || []).forEach(function (f) { f(); }); },
      begin: function (id, len) { G.open(id); if (len) els.gymLen.click({ target: { closest: function () { return { dataset: { len: String(len) } }; } } }); els.gymBegin.click(); },
      ready: function () { if (R._dressed) R._dressed(true); images.forEach(function (im) { if (im.onload) im.onload(); }); },
      log: function () { return calls.filter(function (c) { return c.indexOf('exercise:') === 0; }); } };
  }
  var h = harness();
  h.st.other = { kind: 'session', name: 'Just breathe', icon: 'x' }; var refusedOpen = h.G.open('treadmill'); h.st.other = null;
  h.st.asleep = true; h.G.open('treadmill'); h.st.asleep = false;
  check('a station\'s sheet never opens over another activity (its own controls come back) or while she sleeps', refusedOpen === true && h.calls.indexOf('refused') > -1 && h.calls.indexOf('toast:She is asleep. Tap the bed to wake her first.') > -1 && !h.calls.some(function (c) { return /^sheet:/.test(c); }));
  h.calls.length = 0; h.begin('treadmill', 5);
  var s0 = h.G.state();
  check('Begin: the sheet (its own, open) is no obstacle; everything else is asked to step aside first, she stands at the stand point and turns into the yoga set; nothing is shown on the machine yet', h.calls[0] === 'sheet:gym-treadmill' && h.calls.indexOf('emit:activity:gym:treadmill') > -1 && h.calls.indexOf('dress:yoga') > h.calls.indexOf('emit:activity:gym:treadmill') && h.calls.indexOf('place:33,58') > -1 && s0.phase === 'dress' && !s0.mounted && s0.minutes === 5 && !h.avatar.classList.contains('hidden') && h.st.sheet === null, h.calls.join(' | '));
  h.ready();
  var s1 = h.G.state(), el = h.props.children[0];
  check('once dressed and the strip is decoded she steps on: her standing picture hides and the strip plays on the belt, her size from her walk strip, clipped behind the window\'s arch', s1.phase === 'move' && s1.mounted && h.avatar.classList.contains('hidden') && el && /gymworker gym-treadmill flip/.test(el.className) && el.style.left === '33.8%' && el.style.top === '64.6%' && Math.abs(parseFloat(el.style.width) - 9 * 380 / 318) < 0.01 && /^polygon\(/.test(el.style.clipPath), JSON.stringify([s1, el && el.className, el && el.style]));
  var seen = {}; for (var q = 0; q < 10; q++) { h.advance(125); seen[h.G.state().frame] = 1; } h.advance(30000 - 1250); var s2 = h.G.state();
  check('on the belt the walk steps through its frames (at least six different ones in a second and a quarter) and after 30 s the clock reads 30 s', Object.keys(seen).length >= 6 && Math.abs(s2.ms - 30000) <= 100, JSON.stringify([Object.keys(seen), s2]));
  h.calls.length = 0; h.els.gpStop.click(); h.advance(3000);
  check('Stop under a minute: off the machine, she turns back into her own clothes, is seen again at the stand point, and nothing is offered or written', !h.G.active() && h.calls.indexOf('undress:turn') > -1 && h.calls.indexOf('toast:Stopped. Nothing under a minute is recorded.') > -1 && h.log().length === 0 && !h.avatar.classList.contains('hidden') && h.props.children.length === 0 && h.calls.indexOf('place:33,58') > -1, h.calls.join(' | '));
  h.calls.length = 0; h.begin('weights', 10); h.ready(); h.advance(61000); h.els.gpStop.click(); h.advance(1200);
  var lg = h.log();
  check('Stop after a minute: the movement log opens with strength work chosen, 1 minute from the clock, today, her words, and the strength day left for her to tick', lg.length === 1 && lg[0].indexOf('exercise:strength:') === 0 && /"minutes":1/.test(lg[0]) && /"date":"2026-10-22"/.test(lg[0]) && /"strengthTick":false/.test(lg[0]) && /About 1 minute on the weights\. Save it if you really moved too\./.test(lg[0]), lg.join());
  h.calls.length = 0; h.begin('mat', 5); h.ready(); h.advance(5 * 60000 + 1500);
  lg = h.log();
  check('the length she chose ends it by itself: the log opens with yoga and exactly 5 minutes, never more', !h.G.active() && lg.length === 1 && lg[0].indexOf('exercise:yoga:') === 0 && /"minutes":5/.test(lg[0]) && /That is 5 minutes on the mat\./.test(lg[0]), lg.join());
  h.calls.length = 0; h.begin('bike', 10); h.ready(); h.advance(20000); h.els.gpPause.click(); var p1 = h.G.state(); h.advance(60000); var p2 = h.G.state(); h.els.gpPause.click(); h.advance(20000); var p3 = h.G.state();
  check('Pause holds the clock and the frame; Resume carries on from there', p1.paused && Math.abs(p2.ms - p1.ms) < 1 && p2.frame === p1.frame && !p3.paused && Math.abs(p3.ms - 40000) <= 200, JSON.stringify([p1, p2, p3]));
  h.doc.hidden = true; h.vis(); var hd = h.G.state(); h.advance(120000); var hd2 = h.G.state(); h.doc.hidden = false;
  check('a hidden page pauses it: time away is never counted, and the panel says so on return', hd.paused && Math.abs(hd2.ms - hd.ms) < 1 && /that time is not counted/.test(h.els.gpText.textContent), JSON.stringify([hd, hd2, h.els.gpText.textContent]));
  h.els.gpPause.click(); var f0 = h.G.state().ms; h.T.now += 15000; h.advance(150); var f1 = h.G.state();
  check('a page that froze without saying so adds nothing: the clock stops where it was last seen running', f1.paused && f1.ms - f0 < 400 && /that time is not counted/.test(h.els.gpText.textContent), JSON.stringify([f0, f1, h.els.gpText.textContent]));
  h.calls.length = 0; h.fire('activity', 'practice', 'teeth');
  check('another activity starting ends the workout at once: her own clothes back without a turn, nothing asked', !h.G.active() && h.calls.indexOf('undress:silent') > -1 && h.log().length === 0 && !h.calls.some(function (c) { return /^toast:/.test(c); }) && !h.avatar.classList.contains('hidden'), h.calls.join(' | '));
  h.calls.length = 0; h.begin('treadmill', 10); h.ready(); h.advance(90000); h.st.layout = 'lane'; h.calls.length = 0; h.fire('layout', { id: 'lane' }); h.advance(3000);
  check('leaving the gym ends it with nothing asked; she is shown in the new scene where it put her, not walked back to the gym\'s spot', !h.G.active() && h.calls.indexOf('undress:silent') > -1 && !h.calls.some(function (c) { return /^place:/.test(c); }) && h.log().length === 0 && !h.avatar.classList.contains('hidden') && h.props.children.length === 0, h.calls.join(' | '));
  h.st.layout = 'lane-gym'; h.begin('treadmill', 10); h.ready(); h.advance(90000); h.calls.length = 0; h.st.asleep = true; h.st.state.sleeping = true; h.store('state'); h.advance(3000);
  check('bedtime from another tab ends it with nothing asked and shows her again (this tab draws no sleeper, so she must not vanish)', !h.G.active() && h.calls.indexOf('undress:silent') > -1 && h.log().length === 0 && !h.avatar.classList.contains('hidden'), h.calls.join(' | '));
  h.st.asleep = false; h.st.state.sleeping = false; h.begin('treadmill', 10); h.ready(); h.advance(5000); h.R.els.scene.classList.add('is-night'); h.st.asleep = true; h.st.state.sleeping = true; h.store('state');
  check('bedtime in this tab: its night hides her itself, so the gym leaves her hidden', !h.G.active() && h.avatar.classList.contains('hidden'));
  h.R.els.scene.classList.remove('is-night');
  h.st.asleep = false; h.st.state.sleeping = false; h.avatar.classList.remove('hidden');
  h.begin('treadmill', 10); h.ready(); h.advance(90000); h.calls.length = 0; h.store('clear'); h.advance(3000);
  check('clearing her data ends it with nothing asked', !h.G.active() && h.calls.indexOf('undress:silent') > -1 && h.log().length === 0);
  h.begin('treadmill', 10); h.ready(); h.advance(90000); h.calls.length = 0; h.store('sync'); h.store('profile'); var gone = h.props.children[0]; gone.remove(); var elx = h.G.state(); h.fire('props'); h.advance(1000);
  check('a cloud pull or a props rebuild changes nothing she is doing: the workout runs on, back on the machine', h.G.active() && h.G.state().ms > elx.ms && h.props.children.length === 1 && h.log().length === 0, JSON.stringify(h.G.state()));
  h.st.sheet = 'calendar'; h.calls.length = 0; h.els.gpStop.click(); h.advance(5000);
  var waited = h.log().length; h.st.sheet = null; h.advance(500);
  check('the log never replaces another open sheet: it waits for it to close, then opens', waited === 0 && h.log().length === 1 && h.calls.some(function (c) { return /^toast:Well done/.test(c); }), h.calls.join(' | '));
  h.begin('treadmill', 10); h.ready(); h.advance(90000); h.st.sheet = 'calendar'; h.calls.length = 0; h.els.gpStop.click(); h.advance(2000); h.fire('activity', 'session', 'erin'); h.st.sheet = null; h.advance(2000);
  check('a waiting log offer is dropped when anything else starts, so it never opens over a newer activity', h.G.pendingAsk() === false && h.log().length === 0, h.calls.join(' | '));
  h.begin('treadmill', 10); h.ready(); h.advance(90000); h.calls.length = 0; h.fire('beforeWalk'); h.advance(100);
  check('a walk that starts anyway finishes the workout early: clothes back without a turn, the log offered for what she did', !h.G.active() && h.calls.indexOf('undress:silent') > -1 && h.log().length === 1 && /"minutes":2/.test(h.log()[0]), h.calls.join(' | '));
  var hx = harness(); hx.begin('treadmill', 10); hx.doc.hidden = true; hx.vis(); hx.ready(); hx.advance(30000); var hz = hx.G.state(); hx.doc.hidden = false;
  check('locked while she was changing: she waits on the machine paused, with nothing counted, and the panel says time away is not counted', hz.phase === 'move' && hz.paused && hz.away && hz.ms === 0 && /that time is not counted/.test(hx.els.gpText.textContent), JSON.stringify(hz));
  hx.els.gpPause.click(); hx.advance(59900); hx.calls.length = 0; hx.els.gpStop.click(); hx.advance(2000);
  check('then 59.9 s of visible time is still under a minute: nothing is offered', hx.log().length === 0 && hx.calls.indexOf('toast:Stopped. Nothing under a minute is recorded.') > -1, hx.calls.join(' | '));
  var hv = harness(); hv.begin('treadmill', 10); hv.ready(); hv.advance(10000); hv.T.now += 120000; hv.doc.hidden = true; hv.vis(); var v1 = hv.G.state(); hv.doc.hidden = false;
  var hp = harness(); hp.begin('treadmill', 10); hp.ready(); hp.advance(10000); hp.T.now += 120000; hp.els.gpPause.click(); var v2 = hp.G.state(); hp.calls.length = 0; hp.els.gpStop.click(); hp.advance(2000);
  check('a page that froze, then went hidden or was paused before the next tick, still counts only the time seen running', v1.paused && v1.ms < 10200 && v2.paused && v2.ms < 10200 && hp.log().length === 0, JSON.stringify([v1, v2]));
  var hr = harness(); hr.begin('treadmill', 10); hr.ready(); hr.advance(90000); hr.store('external'); var r1 = hr.G.active(); hr.st.born = '2026-10-23T00:00:00Z'; hr.calls.length = 0; hr.store('external'); hr.advance(2000);
  check('another tab saving keeps the workout; another tab deleting or restoring the diary (a new diary) ends it with nothing asked', r1 && !hr.G.active() && hr.calls.indexOf('undress:silent') > -1 && hr.log().length === 0, hr.calls.join(' | '));
  var hf = harness(); var f0x = hf.G.focus(); hf.begin('bike', 5); hf.ready(); var fz = hf.G.focus();
  check('the camera follows the middle of her on the machine (the bike\'s feet are behind the low wall), and nothing when no workout runs', f0x === null && fz && fz.x === 36 && fz.y < 75.5 && fz.y > 60, JSON.stringify(fz));
  var hd = harness(); hd.begin('weights', 5); hd.ready(); hd.advance(2050); hd.els.gpPause.click(); var ga = hd.props.children[0].querySelector('.gwa'), gb = hd.props.children[0].querySelector('.gwb');
  check('Pause freezes a cross-fade on the current frame, fully drawn', ga.style.transition === 'none' && ga.style.opacity === '1' && gb.style.transition === 'none' && gb.style.opacity === '0');
  var hm = harness(); hm.begin('mat', 10); hm.ready(); hm.advance(70000); hm.calls.length = 0; hm.fire('meditate'); hm.advance(100);
  check('the meditate hook (any path that seats her on the mat; the Mind tab itself is refused during a workout, a browser check) brings her off the machine first, clothes back without a turn, and the log is offered for what she did', !hm.G.active() && hm.calls.indexOf('undress:silent') > -1 && hm.log().length === 1 && /"minutes":1/.test(hm.log()[0]), hm.calls.join(' | '));
  var hp = harness(); hp.begin('weights', 5); hp.ready(); hp.advance(70000); hp.st.sheet = 'calendar'; hp.els.gpStop.click(); hp.advance(3000);
  var waited = hp.G.pendingAsk(); hp.st.sheet = null; hp.doc.body.classList.add('btap-open'); hp.advance(2000); hp.doc.body.classList.remove('btap-open'); hp.advance(3000);
  check('a log offer waiting behind a sheet is dropped when Light Flower or Koi Pond opens over the room, and never opens under it or after it', waited && !hp.G.pendingAsk() && hp.log().length === 0, hp.calls.join(' | '));
  var hq = harness(); hq.begin('weights', 5); hq.ready(); hq.advance(70000); hq.st.meditating = true; hq.els.gpStop.click(); hq.advance(3000);
  check('her still being seated with no sheet open (a child sheet of Mind, Everyday or You, closed) never holds a waiting offer: it opens (Codex diff review 4)', hq.log().length === 1 && !hq.G.pendingAsk(), hq.calls.join(' | '));
  var t2 = harness({ saved: 'tudung' }); t2.begin('weights', 5);
  check('a tudung wearer turns into the covered-head kit', t2.calls.indexOf('dress:gym-tudung') > -1 && t2.G.state().kit === 'gym-tudung');
  t2.images.forEach(function (im) { im.onerror && im.onerror(); }); if (t2.R._dressed) t2.R._dressed(true); t2.advance(5000);
  check('a strip that will not load leaves her standing at the machine in her workout clothes, seen, with the clock running', t2.G.state().phase === 'move' && !t2.G.state().mounted && !t2.avatar.classList.contains('hidden') && t2.props.children.length === 0 && t2.G.state().ms > 0, JSON.stringify(t2.G.state()));
  var t3 = harness({ reduced: true }); t3.begin('weights', 5); t3.ready(); t3.advance(10000); var rf = t3.G.state();
  check('reduced motion: one still frame, the clock still counts', rf.frame === 0 && rf.ms >= 9000 && t3.props.children.length === 1, JSON.stringify(rf));
  var t4 = harness(); t4.begin('treadmill', 5); t4.advance(4500); var dz = t4.G.state();
  check('a turn cut short and a strip that never answers hold her off the machine for a few seconds at most: then she works out standing beside it, seen', dz.phase === 'move' && !dz.mounted && !t4.avatar.classList.contains('hidden'), JSON.stringify(dz));
  var t6 = harness(); t6.begin('bike', 5); t6.advance(500); t6.calls.length = 0; t6.els.gpStop.click(); t6.advance(2000);
  check('Stop while she is still changing: her own clothes back, nothing written, and it says so', !t6.G.active() && t6.log().length === 0 && t6.calls.indexOf('undress:turn') > -1 && t6.calls.indexOf('toast:Stopped before starting. That is fine.') > -1, t6.calls.join(' | '));
  var t5 = harness(); t5.begin('treadmill', 5); t5.ready(); t5.calls.length = 0; t5.G.open('bike');
  check('while a workout runs, another station\'s sheet does not open: the running one\'s panel comes back', !t5.calls.some(function (c) { return /^sheet:/.test(c); }) && t5.G.state().id === 'treadmill');
})();

(function boutiqueTryOn() {
  console.log('2k7d. trying on at Petal & Thread (21 Oct): any outfit, Plus drops too, shown and never saved; Keep is the only save; the accessory slot is placed per sprite and hidden until its art exists');
  var w = vm.createContext({ console: console }); w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-boutique.js'), 'utf8'), w, { filename: 'ovu-boutique.js' });
  var B = w.OvuBoutique, rsrc = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), bsrc = fs.readFileSync(path.join(root, 'ovu-boutique.js'), 'utf8');
  check('no accessory is ready yet, so the slot ships hidden (no art run without Jamie’s go-ahead)', B.list().length === 0 && B.ACCESSORIES.every(function (a) { return a.ready !== true || fs.existsSync(path.join(root, 'assets/room/dream', a.img)); }));
  var hat = { id: 'flower', name: 'Hair flower', img: 'accessory-flower.webp', ready: true, at: { base: { u: 0.6, v: 0.1, w: 0.2, rot: -10 }, gown: { u: 0.5, v: 0.08, w: 0.15 }, bad: { u: 2, v: 0.1, w: 0.2 } }, skip: ['tudung'] };
  var draft = Object.assign({}, hat, { id: 'beret', ready: false });
  check('only ready pieces with an id, a picture and positions are offered', B.list([hat, draft, { id: 'X!', ready: true, img: 'a', at: {} }]).map(function (a) { return a.id; }).join() === 'flower' && B.byId('beret', [hat, draft]) === null);
  check('a piece sits only on a sprite it was placed for: a walk strip, a pose or a bad position hides it, and a skipped outfit never wears it (no hair under a tudung)', !!B.spotFor(hat, 'base', 'base') && B.spotFor(hat, 'act-plants', 'base') === null && B.spotFor(hat, 'bad', 'base') === null && B.spotFor(hat, 'base', 'tudung') === null && B.spotFor(hat, null, 'base') === null && B.spotFor(hat, 'toString', 'base') === null);
  var b1 = B.boxFor([1, 0.5], hat.at.base), b2 = B.boxFor([1.403, 0.518], hat.at.gown);
  check('placement follows the fitted picture: on a plain sprite u maps straight across; a wider gown canvas scales and shifts it; flipped, it mirrors about her centre', b1.l === 60 && b1.lf === 40 && b1.t === 10 && b1.w === 20 && b1.rot === -10 && Math.abs(b2.l - ((0.5 - 0.518 * 1.403 + 0.5 * 1.403) * 100)) < 0.01 && Math.abs(b2.w - 0.15 * 140.3) < 0.01 && b2.rot === 0, JSON.stringify([b1, b2]));
  check('the fitting room names each card: what she wears, her own, hers to wear, or Part of Rhythme Plus (no price anywhere)', B.tag('base', { wearing: 'base', trying: false, mine: true, saved: 'base' }) === 'Wearing now' && B.tag('gown', { wearing: 'gown', trying: true, mine: false, saved: 'base' }) === 'Trying on' && B.tag('gown', { wearing: 'base', mine: false, saved: 'base' }) === 'Part of Rhythme Plus' && B.tag('party', { wearing: 'base', mine: true, saved: 'base' }) === 'Yours to wear' && !/♥|S\$|USD|\$\d|heartTxt/.test(bsrc.replace(/\/\*[\s\S]*?\*\//g, ''))); /* no money price anywhere: Plus is the paid side and its price lives in the store sheet; hearts are the game's own */
  check('the rails (Jamie, 22 Oct): every outfit hangs as its own picture; hers are free, a Plus drop says Rhythme Plus with no price, a new arrival says its hearts and that it is arriving until its pictures exist', B.railTag({ id: 'party', kind: 'own' }, 'base') === 'Yours, free' && B.railTag({ id: 'gown', kind: 'plus' }, 'base') === 'Rhythme Plus' && B.railTag({ id: 'batik', kind: 'hearts', cost: 120, wearable: false }, 'base') === '120 hearts · arriving soon' && B.railTag({ id: 'base', kind: 'own' }, 'base') === 'Wearing now' && ['base', 'pajamas', 'sundress', 'cozy', 'yoga', 'party', 'kebaya-blue', 'kebaya-green', 'kebaya-red', 'tudung', 'gown', 'batik', 'raincape'].every(function (id) { return fs.existsSync(path.join(root, 'assets/room/boutique/rail-' + id + '.webp')); }));
  var tryFn = rsrc.slice(rsrc.indexOf('function tryOn('), rsrc.indexOf('function keepTryOn('));
  check('trying on, an accessory and going back write nothing: no profile, state, diary or hearts in tryOn, tryAcc or endTryOn', tryFn.length > 200 && !/setProfile|setState|commit\(|\.add\(|spend\(|award/.test(tryFn));
  check('Keep is the only save, of an outfit she has, and a failed save keeps the try-on', /function keepTryOn\(\) \{[\s\S]*?if \(outfitLocked\(id\)\) return \{ ok: false, plus: true[\s\S]*?try \{ S\.setProfile\(patch\); \} catch \(e\) \{ return \{ ok: false[\s\S]*?trying = null;/.test(rsrc));
  check('a pose, a blink and a pose that will not load read what she wears and never save an outfit (Codex design review)', /function restorePose\(\) \{ (lastPose = null; )?showOutfit\(wearing\(\), true\); \}/.test(rsrc) && /poseSrc\(pose, wearing\(\)\)/.test(rsrc) && /else showOutfit\(wearing\(\), true\); \};/.test(rsrc) && /var o = wearing\(\), open = 'avatar-'/.test(rsrc));
  check('she is back in her own clothes when she leaves the room she tried on in, sleeps, sits on the mat, or a practice, session or Morning start begins', /hooks\.on\.layout = [^\n]*L2\.id !== trying\.at\)\) endTryOn\(true\)/.test(rsrc) && /hooks\.on\.activity = [^\n]*endTryOn\(true\)/.test(rsrc) && /function stopEverything\(\) \{\n    try \{ endTryOn\(true\); \}/.test(rsrc) && /function enterMeditation\(\) \{\n    endTryOn\(true\);/.test(rsrc) && /room\.endTryOn\(true\)/.test(fs.readFileSync(path.join(root, 'ovu-morning.js'), 'utf8')));
  check('sleep and the mat still dress her in what she saved, and the other scenes and the plaza read only her saved outfit', /function wornOutfit\(\) \{ return S\.profile\(\)\.outfit \|\| 'base'; \}/.test(rsrc) && ['ovu-garden.js', 'ovu-harbour.js', 'ovu-barn.js', 'ovu-seats.js', 'ovu-tones.js', 'ovu-friends.js'].every(function (f) { return !/wearing\(\)|tryingOn/.test(fs.readFileSync(path.join(root, f), 'utf8')); }));
  check('with reduced motion she never turns: going back is a plain change, and the twirl itself checks reduced', /\} else showOutfit\(own, reduced\);/.test(rsrc) && /function twirlOk\(\) \{ return !reduced &&/.test(rsrc));
  check('a choice made in the fitting room waits for the sheet to step aside and is dropped if anything else began (a walk out, a sheet, sleep)', /if \(tok !== pickTok \|\| !here\(\) \|\| \(R\.busy && R\.busy\(\)\) \|\| \(R\.asleep && R\.asleep\(\)\)\) return;/.test(bsrc));
  check('the Plus drop opens the in-app purchase hook (OvuPlus.offer) when it exists, else the Plus sheet', /root\.OvuPlus\.offer\(\{ from: 'boutique', item: item \}\)/.test(bsrc) && /R\.openPlus\(\)/.test(bsrc));
  check('room.html loads the boutique right after the lane’s places', (function () { var h = fs.readFileSync(path.join(root, 'room.html'), 'utf8'); return h.indexOf('<script src="ovu-boutique.js"></script>') === h.indexOf('<script src="ovu-lanescene.js"></script>') + '<script src="ovu-lanescene.js"></script>\n'.length; })());
})();

(function farmKitchen() {
  console.log('2k8a. the farm kitchen (21 Oct): staples for hearts in one save, recipes from the basket and the barn, cooking in one save with no hearts, no energy and no diary; no fish');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-harbour.js', 'ovu-lane.js', 'ovu-kitchen.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var K = w.OvuKitchen, F = w.OvuFarm, S = w.OvuStore, RW = w.OvuRewards, B = w.OvuBarn, d1 = '2026-10-21';
  var src = fs.readFileSync(path.join(root, 'ovu-kitchen.js'), 'utf8'), laneSrc = fs.readFileSync(path.join(root, 'ovu-lane.js'), 'utf8'), roomSrc = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  var ids = Object.keys(K.STAPLES);
  check('eight staples at Hay & Harvest, 2 to 4 hearts each: rice, eggs, noodles, tofu, garlic, coconut milk, honey and yoghurt', ids.join() === 'rice,egg,noodles,tofu,garlic,coconut,honey,yoghurt' && ids.every(function (k) { return K.STAPLES[k].cost >= 2 && K.STAPLES[k].cost <= 4; }));
  var known = function (k) { return !!F.CROPS[k] || !!K.STAPLES[k] || !!K.HERBS[k]; };
  check('every recipe is vegetables, herbs and staples only: no fish, no unknown ingredient', K.RECIPES.every(function (r) { return Object.keys(r.needs).every(known) && !/fish|ikan|prawn|bilis/i.test(JSON.stringify(r)); }) && !/fish/i.test(Object.keys(F.CROPS).join() + ids.join()));
  check('the design’s recipes are there, and the two with ginger or pandan cook once the greenhouse herbs are picked into the basket (collation, 21 Oct)', ['garlicpakchoy', 'kangkongfry', 'tomatoegg', 'pumpkinsoup', 'carrotradish', 'strawberrybowl', 'sweetpotatoginger', 'pandanrice'].every(function (id) { return !!K.recipe(id); }) && K.RECIPES.every(function (r) { return !r.soon && r.steps.length === 4; }) && (function () { S.setState({ farm: { harvest: { sweetpotato: 1, ginger: 1, pandan: 1 }, kitchen: { rice: 1 }, pantry: {} } }); var a = K.canCook(S, 'sweetpotatoginger'), b = K.canCook(S, 'pandanrice'); S.setState({ farm: { harvest: { sweetpotato: 1 }, kitchen: { rice: 1 } } }); var c = K.canCook(S, 'sweetpotatoginger'); return a.ok && b.ok && !c.ok && c.missing && c.missing[0].key === 'ginger' && c.missing[0].herb; })());
  check('every staple sold has a dish that uses it, and every dish she can cook has its four steps', ids.every(function (k) { return K.RECIPES.some(function (r) { return !r.soon && r.needs[k]; }); }) && K.RECIPES.every(function (r) { return r.soon || (r.steps.length === 4 && r.steps.every(function (t) { return !/—|–/.test(t); })); }) && K.STEPS.map(function (x) { return x.id; }).join() === 'wash,chop,smell,taste');
  /* buying staples */
  S.setState({ farm: { harvest: {}, pantry: { egg: 2, milk: 1 } }, rewards: { hearts: 10, earned: 10, log: [], owned: [], placed: {} } });
  var b1 = K.buyStaple(S, RW, 'rice');
  check('rice: 2 hearts and a portion in the kitchen, in one save', b1.ok && RW.ledger().hearts === 8 && F.farmState(S).kitchen.rice === 1 && RW.ledger().log[0].what === 'staple:rice');
  var b2 = K.buyStaple(S, RW, 'egg');
  check('eggs are the barn’s pantry eggs: a bought egg joins them, never a second count', b2.ok && F.farmState(S).pantry.egg === 3 && !('egg' in (F.farmState(S).kitchen || {})) && RW.ledger().hearts === 5 && F.farmState(S).pantry.milk === 1);
  S.setState({ rewards: Object.assign({}, RW.ledger(), { hearts: 1 }) }); var snap0 = JSON.stringify([S.state().farm, S.state().rewards]);
  check('too few hearts or an unknown staple: refused, nothing changes', !K.buyStaple(S, RW, 'honey').ok && !K.buyStaple(S, RW, 'caviar').ok && JSON.stringify([S.state().farm, S.state().rewards]) === snap0);
  S.setState({ farm: { kitchen: { garlic: 99 }, pantry: { egg: 99 } }, rewards: Object.assign({}, RW.ledger(), { hearts: 50 }) });
  check('the kitchen holds 99 of a staple and the pantry 99 eggs; a full shelf charges nothing', !K.buyStaple(S, RW, 'garlic').ok && !K.buyStaple(S, RW, 'egg').ok && RW.ledger().hearts === 50);
  S.setState({ farm: { kitchen: { rice: '3', tofu: -2, garlic: 'lots', honey: 1e9, saffron: 4, 'bad key': 2, egg: 7 } } });
  check('restored kitchen values are cleaned: whole numbers, at most 99, eggs only in the pantry; a newer build’s staple is carried, not dropped', JSON.stringify(K.kitchenOf(S.state().farm)) === '{"saffron":4,"rice":3,"noodles":0,"tofu":0,"garlic":0,"coconut":0,"honey":99,"yoghurt":0}');
  /* cooking */
  S.setState({ farm: { harvest: { tomato: 3, pakchoy: 2 }, pantry: { egg: 1 }, kitchen: { rice: 1 } }, stamina: { v: 40, max: 100, day: d1 }, rewards: { hearts: 5, earned: 5, log: [], owned: [], placed: {} } });
  var gp = K.canCook(S, 'garlicpakchoy');
  check('a dish missing a staple says what is still needed', !gp.ok && gp.missing.length === 1 && gp.missing[0].key === 'garlic' && /1 garlic/.test(gp.why));
  check('the dishes ready now are the ones with everything in the basket, pantry and kitchen', K.ready(S).join() === 'tomatoegg');
  var n0 = S.list().length, st0 = JSON.stringify(S.state().stamina), c1 = K.cook(S, 'tomatoegg'), f1 = F.farmState(S);
  check('tomato and egg uses two tomatoes, the pantry egg and the rice, all in one save', c1.ok && f1.harvest.tomato === 1 && f1.pantry.egg === 0 && f1.kitchen.rice === 0 && f1.harvest.pakchoy === 2);
  check('cooking earns no hearts, takes no energy and writes no diary entry', RW.ledger().hearts === 5 && RW.ledger().log.length === 0 && JSON.stringify(S.state().stamina) === st0 && S.list().length === n0);
  check('a cooked dish stays in her bag, one each time it is made (22 Oct)', F.farmState(S).dishes && F.farmState(S).dishes.tomatoegg === 1);
  check('a dish cannot be cooked twice from one set of ingredients', !K.cook(S, 'tomatoegg').ok && F.farmState(S).harvest.tomato === 1);
  S.setState({ farm: Object.assign({}, S.state().farm, { harvest: { pumpkin: 1 }, kitchen: { coconut: 1 } }) });
  var c2 = K.cook(S, 'pumpkinsoup');
  check('a crop used up leaves the basket', c2.ok && !('pumpkin' in F.farmState(S).harvest) && F.farmState(S).kitchen.coconut === 0);
  check('a herb dish is refused and nothing moves', (function () { var b = JSON.stringify(S.state().farm); return !K.cook(S, 'pandanrice').ok && !K.cook(S, 'nope').ok && JSON.stringify(S.state().farm) === b; })());
  /* the farm's other actions keep the kitchen, and the barn's eggs cook */
  S.setState({ farm: { harvest: { radish: 3 }, kitchen: { honey: 2 } } });
  F.swapSeed(S, 'radish', 'carrot'); F.fillCan(S);
  check('a seed swap or filling the can keeps the kitchen’s staples', F.farmState(S).kitchen && F.farmState(S).kitchen.honey === 2);
  var eg = B.collectEggs(S, d1);
  check('eggs from the hen house are the eggs a dish uses', eg.ok && F.farmState(S).pantry.egg === eg.n && F.farmState(S).kitchen.honey === 2);
  /* a failed save: nothing bought, nothing cooked, no hearts (S.commit leaves memory as it was) */
  S.setState({ farm: { harvest: { kangkong: 2 }, kitchen: { garlic: 1 } }, rewards: { hearts: 20, earned: 20, log: [], owned: [], placed: {} } });
  var snap = JSON.stringify([S.state().farm, S.state().rewards]), realCommit = S.commit;
  S.commit = function () { throw new Error('QuotaExceededError'); };
  var fBuy = K.buyStaple(S, RW, 'tofu'), fCook = K.cook(S, 'kangkongfry');
  S.commit = realCommit;
  check('a failed save sells no staple, cooks nothing and takes no hearts', !fBuy.ok && !fCook.ok && JSON.stringify([S.state().farm, S.state().rewards]) === snap, JSON.stringify([fBuy, fCook]));
  var realSet = w.localStorage.setItem; w.localStorage.setItem = function () { throw new Error('QuotaExceededError'); };
  var gBuy = K.buyStaple(S, RW, 'tofu'), gCook = K.cook(S, 'kangkongfry');
  w.localStorage.setItem = realSet;
  check('a full disk under the real S.commit: memory is as it was, nothing sold, nothing cooked, no hearts', !gBuy.ok && !gCook.ok && JSON.stringify([S.state().farm, S.state().rewards]) === snap, JSON.stringify([gBuy, gCook]));
  check('then it cooks once the save works', K.cook(S, 'kangkongfry').ok && !('kangkong' in F.farmState(S).harvest) && F.farmState(S).kitchen.garlic === 0);
  /* the house rules, read from the source */
  check('the kitchen pays no hearts, writes no diary entry, spends hearts only on a staple and costs no energy', !/\.award\(|\.grant\(|\bS\.add\(|OvuStore\.add\(|addMany\(|spendWith\(|ST\.spend\(/.test(src) && (src.match(/\.spend\(/g) || []).length === 1 && /function buyStaple[\s\S]*?RW\.spend\(/.test(src));
  check('the grocer sells staples through the kitchen’s one-save function and still spends hearts only on a float itself', /KT\(\)\.buyStaple\(S, RW\(\)/.test(laneSrc) && (laneSrc.match(/\.spend\(/g) || []).length === 1);
  check('Yes opens the food diary filled in and saves nothing; No opens nothing', /dishYes[\s\S]*?R\.openDiary\('add', \{ notes:/.test(src) && /dishNo[\s\S]*?R\.hideSheet\(\)/.test(src) && /function openDiary\(pane, pre\)/.test(roomSrc) && /openDiary: openDiary/.test(roomSrc));
  var MS = w.OvuMoments || null; vm.runInContext(fs.readFileSync(path.join(root, 'ovu-moments.js'), 'utf8'), w, { filename: 'ovu-moments.js' }); MS = w.OvuMoments;
  check('a mindful line for each cooking step and one for the dish, each with her pose', K.STEPS.map(function (x) { return x.moment; }).concat(['cookdish']).every(function (k) { return MS.MOMENTS[k] && MS.MOMENTS[k].lines.length && MS.MOMENTS[k].pose && fs.existsSync(path.join(root, 'assets/room/dream/avatar-act-' + MS.MOMENTS[k].pose + '.webp')); }));
  var homes = ['room', 'house', 'bathhouse', 'familyhome'], withStove = homes.filter(function (id) { return w.LAYOUTS[id].hotspots.some(function (h) { return h.id === 'stove'; }); });
  check('a stove only where a plate draws a kitchen: the family home', withStove.join() === 'familyhome' && K.STOVES.join() === 'familyhome');
  check('room.html loads the kitchen after the farm and the lane', (function () { var h = fs.readFileSync(path.join(root, 'room.html'), 'utf8'); return h.indexOf('ovu-kitchen.js') > h.indexOf('ovu-lane.js') && h.indexOf('ovu-lane.js') > h.indexOf('ovu-farm.js'); })());
})();

(function greenhouseHerbs() {
  console.log('2k8b. greenhouse herbs (21 Oct): four planters by the door, starts from Hay & Harvest, growth by watered days, the basket, a tea minute with no diary and only the flat thank-you');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-harbour.js', 'ovu-lane.js', 'ovu-herbs.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var GH = w.OvuGreenhouse, F = w.OvuFarm, S = w.OvuStore, RW = w.OvuRewards, ST = w.OvuStamina, K = w.OvuWalk, HB = w.OvuHerbs, L = GH.LAYOUT, d1 = '2026-10-21';
  var src = fs.readFileSync(path.join(root, 'ovu-greenhouse.js'), 'utf8'), laneSrc = fs.readFileSync(path.join(root, 'ovu-lane.js'), 'utf8');
  var days = function (n) { var out = []; for (var i = 0; i < n; i++) out.push(S.addDays(d1, i)); return out; };
  var reset = function (hearts) { S.setState({ greenhouse: null, farm: null, stamina: { v: 100, max: 100, day: (S.state().stamina || {}).day || d1 }, rewards: { hearts: hearts == null ? 100 : hearts, earned: 0, log: [], owned: [], placed: {} } }); };
  var T = { ginger: [6, 6, 3], lemongrass: [4, 4, 2], pandan: [4, 4, 2], chamomile: [5, 4, 2] };
  check('the four herbs at the design’s prices and days: ginger 6 hearts, ripe on day 6, again every 3; lemongrass and pandan 4, 4, 2; chamomile 5, 4, 2', GH.HERB_IDS.join() === 'ginger,lemongrass,pandan,chamomile' && GH.HERB_IDS.every(function (k) { var h = GH.HERBS[k]; return h.cost === T[k][0] && h.ripe === T[k][1] && h.regrow === T[k][2] && h.yield > 0; }));
  /* the planters on the plate: on the floor, clear of the furniture, every stand point reachable from the door */
  var bad = K.checkLayout(L);
  check('the greenhouse with its planters: home, the tea table, the door and every stand point are on the floor and clear', bad.length === 0, bad.join('; '));
  var props = GH.HERB_BEDS.map(function (b) { return { id: b.id, x: b.at[0], y: b.at[1], w: b.w }; }).concat(GH.PLANTS.map(function (p) { return { id: p.id, x: p.at[0], y: p.at[1], w: p.w }; }));
  var wl = K.world(L, props), door = L.doors[0], miss = [];
  GH.HERB_BEDS.forEach(function (b) { if (!K.inZones(L.zones, b.wp.x, b.wp.y) || K.blocked(wl.solids, b.wp.x, b.wp.y)) miss.push(b.id + ' stand point'); else { if (!K.plan(wl, L.home, b.wp, 2)) miss.push(b.id + ' from home'); if (!K.plan(wl, { x: door.x, y: door.y }, b.wp, 2)) miss.push(b.id + ' from the door'); } });
  check('every planter has a stand point on the floor, outside every solid and drawn pot, that the planner reaches from home and from the door', miss.length === 0, miss.join('; '));
  var targets = L.hotspots.map(function (h) { return h.wp; }).concat(GH.PLANTS.filter(function (p) { return p.wp; }).map(function (p) { return p.wp; })), cut = [];
  targets.forEach(function (t) { if (!K.plan(wl, L.home, t, 2)) cut.push(JSON.stringify(t)); });
  check('the planters cut nothing off: the tea table, the door and every plant are still reachable with the planters drawn', cut.length === 0, cut.join('; '));
  check('the planters stand on the tiled floor, in front of the chairs and the tea table, and leave the way in clear', GH.HERB_BEDS.every(function (b) { return K.inZones(L.zones, b.at[0], b.at[1] - 0.3) && b.box[2] >= 69.5; }) && GH.HERB_BEDS.every(function (b) { return b.box[1] <= 46.3 || b.box[0] >= 52.7; }));
  check('the planters are solids of the layout, one per planter', L.solids.filter(function (x) { return x.id === 'herbbed'; }).length === 4);
  /* Hay & Harvest: hearts and the start in one save */
  reset(10);
  var b1 = GH.buyStart(S, RW, 'ginger');
  check('a ginger start costs 6 hearts and lands in the greenhouse bag in the same save', b1.ok && RW.ledger().hearts === 4 && GH.herbState(S).seeds.ginger === 1);
  check('too few hearts: no start and no change; an unknown herb is not sold', !GH.buyStart(S, RW, 'chamomile').ok && RW.ledger().hearts === 4 && !GH.herbState(S).seeds.chamomile && !GH.buyStart(S, RW, 'basil').ok);
  /* planting and watering by real days */
  var e0 = ST.value(), p1 = GH.plantHerb(S, 'hb1', 'ginger', d1, ST);
  check('planting uses the start and charges the planting energy in the same save', p1.ok && p1.charged && !GH.herbState(S).seeds.ginger && GH.herbState(S).beds.hb1.herb === 'ginger' && ST.value() === e0 - ST.COSTS.plant);
  check('a planted planter, a start she does not have, or an unknown planter is refused', !GH.plantHerb(S, 'hb1', 'ginger', d1, ST).ok && !GH.plantHerb(S, 'hb2', 'pandan', d1, ST).ok && !GH.plantHerb(S, 'hb9', 'ginger', d1, ST).ok);
  var w1 = GH.waterHerb(S, 'hb1', d1, ST);
  check('watering counts the day once; again the same day counts nothing', w1.ok && w1.days === 1 && w1.need === 6 && !GH.waterHerb(S, 'hb1', d1, ST).ok && GH.herbDays(GH.herbState(S).beds.hb1) === 1);
  var gap = GH.waterHerb(S, 'hb1', '2026-10-25', ST);
  check('a missed day adds nothing and takes nothing away: three dry days later it is day 2 of 6', gap.ok && gap.days === 2 && GH.herbStage(GH.herbState(S).beds.hb1) === 1);
  check('a clock set back before the last watering counts nothing', !GH.waterHerb(S, 'hb1', '2026-10-24', ST).ok && GH.herbDays(GH.herbState(S).beds.hb1) === 2);
  ['2026-10-26', '2026-10-27', '2026-10-28'].forEach(function (d) { GH.waterHerb(S, 'hb1', d, ST); });
  check('five watered days is not yet ripe for ginger', !GH.herbRipe(GH.herbState(S).beds.hb1) && GH.herbStage(GH.herbState(S).beds.hb1) === 2);
  var w6 = GH.waterHerb(S, 'hb1', '2026-10-29', ST);
  check('the sixth watered day ripens ginger, and a ripe planter needs no more water', w6.ok && w6.ripe && GH.herbStage(GH.herbState(S).beds.hb1) === 3 && !GH.waterHerb(S, 'hb1', '2026-10-30', ST).ok);
  /* the harvest goes into the farm's basket; the herb grows again on its regrow cadence */
  S.setState({ farm: { harvest: { lemongrass: 5, radish: 2 }, seeds: { radish: 1 }, beds: { bed1: { crop: 'radish', planted: d1, watered: [d1] } } } });
  var e1 = ST.value(), h1 = GH.harvestHerb(S, 'hb1', ST), f1 = F.farmState(S);
  check('a ripe ginger goes into the basket with what was there, charged the picking energy in the same save', h1.ok && h1.n === 2 && f1.harvest.ginger === 2 && f1.harvest.lemongrass === 5 && f1.harvest.radish === 2 && f1.beds.bed1.crop === 'radish' && ST.value() === e1 - ST.COSTS.harvest);
  var gb = GH.herbState(S).beds.hb1;
  check('after picking, ginger stays and starts again from young: three watered days to pick again', gb.herb === 'ginger' && gb.cuts === 1 && GH.herbDays(gb) === 0 && GH.herbNeed(gb) === 3 && GH.herbStage(gb) === 2 && !GH.harvestHerb(S, 'hb1', ST).ok);
  check('picked on a day she watered, the same day cannot be watered again', !GH.waterHerb(S, 'hb1', '2026-10-29', ST).ok && GH.waterHerb(S, 'hb1', '2026-10-30', ST).ok);
  /* every herb: ripe exactly on its day, then again on its cadence */
  var cad = [];
  GH.HERB_IDS.forEach(function (k) {
    reset(100); GH.buyStart(S, RW, k); GH.plantHerb(S, 'hb2', k, d1, ST); var h = GH.HERBS[k], dd = days(h.ripe + h.regrow);
    for (var i = 0; i < h.ripe; i++) { if (GH.herbRipe(GH.herbState(S).beds.hb2)) cad.push(k + ' ripe early at ' + i); S.setState({ stamina: { v: 100, max: 100, day: (S.state().stamina || {}).day } }); GH.waterHerb(S, 'hb2', dd[i], ST); }
    if (!GH.herbRipe(GH.herbState(S).beds.hb2)) cad.push(k + ' not ripe on day ' + h.ripe);
    var r = GH.harvestHerb(S, 'hb2', ST); if (!r.ok || F.farmState(S).harvest[k] !== h.yield) cad.push(k + ' harvest ' + JSON.stringify(r));
    for (var j = 0; j < h.regrow; j++) { if (GH.herbRipe(GH.herbState(S).beds.hb2)) cad.push(k + ' regrew early'); GH.waterHerb(S, 'hb2', dd[h.ripe + j], ST); }
    if (!GH.herbRipe(GH.herbState(S).beds.hb2)) cad.push(k + ' not ripe again after ' + h.regrow);
  });
  check('each herb ripens on its watered day and not before, and comes back after its regrow days', cad.length === 0, cad.join('; '));
  /* lemongrass: one basket key for the farm's and the greenhouse's */
  S.setState({ farm: { harvest: { lemongrass: 1 }, unlocked: { lemongrass: true }, seeds: { lemongrass: 2 } } });
  GH.buyStart(S, RW, 'lemongrass'); GH.plantHerb(S, 'hb3', 'lemongrass', d1, ST); days(4).forEach(function (d) { GH.waterHerb(S, 'hb3', d, ST); }); GH.harvestHerb(S, 'hb3', ST);
  check('greenhouse lemongrass joins the farm’s lemongrass in the basket, under the same name', F.farmState(S).harvest.lemongrass === 4 && F.CROPS.lemongrass.name === GH.HERBS.lemongrass.name);
  check('a farm that unlocked lemongrass keeps it: its seeds, its packs and its beds', F.canGrow(F.farmState(S), 'lemongrass') && F.farmState(S).seeds.lemongrass === 2 && F.buyPack(S, RW, 'lemongrass').ok && F.farmState(S).seeds.lemongrass === 5);
  S.setState({ farm: null }); var hh = RW.ledger().hearts;
  check('a new farm is not sold lemongrass to unlock any more: it grows in the greenhouse; nothing is charged', !F.unlockCrop(S, RW, 'lemongrass').ok && /greenhouse/.test(F.unlockCrop(S, RW, 'lemongrass').why) && RW.ledger().hearts === hh && F.CROPS.lemongrass.moved === 'greenhouse');
  check('Hay & Harvest lists the four herbs for the greenhouse and no longer offers lemongrass for the farm', /data-herbstart/.test(laneSrc) && /GH\.buyStart\(/.test(laneSrc) && /!FM\.CROPS\[k\]\.moved/.test(laneSrc));
  /* letting a planter go */
  check('a planter can be let go, free, and planted again', GH.clearHerb(S, 'hb3').ok && !GH.herbState(S).beds.hb3 && !GH.clearHerb(S, 'hb3').ok && RW.ledger().hearts === hh);
  /* restored values are cleaned */
  S.setState({ greenhouse: { seeds: { ginger: 2.7, basil: 3, pandan: -1, chamomile: 'lots' }, beds: { hb1: { herb: 'ginger', planted: d1, watered: [d1, 'soon', 7], cuts: -2 }, hb2: { herb: 'basil', planted: d1 }, hb3: { herb: 'pandan', planted: 'today' }, hb9: { herb: 'ginger', planted: d1 } } } });
  var cs = GH.herbState(S);
  check('restored greenhouse values are cleaned: known herbs, whole counts, real dates, known planters only', JSON.stringify(cs.seeds) === '{"ginger":2}' && Object.keys(cs.beds).join() === 'hb1' && cs.beds.hb1.watered.join() === d1 && cs.beds.hb1.cuts === 0 && cs.beds.hb1.last === d1);
  /* no farm or greenhouse action pays hearts */
  reset(100); var hb = RW.ledger().hearts; GH.buyStart(S, RW, 'pandan'); var afterBuy = RW.ledger().hearts;
  GH.plantHerb(S, 'hb4', 'pandan', d1, ST); days(4).forEach(function (d) { GH.waterHerb(S, 'hb4', d, ST); }); GH.harvestHerb(S, 'hb4', ST);
  check('only the start costs hearts; planting, watering and picking never pay or charge any', afterBuy === hb - 4 && RW.ledger().hearts === afterBuy && RW.ledger().earned === 0);
  /* brewing: one from the basket, the flat practice thank-you within the day's cap, no diary entry */
  var n0 = S.list().length, br1 = GH.brewCup(S, RW, 'pandan');
  check('a finished cup uses one from the basket and earns the flat practice thank-you, and no diary entry is written', br1.ok && br1.points === RW.PRACTICE.points && F.farmState(S).harvest.pandan === 2 && RW.ledger().hearts === afterBuy + RW.PRACTICE.points && S.list().length === n0);
  GH.brewCup(S, RW, 'pandan'); GH.brewCup(S, RW, 'pandan');
  var capped = RW.ledger().mindDay.pts;
  check('every cup pays the practice thank-you (three cups, six hearts), and the basket empties to nothing more', capped === 3 * RW.PRACTICE.points && !GH.brewCup(S, RW, 'pandan').ok && !('pandan' in F.farmState(S).harvest) && RW.ledger().hearts === afterBuy + 3 * RW.PRACTICE.points);
  S.setState({ farm: { harvest: { chamomile: 1 } }, rewards: { hearts: 0, earned: 0, log: [], owned: [], placed: {}, mindDay: { day: d1, pts: 4 } } });
  var br2 = GH.brewCup(S, RW, 'chamomile');
  check('a cup counts inside the same daily practice cap as every other practice', br2.ok && br2.points === 2 && RW.ledger().mindDay.pts === 6);
  S.setState({ farm: { harvest: { ginger: 1 } }, rewards: { hearts: 0, earned: 0, log: [], owned: [], placed: {}, dailyLast: '2026-10-25' } });
  var br3 = GH.brewCup(S, RW, 'ginger');
  check('with the clock set back a cup earns nothing, as for any practice, and still uses the herb', br3.ok && br3.points === 0 && RW.ledger().hearts === 0 && !('ginger' in F.farmState(S).harvest));
  check('an empty basket brews nothing; an unknown herb is refused', !GH.brewCup(S, RW, 'ginger').ok && !GH.brewCup(S, RW, 'rose').ok);
  /* a full disk: nothing moves, no hearts go, no energy is charged */
  reset(100); S.setState({ farm: { harvest: { ginger: 2 } }, greenhouse: { seeds: { ginger: 1 }, beds: { hb2: { herb: 'chamomile', planted: d1, watered: days(4), last: S.addDays(d1, 3), cuts: 0 }, hb3: { herb: 'pandan', planted: d1, watered: [], cuts: 0 } } } });
  var snap = JSON.stringify([S.state().farm, S.state().greenhouse, S.state().rewards, S.state().stamina]), realCommit = S.commit;
  S.commit = function () { throw new Error('QuotaExceededError'); };
  var fb = GH.buyStart(S, RW, 'pandan'), fp = GH.plantHerb(S, 'hb1', 'ginger', d1, ST), fw = GH.waterHerb(S, 'hb3', d1, ST), fh = GH.harvestHerb(S, 'hb2', ST), fc = GH.clearHerb(S, 'hb3'), fbr = GH.brewCup(S, RW, 'ginger');
  S.commit = realCommit;
  check('a failed save sells no start, plants, waters, picks, clears and brews nothing, and takes no hearts and no energy', !fb.ok && !fp.ok && !fw.ok && !fh.ok && !fc.ok && !fbr.ok && JSON.stringify([S.state().farm, S.state().greenhouse, S.state().rewards, S.state().stamina]) === snap, JSON.stringify([fb, fp, fw, fh, fc, fbr]));
  S.setState({ stamina: { v: 1, max: 100, day: (S.state().stamina || {}).day } }); var g0 = JSON.stringify(S.state().greenhouse);
  var tired = GH.waterHerb(S, 'hb3', d1, ST);
  check('too tired: nothing is watered and nothing is charged', !tired.ok && tired.tired && JSON.stringify(S.state().greenhouse) === g0 && ST.value() === 1);
  /* the cup: four short lines, a card only where the tea list already has one, no new claims */
  var MO = w.OvuMoments, badL = [];
  GH.HERB_IDS.forEach(function (k) { GH.brewLines(k).forEach(function (l) { if (l.split(/\s+/).length > 18 || /—|–|\b(should|must|goal|score|streak)\b/i.test(l)) badL.push(k + ': ' + l); }); });
  ['herbplant', 'herbwater', 'herbharvest', 'brew'].forEach(function (k) { var m = MO.MOMENTS[k]; if (!m) { badL.push(k + ' missing'); return; } m.lines.forEach(function (l) { if (l.split(/\s+/).length > 18 || /—|–|\b(should|must|goal|score|streak)\b/i.test(l)) badL.push(k + ': ' + l); }); });
  check('the tea minute is four lines (warmth, steam, the first sip) and every herb moment is short, kind and free of em dashes and pressure words', GH.HERB_IDS.every(function (k) { var ls = GH.brewLines(k); return ls.length === 4 && /pour/i.test(ls[0]) && /warmth/i.test(ls[1]) && /steam/i.test(ls[2]) && /first sip/i.test(ls[3]); }) && badL.length === 0, badL.join(' | '));
  var roomSrc = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), poses = /var OUTFIT_POSES = (\{[^}]*\})/.exec(roomSrc)[1];
  check('she does something visible in her own outfit: plant, water, pick and brew each have a pose drawn for every outfit', ['herbplant', 'herbwater', 'herbharvest', 'brew'].every(function (k) { var ps = MO.pose(k); return ps && new RegExp('\\b' + ps + ': 1').test(poses) && ['sundress', 'cozy', 'tudung'].every(function (o) { return fs.existsSync(path.join(root, 'assets/room/dream', 'avatar-act-' + ps + '-' + o + '.webp')); }); }));
  var teaIds = HB.TEAS.map(function (t) { return t.id; });
  check('ginger and chamomile link to their existing research cards; lemongrass and pandan have none, and the tea list is unchanged', GH.HERBS.ginger.tea === 'ginger' && GH.HERBS.chamomile.tea === 'chamomile' && teaIds.indexOf('ginger') > -1 && teaIds.indexOf('chamomile') > -1 && GH.HERBS.lemongrass.tea === null && GH.HERBS.pandan.tea === null && teaIds.indexOf('lemongrass') < 0 && teaIds.indexOf('pandan') < 0 && !!GH.plant('ginger') && !!GH.plant('chamomile'));
  var herbSrc = src.slice(src.indexOf('the herb beds (21 Oct'), src.indexOf('var GH = {')) + src.slice(src.indexOf('function startBrew'), src.indexOf('function stepAside')) + src.slice(src.indexOf('function finishBrew'), src.indexOf('R.hotspotHandlers.ghdoor'));
  check('the herb code pays no hearts but the practice thank-you, spends only on a start, and writes no diary entry', herbSrc.length > 3000 && !/\.award\(|\.grant\(|\bS\.add\(|OvuStore\.add\(|addMany\(/.test(herbSrc) && (herbSrc.match(/\.spend\(/g) || []).length === 1 && /RW\.thank\(/.test(herbSrc) && !/—/.test(herbSrc.replace(/\/\*[\s\S]*?\*\//g, '')));
  var rwSrc = fs.readFileSync(path.join(root, 'ovu-rewards.js'), 'utf8');
  check('the thank-you for a practice with no entry runs the same practicePoints as every practice', /function thank\(what, patch\) \{\s*var l = [^\n]*practicePoints\(l, /.test(rwSrc));
  var svgOk = [0, 1, 2, 3].every(function (st) { var b = st ? { herb: 'chamomile', watered: days(st === 3 ? 4 : st), cuts: 0, last: d1 } : null; return /^<svg[\s\S]*<\/svg>$/.test(GH.herbSVG(b, d1)); });
  reset(100); S.setState({ greenhouse: { seeds: { ginger: 99 }, beds: { hb1: { herb: 'lemongrass', planted: d1, watered: days(4), last: S.addDays(d1, 3), cuts: 0 } } }, farm: { harvest: { lemongrass: 120 } } });
  var full0 = RW.ledger().hearts, fullBuy = GH.buyStart(S, RW, 'ginger'), e2 = ST.value(), fullPick = GH.harvestHerb(S, 'hb1', ST);
  check('a full bag is not sold another start, and a full basket is not picked into: nothing paid, nothing charged, the farm’s count kept', !fullBuy.ok && RW.ledger().hearts === full0 && GH.herbState(S).seeds.ginger === 99 && !fullPick.ok && F.farmState(S).harvest.lemongrass === 120 && ST.value() === e2 && GH.herbRipe(GH.herbState(S).beds.hb1));
  S.setState({ greenhouse: { seeds: { ginger: 99 }, beds: {} } });
  var fullFree = GH.freeStart(S, 'ginger', d1);
  check('a full bag is not given the free start either, and the free start stays unclaimed for later (collation re-check)', !fullFree.ok && GH.freeStartOpen(S) && GH.herbState(S).seeds.ginger === 99);
  var brewLine = /<p class="mindline"><span class="ms">local_cafe<\/span><span>([^<]+)<\/span>/.exec(src);
  check('the cup’s own sheet line is short and free of em dashes too', !!brewLine && brewLine[1].split(/\s+/).length <= 18 && !/—/.test(brewLine[1]), brewLine && brewLine[1]);
  /* the first start is free, once (Jamie, 21 Oct) */
  reset(0);
  check('a new player has one free start waiting', GH.freeStartOpen(S));
  var fr1 = GH.freeStart(S, 'chamomile', d1);
  check('the free start gives one herb of her choice with no hearts, and is remembered', fr1.ok && GH.herbState(S).seeds.chamomile === 1 && RW.ledger().hearts === 0 && !GH.freeStartOpen(S) && GH.herbState(S).free.herb === 'chamomile');
  check('it cannot be claimed twice, on the same day or with the clock set back', !GH.freeStart(S, 'ginger', d1).ok && !GH.freeStart(S, 'ginger', '2026-01-01').ok && !GH.herbState(S).seeds.ginger);
  GH.plantHerb(S, 'hb1', 'chamomile', d1, ST); GH.waterHerb(S, 'hb1', d1, ST);
  check('the claim survives every later greenhouse save', !GH.freeStartOpen(S));
  S.setState({ greenhouse: { seeds: {}, beds: {}, free: 'yes please' } });
  check('a restored claim with a malformed value stays claimed, never reopened', !GH.freeStartOpen(S) && !GH.freeStart(S, 'ginger', d1).ok);
  S.setState({ greenhouse: null }); var rc = S.commit;
  S.commit = function () { throw new Error('QuotaExceededError'); }; var frF = GH.freeStart(S, 'ginger', d1); S.commit = rc;
  check('a failed save gives no start and keeps the free start open', !frF.ok && GH.freeStartOpen(S) && !GH.herbState(S).seeds.ginger);
  check('the grocer offers the free start first, then the prices', /GH\.freeStartOpen\(S\) \? GH\.freeStart\(/.test(laneSrc));
  /* the seed swap with herbs (Jamie, 21 Oct): three of a herb or a crop for a seed or a start, no hearts, one save */
  reset(50); S.setState({ farm: { harvest: { ginger: 3, radish: 3, lemongrass: 3, chamomile: 2, pumpkin: 1 } } });
  check('herbs with three in the basket count at the swap beside the crops; two are not enough', GH.swapGivableAll(S).sort().join() === 'ginger,lemongrass,pumpkin,radish' && GH.swapNeedAny('ginger') === 3 && GH.swapNeedAny('pumpkin') === 1);
  check('she can take a seed of a crop she grows or a start of any herb, lemongrass as a herb', GH.swapTakeable(S).indexOf('carrot') > -1 && GH.swapTakeable(S).indexOf('kangkong') < 0 && ['ginger', 'lemongrass', 'pandan', 'chamomile'].every(function (k) { return GH.swapTakeable(S).indexOf(k) > -1; }));
  var sa = GH.swapAny(S, 'ginger', 'carrot');
  check('three ginger for a carrot seed: the basket and the shed move together, no hearts', sa.ok && sa.gave === 3 && !('ginger' in F.farmState(S).harvest) && F.farmState(S).seeds.carrot === 1 && RW.ledger().hearts === 50);
  var sb = GH.swapAny(S, 'radish', 'pandan');
  check('three radishes for a pandan start: it goes to the greenhouse bag', sb.ok && sb.herb && GH.herbState(S).seeds.pandan === 1 && !('radish' in F.farmState(S).harvest) && RW.ledger().hearts === 50);
  var sc = GH.swapAny(S, 'lemongrass', 'lemongrass');
  check('three lemongrass for a lemongrass start for the planters', sc.ok && GH.herbState(S).seeds.lemongrass === 1 && !('lemongrass' in F.farmState(S).harvest));
  var sw0 = JSON.stringify([S.state().farm, S.state().greenhouse]);
  check('too few, a crop she cannot grow, or an unknown kind: refused, nothing moves', !GH.swapAny(S, 'chamomile', 'ginger').ok && !GH.swapAny(S, 'pumpkin', 'kangkong').ok && !GH.swapAny(S, 'basil', 'ginger').ok && !GH.swapAny(S, 'pumpkin', 'basil').ok && JSON.stringify([S.state().farm, S.state().greenhouse]) === sw0);
  S.commit = function () { throw new Error('QuotaExceededError'); }; var sF = GH.swapAny(S, 'pumpkin', 'ginger'); S.commit = rc;
  check('a failed save swaps nothing: the pumpkin stays and no start is given', !sF.ok && JSON.stringify([S.state().farm, S.state().greenhouse]) === sw0);
  var sp = GH.swapAny(S, 'pumpkin', 'ginger');
  check('a pumpkin still counts as three, now for a herb start too', sp.ok && sp.gave === 1 && GH.herbState(S).seeds.ginger === 1 && RW.ledger().hearts === 50);
  check('the grocer swaps through the one-save herb swap', /GH \? GH\.swapAny\(S, giving, b\.dataset\.take\)/.test(laneSrc));
  check('each planter draws as an SVG at every stage, darker soil when watered today', svgOk && GH.herbSVG({ herb: 'ginger', watered: [d1], cuts: 0, last: d1 }, d1).indexOf('#4f3828') > -1 && GH.herbSVG({ herb: 'ginger', watered: [d1], cuts: 0, last: d1 }, '2026-10-22').indexOf('#4f3828') < 0);
})();

(function twoTabsShareOneStore() {
  console.log('two tabs on one phone (21 Oct): a tab that missed the other\'s saves never writes its stale copy over them');
  /* two windows over one localStorage, as two tabs are; the shim has no storage event, so tab A stays stale the way a
     tab asleep in the background, or one whose event is still on its way, does */
  function tabs(day) {
    var a = fresh(day), b = fresh(day); b.localStorage = a.localStorage;
    [a, b].forEach(function (w) { w.OVU_CONFIG = Object.assign({}, w.OVU_CONFIG, { aiPaused: false }); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8'), w, { filename: 'ovu-consent.js' }); w.OvuStore.load(true); });
    return { a: a, b: b, A: a.OvuStore, B: b.OvuStore };
  }
  function reread(t) { var c = fresh(t.a.OvuStore.today()); c.localStorage = t.a.localStorage; vm.runInContext(fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8'), c, { filename: 'ovu-consent.js' }); c.OvuStore.load(true); return c; }
  var day = '2026-10-21', t = tabs(day), A = t.A, B = t.B;
  var gone = A.add('reflection', day, { text: 'to delete in B' }), edited = A.add('reflection', day, { text: 'first words' });
  A.list(null); B.load(true); /* both tabs open on the same diary */
  /* tab B: a diary entry, a consent change, a game-state change, an edit and a delete */
  var bNote = B.add('reflection', day, { text: 'written in tab B' });
  t.b.OvuConsent.grant('cloud_sync', 'you');
  B.commit({ farm: { plots: ['mint'], guided: true } });
  B.update(edited.id, { data: { text: 'edited in tab B' } });
  B.remove(gone.id);
  /* tab A, still holding the copy it loaded, saves something else */
  A.add('mindfulness', day, { activity: 'breathe', seconds: 60 });
  A.commit({ stamina: { v: 3, max: 5 } });
  var c = reread(t), C = c.OvuStore;
  check('tab B\'s diary entry survives tab A\'s later save', !!C.get(bNote.id), JSON.stringify(C.list('reflection').map(function (e) { return e.data.text; })));
  check('tab B\'s consent event survives, and its choice is the one in force', c.OvuConsent.events().some(function (e) { return e.purpose === 'cloud_sync' && e.action === 'grant'; }) && c.OvuConsent.allows('cloud_sync') && C.profile().cloud && C.profile().cloud.v === 1);
  check('tab B\'s game state survives next to tab A\'s', JSON.stringify(C.state().farm) === JSON.stringify({ plots: ['mint'], guided: true }) && C.state().stamina && C.state().stamina.v === 3);
  check('tab B\'s edit survives', C.get(edited.id) && C.get(edited.id).data.text === 'edited in tab B');
  check('the entry tab B deleted stays deleted', !C.get(gone.id));
  check('tab A\'s own save landed', C.list('mindfulness').length === 1);
  check('tab A now shows tab B\'s changes too', !!A.get(bNote.id) && !A.get(gone.id) && A.state().farm && A.get(edited.id).data.text === 'edited in tab B');

  /* deletes both ways, and an edit to an entry the other tab deleted */
  var t2 = tabs(day), A2 = t2.A, B2 = t2.B;
  var x = A2.add('reflection', day, { text: 'x' }), y = A2.add('reflection', day, { text: 'y' }), z = A2.add('reflection', day, { text: 'z' });
  A2.list(null); B2.load(true);
  B2.remove(x.id); B2.update(z.id, { data: { text: 'z edited in B' } }); var v = B2.add('reflection', day, { text: 'v from B' });
  var threw = null; try { A2.update(x.id, { data: { text: 'x edited in stale A' } }); } catch (e) { threw = e.message; }
  check('editing in tab A an entry tab B deleted says it no longer exists, and does not bring it back', threw === 'That entry no longer exists.' && !reread(t2).OvuStore.get(x.id), threw);
  A2.remove(z.id); A2.remove(y.id);
  var C2 = reread(t2).OvuStore;
  check('tab A\'s deletes land and tab B\'s new entry stays', !C2.get(y.id) && !C2.get(z.id) && !!C2.get(v.id) && C2.list('reflection').length === 1, JSON.stringify(C2.list('reflection').map(function (e) { return e.data.text; })));
  B2.add('reflection', day, { text: 'from B, after A deleted' });
  check('tab B\'s next save does not bring back what tab A deleted', !reread(t2).OvuStore.get(y.id) && !reread(t2).OvuStore.get(z.id) && reread(t2).OvuStore.list('reflection').length === 2);

  /* consent order: the later choice is in force, whichever tab made it */
  var t3 = tabs(day), CA = t3.a.OvuConsent, CB = t3.b.OvuConsent;
  CA.grant('cloud_sync', 'you'); t3.B.load(true);
  CB.withdraw('cloud_sync', 'you');
  CA.grant('improve_logging', 'you'); /* tab A still thinks backup is on */
  var c3 = reread(t3);
  check('a withdrawal in tab B is not undone by tab A\'s next choice; both events are kept, in the order they were made', !c3.OvuConsent.allows('cloud_sync') && c3.OvuConsent.allows('improve_logging') && c3.OvuConsent.events().map(function (e) { return e.purpose + ':' + e.action; }).join() === 'cloud_sync:grant,cloud_sync:withdraw,improve_logging:grant' && c3.OvuStore.profile().cloud.v === 0, JSON.stringify(c3.OvuConsent.events().map(function (e) { return e.purpose + ':' + e.action; })));
  CB.grant('cloud_sync', 'you'); CA.withdraw('cloud_sync', 'you');
  var c3b = reread(t3);
  check('a withdrawal in tab A after a grant in tab B is the one in force, and the cloud flag follows it', !c3b.OvuConsent.allows('cloud_sync') && c3b.OvuStore.profile().cloud.v === 0 && c3b.OvuConsent.events().length === 5);

  /* a save that fails leaves memory as it was, and loses nothing already stored */
  var t4 = tabs(day), A4 = t4.A, B4 = t4.B, ls = t4.a.localStorage, realSet = ls.setItem;
  A4.list(null); B4.load(true);
  var b4 = B4.add('reflection', day, { text: 'B before A fails' }); B4.commit({ farm: { plots: ['basil'] } });
  var before = JSON.stringify(A4.state()), threw4 = false;
  ls.setItem = function () { throw new Error('storage full'); };
  try { A4.commit({ hearts: 99 }); } catch (e) { threw4 = true; }
  ls.setItem = realSet;
  check('a commit that fails in a stale tab leaves its state exactly as it was', threw4 && JSON.stringify(A4.state()) === before);
  ls.setItem = function () { throw new Error('storage full'); };
  var threw5 = false; try { A4.add('reflection', day, { text: 'A fails' }); } catch (e) { threw5 = true; }
  ls.setItem = realSet;
  var C4 = reread(t4).OvuStore;
  check('a failed add in a stale tab is in neither memory nor storage, and tab B\'s saves are still stored', threw5 && !A4.list('reflection').some(function (e) { return e.data.text === 'A fails'; }) && !!C4.get(b4.id) && (C4.state().farm || {}).plots && C4.state().farm.plots[0] === 'basil' && C4.state().hearts === undefined);
  A4.commit({ hearts: 99 });
  var C4b = reread(t4).OvuStore;
  check('the retry lands whole and keeps tab B\'s saves', C4b.state().hearts === 99 && (C4b.state().farm || {}).plots && C4b.state().farm.plots[0] === 'basil' && !!C4b.get(b4.id));

  /* one entry a day stays one entry; a change made straight on the live copy is kept; Delete everything is whole */
  var t5 = tabs(day), A5 = t5.A, B5 = t5.B;
  A5.list(null); B5.load(true);
  B5.add('period', day, { flow: 'medium', clots: false, impact: false });
  A5.add('period', day, { flow: 'heavy', clots: false, impact: false });
  check('a period day logged in both tabs is still one entry, the later one', reread(t5).OvuStore.list('period').length === 1 && reread(t5).OvuStore.list('period')[0].data.flow === 'heavy');
  B5.add('reflection', day, { text: 'B' });
  A5.load().summaries.push({ range: { to: day } }); A5.setState({ lastSummaryAt: 'now' }); /* how saveMonthlySummary writes */
  var C5 = reread(t5).OvuStore;
  check('a summary pushed straight onto the live copy is saved beside tab B\'s entry', C5.load().summaries.length === 1 && C5.list('reflection').length === 1);
  B5.add('reflection', day, { text: 'B again' });
  A5.clearAll();
  check('Delete everything in one tab clears what the other tab had just saved', reread(t5).OvuStore.list(null).length === 0);
  B5.add('reflection', day, { text: 'after the wipe' });
  check('the other tab\'s next save does not bring the wiped diary back', reread(t5).OvuStore.list(null).length === 1);

  /* adversarial review (21 Oct): a read then a commit builds on the current copy; a failed consent save is not kept to
     land later; the backup records only this tab's own deletes */
  var t6 = tabs(day), A6 = t6.A, B6 = t6.B;
  A6.commit({ rewards: { hearts: 20 }, farm: { plots: [] } }); B6.load(true);
  var bf = JSON.parse(JSON.stringify(B6.state().farm)); bf.plots.push('mint'); B6.commit({ rewards: { hearts: 10 }, farm: bf }); /* tab B buys seeds */
  var af = JSON.parse(JSON.stringify(A6.state().farm)); af.watered = true; A6.commit({ farm: af }); /* tab A reads its farm and waters */
  var C6 = reread(t6).OvuStore;
  check('a stale tab that reads its farm and commits a change builds on the other tab\'s purchase: hearts and seeds stay together', C6.state().rewards.hearts === 10 && JSON.stringify(C6.state().farm) === JSON.stringify({ plots: ['mint'], watered: true }), JSON.stringify(C6.state()));
  var t7 = tabs(day), ls7 = t7.a.localStorage, real7 = ls7.setItem;
  t7.a.OvuConsent.grant('health_tracking', 'sheet'); t7.B.load(true);
  ls7.setItem = function () { throw new Error('storage full'); };
  var threw7 = false; try { t7.a.OvuConsent.grant('cloud_sync', 'you'); } catch (e) { threw7 = true; }
  ls7.setItem = real7;
  check('a consent choice whose save failed is not kept in memory', threw7 && !t7.a.OvuConsent.events().some(function (e) { return e.purpose === 'cloud_sync'; }));
  t7.b.OvuConsent.grant('cloud_sync', 'you'); t7.b.OvuConsent.withdraw('cloud_sync', 'you'); t7.A.setState({ foo: 1 });
  var c7 = reread(t7);
  check('so it never lands after a newer withdrawal made in the other tab', !c7.OvuConsent.allows('cloud_sync') && c7.OvuStore.profile().cloud.v === 0);
  var t8 = tabs(day), A8 = t8.A, B8 = t8.B; t8.a.OvuSync.init();
  for (var i8 = 0; i8 < 5; i8++) A8.add('reflection', day, { text: 'n' + i8 });
  B8.load(true); B8.clearAll(); var x8 = B8.add('reflection', day, { text: 'after the wipe' }); /* a page without the sync script */
  A8.remove(x8.id);
  check('a delete in a stale tab after another tab\'s Delete everything sends no tombstones for the wiped entries', Object.keys(JSON.parse(t8.a.localStorage.getItem('ovumind_sync_v1')).tombstones).length <= 1, t8.a.localStorage.getItem('ovumind_sync_v1').slice(0, 200));
})();

(function personaWalkSafety() {
  console.log('2k7b. persona walks (21 Oct): postnatal warning signs, reflections read, the card shared with the journal');
  var w = fresh('2026-10-21'), O = w.OvuOrb, S = w.OvuStore, post = { pregState: 'postpartum' }, preg = { pregState: 'pregnant' };
  function code(t, p) { var u = O.urgent(t, p || {}); return u ? u.code : null; }
  check('a pad full every hour is heavy bleeding now, with or without a baby', code('my pad is full every hour since this morning', post) === 'HEAVY_BLEED_NOW' && code('pad full every hour today') === 'HEAVY_BLEED_NOW');
  check('after a birth: a fever alone needs advice today; with no baby and no other sign, a fever still raises nothing new', code('fever 38.2 this afternoon', post) === 'FEVER_BABY_TODAY' && code('fever 38.2 this afternoon', preg) === 'FEVER_BABY_TODAY' && code('fever 38.2 this afternoon') === null);
  check('after a birth: a red, hot or lumpy breast is checked today; sore breasts in pregnancy or before a period are not a card', code('my left breast is red and hot', post) === 'BREAST_TODAY' && code('breasts a bit sore this week', preg) === null && code('sore breasts, period due soon') === null);
  check('after a birth: stitches that opened or a wound getting worse is checked today', code('I think my stitches opened, it hurts more', post) === 'WOUND_TODAY' && code('the c-section wound is oozing and smells', post) === 'WOUND_TODAY' && code('stitches feel fine, healing well', post) === null);
  check('in pregnancy or after a birth one sore calf is checked today; a cramp after a walk is not', code('my left calf hurts', post) === 'LEG_CLOT_TODAY' && code('calf is swollen and tender', preg) === 'LEG_CLOT_TODAY' && code('calf cramp after my walk', post) === null && code('my left calf hurts') === null);
  check('in pregnancy or after a birth fainting is urgent now; a faint years ago is not', code('I fainted in the kitchen this morning', post) === 'FAINT_PREG_NOW' && code('passed out at lunch', preg) === 'FAINT_PREG_NOW' && code('I fainted once years ago', post) === null);
  check('after a birth: confusion, no sleep and unusual energy together are urgent now; tired and confused alone is not', code('so confused, haven\'t slept in two days and I have so much energy', post) === 'PSYCHOSIS_NOW' && code('so tired and confused, haven\'t slept properly', post) === null, JSON.stringify([code('so confused, haven\'t slept in two days and I have so much energy', post), code('so tired and confused, haven\'t slept properly', post)]));
  var ev = S.add('reflection', S.today(), { text: 'I want to die', mood: 'low' }, 'room'), u = O.entryUrgent(ev, S.profile());
  check('a journal reflection is read for safety: "I want to die" raises the self-harm card', !!u && u.code === 'SELF_HARM_NOW', JSON.stringify(u));
  var html = O.careHTML(u);
  check('the journal gets the same care card as the room: its words and the helpline link, escaped, with no country-specific number', /Please get help now/.test(html) && /findahelpline\.com/.test(html) && !/tel:995|1767/.test(html) && html.indexOf('<script') < 0);
  var html2 = O.careHTML({ level: 'emergency', code: 'X', title: 'Get <b>care</b>', trigger: 'a <img src=x> test' });
  check('the shared card escapes what it is given', html2.indexOf('<img') < 0 && html2.indexOf('&lt;img') > -1);
  /* the earlier rules still hold: the 95 model-written notes are checked in their own block */
  check('pregnancy in the profile with bleeding is still emergency care, and a period note with no profile is not', code('some bleeding today and cramps', preg) === 'PREG_BLEED_NOW' && code('period started, some bleeding and cramps') === null);
})();
(function morningSkipTime() {
  console.log('2k8. Morning start: a skipped part books its time on the line she was on, never on the part after');
  var src = fs.readFileSync(path.join(root, 'ovu-morning.js'), 'utf8');
  var sp = src.slice(src.indexOf('function skipPart()'), src.indexOf('function stop()'));
  check('skipPart and skipGate call leaveStep before the index moves', /leaveStep\(\);[\s\S]*run\.i = groupEnd/.test(sp) && /function skipGate\(\) \{[\s\S]{0,120}leaveStep\(\);/.test(src));
  check('the run keeps one completion map (no done:false after done:{})', !/done: \{\}[^\n]*done: false/.test(src));
})();
(function diaryOwner() {
  console.log('2k9. a diary belongs to one account on this phone (persona walks, 21 Oct)');
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  var body = src.slice(src.indexOf('function diaryOwner()'), src.indexOf('function afterSignIn()'));
  var ctx = vm.createContext({ profile: {}, set: null });
  vm.runInContext('var S = { profile: function () { return profile; }, setProfile: function (p) { Object.assign(profile, p); set = p; } }; var window = {}; function $() { return null; } function closeSheet() {} function resetWallForm() {} function showWelcome() {}\n' + body, ctx);
  function run(p, uid) { ctx.profile = p; ctx.set = null; ctx.window.OvuAuth = { isSignedIn: function () { return true; }, userId: function () { return uid; }, signOut: function () {} }; return vm.runInContext('ownerOk()', ctx); }
  check('an unowned diary is adopted by the account that signs in', run({}, 'a') === true && ctx.profile.owner === 'a');
  check('the owner signs in: open; another account: refused', run({ owner: 'a' }, 'a') === true && run({ owner: 'a' }, 'b') === false);
  check('a diary from before owners is bound by its backup or its consent receipts', run({ cloud: { uid: 'a' } }, 'b') === false && run({ consentEvents: [{ purpose: 'health_tracking', uid: 'a' }] }, 'b') === false && run({ cloud: { uid: 'a' } }, 'a') === true);
  check('after Delete my account (owner empty) the next account adopts it', run({ owner: '', cloud: { uid: 'a' } }, 'b') === true && ctx.profile.owner === 'b');
})();


(function laneReviewFixes() {
  console.log('2k13. the Codex lane review (21 Oct): accounts, the sample diary, outfits, warning signs in her words, parts and practice time');
  function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
  var w = fresh('2026-10-21'), O = w.OvuOrb, S = w.OvuStore;
  function code(t, p) { var u = O.urgent(t, p || {}); return u ? u.code : null; }
  var pp = { pregState: 'postpartum' }, preg = { pregState: 'pregnant' };
  check('a symptom now survives history and worry: since before breakfast, chest pain now after a history, not worried about a fever', code('Pad full every hour since before breakfast') === 'HEAVY_BLEED_NOW' && code('History of asthma, chest pain now') === 'CHEST_BREATH_NOW' && code('not worried about the chest pain') === 'CHEST_BREATH_NOW' && code('I am not worried about my fever', pp) === 'FEVER_BABY_TODAY' && code('chest pain last year, fine now') === null && code('I am not worried, just tired') === null);
  var f40 = O.urgent('My temperature is 40°C', pp);
  check('40°C after a birth is a fever and means advice now; 37.5 is not a fever', !!f40 && f40.code === 'FEVER_BABY_TODAY' && f40.level === 'emergency' && code('temp 38.5 this morning', preg) === 'FEVER_BABY_TODAY' && code('My temperature is 37.5', pp) === null);
  check('one swollen leg is checked today, even after a walk or with a cramp; a twisted ankle is not a clot', code('One calf swollen after walking') === 'LEG_CLOT_TODAY' && code('My left leg is swollen, probably a cramp') === 'LEG_CLOT_TODAY' && code('My ankle is swollen after I twisted it') === null);
  check('maternal warning signs in her own words: pengsan, keep fainting, blurred vision, the baby moving less, leaking fluid, nothing staying down, a smelly discharge, egg-sized clots', code('I went pengsan at the market', preg) === 'FAINT_PREG_NOW' && code('I keep fainting', preg) === 'FAINT_PREG_NOW' && code('My vision is blurry', preg) === 'VISION_PREG_NOW' && code('Baby moving less than usual today', preg) === 'MOVES_NOW' && code('the baby hasn\'t moved since this morning', preg) === 'MOVES_NOW' && code('Leaking fluid from down there', preg) === 'WATERS_NOW' && code('I can\'t keep water down', preg) === 'VOMIT_TODAY' && code('Smelly discharge since yesterday', pp) === 'FOUL_DISCHARGE_TODAY' && code('Passed egg-sized clots this morning', pp) === 'CLOTS_PP_NOW');
  check('postpartum psychosis in the words people use: never felt better, feel high', code('no sleep, racing thoughts and never felt better', pp) === 'PSYCHOSIS_NOW' && code('Not slept for three days, feel high, thoughts racing', pp) === 'PSYCHOSIS_NOW');
  check('a baby\'s fever gets the baby\'s card; 38 weeks, a room temperature or "no fever" do not', code('my newborn has a fever', pp) === 'BABY_FEVER_NOW' && code('baby\'s temperature is 38.2', pp) === 'BABY_FEVER_NOW' && code('baby kicking a lot at 38 weeks', preg) === null && code('the baby\'s room temperature is fine', pp) === null && code('my baby has no fever', pp) === null);
  check('a red boob, an opened tear and stitches that came out are checked; healed stitches are not', code('red boob and it hurts', pp) === 'BREAST_TODAY' && code('my tear opened', pp) === 'WOUND_TODAY' && code('stitches came out', pp) === 'WOUND_TODAY' && code('my stitches have healed nicely', pp) === null);
  check('a blood test is not bleeding, sleeping on one side is not one-sided pain, and brown discharge in pregnancy is bleeding', code('blood test tomorrow', preg) === null && code('My period is late and I have a blood test tomorrow') === null && code('I sleep on one side', preg) === null && code('I lie on my left side to sleep', preg) === null && code('Pain in my tummy, only one side', preg) === 'ECTOPIC_NOW' && code('brown discharge today', preg) === 'PREG_BLEED_NOW' && code('brown discharge before my period, as usual') === null);
  var ub = O.urgent('blood in my urine', {});
  check('blood in the urine asks for an urgent GP appointment, not one this week', !!ub && /urgent GP or clinic appointment/.test(ub.message) && !/this week/.test(ub.message));
  S.setProfile({ pregState: 'pregnant' });
  var u1 = O.entryUrgent(S.add('period', S.today(), { flow: 'light' }, 'room'), S.profile()), u2 = O.entryUrgent(S.add('symptom', S.today(), { symptoms: ['spotting'] }, 'room'), S.profile());
  check('a tapped light flow or the spotting chip in pregnancy gets the same card as the words in a note', !!u1 && u1.code === 'PREG_BLEED_NOW' && !!u2 && u2.code === 'PREG_BLEED_NOW', JSON.stringify([u1 && u1.code, u2 && u2.code]));
  /* the clinician's sample diary never reads the real one, even when another tab writes during it */
  var w2 = fresh('2026-10-21'), S2 = w2.OvuStore, ls2 = w2.localStorage;
  S2.add('reflection', S2.today(), { text: 'the real diary' }, 'room');
  var seen = S2.sandbox({ events: [], profile: {} }, function () { ls2.setItem('ovumind_db_rev', 'another-tab-wrote'); return S2.list('reflection').length; });
  check('the sample diary stays the sample while another tab writes', seen === 0 && S2.list('reflection').length === 1);
  /* a backup brings a diary, never an account */
  var w3 = fresh('2026-10-21'), S3 = w3.OvuStore;
  S3.setProfile({ owner: 'uid-a', cloud: { uid: 'uid-a' }, consentEvents: [{ purpose: 'health_tracking', uid: 'uid-a' }] });
  var backup = JSON.parse(S3.exportJSON()); backup.profile.owner = 'uid-old'; backup.profile.cloud = { uid: 'uid-old' }; backup.profile.consentEvents = []; backup.profile.periodLength = 6;
  S3.importJSON(JSON.stringify(backup), 'merge'); var pr = S3.profile();
  var mergeOk = pr.owner === 'uid-a' && pr.cloud.uid === 'uid-a' && pr.consentEvents.length === 1 && pr.periodLength === 6;
  S3.importJSON(JSON.stringify(backup), 'replace'); pr = S3.profile();
  check('importing a backup keeps this phone\'s owner, cloud binding and consent, merged or replaced, and still brings the diary\'s settings', mergeOk && pr.owner === 'uid-a' && pr.cloud.uid === 'uid-a' && pr.consentEvents.length === 1 && pr.periodLength === 6);
  var w3b = fresh('2026-10-21'), S3b = w3b.OvuStore; S3b.importJSON(JSON.stringify(backup), 'merge');
  check('on a fresh phone an old backup brings no account at all, so the signed-in account adopts the diary', S3b.profile().owner === undefined && S3b.profile().cloud === undefined);
  /* accounts at start, in backups and on the privacy page */
  var rs = read('room.js'), sy = read('ovu-sync.js'), pl = read('privacy-local.js'), au = read('ovu-auth.js');
  check('a phone already signed in to another account meets the wall at start, before the room shows anything', /else if \(OvuAuth\.isSignedIn\(\) && !ownerOk\(\)\) wrongAccount\(\);/.test(rs));
  check('a diary never backs up to an account that does not own it', /ownerFits\(S\.profile\(\), s\.user\.id\) && consentForUser/.test(sy));
  check('the privacy page checks the account again before export and delete, and when the session or diary changes elsewhere', /exportButton\.addEventListener\('click', function \(\) \{\n      if \(!allowed\(\)\) \{ lock\(\); return; \}/.test(pl) && /if \(!allowed\(\)\) \{ closeReview\(\); lock\(\); return; \}/.test(pl) && /e\.key === 'ovumind_auth_v1' \|\| e\.key === 'ovumind_db_v1'\) && !allowed\(\)\) lock\(\)/.test(pl) && /if \(ej\) ej\.value = ''/.test(pl));
  check('signing out forgets the session on this phone at once, before the network answers', /if \(s\) \{ try \{ localStorage\.removeItem\(AUTH_LS\); \}/.test(au));
  /* an outfit name from a backup never becomes markup */
  var sit = ['ovu-seats.js', 'ovu-tones.js', 'ovu-barn.js', 'ovu-harbour.js', 'ovu-garden.js'].filter(function (f) { return !/\/\^\[a-z0-9-\]\{1,32\}\$\/\.test\(/.test(read(f)); });
  check('every sitter checks the outfit name against a plain pattern before building its picture', sit.length === 0, sit.join());
  /* practice time and Morning start parts */
  var w5 = fresh('2026-10-21'); vm.runInContext(read('ovu-mindful.js'), w5, { filename: 'ovu-mindful.js' });
  var r45 = w5.OvuMindful.complete('teeth', 0, 45, true, false), r240 = w5.OvuMindful.complete('teeth', 0, 240, true, true);
  check('a practice saves the time she practised, not a rounded-up minute, and a stop says it was not finished', !!r45 && r45.event.data.minutes === 0.8 && r45.event.data.completed === false && r240.event.data.minutes === 4 && r240.event.data.completed === true, JSON.stringify(r45 && r45.event.data));
  var mm = read('ovu-morning.js');
  check('Morning start: skipping the last part ends cleanly, Next through a line means that part was not finished, and a failed save keeps the parts already saved', /var r0 = run; run\.skipping = true; run\.i = groupEnd\(s\.group\); next\(false\); if \(run === r0\) run\.skipping = false;/.test(mm) && /!\(run\.nexted && run\.nexted\[cur\.group\]\)/.test(mm) && /if \(r\.savedIdx\[i\]\) return;/.test(mm));
  check('a practice cannot be walked out of: a tap elsewhere asks her to finish or stop first', /if \(practice\) \{ if \(h\.id === 'bed'\)/.test(rs));
  check('a menopause No or Not sure is kept and never overridden by age', /menoStatus: A\.menoStatus \|\| ''/.test(rs) && /A\.menoStatus !== 'no' && A\.menoStatus !== 'unsure'/.test(rs));
  check('with periods paused the calendar asks for the bleeding itself and promises no filled-in days', /Nothing is filled in while your periods are paused\.' : 'Tap the first day of your last period/.test(rs));
  var jr = read('journal.html');
  check('the journal\'s care card can be closed and goes with the reflection it was about', /id="rfCareClose"/.test(jr) && /cc\.dataset\.ev&&!S\.get\(cc\.dataset\.ev\)/.test(jr));
  check('mixed nights are labelled as mixed, in the journal and for the doctor', /sum\.sleep\.mixed\?'Sleep and bed to wake'/.test(jr) && /sl\.mixed\?'Average, mixed measured and bedtime to waking'/.test(read('doctor.html')));
})();

(function gameMusic() {
  console.log('2k14. game music (21 Oct): opt in, one decide(), a 32-bar form in D over diatonic chords, media tracked by events');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-harbour.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-music.js'), 'utf8'), w, { filename: 'ovu-music.js' });
  var M = w.OvuMusic, src = fs.readFileSync(path.join(root, 'ovu-music.js'), 'utf8');
  /* every real layout has a theme, the cave alone has none, and an unknown id falls back to the home tune */
  var ids = Object.keys(w.LAYOUTS).concat(['farm', 'barn', 'barninside', 'heninside', 'harbour', 'cave']);
  var themes = {}; ids.forEach(function (id) { themes[id] = M.themeFor(w.LAYOUTS[id] || id); });
  var noTheme = ids.filter(function (id) { return !themes[id]; });
  check('every layout maps to a theme, the cave to its own ambient spring (22 Oct); the Dream Street shops keep the street\'s tune; an unknown id takes the home tune', noTheme.length === 0 && themes.cave === 'cave' && themes.room === 'home' && themes['shop-pet'] === 'street' && themes['shop-homes'] === 'street' && themes.garden === 'garden' && themes.greenhouse === 'garden' && themes.farm === 'farm' && themes.plaza === 'plaza' && themes.harbour === 'harbour' && M.themeFor({ id: 'nowhere' }) === 'home' && M.themeFor(null) === 'home', JSON.stringify(themes));
  check('bands follow the window: sunrise and morning bright, afternoon as written, sunset evening, the dark window evening until 21:00 then night, and the small hours night whatever the phase', M.bandFor('sunrise', 7) === 'morning' && M.bandFor('morning', 10) === 'morning' && M.bandFor('afternoon', 14) === 'day' && M.bandFor('sunset', 18) === 'evening' && M.bandFor('night', 19) === 'evening' && M.bandFor('night', 21) === 'night' && M.bandFor('night', 23) === 'night' && M.bandFor('morning', 3) === 'night');
  var tempos = Object.keys(M.THEMES).map(function (t) { return ['morning', 'day', 'evening', 'night'].map(function (b) { return M.tempoFor(t, b); }); }).reduce(function (a, b) { return a.concat(b); }, []);
  check('every tempo sits between 44 and 84 beats a minute (slower since 22 Oct), night never faster than day', tempos.every(function (x) { return x >= 44 && x <= 84; }) && Object.keys(M.THEMES).every(function (t) { return M.tempoFor(t, 'night') <= M.tempoFor(t, 'day') && M.tempoFor(t, 'evening') <= M.tempoFor(t, 'day'); }), tempos.join());
  /* the form and the bank */
  check('the form is 32 bars, A A\' B A\'\', and bar 32 is a held D6', M.BARS.length === 32 && M.LOOP_BEATS === 128 && M.BARS[31].join() === 'D6' && M.BARS[0].join() === M.BARS[8].join() && M.BARS[16][0] === 'Em7');
  var bankBad = [];
  Object.keys(M.BANK).forEach(function (ph) {
    var grp = M.GROUP[ph], slot = M.SLOT_GROUPS.indexOf(grp), base = slot * 16, end = 0;
    M.BANK[ph].forEach(function (n) {
      var beat = base + n[0]; end = Math.max(end, n[0] + n[2]);
      if (!M.inScale(n[1])) bankBad.push(ph + ' out of scale ' + n[1]);
      if (Number.isInteger(n[0]) && !M.chordTone(n[1], M.chordAt(beat))) bankBad.push(ph + ' beat ' + n[0] + ' ' + n[1] + ' over ' + M.chordAt(beat));
      var m = M.midi(n[1]); if (m < M.midi('D4') || m > M.midi('A5')) bankBad.push(ph + ' register ' + n[1]);
    });
    if (end > 15) bankBad.push(ph + ' no rest at the end (' + end + ')');
    if (/^B2/.test(ph) && M.BANK[ph].some(function (n) { return n[0] < 8; })) bankBad.push(ph + ' plays in the accompaniment-only bars');
  });
  check('every phrase stays in D major, lands chord tones on the beat, keeps the melody register and ends in rest; B2 phrases leave their first two bars to the accompaniment', bankBad.length === 0, bankBad.join('; '));
  check('the last slot always cadences on the same phrase, and that phrase ends on D', Object.keys(M.THEMES).filter(function (t) { return !M.THEMES[t].ambient; }).every(function (t) { return M.arrange(t, 0)[7] === 'A2d' && M.arrange(t, 5)[7] === 'A2d'; }) && M.BANK.A2d[M.BANK.A2d.length - 1][1] === 'D5');
  var a0 = M.arrange('home', 0), a1 = M.arrange('home', 1), a0b = M.arrange('home', 0);
  check('the arrangement is fixed for a loop index and changes a little for the next (bounded variation, never a shuffle)', a0.join() === a0b.join() && a0.join() !== a1.join() && a0.every(function (ph, i) { return M.THEMES.home.slots[i].indexOf(ph) > -1; }) && a1.every(function (ph, i) { return M.THEMES.home.slots[i].indexOf(ph) > -1; }));
  /* events */
  var evBad = [], all = [];
  Object.keys(M.THEMES).filter(function (t) { return !M.THEMES[t].ambient; }).forEach(function (t) { ['morning', 'day', 'evening', 'night'].forEach(function (b) { [0, 1, 2].forEach(function (L) { var ev = M.events(t, b, L); all.push([t, b, L, ev]); }); }); });
  all.forEach(function (x) {
    var t = x[0], b = x[1], ev = x[3];
    for (var i = 1; i < ev.length; i++) if (ev[i].t < ev[i - 1].t) { evBad.push(t + ' ' + b + ' order'); break; }
    ev.forEach(function (e) {
      if (e.pitch && !M.inScale(e.pitch)) evBad.push(t + ' ' + b + ' scale ' + e.pitch);
      if (e.part === 'mel' && Number.isInteger(e.t) && !M.chordTone(e.pitch, e.chord)) evBad.push(t + ' ' + b + ' beat ' + e.t + ' ' + e.pitch);
      if (e.part === 'pad' && !(e.pitches && e.pitches.length === 3)) evBad.push(t + ' pad shape');
      if (e.t < -0.2 || e.t >= 128) evBad.push(t + ' ' + b + ' outside the loop ' + e.t);
    });
    var mel = ev.filter(function (e) { return e.part === 'mel'; }), last = mel[mel.length - 1];
    if (!last || last.pitch !== 'D5' || last.t + last.d > 128) evBad.push(t + ' ' + b + ' does not end on D with a rest');
    if (b === 'night' && ev.some(function (e) { return e.part === 'ans' || e.part === 'grace' || e.part === 'acc'; })) evBad.push(t + ' night has answering, grace or broken chords');
    var dayMel = M.events(t, 'day', x[2]).filter(function (e) { return e.part === 'mel'; }).length;
    if (b === 'night' && (M.THEMES[t].sparse ? mel.length > dayMel : mel.length >= dayMel)) evBad.push(t + ' night is not sparser'); /* the harbour is sparse by day already */
  });
  var cv = M.events('cave', 'day', 0), cv2 = M.events('cave', 'day', 0);
  check('the cave is ambient: a drone, singing bowls and drips, no melody, the same events every time for a loop', cv.length && !cv.some(function (e) { return e.part === 'mel'; }) && cv.some(function (e) { return e.part === 'bowl'; }) && cv.some(function (e) { return e.part === 'drip'; }) && cv.some(function (e) { return e.part === 'pad' && e.d > 8; }) && JSON.stringify(cv) === JSON.stringify(cv2) && cv.every(function (e) { return e.t >= 0 && e.t < 128 && (!e.pitch || M.inScale(e.pitch)); }));
  check('for every theme, band and loop: events in time order, in the scale, chord tones on the beat, a D with rest at the end; night drops the light notes, the answering voice and the broken chords', evBad.length === 0, evBad.slice(0, 6).join('; '));
  var gm = M.events('garden', 'morning', 0), gd = M.events('garden', 'day', 0);
  check('the garden adds grace notes and an answering voice in the morning only; the harbour keeps its melody sparse by day', gm.some(function (e) { return e.part === 'grace'; }) && !gd.some(function (e) { return e.part === 'grace'; }) && gm.some(function (e) { return e.part === 'ans'; }) && M.events('harbour', 'day', 0).filter(function (e) { return e.part === 'mel'; }).length < M.events('home', 'day', 0).filter(function (e) { return e.part === 'mel'; }).length);
  check('a sixth below stays diatonic and below: A4 to C#4, D5 to F#4, and a step below E4 is D4', M.stepDown('A4', 5) === 'C#4' && M.stepDown('D5', 5) === 'F#4' && M.stepDown('E4', 1) === 'D4' && M.stepDown('D4', 1) === 'C#4');
  /* decide: the precedence table */
  var D = M.decide;
  check('decide: off beats everything; hidden beats sleep; sleep beats an activity; an activity beats the scene; no theme beats a voice; a voice ducks; otherwise play',
    D({ music: false, theme: 'home' }).mode === 'off' && D({ music: true, sound: false, theme: 'home' }).mode === 'off' && D({ music: true, hidden: true, sleeping: true, theme: 'home' }).why === 'hidden' && D({ music: true, sleeping: true, exclusive: true, theme: 'home' }).why === 'sleep' && D({ music: true, exclusive: true, theme: null }).why === 'activity' && D({ music: true, theme: null, media: true }).why === 'scene' && D({ music: true, theme: 'home', media: true }).mode === 'duck' && D({ music: true, theme: 'home' }).mode === 'play' && D({ music: true, theme: 'home', from: 'duck' }).fade === 2.5 && D({ music: true, theme: 'home', media: true }).fade < 0.1);
  check('decide is pure: the same snapshot twice gives the same answer and never touches audio', JSON.stringify(D({ music: true, theme: 'plaza' })) === JSON.stringify(D({ music: true, theme: 'plaza' })) && !/ctx|gain/.test(D.toString()));
  /* media: judged by events, never by the call */
  function FakeEl(tag) { this.tagName = tag; this.paused = true; this.ended = false; this.muted = false; this.volume = 1; this.srcObject = null; this.src = 'assets/audio/x.mp3'; this.currentSrc = ''; this.h = {}; }
  FakeEl.prototype.addEventListener = function (n, f) { (this.h[n] = this.h[n] || []).push(f); };
  FakeEl.prototype.fire = function (n) { (this.h[n] || []).forEach(function (f) { f(); }); };
  var a = new FakeEl('AUDIO'), v = new FakeEl('VIDEO'), s = new FakeEl('AUDIO'); s.src = 'data:audio/wav;base64,UklGR'; var cam = new FakeEl('VIDEO'); cam.srcObject = {}; cam.muted = true;
  M._media.track(a); M._media.track(v); M._media.track(s); M._media.track(cam);
  a.paused = false; a.fire('playing'); v.paused = false; v.fire('playing'); s.paused = false; s.fire('playing'); cam.paused = false; cam.fire('playing');
  check('a playing audio and a playing video count; the silent data: clip and the camera preview never do', M._media.live().length === 2 && M._media.live().indexOf(a) > -1 && M._media.live().indexOf(v) > -1);
  a.muted = true; a.fire('volumechange'); v.volume = 0; v.fire('volumechange');
  check('a muted element or one at zero volume drops out at once', M._media.live().length === 0);
  a.muted = false; a.fire('volumechange'); a.fire('ended'); a.paused = true; a.ended = true; a.fire('ended');
  check('an element only counts while its own state says it plays: unmuting while playing counts, ending clears it', M._media.live().length === 0);
  a.ended = false; a.paused = false; a.fire('playing'); a.src = 'assets/audio/y.mp3'; a.fire('emptied'); a.paused = true; a.fire('pause');
  var reused = M._media.live().length === 0; a.paused = false; a.fire('playing');
  check('one element reused for successive clips is re-read at every event: a stale ended cannot release a newer clip, and a new playing counts again', reused && M._media.live().length === 1);
  check('nothing is inferred from a play() call: a rejected start never marks an element live', (function () { var el = new FakeEl('AUDIO'); w.HTMLMediaElement = function () { }; w.HTMLMediaElement.prototype.play = function () { return Promise.reject(new Error('blocked')); }; M._media.wrap(); var p = w.HTMLMediaElement.prototype.play.call(el); p.catch(function () { }); return !!w.HTMLMediaElement.prototype.play.__ovuMusic && M._media.live().indexOf(el) < 0 && typeof el.h.playing === 'object' && M._media.wrap() === false; })());
  check('audible() reads the element, not a flag: paused, ended, muted, silent volume, a stream or a data source are not audible', !M.audible(Object.assign(new FakeEl('AUDIO'), { paused: true })) && !M.audible(Object.assign(new FakeEl('AUDIO'), { paused: false, ended: true })) && M.audible(Object.assign(new FakeEl('AUDIO'), { paused: false })) && !M.audible(Object.assign(new FakeEl('DIV'), { paused: false })));
  /* the engine wires once */
  w.setInterval = function () { return 0; }; w.clearInterval = function () { }; w.setTimeout = function () { return 0; }; w.clearTimeout = function () { }; /* the engine's pollers, inert here */
  var hooks = {}, R = { on: function (n, f) { (hooks[n] = hooks[n] || []).push(f); }, layout: function () { return { id: 'room' }; }, practiceOn: function () { return false; }, sessionOn: function () { return false; }, meditating: function () { return false; }, toast: function () { } };
  w.OvuRoom = R;
  var first = M.init(), second = M.init();
  check('init wires the room once: a second call does nothing, and the state reports off until she opts in', first === true && second === false && hooks.layout.length === 1 && hooks.travel.length === 1 && hooks.boot.length === 1 && M.state().on === false && M.state().mode === 'off');
  check('the module pays no hearts, writes no diary entry, names no model and uses no em dash', !/OvuRewards|\.award\(|S\.add\(|OvuStore\.add\(|addMany\(/.test(src) && !/gpt|claude|doubao|deepseek|gemini/i.test(src) && src.indexOf('—') < 0);
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), rh = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), ss = fs.readFileSync(path.join(root, 'ovu-sound.js'), 'utf8');
  check('the two controls are native buttons named Music with aria-pressed, the icon hidden from assistive technology, and the window help says what music is', /id="musicChip" type="button" aria-label="Music" aria-pressed="false"><span class="ms" aria-hidden="true">/.test(rh) && /id="winMusic" aria-pressed="/.test(rs) && /Music is a soft tune drawn in the browser/.test(rs) && rh.indexOf('<script src="ovu-music.js"></script>') > rh.indexOf('<script src="ovu-voicemute.js"></script>'));
  check('the kit shares its graph without resuming it, resumes only on request, and knows the cast', /function graph\(\)/.test(ss) && !/function graph\(\)[^\n]*resume/.test(ss) && /function resume\(\)/.test(ss) && !!w.OvuSound.KIT.cast && /play\('cast'\)/.test(fs.readFileSync(path.join(root, 'ovu-harbour.js'), 'utf8')) && /play\('boop'\)/.test(fs.readFileSync(path.join(root, 'ovu-seats.js'), 'utf8')) && /R\.emit\('travel', target, T\)/.test(fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8')) && typeof w.OvuBreathTap.running === 'function');
})();

(function widerWorld() {
  console.log('2k16. the wider world (21 Oct, Jamie: "whatever we built will be at a corner of it, the rest of the area will be just the field, the land unbuilt"): land edge to edge, the places in one corner, no ??? and no mist');
  var w = scenes('2026-10-21'); w.OvuRoom = null; w.OvuZones = null;
  ['ovu-farm.js', 'ovu-stamina.js', 'ovu-barn.js', 'ovu-harbour.js', 'ovu-map.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var M = w.OvuMap, src = fs.readFileSync(path.join(root, 'ovu-map.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8');
  check('no ??? markers, no fog and no mist: the module has no FOG list, no fog buttons and no hint text; the stylesheet has no fog rules', M.FOG === undefined && M.fogText === undefined && src.indexOf('???') < 0 && src.indexOf('data-fog') < 0 && !/\.fog\b|fogdrift/.test(css) && !/mist|some day/i.test(src.slice(src.indexOf('the sheet'))) && src.indexOf('—') < 0);
  /* the plate in units: the built box is 100 x 80 at the top-left; the plate is WORLD.cols x WORLD.rows boxes */
  var covers = function (z, vw, vh) { var ww = M.WORLD.cols * vw * z.s, wh = M.WORLD.rows * vw * z.s * 0.8; return z.tx <= 1e-9 && z.ty <= 1e-9 && z.tx + ww >= vw - 1e-9 && z.ty + wh >= vh - 1e-9; };
  var views = [[300, 240], [358, 286.4], [300, 252], [320, 240]], ok = true, bad = null;
  views.forEach(function (v) { [0.01, 0.2, 1 / 3, 0.5, 0.8, 1, 1.8, 9].forEach(function (s) { [[0, 0], [9999, 9999], [-9999, -9999], [-123, 456], [50, -80]].forEach(function (t) { var z = M.zoomClamp(s, t[0], t[1], v[0], v[1]); if (!covers(z, v[0], v[1])) { ok = false; bad = { v: v, s: s, t: t, z: z }; } }); }); });
  check('the land always covers the whole view: at every scale and every pan, on views a little taller or wider than the box, nothing past the plate can show', ok, JSON.stringify(bad));
  var zm = M.zoomClamp(0.01, 0, 0, 300, 240);
  check('zoomed all the way out the whole world just fills the view (no band of blank), and zooming in stops at the top scale', Math.abs(zm.s - 1 / 3) < 1e-9 && zm.tx === 0 && zm.ty === 0 && M.zoomClamp(99, 0, 0, 300, 240).s === M.ZOOM.max && M.minScale(300, 252) > 1 / 3);
  check('the stylesheet matches the module: the plate is three boxes wide and three tall, the places sit on its top-left box, and the view keeps the box\'s shape', M.WORLD.cols === 3 && M.WORLD.rows === 3 && /\.worldwide\{[^}]*width:300%[^}]*aspect-ratio:5\/4/.test(css) && /\.worldmap\.known\{[^}]*left:0;top:0;width:33\.3333%;height:33\.3333%/.test(css) && /\.worldmap\.known\{[^}]*background:none/.test(css) && /aspect-ratio:100\/' \+ H \+ '/.test(src) && /var H = 80;/.test(src));
  /* the real places, the hidden spring once found, and a new place joined by a door, the way Harbour Lane will be */
  var L = w.LAYOUTS; L.farm = w.OvuFarm.LAYOUT; L.barn = w.OvuBarn.LAYOUT; L.barninside = w.OvuBarn.BARN_IN; L.heninside = w.OvuBarn.HEN_IN; L.harbour = w.OvuHarbour.LAYOUT; L.cave = w.OvuBarn.CAVE;
  var g = M.graph(L, 'room'), P = M.place(g), ids = Object.keys(P);
  check('the real map finds its places by their doors: home, garden, greenhouse, farm, barn, harbour, Dream Street, its three shops and the plaza', ['home', 'garden', 'greenhouse', 'farm', 'barn', 'harbour', 'street', 'plaza', 'shop-pet', 'shop-furniture', 'shop-homes'].every(function (k) { return !!g.nodes[k]; }) && !g.nodes.barninside && !g.nodes.heninside, ids.join());
  var apart = function (Q) { var k = Object.keys(Q); return k.every(function (a) { return k.every(function (b) { return a >= b || Math.hypot(Q[a][0] - Q[b][0], Q[a][1] - Q[b][1]) >= 12; }); }); };
  check('every place sits in the built corner, apart from the others (the harbour, set by its door, too)', ids.every(function (k) { return M.inCorner(P[k]); }) && apart(P) && P.harbour[0] <= 100 && P.harbour[1] <= 80, JSON.stringify(P));
  var hb = JSON.parse(JSON.stringify(L.harbour)); hb.doors = (hb.doors || []).concat([{ id: 'lanedoor', to: 'lane', x: 80, y: 60 }]); hb.hotspots = (hb.hotspots || []).concat([{ id: 'lanedoor', label: 'Signpost · Harbour Lane' }]);
  var bn = JSON.parse(JSON.stringify(L.barn)); bn.doors = (bn.doors || []).concat([{ id: 'crack', to: 'cave', x: 70, y: 50 }]);
  var L2 = Object.assign({}, L, { harbour: hb, barn: bn, lane: { id: 'lane', name: 'Harbour Lane', img: 'lane.webp', doors: [{ id: 'laneout', to: 'harbour', x: 10, y: 70 }], hotspots: [{ id: 'laneout', label: 'Path · back to the harbour' }] } });
  var g2 = M.graph(L2, 'room'), P2 = M.place(g2);
  check('a new place joined by a door (a lane off the harbour) and the found spring are drawn beside their neighbours, still in the corner and apart; the places already there do not move', !!P2.lane && !!P2.cave && M.inCorner(P2.lane) && M.inCorner(P2.cave) && apart(P2) && Math.hypot(P2.lane[0] - P2.harbour[0], P2.lane[1] - P2.harbour[1]) <= 40 && ids.every(function (k) { return P2[k][0] === P[k][0] && P2[k][1] === P[k][1]; }), JSON.stringify({ lane: P2.lane, cave: P2.cave, harbour: P2.harbour }));
  /* many more places later: the corner grows outward, never across the open land */
  var L3 = Object.assign({}, L2), prev = 'lane';
  for (var i = 0; i < 12; i++) { var id = 'new' + i; L3[prev] = Object.assign({}, L3[prev], { doors: (L3[prev].doors || []).concat([{ id: 'to' + id, to: id, x: 50, y: 50 }]) }); L3[id] = { id: id, name: 'Place ' + i, img: 'p.webp', doors: [{ id: 'back', to: prev, x: 50, y: 80 }], hotspots: [] }; prev = i % 3 === 2 ? 'garden' : id; }
  var g3 = M.graph(L3, 'room'), P3 = M.place(g3), k3 = Object.keys(P3);
  check('twelve more places still fit the corner: none past its growth limit and none on the open land; a new place goes in the map\'s own box while there is room; the places with a spot of their own never move', P2.lane[0] <= 100 && P2.lane[1] <= 80 && ids.every(function (k) { return !w.OvuMap.POS[k] || (P3[k][0] === P[k][0] && P3[k][1] === P[k][1]); }) && !!M.POS.harbour && k3.length === ids.length + 14 && k3.every(function (k) { return M.inCorner(P3[k]); }) && k3.every(function (k) { return P3[k][0] <= M.GROW.x && P3[k][1] <= M.GROW.y; }) && M.GROW.x <= 300 * 0.45 && M.GROW.y <= 240 * 0.45, JSON.stringify(P3));
  /* the opening view: the places fitted and centred as far as the land allows, open country at the right and below */
  var vw = 358, vh = 286.4, z = M.opening(P, vw, vh), u = vw / 100 * z.s;
  var sx = function (x) { return z.tx + x * u; }, sy = function (y) { return z.ty + y * u; };
  check('the map opens on the built corner: every place on screen with room for its drawing, the corner filling most of the view, and open land showing at the right and the bottom', ids.every(function (k) { return sx(P[k][0]) >= 20 && sx(P[k][0]) <= vw - 20 && sy(P[k][1]) >= 20 && sy(P[k][1]) <= vh - 20; }) && sx(100) > vw * 0.6 && sx(100) < vw && sy(80) > vh * 0.6 && sy(80) < vh && covers(z, vw, vh) && z.s < M.ZOOM.names, JSON.stringify(z));
  var zf = M.opening(P2, vw, vh), zo = M.zoomClamp(M.ZOOM.min, 0, 0, vw, vh);
  check('a corner that has grown opens fitted to all of it, and zooming out shows nine times the corner\'s area, almost all of it open land', Object.keys(P2).every(function (k) { var x = zf.tx + P2[k][0] * vw / 100 * zf.s, y = zf.ty + P2[k][1] * vw / 100 * zf.s; return x >= 10 && x <= vw - 10 && y >= 10 && y <= vh - 10; }) && zo.s === 1 / 3 && M.WORLD.cols * M.WORLD.rows === 9, JSON.stringify(zf));
  check('the map still never moves her: no travel call in the module', !/OvuWalk\.travel|applyLayout\(/.test(src));
  var plate = fs.statSync(path.join(root, 'assets/room/dream/map-world.webp')).size, sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  check('the plate is a reasonable size for a phone and the offline cache version moved on with it', plate > 80000 && plate < 400000 && /VERSION = 'ovumind-2026-1[01]-(2[2-9]|3[01])/.test(sw), plate);
})();

(function cycleRhythm() {
  console.log('2k17. Your cycle rhythm (21 Oct): history is the only number, four cards with levels, nothing adds up to a score');
  var w = fresh('2026-10-21'); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-rhythm.js'), 'utf8'), w, { filename: 'ovu-rhythm.js' });
  var R = w.OvuRhythm, S = w.OvuStore, A = w.OvuAgents, src = fs.readFileSync(path.join(root, 'ovu-rhythm.js'), 'utf8');
  function per(start, days, extra) { for (var i = 0; i < days; i++) S.add('period', S.addDays(start, i), Object.assign({ flow: i < 2 ? 'medium' : 'light', clots: false, impact: false }, extra || {}), 'room'); }
  function P() { return R.panel({ store: S, agents: A }); }
  check('with nothing logged the picture is 0 of 3 and asks for a first period; a first start alone is still 0 of 3', P().readiness.n === 0 && /Log the first day/.test(P().readiness.line) && (per('2026-09-25', 5), P().readiness.n === 0) && /first period start is recorded/.test(P().readiness.line));
  per('2026-07-01', 5); per('2026-07-29', 5); per('2026-08-27', 4);
  var p4 = P();
  check('four starts make three complete cycles (3 of 3): the fourth period need not have finished; lengths 28, 29, 29', p4.readiness.n === 3 && p4.readiness.total === 3 && p4.intervals.cycles.map(function (c) { return c.days; }).join() === '28,29,29', JSON.stringify(p4.readiness));
  check('with no usable age band the spread is shown without a verdict and the band is asked; nothing is graded', p4.regularity.level === 'building' && p4.regularity.spread === 1 && p4.regularity.limit === null && p4.askBand === true);
  S.setProfile({ ageRange: '30-34' }); var p30 = P();
  check('ages 30 to 34 fall inside FIGO\'s 26 to 41 band without asking: a 1-day spread is within the 7-day reference', p30.regularity.band === '26-41' && p30.regularity.limit === 7 && p30.regularity.level === 'ref' && /up to 7 days/.test(p30.regularity.text));
  S.setProfile({ ageRange: '25-29', cycleAgeBand: '' });
  check('25 to 29 straddles two FIGO bands, so the panel asks; 18 to 25 answered makes the limit 9; 46 or older gives no verdict', P().askBand === true && (S.setProfile({ cycleAgeBand: '18-25' }), P().regularity.limit === 9) && (S.setProfile({ cycleAgeBand: '46+' }), P().regularity.limit === null && /no reference variation after 45/.test(P().regularity.text)));
  S.setProfile({ cycleAgeBand: '26-41' });
  /* an irregular set: 24, 36, 27 → spread 12 over the 7-day limit */
  var w2 = fresh('2026-10-21'); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-rhythm.js'), 'utf8'), w2, { filename: 'ovu-rhythm.js' });
  var S2 = w2.OvuStore, R2 = w2.OvuRhythm; S2.setProfile({ ageRange: '30-34' });
  [['2026-06-20', 4], ['2026-07-14', 4], ['2026-08-19', 4], ['2026-09-15', 4]].forEach(function (x) { for (var i = 0; i < x[1]; i++) S2.add('period', S2.addDays(x[0], i), { flow: 'medium', clots: false, impact: false }, 'room'); });
  var p2 = R2.panel({ store: S2, agents: w2.OvuAgents });
  check('a 12-day spread over the 7-day reference reads Worth a chat, as an observation, not a diagnosis', p2.regularity.level === 'chat' && p2.regularity.spread === 12 && /worth a conversation/.test(p2.regularity.text) && /not a diagnosis/.test(p2.regularity.text));
  check('every cycle inside 24 to 38 and bleeding of 4 days reads Within the reference range; lengths never use the average alone', p2.lengths.level === 'ref' && /Every recorded cycle/.test(p2.lengths.text) && !/average/.test(p2.lengths.text));
  for (var i = 0; i < 10; i++) S2.add('period', S2.addDays('2026-10-05', i), { flow: 'light', clots: false, impact: false }, 'room');
  var p3 = R2.panel({ store: S2, agents: w2.OvuAgents });
  check('bleeding recorded on more than 8 days is Worth a chat without waiting for anything, and the 20-day cycle before it is outside 24 to 38', p3.lengths.level === 'chat' && p3.lengths.longBleeds.length === 1 && p3.lengths.outside.length === 1 && p3.lengths.outside[0].days === 20);
  check('an episode made only of filled-in days does not count; a filled day inside a logged episode is reported as uncertain', R.confirmedEpisodes([{ start: '2026-06-01', end: '2026-06-05', days: [1, 2, 3, 4, 5].map(function () { return { data: { autofill: true } }; }) }]).length === 0 && R.confirmedEpisodes([{ start: '2026-07-01', end: '2026-07-03', days: [{ data: {} }, { data: { autofill: true } }, { data: { autofill: true } }] }])[0].filled === 2);
  var iv = R.intervals([{ start: '2026-05-01' }, { start: '2026-05-29' }, { start: '2026-08-20' }, { start: '2026-09-17' }, { start: '2026-10-15' }], '2026-10-21');
  check('a gap of more than 60 days between records is kept as a gap, not a cycle, and the window is the last six months', iv.gaps.length === 1 && iv.gaps[0].days === 83 && iv.cycles.length === 3 && iv.from === '2026-04-21');
  /* symptoms and comfort: three measures, their own denominators */
  var sym = [];
  for (var d = 0; d < 10; d++) sym.push({ type: 'symptom', date: S.addDays('2026-10-21', -d), data: { symptoms: d % 2 ? ['cramps'] : [], pain: d === 3 ? 8 : 2, mood: d < 5 ? 'low' : 'ok' } });
  var sy = R.symptoms(sym, '2026-10-21', {}, []);
  check('pain of 8 on one day and low mood on 5 days make Worth a chat, with every denominator shown', sy.level === 'chat' && sy.painMax === 8 && sy.moodLow === 5 && sy.symAnswered === 10 && sy.painAnswered === 10 && sy.moodAnswered === 10 && /answered on 10 of 14 days/.test(sy.text) && /Other days are unknown/.test(sy.text));
  var mild = sym.map(function (e) { return { type: 'symptom', date: e.date, data: { symptoms: e.data.symptoms, pain: 2, mood: 'ok' } }; });
  check('ten answered days with nothing over the lines reads Nothing flagged; four answered days reads Not enough information; an empty symptom list is still an answer', R.symptoms(mild, '2026-10-21', {}, []).level === 'ok' && R.symptoms(mild.slice(0, 4), '2026-10-21', {}, []).level === 'thin' && R.symptoms(mild, '2026-10-21', {}, []).symAnswered === 10);
  check('a care flag from the entries is Worth a chat on its own; three low-mood days are enough after a birth', R.symptoms(mild, '2026-10-21', {}, [{ level: 'high' }]).level === 'chat' && R.symptoms(mild.map(function (e, i) { return { type: 'symptom', date: e.date, data: { symptoms: [], pain: 1, mood: i < 3 ? 'low' : 'ok' } }; }), '2026-10-21', { pregState: 'postpartum' }, []).level === 'chat');
  /* stages and copy */
  check('stages: pregnant pauses the count, postpartum before periods counts nothing, the pill shows lengths without a grade, after the menopause the view is the body', R.stage({ pregState: 'maybe' }, {}) === 'pregnant' && R.stage({ pregState: 'postpartum', periodsBack: 'no' }, {}) === 'postpartum-none' && R.stage({ hormones: ['pill'] }, {}) === 'hormones' && R.stage({ lifeStage: 'post' }, {}) === 'post' && R.stage({}, { mode: 'wide' }) === 'wide');
  S.setProfile({ lifeStage: 'post' }); var hp = R.html({ store: S, agents: A });
  check('after the menopause: Your body, no readiness, no ovulation card, a line that any bleeding is checked', /Your body/.test(hp) && !/Building your cycle picture/.test(hp) && !/Ovulation signs/.test(hp) && /any bleeding at all/.test(hp));
  S.setProfile({ lifeStage: '', pregState: 'pregnant' }); var hg = R.html({ store: S, agents: A });
  check('pregnant: the count, the comparisons and ovulation are paused; symptoms and care stay', /paused/.test(hg) && !/Building your cycle picture/.test(hg) && /Symptoms and comfort/.test(hg));
  S.setProfile({ pregState: 'none' }); var hn = R.html({ store: S, agents: A });
  check('the panel names no score and nothing unlocked, says ovulation is not assessed, carries the FIGO chips and the Rhythme threshold chip, and ends with care that never waits', !/score|unlocked|percent|out of 100/i.test(hn) && /Not assessed/.test(hn) && /cannot tell whether you ovulated/.test(hn) && /evidence\.html#E7/.test(hn) && /Rhythme threshold/.test(hn) && /Care prompts never wait for three cycles/.test(hn) && hn.indexOf('—') < 0 && src.indexOf('—') < 0);
  check('the module pays no hearts, writes no entry and sends nothing to a model', !/OvuRewards|\.award\(|S\.add\(|OvuStore\.add\(|fetch\(|OvuInsight/.test(src));
  var rh = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), ev = fs.readFileSync(path.join(root, 'ovu-evidence.js'), 'utf8');
  check('the Cycle tab is back between Home and Food, reachable while she sleeps, with a Rhythm view in the calendar and Body after the menopause; evidence E91 to E94 exist', /data-tab="cycle" id="navCycle"/.test(rh) && rh.indexOf('data-tab="cycle"') < rh.indexOf('data-tab="food"') && /AWAKE_FREE = \{[^}]*cycle: 1/.test(rs) && /function openScores\(\)/.test(rs) && /cycle: function \(\) \{ openScores\(\); \}/.test(rs) && /function labelCycleTab/.test(rs) && ['E91', 'E92', 'E93', 'E94'].every(function (e) { return ev.indexOf("id: '" + e + "'") > -1; }) && ev.indexOf('—') < 0);
})();

(function lunaPanel() {
  console.log('2k18. Luna’s chat panel (21 Oct): the Ovuluna card, honest about what Luna is');
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8');
  var luna = rs.slice(rs.indexOf('function openLuna('), rs.indexOf('function openLuna(') + 6000);
  check('the sheet becomes a card only for Luna and shows her face; the title names her a wellness companion', /sheet\.classList\.toggle\('luna-sheet', id === 'luna'\)/.test(rs) && /img class="lunaico" src="assets\/room\/dream\/orb-luna\.webp"/.test(rs) && /'Your wellness companion'/.test(luna));
  check('the state line tells the truth (rules only while AI help is paused or off; reading on otherwise) and there is no upsell, no quota invented, no model name', /Rules only · AI help paused/.test(luna) && /Luna’s reading is on/.test(luna) && !/upgrade|premium|questions left/i.test(luna) && !/gpt|claude|doubao|deepseek|gemini/i.test(luna));
  check('three ask chips open real guides (foods: the Food diary, 22 Oct), the composer asks about her cycle, and the companion note is the last line', !/stress\.html/.test(luna) && /hormones\.html/.test(luna) && /room\.html#food/.test(luna) && ['hormones.html'].every(function (f) { return fs.existsSync(path.join(root, f)); }) && /location\.replace\('ppg\.html'\)/.test(fs.readFileSync(path.join(root, 'stress.html'), 'utf8')) && /Tell Luna, or ask about your cycle…/.test(luna) && /Luna is a wellness companion, not a doctor\. For medical concerns, talk to a clinician\./.test(luna));
  check('the card’s styles exist and no em dash entered the copy', /\.sheet\.luna-sheet\{/.test(css) && /\.askchip\{/.test(css) && /\.lunanote\{/.test(css) && luna.indexOf('—') < 0);
})();

(function waterInTheFoodDiary() {
  console.log('2k20. water in the food diary (21 Oct): records by id, hearts once a day for recording, never for an amount; two tabs lose nothing; a wipe stays wiped; information by answers, never a personal number');
  var day = '2026-10-21', w = fresh(day), S = w.OvuStore, WT = w.OvuWater, RW = w.OvuRewards, A = w.OvuAgents;
  check('amounts are whole millilitres from 1 to 3000; nothing else is one', WT.validMl(250) === 250 && WT.validMl('330') === 330 && WT.validMl(249.6) === 250 && [0, -5, 3001, 'ml', '', null, true, Infinity, NaN, 1e9].every(function (v) { return WT.validMl(v) === null; }));
  var h0 = RW.ledger().hearts, r1 = WT.add(250), r2 = WT.add(200);
  check('the first record of today earns the logging hearts once; the second earns nothing; the total is a derived sum', r1.points === 6 && RW.ledger().hearts === h0 + 6 && r2.points === 0 && RW.ledger().hearts === h0 + 6 && WT.dayTotal(day) === 450 && WT.dayCount(day) === 2);
  var yest = S.addDays(day, -1), r3 = WT.add(500, yest);
  check('a record for another day is kept and earns nothing; a future day is refused', r3.points === 0 && WT.dayTotal(yest) === 500 && (function () { try { WT.add(100, S.addDays(day, 1)); return false; } catch (e) { return /not come/.test(e.message); } })());
  check('removing leaves a tombstone, and adding again today earns nothing more', WT.remove(r1.id) && !WT.current().records[r1.id] && !!WT.current().tombstones[r1.id] && WT.dayTotal(day) === 200 && WT.add(250).points === 0 && RW.ledger().hearts === h0 + 6);
  check('a bad amount or an unknown id changes nothing', (function () { try { WT.add('lots'); return false; } catch (e) { return !WT.remove('nope') && WT.dayTotal(day) === 450; } })());
  /* information follows the answers and nothing else */
  check('no answers: general information; declined: general; kidney, heart, advice or not sure on any of them: the care line; pregnancy or breastfeeding: that line', WT.mode({}) === 'unknown' && WT.mode({ declined: true }) === 'general' && WT.mode({ answers: { kidney: 'no', heart: 'no', advice: 'no', preg: 'no' } }) === 'general' && WT.mode({ answers: { kidney: 'yes' } }) === 'care' && WT.mode({ answers: { advice: 'unsure', preg: 'yes' } }) === 'care' && WT.mode({ answers: { kidney: 'no', heart: 'no', advice: 'no', preg: 'yes' } }) === 'preg' && WT.mode({ answers: { kidney: 'no', heart: 'no', advice: 'no', preg: 'no' }, bf: true }) === 'preg');
  var st1 = WT.saveSettings({ answers: { kidney: 'unsure', heart: 'no', advice: 'no', preg: 'no' } });
  check('not sure stays not sure, and the answers never change the hearts', st1.answers.kidney === 'unsure' && WT.mode(WT.current().settings) === 'care' && RW.ledger().hearts === h0 + 6);
  var texts = Object.keys(WT.INFO).map(function (k) { return WT.INFO[k].join(' '); }).join(' ') + WT.stripHTML(day).replace(/<[^>]*>/g, ' '); /* words only: a link's target attribute is not copy */
  check('no target, goal, percentage, bar, streak or benefit claim anywhere in the copy; the care line names the care team and plain water; no em dash', !/\bgoal|target|remaining|on track|complete\b|%|streak|dehydrat|skin|weight loss|energy level/i.test(texts) && /care team/.test(texts) && /plain water/.test(texts) && texts.indexOf('—') < 0 && !/ml you require|you need \d/i.test(texts));
  check('the strip never shows a personal amount: no litres-per-day figure is computed from her weight', !/weightKg|kg \*|\* kg|ml\/kg|per kg/.test(fs.readFileSync(path.join(root, 'ovu-water.js'), 'utf8')));
  /* two tabs over one storage: both records survive; a wipe stays wiped; a tombstone wins */
  var a = fresh(day), b = fresh(day); b.localStorage = a.localStorage; a.OvuStore.load(true); b.OvuStore.load(true);
  a.OvuWater.add(250); b.OvuWater.add(200); /* B saved without seeing A's record */
  var c = fresh(day); c.localStorage = a.localStorage; c.OvuStore.load(true);
  check('two tabs recording at once keep both records, merged by id inside the store', c.OvuWater.dayCount(day) === 2 && c.OvuWater.dayTotal(day) === 450, JSON.stringify(c.OvuWater.current().records));
  var ids = Object.keys(c.OvuWater.current().records); a.OvuStore.load(true); b.OvuStore.load(true);
  a.OvuWater.remove(ids[0]); b.OvuWater.saveSettings({ hideNumbers: true }); /* B, stale, writes settings after A removed a record */
  var c2 = fresh(day); c2.localStorage = a.localStorage; c2.OvuStore.load(true);
  check('a stale tab’s write never brings a removed record back, and both tabs’ settings and tombstones are kept', c2.OvuWater.dayCount(day) === 1 && !!c2.OvuWater.current().tombstones[ids[0]] && c2.OvuWater.current().settings.hideNumbers === true);
  a.OvuStore.load(true); b.OvuStore.load(true); a.OvuStore.clearAll(); b.OvuWater.add(100); /* B, stale, records after A's Delete everything */
  var c3 = fresh(day); c3.localStorage = a.localStorage; c3.OvuStore.load(true);
  check('after Delete everything in another tab, a stale tab’s new record stands alone: the wiped records do not come back', c3.OvuWater.dayCount(day) === 1 && c3.OvuWater.dayTotal(day) === 100);
  /* a failed save takes neither the record nor the hearts */
  var w2 = fresh(day), S2 = w2.OvuStore, W2 = w2.OvuWater, RW2 = w2.OvuRewards, snap = JSON.stringify([S2.state().water, S2.state().rewards]);
  var realSet = w2.localStorage.setItem; w2.localStorage.setItem = function () { throw new Error('QuotaExceededError'); };
  var failed = false; try { W2.add(250); } catch (e) { failed = true; }
  w2.localStorage.setItem = realSet;
  check('a full disk: the record is refused, the hearts and the water state are exactly as they were, and the next save works and pays once', failed && JSON.stringify([S2.state().water, S2.state().rewards]) === snap && W2.add(250).points === 6 && RW2.ledger().hearts === 6);
  /* restore through the journal's path: by id, no hearts; a replace never brings answers */
  var w3 = fresh(day), W3 = w3.OvuWater, RW3 = w3.OvuRewards, file = { v: 1, settings: { answers: { kidney: 'yes' } }, records: { x1: { id: 'x1', date: day, ml: 300, at: '2026-10-21T01:00:00.000Z' }, bad: { id: 'bad', date: day, ml: 'lots', at: 'x' } }, tombstones: {} };
  var rs1 = W3.restore(file), rs2 = W3.restore(file);
  check('a restored backup brings its valid records once, pays nothing and leaves this phone’s answers alone', rs1.restored === 1 && rs2.restored === 0 && W3.dayTotal(day) === 300 && RW3.ledger().hearts === 0 && !W3.current().settings.answers);
  /* the check-in and the kinds */
  var w4 = fresh(day), S4 = w4.OvuStore, A4 = w4.OvuAgents, W4 = w4.OvuWater; S4.setProfile({ periodsStarted: 'yes', regularity: 'regular' });
  var t0 = A4.todayCheckIn(day).tiles.filter(function (x) { return x.id === 'water'; })[0];
  S4.setCheckinAnswer(day, 'water', 'skip'); var t1 = A4.todayCheckIn(day).tiles.filter(function (x) { return x.id === 'water'; })[0];
  S4.setCheckinAnswer(day, 'water', null); W4.add(330); var t2 = A4.todayCheckIn(day).tiles.filter(function (x) { return x.id === 'water'; })[0];
  check('the Water tile: to add, then answered by Not today, then recorded with the day’s amount; no Food tile remains', t0.state === 'add' && t1.state === 'done' && t1.value === 'Not today' && t1.answer && t2.state === 'done' && t2.value === '330 ml' && A4.todayCheckIn(day).tiles.every(function (x) { return x.id !== 'food'; }));
  S4.setCheckinAnswer(day, 'food', 'skip'); var t3 = A4.todayCheckIn(day, { food: false }).tiles.filter(function (x) { return x.id === 'water'; })[0];
  check('an old food skip answer is never read as a water answer, while an old food opt-out carries over to the water tile once', t3.state === 'done' && t3.value === '330 ml' && !t3.key && (function () { var c0 = A4.todayCheckIn(day, { food: false, water: true }); return c0.tiles.filter(function (x) { return x.id === 'water'; })[0].key; })());
  W4.saveSettings({ hideNumbers: true }); var t4 = A4.todayCheckIn(day).tiles.filter(function (x) { return x.id === 'water'; })[0];
  check('with amounts hidden the tile says how many records, not how much', t4.value === '1 record');
  /* the structured records stay out of the summaries, Luna, the PDF and the shares */
  var others = ['ovu-orb.js', 'ovu-insight.js', 'ovu-pdf.js', 'ovu-sync.js', 'journal.html', 'doctor.html'].map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }).join('\n');
  var agentsSrc = fs.readFileSync(path.join(root, 'ovu-agents.js'), 'utf8'), ciBlock = agentsSrc.slice(agentsSrc.indexOf('function todayCheckIn'), agentsSrc.indexOf('function saveMonthlySummary'));
  check('nothing but today’s check-in tile reads the water records: no summary, model, sync, PDF or share code touches them', !/OvuWater|state\.water\b|\.water\b/.test(others) && (agentsSrc.match(/OvuWater/g) || []).length === (ciBlock.match(/OvuWater/g) || []).length && /out\.water = wn/.test(ciBlock));
  check('the old water page redirects into the food diary, its route points there, and the privacy page names water as local only', /room\.html#food/.test(fs.readFileSync(path.join(root, 'hydration.html'), 'utf8')) && /\[\/hydrat\/i,'room\.html#food'\]/.test(fs.readFileSync(path.join(root, 'appnav.js'), 'utf8')) && /water records/.test(fs.readFileSync(path.join(root, 'privacy.html'), 'utf8')) && /water records/.test(fs.readFileSync(path.join(root, 'privacy-local.js'), 'utf8')));
  var E = w.OvuEvidence; var evOk = E ? ['E95', 'E96', 'E97', 'E98', 'E99', 'E100', 'E101'].every(function (id) { var e = E.get ? E.get(id) : null; return e && e.topics.indexOf('water') > -1 && /^https:/.test(e.url); }) : /id: 'E101'/.test(fs.readFileSync(path.join(root, 'ovu-evidence.js'), 'utf8'));
  check('evidence E95 to E101 exist under the water topic with primary links', evOk);
})();

(function pondAndFlowerBreathing() {
  console.log('2k19. the koi pond and Light Flower with the breath (21 Oct): paces in and out only, the flower sways to the chosen pace, words only with a pace, how-to lists on both cards');
  var w = fresh(), LF = w.OvuLightFlower;
  var paces = Object.keys(LF.PACES);
  check('four paces: the flower’s own rhythm and the koi pond’s three; in and out only, never a hold, none longer than six seconds a side', paces.join() === 'own,easy,steady,longout' && paces.every(function (k) { var p = LF.PACES[k]; return p.inS > 0 && p.outS > 0 && p.inS <= 6 && p.outS <= 6 && Object.keys(p).indexOf('holdS') < 0; }) && !LF.PACES.own.word && LF.PACES.longout.inS === 4 && LF.PACES.longout.outS === 6);
  var ownOk = true; for (var q = 0; q < 12; q += 0.5) { if (Math.abs(LF.breathAt(q, 'own').v - Math.sin(q * 2 * Math.PI / LF.BREATH_S)) > 1e-9 || LF.breathAt(q, 'own').phase !== null) ownOk = false; }
  check('the flower’s own rhythm is the six-second sway it always had, with no words', ownOk && LF.headAt(1.5).s > 1.02 && Math.abs(LF.headAt(1.5, false, 'own').s - LF.headAt(1.5).s) < 1e-9);
  var up = true, down = true, last = -2; for (var a = 0; a <= 4; a += 0.25) { var v = LF.breathAt(a, 'longout').v; if (v < last - 1e-9) up = false; last = v; if (LF.breathAt(a, 'longout').phase !== 'in' && a < 4) up = false; }
  last = 2; for (var b = 4; b < 10; b += 0.25) { var v2 = LF.breathAt(b, 'longout').v; if (v2 > last + 1e-9) down = false; last = v2; if (LF.breathAt(b, 'longout').phase !== 'out') down = false; }
  check('Long out: the breath rises for four seconds (in) and settles for six (out), smoothly, then repeats', up && down && Math.abs(LF.breathAt(0, 'longout').v + 1) < 1e-9 && Math.abs(LF.breathAt(4, 'longout').v - 1) < 1e-9 && Math.abs(LF.breathAt(10, 'longout').v + 1) < 1e-9 && LF.breathAt(10.5, 'longout').phase === 'in');
  check('the flower head sways with the chosen pace within the same few percent, and stays still under reduced motion', Math.abs(LF.headAt(4, false, 'longout').s - 1.022) < 1e-9 && LF.headAt(4, true, 'longout').s === 1 && Math.abs(LF.headAt(0, false, 'steady').s - 0.978) < 1e-9);
  var e = LF.entryFor(90, 2, 'a', 'b', 'steady'), e2 = LF.entryFor(90, 2, 'a', 'b', 'nope'), e3 = LF.entryFor(90, 2, 'a', 'b');
  check('the saved entry carries the pace she chose, and an unknown or missing pace reads as the flower’s own', e.pace === 'steady' && e2.pace === 'own' && e3.pace === 'own' && !('taps' in e));
  var lf = fs.readFileSync(path.join(root, 'ovu-lightflower.js'), 'utf8'), bt = fs.readFileSync(path.join(root, 'ovu-breathtap.js'), 'utf8'), rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  var steps = function (src) { var m = /<details class="btap-how">[\s\S]*?<\/details>/.exec(src); return m ? (m[0].match(/<li>/g) || []).length : 0; };
  check('both cards carry a How to practise list of five plain steps, and the flower’s pacing shows the same gentle-breathing line the pond has', steps(lf) === 5 && steps(bt) === 5 && /lf-pacesafe/.test(lf) && /without forcing a deeper or longer breath/.test(lf) && /without forcing a deeper or longer breath/.test(bt));
  var how = (/<details class="btap-how">[\s\S]*?<\/details>/.exec(lf)[0] + /<details class="btap-how">[\s\S]*?<\/details>/.exec(bt)[0]);
  check('the instructions promise nothing and push nothing: no cure, calm-guarantee, score, streak or em dash', !/\b(cure|heal|fix|anxiety|depression|reduce stress|guarantee|score|streak|must)\b/i.test(how) && how.indexOf('—') < 0);
  check('breathing lives in the koi pond and the Light Flower: no separate Just breathe tiles, and the night and afternoon suggestions open them (Jamie, 22 Oct)', /Breathe with the ring over the koi/.test(rs) && /Breathe with a flower of light/.test(rs) && !/<b>Just breathe<\/b>/.test(rs) && /kind: 'flower'/.test(rs) && /kind: 'koi'/.test(rs) && !/the orb/.test(rs));
})();

(function fastingTiming() {
  console.log('2k15. fasting timing (21 Oct): confirmed times only, separate medians, records with no counter, eligibility that withholds on a yes or a not sure');
  var w = fresh('2026-10-21'); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-fasting.js'), 'utf8'), w, { filename: 'ovu-fasting.js' });
  var F = w.OvuFasting, S = w.OvuStore, src = fs.readFileSync(path.join(root, 'ovu-fasting.js'), 'utf8');
  function realDay(back) { var d = new Date(Date.now() - back * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); } /* saved records are validated against the real clock */
  var Y1 = realDay(1), Y2 = realDay(2);
  function mk(id, date, time, created, extra) { return Object.assign({ id: id, type: 'food', date: date, createdAt: created, updatedAt: created, data: { meal: 'lunch', time: time } }, extra || {}); }
  /* which times count */
  var atMeal = mk('a', '2026-10-21', '08:10', '2026-10-21T08:30:00'), backdated = mk('b', '2026-10-20', '13:00', '2026-10-21T22:00:00'), touched = mk('c', '2026-10-20', '13:00', '2026-10-21T22:00:00'); touched.data.timeSet = true;
  var noTime = mk('d', '2026-10-21', '', '2026-10-21T22:00:00'), badTime = mk('e', '2026-10-21', '25:00', '2026-10-21T22:00:00');
  check('a time counts when she set it or when the entry was saved within 90 minutes of it on its own date; a backdated default time, no time or a bad time does not', F.timeStatus(atMeal) === 'confirmed' && F.timeStatus(touched) === 'confirmed' && F.timeStatus(backdated) === 'unconfirmed' && F.timeStatus(noTime) === 'none' && F.timeStatus(badTime) === 'none' && F.timeStatus({ type: 'sleep', date: '2026-10-21', data: { time: '08:00' } }) === 'none');
  /* one calendar day, literal */
  var day = [mk('1', '2026-10-21', '00:15', '2026-10-21T00:20:00'), mk('2', '2026-10-21', '23:45', '2026-10-21T23:50:00'), mk('3', '2026-10-21', '23:45', '2026-10-21T23:52:00'), noTime, backdated];
  var t = F.dayTimes(day, '2026-10-21');
  check('00:15 and 23:45 on one date are 23 h 30 m apart (calendar days are literal), a duplicate time is one occasion, and missing or unconfirmed entries are counted as left out', t.span === 1410 && t.count === 2 && t.first === 15 && t.last === 1425 && t.untimed === 1 && t.unconfirmed === 0 && F.dayTimes(day, '2026-10-20').unconfirmed === 1, JSON.stringify(t));
  check('one confirmed entry gives no span (unavailable, not zero); no entries give none', F.dayTimes([atMeal], '2026-10-21').span === null && F.dayTimes([atMeal], '2026-10-21').count === 1 && F.dayTimes([], '2026-10-21').first === null);
  var two = [mk('p', '2026-10-20', '21:10', '2026-10-20T21:12:00'), atMeal];
  check('the overnight gap runs from the previous calendar day\'s last confirmed entry to this day\'s first, and is null without either', F.gapFromPrevious(two, '2026-10-21') === 660 && F.gapFromPrevious([atMeal], '2026-10-21') === null && F.gapFromPrevious([two[0]], '2026-10-21') === null);
  /* the review's counter-example: medians are separate statistics */
  var md = [mk('1', '2026-10-01', '08:00', '2026-10-01T08:05:00'), mk('2', '2026-10-01', '09:00', '2026-10-01T09:05:00'), mk('3', '2026-10-02', '10:00', '2026-10-02T10:05:00'), mk('4', '2026-10-02', '20:00', '2026-10-02T20:05:00'), mk('5', '2026-10-03', '18:00', '2026-10-03T18:05:00'), mk('6', '2026-10-03', '19:00', '2026-10-03T19:05:00'), mk('7', '2026-10-04', '12:00', '2026-10-04T12:05:00')];
  var sm = F.summary(md, '2026-10-01', '2026-10-05');
  check('medians are separate: first 10:00, last 19:00 and a one-hour span, over 3 of 5 days with two or more timed entries', sm.medianFirst === 600 && sm.medianLast === 1140 && sm.medianSpan === 60 && sm.eligible === 3 && sm.days === 5, JSON.stringify(sm));
  check('no eligible day gives no medians', F.summary([atMeal], '2026-10-21', '2026-10-21').medianSpan === null && F.summary([], '2026-10-21', '2026-10-21').eligible === 0);
  /* records */
  var now = new Date('2026-10-21T22:00:00'), r = F.validateRecord({ startLocal: '2026-10-21T20:15', note: ' after dinner ' }, now);
  check('a record keeps the instant, the device offset and the local wall clock, trims its note, and has no end yet', /Z$/.test(r.startAt) && typeof r.startOffset === 'number' && r.startLocal === '2026-10-21T20:15' && r.note === 'after dinner' && r.endAt === null && r.id.indexOf('fast_') === 0);
  function fails(rec) { try { F.validateRecord(rec, now); return false; } catch (e) { return e.message; } }
  check('validation refuses an end before the start, a future start or end, a start over 30 days ago, a non-text note and a non-record', /after the start/.test(fails({ startLocal: '2026-10-21T20:15', endLocal: '2026-10-21T19:00' })) && /future/.test(fails({ startLocal: '2026-10-22T01:00' })) && /future/.test(fails({ startLocal: '2026-10-21T20:00', endLocal: '2026-10-22T01:00' })) && /30 days/.test(fails({ startLocal: '2026-09-01T01:00' })) && /text/.test(fails({ startLocal: '2026-10-21T20:00', note: 5 })) && !!fails(null) && !!fails({ startLocal: '2026-10-21T2015' }));
  var done = F.validateRecord({ startLocal: '2026-10-20T20:15', endLocal: '2026-10-21T09:40' }, now);
  check('an ended record shows its length once as a fact: 13 h 25 m', F.fmtMin(F.lengthMs(done) / 60000) === '13 h 25 m' && F.lengthMs(r) === null);
  check('a record open for more than three days is flagged as probably forgotten, never ended for her', F.forgotten({ startAt: '2026-10-17T10:00:00Z' }, now) === true && F.forgotten({ startAt: '2026-10-21T10:00:00Z' }, now) === false && !/endAt = now|auto/.test(src.split('function forgotten')[1].split('\n')[0]));
  S.setState({ fasting: { on: true, elig: { answers: { preg: 'no', bf: 'no', dm: 'no', ed: 'no', weight: 'no' }, at: 'x' }, records: [] } });
  var saved = F.saveRecord({ startLocal: Y2 + 'T20:15' }); var saved2 = F.saveRecord({ startLocal: Y1 + 'T06:00' });
  check('records are saved in state.fasting through setState (no diary type, nothing for Luna\'s filter to accept), and two open records are a conflict nobody resolves for her', F.records().length === 2 && F.openRecords().length === 2 && F.conflict() === true && S.TYPES.indexOf('fast') < 0 && S.list().length === 0 && !/S\(\)\.add\(|OvuStore\.add\(|TYPES/.test(src));
  F.saveRecord(Object.assign({}, saved2, { endLocal: Y1 + 'T09:30' })); F.deleteRecord(saved.id);
  check('ending one and deleting the other leaves one ended record and no conflict; the export carries it', F.records().length === 1 && F.openRecords().length === 0 && JSON.parse(S.exportJSON()).state.fasting.records.length === 1);
  /* eligibility */
  var allNo = { preg: 'no', bf: 'no', dm: 'no', ed: 'no', weight: 'no' };
  check('all five answered no opens the control; a yes or a not sure keeps it closed with the reason; the intro\'s pregnancy, breastfeeding and restrictive-eating answers win; trying to conceive is a labelled precaution', F.eligible(allNo, {}).ok === true && F.eligible(Object.assign({}, allNo, { dm: 'yes' }), {}).reasons.join() === 'dm' && F.eligible(Object.assign({}, allNo, { ed: 'unsure' }), {}).unknown.join() === 'ed' && F.eligible(allNo, { pregState: 'maybe' }).reasons.join() === 'preg' && F.eligible(allNo, { breastfeeding: 'yes' }).reasons.join() === 'bf' && F.eligible(allNo, { signals: ['restrict'] }).reasons.join() === 'ed' && F.eligible(allNo, { plans: 'ttc' }).ok === false && /precaution/.test(F.reasonText(F.eligible(allNo, { plans: 'ttc' }))) && /not sure/.test(F.reasonText(F.eligible(Object.assign({}, allNo, { dm: 'unsure' }), {}))));
  check('the five questions cover pregnancy, breastfeeding, blood sugar medicines, disordered eating and weight or age', F.QUESTIONS.map(function (q) { return q.key; }).join() === 'preg,bf,dm,ed,weight');
  /* the meal offer */
  var rec = { id: 'r1', startAt: '2026-10-21T02:00:00.000Z', updatedAt: 'u1' };
  check('a meal offers to end the record only when dated today, with a confirmed time, after the start; yesterday\'s meal, an unconfirmed time or a meal before the start offers nothing', !!F.offerFor(mk('m', '2026-10-21', '12:30', '2026-10-21T12:35:00'), rec, '2026-10-21') && F.offerFor(mk('m', '2026-10-20', '12:30', '2026-10-20T12:35:00'), rec, '2026-10-21') === null && F.offerFor(mk('m', '2026-10-21', '12:30', '2026-10-21T22:35:00'), rec, '2026-10-21') === null && F.offerFor(mk('m', '2026-10-21', '01:30', '2026-10-21T01:35:00'), { id: 'r1', startAt: '2026-10-21T04:00:00.000Z' }, '2026-10-21') === null && F.offerFor(mk('m', '2026-10-21', '12:30', '2026-10-21T12:35:00'), Object.assign({}, rec, { endAt: 'x' }), '2026-10-21') === null);
  /* copy and boundaries */
  var html = F.stripHTML();
  check('the strip never shows a running counter, a target, a streak or a heart; the care line says to call the local emergency number and gives the hypo advice; lengths appear only for ended records', !/streak|target|goal|longest|♥|hearts?\b/i.test(html) && /call your local emergency number/.test(html) && /treat a low as your care team/.test(html) && /Entries, not measured fasting/.test(html) && !/since .* \(\d+ h/.test(html) && src.indexOf('—') < 0 && !/gpt|claude|doubao|deepseek/i.test(src));
  check('the module pays no hearts, writes no diary entry and leaves the summary agents alone', !/OvuRewards|\.award\(|afterSave\(|summary\.food/.test(src));
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), js = fs.readFileSync(path.join(root, 'journal.html'), 'utf8'), ev = fs.readFileSync(path.join(root, 'ovu-evidence.js'), 'utf8');
  check('the food sheet carries the strip, confirms a time she touched, offers after a save, and the journal loads the block; evidence E81 to E90 exist with no em dash', /id="fastStrip"/.test(rs) && /timeSet: fdTimeTouched/.test(rs) && /OvuFasting\.onMealSaved\(ev\)/.test(rs) && /OvuFasting\.onClick\(e\)/.test(rs) && /ovu-fasting\.js/.test(js) && /fastingBlock/.test(js) && /<script src="ovu-fasting\.js"><\/script>/.test(fs.readFileSync(path.join(root, 'room.html'), 'utf8')) && ['E81', 'E82', 'E83', 'E84', 'E85', 'E86', 'E87', 'E88', 'E89', 'E90'].every(function (e) { return ev.indexOf("id: '" + e + "'") > -1; }) && ev.indexOf('—') < 0);
})();

(function podcastOrder() {
  console.log('2k18. Listen with Erin (21 Oct): the playable episodes shuffle by seed, the locked ones sit at the bottom oldest first, Shuffle gives a new order');
  var w = fresh('2026-10-21'); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-podcast.js'), 'utf8'), w, { filename: 'ovu-podcast.js' });
  var P = w.OvuPodcast, eps = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/erin-podcasts.json'), 'utf8')).episodes;
  var ids = function (l) { return l.map(function (e) { return e.id; }); }, prem = function (e) { return e.access === 'premium'; };
  var free = eps.filter(function (e) { return !prem(e); }), locked = eps.filter(prem), byDate = locked.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  var o1 = P.order(eps, false, 7), o2 = P.order(eps, false, 7), o3 = P.order(eps, false, 8);
  check('every episode appears once, and the same seed gives the same order', o1.length === eps.length && new Set(ids(o1)).size === eps.length && ids(o1).join() === ids(o2).join());
  check('the locked episodes come last, oldest first, and every playable one comes before them', ids(o1).slice(free.length).join() === ids(byDate).join() && o1.slice(0, free.length).every(function (e) { return !prem(e); }));
  check('another seed shuffles the playable ones into another order', ids(o1.slice(0, free.length)).join() !== ids(o3.slice(0, free.length)).join() && ids(o1.slice(0, free.length)).join() !== ids(free).join());
  var all = P.order(eps, true, 7), firstPrem = all.map(prem).indexOf(true), lastFree = all.length - 1 - all.slice().reverse().map(prem).indexOf(false);
  check('with Plus on nothing is held back: the Plus episodes join the shuffle', all.length === eps.length && firstPrem > -1 && firstPrem < lastFree);
  check('a missing seed still returns every episode, locked last', (function () { var o = P.order(eps, false); return o.length === eps.length && o.slice(free.length).every(prem); })());
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  check('the Listen sheet lists through the order with one seed per sheet, a Shuffle button, and a small label before the locked group', /POD\.order\(d\.episodes, on, podSeed\)/.test(rs) && /id="podShuffle"/.test(rs) && /With Rhythme Plus/.test(rs) && /podSeed = Date\.now\(\) \^/.test(rs));
})();

(function plazaRooms() {
  console.log('2k21r. plaza rooms and room chat (22 Oct): the phone and the server keep one set of rules; the words stay world-wide and calm');
  var w = { document: undefined }; w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-rooms.js'), 'utf8'), vm.createContext(w), { filename: 'ovu-rooms.js' });
  var X = w.OvuRooms, cases = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'fixtures', 'plaza_text_cases.json'), 'utf8'));
  var mig = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261022120000_plaza_rooms_chat.sql'), 'utf8'), dry = fs.readFileSync(path.join(root, 'tools', 'db', 'plaza_rooms_dryrun.sql'), 'utf8');
  var sq = function (t) { return "'" + t.replace(/'/g, "''") + "'"; };
  var badText = cases.text.filter(function (c) { return X.textProblem(c.text) !== c.problem; }).map(function (c) { return c.text.slice(0, 30) + ' -> ' + X.textProblem(c.text); });
  check('every text case reads the same on the phone as the fixture says (' + cases.text.length + ' cases)' + (badText.length ? ': ' + badText.join(' | ') : ''), !badText.length);
  var badHold = cases.hold.filter(function (c) { return X.holdWhy(c.text, c.noNews) !== c.hold; }).map(function (c) { return c.text + ' -> ' + X.holdWhy(c.text, c.noNews); });
  check('every hold case reads the same on the phone as the fixture says (' + cases.hold.length + ' cases)' + (badHold.length ? ': ' + badHold.join(' | ') : ''), !badHold.length);
  var inDry = function (c, fn, extra) { var lit = c.text.length > 100 ? "repeat('a', " + c.text.length + ")" : sq(c.text); return dry.indexOf(fn + '(' + lit + extra) > -1; };
  var missText = cases.text.filter(function (c) { return !inDry(c, 'plaza.text_problem', ')' + (c.problem ? " = '" + c.problem + "'" : ' is null')); }).map(function (c) { return c.text.slice(0, 30); });
  var missHold = cases.hold.filter(function (c) { return !inDry(c, 'plaza.hold_why', ', ' + c.noNews + ')' + (c.hold ? " = '" + c.hold + "'" : ' is null')); }).map(function (c) { return c.text; });
  check('the server dry run checks the very same cases with the same answers' + (missText.concat(missHold).length ? ': missing ' + missText.concat(missHold).join(' | ') : ''), !missText.length && !missHold.length);
  /* the phone's phrase and word lists equal the rows the migration inserts */
  var rows = function (table) { var m = new RegExp('insert into public\\.' + table + ' \\([^)]*\\) values([\\s\\S]*?)\\non conflict').exec(mig); var out = []; if (m) m[1].replace(/\('((?:[^']|'')*)', '(\w+)'\)/g, function (_, a, b) { out.push([a.replace(/''/g, "'"), b]); }); return out; };
  var hp = rows('plaza_hold_phrases'), pw = rows('plaza_words');
  var phoneHold = []; Object.keys(X.HOLD).forEach(function (k) { X.HOLD[k].forEach(function (p) { phoneHold.push([p, k]); }); });
  var key = function (l) { return l.map(function (x) { return x[1] + ':' + x[0]; }).sort().join('|'); };
  check('the hold phrases on the phone equal the migration\'s rows (' + hp.length + ')', hp.length > 50 && key(hp) === key(phoneHold));
  check('the message word list on the phone equals the migration\'s rows (' + pw.length + '), and health words stay allowed', pw.length > 10 && key(pw) === key(Object.keys(X.MSG_WORDS).map(function (k) { return [k, X.MSG_WORDS[k]]; }))
    && ['sex', 'rape', 'suicide', 'kill', 'shit', 'fuck', 'instagram', 'tiktok'].every(function (t) { return !X.MSG_WORDS[t]; }));
  check('room counts say who joined, full rooms and closed ones; the strip says who is here now', X.roomCount({ people: 0, capacity: 12 }) === 'Nobody joined yet' && X.roomCount({ people: 5, capacity: 12 }) === '5 joined'
    && X.roomCount({ people: 12, capacity: 12 }) === '12 of 12 joined, full' && X.roomCount({ open: false }) === 'Closed for now' && X.hereNow(0) === 'Nobody here now' && X.hereNow(7) === '7 here now');
  check('a full room names the rooms in the group with space, or asks her to try again', X.fullText({ name: 'Vent', suggest: [{ name: 'Chat' }, { name: 'Wins' }] }) === 'Vent is full right now. Chat and Wins have space.'
    && X.fullText({ name: 'Wins', suggest: [{ name: 'Chat' }] }) === 'Wins is full right now. Chat has space.' && X.fullText({ name: 'Quiet room', suggest: [] }) === 'Quiet room is full right now. Try again in a little while.');
  var have = [{ id: 1, body: 'a', handle: 'h1' }, { id: 2, body: 'b', handle: 'h2' }, { id: 3, body: 'c', handle: 'h3', mine: true }];
  var merged = X.mergeFeed(have, { ids: [1, 3, 4, 5], messages: [{ id: 4, body: 'd', handle: 'h2' }, { id: 5, body: 'e', handle: 'h4' }] }, ['h4']);
  check('the feed keeps only the server\'s latest visible ids (a hidden, blocked or expired message leaves), adds new rows in order, and leaves out people muted on this phone (never her own)', merged.map(function (m) { return m.id; }).join() === '1,3,4'
    && X.mergeFeed(have, { ids: [], messages: [] }, []).length === 0 && X.mergeFeed([], { ids: [3], messages: [{ id: 3, handle: 'h4', mine: true }] }, ['h4']).length === 1);
  check('every group has its door sign on disk, and a group the phone does not know gets none (a plain icon)', Object.keys(X.DOORS).length === 6 && Object.keys(X.DOORS).every(function (id) { return fs.existsSync(path.join(root, X.doorImg(id))); }) && X.doorImg('night-owls') === null);
  var words = [X.HELP, X.REMINDER, X.DOCTOR, X.WORDS, X.MODE.review, X.MODE.live].concat(Object.keys(X.NOTES).map(function (k) { return X.NOTES[k]; }), Object.keys(X.WHY).map(function (k) { return X.WHY[k]; }),
    Object.keys(X.PROBLEMS).map(function (k) { return X.PROBLEMS[k]; }), X.REASONS.map(function (r) { return r[1]; }));
  var src = fs.readFileSync(path.join(root, 'ovu-rooms.js'), 'utf8');
  check('help is world-wide (local emergency number, nearest emergency department, findahelpline.com), never one country\'s numbers', /local emergency number/.test(X.HELP) && /nearest emergency department/.test(X.HELP) && /findahelpline\.com/.test(X.HELP) && /local emergency number/.test(X.REMINDER)
    && words.every(function (t) { return !/\b(995|999|911|112|1767|1771|SOS)\b/.test(t); }));
  check('no em dash, no emoji and no vendor or model name in the module; every room kind has its note and icon; the quiet room keeps news and advice out', src.indexOf('—') < 0 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src)
    && words.every(function (t) { return !/\b(AI|GPT|Claude|Doubao|Supabase|Seedream|model)\b/.test(t); }) && ['chat', 'wins', 'vent', 'doctor', 'topic', 'quiet'].every(function (k) { return X.NOTES[k] && X.KIND_ICON[k]; })
    && /No pregnancy or birth news, no advice/.test(X.NOTES.quiet));
  check('the Room chat words say what is shown to whom, 24 hours, the hour after, held messages and reports (90 days, then a year), not medical advice, not watched around the clock, and that off deletes', /people in that group/.test(X.WORDS) && /24 hours/.test(X.WORDS)
    && /within an hour/.test(X.WORDS) && /wait for a person/.test(X.WORDS) && /90 days/.test(X.WORDS) && /then for a year/.test(X.WORDS) && /not medical advice/.test(X.WORDS) && /around the clock/.test(X.WORDS) && /messages are then deleted/.test(X.WORDS));
  check('the module stands down without a room page: only the pure rules exist', typeof X.attach === 'undefined' && typeof X.state === 'undefined');
  var html = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), today = fs.readFileSync(path.join(root, 'ovu-today.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8');
  check('room.html loads the rooms after Plaza friends and before the Today card; the Channel pane keeps the rooms\' two places across redraws; the styles exist', html.indexOf('ovu-friends.js') < html.indexOf('ovu-rooms.js') && html.indexOf('ovu-rooms.js') < html.indexOf('ovu-today.js')
    && /id="chGroups"/.test(today) && /id="chRooms"/.test(today) && /if \(!el\.querySelector\('\.chmain'\)\)/.test(today) && /\.rmgroups\{/.test(css) && /\.rmmsgs\{/.test(css) && /\.rmhelp\{/.test(css));
  check('the server keeps reading open only to a shown card in the group now, writing behind Room chat, a review mode by default, and an hourly clean-up', /when exists \(select 1 from public\.social_profiles s where s\.user_id = p_uid and s\.hidden\) then 'hidden'/.test(mig)
    && /if not public\.consent_allows\(uid, 'plaza_chat'\) then return jsonb_build_object\('ok', false, 'why', 'notice'\)/.test(mig) && /\('mode', 'review'\)/.test(mig) && /cron\.schedule\('rhythme-plaza-chat-sweep', '7 \* \* \* \*'/.test(mig));
  /* no live mode in this migration: word rules cannot catch every way of telling someone to stop a medicine, so every
     message waits for a person (Codex diff review round 4, A7); a withdrawal reaches the rooms at once (B2) */
  var consentSrc = fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8');
  var tldSql = /create or replace function plaza\.tlds\(\) returns text[\s\S]*?select '([^']*)'::text/.exec(mig);
  check('the phone and the server know the same web-address endings (IANA list, ' + X.TLDS.trim().split(' ').length + ' of three letters or more)', !!tldSql && tldSql[1] === X.TLDS && X.TLDS.split(' ').length > 1000 && / scot | help | com | health /.test(X.TLDS) && !/ thanks /.test(X.TLDS));
  check('the migration holds the rooms in review mode with a check (live needs its own migration), and a consent withdrawal reaches the rooms at once', /constraint plaza_flags_review_only check \(key <> 'mode' or value = 'review'\)/.test(mig)
    && /root\.OvuRoom\.emit\('consent', purposeId, ev\.action\)/.test(consentSrc) && /R\.on\('consent'/.test(src));
})();

(function todayTabs() {
  console.log('2k21. the Today card’s three tabs (21 Oct): Today, Channel once she has joined a plaza group, Inventory from her own state');
  var w = { document: undefined }; w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-today.js'), 'utf8'), vm.createContext(w), { filename: 'ovu-today.js' });
  var T = w.OvuToday;
  var so = T.channelModel({ signedIn: false });
  check('signed out: the channel asks her to sign in from You and offers nothing else', so.state === 'signedout' && so.actions.length === 1 && so.actions[0].id === 'signin' && /Sign in from You/.test(so.text) && /join a group/.test(so.text));
  var ng = T.channelModel({ signedIn: true, inPlaza: false }), ngp = T.channelModel({ signedIn: true, inPlaza: true });
  check('signed in with no group: walk to the plaza, or choose a group when she already stands there; the groups are described, not listed (their names come from the server)', ng.state === 'nogroup' && ng.actions[0].id === 'plaza' && ngp.actions[0].id === 'groups' && /one for everyone, and groups by stage of life/.test(ng.text) && /rooms/.test(ng.text));
  var rem = T.channelModel({ signedIn: true, inPlaza: false, joined: null, remembered: 'pcos', servers: null, friends: 'No friends yet', badge: 0, prompt: 'What helped today?' });
  check('a remembered group opens its channel away from the plaza: its name from the local list, the counted-while-there line, the prompt, Plaza friends, and a walk button', rem.state === 'joined' && rem.title === 'PCOS and endometriosis' && /^Saved group/.test(rem.text) && rem.icon === 'water_drop' && !rem.live && /counted/.test(rem.text) && /while you stand in the plaza/.test(rem.text) && rem.prompt === 'What helped today?' && rem.friends === 'No friends yet' && rem.actions.map(function (a) { return a.id; }).join() === 'board,friends,plaza');
  var live = T.channelModel({ signedIn: true, inPlaza: true, joined: { id: 'menopause', name: 'Menopause (server name)', people: 4 }, remembered: 'pcos', servers: [{ id: 'menopause', name: 'Menopause' }], friends: '2 friends · 1 new', badge: 1, prompt: 'p' });
  var one = T.channelModel({ signedIn: true, inPlaza: true, joined: { id: 'everyone', people: 1 } }), off = T.channelModel({ signedIn: true, inPlaza: true, joined: { id: 'everyone', people: 3 }, offline: true });
  check('counted in a group now: the live group wins over the remembered one, the count includes her, the badge rides on Plaza friends, and no walk button', live.state === 'joined' && live.live && live.title === 'Menopause (server name)' && live.text === 'In the plaza · 4 people here, with you' && live.badge === 1 && live.actions.length === 2 && live.actions[1].badge === 1 && one.text === 'In the plaza · Just you here for now' && one.title === 'Everyone' && /In the plaza · reconnecting/.test(off.text));
  check('group names: the server list wins, the local list covers the four groups, and an unknown id reads as words', T.groupName('pcos', [{ id: 'pcos', name: 'PCOS circle' }]) === 'PCOS circle' && T.groupName('trying-to-conceive') === 'Trying to conceive' && T.groupName('night-owls') === 'Night owls' && T.hereText(0) === 'Just you here for now' && T.hereText(2) === '2 people here, with you');
  var items = [{ id: 'lamp', name: 'Crescent floor lamp', kind: 'furniture' }, { id: 'beanbag', name: 'Bunny beanbag', kind: 'furniture' }, { id: 'house', name: 'Two-storey dream house', kind: 'home' }, { id: 'cat', name: 'Kitten', kind: 'pet' }, { id: 'dog', name: 'Puppy', kind: 'pet' }, { id: 'acc-bow', name: 'Satin bow', kind: 'accessory' }, { id: 'acc-hat', name: 'Party hat', kind: 'accessory' }, { id: 'treat-fish', name: 'Fish biscuits', kind: 'treat' }, { id: 'treat-cake', name: 'Pupcake', kind: 'treat' }];
  var inv = T.inventoryModel({ staplePics: { rice: 'staple-rice' }, hearts: 230, earned: 410, items: items, owned: ['lamp', 'beanbag', 'house', 'cat', 'acc-bow', 'acc-hat', 'ghost'], placed: { lamp: true, cat: true }, treats: { 'treat-fish': 3, 'treat-cake': 0 }, wear: { cat: 'acc-bow' }, petNames: { cat: 'Mochi' }, homeId: 'house',
    farm: { harvest: { radish: 4, tomato: 1, ginger: 2, weeds: 9 }, pantry: { egg: 2, milk: 1, onsenegg: 0 }, seeds: { carrot: 2, radish: 0 }, tools: { bigcan: true, shelf: false } }, crops: { radish: { name: 'Radish', plural: 'radishes' }, tomato: { name: 'Tomato', plural: 'tomatoes' }, carrot: { name: 'Carrot', plural: 'carrots' } }, tools: { bigcan: { name: 'Big watering can' }, shelf: { name: 'Seed shelf' } },
    herbs: { ginger: { name: 'Ginger', plural: 'pieces of ginger' }, pandan: { name: 'Pandan', plural: 'pandan leaves' } }, herbSeeds: { pandan: 2, ginger: 0 }, herbBeds: { h1: { herb: 'ginger' }, h2: { herb: 'ginger' }, h3: { herb: 'nope' } },
    staples: { rice: 2, egg: 2, tofu: 0 }, stapleNames: { rice: { name: 'Rice' }, egg: { name: 'Eggs', pantry: true }, tofu: { name: 'Tofu' } }, outfits: [{ id: 'base', name: 'Cosy knit' }, { id: 'party', name: 'Lilac tulle' }], outfit: 'party',
    book: { grouper: { n: 2 }, unknown: { n: 1 } }, speciesNames: { grouper: { name: 'Orange-spotted grouper' } }, casts: 5, floats: { mint: '2026-10-20' }, float: 'mint', floatNames: { mint: { name: 'Mint' } }, letters: [{ id: 'l1' }] });
  var sec = {}; inv.sections.forEach(function (s) { sec[s.id] = s; });
  var row = function (id, i) { return sec[id].rows[i]; }, names = function (id) { return sec[id].rows.map(function (r) { return r.name; }).join('|'); };
  check('inventory: hearts and the total earned; things say in the room, put away, where she lives; an id no longer in the shop is skipped', inv.hearts === 230 && inv.earned === 410 && names('things') === 'Crescent floor lamp|Bunny beanbag|Two-storey dream house' && row('things', 0).sub === 'In your room' && row('things', 1).sub === 'Put away' && row('things', 2).sub === 'Where you live now');
  check('inventory: the pet by her name wearing the bow, the bow worn by her, the hat in the drawer, three fish biscuits left and no empty pupcake row', names('pets') === 'Mochi|Satin bow|Party hat|Fish biscuits' && row('pets', 0).sub === 'At home, wearing the satin bow' && row('pets', 1).sub === 'Worn by Mochi' && row('pets', 2).sub === 'In the drawer' && row('pets', 3).count === 3);
  check('inventory: the wardrobe shows each outfit she can wear on its hanger and marks the one worn (22 Oct: pictures, not a count)', names('wardrobe') === 'Cosy knit|Lilac tulle' && row('wardrobe', 1).sub === 'Wearing now' && row('wardrobe', 0).img === 'assets/room/boutique/rail-base.webp');
  check('inventory: the basket in plurals with the greenhouse herb, no unknown crop, the pantry in plurals, seeds, the tool in the shed and not the one she lacks', names('farm') === 'Radishes|Tomato|Pieces of ginger|Eggs|Bottle of milk|Carrot seeds|Big watering can' && row('farm', 0).count === 4 && row('farm', 1).count === 1 && row('farm', 6).sub === 'In the shed');
  check('inventory: cuttings to plant and what grows in how many planters; a bed with an unknown herb is ignored', names('greenhouse') === 'Pandan to plant|Ginger' && row('greenhouse', 0).count === 2 && row('greenhouse', 1).sub === 'Growing in 2 planters');
  check('inventory: staples skip the pantry egg and zero counts; the harbour names the fish met and the casts; the float on the line and the letter waiting', names('kitchen') === 'Rice' && names('harbour') === 'Orange-spotted grouper|5 casts|Mint float|1 letter' && row('harbour', 0).count === 2 && row('harbour', 2).sub === 'On the line' && row('harbour', 3).sub === 'waiting at the post box' && inv.total === 23);
  check('inventory pictures (Jamie, 22 Oct: "no words... picture of the inventory - fresh egg / hot spring cooked egg"): the pantry, seeds, shed, crops, herbs and the float have their own art; rows without art carry an icon; every picture named here exists', row('farm', 3).img === 'assets/room/inventory/inv-egg.webp' && row('farm', 5).img === 'assets/room/inventory/inv-seeds.webp' && row('farm', 5).badge === 'assets/food/crop-carrot.webp' && row('farm', 6).img === 'assets/room/dream/gh-can.webp' && row('farm', 0).img === 'assets/food/crop-radish.webp' && row('farm', 2).img === 'assets/room/dream/gh-ginger.webp' && row('harbour', 2).img === 'assets/room/inventory/inv-float.webp' && row('harbour', 3).icon === 'mail' && inv.sections.every(function (s) { return s.tab && s.rows.every(function (r) { return r.img || r.icon; }); }) && ['inv-egg', 'inv-milk', 'inv-onsenegg', 'inv-seeds', 'inv-shelf', 'inv-float'].every(function (n) { return fs.existsSync(path.join(root, 'assets/room/inventory/' + n + '.webp')); }));
  var dinv = T.inventoryModel({ farm: { dishes: { pumpkinsoup: 2, nope: 1 } }, dishNames: { pumpkinsoup: 'Pumpkin soup' } }), dsec = dinv.sections.filter(function (s) { return s.id === 'dishes'; })[0];
  check('inventory: cooked dishes sit in the bag with their picture and count; unknown ids are left out (22 Oct)', dsec && dsec.rows.length === 1 && dsec.rows[0].name === 'Pumpkin soup' && dsec.rows[0].count === 2 && dsec.rows[0].img === 'assets/food/dish-pumpkinsoup.webp');
  var empty = T.inventoryModel({});
  check('inventory: with nothing at all every section carries one plain invitation, no counts, and the total is zero', empty.sections.length === 8 && empty.total === 0 && empty.hearts === 0 && empty.sections.every(function (s) { return s.rows.length === 0 && s.empty.length > 10 && s.empty.indexOf('—') < 0; }));
  var html = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8'), mod = fs.readFileSync(path.join(root, 'ovu-today.js'), 'utf8'), cm = fs.readFileSync(path.join(root, 'ovu-community.js'), 'utf8');
  check('room.html holds the tablist with three tabs and three panes, the check-in inside the Today pane, and loads the module after Plaza friends', /role="tablist"[^>]*id="deckTabs"/.test(html) && (html.match(/data-deck="(today|channel|inventory)"/g) || []).length === 3 && /id="deckToday"[^>]*role="tabpanel"/.test(html) && html.indexOf('id="deckToday"') < html.indexOf('id="tiles"') && html.indexOf('id="tiles"') < html.indexOf('id="deckChannel"') && html.indexOf('ovu-friends.js') < html.indexOf('ovu-today.js'));
  check('room.js redraws the panes with the deck and exports the outfits; the board opens from the module; the styles exist and no night rule is left (the night palette is retired, 22 Oct); no em dash in the words', /if \(window\.OvuToday\) OvuToday\.render\(\)/.test(rs) && /OUTFITS: OUTFITS,/.test(rs) && /C\.openBoard = openBoard/.test(cm) && /\.decktabs\{/.test(css) && /\.invlist li\{/.test(css) && !/html\[data-sky="?night"?\]/.test(css) && mod.indexOf('—') < 0);
})();

(function drops() {
  console.log('2k22. the drops (21 Oct): her birthday (one wish, who she is when she adds the year, and a direction for the year), and the Starlight gown as a Rhythme Plus drop');
  var w = { document: undefined }; w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-birthday.js'), 'utf8'), vm.createContext(w), { filename: 'ovu-birthday.js' });
  var B = w.OvuBirthday;
  check('a birthday is a month and a day only: 10-21 and 2-29 are kept, 13-01, 02-30, a year and nothing are refused', B.clean('10-21') === '10-21' && B.clean('2-29') === '02-29' && B.clean('13-01') === null && B.clean('02-30') === null && B.clean('1987-10-21') === null && B.clean('') === null && B.clean(null) === null);
  check('the day and the six days after are the week, across a year end; 29 February falls on the 28th in other years', B.dayOf('2026-10-21', '10-21') === 0 && B.dayOf('2026-10-27', '10-21') === 6 && B.dayOf('2026-10-28', '10-21') === -1 && B.dayOf('2026-10-20', '10-21') === -1 && B.dayOf('2027-01-02', '12-30') === 3 && B.dayOf('2026-02-28', '02-29') === 0 && B.dayOf('2028-02-29', '02-29') === 0 && B.dayOf('2028-02-28', '02-29') === -1 && B.dayOf('2026-10-21', null) === -1 && B.dayOf('nope', '10-21') === -1);
  check('the birthday year the week belongs to follows the day, so a week that crosses New Year keeps its year; outside the week there is none', B.yearOf('2026-10-24', '10-21') === 2026 && B.yearOf('2027-01-02', '12-30') === 2026 && B.yearOf('2026-05-05', '10-21') === null && B.text('10-21') === '21 October' && B.text('02-09') === '9 February');
  check('the personal year adds the digits of the month, the day and the year the birthday falls in, reduced to 1 to 9', B.personalYear('10-21', 2026) === 5 && B.personalYear('10-21', 2027) === 6 && B.personalYear('02-29', 2027) === 6 && B.personalYear('01-01', 2025) === 2 && B.personalYear('12-31', 2026) === 8 && B.personalYear('07-04', 2026) === 3 && B.personalYear('09-09', 2025) === 9 && B.personalYear('nope', 2026) === 0 && B.personalYear('10-21', 0) === 0);
  var seenN = {}, badN = 0; for (var yy = 2026; yy < 2035; yy++) for (var mo = 1; mo <= 12; mo++) for (var dd = 1; dd <= 31; dd++) { var mm = B.clean(mo + '-' + dd); if (!mm) continue; var pn = B.personalYear(mm, yy); if (!(pn >= 1 && pn <= 9)) badN++; seenN[pn] = 1; }
  check('every birthday in every year from 2026 to 2034 gives a number from 1 to 9, and all nine years occur', badN === 0 && Object.keys(seenN).length === 9);
  var Y = B.YEARS, words = Object.keys(Y).map(function (k) { return Y[k].title + ' ' + Y[k].text + ' ' + Y[k].step; }).join(' ');
  check('nine directions, each a title, a line and a first step: invitations, not orders or predictions, nothing about health, no em dash', Object.keys(Y).join() === '1,2,3,4,5,6,7,8,9' && Object.keys(Y).every(function (k) { return /^A year for /.test(Y[k].title) && Y[k].text.length > 40 && Y[k].step.length > 10; }) && !/\b(must|should|will happen|guarantee|destiny|diagnos\w*|symptoms?|periods?|fertil\w*|pregnan\w*|cure|treat\w*)\b/i.test(words) && !/answers come|grows slowly/.test(words) && words.indexOf('—') < 0);
  var cd = B.card({ name: ' Mei ', mmdd: '10-21', year: 2026, canGown: false }), cd2 = B.card({ name: 'Mei', mmdd: '10-21', year: 2026 });
  check('the card: her name, the date in words, one warm wish (the same for the same birthday and year), and the direction for a 5 year; the party outfit while the gown is locked', cd.title === 'Happy birthday, Mei!' && cd.date === '21 October' && B.LINES.indexOf(cd.wish) > -1 && cd.wish === cd2.wish && cd.number === 5 && cd.direction === B.YEARS[5] && cd.outfit === 'party' && B.card({ mmdd: '10-21', year: 2026, canGown: true }).outfit === 'gown');
  var blank = B.card({ name: '   ', mmdd: '10-21', year: 2027 }), none = B.card({ mmdd: null, year: 2026 });
  check('a blank name reads Happy birthday!, the next birthday brings the next direction, and without a birthday there is no direction', blank.title === 'Happy birthday!' && blank.number === 6 && blank.direction === B.YEARS[6] && none.direction === null && none.number === 0);
  var fake = { getElementById: function (id) { return ({ tMonth: { value: '10' }, tDay: { value: '21' }, tYear: { value: '0' }, uMonth: { value: '10' }, uDay: { value: '21' }, uYear: { value: '1987' }, kMonth: { value: '10' }, kDay: { value: '22' }, kYear: { value: '2008' }, xMonth: { value: '2' }, xDay: { value: '30' }, xYear: { value: '0' } })[id] || null; } }, fh = B.fieldHTML('10-21', 1987, 't', '2026-10-21');
  check('the shared field: three selects, month, day and an optional year from 18 years back to 1900 (the bounds the year rule accepts), with her choices kept', /id="tMonth"/.test(fh) && /id="tDay"/.test(fh) && /id="tYear"/.test(fh) && /<option value="0">Year \(optional\)<\/option>/.test(fh) && /<option value="10" selected>October/.test(fh) && /<option value="21" selected>21/.test(fh) && /<option value="1987" selected>1987/.test(fh) && /<option value="2008">2008/.test(fh) && fh.indexOf('value="2009"') < 0 && /<option value="1900">1900/.test(fh) && fh.indexOf('value="1899"') < 0);
  var r1 = B.readField(fake, 't', '2026-10-21'), r2 = B.readField(fake, 'u', '2026-10-21'), r3 = B.readField(fake, 'k', '2026-10-21'), r4 = B.readField(fake, 'x', '2026-10-21'), r5 = B.readField(fake, 'q', '2026-10-21');
  check('reading the field: no year is fine, a year is kept, a 17-year-old is refused kindly, an impossible day asks again, nothing chosen is nothing', r1.birthday === '10-21' && r1.year === null && !r1.error && r2.birthday === '10-21' && r2.year === 1987 && !r2.error && r3.birthday === '10-22' && r3.year === null && /18 and over/.test(r3.error) && r4.birthday === null && /month and a day/.test(r4.error) && r5.birthday === null && !r5.error);
  check('the year rule: 18 today is fine, 18 tomorrow is not, 29 February needs a leap year, a year before 1900 or after this year is refused', B.yearError(2008, '10-21', '2026-10-21') === '' && /18 and over/.test(B.yearError(2008, '10-22', '2026-10-21')) && B.yearError(1988, '02-29', '2026-10-21') === '' && /29 February/.test(B.yearError(1987, '02-29', '2026-10-21')) && /from the list/.test(B.yearError(1899, '05-05', '2026-10-21')) && /from the list/.test(B.yearError(2027, '05-05', '2026-10-21')) && /month and the day/.test(B.yearError(1987, null, '2026-10-21')));
  var fhd = B.fieldHTML(null, null, 'd', '2026-10-21', { m: '2', d: '30', y: '2008' }), rv1 = B.readValues('2', '30', '0', '2026-10-21'), rv2 = B.readValues('10', '21', '1987', '2026-10-21'), rv3 = B.readValues('11', '15', '2008', '2026-10-21');
  check('a draft she left with something to fix comes back exactly as chosen, and the values read the same way as the field', /<option value="2" selected>February/.test(fhd) && /<option value="30" selected>30/.test(fhd) && /<option value="2008" selected>2008/.test(fhd) && rv1.birthday === null && /month and a day/.test(rv1.error) && rv2.birthday === '10-21' && rv2.year === 1987 && !rv2.error && rv3.year === null && /18 and over/.test(rv3.error));
  var FIX = '139043489212657110626195177375991605592473450214462185263179251961653481897565078761252949183443954057034674189470922862659531956538950487879646178775173390744717864520477658645435941114778166779231410037993872360307944477868134639952520185777417968039147981874238598069284771163148532893865241339130', mr = (function (seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(2110), dimF = function (m, y) { return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }, got = '';
  for (var fi = 0; fi < 300; fi++) { var fy = 1930 + Math.floor(mr() * 80), fm = 1 + Math.floor(mr() * 12), fd = 1 + Math.floor(mr() * dimF(fm, fy)); got += String(B.dayStem(fy, fm, fd)); }
  check('the Day Master matches YourDigitalDNA\'s engine (hour unknown) on 300 random dates, and the published anchors: 7 January 2000 is a Jia day, 1 January 2000 a Wu day', got === FIX && B.dayStem(2000, 1, 7) === 0 && B.dayStem(2000, 1, 1) === 4 && B.dayMaster(2000, '01-07').name === 'The Pillar' && B.dayMaster(2000, '01-01').name === 'The Mountain');
  var DMs = B.DAY_MASTERS, dmw = DMs.map(function (x) { return x.name + ' ' + x.line + ' ' + x.reframe; }).join(' ');
  check('ten Day Masters in stem order, each a name, a line and a reframe, with no em dash and nothing about health', DMs.length === 10 && DMs.map(function (x) { return x.stem; }).join('') === '甲乙丙丁戊己庚辛壬癸' && DMs.every(function (x) { return /^The /.test(x.name) && x.line.length > 20 && x.reframe.length > 30; }) && dmw.indexOf('—') < 0 && !/\b(diagnos\w*|symptoms?|periods?|fertil\w*|pregnan\w*|cure|treat\w*|illness|disease)\b/i.test(dmw));
  var cw = B.card({ name: 'Mei', mmdd: '01-07', year: 2027, birthYear: 2000 }), cn = B.card({ name: 'Mei', mmdd: '01-07', year: 2027 }), cb = B.card({ name: 'Mei', mmdd: '02-29', year: 2027, birthYear: 1987 });
  check('with a birth year the card adds who she is; without one, or with a year that has no such day, it does not', cw.who === B.DAY_MASTERS[0] && cw.direction === B.YEARS[B.personalYear('01-07', 2027)] && cn.who === null && cb.who === null && B.dayMaster(2001, '02-29') === null);
  var SYb = fresh().OvuSync, pc = SYb.profileForCloud({ birthday: '10-21', birthYear: 1987, name: 'Mei' });
  check('her birthday and birth year never ride in the cloud copy; the rest of the profile does', SYb.DEVICE_KEYS.birthday === 1 && SYb.DEVICE_KEYS.birthYear === 1 && !('birthday' in pc) && !('birthYear' in pc) && pc.name === 'Mei');
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), fr = fs.readFileSync(path.join(root, 'ovu-friends.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8'), html = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), mod = fs.readFileSync(path.join(root, 'ovu-birthday.js'), 'utf8');
  var pv = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8'), tm = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
  var bstep = rs.indexOf("{ id: 'birthday', icon: 'celebration'"), fstep = rs.indexOf("{ id: 'final', icon: 'waving_hand'");
  check('the intro asks her birthday, month, day and an optional year, just before her name; it stays on this phone; a year that is not an adult\'s waits to be fixed; the age range no longer says never a date of birth', bstep > 0 && fstep > bstep && /id: 'birthday'[^\n]*type: 'birthday', key: 'birthday', optional: true/.test(rs) && /The year is optional and adds who you are, read from the day you were born\. It stays on this phone/.test(rs) && !/never asks your date of birth/.test(rs) && /Skip if you prefer; Rhythme is for adults\.'/.test(rs) && /OvuBirthday\.fieldHTML\(A\.birthday, A\.birthYear, 'onbB', S\.today\(\), bdr\)/.test(rs) && /if \(bv\.error\) A\._bdraft = OvuBirthday\.rawField\(document, 'onbB'\)/.test(rs) && /if \(bchk\.error\) \{ var bm = \$\('#onbBMsg'\)/.test(rs) && /if \(st\.type === 'birthday'\) \{ delete A\.birthYear; delete A\._bdraft; \}/.test(rs) && /patch\.birthYear = patch\.birthday && A\.birthYear && !OvuBirthday\.yearError\(A\.birthYear, patch\.birthday, S\.today\(\)\) \? Number\(A\.birthYear\) : null/.test(rs));
  var cj = fs.readFileSync(path.join(root, 'ovu-consent.js'), 'utf8'), NLINE = 'Your birthday is optional: a month and a day, with the year only if you add it, kept on this phone and used only for the birthday card.';
  check('the notice, the terms and the consent sheet say a birthday may be asked, the year only if she adds it, phone only, exports included, adults only; none still promises never a date of birth; the notice is version 5 and its hash covers the birthday line', /an optional age range and an optional birthday may be asked; a birth year that would make you under 18 is not accepted/.test(pv) && /<dt>Your birthday<\/dt><dd>If you give it, your birthday is a month and a day, with the year only if you add it\. It stays in this browser on this phone and is never part of the cloud backup; a copy of your data that you export yourself includes it/.test(pv) && /may ask for an optional age range and an optional birthday, with the year only if you choose to add it/.test(tm) && /<strong>Birthday<\/strong><\/td><td data-label="What">An optional birthday, a month and a day with the year only if you add it/.test(tm) && /On your phone, and in any copy of your data you export; never in your cloud backup/.test(tm) && html.indexOf(NLINE) > 0 && cj.indexOf(NLINE) > 0 && /NOTICE_LINES\.join/.test(cj) && /Notice version 5, 21 October 2026\./.test(html) && /For the age check we keep only this confirmation\./.test(html) && !/date of birth never is|never ask for your date of birth/.test(pv + tm) && !/never your date of birth|not your date of birth/.test(html) && /New in this notice: Rhythme can ask for your birthday/.test(cj));
  check('the older pages\' copy of the intro never keeps the birthday, old copies are cleaned, and both intro buttons start from her answers as they are now', /delete mirror\.birthday; delete mirror\.birthYear;/.test(rs) && /source: 'room' \}, mirror\)\)/.test(rs) && /function scrubMirror\(\)/.test(mod) && /scrubMirror\(\);\n/.test(mod) && /function introAnswers\(\)/.test(rs) && /openOnboarding\(0, introAnswers\(\)\)/.test(rs) && /openOnboarding\(0, S\.profile\(\)\.onboarded \? introAnswers\(\) : \{\}\)/.test(rs));
  check('the card says it is a reflection before the readings, names the BaZi section as one, looks again when a sheet closes or the day turns, and a stray birth year can be removed', /class="bnote">A reflection read from your birthday, not a prediction and not health advice\./.test(mod) && /A reflection from the day you were born, the BaZi way/.test(mod) && mod.indexOf('Who you are') < 0 && /R\.on\('sheetReplace', replaced\)/.test(mod) && /R\.on\('sheetHide', function \(\) \{[^\n]*recheck\(\); \}\)/.test(mod) && /root\.setInterval\(recheck, 30000\)/.test(mod) && /has = !!\(p0\.birthday \|\| p0\.birthYear\)/.test(mod) && /\.bnote\{/.test(css));
  check('the Starlight gown is in the wardrobe as a Plus drop: locked without Plus or tester mode, never worn from a stale profile, labelled, and in the plaza look list', /id: 'gown', name: 'Starlight gown'[^}]*plus: true/.test(rs) && /function outfitLocked\(id\)/.test(rs) && /if \(outfitLocked\(id\)\) id = 'base'/.test(rs) && /With Rhythme Plus/.test(rs) && /openPlus\(\); return; \} var pick = o\.dataset\.id;/.test(rs) && /\['gown', 'Starlight gown'\]/.test(fr));
  check('a renewed notice does not send a Help improve logging choice the account already holds, and the intro asks "happening today" afresh', /var held = improve && wasOn && an\.on === true && !!an\.uid && \(!me \|\| an\.uid === me\);/.test(cj) && /\(held && !me\)\) \{ record\(\); open\(\); return; \}/.test(cj) && /if \(held\) \{[\s\S]{0,900}OvuAuth\.syncImprove\(\)/.test(cj) && /off on your account, so it stays off here too/.test(cj) && /delete A0\.urgent;/.test(rs));
  var odd = B.fieldHTML('10-21', 2009, 'b', '2026-10-21'), old1899 = B.fieldHTML('10-21', 1899, 'b', '2026-10-21'), fine = B.fieldHTML('10-21', 1988, 'b', '2026-10-21');
  check('a stored year the list no longer offers is shown as it is, once, selected and marked as not used; a usable year is not', odd.split('value="2009"').length === 2 && /<option value="2009" selected>2009, not used<\/option>/.test(odd) && /<option value="1899" selected>1899, not used<\/option>/.test(old1899) && fine.indexOf('not used') < 0 && /<option value="1988" selected>1988<\/option>/.test(fine));
  var outfitIds = (rs.match(/\{ id: '([a-z-]+)', name: '[^']+', note: /g) || []).map(function (m) { return /id: '([a-z-]+)'/.exec(m)[1]; });
  var noBlink = outfitIds.filter(function (o) { return !fs.existsSync(path.join(root, 'assets/room/dream/avatar-' + o + '-blink.webp')); });
  check('she blinks: every outfit in the wardrobe has a closed-eye copy, the copy is fitted like its outfit, and blinking waits for her to stand idle in that outfit (never a pose, a walk, a twirl or reduced motion)', outfitIds.length >= 11 && noBlink.length === 0 && /avatar-\(\[a-z0-9-\]\+\?\)\(\?:-blink\)\?\\\.webp/.test(rs) && /function scheduleBlink\(\) \{ clearTimeout\(blinkT\); if \(reduced \|\| !blinkOn\) return;/.test(rs) && /blinkOn = !\(navigator && navigator\.webdriver\)/.test(rs) && /blinking: function \(on\)/.test(rs) && /cur\.slice\(-open\.length\) === open/.test(rs) && /!avatar\.classList\.contains\('twirling'\)/.test(rs), noBlink.join(','));
  check('a picked outfit twirls in: whole turns so she ends facing the way she started, the swap drawn exactly edge-on, the gown gets the Cinderella version, a newer pose or outfit is never painted over, any walk or a pose finishes it at once, a hop never takes it over, the walk home gives way to a practice, the wardrobe and the card step aside first, and silent changes or reduced motion never twirl', /var turns = glam \? 3 : 1, dur = glam \? 2300 : 1000, swapAt = glam \? 1\.25 : 0\.75/.test(rs) && /if \(!swapped && turn >= swapAt\) \{ turn = swapAt; swap\(\); \}/.test(rs) && /if \(gen !== undefined && gen !== imgGen\) return;/.test(rs) && /function twirl\(src, glam, done, gen\) \{\n    finishTwirl\(\); quietMoment\(\);/.test(rs) && /function joy\(\) \{ if \(twirlRun\) return;/.test(rs) && /function setPose\(pose\) \{\n    finishTwirl\(\);/.test(rs) && /hooks\.on\.walk = \[function \(\) \{ finishTwirl\(\); endMoment\(\); \}\];/.test(rs) && /if \(current \|\| practice \|\| session \|\| meditating \|\| arranging \|\| asleep\(\)\) return; goHome\(\); return; \}/.test(rs) && /function blink\(again\) \{\n    if \(reduced \|\| !blinkOn\) return;/.test(rs) && /twirl\(img\.src, id === 'gown'/.test(rs) && /if \(!silent && twirlOk\(\)\)/.test(rs) && /function twirlOk\(\) \{ return !reduced && !document\.hidden && !asleep\(\)/.test(rs) && /hooks\.on\.beforeWalk = \[function \(\) \{ finishTwirl\(\); endMoment\(\); \}\];/.test(rs) && /closeSheet\(\); setTimeout\(function \(\) \{ setOutfit\(pick\); \}, 260\);/.test(rs) && /R\.closeSheet\(\); root\.setTimeout\(function \(\) \{ if \(R\.setOutfit\) R\.setOutfit\(m\.outfit\); \}, 260\);/.test(mod) && /\.twirl-fx \.tw-s\{/.test(css) && /@media \(prefers-reduced-motion: reduce\)\{\.twirl-fx\{display:none\}\}/.test(css));
  check('Codex verification of the twirl (21 Oct): a cut turn (a walk, a pose, another outfit) says no closing line and plays no sound; the walk home waits while she arranges her things; the poof\u2019s wardrobe line is tracked, belongs to its own picture and a new turn clears it; a failed closed-eye picture is asked for again; a new outfit mid-walk drops the old walk strip at once', /function end\(cut\) \{/.test(rs) && /if \(!cut && run\.done\) run\.done\(\);/.test(rs) && /!glam && !cut && window\.OvuSound/.test(rs) && /function finishTwirl\(\) \{ if \(twirlRun\) twirlRun\.end\(true\); \}/.test(rs) && /!current && !arranging && !\(window\.OvuMorning/.test(rs) && /poofTimer = setTimeout\(function \(\) \{ poofTimer = null; avatar\.classList\.remove\('poofing'\); if \(gen === imgGen\) moment\('wardrobe'\); \}, 700\);/.test(rs) && /function quietMoment\(\) \{ clearTimeout\(momentTimer\); clearTimeout\(momentRetry\); momentRetry = null; clearTimeout\(poofTimer\);/.test(rs) && /im\.onerror = function \(\) \{ if \(blinkImgs\[o\] === im\) delete blinkImgs\[o\]; \};/.test(rs) && /if \(cyc\.on && cyc\.key && cyc\.key\.indexOf\(o \+ '-'\) !== 0\) cycleHide\(\);/.test(fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8')));
  check('the room greets her on the day, You holds the birthday field, the module loads after Plaza friends, the card has its wish and direction styles and no numbers grid, and no em dash in the words', /OvuBirthday\.isToday\(\) \? 'Happy birthday'/.test(rs) && /id="youBirthday"/.test(rs) && /OvuBirthday\.renderField/.test(rs) && html.indexOf('ovu-friends.js') < html.indexOf('ovu-birthday.js') && /\.prop\.event\{/.test(css) && /\.bcard\{/.test(css) && /\.bdir\{/.test(css) && /\.bwish\{/.test(css) && /\.bwho\{/.test(css) && css.indexOf('.bstats') < 0 && /\.outfit\.locked\{/.test(css) && mod.indexOf('—') < 0);
})();

(function birthdayAutoOpen() {
  console.log('2k22b. the birthday postcard opens by itself only into a settled, free room, and a sheet that covers it unseen does not use it up (Codex verification, 21 Oct)');
  function env(opts) {
    var T = 0, q = [], seq = 0, hooks = {}, sheet = { id: opts.sheet || null, body: node() }, log = [], sleeping = false, state = opts.state || {}, profile = { birthday: opts.mmdd, name: 'Mei' }, subs = [];
    function node() { var n = { ls: {}, style: {}, setAttribute: function () { }, addEventListener: function (k, f) { (n.ls[k] = n.ls[k] || []).push(f); }, fire: function (k) { (n.ls[k] || []).forEach(function (f) { f({ target: { closest: function () { return null; } }, stopPropagation: function () { } }); }); } }; return n; }
    var props = opts.cake ? { kids: [], querySelectorAll: function () { return []; }, appendChild: function (n) { props.kids.push(n); } } : null; /* the room's props layer, where the cake stands */
    function emit(k, a) { (hooks[k] || []).forEach(function (f) { f(a); }); }
    var w = { console: console }; w.window = w;
    w.setTimeout = function (fn, ms) { var id = ++seq; q.push({ id: id, at: T + (ms || 0), f: fn, live: true }); return id; };
    w.clearTimeout = function (id) { q.forEach(function (t) { if (t.id === id) t.live = false; }); };
    w.setInterval = function (fn, ms) { var id = ++seq, tick = function () { fn(); q.push({ id: id, at: T + ms, f: tick, live: true }); }; q.push({ id: id, at: T + ms, f: tick, live: true }); return id; };
    var RD = Date; function FD(a) { return arguments.length ? new RD(a) : new RD(); } FD.now = function () { return 1e12 + T; }; FD.parse = RD.parse; FD.UTC = RD.UTC; w.Date = FD;
    w.OvuStore = { profile: function () { return profile; }, state: function () { return state; }, setState: function (p) { Object.keys(p).forEach(function (k) { state[k] = p[k]; }); subs.forEach(function (f) { f(); }); }, setProfile: function (p) { Object.assign(profile, p); subs.forEach(function (f) { f(); }); }, subscribe: function (f) { subs.push(f); }, today: function () { return opts.today; } };
    w.OvuRoom = { ART: '', els: { props: props }, on: function (k, f) { (hooks[k] = hooks[k] || []).push(f); }, busy: function () { return !!sheet.id || sleeping; }, layout: function () { return opts.cake ? { id: 'room' } : null; },
      openSheet: function (id) { if (sheet.id) emit('sheetReplace', id); sheet.id = id; sheet.body = node(); log.push(id); }, closeSheet: function () { if (!sheet.id) return; sheet.id = null; emit('sheetHide'); } };
    w.document = { hidden: false, createElement: function () { return node(); }, addEventListener: function () { }, getElementById: function (id) { return id === 'sheetBody' ? sheet.body : null; } };
    vm.runInContext(fs.readFileSync(path.join(root, 'ovu-birthday.js'), 'utf8'), vm.createContext(w), { filename: 'ovu-birthday.js' });
    (hooks.boot || []).forEach(function (f) { f(); });
    return { run: function (ms) { var end = T + ms; for (;;) { var due = q.filter(function (t) { return t.live && t.at <= end; }).sort(function (a, b) { return a.at - b.at || a.id - b.id; }); if (!due.length) break; due[0].live = false; T = due[0].at; due[0].f(); } T = end; },
      R: w.OvuRoom, S: w.OvuStore, log: log, sheet: sheet, sleep: function (v) { sleeping = v; }, shown: function () { return (state.birthday || {}).shown; }, cake: function () { return props && props.kids[props.kids.length - 1]; } };
  }
  var DAY = { mmdd: '10-21', today: '2026-10-21' };
  var a = env(DAY), sync = a.log.length; a.run(450); var early = a.log.length; a.run(100);
  check('on her birthday the postcard waits a moment, then opens into the free room once and counts as shown', sync === 0 && early === 0 && a.log.join() === 'birthday' && a.shown() === 2026);
  var b = env(Object.assign({ sheet: 'window' }, DAY)); b.run(100);
  b.R.closeSheet(); b.sleep(true); b.run(3000); /* Window's Bedtime: its sheet closes, then bedtime starts at once */
  var asleep = { log: b.log.length, shown: b.shown() };
  b.sleep(false); b.run(2500);
  check('a sheet closing on the way to bedtime is not taken for a free room: nothing opens or counts while she sleeps, and the card opens when she is up', asleep.log === 0 && asleep.shown === undefined && b.log.join() === 'birthday' && b.shown() === 2026, JSON.stringify(asleep));
  var c = env(DAY); c.run(600); c.R.openSheet('plaza'); c.run(5);
  var undone = { shown: c.shown() }; c.R.closeSheet(); c.run(600);
  check('a sheet that replaces the postcard before she touched it does not use it up: it opens again once the room is free', c.log.join() === 'birthday,plaza,birthday' && undone.shown === null && c.shown() === 2026, c.log.join() + ' ' + JSON.stringify(undone));
  var d = env(DAY); d.run(600); d.sheet.body.fire('pointerdown'); d.R.openSheet('plus'); d.run(5); d.R.closeSheet(); d.run(3000);
  var e = env(DAY); e.run(600); e.run(200); e.R.closeSheet(); e.run(3000);
  var g = env(DAY); g.run(600); g.run(1600); g.R.openSheet('lane'); g.run(5); g.R.closeSheet(); g.run(3000);
  check('touched, closed by her, or up long enough to be seen, it counts as shown and does not come back that day', d.log.join() === 'birthday,plus' && d.shown() === 2026 && e.log.join() === 'birthday' && e.shown() === 2026 && g.log.join() === 'birthday,lane' && g.shown() === 2026, [d.log, e.log, g.log].join(' | '));
  var h = env(DAY); for (var i = 0; i < 5; i++) { h.run(100); h.S.setState({ tick: i }); } h.run(100);
  var k = env(Object.assign({ state: { birthday: { shown: 2026 } } }, DAY)); k.run(3000);
  var n = env({ mmdd: '10-22', today: '2026-10-21' }); n.run(3000);
  check('store changes while it waits never push it back; already shown this year, or not her birthday, it stays shut', h.log.join() === 'birthday' && k.log.length === 0 && n.log.length === 0, [h.log, k.log, n.log].join(' | '));
  var ck = env(Object.assign({ sheet: 'window', cake: true }, DAY)); ck.run(100); var cakeThere = !!ck.cake();
  ck.R.closeSheet(); ck.run(350); ck.cake().fire('click'); ck.run(2500); ck.R.closeSheet(); ck.run(3000);
  check('tapping the cake while the card waits to open counts as shown: it opens once, and closing it brings no second card (Codex verification 2)', cakeThere && ck.log.join() === 'birthday' && ck.shown() === 2026, ck.log.join());
  var ls = env(Object.assign({ sheet: 'window' }, DAY)); ls.run(100); ls.R.closeSheet(); ls.sleep(true); ls.run(49900);
  var slept = ls.log.length; ls.sleep(false); ls.run(9000); var beforeLook = ls.log.length; ls.run(2000);
  check('after a sleep that outlasts the retries, the 30-second look opens the card once she is up', slept === 0 && beforeLook === 0 && ls.log.join() === 'birthday' && ls.shown() === 2026, [slept, beforeLook, ls.log.join()].join(' '));
})();

(function oneActivityAndRedress() {
  console.log('2k23. one activity at a time, and a new outfit is drawn in the picture she is in (Codex sweep, 21 Oct)');
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  function fnBody(src, name) { var i = src.indexOf('function ' + name + '('); if (i < 0) return ''; var d = 0, j = src.indexOf('{', i); for (var k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
  /* the rule itself: the room's activityNow, run on stand-ins for each activity in turn */
  var an = fnBody(rs, 'activityNow'), bl = fnBody(rs, 'busyLine'), rb = fnBody(rs, 'refuseBusy');
  function room(o) {
    var c = vm.createContext({ practice: o.practice || null, session: o.session || null, pulseRun: o.pulse || null, current: o.pulse ? 'pulse' : null, pulseCancel: function () { }, window: {}, toasts: [], hud: { on: false, classList: { add: function (k) { if (k === 'on') c.hud.on = true; } } } });
    c.window.OvuMorning = { active: function () { return !!o.morning; }, reveal: function () { c.revealed = 'morning'; } };
    c.window.OvuSeats = { active: function () { return !!o.seat; }, state: function () { return o.seat ? { seat: 'street' } : null; }, SEATS: { street: { practice: 'street' } }, SCRIPTS: { street: { name: 'Sounds of the street' } }, reveal: function () { c.revealed = 'seat'; } };
    c.OvuMorning = c.window.OvuMorning; c.OvuSeats = c.window.OvuSeats; c.toast = function (t) { c.toasts.push(t); };
    try { vm.runInContext(an + bl + rb, c); } catch (e) { } return c;
  }
  function ev(code, c) { try { return vm.runInContext(code, c); } catch (e) { return '(missing: ' + e.message + ')'; } } /* an old room without the rule fails here instead of stopping the run */
  var none = room({}), pr = room({ practice: { a: { name: 'Brushing teeth' } } }), se = room({ session: { kind: 'breathe' } }), er = room({ session: { kind: 'erin' } }), mo = room({ morning: true }), st = room({ seat: true });
  var rp = ev('refuseBusy()', pr), rse = ev('refuseBusy()', se), rmo = ev('refuseBusy()', mo), rst = ev('refuseBusy()', st), rn = ev('refuseBusy()', none);
  check('activityNow names the one running activity: a practice, Just breathe or breathing with Erin, Morning start, a bench practice by its own name, and nothing in a free room', ev('activityNow()', none) === null && ev('activityNow().name', pr) === 'Brushing teeth' && ev('activityNow().name', se) === 'Just breathe' && ev('activityNow().name', er) === 'Breathing with Erin' && ev('activityNow().kind', mo) === 'morning' && ev('activityNow().name', st) === 'Sounds of the street');
  check('refuseBusy refuses with one line naming it and brings that activity\'s own controls back; a free room is not refused and hears nothing', rp && pr.toasts[0] === 'Brushing teeth is running. Finish it, or tap Stop first.' && pr.hud.on && rse && se.hud.on && rmo && mo.revealed === 'morning' && rst && st.revealed === 'seat' && st.toasts[0].indexOf('Sounds of the street is running') === 0 && rn === false && !none.toasts.length && !none.hud.on);
  var starts = ['runPractice', 'runSession', 'openMindfulness'].map(function (n) { return fnBody(rs, n).split('\n').slice(1, 3).join('\n'); });
  check('a practice, a session and the mat each ask the rule before anything else, so nothing of them is half begun (a running one of their own kind just shows its bar)', starts.every(function (s) { return /if \(refuseBusy\(\)\) return;/.test(s); }) && /if \(practice\) \{ hud\.classList\.add\('on'\); return; \}/.test(starts[0]) && /if \(session\) \{ hud\.classList\.add\('on'\); return; \}/.test(starts[1]) && /if \(session\) \{ hud\.classList\.add\('on'\); return; \}/.test(starts[2]));
  check('the Mind tab is not selected while something else runs, and a practice ending never hides another activity\'s bar', /if \(k === 'mind' && activityNow\(\)\) \{ openMindfulness\(\); return; \}/.test(rs) && (rs.match(/if \(!session\) hud\.classList\.remove\('on'\); avatar\.classList\.remove\('acting'\); restorePose\(\); practice = null;/g) || []).length === 2 && /activityNow: activityNow, busyLine: busyLine, refuseBusy: refuseBusy/.test(rs));
  /* Morning start, the seats and the care steps, loaded for real, with a room that says a practice is running */
  function busyRoom() {
    var R = { calls: 0, sheets: [], toasts: [], hooks: {}, ART: '', LAYOUTS: {}, els: {},
      on: function (n, f) { (R.hooks[n] = R.hooks[n] || []).push(f); }, asleep: function () { return false; }, layout: function () { return { id: 'street' }; }, sheetOpen: function () { return false; },
      activityNow: function () { return { kind: 'practice', name: 'Brushing teeth', icon: 'self_improvement' }; }, busyLine: function (a) { return a.name + ' is running. Finish it, or tap Stop first.'; },
      refuseBusy: function () { R.calls++; R.toasts.push(R.busyLine(R.activityNow())); return true; }, toast: function (t) { R.toasts.push(t); }, openSheet: function (id) { R.sheets.push(id); }, hideSheet: function () { }, emit: function () { }, moment: function () { return ''; },
      sessionOn: function () { return false; }, practiceOn: function () { return true; }, meditating: function () { return false; }, hudOn: function () { } };
    return R;
  }
  var wm = { console: console, document: { addEventListener: function () { }, querySelector: function () { return null; }, getElementById: function () { return null; } } }; wm.window = wm; vm.createContext(wm);
  ['ovu-mindful.js', 'ovu-morning.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), wm, { filename: f }); });
  var Rm = busyRoom(); wm.OvuRoom = Rm; wm.OvuStore = { state: function () { return {}; }, today: function () { return '2026-10-21'; } };
  function tryRun(f) { try { f(); } catch (e) { } } /* an older module that goes on past the rule fails the check below instead of stopping the run */
  tryRun(function () { wm.OvuMorning.open(); }); var openCalls = Rm.calls, openSheets = Rm.sheets.length; tryRun(function () { wm.OvuMorning.begin('yourway', true); });
  check('Morning start neither opens its choice sheet nor begins over a running practice: each asks the rule, which says what is running', openCalls === 1 && openSheets === 0 && Rm.calls === 2 && !wm.OvuMorning.active() && Rm.toasts[1] === 'Brushing teeth is running. Finish it, or tap Stop first.');
  var ws = fresh('2026-10-21'), Rs = busyRoom(); ws.OvuRoom = Rs; ws.OvuGarden = { reseat: function () { } }; ws.OvuWalk = { walking: function () { return false; }, napping: function () { return false; } };
  ws.document = { addEventListener: function () { }, getElementById: function () { return null; }, createElement: function () { throw new Error('nothing is drawn when refused'); } };
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-seats.js'), 'utf8'), ws, { filename: 'ovu-seats.js' });
  var played = 0; ws.OvuSound = { play: function () { played++; } };
  tryRun(function () { ws.OvuSeats.open('street'); }); var seatOpen = { calls: Rs.calls, sheets: Rs.sheets.length }; tryRun(function () { ws.OvuSeats.begin('street'); });
  check('a bench practice neither opens its sheet nor begins over a running practice, plays no begin sound, and draws no sitter', seatOpen.calls === 1 && seatOpen.sheets === 0 && Rs.calls === 2 && !ws.OvuSeats.active() && played === 0);
  var wc = fresh('2026-10-21'), Rc = busyRoom(), ran = 0; Rc.layout = function () { return { id: 'farm' }; }; wc.OvuRoom = Rc;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-care.js'), 'utf8'), wc, { filename: 'ovu-care.js' });
  wc.OvuCare.slowMs = 0; var box = { isConnected: true, className: 'untouched' };
  var refused; tryRun(function () { refused = wc.OvuCare.step(box, { scene: 'farm', ms: 4000, verb: 'Watering' }, function () { ran++; }); });
  Rc.refuseBusy = function () { return false; }; var free = wc.OvuCare.step(box, { scene: 'farm', ms: 4000, verb: 'Watering' }, function () { ran++; });
  check('a care step refuses to begin while another activity runs (the box untouched, its save never run), and begins as before in a free room', refused === false && Rc.calls === 1 && box.className === 'untouched' && free === true && ran === 1);
  /* the garden bench is refused before she sits down */
  var gs = fs.readFileSync(path.join(root, 'ovu-garden.js'), 'utf8');
  check('the garden bench asks the rule before its sheet and again before she sits, so a refusal never leaves her seated or hidden', /if \(R\.sessionOn\(\)\) \{ R\.hudOn\(true\); return; \}\n    if \(R\.refuseBusy && R\.refuseBusy\(\)\) return;/.test(gs) && /if \(R\.sessionOn\(\)\) return; if \(R\.refuseBusy && R\.refuseBusy\(\)\) return;[^\n]*\n\s*sitAt\(spot, holoSpot, back\)/.test(gs));
  /* a new outfit: whatever picture she is in is redrawn in it */
  var so = fnBody(rs, 'showOutfit') + fnBody(rs, 'setOutfit'), rd = fnBody(rs, 'redress') + fnBody(rs, 'setOutfit'), tw = fnBody(rs, 'twirlOk'); /* the picture moved to showOutfit with the fitting room (22 Oct integration) */
  check('a picked outfit (never a silent internal change) is redrawn in the picture she is in: the sleeper, the mat, a practice pose, Morning start\'s step, a held activity pose, and every sitter through the outfit event', /if \(!silent\) redress\(\);/.test(so) && /wearImg\(sleeper\.querySelector\('img'\), sleepSrc\(o\)/.test(rd) && /if \(meditating && !meditator\.classList\.contains\('onseat'\)\) wearImg\(meditator\.querySelector\('img'\), meditateSrc\(o\)/.test(rd) && /if \(practice\) \{ if \(practice\.a\.pose\) setPose\(practice\.a\.pose\); else showOutfit\(wearing\(\), true\); \}/.test(rd) && /OvuMorning\.repose\(\)/.test(rd) && /lastPose && avatar\.classList\.contains\('acting'\)\) setPose\(lastPose\)/.test(rd) && /emit\('outfit', o\)/.test(rd) && !/OvuMorning\.repose/.test(so));
  check('an outfit picked while she sleeps stands when she wakes (the bedtime outfit is not put back over it), and no hop plays on a hidden or seated standing avatar', /if \(sl && sl\.prevOutfit\) S\.setState\(\{ sleeping: Object\.assign\(\{\}, sl, \{ prevOutfit: null \}\) \}\)/.test(rd) && /if \(!silent && !avatar\.classList\.contains\('hidden'\) && !scene\.classList\.contains\('sitting'\)\) \{ avatar\.classList\.add\('poofing'\)/.test(so));
  check('no twirl over a held activity pose or behind a seated sitter', /!avatar\.classList\.contains\('acting'\) && !scene\.classList\.contains\('sitting'\)/.test(tw) && /var lastPose = null;[\s\S]{0,200}function setPose\(pose\) \{\n    finishTwirl\(\); lastPose = pose;/.test(rs) && /function restorePose\(\) \{ lastPose = null;/.test(rs));
  var sitters = { 'ovu-seats.js': /R\.on\('outfit', function \(\) \{ if \(run && run\.el && G\.reseat\) G\.reseat\(run\.el, run\.spot\.seat\); \}\)/, 'ovu-barn.js': /R\.on\('outfit'[^\n]*reseat\(sitting\.el, CAVE\.seat\)/, 'ovu-harbour.js': /R\.on\('outfit'[^\n]*reseat\(sitting\.el, HARBOUR\.seat\)/, 'ovu-tones.js': /R\.on\('outfit'[^\n]*reseat\(sitting\.el, CAVE\.seat\)/, 'ovu-garden.js': /R\.on\('outfit', function \(\) \{\n      if \(sitting && sitting\.el\) reseat\(sitting\.el, sitting\.spot && sitting\.spot\.seat\);\n      if \(R\.els\.meditator && R\.els\.meditator\.classList\.contains\('onseat'\) && R\.meditating\(\)\) reseat\(R\.els\.meditator, benchSeat/ };
  var unwired = Object.keys(sitters).filter(function (f) { return !sitters[f].test(fs.readFileSync(path.join(root, f), 'utf8')); });
  check('every sitter is redrawn on a new outfit: the garden and plaza benches, Breathe with Erin on the bench, a seated practice, the warm stone, the tones and the harbour bench', unwired.length === 0, unwired.join(', '));
  var rsBody = fnBody(gs, 'reseat');
  check('a re-dress keeps her seated: the seated sprite and its lap line land together, with no sit sound, and a slower earlier swap never lands over a newer one', /el\._dress !== tok/.test(rsBody) && /if \(seat\) seatPlace\(el, seat\)/.test(rsBody) && rsBody.indexOf('OvuSound') < 0 && /G\.reseat = reseat;/.test(gs));
})();

(function sleepQuality() {
  console.log('sleep quality: stages, time awake and time in bed travel with imported nights; a summary with denominators, no score');
  var w = fresh('2026-10-18'), H = w.OvuHealth, S = w.OvuStore, A = w.OvuAgents;
  var r = H.parseAppleXml(fs.readFileSync(path.join(root, 'tools/fixtures/apple-export-mini.xml'), 'utf8')), n1 = r.sleep[0], n2 = r.sleep[1];
  check('Apple stages are counted one minute one stage: core 190, deep 240, and REM written inside deep is not counted twice', n1 && JSON.stringify(n1.stageMin) === JSON.stringify({ core: 190, deep: 240, rem: 0 }), JSON.stringify(n1));
  check('the stage minutes never add up to more than the minutes asleep', n1 && n1.stageMin.core + n1.stageMin.deep + n1.stageMin.rem <= n1.asleepMin);
  check('Apple awake records inside the night become time awake (20 min); hours still leave it out', n1 && n1.awakeMin === 20 && n1.asleepMin === 430);
  check('the phone\'s in-bed block around the night becomes time in bed (23:05 to 07:10, 485 min)', n1 && n1.inBedMin === 485);
  check('an old numeric night with no stages, awake or in-bed records carries none of them (unknown, not zero)', n2 && n2.stageMin === undefined && n2.awakeMin === undefined && n2.inBedMin === undefined, JSON.stringify(n2));
  var gb = H.googleBuilder(); gb.json(fs.readFileSync(path.join(root, 'tools/fixtures/fit-session-sleep.json'), 'utf8'), '2025-05-10T23_12_00+08_00_SLEEP.json');
  var g = gb.result().sleep[0];
  check('Google Fit light, deep and REM segments map to core, deep and rem, and its awake segment to time awake', g && JSON.stringify(g.stageMin) === JSON.stringify({ core: 108, deep: 120, rem: 218 }) && g.awakeMin === 20 && g.asleepMin === 446, JSON.stringify(g));
  var gb2 = H.googleBuilder(); gb2.json(JSON.stringify({ fitnessActivity: 'sleep', startTime: '2025-05-12T23:00:00.000+08:00', endTime: '2025-05-13T06:00:00.000+08:00', segment: [{ sleepSegmentType: 4, startTime: '2025-05-12T23:00:00.000+08:00', endTime: '2025-05-13T02:00:00.000+08:00' }, { sleepSegmentType: 1, startTime: '2025-05-13T02:00:00.000+08:00', endTime: '2025-05-13T02:40:00.000+08:00' }, { sleepSegmentType: 5, startTime: '2025-05-13T02:40:00.000+08:00', endTime: '2025-05-13T06:00:00.000+08:00' }] }), 'b_SLEEP.json');
  var g2 = gb2.result().sleep[0];
  check('numeric Fit sleep segment types (4 light, 1 awake, 5 deep) are read too', g2 && g2.stageMin.core === 180 && g2.stageMin.deep === 200 && g2.awakeMin === 40, JSON.stringify(g2));

  var p = H.apply(r, S, { kinds: ['sleep'] }), e1 = S.list('sleep').filter(function (e) { return e.date === '2025-06-02'; })[0];
  check('an imported night keeps its stages, time awake and time in bed in the diary', p.counts.sleep === 2 && e1 && e1.data.stageMin.deep === 240 && e1.data.awakeMin === 20 && e1.data.inBedMin === 485, JSON.stringify(e1 && e1.data));
  var w2 = fresh('2025-06-03'), S2 = w2.OvuStore, H2 = w2.OvuHealth;
  S2.add('sleep', '2025-06-02', { bedTime: '22:00', wakeTime: '06:00' });
  H2.apply(r, S2, { kinds: ['sleep'] });
  var hw = S2.list('sleep').filter(function (e) { return e.date === '2025-06-02'; });
  check('a night she wrote herself still wins: the import adds nothing on that date', hw.length === 1 && hw[0].data.stageMin === undefined && hw[0].source !== 'apple-health', JSON.stringify(hw));

  var w3 = fresh('2026-10-18'), S3 = w3.OvuStore, A3 = w3.OvuAgents, t = S3.today();
  [[-6, '23:00', '06:30', 390, 40, 450, { core: 200, deep: 90, rem: 100 }], [-5, '23:30', '06:30', 380, 35, 430, { core: 190, deep: 90, rem: 100 }], [-4, '00:15', '07:00', 370, 10, 410, null], [-3, '23:10', '07:10', 450, 45, null, { core: 250, deep: 100, rem: 100 }], [-2, '23:40', '06:40', 400, null, null, null]].forEach(function (x) {
    var d = { bedTime: x[1], wakeTime: x[2], asleepMin: x[3], hours: Math.round(x[3] / 6) / 10, mode: 'import' };
    if (x[4] !== null) d.awakeMin = x[4]; if (x[5] !== null) d.inBedMin = x[5]; if (x[6]) d.stageMin = x[6];
    S3.addMany([{ type: 'sleep', date: addDays(t, x[0]), data: d, source: 'apple-health' }]);
  });
  var q = A3.sleepQuality(addDays(t, -27), t);
  check('the summary counts nights and keeps each measure\'s own denominator', q.nights === 5 && q.withHours === 5 && q.awakeNights === 4 && q.effNights === 3 && q.stagedNights === 3 && q.timed === 5, JSON.stringify(q));
  check('nights at 7 h or more are counted against nights with hours (one of five)', q.sevenPlus === 1 && q.avgHours === 6.6, JSON.stringify(q));
  check('typical time awake is the median of measured nights only, and 31 min or more is counted (3 of 4)', q.awakeMedian === 38 && q.awakeOver30 === 3);
  check('time in bed spent asleep is the median of nights with both measures (88%)', q.effMedian === 88, JSON.stringify(q));
  check('timing spread is circular, so 23:00 and 00:15 are close, not 23 hours apart', typeof q.midSD === 'number' && q.midSD < 60 && q.bedSD < 60, JSON.stringify(q));
  check('stage shares are percentages of staged minutes, from staged nights only', q.stages && q.stages.core + q.stages.deep + q.stages.rem >= 99 && q.stages.core === 52, JSON.stringify(q.stages));
  var rows = A3.sleepQualityRows(q), labels = rows.map(function (x) { return x[0]; });
  check('rows name each measure with its nights, call stages a device estimate and give no score', labels.indexOf('Awake in the night') > -1 && labels.indexOf('Sleep stages (device estimate)') > -1 && /3 of 4 nights measured/.test(rows[labels.indexOf('Awake in the night')][1]) && !rows.some(function (x) { return /score|good|poor/i.test(x.join(' ')); }), JSON.stringify(rows));
  check('the journal rows show the quality lines even before any sleep details are answered', A3.sleepNotesRows(A3.sleepNotes(addDays(t, -27), t)).some(function (x) { return x[0] === 'Awake in the night'; }));
  check('three measured nights awake 31 min or more in a week raise one watch note', A3.allFlags(t).filter(function (f) { return f.code === 'SLEEP_LONG_AWAKE'; }).length === 1);
  var w4 = fresh('2026-10-18'), S4 = w4.OvuStore, A4 = w4.OvuAgents, t4 = S4.today();
  [-3, -2, -1].forEach(function (k, i) { S4.add('sleep', addDays(t4, k), { bedTime: '23:00', wakeTime: '07:00' }); });
  S4.addMany([{ type: 'sleep', date: addDays(t4, -4), data: { bedTime: '23:00', wakeTime: '07:00', asleepMin: 440, awakeMin: 50, mode: 'import' }, source: 'apple-health' }]);
  check('nights without a measure of time awake never count towards the note', !A4.allFlags(t4).some(function (f) { return f.code === 'SLEEP_LONG_AWAKE'; }));
  var qe = A4.sleepQuality(addDays(t4, -27), t4);
  check('hand-written nights add hours and timing but no time awake, efficiency or stages', qe.withHours === 4 && qe.awakeNights === 1 && qe.effNights === 0 && qe.stages === null);

  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-patterns.js'), 'utf8'), w3);
  var sn = A3.sleepNotes(addDays(t, -27), t), sh = JSON.parse(JSON.stringify(sn));
  sh.quality.effMedian = 400; sh.quality.awakeOver30 = 99; sh.quality.stages = { core: '<b>', deep: 1, rem: 1 };
  var cq = w3.OvuPatterns.cleanShare({ sleepNotes: sh }).sleepNotes.quality;
  check('a shared summary keeps quality numbers in range, never more marked than measured, and drops a broken stage line', cq.effNights === 0 && cq.awakeOver30 === cq.awakeNights && cq.stages === null && cq.awakeMedian === 38, JSON.stringify(cq));
  var html = w3.OvuPatterns.sleepNotesHTML(sn);
  check('the drawn card shows the quality lines and says stages are the device estimate', /Awake in the night/.test(html) && /device/.test(html) && !/—/.test(html), html.slice(0, 300));
  check('the evidence ledger names the NSF sleep quality panel', /Ohayon/.test(fs.readFileSync(path.join(root, 'ovu-evidence.js'), 'utf8')));
})();

(function () {
  console.log('2k30. game save (22 Oct, sixth version): the account copy is the true copy; hearts earned on a phone are never lost or counted twice');
  var G0src = fs.readFileSync(path.join(root, 'ovu-gamesave.js'), 'utf8');
  /* a pretend server with the migration's rules: own row, revision check, operation ids, deletion marker */
  var server = { row: null, puts: 0, bodies: [], tokens: [], lose: false, hold: null, clock: 0 };
  function respond(obj, status) { return Promise.resolve({ ok: (status || 200) < 300, status: status || 200, text: function () { return Promise.resolve(obj === undefined ? '' : JSON.stringify(obj)); } }); }
  function fakeFetch(url, o) {
    var body = o && o.body ? JSON.parse(o.body) : null; server.tokens.push(o && o.headers && o.headers.Authorization);
    if (/\/game_saves\?/.test(url)) return respond(server.row ? [JSON.parse(JSON.stringify(server.row))] : []);
    if (/rpc\/game_save_put/.test(url)) {
      server.puts++; server.bodies.push(o.body);
      var go = function () {
        var cur = server.row || { save: {}, rev: 0, deleted: false, devs: {} };
        var dev = body.p_op ? body.p_op.split(':')[0] : null, seqn = body.p_op ? Number(body.p_op.split(':')[1]) : 0;
        if (dev && (cur.devs[dev] || 0) >= seqn) return respond([{ ok: true, rev: cur.rev, save: cur.save, deleted: cur.deleted }]);
        if (cur.rev !== body.p_base) return respond([{ ok: false, rev: cur.rev, save: cur.save, deleted: cur.deleted }]);
        var signedAt = Number(String(o.headers.Authorization).split('@')[1] || 0); /* the token's sign-in time (amr) */
        if (cur.deleted && !(signedAt > cur.delAt)) return respond([{ ok: false, rev: cur.rev, save: cur.save, deleted: true }]);
        var devs = Object.assign({}, cur.devs); if (dev) devs[dev] = seqn;
        server.row = { save: body.p_save, rev: cur.rev + 1, deleted: false, devs: devs };
        if (server.lose) { server.lose = false; return Promise.reject(new Error('answer lost')); }
        return respond([{ ok: true, rev: server.row.rev, save: body.p_save, deleted: false }]);
      };
      if (server.hold) { var h = server.hold; server.hold = null; return Promise.resolve(h()).then(go); }
      return go();
    }
    if (/rpc\/game_save_delete/.test(url)) { var c = server.row || { save: {}, rev: 0 }; server.row = { save: {}, rev: c.rev + 1, deleted: true, devs: c.devs || {}, delAt: ++server.clock }; return respond(server.row.rev); }
    return respond({ message: 'no' }, 404);
  }
  function phone(stateInit, opts) {
    opts = opts || {};
    var sh = opts.share, ls = sh ? sh.ls : {}, listeners = sh ? sh.listeners : [], authL = [], box = sh ? sh.box : { st: JSON.parse(JSON.stringify(stateInit || {})) }, who = { uid: 'uid' in opts ? opts.uid : 'u1', at: ++server.clock };
    var st = box.st;
    var ctx = { JSON: JSON, Date: Date, Math: Math, Number: Number, String: String, Array: Array, Object: Object, Promise: Promise, isFinite: isFinite, setTimeout: function () { return 0; }, clearTimeout: function () { },
      fetch: fakeFetch, localStorage: { getItem: function (k) { return k in ls ? ls[k] : null; }, setItem: function (k, v) { ls[k] = String(v); }, removeItem: function (k) { delete ls[k]; } },
      document: { readyState: 'complete', addEventListener: function () { } }, addEventListener: function () { }, OVU_CONFIG: { supabaseUrl: 'https://x.test', supabaseKey: 'k' } };
    ctx.window = ctx;
    ctx.OvuStore = { state: function () { return st; }, profile: function () { return opts.profile || {}; }, today: function () { return '2026-10-22'; }, isSandbox: function () { return false; },
      commit: function () { }, subscribe: function (f) { listeners.push(f); } };
    ctx.OvuAuth = { isSignedIn: function () { return !!who.uid; }, userId: function () { return who.uid; }, token: function () { return Promise.resolve('tok-' + who.uid + '@' + who.at); }, subscribe: function (f) { authL.push(f); } };
    vm.createContext(ctx); vm.runInContext(G0src, ctx, { filename: 'ovu-gamesave.js' });
    ctx.OvuStore.state = function () { return box.st; }; ctx.OvuStore.commit = function (p) { Object.assign(box.st, JSON.parse(JSON.stringify(p))); listeners.forEach(function (f) { f('state'); }); };
    return { G: ctx.OvuGameSave, st: function () { return box.st; }, who: who, ls: ls, listeners: listeners, box: box, signIn: function (u) { who.uid = u; who.at = ++server.clock; authL.forEach(function (f) { f(); }); },
      change: function (fn) { fn(box.st); listeners.forEach(function (f) { f('state'); }); }, clear: function () { box.st = {}; delete ls['ovumind_gamesave_v1']; }, meta: function () { return JSON.parse(ls['ovumind_gamesave_v1'] || '{}')[who.uid] || {}; } };
  }
  function earn(n) { return function (s) { s.rewards = Object.assign({}, s.rewards, { hearts: (s.rewards.hearts || 0) + n, earned: (s.rewards.earned || 0) + n }); }; }
  var G = phone({}).G;
  var full = { rewards: { lastDay: '2026-10-21', streak: 4, hearts: 40, earned: 120, owned: ['lamp'], placed: { lamp: 1 }, treats: { biscuit: 5 }, wear: { cat: 'bow' }, gifts: { birthday: 1 }, daily: { day: '2026-10-22', kinds: { period: 1 } }, log: [{ at: 'x', type: 'period', points: 10 }], receipts: { e1: 1 }, mindDay: { day: 'x', pts: 4 }, seatDay: { day: 'x', seats: { a: 1 } }, mindActs: { day: 'x', acts: {} }, care: { day: 'x', by: {} } },
    farm: { seeds: { mint: 2 } }, greenhouse: { pots: ['basil'] }, lane: { visits: 2, letters: [{ text: 'dear me, a private letter' }] }, garden: { credited: ['2026-10-01'], watered: ['2026-10-20'] }, sleeping: { startedAt: 'x' }, insights: { a: 1 }, tester: { hearts: true }, plaza: { x: 1 } };
  var pk = G.pack(full), pj = JSON.stringify(pk);
  check('only game fields leave the phone: no letters, garden diary dates, hearts log, receipts, which diary kinds earned today, sleep, insights, tester or plaza; the game caps (practice, benches, pet care) go along', !/private letter|2026-10-01|period|kinds|receipts|"daily"|lastDay|streak|sleeping|insights|tester|plaza/.test(pj) && pk.rewards.seatDay && pk.rewards.mindDay && pk.greenhouse && pk.garden.watered[0] === '2026-10-20' && pk.lane.visits === 2, pj);
  check('pet treats, worn accessories and one-time gifts are game progress and are saved', pk.rewards.treats.biscuit === 5 && pk.rewards.wear.cat === 'bow' && pk.rewards.gifts.birthday === 1);
  check('a restored save keeps her letters, garden dates and every local-only rewards field on the phone', (function () { var p = G.applyTo(full, { rewards: { hearts: 9, earned: 9 }, lane: { visits: 5 }, garden: { watered: ['2026-10-21'] } }, '2026-10-22'); return p.lane.letters[0].text === 'dear me, a private letter' && p.lane.visits === 5 && p.garden.credited[0] === '2026-10-01' && p.rewards.log.length === 1 && p.rewards.daily.kinds.period === 1 && p.rewards.lastDay === '2026-10-21' && p.rewards.streak === 4 && p.rewards.receipts.e1 === 1 && p.rewards.hearts === 9; })());
  check('a phone that never earned here gets the account\'s hearts but not a second round of today\'s logging hearts (practice caps come with the account)', (function () { var p = G.applyTo({}, { rewards: { hearts: 9 } }, '2026-10-22').rewards; return p.daily.kinds.food === 1 && p.daily.kinds.period === 1 && p.moveDay.pts >= 20 && p.dailyLast === '2026-10-22'; })());
  check('the account copy plus earnings: only hearts are added, never positions, energy or counts', (function () { var w = G.withEarnings({ rewards: { hearts: 10, earned: 50 }, propPos: { lamp: { x: 80 } }, stamina: { v: 100 }, farm: { basket: { carrot: 2 } } }, 6); return w.rewards.hearts === 16 && w.rewards.earned === 56 && w.propPos.lamp.x === 80 && w.stamina.v === 100 && w.farm.basket.carrot === 2 && G.withEarnings({ rewards: { hearts: 3 } }, -9).rewards.hearts === 3; })());

  check('a save without a hearts ledger still gives every reader a complete one (owned list, placed map)', (function () { var p = G.applyTo({ rewards: { hearts: 4, log: [] } }, { farm: {} }, '2026-10-22').rewards; return Array.isArray(p.owned) && p.placed && typeof p.placed === 'object' && p.hearts === 0 && Array.isArray(p.log); })());
  check('a phone\'s unsaved practice awards replay onto the account copy: a bench paid elsewhere is not paid again, and the day\'s cap of 20 holds', (function () {
    var acct = { rewards: { hearts: 50, earned: 50, mindDay: { day: '2026-10-22', pts: 18 }, seatDay: { day: '2026-10-22', seats: { street: 1 } } } };
    var j = [{ kind: 'mind', day: '2026-10-22', n: 2, seats: ['street'], acts: [] }, { kind: 'mind', day: '2026-10-22', n: 2, seats: ['garden'], acts: [] }, { kind: 'mind', day: '2026-10-22', n: 2, seats: [], acts: ['teeth'] }, { kind: 'other', n: 6 }];
    var r = G.replay(acct, j, '2026-10-22').rewards; return r.hearts === 58 && r.mindDay.pts === 20 && r.seatDay.seats.garden === 1 && !(r.mindActs.acts.teeth) && acct.rewards.hearts === 50; })());
  check('a practice award from a past day is let go on replay, never paid again; other hearts from that day still arrive', (function () {
    var acct = { rewards: { hearts: 104, earned: 104, mindDay: { day: '2026-10-22', pts: 2 }, seatDay: { day: '2026-10-22', seats: {} } } };
    var r = G.replay(acct, [{ kind: 'mind', day: '2026-10-21', n: 2, seats: ['street'], acts: [] }, { kind: 'other', n: 6 }], '2026-10-22').rewards; return r.hearts === 110 && r.mindDay.pts === 2;
  })());
  check('a change is read into the award journal: practice hearts with the bench they used, and other hearts apart', (function () { var a = G.caps({ earned: 10, mindDay: { day: 'd', pts: 2 }, seatDay: { day: 'd', seats: {} } }), b = G.caps({ earned: 18, mindDay: { day: 'd', pts: 4 }, seatDay: { day: 'd', seats: { street: 1 } } }), j = G.journalFor(a, b); return j.length === 2 && j[0].kind === 'mind' && j[0].n === 2 && j[0].seats[0] === 'street' && j[1].kind === 'other' && j[1].n === 6; })());
  check('first sign-in carries this phone\'s treats and owned items, but placements stay as the account has them (one per slot)', (function () { var m = G.linkMerge({ rewards: { hearts: 88, earned: 100, treats: { biscuit: 5 }, owned: ['armchair'], placed: { armchair: true } } }, { rewards: { hearts: 10, earned: 10, owned: ['beanbag'], placed: { beanbag: true }, treats: { biscuit: 1 } } }).rewards; return m.hearts === 98 && m.treats.biscuit === 6 && m.owned.join() === 'beanbag,armchair' && m.placed.beanbag === true && !m.placed.armchair; })());
  server.row = null;
  var A1 = phone({ rewards: { hearts: 100, earned: 100, owned: [] }, propPos: { lamp: { x: 10 } }, stamina: { v: 10 } });
  var B1 = phone({ rewards: { hearts: 0, earned: 0, owned: [] } });
  var steps = [];
  function step(name, f) { return function (r) { var ok; try { ok = f(r); } catch (e) { ok = false; r = String(e); } steps.push([name, ok, r]); }; }
  function H() { return server.row.save.rewards.hearts; }
  Promise.resolve()
    .then(function () { return A1.G.sync(); }).then(step('a phone links to an empty account and uploads its game (100 hearts)', function (r) { return r === 'linked' && H() === 100; }))
    .then(function () { return B1.G.sync(); }).then(step('a second phone links and shows the same 100', function () { return B1.st().rewards.hearts === 100; }))
    .then(function () { return A1.G.sync(); })
    /* Codex round three, 1: a write whose answer is lost, then another phone saves, then the resend */
    .then(function () { A1.change(earn(5)); server.lose = true; return A1.G.sync(); })
    .then(function () { B1.change(earn(10)); return B1.G.sync().then(function () { return B1.G.sync(); }); })
    .then(function () { return A1.G.sync().then(function () { return A1.G.sync(); }); })
    .then(step('a lost answer, another phone saving in between, then the resend: 100 + 5 + 10 = 115, never 120', function () { return H() === 115 && A1.st().rewards.hearts === 115; }))
    .then(function () { return B1.G.sync(); })
    /* Codex round three, 2: earnings carried through a clash are counted once */
    .then(function () { A1.change(earn(5)); B1.change(earn(5)); return B1.G.sync(); })
    .then(function () { server.hold = function () { server.row = { save: JSON.parse(JSON.stringify(server.row.save)), rev: server.row.rev + 1, deleted: false, devs: server.row.devs }; server.row.save.rewards.hearts += 5; server.row.save.rewards.earned += 5; }; return A1.G.sync(); })
    .then(function () { return A1.G.sync(); })
    .then(step('earnings carried through a clash count once: 115 + 5 + 5 + 5 = 130', function () { return H() === 130 && A1.st().rewards.hearts === 130; }))
    .then(function () { return B1.G.sync(); }).then(step('and the other phone then shows 130', function () { return B1.st().rewards.hearts === 130; }))
    /* nothing is summed except hearts: positions and energy take the account copy */
    .then(function () { A1.change(function (s) { s.propPos = { lamp: { x: 80 } }; s.stamina = { v: 100 }; }); B1.change(function (s) { s.propPos = { lamp: { x: 90 } }; s.stamina = { v: 99 }; s.rewards = Object.assign({}, s.rewards, { hearts: s.rewards.hearts - 20, owned: s.rewards.owned.concat(['seedpack']) }); }); return A1.G.sync(); })
    .then(function () { return B1.G.sync().then(function () { return B1.G.sync(); }); })
    .then(step('two phones at once: the account copy wins whole, the unsaved purchase goes with its cost, and positions and energy are never added up', function () { var r = server.row.save; return r.rewards.hearts === 130 && B1.st().rewards.hearts === 130 && r.rewards.owned.indexOf('seedpack') < 0 && B1.st().propPos.lamp.x === 80 && B1.st().stamina.v === 100; }))
    /* two tabs of one phone: one save, acknowledged once */
    .then(function () { var T2 = phone(null, { share: A1 }); A1.change(earn(5)); server.hold = function () { return T2.G.sync(); }; return A1.G.sync().then(function () { return A1.G.sync(); }).then(function () { return T2; }); })
    .then(function (T2) { return T2.G.sync().then(function () { return A1.G.sync(); }); })
    .then(step('two tabs sending the same save: it is applied once, acknowledged once, and no hearts go missing (135)', function () { return H() === 135 && A1.st().rewards.hearts === 135 && !(A1.meta().journal || []).length; }))
    .then(function () { return B1.G.sync(); })
    /* a cleared phone */
    .then(function () { B1.clear(); return B1.G.sync(); }).then(step('a phone whose data was cleared links again, gets everything back and never uploads an empty game', function () { return B1.st().rewards.hearts >= 130 && H() >= 130; }))
    .then(function () { return A1.G.sync(); })
    /* Codex round five: a stale phone paying a bench already paid elsewhere */
    .then(function () { return Promise.all([A1.G.sync(), B1.G.sync()]); })
    .then(function () { function bench(s) { var r = s.rewards; s.rewards = Object.assign({}, r, { hearts: r.hearts + 2, earned: r.earned + 2, mindDay: { day: '2026-10-22', pts: ((r.mindDay && r.mindDay.day === '2026-10-22') ? r.mindDay.pts : 0) + 2 }, seatDay: { day: '2026-10-22', seats: Object.assign({}, (r.seatDay && r.seatDay.day === '2026-10-22') ? r.seatDay.seats : {}, { street: 1 }) } }); }
      var before = H(); A1.change(bench); return A1.G.sync().then(function () { B1.change(bench); return B1.G.sync().then(function () { return B1.G.sync(); }); }).then(function () { return before; }); })
    .then(step('a phone that had not synced pays the same bench: the account counts it once (+2, not +4)', function (before) { return H() === before + 2 && B1.st().rewards.hearts === before + 2; }))
    /* Codex round five: a lost answer resent after more than a hundred other saves */
    .then(function () { return A1.G.sync(); })
    .then(function () { A1.change(earn(5)); server.lose = true; return A1.G.sync(); })
    .then(function () { var chain = Promise.resolve(); for (var i = 0; i < 101; i++) chain = chain.then(function () { B1.change(earn(1)); return B1.G.sync().then(function () { return B1.G.sync(); }); }); return chain; })
    .then(function () { var before = H(); return A1.G.sync().then(function () { return A1.G.sync(); }).then(function () { return before; }); })
    .then(step('a lost answer resent after 101 other saves is still applied once', function (before) { return H() === before && A1.st().rewards.hearts === before; }))
    .then(function () { return B1.G.sync(); })
    /* tester mode */
    .then(function () { A1.change(function (s) { s.tester = { hearts: true }; }); A1.change(function (s) { s.home = 'familyhome'; }); return A1.G.sync().then(function (r) { A1.change(function (s) { s.tester = null; }); return A1.G.sync().then(function (r2) { return [r, r2]; }); }); })
    .then(step('tester mode never saves, and afterwards the phone takes the account copy instead of uploading what tester mode gave it', function (x) { return x[0] === 'tester' && x[1] === 'pulled' && server.row.save.home !== 'familyhome' && !A1.st().home; }))
    .then(function () { var other = phone({ rewards: { hearts: 1, earned: 1 } }, { profile: { owner: 'someone-else' } }); var n = server.puts; return other.G.sync().then(step('a phone holding another account\'s diary never saves to this account', function (r) { return r === 'owner' && server.puts === n; })); })
    /* Codex round three, 3: a sign-in before a deletion never revives it */
    .then(function () { var E = phone({ rewards: { hearts: 3, earned: 3 } }, { uid: null }); E.signIn('u1'); return E.G.noteSignIn('u1').then(function () { return E; }); })
    .then(function (E) { server.tokens = []; return A1.G.forget('u1', 'tok-the-delete').then(function () { return E; }); })
    .then(function (E) { steps.push(['the delete goes with the account and token it was started with, and marks the save deleted', server.tokens.indexOf('Bearer tok-the-delete') > -1 && server.row.deleted === true && JSON.stringify(server.row.save) === '{}']); return E.G.sync().then(function () { return E.G.sync(); }); })
    .then(step('a phone that signed in before the deletion cannot revive it: the server checks the sign-in time', function (r) { return r === 'deleted' && server.row.deleted === true; }))
    .then(function () { B1.change(earn(9)); return B1.G.sync().then(function () { return B1.G.sync(); }); }).then(step('a linked phone that missed the deletion stops instead of recreating the save', function (r) { return r === 'deleted' && server.row.deleted === true; }))
    .then(function () { var F = phone({ rewards: { hearts: 7, earned: 7 } }, { uid: null }); F.signIn('u1'); return F.G.noteSignIn('u1').then(function () { return F.G.sync(); }); })
    .then(step('a sign-in after the deletion starts saving again', function (r) { return r === 'linked' && server.row.deleted === false && H() === 7; }))
    .then(function () { steps.push(['no upload ever carried a letter, a diary date, a receipt or a diary kind', server.bodies.every(function (t) { return !/private letter|period|kinds|credited|receipts/.test(t); })]); })
    .catch(function (e) { steps.push(['the multi-phone run finished without an error', false, String(e && e.stack || e)]); })
    .then(function () { steps.forEach(function (x) { check(x[0], x[1], x[2]); }); });
  var mig = fs.readFileSync(path.join(root, 'supabase/migrations/20261022100000_game_saves.sql'), 'utf8');
  check('the table is read-own-row only; writes go through revision- and operation-checked functions closed to anon; size-capped; gone with the account', /enable row level security/.test(mig) && /revoke all on public\.game_saves from anon, authenticated, public/.test(mig) && /grant select on public\.game_saves to authenticated/.test(mig) && /cur\.rev <> coalesce\(p_base, -1\)/.test(mig) && /coalesce\(\(cur\.devs->>dev\)::bigint, 0\) >= seq/.test(mig) && /cur\.devs \|\| jsonb_build_object\(dev, seq\)/.test(mig) && /amr/.test(mig) && /signed_in <= extract\(epoch from cur\.saved_at\)/.test(mig) && /revoke all on function public\.game_save_put\(jsonb, bigint, text\) from public, anon/.test(mig) && /262144/.test(mig) && /on delete cascade/.test(mig));
  check('room.html loads the game save after the villagers; clearing the phone clears its link; the cloud delete passes its own account and token', /ovu-villagers\.js"><\/script>\s*<script src="ovu-gamesave\.js"/.test(fs.readFileSync(path.join(root, 'room.html'), 'utf8')) && /'ovumind_gamesave_v1'/.test(fs.readFileSync(path.join(root, 'ovu-store.js'), 'utf8')) && /OvuGameSave\.forget\(uid, token\)/.test(fs.readFileSync(path.join(root, 'ovu-sync.js'), 'utf8')));
  console.log('2k31. PULSE movement breaks (22 Oct): signed cards only, active seconds only, never WHO minutes or a strength day');
  var c = vm.createContext({ Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON }); c.window = c;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-pulse.js'), 'utf8'), c);
  var P = c.OvuPulse;
  check('three first movements, seated or at a wall: knee extension, shoulder-blade squeeze, wall push-up', P.MOVES.map(function (m) { return m.id; }).join() === 'P05,P06,P02');
  check('no card shows until it is signed; tester mode sees any drafts', P.visible(false).length === P.MOVES.filter(P.reviewed).length && P.visible(true).length === 3);
  check('the first three cards are signed (Dr Vernece\'s content, checked by Claude and Codex, 22 Oct) and show for everyone', P.MOVES.every(function (m) { return P.reviewed(m) && /Dr Vernece/.test(m.reviewedBy) && /Codex/.test(m.reviewedBy) && m.reviewedAt === '2026-10-22'; }) && P.visible(false).length === 3);
  check('every card has a setup, one cue, an easier version, a skip line and 45 s of movement with 10 s of rest', P.MOVES.every(function (m) { return m.setup && m.cue && m.easy && /^Skip if/.test(m.skip) && m.work === 45 && m.rest === 10; }));
  check('the before-you-move screen names the groups to skip, says stop for pain or dizziness, and says to call the local emergency number (no country-specific number)', /pregnan/.test(P.BEFORE.lines.join(' ')) && /leaking/.test(P.BEFORE.lines.join(' ')) && /fracture/.test(P.BEFORE.lines.join(' ')) && /dizz/.test(P.BEFORE.lines.join(' ')) && /local emergency number/.test(P.BEFORE.urgent) && !/995/.test(P.BEFORE.urgent));
  var e = P.entryFor(P.move('P02'), 'work', 61, true);
  check('a logged break keeps active seconds only (capped at 45), stopped early, no MET, never a strength day', e.activity === 'pulse' && e.seconds === 45 && e.stoppedEarly === true && e.met === null && e.strength === false && e.minutes === 0 && e.setting === 'work');
  var w = vm.createContext({ Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON, Date: Date, isFinite: isFinite }); w.window = w;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-exercise.js'), 'utf8'), w);
  var wk = w.OvuExercise.week([{ type: 'exercise', date: '2026-10-22', data: e }, { type: 'exercise', date: '2026-10-22', data: P.entryFor(P.move('P05'), 'home', 30, false) }], '2026-10-22');
  check('the week shows PULSE breaks apart: 2 breaks, 75 s, and no WHO minutes, sessions or strength days from them', wk.pulse === 2 && wk.pulseSeconds === 75 && wk.minutes === 0 && wk.sessions === 0 && wk.strengthDays === 0 && wk.moderateEquivalent === 0, JSON.stringify(wk));
  check('Codex live check (22 Oct): adults 18+, non-slip seating on both seated cards, pregnancy framed as this feature\'s limit, spinal or multiple fractures and clinician limits named, osteoporosis alone not a reason to skip, pelvic floor signs named, chest pressure and lasting symptoms, and a screening question', /18 and over/.test(P.BEFORE.lines[0]) && /non-slip/.test(P.move('P05').setup) && /non-slip/.test(P.move('P06').setup) && /not adapted for pregnancy/.test(P.BEFORE.lines.join(' ')) && /spinal fracture or several fractures/.test(P.BEFORE.lines.join(' ')) && /osteoporosis on its own is not a reason/i.test(P.BEFORE.lines.join(' ')) && /leaking, a heavy or dragging feeling/.test(P.BEFORE.lines.join(' ')) && /pressure or tightness/.test(P.BEFORE.urgent) && /stays after you stop/.test(P.BEFORE.lines.join(' ')) && /reason above to skip or stop today/.test(P.BEFORE.check));
  var rs = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  check('the PULSE runner: a screening step (Something applies skips the cards and keeps ordinary logging), Choose another and Skip voiced, the emergency line stays on screen while moving, Stop stays during rest, the app going to the background or a late timer ends the break at the last moment seen, a running break counts in the one-activity rule, and cards say 45 s', /id="puApplies"/.test(rs) && /erin\('pulse-swap'\)/.test(rs) && /erin\('pulse-skip'\)/.test(rs) && /<p class="help pulseurgent">/.test(rs) && !/\$\('#puStop'\)\.hidden = true/.test(rs) && /pulseRun\.vis = function \(\) \{ if \(document\.hidden\) stop\(true\); \}/.test(rs) && /if \(now - r\.last > 1500\) \{ stop\(true\); return; \}/.test(rs) && /Math\.min\(performance\.now\(\), r\.last \+ 300\)/.test(rs) && /if \(pulseRun\) return \{ kind: 'pulse'/.test(rs) && / · 45 s<\/small>/.test(rs) && /emit\('activity', 'pulse', m\.id\);/.test(rs) && /\(wk\.pulseSeconds \|\| 0\) < 60 \? \(wk\.pulseSeconds \|\| 0\) \+ ' s'/.test(rs));
  check('a PULSE break shows its seconds in the journal and its PDF lines, and the four-week summary counts breaks and seconds apart from minutes', (fs.readFileSync(path.join(root, 'journal.html'), 'utf8').match(/d\.activity==='pulse'\?\(d\.seconds\|\|0\)\+' s'/g) || []).length === 2 && /pulseBreaks: pb\.length, pulseSeconds:/.test(fs.readFileSync(path.join(root, 'ovu-agents.js'), 'utf8')));
  (function () { /* 22 Oct, evening: the dreamy scores, the Past days sheet, Mindful pace, the fish citation */
    var sc = fs.readFileSync(path.join(root, 'ovu-scores.js'), 'utf8'), rm = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8'), care = fs.readFileSync(path.join(root, 'ovu-care.js'), 'utf8'), hb = fs.readFileSync(path.join(root, 'ovu-harbour.js'), 'utf8');
    var c2 = vm.createContext({ Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON, Date: Date, isFinite: isFinite }); c2.window = c2; vm.runInContext(sc, c2); var SC2 = c2.OvuScores;
    check('the dreamy view: a mood per score band (sleepy with no score, tender under 40, calm under 70, happy under 90, glow), and a cloud sprite for each exists', SC2.mood(null) === 'sleepy' && SC2.mood(39) === 'tender' && SC2.mood(69) === 'calm' && SC2.mood(89) === 'happy' && SC2.mood(90) === 'glow' && ['sleepy', 'tender', 'calm', 'happy', 'glow'].every(function (m) { return fs.existsSync(path.join(root, 'assets/room/scores/cloud-' + m + '.webp')); }));
    check('the scores panel draws a ring with the number inside, pastel pills for the parts, a kind line for what is still needed, and keeps the weights and the two disclaimers; no emoji anywhere in it', /class="scring/.test(sc) && /class="scpill/.test(sc) && /To finish the picture: /.test(sc) && /weights: regularity 25, frequency 25, period length 20, comfort 30/.test(sc) && /weights: steady timing 70, enough sleep 30/.test(sc) && /does not assess fertility, confirm ovulation or rule out a health condition/.test(sc) && /does not measure your body clock/.test(sc) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(sc));
    check('the Cycle tab opens the scores sheet (no tabs); the month grid lives in the Past days sheet, reached from Log or fix a past day and from the check-in tiles', /openSheet\('scores', 'Your rhythm'/.test(rm) && /id="scPast"/.test(rm) && /openSheet\('calendar', 'Past days'/.test(rm) && !/data-tab="rhythm"/.test(rm) && /if \(id === 'bleeding'\) openCalendar\('period', S\.today\(\)\)/.test(rm));
    check('Mindful pace is a choice on the You tab: quick pace runs a care step at once, speaks no cue line, and hides the mindful lines; practices she opens on purpose are untouched', /function mindfulQuick\(\)/.test(rm) && /'Mindful pace'/.test(rm) && /if \(act === 'mindful'\)/.test(rm) && /if \(mindfulQuick\(\)\) \{ opt = Object\.assign\(\{\}, opt, \{ quiet: true, line: '' \}\); \}/.test(rm) && /var ms = quick \? 0 : \(C\.slowMs != null \? C\.slowMs : o\.ms\)/.test(care) && /html\[data-mindful=quick\] \.mindline:not\(\.keep\)\{display:none\}/.test(css));
    check('the sea animals keep one plain fact and no citation, on screen or in the data (Jamie, 22 Oct)', !/class="fishsrc"/.test(hb) && !/source: '/.test(hb) && !/url: 'https/.test(hb));
  })();
  check('the PULSE flow asks before saving, ends the break when she leaves the sheet or the app, and joins the one-activity rule', /Log what I did/.test(rs) && /current !== 'pulse' \|\| document\.hidden/.test(rs) && /function openPulse\(id\) \{[\s\S]{0,200}refuseBusy\(\)/.test(rs));
  var lines = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/erin-actions/lines.json'), 'utf8')).map(function (x) { return x.id; });
  check("Erin's voice for before, start, stop and log, each with its clip", ['pulse-before', 'pulse-start', 'pulse-stop', 'pulse-log'].every(function (id) { return lines.indexOf(id) > -1 && fs.existsSync(path.join(root, 'assets/audio/erin-actions/' + id + '.mp3')); }));
})();

(function () {
  console.log('2k32. the ranch (22 Oct): herd, barn and coop room, babies on day strings, product size by love; nothing lost, nothing gamed');
  var c = vm.createContext({ Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON, Date: Date, isFinite: isFinite, RegExp: RegExp }); c.window = c;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-ranch.js'), 'utf8'), c);
  var R = c.OvuRanch, D = '2026-10-22';
  var farm0 = { pantry: { egg: 3, milk: 1, onsenegg: 0 }, animals: { clover: '2026-10-21', mochi: '2026-10-22' }, love: { clover: { n: 10, day: D, acts: {}, full: '2026-10-10' }, mochi: { n: 5, day: D, acts: {} } }, harvest: {} };
  var f1 = R.migrate(farm0, D), r1 = R.ranchOf(f1);
  check('migration once: the three starters become the herd, with their love and collection days kept, and pantry eggs and milk counted as small', r1.herd.map(function (a) { return a.id; }).join() === 'clover,mochi,kaya' && f1.love.clover.n === 10 && f1.animals.mochi === '2026-10-22' && r1.sizes.egg.small === 3 && r1.sizes.milk.small === 1 && R.migrate(f1, '2026-10-23') === f1);
  check('an unknown or broken ranch record never replaces the herd with starters; a malformed animal is dropped, the rest kept', (function () { var f = JSON.parse(JSON.stringify(f1)); f.ranch.herd.push({ id: 'cow9', kind: 'cow', name: 'Bess' }); f.ranch.herd.push({ kind: 'cat' }); f.ranch.herd.push({ id: 'BAD ID', kind: 'hen' }); var r = R.ranchOf(f); return r.herd.length === 4 && r.herd[3].name === 'Bess' && R.ranchOf(R.migrate(f, D)).herd.length === 4; })());
  check('starter room: the barn holds 1 cow and the coop 2 hens, so expansion comes first; an upgrade takes the barn to 4 and the coop to 6', R.room(r1, 'barn') === 0 && R.room(r1, 'coop') === 0 && R.upgrade(f1, 'barn').capacity === 4 && R.upgrade(f1, 'coop').capacity === 6 && R.upgrade(R.upgrade(f1, 'barn').farm, 'barn').ok === false);
  var fb = R.upgrade(f1, 'coop').farm, b1 = R.buy(fb, 'hen', 'Pip <b>x</b>', D);
  check('buying a hen after the coop upgrade: a named adult that produces from tomorrow (collection day set to today), name cleaned', b1.ok && b1.cost === 120 && b1.animal.name === 'Pip x' && b1.farm.animals[b1.animal.id] === D && R.list(R.ranchOf(b1.farm), 'hen').length === 3 && R.buy(f1, 'hen', 'Z', D).ok === false);
  check('prices: hen 120, cow 240, barn and coop upgrades 300 each; no way to turn products into hearts', R.KINDS.hen.cost === 120 && R.KINDS.cow.cost === 240 && R.UPGRADE_COST.barn === 300 && R.UPGRADE_COST.coop === 300 && !/hearts \+=|earned/.test(fs.readFileSync(path.join(root, 'ovu-ranch.js'), 'utf8')));
  var inc = R.incubate(b1.farm, 'small', D);
  check('an egg in the incubator: one small egg leaves the pantry and the size mix, a coop place is reserved, due in three days', inc.ok && inc.due === '2026-10-25' && inc.farm.pantry.egg === 2 && R.ranchOf(inc.farm).sizes.egg.small === 2 && R.room(R.ranchOf(inc.farm), 'coop') === 2 && R.incubate(inc.farm, 'small', D).ok === false);
  var hatched = R.advance(inc.farm, '2026-10-25'), rh = R.ranchOf(hatched), chick = R.list(rh, 'hen')[3];
  check('hatching on the due day, in the same step as the timer clearing: a chick that grows up seven days later and makes nothing until then', chick && chick.name === 'Chick' && chick.born === '2026-10-25' && chick.adultOn === '2026-11-01' && rh.incubator === null && !R.isAdult(chick, '2026-10-31') && R.isAdult(chick, '2026-11-01'));
  check('a day never moves backwards: a clock set back changes nothing, and the same day again changes nothing', R.advance(hatched, '2026-10-20') === hatched && R.advance(hatched, '2026-10-25') === hatched);
  var fbarn = R.upgrade(f1, 'barn').farm, cd = R.calfDue(fbarn, 'clover', D), sc = R.startCalf(fbarn, 'clover', D);
  check('a cow at ten hearts for a week can expect a calf: due today when already qualified, a stall reserved, no second calf at once', cd === D && sc.ok && sc.due === D && R.room(R.ranchOf(sc.farm), 'barn') === 2 && R.startCalf(sc.farm, 'clover', D).ok === false);
  var born = R.advance(sc.farm, '2026-10-23'), calf = R.list(R.ranchOf(born), 'cow')[1];
  check('the calf arrives on the next day change and grows up in fourteen days; a repeat calf waits seven days after the last', calf && calf.name === 'Calf' && calf.adultOn === R.addDays(calf.born, 14) && R.calfDue(born, 'clover', '2026-10-24') === '2026-10-29');
  check('a cow without full love, or a baby, cannot have a calf', R.calfDue(R.upgrade(f1, 'barn').farm, 'nope', D) === null && (function () { var f = JSON.parse(JSON.stringify(fbarn)); f.love.clover.n = 9; return R.calfDue(f, 'clover', D) === null; })());
  check('Codex round one: a repeat calf waits seven days from the last birth, not from the day it was planned', (function () { var f = JSON.parse(JSON.stringify(fbarn)); var a = R.startCalf(f, 'clover', D); var b = R.advance(a.farm, '2026-10-23'); return R.list(R.ranchOf(b), 'cow').length === 2 && R.calfDue(b, 'clover', '2026-10-23') === '2026-10-29' && R.calfDue(b, 'clover', '2026-10-29') === '2026-10-29'; })());
  check('a clock set back cannot buy, incubate or plan: commands refuse a day before the ranch\'s last day', (function () { var f = R.advance(R.upgrade(f1, 'coop').farm, '2026-10-22'); return !R.buy(f, 'hen', 'Z', '2026-10-01').ok && !R.incubate(f, 'small', '2026-10-01').ok && !R.startCalf(f, 'clover', '2026-10-01').ok && R.buy(f, 'hen', 'Z', '2026-10-22').ok; })());
  check('migration gives an already full-love cow her baseline, so a calf is possible a week later without another care action', (function () { var f = R.migrate({ pantry: {}, animals: {}, love: { clover: { n: 10, day: '2026-10-01', acts: {} } } }, D); f.ranch = R.upgrade(f, 'barn').farm.ranch; return f.love.clover.full === D && R.calfDue(f, 'clover', D) === '2026-10-29' && R.calfDue(f, 'clover', '2026-10-30') === '2026-10-30'; })());
  check('love filled as a calf counts from the day she grew up, so a calf cannot follow adulthood at once', (function () { var f = JSON.parse(JSON.stringify(fbarn)); f.ranch.herd.push({ id: 'cow7', kind: 'cow', name: 'Bell', born: '2026-10-01', adultOn: '2026-10-15' }); f.love.cow7 = { n: 10, day: '2026-10-10', acts: {}, full: '2026-10-10' }; return R.calfDue(f, 'cow7', '2026-10-15') === '2026-10-22'; })());
  check('adulthood once announced never reverses when the date goes back', (function () { var a = { id: 'hen9', kind: 'hen', adultOn: '2026-10-20', grown: true }; return R.isAdult(a, '2026-10-01') && R.ranchOf({ ranch: { herd: [a] } }).herd[0].grown === true; })());
  check('product size follows love: 0 to 3 small, 4 to 7 medium, 8 to 10 large', [0, 3, 4, 7, 8, 10].map(R.productSize).join() === 'small,small,medium,medium,large,large');
  var add = R.addProduct(f1, 'egg', 'large', 2), tkr = R.takeProduct(add, 'egg', 4), tk = tkr.farm;
  check('the size mix: products added at their size and taken smallest first; it never exceeds the pantry total and a gap fills as small', R.ranchOf(add).sizes.egg.large === 2 && R.ranchOf(tk).sizes.egg.small === 0 && R.ranchOf(tk).sizes.egg.large === 1 && JSON.stringify(tkr.taken) === '{"small":3,"large":1}' && (function () { var f = JSON.parse(JSON.stringify(f1)); f.pantry.egg = 7; f.ranch.sizes.egg.large = 9; var r = R.ranchOf(R.reconcile(f)).sizes.egg; return r.small + r.medium + r.large === 7; })());
  /* the barn over the herd, through the real farm and barn modules */
  var wb = scenes('2026-10-22'); wb.OvuRoom = null; wb.OvuZones = null;
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8'), wb, { filename: 'ovu-farm.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-ranch.js'), 'utf8'), wb, { filename: 'ovu-ranch.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-barn.js'), 'utf8'), wb, { filename: 'ovu-barn.js' });
  var Bb = wb.OvuBarn, Sb = wb.OvuStore, Fb = wb.OvuFarm, Rb = wb.OvuRanch, DB = '2026-10-22';
  check('before any ranch record the herd is the three starters, and the barn reads them by name', Bb.herd(Fb.farmState(Sb)).map(function (a) { return a.id; }).join() === 'clover,mochi,kaya' && Bb.nameOf(Fb.farmState(Sb), 'kaya') === 'Kaya');
  var e1 = Bb.collectEggs(Sb, DB, null);
  check('collecting writes the ranch record once and counts each egg at the hen\'s love size (two small from new hens)', e1.ok && e1.n === 2 && e1.sizes.small === 2 && Rb.ranchOf(Fb.farmState(Sb)).sizes.egg.small === 2 && Fb.farmState(Sb).pantry.egg === 2);
  (function () { var f = Fb.farmState(Sb); f.love = { clover: { n: 9, day: DB, acts: {} } }; f.ranch = Rb.upgrade(Rb.upgrade(f, 'barn').farm, 'coop').farm.ranch; var b = Rb.buy(f, 'cow', 'Daisy', DB); Sb.setState({ farm: b.farm }); })();
  var m0 = Bb.milkCows(Sb, DB), m1 = Bb.milk(Sb, DB, null);
  check('a cow bought today gives milk from tomorrow: today only Clover is ready, at the large size her nine hearts earn', m0.join() === 'clover' && m1.ok && m1.n === 1 && m1.sizes.large === 1 && Rb.ranchOf(Fb.farmState(Sb)).sizes.milk.large === 1);
  var m2 = Bb.milkCows(Sb, '2026-10-23'), mm = Bb.milk(Sb, '2026-10-23', null);
  check('the next day both cows have milk, milked together in one go: Clover large, Daisy small', m2.join() === 'clover,cow1' && mm.ok && mm.n === 2 && mm.sizes.large === 1 && mm.sizes.small === 1 && Fb.farmState(Sb).pantry.milk === 3);
  (function () { var f = Fb.farmState(Sb); f.harvest = { carrot: 2 }; Sb.setState({ farm: f }); })();
  var t1 = Bb.giveTreat(Sb, 'cow1', 'carrot', DB), t2 = Bb.giveTreat(Sb, 'cow1', 'kangkong', DB);
  check('a treat goes to the cow it was offered to: Daisy takes the carrot (love 1), kangkong is not cow food', t1.ok && t1.gained && Bb.love(Sb, 'cow1') === 1 && Bb.love(Sb, 'clover') === 9 && !t2.ok);
  (function () { var f = Fb.farmState(Sb); var inc = Rb.incubate(f, 'small', DB); Sb.setState({ farm: Rb.advance(inc.farm, '2026-10-25') }); })();
  var chickId = Rb.list(Rb.ranchOf(Fb.farmState(Sb)), 'hen')[2].id;
  check('a hatched chick is in the herd but lays nothing until it grows up; it can still be petted', Bb.isBaby(Fb.farmState(Sb), chickId, '2026-10-26') && Bb.eggsReady(Sb, '2026-10-26').indexOf(chickId) < 0 && Bb.eggsReady(Sb, '2026-11-02').indexOf(chickId) > -1 && Bb.care(Sb, chickId, 'pet', '2026-10-26').gained);
  check('love reaching ten records the day it filled, which a calf is counted from', (function () { for (var i = 0; i < 3; i++) Bb.care(Sb, 'clover', 'pet', '2026-11-0' + (i + 1)); var l = Fb.farmState(Sb).love.clover; return l.n === 10 && l.full === '2026-11-01'; })());
  check('news between two ranch records names what arrived and what grew up, once', (function () { var f = Fb.farmState(Sb), before = f.ranch, after = Rb.advance(f, '2026-11-02').ranch; var n = Rb.news(before, after); return n.grown.length === 1 && n.grown[0].id === chickId && Rb.news(after, Rb.advance({ ranch: after, pantry: {}, animals: {} }, '2026-11-03').ranch || after).grown.length === 0; })());
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-kitchen.js'), 'utf8'), wb, { filename: 'ovu-kitchen.js' });
  var Kb = wb.OvuKitchen;
  (function () { var f = Fb.farmState(Sb); f.harvest = { tomato: 2 }; f.kitchen = { rice: 1 }; f.pantry.egg = 1; f.ranch.sizes.egg = { small: 0, medium: 0, large: 1 }; Sb.setState({ farm: f }); })();
  var ck = Kb.cook(Sb, 'tomatoegg'), fz = Rb.ranchOf(Fb.farmState(Sb)).sizes.egg;
  check('cooking takes the egg\'s size with it: the one large egg leaves the mix', ck.ok && Fb.farmState(Sb).pantry.egg === 0 && fz.large === 0 && fz.small === 0);
  (function () { var f = Fb.farmState(Sb); f.harvest = { tomato: 2 }; f.kitchen = { rice: 1 }; f.pantry.egg = 1; f.dishes = { tomatoegg: 99 }; Sb.setState({ farm: f }); })();
  var full = Kb.cook(Sb, 'tomatoegg'), fa = Fb.farmState(Sb);
  check('a full dish shelf refuses before anything is used: tomatoes, rice and the egg all stay', !full.ok && /99/.test(full.why) && fa.harvest.tomato === 2 && fa.kitchen.rice === 1 && fa.pantry.egg === 1 && fa.dishes.tomatoegg === 99);
  var bought = Kb.buyStaple(Sb, wb.OvuRewards, 'egg');
  check('a grocer egg joins the mix as a small one', !bought.ok || Rb.ranchOf(Fb.farmState(Sb)).sizes.egg.small >= 1);
  check('every Erin ranch line has its script and clip', ['ranch-open', 'ranch-room', 'ranch-arrive', 'ranch-egg', 'ranch-hatch', 'ranch-calf', 'ranch-born', 'ranch-grown'].every(function (id) { return fs.existsSync(path.join(root, 'assets/audio/erin-actions/' + id + '.mp3')); }));
  check('the farm keeps every animal\'s collection day, not only the three starters, and the ranch record rides along in farmState', /Object\.keys\(f\.animals/.test(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8')) && /ranch: f\.ranch/.test(fs.readFileSync(path.join(root, 'ovu-farm.js'), 'utf8')));
  /* Codex, 22 Oct (second review): a care save read before another tab's purchase overwrote the purchase. Two tabs share
     one storage and one lock; the care runs inside the lock, so it reads the farm after the hen was bought. */
  (function () {
    var wa = scenes('2026-10-22'); wa.OvuRoom = null; wa.OvuZones = null; wa.localStorage = wb.localStorage;
    ['ovu-farm.js', 'ovu-ranch.js', 'ovu-barn.js', 'ovu-kitchen.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), wa, { filename: f }); });
    var Sa = wa.OvuStore, Fa = wa.OvuFarm, Ba = wa.OvuBarn, chain = Promise.resolve(), names = [], DL = '2026-11-03'; /* after every day the ranch has seen */
    var mgr = { request: function (name, fn) { names.push(name); chain = chain.then(fn); return chain; } }; wa.navigator.locks = mgr; wb.navigator.locks = mgr;
    (function () { var f = Fb.farmState(Sb); f.love = {}; var u = Rb.upgrade(f, 'coop'); if (u.ok) f.ranch = u.farm.ranch; Sb.setState({ farm: f }); })();
    Sa.reload(); var hensBefore = Rb.list(Rb.ranchOf(Fa.farmState(Sa)), 'hen').length;
    var staleA = Fa.farmState(Sa); /* tab A has read the farm */
    var buy = Rb.buy(Fb.farmState(Sb), 'hen', 'Bao', DL); if (buy.ok) Sb.commit({ farm: buy.farm });
    var unlocked = JSON.parse(JSON.stringify(staleA)); unlocked.love = { clover: { n: 1, day: DL, acts: { pet: 1 } } };
    check('without the lock a stale tab\'s care save would drop the hen (the reported race)', buy.ok && Rb.list(Rb.ranchOf(unlocked), 'hen').length === hensBefore && Rb.list(Rb.ranchOf(Fb.farmState(Sb)), 'hen').length === hensBefore + 1);
    var done = Fa.locked(Sa, function () { return Ba.care(Sa, 'clover', 'pet', DL); }).then(function (r) {
      var fa = Fa.farmState(Sa), fb2 = Fb.farmState(Sb);
      check('inside the farm lock the care save reads the farm again: Bao stays and the heart is kept, in both tabs', r.ok && r.gained && Rb.list(Rb.ranchOf(fa), 'hen').length === hensBefore + 1 && Rb.list(Rb.ranchOf(fa), 'hen').some(function (h) { return h.name === 'Bao'; }) && fa.love.clover.n === 1 && Sb.reload() && Rb.list(Rb.ranchOf(Fb.farmState(Sb)), 'hen').length === hensBefore + 1, JSON.stringify({ r: r, hens: Rb.list(Rb.ranchOf(fa), 'hen').map(function (h) { return h.name; }) }));
      check('every barn, kitchen, villager and grocer farm writer goes through the one ovumind-farm lock, and no subscriber writes the farm back', names.length === 1 && names[0] === 'ovumind-farm' && (function () { var src = fs.readFileSync(path.join(root, 'ovu-barn.js'), 'utf8'), bare = src.replace(/locked\(function \(\) \{[\s\S]*?\n\s*\}\);/g, ''); return !/\n\s*var r = (care|giveTreat|collectEggs|milk|findCave|cookEggs)\(S/.test(bare) && /function settle\(\) \{ return locked\(settleNow\)/.test(src) && /function maybeHint\(\) \{\s*locked\(function/.test(src) && !/fixing = true/.test(src) && (src.split('S.subscribe(')[1] || '').indexOf('save(S') < 0; })() && /FM\(\)\.locked\(S, go\)/.test(fs.readFileSync(path.join(root, 'ovu-kitchen.js'), 'utf8')) && /function locked\(fn\) \{ return FM\.locked \? FM\.locked\(S, fn\)/.test(fs.readFileSync(path.join(root, 'ovu-villagers.js'), 'utf8')) && /FM\.locked\(S, go\)[\s\S]{0,120}/.test(fs.readFileSync(path.join(root, 'ovu-lane.js'), 'utf8')) && /buyStaple\(S, RW\(\), btn\.dataset\.staple\)/.test(fs.readFileSync(path.join(root, 'ovu-lane.js'), 'utf8').split('var go = function () {').slice(1).join('|')));
    });
    done.catch(function (e) { check('the locked care race test ran to the end', false, String(e && e.stack || e)); });
    (function () { /* round seven: a tester phone's resent link carries no tester rewards; the token wait has the request's deadline */
      var gs = fs.readFileSync(path.join(root, 'ovu-gamesave.js'), 'utf8');
      check('a resent link from a tester phone applies the account copy alone, and the token wait gives up after the same 15 s as the request', /tainted: !!m\.tainted \}\);/.test(gs) && /else if \(p\.remote\) apply\(uid, linkMerge\(now, p\.remote\)\);/.test(gs) && /return withDeadline\(token \|\| A\(\)\.token\(\), FETCH_MS\)\.then\(function \(tk\) \{/.test(gs) && /function withDeadline\(p, ms\)/.test(gs));
    })();
    (function () { /* round six: a resent link never writes an old copy over newer play; a deadline on the game-save request; Stop during the lock wait */
      var read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }, gs = read('ovu-gamesave.js'), care = read('ovu-care.js');
      check('a link remembers the local copy it was packed from and the account copy it merged; its answer applies the old target only when nothing changed here, else merges the account copy into what the phone has now and sends that up', /localHash: hashOf\(mine\), remote: live \? clone\(row\.save\) : null/.test(gs) && /if \(p\.localHash == null \|\| hashOf\(now\) === p\.localHash\) \{/.test(gs) && /else if \(p\.remote\) apply\(uid, linkMerge\(now, p\.remote\)\);/.test(gs) && /journal: extra && !tnt \? \[\{ id: 'l' \+ Date\.now\(\), kind: 'other', n: extra \}\] : \[\], pending: null, seq: tnt \? 0 : 1, acked: 0, hash: tnt \? hashOf\(pack\(S\.state\(\)\)\) : hashOf\(p\.save\) \}\);\s*schedule\(\);/.test(gs) && /var tnt = !!\(p\.tainted \|\| m\.tainted\);/.test(gs) && /if \(tnt\) apply\(uid, clone\(p\.save\)\);/.test(gs));
      check('every game-save request has a 15 s deadline (the farm lock is held meanwhile), cleared on any answer', /var FETCH_MS = 15000;/.test(gs) && /new AbortController\(\) : null, deadline = setTimeout\(function \(\) \{ if \(ac\) ac\.abort\(\); \}, FETCH_MS\)/.test(gs) && /signal: ac \? ac\.signal : undefined/.test(gs) && /clearTimeout\(deadline\); return j; \}, function \(e\) \{ clearTimeout\(deadline\); throw e; \}/.test(gs));
      check('a Stop after the step finished but before its save had the lock marks the token stopped and puts the sheet back; the writers read it inside the lock', /tok\.finished = true; done\(tok\);/.test(care) && /if \(cur !== tok\) \{ if \(tok\.finished && !tok\.stopped\) \{ tok\.stopped = true; if \(R\.endMoment\) R\.endMoment\(\); if \(o\.cancel\) o\.cancel\(\); \} return; \}/.test(care));
    })();
    (function () { /* round five: the guide and the game save inside the farm lock, the sheet counter, steps that re-check */
      var read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };
      var farm = read('ovu-farm.js'), gh = read('ovu-greenhouse.js'), gs = read('ovu-gamesave.js'), rm = read('room.js'), barn = read('ovu-barn.js');
      check('the farm guide\'s first-visit flag is written inside the lock, and the game save holds the farm lock for its whole cycle inside its own', /if \(!farmState\(S\)\.guided\) F\.locked\(S, function/.test(farm) && !/\n\s*var f = copy\(farmState\(S\)\); if \(!f\.guided\)/.test(farm) && /L\.request\('ovumind-gamesave', function \(\) \{ return L\.request\('ovumind-farm', function \(\) \{ try \{ if \(S\.reload\) S\.reload\(\); \} catch \(e\) \{ \} return syncNow\(\); \}\); \}\)/.test(gs));
      check('the room counts sheet openings; the counter does not open after settle if a sheet came and went; every farm and greenhouse step, the harvest, the well and clearing a planter re-check the same opening and wakefulness inside the lock', /sheetSeq: function \(\) \{ return sheetSeq; \}/.test(rm) && /if \(R\.sheetSeq && R\.sheetSeq\(\) !== seq0\) return;/.test(barn) && (farm.match(/if \(!stillHere\('farm(bed|well)', (tk|null), (id|back)\)\) return;/g) || []).length === 3 && (gh.match(/if \(!stillHere\('ghbed', (tk|null), id\)\) return;/g) || []).length === 2 && /function stillHere\(sheetId, tk, arg\)/.test(farm) && /function stillHere\(sheetId, tk, id\)/.test(gh) && /shown && shown\.kind === 'bed' && shown\.arg === arg/.test(farm) && /if \(id != null && shownBed !== id\) return false;/.test(gh) && /if \(tk && tk\.stopped\) return false;/.test(farm) && /if \(tk && tk\.stopped\) return false;/.test(gh));
    })();
    (function () { /* round four: every remaining writer, the readers, the viewer and the counter */
      var read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };
      var lane = read('ovu-lane.js'), farm = read('ovu-farm.js'), gh = read('ovu-greenhouse.js'), pv = read('ovu-pageview.js'), rm = read('room.js'), barn = read('ovu-barn.js');
      check('the grocer\'s seed packs, crop unlocks, herb starts and swaps all run inside FM.locked, each re-checking the grocer is still open', (lane.match(/if \(FM\.locked\) FM\.locked\(S, go\); else go\(\);/g) || []).length === 4 && !/\n\s*var res = (FM\.buyPack|KT\(\)\.buyStaple|GH\.freeStartOpen|GH \? GH\.swapAny)/.test(lane.replace(/var go = function \(\) \{[\s\S]*?\n\s*\};/g, '')));
      check('the farm scene\'s bed step, harvest, well, shed seed and tool all run inside F.locked, and the greenhouse planter step, clearing and brewing inside its lock helper', (farm.match(/F\.locked\(S, function/g) || []).length === 6 && /slowStep\(acts, o, function \(tk\) \{ F\.locked\(S, function/.test(farm) && (gh.match(/lockedF\(function/g) || []).length === 3 && /function lockedF\(fn\) \{ var FMl = root\.OvuFarm; return FMl && FMl\.locked \? FMl\.locked\(S, fn\)/.test(gh));
      var stale = { pantry: { egg: 1, milk: 0, onsenegg: 0 }, animals: {}, harvest: {}, ranch: { v: 1, herd: [], sizes: { egg: { small: 0, medium: 0, large: 3 }, milk: { small: 0, medium: 0, large: 0 } } } };
      var vs = Rb.viewSizes(stale);
      check('a reader shows the size mix trimmed to the pantry (one egg, not three large), without writing the stored farm', vs.egg.large === 1 && vs.egg.small === 0 && stale.ranch.sizes.egg.large === 3 && /RN\.viewSizes\(f\)/.test(read('ovu-today.js')) && /RN\(\)\.viewSizes\(f\)/.test(barn));
      check('the counter opens after settle only if nothing changed her mind: a later tap, another sheet or a counter she closed all win', /var tok = \+\+ranchReq, wasOpen = R\.sheetOpen\(\) && R\.sheetId\(\) === 'ranch'/.test(barn) && /if \(tok !== ranchReq \|\| !at\('barn'\)\) return;/.test(barn) && /if \(wasOpen && !\(R\.sheetOpen\(\) && R\.sheetId\(\) === 'ranch'\)\) return;/.test(barn));
      check('the viewer hands over once per opening: load, poll, link click and the nested room all go through handoff(), the poll never throws on a cross-origin frame', /function handoff\(h\) \{\s*if \(handed\) return; handed = true; root\.clearInterval\(watch\);/.test(pv) && (pv.match(/handoff\(/g) || []).length >= 4 && (pv.match(/close\(\); if \(h\) root\.dispatchEvent/g) || []).length === 1 && /handed = false; frame\.src = href; watchFrame\(\);/.test(pv) && /try \{ p = frame\.contentWindow\.location\.pathname; h = frame\.contentWindow\.location\.hash \|\| ''; \} catch \(e\) \{ return; \}/.test(pv) && /if \(PP\.handoff\) PP\.handoff\(hh\)/.test(rm));
    })();
  })();
})();

/* ---------- tidy up (ovu-tidy.js): the clutter model, the spots on every home floor, the broom's route, the practice contract ---------- */
(function tidyUp() {
  console.log('tidy up: clutter by the clock, spots on open floor, the broom stays on the floor, the practice contract');
  var w = scenes('2026-10-23');
  w.OvuRoom = null; /* model only: the DOM wiring stands down without a room */
  vm.runInContext(fs.readFileSync(path.join(root, 'ovu-tidy.js'), 'utf8'), w, { filename: 'ovu-tidy.js' });
  var T = w.OvuTidy.M, S = w.OvuStore, K = w.OvuWalk, MIN = 60000, H = 3600000, t0 = Date.parse('2026-10-23T09:00:00+08:00');
  var r0 = T.advance(null, t0);
  check('the first visit anchors the floor and shows nothing', r0.changed && r0.state.items.length === 0 && r0.state.last === new Date(t0).toISOString() && r0.state.day.n === 0);
  var r1 = T.advance(r0.state, t0 + 149 * MIN); check('149 minutes later still nothing, and nothing to write', r1.state.items.length === 0 && !r1.changed);
  var r2 = T.advance(r0.state, t0 + 150 * MIN); check('150 minutes after the first visit one thing lies on the floor, in slot 0', r2.state.items.length === 1 && r2.state.items[0].slot === 0 && r2.state.day.n === 1 && r2.state.n === 1);
  var r3 = T.advance(r2.state, t0 + 10 * H); check('a long day gives two things at most, of different kinds, in different slots', r3.state.items.length === 2 && r3.state.items[0].kind !== r3.state.items[1].kind && r3.state.items[0].slot !== r3.state.items[1].slot && r3.state.day.n === 2);
  var back = T.advance(r3.state, t0 + 4 * H); check('a clock set back changes nothing', JSON.stringify(back.state) === JSON.stringify(r3.state) && !back.changed);
  var d2 = t0 + 24 * H, r4 = T.advance(r3.state, d2);
  check('the next day starts at its first visit: nothing new yet, the anchor is that visit, the day count starts at 0', r4.state.items.length === 2 && r4.state.last === new Date(d2).toISOString() && r4.state.day.d === T.dayOf(d2) && r4.state.day.n === 0);
  var r5 = T.advance(r4.state, d2 + 150 * MIN); check('a gap after that first visit the third thing lands, in the third slot', r5.state.items.length === 3 && r5.state.day.n === 1 && r5.state.items[2].slot === 2);
  var r6 = T.advance(r5.state, d2 + 12 * H); check('with three on the floor nothing more comes however long she waits that day', r6.state.items.length === 3 && !r6.changed);
  var away = T.advance(r0.state, t0 + 5 * 24 * H); check('five absent days: no backfill, the anchor moves to this visit, the floor stays empty', away.state.items.length === 0 && away.state.last === new Date(t0 + 5 * 24 * H).toISOString());
  var ids = r5.state.items.map(function (it) { return it.id; }), rm = T.remove(r5.state, [ids[1]], d2 + 3 * H);
  check('tidying one thing removes it and sets the tidy time and the anchor', rm.removed === 1 && rm.state.items.length === 2 && rm.state.tidiedAt === new Date(d2 + 3 * H).toISOString() && rm.state.last === rm.state.tidiedAt);
  var rmBack = T.remove(r5.state, [ids[0]], d2 - 2 * H); check('a tidy dated before the anchor (the clock went back) cannot rewind the anchor', Date.parse(rmBack.state.last) >= Date.parse(r5.state.last));
  var r7 = T.advance(rm.state, d2 + 3 * H + 150 * MIN);
  check('the next thing after a tidy takes the freed slot and a kind not on the floor', r7.state.items.length === 3 && r7.state.items[2].slot === r5.state.items[1].slot && r7.state.items.map(function (it) { return it.kind; }).filter(function (k, i, a) { return a.indexOf(k) !== i; }).length === 0, JSON.stringify(r7.state.items));
  var seen = {}, st = T.advance(null, t0).state, tt = t0;
  for (var i = 0; i < 8; i++) { tt += 26 * H; st = T.advance(st, tt).state; st = T.advance(st, tt + 3 * H).state; st.items.forEach(function (it) { seen[it.kind] = 1; }); if (st.items.length === 3) st = T.remove(st, [st.items[0].id], tt + 3 * H + MIN).state; }
  check('over a week every kind has appeared and no slot above 2 was ever used', Object.keys(seen).length === 4 && st.items.every(function (it) { return it.slot >= 0 && it.slot <= 2; }), JSON.stringify(seen));
  var rt = T.normalise(JSON.parse(JSON.stringify(r5.state))); check('the state round-trips through JSON', JSON.stringify(rt) === JSON.stringify(r5.state));
  var junk = T.normalise({ items: [{ id: 'x', kind: 'piano', at: 'nope' }, { id: 'y', kind: 'sock', at: '2026-10-23T01:00:00Z' }, { id: 'y2', kind: 'sock', at: '2026-10-23T01:00:00Z' }], last: 'garbage', day: { d: 'x' }, n: -3 });
  check('an edited save keeps only valid things, one of each kind, and drops a bad anchor', junk.items.length === 1 && junk.items[0].id === 'y' && junk.last === null && junk.day === null && junk.n === 0);
  S.setState({ tidy: null }); var c1 = T.current(S, t0), c2 = T.current(S, t0 + 150 * MIN);
  check('current() writes the store only when something changed, and tidy() removes', c1.items.length === 0 && c2.items.length === 1 && S.state().tidy.items.length === 1 && T.tidy(S, [c2.items[0].id], t0 + 160 * MIN).removed === 1 && S.state().tidy.items.length === 0);
  ['room', 'house', 'bathhouse', 'familyhome'].forEach(function (id) {
    var L = w.LAYOUTS[id], sp = T.spots(L, K), world = K.world(L, []), m = K.rasterise(world), floor = L.stairs ? [L.zones[0]] : world.zones;
    var ok = sp.length === 3 && sp.every(function (p) { return K.inZones(floor, p.x, p.y) && !K.blocked(world.solids, p.x, p.y) && !(L.stairs && K.inPoly(L.zones[2], p.x, p.y)); });
    var far = sp.every(function (p) { return [L.home].concat(L.hotspots.map(function (h) { return h.wp; }).filter(Boolean), L.doors).every(function (a) { return Math.hypot(p.x - a.x, (p.y - a.y) / K.Y_SCALE) >= 6; }) && L.hotspots.every(function (h) { return Math.hypot(p.x - h.x, (p.y - h.y) / K.Y_SCALE) >= 7; }); });
    var apart = sp.every(function (p, i) { return sp.every(function (q, j) { return i === j || Math.hypot(p.x - q.x, (p.y - q.y) / K.Y_SCALE) >= 10; }); });
    var routes = sp.every(function (p, i) { var from = i ? sp[i - 1] : L.home, r = K.plan(world, from, p, 2); return r && r.pts.every(function (q, j) { return j === 0 || K.lineFree(m, r.pts[j - 1], q); }) && Math.hypot(r.pts[r.pts.length - 1].x - p.x, (r.pts[r.pts.length - 1].y - p.y) / K.Y_SCALE) <= T.REACH; });
    check(id + ': three clutter spots on open ground floor (never the stairs), clear of her spot, the stand points, doors and pins, ten apart, each reachable by the planner within brush reach', ok && far && apart && routes, JSON.stringify(sp));
  });
  var L = w.LAYOUTS.room, sp = T.spots(L, K), items = [{ id: 'a', kind: 'sock', at: '2026-10-23T01:00:00Z', slot: 0 }, { id: 'b', kind: 'cup', at: '2026-10-23T01:00:00Z', slot: 1 }];
  var covered = K.world(L, [{ id: 'beanbag', x: sp[0].x, y: sp[0].y + 1, w: 10 }]), placed = T.placeItems(L, K, items, covered);
  check('a piece of furniture placed on a spot moves that thing to the nearest free floor cell; the other stays put', placed[0] && placed[1] && (placed[0].x !== sp[0].x || placed[0].y !== sp[0].y) && K.inZones(L.zones, placed[0].x, placed[0].y) && !K.blocked(covered.solids, placed[0].x, placed[0].y) && placed[1].x === sp[1].x && placed[1].y === sp[1].y, JSON.stringify(placed));
  check('placement is deterministic', JSON.stringify(T.placeItems(L, K, items, covered)) === JSON.stringify(placed));
  (function () { var H = w.LAYOUTS.house, hs = T.spots(H, K), near = hs.map(function (p) { return { id: 'b' + p.x, x: p.x, y: p.y + 1, w: 12 }; }), hw = K.world(H, near), hp = T.placeItems(H, K, hs.map(function (p, i) { return { id: 'i' + i, kind: T.KINDS[i], at: '2026-10-23T01:00:00Z', slot: i }; }), hw);
    check('in a house every fallback cell keeps the same floor rule as the picker: ground floor, never the stairs strip or upstairs', hp.every(function (p) { return !p || (T.ground(H, K, p.x, p.y) && !K.inPoly(H.zones[2], p.x, p.y) && p.y >= H.upstairsY); }), JSON.stringify(hp)); })();
  var open = K.world(L, []), targets = [{ id: 'a', x: sp[0].x, y: sp[0].y }, { id: 'b', x: sp[1].x, y: sp[1].y }], legs = T.route(K, open, L.home, targets, L);
  var onFloorAll = legs.every(function (lg) { return lg.pts.every(function (q, j) { return j === 0 || K.segClear(open, lg.pts[j - 1], q, null); }); });
  check('the sweep route visits both things, then the empty spot, then rests by the door, every leg on the floor and every thing within brush reach', legs.filter(function (l) { return l.item; }).length === 2 && legs.some(function (l) { return !l.item && !l.rest; }) && legs[legs.length - 1].rest && onFloorAll && legs.filter(function (l) { return l.item; }).every(function (l) { return T.reached(l.pts[l.pts.length - 1], l.to); }), JSON.stringify(legs.map(function (l) { return [l.item, !!l.rest, l.pts.length]; })));
  var herOn = K.world(L, []); herOn.solids = herOn.solids.concat([{ id: 'her', x0: sp[0].x - 3, x1: sp[0].x + 3, y0: sp[0].y - 1.5, y1: sp[0].y + 1.2 }]);
  var legA = T.route(K, herOn, L.home, targets, L).filter(function (l) { return l.item === 'a'; })[0];
  check('with her standing on the sock the planner stops beside her, out of brush reach, so the sock stays', !legA || !T.reached(legA.pts[legA.pts.length - 1], legA.to), JSON.stringify(legA && legA.pts.slice(-1)));
  var near = T.startNear(K, open, L.home, false); check('the broom appears on the floor beside her, not on her', K.inZones(L.zones, near.x, near.y) && !K.blocked(open.solids, near.x, near.y) && Math.abs(near.x - L.home.x) >= 4);
  var MF = w.OvuMindful, a = MF.byId('tidy');
  check('Tidy up your room: an everyday practice with no pose, its own card art, no voice yet, a full minute before a save, two scripts of 120 to 200 s, every line under 30 words, no em dash, no should', !!a && a.pose === null && a.card === 'tidy-broom.webp' && a.audio === false && a.minSecs === 60 && a.variations.length === 2 && a.variations.every(function (v) { return MF.totalSecs(v) >= 120 && MF.totalSecs(v) <= 200 && v.steps.every(function (s) { return s.text.split(/\s+/).length < 30 && s.text.indexOf('—') < 0 && !/\bshould\b/i.test(s.text); }); }), a && JSON.stringify(a.variations.map(function (v) { return MF.totalSecs(v); })));
  check('the card shows the broom for a practice without a pose and her pose for the rest; the journal entry says the guide is text', MF.cardImg(a) === 'tidy-broom.webp' && MF.cardImg(MF.byId('teeth')) === 'avatar-act-teeth.webp' && (function () { S.setState({ explored: {} }); var r = MF.complete('tidy', 0, 90, true, true); return r.event.data.guide === 'Everyday mindfulness, text guide (interim script)' && r.event.data.minutes === 1.5; })());
  ['tidy-sock', 'tidy-cup', 'tidy-books', 'tidy-cushion', 'tidy-broom', 'tidy-puff'].forEach(function (f) { check('sprite ' + f + ' is on disk', fs.existsSync(path.join(root, 'assets/room/dream/' + f + '.webp'))); });
  var rm_ = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), wk = fs.readFileSync(path.join(root, 'ovu-walk.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'room.html'), 'utf8'), gs = fs.readFileSync(path.join(root, 'ovu-gamesave.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'room.css'), 'utf8'), tj = fs.readFileSync(path.join(root, 'ovu-tidy.js'), 'utf8');
  check('room.js says practiceStop the moment a runner stops, at both ends; a practice without a pose keeps her standing picture, in a redress too; the save boundary honours minSecs', (rm_.match(/emit\('practiceStop', (p|practice)\.a\.id\)/g) || []).length === 2 && /if \(a\.pose\) setPose\(a\.pose\); else restorePose\(\);/.test(rm_) && /ms >= \(p\.a\.minSecs \|\| 30\) \* 1000/.test(rm_) && /if \(practice\) \{ if \(practice\.a\.pose\) setPose\(practice\.a\.pose\); else showOutfit\(wearing\(\), true\); \}/.test(rm_));
  check('the walk engine ranks #tidyLayer .tidy with her and the pets and never as a solid; a tap on one is not a floor walk or a pan', /#tidyLayer \.tidy/.test(wk) && /!el\.classList\.contains\('tidy'\)/.test(wk) && /\.poop,\.nb,\.tidy,/.test(wk) && /\.nb,\.plot,\.tidy,button/.test(rm_));
  check('ovu-tidy.js loads after room.js, the walk engine and the farm; tidy is a game key; the layer takes no taps itself and every piece gets the ground shadow', html.indexOf('ovu-tidy.js') > html.indexOf('ovu-farm.js') && html.indexOf('ovu-farm.js') > html.indexOf('ovu-walk.js') && /'game', 'tidy'\]/.test(gs) && /\.tidy::before\{content:''/.test(css) && /#tidyLayer\{position:absolute;inset:0;pointer-events:none\}/.test(css));
  check('the sweep ends on practiceStop, activity, layout, clear and import, sleep and a replaced floor; pauses by the frame clamp while hidden; writes through the farm lock, after a re-read, before any puff', /R\.on\('practiceStop', end\)/.test(tj) && /R\.on\('activity', function \(kind, id\) \{ end\(\);/.test(tj) && /R\.on\('layout', function \(\) \{ end\(\); draw\(\); \}\)/.test(tj) && /reason === 'clear' \|\| reason === 'import'/.test(tj) && /if \(sweep && R\.asleep && R\.asleep\(\)\) \{ end\(\); return; \}/.test(tj) && /FMl\.locked\(S, go\)/.test(tj) && /S\.reload\(\)/.test(tj) && /Math\.min\(0\.1, \(t - last\) \/ 1000\)/.test(tj) && tj.indexOf('puffAt(target.x') > tj.indexOf("(S.commit || S.setState)({ tidy: r.state })"));
})();

process.on('beforeExit', function () { if (summarised) return; summarised = true; Object.keys(openHarness).forEach(function (k) { check('async harness ' + k + ' finished', false, 'its promises never settled'); }); console.log('\n' + passes + ' passed, ' + fails + ' failed'); process.exit(fails ? 1 : 0); });
