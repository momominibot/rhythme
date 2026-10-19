/* Rhythme evidence behind a small (i). Jamie, 19 Oct: "Evidence put on (i) small icon". Wherever a sheet lists the
 * sources for a line (teas and herbs, the "check with a doctor or pharmacist first" cautions, acupoint uses), the source
 * chips are folded behind one small (i) button at the end of that line; a tap shows them, a second tap folds them.
 * The guide panels are already the content of an (i), so their source lists are left as they are. The sheets are drawn
 * by room.js; this only folds what is there, so nothing else changes. */
(function (root) {
  'use strict';
  var doc = root.document;
  if (!doc || !doc.getElementById) return;
  /* the name the sources belong to: the line's own bold label, else the nearest heading of its card */
  function nameFor(refs) {
    var line = refs.parentNode, b = line && line.querySelector && line.querySelector(':scope > b');
    if (b && b.textContent.trim()) return b.textContent.trim();
    var card = refs.closest && refs.closest('details, .acuuse, .teacare, section');
    var head = card && card.querySelector('summary b, b');
    return head ? head.textContent.trim() : '';
  }
  function fold(scope) {
    var list = (scope || doc).querySelectorAll ? (scope || doc).querySelectorAll('.evrefs:not([data-ev-folded])') : [];
    Array.prototype.forEach.call(list, function (refs) {
      if (refs.closest('.guide')) return; /* already inside an (i) panel */
      if (!refs.querySelector('a')) return;
      refs.setAttribute('data-ev-folded', '1');
      var n = nameFor(refs), count = refs.querySelectorAll('a').length;
      var btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'ibtn evi'; btn.textContent = 'i';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', (count > 1 ? count + ' sources' : 'Source') + (n ? ' for ' + n : ''));
      if (!refs.id) refs.id = 'evr' + Math.random().toString(36).slice(2, 9);
      btn.setAttribute('aria-controls', refs.id);
      refs.classList.add('evhide');
      /* a block list of sources under a paragraph: the (i) goes at the end of that paragraph, not on a line of its own */
      var prev = refs.tagName === 'P' ? refs.previousElementSibling : null;
      if (prev && prev.tagName === 'P') prev.appendChild(btn); else refs.parentNode.insertBefore(btn, refs);
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var open = refs.classList.toggle('evhide') === false;
        btn.classList.toggle('on', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }
  function watch() {
    var sheet = doc.getElementById('sheet') || doc.body; if (!sheet || !root.MutationObserver) { fold(doc); return; }
    var queued = false;
    new root.MutationObserver(function () {
      if (queued) return; queued = true;
      (root.requestAnimationFrame || root.setTimeout)(function () { queued = false; fold(sheet); });
    }).observe(sheet, { childList: true, subtree: true });
    fold(sheet);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watch); else watch();
  root.OvuEvInfo = { fold: fold };
})(typeof window !== 'undefined' ? window : this);
