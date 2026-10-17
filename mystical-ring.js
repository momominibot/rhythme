/* A teaching illustration, never a current-cycle/fertility prediction. */
(function(){
'use strict';
const container=document.getElementById('cyclering'),range=document.getElementById('ring-day');
if(!container||!range)return;
const center=document.getElementById('mysticalCenter'),label=document.getElementById('ring-day-label'),explanation=document.getElementById('ring-explanation');
const phases={
 menstrual:{name:'Menstruation',text:'In this teaching example, bleeding marks the beginning of a cycle. This also falls within the ovarian follicular phase.',image:'assets/moon-menstrual.png'},
 follicular:{name:'Follicular',text:'Follicles develop during the follicular phase, which ends with ovulation. Its length varies.',image:'assets/moon-follicular.png'},
 ovulation:{name:'Ovulation',text:'Ovulation is the release of an egg. Day 14 is used only for this teaching example; it is not a prediction for you.',image:'assets/moon-ovulation.png'},
 luteal:{name:'Luteal',text:'After ovulation, the corpus luteum produces progesterone. The illustration cannot show your hormone levels.',image:'assets/moon-luteal.png'}
};
function phase(d){return d<=5?'menstrual':d<=13?'follicular':d===14?'ovulation':'luteal';}
function xy(d,r=114){const a=(d-1)/28*Math.PI*2-Math.PI/2;return [150+Math.cos(a)*r,150+Math.sin(a)*r];}
function arc(start,end,color){const a=xy(start),b=xy(end);return '<path d="M'+a.join(',')+' A114,114 0 '+(end-start>14?1:0)+' 1 '+b.join(',')+'" fill="none" stroke="'+color+'" stroke-width="17" stroke-linecap="round"/>';}
let svg='<svg viewBox="0 0 300 300" id="mysticalRingSvg" aria-hidden="true"><circle cx="150" cy="150" r="137" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="2 7"/>';
svg+=arc(1,6,'#bd577b')+arc(7,13,'#9b78b1')+arc(14,15,'#dfb363')+arc(16,28,'#8784be');
for(let i=0;i<20;i++){const a=i*2*Math.PI/20;svg+='<circle class="mystical-star" cx="'+(150+Math.cos(a)*144)+'" cy="'+(150+Math.sin(a)*144)+'" r="1.2" fill="#e6cb93"/>';}
svg+='<circle id="ring-orb" class="mystical-orb" r="10" fill="#f0c878" stroke="#fff" stroke-width="3"/></svg>';container.innerHTML=svg;
center.innerHTML='<img id="ring-moon" class="mystical-moon" width="56" height="56" alt=""><div class="mystical-day" id="ring-example"></div><div class="mystical-phase" id="ring-phase"></div>';
function render(){
 const day=Number(range.value),p=phases[phase(day)],orb=document.getElementById('ring-orb'),pt=xy(day);
 orb.setAttribute('cx',pt[0]);orb.setAttribute('cy',pt[1]);
 document.getElementById('ring-moon').src=p.image;document.getElementById('ring-example').textContent='Example day '+day+' / 28';document.getElementById('ring-phase').textContent=p.name;
 label.textContent=day;range.setAttribute('aria-valuetext','Example day '+day+', '+p.name);explanation.textContent=p.text;
 document.getElementById('ring-previous').disabled=day===1;document.getElementById('ring-next').disabled=day===28;
}
range.addEventListener('input',render);
for(const [id,delta] of [['ring-previous',-1],['ring-next',1]])document.getElementById(id).addEventListener('click',()=>{range.value=Math.min(28,Math.max(1,Number(range.value)+delta));render();});
// One listener set on a stable SVG. Pointer capture survives orb movement and avoids document listeners.
const ring=document.getElementById('mysticalRingSvg');let dragging=false;
function point(e){const rect=ring.getBoundingClientRect();const angle=Math.atan2(e.clientY-rect.top-rect.height/2,e.clientX-rect.left-rect.width/2);const fraction=((angle+Math.PI/2+2*Math.PI)%(2*Math.PI))/(2*Math.PI);range.value=Math.min(28,Math.floor(fraction*28)+1);render();}
ring.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;ring.setPointerCapture(e.pointerId);point(e);});
ring.addEventListener('pointermove',e=>{if(dragging)point(e);});
ring.addEventListener('pointerup',()=>{dragging=false;});ring.addEventListener('pointercancel',()=>{dragging=false;});ring.addEventListener('lostpointercapture',()=>{dragging=false;});
render();
})();
