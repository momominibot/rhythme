<!-- Independent review of docs/design/2026-10-18-cycle-wellness-score.md (draft commit ba6d08e), 18 October 2026. Reviewer: Codex gpt-6-astra, read-only with web search and repository access. Prompt: the shared reviewer brief (five headings, no flattery, cite primary sources). Verbatim; reconciled in 2026-10-18-score-review-reconciliation.md. -->

## 1. Errors of fact or evidence

- **§6, “Short sleep…No (existing)”**: existing code is not validation. Watson recommends at least seven hours regularly, not a referral threshold of under six hours across five nights. Likewise, **“Severe pain…8 or more…No (existing)”** confuses support for a numerical scale with validation of an eight-point care threshold. Both are product choices. [Watson](https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/), [Hjermstad](https://pubmed.ncbi.nlm.nih.gov/21621130/).
- **§5.4, “consecutive logged cycles that differ by more than the FIGO normal variation”**: FIGO compares the shortest and longest cycles, with age-dependent limits. Consecutive-cycle differences belong to the separate STRAW transition criterion. **“Heavy bleeding…No”** also overstates support: FIGO’s definition concerns impact on quality of life, without requiring two heavy days. [FIGO 2018](https://obgyn.onlinelibrary.wiley.com/doi/full/10.1002/ijgo.12666).
- **§5.1, “regularity estimate below 70”**: Bian’s device-derived boundary was based on a cohort distribution. It does not validate a diary threshold for younger TTC or breastfeeding users. Calling the transfer “Low certainty” does not establish calibration. [Bian](https://doi.org/10.1186/s12889-025-21649-z).
- **E73, “Applies to: all”**: ACOG Committee Opinion 651 concerns girls and adolescents, not all four populations. [ACOG](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign).
- **§9, “vaginal bleeding or discharge after pregnancy”** drops CDC’s qualifiers: heavy bleeding, large clots/tissue, or foul-smelling discharge. It should not classify every postpartum discharge as urgent. [CDC](https://www.cdc.gov/hearher/maternal-warning-signs/index.html).

## 2. Safety

- **Coverage must not gate care.** The seven-day Body requirement conflicts with single-event escalation. Replace: **“Care prompts appear whenever a concerning symptom is recorded, even with one entry. Logging requirements apply only to pattern summaries.”**
- Replace **“Settled”** with **“No selected pattern detected in your logged entries. This does not establish that everything is well.”** Missing observations must never become reassurance.
- **Do not wait until day 45 to suggest testing.** Replace: **“If pregnancy is possible, test from the first missed period, or at least 21 days after unprotected sex if you do not know when your period is due.”** [NHS](https://www.nhs.uk/pregnancy/trying-for-a-baby/doing-a-pregnancy-test/).
- Replace the calendar disclaimer with: **“Calendar estimate only. It cannot confirm ovulation, estimate your pregnancy chance, or identify safe days for contraception.”** Calendar prediction has substantial limitations even with regular cycles. [ASRM](https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/).
- **Postpartum sleep must remain eligible for support.** Replace the blanket exemption with: **“Feeding-related sleep disruption still deserves support. If exhaustion prevents normal activities or caring for your baby, seek medical care immediately.”** Add: **“New confusion, hallucinations or loss of touch with reality after birth needs emergency assessment now.”** [CDC](https://www.cdc.gov/hearher/maternal-warning-signs/index.html), [KKH](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness).
- **Breastfeeding alcohol copy omits safeguards.** Replace: **“Not drinking is safest. Timing advice depends on how much you drank; this app cannot determine when feeding is safe. Never share a bed or sofa with your baby after drinking.”** [NHS](https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/breastfeeding/healthy-diet-when-breastfeeding/food-and-drinks-to-avoid-when-breastfeeding/).

## 3. The derivation

It is rule-based in intention, but not sufficiently specified or calibrated.

- **Exclude invented timestamps.** “Slept 7h” currently becomes midnight to 07:00, potentially manufacturing perfect regularity ([ovu-orb.js:63](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-orb.js:63)). Require explicit timing provenance.
- **Count dates, not entries.** I reproduced five same-date sleep entries triggering five-night and consecutive-night warnings. Aggregate overlapping episodes and require adjacent calendar dates ([ovu-store.js:146](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-store.js:146), [ovu-agents.js:37](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-agents.js:37)).
- Define calendar windows, per-field denominators, duplicate handling, alert persistence, and every Day/Cycle level. A period entry is not a mood assessment. “Five of fourteen” is not “most.”
- PMS needs observed symptom-free follow-up days, not merely absent symptom entries.
- Drop SRI grading initially. Bed/wake endpoints omit naps and awakenings, which alter the published metric. Use descriptive timing summaries. [Metric-methods study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8503839/).
- Label coverage counts, four adjacent pairs, 60-minute boundaries, symptom-frequency rules and the two-day comparison allowance as product choices. Jev outputs are model judgments, not clinical validation. **Calibration in these populations remains unverified.**
- Replace “age is never an input” with “age never penalises a grade”; the proposed care branches explicitly use age.

## 4. Personas

- **TTC:** referral exceptions are incomplete. Irregular/absent cycles warrant evaluation without waiting; over 40 can warrant immediate evaluation. [ASRM](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/).
- **Postpartum breastfeeding:** removing sleep grading must not remove assessment of exhaustion and coping.
- **Perimenopause:** transition-pattern interpretation needs exclusions; STRAW menstrual criteria do not apply to PCOS or hypothalamic amenorrhoea. [STRAW+10](https://pmc.ncbi.nlm.nih.gov/articles/PMC3340903/).
- **Postmenopause:** spotting must remain actionable across entry types and sessions, even once. The saved flag currently checks period entries only ([ovu-agents.js:56](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-agents.js:56)). [NHS](https://www.nhs.uk/symptoms/post-menopausal-bleeding/).

## 5. Verdict

**Do not ship:** unsafe input interpretation, coverage-gated care and unvalidated classifications remain release blockers despite the document acknowledging several prerequisites.

