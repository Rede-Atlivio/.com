import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO (PRIMEIRO DE TUDO!)
// ============================================================================
const firebaseConfig = { 
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", 
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com", 
    projectId: "atlivio-oficial-a1a29", 
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", 
    messagingSenderId: "887430049204", 
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1" 
};

// Inicializa as ferramentas AGORA
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

// EXPORTAÇÃO IMEDIATA (Para que auth.js e wallet.js consigam ler)
export { app, auth, db, storage, provider };

// Exposição Global (Para Debug e HTML)
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

// ============================================================================
// 2. CARREGAMENTO DOS MÓDULOS (AGORA É SEGURO)
// ============================================================================
// Importação dinâmica evita travamento se a internet estiver lenta
import './auth.js';                   // Auth Core
import './modules/auth_sms.js';       // SMS
import './modules/services.js';       // Marketplace
import './modules/jobs.js';           // Vagas
import './modules/opportunities.js';  // Afiliados
import './modules/chat.js';           // Chat
import './modules/reviews.js';        // Reviews
import './modules/wallet.js';         // 💰 CARTEIRA (Adicionei aqui pois faltava no seu)

// Funcionalidades Específicas
import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';
import { iniciarSistemaNotificacoes } from './modules/user_notifications.js';
import { iniciarMonitoramentoCarteira } from './modules/wallet.js'; // Importa o monitor

window.abrirConfiguracoes = abrirConfiguracoes;

// ============================================================================
// 3. INICIALIZAÇÃO DE SISTEMAS
// ============================================================================

console.log("✅ App Carregado: Sistema Híbrido Online.");

// Inicia o radar de notificações (CRM)
if(iniciarSistemaNotificacoes) iniciarSistemaNotificacoes(); 

// Monitoramento de Login
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário online:", user.uid);
        
        // Inicia sistemas vitais
        checkOnboarding(user); 
        if(iniciarMonitoramentoCarteira) iniciarMonitoramentoCarteira(); // Inicia Carteira V3.0
        
        // Libera a tela
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('hidden');
    }
});
