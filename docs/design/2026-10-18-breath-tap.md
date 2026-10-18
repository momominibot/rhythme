# Moon Tap: a dreamy, no-fail breath tapping game (design, version 2, 18 October 2026)

Jamie's brief: a therapeutic breath tapping mini game that follows the mindfulness research approach rather than
the arcade one: no failure, self-paced, micro-rewards, short sessions. Version 1 was reviewed by Codex
(gpt-6-astra, read-only, web search; verbatim in `docs/debate/2026-10-18-breath-tap-codex-review.md`). Every
point below marked "changed" comes from that review and was checked against the primary source it cited.

## What it is, in one line
Breathe comfortably with a ring that opens and closes. Tap if you like, or just watch. Nothing is scored.

## The loop (changed)
- Your Luna companion (the look chosen in You) floats in a dark dreamy field with a slow starfield. A soft ring
  around her breathes: it opens on the in-breath and closes on the out-breath, with the words "in" and "out".
- You may tap anywhere, any time. Every tap blooms a soft petal of light from the fingertip with a quiet tone.
  All blooms are the same size and warmth. There is no accuracy window, no miss, no counter and no streak.
  (Changed: version 1 graded taps by closeness to the turn and lit a glow after five good taps. The review
  showed that is a score with a loss signal, so it is gone.)
- The scenery drifts on its own: stars slowly wheel, the companion sparkles now and then, independent of taps.
- Watch-only works: nothing waits for a tap. Keyboard: space or enter blooms a petal.

## Pace (changed)
- Presets you choose, no automatic calibration and no automatic slowing: Easy 3 in, 3 out (default), Steady 4
  in, 4 out, Long out 4 in, 6 out. No holds in this version. "My own pace" hides the ring words and leaves a
  gentle pulse you can ignore. (Changed: the review found that measuring alternating taps counts phases, not
  breaths, and that a rule which only slows cannot reach a target from a slower start without speeding up.)
- These are prototype settings, not validated limits. A six breaths a minute pattern is not claimed to beat
  any other: a 400 person trial found about 5.5 breaths a minute no better than 12 for stress outcomes
  (Fincham et al. 2023, Scientific Reports).

## Length (changed)
- Short, your choice: 3, 4 or 5 minutes, or Open (no timer). The session saves whenever you stop, including
  after twenty seconds. Copy: "A short breathing break. Choose how long you'd like to stay."
- "Three to five minutes is clinically optimal" is not supported. Balban et al. 2023 (Cell Reports Medicine)
  tested five minutes a day for 28 days and did not compare session lengths. The app does not say optimal.

## What is saved (changed)
- A mindfulness entry with kind `breathtap`, `seconds` of actual practice, the preset and whether taps were
  used. The journal shows "practice time", not "calm minutes", and no breath counts (they are not measured).
- Hearts: 2 per full minute of practice from this activity, carrying fractional minutes across sessions, capped
  at 20 per entry like other practice, and never counting toward the daily streak bonus. Hearts never depend on
  taps.

## Feel
- Micro-rewards only: the bloom, a soft tone (two sine pads a fifth apart, 220 and 330 Hz, gain 0.05), a faint
  haptic pulse where the browser allows it. No confetti, no stacking chimes, no numbers during play.
- Reduced motion: the ring fades instead of scaling, the starfield is still.
- Sound follows the app's sound switch.

## Copy
- Opening: "Breathe comfortably. Tap if you like, or simply watch. You don't need to match the ring."
- Safety line on the start card (changed): "Breathe gently, without forcing a deeper or longer breath. Stop if
  you feel dizzy, tingly, short of breath or distressed, and return to your usual breathing."
- Closing: "Your pause is saved."
- A clearly labelled Stop button, always visible.
- Not claimed anywhere: therapeutic, clinically optimal, resets your nervous system, fine in pregnancy
  (changed: Balban excluded pregnancy; gentle breathing is not called unsafe either, it is simply not claimed).

## Evidence that may be mentioned in Learn, with its limits
- Breathing practices may help some people unwind. Balban 2023: cyclic sighing for five minutes a day improved
  positive affect more than mindfulness meditation in an exploratory trial; anxiety reduction was not superior
  and HRV did not change significantly.
- Slow breathing can still over-ventilate when breaths become too deep (Szulczewski 2019, Applied
  Psychophysiology and Biofeedback), which is why the copy says gently and never deeper.
- NHS breathing exercises for stress: comfortable, unforced breathing.

## Build
- `ovu-breathtap.js`: state machine (idle, running, done), preset timing, ring phase from elapsed time (pure
  function for tests), bloom on pointer and keys, tones through the shared AudioContext, haptics, save on
  stop. CSS block in room.css. A card on the mat sheet and a button in the Mind hub. Tests: ring phase at
  given times for each preset, seconds saved on early stop, hearts from fractional minutes with the per entry
  cap and no streak bonus, open session has no end. Smoke: start, tap three times, stop, entry saved.
