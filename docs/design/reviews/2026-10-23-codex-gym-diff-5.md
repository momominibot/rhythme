# Codex diff review 5: Tideline Gym workouts (23 Oct 2026)

gpt-6.1-sol, read-only, through commit d7a63bd over 903e02d. VERDICT: MERGE. Verbatim below; the two remaining P3s are
follow-ups, listed in docs/design/2026-10-22-gym-workouts.md, section "After diff review 5".

| Review 4 finding | Status | Evidence |
|---|---|---|
| P2: Mind → Everyday/You → Close strands the log | **FIXED** | ask(), lines 260–264 (ovu-gym.js:260) no longer waits on idle meditation. openExercise(), line 2749 (room.js:2749) releases that meditation state. |
| P3: Never-settling restoration has no deadline | **FIXED** | watchRestore(), lines 625–628 (room.js:625) falls back after five 1.2-second checks. Actual-function probes recovered the original picture at 6,000 ms. |
| P3: Failed standing outfit plus an action pose leaves no fallback | **NOT FIXED; fair follow-up** | dressFor(), line 602 (room.js:602) discards action poses; `wearOwn()` cannot recover without `back`. This requires failed images and specific timing, fitting the requested P3 category. |

The review 2 P1 sequences remain fixed. Actual-function probes confirmed that a second workout during pending restoration inherits the original fallback, and a newer failing picture triggers recovery through the watchdog. Settling `restoring()` when the workout picture has gone did not reproduce either regression.

Two P3 defects remain, ranked:

1. **P3: The retained fallback can also become an undecoded, failing URL.**

   **Functions:** `dressFor()`, `wearOwn()`, `watchRestore()` in room.js, lines 602–645 (room.js:602).

   **Sequence:** Begin in base clothes, choose an uncached outfit during the workout, leave the gym while its restoration request remains held, return and begin another workout before it resolves, then let that outfit fail.

   **Failure:** Silent restoration immediately assigns the requested URL. The second workout captures that URL as its fallback and discards the decoded base picture. On cancellation, `back === own`, so line 644 installs no recovery handler; the watchdog considers the non-workout filename settled. The avatar can remain broken.

   This is another manifestation of the deferred fallback defect. Both sequences reproduced with the actual restoration functions.

   **Fix:** Retain the last successfully decoded standing picture independently of the current `src`; replace it only after a successful load.

2. **P3: A briefly opened breathing overlay can escape offer cancellation.**

   **Function:** `finish().ask()` in ovu-gym.js, lines 261–267 (ovu-gym.js:261).

   **Sequence:** Stop after a minute behind Mind. Immediately after an offer poll, open Light Flower or Koi Pond setup and close it within 400 ms.

   **Failure:** Both overlays only toggle `btap-open`, without emitting an activity event. The next poll misses the intervening experience and opens the stale workout log. It opens after the overlay closes; holding the overlay across a poll correctly cancels the offer. An in-memory runner probe reproduced this with a 200 ms opening.

   **Fix:** Cancel the offer synchronously when either overlay opens. Test an entire open/close between polls.

No additional confirmed P1 or P2 emerged from the requested timing, lifecycle, activity, navigation, wardrobe, camera, tudung, reduced-motion, game-save and sign-out sweep.

The tests need these qualifications:

- Core line 3981 (tools/test-core.js:3981) checks restoration source patterns; the runner mocks dressing at line 4012.
- Browser lines 373–406 genuinely exercise the Mind child paths and unresolved restoration request.
- Browser lines 415–429 exercise props rebuilding and another tab’s save, rather than a server game-save pull.
- Browser lines 252–268 compare grounding against the same station coordinates used for placement. They establish anchoring, not independent agreement with the painted equipment.
- The overlay tests hold it open across several polls, missing P3 item 2.

Reviewed all five commits through `d7a63bd` against `903e02d`. **Core suite: 1,870 passed, zero failed.** Browser smoke inspected, not rerun. No files changed.

VERDICT: MERGE
