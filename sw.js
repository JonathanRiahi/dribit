// Service worker: makes Dribit installable, lets it open without internet, and shows the daily reminder.
// build.py stamps VERSION, the file list and PUSH (the public push key and the usage-data key from config.js).
// Each deploy changes VERSION, so phones fetch the new version in the background and the app reloads itself
// on the next screen change. HASHES (also stamped) lets a new version copy every unchanged file from the old cache
// and download only what changed, so the update is ready a second or two after the app opens (0.20: Kfir saw the old
// version for ~20 seconds while all 120+ files downloaded again).
var VERSION = '0.23.0-c542e749';
var FILES = ["./", "index.html", "styles.css", "config.js", "app.js", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/badge-96.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "icons/maskable-512.png", "assets/images/done-celebration.svg", "assets/images/empty-empty.svg", "assets/images/partner-interactive.png", "assets/images/partner-meitav.png", "assets/images/unit1-online-banking.svg", "assets/images/unit10-travelers.svg", "assets/images/unit2-savings.svg", "assets/images/unit3-watering-plants.svg", "assets/images/unit4-bull-market.svg", "assets/images/unit5-investing.svg", "assets/images/unit6-warning.svg", "assets/images/unit7-career-progress.svg", "assets/images/unit8-five-year-plan.svg", "assets/images/welcome-growth-curve.svg", "assets/pics/abacus.svg", "assets/pics/airplane-departure.svg", "assets/pics/alarm-clock.svg", "assets/pics/ambulance.svg", "assets/pics/balance-scale.svg", "assets/pics/balloon.svg", "assets/pics/bank.svg", "assets/pics/bar-chart.svg", "assets/pics/basket.svg", "assets/pics/bomb.svg", "assets/pics/books.svg", "assets/pics/brick.svg", "assets/pics/briefcase.svg", "assets/pics/bullseye.svg", "assets/pics/calendar.svg", "assets/pics/card-file-box.svg", "assets/pics/card-index-dividers.svg", "assets/pics/chains.svg", "assets/pics/chart-decreasing.svg", "assets/pics/chart-increasing.svg", "assets/pics/check-mark-button.svg", "assets/pics/classical-building.svg", "assets/pics/clipboard.svg", "assets/pics/cloud-with-lightning-and-rain.svg", "assets/pics/coin.svg", "assets/pics/credit-card.svg", "assets/pics/crossed-swords.svg", "assets/pics/currency-exchange.svg", "assets/pics/detective-light.svg", "assets/pics/droplet.svg", "assets/pics/egg.svg", "assets/pics/elephant.svg", "assets/pics/eyes.svg", "assets/pics/factory.svg", "assets/pics/fishing-pole.svg", "assets/pics/globe-showing-europe-africa.svg", "assets/pics/handshake.svg", "assets/pics/hourglass-done.svg", "assets/pics/hourglass-not-done.svg", "assets/pics/house-with-garden.svg", "assets/pics/house.svg", "assets/pics/joystick.svg", "assets/pics/label.svg", "assets/pics/ladder.svg", "assets/pics/locked.svg", "assets/pics/magnifying-glass-tilted-left.svg", "assets/pics/melting-face.svg", "assets/pics/memo.svg", "assets/pics/military-helmet.svg", "assets/pics/military-medal.svg", "assets/pics/mobile-phone-off.svg", "assets/pics/mobile-phone.svg", "assets/pics/money-bag.svg", "assets/pics/money-with-wings.svg", "assets/pics/mouse-trap.svg", "assets/pics/newspaper.svg", "assets/pics/no-entry.svg", "assets/pics/older-person-light.svg", "assets/pics/package.svg", "assets/pics/page-facing-up.svg", "assets/pics/party-popper.svg", "assets/pics/people-hugging.svg", "assets/pics/performing-arts.svg", "assets/pics/person-running-light.svg", "assets/pics/pig-face.svg", "assets/pics/pinching-hand-light.svg", "assets/pics/pizza.svg", "assets/pics/puzzle-piece.svg", "assets/pics/receipt.svg", "assets/pics/repeat-button.svg", "assets/pics/rocket.svg", "assets/pics/roller-coaster.svg", "assets/pics/round-pushpin.svg", "assets/pics/scissors.svg", "assets/pics/see-no-evil-monkey.svg", "assets/pics/seedling.svg", "assets/pics/shield.svg", "assets/pics/shopping-cart.svg", "assets/pics/sleeping-face.svg", "assets/pics/slot-machine.svg", "assets/pics/snail.svg", "assets/pics/spiral-calendar.svg", "assets/pics/spiral-notepad.svg", "assets/pics/stop-sign.svg", "assets/pics/stopwatch.svg", "assets/pics/tear-off-calendar.svg", "assets/pics/thermometer.svg", "assets/pics/ticket.svg", "assets/pics/triangular-flag.svg", "assets/pics/trophy.svg", "assets/pics/umbrella.svg", "assets/pics/unlocked.svg", "assets/pics/warning.svg", "assets/pics/wrapped-gift.svg", "data/lessons.json"];
var HASHES = {"index.html": "707c5f0a", "styles.css": "403e7491", "config.js": "0255ea56", "app.js": "da65614b", "manifest.webmanifest": "8184eee0", "icons/apple-touch-icon.png": "134fbe65", "icons/badge-96.png": "68e64c0e", "icons/favicon-32.png": "1580a072", "icons/icon-192.png": "796522ba", "icons/icon-512.png": "c9139192", "icons/icon.svg": "4c368994", "icons/maskable-512.png": "1c7f6a1d", "assets/images/done-celebration.svg": "4e34ac87", "assets/images/empty-empty.svg": "7547b8fa", "assets/images/partner-interactive.png": "34d291ff", "assets/images/partner-meitav.png": "d0801d10", "assets/images/unit1-online-banking.svg": "a16c11f7", "assets/images/unit10-travelers.svg": "4a379ebc", "assets/images/unit2-savings.svg": "268fcc59", "assets/images/unit3-watering-plants.svg": "b9c71f45", "assets/images/unit4-bull-market.svg": "d549e60e", "assets/images/unit5-investing.svg": "221c5e19", "assets/images/unit6-warning.svg": "df2fc602", "assets/images/unit7-career-progress.svg": "3efdb3e0", "assets/images/unit8-five-year-plan.svg": "2bb36d6e", "assets/images/welcome-growth-curve.svg": "d32d17a2", "assets/pics/abacus.svg": "57035215", "assets/pics/airplane-departure.svg": "8730d2fa", "assets/pics/alarm-clock.svg": "e8e81d48", "assets/pics/ambulance.svg": "b3ad5c2f", "assets/pics/balance-scale.svg": "25d65c49", "assets/pics/balloon.svg": "42b1a571", "assets/pics/bank.svg": "abbadf2f", "assets/pics/bar-chart.svg": "d49c0a78", "assets/pics/basket.svg": "39a3d77c", "assets/pics/bomb.svg": "b6046345", "assets/pics/books.svg": "8e9ae395", "assets/pics/brick.svg": "cf590498", "assets/pics/briefcase.svg": "88deff71", "assets/pics/bullseye.svg": "ed44551b", "assets/pics/calendar.svg": "b975b976", "assets/pics/card-file-box.svg": "ad79679f", "assets/pics/card-index-dividers.svg": "948bf5f3", "assets/pics/chains.svg": "2210fe83", "assets/pics/chart-decreasing.svg": "f7d5c65f", "assets/pics/chart-increasing.svg": "f863b316", "assets/pics/check-mark-button.svg": "6fd89a91", "assets/pics/classical-building.svg": "645869d2", "assets/pics/clipboard.svg": "df462d74", "assets/pics/cloud-with-lightning-and-rain.svg": "3091eb89", "assets/pics/coin.svg": "f3ddc69b", "assets/pics/credit-card.svg": "7dd07bd6", "assets/pics/crossed-swords.svg": "7d874d84", "assets/pics/currency-exchange.svg": "b07683f4", "assets/pics/detective-light.svg": "c678ae9f", "assets/pics/droplet.svg": "43a29932", "assets/pics/egg.svg": "91c4507b", "assets/pics/elephant.svg": "7f902c74", "assets/pics/eyes.svg": "ff37077c", "assets/pics/factory.svg": "bd14362e", "assets/pics/fishing-pole.svg": "4fe4385e", "assets/pics/globe-showing-europe-africa.svg": "25cc38b3", "assets/pics/handshake.svg": "a0aecac6", "assets/pics/hourglass-done.svg": "9031be3c", "assets/pics/hourglass-not-done.svg": "5327ed7b", "assets/pics/house-with-garden.svg": "9c6055ee", "assets/pics/house.svg": "e3bfd785", "assets/pics/joystick.svg": "3c82e90c", "assets/pics/label.svg": "e119b923", "assets/pics/ladder.svg": "de9b1de1", "assets/pics/locked.svg": "c4da266b", "assets/pics/magnifying-glass-tilted-left.svg": "87500a57", "assets/pics/melting-face.svg": "50ba1e54", "assets/pics/memo.svg": "f5630024", "assets/pics/military-helmet.svg": "20d37434", "assets/pics/military-medal.svg": "3c9bc8f0", "assets/pics/mobile-phone-off.svg": "d5c856fe", "assets/pics/mobile-phone.svg": "d1807063", "assets/pics/money-bag.svg": "98bf7924", "assets/pics/money-with-wings.svg": "91466f1c", "assets/pics/mouse-trap.svg": "f07e4e24", "assets/pics/newspaper.svg": "cae73e36", "assets/pics/no-entry.svg": "e60c02c2", "assets/pics/older-person-light.svg": "e329ed2e", "assets/pics/package.svg": "a5d50f75", "assets/pics/page-facing-up.svg": "e29e5344", "assets/pics/party-popper.svg": "16b08a7b", "assets/pics/people-hugging.svg": "bf88ef52", "assets/pics/performing-arts.svg": "651ab82c", "assets/pics/person-running-light.svg": "a6b67749", "assets/pics/pig-face.svg": "6d78dd03", "assets/pics/pinching-hand-light.svg": "82a4d73e", "assets/pics/pizza.svg": "1aabf017", "assets/pics/puzzle-piece.svg": "f5dc028f", "assets/pics/receipt.svg": "7cd41ee5", "assets/pics/repeat-button.svg": "694cf4e9", "assets/pics/rocket.svg": "b0dc12ff", "assets/pics/roller-coaster.svg": "bfa93ffe", "assets/pics/round-pushpin.svg": "a2ca1be1", "assets/pics/scissors.svg": "8c8d4a8f", "assets/pics/see-no-evil-monkey.svg": "57b7d13b", "assets/pics/seedling.svg": "497717d7", "assets/pics/shield.svg": "f48d24ac", "assets/pics/shopping-cart.svg": "7307dd7d", "assets/pics/sleeping-face.svg": "fc1ad04f", "assets/pics/slot-machine.svg": "56093a71", "assets/pics/snail.svg": "fadd56db", "assets/pics/spiral-calendar.svg": "08ec97fb", "assets/pics/spiral-notepad.svg": "5b1d78da", "assets/pics/stop-sign.svg": "ff8a62ef", "assets/pics/stopwatch.svg": "f7e4cab6", "assets/pics/tear-off-calendar.svg": "a6046312", "assets/pics/thermometer.svg": "ea58297b", "assets/pics/ticket.svg": "47813f70", "assets/pics/triangular-flag.svg": "1f58afb5", "assets/pics/trophy.svg": "aa2a67c7", "assets/pics/umbrella.svg": "a2fb5b7a", "assets/pics/unlocked.svg": "e6b608f0", "assets/pics/warning.svg": "c4292504", "assets/pics/wrapped-gift.svg": "1410a8a0", "data/lessons.json": "b5c21f88", "./": "707c5f0a"};
var PUSH = {"key": "BMwrT7BZQpvx3UGBsw5khdO5ZkwERNxRXz1slfXdwAWv0tMwhybKF6r25OJ3Ca_xqDKUoHllMRY82gacM79Nr6g", "posthogKey": "phc_tsse5UQex6pJhPK4yZkLjXLTXykftLFo8BXibrXa3Bqm", "host": "https://eu.i.posthog.com"};
var CACHE = 'dribit-' + VERSION;
var FONTS = 'dribit-fonts';
var META = 'dribit-meta'; // a tiny key-value store the page shares with this worker (the user's anonymous id)

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return cacheFile(c, f); }));
  }).then(function () { return self.skipWaiting(); }));
});

