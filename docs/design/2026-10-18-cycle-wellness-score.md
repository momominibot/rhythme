# Rhythm check: how Rhythme reads symptoms, circadian rhythm and lifestyle for four life stages

Design, 18 October 2026. Status: proposal for Jamie and Dr Patrick. Nothing here is implemented; no app code was changed for this document. Method: Gold Drop lightweight mode (established, contested, gap, our angle; certainty labelled High, Moderate, Low or Very Low), a jev comb over the evidence register and the reviewers' remarks (docs/debate/2026-10-18-score-jev-comb.json), four Codex persona walkthroughs of the app as it is today, and primary sources opened for every load-bearing claim (section 12). Where a number is a product choice rather than an evidence threshold, it says so.

## 1. The decision in one paragraph

Rhythme should not show one invented wellness number. It should show a **rhythm check**: a short, deterministic read of three panels that the phone computes from what the person logged in the last 7 and 14 days: **Rhythm** (sleep timing and regularity), **Body** (symptoms, pain, mood, bleeding) and **Day** (movement, meals, caffeine, alcohol, calm minutes), plus a **Cycle** panel only when periods are expected. Each panel shows how many days were logged, what the rules noticed against a named threshold, the evidence chip (E number) behind that threshold, and one of three levels in plain words: **Settled**, **Unsettled**, or **Worth a chat** (with a GP, polyclinic or specialist). The one-line summary is the most pressing panel, never an average, and it is suppressed entirely while any urgent card is active. The only place a number appears is the Rhythm panel's regularity estimate, because that is the one input with a published metric and outcome evidence (the sleep regularity index); it is labelled as a regularity estimate from logged times, not as health. Life stage changes which panels show, which thresholds apply and how the copy reads; age is never an input and nothing in the check is rewarded with hearts.

## 2. Why not one number

Established, with the record behind it:

- The app's own evidence register has nothing that validates combining measures into a score. In the jev comb the highest "validates a composite" probability for any of the 49 items was 0.13 (E8, a pain-scale review); every other item was 0.10 or lower. Eight items carry a threshold an app can apply directly (E4, E6, E7, E8, E10, E16, E17, E48); the rest are treatments, remedies or data sources, not inputs.
- The reviewers who shaped this app already took a position. `bio-age.js` returns `score: null` with the note "No validated habit-to-age or composite wellness scoring rule is available" (jev: opposes a composite 0.95, applies to this design 0.87). The Ebb debate dropped the camera "calm score" as arbitrary (0.89, 0.83). The NOVA review asked for a number-free mode because repeated scores can encourage purity rules (0.86). No remark supported a composite (all 0.06 or lower).
- The legacy `cycle-score.js` is the cautionary example: base 70, regularity 40 percent, length in range 25 percent, profile 20 percent, trend 15 percent, clamp 40 to 98, with an estimated score from the profile after fewer than three cycles. It rests on no named evidence (jev 0.03) and lowers the score for being over 40 (0.91). All four personas rejected it; three asked to keep the honest `null` until something is validated.
- Validated sum scores exist, but they are validated instruments with reference standards: the EPDS (Levis 2020, 58 studies, cut-off 11 maximises combined sensitivity and specificity; 13 is more specific) and the HADS, where sum scoring matched latent scoring (Zhang 2026). Rhythme's logs are not such an instrument, and a number without a reference standard would be precision without meaning. Certainty that a composite would be unvalidated: High.
- Prediction from lifestyle is weak even with rich data: machine-learning models on 185 male-partner variables in a preconception cohort reached an AUC of about 0.65 for pregnancy within 6 to 12 cycles (Talaei 2026). A lifestyle number that implied fertility or "cycle health" would overclaim.

Our angle: the useful thing a cycle app can do is show the person the pattern in their own logs against thresholds that clinicians and guidelines actually use, say how much data that rests on, and route the right patterns to a clinician. That is a check, not a score.

## 3. What the rhythm check looks like

- **Where:** the Today card in the room and the You tab (four-week view). The doctor summary (`fourWeekSummary`) gains the same panels with their thresholds and evidence ids, so what the user sees and what the clinician sees agree.
- **Panels:** Rhythm, Body, Day, and Cycle when applicable. Each panel: coverage line ("5 of 7 nights logged"), up to three observations, level, evidence chips.
- **Levels and words (Psycho method: warm, specific, no judgement, no purity rules):**
  - Settled: "Your sleep times stayed within about an hour this week."
  - Unsettled: "Bedtime moved around by two hours or more on several nights. Nothing to fix tonight; it is a pattern worth noticing."
  - Worth a chat: "You logged low mood on five of the last seven days. You deserve support; this is worth talking about with a GP or polyclinic." (the existing MOOD_LOW copy)
  - Not enough days yet: "Log a few more nights and the pattern will show."
- **Overall line:** the most pressing level across panels, worded as a sentence, never a number, never "good" or "bad". While an urgent card is active (section 9) the overall line is replaced by the card.
- **Number-free mode:** the same panels with counts hidden, as the NOVA review proposed; the user chooses.
- **Never rewarded:** no hearts for a Settled level; the hearts stay with logging and practices.

## 4. Inputs the app already has, and three it needs

Already logged (ovu-store.js TYPES): sleep with bedTime and wakeTime and quality; period flow with clots and impact; symptom with symptoms[] (includes insomnia, hot flushes, low mood, anxiety, irritability, brain fog), pain 0 to 10 and mood; food with tags (home-cooked, veggies, protein, iron-rich, sweet, caffeine, alcohol, ultra-processed, late night), meal time and NOVA group; mindfulness minutes; weight (never used here). Onboarding gives lifeStage, predictionMode, pregState, breastfeeding, periodsBack, plans, hormones, conditions, signals and habits.

