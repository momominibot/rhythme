**The main gaps match Jamie’s concerns:** many activities are silent of Erin’s voice, several replace interaction with a progress bar, important features still leave the room, and cave sitting requires sound. There are also reproducible activity, saving and reward defects.

Audited checkout: `3d3ecd6`. No files changed. The existing core suite passed **1,376 checks**, but targeted in-memory probes reproduced additional defects below. Browser launch and localhost serving were blocked by the read-only sandbox, so rendered overlap, audible playback and final phone positioning remain unverified. “Voice wired” means the code references a recording and the expected file exists.

**Coverage**

| Area | Hotspots, sheets and controls traced |
|---|---|
| Room, house, bathhouse, family home, visiting homes | Bed, clock, calendar, computer, wardrobe, diary, mat, window, coach, bath, fridge, sofa, stove, home previews and return controls. |
| Core sheets | Sleep/check, reminders, cycle/symptoms/rhythm, food search/scan/photo/ideas, Learn folders/videos/wallpaper, wardrobe, weight, You, choices, imports, export/delete, Luna, podcasts, Plus, acupressure, onboarding and care cards. |
| Garden | Gate, bench, watering plot, pond, greenhouse, street arch and farm path. |
| Greenhouse | Plant cards, four herb planters, planting/watering/picking/clearing, care minute, brewing and research disclosures. |
| Farm | All 12 beds, shared bed pickers, guide, shed, seeds/tools, well, can, harvest basket, cooking/meal handoffs and paths. |
| Barn and interiors | Yard, Clover’s stall, hen house, both hens/nests, brushing, treats, milk, eggs and discovery crack. |
| Cave/spring | Warm stone, crystals, tone settings, spring basket, cooking sequence and completion. |
| Dream Street and shops | Street doors/bench/hours; pet, furniture and property interiors; merchandise, adoption, placement, visits and moving home. |
| Plaza | Fountain, noticeboard, tea stall, both benches, sample neighbours, visits, groups, cards, friendship requests, notes and boundary controls. |
| Harbour | Fishing spots, cast/bite/lift/release, catch book, bench, hut and Harbour Lane signpost. |
| Harbour Lane | Grocer, boutique, gym, fish shop, post box and future letters. **These are sheets, not walkable scenes.** |
| World map | Current place, exits, directions, nodes, fog, zoom, drag and pinch. |
| Pets and practices | Feeding, play, cuddle, treats, tidying, dressing, walking, sleep; mat sessions, Everyday, Morning start, seated practices, Koi Pond and Light Flower. |

Linked standalone pages were inventoried as exits. Their full medical content was not clinically re-audited.

**P1: routes that leave the room**

| Location | Exit or broken route | What to do |
|---|---|---|
| `room.html:41`, `room.html:42`, `room.html:76`, `room.html:81` | Journal icon, doctor-share icon, **See all notes**, **Dr shares card** and **Doctor view** navigate to `journal.html`, `journal.html#share` or `doctor.html`. `room.js:3110` explicitly preserves these destinations. | Open journal and sharing within the room shell. Keep the standalone clinician viewer available for actual recipients. |
| `room.js:136`, `room.js:1347` | Learn → Cycle basics leaves for `hormones.html` and `period-start.html`. | Render the reading inside an in-room reader. |
| `room.js:137`, `room.js:1347` | Learn → Fertility leaves for `fertility.html`, `journey-grow.html`, `ovarian-health.html`. | Use the same reader. |
| `room.js:138`, `room.js:1347` | Learn → Life chapters leaves for `life-journey.html`, `journey-nurture.html`, `journey-peri.html`, `journey-post.html`. | Keep chapter navigation inside the reader. |
| `room.js:139`, `room.js:140`, `room.js:142`, `room.js:144` | Other desk folders leave for `foods.html`, `medas14.html`, `mental-health.html`, `face-ppg.html`, journal sharing and Doctor view. | Mount these features in the room shell instead of navigating the document. |
| `room.js:136`, `room.js:140`, `room.js:1347`, `room.js:3116` | Desk **Your cycle** and **Mindfulness hub** are ordinary `room.html#…` links. Hash routing runs only at boot; there is no `hashchange` handler. From an already open room, they can change the URL without opening the requested sheet. | Dispatch directly to `goTab()` rather than relying on the fragment. |
| `room.js:1504`, `room.js:1507` | You → journal, sharing, Evidence, Privacy and Terms leave the room. | Use in-room record, evidence and legal readers. Preserve the complete legal text. |
| `room.js:1588` | Imported-data **journal** buttons assign `location.href = 'journal.html#…'`. | Open the matching journal filter in-room. |
| `room.js:1867` | Luna’s three suggested questions leave for `stress.html`, `hormones.html`, `foods.html`. | Open the corresponding reading beside Luna. |
| `room.js:2889` | Window → **Settings & health connections** and **Calm check** leave for `settings.html` and `face-ppg.html`. | Open these within the existing shell. |
| `room.js:2906`, `room.js:2920`, `ovu-orb.js:568` | Avatar journal action, care-card **Show my chart**, and an Orb journal link leave for `journal.html`. | Route to the in-room journal. |
| `room.js:226`, `room.js:2383`, `room.js:2436`, `ovu-rhythm.js:112`, `ovu-garden.js:261` | Guide, movement, acupressure, rhythm and herb citations open `evidence.html`, often in another tab. The small information button only reveals links; it does not intercept navigation. | Open the cited evidence entry as a nested in-room detail. |
| `room.js:140`, `room.js:2140`, `room.js:2154` | Erin essay, publication and episode-post links open Substack externally. | Keep listening and notes in the room; clearly label any optional original-post exit. |
| `ovu-harbour.js:162`, `ovu-greenhouse.js:346`, `room.js:202` | Fish facts, plant-safety sources and HPB terms open external sites. | Show the source summary in-room, with an explicitly labelled optional original-source link. |
| `room.html:126`, `room.html:164` | Sign-in and consent Privacy/Terms links replace the current page. | Present full notices in a reader that returns to the exact unfinished step. |

