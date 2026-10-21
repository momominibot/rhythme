/* Rhythme staff dashboard (phase 1). Everything shown here comes from audited, staff-only RPCs on the server
 * (supabase/migrations/20261019030000_team_dashboard.sql); the page holds no secret beyond the publishable key and
 * the signed-in person's own token. Staff membership is by account id, decided on the server: a person who is not
 * staff sees a plain screen and nothing else. Design: docs/design/2026-10-19-data-capture-dashboard-agents.md */
(function (root) {
  'use strict';
  var CFG = root.OVU_CONFIG || {}, A = root.OvuAuth, doc = root.document;
  var app = doc.getElementById('app');
  var plaza = null, plazaOk = 0, plazaBad = false, plazaBusy = false; /* admin_plaza: people in each group now, and the daily joins and peak (counts only) */
  var me = null, tab = 'today', ov = null, feed = [], feedTop = 0, findings = null, proposals = null, admins = null, audit = null, timers = [];
  var reports = null, reportsAll = false, reportsBad = false, reportsMissing = false; /* admin_social_reports: Plaza friends reports, cards only (no account ids, emails or groups) */
  var REASONS = { unkind: 'Unkind or upsetting', spam: 'Spam or selling', pretending: 'Pretending to be someone else', under18: 'Seems to be under 18', worried: 'Worried about her safety', other: 'Something else' };
  /* the team (Jamie, 21 Oct: "my agents in there, give them cute names to report the data and I will have one agent to
   * orchestrate"): four little clouds who each own one stream and say what they measured in their own words, and Nimbus,
   * the big cloud who gathers their reports. Names are for the page; the server knows them by their stream. */
  var AGENTS = {
    cycle: { name: 'Bloom', stream: 'Menstrual', color: 'a-cycle', tint: '#f3b9c9', face: 'flower', hello: 'I keep the period and symptom days.', owns: 'period and symptom days, recorded period starts, intervals between starts, prediction mode availability', excludes: 'spotting and flow none never start a cycle; missing logs are not missing periods; recalled and imported history stay separate' },
    sleep: { name: 'Dozy', stream: 'Sleep', color: 'a-sleep', tint: '#c4cdf2', face: 'nightcap', hello: 'I count the nights that were really recorded.', owns: 'nights with a usable record, nights with two records, typed versus imported share, duration and quality availability', excludes: 'rows are not nights; bed-to-wake is not time asleep' },
    food: { name: 'Pudding', stream: 'Food', color: 'a-food', tint: '#f8d0b4', face: 'cherry', hello: 'I keep the meal days and how well they were tagged.', owns: 'meal days, meals saved, tag completeness, source mix, HPB match and NOVA coverage', excludes: 'missing nutrients are not zero; a saved meal is not a whole day of eating' },
    mind: { name: 'Misty', stream: 'Mindfulness and stress', color: 'a-mind', tint: '#c3e6d6', face: 'leaf', hello: 'I keep the practice days and minutes.', owns: 'practice days, minutes by kind, completed share, repeat practice on another day, reflection days', excludes: 'reflection text is never read; there is no validated stress measure here' }
  };
  var NIMBUS = { name: 'Nimbus', stream: 'Orchestrator', color: 'a-orchestrator', tint: '#fbe7c3', face: 'star', hello: 'I gather every report and rank what the team proposes.' };
  var TABS = [['today', 'Today', 'home'], ['feed', 'Feed', 'dynamic_feed'], ['agents', 'Agents', 'groups'], ['queue', 'Queue', 'task_alt'], ['staff', 'Staff', 'admin_panel_settings']]; /* Material Symbols, as the room's bar */

  var LUNA = '<img class="luna" src="assets/onboarding/luna.png" alt="">';
  function greeting() { var h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })); return h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 18 ? 'Good afternoon' : 'Good evening'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(iso) { if (!iso) return ''; var ms = Date.now() - Date.parse(iso); if (!isFinite(ms)) return ''; var m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 36) return h + ' h ago'; return Math.round(h / 24) + ' days ago'; }
  function when(iso) { try { var d = new Date(iso); return d.toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso || ''; } }
  function num(v) { return v == null ? '–' : (Math.round(Number(v) * 10) / 10).toLocaleString('en-SG'); }

  /* ---------- server ---------- */
  function rpc(name, args) {
    return Promise.resolve(A.token()).then(function (t) {
      if (!t) throw new Error('signed out');
      return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(args || {}) })
        .then(function (r) { return r.text().then(function (txt) { var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { } if (!r.ok) throw new Error((j && (j.message || j.hint || j.error)) || ('request failed (' + r.status + ')')); return j; }); });
    });
  }
  function denied(j) { return j && j.denied; }

  /* ---------- views ---------- */
  function gate(msg, bad) {
    app.innerHTML = '<div class="gate">' + LUNA + '<div class="card"><h2>Rhythme staff</h2><p class="note">This page is for Rhythme staff. Sign in with the email that was invited; a code is sent to it.</p>' +
      '<div class="field"><label for="gEmail">Email</label><input type="email" id="gEmail" autocomplete="email" inputmode="email" placeholder="you@example.com"></div>' +
      '<div class="field hidden" id="gCodeWrap"><label for="gCode">Code from the email</label><input type="text" id="gCode" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></div>' +
      '<div class="row"><button class="btn primary" id="gSend">Send code</button><button class="btn ghost hidden" id="gVerify">Sign in</button></div><p class="msg' + (bad ? ' bad' : '') + '" id="gMsg">' + esc(msg || '') + '</p></div></div>';
    var email = doc.getElementById('gEmail'), code = doc.getElementById('gCode'), m = doc.getElementById('gMsg');
    doc.getElementById('gSend').addEventListener('click', function () {
      var e = email.value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { m.textContent = 'That is not an email address.'; m.className = 'msg bad'; return; }
      this.disabled = true; m.className = 'msg'; m.textContent = 'Sending…';
      A.sendCode(e).then(function () { m.textContent = 'Code sent. Check the email and type it in.'; doc.getElementById('gCodeWrap').classList.remove('hidden'); doc.getElementById('gVerify').classList.remove('hidden'); code.focus(); }, function (err) { var se = A.sendError ? A.sendError(err) : { text: 'Could not send: ' + err.message }; m.textContent = se.text; m.className = 'msg bad'; if (se.limited) { doc.getElementById('gCodeWrap').classList.remove('hidden'); doc.getElementById('gVerify').classList.remove('hidden'); code.focus(); } /* a code already in the inbox still works */ }).then(function () { doc.getElementById('gSend').disabled = false; });
    });
    doc.getElementById('gVerify').addEventListener('click', function () {
      var btn = this; btn.disabled = true; m.className = 'msg'; m.textContent = 'Checking…';
      A.verifyCode(email.value.trim(), code.value.trim()).then(function () {
        var sheet = doc.getElementById('ovuCloudSheet'); if (sheet) sheet.remove(); /* the app's backup prompt has no place on the staff page */
        return boot();
      }, function (err) { m.textContent = 'Sign-in failed: ' + err.message; m.className = 'msg bad'; btn.disabled = false; });
    });
  }
  function staffOnly() {
    app.innerHTML = '<div class="gate">' + LUNA + '<div class="card"><h2>Rhythme staff</h2><p class="note">This page is for Rhythme staff. The account <b>' + esc(A.email() || '') + '</b> is signed in but is not on the staff list, so nothing here is shown to it. Your own diary is untouched.</p><div class="row"><button class="btn" id="soOut">Sign out</button><a class="btn ghost" href="room.html">Back to the room</a></div></div></div>';
    doc.getElementById('soOut').addEventListener('click', function () { A.signOut().then(boot, boot); });
  }
  function shell() {
    app.innerHTML = '<header class="top"><div><a class="brand" href="room.html"><img class="rh-logo" src="assets/brand/logo-mark.webp" alt="" width="22" height="22">RHYTHME<em>STAFF</em></a><h1>' + esc(greeting()) + '<small>' + esc(A.email() || '') + ' · ' + esc(me.role) + '</small></h1></div><span class="pill" id="livePill"><span class="dot"></span><span id="liveTxt">checking</span></span></header>' +
      '<div class="hero"><img src="assets/room/dream/room-v3-sm.webp" alt=""><p>Here is Rhythme today<small>Counts and the team\u2019s reports only. No diary is shown here.</small></p></div>' +
      '<section id="panel"></section>' +
      '<nav class="tabs" aria-label="Sections">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '><span class="ms" aria-hidden="true">' + t[2] + '</span>' + t[1] + '</button>'; }).join('') + '</nav>';
    app.dataset.tab = tab;
    app.querySelector('nav.tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (!b) return; tab = b.dataset.tab; app.querySelectorAll('nav.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); if (x === b) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); app.dataset.tab = tab; render(); });
  }
  function pill(state, txt) { var p = doc.getElementById('livePill'); if (!p) return; p.className = 'pill ' + state; doc.getElementById('liveTxt').textContent = txt; }
  function panel(html) { var p = doc.getElementById('panel'); if (p) p.innerHTML = html; }

  /* ---------- Today ---------- */
  function renderToday() {
    if (!ov) return panel('<div class="card"><p class="empty">Loading…</p></div>');
    var c = ov.counts || {}, runs = ov.runs || [], last = runs[0], blocked = ov.blocked || [];
    var ent = (ov.latest && ov.latest.cycle) || [];
    var elig = (ent.filter(function (f) { return f.metric === 'eligible_people'; })[0] || {});
    var alive = last ? (last.status === 'ok' ? 'ok' : (last.status === 'running' ? 'running' : 'failed')) : 'never';
    var team = Object.keys(AGENTS), reps = team.map(report), withResults = reps.filter(function (r) { return r.results > 0; }).length, eligible = reps.filter(function (r) { return r.state === 'measured'; }).length;
    var nim = !hasFindings() ? 'No finished run yet. Press Run now and I will gather the team.' : (alive === 'failed' ? 'The last run failed, so the reports below are from the last finished run. ' : '') + (ov.open_proposals ? ov.open_proposals + ' proposal' + (ov.open_proposals > 1 ? 's are' : ' is') + ' waiting for an owner. ' : 'Nothing is waiting for you. ') + (withResults ? withResults + ' of the four have results from the last finished run.' : eligible ? 'The four met the floor at the last finished run but every result was held back.' : 'None of the four could report a result at the last finished run, so today is counts only: accounts, cloud copies, the plazas and the relay.');
    var html = '<div class="card nimbus"><div class="nimrow">' + cloudSVG(NIMBUS, true) + bubble('Nimbus, the orchestrator', nim, last ? 'Last run ' + ago(last.started_at) + ', ' + last.kind : 'Runs are deterministic: no model is called and nothing is applied on its own.') + '</div>' +
      '<div class="team">' + team.map(function (k, i) { var a = AGENTS[k], r = reps[i]; return '<button type="button" class="mate" data-mate="' + k + '" title="' + esc(a.name) + '">' + cloudSVG(a) + '<b>' + esc(a.name) + '</b><small>' + esc(a.stream) + '</small><i class="st ' + esc(r.state) + '"></i></button>'; }).join('') + '</div></div>';
    html += '<div class="card"><h2>Status<span>' + (last ? 'last run ' + ago(last.started_at) : 'no run yet') + '</span></h2><div class="tiles">' +
      tile('Pipeline', alive === 'ok' ? 'Alive' : alive === 'running' ? 'Running' : alive === 'failed' ? 'Failed' : 'Not run', last ? (last.kind + ', ' + (last.finished_at ? 'finished ' + ago(last.finished_at) : 'in progress')) : 'Press Run now below') +
      tile('Needs you', String(ov.open_proposals || 0), (ov.open_proposals ? 'proposals waiting' : 'nothing waiting')) +
      (ov.held_runs != null ? tile('Results', ov.held_runs ? 'Held' : (ov.latest_run ? 'Published' : 'None'), ov.held_runs ? 'recompute due: a withdrawal or deletion since the last run' : ov.latest_run ? 'from the last finished run' : 'no finished run yet') + tile('Daily run', ov.scheduled ? 'Scheduled' : 'Not scheduled', ov.scheduled ? 'one attempt a day, never retried' : 'runs only when staff press Run now') : '') +
      tile('Accounts', String(c.accounts == null ? '–' : c.accounts), (c.accounts_with_cloud_copy || 0) + ' with a cloud copy') +
      tile('Improvement opt-in', String(c.consent_active == null ? '–' : c.consent_active), eligText(c.consent_eligible, ov.floor)) +
      '</div>' + (blocked.length ? '<div class="note"><b>Model runs are blocked.</b> ' + esc(blocked[0].error) + ' An owner clears it on the Queue tab; nothing retries by itself.</div>' : '') + '</div>';
    html += plazaCard();
    html += '<div class="card"><h2>Diary streams<span>floor ' + esc(ov.floor) + ' people</span></h2>';
    if (!elig.state && !hasFindings()) html += '<div class="note"><b>No finished run yet.</b> ' + (Number(c.consent_active) > 0 ? esc(c.consent_active) + ' account' + (c.consent_active > 1 ? 's have' : ' has') + ' the separate “help improve logging” choice on; a run decides who is eligible.' : 'No account has the separate “help improve logging” choice on yet.') + ' Local-only diaries are never visible here.</div>';
    else if (!elig.state || elig.state === 'not_enabled') html += '<div class="note"><b>Not enabled.</b> At the last finished run no eligible adult had the separate “help improve logging” choice on, so the agents read no diary rows. Local-only diaries are never visible here. What exists: ' + esc(c.accounts_with_cloud_copy || 0) + ' account' + ((c.accounts_with_cloud_copy || 0) === 1 ? '' : 's') + ' with a cloud copy, kept private to their owners.</div>';
    else if (elig.state === 'insufficient') html += '<div class="note"><b>Insufficient contributors.</b> Fewer than ' + esc(ov.floor) + ' eligible adults have opted in; values stay held back until the floor is reached.</div>';
    else html += '<div class="note"><b>Measured.</b> ' + esc(elig.value) + ' eligible opted-in adults at the last finished run; each number carries its own people count.</div>';
    html += '</div>';
    html += '<div class="card"><h2>Runs</h2>' + (runs.length ? '<table class="tbl"><tr><th>When</th><th>Kind</th><th>Status</th><th>Summary</th></tr>' + runs.map(function (r) { return '<tr><td>' + esc(when(r.started_at)) + '</td><td>' + esc(r.kind) + '</td><td><span class="chip ' + (r.status === 'ok' ? 'ok' : r.status === 'running' ? '' : 'high') + '">' + esc(r.status) + '</span></td><td>' + esc(r.error || (r.summary && r.summary.measured === false ? 'no eligible adults yet' : (r.summary && r.summary.measured ? (r.summary.under_floor || r.summary.eligible == null ? 'under the floor, ' : r.summary.eligible + ' eligible, ') + r.summary.window : ''))) + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">No run yet.</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn primary" id="runNow">Run now</button><span class="msg" id="runMsg"></span></div><p class="srv">A run is deterministic: the four agents measure what the consent rules allow and the orchestrator records what it would do. No model is called and nothing is applied on its own in this phase.</p></div>';
    html += '<div class="card"><h2>Service<span>no diary content</span></h2><div class="tiles">' + tile('Relay counter increments today', String(c.relay_increments_today == null ? '–' : c.relay_increments_today), 'a relay call bumps an IP bucket and a global bucket') + tile('Withdrawn opt-ins', String(c.consent_withdrawn == null ? '–' : c.consent_withdrawn), 'kept on record, excluded from reads') + '</div></div>';
    panel(html);
    var b = doc.getElementById('runNow'); if (b) b.addEventListener('click', runNow);
    app.querySelectorAll('[data-mate]').forEach(function (m) { m.addEventListener('click', function () {
      var btn = app.querySelector('nav.tabs button[data-tab=agents]'); if (btn) btn.click(); /* the one tab change, so aria-current follows */
      var el = doc.getElementById('mate-' + m.dataset.mate), h = el && el.querySelector('h3'); if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { } }
    }); });
  }
  /* ---------- Plazas: who is online where, by count; no names, no account ids ---------- */
  function sgDay(d) { try { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function plazaCard() {
    if (!plaza) return '<div class="card" id="plazaCard"><h2>Plaza groups<span>people online now</span></h2><p class="empty">' + (plazaBad ? 'Could not load the groups; trying again every 20 seconds.' : 'Loading…') + '</p></div>';
    var now = plaza.now || [], days = plaza.days || [], today = plaza.today || sgDay(); /* the database's own Singapore date */
    var total = now.reduce(function (a, s) { return a + (Number(s.people) || 0); }, 0);
    var tiles = now.map(function (s) {
      var d = days.filter(function (x) { return x.day === today && x.server === s.id; })[0] || {};
      return tile(s.name, (s.open === false ? 'Closed' : s.people + ' of ' + s.capacity), 'peak ' + (d.peak || 0) + ' today · ' + (d.joins || 0) + ' ' + ((d.joins || 0) === 1 ? 'join' : 'joins'));
    }).join('');
    var byDay = {}; days.forEach(function (x) { var b = byDay[x.day] || (byDay[x.day] = { joins: 0, peak: 0, top: '' }); b.joins += Number(x.joins) || 0; if ((Number(x.peak) || 0) > b.peak) { b.peak = Number(x.peak) || 0; b.top = x.server; } });
    var names = {}; now.forEach(function (s) { names[s.id] = s.name; });
    var rows = Object.keys(byDay).sort().reverse().slice(0, 14);
    var dayKeys = Object.keys(byDay).sort().slice(-14), joinsBy = {}, peakBy = {}; dayKeys.forEach(function (k) { joinsBy[k] = byDay[k].joins; peakBy[k] = byDay[k].peak; });
    var chart = chartLine([{ name: 'joins, all groups', color: '#e58fa8', byDay: joinsBy }, { name: 'busiest group peak', color: '#9db8e6', byDay: peakBy }], dayKeys, { label: 'Plaza joins across all groups and the busiest single group\u2019s peak, by day', empty: 'No plaza days yet.' });
    var table = rows.length ? '<table class="tbl" id="plazaDays"><tr><th>Day</th><th>Joins</th><th>Busiest</th></tr>' + rows.map(function (k) { var b = byDay[k]; return '<tr><td>' + esc(k) + '</td><td>' + esc(b.joins) + '</td><td>' + esc((names[b.top] || b.top) + ' · ' + b.peak) + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">Nobody has joined a group yet.</p>';
    var at = plaza.at ? new Date(plaza.at) : null, hm = at ? at.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' }) : '';
    var stale = plazaBad || (plazaOk && Date.now() - plazaOk > 60000);
    var head = stale ? '<span class="stale">not updated since ' + esc(hm) + '</span>' : '<span>' + esc(total) + ' online · ' + esc(hm) + '</span>';
    return '<div class="card" id="plazaCard"><h2>Plaza groups' + head + '</h2>' + (stale ? '<div class="note"><b>Not current.</b> The last refresh did not come back; the numbers below are from ' + esc(hm) + '. It tries again every 20 seconds.</div>' : '') + '<div class="tiles">' + tiles + '</div>' + chart + table +
      '<p class="srv">Counts only. A person is counted while her phone checks in (every 25 s). Leaving, closing the app, sleeping or signing out normally takes her out at once; if that message is lost she stops being counted after 75 s. Joins count arrivals, so someone who leaves and comes back counts twice. Daily counts are kept for a year. No names or account ids reach this page.</p></div>';
  }
  function redrawPlaza() { if (tab === 'today' && doc.getElementById('plazaCard')) doc.getElementById('plazaCard').outerHTML = plazaCard(); }
  /* one refresh at a time, with a deadline, on its own timer; a reply older than what is shown is ignored */
  function deadline(p, ms) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error('timeout')); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); }); }
  function loadPlaza() {
    if (plazaBusy) return Promise.resolve();
    plazaBusy = true;
    return deadline(rpc('admin_plaza', { p_days: 14 }), 10000).then(function (j) {
      if (denied(j) || !j || !j.now) { plazaBad = true; return; }
      if (plaza && plaza.at && j.at && Date.parse(j.at) < Date.parse(plaza.at)) return;
      plaza = j; plazaOk = Date.now(); plazaBad = false;
    }).catch(function () { plazaBad = true; }).then(function () { plazaBusy = false; redrawPlaza(); });
  }
  function eligText(n, floor) { n = Number(n || 0); floor = Number(floor || 20); return (n === 0 ? '0' : n < floor ? 'fewer than ' + floor : String(n)) + ' eligible adults'; }
  /* ---------- the little clouds: one inline drawing each, so no image is needed ---------- */
  function cloudSVG(a, big) {
    var w = big ? 128 : 84, t = a.tint, eyes = a.face === 'nightcap' ? '<path d="M38 50 q5 4 10 0 M66 50 q5 4 10 0" stroke="#5a4274" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : '<circle cx="43" cy="49" r="3.2" fill="#5a4274"/><circle cx="71" cy="49" r="3.2" fill="#5a4274"/><circle cx="44.2" cy="47.8" r="1" fill="#fff"/><circle cx="72.2" cy="47.8" r="1" fill="#fff"/>';
    var extra = a.face === 'flower' ? '<circle cx="84" cy="30" r="3.2" fill="#f6c9d6"/><circle cx="90" cy="26" r="3.2" fill="#f6c9d6"/><circle cx="90" cy="34" r="3.2" fill="#f6c9d6"/><circle cx="96" cy="30" r="3.2" fill="#f6c9d6"/><circle cx="90" cy="30" r="2.4" fill="#f3d49b"/>'
      : a.face === 'nightcap' ? '<path d="M44 30 q14 -24 40 -8 l-6 8 q-16 -8 -30 4 z" fill="#a08ad6"/><circle cx="84" cy="22" r="4" fill="#fff6ec"/><path d="M42 31 q18 -6 36 -1" stroke="#fff6ec" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : a.face === 'cherry' ? '<path d="M80 22 q4 -10 12 -12" stroke="#6ba88a" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="80" cy="26" r="4.5" fill="#e35d7a"/><circle cx="90" cy="24" r="4.5" fill="#e35d7a"/>'
      : a.face === 'leaf' ? '<path d="M78 28 c10 -16 26 -12 26 -12 c0 0 -2 18 -18 20 c-6 1 -8 -4 -8 -8 z" fill="#8fcf86"/><path d="M80 32 q12 -8 22 -14" stroke="#4f9a62" stroke-width="1.6" fill="none"/>'
      : '<path d="M86 14 l3.5 7 7.5 1 -5.5 5.3 1.3 7.7 -6.8 -3.6 -6.8 3.6 1.3 -7.7 -5.5 -5.3 7.5 -1 z" fill="#f3d49b"/>';
    return '<svg class="cloudy" viewBox="0 0 116 84" width="' + w + '" height="' + Math.round(w * 84 / 116) + '" aria-hidden="true">' +
      '<ellipse cx="58" cy="76" rx="34" ry="5" fill="rgba(90,66,116,.10)"/>' +
      '<g class="body"><circle cx="34" cy="52" r="20" fill="' + t + '"/><circle cx="58" cy="42" r="26" fill="' + t + '"/><circle cx="84" cy="52" r="19" fill="' + t + '"/><rect x="24" y="52" width="70" height="18" rx="9" fill="' + t + '"/>' +
      '<circle cx="50" cy="36" r="9" fill="rgba(255,255,255,.45)"/>' + extra + eyes +
      '<path d="M52 59 q5 5 10 0" stroke="#5a4274" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="36" cy="57" rx="4.5" ry="2.6" fill="rgba(240,120,150,.35)"/><ellipse cx="78" cy="57" rx="4.5" ry="2.6" fill="rgba(240,120,150,.35)"/></g></svg>';
  }
  function bubble(who, text, sub) { return '<div class="say"><div class="who">' + esc(who) + '</div><p>' + esc(text) + '</p>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }
  /* what each cloud says about its stream, in its own words, from the latest findings; never a guess */
  /* the last finished run is the one whose findings the server kept (latest), not the recent-run list, which can be all failures */
  function hasFindings() { var l = (ov && ov.latest) || {}; return Object.keys(l).some(function (k) { return (l[k] || []).length > 0; }); }
  function report(k) {
    var rows = ((ov && ov.latest) || {})[k] || [], ready = rows.filter(function (f) { return f.metric === 'eligible_people'; })[0], floor = (ov && ov.floor) || 20, c = (ov && ov.counts) || {};
    var results = rows.filter(function (f) { return f.metric !== 'eligible_people' && !f.suppressed && f.value != null; });
    if (!ov) return { state: 'loading', results: 0, text: 'Still getting my notes together.' };
    if (!ready) return { state: 'norun', results: 0, text: 'No finished run has a report from me yet. ' + (Number(c.consent_active) > 0 ? c.consent_active + ' account' + (c.consent_active > 1 ? 's have' : ' has') + ' the separate "help improve logging" choice on; a run decides who is eligible.' : 'No account has the separate "help improve logging" choice on yet.') };
    if (ready.state === 'not_enabled') return { state: 'not_enabled', results: 0, text: 'At the last finished run no eligible adult had the separate "help improve logging" choice on, so I read no diary rows. I am ready when they do.' };
    if (ready.state === 'insufficient') return { state: 'insufficient', results: 0, text: 'Fewer than ' + floor + ' eligible opted-in adults at the last finished run, so my results are held back under the floor.' };
    var m = results.slice(0, 3).map(function (f) { return f.metric.replace(/_/g, ' ') + ' ' + num(f.value) + ' over ' + f.window + (f.people ? ' from ' + f.people + ' people' : ''); });
    return { state: 'measured', results: results.length, text: String(ready.value) + ' eligible opted-in adults at the last finished run. ' + (m.length ? 'I measured ' + m.join('; ') + '.' : 'Every result was held back under the floor.') };
  }
  /* ---------- charts: small inline SVGs, no library; every chart says what it counts ---------- */
  function dayNum(k) { return Math.round(Date.parse(k + 'T00:00:00Z') / 86400000); }
  function niceTop(max) { var p = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)), f = max / p; var t = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; return t * p; }
  /* series: { name, color, byDay: { 'YYYY-MM-DD': value } }; days without a value break the line, every day takes its own space */
  function chartLine(series, days, opt) {
    opt = opt || {}; var W = 320, H = 120, padL = 26, padR = 10, padT = 10, padB = 22;
    days = days.slice().sort(); var n = days.length;
    var all = [].concat.apply([], series.map(function (s) { return days.map(function (d) { return s.byDay[d]; }); })).filter(function (v) { return v != null && isFinite(v); });
    if (!n || !all.length) return '<div class="chart empty">' + esc(opt.empty || 'No days to draw yet.') + '</div>';
    var d0 = dayNum(days[0]), d1 = dayNum(days[n - 1]), span = Math.max(1, d1 - d0), top = niceTop(Math.max(1, Math.max.apply(null, all)));
    var x = function (k) { return padL + (dayNum(k) - d0) * (W - padL - padR) / span; }, y = function (v) { return padT + (H - padT - padB) * (1 - v / top); };
    var ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];
    var grid = ticks.map(function (t) { var yy = y(t); return '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" class="g"/><text x="' + (padL - 5) + '" y="' + (yy + 3.5) + '" class="ax" text-anchor="end">' + t + '</text>'; }).join('');
    var LW = 34, lastX = x(days[n - 1]), placed = -1e9, xl = days.map(function (k, i) { /* labels by their real positions: the last one always, the rest only with room */
      var last = i === n - 1, xx = x(k); if (!last && (xx - placed < LW || lastX - xx < LW)) return ''; placed = xx;
      return '<text x="' + xx + '" y="' + (H - 6) + '" class="ax" text-anchor="' + (last ? 'end' : i === 0 ? 'start' : 'middle') + '">' + esc(k.slice(5).replace('-', '/')) + '</text>';
    }).join('');
    var paths = series.map(function (s, si) {
      var runs = [], cur = [], prev = null; days.forEach(function (k) { var v = s.byDay[k], dn = dayNum(k); if (prev !== null && dn - prev > 1 && cur.length) { runs.push(cur); cur = []; } /* a day with no record breaks the line */ prev = dn; if (v == null || !isFinite(v)) { if (cur.length) runs.push(cur); cur = []; } else cur.push([x(k), y(v)]); }); if (cur.length) runs.push(cur);
      var out = '<defs><linearGradient id="cg' + si + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient></defs>';
      runs.forEach(function (pts) {
        var d = pts.map(function (p, i) { if (!i) return 'M' + p[0] + ' ' + p[1]; var q = pts[i - 1], cx = (q[0] + p[0]) / 2; return 'C' + cx + ' ' + q[1] + ' ' + cx + ' ' + p[1] + ' ' + p[0] + ' ' + p[1]; }).join(' ');
        if (si === 0 && pts.length > 1) out += '<path d="' + d + ' L' + pts[pts.length - 1][0] + ' ' + (H - padB) + ' L' + pts[0][0] + ' ' + (H - padB) + ' Z" fill="url(#cg0)"/>';
        out += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.4" stroke-linecap="round"/>' + pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#fff" stroke="' + s.color + '" stroke-width="2"/>'; }).join('');
      });
      return out;
    }).join('');
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.label || '') + '">' + grid + paths + xl + '</svg><div class="legend">' + series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div></div>';
  }
  function tile(l, v, s) { return '<div class="tile"><div class="l">' + esc(l) + '</div><div class="v' + (String(v).length > 9 ? ' small' : '') + '">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>'; }
  function runNow() {
    var b = doc.getElementById('runNow'), m = doc.getElementById('runMsg'); if (b) b.disabled = true; if (m) m.textContent = 'Running…';
    rpc('admin_run', { p_days: 28 }).then(function (j) {
      if (m) m.textContent = j && j.error ? j.error : 'Done.';
      return Promise.all([loadOverview(), loadFeed(true)]);
    }).catch(function (e) { if (m) m.textContent = e.message; }).then(function () { if (b) b.disabled = false; });
  }

  /* ---------- Feed ---------- */
  function feedItem(e, fresh) {
    var a = AGENTS[e.agent], col = a ? a.color : (e.agent === 'orchestrator' ? 'a-orchestrator' : 'a-staff');
    return '<li' + (fresh ? ' class="new"' : '') + ' data-id="' + esc(e.id) + '"><span class="bar ' + col + '"></span><div><div class="t">' + esc(e.title) + '</div><div class="m"><b>' + esc(a ? a.name : (e.agent === 'orchestrator' ? NIMBUS.name : e.agent)) + '</b> · ' + esc(e.kind) + ' · ' + esc(ago(e.at)) + '</div>' + (e.detail && Object.keys(e.detail).length ? '<details><summary>detail</summary><pre>' + esc(JSON.stringify(e.detail, null, 1)) + '</pre></details>' : '') + '</div></li>';
  }
  function renderFeed() {
    panel('<div class="card"><h2>Live feed<span id="feedSub">' + (feed.length ? feed.length + ' events' : '') + '</span></h2>' + (feed.length ? '<ul class="feed" id="feedList">' + feed.map(function (e) { return feedItem(e, false); }).join('') + '</ul>' : '<p class="empty">Nothing has happened yet. Press Run now on Today.</p>') + '<p class="srv">New events arrive every 10 seconds while this page is open; each line is written by the agent or the orchestrator as it works.</p></div>');
  }

  /* ---------- Agents ---------- */
  function renderAgents() {
    var latest = (ov && ov.latest) || {};
    panel('<div class="agents">' + Object.keys(AGENTS).map(function (k) {
      var a = AGENTS[k], rows = latest[k] || [], ready = rows.filter(function (f) { return f.metric === 'eligible_people'; })[0], r = report(k);
      var state = ready ? ready.state : 'norun';
      var chip = state === 'measured' ? '<span class="chip ok">measuring</span>' : state === 'insufficient' ? '<span class="chip watch">under the floor</span>' : state === 'norun' ? '<span class="chip">no report yet</span>' : '<span class="chip">not enabled</span>';
      var metrics = rows.filter(function (f) { return f.metric !== 'eligible_people'; });
      var bars = metrics.length ? '<div class="mrows">' + metrics.map(function (f) { return '<div class="metric"><span class="k">' + esc(f.metric.replace(/_/g, ' ')) + '<br><small>' + esc(f.window) + '</small></span><span class="v">' + (f.state === 'no_data' ? 'no data' : f.suppressed ? 'held back' : num(f.value) + (f.unit ? ' <small>' + esc(f.unit) + '</small>' : '')) + '<small>' + (f.state === 'no_data' ? 'nobody yet' : f.suppressed ? 'under ' + esc(ov.floor) + ' people' : esc(f.people) + ' people') + '</small></span></div>'; }).join('') + '</div>' : '';
      return '<div class="agent" id="mate-' + k + '"><div class="mhead">' + cloudSVG(a) + '<div><h3><i class="' + a.color + '"></i>' + esc(a.name) + ' ' + chip + '</h3><div class="sub">' + esc(a.stream) + '. ' + esc(a.hello) + '</div></div></div>' +
        bubble(a.name + ' says', r.text) +
        (ready && ready.prerequisite && !/nobody|no one|no-one/i.test(ready.prerequisite) ? '<div class="note">' + esc(ready.prerequisite) + '</div>' : '') + bars + /* the bubble already says who had the choice on; a server line that says nobody is left out */
        '<details class="owns"><summary>What ' + esc(a.name) + ' measures, and never</summary><div class="sub">Measures: ' + esc(a.owns) + '.<br>Never: ' + esc(a.excludes) + '.</div></details></div>';
    }).join('') + '</div><div class="card nimbus"><div class="nimrow">' + cloudSVG(NIMBUS, true) + bubble('Nimbus, the orchestrator', NIMBUS.hello + ' I read every report after a run, rank proposals by a fixed priority, and may only ever pick an approved content id for a non-clinical surface, and only once an owner turns autonomy on.', 'I cannot change care guidance, prediction rules, reminders or anything clinical.') + '</div></div>');
  }

  /* ---------- Queue (proposals, policy) ---------- */
  function reportsCard(owner) {
    var list = reports || [], open = list.filter(function (r) { return r.status === 'open'; }).length;
    var html = '<div class="card" id="reportsCard"><h2>Plaza reports<span>' + (reports ? open + ' open' : '') + '</span></h2>';
    if (reportsMissing) html += '<p class="empty">Plaza friends is not switched on yet, so there are no reports to show.</p>';
    else if (!reports) html += '<p class="empty">' + (reportsBad ? 'Could not load the reports. Open this tab again to retry.' : 'Loading…') + '</p>';
    else if (!list.length) html += '<p class="empty">' + (reportsAll ? 'No reports yet.' : 'No open reports.') + '</p>';
    else html += list.map(function (r) {
      return '<div class="prop" data-report="' + r.id + '"><div class="h"><b>' + esc(r.name) + ' · card ' + esc(r.card) + '</b><span class="chip ' + (r.status === 'open' ? 'watch' : r.status === 'dismissed' ? '' : 'high') + '">' + esc(r.status) + '</span></div>' +
        '<div class="why">' + esc(REASONS[r.reason] || r.reason) + (r.about_note ? ' · about the note “' + esc(r.phrase || '') + '”' : ' · about the card') + '</div>' +
        '<div class="meta">Reported by ' + esc(r.from_name || 'an account since deleted') + (r.from_card ? ' (card ' + esc(r.from_card) + ')' : '') + ' · ' + esc(ago(r.at)) + ' · ' + esc(r.open_on_card) + ' open on this card · card now ' + esc(r.card_now) + (r.days ? ' · paused ' + esc(r.days) + ' days' : '') + '</div>' +
        (owner && r.status === 'open' ? '<div class="row acts"><button class="btn sm" data-sdecide="dismiss" data-id="' + r.id + '">Dismiss</button><button class="btn sm primary" data-sdecide="pause" data-id="' + r.id + '">Pause 7 days</button><button class="btn sm danger" data-sdecide="remove" data-id="' + r.id + '">Remove the card</button></div>' : '') + '</div>';
    }).join('');
    html += '<div class="row"><button class="btn sm" id="reportsAll">' + (reportsAll ? 'Show open only' : 'Show decided too') + '</button></div><p class="msg" id="reportsMsg"></p>' +
      '<p class="srv">A report carries the two plaza cards (a name each person chose and a short card number) and, for a note, the phrase. Staff never see accounts, emails, groups or diaries. ' + (owner ? 'A pause stops every Plaza friends call for that account; removing the card makes her choose a new one. Each decision closes every open report on that card.' : 'An owner decides.') + '</p></div>';
    return html;
  }
  /* the reports function arrives with the Plaza friends migration; until then the card says so and nothing is retried
     (Codex pre-merge review, 20 Oct, item 4) */
  function loadReports() {
    if (reportsMissing) return Promise.resolve();
    return deadline(rpc('admin_social_reports', { p_status: reportsAll ? null : 'open' }), 10000).then(function (j) {
      if (denied(j) || !j || !Array.isArray(j.reports)) { reportsBad = true; reports = null; return; }
      reports = j.reports; reportsBad = false;
    }).catch(function (e) {
      if (/PGRST202|Could not find the function|\b404\b/i.test(String((e && e.message) || ''))) { reportsMissing = true; reportsBad = false; reports = null; return; }
      reportsBad = true; reports = null;
    });
  }
  function renderQueue() {
    var owner = me.role === 'owner', pol = (ov && ov.policy) || {}, blocked = (ov && ov.blocked) || [];
    var html = reportsCard(owner) + '<div class="card"><h2>Proposals<span>' + ((proposals || []).length) + '</span></h2>';
    if (!proposals) html += '<p class="empty">Loading…</p>';
    else if (!proposals.length) html += '<p class="empty">No proposals. The agents raise one only when a measured finding suggests a lever, and this phase has nothing it may measure yet.</p>';
    else html += proposals.map(function (p) {
      return '<div class="prop"><div class="h"><b>' + esc(p.kind) + ' on ' + esc(p.target) + '</b><span class="chip ' + (p.status === 'open' ? 'watch' : p.status === 'applied' || p.status === 'approved' ? 'ok' : '') + '">' + esc(p.status) + '</span></div><div class="why">' + esc(p.rationale) + '</div><div class="meta">' + esc(AGENTS[p.agent] ? AGENTS[p.agent].name : p.agent) + ' · priority ' + esc(p.priority) + ' · ' + (p.requires_human ? 'needs a person' : 'within policy') + ' · ' + esc(ago(p.at)) + '</div>' +
        (owner && (p.status === 'open' || p.status === 'held') ? '<div class="row acts"><button class="btn sm primary" data-decide="approve" data-id="' + p.id + '">Approve</button><button class="btn sm" data-decide="hold" data-id="' + p.id + '">Hold</button><button class="btn sm danger" data-decide="reject" data-id="' + p.id + '">Reject</button></div>' : '') + '</div>';
    }).join('');
    html += '</div>';
    html += '<div class="card"><h2>Policy<span>' + (owner ? 'owner' : 'read only') + '</span></h2><div class="policy">' +
      polRow('k_floor', 'People floor', 'Buckets under this many people are held back everywhere. It cannot go below 20.', pol.k_floor, 'number', owner) +
      polRow('autonomy_on', 'Autonomy', 'Lets the orchestrator apply approved content ids on its own. Off in this phase; there is nothing approved to apply.', pol.autonomy_on, 'bool', owner) +
      polRow('model_on', 'Model step', 'The daily review may ask the model to draft proposals from released aggregates. Off in this phase.', pol.model_on, 'bool', owner) +
      polRow('lever_days', 'Lever days', 'How long an applied lever lives before it expires on its own.', pol.lever_days, 'number', owner) +
      '</div><p class="msg" id="polMsg"></p></div>';
    html += '<div class="card"><h2>Provider blocks</h2>' + (blocked.length ? blocked.map(function (b) { return '<div class="prop"><div class="h"><b>' + esc(b.source) + '</b><span class="chip high">blocked</span></div><div class="why">' + esc(b.error) + '</div><div class="meta">' + esc(when(b.at)) + '</div>' + (owner ? '<div class="row acts"><button class="btn sm" data-clear="' + b.id + '">Clear, allow one try</button></div>' : '') + '</div>'; }).join('') : '<p class="empty">None. A first provider failure stops a run and blocks model runs until an owner clears it here; nothing retries by itself.</p>') + '</div>';
    panel(html);
    app.querySelectorAll('[data-decide]').forEach(function (b) { b.addEventListener('click', function () { var id = Number(b.dataset.id), d = b.dataset.decide; b.disabled = true; rpc('admin_decide', { p_id: id, p_decision: d }).then(function () { return Promise.all([loadProposals(), loadOverview()]); }).then(render); }); });
    app.querySelectorAll('[data-sdecide]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = doc.getElementById('reportsMsg'); app.querySelectorAll('[data-sdecide]').forEach(function (x) { x.disabled = true; });
        rpc('admin_social_decide', { p_id: Number(b.dataset.id), p_decision: b.dataset.sdecide, p_days: b.dataset.sdecide === 'pause' ? 7 : null }).then(function (j) {
          if (j && (j.error || j.ok === false)) { m.textContent = j.error || 'Not done.'; m.className = 'msg bad'; }
          return loadReports();
        }).catch(function (e) { m.textContent = e.message; m.className = 'msg bad'; }).then(function () { if (tab === 'queue') renderQueue(); });
      });
    });
    var ra = doc.getElementById('reportsAll'); if (ra) ra.addEventListener('click', function () { reportsAll = !reportsAll; reports = null; renderQueue(); loadReports().then(function () { if (tab === 'queue') renderQueue(); }); });
    app.querySelectorAll('[data-clear]').forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; rpc('admin_block_clear', { p_id: Number(b.dataset.clear) }).then(loadOverview).then(render); }); });
    app.querySelectorAll('[data-pol]').forEach(function (el) {
      el.addEventListener('change', function () {
        var key = el.dataset.pol, v = el.type === 'checkbox' ? el.checked : Number(el.value), m = doc.getElementById('polMsg');
        rpc('admin_policy_set', { p_key: key, p_value: v }).then(function (j) { m.textContent = j && j.error ? j.error : 'Saved.'; m.className = 'msg' + (j && j.error ? ' bad' : ''); return loadOverview(); }).then(function () { if (tab === 'queue') renderQueue(); }).catch(function (e) { m.textContent = e.message; m.className = 'msg bad'; });
      });
    });
  }
  function polRow(key, label, desc, val, type, owner) {
    var ctl = type === 'bool' ? '<input type="checkbox" class="switch" data-pol="' + key + '"' + (val === true ? ' checked' : '') + (owner ? '' : ' disabled') + '>' : '<input type="number" style="width:84px" data-pol="' + key + '" value="' + esc(val == null ? '' : val) + '"' + (owner ? '' : ' disabled') + (key === 'k_floor' ? ' min="20"' : ' min="1" max="30"') + '>';
    return '<span class="k">' + esc(label) + '</span><span>' + ctl + '</span><span class="d">' + esc(desc) + '</span>';
  }

  /* ---------- Staff (owner) ---------- */
  function renderStaff() {
    if (me.role !== 'owner') return panel('<div class="card"><h2>Staff</h2><p class="note">Only an owner manages the staff list and reads the audit trail.</p></div>');
    var html = '<div class="card"><h2>Staff accounts</h2>' + (admins ? (admins.length ? '<table class="tbl"><tr><th>Email</th><th>Role</th><th>Since</th><th></th></tr>' + admins.map(function (a) { return '<tr><td>' + esc(a.email) + '</td><td>' + esc(a.role) + (a.revoked_at ? ' <span class="chip">revoked</span>' : '') + '</td><td>' + esc(when(a.added_at)) + '</td><td>' + (!a.revoked_at ? '<button class="btn sm danger" data-revoke="' + esc(a.user_id) + '">Revoke</button>' : '') + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">No staff yet.</p>') : '<p class="empty">Loading…</p>') +
      '<div class="field"><label for="invEmail">Invite by email (the person must have signed in to Rhythme once)</label><input type="email" id="invEmail" placeholder="name@example.com"></div><div class="row"><select id="invRole"><option value="analyst">analyst: reads, runs</option><option value="owner">owner: everything</option></select><button class="btn primary" id="invBtn">Invite</button></div><p class="msg" id="invMsg"></p></div>';
    html += '<div class="card"><h2>Audit trail<span>last 100</span></h2>' + (audit ? (audit.length ? '<table class="tbl"><tr><th>When</th><th>Who</th><th>Call</th><th>Result</th></tr>' + audit.map(function (a) { return '<tr><td>' + esc(when(a.at)) + '</td><td>' + esc(a.email || (a.actor ? String(a.actor).slice(0, 8) + '…' : 'anon')) + '</td><td>' + esc(a.rpc) + '</td><td>' + esc(a.decision) + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">Empty.</p>') : '<p class="empty">Loading…</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn sm" id="pruneBtn">Prune audit older than a year</button><span class="msg" id="pruneMsg"></span></div></div>';
    panel(html);
    doc.getElementById('invBtn').addEventListener('click', function () {
      var m = doc.getElementById('invMsg'), e = doc.getElementById('invEmail').value.trim(), r = doc.getElementById('invRole').value; this.disabled = true;
      rpc('admin_invite', { p_email: e, p_role: r }).then(function (j) { if (j && j.error) { m.textContent = j.error; m.className = 'msg bad'; } else { admins = j; m.textContent = 'Invited.'; m.className = 'msg'; renderStaff(); } }).catch(function (err) { m.textContent = err.message; m.className = 'msg bad'; }).then(function () { var b = doc.getElementById('invBtn'); if (b) b.disabled = false; });
    });
    app.querySelectorAll('[data-revoke]').forEach(function (b) { b.addEventListener('click', function () { if (!root.confirm('Revoke this staff account?')) return; b.disabled = true; rpc('admin_revoke', { p_user: b.dataset.revoke }).then(function (j) { if (j && j.error) { root.alert(j.error); } else admins = j; renderStaff(); }); }); });
    var pb = doc.getElementById('pruneBtn'); if (pb) pb.addEventListener('click', function () { pb.disabled = true; rpc('admin_prune', { p_days: 365 }).then(function (j) { doc.getElementById('pruneMsg').textContent = j && j.error ? j.error : ('Removed ' + j.audit_removed + ' audit rows and ' + j.events_removed + ' old events.'); return loadStaff(); }).then(renderStaff); });
  }

  /* ---------- loading ---------- */
  function loadOverview() { return rpc('admin_overview').then(function (j) { if (denied(j)) return bootStaffOnly(); ov = j; pill('on', 'live'); if (tab === 'today') renderToday(); if (tab === 'agents') renderAgents(); if (tab === 'queue') renderQueue(); }).catch(function (e) { pill('bad', 'offline'); }); }
  function loadFeed(all) {
    var args = all || !feedTop ? { p_limit: 60 } : { p_limit: 60, p_after: feedTop };
    return rpc('admin_feed', args).then(function (rows) {
      if (denied(rows)) return bootStaffOnly();
      rows = Array.isArray(rows) ? rows : [];
      if (all || !feedTop) { feed = rows; } else if (rows.length) { feed = rows.concat(feed).slice(0, 300); }
      if (feed.length) feedTop = feed[0].id;
      if (tab === 'feed') {
        if (!all && rows.length && doc.getElementById('feedList')) { doc.getElementById('feedList').insertAdjacentHTML('afterbegin', rows.map(function (e) { return feedItem(e, true); }).join('')); var s = doc.getElementById('feedSub'); if (s) s.textContent = feed.length + ' events'; }
        else renderFeed();
      }
    }).catch(function () { });
  }
  function loadProposals() { return rpc('admin_proposals').then(function (j) { proposals = Array.isArray(j) ? j : []; }).catch(function () { proposals = []; }); }
  function loadStaff() { if (me.role !== 'owner') return Promise.resolve(); return Promise.all([rpc('admin_list').then(function (j) { admins = Array.isArray(j) ? j : []; }), rpc('admin_audit_tail', { p_limit: 100 }).then(function (j) { audit = Array.isArray(j) ? j : []; })]).catch(function () { }); }
  function render() {
    if (tab === 'today') renderToday();
    else if (tab === 'feed') renderFeed();
    else if (tab === 'agents') renderAgents();
    else if (tab === 'queue') { renderQueue(); if (!proposals) loadProposals().then(function () { if (tab === 'queue') renderQueue(); }); loadReports().then(function () { if (tab === 'queue') renderQueue(); }); }
    else if (tab === 'staff') { renderStaff(); loadStaff().then(function () { if (tab === 'staff') renderStaff(); }); }
  }
  function stopTimers() { timers.forEach(clearInterval); timers = []; }
  function bootStaffOnly() { stopTimers(); me = null; staffOnly(); }
  function boot() {
    stopTimers();
    if (!A || !CFG.supabaseUrl) { app.innerHTML = '<div class="gate">' + LUNA + '<div class="card"><h2>Rhythme staff</h2><p class="msg bad">The sign-in module did not load.</p></div></div>'; return; }
    if (!A.session()) return gate('');
    return rpc('admin_me').then(function (j) {
      if (!j || !j.admin) return staffOnly();
      me = j; shell(); render();
      loadPlaza(); timers.push(setInterval(function () { if (!doc.hidden) loadPlaza(); }, 20000)); /* the groups card never holds up the rest */
      return Promise.all([loadOverview(), loadFeed(true)]).then(function () {
        timers.push(setInterval(function () { if (!doc.hidden) loadFeed(false); }, 10000));
        timers.push(setInterval(function () { if (!doc.hidden) loadOverview(); }, 30000));
      });
    }).catch(function (e) { gate('Could not check your account: ' + e.message, true); });
  }
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden && me) { loadFeed(false); loadOverview(); loadPlaza(); } });
  boot();
})(window);
