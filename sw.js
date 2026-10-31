/* Cache-first sobre una lista fija: la app es totalmente estática, así que una
   vez instalada funciona sin cobertura (sótanos de gimnasio incluidos).
   CACHE es la huella de los ficheros de ASSETS: la recalcula `python tools/excel_app.py`
   (o `python tools/excel_app.py --solo-cache` tras tocar código), y al cambiar, el móvil
   descarga la versión nueva. */

const CACHE = 'gym-9f6bb68c';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/rodilla.css',
  './vendor/fflate.js',
  './js/original-xlsx.js',
  './js/lector-xlsx.js',
  './js/plan.js',
  './js/store.js',
  './js/timer.js',
  './js/xlsx.js',
  './js/export.js',
  './js/rodilla-data.js',
  './js/rodilla-calc.js',
  './js/rodilla.js',
  './js/reglas.js',
  './js/app.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // Guardamos lo que se pida y sea nuestro, para sobrevivir a un cache miss.
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
