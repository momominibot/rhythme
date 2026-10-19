# Movement: exercise logging with MET-minutes (19 October 2026)

Jamie: "for the Ovuluna exercise logging, you can put it into Rhythme, you can rebuild it, but use the research that has
already been done at Ovuluna, put it over to Rhythme."

This note records what Ovuluna had, what Rhythme keeps, what was reworded to match the primary sources, and how the
feature is built. Every claim the app shows is listed at the end with the source it was checked against on 19 Oct 2026.

## What Ovuluna had (read in ~/Desktop/ovuluna-dreamy, ovuluna-doubao and ovuluna)

- `exercise.html`: a static mock (hardcoded "420 MET min", "312 active min", a luteal tip). No storage, no logging.
- `exercise-guide.html`: four phases on fixed cycle days (1 to 5, 6 to 13, 14 to 16, 17 to 28), each with an intensity
  band in METs, a session length, best exercises with 2011 Compendium MET values, an "avoid HIIT and heavy lifting" line
  for the period, "schedule your hardest workouts around ovulation", TCM tips, acupressure points, a WHO weekly goal
  ("150 min moderate (5 METs) or 75 min vigorous (7.5 METs) = about 600 to 750 MET-minutes") and four persona notes.
- `learn-lifestyle.html`: "phase-locked training" driven by heart-rate variability, and "8 to 15 MET-hours a week".
- Evidence files: `exercise-cycle` (Daley 2009), `exercise-luteal` (McNulty 2020, with a wrong DOI),
  `exercise-dysmenorrhea` (de Sousa 2021), and the later reconciled `exercise-pms` / `movement-individual-variation`,
  which already concluded "choose movement by symptoms and capacity, rather than a universal cycle prescription".
  `daily-period-care` cites the NHS period-pain page for gentle movement and when to seek care.

## What Rhythme keeps

| Ovuluna idea | In Rhythme | Why |
| --- | --- | --- |
| Log activities as MET-minutes | Kept, with real logging and storage | MET x minutes is the standard unit (US guidelines, Appendix 1) |
| Activity list with MET values | Kept and widened to 18 activities, values updated to the 2024 Adult Compendium with each code stored | The 2011 values changed (Vinyasa yoga 4.0 became 2.7, Pilates 4.5 became 2.8, brisk walking 4.3 became 4.8) |
| WHO weekly goal | Kept and corrected: 150 to 300 moderate minutes, a vigorous minute counts as two, strength on 2 days | WHO 2020 states minutes, not a MET target; moderate is 3 to under 6 METs, vigorous 6 or more |
| MET-minute goal | Kept as a total with context "about 500 to 1,000 a week", no score | That equivalence is in the US guidelines, not in WHO |
| Strength twice a week | Kept | WHO 2020 |
| Gentle movement ideas for the period (walking, yoga, swimming, cycling) | Kept as ideas, not rules | NHS period-pain advice lists exactly these |
| "Listen to your body; if something hurts, stop" | Kept | Matches the personalised approach McNulty recommends |
| Movement may ease cramps | Kept with its real certainty | Cochrane 2019: low certainty, trials mostly in young women |
| Pregnancy and after birth note | Kept, reworded to WHO | See below |
| Later-life note | Kept, reworded to WHO's 65+ advice | See below |
| Acupressure for cramps | Linked to Rhythme's existing cramp relief points | Already built and sourced in the Mind tab |

## What was reworded or left out, and why

- **Fixed-day phases (1 to 5, 6 to 13, 14 to 16, 17 to 28): left out.** Rhythme never assumes a 28-day cycle, and
  McNulty et al. 2020 found only a possibly trivial dip in performance in the early follicular phase, with low-quality
  evidence; the authors say general guidelines cannot be formed and recommend a personalised approach.
