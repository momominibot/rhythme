<!-- Codex design review, 22 Oct 2026, before the build. Reviewer: codex exec -s read-only (gpt-6.1-sol) on branch claude/soothing-tones-751441 with docs/design/2026-10-22-soothing-tones.md and the proposed voice table as the brief (scratchpad codex/design-brief.md). Verbatim. -->

**Build with changes.** The direction is sensible, but the proposed beating is deep, the output-peak guarantee is incomplete, and the release and measurement plan need correction.

This was an offline source and mathematical review. No files changed, no audio was auditioned, and phone performance remains unverified. Files changed concurrently during the review, so findings below assess the supplied proposal and original `HEAD` implementation.

**1. P1: Reduce the twin amplitudes. Slow beats are not necessarily shallow.**

A `1:0.5` pair swings between amplitudes 0.5 and 1.5, which is **9.54 dB**. The original `1:0.35` pair swings **6.35 dB**, rather than the note’s approximately 5 dB.

The proposed fundamental triplet, `1 / 0.5 / 0.4`, can approach amplitudes **0.1 to 1.9**. With the specified equal-power pans, its fundamental envelope still spans approximately **22.9 dB in the mono average**, before filtering and reverb. That risks replacing a fast wobble with pronounced slow fading.

Keep the offsets, but start with:

- Fundamental: **1 / 0.10 / 0.05**.
- Other partials: **1 / 0.10**, increasing to 0.15 only after listening.
- Retain the separate `0.9 ± 0.1` swell initially.

The revised fundamental has an unpanned worst-case swing of **2.63 dB**. These are audition starting values, not established thresholds for soothing sound.

Also, “never in step” is incorrect: the fixed offsets are commensurate, and the fundamental’s pattern repeats every **100 seconds**.

**2. P1: Establish the ceiling after the complete signal chain.**

Normalising oscillator amplitudes bounds their initial sum. It does not bound the result after filtering, convolution, parallel branches or overlapping releases.

Two specific problems:

- Web Audio lowpass/highpass `Q` uses decibels. **`Q.value = 0.5` is not linear Q 0.5**. For critically damped linear Q 0.5, use approximately **`Q.value = -6.0206`**, then verify the response with `getFrequencyResponse()`.
- Convolver normalisation controls aggregate IR energy, not maximum frequency-response gain. A steady sine sees the complex response `H(f)`, giving a dry/wet response proportional to **`0.75 + 0.35 H(f)`**. That can reinforce or cancel differently at every partial and in each ear.

Consequently, **wet 0.35 does not guarantee acceptable level spread**. A fixed seed makes that coloration repeatable, not uniform.

For a first audition, I would reduce wet to **0.12** and use dry **0.85**, followed by attenuation based on the complete graph. Those values alone still do not prove the ceiling. A strict guarantee needs conservative bounds, including the actual convolution kernel and channel routing. Explicit kernel scaling with `normalize=false` makes that easier to reason about than browser normalisation.

Include retiring voices in the same output budget. Two individually bounded voices can exceed the budget while crossfading. Use complementary amplitude fades, not equal-power crossfades, when a strict peak bound is required.

**3. P1: Finish the release at exact zero and stop sources on the audio clock.**

Starting `setTargetAtTime()` from exactly zero is valid. It is not subject to the positive-value restriction of `exponentialRampToValueAtTime()`.

The stop claim is incorrect, however. After five seconds with time constant 1, the envelope remains:

`exp(-5) = 0.006738`, or **−43.43 dB relative**.

At full ceiling, abrupt truncation could leave a step approaching **0.00236**, approximately **−52.5 dBFS**. Whether audible depends on signal and playback conditions, but it is not guaranteed click-free.

Keep the exponential release, then finish with a short ramp to exact zero, for example **4.95 to 5.00 seconds**. Schedule source stops with `.stop(audioTime)` just afterward. Put the final release envelope **after the dry/wet mix**, so convolution tails cannot escape it.

