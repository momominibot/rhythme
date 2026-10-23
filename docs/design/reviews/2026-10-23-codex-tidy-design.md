# Codex design review: Tidy up your room with the magical broom (23 Oct 2026)

Reviewer: codex exec -s read-only (gpt-6.1-sol) on 752f577 (origin/main after PR 80), given the brief below. Verbatim.

## Review

The idea fits. Change the lifecycle, placement and persistence contracts before building. I reviewed `752f577` read-only and reproduced the floor-selection issue with an in-memory geometry probe.

1. **P1: Stop the broom before opening the save question.**  
   `askPracticeDone()` cancels the practice runner but retains `practice` until Yes/No. `stopEverything()` can enter that same path. Your two proposed `practiceEnd` emissions therefore allow continued sweeping and state changes after Stop. See [room.js:3079](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.js:3079).

   Define one idempotent sweep-cancellation function, invoked synchronously when the runner stops and directly by `stopEverything()`. Cancel rAF, timers, effects and pending writes using a run token. Already swept items stay removed; unswept items remain. **Q4: end at the stopping sheet.**

2. **P1: Enforce 60 active seconds at the actual save boundary.**  
   The unchanged path does not guarantee your owner rule: confirmation currently allows `secs >= 30`. Guide timers can advance while hidden, although `practiceMs()` subtracts hidden time. A naturally finished guide can consequently save 30–59 active seconds. See [room.js:3090](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.js:3090).

   Require at least 60 active seconds for every tidy save exit, including natural completion. Separately, explicitly pause all broom phases while hidden. rAF suspension protects movement; it does not protect timer-driven dwell, removal or reduced-motion sequences.

3. **P2: Separate item kind from floor slot.**  
   Four kinds cannot index three spots: `cushion` would address nonexistent spot 3.

   Give each item a persisted, unique `slot: 0..2`, independent of kind. Assign an unoccupied slot when spawning. Persist the rotation counter too; the proposed schema currently omits it. Modulo indexing would allow sock and cushion to overlap.

4. **P2: Select the actual ground floor and validate against placed furniture.**  
   `y >= upstairsY` admits upstairs landings and stair areas. I reproduced eligible candidates at `(25,55.5)` in both house and bathhouse. The homes contain separate ground, upstairs and stair polygons in [ovu-walk.js:76](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-walk.js:76).

   Restrict clutter to the ground-floor polygon and exclude the stair corridor. `world(L, [])` also omits movable furniture: revalidate slots against current prop footprints and define a deterministic fallback when furniture covers one.

   **Q5:** six/eight iso units are reasonable starting values, after those corrections. Specify distance from the **floor boundary**, rather than the image rectangle, and allow fewer than three usable spots when necessary.

5. **P2: A planned route does not prove the broom reached an item.**  
   `plan()` can snap its destination and recover from blocked starts. The petwalk pattern additionally validates the returned endpoint and route segments. See [ovu-petwalk.js:44](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-petwalk.js:44).

   Define brush reach, check the returned endpoint against it, and validate every travelled segment with `segClear` against the live world. A skipped or unreachable target must remain. Test furniture covering an item and her standing directly on one.

6. **P2: Adding `tidy` to `GAME_KEYS` is necessary, but insufficient.**  
   **Q2: yes**, account-copy-wins is appropriate. However, account replacement can arrive through an ordinary `state` notification. Game-save application uses `commit()` and then rerenders props; it is not limited to external/sync/clear/import reasons. See [ovu-gamesave.js:202](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-gamesave.js:202).

   Use copied state plus rollback-safe `S.commit()`, coordinated with the existing game-save lock. Inside the lock, reload and recheck run identity, layout and item existence. Cancel an active sweep when its underlying account tidy copy is replaced. Preserve the item visually if persistence fails.

7. **P2: Make `pose:null` work throughout the presentation path.**  
   Both Everyday card builders currently request `avatar-act-${a.pose}.webp`, producing `avatar-act-null.webp`. Also, merely skipping `setPose()` can leave her in an earlier moment pose: `practice` is assigned before `endMoment()`, whose standing restoration requires no practice. See [room.js:3033](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.js:3033).

   Use `cleaning_services` or broom art for both cards. For a null pose, explicitly restore her standing outfit and invalidate pending pose loads.

   **Q1:** standing and watching is the honest inexpensive choice. Skip the handle overlay. Any joy hop must respect reduced motion and run cancellation.

