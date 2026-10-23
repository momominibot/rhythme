# Harbour Lane: the grocer, the boutique, the gym, the fish store and the post box (design, 21 Oct 2026)

Jamie asked after five things that exist on no branch: "a fashion store, a gym, a fish store, a grocer, and post or
mail" (21 Oct, recorded in STATUS). On 21 Oct, in a cloud session, Jamie chose: build the logic and the sheets now; the
plates and store art come from a separate guarded Seedream run in a cloud session with the Ark key; the Codex persona
walks wait for Codex (usage limit until 27 Oct), and no other model stands in for them.

This build is the logic and the sheets. Every shop works today as a sheet from the harbour's signpost, the way Dream
Street's stores worked as sheets before their interiors were drawn. When the lane plate and the interiors exist, the
signpost becomes a door to a walkable lane and each storefront a door to its room (section 8).

## 1. Where it is

- **Harbour Lane** runs inland from the harbour (section 7 of `2026-10-21-harbour-and-fishing.md` named it and Codex
  named two of its shops). Until its plate exists, the harbour's signpost (the small post already drawn by the hut,
  hotspot `hblane` at 19, 44, stand point 23, 51, on the meadow, clear of the hut, the sign and the rocks) opens the
  lane sheet: five rows, each with its hours and whether it is open now, like the Dream Street tab of the store sheet.
- It is reached by walking: garden, farm, harbour, signpost. The farm's seeds are bought one scene from the farm.

| Place | Name | Hours | What it is |
|---|---|---|---|
| Grocer | Hay & Harvest | 8 am to 8 pm | Seed packs, new crops, and the seed swap counter |
| Boutique | Petal & Thread | 10 am to 9 pm | The fitting room (her wardrobe) and a new rail |
| Gym | Tideline Gym | 6 am to 10 pm | Four stations, each opening the movement log; always free |
| Fish store | Bait & Fin | 7 am to 7 pm | Float colours for the harbour line, the catch book, an aquarium to come |
| Post box | The post box | always | A kind postcard to a plaza friend, and a letter to future you |

Names are placeholders Jamie can change in one place (`ovu-lane.js`, `PLACES`). Bait & Fin and Hay & Harvest are
Codex's names from the harbour review. Bait & Fin sells no live bait and no fish (section 5).

## 2. Hay & Harvest, the grocer

Jamie, 19 Oct: "To farm, avatar needs to go to the grocery store to purchase seeds". The shed sold packs on 20 Oct
only because no grocer existed. Now:

- **Seed packs** (3 seeds of a crop she can grow, 10 hearts) and **new crops** (kangkong, pak choy, lemongrass,
  chilli padi, sweet potato, for good, one seed to start, 40 to 80 hearts) move to the grocer. Same rules, same
  prices, same functions (`OvuFarm.buyPack`, `OvuFarm.unlockCrop`): the hearts and the seeds are one save.
- **The shed keeps** its free seeds of the day and its two tools (the seed shelf and the big watering can), and says
  where packs and new crops are now. A quiet logging week still never stops the farm.
- **Seed swap counter** (farm-loop design, section 1): give 3 from the basket, take 1 seed of any crop she can grow.
  A pumpkin counts as 3. No hearts change hands either way, so harvests never turn into hearts. `OvuFarm.swapSeed`
  is one save; it refuses an unknown crop, a crop she cannot grow yet, and a basket without enough of what she chose.
- Mindful line on buying and swapping: "Choose one thing you would like to grow in yourself this week" (cetana).
- Not yet: kitchen staples. They are for recipes, and cooking is not built.

## 3. Petal & Thread, the boutique

- **The fitting room** is her wardrobe: every outfit she has is free and stays free. Nothing that was free becomes
  paid.
- **The new rail** lists outfits that need a full set of sprites before anyone can wear them (standing, meditate,
  sleep, the bench and every action pose; the tudung waited for the same reason and `tools/test-core.js` 2g holds that
  line). Until their art lands they show their price and "Arriving with the next art run" and cannot be bought.
  Proposed: a batik shirt dress and a rain cape with boots, 120 hearts each (three to four honest days of logging,
  per `2026-10-19-points-economy.md`). Jamie picks the outfits.
- Mindful line on trying on: "Notice how the fabric feels. Nothing to fix about you."

## 4. Tideline Gym

