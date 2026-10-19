/* A source-linked daily reading plan, not a clinical model. No phase, ovarian-age,
   treatment, fasting or diagnosis is inferred. Dates/windows are UI freshness rules. */
(function (root) {
  'use strict';
  const KEYS = { context: 'ovuluna_daily_context_v1', routine: 'ovuluna_daily_routine_v1', completions: 'ovuluna_daily_completions_v1' };
  const STAGES = { cycling: 'Menstrual cycles', ttc: 'Trying to conceive', pregnant: 'Pregnant', postpartum: 'After pregnancy', peri: 'Perimenopause', post: 'After menopause', unspecified: 'Prefer not to specify' };
  const CONTRACEPTION = { none: 'No contraception reported', hormonal: 'Hormonal contraception', nonhormonal: 'Non-hormonal contraception', unsure: 'Not sure', undisclosed: 'Prefer not to specify' };
  const TASK_IDS = ['check-context', 'stage-cycling', 'stage-ttc', 'stage-pregnant', 'stage-postpartum', 'stage-peri', 'stage-post', 'stage-unspecified', 'bleeding-care', 'review-observation', 'comfort', 'connection', 'one-note'];
  const CONTEXT_DAYS = 30, OBSERVATION_DAYS = 7;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function fail(message) { throw Error(message); }
  function day(now = new Date()) { if (!Number.isFinite(now.getTime())) fail('A valid current date is required.'); return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'); }
  function calendar(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false; const parsed = new Date(value + 'T12:00:00Z'); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }
  function elapsed(date, today) { return calendar(date) && calendar(today) ? Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(date + 'T12:00:00Z')) / 86400000) : NaN; }
  function keys(input, allowed) { if (!object(input) || Object.keys(input).some(key => !allowed.includes(key))) fail('The saved format is unsupported. Existing data has not been changed.'); }
  function stamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
  function snapshot(storage, key) { return storage.getItem(key); }
  function decode(storage, key) { const raw = snapshot(storage, key); if (raw === null) return null; try { return JSON.parse(raw); } catch (_) { fail('Saved daily data is unreadable. Existing data has not been changed.'); } }
  function assertSnapshot(storage, key, expected) { if (expected !== null && typeof expected !== 'string') fail('The loaded snapshot is missing. Reopen the saved data before changing it.'); const raw = snapshot(storage, key); if (raw !== expected) fail('Saved data changed in another page. Your draft is kept; reopen the saved data before changing it.'); return raw; }
  function contextInput(input, now = new Date()) {
    keys(input, ['stage', 'contraception', 'statusOn', 'confirmed']);
    if (!own(STAGES, input.stage) || !own(CONTRACEPTION, input.contraception)) fail('Choose a listed context and contraception answer.');
    if (!calendar(input.statusOn) || input.statusOn > day(now)) fail('Enter the date this context applies to, on or before today.');
    if (input.confirmed !== true) fail('Confirm that these are your own current answers before saving.');
    return { stage: input.stage, contraception: input.contraception, statusOn: input.statusOn, confirmed: true };
  }
  function readContext(storage) {
    const record = decode(storage, KEYS.context); if (record === null) return null;
    keys(record, ['version', 'source', 'stage', 'contraception', 'statusOn', 'confirmed', 'confirmedAt', 'utcOffsetMinutes']);
    if (record.version !== 1 || record.source !== 'self-reported' || !stamp(record.confirmedAt) || !Number.isInteger(record.utcOffsetMinutes) || Math.abs(record.utcOffsetMinutes) > 840) fail('Saved daily context has unsupported metadata.');
    const originalDay = new Date(Date.parse(record.confirmedAt) - record.utcOffsetMinutes * 60000).toISOString().slice(0, 10);
    if (!own(STAGES, record.stage) || !own(CONTRACEPTION, record.contraception) || record.confirmed !== true || !calendar(record.statusOn) || record.statusOn > originalDay) fail('Saved daily context has inconsistent answers.');
    return record;
  }
  function saveContext(storage, input, expected, now = new Date()) {
    const values = contextInput(input, now); assertSnapshot(storage, KEYS.context, expected); const old = readContext(storage);
    if (old && now.toISOString() < old.confirmedAt) fail('Your device clock is earlier than the saved context. Check it before saving.');
    const record = { version: 1, source: 'self-reported', ...values, confirmedAt: now.toISOString(), utcOffsetMinutes: now.getTimezoneOffset() };
    assertSnapshot(storage, KEYS.context, expected); storage.setItem(KEYS.context, JSON.stringify(record)); return record;
  }
  function readRoutine(storage) {
    const record = decode(storage, KEYS.routine); if (record === null) return null;
    keys(record, ['version', 'time', 'enabled', 'updatedAt']);
    if (record.version !== 1 || typeof record.enabled !== 'boolean' || typeof record.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time) || !stamp(record.updatedAt)) fail('Saved routine time is unsupported. Existing data has not been changed.');
    return record;
  }
  function saveRoutine(storage, input, expected, now = new Date()) {
    keys(input, ['time', 'enabled']); if (typeof input.enabled !== 'boolean' || typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) fail('Choose a real local time for your in-app routine.');
    assertSnapshot(storage, KEYS.routine, expected); const old = readRoutine(storage); if (old && now.toISOString() < old.updatedAt) fail('Your device clock is earlier than the saved routine.');
    const record = { version: 1, time: input.time, enabled: input.enabled, updatedAt: now.toISOString() }; assertSnapshot(storage, KEYS.routine, expected); storage.setItem(KEYS.routine, JSON.stringify(record)); return record;
  }
  function readCompletions(storage) {
    const log = decode(storage, KEYS.completions); if (log === null) return { version: 1, records: [] };
    keys(log, ['version', 'records']); if (log.version !== 1 || !Array.isArray(log.records)) fail('Saved completion data is unsupported.');
    const identities = new Set();
    for (const record of log.records) {
      keys(record, ['taskId', 'completedOn', 'completedAt', 'utcOffsetMinutes']);
      const identity = record.taskId + ':' + record.completedOn;
      // The original calendar day travels with the record. Never reinterpret it
      // using the reader's current timezone (including after international travel).
      const offset = record.utcOffsetMinutes;
      if (!TASK_IDS.includes(record.taskId) || !calendar(record.completedOn) || !stamp(record.completedAt) || !Number.isInteger(offset) || offset < -840 || offset > 840 || record.completedOn !== new Date(Date.parse(record.completedAt) - offset * 60000).toISOString().slice(0, 10) || identities.has(identity)) fail('Saved completion data has an unsupported entry.');
      identities.add(identity);
    }
    return log;
  }
  function toggleCompletion(storage, taskId, complete, expected, now = new Date()) {
    if (!TASK_IDS.includes(taskId) || taskId === 'bleeding-care' || typeof complete !== 'boolean') fail('Choose an available routine task. Care notes cannot be dismissed as complete.');
    assertSnapshot(storage, KEYS.completions, expected); const log = readCompletions(storage), today = day(now);
    const records = log.records.filter(record => record.taskId !== taskId || record.completedOn !== today);
    if (complete) records.push({ taskId, completedOn: today, completedAt: now.toISOString(), utcOffsetMinutes: now.getTimezoneOffset() });
    assertSnapshot(storage, KEYS.completions, expected); storage.setItem(KEYS.completions, JSON.stringify({ version: 1, records }));
  }
  function readSources(storage, now = new Date()) {
    const today = day(now), readers = { observations: root.OvumindObservations, checkins: root.OvumindCheckins, journal: root.OvumindJournal }, result = {};
    for (const [kind, reader] of Object.entries(readers)) {
      try {
        if (!reader || typeof reader.read !== 'function') fail('Record reader is unavailable.');
        const loaded = reader.read(storage), records = Array.isArray(loaded) ? loaded : loaded.records;
        const recordDay = record => kind === 'journal' ? record.date : record.observedOn;
        const windowDays = kind === 'observations' ? OBSERVATION_DAYS - 1 : 0;
        const recent = records.filter(record => { const age = elapsed(recordDay(record), today); return Number.isFinite(age) && age >= 0 && age <= windowDays; }).sort((a, b) => recordDay(b).localeCompare(recordDay(a)) || String(b.updatedAt || b.recordedAt || '').localeCompare(String(a.updatedAt || a.recordedAt || '')));
        result[kind] = { status: records.length ? 'available' : 'missing', total: records.length, omitted: records.length - recent.length, recent };
      } catch (_) { result[kind] = { status: 'unreadable', total: null, omitted: null, recent: [] }; }
    }
    return result;
  }
  const STAGE_CARDS = {
    cycling: ['Notice without predicting a phase', 'Keep an observation that matters to you, with its date and context. You do not need to fill every field.', 'cycle-physiology-updated', 'cycle-log.html'],
    ttc: ['Check your pre-pregnancy supplement plan', 'If you are trying to conceive, ask your pharmacist or clinician about a folic acid plan that fits you, including any prescribed medicines. Do not change prescribed care from an app suggestion.', 'daily-preconception', 'journey-grow.html'],
    pregnant: ['Follow your own maternity care plan', 'Keep questions and changes you want to discuss with your maternity team. Do not use this app to change prescribed care or a food restriction.', 'life-postnatal-redflags', 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html'],
    postpartum: ['Make room for practical support', 'Keep one recovery question, or ask someone you trust for help with meals, rest or an appointment. Your recovery has no app performance target.', 'life-postnatal-care', 'journey-nurture.html'],
    peri: ['Keep the impact alongside the symptom', 'Note what changed and how it affected sleep or daily life. Bring medicine and lab context into a care conversation rather than relying on one hormone number.', 'life-peri-testing', 'journey-peri.html'],
    post: ['Keep comfort questions in view', 'If vaginal or urinary discomfort affects you, keep a question for your clinician. Any vaginal bleeding after menopause deserves assessment.', 'life-post-bleeding', 'journey-post.html'],
    unspecified: ['Choose what feels useful to record', 'You can keep observations and ask questions without sharing a life context. Your theme is never used as a health answer.', 'daily-record-method', 'ovarian-health.html']
  };
  function plan(storage, now = new Date()) {
    const today = day(now), sources = readSources(storage, now), cards = [];
    let context = null, contextStatus = 'missing', completions = { version: 1, records: [] }, completionStatus = 'available', routine = null, routineStatus = 'missing';
    try { context = readContext(storage); if (context) { const confirmedOn = new Date(Date.parse(context.confirmedAt) - context.utcOffsetMinutes * 60000).toISOString().slice(0, 10), confirmationAge = elapsed(confirmedOn, today), statusAge = elapsed(context.statusOn, today); contextStatus = confirmationAge < 0 || statusAge < 0 || confirmationAge > CONTEXT_DAYS || statusAge > CONTEXT_DAYS ? 'stale' : 'current'; } } catch (_) { contextStatus = 'unreadable'; }
    try { completions = readCompletions(storage); } catch (_) { completionStatus = 'unreadable'; }
    try { routine = readRoutine(storage); if (routine) routineStatus = 'available'; } catch (_) { routineStatus = 'unreadable'; }
    let stage = contextStatus === 'current' ? context.stage : null;
    function add(id, priority, title, body, why, href, evidence, url, completable = true) { cards.push({ id, priority, title, body, why, href, evidence, url: url || null, completable, complete: completionStatus === 'available' && completions.records.some(record => record.taskId === id && record.completedOn === today) }); }
    const flagStages = { Pregnant: 'pregnant', Postpartum: 'postpartum', 'Perimenopause (self-reported)': 'peri', 'Postmenopause (self-reported)': 'post' };
    const conflictingObservation = stage && stage !== 'unspecified' ? sources.observations.recent.find(record => !record.contextFlags.includes('Prefer not to say') && record.contextFlags.some(flag => own(flagStages, flag) && flagStages[flag] !== stage)) : null;
    if (conflictingObservation) {
      add('check-context', 1, 'Review the context across your dates', 'A recent observation uses a different life context from your daily confirmation. That may reflect a change over time. Review the original dates and confirm what applies today. Context-specific suggestions are paused until the records are clear.', 'Your observation dated ' + conflictingObservation.observedOn + ' includes ' + conflictingObservation.contextFlags.filter(flag => own(flagStages, flag)).join(', ') + '; daily context is ' + STAGES[stage] + ' as of ' + context.statusOn + '.', 'cycle-log.html', 'daily-record-method', null, false);
      stage = null;
    }
    const bleedingEntries = sources.observations.recent.filter(record => record.kind === 'bleeding' && !record.missingReason && ['Spotting', 'Light flow', 'Moderate flow', 'Heavy flow', 'Unsure'].includes(record.values.amount));
    const bleeding = bleedingEntries[0];
    const careEntries = bleedingEntries.filter(record => !record.contextFlags.includes('Prefer not to say'));
    // A newer ordinary or private entry cannot hide an older care-relevant
    // observation. Evaluate the entire visible window, retaining source dates.
    // Explicit record context wins; a conflicted daily context has been paused.
    const careBleeding = careEntries.find(record => record.contextFlags.includes('Postmenopause (self-reported)')) || careEntries.find(record => record.contextFlags.includes('Postpartum')) || (['post', 'postpartum'].includes(stage) ? careEntries.find(record => !record.contextFlags.some(flag => own(flagStages, flag))) : null);
    if (careBleeding) {
      const flags = careBleeding.contextFlags, enteredContext = flags.some(flag => own(flagStages, flag));
      const post = flags.includes('Postmenopause (self-reported)') || (!enteredContext && stage === 'post');
      const postpartum = flags.includes('Postpartum') || (!enteredContext && stage === 'postpartum');
      const historical = careBleeding.observedOn === today ? '' : 'This is a note about bleeding logged on ' + careBleeding.observedOn + ', not a finding that you have symptoms today. ';
      const whyContext = enteredContext ? 'Context entered with this observation: ' + flags.filter(flag => own(flagStages, flag)).join(', ') + '.' : 'Your separate daily context was confirmed as ' + STAGES[stage] + ' on ' + context.statusOn + '.';
      if (post) add('bleeding-care', 0, 'Bleeding after menopause deserves care', historical + 'Arrange medical assessment for any vaginal bleeding after menopause, even slight spotting or a single episode. Logging it does not replace assessment. If you currently feel faint or seriously unwell, seek urgent care.', 'You recorded ' + careBleeding.values.amount + ' on ' + careBleeding.observedOn + '. ' + whyContext, 'cycle-log.html', 'life-post-bleeding', 'https://www.nhs.uk/symptoms/post-menopausal-bleeding/', false);
      else if (postpartum) add('bleeding-care', 0, 'Keep after-birth bleeding in context', historical + 'Bleeding after birth is not automatically a new menstrual cycle. Discuss recovery concerns with your care team; current heavy bleeding or feeling seriously unwell needs immediate care.', 'You recorded ' + careBleeding.values.amount + ' on ' + careBleeding.observedOn + '. ' + whyContext, 'cycle-log.html', 'life-postnatal-bleeding', 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html', false);
    }
    if (contextStatus !== 'current') add('check-context', 1, contextStatus === 'stale' ? 'Check whether your context has changed' : 'Choose your own daily context', contextStatus === 'unreadable' ? 'Saved context could not be read. It has not been overwritten; review your local data controls.' : 'Your appearance does not tell us your health context. You may choose Prefer not to specify. The 30-day reconfirmation reminder is an app freshness rule, not a clinical threshold.', contextStatus === 'stale' ? 'Your context date or confirmation is more than 30 days old, or later than this device date.' : 'No readable current confirmation is available.', '#daily-context-title', 'daily-record-method', null, false);
    if (stage) { const definition = STAGE_CARDS[stage]; add('stage-' + stage, 2, definition[0], definition[1], 'You confirmed ' + STAGES[stage] + ' as of ' + context.statusOn + '. Contraception answer: ' + CONTRACEPTION[context.contraception] + '.', definition[3], definition[2], stage === 'ttc' ? 'https://www.nhs.uk/pregnancy/keeping-well/pregnancy-vitamins-and-supplements/' : null); }
    const symptoms = sources.checkins.recent.find(record => record.category === 'symptoms');
    const sleep = sources.checkins.recent.find(record => record.category === 'sleep');
    // Numeric pain is a report, not a validated severity/triage threshold. This
    // dataset does not establish familiar mild cramps or absence of alarm signs.
    if (!conflictingObservation && symptoms?.values.pain > 0) add('comfort', 3, 'Keep discomfort in the conversation', 'Keep a note of what helps and what interrupts your day. If pain persists, worsens or disrupts activities, ask a qualified clinician for advice. This number alone does not choose a treatment or rule out a concern.', 'Today you entered cramp pain ' + symptoms.values.pain + ' out of 10. This is your report, not a diagnosis.', 'home.html#checkin-title', 'daily-period-care');
    else if (!conflictingObservation && sleep) {
      const menopauseComfort = ['peri', 'post'].includes(stage) && ['Very poor', 'Poor'].includes(sleep.values.quality);
      add('comfort', 3, menopauseComfort ? 'Choose a comfortable sleep setting' : 'Keep your sleep note useful', menopauseComfort ? 'For comfort, you could try a cooler bedroom and a regular routine if they suit you. Cooling is not established treatment for hot flushes. Discuss troublesome sleep or symptoms with your clinician.' : 'Notice how you feel and keep a question that matters to you. One reported sleep duration does not establish a hormone or ovarian-health change.', 'Today you entered ' + sleep.values.hours + ' hours slept' + (sleep.values.quality ? ' and ' + sleep.values.quality.toLowerCase() + ' quality.' : '; quality was not recorded.'), 'home.html#checkin-title', menopauseComfort ? 'daily-menopause-comfort' : 'daily-record-method', menopauseComfort ? 'https://www.nhs.uk/conditions/menopause-and-perimenopause/things-you-can-do/' : null);
    }
    const mood = sources.checkins.recent.find(record => record.category === 'mood'), journal = sources.journal.recent[0];
    if (['Very low', 'Low'].includes(mood?.values.mood) || journal?.mood === 'Low') add('connection', 3, 'Leave room for support', 'Consider talking with someone you trust or a qualified professional. If you feel unsafe or may harm yourself, seek immediate help through local emergency services. You do not need an app score to ask for support.', mood && ['Very low', 'Low'].includes(mood.values.mood) ? 'Today you reported mood ' + mood.values.mood + '.' : 'Your journal for today says mood Low.', 'mental-health.html', 'mental-health-support-worldwide', 'https://findahelpline.com/');
    const observation = sources.observations.recent[0];
    if (observation && !bleeding) add('review-observation', 4, 'Keep one observation in perspective', 'Check its original date, unit, source and missing-reading status. A single observation does not confirm ovulation or establish ovarian age.', 'Your latest recent observation is ' + root.OvumindObservations.FIELDS[observation.kind].title + ' on ' + observation.observedOn + (observation.missingReason ? ' · ' + observation.missingReason + '.' : '.'), 'cycle-log.html', 'daily-record-method');
    const todayCount = sources.checkins.recent.length + sources.journal.recent.length;
    add('one-note', 5, todayCount ? 'Review one note that matters today' : 'Keep one small note for today', 'Choose a symptom, a question, a small win or something you need. Logging is optional; you do not need to complete every category.', todayCount ? 'You have ' + todayCount + ' readable check-in or journal entries dated ' + today + '.' : 'No readable check-in or journal entry is dated ' + today + '. Missing data does not mean everything is normal.', 'wellness-checkin.html', 'daily-record-method');
    return { today, context, contextStatus, contextConflict: Boolean(conflictingObservation), routine, routineStatus, completionStatus, sources, cards: cards.sort((a, b) => a.priority - b.priority), windows: { contextDays: CONTEXT_DAYS, observationDays: OBSERVATION_DAYS } };
  }
  function routineCue(model, now = new Date()) {
    if (model.routineStatus === 'unreadable') return 'Saved routine time is unreadable. No notification is scheduled.';
    if (!model.routine?.enabled) return 'Return tomorrow when it suits you. You can choose an in-app routine time; no notification is scheduled.';
    const [hours, minutes] = model.routine.time.split(':').map(Number), due = now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
    return (due ? 'Your in-app routine time has arrived: ' : 'Your in-app routine time today: ') + model.routine.time + ' local time. This cue appears when the app is open; no push, email or device alarm is scheduled.';
  }
  const api = { KEYS, STAGES, CONTRACEPTION, day, elapsed, snapshot, readContext, saveContext, readRoutine, saveRoutine, readCompletions, toggleCompletion, readSources, plan, routineCue };
  root.OvumindDailyGuidance = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const d = root.document, form = d?.getElementById('daily-context-form'), preview = d?.getElementById('daily-home-preview');
  if (!form && !preview) return;
  const $ = id => d.getElementById('daily-' + id), routineForm = $('routine-form');
  let contextSnapshot = null, routineSnapshot = null, contextStale = false, routineStale = false, contextBaseline = '', routineBaseline = '', boundaryTimer;
  function el(tag, text, cls) { const node = d.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
  function message(text) { if ($('message')) $('message').textContent = text; }
  function contextDraft() { return JSON.stringify([$('stage').value, $('contraception').value, $('status-date').value, $('confirm').checked]); }
  function routineDraft() { return JSON.stringify([$('routine-time').value, $('routine-enabled').checked]); }
  function fillContext() {
    try {
      const context = readContext(root.localStorage); contextSnapshot = snapshot(root.localStorage, KEYS.context);
      $('stage').value = context?.stage || ''; $('contraception').value = context?.contraception || ''; $('status-date').value = context?.statusOn || day(); $('status-date').max = day(); $('confirm').checked = false;
      contextStale = false; $('save-context').disabled = false; contextBaseline = contextDraft();
    } catch (_) { contextStale = true; $('save-context').disabled = true; message('Saved daily context could not be read. Existing data is unchanged. Review Settings before replacing it.'); }
  }
  function fillRoutine() {
    try {
      const routine = readRoutine(root.localStorage); routineSnapshot = snapshot(root.localStorage, KEYS.routine);
      $('routine-time').value = routine?.time || ''; $('routine-enabled').checked = routine?.enabled || false; routineStale = false; $('save-routine').disabled = false; routineBaseline = routineDraft();
    } catch (_) { routineStale = true; $('save-routine').disabled = true; message('Saved routine time could not be read. Existing data is unchanged.'); }
  }
  function cardElement(card, model, compact = false, completionSnapshot) {
    const article = el('article', undefined, 'daily-task' + (card.priority === 0 ? ' daily-care' : '') + (compact ? ' daily-compact' : '')); article.dataset.task = card.id;
    const image = el('img'); image.src = card.priority === 0 ? 'assets/icons/partner.png' : card.id === 'comfort' ? 'assets/icons/sleep.png' : 'assets/knowledge/lifestyle.webp'; image.alt = ''; image.width = image.height = 48;
    article.append(image, el('h3', card.title), el('p', card.body));
    if (compact) article.append(el('p', 'Why: ' + card.why, 'daily-note'));
    else { const why = el('details'), summary = el('summary', 'Why this is here'); why.append(summary, el('p', card.why, 'daily-note')); article.append(why); }
    const links = el('div', undefined, 'daily-links'), edit = el('a', card.id === 'check-context' ? 'Review context or records' : card.priority === 0 ? 'Review the logged observation' : 'Open this space');
    edit.href = compact && card.href.startsWith('#') ? 'daily.html' + card.href : card.href; links.append(edit);
    const sourceButton = el('button', 'i', 'qi'); sourceButton.type = 'button'; sourceButton.dataset.evidence = card.evidence; sourceButton.setAttribute('aria-label', 'Sources and limitations: ' + card.title); links.append(sourceButton);
    if (card.url && !compact) { const source = el('a', 'Read the supporting source'); source.href = card.url; source.target = '_blank'; source.rel = 'noopener noreferrer'; links.append(source); } article.append(links);
    if (card.completable && !compact) {
      const label = el('label', undefined, 'daily-completion'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = card.complete;
      checkbox.disabled = model.completionStatus !== 'available' || completionSnapshot === undefined; checkbox.setAttribute('aria-label', 'Mark ' + card.title + ' as done for ' + model.today);
      label.append(checkbox, el('span', 'Reviewed or done for today')); article.append(label);
      checkbox.addEventListener('change', () => { try { toggleCompletion(root.localStorage, card.id, checkbox.checked, completionSnapshot); render(); message('Your routine mark was saved for today. You can uncheck it; it is not a health score.'); } catch (error) { checkbox.checked = card.complete; message('Could not save your routine mark: ' + error.message); } });
    }
    return article;
  }
  function render() {
    const model = plan(root.localStorage);
    if (preview) {
      preview.replaceChildren(el('p', 'A gentle moment for today', 'eyebrow'), el('h2', 'Your daily companion'), el('p', routineCue(model), 'daily-routine-cue'));
      // At most two meaningful actions. The first care note always comes first;
      // completed optional items cannot hide a care note or falsify reassurance.
      const cards = model.cards.filter(card => !card.complete || card.priority === 0).slice(0, 2);
      for (const card of cards) preview.append(cardElement(card, model, true));
      if (!cards.length) preview.append(el('p', 'You reviewed your optional routine for today. Return tomorrow; your marks are not a health assessment.', 'daily-note'));
      if (Object.values(model.sources).some(source => source.status === 'unreadable')) preview.append(el('p', 'Some saved records are unreadable and were not used. Existing data has not been changed.', 'daily-note'));
      const open = el('a', 'Open your daily space', 'daily-open'); open.href = 'daily.html'; preview.append(open);
    }
    if (!form) return;
    $('date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    $('context-state').textContent = model.contextConflict ? 'Recent observations use a different context. Context-specific suggestions are paused; review their dates.' : model.contextStatus === 'current' ? 'Self-reported context: ' + STAGES[model.context.stage] + ' · checked on ' + model.context.statusOn + '.' : model.contextStatus === 'stale' ? 'Your daily context needs reconfirmation. Context-specific suggestions are paused.' : model.contextStatus === 'unreadable' ? 'Saved context is unreadable. Context-specific suggestions are paused; existing data has not been changed.' : 'No daily context confirmed. You can still keep a general note.';
    $('tasks').replaceChildren();
    let completionSnapshot; try { completionSnapshot = snapshot(root.localStorage, KEYS.completions); } catch (_) { completionSnapshot = undefined; }
    for (const card of model.cards) $('tasks').append(cardElement(card, model, false, completionSnapshot));
    if (model.completionStatus === 'unreadable') $('tasks').append(el('p', 'Saved completion data could not be read. The routine is still readable; marks are disabled to protect existing data.', 'daily-note'));
    const sourceList = $('record-status'); sourceList.replaceChildren();
    const names = { observations: 'Cycle observations (today and the previous six days)', checkins: 'Home check-ins (today only)', journal: 'Journal (today only)' };
    for (const [kind, state] of Object.entries(model.sources)) sourceList.append(el('li', state.status === 'unreadable' ? names[kind] + ': saved records could not be read; no guidance is generated from them.' : names[kind] + ': ' + state.recent.length + ' readable entries' + (state.omitted ? ' · ' + state.omitted + ' older or future-dated entries kept in their timeline, not used here.' : '.') ));
    $('return').textContent = routineCue(model) + ' Come back tomorrow for another gentle check-in.';
  }
  function changed(event) {
    if (form) {
      try {
        if ((!event || event.key === null || event.key === KEYS.context) && snapshot(root.localStorage, KEYS.context) !== contextSnapshot) { contextStale = true; $('save-context').disabled = true; message('Daily context changed in another page. Your draft is kept; reopen saved context before changing it.'); }
        if ((!event || event.key === null || event.key === KEYS.routine) && snapshot(root.localStorage, KEYS.routine) !== routineSnapshot) { routineStale = true; $('save-routine').disabled = true; message('Routine time changed in another page. Your draft is kept; reopen it before saving.'); }
      } catch (_) { contextStale = routineStale = true; $('save-context').disabled = $('save-routine').disabled = true; message('Browser storage is unavailable. Your drafts have not been saved.'); }
    }
    render();
  }
  function schedule() {
    root.clearTimeout(boundaryTimer);
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 20);
    let nextBoundary = next.getTime();
    try {
      const routine = readRoutine(root.localStorage);
      if (routine?.enabled) { const [hours, minutes] = routine.time.split(':').map(Number), cue = new Date(now); cue.setHours(hours, minutes, 0, 20); if (cue.getTime() > now.getTime()) nextBoundary = Math.min(nextBoundary, cue.getTime()); }
    } catch (_) { /* Midnight still refreshes honest storage error messages. */ }
    boundaryTimer = root.setTimeout(() => { if (form) $('status-date').max = day(); changed(); schedule(); }, Math.max(20, nextBoundary - now.getTime()));
  }
  if (form) {
    form.addEventListener('submit', event => { event.preventDefault(); if (contextStale) return message('Reopen saved context before changing it.'); try { saveContext(root.localStorage, { stage: $('stage').value, contraception: $('contraception').value, statusOn: $('status-date').value, confirmed: $('confirm').checked }, contextSnapshot); fillContext(); render(); message('Your own daily context was saved separately from appearance. No phase or health score was calculated.'); } catch (error) { message('Could not save context: ' + error.message); } });
    routineForm.addEventListener('submit', event => { event.preventDefault(); if (routineStale) return message('Reopen saved routine time before changing it.'); try { saveRoutine(root.localStorage, { time: $('routine-time').value, enabled: $('routine-enabled').checked }, routineSnapshot); fillRoutine(); render(); schedule(); message('In-app routine time saved. No push, email or device alarm was scheduled.'); } catch (error) { message('Could not save routine time: ' + error.message); } });
    $('reload-context').addEventListener('click', () => { if (contextDraft() !== contextBaseline && !root.confirm('Discard this unsaved context draft and reopen saved context?')) return; fillContext(); render(); });
    $('reload-routine').addEventListener('click', () => { if (routineDraft() !== routineBaseline && !root.confirm('Discard this unsaved routine draft and reopen saved routine time?')) return; fillRoutine(); render(); schedule(); });
    fillContext(); fillRoutine();
  }
  root.addEventListener('storage', event => { changed(event); schedule(); });
  // Same-page record saves do not fire the native storage event. Refresh only
  // reading output; never restore context/routine fields over an unsaved draft.
  root.addEventListener('ovuluna:records-changed', () => { render(); schedule(); });
  root.addEventListener('pageshow', () => { changed(); schedule(); });
  root.addEventListener('focus', () => { changed(); schedule(); });
  root.addEventListener('pagehide', () => root.clearTimeout(boundaryTimer));
  d.addEventListener('visibilitychange', () => { if (!d.hidden) { changed(); schedule(); } });
  render(); schedule();
})(typeof window !== 'undefined' ? window : globalThis);
