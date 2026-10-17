#!/usr/bin/env node
/* Static source verification only. No network, DOM execution or clinical review.
   Usage: node scripts/check-site.cjs [--root DIR] [--output FILE]
   Only the evidence data object is evaluated in an isolated, timed VM.
*/
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const root = path.resolve(option('--root', path.join(__dirname, '..')));
const output = path.resolve(option('--output', path.join(root, 'docs/readiness/scoring-site-static.json')));
const failures = [], unresolved = [], references = [], scripts = [], evidenceTriggers = [];
const htmlPages = fs.readdirSync(root).filter(file => file.endsWith('.html')).sort();
const loadedScripts = new Map(), loadedStyles = new Set(), pageScripts = new Map();
function relative(file) { return path.relative(root, file).split(path.sep).join('/'); }
function entity(text) {
  return text.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, token => {
    const named = { '&amp;':'&', '&quot;':'"', '&apos;':"'", '&lt;':'<', '&gt;':'>' };
    if (named[token.toLowerCase()]) return named[token.toLowerCase()];
    const number = token[2].toLowerCase() === 'x' ? parseInt(token.slice(3, -1), 16) : parseInt(token.slice(2, -1), 10);
    return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : token;
  });
}
function attributes(raw) {
  const attrs = {};
  for (const m of raw.matchAll(/([^\s=<>\/'"]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>]+)))?/g)) attrs[m[1].toLowerCase()] = entity(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}
function fail(file, reason, details = {}) { failures.push({ file:relative(file), reason, ...details }); }
function resolveRef(file, raw, kind) {
  const ref = entity(raw).trim();
  if (!ref || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref)) return null;
  if (/[${}]/.test(ref) || /["']\s*\+|\+\s*["']/.test(ref)) { unresolved.push({file:relative(file),kind,ref,reason:'Computed reference requires runtime verification'}); return null; }
  let target;
  try { target = decodeURIComponent(ref.split(/[?#]/)[0]); } catch (_) { fail(file,'Invalid encoded local reference',{kind,ref}); return null; }
  if (!target) return null;
  let resolved = path.resolve(target.startsWith('/') ? root : path.dirname(file), target.replace(/^\//,''));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) { fail(file,'Reference escapes website root',{kind,ref}); return null; }
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) resolved = path.join(resolved,'index.html');
  references.push({from:relative(file),kind,ref,to:relative(resolved)});
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) { fail(file,'Missing local target',{kind,ref,target:relative(resolved)}); return null; }
  return resolved;
}
function compile(code, file, label, module = false, handler = false, commonjs = false) {
  if (!code.trim()) return;
  scripts.push({file:relative(file),label,type:module?'module':commonjs?'commonjs':handler?'event-handler':'classic'});
  try {
    if (module) {
      const result = spawnSync(process.execPath,['--check','--input-type=module'],{input:code,encoding:'utf8'});
      if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim());
    } else {
      const clean = commonjs ? code.replace(/^#![^\n]*/, '') : code;
      const program = commonjs ? '(function(exports,require,module,__filename,__dirname){\n' + clean + '\n})' : handler ? '(function(event){\n' + clean + '\n})' : clean;
      new vm.Script(program,{filename:relative(file) + ':' + label});
    }
  } catch(error) { fail(file,'JavaScript syntax error',{label,error:error.message}); }
}
function cssReferences(code,file) {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g,'');
  for (const m of clean.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const target = resolveRef(file,m[1]??m[2]??m[3],'css-url');
    if (target && target.endsWith('.css')) loadCss(target);
  }
  for (const m of clean.matchAll(/@import\s+["']([^"']+)["']/gi)) { const target=resolveRef(file,m[1],'css-import'); if(target)loadCss(target); }
}
function loadCss(file) { if(loadedStyles.has(file))return;loadedStyles.add(file);cssReferences(fs.readFileSync(file,'utf8'),file); }
function collectTags(code,file,dynamicMarkup = false) {
  for (const m of code.matchAll(/<([A-Za-z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const tag=m[1].toLowerCase(),attrs=attributes(m[2]);
    for (const key of ['href','src','poster','data']) {
      if (attrs[key] === undefined || (key==='data' && tag!=='object')) continue;
      const target = resolveRef(file,attrs[key],dynamicMarkup?'script-markup-'+key:key);
      if (!target) continue;
      if (tag==='link' && key==='href' && (attrs.rel||'').split(/\s+/).includes('stylesheet')) loadCss(target);
      if (tag==='script' && key==='src') {
        if (!pageScripts.has(file)) pageScripts.set(file,new Set());
        pageScripts.get(file).add(target);
        loadJs(target,attrs.type==='module');
      }
    }
    if (attrs.style) cssReferences(attrs.style,file);
    for (const [key,value] of Object.entries(attrs)) if(/^on[a-z]+$/.test(key)) {
      // A JS string's escape sequences are source syntax, not the emitted HTML.
      // Do not compile those fragments as though they were browser attributes.
      if(dynamicMarkup && value.includes('\\')) unresolved.push({file:relative(file),kind:'script-markup-'+key,ref:value,reason:'Handler inside escaped JavaScript markup requires runtime verification; its containing script is parsed'});
      else compile(value,file,'inline '+key,false,true);
    }
    if (attrs['data-evidence'] !== undefined) {
      const key=attrs['data-evidence'];
      if (/[${}]/.test(key) || /["']\s*\+|\+\s*["']/.test(key)) unresolved.push({file:relative(file),kind:'evidence-key',ref:key,reason:'Computed evidence key requires runtime verification'});
      else evidenceTriggers.push({file:relative(file),key,hasQiClass:(attrs.class||'').split(/\s+/).includes('qi'),dynamicMarkup});
    }
  }
}
function scriptReferences(code,file) {
  collectTags(code,file,true);
  for(const m of code.matchAll(/["'](\/?[a-z][a-z0-9-]*\.html)["']/gi))resolveRef(file,m[1],'script-page-literal');
  for(const m of code.matchAll(/(?:import|export)\s+[^;\n]*?\bfrom\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g)) {
    const spec=m[1]||m[2];if(spec.startsWith('.')||spec.startsWith('/')) {const target=resolveRef(file,spec,'module-import');if(target)loadJs(target,true);}
  }
}
function loadJs(file,module=false) {
  const identity=file+':'+module;if(loadedScripts.has(identity))return;
  const code=fs.readFileSync(file,'utf8');loadedScripts.set(identity,file);compile(code,file,'external script',module);
  // Literal HTML strings and page maps are static leads, not proof they execute.
  scriptReferences(code,file);
}
for (const name of htmlPages) {
  const file=path.join(root,name),raw=fs.readFileSync(file,'utf8');
  if (!raw.trim() || !/<body\b/i.test(raw)) fail(file,'Empty document or missing body');
  let clean=raw.replace(/<!--[\s\S]*?-->/g,'');
  clean=clean.replace(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi,(match,rawAttrs,body)=>{
    const attrs=attributes(rawAttrs),type=(attrs.type||'').toLowerCase();
    collectTags('<script '+rawAttrs+'>',file);
    if(!attrs.src && (!type||/^(?:text|application)\/(?:java|ecma)script$/.test(type)||type==='module')) {
      compile(body,file,'inline script',type==='module');scriptReferences(body,file);
    }
    return '';
  });
  clean=clean.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,(_,code)=>{cssReferences(code,file);return '';});
  collectTags(clean,file);
}
// Also parse standalone app/controller and regression scripts, without executing them.
// Node/API parse checks are kept distinct from browser-script checks.
const alreadyParsed = new Set(scripts.map(check => check.file));
for (const directory of [root,path.join(root,'scripts'),path.join(root,'api')]) {
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory).filter(name => /\.(?:js|cjs|mjs)$/.test(name)).sort()) {
    const file=path.join(directory,name);
    if(!fs.statSync(file).isFile()||alreadyParsed.has(relative(file)))continue;
    const code=fs.readFileSync(file,'utf8');
    const module=name.endsWith('.mjs')||(directory===path.join(root,'api')&&/^\s*(?:import|export)\b/m.test(code));
    compile(code,file,directory===path.join(root,'scripts')?'regression script (parse only)':'standalone source (parse only)',module,false,name.endsWith('.cjs'));
  }
}
let database={};
const databaseFile=path.join(root,'evidence-db.js');
try {
  const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(databaseFile,'utf8'),context,{timeout:1000,filename:'evidence-db.js'});
  database=context.window.EVIDENCE_DB;
  if(!database||typeof database!=='object'||Array.isArray(database))throw new Error('Database did not expose an object');
  // Optional source bundles are pure data. Match the browser's merge order.
  for (const [file, key] of [['evidence-reconciled.js','RECONCILED_EVIDENCE'],['evidence-lifecycle.js','LIFECYCLE_EVIDENCE'],['evidence-acupoint.js','ACUPOINT_EVIDENCE'],['evidence-safety.js','SAFETY_EVIDENCE'],['evidence-core.js','CORE_EVIDENCE'],['evidence-daily.js','DAILY_EVIDENCE']]) {
    const source=path.join(root,file);
    if (!fs.existsSync(source)) continue;
    vm.runInContext(fs.readFileSync(source,'utf8'),context,{timeout:1000,filename:file});
    Object.assign(database,context.window[key] || {});
  }
} catch(error) { fail(databaseFile,'Evidence database cannot be read',{error:error.message});database={}; }
const sourceCounts = new Map();
for(const [key,entry] of Object.entries(database)) {
  const sources=Array.isArray(entry?.sources)?entry.sources.slice():[];
  if(entry?.source&&typeof entry.source==='object')sources.push(entry.source);
  const identities=new Set(sources.filter(source=>source&&typeof source==='object'&&!Array.isArray(source))
    .map(source=>[source.url,source.doi,source.pmid,source.title].map(value=>typeof value==='string'?value:'').join('|')));
  identities.delete('|||');
  sourceCounts.set(key,identities.size);
}
for(const trigger of evidenceTriggers) {
  const file=path.join(root,trigger.file),entry=Object.hasOwn(database,trigger.key)?database[trigger.key]:undefined;
  if(!entry||typeof entry!=='object'||Array.isArray(entry))fail(file,'Missing resolvable evidence entry',{key:trigger.key});
  else if(!sourceCounts.get(trigger.key))fail(file,'Evidence entry has no source metadata',{key:trigger.key});
  if(!trigger.hasQiClass)fail(file,'Evidence trigger does not match .qi[data-evidence] handler',{key:trigger.key});
  if(!trigger.dynamicMarkup && file.endsWith('.html')) {
    const loaded=pageScripts.get(file)||new Set();
    for(const required of ['evidence.js','evidence-db.js'])if(!loaded.has(path.join(root,required)))fail(file,'Evidence trigger is missing its required script',{key:trigger.key,required});
  }
}
const pageLinks=references.filter(ref=>ref.to.endsWith('.html'));
const inbound=new Set(pageLinks.map(ref=>ref.to));
const noDiscoveredInbound=htmlPages.filter(name=>!['index.html','ppg-review.html'].includes(name)&&!inbound.has(name));
// A no-inbound page is informative: pages can also be reached by runtime routing.
const report={
  generatedAt:new Date().toISOString(),root,
  scope:'Static document, reference, JavaScript syntax and evidence-key presence checks only. Passing does not prove UI behavior, backend integrations, citation correctness, clinical validity or publication readiness.',
  pages:htmlPages.length,learnLeafPages:htmlPages.filter(name=>/^learn-.+\.html$/.test(name)).length,
  scriptsParsed:scripts.length,filesContainingParsedScripts:new Set(scripts.map(check=>check.file)).size,javaScriptFilesParsed:new Set(scripts.map(check=>check.file).filter(file=>/\.(?:js|cjs|mjs)$/.test(file))).size,inlineScriptBlocks:scripts.filter(check=>check.label==='inline script').length,eventHandlersParsed:scripts.filter(check=>check.type==='event-handler').length,externalScriptFiles:new Set(loadedScripts.values()).size,stylesheetsChecked:loadedStyles.size,
  localReferences:references.length,localPageLinks:pageLinks.length,
  evidence:{databaseEntries:Object.keys(database).length,sourceMetadataRecords:[...sourceCounts.values()].reduce((sum,count)=>sum+count,0),entriesWithoutSourceMetadata:[...sourceCounts].filter(([,count])=>!count).map(([key])=>key),triggerOccurrences:evidenceTriggers.length,distinctKeys:new Set(evidenceTriggers.map(t=>t.key)).size,coverage:'Record/source-metadata presence and required evidence-script references only; metadata counts are not verified citations. Source validity and runtime handler behavior are not checked'},
  noDiscoveredInbound,unresolved,failures,passed:failures.length===0,
  checkedPages:htmlPages,scriptChecks:scripts
};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,pages:report.pages,scriptsParsed:report.scriptsParsed,localReferences:report.localReferences,localPageLinks:report.localPageLinks,evidence:report.evidence,unresolved,failures,passed:report.passed},null,2));
process.exitCode=report.passed?0:1;
