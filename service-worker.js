// Network-first with cache fallback: online visits always pick up the latest files,
// and the precached shell keeps the app working offline (e.g. inside a hall).
const CACHE_NAME = 'hana-scope-v8';
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
  './src/ui/dai-rank.mjs',
  './src/ui/render.mjs',
  './src/ui/view-model.mjs',
  './src/worker/protocol.mjs',
  './src/worker/simulation-worker.mjs'
];

// 台番の順位の封をした数字（公開版にだけある。無くても入れ替えは止めない）
const OPTIONAL_ASSETS = ['./data/dai-rank.box.json', './data/dai-rank.sealed.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)
    .then(() => Promise.all(OPTIONAL_ASSETS.map((asset) => cache.add(asset).catch(() => {}))))));
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
  // 電波がある時は、ブラウザの使い回し（最大10分）を通さず、毎回いちばん新しい中身を確かめに行く
  const fresh = event.request.mode === 'navigate' ? event.request.url : event.request;
  event.respondWith(
    fetch(fresh, { cache: 'no-cache' })
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
