#!/usr/bin/env node
// Deterministic input/storage checks. No browser health data, network or diagnosis.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const context = { crypto: require('node:crypto').webcrypto, console };
vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(root, 'labs-records.js'), 'utf8'), context);
const api = context.OvulunaLabs;
const today = new Date('2026-09-11T12:00:00Z');
const input = { analyte:'amh', value:'2.4', qualifier:'=', unit:'ng/mL', collectedOn:'2026-07-03', referenceLow:'1', referenceHigh:'4', sourceName:'Fictional test laboratory', assay:'Report method A', context:'Fixture only' };
const checks=[];
function storage(seed = {}) { const values = new Map(Object.entries(seed)); return { getItem:key=>values.has(key)?values.get(key):null, setItem:(key,value)=>values.set(key,value), values }; }
for (const value of ['', ' ', '-10', 'NaN', 'Infinity', '1e309', '2.4abc', '0x20']) assert.throws(()=>api.parseInput({...input,value},today));
checks.push('Blank, negative, nonfinite and malformed values are rejected');
assert.equal(api.parseInput({...input,value:'0'},today).value,0);
assert.equal(api.parseInput({...input,value:'0.1',qualifier:'<'},today).qualifier,'<');
assert.throws(()=>api.parseInput({...input,analyte:'afc',unit:'follicles',value:'1.5'},today));
checks.push('Zero and report inequalities are retained; follicle counts require whole numbers');
for(const collectedOn of ['', '2026-02-30', '2027-01-01', '09/11/2026']) assert.throws(()=>api.parseInput({...input,collectedOn},today));
const parsed=api.parseInput(input,today);assert.equal(parsed.collectedOn,'2026-07-03');assert.equal(parsed.age,undefined);
checks.push('Actual valid collection date is required, with no future date or substituted age');
for(const patch of [{analyte:''},{unit:''},{unit:'IU/L'},{qualifier:''},{analyte:'__proto__'}]) assert.throws(()=>api.parseInput({...input,...patch},today));
assert.equal(api.parseInput({...input,unit:'pmol/L'},today).value,2.4);
checks.push('Explicit compatible units/symbols are required and values are never converted');
for(const patch of [{referenceLow:'-1'},{referenceHigh:'Infinity'},{referenceLow:'5',referenceHigh:'2'}]) assert.throws(()=>api.parseInput({...input,...patch},today));
assert.match(api.compareLimits(api.parseInput(input,today)),/Within your entered/);
assert.match(api.compareLimits(api.parseInput({...input,value:'0.5'},today)),/Below your entered/);
assert.match(api.compareLimits(api.parseInput({...input,value:'8'},today)),/Above your entered/);
assert.match(api.compareLimits(api.parseInput({...input,referenceLow:'',referenceHigh:''},today)),/No report limits/);
assert.match(api.compareLimits(api.parseInput({...input,referenceHigh:''},today)),/no upper limit/);
assert.match(api.compareLimits(api.parseInput({...input,qualifier:'<'},today)),/no automatic range comparison/);
checks.push('Only entered numeric limits are compared; absent/one-sided/bounded results stay explicit');
const legacy='{"age":32,"amh":0,"date":"2025-05-18T12:00:00Z"}';const store=storage({[api.LEGACY_KEY]:legacy});
const first=api.saveRecord(store,input,null,today);assert.equal(store.getItem(api.LEGACY_KEY),legacy);
let loaded=api.loadRecords(store);assert.equal(loaded.records.length,1);assert.equal(loaded.records[0].sourceName,input.sourceName);assert.equal(loaded.records[0].assay,input.assay);assert.equal(loaded.records[0].collectedOn,input.collectedOn);assert.equal(loaded.records[0].createdAt,today.toISOString());
checks.push('Dated result/source/assay survive reload while legacy snapshot stays byte-for-byte unchanged');
const second=api.saveRecord(store,{...input,analyte:'fsh',unit:'IU/L',value:'5'},null,today);assert.equal(api.loadRecords(store).records.length,2);
api.saveRecord(store,{...input,value:'2.7',context:'Corrected transcription'},first.id,new Date('2026-09-12T12:00:00Z'));
loaded=api.loadRecords(store);assert.equal(loaded.records.length,2);assert.equal(loaded.records.find(r=>r.id===first.id).value,2.7);assert.equal(loaded.records.find(r=>r.id===first.id).createdAt,today.toISOString());assert.equal(loaded.records.find(r=>r.id===second.id).value,5);
assert.throws(()=>api.saveRecord(store,input,'missing-id',today));
checks.push('New results append; explicit edit updates one record while preserving others and creation time');
for(const bad of ['{bad',JSON.stringify({version:1,records:[{}]}),JSON.stringify({version:2,records:[]}),JSON.stringify({version:1,records:[{...first,value:null}]})]){
 const broken=storage({[api.KEY]:bad,[api.LEGACY_KEY]:legacy});assert.throws(()=>api.saveRecord(broken,input,null,today));assert.equal(broken.getItem(api.KEY),bad);assert.equal(broken.getItem(api.LEGACY_KEY),legacy);
}
checks.push('Malformed or unsupported saved data cannot be overwritten by a new save');
const prior=store.getItem(api.KEY);const denied={getItem:key=>store.getItem(key),setItem:()=>{throw new Error('Quota exceeded');}};assert.throws(()=>api.saveRecord(denied,input,null,today),/Quota exceeded/);assert.equal(store.getItem(api.KEY),prior);
assert.throws(()=>api.loadRecords({getItem:()=>{throw new Error('Storage disabled');}}),/Storage disabled/);
checks.push('Storage read/write failures propagate without modifying prior records');
console.log(JSON.stringify({passed:checks.length,checks,scope:'Input, storage and arithmetic behavior only; no clinical interpretation or validation'},null,2));
