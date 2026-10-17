# Ovuluna source readiness audit — 11 September 2026

Scope: read-only code, static references, isolated deterministic JavaScript/jsdom reproductions. This does not establish clinical validity, device accuracy or App Store acceptance. The parent is separately checking current platform guidance. No ovarian formula has been generated or clinically endorsed.

## Prioritized findings before PPG remediation

1. **P1: Repeated calibration starts corrupt acquisition.** `ppg.js:393–412` does not stop the calibration RAF loop on readiness; `ppg.html:350` schedules a fresh measurement every ready sample. Every start resets rawData (`ppg.js:422`). A 4-second 60Hz steady-red replay produced 34 ready notifications, 30 measurement starts, 31 outstanding RAF loops and only 1 sample. See the archived output in `calculation-reproduction.json`. This is a demonstrated implementation defect, independent of clinical claims.

2. **P1: Unsupported diagnostic mapping survives failed signal quality.** `ppg.js:219` rejects only poor/insufficient, allowing uncertain/unreliable results through `:229–248` to stress_override/luteal_confirmed and a claim that fasting was automatically changed. Replay {bpm:90,hrv:10,quality:'unreliable'} with baseline {60,60,luteal} emitted both diagnoses. No other file consumes these flags or changes a fasting setting. `ppg.html:540–542` automatically seeds the baseline with the first 'good' reading and invented follicular phase. The code contains no validation for these inference thresholds.

3. **P1: Bio-Age UI reports invented personal results; new engine is unused.** `bio-age.html:29,34,51–59,74,78–108` hardcodes 32-year bio-age, chronological age35, 42 markers and a personalized improvement claim, without example labels. Per-domain deltas sum to -0.8years but net says -0.4. `:111` Recalculate points to #. No HTML imports/calls `bio-age.js` or `OvulunaWellness`, so the newer wellness/PhenoAge implementation does not power the user-facing dashboard.

4. **P1: Ovarian engine invents precision and misclassifies user groups.** `ovarian-model.js:5–22` supplies age-bucket AMH norms, 0.55 maternal weighting, smoking/circadian/sleep offsets, a logarithmic AMH multiplier and fixed interval widths without a fitted model or coverage calculation. UI calls this a Confidence range (`ovarian-age.html:153`). `ovarian-model.js:19,25–31` maps any skipped periods to 1.5years until menopause and any variable cycle to menopause transition. Reproductions: age16 + skipped => ovarian age50, late menopause transition; clicking Nurture/Postpartum automatically selects age34+variable (`ovarian-age.html:270`), resulting in early menopause transition. Hormonal contraception still yields numerical menopause/age outputs. Clearing age silently substitutes30 (`:202`), and update/save bypass numeric input validity. No evidence of clinical validation was found in the repository.

5. **P1: Learn pages claim nonexistent demonstrated validation/integrations.** `learn-ovarian-age.html:89–91` describes an Ovuluna ML/SHAP model validated against n=4,200 Penn participants while actual model is a short heuristic; `:127` claims PPG/lab/cycle integration unsupported by its inputs. `learn-ppg-tech.html:69–71,108–114` claims >=96% ovulation accuracy, internal n=1,200cycles and +/-3.8ms HRV accuracy; no supporting study/model artifact accompanies it. `learn-wearables.html:53,74,92` repeats >96% and active Oura/WHOOP imports. These are concrete product-evidence gaps, not evidence that a wearable study validates this implementation.

