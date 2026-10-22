/* PULSE: a short movement break (Dr Vernece's PULSE Master Exercise Library v1, 22 Oct 2026; Codex review
 * docs/design/reviews/2026-10-22-codex-pulse-review.md). First release: three seated or wall movements, one level each.
 * A movement is shown only once its card is signed (reviewedBy, reviewedAt); until then only tester mode sees it, marked
 * as a draft. The first three are signed (REVIEW below). Nothing here picks a movement by cycle day. A break saves only when she taps "Log what
 * I did": the active seconds (setup and rest are not counted), stopped early or not, and the setting. No intensity or MET
 * is assumed and it never counts as a strength day; the week shows breaks apart from WHO minutes. */
(function (root) {
  'use strict';
  /* Jamie, 22 Oct: the cards are Dr Vernece's own content; with Claude's and Codex's checks they go live. Codex checked the
     library against WHO 2020, CDC, Stamatakis 2022, the Royal Osteoporosis Society and McNulty 2020 (ship with changes,
     three seated or wall movements; docs/design/reviews/2026-10-22-codex-pulse-review.md) and the three cards as shipped
     (docs/design/reviews/2026-10-22-codex-pulse-live-check.md). A later card stays a draft until the same checks sign it. */
  var REVIEW = { by: 'Dr Vernece (author); checked by Claude and Codex', at: '2026-10-22' };
  var SETTINGS = { work: 'At work', home: 'At home', waiting: 'Waiting, seated' };
  var MOVES = [
    { id: 'P05', v: 1, name: 'Seated knee extension', icon: 'chair', settings: ['work', 'home'],
      setup: 'Sit tall on a firm chair without wheels, on a non-slip floor, feet flat on the floor.',
      cue: 'Slowly straighten one knee, pause, lower it with control. Then the other side.',
      easy: 'A smaller, comfortable range.',
      skip: 'Skip if your knee is painful, after recent knee surgery or injury, or if a clinician told you to limit movement.',
      work: 45, rest: 10, reviewedBy: REVIEW.by, reviewedAt: REVIEW.at },
    { id: 'P06', v: 1, name: 'Shoulder-blade squeeze', icon: 'self_improvement', settings: ['work', 'home', 'waiting'],
      setup: 'Sit tall on a firm chair without wheels, on a non-slip floor, arms relaxed.',
      cue: 'Gently draw your shoulder blades together without lifting your shoulders. Relax fully between each one.',
      easy: 'A small squeeze.',
      skip: 'Skip if your shoulder is painful, after a recent shoulder or upper-back injury, or if numbness or tingling gets worse with it.',
      work: 45, rest: 10, reviewedBy: REVIEW.by, reviewedAt: REVIEW.at },
    { id: 'P02', v: 1, name: 'Wall push-up', icon: 'fitness_center', settings: ['work', 'home'],
      setup: 'A fixed wall, a clear and dry floor, about a step away from the wall.',
      cue: 'Hands on the wall at shoulder height. Bend your elbows, then press away gently. Keep breathing.',
      easy: 'Stand closer to the wall.',
      skip: 'Skip if your wrist or shoulder is painful, after recent upper-body surgery or injury, or if you feel dizzy or faint standing.',
      work: 45, rest: 10, reviewedBy: REVIEW.by, reviewedAt: REVIEW.at }
  ];
  var BEFORE = {
    title: 'Before you move',
    lines: ['For adults 18 and over. Choose a clear, dry space and something stable to hold or lean on.',
      'These first three cards are not adapted for pregnancy or the months after birth yet. Gentle movement is usually good then, so ask your midwife, doctor or physio what suits you, and skip these for now.',
      'Skip for now if you have a recent fracture or surgery, a spinal fracture or several fractures, limits a physio or doctor gave you, painful joints, or feel dizzy or faint when standing. Having osteoporosis on its own is not a reason to skip.',
      'Stop and ask for advice if you notice leaking, a heavy or dragging feeling in the vagina, or a bulge along the middle of your tummy.',
      'Stop if you feel pain, dizziness or unwell. If a symptom stays after you stop, see your doctor or a clinic. You can skip any time.'],
    check: 'Is there a reason above to skip or stop today?',
    urgent: 'Chest pain, pressure or tightness, unusual breathlessness, collapse or stroke signs: call your local emergency number.'
  };
  function move(id) { return MOVES.filter(function (m) { return m.id === id; })[0] || null; }
  function reviewed(m) { return !!(m && m.reviewedBy && m.reviewedAt); }
  /* what she can see: reviewed cards for everyone; drafts only in tester mode */
  function visible(tester) { return MOVES.filter(function (m) { return reviewed(m) || !!tester; }); }
  /* the saved entry: active seconds only, no MET, never a strength day */
  function entryFor(m, setting, seconds, stoppedEarly) {
    seconds = Math.max(0, Math.min(m.work, Math.round(Number(seconds) || 0)));
    return { activity: 'pulse', label: 'PULSE: ' + m.name, pulse: m.id, pulseV: m.v, setting: SETTINGS[setting] ? setting : null, seconds: seconds,
      stoppedEarly: !!stoppedEarly, minutes: 0, met: null, intensity: null, strength: false, aerobic: false, reviewed: reviewed(m) };
  }
  root.OvuPulse = { MOVES: MOVES, SETTINGS: SETTINGS, BEFORE: BEFORE, move: move, reviewed: reviewed, visible: visible, entryFor: entryFor };
})(typeof window !== 'undefined' ? window : this);
