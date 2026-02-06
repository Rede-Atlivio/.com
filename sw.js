// ============================================================================
// 🛡️ SERVICE WORKER ULTIMATE - VERSÃO: v30 (REDE PRIMEIRO)
// ============================================================================

// Mude este nome apenas se quiser forçar uma limpeza geral nos clientes
const CACHE_NAME = 'atlivio-ultimate-v30';

// ⚠️ LISTA MÍNIMA BLINDADA
// Colocamos apenas o index.html. O resto o SW aprende sozinho navegando.
// Isso evita o erro de "Arquivo não encontrado" que travava seu site.
const ASSETS_TO_CACHE = [
  './',
  './index.html'
];

// 1. INSTALAÇÃO (SILENCIOSA E SEGURA)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o SW a assumir o controle IMEDIATAMENTE (sem esperar fechar aba)
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear o básico. Se der erro (ex: 404), ele AVISA mas NÃO TRAVA o site.
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn("⚠️ SW: Alerta não-crítico na instalação:", err);
      });
    })
  );
});

// 2. ATIVAÇÃO (O EXTERMINADOR DE CACHE VELHO)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 SW: Faxina completa. Removendo cache antigo:', cache);
            return caches.delete(cache); // Deleta versões antigas (v15.4, v16, etc)
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle de todas as abas abertas
  );
});

// 3. INTERCEPTAÇÃO INTELIGENTE (STRATEGY: NETWORK FIRST)
// O Segredo: Ele sempre tenta a INTERNET primeiro. Se conseguir, atualiza o cache.
// Só usa o cache se a internet falhar.
self.addEventListener('fetch', (event) => {
  
  // Ignora requisições externas (Google, Firebase, APIs, Analytics)
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.method !== 'GET') {
      return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // SUCESSO NA REDE:
        // 1. Entrega o arquivo novo para o usuário.
        // 2. Guarda uma cópia no cache para o futuro (atualização em background).
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // FALHA NA REDE (OFFLINE):
        // Entrega o que tiver guardado no cache.
        return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // Se não tiver no cache e for navegação, manda pro index (SPA)
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        });
      })
  );
});