Movement is care, and care never costs hearts (the scale's rule, Codex 20 Oct). The gym is free, earns nothing by
itself, and never logs anything for her.

- Four stations: the treadmill (walking), the bike (cycling), the mat (yoga), the weights (strength). Each shows one
  line of noticing and **Log movement**, which opens the existing movement sheet with that activity already chosen.
  Only her own save writes an entry; the day's movement hearts follow the existing once-a-day rule.
- **Movement and your cycle** opens the existing guide, with its sources and its when-to-see-a-doctor section. The
  gym adds no clinical sentence of its own.
- Her pose at a station is her stretch pose in what she is wearing.

## 5. Bait & Fin, the fish store

The harbour is catch and release. Codex asked Jamie to settle live bait, aquarium adoption and cooking before any of
it is built; none of the three is in this build.

- **Float colours** for the harbour line: blush (the one she has), mint, lilac and sunshine at 15 hearts, moonlight
  at 25 (it glows after dark). A float is cosmetic: it changes the float on the water and in the sheet, nothing else.
  Bought once, kept for good, one in use at a time, swapped free.
- **The catch book** opens from the counter too.
- **An aquarium for her room** is listed as arriving with the art run, as furniture, and holds no fish until Jamie
  decides on adoption.

## 6. The post box

- **A postcard to a friend** opens Plaza friends, where the kind notes already are: preset phrases only, block and
  report on every note, every rule enforced by the server. The post box adds no new way to reach anyone.
- **A letter to future you**: up to 600 characters, arriving in a week, a month or three months. Kept on this phone
  only, never read by Luna, never in a report or the doctor view. When one has
  arrived the lane sheet says "Post for you"; reading it shows the letter and one line ("Read it slowly. Notice how
  far you have come, or how close you still are."). Delete any time, before or after it arrives. At most twelve
  letters waiting. No hearts for writing: it is not a diary entry. "Kept on this phone" means the cloud backup never
  carries it (it syncs diary entries only); her own data export, which copies everything on the phone, includes it.

## 7. Rules held by the tests

- No place on the lane awards hearts, and the gym and the post box never spend them.
- The grocer's packs and crops cost what the shed charged, and hearts and seeds move in one save.
- The swap takes exactly 3 (or one pumpkin) and gives exactly 1 seed; a crop she cannot grow is refused.
- The boutique cannot sell an outfit whose sprites are not in place.
- A float bought is kept; choosing an owned float is free; the harbour draws the chosen colour.
- A letter cannot be opened before its day; text is trimmed to 600; twelve waiting at most.
- Hours: each place opens and shuts by its own hours, tester mode visits any time, the post box never shuts.
- Nothing on the lane writes a diary entry.

## 8. Art for the guarded run

One job at a time, stop on the first failure, no retries (the rules of every earlier run):

1. The Harbour Lane plate, 1024x1280, the floating-island style of `harbour-v1.webp`: a short cobbled lane with four
   shopfronts (a grocer with seed racks and crates, a boutique with a dress in the window, a small gym with a big
   window and a mat inside, a fish store with floats and nets but no fish on ice) and a red Singapore post box.
2. Four interiors, 1248x1560, two storeys like the Dream Street stores, surfaces drawn empty.
3. A map icon for the lane, keyed on green.
4. The aquarium prop, keyed on green.
5. The two boutique outfits: standing sprite first; the full pose set only after Jamie approves the standing ones.

Then: the lane becomes a scene (`Z.register`, a door from the signpost), each storefront a door to its interior,
and the sheets stay as the fallback, as they did on Dream Street.

## 8b. The lane as a place (21 Oct, night)

Jamie: "All five stores' logic works (grocer, fashion store, gym, fish store, post box), can draw these ?"

**Drawn** in one guarded run (`tools/art/jobs/2026-10-21-harbour-lane-run.json`; lock, no retries, stop on the first
failure): the lane plate `lane-v1.webp` and three interiors, `shop-grocer-2f-v1.webp`, `shop-boutique-2f-v1.webp` and
`shop-gym-2f-v1.webp`, all 1024x1280. The interiors are 1024x1280, not the planned 1248x1560, because the service cuts a
render near 62 s and the 1024 renders took 51 to 62 s. **Not drawn**: the fish store's interior stopped at 61.9 s
(RemoteDisconnected), so the run stopped there as the rules require, and the map icon and the aquarium were never sent.
A new run needs Jamie's go-ahead.

**Wiring** (`ovu-lanescene.js`, loaded right after `ovu-lane.js`; nothing in it saves, sells or counts):

- The harbour's signpost is now a doorstep (`{tap: 'hblane', to: 'lane'}` at its stand point): tapping it, or walking
  there and stopping, walks her up the lane. She arrives at the lane's foot; going back down puts her at the signpost.
- On the lane each shopfront is a doorstep that opens only where a walk ends (as on Dream Street). In its hours she goes
  into its room and arrives at its mat; asleep, or outside the hours, the place's own sheet answers (the asleep toast or
  the closed card) and she stays outside. Leaving a room puts her back at that shop's door.
- Bait & Fin has no room yet, so its front opens its sheet; the post box opens the post. The path at the foot of the lane
  takes her back to the harbour the moment she steps on it.
- Inside: the grocer's counter and seed rack open the grocer's sheet; in the boutique the fitting room opens her
  wardrobe and the rail and counter open the boutique's sheet; in the gym each of the four stations opens the movement
  log with its activity chosen, exactly as the sheet's buttons do. Every one checks the asleep state and the hours first.
  The gym's drawn door is shut, so she arrives on its floor and leaves by tapping the door.
- The rooms never set a Dream Street `store`, so the walk engine's street hours never apply; the lane keeps its own.
- The rooms are hidden from the world map and belong to the lane (`mapHide`, `mapParent`), as the barn's rooms do. The
  map finds the lane through the signpost door and says "You are on Harbour Lane". Until the lane's map icon is drawn,
  its node shows the storefront glyph.
- Her size is `avatarW: 9` on all four plates: about the height of the shop doors and a little taller than the post box.
  In the boutique and the gym she walks the floor behind the front wall, kept above its top edge.
- The lane's own sheet stays, as Dream Street's does: every place sheet's Back row still goes to it, and it now says the
  grocer, the boutique and the gym are rooms to walk into.

**Checked**: core (every stand point, door and resting spot on the floor and reachable from every way in; arrival spots;
the map; the handlers with stand-ins for shut, asleep and napping) and the smoke (the walk up the signpost, into and out
of each room, every counter, the fitting room and the treadmill, nothing written).

## 9. Questions for Jamie

1. The five names.
2. Which two outfits for the new rail.
3. Live bait, aquarium fish, fish cooking: still open from Codex's harbour review.
4. Whether the postcard should also reach someone outside the plaza (not built: it would need a new server rule).
