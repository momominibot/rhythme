// Deterministic contracts and regression fixtures; run: node scripts/check-ovarian.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const box = { Date, Math, crypto: {randomUUID: () => 'test-id'} };
vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(root,'ovarian-model.js'),'utf8'),box);
const model = box.OvarianModel;
const now = new Date('2026-09-11T06:00:00Z');
const base = {age:33, cycle:'regular', context:'none'};
let groups=0;
function test(name, fn) { fn(); groups++; console.log('PASS '+name); }
function storage(initial={}) { const map=new Map(Object.entries(initial)); return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),map}; }
function result(input) { return model.assess(input,{now}); }
test('empty/blank entries never acquire a default personal age',()=>{
  for (const age of [undefined,null,'']) { const r=result({...base,age}); assert.equal(r.status,'insufficient-data'); assert.equal(r.input.age,null); assert.equal(r.prediction.ovarianAge,null); }
});
test('invalid numeric input and unknown choices fail explicitly',()=>{
  for(const age of [-1,0,12,101,33.5,Infinity,NaN,'33abc',' ',true,[],{}]) assert.equal(result({...base,age}).status,'invalid-input');
  assert.equal(result({...base,cycle:'made-up'}).status,'invalid-input');
  assert.equal(result({...base,momMeno:-2}).status,'invalid-input');
});
test('teen/postpartum/contraception do not become menopause or stress diagnoses',()=>{
  for(const input of [{...base,age:16,cycle:'skipped'},{...base,age:34,cycle:'variable',context:'postpartum'},{...base,cycle:'contraceptive'},{...base,context:'pregnant'}]) {
    const r=result(input); assert.equal(r.status,'unsupported-context'); assert.ok(Object.values(r.prediction).every(v=>v===null));
  }
});
test('all other patterns have an explicit unavailable-model result, never fabricated confidence',()=>{
  for(const cycle of ['regular','variable','skipped','post12']) { const r=result({...base,cycle}); assert.equal(r.status,'unavailable-model'); assert.ok(Object.values(r.prediction).every(v=>v===null)); }
});
test('AMH zero retained; units unchanged; no undisclosed conversions',()=>{
  for(const [value,unit] of [[0,'ng/mL'],[2.25,'ng/mL'],[16.1,'pmol/L']]) {
    const r=result({...base,amh:{value,unit,collectedOn:'2026-08-10'}}); assert.equal(r.status,'unavailable-model'); assert.equal(r.input.amh.value,value); assert.equal(r.input.amh.unit,unit);
  }
});
test('missing/negative/nonfinite AMH, wrong units and impossible/future dates rejected',()=>{
  const good={value:1.2,unit:'ng/mL',collectedOn:'2026-08-10'};
  for(const patch of [{value:''},{value:-1},{value:Infinity},{value:'1.2junk'},{unit:'mg/L'},{collectedOn:''},{collectedOn:'2026-02-30'},{collectedOn:'2026-09-12'},{collectedOn:'2025-2-3'}]) assert.equal(result({...base,amh:{...good,...patch}}).status,'invalid-input');
});
test('optional missing data remains missing, never healthy defaults',()=>{
  const r=result(base); for(const key of ['momMeno','smoke','circ','sleep','amh']) assert.equal(r.input[key],null);
  assert.equal(r.questions.answered,3); assert.equal(result({age:33}).questions.answered,1);
});
test('save persists full versioned input/provenance and preserves legacy estimates',()=>{
  const old='{"ovAge":50}'; const store=storage({ovuluna_ovarian_age:old,ov_result:old});
  const saved=model.save(store,{...base,context:'postpartum'},{now}); assert.equal(saved.ok,true);
  const log=model.read(store); assert.equal(log.version,2); assert.equal(log.records[0].result.input.context,'postpartum');
  assert.equal(log.records[0].recordedAt,now.toISOString()); assert.equal(log.records[0].result.modelVersion,model.version); assert.equal(log.records[0].source,'self-reported');
  assert.equal(store.getItem('ovuluna_ovarian_age'),old); assert.equal(store.getItem('ov_result'),old);
});
test('invalid submission does not write; corrupt and denied storage cannot be overwritten silently',()=>{
  const store=storage(); assert.equal(model.save(store,{age:''},{now}).ok,false); assert.equal(store.map.size,0);
  for(const raw of ['not json','{"version":3,"records":[]}','{"version":2,"records":[null]}']) {
    const corrupt=storage({[model.storageKey]:raw}); assert.throws(()=>model.save(corrupt,base,{now})); assert.equal(corrupt.getItem(model.storageKey),raw);
  }
  assert.throws(()=>model.save({getItem:()=>null,setItem:()=>{throw Error('quota')}},base,{now}));
});
test('stored predictions, duplicate IDs and invalid input snapshots cannot re-enter the current log',()=>{
  const good=model.createRecord(base,{now}).record;
  const variants=[{...good,result:{...good.result,prediction:{...good.result.prediction,ovarianAge:50}}},{...good,result:{...good.result,input:{...base,age:0}}},{...good,result:{...good.result,modelVersion:'legacy'}}];
  for(const bad of variants) assert.throws(()=>model.read(storage({[model.storageKey]:JSON.stringify({version:2,records:[bad]})})));
  assert.throws(()=>model.read(storage({[model.storageKey]:JSON.stringify({version:2,records:[good,good]})})));
  assert.equal(result({...base,amh:{value:'.25',unit:'ng/mL',collectedOn:'2026-08-10'}}).input.amh.value,.25);
});
test('legacy model calls and synthetic Home age display are removed',()=>{
  const ovarian=fs.readFileSync(path.join(root,'ovarian-age.html'),'utf8'); const home=fs.readFileSync(path.join(root,'home.html'),'utf8');
  assert.ok(ovarian.includes('ovarian-assessment.js')); assert.ok(ovarian.includes('data-evidence="ovarian-age-concept"'));
  assert.ok(!/computeOvarianAge|value="33"|id="ovAgeDisplay"/.test(ovarian));
  assert.ok(!/saved\.ovAge|latest estimate looks protective|−3 years vs calendar/.test(home));
});
console.log(JSON.stringify({groups,passed:true,scope:'Input, storage and source contract only; not clinical or iOS validation'}));
