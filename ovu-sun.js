/* Rhythme sun clock: today's sunrise and sunset for the user's place, and the
 * part of the day the room should show (sunrise, morning, afternoon, sunset,
 * night). Uses the NOAA solar position equations, accurate to about a minute
 * near the equator. No location permission is asked: the place comes from the
 * phone's time zone (Singapore by default), which is close enough for a sky. */
(function (root) {
  'use strict';
  var PLACES = {
    'Asia/Singapore': [1.3521, 103.8198], 'Asia/Kuala_Lumpur': [3.139, 101.6869], 'Asia/Jakarta': [-6.2088, 106.8456],
    'Asia/Bangkok': [13.7563, 100.5018], 'Asia/Manila': [14.5995, 120.9842], 'Asia/Ho_Chi_Minh': [10.8231, 106.6297],
    'Asia/Hong_Kong': [22.3193, 114.1694], 'Asia/Shanghai': [31.2304, 121.4737], 'Asia/Taipei': [25.033, 121.5654],
    'Asia/Tokyo': [35.6762, 139.6503], 'Asia/Seoul': [37.5665, 126.978], 'Asia/Kolkata': [19.076, 72.8777], 'Asia/Dubai': [25.2048, 55.2708],
    'Australia/Perth': [-31.9523, 115.8613], 'Australia/Sydney': [-33.8688, 151.2093], 'Australia/Melbourne': [-37.8136, 144.9631],
    'Europe/London': [51.5072, -0.1276], 'America/New_York': [40.7128, -74.006], 'America/Los_Angeles': [34.0522, -118.2437]
  };
  var DEFAULT = PLACES['Asia/Singapore'];
  function place() {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
    if (PLACES[tz]) return { lat: PLACES[tz][0], lon: PLACES[tz][1], tz: tz };
    var off = -new Date().getTimezoneOffset() / 60;
    if (off === 8 || !tz) return { lat: DEFAULT[0], lon: DEFAULT[1], tz: tz || 'Asia/Singapore' };
    return { lat: 0, lon: off * 15, tz: tz };
  }
  var RAD = Math.PI / 180;
  /* Minutes after local midnight of sunrise and sunset on `date` (NOAA, zenith 90.833 degrees). */
  function times(date, lat, lon) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    var start = new Date(d.getFullYear(), 0, 0), doy = Math.floor((d - start) / 86400000);
    var g = 2 * Math.PI / 365 * (doy - 1);
    var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var cosH = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
    var tzMin = -d.getTimezoneOffset();
    if (cosH > 1 || cosH < -1) return { sunrise: 6 * 60, sunset: 18 * 60, polar: true };
    var ha = Math.acos(cosH) / RAD;
    return { sunrise: 720 - 4 * (lon + ha) - eqt + tzMin, sunset: 720 - 4 * (lon - ha) - eqt + tzMin, polar: false };
  }
  function hm(min) {
    var h = Math.floor(min / 60), m = Math.round(min - h * 60); if (m === 60) { h++; m = 0; }
    var ap = h >= 12 ? 'pm' : 'am', h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }
  var PHASES = {
    sunrise: { title: 'Sunrise', icon: 'wb_twilight', windowLabel: 'Window · sunrise', greeting: 'Good morning' },
    morning: { title: 'This morning', icon: 'light_mode', windowLabel: 'Window · morning sky', greeting: 'Good morning' },
    afternoon: { title: 'This afternoon', icon: 'wb_sunny', windowLabel: 'Window · afternoon sky', greeting: 'Good afternoon' },
    sunset: { title: 'Sunset', icon: 'wb_twilight', windowLabel: 'Window · sunset', greeting: 'Good evening' },
    night: { title: 'Tonight', icon: 'dark_mode', windowLabel: 'Window · tonight', greeting: 'Good evening' }
  };
  /* Sunrise phase runs from 40 min before to 40 min after sunrise; sunset phase from
   * 60 min before to 30 min after sunset; morning ends at noon. */
  function phase(now) {
    now = now || new Date();
    var p = place(), t = times(now, p.lat, p.lon), m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    var key = m < t.sunrise - 40 ? 'night' : m < t.sunrise + 40 ? 'sunrise' : m < 720 ? 'morning' : m < t.sunset - 60 ? 'afternoon' : m < t.sunset + 30 ? 'sunset' : 'night';
    var out = Object.assign({ key: key, sunriseMin: t.sunrise, sunsetMin: t.sunset, sunrise: hm(t.sunrise), sunset: hm(t.sunset), place: p }, PHASES[key]);
    if (key === 'night' && now.getHours() < 5) out.greeting = 'Still up';
    return out;
  }
  root.OvuSun = { place: place, times: times, phase: phase, hm: hm, PHASES: PHASES };
})(window);
