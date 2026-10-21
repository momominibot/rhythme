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
  var AGENTS = {
    cycle: { name: 'Menstrual', color: 'a-cycle', owns: 'period and symptom days, recorded period starts, intervals between starts, prediction mode availability', excludes: 'spotting and flow none never start a cycle; missing logs are not missing periods; recalled and imported history stay separate' },
    sleep: { name: 'Sleep', color: 'a-sleep', owns: 'nights with a usable record, nights with two records, typed versus imported share, duration and quality availability', excludes: 'rows are not nights; bed-to-wake is not time asleep' },
    food: { name: 'Food', color: 'a-food', owns: 'meal days, meals saved, tag completeness, source mix, HPB match and NOVA coverage', excludes: 'missing nutrients are not zero; a saved meal is not a whole day of eating' },
    mind: { name: 'Mindfulness and stress', color: 'a-mind', owns: 'practice days, minutes by kind, completed share, repeat practice on another day, reflection days', excludes: 'reflection text is never read; there is no validated stress measure here' }
  };
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
    app.innerHTML = '<header class="top"><div><a class="brand" href="room.html">RHYTHME<em>STAFF</em></a><h1>' + esc(greeting()) + '<small>' + esc(A.email() || '') + ' · ' + esc(me.role) + '</small></h1></div><span class="pill" id="livePill"><span class="dot"></span><span id="liveTxt">checking</span></span></header>' +
      '<div class="hero"><img src="assets/room/dream/room-v3-sm.webp" alt=""><p>Here is Rhythme today<small>Counts and agent runs only. No diary is shown here.</small></p></div>' +
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
    var html = '<div class="card"><h2>Status<span>' + (last ? 'last run ' + ago(last.started_at) : 'no run yet') + '</span></h2><div class="tiles">' +
      tile('Pipeline', alive === 'ok' ? 'Alive' : alive === 'running' ? 'Running' : alive === 'failed' ? 'Failed' : 'Not run', last ? (last.kind + ', ' + (last.finished_at ? 'finished ' + ago(last.finished_at) : 'in progress')) : 'Press Run now below') +
      tile('Needs you', String(ov.open_proposals || 0), (ov.open_proposals ? 'proposals waiting' : 'nothing waiting')) +
      (ov.held_runs != null ? tile('Results', ov.held_runs ? 'Held' : (ov.latest_run ? 'Published' : 'None'), ov.held_runs ? 'recompute due: a withdrawal or deletion since the last run' : ov.latest_run ? 'from the last finished run' : 'no finished run yet') + tile('Daily run', ov.scheduled ? 'Scheduled' : 'Not scheduled', ov.scheduled ? 'one attempt a day, never retried' : 'runs only when staff press Run now') : '') +
      tile('Accounts', String(c.accounts == null ? '–' : c.accounts), (c.accounts_with_cloud_copy || 0) + ' with a cloud copy') +
      tile('Improvement opt-in', String(c.consent_active == null ? '–' : c.consent_active), eligText(c.consent_eligible, ov.floor)) +
      '</div>' + (blocked.length ? '<div class="note"><b>Model runs are blocked.</b> ' + esc(blocked[0].error) + ' An owner clears it on the Queue tab; nothing retries by itself.</div>' : '') + '</div>';
    html += plazaCard();
    html += '<div class="card"><h2>Diary streams<span>floor ' + esc(ov.floor) + ' people</span></h2>';
    if (!elig.state || elig.state === 'not_enabled') html += '<div class="note"><b>Not enabled.</b> Nobody has turned on the separate “help improve logging” choice yet, so the agents may not read any diary rows. Local-only diaries are never visible here. What exists: ' + esc(c.accounts_with_cloud_copy || 0) + ' account' + ((c.accounts_with_cloud_copy || 0) === 1 ? '' : 's') + ' with a cloud copy, kept private to their owners.</div>';
    else if (elig.state === 'insufficient') html += '<div class="note"><b>Insufficient contributors.</b> Fewer than ' + esc(ov.floor) + ' eligible adults have opted in; values stay held back until the floor is reached.</div>';
    else html += '<div class="note"><b>Measured.</b> ' + esc(elig.value) + ' eligible adults contribute; every number below carries its people count.</div>';
    html += '</div>';
    html += '<div class="card"><h2>Runs</h2>' + (runs.length ? '<table class="tbl"><tr><th>When</th><th>Kind</th><th>Status</th><th>Summary</th></tr>' + runs.map(function (r) { return '<tr><td>' + esc(when(r.started_at)) + '</td><td>' + esc(r.kind) + '</td><td><span class="chip ' + (r.status === 'ok' ? 'ok' : r.status === 'running' ? '' : 'high') + '">' + esc(r.status) + '</span></td><td>' + esc(r.error || (r.summary && r.summary.measured === false ? 'no eligible adults yet' : (r.summary && r.summary.measured ? r.summary.eligible + ' eligible, ' + r.summary.window : ''))) + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">No run yet.</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn primary" id="runNow">Run now</button><span class="msg" id="runMsg"></span></div><p class="srv">A run is deterministic: the four agents measure what the consent rules allow and the orchestrator records what it would do. No model is called and nothing is applied on its own in this phase.</p></div>';
    html += '<div class="card"><h2>Service<span>no diary content</span></h2><div class="tiles">' + tile('Relay counter increments today', String(c.relay_increments_today == null ? '–' : c.relay_increments_today), 'a relay call bumps an IP bucket and a global bucket') + tile('Withdrawn opt-ins', String(c.consent_withdrawn == null ? '–' : c.consent_withdrawn), 'kept on record, excluded from reads') + '</div></div>';
    panel(html);
    var b = doc.getElementById('runNow'); if (b) b.addEventListener('click', runNow);
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
    var table = rows.length ? '<table class="tbl" id="plazaDays"><tr><th>Day</th><th>Joins</th><th>Busiest</th></tr>' + rows.map(function (k) { var b = byDay[k]; return '<tr><td>' + esc(k) + '</td><td>' + esc(b.joins) + '</td><td>' + esc((names[b.top] || b.top) + ' · ' + b.peak) + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">Nobody has joined a group yet.</p>';
    var at = plaza.at ? new Date(plaza.at) : null, hm = at ? at.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' }) : '';
    var stale = plazaBad || (plazaOk && Date.now() - plazaOk > 60000);
    var head = stale ? '<span class="stale">not updated since ' + esc(hm) + '</span>' : '<span>' + esc(total) + ' online · ' + esc(hm) + '</span>';
    return '<div class="card" id="plazaCard"><h2>Plaza groups' + head + '</h2>' + (stale ? '<div class="note"><b>Not current.</b> The last refresh did not come back; the numbers below are from ' + esc(hm) + '. It tries again every 20 seconds.</div>' : '') + '<div class="tiles">' + tiles + '</div>' + table +
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
    return '<li' + (fresh ? ' class="new"' : '') + ' data-id="' + esc(e.id) + '"><span class="bar ' + col + '"></span><div><div class="t">' + esc(e.title) + '</div><div class="m"><b>' + esc(a ? a.name : e.agent) + '</b> · ' + esc(e.kind) + ' · ' + esc(ago(e.at)) + '</div>' + (e.detail && Object.keys(e.detail).length ? '<details><summary>detail</summary><pre>' + esc(JSON.stringify(e.detail, null, 1)) + '</pre></details>' : '') + '</div></li>';
  }
  function renderFeed() {
    panel('<div class="card"><h2>Live feed<span id="feedSub">' + (feed.length ? feed.length + ' events' : '') + '</span></h2>' + (feed.length ? '<ul class="feed" id="feedList">' + feed.map(function (e) { return feedItem(e, false); }).join('') + '</ul>' : '<p class="empty">Nothing has happened yet. Press Run now on Today.</p>') + '<p class="srv">New events arrive every 10 seconds while this page is open; each line is written by the agent or the orchestrator as it works.</p></div>');
  }

  /* ---------- Agents ---------- */
  function renderAgents() {
    var latest = (ov && ov.latest) || {};
    panel('<div class="agents">' + Object.keys(AGENTS).map(function (k) {
      var a = AGENTS[k], rows = latest[k] || [], ready = rows.filter(function (f) { return f.metric === 'eligible_people'; })[0];
      var state = ready ? ready.state : 'not_enabled';
      var chip = state === 'measured' ? '<span class="chip ok">measuring</span>' : state === 'insufficient' ? '<span class="chip watch">under the floor</span>' : '<span class="chip">not enabled</span>';
      var metrics = rows.filter(function (f) { return f.metric !== 'eligible_people'; });
      return '<div class="agent"><h3><i class="' + a.color + '"></i>' + esc(a.name) + ' ' + chip + '</h3><div class="sub">Measures: ' + esc(a.owns) + '.<br>Never: ' + esc(a.excludes) + '.</div>' +
        (ready && ready.prerequisite ? '<div class="note">' + esc(ready.prerequisite) + '</div>' : '') +
        (metrics.length ? metrics.map(function (f) { return '<div class="metric"><span class="k">' + esc(f.metric.replace(/_/g, ' ')) + '<br><small>' + esc(f.window) + '</small></span><span class="v">' + (f.state === 'no_data' ? 'no data' : f.suppressed ? 'held back' : num(f.value) + (f.unit ? ' <small>' + esc(f.unit) + '</small>' : '')) + '<small>' + (f.state === 'no_data' ? 'nobody yet' : f.suppressed ? 'under ' + esc(ov.floor) + ' people' : esc(f.people) + ' people') + '</small></span></div>'; }).join('') : '<div class="metric"><span class="k">no metrics yet</span><span class="v">–</span></div>') +
        '</div>';
    }).join('') + '</div><div class="card"><h2>Orchestrator</h2><p class="note">Reads every agent’s findings after a run, ranks proposals by a fixed priority, and may only ever pick an approved content id for a non-clinical surface, and only once an owner turns autonomy on. It cannot change care guidance, prediction rules, records, collection, consent, pricing, rewards, notifications or saved preferences. In this phase it records and ranks; it applies nothing.</p></div>');
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
    else if (tab === 'staff') { renderStaff(); loadStaff().then(renderStaff); }
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
