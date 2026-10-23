<!-- Codex diff review round one, 22 to 23 Oct 2026, on commit c31ae69 of branch claude/soothing-tones-751441 (PR 84). Reviewer: codex exec -s read-only (gpt-6.1-sol). Verbatim. Round two follows below it. -->

The branch still has five P1 lifecycle/control defects. `node tools/test-core.js` passes **1,846 checks**, but the added tests miss these cases.

1. **P1: Fading sounds ignore the slider and sound switch.**  
   [ovu-tones.js:186](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:186) clears `gain`, and line 232 clears `bedNodes`, before their audio finishes. `setVolume()` at line 236 consequently cannot reach retiring graphs; the switch subscription at line 317 also checks only active playback. Reproduced: start a tone, Stop, then set volume zero. The old master retains `0.088` until its closing ramp 5.1 to 5.3 seconds after Stop. Keep draining masters controllable while preserving their terminal zero.

2. **P1: A bed’s fade-in can restore the volume after the slider reaches zero.**  
   [ovu-tones.js:204](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:204) schedules the original volume at `now + 3`. Line 236 adds `setTargetAtTime()` without cancelling that future ramp. Starting at volume 0.25 and moving to zero at one second leaves the nonzero endpoint scheduled for three seconds. Cancel and hold superseded automation before setting the new target.

3. **P1: Housekeeping can truncate an audible release after suspension.**  
   [ovu-tones.js:182](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:182) uses wall time, then `release()` at line 141 immediately stops and disconnects everything. Stop at audio time 30 schedules final master zero at 35.3. Suspend for 6.8 wall seconds, then resume: housekeeping can disconnect around audio time 30.2, well before the fade finishes. This permits an abrupt cut despite the scheduled audio-clock release. Disconnect only after the audio deadline or appropriate ended events.

4. **P1: Partial construction can leak a started oscillator.**  
   [ovu-tones.js:161](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:161) starts the LFO before adding it to `nodes` at line 163. Injecting failure in the envelope’s `createGain()` at line 162 leaves the LFO started, unstopped and undisconnected, while `start()` returns false and `liveNodes()` reports zero. Similar delayed registration occurs elsewhere. Register each allocation immediately, before subsequent operations can throw.

5. **P1: Resume rejection leaves successful-looking playback armed.**  
   [ovu-tones.js:138](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:138) swallows synchronous resume errors and promise rejections. Reproduced with a suspended context whose resume rejects: `start()` returns true, `playing()` remains 528, and 33 nodes remain held for an untimed tone. A later resume can activate stale sound. Handle failure against the originating playback generation, release its graph, clear state and notify listeners.

6. **P2: The channel normalization does not match the graph.**  
   [ovu-tones.js:73](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:73) counts every centered sine with equal-power coefficients of approximately 0.707. Line 166 bypasses the panner for those sources, so their mono signal upmixes at full amplitude into both channels. Actual summed channel gains reach approximately **1.341 at 174 Hz** and **1.352 at 963 Hz**, rather than one. Normalize the actual routing or use centered panners consistently.

   `roomGain()` computes the steady response correctly, and `wetFor()` caps the checked carriers’ wet response. That does not establish the claimed complete peak bound: the routing differs, modulation adds sidebands, and convolution retains history during replacements. I did **not** reproduce an isolated steady-state ceiling breach. Add rendered replacement and transition cases before treating the ceiling argument as proven.

7. **P2: Failed replacement leaves stale timer state.**  
   [ovu-tones.js:170](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:170), also line 225, clears playback pointers without clearing `endAt`/`endT` or notifying listeners. After a timed tone followed by a failed replacement, `remaining()` still reports the original duration. A subsequent `stop()` takes its early return and leaves that timer intact. Consolidate failure cleanup with timer and notification cleanup.

8. **P2: K-weighting does not reproduce the claimed reference response.**  
   [tools/fixtures/tones_render.html:15](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/tools/fixtures/tones_render.html:15) uses an RBJ shelf whose coefficients differ from the BS.1770 reference implementation. The difference is approximately 0.49 dB near 1682 Hz at 48 kHz. Correct the rate-dependent filter derivation and add reference-response checks. The modulation self-test does not test loudness calibration.

9. **P3: Correct the beds’ exact peak argument.**  
   [ovu-tones.js:196](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:196) assumes the loopable noise remains bounded by 0.5. Equal-power overlap can increase its peak; the actual 44.1 kHz pink buffer with seed 617 reaches approximately **0.51235**. The seam construction is sensible, but test the post-overlap buffer and combined filtered branches. This observation alone does not demonstrate a ceiling breach.

The tests explain why these escaped. [tools/test-core.js:843](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/tools/test-core.js:843) assigns future ramp endpoints immediately to `.value`; it does not evaluate automation over time. The lifecycle world omits the real document/store subscription, checks slider changes only on a live tone, always resumes successfully, and injects construction failure before the vulnerable LFO section. Both `liveNodes()` and the new smoke assertion can miss unregistered nodes. The renderer exercises isolated starts and Stop, rather than replacements, changing volume or music returning over a tail.

The quiet twins, running-context exact-zero release, scheduled source stops, and music callback wiring follow the design. The default analysis window is 122 seconds. The AM estimator and true-peak interpolator passed independent numerical probes. Music’s return overlap is explicitly accepted as a crossfade. I found no new claim, diary, hearts, energy, download, public-name or reduced-motion violation.

I made no changes and ran no network operations. I did not rerun browser renders or audition the audio.

VERDICT: HOLD, P1: 1. Uncontrolled release tails; 2. Bed fade-in overrides slider; 3. Wall-clock release truncation; 4. Partial-construction leak; 5. Rejected-resume cleanup.
