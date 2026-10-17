/* persona-filter.js
   Shows/hides content based on user's life stage (persona).
   Derived from onboarding age + goals. 18+ only.
   Usage: add data-persona="grow,nurture,wisdom" to any element.
   Elements without data-persona show for everyone.
*/
(function() {
  function getPersona() {
    try {
      var raw = localStorage.getItem('ovuluna_onboarding');
      if (!raw) return 'grow';
      var data = JSON.parse(raw);
      var age = parseInt(data.age) || 0;
      var goals = data.goals || [];
      if (typeof goals === 'string') goals = [goals];

      // Postpartum override (any age)
      for (var i = 0; i < goals.length; i++) {
        var g = String(goals[i]).toLowerCase();
        if (g.indexOf('postpartum') >= 0 || g.indexOf('post-natal') >= 0 || g.indexOf('breastfeed') >= 0 || g.indexOf('nursing') >= 0) {
          return 'nurture';
        }
      }
      // TTC / fertility override
      for (var j = 0; j < goals.length; j++) {
        var g2 = String(goals[j]).toLowerCase();
        if (g2.indexOf('ttc') >= 0 || g2.indexOf('fertility') >= 0 || g2.indexOf('pregnan') >= 0 || g2.indexOf('conceiv') >= 0) {
          return 'grow';
        }
      }
      // Age-based (18+ only)
      if (age >= 35) return 'wisdom';
      return 'grow'; // default 18-34
    } catch (e) {
      return 'grow';
    }
  }

  function applyFilter() {
    var persona = getPersona();
    var elements = document.querySelectorAll('[data-persona]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      // SAFETY GUARD: never hide the document root (html/body)
      if (el.tagName === 'HTML' || el.tagName === 'BODY') {
        console.warn('persona-filter: data-persona on document root is not allowed, skipping', el);
        continue;
      }
      var allowed = el.getAttribute('data-persona').split(',').map(function(s) { return s.trim(); });
      if (allowed.indexOf(persona) >= 0 || allowed.indexOf('all') >= 0) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    }
    // Update persona badge icons in top bar
    var badges = document.querySelectorAll('.persona-badge-img');
    for (var j = 0; j < badges.length; j++) {
      badges[j].src = 'assets/icons/persona-' + persona + '-64.png';
      badges[j].alt = persona.charAt(0).toUpperCase() + persona.slice(1) + ' persona';
    }
    // Store persona for other scripts to use
    try { localStorage.setItem('ovuluna_persona', persona); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFilter);
  } else {
    applyFilter();
  }

  window.applyPersonaFilter = applyFilter;
  window.getUserPersona = getPersona;
})();
