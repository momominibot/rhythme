# The crystals' tone (pure tones in the hidden spring)

Jamie, 21 Oct 2026, with a screenshot of a "Pure Tones Library" (174 Hz "The foundation tone", 285 Hz "Cellular repair",
396 Hz "Liberation", 417 Hz "Transformation", 528 Hz "The love frequency", 639 Hz "Connection", 741 Hz "Expression",
852 Hz "Intuition", 963 Hz "The transcendence tone"; 30-minute tracks): "I want to add in sounds frequency like this
without any voiceover just sound in the cave."

Built on 21 Oct 2026 (`ovu-tones.js`, branch `claude/world-harbour`).

## What it is

- A new hotspot in the hidden spring: **The crystals**. Its sheet offers the nine pitches (174, 285, 396, 417, 528, 639,
  741, 852, 963 Hz), a length (until I stop, 10, 20 or 30 minutes), Start and Stop. A pill on the scene shows the pitch
  and stops it with one tap once the sheet is closed.
- The tone is made on the phone with Web Audio: a sine at the pitch, a soft octave above it (so the low pitches carry on
  a small speaker), a 2.5 second fade in and a 2 second fade out. Nothing is downloaded or streamed, so there is no
  30-minute file and no network.
- It follows the room's own volume setting and never passes 35 per cent of it. The sheet says: keep it gentle, stop if
  it is unpleasant or your ears ring.
- It stops when she leaves the spring, when sleep begins, when the page is hidden, when the chosen time is up, or at
  Stop. It writes no diary entry, costs no energy and earns no hearts.

## What it is not

The names in the screenshot ("cellular repair", "the love frequency", "transformation") are not used, and the sheet
says plainly that Rhythme makes no claim about what a tone does. There is no systematic review supporting specific
effects of these frequencies; a Science Feedback review of the "removes toxins / regenerates the body" claims found no
scientific or clinical evidence and no scientific basis for the frequency set
(https://science.feedback.org/review/no-evidence-support-claim-solfeggio-frequencies-remove-toxins-from-body/). Any
restfulness is more plausibly the quiet, steady sound itself. Rhythme labels each tone by its pitch only ("528 Hz,
middle") and treats it as something some people find restful, which is all it is offered as. No breathing pacer rides
on it, no timer goal, no streak.

## Checks

`tools/test-core.js` 2k5: the nine pitches and their labels, no promise words in the module, the volume ceiling, a quiet
failure without Web Audio, no diary write, no hearts, no energy, and the hotspot's stand point on the cave floor and
reachable. `tools/e2e_smoke.py`: tap the crystals, choose a pitch and ten minutes, Start, the pill after the sheet
closes, Stop, and a tone that stops when she leaves the spring.
