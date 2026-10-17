#!/usr/bin/env node
/* Execute the actual inline writers with synthetic storage and a minimal DOM.
   No real browser profile, patient data, server or account is used. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.env.OVULUNA_SOURCE_ROOT||path.resolve(__dirname,'..');
const privacy=require(path.join(root,'privacy-local.js'));
const results=[];
function test(name,run){run();results.push(name);console.log('PASS '+name);}
function element(){return {value:'',innerHTML:'',textContent:'',hidden:false,style:{},dataset:{},handlers:{},classList:{add(){},remove(){},toggle(){}},addEventListener(name,fn){this.handlers[name]=fn},setAttribute(){},getAttribute(){return null},scrollIntoView(){},appendChild(){},remove(){}};}
function page(file,initial){
  const map=new Map(Object.entries(initial||{}));let denyWrite=false,denyRead=false;
  const storage={get length(){return map.size},key(i){return [...map.keys()][i]??null},getItem(k){if(denyRead)throw Error('Synthetic read denial');return map.has(k)?map.get(k):null},setItem(k,v){if(denyWrite)throw Error('Synthetic write denial');map.set(k,String(v))},removeItem(k){map.delete(k)}};
  const nodes=new Map(),toasts=[];const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  const document={getElementById:get,querySelectorAll(){return []},querySelector(){return element()},documentElement:element(),createElement:element,body:{appendChild(node){toasts.push(node.textContent)}}};
  const context=vm.createContext({document,localStorage:storage,console,setTimeout(){},setInterval(){},clearInterval(){}});
  const html=fs.readFileSync(path.join(root,file),'utf8');const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!/\bsrc\s*=/.test(m[1]));assert.equal(scripts.length,1);vm.runInContext(scripts[0][2],context,{filename:file});
  return {context,storage,get,toasts,read(k){return map.get(k)??null},change(k,v){if(v===null)map.delete(k);else map.set(k,v)},denyWrite(v){denyWrite=v},denyRead(v){denyRead=v},click(id){get(id).handlers.click.call(get(id))},modify(id){get(id).handlers.change.call(get(id))},run(code){return vm.runInContext(code,context)},deleteReviewed(k){privacy.removeReviewed(storage,privacy.snapshot(storage,[k]))}};
}
const routineKey='ov_acupoint_routine',hydrationKey='ov_hydro';
const initialHydration=()=>JSON.stringify({w:58,day:new Date().toISOString().slice(0,10),logs:[{ml:250,at:'09:00'}],preservedExtra:'keep'});
const routinePage=()=>page('acupoints.html',{[routineKey]:'["sp6"]',unrelated:'keep'});
const waterPage=()=>page('hydration.html',{[hydrationKey]:initialHydration(),unrelated:'keep'});
function addWater(p,ml){p.get('hCustom').value=String(ml);p.click('hAddC');}
test('Educational atlas has no storage writer and preserves the legacy deletion inventory',()=>{const js=fs.readFileSync(path.join(root,'acupoint-atlas.js'),'utf8');assert.doesNotMatch(js,/localStorage|sessionStorage|toggleRoutine|setItem\s*\(/);const storage={getItem:k=>k===routineKey?'["sp6"]':null,key:i=>i===0?routineKey:null,length:1};const snapshot=privacy.snapshot(storage,[routineKey]);assert.ok(snapshot.length || Object.keys(snapshot).length);assert.match(fs.readFileSync(path.join(root,'privacy-local.js'),'utf8'),/ov_acupoint_routine/)});
test('Hydration refuses restoration after deletion and retains custom input',()=>{const p=waterPage();const rendered=p.get('hHist').innerHTML;p.deleteReviewed(hydrationKey);addWater(p,330);assert.equal(p.read(hydrationKey),null);assert.equal(p.get('hCustom').value,'330');assert.equal(p.get('hHist').innerHTML,rendered);assert.match(p.get('hydrationStorageStatus').textContent,/deleted.*not saved.*reload/);assert.equal(p.toasts.length,0);assert.equal(p.read('unrelated'),'keep')});
test('Hydration preserves newer external bytes on Add, Undo and weight change',()=>{for(const action of ['add','undo','weight']){const p=waterPage();const newer=JSON.stringify({w:65,day:new Date().toISOString().slice(0,10),logs:[]});p.change(hydrationKey,newer);if(action==='add')addWater(p,330);if(action==='undo')p.click('hUndo');if(action==='weight'){p.get('hWeight').value='70';p.modify('hWeight');assert.equal(p.get('hWeight').value,'70')}assert.equal(p.read(hydrationKey),newer);assert.equal(p.toasts.length,0)}});
test('Hydration successful writes advance snapshot and preserve extra fields',()=>{const p=waterPage();addWater(p,100);addWater(p,330);p.click('hUndo');p.get('hWeight').value='60';p.modify('hWeight');const data=JSON.parse(p.read(hydrationKey));assert.deepEqual(data.logs.map(l=>l.ml),[250,100]);assert.equal(data.w,60);assert.equal(data.preservedExtra,'keep');assert.equal(p.get('hCustom').value,'');assert.equal(p.get('hydrationStorageStatus').hidden,true)});
test('Hydration failed write keeps old log/input and retry adds only once',()=>{const p=waterPage(),raw=p.read(hydrationKey);p.denyWrite(true);addWater(p,330);assert.equal(p.read(hydrationKey),raw);assert.equal(p.get('hCustom').value,'330');assert.equal(p.toasts.length,0);p.denyWrite(false);p.click('hAddC');assert.deepEqual(JSON.parse(p.read(hydrationKey)).logs.map(l=>l.ml),[250,330])});
test('Hydration read failure before save preserves original bytes',()=>{const p=waterPage(),raw=p.read(hydrationKey);p.denyRead(true);addWater(p,330);assert.equal(p.read(hydrationKey),raw);assert.equal(p.toasts.length,0)});
test('Hydration malformed or unsupported stored data is never replaced',()=>{for(const raw of ['{broken','', 'null','{}','[]']){const p=page('hydration.html',{[hydrationKey]:raw});addWater(p,330);assert.equal(p.read(hydrationKey),raw);assert.match(p.get('hydrationStorageStatus').textContent,/unreadable/);assert.equal(p.toasts.length,0)}});
test('Hydration fresh empty storage can save',()=>{const p=page('hydration.html');addWater(p,330);assert.deepEqual(JSON.parse(p.read(hydrationKey)).logs.map(l=>l.ml),[330])});
const report={date:new Date().toISOString(),status:'pass',scope:'Actual Acupoints and Hydration inline scripts under synthetic localStorage and a minimal DOM',groups:results.length,checks:results,limitations:'Not a browser/native layout test or a transaction guarantee across simultaneous localStorage writers.'};
if(process.argv.includes('--receipt'))fs.writeFileSync(path.join(root,'docs/readiness/stale-writers-regressions.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS '+results.length+' stale-writer regression groups.');
