/* Rhythme sources stay in the app (Jamie, 23 Oct 2026: "put all in (I) as a popup to read the source and summarize of the
 * studies in point form. I don't want url to escape from the app. Applies for all").
 *
 * Every link that would leave the app (any http or https address on another site) opens a small popup instead: who
 * published it, what it is, and its points, written from the checked lines Rhythme already keeps for that source (the
 * evidence register, the recipe cards, the guides). The address is shown as plain text so it can be cited or looked up
 * by hand, never as a link. Phone numbers (tel:) still call, and links within the app still work. One capture-phase
 * listener does this for every page that loads this file, so a new link anywhere is caught without its own code.
 * Pure parts first (tested in node), then the popup. */
(function (root) {
  'use strict';
  var ORGS = {
    'doi.org': 'A published study', 'pubmed.ncbi.nlm.nih.gov': 'PubMed (US National Library of Medicine)', 'pmc.ncbi.nlm.nih.gov': 'PubMed Central (US National Library of Medicine)', 'ncbi.nlm.nih.gov': 'US National Library of Medicine',
    'nhs.uk': 'NHS (UK National Health Service)', 'myhealthlondon.nhs.uk': 'NHS (UK National Health Service)', 'nice.org.uk': 'NICE (UK National Institute for Health and Care Excellence)', 'cochrane.org': 'Cochrane',
    'nccih.nih.gov': 'US National Center for Complementary and Integrative Health', 'niddk.nih.gov': 'US National Institute of Diabetes and Digestive and Kidney Diseases', 'healthhub.sg': 'HealthHub (Singapore Ministry of Health)',
    'pphtpc.hpb.gov.sg': 'Health Promotion Board, Singapore', 'file.go.gov.sg': 'Singapore Government', 'pdpc.gov.sg': 'Personal Data Protection Commission, Singapore', 'who.int': 'World Health Organization', 'rcog.org.uk': 'Royal College of Obstetricians and Gynaecologists',
    'asrm.org': 'American Society for Reproductive Medicine', 'prod.asrm.org': 'American Society for Reproductive Medicine', 'racgp.org.au': 'Royal Australian College of General Practitioners', 'cdc.gov': 'US Centers for Disease Control and Prevention',
    'gov.uk': 'UK Government', 'diabetes.org.uk': 'Diabetes UK', 'mskcc.org': 'Memorial Sloan Kettering Cancer Center', 'ema.europa.eu': 'European Medicines Agency', 'nationalacademies.org': 'US National Academies',
    'odphp.health.gov': 'US Office of Disease Prevention and Health Promotion', 'fdc.nal.usda.gov': 'USDA FoodData Central', 'jeanhailes.org.au': 'Jean Hailes for Women\'s Health', 'bonehealthandosteoporosis.org': 'Bone Health & Osteoporosis Foundation',
    'bmj.com': 'The BMJ', 'jamanetwork.com': 'JAMA Network', 'link.springer.com': 'Springer (a journal publisher)', 'frontiersin.org': 'Frontiers (a journal publisher)', 'eurekalert.org': 'EurekAlert! (science news releases)',
    'aspca.org': 'ASPCA (American Society for the Prevention of Cruelty to Animals)', 'plants.ces.ncsu.edu': 'NC State Extension Gardener Plant Toolbox', 'pacompendium.com': 'Compendium of Physical Activities', 'world.openfoodfacts.org': 'Open Food Facts',
    'openfoodfacts.github.io': 'Open Food Facts', 'opengameart.org': 'OpenGameArt', 'findahelpline.com': 'Find A Helpline (ThroughLine)', 'erinmindfulmoments.substack.com': 'Take A Pause, by Erin Lee', 'support.apple.com': 'Apple Support'
  };
  function host(url) { var m = /^https?:\/\/([^\/?#:]+)/i.exec(String(url || '')); return m ? m[1].toLowerCase().replace(/^www[0-9]?\./, '') : ''; }
  function org(url) { var h = host(url); if (ORGS[h]) return ORGS[h]; var parts = h.split('.'); for (var i = 1; i < parts.length - 1; i++) { var k = parts.slice(i).join('.'); if (ORGS[k]) return ORGS[k]; } return h || 'Another website'; }
  /* is this address outside the app? http(s) on another origin; tel:, mailto: and in-app links are not */
  function leaves(href, here) {
    var h = String(href || '').trim(); if (!/^https?:\/\//i.test(h)) return false;
    var origin = function (x) { var m = /^(https?:\/\/[^\/?#]+)/i.exec(String(x || '')); return m ? m[1].toLowerCase() : ''; };
    return origin(h) !== origin(here || 'https://app.invalid/');
  }
  /* split a checked line into points: sentences, and the journal or publisher in front kept as its own point */
  function points(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return [];
    var out = t.replace(/([.!?])\s+(?=[A-Z0-9"“(])/g, '$1\n').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); /* no lookbehind: older iPhones cannot parse it */
    return out.map(function (s) { return s.replace(/\.$/, ''); });
  }
  /* what Rhythme knows about an address, from the registers loaded on this page */
  var EXTRA = {}; /* pages and modules may add their own: OvuSources.add(url, {title, points}) */
  /* links that are not in the evidence register or the recipe cards, each with what the app says about it */
  var HELP = { title: 'Find A Helpline', kind: 'Support', points: ['A free directory of crisis lines, text and chat services, listed by country', 'Type findahelpline.com into your browser, or ask a pharmacist, doctor or someone you trust for your local line', 'If you might act on thoughts of harming yourself, or you are in danger now, call your local emergency number or go to the nearest emergency department'] };
  var ERIN = function (t) { return { title: t, kind: 'Essay', points: ['An essay by Erin Lee, the certified MBSR teacher whose words guide Rhythme\'s mindfulness', 'Published on her own newsletter, Take A Pause'] }; };
  [['https://findahelpline.com', HELP], ['https://findahelpline.com/', HELP],
   ['https://erinmindfulmoments.substack.com/p/the-quiet-work-of-change', ERIN('The quiet work of change')], ['https://erinmindfulmoments.substack.com/p/my-wellbeing-our-wellbeing', ERIN('My wellbeing, our wellbeing')], ['https://erinmindfulmoments.substack.com/p/a-view-is-not-the-whole', ERIN('A view is not the whole')],
   ['https://pphtpc.hpb.gov.sg/web/sgfoodid', { title: 'SG FoodID', kind: 'Food data', points: ['The Health Promotion Board\'s Singapore Food Insights Database of local foods and their nutrients', 'Rhythme uses its values for the Singapore dishes it recognises, with the attribution its terms ask for'] }],
   ['https://file.go.gov.sg/termsofuse-hpbsgfoodid.pdf', { title: 'SG FoodID terms of use', kind: 'Terms', points: ['The terms under which the Health Promotion Board lets apps use SG FoodID data', 'They allow the data to be used and adapted, with a clear note naming the source'] }],
   ['https://fdc.nal.usda.gov/', { title: 'FoodData Central', kind: 'Food data', points: ['The US Department of Agriculture\'s database of foods and their nutrients per 100 g', 'Rhythme uses it for generic foods that SG FoodID does not cover'] }],
   ['https://world.openfoodfacts.org/nova', { title: 'NOVA groups on Open Food Facts', kind: 'Food data', points: ['How Open Food Facts sorts packaged foods into the four NOVA processing groups', 'Rhythme uses the group a product already has there and never guesses one for a fresh dish'] }]
  ].forEach(function (x) { EXTRA[x[0]] = x[1]; });
  function add(url, info) { if (url && info) EXTRA[String(url)] = info; }
  function info(url, linkText) {
    var u = String(url || ''), E = root.OvuEvidence, R = root.OvuRecipes, hit = null;
    if (EXTRA[u]) hit = { title: EXTRA[u].title, points: EXTRA[u].points || points(EXTRA[u].text), kind: EXTRA[u].kind || null };
    if (!hit && E && E.LIST) { var ev = E.LIST.filter(function (e) { return e.url === u; })[0]; if (ev) hit = { title: ev.short + ' · ' + ev.id, points: points(ev.text), kind: 'Evidence ' + ev.id }; }
    if (!hit && R) {
      var rc = (R.RECIPES || []).concat(R.LOCAL || []).filter(function (r) { return r.url === u; })[0];
      if (rc) hit = { title: rc.title, points: points(rc.why).concat(rc.groups ? ['Listed under ' + rc.groups.map(function (g) { var gg = R.GROUPS.filter(function (x) { return x.id === g; })[0]; return gg ? gg.name : g; }).join(', ')] : []), kind: rc.groups ? 'Recipe' : 'Guide' };
    }
    if (!hit) hit = { title: String(linkText || '').replace(/\s+/g, ' ').trim() || org(u), points: [], kind: null };
    hit.org = org(u); hit.address = host(u) + (u.replace(/^https?:\/\/[^\/]+/i, '').length > 1 ? '/' + u.replace(/^https?:\/\/[^\/]+\//i, '').replace(/[?#].*$/, '') : '');
    return hit;
  }

  /* ---------- the popup ---------- */
  var doc = root.document;
  root.OvuSources = { ORGS: ORGS, host: host, org: org, leaves: leaves, points: points, info: info, add: add };
  if (!doc || !doc.addEventListener) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CSS = '.srcveil{position:fixed;inset:0;background:rgba(40,24,70,.42);z-index:2000;display:flex;align-items:flex-end;justify-content:center;padding:0 0 env(safe-area-inset-bottom,0)}' +
    '.srcveil[hidden]{display:none}' +
    '.srccard{background:#fffaf8;color:#3d2b52;width:min(560px,100%);max-height:82vh;overflow:auto;border-radius:24px 24px 0 0;padding:18px max(18px,env(safe-area-inset-left,0px)) 22px max(18px,env(safe-area-inset-right,0px));box-shadow:0 -10px 40px rgba(60,40,90,.25);font:400 15px/1.5 Manrope,system-ui,sans-serif}' +
    '.srccard h3{margin:0 40px 2px 0;font:600 19px/1.25 Newsreader,Georgia,serif}' +
    '.srccard .srcorg{display:flex;gap:6px;align-items:center;font:800 12px/1.3 Manrope,system-ui,sans-serif;color:#7a5f96;margin-bottom:10px}' +
    '.srccard ul{margin:8px 0 12px;padding-left:20px}.srccard li{margin:4px 0}' +
    '.srccard .srcaddr{font-size:12px;color:#7a6a88;word-break:break-all;user-select:text;-webkit-user-select:text;background:#f3ecf7;border-radius:10px;padding:8px 10px}' +
    '.srccard .srcnote{font-size:12.5px;color:#6d5a80;margin:8px 0 0}' +
    '.srcx{position:absolute;right:14px;top:14px;width:40px;height:40px;border-radius:50%;border:none;background:#efe6f5;color:#3d2b52;font:700 20px/1 system-ui;cursor:pointer}' +
    '.srcwrap{position:relative;width:min(560px,100%)}' +
    '.srcinfo{flex:none;align-self:flex-start;width:40px;height:40px;margin:-4px -4px 0 auto;border:none;border-radius:50%;background:#f1e8f6;color:#6b4f8a;display:grid;place-items:center;cursor:pointer}.srcinfo .ms{font-size:21px}';
  var veil = null, lastFocus = null;
  function ensure() {
    if (veil) return veil;
    var st = doc.createElement('style'); st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
    veil = doc.createElement('div'); veil.className = 'srcveil'; veil.hidden = true; veil.setAttribute('role', 'dialog'); veil.setAttribute('aria-modal', 'true'); veil.setAttribute('aria-labelledby', 'srcTitle');
    veil.innerHTML = '<div class="srcwrap"><div class="srccard" id="srcCard"></div><button type="button" class="srcx" id="srcClose" aria-label="Close">×</button></div>';
    doc.body.appendChild(veil);
    veil.addEventListener('click', function (e) { if (e.target === veil || e.target.closest('#srcClose')) close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && veil && !veil.hidden) close(); });
    return veil;
  }
  function open(url, text) {
    var v = ensure(), i = info(url, text); lastFocus = doc.activeElement;
    doc.getElementById('srcCard').innerHTML = '<h3 id="srcTitle">' + esc(i.title) + '</h3><div class="srcorg"><span class="ms" aria-hidden="true">info</span>' + esc(i.org) + (i.kind ? ' · ' + esc(i.kind) : '') + '</div>' +
      (i.points.length ? '<ul>' + i.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '<p class="srcnote">Rhythme keeps no summary of this page yet; it is named here so you know where the words came from.</p>') +
      '<div class="srcaddr">' + esc(i.address) + '</div><p class="srcnote">Sources stay in Rhythme: the address is here to cite or look up yourself, not a link.</p>';
    v.hidden = false; try { doc.getElementById('srcClose').focus({ preventScroll: true }); } catch (e) { }
    return i;
  }
  function close() { if (!veil) return; veil.hidden = true; try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) { } }
  /* every tap on a link that would leave the app opens the popup instead (capture phase, before any other handler);
     an (i) button with data-src opens the same popup on any page */
  doc.addEventListener('click', function (e) {
    var ib = e.target && e.target.closest ? e.target.closest('[data-src]') : null;
    if (ib) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); open(ib.getAttribute('data-src'), ib.getAttribute('data-srct') || ''); return; }
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
    if (!leaves(a.getAttribute('href'), root.location && root.location.href)) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    open(a.getAttribute('href'), a.textContent);
  }, true);
  /* a script that tries to open another site gets the popup too */
  var wopen = root.open;
  root.open = function (u) { if (leaves(u, root.location && root.location.href)) { open(u, ''); return null; } return wopen ? wopen.apply(root, arguments) : null; };
  root.OvuSources.open = open; root.OvuSources.close = close;
})(typeof window !== 'undefined' ? window : this);
