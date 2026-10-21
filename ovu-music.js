/* Rhythme music (Jamie, 21 Oct 2026: "cute soothing background game melody similar to animal crossing and harvest moon").
 * A soft tune drawn in the browser with the sound kit's own context: nothing recorded, downloaded or licensed. The shape
 * follows docs/design/2026-10-21-game-music.md after a Codex design review the same evening.
 * Opt in only: S.state().music === true, set from the Music chip in the top bar or the window sheet. One pure decide()
 * ranks every reason for silence (off, hidden, asleep, an activity that needs the ear, a scene with no theme, a voice
 * playing) ahead of playing. One 32-bar form in D major for every scene; themes differ by voice, accompaniment, tempo and
 * which phrases they choose. Pure parts first (tested in node), then the engine. */
(function (root) {
  'use strict';
  /* ---------- pitches and harmony ---------- */
  var PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  var SCALE = ['D', 'E', 'F#', 'G', 'A', 'B', 'C#']; /* D major */
  function split(name) { var m = /^([A-G]#?)(-?\d)$/.exec(name); return m ? { pc: m[1], oct: parseInt(m[2], 10) } : null; }
  function midi(name) { var s = split(name); return s ? PC[s.pc] + (s.oct + 1) * 12 : null; }
  function hz(name) { var m = midi(name); return m === null ? 0 : 440 * Math.pow(2, (m - 69) / 12); }
  /* chord tones with the extensions a melody may land on at the beat (the ninth, the eleventh where it is diatonic) */
  var CHORDS = {
    'D6': ['D', 'F#', 'A', 'B', 'E'], 'D6/F#': ['D', 'F#', 'A', 'B', 'E'], 'D': ['D', 'F#', 'A', 'E'],
    'Gmaj7': ['G', 'B', 'D', 'F#', 'A'], 'Asus4': ['A', 'D', 'E', 'B'], 'A': ['A', 'C#', 'E', 'B'],
    'Bm7': ['B', 'D', 'F#', 'A', 'E'], 'F#m7': ['F#', 'A', 'C#', 'E', 'B'], 'Em7': ['E', 'G', 'B', 'D', 'F#']
  };
  /* the accompaniment voicing of each chord, low to high (D3 to A4), and its bass root and fifth */
  var VOICING = {
    'D6': ['D3', 'A3', 'F#4', 'B4'], 'D6/F#': ['F#3', 'A3', 'D4', 'B4'], 'D': ['D3', 'A3', 'F#4', 'A4'],
    'Gmaj7': ['G3', 'B3', 'D4', 'F#4'], 'Asus4': ['A3', 'D4', 'E4', 'A4'], 'A': ['A3', 'C#4', 'E4', 'A4'],
    'Bm7': ['B3', 'D4', 'F#4', 'A4'], 'F#m7': ['F#3', 'A3', 'C#4', 'E4'], 'Em7': ['E3', 'G3', 'B3', 'D4']
  };
  var BASS = { 'D6': ['D2', 'A2'], 'D6/F#': ['F#2', 'A2'], 'D': ['D2', 'A2'], 'Gmaj7': ['G2', 'D3'], 'Asus4': ['A2', 'E3'], 'A': ['A2', 'E3'], 'Bm7': ['B2', 'F#3'], 'F#m7': ['F#2', 'C#3'], 'Em7': ['E2', 'B2'] };
  /* the form: 32 bars, A A' B A''. Each bar names one chord or two (the second from beat 3). */
  var A_BARS = [['D6'], ['D6/F#'], ['Gmaj7'], ['Asus4', 'A'], ['Bm7'], ['F#m7'], ['Gmaj7', 'A'], ['D6']];
  var B_BARS = [['Em7'], ['A'], ['D'], ['Bm7'], ['Em7'], ['Gmaj7'], ['Asus4'], ['A']];
  var BARS = A_BARS.concat(A_BARS, B_BARS, A_BARS);
  var BEATS = 4, LOOP_BARS = 32, LOOP_BEATS = LOOP_BARS * BEATS;
  function chordAt(beat) { var bar = Math.floor(beat / BEATS) % LOOP_BARS, b = BARS[bar], within = beat - Math.floor(beat / BEATS) * BEATS; return b.length > 1 && within >= 2 ? b[1] : b[0]; }
  function inScale(name) { var s = split(name); return !!s && SCALE.indexOf(s.pc) > -1; }
  function chordTone(name, chord) { var s = split(name); return !!s && (CHORDS[chord] || []).indexOf(s.pc) > -1; }

  /* ---------- the phrase bank: four-bar melodies written over one chord group, ending in rest ----------
   * [beat within the phrase, pitch, length in beats, weight]: weight 1 notes carry the tune, weight 0 notes are the
   * lighter ones the night arrangement drops. Groups: A1 = D6 D6/F# Gmaj7 Asus4-A; A2 = Bm7 F#m7 Gmaj7-A D6;
   * B1 = Em7 A D Bm7; B2 = Em7 Gmaj7 Asus4 A (its first two bars are accompaniment only, by design). */
  var BANK = {
    A1a: [[0, 'A4', 1, 1], [1, 'F#4', 0.5, 1], [1.5, 'A4', 0.5, 0], [2, 'B4', 1.5, 1], [3.5, 'A4', 0.5, 0], [4, 'F#4', 1, 1], [5, 'D4', 1, 0], [6, 'A4', 2, 1], [8, 'B4', 1, 1], [9, 'D5', 1, 0], [10, 'A4', 1.5, 1], [11.5, 'G4', 0.5, 0], [12, 'E4', 1, 1], [13, 'D4', 1, 0], [14, 'E4', 1, 1]],
    A1b: [[0, 'D5', 1.5, 1], [1.5, 'E5', 0.5, 0], [2, 'F#5', 1, 1], [3, 'A4', 1, 0], [4, 'B4', 2, 1], [6, 'A4', 1, 1], [7, 'F#4', 1, 0], [8, 'D5', 1, 1], [9, 'B4', 0.5, 0], [9.5, 'A4', 0.5, 0], [10, 'B4', 1, 1], [11, 'D5', 1, 0], [12, 'E5', 1, 1], [13, 'D5', 1, 0], [14, 'C#5', 1, 1]],
    A1c: [[0, 'F#4', 2, 1], [2, 'A4', 2, 1], [4, 'B4', 3, 1], [7, 'A4', 1, 0], [8, 'D5', 2, 1], [10, 'B4', 2, 1], [12, 'A4', 2, 1], [14, 'E4', 1, 0]],
    A1d: [[0, 'A4', 0.5, 1], [0.5, 'B4', 0.5, 0], [1, 'A4', 0.5, 1], [1.5, 'F#4', 0.5, 0], [2, 'D5', 1, 1], [3, 'B4', 1, 0], [4, 'A4', 1, 1], [5, 'F#4', 0.5, 0], [5.5, 'E4', 0.5, 0], [6, 'F#4', 2, 1], [8, 'G4', 1, 1], [9, 'B4', 1, 0], [10, 'D5', 1, 1], [11, 'B4', 0.5, 0], [11.5, 'A4', 0.5, 0], [12, 'B4', 1, 1], [13, 'A4', 1, 0], [14, 'E4', 1, 1]],
    A2a: [[0, 'D5', 1, 1], [1, 'B4', 1, 0], [2, 'F#4', 2, 1], [4, 'E4', 1, 1], [5, 'F#4', 1, 0], [6, 'A4', 2, 1], [8, 'B4', 1, 1], [9, 'D5', 1, 0], [10, 'C#5', 1, 1], [11, 'B4', 1, 0], [12, 'A4', 2, 1], [14, 'F#4', 1, 0]],
    A2b: [[0, 'F#5', 1.5, 1], [1.5, 'D5', 0.5, 0], [2, 'B4', 2, 1], [4, 'C#5', 1, 1], [5, 'E5', 1, 0], [6, 'F#5', 1, 1], [7, 'E5', 1, 0], [8, 'D5', 2, 1], [10, 'E5', 1, 1], [11, 'C#5', 1, 0], [12, 'D5', 2.5, 1]],
    A2c: [[0, 'B4', 2, 1], [2, 'A4', 2, 1], [4, 'A4', 3, 1], [8, 'B4', 2, 1], [10, 'A4', 2, 1], [12, 'F#4', 3, 1]],
    A2d: [[0, 'D5', 1, 1], [1, 'F#5', 0.5, 0], [1.5, 'E5', 0.5, 0], [2, 'D5', 1, 1], [3, 'B4', 1, 0], [4, 'A4', 2, 1], [6, 'C#5', 1, 1], [7, 'E5', 1, 0], [8, 'D5', 1, 1], [9, 'B4', 1, 0], [10, 'A4', 2, 1], [12, 'D5', 3, 1]],
    B1a: [[0, 'G4', 1, 1], [1, 'F#4', 1, 0], [2, 'E4', 2, 1], [4, 'C#5', 1, 1], [5, 'B4', 1, 0], [6, 'A4', 2, 1], [8, 'F#4', 1, 1], [9, 'A4', 1, 0], [10, 'D5', 2, 1], [12, 'B4', 2, 1], [14, 'F#4', 1, 0]],
    B1b: [[0, 'B4', 2, 1], [2, 'D5', 1, 1], [3, 'E5', 1, 0], [4, 'E5', 2, 1], [6, 'C#5', 2, 1], [8, 'A4', 1, 1], [9, 'F#4', 1, 0], [10, 'A4', 2, 1], [12, 'F#4', 2, 1], [14, 'D5', 1, 0]],
    B2a: [[8, 'E5', 1, 1], [9, 'D5', 1, 0], [10, 'B4', 2, 1], [12, 'C#5', 1, 1], [13, 'E5', 1, 0], [14, 'A4', 1, 1]],
    B2b: [[8, 'D5', 2, 1], [10, 'A4', 1, 1], [11, 'B4', 1, 0], [12, 'E5', 2, 1], [14, 'C#5', 1, 0]]
  };
  var GROUP = { A1a: 'A1', A1b: 'A1', A1c: 'A1', A1d: 'A1', A2a: 'A2', A2b: 'A2', A2c: 'A2', A2d: 'A2', B1a: 'B1', B1b: 'B1', B2a: 'B2', B2b: 'B2' };
  /* the eight slots of the loop and the group each takes; the last slot always cadences (A2d) */
  var SLOT_GROUPS = ['A1', 'A2', 'A1', 'A2', 'B1', 'B2', 'A1', 'A2'];

  /* ---------- themes: voice, accompaniment, tempo per band, and the phrases for each slot (first choice, second choice) ---------- */
  var THEMES = {
    home: { name: 'Music box', voice: 'pluck', acc: 'broken', tempo: { morning: 72, day: 72, evening: 66, night: 58 }, slots: [['A1a', 'A1d'], ['A2a', 'A2b'], ['A1b', 'A1a'], ['A2b', 'A2a'], ['B1a', 'B1b'], ['B2a', 'B2b'], ['A1a', 'A1b'], ['A2d']] },
    garden: { name: 'Garden', voice: 'soft', acc: 'pad', tempo: { morning: 76, day: 76, evening: 70, night: 60 }, grace: true, slots: [['A1c', 'A1a'], ['A2c', 'A2a'], ['A1a', 'A1c'], ['A2a', 'A2c'], ['B1b', 'B1a'], ['B2b', 'B2a'], ['A1c', 'A1a'], ['A2d']] },
    farm: { name: 'Farm', voice: 'warm', acc: 'broken', tempo: { morning: 70, day: 70, evening: 64, night: 58 }, slots: [['A1d', 'A1a'], ['A2a', 'A2c'], ['A1a', 'A1d'], ['A2c', 'A2a'], ['B1a', 'B1b'], ['B2a', 'B2b'], ['A1d', 'A1a'], ['A2d']] },
    street: { name: 'Street', voice: 'pluck', acc: 'light', tempo: { morning: 80, day: 80, evening: 72, night: 60 }, slots: [['A1d', 'A1b'], ['A2b', 'A2a'], ['A1b', 'A1d'], ['A2a', 'A2b'], ['B1b', 'B1a'], ['B2b', 'B2a'], ['A1d', 'A1b'], ['A2d']] },
    plaza: { name: 'Plaza', voice: 'bell', acc: 'pad', tempo: { morning: 84, day: 84, evening: 76, night: 62 }, slots: [['A1b', 'A1a'], ['A2b', 'A2a'], ['A1a', 'A1b'], ['A2a', 'A2b'], ['B1a', 'B1b'], ['B2a', 'B2b'], ['A1b', 'A1a'], ['A2d']] },
    harbour: { name: 'Harbour', voice: 'soft', acc: 'pad', sparse: true, tempo: { morning: 64, day: 64, evening: 60, night: 56 }, slots: [['A1c', 'A1a'], ['A2c', 'A2a'], ['A1c', 'A1a'], ['A2c', 'A2a'], ['B1b', 'B1a'], ['B2b', 'B2a'], ['A1c', 'A1a'], ['A2d']] }
  };
  var SCENE_THEME = { room: 'home', house: 'home', bathhouse: 'home', familyhome: 'home', garden: 'garden', greenhouse: 'garden', farm: 'farm', barn: 'farm', barninside: 'farm', heninside: 'farm', street: 'street', plaza: 'plaza', harbour: 'harbour', lane: 'harbour', cave: null };
  /* the theme for a layout: by id, else by its scene, else the home tune; the cave has none */
  function themeFor(L) {
    if (!L) return 'home';
    var id = typeof L === 'string' ? L : L.id, scene = typeof L === 'string' ? null : L.scene;
    if (Object.prototype.hasOwnProperty.call(SCENE_THEME, id)) return SCENE_THEME[id];
    if (scene && Object.prototype.hasOwnProperty.call(SCENE_THEME, scene)) return SCENE_THEME[scene];
    return 'home';
  }
  /* the hour's arrangement from the window's sun phase and the local hour */
  function bandFor(phaseKey, hour) {
    if (hour < 5) return 'night';
    if (phaseKey === 'sunrise' || phaseKey === 'morning') return 'morning';
    if (phaseKey === 'afternoon') return 'day';
    if (phaseKey === 'sunset') return 'evening';
    return hour >= 21 ? 'night' : 'evening'; /* the window goes dark from 18:00; the tune waits until 21:00 to thin out */
  }
  function tempoFor(themeId, band) { var t = THEMES[themeId]; return t ? (t.tempo[band] || t.tempo.day) : 72; }
  /* which phrase fills each slot in a given loop: a bounded choice by loop index, never a shuffle */
  function arrange(themeId, loopIndex) {
    var t = THEMES[themeId] || THEMES.home, n = Math.max(0, loopIndex | 0);
    return t.slots.map(function (opts, slot) { return opts[(n + Math.floor(slot / 2)) % opts.length]; });
  }
  /* diatonic steps below a pitch, for grace notes (one step) and the answering voice (a sixth, five steps) */
  function stepDown(name, steps) {
    var s = split(name); if (!s) return name;
    var target = SCALE[(((SCALE.indexOf(s.pc) - steps) % 7) + 7) % 7], m = midi(name), cand = PC[target] + (s.oct + 1) * 12;
    while (cand >= m) cand -= 12; while (m - cand > 12) cand += 12; /* the nearest such pitch below */
    return target + (Math.floor(cand / 12) - 1);
  }
  /* the events of one loop: melody, grace notes, the answering voice, accompaniment and bass, in beats from the loop start */
  function events(themeId, band, loopIndex) {
    var t = THEMES[themeId] || THEMES.home, out = [], names = arrange(themeId, loopIndex);
    var night = band === 'night', evening = band === 'evening', morning = band === 'morning';
    names.forEach(function (ph, slot) {
      var base = slot * 16;
      (BANK[ph] || []).forEach(function (n) {
        var beat = base + n[0], w = n[3];
        if (night && w === 0) return; /* the lighter notes rest at night */
        if (t.sparse && w === 0 && !morning) return;
        var ev = { t: beat, part: 'mel', pitch: n[1], d: n[2], w: w, bar: Math.floor(beat / BEATS), chord: chordAt(beat) };
        out.push(ev);
        if (t.grace && morning && n[2] >= 1.5) out.push({ t: beat - 0.12, part: 'grace', pitch: stepDown(n[1], 1), d: 0.12, w: 0, bar: ev.bar, chord: ev.chord });
        if ((slot >= 6 || morning) && !night && n[2] >= 2) out.push({ t: beat + 0.03, part: 'ans', pitch: stepDown(n[1], 5), d: n[2], w: 0, bar: ev.bar, chord: ev.chord });
      });
    });
    /* accompaniment and bass, bar by bar */
    for (var bar = 0; bar < LOOP_BARS; bar++) {
      var b0 = bar * BEATS, chords = BARS[bar], thin = (bar >= 12 && bar < 16), accOnly = (bar === 20 || bar === 21);
      chords.forEach(function (ch, ci) {
        var start = b0 + (ci ? 2 : 0), len = chords.length > 1 ? 2 : 4, v = VOICING[ch];
        var pattern = night ? 'pad' : (evening && t.acc === 'broken' ? 'light' : t.acc);
        if (thin && pattern === 'broken') pattern = 'light';
        if (pattern === 'pad') out.push({ t: start, part: 'pad', pitches: v.slice(0, 3), d: len, w: 1, bar: bar, chord: ch });
        else {
          var beatsIn = pattern === 'broken' ? [0, 2] : [0];
          beatsIn.forEach(function (bi) { if (bi < len) v.slice(0, 3).forEach(function (p, k) { out.push({ t: start + bi + k * 0.07, part: 'acc', pitch: p, d: 1.2, w: 1, bar: bar, chord: ch }); }); });
        }
        if (ci === 0) {
          out.push({ t: b0, part: 'bass', pitch: BASS[ch][0], d: chords.length > 1 ? 2 : 3, w: 1, bar: bar, chord: ch });
          if (bar % 2 === 1 && chords.length === 1 && !night) out.push({ t: b0 + 2, part: 'bass', pitch: BASS[ch][1], d: 1.5, w: 0, bar: bar, chord: ch });
        }
      });
      if (accOnly) { /* nothing to do: the B2 phrases have no melody in these bars by construction */ }
    }
    out.forEach(function (e) { if (e.pitch) e.f = hz(e.pitch); if (e.pitches) e.fs = e.pitches.map(hz); });
    var ORDER = { bass: 0, pad: 1, acc: 2, mel: 3, ans: 4, grace: 5 };
    out.sort(function (a, b) { return a.t - b.t || ORDER[a.part] - ORDER[b.part]; });
    return out;
  }

  /* ---------- the one place that decides ---------- */
  function decide(s) {
    s = s || {};
    if (s.music !== true || s.sound === false) return { mode: 'off', fade: 0.3 };
    if (s.hidden) return { mode: 'silent', why: 'hidden', fade: 0.5 };
    if (s.sleeping) return { mode: 'silent', why: 'sleep', fade: 1.5 };
    if (s.exclusive) return { mode: 'silent', why: 'activity', fade: 0.3 };
    if (!s.theme) return { mode: 'silent', why: 'scene', fade: 1.0 };
    if (s.media) return { mode: 'duck', theme: s.theme, fade: 0.06 };
    return { mode: 'play', theme: s.theme, fade: s.from === 'duck' ? 2.5 : 1.2 };
  }

  /* ---------- media tracking: one wrapper, listeners on each element, nothing inferred from the call ---------- */
  var live = [], mediaTimer = 0;
  function audible(el) {
    if (!el || (el.tagName !== 'AUDIO' && el.tagName !== 'VIDEO')) return false;
    if (el.paused || el.ended || el.muted || !(el.volume > 0) || el.srcObject) return false;
    var src = el.currentSrc || el.src || ''; if (/^data:/i.test(src)) return false; /* Morning start's silent unlock clip */
    return true;
  }
  function updateMedia(el) {
    var i = live.indexOf(el), a = audible(el), was = live.length > 0;
    if (a && i < 0) live.push(el); else if (!a && i > -1) live.splice(i, 1);
    if (live.length > 0 && !was) reconcile('media'); /* the duck is immediate */
    else if (live.length === 0 && was) { root.clearTimeout(mediaTimer); mediaTimer = root.setTimeout(function () { if (!live.length) reconcile('media-end'); }, 1000); } /* the return waits a second */
  }
  function track(el) {
    if (!el || el.__ovuMusicTracked) return; el.__ovuMusicTracked = true;
    ['playing', 'pause', 'ended', 'emptied', 'error', 'abort', 'volumechange'].forEach(function (n) { try { el.addEventListener(n, function () { updateMedia(el); }); } catch (e) { } });
  }
  function wrapPlay() {
    var MP = root.HTMLMediaElement && root.HTMLMediaElement.prototype; if (!MP || !MP.play || MP.play.__ovuMusic) return false;
    var prev = MP.play, wrapped = function () { try { track(this); } catch (e) { } return prev.apply(this, arguments); };
    wrapped.__ovuMusic = true; MP.play = wrapped; return true;
  }

  /* ---------- voices ---------- */
  var LEVEL = { mel: 0.022, melLight: 0.015, grace: 0.008, ans: 0.011, acc: 0.012, pad: 0.0095, bass: 0.02 }; /* measured 21 Oct on the music bus: peaks about -26 dBFS, a loud second about -40, at the default slider */
  function hold(param, ctx) { var t = ctx.currentTime; try { if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t); else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); } } catch (e) { } return t; }
  function ramp(param, ctx, target, secs) { var t = hold(param, ctx); param.linearRampToValueAtTime(target, t + Math.max(0.01, secs)); }
  /* one note into a layer: the voice shapes the partials and the envelope; every node stops on the clock and is dropped when it ends */
  function note(ctx, layer, ev, when, beatDur, voice) {
    var cap = ev.part === 'mel' || ev.part === 'bass' ? 12 : 10; if (layer.voices >= cap) return false;
    var secs = Math.max(0.12, ev.d * beatDur), peak = ev.part === 'mel' ? (ev.w ? LEVEL.mel : LEVEL.melLight) : LEVEL[ev.part] || 0.01;
    var g = ctx.createGain(), nodes = [], partials;
    if (ev.part === 'bass') partials = [[1, 'sine', 1], [2, 'sine', 0.35]];
    else if (ev.part === 'pad') partials = null;
    else if (ev.part === 'acc') partials = [[1, 'sine', 1], [2, 'triangle', 0.12]];
    else if (voice === 'bell') partials = [[1, 'sine', 1], [2, 'sine', 0.4], [3, 'sine', 0.1]];
    else if (voice === 'soft') partials = [[1, 'sine', 1], [1, 'triangle', 0.3]];
    else if (voice === 'warm') partials = [[1, 'triangle', 1], [2, 'sine', 0.2]];
    else partials = [[1, 'triangle', 1], [2, 'sine', 0.35]]; /* the music box pluck */
    var attack = ev.part === 'pad' ? 0.35 : ev.part === 'acc' ? 0.06 : ev.part === 'bass' ? 0.02 : voice === 'soft' ? 0.06 : voice === 'bell' ? 0.01 : 0.016;
    var decay = ev.part === 'pad' ? Math.max(0.3, secs - attack) : ev.part === 'acc' ? 0.9 : ev.part === 'bass' ? Math.min(1.1, secs + 0.2) : voice === 'bell' ? 1.2 : voice === 'soft' ? 1.0 : Math.min(0.85, 0.45 + 0.1 * ev.d);
    var release = ev.part === 'pad' ? 0.6 : 0;
    var end = when + attack + decay + release;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(peak, when + attack);
    if (ev.part === 'pad') { g.gain.setValueAtTime(peak, when + attack + decay); g.gain.linearRampToValueAtTime(0, end); }
    else g.gain.setTargetAtTime(0, when + attack, decay / 4);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = ev.part === 'pad' ? 900 : ev.part === 'bass' ? 700 : voice === 'warm' ? 1500 : voice === 'bell' ? 3800 : 2400 + (ev.w ? 600 : 0);
    g.connect(lp); lp.connect(layer.dry); if (layer.wet !== layer.dry) lp.connect(layer.wet);
    var freqs = ev.part === 'pad' ? ev.fs : [ev.f];
    freqs.forEach(function (f) {
      (partials || [[1, 'triangle', 0.6], [1, 'sine', 0.5]]).forEach(function (p) {
        var o = ctx.createOscillator(), og = ctx.createGain(); o.type = p[1]; o.frequency.setValueAtTime(f * p[0], when); og.gain.value = p[2] / (ev.part === 'pad' ? freqs.length : 1);
        if (voice === 'soft' && ev.part === 'mel') { try { var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.detune); lfo.start(when); lfo.stop(end + 0.05); nodes.push(lfo); } catch (e) { } }
        o.connect(og); og.connect(g); o.start(when); o.stop(end + 0.05); nodes.push(o);
      });
    });
    layer.voices += 1; layer.made += 1;
    var first = nodes[0]; first.onended = function () { layer.voices = Math.max(0, layer.voices - 1); try { nodes.forEach(function (n) { n.disconnect(); }); g.disconnect(); lp.disconnect(); } catch (e) { } };
    return true;
  }
  /* a music return of its own: dry and wet sends into a bus, the wet through a convolver made from the kit's impulse */
  function makeReturn(ctx, impulse, out) {
    var bus = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(); dry.gain.value = 0.86; wet.gain.value = 0.2; dry.connect(bus);
    try {
      var imp = impulse;
      if (!imp) { var len = Math.round(ctx.sampleRate * 1.8); imp = ctx.createBuffer(2, len, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = imp.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); } }
      var verb = ctx.createConvolver(); verb.buffer = imp; wet.connect(verb); verb.connect(bus);
    } catch (e) { wet.connect(bus); }
    bus.connect(out);
    return { bus: bus, dry: dry, wet: wet };
  }
  /* an explicit timeline into any context (the offline render in tools/music_render.py uses this): no timers, every
   * event scheduled at once from `origin`; returns the time the last tail ends */
  function render(ctx, out, themeId, band, loops, origin, impulse) {
    var ret = makeReturn(ctx, impulse, out), layer = { dry: ret.dry, wet: ret.wet, voices: 0, made: 0 }, beatDur = 60 / tempoFor(themeId, band), voice = (THEMES[themeId] || THEMES.home).voice, end = origin;
    for (var L = 0; L < loops; L++) {
      events(themeId, band, L).forEach(function (ev) { var when = origin + (L * LOOP_BEATS + ev.t) * beatDur; if (when < 0) return; layer.voices = 0; note(ctx, layer, ev, when, beatDur, voice); end = Math.max(end, when + ev.d * beatDur + 2); });
    }
    return { end: end, bus: ret.bus, made: layer.made };
  }

  /* ---------- the engine ---------- */
  var S, R, graph = null, ret = null, gate = null, layers = [], transport = null, gen = 0, applied = { mode: 'off', theme: null }, pendingBand = null, exclusiveTimer = 0, hourTimer = 0, inited = false, lastLayout = null, invited = false;
  function store() { return root.OvuStore || null; }
  function state() { try { return store().state() || {}; } catch (e) { return {}; } }
  function on() { return state().music === true; }
  function soundOn() { try { return root.OvuSound ? root.OvuSound.enabled() : state().sound !== false; } catch (e) { return false; } }
  function hidden() { try { return !!(root.document && root.document.hidden); } catch (e) { return false; } }
  function exclusive() {
    try {
      if (R && ((R.practiceOn && R.practiceOn()) || (R.sessionOn && R.sessionOn()) || (R.meditating && R.meditating()))) return true;
      if (root.OvuMorning && root.OvuMorning.active && root.OvuMorning.active()) return true;
      if (root.OvuSeats && root.OvuSeats.state && root.OvuSeats.state()) return true;
      if (root.OvuLightFlower && root.OvuLightFlower.running && root.OvuLightFlower.running()) return true;
      if (root.OvuBreathTap && root.OvuBreathTap.running && root.OvuBreathTap.running()) return true;
    } catch (e) { }
    return false;
  }
  function phaseKey() { try { return root.OvuSun ? root.OvuSun.phase().key : 'afternoon'; } catch (e) { return 'afternoon'; } }
  function bandNow() { return bandFor(phaseKey(), new Date().getHours()); }
  function themeNow() { var L = lastLayout || (R && R.layout && R.layout()); return themeFor(L); }
  function snapshot(from) { return { music: on(), sound: soundOn(), hidden: hidden(), sleeping: !!state().sleeping, exclusive: exclusive(), theme: themeNow(), media: live.length > 0, from: from }; }

  function ensureGraph() {
    if (graph && gate) return true;
    var g = root.OvuSound && root.OvuSound.graph ? root.OvuSound.graph() : null; if (!g || !g.ctx) return false;
    graph = g; gate = g.ctx.createGain(); gate.gain.value = 0; ret = makeReturn(g.ctx, g.impulse, gate); gate.connect(g.master);
    return true;
  }
  function makeTransport() {
    var ctx = graph.ctx, T = { origin: null, tempo: 72, beatDur: 60 / 72, running: false, timer: 0, pausedPos: 0, loop: 0 };
    T.pos = function () { return T.origin === null ? 0 : (ctx.currentTime - T.origin) / T.beatDur; };
    T.setTempo = function (bpm) { if (bpm === T.tempo) return; var p = T.pos(); T.tempo = bpm; T.beatDur = 60 / bpm; if (T.origin !== null) T.origin = ctx.currentTime - p * T.beatDur; };
    T.run = function () {
      if (T.running) return;
      var startPos = T.origin === null ? 0 : Math.ceil(T.pausedPos / BEATS) * BEATS; /* back in at the next bar */
      T.origin = ctx.currentTime + 0.05 - startPos * T.beatDur; T.running = true;
      layers.forEach(function (l) { l.cursorTo(startPos); });
      T.timer = root.setInterval(tick, 30);
    };
    T.pause = function () { if (!T.running) return; T.pausedPos = T.pos(); T.running = false; root.clearInterval(T.timer); T.timer = 0; };
    return T;
  }
  /* a layer plays one theme on the shared clock, with its own fade gain and event cursor */
  function makeLayer(themeId, band) {
    var ctx = graph.ctx, g = ctx.createGain(); g.gain.value = 0; g.connect(ret.dry); g.connect(ret.wet); /* every note of the layer passes its fade gain, then the return's dry and wet sends */
    var l = { theme: themeId, band: band, gain: g, voices: 0, made: 0, ending: false, loop: 0, evs: null, i: 0, dry: g, wet: g };
    l.load = function (loop) { l.loop = loop; l.evs = events(l.theme, l.band, loop); l.i = 0; };
    l.cursorTo = function (pos) { var loop = Math.floor(pos / LOOP_BEATS), within = pos - loop * LOOP_BEATS; if (!l.evs || l.loop !== loop) l.load(loop); l.i = 0; while (l.i < l.evs.length && l.evs[l.i].t < within) l.i++; };
    return l;
  }
  function tick() {
    if (!transport || !transport.running || !graph) return;
    var ctx = graph.ctx, now = ctx.currentTime, horizon = now + 0.18, T = transport;
    if (ctx.state !== 'running') return;
    layers.forEach(function (l) {
      if (l.ending) return;
      if (!l.evs) l.cursorTo(Math.max(0, T.pos()));
      var guard = 0;
      while (guard++ < 400) {
        if (l.i >= l.evs.length) { var nextLoop = l.loop + 1; if (pendingBand && pendingBand !== l.band) { l.band = pendingBand; T.setTempo(tempoFor(l.theme, l.band)); } l.load(nextLoop); if (!l.evs.length) break; }
        var ev = l.evs[l.i], when = T.origin + (l.loop * LOOP_BEATS + ev.t) * T.beatDur;
        if (when > horizon) break;
        if (when < now - T.beatDur) { /* a stall: drop what was missed and come back at the next bar */
          var pos = T.pos(), target = Math.ceil(pos / BEATS) * BEATS; l.cursorTo(target); continue;
        }
        if (when >= now - 0.005) note(ctx, l, ev, Math.max(when, now + 0.002), T.beatDur, (THEMES[l.theme] || THEMES.home).voice);
        l.i++;
      }
    });
    if (pendingBand && layers.every(function (l) { return l.band === pendingBand; })) pendingBand = null;
  }
  function retire(l, secs) {
    if (l.ending) return; l.ending = true; ramp(l.gain.gain, graph.ctx, 0, secs);
    root.setTimeout(function () { var i = layers.indexOf(l); if (i > -1) layers.splice(i, 1); try { l.gain.disconnect(); } catch (e) { } }, Math.round((secs + 2.2) * 1000));
  }
  function setTheme(themeId, band) {
    var cur = layers.filter(function (l) { return !l.ending; })[0];
    if (cur && cur.theme === themeId) { if (cur.band !== band) pendingBand = band; return cur; }
    layers.filter(function (l) { return !l.ending; }).forEach(function (l) { retire(l, 1.5); });
    while (layers.filter(function (l) { return l.ending; }).length > 1) { var oldest = layers.filter(function (l) { return l.ending; })[0]; ramp(oldest.gain.gain, graph.ctx, 0, 0.4); layers.splice(layers.indexOf(oldest), 1); try { oldest.gain.disconnect(); } catch (e) { } }
    var l = makeLayer(themeId, band); layers.push(l);
    transport.setTempo(tempoFor(themeId, band));
    if (transport.running) l.cursorTo(Math.max(0, transport.pos()));
    ramp(l.gain.gain, graph.ctx, 1, 2.5);
    return l;
  }
  function stopAll(secs) {
    if (transport) transport.pause();
    if (gate && graph) ramp(gate.gain, graph.ctx, 0, secs);
    layers.slice().forEach(function (l) { retire(l, secs); });
  }
  var ctxReady = false;
  function apply(d, why) {
    var g = ++gen;
    if (d.mode === 'off') { if (applied.mode !== 'off') stopAll(d.fade); applied = { mode: 'off', theme: null, why: null }; paint(); return; }
    if (!ensureGraph()) { applied = { mode: 'waiting', theme: null }; paint(); return; }
    if (!transport) transport = makeTransport();
    if (d.mode === 'silent') { if (transport.running) transport.pause(); if (applied.mode !== 'silent') ramp(gate.gain, graph.ctx, 0, d.fade); applied = { mode: 'silent', theme: null, why: d.why }; paint(); return; } /* one fade, not one per reason */
    /* duck or play: the theme runs on the clock; only the gate differs */
    var band = bandNow();
    if (!ctxReady) { applied = { mode: 'waiting', theme: d.theme }; paint(); return; }
    setTheme(d.theme, band);
    if (!transport.running) transport.run();
    ramp(gate.gain, graph.ctx, d.mode === 'duck' ? 0 : 1, d.fade);
    applied = { mode: d.mode, theme: d.theme, why: null }; paint();
  }
  function reconcile(why) {
    if (!inited) return;
    var s = snapshot(applied.mode === 'duck' ? 'duck' : undefined), d = decide(s);
    if (d.mode === applied.mode && (d.theme || null) === (applied.theme || null) && (d.why || null) === (applied.why || null) && d.mode !== 'play') return; /* nothing changed: a poll never restarts a fade */
    if (d.mode === 'play' && applied.mode === 'play' && d.theme === applied.theme) { var l = layers.filter(function (x) { return !x.ending; })[0]; if (l && l.band !== bandNow()) pendingBand = bandNow(); return; }
    apply(d, why);
  }
  /* turning it on is the gesture that may start audio: resume first, then decide, and say what the context reports */
  function set(v) {
    var s = store(); if (!s) return false;
    v = !!v; try { s.setState({ music: v }); } catch (e) { return false; }
    if (v && root.OvuSound && root.OvuSound.resume) root.OvuSound.resume().then(function (st) { ctxReady = st === 'running'; reconcile('resume'); });
    reconcile('set'); return v;
  }
  function toggle() { return set(!on()); }
  function paint() {
    var d = root.document; if (!d || !d.getElementById) return;
    ['musicChip', 'winMusic'].forEach(function (id) {
      var b = d.getElementById(id); if (!b) return;
      var isOn = on(); b.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      var icon = b.querySelector('.ms'); if (icon) icon.textContent = isOn ? 'music_note' : 'music_off';
      var label = b.querySelector('.mlabel'); if (label) label.textContent = 'Music ' + (isOn ? 'on' : 'off');
    });
  }
  function wireChip() {
    var d = root.document, b = d && d.getElementById && d.getElementById('musicChip'); if (!b || b.__ovuMusic) return; b.__ovuMusic = true;
    b.addEventListener('click', function (e) { e.stopPropagation(); toggle(); try { if (root.OvuSound) root.OvuSound.play('tap'); } catch (x) { } });
    paint();
  }
  function invite() {
    if (invited || on()) return; var st = state(); if (st.musicInvited) { invited = true; return; }
    invited = true; try { store().setState({ musicInvited: true }); } catch (e) { }
    try { if (R && R.toast) R.toast('There is a soft tune for the room now, under the window: Music.', 'music_note'); } catch (e) { }
  }
  function init() {
    if (inited) return false; inited = true;
    S = root.OvuStore; R = root.OvuRoom;
    wrapPlay(); wireChip();
    if (R && R.on) {
      R.on('layout', function (L) { lastLayout = L; reconcile('layout'); if (!invited) root.setTimeout(invite, 1500); });
      R.on('travel', function (target, T) { if (T) { lastLayout = T; reconcile('travel'); } });
      R.on('activity', function () { reconcile('activity'); });
      R.on('boot', function () { lastLayout = R.layout && R.layout(); reconcile('boot'); });
    }
    if (S && S.subscribe) S.subscribe(function () { reconcile('store'); paint(); });
    if (root.document) root.document.addEventListener('visibilitychange', function () { reconcile('visibility'); });
    /* activities end without an event, and the hour moves: look every half second while music is on */
    exclusiveTimer = root.setInterval(function () { if (on()) reconcile('poll'); }, 500);
    hourTimer = root.setInterval(function () { if (on()) reconcile('hour'); }, 60000);
    /* the first gesture after a page load with music already on: resume there, not at load */
    if (root.document) root.document.addEventListener('pointerdown', function () { if (on() && !ctxReady && root.OvuSound && root.OvuSound.resume) root.OvuSound.resume().then(function (st) { ctxReady = st === 'running'; reconcile('gesture'); }); }, true);
    return true;
  }
  function stateOut() {
    var ctx = graph && graph.ctx;
    return { on: on(), mode: applied.mode, theme: applied.theme, band: on() ? bandNow() : null, running: !!(transport && transport.running), ctx: ctx ? ctx.state : null, layers: layers.length, voices: layers.reduce(function (n, l) { return n + l.voices; }, 0), media: live.length, gate: gate ? Math.round(gate.gain.value * 100) / 100 : null, why: applied.why || null };
  }
  root.OvuMusic = { THEMES: THEMES, BANK: BANK, GROUP: GROUP, SLOT_GROUPS: SLOT_GROUPS, BARS: BARS, CHORDS: CHORDS, LOOP_BEATS: LOOP_BEATS, SCALE: SCALE, hz: hz, midi: midi, chordAt: chordAt, inScale: inScale, chordTone: chordTone, stepDown: stepDown,
    themeFor: themeFor, bandFor: bandFor, tempoFor: tempoFor, arrange: arrange, events: events, decide: decide, audible: audible, render: render, makeReturn: makeReturn,
    init: init, set: set, toggle: toggle, on: on, state: stateOut, reconcile: reconcile, _media: { track: track, update: updateMedia, live: function () { return live.slice(); }, wrap: wrapPlay } };
  if (root.document && root.OvuRoom) init(); else if (root.document) root.document.addEventListener('DOMContentLoaded', function () { if (root.OvuRoom) init(); });
})(typeof window !== 'undefined' ? window : this);
