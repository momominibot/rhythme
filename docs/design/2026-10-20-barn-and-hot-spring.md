# The barn, the animals and the hidden hot spring

Jamie, 20 Oct 2026: "where is my farm house for cow and chicken where I get milk and eggs.. I want a secret space - a cave
with hot spring where I can cook my egg".

Status: design, revised after a Codex design review (REVISE, 20 Oct). Nothing is built and no art is made yet.

## 1. Where it is

- **The farm gets a second way out.** A small signpost on the farm island's right edge (about x 88, y 58 on the farm
  plate), drawn as a hotspot like the garden's farm path, so the farm plate is not redrawn: "Path to the barn".
- **The barn** is its own scene (one new plate, same floating-island style): a soft pink barn with an open front and a
  stall, a little hen house with three nest boxes, a paddock fence, a milk churn, and behind them a rocky hillside with
  a narrow gap where faint steam drifts out. A path stub at the lower left leads back to the farm.
- **The hot spring** is a cave scene (one new plate): a warm pool lit by lanterns and glowing crystals, rising steam,
  flat warm stones at the edge, a small rope basket hanging over the water. The way out is at the bottom.

## 2. Finding the cave (a secret, never a grind)

- From the first visit the steam in the rocks is visible and has a small hotspot: "Warm air drifts from the rocks".
- Tapping it the first time: she walks over, a short line ("There is a narrow path between the stones."), and the gap
  becomes a door named "The hidden spring". Found once, remembered (`state.places.cave`).
- The map shows the cave as a soft "?" until it is found, then by name. No hearts, days or chores unlock it.

## 3. The animals

- **Clover the cow** and **two hens, Mochi and Kaya**, live at the barn from the start, free. Two nest boxes.
- **No needs, no guilt, no nudges.** No hunger, affection meter, decay or yield penalty. No ready badges, reminders,
  streaks or "Clover is waiting" lines anywhere.
- **Eggs.** On a day after her last collection from that hen, the hen's nest has one egg. An egg never spoils and never
  stacks. Words: "Mochi laid an egg." / "Mochi's nest is resting today." The last collection date is kept per hen and
  compared as `day > last`; a clock set back gives nothing twice, a clock set forward simply shows an egg (no harm, no
  claim of being clock-proof).
