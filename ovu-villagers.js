/* Rhythme villagers, Harvest Moon style (Jamie, 22 Oct 2026: "we can have NPC ... like harvest moon courting", "dishes can
 * be used to court the NPC.. We can have a relationship dating"). Design: docs/design/2026-10-22-harvest-moon-life.md, phase 4.
 * Two original villagers (not based on any real person): Shen Yuan, a gentle bookseller in the plaza, and Lu Chen, a sunny
 * boat-builder at the harbour. Talk once a day and give one gift a day from her bag (a dish counts most); friendship is 0 to
 * 100 points shown as 0 to 10 hearts, black to red as in Harvest Moon. A short heart scene plays at 2, 4, 6, 8 and 10 hearts.
 * At a red heart, with every scene seen and a dream house of her own, a blue feather lets her propose. Friendship never goes
 * down and nobody is ever upset with her. Game state only (state.villagers): it never writes a diary entry, and the only
 * hearts it spends are the feather's, through OvuRewards.spend. Pure rules first (tested in node), then the scenes.
 *
 * Talks (22 Oct): a greeting that knows the part of the day, the season of the game calendar and her friendship; then one
 * topic a day, his question with two or three replies she can pick, each answered in character. Every reply is worth the
 * same: there is no wrong answer. Topics open as the hearts grow. A gift gets a reaction that names it. The villagers know
 * only game state and the clock, never her health, her cycle or her diary. */
