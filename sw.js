const CACHE_NAME = 'atlivio-v30-RESCUE'; // Nome novo para obrigar reset
// ⚠️ LISTA VAZIA DE PROPOSITO: Evita erro de 404 que trava o SW
const ASSETS_TO_CACHE = [
  './index.html' 
];

// 1. INSTALAÇÃO (FORÇADA)
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Assume controle na hora
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Se der erro, ignora e segue a vida
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log("Ignorando erro de cache inicial:", err));
    })
  );
});

// 2. ATIVAÇÃO (MATADOR DE CACHE VELHO)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 SW: Deletando cache zumbi:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH (REDE PRIMEIRO -> ATUALIZAÇÃO EM TEMPO REAL)
self.addEventListener("fetch", (event) => {
  // Ignora coisas externas
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Sucesso na rede? Salva versão nova no cache
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Sem internet? Usa o cache
        return caches.match(event.request);
      })
  );
});
