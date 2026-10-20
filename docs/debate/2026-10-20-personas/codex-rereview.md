Reviewed `9a33a41`: **9 FIXED, 7 PARTLY FIXED.** No files edited by me. Numbers match the original review.

| # | Status | Verification or remaining failure |
|---|---|---|
| 1 | **PARTLY FIXED** | Original examples pass, but “Chest pain: none” still raises `CHEST_BREATH_NOW`; postposed denial is ignored. `ovu-orb.js:106` |
| 2 | **PARTLY FIXED** | Original examples pass. “I have left calf swelling with period cramps” still returns null: cramps suppress the independent swelling. `ovu-orb.js:138`, `ovu-orb.js:172` |
| 3 | **FIXED** | “I am breathless even at rest” now raises `CHEST_BREATH_NOW`. `ovu-orb.js:119` |
| 4 | **FIXED** | Medium flow plus pain 10 evaluates both saved entries and raises `PAIN_SEVERE_TODAY`. `room.js:834`, `room.js:2683` |
| 5 | **FIXED** | Previously logged heavy flow plus Luna’s “Dizzy today” now displays the newly discovered `HEAVY_DIZZY_NOW`. `room.js:1737` |
| 6 | **PARTLY FIXED** | Original COVID/due examples pass. “Positive test for covid and my period started today” still raises `PREG_BLEED_NOW`; exclusions stop at “test”. `ovu-orb.js:130` |
| 7 | **PARTLY FIXED** | TV/Zoom examples pass. “I am hearing voices from my friends in the kitchen” still raises `PSYCHOSIS_NOW`. `ovu-orb.js:162` |
| 8 | **FIXED** | Year-old pink-discharge notes no longer produce current care cards; recent notes still do. `ovu-orb.js:424` |
| 9 | **FIXED** | Changing onboarding timestamps no longer resumes postpartum predictions; summary uses effective mode. `ovu-store.js:339`, `ovu-agents.js:207` |
| 10 | **PARTLY FIXED** | Hand-saved care cancels moments. Luna’s `urgentCard()` does not: active tea persists, and queued tea can start over its emergency card. `room.js:1743`, `room.js:2316` |
| 11 | **PARTLY FIXED** | Start tea, enter Mind, start breathing before its timeout, then resolve coffee after timeout and stop before one minute. The finished coffee pose reappears permanently: session state prevented restoration and generation invalidation. `room.js:2307`, `room.js:2368`, `room.js:1890` |
| 12 | **FIXED** | Every retry checks walking; both walk hooks cancel moments. `room.js:2318`, `room.js:2746` |
| 13 | **PARTLY FIXED** | Missing poses preserve clothing, but tudung remains selectable with zero assets, persisting an unsupported outfit and breaking thumbnails. `room.js:122`, `room.js:489`, `room.js:1350` |
| 14 | **FIXED** | Streak increments/display removed; total logged days retained. `ovu-rewards.js:89`, `room.js:1350` |
| 15 | **FIXED** | Reduced-motion moments omit animation classes; CSS also overrides them. `room.js:2324`, `room.css:1667` |
| 16 | **FIXED** | The original end/emoji/hide sequence clears `say`. `room.js:2298` |

New defects, ranked, with old-versus-current rule outputs independently reproduced:

1. **P1: Explicit pregnancy test loses urgent assessment.** “I have pain on my left side and a positive urine pregnancy test” changes `ECTOPIC_NOW → null`. The new `urine` exclusion rejects an explicitly named pregnancy test. `ovu-orb.js:129`, `ovu-orb.js:131`.

2. **P1: Denied pain erases positive swelling.** “My leg is swollen and not painful” changes `LEG_CLOT_TODAY → null`. The greedy match includes both assertions; internal negation discards both. `ovu-orb.js:107`, `ovu-orb.js:137`. Swelling remains a documented [DVT symptom](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/).

3. **P1: Ordinary-source exclusions suppress explicit hallucinations.** “I am hallucinating while on a call to my doctor” changes `PSYCHOSIS_NOW → null` because of “call”. `ovu-orb.js:162`. Explicit hallucinations still warrant [urgent assessment](https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/hallucinations-hearing-voices/).

4. **P2: Denied pregnancy escalates care.** “I have fever and painful peeing but I am not pregnant” changes `FEVER_INFECTION_TODAY → FEVER_INFECTION_NOW`. `hasBaby()` ignores negation. `ovu-orb.js:142`, `ovu-orb.js:171`.

5. **P2: Sleeping-related numbness now triggers stroke alarm.** “My arm is numb with pins and needles from sleeping on it” changes `null → STROKE_NOW`. Splitting at “and” prevents the exception seeing the explanation. `ovu-orb.js:99`, `ovu-orb.js:111`.

6. **P2: Period-return button overrides other suspension reasons.** With postpartum status and `hormones:['pop']`, clicking it changes suspended predictions to wide, despite `predictionModeFor()` still requiring suspension. `room.js:837`, `room.js:2570`.

7. **P2: Postpartum care destroys the button’s insertion target.** Saving medium flow plus pain 10 opens care, removing `#calMsg`; the handler then throws while inserting “This is my period back”, and its catch throws again. Entries survive; the choice disappears. `room.js:835`, `room.js:837`, `room.js:545`.

8. **P2, merge regression: delayed food estimate contaminates another draft.** Request laksa, close/reopen the diary, start another meal, then resolve the request. Laksa enters the new global draft. `room.js:1003`, `room.js:1049`.

9. **P3: Failed pose request cancels a valid outfit load.** Select kebaya-green, then Learn before its image loads. Missing `read-kebaya-green` invalidates the standing request; old clothing remains until moment expiry. `room.js:487`, `room.js:2367`.

No additional concrete merge regression found in `room.css` or `sw.js`.

**Checks:** `node tools/test-core.js`: **776 passed, 0 failed**. `python3 tools/check.py` was blocked by temporary-file restrictions; the same checker through an in-memory/stdin adapter passed: **81 pages, 0 problems**, 154 scripts checked. Concurrent asset and smoke-test edits were observed; tudung absence was rechecked.