(function (root) {
  'use strict';
  /* each villager is drawn on her canvas at her figure height (tools/art/fit_figure.py: figure 712 px on a 720 canvas), so at
   * the layout's avatarW he reads exactly her height; wk widens a wider pose (Lu's basket). spot: his feet in plate percent,
   * on open floor where his head and chest stay clear of the plaza's sample neighbours and friends; talkAt: where she
   * stands to talk, facing him; outline: his figure on the canvas (alpha traced, dilated 5 px, every opaque pixel inside),
   * the picture is clipped to it so only the figure takes a tap. The floor he stands on is a small block at his feet in the
   * layout's solids (blockOf), the same size whatever his canvas width */
  var VILLAGERS = [
    { id: 'shen', name: 'Shen Yuan', role: 'Bookseller', img: 'villager-shen.webp', scene: 'plaza', wk: 1, spot: { x: 40, y: 52.6 }, talkAt: { x: 32.5, y: 55.6, flip: false }, /* on the tiles before the fountain's rim, between the noticeboard's and the fountain's pins so his chest takes a tap */
      outline: '45% 0.4%,27.7% 2.5%,16.7% 6.1%,8.5% 11%,2.2% 17.4%,2.5% 18.9%,6.6% 19.7%,7.9% 23.2%,12.3% 24.9%,10.4% 27.8%,12.3% 31.5%,25.5% 36%,38.1% 37.9%,28.6% 41.9%,20.8% 47.8%,13.2% 50.3%,13.8% 51.9%,11% 54.7%,13.5% 58.9%,18.2% 60.4%,25.8% 60.8%,26.1% 62.9%,28.9% 64%,32.7% 90.3%,20.8% 94%,19.8% 97.1%,24.8% 98.6%,49.4% 97.8%,54.1% 99.9%,68.6% 99.9%,72.6% 99%,73.9% 96.9%,70.4% 92.1%,73.6% 91.2%,68.2% 69.2%,73.3% 70.8%,82.1% 69.4%,85.2% 65.3%,85.5% 59.2%,71.7% 43.3%,59.1% 37.5%,69.5% 36.8%,77% 34.7%,85.8% 33.8%,89.6% 32.2%,93.1% 23.5%,96.9% 22.4%,95.6% 18.3%,97.5% 15.8%,93.7% 11.2%,87.7% 7.8%,80.5% 5.1%,70.8% 3.9%,64.8% 0.1%,60.7% 0%,58.8% 1.4%',
      loves: ['pandanrice', 'pumpkinsoup', 'strawberrybowl'], likes: ['sweetpotatoginger', 'carrotradish', 'strawberry', 'milk', 'frittata', 'hummus'],
      /* the first words of a greeting by the part of the day: [while they are getting to know each other, once they are close] */
      open: { morning: ['Good morning. The shop has only just opened.', 'Morning. I hoped you would come by.'],
        afternoon: ['Good afternoon. It is quiet in the shop today.', 'Afternoon. You arrived just as the kettle did.'],
        evening: ['Good evening. The lanterns are coming on.', 'Evening. I was about to close, but not for you.'],
        night: ['You are out late. The plaza is lovely at this hour.', 'Still up? Me too. I lost track of a good chapter.'] },
      /* then a line for how well they know each other: new, friendly, close, very close, engaged */
      body: [['I am Shen. I keep the little bookshop by the fountain.', 'If you like stories, the shelf by the window is the best one.', 'Take your time. Books never mind waiting.'],
        ['I put a new book of poems aside. I thought of you.', 'You always look at the blue covers first. I noticed.', 'Tea first, then stories.'],
        ['I saved you the window seat.', 'This one has a happy ending. I checked.', 'I found a line today that sounded like you.'],
        ['The shop feels brighter when you walk in.', 'Your cup lives on the top shelf now, next to mine.', 'I was reading, but mostly I was waiting for you.'],
        ['I wrote our names on the first page of a new notebook.', 'Every book I open lately ends with you.', 'Come and sit. The seat next to mine is yours, always.']],
      season: { spring: 'Spring makes everyone read poetry, me included.', summer: 'Summer afternoons are made for long, slow books.', autumn: 'Autumn is my favourite time for rereading old friends.', winter: 'Winter is for warm tea and short stories.' },
      topics: [
        { id: 'tea', min: 0, ask: 'Do you take your tea plain, or with something in it?', replies: [
          { id: 'plain', say: 'Plain, please.', back: 'A purist. I like that. I will remember.' },
          { id: 'honey', say: 'With honey.', back: 'Honey, of course. I will keep a jar here for you.' },
          { id: 'coffee', say: 'I am more of a coffee person.', back: 'Then I will learn to make good coffee. How hard can it be?' }] },
        { id: 'stories', min: 0, ask: 'What kind of story do you reach for first?', replies: [
          { id: 'cosy', say: 'Something cosy.', back: 'Cosy ones are my favourite to recommend. Let me find you one.' },
          { id: 'mystery', say: 'A good mystery.', back: 'I will never tell you the ending. That is a promise.' },
          { id: 'poems', say: 'Poems.', back: 'Poems! Short enough to carry around all day.' }] },
        { id: 'rain', min: 2, ask: 'Do you like the sound of rain?', replies: [
          { id: 'love', say: 'I love it.', back: 'Then come and read here on the next rainy day. The roof sings.' },
          { id: 'indoors', say: 'Only from indoors.', back: 'Indoors, with a blanket. The correct way. I agree completely.' }] },
        { id: 'shop', min: 3, ask: 'I keep wanting to rearrange the shop. What would you change?', replies: [
          { id: 'keep', say: 'Nothing. It feels like home.', back: 'You are right. I will leave it just as it is.' },
          { id: 'corner', say: 'A reading corner.', back: 'A reading corner, with a cushion. Why did I never think of that?' },
          { id: 'plants', say: 'More plants.', back: 'Plants and books together. The shop will smell like a garden.' }] },
        { id: 'small', min: 4, ask: 'What did you love doing when you were small?', replies: [
          { id: 'drawing', say: 'Drawing.', back: 'I would love to see your drawings one day, if you will show me.' },
          { id: 'trees', say: 'Climbing trees.', back: 'Brave. I only read about trees. You had the better idea.' },
          { id: 'covers', say: 'Reading under the covers.', back: 'With a torch? Me too. We would have been friends even then.' }] },
        { id: 'story', min: 5, ask: 'If you could live inside any story, which kind would it be?', replies: [
          { id: 'seaside', say: 'A little seaside town.', back: 'With a harbour and boats? That sounds a lot like here.' },
          { id: 'garden', say: 'A garden mystery.', back: 'You would solve it before chapter two. I would just enjoy the garden.' },
          { id: 'quiet', say: 'A quiet one.', back: 'Quiet stories are my favourite. Everything that matters is easier to hear.' }] },
        { id: 'writing', min: 6, ask: 'I have been writing a little. Should I keep going?', replies: [
          { id: 'yes', say: 'Yes, always.', back: 'Then I will. And you will be the first to read it.' },
          { id: 'line', say: 'Read me a line.', back: 'Only one, then. "The evening came in softly, the way you do." Please do not laugh.' }] },
        { id: 'years', min: 8, ask: 'Do you ever wonder where you will be in a few years?', replies: [
          { id: 'here', say: 'Somewhere like here.', back: 'I hope here means near this shop. It does for me.' },
          { id: 'days', say: 'I take it day by day.', back: 'Day by day is good. I would like to be in some of those days.' }] }
      ],
      /* a gift: {Gift} at the start of a sentence, {gift} in the middle; close is added once they are very close */
      gifts: { loved: ['{Gift}! You remembered. This is my favourite.', '{Gift}? You are spoiling me. Thank you, truly.'],
        liked: ['{Gift}. How lovely. Thank you.', 'Oh, {gift}. How did you know? Thank you.'],
        dish: ['You cooked {gift}? I will have it with my tea.', 'Homemade {gift}. Thank you. I will enjoy it slowly.'],
        other: ['{Gift}, for me? Thank you. I will find it a good home.', 'Thank you for the {gift}. You are very thoughtful.'],
        close: 'You always know what makes a day nicer.' },
      events: {
        2: ['Shen is sorting a box of old books.', '"Someone left these at the door. Poems, mostly."', 'He hands you a thin one with a pressed flower inside.', '"Keep it. It suits you."'],
        4: ['Shen is reading aloud to no one.', '"I practise, in case someone asks."', 'You ask. He reads you a page, slowly, and does not look up once.'],
        6: ['Shen has made tea for two.', '"I guessed you would come by. I hoped, anyway."', 'You sit together until the pot is empty.'],
        8: ['Shen walks you to the fountain at dusk.', '"I wrote something. It is not very good."', 'It is a list of small things you said that he remembered.'],
        10: ['Shen is waiting by the fountain, nervous.', '"I am better with books than words."', '"But I would like every chapter to have you in it."']
      } },
    { id: 'lu', name: 'Lu Chen', role: 'Boat-builder', img: 'villager-lu.webp', scene: 'harbour', wk: 1.145, spot: { x: 39, y: 74 }, talkAt: { x: 31.5, y: 77, flip: false }, /* on the sand by the path in from the farm, clear of the hut's and the bench's pins so his chest takes a tap */
      outline: '38.7% 0.8%,36.5% 1.8%,37.6% 3.8%,28.3% 6.4%,24.5% 5.4%,22.5% 6%,22.5% 7.4%,19.2% 7.9%,19.2% 9.2%,23.1% 10.7%,21.2% 12.1%,14.6% 13.6%,13.7% 15%,17.6% 16.4%,15.9% 18.6%,15.9% 20.7%,17.9% 22.1%,17% 23.8%,21.4% 24.7%,23.9% 27.6%,22.8% 30.7%,24.7% 32.8%,38.2% 36.7%,49.2% 38.1%,39.8% 43.2%,35.7% 48.5%,29.9% 52.5%,31.3% 54.4%,25.5% 59.3%,22.3% 60.6%,23.9% 51.4%,20.1% 50.8%,15.1% 62.4%,10.4% 62.1%,8.2% 63.1%,6% 62.2%,0% 62.9%,0% 65.1%,6.9% 71.1%,25.5% 72.6%,35.4% 71.7%,34.9% 75.7%,40.9% 76.8%,41.5% 85.4%,39.8% 88.2%,26.6% 91.7%,24.5% 93.8%,25.5% 96.4%,33% 97.8%,51.6% 97.2%,54.4% 99.4%,58.2% 99.9%,78.3% 99.3%,82.7% 97.5%,82.7% 88.2%,80.8% 86.2%,77.5% 70.7%,85.7% 70.1%,88.7% 68.2%,88.2% 56.9%,91.5% 55.6%,90.9% 50.8%,81.6% 42.5%,69.2% 37.1%,73.1% 36.9%,75.3% 35.8%,78.8% 36.1%,85.4% 32.4%,90.7% 31.5%,94.2% 29.7%,96.7% 20.8%,98.9% 20%,97.5% 16.7%,99.7% 16%,99.7% 14.6%,96.2% 13.9%,90.4% 10%,93.4% 8.9%,92.6% 7.5%,77.7% 5.1%,76.9% 2.8%,72.8% 2.2%,69.2% 0.4%,62.9% 0%,61.8% 1.4%,51.1% 0.8%,43.7% 1.5%',
      loves: ['tomatoegg', 'kangkongfry', 'pakchoynoodles'], likes: ['garlicpakchoy', 'tomatotofu', 'egg', 'carrot', 'codtomato', 'fishkebabs', 'salmoncroquettes'],
      open: { morning: ['Good morning! The tide is gentle today.', 'Morning! I was hoping you would walk this way.'],
        afternoon: ['Good afternoon! The sand is lovely and warm.', 'Afternoon! Come and see, the paint is finally dry.'],
        evening: ['Good evening! The water goes pink about now.', 'Evening! Sit a minute, the sunset is putting on a show.'],
        night: ['Out late? The lanterns on the jetty are my favourite part.', 'Still up? Me too. The sea sounds loud and calm at once.'] },
      body: [['I am Lu. I build the boats you see along the shore.', 'Mind the ropes. They like to trip new friends.', 'Breathe in. That is the sea, saying hello.'],
        ['I sanded this boat for a week. Look how smooth.', 'You walk like you have somewhere nice to be.', 'I saved you the dry end of the jetty.'],
        ['Come and watch the boats with me one day.', 'I told the gulls about you. They were impressed.', 'I painted a stripe in your colour. Did you notice?'],
        ['The harbour is nicer when you are on it.', 'I keep a spare cushion on the jetty now. For you.', 'I named a little boat after a good day we had.'],
        ['I have started building our boat. It has two seats.', 'Every tide brings you back here. I like that about tides.', 'Whatever the hour, I am glad it is you.']],
      season: { spring: 'Spring winds are the best for a first sail.', summer: 'Summer makes the shallows warm enough for paddling.', autumn: 'Autumn light makes every boat look freshly painted.', winter: 'Winter is when I mend the boats, ready for spring.' },
      topics: [
        { id: 'sea', min: 0, ask: 'Do you like the sea?', replies: [
          { id: 'love', say: 'I love it.', back: 'Then you will love it here. It is the friendliest sea I know.' },
          { id: 'shore', say: 'From the shore.', back: 'The shore is the best seat in the house. No splashes.' },
          { id: 'learning', say: 'I am getting to know it.', back: 'Good. We can get to know it together, one wave at a time.' }] },
        { id: 'colour', min: 0, ask: 'I am painting a new boat. What colour should it be?', replies: [
          { id: 'lilac', say: 'Lilac.', back: 'Lilac it is. Every harbour needs one in your colour.' },
          { id: 'blue', say: 'Sky blue.', back: 'Sky blue! Then it will match the days you visit.' },
          { id: 'yellow', say: 'Sunny yellow.', back: 'Yellow! The gulls will spot it from miles away.' }] },
        { id: 'breakfast', min: 2, ask: 'Settle something for me. What is the best breakfast?', replies: [
          { id: 'eggs', say: 'Eggs.', back: 'Eggs! Mine come out lopsided, but they taste fine.' },
          { id: 'noodles', say: 'Noodles.', back: 'Noodles for breakfast. A person after my own heart.' },
          { id: 'fruit', say: 'Fruit and yoghurt.', back: 'Very fresh. I will try it tomorrow and think of you.' }] },
        { id: 'knot', min: 3, ask: 'Want to learn a knot?', replies: [
          { id: 'teach', say: 'Teach me.', back: 'Over, under, through. There. It holds on its own now.' },
          { id: 'later', say: 'Maybe another day.', back: 'Any day. The ropes are not going anywhere, and neither am I.' }] },
        { id: 'stars', min: 4, ask: 'Do you know any stars by name?', replies: [
          { id: 'few', say: 'A few.', back: 'Then you can teach me. I only know the bright one sailors follow.' },
          { id: 'none', say: 'Not really.', back: 'Me neither. We could make up our own names for them.' }] },
        { id: 'sail', min: 5, ask: 'If we could sail anywhere, where would you go?', replies: [
          { id: 'island', say: 'A tiny island.', back: 'With one tree and a lot of quiet? I know just the kind.' },
          { id: 'new', say: 'Somewhere new.', back: 'Somewhere new. I would pack extra snacks.' },
          { id: 'bay', say: 'Just around the bay.', back: 'Around the bay is perfect. Short trips, long talks.' }] },
        { id: 'taught', min: 6, ask: 'My grandfather taught me to build boats. Who taught you something you love?', replies: [
          { id: 'family', say: 'Someone in my family.', back: 'Then they gave you something good to keep.' },
          { id: 'teacher', say: 'A teacher.', back: 'A good teacher stays with you. Mine still does.' },
          { id: 'myself', say: 'I taught myself.', back: 'All on your own? That is brilliant. I am impressed.' }] },
        { id: 'home', min: 8, ask: 'Do you ever picture a home by the water?', replies: [
          { id: 'often', say: 'Often.', back: 'Me too. Lately it has a lilac door, and you in it.' },
          { id: 'someday', say: 'Maybe one day.', back: 'One day is a good day. I can wait for it.' }] }
      ],
      gifts: { loved: ['{Gift}! That is my absolute favourite. Thank you!', 'No way, {gift}? You know me too well!'],
        liked: ['{Gift}! Thanks, that is a good one.', 'Ooh, {gift}! I was just thinking about that.'],
        dish: ['You made {gift}? I am eating it right now. Delicious.', 'Homemade {gift}! Better than anything I cook.'],
        other: ['{Gift}! Thank you. I will put it to good use.', 'For me? Thank you for the {gift}. You are kind.'],
        close: 'You always make my day.' },
      events: {
        2: ['Lu is painting a little boat lilac.', '"For you. Every harbour needs one in your colour."'],
        4: ['Lu teaches you a knot that will not slip.', '"Hold it, then let go. It holds on its own."', 'He grins when you get it right the first time.'],
        6: ['Lu has packed a picnic on the jetty.', '"I made the egg. It is lopsided. It tastes fine."', 'You eat with your feet over the water.'],
        8: ['Lu shows you a boat he has never finished.', '"I keep it for the right day."', '"I think that day is getting closer."'],
        10: ['Lu is waiting at the end of the jetty.', '"I built a lot of boats here."', '"I would like to build a life with you, if you will have me."']
      } }
  ];
  var LEVELS = [2, 4, 6, 8, 10], MAX = 100, FEATHER = 300, PARTS = ['morning', 'afternoon', 'evening', 'night'];
  /* Harvest Moon's heart colours, black to red */
  var COLOURS = [['Black', '#4a4458'], ['Purple', '#9b6fd0'], ['Blue', '#5f8fd8'], ['Yellow', '#e6b93c'], ['Orange', '#f08a4b'], ['Red', '#e8506e']];
  function byId(id) { return VILLAGERS.filter(function (v) { return v.id === id; })[0] || null; }
  function n0(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }
  function str(v, max) { return typeof v === 'string' && v.length <= (max || 40) ? v : null; }
  function topicById(v, tid) { return (v && v.topics.filter(function (t) { return t.id === tid; })[0]) || null; }
  function replyById(t, rid) { return (t && t.replies.filter(function (r) { return r.id === rid; })[0]) || null; }
  /* a villager's saved state, cleaned: unknown topics, replies and fields from an old or edited save are dropped */
  function stateOf(st, id) {
    var all = (st && st.villagers) || {}, v = all[id] || {}, me = byId(id);
    var ct = v.chat && str(v.chat.day, 10) && topicById(me, v.chat.topic), cr = ct && v.chat.reply != null ? replyById(ct, v.chat.reply) : null;
    var chat = ct && (v.chat.reply == null || cr) ? { day: v.chat.day, topic: ct.id, reply: cr ? cr.id : null } : null; /* reply null: offered today, not answered yet */
    var gave = v.gave && str(v.gave.day, 10) && str(v.gave.key) && str(v.gave.kind, 10) ? { day: v.gave.day, key: v.gave.key, kind: v.gave.kind, name: str(v.gave.name) || '' } : null;
    var heard = Array.isArray(v.heard) ? v.heard.filter(function (x, i, a) { return typeof x === 'string' && !!topicById(me, x) && a.indexOf(x) === i; }) : [];
    return { points: Math.min(MAX, n0(v.points)), talked: typeof v.talked === 'string' ? v.talked : null, gifted: typeof v.gifted === 'string' ? v.gifted : null, seen: Array.isArray(v.seen) ? v.seen.filter(function (x) { return LEVELS.indexOf(x) > -1; }) : [], engaged: !!v.engaged, chat: chat, heard: heard, gave: gave };
  }
  function hearts(points) { return Math.min(10, Math.floor(n0(points) / 10)); }
  function colour(h) { return COLOURS[Math.min(5, Math.floor(n0(h) / 2))]; }
  /* what a gift is worth: a loved thing 8 points, a liked one 5, any other dish 4, anything else 2 */
  function giftPoints(v, key, kind) { if (v.loves.indexOf(key) > -1) return 8; if (v.likes.indexOf(key) > -1) return 5; return kind === 'dish' ? 4 : 2; }
  function nextEvent(vs) { var h = hearts(vs.points); return LEVELS.filter(function (l) { return l <= h && vs.seen.indexOf(l) < 0; })[0] || null; }
  function canPropose(vs, ownsHome) { return hearts(vs.points) >= 10 && LEVELS.every(function (l) { return vs.seen.indexOf(l) > -1; }) && !!ownsHome && !vs.engaged; }
  /* pure: apply a talk or a gift to a copy of the villagers state; returns {state, gained, why} */
  function talk(all, id, day) {
    var v = byId(id); if (!v) return { ok: false, why: 'unknown villager' };
    var out = JSON.parse(JSON.stringify(all || {})), vs = stateOf({ villagers: out }, id);
    if (vs.talked && day < vs.talked) return { ok: false, why: 'clock' };
    var gained = vs.talked === day ? 0 : 3; vs.points = Math.min(MAX, vs.points + gained); vs.talked = day;
    out[id] = vs; return { ok: true, state: out, gained: gained };
  }
  function gift(all, id, day, key, kind, name) {
    var v = byId(id); if (!v) return { ok: false, why: 'unknown villager' };
    var out = JSON.parse(JSON.stringify(all || {})), vs = stateOf({ villagers: out }, id);
    if (vs.gifted === day) return { ok: false, why: v.name + ' already had a gift from you today.' };
    if (vs.gifted && day < vs.gifted) return { ok: false, why: 'clock' };
    var g = giftPoints(v, key, kind); vs.points = Math.min(MAX, vs.points + g); vs.gifted = day;
    vs.gave = { day: day, key: String(key).slice(0, 40), kind: String(kind).slice(0, 10), name: String(name || '').slice(0, 40) };
    out[id] = vs; return { ok: true, state: out, gained: g, loved: g === 8, line: giftLine(v, name, key, kind, vs.points, day) };
  }

  /* ---------- talks (pure) ---------- */
  function dayNum(day) { var t = Date.parse(String(day) + 'T00:00:00Z'); return isFinite(t) ? Math.floor(t / 864e5) : 0; }
  function pick(list, day, salt) { if (!list || !list.length) return null; var i = (dayNum(day) + (salt || 0)) % list.length; return list[(i + list.length) % list.length]; }
  /* the part of the day from the sky's phase (OvuSky.key: night, sunrise, morning, afternoon, sunset) or an hour */
  function partOfDay(k) {
    if (typeof k === 'number') return k < 5 ? 'night' : k < 12 ? 'morning' : k < 17 ? 'afternoon' : k < 19 ? 'evening' : 'night';
    return k === 'night' ? 'night' : k === 'sunset' ? 'evening' : k === 'afternoon' ? 'afternoon' : 'morning';
  }
  /* how well they know each other: 0 new (0 to 1 hearts), 1 friendly (2 to 4), 2 close (5 to 7), 3 very close (8 to 10), 4 engaged */
  function tier(points, engaged) { if (engaged) return 4; var h = hearts(points); return h < 2 ? 0 : h < 5 ? 1 : h < 8 ? 2 : 3; }
  /* his greeting: the part of the day, then a line for their friendship, then the season; the same all day */
  function greeting(v, o) {
    o = o || {}; var t = tier(o.points, o.engaged), part = PARTS.indexOf(o.part) > -1 ? o.part : 'morning';
    return [v.open[part][t >= 2 ? 1 : 0], pick(v.body[t], o.day), v.season[o.season] || ''].filter(Boolean).join(' ');
  }
  /* the topics her hearts have opened, the newest kept for last */
  function unlocked(v, points) { var h = hearts(points); return v.topics.filter(function (t) { return t.min <= h; }); }
  /* today's topic: the one offered or talked about today (pinned, so a gift that opens a new topic never swaps it); else the
   * first open one she has not heard; else one by the day */
  function topicFor(v, vs, day) {
    var pinned = vs.chat && vs.chat.day === day && topicById(v, vs.chat.topic); if (pinned) return pinned;
    var open = unlocked(v, vs.points), fresh = open.filter(function (t) { return vs.heard.indexOf(t.id) < 0; });
    return fresh[0] || pick(open, day);
  }
  /* she taps Talk: today's topic is pinned (chat.reply null) before his question shows; offering again the same day changes nothing */
  function offer(all, id, day) {
    var v = byId(id); if (!v) return { ok: false, why: 'unknown villager' };
    var out = JSON.parse(JSON.stringify(all || {})), vs = stateOf({ villagers: out }, id);
    if (vs.talked && day < vs.talked) return { ok: false, why: 'clock' };
    var t = topicFor(v, vs, day); if (!t) return { ok: false, why: 'topic' };
    if (vs.chat && vs.chat.day === day) return { ok: true, already: true, state: out, topic: t, answered: !!vs.chat.reply };
    vs.chat = { day: day, topic: t.id, reply: null }; out[id] = vs; return { ok: true, state: out, topic: t, answered: false };
  }
  /* she picks a reply to today's topic: the day's one talk (the same 3 points whatever she says; none on a day an older save
   * already counted), remembered for the rest of the day. Once answered, asking again returns that exchange unchanged */
  function answer(all, id, day, topicId, replyId) {
    var v = byId(id); if (!v) return { ok: false, why: 'unknown villager' };
    var vs = stateOf({ villagers: all || {} }, id), done = chatOf(v, vs, day);
    if (done) return { ok: true, already: true, state: JSON.parse(JSON.stringify(all || {})), gained: 0, topic: done.topic, reply: done.reply, line: done.reply.back };
    if (vs.talked && day < vs.talked) return { ok: false, why: 'clock' };
    var t = topicFor(v, vs, day); if (!t || t.id !== topicId || t.min > hearts(vs.points)) return { ok: false, why: 'topic' };
    var r = replyById(t, replyId); if (!r) return { ok: false, why: 'reply' };
    var k = talk(all, id, day); if (!k.ok) return k;
    var s = k.state[id]; s.chat = { day: day, topic: t.id, reply: r.id }; if (s.heard.indexOf(t.id) < 0) s.heard.push(t.id);
    return { ok: true, state: k.state, gained: k.gained, topic: t, reply: r, line: r.back };
  }
  /* today's talk, if she has answered: {topic, reply} */
  function chatOf(v, vs, day) { var c = vs.chat; if (!c || c.day !== day || c.reply == null) return null; var t = topicById(v, c.topic), r = replyById(t, c.reply); return t && r ? { topic: t, reply: r } : null; }
  /* the floor he stands on: a small block at his feet, added once to his layout's solids so she and the pets walk round him */
  function blockOf(v) { return { id: 'villager-' + v.id, x0: v.spot.x - 2.5, x1: v.spot.x + 2.5, y0: v.spot.y - 1.8, y1: v.spot.y + 1.2 }; }
  /* his thanks for a gift, naming it */
  function giftLine(v, name, key, kind, points, day) {
    var g = giftPoints(v, key, kind), cat = g === 8 ? 'loved' : g === 5 ? 'liked' : kind === 'dish' ? 'dish' : 'other';
    var nm = String(name || '').trim() || 'present', tpl = pick(v.gifts[cat], day) || v.gifts.other[0];
    var line = tpl.replace(/\{Gift\}/g, nm.charAt(0).toUpperCase() + nm.slice(1)).replace(/\{gift\}/g, nm.charAt(0).toLowerCase() + nm.slice(1));
    return tier(points) >= 3 ? line + ' ' + v.gifts.close : line;
  }
  var V = { VILLAGERS: VILLAGERS, LEVELS: LEVELS, MAX: MAX, FEATHER: FEATHER, COLOURS: COLOURS, PARTS: PARTS, byId: byId, stateOf: stateOf, hearts: hearts, colour: colour, giftPoints: giftPoints, nextEvent: nextEvent, canPropose: canPropose, talk: talk, gift: gift,
    partOfDay: partOfDay, tier: tier, greeting: greeting, unlocked: unlocked, topicFor: topicFor, offer: offer, answer: answer, chatOf: chatOf, giftLine: giftLine, topicById: topicById, blockOf: blockOf };
  root.OvuVillagers = V;

  /* ---------- the scenes (browser) ---------- */
  var S = root.OvuStore, R = root.OvuRoom, FM = root.OvuFarm, K = root.OvuKitchen, RW = root.OvuRewards, doc = root.document;
  if (!R || !S || !doc || !FM) return;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s); }
  function today() { return root.OvuGameTime ? root.OvuGameTime.dayKey() : S.today(); }
  function season() { return root.OvuGameTime && root.OvuGameTime.season ? root.OvuGameTime.season() : ''; }
  function part() { var k = null; try { k = root.OvuSky && root.OvuSky.key ? root.OvuSky.key() : null; } catch (e) { } return partOfDay(k || new Date().getHours()); }
  function all() { return S.state().villagers || {}; }
  function ownsHome() { var o = (RW && RW.ledger && RW.ledger().owned) || []; return ['house', 'bathhouse', 'familyhome'].some(function (h) { return o.indexOf(h) > -1; }); }
  /* every villager change runs inside the farm lock (gifts take from the same bag), reading the store fresh, and only while
   * the sheet it came from is still the one open: a change queued behind another tab never lands after she moved on */
  function locked(fn) { return FM.locked ? FM.locked(S, fn) : Promise.resolve(fn()); }
  function stillOpen(sheetId, seq) { return (!R.sheetId || R.sheetId() === sheetId) && (!R.sheetSeq || R.sheetSeq() === seq); }
  function seqNow() { return R.sheetSeq ? R.sheetSeq() : 0; }
  var CLOCK = 'The day on this phone looks earlier than your last visit.';
  function heartRow(points) {
    var h = hearts(points), c = colour(h), out = '';
    for (var i = 0; i < 10; i++) out += '<span class="ms' + (i < h ? ' fill' : ' off') + '" style="color:' + (i < h ? c[1] : '') + '">favorite</span>';
    return '<div class="vhearts" aria-label="' + h + ' of 10 hearts, ' + c[0].toLowerCase() + '">' + out + '</div>';
  }
  /* what she could give: dishes, then the basket, then the pantry */
  function bag() {
    var f = FM.farmState(S), items = [], dn = {};
    if (K && K.RECIPES) K.RECIPES.forEach(function (r) { dn[r.id] = r.name; });
    Object.keys(f.dishes || {}).forEach(function (k) { if (n0(f.dishes[k]) && dn[k]) items.push({ key: k, kind: 'dish', name: dn[k], n: n0(f.dishes[k]), img: 'assets/food/dish-' + k + '.webp' }); });
    Object.keys(f.harvest || {}).forEach(function (k) { if (n0(f.harvest[k]) && FM.CROPS[k]) items.push({ key: k, kind: 'crop', name: FM.CROPS[k].name, n: n0(f.harvest[k]) }); });
    ['egg', 'milk'].forEach(function (k) { if (n0(f.pantry && f.pantry[k])) items.push({ key: k, kind: 'pantry', name: k === 'egg' ? 'Egg' : 'Milk', n: n0(f.pantry[k]) }); });
    return items;
  }
  function takeFromBag(f, it) {
    if (it.kind === 'dish') { f.dishes = Object.assign({}, f.dishes || {}); f.dishes[it.key] = n0(f.dishes[it.key]) - 1; if (!f.dishes[it.key]) delete f.dishes[it.key]; }
    else if (it.kind === 'crop') { f.harvest[it.key] = n0(f.harvest[it.key]) - 1; if (!f.harvest[it.key]) delete f.harvest[it.key]; }
    else { f.pantry[it.key] = n0(f.pantry[it.key]) - 1; if (root.OvuRanch) { var t = root.OvuRanch.takeProduct(f, it.key, 1).farm; f.ranch = t.ranch; } }
  }
  function save(patch) { if (S.commit) S.commit(patch); else S.setState(patch); }
  /* what he is saying: today's talk if they have had it, else his greeting; then his thanks for today's gift */
  function speech(v, vs, day) {
    var c = chatOf(v, vs, day), out = c ? '<p class="vask">' + esc(c.topic.ask) + '</p><p class="vyou"><b>You</b> ' + esc(c.reply.say) + '</p><p class="vline">' + esc(c.reply.back) + '</p>'
      : '<p class="vline">' + esc(greeting(v, { points: vs.points, engaged: vs.engaged, part: part(), season: season(), day: day })) + '</p>';
    if (vs.gave && vs.gave.day === day && vs.gifted === day) out += '<p class="vline vthanks">' + esc(giftLine(v, vs.gave.name, vs.gave.key, vs.gave.kind, vs.points, day)) + '</p>';
    return out;
  }
  /* the villager's sheet. A heart scene that is due plays first, except straight after a reply or a gift: then his answer
   * shows, with Continue to the scene (o.hold); o.say moves focus to what he said */
  function openVillager(id, o) {
    o = o || {}; var v = byId(id); if (!v) return;
    var vs = stateOf(S.state(), id), day = today(), ev = nextEvent(vs);
    if (ev && !o.hold) { playEvent(v, ev); return; }
    var items = bag(), propose = canPropose(vs, ownsHome()), talked = !!chatOf(v, vs, day), sheetId = 'villager-' + id;
    R.openSheet(sheetId, v.name, v.role + (vs.engaged ? ' · engaged to you' : ''), 'favorite',
      '<div class="vcard"><img src="' + R.ART + v.img + '" alt=""><div>' + heartRow(vs.points) + '<div class="vsay" id="vSay" tabindex="-1" aria-live="polite">' + speech(v, vs, day) + '</div></div></div>' +
      '<div class="row" id="vActs">' + (ev ? '<button type="button" class="btn primary" data-v="scene"><span class="ms">favorite</span>Continue</button>' : '') +
      '<button type="button" class="btn ' + (ev ? 'soft' : 'primary') + '" data-v="talk"' + (talked ? ' disabled' : '') + '><span class="ms">chat</span>' + (talked ? 'Talked today' : 'Talk') + '</button>' +
      (propose && !ev ? '<button type="button" class="btn soft" data-v="propose"><span class="ms">favorite</span>Propose (' + FEATHER + ' hearts, a blue feather)</button>' : '') + '</div>' +
      '<h4 class="shedh"><span class="ms">redeem</span>Give a gift' + (vs.gifted === day ? ' <small>given today</small>' : '') + '</h4>' +
      (items.length ? '<div class="seedlist" id="vGifts">' + items.map(function (it, i) { return '<button type="button" class="btn soft" data-gift="' + i + '"' + (vs.gifted === day ? ' disabled' : '') + '>' + (it.kind === 'dish' ? '<img class="croppic" src="' + it.img + '" alt="">' : it.kind === 'crop' && FM.cropPic ? FM.cropPic(it.key) : '<span class="ms">' + (it.key === 'milk' ? 'water_full' : 'egg') + '</span>') + '<span><b>' + esc(it.name) + '</b><small>have ' + it.n + '</small></span></button>'; }).join('') + '</div>' : '<p class="help">Your bag is empty. Cook a dish or pick something from the farm.</p>'));
    var seq = seqNow(), acts = doc.getElementById('vActs'), gifts = doc.getElementById('vGifts'), say = doc.getElementById('vSay');
    if (o.say && say) try { say.focus({ preventScroll: true }); } catch (e) { }
    acts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
      if (b.dataset.v === 'scene') { var now = nextEvent(stateOf(S.state(), id)); if (now) playEvent(v, now); else openVillager(id); return; }
      if (b.dataset.v === 'talk') { b.disabled = true; askTopic(v, sheetId, seq); return; }
      if (b.dataset.v === 'propose') { b.disabled = true; propose_(v, sheetId, seq); }
    });
    if (gifts) gifts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gift]'); if (!b || b.disabled) return; var it = items[Number(b.dataset.gift)]; if (!it) return;
      Array.prototype.forEach.call(gifts.querySelectorAll('[data-gift]'), function (x) { x.disabled = true; }); /* one tap, one gift */
      locked(function () {
        if (!stillOpen(sheetId, seq)) return; /* she closed the sheet or moved on while another tab held the lock */
        var f = JSON.parse(JSON.stringify(FM.farmState(S))), have = it.kind === 'dish' ? n0(f.dishes && f.dishes[it.key]) : it.kind === 'crop' ? n0(f.harvest[it.key]) : n0(f.pantry && f.pantry[it.key]);
        if (!have) { R.toast('That is no longer in your bag.', 'info'); openVillager(id, { hold: true }); return; } /* another tab used it first */
        var r = gift(all(), id, today(), it.key, it.kind, it.name); if (!r.ok) { R.toast(r.why === 'clock' ? CLOCK : r.why, 'info'); openVillager(id, { hold: true }); return; }
        takeFromBag(f, it);
        try { save({ villagers: r.state, farm: f }); } catch (er) { R.toast('That could not be saved just now.', 'info'); openVillager(id, { hold: true }); return; } /* the gift and the bag in one save */
        if (R.moment) R.moment('friend', { quiet: true }); popHearts(id);
        openVillager(id, { hold: true, say: true }); /* his thanks, naming the gift, before any heart scene it opened */
      });
    });
  }
  /* she taps Talk: today's topic is pinned (in the lock), then his question and her replies show in the sheet */
  function askTopic(v, sheetId, seq) {
    locked(function () {
      if (!stillOpen(sheetId, seq)) return;
      var r = offer(all(), v.id, today()); if (!r.ok || r.answered) { if (r.why === 'clock') R.toast(CLOCK, 'info'); openVillager(v.id, { hold: true }); return; }
      if (!r.already) { try { save({ villagers: r.state }); } catch (er) { R.toast('That could not be saved just now.', 'info'); openVillager(v.id, { hold: true }); return; } }
      var t = r.topic, say = doc.getElementById('vSay'), acts = doc.getElementById('vActs'); if (!say || !acts) return;
      say.innerHTML = '<p class="vline">' + esc(t.ask) + '</p>';
      acts.innerHTML = '<div class="vreplies" role="group" aria-label="Your reply">' + t.replies.map(function (x) { return '<button type="button" class="btn soft" data-reply="' + esc(x.id) + '"><span class="ms">chat_bubble</span>' + esc(x.say) + '</button>'; }).join('') + '</div>';
      try { acts.querySelector('[data-reply]').focus({ preventScroll: true }); } catch (e) { }
      acts.addEventListener('click', function (e) {
        var b = e.target.closest('[data-reply]'); if (!b || b.disabled) return;
        Array.prototype.forEach.call(acts.querySelectorAll('[data-reply]'), function (x) { x.disabled = true; }); /* one reply */
        var reply = b.dataset.reply;
        locked(function () {
          if (!stillOpen(sheetId, seq)) return;
          var a = answer(all(), v.id, today(), t.id, reply);
          if (a.why === 'clock') R.toast(CLOCK, 'info');
          if (a.ok && !a.already) { try { save({ villagers: a.state }); } catch (er) { R.toast('That could not be saved just now.', 'info'); openVillager(v.id, { hold: true }); return; } if (R.moment) R.moment('hello', { quiet: true }); popHearts(v.id); }
          openVillager(v.id, { hold: true, say: true }); /* his answer (or, if another tab answered first, that one), before any heart scene */
        });
      });
    });
  }
  function playEvent(v, level) {
    var lines = v.events[level] || [];
    R.openSheet('villager-event', v.name, level + ' hearts', 'favorite',
      '<div class="vevent"><img src="' + R.ART + v.img + '" alt=""><div>' + lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="vEvDone"><span class="ms">favorite</span>' + (level === 10 ? 'Smile back' : 'Keep this moment') + '</button></div>');
    var seq = seqNow(), done = doc.getElementById('vEvDone');
    done.addEventListener('click', function () {
      done.disabled = true;
      locked(function () {
        if (!stillOpen('villager-event', seq)) return;
        var out = JSON.parse(JSON.stringify(all())), vs = stateOf({ villagers: out }, v.id); if (vs.seen.indexOf(level) < 0) vs.seen.push(level); out[v.id] = vs;
        try { save({ villagers: out }); } catch (er) { R.toast('That could not be saved just now.', 'info'); } popHearts(v.id); openVillager(v.id);
      });
    });
  }
  function propose_(v, sheetId, seq) {
    locked(function () {
      if (!stillOpen(sheetId, seq)) return;
      var vs = stateOf(S.state(), v.id); if (!canPropose(vs, ownsHome())) { openVillager(v.id); return; }
      var out = JSON.parse(JSON.stringify(all())); out[v.id] = Object.assign({}, vs, { engaged: true });
      try { RW.spend(FEATHER, 'blue feather for ' + v.name, { villagers: out }); } catch (e) { R.toast(e.message, 'info'); openVillager(v.id); return; } /* the feather's hearts and the engagement in one save */
      R.openSheet('villager-yes', v.name, 'Yes', 'favorite', '<div class="vevent"><img src="' + R.ART + v.img + '" alt=""><div><p>You hold out the blue feather.</p><p>' + esc(v.name.split(' ')[0]) + ' laughs, a little teary, and says yes.</p></div></div><div class="row"><button type="button" class="btn primary" id="vYes">Hold hands</button></div>');
      doc.getElementById('vYes').addEventListener('click', function () { R.hideSheet(); popHearts(v.id); });
    });
  }
  /* hearts float up from a villager when friendship grows */
  function popHearts(id) {
    if (root.OvuSound) root.OvuSound.play('pet');
    var el = doc.querySelector('#ownedProps .villager[data-id="' + id + '"]'); if (!el) return;
    for (var i = 0; i < 3; i++) { var h = doc.createElement('span'); h.className = 'lovepop'; h.innerHTML = '<span class="ms fill">favorite</span>'; h.style.left = el.style.left; h.style.top = 'calc(' + el.style.top + ' - 14%)'; h.style.setProperty('--dx', ((i - 1) * 14) + 'px'); h.style.animationDelay = (i * 90) + 'ms'; R.els.props.appendChild(h); root.setTimeout(function (x) { return function () { x.remove(); }; }(h), 1600); }
  }
  /* a tap walks her to his side, then opens his sheet, unless something else happened first: travel, another tap, an
   * activity, a visit. Where no route reaches his side she talks from where she stands (never a straight walk through things) */
  var tapTok = 0;
  function tapped(v, L) {
    var W = root.OvuWalk; if (W && W.napping && W.napping()) return; if (R.busy && R.busy()) return;
    var tok = ++tapTok, go = function () { if (tok !== tapTok || R.layout() !== L || (R.visiting && R.visiting()) || (R.busy && R.busy())) return; openVillager(v.id); };
    if (R.walkTo && W && W.canWalkTo && W.canWalkTo(v.talkAt)) R.walkTo(v.talkAt, go); else go();
  }
  function render() {
    tapTok++; /* a walk to a villager in the scene she left never opens his sheet */
    var L = R.layout(); Array.prototype.slice.call(R.els.props.querySelectorAll('.villager')).forEach(function (el) { el.remove(); });
    if (!L || (R.visiting && R.visiting())) return;
    VILLAGERS.forEach(function (v) {
      if (v.scene !== L.id) return;
      if (L.solids && !L.solids.some(function (b) { return b.id === 'villager-' + v.id; })) L.solids.push(blockOf(v)); /* once, in the layout's own list */
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'villager'; el.dataset.id = v.id; el.setAttribute('aria-label', v.name + ', ' + v.role + '. Tap to talk');
      el.style.left = v.spot.x + '%'; el.style.top = v.spot.y + '%'; el.style.width = ((L.avatarW || 12) * (v.wk || 1)).toFixed(2) + '%'; /* her own width: he is drawn on her canvas at her figure height */
      el.style.setProperty('--cs', (0.62 / (v.wk || 1)).toFixed(3)); /* his contact shadow is her footprint, whatever his canvas width */
      el.innerHTML = '<img src="' + R.ART + v.img + '" alt="" draggable="false"><span class="vname" aria-hidden="true">' + esc(v.name.split(' ')[0]) + '</span>';
      el.querySelector('img').style.clipPath = 'polygon(' + v.outline + ')'; /* only his figure takes a tap */
      el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); tapped(v, L); });
      R.els.props.appendChild(el);
    });
    if (root.OvuWalk && root.OvuWalk.sortDepth) root.OvuWalk.sortDepth(); /* ranked by his feet with her, the pets and the neighbours */
  }
  R.on('boot', function () { render(); R.on('layout', render); R.on('props', function () { if (!R.els.props.querySelector('.villager')) render(); }); R.on('activity', function () { tapTok++; }); });
  V.openVillager = openVillager; V.render = render;
})(typeof window !== 'undefined' ? window : this);
