# A livelier avatar and a prettier cake (21 Oct 2026)

Jamie, 21 Oct: "Ok go ahead and generate the pretty cake", "Cake can be prettier", "can the avatar be animated? Turn around like a Cinderella changing into the glamorous gown", "I want it like animal crossing", "Not stiff avatar".

Jamie's rule of 18 Oct still holds: no random moments. She keeps her outfit and pose until she is asked to do something. So the new life comes from her turning when she changes clothes and from blinking, never from poses or outfits changing by themselves.

## The cake

- Three candidates in one guarded Seedream run (a lock, a start marker, no retries, stop at the first error): a two-tier lilac and blush cake with a glossy white drip, star sprinkles and a gold star on top; a moonlit one; a three-tier one with balloons. The first was chosen. Its star echoes the Starlight gown, and its outline reads at room size.
- The chroma-green background tinted the candle glow green. Green was clamped to the larger of red and blue, and the candle halos were warmed to candlelight gold. No second render was needed.
- It used to stand on the floor between the pouf and the table, so it looked as if it floated. It now stands on the round table, just behind the open diary. That spot was read on a 1% grid of room-v3 (x 66.8, y 72.1), and it is a little bigger than before (9.2% of the room's width).

## The twirl (room.js `twirl`)

- **What she does**: when she picks an outfit, she spins about her own middle to show it, like the Animal Crossing wardrobe. Her picture turns edge-on (its width follows the cosine of the angle), and the new outfit takes its place at an edge-on moment halfway through, so the change itself is never seen. She lifts a little as she turns and squashes softly as she lands.
- **How long**: an outfit gets one and a half turns in about a second. The Starlight gown gets the Cinderella version: two and a half turns in about two seconds, inside a rising ring of sparkles and a soft pillar of light, with a flash as the gown appears and a starburst as she lands. A three-note sparkle sound plays. Her line follows in her bubble with a happy hop ("Starlight, just for you." for the gown).
- **Where it is seen**: picking an outfit now closes the wardrobe first, and the birthday card's Wear button closes the card first. So she is seen turning in the room, not hidden behind a sheet.
- **Never in the way**: one animation-frame clock drives the turn and the sparkles, so the swap lands exactly edge-on. A timer finishes the twirl if frames stop (a hidden page). A walk finishes it at once, dressed in what she chose. The walk home after a sheet closes waits until she has turned, hopped and spoken. Silent outfit changes (start-up, pyjamas at bedtime, coming back from a pose) never twirl, and neither do sleep, meditation, practices, Morning start, a seat, arranging furniture or reduced motion.

## The blink (room.js `blink`)

- Each wardrobe outfit has a closed-eye copy of its standing picture (`avatar-<outfit>-blink.webp`). They were made locally by `tools/art/make_blink.py`, with no model call. It finds each eye by its violet, covers the eye with the skin just around it (the blush stays as it is), and draws a soft closed lid in her own lash colour. The outline, hair, clothes and everything else stay pixel for pixel the same. A model-made version was tried first, but the image service cut the first edit at about 63 seconds, so that run stopped and kept its block, as the guard requires.
- **When**: every 2.4 to 6 seconds while she stands idle in that outfit, now and then twice, for about a tenth of a second each time. It never happens during a pose, a walk, a twirl or sleep, and reduced motion keeps her eyes open. The walk engine reads the blink copy's outfit correctly, so a walk that starts mid-blink still uses her walk cycle.
- **Tests**: an automated test browser keeps her eyes still unless a test asks (`OvuRoom.blinking(true)`). That way no screenshot or check lands on a blink, and the blink check switches it on.

## Not done here

- **Walk strips** for the gown, the kebayas and the tudung. She still steps with the bob in those.
- **Idle gestures**, such as stretching or waving on her own. Jamie's rule of 18 Oct leaves them out, and only Jamie can change that.
- **Blinks in other pictures**: a blink in poses, or while seated, would need closed-eye copies of those pictures too.

## Codex review fixes (21 Oct, night)

The first review found no P1, three P2 and eight P3 problems. All are fixed:

- **Interruptions**: floor taps and arrow keys start walks through the walk hook, so they now finish a twirl at once, as tapped walks already did. A pose asked for mid-turn (a pet cuddle) finishes the turn first and is never painted over: the twirl writes her picture only while it still owns it (the image generation check). An earlier moment's timer is cleared when a turn starts, so it can no longer end the new turn early. Tapping her mid-turn no longer hops over the turn.
- **The walk home**: it waits only for the turn, and gives way entirely when a sheet, practice, session, meditation or sleep starts.
- **The turn itself**: whole turns now (one, or three for the gown), so she ends facing the way she started with no snap. The frame that changes her clothes is drawn exactly edge-on whatever the frame rate (measured: width 0.03 at the swap). The gown turn takes about 2.3 seconds.
- **The blink**: her eyes always open again, even while another picture is still loading. Switching blinking off also stops a queued second blink. The closed-eye copies were remade with wider eye areas (no iris crescent or lash ends left on the tudung or the blue kebaya) and saved losslessly. So no pixel outside the eyes changes: a lossy copy made the kebayas' batik shimmer during a blink. They are about 190 KB each, and only the outfit she wears is fetched.
- **Tests**: the smoke now keeps blinking on through the twirl checks. It asserts that she ends idle, facing the same way, with no leftover transform, and it times the gown turn. It covers a floor tap mid-turn, a pose mid-turn, and reduced motion with blinking asked for. The birthday card check proves the turn finished.

## Codex verification (21 Oct, night)

Codex checked the fixes above against 2204d43: ten of the eleven were fixed, and the blink art was not clean enough (HOLD). Its full sweep found one P1, two P2 and six P3 problems. Fixed here:

- **A cut turn** (a walk, a pose, another outfit asking for her) now ends without the wardrobe's closing line, hop or sound. Before, a cuddle during the gown turn showed "Starlight, just for you." over the cuddle (P3), and the smoke's pose check failed the same way.
- **The walk home after a sheet closes waits while she arranges her things** (P2): Arrange hides the sheet, so it looked like a free room.
- **The wardrobe line after an outfit change without a turn** is a tracked timer. It belongs to its own picture, and a new turn clears it, so it can no longer end a newer gown turn early (P3).
- **A closed-eye picture that failed to load** is dropped and asked for again at the next blink, instead of switching off that outfit's blink until a reload (P3).
- **A new outfit mid-walk** drops the old walk strip at once. The walk shows the new strip when it is ready (P3).
- **The smoke's twirl samples** treat a closed-eye frame after the turn as the same outfit, so a correct blink can no longer fail the check (P3).

Not fixed here, as they are older than this work and need their own changes: Everyday practice and a meditation can run at once, and Stop then hides the meditation's controls (P1). Changing clothes during an activity leaves her standing, or keeps old clothes on a seated or sleeping picture (P2). The closed-eye art still shows a rim and a lash stub on the tudung and pale repair rings on every outfit (P3). It needs an inpainted remake.
