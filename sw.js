// 🚀 SW PRODUÇÃO ATLIVIO - V60 (HÍBRIDO: CACHE + PUSH MAESTRO) ──▶
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

// 🛰️ CONFIGURAÇÃO DE AUTONOMIA DO RECEPTOR ──▶
const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

firebase.initializeApp(firebaseConfig);
// 🛰️ USAMOS 'VAR' PARA EVITAR CONFLITO DE REDECLARAÇÃO NO NAVEGADOR ──▶
var messaging = firebase.messaging();

// 🔔 ESCUTA DE SINAL EXTERNO (O QUE FAZ O CELULAR APITAR FORA) ──▶
messaging.onBackgroundMessage((payload) => {
    console.log('📬 [Maestro] Sinal recebido fora do App:', payload);
    
    // 🧠 Captura inteligente: Prioriza os dados do Maestro Flow (JSON)
    const title = payload.data?.title || payload.notification?.title || "ATLIVIO";
    const body = payload.data?.message || payload.notification?.body || "Você tem uma nova atualização!";
    
    // 🎨 CONFIGURAÇÃO VISUAL MASTER: Transforma a notificação em um App Profissional
    const options = {
        body: body,
        // 🖼️ ÍCONE: Imagem grande que aparece na notificação
        icon: 'https://ui-avatars.com/api/?name=A&background=1e3a8a&color=fff&size=128', 
        // 🛡️ BADGE: Ícone pequeno que aparece na barra de status do Android (Deve ser branco/transparente)
        badge: 'https://ui-avatars.com/api/?name=A&background=1e3a8a&color=fff&size=96',
        // 📳 VIBRAÇÃO: Padrão de pulso [vibra, pausa, vibra]
        vibrate: [300, 100, 300],
        // 🚀 MODO EMPILHAMENTO: Cada mensagem aparecerá individualmente no celular
        // 🔗 DADOS: Guarda a URL para onde o usuário vai ao clicar
        data: { url: payload.data?.url || '/' }
    };

    // 🛡️ TRAVA DE DUPLICIDADE: Só mostra o Push se o usuário NÃO estiver com o site aberto
    return clients.matchAll({type: 'window', includeUncontrolled: true}).then(windowClients => {
        const estaAtivo = windowClients.some(client => client.visibilityState === 'visible');
        
        if (estaAtivo) {
            console.log("🤫 [Maestro] Usuário já está no app. Push externo silenciado.");
            return; // Não mostra nada fora, deixa o Balão Azul do site cuidar disso
        }

        return self.registration.showNotification(title, options);
    });
});

// 🖱️ GERENCIADOR DE CLIQUE: Faz a mágica de abrir o site quando o usuário toca na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Fecha a janelinha
    event.waitUntil(
        clients.openWindow(event.notification.data.url) // Abre o Marketplace no lugar certo
    );
});
// ──▶ ABAIXO DAQUI SEGUE O SEU CÓDIGO DE CACHE (NEVER_CACHE, FETCH, ETC)

const CACHE_NAME = 'atlivio-cache-v50'; 

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
