/* Isolated DOM checks with synthetic, empty storage. No network or user profile.
   jsdom is not a device/browser layout or clinical-validation test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.OVULUNA_JSDOM_PATH||'/Users/michiyomimi/Desktop/ovuluna/node_modules/jsdom');
const root=path.resolve(__dirname,'../..'),results=[];
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
function harness(page){
 const dom=new JSDOM(fs.readFileSync(path.join(root,page),'utf8'),{url:'https://ovuluna-synthetic.test/'+page,runScripts:'outside-only'}),w=dom.window,d=w.document,writes=[];
 const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(key,value){writes.push(key);return set.call(this,key,value);};
 for(const element of d.querySelectorAll('script:not([src])'))if(!element.type||element.type==='text/javascript')w.eval(element.textContent);
 return {w,d,writes,close:()=>w.close()};
}
function fixture(page,fn){const h=harness(page);try{fn(h);}finally{h.close();}}
function submit(h){h.d.getElementById('cycleSummaryForm').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));}
function enter(h,index,value){const n=h.d.querySelectorAll('.cycle-input')[index];n.value=value;n.dispatchEvent(new h.w.Event('input',{bubbles:true}));return n;}
function summary(h){return h.d.getElementById('summary-output');}
check('Mental-health urgent support is available before any answer and does not assume a country or universal phone number',()=>fixture('mental-health.html',h=>{
 const urgent=h.d.getElementById('urgent-support');assert.ok(urgent);assert.notEqual(urgent.hidden,true);assert.match(urgent.textContent,/local emergency number/);assert.match(urgent.textContent,/Do not wait/);assert.match(urgent.textContent,/trusted|trust/);assert.equal(h.d.querySelectorAll('a[href^="tel:"]').length,0);assert.doesNotMatch(h.d.body.textContent,/Singapore|741741|1767|9151|995|988|999/);const link=urgent.querySelector('a[href="https://findahelpline.com/"]');assert.ok(link);assert.match(urgent.textContent,/external directory/);
}));
check('Mood choices are descriptive and ephemeral; a low or calm selection cannot hide urgent help or assign a reassuring screening score',()=>fixture('mental-health.html',h=>{
 const low=h.d.querySelector('[data-mood="low"]'),calm=h.d.querySelector('[data-mood="calm"]');low.click();assert.equal(low.getAttribute('aria-pressed'),'true');assert.match(h.d.getElementById('moodLogText').textContent,/low/i);assert.match(h.d.getElementById('moodLogDisplay').textContent,/visit only/);calm.click();assert.equal(calm.getAttribute('aria-pressed'),'true');assert.equal(low.getAttribute('aria-pressed'),'false');assert.equal(h.writes.length,0);assert.notEqual(h.d.getElementById('urgent-support').hidden,true);assert.doesNotMatch(h.d.body.textContent,/EPDS|out of 30|Doing okay|low risk|screening score/i);
}));
check('STRAW summary starts without assumed values or classifications and refuses an empty submission',()=>fixture('straw-calculator.html',h=>{
 assert.equal(h.d.querySelectorAll('.cycle-input').length,3);assert.ok([...h.d.querySelectorAll('.cycle-input')].every(n=>n.value===''));submit(h);assert.equal(summary(h).hidden,true);assert.match(h.d.getElementById('summary-status').textContent,/No cycle lengths entered/);assert.equal(h.writes.length,0);
}));
check('A plausible regular cycle series produces only typed observations; no stage, fertility, ovarian age or diagnosis is calculated or persisted',()=>fixture('straw-calculator.html',h=>{
 enter(h,0,'28');enter(h,1,'28');enter(h,2,'35');submit(h);assert.equal(summary(h).hidden,false);assert.match(summary(h).textContent,/Cycle 1: 28 days; Cycle 2: 28 days; Cycle 3: 35 days/);assert.match(summary(h).textContent,/No stage or fertility interpretation has been calculated/);assert.doesNotMatch(summary(h).textContent,/Stage\s*[+-]?\d|fertile|late reproductive|menopausal transition/i);assert.equal(h.writes.length,0);
}));
check('A very long gap or a context choice cannot yield menopause classification',()=>fixture('straw-calculator.html',h=>{
 enter(h,0,'366');h.d.getElementById('cycle-context').value='Breastfeeding';submit(h);assert.match(summary(h).textContent,/366 days/);assert.match(summary(h).textContent,/Breastfeeding/);assert.match(summary(h).textContent,/No stage/);assert.doesNotMatch(summary(h).textContent,/you are|Stage\s*[+-]?\d|postmenopause|late transition/i);
}));
check('Invalid zero, fractional and over-limit values fail visibly; the numeric limit is explicitly software validation',()=>fixture('straw-calculator.html',h=>{
 for(const value of ['0','28.5','367']){enter(h,0,value);submit(h);assert.equal(summary(h).hidden,true);assert.match(h.d.getElementById('summary-status').textContent,/software entry limit, not a normal-cycle range/);assert.equal(h.d.activeElement,h.d.querySelector('.cycle-input'));}
}));
check('Input/context edits invalidate stale summaries and additional rows have a 20-row entry cap',()=>fixture('straw-calculator.html',h=>{
 enter(h,0,'28');submit(h);assert.equal(summary(h).hidden,false);enter(h,0,'29');assert.equal(summary(h).hidden,true);submit(h);h.d.getElementById('cycle-context').dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.equal(summary(h).hidden,true);for(let i=0;i<30;i++)h.d.getElementById('addCycleButton').click();assert.equal(h.d.querySelectorAll('.cycle-input').length,20);assert.equal(h.d.getElementById('addCycleButton').disabled,true);
}));
check('The foot-care page contains explicit limits, not a prescribed herb/heat regimen or fabricated efficacy statistics',()=>fixture('tcm-footsoak.html',h=>{
 assert.match(h.d.body.textContent,/diabetes, reduced sensation or poor circulation/);assert.match(h.d.body.textContent,/does not prescribe a formula, dose or treatment schedule/);assert.match(h.d.body.textContent,/warm water rather than soaking/);assert.match(h.d.body.textContent,/10 minutes/);assert.doesNotMatch(h.d.body.textContent,/1,?236|VAS|15 RCT|2\.1|20.?30 minutes|40.?45|\d+\s*g\b|improves fertility/i);assert.equal(h.writes.length,0);
}));
check('New clinical regions declare English and opt out of partial interface dictionary translation',()=>{
 for(const name of ['mental-health.html','straw-calculator.html','tcm-footsoak.html'])fixture(name,h=>{assert.ok(h.d.querySelector('main[lang="en"][data-dream-skip-translate]'));});
});
check('Fresh safety evidence keys resolve to dated supporting sources and disclaim app validation; the STRAW record replaces legacy metadata',()=>fixture('mental-health.html',h=>{
 for(const file of ['evidence-db.js','evidence-reconciled.js','evidence-lifecycle.js','evidence-acupoint.js','evidence-safety.js','evidence-core.js','evidence-merge.js']){const p=path.join(root,file);if(fs.existsSync(p))h.w.eval(fs.readFileSync(p,'utf8'));}
 for(const key of ['mental-health-scope','mental-health-support-worldwide','straw10','foot-care-safety','tcm-evidence-limits']){const entry=h.w.EVIDENCE_DB[key];assert.ok(entry);assert.equal(entry.verification.status,'verified');assert.equal(entry.verification.checkedAt,'2026-09-30');assert.ok(entry.sources.length>=2);assert.match(entry.limitations,/do not validate Ovuluna/);for(const source of entry.sources)assert.ok(source.url.startsWith('https://'));}
 assert.equal(h.w.EVIDENCE_DB.straw10.source,undefined);assert.equal(h.w.EVIDENCE_DB.straw10.sources[0].pmid,undefined);
 for(const name of ['mental-health.html','straw-calculator.html','tcm-footsoak.html']){const text=fs.readFileSync(path.join(root,name),'utf8');for(const match of text.matchAll(/data-evidence="([^"]+)"/g))assert.ok(h.w.EVIDENCE_DB[match[1]],name+': '+match[1]);}
}));
const out={checkedAt:new Date().toISOString(),scope:'Isolated jsdom execution of owned inline behaviors and evidence merge with synthetic storage only. No network requests, patient records, physical camera, clinical validation or production publication.',checks:results,passed:results.every(t=>t.passed)};
fs.writeFileSync(path.join(__dirname,'targeted-safety-regressions.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
