/* KRYPTØN — service worker
 *
 * Two jobs: make the installed app open with no network, and keep the shell
 * fresh when it changes.
 *
 *   navigation  -> network first, cache as the fallback (never a stale page)
 *   everything  -> cache first, refreshed in the background
 *
 * Bump CACHE_VERSION whenever the shell changes; the old cache is dropped on
 * activate, so a stale asset can never outlive a deploy.
 */

var CACHE_VERSION = 'krypton-v5';

var SHELL = [
  './',
  'index.html',
  'styles.css',
  'site.webmanifest',
  'js/engine.js',
  'js/ai.js',
  'js/engine-client.js',
  'js/engine-worker.js',
  'js/app.js',
  'assets/logo/icon-32.png',
  'assets/logo/icon-180.png',
  'assets/logo/icon-192.png',
  'assets/logo/icon-512.png',
  'assets/logo/favicon.ico',
  'assets/pieces/wK.svg', 'assets/pieces/wQ.svg', 'assets/pieces/wR.svg',
  'assets/pieces/wB.svg', 'assets/pieces/wN.svg', 'assets/pieces/wP.svg',
  'assets/pieces/bK.svg', 'assets/pieces/bQ.svg', 'assets/pieces/bR.svg',
  'assets/pieces/bB.svg', 'assets/pieces/bN.svg', 'assets/pieces/bP.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      /* addAll rejects the whole install if one file 404s, so add individually */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* optional asset */ });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_VERSION) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* a page load: try the network, fall back to the cached shell */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put('index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  /* assets: cache first, then network (and remember what we fetched) */
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
