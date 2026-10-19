/* Rhythme teas and herbs: familiar drinks with what people use them for, what research says,
 * and who should take care. Reviewed against NCCIH, Cochrane, EMA, LactMed and UK COT sources
 * (Codex review, 18 Oct 2026); saffron, lemon balm, holy basil, lavender, rose, fennel and chasteberry added 19 Oct 2026 from PubMed trial and review abstracts (E50 to E66), each research line naming the preparation the trials used, since a tea is rarely what was tested. Comfort, never treatment; no dosing advice. Sources are numbers in
 * the evidence register (ovu-evidence.js). */
(function (root) {
  'use strict';
  var TEAS = [
    { id: 'ginger', name: 'Ginger tea', icon: 'local_cafe', img: 'herb-ginger.webp', phase: ['menstrual'], why: 'Warm and soothing during period cramps or a queasy stomach.',
      research: 'Reviews of small trials found ginger capsules eased period pain more than placebo and about as well as anti-inflammatory painkillers; a fresh-slice tea is weaker and has not been tested the same way.',
      care: 'Can cause heartburn, stomach upset or diarrhoea. Ask first if you take blood thinners.', refs: ['E35', 'E36', 'E57', 'E58', 'E62'] },
    { id: 'chamomile', name: 'Chamomile', icon: 'local_florist', img: 'herb-chamomile.webp', phase: ['luteal', 'menstrual'], why: 'A gentle way to wind down in the evening.',
      research: 'One double-blind trial of chamomile extract capsules found modestly lower anxiety in mild to moderate generalised anxiety; tea has not been tested the same way, and better sleep has not been shown.',
      care: 'Skip it if you are allergic to daisies or ragweed. It may interact with warfarin, sleep medicines and possibly the pill. Ask first if pregnant or breastfeeding.', refs: ['E37', 'E59'] },
    { id: 'peppermint', name: 'Peppermint', icon: 'eco', img: 'herb-peppermint.webp', phase: ['luteal'], why: 'Traditionally sipped for a heavy, bloated tummy.',
      research: 'Traditional use; clinical evidence for the tea is insufficient.',
      care: 'Can make reflux or heartburn worse. Ask first if you have gallstones.', refs: ['E38'] },
    { id: 'spearmint', name: 'Spearmint', icon: 'spa', img: 'herb-spearmint.webp', phase: ['follicular', 'luteal'], why: 'Some people with PCOS drink it.',
      research: 'One small 30-day trial saw lower androgen levels but no clear change in hair growth. It is not a PCOS treatment.',
      care: 'Tell your doctor if you are being treated for PCOS. Safety in pregnancy and breastfeeding is not established.', refs: ['E39'] },
    { id: 'cinnamon', name: 'Cinnamon (Ceylon)', icon: 'local_cafe', img: 'herb-cinnamon.webp', phase: ['menstrual', 'luteal'], why: 'A warming spice many families add to tea.',
      research: 'Two small trials in PCOS saw more regular cycles over six months and lower insulin resistance over twelve weeks with cinnamon capsules; that is preliminary, and a sprinkle in tea is not the same dose.',
      care: 'Keep to food amounts, especially in pregnancy. Cassia cinnamon contains coumarin, a liver concern; choose Ceylon and ask first with liver disease or diabetes medicines.', refs: ['E40', 'E60', 'E61'] },
    { id: 'greentea', name: 'Green tea', icon: 'emoji_food_beverage', img: 'herb-greentea.webp', phase: ['follicular', 'ovulatory'], why: 'A familiar everyday cup.',
      research: 'No safety concerns as a drink for adults. It contains caffeine, and strength varies.',
      care: 'Pregnant: keep caffeine under 200 mg a day from all sources. Drink it between meals if your iron is low. It interacts with the blood pressure medicine nadolol.', refs: ['E41', 'E48'] },
    { id: 'jujube', name: 'Red date and goji tea', icon: 'nutrition', img: 'herb-jujube.webp', phase: ['menstrual', 'follicular'], why: 'A comforting drink in many Singapore homes.',
      research: 'Enjoy it as a familiar drink; research has not shown cycle or warming benefits.',
      care: 'Avoid goji with warfarin unless your anticoagulation clinic agrees. Sugar depends on the recipe.', refs: ['E42'] },
    { id: 'saffron', name: 'Saffron, a few strands', icon: 'local_fire_department', img: 'herb-saffron.webp', phase: ['luteal', 'menstrual'], why: 'A golden cup some steep in the days before a period.',
      research: 'The trials used standardised saffron capsules, not tea: one small double-blind trial found fewer premenstrual symptoms and lower depression scores over two cycles, and a trial in adults with low mood saw better mood over four weeks. A few strands in water are far weaker and untested.',
      care: 'Keep to a pinch; large amounts can be harmful and are avoided in pregnancy. Ask first if you take antidepressants or blood thinners.', refs: ['E50', 'E51', 'E52'] },
    { id: 'lemonbalm', name: 'Lemon balm', icon: 'eco', img: 'herb-lemonbalm.webp', phase: ['luteal', 'follicular'], why: 'A lemony, calming cup for a tense afternoon.',
      research: 'A meta-analysis of small trials found lower anxiety and depression scores than placebo, mostly with capsules or extracts and mostly short term; one eight-week double-blind trial of capsules also saw better sleep. Tea is a gentler dose than the trials used.',
      care: 'May add to the drowsiness of sleep medicines. Ask first if you have a thyroid condition, are pregnant or breastfeeding.', refs: ['E63', 'E64'] },
    { id: 'tulsi', name: 'Holy basil (tulsi)', icon: 'grass', img: 'herb-tulsi.webp', phase: ['follicular', 'ovulatory', 'luteal'], why: 'A peppery, clove-like cup many drink for everyday stress.',
      research: 'One eight-week double-blind trial of a standardised extract found lower perceived stress and hair cortisol and better self-rated sleep; a review of 24 human studies reported no significant adverse events but said the right dose and form are still unclear. Tea has not been tested the same way.',
      care: 'May lower blood sugar; ask first with diabetes medicines. Animal studies raise questions about fertility, so ask first if you are trying to conceive, pregnant or breastfeeding.', refs: ['E65', 'E66'] },
    { id: 'lavender', name: 'Lavender', icon: 'spa', img: 'herb-lavender.webp', phase: ['luteal'], why: 'A calming cup for the evening.',
      research: 'One small two-week trial of lavender tea in older adults found lower anxiety and depression scores, but it had no placebo cup. The stronger evidence is for lavender oil capsules, a different preparation.',
      care: 'Food-grade dried flowers only; never drink lavender essential oil. Ask first in pregnancy.', refs: ['E53'] },
    { id: 'rose', name: 'Rose tea', icon: 'local_florist', img: 'herb-rose.webp', phase: ['menstrual'], why: 'Fragrant and gentle on a crampy day.',
      research: 'One trial in teenagers found less period pain and distress over six months of drinking rose tea, though there was no placebo cup to compare it with.',
      care: 'Use food-grade petals or buds. Skip it if roses bring on an allergy.', refs: ['E54'] },
    { id: 'fennel', name: 'Fennel seed', icon: 'grass', img: 'herb-fennel.webp', phase: ['menstrual', 'luteal'], why: 'A sweet aniseed cup for cramps and a bloated tummy.',
      research: 'A review of twelve trials found fennel eased period pain about as well as painkillers, but the trials were small and uneven, and a Cochrane review rated the evidence low. Most used extracts or drops rather than tea.',
      care: 'Not in medicinal amounts in pregnancy or while breastfeeding; skip it with a carrot or celery allergy; ask first with a hormone-sensitive condition.', refs: ['E55', 'E62'] },
    { id: 'vitex', name: 'Chasteberry (vitex), as a supplement', icon: 'medication', img: 'herb-vitex.webp', phase: ['luteal'], why: 'Taken for premenstrual symptoms, usually as a standardised supplement rather than a tea.',
      research: 'A review of fourteen trials found fewer premenstrual symptoms than placebo, but most trials were small and at risk of bias, so the true effect is uncertain. Any effect takes at least two cycles.',
      care: 'Not in pregnancy or breastfeeding; may interact with hormonal contraception, hormone treatment and dopamine medicines. Talk to your doctor before starting it.', refs: ['E56', 'E44'] },
    { id: 'water', name: 'Barley water or warm lemon water', icon: 'water_full', img: 'herb-water.webp', phase: ['menstrual', 'follicular', 'ovulatory', 'luteal'], why: 'Simple hydration, nothing more.',
      research: 'Hydration only; no health claims.',
      care: 'Barley contains gluten, so skip it with coeliac disease or a barley allergy. Choose unsweetened.', refs: ['E49'] }
  ];
  var TAKE_CARE = [
    { name: 'St John’s wort', text: 'Can make the pill and many other medicines (antidepressants, warfarin) work less well.', refs: ['E43'] },
    { name: 'Chasteberry (vitex)', text: 'Not in pregnancy or breastfeeding; may interact with hormonal contraception and hormone treatment.', refs: ['E44'] },
    { name: 'Dong quai', text: 'Bleeding risk with blood thinners; avoid in pregnancy and while breastfeeding.', refs: ['E45'] },
    { name: 'Licorice root', text: 'Can raise blood pressure and upset heart rhythm, even in small amounts for some people; avoid with heart or kidney disease and large amounts in pregnancy.', refs: ['E46'] },
    { name: 'Raspberry leaf', text: 'Its benefit for labour is unproven; do not start it yourself during pregnancy.', refs: ['E47'] }
  ];
  function forPhase(phase) {
    var p = phase === 'late' ? 'luteal' : phase;
    return TEAS.slice().sort(function (a, b) { return (b.phase.indexOf(p) > -1) - (a.phase.indexOf(p) > -1); });
  }
  root.OvuHerbs = { TEAS: TEAS, TAKE_CARE: TAKE_CARE, forPhase: forPhase };
})(window);
