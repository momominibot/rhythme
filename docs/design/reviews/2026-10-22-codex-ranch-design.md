**Build one ranch shop, one upgrade per building, and one baby timer per species.** Keep the existing barn, coop, and starter animals.

Read-only review completed; nothing changed. **`ovu-gamesave.js` and `GAME_KEYS` are absent from this checkout**, so account-save safety remains a prerequisite to verify before building.

1. **Place and art**

   Add `farm ↔ ranch`, a small new plate with a shop counter and return path. Buying animals sends them to the existing barn or coop. Register it through `OvuZones.register()`; retain `barn`, `barninside`, and `heninside` IDs.

   Five Seedream 4.0 renders, each 1024×1024:

   - Ranch shop and paddock plate, without animals.
   - Expanded barn interior with four empty stalls.
   - Expanded coop with six nests and an incubator.
   - Calf sprite.
   - Chick sprite.

   Reuse adult sprites, sounds, and the barn exterior. Switch interior plates when upgraded. The documented stopped art run remains held.

2. **State**

   Put everything under **`state.farm.ranch`**, rather than creating another top-level save key:

   ```js
   {
     v: 1,
     lastDay: "2026-10-22",
     nextId: 4,
     barnLevel: 0, // capacity [1, 4]
     coopLevel: 0, // capacity [2, 6]
     herd: [
       {
         id: "clover", kind: "cow", name: "Clover",
         born: null, adultOn: null, // null: existing/bought adult
         love: 0,
         care: { day: null, acts: {} },
         lastProduct: null,
         fullSince: null,
         lastCalf: null
       }
     ],
     incubator: null, // { childId, started, due }
     calf: null,      // { childId, motherId, started, due }
     products: {
       egg:  { small: 0, medium: 0, large: 0 },
       milk: { small: 0, medium: 0, large: 0 }
     }
   }
   ```

   Use validated day strings and `addDays`/`diffDays`. Persist a forward-only `lastDay`; refuse mutations on earlier dates. Age never reverses. Resolve due transitions on load, day change, and before commands, with **no offline milk or egg accumulation**.

   Capacity counts **adults + babies + reserved arrivals**. Never truncate animals to enforce capacity.

3. **Hearts**

   | Purchase | Hearts | Result |
   |---|---:|---|
   | Adult hen | 120 | One named hen |
   | Adult cow | 240 | One named cow |
   | Barn upgrade | 300 | 1 → 4 animals |
   | Coop upgrade | 300 | 2 → 6 animals |

   Sleep, food, and water logging currently earn **22 hearts/day**. Saving for either first upgrade takes about **14 days**, assuming no other spending. These are proposed prices, not measured balancing results.

   Clover, Mochi, and Kaya already fill starter capacity, so expansion comes first. Use `OvuRewards.spend(cost, what, { farm: next })`. Herd animals must stay outside `rewards.owned`, whose placement and pet-slot rules serve room props. No heart purchases, resale, or product-to-heart exchange.

4. **Babies and products**

   - **Incubator:** choose and consume one egg of any size; reserve one coop slot. Hatch after three days; the chick becomes an adult seven days after hatching. One incubator.
   - **Calf:** an adult cow at love 10 offers **“Plan a calf.”** Reserve one barn slot. Due date is the latest of today, `fullSince + 7`, and `lastCalf + 7`. Thus an already-qualified cow can welcome one calf immediately, while repeat calves remain seven days apart. One pending calf globally; no automatic repeat breeding.
   - Birth creates the reserved child and clears its timer **in the same commit**. Record the mother’s `lastCalf`.
   - Babies begin at love 0. Pet, brush, and treat retain the existing +1 per action per day, capped at 10. Love survives adulthood.
   - Babies produce nothing. Chicks mature after seven days; calves after fourteen. A cow’s full-love breeding eligibility cannot start before adulthood.
   - Bought adults produce from the following day. Mature animals provide at most one product each day. No sickness, death, declining love, or missed-care penalties.

   **Phase 2 size behavior:**

   | Love | Product | Smallest kitchen behavior |
   |---|---|---|
   | 0–3 | Small | One ingredient |
   | 4–7 | Medium | One ingredient, size shown |
   | 8–10 | Large | One ingredient, size shown |

   Let players select size; default to smallest available. Every size makes one dish, with the used size shown in the result. Keep friendship rewards unchanged. Portion multipliers would add another inventory system.

   Eggs work in existing recipes and onsen cooking. Add one **milk-and-honey** recipe, because the current kitchen has no cow-milk recipe. Retain unsized onsen eggs.

