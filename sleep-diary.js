/* Dated self-reported diary only. Existing legacy entry bytes are preserved when
   appending; old calculated scores/durations are never promoted to observations. */
(function(){
 'use strict';
 var KEY='ovuluna_sleep_logs',list=document.getElementById('historyList'),result=document.getElementById('result');
 var date=document.getElementById('sleepDate'),bed=document.getElementById('bedTime'),wake=document.getElementById('wakeTime');
 if(!list||!result||!date||!bed||!wake)return;
 var expected=null,readable=false,editing=null;
 var saveButton=document.getElementById('saveSleep'),cancelButton=document.getElementById('cancelSleepEdit'),mode=document.getElementById('diary-form-mode');
 var descriptions={latency:['Less than 15 minutes','16–30 minutes','31–60 minutes','More than 60 minutes'],quality:['Very good','Fairly good','Fairly bad','Very bad'],disturbances:['Not at all','1–2 times briefly','3+ times or more than 30 minutes awake'],daytime:['Not tired','Slightly tired','Moderately tired','Very tired']};
 function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
 function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value&&value<=today();}
 function validTime(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);}
 function currentEntry(record){
  if(record.entryVersion!==1||record.source!=='self-reported'||!validDate(record.observedOn)||!validTime(record.bedTime)||!validTime(record.wakeTime)||typeof record.date!=='string'||!Number.isFinite(Date.parse(record.date)))throw Error('unsupported');
  Object.keys(descriptions).forEach(function(key){var value=record[key];if(value!==null&&(!Number.isInteger(value)||!descriptions[key][value]))throw Error('unsupported');});
 }
 function read(raw){
  if(raw===null)return [];
  var logs=JSON.parse(raw);
  if(!Array.isArray(logs))throw Error('unsupported');
  logs.forEach(function(record){
   if(!record||typeof record!=='object'||Array.isArray(record))throw Error('unsupported');
   if(record.entryVersion!==undefined)currentEntry(record);
  });
  return logs;
 }
 // Find only top-level comma boundaries, respecting nested JSON and escaped strings.
 // The enclosing raw value is parsed/validated first; unknown property bytes are not serialized.
 function spans(raw,open,close){
  var first=raw.indexOf(open),depth=0,string=false,escape=false,start=first+1,out=[];
  for(var i=first+1;i<raw.length;i++){
   var ch=raw[i];
   if(string){if(escape)escape=false;else if(ch.charCodeAt(0)===92)escape=true;else if(ch==='"')string=false;continue;}
   if(ch==='"'){string=true;continue;}
   if(ch==='{'||ch==='['){depth++;continue;}
   if(ch===close&&depth===0){if(raw.slice(start,i).trim())out.push({start:start,end:i});break;}
   if(ch==='}'||ch===']'){depth--;continue;}
   if(ch===','&&depth===0){out.push({start:start,end:i});start=i+1;}
  }
  return out;
 }
 function patchObject(raw,updates){
  var replacements=[],remaining=Object.assign({},updates);
  spans(raw,'{','}').forEach(function(span){
   var quoted=false,escaped=false,colon=-1;
   for(var i=span.start;i<span.end;i++){var c=raw[i];if(quoted){if(escaped)escaped=false;else if(c.charCodeAt(0)===92)escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c===':'){colon=i;break;}}
   var key=JSON.parse(raw.slice(span.start,colon).trim());
   if(Object.prototype.hasOwnProperty.call(updates,key)){replacements.push({start:colon+1,end:span.end,value:JSON.stringify(updates[key])});delete remaining[key];}
  });
  var next=raw;replacements.sort(function(a,b){return b.start-a.start;}).forEach(function(item){next=next.slice(0,item.start)+item.value+next.slice(item.end);});
  var keys=Object.keys(remaining);
  if(keys.length){var end=next.lastIndexOf('}');next=next.slice(0,end)+','+keys.map(function(key){return JSON.stringify(key)+':'+JSON.stringify(remaining[key]);}).join(',')+next.slice(end);}
  return next;
 }
 function clearEditing(){
  editing=null;mode.textContent='New diary entry';saveButton.textContent='Save my diary entry';cancelButton.hidden=true;
  date.value=today();bed.value='';wake.value='';
  document.querySelectorAll('input[type="radio"]').forEach(function(input){input.checked=false;input.closest('.option').classList.remove('selected');});
 }
 function beginEdit(index){
  try{
   var raw=localStorage.getItem(KEY);if(raw!==expected)throw Error('stale');var logs=read(raw),record=logs[index];
   if(!record||record.entryVersion!==1)throw Error('unsupported');
   var item=spans(raw,'[',']')[index];editing={index:index,raw:raw.slice(item.start,item.end)};
   date.value=record.observedOn;bed.value=record.bedTime;wake.value=record.wakeTime;
   Object.keys(descriptions).forEach(function(key){document.querySelectorAll('input[name="'+key+'"]').forEach(function(input){input.checked=record[key]!==null&&Number(input.value)===record[key];input.closest('.option').classList.toggle('selected',input.checked);});});
   mode.textContent='Editing '+record.observedOn;saveButton.textContent='Save changes';cancelButton.hidden=false;
   message('Your saved entry is restored for editing. Changes are not saved until you choose Save changes.');date.focus();
  }catch(_){message('This saved entry changed or is unavailable. Refresh saved entries before editing. Nothing has been changed.');}
 }
 function node(tag,text){var n=document.createElement(tag);n.textContent=text;return n;}
 function row(dl,label,text){dl.append(node('dt',label),node('dd',text));}
 function message(text){result.textContent=text;result.hidden=false;}
 function renderHistory(review){
  list.replaceChildren();
  try{
   var raw=localStorage.getItem(KEY),logs=read(raw);
   if(review){expected=raw;readable=true;}
   if(!logs.length){list.append(node('p','No diary entries saved yet. No clock times, sleep duration or quality are assumed.'));return;}
   logs.map(function(record,index){return {record:record,index:index};}).reverse().forEach(function(item){
    var record=item.record;
    var article=node('article','');article.className='history-row';
    if(record.entryVersion===1){
     article.append(node('h3',record.observedOn+' · Self-reported'));
     var dl=node('dl','');row(dl,'Bedtime',record.bedTime);row(dl,'Wake time',record.wakeTime);
     Object.keys(descriptions).forEach(function(key){row(dl,{latency:'Time to fall asleep',quality:'Your sleep quality',disturbances:'Night waking',daytime:'Daytime tiredness'}[key],record[key]===null?'Not recorded':descriptions[key][record[key]]);});
     article.append(dl,node('p','Clock times as entered. No hours asleep, sleep score or ovarian result is calculated.'));
     var edit=node('button','Edit this entry');edit.type='button';edit.className='diary-edit';edit.dataset.diaryEdit=String(item.index);edit.addEventListener('click',function(){beginEdit(item.index);});article.append(edit);
    }else{
     var saved=typeof record.date==='string'&&Number.isFinite(Date.parse(record.date))?record.date:'date unavailable';
     article.append(node('h3','Legacy entry · saved '+saved),node('p','An older version stored calculated values without the original confirmed observations. Those values remain in local storage for export; they are not displayed as your actual sleep.'));
    }
    list.append(article);
   });
  }catch(_){if(review)readable=false;list.append(node('p','Diary entries could not be read safely. Existing data is unchanged. Review local export and deletion in Settings.'));}
 }
 Object.keys(descriptions).forEach(function(key){document.querySelectorAll('input[name="'+key+'"]').forEach(function(input){input.addEventListener('change',function(){document.querySelectorAll('input[name="'+key+'"]').forEach(function(item){item.closest('.option').classList.toggle('selected',item.checked);});});});});
 saveButton.addEventListener('click',function(){
  if(!validDate(date.value)){message('Choose a real observation date on or before today. Your draft has not been saved.');date.focus();return;}
  if(!validTime(bed.value)||!validTime(wake.value)){message('Enter your bed and wake clock times. No default times or sleep duration have been assumed. Your draft has not been saved.');(!validTime(bed.value)?bed:wake).focus();return;}
  if(!readable){message('Saved diary data is unavailable. Your draft stays here; existing data is unchanged. Review Settings before trying again.');return;}
  try{
   var raw=localStorage.getItem(KEY);
   if(raw!==expected)throw Error('stale');
   var logs=read(raw),entry={entryVersion:1,date:new Date().toISOString(),observedOn:date.value,bedTime:bed.value,wakeTime:wake.value,source:'self-reported'};
   Object.keys(descriptions).forEach(function(key){var selected=document.querySelector('input[name="'+key+'"]:checked');entry[key]=selected?Number(selected.value):null;});
   currentEntry(entry);
   // Do not parse/restringify prior entries, round legacy numbers, or truncate history.
   var next,wasEditing=editing!==null;
   if(editing){
    var parts=spans(raw,'[',']'),part=parts[editing.index];
    if(!part||raw.slice(part.start,part.end)!==editing.raw||logs[editing.index]?.entryVersion!==1)throw Error('stale');
    // Patch only the changed known values. First-saved date, unknown fields and every
    // other entry (including legacy numeric/string precision) keep their raw bytes.
    var updates={observedOn:entry.observedOn,bedTime:entry.bedTime,wakeTime:entry.wakeTime,latency:entry.latency,quality:entry.quality,disturbances:entry.disturbances,daytime:entry.daytime,updatedAt:entry.date};
    next=raw.slice(0,part.start)+patchObject(editing.raw,updates)+raw.slice(part.end);
    read(next);
   }else if(raw===null)next='['+JSON.stringify(entry)+']';else{var close=raw.lastIndexOf(']');next=raw.slice(0,close)+(logs.length?',':'')+JSON.stringify(entry)+raw.slice(close);}
   localStorage.setItem(KEY,next);
   if(localStorage.getItem(KEY)!==next)throw Error('verification');
   expected=next;renderHistory(false);if(wasEditing)clearEditing();message(wasEditing?'Your diary changes are saved on this browser. The first-saved date and other entries are preserved. No score or ovarian assessment was calculated.':'Your self-reported diary entry is saved for '+entry.observedOn+' on this browser. No sleep score or ovarian assessment was calculated.');
  }catch(error){message(error.message==='stale'?'Saved diary data changed or was deleted in another tab. Your draft is not saved. Refresh saved entries to review the latest version before saving.':'Your diary entry could not be saved. Your draft stays here. Check browser storage and try again.');}
 });
 cancelButton.addEventListener('click',function(){clearEditing();message('Editing cancelled. Saved entries are unchanged.');});
 document.getElementById('refreshSleep').addEventListener('click',function(){renderHistory(true);message(readable?'Saved entries refreshed. Your unsaved input stays in the form.':'Saved diary data remains unavailable. Your unsaved input stays here.');});
 window.addEventListener('storage',function(event){if(event.key===KEY||event.key===null){renderHistory(false);message('Saved diary data changed in another tab. Your draft stays here. Refresh saved entries before saving.');}});
 date.max=today();date.value=today();renderHistory(true);
})();
