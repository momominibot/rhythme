# The farm kitchen: staples, recipes and cooking as a practice (design note, 21 Oct 2026)

Step 3 of `2026-10-19-farm-loop.md` (sections 1, 5, 6 and 7). Built on Harbour Lane (`2026-10-21-harbour-lane.md`,
branch `claude/wizardly-galileo-0qg6f8`), whose grocer Hay & Harvest now has a staples shelf. Code: `ovu-kitchen.js`.

## What is built

- **Kitchen staples at Hay & Harvest** (8 am to 8 pm, the grocer's hours): rice 2, eggs 3, noodles 2, tofu 3, garlic 2,
  coconut milk 3, honey 4, yoghurt 3 hearts. One tap buys one portion, enough for one dish. Bought through
  `OvuRewards.spend(cost, 'staple:<id>', { farm })`, so the hearts and the staple land in one save.
- **Where staples live:** `state.farm.kitchen` (`{ rice, noodles, tofu, garlic, coconut, honey, yoghurt }`, whole numbers,
  at most 99, cleaned on every read). **Eggs are the barn's pantry eggs** (`state.farm.pantry.egg`): an egg bought at
  the grocer joins the hens' eggs, and a dish takes from the same count. No second egg count. The farm's own
  `farmState` already keeps fields it does not know, so the shed, the well, the swap and the barn leave the kitchen alone
  (tested).
- **Ten recipes**, vegetables, herbs and staples only, no fish:

| Dish | Needs | Status |
|---|---|---|
| Garlic pak choy | 2 pak choy, garlic | cookable (the design's "bok choy" is the farm's pak choy) |
| Kangkong stir-fry | 2 kangkong, garlic | cookable |
| Tomato and egg | 2 tomatoes, an egg, rice | cookable |
| Pumpkin soup | a pumpkin, coconut milk | cookable |
| Carrot and radish salad | a carrot, a radish, honey | cookable |
| Strawberry yoghurt bowl | 2 strawberries, yoghurt, honey | cookable |
| Pak choy noodle soup | pak choy, noodles, garlic | cookable, **added** (gives the noodles a use) |
| Tomato tofu with rice | 2 tomatoes, tofu, rice | cookable, **added** (gives the tofu a use) |
| Sweet potato ginger soup | a sweet potato, ginger | listed, "Arrives with the greenhouse herbs" |
| Pandan rice | pandan, rice | listed, "Arrives with the greenhouse herbs" |

- **Cooking is a guided practice** of four care steps (`ovu-care.js`, the same step the farm, barn and spring use): Wash,
  Chop, Smell, Taste, about 15 seconds each. Each step shows its mindful line (dish-neutral, so a cold salad never reads "warm pan"), her pose, a soft bar and **Stop**. Stop at
  any step goes back to the recipe and uses nothing; closing the sheet, sleep, or leaving the scene drops the step the same
  way.
- **The end:** after Taste, the ingredients are taken in **one save** (`S.commit({ farm })`; a failed save changes nothing)
  and the dish sheet shows the dish, its mindful line and **"Did you eat something like this today?"**
  - **Yes, open the diary** opens the food diary (`OvuRoom.openDiary('add', { notes, tags })`) with "Tomato and egg, cooked at home" in the
    notes and the Home-cooked tag on. Nothing is saved until she taps Save meal.
  - **No** closes the sheet. Nothing opens, nothing is saved.
- **Where she cooks:** the farm's basket sheet ("Cook a dish") and the family home's stove (new hotspot `stove` at 27, 68
  on `house-family-v1.webp`, where the plate draws a hob and kettle beside the fridge; stand point 28, 85). The bedroom,
  the dream house and the bath house draw no counter, so they get no hotspot.
- **Mindful lines** (`ovu-moments.js`): `cookwash`, `cookchop`, `cooksmell`, `cooktaste`, `cookdish`. Poses reuse sprites
  in every outfit: `dishes` (wash, chop), `coffee` (smell, a bowl lifted to her face), `eat` (taste, the dish).

## Rules (tested in `tools/test-core.js` 2k8 and the smoke kitchen block)

- Cooking earns no hearts, costs no energy, and never writes a diary entry. Only a staple costs hearts, through
  `OvuRewards.spend` in one save. The lane's own code still spends hearts only on a float.
- A dish takes exactly its ingredients in one save; a crop used up leaves the basket; a dish cannot be made twice from
  one set; a failed save (S.commit throwing) sells nothing, cooks nothing and takes no hearts.
- Herb dishes cannot be cooked until the herbs exist. No recipe names fish.
- A full shelf (99) charges nothing.

## Decisions

- **No energy for cooking.** The design lists energy for planting, watering, weeding and harvest, and puts cooking with tea
  as a practice. A tired evening should still allow a slow minute at the stove.
- **No hearts for the practice minutes.** The design said the minutes count as mindfulness under the flat rule; this build
  follows the stricter brief (cooking earns nothing and writes nothing). Easy to revisit: it would mean saving a
  mindfulness entry, which only her own save may do.
- **No diary source.** `OvuStore.add` accepts a source, but the diary's own Save passes none (`room`), and the brief said
  to add nothing if the existing food save does not already carry one. So the entry she saves after Yes is an ordinary
  diary entry. Recording `game_prompt_confirmed` would mean the diary remembering it was opened from the kitchen; left
  for Jamie.
- **Cooking while visiting the family home** (before she owns it) is allowed, as the diary and fridge there already are: the ingredients are hers either way.
- **One portion per purchase**, one egg per egg purchase. Simple to read on a phone; prices sit in the design's 2 to 4.
- **Ingredients changed between Begin and Taste** (another tab, a sync): the dish is refused at the end and nothing is
  taken.
- `ovu-farm.js` changed by two lines only (the basket's Cook a dish button), to keep the parallel greenhouse-herbs branch
  merging cleanly.

## Art needed (none generated in this build)

- A **kitchen counter or hob** for the dream house and the bath house, if Jamie wants cooking there (and a hotspot then).
- A **chopping** pose (she reuses the dish-washing pose for Chop) and a **stirring at the hob** pose.
- **Dish icons** for the ten dishes (the sheet uses Material icons today) and small staple packs for the grocer shelf.
- The farm-loop design's harvest and dish pictures still stand.

## Open questions for Jamie

1. Fish: still out. When the fish question is settled, a fish soup or steamed fish could join the list.
2. The two added dishes (pak choy noodle soup, tomato tofu with rice): keep, rename or drop? Without them noodles and tofu
   have no use.
3. Should the diary entry carry `source: 'game_prompt_confirmed'` (design section 5)? It needs a small change to the
   diary's Save.
4. Should the cooking minutes count as a mindfulness practice (2 hearts under the flat rule), or stay free of hearts?
5. Milk from Clover has no recipe yet (a milk pudding or teh?), and onsen eggs could count as eggs for tomato and egg.
6. Cooking in the dream house and the bath house needs counter art first.
7. A Codex review of this branch is pending (Codex is not available in this session; no other model stood in).
