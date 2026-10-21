/* Rhythme recipes and the Mediterranean check (pure data and scoring; room.js draws the sheets).
 *
 * Recipes are links to pages that women's health and bone health organisations publish, never copies: each card keeps
 * the source's own title, names the source, and adds one line of ours on what is in the dish. No recipe treats a
 * condition, and the group notes say so. Every link, title and ingredient line was checked against its page on
 * 20 Oct 2026 (docs/design/2026-10-20-recipes.md). Sources for the notes are in ovu-evidence.js, topic 'recipes'.
 *
 * The Mediterranean check is the 14-item MEDAS screener from the PREDIMED study (Schröder 2011; items as printed in
 * Martínez-González 2012, Table 1) without its wine item, which gives a point for 7 or more glasses a week. */
(function (root) {
  'use strict';
  var JH = 'Jean Hailes', BHOF = 'Bone Health & Osteoporosis Foundation';
  var jh = function (slug) { return 'https://www.jeanhailes.org.au/recipes/' + slug + '/'; };
  var bhof = function (file) { return 'https://www.bonehealthandosteoporosis.org/wp-content/uploads/' + file; };

  var GROUPS = [
    { id: 'pcos', name: 'PCOS (PMOS)', icon: 'restaurant_menu',
      note: 'PCOS was renamed PMOS (polyendocrine metabolic ovarian syndrome) in 2026 after a global consensus, so you will see both names for a while. No one diet has been shown to be best for it: the international guideline asks for everyday healthy eating, built on vegetables, wholegrains, beans and enough protein. Food is one part of care: irregular periods, acne, extra hair or trouble getting pregnant are worth a doctor\'s visit, where checks of blood sugar and heart health belong too. These recipes are the ones on the PCOS page of Jean Hailes, an Australian women\'s health charity whose clinicians review it.' },
    { id: 'meno', name: 'Menopause', icon: 'spa',
      note: 'The Menopause Society\'s 2023 review found insufficient evidence to recommend diet changes or soy for treating hot flushes. There are treatments that work, so talk to your doctor if they trouble you. What food can do around and after menopause is help look after bones and heart: calcium-rich foods, protein, oily fish, beans and olive oil.' },
    { id: 'every', name: 'Everyday', icon: 'soup_kitchen',
      note: 'Mediterranean-style eating: vegetables, beans, fish, nuts and olive oil. Evidence on diet and conceiving is limited and mostly observational, and no food has been proven to protect the ovaries or egg supply, so think of this as good everyday eating rather than a treatment. If you are trying to get pregnant, the NHS advises 400 micrograms of folic acid every day, carried on for the first 12 weeks of pregnancy; some people need a higher dose, which a doctor can prescribe, so ask a pharmacist or doctor which is right for you.' }
  ];

  /* id, the source's own title, source, link, groups, icon, and our one line on what is in it */
  var RECIPES = [
    { id: 'cauli-soup', title: 'Cauliflower & cannellini bean soup', src: JH, url: jh('cauliflower-cannellini-bean-soup'), groups: ['pcos'], icon: 'soup_kitchen', why: 'Vegetables and beans in one pot: fibre and protein for a filling lunch.' },
    { id: 'chicken-greens', title: 'One pot chicken & greens', src: JH, url: jh('one-pot-chicken-greens'), groups: ['pcos'], icon: 'skillet', why: 'Chicken with leek, cabbage, zucchini, mushrooms and greens, so most of the bowl is vegetables.' },
    { id: 'sardines', title: 'Sardines with tomato & green beans', src: JH, url: jh('sardines-with-tomato-and-green-beans'), groups: ['pcos', 'meno'], icon: 'set_meal', why: 'Canned sardines bring omega-3 fats; eating the soft bones adds calcium.' },
    { id: 'red-rice', title: 'Red rice, roast vegetable & aduki bean salad', src: JH, url: jh('red-rice-roast-vegetable-and-aduki-bean-salad'), groups: ['pcos'], icon: 'rice_bowl', why: 'Wholegrain red rice and beans add fibre. The dressing\'s mirin usually contains alcohol: leave it out if pregnant or trying to be.' },
    { id: 'bircher', title: 'Bircher muesli', src: JH, url: jh('bircher-muesli'), groups: ['pcos'], icon: 'breakfast_dining', why: 'Oats, apple, nuts and seeds soaked overnight in yoghurt: breakfast is ready when you wake.' },
    { id: 'frittata', title: 'Vegetable frittata', src: JH, url: jh('vegetable-frittata'), groups: ['pcos'], icon: 'egg', why: 'Eggs and feta over a tray of vegetables; the slices keep for lunches.' },
    { id: 'tofu', title: 'Tofu and sesame stir-fry', src: JH, url: jh('tofu-sesame-stir-fry'), groups: ['meno'], icon: 'ramen_dining', why: 'Firm tofu with broccoli and capsicum: plant protein, and calcium when the tofu\'s ingredients list calcium sulphate.' },
    { id: 'soy-bread', title: 'Savoury phytoestrogen bread', src: JH, url: jh('savoury-phytoestrogen-bread'), groups: ['meno'], icon: 'bakery_dining', why: 'Soy flour, soy milk, tofu and linseed: whole soy foods and fibre. Despite its name, not a hormone treatment or a treatment for hot flushes.' },
    { id: 'cannelloni', title: 'Spinach and Ricotta Cannelloni', src: BHOF, url: bhof('2015/12/Spinach-and-Ricotta-Cannelloni-recipe.pdf'), groups: ['meno'], icon: 'dinner_dining', why: 'Ricotta, milk and parmesan with spinach: calcium for bones.' },
    { id: 'salmon', title: 'Gingered Salmon Croquettes', src: BHOF, url: bhof('Recipe-for-Gingered-Salmon-Croquettes.pdf'), groups: ['meno'], icon: 'set_meal', why: 'Canned salmon with its soft bones: omega-3 fats, and eating the bones adds calcium.' },
    { id: 'cod', title: 'Cod with Tomatoes and Black Olives', src: BHOF, url: bhof('Recipe-Cod-with-Tomatoes-and-Black-Olives.pdf'), groups: ['meno', 'every'], icon: 'set_meal', why: 'White fish simmered with tomatoes, olives and olive oil, the Mediterranean way.' },
    { id: 'hummus', title: 'Chunky Spicy Hummus', src: BHOF, url: bhof('Recipe-Chunky-Hummus.pdf'), groups: ['every'], icon: 'tapas', why: 'Chickpeas and tahini: a bean dip for vegetable sticks, and a spread instead of butter.' },
    { id: 'four-bean', title: 'Four-Bean Salad with Lemon and Tarragon', src: BHOF, url: bhof('Four-Bean-Salad-1.pdf'), groups: ['every'], icon: 'eco', why: 'Three kinds of beans with green beans and olive oil; it makes ten servings.' },
    { id: 'bean-tuna', title: 'Bean and Tuna Salad with White Balsamic Vinegar', src: BHOF, url: bhof('Recipe-Bean-Tuna-Sald-with-White-Balsamic-Vinegar.pdf'), groups: ['every'], icon: 'lunch_dining', why: 'Cannellini beans and canned tuna with herbs: protein and fibre in ten minutes.' },
    { id: 'carrots', title: 'Roasted carrots with linseed dukkah', src: JH, url: jh('roasted-carrots-linseed-dukkah'), groups: ['every'], icon: 'nutrition', why: 'Roast carrots under a crunchy mix of sesame, hazelnuts and linseed.' },
    { id: 'granola', title: 'Power-me-up granola', src: JH, url: jh('iron-rich-granola'), groups: ['every'], icon: 'grain', why: 'Nuts, seeds, amaranth and dried apricots bring some plant iron; if periods are heavy, see a doctor too. Sweetened with dates and maple syrup.' },
    { id: 'kebabs', title: 'Fish and vegetable kebabs', src: JH, url: jh('fish-and-vegetable-kebabs'), groups: ['every'], icon: 'outdoor_grill', why: 'White fish and vegetables on skewers, marinated in olive oil, herbs and lemon.' }
  ];

  /* Singapore guides for eating out and building a plate (links, not recipes) */
  var LOCAL = [
    { id: 'plate', title: 'My Healthy Plate', src: 'HealthHub (HPB)', url: 'https://www.healthhub.sg/live-healthy/balanced-diet-qqh-concept', icon: 'pie_chart', why: 'Quarter wholegrains, quarter protein such as lean meat, egg or tofu, half fruit and vegetables.' },
    { id: 'hawker', title: 'Healthy Hawker Food', src: 'HealthHub (HPB)', url: 'https://www.healthhub.sg/live-healthy/healthyhawkerfood', icon: 'storefront', why: 'HealthHub\'s guide to healthier choices at the hawker centre.' }
  ];

  /* MEDAS (PREDIMED), 13 of its 14 items; `ideas` are recipes that help with a habit not yet in place */
  var MEDAS = [
    { id: 'oil', q: 'Is olive oil your main cooking fat?', ideas: ['cod', 'kebabs'] },
    { id: 'oil4', q: 'About 4 tablespoons of olive oil a day or more, counting cooking, salads and meals out?', hint: 'This is the level in the Spanish study, not a goal for everyone.', ideas: ['four-bean', 'cod'] },
    { id: 'veg', q: 'Two or more servings of vegetables a day, at least one raw or as a salad?', hint: 'A serving is about 200 g; a side dish counts as half.', ideas: ['chicken-greens', 'frittata', 'red-rice'] },
    { id: 'fruit', q: 'Three or more pieces of fruit a day?', hint: 'In the original checklist natural fruit juice counts; whole fruit is the better everyday pick.', ideas: ['bircher'] },
    { id: 'redmeat', q: 'Less than one serving a day of red meat, burgers or processed meat such as ham or sausage?', hint: 'A serving is 100 to 150 g.', ideas: ['chicken-greens', 'tofu', 'four-bean'] },
    { id: 'butter', q: 'Less than one serving a day of butter, margarine or cream?', hint: 'A serving is 12 g.', ideas: ['hummus'] },
    { id: 'drinks', q: 'Less than one sweet or fizzy drink a day?', hint: 'Bubble tea, sweetened kopi and teh, soft drinks, cordials and sweetened packet drinks all count.', ideas: [] },
    { id: 'legumes', q: 'Beans, lentils or chickpeas three or more times a week?', hint: 'A serving is 150 g.', ideas: ['cauli-soup', 'four-bean', 'hummus', 'bean-tuna'] },
    { id: 'fish', q: 'Fish or seafood three or more times a week?', hint: 'A serving is 100 to 150 g of fish, or 4 to 5 pieces or 200 g of shellfish.', ideas: ['sardines', 'cod', 'salmon', 'kebabs'] },
    { id: 'sweets', q: 'Shop-bought sweets or pastries (not homemade), such as cakes, biscuits or custard, fewer than three times a week?', ideas: ['bircher'] },
    { id: 'nuts', q: 'Nuts three or more times a week? Peanuts count.', hint: 'A serving is 30 g, about a small handful.', ideas: ['bircher', 'carrots', 'granola'] },
    { id: 'poultry', q: 'Do you usually choose chicken, turkey or rabbit over beef, veal, pork, burgers or sausages?', ideas: ['chicken-greens'] },
    { id: 'sofrito', q: 'Twice a week or more, a dish cooked with a sauce of tomato with onion, leek or garlic, simmered in olive oil?', ideas: ['cod', 'sardines'] }
  ];
  var MEDAS_COPY = {
    intro: 'These 13 questions are adapted from MEDAS, a short checklist from PREDIMED, a Spanish heart study of older adults. The original has 14 questions and a validated score; this is not that score. In the study, people with more yeses tended to have higher HDL (good) cholesterol, lower triglycerides and blood sugar, and smaller waists: an association, not proof. It was not built for fertility or the ovaries. Use it as a mirror of your week and a list of ideas: you do not need every habit, and if keeping track of food makes you anxious, skip it.',
    wine: 'The original has a 14th question that gives a point for drinking 7 or more glasses of wine a week. Rhythme leaves it out: nobody should start drinking for health, and the NHS advises no alcohol when you are trying to get pregnant.',
    drinks: 'No recipe for this one: water, or tea and coffee without sugar, such as kopi-o kosong or teh-o kosong. If you are pregnant, the NHS advises keeping caffeine under 200 mg a day.',
    /* under every recipe list (NHS foods to avoid in pregnancy, E106), and the general care line */
    pregnancy: 'Pregnant? Cook eggs until firm, and soft cheese and fish until steaming hot; choose pasteurised dairy; skip raw fish and shellfish, and shark, swordfish and marlin; keep tuna to 4 cans a week, and oily fish such as sardines and salmon to 2 portions.',
    care: 'Check each recipe for allergens such as dairy, egg, soy, fish, nuts, sesame and wheat. If you have kidney disease, diabetes or a thyroid condition, or have had an eating disorder, a dietitian or your doctor can tailor these ideas.'
  };

  function byId(id) { for (var i = 0; i < RECIPES.length; i++) if (RECIPES[i].id === id) return RECIPES[i]; return null; }
  function forGroup(g) { return RECIPES.filter(function (r) { return r.groups.indexOf(g) > -1; }); }
  /* answers: { itemId: true | false }; anything else is unanswered */
  function score(answers) {
    var a = answers || {}, yes = 0, answered = 0, missing = [];
    MEDAS.forEach(function (it) {
      if (a[it.id] === true) { yes++; answered++; } else if (a[it.id] === false) { answered++; missing.push(it.id); }
    });
    return { yes: yes, answered: answered, of: MEDAS.length, missing: missing };
  }
  /* recipes for the habits answered "no", each recipe once, in the order of the checklist */
  function ideasFor(answers) {
    var seen = {}, out = [];
    score(answers).missing.forEach(function (id) {
      var it = MEDAS.filter(function (m) { return m.id === id; })[0];
      it.ideas.forEach(function (rid) { if (!seen[rid]) { seen[rid] = 1; out.push({ habit: id, recipe: byId(rid) }); } });
    });
    return out;
  }

  root.OvuRecipes = { GROUPS: GROUPS, RECIPES: RECIPES, LOCAL: LOCAL, MEDAS: MEDAS, MEDAS_COPY: MEDAS_COPY, byId: byId, forGroup: forGroup, score: score, ideasFor: ideasFor };
})(typeof window !== 'undefined' ? window : this);
