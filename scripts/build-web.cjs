#!/usr/bin/env node
/* Reproducible public-asset build. Native output contains the existing UI, local
   fonts/animations and no server source, credentials, docs or dependencies. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const native = process.argv.includes('--native');
const stage = path.join(root, '.build', 'web-next');
const output = path.join(root, 'www');
/* audio (voice clips, sounds, CC0 music), the barcode reader's wasm and its vendored scripts joined the reviewed list on 23 Oct 2026 */
const assetTypes = new Set(['.png','.jpg','.jpeg','.webp','.svg','.gif','.ico','.mp4','.webm','.json','.lottie','.woff','.woff2','.ttf','.txt','.mp3','.wav','.wasm','.js']);
fs.rmSync(stage, { recursive:true, force:true });
fs.mkdirSync(stage, { recursive:true });
function copy(source, target) {
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Symlinks are not public assets: ' + source);
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.copyFileSync(source, target);
}
function assets(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes:true })) {
    if (entry.name.startsWith('.') || entry.name === 'README.md') continue;
    const from=path.join(source,entry.name), to=path.join(target,entry.name);
    if (entry.isSymbolicLink()) throw new Error('Asset symlinks are not supported');
    if (entry.isDirectory()) assets(from,to);
    else if (assetTypes.has(path.extname(entry.name).toLowerCase())) copy(from,to);
    else throw new Error('Unreviewed asset extension: '+from);
  }
}
const remoteScripts = new Map([
 ['https://unpkg.com/@lottiefiles/lottie-player@2.0.8/dist/lottie-player.js','assets/vendor/lottie-player.js'],
 ['https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js','assets/vendor/lottie.min.js']
]);
/* the phone app talks to its own backend (Supabase: sign-in, cloud backup, Luna, the podcast list) and Open Food Facts (barcodes);
   podcast audio and covers stream from their publisher, and the barcode reader compiles its wasm ('wasm-unsafe-eval') */
const policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://zodkohwaznqgrfrcfdkf.supabase.co wss://zodkohwaznqgrfrcfdkf.supabase.co https://world.openfoodfacts.org; object-src 'none'; base-uri 'none'; form-action 'self'";
const publicFiles = fs.readdirSync(root).filter(name=>/\.(html|css|js)$/.test(name)).sort();
for (const name of publicFiles) {
  const from=path.join(root,name);
  if (!fs.lstatSync(from).isFile()) throw new Error('Public source must be a regular file: '+name);
  let text=fs.readFileSync(from,'utf8');
  if (name.endsWith('.html')) {
    // Keep the source pages editable; normalize only generated public output.
    text=text.replace(/<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"']*["'][^>]*>/gi,'');
    for (const [url,local] of remoteScripts) text=text.split(url).join(local);
    if (/<script\b[^>]*src=["']https?:\/\//i.test(text)) throw new Error('Unreviewed remote script: '+name);
    const additions=(native?'<meta http-equiv="Content-Security-Policy" content="'+policy+'">\n':'')+'<link rel="stylesheet" href="assets/vendor/fonts.css">\n<script src="runtime-config.js"></script>\n';
    if (!/<head\b[^>]*>/i.test(text)) throw new Error('No document head: '+name);
    text=text.replace(/<head\b[^>]*>/i,m=>m+'\n'+additions);
  }
  fs.writeFileSync(path.join(stage,name),text);
}
assets(path.join(root,'assets'),path.join(stage,'assets'));
const vendor=path.join(stage,'assets/vendor');
const packages=[
 ['@fontsource-variable/newsreader','files/newsreader-latin-standard-normal.woff2','newsreader-normal.woff2'],
 ['@fontsource-variable/newsreader','files/newsreader-latin-standard-italic.woff2','newsreader-italic.woff2'],
 ['@fontsource-variable/manrope','files/manrope-latin-wght-normal.woff2','manrope.woff2'],
 ['@fontsource/material-symbols-outlined','files/material-symbols-outlined-latin-400-normal.woff2','material-symbols.woff2'],
 ['@lottiefiles/lottie-player','dist/lottie-player.js','lottie-player.js'],
 ['lottie-web','build/player/lottie.min.js','lottie.min.js']
];
for (const [pkg,file,target] of packages) copy(path.join(root,'node_modules',pkg,file),path.join(vendor,target));
for (const pkg of new Set(packages.map(item=>item[0]))) {
 const folder=path.join(root,'node_modules',pkg);
 const license=fs.readdirSync(folder).find(name=>/^licen[sc]e(?:\.|$)/i.test(name));
 if (!license) throw new Error('Missing distribution license: '+pkg);
 copy(path.join(folder,license),path.join(vendor,'licenses',pkg.replace(/[@/]/g,'_')+'.txt'));
}
fs.writeFileSync(path.join(vendor,'fonts.css'),`/* Licensed fonts bundled for offline reading; no remote font requests. */
@font-face{font-family:'Newsreader';font-style:normal;font-weight:200 800;font-display:swap;src:url(newsreader-normal.woff2) format('woff2')}
@font-face{font-family:'Newsreader';font-style:italic;font-weight:200 800;font-display:swap;src:url(newsreader-italic.woff2) format('woff2')}
@font-face{font-family:'Manrope';font-style:normal;font-weight:200 800;font-display:swap;src:url(manrope.woff2) format('woff2')}
@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;font-display:block;src:url(material-symbols.woff2) format('woff2')}
.material-symbols-outlined,.ms{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;font-feature-settings:'liga';-webkit-font-smoothing:antialiased}
`);
let revision='uncommitted';
try { revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(); } catch {}
const sourceDirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());
const runtime={platform:native?'ios-development':'web',apiBase:native?null:'',buildVersion:revision+(sourceDirty?'-working':'')};
fs.writeFileSync(path.join(stage,'runtime-config.js'),'window.OvulunaRuntime=Object.freeze('+JSON.stringify(runtime)+');\n');
const entries=[];
function inventory(dir) {
 for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
  const p=path.join(dir,item.name);
  if(item.isDirectory())inventory(p);
  else {const bytes=fs.readFileSync(p);entries.push({path:path.relative(stage,p).split(path.sep).join('/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 }
}
inventory(stage);
const manifest={schema:1,target:native?'ios-development':'web',revision,sourceDirty,entry:native?'room.html':'index.html',files:entries};
fs.writeFileSync(path.join(stage,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.rmSync(output,{recursive:true,force:true});
fs.renameSync(stage,output);
console.log(JSON.stringify({target:manifest.target,files:entries.length,bytes:entries.reduce((sum,file)=>sum+file.bytes,0),entry:manifest.entry,output:'www'},null,2));
