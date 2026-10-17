/* One bar/graph card for dated reported measurements. Units and bounds are preserved. */
(function(root){
'use strict';
const HORMONES={e2:'Estradiol (E2)',p4:'Progesterone (P4)',lh:'Luteinizing hormone (LH)',fsh:'FSH'};
function series(records,analyte,unit){
 if(!Object.hasOwn(HORMONES,analyte))throw Error('Choose a supported hormone.');
 const all=records.filter(r=>r.analyte===analyte&&r.unit===unit).slice().sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn)||a.createdAt.localeCompare(b.createdAt));
 const shown=all.slice(-12),points=shown.filter(r=>r.qualifier==='=');
 return {all,shown,points,bounds:shown.filter(r=>r.qualifier!=='='),max:points.reduce((m,r)=>Math.max(m,r.value),0)};
}
root.OvumindHormoneRecords={series};
if(!root.document)return;
const d=root.document,card=d.getElementById('hormoneGraphCard');if(!card)return;
function node(tag,text,cls){const n=d.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;}
card.innerHTML='<div class="hormone-header"><h2>Hormone records</h2><span class="home-tag">Entered results</span></div><p>View values copied from your lab reports. This chart does not determine your current phase.</p><div class="hormone-selects"><div><label for="hormone-analyte">Hormone</label><select id="hormone-analyte"></select></div><div><label for="hormone-unit">Reported unit</label><select id="hormone-unit"></select></div></div><div class="hormone-view" role="group" aria-label="Hormone chart view"><button type="button" data-hormone-view="bar" aria-pressed="true">Bar view</button><button type="button" data-hormone-view="graph" aria-pressed="false">Graph view</button></div><p id="hormone-chart-status" role="status"></p><div id="hormone-plot"></div><div id="hormone-record-table"></div><p class="home-note">Only the same hormone and reported unit are plotted together. No unit conversion or age score is applied. Results from different labs or methods may not be directly comparable.</p><a href="labs.html">Add or edit lab results</a>';
const analyte=d.getElementById('hormone-analyte'),unit=d.getElementById('hormone-unit'),plot=d.getElementById('hormone-plot'),tableWrap=d.getElementById('hormone-record-table'),status=d.getElementById('hormone-chart-status');
let view='bar';try{if(root.localStorage.getItem('ovuluna_hormone_view')==='graph')view='graph';}catch(_){}
Object.keys(HORMONES).forEach(key=>{const o=node('option',HORMONES[key]);o.value=key;analyte.append(o);});
function units(){unit.replaceChildren();root.OvumindLabs.MARKERS[analyte.value].units.forEach(v=>{const o=node('option',v);o.value=v;unit.append(o);});}
function render(){
 d.querySelectorAll('[data-hormone-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hormoneView===view)));
 plot.replaceChildren();tableWrap.replaceChildren();
 try{
  const values=series(root.OvumindLabs.loadRecords(root.localStorage).records,analyte.value,unit.value);
  if(!values.all.length){status.textContent='No '+HORMONES[analyte.value]+' results recorded in '+unit.value+'. Add a report to begin.';return;}
  status.textContent=(values.all.length>12?'Latest 12 of '+values.all.length:'All '+values.all.length)+' matching records. '+(values.bounds.length?values.bounds.length+' reported bounds are listed below, not plotted as exact numbers.':'');
  if(values.points.length){
   const max=values.max||1,base=180,top=20,w=320,pad=35;
   const dates=values.points.map(r=>Date.parse(r.collectedOn+'T12:00:00Z')),minDate=Math.min(...dates),maxDate=Math.max(...dates);
   const points=values.points.map((r,i)=>({r,x:view==='graph'?(maxDate===minDate?w/2:pad+(dates[i]-minDate)/(maxDate-minDate)*(w-2*pad)):pad+(i+.5)/values.points.length*(w-2*pad),y:base-(r.value/max)*(base-top)}));
   const ns='http://www.w3.org/2000/svg',svg=d.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 212');svg.setAttribute('role','img');svg.setAttribute('aria-label',HORMONES[analyte.value]+' '+view+' view in '+unit.value+'. Exact values and dates follow in the table.');
   function shape(tag,attrs){const n=d.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));svg.append(n);return n;}
   shape('path',{d:'M35,20 V180 H300',stroke:'currentColor',opacity:.6,fill:'none'});
   const zero=shape('text',{x:25,y:184,'text-anchor':'end',fill:'currentColor','font-size':12});zero.textContent='0';
   if(view==='graph'&&points.length>1)shape('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'var(--mauve)','stroke-width':2});
   points.forEach(p=>{if(view==='bar')shape('rect',{x:p.x-Math.min(14,80/points.length),y:p.y,width:Math.min(28,160/points.length),height:base-p.y,rx:3,fill:'var(--mauve)'});shape('circle',{cx:p.x,cy:p.y,r:4,fill:'var(--mauve)'});});
   [points[0],points[points.length-1]].filter((p,i,a)=>i===0||p!==a[0]).forEach((p,i)=>{const t=shape('text',{x:i===0?35:300,y:204,'text-anchor':i===0?'start':'end',fill:'currentColor','font-size':12});t.textContent=p.r.collectedOn;});
   plot.append(node('p','Vertical scale: 0–'+max+' '+unit.value,'home-note'),svg);
   if(view==='graph')plot.append(node('p','Lines only join entered points. Values between them have not been measured.','home-note'));
  }else plot.append(node('p','No exact values to plot. Your reported bounds remain in the table.'));
  const table=node('table');table.append(node('caption',HORMONES[analyte.value]+' · original reported values'));
  const head=node('thead'),tr=node('tr');['Collected','Result','Report / method'].forEach(text=>{const th=node('th',text);th.scope='col';tr.append(th);});head.append(tr);table.append(head);const body=node('tbody');
  values.shown.forEach(r=>{const row=node('tr');row.append(node('td',r.collectedOn),node('td',(r.qualifier==='='?'':r.qualifier+' ')+r.value+' '+r.unit),node('td',[r.sourceName,r.assay].filter(Boolean).join(' · ')||'Not entered'));body.append(row);});table.append(body);tableWrap.append(table);
 }catch(e){status.textContent='Saved hormone records are unavailable. '+(e.message||'Existing records have not been changed.');}
}
analyte.addEventListener('change',()=>{units();render();});unit.addEventListener('change',render);
d.querySelectorAll('[data-hormone-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.hormoneView;try{root.localStorage.setItem('ovuluna_hormone_view',view);}catch(_){}render();}));
root.addEventListener('storage',e=>{if(e.key===root.OvumindLabs.KEY||e.key===null)render();});root.addEventListener('pageshow',render);units();render();
})(typeof window==='undefined'?globalThis:window);
