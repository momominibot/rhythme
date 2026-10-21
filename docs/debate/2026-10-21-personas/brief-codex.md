You are reviewing Rhythme today, 21 October 2026: a Singapore women's cycle and wellbeing web app for adults 18+ (vanilla JS PWA, local-first; room.html, room.js and ovu-*.js in this folder). It is also a cosy life-sim: a dream room, a garden with a greenhouse, a farm with a barn, a harbour, Dream Street with three shops, Harbour Lane, a community plaza, pets, and an avatar who walks and acts. Read-only: do not edit files. Read the code, do not guess, and cite file:line for every claim about what the app does.

The four-persona walk of 20 October and the decisions taken from it are in docs/debate/2026-10-20-four-personas.md. Since then these were added; walk EACH of them end to end as your persona:
1. Sign in first: the welcome is a sign-in wall (Apple, Google, email code) and nothing opens without an account (room.js boot and showWelcome, ovu-auth.js, appnav.js, the tail of ovu-store.js; privacy.html, terms.html).
2. Sleep details and the two-week sleep check (room.js openSleepCheck, the Record a night and Wake sheets; ovu-evidence.js E73 to E79; docs/design/2026-10-21-sleep-notes.md).
3. Erin's morning: wake, brush, sip, one journey with skippable parts (ovu-morning.js, ovu-rewards.js practicePoints; docs/design/2026-10-21-erin-morning-routine.md).
4. The barn, Clover and the hens, treats from the basket, and the hidden starry spring (ovu-barn.js, ovu-care.js, ovu-tones.js).
5. The harbour with catch-and-release fishing and the catch book (ovu-harbour.js; docs/design/2026-10-21-harbour-and-fishing.md).
6. Seats: every bench its own practice in Erin's voice and its own weather; the cave seat is a tone (ovu-seats.js, ovu-tones.js; docs/design/2026-10-21-seats.md).
7. Luna as the soft crescent again, the food pictures in the Ideas pane, the map showing only the world overview (ovu-mascot.js, assets/data/ovarian-foods.json, ovu-map.js).
8. Harbour Lane from the harbour's signpost: Hay & Harvest (seed packs, new crops, the seed swap), Petal & Thread (fitting room, a rail waiting for art), Tideline Gym (free stations that open the movement log), Bait & Fin (float colours, the catch book), the post box (a kind postcard through Plaza friends, letters to future you sealed until their day) (ovu-lane.js, ovu-farm.js swapSeed; docs/design/2026-10-21-harbour-lane.md).
Also say plainly if anything decided on 20 October has slipped back (a streak, a bonus, a red flag no longer raised, an outfit lost in a pose, wording that judges).

The owner's requirements: EVERY activity instils mindfulness (a brief, non-preachy moment of noticing, breath or kindness that fits it) and shows an ACTION FROM THE AVATAR in her own outfit. No streaks, guilt or pressure. Hearts are earned for logging data only; practice earns a small flat amount; care and health features never cost hearts; game actions never write a diary entry.

Write these sections:
1. For each of the eight, a row: what happens today for you (file:line); the mindful element today (quote it, or "none"); the avatar's action today (file:line, or "none"); what is wrong, unsafe, misleading or missing for YOU at your life stage; a proposed mindful line exactly as it should appear (at most 18 words, warm, plain English, no em dashes, no medical claims); a proposed avatar action (an existing pose, or a NEW pose described in one line for an illustrator).
2. Safety: every red flag at your life stage that these eight touch (sleep, movement at the gym, the morning routine, the post box letters), whether it is escalated today (file:line), and the exact wording you would want. Singapore context: 995, polyclinics, KKH, NUH, SOS 1767, mindline 1771.
3. Your top ten concrete fixes, ranked, each tied to a file and function, with the exact change.
Rules: cite primary sources with URLs for any clinical statement (NICE, RCOG, ACOG, The Menopause Society, WHO, Cochrane, Singapore MOH/HPB/HealthHub, KKH, NUH, peer-reviewed); label anything unverified; plain English; no em dashes; at most 2200 words; markdown.

Your persona:
