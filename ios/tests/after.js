// Test builds only. Reports what the web app did by itself after opening in the seeded state (see seed.js).
(async function () {
  var N = window.DribitNative;
  if (!N) return;
  function log(k, v) { return N.call('debug.log', { text: 'app ' + k + ' = ' + (typeof v === 'string' ? v : JSON.stringify(v)) }); }
  try {
    var cfg = window.DRIBIT_CONFIG || window.CONFIG || {};
    await log('version', cfg.version || '(unknown)');
    var sheet = document.querySelector('#sheet');
    await log('sheet', sheet && sheet.querySelector('.scrim') ? sheet.innerText.replace(/\n+/g, ' | ').slice(0, 200) : '(closed)');
    await log('install-asks', /מסך הבית|איך מתקינים/.test(document.body.innerText));
    await log('online', navigator.onLine);
    if ('serviceWorker' in navigator) {
      var reg = await navigator.serviceWorker.getRegistration();
      await log('offline-copy', { registered: !!reg, controlled: !!navigator.serviceWorker.controller });
    } else await log('offline-copy', 'not supported here');
    await log('status', await N.call('notifications.status'));
    var p = await N.call('notifications.pending');
    var items = (p.items || []).sort(function (a, b) { return a.at - b.at; });
    await log('pending-count', items.length);
    if (items.length) await log('pending-first', { id: items[0].id, at: new Date(items[0].at).toString(), body: items[0].body });
    if (items.length) await log('pending-last', { id: items[items.length - 1].id, at: new Date(items[items.length - 1].at).toString() });
    var s = JSON.parse(localStorage.getItem('dribit.progress.v1') || '{}');
    await log('state', { reminder: s.reminder, installSeen: s.installSeen, lessons: Object.keys(s.lessons || {}).length });
    if (window.__tap) {
      var el = document.querySelector(window.__tap);
      await log('tap ' + window.__tap, !!el);
      if (el) el.click();
    }
    await log('done', true);
  } catch (e) { await log('ERROR', String(e && e.stack || e)); }
})();
