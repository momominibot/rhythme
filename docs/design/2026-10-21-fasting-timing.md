# Fasting timing in the food diary (design v2, 21 Oct 2026)

Jamie, 21 Oct: "For the food diary I want to track fasting timing as well." Rhythme is a women's health diary used by
someone trying to conceive, someone weeks after a birth and breastfeeding, someone in perimenopause and someone after
the menopause. Version 1 of this page went to a Codex design review (`VERDICT: REVISE`, nine required changes); this
version is what gets built. Section 8 says how each requirement is met.

## 1. What it is, in one breath

A record she keeps of when a fast began and when it ended, and a plain reading of the gaps between her timed food
entries. Both live behind one switch she turns on after a short eligibility step. Nothing counts up while she fasts,
nothing is a target, nothing is a streak, nothing earns a heart, nothing is compared with yesterday.

## 2. Evidence (ledger, corrected 21 Oct 2026)

| Claim the app may make | Source | Supports | Does not support |
|---|---|---|---|
| Eating in a shorter daily window has mostly been studied for weight in adults with overweight. In a review of trials that were all or mostly women, the average loss was small and most other measures showed no statistically significant difference, including against ordinary calorie restriction. | Chen et al., Frontiers in Nutrition 2025 (PMC12479299): 13 RCTs, 612 participants (women or at least 85% women; some men included), search to Aug 2024; trials in diabetes excluded | weight −1.9 kg (95% CI −3.7 to −0.2); fasting insulin lower; BMI, fat mass, glucose, lipids, blood pressure: no significant difference; against calorie restriction alone no significant difference; only four trials reported adverse events (mild, early, transient) | anything about cycles, fertility, pregnancy or menopausal stage |
| Whether a shorter window changes cycle hormones is not established. | Kalam et al., Obesity 2022 (PMC9877115): 8 weeks, 12 premenopausal and 11 postmenopausal women, 4 to 6 hour windows | testosterone, androstenedione, SHBG measured in both groups, no change; DHEA fell about 13 to 14 percent in both, within reference ranges; estradiol, estrone and progesterone measured in postmenopausal women only, no change | ovulation, fertility or cycle safety; cycle phase was not recorded; n = 23; perimenopause excluded; effects not separable from weight loss |
| Trials in PCOS that looked at periods did not find an advantage over daily calorie restriction. | Talebi et al., 2024 randomised trial in PCOS (PubMed 39143654) | menstrual and gonadal outcomes assessed; no significant advantage over calorie restriction | benefit or harm to cycles in women without PCOS |
| In women across reproductive stages, one quasi-experimental study combined a shorter window with exercise. | Jóźwiak et al., J Transl Med 2024 (doi 10.1186/s12967-024-05738-y) | that perimenopause has been studied at all | causal conclusions: allocation was not randomised and exercise was part of the intervention |
| Fasting is linked with disordered eating in young women; the direction is not known. | Ganson et al., Eating Behaviors 2022 (PubMed 36368052): 2,762 Canadians aged 16 to 30, cross-sectional | intermittent fasting in the past year reported by 47.7% of the women in this sample; associated with eating disorder psychopathology and behaviours, most consistently in women | causation; any safe duration; any interface rule |
| Never delay or skip meals if you are pregnant, breastfeeding, have had or are prone to an eating disorder, or have diabetes; tell your care team before changing your diet if you take medicines. | NHS (My Health London), Intermittent fasting page (no clinical review date shown) | the eligibility questions and the care line | |
| Fasting raises the risk of a hypo with insulin and other medicines that can cause hypos; break a fast at once if sugar drops too low or with hypo symptoms (shaky, sweaty, disorientated); treat a hypo as your team has shown you. People on insulin, with eye, kidney or nerve complications, children, older people, pregnant people and anyone unwell are usually not expected to keep a religious fast. | Diabetes UK, Religious fasting and diabetes, reviewed 28 Aug 2026 | the medicines question and the hypo line | a numerical glucose threshold (none given); an absolute prohibition for every insulin user (these are religious-fasting exemptions) |
| Severe confusion, a fit, unconsciousness or not being able to swallow is an emergency: call 995. | NHS, Low blood sugar (hypoglycaemia) | the escalation line | |
| In pregnancy and while breastfeeding no special diet is needed, with a healthy breakfast every day and plenty of fluids. | NHS, Have a healthy diet in pregnancy (reviewed 21 Apr 2023); NHS, Breastfeeding and diet (reviewed 15 May 2026) | ordinary meal logging as usual | that any timing display is safe or useful in pregnancy or lactation (these pages say nothing about that) |

