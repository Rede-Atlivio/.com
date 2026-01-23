const CACHE_NAME = 'atlivio-v1';

// Instala o Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força ativação imediata
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Intercepta requisições (Básico para PWA funcionar)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
