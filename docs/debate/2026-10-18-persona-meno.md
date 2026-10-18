<!-- Codex gpt-6-astra persona walkthrough, read-only with web search, 18 October 2026. Brief: docs/debate/2026-10-18-persona-brief.md. Claims about app behaviour were re-checked in docs/debate/2026-10-18-persona-safety-recheck.md. -->

*Mrs Tan’s perspective. This is a code-traced walkthrough with isolated parser tests, not a phone usability test. Proposed changes are not validated scoring rules.*

## 1) First open and consent

I want privacy before mentioning vaginal dryness. I leave both optional boxes unticked. Consent v2 explains browser storage, possible data loss, optional AI processing in China, export/deletion and 995 (`room.html:109–124`; `room.js:2013–2016`).

That helps. However, the notice describes sending notes the rules cannot understand, while enabling AI also sends recognised notes longer than 36 characters (`room.html:111`; `room.js:1342–1348`). I would want that explained accurately.

## 2) Onboarding questions

I answer **50+; no period for 12+ months; no pregnancy; not planning pregnancy; no hormones; hot flushes; movement 5+ days; sleep better, calm habits and doctor records**. I leave unspecified history blank and skip optional measurements. Maternal osteoporosis, joint aches, dryness and sleep-onset delay have no matching questions (`room.js:1810–1823`).

Recall and bleeding-duration questions disappear. Assuming no bleeding or urgent symptoms, the result is **`lifeStage: post`, `predictionMode: suspended`, no intake notices** (`room.js:1829,1957–1990`). This is profile classification, not diagnosis.

I appreciate avoiding period reconstruction, but “Perimenopause support” is the nearest goal; my actual stage lacks one (`room.js:1821`).

## 3) The room and hotspots

I can use the bed, clock, food diary, mindfulness mat, bookshelf and wardrobe without cycling (`room.js:21–29,497–508`). You offers editable onboarding, export, deletion and a four-week doctor summary (`room.js:1175–1179`).

These give me reasons to return. “Start your cycle” makes me feel misplaced (`room.js:2111`). I want sleep, comfort and strength foregrounded.

## 4) Logging a typical day through Luna

With AI off, I type these exact sentences:

| My words | Verified local interpretation |
|---|---|
| “Slept 11pm to 7am, quality 2, took an hour to fall asleep.” | 23:00–07:00, quality 2; onset delay disappears. |
| “My hot flushes are easing, but my joints ache and I have vaginal dryness.” | Hot flushes only; easing, aches and dryness disappear. |
| “I walked for 30 minutes today.” | No recognised entry. |
| “I drank tea at 9pm.” | Food tagged caffeine; structured time remains empty. |
| “Meditated 10 min.” | Ten completed mindfulness minutes. |

Sources: `ovu-orb.js:53–94`; symptom vocabulary: `ovu-agents.js:13`.

I can inspect, untick or discard before saving. Unrecognised text offers explicit AI opt-in (`room.js:1311–1320,1361–1368`). Helpful, but incomplete understanding needs clearer highlighting. “No hot flushes today” incorrectly records flushes (`ovu-orb.js:74`).

## 5) The calendar and predictions

I expect a wellbeing calendar. Actual forecasts and phases correctly disappear in suspended mode (`ovu-store.js:231–248`).

Yet Period remains the default, with “Est. fertile”, “No period logged yet” and “I’m menstruating now”. Automatic filling can create assumed bleeding days (`room.js:653–659,685–695,720–723`).

**Safety failure reproduced:** “No period for two years, but spotting today” produces neither an immediate warning nor a persistent postmenopausal flag. Negation suppresses the alert; symptom-only spotting escapes the bleeding check (`ovu-orb.js:39,69–77`; `ovu-agents.js:54–56`).

## 6) Food diary

I want useful meal records without weight shame. Editable portions, meal times, nutrient sources and missing values help (`room.js:812–842,867–877`). NOVA shows coverage and withholds its percentage when insufficiently classified (`ovu-nova.js:85–104`).

