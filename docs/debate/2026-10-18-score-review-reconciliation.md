# Reconciliation of the three reviews of the rhythm check design (18 October 2026)

Reviews of version 1 (commit ba6d08e): DeepSeek V4 flash ("ship with the listed changes; parser fixes, perimenopause contraception wording and evidence chip correction are release blockers"), Doubao Seed 2.1 pro ("do not ship as designed; may ship after factual corrections, safety wording, parser fixes, threshold relabelling and clinician sign-off"), Codex gpt-6-astra with repository access ("do not ship: unsafe input interpretation, coverage-gated care and unvalidated classifications"). Version 2 of the design adopts the corrections below unless the primary source, opened this session, says otherwise. "Adopted" means the design text changed; "adapted" means changed with a different wording or scope; "rejected" means the source contradicts the reviewer.

## Agreed by two or three reviewers

| Point | Who | Decision | Evidence |
|---|---|---|---|
| The diary sleep regularity index is not the validated metric and must not drive a level or be shown as 0 to 100 | all three | Adopted: no number anywhere; Rhythm panel is descriptive (midpoint spread, bedtime range, social jetlag, duration) | Phillips 2017 used 30 days of diaries with all sleep episodes; Fischer 2021 shows naps and awakenings change SRI and that standard-deviation metrics need over a week (E88); Bian and Windred are device cohorts aged 43 to 79 |
| Existing app thresholds (under 6 h over 5 nights, pain 8, two heavy days) were marked "not a product choice" | Codex, Doubao | Adopted: relabelled as Rhythme thresholds anchored on E10, E8, E9, E4, E5 | E10 recommends 7 h or more and names no referral cut-off; E8 validates the scale, not 8; E4 and E5 define heavy bleeding by signs and impact |
| ACOG 651 is about girls and adolescents | Codex, Doubao | Adopted: applicability changed; extension to adults labelled our interpretation | E73 title and abstract |
| Product-choice thresholds must not carry an evidence chip | DeepSeek, Doubao | Adopted: "Rhythme threshold" chip in a different style; a product choice never wears an E number | design rule |
| Coverage must not gate care; single-event escalation | Codex (DeepSeek by implication) | Adopted: care prompts fire from one entry; coverage gates pattern levels only | design rule |
| "Settled" reads as reassurance for unlogged days | Codex (DeepSeek on missing days) | Adopted: "Nothing flagged in what you logged", unknown days named | design rule |
| Postpartum broken-sleep mode must not silence exhaustion and must catch psychosis | DeepSeek, Codex, Doubao | Adopted: exhaustion rule (product choice, Very Low) tied to coping; psychosis urgent card with KKH wording | E65 (KKH: psychotic depression is a psychiatric emergency); E62 |
| TTC: irregular or absent cycles and other conditions warrant evaluation without waiting; over 40 more immediate | Codex, Doubao | Adopted | E89 opened: ASRM lists irregular cycles, cycles under 25 days, intermenstrual bleeding, oligo- or amenorrhoea, uterine, tubal or peritoneal disease or endometriosis, suspected male subfertility; more immediate evaluation may be warranted over 40 |
| Perimenopause copy must not imply infertility | DeepSeek, Doubao | Adopted with FSRH figures: two years after the last period if under 50, one year if over 50 | E92 (secondary summaries; FSRH primary not opened, labelled) |
| The age-40 gate on the STRAW copy is a product choice, not a source boundary; the transition can begin before 40 | Doubao (Codex on exclusions) | Adopted: pattern shown at any age with age-framed copy labelled as a product choice; suppressed for PCOS, hypothalamic amenorrhoea, hysterectomy, ablation, chemotherapy | E50 opened: STRAW+10 applies regardless of age; menstrual criteria not applicable with PCOS or hypothalamic amenorrhoea; cannot be staged after hysterectomy or ablation |
| 2026 sources could not be verified by the reviewer | DeepSeek, Doubao | Rejected as a correction, adopted as a label: every 2026 item was retrieved from PubMed with its DOI on 18 October 2026 and read at abstract level; the two Ark models predate them; full-text checks are listed as due before sign-off | PubMed metadata |

## DeepSeek, point by point

- RCOG window is two weeks, not seven days: adopted (14 days before each of two periods). E85 opened.
- Windred "all adults" is an extrapolation: adopted (middle-aged and older; younger unverified).
- Phillips 2017 and the app's estimate differ: adopted (the number is dropped; E52 note rewritten).
- Replacement wording for "no bleeding but severe pain" and postmenopausal spotting: adopted.
- "My period has not returned" and "no hot flushes today": already in the safety re-check; kept as release blockers.
- 60-day note can reassure a fertile woman: adopted with FSRH figures rather than DeepSeek's "12 months" (which understates the under-50 rule).
- Evidence chips on product thresholds: adopted.
- Regularity number: adopted (words only).
- TTC fertile colouring: adapted. Off by default; when turned on it carries Codex's label; an LH entry is listed as the better signal. Removal outright is left as decision 5 for Jamie and Dr Patrick.
- Postpartum sleep deprivation pattern: adopted (product thresholds, Very Low).
- Perimenopause contraception: adopted.
- Postmenopause bone and fall risk: adapted with the NICE CG146 factors that were confirmed (previous fragility fracture, glucocorticoids, falls history, low BMI, smoking, alcohol above 14 units a week, family history); height loss and kyphosis were not found in what was read and are left out.