Emergency telephone and care-service links should remain deliberate external actions. They should not be trapped inside an app reader.

**P1: broken behavior and record integrity**

| Location | Confirmed defect | What to do |
|---|---|---|
| `room.js:2097`, `room.js:2106`, `room.js:2114` | **A stopped session can continue inside its replacement.** Delaying an Erin greeting, stopping, starting Just breathe, then resolving the old clip produced `greeting_morning:erin → meditation_begin:breathe → breathing_in:breathe`. Old callbacks use global `session` and can finish the wrong run. | Capture a run identity. Check it before every clip, wait, caption and save; cancel and settle outstanding waits. |
| `room.js:2520`, `room.js:2533`, `room.js:2596`, `room.js:2604` | **Everyday has the same stale-run defect.** A delayed old clip subsequently schedules old steps against the new practice. Reproduced with the extracted real runners. | Bind the entire chain to its originating practice object. |
| `ovu-garden.js:139`, `ovu-garden.js:154`, `ovu-garden.js:298` | **Garden watering continues over another activity.** It does not cancel on `activity` or `beforeWalk`. The captured 60-second callback still saved a minute, hid the HUD and restored the avatar while the new session remained active. | Cancel synchronously when walking or another activity starts. Only the current owner may change HUD, pose or Stop. |
| `ovu-garden.js:166`, `ovu-greenhouse.js:407` | Garden and plant animations automatically create `mindfulness`, `minutes:1`, `completed:true` records without Save/decline. The garden overlap above can make the recorded completion demonstrably wrong. | Keep game progress separate; ask whether the person actually practised before writing a health-journal entry. Reuse the seated-practice confirmation pattern. |
| `ovu-lightflower.js:156`, `ovu-lightflower.js:167`, `ovu-breathtap.js:178`, `ovu-breathtap.js:183` | Stopping or hiding these games automatically writes mindfulness records. Light Flower saves from one second onward. | Offer **Save this as practice** separately from ending the game. Do not silently turn game engagement into confirmed practice. |
| `room.js:835`, `room.js:2118`, `room.js:2120` | Bedtime bypasses the normal one-minute threshold by calling `finishSession(false)`. A few seconds become at least **0.5 minutes**, potentially earning hearts. This path also fails to pause the old audio or clear its timer before clearing `session`. | Use one cancellation/save policy for Stop and bedtime. Stop all media and timers before entering night. |
| `ovu-rewards.js:149`, `ovu-rewards.js:154`, `ovu-store.js:323` | **Failed purchases remain in memory.** A quota-failure probe showed 40 hearts plus a plant in memory, versus 100 hearts and no plant persisted. A later unrelated name save persisted the failed purchase. | Clone the ledger, calculate the complete change, then use rollback-capable `commit()`. Audit other reward mutations using the same live-object pattern. |
| `ovu-farm.js:92`, `ovu-farm.js:97`, `ovu-farm.js:472` | Free-seed collection mutates seeds and the daily allowance before saving. A failed write left one seed and one claim in memory while persisted data remained unchanged. The handler does not catch the error. | Commit a copied farm atomically and retain the unused allowance on failure. |
| `ovu-community.js:103`, `ovu-community.js:140` | **Say hello** and **Pin it** have the same failed-save mutation problem. A later successful save can persist an action that previously threw. | Copy community state, commit it and preserve entered text on failure. |
| `ovu-rewards.js:110`, `ovu-rewards.js:125` | **Reward receipts can persist without the reward.** Failing the second award write left `hearts:0` with a receipt. After reload, retry returned `again:true` and zero points. Reproduced using the actual store and reward modules. | Commit receipt, points and daily entitlement together. Distinguish “entry saved” from “reward failed.” |
| `room.js:2616`, `room.js:2617`, `ovu-mindful.js:192` | **Confirming an Everyday practice closes the prompt before saving.** A forced failure persisted `explored.plants:1` with zero events and left no confirmation payload to retry. | Keep the prompt and pending practice until a verified save succeeds; commit completion state and event together. |
| `room.js:1235`, `room.js:1238`, `room.js:1245` | **An old food photo can populate a new meal.** Recognition and shrinking use global `draft` without checking its identity. An isolated probe resolved an old photo after replacing the draft and inserted the old food into the new meal. | Capture the draft and originating UI; reject stale results in every asynchronous continuation. |
| `ovu-breathtap.js:183`, `ovu-breathtap.js:188` | A failed long-session save is described as a short pause that was not saved. The recoverable payload is discarded. | Say **Your pause could not be saved**, retain it and provide Retry. |

