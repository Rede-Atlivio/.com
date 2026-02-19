// 🚀 SW INTELIGENTE V1.0 - Atlivio Production
const CACHE_NAME = 'atlivio-cache-v1';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Atualiza o cache com a versão nova da rede
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
        // Entrega o cache (se houver) ou espera a rede
        return cachedResponse || fetchPromise;
      });
    })
  );
});
