// 🚀 SW PRODUÇÃO ATLIVIO - V1.1 (BLINDADO)
const CACHE_NAME = 'atlivio-cache-v1.1'; // 👈 Se mudar o código, mude para v1.2

self.addEventListener('install', (e) => {
    console.log("📥 SW: Instalando nova versão...");
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log("🧹 SW: Faxina iniciada. Removendo caches obsoletos...");
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Se o cache que ele achou não for o atual, DELETA!
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Força o SW a mandar em todas as abas agora
    );
});

self.addEventListener('fetch', (event) => {
    // 🛡️ ESTRATÉGIA SNIPER: Prioridade para Lógica Versionada (?v=)
    if (event.request.url.includes('?v=')) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return networkResponse;
            }).catch(() => caches.match(event.request))
        );
    } else {
        // ⚡ ESTRATÉGIA VELOCIDADE: Fotos, Fontes e Estática
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const fetchPromise = fetch(event.request).then((network) => {
                    if (network.status === 200) {
                        caches.open(CACHE_NAME).then(c => c.put(event.request, network.clone()));
                    }
                    return network;
                });
                return cached || fetchPromise;
            })
        );
    }
});
