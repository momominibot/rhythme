# Petal & Thread: trying on in the fitting room (21 Oct 2026)

Jamie, 21 Oct: "so when user went into the fashion boutique shop, we will allow customization of the avatar - try on outfit and accessories."

Built on the walkable Harbour Lane (PR #60): Petal & Thread is a room (ovu-lanescene.js `lane-boutique`) with a fitting room, a rail and a counter.

## What she can do

- In the boutique, the fitting room opens **Try on**: every outfit, including Rhythme Plus drops she does not have (the Starlight gown).
- Tapping one closes the sheet and she turns into it in the room (the existing twirl; the gown gets its glam twirl). With reduced motion she changes without turning.
- While she tries something on, a small bar over the room says what she is wearing and offers:
  - **Keep it** for an outfit she has (free, as the wardrobe is today). This is the only thing that saves.
  - **Part of Rhythme Plus** for a Plus drop she does not have: opens the Plus hook (below). No price is shown anywhere.
  - **Try another** (reopens the fitting room) and **Back to my own clothes**.
- Leaving the boutique (any layout change away from `lane-boutique`), or **Back to my own clothes**, puts her saved outfit back.

## Rules

- Trying on is free and changes nothing saved: no profile write, no state write, no diary entry, no hearts. Only **Keep it** calls the existing `setOutfit` (which writes `profile.outfit`, as the wardrobe always has).
- Nothing happens by itself (Jamie, 18 Oct: no random avatar moments): she only changes when tapped.
- Friends see only what she keeps: the plaza card, the garden, harbour, barn, seats and tones copies all read `profile.outfit`, which try-on never touches.
- Reduced motion: no twirl.
- No em dashes, no prices.

## How it is built

- `room.js`
  - `trying = null | { outfit, acc }`, in memory only, gone on reload.
  - `wearing()` = the tried-on outfit or `profile.outfit`. The avatar's own pictures (blink, poses, `restorePose`, meditate and sleep sprites) read `wearing()` so a pose or a blink never flips her back mid try-on.
  - `showOutfit(id, silent)`: the picture half of today's `setOutfit` (load, twirl or swap, the wardrobe line). `setOutfit(id)` = validate + Plus lock + clear `trying` + `showOutfit` + `S.setProfile({ outfit })`, so its behaviour is unchanged.
  - `tryOn(id)`: any known outfit, lock not applied (it is only a look). `endTryOn(silent)`: `trying = null`, show `profile.outfit`.
  - Try-on ends (silently) when she leaves the boutique (`layout` event), and before anything that draws her in other sprites and could save: sleep (`enterNight`, `stopEverything`), meditation, a breathing session, a practice, Morning start, any `activity` hand-over. So a Plus drop she does not have is never slept, meditated or practised in.
- `ovu-boutique.js` (new): the fitting room sheet, the try-on bar, the accessory slot and its pure rules (testable in node). The boutique's fitting-room hotspot and the boutique sheet's button open it instead of the wardrobe. The wardrobe (from You) is unchanged.

## The Plus hook

The purchase is being built in another session (an in-app purchase, not Stripe). The fitting room calls:

```js
window.OvuPlus && OvuPlus.offer ? OvuPlus.offer({ from: 'boutique', item: 'gown' }) : OvuRoom.openPlus()
```

`OvuPlus.offer(ctx)` is the one entry point that session should provide. Until it exists, today's Plus preview sheet opens. Whether a drop is hers stays `OvuRoom.outfitLocked(id)`, which already reads Plus on this phone and tester mode.

## Accessories: the slot

One accessory at a time, drawn as its own layer (`<img class="acc">` inside `#avatar`) over the standing sprite.

```js
{ id: 'flower', name: 'Hair flower', img: 'accessory-flower.webp', ready: false,
  at: { base: { u: 0.62, v: 0.12, w: 0.22, rot: -10 }, gown: {...} },  // per sprite name
  skip: ['tudung'] }                                                  // never on these outfits
```

- `u, v`: the accessory's centre as a fraction of the sprite image; `w`: its width as a fraction of the sprite width; `rot` degrees. Keyed by the sprite file name (`base`, `gown`, `act-plants-gown` ...).
- A sprite with no entry hides it: a walk strip, a pose, sleep or meditation never shows a misplaced piece. Hidden during the twirl too.
- A head piece is listed in `skip` for the tudung unless drawn to sit on it, so it never shows hair.
- Owned accessories would save as `profile.accessory` (kept free, as outfits are); trying one on is in `trying.acc` only.
- No accessory art exists yet, and nothing is drawn without Jamie's go-ahead, so the list ships empty of `ready` pieces: the slot, its placement maths and its try-on row are built and tested with a fixture, and the row stays hidden until a piece is ready. Concepts are being asked of the glam-outfit-drops session.
