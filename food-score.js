/* ══════════════════════════════════════════════════════════════
   OVULUNA · Food Score Engine (pure JS port of Mallow score.ts)
   Gentle 0–100 score: starts at 100, eases down for NOVA,
   added sugar, and additives. Information, not a verdict.
   "You're allowed to eat the cookie."
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Band labels — calm, non-judgmental
  var BAND_LABEL = {
    minimal:   'Minimally processed',
    light:     'Lightly processed',
    processed: 'Processed',
    ultra:     'Ultra-processed'
  };

  // Colors matching Ovuluna theme
  var COLORS = {
    scoreHigh:  '#6ba88a',  // green — minimal
    scoreMid:   '#d4a85a',  // amber — light / processed
    scoreLow:   '#c47a6a',  // coral-red — ultra
    textMuted:  '#a898bc'   // lavender-gray — no data
  };

  function bandFor(value) {
    if (value >= 75) return 'minimal';
    if (value >= 55) return 'light';
    if (value >= 35) return 'processed';
    return 'ultra';
  }

  function colorFor(band) {
    if (band === 'minimal') return COLORS.scoreHigh;
    if (band === 'ultra')   return COLORS.scoreLow;
    return COLORS.scoreMid;
  }

  function round(v) {
    return Math.round(v * 10) / 10;
  }

  /**
   * Compute a gentle food score.
   * @param {Object} food - { processing: { novaGroup, additivesCount }, nutriments: { sugarsG } }
   * @returns {Object} { value, band, label, reasons, color }
   */
  function computeFoodScore(food) {
    var nova      = food && food.processing ? food.processing.novaGroup : undefined;
    var additives = food && food.processing ? food.processing.additivesCount : undefined;
    var sugar     = food && food.nutriments ? food.nutriments.sugarsG : undefined;

    // Need at least one meaningful signal, else stay quiet rather than guess.
    if (nova == null && additives == null && sugar == null) {
      return {
        value: null,
        band: 'light',
        label: 'Not enough info to score',
        reasons: ["We don't have processing or sugar data for this one yet."],
        color: COLORS.textMuted
      };
    }

    var value = 100;
    var reasons = [];

    // ── NOVA penalty ──
    if (nova != null) {
      var penalty = { 1: 0, 2: 12, 3: 28, 4: 48 }[nova] || 0;
      value -= penalty;
      var novaText = {
        1: 'Unprocessed or minimally processed (NOVA 1).',
        2: 'Processed culinary ingredient (NOVA 2).',
        3: 'Processed food (NOVA 3).',
        4: 'Ultra-processed (NOVA 4).'
      }[nova] || '';
      if (novaText) reasons.push(novaText);
    }

    // ── Sugar penalty (WHO free-sugar context) ──
    if (sugar != null) {
      if (sugar >= 22.5) {
        value -= 18;
        reasons.push('High in sugar (' + round(sugar) + ' g/100 g).');
      } else if (sugar >= 10) {
        value -= 9;
        reasons.push('Some added sugar (' + round(sugar) + ' g/100 g).');
      } else {
        reasons.push('Low in sugar (' + round(sugar) + ' g/100 g).');
      }
    }

    // ── Additives penalty: -4 each, max -20 ──
    if (additives != null && additives > 0) {
      value -= Math.min(20, additives * 4);
      reasons.push(additives + ' additive' + (additives === 1 ? '' : 's') + ' listed.');
    } else if (additives === 0) {
      reasons.push('No additives listed.');
    }

    // Clamp 0–100 and round
    value = Math.max(0, Math.min(100, Math.round(value)));
    var band = bandFor(value);

    return {
      value: value,
      band: band,
      label: BAND_LABEL[band],
      reasons: reasons,
      color: colorFor(band)
    };
  }

  // Export to window for browser use
  window.computeFoodScore = computeFoodScore;

})();