Scoped uncertainty the app states where it matters: these sources do not establish a fertility benefit, an individually
safe fasting length, safety in pregnancy or lactation, or any benefit from seeing timing statistics. Neither 16 nor 72
hours is a validated safety boundary; no number in this feature is one.

## 3. Eligibility (feature-local, unknown withholds)

The profile cannot express diabetes, hypo-causing medicines, an eating-disorder history, being underweight or frail, or
breastfeeding beyond the first year, so their absence from the profile means nothing. The first time she opens
Fasting, five questions, each answered yes, no or not sure:

1. Could you be pregnant, are you pregnant, or did you give birth in the last year? (pre-filled yes from `pregState`
   `maybe`, `pregnant` or `postpartum`; a yes cannot be changed here, only in the intro)
2. Are you breastfeeding? (pre-filled from `breastfeeding`)
3. Do you take insulin, or any medicine for diabetes or blood sugar?
4. Have you ever had an eating disorder, or eating you would call restrictive? (pre-filled yes from `signals: restrict`,
   which also covers intense training; she may change this one)
5. Have you lost weight without meaning to, been told you are underweight, or are you under 18?

The record control opens only when all five are **no**. A yes or a not sure keeps it closed and shows, once, a plain
line of why with the care sources, and the question can be revisited from the sheet. Trying to conceive (`plans ttc`) is
treated as a precaution, not a medical rule: the sheet says so and the control stays closed. These are product choices
labelled as such, not diagnoses. Answers live in `state.fasting.elig` with a date; the intro's own fields win when they
say yes.

## 4. What she sees

Nothing fasting-related appears anywhere until the switch is on. Meal entries keep their times as today.

### The switch
In the food sheet: "Fasting timing: off · Turn on". Turning on runs the eligibility step (section 3) and sets
`state.fasting.on = true`. "Hide fasting" turns it off again and hides every number below, the history included (the
records stay in the diary export and come back when she turns it on again).

### The record
- "Start a fasting record" saves a start (now, or a time she types, today or yesterday). The sheet then shows "Fasting
  record open since 20:15 yesterday" with **End record** and **Leave unchanged**. No counter. No colour.
- Ending asks for the end time (now, or typed). The length is shown once, as a fact, in the history line:
  "20:15 to 09:40 · 13 h 25 m". History lists past records with Edit and Delete.
- One open record at a time. If two open records exist (two tabs, an import), the sheet shows both with their start
  times and asks her to end or delete one; nothing is chosen for her.
- A record open for more than three days is shown as "open since Monday 20:15, which is probably forgotten" with End
  at a time and Delete; it is never ended for her and never shown as still running.
- Saving a meal while a record is open offers, once, in the meal's own confirmation: "End the fasting record at this
  meal's time (12:30)?" with **End record** and **Leave unchanged**. The offer appears only for a meal dated today with
  a time she confirmed (section 5), after the record's start; the meal is saved either way, and if the end cannot be
  saved the message says "Meal saved; fasting record unchanged." A care card from the save takes the screen first and
  the offer waits.

### The gaps, read from timed entries
Shown only with the switch on, under the record: "Timed food entries today: first 08:10, last 19:40, 11 h 30 m
apart. Gap since yesterday's last timed entry: 12 h 30 m." The journal's food block shows, for the summary period:
"Median span between first and last timed entries: 11 h, across 12 of 28 days with two or more timed entries. Entries,
not measured fasting." The medians are shown separately (first time, last time, span), never as one interval.

## 5. Which times count

A food entry's time counts only when it is confirmed: new entries carry `timeSet: true` when she touched the time
field, or when the save happens within 90 minutes of the entry's time on the entry's own date (logged at the meal).
Older entries count when their `createdAt` falls within 90 minutes of their time on the same date; otherwise they are
shown as "time not confirmed" and left out of spans and gaps. Entries without a time are missing coverage, said so. One
confirmed entry in a day gives no span (unavailable, not zero). Duplicate times do not make two occasions. Calendar
days are literal: 00:15 and 23:45 on one date are 23 h 30 m apart; the overnight gap uses the previous calendar day's
last confirmed entry, which may fall outside the displayed range and is fetched for it.

## 6. Data

