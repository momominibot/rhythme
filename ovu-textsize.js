/* ovu-textsize.js: a text size setting (You tab, Text size). The levels scale the whole page from the root with CSS zoom,
 * so every label, button and sheet grows together and the layout still fills the phone; the choice lives in the profile
 * on this phone and is applied before the page draws. Loaded on every page that has the store. */
(function (root) {
  'use strict';
  var LEVELS = [
    { id: 'default', name: 'Standard', zoom: 1, note: 'As designed' },
    { id: 'large', name: 'Large', zoom: 1.12, note: 'A little bigger everywhere' },
    { id: 'larger', name: 'Larger', zoom: 1.25, note: 'Comfortable from further away' }
  ];
  function level(id) { return LEVELS.filter(function (l) { return l.id === id; })[0] || LEVELS[0]; }
  function apply(id) {
    var l = level(id), de = root.document && root.document.documentElement; if (!de) return l;
    if (l.zoom === 1) { de.style.zoom = ''; de.removeAttribute('data-text'); } else { de.style.zoom = String(l.zoom); de.setAttribute('data-text', l.id); }
    return l;
  }
  var S = root.OvuStore, cur = 'default';
  try { cur = (S && S.profile && S.profile().textSize) || 'default'; } catch (e) { }
  apply(cur);
  root.OvuTextSize = {
    LEVELS: LEVELS, level: level, apply: apply, current: function () { return cur; },
    set: function (id) { cur = level(id).id; apply(cur); try { if (S && S.setProfile) S.setProfile({ textSize: cur }); } catch (e) { } return cur; }
  };
  var R = root.OvuRoom; if (!R || !R.openSheet) return;
  root.OvuTextSize.open = function () {
    R.openSheet('text', 'Text size', 'Bigger words, bigger buttons', 'format_size',
      '<div class="sessions" id="textLevels">' + LEVELS.map(function (l) { return '<button type="button" class="session' + (l.id === cur ? ' on' : '') + '" data-text="' + l.id + '"><b>' + l.name + '</b><small>' + l.note + '</small></button>'; }).join('') + '</div>' +
      '<p class="help">The whole page scales, so nothing is cut off. The choice stays on this phone and applies to every page.</p>');
    var box = root.document.getElementById('textLevels');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-text]'); if (!b) return;
      root.OvuTextSize.set(b.dataset.text);
      Array.prototype.slice.call(box.querySelectorAll('.session')).forEach(function (x) { x.classList.toggle('on', x === b); });
      R.chime('save'); R.toast('Text size: ' + level(b.dataset.text).name.toLowerCase() + '.', 'format_size');
    });
  };
})(window);
