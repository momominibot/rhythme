/* Rhythme — app navigation + interaction layer (loaded on every screen) */
(function(){
  // ---- inject self-contained CSS (works even if a screen skips anim.css) ----
  var css = `
  .rip{position:absolute;border-radius:50%;transform:scale(0);background:rgba(110,70,84,.16);pointer-events:none;animation:rip .6s ease-out;z-index:3}
  @keyframes rip{to{transform:scale(2.6);opacity:0}}
  .otoast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%) translateY(10px);background:rgba(46,34,30,.92);
    color:#F6EDF0;padding:9px 17px;border-radius:99px;font:700 12px var(--sans,sans-serif);z-index:80;opacity:0;transition:.25s;pointer-events:none}
  `;
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  // ---- Rhythme alignment: the room's header, five tabs and theme on every older page ----
  (function(){
    function align(){
      try {
        if(!document.querySelector('link[href*="rhythme-legacy.css"]')){ var l=document.createElement('link'); l.rel='stylesheet'; l.href='rhythme-legacy.css'; document.head.appendChild(l); }
        if(!document.querySelector('link[href*="Material+Symbols"]')){ var m=document.createElement('link'); m.rel='stylesheet'; m.href='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block'; document.head.appendChild(m); }
        if(!document.querySelector('link[href*="family=Newsreader"]')){ var f=document.createElement('link'); f.rel='stylesheet'; f.href='https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Manrope:wght@400;600;700;800&display=swap'; document.head.appendChild(f); }
        var top=document.querySelector('.top');
        if(top){ top.setAttribute('data-dream-skip',''); var bl=top.querySelector('.brandline'); if(bl) bl.innerHTML='<a class="rh-brand" href="room.html" aria-label="Rhythme, back to your room"><img class="rh-logo" src="assets/brand/logo-mark.webp" alt="" width="26" height="26">RHYTHME</a>'; }
        var nav=document.querySelector('nav.nav, nav.bottom-nav');
        if(nav && !nav.dataset.rhythme){
          nav.setAttribute('data-dream-skip',''); nav.dataset.rhythme='1'; nav.className='nav'; nav.setAttribute('aria-label','Main');
          nav.innerHTML=[['room.html','home','Home'],['room.html#food','restaurant','Food'],['room.html#mind','self_improvement','Mind'],['room.html#you','person','You']].map(function(t,i){ return '<a href="'+t[0]+'"'+(i===0?' class="on" aria-current="true"':'')+'><span class="ms">'+t[1]+'</span>'+t[2]+'</a>'; }).join('');
        }
        document.querySelectorAll('a.learning-back').forEach(function(a){ var h=a.getAttribute('href')||''; if(h==='home.html'||/Knowledge Hub/.test(a.textContent)){ a.setAttribute('href','room.html#learn'); a.textContent='← Back to your desk'; } });
      } catch(e){}
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', align); else align();
  })();

  var here=(location.pathname.split('/').pop()||'index.html');

  // ---- back buttons: history.back with home fallback ----
  document.querySelectorAll('.t-icon').forEach(function(a){
    if(/arrow_back/.test((a.textContent||''))){
      var h=a.getAttribute('href');
      if(!h || h==='#'){ a.addEventListener('click',function(e){ e.preventDefault();
        if(history.length>1) history.back(); else location.href='room.html'; }); }
    }
  });

  // ---- home domain names/legend → domain detail screens ----
  var DOMAP={medical:'reports.html',cycle:'room.html#cycle',stress:'stress.html',exercise:'room.html#move',diet:'room.html#food',sleep:'sleep.html',mind:'room.html#mind',mindfulness:'room.html#mind'};
  document.querySelectorAll('.scroll span, .metric').forEach(function(el){
    // Text inside a real control belongs to that control. Binding a second
    // route to its label can hijack check-in dialogs when the label is tapped.
    if(el.closest('a,button,input,select,textarea,summary,[role="button"],[data-checkin]')) return;
    var t=(el.textContent||'').trim().toLowerCase();
    if(DOMAP[t] && DOMAP[t]!==here){ el.style.cursor='pointer';
      el.addEventListener('click',function(ev){ ev.stopPropagation(); location.href=DOMAP[t]; }); }
  });

  // ---- ripple on tappables ----
  function ripple(e){
    var el=e.currentTarget, r=document.createElement('span'); r.className='rip';
    var b=el.getBoundingClientRect(), d=Math.max(b.width,b.height);
    r.style.width=r.style.height=d+'px';
    r.style.left=((e.clientX||b.left+b.width/2)-b.left-d/2)+'px';
    r.style.top=((e.clientY||b.top+b.height/2)-b.top-d/2)+'px';
    if(getComputedStyle(el).position==='static') el.style.position='relative';
    var oo=el.style.overflow; el.style.overflow='hidden'; el.appendChild(r);
    setTimeout(function(){ r.remove(); el.style.overflow=oo; },600);
  }
  document.querySelectorAll('.btn, .chip, .g-card, .day, .tab').forEach(function(el){ el.addEventListener('click',ripple); });

  // ---- smart-route common dead #-links to real screens by their text/icon ----
  var ROUTES=[
    [/view insights|see insights|ai insight|insights/i,'room.html'],
    [/notification/i,'notifications.html'],
    [/calendar_today|calendar|history|cycle status/i,'room.html#cycle'],
    [/log today|log flow|log your|edit_note/i,'room.html#cycle'],
    [/fertile|ovulation|conceive/i,'fertility.html'],
    [/hormone/i,'hormones.html'],
    [/sleep/i,'sleep.html'],
    [/stress|breathing|calm/i,'stress.html'],
    [/mindful|meditation|erin|pause/i,'room.html#mind'],
    [/exercise|workout|training|fitness/i,'room.html#mind'],
    [/food|meal|nutrition|diet/i,'room.html#food'],
    [/supplement/i,'room.html#food'],
    [/hydrat/i,'hydration.html'],
    [/lab|marker|report|amh|fsh/i,'reports.html'],
    [/longevity|roadmap|milestone/i,'room.html'],
    [/bio-age|recalc/i,'room.html'],
    [/premium|upgrade|unlock/i,'premium.html'],
    [/privacy|security|data/i,'privacy.html'],
    [/setting|preferences/i,'settings.html'],
    [/medication|contracept/i,'meds.html'],
    [/period ended|period start/i,'period-start.html'],
    [/measure|scan|pulse|ppg/i,'ppg.html'],
    [/profile|account/i,'room.html#you'],
    [/community|circle|discussion/i,'community.html']
  ];
  function toast(m){ var t=document.createElement('div'); t.className='otoast'; t.textContent=m; document.body.appendChild(t);
    requestAnimationFrame(function(){ t.style.opacity='1'; t.style.transform='translateX(-50%)'; });
    setTimeout(function(){ t.style.opacity='0'; setTimeout(function(){ t.remove(); },260); },1300); }
  document.querySelectorAll('a[href="#"]').forEach(function(a){
    // read visible label only — exclude .ms icon ligatures ("stop_circle" was matching /circle/ → community!)
    var clone=a.cloneNode(true);
    clone.querySelectorAll('.ms,.n-ic,.material-symbols-outlined').forEach(function(ic){ ic.remove(); });
    var txt=((clone.textContent||'')+' '+(a.getAttribute('aria-label')||'')).toLowerCase().trim();
    var dest=null;
    for(var i=0;i<ROUTES.length;i++){ if(ROUTES[i][0].test(txt)){ dest=ROUTES[i][1]; break; } }
    if(dest && dest!==here){ a.setAttribute('href',dest); return; }   // real link now
    a.addEventListener('click',function(e){ e.preventDefault(); toast('Coming soon ✦'); });
  });

  // ---- auto-animate charts: draw lines/paths, grow bars, rise areas ----
  function animateCharts(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('svg').forEach(function(svg){
      // Component-owned charts manage their own final/progress state.
      if(svg.closest('#mysticalRingSvg, #hormone-plot, [data-no-auto-animation]')) return;
      // line/curve paths & polylines (strokes with no/solid fill) → draw-on
      svg.querySelectorAll('polyline, path, line').forEach(function(el){
        var stroke=el.getAttribute('stroke'); var fill=(el.getAttribute('fill')||'').toLowerCase();
        if(!stroke || stroke==='none') return;
        if(el.hasAttribute('stroke-dasharray')) return;         // dashed = decorative, skip
        var len; try{ len=el.getTotalLength(); }catch(e){ return; }
        if(!len || len<8) return;
        var solidFill = fill && fill!=='none' && fill!=='transparent';
        if(solidFill){ el.classList.add('anim-area'); el.style.animationDelay='.1s'; return; } // filled area
        el.style.strokeDasharray=len; el.style.strokeDashoffset=len;
        el.classList.add('anim-line');
        // Some legacy pages omit anim.css. Never leave a prepared stroke hidden.
        if(getComputedStyle(el).animationName === 'none') el.style.strokeDashoffset='0';
      });
      // bars: rects that look like columns (taller-ish or in a chart-frame)
      var inChart = svg.closest('.chart-frame') || svg.closest('.card');
      svg.querySelectorAll('rect').forEach(function(r,i){
        var w=+r.getAttribute('width')||0, h=+r.getAttribute('height')||0;
        if(!h || h<6) return; if(w>h*3) return;                  // skip wide background rects
        if(!inChart && h<20) return;
        r.classList.add('anim-bar'); r.style.animationDelay=(0.15+i*0.05)+'s';
        // set transform-origin to the bar's own base
        var y=+r.getAttribute('y')||0; r.style.transformOrigin=(( +r.getAttribute('x')||0)+w/2)+'px '+(y+h)+'px';
        r.style.transformBox='fill-box';
      });
    });
  }
  animateCharts();

  // ---- draw SVG rings in on load ----
  document.querySelectorAll('svg circle[stroke-dasharray], svg path[stroke-dasharray]').forEach(function(c){
    if(c.closest('#mysticalRingSvg, #hormone-plot, #countdownRing, [data-no-auto-animation]')) return;
    var len=parseFloat((c.getAttribute('stroke-dasharray')||'').split(' ')[0]); if(!len) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){c.style.strokeDashoffset='0';return;}
    c.style.strokeDashoffset=len; c.getBoundingClientRect();
    c.style.transition='stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)';
    setTimeout(function(){ c.style.strokeDashoffset='0'; }, 250);
  });

  // ---- the room is the homepage: point nav Home links at it ----
  document.querySelectorAll('.nav a[href="home.html"], nav a[href="home.html"], .brandline').forEach(function(a){ if(a.tagName==='A') a.setAttribute('href','room.html'); else a.onclick=function(){ location.href='room.html'; }; });

  // ---- count-up any element with data-count ----
  document.querySelectorAll('[data-count]').forEach(function(el){
    var raw=el.getAttribute('data-count'), target=parseFloat(raw); if(isNaN(target)) return;
    var suf=el.getAttribute('data-suffix')||'', dec=(raw.indexOf('.')>-1)?1:0, dur=1000, s=null;
    var reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    if(reducedMotion.matches){el.textContent=target.toFixed(dec)+suf;return;}
    function step(ts){ if(reducedMotion.matches){el.textContent=target.toFixed(dec)+suf;return;} if(!s)s=ts; var p=Math.min((ts-s)/dur,1), e=1-Math.pow(1-p,3);
      el.textContent=(p<1?(target*e).toFixed(dec):target.toFixed(dec))+suf; if(p<1)requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });

  /* The "all screens" launcher was removed on 18 Oct 2026: the room is the app, the old screens redirect into it. */
})();

/* PWA on every page: manifest, home-screen icon and the service worker (offline shell + reminder notifications) */
(function(){ try { if (!document.querySelector('link[rel="manifest"]')) { var l=document.createElement('link'); l.rel='manifest'; l.href='manifest.webmanifest'; document.head.appendChild(l); } if (!document.querySelector('link[rel="apple-touch-icon"]')) { var t=document.createElement('link'); t.rel='apple-touch-icon'; t.href='assets/icons/apple-touch-icon.png'; document.head.appendChild(t); } if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function(){}); } catch(e){} })();

