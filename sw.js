// Aturan Wajib: Setiap kali Anda mengubah kode HTML/JS dan mengunggahnya ke Netlify, 
// Anda HARUS mengubah angka versi di bawah ini (misal: v5, v6, dst) agar HP pengguna mendeteksi pembaruan!
const CACHE_NAME = 'blasting-pwa-v1'; 
const LOCAL_URLS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa Service Worker baru untuk langsung menginstal dirinya
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => { 
        return cache.addAll(LOCAL_URLS); 
    })
  );
});

// Menghapus cache versi lama saat versi baru aktif
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) 
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com') || 
      event.request.url.includes('script.googleusercontent.com') || 
      event.request.url.includes('dropbox')) {
     return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then(networkResponse => {
            if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
                return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
            });
            return networkResponse;
        }).catch(() => { });
    })
  );
});