Needed before the Rhythm and Body panels can do what the personas asked for (all four raised these):

1. **Night detail:** minutes to fall asleep and number or minutes of night wakings on the sleep entry, and a "broken sleep" mode that accepts several blocks per night (postpartum). Today a 23:00 to 07:00 entry with "awake from 3am" is stored as eight hours (`ovu-store.js` sleepHours), which the perimenopause and postpartum personas both called out.
2. **Hot flush bother:** a 0 to 3 bother rating next to the hot flushes and night sweats symptoms, since bother, not just frequency, is what the treatment evidence measures (Robinson 2026 meta-analysis of 28 trials: psychosocial interventions, mainly CBT, reduced bothersomeness with medium to large effects).
3. **Movement:** a movement entry (minutes, kind: walk, strength, yoga, other). Today "I walked for 30 minutes" logs nothing (postmenopause persona). The WHO 2020 guideline (E16) and the menstrual-health evidence (section 12) are about minutes and strength days, which the onboarding "movement days a week" answer cannot carry.

## 5. Derivation, panel by panel

All rules run on the phone in `ovu-agents.js` style: deterministic, no model calls, every threshold named in the output so the UI can show its chip. Windows are the last 7 days for levels and the last 14 for trends. A day counts as logged for a panel only if it has an entry of that panel's type.

### 5.1 Rhythm panel (sleep timing and regularity)

