const CACHE_NAME = 'atlivio-cache-v17.0-KILLER';
self.addEventListener('install', event => {
    self.skipWaiting(); // Força atualização imediata
});
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    return caches.delete(cache); // Deleta TUDO
                })
            );
        })
    );
});
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request)); // Bypass total do cache
});
