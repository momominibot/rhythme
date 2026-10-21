# Codex on the Cycle tab and its scoring (21 Oct 2026)

Brief: `docs/debate/2026-10-21-cycle-tab-brief.md`. Model gpt-6-astra, read-only, with web search, run against this repository at 6a5e113. The decision taken from it is in `docs/design/2026-10-21-cycle-tab-rhythm.md`.

**Bring back Cycle and choose C: a three-cycle readiness indicator with separate component levels, without a wellness total.** This preserves Ovuluna’s approachable presentation and the earlier review’s central finding.

**1. Restore Cycle as direct access to the diary**

Use **Home · Cycle · Food · Mind · You**.

For the first release, Cycle should open the existing calendar sheet, expanded into a full-height diary view with **Calendar** and **Rhythm check** views. Reuse the current store and editors rather than build another standalone page.

The code already retains `#cycle → openCalendar('period')` in `room.js`. Two changes are essential:

- Diary access must bypass avatar sleep, walking, energy and other game state. Currently, `goTab()` can refuse access when the avatar is asleep.
- Remember the last selected tab and preserve its route across reopening. Someone who chooses Cycle should be able to return directly to their diary.

Calendar should offer immediate period, symptom, pain and mood logging, corrections, history and clinician sharing. Sleep and movement logging must also remain reachable without walking around the room.

For postmenopausal users, keep the same navigation position but label it **Body**, opening a symptom-first calendar. Pregnancy and postpartum views should likewise foreground wellbeing rather than ask everyone to start a cycle.

**2. Choose C, with one important qualification**

| Option | Assessment |
|---|---|
| **A: component levels, no total** | Honest and closest to the earlier decision, but loses Ovuluna’s sense of a picture gradually forming. |
| **B: weighted score out of 100** | Unsupported. Transparent weights and threshold chips explain an invented score; they do not validate it. |
| **C: readiness plus component levels** | Best fit. Retains the three-step presentation while making its number about available history. |

The readiness indicator is the **only summary progress number**. Recorded cycle lengths, pain ratings and coverage counts remain useful measurements.

The two-sentence explanation to the owner:

> “We can bring back Ovuluna’s three-cycle journey and four cards, with the number showing how much history Rhythme has rather than grading someone’s health. Each card will explain the recorded pattern, its evidence and when support may help, without pretending that those different things add up to a meaningful score out of 100.”

Call the screen **Your cycle rhythm**, with **Building your cycle picture** above the readiness indicator. Avoid “score unlocked”.

One exception to uniform component levels is necessary: **ovulation cannot receive a health level from today’s data**.

**3. Exact proposed calculations**

These are proposed rules for clinical review, not an already validated algorithm.

**Shared data rules**

Use observed, dated records, with one contribution per calendar date. Keep missing, explicitly absent and zero separate.

`cycleStats()` remains the source for cycle history, but its prediction inputs cannot be reused uncritically:

- It excludes gaps over 60 days from prediction averages and restarts the length history.
- `periodEpisodes()` can bridge one missing day and reports the first-to-last span.
- Calendar autofill creates guessed bleeding days.
- The profile has current life-stage answers, without a reliable dated history of pregnancy or hormone changes.

Therefore, an assessment needs confirmed start dates, intervening-period completeness and current-context confirmation. Period-duration assessment also needs confirmed bleeding boundaries. Until these are known, show observations and uncertainty.

Use a **rolling six-calendar-month comparison window**, showing the actual dates and number of usable intervals. This updates the earlier proposal’s 12-month window: the FIGO authors’ 2023 explanation specifies the preceding six months, excluding pregnancy and puerperium from that ordinary menstrual assessment. Shorter histories remain explicitly preliminary. [FIGO clinical explanation, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/)

**Cycle regularity**

For eligible consecutive period starts:

`cycle length = next start date − preceding start date`

`regularity spread = longest eligible cycle − shortest eligible cycle`

This is a **range**, not statistical variance, standard deviation or the difference between adjacent cycles.

