#!/usr/bin/env node
/* Pure storage regressions plus optional isolated browser checks. No user profile,
 * remote endpoint or patient records are used. --browser requires Playwright. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const api=require(path.join(root,'privacy-local.js'));
function store(values={}) { const map=new Map(Object.entries(values)); return { get length(){return map.size},key(i){return [...map.keys()][i]??null},getItem(k){return map.has(k)?map.get(k):null},setItem(k,v){map.set(k,String(v))},removeItem(k){map.delete(k)},map }; }
let count=0;function test(name,run){run();count++;console.log('PASS '+name)}
const lab='ovuluna_lab_records_v1',legacy='ovuluna_luna';
test('inventory preserves raw stores and excludes unrelated/unknown keys',()=>{const s=store({[lab]:' [ invalid json ',[legacy]:'private old text',unrelated:'keep',ovuluna_unknown:'keep'}),before=[...s.map];assert.equal(api.inventory(s).length,2);assert.deepEqual([...s.map],before)});
test('legacy daily dates are individually recognized without prefix-wide deletion',()=>{assert.equal(api.definition('ovuluna_daily_log_2026-09-11').group,'legacy');assert.equal(api.definition('ovuluna_daily_log_secret'),null)});
test('export is byte-exact for malformed JSON and hostile text',()=>{const raw='<img onerror=bad()>\\n{broken',s=store({[lab]:raw});assert.equal(api.exportData(s,[lab],'http://localhost').stores[0].raw,raw);assert.equal(s.getItem(lab),raw)});
test('empty and unrecognized selections fail without changes',()=>{const s=store({unrelated:'keep'});assert.throws(()=>api.snapshot(s,[]));assert.throws(()=>api.snapshot(s,['unrelated']));assert.equal(s.getItem('unrelated'),'keep')});
test('delete scope leaves legacy and unrelated bytes intact',()=>{const s=store({[lab]:'a',[legacy]:'b',unrelated:'c'});assert.deepEqual(api.removeReviewed(s,api.snapshot(s,[lab])).deleted,[lab]);assert.equal(s.getItem(legacy),'b');assert.equal(s.getItem('unrelated'),'c')});
test('legacy deletion requires that exact key in reviewed selection',()=>{const s=store({[legacy]:'a',ovuluna_ovarian_age:'b'});api.removeReviewed(s,api.snapshot(s,[legacy]));assert.equal(s.getItem(legacy),null);assert.equal(s.getItem('ovuluna_ovarian_age'),'b')});
test('changed data aborts entire reviewed deletion',()=>{const s=store({[lab]:'a',[legacy]:'b'}),snap=api.snapshot(s,[lab,legacy]);s.setItem(legacy,'new');assert.throws(()=>api.removeReviewed(s,snap),/changed/);assert.equal(s.getItem(lab),'a');assert.equal(s.getItem(legacy),'new')});
test('missing item aborts selection and unauthorized reviewed key fails',()=>{const s=store({unrelated:'a'});assert.throws(()=>api.snapshot(s,[lab]));assert.throws(()=>api.removeReviewed(s,[{key:'unrelated',raw:'a'}]));assert.equal(s.getItem('unrelated'),'a')});
test('partial storage failure is accurately reported',()=>{const s=store({[lab]:'a',[legacy]:'b'}),original=s.removeItem;s.removeItem=k=>{if(k===legacy)throw new Error('blocked');original(k)};const r=api.removeReviewed(s,api.snapshot(s,[lab,legacy]));assert.deepEqual(r.deleted,[lab]);assert.deepEqual(r.failed,[legacy]);assert.equal(s.getItem(legacy),'b')});
test('duplicate selections are exported only once',()=>{assert.equal(api.snapshot(store({[lab]:'a'}),[lab,lab]).length,1)});
test('all generated Luna guide destinations exist',()=>{const source=fs.readFileSync(path.join(root,'luna-chat.js'),'utf8'),links=[...source.matchAll(/(?:link:|privacy\.href\s*=)\s*'([^']+\.html)'/g)].map(match=>match[1]);assert(links.length>=5);for(const link of links)assert(fs.statSync(path.join(root,link)).isFile(),link)});
test('onboarding, language, units and local nickname are included in exact reviewed export',()=>{const values={ovuluna_onboarding:'{\"age\":36,\"unknown\":\"keep\"}',ovuluna_language:'en',ovuluna_units:'metric',ovuluna_preferences_v1:'{\"nickname\":\"Pearl\"}',unrelated:'keep'},s=store(values);const keys=api.inventory(s).map(item=>item.key);assert.equal(keys.length,4);const output=api.exportData(s,keys,'https://ovuluna.test');for(const row of output.stores)assert.equal(row.raw,values[row.key]);assert.deepEqual([...s.map],Object.entries(values));});
test('selected onboarding deletion preserves unselected nickname/units and unknown stores',()=>{const s=store({ovuluna_onboarding:'{broken',ovuluna_preferences_v1:'{\"nickname\":\"Pearl\"}',ovuluna_units:'metric',unrelated:'keep'});api.removeReviewed(s,api.snapshot(s,['ovuluna_onboarding']));assert.equal(s.getItem('ovuluna_onboarding'),null);assert.equal(s.getItem('ovuluna_units'),'metric');assert.equal(s.getItem('ovuluna_preferences_v1'),'{\"nickname\":\"Pearl\"}');assert.equal(s.getItem('unrelated'),'keep');});
test('legacy loggedIn appearance can be reviewed/deleted without being treated as real authentication',()=>{const raw='{\"provider\":\"email\",\"loggedIn\":true}',s=store({ovuluna_auth:raw,unrelated:'keep'});assert.equal(api.definition('ovuluna_auth').group,'legacy');assert.match(api.definition('ovuluna_auth').label,/not a verified account/);const snap=api.snapshot(s,['ovuluna_auth']);assert.equal(snap[0].raw,raw);api.removeReviewed(s,snap);assert.equal(s.getItem('ovuluna_auth'),null);assert.equal(s.getItem('unrelated'),'keep');});
test('Daily context, routine and completion history require exact reviewed deletion and never include account credentials',()=>{const keys=['ovuluna_daily_context_v1','ovuluna_daily_routine_v1','ovuluna_daily_completions_v1'];const s=store(Object.fromEntries(keys.map((key,i)=>[key,'raw-'+i])));s.setItem('ovuluna_unknown','keep');const exported=api.exportData(s,keys,'https://ovuluna.test');assert.deepEqual(exported.stores.map(x=>x.raw),['raw-0','raw-1','raw-2']);assert.equal(api.definition('ovuluna_session'),null);api.removeReviewed(s,api.snapshot(s,[keys[1]]));assert.equal(s.getItem(keys[1]),null);assert.equal(s.getItem(keys[0]),'raw-0');assert.equal(s.getItem(keys[2]),'raw-2');assert.equal(s.getItem('ovuluna_unknown'),'keep');});
console.log('PASS '+count+' local storage/link regression groups.');
if(!process.argv.includes('--browser'))process.exit(0);
(async()=>{
 const {chromium}=require(process.env.OVULUNA_PLAYWRIGHT_MODULE||'playwright');
 const base=new URL(process.env.OVULUNA_TEST_URL||'http://localhost:4197');assert(['localhost','127.0.0.1'].includes(base.hostname));
 const browser=await chromium.launch({headless:true,executablePath:process.env.OVULUNA_CHROME_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
 const context=await browser.newContext({viewport:{width:320,height:780},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],apiRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')){apiRequests.push(u.pathname);return r.abort()}return ['localhost','127.0.0.1'].includes(u.hostname)||['blob:','data:'].includes(u.protocol)?r.continue():r.abort()});
 try{
  await page.goto(new URL('privacy.html',base).href);await page.evaluate(()=>{localStorage.setItem('ovuluna_theme','dark');localStorage.setItem('ovuluna_fontsize','xlarge');localStorage.setItem('ovuluna_lab_records_v1','{synthetic malformed');localStorage.setItem('ovuluna_luna','<img src=x onerror=alert(1)> legacy');localStorage.setItem('unrelated_test','keep')});await page.reload();
  // Settings is the user-facing entry point; account entry must never claim a deletion.
  await page.goto(new URL('settings.html',base).href);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
  await page.locator('#settings-delete-account').click();await page.waitForFunction(()=>document.activeElement?.id==='privacy-account-title');
  assert.equal(new URL(page.url()).hash,'#privacy-account-title');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'privacy-account-title');
  assert.match(await page.locator('.privacy-account').textContent(),/No connected account in this build/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_lab_records_v1')),'{synthetic malformed');
  await page.goto(new URL('settings.html',base).href);await page.locator('#settings-delete-data').click();await page.waitForFunction(()=>document.activeElement?.id==='privacy-local-title');
  assert.equal(new URL(page.url()).hash,'#privacy-local-title');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'privacy-local-title');
  await page.locator('#privacy-select-all').click();
  assert.equal(await page.locator('#privacy-stores input:checked').count(),await page.locator('#privacy-stores input').count());
  assert.equal(await page.locator('#privacy-stores input[value="unrelated_test"]').count(),0);
  await page.locator('#privacy-clear-selection').click();
  assert.equal(await page.locator('#privacy-stores input:checked').count(),0);assert(await page.locator('#privacy-export').isDisabled());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
  const pick=page.locator('#privacy-stores input[value="'+lab+'"]');await pick.check();await page.locator('#privacy-export').click();const exported=JSON.parse(await page.locator('#privacy-export-json').inputValue());assert.equal(exported.stores[0].raw,'{synthetic malformed');assert.equal(exported.stores.length,1);assert.equal(await page.locator('#privacy-stores img').count(),0);
  const downloadEvent=page.waitForEvent('download');await page.locator('#privacy-download').click();const download=await downloadEvent;assert.match(download.suggestedFilename(),/ovuluna-local-data.*json/);
  await page.locator('#privacy-review-delete').click();assert(await page.locator('#privacy-delete-dialog').isVisible());assert(await page.locator('#privacy-confirm-delete').isDisabled());await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_lab_records_v1')),'{synthetic malformed');assert.equal(await page.evaluate(()=>document.activeElement.id),'privacy-review-delete');
  // Both explicit Cancel and export-first leave selected records unchanged.
  await page.locator('#privacy-review-delete').click();await page.locator('#privacy-cancel-delete').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_lab_records_v1')),'{synthetic malformed');
  await page.locator('#privacy-review-delete').click();await page.locator('#privacy-export-before-delete').click();
  assert(await page.locator('#privacy-delete-dialog').isHidden());assert(await page.locator('#privacy-export-result').isVisible());
  assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_lab_records_v1')),'{synthetic malformed');
  await page.locator('#privacy-review-delete').click();await page.locator('#privacy-delete-agree').check();await page.locator('#privacy-confirm-delete').click();assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_lab_records_v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_luna')),'<img src=x onerror=alert(1)> legacy');assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated_test')),'keep');assert(await page.locator('#privacy-export-result').isHidden());
  // Open review then alter selected data, without touching a real user's storage.
  const legacyPick=page.locator('#privacy-stores input[value="'+legacy+'"]');await legacyPick.check();await page.locator('#privacy-review-delete').click();await page.evaluate(()=>localStorage.setItem('ovuluna_luna','changed synthetic value'));await page.locator('#privacy-delete-agree').check();await page.locator('#privacy-confirm-delete').click();assert.match(await page.locator('#privacy-status').textContent(),/changed/);assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_luna')),'changed synthetic value');
  // One failed removal must remain listed, with partial outcome and no false all-deleted claim.
  await page.evaluate(()=>{localStorage.setItem('ovuluna_lab_records_v1','synthetic partial');window.testRemoveItem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='ovuluna_luna')throw new DOMException('Test denial','SecurityError');return window.testRemoveItem.call(this,key)}});
  await page.reload();
  // Reload clears the temporary patch; apply it only within this isolated test page.
  await page.evaluate(()=>{window.testRemoveItem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='ovuluna_luna')throw new DOMException('Test denial','SecurityError');return window.testRemoveItem.call(this,key)}});
  await page.locator('#privacy-stores input[value="'+lab+'"]').check();await page.locator('#privacy-stores input[value="'+legacy+'"]').check();
  await page.locator('#privacy-review-delete').click();await page.locator('#privacy-delete-agree').check();await page.locator('#privacy-confirm-delete').click();
  assert.match(await page.locator('#privacy-status').textContent(),/1 selected items deleted.*1 could not be deleted/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_lab_records_v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('ovuluna_luna')),'changed synthetic value');
  await page.evaluate(()=>{Storage.prototype.removeItem=window.testRemoveItem;delete window.testRemoveItem});
  // Native origin handling: no browser-download success claim and data still selectable.
  await page.locator('#privacy-stores input[value="'+legacy+'"]').check();await page.locator('#privacy-export').click();await page.evaluate(()=>{window.OvulunaRuntime=Object.freeze({platform:'ios-development',apiBase:null})});await page.locator('#privacy-download').click();assert.match(await page.locator('#privacy-status').textContent(),/Native file sharing is not connected/);
  // A closed guide has no reachable panel controls; opening never imports old chat.
  assert(await page.locator('#lunaPanel').isHidden());await page.locator('#lunaBtn').click();assert(await page.locator('#lunaPanel').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.id),'lunaClose');assert(!(await page.locator('#lunaMessages').textContent()).includes('changed synthetic'));
  await page.locator('.luna-suggestions button').filter({hasText:'Ovarian reserve'}).click();assert.match(await page.locator('#lunaMessages').textContent(),/no validated ovarian-age/);const source=page.locator('#lunaMessages .qi').last();await source.click();await page.keyboard.press('Escape');assert(await source.evaluate(el=>el===document.activeElement));
  await page.locator('#lunaInput').fill('<img src=x onerror=alert(1)>');await page.locator('#lunaSend').click();assert.equal(await page.locator('#lunaMessages img').count(),0);
  await page.locator('#lunaInput').fill('HRV stress fasting');await page.locator('#lunaSend').click();assert.match(await page.locator('#lunaMessages').textContent(),/cannot diagnose stress/);
  const legacyAfter=await page.evaluate(()=>localStorage.getItem('ovuluna_luna'));assert.equal(legacyAfter,'changed synthetic value');assert.equal(await page.evaluate(()=>new Promise(resolve=>OvulunaLuna.ask('analyze my data',(reply,error)=>resolve(reply===null&&error.startsWith('authentication_required'))))),true);
  assert.equal(apiRequests.length,0);await page.locator('#lunaClear').click();assert.equal(await page.locator('#lunaMessages .luna-msg').count(),1);
  const geometry=await page.locator('#lunaPanel').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollHeight,client:el.clientHeight}});assert(geometry.left>=0&&geometry.right<=320&&geometry.top>=0&&geometry.bottom<=780);assert(geometry.scroll<=geometry.client+1,'guide shell must fit; only conversation scrolls');
  await page.screenshot({path:'/private/tmp/ovuluna-luna-privacy-320.png'});
  await page.locator('#lunaInput').focus();await page.keyboard.press('Escape');assert(await page.locator('#lunaPanel').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'lunaBtn');
  for(const theme of ['light','dark'])for(const width of [320,390]){await page.setViewportSize({width,height:640});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.locator('#lunaBtn').click();const g=await page.locator('#lunaPanel').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollHeight,client:el.clientHeight}});assert(g.left>=0&&g.right<=width&&g.top>=0&&g.bottom<=640);assert(g.scroll<=g.client+1);await page.locator('#lunaClose').click()}
  // Every Settings deletion action remains inside the narrow viewport at the largest app text.
  const settings=await context.newPage();
  for(const theme of ['light','dark'])for(const width of [320,390]){
    await settings.setViewportSize({width,height:780});await settings.goto(new URL('settings.html',base).href);await settings.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.equal(await settings.evaluate(()=>document.documentElement.scrollWidth),width);
    for(const id of ['settings-delete-data','settings-delete-account']){await settings.locator('#'+id).scrollIntoViewIfNeeded();const g=await settings.locator('#'+id).boundingBox();assert(g&&g.x>=0&&g.x+g.width<=width&&g.height>=44)}
    if(theme==='dark'&&width===320)await settings.screenshot({path:'/private/tmp/ovuluna-settings-delete-320.png'});
  }
  await settings.close();
  // Unreviewed metadata is not represented as a reviewed source.
  await page.locator('#lunaBtn').click(); await page.evaluate(()=>{EVIDENCE_DB['ovarian-age-concept'].verification.status='pending'}); await page.locator('.luna-suggestions button').filter({hasText:'Ovarian reserve'}).click(); assert.equal(await page.locator('#lunaMessages .luna-msg').last().locator('.qi').count(),0); assert.match(await page.locator('#lunaMessages .luna-msg').last().textContent(),/Source review unavailable/); await page.locator('#lunaClose').click();
  // A storage-denied browser can still use the guide, and local-data actions fail visibly.
  const denied=await context.newPage(); await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})); await denied.goto(new URL('privacy.html',base).href); await denied.locator('#lunaBtn').click(); assert(await denied.locator('#lunaPanel').isVisible()); assert.match(await denied.locator('#privacy-status').textContent(),/storage is unavailable/); assert(await denied.locator('#privacy-export').isDisabled()); await denied.close();
  assert.deepEqual(errors,[]);
  console.log('PASS isolated browser: Settings data/account navigation and focus, truthful account-unavailable state, select/clear all, exact export/download, confirmation/Cancel/Escape/export-first, scoped deletion, stale review, partial failure, native export limitation, offline guide/source/focus/XSS, zero API calls, legacy preservation, 320/390px light/dark A++ Settings and guide panels.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
