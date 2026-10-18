/* Rhythme teas and herbs: familiar drinks with what people use them for, what research says,
 * and who should take care. Reviewed against NCCIH, Cochrane, EMA, LactMed and UK COT sources
 * (Codex review, 18 Oct 2026). Comfort, never treatment; no dosing advice. Sources are numbers in
 * the evidence register (ovu-evidence.js). */
(function (root) {
  'use strict';
  var TEAS = [
    { id: 'ginger', name: 'Ginger tea', icon: 'local_cafe', phase: ['menstrual'], why: 'Warm and soothing during period cramps or a queasy stomach.',
      research: 'Ginger supplements might ease menstrual cramps; the evidence is limited and a fresh-slice tea has not been tested the same way.',
      care: 'Can cause heartburn, stomach upset or diarrhoea. Ask first if you take blood thinners.', refs: ['E35', 'E36'] },
    { id: 'chamomile', name: 'Chamomile', icon: 'local_florist', phase: ['luteal', 'menstrual'], why: 'A gentle way to wind down in the evening.',
      research: 'Evidence is limited; better sleep has not been shown.',
      care: 'Skip it if you are allergic to daisies or ragweed. It may interact with warfarin, sleep medicines and possibly the pill. Ask first if pregnant or breastfeeding.', refs: ['E37'] },
    { id: 'peppermint', name: 'Peppermint', icon: 'eco', phase: ['luteal'], why: 'Traditionally sipped for a heavy, bloated tummy.',
      research: 'Traditional use; clinical evidence for the tea is insufficient.',
      care: 'Can make reflux or heartburn worse. Ask first if you have gallstones.', refs: ['E38'] },
    { id: 'spearmint', name: 'Spearmint', icon: 'spa', phase: ['follicular', 'luteal'], why: 'Some people with PCOS drink it.',
      research: 'One small 30-day trial saw lower androgen levels but no clear change in hair growth. It is not a PCOS treatment.',
      care: 'Tell your doctor if you are being treated for PCOS. Safety in pregnancy and breastfeeding is not established.', refs: ['E39'] },
    { id: 'cinnamon', name: 'Cinnamon (Ceylon)', icon: 'local_cafe', phase: ['menstrual', 'luteal'], why: 'A warming spice many families add to tea.',
      research: 'Research does not clearly support cinnamon for any health condition.',
      care: 'Keep to food amounts, especially in pregnancy. Cassia cinnamon contains coumarin, a liver concern; ask first with liver disease.', refs: ['E40'] },
    { id: 'greentea', name: 'Green tea', icon: 'emoji_food_beverage', phase: ['follicular', 'ovulatory'], why: 'A familiar everyday cup.',
      research: 'No safety concerns as a drink for adults. It contains caffeine, and strength varies.',
      care: 'Pregnant: keep caffeine under 200 mg a day from all sources. Drink it between meals if your iron is low. It interacts with the blood pressure medicine nadolol.', refs: ['E41', 'E48'] },
    { id: 'jujube', name: 'Red date and goji tea', icon: 'nutrition', phase: ['menstrual', 'follicular'], why: 'A comforting drink in many Singapore homes.',
      research: 'Enjoy it as a familiar drink; research has not shown cycle or warming benefits.',
      care: 'Avoid goji with warfarin unless your anticoagulation clinic agrees. Sugar depends on the recipe.', refs: ['E42'] },
    { id: 'water', name: 'Barley water or warm lemon water', icon: 'water_full', phase: ['menstrual', 'follicular', 'ovulatory', 'luteal'], why: 'Simple hydration, nothing more.',
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
