/* Ovuluna — floating mascot companion (loaded on every screen) */
(function(){
  if(document.querySelector('.ovmascot')) return;
  var css=`
  .ovmascot{position:fixed;right:11px;bottom:80px;z-index:55;width:76px;height:76px;cursor:pointer;
    animation:ovFloat 4.2s ease-in-out infinite;filter:drop-shadow(0 9px 12px rgba(110,70,84,.3))}
  @keyframes ovFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  .ovmascot img{width:100%;height:100%;object-fit:contain;display:block;pointer-events:none}
  .ovmascot .ovx{position:absolute;top:-1px;right:-1px;width:19px;height:19px;border-radius:50%;background:rgba(46,34,30,.72);color:#fff;display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;cursor:pointer;opacity:.5;transition:.15s;z-index:3}
  .ovmascot .ovx:hover{opacity:1;transform:scale(1.12)}
  .ovrestore{position:fixed;right:14px;bottom:88px;z-index:54;width:36px;height:36px;border-radius:50%;overflow:hidden;background:#fff;border:1.5px solid var(--line-soft,#EADFD6);box-shadow:0 6px 16px -6px rgba(110,70,84,.4);cursor:pointer;display:none;padding:0;opacity:.8}
  .ovrestore img{width:100%;height:100%;object-fit:contain}
  .ovrestore.on{display:block}
  .ovmascot:active{transform:scale(.92)}
  .ovbub{position:fixed;right:94px;bottom:110px;z-index:55;max-width:214px;background:#fff;color:var(--ink,#2E2622);
    padding:11px 14px;border-radius:16px 16px 3px 16px;font:600 12.5px var(--sans,sans-serif);line-height:1.4;cursor:pointer;
    box-shadow:0 12px 30px -8px rgba(110,70,84,.45);opacity:0;transform:translateY(8px) scale(.88);transform-origin:bottom right;transition:.35s cubic-bezier(.34,1.56,.64,1)}
  .ovbub.on{opacity:1;transform:none}
  .ovbub::after{content:"";position:absolute;right:-6px;bottom:8px;width:12px;height:12px;background:#fff;transform:rotate(45deg);border-radius:0 0 3px 0}
  .ovveil{position:fixed;inset:0;z-index:60;background:rgba(46,34,30,.5);backdrop-filter:blur(4px);display:none;align-items:flex-end}
  .ovveil.on{display:flex;animation:ovFade .25s ease}
  @keyframes ovFade{from{opacity:0}to{opacity:1}}
  .ovsheet{width:100%;max-width:460px;margin:0 auto;background:var(--paper,#FAF3F0);border-radius:26px 26px 0 0;
    padding:8px 18px calc(22px + env(safe-area-inset-bottom));max-height:88vh;overflow-y:auto;animation:ovUp .38s cubic-bezier(.22,1,.36,1)}
  @keyframes ovUp{from{transform:translateY(100%)}to{transform:none}}
  .ovgrab{width:40px;height:4px;border-radius:99px;background:var(--line,#EADFD6);margin:6px auto 12px}
  .ovhead{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .ovhead .orb{width:56px;height:56px;flex-shrink:0;filter:drop-shadow(0 4px 8px rgba(110,70,84,.25))}
  .ovhead .orb img{width:100%;height:100%;object-fit:contain}
  .ovhead b{font-family:var(--serif,serif);font-weight:500;font-size:21px;color:var(--mauve,#6E4654);display:block}
  .ovhead span{font-size:12px;color:var(--taupe,#9A8B7E)}
  .ovchips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px}
  .ovchip{flex-shrink:0;display:flex;align-items:center;gap:5px;padding:9px 14px;border-radius:99px;border:1.5px solid var(--line-soft,#EADFD6);
    background:var(--card-solid,#fff);font:700 12.5px var(--sans,sans-serif);color:var(--taupe,#9A8B7E);cursor:pointer;transition:.15s}
  .ovchip .ms{font-size:16px}
  .ovchip.on{background:var(--mauve,#6E4654);color:#F6EDF0;border-color:var(--mauve,#6E4654)}
  .ovpane{min-height:150px}
  .ovcard{background:var(--card-solid,#fff);border:1.5px solid var(--line-soft,#EADFD6);border-radius:18px;padding:18px;text-align:center}
  .ovglasses{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin:12px 0}
  .ovglasses i{width:26px;height:34px;border-radius:5px 5px 9px 9px;border:2px solid var(--d-sleep,#7FAEC9);cursor:pointer;position:relative;overflow:hidden;transition:.2s}
  .ovglasses i.full{background:linear-gradient(0deg,#7FAEC9,#BBDBFC)}
  .ovbtn{display:inline-flex;align-items:center;gap:6px;padding:11px 20px;border-radius:99px;border:none;cursor:pointer;
    background:var(--mauve,#6E4654);color:#F6EDF0;font:700 13.5px var(--sans,sans-serif);transition:.15s}
  .ovbtn.ghost{background:var(--card-solid,#fff);color:var(--mauve,#6E4654);border:1.5px solid var(--line-soft,#EADFD6)}
  .ovbtn:active{transform:scale(.95)}
  .ovbreath{width:120px;height:120px;border-radius:50%;margin:6px auto 10px;
    background:radial-gradient(circle,rgba(218,206,246,.7),rgba(233,168,196,.4));display:flex;align-items:center;justify-content:center;
    font:700 13px var(--sans,sans-serif);color:var(--mauve,#6E4654);transition:transform 4s ease-in-out}
  .ovmoods{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;margin:14px 0 6px;padding-top:8px;overflow:visible}
  .ovmoods button{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;padding:4px 0;cursor:pointer;transition:.18s;min-width:0;overflow:visible}
  .ovmoods button img{width:52px;height:52px;object-fit:contain;filter:drop-shadow(0 3px 6px rgba(110,70,84,.2));transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
  .ovmoods button span{font:700 10.5px var(--sans,sans-serif);color:var(--taupe,#9A8B7E);transition:.15s;text-align:center;white-space:nowrap}
  .ovmoods button:hover img{transform:translateY(-3px)}
  @keyframes ovMoodPop{0%{transform:scale(1)}55%{transform:scale(1.28) translateY(-4px)}100%{transform:scale(1.14) translateY(-3px)}}
  .ovmoods button.on img{transform:scale(1.14) translateY(-3px);animation:ovMoodPop .45s cubic-bezier(.34,1.56,.64,1)}
  .ovmoods button.on span{color:var(--mauve,#6E4654);font-weight:800}
  .ovmoods button:not(.on).dim{opacity:.45}
  .ovask{display:flex;gap:8px;margin-top:10px}
  .ovask input{flex:1;border:1.5px solid var(--line-soft,#EADFD6);border-radius:99px;padding:11px 15px;font:500 14px var(--sans,sans-serif);color:var(--ink,#2E2622);outline:none;background:var(--card-solid,#fff)}
  .ovask input:focus{border-color:var(--sage,#9FA78F)}
  .ovask button{width:44px;height:44px;border-radius:50%;border:none;background:var(--coral,#FF8C78);color:#42160C;cursor:pointer;flex-shrink:0}
  .ovchat{max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
  .ovmsg{max-width:82%;padding:9px 13px;border-radius:15px;font:500 13px var(--sans,sans-serif);line-height:1.4}
  .ovmsg.u{align-self:flex-end;background:var(--mauve,#6E4654);color:#F6EDF0;border-bottom-right-radius:4px}
  .ovmsg.o{align-self:flex-start;background:var(--card-solid,#fff);border:1.5px solid var(--line-soft,#EADFD6);color:var(--ink,#2E2622);border-bottom-left-radius:4px}
  .ovfoot{text-align:center;font:600 11px var(--sans,sans-serif);color:var(--taupe,#9A8B7E);margin-top:14px;display:flex;align-items:center;justify-content:center;gap:5px}
  `;
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  var PNG='assets/mascot/mascot-cutout.png';
  function orbHTML(){ return '<img src="'+PNG+'" alt="Ovuluna"/>'; }

  // hidden preference
  var HIDDEN=false; try{ HIDDEN=localStorage.getItem('ov_mascot_hide')==='1'; }catch(e){}

  // floating mascot (+ dismiss cross)
  var fab=document.createElement('div'); fab.className='ovmascot'; fab.setAttribute('aria-label','Ovuluna companion');
  fab.innerHTML=orbHTML()+'<span class="ovx" aria-label="Hide Ovuluna">✕</span>';
  document.body.appendChild(fab);

  // small restore button (shown when hidden)
  var restore=document.createElement('button'); restore.className='ovrestore'; restore.setAttribute('aria-label','Show Ovuluna');
  restore.innerHTML='<img src="'+PNG+'" alt=""/>'; document.body.appendChild(restore);

  function hideMascot(){ HIDDEN=true; fab.style.display='none'; bub.classList.remove('on'); restore.classList.add('on');
    try{ localStorage.setItem('ov_mascot_hide','1'); }catch(e){} }
  function showMascot(){ HIDDEN=false; fab.style.display=''; restore.classList.remove('on'); try{ localStorage.setItem('ov_mascot_hide','0'); }catch(e){} }
  fab.querySelector('.ovx').addEventListener('click',function(e){ e.stopPropagation(); hideMascot(); });
  restore.addEventListener('click',showMascot);
  if(HIDDEN){ fab.style.display='none'; restore.classList.add('on'); }

  // random pop-ups from Ovuluna (gentle nudges + jokes) triggered as you scroll
  var NUDGES=['Psst… time for some water? 💧','Take one deep breath with me? 🌬️','How are you feeling today? 💛','You\'re doing lovely today ✨','Little reminder: unclench your jaw & drop your shoulders 😌','Have you moved your body today? A stretch counts 🧘‍♀️'];
  var bub=document.createElement('div'); bub.className='ovbub'; document.body.appendChild(bub);
  bub.addEventListener('click',open);
  var lastMsg='';
  function popBubble(){
    if(HIDDEN || veil.classList.contains('on')) return;
    var pool=NUDGES.concat(JOKES||[]);
    var m; for(var k=0;k<6;k++){ m=pool[Math.floor(Math.random()*pool.length)]; if(m!==lastMsg) break; }
    lastMsg=m; bub.textContent=m; bub.classList.add('on');
    clearTimeout(bub._t); bub._t=setTimeout(function(){ bub.classList.remove('on'); }, m.length>60?6500:4500);
  }
  // scroll listener (throttled): pop after enough scrolling + a cool-down
  var lastPop=0, scrolled=0, lastY=0;
  function onScroll(y){ scrolled+=Math.abs(y-lastY); lastY=y; var now=Date.now();
    if(scrolled>620 && now-lastPop>13000){ lastPop=now; scrolled=0; popBubble(); } }
  window.addEventListener('scroll', function(){ onScroll(window.scrollY||document.documentElement.scrollTop||0); }, {passive:true});
  var _sc=document.querySelector('.scroll'); if(_sc){ _sc.addEventListener('scroll', function(){ onScroll(_sc.scrollTop); }, {passive:true}); }
  // one warm hello shortly after load
  setTimeout(function(){ if(!HIDDEN && !veil.classList.contains('on')){ bub.textContent='Hi, I\'m here whenever you need me 💛'; bub.classList.add('on'); clearTimeout(bub._t); bub._t=setTimeout(function(){bub.classList.remove('on');},4500);} }, 3200);

  // jokes — cheeky but tasteful
  var JOKES=[
    'Bloated today? Same. This week\'s outfit is elastic waistband and pure confidence. 🎈',
    'Your hormones called — they\'re doing their monthly group project again and nobody\'s on the same page. 😅',
    'Estrogen and progesterone walk into a bar and immediately fight over the thermostat. 🔥❄️',
    'Ovulation week: your body\'s like "let\'s make some questionable decisions." 😏',
    'Cramps are just your uterus doing hot yoga without asking your permission. 🧘‍♀️',
    'Your uterus is that dramatic roommate who redecorates once a month and makes it everyone\'s problem. 🩸',
    'Discharge is normal, babe — your body is self-cleaning. Fancier than most kitchens. ✨',
    'PMS: when you cry at a dog food advert and then fight someone over the last biscuit. 🍪',
    'Craving chocolate AND a nap AND a fight? Ah, the luteal phase trilogy. 🍫😴🥊'
  ];
  var ji=Math.floor(JOKES.length*0.3);

  var water=0, WGOAL=8;

  // panel
  var veil=document.createElement('div'); veil.className='ovveil';
  veil.innerHTML='<div class="ovsheet"><div class="ovgrab"></div>'
    +'<div class="ovhead"><div class="orb">'+orbHTML()+'</div><div><b>Hi, I\'m Ovuluna</b><span>Your cycle companion ✨</span></div></div>'
    +'<div class="ovchips" id="ovchips">'
    +'<div class="ovchip on" data-t="ask"><span class="ms">chat</span>Ask me anything</div>'
    +'<div class="ovchip" data-t="mood"><span class="ms">mood</span>Mood</div>'
    +'<div class="ovchip" data-t="water"><span class="ms">local_drink</span>Water</div>'
    +'<div class="ovchip" data-t="breathe"><span class="ms">air</span>Breathe</div>'
    +'</div><div class="ovpane" id="ovpane"></div>'
    +'<div class="ovfoot"><span class="ms" style="font-size:14px">widgets</span> Coming to your home-screen widget soon</div></div>';
  document.body.appendChild(veil);
  veil.addEventListener('click',function(e){ if(e.target===veil) close(); });

  var pane=veil.querySelector('#ovpane');
  function open(){ veil.classList.add('on'); render('ask'); }
  function close(){ veil.classList.remove('on'); }
  fab.addEventListener('click',open);
  veil.querySelectorAll('.ovchip').forEach(function(c){ c.addEventListener('click',function(){
    veil.querySelectorAll('.ovchip').forEach(function(x){x.classList.remove('on');}); c.classList.add('on'); render(c.dataset.t);
  });});

  function render(t){
    if(t==='water') renderWater();
    else if(t==='breathe') renderBreathe();
    else if(t==='mood') renderMood();
    else if(t==='ask') renderAsk();
  }

  function renderWater(){
    var g=''; for(var i=0;i<WGOAL;i++) g+='<i class="'+(i<water?'full':'')+'" data-i="'+i+'"></i>';
    var pct=Math.round(water/WGOAL*100);
    pane.innerHTML='<div class="ovcard"><div style="font-family:var(--serif);font-size:30px;color:var(--cocoa)">'+water+' <span style="font-size:15px;color:var(--taupe)">/ '+WGOAL+' glasses</span></div>'
      +'<div class="ovglasses">'+g+'</div>'
      +'<div style="height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin:4px 0 14px"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#7FAEC9,#BBDBFC);transition:.3s"></div></div>'
      +'<button class="ovbtn" id="ovAddW"><span class="ms">add</span> Log a glass</button> '
      +'<button class="ovbtn ghost" id="ovDelW">Undo</button>'
      +'<div class="ovfoot" style="margin-top:12px">'+(water>=WGOAL?'Goal smashed — hydration queen 👑':'Keep sipping, you\'ve got this 💧')+'</div></div>';
    pane.querySelectorAll('.ovglasses i').forEach(function(el){ el.onclick=function(){ water=(+el.dataset.i)+1; renderWater(); }; });
    pane.querySelector('#ovAddW').onclick=function(){ if(water<WGOAL)water++; renderWater(); };
    pane.querySelector('#ovDelW').onclick=function(){ if(water>0)water--; renderWater(); };
  }

  var breathTimer=null;
  function renderBreathe(){
    pane.innerHTML='<div class="ovcard"><div class="ovbreath" id="ovBr">Ready?</div>'
      +'<div class="ovfoot" style="margin:0 0 12px">4 · 7 · 8 breathing — follow the circle</div>'
      +'<button class="ovbtn" id="ovBrStart"><span class="ms">play_arrow</span> Start</button></div>';
    var circle=pane.querySelector('#ovBr');
    pane.querySelector('#ovBrStart').onclick=function(){
      if(breathTimer){ clearInterval(breathTimer); }
      var phases=[['Breathe in…',4,1.35],['Hold…',7,1.35],['Breathe out…',8,0.8]], p=0, left=phases[0][1];
      function apply(){ circle.textContent=phases[p][0]; circle.style.transition='transform '+phases[p][1]+'s ease-in-out'; circle.style.transform='scale('+phases[p][2]+')'; }
      apply();
      breathTimer=setInterval(function(){ left--; if(left<=0){ p=(p+1)%3; left=phases[p][1]; apply(); } },1000);
    };
  }

  var MOODS=[['rough','Rough'],['low','Low'],['okay','Okay'],['good','Good'],['amazing','Amazing']];
  function renderMood(){
    pane.innerHTML='<div class="ovcard"><div style="font:600 14.5px var(--sans);color:var(--ink);margin-bottom:2px">How are you feeling right now?</div>'
      +'<div class="ovmoods" id="ovMoods">'+MOODS.map(function(m){return '<button data-m="'+m[0]+'"><img src="assets/moods/'+m[0]+'.png" alt="'+m[1]+'"/><span>'+m[1]+'</span></button>';}).join('')+'</div>'
      +'<div class="ovfoot" id="ovMoodMsg" style="margin-top:6px">Tap the one that fits — it feeds your cycle mood chart</div></div>';
    var btns=pane.querySelectorAll('#ovMoods button');
    btns.forEach(function(b){ b.onclick=function(){
      btns.forEach(function(x){x.classList.remove('on');x.classList.add('dim');}); b.classList.add('on'); b.classList.remove('dim');
      var label=MOODS.filter(function(m){return m[0]===b.dataset.m;})[0][1];
      pane.querySelector('#ovMoodMsg').innerHTML='<b style="color:var(--mauve)">'+label+'</b> logged — thanks for checking in 💛';
    };});
  }

  function renderJoke(){
    ji=(ji+1)%JOKES.length;
    pane.innerHTML='<div class="ovcard"><span class="ms" style="font-size:30px;color:var(--terracotta)">sentiment_very_satisfied</span>'
      +'<p style="font:500 15px var(--sans);color:var(--ink);line-height:1.5;margin:10px 4px 16px">'+JOKES[ji]+'</p>'
      +'<button class="ovbtn" id="ovNextJoke"><span class="ms">refresh</span> Another one</button></div>';
    pane.querySelector('#ovNextJoke').onclick=renderJoke;
  }

  var chat=[];
  function reply(q){
    q=q.toLowerCase();
    if(/water|hydrat|drink/.test(q)) return 'Let\'s get you sipping 💧 Tap the Water tab and I\'ll track your glasses today.';
    if(/tired|exhaust|fatigue|sleep/.test(q)) return 'Sounds like your body wants rest. In the luteal phase that\'s totally normal — maybe an early night tonight? 😴';
    if(/cramp|pain|hurt/.test(q)) return 'Cramps are the worst. A warm compress, magnesium, and gentle movement can help — and I\'m logging it so we spot the pattern. 🩹';
    if(/sad|down|anxious|stress|cry/.test(q)) return 'I hear you 💛 Want to try a 4-7-8 breath with me? Tap Breathe. And remember — hormones amplify feelings, they don\'t invent your worth.';
    if(/joke|laugh|funny|cheer/.test(q)) return JOKES[(ji=(ji+1)%JOKES.length)];
    if(/hi|hey|hello/.test(q)) return 'Hey you ✨ How are you feeling today? I can track water, mood, breathing — or just make you laugh.';
    if(/fertile|ovulat|pregnan|conceive/.test(q)) return 'Your fertile window shows on the Cycle tab — egg-white discharge + a temp dip are your best signs. Want me to open it?';
    return 'Great question! I\'ll have the full AI answer for you once I\'m fully connected ✨ — for now I can log water, mood, breathing, and cheer you up.';
  }
  function renderAsk(){
    pane.innerHTML='<div class="ovchat" id="ovChat"></div>'
      +'<div class="ovask"><input id="ovIn" placeholder="Ask Ovuluna anything…"/><button id="ovSend"><span class="ms">arrow_upward</span></button></div>';
    var box=pane.querySelector('#ovChat');
    if(!chat.length) chat.push(['o','Ask me anything about your cycle, or tell me how you\'re doing 💛']);
    function paint(){ box.innerHTML=chat.map(function(m){return '<div class="ovmsg '+m[0]+'">'+m[1]+'</div>';}).join(''); box.scrollTop=box.scrollHeight; }
    paint();
    var inp=pane.querySelector('#ovIn');
    function send(){ var v=inp.value.trim(); if(!v) return; chat.push(['u',v]); inp.value=''; paint();
      setTimeout(function(){ chat.push(['o',reply(v)]); paint(); },500); }
    pane.querySelector('#ovSend').onclick=send;
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter') send(); });
    inp.focus();
  }
})();
