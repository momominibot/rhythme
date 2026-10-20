**Nadia’s review, 20 October 2026.** Source-traced walkthrough, with local rule checks. No files changed. Rendering, audio playback and live community services remain unverified.

## 1. Every activity through Nadia’s eyes

**Avatar key:** **W** means approach walking only (`room.js:550`); tab navigation skips that walk (`room.js:1293`). **P** means the named practice pose (`room.js:2326`), but entering through the hub leaves it hidden: `enterMeditation()` hides her and `runPractice()` never restores visibility (`room.js:1853,2027,2326`). **None** means no activity-specific response.

Every proposed pose should preserve Nadia’s chosen tudung and outfit. Currently no tudung option exists (`room.js:110–120`); shower/stretch override clothing (`room.js:2293`).

New illustrator poses: **note**, seated reading/writing; **phone**, briefly raising a phone; **tend**, kneeling with seed/basket; **tidy**, scooping litter; **scale**, stepping on/off; **sit**, supported sitting with relaxed hands.

| Activity | What happens today, evidence | Mindful element today | Avatar today | Missing for me | Exact proposed line; pose |
|---|---|---|---|---|---|
| First open | Welcome then consent (`room.js:2537`) | none | none | No settling moment | “Take your time arriving.”; coffee |
| Consent v3 | Separate backup, note-AI, photo-AI, summary-AI, improvement switches; health preselected, 18+ unchecked (`ovu-consent.js:27–39,235–245`) | none | none | AI destination absent from notice (`room.html:119`) | “Pause and choose only what feels right.”; note |
| Onboarding | Breastfeeding/postpartum/no-return choices (`room.js:2368`) | “No judgement” (`room.js:2378`) | none (`room.js:2443`) | Cycle-first questions | “A little now is enough.”; coffee |
| Room/walking/camera | Outfit walk; camera follows when zoomed/wide (`ovu-walk.js:347`, `ovu-camera.js:63`) | none | walking | Stamina slows me (`ovu-stamina.js:27`) | “Notice one small thing nearby.”; walking |
| Wardrobe | Nine outfits (`room.js:110`) | none | Changes outfit (`room.js:478`) | No tudung | “Choose what feels like you.”; outfit |
| Arrange | Drag furnishings; avatar pauses (`room.js:1624`) | none | none | No shared action | “Notice one welcoming corner.”; NEW tend |
| Window | Sleep/cycle summary (`room.js:2559`) | none | none | “Cycle not started” | “Your day can have its own pace.”; coffee |
| Period/calendar | Flow and pain editor (`room.js:805`) | none | W | No postpartum framing | “There is nothing to catch up on.”; note |
| Symptoms | Mood, pain, notes (`room.js:827`) | “Anything else you noticed” (`room.js:832`) | W | Safety gap below | “Notice what feels different today.”; note |
| Bedtime | Starts sleep window (`room.js:579`) | “Sweet dreams” (`room.js:593`) | Fixed sleeper (`room.html:52`) | Night-feed lock | “Rest can come in small pieces.”; sleeping |
| Wake | Ends window (`room.js:596`) | “No worries” (`room.js:607`) | Reappears (`room.js:716`) | Feeds counted as sleep | “A broken night deserves kindness.”; bed |
| Record sleep | Defaults 23:00–07:00 (`room.js:676`) | none | none | Invented eight-hour starting point | “An honest estimate is enough.”; note |
| Meal search/diary | Search/custom food (`room.js:1016`) | none | W | Effort during feeds | “Notice one flavour before continuing.”; coffee |
| Barcode | Scan/manual code (`room.js:1022`) | none | none | Another task | “One detail is enough.”; phone |
| Meal photo | Consent, recognition, correction (`room.js:1049`) | none | none | Estimates need attention | “Notice your meal for one moment.”; phone |
| Fridge/ideas | Unknown phase defaults menstrual (`room.js:999`) | none | W | Wrong context | “Choose something familiar and manageable.”; coffee |
| Weight | Optional private entry (`room.js:1274`) | “One number among many” (`room.js:1287`) | none | No embodied response | “Your body deserves kindness today.”; scale |
| Movement | Minutes and weekly totals (`room.js:2089`) | “How it felt” (`room.js:2103`) | none | Needs recovery-aware choices | “Move comfortably, or rest here.”; stretch |
| Luna/sofa | Review before saving (`room.js:1691`) | “Noted, gently” (`ovu-orb.js:317`) | W | Missed emergencies | “One small thing is enough.”; coffee |
| Mindfulness hub | Opens mat/options (`room.js:2027`) | “Nothing to get right” (`room.js:2036`) | Fixed meditation (`room.js:1853`) | Changes my identity | “Choose a pause that fits now.”; meditate |
| Erin sessions | Three/six minutes (`room.js:2044`) | “Feel your feet” (`room.js:152`) | Fixed meditation | Baby interruptions | “Pause whenever your baby needs you.”; meditate |
| Breathing | Timed inhale/hold/exhale (`room.js:1892`) | “Breathe out” | Fixed meditation | No natural-breath option | “Let your breath find its own pace.”; meditate |
| Teeth practice | Four-minute guide (`ovu-mindful.js:14`) | “feeling your feet” (`:17`) | P: teeth | Too long sometimes | “Notice the brush in your hand.”; teeth |
| Shower/bath | Five-minute guide (`ovu-mindful.js:37`) | “notice the air” (`:40`) | P: shower | Fixed robe | “Feel the water for one moment.”; shower |
| Coffee/tea practice | Three minutes (`ovu-mindful.js:54`) | “notice the pause” (`:60`) | P: coffee | Assumes no hurry | “One warm sip can be enough.”; coffee |
| Dishes practice | Five minutes (`ovu-mindful.js:71`) | “Feel its weight” (`:75`) | P: dishes | Another lengthy chore | “Feel one plate in your hands.”; dishes |
| Outfit practice | Two minutes (`ovu-mindful.js:88`) | “kindness” (`:94`) | P: outfit | No tudung | “Touch the fabric. Choose comfort.”; outfit |
| Bed-making practice | Two minutes (`ovu-mindful.js:104`) | “one slow breath” (`:110`) | P: bed | Assumes tidy morning | “One smooth corner is enough.”; bed |
| Plants practice | Two minutes (`ovu-mindful.js:118`) | “Just notice” (`:121`) | P: plants | Completion pressure | “Notice one leaf before pouring.”; plants |
| Pet-feeding practice | Two minutes (`ovu-mindful.js:133`) | “notice how your pet is waiting” (`:136`) | P: pets | Assumes uninterrupted time | “Share a quiet moment, however brief.”; pets |
| Stretch practice | Standing sequence (`ovu-mindful.js:148`) | “notice how you feel” (`:155`) | P: stretch | No seated choice | “A comfortable movement is enough.”; stretch |
| Moon Tap | Now Koi Pond (`ovu-breathtap.js:38`) | “You don’t need to match the ring” (`:42`) | none | “Stay longer” pressure (`:180`) | “Watch one ripple, then leave freely.”; sit |
| Acupressure | Body atlas (`room.js:2215`) | “stop if anything hurts” (`:2222`) | Static base image (`:2224`) | Cramp-led, wrong outfit | “Rest your hands if you prefer.”; sit |
| Erin podcast | Playback/resume/timer (`ovu-podcast.js:38`) | “Take a breath” (`room.js:2013`) | none | Offer secular alternatives | “Listen, or enjoy a little quiet.”; sit |
| Reminders/clock | Editable schedules (`room.js:636`) | “Gentle nudges, set by you” (`:638`) | W | Reliability overstated (`:626`) | “This can wait if you need.”; coffee |
| Garden watering | Sixty-second practice (`ovu-garden.js:139`) | “Watch the soil darken” (`:110`) | plants (`:144`) | Interruptions lose record | “One small pour is enough.”; plants |
| Garden bench | Guided or untimed sitting (`ovu-garden.js:226`) | “Ready when you are” (`:229`) | Seated (`:213`) | Good brief refuge | “Let the bench hold you.”; sit |
| Pond | Ripples/thought (`ovu-garden.js:239–244`) | “it can rest here” | Thought bubble | No bodily pause | “Notice one ripple passing.”; sit |
| Greenhouse teas/herbs | Research cards (`ovu-garden.js:249`) | none | none | Breastfeeding warning below cards (`:262`) | “Notice your cup’s warmth.”; coffee |
| Farm seeds | Daily packets (`ovu-farm.js:209`) | none | none | Daily obligation | “Choose something you enjoy seeing grow.”; tend |
| Planting | Plants seed (`ovu-farm.js:178`) | “Set one small intention” (`:192`) | none | Feels like homework | “A little seed is enough.”; tend |
| Farm watering | Advances growth (`ovu-farm.js:81`) | none | none | Count-led chore | “Watch one drop settle.”; plants |
| Weeding | Clears required weeds (`ovu-farm.js:183`) | none | none | Forced task | “Make a little room gently.”; tend |
| Harvest | Adds basket produce (`ovu-farm.js:198`) | none | none | No picking action | “Notice what you grew.”; tend |
| “Log a meal?” | Real-food-only prompt (`ovu-farm.js:203`) | none | none | Good boundary | “Remember one taste. Logging can wait.”; note |
| Well/basket | Full-can message/inventory (`ovu-farm.js:218–224`) | none | none | Text-only | “Enjoy what is already here.”; plants |
| Dream Street | Timed shop access (`ovu-street.js:35–58`) | none | walking | Night-feed exclusion | “There is no rush to choose.”; walking |
| Pet shop | Adoption/accessories (`ovu-shops.js:136`) | none | Walks shelves (`:159`) | No caring response | “Notice who catches your eye.”; pets |
| Furniture shop | Buy/place (`ovu-shops.js:140`) | none | Walks shelves (`:159`) | Purchase-led | “Choose one comforting detail.”; tend |
| Home showroom | Visit/move (`ovu-shops.js:135`) | none | walking (`:159`) | Viewing needs no goal | “Notice where you feel comfortable.”; walking |
| Pet feed | Pet eats (`room.js:427`) | none | none | Only pet acts | “Watch one happy mouthful.”; pets |
| Pet play | Pet hops/ball (`room.js:430`) | none | none | No shared play | “Enjoy one playful moment.”; pets |
| Pet clean | Clears mess (`room.js:442`) | none | none | More caregiving | “One small tidy is enough.”; tidy |
| Pet cuddle | Pet wiggles/hearts (`room.js:430`) | none | none | No actual cuddle | “Stay for one soft breath.”; pets |
| Pet walk | Pet follows (`ovu-petwalk.js:366`) | “notice what catches her eye” (`:380`) | Walking | Sleep blocks it (`:368`) | “A few shared steps are enough.”; walking |
| Plaza groups | Opt-in groups (`ovu-plaza.js:216`) | none | none | Bundled roster lacks postpartum (`:210`) | “Quiet company is welcome too.”; sit |
| Plaza benches | Garden sitting handler (`ovu-community.js:164`) | “Ready when you are” | Seated | Good fit | “Rest here without explaining.”; sit |
| Friends | Optional notes (`ovu-friends.js:402`) | “one slow breath” (`:31`) | none | No acknowledgment | “A little kindness needs no reply.”; note |
| Noticeboard | Prompts/private note (`ovu-community.js:128`) | “Notice three sounds” (`:25`) | none | Fictional therapeutic testimonial (`:42`) | “Name one small thing you noticed.”; note |
| Tea stall | Tea cards/sip (`ovu-community.js:147`) | “Notice the warmth” (`:151`) | Cup thought | Cycle framing | “Enjoy the warmth, without a label.”; coffee |
| Fountain | Wish effect (`ovu-community.js:154`) | “one soft breath out” (`:153`) | Joy (`:159`) | Good fit | “Watch the water move.”; sit |
| Neighbour visits | Labelled sample homes (`ovu-community.js:98–118`) | none | Neighbour waves | My avatar silent | “A small hello is enough.”; walking |
| Apple import | Select/preview/apply (`room.js:1448`) | none | none | Shorter sleep sessions dropped (`ovu-health.js:66`) | “Choose only what helps you.”; note |
| Google import | Takeout files (`room.js:1374`) | none | none | Not continuous sync | “Bring only what feels useful.”; note |
| Journal | Timeline/reflection (`journal.html:55`) | “how today felt” | none | No reading action | “A few words, or none, are enough.”; note |
| Doctor share | PDF/encrypted export (`journal.html:271`) | none | none | Postpartum context omitted (`ovu-agents.js:205`) | “Your questions belong here too.”; note |
| Learn/computer | Includes After pregnancy (`room.js:134`) | “Recovery has no performance target” (`lifecycle-content.js:110`) | W | Relevant folder buried | “Choose one question for today.”; note |

