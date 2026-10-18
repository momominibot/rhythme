<!-- Codex gpt-6-astra persona walkthrough, read-only with web search, 18 October 2026. Brief: docs/debate/2026-10-18-persona-brief.md. Claims about app behaviour were re-checked in docs/debate/2026-10-18-persona-safety-recheck.md. -->

*Wei Ling’s code-based walkthrough, with isolated parser checks. Phone rendering, audio delivery and provider retention remain unverified. No files changed; persistent capture was unavailable in this read-only session.*

## 1) First open and consent

I want privacy before sharing fertility worries. The notice explains browser-data loss, export, optional AI processing in China and 995. I leave optional boxes off (`room.html:110`).

However, one AI checkbox enables notes, photos and readings together (`room.js:2016`). The promise to send notes Luna cannot understand conflicts with sending any note longer than 36 characters when AI is enabled (`room.js:1345`).

## 2) Onboarding questions

I choose 30–34, fairly regular, trying to conceive, 6–11 months, no known conditions, and family “PCOS or endometriosis”. Assuming no suspected pregnancy, hormones, fertility treatment or urgent symptoms, I select none/no. Unspecified dates, bleeding duration and habits remain unanswered (`room.js:1810`).

Result: `lifeStage=ttc`, `predictionMode=normal`, `cycleLength=null` (`room.js:1990`). No fertility-timing or family-endometriosis notice fires (`room.js:1963`). I miss separate maternal history, cyclical distress, caffeine and sleep-timing questions (`room.js:1819`). Current urgent symptoms do trigger care guidance (`room.js:1950`).

## 3) The room and hotspots

I want somewhere calming between disappointing tests. Bed, clock, calendar, computer, wardrobe, diary, mat and window connect routines with logging (`room.js:21`).

You offers editable answers, journal, doctor summary, evidence, export and deletion (`room.js:1175`). Useful, but the four-week summary counts symptoms without analysing recurrence across multiple cycles (`ovu-agents.js:149`). I want my difficult premenstrual week to become understandable.

## 4) Logging a typical day through Luna

Illustrative weekday, assuming 7am waking, with AI off:

| Exact sentence | On-phone interpretation |
|---|---|
| “Slept 1am to 7am, quality 2/5.” | Correct times and quality (`ovu-orb.js:56`). |
| “I feel anxious and low before my period.” | Correct mood/anxiety, **plus false medium-flow bleeding** (`ovu-orb.js:69`). |
| “I drank two coffees at 10am and 3pm.” | Caffeine-tagged food text; no structured dose or times (`ovu-orb.js:79`). |
| “I had chicken rice for lunch.” | Lunch/chicken rice (`ovu-orb.js:79`). |
| “I did breathing for 5 minutes.” | Five completed minutes (`ovu-orb.js:92`). |
| “My ovulation test was positive.” | No entry (`ovu-orb.js:53`). |

Confirmation lets me reject errors (`room.js:1311`). Critically, **“No bleeding, but sudden severe pelvic pain.” suppresses the urgent alert** (`ovu-orb.js:39`).

## 5) Calendar and predictions

I expect uncertainty matching my 28–32-day cycles. Without usable dates/length, predictions remain unavailable; qualifying recalled starts produce a wide estimate (`ovu-store.js:225`).

However, the fertile band still centres on expected-period-minus-14-days (`room.js:706`). There is no dedicated LH-test entry (`ovu-store.js:11`). Tapping a period start creates assumed bleeding days (`room.js:685`). I need autofill distinguished from observations.

The overdue notice waits beyond 45 days and requires prior logged-cycle history (`ovu-agents.js:53`).

## 6) Food diary

I want practical hawker-food logging without fertility guilt. Search, barcode, photo, meal-time and notes are available (`room.js:869`); photo portions are editable (`room.js:1404`).

NOVA withholds percentages below 50% classified coverage (`ovu-nova.js:85`). Tea cautions help (`room.js:857`), but ordering is phase-based without TTC filtering (`ovu-herbs.js:40`). I would not interpret food or herb suggestions as proven fertility improvements. [ASRM](https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/)

## 7) Mindfulness and Erin’s podcast

I want relief from worry, without feeling responsible for conception. Short Erin/breathing sessions and self-confirmed everyday practices suit me (`room.js:1628`, `room.js:1787`).

Podcast phase picks are editorial (`ovu-podcast.js:100`); luteal episode 87 is “The Capacity to Remain Balanced” (`assets/data/erin-podcasts.json:296`).

I miss mood-impact follow-up: the low-mood flag requires seven entries and five low/bad days, without assessing premenstrual recurrence (`ovu-agents.js:64`).

## 8) Reminders

I want weekday wind-down and desk-break nudges. Times/days are configurable (`ovu-remind.js:26`).

