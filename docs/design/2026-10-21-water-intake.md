# Water in the food diary (design, 21 Oct 2026, v1 for Codex review)

Jamie, 21 Oct: "Let's put water intake under food diary. Today's check-in should put water intake instead of food. Based on weight to calculate how much water intake required a day? Reward user points who have drink that amount of water but we need to factor in if they have any kidney disease. We don't want to stress the kidney."

## 1. What is built

- **Where**: the food diary's Today pane gets a water strip at the top: today's total, quick-add buttons (a glass 250 ml, a cup 200 ml, a small bottle 500 ml, "other" with an ml field), a list of today's sips with Undo, and the day's guide with the words it rests on. Nothing elsewhere counts water; Luna and the summary agents do not see it (section 7).
- **Today's check-in**: the Food tile becomes a Water tile ("Water" with `water_full`). It is a key tile by default, as Food was. Food is still logged in the diary as before and keeps its own hearts; it stops being a check-in tile (Jamie's words: "instead of food"). The quick answer "Nothing to log for food today" becomes "No water logged today" (an answer, not a tick).
- **The day's guide**: one number in ml, shown as "about 1.6 L today" with how it was reached. It is a guide, never a prescription, and never a bar that fills red.
- **Hearts**: once per real day, the first time the day's logged total reaches the guide: the flat logging award for the kind `water` (6 hearts, the same as food), under the existing once-per-kind-per-day rule and clock watermark. Nothing for logging alone, nothing for more than the guide, no streak, nothing on a backdated day, nothing in care mode (section 4).
- **Data**: `state.water = { on, answers: {...}, days: { 'YYYY-MM-DD': [{ ml, at }] } }` through `OvuStore.commit` (rollback on a failed save, as the farm and fasting do). No new diary type, so the server's entries check constraint and Luna's model-output filter are untouched. Water is in the diary export and goes with Delete everything. It does not sync to the cloud in this version; the strip says so.

## 2. The guide, and where its numbers come from

Rhythme anchors on the adequate intake for drinks, then adjusts within bounds. Every figure below is shown to her as a chip, never as a hidden assumption.

| Step | Rule | Source |
|---|---|---|
| Baseline, drinks only | 1.6 L a day for women (2.0 L for men is not used; Rhythme is for women) | ESPEN 2022 R61: "Older women should be offered at least 1.6 L of drinks each day ... unless there is a clinical condition that requires a different approach" (Grade B), itself derived from EFSA's total water adequate intake of 2.0 L for women with about 20 to 30 percent from food. Singapore's HPB: "eight glasses a day (about two litres)" is "a useful guide in general", and that count includes fluid from food (reviewed 27 June 2025). NHS: 6 to 8 cups or glasses a day. |
| Weight | Jamie asked for a weight-based number. The common rule of thumb is 30 to 35 ml of total water per kg; with about 20 percent from food that is roughly 25 ml of drinks per kg. Rhythme uses `25 ml x kg`, clamped between 1.5 L and 2.5 L, and only when a weight is on record (her latest scale entry or the intro). Without a weight, the baseline stands. The per-kg rule is clinical folklore more than guideline: it is labelled "Rhythme's rule of thumb" with its own chip, never attributed to EFSA or HPB. | US DRI: adults 19 to 30 total water AI 2.7 L a day for women, about 80 percent from fluids (NAM 2005). The per-kg figure appears in nutrition practice (and in Singapore press advice of 30 to 40 ml per kg) but in no guideline Rhythme can cite; hence the clamp and the chip. |
| Pregnancy | +300 ml | EFSA 2010 (total water AI in pregnancy +300 ml). HPB and NHS: pregnant women need more. |
| Breastfeeding | +700 ml | EFSA 2010 (lactation +700 ml). HPB and NHS: breastfeeding women need more. |
| Heat and exercise | No number. One line: "More on hot days and after exercise; thirst and pale yellow urine are good guides." | NHS (pale yellow urine; more in heat and with activity), HPB (more if you exercise or sweat heavily). |
| Ceiling | Logging past 4 L in a day shows a quiet note and never adds anything: "That is a lot for one day. Drinking far beyond thirst can lower blood sodium; if you feel unwell, please get advice." The log still accepts the entry (it is her record). | NAM 2005: no upper level, but acute water toxicity after rapid intake beyond the kidney's roughly 0.7 to 1.0 L an hour; Hew-Butler et al. 2017: drink to thirst; overdrinking above thirst causes exercise-associated hyponatraemia. |

The guide is recomputed each day from the profile and the latest weight; a change mid-day changes the guide, never the hearts already given.

