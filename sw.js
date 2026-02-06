const CACHE_NAME = 'atlivio-dynamic-v2-fix'; // Mudei o nome para forçar atualização
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // './assets/logo.png' <--- REMOVIDO (Causava o erro se não existisse)
  // Adicione aqui apenas arquivos que você TEM CERTEZA ABSOLUTA que existem
];

// 1. INSTALAÇÃO: Cacheia apenas o essencial (Shell)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 🚀 FORÇA A ATUALIZAÇÃO IMEDIATA
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ATIVAÇÃO: Limpa caches antigos automaticamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 SW: Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle da página na hora
  );
});

// 3. FETCH: ESTRATÉGIA "NETWORK FIRST" (Prioriza a Nuvem)
// Tenta baixar a versão nova. Se der erro (offline), usa o cache.
self.addEventListener('fetch', (event) => {
  // Ignora requisições do Firestore/Google (elas já têm cache próprio)
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se baixou com sucesso, atualiza o cache com a versão nova
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se estiver offline ou der erro, usa o cache
        return caches.match(event.request);
      })
  );
});
