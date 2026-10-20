# Morning start: how it is offered and why (20 October 2026)

Jamie: "let's try to kickstart with a simple and accessible morning routine. Upon waking up, we can do a short breath and body awareness + brushing teeth. discuss with codex how we should present this".

This is the first concrete piece from the mindfulness Gold Drop (PR #19, `docs/research/2026-10-20-mindfulness-gold-drop.md` on that branch). Code: `ovu-morning.js`, hooks in `room.js`, styles in `room.css`.

## What she sees

1. **An invitation in Today**, from 04:00 to 11:59 by the real clock, never while she is asleep: "Morning start. A short pause, then brushing your way. Sitting or lying is fine." with **Begin** and **Not today** (puts it away until tomorrow). It is also always on the Everyday list and is the mat's morning suggestion while she is awake. Saving a night never starts it.
2. **A choice sheet**: "A short pause, then brush your way" (default) or "With Erin's brushing guide" (about 5 minutes), and **Quiet** (captions only, no voice, no bells; on by default when app sound is off).
3. **Arrive, 35 seconds**: "Good morning" in the morning window, "Hello" at other hours, and no greeting with Erin's guide (Erin greets her at the sink); any position, stay sitting or lying if dizzy, eyes open or closed, no need to change the breath, notice it as it is or a sound, a colour or something to touch.
4. **Notice, 55 seconds**: no need to move; where the body is resting; nothing to change; a sound or a colour instead, or stop at any time.
5. **Brushing**, only after she taps **Ready to brush** (or **Skip brushing**) at wherever she brushes, with time for prayer or anything else first, so getting there is not timed. Either her own way until **Done**, or Erin's own morning brushing script, whole.

Every step is read in Erin's voice (Rhythme's lines in her consented voice model, as the app's other interim lines are; the brushing guide in her own words), with the caption matching the clip word for word. Each spoken line is 12 to 27 seconds, followed by quiet; brushing still starts after 90 seconds. Quiet keeps it captions only.
6. **An honest save**: "Save this pause to your journal?" One entry (kind informal, activity morning), only if she says yes and practised 30 seconds or more; the same 2-heart thank-you as any practice inside the shared 6-a-day cap; no streak; the moment line "That pause was yours."

Throughout: she stays where she is in her own outfit (standing for the first two steps, the brushing pose for the third), a panel above the nav holds the full caption in a polite live region with labelled 44 px controls (Pause, Next, Stop, and Voice on every step with a clip) outside it, and falling asleep stops everything at once with no save prompt.

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

A Codex re-check confirmed five fixes and reopened four plus one regression, all fixed with checks in tools/e2e_smoke.py:
- Mind, a breathing session or an everyday practice cannot start on top of Morning start.
- Pause, Next, voice off and on, then Resume never plays an older Erin line under a newer caption; a muted clip never resumes.
- A walk already under way stops when Morning start begins, and its pending sheet never opens over it.
- The bed still works during Morning start (it opens without walking her), so Good night ends the routine with no save prompt.
- A third check found the room's own fallback walk could still glide her for a moment: it now freezes where she is mid-step; and the refused Mind tab is no longer left highlighted.

## DeepSeek and Doubao review, once Ark was back (20 October, after Jamie topped up)

Both were given the built design and copy (DeepSeek deepseek-v4-pro in English, Doubao seed 2.1 pro in Chinese) and asked for concrete problems only. Both said ship with changes. Each finding was checked against the code before acting; the prompt had wrongly said Erin's guide was a "recorded" voice, when all of her clips are her consented voice model, which is the app's existing practice (ovu-mindful.js header).

Taken:
- Good morning played whenever it was opened, even from Everyday at night (Codex had asked for this before the build and it was missed): Arrive now says Good morning only in the 04:00 to 11:59 window and Hello otherwise, each with its own clip. (DeepSeek)
- Arrive as spoken audio: dizziness on waking ("If you feel dizzy, stay sitting or lying"), "There is no need to change your breathing" so the breath line can never read as pacing, eyes open or closed, and touch as an anchor for low vision. (both)
- Notice: "You don't need to move", "nothing you need to change" instead of "nothing to fix" (which can sound dismissive with chronic pain), and a named alternative ("a sound or a colour instead"). (both)
- The sink step assumed a private bathroom sink: now "wherever you brush", and "Take any time you need first, for prayer or anything else" for Subuh and wudu, shared bathrooms and kitchen sinks. (both)
- "Nothing under 30 seconds is saved" read as a penalty: "Pauses under 30 seconds are not saved." (both)
- "on the mat" could be read as a prayer mat: "the meditation mat". (Doubao)
- The credit is shown before Begin, not only in the journal: "Read in Erin's voice: the opening words are Rhythme's, the brushing guide is Erin's own"; the saved entry says the same. (both)
- Every Rhythme step (Arrive, Notice, the sink, brush your way) is now voiced in Erin's voice, so the default path is not silent with the voice on; captions match the clips word for word; Quiet keeps it captions only. Arrive is 35 s and Notice 55 s so each 21 to 27 s line is followed by quiet, and brushing still starts after 90 s.
- Found while merging main: Morning start could begin during a greenhouse plant minute; it now waits for that minute.

Checked and already right: the end sheet already says only what she did ("You arrived and noticed", without "brushed" when she skipped it), and "1 minute" is already singular.

A Codex check of these changes failed it on four points, all fixed with checks in tools/e2e_smoke.py:
1. Resume after a line had finished said it again: a finished clip is not replayed.
2. With Quiet at the start, turning the voice on could be silently refused by a phone's autoplay rule: Begin (when quiet) and Voice on now ready the voice inside the tap with a muted moment, and a refused line switches to Voice off with a toast instead of a silent Voice on.
3. The longer Arrive made "Stop" during Arrive say "You arrived and noticed": the summary now counts only steps she reached.
4. Erin's guide outside the morning went "Hello" then Erin's "Good morning": with Erin's guide, Arrive has no greeting (a sixth clip).

A second Codex check failed it on two more, both fixed with checks that keep the app's real voice-mute wrapper in place:
5. The warm-up was not silent: the shared "mute Erin's voice" wrapper (ovu-voicemute.js) sets `muted` inside every play of an app voice file, so it overrode the warm-up's mute. The warm-up now plays 10 ms of silence that is not an app voice file. And a remembered mute could leave real lines silent under "Voice on": a remembered mute now makes Quiet the default, and choosing the voice in Morning start lifts it.
6. Erin's first lines (picking up the brush) counted as brushing: brushing now counts from the line after her "beginning to brush", and in her own way only when she taps Done.

A third Codex check found that pausing on Erin's opening and tapping Next three times still recorded brushing: Erin's guide now counts as brushing only after 5 seconds of running (not paused) time on her brushing lines, with checks both ways.

A fourth Codex check passed that and found three more, all fixed with checks:
- Pause then Next could still claim "You noticed" for an untouched step: the summary now counts only steps with at least 5 seconds of practice time.
- A clip that started late could be cut off when its step's time ran out: the step now waits for its line, a second at a time and at most eight, with Pause, Next and Stop still working.
- A save that failed (storage full) closed the sheet and left an unsaved entry in memory: OvuStore.add now takes the entry back out of memory when the write fails (true for every save in the app), and the sheet stays open with a message so she can try again.

Not taken, and why:
- Hearts without saving (Doubao): the honesty confirm before any hearts is Jamie's rule, and separating them needs a second reward ledger. The entry stays on her phone unless she has turned on sync, which has its own consent.
- A confirmation on Stop (Doubao): Stop after 30 s already opens a sheet with "Not this time"; under 30 s nothing is lost but the moment.
- Quiet on by default (Doubao): it already follows her own sound setting.
- "I'll brush later" and doing the steps in any order (Doubao): Skip brushing and Stop cover it without a second flow.
- A written approval from Erin for these lines (both): the app already reads Rhythme's interim lines in Erin's voice with her consent; flagged to Jamie rather than blocking.
- Translations into Chinese, Malay and Tamil (Doubao): app wide, not this change.
- Doubao's claim that brushing may break wudu was not used: unverified, and the copy does not need it.

## Follow-ups found on the way (not changed here)

- The base-outfit `stretch` pose resolves to the yoga-clothes image although a base file exists (room.js OUTFIT_POSES).
- The reward helper accepts unconfirmed informal entries; everyday practices still drop stops under 60 seconds and round minutes up to 1.
- An "I'm awake, don't record sleep" option, distinct from "I did not sleep".
- The shared HUD for other practices still clips captions to three lines with 36 px controls inside its live region.
- A real screen-reader check on a phone.
