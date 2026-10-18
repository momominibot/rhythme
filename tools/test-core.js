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
  check('buying Sesame puts Mochi away and keeps the puppy and Mewmew out', l.placed.catblack && !l.placed.cat && l.placed.dog && l.placed.mewmew, JSON.stringify(l.placed));
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
  ['ovu-walk.js', 'ovu-garden.js', 'ovu-street.js', 'ovu-community.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), vm.createContext ? w : w, { filename: f }); });
  /* the home layouts live inside room.js, which needs a DOM: lift the LAYOUTS literal out of the source instead */
  var src = fs.readFileSync(path.join(root, 'room.js'), 'utf8'), m = /var LAYOUTS = (\{[\s\S]*?\n  \});\n  var L = LAYOUTS\.room/.exec(src);
  w.LAYOUTS = vm.runInContext('(' + m[1] + ')', w);
  w.OvuWalk.dressHomes(w.LAYOUTS);
  w.LAYOUTS.garden = w.OvuGarden.LAYOUT; w.LAYOUTS.street = w.OvuStreet.LAYOUT; w.LAYOUTS.plaza = w.OvuCommunity.LAYOUT;
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
  var e = K.entryFor(L.garden, 'home'), e2 = K.entryFor(L.street, 'garden'), e3 = K.entryFor(L.plaza, 'street'), e4 = K.entryFor(L.room, 'garden');
  check('arriving puts you at the door you came through', e.x === 29 && e.y === 58 && e2.x === 16 && e3.x === 20 && e4.x === 77, JSON.stringify([e, e2, e3, e4]));
  check('scene of a layout: homes are home, the others are themselves', K.sceneOf(L.room) === 'home' && K.sceneOf(L.familyhome) === 'home' && K.sceneOf(L.garden) === 'garden' && K.sceneOf(L.street) === 'street' && K.sceneOf(L.plaza) === 'plaza');
  check('outdoors only pets come along; the street and plaza show none of your things', L.garden.only.join() === 'pet' && L.plaza.only.length === 0 && L.street.only.length === 0);
  check('the mini-map knows four places', K.SCENES.join() === 'home,garden,street,plaza');
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
  console.log("Luna's look (ovu-mascot.js)");
  var w = fresh(), M = w.OvuMascot, ids = M.LIST.map(function (m) { return m.id; });
  check('nine looks with unique ids', M.LIST.length === 9 && ids.filter(function (id, i) { return ids.indexOf(id) === i; }).length === 9, ids.join(','));
  check('every look has its sprite on disk', M.LIST.every(function (m) { return fs.existsSync(path.join(root, 'assets/room/dream', m.img)) && (!m.head || fs.existsSync(path.join(root, 'assets/room/dream', m.head))); }));
  check('the moon rabbit is the default', M.current().id === 'rabbit', M.current().id);
  check('choosing the kitten sticks in the profile', M.set('kitten').id === 'kitten' && w.OvuStore.profile().mascot === 'kitten' && M.current().id === 'kitten');
  check('an unknown look is ignored', M.set('dragon').id === 'kitten');
  check('the small button uses the head badge, the welcome the full sprite', /orb-kitten-head\.webp$/.test(M.src(null, true)) && /orb-kitten\.webp$/.test(M.src(null, false)));
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
  check('head and neck spots exist for every pet', ['cat', 'catblack', 'catginger', 'dog', 'shiba', 'mewmew'].every(function (id) { return P.wearSpot(id, 'head').w > 0 && P.wearSpot(id, 'neck').w > 0; }));
})();

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
