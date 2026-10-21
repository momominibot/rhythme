# Erin's morning: wake, brush, sip

Jamie, 21 Oct 2026: two more Google Docs from Erin Lee, "Waking Up With Breath and Body (approx. 3 minutes)" and "A
Mindful Sip to Begin Your Day (approx 3 min)": "More sharing from erin to put into the app", then "So we can demo a
more complete morning routine - breath and body upon waking up, brushing teeth, mindful drinking. Discuss with codex how
to present this."

Built on 21 Oct 2026 (branch `claude/erin-morning`). The presentation follows a Codex design review of the same morning
(gpt-6-astra, read-only, with the code): **one optional Morning start journey, wake, brush, sip, with every part also
available on its own in Mind; the order kept, every part skippable, a readiness pause between parts; one entry per part
she really did; the flat practice thank-you once a day per part; no bonus, no streak.**

## The scripts

Both docs were split at Erin's `[Pause]` markers into timed steps and voiced one clip per step in her cloned voice
(Volcengine, voice `S_PLWb4DCd2`, cluster `volcano_icl`, speed 0.88; one guarded run, 13 clips, no retries). Each step's
seconds are the clip's length plus her pause plus 0.6 s. Her words are kept whole; the only edits are the blanks she
left: "Good Morning, _______." is voiced as "Good morning.", and "Have a __________ day ahead." as "Have a gentle day
ahead." (British "practising", as in her brushing script).

| Script | In the app | Clips | Steps and seconds |
|---|---|---|---|
| Waking Up With Breath and Body | `ovu-mindful.js` activity `wake` (new), pose `stretch` only on the two movement passages | `wake-0-0.mp3` to `wake-0-5.mp3` | 38, 37, 33, 29, 38, 18 (193 s) |
| A Mindful Sip to Begin Your Day | `ovu-mindful.js` activity `coffee`, replacing the interim morning variation, same ids | `coffee-0-0.mp3` to `coffee-0-6.mp3` | 28, 27, 32, 33, 34, 29, 17 (200 s) |
| Brushing teeth, morning (19 Oct) | unchanged | `teeth-0-*.mp3` | 206 s |

## How it is presented

- **The card** on the home deck (04:00 to 11:59, as before): "Morning start. Wake, brush, sip. Take one part or all
  three." Begin / Not today. Nothing changes at 11 am; nothing is offered in the evening (Everyday and the mat still
  open it by hand).
- **Begin** opens the choice: "Erin's morning: wake, brush, sip" first (about 10 minutes in her voice: Waking up with
  breath and body (3 min), Brushing teeth (3 min), A mindful sip (3 min). Plus any time you need between parts), then
  the earlier "A short pause, then brush your way". Credit once: "Words by Erin Lee, voiced using her cloned voice with
  permission; the short pause uses Rhythme's words, read in her voice."
- **The journey** (`ovu-morning.js` `plan('erin')`): her six wake steps (Part 1 of 3), then the brushing gate ("Ready to
  brush" / "Skip this part", any sink, time for prayer first), her eight brushing steps (Part 2), the sip gate ("Ready
  to sip" / "Skip this part", with "Choose a drink that is comfortable to sip: coffee, tea, water, anything... No drink,
  fasting, or simply not wanting one are all fine reasons"), her seven sip steps (Part 3). Every timed step keeps Pause,
  Next, Voice and Stop and gains **Skip this part**. A gate's skip moves on to the next part, or ends the routine when
  it was the last.
- **The adaptation line** sits above the wake-up's captions: "Sit comfortably, in a chair or a wheelchair, or stand with
  support. Leave out any movement you do not want to do. There is no need to match the picture, or to change your
  breathing."
- **Her avatar** stays where she is, in her own outfit (the routine already freezes walking; a desk-side walk for the
  sip was in the design review and is left for later rather than risk a blocked route). Still for the wake-up, the
  stretch pose on the shoulder and arm passages, the brushing pose for brushing, the cup for the sip. The unsuffixed
  stretch sprite is the yoga set, so the base outfit now uses `avatar-act-stretch-base.webp`.
- **Saving**: one confirmation at the end ("You woke up with breath and body, brushed and took a mindful sip. Save this
  pause to your journal?"); Yes writes **one entry per part with 30 seconds or more of practice time**, each as the
  matching practice (`wake`, `teeth`, `coffee`, with `routine: 'morning'`), a part stopped early marked
  `stoppedEarly`. Parts she skipped or barely started are not saved. The design review suggested a prompt after each
  part; one prompt was kept so three sheets never interrupt a demo, and nothing she did not do is ever saved.
- **Hearts** (`ovu-rewards.js`): the flat 2 per confirmed practice inside the shared 6 a day, and each morning part pays
  **once a day whether done in the routine or on its own** (the short-pause morning takes the brushing slot), so ending
  early, deleting and repeating never earns more. No routine bonus.

## Checks

`tools/test-core.js` 2i: the plan's shape, Erin's steps and clips in order, the poses, the parts' seconds (three parts of
three to four minutes, about ten in all), the gate labels and the care line, the first words being hers, every clip on
disk, `partEntry` (30 seconds, confirmation, stopped early), the once-a-day hearts per part. `tools/e2e_smoke.py`: the
choice sheet, Part 1 with the care line and Skip this part, the brushing gate, Skip this part to the sip gate, Ready to
sip with the cup, Stop after 40 s saving the sip alone, and a repeat paying nothing more.