Use per-node cleanup with independent exception handling. Wall-clock timers should provide housekeeping, not determine audible termination. They can run late while hidden, or run while the audio context is suspended. Cleanup must also cover partial construction failures and rejected context resumes.

Preserve the existing immediate logical Stop and standing behaviour. Track draining graphs separately from `playing()`.

**4. P1: Explicitly repair the original switch, slider and replacement gaps.**

I reproduced these against the original `HEAD` module using an offline fake audio context:

- Both starters accept playback while `OvuSound.enabled()` is false.
- `setVolume()` changes tone gain but leaves bed gain unchanged.
- `startBed('rain'); start(528)` leaves both `playing() === 528` and `bed() === 'rain'`.

The sheet’s preliminary `stop()` masks the last problem, but the public API does not.

Both starters should replace either sound type. The app switch and slider must reach tones, beds and audible release tails. Keep `setVolume()` reading the app’s current setting.

Do not simply attach this module to `OvuSound.graph().master`: that master already applies **`4 × volume`**, which would change the scaling contract unless compensated. The concurrently edited candidate appeared to address bed-slider updates, but that does not establish switch or release-tail correctness.

**5. P1: Repair the harness before relying on its pass result.**

The existing harness has useful foundations, including invoking Stop through `OfflineAudioContext.suspend()`. Its current acceptance checks do not prove the proposal’s guarantees:

- Default steady analysis covers **5 to 14 seconds**, only nine seconds. Use **at least 120 seconds of steady audio after a separate settling period**, keeping 20-second previews separate.
- Offline audio advances independently of real `setTimeout()`. Rendering completion therefore does not establish that timeout-based teardown occurred.
- `tools/tones_render.py:60` prints a live-node warning without failing the run.
- The default is 48 kHz, with no sample-rate CLI option. Exercise **44.1 and 48 kHz**, using rate-correct K-weighting coefficients.

Make missing lifecycle instrumentation and nonzero live-source counts fail. Independently track source creation, scheduled stops, ended events and disconnection rather than trusting a counter that could drop when references are cleared.

Add **4× or greater true-peak estimation**, volume **0 / default / 1**, rapid replacements, repeated Stop, volume changes during attack and release, timer expiry, failed starts, and hidden/suspended/resumed cases. Verify that returning to the page does not resurrect stopped sound.

**6. P2: The partial ratios and hum are plausible, but remain listening hypotheses.**

The fundamental, octave and soft 2.76 partial form a reasonable hybrid bowl-like timbre. Sustaining a struck-bowl mode continuously is a creative choice, not evidence that it will sound warmer or less eerie.

I would audition **0.03 to 0.06** for the 2.76 partial against the proposed 0.11.

The hum rule is continuous and avoids introducing sub-150 Hz content at the low end. Its **300/600 Hz thresholds are design choices**, though. At 963 Hz, the hum is **481.5 Hz**: lower body, but not deep bass. It may also shift perceived pitch toward `f/2`. Keep it subordinate and compare headphones with phone speakers.

After correcting Q, the cutoff rule is a reasonable starting point:

| Selected pitch | Cutoff | Approximate attenuation: fundamental / octave / 2.76 partial |
|---|---:|---:|
| 174 Hz | 700 Hz | −0.5 / −1.9 / −3.4 dB |
| 963 Hz | 2200 Hz | −1.5 / −4.9 / −7.8 dB |

These are transfer-function estimates for linear Q 0.5. At 174 Hz, the filter preserves considerable bowl coloration. At 963 Hz, it substantially suppresses upper partials without removing the selected pitch. I would fix Q before changing these cutoffs.

**7. P2: The proposed attack is initially faster than the old one.**

Time constant 1.3 seconds reaches 50% in **0.90 seconds**. The original 2.5-second linear attack reaches 50% in **1.25 seconds**.

Thus, “95% in four seconds” does not establish a gentler arrival. Try a **five-second raised-cosine attack**, or time constant **2.5 seconds**, reaching 95% around 7.5 seconds.

**8. P2: Improve the beds, but specify seams and branch budgets.**

