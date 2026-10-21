# Game music: a soft tune for the room, and sounds for the new scenes (design v2, 21 Oct 2026)

Jamie, 21 Oct: "All the new builds have no game sound and I wanted cute soothing background game melody similar to
animal crossing and harvest moon." The 20 Oct sound kit (`ovu-sound.js`, `docs/design/2026-10-20-light-flower.md`)
gave the room small drawn sounds. This adds `ovu-music.js`, drawn in the browser like the kit, and a few missing
cues. Nothing is recorded, downloaded or licensed. Version 1 of this page went to a Codex design review the same
evening (`VERDICT: REVISE`, eight required changes); section 9 says how each is met.

## 1. What it should feel like

Animal Crossing's music changes with the hour and never hurries: a few voices, air between them, a melody that
pauses. Harvest Moon's loops are pastoral. For Rhythme the tune is company, not a soundtrack: quiet enough to forget,
and it steps aside the moment a voice speaks or an activity needs the ear.

## 2. Opt in, and an easy stop

- Music plays only when `S.state().music === true`. Nothing starts from an unrelated tap, from boot, from signing in
  or from restoring a backup (restoring sets the preference; the next gesture inside the room starts it).
- Two controls, one name: **Music**. A chip in the top bar (`#musicChip`, a native button with `aria-pressed`, a
  stable accessible name "Music", icon hidden from assistive technology) and a button in the window sheet
  (`#winMusic`, the same pattern, focus kept when the sheet repaints). The top-bar chip is the quick stop.
- The window sheet's help says what it is: a soft tune drawn in the browser, off until she turns it on, shares the
  Sounds volume, never plays over Erin's voice. The Sounds switch off also silences music.
- One toast after the first scene of a session, once per phone (`state.musicInvited`), so people find it: "There is a
  soft tune for the room now, under the window: Music."

## 3. One place decides (precedence)

A pure `decide(snapshot)` returns what the engine should do; every delayed callback re-runs it and checks its own
generation before touching audio. From strongest to weakest:

1. `music !== true` or Sounds off → **off**: stop the transport, release everything within 0.3 s. Music off never
   suspends the shared context (the kit keeps working).
2. Page hidden → **silent**: stop scheduling, gate to zero in 0.5 s; on return, reconcile again and come back over 2 s.
3. Asleep (`S.state().sleeping`) → **silent** at once: scheduling stops immediately, the gate closes over 1.5 s. The
   kit's lullaby and Erin's good-night line play on their own. Opening the wake sheet is not waking: music stays silent
   until `sleeping` is cleared, and waking at night picks the night arrangement, never the morning one.
4. An exclusive activity → **silent** for its whole length, quiet mode included: a practice (`R.practiceOn()`), a
   session (`R.sessionOn()`), the orb's paced breathing (`R.meditating()`), Morning start (`OvuMorning.active()`), a
   seat practice (`OvuSeats.state()`), Light Flower (`OvuLightFlower.running()`), Moon Tap (`OvuBreathTap.running()`,
   a new one-line export). Gate closes in 0.3 s; scheduling pauses; on the way out, back over 2.5 s.
5. No theme for the scene (the cave) → **silent**: the fade starts on the walk's new `travel` event, before the plate
   swaps, so the cave is reached in silence; the crystals' tone owns the cave.
6. A live media element (section 5) → **ducked**: the gate closes in 60 ms and stays closed while any audible element
   plays; the transport keeps time so the return is seamless; one second after the last one ends, back over 2.5 s.
7. Otherwise → **play** the scene's theme in the hour's arrangement.

## 4. The audio graph

- The kit exports `graph()`: its AudioContext (created if needed, never resumed by this call), its master gain and the
  generated impulse. Resuming happens only from a gesture (`OvuSound.resume()`), and the engine shows `playing` only
  once the context reports `running`; an `interrupted` or failed resume leaves it waiting, truthfully.