**P2: missing or confusing activities**

| Location | What exists now | What to build |
|---|---|---|
| `ovu-harbour.js:130`, `ovu-harbour.js:146` | **Cast → fixed seven-second wait → Lift gently whenever wanted.** The bite never expires; there is no player-controlled reel. | Aim and release to cast, vary the wait, show a clear bite, then let the player reel with a gentle hold or several inputs. Animate rod, line and release. Include an untimed alternative. |
| `ovu-farm.js:335`, `ovu-farm.js:406` | Drawing water, planting, weeding and watering mostly run short automatic bars. Harvesting is immediate. | Lift the bucket, place/cover seeds, tug weeds, pour onto soil and pick produce into the basket. Give each action a responsive object animation and simple-control alternative. |
| `ovu-barn.js:232`, `ovu-barn.js:234` | Brushing is a three-second bar; milk automatically fills a pail. | Brush with slow strokes and visible animal response. Alternate gentle squeezes to fill the pail. |
| `ovu-barn.js:202`, `ovu-barn.js:211` | One button collects all available eggs automatically. No dedicated petting interaction. | Pick up each egg and place it in a basket. Add gentle petting and a hen approaching an offered treat. |
| `ovu-barn.js:150`, `ovu-barn.js:163`, `room.css:1958` | Hens and Clover stay at fixed coordinates. Hens only squash/stretch by about 1.2%. | Add bounded wandering, pecking, turning and resting. Give Clover a small stall movement cycle. |
| `ovu-barn.js:264` | Spring eggs automatically lower, steam and lift after one tap. | Let the player lower the basket, observe the steam cue and lift it themselves. Cancellation must preserve ingredients. |
| `ovu-greenhouse.js:374`, `ovu-greenhouse.js:390` | Care and brewing are four captions over a minute with bells. | Choose a tool, pour/wipe/touch, and show a plant response. Brewing should include ingredient selection, pouring and lifting the cup. |
| `ovu-kitchen.js:147`, `ovu-kitchen.js:152` | Cooking is four automatic 15-second bars. Wash/Chop/Smell/Taste are headings. | Wash, cut, stir and plate through explicit actions. Consume ingredients only after the full dish completes. |
| `room.js:473` | Feed, play and cuddle immediately update state, then apply a brief animation. The ball is decorative. | Place a bowl, aim/release a ball that the pet fetches, and stroke to cuddle. Existing pet following already provides genuine movement. |
| `room.js:597` | A bathtub labelled **a mindful soak** opens the standing Showering guide. | Add a seated soak action and matching guidance, or accurately relabel the existing behavior. |
| `ovu-community.js:151` | **Sip one slowly** changes a pose/toast without selecting or handling a cup. | Select, pour, steep and lift a pictured cup. Keep this separate from real food/hydration records. |
| `ovu-community.js:11`, `ovu-community.js:103` | Sample villagers stand/bob, repeat one line, accept a daily hello and allow visits. | Add short routes, changing conversations, remembered friendship moments and gifting. Real-account friendships are a separate system. |
| `ovu-lane.js:138`, `ovu-lane.js:313` | Harbour Lane and its shops are menu sheets. There is no lane layout, shop-door traversal or map node. | Build the walkable lane and interiors; retain sheets for item details. |
| `ovu-lane.js:228`, `ovu-lane.js:233` | Gym stations only select an activity in the real movement form. | Add optional in-world exercise animations. Keep **Log real movement** separate so play never invents exercise minutes. |
| `ovu-tones.js:86`, `ovu-tones.js:110`, `ovu-tones.js:112` | **Silent cave sitting is unreachable.** Warm stone and crystals both require successful tone playback; stopping sound stands her up. | Give the warm stone **Just sit**. Make crystals optional sound, and let sound stop without ending sitting. |
| `room.js:2264`, `room.js:2265`, `room.js:2106` | “4-4-6” actually runs four seconds in/six out, without a hold. “5 min, silent” still rings each inhale. | Make labels and sound configuration match actual behavior. |
| `room.js:2441`, `room.js:2146` | Delayed acupressure/podcast loading can open its sheet after the user has moved elsewhere. | Check navigation identity before displaying a resolved sheet. |
| `ovu-lane.js:142`, `ovu-lane.js:218`, `ovu-lane.js:249` | “Everything in it works” sits beside disabled outfits/aquarium and internal “next art run” language. | Remove unavailable purchase controls or present clear pictured previews. |
| `ovu-garden.js:134`, `ovu-rewards.js:83`, `ovu-rewards.js:143` | Garden says repeats “will not add hearts twice,” but repeated garden, greenhouse and tea practices each returned **`[2,2,2,0]`**. | Add an activity-specific daily entitlement. The six-heart cap prevents unlimited earning but does not prevent repeated payment for the same activity. |
| `ovu-garden.js:214`, `ovu-garden.js:302` | The seated avatar has `role="button"` and keyboard focus but no Enter/Space activation. | Use a native button or implement both activation keys. |

