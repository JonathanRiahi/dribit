// Run by the build workflow inside the simulator (test builds only): asks the phone side for each thing the web app
// uses and writes the answers to the log, so a broken bridge shows up in the workflow run, not on someone's phone.
(async function () {
  var N = window.DribitNative;
  function log(k, v) { try { return N.call('debug.log', { text: k + ' = ' + (typeof v === 'string' ? v : JSON.stringify(v)) }); } catch (e) { /* ignore */ } }
  if (!N) return;
  try {
    await log('native', { platform: N.platform, appVersion: N.appVersion, build: N.build, os: N.os });
    await log('page', { title: document.title, url: location.href, w: innerWidth, h: innerHeight, dpr: devicePixelRatio });
    await log('ua', navigator.userAgent);
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);left:0;width:1px;visibility:hidden';
    document.body.appendChild(probe);
    var r = probe.getBoundingClientRect();
    await log('safe-area', { top: r.top, bottom: innerHeight - r.bottom });
    probe.remove();
    await log('web-features', {
      serviceWorker: 'serviceWorker' in navigator, push: 'PushManager' in window, notification: 'Notification' in window,
      share: typeof navigator.share, vibrate: typeof navigator.vibrate, standalone: navigator.standalone,
      displayStandalone: matchMedia('(display-mode: standalone)').matches
    });
    if ('serviceWorker' in navigator) {
      var reg = await navigator.serviceWorker.getRegistration();
      await log('service-worker', { registered: !!reg, scope: reg && reg.scope, controlled: !!navigator.serviceWorker.controller });
      if (window.caches) await log('caches', await caches.keys());
    }
    var before = localStorage.getItem('dribit.nativeCheck');
    localStorage.setItem('dribit.nativeCheck', String(Date.now()));
    await log('storage', { fromEarlierRun: before, progress: !!localStorage.getItem('dribit.progress.v1') });
    await log('notifications.status', await N.call('notifications.status'));
    await log('launch.info', await N.call('launch.info'));
    await N.call('haptic', { type: 'success' });
    await log('schedule', await N.call('notifications.schedule', { items: [
      { id: 'test-1', at: Date.now() + 3600000, title: 'דריבית', body: 'בדיקה ראשונה' },
      { id: 'test-2', at: Date.now() + 90000000, title: 'דריבית', body: 'בדיקה שנייה' },
      { id: 'past', at: Date.now() - 1000, title: 'דריבית', body: 'עבר' }
    ] }));
    await log('pending', await N.call('notifications.pending'));
    await N.call('notifications.cancel');
    await log('pending-after-cancel', await N.call('notifications.pending'));
    try { await N.call('no.such.command'); await log('unknown-command', 'accepted (wrong)'); } catch (e) { await log('unknown-command', 'rejected: ' + e.message); }
    await log('done', true);
  } catch (e) {
    await log('ERROR', String(e && e.stack || e));
  }
})();