However, my no-cycle food guidance becomes generic “Any phase”, without a bone-health focus (`room.js:143,864,877–878`). Tea guidance appropriately says comfort, not treatment; green tea’s caffeine warning lacks bedtime context (`room.js:857–860`; `ovu-herbs.js:23–25`). Evening caffeine merits attention for sleep, according to [NUH](https://www.nuh.com.sg/health-resources/diseases-and-conditions/insomnia).

## 7) Mindfulness and Erin’s podcast

Short breathing sessions and everyday practices fit my walks and bedtime routine. Real-practice confirmation precedes rewards (`room.js:1626–1633,1748–1754,1787–1794`).

Podcast suggestions drop cycle framing when predictions are suspended. Resume, playback speed and sleep timers help; some episodes require Plus preview access (`room.js:1521–1536,1557–1562,1585–1589`; `ovu-podcast.js:33–45`).

I would enjoy companionship, but insomnia benefit remains unverified. Persistent sleep problems affecting daily life deserve assessment, not simply more listening. [NUH](https://www.nuh.com.sg/health-resources/diseases-and-conditions/insomnia)

## 8) Reminders

I would set a wind-down reminder and an earlier tea reminder. Custom text and schedules permit this (`room.js:581–601`).

The promise that notifications work when “installed”, and calendar alarms “always ring”, overstates the evidence: scheduling depends on running page JavaScript (`room.js:566–584`; `ovu-remind.js:81–100`). Calendar export exists, but actual phone delivery is unverified (`ovu-remind.js:103–120`). These should never be presented as monitored care.

## 9) Learn pages and evidence

“After menopause” finally recognises me: bones, intimacy, dryness and assessment of even one bleeding episode (`room.js:130`; `lifecycle-content.js:208–236`). Adjacent source buttons help (`journey.js:16–19`).

I miss an actionable HRT consultation guide. NICE supports individualised HRT discussions and distinguishes vaginal oestrogen, moisturisers and lubricants for genitourinary symptoms. [NICE NG23](https://www.nice.org.uk/guidance/ng23/chapter/Recommendations)

I would start with my GP or polyclinic and ask about [KKH](https://www.kkh.com.sg/our-specialties/whwc/menopause) or [NUH SWANS](https://www.nuh.com.sg/care-at-nuh/services/obstetrics-and-gynaecology/gynaecology/swans--service-for-women-across-the-nation-of-singapore), whose stated service is non-subsidised.

Evidence navigation needs repair: E1–E49 lacks a menopause topic, while life-stage sources are separate. “Open the evidence library” links to legacy home (`ovu-evidence.js:7–17`; `evidence-lifecycle.js:498–606`; `life-journey.html:1`).

## A) What should a cycle wellness score mean?

Call mine **“My wellbeing patterns”**, preferably without one overall number.

Legacy home exposes a Cycle Wellness Score rewarding cycle regularity and penalising age, without a life-stage branch (`home.html:289–303`; `cycle-score.js:96–146`). That measures the wrong things for me.

The deliberate `score:null` in `bio-age.js:106–115` is more honest than inventing a menopause grade.

## B) Which inputs should feed it?

My proposed dashboard would include:

- **Symptoms:** flushes/night sweats, sleep-onset difficulty, waking, fatigue, joint pain/stiffness, dryness, painful intimacy, urinary discomfort, mood and interference with daily life.
- **Circadian patterns:** actual sleep timing, bed/wake consistency, awake periods, daylight exposure and meal timing.
- **Lifestyle:** walking and strength activity, meals, processed-food coverage, alcohol, caffeine amount/time, calm practice and hydration.

These are tracking proposals, not validated numerical weights.

Exclude cycle length, ovulation, fertility and age penalties. Keep weight optional and contextual. Never reward HRT use or non-use. Record maternal osteoporosis for discussion, without equating it with my diagnosis or a parental hip fracture. [NICE fracture-risk guidance](https://www.nice.org.uk/guidance/cg146/chapter/Recommendations)

## C) What must it never imply?

No fertility probability, contraception safety, hormone levels, diagnosis, bone density, biological age or treatment suitability.

I would distrust unexplained weights, improving scores despite worsening symptoms, penalties for ageing, or reassurance after bleeding. A good score must never suppress an alert.

## D) Uncertainty, missing days and small data

Show “5 nights recorded out of 14”, with missing days visibly unknown. Separate symptom-free from unlogged. Do not invent wake times or interpret time in bed as sleep (`ovu-orb.js:62–64`; `ovu-store.js:135–141`).

Build on the existing four-week coverage counts (`ovu-agents.js:168–176`). With little data, say “Not enough information for a pattern.”

## E) Three most valuable changes, ranked

1. **Fix bleeding safety:** clause-aware negation and persistent alerts for spotting across entry types. Files: `ovu-orb.js:39–49`, `ovu-agents.js:54–56`.
2. **Measure my actual sleep:** add sleep-onset delay and night waking; distinguish sleep from time in bed. Files: `room.js:616–628`, `ovu-store.js:135–141`.
3. **Complete the postmenopause path:** symptom-first calendar, dryness/joint questions, bone-history and consultation prompts; remove fertility labels, automatic period fills and legacy scoring for me. Files: `room.js:653–723,1819–1823`, `cycle-score.js:96–146`.

## F) Red flags and exact wording

- **Any vaginal bleeding:** “Even one spot after menopause needs assessment. Contact your GP or polyclinic promptly, even if it stops. Do not assume it is dryness.” [KKH](https://www.kkh.com.sg/symptoms-treatments/menopause)
- **Emergency symptoms:** “Call 995 now for excessive bleeding, collapse, chest pain or trouble breathing. Do not finish logging first.” [SCDF](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services)
- **Persistent abdominal changes:** “New persistent bloating, early fullness, pelvic pain or urinary frequency needs a medical appointment. Do not dismiss it as menopause or weight gain.” [NICE NG12](https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer)

Existing alerts name KKH emergency care and explicitly say no clinician receives them (`room.js:1325–1332`). Preserve that honesty while fixing detection.

*Review only. The read-only session prevented persistent documentation.*

