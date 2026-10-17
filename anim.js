/* Ovuluna — playful interactions */
document.addEventListener('DOMContentLoaded', function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // chips toggle with a pop + wiggle
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      // single-select rows (flow intensity, tabs-like chips) vs multi-select (symptoms)
      var row = c.closest('.chiprow');
      var single = row && row.dataset.single !== undefined;
      if (single) row.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
      c.classList.toggle('on');
      c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    });
  });

  // day strip select
  document.querySelectorAll('.day').forEach(function (d) {
    d.addEventListener('click', function () {
      d.parentElement.querySelectorAll('.day').forEach(function (x) { x.classList.remove('on'); });
      d.classList.add('on');
    });
  });

  // tabs
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      t.parentElement.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
    });
  });

  // count-up for numbers marked .count (data-to, optional data-suffix)
  document.querySelectorAll('.count').forEach(function (el) {
    var to = parseFloat(el.dataset.to || el.textContent) || 0;
    var dec = (el.dataset.to || '').includes('.') ? 1 : 0;
    var suf = el.dataset.suffix || '';
    function finalText() { return to.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suf; }
    if (reducedMotion.matches) { el.textContent = finalText(); return; }
    var t0 = null;
    function step(ts) {
      if (reducedMotion.matches) { el.textContent = finalText(); return; }
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 1100, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * eased).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });

  // sprinkle: tapping the brand bloom bursts tiny petals
  var brand = document.querySelector('.brandline');
  if (brand) brand.addEventListener('click', function (e) {
    if (reducedMotion.matches) return;
    for (var i = 0; i < 7; i++) {
      var p = document.createElement('i');
      var colors = ['#E9958B', '#DACEF6', '#9FA78F', '#E5B45C', '#B0577A'];
      p.style.cssText = 'position:fixed;z-index:99;width:7px;height:7px;border-radius:50% 50% 50% 0;pointer-events:none;' +
        'left:' + e.clientX + 'px;top:' + e.clientY + 'px;background:' + colors[i % 5] + ';';
      document.body.appendChild(p);
      (function (p, i) {
        var a = (Math.PI * 2 * i) / 7, d = 42 + Math.random() * 30;
        p.animate([
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d - 26) + 'px) scale(.4) rotate(140deg)', opacity: 0 }
        ], { duration: 750 + Math.random() * 250, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = function () { p.remove(); };
      })(p, i);
    }
  });
});
