/* Ovumind evidence details. Source records are displayed as text, never HTML.
   The database's review status is distinct from validation of the app or its models. */
(function () {
  'use strict';

  var sheetEl = null;
  var titleEl = null;
  var bodyEl = null;
  var closeButton = null;
  var previousFocus = null;
  var previousOverflow = '';
  var triggerEl = null;
  var fallbackBackdrop = null;
  var inertSiblings = [];

  function text(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
    return '';
  }

  function element(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = text(value);
    return node;
  }

  function getEntry(key) {
    var db = window.EVIDENCE_DB || {};
    return Object.prototype.hasOwnProperty.call(db, key) ? db[key] : undefined;
  }

  function safeHttps(value) {
    var raw = text(value);
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return null;
    try {
      var url = new URL(raw);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }

  function addLink(parent, label, value) {
    var url = safeHttps(value);
    if (!url) return false;
    var link = element('a', 'qi-source-link', label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', label + ' (opens in a new tab)');
    parent.appendChild(link);
    return true;
  }

  function section(label, value, className) {
    var content = text(value);
    if (!content) return;
    var wrap = element('section', 'qi-section');
    wrap.appendChild(element('h3', 'qi-label', label));
    wrap.appendChild(element('div', className || 'qi-evidence', content));
    bodyEl.appendChild(wrap);
  }

  function renderSources(entry) {
    var sources = Array.isArray(entry.sources) ? entry.sources.slice() : [];
    if (entry.source && typeof entry.source === 'object') sources.push(entry.source);
    var seen = new Set();
    var list = element('div', 'qi-source-list');
    sources.forEach(function (source) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return;
      var identity = [text(source.url), text(source.doi), text(source.pmid), text(source.title)].join('|');
      if (!identity.replace(/\|/g, '') || seen.has(identity)) return;
      seen.add(identity);
      var card = element('article', 'qi-source');
      card.appendChild(element('h4', '', text(source.title) || 'Source record'));
      var byline = [text(source.authors), text(source.year), text(source.journal)].filter(Boolean).join(' · ');
      if (byline) card.appendChild(element('p', '', byline));
      var links = element('div', 'qi-source-links');
      addLink(links, 'Read source', source.url);
      var doi = text(source.doi).replace(/^https:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
      if (/^10\.\d{4,9}\/\S+$/.test(doi)) {
        addLink(links, 'DOI: ' + doi, 'https://doi.org/' + doi.split('/').map(encodeURIComponent).join('/'));
      }
      var pmid = text(source.pmid);
      if (/^\d{1,12}$/.test(pmid)) addLink(links, 'PubMed: ' + pmid, 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/');
      if (links.childElementCount) card.appendChild(links);
      else card.appendChild(element('p', 'qi-source-note', 'No usable HTTPS source link is recorded.'));
      list.appendChild(card);
    });
    if (list.childElementCount) {
      var wrap = element('section', 'qi-section');
      wrap.appendChild(element('h3', 'qi-label', 'Sources'));
      wrap.appendChild(list);
      bodyEl.appendChild(wrap);
    } else section('Sources', 'No source record is available for this statement.');
  }

  function renderMethod(method) {
    if (!method) return;
    if (typeof method === 'string' || Array.isArray(method)) {
      section('Method', method);
      return;
    }
    if (typeof method !== 'object') return;
    var details = [];
    ['name', 'description', 'formula', 'inputs', 'units', 'population', 'version'].forEach(function (key) {
      if (text(method[key])) details.push(key.charAt(0).toUpperCase() + key.slice(1) + ': ' + text(method[key]));
    });
    section('Method', details.join('\n'));
  }

  function renderEntry(entry) {
    bodyEl.replaceChildren();
    var available = entry && typeof entry === 'object' && !Array.isArray(entry);
    titleEl.textContent = available ? 'Sources & evidence' : 'Evidence not yet available';
    var verified = available && entry.verification && entry.verification.status === 'verified';
    var status = element('p', 'qi-review-status' + (verified ? ' is-reviewed' : ''), verified ? 'Source review completed' : 'Source review pending');
    status.id = 'qiReviewStatus';
    bodyEl.appendChild(status);
    if (!available) {
      section('Evidence not yet available', 'This statement does not yet have a matching source record. It has not been reviewed in this evidence panel.');
      return;
    }
    var checkedAt = text(entry.verification && entry.verification.checkedAt) || text(entry.checkedAt);
    bodyEl.appendChild(element('p', 'qi-checked-at', checkedAt ? 'Last source check: ' + checkedAt : 'No source-check date recorded.'));
    section('Statement in this app', entry.claim || 'No statement is recorded.', 'qi-claim');
    section(verified ? 'Evidence summary' : 'Draft evidence summary · awaiting source review', entry.evidence || 'No evidence summary is recorded.');
    renderSources(entry);
    renderMethod(entry.method);
    section('Limitations', entry.limitations || 'A source citation does not establish that this app’s measurements or scoring models are clinically validated.');
    var disclaimer = element('div', 'qi-disclaimer');
    disclaimer.appendChild(element('strong', '', 'Wellness education'));
    disclaimer.appendChild(element('p', '', entry.wellnessNote || 'This information is educational. Discuss personal medical decisions with a qualified healthcare professional.'));
    bodyEl.appendChild(disclaimer);
  }

  function restoreFocus() {
    document.body.style.overflow = previousOverflow;
    if (triggerEl && triggerEl.isConnected) triggerEl.setAttribute('aria-expanded', 'false');
    inertSiblings.forEach(function (record) { record.node.inert = record.inert; });
    inertSiblings = [];
    if (fallbackBackdrop) fallbackBackdrop.hidden = true;
    var target = previousFocus;
    previousFocus = null;
    triggerEl = null;
    if (target && target.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheetEl || !sheetEl.hasAttribute('open')) return;
    if (typeof sheetEl.close === 'function') sheetEl.close();
    else sheetEl.removeAttribute('open');
    restoreFocus();
  }

  function ensureSheet() {
    if (sheetEl) return;
    sheetEl = element('dialog', 'qi-sheet');
    sheetEl.id = 'qiSheet';
    sheetEl.setAttribute('aria-labelledby', 'qiTitle');
    sheetEl.setAttribute('aria-describedby', 'qiReviewStatus');
    var handle = element('div', 'qi-handle');
    handle.setAttribute('aria-hidden', 'true');
    sheetEl.appendChild(handle);
    var header = element('header', 'qi-header');
    titleEl = element('h2', 'qi-title', 'Sources & evidence');
    titleEl.id = 'qiTitle';
    header.appendChild(titleEl);
    closeButton = element('button', 'qi-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close evidence');
    closeButton.addEventListener('click', closeSheet);
    header.appendChild(closeButton);
    sheetEl.appendChild(header);
    bodyEl = element('div', 'qi-body');
    bodyEl.id = 'qiBody';
    bodyEl.setAttribute('tabindex', '0');
    bodyEl.setAttribute('aria-label', 'Evidence details');
    sheetEl.appendChild(bodyEl);
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener('close', function () {
      // A queued close event must not disturb a newly reopened panel.
      if (!sheetEl.hasAttribute('open') && previousFocus) restoreFocus();
    });
    sheetEl.addEventListener('cancel', function (event) { event.preventDefault(); closeSheet(); });
    sheetEl.addEventListener('click', function (event) {
      if (event.target !== sheetEl) return;
      var rect = sheetEl.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSheet();
    });
    sheetEl.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
      if (event.key !== 'Tab') return;
      var focusable = Array.from(sheetEl.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')).filter(function (node) { return node.getClientRects().length; });
      if (!focusable.length) { event.preventDefault(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  function openSheet(key, trigger) {
    ensureSheet();
    if (!sheetEl.hasAttribute('open')) {
      previousFocus = trigger || document.activeElement;
      previousOverflow = document.body.style.overflow;
    }
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
    triggerEl = trigger || null;
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'true');
    renderEntry(getEntry(key));
    if (!sheetEl.hasAttribute('open')) {
      if (typeof sheetEl.showModal === 'function') sheetEl.showModal();
      else {
        // Older embedded browsers retain keyboard access and isolate the background.
        if (!fallbackBackdrop) {
          fallbackBackdrop = element('div', 'qi-backdrop');
          fallbackBackdrop.addEventListener('click', closeSheet);
          document.body.appendChild(fallbackBackdrop);
        }
        fallbackBackdrop.hidden = false;
        sheetEl.setAttribute('role', 'dialog');
        sheetEl.setAttribute('aria-modal', 'true');
        Array.from(document.body.children).forEach(function (node) {
          if (node === sheetEl || node === fallbackBackdrop) return;
          inertSiblings.push({ node: node, inert: node.inert });
          node.inert = true;
        });
        sheetEl.setAttribute('open', '');
      }
    }
    document.body.style.overflow = 'hidden';
    bodyEl.scrollTop = 0;
    closeButton.focus({ preventScroll: true });
  }

  function prepareTrigger(node) {
    if (node.tagName === 'BUTTON') node.setAttribute('type', 'button');
    else { node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0'); }
    node.setAttribute('aria-haspopup', 'dialog');
    node.setAttribute('aria-controls', 'qiSheet');
    if (!node.hasAttribute('aria-expanded')) node.setAttribute('aria-expanded', 'false');
    if (!node.hasAttribute('aria-label')) {
      var entry = getEntry(node.getAttribute('data-evidence'));
      var claim = text(entry && entry.claim);
      node.setAttribute('aria-label', claim ? 'Read sources: ' + claim : 'Read evidence details');
    }
  }

  function prepareTriggers(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.matches && root.matches('.qi[data-evidence]')) prepareTrigger(root);
    root.querySelectorAll('.qi[data-evidence]').forEach(prepareTrigger);
  }

  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element && event.target.closest('.qi[data-evidence]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openSheet(target.getAttribute('data-evidence'), target);
  }, true);
  document.addEventListener('keydown', function (event) {
    var target = event.target instanceof Element && event.target.closest('.qi[data-evidence]');
    if (!target || target.tagName === 'BUTTON' || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openSheet(target.getAttribute('data-evidence'), target);
  });
  prepareTriggers(document);
  new MutationObserver(function (changes) {
    changes.forEach(function (change) { change.addedNodes.forEach(prepareTriggers); });
  }).observe(document.body, { childList: true, subtree: true });

  window.OvumindEvidence = { open: openSheet, close: closeSheet, get: getEntry };
})();
