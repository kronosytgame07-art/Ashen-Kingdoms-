/**
 * sw.js — Service Worker for Ashen Kingdoms PWA.
 * Chemins relatifs compatibles avec GitHub Pages et cache invalidé à chaque correctif critique.
 */

const CACHE_NAME = 'ashen-kingdoms-v5';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './src/main.js',
  './src/core/BuildingHeightLimiter.js',
  './src/core/Game.js',
  './src/core/Renderer.js',
  './src/core/VillageRenderer.js',
  './src/core/BattleRenderer.js',
  './src/core/BuildingArtist.js',
  './src/core/EventBus.js',
  './src/core/Grid.js',
  './src/core/Economy.js',
  './src/core/TrainingManager.js',
  './src/core/BattleManager.js',
  './src/core/ClanManager.js',
  './src/core/SaveManager.js',
  './src/core/ProfileManager.js',
  './src/core/AssetManager.js',
  './src/ui/GameUI.js',
  './src/data/buildings.js',
  './src/data/units.js',
  './src/data/progression.js',
  './src/data/battle.js',
  './assets/hdv-dark-fortress.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => caches.match('./index.html'))
  );
});