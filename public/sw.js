// Closet60 service worker — enables "Add to Home Screen" installability and
// light offline resilience for the app shell. Deliberately simple, matching
// the rest of this project's zero-dependency approach.
//
// Bump CACHE_VERSION whenever styles.css/app.js/page markup changes so
// returning visitors pick up the new files instead of stale cached ones.
const CACHE_VERSION = 'c60-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/shop.html',
  '/product.html',
  '/cart.html',
  '/checkout.html',
  '/track.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POST/PUT/DELETE (auth, orders, admin writes)

  const url = new URL(req.url);

  // Never cache API calls — always hit the network so products, auth state,
  // and site content stay live. If offline, let it fail naturally so the
  // page's own try/catch fallback logic (already built into every page) runs.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations: try the network first (so content stays fresh), fall
  // back to the cached shell if offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Static assets (css/js/icons/manifest): cache-first for speed, refresh
  // the cache in the background, fetch from network if not yet cached.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