8. **P2: Resolve the daily-anchor contradiction.**  
   Resetting today’s allowance while retaining yesterday’s `last` immediately backfills clutter after an absence. That contradicts “150 minutes after the first visit of the day.”

   Anchor a strictly later day at its first eligible own-home visit. Keep the day watermark forward-only. Apply timestamp clamping to `tidy(ids,t)` too, so tidying after rolling the clock back cannot rewind `last`. Test midnight, several absent days, a full floor and backward-clock tidying.

9. **P2: Describe the initial guide as text-only.**  
   The current sheet promises spoken guides, and `complete()` records “Erin’s voice” even when this new practice has no clips. See [ovu-mindful.js:190](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-mindful.js:190).

   Add explicit audio-availability metadata and truthful card/journal wording. Preserve interim authorship. Missing-clip fallback is useful resilience, but should not be the advertised delivery mode.

10. **P3: Tighten the animation and test promises.**  
    A 45–70-second sweep is not guaranteed to finish before one minute. Let route completion determine its duration. Fit the generated broom by measured height; fixed width alone cannot guarantee the intended proportion. Keep the contact wrapper and shadow stationary while swaying its child image. Existing `propin` changes position and scale, so use a dedicated opacity-only entrance if that is the intended effect.

    Add behavioural checks for Stop while confirmation remains unanswered, hidden dwell/removal, account replacement, failed storage, all four kinds occupying three slots, and one-activity refusal in both directions. Use separate seeded runs for full clearing and partial interruption. Source-string checks alone cannot establish those behaviours.

**Q3:** commit game-clutter removal as the broom passes, after successful persistence. Keep “Yes, I did it” exclusively about the real practice, journal entry and existing reward path. No undo or hearts are needed for visual clearing.

**P3, Q6: Script A is mostly sound; Script B needs softer wording.**

- A2: “If you like, choose one thing to put away. Notice its weight and texture as you lift it.”
- A5: replace the assumed cleared patch with “Notice the space around you and let one breath come naturally.”
- B3: “a little more care than usual” implies previous care was inadequate. Use “Put it where you want it to live. Notice the small sound as it settles.”
- B4: “slow once more” makes the permission conditional. End with “If your pace changes, simply notice.”
- B5 promises an improved outcome. Use “Pause wherever you are. Notice the room again. It can stay unfinished.”

The supplied scripts total **150 seconds and 145 seconds**. Quick pace should continue suppressing incidental moment lines; it need not suppress a guide she explicitly chooses.

VERDICT: HOLD


