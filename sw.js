// 🚀 SW PRODUÇÃO ATLIVIO - V50 (HÍBRIDO: SOBERANIA DE REDE + MAESTRO PUSH) ──▶
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

const CACHE_NAME = 'atlivio-cache-v50'; 

// 🛰️ INICIALIZAÇÃO FIREBASE (Dentro do Cérebro Único) ──▶
firebase.initializeApp({
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
});

const messaging = firebase.messaging();

// 🔔 RECEPTOR DE PUSH EXTERNO (MAESTRO FLOW) ──▶
messaging.onBackgroundMessage((payload) => {
    console.log('📬 Mensagem recebida em background:', payload);
    const notificationTitle = payload.data?.title || payload.notification?.title || "Notificação Atlivio";
    const notificationOptions = {
        body: payload.data?.message || payload.notification?.body || "Confira as novidades no App!",
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: payload.data?.url || '/' }
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

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
