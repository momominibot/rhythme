**Found reproducible defects despite 754 passing core checks.** Ranked by severity:

1. **P1: Negation both hides emergencies and invents them.** `ovu-orb.js:95–96`, `ovu-orb.js:105`  
   “No improvement in chest pain” and “No fever and my chest is tight” return no card. Conversely, “My face is not swollen” returns `ALLERGY_NOW` because the negation falls inside the regex match. **Fix:** scope negation to the individual symptom assertion, including internal/postposed negation. Do not treat an unrelated preceding “no” as denying every subsequent symptom.

2. **P1: Whole-note exclusions suppress independent warning signs.** `ovu-orb.js:139–140`, `ovu-orb.js:153`  
   “My face is drooping and I have pins and needles in one arm” returns nothing. So does “My left calf is swollen and painful, also period cramps.” **Fix:** apply benign explanations only to their associated symptom; never let `pins and needles`, exercise or unrelated cramps veto another positive warning sign. Unilateral pain and swelling warrant assessment. [NHS guidance](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/)

3. **P1: Ordinary breathlessness wording is missed.** `ovu-orb.js:102`  
   “I am breathless even at rest” returns no card; only particular “short of breath” constructions match. **Fix:** add `breathless`/`breathlessness` alternatives with rest, sudden-onset and worsening qualifiers. SCDF explicitly lists breathlessness among emergency examples. [SCDF guidance](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services)

4. **P1: Severe pain entered through the period form misses its care card.** `room.js:831–832`  
   Save today’s medium flow with pain **10/10**. The handler saves a separate symptom entry but passes only the period entry to `afterSave()`. Reproduced: `entryUrgent(period)` returns null; `entryUrgent(symptom)` returns `PAIN_SEVERE_TODAY`. **Fix:** retain both saved events, evaluate both for care, and display the highest-priority card while awarding the logging action once.

5. **P1: Luna suppresses care discovered only after saving.** `room.js:1719`, `room.js:2660`  
   With heavy flow already logged, send “Dizzy today” through Luna. The initial text produces no card, but the saved symptom produces `HEAVY_DIZZY_NOW`. `viaLuna=true` suppresses that card under the incorrect assumption it was already shown. **Fix:** pass the actual previously displayed alert code and display any newly discovered alert, rather than suppressing all care for Luna saves.

6. **P2: Pregnancy detection confuses unrelated tests and expected periods with pregnancy risk.** `ovu-orb.js:113`, `ovu-orb.js:148`  
   “Positive covid test yesterday, period started today” produces `PREG_BLEED_NOW`. “My period is due tomorrow and pain on my left side” produces `ECTOPIC_NOW`. **Fix:** require pregnancy-specific context for positive tests, and restrict the late-period branch to genuinely late, missed or overdue periods; exclude merely “due.”

7. **P2: Ordinary audible voices trigger a psychiatric emergency.** `ovu-orb.js:106`  
   “I am hearing voices from the TV” produces `PSYCHOSIS_NOW`, as does “People are watching me on Zoom.” **Fix:** distinguish explicit ordinary external sources from reported hallucinations or persecutory beliefs. Ask for clarification on ambiguous statements instead of treating every occurrence as an emergency.

8. **P2: Historical notes bypass the care-date restriction.** `ovu-orb.js:397`  
   For a currently postmenopausal profile, saving “pink discharge today” against a date one year ago produces a current `POSTMENO_BLEED` card. Equivalent structured spotting outside 28 days correctly returns null. **Fix:** apply explicit date windows to note-derived prompt cards too, matching structured-event rules rather than exempting every `prompt` result.

9. **P2: Postpartum predictions depend on a mutable setup timestamp.** `ovu-store.js:337–338`  
   A legacy postpartum profile with `periodsBack:'no'`, mode `wide`, July onboarding and August/September starts predicts October 24. Changing only `onboardedAt` to October 20 suspends predictions. Updating the intro rewrites this timestamp. **Fix:** consistently suspend while `periodsBack === 'no'`; resume through an explicit return-of-periods update. Derive summary wording from effective `cs.mode`, not just stored `predictionMode`.

10. **P2: Existing or queued cheerful moments survive care cards.** `room.js:2657–2660`, `room.js:2296`  
    Start `moment('tea')`, then save an emergency symptom: the care sheet opens while the coffee pose and warmth-related thought remain. A queued walking retry can also start a fresh moment over the card. **Fix:** cancel active moments, pending retries and pending pose loads whenever care appears; clear the thought and refuse delayed starts while care is displayed.

11. **P2: Late image loads permanently restore finished poses.** `room.js:2342`, `room.js:485`  
    Start a learning moment, end it, resolve the standing image, then resolve the earlier reading image. The avatar remains reading although `momentOn` is null. The same race overwrites newer outfits. **Fix:** use one shared image-request generation counter across `setPose()` and `setOutfit()`, invalidated on restoration/interruption; stale callbacks must not assign `src`.

12. **P2: Moment retries start poses while walking continues.** `room.js:2296`  
    Keep the walking class active beyond 900 ms: the retry bypasses the walking check and installs the reading pose. The walking engine rejects `act-*` sprites as outfits, so the avatar slides without its walk animation. **Fix:** retain the walking guard on every attempt, and cancel/restore moments on both `walk` and `beforeWalk`.

13. **P2: The selectable tudung outfit has no assets.** `room.js:122`  
    No file under `assets/room/dream` contains `tudung`. Selecting it persists the choice, but the standing image never changes and profile thumbnails break. The eleven new moment poses also lack outfit variants and fall back to base clothing. **Fix:** supply the required assets before exposing these combinations, or hide unavailable options and preserve the current clothing.

14. **P2: The visible streak remains.** `ovu-rewards.js:89`, `room.js:1334`  
    Consecutive logging still increments a streak; missing a day resets it, and You displays “N-day streak.” Removing its bonus did not remove this pressure mechanism. **Fix:** stop updating/displaying consecutive-day streaks and retain the existing total-days-logged count.

15. **P2: New moments animate under reduced motion.** `room.js:2298`, `room.css:826–827`  
    `moment()` still adds animated classes. Their more-specific `!important` rules beat the reduced-motion `.avatar img` rule. **Fix:** omit animation classes when `reduced`, or add a sufficiently specific reduced-motion override after these rules.

16. **P3: The thought bubble can retain `say` indefinitely.** `room.js:2287`  
    `endMoment()`, followed by `showThought('🌸')` before the 400 ms cleanup, then `hideThought()`, leaves `say` attached. **Fix:** explicitly clear the text-mode class when switching to an ordinary thought or hiding it.

Validation: **754 core checks and 155 syntax checks passed.** Browser smoke testing was blocked by the sandbox’s denial of the local server socket. Consent purpose bodies remain unchanged. No confirmed new sync/account-isolation or XSS defect surfaced. No files were edited.

