(function(){
 'use strict';
 var list=document.getElementById('source-list'),search=document.getElementById('source-search'),status=document.getElementById('source-status');
 if(!list)return;
 function render(){
  var query=search.value.trim().toLowerCase(),db=window.EVIDENCE_DB || {},count=0,seen=new Set();
  list.replaceChildren();
  Object.keys(db).sort().forEach(function(key){var entry=db[key],checked=entry.verification && entry.verification.status==='verified';if(status.value==='reviewed'&&!checked)return;if(query && !(key+' '+entry.claim+' '+entry.evidence).toLowerCase().includes(query))return;
   var identity=JSON.stringify([entry.claim,entry.sources || entry.source,entry.evidence]);if(seen.has(identity))return;seen.add(identity);
   var section=document.createElement('section');section.className='chapter-card';var button=document.createElement('button');button.type='button';button.className='qi';button.dataset.evidence=key;button.textContent='i';button.setAttribute('aria-label','Sources: '+(entry.claim||key));section.appendChild(button);
   var title=document.createElement('h2');title.textContent=entry.claim||key;section.appendChild(title);var note=document.createElement('p');note.className='dream-small';note.textContent=checked?'Source checked '+entry.verification.checkedAt:'Source review pending';section.appendChild(note);list.appendChild(section);count++;
  });
  document.getElementById('source-count').textContent=count+(count===1?' source record':' source records')+(count?'':'. Try another term or show all records.');
 }
 search.addEventListener('input',render);status.addEventListener('change',render);
 // Data bundles are deferred later in the document.
 if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
