/* Read-only projection of the actual Home store. No inferred stages, score,
   ovarian interpretation, migration or browser-storage writes. */
(function () {
 'use strict';
 var list=document.getElementById('sleep-record-list'),status=document.getElementById('sleep-view-status');
 if(!list||!status)return;
 function element(tag,text){var node=document.createElement(tag);node.textContent=text;return node;}
 function row(dl,label,value){dl.append(element('dt',label),element('dd',value));}
 function refresh(){
  list.replaceChildren();
  try{
   if(!window.OvulunaCheckins||typeof window.OvulunaCheckins.read!=='function')throw new Error('The record reader is unavailable.');
   var log=window.OvulunaCheckins.read(window.localStorage);
   var entries=log.records.filter(function(record){return record.category==='sleep';}).slice().sort(function(a,b){return b.observedOn.localeCompare(a.observedOn)||b.recordedAt.localeCompare(a.recordedAt);});
   if(!entries.length){status.textContent='No Home sleep entries saved yet. Nothing has been measured or assumed. Log sleep in Home to see your own notes here.';return;}
   status.textContent=entries.length+' self-reported '+(entries.length===1?'sleep entry':'sleep entries')+' saved on this browser. Values below are the ones you entered.';
   entries.forEach(function(record){
    var article=element('article','');article.className='sleep-record';article.dataset.recordId=record.id;
    article.append(element('h3',record.observedOn));
    var dl=element('dl','');
    row(dl,'Hours slept',String(record.values.hours)+' hours');
    row(dl,'Sleep quality',record.values.quality===null?'Not recorded':record.values.quality);
    row(dl,'Bedtime',record.values.bedtime===null?'Not recorded':record.values.bedtime);
    row(dl,'Wake time',record.values.wake===null?'Not recorded':record.values.wake);
    row(dl,'Source',record.source);
    article.append(dl);
    var link=element('a','Review or edit this date in Home');link.href='home.html#checkin-title';article.append(link);
    article.append(element('p','In Home, choose Sleep and select '+record.observedOn+' to restore this entry.'));
    list.append(article);
   });
  }catch(_){status.textContent='Saved Home sleep entries could not be read. Existing records are unchanged. Review local data in Settings; no sleep values are shown from damaged or unavailable storage.';}
 }
 document.getElementById('sleep-refresh').addEventListener('click',refresh);
 window.addEventListener('storage',function(event){if(event.key===window.OvulunaCheckins?.KEY||event.key===null)refresh();});
 window.addEventListener('pageshow',refresh);
 refresh();
})();
