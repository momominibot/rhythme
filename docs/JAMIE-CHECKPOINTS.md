# Jamie's checkpoints (how Rhythme is judged, in his words)

Jamie, 19 October 2026: "Remember to work through all processes thoroughly and autonomously step by step, don't rush
to complete the work. Whatever I have pointed out will be your checkpoints to make sure it's done. Document it so you
will know my style and expectations and each implementation you will go through those pointers." This file is that
list. Every change walks it before a push; `tools/checkpoints.sh` asks jev the same questions about a change summary.

## The aim

- Rhythme collects menstrual, sleep and wellness data points. Logging is the point; every log earns hearts, and hearts
  are spent in the game. Nothing in the game may get in the way of logging.
- The game is a Harvest Moon kind of life: small cute details, an avatar who can fish, pick eggs from a hen, visit a
  hot spring and cook the egg there, plant vegetables and fruit and watch them grow day by day. "I'm a person who is
  more than perfection": adopt good constructions from games outside, and suggest them.

## Style

- Decide, build, verify, show. Screenshots at phone width, or a frame strip. Never "will do later" without a queue.
- Warm plain copy, no em dashes, no vendor or model names inside the product, no clutter on the plate.
- One step at a time, each one checked end to end (core suite, static check, smoke suite, a Playwright drive of the
  live site), with a design note and a Codex read-only review before anything non-trivial.
- Document every pointer here, every lesson in the vault, every reusable method in memory.

## Pointers so far (each is a checkpoint)

1. No walk toggle; tap the floor to walk; keys still work on desktop.
2. She walks normally, a real eight-frame cycle in her own outfit; no hopping. Nothing changes her outfit by itself.
3. The pets walk normally too (their own cycles) and wander, never through furniture, the pond or the plot.
4. The screen follows her as she walks; outdoors and in stores the view is closer, like a game. Home shows the whole
   room so every hotspot stays a tap away (Jamie may change this).
5. Stores: no plaques on the street; an attempt to go in shows that store's own hours; the three stores keep different
   hours and carry their own names (Whisker & Paw, The Cosy Nook, Moonrise Homes), not "Dream Street".
6. Items in stores stand on surfaces, placed nicely, no price chips; bought things leave the shelf for the inventory.
7. Watering: Erin's lines all play (one audio element, unlocked by the tap), she stands at the plot, hearts after
   every completed minute.
8. She never steps over objects: every walk of hers is routed around furniture, the pond and the plot.
9. Erin's voice must be continuous in every mindfulness practice, not intermittent.
10. Breathing guidance must complete its cycle: breathe in, then out; never leave a person holding a breath.
11. Every (i) information button must do something.
12. She sits on chairs and benches with a seated pose, legs down; the cross-legged meditation pose belongs to the mat.
13. Every chair offers a different kind of mindfulness, so each seat feels fresh.
14. Text size is adjustable in settings; the words are small to Jamie.
15. Herbs and teas with real evidence, for ovarian and mental health, with cautions.
16. Character creator: four hairstyles, different hair and eye colours, four skin tones. (Queued, design first.)
17. Plaza with servers, capacity, real-people counts, topic channels and round-the-clock hosts with a light Singapore
    voice, one sentence in ten. (Design note written, nothing built.)
18. Points once a person has logged, so they can spend them in the game.
19. At most two pets at home at a time.
20. The points system distributes hearts wisely: encourage daily logging, keep people for at least a month, support a
    weekly content drop; discussed with Codex before changing the rules (docs/design/2026-10-19-points-economy.md).
21. Erin's lines in every practice play on one audio element unlocked by the tap, with a guard so a stalled clip never
    holds the script.
22. Hearts never reward volume, edits, outcomes, consent or disclosure; one award per domain per date, a central daily
    cap, free forgiveness (the economy review).
23. Reminders and a home-screen widget: a web app cannot ring an alarm or draw a widget on an iPhone; those need a
    native shell. (Explained to Jamie 19 Oct; the shell is a proposal.)

## Walking the list

Before each push: read this file, mark which pointers the change touches, and for each one say in the hand-over how it
was verified (which test, which screenshot). A pointer that cannot be verified is reported as not done, not as done.
