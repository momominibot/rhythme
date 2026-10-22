/* Rhythme: trying on at Petal & Thread (Jamie, 21 Oct: "so when user went into the fashion boutique shop, we will allow
 * customization of the avatar - try on outfit and accessories"). In the boutique's fitting room she can try on any outfit,
 * a Rhythme Plus drop too, and see herself in it in the room (with the twirl, unless motion is reduced). Trying on is free
 * and saves nothing: no profile, no diary, no hearts. An outfit she has can be kept, free, as the wardrobe has always been;
 * a Plus drop says "Part of Rhythme Plus" and opens the Plus hook, with no price. Leaving the boutique, bedtime, the mat,
 * a practice or "Back to my own clothes" puts her own clothes back (room.js: tryOn, endTryOn, keepTryOn).
 * Accessories are a layer over her standing picture, placed per sprite; no accessory art exists yet, so none is `ready`
 * and the slot stays hidden. Design: docs/design/2026-10-21-boutique-try-on.md. Pure rules first (testable in node). */
(function (root) {
  'use strict';
  /* An accessory: { id, name, img (in assets/room/dream/), ready, at: { <sprite>: { u, v, w, rot } }, skip: [outfit ids] }.
   * u, v: its centre as a fraction of the sprite picture; w: its width as a fraction of the picture's width; rot: degrees.
   * A sprite with no entry (a walk, a pose, sleep) hides it. A head piece skips the tudung unless drawn to sit on it, so
   * no hair ever shows. Pieces join once their art is drawn (Jamie chooses first: no art run without her go-ahead). */
  var ACCESSORIES = [];
  var ID = /^[a-z0-9-]{1,32}$/;
  function finite(n) { return typeof n === 'number' && isFinite(n); }
  function validSpot(p) { return !!p && finite(p.u) && finite(p.v) && finite(p.w) && p.w > 0 && p.w <= 1 && p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1 && (p.rot === undefined || finite(p.rot)); }
  function usable(a) { return !!a && a.ready === true && ID.test(a.id || '') && typeof a.img === 'string' && !!a.at && typeof a.at === 'object'; }
  function list(all) { return (all || ACCESSORIES).filter(usable); }
  function byId(id, all) { return list(all).filter(function (a) { return a.id === id; })[0] || null; }
  /* where it sits on this picture of her, or null (not drawn for it, or skipped for this outfit) */
  function spotFor(a, sprite, outfit) {
    if (!usable(a) || !sprite) return null;
    if ((a.skip || []).indexOf(outfit) > -1) return null;
    var p = Object.prototype.hasOwnProperty.call(a.at, sprite) ? a.at[sprite] : null;
    return validSpot(p) ? p : null;
  }
  /* the box in percent of the avatar button, from the sprite's fit ([width relative to the button, her centre as a fraction of
   * the picture], room.js AVATAR_FIT): the picture is f0 wide, its left edge at 0.5 - f1*f0, and it is as tall as the button.
   * Flipped, the picture mirrors about the button's middle (its transform origin is her centre), so the left edge mirrors too */
  function boxFor(fit, p) {
    var f0 = fit && finite(fit[0]) ? fit[0] : 1, f1 = fit && finite(fit[1]) ? fit[1] : 0.5;
    var l = (0.5 - f1 * f0 + p.u * f0) * 100;
    return { l: +l.toFixed(2), lf: +(100 - l).toFixed(2), t: +(p.v * 100).toFixed(2), w: +(p.w * f0 * 100).toFixed(2), rot: finite(p.rot) ? p.rot : 0 };
  }
  /* what a card in the fitting room says about an outfit */
  function tag(id, o) { return id === o.wearing ? (o.trying ? 'Trying on' : 'Wearing now') : !o.mine ? 'Part of Rhythme Plus' : id === o.saved ? 'Your own' : 'Yours to wear'; }
  /* a rail tile's words: what she wears, hers (free), Rhythme Plus (no price here), or a new arrival's hearts */
  function railTag(it, wear) { return it.id === wear ? 'Wearing now' : it.kind === 'own' ? 'Yours, free' : it.kind === 'plus' ? 'Rhythme Plus' : (it.cost + ' hearts' + (it.wearable ? '' : ' · arriving soon')); }
  var B = { ACCESSORIES: ACCESSORIES, usable: usable, list: list, byId: byId, spotFor: spotFor, boxFor: boxFor, tag: tag, railTag: railTag };
  root.OvuBoutique = B;

  /* ---------- the fitting room, the bar and the accessory layer ---------- */
  var R = root.OvuRoom, LN = root.OvuLane, doc = root.document;
  if (!R || !R.tryOn || !doc || !doc.createElement) return;
  var S = root.OvuStore, ART = R.ART || 'assets/room/dream/';
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s); }
  function here() { var L = R.layout && R.layout(); return !!L && L.id === 'lane-boutique'; }
  function open_() { return !LN || !LN.openNow || LN.openNow('boutique'); }
  function outfitName(id) { var o = (R.OUTFITS || []).filter(function (x) { return x.id === id; })[0]; return o ? o.name : id; }
  /* the Plus purchase is an in-app purchase built elsewhere: OvuPlus.offer({ from, item }) is its one entry point, and until it
   * exists the Plus preview sheet opens. No price is shown here */
  function plusOffer(item) { if (root.OvuPlus && typeof root.OvuPlus.offer === 'function') { try { root.OvuPlus.offer({ from: 'boutique', item: item }); return; } catch (e) { } } if (R.openPlus) R.openPlus(); }
  B.plusOffer = plusOffer;

  var pickTok = 0;
  function openFitting() {
    if (!here() || (R.asleep && R.asleep()) || !open_()) { if (LN && LN.openPlace) LN.openPlace('boutique'); return; }
    var t = R.tryingOn(), wear = R.wearing(), saved = t ? t.saved : wear, acc = t ? t.acc : R.savedAcc(), pieces = list();
    var cards = (R.OUTFITS || []).map(function (o) {
      var mine = !R.outfitLocked(o.id), lab = tag(o.id, { wearing: wear, trying: !!t, mine: mine, saved: saved });
      return '<button type="button" class="outfit' + (o.id === wear ? ' on' : '') + (mine ? '' : ' plusdrop') + '" data-try="' + esc(o.id) + '" aria-pressed="' + (o.id === wear) + '" aria-label="Try on ' + esc(o.name) + ', ' + esc(lab) + '">' +
        '<img src="' + ART + 'avatar-' + esc(o.id) + '.webp" alt=""><b>' + esc(o.name) + '</b><small>' + esc(lab) + '</small>' + (mine ? '' : '<em class="pluschip">Plus</em>') + '</button>';
    }).join('');
    var accRow = pieces.length ? '<p class="shelf"><span class="ms">diamond</span>Accessories</p><div class="chips" id="tryAcc"><button type="button" class="chipbtn' + (acc ? '' : ' on') + '" data-acc="" aria-pressed="' + !acc + '">None</button>' +
      pieces.map(function (a) { return '<button type="button" class="chipbtn' + (a.id === acc ? ' on' : '') + '" data-acc="' + esc(a.id) + '" aria-pressed="' + (a.id === acc) + '">' + esc(a.name) + '</button>'; }).join('') + '</div>' : '';
    R.openSheet('fitting', 'The fitting room', 'Petal & Thread · try on anything', 'checkroom',
      '<p class="help" style="margin-top:0">Try on anything you like, Plus drops too. It is free and nothing changes until you choose Keep it.</p>' +
      '<div class="outfits" id="tryList">' + cards + '</div>' + accRow +
      (t ? '<div class="row"><button type="button" class="btn soft" id="tryOwn"><span class="ms">undo</span>Back to my own clothes</button></div>' : '') +
      '<p class="help">Your own outfits are free to wear, always. Leaving the boutique puts your own clothes back.</p>');
    var tl = doc.getElementById('tryList'); if (tl) tl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-try]'); if (!b) return; var id = b.dataset.try, tok = ++pickTok;
      R.chime('tap'); R.closeSheet();
      setTimeout(function () { /* the sheet steps aside first, so she is seen turning; anything that began meanwhile wins */
        if (tok !== pickTok || !here() || (R.busy && R.busy()) || (R.asleep && R.asleep())) return;
        R.tryOn(id);
      }, 260);
    });
    var ta = doc.getElementById('tryAcc'); if (ta) ta.addEventListener('click', function (e) { var b = e.target.closest('[data-acc]'); if (!b) return; R.chime('tap'); R.tryAcc(b.dataset.acc || null); openFitting(); });
    var own = doc.getElementById('tryOwn'); if (own) own.addEventListener('click', function () { pickTok++; R.chime('tap'); R.closeSheet(); setTimeout(function () { R.endTryOn(false); }, 260); });
  }
  B.openFitting = openFitting;

  /* ---------- the rails (Jamie, 22 Oct: "showcase whole range of clothes on the rack and we can click in to view the
   * outfits... some required cash purchase and some with heart point exchange... see the avatar dresses like on the screen") ----
   * Every outfit hangs here as its own picture (assets/room/boutique/rail-<id>.webp). Tapping one shows it on its hanger
   * beside her wearing it; Try it on dresses her in the room. What she has is hers and free; a Plus drop is part of Rhythme
   * Plus (the paid side); a new arrival is bought with hearts once all its pictures are drawn, and until then it says so. */
  var RAILPIC = 'assets/room/boutique/rail-';
  function railItems() {
    var mine = (R.OUTFITS || []).map(function (o) { return { id: o.id, name: o.name, note: o.note, kind: R.outfitLocked(o.id) ? 'plus' : (o.plus ? 'plus' : 'own'), wearable: true }; });
    var soon = ((LN && LN.RAIL) || []).map(function (o) { return { id: o.id, name: o.name, note: o.note, kind: 'hearts', cost: o.cost, wearable: !!o.ready }; });
    return mine.concat(soon);
  }
  B.railItems = railItems;
  function openRail() {
    if (!here() || (R.asleep && R.asleep()) || !open_()) { if (LN && LN.openPlace) LN.openPlace('boutique'); return; }
    var wear = R.wearing(), items = railItems();
    var tile = function (it) {
      return '<button type="button" class="railtile ' + it.kind + (it.id === wear ? ' on' : '') + '" data-item="' + esc(it.id) + '" aria-label="' + esc(it.name) + ', ' + esc(railTag(it, wear)) + '">' +
        '<img src="' + RAILPIC + esc(it.id) + '.webp" alt="" loading="lazy"><b>' + esc(it.name) + '</b><small>' + (it.kind === 'hearts' ? '<span class="ms fill">favorite</span>' : it.kind === 'plus' ? '<span class="ms">auto_awesome</span>' : '') + esc(railTag(it, wear)) + '</small></button>';
    };
    var own = items.filter(function (it) { return it.kind !== 'hearts'; }), fresh = items.filter(function (it) { return it.kind === 'hearts'; });
    R.openSheet('rail', 'The rails', 'Petal & Thread · every outfit', 'apparel',
      '<p class="help" style="margin-top:0">Tap anything to see it on its hanger and on you. Trying on is free and changes nothing.</p>' +
      '<div class="railgrid" id="railGrid">' + own.map(tile).join('') + '</div>' +
      (fresh.length ? '<p class="shelf"><span class="ms">new_releases</span>New arrivals</p><div class="railgrid" id="railNew">' + fresh.map(tile).join('') + '</div>' : ''));
    ['railGrid', 'railNew'].forEach(function (gid) { var g = doc.getElementById(gid); if (g) g.addEventListener('click', function (e) { var b = e.target.closest('[data-item]'); if (!b) return; R.chime('tap'); openItem(b.dataset.item); }); });
  }
  B.openRail = openRail;
  function openItem(id) {
    if (!here() || (R.asleep && R.asleep()) || !open_()) { if (LN && LN.openPlace) LN.openPlace('boutique'); return; }
    var it = railItems().filter(function (x) { return x.id === id; })[0]; if (!it) { openRail(); return; }
    /* on her: her own sprite when the outfit is wearable; a new arrival shows its preview picture (drawn on her, standing)
       until the rest of her pictures in it exist */
    var wear = R.wearing(), onHer = it.wearable ? '<img class="railher" src="' + ART + 'avatar-' + esc(it.id) + '.webp" alt="You wearing ' + esc(it.name) + '">' :
      '<img class="railher" src="' + RAILPIC.replace('rail-', 'preview-') + esc(it.id) + '.webp" alt="You wearing ' + esc(it.name) + '" data-preview="1">';
    var act = it.id === wear ? '<p class="help"><span class="ms">check</span> You are wearing this.</p>' :
      it.wearable ? '<div class="row"><button type="button" class="btn primary" id="itemTry"><span class="ms">checkroom</span>Try it on</button></div>' +
        (it.kind === 'plus' ? '<p class="help">Part of Rhythme Plus. Trying it on is free.</p>' : '<p class="help">Yours to wear, free, always.</p>') :
      '<div class="row"><button type="button" class="btn soft" disabled><span class="ms fill">favorite</span>' + it.cost + ' hearts · arriving soon</button></div><p class="help">A first look at her in it. It can be bought with hearts once every picture of her in it is drawn: walking, sitting, sleeping and the rest.</p>';
    R.openSheet('railitem', it.name, 'Petal & Thread · ' + railTag(it, wear), 'apparel',
      '<div class="railview"><figure><img src="' + RAILPIC + esc(it.id) + '.webp" alt="' + esc(it.name) + ' on its hanger"><figcaption>On the hanger</figcaption></figure><figure>' + onHer + '<figcaption>On you</figcaption></figure></div>' +
      '<p class="railnote">' + esc(it.note || '') + '</p>' + act +
      '<div class="row"><button type="button" class="btn ghost" id="itemBack"><span class="ms">arrow_back</span>Back to the rails</button></div>');
    var pv = doc.querySelector('.railview img[data-preview]'); if (pv) pv.addEventListener('error', function () { var d = doc.createElement('div'); d.className = 'railher soon'; d.innerHTML = '<span class="ms">brush</span><small>Her pictures in this are still being drawn</small>'; if (pv.parentNode) pv.parentNode.replaceChild(d, pv); });
    var tb = doc.getElementById('itemTry'); if (tb) tb.addEventListener('click', function () {
      var tok = ++pickTok; R.chime('tap'); R.closeSheet();
      setTimeout(function () { if (tok !== pickTok || !here() || (R.busy && R.busy()) || (R.asleep && R.asleep())) return; R.tryOn(it.id); }, 260); /* she is seen turning into it */
    });
    var bk = doc.getElementById('itemBack'); if (bk) bk.addEventListener('click', function () { R.chime('tap'); openRail(); });
  }
  B.openItem = openItem;

  /* the bar over the room while she tries something on: what it is, and Keep it or Part of Rhythme Plus, Try another, and
   * Back to my own clothes */
  var bar = null;
  function renderBar(t) {
    var sc = R.els && R.els.scene; if (!sc) return;
    if (!bar) { bar = doc.createElement('div'); bar.className = 'trybar'; bar.id = 'tryBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Trying on'); sc.appendChild(bar);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tb]'); if (!b) return; var act = b.dataset.tb, cur = R.tryingOn(); R.chime('tap');
        if (act === 'own') { pickTok++; R.endTryOn(false); return; }
        if (act === 'more') { openFitting(); return; }
        if (act === 'plus') { plusOffer(cur ? cur.outfit : null); return; }
        if (act === 'keep') { var r = R.keepTryOn(); if (!r.ok) { if (r.plus) plusOffer(cur ? cur.outfit : null); else R.toast(r.why, 'info'); return; } R.chime('save'); R.toast(outfitName(r.id) + ' is what you wear now.', 'checkroom'); }
      });
    }
    if (!t) { bar.classList.remove('on'); bar.innerHTML = ''; return; }
    var own = t.outfit === t.saved && t.acc === R.savedAcc();
    bar.innerHTML = '<span class="ms" aria-hidden="true">checkroom</span><span class="tbname">Trying on <b>' + esc(outfitName(t.outfit)) + '</b></span>' +
      (own ? '' : t.mine ? '<button type="button" data-tb="keep"><span class="ms">check</span>Keep it</button>' : '<button type="button" class="tbplus" data-tb="plus"><span class="ms">auto_awesome</span>Part of Rhythme Plus</button>') +
      '<button type="button" data-tb="more"><span class="ms">checkroom</span>Try another</button><button type="button" data-tb="own"><span class="ms">undo</span>My own clothes</button>';
    bar.classList.add('on');
  }

  /* the accessory layer: one picture over her standing sprite, placed for that sprite; hidden while she walks, turns or poses */
  var accEl = null;
  function renderAcc() {
    var av = R.els && R.els.avatar; if (!av) return;
    var t = R.tryingOn(), a = byId(t ? t.acc : R.savedAcc()), key = R.spriteKey ? R.spriteKey() : null, p = a ? spotFor(a, key, R.wearing()) : null;
    if (!p) { if (accEl) accEl.classList.remove('on'); return; }
    if (!accEl) { accEl = doc.createElement('img'); accEl.className = 'acc'; accEl.alt = ''; accEl.setAttribute('aria-hidden', 'true'); av.appendChild(accEl); }
    var bx = boxFor(R.fitFor(key), p);
    if (accEl.getAttribute('src') !== ART + a.img) accEl.src = ART + a.img;
    accEl.style.setProperty('--acc-l', bx.l + '%'); accEl.style.setProperty('--acc-lf', bx.lf + '%'); accEl.style.setProperty('--acc-t', bx.t + '%'); accEl.style.setProperty('--acc-w', bx.w + '%'); accEl.style.setProperty('--acc-r', bx.rot + 'deg');
    accEl.classList.add('on');
  }
  B.renderAcc = renderAcc;

  R.on('tryon', function (t) { renderBar(t); renderAcc(); });
  R.on('layout', function () { renderAcc(); });
  if (R.els && R.els.avatarImg) R.els.avatarImg.addEventListener('load', renderAcc);
  R.on('boot', renderAcc);
})(typeof window !== 'undefined' ? window : this);
