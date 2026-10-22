/* Everyday mindfulness: short guided practices tied to things you are really
 * doing at home right now (brushing teeth, a shower, the first coffee...).
 * Each activity has more than one script so repeats stay fresh. Scripts marked
 * author 'erin' are Erin Lee's own words (brushing teeth, morning and evening,
 * 19 Oct 2026; waking up with breath and body, and a mindful sip, 21 Oct 2026),
 * voiced in her cloned voice with her consent; the rest are interim
 * text by the Rhythme team in the same voice, replaced clip by clip (same ids) as
 * her scripts arrive. The data shape is the contract:
 * activity -> variations -> steps [{ text, secs }] (+ when: morning|evening). */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var KEY_STATE = 'explored'; /* S.state().explored[activityId] = times completed */
  var ACTIVITIES = [
    { id: 'wake', name: 'Waking up with breath and body', icon: 'wb_twilight', minutes: 3, pose: 'stretch', when: 'On the edge of the bed, or standing beside it', intro: 'Erin’s three minutes to arrive in the body before the day: noticing, the breath, two small movements, stillness.',
      variations: [
        { title: 'Waking up with breath and body', when: 'morning', author: 'erin', steps: [
          { text: 'Good morning. Before moving into your day, let’s take a few moments to wake up with the body. You can sit on the edge of your bed, with your feet resting on the floor. Or, if you feel steady, standing beside your bed with your feet hip-distance apart. Keeping your eyes softly open. Allowing your posture to be comfortable and upright. Feeling the support beneath you.', secs: 38 },
          { text: 'How is the body feeling this morning? Perhaps there’s some heaviness, some stiffness, or a sense of ease. Simply acknowledging what is here. And becoming aware of the body breathing. Where do you feel the breath most clearly? At the nose, the chest, or the belly? Allowing the breath to find its own natural rhythm.', secs: 37 },
          { text: 'Let’s invite a little movement now, staying within a comfortable range. You can leave out any movement that doesn’t feel right. Slowly lifting your shoulders towards your ears. And gently lowering them. Once more, lifting… and releasing. Noticing the sensations as the shoulders move.', secs: 33 },
          { text: 'When you’re ready, slowly reaching your arms forward and upwards, only as far as feels comfortable. Perhaps feeling a gentle stretch through the arms and the sides of the body. Keeping the breath flowing naturally. And slowly lowering your arms, following the movement all the way down.', secs: 29 },
          { text: 'Returning to stillness. Noticing your hands, your shoulders, and your face. Does anything feel different? Perhaps things feel much the same. Allowing the body to be just as it is. If your mind has already moved into the day ahead, gently returning to this body, breathing. One breath at a time.', secs: 38 },
          { text: 'Feeling your feet on the floor again. Becoming aware of the room around you. And when you’re ready, carrying this gentle attention into your next activity. Thank you for practising with me. Have a gentle day ahead.', secs: 18 }
        ] }
      ] },
    { id: 'teeth', name: 'Brushing teeth', icon: 'mood', minutes: 4, pose: 'teeth', when: 'Morning or night, at the sink', intro: 'Erin’s own four minutes at the sink: a morning script and an evening one, and the room picks the one that fits the hour.',
      variations: [
        { title: 'Morning, at the sink', when: 'morning', author: 'erin', steps: [
          { text: 'Good morning. Let’s begin the day with a few moments of brushing your teeth mindfully. We’ll explore this familiar experience together, one moment at a time. You can follow your usual routine. Simply feeling your feet on the floor and noticing the toothbrush resting in your hand.', secs: 27 },
          { text: 'As you prepare your toothbrush, take a moment to notice what you can see. The colours of the brush and the toothpaste. Their shapes. Perhaps the light falling on the sink in front of you. Is there a small detail you haven’t noticed before?', secs: 26 },
          { text: 'As you bring the toothbrush towards your mouth, see if you notice a scent. Perhaps a familiar fragrance from the toothpaste. Perhaps something very faint. And if nothing is obvious, that’s okay too. When you’re ready, beginning to brush.', secs: 25 },
          { text: 'Let’s bring some attention to the sensations of brushing. The contact of the bristles with your teeth. The movement of your hand. Perhaps a vibration through the handle. Simply feeling these movements as they happen.', secs: 23 },
          { text: 'And now noticing taste. What can you sense in your mouth? Perhaps a flavour that is strong at first, or one that changes as you continue. Bringing a little curiosity to this familiar taste.', secs: 23 },
          { text: 'And what can you hear? The sound of the brush as it moves. Perhaps a gentle hum. Noticing how the sound changes as you move from one area to another.', secs: 20 },
          { text: 'You might notice your mind moving ahead to something you need to do today. When that happens, simply acknowledging where it has gone. And gently coming back to brushing. A sound. A taste. A movement. Let’s stay with this experience for a few moments, noticing whatever is most obvious to you.', secs: 38 },
          { text: 'As you finish in your own time, noticing the movements of putting your toothbrush down. Feeling your feet on the floor again. Before moving on, taking a moment to acknowledge this small act of caring for yourself. Thank you for practising with me. Have a mindful day ahead.', secs: 24 }
        ] },
        { title: 'Evening, before bed', when: 'evening', author: 'erin', steps: [
          { text: 'Good evening. Let’s bring a little awareness to brushing your teeth as you get ready for bed. Take a moment to feel how the body is here tonight. Perhaps there’s some tiredness. Perhaps the mind is still busy. Whatever you notice, we can begin just where you are.', secs: 25 },
          { text: 'As you reach for your toothbrush, noticing this familiar movement. The arm reaching. The fingers closing around the handle. Feeling its shape and texture in your hand. And as you prepare the toothpaste, perhaps becoming aware of a scent. If it’s faint or difficult to notice, simply knowing that’s how it is tonight. When you’re ready, beginning to brush.', secs: 36 },
          { text: 'Let’s listen for a few moments. What sounds tell you that brushing is happening? Perhaps the bristles moving against the teeth, or the hum of your toothbrush. Allowing the sounds to come to you as you continue.', secs: 26 },
          { text: 'And now bringing your attention into the mouth. Noticing the taste of the toothpaste. The texture of the foam. The contact of the brush. Perhaps some sensations are more obvious than others. There’s no need to notice everything. Just resting your attention with what you can feel.', secs: 33 },
          { text: 'With your eyes open, becoming aware of what is in front of you. Perhaps a colour, a reflection, or a patch of light. Simply noticing what you see, while staying connected to the movement of brushing.', secs: 24 },
          { text: 'You may find yourself going through something that happened today. Replaying a conversation, perhaps, or thinking about tomorrow. When you notice this, gently acknowledging that the mind has wandered. And coming back to the feeling of the toothbrush in your hand, or its movement in your mouth. We can begin again, right here.', secs: 30 },
          { text: 'For a little while, letting your awareness be open. A taste may become noticeable. Then a sound. Then the movement of your hand. Allowing the experience to change as you continue with your usual routine.', secs: 30 },
          { text: 'As you finish in your own time, noticing the last few movements. Putting the toothbrush down. Feeling the hand release its hold. And taking a moment to notice how the mouth feels now. Feeling your feet on the floor, and acknowledging this small act of care at the end of your day. Thank you for practising with me. Have a good rest tonight.', secs: 31 }
        ] }
      ] },
    { id: 'shower', name: 'Showering', icon: 'shower', minutes: 5, pose: 'shower', when: 'Any shower, from the first drop', intro: 'Water on skin is one of the easiest places to land in the present.',
      variations: [
        { title: 'First warmth', steps: [
          { text: 'Before the water, notice the air on your skin and the sound of the room.', secs: 20 },
          { text: 'Step in. Feel exactly where the water lands first, and how the warmth spreads.', secs: 60 },
          { text: 'Wash slowly. Let your hands do the work while your attention rests on touch and scent.', secs: 100 },
          { text: 'If a thought arrives, let the water carry it past. Return to the temperature.', secs: 80 },
          { text: 'Turn the water off and stand for three breaths before you reach for the towel.', secs: 40 }
        ] },
        { title: 'Letting the day go', steps: [
          { text: 'As the water warms, name silently one thing you are putting down for now.', secs: 30 },
          { text: 'Let the stream run over your shoulders and neck. Notice any holding, and soften there.', secs: 90 },
          { text: 'Wash from the feet up, one part at a time, as if each part deserves a little attention.', secs: 110 },
          { text: 'Finish with a slightly cooler rinse if you like, and notice the alertness it brings.', secs: 40 },
          { text: 'Dry off slowly. You arrived here, fully.', secs: 30 }
        ] }
      ] },
    { id: 'coffee', name: 'Morning coffee or tea', icon: 'local_cafe', minutes: 3, pose: 'coffee', when: 'The first warm cup', intro: 'The first cup becomes a small ceremony instead of a reflex.',
      variations: [
        { title: 'A mindful sip to begin your day', when: 'morning', author: 'erin', steps: [
          { text: 'Good morning. Let’s take a few moments to enjoy your morning drink with awareness. Whether you have coffee, tea, water, or something else, allowing yourself to settle wherever you are. Feeling the support beneath you. Noticing your drink in front of you.', secs: 28 },
          { text: 'Before reaching for it, take a moment to look. Noticing the colour of the drink, the surface of the liquid, or the shape of the cup. Perhaps there is steam rising. Perhaps a reflection of light. Simply noticing what catches your attention.', secs: 27 },
          { text: 'And now, gently bringing your hand to the cup or glass. Feeling its texture against your fingers. Becoming aware of its temperature and weight as you lift it. As you bring it closer, is there a scent you can notice? Perhaps something familiar. Perhaps very little. There’s no need to search for anything.', secs: 32 },
          { text: 'When the temperature feels comfortable, taking a small sip. Noticing the first contact with your lips, and the following sensations as the drink enters your mouth. What can you taste? Allowing yourself a moment to experience the flavour and texture, swallowing whenever you’re ready.', secs: 33 },
          { text: 'Gently lowering your cup. Does any taste linger? Perhaps a sensation of warmth or coolness. Noticing how the experience continues to change, even between sips. You might notice an impulse to take another sip straight away. Simply becoming aware of that impulse, and choosing when to lift your cup again.', secs: 34 },
          { text: 'Taking another sip in your own time. If your mind wanders towards the day ahead, gently returning to the sensations of drinking. The touch of the cup. An aroma. A taste. The feel of swallowing. One sip at a time.', secs: 29 },
          { text: 'As you continue with your drink, allowing this gentle awareness to stay with you. There may be more moments like these to notice in your morning routine. Thank you for practising with me. Have a gentle day ahead.', secs: 17 }
        ] },
        { title: 'Three sips', steps: [
          { text: 'Sit, or stand by a window. Let the cup rest a moment before you drink.', secs: 25 },
          { text: 'First sip: only the temperature.', secs: 35 },
          { text: 'Second sip: only the flavour, as it changes across the tongue.', secs: 45 },
          { text: 'Third sip: notice how your body receives it. The swallow, the warmth going down.', secs: 50 },
          { text: 'The rest of the cup is yours to enjoy however you like.', secs: 25 }
        ] }
      ] },
    { id: 'dishes', name: 'Washing the dishes', icon: 'countertops', minutes: 5, pose: 'dishes', when: 'After a meal, at the sink', intro: 'A chore becomes a hand practice: water, weight, warmth.',
      variations: [
        { title: 'One plate at a time', steps: [
          { text: 'Run the water and notice the temperature on your hands before the first dish.', secs: 20 },
          { text: 'Pick up one plate. Feel its weight. Wash it as if it were the only one.', secs: 70 },
          { text: 'When the mind lists what is left, come back to the plate in your hands.', secs: 90 },
          { text: 'Notice the sounds: water, the clink, the squeak of clean.', secs: 80 },
          { text: 'Dry your hands slowly. Look at the clear counter for a breath.', secs: 40 }
        ] },
        { title: 'Warm water practice', steps: [
          { text: 'Soften your knees and your jaw. Let your weight settle into your feet.', secs: 20 },
          { text: 'Wash with slightly slower movements than usual. Notice what changes.', secs: 100 },
          { text: 'Each rinse is a small ending. Let it be complete before the next begins.', secs: 100 },
          { text: 'Finish the last item, turn off the tap, and listen to the quiet.', secs: 50 },
          { text: 'Done, and present for all of it.', secs: 30 }
        ] }
      ] },
    { id: 'outfit', name: 'Changing outfits', icon: 'checkroom', minutes: 2, pose: 'outfit', when: 'Getting dressed, morning or evening', intro: 'Choosing what to wear can be kind rather than critical.',
      variations: [
        { title: 'How do I want to feel', steps: [
          { text: 'Before you choose, ask quietly: how do I want to feel today?', secs: 20 },
          { text: 'Touch the fabric before you put it on. Notice its weight and texture.', secs: 30 },
          { text: 'As you dress, notice each movement: the arm through the sleeve, the fastening.', secs: 45 },
          { text: 'Look once in the mirror with the same kindness you would give a friend.', secs: 15 },
          { text: 'Ready. You dressed your body with attention today.', secs: 10 }
        ] },
        { title: 'Slow fastenings', steps: [
          { text: 'Lay out what you will wear. Notice the colours together.', secs: 25 },
          { text: 'Dress one item at a time, feeling the fabric settle on your skin.', secs: 50 },
          { text: 'Do up buttons or zips a little slower than usual. Feel your fingers work.', secs: 30 },
          { text: 'Stand tall for one breath before you move on.', secs: 15 }
        ] }
      ] },
    { id: 'bed', name: 'Making the bed', icon: 'bed', minutes: 2, pose: 'bed', when: 'Right after getting up', intro: 'Two minutes of order that your evening self will thank you for.',
      variations: [
        { title: 'Smooth and tuck', steps: [
          { text: 'Pull back the covers and notice the cool air reaching the sheets.', secs: 20 },
          { text: 'Smooth the sheet with both palms. Feel the fabric and the small resistance of each crease.', secs: 40 },
          { text: 'Shake the pillow once and set it down gently, as a gift to tonight.', secs: 30 },
          { text: 'Straighten the quilt. Step back and look. Take one slow breath.', secs: 30 }
        ] },
        { title: 'Beginning the day', steps: [
          { text: 'Open the curtain or a window first if you can. Notice the light.', secs: 20 },
          { text: 'Make each side of the bed in turn, moving slowly enough to feel your arms work.', secs: 60 },
          { text: 'Place the pillows and rest your hand on the bed for a moment. The day can begin.', secs: 40 }
        ] }
      ] },
    { id: 'plants', name: 'Watering plants', icon: 'potted_plant', minutes: 2, pose: 'plants', when: 'Whenever the soil feels dry', intro: 'Caring for something green slows the hands and the mind.',
      variations: [
        { title: 'Look before you pour', steps: [
          { text: 'Before watering, look at the plant properly. New leaf? A dry edge? Just notice.', secs: 25 },
          { text: 'Touch the soil. Feel whether it is dry, cool or damp.', secs: 20 },
          { text: 'Pour slowly and watch the water disappear into the soil.', secs: 45 },
          { text: 'Turn the pot a little toward the light. One small kindness.', secs: 20 },
          { text: 'Done. Growth is quiet work too.', secs: 10 }
        ] },
        { title: 'Small gardener', steps: [
          { text: 'Fill the can and feel its weight change as the water rises.', secs: 25 },
          { text: 'Water each plant in turn, listening to the sound the water makes.', secs: 60 },
          { text: 'Pinch off anything dry if you like. Thank the plant, silently or out loud.', secs: 35 }
        ] }
      ] },
    { id: 'pets', name: 'Feeding your pet', icon: 'pets', minutes: 2, pose: 'pets', when: 'Breakfast or dinner for them', intro: 'Your pet is already fully present. Join them for a minute.',
      variations: [
        { title: 'Their happiest moment', steps: [
          { text: 'Before you open the food, notice how your pet is waiting. The eyes, the tail, the sounds.', secs: 25 },
          { text: 'Prepare the bowl slowly. Smell, texture, the scoop. Let it be unhurried.', secs: 40 },
          { text: 'Set it down and simply watch them eat for a little while. Nothing else to do.', secs: 45 },
          { text: 'Notice what their contentment does in your own chest.', secs: 20 }
        ] },
        { title: 'Shared breakfast', steps: [
          { text: 'Say their name and wait for them to look at you.', secs: 15 },
          { text: 'Fill the bowl with attention, as if preparing a meal for a friend.', secs: 40 },
          { text: 'Sit nearby while they eat. Match three breaths to the sound of them eating.', secs: 50 },
          { text: 'Refill the water. Done.', secs: 15 }
        ] }
      ] },
    { id: 'stretch', name: 'Morning or evening stretch', icon: 'self_improvement', minutes: 4, pose: 'stretch', when: 'Standing, anywhere with arm room', intro: 'A gentle reach and release, nothing athletic.',
      care: 'Move only as far as feels comfortable. With osteoporosis, a sore back or after recent surgery, keep any forward bend small or stay upright with your hands on your thighs.',
      variations: [
        { title: 'Reach and release', steps: [
          { text: 'Stand with feet hip-width apart. Breathe in and float both arms up overhead.', secs: 30 },
          { text: 'Breathe out and let the arms drift down. Repeat three times, slowly.', secs: 60 },
          { text: 'Roll the shoulders back five times, then forward five times.', secs: 50 },
          { text: 'Tilt the head gently ear to shoulder, each side, breathing into the stretch.', secs: 50 },
          { text: 'Shake out the hands, stand still, and notice how you feel now.', secs: 50 }
        ] },
        { title: 'Evening unwind', steps: [
          { text: 'Reach up and yawn if it comes. Let the ribs expand.', secs: 30 },
          { text: 'Fold forward softly, knees bent, and let the head hang. Breathe into the back.', secs: 60 },
          { text: 'Roll up slowly, one vertebra at a time, head last.', secs: 40 },
          { text: 'Circle the hips a few times each way, loosening the lower back.', secs: 60 },
          { text: 'Finish standing tall. The day can soften now.', secs: 50 }
        ] }
      ] }
  ];
  function byId(id) { return ACTIVITIES.filter(function (a) { return a.id === id; })[0] || null; }
  function explored() { return S.state()[KEY_STATE] || {}; }
  function timesDone(id) { return explored()[id] || 0; }
  /* pick the variation for now: a script marked for this part of the day wins (morning before 3 pm, evening after);
   * otherwise rotate so repeats stay fresh */
  function partOfDay(d) { var h = (d || new Date()).getHours(); return h >= 4 && h < 15 ? 'morning' : 'evening'; } /* after midnight is still the night before: the evening script */
  function nextVariation(a, d) { var pod = partOfDay(d), timed = a.variations.filter(function (v) { return v.when === pod; }); if (timed.length) return timed[0]; var n = timesDone(a.id); return a.variations[n % a.variations.length]; }
  function totalSecs(v) { return v.steps.reduce(function (t, s) { return t + s.secs; }, 0); }
  /* called after a practice is confirmed; returns the saved event */
  function complete(id, variationIndex, secsDone, confirmed, finished) {
    var a = byId(id); if (!a) return null;
    var ex = Object.assign({}, explored()); var first = !ex[id]; ex[id] = (ex[id] || 0) + 1;
    var minutes = Math.round(secsDone / 6) / 10; /* the time she practised, not rounded up to a minute (Codex sweep, 21 Oct) */
    /* The exploration count and entry land together, or neither changes on this phone. */
    var ev = S.add('mindfulness', S.today(), { kind: 'informal', activity: id, activityName: a.name, variation: variationIndex, minutes: minutes, completed: finished === undefined ? true : !!finished, confirmedReal: !!confirmed, guide: (a.variations[variationIndex] && a.variations[variationIndex].author === 'erin') ? 'Everyday mindfulness, Erin’s own script in her voice' : 'Everyday mindfulness, Erin’s voice (interim script)', first: first }, 'room', { statePatch: { explored: ex } });
    return { event: ev, first: first, count: ex[id] };
  }
  root.OvuMindful = { ACTIVITIES: ACTIVITIES, byId: byId, explored: explored, timesDone: timesDone, nextVariation: nextVariation, partOfDay: partOfDay, totalSecs: totalSecs, complete: complete };
})(window);
