/* Rhythme podcast player for Erin Lee's "Take A Pause". One audio element for the whole room,
 * streamed from Erin's own Substack (no copies on our servers), with resume, speed and a sleep
 * timer. Nothing autoplays, not even the next episode, and listening earns no hearts: leaving
 * audio running must never count as practice (Codex design review, 18 Oct 2026). */
(function (root) {
  'use strict';
  var KEY = 'rhythme_podcast_v1', PLUS = 'rhythme_plus_v1', FN = ((root.OVU_CONFIG && root.OVU_CONFIG.functionsBase) || 'https://zodkohwaznqgrfrcfdkf.supabase.co/functions/v1') + '/podcast', signed = {}, refreshed = {}, data = null, audio = null, cur = null, sleepTimer = null, sleepEnd = false, listeners = [], saveTick = 0;
  function store() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(patch) { var s = store(); Object.keys(patch).forEach(function (k) { s[k] = patch[k]; }); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
  function emit(type) { listeners.forEach(function (fn) { try { fn(type, state()); } catch (e) { } }); }
  function load() {
    if (data) return Promise.resolve(data);
    return fetch('assets/data/erin-podcasts.json').then(function (r) { if (!r.ok) throw new Error('Could not load the episodes.'); return r.json(); }).then(function (d) { data = d; return d; });
  }
  function el() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'none';
    audio.addEventListener('timeupdate', function () {
      if (!cur) return; var now = Date.now();
      if (now - saveTick > 4000) { saveTick = now; remember(); }
      emit('time');
    });
    ['play', 'pause', 'waiting', 'playing', 'loadedmetadata', 'ratechange'].forEach(function (t) { audio.addEventListener(t, function () { if (t === 'pause') remember(); emit(t); }); });
    audio.addEventListener('ended', function () { if (cur) { var pos = store().pos || {}; delete pos[cur.id]; var done = store().done || {}; done[cur.id] = new Date().toISOString(); save({ pos: pos, done: done }); } clearSleep(); emit('ended'); });
    audio.addEventListener('error', function () {
      /* a signed link lasts an hour: refresh it once and carry on from the saved spot */
      if (cur && cur.access === 'premium' && !refreshed[cur.id] && plusActive()) { refreshed[cur.id] = true; var ep = cur; remember(); delete signed[ep.id]; prepare(ep).then(function () { var at = (store().pos || {})[ep.id] || 0; var go = function () { try { audio.currentTime = at; } catch (e) { } audio.removeEventListener('loadedmetadata', go); audio.play().catch(function () { emit('blocked'); }); }; audio.addEventListener('loadedmetadata', go); }); return; }
      emit('error');
    });
    window.addEventListener('pagehide', remember);
    return audio;
  }
  function remember() { if (!cur || !audio || !isFinite(audio.currentTime)) return; var pos = store().pos || {}; pos[cur.id] = Math.floor(audio.currentTime); save({ pos: pos, last: cur.id, speed: audio.playbackRate }); }
  function episode(id) { return data ? data.episodes.filter(function (e) { return e.id === id; })[0] || null : null; }
  /* Select an episode without playing it; Play is always the listener's own tap. */
  function select(id) {
    var ep = episode(id); if (!ep) return null;
    var a = el();
    if (!cur || cur.id !== ep.id) {
      if (cur) remember();
      cur = ep; a.playbackRate = store().speed || 1;
      if (ep.access === 'premium') { a.removeAttribute('src'); try { a.load(); } catch (e) { } if (plusActive()) prepare(ep); }
      else a.src = ep.audioUrl;
      var at = (store().pos || {})[ep.id] || 0;
      if (at) { var seekOnce = function () { try { a.currentTime = at; } catch (e) { } a.removeEventListener('loadedmetadata', seekOnce); }; a.addEventListener('loadedmetadata', seekOnce); }
      emit('select');
    }
    return ep;
  }
  function play(id) {
    if (id) select(id); if (!cur) return Promise.resolve();
    if (cur.access === 'premium') {
      if (!plusActive()) { emit('locked'); return Promise.resolve(); }
      if (!el().getAttribute('src')) { emit('preparing'); return prepare(cur).then(function () { return el().play().catch(function () { emit('blocked'); }); }, function () { }); }
    }
    var p = el().play(); return p && p.catch ? p.catch(function (e) { emit(e && e.name === 'NotAllowedError' ? 'blocked' : (e && e.name === 'AbortError' ? 'abort' : 'error')); }) : Promise.resolve(); }
  function pause() { if (audio && !audio.paused) audio.pause(); }
  function toggle() { if (!audio || audio.paused) return play(); pause(); return Promise.resolve(); }
  function skip(sec) { if (!audio) return; var d = audio.duration || (cur && cur.durationSeconds) || 0; audio.currentTime = Math.max(0, Math.min(d ? d - 1 : 1e9, audio.currentTime + sec)); remember(); }
  function seekTo(frac) { if (!audio) return; var d = audio.duration || (cur && cur.durationSeconds) || 0; if (d) { audio.currentTime = Math.max(0, Math.min(d - 1, d * frac)); remember(); } }
  function setSpeed(r) { el().playbackRate = r; save({ speed: r }); emit('ratechange'); }
  function clearSleep() { clearTimeout(sleepTimer); sleepTimer = null; sleepEnd = false; if (audio) audio.removeEventListener('ended', endSleep); }
  function endSleep() { clearSleep(); emit('sleep'); }
  function setSleep(min) {
    clearSleep();
    if (min === 'end') { sleepEnd = true; el().addEventListener('ended', endSleep); }
    else if (min) { sleepTimer = setTimeout(function () { pause(); clearSleep(); emit('sleep'); }, min * 60000); }
    emit('sleepset');
  }
  function state() {
    var a = audio, d = a && isFinite(a.duration) && a.duration ? a.duration : (cur ? cur.durationSeconds : 0);
    return { ep: cur, playing: !!(a && !a.paused && !a.ended), time: a ? a.currentTime || 0 : 0, duration: d, speed: a ? a.playbackRate : (store().speed || 1), sleep: sleepTimer ? 'timer' : (sleepEnd ? 'end' : null), buffering: !!(a && a.readyState < 3 && !a.paused) };
  }
  /* ---------- Rhythme Plus preview: access codes until purchases open ---------- */
  function plus() { try { return JSON.parse(localStorage.getItem(PLUS) || 'null'); } catch (e) { return null; } }
  function plusActive() { var p = plus(); return !!(p && p.token && Date.parse(p.expiresAt) > Date.now()); }
  function call(body) { return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) { var e = new Error(d.error || 'Rhythme Plus is unavailable right now.'); e.code = d.code || r.status; throw e; } return d; }); }); }
  function prepare(ep) {
    var hit = signed[ep.id]; if (hit && Date.now() - hit.at < 50 * 60000) { if (cur && cur.id === ep.id && el().getAttribute('src') !== hit.url) setSrc(ep, hit.url); return Promise.resolve(hit.url); }
    var p = plus(); if (!p) return Promise.reject(new Error('locked'));
    return call({ action: 'url', id: ep.id, token: p.token }).then(function (d) { signed[ep.id] = { url: d.url, at: Date.now() }; if (cur && cur.id === ep.id) setSrc(ep, d.url); return d.url; })
      .catch(function (e) { if (e.code === 'no-access') { try { localStorage.removeItem(PLUS); } catch (x) { } emit('locked'); } else emit('error'); throw e; });
  }
  function setSrc(ep, url) { var a = el(); a.src = url; var at = (store().pos || {})[ep.id] || 0; if (at) { var once = function () { try { a.currentTime = at; } catch (e) { } a.removeEventListener('loadedmetadata', once); }; a.addEventListener('loadedmetadata', once); } emit('select'); }
  function redeem(code) {
    var pend; try { pend = localStorage.getItem(PLUS + '_pending'); } catch (e) { }
    var grant = pend || (root.crypto && crypto.randomUUID ? crypto.randomUUID() : null);
    if (!grant) return Promise.reject(new Error('This browser cannot unlock Plus.'));
    try { localStorage.setItem(PLUS + '_pending', grant); } catch (e) { }
    return call({ action: 'redeem', code: code, grant: grant }).then(function (d) {
      try { localStorage.setItem(PLUS, JSON.stringify({ token: d.token, expiresAt: d.expiresAt, at: new Date().toISOString() })); localStorage.removeItem(PLUS + '_pending'); } catch (e) { }
      if (cur && cur.access === 'premium') prepare(cur).catch(function () { });
      emit('plus'); return d;
    }, function (e) { if (e.code === 403 || e.code === 400) { try { localStorage.removeItem(PLUS + '_pending'); } catch (x) { } } throw e; });
  }
  function removePlus() { try { localStorage.removeItem(PLUS); } catch (e) { } signed = {}; if (cur && cur.access === 'premium') { pause(); el().removeAttribute('src'); } emit('plus'); }
  function lastId() { return store().last || null; }
  function progress(id) { return (store().pos || {})[id] || 0; }
  function finished(id) { return !!(store().done || {})[id]; }
  /* An editorial starting point by cycle phase, never a prescription; the listener can pick anything. */
  var PHASE_PICK = { menstrual: 86, follicular: 82, ovulatory: 98, luteal: 87, late: 87 };
  function suggestFor(phase) { if (!data) return null; var n = PHASE_PICK[phase]; return data.episodes.filter(function (e) { return e.number === n; })[0] || data.episodes[0]; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); var m = Math.floor(s / 60), r = s % 60; return m + ':' + String(r).padStart(2, '0'); }
  root.OvuPodcast = { plus: plus, plusActive: plusActive, redeem: redeem, removePlus: removePlus, load: load, select: select, play: play, pause: pause, toggle: toggle, skip: skip, seekTo: seekTo, setSpeed: setSpeed, setSleep: setSleep, state: state, episode: episode, lastId: lastId, progress: progress, finished: finished, suggestFor: suggestFor, fmt: fmt, on: function (fn) { listeners.push(fn); }, data: function () { return data; } };
})(window);
