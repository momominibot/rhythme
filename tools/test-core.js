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
  ['ovu-store.js', 'ovu-exercise.js', 'ovu-food.js', 'ovu-nova.js', 'ovu-agents.js', 'ovu-orb.js', 'ovu-rewards.js', 'ovu-pets.js', 'ovu-pdf.js', 'ovu-mascot.js', 'assets/vendor/fflate-0.8.2.umd.min.js', 'ovu-health.js', 'ovu-breathtap.js', 'ovu-moments.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); });
  ['ovu-store.js', 'ovu-food.js', 'ovu-nova.js', 'ovu-agents.js', 'ovu-orb.js', 'ovu-rewards.js', 'ovu-pets.js', 'ovu-pdf.js', 'ovu-mascot.js', 'assets/vendor/fflate-0.8.2.umd.min.js', 'ovu-health.js', 'ovu-sync.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); });
  if (todayIso) { var S = w.OvuStore; if (typeof S.today === 'function') { S._today = S.today; S.today = function () { return todayIso; }; } }
  return w;
}
var fails = 0, passes = 0;
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
  check('prompt (not emergency) card for bleeding after menopause', (O.urgent('some bleeding again today', { lifeStage: 'post' }) || {}).level === 'prompt');
  check('no card for an ordinary medium period', O.urgent('period started today, medium, cramps 4/10', {}) === null);
  check('no card for "no bleeding today"', O.urgent('no bleeding today, slept well', { lifeStage: 'post' }) === null);
  var chips = { 'Slept 11pm to 7am, quality 4': 'sleep', 'Period started today, medium': 'period', 'Cramps and bloating, pain 5, mood ok': 'symptom', 'Had oats and a latte for breakfast': 'food', 'Meditated 10 min': 'mindfulness' };
  Object.keys(chips).forEach(function (q) { var types = O.parseLocal(q).map(function (e) { return e.type; }); check('chip parses: ' + q, types.indexOf(chips[q]) > -1, 'types=' + JSON.stringify(types)); });
  check('"skipped lunch" is still not a meal', O.parseLocal('skipped lunch, cramps 3/10').every(function (e) { return e.type !== 'food'; }));
  check('"had chicken rice for lunch" is a meal', O.parseLocal('had chicken rice for lunch').some(function (e) { return e.type === 'food' && e.data.meal === 'lunch'; }));
  check('spotting alone is a symptom, not a period day', (function () { var es = O.parseLocal('a bit of spotting today'); return es.some(function (e) { return e.type === 'symptom' && e.data.symptoms.indexOf('spotting') > -1; }) && !es.some(function (e) { return e.type === 'period'; }); })());
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
  var COPY = 'If you have thoughts of harming yourself or your baby, you need help now. Call 995 or go to A&E, and ask someone you trust to stay with you. SOS is available 24 hours on 1767, or WhatsApp 9151 1767.';
  var COPY_SELF = 'If you have thoughts of harming yourself, you need help now. Call 995 or go to A&E, and ask someone you trust to stay with you. SOS is available 24 hours on 1767, or WhatsApp 9151 1767.';
  /* the baby is named only when the note or the profile has one (four-persona review, 20 Oct) */
  [['I want to hurt myself', COPY_SELF], ['I feel like killing myself', COPY_SELF], ['thoughts of hurting my baby', COPY], ['I’m scared I might hurt my baby', COPY], ['I don’t want to be alive anymore', COPY_SELF], ['having suicidal thoughts again', COPY_SELF]].forEach(function (c) {
    var u = O.urgent(c[0], {});
    check('self-harm card for "' + c[0] + '"', u && u.level === 'emergency' && u.code === 'SELF_HARM_NOW' && u.message === c[1], JSON.stringify(u));
  });
  check('after a birth the card names the baby even when the note does not', (O.urgent('I want to hurt myself', { pregState: 'postpartum' }) || {}).message === COPY);
  var both = O.urgent('soaking through a pad every hour and I want to hurt myself', {});
  check('the self-harm card comes first, even with heavy bleeding', both && both.code === 'SELF_HARM_NOW', JSON.stringify(both));
  var u = O.urgent('I want to hurt myself', { lifeStage: 'post' });
  check('the card carries call links for 995, SOS 1767 and WhatsApp 9151 1767', u && JSON.stringify(u.actions) === JSON.stringify([{ label: 'Call 995', href: 'tel:995' }, { label: 'Call SOS 1767', href: 'tel:1767' }, { label: 'WhatsApp SOS', href: 'https://wa.me/6591511767' }]), JSON.stringify(u && u.actions));
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
  check('every new card brings its own words and a 995 link where it is an emergency', ['chest pain', 'my face is drooping on one side', 'lips swollen', 'hearing voices', 'period is late and pain on my left side'].every(function (t) { var u = O.urgent(t, {}); return u && u.message && (u.level !== 'emergency' || (u.actions || []).some(function (a) { return a.href === 'tel:995'; })); }));
  var w2 = fresh(), O2 = w2.OvuOrb;
  check('Luna reads worry about a period as a feeling, never a period day', ['worried my period is coming', 'dreading my period', 'when will my period come', 'my period is coming soon I think'].every(function (t) { return !O2.parseLocal(t).some(function (e) { return e.type === 'period'; }); }) && O2.parseLocal('anxious about my period this month').some(function (e) { return e.type === 'symptom' && e.data.symptoms.indexOf('anxiety') > -1; }) && O2.parseLocal('worried, period started heavy today').some(function (e) { return e.type === 'period' && e.data.flow === 'heavy'; }));
})();

