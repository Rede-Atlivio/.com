// 🛰️ RECEPTOR OFICIAL MAESTRO - V60.1
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

// 🔔 ESCUTA EXTERNA (FAZ O CELULAR APITAR)
messaging.onBackgroundMessage((payload) => {
    console.log('📬 [Maestro] Sinal recebido fora do App:', payload);
    
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

// 🖱️ CLIQUE NA NOTIFICAÇÃO
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