## 2. Safety

These are escalation requirements, not diagnoses. Absence of a matching rule must never mean “safe.”

- **Immediate danger to me or baby:** detected for some phrases, but even “I do not want to hurt my baby” triggers (`ovu-orb.js:77–85`). Desired: **“Unwanted thoughts deserve support. If you might act, call 995 now. Ask someone trusted to stay.”** Distinguish unwanted thoughts from intent through assessment, not regex alone. [KKH](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness)
- **Hallucinations, delusions, confusion, unusually activated sleeplessness:** Luna misses these (`ovu-orb.js:83–96`); Learn mentions psychosis (`mental-health.html:170`). **“Get urgent medical assessment now. Ask someone to stay with you and your baby.”** [KKH](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness)
- **Chest pain, breathlessness, collapse, seizures, stroke-like symptoms:** missing from Luna. **“Call 995 now. Tell them you gave birth four months ago.”** [MOH](https://www.moh.gov.sg/newsroom/prudent-use-of-scdf-emergency-medical-services-and-emergency-department-services/)
- **Severe headache/visual changes, severe abdominal pain, uncontrolled bleeding, hourly soaked pads, large clots:** only bleeding/pelvic patterns partly detected (`ovu-orb.js:89–93`). **“Get emergency assessment now. Call 995 if faint, breathless, collapsing or bleeding uncontrollably.”** [CDC warning signs](https://www.cdc.gov/hearher/maternal-warning-signs/index.html), [KKH urgent care](https://www.kkh.com.sg/our-specialties/urgent-og-centre)
- **Fever, foul discharge, worsening wound symptoms, painful hot breast, persistent vomiting/dehydration, sudden disabling weakness:** missing from Luna. **“Contact a clinician now for urgent assessment. Do not wait for another log.”** [CDC](https://www.cdc.gov/hearher/maternal-warning-signs/index.html), [HPB breastfeeding guidance](https://www.healthhub.sg/programmes/parent-hub/baby-toddler/childhood-healthy-diet/)
- **One painful swollen limb:** missing. **“Seek urgent assessment today. With chest pain or breathlessness, call 995.”** This matters without assuming an elevated postpartum clot risk at four months. [NHS](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/)
- **Persistent/worsening low mood, anxiety, hopelessness, inability to cope:** automated flag waits for seven symptom records (`ovu-agents.js:101`). **“You deserve support now. Contact your polyclinic, KKH Women’s Mental Wellness Service or NUH WEHS.”** No logging threshold should block help. [KKH](https://www.kkh.com.sg/symptoms-treatments/perinatal-depression-mental-wellness), [NUH](https://www.nuh.com.sg/care-at-nuh/services/psychological-medicine/our-services/programmes---specialised-services/womens-emotional-health-service-wehs)

Absent periods while breastfeeding are not themselves an emergency or reliable contraception. **“Periods can remain absent while breastfeeding. Ask about contraception if pregnancy is possible.”** [HPB](https://www.healthhub.sg/well-being-and-lifestyle/pregnancy-and-infant-health/pregnancy-first-days-of-our-lives-with-baby)

## 3. Ten ranked fixes

1. **`ovu-orb.js:83 urgent()`; `room.js:802 renderEditor()`**: implement the escalation coverage above across chat, structured inputs and notes, before ordinary save feedback.
2. **`room.js:2493 predictionModeFor()`**: suspend when postpartum and `periodsBack === 'no'`; enforce again in `ovu-store.js:311 cycleStats()`. Imported historical cycles currently revive predictions.
3. **`ovu-agents.js:95 symptomAgent()`**: offer postpartum support immediately when requested or concerning symptoms appear; remove seven-record eligibility.
4. **`room.js:596 openWake()`, `:676 openSleepRecord()`; `ovu-health.js:59 nightsFrom()`**: blank defaults, accept awake time, label unadjusted intervals “time in bed,” retain all sleep bouts.
5. **`room.js:707 awake()`; `ovu-stamina.js:24 apply()`**: keep logging/help available overnight; remove sleep-linked play restrictions and slowing.
6. **`room.js:2295 setPose()`, `:2320 runPractice()`**: restore visible avatar synchronously, preserve outfit on missing assets, add tudung variants including sleeping/meditation.
7. **`room.js:2581 afterSave()` and activity handlers**: implement the table’s brief actions and lines; never require watching animations.
8. **`ovu-rewards.js:73 award()`**: remove streak and food-item bonuses; return all practice through flat two-heart, six-per-day logic. Ordinary practice currently also receives streak bonuses (`:85–87`).
9. **`ovu-agents.js:205 fourWeekSummary()`; `journal.html:224 buildBundle()`**: include self-reported postpartum timing, breastfeeding, absent periods and paused predictions.
10. **`ovu-consent.js:211 fillSheet()`**: disclose provider and processing destination beside AI switches; distinguish local thumbnails, relay handling and unverified provider retention.

