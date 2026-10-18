<!-- Codex gpt-6-astra persona walkthrough, read-only with web search, 18 October 2026. Brief: docs/debate/2026-10-18-persona-brief.md. Claims about app behaviour were re-checked in docs/debate/2026-10-18-persona-safety-recheck.md. -->

*Code walkthrough plus isolated rule tests, not a phone UI test. I am Siti; unspecified history stays unknown. No changes made.*

## 1) First open and consent

I want privacy and clear limits. I confirm my age, leaving AI and improvement sharing off. Consent explains browser-local storage, possible data loss, optional China-based AI processing and 995 (`room.html:109–124`). You offers export/deletion (`room.js:1177–1195`).

Helpful, but enabling AI sends even recognised notes longer than 36 characters online, beyond the notice’s “cannot read” wording (`room.js:1342–1345`).

## 2) Onboarding questions

I select **45–49, irregular, night sweats**, and sleep/perimenopause/calm/doctor-record goals. Hypertension and its medicine require generic “other” options. Assuming no pregnancy possibility or conception plans, I select those answers. Menarche, family history, exact dates and bleeding duration remain unknown; optional measurements/habits are skipped (`room.js:1810–1824`).

The result is **`lifeStage: peri`, `predictionMode: wide`** (`room.js:1957–1961,1990`). Heavy bleeding generates an intake notice only if I select the flooding/protection-frequency description; “very heavy” alone does not establish that answer (`room.js:1816,1965`). Current urgent symptoms trigger immediate guidance (`room.js:1927,1950–1954`).