5. **Migration and exact integration**

   The current `farmState()` reconstructs `animals` using only three starter IDs and coerces pantry values to numbers. I reproduced it discarding an unfamiliar animal and turning a sized egg object into zero.

   Migrate once, only when `farm.ranch` is genuinely absent:

   - Create Clover, Mochi, and Kaya with their existing IDs.
   - Preserve love, daily care receipts, and collection dates.
   - Preserve existing egg/milk quantities as **small** products; historical size is unknown.
   - Start `fullSince` on migration day for an already-loved adult.
   - Preserve legacy fields as migration evidence; never consume or reseed from them afterward.
   - Empty, malformed, or newer-version ranch state must not trigger starter replacement.

   **New `OvuRanch` API:**

   ```text
   migrate(farm, day), advance(ranch, day)       // pure transformations
   list(ranch, kind), capacity(ranch, kind)
   isAdult(animal, day), productSize(love)
   countProduct(farm, kind, size?)
   addProduct(farm, kind, size, n)
   takeProduct(farm, kind, size, n)
   buy(S, RW, kind, name, day)
   upgrade(S, RW, facility, day)
   incubate(S, size, day), startCalf(S, motherId, day)
   openShop()
   ```

   **Existing changes:**

   - `ovu-barn.js`: generalize `eggsReady`, `milkReady`, `collectEggs`, `milk`, `loveOf`, `addLove`, `love`, `care`, `doneToday`, `giveTreat`, `treatedToday`, and treat lookup to animal IDs. Replace fixed animal/nest lists in `renderBarn`, `startWander`, `meter`, `petNow`, `openNests`, `openClover`, `treatButtons`, and `treatStep`.
   - Barn `cookable`, `cookEggs`, and `pantryLine`: use product helpers.
   - `ovu-farm.js`: update `farmState`, `openBasket`, and `FARM` path data.
   - `ovu-kitchen.js`: update `have`, `label`, `cook`, `buyStaple`, recipe/result presentation, and `RECIPES`. Grocer eggs become small eggs.
   - `ovu-villagers.js`: update `bag` and `takeFromBag`; preserve canonical `egg`/`milk` gift identities.
   - `room.js`: reuse `activityNow`/`refuseBusy`; add generic ranch/animal moment mappings. Layouts remain registered by scene modules.
   - Load the new script before barn/kitchen consumers; update service-worker assets.
   - Account save: verify `GAME_KEYS` contains **`farm`** and preserves its complete nested value. No top-level `ranch` key is needed.

   Every entry path checks `refuseBusy`, sleep, and current scene. Use `OvuCare.step` for care animations and revalidate on completion. Fix the existing animal sprite click, which currently calls `petNow()` before the busy check.

6. **Erin lines**

   Reuse existing collecting, brushing, and cooking audio. Add only these generic recordings, with names and dates displayed as text:

   - “There’s a little ranch beyond the farm.”
   - “More room, ready for a new arrival.”
   - “Welcome home, little one.”
   - “One egg, tucked into a warm nest.”
   - “A little chick has hatched.”
   - “Your chick is all grown up.”
   - “A calf is on the way.”
   - “Your calf is here.”
   - “Your calf is all grown up.”
   - “They’re happy here. Come back whenever you like.”

7. **Risks, tests, and build order**

   The largest remaining risk is **concurrent saves**. Current store merging moves the entire `farm` key, so stale watering could overwrite a paid animal. `commit()` provides rollback on failure; it does not provide cross-tab transaction isolation. All farm/reward commands need shared serialization and fresh reads, plus the intended account revision-conflict behavior. Never independently merge herd arrays or sum heart balances.

   Required tests:

   - Migration preserves quantities, IDs, love, and daily receipts; repeat migration changes nothing.
   - Invalid/newer schemas and valid oversized herds retain their animals.
   - Hatch/growth boundaries, leap days, long absence, backward clocks, and repeated settlement.
   - Reserved capacity blocks competing purchases and births.
   - Storage failure changes no hearts, eggs, energy, animal, or timer.
   - Two tabs competing for the last stall; watering concurrent with purchase.
   - Account switch, stale account revision, restore, and deletion during care.
   - Size boundaries 3/4 and 7/8; every kitchen, grocer, gift, and onsen consumer subtracts exactly once.
   - Full dish storage refuses cooking before consuming ingredients.
   - Ranch play awards zero currency and creates zero diary entries.
   - Busy-state, cancellation, escaped names, reduced motion, and reachable paths in both interior levels.

   **Build order:** verify the missing account-save module → migration and transaction tests → sized products across every consumer → purchases/upgrades → babies → dynamic animal scenes and art → phone smoke checks. No implementation or publication is authorized by this review.

