<!-- Codex diff review round two, 23 Oct 2026, on commit 47968c1 (PR 84). Reviewer: codex exec -s read-only (gpt-6.1-sol). Verbatim. -->

The diff still needs a hold. `node tools/test-core.js` passes **1,854 checks**, but additional offline probes reproduced the defects below. No files changed, no network operations ran, and I did not rerun browser renders or audition the audio.

1. **P1: Switch-off still misses some paths, and later volume updates can revive a hushed tail.**  
   At [ovu-tones.js:338](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:338), sleeping takes precedence over the sound switch. The `external` branch also calls only `endAll()`. Reproduced both cases with sound disabled: playback clears, but the draining graph’s volume retains its original `0.088`, without hush automation. Cross-tab sound changes reach this path through `ovu-store.js:141`.

   Separately, `hush()` leaves no terminal mute state. `setVolume()` at line 255 retargets every held graph to a positive gain. Turning sound off, then back on during the five-second release, restores the ended tone’s volume although `playing()` is null and she has stood up.

   Apply switch-off across all relevant subscription branches and keep existing hushed graphs muted. Tests at `tools/test-core.js:895-896` call hush last; neither they nor the rendered switch-off scenario exercise these sequences.

2. **P2: Generation changes can suppress necessary cleanup or cancel a newer silent sit.**  
   [ovu-tones.js:176](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:176), also lines 222-223, increments `gen` before `ensure()` succeeds.

   Reproduced: A starts 528 Hz with a pending resume rejection; B’s resume throws synchronously and B returns false. A’s rejection is then ignored because B changed the generation. A remains armed with **34 nodes**, `playing() === 528`, and its timer intact.

   Conversely, Stop and choosing Just sit do not invalidate A’s generation. A later rejection can therefore run `fail()` and clear the newer silent sit’s timer. The single-start rejection test at `tools/test-core.js:912-920` misses both ownership cases.

3. **P2: AudioContext constructor failures now escape the public start functions.**  
   [ovu-tones.js:147](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:147) constructs the context, but both calls to `ensure()` now sit outside their `try` blocks. Injecting a throwing constructor makes both `start()` and `startBed()` throw instead of returning false. Round one caught this failure. Restore the exception boundary and add constructor-failure tests.

4. **P2: Released graphs can retain housekeeping timers indefinitely.**  
   [ovu-tones.js:159](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:159) does not check whether its graph has already been released.

   Reproduced: start while suspended, Stop, then reject resume. `fail()` disconnects everything and `liveNodes()` becomes zero, but the existing housekeeping callback repeatedly schedules another **5,600 ms** timer against the frozen audio clock, retaining the disconnected graph.

   Waiting through a temporary suspension is appropriate for a still-held release. Re-arming after release or failure is unnecessary. Cancel its timer or make released graphs terminal.

5. **P2: Scripted render tests can pass failed or silent replacements.**  
   [tones_render.html:36](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/tools/fixtures/tones_render.html:36) ignores scripted `start()`/`startBed()` return values. The assertions at `tools/tones_render.py:106-114` impose upper bounds and silence checks. A replacement that refuses to start, or produces silence, can therefore pass. Assert successful starts and meaningful output during each intended audible segment.

The nine original findings reconcile as follows:

| Original finding | Round-two result and remaining coverage limits |
|---|---|
| 1. Uncontrolled tails | Held graphs now receive slider changes. Switch control remains incomplete as finding 1 above shows. |
| 2. Bed arrival versus slider | Fixed by separate arrival and volume gains at `ovu-tones.js:226-227`. The scripted zero-during-arrival case targets the original regression. |
| 3. Wall-clock truncation | Fixed for normal draining graphs at lines 159 and 205-206. Tests pin early re-arming and eventual release; they miss already-released graphs. |
| 4. Partial-construction leak | Fixed by immediate `make()` registration. The eighth-gain failure test at `tools/test-core.js:907-909` reaches the previously leaked LFO and checks cleanup. |
| 5. Rejected resume | Fixed for an isolated start, but generation ownership remains incomplete. |
| 6. Channel normalization | Fixed for the actual panner routing at `ovu-tones.js:64,189`. Independently calculated channel sums remain approximately one. Rendered transition cases help, subject to finding 5 above. |
| 7. Failed replacement timers | Both construction catches clear timers and notify at lines 193 and 247. The added failure test exercises the tone catch, not the bed equivalent. |
| 8. K-weighting | Fixed at `tones_render.html:16-21`. Independent comparison gives maximum coefficient deviation **8.88e-16**. The self-test pins the original error. |
| 9. Bed peak | Fixed by post-seam scaling at `ovu-tones.js:211`. Independent checks of actual six-second buffers give exactly **0.5** at both sample rates and both channel seeds. The shipped unit fixture uses a shorter 48 kHz buffer, not the cited 44.1 kHz case. |

The lifecycle fake still does not evolve target automation over time, and it removes `OvuRoom`, so the real scene subscription is untested there. Music exclusivity has source-regex coverage rather than a behavioral integration test.

I found no additional problem with stage ordering, immediate node registration, or normal catch cleanup. Releasing earlier held graphs after a current shared-context resume failure is reasonable once ownership is correct. Visibility still ends the session. Script order supports the music subscription, which checks both tones and beds; the documented music-return crossfade remains intentional.

Public names and the `0.35` ceiling remain intact. I found no added emoji, health claim, em dash, downloaded audio, diary/hearts/energy write, or reduced-motion change. I reproduced no new DSP ceiling breach, but did not independently rerender the recorded peak measurements.

VERDICT: HOLD, P1: 1. Make switch-off reach every relevant state path and remain terminal for hushed draining graphs.

