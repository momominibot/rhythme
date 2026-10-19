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

## 5. Build order on the feature branch

1. **Dual clock** `ovu-gametime.js`: game clock (1 in-game hour = 30 s, paused in background, drives shop hours, NPC schedules and lighting on top of the real night rule), real clock (server time from the project when signed in, device otherwise; drives crop growth and daily resets). Tests in the core harness.
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
