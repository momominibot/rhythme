/* Rhythme page gate for pages that load neither ovu-store.js nor appnav.js: the same rule as theirs. A person is sent to
 * the room unless this phone holds a signed-in session, the current data notice (OvuStore.NOTICE_V, kept in step here as 4)
 * and the 18+ confirmation. Runs at load, when another tab changes the session or the diary, and on return from the cache. */
(function () {
  var NOTICE_V = 4;
  function gate() { try { var db = JSON.parse(localStorage.getItem('ovumind_db_v1') || 'null'), c = db && db.profile && db.profile.consent, a = db && db.profile && db.profile.ageAttest, sn = JSON.parse(localStorage.getItem('ovumind_auth_v1') || 'null'); if (!(sn && sn.access_token) || !(c && c.at && c.v >= NOTICE_V && a && a.confirmed === true)) location.replace('room.html'); } catch (e) { try { location.replace('room.html'); } catch (e2) { } } }
  gate();
  try { window.addEventListener('storage', function (e) { if (!e || e.key === null || e.key === 'ovumind_auth_v1' || e.key === 'ovumind_db_v1') gate(); }); window.addEventListener('pageshow', function (e) { if (e && e.persisted) gate(); }); } catch (e) { }
})();
