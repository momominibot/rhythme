/* Rhythme community plaza: a fountain, lanterns, a noticeboard, a tea stall and two benches, with
 * neighbours standing about. Until accounts land the neighbours are samples, kept behind
 * OvuCommunity.neighbours() so real friends can be plugged in without touching the scene. Visiting a
 * neighbour applies her home layout as a read-only visit: hotspots are inert, your own props are not
 * drawn, and nothing you tap there writes to anyone's diary. Pure data and rules first (testable in
 * node), then the scene wiring, which mounts when room.js announces boot through window.OvuRoom. */
(function (root) {
  'use strict';
  /* ---------- samples until accounts exist ---------- */
  var NEIGHBOURS = [
    { id: 'mei', name: 'Mei', outfit: 'kebaya-blue', pet: { id: 'corgi', img: 'prop-corgi.webp', name: 'Butter', w: 8.5 }, home: 'house', spot: { x: 42, y: 60, flip: false }, petSpot: { x: 35, y: 62 }, line: 'Lovely light today. My plot is almost in bloom.', sample: true },
    { id: 'nadia', name: 'Nadia', outfit: 'kebaya-green', pet: { id: 'catginger', img: 'prop-cat-ginger.webp', name: 'Teh', w: 8 }, home: 'bathhouse', spot: { x: 54, y: 55, flip: true }, petSpot: { x: 60, y: 60 }, line: 'I sit by the fountain when my head is full. It helps.', sample: true },
    { id: 'priya', name: 'Priya', outfit: 'cozy', pet: { id: 'shiba', img: 'prop-shiba.webp', name: 'Momo', w: 8.5 }, home: 'familyhome', spot: { x: 24, y: 60, flip: true }, petSpot: { x: 16, y: 60 }, line: 'Tea first, then everything else.', sample: true },
    { id: 'sofia', name: 'Sofia', outfit: 'party', pet: { id: 'cat', img: 'prop-cat.webp', name: 'Pudding', w: 8 }, home: 'house', spot: { x: 80, y: 62, flip: true }, petSpot: { x: 74, y: 63 }, line: 'Three slow breaths on the bench. That is my whole plan.', sample: true }
  ];
  /* the one seam for real people: ovu-friends.js hands over the plaza-card holders in her group,
   * [{id, real, handle, name, outfit, friend, spot}]; while any are shown the samples step aside, so a sample is never
   * mistaken for a person */
  var people = null, openPerson = null;
  function neighbours() { var real = people ? people() : null; return real && real.length ? real : NEIGHBOURS.slice(); }
  function neighbour(id) { return neighbours().filter(function (n) { return n.id === id; })[0] || null; }
  function setPeople(fn, open) { people = typeof fn === 'function' ? fn : null; openPerson = typeof open === 'function' ? open : null; }
  /* gentle prompts for the noticeboard, one per day, chosen by the date so everyone sees the same one */
  var PROMPTS = [
    'Notice three sounds on the way home today.',
    'One kind sentence to yourself before bed. That is all.',
    'Drink a glass of water before your next coffee.',
    'Step outside for two minutes of daylight, no phone.',
    'Stretch your neck, slowly, each side, while the kettle boils.',
    'Tell someone one small thing that went right today.',
    'Put your feet up for five minutes. Really up.',
    'Write down what you are carrying. It can wait on paper.',
    'Walk the long way round once today, just because.',
    'Breathe out longer than you breathe in, four times.',
    'Eat one meal today without a screen.',
    'Say no to one thing that does not need you today.',
    'Open a window. Let the room breathe with you.',
    'A warm drink, held with both hands, for a whole minute.'
  ];
  var NOTES = [
    { by: 'Mei', text: 'The bench under the blossom tree gets the evening light. Try it around six.', sample: true },
    { by: 'Nadia', text: 'Sat by the fountain for two minutes and just listened. The water sounds like rain.', sample: true }, /* no sample note claims a remedy worked (four-persona review, 20 Oct) */
    { by: 'Priya', text: 'Day 12 of watering. The plot has leaves! No pressure, it waits for you.', sample: true }
  ];
  function dayIndex(iso) { var t = Date.parse((iso || '1970-01-01') + 'T00:00:00Z'); return Math.floor(t / 86400000); }
  function promptFor(iso) { var i = dayIndex(iso) % PROMPTS.length; return PROMPTS[(i + PROMPTS.length) % PROMPTS.length]; }
  /* each look's outline on its canvas (tools/art/fit_figure.py --trace: alpha traced, dilated 5 px, every opaque pixel inside):
   * a neighbour's picture is clipped to it, which changes nothing you see but lets a tap on the empty canvas beside her reach
   * the villager, the floor or the pin behind (22 Oct: Mei's canvas took most taps meant for Shen) */
  var OUTLINE = {
    base: '77.7% 0%,61% 0.4%,56% 1.5%,53.1% 3.3%,36.2% 3.6%,22% 6.2%,6.9% 13.1%,0.3% 18.5%,0% 22.5%,7.5% 28.5%,1.9% 33.3%,2.8% 36.4%,10.7% 39.6%,10.1% 40.8%,11.6% 41.2%,16.7% 40.1%,16.4% 38.5%,11.9% 36.5%,12.3% 34.3%,20.1% 37.2%,29.2% 38.8%,26.7% 42.2%,3.1% 58.8%,3.5% 62.4%,0.6% 64.6%,2.8% 69.2%,7.5% 70.6%,11% 70%,10.7% 72.5%,21.1% 74.6%,23.9% 82.5%,23% 86.5%,25.2% 89.2%,15.4% 94.2%,14.8% 97.2%,17.9% 98.2%,29.2% 98.8%,36.5% 97.8%,40.3% 99.4%,55.3% 99.9%,67.6% 97.2%,65.1% 90.6%,67.3% 86%,61.3% 78.5%,60.7% 75%,69.2% 73.8%,70.8% 72.2%,74.8% 72.5%,80.8% 71%,83.6% 67.8%,81.8% 64.9%,83.3% 61.5%,66% 45.3%,60.7% 42.2%,60.4% 40%,67.9% 43.1%,72.3% 42.8%,78.6% 40.8%,79.2% 38.3%,76.7% 37.2%,87.1% 33.2%,92.5% 29%,91.8% 19%,95.9% 18.6%,99.7% 16.8%,99.4% 14.6%,96.2% 14.2%,97.2% 8.9%,95.6% 6.9%,82.7% 1.1%',
    sundress: '77.7% 0%,61.3% 0.4%,56.9% 1.2%,53.1% 3.3%,38.4% 3.5%,23.3% 6%,6.9% 13.1%,0.3% 18.5%,0% 22.6%,7.5% 28.6%,2.2% 32.9%,1.9% 35.6%,10.7% 39.6%,10.1% 40.8%,12.9% 41.4%,16.7% 40.1%,16.4% 38.5%,11.6% 36.1%,12.3% 34.3%,19.5% 37.1%,34.3% 39.2%,23.9% 42.4%,15.7% 46.9%,14.8% 49.9%,16.7% 52.8%,2.2% 66.9%,3.1% 69.4%,8.8% 70.6%,10.1% 72.6%,21.7% 75%,25.2% 89%,15.4% 94%,14.8% 97.2%,18.2% 98.2%,30.8% 98.6%,36.5% 97.8%,39.6% 99.3%,54.7% 99.9%,65.7% 98.2%,67.9% 96.8%,65.1% 90.1%,65.1% 83.9%,60.7% 75%,78.9% 71.7%,81.8% 70.3%,81.8% 68.2%,70.4% 53.9%,72.6% 47.9%,67.3% 44%,55.7% 39.7%,60.7% 39.9%,68.2% 43.2%,78.9% 40.7%,79.2% 38.3%,76.4% 37.4%,87.7% 32.9%,92.8% 28.6%,91.8% 19%,97.2% 18.3%,99.7% 16.9%,99.4% 14.6%,96.2% 14.2%,96.2% 7.4%,82.1% 1%',
    cozy: '77.7% 0%,61.3% 0.4%,52.8% 3.3%,36.5% 3.6%,23.3% 6%,6.9% 13.1%,0.6% 17.9%,0% 22.6%,7.5% 28.6%,1.9% 33.2%,2.8% 36.4%,10.7% 39.6%,10.1% 40.7%,11.9% 41.2%,16.7% 40.1%,16.4% 38.5%,11.6% 36.1%,12.3% 34.3%,19.2% 36.9%,28.6% 38.6%,24.2% 41%,24.2% 43.3%,10.7% 54.2%,3.5% 58.3%,3.5% 62.5%,1.3% 64.6%,2.8% 69.2%,6.9% 70.4%,15.1% 69.2%,14.8% 71.8%,21.1% 73.8%,25.2% 87.2%,12.6% 94.9%,12.6% 96.8%,17.9% 98.1%,28.6% 98.6%,36.2% 97.5%,39.6% 99.2%,57.9% 99.9%,70.8% 97.2%,67.6% 89.7%,65.4% 88.5%,65.7% 83.9%,61.3% 78.2%,60.7% 73.8%,64.5% 72.8%,64.5% 70.4%,72% 72.4%,81.1% 70.7%,83.3% 67.6%,81.8% 64.9%,83.3% 61%,71.7% 50.8%,70.4% 43.1%,78.6% 40.8%,79.6% 38.8%,76.7% 37.2%,85.2% 34.2%,91.5% 30.1%,93.4% 26.2%,91.8% 19%,96.5% 18.5%,99.7% 16.9%,99.4% 14.6%,96.2% 14.2%,96.2% 7.4%,83.3% 1.4%',
    yoga: '77.4% 0%,61.3% 0.4%,56.9% 1.2%,53.1% 3.3%,38.4% 3.5%,24.5% 5.7%,18.6% 7.4%,6.9% 13.1%,0.3% 18.3%,0% 22.6%,7.5% 28.6%,2.2% 32.9%,1.9% 35.6%,10.7% 39.6%,10.1% 40.8%,12.9% 41.4%,16.7% 40.1%,16.4% 38.5%,11.6% 36.1%,12.3% 34.3%,22% 37.6%,35.8% 39.3%,28.6% 41.1%,22.6% 44.2%,2.2% 66.9%,3.1% 69.4%,6.6% 70.4%,13.2% 69.7%,17.9% 67.1%,26.4% 88.3%,15.1% 94.2%,14.5% 97.1%,17.3% 98.1%,31.1% 98.6%,36.5% 97.8%,39.9% 99.3%,55% 99.9%,67.9% 97.2%,66.4% 91%,63.8% 89.4%,64.8% 82.8%,60.7% 76.7%,61.3% 69.7%,64.2% 69.3%,66.4% 71.4%,74.5% 72.5%,80.8% 71%,81.8% 68.2%,63.8% 44.2%,57.2% 41%,51.9% 39.7%,60.1% 39.7%,68.6% 43.2%,78.9% 40.7%,79.2% 38.3%,76.4% 37.4%,87.7% 32.9%,92.8% 28.6%,91.8% 19%,97.2% 18.3%,99.7% 16.9%,99.4% 14.6%,96.2% 14.2%,96.2% 7.4%,82.1% 1%',
    party: '79.2% 0%,64.5% 0.4%,60.4% 1.2%,56.9% 3.3%,41.9% 3.6%,28% 6.4%,14.7% 12.9%,8.4% 18.5%,8.1% 22.6%,15% 28.6%,10.1% 32.9%,9.8% 35.6%,17.9% 39.6%,17.3% 40.8%,20.2% 41.4%,23.4% 40.3%,23.1% 38.5%,18.8% 36.1%,19.4% 34.3%,28.9% 37.8%,41% 39.3%,40.5% 40.4%,34.4% 41.2%,29.5% 44%,15.9% 58.8%,0% 71%,0.6% 73.1%,6.6% 76%,19.1% 78.8%,29.8% 79.4%,31.5% 89.4%,21.7% 95.3%,21.7% 97.2%,25.4% 98.3%,34.7% 98.8%,41.9% 97.6%,45.4% 99.4%,58.4% 99.9%,68.2% 98.2%,69.9% 97.4%,70.2% 93.8%,65% 79.2%,68.2% 78.6%,72.5% 79.3%,90.2% 76.4%,94.5% 73.6%,78% 60.7%,65.6% 43.5%,56.4% 39.9%,63.3% 39.7%,67.6% 42.5%,70.8% 43.2%,78% 41.9%,81.2% 40%,80.9% 38.3%,78.3% 37.4%,87.6% 33.6%,93.4% 28.6%,92.5% 19%,96.5% 18.6%,99.7% 16.9%,99.7% 14.9%,96.5% 14.2%,97.1% 8.2%,84.7% 1.4%',
    'kebaya-blue': '62.8% 0%,48.9% 0.6%,43% 3.3%,29.8% 3.6%,18.1% 6.2%,5.6% 13.2%,0.5% 18.2%,0.3% 22.9%,6.1% 27.5%,1.5% 35.1%,8.9% 39.7%,8.1% 40.8%,10.7% 41.4%,13.7% 40.1%,13.2% 38.3%,9.7% 36.2%,9.9% 34.3%,17.8% 37.6%,28.2% 39.2%,18.1% 43.9%,9.4% 56.7%,3.3% 63.2%,2.3% 69.2%,4.3% 70.3%,10.2% 69.9%,12.2% 68.5%,14% 69.7%,14% 91.4%,16.8% 92.8%,13.7% 94.3%,12.5% 97.2%,16% 98.3%,24.7% 98.6%,30.3% 97.5%,30.5% 98.8%,33.3% 99.6%,44% 99.9%,52.7% 98.1%,54.2% 96.8%,53.2% 93.1%,55.2% 90.7%,50.4% 78.6%,50.9% 70.8%,52.4% 68.9%,54.2% 71.5%,58.5% 72.5%,63.4% 71.9%,66.2% 70.6%,66.7% 65.7%,53.9% 44.7%,44.3% 39.6%,49.1% 39.9%,52.9% 42.6%,55.5% 43.2%,63.9% 40.8%,64.4% 38.5%,62.1% 37.4%,70.7% 33.2%,75.3% 28.6%,74.6% 19%,78.4% 18.5%,81.2% 16.4%,80.9% 14.9%,78.1% 14.2%,77.9% 7.2%,66.9% 1.1%',
    'kebaya-green': '77.7% 0%,61.3% 0.4%,56.9% 1.2%,53.1% 3.3%,36.5% 3.6%,21.7% 6.4%,7.2% 12.9%,0.3% 18.3%,0% 22.6%,7.5% 28.6%,2.2% 32.9%,1.9% 35.4%,11% 39.7%,10.1% 40.8%,12.9% 41.4%,16.7% 40.1%,16.4% 38.5%,11.6% 36.1%,12.3% 34.3%,22% 37.6%,35.2% 39.2%,23.3% 42.9%,3.8% 63.2%,2.2% 66.9%,3.1% 69.4%,6.6% 70.4%,12.9% 69.7%,17.3% 67.2%,18.9% 91.4%,22% 92.6%,17.3% 94.4%,15.7% 97.4%,19.8% 98.3%,28.9% 98.8%,36.8% 97.5%,40.3% 99.4%,53.8% 99.9%,66% 97.4%,64.8% 92.9%,67.3% 91%,62.3% 78.5%,62.6% 68.6%,64.8% 68.9%,66.7% 71.5%,75.5% 72.4%,81.8% 70.3%,82.1% 65.6%,65.4% 44%,54.7% 39.7%,60.7% 39.9%,65.7% 42.8%,68.6% 43.2%,78.6% 40.8%,79.6% 38.8%,76.4% 37.4%,87.7% 32.9%,92.8% 28.6%,91.8% 19%,97.2% 18.3%,99.7% 16.9%,99.7% 14.9%,96.2% 14.3%,96.2% 7.4%,82.4% 1.1%',
    'kebaya-red': '62.9% 0%,49.3% 0.4%,42.6% 3.3%,30% 3.5%,17.5% 6.2%,6% 12.5%,0.3% 17.9%,0% 22.2%,6% 27.8%,1.3% 32.9%,2.3% 35.7%,8.6% 38.8%,8.1% 39.9%,9.7% 40.4%,13.6% 39.3%,13.3% 37.6%,9.4% 35.3%,9.9% 33.6%,15.7% 36.2%,27.4% 38.3%,18.5% 42.1%,3.1% 61.7%,1.8% 65.3%,2.3% 67.8%,6% 69%,10.7% 68.2%,13.6% 66.1%,13.8% 89.3%,17.2% 90.7%,13.8% 92.2%,12.5% 95.1%,15.4% 96.1%,24.5% 96.5%,30% 95.4%,31.6% 97.1%,42% 97.8%,52% 96.1%,54% 95%,53% 91.1%,55.1% 88.8%,50.4% 76.4%,50.9% 66.8%,52.5% 67.1%,53.8% 69.9%,61.6% 70.7%,66.1% 69%,66.3% 63.7%,53.5% 43.2%,44.4% 38.8%,49.1% 39%,52.7% 41.7%,55.4% 42.2%,64% 39.9%,64.5% 37.8%,62.1% 36.5%,68.9% 33.6%,74.9% 28.6%,75.7% 22.9%,74.4% 18.6%,78.9% 17.9%,81.2% 16%,80.9% 14.6%,78.1% 13.9%,77.8% 6.9%,67.6% 1.4%',
    pajamas: '77.4% 0%,61.3% 0.4%,56.9% 1.2%,53.1% 3.3%,38.4% 3.5%,24.5% 5.7%,18.6% 7.4%,6.9% 13.1%,0.3% 18.3%,0% 22.6%,7.5% 28.6%,1.9% 33.3%,2.8% 36.4%,10.7% 39.6%,10.1% 40.8%,12.3% 41.4%,16.7% 40.1%,16.4% 38.5%,11.6% 36.1%,12.3% 34.3%,19.5% 37.1%,32.7% 39%,25.2% 41.7%,0.6% 64%,4.1% 69.9%,8.5% 70.4%,17% 69.4%,17.9% 85%,14.8% 86.2%,16% 90.6%,12.6% 92.4%,11.6% 95.3%,12.9% 97.1%,17.9% 98.2%,29.2% 98.6%,36.2% 97.9%,40.9% 99.4%,54.7% 99.9%,69.2% 96.9%,69.8% 94.6%,66% 92.8%,68.9% 91.4%,69.2% 88.2%,64.5% 70.7%,72.3% 72.5%,78.9% 71.7%,81.8% 70.3%,84% 65.8%,68.6% 47.5%,57.9% 39.6%,68.6% 43.2%,78.9% 40.7%,79.2% 38.3%,76.4% 37.4%,87.7% 32.9%,92.8% 28.6%,91.8% 19%,97.2% 18.3%,99.7% 16.9%,99.4% 14.6%,96.2% 14.2%,96.2% 7.4%,83.3% 1.4%',
    tudung: '47.2% 0%,38.7% 1.1%,27.4% 4%,19.8% 7.5%,14.5% 12.2%,12.3% 17.5%,12.9% 23.9%,21.7% 36.4%,16.7% 42.4%,17.3% 45.7%,2.8% 60.6%,6.6% 62.9%,6.6% 67.2%,10.4% 68.3%,17.6% 67.4%,15.1% 74.7%,19.2% 76.1%,16.4% 92.2%,18.9% 93.3%,17% 97.5%,25.8% 98.9%,43.1% 97.8%,45% 99.3%,49.1% 99.9%,63.8% 99.9%,73.9% 98.2%,75.2% 95.3%,82.1% 93.6%,77.4% 77.1%,80.8% 76%,78.3% 69.4%,82.7% 70.1%,89.3% 69.4%,92.5% 68.1%,92.5% 65.3%,96.5% 63.6%,85.5% 51.9%,88.1% 49.6%,96.5% 19.9%,90.9% 10%,80.5% 4.3%,63.2% 0.3%',
    gown: '72.2% 0%,59.2% 0.3%,53.8% 3.2%,42.6% 3.3%,33.9% 5.4%,27.4% 8.3%,17.3% 16.5%,15.9% 22.1%,21.3% 27.2%,21.1% 29.3%,17.3% 33.5%,17.9% 36.1%,23.8% 39.4%,23.1% 40.6%,24.7% 41.1%,28% 39.9%,27.8% 38.3%,24.7% 36.4%,24.7% 34.2%,30.5% 37.1%,41.7% 39.4%,35.7% 41.2%,33% 43.6%,29.1% 51.8%,23.3% 59.2%,18.2% 63.3%,17.7% 66%,20.6% 67.4%,11.2% 80.1%,6.7% 88.9%,0.7% 91.2%,1.3% 94%,8.7% 96.9%,14.3% 97.6%,31.4% 97.2%,35% 98.8%,42.4% 98.2%,44.8% 99.3%,53.8% 99%,55.4% 99.9%,72% 99.9%,73.5% 99%,79.4% 99.9%,92.2% 98.3%,98.9% 95.7%,96.6% 91.1%,91% 89.4%,87.2% 86.2%,73.5% 68.5%,74.7% 65.6%,69.7% 61%,60.3% 42.6%,52.9% 39.4%,58.5% 39.4%,64.3% 42.9%,70.6% 41.5%,72.6% 39.7%,72.4% 38.1%,70.6% 37.1%,78% 33.1%,82.1% 28.5%,81.4% 18.9%,85% 18.2%,87.2% 16.2%,86.8% 14.4%,84.5% 14%,85% 8.1%,83% 5.8%'
  };
  var C = { NEIGHBOURS: NEIGHBOURS, OUTLINE: OUTLINE, PROMPTS: PROMPTS, NOTES: NOTES, neighbours: neighbours, neighbour: neighbour, setPeople: setPeople, promptFor: promptFor, dayIndex: dayIndex };
  root.OvuCommunity = C;

  /* rendered 18 Oct 2026 (Seedream 5.0 pro, seed 7302, 1472x1840): positions read off a 5% grid */
  var PLAZA = {
    id: 'plaza', scene: 'plaza', name: 'The plaza', img: 'plaza-v1.webp', w: 1472, h: 1840, avatarW: 12, only: [],
    hotspots: [
      { id: 'arch', x: 12, y: 51, label: 'Arch · back to the street', icon: 'park', wp: { x: 20, y: 58, flip: true } },
      { id: 'board', x: 30, y: 41, label: 'Noticeboard · today’s note', icon: 'push_pin', wp: { x: 30, y: 56, flip: true } },
      { id: 'fountain', x: 50, y: 39, label: 'Fountain · make a wish', icon: 'water', wp: { x: 50, y: 56, flip: false } },
      { id: 'stall', x: 66, y: 43, label: 'Tea stall · a cup for your phase', icon: 'emoji_food_beverage', wp: { x: 62, y: 58, flip: false } },
      { id: 'bench', x: 38, y: 69, label: 'Bench · sit a while', icon: 'chair', wp: { x: 34, y: 64, flip: true } },
      { id: 'bench2', x: 73, y: 60, label: 'Bench · sit a while', icon: 'chair', wp: { x: 62, y: 62, flip: false } },
      { id: 'gate', x: 62, y: 67, label: 'Gate · home', icon: 'door_open', wp: { x: 54, y: 64, flip: false } }
    ],
    home: { x: 20, y: 58, flip: false },
    zones: [[[50, 44], [90, 58], [50, 76], [10, 58]]],
    solids: [{ id: 'board', x0: 22, x1: 38, y0: 38, y1: 52 }, { id: 'fountain', x0: 38, x1: 60, y0: 40, y1: 52 }, { id: 'stall', x0: 56, x1: 76, y0: 44, y1: 56 }, { id: 'tree', x0: 76, x1: 94, y0: 46, y1: 60 }, { id: 'bench', x0: 64, x1: 82, y0: 58, y1: 65 }, { id: 'bench', x0: 30, x1: 46, y0: 66, y1: 74 }, { id: 'gate', x0: 58, x1: 68, y0: 64, y1: 72 }, { id: 'pot', x0: 20, x1: 30, y0: 62, y1: 70 }, { id: 'pot', x0: 46, x1: 56, y0: 70, y1: 78 }, { id: 'pot', x0: 64, x1: 70, y0: 67, y1: 72 }, { id: 'arch', x0: 6, x1: 19, y0: 46, y1: 62 }],
    doors: [{ id: 'arch', to: 'street', x: 20, y: 58, r: 5, flip: true }, { id: 'gate', to: 'home', x: 54, y: 64, r: 4.5, flip: false }],
    meditator: { x: 37, y: 66, w: 11, seat: { x: 36.5, seatY: 66, groundY: 70, face: 'left' } }, aura: { x: 37, y: 64, w: 17 }, holo: { x: 47, y: 64, w: 14 },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 },
    props: {}
  };
  var BENCH2 = { sit: { x: 72, y: 59, w: 11, seat: { x: 71.5, seatY: 60, groundY: 63.5, face: 'left' } }, holo: { x: 82, y: 58, w: 14 }, back: { x: 62, y: 62, flip: false } };
  C.LAYOUT = PLAZA; C.BENCH2 = BENCH2;
  /* ---------- the scene ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var S = root.OvuStore, doc = root.document, ART = R.ART, visit = null;
  R.LAYOUTS.plaza = PLAZA;
  function esc(s) { return R.esc(s); }
  function inPlaza(L) { return L && L.id === 'plaza'; }
  function notesState() { var c = S.state().community || {}; return { notes: (c.notes || []).slice(), hellos: c.hellos || {} }; }
  function copiedNotes() { return JSON.parse(JSON.stringify(S.state().community || {})); }

  /* display-only nodes: the class .nb keeps them out of the room's pet and tool click handling */
  function clipTo(img, look) { if (img && OUTLINE[look]) img.style.clipPath = 'polygon(' + OUTLINE[look] + ')'; }
  function nbNode(n, spot, cls) {
    var d = doc.createElement('div'); d.className = 'nb ' + cls + (spot.flip ? ' flip' : ''); d.dataset.id = 'nb-' + n.id; d.dataset.nb = n.id;
    d.style.left = spot.x + '%'; d.style.top = spot.y + '%'; d.style.width = (spot.w || 11) + '%';
    return d;
  }
  function renderNeighbours() {
    var wrap = R.els.props;
    Array.prototype.slice.call(wrap.querySelectorAll('.nb')).forEach(function (el) { el.remove(); }); /* props re-render clears the wrap, a layout change does not */
    neighbours().forEach(function (n) {
      var el = nbNode(n, n.spot, 'nbperson' + (n.real ? ' nbreal' + (n.friend ? ' nbfriend' : '') : '')); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', n.real ? n.name + (n.friend ? ', your friend' : '') + ', in your group. Tap to see her card.' : n.name + (n.sample ? ', a sample neighbour' : '') + '. Tap to say hello or visit.');
      el.innerHTML = '<img src="' + ART + 'avatar-' + n.outfit + '.webp" alt=""><span class="nbtag">' + (n.friend ? '<span class="ms" aria-hidden="true">favorite</span>' : '') + esc(n.name) + '</span>'; clipTo(el.querySelector('img'), n.outfit); wrap.appendChild(el);
      if (n.pet) { var p = nbNode(n, { x: n.petSpot.x, y: n.petSpot.y, w: n.pet.w }, 'nbpet'); p.innerHTML = '<img src="' + ART + n.pet.img + '" alt="">'; wrap.appendChild(p); }
    });
    if (root.OvuWalk && root.OvuWalk.sortDepth) root.OvuWalk.sortDepth(); /* a friends redraw comes without the props event: rank the new people with her and a villager (Codex, 22 Oct) */
  }
  function openNeighbour(id) {
    var n = neighbour(id); if (!n || root.OvuWalk.napping()) return; var hellos = notesState().hellos, said = hellos[id] === S.today();
    R.openSheet('neighbour', n.name, n.sample ? 'A sample neighbour, until friends can join' : 'Your neighbour', 'waving_hand',
      '<div class="nbcard"><img src="' + ART + 'avatar-' + n.outfit + '.webp" alt=""><div><p>“' + esc(n.line) + '”</p><small>' + (n.pet ? 'With ' + esc(n.pet.name) + '. ' : '') + 'Lives in ' + esc({ house: 'the two-storey cottage', bathhouse: 'the cottage with the bath', familyhome: 'the family home' }[n.home] || 'a dream house') + '.</small></div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="nbHello"' + (said ? ' disabled' : '') + '><span class="ms">waving_hand</span>' + (said ? 'You said hello today' : 'Say hello') + '</button><button type="button" class="btn soft" id="nbVisit"><span class="ms">cottage</span>Visit her home</button></div>' +
      '<p class="help">Neighbours are samples for now. Nothing here is sent anywhere, and visiting changes nothing of theirs or yours.</p>');
    doc.getElementById('nbHello').addEventListener('click', function () {
      var c = copiedNotes(); c.hellos = c.hellos || {}; c.hellos[id] = S.today();
      try { S.commit({ community: c }); } catch (e) { R.toast('Your hello could not be saved. Please try again.', 'info'); return; }
      R.closeSheet(); R.chime('save'); R.toast(n.name + ' waves back. ' + ['A good day to you too.', 'Nice to see you.', 'See you at the fountain.'][Math.floor(Math.random() * 3)], 'waving_hand', R.moment ? R.moment('hello', { quiet: true }) : '');
      var el = doc.querySelector('.nbperson[data-nb="' + id + '"]'); if (el) { el.classList.remove('wave'); void el.offsetWidth; el.classList.add('wave'); }
    });
    doc.getElementById('nbVisit').addEventListener('click', function () { R.closeSheet(); root.setTimeout(function () { visitNeighbour(id); }, 60); });
  }
  /* a visit: her home layout as a read-only scene; your own things stay home, hers stand in */
  function visitNeighbour(id) {
    var n = neighbour(id); if (!n || !R.LAYOUTS[n.home]) return;
    var ok = root.OvuWalk.travel(n.home, { visit: true, after: function (L) { visit = n; dressVisit(L); R.renderProps(); R.toast('Visiting ' + n.name + '. Tap Back when you are done.', 'cottage'); } });
    if (!ok) return;
  }
  function dressVisit(L) {
    R.els.scene.classList.add('nbvisit');
    var vb = R.els.visitBar; vb.classList.add('on');
    vb.innerHTML = '<span class="ms">cottage</span><span>Visiting <b>' + esc(visit.name) + '’s home</b> · a sample until friends can join</span><button type="button" id="nbBack"><span class="ms">arrow_back</span>Back</button>';
  }
  function renderVisit() {
    if (!visit) return; var wrap = R.els.props, L = R.layout(); wrap.innerHTML = '';
    var spot = { x: L.home.x - 14, y: L.home.y, flip: false, w: (L.avatarW || 10) * 0.95 };
    var el = nbNode(visit, spot, 'nbperson'); el.innerHTML = '<img src="' + ART + 'avatar-' + visit.outfit + '.webp" alt=""><span class="nbtag">' + esc(visit.name) + '</span>'; clipTo(el.querySelector('img'), visit.outfit); wrap.appendChild(el);
    if (visit.pet) { var isDog = /corgi|shiba/.test(visit.pet.id), pp = (L.props && (isDog ? L.props.dog : L.props.cat)) || { x: 55, y: 82, w: 8 }; var p = nbNode(visit, { x: pp.x, y: pp.y, w: pp.w }, 'nbpet'); p.innerHTML = '<img src="' + ART + visit.pet.img + '" alt="">'; wrap.appendChild(p); }
    if (!R.els.visitBar.querySelector('#nbBack')) dressVisit(L);
  }
  function endVisit() { if (!visit) return; visit = null; R.els.scene.classList.remove('nbvisit'); }
  function openBoard() {
    if (root.OvuWalk.napping()) return;
    var st = notesState(), today = S.today();
    R.openSheet('board', 'Noticeboard', 'A gentle note for today, and what neighbours pinned', 'push_pin',
      '<div class="notice today"><span class="ms">auto_awesome</span><div><b>Today’s gentle prompt</b><p>' + esc(promptFor(today)) + '</p></div></div>' +
      '<div class="notices">' + NOTES.map(function (n) { return '<div class="notice"><span class="ms">sticky_note_2</span><div><p>' + esc(n.text) + '</p><small>' + esc(n.by) + (n.sample ? ' · sample' : '') + '</small></div></div>'; }).join('') +
      st.notes.slice(-3).reverse().map(function (n) { return '<div class="notice mine"><span class="ms">favorite</span><div><p>' + esc(n.text) + '</p><small>You · ' + esc(n.date) + ' · only on this phone</small></div></div>'; }).join('') + '</div>' +
      '<div class="field"><label for="noteText">Pin a note of your own</label><textarea class="input" id="noteText" maxlength="140" placeholder="Something kind, something useful, something you noticed..."></textarea></div>' +
      '<div class="row"><button type="button" class="btn primary" id="notePin"><span class="ms">push_pin</span>Pin it</button></div>' +
      '<p class="help">Your notes stay on this phone until friends can join; then you will choose what to share. No likes, no counts, no feed.</p>');
    doc.getElementById('notePin').addEventListener('click', function () {
      var t = doc.getElementById('noteText').value.trim(); if (!t) return;
      var c = copiedNotes(); c.notes = (c.notes || []).concat([{ text: t.slice(0, 140), date: today }]).slice(-20);
      /* Keep the sheet and her words in place until the save succeeds. */
      try { S.commit({ community: c }); } catch (e) { R.toast('Your note could not be saved. Please try again.', 'info'); return; }
      R.chime('save'); openBoard(); R.toast('Pinned. It stays with you.', 'push_pin');
    });
  }
  C.openBoard = openBoard; /* the Today card's Channel tab opens the board from home (ovu-today.js) */
  function openStall() {
    if (root.OvuWalk.napping()) return;
    var H = root.OvuHerbs, cs = S.cycleStats(), teas = H ? H.forPhase(cs.mode === 'suspended' ? null : cs.phase).slice(0, 3) : [];
    R.openSheet('stall', 'The tea stall', 'A cup for where you are in your cycle', 'emoji_food_beverage',
      '<p class="help">' + (cs.phase ? 'Day ' + cs.cycleDay + ', ' + esc(cs.phase) + ' phase: these come first.' : 'No phase yet, so a few gentle favourites.') + ' Food notes, not medicine. If you are pregnant, trying to conceive, breastfeeding or on medicines, ask first.</p>' +
      '<div class="teas">' + teas.map(function (t) { return '<div class="tea"><span class="ms">' + esc(t.icon || 'local_cafe') + '</span><div><b>' + esc(t.name) + '</b><span>' + esc(t.why) + '</span><small>' + esc(t.research) + '</small>' + (t.care ? '<em>' + esc(t.care) + '</em>' : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn soft" id="stallSip"><span class="ms">emoji_food_beverage</span>Sip one slowly</button></div>');
    doc.getElementById('stallSip').addEventListener('click', function () { R.closeSheet(); if (R.moment) R.moment('tea', { line: 'Both hands on the cup. Notice the warmth before the taste.' }); R.toast('A cup of tea at the stall.', 'emoji_food_beverage'); });
  }
  var WISHES = ['A petal drifts. A wish for a gentle day.', 'The water keeps moving. So can you, slowly.', 'A coin would be nice, but a breath is free.', 'Wish made. Now one soft breath out.'];
  function openFountain() {
    if (root.OvuWalk.napping()) return;
    var wrap = R.els.props, fx = doc.createElement('div'); fx.className = 'wish'; fx.setAttribute('aria-hidden', 'true'); fx.style.left = '50%'; fx.style.top = '44%'; fx.style.width = '18%';
    for (var i = 0; i < 6; i++) fx.innerHTML += '<i style="left:' + (15 + i * 14) + '%;animation-delay:' + (i * 0.12) + 's"></i>';
    wrap.appendChild(fx); root.setTimeout(function () { fx.remove(); }, 2400);
    R.joy(); R.showThought('auto_awesome'); root.setTimeout(R.hideThought, 2600); R.chime('bell', true); R.toast(WISHES[Math.floor(Math.random() * WISHES.length)], 'auto_awesome');
  }
  R.hotspotHandlers.board = function (id, L) { if (!inPlaza(L)) return false; openBoard(); return true; };
  R.hotspotHandlers.stall = function (id, L) { if (!inPlaza(L)) return false; openStall(); return true; };
  R.hotspotHandlers.fountain = function (id, L) { if (!inPlaza(L)) return false; openFountain(); return true; };
  R.hotspotHandlers.bench2 = function (id, L) { if (!inPlaza(L)) return false; root.OvuGarden.openBench(BENCH2.sit, BENCH2.holo, BENCH2.back); return true; };
  var prevBench = R.hotspotHandlers.bench, prevArch = R.hotspotHandlers.arch;
  R.hotspotHandlers.bench = function (id, L) { if (inPlaza(L)) { root.OvuGarden.openBench(PLAZA.meditator, PLAZA.holo, { x: 34, y: 64, flip: true }); return true; } return prevBench ? prevBench(id, L) : false; };
  R.hotspotHandlers.arch = function (id, L) { if (inPlaza(L)) { root.OvuWalk.travel('street'); return true; } return prevArch ? prevArch(id, L) : false; };
  C.visiting = function () { return visit; }; C.visitNeighbour = visitNeighbour; C.openNeighbour = openNeighbour; C.LAYOUT = PLAZA; C.openBoard = openBoard;
  C.redraw = function () { if (!visit && inPlaza(R.layout())) renderNeighbours(); };
  function tapPerson(id) { var n = neighbour(id); if (n && n.real) { if (openPerson) openPerson(n.handle); } else openNeighbour(id); }
  R.on('boot', function () {
    R.on('props', function (L) { if (visit) renderVisit(); else if (inPlaza(L)) renderNeighbours(); });
    R.on('layout', function (L) { if (visit && (L.id !== visit.home || !R.visiting())) endVisit(); if (inPlaza(L)) renderNeighbours(); });
    R.els.props.addEventListener('click', function (e) { var n = e.target.closest('.nbperson'); if (n && !visit) { e.stopPropagation(); R.chime('tap'); tapPerson(n.dataset.nb); } });
    R.els.props.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var n = e.target.closest('.nbperson'); if (n && !visit) { e.preventDefault(); tapPerson(n.dataset.nb); } });
    doc.addEventListener('click', function (e) { if (e.target.closest('#nbBack')) { R.chime('tap'); root.OvuWalk.travel('plaza', { entry: { x: 54, y: 64, flip: false } }); } });
  });
})(window);
