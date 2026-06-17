const CACHE_NAME = 'hmittou-cache-v36';
const ASSETS = [
  './',
  './index.html',
  './site.webmanifest',
  './fonts/amiri-regular-arabic.woff2',
  './assets/apple-touch-icon.png',
  './assets/favicon-16x16.png',
  './assets/favicon-32x32.png',
  './assets/favicon.ico',
  './assets/favicon.svg',
  './assets/hmittou-icon-192.png',
  './assets/hmittou-icon-512.png',
  './assets/hmittou-icon-maskable-512.png',
  './assets/js/gtm-loader.min.js?v=8f6bed256c',
  './assets/js/app.min.js?v=68b18c7e43'
];

// Install Service Worker and cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network-First for HTML/root, Cache-First for static assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Do not intercept tracking/analytics requests to avoid Service Worker errors
  if (
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('analytics') ||
    url.pathname.includes('/collect')
  ) {
    return;
  }

  // For index.html or root requests, use Network-First strategy
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Open cache and update it with the fresh HTML
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If offline, serve the HTML from cache
          return caches.match(event.request);
        })
    );
  } else {
    // For static assets (fonts, images, icons, manifest), use Cache-First (Offline-first)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((response) => {
            // Cache newly fetched requests on the fly
            // Allow caching same-origin ('basic') and cross-origin CORS ('cors') responses (e.g. FontAwesome fonts)
            if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => {
            // Handle fetch failures (like offline or aborted requests) gracefully
            return Response.error();
          });
      })
    );
  }
});