/* Rhythme asks for the data notice in the room first (the same check as the end of ovu-store.js, for pages that do not load it): a first-time visitor, anyone whose consent is older than notice 3, anyone who has not confirmed 18+, or an unreadable record, is sent there. Keep the 3 in step with OvuStore.NOTICE_V. */
(function () { function wrongOwner(db, sn) { var p = (db && db.profile) || {}, o = typeof p.owner === 'string' ? (p.owner || null) : ((p.cloud && p.cloud.uid) || ((p.consentEvents || []).filter(function (e) { return e && e.uid; })[0] || {}).uid || null), u = sn && sn.user && sn.user.id; return !!(o && u && o !== u); } /* the room shows which account this diary belongs to (persona walks, 21 Oct) */ function gate() { try { var pg = location.pathname.split('/').pop() || 'index.html'; if (/^(room|privacy|terms|index|404)\.html$/.test(pg)) return; var db = JSON.parse(localStorage.getItem('ovumind_db_v1') || 'null'), c = db && db.profile && db.profile.consent, a = db && db.profile && db.profile.ageAttest, sn = JSON.parse(localStorage.getItem('ovumind_auth_v1') || 'null'); if (!(sn && sn.access_token) || wrongOwner(db, sn) || !(c && c.at && c.v >= 5 && a && a.confirmed === true)) location.replace('room.html'); } catch (e) { try { location.replace('room.html'); } catch (e2) { } } } gate(); try { window.addEventListener('storage', function (e) { if (!e || e.key === null || e.key === 'ovumind_auth_v1' || e.key === 'ovumind_db_v1') gate(); }); window.addEventListener('pageshow', function (e) { if (e && e.persisted) gate(); }); } catch (e) { } })(); /* a sign-out or a wipe in another tab closes this page too (Codex, 21 Oct) */
