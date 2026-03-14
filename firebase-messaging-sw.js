// 🛰️ MOTOR HÍBRIDO ATLIVIO V61.1 (UNIFICAÇÃO TOTAL: CACHE + PUSH)
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 🔔 [PUSH] Escuta de sinal externo
messaging.onBackgroundMessage((payload) => {
    const title = payload.data?.title || payload.notification?.title || "ATLIVIO";
    const body = payload.data?.message || payload.notification?.body || "Você tem uma nova atualização!";
    const options = {
        body: body,
        // 🛡️ Usamos caminhos relativos para garantir que o PWA ache os ícones na raiz
        icon: '/icon-192x192.png', 
        badge: '/icon-72x72.png', 
        vibrate: [300, 100, 300],
        // Injeta uma imagem grande se o Robô enviar, senão fica apenas o ícone
        image: payload.data?.image || null, 
       data: { 
            // 🛡️ Blindagem V66: Forçamos o dado de clique a ser sempre a raiz. 
            // O redirecionamento por abas agora é responsabilidade exclusiva do Maestro dentro do App.
            url: '/' 
        }
    };
    };
    // 🚀 REATIVAÇÃO MAESTRO: Esta linha transforma o sinal silencioso do Robô 
    // em uma notificação real, usando a Logo "A" que já está no cache do celular.
    return self.registration.showNotification(title, options);
});
});

/**
 * 🛡️ BLINDAGEM MAESTRO V66: Otimizado para Escala de Milhões.
 * Garante que o clique sempre caia na Home limpa, evitando Erro 404 e telas quebradas.
 */
self.addEventListener('notificationclick', (event) => {
    // 1. Fecha o balão da notificação imediatamente no celular do usuário
    event.notification.close();

    // 2. FORÇA A ROTA PARA A RAIZ: Como o Maestro dentro do site já gerencia a aba, 
    // nós não tentamos abrir subpastas que geram erro 404.
    const rootUrl = 'https://atlivio.com.br/'; 

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // 3. Se o usuário já estiver com o site aberto em alguma aba, apenas foca nela
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url === rootUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // 4. Se o site estiver fechado, abre uma nova janela na Home oficial
            if (clients.openWindow) return clients.openWindow(rootUrl);
        })
    );
});

// ⚡ [CACHE] Inteligência de Carregamento (O que estava no sw.js)
const CACHE_NAME = 'atlivio-cache-v62'; // 👈 Mudei para 62 para o celular entender que tem novidade
const NEVER_CACHE = ['request.js', 'request_v2.js', 'auth.js', 'profile.js'];

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
    if (url.href.includes('firestore.googleapis.com') || 
        url.href.includes('identitytoolkit') || 
        url.href.includes('firebase') || 
        event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse.status === 200) {
                    const isBlacklisted = NEVER_CACHE.some(file => url.pathname.includes(file));
                    if (!isBlacklisted) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    }
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || new Response("Offline", { status: 503 })))
    );
});
