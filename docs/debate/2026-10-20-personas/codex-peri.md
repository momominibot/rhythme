**Siti’s review, 20 October 2026**

I need better bleeding guidance, accurate shift-work records and clearer avatar responses. This is a source-traced walkthrough with isolated parser checks. **Live rendering and remote services remain unverified. No files were changed.**

## 1. Every activity

To keep the table readable:

- **W** means walking to the hotspot, `room.js:550`, using the selected outfit, `ovu-walk.js:347`. This is an approach, not a completion reaction.
- **P** means the named practice pose, `room.js:2326`. Seven poses support outfit variants; missing images fall back to another outfit, `room.js:2293-2298`.
- Every proposed action should preserve my selected outfit. Proposed lines are optional, never another task.

| Activity: today, evidence | Mindful element today | Avatar today | Gap for me | Exact proposed line; action |
|---|---|---|---|---|
| First open: v3, required tracking, five separate optional switches, 18+ confirmation (`ovu-consent.js:27,235`) | “choices that stay yours” (`room.html:115`) | None | AI destination absent from switches | “Take your time. These choices are yours.”; NEW browse |
| Onboarding: irregular bleeding, flushes, hormones (`room.js:2365`) | None | None (`room.js:2443`) | No named amlodipine, hypertension or shifts | “Start with what matters to you today.”; NEW note |
| Room/window: navigation, sleep controls, following camera (`room.js:2551`; `ovu-camera.js:63`) | None | Walking (`room.js:497`) | Night-based assumptions | “Notice one small detail around you.”; outfit |
| Wardrobe: select clothes (`room.js:1246`) | None | Changes outfit (`room.js:478`) | No gentle acknowledgement | “Choose what feels comfortable today.”; outfit |
| Period: flow, flooding, clots, impact (`room.js:808`) | None | W | Autofill invents bleeding days (`room.js:764`) | “Record what happened. Gaps are welcome.”; NEW note |
| Symptoms: daily chips, pain, mood, notes (`room.js:829`) | None | W | No flush timing, severity or count | “What did you notice, in your own words?”; NEW note |
| Bedtime: starts timer (`room.js:579`) | None | Fixed sleeper (`room.js:708`) | Pyjamas default; daytime rest overlooked | “Let this be your resting time.”; sleeping |
| Wake: ends timer, records sleep (`room.js:596`) | None | Outfit restored (`room.js:716`) | “Good morning” after afternoon sleep | “Take a moment before moving on.”; stretch |
| Record sleep: time fields (`room.js:676`) | None | W | Defaults 23:00–07:00 | “Remember what you can. Leave the rest.”; NEW note |
| Meal search/fridge: search or custom food (`room.js:561,1016`) | None | W | Time-derived meal labels (`room.js:985`) | “Notice one flavour you remember.”; NEW taste |
| Barcode: scan or enter digits (`room.js:1023`) | None | None | No avatar response | “Take a moment with what you chose.”; NEW browse |
| Food photo: consent, recognition, confirmation (`room.js:1056`) | None | None | No avatar response | “Notice the colours before confirming.”; NEW browse |
| Weight: private entry (`room.js:1274`) | “never judged” (`room.js:1277`) | None | No acknowledgement | “A number can stay simply a note.”; NEW weigh |
| Movement: type, minutes, notes (`room.js:2089`) | “How it felt” (`room.js:2103`) | None | Default duration; no embodied response | “Notice how you feel after moving.”; stretch |
| Luna/sofa: parse, confirm, optional AI (`room.js:1676,1733`) | None reliably | W | Loses flush details; unsafe parsing below | “Tell me what stood out for you.”; NEW note |
| Erin sessions: guided audio/breathing (`room.js:2024`) | “Nothing to get right.” (`room.js:2033`) | Fixed meditate (`room.js:1853`) | Outfit changes; breath holds (`room.js:1892`) | “Your own pace is welcome.”; meditate |
| Teeth practice (`ovu-mindful.js:14`) | “There’s no need to notice everything.” (`ovu-mindful.js:30`) | P: teeth | Clock-selected script ignores shifts | “Notice the brush moving in your hand.”; teeth |
| Shower practice (`ovu-mindful.js:37`) | “notice the air on your skin” (`ovu-mindful.js:40`) | P: fixed robe | Warmth assumed; outfit changes | “Choose a comfortable temperature.”; NEW wash |
| Coffee practice (`ovu-mindful.js:54`) | “notice the pause” (`ovu-mindful.js:60`) | P: coffee | Assumes morning | “Pause between sips, whenever your day begins.”; coffee |
| Dishes practice (`ovu-mindful.js:71`) | “Feel its weight.” (`ovu-mindful.js:75`) | P: dishes | Five minutes may feel demanding | “One plate is enough to notice.”; dishes |
| Outfit practice (`ovu-mindful.js:88`) | “the same kindness you would give a friend” (`ovu-mindful.js:94`) | P: outfit | Useful; permit brevity | “Offer yourself the kindness you give others.”; outfit |
| Bed-making practice (`ovu-mindful.js:104`) | “Smooth the sheet with both palms.” (`ovu-mindful.js:108`) | P: bed | “tonight” excludes my schedule | “Smooth one crease for your resting self.”; bed |
| Plant practice (`ovu-mindful.js:118`) | “Touch the soil.” (`ovu-mindful.js:122`) | P: plants | Useful already | “Look before you pour.”; plants |
| Pet practice (`ovu-mindful.js:133`) | “simply watch them eat” (`ovu-mindful.js:138`) | P: pets | Breathing tied to eating sounds (`ovu-mindful.js:144`) | “Watch quietly, breathing in your own way.”; pets |
| Stretch practice (`ovu-mindful.js:148`) | “notice how you feel now” (`ovu-mindful.js:155`) | P: fixed yoga clothes | No seated choice | “Choose a movement that feels comfortable.”; stretch |
| Moon Tap, now Koi Pond (`ovu-breathtap.js:38`) | “You don’t need to match the ring.” (`ovu-breathtap.js:42`) | Background meditate (`room.js:2061`) | “Stay…longer next time” pressure (`ovu-breathtap.js:180`) | “Stopping now is welcome too.”; meditate |
| Acupressure: atlas, cautions (`room.js:2221`) | “breathe slowly” (`room.js:2223`) | Static atlas (`room.js:2224`) | No personal action | “Notice the touch. Stop whenever you wish.”; NEW tend |
| Erin podcast: player, reflection (`room.js:1943`) | “Take a breath before the next thing.” (`room.js:2013`) | None (`room.js:2003`) | No listening reaction | “Let one thought stay with you.”; meditate |
| Reminders: days/times (`room.js:638`) | “Gentle nudges, set by you” | W | Checks require running page (`ovu-remind.js:81`) | “Choose a moment that fits your day.”; NEW note |
| Garden watering (`ovu-garden.js:110`) | “Watch the soil darken.” | Plants (`ovu-garden.js:144`) | Good fit | “Watch the water settle.”; plants |
| Garden pond: thought/flower/ripple (`ovu-garden.js:239`) | “Whatever today held, it can rest here” | W | No response to letting go | “Let this thought rest here.”; meditate |
| Greenhouse: phase-ranked herbs/teas (`ovu-garden.js:249`) | None | W | My medication context absent | “Notice the scent before choosing.”; coffee |
| Farm planting (`ovu-farm.js:192`) | “Set one small intention” | None after planting (`ovu-farm.js:178`) | No planting action | “Place one seed with care.”; NEW tend |
| Farm watering/weeding, shed/well (`ovu-farm.js:162,209,224`) | None | None after action | Energy gate can frustrate (`ovu-farm.js:182`) | “Notice what has changed since your visit.”; plants |
| Harvest: inventory updated (`ovu-farm.js:198`) | None | None | No picking action | “Notice what grew in its own time.”; NEW tend |
| Harvest “Log a meal?”: real-food confirmation (`ovu-farm.js:203`) | None | None | Correctly avoids automatic food logging | “Only record what you actually ate.”; NEW taste |
| Dream Street: pet, furniture, home shops (`ovu-street.js:10`) | None | W; purchases lack action (`ovu-shops.js:132`) | Closing hours exclude late shifts | “Enjoy looking. Nothing needs buying.”; NEW browse |
| Pet feed (`room.js:460`) | None | Pet only (`room.js:427`) | My avatar does nothing | “Watch your companion enjoy this moment.”; pets |
| Pet play (`room.js:461`) | None | Pet only (`room.js:431`) | Same | “Notice their little burst of joy.”; pets |
| Pet clean (`room.js:442`) | None | None | Same | “One small act of care.”; NEW tend |
| Pet cuddle (`room.js:465`) | None | Pet only (`room.js:435`) | Same | “Stay for a moment, if you like.”; pets |
| Pet walk (`ovu-petwalk.js:366`) | “notice what catches her eye” | Walking (`ovu-petwalk.js:380`) | Sleeping gate assumes morning return | “Let curiosity choose your next pause.”; walking |
| Plaza groups: account, explicit joining (`ovu-plaza.js:207`) | None | None on joining | No welcoming reaction | “You can belong quietly here.”; NEW greet |
| Benches: sit/pause (`ovu-garden.js:222`) | “Just sit a while” | Seated (`ovu-garden.js:173`) | Generic fallback (`ovu-garden.js:197`) | “Nothing needs doing for this moment.”; meditate |
| Friends: predefined notes (`ovu-friends.js:38`) | “Before you send, one slow breath.” (`ovu-friends.js:31`) | None (`ovu-friends.js:413`) | No greeting action | “Send a little kindness, without expecting a reply.”; NEW greet |
| Community board: prompts/local notes (`ovu-community.js:128`) | Gentle prompt | None | Sample contributions need distinction | “Share only what feels comfortable.”; NEW note |
| Tea stall (`ovu-community.js:144`) | “Notice the warmth before the taste.” | None | Phase ranking unnecessary for me | “Notice the scent of your cup.”; coffee |
| Fountain (`ovu-community.js:153`) | “Now one soft breath out.” | Joy hop (`ovu-community.js:159`) | Good fit | “Make room for one quiet wish.”; outfit |
| Apple import: selective preview (`room.js:1453`) | None | None | Flush presence loses detail; BP unsupported (`ovu-health.js:96,503`) | “Choose only what you want to bring.”; NEW browse |
| Google import (`ovu-health.js:269`) | None | None | No period/flush import coverage | “A partial record is still yours.”; NEW browse |
| Journal: timeline/flags (`journal.html:118`) | “A few words about how today felt” (`journal.html:57`) | None | Important warnings buried | “Notice one thing you want remembered.”; NEW note |
| Doctor share: summary/PDF/encrypted file (`journal.html:150,220,271`) | None | None | Top-six symptoms omit detail (`ovu-agents.js:196`) | “Choose what you want your doctor to understand.”; NEW browse |
| Learn/computer: folders/videos (`room.js:1152`) | None | W | No learning reaction | “Take one useful thought with you.”; NEW browse |