6. **P1: Core evidence citations point to unrelated papers.** `evidence-db.js:72` labels PMID32668115 as ovarian-age prediction but the actual PubMed record is *Acute Ischemic Stroke* by William Powers, NEJM2020 (https://pubmed.ncbi.nlm.nih.gov/32668115/). `:315` labels PMID32751328 as menstrual HRV; the actual record is *Expression of Nectin-4 and PD-L1 in Upper Tract Urothelial Carcinoma* (https://pubmed.ncbi.nlm.nih.gov/32751328/). These two primary identifiers were opened directly; the remaining 83 entries have not received a complete bibliographic audit. Evidence badges are hand-assigned strings (`evidence.js:11–15,88–89`), not validation of the app's scoring algorithm.

7. **P1/P2: Lab input validation and data interpretation fail.** `labs.html:111–117` accepts negative values and substitutes age32 when missing. Reproduction FSH=-10 yields 'Typical' and 'No red flags' (`:131–135,178`). VitaminD35 renders 'Sufficient undefined' because `:157` uses a JavaScript label `text:` instead of assignment. No lab collection date/assay context is captured; the stored date is save time (`:185`). The thresholds are not the claimed full age-normed reference model.

8. **P2: Dormant PhenoAge arithmetic and unit contract fail at valid inputs.** `bio-age.js:68–71` always treats bare albumin/creatinine/glucose as US units, contradicting the introductory required-unit description and providing no typed unit selector. A native-unit panel is converted again and rejected. `:142–147` calculates 1-exp(-H) and then log(1-M); an input accepted by its own limits yields Infinity due to floating-point cancellation. Reproduction panel in JSON. Coefficient appearance alone is not a validation of implementation or ovarian-age interpretation.

9. **P2: Dormant habit score treats missing data as measurements.** `bio-age.js:307` accepts any nonempty lifestyle object, `:208` treats an absent smoker flag as confirmed nonsmoking, while missing factors get zero out of the full100. `{sleepHours:8}` produces20/100 with10 nonsmoking points. A visible data-completeness policy is needed before presenting trends. 20/20/15/etc weights and absolute HRV bands are product rules, with no repository validation for predicting ovarian age.

10. **P2: PPG finger-loss pause is visual, not acquisition pause.** `ppg.js:424,443` stops at the original wall-clock deadline. `ppg.html:421–445` subtracts paused time only from the display and removes low-red samples without separating timestamp gaps. Results can arrive while countdown still shows remaining time and intervals span the interruption. `ppg.js:456–466` turns off torch but leaves stream active until Done/Re-measure; preview animation has no cancellation handle. These are software-quality gaps separate from the signal-method validation requirement.

## Passing checks / calibrated limits

- Correct RMSSD arithmetic for timestamps[0,1000,2020,3000]: expected rounded32ms, actual32ms. This tests formula arithmetic only; it does not validate peak timing or ECG equivalence.
- All14 Learn leaf pages plus Learn and TCM hub pass static file checks: 7 distinct referenced/inline scripts parse; 394 local src/href references resolve; no empty document. Every discovered data-evidence key exists in the 85-entry database. Existing keys do not prove citation correctness.
- `git diff --check` passes for current changes.
- Receipts: `learn-tcm-static.json`, `calculation-reproduction.json`, `input-reproduction.json`; The reproduction receipts describe the pre-remediation engine. Its old mapper interface is intentionally removed; use `node scripts/check-ppg.cjs` for current regressions.


## Focused PPG remediation completed in continuation copy

The parent authorized implementation after the read-only audit. Only `ppg.js`, `ppg.html` and new `scripts/check-ppg.cjs` changed in this subtask.

- Calibration ends after one readiness event; duplicate measurement calls cannot clear samples; stale RAF callbacks are invalidated by run identifiers.
- Page manages one cancellable delayed start and one completion/preview loop. Cancel/retry/late permission responses cannot restart an abandoned session; results and page exit release camera resources.
- A finger-loss sample discards the entire acquisition. The user sees explicit discard/restart wording; Restart creates a new camera session, recalibrates and collects a fresh continuous window. No sample concatenation across that detected interruption remains.
- Removed TCM stress/luteal confirmation/automatic fasting mapping and automatic first-reading/follicular baseline persistence. Existing storage is not erased. Accepted values are explicitly experimental estimated pulse and camera pulse-rate variability; rejected/uncertain/unreliable readings are withheld from displayed metrics.
- Removed the PPG page's unsupported ESC correlation/clinical-validation wording. Numerical DSP is otherwise unchanged.

Nine dependency-free Node regression groups pass against the actual page script and engine using fake media/frame/timer objects: one-shot calibration+duplicate guard; cancellation in readiness delay; retry isolation; late permission cancellation; finger loss during the start delay; discard/restart continuity; strict accepted-quality mapper; displayed-number/storage/resource gate; known BPM/RMSSD fixtures. `node scripts/check-ppg.cjs` from the continuation repo reproduces them; receipt `ppg-regressions.json`.

Remaining limitations: no real rear camera/torch/device/browser/thermal validation or ECG agreement study. The red-only coverage and peak-detection signal gates remain heuristic. The timestamp processing pipeline has no general resampling/large-frame-gap validation (detected finger loss is now reset). Ovarian/BioAge models, lab interpretation, unsupported Learn claims, source-ID integrity, health/wearable integration and broader app readiness are not remediated by this narrow PPG patch.


## Current disposition after parent/subtask fixes

The findings above preserve the initial review and line numbers. They are not all still present. The source was re-read after remediation.

| Initial finding | Current disposition |
| --- | --- |
| 1 Calibration loop duplication | Fixed and covered by current page/engine replay checks. |
| 2 Diagnostic mapping / quality bypass | Fixed in PPG flow; no diagnostic mapper or automatic baseline writes remain. |
| 3 Fabricated Bio-Age display / disconnected engine | Replaced with explicit nine-marker research input/results/history. Insights and Overview now use actual records. Home now uses actual dated check-ins and lab plots; other legacy/demo routes remain open. |
| 4 Ovarian heuristic, intervals and group/input errors | Unsupported heuristic removed; actual input/context guards and versioned record flow implemented. Validated ovarian prediction model remains an unmet requirement; no numerical prediction is emitted. |
| 5 Unsupported Learn product validation | `learn-ovarian-age.html` rewritten by parent to remove ML/SHAP/internal-study claims; PPG/wearables articles now use checked study scope and accurate not-connected states. Remaining library claims need review; Luna is now an explicitly offline prepared guide with no personal inference or fake cloud/credit status. |
| 6 Incorrect evidence identifiers | Parent replaced the two identified entries with reviewed sources and updated evidence rendering; the remaining database still needs bibliographic/claim review. |
| 7 Labs interpretation and validity | Entry, units, date, bounds, history/edit/export and corrupt-storage guards repaired. Unsupported clinical bands removed; entered report intervals are compared literally. |
| 8 PhenoAge unit/numeric errors | Explicit units/conversions and stable log-domain calculation repaired and connected. Exact Aging 2018 coefficients disclosed; original equation traced in PHENOAGE-METHOD-RESOLUTION.md. App clinical applicability remains unresolved. |
| 9 Habit score missing-data rules | Arbitrary composite score retired. Missing observations stay missing; actual zero/false values are preserved. |
| 10 Detected finger-loss pause / resource cleanup | Fixed by discard/restart and resource cleanup. General frame-timestamp gap handling and real device validation remain outstanding. |

Final whole-site source check: 76 pages, all14 Learn leaf pages, 67 parsed JS/CJS and inline scripts, 1,659 local src/href references and 764 local page links. No empty pages, syntax errors, missing local targets or pages without discovered inbound links. `git diff --check` passes. Final receipts copied alongside this report: `whole-site-static.json`, `ppg-regressions.json`, `calculation-reproduction.json` (pre-remediation), `input-reproduction.json` (open issues).


## Subsequent scoring and data-integrity verification

See `SCORING-INTEGRITY.md` for the current model/input/storage contracts and research sources. The earlier reproduction receipts intentionally preserve defects from before this pass. Current dependency-free checks cover 47 regression groups; targeted browser receipts include real save/reload/review/edit flows with synthetic records on an isolated origin. The final reusable source checker reports 76 pages, no missing local references or syntax failures, and explicitly lists six dynamic references it cannot prove. Static citation presence does not establish that the cited study supports the claim. Full clinical, native-device, security and whole-app accessibility gates remain open.

## Home, shell and native boundary follow-up

See `HOME-SHELL-PASS.md` for dated Home records, actual hormone plots, single-scale shared shell and technology-guide remediation. `NATIVE-DATA-AUDIT.md` records independent invitation/entitlement/chat reproductions and native tooling discovery. These are implementation findings, not proof that any deployed account was compromised. Backend/account/community and native protections still require implementation.

## Settings, specialist and native integration disposition

See `SETTINGS-DELETION-PASS.md` and `STALE-WRITERS-PASS.md` for scoped local deletion and the two repaired stale-page writes. Actual account deletion remains unavailable until an authenticated lifecycle exists. `API-HARDENING.md` covers local fail-closed AI/NFC boundaries and22 stub groups; it is not live identity verification. `SPECIALIST-MEASUREMENT-REVIEW.md` maps clinical feedback to an unimplemented structured observation contract and records the corrected cycle-log preview. `TCM-SOURCE-REVIEW.md` adds three checked records (10/90 total); remaining coverage is open. The original PhenoAge equation is traced without changing the calculation version.

`NATIVE-FOUNDATION-PASS.md` records the new reproducible public bundle, unsigned native build and two passing installed-simulator flows, including the repaired evidence reading area and Luna focus. The final source/build checker reports76pages/825local links, no missing/syntax failures and two unresolved computed references. These receipts supersede the earlier native-project-absent state. Clinical validation, protected storage, actual account/community services, physical device evidence and signed release requirements remain open.
