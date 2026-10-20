# Light Flower and the sound kit (20 October 2026)

Jamie asked for "another mindfulness tapping game apart from koi" with "cute relaxing sound", then "cute sitting and activity sounds like animal crossing / harvest moon", with a picture of a glass flower made of light. Codex (gpt-6-astra, read-only, with the repository) proposed the design; its full answer is in `docs/debate/2026-10-20-light-flower-codex.md`.

## Light Flower (`ovu-lightflower.js`)

- **Mechanism:** attention and listening. A tap lights one petal and sounds one soft glass note; she notices it fading and gently returns when her mind wanders. Chosen over two other Codex concepts (kindness phrases on petals, a body-noticing petal walk) because sound is part of the practice and it differs clearly from Koi Pond's paced breathing.
- **Nothing to win:** the flower is whole from the start; nothing fills, grows, counts or scores. Watching quietly works too.
- **Light safety:** a petal brightens over 300 ms and settles over four seconds; a new petal can light at most every 400 ms; tapping a petal that still glows holds its brightness instead of re-flashing. Reduced motion: no drifting light.
- **Time:** Open by default, or 2 or 5 minutes. Stop, Escape, leaving the app and a real sleep all end the session once and save the practice time (`mindfulness` entry, kind `lightflower`: seconds, minutes, planned, completed, startedAt, endedAt; no tap count). A failed save keeps the time on screen with Try again.
- **Hearts:** the existing flat practice thank-you (2 hearts) once a session reaches a full minute, within the 6 a day practice cap. No streaks.
- **After:** the mindful moment `lightflower` (she listens, in her own outfit) with a line about noticing.
- **The picture:** the flower is drawn in code from points of light (petals traced with glowing dots and veins, a golden heart with stamens, a stem and leaf, drifting bokeh, slow star glints). A Seedream render of the reference was tried once and refused: the Volcengine Ark account has an overdue balance (HTTP 403 AccountOverdueError, 20 Oct 12:20 SGT). Per the batch rule it was not retried and no other provider was used.

## The sound kit (`ovu-sound.js`)

- **All sounds are synthesised in the browser** (Codex's recommendation): no recordings, so no licence to track and nothing to download. A D major pentatonic scale, soft sine and triangle tones, a two-second generated echo at 12 percent, and an optional pad of air.
- **One switch:** `S.state().sound`. **Departure from Codex:** Codex suggested sound off at first run; Jamie asked for sound, so a profile that never chose counts as on, at a quiet default volume (25 percent of the slider). Anyone who switched sound off stays off. The window card has the switch and a volume slider. No sound bypasses the switch any more.
- **Never annoying:** each sound has a minimum gap (flower note 1.2 s, footsteps 150 ms, taps 120 ms) and the flower note keeps at most two voices.
- **Cute activity sounds** (Animal Crossing and Harvest Moon spirit): footsteps that follow the ground (wood indoors and in shops, grass in the garden and farm, stone on the street and plaza), a cushion poof when she sits on a bench or the mat, a ding-dong at doors, nom nom for food and tea, a dig for planting and weeding, a sprinkle for watering, a bloop and sparkle for the harvest, a coin at the shop, a pyon for pets, a page for reading and writing, a swish for clothes, a greeting boop in the plaza, and a rising three-note sparkle when something is saved. Logging moments (period, symptoms, weight) stay quiet apart from the save sparkle.
- **Measured** with an OfflineAudioContext in Chromium: every sound peaks between about -27 and -38 dBFS at the default volume, nothing clips.

## Not built

Background music. Generated loops (for example Higgsfield's music model) are possible later with a rights check; the kit's optional air pad covers calm background sound for now.
