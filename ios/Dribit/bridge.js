// Runs inside the page before any of its own code. Gives the web app a small `DribitNative` object, so it knows it is
// inside the iPhone app and can ask the phone for things a web page cannot do: the daily reminder, a tap you can feel,
// the share sheet, the review prompt.
(function () {
  'use strict';
  if (window.DribitNative || !window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.dribit) return;
  var handler = window.webkit.messageHandlers.dribit;

  // every call returns a promise with the phone's answer
  function call(cmd, args) {
    try { return handler.postMessage({ cmd: String(cmd), args: args || {} }); } catch (e) { return Promise.reject(e); }
  }
  function quiet(p) { if (p && p.catch) p.catch(function () { /* ignore */ }); }

  var native = {
    platform: 'ios',
    appVersion: '%VERSION%',
    build: '%BUILD%',
    os: '%OS%',
    call: call,
    // the app tells the page something happened (a reminder was tapped): window event 'dribitnative'
    _emit: function (type, data) {
      try { window.dispatchEvent(new CustomEvent('dribitnative', { detail: { type: type, data: data || {} } })); } catch (e) { /* ignore */ }
    }
  };
  try { Object.defineProperty(window, 'DribitNative', { value: native, writable: false, configurable: false }); }
  catch (e) { window.DribitNative = native; }

  // The strip behind the clock and the battery takes the colour of whatever is at the top of the page
  // (the green opening screen, then the app's background, light or dark).
  var lastColor = '', timer = null;
  function topColor() {
    var el = document.elementFromPoint(Math.floor(window.innerWidth / 2), 1);
    while (el && el.nodeType === 1) {
      var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?\s*\)/.exec(getComputedStyle(el).backgroundColor || '');
      if (m && (m[4] === undefined || parseFloat(m[4]) >= 0.99)) return [+m[1], +m[2], +m[3]];
      el = el.parentElement;
    }
    return null;
  }
  function report() {
    timer = null;
    var c;
    try { c = topColor(); } catch (e) { c = null; }
    if (!c) return;
    var key = c.join(',');
    if (key === lastColor) return;
    lastColor = key;
    quiet(call('chrome', { r: c[0], g: c[1], b: c[2] }));
  }
  function soon() { if (!timer) timer = setTimeout(report, 120); }
  function start() {
    quiet(call('ready'));
    report();
    try {
      new MutationObserver(soon).observe(document.documentElement, {
        attributes: true, childList: true, subtree: true, attributeFilter: ['class', 'style', 'hidden', 'data-skin', 'data-theme']
      });
    } catch (e) { /* ignore */ }
    try {
      var dark = window.matchMedia('(prefers-color-scheme: dark)');
      if (dark.addEventListener) dark.addEventListener('change', soon); else if (dark.addListener) dark.addListener(soon);
    } catch (e) { /* ignore */ }
    window.addEventListener('load', soon);
    window.addEventListener('pageshow', soon);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // the phone's own share sheet, where the web view has none
  if (!navigator.share) {
    try {
      navigator.share = function (d) {
        d = d || {};
        return call('share', { title: d.title || '', text: d.text || '', url: d.url || '' }).then(function (r) {
          if (!r || !r.completed) { var e = new Error('Share canceled'); e.name = 'AbortError'; throw e; }
        });
      };
      navigator.canShare = function (d) { return !!d && !d.files; };
    } catch (e) { /* ignore */ }
  }
})();
