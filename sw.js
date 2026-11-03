/* Axiom service worker.
   Its only job is to make the site installable — Chrome on Android will not offer
   "Install app" without a registered worker that has a fetch handler.

   Deliberately NOT a caching layer. The site changes every week (messages, events,
   next steps) and a cache-first worker would hand people last week's site with no
   way to know. Every request goes to the network. The only thing kept on the device
   is the offline card below, shown when a page request fails outright. */

const VERSION = 'axiom-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll([OFFLINE, '/assets/icons/apple-touch-icon.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;

  // Page loads: always the network. If the network is gone, show the offline card.
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Everything else: network, with the cache as a fallback only for the two files
  // cached above. Nothing new is ever written to the cache.
  e.respondWith(fetch(r).catch(() => caches.match(r)));
});
