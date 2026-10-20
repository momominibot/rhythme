Reviewed `8da2131`: **13 FIXED, 3 NOT FIXED**. `node tools/test-core.js`: **788 passed, 0 failed**. No files edited. Verification used source inspection and in-memory reproductions.

O = original finding number; N = numbered new defect in the re-review.

| Item | Status | Scenario and evidence |
|---|---|---|
| O1 | **FIXED** | “Chest pain: none” returns null. `ovu-orb.js:109` |
| O2 | **FIXED** | Calf swelling with period cramps raises `LEG_CLOT_TODAY`. `ovu-orb.js:146` |
| O6 | **FIXED** | “Positive test for covid” plus period produces no pregnancy alarm. `ovu-orb.js:138` |
| O7 | **FIXED** | Hearing friends in the kitchen produces no alarm. `ovu-orb.js:129` |
| O10 | **NOT FIXED** | Close/reopen Luna: emergency bubbles replay without restoring `careOn`; tea can start alongside them. `room.js:1725` |
| O11 | **FIXED** | Meditation cancels the moment; delayed coffee cannot overwrite standing afterward. `room.js:1887`, `room.js:2307` |
| O13 | **NOT FIXED** | Tudung remains selectable and persisted despite zero assets; thumbnails break. `room.js:122`, `room.js:490`, `room.js:1351` |
| N1 | **FIXED** | Positive urine pregnancy test plus unilateral pain raises `ECTOPIC_NOW`. `ovu-orb.js:138` |
| N2 | **FIXED** | Swollen leg “and not painful” retains its warning. `ovu-orb.js:145` |
| N3 | **FIXED** | Explicit hallucination during a doctor call retains its warning. `ovu-orb.js:170` |
| N4 | **FIXED** | Fever/urinary pain with denied pregnancy gets same-day guidance. `ovu-orb.js:150` |
| N5 | **FIXED** | Sleeping-related numbness no longer raises stroke warning. `ovu-orb.js:166` |
| N6 | **FIXED** | Period-return confirmation with `hormones:['pop']` preserves suspension. `room.js:837` |
| N7 | **NOT FIXED** | Postpartum medium flow plus pain 10 no longer throws, but still loses the period-return button. Reopening does not recreate it. `room.js:837` |
| N8 | **FIXED** | Delayed laksa response cannot contaminate a reopened draft. `room.js:1048` |
| N9 | **FIXED** | Failed reading pose starts a replacement standing load; green kebaya displays. `room.js:2371` |

**New defects introduced by these fixes:**

- **P1, postposed denial:** “Chest pain no fever” changes `CHEST_BREATH_NOW → null`. “Chest pain no relief after resting” also loses its warning. The following denial incorrectly cancels chest pain. `ovu-orb.js:109`.
- **P1, stroke exclusion:** “My arm is weak but no pins and needles” changes `STROKE_NOW → null`. Sentence-wide matching treats even a denied explanation as grounds for suppression. `ovu-orb.js:113`, `ovu-orb.js:166`.
- **P1, missed voices warning:** “I hear voices no one else can hear while in the kitchen” changes `PSYCHOSIS_NOW → null`: “no one” fails negation checking, and “kitchen” suppresses the fallback. `ovu-orb.js:107`, `ovu-orb.js:129`.
- **P2, psychosis false alarm:** “I hear voices on the radio telling me the weather” changes `null → PSYCHOSIS_NOW`. The unconditional branch bypasses ordinary-source filtering. `ovu-orb.js:170`.
- **P2, lazy-gap false alarm:** “I have a bad headache but my vision is not blurry” changes `null → HEADACHE_VISION_NOW`; matching stops before the denial. `ovu-orb.js:130`.
- **P1/P2, pregnancy-window errors:** “I have a positive test and blood in my discharge” loses `PREG_BLEED_NOW`; “Positive covid test but not pregnant and my period started today” gains it. `ovu-orb.js:138`.
- **P2, stale care flag:** Navigate directly from Luna’s warning to Food: `careOn` remains true after the warning disappears, suppressing ordinary moments. `room.js:524`, `room.js:2317`.
- **P2, contradictory confirmation:** Suspended users now receive “Predictions start again” despite remaining suspended. `room.js:837`.

