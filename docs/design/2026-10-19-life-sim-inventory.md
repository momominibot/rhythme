# Life-sim expansion: architecture inventory and build order (19 October 2026)

Jamie: "Build prompt: CLAUDE_GAME_PLAN_PROMPT.md review this carefully and build." The prompt (kept outside the repo at
`../CLAUDE_GAME_PLAN_PROMPT.md`) asks for an architecture inventory before any game code, consent and age gate first,
then world, farm, stamina, NPCs, fishing and foraging, then server agents, dashboard and data capture, on a feature
branch with pull requests, never pushed to main directly. This page is that inventory, the review of the prompt against
the code as it is, and the order of work.

## 1. What exists (read, not assumed)

| System | File | What it does today | Verdict |
|---|---|---|---|
| Zones | `room.js` `LAYOUTS` (room, house, bathhouse, familyhome, sheets), `ovu-garden.js` GARDEN, `ovu-street.js` STREET, `ovu-shops.js` three stores, `ovu-community.js` PLAZA | One page, one `#scene`; each zone is an illustrated plate (1472x1840 or house sizes) with `hotspots`, `zones` (floor polygons), `solids`, `doors`, stand points; `OvuWalk.travel(id)` crossfades plates with no reload | **Extend.** This is already "connected zones, no page reloads". New zones (farm, beach, forest) register the same way; a `ovu-zones.js` registry can collect them. |
| Movement | `ovu-walk.js` (528 lines): raster A* over the floor mask (2% by 1% cells), string pulling, walk cycle strips, door triggers, `routeTo` for hotspot walks, `travel`, `livePos`, depth sort | Tap-to-walk (Jamie removed the joystick on 19 Oct: "the toggle to walk the avatar doesn't work very well, we click on the floor to move"); keys on desktop | **Keep as the one movement system.** The prompt wants a joystick plus tap; Jamie's own instruction was tap. Keep tap primary; a virtual stick only if Jamie reverses that. |
| Camera | `ovu-camera.js` (143 lines): follow with per-layout zoom, dead zone, smoothing, gesture hold, UI lifted out of the plate | | **Keep as the one camera.** Clamp to bounds already. |
| Avatar poses | `room.js` `setPose`/`restorePose`, walk strips per outfit (3 directions, mirrored), seated (`avatar-sit-*`), cross-legged, sleeping, nine practice poses | | 4-direction walk is 3 strips plus mirror: meets "4 directions minimum". |
| Pets / NPC-like movement | `ovu-petwalk.js` (wander, route home, sleep), `ovu-pets.js` (care, mood, treats) | | **Extend for NPCs**: the wander engine already plans trips on the floor mask; an NPC needs a schedule (where at what game hour) and dialogue, not a new mover. |
| Economy | `ovu-rewards.js` (parent's file): hearts ledger with receipts by entry id, RULES per entry type, shop, slots, care caps | Client-side ledger in the store | The prompt's "server-authoritative hearts with operation ids" is a Phase 4 change to the parent's file and the sync; not touched here. |
| Store | `ovu-store.js`: localStorage event log, `TYPES` (sleep, period, symptom, food, reflection, mindfulness, weight), `profile`, `state`, `subscribe`, sandbox, export/import, AES share | | **Extend**: game state lives in `state` (as pets and rewards already do); high-volume game events need their own log (`game_events`), Phase 4. |
| Sync | `ovu-sync.js`: last-write-wins per entry id with tombstones, incremental pull, cloud consent gate | | Phase 4's operation-id log is a second queue beside it. |
| Night and sleep | `room.js` `isNight`/`asleep`, `OvuSky`, bedtime enforcement; pets sleep at night | Game rest is the real sleep log (tapping the bed logs sleep and puts her to bed) | The prompt separates game rest from real sleep logging; today they are one tap. Decision for Jamie (section 4). |
| Agents | `ovu-agents.js` on the phone; `supabase/functions/insight` for model prose; staff schema `staff.*` with `metrics_build` under per-account consent (19 Oct) | | Phase 2 builds on the staff schema; the prompt's split (utility vs retention) is stricter than phase 1 and is adopted. |
| Dashboard | `admin.html/css/js` (phone-first, vanilla, audited RPCs, no diary reads without opt-in, floor 20) | | The prompt wants `admin/` with ECharts, dark, desktop-first, break-glass with two people, MFA. Keep what exists (it already meets "no blanket read access"); add the rest in Phase 3. |
| Consent | `room.html` `#consent` + `room.js` `CONSENT_V = 2` (parent's); notice v3 and the "help improve logging" switch on the parent's branch `claude/notice-v3-improve`; `public.analysis_consent` on the project | | The prompt replaces this with granular toggles, consent events, an 18+ gate. Parent's files: see section 3. |
| Voice | Volcengine TTS cloned voice, clips shipped as files; `tts_proxy.py` for dynamic speech | | Static clips only in the app; no runtime TTS. |

## 2. Where the prompt and the code disagree (checked against the files)

1. **"Scene-per-page" is not the current state.** `room.html` is one canvas; plates crossfade through `OvuWalk.travel`; the camera follows. Phase 1's engine goal is largely met; what is missing is listed in section 5.
2. **"Help make Rhythme better pre-ticked at room.js:1539" is wrong.** That checkbox renders checked only when the saved consent already says `improve === true`; the first-run notice has it unticked (the smoke suite asserts "every optional choice unticked").
3. **Age bands.** `room.js` offers under13, 13-16, 17 and adult bands, stores `age13: true`, has `isMinor()` and a teen cycle cutoff; ten references in `room.js`, more in the onboarding copy. The prompt's 18+ decision removes all of that. Parent's file.
4. **Movement input.** The prompt wants a joystick plus tap; Jamie removed the joystick. Tap stays unless he says otherwise.
5. **AI processing location.** Luna and the insight function send de-identified notes and aggregates to Volcengine Ark (China). The prompt forbids health data to China-region endpoints. Changing the provider is Jamie's decision (cost, quality, Vault key); until then the existing disclosure stands and nothing new goes to Ark from health data.
6. **Supabase region.** The project is ap-southeast-1 (Singapore); the cloud notice says "hosted outside Singapore". One of them is wrong; the three sentences should say where it is.
7. **`dreamina-canvas` CLI.** Not installed; art is made with `tools/art/gen.py` (Seedream through Ark, `--url` transport).
8. **Hearts for mindfulness is 0 in RULES** while the prompt expects hearts for game actions; the economy note (19 Oct) already holds the rules table for Jamie.
9. **Under-16 safeguarding sections in the parent's notes** become void under 18+; the improvement opt-in already requires an adult band and will key off `ageAttest` instead.

## 3. Division of work (two sessions, one repo)

- **Parent session (owner of `room.js`, `room.html`, `ovu-auth.js`, `ovu-rewards.js`, consent and onboarding):** the 18+ age gate (`ageAttest`), the granular consent (`ovu-consent.js`, `consent_events`), removal of the teen logic, the cloud notice sentences, server-side consent checks in the existing functions. Its notice-v3 branch is superseded by this; the "help improve logging" switch it built carries over as one of the toggles.
- **This session:** the game engine and content on a feature branch (`claude/life-sim`), pull requests only; the staff and agent server pieces (Phase 2 and 3) after the consent events exist; Phase 4's game event log.
- **Shared contract:** game features that would create wellness entries ask first and record `source: 'game_prompt_confirmed'`; nothing a game does writes a health entry on its own.

## 4. Decisions only Jamie can make (asked in the report)

1. 18+ only: confirms the age gate and removal of the teen flows (the prompt says so; the app today is 13+ with guardian notes).
2. Joystick back, or tap-to-walk only (your 19 Oct instruction).
3. AI provider for health text: keep Ark with disclosure for non-health only, or move to a region-pinned provider with zero retention (Luna's notes are health text).
4. Game rest versus real sleep: keep one tap (bed logs sleep and she sleeps) or split them as the prompt says.
5. Hearts for game actions and the rules in the economy note.
6. The dashboard's second admin person for break-glass (the feature stays off until a second named person exists).
7. One clock or two: keep everything on real time (built), or add the prompt's fast game clock for NPC schedules and lighting while crops and stores stay on real days.
8. Hair colour: render the presets (the recolour test lost; see the avatar-looks note) and which palette.

## 4a. Jamie's answers (19 October, afternoon)

1. **18+ only.** Confirmed. The parent session builds the age gate and removes the teen flows.
2. **Tap to walk.** Confirmed; no joystick.
3. **AI provider for health text.** Keep the current one, unless the Codex subscription can be used instead. Checked
   the same day on OpenAI's developer pages: Jamie's own Codex sign-in covers the Codex tool, not an app; a ChatGPT
   subscription cannot be shared with an app's users through it. OpenAI does run a separate "Sign in with ChatGPT"
   programme where an app's users bring their own ChatGPT plan for model calls (Responses API with `store: false`, a
   usage-limit error when the person's plan runs out). It is "currently offered to a select group of commercial
   partners" with a waitlist form, eligible plans are not stated, and it says nothing about training, retention or
   health data. So: the current provider stays with its disclosure; the waitlist is worth a form if Jamie wants the
   option; it would only ever cover people who hold a ChatGPT plan. Sources: developers.openai.com/siwc,
   /siwc/website, /siwc/request-client-id, /siwc/token-sharing-open-source/models-and-inference and
   /siwc/token-sharing-open-source/preview-limitations (read 19 October 2026).
4. **Real sleep stops the game.** When a sleep is logged, nothing in the game runs: no walking, no journey, no farm, no
   prompt, until the bed wakes her. Built on this branch (tap-walks and the farm answer with the room's own line,
   "She is asleep. Tap the bed to wake her first."); the room's sheets while asleep are the parent's file.
5. **Hearts only for logging.** Game actions earn nothing (the farm awards none). Mindfulness earns a small amount. The
   rules live in the parent's `ovu-rewards.js` (today an everyday practice pays 5, +10 the first time, a session up
   to 20); the parent trims mindfulness to a small figure. Recorded in the economy note.
6. **Break-glass second person.** Explained to Jamie; the feature stays off. Nothing to decide until he wants
   emergency reads of one person's diary.
7. **One real clock.** Confirmed; NPC schedules run on it.
8. **Her look.** Hair colour, eye colour, skin colour and four hairstyles, all offered. Plan and render budget in
   `2026-10-19-avatar-looks.md`; spend waits on Jamie's go.

## 6. Built in the first pull request (19 October, branch `claude/life-sim`)

| Piece | File | Verified by |
|---|---|---|
| Calendar | `ovu-gametime.js` | core: day key, seasons, hour label, day count, first-day stamp, new-day watchers |
| Energy | `ovu-stamina.js` (100 max, low under 25, costs plant 2, water 6, harvest 4, clear 5, fish 3, forage 2, travel 1; refills on sleep and a new day; slow walk and a faded scene when low) | core: spend, low, refill; smoke: low energy slows her and fades the scene, sleep refills |
| HUD | `ovu-hud.js` (day, season, hour, energy bar; zone name for two seconds on arrival; hidden under any activity HUD) | smoke: pill present, hidden during a session |
| Prompts | `ovu-interact.js` (nearest hotspot or layout prompt within reach: a pill and one action button; off while walking, sitting, travelling, in a sheet or an activity) | core: nearest, verb; smoke: the bed prompt appears, the button opens the bedtime sheet |
| Zones | `ovu-zones.js` (register a layout; a mini-map stop appears after a named one) | smoke: mini-map stops read home, garden, farm, street, plaza |
| Farm | `ovu-farm.js`, plate `assets/room/dream/farm-v1.webp`, garden path and gate | core: 12 beds and stand points on the floor, every bed reachable from the gate, three seeds a day, weeds deterministic per day and bed, planting, watering once a real day, ripe after the crop's watered days, harvest writes no diary entry; smoke: the path leads there, beds draw, a bed is planted and watered through its sheet, a harvest asks before any meal is logged |
| Walk engine | `ovu-walk.js` speed scale; routed walks consume time at the speed actually walked | Codex instrumented `followRoute` at scale 0.72 and 0.4: distance per 0.1 s matches 26 × scale × dt with no stall (the core suite does not drive `followRoute`) |

Codex read-only review of this slice (gpt-6-astra, 19 October), all required and should items applied before the pull request:
farm sheets now read the date at the tap, not at opening, and a sheet left open over midnight redraws for the new day;
a refused action costs no energy (energy is checked before the rule runs and charged only on a yes); the shed remembers
the dates it gave seeds on, so a clock set back gives nothing twice; watering dated before the planting or before the
last watering is refused; energy refills only on a later date; the day count never shows 0; the tree's solid is its trunk,
so the planner reaches the well (the floor check only tested point legality, the suite now plans to every stand point);
beds that share a stand point share one prompt, which opens a picker, so no bed is shadowed by its neighbour; the farm
mini-map stop reads "Farm"; bed buttons and the energy pill carry full accessible names; crop plurals and the farm
hotspot prompts are written out. The planner tool's suggestion to rebuild in a desktop game engine was set aside: the app
is a vanilla-JS web app with its own walk engine.

Rules kept: nothing a game does writes a wellness entry (a harvest offers the food diary, which saves only what she chooses); no vendor or model names in the app; no toggles; her outfit and look never change on their own; the parent session's files were not touched beyond the agreed script tags in `room.html`.

## 5. Build order on the feature branch

1. **Calendar** `ovu-gametime.js`: built on the real clock only. The room's day and night, the stores' hours, the pets' bedtime and Erin's morning and evening scripts all already follow the phone's real time, so the calendar names what the clock is (day count since first play, season of the month, hour) and crops grow by real days. The prompt's faster in-game clock (one game hour every 30 s) would put the stores, the sky and the NPC schedules on a second time; that is decision 7 for Jamie, and this module is where it would live. Tests in the core harness.
2. **HUD** `ovu-hud.js`: clock, day and season, stamina bar, hearts, held item, zone name on entry; lifted out of the plate by the camera's existing list.
3. **Stamina** `ovu-stamina.js`: costs per action, refill on game rest, slower walk and desaturation when low; in `state`.
4. **Interaction layer** `ovu-interact.js`: proximity prompts from the avatar's live position to the nearest hotspot ("Tap to water"), action button on mobile, hotspot taps still work.
5. **Zones registry** `ovu-zones.js` and two new plates (farm, beach) in the existing style, with floor polygons checked by the core suite; edge transitions as doors.
6. **Farm** `ovu-farm.js`: 12 plots, five crops, real-day growth, watering, weeds; harvest asks "Log a meal?" before any entry.
7. **NPCs** `ovu-npc.js`: four with schedules on the game clock, dialogue boxes, friendship hearts; Erin as the garden and plaza NPC with her own clips.
8. **Inventory and toolbar** `ovu-inventory.js`.
9. **Fishing and foraging** `ovu-fish.js`, `ovu-forage.js`.
10. Phase 2 to 4 after the consent events land (parent) and the decisions above.

Each step: core checks, the smoke suite, a Codex read-only review, a pull request.

## 7. The farm loop, Jamie's 19 October brief

Seeds come from a grocer on Dream Street, each crop has its own watered-day table and stages, a ripe bed goes to seed
after three days instead of rotting, and the harvest is cooked, brewed, shared, fed to a pet or swapped for seeds.
Every step carries a mindfulness cue. Full design: `2026-10-19-farm-loop.md`.
