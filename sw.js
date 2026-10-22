/* Rhythme service worker: an offline shell for the room and its media, plus
 * notification plumbing for reminders. Pages, scripts and styles go network
 * first so a new release is never mixed with an old one; media and fonts are
 * cached first because their file names change when their content does. */
var VERSION = 'ovumind-2026-10-22-r9';
var MEDIA = /\.(?:webp|png|jpe?g|gif|svg|mp3|mp4|woff2?|ttf|wasm)(\?.*)?$/i;
var CODE = /\.(?:css|js|json|html)(\?.*)?$/i;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc || CODE.test(url.pathname)) {
    e.respondWith(fetch(req).then(function (r) {
      if (r && r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return r;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || (isDoc ? caches.match('room.html') : undefined) || Response.error(); });
    }));
    return;
  }
  if (MEDIA.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (r) { if (r && r.ok) cache.put(req, r.clone()); return r; });
      });
    }));
  }
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || 'room.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(target);
  }));
});

self.addEventListener('message', function (e) {
  var m = e.data || {};
  if (m.type === 'notify' && self.registration.showNotification) self.registration.showNotification(m.title || 'Rhythme', m.options || {});
});