// a file whose bytes match the new version (same hash) is copied from an older cache; anything else is downloaded.
// cache: 'reload' skips the browser's HTTP cache so a new deploy never mixes old and new files.
function cacheFile(c, f) {
  var req = new Request(f, { cache: 'reload' });
  var download = function () {
    return fetch(req).then(function (res) {
      if (!res.ok) throw new Error('failed ' + f);
      return c.put(req, res);
    });
  };
  if (!HASHES[f] || !(self.crypto && crypto.subtle)) return download();
  return oldCopy(req).then(function (hit) {
    if (!hit) return download();
    return hit.clone().arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function (h) {
      return hex(h).slice(0, 8) === HASHES[f] ? c.put(req, hit) : download();
    });
  }).catch(download);
}
function oldCopy(req) {
  return caches.keys().then(function (keys) {
    var old = keys.filter(function (k) { return k.indexOf('dribit-') === 0 && k !== CACHE && k !== FONTS && k !== META; });
    var next = function (i) {
      if (i >= old.length) return Promise.resolve(null);
      return caches.open(old[i]).then(function (oc) { return oc.match(req); }).then(function (hit) { return hit || next(i + 1); });
    };
    return next(0);
  });
}
function hex(buf) {
  var b = new Uint8Array(buf), out = '';
  for (var i = 0; i < b.length; i++) out += (b[i] < 16 ? '0' : '') + b[i].toString(16);
  return out;
}

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
  // 0.20 (Kfir saw an old version for ~20 s): with reception, the app opens from the network, so everyone sees the latest
  // version at once. Only offline, or when the network is slow, it opens from the copy on the phone.
  if (req.mode === 'navigate') {
    e.respondWith(fresh(url.href, 3000).then(function (res) { freshAt = Date.now(); return res; }, function () {
      freshAt = 0;
      return caches.match('index.html', { cacheName: CACHE }).then(function (hit) { return hit || fetch(req); });
    }));
    return;
  }
  // the app's own code and lessons follow the page: from the network when the page came from it, so the versions never mix
  var core = CORE.indexOf(url.pathname.slice(SCOPE_PATH.length)) >= 0;
  if (core && Date.now() - freshAt < 60 * 1000) {
    e.respondWith(fresh(url.href, 8000).catch(function () { return cached(req); }));
    return;
  }
  e.respondWith(cached(req));
});

var CORE = ['config.js', 'app.js', 'styles.css', 'data/lessons.json', 'manifest.webmanifest'];
var SCOPE_PATH = new URL(self.registration.scope).pathname;
var freshAt = 0; // when the last app page came from the network
function cached(req) {
  return caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(function (hit) { return hit || fetch(req); });
}
// the network copy (checked with the server, so never an old copy from the browser), or a failure after ms
function fresh(href, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('slow')); }, ms);
    fetch(href, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      clearTimeout(t);
      if (res.ok) resolve(res); else reject(new Error('http ' + res.status));
    }, function (err) { clearTimeout(t); reject(err); });
  });
}

// the page asks which version this worker holds, so it reloads only when it is older than that
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'version?' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
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