**P2: Erin voice coverage**

`room.js:2496` is the central gap: `moment()` displays text, changes a pose and plays synthesized effects. **It never plays Erin audio.** Shared care uses it at `ovu-care.js:27`, so mindful text and chimes do not satisfy the voice requirement.

| Activity | Voice currently wired |
|---|---|
| Good night / opening Wake | Yes: `room.js:720`, `room.js:734`, subject to audio settings. |
| With Erin, three/six minutes | Yes: `room.js:2055`, `room.js:2097`. |
| Everyday wake, teeth, shower, coffee, dishes, outfit, bed, plants, pets, stretch | Yes: `room.js:2587`, `room.js:2601`. All 96 expected step files exist. |
| Morning start and short-pause alternative | Yes when voice is enabled: `ovu-morning.js:183`, `ovu-morning.js:232`. |
| Garden watering minute | Yes: `ovu-garden.js:111`, `ovu-garden.js:115`. |
| Garden bench With Erin | Yes, through the room session runner: `ovu-garden.js:240`. |
| Street, both plaza benches and harbour guided practices | Yes: `ovu-seats.js:63`, `ovu-seats.js:141`. The seat handlers override the earlier bench handlers. |
| “A mindful cup with Erin” | Yes, through Everyday coffee: `ovu-garden.js:284`, `ovu-greenhouse.js:354`. |
| Listen with Erin | Erin’s podcast recording: `room.js:2143`. |

The following actions are **silent of Erin’s voice**. Suggested lines are proposed scripts, not generated recordings.

