# Greenhouse herbs: four planters, starts from the grocer, a cup of tea (design, 21 Oct 2026)

Step 4 of `2026-10-19-farm-loop.md` (section 2's herbs table, sections 3, 5.2, 6 and 7). Built on the Harbour Lane
branch (`claude/wizardly-galileo-0qg6f8`), where Hay & Harvest sells the farm's seeds.

## What is built

- **Four small planters** in the greenhouse (`ovu-greenhouse.js`, `HERB_BEDS`), read off `greenhouse-v1.webp` on a 5%
  grid: the tiled floor ends level at about y 72.5 between the two steps down, so two planters stand each side of the
  doormat (x 39, 44, 55, 60) and the way in stays clear (x 46.3 to 52.7). Each is a layout solid. The left pair is
  tended from behind; the right pair from their sides, because the chairs and the tea table come down to y 69.5.
  `OvuWalk.checkLayout` is clean, and the planner reaches every stand point from home and from the door, with every
  pot and planter drawn as a prop; every plant and the tea table stay reachable (`tools/test-core.js` 2k8).
- **Starts at Hay & Harvest** (`ovu-lane.js`, "For the greenhouse"): a piece of ginger root 6 hearts, a lemongrass
  stalk 4, a pandan cutting 4, a pinch of chamomile seed 5 (the design's prices). One start plants one planter.
  `OvuGreenhouse.buyStart` pays through `OvuRewards.spend(cost, what, { greenhouse })`, one save.
- **Growing**: tap a planter, she walks over and its sheet opens. Plant, water and pick are slow care steps
  (`OvuCare.step`, Stop changes nothing) that cost the farm's energy (2, 6, 4), charged in the same save. Growth
  counts the real days a planter was watered (the farm's game day); a missed day adds nothing and takes nothing away;
  once a day; a clock set back counts nothing; a ripe planter needs no water.

| Herb | Start | First harvest | Again after | Basket |
|---|---|---|---|---|
| Ginger | 6 ♥ | 6 watered days | 3 | 2 pieces |
| Lemongrass | 4 ♥ | 4 | 2 | 3 stalks |
| Pandan | 4 ♥ | 4 | 2 | 3 leaves |
| Chamomile | 5 ♥ | 4 | 2 | 2 handfuls |

- **The harvest goes into the farm's basket** (`state.farm.harvest`, same keys as crops; the basket sheet now names
  herbs too). The herb stays and grows again from young on its regrow cadence. "Let this planter go" empties it, free.
- **Brewing**: from a planter ("Brew a cup") or the tea table (a "Brew from your harvest" row above the unchanged tea
  list). A one-minute tea practice on the HUD, four lines a quarter-minute apart (pour, warmth, steam, the first sip),
  in her own outfit with the cup pose, Stop at any time. A finished cup uses one from the basket and calls
  `OvuRewards.thank`, a new function that runs the same `practicePoints` as every practice: the flat 2-heart
  thank-you within the 6-a-day cap, nothing on a capped day or with the clock set back. Stopped: nothing used, nothing
  earned. **No diary entry is written.** Ginger and chamomile link to their existing research cards (the greenhouse
  plant card, wording unchanged); lemongrass and pandan have no card, and their cup says so and claims nothing.
- **Mindful lines** (`ovu-moments.js`): `herbplant` (tend pose), `herbwater` (plants), `herbharvest` (harvest),
  `brew` (coffee). All within 18 words, no em dashes, no pressure words; every pose is drawn for every outfit.
- `sw.js` `ovumind-2026-10-21o`.

## Rules held by the tests (2k8, 57 checks; smoke blocks in the greenhouse and Harbour Lane sections)

Prices and days per herb; each ripens on its day and not before, and again after its regrow days; once a day; missed
days; clock back; the harvest lands in the basket beside what was there; only the start costs hearts; a cup pays
exactly the practice thank-you and respects the daily cap and the clock watermark; no `S.add`, `.award` or `.grant`
in the herb code; a failed save (S.commit stubbed to throw) sells, plants, waters, picks, clears and brews nothing and
takes no hearts or energy; too tired changes nothing; restored values are cleaned; the free start is given once,
never again with the clock set back or a malformed restore, and a failed save leaves it open; the swap takes three
of a herb or a crop for a seed or a start, refuses what she cannot grow, and a failed save moves nothing.

## Decisions

1. **Lemongrass moves to the greenhouse.** It is a herb in the design's own table, and the farm's 60-heart unlock for a
   4-heart herb made no sense next to it. Existing players keep everything: a farm that unlocked it still grows it,
   keeps its seeds and beds, and can still buy packs; its harvest and greenhouse lemongrass share one basket key, so
   nothing is lost or counted twice. New farms are no longer offered the unlock (`CROPS.lemongrass.moved`), and
   `unlockCrop` refuses it with a pointer to the greenhouse. The change to `ovu-farm.js` is four small lines (the flag,
   the refusal, the basket naming herbs), to keep merges with the farm-kitchen branch easy.
2. **Herbs are perennial**: they regrow for as long as she keeps them. No ripe window, no gone-to-seed, no weeds
   under glass. Nothing rots.
3. **Brewing earns the practice thank-you without a diary entry**, as asked. That needed `OvuRewards.thank(what,
   patch)`; it adds no new rule, only a second door into `practicePoints`.
4. **The herb uses the basket, not a separate store**, so the kitchen branch can read `farm.harvest.ginger` and
   `farm.harvest.pandan` for sweet potato ginger soup and pandan rice.
5. **Herbs count at the seed swap** (Jamie, 21 Oct). Three of a herb or a crop from the basket (a pumpkin counts as
   three) buys one seed of a crop she grows or one start of any herb. No hearts change hands, and the basket, the shed
   and the greenhouse move in one save (`OvuGreenhouse.swapAny`). Lemongrass is taken as a greenhouse start.
6. **The first herb start is free, once** (Jamie, 21 Oct), any herb she chooses, so a first cup never needs hearts.
   The claim is kept in the greenhouse state as a mark, not a date, so a clock set back cannot reopen it, and a
   restored mark with a malformed value still counts as claimed (`OvuGreenhouse.freeStart`).
7. Independent review (21 Oct) fixes: a full bag is not sold a start and a full basket is not picked into, the
   morning routine says "Finish the cup first" during a brew, the tea-table row is added only to the tea list, the cup
   sheet's line is within 18 words, and the smoke check waits for the cup to finish instead of a fixed time.

## Art needed (placeholder SVG now)

- Herb sprites per stage (sprout, young, ripe) for ginger, lemongrass, pandan and chamomile, keyed, in the
  greenhouse sprite style; and a planter box prop to match the bench's wood.
- A teapot-and-cup brewing pose would read better than the coffee pose, in every outfit.

## Jamie's answers (21 Oct)

1. Lemongrass stays in the greenhouse, with the migration for farms that already unlocked it.
2. No research cards for lemongrass and pandan; their cups claim nothing.
3. Harvest sizes 2, 3, 3, 2 stand.
4. Herbs count at the seed swap (built, decision 5).
5. A cup stays a separate flat practice thank-you inside the shared cap, not the morning coffee slot.
6. One free first start for every player (built, decision 6).

A Codex review of this diff is pending (Codex unavailable here; no other model stood in).
