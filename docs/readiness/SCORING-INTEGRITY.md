# Scoring and record integrity — 11 September 2026

This pass fixes demonstrated software and data-integrity failures. It does **not** establish a clinically validated ovarian-age model, complete all-app accessibility, or approve an iOS release.

## Ovarian assessment

The old code converted skipped periods into a 1.5-year menopause countdown, used arbitrary lifestyle/AMH age offsets, and substituted 30 for a blank age. Those rules have been removed from the executable model. `ovarian-model.js` now validates actual age, cycle context and optional dated/unit-aware AMH, with missing answers retained as missing. No persona substitutes an age or a reproductive stage.

The result contract distinguishes `invalid-input`, `insufficient-data`, `unsupported-context`, and `unavailable-model`. It retains input/provenance/version metadata. Predictions remain unavailable because an appropriate validated model is not supplied or established; this is an explicit unresolved product requirement, not a claim that ovarian scoring is complete.

The assessment page provides input review, explicit local saving, restored-input review and JSON export. Home summarizes the same v2 record contract. The keys `ov_result` and `ovuluna_ovarian_age` are preserved without displaying their unsupported predictions. New data uses `ovuluna_ovarian_assessments_v2`. Invalid or unknown stored formats block writes rather than being silently replaced.

The measurement/prediction distinction is supported by [ASRM’s reserve guidance](https://www.asrm.org/practice-guidance/practice-committee-documents/testing-and-interpreting-measures-of-ovarian-reserve-a-committee-opinion-2020/) and [ACOG Opinion 773](https://pubmed.ncbi.nlm.nih.gov/30913198/). Neither source validates Ovuluna’s former composite age rules.

## Lab records and shared summaries

Lab entry requires the result symbol, compatible unit and actual collection date. It rejects blank, negative, nonfinite and malformed values; AFC must be a whole count. Optional report limits support a literal numeric comparison only. A bounded result such as `<0.1` is retained as a bound, never converted into an exact measurement. Source/assay/context remain attached to the record.

`ovuluna_lab_records_v1` contains dated, editable records. The earlier `ovuluna_labs` snapshot is untouched and downloadable separately; its save time is not represented as a collection date. Insights and Overview now show real saved lab/journal/assessment entries or explicit unavailable states. Fabricated HRV trends, inflammation analysis, wearable percentages, personal nutrition/exercise prescriptions and placeholder actions were removed from these two pages. This does not mean every other page’s medical copy has been reviewed.

## Biological-age research reference

The Bio-Age screen is now driven by nine explicitly entered blood markers and age at the draw. It is the **clinical PhenoAge research model**, distinct from ovarian age and the DNA-methylation model DNAm PhenoAge. Inputs are not imported from assumed wearable/lab connections. Numeric calculation does not itself save health data.

The implementation deliberately follows [Levine et al., Aging 2018](https://www.aging-us.com/article/101414/text), [Supplement 1, pp. 1–2 and Table S1](https://cdn.aging-us.com/article/101414/supplementary/SD1/0/aging-v10i4-101414-supplementary-material-SD1.pdf), using its published rounded coefficients. Taking logarithms directly avoids cancellation when the intermediate mortality CDF rounds to one. An independent 65-digit Decimal calculation using the original CDF and inverse gives **33.0056876420093152** for the synthetic fixture: age40, albumin42g/L, creatinine70µmol/L, glucose5.1mmol/L, CRP0.1mg/dL, lymphocytes32%, MCV90fL, RDW-CV13%, ALP70U/L, WBC6×10³/µL.

**Published equation traced:** the original Aging supplement explicitly uses `0.090165`; the separate [2019 PLOS correction](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002760) prints `0.09165`. Original equations, the public author-confirmation trail and the BioAge maintainer’s restoration support retaining the coherent rounded Aging set. See [the method resolution](PHENOAGE-METHOD-RESOLUTION.md) and `scripts/check-phenoage-reference.py`. No coefficient or saved method version changed. This resolves which published equation the app reproduces; clinical applicability and individual/app validation remain open. The [companion cohort study](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002718) provides research context, not an ovarian-age endpoint.

Creatinine conversion is checked against [NIDDK](https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults). The glucose factor18.0182 is corroborated in the figure captions of a [primary clinical study](https://pubmed.ncbi.nlm.nih.gov/22294813/); that reference is used only for the conversion, not to support an aging claim. Original reported units and normalized values are available in the result. Software input/output limits are not presented as validated clinical intervals. No habit-to-age score, healthy/risk category, fasting action or treatment recommendation is produced.

## Verification and next release gates

Reproducible entry points: `node scripts/check-ovarian.cjs`, `node scripts/check-labs.cjs`, `node scripts/check-insights-records.cjs`, `node scripts/check-bio-age.cjs`, and `node scripts/check-site.cjs`. Receipts accompany this file. Browser checks use synthetic data on `localhost:4194`, separate from the user’s `127.0.0.1:4194` storage origin.

Next requirements remain: select/validate the intended ovarian prediction model; establish clinical applicability of the specified research method; review all remaining health claims; inventory every rendered metric/advice and its checked evidence; consolidate remaining page shells and Dynamic Type/safe areas; finish camera/device accuracy, secure storage/auth/account/community checks, signed native packaging, and the exact-build submission review. See `docs/IOS-APP-STORE-PLAN.md` for the full scope. Local storage is a development record flow, not a protected production clinical datastore.
