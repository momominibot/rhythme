/* Appearance preference only. Premium styling is a reviewable preview until a
   trusted account/purchase verifier exists; browser storage never grants access. */
(function(){
 'use strict';
 function nickname(){var node=document.getElementById('profile-nickname');if(!node)return;try{var raw=localStorage.getItem('ovuluna_preferences_v1');if(raw===null){node.textContent='';return;}var record=JSON.parse(raw);if(!record||typeof record!=='object'||Array.isArray(record)||(record.version!==undefined&&record.version!==1)||(record.nickname!==undefined&&(typeof record.nickname!=='string'||record.nickname.length>40||/[\u0000-\u001f\u007f]/.test(record.nickname))))throw Error('format');node.textContent=record.nickname?'Hello, '+record.nickname+'.':'';}catch(_){node.textContent='Saved nickname unavailable. Review local preferences.';}}
 nickname();window.addEventListener('pageshow',nickname);window.addEventListener('storage',function(e){if(e.key===null||e.key==='ovuluna_preferences_v1')nickname();});
 var picker=document.getElementById('personaPicker'),note=document.getElementById('persona-status'),current='bloom';
 var valid=['bloom','grow','nurture','wisdom'];
 try {var saved=localStorage.getItem('ovuluna_persona');if(valid.includes(saved))current=saved;}catch(_){}
 function show(value){document.documentElement.dataset.persona=value;picker.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.persona===value));});}
 show(current);
 picker.querySelectorAll('button').forEach(function(button){button.addEventListener('click',function(){current=button.dataset.persona;show(current);try{localStorage.setItem('ovuluna_persona',current);note.textContent='Your appearance preference is saved on this browser.';}catch(_){note.textContent='Your look changed for this visit. Browser storage is unavailable.';}});});
 document.querySelectorAll('[data-chapter-art]').forEach(function(img){var fallback=img.getAttribute('src'),url=window.DREAM_ASSETS && window.DREAM_ASSETS[img.dataset.chapterArt];if(!url)return;img.addEventListener('error',function(){if(img.getAttribute('src')!==fallback)img.src=fallback;});img.src=url;});
 var preview=document.getElementById('annual-preview'),open=document.getElementById('preview-annual'),close=document.getElementById('close-annual');
 open.addEventListener('click',function(){if(typeof preview.showModal==='function'){preview.showModal();close.focus();}else{note.textContent='This browser cannot show the preview dialog. The Premium page describes the design.';}});
 close.addEventListener('click',function(){preview.close();});
 preview.addEventListener('close',function(){open.focus({preventScroll:true});});
 preview.addEventListener('click',function(e){if(e.target!==preview)return;var b=preview.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)preview.close();});
})();
