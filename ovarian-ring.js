/* Ovuluna — ovarian-age ring gauge — 270° arc mapping reproductive age 25..55.
   drawOvarianRing(el, chrono, ovAge) → fills el with an SVG gauge. */
function drawOvarianRing(el, chrono, ovAge){
  var AMIN=24, AMAX=56, cx=110, cy=112, R=86, W=15, start=135, sweep=270;
  function ang(v){ var f=Math.max(0,Math.min(1,(v-AMIN)/(AMAX-AMIN))); return (start+f*sweep)*Math.PI/180; }
  function pt(v,r){ var a=ang(v); r=r||R; return [cx+r*Math.cos(a), cy+r*Math.sin(a)]; }
  function arc(v0,v1,color,w){ v0=Math.max(AMIN,Math.min(AMAX,v0)); v1=Math.max(AMIN,Math.min(AMAX,v1));
    if(v1<=v0) v1=v0+0.01;
    var p0=pt(v0), p1=pt(v1), large=((v1-v0)/(AMAX-AMIN)*sweep>180)?1:0;
    return '<path d="M'+p0[0].toFixed(1)+','+p0[1].toFixed(1)+' A'+R+','+R+' 0 '+large+' 1 '+p1[0].toFixed(1)+','+p1[1].toFixed(1)+'" fill="none" stroke="'+color+'" stroke-width="'+(w||W)+'" stroke-linecap="round"/>'; }
  var delta = ovAge - chrono;
  var col = delta<=0.5 ? '#5E9B73' : (delta<2 ? '#E3B563' : '#C46F4F');
  var mk = pt(chrono, R);
  // small scale ticks
  var ticks='';
  [25,30,35,40,45,50,55].forEach(function(v){ var p=pt(v, R-14); ticks+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="1.5" fill="rgba(110,70,84,.28)"/>'; });
  var svg='<svg viewBox="0 0 220 224">'
    + arc(AMIN,AMAX,'rgba(110,70,84,.10)')
    + ticks
    + arc(AMIN, ovAge, col)
    + '<circle cx="'+mk[0].toFixed(1)+'" cy="'+mk[1].toFixed(1)+'" r="8" fill="#fff" stroke="#6E4654" stroke-width="3"/>'
    + '</svg>';
  el.innerHTML=svg;
  return {color:col, delta:delta};
}
