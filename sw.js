// Aturan Wajib: Setiap kali Anda mengubah kode HTML/JS dan mengunggahnya ke Netlify, 
// Anda HARUS mengubah angka versi di bawah ini (misal: v5, v6, dst) agar HP pengguna mendeteksi pembaruan!
const CACHE_NAME = 'blasting-pwa-v15';
const LOCAL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/libs/dxf-parser.min.js',
  './js/libs/proj4.js',
  './js/libs/turf.min.js',
  './js/config.js',
  './js/utils.js',
  './js/api.js',
  './js/spatial.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/tables.js',
  './js/forms.js',
  './js/allocations.js',
  './js/map.js',
  './js/export.js',
  './js/app.js'
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
  const url = event.request.url;

  // 1. Abaikan request non-GET (POST apiCall, dsb)
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Abaikan API backend Google Apps Script & Dropbox
  if (url.includes('script.google.com') ||
    url.includes('script.googleusercontent.com') ||
    url.includes('dropbox')) {
    return;
  }

  // 3. PENTING (Solusi Orthophoto Seamless):
  // JANGAN perkenankan Service Worker mencegat request ke Intranet Orthophoto (10.165.1.14:9090)
  // maupun tile map satellite.
  // Jika dicegat Service Worker di HTTPS, browser memblokirnya sebagai Mixed Content fetch()
  // sehingga mengharuskan hard refresh (Ctrl+F5). Dengan me-return langsung di sini,
  // browser akan memuat tile secara direct sebagai <img> native tanpa hambatan.
  if (url.includes('10.165.1.14') ||
    url.includes(':9090') ||
    url.includes('WMTS') ||
    url.includes('GetTile') ||
    url.includes('grid_merc') ||
    url.includes('google.com/vt') ||
    url.includes('mt0.google.com') ||
    url.includes('mt1.google.com') ||
    url.includes('mt2.google.com') ||
    url.includes('mt3.google.com') ||
    url.includes('tile.openstreetmap.org')) {
    return;
  }

  // 4. Abaikan seluruh request protokol HTTP ke intranet
  if (url.startsWith('http://')) {
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
