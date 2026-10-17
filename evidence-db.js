/* ══════════════════════════════════════════════════════════════
   OVULUNA · Clinical Evidence Database
   Centralized source for every (i) popup in the app.
   Each entry: { key, claim, evidence, source, level, wellnessNote }
   Source metadata is legacy unless an explicit verification record is present.
   ══════════════════════════════════════════════════════════════ */

window.EVIDENCE_DB = {
  "phenoage-2018-method": {
  "claim": "Clinical PhenoAge combines age and nine blood markers as a research measure of phenotypic aging.",
  "evidence": "Levine and colleagues developed a clinical phenotypic-age model before creating the separate DNA-methylation predictor. Ovumind reproduces the rounded Aging 2018 supplement coefficients as a research reference, not as an ovarian-age estimate.",
  "sources": [
    {
      "authors": "Levine ME et al.",
      "year": "2018",
      "title": "An epigenetic biomarker of aging for lifespan and healthspan",
      "doi": "10.18632/aging.101414",
      "url": "https://www.aging-us.com/article/101414/text"
    },
    {
      "authors": "Levine ME et al.",
      "year": "2018",
      "title": "Supplement 1: methods pp. 1–2 and Table S1",
      "url": "https://cdn.aging-us.com/article/101414/supplementary/SD1/0/aging-v10i4-101414-supplementary-material-SD1.pdf"
    },
    {
      "authors": "Liu Z et al.",
      "year": "2018",
      "title": "A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV: A cohort study",
      "doi": "10.1371/journal.pmed.1002718"
    },
    {
      "authors": "Liu Z et al.",
      "year": "2019",
      "title": "Correction to the separate NHANES IV cohort study: alternative printed equation",
      "doi": "10.1371/journal.pmed.1002760"
    }
  ],
  "method": {
    "name": "Clinical PhenoAge — Aging 2018 published-coefficient approximation",
    "description": "All nine reported numeric results, their explicit units, chronological age at blood draw and collection date are required. No missing value is filled in. Unit conversions: albumin g/dL ×10; creatinine mg/dL ×88.4; glucose mg/dL ÷18.0182; CRP mg/L ÷10; WBC 10⁹/L equals 10³/µL. The calculation uses the natural logarithm of CRP in mg/dL.",
    "formula": "xb = -19.9067 + 0.0804×age - 0.0336×albumin + 0.0095×creatinine + 0.1953×glucose + 0.0954×ln(CRP) - 0.0120×lymphocyte% + 0.0268×MCV + 0.3306×RDW% + 0.0019×ALP + 0.0554×WBC. H = exp(xb) × (exp(120×0.0076927)-1) / 0.0076927. PhenoAge = 141.50225 + ln(0.00553×H)/0.090165. The implementation evaluates ln(H) directly for numerical stability.",
    "units": "Albumin g/L; creatinine µmol/L; glucose mmol/L; CRP mg/dL; lymphocytes %; MCV fL; RDW-CV %; ALP U/L; WBC 10³/µL.",
    "population": "Research in US adult NHANES cohorts. App entry limits are software guards, not validated clinical ranges.",
    "version": "levine-2018-published-coefficients-v1"
  },
  "limitations": "This source check is not clinical approval of Ovumind. Clinical PhenoAge is not DNAm PhenoAge, ovarian age, fertility, a menopause date or a treatment rule. This implementation consistently uses the rounded coefficients and 0.090165 denominator in the original Aging 2018 supplement. Other printed versions and software using additional coefficient precision can give different results; their constants must not be mixed. The current app and its intended population have not undergone clinical validation.",
  "verification": {
    "status": "verified",
    "checkedAt": "2026-09-11"
  },
  "wellnessNote": "Review results with a qualified clinician. Do not use this research reference to change treatment or fasting."
},


  /* ── Cycle phases & hormones ── */
  "cycle-phases": {
    claim: "The menstrual cycle has four phases: menstrual, follicular, ovulatory, and luteal.",
    evidence: "The menstrual cycle is conventionally divided into the follicular phase (from menstruation to ovulation) and the luteal phase (from ovulation to next menstruation), with ovulation as the transition point. Estradiol rises during the follicular phase, peaks before ovulation, then progesterone dominates the luteal phase.",
    source: { authors: "Hale RW, Das A", year: "2024", journal: "StatPearls", doi: "", pmid: "29261940", title: "Normal Menstrual Cycle" },
    level: "strong",
    wellnessNote: "Cycle phase awareness supports wellness planning but is not a diagnostic tool."
  },
  "cycle-length-normal": {
    claim: "A normal menstrual cycle ranges from 21 to 35 days.",
    evidence: "The American College of Obstetricians and Gynecologists (ACOG) and the World Health Organization both define a normal menstrual cycle as 21 to 35 days in adult women. FIGO's 2018 revision uses 24 to 38 days based on population percentiles.",
    source: { authors: "Munro MG et al.", year: "2018", journal: "Int J Gynaecol Obstet", doi: "10.1002/ijgo.12663", pmid: "30051850", title: "FIGO classification system (PALM-COEIN) and normal menstrual cycle parameters" },
    level: "strong",
    wellnessNote: "Cycle length varies by age and individual; persistent changes warrant clinical discussion."
  },
  "straw10": {
    claim: "STRAW+10 is the standardized staging system for reproductive aging.",
    evidence: "The STRAW+10 system stages reproductive aging from early reproductive years through menopause, based on cycle regularity, bleeding patterns, and supportive endocrine markers (FSH, AMH, AFC). It defines 10 stages across reproductive, menopausal transition, and postmenopause periods.",
    source: { authors: "Harlow SD et al.", year: "2012", journal: "Menopause", doi: "10.1097/gme.0b013e31823fae38", pmid: "22395361", title: "STRAW+10: addressing the unfinished agenda" },
    level: "strong",
    wellnessNote: "STRAW+10 staging requires clinical assessment; self-assessment is approximate only."
  },
  "estradiol-follicular": {
    claim: "Estradiol rises during the follicular phase and peaks just before ovulation.",
    evidence: "During the follicular phase, developing follicles produce increasing estradiol. The preovulatory estradiol peak triggers the LH surge that causes ovulation. Estradiol levels typically reach 200-500 pg/mL at peak.",
    source: { authors: "Hall JE", year: "2024", journal: "Endotext", doi: "", pmid: "25905226", title: "Neuroendocrine Control of the Menstrual Cycle" },
    level: "strong",
    wellnessNote: "Hormone fluctuations are normal; testing requires clinical interpretation."
  },
  "progesterone-luteal": {
    claim: "Progesterone rises after ovulation and dominates the luteal phase.",
    evidence: "After ovulation, the corpus luteum secretes progesterone, which prepares the endometrium for implantation. Progesterone peaks around day 21-22 of a 28-day cycle and declines if pregnancy does not occur, triggering menstruation.",
    source: { authors: "Noyes RW et al.", year: "2019", journal: "Fertil Steril", doi: "10.1016/j.fertnstert.2019.03.017", pmid: "31056216", title: "Corpus luteum function and progesterone" },
    level: "strong",
    wellnessNote: "Progesterone testing should be timed to cycle phase and interpreted clinically."
  },

  /* ── Ovarian reserve & biomarkers ── */
  "amh-overview": {
    claim: "AMH (Anti-Müllerian Hormone) is a marker of ovarian reserve.",
    evidence: "AMH is produced by granulosa cells of small antral follicles and correlates with the size of the primordial follicle pool. It is relatively stable across the menstrual cycle, making it a convenient marker. Levels decline with age and become very low after menopause.",
    source: { authors: "Broer SL et al.", year: "2014", journal: "Hum Reprod Update", doi: "10.1093/humupd/dmt063", pmid: "24371082", title: "AMH as predictor of ovarian response and menopause" },
    level: "strong",
    wellnessNote: "AMH is one marker among many; it does not predict natural fertility on its own."
  },
  "fsh-menopause": {
    claim: "FSH levels rise as ovarian reserve declines and after menopause.",
    evidence: "Follicle-stimulating hormone (FSH) rises as the ovaries produce less inhibin B and estradiol with declining follicular quantity. Postmenopausal FSH is typically >25-30 IU/L. FSH varies by cycle phase and should be tested on day 2-4 for baseline assessment.",
    source: { authors: "Lindsay R et al.", year: "2005", journal: "J Clin Endocrinol Metab", doi: "10.1210/jc.2004-2184", pmid: "15728205", title: "FSH and ovarian aging" },
    level: "strong",
    wellnessNote: "Single FSH readings are not diagnostic; repeat testing and clinical context are needed."
  },
  "afc-reserve": {
    claim: "Antral Follicle Count (AFC) via ultrasound assesses ovarian reserve.",
    evidence: "AFC counts small antral follicles (2-10 mm) via transvaginal ultrasound, typically on cycle day 2-4. It correlates with ovarian response to stimulation and is one of the most reliable predictors of ovarian reserve alongside AMH.",
    source: { authors: "Broer SL et al.", year: "2013", journal: "Hum Reprod Update", doi: "10.1093/humupd/dms049", pmid: "23125200", title: "AFC and AMH as predictors of ovarian response" },
    level: "strong",
    wellnessNote: "AFC requires clinical ultrasound and interpretation by a qualified provider."
  },
  "ovarian-age-concept": {
    "claim": "Ovarian reserve measurements do not by themselves establish a biological ovarian age.",
    "evidence": "ASRM describes ovarian reserve as oocyte quantity, distinct from oocyte quality. AMH and AFC can inform expected ovarian response to stimulation. ACOG cautions that a single AMH result should not be used to predict time to pregnancy in women with presumed fertility.",
    "sources": [
        {
            "authors": "ASRM Practice Committee",
            "year": "2020",
            "title": "Testing and interpreting measures of ovarian reserve: a committee opinion",
            "url": "https://www.asrm.org/practice-guidance/practice-committee-documents/testing-and-interpreting-measures-of-ovarian-reserve-a-committee-opinion-2020/"
        },
        {
            "authors": "ACOG Committee on Gynecologic Practice",
            "year": "2019",
            "title": "Committee Opinion No. 773: The Use of Antimüllerian Hormone in Women Not Seeking Fertility Care",
            "pmid": "30913198",
            "doi": "10.1097/AOG.0000000000003162"
        }
    ],
    "verification": {
        "status": "verified",
        "checkedAt": "2026-09-11"
    },
    "limitations": "These sources support interpretation limits. They do not validate Ovumind’s combined score, age offsets, fertility predictions or treatment recommendations.",
    "method": "No clinically validated Ovumind ovarian-age conversion formula has been established in this release.",
    "wellnessNote": "Discuss ovarian reserve results and fertility questions with a qualified clinician."
},

  /* ── Perimenopause & menopause ── */
  "perimenopause-symptoms": {
    claim: "Perimenopause involves irregular cycles, hot flashes, night sweats, and mood changes.",
    evidence: "Perimenopause (the menopausal transition) typically begins in the mid-40s and is characterized by cycle irregularity (variation ≥7 days), vasomotor symptoms (hot flashes, night sweats), sleep disturbance, mood changes, and vaginal dryness due to fluctuating and declining estrogen.",
    source: { authors: "Stuenkel CA et al.", year: "2023", journal: "Endocr Rev", doi: "10.1210/endrev/bnac031", pmid: "36579884", title: "Treatment of Symptoms of the Menopause" },
    level: "strong",
    wellnessNote: "Symptom severity varies widely; persistent or severe symptoms warrant clinical evaluation."
  },
  "menopause-age": {
    claim: "Average age at natural menopause is approximately 51 years.",
    evidence: "The Study of Women's Health Across the Nation (SWAN) and large international cohorts (InterLACE) consistently report median age at natural menopause around 51-52 years in Western populations, with normal range 45-55. Smoking, BMI, and ethnicity influence timing.",
    source: { authors: "Gold EB et al.", year: "2011", journal: "Am J Epidemiol", doi: "10.1093/aje/kwq439", pmid: "21163929", title: "SWAN: age at natural menopause" },
    level: "strong",
    wellnessNote: "Menopause before 40 (premature) or 40-45 (early) warrants medical evaluation."
  },
  "hot-flashes": {
    claim: "Hot flashes affect approximately 70-80% of women during the menopausal transition.",
    evidence: "Vasomotor symptoms (hot flashes and night sweats) are the most common menopausal symptom, affecting 70-80% of women. They result from hypothalamic thermoregulatory instability due to estrogen withdrawal. Average duration is 7-10 years, longer than previously thought.",
    source: { authors: "Freeman EW et al.", year: "2014", journal: "JAMA Intern Med", doi: "10.1001/jamainternmed.2014.56", pmid: "24733020", title: "Duration of vasomotor symptoms" },
    level: "strong",
    wellnessNote: "Lifestyle measures (cool environment, layered clothing, avoiding triggers) can help; severe symptoms warrant clinical discussion."
  },
  "hrt-benefits-risks": {
    claim: "Hormone therapy is the most effective treatment for moderate-to-severe vasomotor symptoms.",
    evidence: "Systemic hormone therapy (estrogen ± progestogen) is the most effective treatment for moderate-to-severe hot flashes and night sweats. The 2017 NAMS position statement and 2022 Endocrine Society guideline support use in symptomatic women under 60 or within 10 years of menopause, with individualized risk-benefit assessment.",
    source: { authors: "The 2022 Hormone Therapy Position Statement", year: "2022", journal: "Menopause", doi: "10.1097/GME.0000000000002038", pmid: "36282798", title: "NAMS 2022 Hormone Therapy Position Statement" },
    level: "strong",
    wellnessNote: "Hormone therapy requires prescription and individualized medical assessment; this is not medical advice."
  },

  /* ── Sleep ── */
  "sleep-duration": {
    claim: "Adults need 7-9 hours of sleep per night for optimal health.",
    evidence: "The National Sleep Foundation and American Academy of Sleep Medicine consensus recommend 7-9 hours of sleep per night for most adults. Chronic short sleep (<6 hours) is associated with increased risk of cardiovascular disease, metabolic syndrome, and cognitive impairment.",
    source: { authors: "Hirshkowitz M et al.", year: "2015", journal: "Sleep Health", doi: "10.1016/j.sleh.2014.12.010", pmid: "29073412", title: "National Sleep Foundation's sleep time duration recommendations" },
    level: "strong",
    wellnessNote: "Individual sleep needs vary; persistent insomnia or daytime fatigue warrants clinical evaluation."
  },
  "sleep-cycle-hormones": {
    claim: "Hormonal changes across the cycle affect sleep quality.",
    evidence: "Progesterone has sedative effects and increases during the luteal phase, while premenstrual progesterone decline can disrupt sleep. Postmenopausal estrogen loss contributes to sleep fragmentation, often compounded by night sweats. Sleep architecture changes across cycle phases.",
    source: { authors: "Baker FC et al.", year: "2021", journal: "Sleep Med Rev", doi: "10.1016/j.smrv.2020.101355", pmid: "33010711", title: "Sleep and the menstrual cycle" },
    level: "moderate",
    wellnessNote: "Tracking sleep alongside cycle phase can reveal patterns; chronic sleep issues need clinical attention."
  },

  /* ── Stress & HPA axis ── */
  "stress-hrv": {
    claim: "Heart rate variability (HRV) reflects autonomic nervous system balance and stress.",
    evidence: "HRV measures beat-to-beat variation and reflects the balance between sympathetic (stress) and parasympathetic (rest) nervous systems. Higher HRV generally indicates better stress resilience. Acute stress lowers vagally-mediated HRV (RMSSD). Chronic stress is associated with sustained lower HRV.",
    source: { authors: "Kim H et al.", year: "2018", journal: "Psychiatry Investig", doi: "10.4306/pi.2018.15.3.232", pmid: "29593683", title: "Acute stress and HRV" },
    level: "strong",
    wellnessNote: "HRV is influenced by many factors (caffeine, exercise, sleep, illness); trends matter more than single readings."
  },
  "stress-cortisol-cycle": {
    claim: "Chronic stress can disrupt menstrual cycle regularity via the HPA axis.",
    evidence: "The hypothalamic-pituitary-adrenal (HPA) axis and hypothalamic-pituitary-gonadal (HPG) axis interact. Chronic stress elevates cortisol, which can suppress GnRH pulsatility, leading to anovulation, luteal phase defects, or cycle irregularity. Functional hypothalamic amenorrhea is an extreme example.",
    source: { authors: "Laughlin GA et al.", year: "2014", journal: "Endocr Rev", doi: "10.1210/er.2013-1078", pmid: "24620036", title: "Hypothalamic amenorrhea and stress" },
    level: "strong",
    wellnessNote: "Stress management supports cycle wellness; persistent cycle changes should be evaluated clinically."
  },
  "breathwork-hrv": {
    claim: "Slow breathing exercises increase HRV and reduce perceived stress.",
    evidence: "Slow breathing (5-7 breaths/min) increases vagal tone, raises HRV, and reduces sympathetic activity. Coherent breathing at ~6 breaths/min maximizes baroreflex sensitivity. Randomized trials show reduced anxiety and perceived stress with regular practice.",
    source: { authors: "Zaccaro A et al.", year: "2018", journal: "Front Hum Neurosci", doi: "10.3389/fnhum.2018.00353", pmid: "30197605", title: "How breath control modulates heart rate variability" },
    level: "strong",
    wellnessNote: "Breathwork is a wellness practice; if you have respiratory or cardiac conditions, consult your clinician."
  },
  "478-breathing": {
    claim: "The 4-7-8 breathing technique can promote relaxation and sleep onset.",
    evidence: "The 4-7-8 technique (inhale 4s, hold 7s, exhale 8s) extends exhalation, activating the parasympathetic nervous system. Extended exhalation increases vagal tone and reduces heart rate. Dr. Andrew Weil popularized it based on pranayama traditions. Small studies show reduced pre-sleep anxiety.",
    source: { authors: "Li AW et al.", year: "2019", journal: "J Altern Complement Med", doi: "10.1089/acm.2018.0268", pmid: "30896925", title: "Slow breathing and relaxation response" },
    level: "moderate",
    wellnessNote: "If dizziness occurs, stop and breathe normally. Not a substitute for clinical sleep treatment."
  },

  /* ── Nutrition ── */
  "iron-menstruation": {
    claim: "Menstrual blood loss increases iron requirements and risk of iron deficiency.",
    evidence: "Women of reproductive age have higher iron requirements (18 mg/day) due to menstrual blood loss. Heavy menstrual bleeding is a leading cause of iron deficiency anemia in premenopausal women. Iron-rich foods include red meat, leafy greens, legumes, and fortified cereals; vitamin C enhances absorption.",
    source: { authors: "Camaschella C", year: "2019", journal: "Blood", doi: "10.1182/blood-2019-063705", pmid: "31562628", title: "Iron deficiency and menstrual blood loss" },
    level: "strong",
    wellnessNote: "Iron supplementation should be guided by blood tests; excess iron can be harmful."
  },
  "magnesium-pms": {
    claim: "Magnesium supplementation may reduce PMS symptoms including cramps and mood changes.",
    evidence: "Several randomized controlled trials suggest magnesium (200-400 mg/day) may reduce PMS symptoms including bloating, mood disturbances, and menstrual cramps, possibly through its role in muscle relaxation and serotonin regulation. Evidence is moderate with some heterogeneity.",
    source: { authors: "Pms Mg Study Group", year: "2018", journal: "Womens Health", doi: "10.1177/1745506518777239", pmid: "29865909", title: "Magnesium for PMS: systematic review" },
    level: "moderate",
    wellnessNote: "Magnesium from food (nuts, seeds, leafy greens) is preferred; supplements should not exceed tolerable upper intake."
  },
  "omega3-inflammation": {
    claim: "Omega-3 fatty acids have anti-inflammatory effects and may reduce menstrual pain.",
    evidence: "EPA and DHA (omega-3 fatty acids) reduce pro-inflammatory eicosanoids. Multiple RCTs show omega-3 supplementation (1-2g/day) reduces primary dysmenorrhea pain intensity and may reduce PMS mood symptoms. Fatty fish (salmon, sardines) is the best dietary source.",
    source: { authors: "Rafraf M et al.", year: "2017", journal: "J Obstet Gynaecol Res", doi: "10.1111/jog.13211", pmid: "27906541", title: "Omega-3 fatty acids and dysmenorrhea" },
    level: "moderate",
    wellnessNote: "Omega-3 supplements can interact with anticoagulants; consult a clinician if taking blood thinners."
  },
  "vitamin-d-fertility": {
    claim: "Vitamin D deficiency is common and may affect reproductive health.",
    evidence: "Vitamin D receptors are present in ovarian tissue, endometrium, and placenta. Low vitamin D is associated with lower IVF success rates and may affect menstrual regularity. However, evidence for routine supplementation improving natural fertility is mixed. Deficiency is common, especially in limited sun exposure.",
    source: { authors: "Paffoni A et al.", year: "2019", journal: "Hum Reprod Update", doi: "10.1093/humupd/dmz019", pmid: "31069365", title: "Vitamin D and reproductive outcomes" },
    level: "moderate",
    wellnessNote: "Vitamin D levels should be tested before high-dose supplementation; 600-800 IU/day is standard for most adults."
  },
  "inositol-pcos": {
    claim: "Myo-inositol supplementation may improve insulin sensitivity and ovulation in PCOS.",
    evidence: "Myo-inositol (a B-vitamin-like substance) improves insulin signaling. Multiple RCTs show myo-inositol (2-4g/day) improves ovulation frequency, menstrual regularity, and metabolic parameters in women with PCOS. The combination myo-inositol + D-chiro-inositol (40:1 ratio) is most studied.",
    source: { authors: "Unfer V et al.", year: "2017", journal: "Endocrine", doi: "10.1007/s12020-016-1128-9", pmid: "27822667", title: "Inositol and PCOS: systematic review" },
    level: "moderate",
    wellnessNote: "Inositol is generally well-tolerated; PCOS management should be individualized with a clinician."
  },
  "b6-pms": {
    claim: "Vitamin B6 may help reduce PMS symptoms including mood changes.",
    evidence: "Vitamin B6 (pyridoxine) is a cofactor in serotonin and dopamine synthesis. A Cochrane review found moderate evidence that B6 (up to 100 mg/day) may improve overall PMS symptoms, particularly mood. Doses >200 mg/day can cause peripheral neuropathy.",
    source: { authors: "Kashanian M et al.", year: "2018", journal: "J Obstet Gynaecol", doi: "10.1080/01443615.2017.1404556", pmid: "29466690", title: "Vitamin B6 for PMS" },
    level: "moderate",
    wellnessNote: "Stay below 100 mg/day from supplements; food sources include chickpeas, salmon, and potatoes."
  },
  "folate-reproduction": {
    claim: "Folate is essential for reproductive health and fetal neural tube development.",
    evidence: "Folate (vitamin B9) is critical for DNA synthesis and cell division. Adequate folate before and during early pregnancy reduces neural tube defect risk by 50-70%. The recommended intake is 400 mcg/day for women of reproductive age, and 600 mcg during pregnancy.",
    source: { authors: "CDC", year: "2023", journal: "MMWR Recomm Rep", doi: "10.15585/mmwr.rr6601a1", pmid: "28253100", title: "Folic acid recommendations for prevention of neural tube defects" },
    level: "strong",
    wellnessNote: "If planning pregnancy, start folate at least 1 month before conception; consult a clinician for personalized advice."
  },

  /* ── Exercise ── */
  "exercise-cycle": {
    claim: "Regular moderate exercise supports menstrual cycle regularity and reduces PMS symptoms.",
    evidence: "Regular physical activity improves circulation, reduces inflammation, and modulates stress hormones. Studies show moderate exercise (150 min/week) reduces PMS symptom severity and dysmenorrhea. However, excessive exercise with low energy availability can cause hypothalamic amenorrhea.",
    source: { authors: "Daley AJ", year: "2009", journal: "Br J Sports Med", doi: "10.1136/bjsm.2008.050382", pmid: "19131354", title: "Exercise and premenstrual syndrome" },
    level: "moderate",
    wellnessNote: "Balance is key; if exercise causes cycle disruption or fatigue, adjust intensity and consult a clinician."
  },
  "exercise-luteal": {
    claim: "Exercise tolerance and performance may vary across the menstrual cycle.",
    evidence: "Some studies suggest strength performance may be slightly better in the follicular phase, while endurance may be more stable. Progesterone in the luteal phase raises core temperature and ventilation slightly. However, individual variation is large and most women can exercise consistently throughout the cycle.",
    source: { authors: "McNulty KL et al.", year: "2020", journal: "Sports Med", doi: "10.1007/s40279-020-01288-4", pmid: "32103383", title: "The menstrual cycle and exercise performance" },
    level: "moderate",
    wellnessNote: "Listen to your body; adjust intensity based on how you feel rather than strict phase-based rules."
  },

  /* ── PCOS ── */
  "pcos-criteria": {
    claim: "PCOS is diagnosed by Rotterdam criteria: 2 of 3 — oligo/anovulation, hyperandrogenism, polycystic ovaries.",
    evidence: "The Rotterdam 2003 criteria require two of three features: (1) oligo- or anovulation, (2) clinical or biochemical signs of hyperandrogenism, (3) polycystic ovarian morphology on ultrasound. Other causes (thyroid disease, hyperprolactinemia, congenital adrenal hyperplasia) must be excluded.",
    source: { authors: "Rotterdam ESHRE/ASRM-Sponsored PCOS Consensus Workshop Group", year: "2004", journal: "Hum Reprod", doi: "10.1093/humrep/deh098", pmid: "14688144", title: "Rotterdam criteria for PCOS" },
    level: "strong",
    wellnessNote: "PCOS diagnosis requires clinical evaluation and lab testing; self-assessment is not diagnostic."
  },
  "pcos-lifestyle": {
    claim: "Lifestyle modification (diet + exercise) is first-line for PCOS management.",
    evidence: "International evidence-based guidelines (2018, updated 2023) recommend lifestyle modification as first-line treatment for all women with PCOS. Even 5-10% weight loss improves insulin resistance, ovulation, and metabolic markers. A Mediterranean-style diet with regular exercise is most supported.",
    source: { authors: "Teede HJ et al.", year: "2023", journal: "Hum Reprod Open", doi: "10.1093/hropen/hoad014", pmid: "37123070", title: "International PCOS guideline" },
    level: "strong",
    wellnessNote: "PCOS management should be individualized; consult a clinician for diagnosis and treatment planning."
  },

  /* ── Endometriosis ── */
  "endometriosis-overview": {
    claim: "Endometriosis affects ~10% of reproductive-age women and causes chronic pelvic pain.",
    evidence: "Endometriosis is characterized by endometrial-like tissue outside the uterus, causing inflammation, scarring, and pain. It affects approximately 10% of reproductive-age women and is associated with dysmenorrhea, dyspareunia, chronic pelvic pain, and subfertility. Diagnosis is often delayed 7-10 years.",
    source: { authors: "Zondervan KT et al.", year: "2020", journal: "N Engl J Med", doi: "10.1056/NEJMra1810764", pmid: "32160449", title: "Endometriosis" },
    level: "strong",
    wellnessNote: "Severe menstrual pain that interferes with daily life is not normal; seek clinical evaluation."
  },

  /* ── Thyroid ── */
  "thyroid-menstrual": {
    claim: "Thyroid dysfunction can cause menstrual irregularities.",
    evidence: "Both hypothyroidism and hyperthyroidism can disrupt menstrual cycles. Hypothyroidism is associated with menorrhagia (heavy bleeding) and oligomenorrhea, while hyperthyroidism may cause lighter or absent periods. Thyroid dysfunction is more common in women and should be screened in cycle evaluation.",
    source: { authors: "Krassas GE et al.", year: "2010", journal: "Endocr Rev", doi: "10.1210/er.2009-0012", pmid: "20093385", title: "Thyroid function and reproductive health" },
    level: "strong",
    wellnessNote: "Thyroid testing (TSH) is a simple blood test; persistent cycle changes warrant clinical evaluation."
  },

  /* ── BMI & lifestyle ── */
  "bmi-fertility": {
    claim: "Both low and high BMI can affect menstrual regularity and fertility.",
    evidence: "BMI <18.5 is associated with hypothalamic amenorrhea due to energy deficit, while BMI >30 is associated with anovulation and reduced fertility. Even modest weight loss (5-10%) in women with obesity can restore ovulation. Body fat percentage influences estrogen production.",
    source: { authors: "Norman RJ et al.", year: "2018", journal: "Hum Reprod Update", doi: "10.1093/humupd/dmx035", pmid: "29145536", title: "Obesity and reproductive health" },
    level: "strong",
    wellnessNote: "BMI is a rough screening tool; body composition, muscle mass, and overall health matter more than the number alone."
  },
  "smoking-menopause": {
    claim: "Smoking is associated with earlier menopause and increased vasomotor symptoms.",
    evidence: "Current smokers experience menopause 1-2 years earlier than non-smokers and have more severe hot flashes. Smoking also reduces fertility, increases miscarriage risk, and is associated with lower bone density. Even light smoking affects reproductive hormones.",
    source: { authors: "Aloia JF et al.", year: "2015", journal: "J Womens Health", doi: "10.1089/jwh.2014.4973", pmid: "25517502", title: "Smoking and menopause timing" },
    level: "strong",
    wellnessNote: "Quitting smoking at any age benefits reproductive and overall health; seek support from a clinician."
  },

  /* ── Bone & cardiovascular health ── */
  "bone-estrogen": {
    claim: "Estrogen decline after menopause accelerates bone loss.",
    evidence: "Estrogen is essential for maintaining bone density by inhibiting osteoclast activity. In the first 5 years after menopause, women lose 1-3% bone density per year, increasing osteoporosis and fracture risk. Calcium (1000-1200 mg/day), vitamin D, and weight-bearing exercise help preserve bone.",
    source: { authors: "Cosman F et al.", year: "2014", journal: "J Bone Miner Res", doi: "10.1002/jbmr.2352", pmid: "25183321", title: "NOF Clinician's Guide to Prevention and Treatment of Osteoporosis" },
    level: "strong",
    wellnessNote: "Bone density screening (DEXA) is recommended for women 65+ or earlier with risk factors; discuss with a clinician."
  },
  "cardiovascular-menopause": {
    claim: "Cardiovascular risk increases after menopause as estrogen declines.",
    evidence: "Pre-menopausal women have lower cardiovascular disease risk than men, but this advantage narrows after menopause. Estrogen has protective effects on vascular endothelium and lipid profile. Postmenopausal women should monitor blood pressure, lipids, and blood sugar, with lifestyle as foundation.",
    source: { authors: "Mehta A et al.", year: "2019", journal: "Circulation", doi: "10.1161/CIRCULATIONAHA.118.036284", pmid: "30883305", title: "Menopause and cardiovascular disease risk" },
    level: "strong",
    wellnessNote: "Heart-healthy lifestyle (diet, exercise, not smoking) benefits women at every age; regular check-ups are important."
  },

  /* ── Vaginal health ── */
  "vaginal-dryness": {
    claim: "Vaginal dryness and atrophy are common after menopause due to estrogen decline.",
    evidence: "The genitourinary syndrome of menopause (GSM) affects 50-70% of postmenopausal women, causing vaginal dryness, irritation, dyspareunia, and urinary symptoms. Local estrogen therapy is effective and has minimal systemic absorption. Non-hormonal moisturizers and lubricants provide symptomatic relief.",
    source: { authors: "Portman DJ, Gass MLS", year: "2014", journal: "Menopause", doi: "10.1097/GME.0000000000000325", pmid: "25379775", title: "Genitourinary syndrome of menopause" },
    level: "strong",
    wellnessNote: "Vaginal symptoms are treatable; don't accept them as an inevitable part of aging—discuss with a clinician."
  },

  /* ── Contraception ── */
  "hormonal-contraception": {
    claim: "Hormonal contraception regulates cycles and can reduce menstrual pain and bleeding.",
    evidence: "Combined hormonal contraceptives (pill, patch, ring) suppress ovulation and reduce menstrual flow and dysmenorrhea. They are also used to manage PCOS, endometriosis, and heavy menstrual bleeding. Progestin-only methods (IUD, implant) can reduce bleeding or cause amenorrhea. Risks vary by method and individual risk factors.",
    source: { authors: "Curtis KM et al.", year: "2016", journal: "MMWR Recomm Rep", doi: "10.15585/mmwr.rr6504a1", pmid: "27195951", title: "US Medical Eligibility Criteria for Contraceptive Use" },
    level: "strong",
    wellnessNote: "Contraceptive choice should be individualized with a clinician considering medical history and preferences."
  },

  /* ── PPG / wearables ── */
  "ppg-hrv": {
    claim: "Photoplethysmography (PPG) via smartphone camera can estimate pulse rate and HRV.",
    evidence: "PPG measures blood volume changes via light absorption. Smartphone camera PPG can estimate heart rate and pulse rate variability (PRV), which correlates with ECG-based HRV at rest. Accuracy decreases with movement, poor perfusion, and dark skin tone. It is not a medical device.",
    source: { authors: "Peng Y et al.", year: "2015", journal: "BioMed Eng OnLine", doi: "10.1186/s12938-015-0064-0", pmid: "26100345", title: "Smartphone PPG for heart rate monitoring" },
    level: "moderate",
    wellnessNote: "PPG readings are wellness estimates, not medical measurements; for clinical concerns, use validated medical devices."
  },
  "hrv-women-health": {
    "claim": "Research reports differences in cardiac vagal activity across menstrual cycle phases.",
    "evidence": "A 2019 systematic review and meta-analysis of 37 studies involving 1,004 participants reported lower cardiac vagal activity in the luteal phase than in the follicular phase. This is a group-level association in naturally cycling premenopausal participants, not a diagnostic threshold for an individual.",
    "source": {
        "authors": "Schmalenberger KM et al.",
        "year": "2019",
        "journal": "Journal of Clinical Medicine",
        "title": "A Systematic Review and Meta-Analysis of Within-Person Changes in Cardiac Vagal Activity across the Menstrual Cycle: Implications for Female Health and Future Studies",
        "pmid": "31726666",
        "doi": "10.3390/jcm8111946"
    },
    "verification": {
        "status": "verified",
        "checkedAt": "2026-09-11"
    },
    "limitations": "This review does not validate Ovumind’s camera readings, diagnose stress or ovulation, or establish an ovarian-age formula or fasting rule.",
    "wellnessNote": "Interpret personal trends cautiously and seek clinical advice for symptoms."
},

  /* ── Supplements general ── */
  "supplements-caution": {
    claim: "Dietary supplements are not regulated like medications and can interact with prescriptions.",
    evidence: "In many countries, dietary supplements are not required to prove efficacy before marketing, and quality varies. Supplements can interact with medications (e.g., St. John's wort with hormonal contraceptives, vitamin K with anticoagulants). Always inform your clinician about all supplements you take.",
    source: { authors: "FDA", year: "2023", journal: "FDA Guidance", doi: "", pmid: "", title: "Dietary Supplement Regulation" },
    level: "consensus",
    wellnessNote: "Food-first approach is recommended; supplements should fill specific gaps identified with a clinician or dietitian."
  },

  /* ── Partner support ── */
  "partner-support-outcomes": {
    claim: "Partner support is associated with better women's health outcomes and treatment adherence.",
    evidence: "Studies in reproductive health, IVF, and chronic disease management show that partner emotional support is associated with better treatment adherence, lower stress, and improved quality of life. In fertility treatment, partner support predicts better psychological outcomes and treatment continuation.",
    source: { authors: "Peterson BD et al.", year: "2015", journal: "Fertil Steril", doi: "10.1016/j.fertnstert.2015.03.018", pmid: "25865558", title: "Partner support and reproductive health outcomes" },
    level: "moderate",
    wellnessNote: "Communication with your partner about cycle and health needs is a wellness practice, not a substitute for medical care."
  },

  /* ── Endocrine disruptors ── */
  "endocrine-disruptors": {
    claim: "Certain environmental chemicals (phthalates, parabens, BPA) may disrupt hormonal function.",
    evidence: "Endocrine-disrupting chemicals (EDCs) including phthalates, parabens, bisphenols, and certain pesticides can interfere with hormone synthesis, transport, and action. Epidemiological studies link higher EDC exposure to earlier puberty, reduced fertility, and earlier menopause, though causal evidence in humans remains evolving.",
    source: { authors: "Gore AC et al.", year: "2015", journal: "Endocr Rev", doi: "10.1210/er.2014-1091", pmid: "25811443", title: "EDC-2: The Endocrine Society's statement on endocrine-disrupting chemicals" },
    level: "moderate",
    wellnessNote: "Reducing exposure (avoiding certain plastics, fragrances) is a reasonable wellness choice; evidence for individual product choices is evolving."
  },

  /* ── Family history ── */
  "family-history-ovarian": {
    claim: "Family history of ovarian or breast cancer affects ovarian cancer risk.",
    evidence: "Women with a first-degree relative (mother, sister, daughter) with ovarian cancer have 3-5x increased risk. BRCA1/BRCA2 mutations significantly increase ovarian and breast cancer risk. Family history of early menopause may also predict individual menopause timing. Genetic counseling is recommended for high-risk families.",
    source: { authors: "NCCN Guidelines", year: "2024", journal: "J Natl Compr Canc Netw", doi: "10.6004/jnccn.2024.0012", pmid: "", title: "Genetic/Familial High-Risk Assessment: Breast, Ovarian, and Pancreatic" },
    level: "strong",
    wellnessNote: "Know your family history; discuss with a clinician or genetic counselor if multiple relatives had breast/ovarian cancer."
  },

  /* ── Nutrition phases ── */
  "nutrition-follicular": {
    claim: "The follicular phase benefits from protein and healthy fats to support follicle development.",
    evidence: "During the follicular phase, rising estrogen supports insulin sensitivity. Adequate protein (1.2-1.6g/kg body weight) and healthy fats support hormone synthesis (cholesterol is the precursor to steroid hormones). Iron-rich foods help replenish stores after menstruation.",
    source: { authors: "Lai J et al.", year: "2018", journal: "Nutrients", doi: "10.3390/nu10060755", pmid: "29857535", title: "Nutrition and menstrual cycle" },
    level: "moderate",
    wellnessNote: "Cycle-phase eating is an emerging wellness framework; overall dietary quality matters more than strict phase-based rules."
  },
  "nutrition-luteal": {
    claim: "The luteal phase may benefit from complex carbohydrates and magnesium to support mood and reduce cravings.",
    evidence: "In the luteal phase, progesterone increases appetite and cravings for carbohydrates. Serotonin levels may fluctuate, contributing to PMS mood changes. Complex carbohydrates support steady serotonin production. Magnesium may help with mood, sleep, and cramping. Caloric needs may increase by ~100-300 kcal in the luteal phase.",
    source: { authors: "Cross GB et al.", year: "2018", journal: "Appetite", doi: "10.1016/j.appet.2018.04.012", pmid: "29655545", title: "Menstrual cycle and food intake" },
    level: "moderate",
    wellnessNote: "Increased appetite in the luteal phase is normal; honor hunger with nutrient-dense foods rather than restrictive eating."
  },

  /* ── Fertility window ── */
  "fertile-window": {
    claim: "The fertile window is approximately 6 days ending on the day of ovulation.",
    evidence: "Sperm can survive 3-5 days in the female reproductive tract, while the egg is viable for 12-24 hours after ovulation. This creates a fertile window of approximately 6 days (5 days before ovulation + ovulation day). Conception rates are highest with intercourse in the 2-3 days before ovulation.",
    source: { authors: "Wilcox AJ et al.", year: "1995", journal: "N Engl J Med", doi: "10.1056/NEJM199512073332301", pmid: "7477185", title: "Timing of sexual intercourse in relation to ovulation" },
    level: "strong",
    wellnessNote: "Fertility awareness methods require consistent tracking; they are not 100% effective for contraception without strict adherence."
  },

  /* ── Sleep & perimenopause ── */
  "sleep-perimenopause": {
    claim: "Sleep disturbance is common in perimenopause, often linked to night sweats and hormonal changes.",
    evidence: "Up to 60% of perimenopausal women report sleep problems. Night sweats cause awakenings, and declining estrogen affects sleep architecture (reduced REM, increased wake after sleep onset). Sleep apnea risk also increases after menopause. Poor sleep worsens mood, concentration, and vasomotor symptoms.",
    source: { authors: "Schaafsma A et al.", year: "2018", journal: "Maturitas", doi: "10.1016/j.maturitas.2018.08.005", pmid: "30195914", title: "Sleep disturbances in menopause" },
    level: "strong",
    wellnessNote: "Sleep hygiene (cool room, consistent schedule, limiting screens) helps; persistent insomnia warrants clinical evaluation."
  },

  /* ── Stress & fertility ── */
  "stress-fertility": {
    claim: "Chronic stress may affect fertility through HPA-gonadal axis interactions.",
    evidence: "Chronic stress elevates cortisol, which can suppress GnRH and LH pulsatility, leading to anovulation or luteal phase defects. Studies show women with higher perceived stress have slightly lower conception rates per cycle, though the effect size is modest. Stress reduction may support fertility treatment outcomes.",
    source: { authors: "Lynch CD et al.", year: "2014", journal: "Hum Reprod", doi: "10.1093/humrep/deu098", pmid: "24739598", title: "Stress and time-to-pregnancy" },
    level: "moderate",
    wellnessNote: "Stress management is part of overall wellness; if you're struggling to conceive, consult a fertility specialist."
  },

  /* ── Longevity ── */
  "ovarian-longevity": {
    claim: "Later menopause is associated with longer lifespan and reduced cardiovascular risk.",
    evidence: "Women who experience menopause after age 50 have lower all-cause mortality and cardiovascular disease risk compared to those with earlier menopause. Longer reproductive lifespan (later menopause) correlates with preserved estrogen exposure, which benefits bone, cardiovascular, and cognitive health. However, very late menopause (>55) may increase breast cancer risk.",
    source: { authors: "Schoenaker DA et al.", year: "2014", journal: "Int J Epidemiol", doi: "10.1093/ije/dyu030", pmid: "24625563", title: "InterLACE: age at menopause and mortality" },
    level: "strong",
    wellnessNote: "Menopause timing is largely genetic; lifestyle factors (smoking, BMI) can influence it but cannot override biology."
  },
  "longevity-lifestyle": {
    claim: "Diet, exercise, sleep, and stress management are foundational for healthy aging.",
    evidence: "Large cohort studies (Nurses' Health Study, Blue Zones) consistently show that non-smoking, regular physical activity, healthy diet (Mediterranean-style), adequate sleep, and social connection are associated with longer healthspan and lifespan. These factors also support reproductive health across the lifespan.",
    source: { authors: "Loef M, Walach H", year: "2012", journal: "Arch Intern Med", doi: "10.1001/archinternmed.2012.323", pmid: "22689012", title: "Healthy lifestyle factors and mortality" },
    level: "strong",
    wellnessNote: "Small consistent habits matter more than extreme interventions; focus on sustainable changes."
  },

  /* ── Soy isoflavones ── */
  "soy-isoflavones-hot-flashes": {
    claim: "Soy isoflavones reduce hot flash frequency by approximately 20.6% compared with placebo.",
    evidence: "A systematic review and meta-analysis of randomized controlled trials found that extracted or synthesized soy isoflavones (median dose 54 mg aglycone equivalents/day, 6 weeks to 12 months) reduced hot flash frequency by 20.6% (95% CI: -28.38 to -12.86; P<0.00001) compared with placebo. Hot flash severity was also reduced. Heterogeneity was significant but the effect persisted in sensitivity analyses.",
    source: { authors: "Nahas EA et al.", year: "2012", journal: "Menopause", doi: "10.1097/gme.0b013e31824573b1", pmid: "22433977", title: "Effect of soy isoflavones on menopausal hot flashes: meta-analysis of RCTs" },
    level: "moderate",
    wellnessNote: "Soy foods (edamame, tofu, tempeh) are the preferred dietary source; isoflavone supplements vary in quality. Effects are modest (~20%) and may take 6+ weeks."
  },
  "soy-isoflavones-bone": {
    claim: "Soy isoflavones may modestly increase lumbar spine bone mineral density by ~2.38%.",
    evidence: "A meta-analysis of RCTs pooling 1,240 menopausal women found that soy isoflavones (mean 82 mg/day, range 47-150 mg aglycone equivalent, 6-12 months) increased lumbar spine BMD by 22.25 mg/cm² (2.38%; 95% CI: 7.62-32.89; P=0.002). The effect was more pronounced with longer duration (>12 months) and higher genistein content.",
    source: { authors: "Wei P et al.", year: "2012", journal: "Menopause Int", doi: "", pmid: "20199985", title: "Soy isoflavones and bone mineral density: meta-analysis" },
    level: "moderate",
    wellnessNote: "Bone benefits are modest; calcium, vitamin D, and weight-bearing exercise remain foundational for bone health."
  },

  /* ── Danggui Buxue Tang ── */
  "danggui-buxue-tang": {
    claim: "Danggui Buxue Tang (6g/day) reduces hot flash frequency by 35-37% in postmenopausal women.",
    evidence: "Two RCTs in postmenopausal Chinese women support DBT (Angelica sinensis + Astragalus membranaceus, 1:5 ratio). A dose-escalation RCT (n=60) found 6g/day for 12 weeks reduced hot flash frequency by 34.9-37.4% (P<0.01) and night sweats by 39.6%; 3g/day reduced by 14.5-21.2%; 1.5g/day was not significant. A separate RCT (n=103) found significant reduction in mild hot flashes (18.9→8.6/month, P<0.01). No estrogenic effects observed.",
    source: { authors: "Cheung CK et al.", year: "2012", journal: "Menopause", doi: "10.1097/gme.0b013e31825976c3", pmid: "22990757", title: "Dose-dependent effects of Danggui Buxue Tang on hot flashes" },
    level: "moderate",
    wellnessNote: "DBT is a specific 5:1 formula (黄芪30g:当归6g), not dong quai alone. Best evidence is for mild-to-moderate hot flashes; severe symptoms may not respond. Consult a TCM practitioner."
  },

  /* ── Dong Quai null ── */
  "dong-quai-null": {
    claim: "Dong quai (Angelica sinensis) as a single herb does NOT reduce hot flashes.",
    evidence: "A randomized, double-blind, placebo-controlled trial (n=71 postmenopausal women, 4.5g/day dong quai root powder × 24 weeks) found no significant difference between dong quai and placebo for vasomotor symptoms (hot flashes), Kupperman Index, vaginal cytology, endometrial thickness, or FSH/LH levels. Both groups improved ~25-30% from baseline (placebo response). This is the only rigorous Western RCT of dong quai monotherapy.",
    source: { authors: "Hirata JD et al.", year: "1997", journal: "Fertil Steril", doi: "10.1016/s0015-0282(97)81461-7", pmid: "9418683", title: "Does dong quai have estrogenic effects in postmenopausal women? A double-blind, placebo-controlled trial" },
    level: "moderate",
    wellnessNote: "Do not claim 'dong quai relieves hot flashes' as a single herb. Dong quai may be effective as part of multi-herb formulas (e.g., Danggui Buxue Tang), but not alone."
  },

  /* ── Flaxseed null ── */
  "flaxseed-null": {
    claim: "Ground flaxseed does not reduce hot flashes better than placebo in well-designed RCTs.",
    evidence: "A Phase III randomized, double-blind, placebo-controlled trial (n=188 women, 40g/day ground flaxseed bar × 8 weeks, NCCTG N08C7) found no significant difference between flaxseed and placebo in hot flash frequency or severity; both groups showed ~30-40% reduction (strong placebo response). A separate RCT (n=38, 25g flaxseed/day × 12 weeks) also found no significant difference in Kupperman Index. Positive studies are uncontrolled or single-blind.",
    source: { authors: "Barton DL et al.", year: "2012", journal: "Menopause", doi: "10.1097/gme.0b013e31822b75d4", pmid: "", title: "Pilot evaluation of flaxseed for the management of hot flashes: NCCTG N08C7" },
    level: "moderate",
    wellnessNote: "Flaxseed is still a nutritious food (fiber, ALA omega-3, lignans), but do not claim it reduces hot flashes based on well-controlled trials. The placebo response in hot flash studies is typically 30-40%."
  },

  /* ── Calcium PMS ── */
  "calcium-pms": {
    claim: "Calcium carbonate 1,200 mg/day reduces PMS symptom scores by 48% vs 30% with placebo.",
    evidence: "A multi-center, randomized, double-blind, placebo-controlled trial (n=466 women aged 18-45 with moderate-to-severe PMS, 10 centers, 3 menstrual cycles) found that by the third treatment cycle, mean luteal phase symptom complex score was reduced by 48% in the calcium group vs. 30% in the placebo group (P<0.001). Significant improvements were seen in negative affect (mood), water retention, food cravings, and pain. Calcium was well tolerated.",
    source: { authors: "Thys-Jacobs S et al.", year: "1998", journal: "Am J Obstet Gynecol", doi: "10.1016/s0002-9378(98)70214-5", pmid: "9720711", title: "Calcium carbonate and the premenstrual syndrome: effects on premenstrual and menstrual symptoms" },
    level: "strong",
    wellnessNote: "1,200 mg/day elemental calcium in 3 divided doses is the evidence-based dose for PMS. Dietary sources (dairy, fortified foods, leafy greens) plus supplements can achieve this. Do not exceed 2,000 mg/day total."
  },

  /* ── Omega-3 dysmenorrhea ── */
  "omega3-dysmenorrhea": {
    claim: "Omega-3 supplementation significantly reduces dysmenorrhea pain with a large effect size (d=-1.02).",
    evidence: "A systematic review and meta-analysis of 12 RCTs (n=881 women with primary dysmenorrhea, mean age 21.7) found that omega-3 long-chain polyunsaturated fatty acids (300-1800 mg/day, 2-3 months) produced a large effect size for pain reduction (d = -1.020, 95% CI: -1.53 to -0.51, P<0.001). 86% of studies measuring analgesic use showed reduction with omega-3. Few mild adverse events (gastrointestinal).",
    source: { authors: "Mirabi P et al.", year: "2023", journal: "J Obstet Gynaecol Res", doi: "", pmid: "37545015", title: "Omega-3 fatty acids and primary dysmenorrhea: meta-analysis" },
    level: "moderate",
    wellnessNote: "Fatty fish (salmon, sardines, mackerel) 2-3x/week is the best dietary source. Supplements may interact with anticoagulants; consult a clinician if taking blood thinners."
  },

  /* ── Red ginseng menopause ── */
  "red-ginseng-menopause": {
    claim: "Red ginseng (3g/day, 12 weeks) improves overall menopausal symptom scores but does NOT significantly reduce hot flash frequency.",
    evidence: "A randomized, double-blind, placebo-controlled trial (n=72 postmenopausal Korean women, 3g/day Korean red ginseng × 12 weeks) found significant improvement in Kupperman Index (P=0.032) and Menopause Rating Scale (P=0.035) compared with placebo, plus reduced total cholesterol (P=0.009) and LDL (P=0.015). However, hot flash frequency specifically was NOT significantly different between groups. A systematic review of 4 RCTs found mixed results with high risk of bias.",
    source: { authors: "Kim SY et al.", year: "2012", journal: "Menopause", doi: "10.1097/gme.0b013e318233a5e3", pmid: "22027944", title: "Effects of red ginseng on menopausal symptoms and cardiovascular risk factors" },
    level: "moderate",
    wellnessNote: "Red ginseng may improve overall well-being but should not be claimed to reduce hot flashes specifically. Avoid with estrogen-sensitive conditions, anticoagulants, or insomnia; consult a clinician."
  },

  /* ── Pueraria mirifica ── */
  "pueraria-mirifica": {
    claim: "Pueraria mirifica (Thai white kwao krua) may reduce hot flashes in small trials, but evidence is limited and safety requires caution.",
    evidence: "Two small Thai RCTs found Pueraria mirifica (50-100 mg/day, 6 months) reduced perimenopausal hot flashes and night sweats, with effects comparable to low-dose estrogen in one trial (Greene score 2.1→0.55). P. mirifica contains miroestrol and deoxymiroestrol — among the most potent phytoestrogens known. Safety signals include mild anemia and liver enzyme elevation. CRITICAL: P. mirifica is NOT the same as Pueraria lobata (Chinese 葛根/ kudzu), which has lower phytoestrogen content.",
    source: { authors: "Lamlertkittikul S, Chandeying V", year: "2007", journal: "J Med Assoc Thai", doi: "", pmid: "17710964", title: "Efficacy and safety of Pueraria mirifica in perimenopausal women" },
    level: "low",
    wellnessNote: "Evidence is for Thai P. mirifica, NOT Chinese 葛根 (P. lobata). Do not conflate the species. Cautions: pregnancy/lactation contraindicated, estrogen-sensitive conditions, SERM users (tamoxifen), anticoagulants, liver monitoring."
  },

  /* ── Gan Mai Da Zao Tang ── */
  "gan-mai-da-zao-tang": {
    claim: "Gan Mai Da Zao Tang may improve perimenopausal anxiety and mood, but included studies are low quality.",
    evidence: "Meta-analyses (including 35 RCTs pooled) found that Gan Mai Da Zao Tang (licorice + wheat + jujube) significantly alleviated depressive and anxiety symptoms and improved sleep quality, with combination therapy showing greater efficacy. A network pharmacology + meta-analysis for perimenopausal syndrome (PMID 38641538) found symptom improvement via estrogen receptor, serotonergic, and inflammatory pathways. However, overall evidence quality was rated LOW due to heterogeneity, unclear allocation concealment, and lack of blinding in many included studies.",
    source: { authors: "Zhang Y et al.", year: "2024", journal: "J Tradit Chin Med Sci", doi: "", pmid: "38641538", title: "Gan Mai Da Zao Tang for perimenopausal syndrome: meta-analysis and network pharmacology" },
    level: "low",
    wellnessNote: "All ingredients are food-grade (wheat, licorice, jujube) with a long safety record. Use 淮小麦 (not 浮小麦). Long-term high-dose licorice can cause water retention/hypokalemia; monitor if hypertensive."
  },

  /* ── Rose tea dysmenorrhea ── */
  "rose-tea-dysmenorrhea": {
    claim: "Rose tea may reduce menstrual pain and anxiety in adolescents, but meta-analytic evidence is mixed.",
    evidence: "An RCT (n=130 female adolescents with primary dysmenorrhea, Taiwan) found rose tea (2 cups/day, 6 buds/300mL, 1 week pre-period through day 5, 6 cycles) significantly reduced menstrual pain intensity, psychological distress, and anxiety at 1, 3, and 6 months. However, a 2021 meta-analysis (n=548) found a nonsignificant overall effect on menstruation-related pain, with some benefit for anxiety, fatigue, and bloating; high heterogeneity. The RCT was unblinded with no placebo.",
    source: { authors: "Shafei MN et al.", year: "2005", journal: "J Midwifery Womens Health", doi: "10.1016/j.jmwh.2005.06.003", pmid: "", title: "The effect of Rosa damascena on primary dysmenorrhea in adolescent girls" },
    level: "low",
    wellnessNote: "Rose tea is generally safe and pleasant. Best used pre-period (7 days before) through early menses. Don't boil (volatile oils); steep at 80-95°C for 5-15 min."
  },

  /* ── Magnesium PMS mixed ── */
  "magnesium-pms-mixed": {
    claim: "Magnesium may reduce some PMS symptoms in small RCTs, but systematic reviews conclude evidence is insufficient.",
    evidence: "A 1991 crossover RCT (n=32, 360 mg/day magnesium, luteal phase) found significant reduction in premenstrual mood changes (P<0.05). A 2014 RCT (n=126, 250 mg/day magnesium) found significant reduction in PMS physical symptoms (cravings, water retention, breast tenderness). However, a 2024 systematic review of 8 RCTs (n=1,032) concluded that magnesium had insufficient evidence to support effects on psychological PMS symptoms, while vitamin B6, calcium, and zinc consistently showed positive effects.",
    source: { authors: "Facchinetti F et al.", year: "1991", journal: "Obstet Gynecol", doi: "10.1097/00006250-199108000-00011", pmid: "2067759", title: "Magnesium for premenstrual mood changes" },
    level: "low",
    wellnessNote: "Magnesium from food (pumpkin seeds, dark chocolate, almonds, leafy greens) is preferred. If supplementing, 200-360 mg/day in the luteal phase; do not exceed tolerable upper intake (350 mg/day from supplements)."
  },

  /* ── TCM menopause Cochrane ── */
  "tcm-menopause-cochrane": {
    claim: "Cochrane review rates overall evidence for Chinese herbal medicine formulas in menopause as very low quality.",
    evidence: "A Cochrane systematic review (60 randomized trials, n=6,059 women with menopausal symptoms) found that some Chinese herbal medicine (CHM) formulas may reduce hot flashes, but the quality of evidence was very low due to poor methodological quality, heterogeneity of formulas, and high risk of bias. No single formula could be recommended. CHM was not clearly superior to HRT. The review concluded that more rigorous trials are needed.",
    source: { authors: "Wei ML et al.", year: "2016", journal: "Cochrane Database Syst Rev", doi: "10.1002/14651858.CD009023.pub2", pmid: "26976671", title: "Chinese herbal medicine for menopausal symptoms" },
    level: "very-low",
    wellnessNote: "Individual formulas (e.g., Danggui Buxue Tang) may have better evidence, but TCM formulas as a class cannot be broadly recommended. Always consult a qualified TCM practitioner for personalized formula selection."
  },

  /* ── Jiawei Xiaoyao PMS ── */
  "jiawei-xiaoyao-pms": {
    claim: "Jiawei Xiaoyao pill (12g/day, 3 cycles) significantly improves PMS symptoms in a multi-center RCT.",
    evidence: "A multi-center, randomized, double-blind, placebo-controlled trial (n=144 women with PMS, 8 sites in China, liver depression-spleen deficiency-blood heat syndrome) found that Jiawei Xiaoyao pill (modified Xiaoyao San with Moutan and Gardenia, 12g/day × 3 menstrual cycles) significantly improved PMS symptom scores (physical and psychological) compared with placebo. No serious adverse events. NOTE: evidence is for the Jiawei (modified) version, not classic Xiao Yao Wan.",
    source: { authors: "Liang Y et al.", year: "2024", journal: "J Tradit Chin Med", doi: "", pmid: "", title: "Jiawei Xiaoyao pill for premenstrual syndrome: multi-center RCT" },
    level: "moderate",
    wellnessNote: "Evidence is specifically for Jiawei Xiaoyao (加味逍遥丸), not classic Xiao Yao Wan (逍遥丸). Start 1 week pre-period. Consult a TCM practitioner for pattern differentiation."
  },

  /* ── Goji ovarian animal ── */
  "goji-ovarian-animal": {
    claim: "Goji berry (Lycium barbarum) shows ovarian protective effects in animal studies only — no human clinical trials.",
    evidence: "An animal study found that aqueous extract of Lycium barbarum berry significantly increased pregnancy rate and live birth rate in naturally aged female mice, improved locomotor activity, and promoted offspring growth, linked to reduced ovarian oxidative stress and improved oocyte quality (PMID 39224078). Another study found Lycium barbarum polysaccharides improved follicle count, reduced FSH/LH, and restored estrous cycles in POI mice (PMID 37463025). No human clinical trials for ovarian aging or menopause exist.",
    source: { authors: "Li X et al.", year: "2024", journal: "Front Nutr", doi: "", pmid: "39224078", title: "Lycium barbarum improves fertility in aged female mice" },
    level: "very-low",
    wellnessNote: "Goji berries are safe as food (5-15g/day, ~10-30 berries). Do not claim clinical ovarian benefits in humans — evidence is animal-only. Add at ≤60°C to preserve nutrients."
  },

  /* ── Mediterranean menopause ── */
  "mediterranean-menopause": {
    claim: "A Mediterranean-style dietary pattern is associated with reduced vasomotor symptoms in menopausal women.",
    evidence: "A systematic review published in Maturitas (2023) examined dietary patterns and menopausal vasomotor symptoms. Higher adherence to a Mediterranean-style diet (rich in vegetables, fruits, whole grains, legumes, olive oil, fish; low in red meat and processed foods) was associated with reduced frequency and severity of hot flashes and night sweats. The anti-inflammatory and phytoestrogen content of the diet may contribute. Evidence is observational; RCTs are limited.",
    source: { authors: "Biglia N et al.", year: "2023", journal: "Maturitas", doi: "", pmid: "", title: "Dietary patterns and vasomotor symptoms in menopause: systematic review" },
    level: "low",
    wellnessNote: "The Mediterranean diet is a broadly healthy eating pattern with cardiovascular and metabolic benefits. It is reasonable to adopt for overall wellness, not solely for hot flash reduction."
  },

  /* ── Myo-inositol PCOS ── */
  "myo-inositol-pcos": {
    claim: "Myo-inositol (2-4g/day) improves insulin sensitivity, ovulation, and metabolic parameters in PCOS.",
    evidence: "Multiple RCTs and systematic reviews (Unfer et al.) show that myo-inositol (a B-vitamin-like substance involved in insulin signaling) at 2-4g/day improves ovulation frequency, menstrual regularity, and metabolic parameters in women with PCOS. The combination myo-inositol + D-chiro-inositol (40:1 ratio) is most studied and may improve oocyte quality. Effects include reduced insulin resistance, improved androgen profiles, and increased spontaneous ovulation rates.",
    source: { authors: "Unfer V et al.", year: "2017", journal: "Endocrine", doi: "10.1007/s12020-016-1128-9", pmid: "27822667", title: "Inositol and PCOS: systematic review" },
    level: "moderate",
    wellnessNote: "Myo-inositol is generally well-tolerated. PCOS management should be individualized with a clinician; lifestyle modification remains first-line. The 40:1 myo:D-chiro ratio is most evidence-supported."
  },

  /* ── Cramps relief: breathwork ── */
  "breath-cramps-diaphragmatic": {
    claim: "Diaphragmatic breathing significantly reduces menstrual symptom severity compared to control (p=0.0008).",
    evidence: "A systematic review and meta-analysis of physiotherapy interventions for primary dysmenorrhea found that diaphragmatic breathing exercises produced a significant decrease in menstrual symptoms versus control (p=0.0008). Mechanistically, deep diaphragmatic breathing increases intra-abdominal pressure, improves uterine blood flow, reduces prostaglandin secretion, and decreases uterine smooth muscle contraction intensity — directly targeting the pathophysiology of primary dysmenorrhea.",
    source: { authors: "de Sousa IC et al.", year: "2021", journal: "Physiother Theory Pract", doi: "10.1080/09593985.2021.1947489", pmid: "", pmcid: "PMC8345570", title: "Effect of physiotherapy in primary dysmenorrhea: systematic review and meta-analysis" },
    level: "moderate",
    wellnessNote: "Diaphragmatic breathing is a safe, low-cost self-care technique. Practice 5 minutes daily, especially during the first 2 days of menses. If pain is severe or worsening, consult a clinician to rule out secondary causes."
  },
  "breath-478-relaxation": {
    claim: "4-7-8 breathing activates the parasympathetic nervous system, inhibiting pain signal conduction and reducing pain and anxiety.",
    evidence: "The 4-7-8 technique (inhale 4s, hold 7s, exhale 8s) extends exhalation, which increases vagal tone and shifts the autonomic nervous system toward parasympathetic dominance. Parasympathetic activation inhibits pain signal conduction at the spinal and supraspinal levels, reduces perceived pain intensity, and lowers anxiety. The relaxation response elicited by extended exhalation also reduces sympathetic arousal and stress hormones that amplify pain perception. Evidence is based on the broader relaxation response and slow breathing literature, with limited dysmenorrhea-specific trials.",
    source: { authors: "Zaccaro A et al.", year: "2018", journal: "Front Hum Neurosci", doi: "10.3389/fnhum.2018.00353", pmid: "30197605", title: "How breath control modulates heart rate variability: a narrative review" },
    level: "low-moderate",
    wellnessNote: "If dizziness occurs, stop and breathe normally. Best practiced in a comfortable seated or supine position. Not a substitute for clinical pain management."
  },
  "benson-menstrual-pain": {
    claim: "Benson relaxation technique effectively reduces menstrual pain intensity and anxiety in adolescent girls.",
    evidence: "The Benson relaxation technique (repeating a focus word or phrase while breathing naturally) induces the 'relaxation response' — a state of decreased sympathetic nervous system activity. Studies in adolescent girls with primary dysmenorrhea show that regular practice reduces menstrual pain intensity and anxiety levels. Mechanisms include decreased sympathetic activity, stimulation of endogenous endorphin release, and reduction of stress hormones (cortisol, epinephrine) that amplify pain perception. The technique is typically practiced 10-20 minutes once or twice daily.",
    source: { authors: "Benson H et al.", year: "1975", journal: "Psychosom Med", doi: "10.1097/00006842-197507000-00003", pmid: "1147471", title: "The relaxation response: its subjective and objective historical precedents and physiology" },
    level: "moderate",
    wellnessNote: "Choose a neutral or meaningful focus word (e.g., 'calm', 'one', 'peace'). Practice daily for best results, not just during pain. If pain interferes with daily activities, consult a clinician."
  },

  /* ── Cramps relief: acupressure ── */
  "sp6-acupressure-cramps": {
    "claim": "Small trials suggest SP6 acupressure may ease primary menstrual symptoms. Benefit and the best self-care protocol remain uncertain.",
    "evidence": "A cluster-randomized trial enrolled 72 students and compared two cycles of SP6 acupressure with a control group after a baseline cycle. It reported improved menstrual symptom scores, less resting time and lower ibuprofen use. Participants received instruction; this was not a validation of Ovumind.",
    "sources": [
      {
        "authors": "Charandabi SMA et al.",
        "year": "2011",
        "journal": "Iran J Nurs Midwifery Res",
        "title": "The effect of acupressure at the Sanyinjiao point (SP6) on primary dysmenorrhea in students resident in dormitories of Tabriz",
        "pmid": "23450186",
        "pmcid": "PMC3583102",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3583102/"
      },
      {
        "authors": "Armour M, Smith CA, Steel KA, Macmillan F",
        "year": "2019",
        "journal": "BMC Complement Altern Med",
        "title": "The effectiveness of self-care and lifestyle interventions in primary dysmenorrhea: a systematic review and meta-analysis",
        "doi": "10.1186/s12906-019-2433-8",
        "pmid": "30654775",
        "pmcid": "PMC6337810",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6337810/"
      },
      {
        "authors": "NHS",
        "year": "Accessed 2026",
        "title": "Pelvic pain: when to seek medical help",
        "url": "https://www.nhs.uk/symptoms/pelvic-pain/"
      }
    ],
    "method": "Historical study context: a 20-minute protocol across both legs. This describes the research, not a personalized instruction or an established optimal dose.",
    "limitations": "The selected student population, short follow-up, self-report and lack of sham control limit interpretation. Other studies use different protocols. Source review does not approve the app’s self-pressure instructions or establish pregnancy safety, uterine warming, hormonal effects, fertility improvement or ovarian age.",
    "wellnessNote": "This menstrual-cramp routine is not designed for pregnancy. Pelvic pain with possible pregnancy needs urgent medical advice. Severe or worsening pelvic pain, fainting or heavy vaginal bleeding needs emergency assessment.",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-11"
    }
  },
  "acupressure-dysmenorrhea-meta": {
    "claim": "Acupressure may reduce menstrual pain, but results vary substantially and do not validate this particular routine.",
    "evidence": "Armour and colleagues pooled 13 acupressure studies involving 1,086 participants. The overall pain effect was g=0.56 (95% CI 0.10–1.03), with substantial heterogeneity (I²=92.5%). Comparisons with analgesic medication favored medication. Adverse-event reporting was sparse.",
    "sources": [
      {
        "authors": "Armour M, Smith CA, Steel KA, Macmillan F",
        "year": "2019",
        "journal": "BMC Complement Altern Med",
        "title": "The effectiveness of self-care and lifestyle interventions in primary dysmenorrhea: a systematic review and meta-analysis",
        "doi": "10.1186/s12906-019-2433-8",
        "pmid": "30654775",
        "pmcid": "PMC6337810",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6337810/"
      },
      {
        "authors": "NHS",
        "year": "Accessed 2026",
        "title": "Pelvic pain: when to seek medical help",
        "url": "https://www.nhs.uk/symptoms/pelvic-pain/"
      }
    ],
    "method": "Systematic review and meta-analysis of self-care for primary dysmenorrhea; the pooled acupressure result combines different points, protocols and comparators.",
    "limitations": "A pooled benefit is not proof that every acupressure routine works or is safe. Risk of bias, publication bias and variation between trials limit confidence. The hub’s exact combination and timings have not been evaluated. No ovarian-age or fertility effect was established.",
    "wellnessNote": "Self-care should not delay medical assessment of concerning symptoms. Seek emergency help for pelvic pain that is severe or worsening, or accompanied by fainting or heavy vaginal bleeding.",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-11"
    }
  },

  /* ── Cramps relief: exercise & yoga ── */
  "exercise-dysmenorrhea": {
    claim: "Regular exercise significantly reduces dysmenorrhea pain intensity and duration.",
    evidence: "The systematic review and meta-analysis of physiotherapy for primary dysmenorrhea (PMC8345570) found that exercise interventions (including aerobic exercise, stretching, and core strengthening) significantly reduced menstrual pain intensity and duration compared to control groups. Exercise improves pelvic blood flow, reduces prostaglandin levels, increases endorphin release, and reduces sympathetic nervous system arousal. Both aerobic exercise (e.g., brisk walking, cycling) and targeted stretching showed benefits, with effects observed after 8-12 weeks of regular practice (3-5 sessions/week, 30-45 minutes).",
    source: { authors: "de Sousa IC et al.", year: "2021", journal: "Physiother Theory Pract", doi: "10.1080/09593985.2021.1947489", pmid: "", pmcid: "PMC8345570", title: "Effect of physiotherapy in primary dysmenorrhea: systematic review and meta-analysis" },
    level: "moderate",
    wellnessNote: "Even moderate exercise (brisk walking, yoga, stretching) 3-4x/week can help. During acute pain, gentle movement is better than bed rest. Stay hydrated and avoid overexertion. If exercise worsens pain, consult a clinician."
  },
  "yoga-dysmenorrhea": {
    claim: "Yoga practice reduces menstrual pain intensity and improves quality of life in women with primary dysmenorrhea.",
    evidence: "A narrative review of yoga for primary dysmenorrhea (PMC10098011) examined randomized controlled trials and found that regular yoga practice (including asanas, pranayama, and meditation) significantly reduced menstrual pain intensity, pain duration, and associated symptoms (anxiety, fatigue) compared to control groups. Commonly prescribed poses include child's pose (Balasana), cobra (Bhujangasana), cat-cow (Marjaryasana-Bitilasana), and supine twist. Mechanisms include improved pelvic circulation, reduced sympathetic arousal, increased endorphin and GABA levels, and reduced cortisol. Most trials used 30-60 minute sessions, 3-5x/week, for 8-12 weeks. Evidence quality is limited by small sample sizes and heterogeneity of yoga protocols.",
    source: { authors: "Rakhshaee Z et al.", year: "2023", journal: "J Womens Health Reprod Med", doi: "", pmid: "", pmcid: "PMC10098011", title: "Yoga for primary dysmenorrhea: a narrative review of randomized controlled trials" },
    level: "low-moderate",
    wellnessNote: "Gentle, restorative yoga is best during menses — avoid deep backbends, inversions, or intense core work if experiencing heavy bleeding or severe pain. Practice on a non-slip mat. Consistency (8+ weeks) matters more than intensity."
  },

  /* ── Cold drinks & dysmenorrhea ── */
  "cold-drinks-dysmenorrhea": {
    claim: "Habitual cold drink consumption, especially during menstruation, is associated with increased dysmenorrhea risk.",
    evidence: "A cross-sectional study (PMC10815354) examining dietary factors and dysmenorrhea among multi-ethnic women found that among Asian women, higher ice cream consumption in winter was significantly associated with dysmenorrhea (beta=1.19, p=0.0002). Among White women, increased cold water/drinks consumption in winter was also associated (beta=0.49, p=0.04). Mechanistically, low-temperature stimulation can cause uterine vascular and smooth muscle contraction, impeding menstrual blood discharge and leading to uterine ischemia/hypoxia and spasmodic pain. In TCM theory, habitual cold consumption extinguishes Spleen/Stomach Yang Qi, generating internal cold-dampness that worsens uterine stagnation (寒凝血瘀). Nuance: an occasional cold drink is warmed by the digestive tract and unlikely to reach the pelvic cavity at low temperature; the risk is habitual consumption, especially during menstruation.",
    source: { authors: "Bahk J et al.", year: "2024", journal: "J Obstet Gynaecol Res", doi: "", pmid: "", pmcid: "PMC10815354", title: "Association between cold food/drink consumption and dysmenorrhea among multi-ethnic women" },
    level: "moderate",
    wellnessNote: "The evidence is observational and ethnicity-specific; causality is not established. Occasional cold drinks are unlikely to cause harm. If you experience severe cramps, try warm drinks (ginger tea, cinnamon tea, brown sugar water) during your period and keep your lower abdomen warm."
  },

  /* ── Estrogen, insulin & follicular phase ── */
  "estrogen-insulin-follicular": {
    claim: "Rising estrogen during the follicular phase is associated with improved insulin sensitivity and higher energy levels.",
    evidence: "Estradiol rises progressively during the follicular phase, peaking just before ovulation. Standard reproductive endocrinology establishes that estrogen enhances insulin sensitivity by increasing glucose uptake in skeletal muscle and adipose tissue, upregulating GLUT4 transporters, and improving pancreatic beta-cell function. Studies using hyperinsulinemic-euglycemic clamps demonstrate higher insulin sensitivity in the follicular phase compared to the luteal phase. Rising estrogen also supports energy metabolism, mood, and cognitive function, contributing to the subjective sense of higher energy in the follicular phase. Conversely, estrogen withdrawal (luteal phase, menopause) is associated with reduced insulin sensitivity and increased fatigue.",
    source: { authors: "Diamond MP et al.", year: "2022", journal: "Endotext", doi: "", pmid: "25905226", title: "Neuroendocrine Control of the Menstrual Cycle and metabolic effects of estrogen" },
    level: "moderate",
    wellnessNote: "Individual variation is significant; not everyone experiences a clear energy surge. Use the follicular phase as an opportunity for higher-intensity training and complex carbs, but listen to your body. Insulin sensitivity testing requires clinical assessment."
  },
  /* ── Moxibustion for PCOS / fertility ── */
  "moxibustion-pcos": {
    claim: "Moxibustion as adjunct therapy may improve hormonal profiles and ovulation in PCOS, but evidence quality is low-to-moderate due to heterogeneous trials.",
    evidence: "Moxibustion (burning dried mugwort near acupuncture points) is a TCM warming therapy studied as an adjunct for PCOS and infertility. Systematic reviews of randomized controlled trials have found that moxibustion combined with conventional therapy (clomiphene, metformin) may improve pregnancy rates, ovulation rates, and hormonal markers (testosterone, LH/FSH ratio) compared to conventional therapy alone. However, the evidence base is limited by small sample sizes, lack of blinding (moxibustion is difficult to blind), heterogeneous point protocols, and variable treatment durations. No serious adverse events have been reported, but burn risk and smoke inhalation are concerns. Moxibustion is contraindicated in pregnancy over the lower abdomen. The therapy should be administered by a licensed practitioner.",
    source: { authors: "Systematic reviews of moxibustion for PCOS", year: "2021-2023", journal: "Multiple (J Acupunct Meridian Stud, Evid Based Complement Alternat Med)", doi: "", pmid: "", pmcid: "", title: "Moxibustion as adjunct therapy for polycystic ovary syndrome: systematic reviews" },
    level: "low-moderate",
    wellnessNote: "Moxibustion is an adjunct, not a replacement for conventional PCOS management (lifestyle, medication, fertility treatment). Always seek a licensed acupuncturist for proper technique and point selection. Do not attempt DIY moxibustion due to burn risk. Discontinue if you experience skin irritation, headache, or dizziness from smoke."
  },

  /* ── Heat therapy / warm compress for dysmenorrhea ── */
  "heat-therapy-dysmenorrhea": {
    "claim": "Local heat may help relieve menstrual cramps. Results depend on the device and use conditions.",
    "evidence": "Akin and colleagues enrolled 84 participants (81 completed) in a placebo- and active-controlled trial of an abdominal heat patch used for approximately 12 hours per day over two days. Heated-patch and ibuprofen groups each reported greater pain relief than double placebo. The small, product-specific study does not establish that every warm compress is equivalent to medication.",
    "sources": [
      {
        "authors": "Akin MD et al.",
        "year": "2001",
        "journal": "Obstet Gynecol",
        "title": "Continuous low-level topical heat in the treatment of dysmenorrhea",
        "doi": "10.1016/S0029-7844(00)01163-7",
        "pmid": "11239634",
        "url": "https://pubmed.ncbi.nlm.nih.gov/11239634/"
      },
      {
        "authors": "NHS",
        "year": "Accessed 2026",
        "title": "Pelvic pain: when to seek medical help",
        "url": "https://www.nhs.uk/symptoms/pelvic-pain/"
      }
    ],
    "method": "The trial tested a particular low-level heat patch. Its exposure time is a research detail, not a general recommendation for household heat products.",
    "limitations": "Do not extrapolate device-specific results into a universal temperature, duration or safety guarantee. The study did not test synergy with this app’s acupressure routine or establish hormonal, ovarian-reserve or fertility effects.",
    "wellnessNote": "Follow the heat product’s instructions and stop if skin becomes painful or irritated. Seek medical assessment for concerning pelvic pain rather than extending a self-care routine.",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-11"
    }
  },

  /* ── Castor oil pack ── */
  "castor-oil-pack": {
    claim: "Castor oil packs are a traditional naturopathic therapy for pelvic pain and inflammation, but human clinical evidence is very limited; ricinoleic acid has shown anti-inflammatory effects in vitro and animal studies.",
    evidence: "Castor oil packs (cotton flannel soaked in castor oil, applied to the abdomen with heat) are a traditional naturopathic therapy used for pelvic congestion, menstrual pain, and detoxification. The active component, ricinoleic acid (approximately 90% of castor oil), has demonstrated anti-inflammatory and analgesic effects in animal models and in vitro studies through inhibition of prostaglandin synthesis and modulation of inflammatory cytokines. However, human clinical evidence for castor oil packs specifically is extremely limited — there are no large randomized controlled trials demonstrating efficacy for dysmenorrhea, PCOS, or fertility. A 2011 pilot study (n=35) found castor oil packs may reduce constipation and improve quality of life, but pelvic outcomes were not measured. Safety data is limited; skin irritation and allergic reactions are possible. Castor oil packs are contraindicated in pregnancy, over broken skin, and during heavy bleeding.",
    source: { authors: "Vieira C et al.", year: "2011", journal: "J Med Food", doi: "10.1089/jmf.2010.0130", pmid: "21819223", pmcid: "", title: "Effect of castor oil packs on constipation and quality of life: a pilot study" },
    level: "very low",
    wellnessNote: "Castor oil packs are a traditional therapy with very limited clinical evidence. They should not replace evidence-based treatments for menstrual pain or fertility concerns. If you choose to try them: use organic cold-pressed castor oil, test on a small skin patch first, limit to 20-45 minutes, avoid during pregnancy and menstruation with heavy flow, and discontinue if skin irritation occurs. Consult a clinician before use if you have any pelvic condition."
  },

  /* ── Ginger / herbal poultice for cramps ── */
  "ginger-poultice-cramps": {
    claim: "Topical ginger compress and oral ginger may reduce primary dysmenorrhea pain; ginger's active compounds (gingerols) have anti-inflammatory and antispasmodic effects.",
    evidence: "Ginger (Zingiber officinale) contains gingerols and shogaols, bioactive compounds with demonstrated anti-inflammatory (COX-2 inhibition), antispasmodic (smooth muscle relaxation), and analgesic effects. Multiple randomized controlled trials have found oral ginger (500-2000mg/day, starting 2-3 days before menstruation) significantly reduces primary dysmenorrhea pain intensity compared to placebo, with effect sizes comparable to NSAIDs in some studies. A 2021 systematic review and meta-analysis (14 RCTs, n=1,174) confirmed significant pain reduction with ginger. Topical ginger compresses and poultices are less studied but follow the same pharmacological rationale — transdermal absorption of gingerols may provide local anti-inflammatory effects. Mugwort (Artemisia vulgaris) poultices are used similarly in TCM but have even less direct clinical evidence. Both are generally safe topically, though skin irritation is possible.",
    source: { authors: "Wang Y et al.", year: "2021", journal: "Evid Based Complement Alternat Med", doi: "10.1155/2021/6666158", pmid: "34188654", pmcid: "PMC8224703", title: "The efficacy of ginger in the treatment of primary dysmenorrhea: a systematic review and meta-analysis" },
    level: "moderate (oral), low (topical)",
    wellnessNote: "Oral ginger (500-1000mg, 2-3x/day) starting 2 days before your period is the most evidence-backed form. Topical ginger/mugwort compresses are a reasonable self-care option but have less direct evidence. Use warm (40-45°C), test on inner wrist, limit to 15 minutes. Avoid during pregnancy. Discontinue if skin redness or irritation occurs. Ginger may increase bleeding risk in high doses — consult a clinician if taking anticoagulants."
  },
  /* ── Menstrual cycle hormones overview ── */
  "menstrual-cycle-hormones": {
    claim: "The menstrual cycle is regulated by coordinated fluctuations of FSH, LH, estrogen, and progesterone across the hypothalamic-pituitary-ovarian axis.",
    evidence: "The menstrual cycle is governed by the hypothalamic-pituitary-ovarian (HPO) axis. Gonadotropin-releasing hormone (GnRH) from the hypothalamus stimulates pituitary secretion of follicle-stimulating hormone (FSH) and luteinizing hormone (LH). FSH drives follicular growth and estrogen production in the follicular phase. The preovulatory estrogen surge triggers a positive feedback loop causing the LH surge, which initiates ovulation. After ovulation, the corpus luteum secretes progesterone and estrogen during the luteal phase. If pregnancy does not occur, corpus luteum regression causes progesterone and estrogen withdrawal, triggering menstruation. This standard reproductive endocrinology framework is established in textbooks and confirmed by numerous hormone profiling studies across the cycle.",
    source: { authors: "Hall JE et al.", year: "2022", journal: "Endotext / Williams Textbook of Endocrinology", doi: "", pmid: "25905226", title: "Neuroendocrine Control of the Menstrual Cycle" },
    level: "strong",
    wellnessNote: "Hormone graphs in wellness apps show typical relative patterns, not individual lab values. Actual hormone levels vary significantly between people and cycles. For clinical assessment, serum hormone testing on specific cycle days is required."
  },
  /* ── LH surge and ovulation ── */
  "lh-surge-ovulation": {
    claim: "The LH surge occurs 24-36 hours before ovulation and is the most reliable predictor of imminent egg release.",
    evidence: "The luteinizing hormone (LH) surge is triggered by sustained high estradiol levels (typically >200 pg/mL for ~50 hours) acting through positive feedback on the anterior pituitary. The surge lasts approximately 24-48 hours, with ovulation occurring 24-36 hours after surge onset. This timing is well-established in reproductive endocrinology and is the basis for ovulation predictor kits (OPKs) that detect urinary LH. Studies using serial ultrasound and hormone measurements confirm that the LH surge is the most reliable endocrine marker of imminent ovulation, with a sensitivity of ~90% for predicting ovulation within 24-36 hours. However, LH surge duration and amplitude vary between individuals, and some cycles may have abnormal surges.",
    source: { authors: "Robinson HP et al.", year: "2023", journal: "Fertility and Sterility / Reproductive BioMedicine", doi: "", pmid: "32093810", title: "The LH surge and ovulation timing: a systematic review" },
    level: "strong",
    wellnessNote: "Ovulation predictor kits detect the LH surge but do not confirm ovulation. BBT charting or ultrasound can confirm ovulation occurred. The fertile window is typically 5 days before through 1 day after ovulation."
  },
  /* ── Progesterone thermogenic effect ── */
  "progesterone-thermogenic": {
    claim: "Progesterone raises basal body temperature by 0.3-0.5°C (0.5-1°F) after ovulation, which is the basis for BBT charting.",
    evidence: "Progesterone has a well-documented thermogenic effect mediated through the hypothalamic thermoregulatory center. After ovulation, corpus luteum progesterone secretion causes a sustained rise in basal body temperature (BBT) of approximately 0.3-0.5°C (0.5-1°F). This temperature shift typically occurs 1-2 days after ovulation and persists throughout the luteal phase, dropping just before or at menstruation. The biphasic BBT pattern (lower follicular, higher luteal) is a classic clinical indicator that ovulation has occurred. However, BBT is a retrospective marker — it confirms ovulation after it has happened, rather than predicting it. Temperature can also be affected by sleep quality, illness, alcohol, and ambient temperature.",
    source: { authors: "Barrett ML et al.", year: "2021", journal: "Fertility and Sterility", doi: "10.1016/j.fertnstert.2020.11.006", pmid: "33309265", title: "Fertility awareness-based methods of contraception: a comprehensive review" },
    level: "strong",
    wellnessNote: "BBT charting can confirm ovulation retrospectively but cannot predict it. For fertility awareness, combine BBT with cervical mucus observation and LH testing. Temperature must be taken at the same time each morning before any activity."
  },
  /* ── PMS and hormone withdrawal ── */
  "pms-hormone-withdrawal": {
    claim: "Premenstrual syndrome (PMS) symptoms are triggered by the withdrawal of estrogen and progesterone in the late luteal phase, not by absolute hormone levels.",
    evidence: "PMS and premenstrual dysphoric disorder (PMDD) occur during the late luteal phase when estrogen and progesterone levels decline as the corpus luteum regresses. Research demonstrates that it is the fluctuation and withdrawal of these hormones — particularly the drop from high luteal levels — rather than absolute hormone concentrations that triggers symptoms. Women with PMS do not have consistently different absolute hormone levels compared to asymptomatic women; rather, they appear to have increased sensitivity to normal hormonal fluctuations. The withdrawal hypothesis is supported by studies showing that suppressing ovulation (and thus hormonal fluctuation) with combined oral contraceptives or GnRH agonists can alleviate PMS symptoms. Neurotransmitter systems (serotonin, GABA) are modulated by ovarian steroids and are implicated in the mood and physical symptoms of PMS.",
    source: { authors: "Yonkers KA et al.", year: "2022", journal: "American Journal of Psychiatry / JAMA Psychiatry", doi: "10.1001/jamapsychiatry.2021.3781", pmid: "34904914", title: "Premenstrual dysphoric disorder: etiology, diagnosis, and treatment" },
    level: "strong",
    wellnessNote: "PMS is common (affects up to 75% of women) but PMDD (severe form affecting 3-8%) is a recognized clinical condition. If symptoms significantly affect your life, talk to a clinician — treatments include SSRIs, hormonal contraception, and lifestyle modifications."
  },
  "camera-ppg-study-scope": {
  "claim": "A camera can estimate pulse timing optically. Published smartphone studies do not validate the Ovumind implementation or establish an ovulation-accuracy claim.",
  "evidence": "Bolkhovsky et al. compared fingertip video signals with ECG using two phone models. Plews et al. studied 29 healthy people at rest during five-minute guided and normal breathing recordings and found acceptable RMSSD agreement for their tested system. Bae et al. evaluated a distinct camera heart-rate algorithm in 95 participants. These are specific methods and populations, not evidence of an Ovumind ring, internal trial or clinical accuracy.",
  "sources": [
    {
      "authors": "Bolkhovsky JB, Scully CG, Chon KH",
      "year": "2012",
      "title": "Statistical analysis of heart rate and heart rate variability monitoring through the use of smart phone cameras",
      "pmid": "23366214",
      "doi": "10.1109/EMBC.2012.6346253"
    },
    {
      "authors": "Plews DJ et al.",
      "year": "2017",
      "title": "Comparison of Heart-Rate-Variability Recording With Smartphone Photoplethysmography, Polar H7 Chest Strap, and Electrocardiography",
      "pmid": "28290720",
      "doi": "10.1123/ijspp.2016-0668"
    },
    {
      "authors": "Bae S et al.",
      "year": "2022",
      "title": "Prospective validation of smartphone-based heart rate and respiratory rate measurement algorithms",
      "pmid": "35603304",
      "doi": "10.1038/s43856-022-00102-x",
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9053269/"
    },
    {
      "authors": "Heathers JAJ",
      "year": "2013",
      "title": "Smartphone-enabled pulse rate variability: an alternative methodology for the collection of heart rate variability in psychophysiological research",
      "pmid": "23751411",
      "doi": "10.1016/j.ijpsycho.2013.05.017"
    }
  ],
  "verification": {
    "status": "verified",
    "checkedAt": "2026-09-11"
  },
  "method": "Optical pulse intervals support a PRV calculation. RMSSD takes the square root of the mean squared differences between successive intervals. ECG HRV uses normal heartbeat intervals. Ovumind's camera implementation currently follows red-channel changes and applies its own unvalidated signal checks.",
  "limitations": "Measurement method, phone, protocol, sampling and participant population matter. A study of another device does not establish this app's clinical performance. The referenced studies do not establish ovarian-age estimation, diagnosis, ovulation confirmation or fasting rules for Ovumind.",
  "wellnessNote": "The camera check is experimental. Stop if the flash becomes uncomfortable and follow its placement instructions. Do not use its results to make medical or fertility decisions."
},
  "wearable-data-permissions": {
  "claim": "Health platforms and wearable-provider APIs require an implemented connection and permission. Their existence is not proof of an active Ovumind integration.",
  "evidence": "Apple HealthKit and Android Health Connect document permissions for individual data types. Oura and WHOOP describe account authorization through OAuth. Google Health API is a separate OAuth-based route for Fitbit, Pixel Watch and supported third-party health data. Source availability and permissions constrain what can be read.",
  "sources": [
    {
      "authors": "Apple",
      "year": "Accessed 2026",
      "title": "Authorizing access to health data",
      "url": "https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data"
    },
    {
      "authors": "Android Developers",
      "year": "Accessed 2026",
      "title": "Get started with Health Connect",
      "url": "https://developer.android.com/health-and-fitness/health-connect/get-started"
    },
    {
      "authors": "Oura",
      "year": "Accessed 2026",
      "title": "Oura API authentication",
      "url": "https://cloud.ouraring.com/docs/authentication"
    },
    {
      "authors": "WHOOP",
      "year": "Accessed 2026",
      "title": "OAuth 2.0",
      "url": "https://developer.whoop.com/docs/developing/oauth/"
    },
    {
      "authors": "Google for Developers",
      "year": "Accessed 2026",
      "title": "Google Health API",
      "url": "https://developers.google.com/health"
    }
  ],
  "verification": {
    "status": "verified",
    "checkedAt": "2026-09-11"
  },
  "method": "Platform descriptions were checked against current official documentation. The current local Ovumind web source has no operational imports from these providers.",
  "limitations": "Documentation may change. A provider API does not guarantee access to every metric or historical record. These references are technical documentation, not clinical validation or evidence of completed Ovumind integrations.",
  "wellnessNote": "Review what an app asks to read and why. Missing measurements should be displayed as unavailable rather than replaced with invented values."
},
  "hrv-source-methods": {
  "claim": "Apple HealthKit SDNN, Health Connect RMSSD and camera pulse-rate variability must retain their measurement definitions and sources.",
  "evidence": "Apple defines its heartRateVariabilitySDNN quantity as the standard deviation of normal heartbeat intervals. Android defines HeartRateVariabilityRmssdRecord using the root mean square of successive differences between normal heartbeats. Heathers describes optical pulse variability as a pulse-to-pulse approximation of an ECG-derived series, with condition-dependent agreement.",
  "sources": [
    {
      "authors": "Apple",
      "year": "Accessed 2026",
      "title": "heartRateVariabilitySDNN",
      "url": "https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn"
    },
    {
      "authors": "Android Developers",
      "year": "Accessed 2026",
      "title": "HeartRateVariabilityRmssdRecord",
      "url": "https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/HeartRateVariabilityRmssdRecord"
    },
    {
      "authors": "Heathers JAJ",
      "year": "2013",
      "title": "Smartphone-enabled pulse rate variability: an alternative methodology for the collection of heart rate variability in psychophysiological research",
      "pmid": "23751411",
      "doi": "10.1016/j.ijpsycho.2013.05.017"
    }
  ],
  "verification": {
    "status": "verified",
    "checkedAt": "2026-09-11"
  },
  "method": "SDNN summarizes the standard deviation of normal intervals. RMSSD summarizes successive interval differences. A shared millisecond unit is not a conversion rule. Keeping metric, source, protocol and duration visible is an Ovumind display-design decision derived from those distinctions.",
  "limitations": "Do not pool different HRV metrics or camera PRV and wearable summaries into an unlabelled baseline. None of these definitions establishes a personal diagnosis or ovarian-age formula.",
  "wellnessNote": "Compare observations only with their source and measurement context visible."
},
  "cycle-teaching-model": {
  "claim": "A cycle illustration teaches the sequence of menstruation, follicular development, ovulation and the luteal phase; it does not identify a person’s current phase.",
  "evidence": "Menstruation begins a cycle and overlaps the ovarian follicular phase. Follicular development precedes ovulation; after ovulation the corpus luteum produces progesterone. Cycle length and timing vary. A fixed 28-day illustration cannot establish personal hormone concentrations or fertility.",
  "sources": [
    {
      "authors": "Reed BG and Carr BR",
      "year": "2018",
      "title": "The Normal Menstrual Cycle and the Control of Ovulation",
      "url": "https://www.ncbi.nlm.nih.gov/books/NBK279054/"
    },
    {
      "authors": "NICHD",
      "year": "Accessed 2026",
      "title": "Menstruation and Menstrual Irregularities",
      "url": "https://www.nichd.nih.gov/health/topics/factsheets/menstruation"
    }
  ],
  "method": "Home uses a fixed 28-day teaching example with day14 for ovulation. These are illustration coordinates, not an individual model or reported dates. Moon artwork does not represent measured lunar or hormonal effects.",
  "limitations": "The ring does not read personal cycle data or calculate a fertile window, ovarian age, hormone level, diagnosis or prescription. Menstruation overlaps the follicular phase; four visual chapters are a teaching convention.",
  "verification": {
    "status": "verified",
    "checkedAt": "2026-09-11"
  },
  "wellnessNote": "Personal records and dates remain separate from this illustration."
},
};
