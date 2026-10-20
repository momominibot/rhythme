/* Dated self-reports only. No assumed weight, calorie target, health score or diagnosis. */
(function(root){
'use strict';
const KEY='ovuluna_daily_checkins_v1';
const FIELDS={
 mood:{title:'Mood',fields:[{key:'mood',label:'Overall mood',options:['Very low','Low','Neutral','Good','Very good'],required:true},{key:'swings',label:'Mood swings (optional)',options:['None','Mild','Moderate','Strong']},{key:'notes',label:'Your notes (optional)',type:'text'}]},
 sleep:{title:'Sleep',fields:[{key:'hours',label:'Hours slept',type:'number',min:0,max:24,step:0.1,required:true},{key:'bedtime',label:'Bedtime (optional)',type:'time'},{key:'wake',label:'Wake time (optional)',type:'time'},{key:'quality',label:'Sleep quality (optional)',options:['Very poor','Poor','Fair','Good','Very good']}]},
 symptoms:{title:'Symptoms',fields:[{key:'pain',label:'Cramp pain · 0 means none, 10 means worst',type:'number',min:0,max:10,step:1,required:true},{key:'notes',label:'Other symptoms or notes (optional)',type:'text'}]},
 water:{title:'Water',fields:[{key:'ml',label:'Water consumed · millilitres (mL)',type:'number',min:0,max:30000,step:1,required:true},{key:'notes',label:'Other drinks or notes (optional)',type:'text'}]},
 activity:{title:'Activity',fields:[{key:'kind',label:'Activity type',options:['Rest day','Walking','Yoga or stretching','Cardio','Strength training','Sport','Other'],required:true},{key:'minutes',label:'Duration · minutes',type:'number',min:0,max:1440,step:1,required:true},{key:'effort',label:'Perceived effort · 1 to 10 (optional)',type:'number',min:1,max:10,step:1}]},
 food:{title:'Food',fields:[{key:'notes',label:'Meals, snacks or anything you noticed',type:'text',required:true},{key:'kcal',label:'Reported energy intake · kcal (optional)',type:'number',min:0,max:20000,step:1}]}
};
function day(now=new Date()){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
function fail(key,message){const e=new Error(message);e.field=key;throw e;}
function validate(raw,now=new Date()){
 if(!raw||!Object.hasOwn(FIELDS,raw.category))fail('category','Choose a check-in category.');
 const date=raw.observedOn;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>day(now))fail('observedOn','Choose a real observation date, on or before today.');
 const values={};
 FIELDS[raw.category].fields.forEach(f=>{
  const v=raw.values?.[f.key];
  if(v===null||v===undefined||v===''){if(f.required)fail(f.key,'Enter '+f.label.toLowerCase()+'.');values[f.key]=null;return;}
  if(f.type==='number'){
   if(!['string','number'].includes(typeof v)||!/^\d+(?:\.\d+)?$/.test(String(v).trim()))fail(f.key,'Enter a number for '+f.label.toLowerCase()+'.');
   const n=Number(v);if(!Number.isFinite(n)||n<f.min||n>f.max||(f.step===1&&!Number.isInteger(n))||(f.step===0.1&&Math.abs(n*10-Math.round(n*10))>1e-8))fail(f.key,f.label+' must be '+f.min+'–'+f.max+(f.step===1?' in whole numbers.':'.'));
   values[f.key]=n;
  }else if(f.options){if(!f.options.includes(v))fail(f.key,'Choose '+f.label.toLowerCase()+'.');values[f.key]=v;}
  else if(f.type==='time'){if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))fail(f.key,'Enter a valid time.');values[f.key]=v;}
  else{if(typeof v!=='string'||v.trim().length>1500||(!v.trim()&&f.required))fail(f.key,'Use 1–1,500 characters for this note.');values[f.key]=v.trim()||null;}
 });
 if(raw.category==='activity'&&values.kind==='Rest day'&&values.minutes!==0)fail('minutes','For a rest day, enter 0 minutes or choose an activity.');
 return {category:raw.category,observedOn:date,values};
}
function read(storage){
 const raw=storage.getItem(KEY);if(raw===null)return {version:1,records:[]};
 let log;try{log=JSON.parse(raw);}catch(_){throw Error('Saved check-ins are unreadable. Existing data has not been changed.');}
 if(!log||log.version!==1||!Array.isArray(log.records))throw Error('Saved check-ins have an unsupported format.');
 const ids=new Set(),dates=new Set();
 for(const r of log.records){
  if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||r.source!=='self-reported'||!Number.isFinite(Date.parse(r.recordedAt))||typeof r.recordedAt!=='string')throw Error('A saved check-in has an unsupported format.');
  const v=validate(r,new Date());
  if(JSON.stringify(v.values)!==JSON.stringify(r.values)||dates.has(r.category+':'+r.observedOn))throw Error('A saved check-in is inconsistent. Existing data has not been changed.');
  ids.add(r.id);dates.add(r.category+':'+r.observedOn);
 }
 return log;
}
function save(storage,input,now=new Date()){
 const values=validate(input,now),log=read(storage);
 const i=log.records.findIndex(r=>r.category===values.category&&r.observedOn===values.observedOn);
 const record={...values,id:i<0?(root.crypto?.randomUUID?.()||'checkin-'+Date.now()+'-'+Math.random().toString(36).slice(2)):log.records[i].id,recordedAt:now.toISOString(),source:'self-reported'};
 if(i<0)log.records.push(record);else log.records[i]=record;
 storage.setItem(KEY,JSON.stringify(log));
 // The browser's storage event excludes the page that performed the write.
 // Notify this page only after persistence succeeds, so the daily companion
 // can read the saved result without forcing navigation or disturbing drafts.
 if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('ovuluna:records-changed',{detail:{key:KEY,category:record.category,observedOn:record.observedOn}}));
 return record;
}
root.OvumindCheckins={KEY,FIELDS,day,validate,read,save};
if(!root.document)return;
const d=root.document,form=d.getElementById('checkin-form');if(!form)return;
const dialog=d.getElementById('checkin-dialog'),fields=d.getElementById('checkin-fields'),date=d.getElementById('checkin-date'),error=d.getElementById('checkin-error'),message=d.getElementById('checkin-message');
let category='mood',trigger=null;
function element(tag,text,cls){const n=d.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;}
function describe(r){return FIELDS[r.category].fields.filter(f=>r.values[f.key]!==null).map(f=>f.label.replace(/ \(optional\)$/,'')+': '+r.values[f.key]).join(' · ');}
function refresh(){
 date.max=day();
 if(message.dataset.error==='true'){message.textContent='';delete message.dataset.error;}
 d.getElementById('ovHomeTitle').textContent='Your records, together';
 d.getElementById('ovHomeStatus').textContent='No saved assessment yet.';
 d.getElementById('logProgress').textContent='0 of 6 recorded';
 d.querySelectorAll('[data-checkin-status]').forEach(n=>{n.textContent='Not recorded';});
 d.getElementById('today-sleep').textContent='Not recorded';
 d.getElementById('today-water').textContent='Not recorded';
 d.getElementById('today-activity').textContent='No activity recorded today.';
 d.getElementById('today-food').textContent='No food note recorded today.';
 d.getElementById('checkin-history-list').replaceChildren();
 d.getElementById('home-date').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
 try{
  const log=read(root.localStorage),today=log.records.filter(r=>r.observedOn===day());
  d.getElementById('logProgress').textContent=today.length+' of 6 recorded';
  d.querySelectorAll('[data-checkin-status]').forEach(n=>{n.textContent=today.some(r=>r.category===n.dataset.checkinStatus)?'Recorded':'Not recorded';});
  const get=k=>today.find(r=>r.category===k)?.values;
  d.getElementById('today-sleep').textContent=get('sleep')?get('sleep').hours+' hours':'Not recorded';
  d.getElementById('today-water').textContent=get('water')?get('water').ml+' mL':'Not recorded';
  d.getElementById('today-activity').textContent=get('activity')?'Your activity: '+get('activity').kind+' · '+get('activity').minutes+' minutes.':'No activity recorded today.';
  d.getElementById('today-food').textContent=get('food')?'Your food note: '+get('food').notes:'No food note recorded today.';
  const history=d.getElementById('checkin-history-list');history.replaceChildren();
  if(!log.records.length)history.append(element('p','No check-ins saved yet.'));
  if(log.records.length>20)history.append(element('p','Showing the latest 20 of '+log.records.length+' entries. Export includes all entries.'));
  log.records.slice().sort((a,b)=>b.observedOn.localeCompare(a.observedOn)||b.recordedAt.localeCompare(a.recordedAt)).slice(0,20).forEach(r=>{
   const a=element('article','', 'home-record');a.append(element('h3',FIELDS[r.category].title+' · '+r.observedOn),element('p',describe(r)));
   const edit=element('button','Review or edit');edit.type='button';edit.addEventListener('click',()=>open(r.category,edit,r.observedOn));a.append(edit);history.append(a);
  });
  d.getElementById('checkin-export').disabled=!log.records.length;
  d.getElementById('legacy-checkin-note').hidden=root.localStorage.getItem('ovuluna_daily_log_'+day())===null;
 }catch(e){message.textContent=e.message||'Browser storage is unavailable.';message.dataset.error='true';d.getElementById('checkin-history-list').textContent='Saved check-ins could not be read.';d.querySelectorAll('[data-checkin-status]').forEach(n=>{n.textContent='Unavailable';});d.getElementById('today-sleep').textContent='Unavailable';d.getElementById('today-water').textContent='Unavailable';d.getElementById('today-activity').textContent='Activity record unavailable.';d.getElementById('today-food').textContent='Food record unavailable.';d.getElementById('logProgress').textContent='Records unavailable';d.getElementById('checkin-export').disabled=true;}
 try{const log=root.OvarianModel.read(root.localStorage);if(log.records.length){d.getElementById('ovHomeTitle').textContent='Review your assessment';d.getElementById('ovHomeStatus').textContent='Last saved '+new Date(log.records[0].recordedAt).toLocaleDateString();}}catch(_){d.getElementById('ovHomeStatus').textContent='Saved assessment unavailable in this browser.';}
}
function restore(){
 error.textContent='';let record;
 try{record=read(root.localStorage).records.find(r=>r.category===category&&r.observedOn===date.value);}catch(e){error.textContent=e.message;}
 FIELDS[category].fields.forEach(f=>{d.getElementById('checkin-'+f.key).value=record?.values[f.key]??'';});
}
function open(type,button,observedOn=day()){
 category=type;trigger=button;fields.replaceChildren();date.max=day();date.value=observedOn;d.getElementById('checkin-dialog-title').textContent='Log '+FIELDS[type].title.toLowerCase();
 FIELDS[type].fields.forEach(f=>{
  const wrap=element('div','', 'checkin-field'),label=element('label',f.label);label.htmlFor='checkin-'+f.key;
  const input=element(f.options?'select':f.type==='text'?'textarea':'input');input.id='checkin-'+f.key;input.name=f.key;input.required=!!f.required;
  if(f.options){const blank=element('option','Choose an answer');blank.value='';input.append(blank);f.options.forEach(v=>{const o=element('option',v);o.value=v;input.append(o);});}
  else if(f.type==='text'){input.maxLength=1500;input.rows=3;}
  else{input.type=f.type;if(f.type==='number'){input.min=f.min;input.max=f.max;input.step=f.step;input.inputMode='decimal';}}
  wrap.append(label,input);fields.append(wrap);
 });
 restore();dialog.showModal();date.focus();
}
date.addEventListener('change',restore);
d.querySelectorAll('[data-checkin]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.checkin,b)));
d.getElementById('checkin-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{const target=trigger?.isConnected?trigger:d.querySelector('[data-checkin="'+category+'"]');target?.focus();});
form.addEventListener('submit',e=>{
 e.preventDefault();const values={};FIELDS[category].fields.forEach(f=>{values[f.key]=d.getElementById('checkin-'+f.key).value;});
 try{const record=save(root.localStorage,{category,observedOn:date.value,values});refresh();dialog.close();message.textContent=FIELDS[category].title+' saved for '+record.observedOn+' on this browser.';delete message.dataset.error;}
 catch(err){error.textContent=err.message||'Could not save; existing records remain unchanged.';d.getElementById(err.field==='observedOn'?'checkin-date':'checkin-'+err.field)?.focus();}
});
d.getElementById('checkin-export').addEventListener('click',()=>{
 try{const data=read(root.localStorage);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=d.createElement('a');a.href=url;a.download='ovuluna-checkins-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){message.textContent=e.message||'Export unavailable.';}
});
const personas=['grow','nurture','peri','wisdom'];
function persona(value){if(!personas.includes(value))return;d.documentElement.dataset.persona=value;d.querySelectorAll('[data-p]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.p===value));b.classList.toggle('on',b.dataset.p===value);});}
function storedPersona(){try{const saved=root.localStorage.getItem('ovuluna_persona');persona(personas.includes(saved)?saved:'grow');}catch(_){persona('grow');}}
storedPersona();
d.querySelectorAll('#personaBar [data-p]').forEach(b=>b.addEventListener('click',()=>{persona(b.dataset.p);try{root.localStorage.setItem('ovuluna_persona',b.dataset.p);}catch(_){message.textContent='Appearance changed for this visit. Browser storage is unavailable.';}}));
let rolloverTimer;
function scheduleRollover(){clearTimeout(rolloverTimer);const now=new Date(),next=new Date(now);next.setHours(24,0,0,20);rolloverTimer=setTimeout(()=>{refresh();scheduleRollover();},Math.max(20,next-now));}
root.addEventListener('storage',e=>{if(e.key==='ovuluna_persona'||e.key===null)storedPersona();if([KEY,root.OvarianModel?.storageKey,null].includes(e.key))refresh();});root.addEventListener('pageshow',()=>{storedPersona();refresh();scheduleRollover();});root.addEventListener('pagehide',()=>clearTimeout(rolloverTimer));d.addEventListener('visibilitychange',()=>{if(!d.hidden){storedPersona();refresh();scheduleRollover();}});refresh();scheduleRollover();
})(typeof window==='undefined'?globalThis:window);
