/* Ovumind processed-food score, built on the NOVA classification (Monteiro et al. 2019).
 * Packaged foods use the NOVA group Open Food Facts publishes. Generic foods, Singapore HPB
 * items and photo estimates have no published group, so explicit name rules below assign one,
 * labelled as Ovumind's estimate ("likely" where the name alone cannot settle it).
 * NOVA studies split home and hawker dishes into their ingredients using recipes; Ovumind has no
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

  /* lower case, hyphens and slashes as spaces ("3-in-1", "Kopi-O"), padded for word rules */
  function text(x) { return ' ' + String(x || '').toLowerCase().replace(/[’']/g, "'").replace(/[-/]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function out(group, basis, extra) { return Object.assign({ group: group, basis: basis, upfParts: false, likely: false }, extra || {}); }
  /* food or diary item -> { group: 1-4 | 'cooked' | 'unknown', basis, upfParts, likely } */
  function classify(x) {
    if (!x) return out('unknown', 'none');
    if (/^[1-4]$/.test(String(x.nova == null ? '' : x.nova).trim())) return out(Number(x.nova), 'off');
    var name = x.name || '', hpb = x.hpb || null, kind = x.source && x.source.kind;
    var cat = (hpb && hpb.cat) || x.hpbCat || x.cat || '', desc = (hpb && hpb.desc) || x.desc || '';
    var t = text(name), all = text(name + ' ' + desc);
    var dishy = /dishes|mixed|soup desserts|local ethnic snacks/i.test(cat) || DISH.test(t);
    var dishCtx = dishy && (kind === 'hpb' || kind === 'estimate' || /dishes|mixed/i.test(cat));
    var composite = COMPOSITE.test(t);
    /* An ultra-processed product word that is not just a part inside a dish ("rice crackers", "3-in-1 kopi"). */
    var product = !composite && R4.test(t.replace(UPF_PARTS_G, ' ').replace(/\bcarrot cakes?\b/g, ' '));
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
    if (!s.upfItems) return 'No ultra-processed foods among the items Ovumind could classify';
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
    if (s.likely) bits.push('“likely” means the name alone cannot settle it');
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
    var b = c.basis === 'off' ? 'NOVA group from Open Food Facts' : c.basis === 'rule' ? (c.likely ? 'Ovumind estimate from the food type; ingredients vary, so this is likely, not certain' : 'Ovumind estimate from the food type') : c.basis === 'dish' ? 'Freshly made dish: NOVA studies split dishes into ingredients with recipes, so it is not scored here' : c.basis === 'fresh' ? 'Freshly made drink or dessert mixing several groups, so it is not scored here' : 'Not enough information to classify';
    return b + (c.upfParts ? '; includes processed parts such as fishballs, luncheon meat or syrups' : '');
  }
  root.OvuNova = { GROUPS: GROUPS, classify: classify, share: share, entriesItems: entriesItems, headline: headline, coverageText: coverageText, short: short, basisText: basisText, pct: pct };
})(window);
