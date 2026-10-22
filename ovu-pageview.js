/* In-app page viewer (Jamie, 22 Oct: "all these should be in app, i dont want jump out ... the whole app transition
 * is not smooth"). Any link from the room to one of Rhythme's own older pages (journal, doctor view, Learn pages,
 * terms, privacy and so on) opens in a full-screen sheet that slides over the room instead of leaving it. The room
 * stays loaded underneath, so closing is instant and nothing restarts.
 * - The page loads in a same-origin iframe; its own top bar and bottom tabs are hidden there, the sheet's back arrow
 *   closes it.
 * - A link inside the page back to room.html (with or without #tab) closes the sheet and opens that tab in the room.
 * - A link to another of Rhythme's pages stays inside the sheet; a link to another website opens in a new tab.
 * - Escape and the phone's back gesture (history) close it. */
(function (root) {
  'use strict';
  var doc = root.document;
  var OWN = /^(?:\.\/)?([a-z0-9-]+\.html)(?:[#?].*)?$/i;
  var view, frame, title, opened = false;

  function build() {
    if (view) return;
    view = doc.createElement('div'); view.className = 'pageview'; view.id = 'pageView'; view.hidden = true;
    view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-labelledby', 'pvTitle');
    view.innerHTML = '<div class="pv-bar"><button type="button" class="pv-back" id="pvBack" aria-label="Back to your room"><span class="ms">arrow_back</span></button><b id="pvTitle"></b></div><iframe id="pvFrame" title="Rhythme page"></iframe>';
    doc.body.appendChild(view);
    frame = view.querySelector('#pvFrame'); title = view.querySelector('#pvTitle');
    view.querySelector('#pvBack').addEventListener('click', function () { close(); });
    frame.addEventListener('load', tidy);
  }
  /* the older pages draw their own header and five tabs; inside the sheet the sheet's bar does that job */
  function tidy() {
    var d; try { d = frame.contentDocument; } catch (e) { return; }
    if (!d || !d.documentElement) return;
    if (!d.getElementById('pvEmbedStyle')) {
      var st = d.createElement('style'); st.id = 'pvEmbedStyle';
      st.textContent = 'nav.nav,nav.bottom-nav,.top,.topbar,a.back,.back-link,a.learning-back,#lunaFab,.luna-fab{display:none!important}body{padding-bottom:24px!important}';
      (d.head || d.documentElement).appendChild(st);
    }
    var t = (d.title || '').replace(/^Rhythme\s*[·|-]\s*/, ''); title.textContent = t || 'Rhythme';
    if (!d.__pvWired) {
      d.__pvWired = true;
      d.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
        var href = a.getAttribute('href') || '';
        if (/^room\.html/i.test(href) || href === './' || href === 'index.html') { e.preventDefault(); var h = href.split('#')[1]; close(); if (h) root.dispatchEvent(new CustomEvent('ovu-route', { detail: h })); return; }
        if (/^https?:/i.test(href) && a.target !== '_blank') { e.preventDefault(); root.open(href, '_blank', 'noopener'); }
      }, true);
    }
  }
  function open(href) {
    build();
    frame.src = href;
    title.textContent = '';
    view.hidden = false;
    root.requestAnimationFrame(function () { view.classList.add('on'); });
    if (!opened) { opened = true; try { root.history.pushState({ pageView: 1 }, ''); } catch (e) { } }
    doc.documentElement.classList.add('pv-open');
  }
  function close(fromHistory) {
    if (!view || view.hidden) return;
    view.classList.remove('on');
    doc.documentElement.classList.remove('pv-open');
    setTimeout(function () { if (!view.classList.contains('on')) { view.hidden = true; frame.src = 'about:blank'; } }, 320);
    if (opened) { opened = false; if (!fromHistory) { try { root.history.back(); } catch (e) { } } }
  }
  root.addEventListener('popstate', function () { if (opened) close(true); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && view && !view.hidden) close(); });
  /* every link from the room to one of Rhythme's own pages opens here instead of leaving the room */
  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a || a.hasAttribute('download')) return;
    var href = a.getAttribute('href') || '', m = OWN.exec(href); if (!m) return; /* other sites keep their own tab; Rhythme's own pages never leave the room, even when marked for a new tab (Codex audit, 22 Oct) */
    if (/^room\.html$/i.test(m[1]) || /^index\.html$/i.test(m[1])) { var h = href.split('#')[1]; if (h) { e.preventDefault(); root.dispatchEvent(new CustomEvent('ovu-route', { detail: h })); } return; } /* a room tab link opens the tab, not just the address bar */
    e.preventDefault(); open(href);
  });
  root.OvuPage = { open: open, close: close, isOpen: function () { return !!(view && !view.hidden); } };
})(window);
