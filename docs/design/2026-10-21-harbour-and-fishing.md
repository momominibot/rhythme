# The harbour and fishing

Jamie, 21 Oct 2026: "Continue to work autonomously from start to end, including generation of the harbour port and
fishing capability. Make sure all the farming system makes sense and is functional."

Built on 21 Oct 2026 (branch `claude/world-harbour`, on top of the barn branch). The shape is Codex's harbour review of
the same morning (gpt-6-astra, read-only, with web search), trimmed to the smallest worthwhile slice it recommended: one
harbour scene with two fishing spots, six species, a catch book, a release line, and a way to sit and watch the
water instead. Harbour Lane and its three shops, aquarium adoption and fish cooking are not built; see section 7.

## 1. Where it is

- **The farm gets a third way out.** Steps on the island's lower-right shore (hotspot `harboursteps` at 72, 74 on
  the farm plate, stand point 70, 67), drawn as a hotspot like the farm path and the barn path, so the farm plate is
  not redrawn. The door is `harboursteps` to `harbour`.
- **The harbour** is its own scene (one new plate, 1024x1280, the floating-island style): a weathered timber kelong
  jetty on stilts running out over lavender water to a small lantern shelter with a rope coil and a ladder, a moored
  bumboat with a pink awning, a cream harbour hut, a bench under a sea-almond tree, smooth rocks on the lower-left
  shore, and a pale stone path from the bottom edge (the way back to the farm). Kelong Walk belongs to Changi Point
  (Codex's correction of the leads), and the plate is read as that kind of quiet waterfront, not a working port.
- On the map it is a node like any other, with its own icon (`map-harbour.webp`), reached by walking the doors from
  home: garden, farm, harbour.

## 2. Fishing (catch and release only)

- Two spots: **the jetty** (`hbjetty`, the shelter deck, out over deep water) and **the rocks** (`hbrocks`, by the
  shore). The hut (`hbhut`) holds the catch book. The bench (`hbbench`) watches the water.
- **Cast.** A free rod that never wears out. A cast is one care step (`ovu-care.js`, 7 s): a line and a float appear on
  the water in the scene, rings spread, and the sheet's water picture shows the float. **Stop** reels in nothing: no
  cast counted, no energy spent, nothing lost. Closing the sheet, leaving the scene, sleep or another activity drop the
  step the same way and take the line in.
- **A fish comes.** When the step ends, one species that suits the spot and the time of day is chosen evenly (no
  weights, no rarity). The float dips, a shadow moves under it, and two buttons wait **with no clock**: *Lift gently*
  and *Let it be*. There is no reaction window, no tension bar, no holding, no rapid tapping, no escape.
- **Lift gently** writes the fish in the catch book (first day kept, meetings counted) and charges the energy of one
  cast (`OvuStamina.COSTS.fish`, 3) in the same save, so a failed save changes nothing and a tired person is told
  before anything is written. Then the fish is shown: its picture, its name and local name, one plain fact with its
  source, and *Let it go*. Every fish goes back; there is no keep.
- **Let it be** closes the moment with nothing counted.
- **Energy** is checked at the cast and again at the lift. Nothing here adds energy, pays hearts, or writes a diary
  entry; `tools/test-core.js` greps the module for all three.

## 3. The six

| Fish | Local name | Spot | Time | The one fact shown (source) |
|---|---|---|---|---|
| Orange-spotted grouper | kerapu | rocks, jetty | any | Young groupers grow up in estuaries and mangroves; the adults live out on the reefs. (Wikipedia, orange-spotted grouper: "juveniles are frequently encountered in estuaries ... and in mangroves"; adults "in coral reefs") |
| Mangrove red snapper | ikan merah | rocks | any | At home among mangrove roots when young, it moves out to open water to breed. (Wikipedia, mangrove red snapper: "commonly found in mangrove-lined estuarine systems"; "As they mature ... move into open waters ... to breed") |
| Barramundi | siakap | jetty | any | Barramundi start life as males. In Singapore farms, most had become females by two to three years old. (Aquaculture Reports 20 (2021) 100712, "Early sex change of barramundi Lates calcarifer farmed in Singapore": protandrous hermaphrodites; at 2 to 3 years 19% male, 8% changing, 73% female) |
| Flathead grey mullet | belanak | jetty, rocks | day | It feeds by sucking up the top layer of the sea floor, for tiny algae and bits of food. (FAO cultured species fact sheet, Mugil cephalus: "Feeding by sucking up the top layer of sediments ... remove detritus and microalgae") |
| White-spotted rabbitfish | pek tor her | rocks | day | A grazer of seaweed and seagrass, with venom in its fin spines, so fishers handle it with care. Teochew families prize it at Chinese New Year. (Wikipedia, Siganus canaliculatus: "venom glands located in grooves on the spines of the dorsal and anal fins"; "feeds on benthic algae and ... sea grass"; "The Teochews of Singapore and Malaysia ... refer to as pek tor her"; "particularly popular during Chinese New Year") |
| Bigfin reef squid | sotong | jetty | night | It changes the colour of its skin to match the sea floor beneath it. (Scientific Reports 2022, "Squid adjust their body color according to substrate", PMC8960755: S. lessoniana "adapts the coloration of their skin using their chromatophores according to the background substrate") |

All six pages were opened on 21 Oct 2026. The WildSingapore fact sheets Codex pointed at did not come up in search, so
the sources above are the ones actually read. "Sunset" and "night" on the sun clock count as after dark.

## 4. The catch book

The hut opens it; the fishing sheets link to it. Six rows: a kind met shows its picture, local name, first day, times
met and its fact; one not met shows "?", where to try (the jetty, the rocks) and when (in daylight, after dark). The
count reads "n of 6 kinds met" and the page says there is nothing to complete: the book is for noticing. No badges,
no deadlines, no midnight-only fish.

## 5. The bench

"Watch the water": her seated sprite on the bench (the hidden spring's warm-stone pattern through `OvuGarden.seatPlace`),
a real **Stop watching** button, no timer, no save, no breathing animation. For anyone who would rather not hook a fish.

## 6. Code shape

- `ovu-harbour.js`: pure rules first (`SPECIES`, `candidates`, `pick`, `harbourState` with cleaning, `record`), then the
  layout (`HARBOUR`), then the scene. State is `state.harbour = { book: { id: { first, n } }, casts }`, device-local
  like the farm's.
- The line and float are a `.harbourthing.castline` element in the props layer; `.scene.bite` dips the float. Reduced
  motion stops the animations and leaves the dipped float and the rings still.
- The farm's `harboursteps` hotspot and door; `ovu-map.js` names the icon; `ovu-moments.js` carries `cast`, `bite`,
  `release` and `watchwater` lines ("there is no hurry").
- Checks: `tools/test-core.js` 2k4 (species table, spot and time filters, even bounded pick, the book and its cleaning,
  energy charged once and refused when tired, no hearts, no refill, no diary write, the plate's stand points and doors
  on the floor and reachable, the farm steps reachable from the gate, the moments); `tools/e2e_smoke.py` walks down
  from the farm, casts, lifts, lets one be, reads the book, sits on the bench and walks back up.

## 7. Not in this build

- Harbour Lane (Bait & Fin, Hay & Harvest, the kopitiam), aquarium adoption, worms or bought lures, fish cooking, and
  any Harbour Lane prices. Codex's review ranked a kopitiam first for a third shop and asked Jamie to settle cooking,
  live bait and adoption before any of it is built. Fishing earns no hearts and nothing here is for sale.
- The barn's produce has somewhere to go now in a smaller way: carrots, pumpkins and sweet potatoes are treats for
  Clover, kangkong, pak choy and strawberries for the hens (`ovu-barn.js`, `giveTreat`). A treat is only a treat.

## 8. Art

Three images in one guarded run on Jamie's word (`gen.py --retries 0 --url`, one lock, a start marker, both output
channels and the decoded image checked). The plate (seed 21, 1024x1280, 73.6 s), a 3 by 2 fish sheet on blue
(seed 21, 1024x1024, 50.2 s; keyed on blue and cut by connected shapes, since a grid cut clipped two tails), and the map
icon on green (seed 9, 1024x1024, 57.1 s; keyed keeping the largest shape). The runner stopped once on a false
positive (its error grep matched "403" inside the scratchpad path); nothing had failed, and the two images never
attempted were rendered in a second guarded start. No image was retried.
