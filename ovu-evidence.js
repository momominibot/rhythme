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
    luna: 'How Luna reads your notes',
    herbs: 'Teas and herbs'
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
    { id: 'E24', short: 'NAMS, 2023', topics: ['acu'], url: 'https://pubmed.ncbi.nlm.nih.gov/37252752/', text: 'Menopause. The North American Menopause Society 2023 position statement on nonhormone therapy.' },
    /* added 18 Oct 2026 after a Codex source review of the acupressure and tea notes */
    { id: 'E25', short: 'Chen et al., 2013', topics: ['acu'], url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3600281/', text: 'eCAM. Meta-analysis of acupuncture or acupressure at SP6 for primary period pain: possible pain relief, limited evidence.' },
    { id: 'E26', short: 'Yu et al., 2015', topics: ['acu'], url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4354715/', text: 'eCAM. Data-mining study of points chosen in period-pain trials (SP6, CV4, CV6 most often). Covers needling and moxibustion, not self-pressure; frequency is not proof of benefit.' },
    { id: 'E27', short: 'Liang et al., 2024', topics: ['acu'], url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11589548/', text: 'J Tradit Chin Med. International standard of TCM techniques: clinical guidelines for dysmenorrhea (2022). Source for traditional point use.' },
    { id: 'E28', short: 'Chen et al., 2021', topics: ['acu'], url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10164622/', text: 'J Tradit Chin Med. Acupuncture for low back pain: Hong Kong taskforce clinical practice guideline. Source for traditional low-back point use.' },
    { id: 'E29', short: 'J Acupunct Meridian Stud, 2021', topics: ['acu'], url: 'https://link.springer.com/article/10.51507/j.jams.2021.14.2.33', text: 'Review of experimental studies of acupressure for primary period pain, including small LR3 trials.' },
    { id: 'E30', short: 'MSK Cancer Center', topics: ['acu'], url: 'https://www.mskcc.org/cancer-care/patient-education/acupressure-pain-and-headaches', text: 'Patient education: acupressure for pain and headaches (including LI4).' },
    { id: 'E31', short: 'Cochrane, 2025 (PC6)', topics: ['acu'], url: 'https://www.cochrane.org/evidence/CD003281_what-are-benefits-and-risks-different-wrist-pc6-acupoint-stimulation-techniques-preventing-nausea', text: 'Cochrane review update: wrist PC6 stimulation may help prevent nausea and vomiting after surgery; low confidence. It does not cover travel sickness.' },
    { id: 'E32', short: 'Yazdanpanahi et al., 2017', topics: ['acu'], url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742668/', text: 'J Family Reprod Health. Dry cupping versus acupressure at BL23 for postpartum low back pain: one small trial.' },
    { id: 'E33', short: 'Carr, 2015', topics: ['acu'], url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4680134/', text: 'Acupuncture in Medicine. The safety of obstetric acupuncture: so-called forbidden points revisited. Concerns needling, not self-pressure; Rhythme still asks you to check with your maternity team.' },
    { id: 'E34', short: 'CDC Yellow Book', topics: ['acu'], url: 'https://www.cdc.gov/yellow-book/hcp/travel-air-sea/motion-sickness.html', text: 'Motion sickness: acupressure bands have not performed better than placebo.' },
    { id: 'E35', short: 'NCCIH, Ginger', topics: ['herbs'], url: 'https://www.nccih.nih.gov/health/ginger', text: 'Ginger supplements might help menstrual cramps; side effects include heartburn, stomach upset and diarrhoea.' },
    { id: 'E36', short: 'Cochrane, 2016 (supplements)', topics: ['herbs'], url: 'https://www.cochrane.org/evidence/CD002124_dietary-supplements-pain-during-menstruation', text: 'Dietary supplements for period pain (Pattanittum et al.): very limited evidence for ginger and others; low or very low certainty; safety poorly reported.' },
    { id: 'E37', short: 'NCCIH, Chamomile', topics: ['herbs'], url: 'https://www.nccih.nih.gov/health/chamomile', text: 'Limited evidence; allergy risk with the daisy family; reported warfarin interaction; pregnancy safety unclear.' },
    { id: 'E38', short: 'EMA, Peppermint leaf', topics: ['herbs'], url: 'https://www.ema.europa.eu/en/medicines/herbal/menthae-piperitae-folium', text: 'European Medicines Agency: traditional use for indigestion and wind; clinical evidence is insufficient.' },
    { id: 'E39', short: 'Grant, 2010', topics: ['herbs'], url: 'https://pubmed.ncbi.nlm.nih.gov/19585478/', text: 'Phytotherapy Research. 30-day randomized trial of spearmint tea in 42 women with PCOS: lower androgen levels, no significant change in hair growth score.' },
    { id: 'E40', short: 'NCCIH, Cinnamon', topics: ['herbs'], url: 'https://www.nccih.nih.gov/health/cinnamon', text: 'Research does not clearly support cinnamon for any condition; cassia contains coumarin (liver concerns).' },
    { id: 'E41', short: 'NCCIH, Green tea', topics: ['herbs'], url: 'https://www.nccih.nih.gov/health/green-tea', text: 'No safety concerns as a drink for adults; contains caffeine; interacts with the blood pressure medicine nadolol.' },
    { id: 'E42', short: 'MSK, Goji', topics: ['herbs'], url: 'https://www.mskcc.org/cancer-care/integrative-medicine/herbs/lycium', text: 'Goji (lycium) can interact with warfarin; allergy is possible.' },
    { id: 'E43', short: 'NCCIH, St John’s wort', topics: ['herbs'], url: 'https://www.nccih.nih.gov/health/st-johns-wort', text: 'Can weaken many medicines, including birth control pills, antidepressants and warfarin.' },
    { id: 'E44', short: 'EMA, Vitex (chasteberry)', topics: ['herbs'], url: 'https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-vitex-agnus-castus-l-fructus-revision-1_en.pdf', text: 'EU herbal monograph: not in pregnancy or breastfeeding; possible interactions with hormone and dopamine-active medicines.' },
    { id: 'E45', short: 'LactMed, Dong quai', topics: ['herbs'], url: 'https://www.ncbi.nlm.nih.gov/books/NBK501836/', text: 'Drugs and Lactation Database: avoid while breastfeeding; bleeding risk with blood thinners.' },
    { id: 'E46', short: 'NCCIH, Licorice', topics: ['herbs'], url: 'https://www.nccih.nih.gov/health/licorice-root', text: 'Glycyrrhizin can raise blood pressure and cause irregular heartbeat, even in small amounts for susceptible people; large amounts unsafe in pregnancy.' },
    { id: 'E47', short: 'UK Committee on Toxicity', topics: ['herbs'], url: 'https://www.gov.uk/government/publications/raspberry-leaf-tea/statement-on-the-potential-health-effects-of-raspberry-leaf-tea-in-the-maternal-diet', text: 'Raspberry leaf tea in pregnancy: benefit for labour unproven, uncertainty about safety.' },
    { id: 'E48', short: 'NHS, Pregnancy foods', topics: ['herbs'], url: 'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/', text: 'In pregnancy keep caffeine under 200 mg a day from all sources.' },
    { id: 'E49', short: 'NIDDK, Coeliac disease', topics: ['herbs'], url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease/eating-diet-nutrition', text: 'Barley contains gluten and is not suitable with coeliac disease.' }
  ];
  var BY = {}; LIST.forEach(function (e) { BY[e.id] = e; });
  function forTopic(t) { return LIST.filter(function (e) { return e.topics.indexOf(t) > -1; }); }
  root.OvuEvidence = { TOPICS: TOPICS, LIST: LIST, get: function (id) { return BY[id] || null; }, forTopic: forTopic };
})(window);