## Brief

    You are reviewing a DESIGN before it is built, read-only, in the Rhythme repo (vanilla JS PWA; the working directory is
    the branch claude/magic-broom-93770c, identical to origin/main at 752f577 after PR 80 shopkeepers; nothing is built yet). Read room.js (LAYOUTS
    at the top, renderProps, tap, openSheetFor, stopEverything, activityNow/refuseBusy, runPractice, askPracticeDone,
    stopPractice, the window.OvuRoom export and emit), ovu-mindful.js (the practice table and complete()), ovu-pets.js (the
    poop model: current(), MAX_POOPS, the pattern to copy), ovu-walk.js (world, plan, rasterise, segClear, sprites with its
    '.keeper' non-solid pattern from PR 80, sortDepth, depthRank, the HOMES floors), ovu-keepers.js (the pattern for a sprite
    layer of its own with the ground shadow), ovu-petwalk.js (a sprite moving along a planned route with rAF), ovu-care.js
    (how a slow step is dropped on layout, activity, sheetHide, visibilitychange and sleep), ovu-sound.js (KIT),
    ovu-moments.js, room.css (the grounding block "nothing floats" near line 1826, .poop, @keyframes poof, .sparkle),
    ovu-gamesave.js (GAME_KEYS), tools/test-core.js (the scenes() helper near line 2320 and the farm block near 3070) and
    tools/e2e_smoke.py (block 1i near line 586 for the one-activity checks). Then tell me what to change in this plan
    before I build it. Rank findings P1/P2/P3, say what to do for each, and end with one line: VERDICT: BUILD or
    VERDICT: HOLD (HOLD only if something must change in the design itself before building).
    
    ## What Jamie asked for (22 Oct)
    "tidy up your room can have a magical broom animation". Build "Tidy up your room" as a new everyday mindful practice
    in her home (the four home layouts: room, house, bathhouse, familyhome), with a broom that sweeps the room by itself.
    
    ## Owner rules (Jamie) that must hold
    - No emoji anywhere; every small picture is generated clay-style art or a Material Symbols glyph. No em dashes in copy.
      No model or provider names shown to users. Care copy is world-wide (no country numbers).
    - Nothing floats: every object on the floor gets the ground contact shadow at its true base (room.css .nb::before
      pattern, --cs footprint), no downward drop-shadow offset; sizes stay consistent with the room's scale (avatarW).
    - One activity at a time (room.js activityNow/refuseBusy, the 'activity' event): a running practice keeps going, a new
      one is refused with one line. A logged sleep stops everything. Hearts: practices pay the flat 2 up to the day's cap
      through the existing ovu-rewards.js practicePoints, nothing new; nothing under a minute is saved (stopPractice).
    - Never a nag: no toast, badge, reminder or count about clutter. It just sits there until she tidies.
    - Mindful pace "quick" (S.profile().mindfulPace === 'quick') already means moments show no line.
    
    ## Plan
    
    ### 1. Clutter model: ovu-tidy.js, pure part (no DOM; loaded in tools/test-core.js like ovu-pets.js)
    State under S.state().tidy: { items: [{ id, kind, at }], last: iso, day: { d: 'YYYY-MM-DD', n }, tidiedAt: iso }.
    - KINDS = ['sock', 'cup', 'books', 'cushion'] (a pair of socks, a mug on its side, a tumbled stack of books, a cushion
      askew). MAX_ITEMS = 3 on the floor at once, PER_DAY = 2 new items a calendar day, GAP_MIN = 150 (an item appears 2.5
      hours after the last tidy, or after the previous item appeared, or after the first visit of the day).
    - current(t): like OvuPets.current: start from the saved state; `last` is the anchor (set to t on the first call ever);
      while items.length < MAX_ITEMS and today's n < PER_DAY and t - last >= GAP: push { id: 't' + time.toString(36),
      kind: next kind not already on the floor (cycling by a counter so repeats stay fresh), at: last + GAP }, last = at,
      n++. Forward-only: a clock set back never spawns (t < last is treated as t = last) and never re-opens a day's count.
      The day key is the local date of t (S.today(new Date(t))).
    - tidy(ids, t): removes those ids, sets tidiedAt = t, last = t (so the next item is a full gap after the tidy).
    - spots(L, world): deterministic floor spots per layout computed from the plate geometry, not hand-placed: rasterise
      OvuWalk.world(L, []) (floor zones minus furniture), keep cells whose 8 neighbours are all free (clearance), drop cells
      within 6 iso units of L.home, any hotspot stand point, any door, the stairs, and within 8 of the plate's edge; in
      the houses only the ground-floor zone (y >= upstairsY); then a greedy farthest-point pick of 3 spots. Each item's
      position is its kind's index into the layout's spots, so a sock lands in the same place every time in that layout.
      Verified by compositing the keyed sprites on each of the four plates (a Python composite I look at) and by core checks.
    - A core check per layout: every spot is on the floor, outside every solid, and OvuWalk.plan can route from L.home to
      it and from each spot to the next with every leg on free cells (the farm block's pattern).
    
    ### 2. The practice: ovu-mindful.js ACTIVITIES gets { id: 'tidy', name: 'Tidy up your room', icon: 'cleaning_services',
    minutes: 3, pose: null, when: 'Any room that needs a few minutes of care', intro, variations: 2 scripts of 5 or 6 steps
    (about 150 to 170 s total), interim text in Erin's voice style (author not erin; no clips exist, so playUrl falls to
    the caption and the step's seconds, as it does for any missing clip). Lines are about the real tidy she is doing (pick
    one thing out of place, feel its weight, put it where it lives, notice the clear patch of floor), no "should", no
    praise of outcomes, at most about 25 words a line. runPractice gets one guard: if the activity has no pose it does not
    call setPose (she stands and watches; avatar 'acting' class still set so she holds still). Everything else
    (HUD, Stop, hearts, the save question, the one-activity rule, the sleep rule) is the existing practice path unchanged.
    
    ### 3. The broom: ovu-tidy.js DOM part (mounts on R.on('boot'))
    - A layer #tidyLayer beside #ownedProps (inserted before it like #plateOcc, no stacking context of its own) holds the
      clutter buttons (.tidy.tidyitem, role button, aria-label "A sock on the floor. Tap to tidy up.") and, during a sweep,
      the broom (.tidy.broom) and its effects. ovu-walk.js sprites() adds '#tidyLayer .tidy' as non-solid (as it does '.keeper') so the one depth
      sort ranks them with her and the pets by their feet (clutter is small; she and the pets step over it; the broom moves).
      INTERACTIVE in ovu-walk.js and camInteractive in room.js get '.tidy' so a tap on an item is not a floor walk or a pan.
    - Rendering: on 'layout', 'props' and S.subscribe (external/sync/clear/import) the module reads current(Date.now()),
      writes the state only if it changed (S.setState({ tidy })), and draws the items for this layout (home scenes only;
      nothing outdoors, nothing while visiting a neighbour's house). Widths in plate percent scaled by L.avatarW / 12:
      sock 2.6, cup 2.4, books 3.2, cushion 3.6, broom 4.2 (the broom about 60% of her height). Ground shadow via the
      same ::before rule as .nb and .keeper (room.css line 1827) with --cs per kind (books .9, cushion .9, cup .6, sock .7, broom .3). Items fade in (the
      existing propin keyframe), never bounce.
    - Tap on an item: if asleep, the room's own line (R.tap path: use OvuWalk.napping()); if an activity runs,
      R.refuseBusy(); else R.openEveryday('tidy') (the sheet with the practice selected; Begin starts it), the same as the
      bathtub opening the shower practice. No walk to the item.
    - Start: R.on('activity', (kind, id) => kind === 'practice' && id === 'tidy' && at home) starts the sweep. The broom
      appears beside her (the nearest free floor point 5 to 7 iso units to the side she is not facing, else behind) with a
      burst of 8 sparkles and OvuSound 'boop'; then it follows a route planned with OvuWalk.plan through the items in
      nearest-first order, then through the layout's empty spots (a once-over of the floor), then to a rest point near the
      door, moving at 6 iso units a second (calm; she walks at 26) in a rAF loop on the petwalk pattern (dt clamped to
      0.1 s, every step checked against the floor as it is now: world(L, props) with her feet as a solid; a blocked step
      re-plans once, else skips to the next target). At each item it pauses 1.4 s with a quicker sway and a sparkle burst,
      the item gets the poof keyframe (0.6 s) and 'swish' plays, and OvuTidy.tidy([id]) is committed at once (so a Stop
      after that keeps the floor honest). Sparkle trail: a .spark span every 120 ms at the broom's base, 700 ms life, at
      most 14 alive, removed on end. After the rest point the broom dissolves in sparkles (0.8 s) and the layer is empty of
      everything but the remaining items. Whole sweep about 45 to 70 s, so it is over before the one-minute save threshold
      and she keeps listening to Erin's closing steps with a tidy floor.
    - End: room.js emits a new 'practiceEnd' (id) at the two places a practice ends (end() inside askPracticeDone and the
      short path in stopPractice); the sweep ends on practiceEnd, on 'activity' (anything else starting), on 'layout', on
      S 'clear'/'import', and on sleep (S.subscribe + R.asleep()), always removing the broom, every spark and every puff
      at once and leaving unswept items where they are. A hidden page pauses the loop (rAF stops; dt clamp resumes it) and
      the practice itself keeps its own hiddenMs accounting; if hidden at the end the broom is removed by practiceEnd.
      No sweep ever starts outdoors or while visiting.
    - Reduced motion: no trail, no sway; the broom appears at each item in turn for 1.2 s, the item fades (opacity, no
      transform), then the broom fades at the last spot.
    - Sound: only the existing kit ('boop' appear, 'swish' per item, nothing else); no new audio files.
    
    ### 4. Art (one guarded tools/art/run_batch.py run, no retries): 6 renders at 1024x1024 on chroma green in her chibi
    clay-toy style (reference for style: her standing sprite): sock pair, mug on its side, tumbled book stack, round cushion
    askew, the broom (upright, pale wood handle, soft lilac-cream bristles, a small star charm, no glow baked in: the glow is
    CSS drop-shadow so the key stays clean), a small soft cloud puff with two tiny stars (used for the poof, white on
    green). Keyed with tools/art/keyflood.py, saved as WebP in assets/room/dream/ (tidy-sock.webp ...). Sprite canvases
    are trimmed to the object so the width in percent is the object's width.
    
    ### 5. Tests
    Core (node vm): the model (nothing on the first call; one item 150 min later; two a day at most; three at once at most;
    kinds never repeat on the floor; tidy removes and resets the gap; a clock set back spawns nothing; a new day resets the
    count; state round-trips through JSON), spots per layout as above, the broom route (through two items and the spots)
    stays on free cells leg by leg, the practice contract (tidy exists, pose null, 2 variations, totals between 120 and
    200 s, no em dash, no "should", every step under 30 words), source seams (room.js emits practiceEnd at both ends,
    runPractice skips setPose without a pose, sprites() ranks '#tidyLayer .tidy' as non-solid, room.html loads ovu-tidy.js
    after ovu-petwalk.js, GAME_KEYS has 'tidy').
    Browser (Playwright smoke, its own context seeded with two items dated an hour ago): the items render inside the floor
    polygon with the ground shadow and no downward filter offset; their rendered heights are below hers and the broom's
    is 50 to 70% of hers; tapping a sock opens Everyday mindfulness with Tidy up selected; Begin starts the practice
    (HUD title, practiceOn), the broom appears, under OvuTidy.fast(true) (8x speed, test only) both items are gone from the
    DOM and the state within 15 s, a poof was seen (MutationObserver), the broom and every spark are gone after the sweep;
    Stop before a minute: "Nothing under a minute is recorded", hearts unchanged, broom gone, unswept items (a third item
    seeded far away) still there; stopEverything mid-sweep leaves no .broom/.spark/.poof; a context with
    reduced_motion='reduce' shows no .spark and still clears the items; a clock-installed context runs the practice past
    60 s, Stop then Yes saves one mindfulness entry (activity 'tidy') and +2 hearts.
    
    ## Questions I want your view on
    Q1. Jamie's note says "she watches from where she stands (or holds the broom handle for the first second, then lets go)".
        Holding the handle needs a per-outfit pose sprite (10 outfits) or a broom drawn over her hand; I plan "she stands
        and watches" with no new pose, and a small joy hop when the broom dissolves. Agree, or is there a cheap honest way
        to show her letting go?
    Q2. state.tidy in ovu-gamesave.js GAME_KEYS (account copy wins, like pets)? I plan yes, one word in the array.
    Q3. The sweep is a picture tied to a real-world practice. Is committing each item's removal as the broom passes right,
        or should the floor only clear when she confirms "Yes, I did it"? I prefer as-it-passes (no punishment, no undo).
    Q4. Any hole in the end conditions (practiceEnd, activity, layout, clear/import, sleep, hidden)? In particular: Stop
        opens the "Stopping early" sheet while practice is still set; the sweep continues behind the sheet until Yes/No
        (practiceEnd). Fine, or end at the sheet?
    Q5. Spot selection by geometry: distance thresholds (6 from stand points, 8 from the plate edge, 3 spots) reasonable
        for the room's floor polygon (a diamond [50,51] [95,67.5] [50,90] [5,67.5] minus the bed, desk, wardrobe, table)?
    Q6. Copy: two interim scripts in Erin's voice style. Flag anything that reads like a chore order or a judgement.
    
    Script A "One thing at a time":
    1. Stand in the doorway, or wherever you are, and look at the room as it is. Nothing to fix yet. Just notice. (20 s)
    2. Pick one thing that is out of place. Pick it up slowly and feel its weight and texture in your hand. (30 s)
    3. Carry it to where it lives. Notice the walk, however short, and the small sound of setting it down. (35 s)
    4. Choose another. The mind may start listing everything else. Let the list be, and come back to this one thing. (40 s)
    5. When you are ready, stop, even if the room is not finished. Look at the patch you cleared and take one slow breath. (25 s)
    Script B "Clearing the floor":
    1. Before you touch anything, notice your feet on the floor and let your shoulders settle. (20 s)
    2. Start with the floor. Lift one item and feel how the space under it opens. (30 s)
    3. Put it away with a little more care than usual, as if the shelf were glad to have it back. (30 s)
    4. Carry on at this pace: one thing, one breath, one place. If you speed up, that is fine. Notice it, and slow once more. (45 s)
    5. Stand back. The room is a little clearer, and so is the next few minutes. (20 s)
