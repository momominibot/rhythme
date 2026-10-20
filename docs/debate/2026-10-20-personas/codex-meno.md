## 1. Mrs Tan’s walkthrough

**Read-only, 20 October 2026.** This is a code-traced journey, with isolated parser checks. Rendering, audio playback and live community availability remain unverified. No files changed.

I want comfort and company, without being treated as someone awaiting another period.

In the table, **arrival** means walking to the hotspot (`room.js:550`). **Practice pose** means the activity’s pose is displayed (`room.js:2326`). Seven practice poses support outfits; shower/stretch do not (`room.js:2293`). All proposed actions should retain my chosen outfit.

| Activity and today | Mindful element today | Avatar today | Gap for me | Proposed exact line; pose |
|---|---|---|---|---|
| Consent v3: required tracking, five optional switches, separate unchecked 18+ confirmation (`ovu-consent.js:17,27,223-247`) | none | none | AI location omitted | “Take your time. These choices belong to you.”; meditate |
| Onboarding: 50+/no periods permits postmenopause classification (`room.js:2526`) | “No judgement” (`room.js:2378`) | none | Dryness and osteopenia absent from choices (`room.js:2374-2377`) | “Your life now matters more than old cycle dates.”; hello |
| Room navigation and follow camera (`ovu-camera.js:52-82`) | none | Outfit-specific walking (`ovu-walk.js:347-362`) | Needs arrival pause | “Notice one small thing you like here.”; walking |
| Window: daily suggestions (`room.js:2551-2564`) | none | none | “Cycle not started” framing | “Notice the light. There is no hurry.”; coffee |
| Wardrobe: choose outfit (`room.js:1246-1253`) | none | Outfit change (`room.js:478-484`) | Missing kindness | “Choose what feels comfortable today.”; outfit |
| Bedtime: starts sleeping state (`room.js:579-594`) | none | Sleeping, fixed sprite (`room.html:52`) | Loses outfit | “Let your shoulders settle. Rest needs no permission.”; sleeping |
| Wake: records times, quality, notes (`room.js:596-614`) | none | Standing restored (`room.js:716-720`) | Calls time in bed sleep | “Notice this morning without needing to change it.”; stretch |
| Past sleep: defaults 23:00–07:00 (`room.js:678-690`) | none | arrival | Can invent my night | “A difficult night still deserves kindness.”; note |
| Calendar bleeding: autofills days (`room.js:764-772`) | none | arrival | Fabricated bleeding; period framing | “Notice what happened. One observation is enough.”; note |
| Symptoms: chips, pain, notes (`room.js:827-847`) | none | arrival | No dryness chip (`ovu-agents.js:13`) | “What needs a little kindness today?”; note |
| Meal search/fridge: portions and ideas (`room.js:898-910,997-1000`) | none | arrival | Defaults to menstrual ideas | “Remember one flavour you enjoyed.”; meal |
| Barcode: camera/manual lookup (`room.js:1023-1040`) | none | none | Numerical homework risk | “Let your shoulders soften while you look.”; read |
| Food photo: editable estimate before saving (`room.js:1051-1073`) | none | none | No mindful response | “Notice the colours before taking your photo.”; meal |
| Weight: optional record (`room.js:1275-1287`) | “One number among many” | none | Cycle explanation mismatched | “This number is a note, never a judgement.”; weigh |
| Movement: activity/minutes/weekly totals (`room.js:2090-2150`) | “Some movement is better than none” (`ovu-exercise.js:109`) | none | No bone-health adaptation | “Notice what felt comfortable at your own pace.”; walking |
| Luna/sofa: confirms extracted records (`room.js:1678-1700`) | none | arrival | Recorder, limited company | “Take your time. One part of today is enough.”; hello |
| Mat, coach, Erin sessions (`room.js:2044-2047,568`) | “Just this one breath” (`room.js:152`) | Fixed meditation sprite (`room.html:51`) | Outfit lost | “Let your breath find its own comfortable pace.”; meditate |
| Teeth practice (`ovu-mindful.js:17`) | “Feeling your feet on the floor” | Practice pose: teeth | Keep cue; remove completion judgement¹ | “Feel the brush in your hand.”; teeth |
| Shower/bath shortcut (`room.js:560`; `ovu-mindful.js:40`) | “notice the air on your skin” | Practice pose: shower | Bath opens shower; fixed robe | “Notice the warmth on your hands.”; wash |
| Coffee/tea practice (`ovu-mindful.js:60`) | “notice the pause” | Practice pose: coffee | Keep; remove judgement¹ | “Notice the scent before your first sip.”; coffee |
| Dishes practice (`ovu-mindful.js:77`) | “Notice the sounds” | Practice pose: dishes | Keep; remove judgement¹ | “Feel one plate in your hands.”; dishes |
| Outfit practice (`ovu-mindful.js:94`) | “the same kindness you would give a friend” | Practice pose: outfit | Keep; remove judgement¹ | “Let comfort guide your choice.”; outfit |
| Making bed (`ovu-mindful.js:110`) | “Take one slow breath” | Practice pose: bed | Keep; remove judgement¹ | “One smooth corner is enough.”; bed |
| Plants practice (`ovu-mindful.js:122`) | “Touch the soil” | Practice pose: plants | Keep; remove judgement¹ | “Notice one leaf before you pour.”; plants |
| Pet practice (`ovu-mindful.js:136`) | “Notice how your pet is waiting” | Practice pose: pets | Keep; remove judgement¹ | “Company can be quiet.”; pets |
| Stretch practice (`ovu-mindful.js:155-160`) | “notice how you feel now” | Practice pose: stretch | Forward fold/roll needs adaptation² | “Stay comfortable. Smaller movements count as noticing too.”; stretch |
| Moon Tap now Koi Pond (`ovu-breathtap.js:8-15`) | “You don’t need to match the ring” (`:45`) | none | Woman absent | “Watch one ripple come and go.”; meditate |
| Acupressure atlas (`room.js:2221-2224`) | “gentle” pressure instructions | Static base image (`room.js:2224`) | Cramp framing; no pressing action | “Notice gently. Stop whenever you want.”; hand |
| Erin podcast/player (`room.js:1936-1950`) | “Take a breath before the next thing” (`:2013`) | none | Missing listening response | “Let one thought stay with you.”; coffee |
| Clock/reminders (`ovu-remind.js:9-13`) | “shoulders down” | none | “Always ring” overpromises (`room.js:644`) | “Keep only the reminders that feel helpful.”; note |
| Garden watering (`ovu-garden.js:139-167`) | “Nothing to hurry” (`:110`) | plants (`ovu-garden.js:144`) | Strong fit | “Watch the soil darken slowly.”; plants |
| Garden pond (`ovu-garden.js:239-244`) | “it can rest here a moment” | Thought bubble (`:243`) | No bodily action | “Let your gaze follow one ripple.”; meditate |
| Greenhouse teas/herbs (`ovu-garden.js:249-263`) | none | none | Cycle supplements remain listed (`ovu-herbs.js:47`) | “Notice the scent before your first sip.”; coffee |
| Farm planting (`ovu-farm.js:178-192`) | “Set one small intention” | arrival (`:150`) | No planting action | “Place one seed gently.”; plants |
| Farm watering/weeds/well (`ovu-farm.js:168-194,224`) | none | none | Weeds block leisure | “Tend a little, then leave the rest.”; plants |
| Harvest and “Log a meal” (`ovu-farm.js:198-207`) | none | none | Correctly avoids automatic food logs | “Enjoy your harvest. Record only food you actually eat.”; meal |
| Dream Street: pet, furniture, home shops (`ovu-street.js:10-12`) | none | Shelf approach (`ovu-shops.js:154-159`) | Opening hours restrict nighttime company | “Choose something that feels like home.”; read |
| Pet feed (`room.js:427-439`) | none | none; pet animates | Woman absent | “Watch your cat settle beside the bowl.”; pets |
| Pet play (`room.js:430-434`) | none | none; pet animates | Woman absent | “Enjoy these little movements together.”; pets |
| Pet clean (`room.js:442-447`) | “No rush” (`ovu-pets.js:83`) | none | Woman absent | “One small kindness, then rest.”; tidy |
| Pet cuddle (`room.js:460-465`) | none | none; pet animates | Woman absent | “Nothing else is needed right now.”; pets |
| Pet walk (`ovu-petwalk.js:366-380`) | “notice what catches her eye” | Walk/react (`:351-354`) | Keep virtual/real distinction | “Walk together and notice one small thing.”; walking |
| Plaza health groups (`ovu-plaza.js:207-223`) | none | none | Presence is not conversation | “Choose the company that feels comfortable.”; hello |
| Garden/street/plaza benches (`ovu-garden.js:222-237`) | “Sitting is just sitting” | Outfit-specific sitting (`:207-215`) | Strong fit | “You can simply be here.”; meditate |
| Friends/preset notes (`ovu-friends.js:405-416`) | “Before you send, one slow breath” (`:31`) | none | Missing sender reaction | “Send kindness without expecting a reply.”; hello |
| Plaza board/fountain/tea (`ovu-community.js:128-159`) | “Notice the warmth before the taste” | Fountain hop (`:159`); otherwise none | Tea still says “your cycle” | “Notice the warmth and the company.”; coffee |
| Apple Health/Google import: choose types/dates (`room.js:1448-1478`) | none | none | Exercise unsupported (`ovu-health.js:451-457`) | “Bring in only what helps you.”; read |
| Journal/reflection (`journal.html:57,292`) | “how today felt” | none | Period labels persist (`:68`) | “What felt comforting today?”; note |
| Doctor share: PDF/encrypted export (`journal.html:270-286`) | none | none | PDF omits stage upfront (`:241-246`) | “Choose what you want understood first.”; read |
| Learn/computer: folders/videos (`room.js:1152-1168`) | none | arrival | Relevant chapter buried (`room.js:134`) | “Keep one useful thought for today.”; read |

