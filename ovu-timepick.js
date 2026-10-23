/* Rhythme time picker (Jamie, 23 Oct 2026: "aiyo where is my cuteness", about the browser's own blue time box on
 * bedtime and wake time). Every <input type="time"> in the room gets a soft pill showing the time ("10:40 pm") with a moon
 * or a sun, and a tap opens a small panel under it: hours, minutes in fives with a one-minute nudge, am or pm, Clear and
 * Done. The real input stays underneath, invisible, and holds the value; the panel writes to it and fires input and
 * change, so every sheet that reads .value keeps working unchanged. A value set by code is picked up on the next tick.
 * Pure helpers first (tested in tools/test-core.js), then the DOM part. */
(function (root) {
  'use strict';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* 'HH:MM' -> {h12, m, pm} or null */
  function parse(v) { var m = /^(\d{1,2}):(\d{2})/.exec(String(v || '')); if (!m) return null; var h = Number(m[1]), mi = Number(m[2]); if (h > 23 || mi > 59) return null; return { h12: h % 12 === 0 ? 12 : h % 12, m: mi, pm: h >= 12 }; }
  /* {h12, m, pm} -> 'HH:MM' */
  function value(t) { var h = t.h12 % 12 + (t.pm ? 12 : 0); return pad(h) + ':' + pad(t.m); }
  /* '22:40' -> '10:40 pm'; '' -> '' */
  function label(v) { var t = parse(v); return t ? t.h12 + ':' + pad(t.m) + ' ' + (t.pm ? 'pm' : 'am') : ''; }
  /* night from 7 pm to 6 am gets the moon, the day the sun */
  function isNight(v) { var t = parse(v); if (!t) return false; var h = t.h12 % 12 + (t.pm ? 12 : 0); return h >= 19 || h < 6; }
  var TP = { parse: parse, value: value, label: label, isNight: isNight };
  root.OvuTimePick = TP;

  var doc = root.document; if (!doc || !doc.addEventListener || !doc.querySelectorAll || !root.MutationObserver) return; /* a test harness without a DOM gets the pure helpers only */
  var open = null; /* the one panel open at a time: {input, btn, panel, t} */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function paint(input) {
    var btn = input.__tpBtn; if (!btn) return;
    var v = input.value, l = label(v);
    btn.querySelector('.tpic').textContent = v ? (isNight(v) ? 'bedtime' : 'light_mode') : 'schedule';
    btn.querySelector('.tptx').textContent = l || 'Tap to choose';
    btn.classList.toggle('empty', !l); btn.classList.toggle('night', !!l && isNight(v));
    btn.setAttribute('aria-label', (input.__tpName || 'Time') + ': ' + (l || 'not set') + '. Tap to choose');
  }
  function emit(input) { ['input', 'change'].forEach(function (n) { input.dispatchEvent(new Event(n, { bubbles: true })); }); }
  function close() { if (!open) return; var o = open; open = null; if (o.panel.parentNode) o.panel.parentNode.removeChild(o.panel); o.btn.setAttribute('aria-expanded', 'false'); paint(o.input); }
  function render(o) {
    var t = o.t, hours = [], mins = [];
    for (var h = 1; h <= 12; h++) hours.push('<button type="button" class="tpchip' + (t.h12 === h ? ' on' : '') + '" data-tph="' + h + '">' + h + '</button>');
    for (var m = 0; m < 60; m += 5) mins.push('<button type="button" class="tpchip' + (t.m === m ? ' on' : '') + '" data-tpm="' + m + '">' + pad(m) + '</button>');
    o.panel.innerHTML = '<div class="tphead"><span class="ms tpbig" aria-hidden="true">' + (isNight(value(t)) ? 'bedtime' : 'light_mode') + '</span><b>' + esc(label(value(t))) + '</b>' +
      '<span class="tpnudge"><button type="button" data-tpd="-1" aria-label="One minute earlier">−1</button><button type="button" data-tpd="1" aria-label="One minute later">+1</button></span></div>' +
      '<div class="tpampm" role="radiogroup" aria-label="Morning or evening"><button type="button" role="radio" aria-checked="' + !t.pm + '" class="' + (t.pm ? '' : 'on') + '" data-tpp="am"><span class="ms" aria-hidden="true">light_mode</span>am</button><button type="button" role="radio" aria-checked="' + t.pm + '" class="' + (t.pm ? 'on' : '') + '" data-tpp="pm"><span class="ms" aria-hidden="true">bedtime</span>pm</button></div>' +
      '<span class="tplbl">Hour</span><div class="tpgrid">' + hours.join('') + '</div>' +
      '<span class="tplbl">Minute</span><div class="tpgrid">' + mins.join('') + '</div>' +
      '<div class="tprow"><button type="button" class="tpclear" data-tpx="clear">Clear</button><button type="button" class="tpdone" data-tpx="done"><span class="ms" aria-hidden="true">check</span>Done</button></div>';
  }
  function set(o) { o.input.value = value(o.t); emit(o.input); render(o); paint(o.input); }
  function openFor(input) {
    if (open && open.input === input) return; close();
    var now = new Date(), t = parse(input.value) || { h12: now.getHours() % 12 === 0 ? 12 : now.getHours() % 12, m: Math.floor(now.getMinutes() / 5) * 5, pm: now.getHours() >= 12 };
    var panel = doc.createElement('div'); panel.className = 'tppanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Choose ' + (input.__tpName || 'a time').toLowerCase());
    var o = { input: input, btn: input.__tpBtn, panel: panel, t: t }; open = o; render(o);
    /* under the whole row when the field sits in a two-column row, so the panel has the sheet's full width */
    var anchor = input.closest('.grid2') || input.__tpWrap; anchor.parentNode.insertBefore(panel, anchor.nextSibling); o.btn.setAttribute('aria-expanded', 'true');
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation();
      if (b.dataset.tph) { o.t.h12 = Number(b.dataset.tph); return set(o); }
      if (b.dataset.tpm) { o.t.m = Number(b.dataset.tpm); return set(o); }
      if (b.dataset.tpp) { o.t.pm = b.dataset.tpp === 'pm'; return set(o); }
      if (b.dataset.tpd) { var mm = (o.t.h12 % 12 + (o.t.pm ? 12 : 0)) * 60 + o.t.m + Number(b.dataset.tpd); mm = (mm + 1440) % 1440; o.t = parse(pad(Math.floor(mm / 60)) + ':' + pad(mm % 60)); return set(o); }
      if (b.dataset.tpx === 'clear') { input.value = ''; emit(input); close(); return; }
      if (b.dataset.tpx === 'done') { if (!input.value) { input.value = value(o.t); emit(input); } close(); o.btn.focus(); }
    });
    try { panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { }
  }
  function enhance(input) {
    if (input.__tpBtn || input.type !== 'time') return;
    var lab = input.id ? doc.querySelector('label[for="' + input.id + '"]') : null; input.__tpName = lab ? lab.textContent.trim() : 'Time';
    var wrap = doc.createElement('span'); wrap.className = 'tpwrap';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input); input.classList.add('tpnative'); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    var btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'tpbtn'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="ms tpic" aria-hidden="true">schedule</span><span class="tptx"></span><span class="ms tpchev" aria-hidden="true">expand_more</span>';
    wrap.appendChild(btn); input.__tpBtn = btn; input.__tpWrap = wrap; input.__tpSeen = input.value;
    btn.addEventListener('click', function (e) { e.preventDefault(); if (open && open.input === input) close(); else openFor(input); });
    input.addEventListener('focus', function () { openFor(input); });
    input.addEventListener('input', function () { paint(input); });
    if (lab) lab.addEventListener('click', function (e) { e.preventDefault(); openFor(input); });
    paint(input);
  }
  function scan(rootEl) { Array.prototype.forEach.call((rootEl || doc).querySelectorAll('input[type="time"]'), enhance); }
  /* a value written by code (a refill, an edit) shows on the pill within a moment; a panel whose input left the page closes */
  function tick() {
    Array.prototype.forEach.call(doc.querySelectorAll('input.tpnative'), function (i) { if (i.value !== i.__tpSeen) { i.__tpSeen = i.value; paint(i); } });
    if (open && !doc.body.contains(open.input)) { open = null; }
  }
  function start() {
    scan(doc);
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="time"]')) enhance(n); else if (n.querySelectorAll) scan(n); } }); }); }).observe(doc.body, { childList: true, subtree: true });
    root.setInterval(tick, 400);
    doc.addEventListener('click', function (e) { if (open && !open.panel.contains(e.target) && !open.btn.contains(e.target)) close(); }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { var b = open.btn; close(); b.focus(); } });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : this);
