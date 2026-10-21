# Harbour Lane: a boutique, a gym, a fish shop, a grocer and a post box

Jamie, 21 Oct 2026: "is my fashion store n gym fish store, grocer ready? My post mail too", then "can you build what is
not build within next few hours". Built the same day in `ovu-lane.js` on the integration branch.

## Where it is

A short cobbled lane on its own floating island (`assets/room/dream/lane-v1.webp`, 1024 x 1280, one guarded Seedream
5.0 pro run, seed 33), reached from the harbour's round signpost by the hut (`lanesign`, pushed into the harbour layout
the way the crystals are pushed into the cave). The path off the bottom edge leads back down. The map shows it beside
the harbour (`map-lane.webp`, keyed from green). Shops are sheets in the room, like the barn's; there are no interiors.

| Place | Hotspot | What it does |
|---|---|---|
| Lilac Thread, the boutique | `boutique` | Every look she already owns, to try on (`OvuRoom.setOutfit`). Nothing is sold and nothing is priced. |
| Mint Studio, the gym | `gym` | How often movement was logged this week (no targets), Log movement (the room's movement sheet) and a gentle stretch read in Erin's voice (the everyday stretch practice). Recovery from a birth, an operation or an injury goes at the care team's pace. |
| The Blue Fin, the fish shop | `fishshop` | An aquarium window of the six harbour species: the ones she has met swim there, the rest are "Not met yet". Salmon for the table from the food ideas, with its Ovuluna picture. Links to the catch book and the food diary. |
| Hay & Harvest, the grocer | `grocer` | The foods for her part of the cycle (with pictures), and a shelf of all nineteen foods drawn for Ovuluna. Tapping a food says how to log it in the food diary. "Food ideas, not a diet or a treatment." |
| The post box | `postbox` | Letters that arrive when something happens in her world: the lane's welcome and what is new (from the start), a first fish met, a full basket, a treat for Clover, the hidden spring, movement logged. A small flag counts unread letters. Reading is all there is to do: no hearts, no streaks, nothing to answer. |
| The bench | `lanebench` | Between errands, about two and a half minutes in Erin's cloned voice (Rhythme's words, with her permission; six clips in one guarded voice run), or just sitting, with falling blossom (`#seatfx .blossom`), still under reduced motion. One thank-you a day for this seat, inside the shared practice cap. |
| The grocer's cat | `lanecat` | Asleep on a crate. "Let her be." |

## Rules kept

- The shops, the post box and the cat cost nothing, pay nothing, spend no energy and write nothing to the diary
  (`tools/test-core.js` 2k10 greps the module).
- Three things on the lane are the app's own features and keep the app's shared rules, not lane rules. The bench's
  Between errands and the gym's gentle stretch save to the journal only when she confirms she did them, with the small
  practice thank-you inside the shared daily cap. Log movement opens the room's own movement sheet, the same deliberate
  logging as anywhere else: hearts once a day for logging, and its own note on which minutes count toward the WHO's
  range. The gym's panel itself shows only how often movement was logged this week. (The Codex lane review of 21 Oct
  read the earlier wording, "nothing on the lane pays hearts", as a rule these broke; the wording was wrong, not the
  behaviour.)
- Letters keep their own small state (`state.mail.read`, `state.mail.arrived`) and promise nothing. A letter that has
  arrived stays, even if the moment that sent it is later undone (deleting the movement entry keeps the studio letter).
- No prices were invented: the boutique shows owned looks only.

## Checks

`tools/test-core.js` 2k10: the lane's home, stand points and door on the floor and outside every solid; every shop, the
post box, the bench and the cat reachable from the path; the harbour signpost and its door on the harbour floor and
reachable; letters and their moments; unread counts with broken state; no promises in the letters; no economy in the
module; every food picture, the plate and the map icon on disk. `tools/e2e_smoke.py`: up from the signpost, the flag
counting arrived letters, each shop's sheet, a letter read on paper and the flag going down, the bench offering Between
errands with its blossom, no hearts or diary entries from the visit, and the way back down.

## Not built

Hours for the lane's shops (they are always open, unlike Dream Street), buying outfits, a café, and interiors.
