# The drops: the Starlight gown and her birthday week (21 Oct 2026)

Jamie, on his 36th birthday: "We need to identify rhythme plus perks and set pricing ... Special drop down glamour dress to show off at the plaza, special birthday drop.. today is my birthday and I'm 36 this year and I think it's good to have some heartfelt advise and motivation in life. We could pull in YourdigitalDNA methodology in to calculate based on the user birthdate and have the cute report sent as postcard."

## The Starlight gown (the first wardrobe drop)

- One look: a floor-length lilac-to-blush ombré satin gown under sheer tulle, a bodice of tiny silver star sequins, a slim silver belt, silver heels; her own face, bun and star clip. Rendered in one guarded Seedream run (`scratchpad/gown/stand.sh`, then `batch.sh`: a lock, a `RUN_STARTED` marker, finished files skipped, no retries, stop on the first failure or any stderr): the standing sprite from the base avatar, then the nineteen action poses, meditate, sit and sleeping as two-reference edits (image 1 the pose, image 2 the gown), 23 renders of 30 to 40 seconds each, no failure.
- Fitting: every copy is keyed with the largest shape and fitted onto its base pose's canvas by figure height (`fit_all.py`). A skirt wider than the base canvas gets a **wider canvas, never a shorter figure**; those sprites carry their own `AVATAR_FIT` entry (width factor against the 318 px standing canvas, head-centre fraction measured on the head band and offset by 0.018 to match the hand-set table). The strip rule in `fitAvatar` knows the `-gown` suffix, so unwidened copies share their pose's numbers.
- In the wardrobe the gown is a **Rhythme Plus drop**: listed with a lock and the words With Rhythme Plus until Plus is on this phone (a preview code from You, or the account; the same `OvuPodcast.plusActive()` the podcast uses) or tester mode. Tapping the locked gown keeps her clothes and opens Rhythme Plus. `outfitLocked` also guards `setOutfit`, so a profile that still says gown after Plus lapses dresses her in the knit. The plaza look list (`ovu-friends.js` LOOKS) carries `gown`, and the server's look check (`^[a-z][a-z0-9-]{1,29}$`) accepts it.
- No walk strips yet: like the kebayas and the tudung, the gown falls back to the step bob while she walks. Three strips (side, away, towards) are one more guarded run when Jamie wants them.

## Her birthday week

- **The field**: a month and a day in You, optional, never a year. It is stored as `profile.birthday = 'MM-DD'`, cleaned on every read (29 February allowed; it falls on the 28th in other years), and no health screen reads it: no age, no cycle maths, no notes.
- **The day**: the room greets her ("Happy birthday, Mei"), a cake with balloons stands on her table for seven days (`prop-cake.webp`, drawn on every props render while the day is within the week and she is at home, not on a visit), and the postcard opens once, the first time the room is free that day (`state.birthday.shown` keeps the year, so a second open or a second phone that synced the state does not show it twice). Tapping the cake reopens it all week.
- **The postcard**: her name, the date in words, three warm lines, her year in Rhythme (days with a note, pauses with Erin, hearts earned in all, things harvested, plaza friends: only what this phone holds, zeros left out, a first birthday says next year's card will carry numbers), and one button, Wear the party outfit (the Starlight gown when Plus is on, the lilac tulle otherwise). No hearts: hearts are for logging, and a gift of hearts would turn a birthday into a reward.
- **The words**: fourteen lines written for this, the same set for everyone, three picked by a seed from the year and the date so each birthday reads differently and two people with the same birthday read the same card that year. None is advice about her health. The card says so: the same warm words go to everyone, the numbers are hers, nothing reads anything into her birth date.

## Why no birth-date reading

Jamie mentioned a "YourdigitalDNA" method that calculates from the birth date. I could not find a published method under that name (two web searches on 21 Oct found only general numerology services), and any reading that turns a birth date into statements about a person would sit inside a health app beside real records. The line this build keeps: nothing in Rhythme reads anything into her birth date. If Jamie wants that reading, it needs the source of the method, and a place clearly outside the health screens, labelled as a game, with no link to her diary. That is his call, not mine to improvise.

## Decisions this needs from Jamie

1. Plus itself: the Stripe account, GST status, the price (the proposal: S$4.90 a month or S$49 a year, no auto-converting trial), and Erin's commercial terms. Until Plus can be bought, the gown is reachable through a preview code (You, Rhythme Plus) and tester mode.
2. Whether the gown can also be bought one-off (the proposal: S$3.90 after a month) or stays Plus-only.
3. Whether to render the gown's three walk strips now (one more guarded run) or wait for the first paying drop.
4. The birth-date reading: leave it out (recommended), or name the method and a clearly separate place for it.
