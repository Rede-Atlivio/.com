/* 🛰️ RECEPTOR DE PUSH EXTERNO ATLIVIO V25 */
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

// Repita os dados do seu config.js aqui para o Service Worker ter autonomia
firebase.initializeApp({
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
});

const messaging = firebase.messaging();

// Quando o celular recebe a mensagem com o app fechado
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Mensagem recebida em background:', payload);
  
  // 🛰️ CAPTAÇÃO INTELIGENTE: Tenta ler o título da área 'data' (Maestro) ou da área 'notification' (Padrão) ──▶
  const notificationTitle = payload.data?.title || payload.notification?.title || "Notificação Atlivio";
  const notificationOptions = {
    // 📝 CORPO DA MENSAGEM: Busca o texto da oferta ou guia enviado pelo Admin ou pelo fluxo automático ──▶
    body: payload.data?.message || payload.notification?.body || "Confira as novidades no App!",
    icon: '/favicon.ico', // Caminho do seu ícone
    data: { url: payload.data.url } // Link para onde o usuário vai ao clicar
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