Pink rain with a 300 Hz highpass and 3.5 kHz lowpass is a sensible alternative to the concentrated white-noise band. Keep the filters nonresonant.

The stream’s moving bandpass is also plausible. Start its burble **12 to 18 dB below the main stream branch** to avoid a conspicuous sweeping resonance. Keep the wave wash similarly subordinate to its brown-noise body.

Six-second noise buffers need explicit seamless construction. Otherwise they can produce a repeated boundary transient. Use roughly **250 to 500 ms of bounded overlap**, or construct a periodic filtered buffer. Avoid creating a recurring dip by merely fading both buffer ends to silence.

Normalise the combined filtered branches, including maximum modulation gain. “0.7 × ceiling” at a gain node does not by itself bound their sum. Account for DC and filter settling.

**9. P2: Keep spectral metrics descriptive and add listening and device checks.**

“Lower centroid for every pitch” is not a useful universal pass condition. Adding quiet upper modes can improve timbre while increasing centroid. Lower centroid can also mean a dull or muffled sound.

Retain centroid and energy above 2 kHz, but additionally:

- Report channel RMS, stereo energy and mono-downmix RMS separately. The fixture currently labels mono-average RMS as RMS.
- Define mono explicitly. `(L+R)/2` is an average, not a raw sum. Check cancellation and tonal balance, not only peak.
- Validate the AM estimator using unmodulated sine fixtures. Short RMS blocks can retain carrier ripple and create misleading modulation readings.
- Treat sample-step comparison as a diagnostic. A high-frequency carrier’s normal slope can hide a smaller discontinuity.
- Provide raw-level previews and separate loudness-matched comparisons. Independently peak-normalised previews conceal level differences.

A 2.2-second stereo float IR occupies approximately **0.74 MiB at 44.1 kHz** or **0.81 MiB at 48 kHz**, excluding convolution workspace. Its size is not intrinsically alarming. Cache it, avoid accumulating convolvers during rapid switching, and test the complete game in real time on a mid-range phone and iOS Safari. Offline Chromium cannot establish dropout-free playback.

The same seed at different sample rates does **not** produce an identical physical-frequency response. Require repeatability at matched rates, with bounded differences across rates.

**10. P2: Yes, make tones and beds exclusive through the music module.**

This is appropriate for all nine pitches and all three beds. Avoid maintaining a special list of supposedly compatible pitches.

The least invasive wiring is entirely inside `ovu-music.js`. Add this to `exclusive()`:

```js
var tones = root.OvuTones;
if (tones &&
    ((tones.playing && tones.playing()) ||
     (tones.bed && tones.bed()))) return true;
```

Register once inside the existing guarded `init()`:

```js
if (root.OvuTones && root.OvuTones.onChange) {
  root.OvuTones.onChange(function () {
    reconcile('tones');
  });
}
```

Tones already loads before music. The existing 500 ms poll remains a fallback; the callback removes its delay. Query both accessors because the callback argument is null for beds.

Keep `decide()` responsible for returning music only when its preference, sound switch, visibility and other activity conditions permit. Never call `set(true)` on tone completion.

One distinction matters: Stop clears the accessors immediately while the tone releases for five seconds. The existing music return will therefore overlap that tail. Accept this as a deliberate crossfade, or add separately tracked draining state if strict non-overlap is required. Do not redefine `playing()` to include release tails.

**11. P3: Preserve the remaining contracts and soften the note’s certainty.**

The proposal can preserve the honest sentence, pitch labels, synthesis-only operation, optional quiet sitting, reduced-motion behaviour and absence of diary, hearts or energy effects. Preserve the existing `openTones` alias too.

Keep every current scene stop hook and test those paths with actual audio lifecycle assertions. Describe “less eerie,” “warm,” and the claim that the octave made the original thin as listening hypotheses rather than established explanations.

VERDICT: BUILD WITH CHANGES, P1: 1. Reduce beat depth; 2. Bound the complete output and correct Q; 3. Reach exact zero with audio-clock stopping; 4. Enforce switch, slider and replacement contracts; 5. Repair measurement and lifecycle assertions.
