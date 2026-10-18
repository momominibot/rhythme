<!-- Independent review of docs/design/2026-10-18-cycle-wellness-score.md (draft commit ba6d08e), 18 October 2026. Reviewer: DeepSeek V4 flash (deepseek-v4-flash-ga-260731) via the Ark data plane, streamed. Prompt: the shared reviewer brief (five headings, no flattery, cite primary sources). Verbatim; reconciled in 2026-10-18-score-review-reconciliation.md. -->

## 1. Errors of fact or evidence

- **RCOG PMS leaflet**: the document says the premenstrual rule uses symptoms in the 7 days before each of two periods. The cited RCOG information describes premenstrual symptoms in the two weeks before the period, improving once bleeding starts. The 7 day window is narrower than the source and will miss people whose symptoms start 8 to 14 days before menses. Source: [RCOG, Managing premenstrual syndrome](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/).
- **E51 Windred 2024**: the ledger says this applies to "all adults." The UK Biobank sleep regularity and mortality analysis is a middle-aged and older adult sample. Applying that mortality association to a 33 year old trying to conceive is an unsupported age extrapolation. Change the applicability to "middle-aged and older adults, extrapolation to younger adults unverified." Source: [doi:10.1093/sleep/zsad253](https://doi.org/10.1093/sleep/zsad253).
- **Phillips 2017**: the document says the SRI was "computed from 30 days of sleep diaries." The cited paper uses a continuous sleep or wake state record, not bedtime and wake time alone, and the original data collection was longer and richer than the app's 7 day bed and wake endpoints. The app's regularity estimate is a new diary based metric, not the validated SRI. Source: [doi:10.1038/s41598-017-03171-4](https://doi.org/10.1038/s41598-017-03171-4).
- **Unverified 2026 sources**: I cannot verify several 2026 citations with these exact DOIs in the current evidence base, including Talaei, Abdullayev, Tang, Robinson, Bruyneel, Hechinger, Arroyo-Fernández, Walsen, Shufelt, Coleman, Booker, and Zhang. I treat them as unverified, not as load-bearing evidence.

## 2. Safety

The urgent parser gaps in section 9 are release blockers. Exact replacement wording:

- For "No bleeding, but sudden severe pelvic pain": "Sudden severe pelvic pain needs assessment now, even if you are not bleeding. Call 995 or go to the nearest A&E."
- For "No period for two years, but spotting today": "Any spotting or bleeding after menopause needs assessment this week. Contact your GP or polyclinic today, even if it stops."
- "My period has not returned" must parse as a missing period, never as medium flow.
- "No hot flushes today" must record absence, never a flush event.

One additional safety gap: for perimenopause, the 60 day amenorrhoea note can reassure a woman who is still capable of conception. Add exact wording: "A 60 day gap is a transition pattern, but pregnancy is still possible until 12 months after a final period. If you are sexually active, continue contraception or take a pregnancy test." This is established contraception teaching in perimenopause; label it as added here.

## 3. The derivation

The levels and coverage rules are deterministic, per panel, and mostly explainable. Missing days are honestly handled as unknown. The design is also honest about most product choices in the internal table.

The problem is the promised evidence chips. The user facing panel says each observation carries an evidence chip with an E number. Several thresholds have no E number: regularity below 70, midpoint spread above 60 minutes, the insomnia pattern, hot flush bother, mean pain 4, and the premenstrual pattern counts. These should display "app threshold, no evidence chip" rather than an E number. Otherwise the UI implies evidence behind product choices.

The regularity number should not be shown as a 0 to 100 value. The app has 7 days of bedtime and wake time, often in broken sleep, and the validation is from continuous sleep state records. Words only, or a labelled "exploratory estimate" with no numeric confidence, is more honest. If Dr Patrick wants a number, run a diary validation study first.

## 4. Personas

- **Trying to conceive**: the most important miss is the fertile colouring from predicted start minus 14 days. That is a fixed luteal phase assumption, not an evidence based fertility sign. For a woman with irregular cycles it can misdirect timing. Remove it unless real fertility markers such as LH, basal body temperature, cervical mucus, or validated cycle-phase methods are logged.
- **Postpartum breastfeeding**: broken-sleep mode suppresses sleep escalation entirely. Sleep fragmentation is normal, but severe sleep deprivation can impair maternal safety. The app needs a separate postpartum sleep-deprivation pattern based on total sleep in 24 hours and the longest continuous block, with a "worth a chat" copy tied to coping, not a regularity grade and not silence.
- **Perimenopause**: the most important miss is contraception and pregnancy possibility during the transition. The STRAW+10 copy can sound like a diagnosis or a reassurance of infertility. The app must state clearly that pregnancy remains possible until 12 months after the final period.
- **Postmenopause**: the most important miss is bone and fall risk. Strength and balance days are shown, but there is no escalation for prior fragility fracture, height loss, kyphosis, prolonged steroid use, or falls. The app does not need to claim bone density, but it should route those histories to a clinician conversation.

## 5. Verdict

Ship with the listed changes, with the urgent parser fixes, the perimenopause contraception wording, and the evidence chip correction as release blockers.