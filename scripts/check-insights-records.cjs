#!/usr/bin/env node
// Dependency-free regression checks for the actual read-only summary renderer.
// Fixtures are isolated in memory; no user's browser data is read or changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'insights-records.js'), 'utf8');
const keys = { labs:'ovuluna_lab_records_v1', journal:'ovuluna_wellness_journal_v1', assessments:'ovuluna_ovarian_assessments_v2', observations:'ovuluna_observations_v1', checkins:'ovuluna_daily_checkins_v1' };
const today = new Date();
const todayText = [today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
class Element {
  constructor(tag) { this.tagName=tag; this.className=''; this.children=[]; this.textContent=''; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children=children; this.textContent=''; }
  set innerHTML(_) { throw new Error('Renderer must not interpret saved text as HTML'); }
  get fullText() { return [this.textContent,...this.children.map(c=>c.fullText)].join('\n'); }
}
function harness(initial = {}, denied = false) {
  const data = new Map(Object.entries(initial).map(([k,v]) => [k,typeof v==='string'?v:JSON.stringify(v)]));
  const nodes = new Map(), handlers = {}, reads = [];
  for (const key of ['lab-count','lab-date','journal-count','journal-date','assessment-count','assessment-date','observation-count','observation-date','checkin-count','checkin-date','today','today-journal']) nodes.set('[data-summary="'+key+'"]',new Element('span'));
  for (const key of ['labs','journal','observations','checkins']) nodes.set('[data-records="'+key+'"]',new Element('div'));
  const context={Date,console,document:{querySelectorAll(selector){return nodes.has(selector)?[nodes.get(selector)]:[];},createElement(tag){return new Element(tag);}},window:{addEventListener(name,fn){handlers[name]=fn;}},localStorage:{getItem(key){reads.push(key);if(denied)throw new Error('Storage denied');return data.has(key)?data.get(key):null;},setItem(){throw new Error('Summary attempted to write data');},removeItem(){throw new Error('Summary attempted to delete data');}}};
  vm.createContext(context);
  for (const reader of ['observation-records.js','home-records.js']) vm.runInContext(fs.readFileSync(path.join(root,reader),'utf8'),context);
  vm.runInContext(code,context);
  return {data,reads,handlers,text:key=>nodes.get('[data-summary="'+key+'"]').textContent,collection:key=>nodes.get('[data-records="'+key+'"]').fullText,all:()=>[...nodes.values()].map(n=>n.fullText).join('\n')};
}
const lab = (overrides={}) => ({id:'lab-1',analyte:'amh',value:2.35,qualifier:'=',unit:'ng/mL',collectedOn:'2026-09-01',referenceLow:null,referenceHigh:null,sourceName:'',assay:'',context:'',createdAt:'2026-09-01T01:00:00Z',...overrides});
const entry = (overrides={}) => ({date:todayText,mood:'Good',energy:'Steady',comfort:'Comfortable',notes:'',...overrides});
const assessment = (overrides={}) => ({id:'assessment-1',recordedAt:'2026-09-01T01:00:00Z',source:'self-reported',result:{modelVersion:'ovarian-assessment-2.0.0',status:'unavailable-model',input:{age:32},prediction:{ovarianAge:null,menopauseInYears:null,confidenceInterval:null,reproductiveStage:null}},...overrides});
const passed=[];
let ui=harness();
assert.equal(ui.text('lab-count'),'0');assert.equal(ui.text('journal-count'),'0');assert.equal(ui.text('assessment-count'),'0');
assert.match(ui.text('today-journal'),/No check-in saved/);assert.match(ui.collection('labs'),/No lab records/);
passed.push('Empty storage shows explicit empty states and no personal health metrics');
ui=harness({[keys.labs]:{version:1,records:[lab(),lab({id:'lab-2',value:12.5,unit:'pmol/L',qualifier:'<',collectedOn:'2026-09-02',context:'<img src=x onerror=alert(1)>'})]},[keys.journal]:[entry({notes:'<script>bad()</script>'})],[keys.assessments]:{version:2,records:[assessment()]}});
assert.equal(ui.text('lab-count'),'2');assert.equal(ui.text('assessment-count'),'1');
assert.match(ui.collection('labs'),/< 12.5 pmol\/L/);assert.ok(ui.collection('labs').indexOf('Collected 2026-09-02')<ui.collection('labs').indexOf('Collected 2026-09-01'));
assert.match(ui.collection('labs'),/<img src=x onerror=alert\(1\)>/);assert.match(ui.collection('journal'),/<script>bad\(\)<\/script>/);assert.match(ui.text('today-journal'),/mood good/);
passed.push('Actual saved values, comparator, original units, collection dates, journal and v2 snapshots render as text');
ui=harness({[keys.labs]:{version:1,records:[lab(),lab({value:-1}),lab({value:''}),lab({unit:'mg/mL'}),lab({collectedOn:'2026-02-30'}),lab({analyte:'afc',value:2.5,unit:'follicles'})]}});
assert.equal(ui.text('lab-count'),'1');assert.match(ui.collection('labs'),/5 saved entries could not be displayed/);assert.equal(ui.data.get(keys.labs).includes('2026-02-30'),true);
passed.push('Invalid numbers, units, impossible dates and fractional AFC are withheld without changing saved records');
for (const fixtures of [{[keys.labs]:'{',[keys.journal]:'null',[keys.assessments]:{version:1,records:[]}},{[keys.labs]:{version:1,records:null},[keys.journal]:{},[keys.assessments]:{version:2,records:null}}]) {
 ui=harness(fixtures);assert.equal(ui.text('lab-count'),'Unavailable');assert.equal(ui.text('journal-count'),'Unavailable');assert.equal(ui.text('assessment-count'),'Unavailable');assert.match(ui.collection('labs'),/could not be read/);
}
ui=harness({},true);assert.equal(ui.text('lab-count'),'Unavailable');assert.match(ui.text('today-journal'),/could not be checked/);
passed.push('Corrupt, unsupported and denied storage report unavailable instead of pretending records are empty');
ui=harness({ov_result:{ovAge:25,chrono:40},ovuluna_ovarian_age:{age:23},[keys.assessments]:{version:2,records:[assessment({result:{modelVersion:'ovarian-assessment-2.0.0',status:'unavailable-model',input:{age:32},prediction:{ovarianAge:25,menopauseInYears:null,confidenceInterval:null,reproductiveStage:null}}})]}});
assert.equal(ui.text('assessment-count'),'Unavailable');assert.ok(!ui.reads.includes('ov_result'));assert.ok(!ui.reads.includes('ovuluna_ovarian_age'));assert.doesNotMatch(ui.all(),/\b25\b|\b23\b/);
passed.push('Legacy predictions are never read and a v2 record containing a numerical ovarian-age prediction is rejected');
ui=harness();ui.data.set(keys.labs,JSON.stringify({version:1,records:[lab()]}));ui.handlers.storage({key:keys.labs});assert.equal(ui.text('lab-count'),'1');
ui.data.set(keys.journal,JSON.stringify([entry()]));ui.handlers.pageshow();assert.equal(ui.text('journal-count'),'1');
ui.data.clear();ui.handlers.storage({key:null});assert.equal(ui.text('lab-count'),'0');assert.equal(ui.text('journal-count'),'0');
passed.push('Summaries refresh on other-tab updates and back navigation without accumulating duplicate entries');
// Obtain real contract records from their writers in isolated memory. Do not
// mirror the validation logic in this test or seed the user's browser storage.
const contractContext = { Date, crypto: require('node:crypto').webcrypto };
vm.createContext(contractContext);
for (const reader of ['observation-records.js','home-records.js']) vm.runInContext(fs.readFileSync(path.join(root,reader),'utf8'),contractContext);
const fixtureData = new Map(), fixtureStorage = { getItem(key){return fixtureData.get(key)??null;},setItem(key,value){fixtureData.set(key,value);} };
const observation = contractContext.OvulunaObservations.save(fixtureStorage,{kind:'bleeding',observedOn:todayText,values:{amount:'Spotting'},contextFlags:['Postpartum'],notes:'<b>Literal synthetic note</b>'},null,today);
contractContext.OvulunaObservations.save(fixtureStorage,{kind:'bbt',observedOn:todayText,missingReason:'Missed measurement',values:{},contextFlags:[]},fixtureStorage.getItem(keys.observations),today);
const categories = {mood:{mood:'Low'},sleep:{hours:0},symptoms:{pain:0},water:{ml:0},activity:{kind:'Rest day',minutes:0},food:{notes:'Synthetic meal note'}};
for(const [category,values] of Object.entries(categories))contractContext.OvulunaCheckins.save(fixtureStorage,{category,observedOn:todayText,values},today);
ui=harness(Object.fromEntries(fixtureData));
assert.equal(ui.text('observation-count'),'2');assert.equal(ui.text('checkin-count'),'6');
assert.match(ui.collection('observations'),/Spotting/);assert.match(ui.collection('observations'),/Postpartum/);assert.match(ui.collection('observations'),/Missed measurement/);assert.match(ui.collection('observations'),/<b>Literal synthetic note<\/b>/);
assert.match(ui.collection('checkins'),/Showing the latest 3 of 6/);
assert.match(ui.collection('checkins'),/Hours slept: 0/);assert.match(ui.collection('checkins'),/Cramp pain.*: 0/);
for(const category of Object.keys(categories)){
 const record = JSON.parse(fixtureStorage.getItem(keys.checkins)).records.find(item=>item.category===category);
 const categoryUI=harness({[keys.checkins]:{version:1,records:[record]}});
 assert.equal(categoryUI.text('checkin-count'),'1');assert.match(categoryUI.collection('checkins'),/Self-reported Home check-in/);
}
passed.push('Real observation/check-in contracts render recorded context, missing readings and all six category counts safely as text');
ui.data.delete(keys.observations);ui.handlers.storage({key:keys.observations});assert.equal(ui.text('observation-count'),'0');
ui.data.set(keys.checkins,'{broken');ui.handlers.storage({key:keys.checkins});assert.equal(ui.text('checkin-count'),'Unavailable');assert.match(ui.collection('checkins'),/could not be read/);assert.equal(ui.data.get(keys.checkins),'{broken');
ui.data.set(keys.observations,JSON.stringify({version:1,records:[{...observation,values:{amount:'fabricated'}}]}));ui.handlers.pageshow();assert.equal(ui.text('observation-count'),'Unavailable');
passed.push('Changed/deleted and corrupt observation/check-in stores refresh accurately without repairing or writing data');
for (const page of ['insights.html','overview.html']) {
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert.doesNotMatch(html,/href=["']#["']|ov_result|ovuluna_ovarian_age|400mg|135 bpm|98%|54 bpm|64 ms|Peak Cognitive|AI Daily Insight/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  if (/^(https?:|#)/.test(match[1])) continue;
  const target=path.resolve(root,match[1].split(/[?#]/)[0].replace(/^\//,''));
  assert.ok(fs.existsSync(target),page+': missing '+match[1]);
 }
}
passed.push('Both pages have one H1, working local destinations, evidence controls and no removed fake metrics/no-op actions');
console.log(JSON.stringify({suite:'Insights and Overview record summaries',groups:passed.length,passed,limitation:'Isolated renderer and static-link checks; not device, clinical or whole-app validation.'},null,2));