My pattern is compatible with perimenopause, but heavy bleeding needs separate assessment. [NICE](https://www.nice.org.uk/guidance/ng23/chapter/Recommendations), [KKH](https://www.kkh.com.sg/wise/menstrual-problems).

## 3) The room and what the hotspots offer

I want an easy evening check-in. Bed, clock, calendar, computer, wardrobe, diary and mat offer sleep, reminders, cycle/symptoms, learning, outfits, meals and mindfulness (`room.js:22–29,497–508`). You provides updated intake and doctor-sharing links (`room.js:1175–1177`).

This feels approachable, but I want symptoms and care access more prominent than decoration. The app explicitly says nobody monitors records or receives alerts (`room.html:67`).

## 4) Logging a typical day through Luna

With AI off, these exact sentences produce:

| What I type | What local rules propose |
|---|---|
| “I had night sweats and woke at 3 am.” | Incorrectly, a **food entry**. |
| “I am irritable and forgetful.” | Nothing recognised. |
| “Slept 11pm to 7am but awake from 3am.” | 23:00–07:00, discarding wakefulness: **eight hours**. |
| “Hot flushes, insomnia, irritability and brain fog.” | All four symptoms. |
| “Period heavy with clots, affected my day.” | Heavy flow, clots and impact. |
| “Had chicken rice and kopi for lunch.” | Lunch and caffeine tag, no meal time. |
| “Meditated 5 min.” | Five mindfulness minutes. |

Reproduced from `ovu-orb.js:53–94` and `ovu-store.js:135–141`.

“Save ticked” prevents automatic saving, but I should not need special vocabulary (`room.js:1311–1320`). Urgent checks normally precede parsing and display 995/KKH guidance (`room.js:1323–1342`). However, **“No bleeding but severe pelvic pain.” suppresses the warning** (`ovu-orb.js:39`).

## 5) The calendar and predictions

With dates skipped, I initially get no forecast (`room.js:1990; ovu-store.js:223–244`). Later, wide mode extends the observed range by three days each side (`ovu-store.js:234–244`).

Useful uncertainty, but fertile colouring still uses estimated next period minus 14 days (`room.js:706–716`). Tapping a new past start can save assumed bleeding days, requiring correction (`room.js:664–698`). I want observations clearly separated from guesses, especially when documenting heavy months.

## 6) Food diary

I want practical meal and caffeine records. Date/time, search, barcode, photos and tags help; dedicated caffeine-dose and alcohol-unit fields are absent (`room.js:862–874`). Photos require separate processing permission (`room.js:935–942`).

NOVA withholds percentages with poor coverage, sensibly (`ovu-nova.js:85–93`). Tea cards display medicine cautions, but selection sorts by phase, not my hypertension medication (`ovu-herbs.js:25,37–42`). I would not interpret this as personalised clearance.

## 7) Mindfulness and Erin’s podcast

Short guided pauses fit life with teenagers (`room.js:1626–1633`). Everyday practices require my confirmation before completion credit (`room.js:1782–1796`). Podcast resume and sleep timers help at night (`ovu-podcast.js:33–45; room.js:1586`).

I still want a care route for persistent insomnia. Menopause-specific CBT is a guideline-supported option; a podcast should not imply equivalent treatment. [NICE CBT guidance](https://www.nice.org.uk/guidance/ng23/resources/access-to-cognitive-behavioral-therapy-cbt-13553197309).

## 8) Reminders

I would set a wind-down reminder. Custom times/days and calendar export are available (`room.js:588–593; ovu-remind.js:103–120`).

However, “open or installed” and “always ring” overpromise: the scheduler checks the current minute while the page runs (`room.js:566–584; ovu-remind.js:81–100`). Background delivery is **unverified**. I would not depend on it for essential medication.

## 9) Learn pages and evidence

I expect relevant, credible education. Life chapters are voluntary reading choices (`life-journey.html:1`). Perimenopause content covers symptoms, individual treatment choices and unusual bleeding; Bloom could help conversations with my teenagers (`lifecycle-content.js:8–32,165–185`). Its support action points to a general helpline directory (`lifecycle-content.js:201–203`).

A serious contradiction: the desk links a page hard-coding **LH surge, ovulation tomorrow and 85% conception probability**, unsupported by my measurements (`room.js:129; fertility.html:41–59`).

Numbered sources help, but E15 is explicitly preliminary conference evidence, not app validation (`ovu-evidence.js:34`).

## A) What should a “cycle wellness score” mean?

Call it **“My wellbeing patterns.”** Show symptom burden, daily functioning and chosen habits separately.

The legacy score rewards regularity and penalises age over 40 (`cycle-score.js:117–144`). It is wired to older Home, not the room’s scripts (`home.html:659–675; room.html:130–145`). That poorly serves my priorities. Prefer the explicit unavailable score in `bio-age.js:106–115` until a composite is validated.

## B) Which inputs should feed it?

**Proposed, unvalidated design:**

- **Symptoms:** bleeding amount/duration, flooding/clots, pain, sweats/flushes frequency and bother, awakenings, fatigue, mood, irritability, concentration, vaginal/urinary symptoms and daily impact.
- **Circadian context:** bed/wake timing and consistency, estimated actual sleep, night-waking minutes, morning/evening light and meal timing.
- **Lifestyle context:** movement, meals, processed-food coverage, alcohol/caffeine amount and timing, calm practice and hydration.
- **Separate context:** medication and measured BP. Exclude age penalties, predicted ovulation, “perfect” 28-day cycles, logging streaks and weight-loss rewards. Down-weight uncertain food/photo estimates.

Habits must never cancel symptom warnings.

## C) What must the score never claim or imply?

No fertility probability, contraception, diagnosis, hormone measurement, ovarian reserve, menopause date, cardiovascular clearance or treatment success.

I would distrust unexplained weights, precision from sparse entries, age punishment, or a reassuring total during heavy bleeding.

## D) How should uncertainty, missing days and small data be shown?

Show “4 nights recorded out of 14,” not a complete fortnight. Distinguish missing, symptom-free and zero. Show dates, ranges, provenance and correction controls; withhold comparisons when coverage differs.

Four-week summaries already expose coverage and domain counts (`ovu-agents.js:169–174`). Minimum-data thresholds need validation, not invented certainty.

## E) Three most valuable concrete changes, ranked

1. **Make urgent guidance dependable:** fix negation/history handling and everyday symptom language in `ovu-orb.js:39–89`.
2. **Record my actual nights:** add sweats severity, awakenings and time awake; distinguish time in bed from sleep in `room.js:616–620` and `ovu-store.js:135–148`.
3. **Remove unsupported reproductive certainty:** correct `fertility.html:41–59`, fertile colouring in `room.js:709`, and phase assertions in `ovu-store.js:248–254`.

## F) Red flags and exact wording

> “Bleeding heavily now or sudden severe pelvic pain? Seek urgent assessment now at A&E or KKH’s 24-hour Urgent O&G Centre. Do not finish logging first.”

[KKH urgent-care guidance](https://www.kkh.com.sg/our-specialties/urgent-og-centre).

> “Uncontrolled bleeding, collapse or difficulty breathing? Call 995 now.”

[SCDF emergency guidance](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services).

> “New heavy/prolonged bleeding, bleeding between periods or after sex, or any bleeding after 12 months without periods needs medical review. Do not assume it is perimenopause.”

[KKH menstrual guidance](https://www.kkh.com.sg/wise/menstrual-problems).

> “Book a polyclinic/GP appointment. Bring your bleeding record and medicine list. Ask about anaemia testing and menopause support, including KKH or NUH.”

[NICE heavy-bleeding guidance](https://www.nice.org.uk/guidance/ng88/chapter/Recommendations), [KKH access](https://www.kkh.com.sg/patient-services/contact-us), [NUH menopause services](https://www.nuh.com.sg/care-at-nuh/services/obstetrics-and-gynaecology/gynaecology).

