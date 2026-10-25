// Cloudflare Worker for https://dribit.app
//
// Shows the landing page (landing/ in this repo, hosted on GitHub Pages) at dribit.app,
// so there is one copy of the page and every push to main updates both addresses.
// The app itself stays at https://jonathanriahi.github.io/dribit/ : moving it would
// reset progress and reminders for everyone who installed it, and break the Android app.
//
//   dribit.app/            -> github.io/dribit/landing/
//   dribit.app/media/...   -> github.io/dribit/landing/media/...
//   dribit.app/config.js   -> github.io/dribit/config.js   (the page loads ../config.js)
//   dribit.app/icons/...   -> github.io/dribit/icons/...
//   dribit.app/app         -> redirect to the app
//   www.dribit.app/...     -> redirect to dribit.app/...
//
// Setup steps (Hebrew): landing/domain/README.md

const ORIGIN = 'https://jonathanriahi.github.io';
const APP = ORIGIN + '/dribit/';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const path = url.pathname;
    if (path === '/app' || path.startsWith('/app/')) {
      return Response.redirect(APP + url.search, 302);
    }

    const shared = path === '/config.js' || path.startsWith('/icons/');
    const target = ORIGIN + (shared ? '/dribit' : '/dribit/landing') + path + url.search;

    // keep the visitor's headers (Range lets the videos stream on iPhone)
    const res = await fetch(new Request(target, request), { redirect: 'follow' });
    const out = new Response(res.body, res);
    out.headers.delete('x-github-request-id');
    return out;
  },
};
