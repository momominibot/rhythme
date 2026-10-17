/* Cycle Wellness Score Calculator
   Calculates cycle wellness score from logged cycle data.
   Requires 3 cycles for full score; shows estimated with fewer.
   All data local-only (localStorage key: ovuluna_cycles)
*/
(function() {
  'use strict';

  var STORAGE_KEY = 'ovuluna_cycles';

  function getCycles() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveCycles(cycles) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
    } catch(e) {}
  }

  function addCycle(startDate, endDate) {
    var cycles = getCycles();
    cycles.push({ start: startDate, end: endDate || null, source: 'logged', loggedAt: new Date().toISOString() });
    // Sort by start date descending
    cycles.sort(function(a, b) { return new Date(b.start) - new Date(a.start); });
    saveCycles(cycles);
    return cycles;
  }

  function getCycleCount() {
    return getCycles().length;
  }

  function hasEnoughData() {
    return getCycleCount() >= 3;
  }

  // Calculate cycle lengths (days between consecutive cycle starts)
  function getCycleLengths(cycles) {
    var sorted = cycles.slice().sort(function(a, b) { return new Date(a.start) - new Date(b.start); });
    var lengths = [];
    for (var i = 1; i < sorted.length; i++) {
      var diff = Math.round((new Date(sorted[i].start) - new Date(sorted[i-1].start)) / (1000 * 60 * 60 * 24));
      if (diff > 0 && diff < 100) lengths.push(diff);
    }
    return lengths;
  }

  function calculateScore() {
    var cycles = getCycles();
    var count = cycles.length;

    if (count === 0) {
      return { score: null, status: 'no-data', message: 'Log your first cycle to start', progress: 0, estimated: false };
    }

    if (count < 3) {
      // Estimated score based on limited data + profile
      var profile = getProfile();
      var estScore = estimateScore(profile, cycles);
      return {
        score: estScore,
        status: 'building',
        message: 'Building your baseline (' + count + '/3 cycles)',
        progress: count,
        estimated: true,
        breakdown: getBreakdown(cycles, profile)
      };
    }

    // Full score with 3+ cycles
    var lengths = getCycleLengths(cycles);
    var profile = getProfile();
    var score = computeFullScore(lengths, cycles, profile);
    return {
      score: score,
      status: 'ready',
      message: 'Your cycle wellness score',
      progress: 3,
      estimated: false,
      breakdown: getBreakdown(cycles, profile),
      cycleLengths: lengths
    };
  }

  function getProfile() {
    try {
      var raw = localStorage.getItem('ovuluna_onboarding');
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function estimateScore(profile, cycles) {
    // Base score starts at 75
    var score = 75;
    // Regular cycles self-report
    if (profile.cycle === 'regular') score += 8;
    if (profile.cycle === 'irregular') score -= 10;
    // Age factor
    if (profile.age && profile.age < 25) score += 3;
    if (profile.age && profile.age >= 35) score -= 5;
    // Lifestyle
    if (profile.smoke === 'never') score += 3;
    if (profile.smoke === 'current') score -= 8;
    // Clamp
    return Math.max(40, Math.min(98, Math.round(score)));
  }

  function computeFullScore(lengths, cycles, profile) {
    if (lengths.length === 0) return estimateScore(profile, cycles);

    var score = 70;

    // 1. Regularity (40% of score)
    var avg = lengths.reduce(function(a, b) { return a + b; }, 0) / lengths.length;
    var variance = 0;
    lengths.forEach(function(l) { variance += Math.pow(l - avg, 2); });
    variance = Math.sqrt(variance / lengths.length);
    if (variance <= 2) score += 24;      // very regular
    else if (variance <= 5) score += 16;  // regular
    else if (variance <= 8) score += 8;   // somewhat irregular
    else score -= 5;                        // irregular

    // 2. Cycle length in healthy range (25% of score)
    if (avg >= 24 && avg <= 35) score += 18;
    else if (avg >= 21 && avg <= 38) score += 10;
    else score -= 5;

    // 3. Profile factors (20% of score)
    if (profile.smoke === 'never') score += 5;
    if (profile.smoke === 'current') score -= 8;
    if (profile.age && profile.age < 30) score += 4;
    if (profile.age && profile.age >= 40) score -= 4;

    // 4. Consistency trend (15% of score)
    if (lengths.length >= 2) {
      var recent = lengths[lengths.length - 1];
      var older = lengths[0];
      if (Math.abs(recent - older) <= 3) score += 10;
      else if (Math.abs(recent - older) <= 7) score += 5;
    }

    return Math.max(30, Math.min(100, Math.round(score)));
  }

  function getBreakdown(cycles, profile) {
    var lengths = getCycleLengths(cycles);
    var avg = lengths.length > 0 ? Math.round(lengths.reduce(function(a,b){return a+b;},0) / lengths.length) : null;
    return {
      cycleCount: cycles.length,
      avgCycleLength: avg,
      regularity: lengths.length >= 2 ? classifyRegularity(lengths) : 'insufficient data',
      healthyRange: avg ? (avg >= 24 && avg <= 35 ? 'In range' : 'Outside range') : 'Insufficient data'
    };
  }

  function classifyRegularity(lengths) {
    if (lengths.length < 2) return 'Insufficient data';
    var avg = lengths.reduce(function(a,b){return a+b;},0) / lengths.length;
    var variance = 0;
    lengths.forEach(function(l) { variance += Math.pow(l - avg, 2); });
    variance = Math.sqrt(variance / lengths.length);
    if (variance <= 2) return 'Very regular';
    if (variance <= 5) return 'Regular';
    if (variance <= 8) return 'Somewhat irregular';
    return 'Irregular';
  }

  function getScoreLabel(score) {
    if (score >= 85) return 'Thriving';
    if (score >= 70) return 'Balanced';
    if (score >= 55) return 'Needs support';
    if (score >= 40) return 'Consider checking in';
    return 'Talk to a provider';
  }

  // Export
  window.CycleScore = {
    getCycles: getCycles,
    addCycle: addCycle,
    getCycleCount: getCycleCount,
    hasEnoughData: hasEnoughData,
    calculateScore: calculateScore,
    getScoreLabel: getScoreLabel
  };

})();
