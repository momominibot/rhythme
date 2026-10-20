/* Mindful moments (Jamie, 20 Oct 2026: "make sure all activities have mindfulness instilled plus actions from the avatar").
 * Every activity ends the same small way: she does the thing, in what she is wearing, and one line of noticing appears.
 * Lines come from the four-persona review (Codex, DeepSeek and Doubao walked Wei Ling trying to conceive, Nadia four months
 * after a birth, Siti in perimenopause and Mrs Tan after menopause; docs/debate/2026-10-20-four-personas.md). Rules for a
 * line: at most 18 words, plain and warm, no em dashes, no medical claim, no score, no streak, nothing to live up to.
 * A moment never blocks anything: it plays for a few seconds and a tap on her ends it. Pure data and two helpers, so the
 * harness can check every line and every pose. */
(function (root) {
  'use strict';
  /* pose: an action sprite in assets/room/dream (avatar-act-<pose>[-<outfit>].webp), or null for a lines-only moment */
  var MOMENTS = {
    period: { pose: 'note', lines: ['A period is information, not a grade. One slow breath for your body.', 'Whatever this cycle brings, you deserve kindness today.', 'Gaps and guesses are welcome. You noticed, and that is enough.'] },
    bleed_post: { pose: 'note', lines: ['Thank you for noting it. Getting it checked is a kind thing to do for yourself.'] },
    symptom: { pose: 'note', lines: ['Noticing is enough. Let your shoulders drop for one breath.', 'Name it, then let it be. Blank days are welcome too.', 'Your body told you something. Thank you for listening.'] },
    sleep: { pose: 'stretch', lines: ['However the night went, this morning can start gently.', 'Rest can come in small pieces. A broken night still deserves kindness.', 'Notice how rested or tired you feel, without judging the night.'] },
    wake: { pose: 'stretch', lines: ['Good morning. Feel your feet on the floor before the day begins.', 'One long stretch. Notice how your body feels right now.'] },
    food: { pose: 'eat', lines: ['Notice one flavour before the next bite.', 'A meal is care. There is nothing to grade here.', 'One bite, tasted slowly. Nothing else to do.'] },
    farmmeal: { pose: 'eat', lines: ['If you are eating now, savour one bite. Logging can wait.'] },
    weight: { pose: 'scale', lines: ['Feel your feet on the floor. This number is not you.', 'One number among many. You are so much more than it.'] },
    exercise: { pose: 'stretch', lines: ['Notice how your body feels after moving.', 'Movement that felt kind is enough. Rest counts too.'] },
    session: { pose: null, lines: ['Carry one breath of this into the next thing you do.', 'Nothing to fix. That pause was yours.'] },
    practice: { pose: null, lines: ['Two ordinary minutes, fully lived. Carry that softness with you.'] },
    /* Morning start: no claim about how long it was or what it did (Codex review of the routine, 20 Oct) */
    morning: { pose: null, lines: ['That pause was yours.', 'Carry this gentle start into the next thing you do.'] },
    lightflower: { pose: 'listen', lines: ['Notice one quiet detail around you. You can carry it into what comes next.', 'The last note has faded. Listen to what is here now.'] },
    moontap: { pose: null, lines: ['A brief pause still belongs to you.', 'Watch one ripple fade. You can leave whenever you like.'] },
    reflection: { pose: 'note', lines: ['A few words, or none, are enough.', 'These notes do not measure your worth.'] },
    luna: { pose: 'note', lines: ['Thank you for telling Luna. Be soft with yourself today.', 'You can say how today really feels. Luna is listening.'] },
    import: { pose: 'phone', lines: ['Bring only what helps you. Your record does not need to be complete.'] },
    scan: { pose: 'phone', lines: ['A label is information, not a judgement.', 'Notice one colour on your plate before the camera does.'] },
    acupressure: { pose: 'press', lines: ['Let your hands rest gently. Stop if anything hurts.', 'Notice the touch, slow and kind. Stop whenever you wish.'] },
    podcast: { pose: 'listen', lines: ['Listen, or enjoy a little quiet. Keep one kind sentence.', 'Let the words wash past. Keep what helps, leave the rest.'] },
    learn: { pose: 'read', lines: ['Take one useful idea, then pause.', 'Read slowly. Questions are welcome here.'] },
    greenhouse: { pose: 'coffee', lines: ['Notice the warmth of the cup in your hands.', 'Breathe in the steam before the first sip.'] },
    tea: { pose: 'coffee', lines: ['Hold your cup with both hands. Notice the warmth.'] },
    plant: { pose: 'tend', lines: ['Press the soil gently. Nothing else is needed.', 'A little seed is enough. Let it grow at its own pace.'] },
    weed: { pose: 'tend', lines: ['One small patch can be enough today.'] },
    farmwater: { pose: 'plants', lines: ['Watch one drop settle into the soil.', 'Notice the soil darken as it drinks.'] },
    plantcare: { pose: 'plants', lines: ['One minute with one plant is enough.', 'Notice how it looks now, cared for.'] },
    harvest: { pose: 'harvest', lines: ['Notice what grew in its own time.', 'Feel the weight of what you picked. Enjoy it.'] },
    shop: { pose: 'shop', lines: ['Enjoy it. Nothing more needs buying.', 'Notice what made you smile about it.'] },
    adopt: { pose: 'pets', lines: ['Welcome home, little one. Notice how she looks at you.'] },
    petfeed: { pose: 'pets', lines: ['Watch one happy mouthful.', 'Notice how she eats, all in.'] },
    petplay: { pose: 'pets', lines: ['Share her small excitement for a moment.'] },
    petcuddle: { pose: 'pets', lines: ['Stay for one soft breath together.'] },
    pettidy: { pose: 'pets', lines: ['One small kindness, done gently.'] },
    petdress: { pose: 'pets', lines: ['Notice what makes her look like herself.'] },
    wardrobe: { pose: 'outfit', lines: ['Choose what feels like you today. Comfort is reason enough.'] },
    reminder: { pose: 'note', lines: ['An invitation, whenever it suits you. It can always wait.'] },
    window: { pose: null, lines: ['Let your eyes rest beyond the screen for a breath.'] },
    plaza: { pose: 'wave', lines: ['Join, listen or leave. Your pace belongs to you.', 'Quiet company is welcome too.'] },
    friend: { pose: 'wave', lines: ['A little kindness needs no reply.', 'Let it land. You do not have to answer.'] },
    hello: { pose: 'wave', lines: ['A small hello is enough.'] },
    journal: { pose: 'note', lines: ['These notes are yours. They do not measure your worth.'] },
    share: { pose: 'note', lines: ['Your questions deserve space. Bring them with you.'] }
  };
  var NEW_POSES = ['note', 'eat', 'listen', 'read', 'tend', 'harvest', 'wave', 'press', 'phone', 'shop', 'scale'];
  var turn = {};
  /* lines take turns, starting at a random one, so the same words do not come back every time */
  function line(key, rnd) {
    var m = MOMENTS[key]; if (!m || !m.lines.length) return '';
    var n = m.lines.length, i = turn[key] == null ? Math.floor((typeof rnd === 'number' ? rnd : Math.random()) * n) % n : (turn[key] + 1) % n;
    turn[key] = i; return m.lines[i];
  }
  function pose(key) { var m = MOMENTS[key]; return m ? m.pose : null; }
  /* the moment for a saved entry: by type, and by kind for practice */
  function forEntry(ev, post) {
    if (!ev) return null;
    var d = ev.data || {};
    if (ev.type === 'period') return post ? 'bleed_post' : 'period';
    if (ev.type === 'mindfulness') return d.kind === 'breathtap' ? 'moontap' : d.kind === 'lightflower' ? 'lightflower' : d.kind === 'informal' ? (d.activity === 'morning' ? 'morning' : d.practice === 'greenhouse' ? 'plantcare' : 'practice') : 'session';
    return { symptom: 'symptom', sleep: 'sleep', food: 'food', exercise: 'exercise', reflection: 'reflection', weight: 'weight' }[ev.type] || null;
  }
  root.OvuMoments = { MOMENTS: MOMENTS, NEW_POSES: NEW_POSES, line: line, pose: pose, forEntry: forEntry };
})(typeof window !== 'undefined' ? window : this);
