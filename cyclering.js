/* Ovuluna — cycle ring renderer for #cyclering */
(function(){
  var el = document.getElementById('cyclering');
  if(!el) return;
  var day = parseInt(el.dataset.day||'14',10);
  var len = parseInt(el.dataset.len||'28',10);
  var period = (el.dataset.period||'0,5').split(',').map(Number);
  var fertile = (el.dataset.fertile||'11,16').split(',').map(Number);
  var ovulation = parseInt(el.dataset.ovulation||'14',10);

  var size=220, cx=size/2, cy=size/2, R=88, w=18;
  function polar(a,r){ return [cx+r*Math.cos(a), cy+r*Math.sin(a)]; }
  function arcPath(startFrac, endFrac, color){
    var a0 = -Math.PI/2 + startFrac*2*Math.PI;
    var a1 = -Math.PI/2 + endFrac*2*Math.PI;
    var large = (endFrac-startFrac)>0.5 ? 1 : 0;
    var p0=polar(a0,R), p1=polar(a1,R);
    return '<path d="M'+p0[0].toFixed(1)+','+p0[1].toFixed(1)+' A'+R+','+R+' 0 '+large+' 1 '+p1[0].toFixed(1)+','+p1[1].toFixed(1)+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round"/>';
  }

  var svg = '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">';
  // background track
  svg += arcPath(0,1,'rgba(224,218,208,.6)');
  // period segment
  svg += arcPath(period[0]/len, period[1]/len, '#D8607A');
  // fertile window
  svg += arcPath(fertile[0]/len, fertile[1]/len, '#5BA89A');
  // today marker
  var td = day/len;
  var ta = -Math.PI/2 + td*2*Math.PI;
  var tp = polar(ta, R);
  svg += '<circle cx="'+tp[0].toFixed(1)+'" cy="'+tp[1].toFixed(1)+'" r="10" fill="#8B6C82" stroke="#fff" stroke-width="3"/>';
  svg += '</svg>';
  el.innerHTML = svg;
})();
