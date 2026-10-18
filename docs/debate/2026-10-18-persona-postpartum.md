<!-- Codex gpt-6-astra persona walkthrough, read-only with web search, 18 October 2026. Brief: docs/debate/2026-10-18-persona-brief.md. Claims about app behaviour were re-checked in docs/debate/2026-10-18-persona-safety-recheck.md. -->

*Code-led walkthrough with isolated local-parser tests. Phone notifications, playback and remote AI responses remain unverified. I’m Nadia throughout.*

## 1) First open and consent

I want privacy without losing useful features. I leave both optional boxes unticked. Consent v2 explains browser storage, potential data loss, optional AI processing in China and 995; accepting without AI keeps its settings off. That helps, although it puts backup responsibility on an exhausted parent (`room.html:109–124`; `room.js:2013–2016`).

## 2) Onboarding questions

I choose **30–34; Rare periods; Gave birth in the last year; Breastfeeding: Yes; Periods returned: Not yet**. Assuming no other medicines, I select None. I choose cycle understanding, sleep, calm and doctor records; leave unspecified history, pregnancy plans and body measurements unanswered (`room.js:1810–1824`).

The reproduced result is **`lifeStage: ""`, `predictionMode: "wide"`**, plus a generic “Long gaps between periods” notice. Recall questions disappear, which helps, but breastfeeding does not suspend predictions. There is no question about four months postpartum, exclusive feeding, tear recovery or contraception uncertainty (`room.js:1829`; `room.js:1957–1990`). Urgent questions cover selected pain/bleeding symptoms, not my emotional safety (`room.js:1817`).

## 3) The room and hotspots

I find sleep, reminders, calendar/symptoms, learning, wardrobe, meals, mindfulness and the window. You offers export, settings and doctor-summary access. These make self-care approachable, but I want a visible postpartum check-in (`room.js:21–29`; `room.js:1175–1177`).

Sleep asks bedtime, wake time, quality and notes, then calls elapsed time “sleep.” That misses feeding interruptions (`room.js:616–629`). No room object should imply somebody is monitoring me; even urgent alerts explicitly say no clinician receives them (`room.js:1332`).

## 4) Logging a typical day through Luna

With AI off, these exact sentences produce:

| I type | Local rules understand |
|---|---|
| “Slept 11pm to 7am, woke every 2 hours to breastfeed, quality 2.” | 23:00–07:00, quality 2; waking context discarded. |
| “I feel flat and tearful today.” | Low mood; tearfulness discarded. |
| “My period has not returned.” | **Incorrect medium-flow period.** |
| “I skipped breakfast.” | No entry. |
| “Had chicken rice for lunch.” | Lunch, chicken rice; no meal time. |
| “Meditated 2 min.” | Two minutes of mindfulness. |

These results follow `ovu-orb.js:56–94`. Confirmation before saving helps, but I must catch the mistakes myself (`room.js:1311–1320`).

Safety fails on tested sentences “I want to hurt myself” and “No period, but severe abdominal pain.” Both return no urgent alert; the latter hits a premature negation rule (`ovu-orb.js:37–50`).

## 5) Calendar and predictions

Initially I get **no predicted date or phase**, because there are no usable dates or lengths. That is appropriate; it is not evidence that postpartum predictions were deliberately paused (`ovu-store.js:223–248`).

The calendar still displays “Est. fertile” and asks me to log my last period. With sufficient records, its fertile dates derive from predicted menstruation minus 14 days (`room.js:659`; `room.js:709–720`).

