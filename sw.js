// 🚀 SW PRODUÇÃO ATLIVIO - V2.0 (ESTRATÉGIA SOBERANIA DE REDE)
const CACHE_NAME = 'atlivio-cache-v2.0'; 

// Arquivos que NUNCA devem ir para o cache (Sempre frescos)
const NEVER_CACHE = [
    'request.js',
    'request_v2.js',
    'auth.js',
    'profile.js'
];

self.addEventListener('install', (e) => self.skipWaiting());

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map((k) => {
                if (k !== CACHE_NAME) return caches.delete(k);
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 🛡️ REGRA DE OURO: Bypass total para Firebase/Google e métodos que não sejam GET
    if (url.href.includes('firestore.googleapis.com') || 
        url.href.includes('identitytoolkit.googleapis.com') || 
        url.href.includes('firebase') ||
        event.request.method !== 'GET') {
        return; 
    }

    // ⚡ ESTRATÉGIA: NETWORK FIRST (Prioriza a internet para evitar bugs de estado)
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Se a resposta for válida, guarda uma cópia no cache (exceto para a Blacklist)
                if (networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const isBlacklisted = NEVER_CACHE.some(file => url.pathname.includes(file));
                    
                    if (!isBlacklisted) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                }
                return networkResponse;
            })
            .catch(() => {
                // 🛟 FALLBACK: Se a internet cair, tenta o Cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return new Response("Offline", { status: 503 });
                });
            })
    );
});
