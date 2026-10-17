#!/usr/bin/env node
/* Isolated checks against the actual Home document and record controller.
 * Uses the existing jsdom runtime (override with OVULUNA_JSDOM_PATH).
 * Dialog open/close events are shimmed: this verifies DOM focus targets,
 * not native focus trapping, screen-reader behavior, layout or camera hardware.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=process.env.OVULUNA_TEST_ROOT || path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'home-records.js'),'utf8');
if(process.argv[2]==='--day-probe'){
 const box={Date,Math};vm.createContext(box);vm.runInContext(code,box);
 console.log(box.OvulunaCheckins.day(new Date(process.argv[3])));process.exit(0);
}
let JSDOM,VirtualConsole;
try{({JSDOM,VirtualConsole}=require(process.env.OVULUNA_JSDOM_PATH||'jsdom'));}
catch(_){({JSDOM,VirtualConsole}=require(path.resolve(root,'../ovuluna/node_modules/jsdom')));}
process.env.TZ='UTC';
const html=fs.readFileSync(path.join(root,'home.html'),'utf8');
const ovarianCode=fs.readFileSync(path.join(root,'ovarian-model.js'),'utf8');
const KEY='ovuluna_daily_checkins_v1',TODAY='2026-09-11',PAST='2026-09-10';
const categories={mood:{mood:'Good',swings:'None',notes:''},sleep:{hours:'0',bedtime:'00:00',wake:'00:00',quality:'Good'},symptoms:{pain:'0',notes:''},water:{ml:'0',notes:''},activity:{kind:'Rest day',minutes:'0',effort:''},food:{notes:'A personal meal note',kcal:'0'}};
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
function harness(seed={},options={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://ovuluna.test/home.html',runScripts:'outside-only',virtualConsole:vc});
 const w=dom.window,d=w.document,NativeDate=w.Date,downloads=[],blobs=new Map();let now=Date.parse(options.now||TODAY+'T12:00:00Z'),writes=0,nextTimer=0;const timers=new Map();
 w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 w.setTimeout=(fn,delay=0)=>{const id=++nextTimer;timers.set(id,{fn,at:now+Number(delay)});return id;};w.clearTimeout=id=>timers.delete(id);
 w.setInterval=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,at:now+Number(delay),interval:Number(delay)});return id;};w.clearInterval=w.clearTimeout;
 w.Blob=class{constructor(parts,options){this.parts=parts;this.type=options?.type;}};
 w.URL.createObjectURL=blob=>{const url='blob:test-'+(blobs.size+1);blobs.set(url,blob);return url;};w.URL.revokeObjectURL=url=>blobs.delete(url);
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({filename:this.download,blob:blobs.get(this.href)});};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 for(const [key,value]of Object.entries(seed))w.localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
 const originalSet=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(key,value){writes++;if(options.denyWrites)throw Error('Storage quota exceeded');return originalSet.call(this,key,value);};
 if(options.denyReads)w.Storage.prototype.getItem=function(){throw Error('Storage access denied');};
 w.eval(ovarianCode);if(options.beforeRun)options.beforeRun(w);writes=0;w.eval(code);
 if(options.withAppNav){w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.eval(fs.readFileSync(path.join(root,'appnav.js'),'utf8'));}
 const by=id=>d.getElementById(id),stored=()=>w.localStorage.getItem(KEY);
 const open=(category,date=TODAY)=>{d.querySelector('[data-checkin="'+category+'"]').click();if(by('checkin-date').value!==date){by('checkin-date').value=date;by('checkin-date').dispatchEvent(new w.Event('change'));}};
 const fill=values=>{for(const [key,value]of Object.entries(values))by('checkin-'+key).value=value;};
 const submit=()=>by('checkin-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const save=(category,values=categories[category],date=TODAY)=>{open(category,date);fill(values);submit();};
 const storage=key=>w.dispatchEvent(new w.StorageEvent('storage',{key}));
 const advance=ms=>{const end=now+ms;let steps=0;while(true){const first=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;if(++steps>100)throw Error('Timer loop');const[id,timer]=first;now=timer.at;timers.delete(id);if(timer.interval)timers.set(id,{...timer,at:now+timer.interval});timer.fn();}now=end;};
 return {w,d,by,open,fill,submit,save,storage,advance,errors,stored,downloads,writes:()=>writes,close:()=>dom.window.close()};
}
function withUI(seed,fn,options){const h=harness(seed,options);try{fn(h);}finally{h.close();}}
function records(h){return JSON.parse(h.stored()).records;}

test('Opening and closing every category writes nothing and leaves required inputs blank',()=>withUI({},h=>{
 assert.equal(h.by('logProgress').textContent,'0 of 6 recorded');assert.equal(h.stored(),null);
 for(const category of Object.keys(categories)){h.open(category);assert.equal(h.by('checkin-date').value,TODAY);for(const n of h.d.querySelectorAll('#checkin-fields [required]'))assert.equal(n.value,'',category+' required input should be blank');h.by('checkin-close').click();}
 assert.equal(h.writes(),0);assert.equal(h.stored(),null);assert.deepEqual(h.errors,[]);
}));
test('With shared navigation loaded, tapping each check-in label/icon opens its own form without a competing route',()=>withUI({},h=>{
 const originalLocation=h.w.location.href;
 for(const category of Object.keys(categories)){
  const tile=h.d.querySelector('[data-checkin="'+category+'"]');
  for(const child of tile.querySelectorAll('span')){
   child.click();assert.equal(h.by('checkin-dialog').open,true,category+' child tap must reach the check-in handler');
   assert.match(h.by('checkin-dialog-title').textContent,new RegExp(category==='symptoms'?'symptoms':category));
   assert.equal(h.w.location.href,originalLocation);h.by('checkin-close').click();assert.equal(h.d.activeElement,tile);
  }
 }
 assert.equal(h.writes(),0);assert.equal(h.stored(),null);assert.deepEqual(h.errors,[]);
},{withAppNav:true}));
test('Home restores an explicit appearance preference on return without inferring a health stage or writing records',()=>withUI({},h=>{
 assert.equal(h.d.documentElement.dataset.persona,'bloom');assert.equal(h.writes(),0);
 h.w.localStorage.setItem('ovuluna_persona','wisdom');const writes=h.writes();h.w.dispatchEvent(new h.w.Event('pageshow'));
 assert.equal(h.d.documentElement.dataset.persona,'wisdom');assert.equal(h.d.querySelector('[data-p="wisdom"]').getAttribute('aria-pressed'),'true');
 assert.equal(h.writes(),writes);assert.equal(h.stored(),null);assert.equal(h.by('ovHomeStatus').textContent,'No saved assessment yet.');
 h.w.localStorage.setItem('ovuluna_persona','not-a-chapter');h.storage('ovuluna_persona');assert.equal(h.d.documentElement.dataset.persona,'bloom');
}));
test('Missing required fields in all six categories block saves with visible errors',()=>withUI({},h=>{
 for(const category of Object.keys(categories)){h.open(category);h.submit();assert.equal(h.stored(),null,category);assert.ok(h.by('checkin-error').textContent.length>0,category);assert.equal(h.by('checkin-dialog').open,true);h.by('checkin-close').click();}
 assert.equal(h.writes(),0);
}));
test('All six real forms save supplied values; explicit numeric zero and midnight time are retained',()=>withUI({},h=>{
 for(const category of Object.keys(categories))h.save(category);
 assert.equal(records(h).length,6);assert.equal(h.by('logProgress').textContent,'6 of 6 recorded');
 for(const category of Object.keys(categories)){const record=records(h).find(r=>r.category===category);assert.equal(record.observedOn,TODAY);assert.equal(record.source,'self-reported');h.open(category);for(const[key,value]of Object.entries(categories[category]))assert.equal(h.by('checkin-'+key).value,value,category+'.'+key);h.by('checkin-close').click();}
 assert.equal(h.by('today-sleep').textContent,'0 hours');assert.equal(h.by('today-water').textContent,'0 mL');assert.match(h.by('today-activity').textContent,/Rest day · 0 minutes/);assert.equal(records(h).find(r=>r.category==='food').values.kcal,0);
}));
test('Optional unanswered fields remain null rather than becoming zero or a healthy default',()=>withUI({},h=>{
 for(const[category,values]of [['mood',{mood:'Neutral'}],['sleep',{hours:'7.5'}],['activity',{kind:'Walking',minutes:'20'}],['food',{notes:'A note'}]])h.save(category,values);
 const get=category=>records(h).find(r=>r.category===category).values;
 assert.equal(get('mood').swings,null);assert.equal(get('mood').notes,null);assert.equal(get('sleep').quality,null);assert.equal(get('sleep').bedtime,null);assert.equal(get('activity').effort,null);assert.equal(get('food').kcal,null);
}));
test('Legacy check-in bytes are preserved and never promoted to a dated personal measurement',()=>{
 const legacy='ovuluna_daily_log_'+TODAY,raw='{"water":8,"sleep":9,"mood":true}';withUI({[legacy]:raw},h=>{assert.equal(h.by('logProgress').textContent,'0 of 6 recorded');assert.equal(h.by('today-water').textContent,'Not recorded');assert.equal(h.by('legacy-checkin-note').hidden,false);h.save('water',{ml:'0'});assert.equal(h.w.localStorage.getItem(legacy),raw);assert.equal(records(h).length,1);});
});
test('Same date/category updates its existing ID while other dates and categories remain byte-equivalent',()=>withUI({},h=>{
 h.save('water',{ml:'250',notes:'First'},PAST);h.save('food',{notes:'Earlier meal',kcal:''},PAST);h.save('water',{ml:'500',notes:''});
 const before=records(h),prior=before.find(r=>r.category==='water'&&r.observedOn===PAST),others=before.filter(r=>r.id!==prior.id);
 h.save('water',{ml:'0',notes:'Updated'},PAST);const after=records(h);assert.equal(after.length,3);assert.deepEqual(after.filter(r=>r.id!==prior.id),others);assert.equal(after.find(r=>r.id===prior.id).values.ml,0);
 assert.equal(h.by('today-water').textContent,'500 mL');assert.equal(h.by('logProgress').textContent,'1 of 6 recorded');
 h.open('water',PAST);assert.equal(h.by('checkin-ml').value,'0');h.by('checkin-date').value='2026-09-09';h.by('checkin-date').dispatchEvent(new h.w.Event('change'));assert.equal(h.by('checkin-ml').value,'');assert.equal(h.by('checkin-notes').value,'');
}));
test('Out-of-range, negative, fractional whole-number, future date and inconsistent rest-day inputs are rejected',()=>withUI({},h=>{
 for(const[category,patch]of [['sleep',{hours:'25'}],['sleep',{hours:'-1'}],['sleep',{hours:'1.23'}],['symptoms',{pain:'11'}],['symptoms',{pain:'1.5'}],['water',{ml:'30001'}],['activity',{kind:'Rest day',minutes:'1'}],['activity',{kind:'Walking',minutes:'10',effort:'0'}],['food',{notes:'  '}]]){h.open(category);h.fill({...categories[category],...patch});h.submit();assert.equal(h.stored(),null,category+JSON.stringify(patch));assert.ok(h.by('checkin-error').textContent);h.by('checkin-close').click();}
 h.open('water','2026-09-12');h.fill(categories.water);h.submit();assert.equal(h.stored(),null);assert.match(h.by('checkin-error').textContent,/date/);
 for(const raw of [{category:'water',observedOn:'2026-02-30',values:{ml:1}},{category:'sleep',observedOn:TODAY,values:{hours:NaN}},{category:'mood',observedOn:TODAY,values:{mood:'invented'}},{category:'sleep',observedOn:TODAY,values:{hours:8,bedtime:'24:00'}}])assert.throws(()=>h.w.OvulunaCheckins.validate(raw));
}));
test('Saved text is restored as text without creating DOM markup or changing a saved zero',()=>withUI({},h=>{
 const text='<img src=x onerror="window.injected=true"><script>bad()</script> & "quoted"';h.save('food',{notes:text,kcal:'0'});
 assert.equal(h.by('today-food').textContent,'Your food note: '+text);assert.equal(h.d.querySelectorAll('#checkin-history-list img, #checkin-history-list script').length,0);assert.equal(h.w.injected,undefined);
 h.open('food');assert.equal(h.by('checkin-notes').value,text);assert.equal(h.by('checkin-kcal').value,'0');assert.equal(records(h)[0].values.notes,text);
}));
test('Malformed or unsupported storage remains untouched when opening, submitting and exporting',()=>{
 for(const raw of ['{broken','null','{"version":2,"records":[]}','{"version":1,"records":[null]}'])withUI({[KEY]:raw},h=>{assert.equal(h.by('logProgress').textContent,'Records unavailable');assert.equal(h.by('checkin-export').disabled,true);h.open('water');h.fill({ml:'250'});h.submit();assert.equal(h.stored(),raw);assert.equal(h.writes(),0);assert.ok(h.by('checkin-error').textContent);});
 withUI({},h=>{assert.equal(h.by('logProgress').textContent,'Records unavailable');assert.equal(h.by('checkin-export').disabled,true);},{denyReads:true});
});
test('Invalid saved values and duplicate identities cannot be overwritten by a new save',()=>{
 let base;withUI({},h=>{h.save('water',{ml:'250'});base=JSON.parse(h.stored());});
 const variants=[{...base,records:[{...base.records[0],values:{ml:-1,notes:null}}]},{...base,records:[{...base.records[0],values:{ml:'250',notes:null}}]},{...base,records:[base.records[0],base.records[0]]}];
 for(const value of variants){const raw=JSON.stringify(value);withUI({[KEY]:raw},h=>{assert.equal(h.by('logProgress').textContent,'Records unavailable');h.open('food');h.fill({notes:'New note'});h.submit();assert.equal(h.stored(),raw);assert.equal(h.writes(),0);});}
});
test('Quota failures preserve the existing store and keep the form open with a failure message',()=>{
 let raw;withUI({},h=>{h.save('water',{ml:'10',notes:''});raw=h.stored();});withUI({[KEY]:raw},h=>{h.open('water');h.fill({ml:'20'});h.submit();assert.equal(h.stored(),raw);assert.match(h.by('checkin-error').textContent,/quota/i);assert.equal(h.by('checkin-dialog').open,true);assert.equal(h.by('today-water').textContent,'10 mL');},{denyWrites:true});
});
test('Export includes the complete dated history beyond the 20 entries shown on Home',()=>withUI({},h=>{
 for(let i=0;i<21;i++){const stamp=new Date(Date.UTC(2026,7,20+i)).toISOString().slice(0,10);h.save('water',{ml:String(i),notes:''},stamp);}
 assert.equal(h.d.querySelectorAll('#checkin-history-list .home-record').length,20);assert.equal(h.by('checkin-export').disabled,false);const before=h.stored();h.by('checkin-export').click();assert.equal(h.downloads.length,1);assert.equal(h.downloads[0].filename,'ovuluna-checkins-'+TODAY+'.json');
 const exported=JSON.parse(h.downloads[0].blob.parts.join(''));assert.equal(exported.records.length,21);assert.equal(exported.version,1);assert.deepEqual(exported,JSON.parse(before));assert.equal(h.stored(),before);
}));
test('A storage failure after a successful load clears stale personal summaries and recovers its status',()=>withUI({},h=>{
 h.save('water',{ml:'250',notes:''});const valid=h.stored();h.w.localStorage.setItem(KEY,'{broken');h.storage(KEY);
 assert.equal(h.by('logProgress').textContent,'Records unavailable');assert.doesNotMatch(h.by('today-water').textContent,/250/,'Unreadable storage must not retain a current-looking prior amount');assert.equal(h.d.querySelector('[data-checkin-status="water"]').textContent,'Unavailable');assert.equal(h.d.querySelectorAll('#checkin-history-list .home-record').length,0);
 h.w.localStorage.setItem(KEY,valid);h.storage(KEY);assert.equal(h.by('today-water').textContent,'250 mL');assert.doesNotMatch(h.by('checkin-message').textContent,/unreadable|unsupported|unavailable/i);
}));
test('Other-tab removal of an assessment resets its stale saved-date summary',()=>withUI({},h=>{
 h.w.OvarianModel.save(h.w.localStorage,{age:33,cycle:'regular',context:'none'},{now:new h.w.Date()});h.storage(h.w.OvarianModel.storageKey);assert.match(h.by('ovHomeStatus').textContent,/Last saved/);
 h.w.localStorage.removeItem(h.w.OvarianModel.storageKey);h.storage(h.w.OvarianModel.storageKey);assert.equal(h.by('ovHomeStatus').textContent,'No saved assessment yet.');
}));
test('A visible Home rolls over at local midnight without requiring navigation or a new record',()=>withUI({},h=>{
 h.save('water',{ml:'250',notes:''});h.open('food');h.fill({notes:'Unsaved across midnight'});h.advance(2000);assert.equal(h.by('checkin-notes').value,'Unsaved across midnight');assert.equal(h.by('checkin-date').value,TODAY);assert.equal(h.w.OvulunaCheckins.day(), '2026-09-12');assert.equal(h.by('logProgress').textContent,'0 of 6 recorded');assert.equal(h.by('today-water').textContent,'Not recorded');assert.equal(records(h)[0].observedOn,TODAY);
},{now:'2026-09-11T23:59:59Z'}));
test('Local-day helper follows Singapore, Honolulu and New York dates rather than UTC slicing',()=>{
 for(const[tz,instant,expected]of [['Asia/Singapore','2026-09-10T16:05:00Z','2026-09-11'],['Pacific/Honolulu','2026-09-11T00:05:00Z','2026-09-10'],['America/New_York','2026-11-01T03:59:00Z','2026-10-31'],['America/New_York','2026-11-01T06:01:00Z','2026-11-01']]){
  const actual=cp.execFileSync(process.execPath,[__filename,'--day-probe',instant],{encoding:'utf8',env:{...process.env,TZ:tz,OVULUNA_TEST_ROOT:root}}).trim();assert.equal(actual,expected,tz+' '+instant);
 }
});
test('Close returns focus to an existing trigger, including after an edited history row is rebuilt',()=>withUI({},h=>{
 const tile=h.d.querySelector('[data-checkin="water"]');h.open('water');h.by('checkin-close').click();assert.equal(h.d.activeElement,tile);
 h.save('water',{ml:'250',notes:''});const edit=h.d.querySelector('#checkin-history-list button');edit.click();h.fill({ml:'500'});h.submit();assert.ok(h.d.activeElement!==h.d.body&&h.d.activeElement.isConnected,'Saving an edit must leave focus on a surviving control');
}));
const failed=results.filter(r=>!r.passed);
console.log(JSON.stringify({suite:'Home dated check-ins',passed:results.length-failed.length,failed:failed.length,results,scope:'Actual HTML/controller in isolated jsdom; no live storage or network. Dialog events are shimmed; native focus containment, layout and screen readers require browser/device verification.'},null,2));
process.exitCode=failed.length?1:0;
