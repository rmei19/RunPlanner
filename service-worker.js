/**
 * service-worker.js
 * Le numéro de version DOIT rester synchronisé avec RP_VERSION dans js/config.js
 * (leçon #11) : c'est ce qui invalide le cache d'une version à l'autre, et il
 * est affiché dans le panneau de diagnostic pour vérifier en un coup d'œil
 * que le client a bien reçu la dernière version.
 */
const RP_SW_VERSION = '0.2.0';
const CACHE_NAME = `runplanner-cache-v${RP_SW_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/diagnostics.js',
  './js/theme.js',
  './js/map.js',
  './js/geocoder.js',
  './js/routing.js',
  './js/loops.js',
  './js/exercises.js',
  './js/citytour.js',
  './js/export.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stratégie : cache d'abord pour l'app shell, réseau d'abord pour les appels API
// (tuiles, routage, géocodage) qui doivent rester à jour et ne sont pas mis en cache ici.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;

  if (!isAppShell) return; // laisse passer les requêtes vers les API externes normalement

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