- **Milk.** The same rule for Clover: one pail of milk on a day after the last milking.
- Collecting is one slow, stoppable step each (the farm's pattern): eggs cost 1 energy for the visit to the nests,
  milk 2. Lines describe what is on screen: "Watch the egg settle in the basket." / "Watch the milk collect in the
  pail."
- She is drawn in her standing sprite, with a small basket or pail drawn beside her (SVG). No new poses: the existing
  `tend` and `pets` sprites hold a plant pot and a pet bowl.
- What she collects goes into a **pantry** inside the farm (`pantry: { egg, milk, onsenegg }`), shown in the basket
  sheet. It is decorative play inventory, kept on this device: never sold, never turned into hearts, no benefit from
  having more, capped at 99 each.

## 4. The hidden spring

- **No energy, ever.** Nothing at the spring adds or spends energy, hearts or diary entries.
- **Pretend onsen eggs.** At the hanging basket, with at least one egg: one slow, stoppable sequence in the sheet.
  Lower the basket (2.5 s), watch the steam (6 s), lift it out (2.5 s), with one line each: "Watch the basket sink
  into the water." / "Watch the steam curl over the basket." / "Watch the drops fall from the basket." Stop at any
  point changes nothing. Only when the sequence completes are up to four eggs turned into onsen eggs, in one save
  (eggs out, onsen eggs in). No timers that persist, no slot to clear, nothing to come back for.
- The sheet calls it **pretend cooking** and gives no real cooking times or food advice.
- **Sit by the water** (optional): a plain seated presentation, steam and water sound, a real **Stop sitting** button
  (keyboard operable). No breathing animation, no timer target, no session or practice save, no rewards.
- **After the eggs:** "Your onsen eggs are in the pantry." with **Done** as the main button and a quiet secondary
  "Open food diary". Nothing is prefilled; nothing is logged unless she does it herself.
- Warm milk is cut.

## 5. Finding the cave (Jamie, 20 Oct: "on the map it's secret")

- Behind the barn, a thin crack of starlight glints between the rocks from the first visit, with a normal labelled
  hotspot: "A crack of starlight". The first tap walks her over, shows "There is a narrow path between the stones.",
  saves `places.cave` (other `places` keys kept), and only then adds the door "The hidden spring".
- **Secret on the map:** until it is found the cave is not on the map at all: no node, label, pin, art or route, and
  its door does not exist. Once found it appears with a small sparkle so she can return.
- A gentle hint is allowed and never required: the glint itself, and once, on a later barn visit, a soft line from
  Luna ("I saw starlight between the rocks behind the barn."). No hearts, days or chores.

## 6. Code shape (from the review)

- **One canonical farm state**: `farmState()` keeps every field it does not know about and validates the new ones
  (whole non-negative numbers, capped; known hen ids only; dates as `YYYY-MM-DD`). Old actions (can, seeds, tools)
  must keep the pantry and animals: tested with a stocked pantry.
- **A shared care step** (`ovu-care.js`): the farm's `slowStep` moved out, with the scene it started in and an action
  token. It is dropped on sheet change, scene change, sleep, another activity, page hide and data replacement, and
  completion rechecks token, scene, date, energy and the exact inventory it showed.
- **Energy**: `egg` 1 and `milk` 2 registered in `OvuStamina.COSTS`; an unknown action is refused; the charge is in the
  same `commit` as the inventory.
- **Distinct hotspot ids** (`nests`, `stall`, `spring-basket`, `spring-seat`, `steam-gap`), never reusing the farm's.
- **Walking**: `checkLayout` and `OvuWalk.plan` from every entrance to every stand point and every exit, with the animals
  and the seated spot occupied; a route that fails does not fall back to a straight walk.
- **Camera**: both scenes open fitted (zoom 1), manual zoom kept.
- **Lighting**: the barn takes the night veil, animal sprites included. The cave is the same starry dark in every sky
  phase (no day tint, no night veil). Because it is so dark, everything on top of it gets its own contrast: the HUD,
  labels, prompts and the can gauge sit on light pills, the walk path is a pale glowing trail in the art, and the
  contrast audit runs on the cave in both themes.
- **Reduced motion**: steam, ripples, animal idle and progress bars stand still, read live.

## 7. Art (one guarded batch, four images, decided now)

Seedream 5.0 pro on the Ark data plane, `--retries 0`, one lock, skip done items, both output channels and the decoded
image checked, the whole batch stops and records a block on the first failure. A second attempt of anything needs
Jamie's word again.

| # | Image | Size | Notes |
|---|---|---|---|
| 1 | Barn plate | 1024x1280 (4:5, the scene's own ratio) | soft pink barn with an open stall, a hen house with two empty nest boxes, fence behind the animals' spots, a clear dry path, rocks at the back with a gap and faint steam, no animals |
| 2 | Cave plate | 1024x1280 | a mystical cave like the universe: pitch black, full of stars, glowing crystals, a softly glowing steaming hot spring in the middle, a hanging rope basket, one flat seat stone, a dry pale path from the exit at the bottom; soft and dreamy, never horror |
| 3 | Clover the cow | 1024x1024, magenta key | whole body, three-quarter view, uncropped |
| 4 | Hen | 1024x1024, magenta key | one hen, mirrored and feather-tinted for the second |

Keys are checked against pink ears, combs and feet. Map icons are cut from the plates. Eggs, basket and pail are SVG.

## 8. Not in this build

The cross-tab store problem the review found (a farm save in one tab can overwrite a food entry saved in another) is
older than this feature and affects every game save; it needs its own fix in `ovu-store.js` before more game state is
added, as a separate piece of work.

## 9. Build order

1. Canonical farm state, pantry, animal and spring rules, core checks.
2. `ovu-care.js` extracted from the farm, farm tests still green.
3. Barn scene, animals, collecting; cave discovery, onsen eggs, sitting; map.
4. Night, reduced motion, smoke checks, a Codex diff review to PASS, a PR for Jamie. No push to main.
