/* Rhythme plaza friends, phase 1 (docs/design/2026-10-19-plaza-chat-friends.md).
 * A signed-in adult who turns on Plaza friends makes a plaza card: a name she picks and one of the avatar looks. In a
 * plaza group she then sees the other people there who have a card (they see her too), can ask one of them to be
 * friends, and friends send each other kind notes from a set list. No free text, no hearts, no counts, no read receipts.
 * Block and report sit on every card and every note. Every rule is enforced by the server
 * (supabase/migrations/20261019130000_plaza_friends.sql); the phone only asks and shows. Signed out, nothing is sent. */
(function (root) {
  'use strict';
  var INBOX_MS = 60000, PEOPLE_MS = 20000, TIMEOUT = 10000, SHOWN = 8;

  /* ---------- words and rules (pure, tested in tools/test-core.js) ---------- */
  /* the avatar looks a card can wear (room.js OUTFITS); anything else shows as the cosy knit */
  var LOOKS = [['base', 'Cosy knit'], ['sundress', 'Blush sundress'], ['cozy', 'Cloud hoodie'], ['yoga', 'Mint yoga set'], ['party', 'Lilac tulle'],
    ['kebaya-blue', 'Blue kebaya'], ['kebaya-green', 'Green kebaya'], ['kebaya-red', 'Red kebaya'], ['pajamas', 'Starry pyjamas']];
  /* the same list the server keeps in public.social_phrases (the core suite checks they match) */
  var PHRASES = [
    ['tea', 'Sending you a warm cup of tea.', 'note'], ['gentle', 'Hope today is gentle with you.', 'note'], ['thinking', 'Thinking of you today.', 'note'],
    ['breath', 'Taking a slow breath with you.', 'note'], ['glad', 'Glad you’re here.', 'note'], ['same', 'Same here. You’re not alone.', 'note'],
    ['hug', 'Sending a soft hug.', 'note'], ['bench', 'Saved you a spot on the bench.', 'note'], ['here', 'I’m here if you want company.', 'note'],
    ['morning', 'Good morning. Take it slow.', 'note'], ['rest', 'Rest well tonight.', 'note'], ['thanks', 'Thank you. That was kind.', 'note'],
    ['hello', 'Hello, nice to see you here.', 'hello'], ['friends', 'Would you like to be friends?', 'hello'], ['wave', 'A little wave from across the plaza.', 'hello']
  ];
  var REASONS = [['unkind', 'Unkind or upsetting'], ['spam', 'Spam or selling something'], ['pretending', 'Pretending to be someone else'],
    ['under18', 'Seems to be under 18'], ['worried', 'I’m worried about her safety'], ['other', 'Something else']];
  /* one short line before each action: a pause, never a wait */
  var CUES = {
    card: 'Pick a name that feels like you, not your real one. Nothing about your diary travels with it.',
    ask: 'A friend here is someone you would share a bench with. Ask kindly, and let her answer in her own time.',
    accept: 'Welcome her in. Friendship here goes at its own pace.',
    notnow: 'It is fine to say no. She will not be told.',
    note: 'Before you send, one slow breath. Picture her reading it.',
    receive: 'Let it land. You do not have to reply.',
    block: 'Your peace comes first. She will not be told.',
    report: 'Thank you for looking after the plaza.',
    unfriend: 'Letting go is allowed. She will not be told.'
  };
  /* the consent words for the purpose `social` (design note section 6); a hash of them travels with the event */
  var WORDS = 'While you are in a plaza group, people in the same group who also turned this on can see your plaza name and look, and that you are in that group with them. They can ask to be your friend, and friends can send each other kind notes from a set list. Your diary, your cycle, your account name and your email are never shown. Notes are deleted after 30 days, at the next daily clean-up. You can turn this off at any time; your card, friends, requests and notes are then deleted. People you blocked stay blocked.';
  /* where real people stand on the plaza plate (percent of the plate): on the floor, clear of the furniture */
  var SPOTS = [{ x: 42, y: 60 }, { x: 54, y: 56, flip: true }, { x: 26, y: 59, flip: true }, { x: 70, y: 57, flip: true },
    { x: 47, y: 68 }, { x: 36, y: 61, flip: true }, { x: 60, y: 61 }, { x: 32, y: 64 }];

  function cleanName(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFC'); } catch (e) { }
    return s.replace(/\s+/g, ' ').trim();
  }
  /* the server's name rules (social.name_problem) without its word list, which stays on the server */
  function nameProblem(s) {
    var n = cleanName(s), len = Array.from(n).length;
    if (len < 2 || len > 20) return 'length';
    if (!/^[\p{L}\p{M}\p{Nd} '’.-]+$/u.test(n)) return 'chars';
    if ((n.match(/\p{Nd}/gu) || []).length > 3) return 'contact';
    var low = n.toLowerCase();
    if (/(^|[^\p{L}])(www|http|https|com|net|org)([^\p{L}]|$)/u.test(low)) return 'contact';
    var compact = low.replace(/[^\p{L}]/gu, '');
    if (/^(rhythme|staff|admin|administrator|moderator|mod|erin|erinlee|luna|host|support|official|team|system)$/.test(compact) || /^(rhythme|admin|moderator|official)/.test(compact) || /(rhythme|official)$/.test(compact)) return 'reserved';
    return null;
  }
  var PROBLEMS = {
    length: 'Use 2 to 20 characters.',
    chars: 'Letters, numbers, spaces and . ’ - only.',
    contact: 'No contact details in a name, please.',
    reserved: 'That name belongs to Rhythme. Try another.',
    word: 'Try another name.'
  };
  function problemText(code) { return PROBLEMS[code] || PROBLEMS.word; }
  /* what to say when the server says no; `gone` covers someone who left, hid, turned this off or blocked you */
  function whyText(j) {
    var w = j && j.why;
    if (w === 'name') return problemText(j.problem);
    if (w === 'paused') return 'Plaza friends is paused on this account' + (j.until ? ' until ' + dayText(j.until) : '') + '.';
    return ({
      gone: 'She is not here right now.', off: 'Turn on Plaza friends first.', away: 'Join a group in the plaza first.',
      today: 'That is enough for today. Try again tomorrow.', slow: 'One moment between notes.', many: 'You have 20 asks waiting. Give them time.',
      full: 'One of you already has 200 friends.', phrase: 'Pick one from the list.', adult: 'Plaza friends is for adults 18 and over.',
      look: 'Pick one of the looks.', reason: 'Pick a reason.', hidden: 'You are hidden from groups. Show your card to ask someone.',
      consent: 'Plaza friends is off on this account, perhaps from another phone. Open Plaza friends again to turn it on.',
      stale: 'Your card changed on another phone. Open Plaza friends again to see it.'
    })[w] || 'That did not work. Try again in a moment.';
  }
  function phraseText(id) { var p = PHRASES.filter(function (x) { return x[0] === id; })[0]; return p ? p[1] : ''; }
  function phrases(kind) { return PHRASES.filter(function (x) { return x[2] === kind; }); }
  function lookOf(id) { return LOOKS.some(function (l) { return l[0] === id; }) ? id : 'base'; }
  /* the first eight people stand on the plate, friends first (the server sorts); the rest are listed in the sheet */
  function placeFor(list) {
    return (list || []).slice(0, SHOWN).map(function (p, i) {
      return { id: 'r' + i, real: true, handle: p.handle, name: p.name, outfit: lookOf(p.look), friend: !!p.friend, spot: SPOTS[i] };
    });
  }
  function badgeCount(inbox) {
    if (!inbox || !inbox.ok) return 0;
    return (inbox.asks || []).length + (inbox.notes || []).filter(function (n) { return !n.read; }).length;
  }
  /* what arrived since this phone last looked: asks it has not seen, notes above the last note id it saw */
  function freshSince(inbox, seen) {
    seen = seen || {};
    var asked = seen.asks || [], note = Number(seen.note) || 0;
    if (!inbox || !inbox.ok) return { asks: [], notes: [] };
    return {
      asks: (inbox.asks || []).filter(function (a) { return asked.indexOf(a.handle + '|' + a.at) < 0; }),
      notes: (inbox.notes || []).filter(function (n) { return !n.read && Number(n.id) > note; })
    };
  }
  function freshText(f) {
    var n = f.asks.length + f.notes.length;
    if (!n) return '';
    if (n > 1) return n + ' new things in Plaza friends.';
    return f.notes.length ? 'A kind note from ' + f.notes[0].name + '.' : f.asks[0].name + ' asked to be friends.';
  }
  function ago(iso, now) {
    var ms = (now || Date.now()) - Date.parse(iso || ''); if (!isFinite(ms)) return '';
    var m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 36) return h + ' h ago'; return Math.round(h / 24) + ' days ago';
  }
  function dayText(iso) { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function summary(st) {
    if (!st || !st.signedIn) return 'Sign in to make friends in the plaza';
    if (!st.me) return 'Friends you meet in the plaza groups';
    if (st.me.paused_until) return 'Paused for now';
    if (!st.me.card) return 'Make a plaza card to meet people';
    var f = st.inbox && st.inbox.ok ? (st.inbox.friends || []).length : null, b = badgeCount(st.inbox);
    return (f == null ? 'Your plaza card is ready' : f === 0 ? 'No friends yet' : f + (f === 1 ? ' friend' : ' friends')) + (b ? ' · ' + b + ' new' : '');
  }
  var F = { INBOX_MS: INBOX_MS, PEOPLE_MS: PEOPLE_MS, TIMEOUT: TIMEOUT, SHOWN: SHOWN, LOOKS: LOOKS, PHRASES: PHRASES, REASONS: REASONS, CUES: CUES, WORDS: WORDS, SPOTS: SPOTS,
    cleanName: cleanName, nameProblem: nameProblem, problemText: problemText, whyText: whyText, phraseText: phraseText, phrases: phrases, lookOf: lookOf,
    placeFor: placeFor, badgeCount: badgeCount, freshSince: freshSince, freshText: freshText, ago: ago, summary: summary };
  root.OvuFriends = F;

  /* ---------- the room ---------- */
  var R = root.OvuRoom, A = root.OvuAuth, S = root.OvuStore, doc = root.document, CFG = root.OVU_CONFIG || {};
  if (!R || !A || !S || !doc || !doc.createElement) return;
  /* `held`: after any automatic request fails, nothing is asked again on its own (no timer, check-in, render or return
   * to the app) until she does something herself: opens Plaza friends, taps the group pill or walks into the plaza */
  var me = null, inbox = null, people = [], peopleKey = '[]', peopleVisit = null, held = false, lastUid = null, inboxT = 0, peopleT = 0, peopleGen = 0, inboxGen = 0, sheetGen = 0, sheetOwner = null, wordsHash = '';

  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s); }
  function uid() { var s = A.session && A.session(); return s && s.user ? s.user.id : null; }
  function inPlaza() { var L = R.layout && R.layout(); return !!(L && L.id === 'plaza'); }
  function img(look, cls) { return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + R.ART + 'avatar-' + lookOf(look) + '.webp" alt="">'; }
  function cue(key) { return '<p class="frcue"><span class="ms" aria-hidden="true">spa</span>' + esc(CUES[key]) + '</p>'; }
  function noticeV() { return (root.OvuConsent && root.OvuConsent.NOTICE_V) || 2; } /* main's consent notice is version 2 (room.js CONSENT_V) */
  function device() { try { return root.OvuConsent && root.OvuConsent.device ? root.OvuConsent.device() : ''; } catch (e) { return ''; } }
  function legacyMinor() {
    if (root.OvuConsent && root.OvuConsent.legacyMinor) return root.OvuConsent.legacyMinor();
    return ['under13', '13-16', '13-17', '17'].indexOf(S.profile().ageBand || '') > -1;
  }
  (function hashWords() {
    try { root.crypto.subtle.digest('SHA-256', new root.TextEncoder().encode('Plaza friends. ' + WORDS)).then(function (h) { wordsHash = Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }, function () { }); } catch (e) { }
  })();

  /* one request, for one account: token, fetch and reply share one deadline. `owner` is the account it belongs to (the
   * account that opened the sheet, or the one signed in when it was sent); if another account is signed in by the time
   * it would leave or by the time its reply comes back, it is cancelled and nothing of it is shown or kept. */
  function noop() { }
  function cancelled() { var e = new Error('cancelled'); e.cancelled = true; return e; }
  function rpc(name, args, owner) {
    if (owner === undefined) owner = uid();
    var ctl = root.AbortController ? new root.AbortController() : null;
    var call = Promise.resolve().then(function () { if (!owner || uid() !== owner) throw cancelled(); return A.token(); }).then(function (t) {
      if (!t) throw new Error('signed out');
      if (uid() !== owner) throw cancelled();
      return root.fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, {
        method: 'POST', signal: ctl ? ctl.signal : undefined,
        headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(args || {})
      }).then(function (r) { return r.text().then(function (x) { var j = null; try { j = x ? JSON.parse(x) : null; } catch (e) { } if (!r.ok) throw new Error((j && j.message) || ('error ' + r.status)); return j; }); });
    });
    return new Promise(function (resolve, reject) {
      var timer = root.setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('timeout')); }, TIMEOUT);
      call.then(function (j) { root.clearTimeout(timer); if (uid() !== owner) reject(cancelled()); else resolve(j); }, function (e) { root.clearTimeout(timer); reject(e); });
    });
  }
  function offline(e) { if (e && e.cancelled) return; R.toast('Could not reach Plaza friends. Check the connection and try again.', 'cloud_off'); }

  /* ---------- state from the server ---------- */
  function hold(e) { if (e && e.cancelled) return; held = true; fillPlazaRow(); }
  function resume() { held = false; }
  function loadMe() {
    var u = uid(); if (!u) { me = null; return Promise.resolve(null); }
    return rpc('social_me', {}).then(function (j) { if (uid() === u) me = j; return me; }, function (e) { hold(e); throw e; });
  }
  function loadInbox(quiet) {
    var u = uid(); if (!u || !me || !me.card) { inbox = null; badge(); return Promise.resolve(null); }
    var g = ++inboxGen;
    return rpc('social_inbox', {}).then(function (j) {
      if (g !== inboxGen || uid() !== u) return inbox;
      inbox = j; if (j && j.card !== undefined) { me.card = j.card; if (j.why === 'paused') me.paused_until = j.paused_until; }
      badge(); if (!quiet) tellFresh();
      return inbox;
    }, function (e) { hold(e); throw e; });
  }
  function seen() { var s = S.state().friendsSeen; return s && s.uid === uid() ? s : { uid: uid(), asks: [], note: 0 }; }
  function markSeen() {
    if (!inbox || !inbox.ok) return;
    var maxNote = (inbox.notes || []).reduce(function (m, n) { return Math.max(m, Number(n.id) || 0); }, 0);
    S.setState({ friendsSeen: { uid: uid(), asks: (inbox.asks || []).map(function (a) { return a.handle + '|' + a.at; }).slice(0, 50), note: maxNote } });
  }
  function tellFresh() {
    var t = freshText(freshSince(inbox, seen()));
    if (t && !R.asleep()) { R.toast(t, 'diversity_1'); markSeen(); }
  }
  function badge() {
    var n = badgeCount(inbox), pill = doc.getElementById('plazaPill');
    if (pill) pill.classList.toggle('frnew', n > 0);
    fillPlazaRow();
  }

  /* ---------- people in her group, on the plate ---------- */
  function visit() { var P = root.OvuPlaza, st = P && P.state ? P.state() : null; return st && st.joined && st.joined.visit ? { server: st.joined.id, visit: st.joined.visit } : null; }
  function setPeople(list, forVisit) {
    var key = JSON.stringify(list || []) + '|' + (forVisit || '');
    peopleVisit = forVisit || null;
    if (key === peopleKey) return;
    peopleKey = key; people = list || [];
    if (root.OvuCommunity && root.OvuCommunity.redraw) root.OvuCommunity.redraw();
    fillPlazaRow();
  }
  /* the people shown always belong to the visit they were fetched for: a new group clears them at once, and a failed
   * fetch clears them too and holds every automatic request until she acts */
  function loadPeople() {
    var v = visit(), u = uid(), g = ++peopleGen;
    if (!v || !u || !me || !me.card || me.card.hidden || me.paused_until || !inPlaza() || R.asleep()) { setPeople([]); return Promise.resolve(); }
    if (peopleVisit && peopleVisit !== v.visit) setPeople([]);
    return rpc('social_people', { p_server: v.server, p_visit: v.visit }, u).then(function (j) {
      var now = visit();
      if (g !== peopleGen || !now || now.visit !== v.visit) return;
      setPeople(j && j.ok ? j.people || [] : [], v.visit);
    }, function (e) {
      if (g !== peopleGen || (e && e.cancelled)) return;
      setPeople([]); hold(e);
    });
  }
  function person(handle) { return people.filter(function (p) { return p.handle === handle; })[0] || null; }

  function startTimers() {
    stopTimers();
    if (!uid() || doc.hidden) return;
    inboxT = root.setInterval(inboxTick, INBOX_MS);
    peopleT = root.setInterval(peopleTick, PEOPLE_MS);
  }
  /* each tick first checks that the account is still the one it started with (another tab may have signed in) */
  function inboxTick() { if (uid() !== lastUid) { authChanged(); return; } if (!held && !doc.hidden && me && me.card) loadInbox().catch(noop); }
  function peopleTick() { if (uid() !== lastUid) { authChanged(); return; } if (!held && !doc.hidden) loadPeople(); }
  /* any change of account, in this tab or another: cancel, forget, close, then start again for whoever is signed in */
  function authChanged() {
    var u = uid(); if (u === lastUid) return; lastUid = u;
    me = null; inbox = null; peopleGen++; inboxGen++; sheetGen++; held = false; setPeople([]); badge(); stopTimers();
    if (doc.getElementById('frSheet') && R.sheetOpen && R.sheetOpen()) R.closeSheet(); /* nothing from the last account stays on screen or can be sent */
    if (u) { startTimers(); refreshAll(); }
  }
  function stopTimers() { if (inboxT) root.clearInterval(inboxT); if (peopleT) root.clearInterval(peopleT); inboxT = peopleT = 0; }
  function refreshAll() {
    if (!uid()) return Promise.resolve();
    return loadMe().then(function () { return loadInbox(); }).then(loadPeople, noop);
  }

  /* ---------- the plaza sheet's row: people here and the way into Plaza friends ---------- */
  function fillPlazaRow() {
    var row = doc.getElementById('plazaFriendsRow'); if (!row) return;
    if (!uid()) { row.innerHTML = ''; return; }
    var n = badgeCount(inbox), open = '<button type="button" class="btn soft" data-frp="open"><span class="ms">diversity_1</span>Plaza friends' + (n ? ' · ' + n + ' new' : '') + '</button>';
    if (held) { row.innerHTML = '<p class="help">Plaza friends could not be reached. Open it to try again.</p><div class="row">' + open + '</div>'; return; }
    if (me && me.paused_until) { row.innerHTML = '<p class="help">Plaza friends is paused on this account for now.</p><div class="row">' + open + '</div>'; return; }
    if (!me || !me.card) { row.innerHTML = '<p class="help">Make a plaza card to see the other people here who have one, and to make friends.</p><div class="row">' + open.replace('Plaza friends', 'Make a plaza card') + '</div>'; return; }
    if (me.card.hidden) { row.innerHTML = '<p class="help">You are hidden from groups, so you see nobody here either.</p><div class="row">' + open + '</div>'; return; }
    var here = visit() ? people : [];
    row.innerHTML = (here.length ? '<span class="lbl">People here with a card</span><div class="frchips">' + here.map(function (p) { return '<button type="button" class="frchip' + (p.friend ? ' friend' : '') + '" data-frp="person" data-h="' + esc(p.handle) + '">' + img(p.look) + '<span>' + esc(p.name) + '</span></button>'; }).join('') + '</div>' : (visit() ? '<p class="help">Nobody else here has a plaza card right now.</p>' : '')) + '<div class="row">' + open + '</div>';
  }

  /* ---------- sheets ---------- */
  function frSheet(id, title, sub, icon, html) {
    sheetOwner = uid(); /* every change made from this sheet belongs to the account that opened it */
    R.openSheet(id, title, sub, icon, '<div class="fr" id="frSheet">' + html + '</div>');
    return doc.getElementById('frSheet');
  }
  /* her own way in (a tap): the only path, with the group pill and walking into the plaza, that lifts the hold */
  function open() {
    if (uid() !== lastUid) authChanged();
    resume();
    if (!uid()) {
      var el = frSheet('friends', 'Plaza friends', 'Friends you meet in the plaza groups', 'diversity_1',
        '<p>Plaza friends lets you make a plaza card, see the other people in your plaza group who have one, and send friends kind notes from a set list. It needs an account.</p><div class="row"><button type="button" class="btn primary" id="frSignIn"><span class="ms">person</span>Sign in from You</button></div>');
      el.querySelector('#frSignIn').addEventListener('click', function () { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="you"]'); if (a) a.click(); });
      return;
    }
    frSheet('friends', 'Plaza friends', 'Friends you meet in the plaza groups', 'diversity_1', '<p class="help">Looking…</p>');
    var g = ++sheetGen;
    loadMe().then(function () { return loadInbox(true); }).then(function () { if (g === sheetGen && doc.getElementById('frSheet')) renderFriends(); }, function () {
      if (g !== sheetGen) return; var el = doc.getElementById('frSheet'); if (el) el.innerHTML = '<p class="help">Could not reach Plaza friends. Check the connection; open this again to try once more.</p>';
    });
  }
  /* a redraw after something she did: from what is already known, never a request of its own */
  function show() {
    if (!uid() || !me) { R.closeSheet(); return; }
    frSheet('friends', 'Plaza friends', 'Friends you meet in the plaza groups', 'diversity_1', '');
    renderFriends();
  }
  function renderFriends(editing) {
    var el = doc.getElementById('frSheet'); if (!el || !me) return;
    if (me.paused_until) {
      el.innerHTML = '<div class="flag info"><span class="ms">pause_circle</span><div><b>Paused for now</b><span>Plaza friends is paused on this account until ' + esc(dayText(me.paused_until)) + ', after a report was reviewed. The rest of Rhythme works as usual.</span></div></div>' +
        '<p class="help">You can still turn Plaza friends off: your card, friends, requests and notes are then deleted. The pause stays with the account.</p>' +
        '<div class="row"><button type="button" class="btn soft" data-fr="off"><span class="ms">toggle_off</span>Turn Plaza friends off</button></div>';
      return;
    }
    if (!me.card || editing) { renderCardForm(el, !!me.card); return; }
    var ib = inbox && inbox.ok ? inbox : { friends: [], asks: [], asked: [], notes: [], blocked: [] }, c = me.card;
    var row = function (p, inner, cls) { return '<div class="frrow' + (cls ? ' ' + cls : '') + '">' + img(p.look) + '<div class="frwho"><b>' + esc(p.name) + '</b>' + inner + '</div></div>'; };
    var html = (held ? '<div class="flag info frheld"><span class="ms">cloud_off</span><div><b>Could not reach Plaza friends</b><span>What you see may be out of date. Nothing is asked again until you try.</span></div></div><div class="row"><button type="button" class="btn soft" data-fr="retry"><span class="ms">refresh</span>Try again</button></div>' : '') +
      '<div class="frcard">' + img(c.look) + '<div><b>' + esc(c.name) + '</b><span>' + (c.hidden ? 'Hidden from groups for now' : 'Shown to people in your group who have a card') + '</span></div><button type="button" class="btn sm soft" data-fr="edit">Edit</button></div>';
    if (ib.asks.length) html += '<div class="frsec"><span class="lbl">Asked to be friends</span>' + cue('accept') + ib.asks.map(function (a) {
      return row(a, (a.hello ? '<span>“' + esc(phraseText(a.hello)) + '”</span>' : '<span>' + esc(ago(a.at)) + '</span>') +
        '<div class="fracts"><button type="button" class="btn sm primary" data-fr="accept" data-h="' + esc(a.handle) + '">Accept</button><button type="button" class="btn sm soft" data-fr="notnow" data-h="' + esc(a.handle) + '">Not now</button><button type="button" class="frlink" data-fr="report" data-h="' + esc(a.handle) + '" data-n="' + esc(a.name) + '">Report</button></div>');
    }).join('') + '<p class="help">' + esc(CUES.notnow) + '</p></div>';
    if (ib.notes.length) html += '<div class="frsec"><span class="lbl">Kind notes</span>' + cue('receive') + ib.notes.map(function (n) {
      return row(n, '<span>' + esc(phraseText(n.phrase)) + '</span><small>' + esc(ago(n.at)) + '</small><div class="fracts"><button type="button" class="frlink" data-fr="report" data-h="' + esc(n.handle) + '" data-n="' + esc(n.name) + '" data-note="' + esc(n.id) + '">Report</button></div>', n.read ? '' : 'unread');
    }).join('') + '</div>';
    html += '<div class="frsec"><span class="lbl">Friends</span>' + (ib.friends.length ? ib.friends.map(function (f) {
      return row(f, '<div class="fracts"><button type="button" class="btn sm primary" data-fr="note" data-h="' + esc(f.handle) + '" data-n="' + esc(f.name) + '"><span class="ms">favorite</span>Send a kind note</button><button type="button" class="btn sm soft" data-fr="more" aria-expanded="false">More</button></div>' +
        '<div class="frmore" hidden><button type="button" class="frlink" data-fr="unfriend" data-h="' + esc(f.handle) + '">Unfriend</button><button type="button" class="frlink" data-fr="block" data-h="' + esc(f.handle) + '">Block</button><button type="button" class="frlink" data-fr="report" data-h="' + esc(f.handle) + '" data-n="' + esc(f.name) + '">Report</button></div>');
    }).join('') : '<p class="help">No friends yet. Walk into the plaza, join a group and tap someone to say hello.</p>') + '</div>';
    if (ib.asked.length) html += '<div class="frsec"><span class="lbl">Asked</span><div class="frchips">' + ib.asked.map(function (a) { return '<span class="frchip">' + img(a.look) + '<span>' + esc(a.name) + '</span></span>'; }).join('') + '</div><p class="help">An ask shows here for 30 days, whatever her answer. You are not told which.</p></div>';
    if (ib.blocked.length) html += '<div class="frsec"><span class="lbl">Blocked</span>' + ib.blocked.map(function (b) {
      return row({ name: b.name || 'Someone', look: b.look }, '<span>Since ' + esc(dayText(b.at)) + '</span><div class="fracts"><button type="button" class="frlink" data-fr="unblock" data-id="' + esc(b.id) + '">Unblock</button></div>');
    }).join('') + '</div>';
    html += '<details class="frabout"><summary>What others see and what is kept</summary><p>' + esc(WORDS) + ' A report sends Rhythme staff your card, her card and the phrase, never your diary. Staff never see your account, your email or your group.</p></details>' +
      '<div class="row"><button type="button" class="btn soft" data-fr="off"><span class="ms">toggle_off</span>Turn Plaza friends off</button></div>';
    el.innerHTML = html;
    if (ib.notes.some(function (n) { return !n.read; })) {
      var top = ib.notes.reduce(function (m, n) { return Math.max(m, Number(n.id) || 0); }, 0);
      if (!held) rpc('social_read', { p_upto: top }).then(function () { ib.notes.forEach(function (n) { n.read = true; }); badge(); }, function (e) { hold(e); var el2 = doc.getElementById('frSheet'); if (el2 && !el2.querySelector('.frheld')) renderFriends(); });
    }
    markSeen(); badge();
  }
  function renderCardForm(el, editing) {
    if (legacyMinor()) { el.innerHTML = '<p>Plaza friends is for adults 18 and over.</p>'; return; }
    var c = me.card || {}, pick = lookOf(c.look || S.profile().outfit || 'base');
    if (pick === 'pajamas' && !c.look) pick = 'base';
    el.innerHTML = (editing ? '' : '<p>Make a plaza card to see the other people in your plaza group who have one, and to make friends there.</p>' +
        '<div class="flag info"><span class="ms">shield_person</span><div><b>Plaza friends</b><span>' + esc(WORDS) + '</span></div></div>') +
      '<div class="field"><label for="frName">Plaza name</label><input class="input" id="frName" maxlength="20" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(c.name || '') + '" placeholder="A name for the plaza">' + cue('card') + '<p class="frmsg" id="frNameMsg" aria-live="polite"></p></div>' +
      '<div class="field"><span class="lbl" id="frLookLbl">Look</span><div class="frlooks" role="radiogroup" aria-labelledby="frLookLbl">' + LOOKS.map(function (l) {
        return '<button type="button" class="frlook' + (l[0] === pick ? ' on' : '') + '" role="radio" aria-checked="' + (l[0] === pick) + '" data-look="' + l[0] + '">' + img(l[0]) + '<span>' + esc(l[1]) + '</span></button>';
      }).join('') + '</div></div>' +
      (me.adult ? '' : '<label class="frcheck"><input type="checkbox" id="frAdult"> <span>I am 18 or older</span></label>') +
      (me.on ? '' : '<label class="frcheck"><input type="checkbox" id="frOn"> <span>Turn on Plaza friends, as described above</span></label>') +
      (editing ? '<label class="frcheck"><input type="checkbox" id="frHidden"' + (c.hidden ? ' checked' : '') + '> <span>Hide me from groups for now (friends and notes still work)</span></label>' : '') +
      '<div class="row"><button type="button" class="btn primary" id="frSave"><span class="ms">badge</span>' + (editing ? 'Save my card' : 'Make my card') + '</button>' + (editing ? '<button type="button" class="btn soft" data-fr="back">Back</button>' : '') + '</div><p class="frmsg" id="frMsg" aria-live="polite"></p>';
    var name = el.querySelector('#frName'), save = el.querySelector('#frSave'), expect = editing && me.card ? me.card.handle : null, owner = sheetOwner;
    var ready = function () {
      var p = nameProblem(name.value), a = el.querySelector('#frAdult'), o = el.querySelector('#frOn');
      el.querySelector('#frNameMsg').textContent = name.value.trim() && p ? problemText(p) : '';
      save.disabled = !!p || (a && !a.checked) || (o && !o.checked);
    };
    el.addEventListener('input', ready); el.addEventListener('change', ready);
    el.querySelector('.frlooks').addEventListener('click', function (e) {
      var b = e.target.closest('[data-look]'); if (!b) return;
      el.querySelectorAll('.frlook').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
    });
    save.addEventListener('click', function () {
      var look = (el.querySelector('.frlook.on') || {}).dataset, hid = el.querySelector('#frHidden'), msg = el.querySelector('#frMsg');
      save.disabled = true; msg.textContent = 'Saving…'; resume();
      /* 18+ and Plaza friends are sent only as the boxes she ticked on this form, never from what the phone remembers */
      var adult = el.querySelector('#frAdult'), optIn = el.querySelector('#frOn');
      rpc('social_card_save', { p_name: cleanName(name.value), p_look: look ? look.look : 'base', p_hidden: !!(hid && hid.checked), p_adult: !!(adult && adult.checked),
        p_notice: noticeV(), p_hash: wordsHash || null, p_device: device() || null, p_opt_in: !!(optIn && optIn.checked), p_expect: expect }, owner).then(function (j) {
        if (!j || !j.ok) { msg.textContent = whyText(j); if (j && (j.why === 'stale' || j.why === 'consent')) loadMe().catch(function () { }); else save.disabled = false; return; }
        var first = !me.card; me.card = j.card; me.on = true; me.adult = true;
        try { if ((j.recorded || []).indexOf('social') > -1 && root.OvuConsent && root.OvuConsent.grant) root.OvuConsent.grant('social', 'jit', { sent: true }); } catch (e) { }
        R.chime('save'); R.toast(first ? 'Your plaza card is ready. Walk into a group to meet people.' : 'Card saved.', 'badge');
        loadInbox(true).then(function () { renderFriends(); }, function (e) { if (!(e && e.cancelled)) renderFriends(); }); loadPeople();
      }, function (e) { if (e && e.cancelled) return; msg.textContent = 'Could not reach Plaza friends. Try again in a moment.'; save.disabled = false; });
    });
    ready();
  }
  /* the card of someone in her group, from the plate or the plaza sheet */
  function openPerson(handle) {
    if (root.OvuWalk && root.OvuWalk.napping && root.OvuWalk.napping()) return;
    var p = person(handle); if (!p) { R.toast('She is not here right now.', 'diversity_1'); return; }
    var el = frSheet('person', p.name, 'In your group now', 'person', ''), hello = null;
    var draw = function () {
      var main;
      if (p.friend) main = cue('note') + '<div class="row"><button type="button" class="btn primary" data-fr="note" data-h="' + esc(p.handle) + '" data-n="' + esc(p.name) + '"><span class="ms">favorite</span>Send a kind note</button></div>';
      else if (p.asks) main = cue('accept') + '<p>She asked to be your friend.</p><div class="row"><button type="button" class="btn primary" data-fr="accept" data-h="' + esc(p.handle) + '">Accept</button><button type="button" class="btn soft" data-fr="notnow" data-h="' + esc(p.handle) + '">Not now</button></div><p class="help">' + esc(CUES.notnow) + '</p>';
      else if (p.asked) main = '<div class="row"><button type="button" class="btn soft" disabled>Asked</button></div><p class="help">She can answer in her own time.</p>';
      else main = cue('ask') + '<span class="lbl">Add a hello, if you like</span><div class="frhellos" role="radiogroup" aria-label="A hello to send with it">' +
        [[null, 'No message']].concat(phrases('hello').map(function (h) { return [h[0], h[1]]; })).map(function (h) { var on = h[0] === hello; return '<button type="button" class="frhello' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-hello="' + (h[0] || '') + '">' + esc(h[1]) + '</button>'; }).join('') +
        '</div><div class="row"><button type="button" class="btn primary" data-fr="ask" data-h="' + esc(p.handle) + '"><span class="ms">person_add</span>Ask to be friends</button></div>';
      el.innerHTML = '<div class="frperson">' + img(p.look) + '<div><b>' + esc(p.name) + '</b><span>' + (p.friend ? 'Your friend' : 'In your group now') + '</span></div></div>' + main +
        '<div class="row frquiet"><button type="button" class="btn sm soft" data-fr="block" data-h="' + esc(p.handle) + '"><span class="ms">block</span>Block</button><button type="button" class="btn sm soft" data-fr="report" data-h="' + esc(p.handle) + '" data-n="' + esc(p.name) + '"><span class="ms">flag</span>Report</button></div>' +
        '<p class="help">She sees only your plaza card, never your diary. Blocking and reporting are never shown to her.</p>';
    };
    el.addEventListener('click', function (e) {
      var h = e.target.closest('[data-hello]'); if (!h) return;
      hello = h.dataset.hello || null; draw();
    });
    el.dataset.person = handle; draw();
  }
  function openNote(handle, name, back) {
    var el = frSheet('note', 'A kind note for ' + name, 'Pick one', 'favorite', ''), pick = null, owner = sheetOwner;
    var draw = function () {
      el.innerHTML = cue('note') + '<div class="frphrases" role="radiogroup" aria-label="Kind notes">' + phrases('note').map(function (p) { var on = p[0] === pick; return '<button type="button" class="frphrase' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-phrase="' + p[0] + '">' + esc(p[1]) + '</button>'; }).join('') + '</div>' +
        '<div class="row"><button type="button" class="btn primary" id="frSend"' + (pick ? '' : ' disabled') + '><span class="ms">send</span>Send</button><button type="button" class="btn soft" id="frBack">Back</button></div><p class="frmsg" id="frMsg" aria-live="polite"></p>';
    };
    el.addEventListener('click', function (e) {
      var p = e.target.closest('[data-phrase]'); if (p) { pick = p.dataset.phrase; draw(); return; }
      if (e.target.closest('#frBack')) { back(); return; }
      var s = e.target.closest('#frSend'); if (!s || !pick) return;
      s.disabled = true; resume();
      rpc('social_note', { p_handle: handle, p_phrase: pick }, owner).then(function (j) {
        if (!j || !j.ok) { el.querySelector('#frMsg').textContent = whyText(j); s.disabled = false; return; }
        R.chime('save'); R.toast('Sent. One kind thing, done.', 'favorite'); back();
      }, function (e) { if (e && e.cancelled) return; el.querySelector('#frMsg').textContent = 'Could not reach Plaza friends. Try again in a moment.'; s.disabled = false; });
    });
    draw();
  }
  function openReport(handle, name, noteId, back) {
    var el = frSheet('report', 'Report ' + name, noteId ? 'About a note she sent' : 'About her card', 'flag', ''), why = null, owner = sheetOwner;
    var draw = function () {
      el.innerHTML = cue('report') + '<div class="frreasons" role="radiogroup" aria-label="What happened">' + REASONS.map(function (r) { var on = r[0] === why; return '<button type="button" class="frreason' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-reason="' + r[0] + '">' + esc(r[1]) + '</button>'; }).join('') + '</div>' +
        '<label class="frcheck"><input type="checkbox" id="frAlsoBlock"' + (el.dataset.block === '1' ? ' checked' : '') + '> <span>Also block her</span></label>' +
        '<p class="help">Rhythme staff see her card' + (noteId ? ', the note' : '') + ' and your card, never your diary. She is not told who reported her. If someone is in danger now, call your local emergency number.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="frSendReport"' + (why ? '' : ' disabled') + '><span class="ms">flag</span>Send report</button><button type="button" class="btn soft" id="frBack">Back</button></div><p class="frmsg" id="frMsg" aria-live="polite"></p>';
    };
    el.addEventListener('change', function (e) { if (e.target.id === 'frAlsoBlock') el.dataset.block = e.target.checked ? '1' : '0'; });
    el.addEventListener('click', function (e) {
      var r = e.target.closest('[data-reason]'); if (r) { why = r.dataset.reason; draw(); return; }
      if (e.target.closest('#frBack')) { back(); return; }
      var s = e.target.closest('#frSendReport'); if (!s || !why) return;
      var block = el.dataset.block === '1'; s.disabled = true; resume();
      rpc('social_report', { p_handle: handle, p_reason: why, p_note: noteId ? Number(noteId) : null, p_block: block }, owner).then(function (j) {
        if (!j || !j.ok) { el.querySelector('#frMsg').textContent = whyText(j); s.disabled = false; return; }
        if (block) setPeople(people.filter(function (p) { return p.handle !== handle; }), peopleVisit);
        R.toast('Thank you. Rhythme staff will look at it.' + (block ? ' She is blocked, and will not be told.' : ''), 'flag');
        loadInbox(true).then(back, back);
      }, function (e) { if (e && e.cancelled) return; el.querySelector('#frMsg').textContent = 'Could not reach Plaza friends. Try again in a moment.'; s.disabled = false; });
    });
    draw();
  }

  /* every button in the friends and person sheets */
  function act(b) {
    var what = b.dataset.fr, h = b.dataset.h, inFriends = !doc.querySelector('#frSheet[data-person]'), owner = sheetOwner;
    if (!owner || uid() !== owner) { R.closeSheet(); return; } /* a sheet left open from another account does nothing */
    var back = function () { if (inFriends) show(); else if (person(h)) openPerson(h); else R.closeSheet(); };
    var p = person(h);
    if (what === 'retry') { open(); return; }
    if (what === 'edit') { renderFriends(true); return; }
    if (what === 'back') { renderFriends(); return; }
    if (what === 'more') { var m = b.closest('.frrow').querySelector('.frmore'); m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); return; }
    if (what === 'note') { openNote(h, b.dataset.n || 'a friend', back); return; }
    if (what === 'report') { openReport(h, b.dataset.n || 'someone', b.dataset.note || null, back); return; }
    /* two taps for the quiet but lasting ones; the second tap shows the cue it carries */
    if ((what === 'block' || what === 'unfriend' || what === 'off') && b.dataset.armed !== '1') {
      b.dataset.armed = '1'; b.classList.add('armed');
      b.innerHTML = what === 'off' ? 'Tap again: turn off and delete my card, friends and notes' : what === 'block' ? 'Tap again to block. ' + esc(CUES.block) : 'Tap again to unfriend. ' + esc(CUES.unfriend);
      return;
    }
    b.disabled = true; resume(); /* a tap that sends something is her own act; what follows from it may fail and hold again */
    var done = function (j, okText, icon) {
      if (!j || !j.ok) { R.toast(whyText(j), 'diversity_1'); b.disabled = false; return; }
      if (okText) R.toast(okText, icon || 'diversity_1');
    };
    var call;
    if (what === 'ask') {
      var sel = doc.querySelector('#frSheet .frhello.on');
      call = (function () { var v = visit(); return v ? rpc('social_ask', { p_handle: h, p_server: v.server, p_visit: v.visit, p_hello: sel && sel.dataset.hello ? sel.dataset.hello : null }, owner) : Promise.resolve({ ok: false, why: 'away' }); })().then(function (j) {
        done(j, j && j.status === 'friends' ? 'You are friends now.' : 'Asked. Let her answer in her own time.', 'person_add');
        if (j && j.ok && p) { p.asked = j.status === 'asked'; p.friend = j.status === 'friends'; peopleKey = ''; setPeople(people.slice(), peopleVisit); }
        if (j && j.ok) { loadInbox(true).catch(noop); back(); }
      });
    } else if (what === 'accept' || what === 'notnow') {
      call = rpc('social_answer', { p_handle: h, p_accept: what === 'accept' }, owner).then(function (j) {
        done(j, what === 'accept' ? 'You are friends now. ' + CUES.accept : 'Done. She will not be told.', 'diversity_1');
        if (j && j.ok && p) { p.asks = false; p.friend = what === 'accept'; peopleKey = ''; setPeople(people.slice(), peopleVisit); }
        if (j && j.ok) loadInbox(true).then(back, back);
      });
    } else if (what === 'unfriend') {
      call = rpc('social_unfriend', { p_handle: h }, owner).then(function (j) { done(j, 'Unfriended. She will not be told.'); if (j && j.ok) { if (p) { p.friend = false; peopleKey = ''; setPeople(people.slice(), peopleVisit); } loadInbox(true).then(back, back); } });
    } else if (what === 'block') {
      call = rpc('social_block', { p_handle: h }, owner).then(function (j) { done(j, 'Blocked. ' + CUES.block, 'block'); if (j && j.ok) { setPeople(people.filter(function (x) { return x.handle !== h; }), peopleVisit); var after = function () { if (inFriends) show(); else R.closeSheet(); }; loadInbox(true).then(after, after); } });
    } else if (what === 'unblock') {
      call = rpc('social_unblock', { p_id: b.dataset.id }, owner).then(function (j) { done(j, 'Unblocked.'); if (j && j.ok) loadInbox(true).then(show, show); });
    } else if (what === 'off') {
      call = rpc('social_off', { p_notice: noticeV(), p_device: device() || null }, owner).then(function (j) {
        done(j, 'Plaza friends is off. Your card, friends, requests and notes are deleted.', 'toggle_off');
        if (!j || !j.ok) return;
        try { if (root.OvuConsent && root.OvuConsent.withdraw) root.OvuConsent.withdraw('social', 'you', { sent: true }); } catch (e) { }
        me.card = null; me.on = false; inbox = null; setPeople([]); badge(); show();
      });
    }
    if (call) call.catch(function (e) { if (e && e.cancelled) return; offline(e); b.disabled = false; });
  }

  function mount() {
    doc.addEventListener('click', function (e) {
      var b = e.target.closest('#frSheet [data-fr]'); if (b && !b.disabled) { e.preventDefault(); R.chime('tap'); act(b); return; }
      var q = e.target.closest('#plazaFriendsRow [data-frp]'); if (!q) return;
      e.preventDefault(); R.chime('tap');
      if (q.dataset.frp === 'open') open(); else openPerson(q.dataset.h);
    });
    /* tapping the group pill is her own act: if Plaza friends was holding after a failure, try again now (capture
     * phase, because the pill stops its click from bubbling) */
    doc.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('#plazaPill') || !held || !uid()) return;
      resume(); refreshAll();
    }, true);
    if (root.OvuCommunity && root.OvuCommunity.setPeople) root.OvuCommunity.setPeople(function () { return people.length ? placeFor(people) : null; }, openPerson);
    if (root.OvuPlaza && root.OvuPlaza.onChange) {
      var lastVisit = null;
      root.OvuPlaza.onChange(function () {
        var v = visit(), key = v ? v.visit : null;
        if (key !== lastVisit) { lastVisit = key; setPeople([]); if (!held) loadPeople(); }
        fillPlazaRow(); badge();
      });
    }
    var wasPlaza = inPlaza();
    R.on('layout', function () {
      var now = inPlaza();
      if (!now) setPeople([]);
      else if (!wasPlaza && held) { resume(); refreshAll(); } /* walking into the plaza is her own act */
      wasPlaza = now;
    });
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { stopTimers(); return; }
      if (uid() !== lastUid) { authChanged(); return; }
      if (uid()) { startTimers(); if (!held && me && me.card) loadInbox().then(loadPeople, noop); }
    });
    lastUid = uid();
    if (A.subscribe) A.subscribe(authChanged);
    root.addEventListener('storage', function (e) { if (e.key === null || e.key === 'ovumind_auth_v1') authChanged(); }); /* another tab signed in or out */
    if (uid()) { startTimers(); refreshAll(); }
  }
  R.on('boot', mount);
  F.open = open; F.openPerson = openPerson; F.refresh = refreshAll; F.loadPeople = loadPeople;
  F.state = function () { return { signedIn: !!uid(), me: me, inbox: inbox, people: people.slice(), visit: peopleVisit, held: held, timers: !!inboxT }; };
  F.poll = function () { inboxTick(); peopleTick(); }; /* what the two timers do, for the smoke suite, which cannot wait a minute */
  F.summaryNow = function () { return summary({ signedIn: !!uid(), me: me, inbox: inbox }); };
})(typeof window !== 'undefined' ? window : this);