(function handSavedRedFlags() {
  console.log('2c. a red flag saved by hand opens its card at once (four-persona review, 20 Oct)');
  var w = fresh(), S = w.OvuStore, O = w.OvuOrb, today = S.today();
  var p1 = S.add('period', today, { flow: 'heavy', clots: false, impact: false, flooding: true });
  check('heavy flooding alone opens no emergency card', O.entryUrgent(p1, {}) === null);
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
  check('the local name decides when the description would read as another dish (chwee kueh, not plain rice)', ck[0].hpb && ck[0].hpb.crId === 'F11090005' && ck[0].hpb.via === 'local name', kinds(ck) + ' name-only: ' + JSON.stringify((FD.sgMatch('steamed rice cakes with preserved radish') || { food: {} }).food.name));
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
  check('the scale costs 5 hearts', RW.ledger().hearts === 15 && RW.ledger().owned.indexOf('scale') > -1);
  var ev = S.add('weight', today, { kg: 54.3 }, 'scale'); var aw = RW.award(ev);
  S.add('weight', today, { kg: 54.1 }, 'scale');
  check('a weigh-in earns no hearts and no streak bonus', aw.points === 0 && RW.ledger().hearts === 15);
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
  ['ovu-consent.js', 'ovu-auth.js', 'ovu-insight.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  var I = w.OvuInsight, es = S.list(null, { from: '2026-09-22', to: '2026-10-19' });
  var oldSig = es.length + ':' + es.map(function (e) { return (e.updatedAt || e.createdAt || '').slice(0, 19); }).sort().slice(-1)[0];
  S.setState({ insights: { daily: { '2026-10-19': { date: '2026-10-19', sig: oldSig, summary: 'Day 2.' } }, fourweeks: { '2026-10-19': { end: '2026-10-19', sig: oldSig, clinician: { cycle: 'A 501-day cycle.' } } } } });
  check('a four-week reading from the old rules is withheld from the journal, shares and PDFs, and asks to be written again', I.cachedFourWeeks('2026-10-19') === null && I.stale('fourweeks', '2026-10-19') === true && A.fourWeekSummary('2026-10-19').cycle.cycleLengths.length === 0);
  check('a daily reading from the old rules stays readable and asks to be updated', I.cachedDaily('2026-10-19').summary === 'Day 2.' && I.stale('daily', '2026-10-19') === true);
  var st = S.state().insights; st.fourweeks['2026-10-19'].sig = 'r2|' + oldSig; st.fourweeks['2026-10-19'].rules = 'r2'; S.setState({ insights: st });
  check('a four-week reading written under the current rules is shown and is not stale', I.cachedFourWeeks('2026-10-19').clinician.cycle === 'A 501-day cycle.' && I.stale('fourweeks', '2026-10-19') === false);
  var pageSrc = ['journal.html', 'doctor.html', 'ovu-agents.js', 'room.js'].map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }).join('\n');
  check('pages reach four-week readings only through cachedFourWeeks, which applies the rules check', !/insights\.fourweeks|\.fourweeks\[/.test(pageSrc) && /I\.cachedFourWeeks\(end\)\|\|null/.test(pageSrc));
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
    var st1 = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
    check('the first sync succeeds: the sleep row uploads and the exercise row is held', r1.ok === true && r1.held === 1 && posts.length === 1 && posts[0].join() === 'sleep:' + sl.id && st1.held && st1.held[ex.id], JSON.stringify({ r1: r1, posts: posts, held: st1.held }));
    /* a later edit to another row moves the push watermark past the held row's time */
    return new Promise(function (res) { setTimeout(res, 15); }).then(function () { S.update(sl.id, { data: Object.assign({}, sl.data, { quality: 4 }) }); return Y.syncNow(); });
  }).then(function (r2) {
    check('while refused, later syncs still upload other rows and keep holding', r2.ok === true && r2.held === 1 && posts[posts.length - 1].join() === 'sleep:' + sl.id, JSON.stringify({ r2: r2, posts: posts }));
    migrated = true;
    return Y.syncNow();
  }).then(function (r3) {
    var st3 = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
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
    var st = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
    check('a held row edited during its upload stays held, even when an older deletion of it arrives in the same sync', tombGiven && !!(st.held && st.held[ex.id]), JSON.stringify({ held: st.held, sent: sent, tomb: tombGiven }));
    check('and the sync reports it as still waiting, so the app cannot say "Backed up."', r2 && r2.ok === true && r2.held === 1, JSON.stringify(r2));
    return Y.syncNow();
  }).then(function () {
    var st = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
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
    if (m === 'GET' && /\/entries/.test(url)) { gets.push(url); if (/synced_at=gt/.test(url)) return v.reply(200, []); return v.reply(200, /type=in\.\(exercise\)/.test(url) ? [cloudRow] : [cloudRow, clearedRow]); }
    if (m === 'GET') return v.reply(200, []);
    return v.reply(201, null);
  };
  var t2 = YV.syncNow().then(function (r) {
    var st = JSON.parse(v.localStorage.getItem('ovumind_sync_v1'));
    check('after learning the exercise type, a one-time pull of that type alone brings back the row the old version skipped', gets.length === 2 && /synced_at=gt/.test(gets[0]) && /type=in\.\(exercise\)/.test(gets[1]) && !/synced_at=gt/.test(gets[1]) && SV.list('exercise').length === 1 && st.types === SV.TYPES.join(','), JSON.stringify({ r: r, gets: gets, n: SV.list('exercise').length, types: st.types }));
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
    var st = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
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
    var st = JSON.parse(v.localStorage.getItem('ovumind_sync_v1'));
    check('20,001 rows sharing one timestamp: the first sync takes 20,000 by id and is not marked recovered', SV.list('exercise').length === 20001 && !st.types && st.typedAfter === 'h19999', JSON.stringify({ n: SV.list('exercise').length, types: st.types, after: st.typedAfter }));
    return YV.syncNow();
  }).then(function () {
    var st = JSON.parse(v.localStorage.getItem('ovumind_sync_v1')), typedGets = gets.filter(function (u) { return /type=in/.test(u); });
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
    var st = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
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
  /* 4. (Codex round one) another tab moves the cursor further while this sync uploads, then the person clears that
     newer row from the phone. This sync must not wind the cursor back, or the next sync brings the cleared row back. */
  var R1 = '2026-10-19T11:00:00.000001+00:00', R2 = '2026-10-19T12:00:00.000002+00:00';
  var srv4 = syncServer(), posted4 = false;
  srv4.rows.push(syncRow('r1', 'reflection', R1, { text: 'eleven', mood: '' }));
  var x = syncWorld(srv4, null, null), SX = x.OvuStore, YX = x.OvuSync, xPost = x.fetch;
  SX.add('reflection', SX.today(), { text: 'written here', mood: '' });
  x.fetch = function (url, opt) {
    if (opt && opt.method === 'POST' && /\/entries/.test(url) && !posted4) {
      posted4 = true;
      /* the other tab: r2 arrives, it pulls through r2 and saves that cursor; r2 is then cleared from this phone */
      srv4.rows.push(syncRow('r2', 'reflection', R2, { text: 'twelve, cleared later', mood: '' }));
      var st = JSON.parse(x.localStorage.getItem('ovumind_sync_v1')); st.pulledSeq = R2; st.pulledId = 'r2'; x.localStorage.setItem('ovumind_sync_v1', JSON.stringify(st));
    }
    return xPost(url, opt);
  };
  var d = YX.syncNow().then(function () {
    var st = JSON.parse(x.localStorage.getItem('ovumind_sync_v1'));
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
    var st = JSON.parse(y.localStorage.getItem('ovumind_sync_v1'));
    check('a reset during the upload stays a reset: no account, no cursor, no push watermark written back', posted5 && st.userId === null && st.pulledSeq === null && !st.pulledId && st.pushedAt === null && r && r.ok === false, JSON.stringify({ r: r, userId: st.userId, seq: st.pulledSeq, pushedAt: st.pushedAt }));
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
    g0 = JSON.parse(w.localStorage.getItem('ovumind_sync_v1')).gen;
    Y.resetPosition(); /* sign-out */
    uid = 'uB'; S.setProfile({ cloud: { v: 1, at: '2026-10-20T00:05:00Z', uid: 'uB' } }); /* B signs in and turns on backup */
    releasePost(); /* A's upload completes now */
    return first;
  }).then(function (r1) {
    var st = JSON.parse(w.localStorage.getItem('ovumind_sync_v1'));
    check('the overtaken sync ends cancelled and writes nothing into the reset state', r1 && r1.ok === false && r1.reason === 'cancelled' && st.userId === null && st.profilePulledAt === null && st.gen === g0 + 1, JSON.stringify({ r1: r1, st: { userId: st.userId, pulled: st.profilePulledAt, gen: st.gen, g0: g0 } }));
    return Y.syncNow();
  }).then(function (r2) {
    var st = JSON.parse(w.localStorage.getItem('ovumind_sync_v1')), toB = posts.filter(function (p) { return p.user === 'uB'; });
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
  check('a reset moves the generation on and clears the account', JSON.parse(z.localStorage.getItem('ovumind_sync_v1')).gen === 5 && JSON.parse(z.localStorage.getItem('ovumind_sync_v1')).userId === null);
  Promise.all([done, locked]).catch(function (err) { check('the sync generation tests ran to the end', false, String(err && err.stack || err)); });
})();

/* ---------- garden, Dream Street, plaza and walking (ovu-walk.js, ovu-garden.js, ovu-street.js, ovu-community.js) ---------- */
function scenes(todayIso) {
  var w = fresh(todayIso);
  ['ovu-walk.js', 'ovu-garden.js', 'ovu-street.js', 'ovu-community.js', 'ovu-shops.js', 'ovu-camera.js', 'ovu-petwalk.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), vm.createContext ? w : w, { filename: f }); });
  /* the home layouts live inside room.js, which needs a DOM: lift the LAYOUTS literal out of the source instead */
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), m = /var LAYOUTS = (\{[\s\S]*?\n  \});\n  var L = LAYOUTS\.room/.exec(src);
  w.LAYOUTS = vm.runInContext('(' + m[1] + ')', w);
  w.OvuWalk.dressHomes(w.LAYOUTS);
  w.LAYOUTS.garden = w.OvuGarden.LAYOUT; w.LAYOUTS.street = w.OvuStreet.LAYOUT; w.LAYOUTS.plaza = w.OvuCommunity.LAYOUT;
  Object.keys(w.OvuShops.LAYOUTS).forEach(function (id) { w.LAYOUTS[id] = w.OvuShops.LAYOUTS[id]; });
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
  var sold = SH.placements('shop-pet', RW.SHOP, { owned: ['cat', 'acc-bow', 'treat-fish'] }, w.LAYOUTS.room.props);
  check('bought pets and accessories leave the shelf; treats restock; shelf widths follow the room props', !sold.some(function (p) { return p.item.id === 'cat' || p.item.id === 'acc-bow'; }) && sold.some(function (p) { return p.item.id === 'treat-fish'; }) && sold.filter(function (p) { return p.item.id === 'dog'; })[0].w === w.LAYOUTS.room.props.dog.w * 1.02, JSON.stringify(sold.map(function (p) { return p.item.id + ':' + p.w; })));
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
(function lunaLook() {
  console.log("Luna's look (ovu-mascot.js): one pastel crescent moon");
  var w = fresh(), M = w.OvuMascot;
  check('one look only, the moon', M.LIST.length === 1 && M.LIST[0].id === 'moon');
  check('its crescent sprite is on disk and no round badge is used', fs.existsSync(path.join(root, 'assets/room/dream', M.LIST[0].img)) && !M.LIST[0].head);
  check('the moon is the default and an unknown look is ignored', M.current().id === 'moon' && M.set('rabbit').id === 'moon');
  check('the small Luna button shows the crescent on its own, like the welcome (no round badge)', /orb-moon\.webp$/.test(M.src(null, true)) && /orb-moon\.webp$/.test(M.src(null, false)));
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
  check('going to sleep refills (state.sleeping turning on)', ST.value() === 100);
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
  ['ovu-consent.js', 'ovu-auth.js', 'ovu-insight.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w, { filename: f }); });
  w.crypto = { getRandomValues: w.crypto.getRandomValues.bind(w.crypto), subtle: { digest: function (alg, data) { var h = require('crypto').createHash('sha256').update(Buffer.from(data)).digest(); return Promise.resolve(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength)); } } };
  var C = w.OvuConsent, S = w.OvuStore, O = w.OvuOrb, SY = w.OvuSync, A = w.OvuAuth;
  var src = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };
  var roomJs = src('room.js'), roomHtml = src('room.html'), storeJs = src('ovu-store.js'), appnav = src('appnav.js'), orbJs = src('ovu-orb.js'), terms = src('terms.html'), priv = src('privacy.html'), luna = src('supabase/functions/luna/index.ts'), insight = src('supabase/functions/insight/index.ts'), mig = src('supabase/migrations/20261019050000_consent_events.sql');
  check('one notice version, 3, in the store, the module and both page gates, which also require the 18+ attestation', S.NOTICE_V === 3 && C.NOTICE_V === 3 && /c\.v >= window\.OvuStore\.NOTICE_V && a && a\.confirmed === true/.test(storeJs) && /c\.v >= 3 && a && a\.confirmed === true/.test(appnav));
  check('the teen logic is gone from the room, the orb and the terms, and the room goes through the consent module', !/isMinor|under13|13-16|minorAck: A\.|openMinorNote|openTeenPregnancyCard|BABES|age13|CONSENT_V/.test(roomJs) && !/under13|13-16/.test(orbJs) && /OvuConsent\.require\(next/.test(roomJs) && /at least <strong>18 years old<\/strong>/.test(terms) && !/16 years old/.test(terms));
  check('the onboarding asks an optional adult age range, never a band with minors', /id: 'agerange'[^\n]*optional: true[^\n]*\['18-24'/.test(roomJs) && !/\['under13'/.test(roomJs) && /ageRange: A\.ageRange \|\| '', ageBand: '', minorAck: ''/.test(roomJs));
  check('the sheet carries the switches container, the 18+ tick, the under-18 way out and notice version 3', /id="cChoices"/.test(roomHtml) && /id="cAge"[^\n]*I confirm I am 18 or older/.test(roomHtml) && /id="cUnder"/.test(roomHtml) && /Notice version 3, 19 October 2026/.test(roomHtml) && !/13 or older/.test(roomHtml));
  check('the pages say Singapore for the backup and name the separate choices', !/outside Singapore/.test(priv) && !/outside Singapore/.test(roomHtml) && !/outside Singapore/.test(src('ovu-auth.js')) && /notice v3/.test(priv) && /version 3 \(19 October 2026\)/.test(priv) && /Help improve logging/.test(priv) && /For adults/.test(priv));
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
  check('after the sheet nothing is due: 18+ attested once, health tracking at notice 3, photos withdrawn, the rest as ticked', !C.needsSheet() && C.ageOk() && S.profile().ageAttest.version === 1 && S.profile().consent.v === 3 && C.allows('ai_reading') && !C.allows('food_photo_ai') && C.allows('cloud_sync') && O.aiConfig().photos === false && O.aiConfig().on === true, JSON.stringify(S.profile().consent));
  var r = C.receipt();
  check('the receipt names the notice, the purposes, the attestation and the count', r.noticeVersion === 3 && r.purposes.ai_reading === true && r.purposes.food_photo_ai === false && r.purposes.health_tracking === true && r.ageAttest && r.ageAttest.confirmed === true && r.events >= 9 && r.userId === null, JSON.stringify(r));
  check('the phone\'s word travels only for an allowed purpose', C.header('ai_reading')['X-Rhythme-Consent'].indexOf('ai_reading;notice=3;device=d') === 0 && !C.header('food_photo_ai')['X-Rhythme-Consent']);
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
    check('after sign-in the pre-account choices are bound to this account and every bound event reached the server once', done && st.health_tracking.uid === U && st.ai_summaries.uid === U && st.cloud_sync.uid === U && evs.filter(function (e) { return e.uid === U; }).every(function (e) { return e.sent === true; }) && sent.length === evs.filter(function (e) { return e.uid === U; }).length && sent.every(function (b) { return b.p_notice === 3 && typeof b.p_hash === 'string' && b.p_hash.length === 64 && b.p_method && b.p_client_at; }), JSON.stringify({ sent: sent.length, bound: evs.filter(function (e) { return e.uid === U; }).length }));
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

/* the summary waits for every timer and promise the blocks scheduled: the loop drains, then we report, so no async check is ever cut off */
var summarised = false;
process.on('beforeExit', function () { if (summarised) return; summarised = true; console.log('\n' + passes + ' passed, ' + fails + ' failed'); process.exit(fails ? 1 : 0); });
