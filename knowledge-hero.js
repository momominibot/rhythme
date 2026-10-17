/* Progressive enhancement: guides and films remain ordinary links without JS. */
(function () {
  'use strict';
  var search = document.getElementById('guide-search');
  if (!search) return;
  var stage = document.getElementById('guide-stage');
  var cards = Array.from(document.querySelectorAll('.kh-guide'));
  var topics = Array.from(document.querySelectorAll('.kh-topic'));
  var topic = 'all';
  var labels = { cycle:'Your cycle', science:'Ovarian science', biomarkers:'Lab markers', technology:'Technology', lifestyle:'Daily wellbeing', tcm:'TCM & herbs' };
  var clear = document.getElementById('clear-search');
  var all = document.getElementById('all-topics');
  var state = document.getElementById('filter-state');
  var player = document.getElementById('video-player');
  var video = document.getElementById('player-video');
  var error = document.getElementById('video-error');
  var lastVideoLink;

  function update() {
    var terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var count = 0;
    cards.forEach(function (card) {
      var text = (card.textContent + ' ' + card.dataset.keywords).toLowerCase();
      var match = (topic === 'all' || card.dataset.category === topic) &&
        (stage.value === 'all' || card.dataset.stages.split(' ').includes(stage.value)) &&
        terms.every(function (term) { return text.includes(term); });
      card.hidden = !match;
      if (match) count++;
    });
    topics.forEach(function (link) {
      if (link.dataset.topic === topic) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    document.getElementById('guide-count').textContent = count + (count === 1 ? ' guide' : ' guides');
    document.getElementById('no-guides').hidden = count !== 0;
    clear.hidden = search.value.length === 0;
    all.hidden = topic === 'all';
    state.hidden = topic === 'all';
    state.textContent = topic === 'all' ? '' : 'Exploring ' + labels[topic];
  }
  topics.forEach(function (link) {
    link.addEventListener('click', function () {
      topic = link.dataset.topic;
      update();
      // Keep the real fragment navigation, then put keyboard users at the search.
      search.focus({ preventScroll:true });
    });
  });
  search.addEventListener('input', update);
  stage.addEventListener('change', update);
  clear.addEventListener('click', function () { search.value = ''; update(); search.focus(); });
  all.addEventListener('click', function () { topic = 'all'; update(); });
  document.getElementById('reset-filters').addEventListener('click', function () {
    topic = 'all'; stage.value = 'all'; search.value = ''; update(); search.focus();
  });
  document.getElementById('guide-filters').hidden = false;
  update();

  // Native dialog provides modal focus trapping and Escape-to-close behavior.
  if (!player || typeof player.showModal !== 'function') return;
  document.querySelectorAll('.kh-video').forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault(); lastVideoLink = link;
      document.getElementById('player-title').textContent = link.dataset.videoTitle;
      error.hidden = true;
      video.src = link.getAttribute('href');
      player.showModal();
      video.play().catch(function () { /* Native controls remain available. */ });
    });
  });
  video.addEventListener('error', function () { if (player.open) error.hidden = false; });
  document.getElementById('close-player').addEventListener('click', function () { player.close(); });
  player.addEventListener('click', function (event) {
    var rect = player.getBoundingClientRect();
    if (event.target === player && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) player.close();
  });
  player.addEventListener('close', function () {
    video.pause(); video.removeAttribute('src'); video.load();
    if (lastVideoLink) lastVideoLink.focus();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) video.pause(); });
})();