| Action | Location | Suggested line |
|---|---|---|
| Draw water | `ovu-farm.js:335` | “Feel the bucket’s weight as you lift it slowly.” |
| Pull weeds | `ovu-farm.js:410` | “One weed at a time. Notice the space you make.” |
| Plant crop, including from shed | `ovu-farm.js:412` | “Set the seed down gently, then cover it with soil.” |
| Water one bed / bulk water | `ovu-farm.js:411` | “Pour slowly and watch the soil grow darker.” |
| Harvest | `ovu-farm.js:406` | “Pause with your harvest and notice its colour.” |
| Take seeds / buy tool | `ovu-farm.js:472`, `ovu-farm.js:475` | “Choose something you would enjoy caring for.” |
| Plant herb | `ovu-greenhouse.js:464` | “Make a little space, then settle the herb into it.” |
| Water herb | `ovu-greenhouse.js:464` | “Let the water reach the roots, a little at a time.” |
| Pick herb | `ovu-greenhouse.js:464` | “Pick gently and notice what is ready.” |
| Clear planter | `ovu-greenhouse.js:451` | “Leave a little room for something new.” |
| Plant-care minute | `ovu-greenhouse.js:382` | “Choose one leaf. Let your attention rest there.” |
| Brew harvested cup | `ovu-greenhouse.js:390` | “Pour slowly and notice the warmth and colour.” |
| Collect eggs | `ovu-barn.js:211` | “Lift each egg gently from the straw.” |
| Brush Clover | `ovu-barn.js:232` | “One slow stroke at a time. Notice how Clover settles.” |
| Milk Clover | `ovu-barn.js:234` | “Move gently and notice the milk gathering.” |
| Give cow/hen treat | `ovu-barn.js:192` | “Hold your hand still and let them come to you.” |
| Lower spring basket | `ovu-barn.js:264` | “Lower the basket gently into the water.” |
| Wait for spring eggs | `ovu-barn.js:265` | “While the eggs rest, notice one quiet detail.” |
| Lift spring basket | `ovu-barn.js:266` | “Lift slowly and let the water fall away.” |
| Cast | `ovu-harbour.js:130` | “Let the line go, then let your shoulders settle.” |
| Lift / proposed reel | `ovu-harbour.js:147` | “A gentle lift. Stay with the movement of your hand.” |
| Let the bite pass | `ovu-harbour.js:149` | “Let this one pass. There is nothing you need to catch.” |
| Release fish | `ovu-harbour.js:167` | “Watch it return to the water.” |
| Begin cooking | `ovu-kitchen.js:144` | “One dish, one small action at a time.” |
| Wash | `ovu-kitchen.js:152` | “Notice the water moving over each leaf.” |
| Chop | `ovu-kitchen.js:152` | “Move carefully and feel the rhythm of your hand.” |
| Smell | `ovu-kitchen.js:152` | “Pause with the warmth and notice the scent.” |
| Taste / finish dish | `ovu-kitchen.js:152`, `ovu-kitchen.js:164` | “Take a moment to notice what you have made.” |
| Feed pet | `room.js:473` | “Set the bowl down gently and watch your friend.” |
| Play ball | `room.js:473` | “Let the ball go gently and share this little moment.” |
| Cuddle | `room.js:473` | “Offer a gentle touch and stay for a moment.” |
| Give pet treat | `room.js:466` | “Offer it slowly and give your friend time.” |
| Tidy | `room.js:455` | “One small kindness, done gently.” |
| Dress pet | `room.js:465` | “Choose a little detail that makes you smile.” |
| Walk together / home time | `ovu-petwalk.js:366`, `ovu-petwalk.js:383` | “Walk at your friend’s pace, then make room for rest.” |
| Change outfit | `room.js:1431` | “Choose what feels comfortable today.” |
| Adopt / buy / place / put away / arrange | `room.js:1787`, `room.js:1810` | “Make a little space for what feels like home.” |
| Visit / move home | `ovu-shops.js:169`, `ovu-shops.js:170` | “Take a moment to arrive.” |
| Buy seeds, staples, herb starts / seed swap | `ovu-lane.js:179`, `ovu-lane.js:187`, `ovu-lane.js:194`, `ovu-lane.js:202` | “Notice what you can share and what you would like to grow.” |
| Buy/use float | `ovu-lane.js:252` | “Choose a small colour that makes you smile.” |
| Gym station | `ovu-lane.js:231` | “Notice the movement, at a pace that feels comfortable.” |
| Say hello / visit neighbour | `ovu-community.js:102`, `ovu-community.js:107` | “A little hello can be enough.” |
| Pin note | `ovu-community.js:138` | “Let one kind thought rest here.” |
| Tea-stall sip | `ovu-community.js:151` | “Both hands around the cup. Notice its warmth.” |
| Fountain / garden pond | `ovu-community.js:154`, `ovu-garden.js:244` | “Watch one ripple widen, then disappear.” |
| Post future letter | `ovu-lane.js:286` | “A few kind words for the person you will be.” |
| Read / delete letter | `ovu-lane.js:303`, `ovu-lane.js:292` | “Meet your words gently. You can keep them or let them go.” |
| Join/leave group; card/request/accept/note | `ovu-plaza.js:223`, `ovu-friends.js:363`, `ovu-friends.js:411`, `ovu-friends.js:467` | “Choose the connection that feels right for you.” |
| Unfriend/block/report/turn friends off | `ovu-friends.js:420`, `ovu-friends.js:480` | “Your comfort matters. You can choose your boundaries.” |
| Just breathe / garden Orb | `room.js:2088`, `ovu-garden.js:232` | “Let your breath stay easy and comfortable.” |
| Acupressure | `room.js:2462` | “Let your hands rest gently. Stop if anything hurts.” |
| Light Flower | `ovu-lightflower.js:126` | “Light one petal and listen as its note fades.” |
| Koi Pond | `ovu-breathtap.js:108` | “Watch one ripple fade. Your breath can stay its own.” |
| Plain sitting outside the cave | `ovu-garden.js:211`, `ovu-seats.js:108` | Optional arrival cue: “Let the seat hold you. There is nothing to do.” |
| Save logs, reminders; scan/photo; Learn actions | `room.js:2496`, `room.js:2940` | “Thank you for taking a moment to notice.” |

Back, Close, Stop, map/zoom, shelf browsing and other navigation controls also have no Erin clips. If narrated, use short acknowledgements rather than replaying activity guidance. Preserve explicit mute choices. **Cave Just sit should remain genuinely quiet**, as Jamie specifically requested.

**P2/P3: phone copy**

Quoted excerpts identify the current text. Short versions below are proposed visible summaries. Full consent terms, source attribution and relevant clinical cautions should remain accessible inside the room.

