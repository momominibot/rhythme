#!/usr/bin/env node
/* Checks the generated asset boundary, not clinical or native device behavior. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'www');
const manifest=JSON.parse(fs.readFileSync(path.join(web,'build-manifest.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(root,'capacitor.config.json'),'utf8'));
const checks=[];
assert.equal(manifest.schema,1);
assert.ok(['web','ios-development'].includes(manifest.target));
assert.equal(typeof manifest.sourceDirty,'boolean');
assert.match(manifest.revision,/^[a-f0-9]{40}$/);
// Verify the actual directory too; a manifest alone cannot rule out extra files.
const diskFiles=[];
function inspectDirectory(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name);
  assert.ok(!item.isSymbolicLink(),'Symlink in generated bundle: '+full);
  if(item.isDirectory())inspectDirectory(full);
  else {assert.ok(item.isFile(),'Non-file in generated bundle: '+full);diskFiles.push(path.relative(web,full).split(path.sep).join('/'));}
 }
}
inspectDirectory(web);
assert.deepEqual(diskFiles.sort(),[...manifest.files.map(entry=>entry.path),'build-manifest.json'].sort(),'Unmanifested or missing files in generated bundle');
const seen=new Set();
for(const entry of manifest.files){
 assert.ok(!seen.has(entry.path),'Duplicate asset: '+entry.path);seen.add(entry.path);
 assert.ok(!entry.path.split('/').some(part=>part==='..'||part.startsWith('.')),'Hidden or escaping asset');
 assert.ok(!/^(?:api|docs|scripts|ios|node_modules)\//.test(entry.path),'Private source in public build');
 assert.ok(!/\.(?:md|cjs|mjs|swift|plist|env|map)$/.test(entry.path),'Unexpected source file');
 const p=path.resolve(web,entry.path);assert.ok(p.startsWith(web+path.sep));
 const bytes=fs.readFileSync(p);assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,'Stale asset: '+entry.path);
}
checks.push('Every manifest asset has the recorded size/hash and stays inside the public allowlist.');
for(const forbidden of ['api','docs','scripts','ios','node_modules','.git','.env','package.json','package-lock.json','vercel.json'])assert.ok(!fs.existsSync(path.join(web,forbidden)),'Private build input exposed: '+forbidden);
checks.push('Server handlers, dependencies, environment files and project sources are excluded.');
const pages=manifest.files.filter(f=>f.path.endsWith('.html'));
assert.equal(pages.length,91,'Unexpected route count; review the public route inventory.');
for(const {path:file} of pages){
 const html=fs.readFileSync(path.join(web,file),'utf8');
 assert.ok(html.includes('assets/vendor/fonts.css'),file+': missing offline font sheet');
 assert.ok(!/<(?:link|script)\b[^>]*(?:href|src)=["']https?:\/\//i.test(html),file+': remote code/font dependency');
 for(const m of html.matchAll(/<(?:script|link|img|video|source)\b[^>]*(?:src|href|poster)=["']([^"']+)["']/gi)){
  const ref=m[1].split(/[?#]/)[0];
  if(!ref||/^(?:https?:|data:|blob:|#)/.test(ref))continue;
  assert.ok(fs.existsSync(path.resolve(web,ref.replace(/^\//,''))),file+': missing local resource '+ref);
 }
 if(manifest.target==='ios-development'){
  const csp=html.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(csp>=0&&csp<html.indexOf('runtime-config.js'),file+': early native CSP missing');
  assert.ok(html.includes("connect-src 'self'"),file+': unexpected native remote transport');
 }
}
checks.push('All '+pages.length+' bundled routes reference local fonts/scripts and available static resources.');
const runtime=fs.readFileSync(path.join(web,'runtime-config.js'),'utf8');
if(manifest.target==='ios-development'){
 assert.equal(manifest.entry,'home.html');assert.equal(config.server.appStartPath,'/home.html');assert.ok(runtime.includes('"apiBase":null'));
 assert.ok(!config.server.url&&!config.server.allowNavigation&&!config.server.cleartext,'Remote/live-reload native shortcut');
 assert.equal(config.ios.limitsNavigationsToAppBoundDomains,true);assert.equal(config.loggingBehavior,'none');
 assert.equal(config.zoomEnabled,true);assert.equal(config.plugins.CapacitorHttp.enabled,false);
 checks.push('Native launch uses bundledHome with no remote URL/backend, broad navigation, logging or HTTP override.');
}
for(const font of ['newsreader-normal.woff2','newsreader-italic.woff2','manrope.woff2','material-symbols.woff2'])assert.ok(fs.statSync(path.join(web,'assets/vendor',font)).size>1000);
assert.ok(fs.readdirSync(path.join(web,'assets/vendor/licenses')).length>=5);
checks.push('Offline typography and pinned animation assets include their distribution licenses.');
console.log(JSON.stringify({target:manifest.target,passed:true,checks,pages:pages.length,assets:manifest.files.length,limits:'Asset and configuration checks only. Native launch, persistence, media permissions, accessibility and clinical validation require their own evidence.'},null,2));