But scheduling runs only while the page lives (`ovu-remind.js:81`), despite reassuring installed-app and “always ring” language (`room.js:566`). Closed-phone reliability is unverified. I would not depend on this for care reminders.

## 9) Learn pages and evidence

I choose Grow’s TTC reading, rather than Bloom’s first-period chapter (`lifecycle-content.js:8`, `lifecycle-content.js:59`). Voluntary chapters and numbered sources help (`life-journey.html:1`, `ovu-evidence.js:20`).

Yet the desk links fertility/hormone pages (`room.js:128`) containing **hardcoded 85% conception probability, detected LH surge and “current” hormone levels** (`fertility.html:42`, `fertility.html:52`, `hormones.html:72`). That would destroy my trust. A source register does not validate these personal claims.

## A) What should a cycle wellness score mean?

Call it **“My wellbeing patterns”**, preferably without a composite number. Show comfort, functioning and routines separately.

The legacy calculator rewards regularity and age/profile factors (`cycle-score.js:96`), although the room does not load it (`room.html:130`). Keeping the unsupported wellness composite `null` is the right direction (`bio-age.js:104`).

## B) Which inputs should feed it?

These are proposed design inputs, not validated scoring weights:

- **Symptoms:** anxiety, low mood, irritability, insomnia, fatigue, pelvic/period pain, painful sex/bowel movements, bloating, breast tenderness, bleeding/spotting and functional impact.
- **Circadian:** sleep onset/waking, bedtime/wake consistency, weekday/weekend differences, night waking, morning/evening light and meal timing. My three-hour bedtime shift deserves exploration. Unknown wake times prevent inferring duration. Regularity matters for general health. [Sleep consensus](https://pubmed.ncbi.nlm.nih.gov/37684151/)
- **Lifestyle:** movement, sitting breaks, meals, processed-food coverage, alcohol, caffeine amount/timing, calm practice and hydration.

Keep symptom burden separate from habit achievement. Exclude age, pregnancy success, LH positivity, streaks and cycle regularity from “goodness” points. Down-weight estimated portions, incomplete food logs and inferred phases.

## C) What must it never claim or imply?

No fertility probability, confirmed ovulation, ovarian reserve, hormone levels, contraception, diagnosis or treatment success.

Never imply my coffee, anxiety or missed meditation explains eight months without pregnancy. Arbitrary weights, unexplained precision and reassuring scores that override symptoms would make me distrust it.

## D) How should uncertainty, missing days and small data appear?

Show “3/7 nights logged”, dates, sources and missing fields. Missing means unknown, not zero or healthy. Separate remembered starts, observed bleeding and estimates.

With tiny data, show observations without a composite. Label thresholds as product choices. For premenstrual mood assessment, support daily recording across at least two cycles without delaying help. [RCOG](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/)

## E) Three most valuable concrete changes, ranked

1. **Make Luna safe:** repair urgent negation and false bleeding extraction in `ovu-orb.js:39` and `ovu-orb.js:69`; align transmission with consent in `room.js:1345`.
2. **Remove fabricated personal results:** replace the fertility/hormone outputs in `fertility.html:42` and `hormones.html:72` with clearly labelled education.
3. **Make tracking useful for TTC:** add maternal-history follow-up, functional mood impact and longitudinal sleep/mood review in `room.js:1819` and `ovu-agents.js:149`.

## F) Red flags and exact wording

Proposed wording:

- **Emergency:** “Sudden severe pelvic pain, shoulder-tip pain with tummy pain, collapse or uncontrolled bleeding needs emergency assessment. Go to A&E now. Call 995 if faint or severely unwell. Say pregnancy is possible, even without a positive test.” [RCOG](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/ectopic-pregnancy/), [SCDF](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services)
- **Possible pregnancy:** “One-sided pelvic pain or unusual bleeding needs prompt assessment today. Do not wait for the app’s prediction.” [RCOG](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/ectopic-pregnancy/)
- **Mental-health crisis:** “If you might harm yourself or cannot stay safe, seek emergency help now. Stay with someone. SOS 1767 is available 24/7.” Current local rules miss “I feel like killing myself.” (`ovu-orb.js:37`). [MOH](https://www.moh.gov.sg/seeking-healthcare/find-a-facility-or-service/mental-health-services/)
- **Review:** “Disruptive pain or low mood deserves a GP/polyclinic appointment. At 33, fertility assessment usually starts after 12 months, earlier with suspected endometriosis or other concerns. Mention your mother’s history. Both partners matter.” Ask about KKH/NUH referral. [ASRM](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/), [RCOG](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/), [KKH](https://www.kkh.com.sg/our-specialties/kkivf-centre/2-seek-help), [NUH](https://www.nuh.com.sg/care-at-nuh/services/obstetrics-and-gynaecology)