| Rank | Location | Current copy | Shorter visible version |
|---|---|---|---|
| P2 | `ovu-mindful.js:18`, `room.js:2599` | “Good morning. Before moving into your day, let’s take a few moments to wake up with the body. You can sit on the edge of your bed, with your feet resting on the floor. Or, if you feel steady, standing beside your bed with your feet hip-distance apart. Keeping your eyes softly open. Allowing your posture to be comfortable and upright. Feeling the support beneath you.” | “Sit comfortably, or stand if steady. Notice the support beneath you.” Keep the original audio and optional transcript. |
| P2 | `ovu-plaza.js:218` | “Joining stores that your account is in this group, with the time you joined and last checked in, so you can be counted…” followed by a 175-word paragraph. | “Joining shares your chosen group with Rhythme and remembers it on this phone. Others see a count unless you enable Plaza friends.” Expand **What is shared and kept** before joining. |
| P2 | `ovu-friends.js:38` | “While you are in a plaza group, people in the same group who also turned this on can see your plaza name and look…” followed by a 98-word notice. | “People in your group can see your plaza name and look, request friendship and exchange preset notes. Your diary and account details stay private.” Keep full retention/deletion terms available. |
| P3 | `room.js:2565` | “Pick what you are about to do for real, press Begin as you start, and let the guide walk alongside you. The guides are spoken in Erin’s voice from interim scripts; her own written scripts will replace them one by one.” | “Begin as you start the real activity. Erin will guide you.” Move provenance into About. |
| P3 | `room.js:2569` | “Each completed practice earns 2 hearts, up to 6 a day. The point is not the points: it is two ordinary minutes, fully lived. Please only confirm practices you really did.” | “Save only what you really did. Practices earn 2 hearts, up to 6 a day.” |
| P3 | `room.js:2614` | “Save it if you really did it. A mind that wandered and came back still counts: noticing is the practice. This stays between you and your room.” | “Save it if you really practised. A wandering mind is welcome.” |
| P3 | `ovu-morning.js:160` | “Three short practices in Erin’s own words… Take one part or all three; any position is fine, and you can stop at any time.” | “Wake, brush and sip with Erin, or choose a short pause. Take any part and stop whenever you like.” |
| P3 | `ovu-morning.js:43` | “Choose a drink that is comfortable to sip… You can skip this part. No drink, fasting, or simply not wanting one are all fine reasons.” | “Have a comfortable drink ready, then tap Ready to sip. Skip whenever you prefer.” |
| P3 | `ovu-morning.js:166` | “Words by Erin Lee, voiced using her cloned voice with permission… one entry for each part you did… never a streak.” | “Saved only when you confirm, one entry per part.” Put attribution and rewards in About. |
| P3 | `ovu-farm.js:354` | “The shed gives free seeds each day… Draw water at the well… Water each planted bed once a day… Pull any weeds first…” across the four-step guide. | “Choose seeds, fill the can, then plant and water. Pull weeds before tending and pick ripe crops into your basket.” |
| P3 | `ovu-farm.js:397` | “Watering costs a little energy; a missed day adds nothing and takes nothing away. Each day a few beds need weeding before they can be tended. You need not tend every bed every day.” | “Pull weeds before watering. Missed days never undo growth.” Show energy beside the action. |
| P3 | `ovu-farm.js:457` | “The shed keeps the tools and gives out 3 seed packets a day, free… the rest is for your basket to show.” | “Choose up to 3 free seeds today. Use your harvest for cooking, treats or seed swaps.” Generate the allowance from state. |
| P2 | `ovu-farm.js:357`, `ovu-farm.js:488` | “Some of it is treats for the barn animals; the rest is yours to admire.” | “Cook with your harvest, offer animal treats, or swap it for seeds.” This also corrects stale instructions. |
| P3 | `ovu-farm.js:467` | “Seed packs and new crops to grow are at Hay & Harvest: down the steps to the harbour, then the signpost to Harbour Lane. It swaps three from your basket for a seed, too.” | “Find seeds and crop swaps at Hay & Harvest, beyond the harbour.” |
| P3 | `ovu-seats.js:124` | “A practice of a minute or more can be saved to your journal… practices share up to six hearts a day… Sitting is just sitting: nothing is counted…” | “Save a practice after one minute. Just sitting records nothing.” Put reward rules and voice credit under information. |
| P3 | `ovu-tones.js:77` | “Plain tones made on your phone: one pitch, with a quiet octave above it… Sitting and sound end when the time is up…” | “Keep the sound comfortable and stop if it bothers you or your ears ring. It makes no health promises.” Move technical details into information. |
| P3 | `ovu-kitchen.js:133` | “Cooking uses what the dish needs from the basket and the pantry. It earns no hearts, takes no energy and logs nothing for you.” | “Uses ingredients from your basket and pantry. Your health diary stays unchanged.” |
| P3 | `ovu-kitchen.js:142` | “Four short steps, about a minute. Stop at any time and nothing is used.” | “Four gentle steps. Stop anytime to keep your ingredients.” |
| P2 | `ovu-lane.js:142` | “The lane itself is still being drawn. Until then the signpost brings each place to you, and everything in it works.” | “Explore the shops here.” Remove the implementation commentary and inaccurate promise. |
| P3 | `ovu-lane.js:171` | “Three from your basket for one seed of any crop you grow, or a start of any herb. Herbs count too. A pumpkin counts as three.” | “Swap three crops or herbs for one seed or herb start. One pumpkin is enough.” |
| P3 | `ovu-lane.js:282` | “Kept on this phone only and sealed until the day it arrives. Luna never reads it, and it is never in a report.” | “Private on this phone until its arrival day. Never read by Luna or included in reports.” |
| P3 | `ovu-community.js:101` | “Neighbours are samples for now. Nothing here is sent anywhere, and visiting changes nothing of theirs or yours.” | “A sample neighbour. Visiting changes nothing.” |
| P3 | `ovu-community.js:137` | “Your notes stay on this phone until friends can join; then you will choose what to share. No likes, no counts, no feed.” | “Your notes stay on this phone.” |
| P3 | `ovu-plaza.js:210` | “The plaza has groups for everyone, for trying to conceive, for PCOS and for menopause… You are not counted in a group until you choose Join.” | “Sign in to find a group. You are counted only after choosing Join.” |
| P3 | `room.js:1765` | “Each kind of log earns once a day… Logging the same kind again… A finished practice… Weight never earns hearts… Hearts buy things…” | “Hearts buy things for your room and farm. Log what is true; each kind earns once a day.” Put amounts in a compact expandable table. |
| P3 | `ovu-rewards.js:23` | “Free: weigh-ins are a health feature, so they never cost hearts (Codex review, 20 Oct). Tap it to note your weight. Private, never judged, and no hearts for numbers.” | “Note your weight privately. Always free, with no hearts tied to the number.” Remove the internal review reference. |
| P3 | `room.js:1461` | “Weight shifts a kilo or two with your cycle, salt, sleep and water… If weighing yourself feels stressful, put the scale away…” | “Weight changes naturally and earns no hearts. Put the scale away anytime if it feels stressful.” |
| P3 | `room.js:776` | “Reminders live on this device and only fire while Rhythme is open… add the calendar file…” | “App reminders work while Rhythme is open. Add them to your calendar for alerts outside the app.” |
| P3 | `room.js:177` | “Foods are grouped by the nature, extent and purpose of the industrial processing…” followed by three large NOVA paragraphs. | “Explore processing patterns in the foods Rhythme can classify. Some dishes cannot be scored.” Keep coverage and uncertainty details available. |
| P3 | `room.js:194` | “Duration is bedtime to wake time… Quality is your own 1 to 5 rating… The optional sleep details…” | “Handwritten times show time in bed; quality is your own rating. Blank details stay unknown.” |
| P3 | `room.js:198` | “Eight questions about the last two weeks… There is no score. Some answers bring a note about when to see a doctor…” | “Eight questions about your sleep over two weeks, with no score. Some answers suggest when to seek care.” |
| P3 | `room.js:202` | “Nutrients are calculated as value per 100 g × grams you confirm ÷ 100…” followed by extensive database, licensing and estimation explanation. | “Check the food and grams before saving. Missing nutrients stay unknown.” Retain compact HPB attribution and expandable methodology. |
| P3 | `room.js:206` | “The next period is estimated from the average of your last logged cycles…” followed by fertile-window and backfill calculations. | “Dates are estimates from your records, never contraception. Review and adjust any filled days.” |
| P3 | `room.js:214` | “Regular sleep and wake times, water through the day, short movement breaks…” followed by reminder-delivery explanation. | “Choose reminders that suit your day. Rhythme does not track whether you followed them.” Keep delivery limits beside the calendar button. |
| P3 | `room.js:222` | “Luna tries her own simple rules on this phone first…” followed by note, AI, photo, portion and settings explanations. | “Luna starts with rules on this phone. Optional AI suggestions need your permission and confirmation.” Keep exact data-route details beside consent. |
| P3 | `room.js:2446`, `room.js:2459` | “Tap a number. Use a thumb or fingertip…” and “Your own fingers fit your own body…” | “Tap a point to find it. Use gentle pressure and stop if anything hurts.” Keep location instructions and relevant cautions with each point. |
| P3 | `room.js:2177` | “Purchases are not open yet. During this preview, an access code… opens Plus on this phone for 12 months…” | “A preview code opens Plus on this phone for 12 months. Contact the team if you change phones or clear the browser.” |
| P3 | `room.js:2891` | “Sounds are tiny chimes plus Erin’s good-night and good-morning lines…” followed by music, volume and playback rules. | “Sounds control chimes and greetings. Use the practice voice and music switches separately.” |
| P3 | `ovu-map.js:152`, `ovu-map.js:156`, `ovu-map.js:158` | Three separate explanations of exits, unknown places and the map not moving the player. | “Tap a place for directions. Pinch to explore.” |

