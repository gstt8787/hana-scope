// Network-first with cache fallback: online visits always pick up the latest files,
// and the precached shell keeps the app working offline (e.g. inside a hall).
const CACHE_NAME = 'hana-scope-v5';
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/hana-scope.svg',
  './src/styles.css',
  './src/app.mjs',
  './src/domain/csv.mjs',
  './src/domain/estimate.mjs',
  './src/domain/machine.mjs',
  './src/domain/random.mjs',
  './src/domain/simulate.mjs',
  './src/ui/render.mjs',
  './src/ui/view-model.mjs',
  './src/worker/protocol.mjs',
  './src/worker/simulation-worker.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('./index.html'))),
  );
});