## 3. Eligibility first: the questions

The strip opens with four questions the first time, like the fasting step. Not sure counts as yes for the first three.

1. Do you have kidney disease, or are you on dialysis?
2. Do you have heart failure, or has a doctor asked you to limit how much you drink (fluid restriction, low sodium, SIADH)?
3. Have you had kidney stones?
4. (From the intro, locked here) Pregnant, possibly pregnant or in the year after a birth; breastfeeding.

She can answer again at any time from the strip.

## 4. Modes

| Mode | When | What she sees | Hearts |
|---|---|---|---|
| **Guide** | all no | The guide, the quick-add buttons, today's total and sips | Once a day on reaching the guide |
| **Care** | kidney disease or dialysis; heart failure; told to limit fluids; not sure on any of those | The log only. No guide number, no progress, no colour. One line: "Your care team sets how much you should drink; log what you drink and take the numbers to them." A second line for heart failure in Singapore: "HealthHub's heart failure page says not more than 1.5 L a day or as your doctor instructs; follow your doctor." | None. The tile ticks when any water is logged (a record, not a target). |
| **Stones** | kidney stones, nothing else ticked | The guide is replaced by the stone-prevention amount with its source: "For stone prevention the NHS says 2.5 to 3 L of water a day; if your clinic gave you a number, use theirs." | Once a day on reaching 2.5 L; the ceiling note moves to 4.5 L. |

Why care mode gives no number: more water does not help the kidneys in CKD (CKD WIT, Clark 2018 JAMA: coaching to drink more did not slow eGFR decline), and in advanced kidney disease, dialysis and heart failure the right amount is a restriction set by the clinician (HealthHub heart failure: not more than 1.5 L or as instructed). A general app number in either direction can be the wrong number. Nothing in Rhythme rewards drinking in care mode, so nobody is nudged against a restriction.

## 5. Copy rules

No "hydration goal", no streak, no percentage, no "you are dehydrated". "Guide", "about", "so far", "logged". The strip never says what water does for skin, weight, energy or the cycle. The care line names 995 only for the existing emergency card (not here).

## 6. Evidence entries (E95 to E100, topic `water`)

- E95 EFSA 2010, Scientific Opinion on Dietary Reference Values for water (EFSA Journal 8(3):1459): total water AI 2.0 L a day for women, +300 ml pregnancy, +700 ml lactation; food provides roughly 20 to 30 percent. (Verify the page; the Wiley host refused automated reads today.)
- E96 Volkert et al. 2022, ESPEN practical guideline on clinical nutrition and hydration in geriatrics, R61: at least 1.6 L of drinks a day for older women, 2.0 L for men, unless a clinical condition requires a different approach.
- E97 HealthHub (HPB), The best refreshment, reviewed 27 June 2025: eight glasses (about two litres) as a general guide including fluid from food; more with exercise, sweating, pregnancy, breastfeeding and illness. HealthHub, Heart failure: monitoring fluid and salt intake: not more than 1.5 L a day or as instructed by your doctor.
- E98 NHS, Water, drinks and hydration: 6 to 8 cups or glasses a day; pale yellow urine; more in heat, with activity, in pregnancy and breastfeeding. NHS, Kidney stones, prevention: 2.5 to 3 L of water a day.
- E99 Clark et al. 2018, JAMA 319(18):1870, CKD WIT: coaching to increase water intake did not slow kidney function decline (adjusted difference in eGFR change −0.3 ml/min/1.73 m2, P = .74).
- E100 Hew-Butler et al. 2017, Front Med 4:21, Exercise-associated hyponatremia update: overdrinking above thirst with fluid retention causes it; drink according to thirst. NAM 2005 DRI for water: no upper level; acute water toxicity when intake outruns the kidney's roughly 0.7 to 1.0 L an hour.

## 7. What it does not do

- No water in Luna's prompts, the summary agents, the clinician PDF or the share (a later version can add a plain daily total to the journal once the data has a sync path).
- No reminders to drink (the reminders module is untouched).
- No weight entry is created or changed by this feature; it only reads the latest.
- Not for children: Rhythme is 18+.

## 8. Tests

Core: the guide maths (baseline, weight clamp, pregnancy and breastfeeding adds, stones), mode selection from answers, the once-a-day award at the guide and never above, care mode pays nothing, the ceiling note, day totals from timestamps, Undo, rollback on a failed save, no model payload contains water. Smoke: the strip before and after the questions, a care-mode profile, three sips reaching the guide once with hearts once, the check-in tile swap, reload persistence, the night theme.
