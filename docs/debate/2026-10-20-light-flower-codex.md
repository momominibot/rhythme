I’d add **Light Flower**, an attention-and-listening practice, with a small procedural sound kit shared across Rhythme.

Three concepts fit the reference:

- **Light Flower:** tap to illuminate one glass petal and hear a fading bell. Notice its changing sound or light; when attention wanders, gently return.
- **Kindness Petals:** each tap reveals an optional phrase such as “May I meet this moment gently.” Pause with it; skip freely. The mechanism is kindness, without requiring positive feelings.
- **Petal Pause:** petals offer optional noticing prompts for hands, shoulders, jaw or feet. Tap to move on, with an external visual anchor always available.

**Choose Light Flower:** it makes audio part of the mindfulness mechanism, needs little instruction, and differs clearly from Koi Pond’s paced breathing.

The screen would show one translucent lilac/periwinkle flower, pale-gold edges, a long stem and leaf against near-black. Keep the flower already whole. Nothing fills, grows or becomes “better” through tapping. Use sparse bokeh and static star glints.

Add a **“Light Flower · Notice light and sound”** tile beside `mindTap` in `room.js`, opening proposed `ovu-lightflower.js`.

First-run explanation:

> Tap to hear a soft note and watch a petal glow. Notice it fading, and gently return whenever your attention wanders.

A tap anywhere on the large flower button brightens one petal over 300 ms, settling over four seconds. All responses have equal intensity. There is no required interval, breath cue or sequence to finish. Rapid taps maintain the current glow, without stacking brightness or sounds. Watching quietly works too.

Offer **Open** by default, plus **2 or 5 minutes**. Begin starts the practice; Stop remains visible. Stop, Back, page hiding and real sleep all finalize once, saving actual foreground practice time. One monotonic elapsed-time source drives timing and saved duration. Reopening requires Begin again.

Use the existing store:

```js
S.add('mindfulness', S.today(), {
  kind: 'lightflower',
  seconds,
  minutes: seconds / 60,
  planned: 0, // or 2 or 5
  startedAt, endedAt
}, 'room')
```

Save every positive duration, including under five seconds. Do not inherit `ovu-breathtap.js`’s five-second cutoff. Show “Your pause is saved” only after successful persistence; retain a recoverable session if saving fails.

**Hearts need a source correction:** current `ovu-rewards.js` gives Koi **2 hearts once a session reaches 60 seconds, capped at 6 daily across mindfulness**, rather than per-minute rewards. Apply that current rule to `lightflower`, explicitly extending its duration guard. Use `afterSave()` once; no tap rewards or streaks.

In `ovu-moments.js`, map the new kind to `pose: 'listen'` and:

> “Notice one quiet detail around you. You can carry it into what comes next.”

Show the existing `act-listen` pose after returning to the room, in her current outfit. Preserve the existing care, walking and sleep guards. Register the game with `stopEverything()` and room busy state; check `S.state().sleeping` on open, Begin and store updates. Preserve the 18+ gate.

Accessibility: native button, Space/Enter support, focus containment and return, 48px thumb-friendly controls, readable contrast, text instructions and restrained screen-reader announcements. No narration required. Reduced motion uses a static flower and text feedback. Target **zero flashing**, including rapid tapping; never exceed three flashes in any second across the scene. [W3C criterion](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)

For sound, choose **original procedural Web Audio synthesis**:

| Approach | Assessment |
|---|---|
| Procedural synthesis | Responsive, offline, small; original oscillators/noise avoid third-party recording licences. |
| AI music loops | Useful for longer soundscapes, but less responsive and require generation, editing and rights checks. Higgsfield permits commercial outputs but disclaims originality and non-infringement guarantees. [Terms](https://higgsfield.ai/terms-of-use-agreement) |
| CC0 libraries | Good for natural recordings; retain creator, source and licence receipts. CC0 permits commercial reuse but does not verify ownership or provide warranties. [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

No option deserves an absolute “zero legal risk” promise.

Proposed `ovu-sound.js` kit, with initial digital peak targets at default volume:

| Sound | Trigger and recipe |
|---|---|
| **Petal Glass** | Flower tap; D-major pentatonic 294/330/370/440/494 Hz, sine plus faint second harmonic; 20 ms attack, 3 s decay; −26 dBFS. |
| **Seed Pluck** | UI `tap`; 330 Hz softened triangle; 10 ms attack, 180 ms decay; −32 dBFS. |
| **Soft Landing** | `save`, `sleep`, session end; 294+440 Hz; 80 ms attack, 1.5 s decay; −28 dBFS. |
| **Gentle Bell** | Existing `bell`; 294 Hz glass recipe; −28 dBFS. |
| **Notice** | `alert`; two 294 Hz plucks, 400 ms apart; −26 dBFS, always accompanied by text. |
| **Pond Drop** | Koi `plink()`; retain its falling-sine character, 820→230 Hz; 12 ms attack, 600 ms decay; −30 dBFS. |
| **Cloud / Air** | Optional ambience; 147+220 Hz pad or 200–1200 Hz filtered noise; 3 s fades; −38/−42 dBFS. |

Generate a two-second decaying-noise convolution impulse locally; 12% wet mix. Master slider: 0–100%, initially 25%; **sound and ambience initially off**, preserving existing preferences.

Create/resume one shared `AudioContext` inside Begin or Enable Sound’s click handler. Continue silently if unlocking fails. [Web Audio specification](https://www.w3.org/TR/webaudio-1.0/)

Migrate all five `chime()` kinds and Koi’s separate audio context. Remove `force` bypassing mute. Subscribe to `S.state().sound`; mute the master including reverb tails, cancel scheduled notes and suspend. Cap flower notes at one per 1.2 seconds, two overlapping voices, with no queued catch-up. Keep `ovu-voicemute.js` independent; any future narration requires both sound enabled and voice unmuted.

Avoid completion flowers, collecting seeds, accuracy grading, streaks, autoplay music, MiniMax and treatment claims. Preserve the reviewed rules in `docs/design/2026-10-18-breath-tap.md` and `docs/debate/2026-10-18-breath-tap-codex-review.md`. Verify iPhone interruptions, mute tails, sleep, duplicate saves and rapid taps before release. Read-only proposal; nothing changed or persistently captured.

