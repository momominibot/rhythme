# The drops: the Starlight gown and her birthday week (21 Oct 2026)

Jamie, 21 Oct: "We need to identify rhythme plus perks and set pricing ... Special drop down glamour dress to show off at the plaza, special birthday drop.. I think it's good to have some heartfelt advise and motivation in life. We could pull in YourdigitalDNA methodology in to calculate based on the user birthdate and have the cute report sent as postcard."

## The Starlight gown (the first wardrobe drop)

- One look: a floor-length lilac-to-blush ombré satin gown under sheer tulle, a bodice of tiny silver star sequins, a slim silver belt, silver heels; her own face, bun and star clip. Rendered in one guarded Seedream run (`scratchpad/gown/stand.sh`, then `batch.sh`: a lock, a `RUN_STARTED` marker, finished files skipped, no retries, stop on the first failure or any stderr): the standing sprite from the base avatar, then the nineteen action poses, meditate, sit and sleeping as two-reference edits (image 1 the pose, image 2 the gown), 23 renders of 30 to 40 seconds each, no failure.
- Fitting: every copy is keyed with the largest shape and fitted onto its base pose's canvas by figure height (`fit_all.py`). A skirt wider than the base canvas gets a **wider canvas, never a shorter figure**; those sprites carry their own `AVATAR_FIT` entry (width factor against the 318 px standing canvas, head-centre fraction measured on the head band and offset by 0.018 to match the hand-set table). The strip rule in `fitAvatar` knows the `-gown` suffix, so unwidened copies share their pose's numbers.
- In the wardrobe the gown is a **Rhythme Plus drop**: listed with a lock and the words With Rhythme Plus until Plus is on this phone (a preview code from You, or the account; the same `OvuPodcast.plusActive()` the podcast uses) or tester mode. Tapping the locked gown keeps her clothes and opens Rhythme Plus. `outfitLocked` also guards `setOutfit`, so a profile that still says gown after Plus lapses dresses her in the knit. The plaza look list (`ovu-friends.js` LOOKS) carries `gown`, and the server's look check (`^[a-z][a-z0-9-]{1,29}$`) accepts it.
- No walk strips yet: like the kebayas and the tudung, the gown falls back to the step bob while she walks. Three strips (side, away, towards) are one more guarded run when Jamie wants them.

## Her birthday

Jamie, later on 21 Oct: "I just want a birthing wishing with a good life advice direction based on the birthdate entered during onboarding."

- **Where she gives it**: the intro (Getting to know you) now has an optional step just before her name, "Your birthday (optional)": a month and a day, never a year. The same two selects sit in You for changes. It is stored as `profile.birthday = 'MM-DD'`, cleaned on every read (29 February allowed; it falls on the 28th in other years). Skip clears it.
- **Why no year**: Rhythme's notice and terms promise it never asks a date of birth ("your date of birth never is" in privacy.html; "never ask for your date of birth" in terms.html). A month and a day keeps that promise. The notice and the terms now each have a line for the birthday: a month and a day, never a year, on the phone only, used only for the card.
- **Where it is kept**: on this phone only. `ovu-sync.js` leaves it out of the cloud copy in both directions (`DEVICE_KEYS`), and no health screen, note, insight or relay reads it.
- **The day**: the room greets her ("Happy birthday, Mei"), a cake with balloons stands on her table for seven days, and the card opens once, the first time the room is free that day (straight away when she gives today's date). Tapping the cake reopens it all week.
- **The card**: her name and the date, **one warm wish** (fourteen written for this, the same set for everyone, one picked by the year and the date), and **a direction for the year ahead** read from her birthday the Pythagorean way: the digits of her birth month, her birth day and the year the birthday falls in, added and reduced to 1 to 9 (21 October in 2026 gives 5). Each of the nine years has a title, a line and a first step offered as an invitation ("A first step, if you like"), for example 5: "A year for change. Leave a door open for the unexpected... You adapt better than you think." The direction changes every birthday. Then Wear the party outfit (the Starlight gown when Plus is on) and Thank you. No hearts.
- **Honesty on the card**: a line says how the number is made (her birth month, her birth day and the year add up to it), that everyone with her birthday shares that direction this year, and that it is a reflection, not a prediction or health advice. None of the nine directions mentions health, and none is an order.
- **Not used**: YourDigitalDNA's BaZi Day Master needs the birth year, so it would break the promise above; its engine and its copy stay in its own private repository.

## Decisions this needs from Jamie

1. Plus itself: the Stripe account, GST status, the price (the proposal: S$4.90 a month or S$49 a year, no auto-converting trial), and Erin's commercial terms. Until Plus can be bought, the gown is reachable through a preview code (You, Rhythme Plus) and tester mode.
2. Whether the gown can also be bought one-off (the proposal: S$3.90 after a month) or stays Plus-only.
3. Whether to render the gown's three walk strips now (one more guarded run) or wait for the first paying drop.
4. Whether the new birthday lines in the notice and the terms need a new notice version (the birthday is optional, explained where it is asked, and stays on the phone).