**New poses, illustrator instructions:** **hello:** gentle wave and attentive nod. **note:** write briefly, then pause. **read:** examine a page or packet. **meal:** regard a bowl, then take a bite. **weigh:** step onto scales neutrally. **wash:** wash hands at a basin. **hand:** gently touch the opposite forearm. **tidy:** scoop litter beside a raised tray.

¹ Completion asks “Did you really do it, with attention?” (`room.js:2344-2346`). Replace this moral test.

² Osteopenia does not establish a blanket movement ban. Individual suitability is unverified; spinal-flexion precautions warrant an alternative. [Peer-reviewed consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC9304091/).

## 2. Safety

These are the relevant escalation categories, not a claim that any symptom checker can cover every emergency.

- **Any postmenopausal bleeding, including one episode.** Structured spotting raises a persistent flag (`ovu-agents.js:50-92`); Luna misses “pink discharge” in reproduced checks (`ovu-orb.js:68,95`). Desired: **“Any vaginal bleeding after menopause needs assessment. Contact your GP or polyclinic promptly, even if it stops.”** Do not attribute it to dryness. [RCOG](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/postmenopausal-bleeding-poster), [KKH](https://www.kkh.com.sg/wise/menstrual-problems).

- **Uncontrolled bleeding, collapse, severe pelvic pain.** Luna escalates, but structured saves can merely direct me to journal notes (`ovu-orb.js:89-93`; `room.js:2585`). Desired: **“Heavy bleeding with faintness or collapse: call 995. Sudden severe pelvic pain needs emergency assessment now.”** [MOH](https://www.moh.gov.sg/seeking-healthcare/find-a-facility-or-service/private-ambulance-services/), [KKH urgent care](https://www.kkh.com.sg/our-specialties/urgent-og-centre).

- **Chest pain, breathlessness, stroke signs.** No dedicated detection in `ovu-orb.js:83-96`; reproduced chest-pain/stroke examples returned nothing. Desired: **“Chest pain, severe breathlessness, face drooping, arm weakness or speech difficulty: call 995 now.”** [MOH](https://ask.gov.sg/moh/questions/clhq0irrx00etjz08c6lhkavg), [HPB](https://www.healthhub.sg/health-conditions/stroke-about-stroke).

- **Persistent bloating, early fullness, pelvic pain, urinary frequency, unexplained weight loss; breast/nipple or vulval changes.** Some onboarding notes exist, but ongoing coverage is incomplete (`room.js:2508-2509`; `ovu-agents.js:95-109`). Desired: **“New, persistent changes deserve a prompt appointment. Please tell your GP or polyclinic.”** [NICE](https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer), [RCOG](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/skin-conditions-of-the-vulva).

- **Urinary burning with fever, chills, flank pain or blood.** No dedicated rule (`ovu-orb.js:83-96`). Desired: **“Urinary symptoms with fever, chills, back pain or blood need prompt medical care. Please seek help today.”** [KKH](https://www.kkh.com.sg/symptoms-treatments/urinary-tract-infections).

- **Fall-related severe pain, possible fracture, new neurological back symptoms.** No dedicated rule (`ovu-orb.js:83-96`). Desired: **“Severe pain after a fall needs urgent assessment. New bladder or bowel changes or groin numbness need emergency care.”** [NUH](https://www.nuh.com.sg/health-resources/diseases-and-conditions/back-lumbar-pain), [HPB](https://www.healthhub.sg/health-conditions/low-back-pain).

- **Self-harm thoughts.** Luna detects these, but copy unnecessarily mentions a baby (`ovu-orb.js:78-85`). Desired: **“If you might harm yourself now, call 995 and ask someone you trust to stay with you.”** [HPB](https://www.healthhub.sg/programmes/mindsg/caring-for-ourselves/preventing-self-harm-and-suicide-adults).

Dryness and poor sleep also deserve ordinary clinical support, without waiting for an emergency. Desired: **“Comfort matters. Your polyclinic or GP can discuss support and referral to KKH or NUH.”** [NUH menopause services](https://www.nuh.com.sg/care-at-nuh/services/obstetrics-and-gynaecology/gynaecology/swans--service-for-women-across-the-nation-of-singapore).

## 3. Ten ranked fixes

1. **`room.js::openCalendar/autoFillPeriod` (`727,764`):** postmenopause gets “Bleeding”, explicit single-day confirmation, no autofill, immediate assessment card.
2. **`ovu-orb.js::urgent` (`83`):** recognise pink/brown vaginal discharge and missing emergency categories; apply the same safety checks to manual entries/imports.
3. **`room.js::finishOnboarding` (`2526`):** record postmenopause explicitly, independently of HRT; propagate it into `journal.html::pdfDoc` (`238`).
4. **`ovu-agents.js::SYMPTOMS` (`13`):** add dryness, urinary discomfort and painful intercourse; update Luna’s dictionary and relevant escalation paths.
5. **`ovu-orb.js::parseLocal` (`123`):** remove invented 07:00 waking. In `openSleepRecord` (`room.js:678`), leave unknown times blank and distinguish sleep from bed duration.
6. **`ovu-mindful.js::ACTIVITIES` (`159-160`):** replace automatic fold/roll guidance with an optional upright/seated alternative, reviewed for bone-health suitability.
7. **`ovu-rewards.js::award` (`84-87`):** remove streak and item-count bonuses. Preserve flat practice rewards; correct stale reward claims (`room.js:1582,2306`).
8. **`room.js::setPose/afterSave` (`2295,2581`):** use outfit-specific actions throughout the table, including meditation/sleep; keep the action visible beyond sheets.
9. **`ovu-consent.js::PURPOSES` (`27`):** disclose actual AI processing location and submitted content. Beijing routing exists (`supabase/functions/luna/index.ts:194`); retention remains unverified.
10. **Remove pressure:** make weeds optional in `ovu-farm.js::openBed` (`168`), replace `askPracticeDone`’s judgement (`room.js:2344`), and correct reminder guarantees (`room.js:644`; `ovu-remind.js:81-100`).

