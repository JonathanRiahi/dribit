// Service worker: makes Dribit installable and lets it open without internet.
// build.py stamps VERSION and the file list. Each deploy changes VERSION, so phones fetch the new version
// in the background and the app reloads itself on the next screen change.
var VERSION = '0.5.0-4caff278';
var FILES = ["./", "index.html", "styles.css", "config.js", "app.js", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "icons/maskable-512.png", "assets/images/done-celebration.svg", "assets/images/empty-empty.svg", "assets/images/unit1-online-banking.svg", "assets/images/unit2-savings.svg", "assets/images/unit3-watering-plants.svg", "assets/images/unit4-bull-market.svg", "assets/images/unit5-investing.svg", "assets/images/unit6-warning.svg", "assets/images/unit7-career-progress.svg", "assets/images/unit8-five-year-plan.svg", "assets/images/welcome-growth-curve.svg", "data/lessons.json"];
var CACHE = 'dribit-' + VERSION;
var FONTS = 'dribit-fonts';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache: 'reload' skips the browser's HTTP cache so a new deploy never mixes old and new files
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('dribit-') === 0 && k !== CACHE && k !== FONTS; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
        return hit || net;
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // app pages open from the cache, so the app works offline
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then(function (hit) { return hit || fetch(req); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req);
  }));
});