- The music has its own return: `musicDry` and `musicWet` (its own convolver built from the kit's impulse data) into a
  `bus`, then the `gate` (on/off, ducking, hidden, sleep), then the kit's master. Muting the gate silences the music's
  own reverb tail with it and leaves the kit's tails alone.
- Each theme plays on a **layer** with its own fade gain feeding the dry and wet sends. A scene change starts a new
  layer and fades the old one out over 1.5 s (2.5 s in for the new); a third change cuts the oldest in 0.4 s. At most
  two layers exist. A layer stops its voices on the audio clock and disconnects them when they end; polyphony is capped
  at ten voices a layer (accompaniment yields first).
- Every gain change holds the current value first (`cancelAndHoldAtTime` where it exists, else cancel and set) and
  ramps linearly; nothing snaps and nothing ramps exponentially to zero.

## 5. Media tracking (one contract)

One wrapper around `HTMLMediaElement.prototype.play`, installed once, after Morning start's and the voice mute's:
- It calls the previous method with the same receiver and arguments and returns its promise untouched, rejections
  included. A rejected start never counts as playing, because nothing is inferred from the call.
- On the first call for an element it attaches listeners to that element: `playing` marks it live, `pause`, `ended`,
  `emptied` and `error` clear it, `volumechange` re-evaluates it. Detached elements (the podcast's `new Audio()`)
  are covered because the listeners sit on the element, not the document.
- Live means: playing, not muted, volume above zero, no `srcObject` (a camera preview), not a `data:` source (Morning
  start's silent unlock clip), audio or video alike. Morning start reuses one element for successive clips: the live
  mark follows the element's current state, so an old `ended` cannot release a newer clip (each event re-reads
  `paused`, `ended`, `muted` and `volume` at that moment).
- The duck is 60 ms in. Speech begins in the first word; a slower fade would compete with it.

## 6. Timing

- A transport with an origin on the audio clock, a beat index and a 30 ms tick that schedules every note starting in
  the next 180 ms. Absolute times come from origin plus beat index; the audio clock is the authority.
- A stall longer than a beat drops the missed notes and resumes at the next bar boundary; the backlog is never
  replayed. While hidden the tick stops and pending starts are invalidated.
- The hour band is re-read every minute and at `visibilitychange`; a change takes effect at the next loop boundary.
- Initialisation is idempotent: a second `init` (a late `on('boot')`) finds the transport and does nothing.

## 7. The tune

Explicit 4/4. One form for every theme, 32 bars in A A′ B A″, 96 to 128 seconds depending on tempo. Harmony is
diatonic D major; the melody lives mostly on the pentatonic (D E F# A B) and lands on chord tones on the beat:

| Bars | Chords (one a bar) |
|---|---|
| A 1 to 8 | D6, D6/F#, Gmaj7, Asus4 A, Bm7, F#m7, Gmaj7 A, D6 |
| A′ 9 to 16 | the same, melody varied, accompaniment thinner in bars 13 to 16 |
| B 17 to 24 | Em7, A, D, Bm7, Em7, Gmaj7, Asus4, A (accompaniment-only in bars 21 to 22) |
| A″ 25 to 32 | as A, bar 32 a held D6 while the last melody note resolves to D and rests; the tail rings on |

A shared bank of twelve four-bar melodic phrases, each tagged with the chord group it was written over and ending in
at least a beat of rest; each theme names which phrases fill its eight slots and offers a second choice for four of
them. The loop index picks between the choices (bounded variation, never a shuffle), so successive loops differ a
little and no hour repeats one arrangement sixty times.

Three musical parts, distinct in role, not just oscillator count:

| Part | Voice | Register |
|---|---|---|
| melody | a rounded pluck: triangle plus a quieter sine an octave up, 12 to 20 ms attack, 0.5 to 0.8 s decay, a low-pass that opens with velocity | D4 to A5 |
| accompaniment | broken chords on beats 1 and 3 (three notes 70 ms apart) or a held pad, slower envelopes | D3 to A4 |
| bass | roots on bar starts, a fifth on beat 3 every other bar, a sine with a quiet second harmonic so a phone speaker carries it | D2 to A3 |

An answering voice (a sixth below, long notes only) joins in A″ and in the morning band.

Themes differ by voice shaping, accompaniment pattern, tempo and phrase choice:

| Scene (layout ids) | Theme | Character | Tempo day / evening / night |
|---|---|---|---|
| room, house, bathhouse, familyhome, anything unknown | `home` | music box: brighter pluck, broken chords | 72 / 66 / 58 |
| garden, greenhouse | `garden` | soft pluck, pad, grace notes in the morning | 76 / 70 / 60 |
| farm, barn, barninside, heninside | `farm` | warm pluck, bass with the second harmonic up, the most pastoral | 70 / 64 / 58 |
| street and its shops (their layouts carry the street scene, so a visit keeps the tune) | `street` | plucked, lighter accompaniment | 80 / 72 / 60 |
| plaza | `plaza` | bell-like melody (sine with a 2x partial), pad | 84 / 76 / 62 |
| harbour | `harbour` | pad first, melody sparse in every band (so its night keeps the day's notes and loses the chords), a slow vibrato | 64 / 60 / 56 |
| cave | none | the crystals' tone | |

Bands come from the window's sun phase (`OvuSun.phase().key`) with the local hour inside it:

| Band | When | Arrangement |
|---|---|---|
| morning | sunrise and morning phases | melody in the upper half of its register, grace notes, answering voice |
| day | afternoon | as written |
| evening | sunset, and night before 21:00 | thinner accompaniment, no grace notes |
| night | night phase from 21:00, and any time before 05:00 | half the melody notes (the lighter ones drop), pad instead of broken chords, no answering voice; no octave transposition |

Night keeps the major key. A tonic last note does not make a seamless waveform: the loop simply ends with a rest and
the decaying tail of the last notes runs into the next loop's first beat.

## 8. Levels (measured, on the complete music bus after its reverb)

Targets at the default slider (the kit's quarter): sustained level about -36 dBFS RMS, peaks about -29 dBFS, with two
layers overlapping at most -26 dBFS. The kit's effects measured -27 to -38 dBFS, so the tune sits in their quieter
half; the slider's maximum adds about 12 dB to everything. Low bass is made audible by its second harmonic, not by
gain. Digital level is not a safe listening level: the page says nothing about sleeping near it.

## 9. What the review required and how it is met

1. Opt in with a reachable stop → section 2.
2. Robust media tracking and activity-wide suppression, Light Flower and Moon Tap included → sections 3 and 5.
3. Separate theme fades, music gating and music reverb, cleanup and resource limits → section 4.
4. Lifecycle precedence, cancellation, scheduler recovery, successful unlock → sections 3 and 6.
5. A harmonically compatible, varied 32-bar arrangement instead of a 16-bar repeat → section 7.
6. Corrected level claims, complete-mix measurement → section 8 and the checks below.
7. Bedtime, waking, visual night and cave transitions on real events → section 3 (sleep, bands from the sun phase,
   the walk's `travel` event).
8. Shared effect paths audited; real-time, accessibility and backup checks → sections 10 and 11.

## 10. Sounds for the new scenes (one owner a cue)

`R.chime()` plays `tap` for every kind but save, sleep, bell and alert, so scenes call the kit directly for a specific
sound. Travel already plays `door` (`ovu-walk.js`), sitting already plays `sit` (`ovu-garden.js`), barn care already
plays its pops and water (`ovu-barn.js`, `ovu-care.js`). What was silent:

| Owner | Moment | Sound |
|---|---|---|
| `ovu-harbour.js` `castLine` | the cast | new kit kind `cast`: a short whoosh and a plop |
| `ovu-harbour.js` `bite` | the float dips | `pop` |
| `ovu-seats.js` `begin` | a seat practice begins | `boop` |

Nothing is added to the cave (its teardown runs on sleep and cancel too), nothing to sheets (sheets are silent
everywhere), nothing to `ovu-farm.js` or `ovu-lane.js` (other sessions own them). Sound is never needed to play:
every cue keeps its visible feedback.

## 11. Checks

- `tools/test-core.js`: `themeFor` for every real layout id (including `room`, the stores and an unknown id);
  `bandFor` across the sun phases and hours; `arrange` deterministic per (theme, band, loop index) and different
  between loop indices; `events` in D major, on-beat melody notes among the bar's chord tones or extensions, a rest at
  the end of each phrase, bar 32 resolving to D, times non-decreasing (simultaneous notes allowed), registers kept;
  `decide` for the precedence table; the media tracker with fake elements (rejected play, muted, `data:` source,
  `srcObject`, volume to zero, a reused element with successive clips, overlapping elements, stale events); a second
  `init` creates no second transport; polyphony and layer counts bounded; the module pays no hearts and writes no diary
  entry.
- Offline render (`tools/music_render.py`, Playwright): the engine exposes `render(theme, band, loops, ctx)` which
  schedules its timeline explicitly into an OfflineAudioContext (no timers); two consecutive loops plus the tail for
  every theme and band; peak and RMS in dBFS on the music bus; a crossfade and a duck rendered too. WAV previews go to
  Jamie.
- `tools/e2e_smoke.py`: with the preference off nothing plays after taps and scene changes; Music on from the window
  sheet starts the home theme with the context running; the top-bar chip stops it within a second and the preference
  survives a reload; the garden changes the theme; the cave has none; a detached `new Audio` of a real clip ducks the
  gate and its end brings the music back; the silent `data:` clip does not duck; hidden stops scheduling; sleep
  silences it and the wake sheet does not restore it; a Light Flower start silences it; the new cues fire; restoring a
  backup with `music: true` does not start playback by itself.
- Device checks for Jamie (not automatable here): iOS Safari and the installed PWA after a phone call or Siri
  (interrupted context), low volume on a phone speaker, headphones, VoiceOver and TalkBack on the two controls.

## 12. Not in this build

Recorded music (Higgsfield's model, CC0 tracks) stays rejected: synthesis is tiny, offline, adapts by the hour and
needs no licence; it can be revisited if the tune does not please Jamie. A music level of its own (one slider for
now, labelled accurately). Music on pages outside the room. Minor keys at night (not ruled out on evidence; a taste
choice to revisit with Jamie).
