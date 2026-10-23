# Soothing tones: how sound-bath and sleep-sound makers build a restful drone (22 Oct 2026)

Jamie, 22 Oct 2026: "all the frequency sounds are very eerie, I need you to search online to learn how other are creating
soothing frequency sounds." This note is the research behind the rebuilt voice in `ovu-tones.js`. The first build is in
docs/design/2026-10-21-cave-tones.md; its rules stand (nine pitches labelled by pitch only, no claim about what a pitch
does, the app's volume ceiling, no diary entry, no hearts, no energy).

## 1. Why the first voice sounded eerie (diagnosis, with numbers)

The 21 Oct voice was a sine at the pitch, a second sine detuned by 0.35 per cent at 35 per cent of its level, a sine an
octave up at 18 per cent, and a 0.08 Hz swell, all mono, straight to the output, no filter, no room.

- **A bare sine is a test tone.** Nothing in a room sounds like one: every struck or rubbed object has several partials
  and a surface that colours them. The ear reads a lone sine as electronic, and in headphones a mono sine sits inside the
  head rather than in a space.
- **The shimmer was a wobble, and it got worse with pitch.** A detune of 0.35 per cent beats at 0.0035 x the pitch:
  0.6 Hz at 174 Hz, 1.8 Hz at 528 Hz, 3.4 Hz at 963 Hz. The ear's sensitivity to slow amplitude modulation (what
  psychoacoustics calls fluctuation strength) peaks at about 4 Hz and falls away on both sides, so the high pitches
  beat at the rate the ear notices most. With the twin at 35 per cent the level swung about 5 dB each beat.
- **The octave made it thin, not warm.** An octave above is the one partial that adds brightness without body.
- **It arrived too fast.** A 2.5 s fade still reads as a switch for a sound meant to sit under a ten-minute sit.

## 2. What the evidence says

### 2.1 Singing bowls: a fundamental, a few partials, and a slow beat from asymmetry

- Terwagne and Bush (Nonlinearity 24, 2011, open copy at arXiv 1106.6348) measured four antique bowls (fundamentals
  187, 236, 347, 428 Hz). Struck, a bowl rings at several inharmonic modes; rubbed with a mallet it sings at "a
  fundamental frequency plus a number of harmonics" through mode lock-in. The beat everyone hears comes from the bowl
  not being perfectly round: "Due to the bowl asymmetry, two peaks separated by several Hz arise and a beating mode is
  heard." (section 2.2 and figure 3). https://arxiv.org/abs/1106.6348
- Golas and Filipek (Archives of Acoustics 41(1), 2016, DOI 10.1515/aoa-2016-0014), citing Inacio and Henrique (2006),
  give the struck bowl's partials relative to the first as 2.7 to 2.9, 4.8 to 5.7, 7.5 to 9.1 and 10.6 to 13.1, and
  measured two bowls at 1 : 2.77 : 5.03 : 7.66 : 10.60 and 1 : 2.53 : 4.61 : 7.25 : 10.44 (their Table 2).
  https://doi.org/10.1515/aoa-2016-0014
- A university physics demonstration makes the struck/rubbed split plain: "The tapped bowl has several prominent
  anharmonic overtones (just like a bell)", while the bowed bowl's steady tone has harmonic overtones, the second of
  which is not a mode at all but the large-amplitude fundamental driven non-linear.
  https://physicsdemos.unm.edu/demos/new_site/demo_new.php?which=411
- Gordon Reid's Synth Secrets on bells (Sound On Sound): bells and bowls are "much better synthesized using additive
  synthesis"; the tail is carried by a hum "an octave below the fundamental", made of two sines "detuned just enough
  to create a slight beat"; nearly degenerate modes "beat against each other"; the hum gets a slower attack and a
  longer tail than the strike. https://www.soundonsound.com/techniques/synthesizing-bells

