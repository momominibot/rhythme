/* Decorative enhancement only. Inputs, measurements, citations and SVG geometry
   are never changed. Native text labels remain the source of accessible names. */
(function () {
  'use strict';
  var icons = {
    home:'cycle-luteal',menu_book:'ovarian-age',auto_stories:'ovarian-age',acupuncture:'tcm',spa:'herbs',restaurant:'nutrition',person:'profile',notifications:'notifications',calendar_today:'cycle-period',calendar_month:'cycle-period',favorite:'partner',monitor_heart:'partner',bedtime:'sleep',water_drop:'hydration',directions_run:'exercise',fitness_center:'exercise',eco:'herbs',self_improvement:'stress',psychology:'stress',biotech:'labs',science:'labs',groups:'community',settings:'settings',air:'breath',local_florist:'herbs',wb_sunny:'cycle-ovulation'
  };
  var emojiMap = {'\ud83c\udf19':'cycle-luteal','\ud83c\udf11':'cycle-luteal','\ud83c\udf14':'cycle-fertile','\ud83c\udf15':'cycle-ovulation','\ud83c\udf18':'cycle-luteal','\u2600\ufe0f':'cycle-ovulation','\u2600':'cycle-ovulation','\ud83c\udf38':'persona-bloom','\ud83c\udf37':'persona-grow','\ud83c\udf3a':'persona-wisdom','\ud83c\udf3f':'herbs','\ud83c\udf43':'herbs','\ud83c\udf31':'cycle-fertile','\ud83d\udc9c':'partner','\ud83d\udc9b':'partner','\u2764\ufe0f':'partner','\ud83e\udef6':'partner','\u2728':'cycle-ovulation','\ud83c\udf1f':'cycle-ovulation','\u2b50':'cycle-ovulation','\ud83d\udcd6':'ovarian-age','\ud83d\udcda':'ovarian-age','\ud83e\uddea':'labs','\ud83d\udca7':'hydration','\ud83e\uded6':'tcm','\ud83c\udf75':'tcm','\ud83e\uddd8':'exercise','\ud83e\uddd8\u200d\u2640\ufe0f':'exercise','\ud83d\ude34':'sleep','\ud83c\udf7c':'persona-nurture','\ud83e\udd31':'persona-nurture','\ud83e\udd30':'persona-grow','\ud83e\udd57':'nutrition','\ud83c\udf7d\ufe0f':'nutrition','\ud83d\udd2c':'labs','\u23f3':'ovarian-age','\ud83d\udc8d':'persona-grow'};
  var pattern = /(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu;
  var artKeys={'persona-grow':'grow','persona-nurture':'nurture','persona-peri':'peri','persona-wisdom':'post','cycle-luteal':'peri'};
  var emojiNames={'\ud83c\udf19':'Moon','\u2600\ufe0f':'Sun','\u2600':'Sun','\u26a0\ufe0f':'Warning','\u26a0':'Warning','\u274c':'Close','\u2716\ufe0f':'Close','\ud83d\udd14':'Notifications','\ud83d\udcc5':'Calendar','\ud83d\udd0d':'Search','\ud83c\udfa8':'Appearance','\ud83d\udcac':'Messages','\u2139\ufe0f':'Information'};
  function upgradeArt(img,name) {
    var key=artKeys[name],url=key && window.DREAM_ASSETS && window.DREAM_ASSETS[key];
    if(!url || img.dataset.dreamArt)return;
    var fallback=img.getAttribute('src');img.dataset.dreamArt=key;
    img.addEventListener('error',function(){if(img.getAttribute('src')!==fallback)img.src=fallback;});img.src=url;
  }
  function image(name) { var img=document.createElement('img');img.className='dream-icon';img.src='assets/icons/'+name+'.png';img.alt='';img.setAttribute('aria-hidden','true');img.width=28;img.height=28;upgradeArt(img,name);return img; }
  function decorate(root) {
    if (!root || root.nodeType !== 1 || root.closest('script,style,textarea,input,select,option,svg,code,pre,.qi-source,.dream-icon,[data-dream-skip]')) return;
    root.querySelectorAll('img').forEach(function(img){var match=(img.getAttribute('src') || '').match(/assets\/icons\/(persona-(?:grow|nurture|peri|wisdom)|cycle-luteal)(?:-\d+)?\.png$/);if(match)upgradeArt(img,match[1]);});
    root.querySelectorAll('.ms,.n-ic,.material-symbols-outlined').forEach(function(node){
      if(node.dataset.dreamIcon || node.childElementCount || node.closest('[data-dream-skip]')) return;
      var key=node.textContent.trim(), name=icons[key];if(!name)return;
      // Keep aria names on icon-only controls before replacing the ligature.
      var parent=node.closest('button,a');if(parent && parent.textContent.trim()===key && !parent.hasAttribute('aria-label')) parent.setAttribute('aria-label',key.replace(/_/g,' '));
      node.dataset.dreamIcon=key;node.textContent='';node.classList.add('dream-symbol');node.appendChild(image(name));
    });
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){return n.parentElement && !n.parentElement.closest('script,style,textarea,input,select,option,svg,code,pre,.qi-source,.dream-symbol,[data-dream-skip]')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}}), nodes=[],node;
    while((node=walker.nextNode())) {pattern.lastIndex=0;if(pattern.test(node.textContent))nodes.push(node);}
    nodes.forEach(function(n){ var s=n.textContent,frag=document.createDocumentFragment(),last=0;pattern.lastIndex=0;var match;
      // Decorative art must not remove the name of an emoji-only control.
      var control=n.parentElement.closest('button,a');
      if(control && !control.hasAttribute('aria-label')) {var label=control.textContent.trim();pattern.lastIndex=0;if(label && label.replace(pattern,'').trim()==='')control.setAttribute('aria-label',emojiNames[label] || control.getAttribute('title') || 'Open details');}
      pattern.lastIndex=0;
      while((match=pattern.exec(s))) {frag.appendChild(document.createTextNode(s.slice(last,match.index)));var span=document.createElement('span');span.className='dream-symbol';span.setAttribute('aria-hidden','true');span.appendChild(image(emojiMap[match[0]] || 'cycle-luteal'));frag.appendChild(span);last=match.index+match[0].length;}
      frag.appendChild(document.createTextNode(s.slice(last)));n.replaceWith(frag);
    });
  }
  var route=location.pathname.split('/').pop() || 'index.html',section='home.html';
  if(/^(journey|life-journey|postpartum|exercise-guide|straw-calculator)/.test(route))section='home.html';

  else if(/^(food|nutrition|diet|medas|nutrient|supplement|hydration)/.test(route))section='foods.html';
  else if(/^(profile|premium|settings|privacy|personal-info|health-profile|partner|community|circle|login|onboarding|terms)/.test(route))section='room.html#you';
  document.querySelectorAll('.nav a').forEach(function(a){var active=a.getAttribute('href')===section;a.classList.toggle('on',active);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current',route===section?'page':'true');else a.removeAttribute('aria-current');});
  decorate(document.body);
  var pending=new Set(),queued=false;
  new MutationObserver(function(changes){changes.forEach(function(c){if(c.type==='characterData')pending.add(c.target.parentElement);else c.addedNodes.forEach(function(n){if(n.nodeType===1)pending.add(n);else if(n.nodeType===3)pending.add(n.parentElement);});});if(!queued){queued=true;requestAnimationFrame(function(){queued=false;var roots=Array.from(pending);pending.clear();roots.forEach(decorate);});}}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
