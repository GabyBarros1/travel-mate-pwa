const CACHE_NAME = 'travel-mate-v15';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './itinerary.json',
  './cultural_base.json',
  './manifest.json',
  './dubai-cover.jpg',
  './ny-cover.jpg',
  './ba-cover.jpg',
  './israel-cover.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isDynamicCoreFile =
    isSameOrigin &&
    (
      url.pathname.endsWith('/app.js') ||
      url.pathname.endsWith('/itinerary.json') ||
      url.pathname.endsWith('/cultural_base.json') ||
      url.pathname.endsWith('/dubai-cover.jpg') ||
      url.pathname.endsWith('/ny-cover.jpg') ||
      url.pathname.endsWith('/ba-cover.jpg') ||
      url.pathname.endsWith('/israel-cover.jpg')
    );

  if (request.method !== 'GET') {
    return;
  }

  // Network-first for frequently edited data/code files; fallback to cache offline.
  if (isDynamicCoreFile) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for app shell for fast startup and offline resilience.
  event.respondWith(
    caches.match(request).then((cachedResponse) =>
      cachedResponse ||
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match('./index.html'))
    )
  );
});