`state.fasting`, owned by `ovu-fasting.js`, written through `OvuStore.setState` (the store is not changed):
`{ on, elig: { answers, at }, records: [ { id, startAt, startOffset, startLocal, endAt, endOffset, endLocal, note, createdAt, updatedAt } ] }`
with `startAt`/`endAt` as UTC instants, the offset minutes the device had, and the wall-clock local strings for display
and editing. Durations come from instants; the local strings are what she edits, with the instant recomputed from the
device offset at edit time. Validation refuses a non-string time, an end before the start, a future end, a start more
than 30 days ago, a note over 200 characters, and anything not a record. State is part of the diary export and of
Delete everything (the store exports and clears the whole database), and is not synced to the cloud: fasting records
stay on this phone in this version, and the sheet says so. No new diary type, so Luna's model-output filter
(`S.TYPES`) cannot create one, the server needs no migration, and the multi-tab session's `ovu-store.js` is untouched.
`timeSet` on food entries is one new optional boolean in existing food data.

## 7. Care

- Under the record control, always: "Fasting is not for pregnancy or breastfeeding, for anyone with diabetes
  medicines that can cause low blood sugar, under 18, or with a history of disordered eating. Stop and eat if you feel
  faint, shaky, sweaty or confused. With diabetes, treat a low as your care team has shown you. Severe confusion, a fit,
  fainting that does not pass or trouble swallowing: call 995." (E81 to E90)
- A note typed with a record runs through `OvuOrb.urgent(note, profile)` and shows its card if there is one; the
  feature does not claim the rules know about fasting. The design asks the safety owner (not this work) to consider
  "fasted ... dizzy" and "fainted while fasting" as feature context; a short list of such phrases is in section 9.
- No fasting figure ever reaches the summary agents or Luna's inputs (`summary.food` is left alone).

## 8. What the review required and how it is met

1. Eligibility with unknown-withholds, using current fields and the feature's own questions → section 3.
2. Hiding applies to every number, overnight gaps and summaries; nothing shown until the switch is on → section 4.
3. Care text corrected, the safety-rule claim and the 16-hour note removed → section 7.
4. Seven evidence rows corrected, universal nulls replaced by scoped uncertainty, two studies added → section 2.
5. Confirmed time provenance and "entries, not measured fasting" wording → sections 4 and 5.
6. Time zone and date semantics, concurrent open records, stale offers, over-cap recovery → sections 4 and 6.
7. Fail-closed validation and no indirect creation: no new type, state owned by the module → section 6.
8. History editing, sharing, PDF, loading, deletion: own renderer in the journal; nothing on the doctor's page or in
   the PDF this round; scripts loaded on `room.html` and `journal.html` → section 10.
9. Tests cover the integration paths named → section 10.

## 9. For the safety owner (`ovu-orb.js`, not touched here)

Phrases met in this design that today return nothing: "fasted 20 hours, dizzy", "fainted while fasting", "no food
since yesterday and shaky". A fast is context; dizziness, fainting and shakiness are the signs.

## 10. Code and checks

- `ovu-fasting.js`: pure `confirmedTime(entry)`, `dayTimes(entries, date)`, `gapFromPrevious(entries, date)`,
  `summary(entries, from, to)` (separate medians, the denominator), `validateRecord`, `openRecords`, `conflict`,
  `eligible(answers, profile)`, `offerFor(meal, record)`; then the sheet, the food-sheet strip and the journal block.
- `room.js`: the food sheet's strip (one call), `timeSet` on the time input and in the saved data, the post-save offer
  (one call, after the care card). `journal.html`: one block and the script tag. `sw.js`: cache list and VERSION.
- `ovu-evidence.js`: E81 to E90.
- `tools/test-core.js`: the time rules (touched, logged at the meal, backdated default, no time, duplicates, midnight,
  one entry), the medians and the counter-example from the review (08:00 to 09:00, 10:00 to 20:00, 18:00 to 19:00 gives
  a one-hour median span), the overnight gap across the range edge, records (valid, end before start, future end,
  conflict with two open, the three-day flag), eligibility for each answer and the pre-fills, the meal offer rules
  (yesterday's meal, unconfirmed time, a meal before the start), no reward and no summary change, the module writing
  nothing but `state.fasting` and `timeSet`.
- `tools/e2e_smoke.py`: nothing shown before the switch; the eligibility step with a yes closes the control; all no
  opens it; a record started, a meal offer, ended with the length shown once; two timed meals give the span line;
  Hide fasting removes every number; a reload keeps the record; the pregnant profile sees the control closed with the
  reason.
- `python3 tools/check.py`.

## 11. Not built

Cloud sync of records, the doctor's page and PDF lines, reminders, a timer, charts, Luna reading records, a diabetes or
eating-disorder field in the intro (Jamie's call), recommendations of any kind.
