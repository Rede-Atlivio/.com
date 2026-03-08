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
        icon: 'https://atlivio.com.br/assets/icon-192x192.png',
        badge: 'https://atlivio.com.br/assets/badge-72x72.png',
        vibrate: [300, 100, 300],
        data: { url: payload.data?.link || '/' }
    };
    return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});

// ⚡ [CACHE] Inteligência de Carregamento (O que estava no sw.js)
const CACHE_NAME = 'atlivio-cache-v61';
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
