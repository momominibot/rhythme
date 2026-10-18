<!-- Independent review of docs/design/2026-10-18-cycle-wellness-score.md (draft commit ba6d08e), 18 October 2026. Reviewer: Doubao Seed 2.1 pro (doubao-seed-2-1-pro-260915) via the Ark data plane, streamed. Prompt: the shared reviewer brief (five headings, no flattery, cite primary sources). Verbatim; reconciled in 2026-10-18-score-review-reconciliation.md. -->

# 1. Errors of fact or evidence

- **E10, Watson et al. 2015:** The sentence “Worth a chat: mean under 6 h over 5 or more nights … E10: adults should sleep 7 h or more” uses a threshold the source does not provide. The [AASM/SRS consensus](https://doi.org/10.5664/jcsm.4758) supports “7 or more hours,” not a five-night mean below 6 hours. The table incorrectly marks this as not a product choice.
- **Pain threshold:** The sentence “pain 8 or more on any day … E8 supports the 0 to 10 scale, E9 says pain that affects daily life” conflates a validated scale with a validated cutoff. E8 and E9, as described, support severity and functional impact, not specifically 8 out of 10.
- **ASRM 2021:** The statement that “500 mg or more [caffeine] is associated with lower fertility” misstates the cited [ASRM guidance](https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/), which advises limiting caffeine to under 200 mg/day while trying to conceive. ASRM also gives stronger alcohol avoidance advice than “heavy intake best avoided.”
- **NHS breastfeeding caffeine:** “Under 300 mg while breastfeeding (NHS)” is not the NHS limit. [NHS Start for Life](https://www.nhs.uk/start-for-life/baby/feeding-your-baby/breastfeeding/breastfeeding-and-diet/) advises no more than 200 mg/day.
- **ACOG Committee Opinion 651:** The sentence “ACOG treats the menstrual cycle as a vital sign (Committee Opinion 651)” is applied to all adult women, but [CO 651](https://doi.org/10.1097/AOG.0000000000001215) is specifically about girls and adolescents.
- **CDC Hear Her:** The sentence “the leg or arm sign applies up to 6 weeks after birth” imposes a cutoff not supported by [CDC maternal warning guidance](https://www.cdc.gov/hearher/maternal-warning-signs/index.html), which applies during pregnancy and for one year after birth.
- **Harlow/STRAW+10:** The design uses age 40 to switch STRAW+10 copy, while also stating that [STRAW+10](https://doi.org/10.1210/jc.2011-3362) applies regardless of age. The 40-year gate is a product triage choice, not a source-supported diagnostic boundary.
- **Population transfer:** E54 studies women aged 46, but the ledger marks it “ttc by extension.” That extension is unsupported and should be labelled exploratory.
- The 2026 trial and cohort references cannot be verified from metadata alone in this review; their quoted effect sizes and thresholds require PDF checking before sign-off.

# 2. Safety

Replace the TTC caffeine and alcohol copy with:

> “Most evidence suggests 1 to 2 cups of coffee a day does not clearly reduce fertility, but ASRM advises keeping caffeine below 200 mg/day while trying to conceive. This app cannot calculate your exact caffeine dose. If you are trying to conceive, avoiding alcohol is the safest option.”

Replace breastfeeding caffeine copy with:

> “Try to keep caffeine below 200 mg/day while breastfeeding. Cup size and coffee strength vary.”

Replace the LAM card with:

> “LAM can be highly effective only when all conditions are met: no periods after 56 days postpartum, fully or nearly fully breastfeeding with no long feeding gaps, and the baby is under 6 months old. This app cannot tell you whether LAM is working for you. Pregnancy can happen before the first period. Discuss contraception with your clinician.”

Add a postpartum urgent card:

> “After birth, seek urgent help for confusion, unusual beliefs, hallucinations, rapidly changing mood, or little need for sleep with unusually high energy. Postnatal psychotic depression is a psychiatric emergency. Call 995 or go to A&E now.”

Source: [KKH Women’s Mental Wellness Service](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness).

Replace the six-week limb rule with:

> “Severe swelling, redness or pain in an arm or leg needs urgent assessment during pregnancy and in the year after birth. Do not wait six weeks.”

Replace postmenopausal bleeding copy with:

> “Any new bleeding or spotting 12 months after your last period needs prompt assessment. Unexpected bleeding while taking HRT also needs review; contact your GP or polyclinic this week.”

The known negation and extraction failures, including “No bleeding, but sudden severe pelvic pain,” are release-blocking safety defects.

# 3. The derivation

The rules are deterministic and the per-panel coverage display is explainable. Missing days being treated as unknown is correct. However, evidence thresholds and product choices are still mixed together.

The following are product choices and must be visibly labelled as such: SRI below 70, midpoint spread above 60 minutes, social jetlag at 60 minutes, three nights under 5 hours, pain at 8, mean pain at 4, symptoms on more than half of days, mood counts, hot flushes on 4 of 7 days with bother at least 2, and the premenstrual day counts.

The seven-day diary SRI is not the validated 30-day Phillips metric and is not comparable with device-based Bian or Windred results. It should be labelled “experimental estimate from logged bed and wake times,” and the 70 cutoff should not drive a clinical level until validated. With current data, time in bed is treated as sleep, so SRI is misleading whenever sleep is fragmented.

“More than 7 to 9 days” is not deterministic. The rule must specify one operational value or an explicit age or stage-specific range. The “most pressing panel” summary also needs a written escalation hierarchy, because pain, mood, sleep and bleeding are not naturally comparable.

# 4. Personas

- **Trying to conceive, Wei Ling:** The 12-month or six-month waiting rule should not apply when cycles are repeatedly outside 24 to 38 days, periods are absent, or PCOS, endometriosis, thyroid disease or another known fertility condition is present.
- **Postpartum breastfeeding, Nadia:** Suppressing short-sleep escalation because infant care disrupts sleep risks missing postpartum mania or psychosis, where reduced need for sleep plus high energy or racing thoughts is an emergency.
- **Perimenopause, Siti:** The age-40 STRAW+10 gate is the central error. Persistent seven-day cycle variability can indicate the transition before 40, and other causes still require consideration at any age.
- **Postmenopause, Mrs Tan:** The bleeding rule is correct in principle but misses HRT context and may fail because of the parser defects. Unexpected bleeding on HRT must still prompt review, but the copy should distinguish expected regimen-related bleeding from unscheduled bleeding without reassuring the user.

# 5. Verdict

**Do not ship as designed.** It may ship only after the factual corrections, safety wording changes, negation parser fixes, threshold relabelling and clinician sign-off are completed.