## Doubao, point by point

- E10 threshold and pain cut-off not in the sources: adopted (relabelled).
- ASRM advises under 200 mg caffeine while trying to conceive: rejected. The ASRM page opened on 18 October 2026 says high intake (500 mg, more than 5 cups) was associated with decreased fertility (OR 1.45), 1 to 2 cups has no apparent adverse effect, and more than 200 to 300 mg in pregnancy may raise miscarriage risk. The design keeps 500 mg as the association and gives 200 mg as the limit once pregnancy is possible (E48). Doubao's alcohol point is adapted: "once pregnancy is possible, no alcohol is the safest choice" is added; ASRM's own words on moderate drinking are "limited evidence".
- NHS breastfeeding caffeine is 200 mg: rejected. The live NHS Best Start page (E78, E91) says "try not to have more than 300mg a day". A 2018 journal article reported a 200 mg wording that is not on the current page.
- ACOG 651 adolescents: adopted.
- CDC limb sign six-week cutoff: adapted. The CDC page as read gives "anytime during pregnancy or up to 6 weeks after birth" for that sign; the app does not time-gate it, and the copy says not to wait.
- STRAW age-40 gate: adopted (see above).
- E54 "ttc by extension": adopted (exploratory).
- TTC caffeine and alcohol replacement copy: adapted as above.
- Breastfeeding caffeine copy at 200 mg: rejected (300 mg per the live page), wording about cup size kept.
- LAM card: adapted. The card now says the app cannot tell whether LAM applies, pregnancy can happen before the first period, and contraception should be discussed; the "no periods after 56 days postpartum" element is not in the CDC criteria opened here and is left out rather than cited unverified.
- Postpartum psychosis card: adopted with Doubao's wording.
- Six-week limb rule: adapted as above.
- Postmenopausal bleeding with HRT: adopted; the NHS page (E94) lists HRT among the causes and says to see a GP for any amount, even once.
- Product choices to label: adopted, including three nights under 5 h.
- "More than 7 to 9 days" not deterministic: adopted (age bands).
- Escalation hierarchy: adopted (section 3).
- Personas: TTC exceptions adopted; postpartum mania or psychosis adopted; perimenopause age gate adopted; postmenopause HRT context adopted.

## Codex, point by point

- "No (existing)" is not validation: adopted.
- FIGO compares shortest to longest with age-dependent limits; consecutive differences belong to STRAW: adopted. Age bands taken from the Merck Manual and StatPearls reproductions of FIGO 2018, labelled as secondary.
- Heavy bleeding "No" overstates: adopted (the two-day rule is a product choice; the definition is impact).
- Bian 70 does not validate a diary threshold in younger women: adopted (the number is dropped).
- E73 adolescents: adopted.
- CDC bleeding or discharge qualifiers: adopted (heavy bleeding, large clots, foul-smelling discharge).
- Coverage must not gate care: adopted with Codex's sentence.
- "Settled" replacement: adopted in spirit with warmer wording ("Nothing flagged in what you logged; the days you did not log are unknown").
- Pregnancy test from the first missed period or 21 days after unprotected sex: adopted; NHS page opened (E90).
- Calendar disclaimer: adopted verbatim.
- Postpartum sleep eligible for support, confusion or hallucinations as emergency: adopted.
- Breastfeeding alcohol safeguards: adopted with the NHS page's own words (E91), including never sharing a bed or sofa after drinking.
- "Slept 7h" invents midnight to 07:00: confirmed in `ovu-orb.js:63` (the entry note says "Luna assumed a 07:00 wake time"); adopted as a provenance flag and exclusion.
- Count dates, not entries: confirmed (sleep is not single-per-day); adopted.
- Define windows, denominators, duplicates, persistence, every level: adopted (calendar windows, per-date aggregation, persistent postmenopausal card, Day panel has no level, Cycle levels defined).
- PMS needs observed symptom-free follow-up days: adopted.
- Drop SRI grading: adopted; E88 added.
- Label coverage counts and boundaries as product choices; jev outputs are not validation: adopted.
- "Age never penalises a grade": adopted.
- TTC referral exceptions: adopted (E89).
- Perimenopause: STRAW exclusions: adopted (E50 text opened).
- Postmenopause: spotting actionable across entry types and sessions: adopted; the current flag reads period entries only (`ovu-agents.js:56`).

## Verdict after reconciliation

Version 2 is a design, not a release. Its own release blockers, agreed by all three reviewers, are: the urgent-rule gaps in `ovu-orb.js` (negation, self-harm, false period entries, symptom negation, spotting across entry types), the new inputs in section 4, and a clinician's sign-off on every Rhythme threshold. The design may be built only after those three, in that order.
