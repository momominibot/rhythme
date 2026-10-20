# Morning start: how it is offered and why (20 October 2026)

Jamie: "let's try to kickstart with a simple and accessible morning routine. Upon waking up, we can do a short breath and body awareness + brushing teeth. discuss with codex how we should present this".

This is the first concrete piece from the mindfulness Gold Drop (PR #19, `docs/research/2026-10-20-mindfulness-gold-drop.md` on that branch). Code: `ovu-morning.js`, hooks in `room.js`, styles in `room.css`.

## What she sees

1. **An invitation in Today**, from 04:00 to 11:59 by the real clock, never while she is asleep: "Morning start. A short pause, then brushing your way. Sitting or lying is fine." with **Begin** and **Not today** (puts it away until tomorrow). It is also always on the Everyday list and is the mat's morning suggestion while she is awake. Saving a night never starts it.
2. **A choice sheet**: "A short pause, then brush your way" (default) or "With Erin's brushing guide" (about 5 minutes), and **Quiet** (captions only, no voice, no bells; on by default when app sound is off).
3. **Arrive, 30 seconds** (captions): any position, eyes open welcome, notice breathing as it is, or a sound or a colour.
4. **Notice, 60 seconds** (captions): where the body is supported; nothing to fix; another anchor or stop at any time.
5. **Brushing**, only after she taps **Ready to brush** (or **Skip brushing**), so getting to the sink is not timed. Either her own way until **Done**, or Erin's own morning brushing script, whole and in her voice.
6. **An honest save**: "Save this pause to your journal?" One entry (kind informal, activity morning), only if she says yes and practised 30 seconds or more; the same 2-heart thank-you as any practice inside the shared 6-a-day cap; no streak; the moment line "That pause was yours."

Throughout: she stays where she is in her own outfit (standing for the first two steps, the brushing pose for the third), a panel above the nav holds the full caption in a polite live region with labelled 44 px controls (Pause, Next, Stop, and Voice during Erin's guide) outside it, and falling asleep stops everything at once with no save prompt.

## What Codex changed in the plan (before building)

Codex (gpt-6-astra, read-only, with the code) reviewed a draft and these changes were adopted:

| Draft | Changed to | Why |
|---|---|---|
| A "Save and start my morning" button on the wake sheet | A separate invitation in Today; saving sleep never starts a practice | Saving data and starting a practice are different decisions; people who never log sleep still need it |
| Breathing scale animation on the avatar | No animation, and no `acting` pulse | Any rhythm reads as a breathing pacer; slow paced breathing is no better than a placebo pace (Fincham 2023) |
| Overhead stretch pose for the body check | Her standing sprite | The stretch image shows an overhead stretch, not stillness |
| Feet-to-face scan; "if it hurts, attend to your hands" | "Notice where your body is supported... choose another anchor, or stop" | A scan does not suit everyone with pain or disability |
| Brushing starts on a timer | A "Ready to brush" gate | Walking to the sink should not count as practice |
| A shortened cut of Erin's script | Erin's script stays whole; the default is brushing your own way | Her authored script is not edited |
| Erin clips with different captions | Captions only for the first two steps | A clip must match its caption; new Erin audio cannot be recorded now |

Not adopted now (listed as follow-ups): an "I'm awake, don't record sleep" choice on the wake sheet; a general HUD rebuild for every practice.

## Evidence behind the choices (Gold Drop ledger)

- Short is enough, and shorter is safer: meditation length did not change wellbeing (Fincham 2023, L61); single 10-minute practices were more often distressing than 5-minute ones (Simonsson 2026, L62).
- No breath counts or pacing claims (Fincham 2023 coherent breathing vs placebo, L60).
- Acceptance as a design principle ("nothing to fix") (Lindsay 2018, 2019, L29).
- Everyday practice is linked to wellbeing but not proven causal (Birtwell 2019, Kakoschke 2021, L19; Canby 2020, L18), so the copy promises nothing.
- A minority feel worse in meditation (L6 to L9): eyes open, other anchors and stop-at-any-time are in the words.

## Codex review of the built diff: nine defects, all fixed with tests

1. Sleep could still open the save prompt if a step ended first: `stopEverything` now cancels Morning start, and every step change, finish and save checks for sleep.
2. It could start on top of a running session or practice: refused with a toast; the podcast pauses.
3. Pause, then Next, then Resume used the old step's time and clip: each step now gets its full time and its own clip on Resume.
4. Turning the voice on restarted a clip that its timer then cut short: voice now resumes from the next line.
5. A hotspot tap could still make her walk: taps and walks are held while it runs.
6. The invitation came back empty after being hidden once: the render flag now resets.
7. Keyboard focus stayed in the closed sheet or was lost: focus moves to the panel and then to a surviving control.
8. Two small labels failed contrast: darker text token.
9. 29.5 seconds rounded up to 30: eligibility uses exact milliseconds.

## Not available this round

Volcengine Ark (DeepSeek and Doubao) was blocked by an overdue account balance from about 12:20 SGT on 20 October, so no Ark perspective was asked; Codex and primary sources only. New Erin clips (also Volcengine) cannot be made until then, which is why the first two steps are captions only.

## Follow-ups found on the way (not changed here)

- The base-outfit `stretch` pose resolves to the yoga-clothes image although a base file exists (room.js OUTFIT_POSES).
- The reward helper accepts unconfirmed informal entries; everyday practices still drop stops under 60 seconds and round minutes up to 1.
- An "I'm awake, don't record sleep" option, distinct from "I did not sleep".
- The shared HUD for other practices still clips captions to three lines with 36 px controls inside its live region.
- A real screen-reader check on a phone.
