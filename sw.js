const CACHE_NAME = "atlivio-v15.4";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./js/app.js",
  "./js/auth.js",
  './js/modules/wallet.js',
  "./js/modules/services.js",
  "./js/modules/jobs.js",
  "./js/modules/chat.js",
  "./js/modules/profile.js",
  "./js/modules/onboarding.js",
  "https://cdn.tailwindcss.com"
];

// 1. INSTALAÇÃO (Cache Inicial)
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ATIVAÇÃO (Limpeza de Caches Antigos)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. INTERCEPTAÇÃO (Offline First com exceções)
self.addEventListener("fetch", (e) => {
  // Ignora requisições do Firestore/Google/API (Deixa passar pra rede)
  if (e.request.url.includes('firestore') || 
      e.request.url.includes('googleapis') || 
      e.request.url.includes('firebase') ||
      e.request.method !== 'GET') {
      return; 
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      // Se achou no cache, devolve. Se não, busca na rede.
      return response || fetch(e.request).catch(() => {
          // Se falhar e for navegação (ex: sem internet), tenta retornar a home
          if (e.request.mode === 'navigate') {
              return caches.match('./index.html');
          }
      });
    })
  );
});
