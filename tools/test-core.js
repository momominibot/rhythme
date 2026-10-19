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
  ['ovu-store.js', 'ovu-food.js', 'ovu-nova.js', 'ovu-agents.js', 'ovu-orb.js', 'ovu-rewards.js', 'ovu-pets.js', 'ovu-pdf.js', 'ovu-mascot.js', 'assets/vendor/fflate-0.8.2.umd.min.js', 'ovu-health.js', 'ovu-breathtap.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); });
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

(function sunTimes() {
  console.log('the window follows Singapore sunrise and sunset');
  var w = { Intl: Intl, Date: Date, Math: Math, Object: Object, String: String, Promise: Promise }; w.window = w;
  var ctx = vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'ovu-sun.js'), 'utf8'), ctx, { filename: 'ovu-sun.js' });
  var Sun = w.OvuSun, t = Sun.times(new Date(2026, 9, 18, 12), 1.3521, 103.8198);
  check('18 Oct 2026 sunrise about 6:47 am and sunset about 6:52 pm', Math.abs(t.sunrise - 407) <= 4 && Math.abs(t.sunset - 1132) <= 4, Sun.hm(t.sunrise) + ' / ' + Sun.hm(t.sunset));
  var at = function (hh, mm) { return Sun.phase(new Date(2026, 9, 18, hh, mm)); };
  check('3:28 pm is afternoon, not tonight', at(15, 28).key === 'afternoon' && at(15, 28).title === 'This afternoon', at(15, 28).title);
  check('6:30 am is sunrise, 9 am is morning', at(6, 30).key === 'sunrise' && at(9, 0).key === 'morning');
  check('6:30 pm is sunset, 8 pm is tonight', at(18, 30).key === 'sunset' && at(20, 0).key === 'night' && at(20, 0).title === 'Tonight');
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
  check('13-16: "I think I might be pregnant" -> support card', (O.urgent('I think I might be pregnant', { ageBand: '13-16' }) || {}).level === 'safeguard');
  check('older 13-17 profiles are treated the same', (O.urgent('my period is late and the condom broke', { ageBand: '13-17' }) || {}).level === 'safeguard');
  check('adults get no safeguarding card for the same words', O.urgent('I think I might be pregnant', { ageBand: '25-29' }) === null);
  check('pregnancy with bleeding is still an emergency first, at any age', (O.urgent('I am pregnant and bleeding', { ageBand: '13-16' }) || {}).level === 'emergency');
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
  check('care hearts cap at 10 a day per pet', got === 10 && RW.care('dog', 'play').points === 2, got);
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
  var e5 = K.entryFor(L.street, 'shop-pet', 'street'); check('leaving the pet shop puts you on its own doorstep, not the garden arch', e5.x === 98.5 && e5.y === 62.6, JSON.stringify(e5));
  check('arriving puts you at the door you came through', e.x === 29 && e.y === 58 && e2.x === 38 && e3.x === 20 && e4.x === 77, JSON.stringify([e, e2, e3, e4]));
  var e6 = K.entryFor(L.street, 'plaza', 'plaza'); check('arriving from the plaza puts her at the far right end of the wide street, inside the arch', e6.x === 222 && e6.y === 73.6, JSON.stringify(e6));
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
  check('its sprite and head badge are on disk', fs.existsSync(path.join(root, 'assets/room/dream', M.LIST[0].img)) && fs.existsSync(path.join(root, 'assets/room/dream', M.LIST[0].head)));
  check('the moon is the default and an unknown look is ignored', M.current().id === 'moon' && M.set('rabbit').id === 'moon');
  check('the small button uses the head badge, the welcome the full sprite', /orb-moon-head\.webp$/.test(M.src(null, true)) && /orb-moon\.webp$/.test(M.src(null, false)));
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
  check('steps and heart rate are skipped and counted by kind', r.skipped.HKQuantityTypeIdentifierStepCount === 5 && r.skipped.HKQuantityTypeIdentifierHeartRate === 3 && r.skippedTotal === 8 && r.skippedKinds === 2, JSON.stringify(r.skipped));
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
  var p = H.apply(r, S);
  check('three hand-written days are left alone and counted', p.kept === 3 && p.written.added === 2 && p.counts.sleep === 1 && p.counts.weight === 0 && p.counts.period === 1, JSON.stringify({ kept: p.kept, w: p.written, c: p.counts }));
  var mine = S.list('sleep', { from: '2025-06-02', to: '2025-06-02' });
  check('the hand-written night is untouched and no second night was added that day', mine.length === 1 && mine[0].data.notes === 'mine' && S.list('weight', { from: '2025-06-02', to: '2025-06-02' })[0].data.kg === 60 && S.list('period', { from: '2025-06-05', to: '2025-06-05' })[0].data.flow === 'heavy');
  var imp = S.list('sleep', { from: '2025-06-03', to: '2025-06-03' })[0];
  check('an imported night carries source apple-health, the sleep-sheet shape and its asleep minutes', imp && imp.source === 'apple-health' && imp.data.bedTime === '00:40' && imp.data.wakeTime === '07:25' && imp.data.mode === 'import' && S.sleepHours(imp.data) === 6.8, JSON.stringify(imp));
  check('date range covers what was written', p.from === '2025-06-03' && p.to === '2025-06-04', JSON.stringify([p.from, p.to]));
  var again = H.apply(r, S);
  check('importing the same file again refreshes in place: nothing added, nothing duplicated', again.written.added === 0 && again.written.updated === 2 && again.refreshed === 2 && S.list('sleep').length === 2 && S.list('period').length === 2, JSON.stringify(again.written));
  check('importedCount sees only imported entries', H.importedCount(S) === 2);
  var gone = H.removeImported(S);
  check('Remove imported data takes out exactly the imported entries and keeps the hand-written ones', gone === 2 && S.list().length === 3 && S.list().every(function (e) { return e.source !== 'apple-health'; }), JSON.stringify({ gone: gone, left: S.list().map(function (e) { return e.type + ':' + e.source; }) }));
  var future = H.apply({ source: 'apple-health', sleep: [{ date: '2027-01-01', bedTime: '23:00', wakeTime: '07:00', hours: 8, asleepMin: 480 }], weight: [], period: [] }, S);
  check('future-dated records are skipped, not written', future.future === 1 && future.total === 0);
  var w2 = fresh(), S2 = w2.OvuStore, res = S2.addMany([{ type: 'weight', date: '2025-01-01', data: { kg: 50 }, source: 'google-fit' }, { type: 'weight', date: '2025-01-01', data: { kg: 51 }, source: 'google-fit' }, { type: 'nope', date: '2025-01-01', data: {} }, { type: 'sleep', date: 'bad', data: {} }]);
  check('addMany writes once, keeps single-per-day kinds single and skips invalid items', res.added === 1 && res.skipped === 3 && S2.list('weight').length === 1 && S2.list('weight')[0].data.kg === 50, JSON.stringify(res));
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
})().then(function () {
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
});
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
  var r2 = RW.award(S.add('mindfulness', S.today(), T.entryFor(55, 'easy', 0, 0), 'room'));
  check('fifty seconds earns nothing yet, the next fifty-five complete a minute for two hearts', r1.points === 0 && r2.points === 2 && RW.ledger().hearts === before + 2, r1.points + '/' + r2.points);
  check('the leftover forty-five seconds carry on', RW.ledger().breathCarry === 45, RW.ledger().breathCarry);
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
  check('every scene opens fitted to the screen at zoom 1: the homes, the garden, the street, the plaza and the stores', ['room', 'house', 'bathhouse', 'familyhome', 'garden', 'street', 'plaza', 'shop-pet', 'shop-furniture', 'shop-homes'].every(function (id) { return M.zoomFor(w.LAYOUTS[id], sceneOf) === 1; }));
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
  var w = scenes('2026-10-19'), K = w.OvuWalk, M = w.OvuCamera.M, L = w.LAYOUTS.street, W = 390, H = 487.5;
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

(function ledgerAccounting() {
  console.log('hearts accounting: a record earns once, Moon Tap caps per day, gifts never repeat, two pets at home');
  var w = fresh(), RW = w.OvuRewards, S = w.OvuStore, T = w.OvuBreathTap;
  var ev = S.add('sleep', S.today(), { bedtime: '23:00', wake: '07:00', quality: 4 }, 'room');
  var r1 = RW.award(ev), r2 = RW.award(ev);
  check('the same saved record earns only once', r1.points > 0 && r2.points === 0 && r2.again === true, r1.points + '/' + r2.points);
  var h0 = RW.ledger().hearts;
  [600, 600, 600].forEach(function (secs) { RW.award(S.add('mindfulness', S.today(), T.entryFor(secs, 'easy', 0, 0), 'room')); });
  check('three ten-minute Moon Taps in a day earn twenty, not sixty', RW.ledger().hearts - h0 === 20, RW.ledger().hearts - h0);
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

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
