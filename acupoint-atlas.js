/* Ovuluna educational atlas, 2026. Original schematic artwork: CC BY 4.0.
   Location facts checked against WHO 2008 (2009 reprint). Coordinates below
   are approximate interface markers, NOT coordinates for an individual's body.
   No health data, routines or pregnancy flags are stored or inferred here. */
(function () {
  'use strict';

  var WHO_PDF = 'https://iris.who.int/server/api/core/bitstreams/d98c1c98-3fbf-4e4e-8c9a-1bbe72ccd00e/content';
  var points = [
    { id:'sp6', code:'SP6', name:'Sanyinjiao', cn:'三阴交', channel:'Spleen channel', region:'leg', page:72, kind:'ankle', xy:[182,556], detail:[174,155], side:'front', location:'Inner leg: 3 B-cun above the inner ankle prominence, behind the tibia’s medial border.', research:'SP6 has been studied for primary period pain. Findings are promising but do not establish a treatment schedule for you.', evidence:'atlas-period-pain' },
    { id:'cv4', code:'CV4', name:'Guanyuan', cn:'关元', channel:'Conception vessel', region:'abdomen', page:221, kind:'abdomen', xy:[200,324], detail:[200,210], side:'front', location:'Abdominal midline, 3 B-cun below the navel.' },
    { id:'st36', code:'ST36', name:'Zusanli', cn:'足三里', channel:'Stomach channel', region:'leg', page:64, kind:'knee', xy:[167,493], detail:[150,220], side:'front', location:'Front of leg, 3 B-cun below ST35, along the ST35 to ST41 line on tibialis anterior.' },
    { id:'lr3', code:'LR3', name:'Taichong', cn:'太冲', channel:'Liver channel', region:'foot', page:193, kind:'foot', xy:[181,610], detail:[180,180], side:'front', location:'Top of foot, between first and second metatarsals, just beyond their base junction toward the toes.' },
    { id:'li4', code:'LI4', name:'Hegu', cn:'合谷', channel:'Large intestine channel', region:'hand', page:35, kind:'hand', xy:[109,355], detail:[151,190], side:'back', location:'Back of hand, thumb-side of the second metacarpal’s midpoint.' },
    { id:'pc6', code:'PC6', name:'Neiguan', cn:'内关', channel:'Pericardium channel', region:'hand', page:159, kind:'wrist', xy:[110,321], detail:[200,205], side:'front', location:'Palmar forearm, 2 B-cun above the wrist crease, between palmaris longus and flexor carpi radialis.' },
    { id:'cv6', code:'CV6', name:'Qihai', cn:'气海', channel:'Conception vessel', region:'abdomen', page:222, kind:'abdomen', xy:[200,309], detail:[200,165], side:'front', location:'Abdominal midline, 1.5 B-cun below the navel.' },
    { id:'cv3', code:'CV3', name:'Zhongji', cn:'中极', channel:'Conception vessel', region:'abdomen', page:221, kind:'abdomen', xy:[200,334], detail:[200,240], side:'front', location:'Abdominal midline, 4 B-cun below the navel.' },
    { id:'st29', code:'ST29', name:'Guilai', cn:'归来', channel:'Stomach channel', region:'abdomen', page:60, kind:'abdomen', xy:[179,334], detail:[140,240], side:'front', bilateral:true, location:'4 B-cun below the navel and 2 B-cun either side of the abdominal midline.' },
    { id:'sp10', code:'SP10', name:'Xuehai', cn:'血海', channel:'Spleen channel', region:'leg', page:74, kind:'knee', xy:[185,436], detail:[235,101], side:'front', location:'Inner-front thigh, on vastus medialis, 2 B-cun above the kneecap’s upper inner end.' },
    { id:'ki3', code:'KI3', name:'Taixi', cn:'太溪', channel:'Kidney channel', region:'leg', page:137, kind:'ankle', xy:[183,587], detail:[146,266], side:'front', location:'Inner ankle, in the hollow between its bony prominence and the Achilles tendon.' },
    { id:'bl23', code:'BL23', name:'Shenshu', cn:'肾俞', channel:'Bladder channel', region:'back', page:111, kind:'back', xy:[177,279], detail:[156,140], side:'back', bilateral:true, location:'Lower back: 1.5 B-cun either side of the midline, level with L2’s spinous-process lower border.' },
    { id:'gv4', code:'GV4', name:'Mingmen', cn:'命门', channel:'Governing vessel', region:'back', page:205, kind:'back', xy:[200,279], detail:[200,140], side:'back', location:'Back midline, in the hollow immediately below L2’s spinous process.' }
  ];
  var selected = points[0];
  var view = 'detail';
  var region = 'all';
  var search = '';
  var list = document.getElementById('atlas-point-list');
  var diagram = document.getElementById('atlas-diagram');
  var article = document.getElementById('atlas-selected');
  if (!list || !diagram || !article) return;

  // Each illustration is an original, intentionally simplified outline.
  var bodyOutline = '<ellipse class="atlas-body" cx="200" cy="56" rx="30" ry="38"/><path class="atlas-body" d="M184 92 L183 109 Q148 113 135 141 L101 294 Q93 320 93 353 Q95 371 112 367 L128 309 L150 209 Q144 257 151 303 L150 350 Q150 401 157 460 L158 595 L147 620 Q168 631 187 620 L188 467 L200 367 L212 467 L213 620 Q232 631 253 620 L242 595 L243 460 Q250 401 250 350 L249 303 Q256 257 250 209 L272 309 L288 367 Q305 371 307 353 Q307 320 299 294 L265 141 Q252 113 217 109 L216 92"/>';
  var drawings = {
    front: bodyOutline + '<path class="atlas-guide" d="M200 126V358"/><circle class="atlas-landmark" cx="200" cy="294" r="3"/><path class="atlas-landmark" d="M154 467h30 M216 467h30"/><text class="atlas-map-muted" x="258" y="298">Navel</text><path class="atlas-label-line" d="M208 294h40"/>',
    back: bodyOutline + '<path class="atlas-guide" d="M200 122V350"/><path class="atlas-landmark" d="M150 284Q200 270 250 284"/><text class="atlas-map-muted" x="252" y="275">Lumbar region</text>',
    abdomen: '<path class="atlas-body" d="M112 25 Q90 109 98 175 L82 287 Q140 326 200 340 Q260 326 318 287 L302 175 Q310 109 288 25"/><path class="atlas-guide" d="M200 32V290"/><circle class="atlas-landmark" cx="200" cy="120" r="6"/><path class="atlas-landmark" d="M148 271Q200 284 252 271"/><text class="atlas-map-text" x="245" y="109">Navel</text><path class="atlas-label-line" d="M207 120L241 113"/><text class="atlas-map-muted" x="86" y="325">Front of lower abdomen</text>',
    ankle: '<path class="atlas-body" d="M154 20 Q173 119 158 229 L134 284 Q125 313 150 334 L287 334 Q305 330 300 316 L200 278 Q197 186 215 20"/><path class="atlas-landmark" d="M194 55L177 223"/><circle class="atlas-landmark" cx="180" cy="272" r="12"/><path class="atlas-landmark" d="M146 235L138 292"/><text class="atlas-map-muted" x="222" y="80">Inner shin edge</text><path class="atlas-label-line" d="M190 75H216"/><text class="atlas-map-muted" x="235" y="274">Inner ankle</text><path class="atlas-label-line" d="M192 271H228"/><text class="atlas-map-muted" x="18" y="240">Achilles</text><path class="atlas-label-line" d="M73 242L140 260"/><text class="atlas-map-muted" x="125" y="367">Inner side of ankle</text>',
    knee: '<path class="atlas-body" d="M123 20 Q122 72 125 132 L133 174 Q134 245 148 362 L230 362 Q246 260 246 184 L261 136 Q265 69 270 20"/><path class="atlas-landmark" d="M171 123 Q191 113 216 122 L219 162 Q195 177 172 163Z"/><path class="atlas-landmark" d="M184 178L183 337"/><text class="atlas-map-muted" x="273" y="145">Kneecap</text><path class="atlas-label-line" d="M220 141H266"/><text class="atlas-map-muted" x="20" y="327">Shin</text><path class="atlas-label-line" d="M52 325H175"/><text class="atlas-map-muted" x="104" y="382">Front of knee and shin</text>',
    hand: '<path class="atlas-body" d="M150 361 L144 269 Q114 256 87 223 Q68 201 78 188 Q90 180 109 201 L126 215 L113 85 Q113 65 128 65 Q142 65 146 86 L159 177 L152 43 Q154 26 168 29 Q182 32 184 49 L185 173 L190 44 Q193 28 206 34 Q218 40 216 61 L214 177 L233 91 Q237 75 250 81 Q262 88 255 109 L236 243 Q232 264 229 282 L238 361"/><path class="atlas-guide" d="M164 155L171 257 M198 154L204 259"/><text class="atlas-map-muted" x="258" y="154">Index bone</text><path class="atlas-label-line" d="M175 161L252 150"/><text class="atlas-map-muted" x="116" y="389">Back of a hand</text>',
    wrist: '<path class="atlas-body" d="M140 377L145 151 L126 124 Q103 107 115 93 Q131 80 151 101 L157 59 Q158 45 170 45 L245 45 Q259 45 257 65 L247 153 L260 377"/><path class="atlas-landmark" d="M153 147Q198 138 242 147 M185 158L183 357 M210 158L211 357"/><text class="atlas-map-muted" x="273" y="148">Wrist crease</text><path class="atlas-label-line" d="M245 146H267"/><text class="atlas-map-muted" x="64" y="300">Tendons</text><path class="atlas-label-line" d="M115 293L180 281"/><text class="atlas-map-muted" x="120" y="399">Palm-facing forearm</text>',
    foot: '<path class="atlas-body" d="M157 360Q142 296 132 254 L126 103 Q126 79 143 74 Q160 70 168 95 L172 60 Q173 43 188 44 Q203 46 202 66 L206 65 Q211 45 224 54 Q237 62 231 87 L237 83 Q251 69 260 84 Q270 96 258 116 L267 115 Q282 102 291 120 Q299 135 283 149 L270 285 Q260 323 253 360"/><path class="atlas-landmark" d="M150 112L168 235 M190 104L192 235"/><text class="atlas-map-muted" x="30" y="65">Big toe</text><path class="atlas-label-line" d="M79 66L143 83"/><text class="atlas-map-muted" x="52" y="270">Metatarsals</text><path class="atlas-label-line" d="M115 263L174 223"/><text class="atlas-map-muted" x="138" y="390">Top of a foot</text>',
    backDetail: '<path class="atlas-body" d="M105 24 Q83 110 105 197 L89 325 Q200 365 311 325 L295 197 Q317 110 295 24"/><path class="atlas-guide" d="M200 35V324"/><path class="atlas-landmark" d="M186 104h28 M185 124h30 M185 145h30 M183 168h34 M182 194h36 M111 232Q200 209 289 232"/><text class="atlas-map-muted" x="250" y="122">L2 landmark</text><path class="atlas-label-line" d="M216 124H243"/><text class="atlas-map-muted" x="128" y="378">Lower back, posterior view</text>'
  };

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function normalize(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s-]/g, '');
  }
  function filteredPoints() {
    return points.filter(function (point) {
      return (region === 'all' || region === point.region) && normalize(point.code + point.name + point.cn).includes(normalize(search));
    });
  }
  function evidenceButton(key, label) {
    var button = node('button', 'qi', 'i');
    button.type = 'button';
    button.dataset.evidence = key;
    button.setAttribute('aria-label', label);
    return button;
  }
  function renderList() {
    var visible = filteredPoints();
    list.replaceChildren();
    document.getElementById('atlas-result-count').textContent = visible.length ? visible.length + (visible.length === 1 ? ' point found' : ' points found') : 'No matching points. Clear your search or choose another area.';
    visible.forEach(function (point) {
      var button = node('button', 'atlas-point-button');
      button.type = 'button';
      button.dataset.pointId = point.id;
      button.setAttribute('aria-pressed', String(point.id === selected.id));
      button.setAttribute('aria-controls', 'atlas-selected atlas-diagram');
      button.appendChild(node('strong', '', point.code));
      button.appendChild(node('span', '', point.name));
      list.appendChild(button);
    });
  }
  function renderArticle() {
    article.replaceChildren();
    article.appendChild(node('p', 'atlas-code', selected.code + ' · Landmark reference'));
    var heading = node('h2', '', selected.name);
    heading.id = 'atlas-selected-title';
    article.appendChild(heading);
    article.appendChild(node('p', 'atlas-chinese', selected.cn));
    var dl = node('dl');
    dl.appendChild(node('dt', '', 'Location in the WHO standard'));
    dl.appendChild(node('dd', '', selected.location));
    dl.appendChild(node('dt', '', 'Understanding the measurement'));
    dl.appendChild(node('dd', '', 'B-cun is a proportional anatomical measurement, not an inch or a universal finger width. A trained practitioner uses individual landmarks; this illustration cannot replace that assessment.'));
    dl.appendChild(node('dt', '', 'Traditional framework'));
    dl.appendChild(node('dd', '', selected.channel + ' in traditional Chinese medicine. A channel name is a traditional classification, not evidence that this point changes the named organ, hormones or fertility.'));
    article.appendChild(dl);
    var research = node('p', 'atlas-research-note', selected.research || 'A standardized location does not establish effectiveness. This guide has not established a point-specific benefit for ovarian health or a self-treatment protocol.');
    research.appendChild(evidenceButton(selected.evidence || 'atlas-traditional-rationale', 'Read evidence and limits for ' + selected.code));
    article.appendChild(research);
    var link = node('a', 'atlas-source-link', 'WHO reference · printed page ' + selected.page + ' (PDF)');
    link.href = WHO_PDF;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    article.appendChild(link);
    article.appendChild(evidenceButton('atlas-who-landmarks', 'Read the source and measurement method for ' + selected.code));
  }
  function svgNode(name, attrs, text) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, String(attrs[key])); });
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function renderDiagram() {
    var detail = view === 'detail';
    var kind = detail ? (selected.kind === 'back' ? 'backDetail' : selected.kind) : view;
    var dimensions = detail ? '0 0 400 420' : '0 0 400 650';
    // Only our static artwork strings enter the parser; search text never does.
    var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + dimensions + '">' + drawings[kind] + '</svg>', 'image/svg+xml');
    var svg = doc.documentElement;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', 'atlas-svg-title atlas-svg-desc');
    svg.prepend(svgNode('desc', {id:'atlas-svg-desc'}, 'Original simplified orientation diagram. The marker is approximate and is not a treatment location. Read the written landmark reference below.'));
    svg.prepend(svgNode('title', {id:'atlas-svg-title'}, (detail ? selected.name + ', closer view' : view === 'front' ? 'Front of body' : 'Back of body') + ', educational schematic'));
    var visible = detail || view === selected.side;
    if (visible) {
      var xy = detail ? selected.detail : selected.xy;
      var labelX = xy[0] > 220 ? xy[0] - 80 : xy[0] + 36;
      svg.appendChild(svgNode('circle', {cx:xy[0], cy:xy[1], r:21, class:'atlas-marker-halo'}));
      svg.appendChild(svgNode('circle', {cx:xy[0], cy:xy[1], r:8, class:'atlas-marker'}));
      svg.appendChild(svgNode('path', {d:'M' + (xy[0] + (labelX > xy[0] ? 10 : -10)) + ' ' + xy[1] + 'L' + (labelX + (labelX > xy[0] ? -5 : 34)) + ' ' + (xy[1] - 18), class:'atlas-label-line'}));
      svg.appendChild(svgNode('text', {x:labelX, y:xy[1]-20, class:'atlas-map-text'}, selected.code));
      if (selected.bilateral) svg.appendChild(svgNode('circle', {cx:400-xy[0], cy:xy[1], r:8, class:'atlas-marker'}));
    }
    diagram.replaceChildren(document.importNode(svg, true));
    document.getElementById('atlas-caption').textContent = visible ? selected.code + ' · Approximate navigation marker. One representative side shown where relevant; not clinical localization.' : selected.code + ' is on a different surface. Choose Closer view for the appropriate orientation.';
    document.querySelectorAll('[data-atlas-view]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.atlasView === view));
    });
  }
  function choose(point, moveFocus) {
    selected = point;
    view = ['ankle','hand','foot','wrist'].includes(point.kind) ? 'detail' : point.side;
    renderList();
    renderArticle();
    renderDiagram();
    if (moveFocus) {
      var button = list.querySelector('[data-point-id="' + point.id + '"]');
      if (button) button.focus({preventScroll:true});
    }
  }
  function updateFilter() {
    var visible = filteredPoints();
    if (visible.length && !visible.includes(selected)) choose(visible[0], false);
    else renderList();
  }
  list.addEventListener('click', function (event) {
    var button = event.target instanceof Element && event.target.closest('[data-point-id]');
    if (!button) return;
    var point = points.find(function (candidate) { return candidate.id === button.dataset.pointId; });
    if (point) choose(point, true);
  });
  document.getElementById('atlas-search').addEventListener('input', function (event) { search = event.target.value.slice(0,100); updateFilter(); });
  document.getElementById('atlas-region').addEventListener('change', function (event) { region = event.target.value; updateFilter(); });
  document.querySelectorAll('[data-atlas-view]').forEach(function (button) {
    button.addEventListener('click', function () { view = button.dataset.atlasView; renderDiagram(); });
  });
  // Preserve older point anchors and accept only known enum-like query values.
  var requested = new URLSearchParams(window.location.search).get('point') || window.location.hash.replace(/^#card-/, '').replace(/^#/, '');
  if (requested === 'lv3') requested = 'lr3';
  var initial = points.find(function (point) { return point.id === requested.toLowerCase(); });
  if (initial) choose(initial, false);
  else { renderList(); renderArticle(); renderDiagram(); }
})();