Eligible night: a sleep entry with valid bedTime and wakeTime. Coverage rule: at least 5 eligible nights in 7 (the app's existing SLEEP_SHORT_AVG threshold reuses this count), else "Not enough nights yet". In broken-sleep mode (section 7) regularity is not computed; the panel shows total sleep per date and the longest block instead.

Metrics:

- Sleep midpoint per night, in minutes from midnight of the wake day, using the same midnight-crossing rule as `sleepHours`.
- **Midpoint spread:** the standard deviation of midpoints over the eligible nights.
- **Regularity estimate:** a diary-based sleep regularity index. For each pair of consecutive days where both nights are logged, build a minute-by-minute sleep or wake vector for the 24 hours and count the minutes where the state is the same 24 hours later; SRI = 200 times the mean agreement minus 100, so 100 is perfectly regular and 0 is random (Phillips 2017, who computed it from 30 days of sleep diaries). Requires at least 4 consecutive pairs in the 7-day window, else shown as unavailable.
- **Social jetlag:** the absolute difference between the mean midpoint on free days and on work days (Wittmann 2006), with Saturday and Sunday as free days by default and a setting to change them; requires at least 2 of each.
- **Duration:** mean hours, nights under 6 h, consecutive nights under 5 h (existing rules).

Levels:

- Worth a chat: mean under 6 h over 5 or more nights (existing SLEEP_SHORT_AVG, E10: adults should sleep 7 h or more on a regular schedule), or 3 or more consecutive nights under 5 h (existing SLEEP_SHORT_RUN), or the insomnia symptom logged on 7 or more of the last 14 logged days together with fatigue or low mood on those days. The third rule is a product choice; the clinical definition of chronic insomnia is a clinician's call over three months, so the copy says "a pattern worth raising", and for perimenopause and postmenopause it adds that CBT for insomnia is the first-line option in current meta-analysis (Bruyneel 2026).
- Unsettled: regularity estimate below 70, or midpoint spread above 60 minutes, or social jetlag of 60 minutes or more.
- Settled: none of the above with coverage met.

Where the 70 comes from and what it does not mean: in 82,391 UK Biobank adults, SRI of 70 or more measured by wrist accelerometer over one week was associated with a 26 percent lower hazard of dementia (Bian 2025), and in 60,977 adults higher regularity predicted all-cause mortality more strongly than sleep duration did (Windred 2024). Both are observational and device-measured; a diary estimate will run higher and noisier. So the 70 cut is a product choice anchored on those cohorts (certainty for the direction of the association: Moderate; for the cut-off applied to diary data: Low). The menstrual link is direct but thinner: in 2,109 women aged 46 in the 1970 British Cohort Study, the least regular sleep quartile had higher odds of painful periods (OR 1.43), heavy periods (1.34) and PMS (1.33), while sleep duration was not associated with any of them (Abdullayev 2026, cross-sectional, Low); in 3,544 Chinese nurses, rotating shifts were associated with irregular cycles (OR 1.31) and dysmenorrhoea (1.71), with sleep quality mediating only about 7 percent of the shift-work association (Tang 2026, cross-sectional, Low). The panel therefore says regularity is "linked with fewer period symptoms in large studies", never that fixing bedtime will fix periods.

Contrary evidence kept in view: night-shift work was not associated with anti-Müllerian hormone in 1,641 women (Cromack 2025), so the copy must not imply that irregular sleep harms ovarian reserve.

### 5.2 Body panel (symptoms, pain, mood, bleeding)

Inputs: symptom entries and period entries in the last 14 days. Coverage rule: at least 7 logged days in 14 for a level, else "Not enough days yet". A day with an entry that reports no symptoms counts as logged and symptom-free; a day with no entry is unknown, never symptom-free.

Levels:

- Worth a chat (any one): pain 8 or more on any day (existing PAIN_SEVERE; E8 supports the 0 to 10 scale, E9 says pain that affects daily life is worth a GP visit); low or bad mood on 5 or more of 7 or more logged days (existing MOOD_LOW); bleeding beyond 8 days (existing BLEED_LONG, E7); two or more heavy days with clots or disruption in one period (existing BLEED_HEAVY_IMPACT, E4 and E5); spotting on 2 or more days outside a period in 4 weeks (existing SPOTTING_BETWEEN); hot flushes or night sweats on 4 or more of 7 logged days with bother 2 or more (new, product choice; NAMS 2023, E24, and the CBT evidence in section 12 are what the chat is for); a **premenstrual pattern**: low mood, anxiety or irritability on 3 or more of the 7 days before each of two consecutive logged periods and on no more than 1 day in the week after each period. The premenstrual rule mirrors how PMS is assessed (RCOG patient information: keep a symptom diary for at least two cycles in a row; symptoms in the two weeks before the period that improve once it starts) and is a prompt to take the diary to a clinician, not a diagnosis.
- Unsettled: symptoms on more than half of logged days, or mean pain 4 or more (product choice), or low or bad mood on 3 or 4 of 7 logged days, or hot flushes on 2 or 3 of 7 days.
- Settled: coverage met and none of the above.

Urgent cards are separate from levels and fire at logging time (section 9).

### 5.3 Day panel (movement, meals, caffeine, alcohol, calm)

This panel never rises above Unsettled on its own and never changes the overall line while another panel is Worth a chat; it exists to show patterns, not to grade behaviour. Counts, with the chip beside each:

- Movement days and minutes in the week, against the WHO 2020 guideline (E16: 150 to 300 minutes of moderate activity a week and muscle-strengthening on 2 or more days). Shown as "3 days with movement, 1 with strength", never as a percentage of target. Why it matters for this app: an integrative review of 55 studies (Hechinger 2026) found the most consistent benefit of activity for menstrual pain and somatic symptoms, weaker and mixed for premenstrual and emotional symptoms, and recommended individual, symptom-responsive activity rather than a cycle-based prescription; a meta-analysis of 29 trials found therapeutic exercise reduced primary dysmenorrhoea severity and pain with low to very low certainty (Arroyo-Fernández 2026).
- Late caffeine: caffeine-tagged food entries with a time within 6 hours of that night's bedtime, counted as nights. The 6-hour figure is from a small crossover trial in which 400 mg taken 6 hours before bed still disrupted sleep (Drake 2013, Low). The app does not know the dose, so the copy is "caffeine within six hours of bed on 3 nights", never "too much caffeine".
- Alcohol: the existing ALCOHOL_FREQ observation (5 or more tagged meals a week) stays an observation.
- Processed food: the NOVA share with coverage, exactly as shipped (E1 to E3), and the words-only option.
- Late meals: count only. The existing LATE_EATING copy ("often shows up as lighter sleep the same night") should be softened: a 2026 systematic review of nutrition interventions for shift workers found the evidence insufficient for meal-timing guidance (Booker 2026) and a review of dinner timing and sleep is still at protocol stage (Bouayed 2026). Certainty: Very Low.
- Calm practice: minutes and sessions, no target. Contemplative practices (mindfulness, yoga, qigong) improved mood, stress, anxiety and sleep quality in a systematic review of 15 trials in women with PMS, with moderate methodological quality (Walsen 2026); slow breathing (E18).
- Hydration: E17 stays information only; the app does not log drinks.

### 5.4 Cycle panel (only when periods are expected)

Shown when predictionMode is normal or wide and the person is not postpartum with periods not yet back. It reuses `cycleStats` and the existing flags and adds two patterns:

- Length outside 24 to 38 days (existing CYCLE_SHORT and CYCLE_LONG, E7).
- **Varying lengths:** consecutive logged cycles that differ by more than the FIGO normal variation (E7: no more than 7 to 9 days). For people aged 40 or over the copy names the STRAW+10 pattern: a persistent difference of 7 days or more in consecutive cycles, recurring within 10 cycles, is the criterion for the early menopausal transition, and amenorrhoea of 60 days or longer is the criterion for the late transition (Harlow 2012; menstrual criteria remain the most important, FSH and AMH are supportive only, and the staging applies regardless of age, body size or lifestyle). The copy says "this is the pattern doctors use to describe the transition", not "you are perimenopausal". For people under 40 the same variability is worded as "worth mentioning if it continues", because the differential is different (PCOS, thyroid, hypothalamic amenorrhoea).
- No period for 45 days with pregnancy possible (existing PERIOD_LATE with the test prompt); 60 days or more at 40 or over adds the late-transition note.
- Fertile colouring on the calendar stays an estimate (predicted start minus 14 days) and the label must say "rough estimate, not a fertility test"; every persona distrusted unlabelled certainty here.

Why cycle characteristics are worth showing at all: ACOG treats the menstrual cycle as a vital sign (Committee Opinion 651), and in 52,655 Nurses' Health Study II women a functional hypothalamic amenorrhoea phenotype in mid-adulthood carried a 62 percent higher cardiovascular risk and non-FHA irregularity was associated with cholesterol, hypertension and diabetes (Shufelt 2026): menstrual history is a health marker worth a conversation, which is exactly the level this panel escalates to.

## 6. Thresholds at a glance

| Rule | Threshold | Basis | Certainty | Product choice? |
|---|---|---|---|---|
| Short sleep | mean under 6 h over 5 or more nights | E10 Watson 2015 (7 h or more, regular schedule) | High for the 7 h guidance | No (existing) |
| Very short run | 3 or more nights under 5 h | existing app rule | n/a | Yes (existing) |
| Regularity | SRI estimate under 70 is Unsettled | Bian 2025; Windred 2024 (device SRI) | Moderate direction, Low for the cut on diary data | Yes, anchored |
| Midpoint spread | over 60 min | our interpretation of regularity | Low | Yes |
| Social jetlag | 60 min or more | Wittmann 2006 definition | Moderate for definition | Yes |
| Insomnia pattern | insomnia on 7 or more of 14 logged days plus fatigue or low mood | ICSD chronic insomnia needs 3 months and a clinician | Low | Yes |
| Severe pain | 8 or more on 0 to 10 | E8, E9 | Moderate | No (existing) |
| Low mood | 5 or more of 7 or more logged days | existing app rule | Low | Yes (existing) |
| Premenstrual pattern | 3 or more symptom days in the 7 before two consecutive periods, 1 or fewer in the week after | RCOG PMS leaflet (two-cycle diary) | Moderate for the diary method, Low for the counts | Yes |
| Hot flush bother | 4 or more of 7 days with bother 2 or more | treatment evidence measures bother (Robinson 2026; E24) | Low for the count | Yes |
| Bleeding duration | more than 8 days | E7 FIGO | High | No |
| Heavy bleeding | signs in E4; impact rule existing | E4, E5 | High | No |
| Cycle length | outside 24 to 38 days | E7 | High | No |
| Varying cycles | beyond 7 to 9 days; 7-day persistent rule at 40 or over | E7; Harlow 2012 STRAW+10 | High | No |
| Late caffeine | within 6 h of bed | Drake 2013 | Low | Yes, anchored |
| Movement | shown against 150 to 300 min and 2 strength days | E16 WHO 2020 | High for the guideline | No |
| Caffeine amount (copy only) | 500 mg or more a day associated with lower fertility; 200 mg in pregnancy; 300 mg while breastfeeding | ASRM 2021; E48 NHS; NHS Start for Life | Moderate; High; High | No |

## 7. Life-stage matrix

| Component | Trying to conceive (Wei Ling) | Postpartum, breastfeeding (Nadia) | Perimenopause (Siti) | Postmenopause (Mrs Tan) |
|---|---|---|---|---|
| Cycle panel | On. FIGO flags; variability "worth mentioning"; ASRM timing of evaluation (12 months under 35, 6 months at 35 and over) in the Worth a chat copy; no fertility probability, no "LH surge detected" | Off until periods return (periodsBack = no). Information card instead: LAM criteria (amenorrhoea, fully or nearly fully breastfeeding with feeding gaps no longer than 4 h by day and 6 h at night, under 6 months) as information, never as advice that she is protected; "pregnancy can happen before the first period" | On, wide mode. STRAW+10 pattern copy at 40 and over; heavy or prolonged bleeding and bleeding between periods route to Worth a chat (NICE NG88, E5) | Off. Any bleeding at all is a prompt card: "even one spot after menopause needs assessment this week" (existing POSTMENO_BLEED copy) |
| Rhythm panel | On. Social jetlag matters for her 1 am weekdays and 10 pm weekends | Broken-sleep mode: totals and longest block, no regularity grade, no "short sleep" chat trigger (sleep is infant-driven) | On. Night sweats annotate wakings; insomnia pattern adds the CBT-I note | On. Insomnia pattern adds the CBT-I note; evening caffeine note for her 9 pm tea |
| Body panel | On, plus the premenstrual pattern rule | On. Low or bad mood on most logged days for 2 weeks routes to Worth a chat with the postpartum copy (section 9); physical warning signs (section 9) are urgent cards; optional symptoms to add: tearfulness, breast pain, tear or wound pain | On, plus hot flush bother and heavy bleeding | On, plus hot flush bother; optional symptoms to add: joint aches, vaginal dryness, urinary discomfort, with the KKH menopause clinic in the chat copy |
| Day panel | Caffeine copy: 1 to 2 cups a day shows no effect on fertility, 500 mg or more is associated with lower fertility (ASRM). Alcohol: evidence mixed, heavy intake best avoided (ASRM). Partner matters: poor sleep health was associated with lower semen quality in 690 men (Coleman 2026) | Caffeine copy: under 300 mg while breastfeeding (NHS). Alcohol copy: NHS, 1 or 2 units once or twice a week, 2 to 3 hours before a feed. No weight-loss targets; lactation bone loss is transient and recovers after menses return and weaning (Grizzo 2020) | Movement shown; late caffeine; no moral copy about alcohol beyond the observation | Strength and balance days emphasised (E16); no bone-density claims; maternal osteoporosis recorded for the conversation only |
| Weight, age, hearts, streaks | Never inputs | Never inputs | Never inputs | Never inputs |

Codex's persona runs (docs/debate, persona files) named their check "My wellbeing patterns" (three personas) and "Postpartum wellbeing check-in" (one). The name is an open decision (section 13).

## 8. What the check never claims, and copy rules

Never: a fertility probability, confirmed ovulation, ovarian reserve or egg quality; contraception protection (the LAM card is information, and says pregnancy can occur before the first period); a diagnosis of PMS, PMDD, perimenopause, depression or anything else; hormone levels; bone density; biological age; milk supply; treatment suitability; a rating of how good a mother, patient or person someone is. Never a reassuring overall line while any Worth a chat or urgent state is active. Never "good" or "bad" for food, alcohol or caffeine; counts and the chip only. Never a penalty for age. Never an unexplained number.

Copy rules (Psycho method, flexible): say what was logged before what it might mean; one observation per sentence; "worth noticing" for Unsettled, "worth a chat" for the clinician level; name the evidence chip; offer the number-free view; the user can untick any entry the rules used.

## 9. Escalation rules and exact wording (Singapore)

Urgent cards fire at logging time from the raw text and from saved entries, and replace the overall line. Verified contacts: SCDF emergency 995; KKH Urgent O&G Centre, a 24-hour walk-in centre at Basement 1, Women's Tower, for acute vaginal bleeding, severe pelvic pain, early pregnancy problems under 22 weeks and post-pregnancy conditions; Samaritans of Singapore 1767 (24-hour) and CareText on WhatsApp 9151 1767 (24-hour); KKH Women's Mental Wellness Service; KKH menopause clinic, Clinic B, Level 1, Women's Tower, 6225 5554.

- **Emergency now:** "Soaking through a pad every hour, fainting with bleeding, sudden severe pelvic or tummy pain, chest pain, trouble breathing or collapse: call 995 or go to the nearest A&E now. Do not finish logging first." KKH's 24-hour Urgent O&G Centre is named for bleeding and pelvic pain.
- **Possible pregnancy with pain or bleeding:** "One-sided pelvic pain or unusual bleeding when pregnancy is possible needs assessment today, even without a positive test." (existing PREG_BLEED_NOW scope, worded by the TTC persona)
- **Thoughts of harming yourself or your baby:** "If you have thoughts of harming yourself or your baby, you need help now. Call 995 or go to A&E, and ask someone you trust to stay with you. SOS is available 24 hours on 1767, or WhatsApp 9151 1767." The CDC lists thoughts of self-harm or harming the baby among urgent maternal warning signs in the year after birth; KKH describes postnatal psychotic depression as a psychiatric emergency.
- **Postpartum warning signs (urgent assessment):** fever of 38 degrees C or higher, a headache that will not go away or gets worse, changes in vision, extreme swelling of the hands or face, severe tummy pain that does not go away, trouble breathing, chest pain or a racing heart, severe nausea and vomiting, vaginal bleeding or discharge after pregnancy, severe swelling, redness or pain of a leg or arm (CDC Hear Her list; the leg or arm sign applies up to 6 weeks after birth). Copy: "Say you gave birth [N] months ago."
- **Bleeding after menopause:** "Even one spot after menopause needs assessment. Contact your GP or polyclinic this week, even if it stops." (existing prompt copy)
- **Worth a chat, by stage:** TTC after 12 months under 35 or 6 months at 35 and over (ASRM), and earlier with a family history of endometriosis or disruptive pain ("mention your mother's history; both partners matter"); postpartum low mood that persists or worsens beyond two weeks or affects coping ("contact your GP or polyclinic; KKH and NUH offer specialist support; do not wait for enough diary entries"), noting that clinicians use the EPDS, where a score of 11 or more maximises combined sensitivity and specificity and 13 or more is more specific (Levis 2020); perimenopause heavy or prolonged bleeding, bleeding between periods, flushes or insomnia affecting life (CBT and CBT-I are evidence-based options: Robinson 2026, Bruyneel 2026; NICE's 2024 update of NG23 added recommendations on CBT and genitourinary symptoms); postmenopause dryness, joint aches or sleep onset affecting life (KKH menopause clinic covers vaginal atrophy, osteopenia, hormone and non-hormonal therapy).

Known gaps in the current urgent rules, reproduced by the persona walkthroughs and re-checked in this session (docs/debate/2026-10-18-persona-safety-recheck.md): a leading "no bleeding" or "no period" suppresses the whole urgent check, so "No bleeding, but sudden severe pelvic pain" shows no card; self-harm phrases are not recognised; "No period for two years, but spotting today" neither fires the postmenopausal card nor the bleeding flag; "My period has not returned" is parsed as a medium-flow period; "No hot flushes today" records flushes. These must be fixed before any rhythm check ships, because a check that reads these logs would inherit the errors.

## 10. Uncertainty, missing days and small data

- Coverage is shown per panel and per window: "5 of 7 nights", "9 of 14 days". Missing days are unknown, never symptom-free, never healthy.
- Below coverage the panel says "Not enough days yet" and shows the raw observations only.
- Remembered period starts (onboarding recall) give a day count but no phase and no Cycle panel level, exactly as `cycleStats` already treats them.
- Estimated food portions and photo-recognised meals are shown with their "estimate" marker and do not count towards processed-food share when the NOVA coverage rule withholds the percentage.
- Comparisons across weeks are withheld when coverage differs by more than two days.
- Every observation lists the dates it used and lets the user open and untick the entries.

## 11. What the four personas found

Full files: docs/debate/2026-10-18-persona-ttc.md, -postpartum.md, -peri.md, -meno.md (Codex gpt-6-astra, read-only, with web search, run against the repository on 18 October 2026). Their verdict on a composite was unanimous: no overall number; show comfort, functioning and routines separately; keep `bio-age.js` honest `null` until validated.

| Persona | What she expects | Include | Exclude or down-weight | Ranked changes (file references from the walkthrough) |
|---|---|---|---|---|
| Wei Ling, 33, TTC 8 months | Calm between tests; her difficult premenstrual week made understandable; no fertility guilt | anxiety, low mood, irritability, insomnia, fatigue, pelvic pain, bloating, breast tenderness, bleeding; bed and wake consistency, weekday versus weekend shift; caffeine timing | age, pregnancy success, LH positivity, streaks and cycle regularity as "goodness" points | 1 fix urgent negation and the false bleeding extraction (`ovu-orb.js:39`, `:69`) and align AI sending with the consent wording (`room.js:1345`); 2 remove the hard-coded 85 percent conception probability, LH surge and "current" hormone levels on `fertility.html` and `hormones.html`; 3 maternal-history follow-up, functional mood impact and longitudinal sleep and mood review (`room.js:1819`, `ovu-agents.js:149`) |
| Nadia, 31, 4 months postpartum, breastfeeding | Not to be graded on recovery; a visible postpartum check-in; practical food support | mood, tearfulness, anxiety, coping, fatigue, pain location and impact, bleeding, breast symptoms; actual 24-hour sleep, naps, longest stretch, wakings | cycle regularity, absent periods, fertility estimates, weight-loss targets, rigid schedules, habit streaks | 1 postpartum crisis recognition and negation repair (`ovu-orb.js:37-94`); 2 a postpartum mode with birth date, feeding context, contraception questions, suspended predictions and consistent learn pages (`room.js:1812`, `:1957`, `:1990`; `hydration.html:111`); 3 fragmented sleep as episodes and daily totals (`ovu-store.js:143-148`, `ovu-agents.js:125-131`) |
| Siti, 46, perimenopause, hypertension | Symptoms and care access ahead of decoration; a care route for persistent insomnia | bleeding amount and duration, flooding and clots, pain, sweats and flushes frequency and bother, awakenings, fatigue, mood, irritability, concentration, vaginal and urinary symptoms; bed and wake timing, time awake | age penalties, predicted ovulation, "perfect" 28-day cycles, streaks, weight rewards; habits must never cancel symptom warnings | 1 dependable urgent guidance (`ovu-orb.js:39-89`); 2 record actual nights: sweats severity, awakenings, time awake (`room.js:616-620`, `ovu-store.js:135-148`); 3 remove unsupported reproductive certainty (`fertility.html:41-59`, fertile colouring `room.js:709`, phase assertions `ovu-store.js:248-254`) |
| Mrs Tan, 54, 2 years after her last period | An app that makes sense without a cycle; sleep, comfort and strength foregrounded; never "start your cycle" | flushes and night sweats, sleep-onset difficulty, waking, fatigue, joint pain, dryness, painful intimacy, urinary discomfort, mood; sleep timing and consistency; walking and strength | cycle length, ovulation, fertility, age penalties; weight optional; never reward HRT use or non-use | 1 clause-aware negation and persistent alerts for spotting across entry types (`ovu-orb.js:39-49`, `ovu-agents.js:54-56`); 2 sleep-onset delay and night waking, sleep distinct from time in bed (`room.js:616-628`, `ovu-store.js:135-141`); 3 a complete postmenopause path: symptom-first calendar, dryness and joint questions, bone history, consultation prompts, no fertility labels or automatic period fills, and remove the legacy score for her (`room.js:653-723`, `:1819-1823`, `cycle-score.js:96-146`) |

Other findings all four shared: reminders promise delivery while installed and "always ring", but the scheduler only runs while the page is open (`ovu-remind.js:81-100`); the consent notice says Luna sends notes she cannot read, while enabling AI sends any note over 36 characters (`room.js:1342-1348`); the Evidence library link opens the legacy home page; E15 is a preliminary conference abstract and must not be read as app validation.

## 12. Evidence ledger: entries proposed for the register (E50 onward, never renumbering E1 to E49)

Certainty follows Gold Drop labels. "Applies to" lists the stages the source population or guidance covers. Contrary or null evidence is included on purpose.

| Id | Source | What it supports here | Certainty | Applies to |
|---|---|---|---|---|
| E50 | Harlow et al. 2012, STRAW+10 executive summary, J Clin Endocrinol Metab, [doi](https://doi.org/10.1210/jc.2011-3362) | 7-day persistent variability (early transition), 60-day amenorrhoea (late transition), 12 months (postmenopause); menstrual criteria primary, FSH and AMH supportive; applies regardless of age, body size or lifestyle | High (consensus) | peri, post |
| E51 | Windred et al. 2024, Sleep, [doi](https://doi.org/10.1093/sleep/zsad253) | sleep regularity (SRI) predicts all-cause, cancer and cardiometabolic mortality more strongly than duration; 60,977 adults, accelerometer | Moderate (observational) | all adults |
| E52 | Phillips et al. 2017, Sci Rep, [doi](https://doi.org/10.1038/s41598-017-03171-4) | the SRI definition, computed from sleep diaries over 30 days; irregular sleepers had later melatonin onset and lower light amplitude | Moderate for the metric, Low for outcomes (61 students) | all |
| E53 | Bian et al. 2025, BMC Public Health, [doi](https://doi.org/10.1186/s12889-025-21649-z) | SRI 70 or more associated with lower dementia hazard (HR 0.74); short sleep under 7 h associated with higher risk; 82,391 adults | Moderate (observational) | adults 43 to 79 |
| E54 | Abdullayev et al. 2026, BMC Womens Health, [doi](https://doi.org/10.1186/s12905-026-04533-9) | lowest sleep regularity quartile: higher odds of painful periods, heavy periods and PMS at age 46; sleep duration not associated; lowest moderate-to-vigorous activity: higher odds of painful periods | Low (cross-sectional within a cohort) | peri, ttc by extension |
| E55 | Tang et al. 2026, BMC Nursing, [doi](https://doi.org/10.1186/s12912-026-05060-6) | rotating shifts associated with irregular cycles and dysmenorrhoea; poor sleep quality, under 6 h and sleep latency over 30 min associated with menstrual disorders; sleep mediated about 7 percent | Low (cross-sectional) | ttc, peri |
| E56 | Wittmann et al. 2006, Chronobiol Int, [doi](https://doi.org/10.1080/07420520500545979) | social jetlag defined as the discrepancy between sleep timing on work and free days | Moderate for the definition | all |
| E57 | Drake et al. 2013, J Clin Sleep Med, [doi](https://doi.org/10.5664/jcsm.3170) | 400 mg caffeine 6 hours before bed still disrupted sleep | Low (small crossover trial) | all |
| E58 | ASRM Practice Committee 2021, Optimizing natural fertility, [page](https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/) | fertile window 6 days ending on ovulation; evaluation after 12 months, or 6 months at 35 and over; smoking OR 1.60 for infertility; 500 mg caffeine or more associated with lower fertility, 1 to 2 cups no effect; alcohol evidence mixed, heavy best avoided; diet evidence inconsistent; recommendations are expert consensus | Moderate (committee opinion) | ttc |
| E59 | Levis et al. 2020, BMJ, [doi](https://doi.org/10.1136/bmj.m4022) | EPDS cut-off 11 maximises combined sensitivity and specificity (0.81, 0.88); 13 is more specific (0.66, 0.95); 58 studies | High | postpartum, pregnancy |
| E60 | CDC US MEC, Lactational amenorrhea method, [page](https://www.cdc.gov/contraception/hcp/usmec/lactational-amenorrhea-method.html) | LAM criteria: amenorrhoea, fully or nearly fully breastfeeding with feeds no more than 4 h apart by day and 6 h at night, under 6 months | High for the criteria | postpartum |
| E61 | Van der Wijden and Manion 2015, Cochrane CD001329.pub2, [doi](https://doi.org/10.1002/14651858.CD001329.pub2) | no clear difference in pregnancy rates between LAM with support and fully breastfeeding amenorrhoeic women with no method; whether LAM lengthens amenorrhoea is uncertain | Moderate | postpartum |
| E62 | CDC Hear Her, urgent maternal warning signs, [page](https://www.cdc.gov/hearher/maternal-warning-signs/index.html) | the 15 warning signs during pregnancy and the year after birth, including fever of 100.4 F (38 C) and thoughts of harming yourself or your baby | High (agency guidance) | postpartum |
| E63 | KKH, Urgent O&G Centre, [page](https://www.kkh.com.sg/our-specialties/urgent-og-centre) | 24-hour walk-in, Basement 1 Women's Tower; acute bleeding, severe pelvic pain, early pregnancy under 22 weeks, post-pregnancy conditions | High (service facts) | all |
| E64 | Samaritans of Singapore services overview (September 2025) | hotline 1767 and CareText WhatsApp 9151 1767, both 24-hour | High | all |
| E65 | KKH, perinatal depression and mental wellness, [page](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness) | 10 to 15 percent of recently delivered women develop postnatal depression; blues beyond two weeks: seek advice; postnatal psychotic depression is a psychiatric emergency; Women's Mental Wellness Service | Moderate (hospital patient information) | postpartum |
| E66 | Robinson et al. 2026, BMC Womens Health, [doi](https://doi.org/10.1186/s12905-026-04563-3) | psychosocial interventions, mainly CBT, reduced vasomotor bother (g -0.60 to -0.87) and improved sleep and insomnia; no effect on sexual or urogenital symptoms; 28 RCTs | Moderate | peri, post |
| E67 | Bruyneel et al. 2026, Sleep Med, [doi](https://doi.org/10.1016/j.sleep.2026.109040) | CBT-I and other non-pharmacological approaches are the most robust first-line options for chronic insomnia in peri and postmenopausal women; 24 RCTs | Moderate | peri, post |
| E68 | Hechinger et al. 2026, BMC Womens Health, [doi](https://doi.org/10.1186/s12905-026-04975-1) | activity most consistently reduces menstrual pain and somatic symptoms; mind-body approaches promising; individual, symptom-responsive rather than cycle-based prescription; 55 studies | Moderate (heterogeneous) | ttc, peri |
| E69 | Arroyo-Fernández et al. 2026, J Clin Med, [doi](https://doi.org/10.3390/jcm15124418) | therapeutic exercise reduced primary dysmenorrhoea severity and pain and improved sleep quality; certainty low to very low; 29 RCTs | Low | ttc, peri |
| E70 | Walsen et al. 2026, Front Psychol, [doi](https://doi.org/10.3389/fpsyg.2026.1912206) | mindfulness, yoga and qigong improved mood, stress, anxiety and sleep quality in PMS; 15 trials, moderate quality | Low to Moderate | ttc |
| E71 | Ky et al. 2026, BMC Womens Health, [doi](https://doi.org/10.1186/s12905-026-04642-5) | in Southeast Asian medical students, caffeine, limited rest and low or irregular activity were reported correlates of menstrual disturbance; heterogeneity above 95 percent, exploratory | Very Low | regional context only |
| E72 | Shufelt et al. 2026, J Clin Endocrinol Metab, [doi](https://doi.org/10.1210/clinem/dgag405) | menstrual history as an early cardiometabolic marker; FHA phenotype HR 1.62 for CVD | Moderate | all |
| E73 | ACOG Committee Opinion 651, 2015, [doi](https://doi.org/10.1097/AOG.0000000000001215) | the menstrual cycle as a vital sign | High (consensus) | all |
| E74 | Ma et al. 2026, J Affect Disord, [doi](https://doi.org/10.1016/j.jad.2026.122446) | premenstrual symptom burden rose modestly after postpartum menstrual resumption; each EPDS point associated with 0.52 higher symptom score | Low (329 women) | postpartum |
| E75 | Grizzo et al. 2020, Osteoporos Int, [doi](https://doi.org/10.1007/s00198-019-05236-8) | lactation bone loss is transient and recovers after menses return and weaning | Moderate | postpartum |
| E76 | Coleman et al. 2026, Hum Reprod, [doi](https://doi.org/10.1093/humrep/deaf228) | poor sleep health associated with lower semen quality in 690 men in a preconception cohort | Low (cross-sectional, self-report) | ttc partner |
| E77 | Talaei et al. 2026, Andrology, [doi](https://doi.org/10.1111/andr.70375) | machine learning on 185 lifestyle and clinical variables predicted pregnancy within 6 to 12 cycles with AUC about 0.65: lifestyle data cannot support a fertility probability | Moderate as a negative result | ttc |
| E78 | NHS Start for Life, healthy diet when breastfeeding, [page](https://www.nhs.uk/start-for-life/baby/feeding-your-baby/breastfeeding/healthy-diet-when-breastfeeding/) | keep caffeine under 300 mg a day while breastfeeding; 1 or 2 units of alcohol once or twice a week, 2 to 3 hours before a feed | High (agency guidance) | postpartum |
| E79 | Booker et al. 2026, J Hum Nutr Diet, [doi](https://doi.org/10.1111/jhn.70340) | evidence insufficient to formulate meal-timing guidance; null for the late-eating rule | Moderate as a negative result | all |
| E80 | Sansom et al. 2025, J Sleep Res, [doi](https://doi.org/10.1111/jsr.70194) | higher SRI associated with better mental and physical health-related quality of life at 53 to 61 | Low to Moderate | peri, post |
| E81 | Hand et al. 2023, Sleep, [doi](https://doi.org/10.1093/sleep/zsad001) | irregular sleepers have irregular light exposure; light regularity is a future input, not a current one | Low (adolescents) | future |
| E82 | Miskeen et al. 2026, J Vis Exp, [doi](https://doi.org/10.3791/72609) | PMDD estimates from questionnaires are screening-positive, not diagnoses | Low | ttc |
| E83 | Zhang et al. 2026, J Affect Disord, [doi](https://doi.org/10.1016/j.jad.2026.122051) | for a validated instrument (HADS) simple sum scores perform as well as latent scoring: numbers need a validated instrument, which Rhythme's logs are not | Moderate | design |
| E84 | Cromack et al. 2025, Maturitas, [doi](https://doi.org/10.1016/j.maturitas.2025.108666) | night shift work not associated with AMH in 1,641 women: do not imply irregular sleep harms ovarian reserve | Moderate (null) | ttc |
| E85 | RCOG patient information, Managing premenstrual syndrome (2018, under review), [page](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/) | keep a symptom diary for at least two cycles in a row; symptoms in the two weeks before the period that improve once it starts; CBT, exercise and diet as first steps | Moderate (patient leaflet) | ttc, peri |
| E86 | Stute et al. 2026, Maturitas, [doi](https://doi.org/10.1016/j.maturitas.2026.109090) | a self-guided digital CBT app improved hot flush problem rating over 12 weeks in an open-label pilot of 100 women | Low (pilot, open label) | peri, post |

Not verified in this pass and so not relied on: the exact NICE NG23 recommendation text (nice.org.uk refused the fetch; NICE's own update-information page confirms the November 2024 update added recommendations on CBT and genitourinary symptoms); the ICSD-3 chronic insomnia definition (cited from general knowledge, labelled as a clinician's call); Singapore-specific prevalence figures (none used).

## 13. Open decisions for Jamie and Dr Patrick

1. **Name.** "Rhythm check" (fits the brand and works without a cycle) or "My wellbeing patterns" (what three personas asked for). Not "cycle wellness score": two of the four stages have no cycle, and "score" promises a number.
2. **The one number.** Show the diary regularity estimate (0 to 100) inside the Rhythm panel, or words only. The design says show it with its label; Dr Patrick may prefer words only.
3. **The product-choice thresholds** in section 6 (regularity 70, midpoint spread 60 min, insomnia pattern, hot flush bother, mean pain 4, symptom-day share, premenstrual pattern counts) need a clinician's sign-off before they ship.
4. **New inputs** (night detail, hot flush bother, movement entry) are prerequisites; the Rhythm panel without night detail will mislead the two personas who wake at 3 am.
5. **Safety fixes first.** The urgent-rule gaps in section 9 are more important than any new panel and should ship on their own.
6. **Lifestyle never escalates** and is never rewarded. Confirm.
7. **If an overall number is ever wanted**, the honest route is a prospective in-app validation with separate consent (the consent notice already promises research is asked about separately): define the outcome (symptom burden, clinician visits), collect panels for several cycles, and test whether any combination predicts it better than the panels alone. Until then, none.

## 14. Method and provenance

- Triage: full depth; Gold Drop, Psycho, jevauto and Astra 6 selected. jevauto chose a rule-based expert system over statistical or correlation approaches, which matches the no-invented-weights constraint; its generic steps were not followed beyond that.
- Jev comb: five calls over the 49 register items (component, evidence type, usable threshold, composite basis, four stage applicabilities) and one call over 12 reviewer remarks; results in docs/debate/2026-10-18-score-jev-comb.json with the caveat that they are leads.
- Personas: four Codex gpt-6-astra runs in read-only mode with web search, each playing one user through consent, onboarding, the room, Luna, calendar, food, mindfulness, reminders and learn pages, with file and line citations. Their parser findings were re-run in this session with the app's own modules.
- Sources: PubMed metadata (DOIs above) and the primary pages linked in section 12; everything load-bearing opened, with the exceptions listed at the end of section 12. Contrary and null results kept (E61, E77, E79, E84, sleep duration null in E54).
- Second opinions on this draft: DeepSeek, Doubao and Codex reviews are recorded in docs/debate/2026-10-18-score-review-*.md with a reconciliation note; changes they forced are marked in the git history of this file.