I need: “Your return date is uncertain. Fully breastfeeding may delay periods, and pregnancy can occur before the first period.” [NHS guidance](https://www.nhs.uk/pregnancy/labour-and-birth/your-body/).

## 6) Food diary

I want easy meal records while holding my baby. Notes-only meals, editable portions and missing-value labels help (`room.js:840–842`; `room.js:975–981`). Suggestions follow cycle phase or a generic fallback, rather than breastfeeding needs (`room.js:137–143`; `room.js:864–878`).

Tea cautions mention breastfeeding, but sorting is by phase, not individual suitability (`room.js:860`; `ovu-herbs.js:40–42`). Diary saving provides no dedicated clinical assessment of poor intake or breast symptoms (`room.js:973–983`). I need practical food support, not a restrictive target.

## 7) Mindfulness and Erin’s podcast

Two-to-six-minute sessions and credit for confirmed interrupted practice fit my day (`room.js:1629`; `room.js:1782–1794`). *Take A Pause* offers deliberate playback, resume and a sleep timer; listening earns no hearts, which removes pressure (`ovu-podcast.js:33–68`; `room.js:1534`).

I would use this for a pause, while keeping emotional support separate. The session interface offers no postpartum mood assessment (`room.js:1621–1638`).

## 8) Reminders

I would set gentle meal, drink and support-call prompts. Custom labels/times and calendar export help (`room.js:586–611`).

However, the interface promises notifications while installed and says calendar alarms “always ring”; the actual scheduler checks the current minute while the page runs. Background reliability is unverified, so this cannot be my safety net (`room.js:565–584`; `ovu-remind.js:81–101`).

## 9) Learn pages and evidence

I choose **After pregnancy**, not Bloom’s first-period chapter. Chapters are reading choices, not diagnoses (`room.js:130`; `life-journey.html:1`; `lifecycle-content.js:4–28`).

Nurture covers recovery, contraception, mood and urgent symptoms. Good. Its “recovery guide” repeats the same chapter, leaving tear-specific help thin (`lifecycle-content.js:110–140`; `postpartum-guide.html:1`).

A linked hydration page nevertheless asserts “your Luteal Phase” and progesterone changes “this week,” without my postpartum context. I distrust that personalization (`room.js:131`; `hydration.html:31,111,129`).

Evidence exists, including separate postpartum records, but references do not validate the app’s scoring; E15 is explicitly preliminary (`ovu-evidence.js:34`; `evidence-lifecycle.js:307–311`).

## A) What should a cycle wellness score mean?

Call it **“Postpartum wellbeing check-in.”** Show what needs support, without grading recovery.

The legacy cycle score starts its estimate at 75 after limited data; this is no meaningful baseline for me (`cycle-score.js:60–70,96–109`). Prefer the honest `null` composite and retained observations in `bio-age.js:104–115`. A new numerical postpartum score would require validation.

## B) Which inputs should feed it?

My proposed inputs, not validated scoring weights:

- **Symptoms:** mood, tearfulness, anxiety, enjoyment, coping, fatigue, pain location/impact, bleeding, breast symptoms, urinary/bowel problems. Safety answers trigger separate action.
- **Circadian context:** actual sleep across 24 hours, naps, longest stretch, night wakings, awake time, bed/wake consistency, daylight and meal timing.
- **Lifestyle:** comfortable movement, meal access/regularity, optional processed-food context, alcohol/caffeine amount and timing, hydration and calm practice.

Exclude cycle regularity, absent periods, fertility estimates and weight-loss targets. Down-weight rigid schedules and habit streaks; record infant-driven disruption without penalising me.

## C) What must it never imply?

No fertility probability, contraception protection, diagnosis, hormone levels, milk supply, ovarian age or “good mother” rating. An exact return date, unexplained score or reassurance despite dangerous symptoms would destroy trust.

LAM requires all criteria: no periods, under six months postpartum, fully/nearly fully breastfeeding, with feeding gaps no longer than four daytime/six nighttime hours. My sleep blocks do not establish eligibility. [CDC](https://www.cdc.gov/contraception/hcp/usmec/lactational-amenorrhea-method.html).

## D) Uncertainty, missing days and small data

Say “3 of 7 days recorded,” separately for each domain. Missing means unknown, not healthy or unhealthy. Show observations before trends and explain estimates.

Four-week coverage already exists (`ovu-agents.js:167–176`), but sleep entries are counted as nights, so multiple blocks can distort summaries (`ovu-store.js:143–148`).

## E) Three ranked concrete changes

1. **Repair safety and negation:** postpartum crisis recognition, preserved context, and no false bleeding entries (`ovu-orb.js:37–94`).
2. **Create postpartum mode:** birth date, feeding context, contraception questions, suspended predictions and consistent learning pages (`room.js:1812,1957,1990`; `hydration.html:111`).
3. **Represent fragmented sleep:** episodes, awake time and daily totals, rather than treating blocks as separate nights (`ovu-store.js:143–148`; `ovu-agents.js:125–131`).

## F) Red flags and exact wording

> “Chest pain, trouble breathing, collapse or uncontrolled bleeding: call **995 now**. Severe persistent headache, vision changes or fever of 38°C or above need urgent medical assessment. Say you gave birth four months ago.”

[CDC warning signs](https://www.cdc.gov/hearher/maternal-warning-signs/index.html), [SCDF](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services).

> “Thoughts of harming yourself or your baby need urgent help. If you might act, hear voices or feel confused, call 995 or go to A&E now. Ask someone trusted to stay with you.”

[KKH](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness).

> “A red, painful breast with fever needs prompt assessment. Persistent tear pain, bad smell, wound opening or bowel-control problems also need medical review.”

[NICE](https://www.nice.org.uk/guidance/ng194/chapter/recommendations), [RCOG](https://www.rcog.org.uk/for-the-public/perineal-tears-and-episiotomies-in-childbirth/first-and-second-degree-tears/).

> “You deserve support now. If low mood persists, worsens or affects coping, contact your GP or polyclinic. KKH and NUH offer specialist support. Do not wait for enough diary entries.”

[Polyclinic support](https://polyclinic.singhealth.com.sg/our-clinic-services/imcwh), [NUH](https://www.nuh.com.sg/care-at-nuh/services/psychological-medicine/our-services/programmes---specialised-services/womens-emotional-health-service-wehs). Current mood flags require seven symptom entries and five low/bad entries (`ovu-agents.js:61–65`).

