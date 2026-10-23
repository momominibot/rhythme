# Tidy up your room, with a magical broom (23 Oct 2026)

Jamie, 22 Oct: "tidy up your room can have a magical broom animation". Built as a new everyday mindful practice
(ovu-mindful.js `tidy`) with its own module, ovu-tidy.js. Codex design review before building:
docs/design/reviews/2026-10-23-codex-tidy-design.md (HOLD with ten findings, all applied; listed below).

## What she sees
- A little clutter appears in her home over the day: a pair of socks, a mug on its side, a tumbled stack of books, a
  cushion askew (generated clay-style sprites, assets/room/dream/tidy-*.webp, one guarded run,
  tools/art/jobs/2026-10-23-tidy-up.json, keyed with keyflood.py with the dark-green shadow rule on). Two new things a
  day at most, three on the floor at once, the first one 150 minutes after the day's first visit. Nothing nags: no
  toast, badge or count. They lie on open floor chosen from the plate's geometry, with the same ground contact shadow
  as her, and they are ranked in depth with her and the pets.
- Tapping a thing, or the practice on the Everyday mindfulness list, starts "Tidy up your room": a written guide on the
  bar (no clips yet; the card and the journal entry say so), two interim scripts in Erin's style, about two and a half
  minutes, with Stop, the honest save question, the flat practice thank-you and the one-activity rule exactly as every
  other practice. She stands and watches in her own clothes (no pose). Nothing under a full minute of real time is saved.
- While she tidies for real, a magical broom appears beside her with a burst of sparkles, sweeps itself along a route the
  walk engine plans (nearest thing first, then the empty spots as a once-over, then a rest by the door), pausing at each
  thing with a quicker sway; the thing vanishes in a small puff with a swish, a sparkle trail follows the broom, and at
  the end the broom dissolves. Reduced motion: the broom appears at each thing in turn, the thing fades, no trail, no puff.

## Model (pure, tools/test-core.js block "tidy up")
state.tidy = { items: [{ id, kind, at, slot }], last, day: { d, n }, tidiedAt, n }. `advance(saved, t)` is forward-only: a
clock set back spawns nothing and never reopens a day; a later day is anchored at its first visit (no backfill after
an absence); kinds never repeat on the floor; slots 0..2 are independent of kinds and persisted; the rotation counter is
persisted. `remove(saved, ids, t)` clamps t to the anchor. `tidy` joined ovu-gamesave.js GAME_KEYS (account copy wins).

## Spots and the route
`spots(L, K)`: from the rasterised floor, cells with 3 iso units of clear floor all round, 6 or more from her home spot,
every stand point, door and stair, 7 from every hotspot pin, with no painted piece starting just below them; houses use
the ground-floor polygon only and never the staircase strip; three picked by clearance plus spread, 10 apart.
`placeItems` re-validates against the placed furniture at draw time (nearest free cell, deterministic). `route` plans
leg by leg with OvuWalk.plan; a leg ending more than REACH (2.5 units) from its thing leaves it (her feet and a pet are
solids in the broom's world). Composite checks on all four plates were done in the scratchpad during the build.

Known limit, a follow-up for the walk polygons: the three house plates paint a hedge along the front of the ground floor
inside the walk polygon (she can walk there too), so a thing on the front strip can sit on the hedge's top edge. A
front margin in the picker was tried (8 to 14 iso units) and left the bath house with one spot; tightening the houses'
front edge in ovu-walk.js HOMES fixes both her walks and the clutter.

## Lifecycle (DOM)
Start: the room's `activity` event for the tidy practice. End, one idempotent `end()` with a run token: room.js's new
`practiceStop` event (emitted the moment a runner is cancelled, at both ends, so never behind the save question), any
other `activity`, `layout`, store `clear`/`import`, sleep, and a replaced floor (an account copy or another tab
removing a thing the sweep still expects). A hidden page pauses everything through the frame clamp (every phase,
dwell included, counts frame time only). Each removal is written first (a copy, through the farm lock the game save
shares, the store re-read inside it) and only then puffed; a failed write keeps the thing.

## Review findings applied
P1 stop before the save question (practiceStop); P1 60 active seconds at the save boundary (minSecs on the activity,
honoured by end() and the natural finish); P2 slot separate from kind; P2 ground floor only, live furniture, fewer
spots allowed; P2 brush reach and segment checks; P2 GAME_KEYS plus lock, re-read, replaced-copy cancel, failed-write
keep; P2 pose null handled in cards, runPractice and redress; P2 day re-anchoring; P2 text-only guide wording;
P3 duration by route, broom fitted by measured height, stationary wrapper, opacity-only entrance, behavioural checks.
Q1 she stands and watches; Q2 yes; Q3 commit as the broom passes, after persistence; Q4 end at the stopping sheet;
Q6 the five copy edits.