- **"Avoid HIIT and heavy lifting on your period": left out, with no intensity advice either way.** No primary source
  supports avoiding intensity while bleeding, and none establishes that any intensity is safe for everyone on their
  period either (Cochrane could not judge harms, and some trials asked women not to exercise while bleeding). The note
  says moving is your choice, gentle exercise may help cramps, listen to your body, and shows the red flags in full.
- **"Schedule your hardest workouts around ovulation": left out.** Same McNulty finding; no phase was clearly better.
- **"Avoid inversions if flow is heavy": left out.** No source was found for harm.
- **Intensity bands per phase (2 to 4, 5 to 9, 7 to 10, 4 to 6 METs): left out** for the same reason as the fixed days.
- **"Moderate = 5 METs, vigorous = 7.5 METs, 600 to 750 MET-minutes": corrected** to WHO's definitions (3 to under 6,
  6 or more) and the US guideline equivalence (about 500 to 1,000 MET-minutes for the WHO range).
- **Phase-locked training from heart-rate variability: left out.** Rhythme has no such signal, and the reconciled
  Ovuluna evidence already retired it.
- **Teen note: left out.** Rhythme is 18+.
- **Trying to conceive, "avoid more than 10 hours a week of high intensity": reworded.** No source for the number. The
  NHS lists "doing too much exercise" as one cause of stopped or missed periods, so the guide says: if your periods
  stop or change while you are training a lot, talk to a doctor.
- **After birth, "wait 6 weeks (vaginal) or 8 weeks (caesarean)": reworded** to WHO: regular activity in pregnancy and
  after birth when there is no medical reason not to, at least 150 moderate minutes a week, aerobic and strengthening,
  start small and build up; in pregnancy avoid excessive heat and humidity (so not hot yoga), contact and high
  fall-risk activities, and lying on your back after the first trimester; return gradually after birth, and after a
  caesarean plan the return with a health professional; stop and get advice if new symptoms appear.
- **Menopause, "moderate cardio helps hot flashes": left out.** The 2023 menopause society position statement (E24,
  already in Rhythme) does not support exercise as a treatment for hot flushes. Kept: WHO's advice for 65 and over to
  add balance and strength on 3 or more days.
- **TCM tips (cold drinks, liver qi): left out of Movement.** They are not about exercise and have no exercise source.

## How it is built

- **Entry type `exercise`** in `ovu-store.js` TYPES. Data: activity id and label, variant id and label, Compendium code
  and MET (stored, so a later table change never rewrites history), minutes (1 to 600), intensity (light, moderate,
  vigorous), whether it was strength work, optional note. Many entries a day are allowed.
- **`ovu-exercise.js`** holds the activity table and the pure maths: intensity from MET, a rolling 7-day summary
  (moderate and vigorous minutes, moderate-equivalent minutes, MET-minutes, strength days, light minutes) and the
  period context. "Other" has no MET; it counts toward minutes by the effort chosen and is left out of the MET total,
  shown as such, never counted as zero.
