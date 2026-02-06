const CACHE_NAME = 'atlivio-v17-reset'; // Mudei o nome para v17 para forçar atualização geral
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
  // ⚠️ RETIREI TODOS OS .JS DAQUI PARA EVITAR ERRO DE 404.
  // O Service Worker vai cachear eles dinamicamente conforme o uso.
];

// 1. INSTALAÇÃO
self.addEventListener("install", (e) => {
  self.skipWaiting(); // Força a atualização imediata
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear. Se falhar, não mata o SW, apenas avisa.
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error("⚠️ Erro ao cachear arquivos iniciais:", err);
      });
    })
  );
});

// 2. ATIVAÇÃO (Limpa o lixo antigo)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 SW: Removendo cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTAÇÃO (Estratégia: NETWORK FIRST - Prioriza a Nuvem)
self.addEventListener("fetch", (e) => {
  // Ignora requisições externas (Firestore, Google, etc)
  if (e.request.url.includes('firestore') || 
      e.request.url.includes('googleapis') || 
      e.request.url.includes('firebase')) {
      return; 
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Se a internet funcionou, atualiza o cache com a versão nova
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se a internet falhou, usa o cache (Offline)
        return caches.match(e.request);
      })
  );
});
