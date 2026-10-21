/* Rhythme consent: an append-only log of choices, one purpose at a time (Jamie's build prompt, 19 Oct 2026,
 * sections 4.2 and 4.3; plan in docs/design/2026-10-19-consent-rebuild-plan.md).
 *
 * The record is profile.consentEvents: {id, purpose, action, at, notice, method, uid, sent}. The current state is
 * the latest event per purpose. Everything else the app reads is a mirror kept in step here: Luna's switches in
 * localStorage (ovumind_ai_v1), profile.cloud for sync, and profile.consent {v, at} for the page gates. A
 * signed-in person's events are also written to public.consent_events through consent_record(), so the server
 * can refuse a diary read or a sync write that the person has not allowed.
 *
 * Only one choice is required: health tracking on this phone, which is what the diary is. Everything else is off
 * until the person turns it on, in the notice sheet, in You, or at the first use of a feature (a "jit" grant).
 * The age gate is one attestation, profile.ageAttest {confirmed, version, at}: no date of birth, no bands. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var CFG = root.OVU_CONFIG || {};
  var NOTICE_V = (S && S.NOTICE_V) || 3;
  var AGE_V = 1;
  var AI_KEY = 'ovumind_ai_v1';
  var DEVICE_KEY = 'ovumind_device_v1';
  var LEGACY_MINOR = ['under13', '13-16', '13-17', '17'];
  var REGION_AI = 'China';
  var REGION_CLOUD = 'Singapore';

  /* The purposes, in the order the sheet shows them. Each body is the consent text for that purpose; a hash of
     title and body travels with every event, so a later change of words needs a new notice version. */
  var PURPOSES = [
    { id: 'health_tracking', required: true, title: 'Health tracking on this phone', icon: 'edit_note',
      body: 'Periods, symptoms, pain, mood, sleep, meals and food photo thumbnails, weight, calm minutes and your getting-to-know-you answers stay in this browser on this phone. This is what the diary is, so it is the one choice Rhythme needs.' },
    { id: 'cloud_sync', title: 'Cloud backup', icon: 'cloud_sync', account: true,
      body: 'A copy of your entries, your getting-to-know-you answers and your cycle settings is kept in your account, in a secure database hosted in ' + REGION_CLOUD + '. Other Rhythme users cannot see your backup. Rhythme’s server uses it to back up, restore and delete your diary; authorised Rhythme administrators and the companies that run the database can reach records only when needed to run, secure or support the service. Backup needs an account and starts after you sign in from You.' },
    { id: 'ai_reading', title: 'Luna reads notes she cannot work out', icon: 'auto_awesome',
      body: 'When Luna’s own rules cannot read a note, her AI help reads it. Your name is never added, and Rhythme keeps none of it.' },
    { id: 'food_photo_ai', title: 'Luna recognises food photos', icon: 'photo_camera',
      body: 'Luna’s AI help names the food in your photo. Rhythme keeps none of it; a small thumbnail stays on this phone.' },
    { id: 'ai_summaries', title: 'Luna writes journal readings', icon: 'menu_book',
      body: 'Luna’s AI help writes a reading of your last 7 or 28 days. Your name is never added, and Rhythme keeps none of it.' },
    { id: 'improve_logging', title: 'Help improve logging', icon: 'volunteer_activism', account: true,
      body: 'Rhythme’s server may use the backed-up entries of adults who turned this on to compute group counts and averages, to improve logging, reminders and the app. Staff are shown only group results across at least 20 adults, never your entries, notes or name. You can turn this off at any time and keep your backup.' },
    { id: 'personalisation', hidden: true, title: 'Personalised suggestions', icon: 'tune', body: 'Not offered yet.' },
    { id: 'research', hidden: true, title: 'Research', icon: 'science', body: 'Not offered yet.' }
  ];
  /* where Luna's AI help runs, shown beside the three AI switches (four-persona review, 20 Oct: the switches did not say;
     privacy.html did). Kept outside the hashed purpose bodies, so it informs every choice without changing a recorded notice. */
  var AI_WHERE = 'Where the AI help runs: when any of the three Luna switches below is on, that note, photo or summary goes through Rhythme’s server in ' + REGION_CLOUD + ' to a third-party AI service in ' + REGION_AI + ', and the answer comes back to you. No name is attached, but what you write can still say a lot about your health.';
  var AI_WHERE_HTML = '<p class="c-where" role="note">' + AI_WHERE.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>';
  function purpose(id) { return PURPOSES.filter(function (p) { return p.id === id; })[0] || null; }
  function nowIso() { return new Date().toISOString(); }
  function uid() { return root.OvuAuth && root.OvuAuth.userId ? (root.OvuAuth.userId() || null) : null; }
  function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function device() { try { var d = localStorage.getItem(DEVICE_KEY); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, d); } return d; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  /* ---------- the log and its derived state ---------- */
  function events() { var p = S.profile(); return Array.isArray(p.consentEvents) ? p.consentEvents.slice() : []; }
  /* pure: the latest event per purpose, in log order */
  function stateFromEvents(evs) {
    var st = {};
    (evs || []).forEach(function (e) { if (!e || !e.purpose) return; st[e.purpose] = { on: e.action === 'grant', at: e.at, notice: e.notice, method: e.method, uid: e.uid || null }; });
    return st;
  }
  function state() { return stateFromEvents(events()); }
  /* Luna's three AI choices, and the pause that holds them off (ovu-config.js aiPaused) */
  var AI_IDS = { ai_reading: 1, food_photo_ai: 1, ai_summaries: 1 };
  function aiPaused() { return !(root.OVU_CONFIG && root.OVU_CONFIG.aiPaused === false); } /* off unless the config says so explicitly: a missing or older config keeps it paused */
  function boundTo(p) { var s = state()[p]; return !!(s && s.uid); } /* the choice was recorded on an account */
  var PAUSED_LINE = 'Paused for now, while we move Luna’s AI help to a service licensed for Singapore. Your diary and Luna’s own rules work as usual.';
  function allows(p) { if (AI_IDS[p] && aiPaused()) return false; var s = state()[p]; return !!(s && s.on); }
  function noticeText() { return PURPOSES.map(function (p) { return p.title + '. ' + p.body; }).join('\n'); }
  function sha256hex(s) {
    try { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }, function () { return ''; }); } catch (e) { return Promise.resolve(''); }
  }
  var hashCache = null, hashHex = '';
  function noticeHash() { if (hashCache) return hashCache; hashCache = sha256hex(noticeText()).then(function (h) { hashHex = h || ''; return hashHex; }); return hashCache; }

  /* ---------- mirrors: Luna's switches, the cloud flag, the page-gate summary ---------- */
  function readAi() { var c; try { c = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); } catch (e) { c = null; } return c || { on: false, provider: 'ovumind', insights: false, photos: false }; }
  function apply() {
    var st = state(), p = S.profile();
    try { localStorage.setItem(AI_KEY, JSON.stringify({ on: allows('ai_reading'), provider: 'ovumind', insights: allows('ai_summaries'), photos: allows('food_photo_ai') })); } catch (e) { }
    var cs = st.cloud_sync, cloud = cs && cs.on ? { v: 1, at: cs.at, uid: cs.uid || null } : { v: 0, at: nowIso() };
    var ht = st.health_tracking, consent = ht && ht.on ? { v: ht.notice || NOTICE_V, at: ht.at, luna: allows('ai_reading'), improve: allows('improve_logging') } : null;
    var patch = {};
    if (JSON.stringify(p.cloud || null) !== JSON.stringify(cloud)) patch.cloud = cloud;
    if (JSON.stringify(p.consent || null) !== JSON.stringify(consent)) patch.consent = consent;
    if (Object.keys(patch).length) S.setProfile(patch);
  }

  /* ---------- recording ---------- */
  /* the log is never truncated blind: past 1500 events the oldest superseded ones go, the latest per purpose always stays */
  function compact(evs) {
    if (evs.length <= 1500) return evs;
    var keep = {}; evs.forEach(function (e) { keep[e.purpose] = e.id; });
    var cut = evs.length - 800;
    return evs.filter(function (e, i) { return i >= cut || keep[e.purpose] === e.id; });
  }
  function record(purposeId, action, method, extra) {
    var ev = Object.assign({ id: newId(), purpose: purposeId, action: action === 'withdraw' ? 'withdraw' : 'grant', at: nowIso(), notice: NOTICE_V, method: method || 'you', uid: uid(), sent: false }, extra || {});
    S.setProfile({ consentEvents: compact(events().concat([ev])) });
    apply();
    try { if (root.OvuInsight && root.OvuInsight.onConsentChange) root.OvuInsight.onConsentChange(purposeId, ev.action === 'grant'); } catch (e) { }
    if (ev.uid && !ev.sent) flush();
    return ev;
  }
  function grant(p, method, extra) { return record(p, 'grant', method, extra); }
  function withdraw(p, method, extra) { return record(p, 'withdraw', method, extra); }
  /* set several at once; only changes are recorded, unless force is set (the notice sheet records every "on" at its version) */
  function setMany(map, method, force) {
    var st = state(), out = [];
    Object.keys(map).forEach(function (p) {
      var want = !!map[p], has = !!(st[p] && st[p].on);
      if (want && AI_IDS[p] && aiPaused()) return; /* paused: an AI choice cannot be turned on */
      if (want && (force || !has)) out.push(grant(p, method));
      else if (!want && has) out.push(withdraw(p, method));
    });
    return out;
  }

  /* ---------- the first run after this release: today's flags become events ---------- */
  /* pure: what the old flags say, as events dated when they were set */
  function importEventsFrom(p, ai) {
    var evs = [], c = p && p.consent;
    if (!c || !c.at) return evs;
    var notice = Math.max(1, Number(c.v) || 1);
    var mk = function (purposeId, at, u) { return { id: newId(), purpose: purposeId, action: 'grant', at: at || c.at, notice: notice, method: 'import', uid: u || null, sent: false }; };
    evs.push(mk('health_tracking'));
    if (ai && ai.on) evs.push(mk('ai_reading'));
    if (ai && ai.insights) evs.push(mk('ai_summaries'));
    if (ai && ai.photos) evs.push(mk('food_photo_ai'));
    if (p.cloud && p.cloud.v >= 1 && p.cloud.at && p.cloud.uid) evs.push(mk('cloud_sync', p.cloud.at, p.cloud.uid));
    if (p.analysis && p.analysis.on === true) evs.push(mk('improve_logging', p.analysis.at, p.analysis.uid || null));
    return evs;
  }
  function importLegacy() {
    var p = S.profile();
    if ((p.consentEvents && p.consentEvents.length) || p.consentImportedAt) return false;
    var evs = importEventsFrom(p, readAi());
    S.setProfile({ consentEvents: evs, consentImportedAt: nowIso() });
    return evs.length > 0;
  }

  /* ---------- the age gate ---------- */
  function ageOk() { var a = S.profile().ageAttest; return !!(a && a.confirmed === true && (a.version || 0) >= AGE_V); }
  function legacyMinor() { return LEGACY_MINOR.indexOf(S.profile().ageBand || '') > -1; }
  function attestAge(method) { S.setProfile({ ageAttest: { confirmed: true, version: AGE_V, at: nowIso() } }); return record('age_18', 'grant', method || 'sheet'); }
  /* the sheet is needed until the person has attested 18+ and accepted health tracking at this notice */
  function needsSheet() { var ht = state().health_tracking; return !ageOk() || !(ht && ht.on && (ht.notice || 0) >= NOTICE_V); }

  /* ---------- receipts and headers ---------- */
  function receipt() {
    var st = state(), evs = events(), last = evs.length ? evs[evs.length - 1] : null, p = S.profile(), u = uid();
    var purposes = {}; PURPOSES.forEach(function (x) { if (!x.hidden) purposes[x.id] = !!(st[x.id] && st[x.id].on); });
    var pending = u ? evs.filter(function (e) { return e.uid === u && !e.sent && !e.failed; }).length : 0, failed = u ? evs.filter(function (e) { return e.uid === u && e.failed; }).length : 0;
    return { noticeVersion: NOTICE_V, noticeHash: hashHex || null, at: last ? last.at : null, userId: u, recorded: !!(u && pending === 0 && failed === 0), pending: pending, failed: failed, device: device(), purposes: purposes, ageAttest: p.ageAttest || null, method: last ? last.method : null, events: evs.length };
  }
  /* what a request to Rhythme's own functions carries for a person without an account: the phone's word, recorded by the function */
  function header(p) { return allows(p) ? { 'X-Rhythme-Consent': p + ';notice=' + NOTICE_V + ';device=' + device() } : {}; }

  /* ---------- the account: binding and the server record ---------- */
  function rpc(name, args, u) {
    var A = root.OvuAuth; if (!A || !A.token) return Promise.resolve(null);
    return A.token().then(function (at) {
      if (!at || (u && uid() !== u)) return null; /* no session, or a different account by now: this token is not for that event */
      return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { } if (!r.ok) { var e2 = new Error((j && (j.message || j.error)) || ('request failed (' + r.status + ')')); e2.status = r.status; throw e2; } return j; }); });
    });
  }
  var flushing = null, flushAgain = false;
  function mark(id, patch) { var evs = events(); evs.forEach(function (x) { if (x.id === id) Object.assign(x, patch); }); S.setProfile({ consentEvents: evs }); }
  /* send the signed-in account's unsent events, oldest first, until none is left (a choice made during the send is picked
     up too); the account is pinned for the whole run, so a sign-out or a switch stops it with the rest unsent; an event the
     server refuses outright (a 4xx that is not a session or rate problem) is marked failed and skipped, never a cork. */
  function drain(u, h, n) {
    if (uid() !== u) return Promise.resolve(n);
    /* the account's improve-logging choice is recorded by the server's own setter (ovu-auth.js setImprove); its mirror here is
     * marked recorded only once the account's record, as this phone last read it, holds that same choice, and is never sent */
    var A = root.OvuAuth, viaAccount = !!(A && A.setImprove);
    function confirmed(e) { var l = viaAccount && A.improveLocal ? A.improveLocal() : null; return !!(l && l.uid === u && l.syncedAt && l.on === (e.action === 'grant')); }
    var next = events().filter(function (e) { return e.uid === u && !e.sent && !e.failed && !(e.purpose === 'improve_logging' && viaAccount && !confirmed(e)); })[0];
    if (!next) return Promise.resolve(n);
    var notice = next.notice || NOTICE_V;
    /* the account's improve-logging choice is recorded by the server's own setter (ovu-auth.js setImprove); the mirror of it is kept on this phone and never sent as a second record */
    if (next.purpose === 'improve_logging' && viaAccount) { mark(next.id, { sent: true, serverId: null, via: 'account' }); return drain(u, h, n); }
    return rpc('consent_record', { p_purpose: next.purpose, p_action: next.action, p_notice: notice, p_hash: notice >= NOTICE_V ? (h || null) : null, p_method: next.method || 'you', p_device: device(), p_client_at: next.at, p_client_id: next.id }, u).then(function (row) {
      if (row === null || uid() !== u) return n;
      mark(next.id, { sent: true, serverId: row && row.id });
      return drain(u, h, n + 1);
    }, function (err) {
      var st = err && err.status;
      if (st >= 400 && st < 500 && st !== 401 && st !== 403 && st !== 429) { mark(next.id, { failed: (err && err.message) || 'refused' }); return drain(u, h, n); }
      throw err;
    });
  }
  function flush() {
    var u = uid(); if (!u) return Promise.resolve(0);
    if (flushing) { flushAgain = true; return flushing; }
    if (!events().some(function (e) { return e.uid === u && !e.sent && !e.failed; })) return Promise.resolve(0);
    flushing = noticeHash().then(function (h) { return drain(u, h, 0); }).then(function (n) {
      flushing = null;
      if (flushAgain) { flushAgain = false; return flush().then(function (m) { return n + (m > 0 ? m : 0); }); }
      return n;
    }, function () { flushing = null; flushAgain = false; return -1; });
    return flushing;
  }
  /* the account's own record, for reconciling before a sync; null when it cannot be read */
  function pullAccountState() {
    var u = uid(); if (!u) return Promise.resolve(null);
    return rpc('consent_state_mine', {}, u).then(function (st) { return st && typeof st === 'object' ? st : null; }, function () { return null; });
  }
  /* true once the account has this purpose's latest event on record */
  function recordedOnAccount(p) { var u = uid(); if (!u) return false; var mine = events().filter(function (e) { return e.purpose === p && e.uid === u; }); var last = mine[mine.length - 1]; return !!(last && last.sent); }
  /* after a sign-in: a choice made before any account (uid null) belongs to the first account that signs in */
  function bindAccount() {
    var u = uid(); if (!u) return Promise.resolve(0);
    var evs = events(), st = stateFromEvents(evs), changed = false;
    ['cloud_sync', 'improve_logging', 'ai_reading', 'food_photo_ai', 'ai_summaries', 'health_tracking', 'age_18'].forEach(function (p) {
      var s = st[p]; if (s && s.on && !s.uid) { evs.push({ id: newId(), purpose: p, action: 'grant', at: nowIso(), notice: s.notice || NOTICE_V, method: s.method || 'sheet', uid: u, sent: false, bound: s.at }); changed = true; }
    });
    if (changed) { S.setProfile({ consentEvents: evs.slice(-400) }); apply(); }
    return flush();
  }

  /* ---------- the sheet (#consent in room.html) ---------- */
  function toggleHTML(p, on, note) {
    var paused = AI_IDS[p.id] && aiPaused();
    return '<label class="c-opt' + (paused ? ' c-paused' : '') + '" data-purpose="' + p.id + '"><input type="checkbox" id="c_' + p.id + '"' + (on && !paused ? ' checked' : '') + (paused ? ' disabled' : '') + '><span><b>' + esc(p.title) + '</b><small>' + esc(paused ? PAUSED_LINE : p.body) + (note ? ' ' + esc(note) : '') + '</small></span></label>';
  }
  function fillSheet(c) {
    var st = state(), returning = !!(S.profile().consent && S.profile().consent.at), minor = legacyMinor(), u = uid();
    var title = c.querySelector('#cTitle'), sub = title && title.nextElementSibling, fine = c.querySelector('#cFine'), lbl = c.querySelector('.c-lbl'), box = c.querySelector('#cChoices'), age = c.querySelector('#cAge'), minorNote = c.querySelector('#cMinor');
    if (title) title.textContent = returning ? 'Our data notice has changed' : 'Before your room opens';
    if (sub) sub.textContent = returning ? 'Rhythme is now for adults, has accounts and cloud backup, and asks about each use of your data separately. Please read what is new. Your diary on this phone is kept as it is.' : 'What Rhythme keeps, where it goes, and the choices that stay yours.';
    if (fine) fine.textContent = returning ? 'Your diary on this phone is kept as it is.' : 'No diary entries have been saved yet.';
    if (lbl) lbl.textContent = returning ? 'Your choices (all optional, shown as you have them today; anything new starts off)' : 'Your choices (all optional, all off until you turn them on)';
    if (minorNote) { minorNote.hidden = !minor; minorNote.style.display = minor ? '' : 'none'; } /* the flag's own display rule would beat the hidden attribute */
    if (box) box.innerHTML = PURPOSES.filter(function (p) { return !p.required && !p.hidden; }).map(function (p) {
      var on = !!(st[p.id] && st[p.id].on && (!p.account || !st[p.id].uid || st[p.id].uid === u));
      return toggleHTML(p, on, '') + (p.id === 'ai_reading' && !aiPaused() ? AI_WHERE_HTML : '');
    }).join('');
    if (age) age.checked = false;
  }
  function require(next, ui) {
    ui = ui || {};
    if (!needsSheet()) { if (next) next(); return; }
    var c = document.getElementById('consent'); if (!c) return;
    c.classList.toggle('returning', !!(S.profile().consent && S.profile().consent.at));
    fillSheet(c);
    c.hidden = false; try { c.querySelector('.c-scroll').scrollTop = 0; } catch (e) { }
    var age = c.querySelector('#cAge'), health = c.querySelector('#cHealth'), agree = c.querySelector('#cAgree'), under = c.querySelector('#cUnder');
    /* the one required line starts ticked (Jamie, 19 Oct): the diary cannot work without it and tapping I agree is the person's act.
       The optional choices and the 18+ confirmation still start unticked, because a pre-ticked box is not consent or an attestation. */
    if (health) health.checked = true;
    var ready = function () { return age.checked && (!health || health.checked); };
    age.onchange = function () { agree.disabled = !ready(); }; if (health) health.onchange = function () { agree.disabled = !ready(); };
    agree.disabled = !ready();
    if (under) under.onclick = function () { blockUnder18(c); };
    agree.onclick = function () {
      if (!ready()) return;
      if (ui.chime) ui.chime('tap');
      var map = {}; PURPOSES.filter(function (p) { return !p.required && !p.hidden; }).forEach(function (p) { var i = c.querySelector('#c_' + p.id); map[p.id] = !!(i && i.checked); });
      var improve = !!map.improve_logging; delete map.improve_logging;
      var hasAuth = !!(root.OvuAuth && root.OvuAuth.setImprove), wasOn = allows('improve_logging') || !!(S.profile().analysis && S.profile().analysis.on);
      function record() { attestAge('sheet'); grant('health_tracking', 'sheet'); setMany(map, 'sheet', true); if (!hasAuth && improve) grant('improve_logging', 'sheet'); }
      function open() { c.hidden = true; if (next) next(); }
      var em = c.querySelector('#cImproveErr'); if (em) em.hidden = true;
      if (!hasAuth || (!improve && !wasOn)) { record(); open(); return; }
      agree.disabled = true;
      /* a withdrawal has to reach the account before anything on this notice is recorded: if it does not, nothing is saved,
         the notice stays (and comes back after a reload) and says so (Codex legal reviews, 20 Oct: a failed withdrawal was
         accepted, then the saved notice let the room open with the permission still on). A grant records the notice first,
         as the account needs the 18+ attestation on record. */
      if (improve) record();
      root.OvuAuth.setImprove(improve, 'sheet').then(function (r) { return r; }, function (e) { return { ok: false, error: e && e.message }; }).then(function (r) {
        agree.disabled = !ready();
        if (r && r.ok) { if (!improve) record(); open(); return; }
        if (!improve) {
          if (!em) { em = document.createElement('p'); em.id = 'cImproveErr'; em.className = 'c-err'; em.setAttribute('role', 'alert'); agree.parentNode.insertBefore(em, agree); }
          em.textContent = 'Your change has not reached your account, so Help improve logging is still on. Check your connection and tap the button again, or write to hello@ranklore.ai.'; em.hidden = false; return;
        }
        /* neutral on purpose: another phone may have changed it meanwhile, and the account's setting is the one that counts (Codex legal review 3) */
        if (ui.toast) ui.toast('Help improve logging could not be changed just now. Check its current setting in You, and try again there if you want to.', 'info');
        open();
      });
    };
  }
  function download(name, text) { try { var b = new Blob([text], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500); } catch (e) { } }
  /* nothing is written: the room stays shut, the diary already on this phone can be taken away or removed right here */
  function blockUnder18(c) {
    var scroll = c.querySelector('.c-scroll'); if (!scroll) return;
    scroll.innerHTML = '<div class="c-head"><div class="c-moon" aria-hidden="true"><img src="assets/room/dream/orb-luna.webp" alt="" data-mascot="full"></div><div><div class="w-brand">RHYTHME</div><h2>Rhythme is designed for adults 18 and over</h2><p>We are not able to open Rhythme for you yet. The diary on this phone stays here, and you can take a copy or remove it below. If you already made an account, write to hello@ranklore.ai and we will close it and delete its cloud copy.</p></div></div>' +
      '<div class="c-choices"><button type="button" class="btn soft" id="cExport"><span class="ms">download</span>Export my diary as a file</button><button type="button" class="btn ghost" id="cWipe"><span class="ms">delete</span>Delete everything on this phone</button>' + (root.OvuAuth && root.OvuAuth.isSignedIn && root.OvuAuth.isSignedIn() ? '<button type="button" class="btn ghost" id="cSignOut"><span class="ms">logout</span>Sign out of this account</button>' : '') + '</div>' +
      '<p class="c-small">If you are 18 or older, reload Rhythme and confirm it on the notice.</p>';
    var ex = scroll.querySelector('#cExport'), wipe = scroll.querySelector('#cWipe'), so = scroll.querySelector('#cSignOut');
    if (ex) ex.onclick = function () { download('rhythme-diary.json', S.exportJSON()); };
    if (so) so.onclick = function () { so.disabled = true; root.OvuAuth.signOut(false).then(function () { try { location.reload(); } catch (e) { } }, function () { try { location.reload(); } catch (e) { } }); }; /* the account is not for someone under 18: sign out; the diary on this phone stays (Codex, 21 Oct) */
    if (wipe) wipe.onclick = function () {
      if (wipe.dataset.sure !== '1') { wipe.dataset.sure = '1'; wipe.innerHTML = '<span class="ms">warning</span>Tap again to delete everything'; return; }
      try { S.clearAll(); } catch (e) { }
      ['ovumind_ai_v1', 'ovumind_desk_v1', 'ovumind_nova_words', 'ovuluna_onboarding', 'ovumind_auth_v1'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
      location.reload();
    };
  }

  /* ---------- "Your choices" in You: the same switches, the receipt, as easy to withdraw as to give ---------- */
  function choicesHTML() {
    var st = state(), u = uid(), r = receipt();
    var rows = PURPOSES.filter(function (p) { return !p.hidden; }).map(function (p) {
      var s = st[p.id], on = !!(s && s.on && (!p.account || !s.uid || s.uid === u));
      var when = s && s.at ? new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
      var line = p.required ? 'Required for the diary. To stop, delete everything on this phone below.' : (on ? ('On since ' + when + (s.method === 'jit' ? ', turned on when you first used it' : s.method === 'import' ? ', carried over from your earlier choice' : '')) : 'Off');
      if (AI_IDS[p.id] && aiPaused()) { on = false; line = PAUSED_LINE; }
      if (p.id === 'cloud_sync' && on && !u) line = 'Chosen, starts after you sign in from Your account.';
      if (p.id === 'improve_logging' && !u) line = on ? 'Saved on this phone. It is recorded on your account when you sign in.' : 'Off';
      return '<label class="perm c-choice" data-purpose="' + p.id + '"><input type="checkbox" id="y_' + p.id + '"' + (on ? ' checked' : '') + (p.required ? ' checked disabled' : '') + (AI_IDS[p.id] && aiPaused() ? ' disabled' : '') + '><span class="ms">' + p.icon + '</span><div><b>' + esc(p.title) + '</b><span>' + esc(p.body) + '</span><small class="ya-state">' + esc(line) + '</small></div></label>';
    }).join('');
    var where = !r.userId ? 'kept on this phone' : r.recorded ? 'recorded on your account' : (r.pending ? r.pending + ' change' + (r.pending === 1 ? '' : 's') + ' still to reach your account' : r.failed + ' change' + (r.failed === 1 ? '' : 's') + ' your account refused');
    var rec = '<div class="stat"><span class="ms">receipt_long</span><div><b>Your consent receipt</b><span>Notice version ' + r.noticeVersion + (r.noticeHash ? ' (' + r.noticeHash.slice(0, 8) + ')' : '') + (r.at ? ' · last change ' + new Date(r.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + ' · ' + where + ' · ' + r.events + ' choice' + (r.events === 1 ? '' : 's') + ' on record' + (r.ageAttest ? ' · 18+ confirmed ' + new Date(r.ageAttest.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '') + '</span></div></div>';
    return '<p class="help">Each choice is separate and starts off. Turning one off stops that use from now on; your diary and your backup stay as they are. The full list of choices is included in your diary export.</p>' + rows + rec;
  }
  function wireChoices(el, ui) {
    ui = ui || {};
    el.onchange = function (e) {
      var t = e.target; if (!t || !t.id || t.id.indexOf('y_') !== 0) return;
      var p = t.id.slice(2), on = !!t.checked, def = purpose(p); if (!def || def.required) return;
      if (ui.chime) ui.chime('tap');
      if (p === 'improve_logging' && root.OvuAuth && root.OvuAuth.setImprove) {
        t.disabled = true;
        root.OvuAuth.setImprove(on, 'you').then(function (r) { if (r && r.ok === false) { if (ui.toast) ui.toast('Could not save that to your account: ' + r.error, 'error'); } if (ui.rerender) ui.rerender(); });
        return;
      }
      if (p === 'cloud_sync') {
        if (on) { if (root.OvuAuth && root.OvuAuth.isSignedIn && root.OvuAuth.isSignedIn()) root.OvuAuth.promptCloud(); else { grant('cloud_sync', 'you'); if (ui.toast) ui.toast('Cloud backup is chosen. Sign in from Your account to start it.', 'cloud_sync'); } }
        else { withdraw('cloud_sync', 'you'); if (root.OvuSync && root.OvuSync.resetPosition) root.OvuSync.resetPosition(); if (ui.toast) ui.toast('Cloud backup is off. New entries stay on this phone; the copy in your account is kept until you delete it from Your account.', 'cloud_off'); }
        if (ui.rerender) ui.rerender();
        return;
      }
      if (on) grant(p, 'you'); else withdraw(p, 'you');
      if (ui.toast) ui.toast(on ? def.title + ': on.' : def.title + ': off from now on.', on ? 'check_circle' : 'block');
      if (ui.rerender) ui.rerender();
    };
  }

  /* ---------- boot: import once, keep the mirrors honest ---------- */
  try { if (S) { importLegacy(); apply(); } } catch (e) { }

  root.OvuConsent = {
    aiPaused: aiPaused, boundTo: boundTo, AI_IDS: AI_IDS, PAUSED_LINE: PAUSED_LINE,
    NOTICE_V: NOTICE_V, AGE_V: AGE_V, PURPOSES: PURPOSES, REGION_AI: REGION_AI, REGION_CLOUD: REGION_CLOUD, AI_WHERE: AI_WHERE, AI_WHERE_HTML: AI_WHERE_HTML,
    purpose: purpose, events: events, state: state, stateFromEvents: stateFromEvents, allows: allows,
    noticeText: noticeText, noticeHash: noticeHash,
    record: record, grant: grant, withdraw: withdraw, setMany: setMany, apply: apply,
    importEventsFrom: importEventsFrom, importLegacy: importLegacy,
    ageOk: ageOk, legacyMinor: legacyMinor, attestAge: attestAge, needsSheet: needsSheet,
    receipt: receipt, header: header, device: device, compact: compact,
    flush: flush, bindAccount: bindAccount, pullAccountState: pullAccountState, recordedOnAccount: recordedOnAccount,
    require: require, choicesHTML: choicesHTML, wireChoices: wireChoices
  };
})(window);