| Age | FIGO reference limit |
|---|---:|
| 18–25 | Spread ≤9 days |
| 26–41 | Spread ≤7 days |
| 42–45 | Spread ≤9 days |

Source: Munro, Critchley and Fraser, **FIGO 2018**, DOI `10.1002/ijgo.12666`, already **E7**. The later FIGO explanation confirms these bands and notes that norms beyond 45 are less well defined. [FIGO 2018](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666), [FIGO 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/)

Proposed presentation:

- With fewer than three eligible completed intervals: **Building your picture**, with the actual lengths.
- With at least three, an applicable age band and no unresolved gaps: compare the spread with the relevant limit.
- Above the limit: **Worth a chat**, explaining the observed variation.
- Within it: **Within the reference range in these records**, never “healthy cycle”.

Three intervals are a **Rhythme threshold for an initial comparison**, not FIGO validation of a personal baseline. Concerning observations can prompt care before three intervals exist.

The current age choices straddle FIGO boundaries. For example, `25–29` cannot select between 7 and 9 days. Offer an optional matching age band, without requesting date of birth; otherwise show the spread without an age-specific verdict.

**Cycle and bleeding length**

Keep two separate results inside this card:

- **Cycle length:** every confirmed start-to-start interval, compared with **24–38 days inclusive**.
- **Bleeding duration:** each confirmed menstrual episode, compared with **up to 8 days inclusive**. These reference boundaries use **E7**. [FIGO 2018](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666)

Do not judge from the average alone. A short interval and a long interval can average into the reference range.

For a completed episode:

`duration = confirmed final bleeding date − confirmed first bleeding date + 1`

The record must establish continuity. Include spotting that belongs to that menstrual episode; unrelated spotting does not become a new period start. FIGO’s duration definition includes light bleeding or spotting within the episode. [FIGO 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/)

Where continuity or the ending is unknown, show something like:

> “Bleeding recorded on 5 days across a 7-day span. Two days are unknown.”

Never treat `ep.length` or an autofilled five-day period as confirmed duration.

An observed interval outside the reference range or confirmed bleeding beyond eight days can produce **Worth a chat**, without waiting for baseline readiness. The action label is Rhythme’s application of the reference, not a diagnosis.

