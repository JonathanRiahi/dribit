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
  function alpha(a) { return a === undefined ? 1 : a.slice(-1) === '%' ? parseFloat(a) / 100 : parseFloat(a); }
  // the first colour in a computed style value, as the browser prints it: rgb(), rgba() or color(srgb ...)
  function firstColor(text) {
    text = text || '';
    var a = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)/.exec(text);
    var b = /color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/.exec(text);
    if (b && (!a || b.index < a.index)) return [b[1] * 255, b[2] * 255, b[3] * 255, alpha(b[4])];
    return a ? [+a[1], +a[2], +a[3], alpha(a[4])] : null;
  }
  // What is seen along the top edge: the layers under that point from the front one back, until nothing shows
  // through. So a sheet that dims the page dims the strip too, and a screen that opens with a colour wash keeps it.
  function topColor() {
    var x = Math.floor(window.innerWidth / 2);
    var stack = document.elementsFromPoint ? document.elementsFromPoint(x, 1) : [document.elementFromPoint(x, 1)];
    var r = 0, g = 0, b = 0, a = 0;
    function under(c) {
      if (!c || !(c[3] > 0) || a >= 0.99) return;
      var w = (1 - a) * Math.min(1, c[3]);
      r += c[0] * w; g += c[1] * w; b += c[2] * w; a += w;
    }
    for (var i = 0; i < stack.length && a < 0.99; i++) {
      var el = stack[i];
      if (!el || el.nodeType !== 1) continue;
      var cs = getComputedStyle(el);
      if ((cs.backgroundImage || '').indexOf('gradient(') >= 0) under(firstColor(cs.backgroundImage));
      under(firstColor(cs.backgroundColor));
    }
    if (a < 0.5) return null;
    return [Math.round(r / a), Math.round(g / a), Math.round(b / a)];
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
    // a layer that fades in has its final look only when the fade ends
    document.addEventListener('animationend', soon, true);
    document.addEventListener('transitionend', soon, true);
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
