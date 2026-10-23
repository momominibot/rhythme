# Codex diff review 1: Tideline Gym workouts (22 Oct 2026)

gpt-6.1-sol, read-only, on commit 4fdc40c (before the rebase onto main). Verbatim:

Found **four P1s, three P2s, and one P3**. No files changed. Core suite: **1,848 passed, zero failed**. Browser smoke was inspected, not rerun.

1. **P1: Failed restoration leaves her permanently in workout clothes.**  
   `room.js:583–608`, `turnInto()` / `undress()`.  
   **Trigger:** During a workout, choose an uncached wardrobe outfit, then Stop while its image request fails.  
   **Failure:** `undress(false)` clears `costume` before restoration succeeds. The error handler has no recovery; her gym picture remains. Subsequent cancellation cannot repair it because `costume` is already null. Reproduced with the actual room functions.  
   **Fix:** Retain restoration ownership until completion, preserve a decoded own-outfit fallback, and invalidate pending restoration on cancellation.

2. **P1: Bedtime in another tab makes her invisible.**  
   `ovu-gym.js:170–176,271–273`, `unmount()` / store subscriber; `room.js:3665`.  
   **Trigger:** Start a workout in tab A, then tap Good night in tab B.  
   **Failure:** A receives `external`; gym cancellation removes the strip but leaves the avatar hidden because `asleep()` is true. A never enters the sleep renderer, so neither avatar nor sleeper appears. Reproduced: workout inactive, avatar hidden, zero strips.  
   **Fix:** Reconcile external sleep transitions with the destination and sleep renderer. Preserve hidden visibility only when another renderer actually owns it.

3. **P1: Locking during dressing credits hidden time toward the minimum minute.**  
   `ovu-gym.js:151–166,195,275`, `mount()` / `tick()` / visibility handler.  
   **Trigger:** Begin, lock during costume or strip loading, return and Resume, then Stop after **59.9 seconds** of visible activity.  
   **Failure:** Hidden mounting starts the clock; the first hidden tick credits 100 ms. The resulting total reaches 60 seconds and offers a one-minute entry. Reproduced with the actual runner.  
   **Fix:** Mount hidden workouts paused with zero elapsed time. Do not add hidden allowance to the last observed active timestamp.

4. **P1: A delayed Pause or visibility event credits suspension as exercise.**  
   `ovu-gym.js:225,275`, `pause()` / visibility handler.  
   **Trigger:** Run ten seconds, suspend execution for two minutes, then deliver visibilitychange or Pause before the next interval tick.  
   **Failure:** These paths call unrestricted `clock.hold()`, bypassing `tick()`’s suspension guard. Reproduced: the log offers **two minutes after ten active seconds**.  
   **Fix:** Centralize suspension-aware accounting in every pause and finish path. Test both visibility-first and input-first delivery orders.

5. **P2: Another tab’s reset or import leaves the old workout running.**  
   `ovu-gym.js:271–274`, store subscriber.  
   **Trigger:** Run a workout in A; delete everything or restore a backup in B.  
   **Failure:** `ovu-store.js:141` reports these operations to A as `external`, while gym recognizes only literal `clear` and `import`. Authentication remains, so the workout and pending log offer survive the replacement diary.  
   **Fix:** Persist a reset/import generation and invalidate running and pending gym work when it changes. Preserve ordinary external-save behavior.

6. **P2: Zoom crops the working avatar instead of following her.**  
   `ovu-gym.js:158–162`, `mount()`; `ovu-camera.js:52–58`, `focus()`.  
   **Trigger:** Begin cycling at fitted zoom, then press + to zoom 3.  
   **Failure:** Gym hides `#avatar`, making camera focus null. Zoom consequently uses the scene centre. Bike feet at `(36,75.5)` map below the viewport at approximately `(8%,126.5%)`, cropping her lower body.  
   **Fix:** Supply the worker’s visual focus to the camera while retaining valid floor coordinates for walking.

7. **P2: Reselecting Strength silently restores the strength-day tick.**  
   `room.js:2677–2686,2708`, `openExercise()` / `renderVars()`.  
   **Trigger:** Complete curls, Stop, tap the already selected Strength tile, choose reps, then Save.  
   **Failure:** The gym clears the checkbox only during initialization. `renderVars()` subsequently sets it back to true, counting a whole strength day without her ticking it.  
   **Fix:** Honor `strengthTick:false` throughout the form until she explicitly changes the checkbox.

8. **P3: Pause does not freeze an ongoing crossfade.**  
   `ovu-gym.js:185–188,225`, `paint()` / `pause()`; `room.css`.  
   **Trigger:** Pause weights just after its two-second transition, or mats just after five seconds.  
   **Failure:** The opacity transition continues for the remaining 900/1,200 ms. The added `.paused` class has no corresponding behavior.  
   **Fix:** Freeze computed opacities and transitions, or select a deterministic paused still.

The tests materially overclaim coverage:

- **Costume ownership:** block `2k7c2` mocks `dressFor()` and `undress()`. Regex assertions cannot establish successful restoration or cancellation of image races.
- **Animation:** “frames have moved on” checks only `frame >= 0`. Removing `paint(false)` in memory still passes **39/39 gym checks**.
- **Sleep:** the harness expects a hidden avatar without checking that a sleeper is visible.
- **Timing:** hiding is tested only after mounting; suspension is tested only with the interval running first.
- **Browser coverage:** `gym_checks` omits hidden/lock, reduced motion, wardrobe changes, props rebuilds, second-tab changes, sign-out, and pending-offer takeover. Its bedtime assertion never checks arrival home or the bed sheet.

The inspected activity guards otherwise recognize gym ownership for Morning start, PULSE, sessions, practices, seats, and greenhouse care. Props rebuilds retain the existing strip and clock.

VERDICT: HOLD

