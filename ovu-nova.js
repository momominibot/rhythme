/* Rhythme processed-food score, built on the NOVA classification (Monteiro et al. 2019).
 * Packaged foods use the NOVA group Open Food Facts publishes. Generic foods, Singapore HPB
 * items and photo estimates have no published group, so explicit name rules below assign one,
 * labelled as Rhythme's estimate ("likely" where the name alone cannot settle it).
 * NOVA studies split home and hawker dishes into their ingredients using recipes; Rhythme has no
 * recipes yet, so freshly made dishes and drinks are left unscored in their own bucket, flagged
 * when they plainly include ultra-processed parts. The headline is the share of calories from
 * NOVA 4 among the foods that could be classified, always shown with that coverage, and withheld
 * when coverage is under half. Reviewed by Codex 18 Oct 2026; to be aligned with Mellow later. */
(function (root) {
  'use strict';
  var GROUPS = {
    1: { key: 1, label: 'Whole food', long: 'Unprocessed or minimally processed', color: '#5f9e78' },
    2: { key: 2, label: 'Kitchen staple', long: 'Processed culinary ingredient (oil, butter, sugar, salt)', color: '#c7a25f' },
    3: { key: 3, label: 'Processed', long: 'Processed food (cheese, canned fish, bakery bread)', color: '#e08c58' },
    4: { key: 4, label: 'Ultra-processed', long: 'Ultra-processed product', color: '#cf5568' },
    cooked: { key: 'cooked', label: 'Freshly made', long: 'Freshly made dish or drink, not scored without a recipe', color: '#9a88c6' },
    unknown: { key: 'unknown', label: 'Not classified', long: 'No processing information', color: '#cdc6d8' }
  };
  var R1 = /\b(kopi|teh) o kosong\b|\bblack coffee\b|\bcoffee,? brewed\b|\bespresso\b|\b(black|green|jasmine|oolong) tea\b|\btea,? brewed\b|\bplain water\b|^ water\b|\bcoconut water\b|\bsugarcane juice\b|\bpopcorn,? air popped\b|\bplain (yogh?urt|greek yogh?urt)\b|\byogh?urt,? plain\b|\bgreek yogh?urt,? plain\b|\btempeh\b|\brolled oats\b|\boatmeal\b|\b(cooked |steamed |plain )?(white|brown) rice\b|\b(soft|hard) boiled\b.*\begg\b|\bboiled eggs?\b/;
  var R4 = /\b(cola|soda|soft drink|fizzy drink|energy drink|isotonic|sports drink|milo|ovaltine|horlicks|3 ?in ?1|instant (noodles?|coffee|oats|porridge)|cup noodles?|maggi|sausages?|hot ?dogs?|frankfurters?|chicken franks?|luncheon meat|spam|nuggets?|fish ?balls?|crab ?sticks?|surimi|ham|bacon|salami|pepperoni|potato chips|crisps|breakfast cereals?|cereal bars?|protein bars?|cookies?|biscuits?|crackers?|wafers?|sponge cake|cakes?|doughnuts?|donuts?|croissants?|pastr(y|ies)|muffins?|ice cream|chocolate|candy|sweets|gumm(y|ies)|marshmallows?|margarine|mayonnaise|mayo|ketchup|creamer|non dairy|flavou?red (milk|yogh?urt)|sweetened (drink|beverage)|syrup drink|grass jelly drink|fast food|french fries|fries|hamburgers?|burgers?|pizza|flour tortilla|pancake mix)\b/;
  /* Packaged popcorn: flavoured or microwave packs are ultra-processed; air-popped kernels are whole food;
   * anything else packaged is most often popped in oil with salt, processed (NOVA 3) but not certain. */
  var POP = /\bpop ?corn\b|\bkettle ?corn\b/, POP_NOT = /\bpop ?corn (chicken|shrimps?|prawns?|bites?)\b|\b(chicken|shrimp|prawn) pop ?corn\b/;
  var POP4 = /\b(caramel|sweet|cheese|cheesy|butter|buttered|flavou?r(ed|ing)?|microwave|kettle ?corn|toffee|chocolate|chilli|truffle)\b/;
  var POP1 = /\bair ?popped\b|\bplain pop ?corn\b|\bpop ?corn kernels?\b|\bpopping corn\b/, POP_SALT = /\bsalt(ed)?\b|\boil\b/;
  /* Usually ultra-processed, but the name alone cannot prove it (ingredient lists vary). */
  var L4 = /\b(white bread|wholemeal bread|whole wheat bread|sandwich (loaf|bread)|sliced bread|toast|otah|fish ?cakes?|fishcake|corn ?flakes|granola|bubble tea|boba|milk tea|(almond|oat|soy|rice) milk,? unsweetened|unsweetened (almond|oat|soy|rice) milk|(almond|oat) milk)\b/;
  var R3 = /\b(cheese|cheddar|mozzarella|parmesan|feta|cottage cheese|canned|tinned|in brine|in oil|smoked|salted fish|ikan bilis|cured|pickled|kimchi|miso|soy sauce|fish sauce|oyster sauce|tofu|tau kwa|beancurd|condensed milk|evaporated milk|coconut milk|santan|peanut butter|hummus|salted egg|century egg|beer|wine|sake|bread|bagel|chapati|tortilla|naan|roti|prata|pancakes?|roasted (peanuts|cashews|almonds)|salted (nuts|peanuts|cashews)|char siew|kaya)\b/;
  var R2 = /\b(olive oil|coconut oil|vegetable oil|canola oil|sesame oil|cooking oil|butter|ghee|lard|sugar|honey|salt|vinegar|corn ?starch|cornflour|tapioca starch|maple syrup|gula melaka|palm sugar)\b/;
  /* Freshly made drinks and desserts that mix several NOVA groups: unscored, like dishes. */
  var FRESH = /\b(kopi|teh|bandung|barley drink|lime juice|calamansi|fresh soy ?milk|hawker soy ?milk|tau hu?ey|tau huay|ice kacang|chendol|cheng tng)\b|\bsoy milk \(no topping\)/;
  var UPF_PARTS = /\b(yong tau foo|fish ?balls?|fish ?cakes?|fishcake|luncheon meat|spam|sausages?|hot ?dogs?|franks?|otah|crab ?sticks?|instant noodles?|maggi|nuggets?|ham|bacon|imitation crab|processed cheese|rose syrup|bandung|ice kacang|creamer)\b/;
  var UPF_PARTS_G = new RegExp(UPF_PARTS.source, 'g');
  var DISH = /\b(rice|noodles?|mee|bee ?hoon|kway teow|hor fun|laksa|curry|rendang|soup|porridge|congee|stew|braised|stir ?fr(y|ied)|fried|satay|prata|thosai|murtabak|briyani|biryani|nasi|lontong|rojak|popiah|pau|dim sum|dumplings?|wanton|xiao long bao|siew mai|har gao|omelette|economic rice|mixed rice|yong tau foo|bak kut teh|kway chap|chilli crab|sambal|penyet|padang|chee cheong fun|lor mai kai|carrot cake|kueh|dessert)\b/;
  var COMPOSITE = / with | and | & | \+ /;
  var WHOLE = /\b(apples?|bananas?|oranges?|mandarins?|papayas?|mangoe?s?|watermelon|melon|grapes|berries|blueberries|strawberries|pears?|kiwis?|durian|guava|dragon ?fruit|pineapple|longans?|lychees?|rambutans?|mangosteens?|dates|avocados?|vegetables?|salad leaves|lettuce|broccoli|spinach|kale|cabbage|bok choy|kai ?lan|chye sim|carrots?|cucumbers?|tomato(es)?|corn|sweet potato(es)?|potato(es)?|pumpkin|mushrooms?|eggs?|chicken breast|chicken thigh|fish fillet|salmon|mackerel|prawns?|shrimps?|nuts|almonds|walnuts|cashews|peanuts|lentils|chickpeas|beans|milk|plain water|water)\b/;
  var USDA_CAT = { fruit: 1, vegetables: 1, protein: 1, grains: 1, dairy: 1, nuts: 1, drinks: 1, fats: 2, condiments: 3, treats: 4, meals: 4 };

  /* ---------- NOVA from an ingredient list ----------
   * Monteiro et al. 2019 (Public Health Nutrition, E1): a product is ultra-processed when its list carries
   * food substances of no culinary use (hydrolysed proteins, protein isolates, casein, whey, maltodextrin,
   * dextrose, fructose, glucose-fructose syrup, invert sugar, lactose, hydrogenated or interesterified oil,
   * modified starch) or cosmetic additives (flavours, flavour enhancers, colours, emulsifiers, emulsifying
   * salts, sweeteners, thickeners, anti-foaming, bulking, carbonating, foaming, gelling and glazing agents).
   * Preservatives, antioxidants and acidity regulators are used in processed foods too, so alone they do
   * not mark group 4. Open Food Facts applies the same markers; its own list wins when the record has one.
   * Ingredient lists are transcribed by people, so the result is always "likely". */
  var SUBST4 = [
    [/\bhydroly[sz]ed (vegetable |plant |soy[a]? |wheat |milk |corn |pea )?proteins?\b|\bprotein hydroly[sz]ate\b/, 'hydrolysed protein'],
    [/\b(soy[a]?|pea|whey|milk|wheat|rice|potato) protein (isolate|concentrate)s?\b|\bprotein isolates?\b|\bisolated (soy[a]?|pea) protein\b/, 'protein isolate'],
    [/\bcaseinates?\b|\bcasein\b/, 'casein'], [/\bwhey\b/, 'whey'],
    [/\bmechanically (separated|recovered|deboned) (meat|chicken|poultry|turkey)\b/, 'mechanically separated meat'],
    [/\bhigh[- ]fructose corn syrup\b|\bglucose[- ]fructose syrup\b|\bfructose[- ]glucose syrup\b|\bhfcs\b|\bcorn syrup\b|\bglucose syrup\b/, 'glucose syrup'],
    [/\b(wheat |vital )?gluten\b/, 'added gluten'],
    [/\bfructose\b/, 'fructose'], [/\b(fruit|apple|grape|pear|pineapple) juice concentrate\b/, 'fruit juice concentrate'],
    [/\binvert(ed)? (sugar|syrup)\b/, 'invert sugar'], [/\bmaltodextrins?\b/, 'maltodextrin'], [/\bdextrose\b/, 'dextrose'], [/\blactose\b/, 'lactose'],
    [/\b(partially |fully )?hydrogenated\b|\binteresterified\b/, 'hydrogenated or interesterified oil'],
    [/\bmodified (corn |maize |tapioca |potato |food |wheat )?starch(es)?\b/, 'modified starch']
  ];
  var COSM4 = [
    [/\bflavou?r(ing|ings|s)?\b|\baromas?\b|\bflavou?r extracts?\b/, 'flavouring'],
    [/\bflavou?r enhancers?\b|\bmonosodium glutamate\b|\bmsg\b|\bdisodium (inosinate|guanylate|5 ribonucleotides)\b/, 'flavour enhancer'],
    [/\bcolou?r(ing|ings|s)?\b|\bcaramel colou?r\b|\bannatto\b|\bcarmine\b|\btartrazine\b|\bsunset yellow\b|\ballura red\b|\bbrilliant blue\b/, 'colour'],
    [/\bemulsifiers?\b|\blecithins?\b|\bmono[- ]?and di[- ]?glycerides\b|\bpolysorbates?\b|\bsucrose esters\b|\bpolyglycerol\b/, 'emulsifier'],
    [/\bemulsifying salts?\b/, 'emulsifying salt'],
    [/\bsweeteners?\b|\baspartame\b|\bsucralose\b|\bacesulfame\b|\bsaccharin\b|\bstevi(a|ol)\b|\bxylitol\b|\bsorbitol\b|\bmaltitol\b|\berythritol\b|\bisomalt\b|\bmonk fruit extract\b/, 'sweetener'],
    [/\bthickeners?\b|\bgelling agents?\b|\bcarrageenan\b|\bxanthan\b|\bguar gum\b|\bgellan\b|\bpectins?\b|\bcarboxymethyl ?cellulose\b|\blocust bean gum\b|\bagar\b/, 'thickener or gelling agent'],
    [/\banti[- ]?caking\b/, 'anti-caking agent'], [/\bglazing agents?\b|\bshellac\b|\bcarnauba\b/, 'glazing agent'],
    [/\bhumectants?\b|\bglycerol\b|\bglycerine?\b|\bpropylene glycol\b/, 'humectant'], [/\bbulking agents?\b|\bpolydextrose\b/, 'bulking agent'],
    [/\banti[- ]?foaming\b|\bdimethylpolysiloxane\b/, 'anti-foaming agent'], [/\bfoaming agents?\b|\bcarbonating agents?\b|\bfirming agents?\b|\bsequestrants?\b/, 'other cosmetic additive']
  ];
  /* E-number classes that mark ultra-processing; preservatives (200s), antioxidants and acidity regulators do not */
  function eClass(code) {
    var m = /^e ?(\d{3,4})/.exec(String(code || '').toLowerCase()); if (!m) return null; var n = Number(m[1]);
    if (n >= 100 && n <= 199) return 'colour';
    if (n === 322) return 'emulsifier';
    if (n >= 400 && n <= 418) return 'thickener or gelling agent';
    if (n === 420 || n === 421) return 'sweetener';
    if (n === 422) return 'humectant';
    if (n >= 423 && n <= 440) return 'thickener or gelling agent';
    if (n === 441) return 'gelling agent (E441)';
    if (n >= 442 && n <= 449) return 'emulsifier';
    if (n >= 450 && n <= 452) return 'emulsifying salt';
    if (n >= 460 && n <= 469) return 'thickener or gelling agent';
    if (n >= 470 && n <= 499) return 'emulsifier';
    if ((n >= 535 && n <= 538) || (n >= 551 && n <= 559)) return 'anti-caking agent';
    if (n >= 620 && n <= 650) return 'flavour enhancer';
    if (n === 900) return 'anti-foaming agent';
    if (n >= 901 && n <= 914) return 'glazing agent';
    if (n >= 950 && n <= 969) return 'sweetener';
    if (n === 1200) return 'bulking agent';
    if (n >= 1400 && n <= 1452) return 'modified starch';
    if (n === 1518 || n === 1520) return 'humectant';
    return null;
  }
  var CULINARY = /\b(salt|sea salt|sugar|cane sugar|raw sugar|brown sugar|oil|butter|ghee|lard|honey|vinegar|syrup|preservative|antioxidant|acidity regulator|starch|cornflour|corn starch)\b|\bsodium (benzoate|nitrite|nitrate|metabisulphite)\b|\bpotassium sorbate\b|\bcitric acid\b|\bascorbic acid\b|\bcalcium propionate\b/;
  var ONLY_CULINARY = /^(?:(?:extra virgin |virgin |cold pressed |refined |pure )?(?:olive|coconut|sunflower|canola|rapeseed|vegetable|sesame|peanut|groundnut|corn|palm|avocado) oil|butter|ghee|lard|sea salt|salt|sugar|cane sugar|raw sugar|brown sugar|honey|vinegar|rice vinegar|apple cider vinegar|maple syrup|cornflour|corn starch|tapioca starch|water|and|\d+ ?%?)(?:\s|$)+$/;
  /* claims that mention a marker to deny it: "non-hydrogenated oil", "lactose-free milk", "no added colours" */
  var NEG_WORD = '(?:colou?r(?:s|ings?)?|flavou?r(?:s|ings?)?|preservatives?|additives?|sweeteners?|msg|gluten|lactose|dairy|sugar)';
  var NEGATED = new RegExp('\\bnon hydrogenated\\b|\\b' + NEG_WORD + ' free\\b|\\b(?:no|without|free (?:of|from))(?: added| artificial| any| all)* ' + NEG_WORD + '(?:(?: or| and)(?: added| artificial)* ' + NEG_WORD + ')*\\b', 'g');
  var WHOLE_INGR = /\b(milk|oats?|rolled oats|rice|brown rice|wholegrain|whole grain|wheat|flour|corn|maize|pop ?corn|peanuts?|almonds?|cashews?|walnuts?|hazelnuts?|pistachios?|seeds?|beans?|lentils?|chickpeas?|soy ?beans?|eggs?|chicken|beef|pork|fish|salmon|tuna|sardines?|prawns?|tofu|tempeh|dates?|raisins?|cranberries|apples?|bananas?|mangoes?|coconut|cocoa|coffee|tea|water|yogh?urt|cream|fruit|vegetables?|tomato(es)?|potato(es)?|sweet potato(es)?|cassava|tapioca)\b/;
  /* text, additive tags (e.g. "e471"), OFF nova_groups_markers -> { group: 1|3|4, markers: [], likely: true } or null */
  function fromIngredients(text, additives, markers) {
    var found = [], seen = {};
    /* one entry per class: "emulsifier (E322)" and a bare "emulsifier" from the same list count once */
    function add(n) { n = String(n || '').trim(); var key = n.replace(/ \(E\d+[A-D]?\)$/i, ''); if (n && !seen[key]) { seen[key] = true; found.push(n); } }
    function tidy(m) { return String(Array.isArray(m) ? m[1] : m).replace(/^en:/, '').replace(/-/g, ' '); }
    if (markers && typeof markers === 'object') {
      var g4 = markers['4'] || markers[4], g3 = markers['3'] || markers[3], g2 = markers['2'] || markers[2];
      if (Array.isArray(g4) && g4.length) { g4.forEach(function (m) { add(tidy(m)); }); return { group: 4, markers: found.slice(0, 6), likely: true }; }
      if (Array.isArray(g3) && g3.length) { g3.forEach(function (m) { add(tidy(m)); }); return { group: 3, markers: found.slice(0, 6), likely: true }; }
      if (Array.isArray(g2) && g2.length) { g2.forEach(function (m) { add(tidy(m)); }); return { group: 2, markers: found.slice(0, 6), likely: true }; }
    }
    var raw = String(text || '');
    if (raw.trim().length < 3) return null;
    /* a list in another script (Chinese, Thai, Arabic...) cannot be judged by English markers: unknown, never "whole food" */
    if (/[\u0600-\u06ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(raw)) return null;
    var t = ' ' + raw.toLowerCase().replace(/[’']/g, "'").replace(/[-–/]/g, ' ').replace(/[()\[\]{},;:.*%]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    t = t.replace(NEGATED, ' ');
    (additives || []).forEach(function (a) { var code = String(a).toLowerCase().replace(/^en:/, '').replace(/\s+/g, ''); var cls = eClass(code); if (cls) add(cls + ' (' + code.toUpperCase() + ')'); });
    (t.match(/\be ?\d{3,4}[a-z]?\b/g) || []).forEach(function (code) { code = code.replace(/\s+/g, ''); var cls = eClass(code); if (cls) add(cls + ' (' + code.toUpperCase() + ')'); });
    SUBST4.forEach(function (r) { if (r[0].test(t)) add(r[1]); });
    COSM4.forEach(function (r) { if (r[0].test(t)) add(r[1]); });
    if (found.length) return { group: 4, markers: found.slice(0, 6), likely: true };
    var body = t.trim();
    if (ONLY_CULINARY.test(body + ' ')) return { group: 2, markers: [], likely: true };
    var culinary = CULINARY.test(t), whole = WHOLE_INGR.test(t);
    if (culinary && whole) return { group: 3, markers: [], likely: true };
    /* nothing recognised at all: say so rather than call it whole food */
    if (!whole) return null;
    return { group: 1, markers: [], likely: true };
  }

  /* lower case, hyphens and slashes as spaces ("3-in-1", "Kopi-O"), padded for word rules */
  function text(x) { return ' ' + String(x || '').toLowerCase().replace(/[’']/g, "'").replace(/[-/]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function out(group, basis, extra) { return Object.assign({ group: group, basis: basis, upfParts: false, likely: false }, extra || {}); }
  /* food or diary item -> { group: 1-4 | 'cooked' | 'unknown', basis, upfParts, likely } */
  function classify(x) {
    if (!x) return out('unknown', 'none');
    if (/^[1-4]$/.test(String(x.nova == null ? '' : x.nova).trim())) return out(Number(x.nova), 'off');
    var ing = x.ingredients;
    if (ing && (ing.text || (ing.additives && ing.additives.length) || ing.markers)) {
      var fi = fromIngredients(ing.text, ing.additives, ing.markers);
      if (fi) return out(fi.group, ing.source === 'label-photo' ? 'label' : 'ingredients', { likely: true, markers: fi.markers });
    }
    var name = x.name || '', hpb = x.hpb || null, kind = x.source && x.source.kind;
    var cat = (hpb && hpb.cat) || x.hpbCat || x.cat || '', desc = (hpb && hpb.desc) || x.desc || '';
    var t = text(name), all = text(name + ' ' + desc);
    var dishy = /dishes|mixed|soup desserts|local ethnic snacks/i.test(cat) || DISH.test(t);
    var dishCtx = dishy && (kind === 'hpb' || kind === 'estimate' || /dishes|mixed/i.test(cat));
    var composite = COMPOSITE.test(t);
    /* An ultra-processed product word that is not just a part inside a dish ("rice crackers", "3-in-1 kopi"). */
    var product = !composite && R4.test(t.replace(UPF_PARTS_G, ' ').replace(/\bcarrot cakes?\b/g, ' '));
    /* a name alone never settles popcorn: flavoured packs are usually ultra-processed, air-popped kernels are whole, the rest is likely popped in oil with salt */
    if (POP.test(t) && !POP_NOT.test(t)) { if (POP4.test(t)) return out(4, 'rule', { likely: true }); if (POP1.test(t) && !POP_SALT.test(t)) return out(1, 'rule'); return out(3, 'rule', { likely: true }); }
    if (/\bdark chocolate\b/.test(t)) return out(3, 'rule', { likely: true });
    if (/\bo kosong\b/.test(t)) return out(1, 'rule');
    if (product) return out(4, 'rule');
    if (FRESH.test(t)) return out('cooked', 'fresh', { upfParts: UPF_PARTS.test(all) });
    if (R1.test(t) && !composite && !R4.test(t) && !L4.test(t)) return out(1, 'rule');
    if (dishCtx) return out('cooked', 'dish', { upfParts: UPF_PARTS.test(all) });
    if (L4.test(t)) return out(4, 'rule', { likely: true });
    if (R4.test(t)) return out(4, 'rule');
    if (R3.test(t)) return out(3, 'rule');
    if (R2.test(t)) return out(2, 'rule');
    if (R1.test(t)) return out(1, 'rule');
    if (USDA_CAT[cat]) return out(USDA_CAT[cat], 'rule');
    if (/^(eggs|rice)$/i.test(cat)) return out(1, 'rule');
    if (!dishy && WHOLE.test(t)) return out(1, 'rule');
    if (dishy) return out('cooked', 'dish', { upfParts: UPF_PARTS.test(all) });
    return out('unknown', 'none');
  }
  function kcalOf(it) { var n = it && it.nutrients; var v = n && n.kcal !== null && n.kcal !== undefined && n.kcal !== '' ? Number(n.kcal) : NaN; return isFinite(v) && v >= 0 ? v : null; }
  /* Calories and item counts by bucket. upfShare is NOVA 4 kcal over NOVA 1 to 4 kcal; coverage is
   * that classified kcal over all logged kcal. Items without calories are counted, never as zero. */
  function share(items) {
    var keys = [1, 2, 3, 4, 'cooked', 'unknown'], by = {}, n = {}, noKcal = {}, partsDishes = 0, likely = 0, fromOff = 0;
    keys.forEach(function (k) { by[k] = 0; n[k] = 0; noKcal[k] = 0; });
    (items || []).forEach(function (it) {
      var c = classify(it), k = kcalOf(it);
      n[c.group]++; if (k === null) noKcal[c.group]++; else by[c.group] += k;
      if (c.upfParts) partsDishes++; if (c.likely) likely++; if (c.basis === 'off') fromOff++;
    });
    var resolved = by[1] + by[2] + by[3] + by[4], total = resolved + by.cooked + by.unknown;
    return { kcal: by, count: n, noKcal: noKcal, total: total, resolved: resolved, coverage: total > 0 ? resolved / total : null, upfShare: resolved > 0 ? by[4] / resolved : null, upfItems: n[4], partsDishes: partsDishes, likely: likely, fromOff: fromOff, items: (items || []).length };
  }
  function entriesItems(entries) { var o = []; (entries || []).forEach(function (e) { if (e && e.data && Array.isArray(e.data.items)) o = o.concat(e.data.items); }); return o; }
  function pct(x) { return x === null || x === undefined ? null : Math.round(x * 100); }
  function pctText(x) { var p = x * 100; return p > 0 && p < 1 ? 'under 1%' : Math.round(p) + '%'; }
  /* The line people read first. words=true never shows a number (gentle view). */
  function headline(s, words) {
    if (!s || !s.items) return 'Log foods to see how processed they are.';
    var classified = s.count[1] + s.count[2] + s.count[3] + s.count[4];
    if (!classified) return s.count.cooked ? 'Freshly made food, not scored without a recipe' : 'Not enough information to score yet';
    if (!s.upfItems) return 'No ultra-processed foods among the items Rhythme could classify';
    if (s.noKcal[4]) return words ? 'Some ultra-processed food' : s.upfItems + ' ultra-processed item' + (s.upfItems === 1 ? '' : 's') + '; ' + (s.noKcal[4] === 1 ? 'one has' : s.noKcal[4] + ' have') + ' no calories logged, so no percentage';
    if (s.upfShare === null || s.coverage === null || s.coverage < 0.5) return words ? 'Some ultra-processed food' : s.upfItems + ' ultra-processed item' + (s.upfItems === 1 ? '' : 's') + '; too little classified for a percentage';
    if (words) return s.upfShare < 0.15 ? 'A little ultra-processed food' : s.upfShare < 0.5 ? 'Some ultra-processed food' : 'Mostly ultra-processed food';
    return 'Ultra-processed: ' + pctText(s.upfShare) + ' of classified calories';
  }
  /* The small print under the headline: what the number covers and what it leaves out. */
  function coverageText(s, words) {
    if (!s || !s.items) return '';
    var bits = [];
    if (!words && s.coverage !== null && s.coverage < 0.995 && s.resolved > 0) bits.push('classified foods are ' + pctText(s.coverage) + ' of logged calories');
    if (s.count.cooked) bits.push('freshly made dishes and drinks are not scored' + (s.partsDishes ? ' (' + s.partsDishes + ' include processed parts such as fishballs or syrups)' : ''));
    if (s.count.unknown) bits.push(s.count.unknown + ' item' + (s.count.unknown === 1 ? '' : 's') + ' not classified');
    var nk = s.noKcal[1] + s.noKcal[2] + s.noKcal[3] + s.noKcal[4]; if (nk) bits.push(nk + ' item' + (nk === 1 ? ' has' : 's have') + ' no calories logged');
    if (s.likely) bits.push('“likely” means the name or ingredient list alone cannot settle it');
    var t = bits.join('; '); return t ? t.charAt(0).toUpperCase() + t.slice(1) + '.' : '';
  }
  /* Short form for one saved meal. */
  function short(s, words) {
    if (!s || !s.items) return '';
    var classified = s.count[1] + s.count[2] + s.count[3] + s.count[4];
    if (!classified) return s.count.cooked ? 'Freshly made, not scored' : '';
    if (!s.upfItems) return 'No ultra-processed foods';
    if (words || s.noKcal[4] || s.coverage === null || s.coverage < 0.5) return s.upfItems + ' ultra-processed item' + (s.upfItems === 1 ? '' : 's');
    return 'Ultra-processed ' + pctText(s.upfShare) + ' of classified calories';
  }
  function basisText(c) {
    var mk = c.group === 4 ? (c.markers && c.markers.length ? '; ultra-processing markers: ' + c.markers.join(', ') : '') : c.group === 3 ? (c.markers && c.markers.length ? '; signs of processing: ' + c.markers.join(', ') : '; oil, salt, sugar or a preservative beside a whole food') : '; no processing markers in the list';
    var b = c.basis === 'off' ? 'NOVA group from Open Food Facts' : c.basis === 'ingredients' ? 'Rhythme estimate from the ingredient list on Open Food Facts' + mk + ', so likely, not certain' : c.basis === 'label' ? 'Rhythme estimate from the ingredients you photographed' + mk + ', so likely, not certain' : c.basis === 'rule' ? (c.likely ? 'Rhythme estimate from the food type; ingredients vary, so this is likely, not certain' : 'Rhythme estimate from the food type') : c.basis === 'dish' ? 'Freshly made dish: NOVA studies split dishes into ingredients with recipes, so it is not scored here' : c.basis === 'fresh' ? 'Freshly made drink or dessert mixing several groups, so it is not scored here' : 'Not enough information to classify';
    return b + (c.upfParts ? '; includes processed parts such as fishballs, luncheon meat or syrups' : '');
  }
  root.OvuNova = { GROUPS: GROUPS, classify: classify, fromIngredients: fromIngredients, share: share, entriesItems: entriesItems, headline: headline, coverageText: coverageText, short: short, basisText: basisText, pct: pct };
})(window);
