#!/usr/bin/env node
/* Real Home DOM + production lab/ring/chart scripts with in-memory fixtures.
 * jsdom does not implement native range-keyboard defaults, pointer capture or SVG
 * layout; this suite checks their event/state contract with those boundaries explicit.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.env.OVULUNA_TEST_ROOT||path.resolve(__dirname,'..');
let JSDOM,VirtualConsole;try{({JSDOM,VirtualConsole}=require(process.env.OVULUNA_JSDOM_PATH||'jsdom'));}catch(_){({JSDOM,VirtualConsole}=require(path.resolve(root,'../ovuluna/node_modules/jsdom')));}
const html=fs.readFileSync(path.join(root,'home.html'),'utf8'),scripts=['labs-records.js','hormone-graph.js','mystical-ring.js'].map(name=>({name,code:fs.readFileSync(path.join(root,name),'utf8')}));
const KEY='ovuluna_lab_records_v1',PREF='ovuluna_hormone_view',results=[];
function test(name,run){try{run();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
function fixture(patch={}){return {analyte:'e2',value:20,qualifier:'=',unit:'pg/mL',collectedOn:'2026-08-01',referenceLow:null,referenceHigh:null,sourceName:'Fixture laboratory',assay:'Fixture method',context:'Fixture only',...patch};}
function harness(options={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://ovuluna.test/home.html',runScripts:'outside-only',virtualConsole:vc}),w=dom.window,d=w.document;
 const writes=[],reads=[],documentListeners=[],raf=new Map(),timers=new Map();let next=0,denyReads=!!options.denyReads,denyWrites=!!options.denyWrites;
 const get=w.Storage.prototype.getItem,set=w.Storage.prototype.setItem;
 for(const[key,value]of Object.entries(options.seed||{}))set.call(w.localStorage,key,typeof value==='string'?value:JSON.stringify(value));
 w.Storage.prototype.getItem=function(key){reads.push(key);if(denyReads)throw Error('Read permission blocked');return get.call(this,key);};
 w.Storage.prototype.setItem=function(key,value){writes.push({key,value});if(denyWrites)throw Error('Write quota blocked');return set.call(this,key,value);};
 w.requestAnimationFrame=fn=>{const id=++next;raf.set(id,fn);return id;};w.cancelAnimationFrame=id=>raf.delete(id);
 w.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;};w.clearTimeout=id=>timers.delete(id);
 w.setInterval=w.setTimeout;w.clearInterval=w.clearTimeout;
 d.querySelectorAll('*'); // Initialize jsdom selector machinery before listener instrumentation.
 const listen=d.addEventListener.bind(d);d.addEventListener=function(type,fn,...args){documentListeners.push(type);return listen(type,fn,...args);};
 w.eval(scripts[0].code);
 (options.records||[]).forEach((input,index)=>w.OvulunaLabs.saveRecord(w.localStorage,fixture(input),null,new Date('2026-09-10T00:00:'+String(index%60).padStart(2,'0')+'Z')));
 writes.length=0;reads.length=0;
 w.eval(scripts[1].code);w.eval(scripts[2].code);
 const by=id=>d.getElementById(id);
 const choose=(analyte,unit)=>{by('hormone-analyte').value=analyte;by('hormone-analyte').dispatchEvent(new w.Event('change'));if(unit!==undefined){by('hormone-unit').value=unit;by('hormone-unit').dispatchEvent(new w.Event('change'));}};
 const view=kind=>d.querySelector('[data-hormone-view="'+kind+'"]').click();
 const storage=key=>w.dispatchEvent(new w.StorageEvent('storage',{key}));
 const raw=()=>get.call(w.localStorage,KEY);
 const replace=raw=>{set.call(w.localStorage,KEY,raw);storage(KEY);};
 return {w,d,by,choose,view,storage,raw,replace,writes,reads,documentListeners,raf,timers,errors,denyReads:value=>{denyReads=value;},denyWrites:value=>{denyWrites=value;},close:()=>dom.window.close()};
}
function withUI(options,run){const h=harness(options);try{run(h);}finally{h.close();}}
function coordinates(h){
 const svg=h.by('hormone-plot').querySelector('svg');assert.ok(svg,'Expected chart SVG');
 for(const element of svg.querySelectorAll('*'))for(const attribute of element.attributes){assert.doesNotMatch(attribute.value,/NaN|Infinity|undefined/);if(['x','y','cx','cy','width','height','r'].includes(attribute.name))assert.ok(Number.isFinite(Number(attribute.value)),attribute.name+'='+attribute.value);}
 return [...svg.querySelectorAll('circle')].map(n=>({x:Number(n.getAttribute('cx')),y:Number(n.getAttribute('cy'))}));
}
function table(h){return h.by('hormone-record-table').textContent;}
function pointEvent(h,type,patch={}){
 const e=new h.w.Event(type,{bubbles:true});for(const[key,value]of Object.entries({button:0,pointerId:1,clientX:150,clientY:0,...patch}))Object.defineProperty(e,key,{value});h.by('mysticalRingSvg').dispatchEvent(e);
}

test('Empty storage gives explicit empty chart, correct unit choices and no invented point or health write',()=>withUI({},h=>{
 assert.equal(h.by('hormone-analyte').value,'e2');assert.deepEqual([...h.by('hormone-unit').options].map(o=>o.value),['pg/mL','pmol/L']);assert.match(h.by('hormone-chart-status').textContent,/No Estradiol.*pg\/mL/);assert.equal(h.by('hormone-plot').children.length,0);assert.equal(h.by('hormone-record-table').children.length,0);assert.equal(h.writes.length,0);assert.deepEqual(h.errors,[]);
}));
test('Changing hormone and reported unit selects only matching records; exact zeros remain visible',()=>withUI({records:[{value:0},{value:200,unit:'pmol/L'},{analyte:'fsh',value:5,unit:'IU/L'}]},h=>{
 assert.match(table(h),/0 pg\/mL/);assert.doesNotMatch(table(h),/200|5 IU/);assert.equal(coordinates(h)[0].y,180);assert.equal(h.by('hormone-plot').querySelector('rect').getAttribute('height'),'0');
 h.choose('e2','pmol/L');assert.match(table(h),/200 pmol\/L/);assert.doesNotMatch(table(h),/0 pg\/mL/);assert.equal(coordinates(h).length,1);
 h.choose('fsh','IU/L');assert.match(table(h),/5 IU\/L/);assert.match(h.by('hormone-plot').querySelector('svg').getAttribute('aria-label'),/FSH bar view in IU\/L/);
}));
test('Graph x spacing follows collection-date distances and the bar/graph controls update accessible state',()=>withUI({records:[{value:10,collectedOn:'2026-08-01'},{value:20,collectedOn:'2026-08-02'},{value:30,collectedOn:'2026-08-11'}]},h=>{
 const bar=coordinates(h);assert.ok(Math.abs((bar[1].x-bar[0].x)-(bar[2].x-bar[1].x))<1e-8);
 h.view('graph');const graph=coordinates(h);assert.deepEqual(graph.map(p=>p.x),[35,60,285]);assert.equal(h.by('hormone-plot').querySelectorAll('polyline').length,1);assert.match(h.by('hormone-plot').textContent,/between them have not been measured/);
 assert.equal(h.d.querySelector('[data-hormone-view="graph"]').getAttribute('aria-pressed'),'true');assert.equal(h.d.querySelector('[data-hormone-view="bar"]').getAttribute('aria-pressed'),'false');assert.equal(h.w.localStorage.getItem(PREF),'graph');
 h.view('bar');assert.equal(h.by('hormone-plot').querySelectorAll('rect').length,3);assert.equal(h.by('hormone-plot').querySelectorAll('polyline').length,0);
}));
test('Same-date results and all-zero series have finite coordinates and preserve every table row',()=>{
 withUI({records:[{value:0},{value:0},{value:15}]},h=>{h.view('graph');assert.deepEqual(coordinates(h).map(p=>p.x),[160,160,160]);assert.equal(h.by('hormone-record-table').querySelectorAll('tbody tr').length,3);});
 withUI({records:[{value:0},{value:0,collectedOn:'2026-08-02'}]},h=>{for(const mode of ['bar','graph']){h.view(mode);assert.deepEqual(coordinates(h).map(p=>p.y),[180,180]);}assert.match(table(h),/0 pg\/mL/);});
});
test('Values from 1e-308 through 1e308 and Number.MAX_VALUE cannot overflow chart coordinates',()=>withUI({records:[{value:1e308},{value:Number.MAX_VALUE,collectedOn:'2026-08-02'},{value:1e-308,collectedOn:'2026-08-03'},{value:0,collectedOn:'2026-08-04'}]},h=>{
 for(const mode of ['bar','graph']){h.view(mode);const points=coordinates(h);assert.equal(points.length,4);assert.equal(points[1].y,20);assert.equal(points[3].y,180);}
 assert.match(table(h),/1e\+308 pg\/mL/);assert.match(table(h),/1e-308 pg\/mL/);
}));
test('Reported bounds retain their original symbols and units and are never plotted as exact concentrations',()=>withUI({records:[{value:5,qualifier:'<'},{value:10,qualifier:'>'},{value:15,qualifier:'≤'},{value:20,qualifier:'≥'}]},h=>{
 assert.equal(h.by('hormone-plot').querySelectorAll('svg').length,0);assert.match(h.by('hormone-plot').textContent,/No exact values/);assert.match(h.by('hormone-chart-status').textContent,/4 reported bounds/);for(const text of ['< 5 pg/mL','> 10 pg/mL','≤ 15 pg/mL','≥ 20 pg/mL'])assert.ok(table(h).includes(text));
 h.w.OvulunaLabs.saveRecord(h.w.localStorage,fixture({value:0}),null,new Date('2026-09-10'));h.storage(KEY);assert.equal(coordinates(h).length,1);assert.equal(h.by('hormone-record-table').querySelectorAll('tbody tr').length,5);
}));
test('Original report source and method are visible as inert text, including markup-looking content',()=>withUI({records:[{sourceName:'<img src=x onerror="window.bad=true">',assay:'<script>bad()</script> & assay'}]},h=>{
 assert.ok(table(h).includes('<img src=x onerror="window.bad=true">'));assert.ok(table(h).includes('<script>bad()</script> & assay'));assert.equal(h.by('hormone-record-table').querySelectorAll('img,script').length,0);assert.equal(h.w.bad,undefined);assert.equal(h.by('hormone-record-table').querySelector('th').getAttribute('scope'),'col');
}));
test('Corrupt/null/invalid stores clear an existing chart and table without overwriting any record',()=>withUI({records:[{value:10}]},h=>{
 const original=h.raw(),record=JSON.parse(original).records[0];
 for(const raw of ['{broken','null','{"version":1,"records":[null]}',JSON.stringify({version:1,records:[{...record,value:null}]}),JSON.stringify({version:1,records:[{...record,value:-1}]}),JSON.stringify({version:1,records:[{...record,collectedOn:'2026-02-30'}]})]){
  h.replace(raw);assert.equal(h.raw(),raw);assert.match(h.by('hormone-chart-status').textContent,/unavailable/);assert.equal(h.by('hormone-plot').children.length,0);assert.equal(h.by('hormone-record-table').children.length,0);
  h.replace(original);assert.equal(coordinates(h).length,1);
 }
 assert.equal(h.writes.length,0);h.replace('{"version":1,"records":[]}');assert.equal(h.by('hormone-plot').children.length,0);assert.match(h.by('hormone-chart-status').textContent,/No Estradiol/);
}));
test('View preference survives reload; denied read/write storage leaves usable controls without a false data point',()=>{
 withUI({seed:{[PREF]:'graph'},records:[{value:1}]},h=>{assert.equal(h.d.querySelector('[data-hormone-view="graph"]').getAttribute('aria-pressed'),'true');assert.match(h.by('hormone-plot').querySelector('svg').getAttribute('aria-label'),/graph view/);h.denyWrites(true);h.view('bar');assert.equal(h.d.querySelector('[data-hormone-view="bar"]').getAttribute('aria-pressed'),'true');assert.equal(h.w.localStorage.getItem(PREF),'graph');assert.equal(coordinates(h).length,1);assert.deepEqual(h.errors,[]);});
 withUI({denyReads:true},h=>{assert.match(h.by('hormone-chart-status').textContent,/unavailable/);h.view('graph');assert.equal(h.by('hormone-plot').children.length,0);assert.deepEqual(h.errors,[]);});
});
test('New LH and P4 records round-trip through the real labs save/read API into their matching chart units',()=>withUI({},h=>{
 for(const input of [{analyte:'lh',value:0,unit:'IU/L'},{analyte:'lh',value:5,unit:'mIU/mL'},{analyte:'p4',value:3,unit:'ng/mL'},{analyte:'p4',value:9,unit:'nmol/L'}])h.w.OvulunaLabs.saveRecord(h.w.localStorage,fixture(input),null,new Date('2026-09-10'));
 assert.equal(h.w.OvulunaLabs.loadRecords(h.w.localStorage).records.length,4);
 for(const[analyte,unit,text]of [['lh','IU/L','0 IU/L'],['lh','mIU/mL','5 mIU/mL'],['p4','ng/mL','3 ng/mL'],['p4','nmol/L','9 nmol/L']]){h.choose(analyte,unit);assert.equal(coordinates(h).length,1);assert.ok(table(h).includes(text));assert.equal(h.by('hormone-record-table').querySelectorAll('tbody tr').length,1);}
}));
test('Latest-12 limit retains dates and table context without mutating the longer saved history',()=>withUI({records:Array.from({length:15},(_,i)=>({value:i,collectedOn:'2026-08-'+String(i+1).padStart(2,'0')}))},h=>{
 const original=h.raw();assert.match(h.by('hormone-chart-status').textContent,/Latest 12 of 15/);assert.equal(h.by('hormone-record-table').querySelectorAll('tbody tr').length,12);assert.match(table(h),/2026-08-04/);assert.doesNotMatch(table(h),/2026-08-01/);h.view('graph');coordinates(h);assert.equal(h.raw(),original);
}));
test('Ring range input and previous/next controls stay within bounds and expose the example day accessibly',()=>withUI({},h=>{
 const range=h.by('ring-day');assert.equal(range.type,'range');assert.equal(range.min,'1');assert.equal(range.max,'28');assert.equal(range.step,'1');assert.ok(h.d.querySelector('label[for="ring-day"]'));
 for(let i=0;i<50;i++)h.by('ring-previous').click();assert.equal(range.value,'1');assert.equal(h.by('ring-previous').disabled,true);assert.match(range.getAttribute('aria-valuetext'),/Example day 1, Menstruation/);
 for(let i=0;i<50;i++)h.by('ring-next').click();assert.equal(range.value,'28');assert.equal(h.by('ring-next').disabled,true);assert.equal(h.by('ring-previous').disabled,false);
 // Native keyboard arrows change the range value before its input event. jsdom
 // does not perform that default action, so exercise the same change contract.
 range.value='14';range.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.by('ring-day-label').textContent,'14');assert.match(range.getAttribute('aria-valuetext'),/Example day 14, Ovulation/);assert.match(h.by('ring-explanation').textContent,/not a prediction/);
 range.value='99';range.dispatchEvent(new h.w.Event('input'));assert.equal(range.value,'28');range.value='-1';range.dispatchEvent(new h.w.Event('input'));assert.equal(range.value,'1');assert.equal(h.writes.length,0);
}));
test('Pointer interaction retains one SVG and listener set; cancelled drags cannot move the ring or schedule stale animation',()=>withUI({},h=>{
 const svg=h.by('mysticalRingSvg'),orb=h.by('ring-orb');svg.getBoundingClientRect=()=>({left:0,top:0,width:300,height:300});let captures=0;svg.setPointerCapture=()=>captures++;
 const listeners=h.documentListeners.length;
 for(let i=0;i<25;i++){pointEvent(h,'pointerdown',{clientX:300,clientY:150});pointEvent(h,'pointermove',{clientX:150,clientY:300});pointEvent(h,'pointerup');h.by('ring-previous').click();}
 assert.equal(h.by('mysticalRingSvg'),svg);assert.equal(h.by('ring-orb'),orb);assert.equal(h.d.querySelectorAll('#mysticalRingSvg').length,1);assert.equal(captures,25);assert.equal(h.documentListeners.length,listeners);assert.equal(h.documentListeners.filter(t=>/pointer|touch|mousemove/.test(t)).length,0);
 for(const type of ['pointercancel','lostpointercapture']){pointEvent(h,'pointerdown',{clientX:300,clientY:150});pointEvent(h,type);const before=h.by('ring-day').value;pointEvent(h,'pointermove',{clientX:150,clientY:300});assert.equal(h.by('ring-day').value,before);}
 pointEvent(h,'pointerdown',{button:2,clientX:0,clientY:150});assert.equal(captures,27);assert.equal(h.raf.size,0);assert.equal(h.timers.size,0);assert.equal(h.writes.length,0);assert.deepEqual(h.errors,[]);
}));
const failed=results.filter(r=>!r.passed);console.log(JSON.stringify({suite:'Home hormone chart and lunar illustration',passed:results.length-failed.length,failed:failed.length,results,scope:'Actual HTML, labs API and display scripts in isolated jsdom. Native range keyboard defaults, pointer capture, SVG layout and assistive-technology announcements still need browser/device checks.'},null,2));process.exitCode=failed.length?1:0;