So a bowl-like sustained voice is: a strong fundamental, a soft octave (the sung bowl's harmonic), one or two soft
inharmonic partials near 2.5 to 2.9 times the pitch (the struck bowl's next mode), each partial split into two or three
close frequencies so it beats slowly, and for the higher pitches a hum an octave below.

### 2.2 How fast a beat may be

Zwicker and Fastl's fluctuation strength curve (Psychoacoustics: Facts and Models, Springer 1990; summarised with the
reference values by Siemens, https://community.sw.siemens.com/articles/en_US/Knowledge/sound-modulation-metrics-fluctuation-strength-and-roughness)
puts the strongest sensation of a pulsing sound at 4 Hz, fading by about 15 to 20 Hz into roughness, which peaks at
70 Hz. Below about 1 Hz a modulation reads as a swell rather than a pulse. A real bowl's "several Hz" beat is heard on
a decaying strike; for a sound that must sit still for twenty minutes the beat has to stay under about 1 Hz, and it
should be shallow: two equal sines cancel fully each beat, so the depth is set by the level of the weaker twin. This is
a secondary summary of the primary text, kept as a design guide, not a measurement of our tones.

### 2.3 What producers do for drones

- ModeAudio, Creating Drones With Synths (https://modeaudio.com/magazine/creating-drones-with-synths): a drone is "a
  sustained sound that changes very gradually"; unison of four voices with a small detune for beating; attack and
  release "past the 5 second mark" so the note "fades in and out"; a logarithmic attack (quicker in than out); LFOs in
  free-running seconds rather than tempo so nothing repeats exactly; "just a touch of modulation"; reverb and delay as
  "natural companions".
- Tone.js Reverb (https://github.com/Tonejs/Tone.js, effect/Reverb): "Simple convolution created with decaying noise",
  the impulse response generated offline and fed to a ConvolverNode. No file is downloaded: that is the pattern used
  here, with a seeded generator so every render is the same.
- Brain.fm publishes modulation rates per mode (sleep 0.25 to 1 Hz, relax 6 to 10 Hz,
  https://brainfm.helpscoutdocs.com/article/16-science). These are the company's own figures; its one peer-reviewed
  study concerns attention with 12 to 20 Hz modulation, not relaxation. Not used as evidence here; noted because it is
  what a popular app does.

### 2.4 The Web Audio pieces (MDN)

- `AudioParam.setTargetAtTime` approaches a target exponentially and never quite reaches it; one time constant covers
  63 per cent, three cover 95 per cent, so a 4 s fade uses a time constant near 1.3 s. It can target 0, which
  `exponentialRampToValueAtTime` cannot ("the value needs to be positive").
  https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
- `ConvolverNode.buffer` takes "a mono, stereo, or 4-channel AudioBuffer containing the ... impulse response";
  `normalize` scales it by an equal-power rule. https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode
- `StereoPannerNode` pans with "a low-cost equal-power panning algorithm", pan -1 to 1.
  https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode
- Loudness is measured K-weighted as in ITU-R BS.1770 (two filters, then -0.691 + 10 log10 of the mean square); the
  harness reports an ungated LUFS-like figure for the steady part of each render.

### 2.5 Claims that stay out

- **Pitch meanings.** Unchanged from the 21 Oct note: no evidence for Solfeggio effects (Science Feedback review).
  The sheet keeps its one honest line.
- **Binaural beats.** Ingendoh, Posny and Heine (PLOS ONE 18(5), 2023, e0286023) reviewed fourteen EEG studies: five
  in line with entrainment, eight against, one mixed, and "the need for standardization" (PMC10198548).
  Garcia-Argibay, Santed and Reales (Psychological Research 83, 2019) pooled 22 studies across memory, attention,
  anxiety and pain into one medium effect (g = 0.45) with heterogeneous methods (PMID 30073406). Rhythme adds no
  binaural option: on a phone speaker a few-hertz difference between the ears collapses into a few-hertz amplitude
  beat, exactly the wobble removed here, and no claim could be made for it anyway.
- **Noise beds and sleep.** Capezuti and colleagues (Journal of Clinical Sleep Medicine 18(6), 2022; PMID 34964434):
  34 studies, 1,103 people, "no strong evidence to support use of auditory stimulation", and no adverse effects
  reported with short-term use. Rain, stream and waves stay as sounds some people find restful, with no sleep claim.

## 3. The rebuilt voice

All of it is Web Audio synthesis inside `ovu-tones.js`; nothing is downloaded or streamed. The pure tables and
functions below are exported for node checks. Codex reviewed the first proposal before the build
(docs/design/reviews/2026-10-22-codex-soothing-tones-design.md, verdict: build with changes) and the values here are the
reviewed ones. The partial levels, the hum and the room amount are listening hypotheses to be judged by ear; the beat
rates, the peak budget and the release shape are the parts the numbers can settle.

### 3.1 Partials (per chosen pitch f)

| partial | ratio | level | voices (offset in Hz, relative level, pan) | why |
|---|---|---|---|---|
| fundamental | 1 | 1.00 | 0 / 1.0 / centre; +0.21 / 0.10 / right 0.35; -0.37 / 0.05 / left 0.35 | the bowl's (2,0) mode, split three ways so it shimmers at 0.21, 0.37 and 0.58 Hz |
| octave | 2 | 0.24 | 0 / 1.0 / centre; +0.5 / 0.10 / left 0.2 | the sung bowl's harmonic (lock-in), gentle |
| third mode | 2.76 | 0.07 | 0 / 1.0 / right 0.25; -0.7 / 0.10 / left 0.25 | the struck bowl's next mode, inharmonic, soft |
| hum | 0.5 | 0 to 0.25 | 0 / 1.0 / centre; +0.3 / 0.10 / centre | a bell's hum under the prime; level 0.25 x clamp((f - 300) / 300, 0, 1), so none under 300 Hz, full from 600 Hz |

Beat rates are fixed in hertz, not a share of the pitch, so every pitch shimmers at the same slow pace (all under
1 Hz; section 2.2). A slow beat is not a shallow one (Codex): two equal sines cancel completely each beat, and the
first draft's 1 / 0.5 / 0.4 triplet could swing more than 20 dB. With the twins at a tenth and a twentieth the
fundamental's worst swing is under 3 dB, and the fixed offsets repeat their pattern every 100 s. Levels are normalised so
the sum of all voice amplitudes, after the equal-power pans, is 1 in the louder channel before the ceiling gain.

### 3.2 Shape, room, breath

- **Low-pass** (BiquadFilter lowpass) at clamp(2.2 x f, 700, 1800) Hz. A Web Audio low-pass takes its Q in decibels
  (Codex), so `Q.value = -6` is the critically damped slope with no peak: the filter never passes gain one. The octave of
  963 Hz (1926 Hz) sits past the cutoff and is softened rather than bare; the third mode of 963 Hz (2658 Hz) more so.
- **Room**: a ConvolverNode whose impulse response is 2.2 s of seeded decaying noise, one-pole low-passed at 2.5 kHz so
  the tail is dark (-60 dB at 2.2 s). The two ears hear one room: each channel's impulse is a shared sequence plus 0.4 of
  a sequence of its own (correlation about 0.86), because fully independent impulses answered a sine with a
  different magnitude and phase in each ear and left one channel up to 4 dB louder than the other on some pitches in
  the first measurement. A noise impulse answers each exact frequency with its own random gain, and the browser's
  equal-power normalisation bounds the impulse's energy, not that gain (Codex). So `normalize` is off and the room's
  share is set per pitch: the module computes the impulse's steady response at each of the pitch's sines (`roomGain`, a
  rotating phasor over the samples, about 10 ms for a pitch) and scales the wet gain so the loudest of them gets exactly
  0.2 (`wetFor`). Dry is 0.78 (a fifth of a decibel under Codex's first-audition values). The seed is fixed, so the offline render and the phone
  hear the same room at the same sample rate; at another rate the room differs in detail but the per-pitch scaling
  holds the level.
- **Breath**: one sine LFO at 0.1 Hz on a swell gain (0.92 +/- 0.08, under a decibel), free-running.
- **Envelope**: start from exactly 0 and rise with `setTargetAtTime` (time constant 2.5 s: half way at 1.7 s, 95 per
  cent at 7.5 s, gentler than the old 2.5 s line, which was half way at 1.25 s). Stop: five seconds of exponential
  approach to nothing, then a 50 ms ramp to exactly zero, every sine stopped on the audio clock 0.1 s after, the master
  closed 0.2 s later so the room's tail cannot escape, and the nodes released two seconds on as housekeeping. A
  wall-clock timer that may run late while the page is hidden never decides when sound ends.
- **Stereo**: small equal-power pans on the twins (section 3.1) spread the shimmer across the ears in headphones; on a
  phone speaker the channels sum, which the harness checks as a mono-average peak.
- **Peak budget**: the sines sum to one in the louder channel; the filter never passes one; the swell tops at one;
  dry 0.78 plus the room's loudest sine at 0.2 is 0.98, a fifth of a decibel in hand for the room's
  memory while a voice leaves; so the master gain bounds the loudest sample. When a pitch replaces
  another, the old voice leaves with a 0.12 s time constant while the new arrives with 2.5 s, so their sum falls before
  it rises and never exceeds one.
- **Ceiling and volume**: unchanged. `gainFor(appVolume)` (0.35 x the app volume) is the master gain every voice and
  the room pass through, and `setVolume()` moves it on the app's slider, for a bed too (the old code moved only the tone).
- **The app's sound switch** rules the spring (Codex): with sound off, neither a tone nor a bed starts (the sheet says so
  and she can still just sit), and a sound already playing ends when the switch goes off.
- **One sound by the water**: a tone replaces a bed as a bed replaces a tone; the old code could leave both running
  through the public functions.
- **The cave's own music** (ovu-music.js, a D drone with D, F sharp, A and B bowl strikes) now steps aside while a tone or
  a bed plays and returns after: `exclusive()` asks OvuTones, and the module's onChange makes the music re-decide at
  once rather than at its next half-second poll. Against a D drone, 417, 528, 639 and 852 Hz sat near G sharp, C, E
  flat and G sharp, a dissonance that cannot have helped. The music's return overlaps the tone's five-second leaving as
  a crossfade.

### 3.3 Beds

- Rain: pink noise (Paul Kellet's filter on seeded white) through a high-pass at 300 Hz and a low-pass at 3.5 kHz (both
  at -3 dB Q, no peak), with a 0.04 Hz drift of +/- 10 per cent. The old rain was white noise band-passed at 2.4 kHz,
  which hissed (83 per cent of its energy above 2 kHz).
- Stream: brown noise low-passed at 1100 Hz (0.85 +/- 0.15 at 0.3 Hz as before), plus a burble 14 dB under it: the same
  noise through a band-pass (Q 2) whose centre wanders 500 to 900 Hz at 0.23 Hz.
- Waves: brown noise low-passed at 520 Hz with the 0.09 Hz swell (0.55 +/- 0.45), plus a soft wash (pink noise
  band-passed at 1.8 kHz, 0.06 +/- 0.05) that rises with the same swell.
- Noise buffers are 6 s, seeded and different per channel, and loopable: the first 0.4 s is an equal-power blend of the
  start and the tail past the loop point, so the seam is continuous and the level never dips. Each bed's branches and
  their modulation sum to at most 1.2 of noise that peaks near a half, so a bed's loudest sample stays under 0.6 of its
  master, which now sits at the ceiling itself (the old 0.7 share made the beds 4 to 5 dB quieter than before relative
  to the tone; noise is spiky and its loudness low).

### 3.4 What does not change

Nine pitches, labels, MEANING line and its honest sentence, MINUTES, the sheet, sitting and standing, Stop, every
end condition (leaving the spring, walking, sleep, hidden page, clear, import, sync, timer), reduced motion (the tones
have no motion of their own), the volume contract, no diary entry, no hearts, no energy, no voice in the cave, every
public name of OvuTones (openTones included).

## 4. Proof

`tools/tones_render.py` (fixture `tools/fixtures/tones_render.html`) renders each pitch and each bed through the module
itself in an OfflineAudioContext (a fake root whose AudioContext returns the offline one; the lesson of 20 Oct) for the
old voice (`--before origin/main`) and the new one, 140 s each with Stop at 132 s through `OfflineAudioContext.suspend`,
and measures the steady part from 10 to 132 s (two minutes, as Codex asked): sample peak and a 4x true-peak estimate,
the mono-average peak, RMS of each channel and of the mono average, a K-weighted ungated LUFS-like level (ITU-R BS.1770
filters rebuilt from their analogue prototypes for the actual sample rate), spectral centroid, the share of energy
above 2 kHz, amplitude-modulation depth and dominant rate from 100 ms RMS windows, the share of modulation power that
is a wobble (1.5 to 8 Hz) against a swell (0.05 to 1.5 Hz), the largest sample step at start and around Stop against
the steady state's own largest step (a diagnostic only), and the level of the last half second. `--selftest` renders
a plain sine (must read as unmodulated) and a sine modulated 30 per cent at 3 Hz (must read as a 3 Hz wobble) to prove
the estimator before it judges anything. Targets for the new voice: no sample or true peak above the ceiling, a zero
first sample, no step at start or Stop above the steady maximum, a wobble share under 0.5, a modulation depth under
4 dB, the two channels within 1.5 dB, and silence in the last half second. Previews: the first 22 s as WAV at the real
level, plus loudness-matched copies (-26 LUFS-like) so timbres compare at one level; `ffmpeg` makes old-then-new m4a
files for Jamie. The spectral centroid is reported, not a pass condition: a bare sine already sits at its floor, and
quiet upper partials raise the centroid a little while making the sound less bare (Codex).

MEASURED_TABLE

`tools/test-core.js` 2k5b: the partial table (ratios, the fundamental loudest, every partial a centre sine with quiet
twins, all beats between 0.1 and 1 Hz, the fundamental's worst swing under 3 dB), the hum rule, the cutoff rule, the
impulse (repeatable from its seed, finite, within one, 50 dB down at its end, one room with two correlated ears), the
room's gain by phasor against a plain DFT and the per-pitch wet share, the seeded noises, the breath, envelope and
release shape, the sum of gains per pitch, no random numbers, the music module's exclusivity. 2k5c, with a fake
AudioContext and captured timers: the master at the ceiling, the dB Q, the unnormalised stereo room, the envelope from
zero, the slider reaching a tone and a bed, a bed replacing a tone and a tone a bed, Stop clearing at once with every
source stopped on the audio clock after the ramp to zero and the master after the room, housekeeping releasing every
node, the app's sound switch refusing both, a start that fails half way releasing what it built, a timed sit's timer,
the loopable seam. `tools/e2e_smoke.py`: the existing spring checks, plus a tone that holds its nodes while it fades
after Stop and lets every one go within a few seconds.
