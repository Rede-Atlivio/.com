// 🚀 SW PRODUÇÃO ATLIVIO - V1.2 (REPARO DE STREAM & BYPASS GOOGLE)
const CACHE_NAME = 'atlivio-cache-v1.2'; 

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 🛡️ REGRA DE OURO: Ignora TUDO que for do Google/Firebase/Auth
    // Isso evita que o cache trave a sincronização do banco de dados (o sumiço dos pedidos)
    if (url.includes('firestore.googleapis.com') || 
        url.includes('identitytoolkit.googleapis.com') || 
        url.includes('firebase') ||
        event.request.method !== 'GET') {
        return; // Deixa o navegador lidar direto com a rede
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((networkResponse) => {
                // Valida se a resposta é válida para cache
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // 🔄 CLONAGEM SEGURA: Clona antes de qualquer outra operação
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Fallback silencioso para erros de rede
                return new Response("Offline", { status: 503, statusText: "Offline" });
            });
        })
    );
});
