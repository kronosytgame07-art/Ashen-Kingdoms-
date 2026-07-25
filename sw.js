/**
 * sw.js — Service Worker for Ashen Kingdoms PWA
 * Les URLs sont résolues relativement au dossier du dépôt GitHub Pages.
 */

const CACHE_NAME = 'ashen-kingdoms-v2';
const BASE_URL = new URL('./', self.location.href);

const STATIC_PATHS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './src/main.js',
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

const STATIC_ASSETS = STATIC_PATHS.map((path) => new URL(path, BASE_URL).href);
const FALLBACK_URL = new URL('./index.html', BASE_URL).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Une ressource manquante ne doit plus faire échouer toute l'installation.
      await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));
    })
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
    caches.match(event.request).then(async (cached) => {
      try {
        const response = await fetch(event.request);
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match(FALLBACK_URL);
          if (fallback) return fallback;
        }
        throw error;
      }
    })
  );
});