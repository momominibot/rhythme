/* Atlas source records. Source checks are not clinical validation of this app.
   The illustrations are original orientation schematics, not WHO artwork.
   Root integration can copy ACUPOINT_EVIDENCE into the shared evidence database. */
(function () {
  'use strict';
  var checkedAt = '2026-09-30';
  var who = {
    authors: 'World Health Organization, Regional Office for the Western Pacific',
    year: 2008,
    title: 'WHO Standard Acupuncture Point Locations in the Western Pacific Region (2009 updated reprint)',
    url: 'https://iris.who.int/server/api/core/bitstreams/d98c1c98-3fbf-4e4e-8c9a-1bbe72ccd00e/content'
  };
  var nccih = {
    authors: 'National Center for Complementary and Integrative Health',
    title: 'Acupuncture: Effectiveness and Safety',
    url: 'https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety'
  };
  var clinicalNote = 'Educational source summary only. An appropriately qualified clinician has not yet reviewed this atlas. It does not diagnose a condition or prescribe a treatment.';
  window.ACUPOINT_EVIDENCE = {
    'atlas-who-landmarks': {
      claim: 'Written landmarks use the WHO location standard. Markers on this page are approximate orientation aids.',
      evidence: 'The complete WHO standard was checked for the 13 listed point codes and printed pages. B-cun denotes proportional body measurement, not a fixed length. No WHO illustration has been reproduced.',
      sources: [who],
      method: {
        name: 'Written landmark reference with original schematic navigation',
        description: 'SP6 p72; CV4 p221; ST36 p64; LR3 p193; LI4 p35; PC6 p159; CV6 p222; CV3 p221; ST29 p60; SP10 p74; KI3 p137; BL23 p111; GV4 p205.',
        inputs: 'Point code, named landmarks, body-proportional distances and appropriate body surface',
        units: 'B-cun when specified by WHO',
        version: 'Atlas draft 2026-09-30; WHO 2008 standard, 2009 reprint'
      },
      limitations: 'Reading a location standard does not validate a diagram, prove treatment efficacy or establish safe placement on an individual. Body proportions and palpated landmarks vary. The drawings require qualified anatomical and clinical review before any treatment-guidance use.',
      wellnessNote: clinicalNote,
      verification: {status: 'verified', checkedAt: checkedAt}
    },
    'atlas-traditional-rationale': {
      claim: 'Channel names describe the traditional classification of an acupoint.',
      evidence: 'A standardized name and location are not evidence that stimulating the point changes an organ, ovarian reserve, egg quality or hormones. This atlas records classification without asserting a point-specific health effect.',
      sources: [who, nccih],
      method: {name: 'Separate nomenclature from clinical outcomes', description: 'Therapeutic research must match the studied population, intervention, comparator and outcome. A point included in a combined protocol cannot be credited with the whole protocol result.'},
      limitations: 'The atlas has not established individual benefit, a dose, frequency, a physiological mechanism or a self-treatment routine for the selected point.',
      wellnessNote: clinicalNote,
      verification: {status: 'verified', checkedAt: checkedAt}
    },
    'atlas-period-pain': {
      claim: 'Research on acupressure for primary period pain is promising but remains limited.',
      evidence: 'A 2025 review reported pain improvement but described the evidence as low quality, with sparse adverse-event reporting. A 2024 SP6 review found heterogeneous results. A 2025 single-center trial tested combined LI4, ST36 and SP6 in 56 adolescents; it cannot isolate any one point. Older Cochrane evidence was inconclusive.',
      sources: [
        {authors: 'Yu X et al.', year: 2025, journal: 'Complementary Therapies in Medicine', title: 'Efficacy and safety of acupressure for primary dysmenorrhea: A systematic review and meta-analysis of randomized controlled trials', doi: '10.1016/j.ctim.2025.103272', pmid: '41138782', url: 'https://pubmed.ncbi.nlm.nih.gov/41138782/'},
        {authors: 'Ravi P et al.', year: 2024, journal: 'Medical Acupuncture', title: 'Effect of Sanyinjiao (Spleen-6) Acupoint for Pain Management in Primary Dysmenorrhea: An Updated Systematic Review and Meta-Analysis', doi: '10.1089/acu.2023.0100', pmid: '39309625', url: 'https://pubmed.ncbi.nlm.nih.gov/39309625/'},
        {authors: 'Aksoy-Can A, Buldum A, Abic A, Vefikulucay-Yilmaz D', year: 2025, journal: 'BMC Complementary Medicine and Therapies', title: 'The effect of acupressure on pain, menstrual symptoms, and comfort in adolescents with primary dysmenorrhea: a single-blind randomized controlled trial', doi: '10.1186/s12906-025-04965-0', pmid: '40605053', url: 'https://link.springer.com/article/10.1186/s12906-025-04965-0'},
        {authors: 'Smith CA et al.', year: 2016, journal: 'Cochrane Database of Systematic Reviews', title: 'Acupuncture for dysmenorrhoea', doi: '10.1002/14651858.CD007854.pub3', url: 'https://www.cochrane.org/evidence/CD007854_acupuncture-period-pain'}
      ],
      method: {name: 'Population and intervention matching', population: 'Studies of primary dysmenorrhea, not an evaluation of undiagnosed pelvic pain or fertility', description: 'No protocol or personal symptom-treatment score is calculated from these studies.'},
      limitations: 'The 2025 and 2024 review abstracts were read; full review appraisal remains pending. The 2025 adolescent trial full text was read: small single-center sample, uncertain adherence, variable pressure, and incomplete information about concurrent analgesic use. These results cannot validate the atlas, prove long-term safety, or be generalized to secondary causes of pain.',
      wellnessNote: 'Pain that limits daily life, persists or changes deserves clinical assessment. Do not substitute this atlas for evaluation of pelvic pain.',
      verification: {status: 'pending', checkedAt: checkedAt}
    },
    'atlas-fertility': {
      claim: 'This atlas does not establish an improvement in ovarian reserve, egg quality or pregnancy chances.',
      evidence: 'The 2025 Cochrane PCOS review found no clear fertility-outcome difference between acupuncture and sham, with important uncertainty. NCCIH reports no pregnancy or live-birth advantage over sham in its cited IVF review. These are acupuncture findings, not trials proving benefit from pressing a listed point.',
      sources: [
        {authors: 'Zhang GS, Lim ECN, Cheng NCL, Lim CED', year: 2025, journal: 'Cochrane Database of Systematic Reviews', title: 'Acupuncture for polycystic ovary syndrome', doi: '10.1002/14651858.CD007689.pub5', url: 'https://www.cochrane.org/evidence/CD007689_what-are-benefits-and-harms-acupuncture-women-polycystic-ovary-syndrome'},
        nccih
      ],
      method: {name: 'Use patient-important fertility outcomes', inputs: 'Live birth, clinical pregnancy and ovulation where reported', description: 'A change in a surrogate marker or inclusion of a point in a study is not proof of improved fertility.'},
      limitations: 'Uncertain evidence is not proof that all effects are absent. Cochrane reports low or very low certainty for many outcomes and possible adverse effects. Its displayed plain-language and abstract study totals differ, so this app does not repeat a total. This page does not measure ovarian age or reserve.',
      wellnessNote: 'Discuss complementary treatment with your fertility team, including medicines and the timing of procedures. Continue the care plan agreed with them.',
      verification: {status: 'verified', checkedAt: checkedAt}
    },
    'atlas-menopause': {
      claim: 'Current guidance distinguishes manual acupuncture, electroacupuncture and acupressure, and does not establish a hot-flash benefit from pressing these points.',
      evidence: 'The IMS full guidance posted in March 2026 finds insufficient evidence for manual acupuncture for vasomotor symptoms, while allowing clinician discussion of electroacupuncture with low-certainty evidence. The 2023 Menopause Society statement does not recommend acupuncture for vasomotor symptoms. Recommendations differ in emphasis and are not a point-specific self-care prescription.',
      sources: [
        {authors: 'International Menopause Society Recommendations Writing Group', year: 2026, title: 'Recommendations and Key Messages on Women\u2019s Midlife Health and Menopause, full online guidance, Section 24', url: 'https://www.imsociety.org/wp-content/uploads/2026/03/IMS-Recommendations-Full-Document.pdf'},
        {authors: 'The North American Menopause Society Advisory Panel', year: 2023, journal: 'Menopause', title: 'The 2023 nonhormone therapy position statement of The North American Menopause Society', doi: '10.1097/GME.0000000000002200', pmid: '37252752', url: 'https://pubmed.ncbi.nlm.nih.gov/37252752/'},
        nccih
      ],
      method: {name: 'Guideline comparison with intervention distinctions', description: 'IMS Section 24, printed pages 218 and 225; consider comparator and symptom outcome rather than treating all complementary therapies as equivalent.'},
      limitations: 'IMS discusses some complementary options that the Menopause Society does not recommend for hot flashes. Neither validates the atlas or proves that KI3, SP6 or another single point changes ovarian reserve or menopausal hormones. These treatment discussions belong with a qualified clinician.',
      wellnessNote: 'If symptoms interfere with sleep or daily life, a clinician can help compare established hormonal and nonhormonal options that fit your history and preferences.',
      verification: {status: 'verified', checkedAt: checkedAt}
    },
    'atlas-safety': {
      claim: 'This atlas does not certify any point as safe for pregnancy or prescribe needles, moxa or a pressure routine.',
      evidence: 'NCCIH describes serious complications from improper acupuncture delivery. NHS guidance advises discussing health conditions, medicines and other complementary treatments with qualified providers. This app uses a conservative referral boundary rather than inferring point safety from missing harm reports.',
      sources: [nccih, {authors: 'NHS', year: 2026, title: 'Herbal medicines and complementary therapies', url: 'https://www.nhs.uk/tests-and-treatments/herbal-medicines-and-complementary-therapies/'}],
      method: {name: 'No individualized treatment certification', description: 'Pregnancy, possible pregnancy, recent birth and fertility treatment prompt a discussion with the care team. There are no needle-depth, moxa-duration or pressure-dose instructions.'},
      limitations: 'Evidence about trained acupuncture practice cannot establish safety for self-applied pressure, home heat or a specific pregnancy circumstance. Personal contraindications and medication interactions require individual assessment.',
      wellnessNote: 'Use the atlas to prepare questions for your care team. Do not self-needle or replace prescribed care.',
      verification: {status: 'verified', checkedAt: checkedAt}
    },
    'atlas-red-flags': {
      claim: 'Some pelvic-pain symptoms need urgent assessment before trying a comfort practice.',
      evidence: 'NHS pelvic-pain guidance distinguishes pregnancy-related urgent advice from emergency symptoms such as severe or worsening pain, fainting, shoulder-tip pain, breathing difficulty or heavy vaginal bleeding.',
      sources: [{authors: 'NHS', year: 2025, title: 'Pelvic pain', url: 'https://www.nhs.uk/symptoms/pelvic-pain/'}],
      method: {name: 'General referral information', description: 'This page does not triage symptoms or estimate an emergency probability. Local urgent and emergency services should be used.'},
      limitations: 'The list is not exhaustive. Pelvic pain has several possible causes; this app cannot determine which applies. NHS service numbers are UK-specific and are not used as universal contacts.',
      wellnessNote: 'Do not delay emergency assessment to consult an app or try an acupoint. Recurrent or persistent pain also warrants a medical appointment.',
      verification: {status: 'verified', checkedAt: checkedAt}
    },
    'atlas-source-license': {
      claim: 'BodyParts3D is a linked external anatomy resource. Its models are not embedded in this page.',
      evidence: 'The archive license page, updated 27 February 2025, specifies CC BY 4.0 for its database. The exact attribution requested by the archive is visible beside the link. Ovuluna\u2019s orientation drawings are original schematics and are not derived from a BodyParts3D model or WHO figure.',
      sources: [
        {authors: 'Database Center for Life Science; LSDB Archive', year: 2025, title: 'BodyParts3D license', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html'},
        {authors: 'Creative Commons', title: 'Attribution 4.0 International (CC BY 4.0)', url: 'https://creativecommons.org/licenses/by/4.0/'}
      ],
      method: {name: 'Resource licensing checked separately from clinical accuracy', description: 'Future imported or modified assets need source attribution, a license link and an indication of changes. Availability under an open license does not validate anatomy or acupoint mapping.'},
      limitations: 'Third-party adaptations of BodyParts3D may carry different licenses. No Z-Anatomy package or Wikimedia image is shipped by this atlas. The original drawings are labeled approximate and require clinical review.',
      wellnessNote: 'Dreamy decorative art can support the interface; it is not an anatomical evidence source.',
      verification: {status: 'verified', checkedAt: checkedAt}
    }
  };
  // Keep this page functional until the parent integrates the records centrally.
  Object.assign(window.EVIDENCE_DB || (window.EVIDENCE_DB = {}), window.ACUPOINT_EVIDENCE);
}());
