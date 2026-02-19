// 💀 SERVICE WORKER SELF-DESTRUCT V99
self.addEventListener('install', () => {
  self.skipWaiting(); // Não espera nada, instala agora
});

self.addEventListener('activate', (event) => {
  // 1. Limpa TODOS os caches do navegador
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map(name => caches.delete(name)));
    }).then(() => {
      // 2. Desinstala a si mesmo e avisa as abas
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach(client => client.navigate(client.url)); // Recarrega o app do usuário
    })
  );
});