**New poses for an illustrator, always in the selected outfit:**

- **Browse:** holds and considers a card, book or product.
- **Note:** sits comfortably and writes a short note.
- **Taste:** lifts a small spoon and pauses.
- **Weigh:** steps onto scales, then relaxes her shoulders.
- **Wash:** tests water with one hand beside the shower.
- **Tend:** kneels and reaches gently towards the activity.
- **Greet:** gives a small, welcoming wave.

## 2. Safety for Siti

These messages should appear immediately when relevant, before rewards.

- **Heavy bleeding with faintness, breathlessness or chest pain:** Luna escalates (`ovu-orb.js:89`); manual logging merely adds a journal warning (`ovu-agents.js:106`; `room.js:2585`).  
  **“Heavy bleeding with faintness, chest pain or breathing difficulty needs emergency help. Call 995. Otherwise, seek urgent assessment at KKH or A&E.”** [KKH urgent care](https://www.kkh.com.sg/our-specialties/urgent-og-centre)

- **Heavy/prolonged bleeding, bleeding between periods or after sex, unusual fatigue:** current heavy-impact warning waits for two days (`ovu-agents.js:85`); after-sex concern appears during onboarding (`room.js:2502`).  
  **“Book a GP or polyclinic appointment for this bleeding. Mention unusual tiredness and ask about anaemia testing.”** [NICE heavy menstrual bleeding](https://www.nice.org.uk/guidance/ng88/chapter/Recommendations)

- **Any bleeding after 12 period-free months:** escalation depends on recorded menopause status (`ovu-orb.js:95`).  
  **“Even a small spot after 12 months without periods needs prompt medical assessment.”** [KKH menopause](https://www.kkh.com.sg/symptoms-treatments/menopause)

- **Possible pregnancy with bleeding, severe pelvic pain, shoulder-tip pain or faintness:** partly covered in Luna (`ovu-orb.js:92`).  
  **“Seek urgent assessment now. Pregnancy is still possible during perimenopause.”** [KKH ectopic pregnancy](https://www.kkh.com.sg/symptoms-treatments/ectopic-pregnancy)

- **Cardiovascular or neurological symptoms:** absent from Luna’s urgency rules (`ovu-orb.js:83-96`).  
  **“Call 995 for chest pain, breathing difficulty, sudden weakness, or speech or vision changes. Do not wait for another reading.”** Repeated BP ≥180/120 also needs urgent clinical advice. [MOH hypertension](https://www.moh.gov.sg/seeking-healthcare/getting-medical-help/conditions/high-blood-pressure/), [NICE hypertension](https://www.nice.org.uk/guidance/ng136/chapter/recommendations)

- **Amlodipine allergy or liver-warning symptoms:** absent from those rules.  
  **“Face or tongue swelling or breathing trouble: call 995. Yellow eyes, dark urine or pale stools: stop amlodipine and seek immediate medical advice.”** Flushing can also be a medication effect, so do not automatically label it menopause. [HealthHub amlodipine](https://www.healthhub.sg/medication-devices-and-treatment/medications/amlodipine)

- **Pelvic pain with fever; persistent bloating, early fullness or urinary changes:** onboarding covers some persistent symptoms (`room.js:2508`), not a comprehensive ongoing check.  
  **“Pelvic pain with fever needs urgent assessment. Persistent bloating, early fullness or urinary changes deserve a doctor’s appointment.”** [ACOG pelvic infection](https://www.acog.org/womens-health/faqs/pelvic-inflammatory-disease), [NICE suspected cancer](https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer)

- **Self-harm thoughts:** Luna has emergency actions (`ovu-orb.js:85`).  
  **“If you might hurt yourself, call 995 and ask someone trusted to stay. SOS: 1767.”** [HealthHub](https://www.healthhub.sg/programmes/mindsg/caring-for-ourselves/preventing-self-harm-and-suicide-adults)

For disruptive flushes or sleep problems: **“You do not have to wait until things feel unbearable. Book a GP or polyclinic review.”** KKH and NUH provide menopause care. [KKH](https://www.kkh.com.sg/symptoms-treatments/menopause), [NUH SWANS](https://www.nuh.com.sg/care-at-nuh/services/obstetrics-and-gynaecology/gynaecology/swans--service-for-women-across-the-nation-of-singapore)

## 3. Ten ranked fixes

1. **`room.js:2581`, `afterSave`:** run the same urgency assessment as Luna; show actionable care guidance immediately, without requiring journal navigation.
2. **`ovu-orb.js:83`, `urgent`:** make negation and timing clause-specific. “Yesterday” elsewhere must not suppress current flooding. Add cardiovascular, medication and infection routes.
3. **`room.js:764`, `autoFillPeriod`:** remove fabricated medium/light days. Save only explicitly confirmed dates, flow and impact.
4. **`room.js:829`, symptom editor:** add optional flush timestamps, frequency, severity, sweating and sleep disruption; retain original wording.
5. **`ovu-orb.js:111`, `parseLocal`:** retain duration-only sleep without invented 07:00 waking. Preserve symptom details and distinguish after-sex bleeding from menstruation.
6. **`room.js:596,676`, sleep forms; `ovu-street.js:36`, opening checks:** support daytime sleep, neutral greetings and shops available around shifts.
7. **`ovu-store.js:335`, `cycleStats`; `room.js:783`, calendar:** suppress precise fertile/phase presentation when predictions are wide or unsupported.
8. **`ovu-rewards.js:73`, `award`:** remove streak bonuses. Ordinary practice currently reaches the bonus branch despite its cap (`:85-87`). Remove obsolete 15/+10 labels (`room.js:2306,2312`) and attention-policing confirmation (`:2344`).
9. **`room.js:2295`, `setPose`:** add completion actions throughout the table; preserve outfit on every fallback, including meditation and sleep.
10. **`ovu-consent.js:27`, `PURPOSES`; `ovu-agents.js:194`, summary:** disclose AI destination beside each switch; make doctor exports explicitly include bleeding impact, flush details, medicines, BP context and missing-data limits.