- **Strength work** counts in MET-minutes but not toward the aerobic minutes (US guidelines treat muscle-strengthening as
  separate). A strength day is the person's own tick "worked all my main muscle groups, at moderate effort or more"
  (WHO's definition). Aerobic MET intensity never overrides it, because muscular effort is a different measure: the NHS
  lists yoga, Pilates and tai chi as muscle-strengthening (page reviewed 22 May 2024), though their METs are light.
  "Strength or weights" pre-ticks it but never locks it. Another activity ticked as strength (a circuit) counts both as
  aerobic minutes and as a strength day.
- **MET-minutes**: the total covers everything with a known MET; the "about 500 to 1,000" guide is compared with the
  MET-minutes of moderate and vigorous aerobic activity only, which is what the US guideline equivalence describes
  (300 minutes of hatha yoga is 690 MET-minutes but 0 toward WHO's minutes).
- **Where it lives**: a Movement tile on the mat (Mind tab), `room.html#move`, the old `exercise.html` and
  `exercise-guide.html` stubs now point there, and a Movement folder on the Learn desk. The journal lists the entries.
- **The period note** shows when today has a logged period day or logged cramps, never from a predicted phase.
  Spotting is not treated as a period (the store keeps it out of period episodes too); with cramps logged, the card
  speaks about cramps without calling the day a period.
- **Hearts**: the first exercise log of the day earns 6 (the same as a meal), plus the usual streak bonus when it is the
  day's first log of any kind; later exercise logs that day earn nothing. Hearts
  never depend on minutes, effort or MET, so there is no reason to log more or harder than you did. This follows
  Jamie's rule (hearts for logging data) and the economy review's "one award per domain per day, nothing for health
  outcomes".
- **Cloud sync**: the server's entry table only accepts the seven older types, and one rejected row fails the whole
  upload. `ovu-sync.js` now holds back rows the server rejects by type, remembers them, uploads everything else, and
  sends the held rows again on later syncs, so nothing is lost and the watermark cannot skip them. A held row edited
  during its upload stays held until the newer version is sent. While rows are held, You says "N Movement entries not
  backed up yet", the Sync now toast counts every row still waiting (not only this request's refusals), and "Delete
  everything on this phone" warns they would be lost. A hold is released only when that version went up or the cloud's
  version won the merge; an older remote deletion that loses does not release it. A phone whose app learns a new entry
  type pulls that type alone once from the start (`type=in.(exercise)`), so rows an older version dropped come back
  while older entries someone cleared on purpose stay cleared. That pull walks the type's rows in id order (`order=id.asc`,
  resuming after the last id, kept as `typedAfter`) and never moves the shared cursor, so rows of other types arriving
  meanwhile are still pulled. Ids are unique, so rows sharing one `synced_at` (the server stamps one `now()` per upload)
  cannot be skipped or fetched forever. A backlog over 20,000 rows resumes on the next sync, and only a scan that
  reached the end marks the type as known. The migration
  `20261019120000_exercise_entries.sql` widens the check; it is written but not applied (production migrations wait
  for Jamie).

## Sources checked on 19 October 2026 (evidence register E9 and E67 to E72)

- E67 WHO 2020 guidelines (Bull et al., BJSM, PMC7719906): adults 150 to 300 min moderate or 75 to 150 min vigorous
  or an equivalent combination, plus muscle-strengthening on 2 or more days; moderate 3 to under 6 METs, vigorous 6 or
  more; some activity is better than none, start small and build up; pregnant and postpartum women without
  contraindication at least 150 min moderate a week; 65 and over add balance and strength on 3 or more days.
- E68 US Physical Activity Guidelines, 2nd edition (2018), Appendix 1: 1 vigorous minute counts as 2 moderate minutes;
  the 150 to 300 / 75 to 150 range equals about 500 to 1,000 MET-minutes a week.
- E69 2024 Adult Compendium of Physical Activities (Herrmann et al., J Sport Health Sci, PMID 38242596) and
  pacompendium.com: every MET value and code in `ovu-exercise.js`; tailored to adults aged 19 to 59.
- E70 McNulty et al., 2020, Sports Medicine (PMID 32661839): possibly trivially lower performance in the early
  follicular phase, low-quality evidence, no general guideline, personalised approach.
- E71 Armour et al., 2019, Cochrane CD004142.pub4 (PMID 31538328): exercise about 45 to 60 minutes, three or more
  times a week, regardless of intensity, may reduce period pain (low-quality evidence); trials exercised through the
  month, some asked women not to exercise while bleeding; unclear for women over 25.
- E9 NHS, Period pain (reviewed 18 March 2026; the existing entry, now also under Movement): gentle exercise like
  yoga, swimming, walking or cycling; urgent appointment if pain is severe or worse than usual and painkillers have not
  helped; see a GP if periods become more painful, heavier or irregular, pain stops usual activities, pain during sex
  or when peeing or pooing, bleeding between periods.
- E72 NHS, Stopped or missed periods (reviewed 12 June 2026): "doing too much exercise" is a cause; see a GP after
  three missed periods in a row or if periods become irregular.
