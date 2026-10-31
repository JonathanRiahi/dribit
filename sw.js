// Service worker: makes Dribit installable, lets it open without internet, and shows the daily reminder.
// build.py stamps VERSION, the file list and PUSH (the public push key and the usage-data key from config.js).
// Each deploy changes VERSION, so phones fetch the new version in the background and the app reloads itself
// on the next screen change.
var VERSION = '0.17.0-4a355f98';
var FILES = ["./", "index.html", "styles.css", "config.js", "app.js", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/badge-96.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "icons/maskable-512.png", "assets/images/done-celebration.svg", "assets/images/empty-empty.svg", "assets/images/partner-interactive.png", "assets/images/unit1-online-banking.svg", "assets/images/unit10-travelers.svg", "assets/images/unit2-savings.svg", "assets/images/unit3-watering-plants.svg", "assets/images/unit4-bull-market.svg", "assets/images/unit5-investing.svg", "assets/images/unit6-warning.svg", "assets/images/unit7-career-progress.svg", "assets/images/unit8-five-year-plan.svg", "assets/images/welcome-growth-curve.svg", "data/lessons.json"];
var PUSH = {"key": "BMwrT7BZQpvx3UGBsw5khdO5ZkwERNxRXz1slfXdwAWv0tMwhybKF6r25OJ3Ca_xqDKUoHllMRY82gacM79Nr6g", "posthogKey": "phc_tsse5UQex6pJhPK4yZkLjXLTXykftLFo8BXibrXa3Bqm", "host": "https://eu.i.posthog.com"};
var CACHE = 'dribit-' + VERSION;
var FONTS = 'dribit-fonts';
var META = 'dribit-meta'; // a tiny key-value store the page shares with this worker (the user's anonymous id)

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache: 'reload' skips the browser's HTTP cache so a new deploy never mixes old and new files
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('dribit-') === 0 && k !== CACHE && k !== FONTS && k !== META; })
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
  // pages of their own (the landing page) load from the network, never as the app
  // the landing page's own requests (like ../config.js) also go to the network, so it never reads an old cached config
  if (url.pathname.indexOf('/landing/') !== -1 || (req.referrer && req.referrer.indexOf('/landing/') !== -1)) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then(function (hit) { return hit || fetch(req); }));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req);
  }));
});

// ---------- Daily reminder (Web Push) ----------
// tools/send-reminders.js sends { title, body, url, tag } once a day; the phone shows it even when the app is closed.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'דריבית', {
    body: d.body || 'כמה דקות היום, והידע מצטבר. השיעור הבא מחכה.',
    icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', dir: 'rtl', lang: 'he',
    tag: d.tag || 'daily', renotify: false, data: { url: d.url || './?source=push' }
  }));
});

// a tap on the reminder brings the open app to the front, or opens it
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) {
        list[i].postMessage({ type: 'push-click', url: url });
        return list[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

// the browser replaced the subscription (rare): subscribe again and record it, so the daily sender keeps working
self.addEventListener('pushsubscriptionchange', function (e) {
  if (!PUSH.key) return;
  var next = e.newSubscription ? Promise.resolve(e.newSubscription)
    : self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH.key) });
  e.waitUntil(next.then(function (sub) {
    var j = sub.toJSON(), keys = j.keys || {};
    return metaGet('uid').then(function (uid) {
      return capture('push_subscribed', uid || 'sw-unknown', { endpoint: j.endpoint, p256dh: keys.p256dh, auth: keys.auth, from: 'renew-sw', $set: { reminders: true } });
    });
  }).catch(function () { /* the page renews the subscription the next time the app opens */ }));
});

function keyBytes(s) {
  var b64 = (s + '===').slice(0, s.length + (4 - s.length % 4) % 4).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(b64), out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function metaGet(k) {
  return caches.open(META).then(function (c) { return c.match('./meta/' + k); })
    .then(function (r) { return r ? r.text() : ''; }).catch(function () { return ''; });
}
function uuid() {
  if (self.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
// the same format app.js uses for usage data: the public project key, distinct_id inside the properties
function capture(event, distinctId, props) {
  if (!PUSH.posthogKey || !PUSH.host) return Promise.resolve();
  var p = { distinct_id: distinctId, app_version: VERSION.split('-')[0], platform: 'sw' };
  for (var k in props) p[k] = props[k];
  return fetch(PUSH.host.replace(/\/$/, '') + '/batch/', {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ api_key: PUSH.posthogKey, batch: [{ uuid: uuid(), event: event, properties: p, timestamp: new Date().toISOString() }] })
  });
}
