# TCM menstrual-comfort source corrections

Integrated 11 September 2026 in the Doubao continuation. This is a bounded review of three evidence records and the TCM hub, not clinical approval of a pressure routine or a systematic review through 2026.

## Corrected records

| Record | Checked source and correction | Interpretation boundary |
| --- | --- | --- |
| `sp6-acupressure-cramps` | [Charandabi et al., 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3583102/): 72 students, dormitory cluster allocation, two treated cycles after baseline. The instructed protocol totaled 20 minutes across both legs. PMID 23450186. | Small selected population, self-report and no sham control; no optimal personal schedule established. The trial does not validate Ovuluna. |
| `acupressure-dysmenorrhea-meta` | [Armour et al., 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6337810/): 13 acupressure studies, 1,086 participants; g=0.56, 95% CI 0.10–1.03, I²=92.5%. Correct DOI 10.1186/s12906-019-2433-8 and PMID 30654775. | Considerable variation and bias concerns; analgesic comparisons favored medication; adverse-event reporting was sparse. No blanket safety or efficacy claim. |
| `heat-therapy-dysmenorrhea` | [Akin et al., 2001](https://pubmed.ncbi.nlm.nih.gov/11239634/): 84 enrolled, 81 completed; a specific abdominal heat patch used approximately 12 hours/day for two days. Correct DOI 10.1016/S0029-7844(00)01163-7. | The device trial does not establish equivalence for every warm compress, a universal safe temperature/duration, or synergy with acupressure. |

All three whole records were replaced after exact old-record checks, removing their stale authors, identifiers, certainty grades and unsupported wellness instructions. A semantic comparison confirmed every other record was unchanged at that integration step. Verified URLs and PMID links now render for SP6; PMCID-only metadata previously produced no usable primary link. “Source checked” describes citation review, not clinical validation.

## Hub changes

The original cards, theme and navigation are retained. SP6 instructions now describe the actual historical study, rather than directing users to produce an aching sensation. The CV4 card links the [Behbahani et al. combined CV4/CV2 trial](https://pubmed.ncbi.nlm.nih.gov/28250781/), which tested a 20-minute protocol across two cycles. It does not isolate CV4, test the former brief circular massage, or establish pregnancy safety. The accessible abstract and metadata were checked; detailed full methods remain pending. No new evidence-database key was added.

Traditional meridian/Qi descriptions are explicitly labeled and no longer presented as measured uterine, hormonal, immune or fertility effects. The five points are a reference collection, with the invented five-minute treatment and sequence removed. Other point-specific benefits and schedules were not established in this review. The heat card now opens the corrected evidence record.

The prior heavy-bleeding advice to use gentler abdominal pressure and SP8 advice for sudden severe pain were removed. [NHS pelvic-pain guidance](https://www.nhs.uk/symptoms/pelvic-pain/) supports urgent advice for possible pregnancy with pelvic pain, and emergency assessment for severe/worsening pelvic pain, fainting or heavy vaginal bleeding. [NHS period-pain guidance](https://www.nhs.uk/symptoms/period-pain/) supports review when symptoms disrupt life or become heavier, irregular or more painful. The app uses general care wording rather than importing UK service numbers into another market.

## Verification and remaining work

- Primary source identities, population/protocol details and the meta-analysis numbers were reread independently during integration. Akin's abstract was retrieved through PubMed's indexed abstract after its plain URL initially returned an empty body.
- Bounded integration checks: all three expected replacement records match; all hub evidence keys resolve; CV4 and medical-guidance links are present; former harmful/unsupported instructions are absent. Receipt: `tcm-source-consistency.json`.
- No pressure efficacy, ovarian-age formula, fertility benefit, pregnancy safety or whole-app clinical approval is claimed. Remaining legacy TCM pages and evidence records, point-location diagrams, actual self-care instructions and pregnancy safeguards require qualified review. App-level UI/native verification belongs to the parent integration pass.
- Nothing committed, pushed or deployed by this subtask.