Tea research needs the same treatment. At `ovu-community.js:149`, three fully expanded cards can contribute approximately **125 to 195 words**, before the introduction. Use the existing pictures, keep individual cautions visible and disclose research on demand.

| Location | Current excerpt | Shorter card summary |
|---|---|---|
| `ovu-herbs.js:9` | “Reviews of small trials found ginger capsules eased period pain… a fresh-slice tea… has not been tested the same way.” | “Research tested capsules, not this tea. Open research and safety.” |
| `ovu-herbs.js:12` | “One double-blind trial of chamomile extract capsules… tea has not been tested the same way…” | “The research concerns extract capsules, not this cup.” |
| `ovu-herbs.js:21` | “Two small trials in PCOS… cinnamon capsules… a sprinkle in tea is not the same dose.” | “Small studies tested capsules. A sprinkle in tea is different.” |
| `ovu-herbs.js:30` | “The trials used standardised saffron capsules, not tea…” | “Studies tested standardised capsules, not saffron tea.” |
| `ovu-herbs.js:33` | “A meta-analysis of small trials… mostly with capsules or extracts and mostly short term…” | “Research mainly concerns short-term use of capsules or extracts.” |
| `ovu-herbs.js:36` | “One eight-week double-blind trial of a standardised extract… Tea has not been tested the same way.” | “The study tested an extract, not this tea.” |
| `ovu-herbs.js:39` | “One small two-week trial of lavender tea… had no placebo cup.” | “The small tea trial had no placebo cup.” |
| `ovu-herbs.js:45` | “A review of twelve trials… the trials were small and uneven… Most used extracts or drops rather than tea.” | “Evidence is limited and mainly concerns extracts or drops.” |
| `ovu-herbs.js:48` | “A review of fourteen trials… small and at risk of bias, so the true effect is uncertain.” | “The true effect remains uncertain.” |

