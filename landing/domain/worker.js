// Cloudflare Worker for https://dribit.app
//
// Shows the landing page and the app (both hosted on GitHub Pages from this repo) under dribit.app, so there is one
// copy of each and every push to main updates both addresses.
// 0.32 (17.11, Jonathan saw jonathanriahi.github.io in the address bar): the app is shown at dribit.app/app/ too.
// The github.io address keeps working for everyone who installed the app there (home screen, Android app, iPhone app):
// their progress lives at that address, so they stay on it. A browser at dribit.app takes its progress from github.io
// once, on the first open (index.html + landing/move.html).
//
//   dribit.app/            -> github.io/dribit/landing/   (opens the app at dribit.app/app/)
//   dribit.app/app/...     -> github.io/dribit/...         (the app)
//   dribit.app/app         -> redirect to dribit.app/app/
//   dribit.app/media/...   -> github.io/dribit/landing/media/...
//   dribit.app/config.js   -> github.io/dribit/config.js   (the page loads ../config.js)
//   dribit.app/icons/...   -> github.io/dribit/icons/...
//   www.dribit.app/...     -> redirect to dribit.app/...
//
// Deployed by the GitHub Action "Domain deploy" (.github/workflows/domain.yml) on every change to this folder.
// Setup steps (Hebrew): landing/domain/README.md

const ORIGIN = 'https://jonathanriahi.github.io';

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
    if (path === '/app') {
      return Response.redirect(url.origin + '/app/' + url.search, 302);
    }

    let target;
    if (path.startsWith('/app/')) {
      target = ORIGIN + '/dribit/' + path.slice('/app/'.length) + url.search;
    } else {
      const shared = path === '/config.js' || path.startsWith('/icons/');
      target = ORIGIN + (shared ? '/dribit' : '/dribit/landing') + path + url.search;
    }

    // keep the visitor's headers (Range lets the videos stream on iPhone)
    const res = await fetch(new Request(target, request), { redirect: 'follow' });
    const out = new Response(res.body, res);
    out.headers.delete('x-github-request-id');
    // 0.39 (security check): no other site may show dribit.app inside a frame (a fake page over the real buttons),
    // the browser never guesses a file's type, and other sites see only "dribit.app" as where a click came from
    out.headers.set('X-Frame-Options', 'SAMEORIGIN');
    out.headers.set('X-Content-Type-Options', 'nosniff');
    out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return out;
  },
};
