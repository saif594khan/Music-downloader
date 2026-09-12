self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (e) => {
  // Pass network requests through naturally
  e.respondWith(fetch(e.request));
});