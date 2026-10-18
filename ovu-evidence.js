/* Rhythme evidence register. Guides in the app show only a short citation and its number
 * (for example "NICE NG88, 2018 · E5"); the full note and link live here and on evidence.html,
 * where anyone can look a number up. Numbers are permanent: add new sources at the end,
 * never renumber. */
(function (root) {
  'use strict';
  var TOPICS = {
    nova: 'How processed is it? (NOVA)',
    bleeding: 'What light, medium and heavy mean',
    pain: 'The 0 to 10 pain scale',
    sleep: 'How the sleep notes work',
    food: 'Where the food numbers come from',
    cycle: 'How predictions are made',
    acu: 'Acupressure for period pain',
    reminders: 'Why these four nudges',
    luna: 'How Luna reads your notes'
  };
  var LIST = [
    { id: 'E1', short: 'Monteiro et al., 2019', topics: ['nova'], url: 'https://doi.org/10.1017/S1368980018003762', text: 'Public Health Nutrition. Ultra-processed foods: what they are and how to identify them (the NOVA classification).' },
    { id: 'E2', short: 'Lane et al., 2024', topics: ['nova'], url: 'https://www.bmj.com/content/384/bmj-2023-077310', text: 'BMJ. Umbrella review of ultra-processed food exposure and 32 health outcomes (observational studies).' },
    { id: 'E3', short: 'Open Food Facts, NOVA', topics: ['nova'], url: 'https://world.openfoodfacts.org/nova', text: 'NOVA groups for packaged products, as published by Open Food Facts.' },
    { id: 'E4', short: 'NHS, Heavy periods', topics: ['bleeding'], url: 'https://www.nhs.uk/conditions/heavy-periods/', text: 'Signs of heavy bleeding: clots of 2.5 cm or more, changing protection every 1 to 2 hours, bleeding through clothes, periods lasting more than 7 days.' },
    { id: 'E5', short: 'NICE NG88, 2018', topics: ['bleeding'], url: 'https://www.nice.org.uk/guidance/ng88', text: 'Heavy menstrual bleeding guideline (2018, updated 2021): heavy bleeding is excessive loss that interferes with physical, emotional, social and material quality of life.' },
    { id: 'E6', short: 'Higham et al., 1990', topics: ['bleeding'], url: 'https://doi.org/10.1111/j.1471-0528.1990.tb16249.x', text: 'BJOG. The pictorial blood loss assessment chart; a score of 100 or more corresponds to about 80 mL of blood loss.' },
    { id: 'E7', short: 'Munro et al., 2018 (FIGO)', topics: ['bleeding', 'cycle'], url: 'https://doi.org/10.1002/ijgo.12666', text: 'FIGO abnormal uterine bleeding System 1: a typical cycle is 24 to 38 days, varies by no more than 7 to 9 days, and bleeding lasts up to 8 days.' },
    { id: 'E8', short: 'Hjermstad et al., 2011', topics: ['pain'], url: 'https://doi.org/10.1016/j.jpainsymman.2010.08.016', text: 'Journal of Pain and Symptom Management. Systematic review supporting 0 to 10 numeric rating scales for pain intensity.' },
    { id: 'E9', short: 'NHS, Period pain', topics: ['pain'], url: 'https://www.nhs.uk/conditions/period-pain/', text: 'Period pain that affects daily life is worth assessing by a GP.' },
    { id: 'E10', short: 'Watson et al., 2015', topics: ['sleep', 'reminders'], url: 'https://doi.org/10.5665/sleep.4716', text: 'Sleep. American Academy of Sleep Medicine and Sleep Research Society consensus: adults should sleep 7 or more hours a night on a regular schedule.' },
    { id: 'E11', short: 'USDA FoodData Central', topics: ['food'], url: 'https://fdc.nal.usda.gov/', text: 'SR Legacy nutrient data per 100 g edible portion, with household measures.' },
    { id: 'E12', short: 'Open Food Facts', topics: ['food'], url: 'https://openfoodfacts.github.io/openfoodfacts-server/api/', text: 'Product data and nutrition fields for packaged foods found by barcode or name.' },
    { id: 'E13', short: 'HPB SG FoodID', topics: ['food', 'luna'], url: 'https://pphtpc.hpb.gov.sg/web/sgfoodid', text: 'Health Promotion Board, Singapore Food Insights Database: energy and nutrient composition of local dishes.' },
    { id: 'E14', short: 'HPB SG FoodID terms', topics: ['food'], url: 'https://file.go.gov.sg/termsofuse-hpbsgfoodid.pdf', text: 'SG FoodID terms of use: section 10 data licence and section 11 attribution.' },
    { id: 'E15', short: 'NIH-led study, 2026', topics: ['food'], url: 'https://www.eurekalert.org/news-releases/1136415', text: 'NUTRITION 2026 conference abstract (preliminary): evaluation of photo-based calorie apps.' },
    { id: 'E16', short: 'WHO, 2020', topics: ['reminders'], url: 'https://www.who.int/publications/i/item/9789240015128', text: 'Guidelines on physical activity and sedentary behaviour: limit sitting time and replace it with activity of any intensity.' },
    { id: 'E17', short: 'EFSA, 2010', topics: ['reminders'], url: 'https://doi.org/10.2903/j.efsa.2010.1459', text: 'Dietary reference values for water: an adequate total water intake for women is 2.0 L a day.' },
    { id: 'E18', short: 'Zaccaro et al., 2018', topics: ['reminders'], url: 'https://doi.org/10.3389/fnhum.2018.00353', text: 'Frontiers in Human Neuroscience. Systematic review of slow breathing techniques and psychophysiological outcomes.' },
    { id: 'E19', short: 'Yu et al., 2025', topics: ['acu'], url: 'https://pubmed.ncbi.nlm.nih.gov/41138782/', text: 'Complementary Therapies in Medicine. Systematic review and meta-analysis of acupressure for primary period pain.' },
    { id: 'E20', short: 'Ravi et al., 2024', topics: ['acu'], url: 'https://pubmed.ncbi.nlm.nih.gov/39309625/', text: 'Medical Acupuncture. Sanyinjiao (SP6) for pain in primary period pain: an umbrella review.' },
    { id: 'E21', short: 'Aksoy-Can et al., 2025', topics: ['acu'], url: 'https://link.springer.com/article/10.1186/s12906-025-04965-0', text: 'BMC Complementary Medicine and Therapies. Acupressure for pain, menstrual symptoms and comfort in adolescents with primary period pain (small single-centre trial).' },
    { id: 'E22', short: 'Smith et al., 2016 (Cochrane)', topics: ['acu'], url: 'https://www.cochrane.org/evidence/CD007854_acupuncture-period-pain', text: 'Cochrane review: acupuncture for period pain.' },
    { id: 'E23', short: 'Zhang et al., 2025 (Cochrane)', topics: ['acu'], url: 'https://www.cochrane.org/evidence/CD007689_what-are-benefits-and-harms-acupuncture-women-polycystic-ovary-syndrome', text: 'Cochrane review: acupuncture for polycystic ovary syndrome.' },
    { id: 'E24', short: 'NAMS, 2023', topics: ['acu'], url: 'https://pubmed.ncbi.nlm.nih.gov/37252752/', text: 'Menopause. The North American Menopause Society 2023 position statement on nonhormone therapy.' }
  ];
  var BY = {}; LIST.forEach(function (e) { BY[e.id] = e; });
  function forTopic(t) { return LIST.filter(function (e) { return e.topics.indexOf(t) > -1; }); }
  root.OvuEvidence = { TOPICS: TOPICS, LIST: LIST, get: function (id) { return BY[id] || null; }, forTopic: forTopic };
})(window);
