/* Explicit local record actions; no autosave, imports, network requests or inference. */
(function (root) {
  'use strict';
  const d = root.document, api = root.OvulunaObservations;
  if (!d || !api || !d.getElementById('observation-form')) return;
  const $ = id => d.getElementById('observation-' + id);
  const form = $('form'), fields = $('fields'), dialog = $('confirm');
  let kind = 'bleeding', editing = null, expected = null, baseline = '', stale = false;
  let pending = null, returnFocus = null, exportLog = null, limit = 20;
  const shortNames = {bleeding:'Bleeding',bbt:'Temperature',mucus:'Mucus',urine:'Urine test',treatment:'Treatment',device:'Device / app'};
  const icons = {bleeding:'water_drop', bbt:'thermostat', mucus:'opacity', urine:'science', treatment:'medical_information', device:'watch'};
  function el(tag, text, cls) { const n = d.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function status(text) { $('status').textContent = text; }
  function source(type) { return type === 'self-observed' ? 'Self-observed' : 'Entered by you from a reading or care plan; not independently verified'; }
  function option(select, value, label) { const n = el('option', label === undefined ? value : label); n.value = value; select.append(n); }
  // These messages depend only on context explicitly entered for this observation.
  // They do not infer a life stage from age, the selected look or other records.
  const careNote = el('aside', undefined, 'observation-guidance');
  careNote.id = 'observation-care-note'; careNote.hidden = true;
  careNote.setAttribute('role', 'status'); careNote.setAttribute('aria-live', 'polite');
  form.insertBefore(careNote, $('save').closest('.observation-actions'));
  function updateCareNote() {
    careNote.replaceChildren(); careNote.hidden = true;
    if (kind !== 'bleeding' || $('missing').value) return;
    const amount = $('value-amount')?.value;
    if (!['Spotting', 'Light flow', 'Moderate flow', 'Heavy flow', 'Unsure'].includes(amount)) return;
    const flags = [...$('context-flags').querySelectorAll('input:checked')].map(input => input.value);
    if (flags.includes('Prefer not to say')) return;
    const post = flags.includes('Postmenopause (self-reported)'), postpartum = flags.includes('Postpartum');
    if (!post && !postpartum) return;
    careNote.append(el('h3', 'A care note for the context you entered'));
    function guidance(copy, key, label, destination) {
      careNote.append(el('p', copy));
      const links = el('p'), sourceButton = el('button', 'i', 'qi'), link = el('a', label);
      sourceButton.type = 'button'; sourceButton.dataset.evidence = key;
      sourceButton.setAttribute('aria-label', 'Sources: ' + label.toLowerCase());
      link.href = destination; links.append(sourceButton, d.createTextNode(' '), link); careNote.append(links);
    }
    if (post) guidance('Arrange medical assessment for any vaginal bleeding after menopause, even slight spotting or a single episode. Logging it does not replace assessment.', 'life-post-bleeding', 'Bleeding after menopause', 'journey-post.html');
    if (postpartum) guidance('Bleeding after birth is not automatically the start of a menstrual cycle. Keep postpartum context with this observation and discuss recovery concerns with your care team.', 'life-postnatal-bleeding', 'Bleeding after birth', 'journey-nurture.html');
    careNote.hidden = false;
  }
  function currentDraft() {
    return JSON.stringify([...form.querySelectorAll('input,textarea,select')].map(n => [n.id, n.type === 'checkbox' ? n.checked : n.value]));
  }
  function dirty() { return currentDraft() !== baseline; }
  function clearExport() { exportLog = null; $('export-text').value = ''; $('export-panel').hidden = true; }
  function error(err) {
    $('error').textContent = err.message || 'This action could not be completed. Your saved records have not been replaced.';
    const key = String(err.field || '').replace(/^values\./, '');
    const common = {observedOn:'date',observedTime:'time',utcOffsetMinutes:'offset',missingReason:'missing',notes:'notes'};
    const target = $(common[key] || ('value-' + key));
    if (target && !target.disabled) { target.closest('details')?.setAttribute('open', ''); target.focus(); }
    else $('error').focus();
  }
  function confirmation(title, description, label, action, trigger) {
    pending = action; returnFocus = trigger || d.activeElement;
    $('confirm-title').textContent = title; $('confirm-description').textContent = description;
    $('confirm-continue').textContent = label;
    if (typeof dialog.showModal === 'function') { dialog.showModal(); $('confirm-cancel').focus(); }
    else { const fn = pending; pending = null; if (root.confirm(title + '\n' + description)) fn(); }
  }
  function discardThen(action, trigger) {
    if (!dirty()) return action();
    confirmation('Discard this unsaved draft?', 'Your saved entries will stay. The changes in this form have not been saved.', 'Discard draft', action, trigger);
  }
  $('confirm-cancel').addEventListener('click', () => dialog.close());
  $('confirm-continue').addEventListener('click', () => { const action = pending; pending = null; returnFocus = null; dialog.close(); if (action) action(); });
  dialog.addEventListener('close', () => { pending = null; if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog.addEventListener('cancel', () => { pending = null; });
  function syncFields() {
    const missing = Boolean($('missing').value);
    api.FIELDS[kind].fields.forEach(f => {
      const input = $('value-' + f.key), wrap = input.closest('.observation-field');
      const show = !f.showWhen || $('value-' + f.showWhen.key)?.value === f.showWhen.equals;
      wrap.hidden = !show;
      input.disabled = !show || (missing && f.measurement === true);
      input.required = Boolean(f.required && !missing && show);
    });
    updateCareNote();
  }
  function mount(type, record) {
    kind = type; editing = record?.id || null; fields.replaceChildren();
    $('date').max = api.day(); $('date').value = record?.observedOn || api.day();
    $('time').value = record?.observedTime || '';
    $('offset').value = record?.utcOffsetMinutes == null ? '' : formatOffset(record.utcOffsetMinutes);
    $('missing').value = record?.missingReason || ''; [...$('missing').options].forEach(n=>{n.hidden=n.disabled=n.value==='Invalid test'&&kind!=='urine';}); $('notes').value = record?.notes || '';
    $('context-flags').querySelectorAll('input').forEach(n => { n.checked = Boolean(record?.contextFlags?.includes(n.value)); });
    const def = api.FIELDS[kind];
    $('form-title').textContent = (editing ? 'Edit ' : 'Add ') + def.title.toLowerCase();
    $('mode').textContent = editing ? 'Editing saved entry' : 'New entry';
    $('hint').textContent = def.hint; $('source').textContent = 'Source: ' + source(def.sourceType) + '.';
    $('save').textContent = editing ? 'Save changes' : 'Save observation';
    d.querySelectorAll('[data-observation-kind]').forEach(n => n.setAttribute('aria-pressed', String(n.dataset.observationKind === kind)));
    for (const f of def.fields) {
      const wrap = el('div', undefined, 'observation-field'), label = el('label', f.label + (f.required ? ' *' : ' (optional)'));
      label.htmlFor = 'observation-value-' + f.key;
      const input = el(f.type === 'select' ? 'select' : f.multiline ? 'textarea' : 'input');
      input.id = label.htmlFor; input.name = f.key;
      if (f.type === 'select') { option(input, '', 'Choose an answer'); f.options.forEach(v => option(input, v)); }
      else if (f.type === 'date' || f.type === 'time') input.type = f.type;
      else { if (input.tagName === 'INPUT') input.type = 'text'; else input.rows = 3; input.maxLength = f.maxLength || (f.type === 'number' ? 40 : 160); if (f.type === 'number') input.inputMode = 'decimal'; }
      input.value = record?.values[f.key] ?? ''; wrap.append(label, input);
      if (f.hint) wrap.append(el('p', f.hint, 'observation-note'));
      fields.append(wrap);
    }
    syncFields(); $('error').textContent = ''; stale = false;
    try { expected = api.snapshot(root.localStorage); api.read(root.localStorage); $('save').disabled = false; }
    catch (err) { stale = true; $('save').disabled = true; error(err); }
    baseline = currentDraft();
  }
  function begin(type, record) { mount(type, record); $('date').focus(); }
  function formatOffset(minutes) { const n = Math.abs(minutes); return (minutes < 0 ? '-' : '+') + String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function offset() {
    const value = $('offset').value.trim(); if (!value) return null;
    if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value) || (value.slice(1, 3) === '14' && value.slice(4) !== '00')) {
      const err = new Error('Enter an offset such as +08:00, or leave it blank if unknown.'); err.field = 'utcOffsetMinutes'; throw err;
    }
    return (value[0] === '-' ? -1 : 1) * (Number(value.slice(1,3)) * 60 + Number(value.slice(4)));
  }
  function collect() {
    const values = {}; api.FIELDS[kind].fields.forEach(f => { const n = $('value-' + f.key); values[f.key] = n.disabled ? null : n.value; });
    return { ...(editing ? {id:editing} : {}),kind,observedOn:$('date').value,observedTime:$('time').value,utcOffsetMinutes:offset(),missingReason:$('missing').value,contextFlags:[...$('context-flags').querySelectorAll('input:checked')].map(n => n.value),notes:$('notes').value,values };
  }
  function lines(record) {
    const result = [['Observation time', record.observedTime || 'Not recorded'], ['UTC offset at observation',record.utcOffsetMinutes == null ? 'Not recorded' : formatOffset(record.utcOffsetMinutes)],['Source',source(record.sourceType)],['Reading status',record.missingReason || 'Observation entered']];
    for (const f of api.FIELDS[record.kind].fields) {
      if (f.showWhen && record.values[f.showWhen.key] !== f.showWhen.equals) continue;
      const value = record.values[f.key]; result.push([f.label, value == null ? 'Not recorded' : String(value)]);
    }
    result.push(['Context',record.contextFlags.length ? record.contextFlags.join('; ') : 'Not recorded'],['Notes',record.notes || 'Not recorded'],['First saved',record.createdAt],['Last edited',record.updatedAt]);
    return result;
  }
  function ordered(records) { return records.slice().sort((a,b) => b.observedOn.localeCompare(a.observedOn) || (b.observedTime || '').localeCompare(a.observedTime || '') || b.createdAt.localeCompare(a.createdAt)); }
  function refresh() {
    const list = $('history'); list.replaceChildren(); $('export').disabled = true; $('more').hidden = true;
    try {
      const log = api.read(root.localStorage); $('count').textContent = log.records.length + (log.records.length === 1 ? ' entry' : ' entries');
      const shown = ordered(log.records.filter(r => !$('filter').value || r.kind === $('filter').value));
      if (!shown.length) list.append(el('p', log.records.length ? 'No entries for this observation type.' : 'No observations saved yet. Your first entry will appear here.'));
      shown.slice(0,limit).forEach(r => {
        const card = el('article'); card.append(el('h3',api.FIELDS[r.kind].title + ' · ' + r.observedOn));
        const details = el('details'), summary = el('summary','Read entry details'); details.append(summary);
        const dl = el('dl'); for (const [label,value] of lines(r)) dl.append(el('dt',label),el('dd',value)); details.append(dl); card.append(details);
        const row = el('div',undefined,'observation-actions'), edit = el('button','Edit'), remove = el('button','Delete entry'); edit.type = remove.type = 'button';
        edit.setAttribute('aria-label','Edit ' + api.FIELDS[r.kind].title.toLowerCase() + ' on ' + r.observedOn);
        edit.addEventListener('click',() => discardThen(() => { try { const current=api.read(root.localStorage).records.find(x=>x.id===r.id); if (!current) throw Error('This entry was removed. Refresh the timeline.'); begin(current.kind,current); } catch(err) { error(err);refresh(); } },edit));
        remove.addEventListener('click',() => {
          try { const snap=api.snapshot(root.localStorage), current=api.read(root.localStorage).records.find(x=>x.id===r.id); if (!current) throw Error('This entry was already removed.');
            confirmation('Delete this observation?', api.FIELDS[r.kind].title + ' on ' + r.observedOn + '. This permanently removes this entry from this installation. Other entries and downloaded copies stay.', 'Delete entry', () => {
              try {
                api.remove(root.localStorage,r.id,snap); clearExport(); refresh();
                const remaining=JSON.parse(snap);remaining.records=remaining.records.filter(entry=>entry.id!==r.id);
                const after=JSON.stringify(remaining);
                if(editing===r.id || api.snapshot(root.localStorage)!==after) invalidate('This entry was deleted or data changed. Start a new entry or reopen one from the timeline before saving.');
                else { expected=after; }
                status('Observation deleted from this installation.');$('history-title').tabIndex=-1;$('history-title').focus();
              }
              catch(err) { error(err);refresh(); }
            },remove);
          } catch(err) { error(err);refresh(); }
        });
        row.append(edit,remove); card.append(row); list.append(card);
      });
      $('more').hidden = shown.length <= limit; $('export').disabled = !log.records.length;
    } catch(err) { $('count').textContent='Unavailable';list.append(el('p','Saved observations could not be read. Existing data is unchanged.')); error(err); }
  }
  function invalidate(message) { stale=true; $('save').disabled=true; $('error').textContent=message;clearExport(); }
  api.MISSING_REASONS.forEach(v=>option($('missing'),v));
  api.CONTEXT_FLAGS.forEach((v,i)=>{ const label=el('label'),input=el('input'); input.type='checkbox';input.value=v;input.id='observation-context-'+i;label.append(input,el('span',v));$('context-flags').append(label); });
  for (const [key,def] of Object.entries(api.FIELDS)) {
    const button=el('button');button.type='button';button.dataset.observationKind=key;button.setAttribute('aria-pressed','false');const icon=el('span',icons[key],'ms');icon.setAttribute('aria-hidden','true');button.append(icon,el('span',shortNames[key]));button.addEventListener('click',()=>{if(kind!==key || editing)discardThen(()=>begin(key),button);});$('kinds').append(button);option($('filter'),key,def.title);
  }
  fields.addEventListener('change',syncFields); $('missing').addEventListener('change',syncFields);
  $('context-flags').addEventListener('change',updateCareNote);
  $('reset').addEventListener('click',e=>discardThen(()=>begin(kind),e.currentTarget));
  $('filter').addEventListener('change',()=>{limit=20;refresh();});$('more').addEventListener('click',()=>{limit+=20;refresh();});
  form.addEventListener('submit',e=>{
    e.preventDefault();if(stale)return error(Error('Saved data changed. Start a new entry or reopen an existing entry before saving.'));
    try { const r=api.save(root.localStorage,collect(),expected); clearExport();mount(kind);refresh();status(api.FIELDS[r.kind].title+' saved for '+r.observedOn+' in this installation.'); }
    catch(err) { error(err); }
  });
  function renderExport() {
    if(!exportLog)return;
    if($('export-format').value==='json')$('export-text').value=JSON.stringify({exportVersion:1,exportedAt:new Date().toISOString(),scope:'Ovuluna locally entered observations only; no lab/journal records or clinical interpretation',...exportLog},null,2);
    else $('export-text').value=['OVULUNA · OBSERVATIONS FOR A CARE VISIT','Prepared '+new Date().toISOString(),'User-entered, not independently verified. No diagnoses or inferred missing readings.','Includes saved observations only. Lab reports and wellness journal entries are exported separately.','Dates/times are as entered; an unknown time zone remains unknown.','',...ordered(exportLog.records).flatMap(r=>[api.FIELDS[r.kind].title+' · '+r.observedOn,'Entry ID: '+r.id,...lines(r).map(([label,value])=>label+': '+value),''])].join('\n');
  }
  $('export').addEventListener('click',()=>{try{exportLog=api.read(root.localStorage);renderExport();$('export-panel').hidden=false;$('export-panel').scrollIntoView({block:'start'});status('Export prepared locally. Store it privately; nothing has been sent.');}catch(err){clearExport();error(err);}});
  $('export-format').addEventListener('change',renderExport);
  $('export-close').addEventListener('click',()=>{clearExport();$('export').focus();});
  $('copy').addEventListener('click',()=>{$('export-text').focus();$('export-text').select();status('Export selected. Use your device’s Copy command.');});
  $('download').addEventListener('click',()=>{
    if(!exportLog)return;
    if(root.OvulunaRuntime?.platform==='ios-development'||root.location.protocol==='capacitor:')return status('Native file sharing is not connected. Select and copy the export instead.');
    let url;
    try {const json=$('export-format').value==='json';url=URL.createObjectURL(new Blob([$('export-text').value],{type:json?'application/json':'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download='ovuluna-observations-'+api.day()+(json?'.json':'.txt');d.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Browser download requested. Check that the file was saved.');}
    catch(err){if(url)URL.revokeObjectURL(url);error(err);}
  });
  function checkChanges() {
    try { if(api.snapshot(root.localStorage)!==expected){invalidate('Local observations changed in another tab. Your draft is kept, but cannot overwrite those changes. Start a new entry or reopen one from the timeline.');if(dialog.open)dialog.close();refresh();} }
    catch(err){invalidate('Local storage is unavailable. Your draft has not been saved.');error(err);}
  }
  root.addEventListener('storage',e=>{if(e.key===api.KEY||e.key===null){invalidate('Local observations changed in another tab. Your draft is kept, but cannot overwrite those changes. Start a new entry or reopen one from the timeline.');if(dialog.open)dialog.close();refresh();}});
  root.addEventListener('pageshow',checkChanges);d.addEventListener('visibilitychange',()=>{if(!d.hidden)checkChanges();});
  root.addEventListener('pagehide',()=>{clearExport();if(dialog.open)dialog.close();});
  root.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
  mount(kind);refresh();
})(window);