Heavy bleeding, flooding, large clots and interference with daily life remain separate care observations. Eight days within FIGO’s duration boundary must not override these concerns. NHS guidance also lists periods lasting over seven days among possible heavy-period signs; preserve that distinction rather than making eight days universally reassuring. [NHS heavy periods, E4](https://www.nhs.uk/conditions/heavy-periods/)

For a gap over 60 days:

- If intervening periods are unknown: show **Gap between records**, exclude it from readiness and explain why.
- If the person confirms no intervening period: retain its actual length and care relevance. The prediction filter must not erase it.

**Ovulation evidence**

Today there is **no structured BBT, LH-test or cervical-mucus log**. There is a general **discharge change** symptom, alongside cramps and other nonspecific symptoms. None establishes ovulation.

The current calculated phase and fertile colouring are calendar assumptions, including expected-period-minus-14-days. They must contribute **nothing** to this component.

For the current data, display:

> **Ovulation signs: Not assessed**  
> “Your current records cannot tell whether you ovulated.”

I would offer an **optional TTC observation log**, without making it necessary for readiness:

- Cervical mucus: dry, sticky, creamy, watery, clear/stretchy or slippery, unsure.
- Home LH test: positive, negative, unclear, with date.
- Keep pain and other symptoms in the ordinary symptom diary rather than relabelling them “ovulation pain”.

Its output is **Signs recorded**, with dates and descriptions. It never becomes “ovulation confirmed”, “failed to ovulate” or a better health level. Mucus observations can help identify possible timing; LH tests provide indirect evidence and can be falsely positive or negative. BBT also has limitations and would require a separate collection protocol. [ASRM fertility awareness](https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/), [ASRM fertility evaluation](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/)

**Symptoms and comfort**

Use the last **14 calendar days**, ending today. Calculate three separate measures:

| Measure | Exact calculation |
|---|---|
| Symptom frequency | Days with one or more selected symptoms ÷ days with a symptom selection or explicit **None** |
| Pain | Mean and maximum of explicitly recorded, finite pain values from 0–10 |
| Mood | Low/bad mood days ÷ days with an answered mood |

Show each denominator separately: **Symptoms answered 9/14 days; pain 6/14; mood 8/14**.

A mood-only entry is not a symptom-free day. Food logging is not symptom coverage. Fatigue can be counted as a symptom; there is no numeric energy measure to score.

Proposed level rules, all carrying **Rhythme threshold**:

- **Worth a chat:** any applicable care flag; any recorded pain ≥8; low/bad mood on at least five dates in 14 days, or three postpartum. These prompts do not require additional logging coverage.
- **A pattern worth noticing:** with at least seven answers for the relevant measure, symptoms on more than half its answered days, mean pain ≥4, or low/bad mood on at least three dates.
- **Nothing flagged in these entries:** only when all three measures have at least seven answered days and none of those rules applies.
- Otherwise: **Not enough information for a pattern**, while retaining any supported concern from another measure.

These are proposed product rules, not validated referral cutoffs. **E8 supports the pain scale, not the numbers 4 or 8.** Pain below eight can still warrant assessment, particularly when severe, unusual or disruptive. The current app records bleeding impact, but not general symptom interference with daily life. [NHS period pain, E9](https://www.nhs.uk/symptoms/period-pain/)

A care link should always be available. Urgent symptoms override every level and readiness state. The app must not imply that someone needs five low-mood entries before seeking support.

Also, these 14-day measures describe reported symptoms, not proven cycle-related symptoms. PMS assessment needs a diary across cycles and clinician interpretation; missing post-period entries cannot establish symptom resolution. [RCOG PMS guidance](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/)

**The three-cycle rule**

`readiness = min(eligible consecutive completed intervals, 3)`

**Three completed intervals require four confirmed period starts.** The fourth period need not have finished.

Use:

- **1 of 3:** “Your first complete cycle is recorded.”
- **2 of 3:** “Your cycle picture is taking shape.”
- **3 of 3:** “An initial comparison is available.”

Count confirmed records in the current applicable context, excluding unconfirmed autofill, unresolved missed starts and onboarding recall alone. Show remembered dates separately. Do not combine pre-pregnancy cycles with postpartum cycles or silently reinterpret old records after a hormone change.

Three cycles unlock an initial comparison only. They do not unlock symptoms, care, ovulation evidence or clinical certainty. Readiness earns no hearts and has no deadline.

**Modes and life stages**

| Situation | What the person sees |
|---|---|
| Normal mode, spontaneous cycles | Eligible timing comparisons, actual records and clearly labelled period estimates. |
| Wide mode | A wider estimate is uncertainty, never a health penalty. Eligibility depends on why the mode is wide. Recall alone cannot support a reassuring level. |
| Trying to conceive | Applicable cycle panels plus optional signs. Irregular or absent periods and other fertility concerns can warrant assessment without waiting for three cycles. [ASRM](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/) |
| Pregnant or possibly pregnant | Suspend cycle readiness, period predictions and ovulation assessment. Show symptoms and relevant care guidance. |
| Postpartum or breastfeeding, periods not returned | No cycle countdown or absence-of-period penalty. Show postpartum wellbeing and bleeding observations. |
| Postpartum or breastfeeding, periods returned | Record confirmed intervals descriptively in a fresh context. Do not automatically apply ordinary regularity grading to returning cycles. |
| Perimenopause | Prioritise bleeding changes, symptoms and impact. Show variation descriptively without grading the transition as failure; never extend the age-specific 7/9-day limits beyond their scope. |
| Hormonal contraception, HRT or fertility hormones | No spontaneous-cycle grade or ovulation inference. Bleeding and symptoms remain visible with treatment context. |
| Recent pregnancy loss | Use a recovery-aware descriptive view; do not immediately interpret bleeding as a new ordinary baseline. |
| After menopause | **Body / My wellbeing**, with symptoms, comfort and history. Hide readiness and ovulation cards. Any postmenopausal bleeding, even once or a small amount, prompts assessment. [NHS](https://www.nhs.uk/symptoms/post-menopausal-bleeding/) |

Suspended predictions must never suspend care. Pregnancy-related warning signs also require prompt attention during pregnancy and the year after delivery. [CDC maternal warning signs](https://www.cdc.gov/hearher/maternal-warning-signs/index.html)

**4. Copy and boundaries**

Use these component explanations:

| Card | One-line explanation |
|---|---|
| **Cycle regularity** | “How much the time between your recorded period starts varies.” |
| **Cycle and bleeding length** | “Your recorded cycle lengths and bleeding duration, alongside their reference ranges.” |
| **Ovulation signs** | “Signs you record can add context; Rhythme cannot confirm ovulation.” |
| **Symptoms and comfort** | “Pain, mood and symptoms on the days you answered; other days are unknown.” |

Use **Nothing flagged in these entries**, **A pattern worth noticing**, and **Worth a chat**. Reserve **Within the reference range** for an actual applicable reference comparison. Missing or inapplicable data receive neutral states, not the lowest health level.

The tab never claims fertility probability, confirmed ovulation, ovarian reserve, egg quality, contraception protection, measured hormone levels or a diagnosis.

`PHASE_TIPS` are editorial suggestions, not evidence about the person’s current physiology. They must not influence levels or become personalised treatment claims.

**5. Before release**

The release requirements are concrete:

- **Input integrity:** fix the new symptom editor’s untouched pain slider becoming zero; distinguish confirmed bleeding from autofill; capture episode completeness and current-context boundaries.
- **Calculation tests:** four starts versus three intervals; 7/9-day age boundaries; 24/38-day and eight-day boundaries; unknown age; gaps over 60 days; spotting; missing days; explicit None; duplicate dates; imports, edits and deletions; historical calculations without later-data leakage.
- **Safety tests:** concerning entries work with zero baseline history, every prediction mode and incomplete coverage. Recheck the four personas’ original safety phrases against current code.
- **Consistency:** Cycle, journal, four-week summary and exported clinician report use the same observations, denominators and rule versions.
- **Evidence integrity:** retain permanent IDs. E7 remains FIGO, but the earlier proposal’s E50 onward assignments now collide with other current entries. Append new sources without renumbering.
- **Clinician sign-off:** Dr Patrick or an appropriate women’s-health clinician reviews applicability, every product threshold, escalation wording and the distinction between observation and diagnosis.
- **Persona and phone walks:** repeat Wei Ling’s TTC, Nadia’s postpartum, Siti’s perimenopause and Mrs Tan’s postmenopause journeys. Add a diary-only user who never interacts with the room. Test sleeping-avatar access, direct reopening, large text, screen readers and day/night contrast.

The earlier reviews are evidence for the design decision, not release approval for a new implementation.

**6. What I would push back on**

I support bringing the tab back. I would push back on four things:

- **“Wellness Score out of 100.”** We have no validated meaning for its total, weights or changes over time.
- **“Three cycles makes it reliable.”** It provides more history, not a clinical validation milestone.
- **“Ovulation confirmation from symptoms.”** The current inputs cannot deliver that promise.
- **The same four graded cards for everyone.** Pregnancy, postpartum and menopause need relevant information rather than an impossible cycle goal.

No app changes were made. This read-only session also prevented saving a persistent decision note.

RECOMMENDATION: C

1. Approve calendar-first **Home · Cycle · Food · Mind · You**, with diary access independent of game state and **Body** for postmenopause.
2. Approve **Your cycle rhythm**, readiness counts and component explanations, with no wellness total.
3. Approve the small data additions needed for honest comparisons: matching age band, confirmed bleeding boundaries and current-context confirmation.
4. Decide whether optional mucus/LH observation logging belongs in the first release. My recommendation is to follow the core diary release.
5. Require clinician approval and the repeated persona walks before releasing the levels.

