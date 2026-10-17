// circadian.js - Circadian rhythm monitoring and momentum tracking
// Reads sleep logs from localStorage, calculates bedtime/wake consistency,
// and provides evidence-based guidance.

(function() {
  'use strict';

  // Parse a time string like "11:00 PM" or "23:00" to minutes since midnight
  function parseTime(timeStr) {
    if (!timeStr) return null;
    timeStr = timeStr.trim();
    // Handle 24-hour format
    var m24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
    }
    // Handle 12-hour format
    var m12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
    if (m12) {
      var h = parseInt(m12[1], 10);
      var min = parseInt(m12[2], 10);
      var ap = m12[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    }
    return null;
  }

  // Calculate sleep midpoint in minutes (handles overnight sleep)
  function calcMidpoint(bedtimeMin, wakeMin) {
    if (bedtimeMin === null || wakeMin === null) return null;
    // If bedtime is after 6pm (1080 min) and wake is before noon (720 min),
    // sleep crosses midnight
    if (bedtimeMin >= 1080 && wakeMin <= 720) {
      // Add 24h to wake time
      var duration = (wakeMin + 1440 - bedtimeMin);
      var midpoint = bedtimeMin + duration / 2;
      // Normalize back to 0-1440
      return midpoint % 1440;
    }
    // Same-day sleep (e.g., nap)
    return (bedtimeMin + wakeMin) / 2;
  }

  // Get sleep logs for the last N days
  function getRecentSleepLogs(days) {
    var logs = [];
    var today = new Date();
    for (var i = 0; i < days; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var key = 'ovuluna_daily_log_' + d.toISOString().split('T')[0];
      try {
        var data = JSON.parse(localStorage.getItem(key));
        if (data && data.sleep && data.sleep.fields && data.sleep.fields.length >= 2) {
          var bedtime = parseTime(data.sleep.fields[0]);
          var wake = parseTime(data.sleep.fields[1]);
          if (bedtime !== null && wake !== null) {
            logs.push({
              date: d.toISOString().split('T')[0],
              bedtime: bedtime,
              wake: wake,
              midpoint: calcMidpoint(bedtime, wake),
              quality: data.sleep.fields[2] || null
            });
          }
        }
      } catch(e) {}
    }
    return logs; // most recent first
  }

  // Calculate circadian consistency metrics
  function calcCircadianMetrics() {
    var logs = getRecentSleepLogs(14);
    if (logs.length < 2) {
      return {
        available: false,
        message: 'Log your sleep for at least 2 nights to see your circadian rhythm.',
        daysLogged: logs.length
      };
    }

    var midpoints = logs.map(function(l) { return l.midpoint; });
    var mean = midpoints.reduce(function(a, b) { return a + b; }, 0) / midpoints.length;

    // Standard deviation
    var variance = midpoints.reduce(function(sum, v) {
      return sum + Math.pow(v - mean, 2);
    }, 0) / midpoints.length;
    var stdDev = Math.sqrt(variance);

    // Range (max - min)
    var max = Math.max.apply(null, midpoints);
    var min = Math.min.apply(null, midpoints);
    var range = max - min;

    // Circadian momentum: consecutive days (from most recent backward)
    // where midpoint varies by < 30 min from the running mean
    var momentum = 0;
    var runningSum = 0;
    for (var i = 0; i < logs.length; i++) {
      runningSum += logs[i].midpoint;
      var runningMean = runningSum / (i + 1);
      if (Math.abs(logs[i].midpoint - runningMean) <= 30) {
        momentum++;
      } else {
        break;
      }
    }

    // Social jetlag: difference between weekday and weekend midpoint
    var weekdayMid = [];
    var weekendMid = [];
    logs.forEach(function(l) {
      var dow = new Date(l.date).getDay();
      if (dow === 0 || dow === 6) weekendMid.push(l.midpoint);
      else weekdayMid.push(l.midpoint);
    });
    var socialJetlag = null;
    if (weekdayMid.length >= 2 && weekendMid.length >= 1) {
      var wdMean = weekdayMid.reduce(function(a,b){return a+b;},0) / weekdayMid.length;
      var weMean = weekendMid.reduce(function(a,b){return a+b;},0) / weekendMid.length;
      socialJetlag = Math.abs(weMean - wdMean);
    }

    // Status classification
    var status, statusColor, guidance;
    if (stdDev <= 30 && momentum >= 7) {
      status = 'Robust Alignment';
      statusColor = 'var(--ok)';
      guidance = 'Your sleep timing is beautifully consistent. This supports stable cortisol, balanced hormones, and optimal ovarian function. Keep it up.';
    } else if (stdDev <= 45 && momentum >= 3) {
      status = 'Entraining';
      statusColor = 'var(--d-sleep)';
      guidance = 'You are building circadian momentum. 3+ consistent nights start to stabilize cortisol. Aim for 7 nights to see measurable hormonal benefits.';
    } else if (stdDev <= 60) {
      status = 'Moderate Variability';
      statusColor = 'var(--warn)';
      guidance = 'Your sleep timing varies by about ' + Math.round(stdDev) + ' minutes. Try to keep bedtime and wake time within 30 minutes of each other, even on weekends.';
    } else {
      status = 'Disrupted Rhythm';
      statusColor = 'var(--danger)';
      guidance = 'Your sleep timing is highly variable (' + Math.round(stdDev) + ' min standard deviation). This can disrupt cortisol, glucose regulation, and reproductive hormones. Start with a consistent wake time every morning.';
    }

    return {
      available: true,
      daysLogged: logs.length,
      meanMidpoint: mean,
      stdDev: stdDev,
      range: range,
      momentum: momentum,
      socialJetlag: socialJetlag,
      status: status,
      statusColor: statusColor,
      guidance: guidance,
      logs: logs
    };
  }

  // Format minutes to time string
  function formatTime(min) {
    var h = Math.floor(min / 60) % 24;
    var m = Math.round(min % 60);
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  // Render circadian widget into a container
  function renderCircadianWidget(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var metrics = calcCircadianMetrics();

    if (!metrics.available) {
      container.innerHTML =
        '<div class="card" style="padding:16px;text-align:center">' +
        '<div class="sub" style="color:var(--faded)">' + metrics.message + '</div>' +
        '</div>';
      return;
    }

    var momentumLabel = '';
    if (metrics.momentum >= 14) momentumLabel = 'Robust';
    else if (metrics.momentum >= 7) momentumLabel = 'Strong';
    else if (metrics.momentum >= 3) momentumLabel = 'Building';
    else momentumLabel = 'Starting';

    container.innerHTML =
      '<div class="card" style="padding:16px">' +
        '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<div class="row" style="gap:8px;align-items:center">' +
            '<span class="ms" style="color:var(--d-sleep);font-size:20px">bedtime</span>' +
            '<b style="font-size:14px">Circadian Rhythm</b>' +
            '<span class="qi" data-evidence="circadian-consistency" style="font-size:9px">i</span>' +
          '</div>' +
          '<span style="font-size:11px;font-weight:700;color:' + metrics.statusColor + ';background:' + metrics.statusColor + '15;padding:3px 10px;border-radius:20px">' + metrics.status + '</span>' +
        '</div>' +
        '<div class="grid2" style="gap:10px;margin-bottom:12px">' +
          '<div style="text-align:center;padding:10px;background:var(--bg-soft);border-radius:12px">' +
            '<div style="font-family:var(--serif);font-size:20px;color:var(--cocoa)">' + formatTime(metrics.meanMidpoint) + '</div>' +
            '<div class="sub" style="font-size:10px;margin-top:2px">Avg Sleep Midpoint</div>' +
          '</div>' +
          '<div style="text-align:center;padding:10px;background:var(--bg-soft);border-radius:12px">' +
            '<div style="font-family:var(--serif);font-size:20px;color:var(--cocoa)">' + Math.round(metrics.stdDev) + ' <span style="font-size:12px">min</span></div>' +
            '<div class="sub" style="font-size:10px;margin-top:2px">Timing Variability</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:12px">' +
          '<div class="row" style="justify-content:space-between;margin-bottom:4px">' +
            '<span class="sub" style="font-size:11px">Circadian Momentum</span>' +
            '<span style="font-size:11px;font-weight:700;color:var(--d-sleep)">' + metrics.momentum + ' days (' + momentumLabel + ')</span>' +
          '</div>' +
          '<div style="height:6px;background:var(--bg-soft);border-radius:3px;overflow:hidden">' +
            '<div style="height:100%;width:' + Math.min(100, metrics.momentum / 14 * 100) + '%;background:linear-gradient(90deg,var(--d-sleep),var(--d-lavender));border-radius:3px;transition:width .5s"></div>' +
          '</div>' +
          '<div class="row" style="justify-content:space-between;margin-top:3px">' +
            '<span style="font-size:9px;color:var(--faded)">3=entraining</span>' +
            '<span style="font-size:9px;color:var(--faded)">7=cortisol</span>' +
            '<span style="font-size:9px;color:var(--faded)">14=robust</span>' +
          '</div>' +
        '</div>' +
        (metrics.socialJetlag !== null ?
          '<div class="row" style="gap:6px;margin-bottom:10px;font-size:11px">' +
            '<span class="ms" style="font-size:14px;color:' + (metrics.socialJetlag > 60 ? 'var(--danger)' : 'var(--ok)') + '">schedule</span>' +
            '<span style="color:var(--slate2)">Social jetlag: ' + Math.round(metrics.socialJetlag) + ' min ' +
            '<span class="qi" data-evidence="circadian-disruption" style="font-size:9px">i</span></span>' +
          '</div>' : '') +
        '<div style="font-size:12px;line-height:1.5;color:var(--slate2);background:var(--bg-soft);padding:10px 12px;border-radius:10px">' +
          metrics.guidance +
        '</div>' +
      '</div>';
  }

  // Expose
  window.Circadian = {
    calcMetrics: calcCircadianMetrics,
    renderWidget: renderCircadianWidget,
    getRecentSleepLogs: getRecentSleepLogs
  };

  // Auto-render if container exists (with retry for dynamic content)
  function tryRender() {
    if (document.getElementById('circadian-widget')) {
      renderCircadianWidget('circadian-widget');
    } else {
      setTimeout(tryRender, 300);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryRender);
  } else {
    tryRender();
  }
})();
