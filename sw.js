const CACHE_NAME = "atlivio-v15.6"; // Subi a versão para forçar atualização
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./js/app.js",
  "./js/auth.js",
  "./js/wallet.js",
  "./js/modules/services.js",
  "./js/modules/jobs.js",
  "./js/modules/chat.js",
  "./js/modules/profile.js",
  "./js/modules/onboarding.js",
  // REMOVIDO: "https://cdn.tailwindcss.com" (Causava erro de CORS)
];

// 1. INSTALAÇÃO
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ATIVAÇÃO (Limpa caches velhos)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Limpando cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. INTERCEPTAÇÃO
self.addEventListener("fetch", (e) => {
  // Ignora Google, Firebase e Tailwind (Rede direta)
  if (e.request.url.includes('firestore') || 
      e.request.url.includes('googleapis') || 
      e.request.url.includes('firebase') ||
      e.request.url.includes('tailwindcss')) {
      return; 
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).catch(() => {
          if (e.request.mode === 'navigate') {
              return caches.match('./index.html');
          }
      });
    })
  );
});
