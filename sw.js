const CACHE_NAME = 'atlivio-v20-auto-update'; // Mudei o nome para limpar tudo
const ASSETS_TO_CACHE = [
  './',
  './index.html'
  // ⚠️ NÃO COLOQUE MAIS NADA AQUI MANUALMENTE.
  // O Service Worker vai aprender sozinho o que deve guardar.
];

// 1. INSTALAÇÃO (BLINDADA)
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Força a assumir o controle imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Se der erro ao baixar o index, ele avisa mas não trava o sistema
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn("⚠️ SW: Alerta na instalação (não crítico):", err);
      });
    })
  );
});

// 2. ATIVAÇÃO (LIMPEZA AUTOMÁTICA)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 SW: Limpando cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTAÇÃO (ESTRATÉGIA: REDE PRIMEIRO, CACHE DEPOIS)
// Isso garante que você SEMPRE veja a versão mais nova se tiver internet.
self.addEventListener("fetch", (event) => {
  // Ignora requisições do Google/Firebase/Firestore (Elas se viram sozinhas)
  if (event.request.url.includes('firestore') || 
      event.request.url.includes('googleapis') || 
      event.request.url.includes('firebase') ||
      event.request.method !== 'GET') {
      return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a internet respondeu bem, atualiza o cache com a versão nova
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Só usa o cache se a internet estiver OFF ou o servidor cair
        return caches.match(event.request);
      })
  );
});