These are presentation reductions, not fresh clinical endorsements. Do not remove the existing pregnancy, allergy, medicine-interaction or other individual cautions.

**P2/P3: pictures, transitions and visual risks**

| Rank | Location | Finding and change |
|---|---|---|
| P2 | `room.js:2599`, `room.css:471` | Full recorded paragraphs are pushed into a HUD clamped to three lines. Muting Erin therefore hides much of the instruction. Show one short current cue with an optional transcript. |
| P2 | `room.css:1447`, `room.css:1450`, `room.css:1472` | Koi/Flower setup uses a centered card without a height cap or scrolling, inside an overflow-hidden screen. Expanding instructions can make Begin/Close unreachable on a short phone. This is a source-backed risk requiring rendered confirmation. |
| P2 | `ovu-lightflower.js:66`, `ovu-breathtap.js:38` | These remain in the document but abruptly replace the cosy room with a full-screen dark canvas. Preserve the room context during entry/exit and use a deliberate transition. |
| P2 | `room.js:1788`, `room.js:1805` | Home changes from the shop sheet can use direct `applyLayout()`, while shop-interior paths use the travel fade. Route both through one transition. |
| P2 | `appnav.js:24` | Jumped-to legacy pages rebuild a four-tab navigation, dropping the current room’s Cycle/Body tab. Keeping features in the room shell resolves this discontinuity. |
| P2 | `ovu-kitchen.js:130`, `ovu-kitchen.js:165` | Recipe buttons and completed dishes have no food pictures. Add consistent thumbnails and a plated result. |
| P2 | `ovu-community.js:149` | Tea-stall cards discard existing herb `img` fields and show material icons. Render the supplied pictures. |
| P3 | `room.js:1057`, `assets/data/ovarian-foods.json:67` | Ten Food Ideas lack pictures: Ginger, Chamomile Tea, Bone Broth, Beetroot, Citrus, Quinoa, Cinnamon, Sesame Seeds, Green Tea and Mushrooms. Supply matching images instead of emoji fallbacks. |
| P3 | `room.css:91`, `room.css:100` | Daytime hint dots are fully opaque white/lilac with perpetual halos. Only quiet/night reduces opacity. Subdue the visible dots while retaining the 44px hit area and clear focus state. |
| P3 | `ovu-garden.js:78`, `ovu-garden.js:184` | The garden bench hard-codes left-facing seating. The asset faces front-left. This establishes the configuration, but does not prove the rendered orientation is correct. Check hips, feet and facing against the plate before changing the flip. |
| P3 | `ovu-map.js:100`, `room.css:1344` | At initial map scale `0.5`, 44px node controls shrink to roughly 22px; names and “You are here” also disappear. Keep touch targets and essential labels outside the scaled layer. |
| P3 | `ovu-lane.js:160` | Grocer combines seeds, unlocks, staples, herb starts and swaps in one long sheet. Use pictured Seeds/Pantry/Herbs/Swap sections. |
| P3 | `ovu-barn.js:185` | Pantry/device-storage text repeats across animal and spring sheets. Replace it with a compact pantry control. |
| P3 | `ovu-street.js:49` | A closed-shop sheet lists every shop’s hours beneath the selected shop. Show its next opening first; disclose other hours. |
| P3 | `room.js:1339`, `room.js:126` | Learn promises “six little videos,” but the array contains five. Generate the count from the data. |
| P3 | `ovu-pets.js:9`, `ovu-barn.js:12` | Both the kitten and a hen are Mochi. Distinguish their names or always include the animal type. |

**Boundaries that already work and should be preserved:** the tested 67 stand-point routes across garden, greenhouse, farm and barn/spring areas planned successfully. Fishing, harvesting, barn produce, spring cooking and kitchen cooking use game inventory rather than automatically creating meals. Kitchen’s confirmation only opens a separate food form, and gym stations only open the movement form. Guided seated practices already offer explicit Save/decline. Koi and Light Flower already respond to player input; their missing pieces are voice, presentation and recording control.

