// 🚀 SW PRODUÇÃO ATLIVIO - V1.1
const CACHE_NAME = 'atlivio-cache-v1.1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('fetch', (event) => {
    // 🛡️ ESTRATÉGIA SNIPER: Se o arquivo tem versão (?v=), vai na REDE PRIMEIRO
    if (event.request.url.includes('?v=')) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return networkResponse;
            }).catch(() => caches.match(event.request)) // Só usa cache se a rede cair
        );
    } else {
        // ⚡ ESTRATÉGIA VELOCIDADE: Para o resto (fotos, fontes), usa o que você já postou
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
