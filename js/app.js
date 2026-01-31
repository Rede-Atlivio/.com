import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================================
// 1. CARREGAMENTO DOS MÓDULOS (O Cérebro do Site)
// ============================================================================
import './auth.js';                  // Auth Core
import './modules/auth_sms.js';      // SMS & Máscara
import './modules/services.js';      // Marketplace de Serviços
import './modules/jobs.js';          // Vagas de Emprego (WhatsApp) & Upload PDF
import './modules/opportunities.js'; // Afiliados
import './modules/chat.js';          // Chat de Serviços (Original e Seguro)
import './modules/reviews.js';       // ⭐️ Sistema de Reputação (NOVO)

// Funcionalidades Específicas
import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';
import { iniciarSistemaNotificacoes } from './modules/user_notifications.js';

// ============================================================================
// 2. CONFIGURAÇÃO E INICIALIZAÇÃO FIREBASE
// ============================================================================
const firebaseConfig = { 
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", 
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com", 
    projectId: "atlivio-oficial-a1a29", 
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", 
    messagingSenderId: "887430049204", 
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1" 
};

// Inicializa as ferramentas
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

// ============================================================================
// 3. EXPOSIÇÃO GLOBAL (Para o HTML e outros scripts)
// ============================================================================
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;
window.abrirConfiguracoes = abrirConfiguracoes;

// Exportação para módulos ES6
export { app, auth, db, storage, provider };

// ============================================================================
// 4. INICIALIZAÇÃO DE SISTEMAS
// ============================================================================

console.log("✅ App Carregado: Sistema Híbrido Online.");

// Inicia o radar de notificações (CRM)
iniciarSistemaNotificacoes(); 

// Monitoramento de Login
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário online:", user.uid);
        checkOnboarding(user); // Verifica se precisa completar cadastro
        
        // Remove tela de login se ela estiver visível
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
    }
});
