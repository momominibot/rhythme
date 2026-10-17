# Clinical PhenotypicAge equation resolution

Reviewed 11 September 2026 against Ovuluna baseline `3c6fefb`. Scope: mathematical/source fidelity of `bio-age.js`; no production calculation changed in this review.

## Decision

**Retain `0.090165` and the coherent, rounded Aging 2018 coefficient set already implemented.** The earlier “unresolved publication discrepancy” can be replaced by this traced resolution. The original supplement is internally explicit, and subsequent public author-confirmation reports and the BioAge maintainer’s actual source restoration support its denominator. This establishes which published equation Ovuluna reproduces; it does not establish clinical approval, app validation, or an ovarian-age model.

Keep model identifier `levine-2018-published-coefficients-v1`. Do not relabel its output as exact equivalence to every PhenoAge calculator: some use additional coefficient digits or the different denominator. No numerical migration is needed for current records.

## What the primary publications actually print

The original [Levine et al., Aging 2018 paper](https://www.aging-us.com/article/101414/text) develops clinical PhenotypicAge, then uses it as the target for a **separate 513-CpG DNAm predictor**. The [original Supplement 1](https://cdn.aging-us.com/article/101414/supplementary/SD1/0/aging-v10i4-101414-supplementary-material-SD1.pdf) provides the clinical equations on pages 1–2 and coefficients/units in Table S1, page 10. Both occurrences of the final equation have denominator `0.090165`.

The [February 2019 PLOS correction](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002760) corrects the missing mortality-score step in [Liu et al.’s December 2018 PLOS paper](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002718). It is **not an erratum to the Aging paper**. Its printed equation does contain `0.09165`. It does not describe a newly trained model, a conversion between clinical and DNAm PhenoAge, or a “PhenoAge2” release. Do not infer any of those explanations.

| Parameter | Aging 2018 supplement / current Ovuluna | Literal PLOS correction |
|---|---:|---:|
| Linear predictor intercept | −19.9067 | −19.907 |
| ALP coefficient | 0.0019 | 0.00188 |
| Multivariable Gompertz gamma | 0.0076927 (p. 2) | 0.0076927 |
| CDF numerator factor | exp(120 × gamma) − 1 | 1.51714 |
| Final age intercept | 141.50225 | 141.50 |
| Final log multiplier | 0.00553 | 0.00553 |
| Final age denominator | **0.090165** | **0.09165** |

The CDF factor evaluates to `1.51714167042928988989743327079856…`; `1.51714` is its rounded shortcut. Table S1 also rounds gamma to `0.0077`; use the more explicit `0.0076927` from the supplementary methods. The denominator difference is not this kind of rounding. Visual inspection of the correction PDF confirmed there is **no additional `1 +` or `1 −` inside the outer logarithm**; one search-text extraction incorrectly inserted one.

## Source-code and author-confirmation trail

1. In [ajsteele/bioage issue 3](https://github.com/ajsteele/bioage/issues/3#issuecomment-2756995731), the person who contacted Morgan Levine reported on **27 March 2025** that she confirmed `0.090165`. This is a public report of correspondence, not a statement posted by Levine’s own authenticated account.
2. The March 2026 [proposed change in PR 8](https://github.com/ajsteele/bioage/pull/8) initially argued for `0.09165`, then its author withdrew that argument after tracing the confirmation and original supplement. The closed proposal’s initial description must not be treated as the final finding.
3. [BioAge issue 22](https://github.com/dayoonkwon/BioAge/issues/22) led to a change to `0.09165` in October 2023. In [PR 55](https://github.com/dayoonkwon/BioAge/pull/55), the package maintainer acknowledged the subsequent clarification. The [actual restoration commit](https://github.com/dayoonkwon/BioAge/commit/1189096c8a96ed1eb4813b55f5d9d5191e6bfe58) on **2 April 2026** changes `.09165` back to `.090165`. A same-day revert was followed by [reapplication](https://github.com/dayoonkwon/BioAge/commit/7e7764fc432115ee9d59f281d4f6ca17177ae7ec).
4. The current [pinned BioAge implementation](https://github.com/dayoonkwon/BioAge/blob/b1f9fc02f086cd4aa74185f2335ab1366082e7fe/R/phenoage_calc.R#L105) therefore uses `.090165`. Its `orig = TRUE` branch is the relevant fixed original-model calculation; the other branch trains/projects a model and is not a fixed reference equation.

Authorship qualification: [BioAge identifies Dayoon Kwon and Daniel Belsky as package authors](https://github.com/dayoonkwon/BioAge/blob/b1f9fc02f086cd4aa74185f2335ab1366082e7fe/DESCRIPTION). They are not the original Aging 2018 paper’s authors. No directly authored clinical-lab calculator from the original authors was established in this search. The [MorganLevineLab repository](https://github.com/MorganLevineLab/prcPhenoAge) that was retrieved concerns methylation CpGs, not this clinical blood-panel equation. BioAge is useful corroborating implementation evidence, not a substitute for the original supplement.

**Confidence:** high that `0.090165` is the intended original clinical PhenotypicAge denominator and that current Ovuluna reproduces the specified rounded publication. The public confirmation is mediated correspondence; the journal correction remains unchanged. This review does not independently authenticate a private email or reconstruct the original NHANES model fit.

## Exact implemented equation and numerical distinction

Inputs: albumin g/L; creatinine µmol/L; glucose mmol/L; CRP mg/dL; lymphocytes percent; MCV fL; RDW-CV percent; ALP U/L; WBC thousands of cells/µL; age in years.

```text
xb = −19.9067 − 0.0336 albumin + 0.0095 creatinine + 0.1953 glucose
     + 0.0954 ln(CRP) − 0.0120 lymphocyte% + 0.0268 MCV
     + 0.3306 RDW% + 0.0019 ALP + 0.0554 WBC + 0.0804 age
H = exp(xb) × [exp(120 × 0.0076927) − 1] / 0.0076927
M = 1 − exp(−H)
PhenotypicAge = 141.50225 + ln[−0.00553 × ln(1 − M)] / 0.090165
```

Here `H` is cumulative hazard and `M` is the 120-month mortality CDF used as an intermediate. Neither is an ovarian attribute. Gamma controls time in the multivariable hazard model; the final age mapping comes from the second, age-only model. `0.0804` is the chronological-age term in `xb`, not the final inverse denominator. These parameters cannot be swapped.

Since `−ln(1 − M) = H`, current Ovuluna evaluates `ln(H)` directly. That is algebraically equivalent and avoids floating-point saturation of `M` at one. It is not a new clinical model.

BioAge’s pinned original branch uses more digits in **all** predictor weights (listed in the companion reference script), `gamma = 0.007692696`, `1.51714`, and `0.0055305`. Those are not the exact printed rounded set. Do not selectively import its extra digits while still asserting exact reproduction of the printed equation; the precision/provenance choice should be versioned if deliberately changed later.

## Reproduced fixtures and conversions

The standalone [reference script](../../scripts/check-phenoage-reference.py) evaluates the original CDF and inverse with Python Decimal precision 65, independently of the app’s logarithmic simplification. It then invokes the actual `bio-age.js` API in isolated Node and requires agreement within `1e-10` years.

Synthetic source-unit fixture: age 40; albumin 42; creatinine 70; glucose 5.1; CRP 0.1; lymphocytes 32; MCV 90; RDW 13; ALP 70; WBC 6, using the units above.

| Calculation | Result, years |
|---|---:|
| Original supplement / current Ovuluna | **33.0056876420093152** |
| Literal PLOS correction, all its printed parameters | 34.7428407414516904 |
| Only substitute denominator `0.09165` | 34.7636515820160383 |
| Pinned BioAge original branch, additional precision | 32.9401147308701106 |

Original-fixture intermediates: `xb = −9.869336617871631958…`, `H = 0.010203493864992347…`, `M = 0.010151614820567408…`. These are reproducibility figures, not clinical risk estimates for an actual person.

Conventional-unit fixture: keep the other markers above; use albumin **4.2 g/dL × 10 = 42 g/L**, creatinine **0.8 mg/dL × 88.4 = 70.72 µmol/L**, glucose **91.89282 mg/dL ÷ 18.0182 = 5.1 mmol/L**, CRP **1 mg/L ÷ 10 = 0.1 mg/dL**, WBC **6 × 10⁹/L = 6 × 10³/µL**. Result **33.0815485636529685**. The different creatinine is intentionally not rounded back to 70. Both explicit conventional entries and equivalent normalized entries produce the same app result.

Creatinine’s factor is supported by [NIDDK’s unit guidance](https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults). The glucose divisor is corroborated by [Beitinger et al.’s primary-study figure captions](https://pubmed.ncbi.nlm.nih.gov/22294813/). These molecular conversion factors have their own published precision; “exact” here means decimal arithmetic using the declared factors, not infinitely precise physical constants. [CDC NHANES documentation](https://wwwn.cdc.gov/nchs/data/nhanes/public/2007/datafiles/GLU_E.htm) uses the rounded glucose factor `0.05551` and rounds its derived dataset variable to three decimals; reproducing that dataset preprocessing is a different task from converting the app’s explicitly entered lab value.

CRP is converted **before** taking the natural logarithm. Mistaking 1 mg/L for 1 mg/dL shifts this rounded-model result by **2.43627369679623 years**. Zero or a bounded CRP result cannot be converted into an exact positive logarithm by silently clamping it. The existing app’s required/unit-aware input behavior should remain.

## Integration guidance and limits

Replace the blanket unresolved-denominator language in `SCORING-INTEGRITY.md` and the `phenoage-2018-method` evidence record with the traced source choice, link to this report, and retain the clinical limitations. Current model/constants need no change. No app version should use the PLOS denominator solely because that paper is titled “Correction.”

The fixtures verify mathematical reproduction, not calibration for Ovuluna users, measurement quality, a treatment effect, clinical safety, or an individual’s true biological age. They do not provide ovarian age, menopause timing, ovulation confirmation, HRV interpretation or fasting instructions. Reconstructing the full training cohort and obtaining original fitted-model objects were not performed. Clinical interpretation and intended-population validation remain separate work.

Verification: `python3 scripts/check-phenoage-reference.py` passed; all three actual-app SI/conventional comparisons passed. `markitdown` was attempted first for both PDFs but lacked its PDF dependency, so text extraction and rendered-page inspection were used. The correction’s equation and original supplement page 1/Table S1 were visually checked.

Retrieved-source SHA-256 receipts:

```text
Aging SD1 PDF: 5a0b7bf66f1b08079a9ecaf036a26613c61e00f8a8e35e5c13f9bacb61d7cd2c
PLOS correction PDF: ec92e9ada040b7be6558c8377a2592bcaf23040b0cef82380015a177eab28c23
BioAge phenoage_calc.R at b1f9fc0: 4d5170403ff96c5b1ad008bd45983cefe7b2219be06e54aa25bb10b29c3c7734
```
